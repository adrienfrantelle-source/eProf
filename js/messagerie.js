// ===== MESSAGERIE INTERNE eProf =====
// Conversations à une ou plusieurs personnes, nom personnalisable,
// texte et liens URL uniquement. Requiert une session Supabase.

(function () {
    const MAX_MESSAGE = 4000;
    const POLL_MS = 8000;
    const URL_RE = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;

    let renderGen = 0;
    let pollTimer = null;
    let currentChannelId = null;
    let channels = [];
    let directory = [];
    let myId = null;
    let searchTerm = '';

    function escapeHtml(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function linkify(escaped) {
        return escaped.replace(URL_RE, function (url) {
            const href = /^https?:\/\//i.test(url) ? url : 'https://' + url;
            if (!/^https?:\/\//i.test(href)) return url;
            return '<a href="' + escapeHtml(href) + '" target="_blank" rel="noopener noreferrer">' + url + '</a>';
        });
    }

    function formatWhen(value) {
        if (!value) return '';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return '';
        const now = new Date();
        const sameDay = d.toDateString() === now.toDateString();
        if (sameDay) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    }

    function formatFullDate(value) {
        if (!value) return '';
        return new Date(value).toLocaleDateString('fr-FR', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    }

    function displayName(person) {
        if (!person) return 'Enseignant';
        const prenom = (person.prenom || '').trim();
        const nom = (person.nom || '').trim();
        const label = [prenom, nom].filter(Boolean).join(' ');
        return label || person.identifiant || person.nom_affiche || 'Enseignant';
    }

    async function rpc(name, params) {
        const client = await window.getSupabaseClient();
        if (!client) throw new Error('Supabase non disponible.');
        const { data, error } = await client.rpc(name, params || {});
        if (error) throw error;
        return data;
    }

    async function getMyId() {
        if (myId) return myId;
        const session = await window.EprofStore.getSession();
        myId = session && session.user ? session.user.id : null;
        return myId;
    }

    function ensureCss() {
        if (document.querySelector('link[href="css/messagerie.css"]')) return;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'css/messagerie.css';
        document.head.appendChild(link);
    }

    async function loadDirectory() {
        directory = (await rpc('list_teacher_directory')) || [];
    }

    async function loadChannels() {
        channels = (await rpc('list_my_message_channels')) || [];
    }

    async function loadMessages(channelId) {
        const result = await window.EprofStore.list('message_messages', {
            filters: { channel_id: channelId },
            orderBy: 'created_at',
            ascending: true
        });
        if (result.error) throw result.error;
        return result.data || [];
    }

    async function markRead(channelId) {
        const uid = await getMyId();
        const client = await window.getSupabaseClient();
        if (!client || !uid) return;
        await client.from('message_channel_members')
            .update({ last_read_at: new Date().toISOString() })
            .eq('channel_id', channelId)
            .eq('user_id', uid);
    }

    function filteredChannels() {
        const q = searchTerm.trim().toLowerCase();
        if (!q) return channels;
        return channels.filter(function (c) {
            const membres = (c.membres || []).map(function (m) {
                return [m.nom_affiche, m.identifiant].join(' ');
            }).join(' ');
            return (c.nom || '').toLowerCase().indexOf(q) !== -1
                || membres.toLowerCase().indexOf(q) !== -1
                || (c.last_preview || '').toLowerCase().indexOf(q) !== -1;
        });
    }

    function renderChannelList(root) {
        const list = root.querySelector('#msg-channel-list');
        if (!list) return;
        const items = filteredChannels();
        if (!items.length) {
            list.innerHTML = '<p class="msg-empty-list">Aucune conversation. Créez-en une pour discuter avec vos collègues.</p>';
            return;
        }
        list.innerHTML = items.map(function (c) {
            const unread = c.unread_count > 0 ? '<span class="msg-badge">' + c.unread_count + '</span>' : '';
            const preview = escapeHtml((c.last_preview || 'Aucun message pour le moment').slice(0, 80));
            return '<button type="button" class="msg-channel-item' +
                (c.id === currentChannelId ? ' is-active' : '') +
                (c.unread_count > 0 ? ' is-unread' : '') +
                '" data-channel="' + escapeHtml(c.id) + '">' +
                '<span class="msg-channel-top"><span class="msg-channel-name">' + escapeHtml(c.nom) + '</span>' +
                unread + '</span>' +
                '<span class="msg-channel-preview">' + preview + '</span>' +
                '<span class="msg-channel-date">' + escapeHtml(formatWhen(c.last_message_at || c.created_at)) + '</span>' +
                '</button>';
        }).join('');
    }

    function renderThreadEmpty(panel) {
        panel.innerHTML =
            '<div class="msg-thread-empty">' +
            '<div class="msg-thread-empty-icon" aria-hidden="true">💬</div>' +
            '<h3>Aucune conversation sélectionnée</h3>' +
            '<p>Créez une discussion avec un ou plusieurs collègues. Texte et liens uniquement — pas de fichiers ni d’images.</p>' +
            '<button type="button" class="msg-btn msg-btn-primary" id="msg-new-from-empty">Nouvelle conversation</button>' +
            '</div>';
        panel.querySelector('#msg-new-from-empty').addEventListener('click', function () {
            openCreateModal(panel.closest('.messagerie-module'));
        });
    }

    function renderMessagesHtml(messages) {
        if (!messages.length) {
            return '<p class="msg-empty-thread">Aucun message. L’historique est vidé automatiquement chaque 31 juillet.</p>';
        }
        let lastDay = '';
        return messages.map(function (m) {
            const day = formatFullDate(m.created_at);
            let sep = '';
            if (day && day !== lastDay) {
                lastDay = day;
                sep = '<div class="msg-day"><span>' + escapeHtml(day) + '</span></div>';
            }
            const mine = m.auteur_id === myId;
            return sep +
                '<article class="msg-bubble ' + (mine ? 'is-mine' : 'is-theirs') + '">' +
                (mine ? '' : '<div class="msg-author">' + escapeHtml(m.auteur_nom || m.auteur_identifiant || 'Collègue') + '</div>') +
                '<div class="msg-body">' + linkify(escapeHtml(m.contenu)).replace(/\n/g, '<br>') + '</div>' +
                '<div class="msg-meta">' + escapeHtml(formatWhen(m.created_at)) + '</div>' +
                '</article>';
        }).join('');
    }

    async function openChannel(root, channelId) {
        currentChannelId = channelId;
        renderChannelList(root);
        const panel = root.querySelector('#msg-thread');
        const channel = channels.find(function (c) { return c.id === channelId; });
        if (!channel) {
            renderThreadEmpty(panel);
            return;
        }
        const membres = (channel.membres || []).map(function (m) {
            return m.nom_affiche || m.identifiant;
        }).join(', ');

        panel.innerHTML =
            '<div class="msg-thread-header">' +
            '<div class="msg-thread-title">' +
            '<h3 id="msg-thread-name">' + escapeHtml(channel.nom) + '</h3>' +
            '<p class="msg-thread-members">' + escapeHtml(membres) + '</p>' +
            '</div>' +
            '<div class="msg-thread-actions">' +
            '<button type="button" class="msg-btn msg-btn-ghost" id="msg-rename" title="Renommer">Renommer</button>' +
            '<button type="button" class="msg-btn msg-btn-ghost" id="msg-add-members" title="Ajouter des personnes">Ajouter</button>' +
            '<button type="button" class="msg-btn msg-btn-danger" id="msg-leave">Quitter</button>' +
            '</div></div>' +
            '<div class="msg-thread-scroll" id="msg-thread-scroll"></div>' +
            '<form class="msg-composer" id="msg-composer">' +
            '<p class="msg-composer-hint">Texte et liens URL uniquement (pas d’image ni de fichier).</p>' +
            '<div class="msg-composer-row">' +
            '<textarea id="msg-input" maxlength="' + MAX_MESSAGE + '" rows="2" placeholder="Écrire un message… Coller un lien si besoin." required></textarea>' +
            '<button type="submit" class="msg-btn msg-btn-primary">Envoyer</button>' +
            '</div></form>';

        try {
            const messages = await loadMessages(channelId);
            const scroll = panel.querySelector('#msg-thread-scroll');
            scroll.innerHTML = renderMessagesHtml(messages);
            scroll.scrollTop = scroll.scrollHeight;
            await markRead(channelId);
            channel.unread_count = 0;
            renderChannelList(root);
        } catch (err) {
            panel.querySelector('#msg-thread-scroll').innerHTML =
                '<p class="msg-error">Impossible de charger les messages : ' + escapeHtml(err.message) + '</p>';
        }

        panel.querySelector('#msg-rename').addEventListener('click', function () {
            renameChannel(root, channel);
        });
        panel.querySelector('#msg-add-members').addEventListener('click', function () {
            openAddMembersModal(root, channel);
        });
        panel.querySelector('#msg-leave').addEventListener('click', function () {
            leaveChannel(root, channel);
        });
        panel.querySelector('#msg-composer').addEventListener('submit', function (e) {
            e.preventDefault();
            sendMessage(root, channelId);
        });
        const input = panel.querySelector('#msg-input');
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                panel.querySelector('#msg-composer').requestSubmit();
            }
        });
        input.focus();
    }

    async function sendMessage(root, channelId) {
        const input = root.querySelector('#msg-input');
        const texte = input ? input.value.trim() : '';
        if (!texte) return;
        const btn = root.querySelector('#msg-composer button[type="submit"]');
        if (btn) btn.disabled = true;
        try {
            await rpc('send_channel_message', { p_channel_id: channelId, p_contenu: texte });
            if (input) input.value = '';
            await loadChannels();
            await openChannel(root, channelId);
        } catch (err) {
            alert('Envoi impossible : ' + err.message);
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    async function renameChannel(root, channel) {
        const next = prompt('Nom de la conversation', channel.nom || '');
        if (next == null) return;
        const nom = next.trim().slice(0, 80);
        if (!nom) {
            alert('Le nom ne peut pas être vide.');
            return;
        }
        const result = await window.EprofStore.update('message_channels', channel.id, { nom: nom });
        if (result.error) {
            alert('Renommage impossible : ' + result.error.message);
            return;
        }
        await loadChannels();
        await openChannel(root, channel.id);
    }

    async function leaveChannel(root, channel) {
        if (!confirm('Quitter « ' + channel.nom + ' » ? Vous ne verrez plus cette conversation.')) return;
        try {
            await rpc('leave_message_channel', { p_channel_id: channel.id });
            currentChannelId = null;
            await loadChannels();
            renderChannelList(root);
            renderThreadEmpty(root.querySelector('#msg-thread'));
        } catch (err) {
            alert('Impossible de quitter : ' + err.message);
        }
    }

    function colleaguesExcept(excludeIds) {
        const skip = {};
        (excludeIds || []).forEach(function (id) { skip[id] = true; });
        return directory.filter(function (p) { return p.id !== myId && !skip[p.id]; });
    }

    function peoplePickerHtml(people, emptyLabel) {
        if (!people.length) {
            return '<p class="msg-hint">' + escapeHtml(emptyLabel) + '</p>';
        }
        return '<div class="msg-people">' + people.map(function (p) {
            const extra = p.matiere ? ' · ' + p.matiere : '';
            return '<label class="msg-person">' +
                '<input type="checkbox" name="msg-person" value="' + escapeHtml(p.id) + '">' +
                '<span><strong>' + escapeHtml(displayName(p)) + '</strong>' +
                '<small>' + escapeHtml((p.identifiant || '') + extra) + '</small></span>' +
                '</label>';
        }).join('') + '</div>';
    }

    function selectedIds(overlay) {
        return Array.prototype.map.call(
            overlay.querySelectorAll('input[name="msg-person"]:checked'),
            function (el) { return el.value; }
        );
    }

    function openOverlay(title, bodyHtml, onSubmit) {
        const overlay = document.createElement('div');
        overlay.className = 'msg-overlay';
        overlay.innerHTML =
            '<div class="msg-dialog" role="dialog" aria-modal="true">' +
            '<div class="msg-dialog-header"><h3>' + escapeHtml(title) + '</h3>' +
            '<button type="button" class="msg-dialog-close" aria-label="Fermer">×</button></div>' +
            '<form class="msg-dialog-form">' + bodyHtml +
            '<div class="msg-dialog-actions">' +
            '<button type="button" class="msg-btn msg-btn-ghost msg-cancel">Annuler</button>' +
            '<button type="submit" class="msg-btn msg-btn-primary">Valider</button>' +
            '</div></form></div>';
        document.body.appendChild(overlay);

        function close() { overlay.remove(); }
        overlay.querySelector('.msg-dialog-close').addEventListener('click', close);
        overlay.querySelector('.msg-cancel').addEventListener('click', close);
        overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
        overlay.querySelector('form').addEventListener('submit', function (e) {
            e.preventDefault();
            onSubmit(overlay, close);
        });
        const search = overlay.querySelector('.msg-people-search');
        if (search) {
            search.addEventListener('input', function () {
                const q = search.value.trim().toLowerCase();
                overlay.querySelectorAll('.msg-person').forEach(function (row) {
                    row.style.display = row.textContent.toLowerCase().indexOf(q) !== -1 ? '' : 'none';
                });
            });
        }
        return overlay;
    }

    function openCreateModal() {
        const people = colleaguesExcept([]);
        openOverlay('Nouvelle conversation',
            '<label class="msg-full">Nom de la conversation' +
            '<input type="text" class="msg-conv-name" maxlength="80" placeholder="Laissé vide = noms des participants"></label>' +
            '<p class="msg-hint">Choisissez une ou plusieurs personnes. Texte et liens uniquement.</p>' +
            '<input type="search" class="msg-people-search" placeholder="Filtrer les collègues…">' +
            peoplePickerHtml(people, 'Aucun autre enseignant inscrit pour le moment.'),
            async function (overlay, close) {
                const ids = selectedIds(overlay);
                if (!ids.length) {
                    alert('Choisissez au moins un destinataire.');
                    return;
                }
                const nom = overlay.querySelector('.msg-conv-name').value.trim();
                try {
                    const id = await rpc('create_message_channel', {
                        p_nom: nom || null,
                        p_member_ids: ids
                    });
                    close();
                    const root = document.querySelector('.messagerie-module');
                    await loadChannels();
                    renderChannelList(root);
                    await openChannel(root, id);
                } catch (err) {
                    alert('Création impossible : ' + err.message);
                }
            }
        );
    }

    function openAddMembersModal(root, channel) {
        const already = (channel.membres || []).map(function (m) { return m.user_id; });
        const people = colleaguesExcept(already);
        openOverlay('Ajouter des personnes',
            '<input type="search" class="msg-people-search" placeholder="Filtrer les collègues…">' +
            peoplePickerHtml(people, 'Tous les collègues sont déjà dans cette conversation.'),
            async function (overlay, close) {
                const ids = selectedIds(overlay);
                if (!ids.length) {
                    close();
                    return;
                }
                try {
                    await rpc('add_message_channel_members', {
                        p_channel_id: channel.id,
                        p_member_ids: ids
                    });
                    close();
                    await loadChannels();
                    await openChannel(root, channel.id);
                } catch (err) {
                    alert('Ajout impossible : ' + err.message);
                }
            }
        );
    }

    function wireList(root) {
        root.querySelector('#msg-new').addEventListener('click', function () {
            openCreateModal();
        });
        root.querySelector('#msg-search').addEventListener('input', function (e) {
            searchTerm = e.target.value;
            renderChannelList(root);
        });
        root.querySelector('#msg-channel-list').addEventListener('click', function (e) {
            const btn = e.target.closest('[data-channel]');
            if (!btn) return;
            openChannel(root, btn.getAttribute('data-channel'));
        });
    }

    async function refreshOpen(root) {
        const keep = currentChannelId;
        await loadChannels();
        renderChannelList(root);
        if (!keep) return;
        if (!channels.some(function (c) { return c.id === keep; })) {
            currentChannelId = null;
            renderThreadEmpty(root.querySelector('#msg-thread'));
            return;
        }
        const scroll = root.querySelector('#msg-thread-scroll');
        const nearBottom = scroll ? (scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight) < 80 : true;
        try {
            const messages = await loadMessages(keep);
            if (!scroll) return;
            scroll.innerHTML = renderMessagesHtml(messages);
            if (nearBottom) scroll.scrollTop = scroll.scrollHeight;
            await markRead(keep);
        } catch (e) {
            /* polling silencieux */
        }
    }

    async function render(container) {
        ensureCss();
        renderGen += 1;
        const myGen = renderGen;
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
        currentChannelId = null;
        myId = null;
        searchTerm = '';
        channels = [];
        directory = [];

        if (!window.EprofStore || !(await window.EprofStore.isOnlineReady())) {
            container.innerHTML =
                '<div class="messagerie-offline">' +
                '<h2>Messagerie</h2>' +
                '<p>La messagerie interne nécessite une connexion. Connectez-vous pour échanger avec vos collègues.</p>' +
                '</div>';
            return;
        }

        container.innerHTML =
            '<div class="messagerie-module">' +
            '<aside class="msg-sidebar">' +
            '<div class="msg-sidebar-header">' +
            '<h2>Messagerie</h2>' +
            '<button type="button" class="msg-btn msg-btn-primary" id="msg-new">Nouvelle</button>' +
            '</div>' +
            '<p class="msg-sidebar-hint">Discussions internes · liens URL acceptés · historique vidé chaque 31 juillet · canaux inactifs 6 mois retirés</p>' +
            '<input type="search" id="msg-search" placeholder="Rechercher une conversation…">' +
            '<div id="msg-channel-list" class="msg-channel-list"></div>' +
            '</aside>' +
            '<section id="msg-thread" class="msg-thread"></section>' +
            '</div>';

        const root = container.querySelector('.messagerie-module');
        renderThreadEmpty(root.querySelector('#msg-thread'));
        wireList(root);

        try {
            await rpc('cleanup_messagerie');
            await getMyId();
            await Promise.all([loadDirectory(), loadChannels()]);
            renderChannelList(root);
        } catch (err) {
            root.querySelector('#msg-channel-list').innerHTML =
                '<p class="msg-error">Chargement impossible : ' + escapeHtml(err.message) +
                '<br>La migration messagerie a-t-elle été appliquée ?</p>';
            return;
        }

        pollTimer = setInterval(function () {
            if (myGen !== renderGen) {
                clearInterval(pollTimer);
                pollTimer = null;
                return;
            }
            if (!document.body.contains(root)) {
                clearInterval(pollTimer);
                pollTimer = null;
                return;
            }
            refreshOpen(root);
        }, POLL_MS);
    }

    window.EprofMessagerie = { render: render };
})();
