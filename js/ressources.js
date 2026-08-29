// ===== RESSOURCES PÉDAGOGIQUES =====
// Dossier officiel (admin seulement) + dossiers perso public/privé.
// Les collègues peuvent masquer les dossiers partagés des autres.

(function () {
    const DOSSIER_OFFICIEL = 'Ressources ministérielles/officielles';
    const LS_ITEMS = 'ressourcesPedagogiques';
    const LS_OFFICIEL = 'ressourcesOfficielles';
    const LS_FOLDERS = 'ressourcesDossiers';
    const LS_HIDDEN = 'ressourcesDossiersMasques';
    const LS_COLLAPSED = 'ressourcesFamillesCollapsed';

    function escapeAttr(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;');
    }

    function escapeHtml(value) {
        return escapeAttr(value).replace(/'/g, '&#39;');
    }

    function ownerLabel(folder) {
        const prenom = (folder.owner_prenom || '').trim();
        const nom = (folder.owner_nom || '').trim();
        return [prenom, nom].filter(Boolean).join(' ') || folder.owner_identifiant || 'Collègue';
    }

    async function rpc(name, params) {
        const client = await window.getSupabaseClient();
        if (!client) throw new Error('Supabase non disponible.');
        const { data, error } = await client.rpc(name, params || {});
        if (error) throw error;
        return data;
    }

    function render(container) {
        container.innerHTML = `
            <div id="ressources-module">
                <h2>📚 Ressources pédagogiques</h2>
                <div class="jeux-controls">
                    <details class="plan-config-accordion">
                        <summary>➕ Ajouter une ressource ou un dossier</summary>
                        <div class="config-accordion-body">
                            <div class="ajout-jeu-form">
                                <input type="text" id="ressource-titre" placeholder="Titre de la ressource">
                                <input type="url" id="ressource-url" placeholder="Lien internet (https://...)">
                                <select id="ressource-famille"></select>
                                <button type="button" id="ajouter-ressource-btn" class="btn-primary">➕ Ajouter</button>
                            </div>
                            <div class="ressources-dossier-row">
                                <input type="text" id="ressource-nouvelle-famille" placeholder="Nouveau dossier (ex. Programmes, Manuels)">
                                <select id="ressource-visibilite">
                                    <option value="prive">🔒 Privé (moi uniquement)</option>
                                    <option value="public">🌐 Public (tous les enseignants)</option>
                                </select>
                                <button type="button" id="creer-famille-ressource-btn" class="btn-secondary">📁 Créer un dossier</button>
                            </div>
                            <p class="ressources-hint" id="ressources-hint"></p>
                        </div>
                    </details>
                </div>
                <div id="ressources-hidden-bar" class="ressources-hidden-bar" hidden></div>
                <div class="jeux-recherche">
                    <input type="text" id="recherche-ressource" placeholder="🔍 Rechercher une ressource…">
                </div>
                <div class="jeux-liste" id="ressources-liste"></div>
            </div>
        `;

        let items = [];
        let folders = [];
        let hiddenIds = [];
        let myId = null;
        let isAdmin = false;
        let collapsedFamilles = {};
        try { collapsedFamilles = JSON.parse(localStorage.getItem(LS_COLLAPSED) || '{}'); } catch (e) { collapsedFamilles = {}; }

        function persistLocal() {
            try {
                localStorage.setItem(LS_ITEMS, JSON.stringify(items.filter(function (it) { return !it.officiel && it.mine; })));
                localStorage.setItem(LS_OFFICIEL, JSON.stringify(items.filter(function (it) { return it.officiel; })));
                localStorage.setItem(LS_FOLDERS, JSON.stringify(folders));
                localStorage.setItem(LS_HIDDEN, JSON.stringify(hiddenIds));
            } catch (e) { /* ignore */ }
        }

        function myFolders() {
            return folders.filter(function (f) { return String(f.teacher_id) === String(myId); });
        }

        function sharedFoldersVisible() {
            return folders.filter(function (f) {
                return f.visibilite === 'public'
                    && String(f.teacher_id) !== String(myId)
                    && hiddenIds.indexOf(String(f.id)) === -1;
            });
        }

        function sharedFoldersHidden() {
            return folders.filter(function (f) {
                return f.visibilite === 'public'
                    && String(f.teacher_id) !== String(myId)
                    && hiddenIds.indexOf(String(f.id)) !== -1;
            });
        }

        function folderById(id) {
            return folders.find(function (f) { return String(f.id) === String(id); }) || null;
        }

        function writableTargets() {
            const list = [{ key: 'general', label: '📁 Général (privé)' }];
            if (isAdmin) list.unshift({ key: 'officiel', label: '🏛️ ' + DOSSIER_OFFICIEL });
            myFolders().sort(function (a, b) { return a.nom.localeCompare(b.nom, 'fr'); }).forEach(function (f) {
                const icon = f.visibilite === 'public' ? '🌐' : '🔒';
                list.push({ key: 'folder:' + f.id, label: icon + ' ' + f.nom });
            });
            return list;
        }

        function refreshFamilleSelect(selected) {
            const select = container.querySelector('#ressource-famille');
            if (!select) return;
            const targets = writableTargets();
            const current = selected || select.value || 'general';
            select.innerHTML = targets.map(function (t) {
                return '<option value="' + escapeAttr(t.key) + '">' + escapeHtml(t.label) + '</option>';
            }).join('');
            const keys = targets.map(function (t) { return t.key; });
            select.value = keys.indexOf(current) >= 0 ? current : 'general';
        }

        function refreshHint() {
            const hint = container.querySelector('#ressources-hint');
            if (!hint) return;
            hint.textContent = isAdmin
                ? 'Le dossier officiel est réservé à l’administrateur. Vos dossiers peuvent être privés ou publics ; les collègues peuvent masquer ceux que vous partagez.'
                : 'Le dossier officiel est géré par l’administrateur. Créez vos dossiers en privé ou en public. Vous pouvez masquer les dossiers partagés par les collègues.';
        }

        function itemsOfSection(section) {
            return items.filter(function (it) { return it.sectionKey === section.key; })
                .sort(function (a, b) { return (a.position || 0) - (b.position || 0); });
        }

        function normalizeItem(row) {
            const officiel = !!row.officiel;
            const mine = !officiel && String(row.teacher_id || '') === String(myId || '');
            let sectionKey = 'general';
            if (officiel) sectionKey = 'officiel';
            else if (row.folder_id) sectionKey = 'folder:' + row.folder_id;
            else if (row.famille && row.famille !== 'Général' && row.famille !== DOSSIER_OFFICIEL) {
                const own = myFolders().find(function (f) { return f.nom === row.famille; });
                sectionKey = own ? 'folder:' + own.id : 'general';
            }
            return {
                id: row.id,
                titre: row.title || row.titre || '',
                url: row.url || '',
                famille: row.famille || 'Général',
                position: Number(row.position) || 0,
                officiel: officiel,
                folder_id: row.folder_id || null,
                teacher_id: row.teacher_id || null,
                mine: mine,
                sectionKey: sectionKey
            };
        }

        function sections() {
            const list = [{
                key: 'officiel',
                nom: DOSSIER_OFFICIEL,
                kind: 'officiel',
                writable: isAdmin
            }];
            list.push({ key: 'general', nom: 'Général', kind: 'mine', writable: true, visibilite: 'prive' });
            myFolders().sort(function (a, b) { return a.nom.localeCompare(b.nom, 'fr'); }).forEach(function (f) {
                list.push({
                    key: 'folder:' + f.id,
                    nom: f.nom,
                    kind: 'mine',
                    writable: true,
                    visibilite: f.visibilite,
                    folder: f
                });
            });
            sharedFoldersVisible().sort(function (a, b) { return a.nom.localeCompare(b.nom, 'fr'); }).forEach(function (f) {
                list.push({
                    key: 'folder:' + f.id,
                    nom: f.nom,
                    kind: 'shared',
                    writable: false,
                    visibilite: 'public',
                    folder: f
                });
            });
            return list;
        }

        async function loadAll() {
            if (window.EprofAdmin) {
                try { isAdmin = await window.EprofAdmin.isCurrentUserAdmin(); } catch (e) { isAdmin = false; }
            }
            if (window.EprofStore) myId = await window.EprofStore.getTeacherId();

            const online = window.EprofStore && await window.EprofStore.isOnlineReady();
            if (online) {
                try {
                    const folderRows = (await rpc('list_visible_resource_folders')) || [];
                    folders = folderRows;
                    const hiddenRes = await window.EprofStore.list('pedagogical_resource_hidden_folders', {
                        filters: { user_id: myId }
                    });
                    hiddenIds = (hiddenRes.data || []).map(function (h) { return String(h.folder_id); });
                    const rows = (await rpc('list_visible_pedagogical_resources')) || [];
                    items = rows.map(normalizeItem);
                    persistLocal();
                    return;
                } catch (err) {
                    console.warn('⚠️ Ressources : bascule sur le cache local.', err);
                }
            }
            try { folders = JSON.parse(localStorage.getItem(LS_FOLDERS) || '[]'); } catch (e) { folders = []; }
            try { hiddenIds = JSON.parse(localStorage.getItem(LS_HIDDEN) || '[]'); } catch (e) { hiddenIds = []; }
            let perso = [];
            let officiel = [];
            try { perso = JSON.parse(localStorage.getItem(LS_ITEMS) || '[]'); } catch (e) { perso = []; }
            try { officiel = JSON.parse(localStorage.getItem(LS_OFFICIEL) || '[]'); } catch (e) { officiel = []; }
            items = perso.concat(officiel).map(normalizeItem);
        }

        function trouver(id, titre, url) {
            if (id) {
                const byId = items.find(function (it) { return String(it.id) === String(id); });
                if (byId) return byId;
            }
            return items.find(function (it) { return it.titre === titre && it.url === url; }) || null;
        }

        function parseTarget(key) {
            if (key === 'officiel') return { officiel: true, folder_id: null, famille: DOSSIER_OFFICIEL, sectionKey: 'officiel' };
            if (key === 'general') return { officiel: false, folder_id: null, famille: 'Général', sectionKey: 'general' };
            if (key && key.indexOf('folder:') === 0) {
                const folder = folderById(key.slice(7));
                if (!folder) return null;
                return { officiel: false, folder_id: folder.id, famille: folder.nom, sectionKey: 'folder:' + folder.id };
            }
            return null;
        }

        async function persistSection(sectionKey) {
            persistLocal();
            if (!window.EprofStore || !(await window.EprofStore.isOnlineReady())) return;
            const list = items.filter(function (it) { return it.sectionKey === sectionKey; })
                .sort(function (a, b) { return (a.position || 0) - (b.position || 0); });
            for (let i = 0; i < list.length; i++) {
                list[i].position = i;
                if (!list[i].id) continue;
                if (list[i].officiel && !isAdmin) continue;
                if (!list[i].officiel && !list[i].mine) continue;
                await window.EprofStore.update('pedagogical_resources', list[i].id, {
                    famille: list[i].famille,
                    position: i,
                    officiel: list[i].officiel,
                    folder_id: list[i].folder_id
                });
            }
        }

        function canWriteItem(item) {
            if (!item) return false;
            if (item.officiel) return isAdmin;
            return !!item.mine;
        }

        function deplacer(item, targetKey, beforeItem) {
            if (!item || !canWriteItem(item)) return false;
            const target = parseTarget(targetKey);
            if (!target) return false;
            if (item.officiel && targetKey !== 'officiel') return false;
            if (!item.officiel && targetKey === 'officiel') return false;
            if (targetKey.indexOf('folder:') === 0) {
                const folder = folderById(targetKey.slice(7));
                if (!folder || String(folder.teacher_id) !== String(myId)) return false;
            }
            const oldKey = item.sectionKey;
            item.famille = target.famille;
            item.folder_id = target.folder_id;
            item.officiel = target.officiel;
            item.sectionKey = target.sectionKey;
            const cible = items.filter(function (it) {
                return it !== item && it.sectionKey === target.sectionKey;
            }).sort(function (a, b) { return (a.position || 0) - (b.position || 0); });
            if (beforeItem && beforeItem !== item) {
                const idx = cible.indexOf(beforeItem);
                if (idx >= 0) cible.splice(idx, 0, item);
                else cible.push(item);
            } else {
                cible.push(item);
            }
            cible.forEach(function (it, i) { it.position = i; });
            collapsedFamilles[target.sectionKey] = false;
            localStorage.setItem(LS_COLLAPSED, JSON.stringify(collapsedFamilles));
            if (oldKey !== target.sectionKey) persistSection(oldKey);
            persistSection(target.sectionKey);
            return true;
        }

        function cardHtml(item, writable) {
            return (
                '<div class="jeu-card' + (writable ? '' : ' jeu-card-readonly') + '"' +
                (writable ? ' draggable="true"' : '') +
                ' data-id="' + escapeAttr(item.id || '') + '"' +
                ' data-titre="' + escapeAttr(item.titre) + '"' +
                ' data-url="' + escapeAttr(item.url) + '"' +
                ' data-section="' + escapeAttr(item.sectionKey) + '"' +
                ' title="' + (writable ? 'Glissez pour changer l’ordre ou de dossier' : 'Ressource en lecture seule') + '">' +
                '<div class="jeu-card-header">' +
                '<h4>' + (writable ? '<span class="jeu-card-grip" aria-hidden="true">⋮⋮</span>' : '') + escapeHtml(item.titre) + '</h4>' +
                (writable
                    ? '<span class="ressources-card-actions">' +
                        '<button type="button" class="btn-editer-ressource" draggable="false" data-id="' + escapeAttr(item.id || '') + '">✏️</button>' +
                        '<button type="button" class="btn-supprimer-jeu" draggable="false" data-id="' + escapeAttr(item.id || '') + '" data-titre="' + escapeAttr(item.titre) + '">🗑️</button>' +
                      '</span>'
                    : '') +
                '</div>' +
                '<a href="' + escapeAttr(item.url) + '" target="_blank" rel="noopener noreferrer" class="jeu-link" draggable="false">' +
                '<div class="jeu-icon">' + (item.officiel ? '🏛️' : '🔗') + '</div>' +
                '<div class="jeu-url">' + escapeHtml(item.url) + '</div>' +
                '<div class="jeu-action">Ouvrir</div>' +
                '</a></div>'
            );
        }

        function renderHiddenBar() {
            const bar = container.querySelector('#ressources-hidden-bar');
            const hidden = sharedFoldersHidden();
            if (!hidden.length) {
                bar.hidden = true;
                bar.innerHTML = '';
                return;
            }
            bar.hidden = false;
            bar.innerHTML = '<span>Dossiers partagés masqués :</span> ' + hidden.map(function (f) {
                return '<button type="button" class="ressources-unhide" data-folder="' + escapeAttr(f.id) + '">' +
                    escapeHtml(f.nom) + ' · ' + escapeHtml(ownerLabel(f)) + ' ✕</button>';
            }).join(' ');
            bar.querySelectorAll('.ressources-unhide').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    unhideFolder(btn.getAttribute('data-folder'));
                });
            });
        }

        async function hideFolder(folderId) {
            const id = String(folderId);
            if (hiddenIds.indexOf(id) === -1) hiddenIds.push(id);
            persistLocal();
            if (window.EprofStore && myId) {
                await window.EprofStore.upsert('pedagogical_resource_hidden_folders', [{
                    user_id: myId,
                    folder_id: folderId
                }], { onConflict: 'user_id,folder_id' });
            }
            afficher(container.querySelector('#recherche-ressource').value);
        }

        async function unhideFolder(folderId) {
            hiddenIds = hiddenIds.filter(function (id) { return id !== String(folderId); });
            persistLocal();
            if (window.EprofStore && myId) {
                const client = await window.getSupabaseClient();
                if (client) {
                    await client.from('pedagogical_resource_hidden_folders')
                        .delete()
                        .eq('user_id', myId)
                        .eq('folder_id', folderId);
                }
            }
            afficher(container.querySelector('#recherche-ressource').value);
        }

        async function editItem(item) {
            if (!canWriteItem(item)) return;
            const titre = prompt('Titre de la ressource', item.titre);
            if (titre == null) return;
            const url = prompt('Lien internet', item.url);
            if (url == null) return;
            const nextTitre = titre.trim();
            const nextUrl = url.trim();
            if (!nextTitre || !/^https?:\/\/.+/i.test(nextUrl)) {
                alert('Titre et lien http(s) obligatoires.');
                return;
            }
            item.titre = nextTitre;
            item.url = nextUrl;
            persistLocal();
            if (item.id && window.EprofStore) {
                const res = await window.EprofStore.update('pedagogical_resources', item.id, {
                    title: nextTitre,
                    url: nextUrl
                });
                if (res.error) alert('Modification impossible : ' + res.error.message);
            }
            afficher(container.querySelector('#recherche-ressource').value);
        }

        function afficher(filtreTexte) {
            filtreTexte = filtreTexte || '';
            const liste = container.querySelector('#ressources-liste');
            refreshFamilleSelect();
            refreshHint();
            renderHiddenBar();
            const q = filtreTexte.toLowerCase();
            const filtres = q
                ? items.filter(function (it) {
                    return (it.titre || '').toLowerCase().indexOf(q) !== -1
                        || (it.url || '').toLowerCase().indexOf(q) !== -1
                        || (it.famille || '').toLowerCase().indexOf(q) !== -1;
                })
                : items;

            if (q && filtres.length === 0) {
                liste.innerHTML = '<p class="ressources-empty">🔍 Aucune ressource ne correspond à votre recherche.</p>';
                return;
            }

            const visibles = sections().filter(function (section) {
                if (!q) return true;
                return filtres.some(function (it) { return it.sectionKey === section.key; });
            });

            liste.innerHTML = visibles.map(function (section) {
                const groupe = filtres.filter(function (it) { return it.sectionKey === section.key; })
                    .sort(function (a, b) { return (a.position || 0) - (b.position || 0); });
                const closed = !!collapsedFamilles[section.key];
                const writable = section.writable;
                let empty = 'Glissez une ressource ici';
                if (section.kind === 'officiel' && !isAdmin) empty = 'Dossier géré par l’administrateur.';
                else if (section.kind === 'officiel') empty = 'Ajoutez un lien ministériel ou officiel.';
                else if (section.kind === 'shared') empty = 'Aucune ressource dans ce dossier partagé.';
                const cartes = groupe.length ? groupe.map(function (it) { return cardHtml(it, writable && canWriteItem(it)); }).join('')
                    : '<p class="jeux-famille-vide">' + empty + '</p>';
                const tags = [];
                if (section.kind === 'officiel') tags.push('<em class="ressources-officiel-tag">Commun · admin</em>');
                if (section.visibilite === 'public' && section.kind === 'mine') tags.push('<em class="ressources-public-tag">Public</em>');
                if (section.kind === 'shared') {
                    tags.push('<em class="ressources-public-tag">Partagé · ' + escapeHtml(ownerLabel(section.folder)) + '</em>');
                }
                const hideBtn = section.kind === 'shared'
                    ? '<button type="button" class="ressources-hide-btn" data-folder="' + escapeAttr(section.folder.id) + '">Masquer</button>'
                    : '';
                const cls = ['jeux-famille'];
                if (section.kind === 'officiel') cls.push('jeux-famille-officielle');
                if (section.kind === 'shared') cls.push('jeux-famille-partagee');
                return (
                    '<section class="' + cls.join(' ') + '" data-section="' + escapeAttr(section.key) + '" data-writable="' + (writable ? '1' : '0') + '">' +
                    '<div class="jeux-famille-head">' +
                    '<button type="button" class="jeux-famille-toggle" aria-expanded="' + (closed ? 'false' : 'true') + '">' +
                    '<span class="jeux-famille-chevron">' + (closed ? '▶' : '▼') + '</span>' +
                    '<span>' + (section.kind === 'officiel' ? '🏛️' : section.visibilite === 'public' ? '🌐' : '📁') + ' ' + escapeHtml(section.nom) + '</span>' +
                    tags.join('') +
                    '<small>' + groupe.length + '</small>' +
                    '</button>' + hideBtn +
                    '</div>' +
                    '<div class="jeux-grid" style="' + (closed ? 'display:none;' : '') + '">' + cartes + '</div>' +
                    '</section>'
                );
            }).join('');

            container.querySelectorAll('.jeux-famille-toggle').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    const key = btn.closest('.jeux-famille').dataset.section;
                    collapsedFamilles[key] = !collapsedFamilles[key];
                    localStorage.setItem(LS_COLLAPSED, JSON.stringify(collapsedFamilles));
                    afficher(container.querySelector('#recherche-ressource').value);
                });
            });

            container.querySelectorAll('.ressources-hide-btn').forEach(function (btn) {
                btn.addEventListener('click', function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    hideFolder(btn.getAttribute('data-folder'));
                });
            });

            container.querySelectorAll('.btn-editer-ressource').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    const item = trouver(this.getAttribute('data-id'), '', '');
                    editItem(item);
                });
            });

            container.querySelectorAll('.btn-supprimer-jeu').forEach(function (btn) {
                btn.addEventListener('click', async function () {
                    const item = trouver(this.getAttribute('data-id'), this.getAttribute('data-titre'), '');
                    if (!item || !canWriteItem(item) || !confirm('Supprimer « ' + item.titre + ' » ?')) return;
                    const key = item.sectionKey;
                    items = items.filter(function (it) { return it !== item; });
                    if (item.id && window.EprofStore) window.EprofStore.remove('pedagogical_resources', item.id);
                    itemsOfSection({ key: key }).forEach(function (it, i) { it.position = i; });
                    persistSection(key);
                    afficher(container.querySelector('#recherche-ressource').value);
                });
            });

            let enDeplacement = null;
            let dragFini = false;

            function clearDropUi() {
                container.querySelectorAll('.jeux-famille-drop-target, .jeu-card-drop-before').forEach(function (el) {
                    el.classList.remove('jeux-famille-drop-target', 'jeu-card-drop-before');
                });
            }

            function canDropOn(sectionEl) {
                return !!(enDeplacement && sectionEl && sectionEl.getAttribute('data-writable') === '1');
            }

            container.querySelectorAll('.jeu-card[draggable="true"]').forEach(function (card) {
                card.addEventListener('dragstart', function (e) {
                    enDeplacement = {
                        id: card.getAttribute('data-id') || '',
                        titre: card.getAttribute('data-titre') || '',
                        url: card.getAttribute('data-url') || '',
                        section: card.getAttribute('data-section') || ''
                    };
                    card.classList.add('jeu-card-dragging');
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', enDeplacement.titre);
                });
                card.addEventListener('dragend', function () {
                    card.classList.remove('jeu-card-dragging');
                    clearDropUi();
                    dragFini = true;
                    enDeplacement = null;
                    setTimeout(function () { dragFini = false; }, 0);
                });
                card.addEventListener('dragover', function (e) {
                    const section = card.closest('.jeux-famille');
                    if (!canDropOn(section)) return;
                    const item = trouver(enDeplacement.id, enDeplacement.titre, enDeplacement.url);
                    const dest = section.dataset.section;
                    if (item && item.officiel && dest !== 'officiel') return;
                    if (item && !item.officiel && dest === 'officiel') return;
                    e.preventDefault();
                    e.stopPropagation();
                    e.dataTransfer.dropEffect = 'move';
                    container.querySelectorAll('.jeu-card-drop-before').forEach(function (el) {
                        if (el !== card) el.classList.remove('jeu-card-drop-before');
                    });
                    card.classList.add('jeu-card-drop-before');
                });
                card.addEventListener('drop', function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    card.classList.remove('jeu-card-drop-before');
                    const section = card.closest('.jeux-famille');
                    const dest = section && section.dataset.section;
                    const payload = enDeplacement;
                    if (!payload || !dest) return;
                    const item = trouver(payload.id, payload.titre, payload.url);
                    const before = trouver(card.getAttribute('data-id'), card.getAttribute('data-titre'), card.getAttribute('data-url'));
                    if (deplacer(item, dest, before)) afficher(container.querySelector('#recherche-ressource').value);
                });
                const lien = card.querySelector('.jeu-link');
                if (lien) {
                    lien.addEventListener('click', function (e) {
                        if (dragFini) e.preventDefault();
                    });
                }
            });

            container.querySelectorAll('.jeux-famille').forEach(function (section) {
                section.addEventListener('dragover', function (e) {
                    if (!canDropOn(section)) return;
                    const item = enDeplacement && trouver(enDeplacement.id, enDeplacement.titre, enDeplacement.url);
                    const dest = section.dataset.section;
                    if (item && item.officiel && dest !== 'officiel') return;
                    if (item && !item.officiel && dest === 'officiel') return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    section.classList.add('jeux-famille-drop-target');
                });
                section.addEventListener('dragleave', function (e) {
                    if (!section.contains(e.relatedTarget)) section.classList.remove('jeux-famille-drop-target');
                });
                section.addEventListener('drop', function (e) {
                    e.preventDefault();
                    section.classList.remove('jeux-famille-drop-target');
                    const dest = section.dataset.section;
                    const payload = enDeplacement;
                    if (!payload || !dest) return;
                    const item = trouver(payload.id, payload.titre, payload.url);
                    if (deplacer(item, dest, null)) afficher(container.querySelector('#recherche-ressource').value);
                });
            });
        }

        container.querySelector('#ajouter-ressource-btn').addEventListener('click', async function () {
            const titre = container.querySelector('#ressource-titre').value.trim();
            const url = container.querySelector('#ressource-url').value.trim();
            const target = parseTarget((container.querySelector('#ressource-famille') || {}).value || 'general');
            if (!titre) { alert('Saisissez un titre.'); return; }
            if (!/^https?:\/\/.+/i.test(url)) { alert('Saisissez un lien internet valide (http:// ou https://).'); return; }
            if (!target) { alert('Choisissez un dossier.'); return; }
            if (target.officiel && !isAdmin) { alert('Seul l’administrateur peut ajouter dans le dossier officiel.'); return; }
            const position = items.filter(function (it) { return it.sectionKey === target.sectionKey; }).length;
            const nouveau = normalizeItem({
                title: titre,
                url: url,
                famille: target.famille,
                position: position,
                officiel: target.officiel,
                folder_id: target.folder_id,
                teacher_id: target.officiel ? null : myId
            });
            nouveau.mine = !target.officiel;
            items.push(nouveau);
            persistLocal();
            if (window.EprofStore && await window.EprofStore.isOnlineReady()) {
                const res = await window.EprofStore.insert('pedagogical_resources', {
                    teacher_id: target.officiel ? null : myId,
                    created_by: myId,
                    title: titre,
                    url: url,
                    famille: target.famille,
                    position: position,
                    officiel: target.officiel,
                    folder_id: target.folder_id
                });
                if (res.error) alert('Enregistrement en ligne impossible : ' + res.error.message);
                else if (res.data && res.data.id) { nouveau.id = res.data.id; persistLocal(); }
            }
            container.querySelector('#ressource-titre').value = '';
            container.querySelector('#ressource-url').value = '';
            collapsedFamilles[target.sectionKey] = false;
            localStorage.setItem(LS_COLLAPSED, JSON.stringify(collapsedFamilles));
            afficher();
        });

        container.querySelector('#ressource-url').addEventListener('keypress', function (e) {
            if (e.key === 'Enter') container.querySelector('#ajouter-ressource-btn').click();
        });

        container.querySelector('#creer-famille-ressource-btn').addEventListener('click', async function () {
            const input = container.querySelector('#ressource-nouvelle-famille');
            const nom = (input && input.value.trim()) || '';
            const visibilite = (container.querySelector('#ressource-visibilite') || {}).value || 'prive';
            if (!nom) { alert('Saisissez un nom de dossier.'); return; }
            if (nom === DOSSIER_OFFICIEL) { alert('Ce nom est réservé au dossier commun.'); return; }
            if (myFolders().some(function (f) { return f.nom.toLowerCase() === nom.toLowerCase(); })) {
                alert('Vous avez déjà un dossier avec ce nom.');
                return;
            }
            const localFolder = {
                id: 'local-' + Date.now(),
                teacher_id: myId,
                nom: nom,
                visibilite: visibilite === 'public' ? 'public' : 'prive',
                owner_nom: '',
                owner_prenom: ''
            };
            if (window.EprofStore && await window.EprofStore.isOnlineReady() && myId) {
                const res = await window.EprofStore.insert('pedagogical_resource_folders', {
                    teacher_id: myId,
                    nom: nom,
                    visibilite: localFolder.visibilite
                });
                if (res.error) {
                    alert('Création impossible : ' + res.error.message);
                    return;
                }
                if (res.data) Object.assign(localFolder, res.data);
            }
            folders.push(localFolder);
            persistLocal();
            collapsedFamilles['folder:' + localFolder.id] = false;
            localStorage.setItem(LS_COLLAPSED, JSON.stringify(collapsedFamilles));
            if (input) input.value = '';
            refreshFamilleSelect('folder:' + localFolder.id);
            afficher(container.querySelector('#recherche-ressource').value);
        });

        container.querySelector('#recherche-ressource').addEventListener('input', function () {
            afficher(this.value);
        });

        loadAll().then(function () { afficher(); });
    }

    window.EprofRessources = { render: render, DOSSIER_OFFICIEL: DOSSIER_OFFICIEL };
})();
