// ===== SOUS-ONGLETS D'IFRAMES (outils en ligne) =====
// OneDrive, Canva, Genially, Kahoot, Padlet, YouTube.
// Les identifiants d'embed se règlent dans le panneau de configuration.

(function () {
    const LS_KEY = 'eprof_iframe_embeds';
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

    function readConfig() {
        try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch (e) { return {}; }
    }

    function writeConfig(config) {
        localStorage.setItem(LS_KEY, JSON.stringify(config));
    }

    function tabConfig(tab) {
        const all = readConfig();
        return all[tab.id] || {};
    }

    function render(host) {
        if (!host) return;
        let activeId = 'onedrive';
        const loaded = {};

        host.innerHTML =
            '<section class="tabbed-iframes">' +
            '<div class="tabbed-iframes-header">' +
            '<h3>Outils en ligne</h3>' +
            '<details class="tabbed-iframes-config">' +
            '<summary>Configurer les intégrations</summary>' +
            '<p class="tabbed-iframes-hint">Collez les identifiants d’embed de chaque service. Tant qu’un ID n’est pas renseigné, l’onglet affiche un message d’attente.</p>' +
            '<div class="tabbed-iframes-fields" id="tabbed-iframe-fields"></div>' +
            '<button type="button" class="btn-primary" id="tabbed-iframe-save">Enregistrer</button>' +
            '</details></div>' +
            '<div class="tabbed-iframes-tabs" role="tablist"></div>' +
            '<div class="tabbed-iframes-panel"></div>' +
            '</section>';

        const tabsEl = host.querySelector('.tabbed-iframes-tabs');
        const panelEl = host.querySelector('.tabbed-iframes-panel');
        const fieldsEl = host.querySelector('#tabbed-iframe-fields');

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

        host.querySelector('#tabbed-iframe-save').addEventListener('click', function () {
            const next = {};
            fieldsEl.querySelectorAll('input').forEach(function (input) {
                const tabId = input.getAttribute('data-tab');
                const field = input.getAttribute('data-field');
                if (!next[tabId]) next[tabId] = {};
                next[tabId][field] = input.value.trim();
            });
            writeConfig(next);
            Object.keys(loaded).forEach(function (k) { delete loaded[k]; });
            showTab(activeId);
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

        showTab(activeId);
    }

    window.EprofTabbedIframes = { render: render, TABS: TABS };
})();
