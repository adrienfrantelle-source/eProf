// ===== SOUS-ONGLETS D'IFRAMES (outils en ligne) =====
// OneDrive, Canva, Genially, Kahoot, Padlet, YouTube.
// Config personnelle : localStorage clé par prof + teacher_documents (doc_type iframe_embeds).

(function () {
    const DOC_TYPE = 'iframe_embeds';
    const LS_LEGACY = 'eprof_iframe_embeds';
    const LS_COLLAPSED = 'eprof_iframeEmbedsCollapsed';
    const LOAD_TIMEOUT_MS = 15000;

    const TABS = [
        {
            id: 'onedrive',
            title: 'OneDrive',
            iframeTitle: 'OneDrive - Stockage de fichiers',
            fields: [
                { key: 'resid', label: 'ID du dossier (resid)', placeholder: 'ID_DU_DOSSIER' },
                { key: 'authkey', label: 'Clé auth (authkey)', placeholder: '!CLE_AUTH' }
            ],
            buildSrc: function (c) {
                if (!c.resid || !c.authkey) return '';
                return 'https://onedrive.live.com/embed?resid=' + encodeURIComponent(c.resid) +
                    '&authkey=' + encodeURIComponent(c.authkey) + '&em=2';
            }
        },
        {
            id: 'canva',
            title: 'Canva',
            iframeTitle: 'Canva - Création de visuels',
            fields: [{ key: 'id', label: 'ID Canva', placeholder: 'ID_CANVA' }],
            buildSrc: function (c) {
                return c.id ? 'https://www.canva.com/design/' + encodeURIComponent(c.id) + '/embed?embed' : '';
            }
        },
        {
            id: 'genially',
            title: 'Genially',
            iframeTitle: 'Genially - Présentation interactive',
            fields: [{ key: 'id', label: 'ID Genially', placeholder: 'ID_GENIALLY' }],
            buildSrc: function (c) {
                return c.id ? 'https://view.genially.com/' + encodeURIComponent(c.id) + '/embed' : '';
            }
        },
        {
            id: 'kahoot',
            title: 'Kahoot',
            iframeTitle: 'Kahoot - Quiz interactif',
            fields: [{ key: 'id', label: 'Code PIN / ID Kahoot', placeholder: 'ID_KAHOOT' }],
            buildSrc: function (c) {
                return c.id ? 'https://embed.kahoot.it/?pin=' + encodeURIComponent(c.id) : '';
            }
        },
        {
            id: 'padlet',
            title: 'Padlet',
            iframeTitle: 'Padlet - Mur collaboratif',
            fields: [{ key: 'id', label: 'ID Padlet', placeholder: 'ID_PADLET' }],
            buildSrc: function (c) {
                return c.id ? 'https://padlet.com/embed/' + encodeURIComponent(c.id) : '';
            }
        },
        {
            id: 'youtube',
            title: 'YouTube',
            iframeTitle: 'YouTube - Lecteur vidéo',
            fields: [{ key: 'id', label: 'ID de la vidéo', placeholder: 'ID_VIDEO' }],
            buildSrc: function (c) {
                return c.id ? 'https://www.youtube.com/embed/' + encodeURIComponent(c.id) : '';
            }
        }
    ];

    function escapeAttr(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    }

    function escapeHtml(value) {
        return escapeAttr(value).replace(/'/g, '&#39;');
    }

    function teacherStorageKey() {
        if (window.teacherManager && window.teacherManager.getCurrentTeacher()) {
            return window.teacherManager.getStorageKey('iframeEmbeds');
        }
        const identifiant = localStorage.getItem('userName') || 'enseignant';
        return 'eprof_iframeEmbeds_' + identifiant;
    }

    function hasEmbedValues(config) {
        if (!config || typeof config !== 'object') return false;
        return TABS.some(function (tab) {
            const cfg = config[tab.id] || {};
            return tab.fields.some(function (field) { return !!(cfg[field.key] || '').trim(); });
        });
    }

    function readLocal() {
        try {
            const scoped = JSON.parse(localStorage.getItem(teacherStorageKey()) || 'null');
            if (scoped && typeof scoped === 'object') return scoped;
        } catch (e) { /* ignore */ }
        try {
            const legacy = JSON.parse(localStorage.getItem(LS_LEGACY) || '{}');
            if (legacy && typeof legacy === 'object' && hasEmbedValues(legacy)) {
                writeLocal(legacy);
                return legacy;
            }
        } catch (e) { /* ignore */ }
        return {};
    }

    function writeLocal(config) {
        localStorage.setItem(teacherStorageKey(), JSON.stringify(config));
    }

    function collapseKey() {
        if (window.teacherManager && window.teacherManager.getCurrentTeacher()) {
            return window.teacherManager.getStorageKey('iframeEmbedsCollapsed');
        }
        return LS_COLLAPSED;
    }

    function readCollapsed() {
        try {
            const raw = localStorage.getItem(collapseKey());
            if (raw === '0' || raw === 'false') return false;
            if (raw === '1' || raw === 'true') return true;
        } catch (e) { /* ignore */ }
        return true;
    }

    function writeCollapsed(collapsed) {
        localStorage.setItem(collapseKey(), collapsed ? '1' : '0');
    }

    async function loadCloud() {
        if (!window.EprofStore || !(await window.EprofStore.isOnlineReady())) return null;
        const { data, error } = await window.EprofStore.getTeacherDocument(DOC_TYPE);
        if (error) {
            console.error('❌ Intégrations iframes : chargement en ligne échoué', error);
            return null;
        }
        return data && data.data ? data.data : null;
    }

    async function saveCloud(config) {
        if (!window.EprofStore || !(await window.EprofStore.isOnlineReady())) return false;
        const { error } = await window.EprofStore.saveTeacherDocument(DOC_TYPE, config);
        if (error) {
            console.error('❌ Intégrations iframes : sauvegarde en ligne échouée', error);
            return false;
        }
        return true;
    }

    function render(host) {
        if (!host) return;
        let activeId = 'onedrive';
        let config = readLocal();
        const loaded = {};

        host.innerHTML =
            '<section class="tabbed-iframes">' +
            '<div class="tabbed-iframes-toolbar">' +
            '<button type="button" class="tabbed-iframes-toggle" id="tabbed-iframes-toggle" aria-expanded="false">' +
            '<span class="tabbed-iframes-chevron" aria-hidden="true">▶</span>' +
            '<span>Outils en ligne</span>' +
            '</button>' +
            '<button type="button" class="tabbed-iframes-help" id="tabbed-iframes-help" title="Comment configurer les intégrations" aria-label="Aide pour configurer les intégrations">?</button>' +
            '</div>' +
            '<div class="tabbed-iframes-body" id="tabbed-iframes-body" hidden>' +
            '<div class="tabbed-iframes-header">' +
            '<details class="tabbed-iframes-config">' +
            '<summary>Configurer les intégrations</summary>' +
            '<p class="tabbed-iframes-hint">Ces identifiants sont personnels à votre compte. Ils sont enregistrés en ligne et restent disponibles sur un autre ordinateur. Tant qu’un ID n’est pas renseigné, l’onglet affiche un message d’attente.</p>' +
            '<div class="tabbed-iframes-fields" id="tabbed-iframe-fields"></div>' +
            '<div class="tabbed-iframes-save-row">' +
            '<button type="button" class="btn-primary" id="tabbed-iframe-save">Enregistrer</button>' +
            '<span class="tabbed-iframes-status" id="tabbed-iframe-status"></span>' +
            '</div>' +
            '</details></div>' +
            '<div class="tabbed-iframes-tabs" role="tablist"></div>' +
            '<div class="tabbed-iframes-panel"></div>' +
            '</div>' +
            '<div class="tabbed-iframes-tuto" id="tabbed-iframes-tuto" hidden>' +
            '<div class="tabbed-iframes-tuto-card" role="dialog" aria-labelledby="tabbed-iframes-tuto-title">' +
            '<h4 id="tabbed-iframes-tuto-title">Mini tuto : configurer les intégrations</h4>' +
            '<ol>' +
            '<li>Ouvrez <strong>Outils en ligne</strong>, puis <strong>Configurer les intégrations</strong>.</li>' +
            '<li>Pour chaque service, récupérez l’identifiant d’<em>embed</em> (pas le lien de partage habituel) :</li>' +
            '</ol>' +
            '<ul class="tabbed-iframes-tuto-list">' +
            '<li><strong>OneDrive</strong> : dossier → Partager → Intégrer. Dans le code, copiez <code>resid=…</code> et <code>authkey=…</code>.</li>' +
            '<li><strong>Canva</strong> : Partager → Plus → Intégrer. L’ID est dans <code>/design/<em>ID</em>/</code>.</li>' +
            '<li><strong>Genially</strong> : Partager → Intégrer. L’ID est dans <code>view.genially.com/<em>ID</em>/</code>.</li>' +
            '<li><strong>Kahoot</strong> : lancez le quiz et copiez le <em>PIN</em> affiché aux élèves.</li>' +
            '<li><strong>Padlet</strong> : Partager → Intégrer dans un blog. L’ID est dans <code>padlet.com/embed/<em>ID</em></code>.</li>' +
            '<li><strong>YouTube</strong> : Partager → Intégrer, ou l’ID après <code>youtu.be/</code> / <code>watch?v=</code>.</li>' +
            '</ul>' +
            '<p>Cliquez sur <strong>Enregistrer</strong> : la config est liée à votre compte, pas à celui des collègues.</p>' +
            '<p class="tabbed-iframes-hint">Certains sites (Canva, Kahoot…) refusent parfois l’affichage en iframe. Dans ce cas, le message « contenu non disponible » est normal.</p>' +
            '<button type="button" class="btn-primary" id="tabbed-iframes-tuto-close">Fermer</button>' +
            '</div></div>' +
            '</section>';

        const tabsEl = host.querySelector('.tabbed-iframes-tabs');
        const panelEl = host.querySelector('.tabbed-iframes-panel');
        const fieldsEl = host.querySelector('#tabbed-iframe-fields');
        const statusEl = host.querySelector('#tabbed-iframe-status');
        const bodyEl = host.querySelector('#tabbed-iframes-body');
        const toggleBtn = host.querySelector('#tabbed-iframes-toggle');
        const chevronEl = host.querySelector('.tabbed-iframes-chevron');
        const tutoEl = host.querySelector('#tabbed-iframes-tuto');
        let collapsed = readCollapsed();

        function applyCollapsed() {
            bodyEl.hidden = collapsed;
            toggleBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
            chevronEl.textContent = collapsed ? '▶' : '▼';
            writeCollapsed(collapsed);
            if (!collapsed) showTab(activeId);
        }

        toggleBtn.addEventListener('click', function () {
            collapsed = !collapsed;
            applyCollapsed();
        });

        function setTutoOpen(open) {
            tutoEl.hidden = !open;
        }

        host.querySelector('#tabbed-iframes-help').addEventListener('click', function () {
            setTutoOpen(true);
        });
        host.querySelector('#tabbed-iframes-tuto-close').addEventListener('click', function () {
            setTutoOpen(false);
        });
        tutoEl.addEventListener('click', function (e) {
            if (e.target === tutoEl) setTutoOpen(false);
        });

        function tabConfig(tab) {
            return config[tab.id] || {};
        }

        function fillFields() {
            fieldsEl.innerHTML = TABS.map(function (tab) {
                const cfg = tabConfig(tab);
                return '<fieldset class="tabbed-iframes-fieldset">' +
                    '<legend>' + escapeHtml(tab.title) + '</legend>' +
                    tab.fields.map(function (field) {
                        return '<label>' + escapeHtml(field.label) +
                            '<input type="text" data-tab="' + escapeAttr(tab.id) + '" data-field="' + escapeAttr(field.key) +
                            '" value="' + escapeAttr(cfg[field.key] || '') + '" placeholder="' + escapeAttr(field.placeholder) + '">' +
                            '</label>';
                    }).join('') +
                    '</fieldset>';
            }).join('');
        }

        function collectFields() {
            const next = {};
            fieldsEl.querySelectorAll('input').forEach(function (input) {
                const tabId = input.getAttribute('data-tab');
                const field = input.getAttribute('data-field');
                if (!next[tabId]) next[tabId] = {};
                next[tabId][field] = input.value.trim();
            });
            return next;
        }

        function setStatus(text, kind) {
            statusEl.textContent = text;
            statusEl.className = 'tabbed-iframes-status' + (kind ? ' is-' + kind : '');
        }

        fillFields();

        host.querySelector('#tabbed-iframe-save').addEventListener('click', async function () {
            config = collectFields();
            writeLocal(config);
            Object.keys(loaded).forEach(function (k) { delete loaded[k]; });
            showTab(activeId);
            setStatus('Enregistrement…', '');
            const online = await saveCloud(config);
            setStatus(
                online
                    ? 'Enregistré sur votre compte.'
                    : 'Enregistré sur cet ordinateur uniquement (hors ligne).',
                online ? 'ok' : 'warn'
            );
        });

        tabsEl.innerHTML = TABS.map(function (tab) {
            return '<button type="button" class="tabbed-iframes-tab" role="tab" data-tab="' + escapeAttr(tab.id) + '">' +
                escapeHtml(tab.title) + '</button>';
        }).join('');

        tabsEl.addEventListener('click', function (e) {
            const btn = e.target.closest('[data-tab]');
            if (!btn) return;
            showTab(btn.getAttribute('data-tab'));
        });

        function showTab(tabId) {
            activeId = tabId;
            const tab = TABS.find(function (t) { return t.id === tabId; }) || TABS[0];
            tabsEl.querySelectorAll('.tabbed-iframes-tab').forEach(function (btn) {
                btn.classList.toggle('is-active', btn.getAttribute('data-tab') === tab.id);
            });

            const src = tab.buildSrc(tabConfig(tab));
            if (!src) {
                panelEl.innerHTML =
                    '<div class="tabbed-iframes-empty">' +
                    '<p>Ce contenu n’est pas encore configuré.</p>' +
                    '<p>Ouvrez « Configurer les intégrations » et renseignez l’identifiant ' + escapeHtml(tab.title) + '.</p>' +
                    '</div>';
                return;
            }

            panelEl.innerHTML =
                '<div class="tabbed-iframes-frame-wrap">' +
                '<div class="tabbed-iframes-loading">Chargement de ' + escapeHtml(tab.title) + '…</div>' +
                '<div class="tabbed-iframes-error" hidden>Ce contenu n’est pas disponible.</div>' +
                '<iframe title="' + escapeAttr(tab.iframeTitle) + '" loading="lazy" allowfullscreen ' +
                (tab.id === 'youtube'
                    ? 'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" '
                    : '') +
                'referrerpolicy="no-referrer-when-downgrade"></iframe>' +
                '</div>';

            const iframe = panelEl.querySelector('iframe');
            const loading = panelEl.querySelector('.tabbed-iframes-loading');
            const errorBox = panelEl.querySelector('.tabbed-iframes-error');
            let settled = false;

            const timer = setTimeout(function () {
                if (settled) return;
                settled = true;
                loading.hidden = true;
                errorBox.hidden = false;
                iframe.style.visibility = 'hidden';
            }, LOAD_TIMEOUT_MS);

            iframe.addEventListener('load', function () {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                loading.hidden = true;
                errorBox.hidden = true;
                iframe.style.visibility = 'visible';
            });

            iframe.src = src;
            loaded[tab.id] = true;
        }

        applyCollapsed();

        (async function hydrateFromCloud() {
            const remote = await loadCloud();
            if (remote && hasEmbedValues(remote)) {
                config = remote;
                writeLocal(config);
                fillFields();
                Object.keys(loaded).forEach(function (k) { delete loaded[k]; });
                if (!collapsed) showTab(activeId);
                return;
            }
            if (hasEmbedValues(config)) {
                await saveCloud(config);
            }
        })();
    }

    window.EprofTabbedIframes = { render: render, TABS: TABS };
})();
