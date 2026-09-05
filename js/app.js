document.addEventListener('DOMContentLoaded', () => {
    const mainContent = document.getElementById('main-content');

    function getAppVersionInfo() {
        return { version: 'V2.5.19' };
    }

    function readAppParametres() {
        try { return JSON.parse(localStorage.getItem('parametres') || '{}'); } catch (e) { return {}; }
    }

    function getAnneeScolaire() {
        return readAppParametres().anneeScolaire || '2026-2027';
    }

    function getAlertesSeuils() {
        const a = readAppParametres().alertes || {};
        const oublis = parseInt(a.seuilOublis, 10);
        const mots = parseInt(a.seuilMots, 10);
        return {
            seuilOublis: oublis > 0 ? oublis : 3,
            seuilMots: mots > 0 ? mots : 5
        };
    }

    function getCalendarDisplayPrefs() {
        const c = readAppParametres().calendrier || {};
        function toSlot(t, fallback) {
            const v = String(t || fallback);
            return v.length === 5 ? v + ':00' : v;
        }
        return {
            slotMinTime: toSlot(c.heureDebut, '08:00'),
            slotMaxTime: toSlot(c.heureFin, '20:00'),
            hiddenDays: c.afficherSamedi ? [0] : [0, 6]
        };
    }

    function formatYmd(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return y + '-' + m + '-' + d;
    }

    function easterSunday(year) {
        const a = year % 19;
        const b = Math.floor(year / 100);
        const c = year % 100;
        const d = Math.floor(b / 4);
        const e = b % 4;
        const f = Math.floor((b + 8) / 25);
        const g = Math.floor((b - f + 1) / 3);
        const h = (19 * a + b - d - g + 15) % 30;
        const i = Math.floor(c / 4);
        const k = c % 4;
        const l = (32 + 2 * e + 2 * i - h - k) % 7;
        const m = Math.floor((a + 11 * h + 22 * l) / 451);
        const month = Math.floor((h + l - 7 * m + 114) / 31);
        const day = ((h + l - 7 * m + 114) % 31) + 1;
        return new Date(year, month - 1, day);
    }

    function addDays(date, n) {
        const d = new Date(date.getTime());
        d.setDate(d.getDate() + n);
        return d;
    }

    function feriesPourAnneeCivile(year) {
        const paques = easterSunday(year);
        return [
            { title: '🎉 Jour de l\'An', start: year + '-01-01' },
            { title: '🌱 Lundi de Pâques', start: formatYmd(addDays(paques, 1)) },
            { title: '🏭 Fête du Travail', start: year + '-05-01' },
            { title: '🎖️ Victoire 1945', start: year + '-05-08' },
            { title: '☁️ Ascension', start: formatYmd(addDays(paques, 39)) },
            { title: '🌼 Lundi de Pentecôte', start: formatYmd(addDays(paques, 50)) },
            { title: '🇫🇷 Fête Nationale', start: year + '-07-14' },
            { title: '☀️ Assomption', start: year + '-08-15' },
            { title: '🍂 Toussaint', start: year + '-11-01' },
            { title: '🪖 Armistice', start: year + '-11-11' },
            { title: '🎄 Noël', start: year + '-12-25' }
        ].map(function (ev) { return Object.assign({ allDay: true }, ev); });
    }

    function getCalendrierScolaireEvents(annee) {
        const parts = String(annee || '2026-2027').split('-');
        const y1 = parseInt(parts[0], 10) || 2026;
        const y2 = parseInt(parts[1], 10) || (y1 + 1);
        const debut = new Date(y1, 8, 1);
        const fin = new Date(y2, 7, 31);
        const feries = feriesPourAnneeCivile(y1).concat(feriesPourAnneeCivile(y2)).filter(function (ev) {
            const d = new Date(ev.start);
            return d >= debut && d <= fin;
        });
        const fond = function (title, start, end, color) {
            return { title: title, start: start, end: end, display: 'background', backgroundColor: color, allDay: true };
        };
        const vacancesParAnnee = {
            '2025-2026': [
                fond('🏖️ Vacances de la Toussaint', '2025-10-18', '2025-11-03', '#fef3c7'),
                fond('🎄 Vacances de Noël', '2025-12-20', '2026-01-05', '#dbeafe'),
                fond('⛷️ Vacances d\'hiver', '2026-02-07', '2026-02-23', '#e0e7ff'),
                fond('🌸 Vacances de printemps', '2026-04-04', '2026-04-20', '#fce7f3'),
                fond('☀️ Vacances d\'été', '2026-07-04', '2026-09-01', '#fef08a')
            ],
            '2026-2027': [
                fond('🏖️ Vacances de la Toussaint', '2026-10-17', '2026-11-02', '#fef3c7'),
                fond('🎄 Vacances de Noël', '2026-12-19', '2027-01-04', '#dbeafe'),
                fond('⛷️ Vacances d\'hiver', '2027-02-13', '2027-03-01', '#e0e7ff'),
                fond('🌸 Vacances de printemps', '2027-04-10', '2027-04-26', '#fce7f3'),
                fond('☀️ Vacances d\'été', '2027-07-03', '2027-09-01', '#fef08a')
            ],
            '2027-2028': [
                fond('🏖️ Vacances de la Toussaint', '2027-10-23', '2027-11-03', '#fef3c7'),
                fond('🎄 Vacances de Noël', '2027-12-18', '2028-01-03', '#dbeafe'),
                fond('⛷️ Vacances d\'hiver', '2028-02-19', '2028-03-06', '#e0e7ff'),
                fond('🌸 Vacances de printemps', '2028-04-15', '2028-05-02', '#fce7f3'),
                fond('☀️ Vacances d\'été', '2028-07-08', '2028-09-04', '#fef08a')
            ]
        };
        return feries.concat(vacancesParAnnee[annee] || vacancesParAnnee['2026-2027']);
    }

    function defaultAppParametres(enseignant) {
        return {
            enseignant: enseignant || { nom: '', prenom: '', matiere: '', email: '' },
            anneeScolaire: '2026-2027',
            calendrier: {
                heureDebut: '08:00',
                heureFin: '20:00',
                afficherSamedi: false,
                ligneDebut: '08:00',
                ligneFin: '17:10',
                pauseMatinDebut: '09:50',
                pauseMatinFin: '10:05',
                pauseMidiDebut: '11:55',
                pauseMidiFin: '13:15',
                pauseApresDebut: '15:05',
                pauseApresFin: '15:20'
            },
            affichage: { theme: 'clair', couleurTheme: 'defaut', couleurAccent: '', densite: 'normal', taillePolice: 'moyen', modeMobile: 'auto', ambiance: 'none', fondIntensite: 'moyen', chromeStyle: 'uni' },
            alertes: { seuilOublis: 3, seuilMots: 5 },
            notation: {
                systeme: 'sur20',
                mentions: [
                    { emoji: '🏆', label: 'Très bien', seuilMin: 16 },
                    { emoji: '😊', label: 'Bien', seuilMin: 14 },
                    { emoji: '🙂', label: 'Assez bien', seuilMin: 12 },
                    { emoji: '😐', label: 'Passable', seuilMin: 10 },
                    { emoji: '📚', label: 'À retravailler', seuilMin: 0 }
                ]
            }
        };
    }

    function isProtectedLocalStorageKey(key) {
        return /auth|supabase|^sb-/i.test(String(key || ''));
    }

    function getVisibleTeacherClasses() {
        if (window.getTeacherClassNames) return window.getTeacherClassNames().slice().sort();
        if (window.teacherManager && window.teacherManager.getTeacherClasses) {
            return (window.teacherManager.getTeacherClasses() || []).slice().sort();
        }
        return [];
    }

    function getListsForTeacher() {
        if (window.getTeacherStudentLists) return window.getTeacherStudentLists();
        const listes = window.getAvailableStudentLists ? window.getAvailableStudentLists() : {};
        const out = {};
        getVisibleTeacherClasses().forEach(function (nom) { out[nom] = listes[nom] || []; });
        return out;
    }


    function updateFooterVersion() {
        const footerVersion = document.getElementById('footer-version');
        if (!footerVersion) return;
        const info = getAppVersionInfo();
        footerVersion.textContent = `Version ${info.version}`;
    }

    // Badge "en ligne / hors ligne" dans le header, reflète l'état réel Supabase
    async function updateOnlineStatusBadge() {
        const badge = document.getElementById('online-status-badge');
        if (!badge || !window.EprofStore) return;
        const online = await window.EprofStore.isOnlineReady();
        badge.textContent = online ? '🟢 En ligne' : '⚪ Hors ligne';
        badge.classList.toggle('online-status-online', online);
        badge.classList.toggle('online-status-offline', !online);
    }

    (function applyStoredDisplayOnBoot() {
        try {
            const parametresBoot = JSON.parse(localStorage.getItem('parametres') || '{}');
            const affichage = parametresBoot.affichage || {};
            document.body.classList.toggle('theme-sombre', affichage.theme === 'sombre');
            if (window.EprofTheme) {
                window.EprofTheme.apply(affichage.couleurTheme || 'defaut', affichage.couleurAccent || '', affichage.theme === 'sombre');
            }
            // Apply density
            if (affichage.densite === 'compact') document.body.classList.add('densite-compact');
            else if (affichage.densite === 'confortable') document.body.classList.add('densite-confortable');
            document.body.classList.remove('mode-mobile-force', 'mode-mobile-off');
            if (affichage.modeMobile === 'active') document.body.classList.add('mode-mobile-force');
            else if (affichage.modeMobile === 'inactive') document.body.classList.add('mode-mobile-off');
        } catch (e) {}
    })();
    (function syncStickyHeaderOffset() {
        function apply() {
            const header = document.querySelector('header');
            if (!header) return;
            document.documentElement.style.setProperty('--eprof-header-h', header.offsetHeight + 'px');
        }
        apply();
        window.addEventListener('resize', apply);
    })();
    updateOnlineStatusBadge();
    if (window.eprofAuth) {
        window.eprofAuth.onAuthStateChange(() => updateOnlineStatusBadge());
    }

    const aboutTrigger = document.getElementById('about-modal-trigger');
    const aboutModal = document.getElementById('about-modal');
    const closeAboutModal = document.getElementById('close-about-modal');
    if (aboutTrigger && aboutModal) {
        aboutTrigger.addEventListener('click', () => {
            aboutModal.style.display = 'flex';
        });
    }
    if (closeAboutModal && aboutModal) {
        closeAboutModal.addEventListener('click', () => {
            aboutModal.style.display = 'none';
        });
    }
    if (aboutModal) {
        aboutModal.addEventListener('click', (event) => {
            if (event.target === aboutModal) {
                aboutModal.style.display = 'none';
            }
        });
    }

    const docsTrigger = document.getElementById('docs-trigger');
    if (docsTrigger) {
        docsTrigger.addEventListener('click', function () {
            handleDashboardTool('documentation');
        });
    }
    
    // Navigation principale
    // Gestion centralisée de tous les clics sidebar
    document.querySelectorAll('.sidebar a').forEach(function(link) {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            if (link.id === 'dashboard-link') {
                showDashboard();
                highlightSidebar('dashboard-link');
            } else if (link.id === 'calendar-link') {
                handleDashboardTool('calendar');
            } else if (link.hasAttribute('data-tool')) {
                handleDashboardTool(link.getAttribute('data-tool'));
                highlightSidebar(link.getAttribute('data-tool'));
            }
        });
    });
    
    // Mise à jour des notifications au chargement
    setTimeout(() => {
        try {
            updateNotifications();
        } catch (e) {
            console.error('Erreur updateNotifications:', e);
        }
    }, 100);
    
    (function initSidebarCollapse() {
        const btn = document.getElementById('sidebar-toggle');
        if (!btn) return;
        const key = 'eprofSidebarCollapsed';
        function apply(collapsed) {
            document.body.classList.toggle('sidebar-collapsed', collapsed);
            btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
            btn.title = collapsed ? 'Agrandir le menu' : 'Réduire le menu';
            btn.setAttribute('aria-label', btn.title);
            btn.textContent = collapsed ? '▶' : '◀';
            try { localStorage.setItem(key, collapsed ? '1' : '0'); } catch (e) { /* ignore */ }
        }
        try { apply(localStorage.getItem(key) === '1'); } catch (e) { apply(false); }
        btn.addEventListener('click', function () {
            apply(!document.body.classList.contains('sidebar-collapsed'));
        });
    })();

    updateFooterVersion();

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function () {
            if (window.teacherManager) window.teacherManager.logout();
        });
    }

    // ===== Restriction des outils réservés à l'administrateur =====
    let estAdministrateur = false;

    function appliquerVisibiliteAdmin() {
        document.querySelectorAll('[data-tool="archives"]').forEach(function (el) {
            const cible = el.tagName === 'A' ? (el.closest('li') || el) : el;
            cible.style.display = estAdministrateur ? '' : 'none';
        });
    }

    async function rafraichirRoleAdmin() {
        if (window.EprofAdmin) {
            try {
                estAdministrateur = await window.EprofAdmin.isCurrentUserAdmin();
            } catch (e) {
                estAdministrateur = false;
            }
        }
        appliquerVisibiliteAdmin();
    }

    rafraichirRoleAdmin();
    if (window.eprofAuth) window.eprofAuth.onAuthStateChange(rafraichirRoleAdmin);

    // Les cartes d'outils sont recréées à chaque rendu : on réapplique la restriction.
    new MutationObserver(appliquerVisibiliteAdmin).observe(mainContent, { childList: true, subtree: true });

    const LAST_TOOLS_KEY = 'eprofLastTools';
    let outilCourant = null;
    let outilExtra = null;
    const TOOL_SHORT_LABELS = {
        calendar: '📅 Calendrier',
        agenda: '🗓️ Agenda',
        notes: '📒 Carnet',
        eleves: '👨‍🎓 Suivi',
        'plan-classe': '🪑 Plan de classe',
        trombinoscopes: '📸 Trombinoscopes',
        messagerie: '💬 Messagerie',
        jeu: '🎮 Jeux',
        'tableau-blanc': '📋 Tableau blanc',
        ressources: '📚 Ressources',
        converter: '🔄 Conversion',
        parametres: '⚙️ Paramètres',
        archives: '📦 Archives'
    };

    function readLastTools() {
        try {
            const list = JSON.parse(localStorage.getItem(LAST_TOOLS_KEY) || '[]');
            return Array.isArray(list) ? list.filter(function (t) { return TOOL_SHORT_LABELS[t]; }).slice(0, 4) : [];
        } catch (e) { return []; }
    }

    function rememberTool(tool) {
        if (!tool || !TOOL_SHORT_LABELS[tool]) return;
        const next = [tool].concat(readLastTools().filter(function (t) { return t !== tool; })).slice(0, 4);
        try { localStorage.setItem(LAST_TOOLS_KEY, JSON.stringify(next)); } catch (e) { /* ignore */ }
    }

    let appShellReady = false;
    function startAppShell() {
        if (appShellReady) return;
        appShellReady = true;
        showDashboard();
        highlightSidebar('dashboard-link');
    }
    function resetAppShell() {
        appShellReady = false;
        outilCourant = null;
        outilExtra = null;
        if (mainContent) mainContent.innerHTML = '';
    }
    document.addEventListener('eprof-session-ready', startAppShell);
    document.addEventListener('eprof-session-lost', resetAppShell);
    window.addEventListener('teacherLoggedIn', function () {
        if (appShellReady && document.getElementById('home-upcoming')) showDashboard();
    });
    if (!document.body.classList.contains('eprof-locked')) startAppShell();

    function showDashboard() {
        outilCourant = null;
        outilExtra = null;
        const classes = getVisibleTeacherClasses();
        const lastTools = readLastTools();
        const listes = getListsForTeacher();
        const classCards = classes.length
            ? '<div class="home-class-cards">' + classes.map(function (nom) {
                const color = window.getClassColor ? window.getClassColor(nom) : 'var(--eprof-accent, #2563eb)';
                const n = (listes[nom] || []).length;
                return '<button type="button" class="home-class-card" data-classe="' + escapeDashboardHtml(nom) + '" style="background:' + color + '"><span class="home-class-card-name">' + escapeDashboardHtml(nom) + '</span><span class="home-class-card-count">' + n + ' élève' + (n > 1 ? 's' : '') + '</span></button>';
            }).join('') + '</div>'
            : '<p class="home-brief-empty">Aucune classe. Ouvrez <button type="button" class="home-brief-link" data-tool="parametres">Paramètres</button> pour les choisir.</p>';
        const recentHtml = lastTools.length
            ? '<div class="home-recent">' + lastTools.map(function (tool) {
                return '<button type="button" class="home-recent-btn" data-tool="' + tool + '">' + TOOL_SHORT_LABELS[tool] + '</button>';
            }).join('') + '</div>'
            : '<p class="home-brief-empty">Les outils récemment ouverts apparaîtront ici.</p>';

        mainContent.innerHTML = `
            <div class="home-brief">
                <section class="home-brief-card" id="home-upcoming">
                    <h3 class="home-brief-title">🗓️ À venir</h3>
                    <p class="home-brief-empty">Chargement…</p>
                </section>
                <section class="home-brief-card">
                    <h3 class="home-brief-title">👥 Classes</h3>
                    ${classCards}
                </section>
                <section class="home-brief-card home-brief-recent">
                    <h3 class="home-brief-title">🕒 Récents</h3>
                    ${recentHtml}
                </section>
            </div>

            <div class="quick-access-section">
                <h3 class="section-title">⚡ Accès rapides</h3>
                <div class="quick-access-grid">
                    <button class="quick-card" data-tool="calendar">
                        <div class="quick-icon">📅</div>
                        <div class="quick-title">Calendrier</div>
                        <div class="quick-desc">Dates et rendez-vous</div>
                    </button>
                    <button class="quick-card" data-tool="notes">
                        <div class="quick-icon">📒</div>
                        <div class="quick-title">Carnet de notes</div>
                        <div class="quick-desc">Notes et moyennes</div>
                    </button>
                    <button class="quick-card" data-tool="eleves">
                        <div class="quick-icon">👨‍🎓</div>
                        <div class="quick-title">Suivi élèves</div>
                        <div class="quick-desc">Oublis, mots et notes</div>
                    </button>
                    <button class="quick-card" data-tool="agenda">
                        <div class="quick-icon">🗓️</div>
                        <div class="quick-title">Agenda</div>
                        <div class="quick-desc">Tâches et rappels</div>
                    </button>
                </div>
            </div>
            
            <div class="tools-section">
                <h3 class="section-title">👥 Gestion de classe</h3>
                <div class="tools-grid">
                    <button class="tool-card" data-tool="plan-classe">
                        <span class="tool-icon">🪑</span>
                        <div class="tool-content">
                            <div class="tool-title">Plan de classe</div>
                            <div class="tool-description">Créez et gérez vos plans de classe interactifs</div>
                        </div>
                    </button>
                    <button class="tool-card" data-tool="trombinoscopes">
                        <span class="tool-icon">📸</span>
                        <div class="tool-content">
                            <div class="tool-title">Trombinoscopes</div>
                            <div class="tool-description">Année ${getAnneeScolaire()} et archives</div>
                        </div>
                    </button>
                    <button class="tool-card" data-tool="archives">
                        <span class="tool-icon">📦</span>
                        <div class="tool-content">
                            <div class="tool-title">Archives</div>
                            <div class="tool-description">Données historiques et anciennes listes</div>
                        </div>
                    </button>
                </div>
            </div>
            
            <div class="tools-section">
                <h3 class="section-title">🎓 Outils pédagogiques</h3>
                <div class="tools-grid">
                    <button class="tool-card" data-tool="jeu">
                        <span class="tool-icon">🎮</span>
                        <div class="tool-content">
                            <div class="tool-title">Jeux pédagogiques</div>
                            <div class="tool-description">Mots croisés, pendu et autres activités</div>
                        </div>
                    </button>
                    <button class="tool-card" data-tool="tableau-blanc">
                        <span class="tool-icon">📋</span>
                        <div class="tool-content">
                            <div class="tool-title">Tableau blanc</div>
                            <div class="tool-description">Dessin, tirage, chrono et outils de séance</div>
                        </div>
                    </button>
                    <button class="tool-card" data-tool="ressources">
                        <span class="tool-icon">📚</span>
                        <div class="tool-content">
                            <div class="tool-title">Ressources pédagogiques</div>
                            <div class="tool-description">Liens, dossiers personnels et ressources officielles</div>
                        </div>
                    </button>
                </div>
            </div>
            
            <div class="tools-section">
                <h3 class="section-title">🔧 Utilitaires</h3>
                <div class="tools-grid">
                    <button class="tool-card" data-tool="messagerie">
                        <span class="tool-icon">💬</span>
                        <div class="tool-content">
                            <div class="tool-title">Messagerie</div>
                            <div class="tool-description">Discussions internes avec vos collègues</div>
                        </div>
                    </button>
                    <button class="tool-card" data-tool="converter">
                        <span class="tool-icon">🔄</span>
                        <div class="tool-content">
                            <div class="tool-title">Conversion de fichiers</div>
                            <div class="tool-description">Convertissez vos documents (Word, Excel, PDF...)</div>
                        </div>
                    </button>
                    <button class="tool-card" data-tool="parametres">
                        <span class="tool-icon">⚙️</span>
                        <div class="tool-content">
                            <div class="tool-title">Paramètres</div>
                            <div class="tool-description">Configurez votre espace de travail</div>
                        </div>
                    </button>
                </div>
            </div>
        `;
        fillHomeUpcoming();
        mainContent.querySelectorAll('.quick-card, .tool-card, .home-recent-btn, .home-brief-link').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var tool = btn.getAttribute('data-tool');
                handleDashboardTool(tool);
                highlightSidebar(tool === 'calendar' ? 'calendar-link' : tool);
            });
        });
        mainContent.querySelectorAll('.home-class-card').forEach(function (btn) {
            btn.addEventListener('click', function () {
                handleDashboardTool('eleves', { classe: btn.getAttribute('data-classe') });
                highlightSidebar('eleves');
            });
        });
    }

    function escapeDashboardHtml(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    let homeUpcomingDayOffset = 0;
    const HOME_UPCOMING_MAX_DAYS = 60;

    function localDayKey(d) {
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function renderUpcomingList() {
        const box = document.getElementById('home-upcoming');
        if (!box) return;
        const utils = window.EprofCalendarUtils;
        const day = new Date();
        day.setHours(0, 0, 0, 0);
        day.setDate(day.getDate() + homeUpcomingDayOffset);
        const ymd = utils && utils.toYmdLocal ? utils.toYmdLocal(day) : localDayKey(day);
        const nextYmd = utils && utils.addDaysYmd ? utils.addDaysYmd(ymd, 1) : localDayKey(new Date(day.getTime() + 86400000));
        const label = day.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
        const isToday = homeUpcomingDayOffset === 0;
        const weekNum = utils && utils.isoWeekNumberFromYmd ? utils.isoWeekNumberFromYmd(ymd) : '';
        const weekAb = utils && utils.weekAbFromYmd ? utils.weekAbFromYmd(ymd) : '';
        const prevDisabled = homeUpcomingDayOffset <= 0 ? ' disabled' : '';
        const nextDisabled = homeUpcomingDayOffset >= HOME_UPCOMING_MAX_DAYS ? ' disabled' : '';
        const cache = utils && utils.readLocalCache ? utils.readLocalCache() : [];
        const entries = utils && utils.listInstancesInRange
            ? utils.listInstancesInRange(cache, ymd, nextYmd)
            : [];
        let listHtml;
        if (entries.length && utils.instanceButtonHtml) {
            listHtml = '<div class="agenda-today-list home-upcoming-slots">' + entries.map(function (e) {
                return utils.instanceButtonHtml(e, 'slot');
            }).join('') + '</div>';
        } else {
            listHtml = '<p class="home-brief-empty">' + (isToday ? 'Rien de prévu aujourd’hui.' : 'Rien de prévu ce jour.') + ' <button type="button" class="home-brief-link" data-tool="calendar">Calendrier</button> · <button type="button" class="home-brief-link" data-tool="agenda">Agenda</button></p>';
        }
        const kicker = isToday ? 'Aujourd’hui' : 'À venir';
        const pill = weekNum ? '<span class="agenda-week-pill agenda-week-' + String(weekAb).toLowerCase() + '">S' + weekNum + ' · ' + weekAb + '</span>' : '';
        box.innerHTML = '<div class="home-upcoming-head">' +
            '<div><p class="agenda-kicker">' + kicker + '</p><h3 class="home-brief-title">🗓️ ' + escapeDashboardHtml(label) + '</h3></div>' +
            pill +
            '<div class="home-upcoming-nav"><button type="button" class="home-upcoming-arrow" data-dir="-1"' + prevDisabled + ' aria-label="Jour précédent">◀</button><span class="home-upcoming-day">' + (isToday ? 'aujourd’hui' : '+' + homeUpcomingDayOffset + ' j') + '</span><button type="button" class="home-upcoming-arrow" data-dir="1"' + nextDisabled + ' aria-label="Jour suivant">▶</button></div>' +
            '</div>' + listHtml;
        box.querySelectorAll('.home-upcoming-arrow').forEach(function (btn) {
            btn.addEventListener('click', function () {
                const dir = Number(btn.getAttribute('data-dir'));
                homeUpcomingDayOffset = Math.max(0, Math.min(HOME_UPCOMING_MAX_DAYS, homeUpcomingDayOffset + dir));
                renderUpcomingList();
            });
        });
        box.querySelectorAll('[data-tool]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                const tool = btn.getAttribute('data-tool');
                const date = btn.getAttribute('data-date');
                handleDashboardTool(tool, tool === 'calendar' && date ? { gotoDate: date } : undefined);
                highlightSidebar(tool === 'calendar' ? 'calendar-link' : tool);
            });
        });
    }

    async function fillHomeUpcoming() {
        homeUpcomingDayOffset = 0;
        renderUpcomingList();
        const utils = window.EprofCalendarUtils;
        if (utils && utils.loadAllEvents) {
            try {
                await utils.loadAllEvents();
                renderUpcomingList();
            } catch (e) { /* cache déjà affiché */ }
        }
    }

    // Surlignage de l'item sélectionné dans la sidebar
    function highlightSidebar(idOrTool) {
        // Retire la classe active de tous les liens
        document.querySelectorAll('.sidebar a').forEach(function(link) {
            link.classList.remove('active-sidebar');
        });
        // Ajoute la classe à l'élément sélectionné
        if (typeof idOrTool === 'string') {
            // Par id (dashboard-link, calendar-link)
            var el = document.getElementById(idOrTool);
            if (el) {
                el.classList.add('active-sidebar');
            } else {
                // Par data-tool (pour tous les autres outils)
                document.querySelectorAll('.sidebar a[data-tool="' + idOrTool + '"]').forEach(function(link) {
                    link.classList.add('active-sidebar');
                });
            }
        } else if (idOrTool instanceof Element) {
            idOrTool.classList.add('active-sidebar');
        }
    }

    // Gestion des outils du dashboard et sidebar

    // Les listes d'élèves arrivent de façon asynchrone : on re-rend l'outil affiché
    // en conservant la classe / le plan déjà ouverts (accueil, calendrier, recherche).
    document.addEventListener('eprof-referentiel-maj', function () {
        if (!outilCourant) {
            if (document.getElementById('home-upcoming')) showDashboard();
            return;
        }
        if (['eleves', 'trombinoscopes', 'plan-classe'].includes(outilCourant)) {
            handleDashboardTool(outilCourant, outilExtra);
        }
    });

    function handleDashboardTool(tool, extra) {
        outilCourant = tool;
        outilExtra = extra || null;
        rememberTool(tool);
        switch(tool) {
            case 'calendar':
                renderCalendar(mainContent, extra);
                highlightSidebar('calendar-link');
                break;
            case 'converter':
                renderFileConverter(mainContent);
                highlightSidebar('converter');
                break;
            case 'plan-classe':
                if (window.EprofPlanClasse) window.EprofPlanClasse.render(mainContent, extra);
                else mainContent.innerHTML = '<h2>Plan de classe indisponible</h2>';
                highlightSidebar('plan-classe');
                break;
            case 'tableau-blanc':
                window.open('tableau-blanc.html', '_blank');
                highlightSidebar('tableau-blanc');
                break;
            case 'jeu':
                renderJeuxPedagogiques(mainContent);
                highlightSidebar('jeu');
                break;
            case 'trombinoscopes':
                if (window.EprofTrombinoscopes) window.EprofTrombinoscopes.render(mainContent);
                else mainContent.innerHTML = '<h2>Trombinoscopes indisponibles</h2>';
                highlightSidebar('trombinoscopes');
                break;
            case 'archives':
                if (!estAdministrateur) {
                    mainContent.innerHTML = '<h2>🔒 Accès restreint</h2><p>Les archives sont réservées à l’administrateur.</p>';
                    break;
                }
                renderArchives(mainContent);
                highlightSidebar('archives');
                break;
            case 'eleves':
                if (window.EprofSuiviEleves) window.EprofSuiviEleves.render(mainContent, extra);
                else mainContent.innerHTML = '<h2>Suivi des élèves indisponible</h2>';
                highlightSidebar('eleves');
                break;
            case 'notes':
                window.open('carnet-notes.html', '_blank');
                highlightSidebar('notes');
                break;
            case 'agenda':
                if (window.EprofAgenda) window.EprofAgenda.render(mainContent);
                else mainContent.innerHTML = '<h2>Agenda indisponible</h2><p>Le module agenda n’a pas pu être chargé.</p>';
                highlightSidebar('agenda');
                break;
            case 'ressources':
                if (window.EprofRessources) window.EprofRessources.render(mainContent);
                else mainContent.innerHTML = '<h2>Ressources pédagogiques</h2><p>Le module n’a pas pu être chargé.</p>';
                highlightSidebar('ressources');
                break;
            case 'messagerie':
                renderMessagerieModule(mainContent);
                highlightSidebar('messagerie');
                break;
            case 'parametres':
                renderParametres(mainContent);
                highlightSidebar('parametres');
                break;
            case 'documentation':
                if (window.EprofDocumentation) {
                    window.EprofDocumentation.render(mainContent, {
                        openTool: function (tool) {
                            handleDashboardTool(tool);
                            if (tool === 'calendar') highlightSidebar('calendar-link');
                            else highlightSidebar(tool);
                        }
                    });
                } else {
                    mainContent.innerHTML = '<h2>Documentation</h2><p>Le module n’a pas pu être chargé.</p>';
                }
                break;
            default:
                showDashboard();
                highlightSidebar('dashboard-link');
        }
    }

    window.EprofElevesOpenTool = handleDashboardTool;
    window.EprofAppHooks = window.EprofAppHooks || {};
    window.EprofAppHooks.setOutilExtra = function (extra) {
        outilExtra = extra || null;
    };

    (function bindGlobalStudentSearch() {
        var input = document.getElementById('eprof-search-eleve');
        var box = document.getElementById('eprof-search-results');
        if (!input || !box) return;
        var timer = null;

        function hide() {
            box.hidden = true;
            box.innerHTML = '';
        }

        function paint(query) {
            var E = window.EprofEleves;
            if (!E || !E.searchStudents) {
                hide();
                return;
            }
            var hits = E.searchStudents(query, 12);
            if (!hits.length) {
                box.hidden = false;
                box.innerHTML = '<p class="eprof-search-empty">Aucun élève ne correspond.</p>';
                return;
            }
            box.hidden = false;
            box.innerHTML = hits.map(function (h) {
                return '<button type="button" class="eprof-search-hit" data-classe="' + escapeDashboardHtml(h.classe) + '" data-eleve="' + escapeDashboardHtml(h.nomComplet) + '">' +
                    E.photoHtml(h.classe, h, { compact: true }) +
                    '<span class="eprof-search-hit-text"><strong>' + escapeDashboardHtml(h.nomComplet) + '</strong><small>' + escapeDashboardHtml(h.classe) + '</small></span>' +
                    '</button>';
            }).join('');
            box.querySelectorAll('.eprof-search-hit').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    hide();
                    input.value = '';
                    handleDashboardTool('eleves', {
                        classe: btn.getAttribute('data-classe'),
                        eleve: btn.getAttribute('data-eleve')
                    });
                    highlightSidebar('eleves');
                });
            });
        }

        input.addEventListener('input', function () {
            clearTimeout(timer);
            var q = input.value.trim();
            if (q.length < 2) {
                hide();
                return;
            }
            timer = setTimeout(function () { paint(q); }, 120);
        });
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                hide();
                input.blur();
            }
        });
        document.addEventListener('click', function (e) {
            if (!input.contains(e.target) && !box.contains(e.target)) hide();
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || '')) {
                e.preventDefault();
                input.focus();
            }
        });
    })();

    // Calendrier FullCalendar (données via EprofCalendarUtils, partagées avec l'agenda)
    function renderCalendar(container, extra) {
        var U = window.EprofCalendarUtils;
        extra = extra || {};
        if (!document.getElementById('fc-css')) {
            var link = document.createElement('link');
            link.rel = 'stylesheet';
            link.id = 'fc-css';
            link.href = 'https://cdn.jsdelivr.net/npm/fullcalendar@6.1.8/index.global.min.css';
            document.head.appendChild(link);
        }

        var classOptions = (U ? U.getTeacherClasses() : []).map(function (nom) {
            return '<option value="' + escapeDashboardHtml(nom) + '">' + escapeDashboardHtml(nom) + '</option>';
        }).join('');

        container.innerHTML = `<div id="calendar-module">
            <div class="calendar-toolbar">
                <div class="cal-toolbar-group">
                    <button type="button" id="cal-add-btn" class="btn-primary">➕ Nouvel événement</button>
                    <select id="cal-filter-class" class="cal-filter" title="Filtrer par classe">
                        <option value="">Toutes les classes</option>
                        ${classOptions}
                    </select>
                    <select id="cal-filter-type" class="cal-filter" title="Filtrer par nature">
                        <option value="">Toutes les natures</option>
                        <option value="cours">Cours</option>
                        <option value="event">Événements</option>
                        <option value="todo">Tâches</option>
                        <option value="rdv">Rendez-vous</option>
                    </select>
                    <span id="cal-week-badge" class="cal-week-badge" hidden></span>
                </div>
                <div class="cal-toolbar-group">
                    <button type="button" id="cal-edt-btn" class="btn-secondary">📅 Emploi du temps</button>
                    <div class="cal-menu">
                        <button type="button" class="btn-secondary cal-menu-btn">📄 Calendrier scolaire ▾</button>
                        <div class="cal-menu-drop">
                            <button type="button" id="cal-doc-zoneb">Calendrier scolaire (Zone B)</button>
                            <button type="button" id="cal-doc-stages">Dates de stage</button>
                            <button type="button" id="cal-doc-periodes">Périodes de l’année</button>
                        </div>
                    </div>
                </div>
            </div>
            <div id="calendar-view"></div>
        </div>`;

        function openImageModal(titre, source, alt) {
            var existing = document.getElementById('calendar-image-modal');
            if (existing) existing.remove();
            var modal = document.createElement('div');
            modal.id = 'calendar-image-modal';
            modal.className = 'calendar-image-modal';
            modal.innerHTML =
                '<div class="calendar-image-backdrop" data-close="true"></div>' +
                '<div class="calendar-image-dialog">' +
                    '<div class="calendar-image-header">' +
                        '<h3>' + titre + '</h3>' +
                        '<button type="button" class="calendar-image-close" aria-label="Fermer">×</button>' +
                    '</div>' +
                    '<img src="' + encodeURI(source) + '" alt="' + alt + '" />' +
                '</div>';
            document.body.appendChild(modal);
            modal.querySelector('.calendar-image-close').addEventListener('click', function () { modal.remove(); });
            modal.querySelector('.calendar-image-backdrop').addEventListener('click', function () { modal.remove(); });
        }

        container.querySelectorAll('.cal-menu-btn').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                var menu = btn.parentElement;
                var open = menu.classList.contains('open');
                container.querySelectorAll('.cal-menu').forEach(function (m) { m.classList.remove('open'); });
                if (!open) menu.classList.add('open');
            });
        });
        document.addEventListener('click', function closeMenus(e) {
            if (!container.querySelector('#calendar-module')) {
                document.removeEventListener('click', closeMenus);
                return;
            }
            if (!e.target.closest('.cal-menu')) {
                container.querySelectorAll('.cal-menu').forEach(function (m) { m.classList.remove('open'); });
            }
        });

        container.querySelector('#cal-doc-zoneb').addEventListener('click', function () {
            openImageModal('Calendrier scolaire - Zone B', 'images/calendrier scolaire.png', 'Calendrier scolaire Zone B');
        });
        container.querySelector('#cal-doc-stages').addEventListener('click', function () {
            openImageModal('Dates de stage', 'images/Dates de stage.png', 'Dates de stage');
        });
        container.querySelector('#cal-doc-periodes').addEventListener('click', function () {
            openImageModal('Périodes de l’année', 'images/Périodes 26-27.png', 'Périodes de l’année');
        });

        var calendar = null;

        function userItems() {
            return U ? U.readLocalCache() : [];
        }

        function applyFilters() {
            if (calendar) calendar.refetchEvents();
        }

        function addOrReplace() {
            if (calendar) calendar.refetchEvents();
        }

        async function persistMovedEvent(info) {
            if (!U || !U.isUserEvent(info.event)) {
                if (info.revert) info.revert();
                return;
            }
            try {
                var parsed = U.parseInstanceId(info.event.id);
                if (parsed.occurrenceDate) {
                    await U.detachOccurrence(parsed.seriesId, parsed.occurrenceDate, U.oneOffFromFcEvent(info.event));
                } else {
                    await U.persistEvent(U.fcEventToItem(info.event));
                }
                calendar.refetchEvents();
            } catch (err) {
                console.error(err);
                if (info.revert) info.revert();
            }
        }

        function decorateSlot(info) {
            var viewType = calendar && calendar.view ? calendar.view.type : '';
            if (viewType !== 'timeGridDay' && viewType !== 'timeGridWeek') return;
            if (info.el.dataset.calDecorated) return;
            info.el.dataset.calDecorated = '1';
            var prefs = U.getCalendarDisplayPrefs();
            var mins = info.date.getHours() * 60 + info.date.getMinutes();
            var slotEnd = mins + 30;
            var isLane = info.el.classList.contains('fc-timegrid-slot-lane');
            (prefs.pauses || []).forEach(function (p) {
                var a = U.parseHm(p.start);
                var b = U.parseHm(p.end);
                if (mins > a && mins < b) info.el.classList.add('cal-slot-pause-line');
            });
            if (!isLane) return;
            [prefs.ligneDebut, prefs.ligneFin].forEach(function (hm) {
                var t = U.parseHm(hm);
                if (t >= mins && t < slotEnd) {
                    var frac = (t - mins) / 30;
                    var line = document.createElement('div');
                    line.className = 'cal-slot-guide';
                    line.style.cssText = 'position:absolute;left:0;right:0;border-top:2px dashed #3b82f6;z-index:10;top:' + (frac * 100) + '%';
                    info.el.style.position = 'relative';
                    info.el.appendChild(line);
                }
            });
        }

        async function startFullCalendar() {
            var calendarEl = container.querySelector('#calendar-view');
            if (U) await U.loadAllEvents();
            var anneeCal = U ? U.getAnneeScolaire() : getAnneeScolaire();
            var calPrefs = U ? U.getCalendarDisplayPrefs() : getCalendarDisplayPrefs();

            function fcRangeYmd(date, str) {
                if (str && /^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
                return U.toYmdLocal(date);
            }

            function pauseBackgroundEvents() {
                var prefs = U.getCalendarDisplayPrefs();
                var out = [];
                (prefs.pauses || []).forEach(function (p, i) {
                    var start = String(p.start || '');
                    var end = String(p.end || '');
                    if (start.length === 5) start += ':00';
                    if (end.length === 5) end += ':00';
                    if (!start || !end || U.parseHm(p.start) >= U.parseHm(p.end)) return;
                    out.push({
                        id: 'cal-pause-' + i,
                        startTime: start,
                        endTime: end,
                        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
                        display: 'background',
                        classNames: ['cal-pause-bg'],
                        editable: false,
                        overlap: true
                    });
                });
                return out;
            }

            function eventsForRange(info) {
                if (!U) return [];
                var from = fcRangeYmd(info.start, info.startStr);
                var to = fcRangeYmd(info.end, info.endStr);
                var out = [];
                (U.readLocalCache() || []).forEach(function (it) {
                    try {
                        var slice = U.toFcEvents(it, from, to);
                        for (var i = 0; i < slice.length; i++) out.push(slice[i]);
                    } catch (err) {
                        console.warn(err);
                    }
                });
                return out.concat(U.getSchoolCalendarEvents(anneeCal), pauseBackgroundEvents());
            }

            function updateWeekBadge(info) {
                var badge = container.querySelector('#cal-week-badge');
                if (!badge || !U) return;
                var ymd = fcRangeYmd(info.start, info.startStr);
                var n = U.isoWeekNumberFromYmd(ymd);
                var ab = U.weekAbFromYmd(ymd);
                badge.hidden = false;
                badge.className = 'cal-week-badge cal-week-' + String(ab).toLowerCase();
                badge.title = 'Semaine ISO ' + n + ' · ' + (ab === 'A' ? 'paire' : 'impaire');
                badge.innerHTML = '<strong>S' + n + '</strong> <span>' + ab + '</span>';
            }

            calendar = new window.FullCalendar.Calendar(calendarEl, {
                initialView: 'timeGridWeek',
                locale: 'fr',
                firstDay: 1,
                hiddenDays: calPrefs.hiddenDays,
                slotMinTime: calPrefs.slotMinTime,
                slotMaxTime: calPrefs.slotMaxTime,
                nowIndicator: true,
                navLinks: true,
                weekNumbers: true,
                weekNumberCalculation: 'ISO',
                weekText: 'S',
                weekNumberContent: function (arg) {
                    var n = arg.num;
                    if (n == null && arg.text) n = parseInt(String(arg.text).replace(/\D/g, ''), 10);
                    if (!n) return { html: '' };
                    var ab = (n % 2 === 0) ? 'A' : 'B';
                    return {
                        html: '<span class="cal-wn">' + n + '</span><span class="cal-wn-ab cal-week-' + ab.toLowerCase() + '">' + ab + '</span>'
                    };
                },
                datesSet: updateWeekBadge,
                timeZone: 'local',
                editable: true,
                eventStartEditable: true,
                eventDurationEditable: true,
                selectable: true,
                selectMirror: true,
                longPressDelay: 400,
                scrollTime: new Date().toTimeString().slice(0, 8),
                dayHeaderFormat: { weekday: 'short', day: 'numeric', month: 'numeric' },
                eventTimeFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
                headerToolbar: {
                    left: 'prev,next today',
                    center: 'title',
                    right: 'timeGridDay,timeGridWeek,dayGridMonth,multiMonthYear'
                },
                buttonText: {
                    today: 'Aujourd\'hui',
                    month: 'Mois',
                    week: 'Semaine',
                    day: 'Jour',
                    multiMonth: 'Année'
                },
                views: {
                    timeGridDay: { buttonText: 'Jour' },
                    timeGridWeek: { buttonText: 'Semaine' },
                    dayGridMonth: { buttonText: 'Mois' },
                    multiMonthYear: { buttonText: 'Année' }
                },
                select: function (info) {
                    var allDay = info.allDay;
                    var start;
                    var end;
                    if (allDay) {
                        start = U.toYmdLocal(info.start);
                        end = info.end ? U.addDaysYmd(U.toYmdLocal(info.end), -1) : start;
                        if (end < start) end = start;
                    } else {
                        start = U.toLocalDateTimeInput(info.start);
                        end = info.end ? U.toLocalDateTimeInput(info.end) : '';
                    }
                    U.openEventForm({
                        allDay: allDay,
                        start: start,
                        end: end,
                        source: 'calendar',
                        defaultType: 'event',
                        onSaved: addOrReplace
                    });
                    calendar.unselect();
                },
                eventClick: function (info) {
                    if (!U.isUserEvent(info.event)) return;
                    info.jsEvent.preventDefault();
                    U.openDetailModal(U.fcEventToItem(info.event), {
                        onSaved: addOrReplace,
                        onDeleted: addOrReplace
                    });
                },
                eventAllow: function (dropInfo, dragged) {
                    return !dragged || U.isUserEvent(dragged);
                },
                events: function (info, successCallback) {
                    try {
                        successCallback(eventsForRange(info));
                    } catch (err) {
                        console.error(err);
                        successCallback([]);
                    }
                },
                eventClassNames: function (arg) {
                    if (!U || !U.isUserEvent(arg.event)) return [];
                    var clsEl = container.querySelector('#cal-filter-class');
                    var typeEl = container.querySelector('#cal-filter-type');
                    var cls = clsEl ? clsEl.value : '';
                    var type = typeEl ? typeEl.value : '';
                    var xp = arg.event.extendedProps || {};
                    if ((cls && xp.className !== cls) || (type && xp.type !== type)) return ['fc-event-filtered'];
                    return [];
                },
                eventDrop: persistMovedEvent,
                eventResize: persistMovedEvent,
                slotDuration: '00:30:00',
                snapDuration: '00:05:00',
                slotLabelInterval: '00:30:00',
                height: 'auto',
                expandRows: true,
                slotLaneDidMount: decorateSlot,
                slotLabelDidMount: decorateSlot
            });

            calendar.render();
            if (extra.gotoDate) calendar.gotoDate(extra.gotoDate);
        }

        container.querySelector('#cal-add-btn').addEventListener('click', function () {
            if (!U) return;
            U.openEventForm({ source: 'calendar', defaultType: 'event', onSaved: addOrReplace });
        });
        container.querySelector('#cal-filter-class').addEventListener('change', applyFilters);
        container.querySelector('#cal-filter-type').addEventListener('change', applyFilters);

        container.querySelector('#cal-edt-btn').addEventListener('click', function () {
            if (window.EprofEdtProf) window.EprofEdtProf.ouvrir();
        });

        if (!window.FullCalendar) {
            var script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/fullcalendar@6.1.8/index.global.min.js';
            script.onload = startFullCalendar;
            document.body.appendChild(script);
        } else {
            startFullCalendar();
        }
    }

    function loadEventsFromStorage() {
        if (window.EprofCalendarUtils) return window.EprofCalendarUtils.readLocalCache();
        try {
            return JSON.parse(localStorage.getItem('eprof-events') || '[]');
        } catch (e) { return []; }
    }

    function renderFileConverter(container) {
        if (window.EprofConverter && typeof window.EprofConverter.render === 'function') {
            window.EprofConverter.render(container);
            return;
        }
        container.innerHTML = '<p class="plan-empty-msg">Module de conversion indisponible.</p>';
    }

    // ========================================
    // FONCTION MISE À JOUR NOTIFICATIONS
    // ========================================
    window.addEventListener('teacherLoggedIn', function () {
        if (window.EprofSuiviEleves && typeof window.EprofSuiviEleves.hydrate === 'function') {
            window.EprofSuiviEleves.hydrate({ updateNotifications: updateNotifications });
        }
    });

    function updateNotifications() {
        try {
            const suiviData = (window.EprofSuiviEleves && window.EprofSuiviEleves.lireSuiviLocal)
                ? window.EprofSuiviEleves.lireSuiviLocal()
                : {};
            let totalAlertes = 0;
            
            // Compter les alertes (mots à mettre non mis)
            Object.keys(suiviData).forEach(nomEleve => {
                const eleve = suiviData[nomEleve];
                if (eleve && eleve.motsAMettre) {
                    const motsAMettre = eleve.motsAMettre;
                    const nbMots = motsAMettre.filter(m => !m.mis).length;
                    totalAlertes += nbMots;
                }
            });
            
            // Mettre à jour le badge de notification
            const lienEleves = document.querySelector('a[data-tool="eleves"]');
            if (lienEleves) {
                // Supprimer l'ancien badge s'il existe
                const ancienBadge = lienEleves.querySelector('.notif-badge');
                if (ancienBadge) {
                    ancienBadge.remove();
                }
                
                // Ajouter le nouveau badge si nécessaire
                if (totalAlertes > 0) {
                    const badge = document.createElement('span');
                    badge.className = 'notif-badge';
                    badge.textContent = ` ${totalAlertes}`;
                    lienEleves.appendChild(badge);
                }
            }
        } catch (error) {
            console.error('Erreur dans updateNotifications:', error);
        }
    }

    window.EprofAppHooks = window.EprofAppHooks || {};
    window.EprofAppHooks.updateNotifications = updateNotifications;
    if (window.EprofSuiviEleves && typeof window.EprofSuiviEleves.hydrate === 'function') {
        window.EprofSuiviEleves.hydrate({ updateNotifications: updateNotifications });
    }

    // ========================================
    // MESSAGERIE
    // ========================================
    function renderMessagerieModule(container) {
        if (window.EprofMessagerie && typeof window.EprofMessagerie.render === 'function') {
            window.EprofMessagerie.render(container);
            return;
        }
        container.innerHTML = '<h2>Messagerie indisponible</h2><p>Le module n’a pas pu être chargé.</p>';
    }

    // ========================================
    function renderArchives(container) {
        const archiveLists = window.getArchiveStudentLists ? window.getArchiveStudentLists() : {};
        const archiveYears = [
            {
                year: '2025-2026',
                description: 'Données historiques de l’année scolaire précédente.',
                classes: Object.keys(archiveLists).map(classe => ({
                    name: classe,
                    students: (archiveLists[classe] || []).map((eleve) => ({
                        name: `${eleve.prenom || ''} ${eleve.nom || ''}`.trim(),
                        sexe: eleve.sexe || ''
                    }))
                }))
            },
            {
                year: '2024-2025',
                description: 'Archive historique plus ancienne, consultable uniquement en lecture.',
                classes: []
            }
        ];

        let selectedYear = archiveYears[0];

        function renderYearContent() {
            const yearContent = document.getElementById('archive-year-content');
            if (!yearContent) return;

            const classes = selectedYear.classes && selectedYear.classes.length ? selectedYear.classes : [];
            yearContent.innerHTML = `
                <div class="archive-year-title">${selectedYear.year}</div>
                <p class="archive-intro">${selectedYear.description}</p>
                <div class="archive-items">
                    ${classes.length ? classes.map(item => `
                        <button type="button" class="archive-item-card archive-class-btn" data-class="${item.name}">
                            <strong>${item.name}</strong>
                            <span>${item.students.length} élève(s)</span>
                        </button>
                    `).join('') : '<div class="archive-empty">Aucune donnée historique n’est disponible pour cette année.</div>'}
                </div>
                ${classes.length ? `
                    <div class="archive-details">
                        <h4>Élèves</h4>
                        <div class="archive-student-list">
                            ${classes[0].students.map(student => `
                                <div class="archive-student-item">${student.name} ${student.sexe ? `(${student.sexe})` : ''}</div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            `;

            const classButtons = yearContent.querySelectorAll('.archive-class-btn');
            classButtons.forEach(button => {
                button.addEventListener('click', () => {
                    const className = button.dataset.class;
                    const selectedClass = classes.find(item => item.name === className);
                    const details = yearContent.querySelector('.archive-details');
                    if (!details || !selectedClass) return;
                    details.innerHTML = `
                        <h4>${className}</h4>
                        <div class="archive-student-list">
                            ${selectedClass.students.map(student => `
                                <div class="archive-student-item">${student.name} ${student.sexe ? `(${student.sexe})` : ''}</div>
                            `).join('')}
                        </div>
                    `;
                });
            });
        }

        container.innerHTML = `
            <div class="archive-module">
                <h2>📦 Archives</h2>
                <div class="archive-layout">
                    <div class="archive-years">
                        ${archiveYears.map(year => `
                            <button class="archive-year-btn ${year.year === selectedYear.year ? 'active' : ''}" data-year="${year.year}">
                                ${year.year}
                            </button>
                        `).join('')}
                    </div>
                    <div class="archive-panel" id="archive-year-content"></div>
                </div>
            </div>
        `;

        renderYearContent();

        container.querySelectorAll('.archive-year-btn').forEach(button => {
            button.addEventListener('click', () => {
                selectedYear = archiveYears.find(item => item.year === button.dataset.year) || archiveYears[0];
                container.querySelectorAll('.archive-year-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.year === selectedYear.year));
                renderYearContent();
            });
        });
    }




    // ========================================
    // JEUX PÉDAGOGIQUES
    // ========================================
    function renderJeuxPedagogiques(container) {
        container.innerHTML = `
            <div id="jeux-module">
                <h2>🎮 Jeux pédagogiques</h2>
                
                <div class="jeux-controls">
                    <details class="plan-config-accordion">
                        <summary>➕ Ajouter un jeu</summary>
                        <div class="config-accordion-body">
                            <div class="ajout-jeu-form">
                                <input type="text" id="jeu-titre" placeholder="Titre du jeu">
                                <input type="url" id="jeu-url" placeholder="URL du jeu (https://...)">
                                <select id="jeu-famille">
                                    <option value="Général">📁 Général</option>
                                </select>
                                <button id="ajouter-jeu-btn" class="btn-primary">➕ Ajouter</button>
                            </div>
                            <div style="margin-top: 12px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                                <input type="text" id="jeu-nouvelle-famille" placeholder="Nouveau dossier (ex. Quiz, Géographie)">
                                <button type="button" id="creer-famille-jeu-btn" class="btn-secondary">📁 Créer un dossier</button>
                            </div>
                            <div style="margin-top: 15px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                                <button id="exporter-jeux-btn" class="btn-secondary" style="padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">💾 Sauvegarder la liste</button>
                                <button id="importer-jeux-btn" class="btn-secondary" style="padding: 10px 20px; background: #10b981; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">📂 Restaurer la liste</button>
                                <input type="file" id="import-jeux-file" accept=".js" style="display: none;">
                                <p style="margin: 0; color: #64748b; font-size: 0.85rem;">💡 Portable : sauvegardez vos jeux dans un fichier pour les retrouver sur n'importe quel appareil !</p>
                            </div>
                        </div>
                    </details>
                </div>

                <div class="jeux-recherche">
                    <input type="text" id="recherche-jeu" placeholder="🔍 Rechercher un jeu...">
                </div>

                <div class="jeux-liste" id="jeux-liste">
                    <!-- Les jeux s'afficheront ici -->
                </div>
            </div>
        `;

        // Charger les jeux : priorité Supabase (si connecté), puis fichier embarqué, puis localStorage
        let jeux = [];
        let collapsedFamilles = {};
        try { collapsedFamilles = JSON.parse(localStorage.getItem('jeuxFamillesCollapsed') || '{}'); } catch (e) { collapsedFamilles = {}; }

        function normalizeJeu(jeu) {
            return {
                id: jeu.id,
                titre: jeu.titre || jeu.title || '',
                url: jeu.url || '',
                famille: jeu.famille || 'Général',
                position: Number(jeu.position) || 0
            };
        }

        function getFamillesExtra() {
            try {
                const extras = JSON.parse(localStorage.getItem('jeuxFamillesExtra') || '[]');
                return Array.isArray(extras) ? extras.filter(Boolean) : [];
            } catch (e) {
                return [];
            }
        }

        function setFamillesExtra(list) {
            localStorage.setItem('jeuxFamillesExtra', JSON.stringify(list));
        }

        function getFamilles() {
            const set = {};
            jeux.forEach(function (j) { set[j.famille || 'Général'] = true; });
            getFamillesExtra().forEach(function (f) { if (f) set[f] = true; });
            set['Général'] = true;
            return Object.keys(set).sort(function (a, b) {
                if (a === 'Général') return -1;
                if (b === 'Général') return 1;
                return a.localeCompare(b, 'fr');
            });
        }

        function refreshFamilleSelect(selected) {
            const select = container.querySelector('#jeu-famille');
            if (!select) return;
            const current = selected || select.value || 'Général';
            select.innerHTML = getFamilles().map(function (f) {
                return `<option value="${f}">📁 ${f}</option>`;
            }).join('');
            select.value = getFamilles().indexOf(current) >= 0 ? current : 'Général';
        }

        async function loadJeux() {
            const online = window.EprofStore && await window.EprofStore.isOnlineReady();
            if (online) {
                const teacherId = await window.EprofStore.getTeacherId();
                let { data, error } = await window.EprofStore.list('pedagogical_games', {
                    filters: { teacher_id: teacherId },
                    orderBy: 'position'
                });
                if (error) {
                    const retry = await window.EprofStore.list('pedagogical_games', {
                        filters: { teacher_id: teacherId },
                        orderBy: 'created_at'
                    });
                    data = retry.data;
                    error = retry.error;
                }
                if (!error && data) {
                    jeux = data.map(function(row) {
                        return { id: row.id, titre: row.title, url: row.url, famille: row.famille || 'Général', position: Number(row.position) || 0 };
                    });
                    jeux.sort(function (a, b) {
                        const fa = a.famille || 'Général';
                        const fb = b.famille || 'Général';
                        if (fa !== fb) return fa.localeCompare(fb, 'fr');
                        return (a.position || 0) - (b.position || 0);
                    });
                    try { localStorage.setItem('jeuxPedagogiques', JSON.stringify(jeux)); } catch (e) {}
                    return;
                }
                console.warn('⚠️ Jeux pédagogiques : bascule sur le cache local (Supabase indisponible).', error);
            }

            if (typeof JEUX_PEDAGOGIQUES !== 'undefined' && Array.isArray(JEUX_PEDAGOGIQUES) && JEUX_PEDAGOGIQUES.length > 0) {
                jeux = JEUX_PEDAGOGIQUES.map(normalizeJeu);
            } else {
                jeux = JSON.parse(localStorage.getItem('jeuxPedagogiques') || '[]').map(normalizeJeu);
            }
        }

        function escapeAttr(value) {
            return String(value == null ? '' : value)
                .replace(/&/g, '&amp;')
                .replace(/"/g, '&quot;')
                .replace(/</g, '&lt;');
        }

        function jeuCardHtml(jeu) {
            return `
                <div class="jeu-card" draggable="true" data-jeu-id="${escapeAttr(jeu.id || '')}" data-jeu-titre="${escapeAttr(jeu.titre)}" data-jeu-url="${escapeAttr(jeu.url)}" title="Glissez pour changer l’ordre ou de dossier">
                    <div class="jeu-card-header">
                        <h4><span class="jeu-card-grip" aria-hidden="true">⋮⋮</span>${jeu.titre}</h4>
                        <button class="btn-supprimer-jeu" draggable="false" data-titre="${escapeAttr(jeu.titre)}" data-id="${escapeAttr(jeu.id || '')}">🗑️</button>
                    </div>
                    <a href="${jeu.url}" target="_blank" class="jeu-link" draggable="false">
                        <div class="jeu-icon">🎮</div>
                        <div class="jeu-url">${jeu.url}</div>
                        <div class="jeu-action">▶️ Jouer</div>
                    </a>
                </div>`;
        }

        function trouverJeu(id, titre, url) {
            if (id) {
                const byId = jeux.find(function (j) { return String(j.id) === String(id); });
                if (byId) return byId;
            }
            return jeux.find(function (j) { return j.titre === titre && j.url === url; }) || null;
        }

        function jeuxDeFamille(famille) {
            return jeux.filter(function (j) { return (j.famille || 'Général') === famille; })
                .sort(function (a, b) { return (a.position || 0) - (b.position || 0); });
        }

        async function persistPositionsFamille(famille) {
            const list = jeuxDeFamille(famille);
            list.forEach(function (j, i) { j.position = i; });
            sauvegarderJeux();
            if (!window.EprofStore || !(await window.EprofStore.isOnlineReady())) return;
            for (let i = 0; i < list.length; i++) {
                if (!list[i].id) continue;
                await window.EprofStore.update('pedagogical_games', list[i].id, {
                    famille: list[i].famille || 'Général',
                    position: i
                });
            }
        }

        function renommerFamille(ancienne) {
            if (!ancienne || ancienne === 'Général') return;
            const saisie = prompt('Nom du dossier', ancienne);
            if (saisie == null) return;
            const nouvelle = saisie.trim();
            if (!nouvelle) {
                alert('⚠️ Saisissez un nom de dossier.');
                return;
            }
            if (nouvelle === ancienne) return;
            if (nouvelle === 'Général') {
                alert('⚠️ Ce nom est réservé.');
                return;
            }
            const existe = getFamilles().some(function (f) {
                return f !== ancienne && f.toLowerCase() === nouvelle.toLowerCase();
            });
            if (existe) {
                alert('⚠️ Un dossier avec ce nom existe déjà.');
                return;
            }
            const extras = getFamillesExtra().filter(function (f) { return f !== ancienne; });
            extras.push(nouvelle);
            setFamillesExtra(extras);
            if (Object.prototype.hasOwnProperty.call(collapsedFamilles, ancienne)) {
                collapsedFamilles[nouvelle] = collapsedFamilles[ancienne];
                delete collapsedFamilles[ancienne];
                localStorage.setItem('jeuxFamillesCollapsed', JSON.stringify(collapsedFamilles));
            }
            jeux.forEach(function (j) {
                if ((j.famille || 'Général') === ancienne) j.famille = nouvelle;
            });
            persistPositionsFamille(nouvelle);
            const select = container.querySelector('#jeu-famille');
            if (select && select.value === ancienne) select.value = nouvelle;
            afficherJeux(container.querySelector('#recherche-jeu').value);
        }

        function supprimerFamille(nom) {
            if (!nom || nom === 'Général') return;
            const n = jeuxDeFamille(nom).length;
            const msg = n
                ? 'Supprimer le dossier « ' + nom + ' » ?\n\nLes jeux déjà enregistrés seront déplacés dans Général (leur contenu ne change pas).'
                : 'Supprimer le dossier « ' + nom + ' » ?';
            if (!confirm(msg)) return;
            setFamillesExtra(getFamillesExtra().filter(function (f) { return f !== nom; }));
            delete collapsedFamilles[nom];
            localStorage.setItem('jeuxFamillesCollapsed', JSON.stringify(collapsedFamilles));
            jeux.forEach(function (j) {
                if ((j.famille || 'Général') === nom) j.famille = 'Général';
            });
            persistPositionsFamille('Général');
            const select = container.querySelector('#jeu-famille');
            if (select && select.value === nom) select.value = 'Général';
            afficherJeux(container.querySelector('#recherche-jeu').value);
        }

        async function deplacerJeu(jeu, nouvelleFamille, beforeJeu) {
            if (!jeu || !nouvelleFamille) return;
            const ancienne = jeu.famille || 'Général';
            const sameFolder = ancienne === nouvelleFamille;
            const samePlace = sameFolder && (!beforeJeu || beforeJeu === jeu);
            if (samePlace && !beforeJeu) {
                if (sameFolder) return;
            }
            jeu.famille = nouvelleFamille;
            const cible = jeux.filter(function (j) {
                return j !== jeu && (j.famille || 'Général') === nouvelleFamille;
            }).sort(function (a, b) { return (a.position || 0) - (b.position || 0); });
            if (beforeJeu && beforeJeu !== jeu) {
                const idx = cible.indexOf(beforeJeu);
                if (idx >= 0) cible.splice(idx, 0, jeu);
                else cible.push(jeu);
            } else {
                cible.push(jeu);
            }
            cible.forEach(function (j, i) { j.position = i; });
            collapsedFamilles[nouvelleFamille] = false;
            localStorage.setItem('jeuxFamillesCollapsed', JSON.stringify(collapsedFamilles));
            if (ancienne !== nouvelleFamille) await persistPositionsFamille(ancienne);
            await persistPositionsFamille(nouvelleFamille);
            const rechercheInput = container.querySelector('#recherche-jeu');
            afficherJeux(rechercheInput ? rechercheInput.value : '');
        }

        function afficherJeux(filtreTexte = '') {
            const jeuxListe = container.querySelector('#jeux-liste');
            refreshFamilleSelect();
            
            const jeuxFiltres = filtreTexte
                ? jeux.filter(jeu =>
                    (jeu.titre || '').toLowerCase().includes(filtreTexte.toLowerCase()) ||
                    (jeu.url || '').toLowerCase().includes(filtreTexte.toLowerCase()) ||
                    (jeu.famille || '').toLowerCase().includes(filtreTexte.toLowerCase())
                  )
                : jeux;

            const familles = getFamilles();
            if (jeux.length === 0 && familles.length <= 1) {
                jeuxListe.innerHTML = '<p style="text-align: center; color: #64748b; font-style: italic; margin-top: 40px;">Aucun jeu enregistré. Ajoutez votre premier jeu !</p>';
                return;
            }
            if (filtreTexte && jeuxFiltres.length === 0) {
                jeuxListe.innerHTML = '<p style="text-align: center; color: #64748b; font-style: italic; margin-top: 40px;">🔍 Aucun jeu ne correspond à votre recherche.</p>';
                return;
            }

            const groupes = {};
            familles.forEach(function (fam) { groupes[fam] = []; });
            jeuxFiltres.forEach(function (jeu) {
                const fam = jeu.famille || 'Général';
                (groupes[fam] = groupes[fam] || []).push(jeu);
            });
            Object.keys(groupes).forEach(function (fam) {
                groupes[fam].sort(function (a, b) { return (a.position || 0) - (b.position || 0); });
            });
            const ordre = Object.keys(groupes).filter(function (famille) {
                if (filtreTexte) return groupes[famille].length > 0;
                return true;
            }).sort(function (a, b) {
                if (a === 'Général') return -1;
                if (b === 'Général') return 1;
                return a.localeCompare(b, 'fr');
            });

            jeuxListe.innerHTML = ordre.map(function (famille) {
                const closed = !!collapsedFamilles[famille];
                const cartes = groupes[famille].length
                    ? groupes[famille].map(jeuCardHtml).join('')
                    : '<p class="jeux-famille-vide">Glissez un jeu ici</p>';
                const folderActions = famille !== 'Général'
                    ? `<span class="jeux-famille-actions">
                            <button type="button" class="btn-editer-famille" data-famille="${escapeAttr(famille)}" title="Modifier le dossier" aria-label="Modifier le dossier">✏️</button>
                            <button type="button" class="btn-supprimer-famille" data-famille="${escapeAttr(famille)}" title="Supprimer le dossier" aria-label="Supprimer le dossier">🗑️</button>
                        </span>`
                    : '';
                return `
                    <section class="jeux-famille" data-famille="${escapeAttr(famille)}">
                        <div class="jeux-famille-head">
                            <button type="button" class="jeux-famille-toggle" aria-expanded="${closed ? 'false' : 'true'}">
                                <span class="jeux-famille-chevron">${closed ? '▶' : '▼'}</span>
                                <span>📁 ${famille}</span>
                                <small>${groupes[famille].length}</small>
                            </button>
                            ${folderActions}
                        </div>
                        <div class="jeux-grid" style="${closed ? 'display:none;' : ''}">
                            ${cartes}
                        </div>
                    </section>`;
            }).join('');

            container.querySelectorAll('.jeux-famille-toggle').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    const section = btn.closest('.jeux-famille');
                    const famille = section.dataset.famille;
                    collapsedFamilles[famille] = !collapsedFamilles[famille];
                    localStorage.setItem('jeuxFamillesCollapsed', JSON.stringify(collapsedFamilles));
                    afficherJeux(container.querySelector('#recherche-jeu').value);
                });
            });

            container.querySelectorAll('.btn-editer-famille').forEach(function (btn) {
                btn.addEventListener('click', function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    renommerFamille(btn.getAttribute('data-famille'));
                });
            });

            container.querySelectorAll('.btn-supprimer-famille').forEach(function (btn) {
                btn.addEventListener('click', function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    supprimerFamille(btn.getAttribute('data-famille'));
                });
            });

            container.querySelectorAll('.btn-supprimer-jeu').forEach(btn => {
                btn.addEventListener('click', async function() {
                    const titre = this.getAttribute('data-titre');
                    const gameId = this.getAttribute('data-id');
                    const index = jeux.findIndex(j => j.titre === titre);
                    if (index !== -1 && confirm(`Supprimer le jeu "${jeux[index].titre}" ?`)) {
                        jeux.splice(index, 1);
                        sauvegarderJeux();
                        if (gameId && window.EprofStore) {
                            window.EprofStore.remove('pedagogical_games', gameId);
                        }
                        const rechercheInput = container.querySelector('#recherche-jeu');
                        afficherJeux(rechercheInput ? rechercheInput.value : '');
                    }
                });
            });

            let jeuEnDeplacement = null;
            let dragVientDeTerminer = false;

            function clearJeuDropUi() {
                container.querySelectorAll('.jeux-famille-drop-target, .jeu-card-drop-before').forEach(function (el) {
                    el.classList.remove('jeux-famille-drop-target', 'jeu-card-drop-before');
                });
            }

            container.querySelectorAll('.jeu-card').forEach(function (card) {
                card.addEventListener('dragstart', function (e) {
                    jeuEnDeplacement = {
                        id: card.getAttribute('data-jeu-id') || '',
                        titre: card.getAttribute('data-jeu-titre') || '',
                        url: card.getAttribute('data-jeu-url') || '',
                        famille: (card.closest('.jeux-famille') || {}).dataset.famille || 'Général'
                    };
                    card.classList.add('jeu-card-dragging');
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', jeuEnDeplacement.titre);
                });
                card.addEventListener('dragend', function () {
                    card.classList.remove('jeu-card-dragging');
                    clearJeuDropUi();
                    dragVientDeTerminer = true;
                    jeuEnDeplacement = null;
                    setTimeout(function () { dragVientDeTerminer = false; }, 0);
                });
                card.addEventListener('dragover', function (e) {
                    if (!jeuEnDeplacement) return;
                    e.preventDefault();
                    e.stopPropagation();
                    e.dataTransfer.dropEffect = 'move';
                    container.querySelectorAll('.jeu-card-drop-before').forEach(function (el) {
                        if (el !== card) el.classList.remove('jeu-card-drop-before');
                    });
                    card.classList.add('jeu-card-drop-before');
                });
                card.addEventListener('dragleave', function () {
                    card.classList.remove('jeu-card-drop-before');
                });
                card.addEventListener('drop', function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    card.classList.remove('jeu-card-drop-before');
                    const destination = (card.closest('.jeux-famille') || {}).dataset.famille;
                    const payload = jeuEnDeplacement;
                    if (!payload || !destination) return;
                    const jeu = trouverJeu(payload.id, payload.titre, payload.url);
                    const before = trouverJeu(card.getAttribute('data-jeu-id'), card.getAttribute('data-jeu-titre'), card.getAttribute('data-jeu-url'));
                    deplacerJeu(jeu, destination, before);
                });
                const lien = card.querySelector('.jeu-link');
                if (lien) {
                    lien.addEventListener('click', function (e) {
                        if (dragVientDeTerminer) e.preventDefault();
                    });
                }
            });

            container.querySelectorAll('.jeux-famille').forEach(function (section) {
                section.addEventListener('dragover', function (e) {
                    if (!jeuEnDeplacement) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    section.classList.add('jeux-famille-drop-target');
                });
                section.addEventListener('dragleave', function (e) {
                    if (!section.contains(e.relatedTarget)) {
                        section.classList.remove('jeux-famille-drop-target');
                    }
                });
                section.addEventListener('drop', function (e) {
                    e.preventDefault();
                    section.classList.remove('jeux-famille-drop-target');
                    const destination = section.dataset.famille;
                    const payload = jeuEnDeplacement;
                    if (!payload || !destination) return;
                    const jeu = trouverJeu(payload.id, payload.titre, payload.url);
                    deplacerJeu(jeu, destination, null);
                });
            });
        }

        // Fonction pour sauvegarder dans localStorage et proposer export
        function sauvegarderJeux() {
            localStorage.setItem('jeuxPedagogiques', JSON.stringify(jeux));
        }

        // Exporter les jeux dans un fichier JavaScript
        const exporterBtn = container.querySelector('#exporter-jeux-btn');
        exporterBtn.addEventListener('click', function() {
            const contenuFichier = `// Jeux pédagogiques - Données embarquées pour portabilité complète
// Ce fichier contient la liste des jeux pédagogiques sauvegardés
// Remplacez le fichier js/jeux-pedagogiques.js par celui-ci pour restaurer vos jeux

const JEUX_PEDAGOGIQUES = ${JSON.stringify(jeux, null, 4)};

// Export pour utilisation dans app.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = JEUX_PEDAGOGIQUES;
}
`;
            
            const blob = new Blob([contenuFichier], { type: 'text/javascript' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'jeux-pedagogiques.js';
            a.click();
            URL.revokeObjectURL(url);
            
            alert('✅ Fichier jeux-pedagogiques.js téléchargé !\n\n💡 Pour portabilité : remplacez le fichier js/jeux-pedagogiques.js dans votre dossier eProf par ce fichier téléchargé.');
        });

        // Importer les jeux depuis un fichier JavaScript
        const importerBtn = container.querySelector('#importer-jeux-btn');
        const importFileInput = container.querySelector('#import-jeux-file');
        
        importerBtn.addEventListener('click', function() {
            importFileInput.click();
        });
        
        importFileInput.addEventListener('change', async function(e) {
            const file = e.target.files[0];
            if (!file) return;
            
            try {
                const texte = await file.text();
                
                // Extraire le tableau JEUX_PEDAGOGIQUES du fichier
                const match = texte.match(/const JEUX_PEDAGOGIQUES = (\[[\s\S]*?\]);/);
                
                if (match && match[1]) {
                    const jeuxImportes = JSON.parse(match[1]);
                    
                    if (Array.isArray(jeuxImportes)) {
                        if (confirm(`Importer ${jeuxImportes.length} jeu(x) ?\n\n⚠️ Cela remplacera la liste actuelle.`)) {
                            jeux = jeuxImportes;
                            sauvegarderJeux();
                            afficherJeux();
                            alert(`✅ ${jeuxImportes.length} jeu(x) importé(s) avec succès !`);
                        }
                    } else {
                        alert('⚠️ Format de fichier invalide : le tableau de jeux est introuvable.');
                    }
                } else {
                    alert('⚠️ Format de fichier invalide : impossible de trouver JEUX_PEDAGOGIQUES.');
                }
            } catch (error) {
                console.error('Erreur import jeux:', error);
                alert('❌ Erreur lors de l\'importation du fichier. Vérifiez que c\'est bien un fichier jeux-pedagogiques.js valide.');
            }
            
            importFileInput.value = '';
        });

        // Ajouter un jeu
        const ajouterBtn = container.querySelector('#ajouter-jeu-btn');
        const titreInput = container.querySelector('#jeu-titre');
        const urlInput = container.querySelector('#jeu-url');

        ajouterBtn.addEventListener('click', async function() {
            const titre = titreInput.value.trim();
            const url = urlInput.value.trim();

            if (!titre) {
                alert('⚠️ Veuillez saisir un titre pour le jeu');
                return;
            }

            if (!url || !url.match(/^https?:\/\/.+/)) {
                alert('⚠️ Veuillez saisir une URL valide (commençant par http:// ou https://)');
                return;
            }

            const famille = (container.querySelector('#jeu-famille') || {}).value || 'Général';
            const position = jeuxDeFamille(famille).length;
            const nouveauJeu = { titre, url, famille, position };
            jeux.push(nouveauJeu);
            sauvegarderJeux();

            if (window.EprofStore && await window.EprofStore.isOnlineReady()) {
                const teacherId = await window.EprofStore.getTeacherId();
                let res = await window.EprofStore.insert('pedagogical_games', {
                    teacher_id: teacherId,
                    title: titre,
                    url: url,
                    famille: famille,
                    position: position
                });
                if (res.error && /famille|position/i.test(res.error.message || '')) {
                    res = await window.EprofStore.insert('pedagogical_games', {
                        teacher_id: teacherId,
                        title: titre,
                        url: url
                    });
                }
                if (!res.error && res.data && res.data.id) {
                    nouveauJeu.id = res.data.id;
                    sauvegarderJeux();
                }
            }

            titreInput.value = '';
            urlInput.value = '';
            
            afficherJeux();
        });

        // Entrée pour valider
        urlInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                ajouterBtn.click();
            }
        });

        const creerFamilleBtn = container.querySelector('#creer-famille-jeu-btn');
        if (creerFamilleBtn) {
            creerFamilleBtn.addEventListener('click', function () {
                const input = container.querySelector('#jeu-nouvelle-famille');
                const nom = (input && input.value.trim()) || '';
                if (!nom) {
                    alert('⚠️ Saisissez un nom de dossier.');
                    return;
                }
                const extras = getFamillesExtra();
                if (extras.indexOf(nom) === -1) extras.push(nom);
                setFamillesExtra(extras);
                collapsedFamilles[nom] = false;
                localStorage.setItem('jeuxFamillesCollapsed', JSON.stringify(collapsedFamilles));
                if (input) input.value = '';
                refreshFamilleSelect(nom);
                const rechercheInput = container.querySelector('#recherche-jeu');
                afficherJeux(rechercheInput ? rechercheInput.value : '');
            });
        }

        // Recherche en temps réel
        const rechercheInput = container.querySelector('#recherche-jeu');
        rechercheInput.addEventListener('input', function() {
            afficherJeux(this.value);
        });

        loadJeux().then(function() { afficherJeux(); });
    }

    // ========================================
    // PARAMÈTRES
    // ========================================
    async function renderParametres(container) {
        const defaults = defaultAppParametres();
        let parametres = defaults;
        try {
            const stored = JSON.parse(localStorage.getItem('parametres') || '{}');
            parametres = {
                enseignant: Object.assign({}, defaults.enseignant, stored.enseignant || {}),
                anneeScolaire: stored.anneeScolaire || defaults.anneeScolaire,
                calendrier: Object.assign({}, defaults.calendrier, stored.calendrier || {}),
                affichage: Object.assign({}, defaults.affichage, stored.affichage || {}),
                alertes: Object.assign({}, defaults.alertes, stored.alertes || {}),
                notation: Object.assign({}, defaults.notation, stored.notation || {})
            };
        } catch (e) {
            parametres = defaultAppParametres();
        }

        if (!Array.isArray(parametres.notation.mentions) || parametres.notation.mentions.length === 0) {
            const n = parametres.notation;
            parametres.notation.mentions = [
                { emoji: '🏆', label: 'Très bien', seuilMin: n.seuilTresBien ?? 16 },
                { emoji: '😊', label: 'Bien', seuilMin: n.seuilBien ?? 14 },
                { emoji: '🙂', label: 'Assez bien', seuilMin: n.seuilAssezBien ?? 12 },
                { emoji: '😐', label: 'Passable', seuilMin: n.seuilPassable ?? 10 },
                { emoji: '📚', label: 'À retravailler', seuilMin: 0 }
            ];
        }
        if (parametres.notation.systeme === 'lettres') {
            parametres.notation.systeme = 'sur20';
        }
        if (!parametres.affichage.modeMobile) {
            parametres.affichage.modeMobile = 'auto';
        }
        if (!parametres.affichage.couleurTheme) {
            parametres.affichage.couleurTheme = 'defaut';
        }
        if (!parametres.affichage.densite) {
            parametres.affichage.densite = 'normal';
        }
        if (parametres.affichage.couleurAccent === undefined) {
            parametres.affichage.couleurAccent = '';
        }
        if (!parametres.affichage.ambiance) {
            parametres.affichage.ambiance = 'none';
        }
        if (!parametres.affichage.fondIntensite) {
            parametres.affichage.fondIntensite = 'moyen';
        }
        if (!parametres.affichage.chromeStyle) {
            parametres.affichage.chromeStyle = 'uni';
        }
        delete parametres.enseignant.etablissement;
        delete parametres.calendrier.dureeCoursDefaut;
        delete parametres.periodes;

        if (window.EprofStore && await window.EprofStore.isOnlineReady()) {
            const teacherId = await window.EprofStore.getTeacherId();
            const { data, error } = await window.EprofStore.list('profiles', { filters: { id: teacherId } });
            const profile = !error && data && data[0];
            if (profile) {
                parametres.enseignant.nom = profile.nom || parametres.enseignant.nom;
                parametres.enseignant.prenom = profile.prenom || parametres.enseignant.prenom;
                parametres.enseignant.matiere = profile.matiere || parametres.enseignant.matiere;
                parametres.enseignant.email = profile.email || parametres.enseignant.email;
                localStorage.setItem('parametres', JSON.stringify(parametres));
            }
        }

        container.innerHTML = `
            <div id="parametres-module">
                <div class="param-page-header">
                    <h2>⚙️ Paramètres</h2>
                    <div class="param-toolbar">
                        <span id="param-sync-status" class="param-sync-status">⚪ Vérification…</span>
                        <button type="button" id="param-ouvrir-doc" class="btn-action btn-secondary param-doc-btn">📖 Documentation</button>
                    </div>
                </div>

                <nav class="param-toc" aria-label="Sommaire des paramètres">
                    <a href="#param-sec-profil">Profil</a>
                    <a href="#param-sec-affichage">Affichage</a>
                    <a href="#param-sec-calendrier">Calendrier</a>
                    <a href="#param-sec-notation">Notation</a>
                    <a href="#param-sec-compte">Compte</a>
                    <a href="#param-sec-donnees">Données</a>
                </nav>

                <div class="parametres-sections">

                    <details class="param-section" id="param-sec-profil" open>
                        <summary>📋 Profil et année scolaire</summary>
                        <div class="param-form">
                            <div class="param-row">
                                <label>Nom :</label>
                                <input type="text" id="param-nom" value="${parametres.enseignant.nom}" placeholder="Nom">
                            </div>
                            <div class="param-row">
                                <label>Prénom :</label>
                                <input type="text" id="param-prenom" value="${parametres.enseignant.prenom}" placeholder="Prénom">
                            </div>
                            <div class="param-row">
                                <label>Matière(s) :</label>
                                <input type="text" id="param-matiere" value="${parametres.enseignant.matiere}" placeholder="Ex: Mathématiques, SVT">
                            </div>
                            <div class="param-row">
                                <label>Email :</label>
                                <input type="email" id="param-email" value="${parametres.enseignant.email}" placeholder="email@exemple.fr">
                            </div>
                            <div class="param-row">
                                <label>Année scolaire :</label>
                                <select id="param-annee">
                                    <option value="2025-2026" ${parametres.anneeScolaire === '2025-2026' ? 'selected' : ''}>2025-2026</option>
                                    <option value="2026-2027" ${parametres.anneeScolaire === '2026-2027' ? 'selected' : ''}>2026-2027</option>
                                    <option value="2027-2028" ${parametres.anneeScolaire === '2027-2028' ? 'selected' : ''}>2027-2028</option>
                                </select>
                            </div>
                            <p class="param-hint">L’année scolaire est utilisée pour les trombinoscopes, les vacances / jours fériés du calendrier, et les libellés du carnet de notes.</p>
                            <div class="param-actions">
                                <button type="button" id="param-gerer-classes" class="btn-action btn-primary">📚 Gérer mes classes et matières</button>
                            </div>
                        </div>
                    </details>

                    <details class="param-section" id="param-sec-affichage">
                        <summary>🎨 Affichage</summary>
                        <div class="param-form">
                            <div class="param-row">
                                <label>Mode :</label>
                                <select id="param-theme">
                                    <option value="clair" ${parametres.affichage.theme === 'clair' ? 'selected' : ''}>☀️ Clair</option>
                                    <option value="sombre" ${parametres.affichage.theme === 'sombre' ? 'selected' : ''}>🌙 Sombre</option>
                                </select>
                            </div>
                            <div class="param-row">
                                <label>Couleur du thème :</label>
                                <div id="param-couleur-theme" class="param-color-presets">
                                    <button type="button" class="color-preset${parametres.affichage.couleurTheme === 'defaut' ? ' active' : ''}" data-theme="defaut" style="background:linear-gradient(135deg,#2563eb,#1e40af)" title="Bleu (défaut)"></button>
                                    <button type="button" class="color-preset${parametres.affichage.couleurTheme === 'ocean' ? ' active' : ''}" data-theme="ocean" style="background:linear-gradient(135deg,#0891b2,#164e63)" title="Océan"></button>
                                    <button type="button" class="color-preset${parametres.affichage.couleurTheme === 'foret' ? ' active' : ''}" data-theme="foret" style="background:linear-gradient(135deg,#16a34a,#14532d)" title="Forêt"></button>
                                    <button type="button" class="color-preset${parametres.affichage.couleurTheme === 'crepuscule' ? ' active' : ''}" data-theme="crepuscule" style="background:linear-gradient(135deg,#7c3aed,#4c1d95)" title="Crépuscule"></button>
                                    <button type="button" class="color-preset${parametres.affichage.couleurTheme === 'rose' ? ' active' : ''}" data-theme="rose" style="background:linear-gradient(135deg,#e11d48,#881337)" title="Rose"></button>
                                    <button type="button" class="color-preset${parametres.affichage.couleurTheme === 'ambre' ? ' active' : ''}" data-theme="ambre" style="background:linear-gradient(135deg,#d97706,#78350f)" title="Ambre"></button>
                                    <button type="button" class="color-preset color-preset-custom${parametres.affichage.couleurTheme === 'custom' ? ' active' : ''}" data-theme="custom" title="Personnalisé">
                                        <span style="font-size:0.85em">✏️</span>
                                    </button>
                                </div>
                            </div>
                            <div class="param-row param-custom-accent" id="param-custom-accent-row" style="display:${parametres.affichage.couleurTheme === 'custom' ? 'flex' : 'none'}">
                                <label>Couleur d'accent :</label>
                                <input type="color" id="param-couleur-accent" value="${parametres.affichage.couleurAccent || '#2563eb'}">
                            </div>
                            <div class="param-row">
                                <label>Looks prêts à l'emploi :</label>
                                <div class="look-row" id="param-looks">
                                    <button type="button" class="look-chip" data-look="classique">Classique</button>
                                    <button type="button" class="look-chip" data-look="campus">Campus eProf</button>
                                    <button type="button" class="look-chip" data-look="lycee">Lycée Jeanne Delanoue</button>
                                    <button type="button" class="look-chip" data-look="nature">Nature Chlorofil</button>
                                    <button type="button" class="look-chip" data-look="atelier">Atelier crépuscule</button>
                                </div>
                            </div>
                            <div class="param-row">
                                <label>Fond d'interface :</label>
                                <div id="param-ambiance" class="ambiance-grid">
                                    <button type="button" class="ambiance-card${parametres.affichage.ambiance === 'none' ? ' active' : ''}" data-ambiance="none"><i class="ambiance-thumb amb-none"></i><span>Aucun</span></button>
                                    <button type="button" class="ambiance-card${parametres.affichage.ambiance === 'eprof' ? ' active' : ''}" data-ambiance="eprof"><i class="ambiance-thumb amb-eprof"></i><span>Logo eProf</span></button>
                                    <button type="button" class="ambiance-card${parametres.affichage.ambiance === 'lycee' ? ' active' : ''}" data-ambiance="lycee"><i class="ambiance-thumb amb-lycee"></i><span>Logo lycée</span></button>
                                    <button type="button" class="ambiance-card${parametres.affichage.ambiance === 'chlorofil' ? ' active' : ''}" data-ambiance="chlorofil"><i class="ambiance-thumb amb-chlorofil"></i><span>Chlorofil</span></button>
                                    <button type="button" class="ambiance-card${parametres.affichage.ambiance === 'points' ? ' active' : ''}" data-ambiance="points"><i class="ambiance-thumb amb-points"></i><span>Points</span></button>
                                    <button type="button" class="ambiance-card${parametres.affichage.ambiance === 'losanges' ? ' active' : ''}" data-ambiance="losanges"><i class="ambiance-thumb amb-losanges"></i><span>Losanges</span></button>
                                    <button type="button" class="ambiance-card${parametres.affichage.ambiance === 'vagues' ? ' active' : ''}" data-ambiance="vagues"><i class="ambiance-thumb amb-vagues"></i><span>Vagues</span></button>
                                    <button type="button" class="ambiance-card${parametres.affichage.ambiance === 'custom' ? ' active' : ''}" data-ambiance="custom"><i class="ambiance-thumb amb-custom"></i><span>Mon image</span></button>
                                </div>
                            </div>
                            <div class="param-row" id="param-fond-perso-row" style="display:${parametres.affichage.ambiance === 'custom' ? 'flex' : 'none'}">
                                <label>Image personnelle :</label>
                                <div class="fond-perso-actions">
                                    <input type="file" id="param-fond-perso" accept="image/jpeg,image/png,image/webp">
                                    <button type="button" id="param-fond-perso-clear" class="btn-secondary">Retirer</button>
                                </div>
                            </div>
                            <div class="param-row">
                                <label>Intensité du fond :</label>
                                <select id="param-fond-intensite">
                                    <option value="faible" ${parametres.affichage.fondIntensite === 'faible' ? 'selected' : ''}>Discret</option>
                                    <option value="moyen" ${parametres.affichage.fondIntensite === 'moyen' ? 'selected' : ''}>Moyen</option>
                                    <option value="fort" ${parametres.affichage.fondIntensite === 'fort' ? 'selected' : ''}>Marqué</option>
                                </select>
                            </div>
                            <div class="param-row">
                                <label>En-tête et menu :</label>
                                <select id="param-chrome-style">
                                    <option value="uni" ${parametres.affichage.chromeStyle === 'uni' ? 'selected' : ''}>Couleur unie</option>
                                    <option value="degrade" ${parametres.affichage.chromeStyle === 'degrade' ? 'selected' : ''}>Dégradé</option>
                                    <option value="texture" ${parametres.affichage.chromeStyle === 'texture' ? 'selected' : ''}>Texture logo eProf</option>
                                </select>
                            </div>
                            <div class="param-row">
                                <label>Densité :</label>
                                <select id="param-densite">
                                    <option value="compact" ${parametres.affichage.densite === 'compact' ? 'selected' : ''}>Compact</option>
                                    <option value="normal" ${parametres.affichage.densite === 'normal' ? 'selected' : ''}>Normal</option>
                                    <option value="confortable" ${parametres.affichage.densite === 'confortable' ? 'selected' : ''}>Confortable</option>
                                </select>
                            </div>
                            <div class="param-row">
                                <label>Taille de police :</label>
                                <select id="param-taille-police">
                                    <option value="petit" ${parametres.affichage.taillePolice === 'petit' ? 'selected' : ''}>Petit</option>
                                    <option value="moyen" ${parametres.affichage.taillePolice === 'moyen' ? 'selected' : ''}>Moyen</option>
                                    <option value="grand" ${parametres.affichage.taillePolice === 'grand' ? 'selected' : ''}>Grand</option>
                                </select>
                            </div>
                            <div class="param-row">
                                <label>Affichage mobile :</label>
                                <select id="param-mode-mobile">
                                    <option value="auto" ${parametres.affichage.modeMobile === 'auto' ? 'selected' : ''}>Automatique (recommandé)</option>
                                    <option value="active" ${parametres.affichage.modeMobile === 'active' ? 'selected' : ''}>Toujours activé</option>
                                    <option value="inactive" ${parametres.affichage.modeMobile === 'inactive' ? 'selected' : ''}>Toujours désactivé</option>
                                </select>
                            </div>
                            <p class="param-hint">Les changements s'appliquent immédiatement. Enregistrez pour les conserver. L'image personnelle reste sur cet appareil.</p>
                        </div>
                    </details>

                    <details class="param-section" id="param-sec-calendrier">
                        <summary>🕐 Calendrier</summary>
                        <div class="param-form">
                            <div class="param-row">
                                <label>Première heure affichée :</label>
                                <input type="time" id="param-heure-debut" value="${parametres.calendrier.heureDebut}">
                            </div>
                            <div class="param-row">
                                <label>Dernière heure affichée :</label>
                                <input type="time" id="param-heure-fin" value="${parametres.calendrier.heureFin}">
                            </div>
                            <div class="param-row">
                                <label>Ligne « début de journée » :</label>
                                <input type="time" id="param-ligne-debut" value="${parametres.calendrier.ligneDebut || '08:00'}">
                            </div>
                            <div class="param-row">
                                <label>Ligne « fin de journée » :</label>
                                <input type="time" id="param-ligne-fin" value="${parametres.calendrier.ligneFin || '17:10'}">
                            </div>
                            <div class="param-row">
                                <label>Récréation du matin :</label>
                                <div class="param-time-pair">
                                    <input type="time" id="param-pause-matin-debut" value="${parametres.calendrier.pauseMatinDebut || '09:50'}">
                                    <span>→</span>
                                    <input type="time" id="param-pause-matin-fin" value="${parametres.calendrier.pauseMatinFin || '10:05'}">
                                </div>
                            </div>
                            <div class="param-row">
                                <label>Pause méridienne :</label>
                                <div class="param-time-pair">
                                    <input type="time" id="param-pause-midi-debut" value="${parametres.calendrier.pauseMidiDebut || '11:55'}">
                                    <span>→</span>
                                    <input type="time" id="param-pause-midi-fin" value="${parametres.calendrier.pauseMidiFin || '13:15'}">
                                </div>
                            </div>
                            <div class="param-row">
                                <label>Récréation de l’après-midi :</label>
                                <div class="param-time-pair">
                                    <input type="time" id="param-pause-apres-debut" value="${parametres.calendrier.pauseApresDebut || '15:05'}">
                                    <span>→</span>
                                    <input type="time" id="param-pause-apres-fin" value="${parametres.calendrier.pauseApresFin || '15:20'}">
                                </div>
                            </div>
                            <div class="param-row">
                                <label>
                                    <input type="checkbox" id="param-afficher-samedi" ${parametres.calendrier.afficherSamedi ? 'checked' : ''}>
                                    Afficher le samedi dans le calendrier
                                </label>
                            </div>
                            <p class="param-hint">Ces horaires s’appliquent à la vue planning. Les vacances du calendrier scolaire (Zone B) suivent l’année choisie plus haut. Un cours récurrent s’arrête au début des vacances d’été.</p>
                        </div>
                    </details>

                    <details class="param-section" id="param-sec-notation">
                        <summary>📊 Notation et alertes</summary>
                        <div class="param-form">
                            <div class="param-row">
                                <label>Système de notation :</label>
                                <select id="param-systeme-notation">
                                    <option value="sur20" ${parametres.notation.systeme === 'sur20' ? 'selected' : ''}>Sur 20</option>
                                    <option value="sur10" ${parametres.notation.systeme === 'sur10' ? 'selected' : ''}>Sur 10</option>
                                </select>
                            </div>
                            <p class="param-hint">Chaque mention s’applique à partir de sa note minimale, sur l’échelle choisie. Elles apparaissent dans le carnet à côté des moyennes. Cliquez sur un smiley pour le changer.</p>
                            <div id="mentions-list"></div>
                            <div class="param-actions" style="margin-top: 10px;">
                                <button id="btn-ajouter-mention" type="button" class="btn-action btn-primary">➕ Ajouter une mention</button>
                            </div>
                            <div class="param-row">
                                <label>Nombre d'oublis pour un mot :</label>
                                <input type="number" id="param-seuil-oublis" value="${parametres.alertes.seuilOublis}" min="1" max="20">
                            </div>
                            <div class="param-row">
                                <label>Nombre de mots pour alerte :</label>
                                <input type="number" id="param-seuil-mots" value="${parametres.alertes.seuilMots}" min="1" max="50">
                            </div>
                            <p class="param-hint">Ces seuils pilotent les badges et l’alerte « mot à mettre » dans le suivi des élèves.</p>
                        </div>
                    </details>

                    <details class="param-section" id="param-sec-compte">
                        <summary>🔐 Mon compte</summary>
                        <div class="param-form">
                            <div class="param-row">
                                <label>Nouvel identifiant :</label>
                                <input type="text" id="param-nouvel-identifiant" placeholder="ex : adfrantelle" autocomplete="username">
                            </div>
                            <div class="param-actions">
                                <button id="btn-changer-identifiant" class="btn-action btn-primary">✏️ Changer mon identifiant</button>
                            </div>
                            <div class="param-row" style="margin-top: 16px;">
                                <label>Nouveau mot de passe :</label>
                                <input type="password" id="param-nouveau-mdp" placeholder="8 caractères minimum" autocomplete="new-password">
                            </div>
                            <div class="param-row">
                                <label>Confirmer le mot de passe :</label>
                                <input type="password" id="param-confirmer-mdp" placeholder="Ressaisir le mot de passe" autocomplete="new-password">
                            </div>
                            <div class="param-actions">
                                <button id="btn-changer-mdp" class="btn-action btn-primary">🔑 Changer mon mot de passe</button>
                            </div>
                            <div id="param-compte-message" style="margin-top: 10px; font-size: 0.9em;"></div>
                            <div class="param-actions" style="margin-top: 16px;">
                                <button id="btn-deconnexion" class="btn-action btn-danger">🚪 Se déconnecter</button>
                            </div>
                        </div>
                    </details>

                    <details class="param-section" id="param-sec-donnees">
                        <summary>💾 Données locales</summary>
                        <div class="param-actions">
                            <button id="btn-importer-donnees" class="btn-action btn-primary">
                                📤 Importer des données
                            </button>
                            <button id="btn-reset-prefs" class="btn-action btn-secondary">
                                ↺ Réinitialiser les préférences
                            </button>
                            <button id="btn-reset-local" class="btn-action btn-danger">
                                🗑️ Effacer les données locales
                            </button>
                            <input type="file" id="fichier-import" accept=".json" style="display:none;">
                        </div>
                        <p class="param-hint">Les préférences : thème, horaires, barème, seuils (le profil enseignant est conservé). L’effacement local supprime le suivi, le calendrier, les jeux, etc. sur cet appareil, sans déconnecter le compte.</p>
                    </details>

                    <div class="param-save">
                        <button id="btn-sauvegarder-parametres" class="btn-save">
                            💾 Enregistrer les paramètres
                        </button>
                    </div>

                </div>
            </div>
        `;

        const compteMessage = container.querySelector('#param-compte-message');
        function afficherMessageCompte(texte, succes) {
            if (!compteMessage) return;
            compteMessage.textContent = texte;
            compteMessage.style.color = succes ? '#059669' : '#dc2626';
        }

        container.querySelectorAll('.param-toc a').forEach(function (link) {
            link.addEventListener('click', function (e) {
                const id = this.getAttribute('href');
                const target = id ? container.querySelector(id) : null;
                if (!target) return;
                e.preventDefault();
                if (target.tagName === 'DETAILS') target.open = true;
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        });

        const btnGererClasses = container.querySelector('#param-gerer-classes');
        if (btnGererClasses) {
            btnGererClasses.addEventListener('click', function () {
                if (window.teacherManager && typeof window.teacherManager.showInitialConfig === 'function') {
                    window.teacherManager.showInitialConfig();
                }
            });
        }

        const btnOuvrirDoc = container.querySelector('#param-ouvrir-doc');
        if (btnOuvrirDoc) {
            btnOuvrirDoc.addEventListener('click', function () {
                if (window.EprofDocumentation) {
                    window.EprofDocumentation.render(mainContent, {
                        startId: 'parametres',
                        openTool: function (tool) {
                            handleDashboardTool(tool);
                            if (tool === 'calendar') highlightSidebar('calendar-link');
                            else highlightSidebar(tool);
                        }
                    });
                } else {
                    handleDashboardTool('documentation');
                }
            });
        }

        (async function paintParamSync() {
            const el = container.querySelector('#param-sync-status');
            if (!el) return;
            const online = window.EprofStore && await window.EprofStore.isOnlineReady();
            el.textContent = online ? '🟢 En ligne — le profil se synchronise' : '⚪ Hors ligne — enregistrement local';
            el.classList.toggle('online', !!online);
            el.classList.toggle('offline', !online);
        })();

        const themeSelect = container.querySelector('#param-theme');
        const tailleSelect = container.querySelector('#param-taille-police');
        const mobileSelect = container.querySelector('#param-mode-mobile');
        if (themeSelect) {
            themeSelect.addEventListener('change', function () { appliquerTheme(this.value); });
        }
        if (tailleSelect) {
            tailleSelect.addEventListener('change', function () { appliquerTaillePolice(this.value); });
        }
        if (mobileSelect) {
            mobileSelect.addEventListener('change', function () { appliquerModeMobile(this.value); });
        }

        // Color theme presets
        var colorPresets = container.querySelectorAll('#param-couleur-theme .color-preset');
        colorPresets.forEach(function(btn) {
            btn.addEventListener('click', function() {
                colorPresets.forEach(function(b) { b.classList.remove('active'); });
                btn.classList.add('active');
                var theme = btn.dataset.theme;
                var customRow = container.querySelector('#param-custom-accent-row');
                if (customRow) customRow.style.display = theme === 'custom' ? 'flex' : 'none';
                appliquerAffichageDepuisFormulaire(container);
            });
        });

        var accentInput = container.querySelector('#param-couleur-accent');
        if (accentInput) {
            accentInput.addEventListener('input', function() {
                var customBtn = container.querySelector('.color-preset[data-theme="custom"]');
                if (customBtn) {
                    colorPresets.forEach(function(b) { b.classList.remove('active'); });
                    customBtn.classList.add('active');
                }
                appliquerAffichageDepuisFormulaire(container);
            });
        }

        var densiteSelect = container.querySelector('#param-densite');
        if (densiteSelect) {
            densiteSelect.addEventListener('change', function() { appliquerDensite(this.value); });
        }

        var LOOKS = {
            classique: { couleurTheme: 'defaut', ambiance: 'none', chromeStyle: 'uni', fondIntensite: 'moyen' },
            campus: { couleurTheme: 'defaut', ambiance: 'eprof', chromeStyle: 'texture', fondIntensite: 'faible' },
            lycee: { couleurTheme: 'ocean', ambiance: 'lycee', chromeStyle: 'degrade', fondIntensite: 'moyen' },
            nature: { couleurTheme: 'foret', ambiance: 'chlorofil', chromeStyle: 'uni', fondIntensite: 'faible' },
            atelier: { couleurTheme: 'crepuscule', ambiance: 'losanges', chromeStyle: 'degrade', fondIntensite: 'moyen' }
        };

        container.querySelectorAll('#param-looks .look-chip').forEach(function(chip) {
            chip.addEventListener('click', function() {
                var look = LOOKS[chip.dataset.look];
                if (!look) return;
                container.querySelectorAll('#param-looks .look-chip').forEach(function(c) { c.classList.remove('active'); });
                chip.classList.add('active');
                var colorBtn = container.querySelector('.color-preset[data-theme="' + look.couleurTheme + '"]');
                if (colorBtn) {
                    colorPresets.forEach(function(b) { b.classList.remove('active'); });
                    colorBtn.classList.add('active');
                }
                var ambBtn = container.querySelector('.ambiance-card[data-ambiance="' + look.ambiance + '"]');
                if (ambBtn) {
                    container.querySelectorAll('.ambiance-card').forEach(function(b) { b.classList.remove('active'); });
                    ambBtn.classList.add('active');
                }
                var chromeSel = container.querySelector('#param-chrome-style');
                var intensiteSel = container.querySelector('#param-fond-intensite');
                if (chromeSel) chromeSel.value = look.chromeStyle;
                if (intensiteSel) intensiteSel.value = look.fondIntensite;
                var persoRow = container.querySelector('#param-fond-perso-row');
                if (persoRow) persoRow.style.display = look.ambiance === 'custom' ? 'flex' : 'none';
                appliquerAffichageDepuisFormulaire(container);
            });
        });

        container.querySelectorAll('#param-ambiance .ambiance-card').forEach(function(btn) {
            btn.addEventListener('click', function() {
                container.querySelectorAll('.ambiance-card').forEach(function(b) { b.classList.remove('active'); });
                btn.classList.add('active');
                var persoRow = container.querySelector('#param-fond-perso-row');
                if (persoRow) persoRow.style.display = btn.dataset.ambiance === 'custom' ? 'flex' : 'none';
                appliquerAffichageDepuisFormulaire(container);
            });
        });

        var intensiteSel = container.querySelector('#param-fond-intensite');
        if (intensiteSel) intensiteSel.addEventListener('change', function() { appliquerAffichageDepuisFormulaire(container); });
        var chromeSel = container.querySelector('#param-chrome-style');
        if (chromeSel) chromeSel.addEventListener('change', function() { appliquerAffichageDepuisFormulaire(container); });

        var fondInput = container.querySelector('#param-fond-perso');
        if (fondInput && window.EprofTheme) {
            fondInput.addEventListener('change', function() {
                var file = fondInput.files && fondInput.files[0];
                if (!file) return;
                window.EprofTheme.compressImageFile(file, 1400, 0.62).then(function(dataUrl) {
                    if (!window.EprofTheme.saveFondPerso(dataUrl)) {
                        alert('Image trop lourde pour être mémorisée. Choisissez un fichier plus petit.');
                        return;
                    }
                    var customCard = container.querySelector('.ambiance-card[data-ambiance="custom"]');
                    if (customCard) customCard.click();
                    else appliquerAffichageDepuisFormulaire(container);
                }).catch(function() {
                    alert('Impossible de lire cette image.');
                });
            });
        }
        var fondClear = container.querySelector('#param-fond-perso-clear');
        if (fondClear && window.EprofTheme) {
            fondClear.addEventListener('click', function() {
                window.EprofTheme.saveFondPerso('');
                appliquerAffichageDepuisFormulaire(container);
            });
        }

        const btnChangerIdentifiant = container.querySelector('#btn-changer-identifiant');
        if (btnChangerIdentifiant) {
            btnChangerIdentifiant.addEventListener('click', async function() {
                if (!window.EprofStore || !(await window.EprofStore.isOnlineReady())) {
                    afficherMessageCompte('☁️ Connectez-vous à votre compte eProf pour changer votre identifiant.', false);
                    return;
                }
                const nouvelIdentifiant = container.querySelector('#param-nouvel-identifiant').value.trim().toLowerCase();
                if (!nouvelIdentifiant) {
                    afficherMessageCompte('⚠️ Saisissez un nouvel identifiant.', false);
                    return;
                }
                try {
                    await window.teacherManager.changeIdentifiant(nouvelIdentifiant);
                    afficherMessageCompte(`✅ Identifiant changé pour "${nouvelIdentifiant}". Reconnectez-vous avec ce nouvel identifiant si nécessaire.`, true);
                } catch (error) {
                    afficherMessageCompte('❌ ' + error.message, false);
                }
            });
        }

        const btnChangerMdp = container.querySelector('#btn-changer-mdp');
        if (btnChangerMdp) {
            btnChangerMdp.addEventListener('click', async function() {
                if (!window.EprofStore || !(await window.EprofStore.isOnlineReady())) {
                    afficherMessageCompte('☁️ Connectez-vous à votre compte eProf pour changer votre mot de passe.', false);
                    return;
                }
                const nouveauMdp = container.querySelector('#param-nouveau-mdp').value;
                const confirmMdp = container.querySelector('#param-confirmer-mdp').value;
                if (!nouveauMdp || nouveauMdp.length < 8) {
                    afficherMessageCompte('⚠️ Le mot de passe doit contenir au moins 8 caractères.', false);
                    return;
                }
                if (nouveauMdp !== confirmMdp) {
                    afficherMessageCompte('⚠️ Les deux mots de passe ne correspondent pas.', false);
                    return;
                }
                try {
                    await window.teacherManager.changePassword(nouveauMdp);
                    container.querySelector('#param-nouveau-mdp').value = '';
                    container.querySelector('#param-confirmer-mdp').value = '';
                    afficherMessageCompte('✅ Mot de passe changé avec succès.', true);
                } catch (error) {
                    afficherMessageCompte('❌ ' + error.message, false);
                }
            });
        }

        const btnDeconnexion = container.querySelector('#btn-deconnexion');
        if (btnDeconnexion) {
            btnDeconnexion.addEventListener('click', function() {
                if (window.teacherManager) {
                    window.teacherManager.logout();
                }
            });
        }

        const MENTION_EMOJIS = ['🏆', '🥇', '🌟', '⭐', '😃', '😊', '🙂', '😐', '😕', '😟', '📈', '📉', '📚', '💪', '👍', '👎', '✅', '⚠️', '🔥', '🎯'];

        function getEchelleNotation() {
            return container.querySelector('#param-systeme-notation').value === 'sur10' ? 10 : 20;
        }

        function renderMentionsList() {
            const list = container.querySelector('#mentions-list');
            if (!list) return;

            const echelle = getEchelleNotation();
            const mentions = parametres.notation.mentions
                .slice()
                .sort((a, b) => b.seuilMin - a.seuilMin);
            parametres.notation.mentions = mentions;

            list.innerHTML = mentions.map((mention, index) => `
                <div class="mention-row" data-index="${index}" style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap;">
                    <div class="mention-emoji-picker" style="position:relative;">
                        <button type="button" class="mention-emoji-btn" title="Choisir un smiley" style="width:46px;height:40px;font-size:1.2em;border:2px solid #e2e8f0;border-radius:8px;background:#fff;cursor:pointer;">${mention.emoji}</button>
                        <input type="hidden" class="mention-emoji" value="${mention.emoji}">
                        <div class="mention-emoji-panel" style="display:none;position:absolute;z-index:20;top:44px;left:0;background:#fff;border:1px solid #cbd5e1;border-radius:8px;padding:6px;box-shadow:0 8px 20px rgba(15,23,42,.18);width:210px;">
                            ${MENTION_EMOJIS.map(e => `<button type="button" class="mention-emoji-choice" data-emoji="${e}" style="font-size:1.1em;border:none;background:none;cursor:pointer;padding:4px;border-radius:5px;">${e}</button>`).join('')}
                        </div>
                    </div>
                    <input type="text" class="mention-label" value="${mention.label}" placeholder="Nom de la mention" style="flex:1;min-width:140px;padding:8px;border:2px solid #e2e8f0;border-radius:8px;">
                    <label style="display:flex;align-items:center;gap:6px;white-space:nowrap;font-size:0.9em;">
                        à partir de
                        <input type="number" class="mention-seuil" value="${mention.seuilMin}" min="0" max="${echelle}" step="0.5" style="width:70px;padding:8px;border:2px solid #e2e8f0;border-radius:8px;">
                        / ${echelle}
                    </label>
                    <button type="button" class="btn-supprimer-mention" title="Supprimer cette mention" style="background:#ef4444;color:white;border:none;border-radius:6px;padding:8px 10px;cursor:pointer;">🗑️</button>
                </div>
            `).join('');

            list.querySelectorAll('.mention-row').forEach(row => {
                const bouton = row.querySelector('.mention-emoji-btn');
                const panneau = row.querySelector('.mention-emoji-panel');
                const champ = row.querySelector('.mention-emoji');

                bouton.addEventListener('click', function (e) {
                    e.stopPropagation();
                    const ouvert = panneau.style.display === 'block';
                    list.querySelectorAll('.mention-emoji-panel').forEach(p => { p.style.display = 'none'; });
                    panneau.style.display = ouvert ? 'none' : 'block';
                });

                panneau.querySelectorAll('.mention-emoji-choice').forEach(choix => {
                    choix.addEventListener('click', function () {
                        const emoji = this.dataset.emoji;
                        champ.value = emoji;
                        bouton.textContent = emoji;
                        parametres.notation.mentions[parseInt(row.dataset.index, 10)].emoji = emoji;
                        panneau.style.display = 'none';
                    });
                });

                row.querySelector('.btn-supprimer-mention').addEventListener('click', function () {
                    parametres.notation.mentions.splice(parseInt(row.dataset.index, 10), 1);
                    renderMentionsList();
                });
            });
        }

        document.addEventListener('click', function () {
            container.querySelectorAll('.mention-emoji-panel').forEach(p => { p.style.display = 'none'; });
        });

        renderMentionsList();

        const selectSysteme = container.querySelector('#param-systeme-notation');
        let echelleCourante = getEchelleNotation();
        selectSysteme.addEventListener('change', function () {
            const nouvelleEchelle = getEchelleNotation();
            if (nouvelleEchelle !== echelleCourante) {
                const facteur = nouvelleEchelle / echelleCourante;
                parametres.notation.mentions = parametres.notation.mentions.map(m => ({
                    emoji: m.emoji,
                    label: m.label,
                    seuilMin: Math.round(m.seuilMin * facteur * 2) / 2
                }));
                echelleCourante = nouvelleEchelle;
            }
            renderMentionsList();
        });

        const btnAjouterMention = container.querySelector('#btn-ajouter-mention');
        if (btnAjouterMention) {
            btnAjouterMention.addEventListener('click', function() {
                parametres.notation.mentions.push({ emoji: '⭐', label: 'Nouvelle mention', seuilMin: 0 });
                renderMentionsList();
            });
        }

        const btnSauvegarder = container.querySelector('#btn-sauvegarder-parametres');
        btnSauvegarder.addEventListener('click', async function() {
            parametres.enseignant.nom = container.querySelector('#param-nom').value;
            parametres.enseignant.prenom = container.querySelector('#param-prenom').value;
            parametres.enseignant.matiere = container.querySelector('#param-matiere').value;
            parametres.enseignant.email = container.querySelector('#param-email').value;

            parametres.anneeScolaire = container.querySelector('#param-annee').value;

            parametres.calendrier.heureDebut = container.querySelector('#param-heure-debut').value;
            parametres.calendrier.heureFin = container.querySelector('#param-heure-fin').value;
            parametres.calendrier.ligneDebut = container.querySelector('#param-ligne-debut').value;
            parametres.calendrier.ligneFin = container.querySelector('#param-ligne-fin').value;
            parametres.calendrier.pauseMatinDebut = container.querySelector('#param-pause-matin-debut').value;
            parametres.calendrier.pauseMatinFin = container.querySelector('#param-pause-matin-fin').value;
            parametres.calendrier.pauseMidiDebut = container.querySelector('#param-pause-midi-debut').value;
            parametres.calendrier.pauseMidiFin = container.querySelector('#param-pause-midi-fin').value;
            parametres.calendrier.pauseApresDebut = container.querySelector('#param-pause-apres-debut').value;
            parametres.calendrier.pauseApresFin = container.querySelector('#param-pause-apres-fin').value;
            parametres.calendrier.afficherSamedi = container.querySelector('#param-afficher-samedi').checked;
            delete parametres.calendrier.dureeCoursDefaut;
            delete parametres.periodes;

            parametres.affichage.theme = container.querySelector('#param-theme').value;
            parametres.affichage.taillePolice = container.querySelector('#param-taille-police').value;
            parametres.affichage.modeMobile = container.querySelector('#param-mode-mobile').value;
            var activePreset = container.querySelector('#param-couleur-theme .color-preset.active');
            parametres.affichage.couleurTheme = activePreset ? activePreset.dataset.theme : 'defaut';
            parametres.affichage.couleurAccent = container.querySelector('#param-couleur-accent').value || '';
            parametres.affichage.densite = container.querySelector('#param-densite').value;
            var activeAmbiance = container.querySelector('#param-ambiance .ambiance-card.active');
            parametres.affichage.ambiance = activeAmbiance ? activeAmbiance.dataset.ambiance : 'none';
            parametres.affichage.fondIntensite = container.querySelector('#param-fond-intensite').value;
            parametres.affichage.chromeStyle = container.querySelector('#param-chrome-style').value;

            parametres.alertes.seuilOublis = parseInt(container.querySelector('#param-seuil-oublis').value, 10);
            parametres.alertes.seuilMots = parseInt(container.querySelector('#param-seuil-mots').value, 10);

            parametres.notation.systeme = container.querySelector('#param-systeme-notation').value;
            parametres.notation.echelle = getEchelleNotation();
            parametres.notation.mentions = Array.from(container.querySelectorAll('.mention-row')).map(row => ({
                emoji: row.querySelector('.mention-emoji').value.trim() || '⭐',
                label: row.querySelector('.mention-label').value.trim() || 'Mention',
                seuilMin: parseFloat(row.querySelector('.mention-seuil').value) || 0
            }));

            localStorage.setItem('parametres', JSON.stringify(parametres));

            appliquerTheme(parametres.affichage.theme);
            appliquerCouleurTheme(parametres.affichage.couleurTheme, parametres.affichage.couleurAccent);
            appliquerDensite(parametres.affichage.densite);
            appliquerTaillePolice(parametres.affichage.taillePolice);
            appliquerModeMobile(parametres.affichage.modeMobile);

            if (window.EprofStore && await window.EprofStore.isOnlineReady()) {
                const teacherId = await window.EprofStore.getTeacherId();
                const { error } = await window.EprofStore.upsert('profiles', [{
                    id: teacherId,
                    nom: parametres.enseignant.nom,
                    prenom: parametres.enseignant.prenom,
                    matiere: parametres.enseignant.matiere,
                    email: parametres.enseignant.email
                }], { onConflict: 'id' });
                if (error) {
                    console.error('❌ Synchronisation du profil en ligne échouée', error);
                }
            }

            alert('✅ Paramètres enregistrés avec succès !');
        });

        const btnImporter = container.querySelector('#btn-importer-donnees');
        const fichierInput = container.querySelector('#fichier-import');

        btnImporter.addEventListener('click', function() {
            fichierInput.click();
        });

        fichierInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(event) {
                try {
                    const donnees = JSON.parse(event.target.result);

                    if (confirm('⚠️ Attention : l\'importation remplacera les données correspondantes. Continuer ?')) {
                        if (donnees.parametres) localStorage.setItem('parametres', JSON.stringify(donnees.parametres));
                        if (donnees.suiviEleves) localStorage.setItem('suiviEleves', JSON.stringify(donnees.suiviEleves));
                        if (donnees.suiviTableaux) localStorage.setItem('suiviTableaux', JSON.stringify(donnees.suiviTableaux));
                        if (donnees.jeuxPedagogiques) localStorage.setItem('jeuxPedagogiques', JSON.stringify(donnees.jeuxPedagogiques));
                        if (donnees.ressourcesPedagogiques) localStorage.setItem('ressourcesPedagogiques', JSON.stringify(donnees.ressourcesPedagogiques));
                        if (donnees.calendrier) localStorage.setItem('calendrier', JSON.stringify(donnees.calendrier));

                        alert('✅ Données importées avec succès ! La page va se recharger.');
                        location.reload();
                    }
                } catch (error) {
                    alert('❌ Erreur lors de l\'importation : fichier invalide.');
                }
            };
            reader.readAsText(file);
        });

        const btnResetPrefs = container.querySelector('#btn-reset-prefs');
        if (btnResetPrefs) {
            btnResetPrefs.addEventListener('click', function () {
                if (!confirm('Réinitialiser les préférences (thème, horaires, barème, seuils) ? Votre profil enseignant est conservé.')) {
                    return;
                }
                const reset = defaultAppParametres(parametres.enseignant);
                localStorage.setItem('parametres', JSON.stringify(reset));
                appliquerTheme(reset.affichage.theme);
                appliquerCouleurTheme(reset.affichage.couleurTheme, reset.affichage.couleurAccent);
                appliquerDensite(reset.affichage.densite);
                appliquerTaillePolice(reset.affichage.taillePolice);
                appliquerModeMobile(reset.affichage.modeMobile);
                alert('✅ Préférences réinitialisées. La page va se recharger.');
                location.reload();
            });
        }

        const btnResetLocal = container.querySelector('#btn-reset-local');
        if (btnResetLocal) {
            btnResetLocal.addEventListener('click', function () {
                if (!confirm('⚠️ Cette action supprime les données locales de l’application sur cet appareil (suivi, calendrier, jeux…). Le compte reste connecté.')) {
                    return;
                }
                const confirmation = window.prompt('Pour confirmer, tapez SUPPRIMER :');
                if (confirmation !== 'SUPPRIMER') {
                    alert('Annulé.');
                    return;
                }
                const keys = [];
                for (let i = 0; i < localStorage.length; i++) {
                    keys.push(localStorage.key(i));
                }
                keys.forEach(function (k) {
                    if (!k || isProtectedLocalStorageKey(k)) return;
                    localStorage.removeItem(k);
                });
                alert('✅ Données locales effacées. La page va se recharger.');
                location.reload();
            });
        }

        appliquerTheme(parametres.affichage.theme);
        appliquerCouleurTheme(parametres.affichage.couleurTheme, parametres.affichage.couleurAccent);
        appliquerDensite(parametres.affichage.densite);
        appliquerTaillePolice(parametres.affichage.taillePolice);
        appliquerModeMobile(parametres.affichage.modeMobile);
    }

    // Fonction pour mettre à jour les informations dans le header
    // Fonctions pour appliquer le thème et la taille de police
    function appliquerAffichageDepuisFormulaire(container) {
        container = container || document;
        var themeSelect = container.querySelector('#param-theme');
        var sombre = themeSelect ? themeSelect.value === 'sombre' : document.body.classList.contains('theme-sombre');
        document.body.classList.toggle('theme-sombre', sombre);
        document.documentElement.classList.toggle('theme-sombre', sombre);
        var preset = container.querySelector('#param-couleur-theme .color-preset.active');
        var amb = container.querySelector('#param-ambiance .ambiance-card.active');
        if (window.EprofTheme) {
            window.EprofTheme.apply(
                preset ? preset.dataset.theme : 'defaut',
                (container.querySelector('#param-couleur-accent') || {}).value || '',
                sombre,
                {
                    ambiance: amb ? amb.dataset.ambiance : 'none',
                    fondIntensite: (container.querySelector('#param-fond-intensite') || {}).value || 'moyen',
                    chromeStyle: (container.querySelector('#param-chrome-style') || {}).value || 'uni',
                    fondPersoUrl: window.EprofTheme.readFondPerso()
                }
            );
        }
    }

    function appliquerTheme(theme) {
        var form = document.getElementById('parametres-module');
        if (form && form.querySelector('#param-theme')) {
            appliquerAffichageDepuisFormulaire(form);
            return;
        }
        document.body.classList.toggle('theme-sombre', theme === 'sombre');
        document.documentElement.classList.toggle('theme-sombre', theme === 'sombre');
        if (window.EprofTheme) window.EprofTheme.applyFromStorage();
    }

    function appliquerCouleurTheme(couleurTheme, couleurAccent) {
        var form = document.getElementById('parametres-module');
        if (form && form.querySelector('#param-couleur-theme')) {
            appliquerAffichageDepuisFormulaire(form);
            return;
        }
        var sombre = document.body.classList.contains('theme-sombre');
        if (window.EprofTheme) {
            window.EprofTheme.apply(couleurTheme || 'defaut', couleurAccent || '', sombre, {
                fondPersoUrl: window.EprofTheme.readFondPerso()
            });
        }
    }

    function appliquerDensite(densite) {
        document.body.classList.remove('densite-compact', 'densite-confortable');
        if (densite === 'compact') document.body.classList.add('densite-compact');
        else if (densite === 'confortable') document.body.classList.add('densite-confortable');
    }

    function appliquerTaillePolice(taille) {
        document.body.classList.remove('taille-petit', 'taille-moyen', 'taille-grand');
        document.body.classList.add(`taille-${taille}`);
    }

    function appliquerModeMobile(mode) {
        document.body.classList.remove('mode-mobile-force', 'mode-mobile-off');
        if (mode === 'active') {
            document.body.classList.add('mode-mobile-force');
        } else if (mode === 'inactive') {
            document.body.classList.add('mode-mobile-off');
        }
        // mode 'auto' : aucune classe forcée, les media queries gèrent l'adaptation
    }

});

