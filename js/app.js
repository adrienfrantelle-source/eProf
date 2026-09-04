document.addEventListener('DOMContentLoaded', () => {
    const mainContent = document.getElementById('main-content');

    function getAppVersionInfo() {
        return { version: 'V2.5.18' };
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
        if (mainContent) mainContent.innerHTML = '';
    }
    document.addEventListener('eprof-session-ready', startAppShell);
    document.addEventListener('eprof-session-lost', resetAppShell);
    window.addEventListener('teacherLoggedIn', function () {
        if (appShellReady && document.getElementById('home-upcoming')) showDashboard();
    });
    if (!document.body.classList.contains('eprof-locked')) startAppShell();

    function showDashboard() {
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

    // Les listes d'élèves arrivent de façon asynchrone : on re-rend l'outil affiché.
    document.addEventListener('eprof-referentiel-maj', function () {
        if (['eleves', 'trombinoscopes', 'plan-classe'].includes(outilCourant)) {
            handleDashboardTool(outilCourant);
        }
    });

    function handleDashboardTool(tool, extra) {
        outilCourant = tool;
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
            case 'sejour':
            case 'drive':
            case 'stage':
            case 'quiz':
            case 'conseil':
            case 'cahier':
                mainContent.innerHTML = '<h2>Module retiré</h2><p>Ce module n’est plus actif dans la version courante de eProf.</p>';
                highlightSidebar('dashboard-link');
                break;
            default:
                mainContent.innerHTML = '<h2>Fonctionnalité à venir</h2>';
        }
    }

    window.EprofElevesOpenTool = handleDashboardTool;

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
    // GESTION DE SÉJOURS
    // ========================================
    function renderSejourModule(container) {
        // Charger les séjours depuis le fichier portable ou localStorage
        let sejours = [];
        
        if (typeof SEJOURS_DATA !== 'undefined' && Array.isArray(SEJOURS_DATA) && SEJOURS_DATA.length > 0) {
            sejours = [...SEJOURS_DATA];
        } else {
            sejours = JSON.parse(localStorage.getItem('sejoursPedagogiques') || '[]');
        }

        // Injecter le CSS
        if (!document.querySelector('link[href*="sejour.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'css/sejour.css';
            document.head.appendChild(link);
        }

        container.innerHTML = `
            <div class="sejour-module">
                <div class="sejour-header">
                    <h2>🏕️ Gestion de Séjours Pédagogiques</h2>
                    <div class="sejour-controls">
                        <button class="btn-sejour btn-secondary-sejour" id="save-sejours-btn">
                            💾 Sauvegarder
                        </button>
                        <button class="btn-sejour btn-secondary-sejour" id="restore-sejours-btn">
                            📂 Restaurer
                        </button>
                        <input type="file" id="restore-sejours-file" accept=".js" style="display: none;">
                        <button class="btn-sejour btn-primary-sejour" id="new-sejour-btn">
                            ➕ Nouveau séjour
                        </button>
                    </div>
                </div>
                
                <div id="sejours-list"></div>
                
                <div id="sejour-detail" style="display: none;"></div>
            </div>
            
            <!-- Modal nouveau/modifier séjour -->
            <div class="modal-sejour" id="modal-sejour">
                <div class="modal-content-sejour">
                    <div class="modal-header-sejour">
                        <h3 id="modal-title-sejour">Nouveau séjour</h3>
                        <button class="close-modal-sejour" onclick="closeSejourModal()">✖</button>
                    </div>
                    <form class="form-sejour" id="form-sejour">
                        <div class="form-group-sejour">
                            <label for="sejour-titre">Titre du séjour *</label>
                            <input type="text" id="sejour-titre" required placeholder="Ex: Voyage à Paris">
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group-sejour">
                                <label for="sejour-destination">Destination *</label>
                                <input type="text" id="sejour-destination" required placeholder="Ex: Paris, France">
                            </div>
                            <div class="form-group-sejour">
                                <label for="sejour-classe">Classe *</label>
                                <select id="sejour-classe" required>
                                    <option value="">-- Sélectionner --</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group-sejour">
                                <label for="sejour-date-debut">Date de début *</label>
                                <input type="date" id="sejour-date-debut" required>
                            </div>
                            <div class="form-group-sejour">
                                <label for="sejour-date-fin">Date de fin *</label>
                                <input type="date" id="sejour-date-fin" required>
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group-sejour">
                                <label for="sejour-budget">Budget total (€)</label>
                                <input type="number" id="sejour-budget" min="0" step="0.01" placeholder="5000">
                            </div>
                            <div class="form-group-sejour">
                                <label for="sejour-participants-nb">Nombre de participants</label>
                                <input type="number" id="sejour-participants-nb" min="1" placeholder="30">
                            </div>
                        </div>
                        
                        <div class="form-group-sejour">
                            <label for="sejour-coordonnees">Coordonnées GPS (lat, lng)</label>
                            <input type="text" id="sejour-coordonnees" placeholder="48.8566, 2.3522">
                        </div>
                        
                        <div class="form-group-sejour">
                            <label for="sejour-hebergement">Hébergement</label>
                            <input type="text" id="sejour-hebergement" placeholder="Nom de l'hôtel ou auberge">
                        </div>
                        
                        <div class="form-group-sejour">
                            <label for="sejour-transport">Transport</label>
                            <input type="text" id="sejour-transport" placeholder="Bus, train, avion...">
                        </div>
                        
                        <div class="form-group-sejour">
                            <label for="sejour-notes">Notes / Remarques</label>
                            <textarea id="sejour-notes" rows="4" placeholder="Informations complémentaires..."></textarea>
                        </div>
                        
                        <div class="modal-actions">
                            <button type="button" class="btn-sejour btn-secondary-sejour" onclick="closeSejourModal()">Annuler</button>
                            <button type="submit" class="btn-sejour btn-primary-sejour">Enregistrer</button>
                        </div>
                    </form>
                </div>
            </div>
            
            <!-- Modal Ajouter Dépense -->
            <div class="modal-sejour" id="modal-depense">
                <div class="modal-content-sejour">
                    <div class="modal-header-sejour">
                        <h3>💰 Ajouter une dépense</h3>
                        <button class="close-modal-sejour" onclick="closeDepenseModal()">✖</button>
                    </div>
                    <form class="form-sejour" id="form-depense">
                        <div class="form-group-sejour">
                            <label for="depense-libelle">Libellé *</label>
                            <input type="text" id="depense-libelle" required placeholder="Ex: Transport en bus">
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group-sejour">
                                <label for="depense-montant">Montant (€) *</label>
                                <input type="number" id="depense-montant" min="0" step="0.01" required placeholder="0.00">
                            </div>
                            <div class="form-group-sejour">
                                <label for="depense-categorie">Catégorie</label>
                                <select id="depense-categorie">
                                    <option value="Transport">Transport</option>
                                    <option value="Hébergement">Hébergement</option>
                                    <option value="Restauration">Restauration</option>
                                    <option value="Activités">Activités</option>
                                    <option value="Matériel">Matériel</option>
                                    <option value="Autre">Autre</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="form-group-sejour">
                            <label for="depense-date">Date de la dépense</label>
                            <input type="date" id="depense-date">
                        </div>
                        
                        <div class="form-group-sejour">
                            <label for="depense-notes">Notes / Remarques</label>
                            <textarea id="depense-notes" rows="3" placeholder="Informations complémentaires..."></textarea>
                        </div>
                        
                        <div class="modal-actions">
                            <button type="button" class="btn-sejour btn-secondary-sejour" onclick="closeDepenseModal()">Annuler</button>
                            <button type="submit" class="btn-sejour btn-primary-sejour">Ajouter</button>
                        </div>
                    </form>
                </div>
            </div>
            
            <!-- Modal Ajouter Activité -->
            <div class="modal-sejour" id="modal-activite">
                <div class="modal-content-sejour">
                    <div class="modal-header-sejour">
                        <h3>📋 Ajouter une activité</h3>
                        <button class="close-modal-sejour" onclick="closeActiviteModal()">✖</button>
                    </div>
                    <form class="form-sejour" id="form-activite">
                        <div class="form-group-sejour">
                            <label for="activite-nom">Nom de l'activité *</label>
                            <input type="text" id="activite-nom" required placeholder="Ex: Visite du Louvre">
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group-sejour">
                                <label for="activite-date">Date</label>
                                <input type="date" id="activite-date">
                            </div>
                            <div class="form-group-sejour">
                                <label for="activite-horaire">Horaire</label>
                                <input type="text" id="activite-horaire" placeholder="Ex: 10h00 - 12h00">
                            </div>
                        </div>
                        
                        <div class="form-group-sejour">
                            <label for="activite-lieu">Lieu</label>
                            <input type="text" id="activite-lieu" placeholder="Ex: Musée du Louvre, Paris">
                        </div>
                        
                        <div class="form-group-sejour">
                            <label for="activite-description">Description</label>
                            <textarea id="activite-description" rows="4" placeholder="Détails de l'activité..."></textarea>
                        </div>
                        
                        <div class="form-group-sejour">
                            <label for="activite-cout">Coût par personne (€)</label>
                            <input type="number" id="activite-cout" min="0" step="0.01" placeholder="0.00">
                        </div>
                        
                        <div class="modal-actions">
                            <button type="button" class="btn-sejour btn-secondary-sejour" onclick="closeActiviteModal()">Annuler</button>
                            <button type="submit" class="btn-sejour btn-primary-sejour">Ajouter</button>
                        </div>
                    </form>
                </div>
            </div>
            
            <!-- Modal Ajouter Revenu -->
            <div class="modal-sejour" id="modal-revenu">
                <div class="modal-content-sejour">
                    <div class="modal-header-sejour">
                        <h3>💰 Ajouter un revenu</h3>
                        <button class="close-modal-sejour" onclick="closeRevenuModal()">✖</button>
                    </div>
                    <form class="form-sejour" id="form-revenu">
                        <div class="form-group-sejour">
                            <label for="revenu-libelle">Libellé *</label>
                            <input type="text" id="revenu-libelle" required placeholder="Ex: Vente de gâteaux">
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group-sejour">
                                <label for="revenu-montant">Montant (€) *</label>
                                <input type="number" id="revenu-montant" min="0" step="0.01" required placeholder="0.00">
                            </div>
                            <div class="form-group-sejour">
                                <label for="revenu-source">Source</label>
                                <select id="revenu-source">
                                    <option value="Vente">Vente</option>
                                    <option value="Subvention">Subvention</option>
                                    <option value="Aide">Aide</option>
                                    <option value="Don">Don</option>
                                    <option value="Participation familles">Participation familles</option>
                                    <option value="Autre">Autre</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="form-group-sejour">
                            <label for="revenu-date">Date de réception</label>
                            <input type="date" id="revenu-date">
                        </div>
                        
                        <div class="form-group-sejour">
                            <label for="revenu-notes">Notes / Remarques</label>
                            <textarea id="revenu-notes" rows="3" placeholder="Informations complémentaires..."></textarea>
                        </div>
                        
                        <div class="modal-actions">
                            <button type="button" class="btn-sejour btn-secondary-sejour" onclick="closeRevenuModal()">Annuler</button>
                            <button type="submit" class="btn-sejour btn-primary-sejour">Ajouter</button>
                        </div>
                    </form>
                </div>
            </div>
            
            <!-- Modal Ajouter Participant -->
            <div class="modal-sejour" id="modal-participant">
                <div class="modal-content-sejour">
                    <div class="modal-header-sejour">
                        <h3>👤 Ajouter un participant</h3>
                        <button class="close-modal-sejour" onclick="closeParticipantModal()">✖</button>
                    </div>
                    <form class="form-sejour" id="form-participant">
                        <div class="form-row">
                            <div class="form-group-sejour">
                                <label for="participant-nom">Nom *</label>
                                <input type="text" id="participant-nom" required placeholder="Nom">
                            </div>
                            <div class="form-group-sejour">
                                <label for="participant-prenom">Prénom</label>
                                <input type="text" id="participant-prenom" placeholder="Prénom">
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group-sejour">
                                <label for="participant-role">Rôle</label>
                                <select id="participant-role">
                                    <option value="Élève">Élève</option>
                                    <option value="Accompagnateur">Accompagnateur</option>
                                    <option value="Enseignant">Enseignant</option>
                                    <option value="Autre">Autre</option>
                                </select>
                            </div>
                            <div class="form-group-sejour">
                                <label for="participant-email">Email</label>
                                <input type="email" id="participant-email" placeholder="email@exemple.fr">
                            </div>
                        </div>
                        
                        <div class="form-group-sejour">
                            <label for="participant-telephone">Téléphone</label>
                            <input type="tel" id="participant-telephone" placeholder="06 12 34 56 78">
                        </div>
                        
                        <div class="form-group-sejour">
                            <label for="participant-notes">Notes</label>
                            <textarea id="participant-notes" rows="3" placeholder="Régime alimentaire, allergies, remarques..."></textarea>
                        </div>
                        
                        <div class="modal-actions">
                            <button type="button" class="btn-sejour btn-secondary-sejour" onclick="closeParticipantModal()">Annuler</button>
                            <button type="submit" class="btn-sejour btn-primary-sejour">Ajouter</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        // Charger les classes dans le select
        const classeSelect = container.querySelector('#sejour-classe');
        if (typeof LISTES_ELEVES !== 'undefined') {
            Object.keys(LISTES_ELEVES).forEach(classe => {
                const option = document.createElement('option');
                option.value = classe;
                option.textContent = classe;
                classeSelect.appendChild(option);
            });
        }

        // Fonctions
        function afficherSejours() {
            const listContainer = container.querySelector('#sejours-list');
            
            if (sejours.length === 0) {
                listContainer.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">🏕️</div>
                        <h3>Aucun séjour organisé</h3>
                        <p>Commencez par créer votre premier séjour pédagogique !</p>
                    </div>
                `;
                return;
            }

            listContainer.innerHTML = `
                <div class="sejours-grid">
                    ${sejours.map(sejour => {
                        const dateDebut = new Date(sejour.dateDebut).toLocaleDateString('fr-FR');
                        const dateFin = new Date(sejour.dateFin).toLocaleDateString('fr-FR');
                        const budget = sejour.budget?.total || 0;
                        const reste = sejour.budget?.reste !== undefined ? sejour.budget.reste : budget;
                        
                        return `
                            <div class="sejour-card" data-id="${sejour.id}">
                                <div class="sejour-card-header">
                                    <div>
                                        <h3 class="sejour-titre">${sejour.titre}</h3>
                                        <div class="sejour-destination">
                                            📍 ${sejour.destination}
                                        </div>
                                    </div>
                                    <span class="sejour-classe">${sejour.classe}</span>
                                </div>
                                <div class="sejour-dates">
                                    📅 ${dateDebut} → ${dateFin}
                                </div>
                                <div class="sejour-info-row">
                                    <span>👥 ${sejour.participants?.length || sejour.participantsNb || 0} participants</span>
                                    <span class="sejour-budget">${budget.toFixed(2)}€</span>
                                </div>
                                ${reste < budget ? `
                                    <div class="sejour-info-row">
                                        <span style="color: #64748b;">Reste :</span>
                                        <span class="sejour-budget" style="color: ${reste >= 0 ? '#059669' : '#dc2626'}">
                                            ${reste.toFixed(2)}€
                                        </span>
                                    </div>
                                ` : ''}
                                <div class="sejour-actions">
                                    <button class="btn-action-sejour btn-voir" onclick="voirSejourDetail('${sejour.id}')">
                                        👁️ Voir
                                    </button>
                                    <button class="btn-action-sejour btn-modifier" onclick="modifierSejour('${sejour.id}')">
                                        ✏️ Modifier
                                    </button>
                                    <button class="btn-action-sejour btn-supprimer" onclick="supprimerSejour('${sejour.id}')">
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }

        // Sauvegarder les séjours
        function sauvegarderSejours() {
            localStorage.setItem('sejoursPedagogiques', JSON.stringify(sejours));
        }

        // Événements
        const newSejourBtn = container.querySelector('#new-sejour-btn');
        const saveSejoursBtn = container.querySelector('#save-sejours-btn');
        const restoreSejoursBtn = container.querySelector('#restore-sejours-btn');
        const restoreFileInput = container.querySelector('#restore-sejours-file');
        const formSejour = container.querySelector('#form-sejour');

        newSejourBtn.addEventListener('click', () => {
            openSejourModal();
        });

        saveSejoursBtn.addEventListener('click', () => {
            exportSejours();
        });

        restoreSejoursBtn.addEventListener('click', () => {
            restoreFileInput.click();
        });

        restoreFileInput.addEventListener('change', async (e) => {
            await importSejours(e);
        });

        formSejour.addEventListener('submit', (e) => {
            e.preventDefault();
            saveSejour();
        });

        // Fonctions globales (accessibles depuis le HTML)
        window.openSejourModal = function(sejourId = null) {
            const modal = container.querySelector('#modal-sejour');
            const form = container.querySelector('#form-sejour');
            const modalTitle = container.querySelector('#modal-title-sejour');
            
            form.reset();
            form.dataset.sejourId = sejourId || '';
            
            if (sejourId) {
                modalTitle.textContent = 'Modifier le séjour';
                const sejour = sejours.find(s => s.id === sejourId);
                if (sejour) {
                    container.querySelector('#sejour-titre').value = sejour.titre;
                    container.querySelector('#sejour-destination').value = sejour.destination;
                    container.querySelector('#sejour-classe').value = sejour.classe;
                    container.querySelector('#sejour-date-debut').value = sejour.dateDebut;
                    container.querySelector('#sejour-date-fin').value = sejour.dateFin;
                    container.querySelector('#sejour-budget').value = sejour.budget?.total || '';
                    container.querySelector('#sejour-participants-nb').value = sejour.participantsNb || '';
                    container.querySelector('#sejour-hebergement').value = sejour.hebergement?.nom || '';
                    container.querySelector('#sejour-transport').value = sejour.transport?.type || '';
                    container.querySelector('#sejour-notes').value = sejour.notes || '';
                    
                    if (sejour.coordonnees) {
                        container.querySelector('#sejour-coordonnees').value = `${sejour.coordonnees.lat}, ${sejour.coordonnees.lng}`;
                    }
                }
            } else {
                modalTitle.textContent = 'Nouveau séjour';
            }
            
            modal.classList.add('active');
        };

        window.closeSejourModal = function() {
            const modal = container.querySelector('#modal-sejour');
            modal.classList.remove('active');
        };

        window.saveSejour = function() {
            const form = container.querySelector('#form-sejour');
            const sejourId = form.dataset.sejourId;
            
            const coordonneesText = container.querySelector('#sejour-coordonnees').value.trim();
            let coordonnees = null;
            if (coordonneesText) {
                const parts = coordonneesText.split(',').map(p => parseFloat(p.trim()));
                if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                    coordonnees = { lat: parts[0], lng: parts[1] };
                }
            }
            
            const sejourData = {
                id: sejourId || 'sejour_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                titre: container.querySelector('#sejour-titre').value.trim(),
                destination: container.querySelector('#sejour-destination').value.trim(),
                classe: container.querySelector('#sejour-classe').value,
                dateDebut: container.querySelector('#sejour-date-debut').value,
                dateFin: container.querySelector('#sejour-date-fin').value,
                budget: {
                    total: parseFloat(container.querySelector('#sejour-budget').value) || 0,
                    depenses: [],
                    revenus: [],
                    reste: parseFloat(container.querySelector('#sejour-budget').value) || 0
                },
                participantsNb: parseInt(container.querySelector('#sejour-participants-nb').value) || 0,
                participants: [],
                programme: [],
                hebergement: {
                    nom: container.querySelector('#sejour-hebergement').value.trim()
                },
                transport: {
                    type: container.querySelector('#sejour-transport').value.trim()
                },
                coordonnees: coordonnees,
                documents: [],
                notes: container.querySelector('#sejour-notes').value.trim()
            };
            
            if (sejourId) {
                const index = sejours.findIndex(s => s.id === sejourId);
                if (index !== -1) {
                    sejours[index] = { ...sejours[index], ...sejourData };
                }
            } else {
                sejours.push(sejourData);
            }
            
            sauvegarderSejours();
            afficherSejours();
            closeSejourModal();
        };

        window.modifierSejour = function(sejourId) {
            openSejourModal(sejourId);
        };

        window.supprimerSejour = function(sejourId) {
            const sejour = sejours.find(s => s.id === sejourId);
            if (sejour && confirm(`Supprimer le séjour "${sejour.titre}" ?\n\nCette action est irréversible.`)) {
                sejours = sejours.filter(s => s.id !== sejourId);
                sauvegarderSejours();
                afficherSejours();
            }
        };

        window.voirSejourDetail = function(sejourId) {
            const sejour = sejours.find(s => s.id === sejourId);
            if (!sejour) return;
            
            const listContainer = container.querySelector('#sejours-list');
            const detailContainer = container.querySelector('#sejour-detail');
            
            listContainer.style.display = 'none';
            detailContainer.style.display = 'block';
            
            renderSejourDetail(sejour, detailContainer);
        };

        function renderSejourDetail(sejour, detailContainer) {
            const dateDebut = new Date(sejour.dateDebut).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            const dateFin = new Date(sejour.dateFin).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            
            detailContainer.innerHTML = `
                <div class="sejour-detail">
                    <div class="sejour-detail-header">
                        <div class="sejour-detail-title">
                            <h2>${sejour.titre}</h2>
                            <div class="sejour-detail-subtitle">
                                📍 ${sejour.destination} • <span class="sejour-classe">${sejour.classe}</span>
                            </div>
                            <div style="margin-top: 10px; color: #64748b;">
                                📅 Du ${dateDebut} au ${dateFin}
                            </div>
                        </div>
                        <button class="btn-sejour btn-secondary-sejour" onclick="fermerSejourDetail()">
                            ← Retour à la liste
                        </button>
                    </div>
                    
                    <div class="sejour-tabs">
                        <button class="tab-btn active" onclick="switchTab('vue-generale')">📊 Vue générale</button>
                        <button class="tab-btn" onclick="switchTab('budget')">💰 Budget</button>
                        <button class="tab-btn" onclick="switchTab('carte')">🗺️ Carte</button>
                        <button class="tab-btn" onclick="switchTab('programme')">📋 Programme</button>
                        <button class="tab-btn" onclick="switchTab('participants')">👥 Participants</button>
                    </div>
                    
                    <div id="tab-vue-generale" class="tab-content active">
                        ${renderVueGenerale(sejour)}
                    </div>
                    
                    <div id="tab-budget" class="tab-content">
                        ${renderBudget(sejour)}
                    </div>
                    
                    <div id="tab-carte" class="tab-content">
                        ${renderCarte(sejour)}
                    </div>
                    
                    <div id="tab-programme" class="tab-content">
                        ${renderProgramme(sejour)}
                    </div>
                    
                    <div id="tab-participants" class="tab-content">
                        ${renderParticipants(sejour)}
                    </div>
                </div>
            `;
            
            // Initialiser la carte si des coordonnées existent
            if (sejour.coordonnees) {
                setTimeout(() => initMap(sejour.coordonnees), 500);
            }
        }

        function renderVueGenerale(sejour) {
            const participants = sejour.participants || [];
            const eleves = participants.filter(p => p.role === 'Élève');
            const accompagnateurs = participants.filter(p => p.role === 'Accompagnateur' || p.role === 'Enseignant');
            const totalBudget = (sejour.budget?.total || 0) + (sejour.budget?.revenus || []).reduce((sum, r) => sum + (r.montant || 0), 0);
            const totalDepenses = (sejour.budget?.depenses || []).reduce((sum, d) => sum + (d.montant || 0), 0);
            const coutParEleve = eleves.length > 0 ? totalDepenses / eleves.length : 0;
            
            return `
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
                    <div class="budget-card">
                        <div class="budget-label">Budget total (+ revenus)</div>
                        <div class="budget-value">${totalBudget.toFixed(2)}€</div>
                    </div>
                    <div class="budget-card">
                        <div class="budget-label">Élèves</div>
                        <div class="budget-value">${eleves.length}</div>
                    </div>
                    <div class="budget-card">
                        <div class="budget-label">Accompagnateurs</div>
                        <div class="budget-value">${accompagnateurs.length}</div>
                    </div>
                    <div class="budget-card">
                        <div class="budget-label">Coût par élève</div>
                        <div class="budget-value">${coutParEleve.toFixed(2)}€</div>
                    </div>
                    <div class="budget-card">
                        <div class="budget-label">Durée</div>
                        <div class="budget-value">${Math.ceil((new Date(sejour.dateFin) - new Date(sejour.dateDebut)) / (1000 * 60 * 60 * 24)) + 1} jours</div>
                    </div>
                </div>
                
                <div style="margin-top: 30px; background: #f8fafc; padding: 20px; border-radius: 8px;">
                    <h3 style="margin: 0 0 15px 0; color: #1e293b;">Informations pratiques</h3>
                    ${sejour.hebergement?.nom ? `<p><strong>🏨 Hébergement :</strong> ${sejour.hebergement.nom}</p>` : ''}
                    ${sejour.transport?.type ? `<p><strong>🚌 Transport :</strong> ${sejour.transport.type}</p>` : ''}
                    ${sejour.notes ? `<p><strong>📝 Notes :</strong><br>${sejour.notes}</p>` : ''}
                </div>
            `;
        }

        function renderBudget(sejour) {
            const budget = sejour.budget || { total: 0, depenses: [], revenus: [], reste: 0 };
            const depenses = budget.depenses || [];
            const revenus = budget.revenus || [];
            const totalDepenses = depenses.reduce((sum, d) => sum + (d.montant || 0), 0);
            const totalRevenus = revenus.reduce((sum, r) => sum + (r.montant || 0), 0);
            const budgetTotal = budget.total + totalRevenus;
            const reste = budgetTotal - totalDepenses;
            
            const participants = sejour.participants || [];
            const eleves = participants.filter(p => p.role === 'Élève');
            const coutParEleve = eleves.length > 0 ? totalDepenses / eleves.length : 0;
            
            return `
                <div class="budget-section">
                    <div class="budget-overview">
                        <div class="budget-card">
                            <div class="budget-label">Budget initial</div>
                            <div class="budget-value">${budget.total.toFixed(2)}€</div>
                        </div>
                        <div class="budget-card">
                            <div class="budget-label">Revenus</div>
                            <div class="budget-value" style="color: #10b981;">${totalRevenus.toFixed(2)}€</div>
                        </div>
                        <div class="budget-card">
                            <div class="budget-label">Budget total</div>
                            <div class="budget-value" style="color: #667eea; font-size: 1.5rem;">${budgetTotal.toFixed(2)}€</div>
                        </div>
                        <div class="budget-card">
                            <div class="budget-label">Dépenses</div>
                            <div class="budget-value" style="color: #dc2626;">${totalDepenses.toFixed(2)}€</div>
                        </div>
                        <div class="budget-card">
                            <div class="budget-label">Reste disponible</div>
                            <div class="budget-value ${reste >= 0 ? 'positive' : 'negative'}">${reste.toFixed(2)}€</div>
                        </div>
                        <div class="budget-card">
                            <div class="budget-label">Coût par élève</div>
                            <div class="budget-value" style="color: #f59e0b;">${coutParEleve.toFixed(2)}€</div>
                            <div style="font-size: 0.75rem; color: #64748b; margin-top: 5px;">(${eleves.length} élève${eleves.length > 1 ? 's' : ''})</div>
                        </div>
                    </div>
                    
                    <div class="depenses-list">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                            <h3 style="margin: 0;">💰 Revenus et financements</h3>
                            <button class="btn-sejour btn-primary-sejour" onclick="ajouterRevenu('${sejour.id}')">
                                ➕ Ajouter un revenu
                            </button>
                        </div>
                        
                        ${revenus.length === 0 ? `
                            <p style="text-align: center; color: #64748b; padding: 30px;">
                                Aucun revenu enregistré (ventes, aides, subventions...)
                            </p>
                        ` : revenus.map((r, i) => `
                            <div class="depense-item" style="border-left: 4px solid #10b981;">
                                <div class="depense-info">
                                    <h4>${r.libelle}</h4>
                                    <span class="depense-categorie">${r.source || 'Non catégorisé'}</span>
                                </div>
                                <div class="depense-montant" style="color: #10b981;">+${r.montant.toFixed(2)}€</div>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div class="depenses-list" style="margin-top: 30px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                            <h3 style="margin: 0;">💸 Détail des dépenses</h3>
                            <button class="btn-sejour btn-primary-sejour" onclick="ajouterDepense('${sejour.id}')">
                                ➕ Ajouter une dépense
                            </button>
                        </div>
                        
                        ${depenses.length === 0 ? `
                            <p style="text-align: center; color: #64748b; padding: 30px;">
                                Aucune dépense enregistrée pour ce séjour
                            </p>
                        ` : depenses.map((d, i) => `
                            <div class="depense-item">
                                <div class="depense-info">
                                    <h4>${d.libelle}</h4>
                                    <span class="depense-categorie">${d.categorie || 'Non catégorisé'}</span>
                                </div>
                                <div class="depense-montant">${d.montant.toFixed(2)}€</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        function renderCarte(sejour) {
            if (!sejour.coordonnees) {
                return `
                    <div style="text-align: center; padding: 60px 20px; color: #64748b;">
                        <div style="font-size: 3rem; margin-bottom: 20px;">🗺️</div>
                        <p>Aucune coordonnée GPS définie pour ce séjour.</p>
                        <button class="btn-sejour btn-primary-sejour" onclick="modifierSejour('${sejour.id}')">
                            Ajouter des coordonnées
                        </button>
                    </div>
                `;
            }
            
            return `
                <div class="map-container">
                    <iframe
                        id="sejour-map"
                        frameborder="0"
                        style="border:0"
                        src="https://www.openstreetmap.org/export/embed.html?bbox=${sejour.coordonnees.lng-0.1}%2C${sejour.coordonnees.lat-0.1}%2C${sejour.coordonnees.lng+0.1}%2C${sejour.coordonnees.lat+0.1}&layer=mapnik&marker=${sejour.coordonnees.lat}%2C${sejour.coordonnees.lng}"
                        allowfullscreen>
                    </iframe>
                </div>
                <div style="margin-top: 15px; text-align: center;">
                    <p style="color: #64748b; font-size: 0.9rem;">
                        📍 Coordonnées : ${sejour.coordonnees.lat}, ${sejour.coordonnees.lng}
                    </p>
                    <a href="https://www.openstreetmap.org/?mlat=${sejour.coordonnees.lat}&mlon=${sejour.coordonnees.lng}#map=13/${sejour.coordonnees.lat}/${sejour.coordonnees.lng}" 
                       target="_blank" 
                       class="btn-sejour btn-secondary-sejour">
                        🗺️ Ouvrir dans OpenStreetMap
                    </a>
                </div>
            `;
        }

        function renderProgramme(sejour) {
            const programme = sejour.programme || [];
            
            return `
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <h3 style="margin: 0;">Programme du séjour</h3>
                        <button class="btn-sejour btn-primary-sejour" onclick="ajouterActivite('${sejour.id}')">
                            ➕ Ajouter une activité
                        </button>
                    </div>
                    
                    ${programme.length === 0 ? `
                        <div style="text-align: center; padding: 60px 20px; color: #64748b;">
                            <div style="font-size: 3rem; margin-bottom: 20px;">📋</div>
                            <p>Aucune activité programmée pour ce séjour.</p>
                        </div>
                    ` : `
                        <div class="programme-list">
                            ${programme.map(p => `
                                <div class="programme-item">
                                    <div class="programme-horaire">${p.horaire || 'Horaire non défini'}</div>
                                    <div class="programme-activite">${p.activite}</div>
                                    ${p.description ? `<div class="programme-description">${p.description}</div>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    `}
                </div>
            `;
        }

        function renderParticipants(sejour) {
            const participants = sejour.participants || [];
            const eleves = participants.filter(p => p.role === 'Élève');
            const accompagnateurs = participants.filter(p => p.role === 'Accompagnateur' || p.role === 'Enseignant');
            
            return `
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px;">
                        <h3 style="margin: 0;">Liste des participants (${participants.length}) • ${eleves.length} élève${eleves.length > 1 ? 's' : ''} • ${accompagnateurs.length} accompagnateur${accompagnateurs.length > 1 ? 's' : ''}</h3>
                        <div style="display: flex; gap: 10px;">
                            <button class="btn-sejour btn-primary-sejour" onclick="ajouterParticipant('${sejour.id}')">
                                ➕ Ajouter un élève
                            </button>
                            <button class="btn-sejour btn-secondary-sejour" onclick="ajouterAccompagnateur('${sejour.id}')">
                                👨‍🏫 Ajouter un accompagnateur
                            </button>
                        </div>
                    </div>
                    
                    ${participants.length === 0 ? `
                        <div style="text-align: center; padding: 60px 20px; color: #64748b;">
                            <div style="font-size: 3rem; margin-bottom: 20px;">👥</div>
                            <p>Aucun participant enregistré.</p>
                            ${sejour.classe && typeof LISTES_ELEVES !== 'undefined' && LISTES_ELEVES[sejour.classe] ? `
                                <button class="btn-sejour btn-primary-sejour" onclick="importerEleves('${sejour.id}')">
                                    📥 Importer la liste de ${sejour.classe}
                                </button>
                            ` : ''}
                        </div>
                    ` : `
                        <div class="participants-grid">
                            ${participants.map(p => {
                                const initiales = p.nom.charAt(0) + (p.prenom ? p.prenom.charAt(0) : '');
                                return `
                                    <div class="participant-card">
                                        <div class="participant-avatar">${initiales}</div>
                                        <div class="participant-info">
                                            <h4>${p.nom} ${p.prenom || ''}</h4>
                                            <div class="participant-role">${p.role || 'Élève'}</div>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `}
                </div>
            `;
        }

        window.switchTab = function(tabName) {
            const tabs = container.querySelectorAll('.tab-btn');
            const contents = container.querySelectorAll('.tab-content');
            
            tabs.forEach(tab => tab.classList.remove('active'));
            contents.forEach(content => content.classList.remove('active'));
            
            container.querySelector(`[onclick="switchTab('${tabName}')"]`).classList.add('active');
            container.querySelector(`#tab-${tabName}`).classList.add('active');
        };

        window.fermerSejourDetail = function() {
            container.querySelector('#sejours-list').style.display = 'block';
            container.querySelector('#sejour-detail').style.display = 'none';
        };

        // Gestion de la modale dépense
        let currentSejourIdForDepense = null;
        
        window.openDepenseModal = function(sejourId) {
            currentSejourIdForDepense = sejourId;
            const modal = document.getElementById('modal-depense');
            modal.style.display = 'flex';
            document.getElementById('form-depense').reset();
            
            // Définir la date par défaut à aujourd'hui
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('depense-date').value = today;
        };
        
        window.closeDepenseModal = function() {
            const modal = document.getElementById('modal-depense');
            modal.style.display = 'none';
            currentSejourIdForDepense = null;
        };
        
        // Gérer la soumission du formulaire dépense
        document.getElementById('form-depense').addEventListener('submit', function(e) {
            e.preventDefault();
            
            if (!currentSejourIdForDepense) return;
            
            const sejour = sejours.find(s => s.id === currentSejourIdForDepense);
            if (!sejour) return;
            
            const libelle = document.getElementById('depense-libelle').value;
            const montant = parseFloat(document.getElementById('depense-montant').value);
            const categorie = document.getElementById('depense-categorie').value;
            const date = document.getElementById('depense-date').value;
            const notes = document.getElementById('depense-notes').value;
            
            if (!sejour.budget) sejour.budget = { total: 0, depenses: [], reste: 0 };
            if (!sejour.budget.depenses) sejour.budget.depenses = [];
            
            sejour.budget.depenses.push({
                libelle,
                montant,
                categorie,
                date,
                notes
            });
            
            sauvegarderSejours();
            closeDepenseModal();
            voirSejourDetail(currentSejourIdForDepense);
        });

        window.ajouterDepense = function(sejourId) {
            openDepenseModal(sejourId);
        };

        // Gestion de la modale revenu
        let currentSejourIdForRevenu = null;
        
        window.openRevenuModal = function(sejourId) {
            currentSejourIdForRevenu = sejourId;
            const modal = document.getElementById('modal-revenu');
            modal.style.display = 'flex';
            document.getElementById('form-revenu').reset();
            
            // Définir la date par défaut à aujourd'hui
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('revenu-date').value = today;
        };
        
        window.closeRevenuModal = function() {
            const modal = document.getElementById('modal-revenu');
            modal.style.display = 'none';
            currentSejourIdForRevenu = null;
        };
        
        // Gérer la soumission du formulaire revenu
        document.getElementById('form-revenu').addEventListener('submit', function(e) {
            e.preventDefault();
            
            if (!currentSejourIdForRevenu) return;
            
            const sejour = sejours.find(s => s.id === currentSejourIdForRevenu);
            if (!sejour) return;
            
            const libelle = document.getElementById('revenu-libelle').value;
            const montant = parseFloat(document.getElementById('revenu-montant').value);
            const source = document.getElementById('revenu-source').value;
            const date = document.getElementById('revenu-date').value;
            const notes = document.getElementById('revenu-notes').value;
            
            if (!sejour.budget) sejour.budget = { total: 0, depenses: [], revenus: [], reste: 0 };
            if (!sejour.budget.revenus) sejour.budget.revenus = [];
            
            sejour.budget.revenus.push({
                libelle,
                montant,
                source,
                date,
                notes
            });
            
            sauvegarderSejours();
            closeRevenuModal();
            voirSejourDetail(currentSejourIdForRevenu);
        });

        window.ajouterRevenu = function(sejourId) {
            openRevenuModal(sejourId);
        };

        // Gestion de la modale activité
        let currentSejourIdForActivite = null;
        
        window.openActiviteModal = function(sejourId) {
            currentSejourIdForActivite = sejourId;
            const modal = document.getElementById('modal-activite');
            modal.style.display = 'flex';
            document.getElementById('form-activite').reset();
        };
        
        window.closeActiviteModal = function() {
            const modal = document.getElementById('modal-activite');
            modal.style.display = 'none';
            currentSejourIdForActivite = null;
        };
        
        // Gérer la soumission du formulaire activité
        document.getElementById('form-activite').addEventListener('submit', function(e) {
            e.preventDefault();
            
            if (!currentSejourIdForActivite) return;
            
            const sejour = sejours.find(s => s.id === currentSejourIdForActivite);
            if (!sejour) return;
            
            const activite = document.getElementById('activite-nom').value;
            const date = document.getElementById('activite-date').value;
            const horaire = document.getElementById('activite-horaire').value;
            const lieu = document.getElementById('activite-lieu').value;
            const description = document.getElementById('activite-description').value;
            const cout = parseFloat(document.getElementById('activite-cout').value) || 0;
            
            if (!sejour.programme) sejour.programme = [];
            
            sejour.programme.push({
                activite,
                date,
                horaire,
                lieu,
                description,
                cout
            });
            
            sauvegarderSejours();
            closeActiviteModal();
            voirSejourDetail(currentSejourIdForActivite);
        });

        window.ajouterActivite = function(sejourId) {
            openActiviteModal(sejourId);
        };

        // Gestion de la modale participant
        let currentSejourIdForParticipant = null;
        
        window.openParticipantModal = function(sejourId) {
            currentSejourIdForParticipant = sejourId;
            const modal = document.getElementById('modal-participant');
            modal.style.display = 'flex';
            document.getElementById('form-participant').reset();
        };
        
        window.closeParticipantModal = function() {
            const modal = document.getElementById('modal-participant');
            modal.style.display = 'none';
            currentSejourIdForParticipant = null;
        };
        
        // Gérer la soumission du formulaire participant
        document.getElementById('form-participant').addEventListener('submit', function(e) {
            e.preventDefault();
            
            if (!currentSejourIdForParticipant) return;
            
            const sejour = sejours.find(s => s.id === currentSejourIdForParticipant);
            if (!sejour) return;
            
            const nom = document.getElementById('participant-nom').value;
            const prenom = document.getElementById('participant-prenom').value;
            const role = document.getElementById('participant-role').value;
            const email = document.getElementById('participant-email').value;
            const telephone = document.getElementById('participant-telephone').value;
            const notes = document.getElementById('participant-notes').value;
            
            if (!sejour.participants) sejour.participants = [];
            
            sejour.participants.push({
                nom,
                prenom,
                role,
                email,
                telephone,
                notes
            });
            
            sauvegarderSejours();
            closeParticipantModal();
            voirSejourDetail(currentSejourIdForParticipant);
        });

        window.ajouterParticipant = function(sejourId) {
            openParticipantModal(sejourId);
        };

        window.ajouterAccompagnateur = function(sejourId) {
            currentSejourIdForParticipant = sejourId;
            const modal = document.getElementById('modal-participant');
            modal.style.display = 'flex';
            document.getElementById('form-participant').reset();
            
            // Pré-sélectionner le rôle "Accompagnateur"
            document.getElementById('participant-role').value = 'Accompagnateur';
        };

        window.importerEleves = function(sejourId) {
            const sejour = sejours.find(s => s.id === sejourId);
            if (!sejour || !sejour.classe) return;
            
            if (typeof LISTES_ELEVES !== 'undefined' && LISTES_ELEVES[sejour.classe]) {
                const eleves = LISTES_ELEVES[sejour.classe];
                if (!sejour.participants) sejour.participants = [];
                
                eleves.forEach(eleve => {
                    if (!sejour.participants.find(p => p.nom === eleve.nom && p.prenom === eleve.prenom)) {
                        sejour.participants.push({
                            nom: eleve.nom,
                            prenom: eleve.prenom,
                            role: 'Élève'
                        });
                    }
                });
                
                sauvegarderSejours();
                voirSejourDetail(sejourId);
            }
        };

        function exportSejours() {
            const contenuFichier = `// Gestion de Séjours - Données embarquées pour portabilité complète
// Ce fichier contient tous les séjours organisés
// Remplacez le fichier js/sejours-data.js par celui-ci pour restaurer vos données

const SEJOURS_DATA = ${JSON.stringify(sejours, null, 4)};

// Export pour utilisation dans app.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SEJOURS_DATA;
}
`;
            
            const blob = new Blob([contenuFichier], { type: 'text/javascript' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'sejours-data.js';
            a.click();
            URL.revokeObjectURL(url);
            
            alert(`✅ Fichier sejours-data.js téléchargé !

📊 Contenu : ${sejours.length} séjour(s)

💡 Pour portabilité : remplacez js/sejours-data.js dans votre dossier eProf par ce fichier.`);
        }

        async function importSejours(e) {
            const file = e.target.files[0];
            if (!file) return;
            
            try {
                const texte = await file.text();
                const match = texte.match(/const SEJOURS_DATA = (\[[\s\S]*?\]);/);
                
                if (match && match[1]) {
                    const sejoursImportes = JSON.parse(match[1]);
                    
                    if (Array.isArray(sejoursImportes)) {
                        if (confirm(`Importer ${sejoursImportes.length} séjour(s) ?\n\n⚠️ Cela remplacera la liste actuelle.`)) {
                            sejours = sejoursImportes;
                            sauvegarderSejours();
                            afficherSejours();
                            alert(`✅ ${sejoursImportes.length} séjour(s) importé(s) avec succès !`);
                        }
                    }
                } else {
                    alert('⚠️ Format de fichier invalide.');
                }
            } catch (error) {
                console.error('Erreur import séjours:', error);
                alert('❌ Erreur lors de l\'importation.');
            }
            
            e.target.value = '';
        }

        function initMap(coordonnees) {
            // La carte est déjà affichée via iframe OpenStreetMap
            console.log('Carte initialisée pour', coordonnees);
        }

        // Afficher la liste initiale
        afficherSejours();
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
    // CARNET DE NOTES
    // ========================================
    function renderCarnetNotes(container) {
        const classes = [];
        
        container.innerHTML = `
            <div id="suivi-eleves-module">
                <h2>📒 Carnet de notes</h2>
                <div class="selection-classe-suivi empty-state-box">
                    <h3>Les listes de l’année ${getAnneeScolaire()} ne sont pas encore ajoutées.</h3>
                    <p>Les anciennes données sont désormais centralisées dans l’archive.</p>
                </div>
            </div>
        `;
    }

    // ========================================
    // SUIVI DE STAGE
    // ========================================
    function renderSuiviStage(container) {
        // Récupérer les classes depuis LISTES_ELEVES
        const classes = Object.keys(LISTES_ELEVES);
        
        container.innerHTML = `
            <div id="suivi-eleves-module">
                <h2>📝 Suivi de stage - Année 2025-2026</h2>
                
                <!-- Sélection de classe -->
                <div class="selection-classe-suivi">
                    <h3>Sélectionnez une classe</h3>
                    <div class="classes-grid">
                        ${classes.map(classe => `
                            <button class="classe-btn classe-color-${classe.replace(/\s+/g, '-')}" data-classe="${classe}">
                                📚 ${classe}
                            </button>
                        `).join('')}
                    </div>
                </div>
                
                <div id="contenu-stage" style="display: none; margin-top: 30px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <h3 id="classe-titre-stage"></h3>
                        <button id="retour-selection-stage" class="btn-secondary">← Retour à la sélection</button>
                    </div>
                    <p style="color: #64748b; font-style: italic;">Fonctionnalité à venir</p>
                </div>
            </div>
        `;
        
        // Event listeners sur les boutons de classe
        container.querySelectorAll('.classe-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const classe = this.getAttribute('data-classe');
                const selectionDiv = container.querySelector('.selection-classe-suivi');
                const contenuDiv = container.querySelector('#contenu-stage');
                const classeTitre = container.querySelector('#classe-titre-stage');
                
                selectionDiv.style.display = 'none';
                contenuDiv.style.display = 'block';
                classeTitre.textContent = `Suivi de stage - ${classe}`;
            });
        });
        
        // Bouton retour
        const retourBtn = container.querySelector('#retour-selection-stage');
        if (retourBtn) {
            retourBtn.addEventListener('click', function() {
                const selectionDiv = container.querySelector('.selection-classe-suivi');
                const contenuDiv = container.querySelector('#contenu-stage');
                
                selectionDiv.style.display = 'block';
                contenuDiv.style.display = 'none';
            });
        }
    }

    // ========================================
    // CAHIER DE TEXTE
    // ========================================
    function renderCahierTexte(container) {
        // Récupérer les classes depuis LISTES_ELEVES
        const classes = Object.keys(LISTES_ELEVES);
        
        container.innerHTML = `
            <div id="suivi-eleves-module">
                <h2>📔 Cahier de texte - Année 2025-2026</h2>
                
                <!-- Sélection de classe -->
                <div class="selection-classe-suivi">
                    <h3>Sélectionnez une classe</h3>
                    <div class="classes-grid">
                        ${classes.map(classe => `
                            <button class="classe-btn classe-color-${classe.replace(/\s+/g, '-')}" data-classe="${classe}">
                                📚 ${classe}
                            </button>
                        `).join('')}
                    </div>
                </div>
                
                <div id="contenu-cahier" style="display: none; margin-top: 30px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <h3 id="classe-titre-cahier"></h3>
                        <button id="retour-selection-cahier" class="btn-secondary">← Retour à la sélection</button>
                    </div>
                    <p style="color: #64748b; font-style: italic;">Fonctionnalité à venir</p>
                </div>
            </div>
        `;
        
        // Event listeners sur les boutons de classe
        container.querySelectorAll('.classe-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const classe = this.getAttribute('data-classe');
                const selectionDiv = container.querySelector('.selection-classe-suivi');
                const contenuDiv = container.querySelector('#contenu-cahier');
                const classeTitre = container.querySelector('#classe-titre-cahier');
                
                selectionDiv.style.display = 'none';
                contenuDiv.style.display = 'block';
                classeTitre.textContent = `Cahier de texte - ${classe}`;
            });
        });
        
        // Bouton retour
        const retourBtn = container.querySelector('#retour-selection-cahier');
        if (retourBtn) {
            retourBtn.addEventListener('click', function() {
                const selectionDiv = container.querySelector('.selection-classe-suivi');
                const contenuDiv = container.querySelector('#contenu-cahier');
                
                selectionDiv.style.display = 'block';
                contenuDiv.style.display = 'none';
            });
        }
    }

    // ========================================
    // GÉNÉRATEUR DE QUIZ - AIDE & LANCEMENT
    // ========================================
    function renderQuizHelper(container) {
        // Charger la liste des quiz
        const quizList = JSON.parse(localStorage.getItem('quizList') || '[]');
        
        container.innerHTML = `
            <div style="max-width: 1200px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 2em; border-radius: 16px; margin-bottom: 2em; text-align: center;">
                    <h2 style="margin: 0 0 0.5em 0; font-size: 2em;">❓ Générateur de Quiz</h2>
                    <p style="margin: 0; font-size: 1.1em; opacity: 0.95;">Créez vos quiz interactifs manuellement, question par question</p>
                </div>

                <!-- Répertoire des quiz créés -->
                <div style="background: white; border: 2px solid #e2e8f0; border-radius: 12px; padding: 2em; margin-bottom: 2em;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5em;">
                        <h3 style="margin: 0; color: #1a2236;">📚 Mes quiz créés (${quizList.length})</h3>
                        <div style="display: flex; gap: 10px;">
                            <button id="export-quiz-list-btn" class="btn-secondary" style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">💾 Sauvegarder la liste</button>
                            <button id="import-quiz-list-btn" class="btn-secondary" style="padding: 8px 16px; background: #10b981; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">📂 Restaurer la liste</button>
                            <input type="file" id="import-quiz-file" accept=".js" style="display: none;">
                        </div>
                    </div>
                    
                    <div id="quiz-list-container">
                        ${quizList.length === 0 ? `
                            <div style="text-align: center; padding: 3em; color: #64748b;">
                                <div style="font-size: 4em; margin-bottom: 0.5em;">📝</div>
                                <p style="font-size: 1.1em; margin: 0;">Aucun quiz créé pour le moment</p>
                                <p style="font-size: 0.9em; margin: 0.5em 0 0 0;">Créez votre premier quiz en utilisant le générateur ci-dessous !</p>
                            </div>
                        ` : `
                            <div style="display: grid; gap: 1em;">
                                ${quizList.map((quiz, index) => {
                                    const date = new Date(quiz.dateCreation);
                                    const dateStr = date.toLocaleDateString('fr-FR');
                                    return `
                                        <div class="quiz-card" data-index="${index}" style="background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 8px; padding: 1.5em; display: flex; justify-content: space-between; align-items: start; transition: all 0.2s;">
                                            <div style="flex: 1;">
                                                <h4 style="margin: 0 0 0.5em 0; color: #1a2236; font-size: 1.1em;">${quiz.titre || 'Quiz sans titre'}</h4>
                                                <div style="display: flex; gap: 1.5em; flex-wrap: wrap; margin-bottom: 0.5em;">
                                                    <span style="color: #64748b; font-size: 0.9em;">📚 ${quiz.matiere || 'Non spécifié'}</span>
                                                    <span style="color: #64748b; font-size: 0.9em;">🎓 ${quiz.classe || 'Non spécifié'}</span>
                                                    <span style="color: #64748b; font-size: 0.9em;">⏱️ ${quiz.duree || '?'} min</span>
                                                    <span style="color: #64748b; font-size: 0.9em;">❓ ${quiz.questions?.length || 0} questions</span>
                                                </div>
                                                <div style="color: #94a3b8; font-size: 0.85em;">Créé le ${dateStr}</div>
                                            </div>
                                            <div style="display: flex; gap: 8px;">
                                                <button class="btn-view-quiz" data-index="${index}" style="background: #667eea; color: white; border: none; border-radius: 6px; padding: 8px 16px; cursor: pointer; font-weight: 600; transition: all 0.2s;" title="Voir le quiz">👁️ Voir</button>
                                                <button class="btn-duplicate-quiz" data-index="${index}" style="background: #3b82f6; color: white; border: none; border-radius: 6px; padding: 8px 16px; cursor: pointer; font-weight: 600; transition: all 0.2s;" title="Dupliquer">📋</button>
                                                <button class="btn-delete-quiz" data-index="${index}" style="background: #ef4444; color: white; border: none; border-radius: 6px; padding: 8px 16px; cursor: pointer; font-weight: 600; transition: all 0.2s;" title="Supprimer">🗑️</button>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        `}
                    </div>
                </div>

                <!-- Fonctionnement du nouveau générateur -->
                <div style="background: white; border: 2px solid #e2e8f0; border-radius: 12px; padding: 2em; margin-bottom: 1.5em;">
                    <div style="display: flex; align-items: center; gap: 1em; margin-bottom: 1em;">
                        <span style="font-size: 3em;">✍️</span>
                        <div>
                            <h3 style="margin: 0 0 0.3em 0; color: #1a2236;">Création manuelle de quiz - Simple et efficace</h3>
                            <p style="margin: 0; color: #64748b;">Créez vos questions une par une, avec un contrôle total</p>
                        </div>
                    </div>

                    <div style="background: #f8fafc; padding: 1.5em; border-radius: 8px; border-left: 4px solid #667eea;">
                        <h4 style="margin: 0 0 1em 0; color: #1a2236;">💡 Comment ça marche ?</h4>
                        <ol style="margin: 0; padding-left: 1.5em; color: #475569; line-height: 1.8;">
                            <li><strong>Étape 1 : Informations générales</strong>
                                <ul style="margin-top: 0.5em;">
                                    <li>Titre du quiz, matière, classe</li>
                                    <li>Durée estimée, description</li>
                                </ul>
                            </li>
                            <li><strong>Étape 2 : Création des questions</strong>
                                <ul style="margin-top: 0.5em;">
                                    <li>Ajoutez autant de questions que vous voulez</li>
                                    <li>Choisissez le type : <strong>QCM</strong> (choix multiple), <strong>Vrai/Faux</strong>, ou <strong>Réponse courte</strong></li>
                                    <li>Pour les QCM : ajoutez 2 à 6 réponses possibles, cochez la bonne</li>
                                    <li>Pour Vrai/Faux : automatiquement 2 options</li>
                                    <li>Pour les réponses courtes : indiquez la réponse attendue</li>
                                    <li>Définissez le nombre de points par question</li>
                                </ul>
                            </li>
                            <li><strong>Étape 3 : Prévisualisation et sauvegarde</strong>
                                <ul style="margin-top: 0.5em;">
                                    <li>Vérifiez votre quiz complet</li>
                                    <li>Enregistrez dans le navigateur</li>
                                    <li>Générez un lien de partage avec QR code</li>
                                    <li>Exportez en PDF pour impression</li>
                                </ul>
                            </li>
                        </ol>
                    </div>
                </div>

                <!-- Types de questions -->
                <div style="background: white; border: 2px solid #e2e8f0; border-radius: 12px; padding: 2em; margin-bottom: 1.5em;">
                    <h3 style="margin: 0 0 1em 0; color: #1a2236;">📝 Types de questions disponibles</h3>
                    
                    <div style="display: grid; gap: 1em;">
                        <div style="background: #eff6ff; padding: 1em; border-radius: 6px; border-left: 4px solid #3b82f6;">
                            <div style="display: flex; justify-content: space-between; align-items: start;">
                                <div>
                                    <strong style="color: #2563eb; font-size: 1.1em;">📊 QCM (Choix multiple)</strong>
                                    <p style="margin: 0.5em 0 0 0; color: #475569; font-size: 0.95em;">De 2 à 6 réponses possibles. L'élève sélectionne une seule réponse.</p>
                                    <p style="margin: 0.3em 0 0 0; color: #64748b; font-size: 0.85em; font-style: italic;">Idéal pour : toutes les matières, évaluations standards</p>
                                </div>
                            </div>
                        </div>
                        
                        <div style="background: #f0fdf4; padding: 1em; border-radius: 6px; border-left: 4px solid #10b981;">
                            <div style="display: flex; justify-content: space-between; align-items: start;">
                                <div>
                                    <strong style="color: #059669; font-size: 1.1em;">✅ Vrai / Faux</strong>
                                    <p style="margin: 0.5em 0 0 0; color: #475569; font-size: 0.95em;">Exactement 2 options. Questions binaires rapides.</p>
                                    <p style="margin: 0.3em 0 0 0; color: #64748b; font-size: 0.85em; font-style: italic;">Idéal pour : validation de concepts, révisions rapides</p>
                                </div>
                            </div>
                        </div>
                        
                        <div style="background: #fef3c7; padding: 1em; border-radius: 6px; border-left: 4px solid #f59e0b;">
                            <div style="display: flex; justify-content: space-between; align-items: start;">
                                <div>
                                    <strong style="color: #d97706; font-size: 1.1em;">✍️ Réponse courte (texte libre)</strong>
                                    <p style="margin: 0.5em 0 0 0; color: #475569; font-size: 0.95em;">L'élève saisit sa réponse. Vous indiquez la réponse attendue comme référence.</p>
                                    <p style="margin: 0.3em 0 0 0; color: #64748b; font-size: 0.85em; font-style: italic;">Idéal pour : définitions, calculs, expressions personnelles</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Avantages -->
                <div style="background: linear-gradient(to right, #ecfdf5, #f0fdf4); border: 2px solid #10b981; border-radius: 12px; padding: 1.5em; margin-bottom: 2em;">
                    <h3 style="margin: 0 0 1em 0; color: #065f46;">✨ Avantages du générateur manuel</h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1em;">
                        <div style="display: flex; align-items: start; gap: 0.5em;">
                            <span style="font-size: 1.5em;">🎯</span>
                            <div>
                                <strong style="color: #065f46;">Contrôle total</strong>
                                <p style="margin: 0.2em 0 0 0; font-size: 0.9em; color: #047857;">Vous maîtrisez chaque question et chaque réponse</p>
                            </div>
                        </div>
                        <div style="display: flex; align-items: start; gap: 0.5em;">
                            <span style="font-size: 1.5em;">💯</span>
                            <div>
                                <strong style="color: #065f46;">Qualité garantie</strong>
                                <p style="margin: 0.2em 0 0 0; font-size: 0.9em; color: #047857;">Questions parfaitement adaptées à votre enseignement</p>
                            </div>
                        </div>
                        <div style="display: flex; align-items: start; gap: 0.5em;">
                            <span style="font-size: 1.5em;">🌈</span>
                            <div>
                                <strong style="color: #065f46;">Flexibilité</strong>
                                <p style="margin: 0.2em 0 0 0; font-size: 0.9em; color: #047857;">3 types de questions, points personnalisables</p>
                            </div>
                        </div>
                        <div style="display: flex; align-items: start; gap: 0.5em;">
                            <span style="font-size: 1.5em;">📱</span>
                            <div>
                                <strong style="color: #065f46;">Partage facile</strong>
                                <p style="margin: 0.2em 0 0 0; font-size: 0.9em; color: #047857;">Lien + QR code pour vos élèves</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Bouton de lancement -->
                <div style="text-align: center;">
                    <button id="launch-quiz-btn" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 12px; padding: 1.5em 3em; font-size: 1.2em; font-weight: 700; cursor: pointer; box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3); transition: all 0.3s;">
                        🚀 Créer un nouveau quiz
                    </button>
                    <p style="margin: 1em 0 0 0; color: #64748b; font-size: 0.9em;">Le générateur s'ouvrira dans un nouvel onglet</p>
                </div>
            </div>
        `;

        // === EVENT LISTENERS POUR LA LISTE DES QUIZ ===
        
        // Boutons Voir
        container.querySelectorAll('.btn-view-quiz').forEach(btn => {
            btn.addEventListener('mouseenter', function() {
                this.style.transform = 'scale(1.05)';
            });
            btn.addEventListener('mouseleave', function() {
                this.style.transform = 'scale(1)';
            });
            btn.addEventListener('click', function() {
                const index = parseInt(this.dataset.index);
                const quiz = quizList[index];
                
                // Créer une modale pour afficher le quiz
                showQuizModal(quiz, index);
            });
        });
        
        // Boutons Dupliquer
        container.querySelectorAll('.btn-duplicate-quiz').forEach(btn => {
            btn.addEventListener('click', function() {
                const index = parseInt(this.dataset.index);
                const quiz = quizList[index];
                
                const newQuiz = {
                    ...quiz,
                    id: 'quiz-' + Date.now(),
                    titre: quiz.titre + ' (copie)',
                    dateCreation: new Date().toISOString()
                };
                
                quizList.push(newQuiz);
                localStorage.setItem('quizList', JSON.stringify(quizList));
                
                // Recharger la vue
                renderQuizHelper(container);
            });
        });
        
        // Boutons Supprimer
        container.querySelectorAll('.btn-delete-quiz').forEach(btn => {
            btn.addEventListener('click', function() {
                const index = parseInt(this.dataset.index);
                const quiz = quizList[index];
                
                if (confirm(`Supprimer le quiz "${quiz.titre}" ?\n\nCette action est irréversible.`)) {
                    quizList.splice(index, 1);
                    localStorage.setItem('quizList', JSON.stringify(quizList));
                    
                    // Recharger la vue
                    renderQuizHelper(container);
                }
            });
        });
        
        // Export de la liste
        const exportBtn = container.querySelector('#export-quiz-list-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', function() {
                const fileContent = `// QUIZ_DATA - Données des quiz créés dans eProf
// Ce fichier permet la portabilité complète des quiz

const QUIZ_DATA = {
    quiz: ${JSON.stringify(quizList, null, 4)}
};

// Au chargement, restaurer les quiz depuis ce fichier vers localStorage
if (typeof QUIZ_DATA !== 'undefined' && QUIZ_DATA.quiz && QUIZ_DATA.quiz.length > 0) {
    const existingQuiz = JSON.parse(localStorage.getItem('quizList') || '[]');
    
    // Fusionner sans dupliquer (basé sur l'id)
    const merged = [...existingQuiz];
    QUIZ_DATA.quiz.forEach(quiz => {
        if (!merged.find(q => q.id === quiz.id)) {
            merged.push(quiz);
        }
    });
    
    localStorage.setItem('quizList', JSON.stringify(merged));
}
`;
                
                const blob = new Blob([fileContent], { type: 'text/javascript' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'quiz-data.js';
                a.click();
                URL.revokeObjectURL(url);
                
                alert('✅ Liste des quiz sauvegardée !\n\nLe fichier quiz-data.js a été téléchargé.\nPlacez-le dans le dossier js/ pour une portabilité complète.');
            });
        }
        
        // Import de la liste
        const importBtn = container.querySelector('#import-quiz-list-btn');
        const importFile = container.querySelector('#import-quiz-file');
        if (importBtn && importFile) {
            importBtn.addEventListener('click', () => importFile.click());
            
            importFile.addEventListener('change', function(e) {
                const file = e.target.files[0];
                if (!file) return;
                
                const reader = new FileReader();
                reader.onload = function(event) {
                    try {
                        const content = event.target.result;
                        
                        // Extraire le JSON du fichier
                        const match = content.match(/quiz:\s*(\[[\s\S]*?\])\s*}/);
                        if (!match) {
                            alert('❌ Format de fichier invalide');
                            return;
                        }
                        
                        const importedQuiz = JSON.parse(match[1]);
                        const existing = JSON.parse(localStorage.getItem('quizList') || '[]');
                        
                        // Fusionner sans dupliquer
                        const merged = [...existing];
                        let added = 0;
                        
                        importedQuiz.forEach(quiz => {
                            if (!merged.find(q => q.id === quiz.id)) {
                                merged.push(quiz);
                                added++;
                            }
                        });
                        
                        localStorage.setItem('quizList', JSON.stringify(merged));
                        
                        alert(`✅ ${added} quiz importé(s) avec succès !`);
                        renderQuizHelper(container);
                    } catch (error) {
                        alert('❌ Erreur lors de l\'import : ' + error.message);
                    }
                };
                reader.readAsText(file);
            });
        }
        
        // Fonction pour afficher un quiz en modale
        function showQuizModal(quiz, index) {
            const modal = document.createElement('div');
            modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 2em;';
            
            modal.innerHTML = `
                <div style="background: white; border-radius: 16px; max-width: 800px; max-height: 90vh; overflow-y: auto; padding: 2em; position: relative;">
                    <button id="close-modal" style="position: absolute; top: 1em; right: 1em; background: #ef4444; color: white; border: none; border-radius: 50%; width: 32px; height: 32px; cursor: pointer; font-size: 1.2em;">×</button>
                    
                    <h2 style="margin: 0 0 1em 0; color: #1a2236;">${quiz.titre}</h2>
                    
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1em; margin-bottom: 2em; padding: 1em; background: #f8fafc; border-radius: 8px;">
                        <div><strong>Matière :</strong> ${quiz.matiere}</div>
                        <div><strong>Niveau :</strong> ${quiz.niveau}</div>
                        <div><strong>Durée :</strong> ${quiz.duree} min</div>
                        <div><strong>Questions :</strong> ${quiz.questions?.length || 0}</div>
                    </div>
                    
                    <h3 style="margin: 1.5em 0 1em 0; color: #1a2236;">Questions :</h3>
                    <div style="display: grid; gap: 1em;">
                        ${(quiz.questions || []).map((q, i) => `
                            <div style="padding: 1em; background: #f8fafc; border-left: 4px solid #667eea; border-radius: 4px;">
                                <div style="font-weight: 600; color: #1a2236; margin-bottom: 0.5em;">${i + 1}. ${q.question}</div>
                                <div style="display: grid; gap: 0.3em; margin-left: 1em;">
                                    ${q.choices.map((choice, ci) => `
                                        <div style="color: ${ci === q.correctAnswer ? '#10b981' : '#64748b'}; ${ci === q.correctAnswer ? 'font-weight: 600;' : ''}">
                                            ${ci === q.correctAnswer ? '✓' : '○'} ${choice}
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div style="margin-top: 2em; display: flex; gap: 1em; justify-content: flex-end;">
                        <button id="edit-quiz-btn" style="background: #3b82f6; color: white; border: none; border-radius: 8px; padding: 0.8em 1.5em; cursor: pointer; font-weight: 600;">✏️ Modifier</button>
                        <button id="close-modal-btn" style="background: #64748b; color: white; border: none; border-radius: 8px; padding: 0.8em 1.5em; cursor: pointer; font-weight: 600;">Fermer</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            modal.querySelector('#close-modal').addEventListener('click', () => modal.remove());
            modal.querySelector('#close-modal-btn').addEventListener('click', () => modal.remove());
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.remove();
            });
            
            modal.querySelector('#edit-quiz-btn').addEventListener('click', () => {
                // Ouvrir le générateur avec ce quiz pré-chargé
                localStorage.setItem('quizToEdit', JSON.stringify(quiz));
                window.open('generateur-quiz.html?edit=' + quiz.id, '_blank');
                modal.remove();
            });
        }

        // Event listener pour le bouton de lancement
        const launchBtn = container.querySelector('#launch-quiz-btn');
        launchBtn.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-4px)';
            this.style.boxShadow = '0 12px 32px rgba(102, 126, 234, 0.4)';
        });
        launchBtn.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = '0 8px 24px rgba(102, 126, 234, 0.3)';
        });
        launchBtn.addEventListener('click', function() {
            localStorage.removeItem('quizToEdit'); // S'assurer qu'on crée un nouveau quiz
            window.open('generateur-quiz.html', '_blank');
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

