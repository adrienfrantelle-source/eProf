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
            '<button type="button" class="msg-btn msg-btn-ghost" id="msg-configure" title="Nom, participants, suppression">Configurer</button>' +
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

        panel.querySelector('#msg-configure').addEventListener('click', function () {
            openSettingsModal(root, channel);
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

    async function leaveChannel(root, channel, overlayClose) {
        if (!confirm('Quitter « ' + channel.nom + ' » ? Vous ne verrez plus cette conversation.')) return;
        try {
            await rpc('leave_message_channel', { p_channel_id: channel.id });
            if (overlayClose) overlayClose();
            currentChannelId = null;
            await loadChannels();
            renderChannelList(root);
            renderThreadEmpty(root.querySelector('#msg-thread'));
        } catch (err) {
            alert('Impossible de quitter : ' + err.message);
        }
    }

    async function deleteChannel(root, channel, overlayClose) {
        if (!confirm('Supprimer définitivement « ' + channel.nom + ' » pour tous les participants ?')) return;
        try {
            await rpc('delete_message_channel', { p_channel_id: channel.id });
            if (overlayClose) overlayClose();
            currentChannelId = null;
            await loadChannels();
            renderChannelList(root);
            renderThreadEmpty(root.querySelector('#msg-thread'));
        } catch (err) {
            alert('Suppression impossible : ' + err.message);
        }
    }

    function personOptionLabel(person) {
        const name = displayName(person);
        const extra = [];
        if (person.identifiant && name.toLowerCase() !== String(person.identifiant).toLowerCase()) {
            extra.push(person.identifiant);
        }
        if (person.matiere) extra.push(person.matiere);
        return extra.length ? name + ' — ' + extra.join(' · ') : name;
    }

    function findPerson(id) {
        const key = String(id || '');
        return directory.find(function (p) { return String(p.id) === key; }) || null;
    }

    function colleaguesExcept(excludeIds) {
        const skip = {};
        (excludeIds || []).forEach(function (id) { skip[String(id)] = true; });
        if (myId) skip[String(myId)] = true;
        return directory.filter(function (p) { return !skip[String(p.id)]; });
    }

    function pickerHtml() {
        return '<div class="msg-picker">' +
            '<label class="msg-full">Ajouter un enseignant' +
            '<div class="msg-dropdown-row">' +
            '<select class="msg-teacher-select"><option value="">Choisir un enseignant inscrit…</option></select>' +
            '<button type="button" class="msg-btn msg-btn-ghost msg-add-from-select">Ajouter</button>' +
            '</div></label>' +
            '<div class="msg-chips"></div>' +
            '<p class="msg-picker-empty msg-hint" hidden>Aucun autre enseignant inscrit n’est disponible.</p>' +
            '</div>';
    }

    function wireTeacherPicker(overlay, initialIds, options) {
        const opts = options || {};
        const locked = {};
        (opts.lockedIds || []).forEach(function (id) { locked[String(id)] = true; });
        const selected = [];
        (initialIds || []).forEach(function (id) {
            const key = id ? String(id) : '';
            if (key && selected.indexOf(key) === -1) selected.push(key);
        });

        const select = overlay.querySelector('.msg-teacher-select');
        const chips = overlay.querySelector('.msg-chips');
        const empty = overlay.querySelector('.msg-picker-empty');
        const addBtn = overlay.querySelector('.msg-add-from-select');

        function addId(id) {
            const key = id ? String(id) : '';
            if (!key || selected.indexOf(key) !== -1) return;
            selected.push(key);
            refresh();
        }

        function removeId(id) {
            const key = String(id || '');
            if (locked[key]) return;
            const i = selected.indexOf(key);
            if (i !== -1) selected.splice(i, 1);
            refresh();
        }

        function refresh() {
            const available = colleaguesExcept(selected);
            if (empty) empty.hidden = available.length > 0 || selected.length > 0;
            if (select) {
                select.innerHTML = '<option value="">Choisir un enseignant inscrit…</option>' +
                    available.map(function (p) {
                        return '<option value="' + escapeHtml(p.id) + '">' +
                            escapeHtml(personOptionLabel(p)) + '</option>';
                    }).join('');
                select.disabled = available.length === 0;
            }
            if (addBtn) addBtn.disabled = available.length === 0;
            if (chips) {
                chips.innerHTML = selected.map(function (id) {
                    const person = findPerson(id);
                    const member = (opts.memberLookup && opts.memberLookup[id]) || null;
                    const label = person
                        ? displayName(person)
                        : (member && (member.nom_affiche || member.identifiant)) || 'Enseignant';
                    const canRemove = !locked[id];
                    return '<span class="msg-chip">' + escapeHtml(label) +
                        (canRemove
                            ? '<button type="button" class="msg-chip-remove" data-remove="' +
                                escapeHtml(id) + '" aria-label="Retirer">×</button>'
                            : '<span class="msg-chip-you">vous</span>') +
                        '</span>';
                }).join('');
            }
        }

        if (addBtn) {
            addBtn.addEventListener('click', function () {
                if (select && select.value) addId(select.value);
            });
        }
        if (select) {
            select.addEventListener('change', function () {
                if (select.value) addId(select.value);
            });
        }
        if (chips) {
            chips.addEventListener('click', function (e) {
                const btn = e.target.closest('[data-remove]');
                if (!btn) return;
                removeId(btn.getAttribute('data-remove'));
            });
        }

        refresh();
        return {
            getIds: function () { return selected.slice(); },
            refresh: refresh
        };
    }

    function openOverlay(title, bodyHtml, submitLabel, onReady) {
        const overlay = document.createElement('div');
        overlay.className = 'msg-overlay';
        overlay.innerHTML =
            '<div class="msg-dialog" role="dialog" aria-modal="true">' +
            '<div class="msg-dialog-header"><h3>' + escapeHtml(title) + '</h3>' +
            '<button type="button" class="msg-dialog-close" aria-label="Fermer">×</button></div>' +
            '<form class="msg-dialog-form">' + bodyHtml +
            '<div class="msg-dialog-actions" id="msg-dialog-actions">' +
            '<button type="button" class="msg-btn msg-btn-ghost msg-cancel">Annuler</button>' +
            (submitLabel
                ? '<button type="submit" class="msg-btn msg-btn-primary">' + escapeHtml(submitLabel) + '</button>'
                : '') +
            '</div></form></div>';
        document.body.appendChild(overlay);

        function close() { overlay.remove(); }
        overlay.querySelector('.msg-dialog-close').addEventListener('click', close);
        overlay.querySelector('.msg-cancel').addEventListener('click', close);
        overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
        if (onReady) onReady(overlay, close);
        return overlay;
    }

    function openCreateModal() {
        openOverlay(
            'Nouvelle conversation',
            '<label class="msg-full">Nom de la conversation' +
            '<input type="text" class="msg-conv-name" maxlength="80" placeholder="Laissé vide = noms des participants"></label>' +
            '<p class="msg-hint">Sélectionnez un ou plusieurs enseignants inscrits. Texte et liens uniquement.</p>' +
            pickerHtml(),
            'Créer',
            function (overlay, close) {
                const picker = wireTeacherPicker(overlay, []);
                overlay.querySelector('form').addEventListener('submit', async function (e) {
                    e.preventDefault();
                    const ids = picker.getIds();
                    if (!ids.length) {
                        alert('Choisissez au moins un destinataire dans le menu.');
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
                });
            }
        );
    }

    function openSettingsModal(root, channel) {
        const membres = channel.membres || [];
        const memberLookup = {};
        const currentIds = membres.map(function (m) {
            const id = String(m.user_id);
            memberLookup[id] = m;
            return id;
        });
        const lockedIds = myId ? [String(myId)] : [];
        const creatorId = channel.created_by ? String(channel.created_by) : null;
        const canDelete = !creatorId || creatorId === String(myId);

        openOverlay(
            'Configurer le canal',
            '<label class="msg-full">Nom de la conversation' +
            '<input type="text" class="msg-conv-name" maxlength="80" value="' + escapeHtml(channel.nom || '') + '" required></label>' +
            '<p class="msg-hint">Modifiez le nom, ajoutez ou retirez des enseignants inscrits.</p>' +
            pickerHtml() +
            '<div class="msg-settings-danger">' +
            '<button type="button" class="msg-btn msg-btn-ghost" id="msg-settings-leave">Quitter le canal</button>' +
            (canDelete
                ? '<button type="button" class="msg-btn msg-btn-danger" id="msg-settings-delete">Supprimer le canal</button>'
                : '') +
            '</div>',
            'Enregistrer',
            function (overlay, close) {
                const picker = wireTeacherPicker(overlay, currentIds, {
                    lockedIds: lockedIds,
                    memberLookup: memberLookup
                });

                overlay.querySelector('#msg-settings-leave').addEventListener('click', function () {
                    leaveChannel(root, channel, close);
                });
                const delBtn = overlay.querySelector('#msg-settings-delete');
                if (delBtn) {
                    delBtn.addEventListener('click', function () {
                        deleteChannel(root, channel, close);
                    });
                }

                overlay.querySelector('form').addEventListener('submit', async function (e) {
                    e.preventDefault();
                    const nom = overlay.querySelector('.msg-conv-name').value.trim().slice(0, 80);
                    if (!nom) {
                        alert('Le nom ne peut pas être vide.');
                        return;
                    }
                    const nextIds = picker.getIds();
                    const others = nextIds.filter(function (id) { return id !== String(myId); });
                    if (!others.length) {
                        alert('Le canal doit contenir au moins un autre enseignant. Utilisez « Quitter » ou « Supprimer » pour le retirer.');
                        return;
                    }
                    const prev = currentIds.filter(function (id) { return id !== String(myId); });
                    const toAdd = others.filter(function (id) { return prev.indexOf(id) === -1; });
                    const toRemove = prev.filter(function (id) { return others.indexOf(id) === -1; });
                    try {
                        if (nom !== (channel.nom || '')) {
                            const result = await window.EprofStore.update('message_channels', channel.id, { nom: nom });
                            if (result.error) throw result.error;
                        }
                        if (toAdd.length) {
                            await rpc('add_message_channel_members', {
                                p_channel_id: channel.id,
                                p_member_ids: toAdd
                            });
                        }
                        if (toRemove.length) {
                            await rpc('remove_message_channel_members', {
                                p_channel_id: channel.id,
                                p_member_ids: toRemove
                            });
                        }
                        close();
                        await loadChannels();
                        await openChannel(root, channel.id);
                    } catch (err) {
                        alert('Enregistrement impossible : ' + err.message);
                    }
                });
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
            await getMyId();
            await Promise.all([loadDirectory(), loadChannels()]);
            renderChannelList(root);
        } catch (err) {
            root.querySelector('#msg-channel-list').innerHTML =
                '<p class="msg-error">Chargement impossible : ' + escapeHtml(err.message) +
                '<br>La migration messagerie a-t-elle été appliquée ?</p>';
            return;
        }

        try {
            await rpc('cleanup_messagerie');
        } catch (err) {
            console.warn('⚠️ Nettoyage messagerie reporté.', err);
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
