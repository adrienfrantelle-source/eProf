document.addEventListener('DOMContentLoaded', () => {
    const mainContent = document.getElementById('main-content');
    
    console.log('DOM chargé, mainContent:', mainContent);

    // Ancienne routine de nettoyage (migration ponctuelle, désormais désactivée :
    // elle supprimait aussi des clés légitimes en cours d'utilisation comme
    // eprof_teacherConfig_* et le cache local du carnet de notes).
    function clearLegacyYearData() {}

    clearLegacyYearData();

    function getAppVersionInfo() {
        return { version: 'V2.0.0' };
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

    // Applique le mode d'affichage mobile choisi dans les Paramètres, dès le chargement
    (function applyStoredMobileModeOnBoot() {
        try {
            const parametresBoot = JSON.parse(localStorage.getItem('parametres') || '{}');
            const mode = parametresBoot.affichage && parametresBoot.affichage.modeMobile;
            document.body.classList.remove('mode-mobile-force', 'mode-mobile-off');
            if (mode === 'active') document.body.classList.add('mode-mobile-force');
            else if (mode === 'inactive') document.body.classList.add('mode-mobile-off');
        } catch (e) {}
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
    
    // Navigation principale
    // Gestion centralisée de tous les clics sidebar
    document.querySelectorAll('.sidebar a').forEach(function(link) {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            if (link.id === 'dashboard-link') {
                showDashboard();
                highlightSidebar('dashboard-link');
            } else if (link.id === 'calendar-link') {
                renderCalendar(mainContent);
                highlightSidebar('calendar-link');
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

    console.log('Appel de showDashboard...');
    showDashboard();
    highlightSidebar('dashboard-link');
    console.log('Dashboard affiché');

    function showDashboard() {
        // Message de bienvenue personnalisé selon l'heure
        const heure = new Date().getHours();
        let salutation = 'Bonjour';
        let emoji = '☀️';
        if (heure < 12) {
            salutation = 'Bon matin';
            emoji = '🌅';
        } else if (heure < 18) {
            salutation = 'Bon après-midi';
            emoji = '☀️';
        } else {
            salutation = 'Bonsoir';
            emoji = '🌙';
        }
        
        const userName = localStorage.getItem('userName') || 'Enseignant';
        
        mainContent.innerHTML = `
            <div class="quick-access-section">
                <h3 class="section-title">⚡ Accès rapides</h3>
                <div class="quick-access-grid">
                    <button class="quick-card" data-tool="calendar">
                        <div class="quick-icon">📅</div>
                        <div class="quick-title">Calendrier</div>
                        <div class="quick-desc">Suivez les dates et rendez-vous</div>
                    </button>
                    <button class="quick-card" data-tool="notes">
                        <div class="quick-icon">📒</div>
                        <div class="quick-title">Carnet de notes</div>
                        <div class="quick-desc">Notes et moyennes</div>
                    </button>
                    <button class="quick-card" data-tool="eleves">
                        <div class="quick-icon">👨‍🎓</div>
                        <div class="quick-title">Suivi élèves</div>
                        <div class="quick-desc">Oublis et mots</div>
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
                            <div class="tool-description">Année 2026-2027 et archives</div>
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
                            <div class="tool-description">Dessinez et prenez des notes enrichies</div>
                        </div>
                    </button>
                    <button class="tool-card" data-tool="ressources">
                        <span class="tool-icon">📚</span>
                        <div class="tool-content">
                            <div class="tool-title">Ressources pédagogiques</div>
                            <div class="tool-description">Organisez vos documents et supports de cours</div>
                        </div>
                    </button>
                </div>
            </div>
            
            <div class="tools-section">
                <h3 class="section-title">🔧 Utilitaires</h3>
                <div class="tools-grid">
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
        
        // Event listeners pour tous les boutons
        mainContent.querySelectorAll('.quick-card, .tool-card').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                var tool = btn.getAttribute('data-tool');
                handleDashboardTool(tool);
                highlightSidebar(tool);
            });
        });
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
    let outilCourant = null;

    // Les listes d'élèves arrivent de façon asynchrone : on re-rend l'outil affiché.
    document.addEventListener('eprof-referentiel-maj', function () {
        if (['eleves', 'trombinoscopes', 'plan-classe'].includes(outilCourant)) {
            handleDashboardTool(outilCourant);
        }
    });

    function handleDashboardTool(tool) {
        outilCourant = tool;
        switch(tool) {
            case 'calendar':
                renderCalendar(mainContent);
                highlightSidebar('calendar-link');
                break;
            case 'converter':
                renderFileConverter(mainContent);
                highlightSidebar('converter');
                break;
            case 'plan-classe':
                renderPlanClasse(mainContent);
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
                renderTrombinoscopes(mainContent);
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
                renderSuiviEleves(mainContent);
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
                mainContent.innerHTML = '<h2>Ressources pédagogiques</h2><p>Fonctionnalité à venir.</p>';
                highlightSidebar('ressources');
                break;
            case 'messagerie':
                mainContent.innerHTML = '<h2>Module désactivé</h2><p>La messagerie a été retirée de eProf.</p>';
                break;
            case 'parametres':
                renderParametres(mainContent);
                highlightSidebar('parametres');
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

    function showTools() {
        mainContent.innerHTML = `
            <h2>Outils</h2>
            <div class="dashboard-grid">
                <button class="dashboard-btn" data-tool="converter">🔄 Conversion de fichier</button>
                <button class="dashboard-btn" data-tool="plan-classe">🪑 Plan de classe</button>
                <button class="dashboard-btn" data-tool="tableau-blanc">📋 Tableau blanc</button>
                <button class="dashboard-btn" data-tool="jeu">🎮 Jeu pédagogique</button>
                <button class="dashboard-btn" data-tool="trombinoscopes">📸 Trombinoscopes</button>
                <button class="dashboard-btn" data-tool="archives">📦 Archives</button>
                <button class="dashboard-btn" data-tool="eleves">👨‍🎓 Suivi des élèves</button>
                <button class="dashboard-btn" data-tool="notes">📒 Carnet de notes</button>
                <button class="dashboard-btn" data-tool="ressources">📚 Ressources pédagogiques</button>
                <button class="dashboard-btn" data-tool="parametres">⚙️ Paramètres</button>
            </div>
        `;
        mainContent.querySelectorAll('.dashboard-btn').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                var tool = btn.getAttribute('data-tool');
                handleDashboardTool(tool);
            });
        });
    }

    // Calendrier fusionné
    // Calendrier FullCalendar unique
    function renderCalendar(container) {
        // Ajout du CSS FullCalendar si pas déjà présent
        if (!document.getElementById('fc-css')) {
            var link = document.createElement('link');
            link.rel = 'stylesheet';
            link.id = 'fc-css';
            link.href = 'https://cdn.jsdelivr.net/npm/fullcalendar@6.1.8/index.global.min.css';
            document.head.appendChild(link);
        }
        container.innerHTML = `<div id="calendar-module">
            <div class="calendar-toolbar">
                <button id="import-emploi-btn" class="btn-secondary">📥 Importer emploi du temps (CSV)</button>
                <input type="file" id="import-emploi-input" accept=".csv" style="display: none;">
                <button id="export-emploi-btn" class="btn-secondary">💾 Exporter emploi du temps (CSV)</button>
                <button id="help-emploi-btn" class="btn-secondary">❓ Aide</button>
            </div>
            <div id="calendar-view"></div>
        </div>`;
        // Ajout du script FullCalendar si besoin
        function openCalendarImageModal() {
            var existing = document.getElementById('calendar-image-modal');
            if (existing) existing.remove();

            var modal = document.createElement('div');
            modal.id = 'calendar-image-modal';
            modal.className = 'calendar-image-modal';
            modal.innerHTML = `
                <div class="calendar-image-backdrop" data-close="true"></div>
                <div class="calendar-image-dialog">
                    <div class="calendar-image-header">
                        <h3>Calendrier scolaire - Zone B</h3>
                        <button type="button" class="calendar-image-close" aria-label="Fermer">×</button>
                    </div>
                    <img src="images/calendrier scolaire.png" alt="Calendrier scolaire Zone B" />
                </div>
            `;

            document.body.appendChild(modal);
            modal.querySelector('.calendar-image-close').addEventListener('click', function() { modal.remove(); });
            modal.querySelector('.calendar-image-backdrop').addEventListener('click', function() { modal.remove(); });
        }

        async function startFullCalendar() {
            var calendarEl = container.querySelector('#calendar-view');
            var events = (await loadCalendarEvents()).map(toDisplayEvent);

            var joursFeries = [
                { title: '🎉 Jour de l\'An', start: '2026-01-01', allDay: true },
                { title: '🌱 Lundi de Pâques', start: '2026-04-06', allDay: true },
                { title: '🏭 Fête du Travail', start: '2026-05-01', allDay: true },
                { title: '🎖️ Victoire 1945', start: '2026-05-08', allDay: true },
                { title: '☁️ Ascension', start: '2026-05-14', allDay: true },
                { title: '🌼 Lundi de Pentecôte', start: '2026-05-25', allDay: true },
                { title: '🇫🇷 Fête Nationale', start: '2026-07-14', allDay: true },
                { title: '☀️ Assomption', start: '2026-08-15', allDay: true },
                { title: '🍂 Toussaint', start: '2026-11-01', allDay: true },
                { title: '🪖 Armistice', start: '2026-11-11', allDay: true },
                { title: '🎄 Noël', start: '2026-12-25', allDay: true }
            ];

            var vacancesScolaires = [
                {
                    title: '🏖️ Vacances de la Toussaint',
                    start: '2026-10-17',
                    end: '2026-11-02',
                    display: 'background',
                    backgroundColor: '#fef3c7',
                    allDay: true
                },
                {
                    title: '🎄 Vacances de Noël',
                    start: '2026-12-19',
                    end: '2027-01-04',
                    display: 'background',
                    backgroundColor: '#dbeafe',
                    allDay: true
                },
                {
                    title: '⛷️ Vacances d\'hiver',
                    start: '2027-02-13',
                    end: '2027-03-01',
                    display: 'background',
                    backgroundColor: '#e0e7ff',
                    allDay: true
                },
                {
                    title: '🌸 Vacances de printemps',
                    start: '2027-04-10',
                    end: '2027-04-26',
                    display: 'background',
                    backgroundColor: '#fce7f3',
                    allDay: true
                },
                {
                    title: '☀️ Vacances d\'été',
                    start: '2027-07-03',
                    end: '2027-09-01',
                    display: 'background',
                    backgroundColor: '#fef08a',
                    allDay: true
                }
            ];
            
            var allEvents = events.concat(joursFeries, vacancesScolaires);
            
            var calendar = new window.FullCalendar.Calendar(calendarEl, {
                initialView: 'timeGridWeek',
                locale: 'fr',
                firstDay: 1,
                weekends: false,
                slotMinTime: '08:00:00',
                slotMaxTime: '20:00:00',
                nowIndicator: true,
                scrollTime: new Date().toTimeString().slice(0, 8),
                dayHeaderFormat: { weekday: 'short' },
                customButtons: {
                    calendarSchoolButton: {
                        text: '🖼️ Calendrier scolaire',
                        click: openCalendarImageModal
                    }
                },
                headerToolbar: {
                    left: 'prev,next today',
                    center: 'title',
                    right: 'calendarSchoolButton timeGridDay,timeGridWeek,dayGridMonth,multiMonthYear'
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
                selectable: true,
                select: function(info) {
                    openEventModal(info.startStr, info.endStr, info.allDay, calendar);
                },
                eventClick: function(info) {
                    showEventDetailModal(info.event, calendar);
                },
                events: allEvents,
                height: 'auto',
                expandRows: true,
                slotLaneDidMount: function(info) {
                    var view = calendar.view;
                    // Appliquer les customisations uniquement pour les vues timeGrid (jour/semaine)
                    if (view.type === 'timeGridDay' || view.type === 'timeGridWeek') {
                        var slotTime = info.date;
                        var hours = slotTime.getHours();
                        var minutes = slotTime.getMinutes();
                        
                        // Ligne pointillée à 8h00
                        if (hours === 8 && minutes === 0) {
                            info.el.style.borderTop = '2px dashed #3b82f6';
                            info.el.style.position = 'relative';
                        }
                        
                        // Ligne pointillée à 17h10
                        if (hours === 17 && minutes === 0) {
                            // FullCalendar affiche par tranches de 30min, donc on cible 17h00
                            var afterEl = document.createElement('div');
                            afterEl.style.position = 'absolute';
                            afterEl.style.top = '20px'; // 10 minutes = 1/3 de slot de 30min ≈ 20px
                            afterEl.style.left = '0';
                            afterEl.style.right = '0';
                            afterEl.style.borderTop = '2px dashed #3b82f6';
                            afterEl.style.zIndex = '10';
                            info.el.style.position = 'relative';
                            info.el.appendChild(afterEl);
                        }
                        
                        // Zone grisée : Récréation 9h50-10h05
                        if ((hours === 9 && minutes === 30) || (hours === 10 && minutes === 0)) {
                            info.el.style.backgroundColor = 'rgba(148, 163, 184, 0.15)';
                            info.el.style.backgroundImage = 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(148, 163, 184, 0.1) 10px, rgba(148, 163, 184, 0.1) 20px)';
                        }
                        
                        // Zone grisée : Pause méridienne 11h55-13h15
                        if ((hours === 11 && minutes === 30) || 
                            (hours === 12 && (minutes === 0 || minutes === 30)) ||
                            (hours === 13 && minutes === 0)) {
                            info.el.style.backgroundColor = 'rgba(148, 163, 184, 0.2)';
                            info.el.style.backgroundImage = 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(148, 163, 184, 0.15) 10px, rgba(148, 163, 184, 0.15) 20px)';
                        }
                        
                        // Zone grisée : Récréation 15h05-15h20
                        if (hours === 15 && minutes === 0) {
                            info.el.style.backgroundColor = 'rgba(148, 163, 184, 0.15)';
                            info.el.style.backgroundImage = 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(148, 163, 184, 0.1) 10px, rgba(148, 163, 184, 0.1) 20px)';
                        }
                    }
                }
            });
            calendar.on('eventAdd', function(info) { saveEventsToStorage(calendar.getEvents()); syncCalendarEventAdd(info.event); });
            calendar.on('eventRemove', function(info) { saveEventsToStorage(calendar.getEvents()); syncCalendarEventRemove(info.event); });
            calendar.on('eventChange', function(info) { saveEventsToStorage(calendar.getEvents()); syncCalendarEventChange(info.event); });
            calendar.render();
        }
            // Modale détails événement
            function showEventDetailModal(event, calendar) {
                var modal = document.getElementById('event-detail-modal');
                var content = document.getElementById('event-detail-content');
                var closeBtn = document.getElementById('close-detail-modal');
                var closeBtn2 = document.getElementById('close-detail-btn');
                var editBtn = document.getElementById('edit-event-btn');
                var deleteBtn = document.getElementById('delete-event-btn');
                content.innerHTML = `
                    <p><strong>Titre :</strong> ${event.title}</p>
                    <p><strong>Type :</strong> ${event.extendedProps.type === 'todo' ? 'Todo' : (event.extendedProps.type === 'rdv' ? 'Rendez-vous' : 'Événement')}</p>
                    <p><strong>Lieu :</strong> ${event.extendedProps.lieu || ''}</p>
                    <p><strong>Description :</strong> ${event.extendedProps.description || ''}</p>
                    <p><strong>Début :</strong> ${event.start ? event.start.toLocaleString('fr-FR') : ''}</p>
                    <p><strong>Fin :</strong> ${event.end ? event.end.toLocaleString('fr-FR') : ''}</p>
                `;
                modal.style.display = 'flex';
                function closeModal() { modal.style.display = 'none'; }
                closeBtn.onclick = closeModal;
                closeBtn2.onclick = closeModal;
                modal.onclick = function(e) { if (e.target === modal) closeModal(); };
                editBtn.onclick = function() {
                    closeModal();
                    openEventModal(null, null, false, calendar, event);
                };
                deleteBtn.onclick = function() {
                    if (confirm('Supprimer cet événement ?')) {
                        event.remove();
                        closeModal();
                    }
                };
            }
        
        // Gestionnaires pour import/export emploi du temps
        var importEmploiBtn = container.querySelector('#import-emploi-btn');
        var importEmploiInput = container.querySelector('#import-emploi-input');
        var exportEmploiBtn = container.querySelector('#export-emploi-btn');
        var helpEmploiBtn = container.querySelector('#help-emploi-btn');
        
        importEmploiBtn.addEventListener('click', function() {
            importEmploiInput.click();
        });
        
        importEmploiInput.addEventListener('change', function(e) {
            var file = e.target.files[0];
            if (!file) return;
            
            var reader = new FileReader();
            reader.onload = function(event) {
                try {
                    var csv = event.target.result;
                    var lines = csv.split('\n').filter(l => l.trim());
                    var imported = 0;
                    
                    // Ignorer la ligne d'en-tête si elle existe
                    var startIndex = lines[0].toLowerCase().includes('titre') ? 1 : 0;
                    
                    for (var i = startIndex; i < lines.length; i++) {
                        var parts = lines[i].split(';');
                        if (parts.length < 4) continue;
                        
                        var titre = parts[0].trim();
                        var jour = parts[1].trim(); // Lundi, Mardi, etc. ou date YYYY-MM-DD
                        var heureDebut = parts[2].trim(); // HH:MM
                        var heureFin = parts[3].trim(); // HH:MM
                        var recurrent = parts[4] ? parts[4].trim().toLowerCase() === 'oui' : false;
                        
                        if (!titre || !jour || !heureDebut || !heureFin) continue;
                        
                        // Convertir le jour en numéro (0=dimanche, 1=lundi, etc.)
                        var jourNum = -1;
                        var joursMap = {
                            'lundi': 1, 'mardi': 2, 'mercredi': 3, 'jeudi': 4, 'vendredi': 5
                        };
                        
                        if (joursMap[jour.toLowerCase()] !== undefined) {
                            jourNum = joursMap[jour.toLowerCase()];
                        }
                        
                        if (jourNum !== -1) {
                            // Créer un événement récurrent pour ce jour de la semaine
                            var today = new Date();
                            var currentDay = today.getDay();
                            var daysUntilTarget = (jourNum - currentDay + 7) % 7;
                            if (daysUntilTarget === 0 && today.getHours() > parseInt(heureFin.split(':')[0])) {
                                daysUntilTarget = 7;
                            }
                            
                            var targetDate = new Date(today);
                            targetDate.setDate(today.getDate() + daysUntilTarget);
                            
                            var dateStr = targetDate.toISOString().split('T')[0];
                            
                            var event = {
                                title: titre,
                                start: dateStr + 'T' + heureDebut + ':00',
                                end: dateStr + 'T' + heureFin + ':00',
                                allDay: false
                            };
                            
                            if (recurrent) {
                                event.daysOfWeek = [jourNum];
                                event.startRecur = dateStr;
                                event.endRecur = null; // Récurrent indéfiniment
                            }
                            
                            calendar.addEvent(event);
                            imported++;
                        }
                    }
                    
                    alert('✅ ' + imported + ' cours importés avec succès !');
                    importEmploiInput.value = '';
                } catch (error) {
                    alert('❌ Erreur lors de l\'import : ' + error.message);
                }
            };
            reader.readAsText(file);
        });
        
        exportEmploiBtn.addEventListener('click', function() {
            var events = calendar.getEvents();
            var csv = 'Titre;Jour;Heure début;Heure fin;Récurrent\n';
            
            var joursNoms = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
            
            events.forEach(function(event) {
                var titre = event.title || '';
                var start = event.start;
                var end = event.end || event.start;
                
                var jour = '';
                if (event.extendedProps.daysOfWeek && event.extendedProps.daysOfWeek.length > 0) {
                    jour = joursNoms[event.extendedProps.daysOfWeek[0]];
                } else {
                    jour = start.toISOString().split('T')[0];
                }
                
                var heureDebut = start.toTimeString().substring(0, 5);
                var heureFin = end.toTimeString().substring(0, 5);
                var recurrent = event.extendedProps.daysOfWeek ? 'Oui' : 'Non';
                
                csv += titre + ';' + jour + ';' + heureDebut + ';' + heureFin + ';' + recurrent + '\n';
            });
            
            var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            var link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'emploi-du-temps.csv';
            link.click();
        });
        
        helpEmploiBtn.addEventListener('click', function() {
            alert('📋 FORMAT CSV POUR L\'IMPORT D\'EMPLOI DU TEMPS\n\n' +
                  'Créez un fichier CSV avec point-virgule (;) comme séparateur :\n\n' +
                  'Titre;Jour;Heure début;Heure fin;Récurrent\n' +
                  'Mathématiques;Lundi;08:00;09:00;Oui\n' +
                  'Français;Mardi;10:15;12:15;Oui\n\n' +
                  '📌 Colonnes :\n' +
                  '• Titre : Nom du cours\n' +
                  '• Jour : Lundi, Mardi, Mercredi, Jeudi, Vendredi\n' +
                  '• Heure début : Format HH:MM (ex: 08:00)\n' +
                  '• Heure fin : Format HH:MM (ex: 09:00)\n' +
                  '• Récurrent : Oui (répète chaque semaine) ou Non\n\n' +
                  '💡 Conseil : Utilisez Excel ou LibreOffice Calc,\n' +
                  'puis enregistrez au format CSV avec séparateur point-virgule.');
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

    // Modale événement/todo
    function openEventModal(startStr, endStr, allDay, calendar, eventToEdit) {
        var modal = document.getElementById('event-modal');
        var form = document.getElementById('event-form');
        var closeBtn = document.getElementById('close-event-modal');
        var cancelBtn = document.getElementById('event-cancel-btn');
        form.reset();
        if (eventToEdit) {
            document.getElementById('event-title').value = eventToEdit.title.replace(/^📝 |^📅 |^📍 /, '');
            document.getElementById('event-type').value = eventToEdit.extendedProps.type || 'event';
            document.getElementById('event-lieu').value = eventToEdit.extendedProps.lieu || '';
            document.getElementById('event-desc').value = eventToEdit.extendedProps.description || '';
            document.getElementById('event-start').value = eventToEdit.start ? eventToEdit.start.toISOString().slice(0,16) : '';
            document.getElementById('event-end').value = eventToEdit.end ? eventToEdit.end.toISOString().slice(0,16) : '';
        } else {
            document.getElementById('event-start').value = startStr ? startStr.substring(0, 16) : '';
            document.getElementById('event-end').value = endStr ? endStr.substring(0, 16) : '';
        }
        modal.style.display = 'flex';
        function closeModal() { modal.style.display = 'none'; }
        closeBtn.onclick = closeModal;
        cancelBtn.onclick = closeModal;
        form.onsubmit = function(e) {
            e.preventDefault();
            var title = document.getElementById('event-title').value;
            var desc = document.getElementById('event-desc').value;
            var type = document.getElementById('event-type').value;
            var lieu = document.getElementById('event-lieu').value;
            var start = document.getElementById('event-start').value;
            var end = document.getElementById('event-end').value;
            var icon = type === 'todo' ? '📝 ' : (type === 'rdv' ? '📅 ' : (lieu ? '📍 ' : ''));
            if (title && start) {
                if (eventToEdit) {
                    eventToEdit.setProp('title', icon + title);
                    eventToEdit.setExtendedProp('description', desc);
                    eventToEdit.setExtendedProp('type', type);
                    eventToEdit.setExtendedProp('lieu', lieu);
                    eventToEdit.setStart(start);
                    eventToEdit.setEnd(end || null);
                } else {
                    calendar.addEvent({
                        title: icon + title,
                        description: desc,
                        type: type,
                        lieu: lieu,
                        start: start,
                        end: end || undefined,
                        allDay: allDay
                    });
                }
            }
            closeModal();
        };
        modal.onclick = function(e) { if (e.target === modal) closeModal(); };
    }

    // Persistance locale des événements (cache hors-ligne, toujours tenu à jour)
    // Note : les jours fériés / vacances scolaires n'ont pas de extendedProps.type,
    // on les exclut donc pour ne jamais les dupliquer en "événement utilisateur".
    function isUserCalendarEvent(ev) {
        return !!(ev && ev.extendedProps && typeof ev.extendedProps.type !== 'undefined');
    }
    function saveEventsToStorage(events) {
        var data = events.filter(isUserCalendarEvent).map(function(ev) {
            var emoji = ev.extendedProps.emoji || '';
            return {
                id: ev.id || null,
                title: (emoji && ev.title.indexOf(emoji + ' ') === 0) ? ev.title.slice(emoji.length + 1) : ev.title,
                start: ev.start ? ev.start.toISOString() : null,
                end: ev.end ? ev.end.toISOString() : null,
                allDay: ev.allDay,
                description: ev.extendedProps.description || '',
                type: ev.extendedProps.type || 'event',
                lieu: ev.extendedProps.lieu || '',
                color: ev.extendedProps.color || '',
                emoji: emoji,
                done: !!ev.extendedProps.done,
                reminderMinutes: (ev.extendedProps.reminderMinutes === null || ev.extendedProps.reminderMinutes === undefined) ? null : Number(ev.extendedProps.reminderMinutes),
                source: ev.extendedProps.source || 'calendar'
            };
        });
        try {
            localStorage.setItem('eprof-events', JSON.stringify(data));
        } catch(e) {}
    }
    function loadEventsFromStorage() {
        try {
            var data = JSON.parse(localStorage.getItem('eprof-events') || '[]');
            return data.map(function(ev) {
                return {
                    id: ev.id || undefined,
                    title: ev.title,
                    start: ev.start,
                    end: ev.end,
                    allDay: ev.allDay,
                    description: ev.description,
                    type: ev.type,
                    lieu: ev.lieu,
                    color: ev.color || '',
                    emoji: ev.emoji || '',
                    done: !!ev.done,
                    reminderMinutes: (ev.reminderMinutes === null || ev.reminderMinutes === undefined) ? null : Number(ev.reminderMinutes),
                    source: ev.source || 'calendar'
                };
            });
        } catch(e) { return []; }
    }

    // L'emoji et la couleur sont stockés à part : on ne les applique qu'à l'affichage FullCalendar
    function toDisplayEvent(ev) {
        return Object.assign({}, ev, {
            title: (ev.emoji ? ev.emoji + ' ' : '') + ev.title,
            backgroundColor: ev.color || undefined,
            borderColor: ev.color || undefined
        });
    }

    // ===== Synchronisation en ligne (Supabase) =====
    function isUuid(value) {
        return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    }
    function calendarEventToRow(ev, teacherId) {
        var emoji = ev.extendedProps.emoji || null;
        // Le titre affiché est préfixé de l'emoji : on le retire avant enregistrement pour ne pas l'empiler
        var rawTitle = (emoji && ev.title.indexOf(emoji + ' ') === 0) ? ev.title.slice(emoji.length + 1) : ev.title;
        return {
            teacher_id: teacherId,
            title: rawTitle,
            event_type: ev.extendedProps.type || 'event',
            lieu: ev.extendedProps.lieu || null,
            description: ev.extendedProps.description || null,
            start_at: ev.start ? ev.start.toISOString() : null,
            end_at: ev.end ? ev.end.toISOString() : null,
            all_day: !!ev.allDay,
            color: ev.extendedProps.color || null,
            emoji: emoji,
            done: !!ev.extendedProps.done,
            reminder_minutes: (ev.extendedProps.reminderMinutes === null || ev.extendedProps.reminderMinutes === undefined) ? null : Number(ev.extendedProps.reminderMinutes),
            source: ev.extendedProps.source || 'calendar'
        };
    }
    async function loadCalendarEvents() {
        var online = window.EprofStore && await window.EprofStore.isOnlineReady();
        if (!online) return loadEventsFromStorage();

        var teacherId = await window.EprofStore.getTeacherId();
        var result = await window.EprofStore.list('calendar_events', { filters: { teacher_id: teacherId }, orderBy: 'start_at' });
        if (result.error || !result.data) {
            console.warn('⚠️ Calendrier : bascule sur le cache local (Supabase indisponible).', result.error);
            return loadEventsFromStorage();
        }

        var events = result.data.map(function(row) {
            return {
                id: row.id,
                title: row.title,
                start: row.start_at,
                end: row.end_at || undefined,
                allDay: row.all_day,
                description: row.description || '',
                type: row.event_type || 'event',
                lieu: row.lieu || '',
                color: row.color || '',
                emoji: row.emoji || '',
                done: !!row.done,
                reminderMinutes: (row.reminder_minutes === null || row.reminder_minutes === undefined) ? null : Number(row.reminder_minutes),
                source: row.source || 'calendar'
            };
        });

        try {
            localStorage.setItem('eprof-events', JSON.stringify(events));
        } catch (e) {}

        return events;
    }
    async function syncCalendarEventAdd(ev) {
        if (!isUserCalendarEvent(ev) || !window.EprofStore) return;
        var teacherId = await window.EprofStore.getTeacherId();
        if (!teacherId) return; // hors ligne : reste uniquement dans le cache local
        var result = await window.EprofStore.insert('calendar_events', calendarEventToRow(ev, teacherId));
        if (!result.error && result.data && result.data.id) {
            ev.setProp('id', result.data.id); // aligne l'id local sur l'id Supabase pour les prochaines maj/suppr
        }
    }
    async function syncCalendarEventChange(ev) {
        if (!isUserCalendarEvent(ev) || !window.EprofStore) return;
        var teacherId = await window.EprofStore.getTeacherId();
        if (!teacherId) return;
        if (!isUuid(ev.id)) return syncCalendarEventAdd(ev); // jamais synchronisé -> on le crée maintenant
        await window.EprofStore.update('calendar_events', ev.id, calendarEventToRow(ev, teacherId));
    }
    async function syncCalendarEventRemove(ev) {
        if (!isUserCalendarEvent(ev) || !window.EprofStore || !isUuid(ev.id)) return;
        await window.EprofStore.remove('calendar_events', ev.id);
    }

    // Conversion fusionnée
    function renderFileConverter(container) {
        container.innerHTML = `<div id="file-converter-module">
            <h3>Conversion de fichiers</h3>
            <div class="converter-controls">
                <input type="file" id="file-input" accept=".csv,.xlsx,.xls,.pdf,.docx,.doc" />
                <select id="convert-type">
                    <option value="">-- Sélectionnez une conversion --</option>
                    <option value="csv2xlsx">CSV → Excel (XLSX)</option>
                    <option value="xlsx2csv">Excel (XLSX) → CSV</option>
                    <option value="xlsx2pdf">Excel (XLSX) → PDF ✨</option>
                    <option value="docx2html">Word (DOCX) → HTML</option>
                    <option value="docx2pdf">Word (DOCX) → PDF ✨</option>
                </select>
                <button id="convert-btn">Convertir</button>
            </div>
            <div class="converter-preview">
                <div class="preview-panel">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                        <h4 style="margin:0;">Aperçu original</h4>
                        <button id="fullscreen-original" class="btn-fullscreen" style="background:#2563eb;color:white;padding:6px 12px;border:none;border-radius:6px;cursor:pointer;font-size:0.9rem;" title="Afficher en plein écran">🔍 Plein écran</button>
                    </div>
                    <div id="preview-original" class="preview-content"></div>
                </div>
                <div class="preview-panel">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                        <h4 style="margin:0;">Aperçu converti</h4>
                        <button id="fullscreen-converted" class="btn-fullscreen" style="background:#2563eb;color:white;padding:6px 12px;border:none;border-radius:6px;cursor:pointer;font-size:0.9rem;" title="Afficher en plein écran">🔍 Plein écran</button>
                    </div>
                    <div id="preview-converted" class="preview-content"></div>
                </div>
            </div>
            <div id="convert-result"></div>
            <div id="download-container" style="text-align:center;margin-top:20px;display:none;">
                <button id="download-btn" class="btn-download" style="background:#10b981;color:white;padding:12px 30px;border:none;border-radius:8px;font-size:1rem;font-weight:600;cursor:pointer;">📥 Télécharger le fichier converti</button>
            </div>
        </div>
        <div id="fullscreen-modal" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;width:100%;height:100%;background:rgba(0,0,0,0.95);z-index:10000;">
            <button id="close-fullscreen" style="position:fixed;top:15px;right:15px;background:#ef4444;color:white;padding:10px 20px;border:none;border-radius:8px;cursor:pointer;font-size:1rem;z-index:10002;box-shadow:0 4px 8px rgba(0,0,0,0.3);">✕ Fermer</button>
            <div id="fullscreen-content" style="position:absolute;top:60px;left:0;right:0;bottom:0;overflow:auto;background:white;padding:20px;"></div>
        </div>`;

        var fileInput = container.querySelector('#file-input');
        var convertType = container.querySelector('#convert-type');
        var convertBtn = container.querySelector('#convert-btn');
        var resultDiv = container.querySelector('#convert-result');
        var previewOriginal = container.querySelector('#preview-original');
        var previewConverted = container.querySelector('#preview-converted');
        var fullscreenOriginalBtn = container.querySelector('#fullscreen-original');
        var fullscreenConvertedBtn = container.querySelector('#fullscreen-converted');
        var fullscreenModal = document.getElementById('fullscreen-modal');
        var fullscreenContent = document.getElementById('fullscreen-content');
        var closeFullscreenBtn = document.getElementById('close-fullscreen');
        var currentFile = null;

        // Charger les bibliothèques nécessaires
        loadLibraries();

        // Gestion du plein écran
        fullscreenOriginalBtn.addEventListener('click', function() {
            showFullscreen(previewOriginal);
        });

        fullscreenConvertedBtn.addEventListener('click', function() {
            showFullscreen(previewConverted);
        });

        closeFullscreenBtn.addEventListener('click', function() {
            fullscreenModal.style.display = 'none';
        });

        fullscreenModal.addEventListener('click', function(e) {
            if (e.target === fullscreenModal) {
                fullscreenModal.style.display = 'none';
            }
        });

        function showFullscreen(element) {
            fullscreenContent.innerHTML = element.innerHTML;
            fullscreenModal.style.display = 'block';
            
            // Forcer les iframes et autres éléments à prendre toute la hauteur
            var iframes = fullscreenContent.querySelectorAll('iframe');
            iframes.forEach(function(iframe) {
                iframe.style.width = '100%';
                iframe.style.height = '100%';
                iframe.style.minHeight = 'calc(100vh - 80px)';
                iframe.style.border = 'none';
            });
            
            // Forcer les divs de prévisualisation à prendre toute la hauteur
            var previewDivs = fullscreenContent.querySelectorAll('div');
            previewDivs.forEach(function(div) {
                if (div.style.overflow || div.style.maxHeight) {
                    div.style.maxHeight = 'none';
                    div.style.height = 'auto';
                }
            });
        }

        // Filtrer les options de conversion selon le type de fichier
        function updateConversionOptions(fileExtension) {
            var options = {
                'csv': [
                    { value: '', text: '-- Sélectionnez une conversion --' },
                    { value: 'csv2xlsx', text: 'CSV → Excel (XLSX)' }
                ],
                'xlsx': [
                    { value: '', text: '-- Sélectionnez une conversion --' },
                    { value: 'xlsx2csv', text: 'Excel (XLSX) → CSV' },
                    { value: 'xlsx2pdf', text: 'Excel (XLSX) → PDF ✨' }
                ],
                'xls': [
                    { value: '', text: '-- Sélectionnez une conversion --' },
                    { value: 'xlsx2csv', text: 'Excel (XLSX) → CSV' },
                    { value: 'xlsx2pdf', text: 'Excel (XLSX) → PDF ✨' }
                ],
                'docx': [
                    { value: '', text: '-- Sélectionnez une conversion --' },
                    { value: 'docx2html', text: 'Word (DOCX) → HTML' },
                    { value: 'docx2pdf', text: 'Word (DOCX) → PDF ✨' }
                ],
                'doc': [
                    { value: '', text: '-- Sélectionnez une conversion --' },
                    { value: 'docx2html', text: 'Word (DOCX) → HTML' },
                    { value: 'docx2pdf', text: 'Word (DOCX) → PDF ✨' }
                ]
            };

            var availableOptions = options[fileExtension] || [
                { value: '', text: '-- Aucune conversion disponible pour ce format --' }
            ];

            convertType.innerHTML = '';
            availableOptions.forEach(function(opt) {
                var option = document.createElement('option');
                option.value = opt.value;
                option.textContent = opt.text;
                convertType.appendChild(option);
            });
        }

        fileInput.addEventListener('change', function(e) {
            if (fileInput.files.length > 0) {
                currentFile = fileInput.files[0];
                var ext = currentFile.name.split('.').pop().toLowerCase();
                
                // Mettre à jour les options de conversion selon le type de fichier
                updateConversionOptions(ext);
                
                showOriginalPreview(currentFile, previewOriginal);
                previewConverted.innerHTML = '<p style="color:#888;">Sélectionnez un format de conversion et cliquez sur Convertir</p>';
                resultDiv.innerHTML = '';
                // Cacher le bouton de téléchargement
                document.getElementById('download-container').style.display = 'none';
            }
        });

        convertBtn.onclick = function() {
            if (!currentFile) {
                resultDiv.innerHTML = '<span style="color:red">Sélectionnez un fichier à convertir.</span>';
                return;
            }
            var type = convertType.value;
            if (!type) {
                resultDiv.innerHTML = '<span style="color:red">Sélectionnez un format de conversion.</span>';
                return;
            }
            // Cacher le bouton de téléchargement pendant la conversion
            document.getElementById('download-container').style.display = 'none';
            performConversion(currentFile, type, previewConverted, resultDiv);
        };

        function showOriginalPreview(file, previewEl) {
            var ext = file.name.split('.').pop().toLowerCase();
            previewEl.innerHTML = '<p style="color:#888;">Chargement de l\'aperçu...</p>';
            
            if (ext === 'pdf') {
                var reader = new FileReader();
                reader.onload = function(e) {
                    previewEl.innerHTML = `<iframe src="${e.target.result}" style="width:100%;height:500px;border:1px solid #ddd;"></iframe>`;
                };
                reader.readAsDataURL(file);
            } else if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
                var reader = new FileReader();
                reader.onload = function(e) {
                    if (!window.XLSX) {
                        previewEl.innerHTML = '<p style="color:red;">Bibliothèque XLSX non chargée</p>';
                        return;
                    }
                    var data = new Uint8Array(e.target.result);
                    var workbook = XLSX.read(data, {type: 'array'});
                    var firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    var html = XLSX.utils.sheet_to_html(firstSheet);
                    previewEl.innerHTML = `<div style="overflow:auto;max-height:500px;">${html}</div>`;
                };
                reader.readAsArrayBuffer(file);
            } else if (ext === 'docx' || ext === 'doc') {
                var reader = new FileReader();
                reader.onload = function(e) {
                    if (window.mammoth) {
                        mammoth.convertToHtml({arrayBuffer: e.target.result})
                            .then(function(result) {
                                previewEl.innerHTML = `<div style="overflow:auto;max-height:500px;padding:1em;border:1px solid #ddd;background:#fff;">${result.value}</div>`;
                            })
                            .catch(function(err) {
                                previewEl.innerHTML = `<p style="color:red;">Erreur : ${err.message}</p>`;
                            });
                    } else {
                        previewEl.innerHTML = '<p style="color:orange;">Aperçu DOCX non disponible (bibliothèque mammoth non chargée)</p>';
                    }
                };
                reader.readAsArrayBuffer(file);
            } else {
                previewEl.innerHTML = '<p style="color:#888;">Aperçu non disponible pour ce type de fichier</p>';
            }
        }

        function performConversion(file, type, previewEl, resultEl) {
            resultEl.innerHTML = '<p style="color:#1a2236;">Conversion en cours...</p>';
            
            if (type === 'csv2xlsx') {
                convertCSVtoXLSX(file, previewEl, resultEl);
            } else if (type === 'xlsx2csv') {
                convertXLSXtoCSV(file, previewEl, resultEl);
            } else if (type === 'xlsx2pdf') {
                convertXLSXtoPDF(file, previewEl, resultEl);
            } else if (type === 'docx2html') {
                convertDOCXtoHTML(file, previewEl, resultEl);
            } else if (type === 'docx2pdf') {
                convertDOCXtoPDF(file, previewEl, resultEl);
            }
        }

        function convertCSVtoXLSX(file, previewEl, resultEl) {
            var reader = new FileReader();
            reader.onload = function(e) {
                var text = e.target.result;
                var rows = text.split(/\r?\n/).map(function(l) { return l.split(';'); });
                // XLSX est déjà chargé depuis libs/xlsx.full.min.js
                finishCSVtoXLSX(rows, file.name, previewEl, resultEl);
            };
            reader.readAsText(file);
        }

        function finishCSVtoXLSX(rows, filename, previewEl, resultEl) {
            var wb = XLSX.utils.book_new();
            var ws = XLSX.utils.aoa_to_sheet(rows);
            XLSX.utils.book_append_sheet(wb, ws, 'Feuille1');
            var html = XLSX.utils.sheet_to_html(ws);
            previewEl.innerHTML = `<div style="overflow:auto;max-height:500px;">${html}</div>`;
            var wbout = XLSX.write(wb, {bookType:'xlsx', type:'array'});
            var blob = new Blob([wbout]);
            var newFilename = filename.replace(/\.csv$/i, '.xlsx');
            setupDownloadButton(blob, newFilename);
            resultEl.innerHTML = '<span style="color:green;">✓ Conversion terminée ! Cliquez sur le bouton pour télécharger.</span>';
        }

        function convertXLSXtoCSV(file, previewEl, resultEl) {
            var reader = new FileReader();
            reader.onload = function(e) {
                var data = new Uint8Array(e.target.result);
                // XLSX est déjà chargé depuis libs/xlsx.full.min.js
                finishXLSXtoCSV(data, file.name, previewEl, resultEl);
            };
            reader.readAsArrayBuffer(file);
        }

        function finishXLSXtoCSV(data, filename, previewEl, resultEl) {
            var wb = XLSX.read(data, {type:'array'});
            var ws = wb.Sheets[wb.SheetNames[0]];
            var csv = XLSX.utils.sheet_to_csv(ws, {FS:';'});
            previewEl.innerHTML = `<pre style="overflow:auto;max-height:500px;padding:1em;border:1px solid #ddd;background:#f9f9f9;">${csv}</pre>`;
            var blob = new Blob([csv]);
            var newFilename = filename.replace(/\.xlsx$/i, '.csv');
            setupDownloadButton(blob, newFilename);
            resultEl.innerHTML = '<span style="color:green;">✓ Conversion terminée ! Cliquez sur le bouton pour télécharger.</span>';
        }

        function convertXLSXtoPDF(file, previewEl, resultEl) {
            var reader = new FileReader();
            reader.onload = function(e) {
                var data = new Uint8Array(e.target.result);
                // XLSX est déjà chargé depuis libs/xlsx.full.min.js
                finishXLSXtoPDF(data, file.name, previewEl, resultEl);
            };
            reader.readAsArrayBuffer(file);
        }

        function finishXLSXtoPDF(data, filename, previewEl, resultEl) {
            try {
                var wb = XLSX.read(data, {type:'array'});
                var ws = wb.Sheets[wb.SheetNames[0]];
                var html = XLSX.utils.sheet_to_html(ws);
                
                // Afficher l'aperçu
                previewEl.innerHTML = `<div style="overflow:auto;max-height:500px;">${html}</div>`;
                
                // Générer le PDF avec jsPDF
                if (window.jspdf && window.jspdf.jsPDF) {
                    var { jsPDF } = window.jspdf;
                    var pdf = new jsPDF('l', 'mm', 'a4');
                    
                    // Convertir les données XLSX en tableau
                    var range = XLSX.utils.decode_range(ws['!ref']);
                    var y = 10;
                    
                    pdf.setFontSize(10);
                    
                    for (var R = range.s.r; R <= range.e.r; ++R) {
                        var x = 10;
                        for (var C = range.s.c; C <= range.e.c; ++C) {
                            var cellAddress = XLSX.utils.encode_cell({r: R, c: C});
                            var cell = ws[cellAddress];
                            var cellValue = cell ? (cell.v || '') : '';
                            
                            pdf.text(String(cellValue), x, y);
                            x += 40;
                            
                            if (x > 280) break; // Limite de page
                        }
                        y += 7;
                        
                        if (y > 200) {
                            pdf.addPage();
                            y = 10;
                        }
                    }
                    
                    var pdfBlob = pdf.output('blob');
                    var newFilename = filename.replace(/\.xlsx$/i, '.pdf');
                    setupDownloadButton(pdfBlob, newFilename);
                    resultEl.innerHTML = '<span style="color:green;">✓ Conversion XLSX → PDF terminée ! Cliquez sur le bouton pour télécharger.</span>';
                } else {
                    resultEl.innerHTML = '<span style="color:red;">❌ jsPDF non chargé</span>';
                }
            } catch(err) {
                resultEl.innerHTML = `<span style="color:red;">Erreur : ${err.message}</span>`;
            }
        }

        function convertDOCXtoHTML(file, previewEl, resultEl) {
            var reader = new FileReader();
            reader.onload = function(e) {
                // Mammoth est déjà chargé depuis libs/mammoth.browser.min.js
                mammoth.convertToHtml({arrayBuffer: e.target.result})
                    .then(function(result) {
                        var htmlContent = result.value;
                        previewEl.innerHTML = `<div style="overflow:auto;max-height:500px;padding:1em;border:1px solid #ddd;background:#fff;">${htmlContent}</div>`;
                        var blob = new Blob([`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Converti</title></head><body>${htmlContent}</body></html>`], {type: 'text/html'});
                        var newFilename = file.name.replace(/\.docx$/i, '.html');
                        setupDownloadButton(blob, newFilename);
                        resultEl.innerHTML = '<span style="color:green;">✓ Conversion terminée ! Cliquez sur le bouton pour télécharger.</span>';
                    })
                    .catch(function(err) {
                        resultEl.innerHTML = `<span style="color:red;">Erreur : ${err.message}</span>`;
                    });
            };
            reader.readAsArrayBuffer(file);
        }

        function convertDOCXtoPDF(file, previewEl, resultEl) {
            var reader = new FileReader();
            reader.onload = function(e) {
                // Mammoth, jsPDF et html2canvas sont déjà chargés depuis libs/
                mammoth.convertToHtml({arrayBuffer: e.target.result})
                    .then(function(result) {
                        var htmlContent = result.value;
                        
                        // Créer un conteneur temporaire pour le rendu
                        var tempDiv = document.createElement('div');
                        tempDiv.style.width = '800px';
                        tempDiv.style.padding = '20px';
                        tempDiv.style.background = 'white';
                        tempDiv.style.position = 'absolute';
                        tempDiv.style.left = '-9999px';
                        tempDiv.innerHTML = htmlContent;
                        document.body.appendChild(tempDiv);
                        
                        // Afficher l'aperçu
                        previewEl.innerHTML = `<div style="overflow:auto;max-height:500px;padding:1em;border:1px solid #ddd;background:#fff;">${htmlContent}</div>`;
                        
                        // Convertir en PDF avec html2canvas
                        html2canvas(tempDiv, {
                            scale: 2,
                            logging: false,
                            backgroundColor: '#ffffff'
                        }).then(function(canvas) {
                            var { jsPDF } = window.jspdf;
                            var imgData = canvas.toDataURL('image/png');
                            var pdf = new jsPDF('p', 'mm', 'a4');
                            var imgWidth = 210;
                            var imgHeight = (canvas.height * imgWidth) / canvas.width;
                            
                            pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
                            var pdfBlob = pdf.output('blob');
                            var newFilename = file.name.replace(/\.docx$/i, '.pdf');
                            
                            // Nettoyer
                            document.body.removeChild(tempDiv);
                            setupDownloadButton(pdfBlob, newFilename);
                            resultEl.innerHTML = '<span style="color:green;">✓ Conversion DOCX → PDF terminée ! Cliquez sur le bouton pour télécharger.</span>';
                        }).catch(function(err) {
                            document.body.removeChild(tempDiv);
                            resultEl.innerHTML = `<span style="color:red;">Erreur html2canvas : ${err.message}</span>`;
                        });
                    })
                    .catch(function(err) {
                        resultEl.innerHTML = `<span style="color:red;">Erreur mammoth : ${err.message}</span>`;
                    });
            };
            reader.readAsArrayBuffer(file);
        }

        function setupDownloadButton(blob, filename) {
            var downloadContainer = document.getElementById('download-container');
            var downloadBtn = document.getElementById('download-btn');
            
            // Afficher le conteneur
            downloadContainer.style.display = 'block';
            
            // Supprimer l'ancien listener
            var newBtn = downloadBtn.cloneNode(true);
            downloadBtn.parentNode.replaceChild(newBtn, downloadBtn);
            
            // Ajouter le nouveau listener
            newBtn.addEventListener('click', function() {
                downloadFile(blob, filename);
            });
        }

        function downloadFile(blob, filename) {
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            setTimeout(function() {
                document.body.removeChild(a);
                URL.revokeObjectURL(a.href);
            }, 100);
        }

        function loadLibraries() {
            // Toutes les bibliothèques sont maintenant chargées en local depuis index.html
            // xlsx.full.min.js, mammoth.browser.min.js, jspdf.umd.min.js, html2canvas.min.js
            console.log('📚 Bibliothèques chargées en mode portable:');
            console.log('  ✓ XLSX:', !!window.XLSX);
            console.log('  ✓ Mammoth:', !!window.mammoth);
            console.log('  ✓ jsPDF:', !!window.jspdf);
            console.log('  ✓ html2canvas:', !!window.html2canvas);
        }
    }

    // ========================================
    // FONCTION MISE À JOUR NOTIFICATIONS
    // ========================================
    function updateNotifications() {
        try {
            const suiviData = JSON.parse(localStorage.getItem('suiviEleves') || '{}');
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
        // Charger CSS messagerie dynamiquement
        if (!document.querySelector('link[href="css/messagerie.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'css/messagerie.css';
            document.head.appendChild(link);
        }

        // Charger les données
        let conversations = [];
        let modeles = [];
        let config = { emailjsServiceId: '', emailjsTemplateId: '', emailjsPublicKey: '', signatureEmail: 'Cordialement,\nVotre professeur' };
        
        if (typeof MESSAGERIE_DATA !== 'undefined') {
            conversations = MESSAGERIE_DATA.conversations || [];
            modeles = MESSAGERIE_DATA.modeles || [];
            config = { ...config, ...MESSAGERIE_DATA.config };
        }
        
        const conversationsLS = localStorage.getItem('eprof_messagerie_conversations');
        const modelesLS = localStorage.getItem('eprof_messagerie_modeles');
        const configLS = localStorage.getItem('eprof_messagerie_config');
        
        if (conversationsLS) conversations = JSON.parse(conversationsLS);
        if (modelesLS) modeles = JSON.parse(modelesLS);
        if (configLS) config = { ...config, ...JSON.parse(configLS) };

        // Initialiser EmailJS si configuré
        if (typeof emailjs !== 'undefined' && config.emailjsPublicKey) {
            emailjs.init(config.emailjsPublicKey);
        }

        let currentConversationId = null;
        let searchTerm = '';
        let activeFilter = 'tous';

        container.innerHTML = `
            <div class="messagerie-module">
                <div class="messagerie-container">
                    <!-- Colonne gauche: Conversations -->
                    <div class="conversations-panel">
                        <div class="conversations-header">
                            <h2>📧 Messagerie</h2>
                            <div class="conversations-search">
                                <input type="text" id="search-conversations" placeholder="Rechercher...">
                                <button id="btn-nouveau-message-header">✉️</button>
                            </div>
                        </div>
                        
                        <div class="conversations-filters">
                            <button class="filter-btn active" data-filter="tous">Tous</button>
                            <button class="filter-btn" data-filter="eleve">Élèves</button>
                            <button class="filter-btn" data-filter="parent">Parents</button>
                            <button class="filter-btn" data-filter="collegue">Collègues</button>
                            <button class="filter-btn" data-filter="non-lu">Non lus</button>
                        </div>
                        
                        <div class="conversations-list" id="conversations-list"></div>
                    </div>
                    
                    <!-- Colonne centrale: Messages -->
                    <div class="messages-panel" id="messages-panel">
                        <div class="empty-messages">
                            <div class="empty-messages-icon">💬</div>
                            <h3>Aucune conversation sélectionnée</h3>
                            <p>Sélectionnez une conversation ou créez-en une nouvelle</p>
                            <button class="btn-messagerie btn-primary-msg" id="btn-nouveau-message-empty">
                                ✉️ Nouveau message
                            </button>
                        </div>
                    </div>
                    
                    <!-- Colonne droite: Infos -->
                    <div class="info-panel" id="info-panel">
                        <div class="info-section">
                            <h3>📝 Modèles</h3>
                            <div class="modeles-list" id="modeles-list"></div>
                        </div>
                        
                        <div class="info-section">
                            <h3>⚙️ Actions</h3>
                            <div class="action-buttons">
                                <button class="btn-messagerie btn-secondary-msg" id="btn-configurer-emailjs">
                                    🔧 Configurer EmailJS
                                </button>
                                <button class="btn-messagerie btn-secondary-msg" id="btn-exporter-conversations">
                                    💾 Exporter conversations
                                </button>
                                <button class="btn-messagerie btn-secondary-msg" id="btn-importer-conversations">
                                    📂 Restaurer conversations
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <input type="file" id="import-conversations-input" accept=".js" style="display: none;">
            </div>
            
            <!-- Modal nouveau message -->
            <div class="modal-sejour" id="modal-nouveau-message">
                <div class="modal-content-sejour">
                    <div class="modal-header-sejour">
                        <h3>✉️ Nouveau message</h3>
                        <button class="close-modal-sejour" id="close-nouveau-message-modal">✖</button>
                    </div>
                    <form class="form-sejour" id="form-nouveau-message">
                        <div class="form-group-sejour">
                            <label for="nouveau-destinataire-nom">Nom du destinataire *</label>
                            <input type="text" id="nouveau-destinataire-nom" required placeholder="Nom">
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group-sejour">
                                <label for="nouveau-destinataire-prenom">Prénom</label>
                                <input type="text" id="nouveau-destinataire-prenom" placeholder="Prénom">
                            </div>
                            <div class="form-group-sejour">
                                <label for="nouveau-destinataire-type">Type *</label>
                                <select id="nouveau-destinataire-type" required>
                                    <option value="parent">Parent</option>
                                    <option value="élève">Élève</option>
                                    <option value="collègue">Collègue</option>
                                    <option value="autre">Autre</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group-sejour">
                                <label for="nouveau-destinataire-email">Email *</label>
                                <input type="email" id="nouveau-destinataire-email" required placeholder="email@exemple.fr">
                            </div>
                            <div class="form-group-sejour">
                                <label for="nouveau-classe">Classe</label>
                                <select id="nouveau-classe">
                                    <option value="">Aucune classe</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="form-group-sejour">
                            <label for="nouveau-sujet">Sujet *</label>
                            <input type="text" id="nouveau-sujet" required placeholder="Objet du message">
                        </div>
                        
                        <div class="form-group-sejour">
                            <label for="nouveau-message">Message *</label>
                            <textarea id="nouveau-message" rows="8" required placeholder="Votre message..."></textarea>
                        </div>
                        
                        <div class="modal-actions">
                            <button type="button" class="btn-sejour btn-secondary-sejour" id="cancel-nouveau-message">Annuler</button>
                            <button type="submit" class="btn-sejour btn-primary-sejour">📧 Envoyer</button>
                        </div>
                    </form>
                </div>
            </div>
            
            <!-- Modal configuration EmailJS -->
            <div class="modal-sejour" id="modal-config-emailjs">
                <div class="modal-content-sejour">
                    <div class="modal-header-sejour">
                        <h3>🔧 Configuration EmailJS</h3>
                        <button class="close-modal-sejour" id="close-config-emailjs-modal">✖</button>
                    </div>
                    <form class="form-sejour config-emailjs-form" id="form-config-emailjs">
                        <div class="config-help">
                            <strong>📘 Comment configurer EmailJS :</strong><br>
                            1. Créez un compte gratuit sur <a href="https://www.emailjs.com/" target="_blank">emailjs.com</a><br>
                            2. Créez un service email (Gmail, Outlook...)<br>
                            3. Créez un template de message<br>
                            4. Copiez vos identifiants ci-dessous
                        </div>
                        
                        <div class="form-group-sejour">
                            <label for="config-service-id">Service ID</label>
                            <input type="text" id="config-service-id" placeholder="service_xxxxxxx">
                        </div>
                        
                        <div class="form-group-sejour">
                            <label for="config-template-id">Template ID</label>
                            <input type="text" id="config-template-id" placeholder="template_xxxxxxx">
                        </div>
                        
                        <div class="form-group-sejour">
                            <label for="config-public-key">Public Key</label>
                            <input type="text" id="config-public-key" placeholder="Votre clé publique">
                        </div>
                        
                        <div class="form-group-sejour">
                            <label for="config-signature">Signature email</label>
                            <textarea id="config-signature" rows="4" placeholder="Cordialement,\nVotre professeur"></textarea>
                        </div>
                        
                        <div class="modal-actions">
                            <button type="button" class="btn-sejour btn-secondary-sejour" id="cancel-config-emailjs">Annuler</button>
                            <button type="submit" class="btn-sejour btn-primary-sejour">💾 Enregistrer</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        // Charger les classes dans le select
        const classeSelect = container.querySelector('#nouveau-classe');
        if (typeof LISTES_ELEVES !== 'undefined') {
            Object.keys(LISTES_ELEVES).forEach(classe => {
                const option = document.createElement('option');
                option.value = classe;
                option.textContent = classe;
                classeSelect.appendChild(option);
            });
        }

        // Event listeners pour les boutons
        container.querySelector('#btn-nouveau-message-header')?.addEventListener('click', () => nouveauMessage());
        container.querySelector('#btn-nouveau-message-empty')?.addEventListener('click', () => nouveauMessage());
        container.querySelector('#btn-configurer-emailjs')?.addEventListener('click', () => configurerEmailJS());
        container.querySelector('#btn-exporter-conversations')?.addEventListener('click', () => exporterConversations());
        container.querySelector('#btn-importer-conversations')?.addEventListener('click', () => importerConversations());
        container.querySelector('#close-nouveau-message-modal')?.addEventListener('click', () => closeNouveauMessageModal());
        container.querySelector('#cancel-nouveau-message')?.addEventListener('click', () => closeNouveauMessageModal());
        container.querySelector('#close-config-emailjs-modal')?.addEventListener('click', () => closeConfigEmailJSModal());
        container.querySelector('#cancel-config-emailjs')?.addEventListener('click', () => closeConfigEmailJSModal());

        // Fonctions modales
        function nouveauMessage() {
            const modal = container.querySelector('#modal-nouveau-message');
            modal.style.display = 'flex';
            container.querySelector('#form-nouveau-message').reset();
        }

        function closeNouveauMessageModal() {
            const modal = container.querySelector('#modal-nouveau-message');
            modal.style.display = 'none';
        }

        function configurerEmailJS() {
            const modal = container.querySelector('#modal-config-emailjs');
            modal.style.display = 'flex';
            
            container.querySelector('#config-service-id').value = config.emailjsServiceId || '';
            container.querySelector('#config-template-id').value = config.emailjsTemplateId || '';
            container.querySelector('#config-public-key').value = config.emailjsPublicKey || '';
            container.querySelector('#config-signature').value = config.signatureEmail || '';
        }

        function closeConfigEmailJSModal() {
            const modal = container.querySelector('#modal-config-emailjs');
            modal.style.display = 'none';
        }

        function exporterConversations() {
            const dataStr = `// MESSAGERIE_DATA - Données de la messagerie eProf
// Ce fichier est généré automatiquement lors de l'export
// Pour restaurer vos conversations, importez ce fichier via le bouton "Restaurer"

const MESSAGERIE_DATA = ${JSON.stringify({ conversations, modeles, config }, null, 4)};`;
            
            const blob = new Blob([dataStr], { type: 'text/javascript' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'messagerie-data.js';
            a.click();
            URL.revokeObjectURL(url);
            
            alert('✅ Conversations exportées avec succès !');
        }

        function importerConversations() {
            container.querySelector('#import-conversations-input').click();
        }

        // Fonctions de données
        function sauvegarderConversations() {
            localStorage.setItem('eprof_messagerie_conversations', JSON.stringify(conversations));
        }

        function sauvegarderModeles() {
            localStorage.setItem('eprof_messagerie_modeles', JSON.stringify(modeles));
        }

        function sauvegarderConfig() {
            localStorage.setItem('eprof_messagerie_config', JSON.stringify(config));
        }

        function afficherConversations() {
            const listContainer = container.querySelector('#conversations-list');
            
            let conversationsFiltrees = conversations.filter(conv => {
                const matchSearch = searchTerm === '' || 
                    conv.destinataire.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    conv.destinataire.prenom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    conv.sujet.toLowerCase().includes(searchTerm.toLowerCase());
                
                const matchFilter = activeFilter === 'tous' ||
                    (activeFilter === 'non-lu' && conv.messages.some(m => !m.lu && m.auteur === 'destinataire')) ||
                    (activeFilter !== 'non-lu' && conv.destinataire.type === activeFilter);
                
                return matchSearch && matchFilter;
            });
            
            // Trier par dernière mise à jour
            conversationsFiltrees.sort((a, b) => (b.lastUpdate || 0) - (a.lastUpdate || 0));
            
            if (conversationsFiltrees.length === 0) {
                listContainer.innerHTML = '<div class="empty-state" style="padding: 40px 20px;"><p style="color: #64748b; text-align: center;">Aucune conversation</p></div>';
                return;
            }
            
            listContainer.innerHTML = conversationsFiltrees.map(conv => {
                const initiales = conv.destinataire.nom.charAt(0) + (conv.destinataire.prenom ? conv.destinataire.prenom.charAt(0) : '');
                const unreadCount = conv.messages.filter(m => !m.lu && m.auteur === 'destinataire').length;
                const lastMessage = conv.messages[conv.messages.length - 1];
                const preview = lastMessage ? lastMessage.contenu.substring(0, 50) + '...' : 'Pas de message';
                const date = lastMessage ? new Date(lastMessage.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '';
                
                return `
                    <div class="conversation-item ${currentConversationId === conv.id ? 'active' : ''} ${unreadCount > 0 ? 'unread' : ''}" 
                         onclick="afficherConversation('${conv.id}')">
                        <div class="conversation-avatar">${initiales}</div>
                        <div class="conversation-info">
                            <div class="conversation-name">
                                <span>${conv.destinataire.nom} ${conv.destinataire.prenom || ''}</span>
                                ${unreadCount > 0 ? `<span class="conversation-badge">${unreadCount}</span>` : ''}
                            </div>
                            <div class="conversation-subject">${conv.sujet}</div>
                            <div class="conversation-preview">${preview}</div>
                            <div class="conversation-date">${date}</div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        function afficherConversation(conversationId) {
            currentConversationId = conversationId;
            const conv = conversations.find(c => c.id === conversationId);
            if (!conv) return;
            
            // Marquer tous les messages comme lus
            conv.messages.forEach(m => { if (m.auteur === 'destinataire') m.lu = true; });
            sauvegarderConversations();
            
            const messagesPanel = container.querySelector('#messages-panel');
            const infoPanel = container.querySelector('#info-panel');
            
            // Grouper messages par date
            const messagesByDate = {};
            conv.messages.forEach(msg => {
                const dateKey = new Date(msg.date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                if (!messagesByDate[dateKey]) messagesByDate[dateKey] = [];
                messagesByDate[dateKey].push(msg);
            });
            
            const messagesHTML = Object.entries(messagesByDate).map(([date, msgs]) => `
                <div class="message-group">
                    <div class="message-date-separator"><span>${date}</span></div>
                    ${msgs.map(msg => `
                        <div class="message-item ${msg.auteur === 'moi' ? 'sent' : 'received'}">
                            <div class="message-bubble">
                                <div class="message-content">${msg.contenu.replace(/\n/g, '<br>')}</div>
                                ${msg.pieceJointe ? `
                                    <div class="message-attachment">
                                        📎 ${msg.pieceJointe}
                                    </div>
                                ` : ''}
                                <div class="message-meta">
                                    <span>${new Date(msg.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                                    ${msg.auteur === 'moi' ? '<span class="message-status">✓✓</span>' : ''}
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `).join('');
            
            messagesPanel.innerHTML = `
                <div class="messages-header">
                    <div class="messages-header-info">
                        <h3>${conv.destinataire.nom} ${conv.destinataire.prenom || ''}</h3>
                        <p>${conv.destinataire.type} ${conv.classe ? '• ' + conv.classe : ''}</p>
                    </div>
                    <div class="messages-actions">
                        <button class="btn-messagerie btn-secondary-msg" onclick="exporterConversationPDF('${conv.id}')">
                            📄 Export PDF
                        </button>
                        <button class="btn-messagerie btn-danger-msg" onclick="archiverConversation('${conv.id}')">
                            🗑️ Archiver
                        </button>
                    </div>
                </div>
                
                <div class="messages-content" id="messages-content">
                    ${messagesHTML}
                </div>
                
                <div class="message-composer">
                    <div class="composer-toolbar">
                        <button onclick="chargerModeleMessage('${conv.id}')">📝 Modèle</button>
                        <button onclick="ajouterPieceJointe('${conv.id}')">📎 Pièce jointe</button>
                    </div>
                    <div class="composer-input">
                        <textarea id="message-input-${conv.id}" placeholder="Écrivez votre message..."></textarea>
                        <button class="send-btn" onclick="envoyerMessage('${conv.id}')">Envoyer</button>
                    </div>
                </div>
            `;
            
            // Scroll vers le bas
            setTimeout(() => {
                const messagesContent = container.querySelector('#messages-content');
                if (messagesContent) messagesContent.scrollTop = messagesContent.scrollHeight;
            }, 100);
            
            // Mettre à jour infos panel
            infoPanel.innerHTML = `
                <div class="info-section">
                    <h3>👤 Informations</h3>
                    <div class="info-card">
                        <div class="info-row">
                            <div class="info-label">Nom</div>
                            <div class="info-value">${conv.destinataire.nom} ${conv.destinataire.prenom || ''}</div>
                        </div>
                        <div class="info-row">
                            <div class="info-label">Type</div>
                            <div class="info-value">${conv.destinataire.type}</div>
                        </div>
                        ${conv.destinataire.email ? `
                            <div class="info-row">
                                <div class="info-label">Email</div>
                                <div class="info-value">${conv.destinataire.email}</div>
                            </div>
                        ` : ''}
                        ${conv.classe ? `
                            <div class="info-row">
                                <div class="info-label">Classe</div>
                                <div class="info-value">${conv.classe}</div>
                            </div>
                        ` : ''}
                        <div class="info-row">
                            <div class="info-label">Messages</div>
                            <div class="info-value">${conv.messages.length}</div>
                        </div>
                    </div>
                </div>
                
                <div class="info-section">
                    <h3>📝 Modèles</h3>
                    <div class="modeles-list">
                        ${modeles.map(m => `
                            <div class="modele-item" onclick="utiliserModele('${conv.id}', '${m.id}')">
                                <h4>${m.titre}</h4>
                                <p>${m.sujet}</p>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="info-section">
                    <h3>⚙️ Actions</h3>
                    <div class="action-buttons">
                        <button class="btn-messagerie btn-secondary-msg" onclick="exporterConversationPDF('${conv.id}')">
                            📄 Export PDF
                        </button>
                        <button class="btn-messagerie btn-secondary-msg" onclick="exporterConversations()">
                            💾 Exporter tout
                        </button>
                        <button class="btn-messagerie btn-danger-msg" onclick="archiverConversation('${conv.id}')">
                            🗑️ Archiver
                        </button>
                    </div>
                </div>
            `;
            
            afficherConversations();
        }

        window.envoyerMessage = async function(conversationId) {
            const conv = conversations.find(c => c.id === conversationId);
            if (!conv) return;
            
            const textarea = container.querySelector(`#message-input-${conversationId}`);
            const contenu = textarea.value.trim();
            
            if (!contenu) return;
            
            const message = {
                id: 'msg_' + Date.now(),
                auteur: 'moi',
                contenu: contenu,
                date: new Date().toISOString(),
                lu: true
            };
            
            conv.messages.push(message);
            conv.lastUpdate = Date.now();
            
            // Envoyer via EmailJS si configuré
            if (config.emailjsServiceId && config.emailjsTemplateId && config.emailjsPublicKey && typeof emailjs !== 'undefined') {
                try {
                    await emailjs.send(config.emailjsServiceId, config.emailjsTemplateId, {
                        to_email: conv.destinataire.email,
                        to_name: `${conv.destinataire.nom} ${conv.destinataire.prenom || ''}`,
                        subject: `Re: ${conv.sujet}`,
                        message: contenu + '\n\n' + config.signatureEmail
                    });
                    
                    message.statut = 'envoyé';
                    alert('✅ Email envoyé avec succès !');
                } catch (error) {
                    console.error('Erreur EmailJS:', error);
                    message.statut = 'erreur';
                    alert('⚠️ Erreur lors de l\'envoi. Message sauvegardé localement.');
                }
            }
            
            sauvegarderConversations();
            afficherConversation(conversationId);
            textarea.value = '';
        };

        container.querySelector('#form-nouveau-message').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const destinataire = {
                nom: container.querySelector('#nouveau-destinataire-nom').value.trim(),
                prenom: container.querySelector('#nouveau-destinataire-prenom').value.trim(),
                type: container.querySelector('#nouveau-destinataire-type').value,
                email: container.querySelector('#nouveau-destinataire-email').value.trim()
            };
            
            const sujet = container.querySelector('#nouveau-sujet').value.trim();
            const contenu = container.querySelector('#nouveau-message').value.trim();
            const classe = container.querySelector('#nouveau-classe').value;
            
            const conversation = {
                id: 'conv_' + Date.now(),
                destinataire: destinataire,
                classe: classe,
                sujet: sujet,
                messages: [{
                    id: 'msg_' + Date.now(),
                    auteur: 'moi',
                    contenu: contenu,
                    date: new Date().toISOString(),
                    lu: true
                }],
                statut: 'ouvert',
                lastUpdate: Date.now()
            };
            
            // Envoyer via EmailJS si configuré
            if (config.emailjsServiceId && config.emailjsTemplateId && config.emailjsPublicKey && typeof emailjs !== 'undefined') {
                try {
                    await emailjs.send(config.emailjsServiceId, config.emailjsTemplateId, {
                        to_email: destinataire.email,
                        to_name: `${destinataire.nom} ${destinataire.prenom || ''}`,
                        subject: sujet,
                        message: contenu + '\n\n' + config.signatureEmail
                    });
                    
                    conversation.messages[0].statut = 'envoyé';
                    alert('✅ Email envoyé avec succès !');
                } catch (error) {
                    console.error('Erreur EmailJS:', error);
                    conversation.messages[0].statut = 'erreur';
                    alert('⚠️ Erreur lors de l\'envoi. Conversation sauvegardée localement.');
                }
            } else {
                alert('⚠️ EmailJS non configuré. Conversation sauvegardée localement uniquement.');
            }
            
            conversations.push(conversation);
            sauvegarderConversations();
            closeNouveauMessageModal();
            afficherConversations();
            afficherConversation(conversation.id);
        });

        container.querySelector('#form-config-emailjs').addEventListener('submit', function(e) {
            e.preventDefault();
            
            config.emailjsServiceId = container.querySelector('#config-service-id').value.trim();
            config.emailjsTemplateId = container.querySelector('#config-template-id').value.trim();
            config.emailjsPublicKey = container.querySelector('#config-public-key').value.trim();
            config.signatureEmail = container.querySelector('#config-signature').value.trim();
            
            if (config.emailjsPublicKey && typeof emailjs !== 'undefined') {
                emailjs.init(config.emailjsPublicKey);
            }
            
            sauvegarderConfig();
            closeConfigEmailJSModal();
            alert('✅ Configuration EmailJS enregistrée !');
        });

        container.querySelector('#import-conversations-input').addEventListener('change', async function(e) {
            const file = e.target.files[0];
            if (!file) return;
            
            try {
                const texte = await file.text();
                const match = texte.match(/const MESSAGERIE_DATA = ({[\s\S]*?});/);
                
                if (match && match[1]) {
                    const data = JSON.parse(match[1]);
                    
                    if (confirm(`Importer ${data.conversations?.length || 0} conversation(s) ?\n\n⚠️ Cela remplacera les données actuelles.`)) {
                        conversations = data.conversations || [];
                        modeles = data.modeles || modeles;
                        config = { ...config, ...data.config };
                        
                        sauvegarderConversations();
                        sauvegarderModeles();
                        sauvegarderConfig();
                        
                        afficherConversations();
                        alert('✅ Conversations importées avec succès !');
                    }
                }
            } catch (error) {
                console.error('Erreur import:', error);
                alert('❌ Erreur lors de l\'importation.');
            }
            
            e.target.value = '';
        });

        window.archiverConversation = function(conversationId) {
            if (confirm('Archiver cette conversation ?')) {
                const index = conversations.findIndex(c => c.id === conversationId);
                if (index !== -1) {
                    conversations[index].statut = 'archivé';
                    sauvegarderConversations();
                    currentConversationId = null;
                    afficherConversations();
                    container.querySelector('#messages-panel').innerHTML = '<div class="empty-messages"><div class="empty-messages-icon">💬</div><h3>Conversation archivée</h3></div>';
                }
            }
        };

        window.utiliserModele = function(conversationId, modeleId) {
            const modele = modeles.find(m => m.id === modeleId);
            if (modele) {
                const textarea = container.querySelector(`#message-input-${conversationId}`);
                if (textarea) textarea.value = modele.contenu;
            }
        };

        window.chargerModeleMessage = function(conversationId) {
            if (modeles.length === 0) {
                alert('Aucun modèle disponible');
                return;
            }
            
            const modeleChoisi = modeles[0]; // Simplifier: prendre le premier
            utiliserModele(conversationId, modeleChoisi.id);
        };

        window.ajouterPieceJointe = function(conversationId) {
            alert('Fonctionnalité à venir : ajout de pièces jointes');
        };

        window.exporterConversationPDF = function(conversationId) {
            alert('Fonctionnalité à venir : export PDF d\'une conversation');
        };

        // Filtres
        container.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                container.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                activeFilter = this.dataset.filter;
                afficherConversations();
            });
        });

        // Recherche
        container.querySelector('#search-conversations').addEventListener('input', function(e) {
            searchTerm = e.target.value;
            afficherConversations();
        });

        // Affichage initial
        afficherConversations();
        
        if (modeles.length > 0) {
            const modelesListPanel = container.querySelector('#modeles-list');
            if (modelesListPanel) {
                modelesListPanel.innerHTML = modeles.map(m => `
                    <div class="modele-item">
                        <h4>${m.titre}</h4>
                        <p>${m.sujet}</p>
                    </div>
                `).join('');
            }
        }
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

    // TROMBINOSCOPES
    // ========================================
    function renderTrombinoscopes(container) {
        const annee = '2026-2027';
        const listes = window.getAvailableStudentLists ? window.getAvailableStudentLists() : {};
        const classes = Object.keys(listes).sort();

        if (classes.length === 0) {
            container.innerHTML = `
                <div id="suivi-eleves-module">
                    <h2>📸 Trombinoscopes - Année ${annee}</h2>
                    <div class="suivi-eleves-selection empty-state-box">
                        <h3>Aucune liste d’élèves n’est encore disponible</h3>
                        <p>Les listes sont importées par l’administrateur depuis son panneau.</p>
                        <p>Les anciennes données de l’année 2025-2026 restent uniquement dans <strong>Archives</strong>.</p>
                    </div>
                </div>`;
            return;
        }

        container.innerHTML = `
            <div id="suivi-eleves-module">
                <h2>📸 Trombinoscopes - Année ${annee}</h2>
                <div class="selection-classe-suivi">
                    <h3>Sélectionnez une classe</h3>
                    <div class="classes-grid">
                        ${classes.map(classe => `
                            <button class="classe-btn" data-classe="${classe}">
                                📚 ${classe} <small>(${listes[classe].length})</small>
                            </button>
                        `).join('')}
                    </div>
                </div>
                <div id="trombi-contenu" style="display:none; margin-top:20px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                        <h3 id="trombi-titre"></h3>
                        <div>
                            <button id="trombi-imprimer" class="btn-secondary">🖨️ Imprimer</button>
                            <button id="trombi-retour" class="btn-secondary">← Retour</button>
                        </div>
                    </div>
                    <div id="trombi-grille" class="trombi-grille"></div>
                </div>
            </div>`;

        const contenu = container.querySelector('#trombi-contenu');
        const selection = container.querySelector('.selection-classe-suivi');
        const grille = container.querySelector('#trombi-grille');

        container.querySelectorAll('.classe-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                const classe = this.dataset.classe;
                const eleves = (listes[classe] || []).slice()
                    .sort((a, b) => (a.nom + a.prenom).localeCompare(b.nom + b.prenom));

                container.querySelector('#trombi-titre').textContent = `${classe} — ${eleves.length} élève(s)`;
                grille.innerHTML = eleves.map(e => `
                    <div class="trombi-carte">
                        <div class="trombi-photo">${e.sexe === 'F' ? '👧' : (e.sexe === 'M' ? '👦' : '🧑')}</div>
                        <div class="trombi-nom">${e.prenom}</div>
                        <div class="trombi-nom-famille">${e.nom}</div>
                    </div>
                `).join('');

                selection.style.display = 'none';
                contenu.style.display = 'block';
            });
        });

        container.querySelector('#trombi-retour').addEventListener('click', function () {
            contenu.style.display = 'none';
            selection.style.display = 'block';
        });

        container.querySelector('#trombi-imprimer').addEventListener('click', function () {
            window.print();
        });
    }

    // ========================================
    // SUIVI DES ÉLÈVES
    // ========================================
    // Synchronisation du suivi des élèves (données propres à chaque enseignant)
    // ========================================
    const SUIVI_DOC_TYPE = 'suivi_eleves';
    let syncSuiviTimer = null;

    async function chargerSuiviEnLigne() {
        if (!window.EprofStore || !await window.EprofStore.isOnlineReady()) return null;
        const teacherId = await window.EprofStore.getTeacherId();
        const { data, error } = await window.EprofStore.list('teacher_documents', {
            filters: { teacher_id: teacherId, doc_type: SUIVI_DOC_TYPE }
        });
        if (error || !data || !data.length) return null;
        return data[0].data || null;
    }

    async function sauvegarderSuiviEnLigne(suiviData) {
        if (!window.EprofStore || !await window.EprofStore.isOnlineReady()) return false;
        const teacherId = await window.EprofStore.getTeacherId();
        const { error } = await window.EprofStore.upsert('teacher_documents', [{
            teacher_id: teacherId,
            doc_type: SUIVI_DOC_TYPE,
            data: suiviData
        }], { onConflict: 'teacher_id,doc_type' });
        if (error) console.error('❌ Suivi des élèves : sauvegarde en ligne échouée', error);
        return !error;
    }

    // Les saisies s'enchaînent vite : on regroupe les écritures réseau.
    function planifierSyncSuivi(suiviData) {
        clearTimeout(syncSuiviTimer);
        syncSuiviTimer = setTimeout(function () { sauvegarderSuiviEnLigne(suiviData); }, 2000);
    }

    // ========================================
    function renderSuiviEleves(container) {
        const listesEleves = window.getAvailableStudentLists ? window.getAvailableStudentLists() : {};
        const classes = Object.keys(listesEleves).sort();

        container.innerHTML = `
            <div id="suivi-eleves-module">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2>👨‍🎓 Suivi des élèves</h2>
                    <div class="data-controls">
                        <button id="export-suivi-btn" class="btn-secondary" title="Exporter les données du suivi">💾 Exporter</button>
                        <button id="sync-suivi-btn" class="btn-secondary" title="Sauvegarder le suivi en ligne">☁️ Sauvegarder en ligne</button>
                    </div>
                </div>
                
                ${classes.length === 0 ? `
                <div class="selection-classe-suivi empty-state-box">
                    <h3>Aucune liste d’élèves n’est encore disponible.</h3>
                    <p>Les listes sont importées par l’administrateur depuis son panneau.</p>
                </div>
                ` : `
                <div class="selection-classe-suivi">
                    <h3>Sélectionnez une classe</h3>
                    <div class="classes-grid">
                        ${classes.map(classe => `
                            <button class="classe-btn" data-classe="${classe}">
                                📚 ${classe} <small>(${listesEleves[classe].length})</small>
                            </button>
                        `).join('')}
                    </div>
                </div>
                `}
                
                <!-- Génération de liste d'émargement -->
                <div id="emargement-container" style="display: none; margin-top: 30px;">
                    <button id="generer-emargement-btn" class="btn-primary" style="width: 100%;">
                        📋 Générer une liste d'émargement
                    </button>
                </div>
                
                <!-- Liste des élèves -->
                <div id="liste-eleves-suivi" style="display: none;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin: 20px 0;">
                        <h3 id="titre-classe-suivi"></h3>
                        <button id="retour-selection-suivi" class="btn-secondary">← Retour</button>
                    </div>
                    <div id="grille-eleves-suivi" class="grille-eleves"></div>
                </div>
                
                <!-- Modale élève -->
                <div id="modale-eleve" class="modale-eleve" style="display: none;">
                    <div class="modale-eleve-content">
                        <span class="close-modale-eleve">&times;</span>
                        <h3 id="nom-eleve-modale"></h3>
                        
                        <div class="tabs-modale">
                            <button class="tab-btn active" data-tab="oublis">📦 Oublis de matériel</button>
                            <button class="tab-btn" data-tab="mots">📝 Mots à mettre</button>
                            <button class="tab-btn" data-tab="notes">📊 Moyennes</button>
                        </div>
                        
                        <div id="tab-oublis" class="tab-content active">
                            <h4>Ajouter un oubli</h4>
                            <div class="ajout-oubli">
                                <div class="oubli-checkboxes">
                                    <label class="checkbox-oubli">
                                        <input type="checkbox" value="Manuel/Livre" class="checkbox-materiel">
                                        <span>📚 Manuel/Livre</span>
                                    </label>
                                    <label class="checkbox-oubli">
                                        <input type="checkbox" value="Cours" class="checkbox-materiel">
                                        <span>📝 Cours</span>
                                    </label>
                                    <label class="checkbox-oubli">
                                        <input type="checkbox" value="Travail non fait" class="checkbox-materiel">
                                        <span>✏️ Travail non fait</span>
                                    </label>
                                </div>
                                <div class="ajout-oubli-actions">
                                    <input type="date" id="date-oubli" style="padding: 8px;">
                                    <button id="ajouter-oubli-btn" class="btn-primary">+ Ajouter</button>
                                </div>
                            </div>
                            <hr style="margin: 20px 0; border: none; border-top: 2px solid #e2e8f0;">
                            <h4>Oublis enregistrés</h4>
                            <div id="liste-oublis"></div>
                        </div>
                        
                        <div id="tab-mots" class="tab-content" style="display: none;">
                            <h4>Ajouter un mot à mettre</h4>
                            <div class="ajout-mot">
                                <textarea id="motif-mot" rows="3" placeholder="Motif du mot..." style="width: 100%; padding: 10px; border: 2px solid #e2e8f0; border-radius: 8px; margin-bottom: 10px;"></textarea>
                                <div style="display: flex; gap: 10px; align-items: center;">
                                    <input type="date" id="date-mot" style="padding: 8px;">
                                    <button id="ajouter-mot-btn" class="btn-primary">+ Ajouter le mot</button>
                                </div>
                            </div>
                            <hr style="margin: 20px 0; border: none; border-top: 2px solid #e2e8f0;">
                            <h4>Mots à mettre</h4>
                            <div id="liste-mots"></div>
                        </div>
                        
                        <div id="tab-notes" class="tab-content" style="display: none;">
                            <h4>Moyennes</h4>
                            <p style="color: #64748b; font-style: italic;">Fonctionnalité à venir</p>
                        </div>
                    </div>
                </div>
                
                <!-- Modale liste d'émargement -->
                <div id="modale-emargement" class="modale-eleve" style="display: none;">
                    <div class="modale-eleve-content" style="max-width: 600px;">
                        <span class="close-modale-emargement">&times;</span>
                        <h3>📋 Générer une liste d'émargement</h3>
                        
                        <div style="margin: 20px 0;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                <label style="font-weight: 500;">Colonnes d'émargement</label>
                                <button id="ajouter-colonne-emargement" class="btn-secondary" style="padding: 5px 12px; font-size: 12px;">
                                    ➕ Ajouter une colonne
                                </button>
                            </div>
                            <div id="colonnes-emargement-list" style="display: flex; flex-direction: column; gap: 8px;">
                                <div class="colonne-emargement-item" style="display: flex; gap: 8px; align-items: center;">
                                    <input type="text" class="titre-colonne-input" 
                                           placeholder="Présence, Rendu de dossier..." 
                                           value="Présence"
                                           style="flex: 1; padding: 8px; border: 2px solid #e2e8f0; border-radius: 6px;">
                                    <button class="supprimer-colonne-btn" style="padding: 6px 10px; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;" disabled>🗑️</button>
                                </div>
                            </div>
                        </div>
                        
                        <div style="margin: 20px 0;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 500;">
                                Format d'export
                            </label>
                            <div style="display: flex; gap: 15px;">
                                <label class="radio-option">
                                    <input type="radio" name="format-emargement" value="excel" checked>
                                    <span>📊 Excel</span>
                                </label>
                                <label class="radio-option">
                                    <input type="radio" name="format-emargement" value="pdf">
                                    <span>📄 PDF</span>
                                </label>
                            </div>
                        </div>
                        
                        <div style="display: flex; gap: 10px; margin-top: 20px;">
                            <button id="generer-fichier-emargement" class="btn-primary" style="flex: 1;">
                                ⬇️ Générer et télécharger
                            </button>
                            <button class="close-modale-emargement-btn btn-secondary" style="flex: 1;">
                                Annuler
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Variables
        let elevesActuels = [];
        let eleveSelectionne = null;
        let suiviData = JSON.parse(localStorage.getItem('suiviEleves') || '{}');
        
        // Éléments DOM
        const selectionDiv = container.querySelector('.selection-classe-suivi');
        const listeDiv = container.querySelector('#liste-eleves-suivi');
        const grilleEleves = container.querySelector('#grille-eleves-suivi');
        const titreClasse = container.querySelector('#titre-classe-suivi');
        const retourBtn = container.querySelector('#retour-selection-suivi');
        const modale = container.querySelector('#modale-eleve');
        const closeModale = container.querySelector('.close-modale-eleve');
        
        let classeActuelle = null;
        
        // Event listeners sur les boutons de classe
        container.querySelectorAll('.classe-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const classe = this.getAttribute('data-classe');
                chargerClasse(classe);
            });
        });
        
        // Charger une classe
        function chargerClasse(classe) {
            classeActuelle = classe;
            
            const listeClasse = (window.getAvailableStudentLists ? window.getAvailableStudentLists() : {})[classe];
            if (!listeClasse || listeClasse.length === 0) {
                alert('⚠️ Aucun élève trouvé pour cette classe');
                return;
            }
            
            // Créer la liste des élèves au format "Prénom NOM"
            elevesActuels = listeClasse.map(e => ({
                nom: e.nom,
                prenom: e.prenom,
                sexe: e.sexe,
                nomComplet: `${e.prenom} ${e.nom.toUpperCase()}`
            }));
            
            // Trier par ordre alphabétique (nom de famille)
            elevesActuels.sort((a, b) => a.nom.localeCompare(b.nom));
            
            afficherEleves(classe);
            
            // Afficher le bouton d'émargement
            const emargementContainer = container.querySelector('#emargement-container');
            if (emargementContainer) {
                emargementContainer.style.display = 'block';
            }
        }
        
        // Afficher la grille des élèves
        function afficherEleves(classe) {
            selectionDiv.style.display = 'none';
            listeDiv.style.display = 'block';
            titreClasse.textContent = `Classe : ${classe} (${elevesActuels.length} élèves)`;
            
            grilleEleves.innerHTML = elevesActuels.map(eleve => {
                const sexeClass = eleve.sexe === 'F' ? 'eleve-f' : 'eleve-m';
                const oublis = suiviData[eleve.nomComplet]?.oublis || [];
                const oublisNonTraites = oublis.filter(o => !o.motMis);
                const nbOublis = oublis.length;
                const motsAMettre = suiviData[eleve.nomComplet]?.motsAMettre || [];
                const nbMotsNonMis = motsAMettre.filter(m => !m.mis).length;
                
                // Compter les groupes de mots mis pour oublis
                const groupesMotsOublis = new Set();
                oublis.filter(o => o.motMis && o.groupeId).forEach(o => groupesMotsOublis.add(o.groupeId));
                const nbGroupesMotsOublis = groupesMotsOublis.size;
                
                // Total de mots (motsAMettre normaux + groupes de mots d'oublis)
                const totalMots = motsAMettre.length + nbGroupesMotsOublis;
                const totalMotsNonMis = nbMotsNonMis + (oublisNonTraites.length >= 3 ? 1 : 0);
                
                // Badge oublis : orange si mot à mettre (3+ oublis non traités), rouge sinon
                let badgeOublis = '';
                if (oublisNonTraites.length >= 3) {
                    badgeOublis = `<div class="badge-mots">📋 Mot à mettre</div>`;
                } else if (nbOublis > 0) {
                    badgeOublis = `<div class="badge-oublis">📦 ${nbOublis}</div>`;
                }
                
                // Badge mots : toujours affiché si total > 0, vert si tous mis, orange sinon
                let badgeMots = '';
                if (totalMots > 0) {
                    const badgeClass = totalMotsNonMis === 0 ? 'badge-mots-mis' : 'badge-mots';
                    badgeMots = `<div class="${badgeClass}" style="top: 40px;">📝 ${totalMots}</div>`;
                }
                
                return `
                    <div class="carte-eleve ${sexeClass}" data-nom="${eleve.nomComplet}">
                        <div class="nom-eleve">${eleve.nomComplet}</div>
                        <div class="sexe-badge">${eleve.sexe}</div>
                        ${badgeOublis}
                        ${badgeMots}
                    </div>
                `;
            }).join('');
            
            // Event listeners sur les cartes
            container.querySelectorAll('.carte-eleve').forEach(carte => {
                carte.addEventListener('click', function() {
                    const nomComplet = this.getAttribute('data-nom');
                    ouvrirModaleEleve(nomComplet);
                });
            });
        }
        
        // Ouvrir la modale d'un élève
        function ouvrirModaleEleve(nomComplet) {
            eleveSelectionne = nomComplet;
            
            if (!suiviData[nomComplet]) {
                suiviData[nomComplet] = { oublis: [], notes: [], motsAMettre: [] };
            }
            if (!suiviData[nomComplet].motsAMettre) {
                suiviData[nomComplet].motsAMettre = [];
            }
            
            const nomEleveModale = container.querySelector('#nom-eleve-modale');
            nomEleveModale.textContent = nomComplet;
            
            // Initialiser la date du jour automatiquement
            const dateInput = container.querySelector('#date-oubli');
            const aujourd_hui = new Date().toISOString().split('T')[0];
            dateInput.value = aujourd_hui;
            
            // Initialiser la date du jour automatiquement pour les mots aussi
            const dateInputMot = container.querySelector('#date-mot');
            dateInputMot.value = aujourd_hui;
            
            afficherOublis();
            afficherMots();
            afficherMoyennes();
            modale.style.display = 'flex';
        }
        
        // Afficher les moyennes de l'élève
        function afficherMoyennes(periodeSelectionnee = null, matiereSelectionnee = null) {
            const tabNotes = container.querySelector('#tab-notes');
            
            // Récupérer les données du carnet de notes
            const carnetEvaluations = JSON.parse(localStorage.getItem('carnetNotesEvaluations') || '{}');
            const carnetNotes = JSON.parse(localStorage.getItem('carnetNotesNotes') || '{}');
            
            // Vérifier si la classe actuelle a des évaluations
            const evaluationsClasse = carnetEvaluations[classeActuelle];
            if (!evaluationsClasse || evaluationsClasse.length === 0) {
                tabNotes.innerHTML = `
                    <h4>Moyennes</h4>
                    <p style="color: #64748b; font-style: italic;">Aucune évaluation enregistrée pour cette classe</p>
                `;
                return;
            }
            
            // Vérifier si l'élève a des notes
            const notesEleve = carnetNotes[classeActuelle]?.[eleveSelectionne];
            if (!notesEleve) {
                tabNotes.innerHTML = `
                    <h4>Moyennes</h4>
                    <p style="color: #64748b; font-style: italic;">Aucune note enregistrée pour cet élève</p>
                `;
                return;
            }
            
            // Déterminer si la classe est en semestre ou trimestre
            const isTerminale = classeActuelle.toLowerCase().includes('terminale') || 
                               classeActuelle.toLowerCase().includes('tle');
            const periodes = isTerminale ? ['semestre1', 'semestre2'] : ['trimestre1', 'trimestre2', 'trimestre3'];
            const periodesLabels = isTerminale ? ['Semestre 1', 'Semestre 2'] : ['Trimestre 1', 'Trimestre 2', 'Trimestre 3'];
            
            // Grouper les évaluations par matière (comme dans le carnet de notes)
            const evalsBySubject = {};
            evaluationsClasse.forEach(eval => {
                if (!evalsBySubject[eval.subject]) {
                    evalsBySubject[eval.subject] = [];
                }
                evalsBySubject[eval.subject].push(eval);
            });
            
            // Calculer les moyennes par période ET par matière
            const moyennesPeriodes = {};
            const moyennesParMatiereEtPeriode = {}; // Structure : {periode: {matiere: moyenne}}
            const detailsPeriodes = {};
            const detailsParMatiereEtPeriode = {}; // Structure : {periode: {matiere: [notes]}}
            let hasNotes = false;
            
            periodes.forEach((periode, index) => {
                const evalsP = evaluationsClasse.filter(e => e.period === periode);
                const notesDetails = [];
                
                // Initialiser les structures pour cette période
                moyennesParMatiereEtPeriode[periode] = {};
                detailsParMatiereEtPeriode[periode] = {};
                
                // Grouper les évaluations de cette période par matière
                const evalsPBySubject = {};
                evalsP.forEach(eval => {
                    if (!evalsPBySubject[eval.subject]) {
                        evalsPBySubject[eval.subject] = [];
                    }
                    evalsPBySubject[eval.subject].push(eval);
                });
                
                // Calculer la moyenne pour chaque matière
                let sommePeriode = 0;
                let coefPeriode = 0;
                
                Object.keys(evalsPBySubject).forEach(matiere => {
                    const evalsMatiere = evalsPBySubject[matiere];
                    let sommeMatiere = 0;
                    let coefMatiere = 0;
                    const notesMatiere = [];
                    
                    evalsMatiere.forEach(eval => {
                        const note = notesEleve[eval.id];
                        if (note !== undefined && note !== 'abs' && note !== null && note !== '') {
                            // Normaliser la note sur 20
                            const noteNormalisee = (parseFloat(note) / eval.maxPoints) * 20;
                            sommeMatiere += noteNormalisee * eval.coefficient;
                            coefMatiere += eval.coefficient;
                            hasNotes = true;
                            
                            // Stocker les détails
                            const noteDetail = {
                                titre: eval.title,
                                date: eval.date,
                                matiere: eval.subject,
                                note: note,
                                max: eval.maxPoints,
                                coef: eval.coefficient,
                                noteNormalisee: noteNormalisee.toFixed(2)
                            };
                            notesDetails.push(noteDetail);
                            notesMatiere.push(noteDetail);
                        }
                    });
                    
                    // Moyenne de la matière pour cette période
                    if (coefMatiere > 0) {
                        const moyenneMatiere = sommeMatiere / coefMatiere;
                        moyennesParMatiereEtPeriode[periode][matiere] = moyenneMatiere.toFixed(2);
                        
                        // Pour la moyenne générale de la période (moyenne des moyennes de matières)
                        sommePeriode += moyenneMatiere;
                        coefPeriode += 1; // Chaque matière compte pour 1 dans la moyenne générale
                    } else {
                        moyennesParMatiereEtPeriode[periode][matiere] = null;
                    }
                    
                    // Stocker les détails par matière
                    detailsParMatiereEtPeriode[periode][matiere] = notesMatiere;
                });
                
                // Trier les notes par date
                notesDetails.sort((a, b) => new Date(a.date) - new Date(b.date));
                
                // Moyenne générale de la période (moyenne des moyennes de matières)
                if (coefPeriode > 0) {
                    moyennesPeriodes[periode] = (sommePeriode / coefPeriode).toFixed(2);
                } else {
                    moyennesPeriodes[periode] = null;
                }
                
                detailsPeriodes[periode] = notesDetails;
            });
            
            // Calculer la moyenne générale (moyenne des moyennes de trimestres/semestres)
            const moyennesValides = Object.values(moyennesPeriodes).filter(m => m !== null);
            const moyenneGenerale = moyennesValides.length > 0 
                ? (moyennesValides.reduce((sum, m) => sum + parseFloat(m), 0) / moyennesValides.length).toFixed(2)
                : null;
            
            if (!hasNotes) {
                tabNotes.innerHTML = `
                    <h4>Moyennes</h4>
                    <p style="color: #64748b; font-style: italic;">Aucune note enregistrée pour cet élève</p>
                `;
                return;
            }
            
            // Si une matière est sélectionnée (vue détaillée matière d'une période)
            if (periodeSelectionnee !== null && matiereSelectionnee !== null) {
                const index = periodes.indexOf(periodeSelectionnee);
                const notesMatiere = detailsParMatiereEtPeriode[periodeSelectionnee][matiereSelectionnee] || [];
                const moyenneMatiere = moyennesParMatiereEtPeriode[periodeSelectionnee][matiereSelectionnee];
                
                let html = `
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
                        <button id="retour-periode" class="btn-secondary" style="padding: 8px 15px;">← Retour</button>
                        <h4 style="margin: 0;">${periodesLabels[index]} - ${matiereSelectionnee}</h4>
                    </div>
                `;
                
                if (notesMatiere.length === 0) {
                    html += '<p style="color: #64748b; font-style: italic;">Aucune note pour cette matière dans cette période</p>';
                } else {
                    html += `
                        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px; border-radius: 12px; margin-bottom: 20px; text-align: center;">
                            <div style="font-size: 0.9em; opacity: 0.9; margin-bottom: 5px;">Moyenne ${matiereSelectionnee}</div>
                            <div style="font-size: 2em; font-weight: bold;">${moyenneMatiere}/20</div>
                        </div>
                    `;
                    
                    html += '<div style="display: grid; gap: 10px;">';
                    notesMatiere.forEach(d => {
                        const dateFormatee = new Date(d.date).toLocaleDateString('fr-FR');
                        const couleurNote = parseFloat(d.noteNormalisee) >= 10 ? '#10b981' : '#ef4444';
                        html += `
                            <div style="background: white; border: 2px solid #e2e8f0; padding: 15px; border-radius: 8px;">
                                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                                    <div>
                                        <div style="font-weight: 600; color: #1e293b; margin-bottom: 4px;">${d.titre}</div>
                                        <div style="font-size: 0.9em; color: #64748b;">${dateFormatee}</div>
                                    </div>
                                    <div style="text-align: right;">
                                        <div style="font-size: 1.5em; font-weight: bold; color: ${couleurNote};">${d.note}/${d.max}</div>
                                        <div style="font-size: 0.85em; color: #64748b;">Coef. ${d.coef}</div>
                                    </div>
                                </div>
                                <div style="display: flex; justify-content: space-between; padding-top: 8px; border-top: 1px solid #e2e8f0;">
                                    <span style="font-size: 0.9em; color: #64748b;">Note sur 20</span>
                                    <span style="font-weight: 600; color: ${couleurNote};">${d.noteNormalisee}/20</span>
                                </div>
                            </div>
                        `;
                    });
                    html += '</div>';
                }
                
                tabNotes.innerHTML = html;
                
                // Event listener pour le bouton retour vers la période
                const btnRetour = tabNotes.querySelector('#retour-periode');
                if (btnRetour) {
                    btnRetour.addEventListener('click', () => afficherMoyennes(periodeSelectionnee));
                }
                
                return;
            }
            
            // Si une période est sélectionnée (vue par matière)
            if (periodeSelectionnee !== null) {
                const index = periodes.indexOf(periodeSelectionnee);
                const moyenne = moyennesPeriodes[periodeSelectionnee];
                const matieresMoyennes = moyennesParMatiereEtPeriode[periodeSelectionnee];
                
                let html = `
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
                        <button id="retour-moyennes" class="btn-secondary" style="padding: 8px 15px;">← Retour</button>
                        <h4 style="margin: 0;">${periodesLabels[index]}</h4>
                    </div>
                `;
                
                if (Object.keys(matieresMoyennes).length === 0) {
                    html += '<p style="color: #64748b; font-style: italic;">Aucune note pour cette période</p>';
                } else {
                    html += `
                        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px; border-radius: 12px; margin-bottom: 20px; text-align: center;">
                            <div style="font-size: 0.9em; opacity: 0.9; margin-bottom: 5px;">Moyenne ${periodesLabels[index]}</div>
                            <div style="font-size: 2em; font-weight: bold;">${moyenne}/20</div>
                            <div style="font-size: 0.85em; opacity: 0.8; margin-top: 5px;">Moyenne des moyennes par matière</div>
                        </div>
                    `;
                    
                    html += '<div style="display: grid; gap: 10px;">';
                    html += '<h5 style="margin: 10px 0; color: #64748b;">Moyennes par matière :</h5>';
                    
                    // Afficher les moyennes par matière (cliquables)
                    Object.keys(matieresMoyennes).forEach(matiere => {
                        const moyenneMatiere = matieresMoyennes[matiere];
                        if (moyenneMatiere !== null) {
                            const couleurNote = parseFloat(moyenneMatiere) >= 10 ? '#10b981' : '#ef4444';
                            html += `
                                <div class="matiere-card" data-matiere="${matiere}" style="background: white; border: 2px solid ${couleurNote}; padding: 15px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: all 0.2s;">
                                    <div style="font-weight: 600; color: #1e293b;">${matiere}</div>
                                    <div style="display: flex; align-items: center; gap: 10px;">
                                        <div style="font-size: 1.5em; font-weight: bold; color: ${couleurNote};">${moyenneMatiere}/20</div>
                                        <div style="color: #94a3b8; font-size: 1.2em;">›</div>
                                    </div>
                                </div>
                            `;
                        }
                    });
                    html += '</div>';
                }
                
                tabNotes.innerHTML = html;
                
                // Event listener pour le bouton retour
                const btnRetour = tabNotes.querySelector('#retour-moyennes');
                if (btnRetour) {
                    btnRetour.addEventListener('click', () => afficherMoyennes());
                }
                
                // Event listeners sur les cartes de matières (pour voir le détail)
                tabNotes.querySelectorAll('.matiere-card').forEach(card => {
                    card.addEventListener('mouseenter', function() {
                        this.style.transform = 'translateY(-2px)';
                        this.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                    });
                    card.addEventListener('mouseleave', function() {
                        this.style.transform = 'translateY(0)';
                        this.style.boxShadow = 'none';
                    });
                    card.addEventListener('click', function() {
                        const matiere = this.getAttribute('data-matiere');
                        afficherMoyennes(periodeSelectionnee, matiere);
                    });
                });
                
                return;
            }
            
            // Affichage normal des moyennes
            let html = '<h4>Moyennes</h4>';
            html += '<div class="moyennes-container" style="display: grid; gap: 15px; margin-top: 20px;">';
            
            // Moyenne générale
            if (moyenneGenerale !== null) {
                html += `
                    <div class="moyenne-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 12px; text-align: center;">
                        <div style="font-size: 0.9em; opacity: 0.9; margin-bottom: 5px;">Moyenne générale</div>
                        <div style="font-size: 2.5em; font-weight: bold;">${moyenneGenerale}/20</div>
                        <div style="font-size: 0.85em; opacity: 0.8; margin-top: 5px;">Moyenne des ${moyennesValides.length} ${isTerminale ? 'semestres' : 'trimestres'}</div>
                    </div>
                `;
            }
            
            // Moyennes par période (cliquables)
            periodes.forEach((periode, index) => {
                const moyenne = moyennesPeriodes[periode];
                if (moyenne !== null) {
                    const couleur = parseFloat(moyenne) >= 10 ? '#10b981' : '#ef4444';
                    html += `
                        <div class="moyenne-card moyenne-clickable" data-periode="${periode}" style="background: white; border: 2px solid ${couleur}; padding: 15px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: all 0.2s;">
                            <div style="font-weight: 600; color: #1e293b;">${periodesLabels[index]}</div>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <div style="font-size: 1.8em; font-weight: bold; color: ${couleur};">${moyenne}/20</div>
                                <div style="color: #94a3b8; font-size: 1.2em;">›</div>
                            </div>
                        </div>
                    `;
                } else {
                    html += `
                        <div class="moyenne-card" style="background: #f8fafc; border: 2px solid #e2e8f0; padding: 15px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                            <div style="font-weight: 600; color: #64748b;">${periodesLabels[index]}</div>
                            <div style="font-size: 1.2em; color: #94a3b8;">Pas de notes</div>
                        </div>
                    `;
                }
            });
            
            html += '</div>';
            tabNotes.innerHTML = html;
            
            // Event listeners sur les cartes de périodes cliquables
            tabNotes.querySelectorAll('.moyenne-clickable').forEach(card => {
                card.addEventListener('mouseenter', function() {
                    this.style.transform = 'translateY(-2px)';
                    this.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                });
                card.addEventListener('mouseleave', function() {
                    this.style.transform = 'translateY(0)';
                    this.style.boxShadow = 'none';
                });
                card.addEventListener('click', function() {
                    const periode = this.getAttribute('data-periode');
                    afficherMoyennes(periode);
                });
            });
        }
        
        // Afficher les mots à mettre
        function afficherMots() {
            const listeMots = container.querySelector('#liste-mots');
            const motsAMettre = suiviData[eleveSelectionne]?.motsAMettre || [];
            
            if (motsAMettre.length === 0) {
                listeMots.innerHTML = '<p style="color: #64748b; font-style: italic;">Aucun mot à mettre</p>';
            } else {
                const motsNonMis = motsAMettre.filter(m => !m.mis);
                const motsMis = motsAMettre.filter(m => m.mis);
                
                let motsHtml = '';
                
                // Afficher les mots mis
                if (motsMis.length > 0) {
                    motsHtml += motsMis.map((mot, index) => {
                        return `
                            <div class="item-mot-mis">
                                <div>
                                    <strong>✅ ${mot.motif}</strong>
                                    <span style="color: #64748b; font-size: 0.9em;"> - Prévu le ${mot.date}, mis le ${mot.dateMis}</span>
                                </div>
                                <button class="btn-supprimer" data-index="${motsAMettre.indexOf(mot)}">🗑️</button>
                            </div>
                        `;
                    }).join('');
                }
                
                // Afficher les mots à mettre
                if (motsNonMis.length > 0) {
                    motsHtml += motsNonMis.map((mot, index) => {
                        return `
                            <div class="item-mot-a-mettre">
                                <div>
                                    <strong>${mot.motif}</strong>
                                    <span style="color: #64748b; font-size: 0.9em;"> - ${mot.date}</span>
                                </div>
                                <div>
                                    <button class="btn-marquer-mis" data-index="${motsAMettre.indexOf(mot)}">✓ Mis</button>
                                    <button class="btn-supprimer" data-index="${motsAMettre.indexOf(mot)}">🗑️</button>
                                </div>
                            </div>
                        `;
                    }).join('');
                }
                
                listeMots.innerHTML = motsHtml;
                
                // Boutons marquer comme mis
                container.querySelectorAll('.btn-marquer-mis').forEach(btn => {
                    btn.addEventListener('click', function() {
                        const index = parseInt(this.getAttribute('data-index'));
                        suiviData[eleveSelectionne].motsAMettre[index].mis = true;
                        suiviData[eleveSelectionne].motsAMettre[index].dateMis = new Date().toISOString().split('T')[0];
                        sauvegarderSuivi();
                        afficherMots();
                        afficherEleves(classeActuelle);
                    });
                });
                
                // Boutons supprimer mot
                container.querySelectorAll('#tab-mots .btn-supprimer').forEach(btn => {
                    btn.addEventListener('click', function() {
                        const index = parseInt(this.getAttribute('data-index'));
                        suiviData[eleveSelectionne].motsAMettre.splice(index, 1);
                        sauvegarderSuivi();
                        afficherMots();
                        afficherEleves(classeActuelle);
                    });
                });
            }
        }
        
        // Afficher les oublis
        function afficherOublis() {
            const listeOublis = container.querySelector('#liste-oublis');
            const oublis = suiviData[eleveSelectionne]?.oublis || [];
            
            if (!suiviData[eleveSelectionne].motsMis) {
                suiviData[eleveSelectionne].motsMis = [];
            }
            
            if (oublis.length === 0) {
                listeOublis.innerHTML = '<p style="color: #64748b; font-style: italic;">Aucun oubli enregistré</p>';
            } else {
                // Compter les oublis non traités
                const oublisNonTraites = oublis.filter(o => !o.motMis);
                
                // Alerte si 3 oublis non traités ou plus
                let alerteHtml = '';
                if (oublisNonTraites.length >= 3) {
                    alerteHtml = `
                        <div class="alerte-oublis">
                            <strong>⚠️ ATTENTION !</strong>
                            <p>${oublisNonTraites.length} oublis enregistrés - Mettre un mot dans le carnet de correspondance</p>
                            <button class="btn-mot-mis" id="confirmer-mot-btn">✓ Mot mis dans le carnet</button>
                        </div>
                    `;
                }
                
                // Grouper les oublis par statut
                const oublisAvecMot = oublis.filter(o => o.motMis);
                const oublisSansMot = oublis.filter(o => !o.motMis);
                
                let oublisHtml = '';
                
                // Afficher les oublis avec mot mis (regroupés par groupeId)
                if (oublisAvecMot.length > 0) {
                    const groupes = {};
                    oublisAvecMot.forEach((oubli, index) => {
                        const groupeId = oubli.groupeId || oubli.motMisDate; // Fallback pour anciennes données
                        if (!groupes[groupeId]) {
                            groupes[groupeId] = [];
                        }
                        groupes[groupeId].push({ ...oubli, indexOriginal: oublis.indexOf(oubli) });
                    });
                    
                    Object.keys(groupes).forEach(groupeId => {
                        const groupe = groupes[groupeId];
                        const dateMotMis = groupe[0].motMisDate;
                        oublisHtml += `
                            <div class="groupe-oublis-mot-mis">
                                <div class="header-groupe">
                                    <strong>✅ Mot mis le ${dateMotMis}</strong>
                                    <span>${groupe.length} oubli(s)</span>
                                </div>
                                <div class="detail-groupe">
                                    ${groupe.map(oubli => `
                                        <div class="item-oubli-groupe">
                                            <div>
                                                <strong>${oubli.materiel}</strong>
                                                <span style="color: #64748b; font-size: 0.9em;"> - ${oubli.date}</span>
                                            </div>
                                            <button class="btn-supprimer" data-index="${oubli.indexOriginal}">🗑️</button>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        `;
                    });
                }
                
                // Afficher les oublis sans mot
                oublisHtml += oublisSansMot.map(oubli => {
                    const index = oublis.indexOf(oubli);
                    return `
                        <div class="item-oubli">
                            <div>
                                <strong>${oubli.materiel}</strong>
                                <span style="color: #64748b; font-size: 0.9em;"> - ${oubli.date}</span>
                            </div>
                            <button class="btn-supprimer" data-index="${index}">🗑️</button>
                        </div>
                    `;
                }).join('');
                
                listeOublis.innerHTML = alerteHtml + oublisHtml;
                
                // Bouton confirmer mot mis
                const confirmerMotBtn = container.querySelector('#confirmer-mot-btn');
                if (confirmerMotBtn) {
                    confirmerMotBtn.addEventListener('click', function() {
                        const dateMotMis = new Date().toISOString().split('T')[0];
                        
                        // Trouver les 3 premiers oublis non traités
                        let count = 0;
                        const maxParGroupe = 3;
                        
                        oublis.forEach(oubli => {
                            if (!oubli.motMis && count < maxParGroupe) {
                                oubli.motMis = true;
                                oubli.motMisDate = dateMotMis;
                                oubli.groupeId = `${dateMotMis}-${Math.floor(Date.now() / 1000)}`;
                                count++;
                            }
                        });
                        
                        sauvegarderSuivi();
                        afficherOublis();
                        afficherEleves(classeActuelle);
                    });
                }
                
                // Supprimer un oubli
                container.querySelectorAll('#tab-oublis .btn-supprimer').forEach(btn => {
                    btn.addEventListener('click', function() {
                        const index = parseInt(this.getAttribute('data-index'));
                        suiviData[eleveSelectionne].oublis.splice(index, 1);
                        sauvegarderSuivi();
                        afficherOublis();
                        afficherEleves(classeActuelle);
                    });
                });
            }
        }
        
        // Ajouter un oubli
        const ajouterOubliBtn = container.querySelector('#ajouter-oubli-btn');
        ajouterOubliBtn.addEventListener('click', function() {
            const checkboxes = container.querySelectorAll('.checkbox-materiel:checked');
            const dateInput = container.querySelector('#date-oubli');
            
            const date = dateInput.value;
            
            if (checkboxes.length === 0) {
                alert('⚠️ Veuillez sélectionner au moins un oubli');
                return;
            }
            
            if (!date) {
                alert('⚠️ Veuillez sélectionner une date');
                return;
            }
            
            // Ajouter chaque oubli sélectionné
            checkboxes.forEach(checkbox => {
                const materiel = checkbox.value;
                suiviData[eleveSelectionne].oublis.push({ materiel, date });
            });
            
            sauvegarderSuivi();
            
            // Décocher toutes les cases
            checkboxes.forEach(checkbox => checkbox.checked = false);
            
            // Réinitialiser la date au jour actuel
            const aujourd_hui = new Date().toISOString().split('T')[0];
            dateInput.value = aujourd_hui;
            
            afficherOublis();
            afficherEleves(classeActuelle);
        });
        
        // Ajouter un mot à mettre
        const ajouterMotBtn = container.querySelector('#ajouter-mot-btn');
        ajouterMotBtn.addEventListener('click', function() {
            const motifInput = container.querySelector('#motif-mot');
            const dateInput = container.querySelector('#date-mot');
            
            const motif = motifInput.value.trim();
            const date = dateInput.value;
            
            if (!motif) {
                alert('⚠️ Veuillez saisir le motif du mot');
                return;
            }
            
            if (!date) {
                alert('⚠️ Veuillez sélectionner une date');
                return;
            }
            
            suiviData[eleveSelectionne].motsAMettre.push({ motif, date, mis: false });
            sauvegarderSuivi();
            
            // Réinitialiser le formulaire
            motifInput.value = '';
            const aujourd_hui = new Date().toISOString().split('T')[0];
            dateInput.value = aujourd_hui;
            
            afficherMots();
            afficherEleves(classeActuelle);
            updateNotifications();
        });
        
        // Sauvegarder dans localStorage
        function sauvegarderSuivi() {
            localStorage.setItem('suiviEleves', JSON.stringify(suiviData));
            updateNotifications();
            planifierSyncSuivi(suiviData);
            
            // Sauvegarde automatique
            if (window.dataManager) {
                window.dataManager.triggerAutoSave();
            }
        }
        
        // Fermer la modale
        closeModale.addEventListener('click', () => modale.style.display = 'none');
        modale.addEventListener('click', function(e) {
            if (e.target === modale) modale.style.display = 'none';
        });
        
        // Retour à la sélection
        retourBtn.addEventListener('click', function() {
            selectionDiv.style.display = 'block';
            listeDiv.style.display = 'none';
        });
        
        // Gestion des tabs
        container.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const tab = this.getAttribute('data-tab');
                
                container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                container.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
                
                this.classList.add('active');
                container.querySelector(`#tab-${tab}`).style.display = 'block';
                
                // Rafraîchir les moyennes quand on ouvre l'onglet
                if (tab === 'notes') {
                    afficherMoyennes();
                }
            });
        });
        
        // Boutons Export / synchronisation
        const exportSuiviBtn = container.querySelector('#export-suivi-btn');
        const syncSuiviBtn = container.querySelector('#sync-suivi-btn');
        
        if (syncSuiviBtn) {
            syncSuiviBtn.addEventListener('click', async () => {
                const ok = await sauvegarderSuiviEnLigne(suiviData);
                alert(ok ? '✅ Suivi des élèves sauvegardé en ligne.' : '❌ Sauvegarde en ligne impossible (hors ligne ou non connecté).');
            });
        }
        
        if (exportSuiviBtn) {
            exportSuiviBtn.addEventListener('click', async () => {
                try {
                    window.dataManager.exportAllData();
                    alert('✓ Données exportées avec succès !\n\nLe fichier JSON a été téléchargé.\nConservez-le pour le réutiliser sur un autre ordinateur.');
                } catch (error) {
                    alert('❌ Erreur lors de l\'exportation : ' + error.message);
                }
            });
        }
        
        // Le suivi en ligne fait foi : on l'applique dès qu'il est disponible.
        chargerSuiviEnLigne().then(distant => {
            if (!distant) return;
            suiviData = distant;
            localStorage.setItem('suiviEleves', JSON.stringify(suiviData));
            updateNotifications();
            if (classeActuelle) afficherEleves(classeActuelle);
        });
        
        // Gestion de la liste d'émargement
        const emargementContainer = container.querySelector('#emargement-container');
        const genererEmargementBtn = container.querySelector('#generer-emargement-btn');
        const modaleEmargement = container.querySelector('#modale-emargement');
        const closeModaleEmargement = container.querySelectorAll('.close-modale-emargement, .close-modale-emargement-btn');
        const genererFichierBtn = container.querySelector('#generer-fichier-emargement');
        
        // Modifier le retour pour cacher le bouton d'émargement
        const originalRetourListener = retourBtn.onclick;
        retourBtn.addEventListener('click', function() {
            if (emargementContainer) {
                emargementContainer.style.display = 'none';
            }
        });
        
        // Ouvrir la modale
        if (genererEmargementBtn) {
            genererEmargementBtn.addEventListener('click', () => {
                modaleEmargement.style.display = 'flex';
                // Réinitialiser avec une colonne par défaut
                const colonnesList = container.querySelector('#colonnes-emargement-list');
                colonnesList.innerHTML = `
                    <div class="colonne-emargement-item" style="display: flex; gap: 8px; align-items: center;">
                        <input type="text" class="titre-colonne-input" 
                               placeholder="Présence, Rendu de dossier..." 
                               value="Présence"
                               style="flex: 1; padding: 8px; border: 2px solid #e2e8f0; border-radius: 6px;">
                        <button class="supprimer-colonne-btn" style="padding: 6px 10px; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;" disabled>🗑️</button>
                    </div>
                `;
                updateSupprimerButtons();
                container.querySelector('input[name="format-emargement"][value="excel"]').checked = true;
            });
        }
        
        // Ajouter une colonne
        const ajouterColonneBtn = container.querySelector('#ajouter-colonne-emargement');
        if (ajouterColonneBtn) {
            ajouterColonneBtn.addEventListener('click', () => {
                const colonnesList = container.querySelector('#colonnes-emargement-list');
                const newColonne = document.createElement('div');
                newColonne.className = 'colonne-emargement-item';
                newColonne.style.cssText = 'display: flex; gap: 8px; align-items: center;';
                newColonne.innerHTML = `
                    <input type="text" class="titre-colonne-input" 
                           placeholder="Présence, Rendu de dossier..." 
                           style="flex: 1; padding: 8px; border: 2px solid #e2e8f0; border-radius: 6px;">
                    <button class="supprimer-colonne-btn" style="padding: 6px 10px; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">🗑️</button>
                `;
                colonnesList.appendChild(newColonne);
                updateSupprimerButtons();
            });
        }
        
        // Fonction pour mettre à jour les boutons supprimer
        function updateSupprimerButtons() {
            const items = container.querySelectorAll('.colonne-emargement-item');
            items.forEach((item, index) => {
                const btn = item.querySelector('.supprimer-colonne-btn');
                btn.disabled = items.length === 1;
                btn.onclick = function() {
                    if (items.length > 1) {
                        item.remove();
                        updateSupprimerButtons();
                    }
                };
            });
        }
        
        // Fermer la modale
        closeModaleEmargement.forEach(btn => {
            btn.addEventListener('click', () => {
                modaleEmargement.style.display = 'none';
            });
        });
        
        modaleEmargement.addEventListener('click', (e) => {
            if (e.target === modaleEmargement) {
                modaleEmargement.style.display = 'none';
            }
        });
        
        // Générer le fichier
        if (genererFichierBtn) {
            genererFichierBtn.addEventListener('click', () => {
                const colonnesInputs = container.querySelectorAll('.titre-colonne-input');
                const colonnes = Array.from(colonnesInputs).map(input => input.value.trim()).filter(v => v);
                const format = container.querySelector('input[name="format-emargement"]:checked').value;
                
                if (colonnes.length === 0) {
                    alert('⚠️ Veuillez saisir au moins un intitulé de colonne');
                    return;
                }
                
                if (!classeActuelle || !LISTES_ELEVES[classeActuelle]) {
                    alert('⚠️ Erreur : aucune classe sélectionnée');
                    return;
                }
                
                const eleves = LISTES_ELEVES[classeActuelle].map(e => ({
                    nom: e.nom,
                    prenom: e.prenom,
                    nomComplet: `${e.prenom} ${e.nom.toUpperCase()}`
                })).sort((a, b) => a.nom.localeCompare(b.nom));
                
                if (format === 'excel') {
                    genererExcelEmargement(classeActuelle, eleves, colonnes);
                } else {
                    genererPDFEmargement(classeActuelle, eleves, colonnes);
                }
                
                modaleEmargement.style.display = 'none';
            });
        }
        
        // Fonction pour générer Excel
        function genererExcelEmargement(classe, eleves, colonnes) {
            // Vérifier si SheetJS est chargé
            if (typeof XLSX === 'undefined') {
                alert('❌ La bibliothèque XLSX n\'est pas chargée. Impossible de générer le fichier Excel.');
                return;
            }
            
            // Créer les données
            const headers = ['Élève', ...colonnes];
            const data = [
                headers, // En-têtes
                ...eleves.map(e => [e.nomComplet, ...Array(colonnes.length).fill('')])
            ];
            
            // Créer le classeur
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(data);
            
            // Définir les largeurs de colonnes
            const colWidths = [
                { wch: 30 }, // Colonne nom
                ...colonnes.map(() => ({ wch: 20 })) // Colonnes émargement
            ];
            ws['!cols'] = colWidths;
            
            // Ajouter la feuille au classeur
            XLSX.utils.book_append_sheet(wb, ws, 'Émargement');
            
            // Télécharger le fichier
            const fileName = `Emargement_${classe.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
            XLSX.writeFile(wb, fileName);
            
            alert(`✓ Liste d'émargement Excel générée !\n\nFichier : ${fileName}`);
        }
        
        // Fonction pour générer PDF
        function genererPDFEmargement(classe, eleves, colonnes) {
            // Vérifier si jsPDF est chargé
            if (typeof jspdf === 'undefined' && typeof window.jspdf === 'undefined') {
                alert('❌ La bibliothèque jsPDF n\'est pas chargée. Impossible de générer le fichier PDF.');
                return;
            }
            
            const { jsPDF } = window.jspdf || jspdf;
            const doc = new jsPDF();
            
            // Titre
            doc.setFontSize(16);
            doc.setFont(undefined, 'bold');
            doc.text(`Liste d'émargement - ${classe}`, 105, 15, { align: 'center' });
            
            // Date
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            const today = new Date().toLocaleDateString('fr-FR');
            doc.text(`Date : ${today}`, 105, 25, { align: 'center' });
            
            // Calculer les largeurs de colonnes
            const pageWidth = 180;
            const colNumWidth = 15;
            const colNomWidth = 70;
            const nbColonnes = colonnes.length;
            const colEmargementWidth = (pageWidth - colNumWidth - colNomWidth) / nbColonnes;
            
            // Tableau manuel
            let y = 35;
            const lineHeight = 8;
            const colX1 = 15;  // N°
            const colX2 = colX1 + colNumWidth;  // Nom
            
            // En-têtes
            doc.setFontSize(9);
            doc.setFont(undefined, 'bold');
            doc.setFillColor(59, 130, 246);
            doc.setTextColor(255, 255, 255);
            doc.rect(colX1, y, pageWidth, lineHeight, 'F');
            doc.text('N°', colX1 + 2, y + 5.5);
            doc.text('Élève', colX2 + 2, y + 5.5);
            
            // Ajouter les en-têtes des colonnes d'émargement
            colonnes.forEach((col, index) => {
                const colX = colX2 + colNomWidth + (index * colEmargementWidth);
                // Tronquer le texte si trop long
                const maxLength = Math.floor(colEmargementWidth / 2);
                const textToDisplay = col.length > maxLength ? col.substring(0, maxLength - 2) + '..' : col;
                doc.text(textToDisplay, colX + 2, y + 5.5);
            });
            
            y += lineHeight;
            
            // Lignes du tableau
            doc.setFont(undefined, 'normal');
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(9);
            
            eleves.forEach((eleve, index) => {
                // Vérifier si on doit ajouter une nouvelle page
                if (y > 270) {
                    doc.addPage();
                    y = 20;
                }
                
                // Bordures
                doc.setDrawColor(200, 200, 200);
                doc.rect(colX1, y, colNumWidth, lineHeight);
                doc.rect(colX2, y, colNomWidth, lineHeight);
                
                // Colonnes d'émargement
                colonnes.forEach((col, colIndex) => {
                    const colX = colX2 + colNomWidth + (colIndex * colEmargementWidth);
                    doc.rect(colX, y, colEmargementWidth, lineHeight);
                });
                
                // Contenu
                doc.text((index + 1).toString(), colX1 + 2, y + 5.5);
                // Tronquer le nom si trop long
                const nomMaxLength = Math.floor(colNomWidth / 2.5);
                const nomToDisplay = eleve.nomComplet.length > nomMaxLength ? 
                    eleve.nomComplet.substring(0, nomMaxLength - 2) + '..' : eleve.nomComplet;
                doc.text(nomToDisplay, colX2 + 2, y + 5.5);
                
                y += lineHeight;
            });
            
            // Télécharger
            const fileName = `Emargement_${classe.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
            doc.save(fileName);
            
            alert(`✓ Liste d'émargement PDF générée !\n\nFichier : ${fileName}`);
        }
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
                    <h3>Les listes de l’année 2026-2027 ne sont pas encore ajoutées.</h3>
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
                                <input type="text" id="jeu-titre" placeholder="Titre du jeu" style="flex: 1; padding: 12px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 1rem;">
                                <input type="url" id="jeu-url" placeholder="URL du jeu (https://...)" style="flex: 2; padding: 12px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 1rem;">
                                <button id="ajouter-jeu-btn" class="btn-primary">➕ Ajouter</button>
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

        async function loadJeux() {
            const online = window.EprofStore && await window.EprofStore.isOnlineReady();
            if (online) {
                const teacherId = await window.EprofStore.getTeacherId();
                const { data, error } = await window.EprofStore.list('pedagogical_games', {
                    filters: { teacher_id: teacherId },
                    orderBy: 'created_at'
                });
                if (!error && data) {
                    jeux = data.map(function(row) { return { id: row.id, titre: row.title, url: row.url }; });
                    try { localStorage.setItem('jeuxPedagogiques', JSON.stringify(jeux)); } catch (e) {}
                    return;
                }
                console.warn('⚠️ Jeux pédagogiques : bascule sur le cache local (Supabase indisponible).', error);
            }

            if (typeof JEUX_PEDAGOGIQUES !== 'undefined' && Array.isArray(JEUX_PEDAGOGIQUES) && JEUX_PEDAGOGIQUES.length > 0) {
                jeux = [...JEUX_PEDAGOGIQUES];
            } else {
                jeux = JSON.parse(localStorage.getItem('jeuxPedagogiques') || '[]');
            }
        }

        function afficherJeux(filtreTexte = '') {
            const jeuxListe = container.querySelector('#jeux-liste');
            
            // Filtrer les jeux selon la recherche
            const jeuxFiltres = filtreTexte
                ? jeux.filter(jeu => 
                    jeu.titre.toLowerCase().includes(filtreTexte.toLowerCase()) ||
                    jeu.url.toLowerCase().includes(filtreTexte.toLowerCase())
                  )
                : jeux;
            
            if (jeux.length === 0) {
                jeuxListe.innerHTML = '<p style="text-align: center; color: #64748b; font-style: italic; margin-top: 40px;">Aucun jeu enregistré. Ajoutez votre premier jeu !</p>';
            } else if (jeuxFiltres.length === 0) {
                jeuxListe.innerHTML = '<p style="text-align: center; color: #64748b; font-style: italic; margin-top: 40px;">🔍 Aucun jeu ne correspond à votre recherche.</p>';
            } else {
                jeuxListe.innerHTML = `
                    <div class="jeux-grid">
                        ${jeuxFiltres.map((jeu) => `
                            <div class="jeu-card">
                                <div class="jeu-card-header">
                                    <h4>${jeu.titre}</h4>
                                    <button class="btn-supprimer-jeu" data-titre="${jeu.titre}" data-id="${jeu.id || ''}">🗑️</button>
                                </div>
                                <a href="${jeu.url}" target="_blank" class="jeu-link">
                                    <div class="jeu-icon">🎮</div>
                                    <div class="jeu-url">${jeu.url}</div>
                                    <div class="jeu-action">▶️ Jouer</div>
                                </a>
                            </div>
                        `).join('')}
                    </div>
                `;

                // Boutons supprimer
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
            }
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

            const nouveauJeu = { titre, url };
            jeux.push(nouveauJeu);
            sauvegarderJeux();

            if (window.EprofStore && await window.EprofStore.isOnlineReady()) {
                const teacherId = await window.EprofStore.getTeacherId();
                const { data, error } = await window.EprofStore.insert('pedagogical_games', {
                    teacher_id: teacherId,
                    title: titre,
                    url: url
                });
                if (!error && data && data.id) {
                    nouveauJeu.id = data.id;
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
        // Charger les paramètres depuis localStorage
        let parametres = JSON.parse(localStorage.getItem('parametres') || JSON.stringify({
            enseignant: { nom: '', prenom: '', matiere: '', email: '' },
            anneeScolaire: '2026-2027',
            calendrier: { heureDebut: '08:00', heureFin: '20:00', dureeCoursDefaut: 60, afficherSamedi: false },
            affichage: { theme: 'clair', taillePolice: 'moyen', modeMobile: 'auto' },
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
            },
            periodes: {} // Structure: { "2nde LCQ": { type: "trimestres", trimestres: [{nom, debut, fin}] }, ... }
        }));

        // Migration douce : anciens seuils fixes -> liste de mentions configurable
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
        if (!parametres.affichage.modeMobile) {
            parametres.affichage.modeMobile = 'auto';
        }
        delete parametres.enseignant.etablissement;

        // Si un enseignant est connecté en ligne, le profil Supabase fait foi pour ses infos perso
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
                <h2>⚙️ Paramètres</h2>
                
                <div class="parametres-sections">
                    
                    <!-- Section 1: Informations enseignant -->
                    <div class="param-section">
                        <h3>📋 Informations de l'enseignant</h3>
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
                        </div>
                    </div>

                    <!-- Section 2: Année scolaire -->
                    <div class="param-section">
                        <h3>📅 Année scolaire</h3>
                        <div class="param-form">
                            <div class="param-row">
                                <label>Année scolaire :</label>
                                <select id="param-annee">
                                    <option value="2025-2026" ${parametres.anneeScolaire === '2025-2026' ? 'selected' : ''}>2025-2026</option>
                                    <option value="2026-2027" ${parametres.anneeScolaire === '2026-2027' ? 'selected' : ''}>2026-2027</option>
                                    <option value="2027-2028" ${parametres.anneeScolaire === '2027-2028' ? 'selected' : ''}>2027-2028</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <!-- Section 3: Calendrier -->
                    <div class="param-section">
                        <h3>🕐 Paramètres du calendrier</h3>
                        <div class="param-form">
                            <div class="param-row">
                                <label>Heure de début :</label>
                                <input type="time" id="param-heure-debut" value="${parametres.calendrier.heureDebut}">
                            </div>
                            <div class="param-row">
                                <label>Heure de fin :</label>
                                <input type="time" id="param-heure-fin" value="${parametres.calendrier.heureFin}">
                            </div>
                            <div class="param-row">
                                <label>Durée d'un cours (minutes) :</label>
                                <input type="number" id="param-duree-cours" value="${parametres.calendrier.dureeCoursDefaut}" min="15" max="240" step="15">
                            </div>
                            <div class="param-row">
                                <label>
                                    <input type="checkbox" id="param-afficher-samedi" ${parametres.calendrier.afficherSamedi ? 'checked' : ''}>
                                    Afficher le samedi dans le calendrier
                                </label>
                            </div>
                        </div>
                    </div>

                    <!-- Section 4: Affichage -->
                    <div class="param-section">
                        <h3>🎨 Préférences d'affichage</h3>
                        <div class="param-form">
                            <div class="param-row">
                                <label>Thème :</label>
                                <select id="param-theme">
                                    <option value="clair" ${parametres.affichage.theme === 'clair' ? 'selected' : ''}>Clair</option>
                                    <option value="sombre" ${parametres.affichage.theme === 'sombre' ? 'selected' : ''}>Sombre</option>
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
                        </div>
                    </div>

                    <!-- Section 5: Alertes et seuils -->
                    <div class="param-section">
                        <h3>🔔 Alertes et seuils</h3>
                        <div class="param-form">
                            <div class="param-row">
                                <label>Nombre d'oublis pour badge rouge :</label>
                                <input type="number" id="param-seuil-oublis" value="${parametres.alertes.seuilOublis}" min="1" max="20">
                            </div>
                            <div class="param-row">
                                <label>Nombre de mots à mettre pour alerte :</label>
                                <input type="number" id="param-seuil-mots" value="${parametres.alertes.seuilMots}" min="1" max="50">
                            </div>
                        </div>
                    </div>

                    <!-- Section 6: Barème de notation -->
                    <div class="param-section">
                        <h3>📊 Barème de notation</h3>
                        <div class="param-form">
                            <div class="param-row">
                                <label>Système de notation :</label>
                                <select id="param-systeme-notation">
                                    <option value="sur20" ${parametres.notation.systeme === 'sur20' ? 'selected' : ''}>Sur 20</option>
                                    <option value="sur10" ${parametres.notation.systeme === 'sur10' ? 'selected' : ''}>Sur 10</option>
                                    <option value="lettres" ${parametres.notation.systeme === 'lettres' ? 'selected' : ''}>Lettres (A-F)</option>
                                </select>
                            </div>
                            <p style="font-size: 0.9em; color: #64748b; margin: 4px 0 12px;">
                                Chaque mention s'applique à partir de sa note minimale, exprimée sur l'échelle choisie ci-dessus. Les mentions apparaissent automatiquement dans le carnet de notes à côté des moyennes. Cliquez sur un smiley pour le changer.
                            </p>
                            <div id="mentions-list"></div>
                            <div class="param-actions" style="margin-top: 10px;">
                                <button id="btn-ajouter-mention" type="button" class="btn-action btn-primary">➕ Ajouter une mention</button>
                            </div>
                        </div>
                    </div>

                    <!-- Section 7: Gestion des données -->
                    <div class="param-section">
                        <h3>💾 Gestion des données</h3>
                        <div class="param-actions">
                            <button id="btn-exporter-donnees" class="btn-action btn-success">
                                📥 Exporter toutes les données
                            </button>
                            <button id="btn-importer-donnees" class="btn-action btn-primary">
                                📤 Importer des données
                            </button>
                            <button id="btn-reinitialiser" class="btn-action btn-danger">
                                🗑️ Réinitialiser l'application
                            </button>
                            <input type="file" id="fichier-import" accept=".json" style="display:none;">
                        </div>
                    </div>

                    <!-- Section 8: Compte (identifiant / mot de passe) -->
                    <div class="param-section">
                        <h3>🔐 Mon compte</h3>
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
                    </div>

                    <!-- Bouton de sauvegarde général -->
                    <div class="param-save">
                        <button id="btn-sauvegarder-parametres" class="btn-save">
                            💾 Enregistrer les paramètres
                        </button>
                    </div>

                </div>
            </div>
        `;

        // ===== GESTION DES PÉRIODES PAR CLASSE =====
        // Note : la sélection de classe (#param-classe-select) n'existe plus dans ce
        // gabarit tant que les listes 2026-2027 ne sont pas importées ; on protège
        // donc ce bloc pour ne pas casser le reste de la page Paramètres.
        const classeSelect = container.querySelector('#param-classe-select');
        const configPeriodesDiv = container.querySelector('#config-periodes-classe');

        if (classeSelect && configPeriodesDiv) {
        classeSelect.addEventListener('change', function() {
            const classe = this.value;
            if (!classe) {
                configPeriodesDiv.style.display = 'none';
                return;
            }

            configPeriodesDiv.style.display = 'block';
            
            const configClasse = parametres.periodes[classe] || { type: 'trimestres', periodes: [] };

            configPeriodesDiv.innerHTML = `
                <div class="config-periodes-header">
                    <h4>⚙️ ${classe}</h4>
                    <div class="type-periodes-selector">
                        <label class="radio-option ${configClasse.type === 'trimestres' ? 'active' : ''}">
                            <input type="radio" name="type-${classe.replace(/\s/g, '-')}" value="trimestres" ${configClasse.type === 'trimestres' ? 'checked' : ''}>
                            <span>📅 Trimestres</span>
                        </label>
                        <label class="radio-option ${configClasse.type === 'semestres' ? 'active' : ''}">
                            <input type="radio" name="type-${classe.replace(/\s/g, '-')}" value="semestres" ${configClasse.type === 'semestres' ? 'checked' : ''}>
                            <span>📆 Semestres</span>
                        </label>
                    </div>
                </div>
                <div id="liste-periodes-${classe.replace(/\s/g, '-')}" class="liste-periodes">
                    <!-- Liste des périodes -->
                </div>
                <button id="btn-ajouter-periode-${classe.replace(/\s/g, '-')}" class="btn-add-periode">
                    ➕ Ajouter une période
                </button>
            `;

            const radioOptions = configPeriodesDiv.querySelectorAll('.radio-option');
            const radios = configPeriodesDiv.querySelectorAll(`input[name="type-${classe.replace(/\s/g, '-')}"]`);
            const listePeriodes = configPeriodesDiv.querySelector(`#liste-periodes-${classe.replace(/\s/g, '-')}`);
            const btnAjouter = configPeriodesDiv.querySelector(`#btn-ajouter-periode-${classe.replace(/\s/g, '-')}`);

            function afficherPeriodes() {
                const config = parametres.periodes[classe] || { type: 'trimestres', periodes: [] };
                
                if (config.periodes.length === 0) {
                    listePeriodes.innerHTML = '<p style="color: #64748b; font-style: italic;">Aucune période définie.</p>';
                } else {
                    listePeriodes.innerHTML = config.periodes.map((periode, index) => `
                        <div class="periode-item">
                            <div class="periode-content">
                                <strong>${periode.nom}</strong>
                                <span>Du ${periode.debut} au ${periode.fin}</span>
                            </div>
                            <button class="btn-supprimer-periode" data-index="${index}">🗑️</button>
                        </div>
                    `).join('');

                    // Boutons supprimer
                    listePeriodes.querySelectorAll('.btn-supprimer-periode').forEach(btn => {
                        btn.addEventListener('click', function() {
                            const index = parseInt(this.getAttribute('data-index'));
                            if (confirm(`Supprimer "${config.periodes[index].nom}" ?`)) {
                                config.periodes.splice(index, 1);
                                parametres.periodes[classe] = config;
                                localStorage.setItem('parametres', JSON.stringify(parametres));
                                afficherPeriodes();
                            }
                        });
                    });
                }
            }

            radios.forEach(radio => {
                radio.addEventListener('change', function() {
                    // Mettre à jour les styles actifs
                    radioOptions.forEach(opt => opt.classList.remove('active'));
                    this.parentElement.classList.add('active');
                    
                    if (!parametres.periodes[classe]) {
                        parametres.periodes[classe] = { type: this.value, periodes: [] };
                    } else {
                        parametres.periodes[classe].type = this.value;
                    }
                    localStorage.setItem('parametres', JSON.stringify(parametres));
                });
            });

            btnAjouter.addEventListener('click', function() {
                const config = parametres.periodes[classe] || { type: radios[0].checked ? radios[0].value : radios[1].value, periodes: [] };
                const numPeriode = config.periodes.length + 1;
                const typePeriode = config.type === 'trimestres' ? 'Trimestre' : 'Semestre';

                // Créer un formulaire d'ajout simple
                const formHTML = `
                    <div class="form-periode">
                        <input type="text" id="new-periode-nom" placeholder="Nom" value="${typePeriode} ${numPeriode}" style="flex: 2;">
                        <input type="date" id="new-periode-debut" style="flex: 1;">
                        <input type="date" id="new-periode-fin" style="flex: 1;">
                        <button class="btn-valider-periode">✓</button>
                        <button class="btn-annuler-periode">✗</button>
                    </div>
                `;
                
                listePeriodes.insertAdjacentHTML('beforeend', formHTML);
                const form = listePeriodes.querySelector('.form-periode:last-child');
                const nomInput = form.querySelector('#new-periode-nom');
                const debutInput = form.querySelector('#new-periode-debut');
                const finInput = form.querySelector('#new-periode-fin');
                const btnValider = form.querySelector('.btn-valider-periode');
                const btnAnnuler = form.querySelector('.btn-annuler-periode');

                btnValider.addEventListener('click', function() {
                    const nom = nomInput.value.trim();
                    const debut = debutInput.value;
                    const fin = finInput.value;

                    if (!nom || !debut || !fin) {
                        alert('⚠️ Veuillez remplir tous les champs');
                        return;
                    }

                    config.periodes.push({ nom, debut, fin });
                    parametres.periodes[classe] = config;
                    localStorage.setItem('parametres', JSON.stringify(parametres));
                    form.remove();
                    afficherPeriodes();
                });

                btnAnnuler.addEventListener('click', function() {
                    form.remove();
                });

                nomInput.focus();
            });

            afficherPeriodes();
        });
        }

        // ===== COMPTE (identifiant / mot de passe) =====
        const compteMessage = container.querySelector('#param-compte-message');
        function afficherMessageCompte(texte, succes) {
            if (!compteMessage) return;
            compteMessage.textContent = texte;
            compteMessage.style.color = succes ? '#059669' : '#dc2626';
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

        // ===== BARÈME DE NOTATION (mentions configurables) =====
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

        // Un clic hors des palettes les referme toutes
        document.addEventListener('click', function () {
            container.querySelectorAll('.mention-emoji-panel').forEach(p => { p.style.display = 'none'; });
        });

        renderMentionsList();

        // Changer d'échelle convertit les seuils pour conserver le sens des mentions
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

        // ===== SAUVEGARDE DES PARAMÈTRES =====
        const btnSauvegarder = container.querySelector('#btn-sauvegarder-parametres');
        btnSauvegarder.addEventListener('click', async function() {
            parametres.enseignant.nom = container.querySelector('#param-nom').value;
            parametres.enseignant.prenom = container.querySelector('#param-prenom').value;
            parametres.enseignant.matiere = container.querySelector('#param-matiere').value;
            parametres.enseignant.email = container.querySelector('#param-email').value;
            
            parametres.anneeScolaire = container.querySelector('#param-annee').value;
            
            parametres.calendrier.heureDebut = container.querySelector('#param-heure-debut').value;
            parametres.calendrier.heureFin = container.querySelector('#param-heure-fin').value;
            parametres.calendrier.dureeCoursDefaut = parseInt(container.querySelector('#param-duree-cours').value);
            parametres.calendrier.afficherSamedi = container.querySelector('#param-afficher-samedi').checked;
            
            parametres.affichage.theme = container.querySelector('#param-theme').value;
            parametres.affichage.taillePolice = container.querySelector('#param-taille-police').value;
            parametres.affichage.modeMobile = container.querySelector('#param-mode-mobile').value;
            
            parametres.alertes.seuilOublis = parseInt(container.querySelector('#param-seuil-oublis').value);
            parametres.alertes.seuilMots = parseInt(container.querySelector('#param-seuil-mots').value);
            
            parametres.notation.systeme = container.querySelector('#param-systeme-notation').value;
            parametres.notation.echelle = getEchelleNotation();
            parametres.notation.mentions = Array.from(container.querySelectorAll('.mention-row')).map(row => ({
                emoji: row.querySelector('.mention-emoji').value.trim() || '⭐',
                label: row.querySelector('.mention-label').value.trim() || 'Mention',
                seuilMin: parseFloat(row.querySelector('.mention-seuil').value) || 0
            }));

            localStorage.setItem('parametres', JSON.stringify(parametres));
            
            // Appliquer le thème
            appliquerTheme(parametres.affichage.theme);
            appliquerTaillePolice(parametres.affichage.taillePolice);
            appliquerModeMobile(parametres.affichage.modeMobile);

            // Synchroniser le profil enseignant en ligne (si connecté)
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

        // ===== EXPORT DES DONNÉES =====
        const btnExporter = container.querySelector('#btn-exporter-donnees');
        btnExporter.addEventListener('click', function() {
            const donnees = {
                parametres: parametres,
                suiviEleves: JSON.parse(localStorage.getItem('suiviEleves') || '{}'),
                jeuxPedagogiques: JSON.parse(localStorage.getItem('jeuxPedagogiques') || '[]'),
                calendrier: JSON.parse(localStorage.getItem('calendrier') || '[]'),
                exportDate: new Date().toISOString()
            };

            const blob = new Blob([JSON.stringify(donnees, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `eProf-backup-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);

            alert('✅ Données exportées avec succès !');
        });

        // ===== IMPORT DES DONNÉES =====
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
                    
                    if (confirm('⚠️ Attention : l\'importation remplacera toutes les données actuelles. Continuer ?')) {
                        if (donnees.parametres) localStorage.setItem('parametres', JSON.stringify(donnees.parametres));
                        if (donnees.suiviEleves) localStorage.setItem('suiviEleves', JSON.stringify(donnees.suiviEleves));
                        if (donnees.jeuxPedagogiques) localStorage.setItem('jeuxPedagogiques', JSON.stringify(donnees.jeuxPedagogiques));
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

        // ===== RÉINITIALISATION =====
        const btnReinitialiser = container.querySelector('#btn-reinitialiser');
        btnReinitialiser.addEventListener('click', function() {
            if (confirm('⚠️ ATTENTION : Cette action supprimera TOUTES les données de l\'application. Cette action est irréversible. Continuer ?')) {
                if (confirm('Êtes-vous vraiment sûr ? Toutes vos données seront perdues.')) {
                    localStorage.clear();
                    alert('✅ Application réinitialisée. La page va se recharger.');
                    location.reload();
                }
            }
        });

        // Appliquer le thème et la taille actuelle
        appliquerTheme(parametres.affichage.theme);
        appliquerTaillePolice(parametres.affichage.taillePolice);
        appliquerModeMobile(parametres.affichage.modeMobile);
    }

    // Fonction pour mettre à jour les informations dans le header
    // Fonctions pour appliquer le thème et la taille de police
    function appliquerTheme(theme) {
        if (theme === 'sombre') {
            document.body.classList.add('theme-sombre');
        } else {
            document.body.classList.remove('theme-sombre');
        }
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

    // ========================================
    // PLAN DE CLASSE
    // ========================================
    function renderPlanClasse(container) {
        container.innerHTML = `
            <div id="plan-classe-module">
                <h2>🪑 Plan de classe</h2>
                
                <div class="plan-classe-controls">
                    <details class="plan-config-accordion" id="plan-config-accordion">
                        <summary>⚙️ Configuration de la classe</summary>
                        <div class="config-accordion-body">
                            <div class="import-section">
                                <div style="display:flex;gap:10px;margin-bottom:15px;flex-wrap:wrap;">
                                    <button id="config-defaut-btn" class="btn-secondary">📐 Organisation par défaut</button>
                                    <button id="config-perso-btn" class="btn-secondary">🎨 Organisation personnalisée</button>
                                </div>
                                
                                <div id="config-perso-zone" style="display:none;margin-bottom:20px;padding:15px;background:#eff6ff;border-radius:8px;">
                                    <label>Nombre de places dans la classe :</label>
                                    <input type="number" id="nb-places-input" min="1" max="64" value="30" style="width:100px;padding:8px;border:2px solid #3b82f6;border-radius:6px;margin-left:10px;" />
                                    <button id="creer-grille-btn" class="btn-primary" style="margin-left:10px;">Créer la grille</button>
                                    <p style="color:#1e40af;font-size:0.9rem;margin-top:10px;">
                                        📍 Cliquez dans la grille pour placer les tables. Cliquez sur une table placée pour la griser/activer.
                                    </p>
                                </div>
                                
                                <h3 style="margin-top:20px;">Importer les élèves</h3>
                                <div style="display:flex;gap:10px;margin-bottom:15px;flex-wrap:wrap;">
                                    <button id="import-brut-btn" class="btn-secondary">📝 Import brut</button>
                                    <button id="import-excel-btn" class="btn-secondary">📊 Import Excel</button>
                                    <button id="import-liste-btn" class="btn-secondary">📋 Depuis liste enregistrée</button>
                                </div>
                                
                                <div id="import-brut-zone" style="display:none;">
                                    <label>Liste des élèves (un nom par ligne) :</label>
                                    <textarea id="eleves-brut" rows="8" placeholder="Martin Léa&#10;Dupont Thomas&#10;Bernard Julie&#10;..."></textarea>
                                    <button id="valider-import-btn" class="btn-primary">Valider la liste</button>
                                </div>
                                
                                <div id="import-excel-zone" style="display:none;">
                                    <label>Sélectionnez un fichier Excel :</label>
                                    <input type="file" id="excel-file-input" accept=".xlsx,.xls" style="margin-bottom:10px;" />
                                    <p style="color:#64748b;font-size:0.9rem;margin-top:5px;">
                                        📋 Format attendu : Colonne B = Nom, Colonne C = Prénom, Colonne D = Sexe (F/M)<br>
                                        📍 Les données doivent commencer à la ligne 7
                                    </p>
                                </div>
                                
                                <div id="import-liste-zone" style="display:none;">
                                    <label>Liste 2026-2027 :</label>
                                    <select id="liste-classe-select" style="width:100%;padding:10px;margin:10px 0;border:2px solid #3b82f6;border-radius:6px;font-size:1rem;">
                                        ${(function () {
                                            const listes = window.getAvailableStudentLists ? window.getAvailableStudentLists() : {};
                                            const noms = Object.keys(listes).sort();
                                            if (!noms.length) return '<option value="">-- Aucune liste disponible --</option>';
                                            return '<option value="">-- Choisir une classe --</option>' +
                                                noms.map(n => `<option value="${n}">${n} (${listes[n].length})</option>`).join('');
                                        })()}
                                    </select>
                                    <button id="charger-liste-btn" class="btn-primary">📥 Charger la liste</button>
                                    <p style="color:#64748b;font-size:0.9rem;margin-top:10px;">
                                        💡 Les listes sont importées par l’administrateur. Vous pouvez sinon utiliser l’import brut ou un fichier Excel.
                                    </p>
                                </div>
                                
                                <div id="import-liste-old-zone" style="display:none;">
                                    <label>Ou charger depuis un fichier personnalisé :</label>
                                    <select id="liste-enregistree">
                                        <option value="">-- Aucune liste enregistrée --</option>
                                    </select>
                                    <button id="charger-liste-btn" class="btn-primary">Charger la liste</button>
                                </div>
                            </div>
                        </div>
                    </details>
                </div>

                <div class="plan-classe-workspace">
                    <div class="salle-classe" id="salle-classe-container">
                        <div class="tables-grid" id="tables-grid-container">
                            ${generateTablesHTML()}
                        </div>
                        
                        <div class="bureau-prof">
                            <div style="background:#2563eb;color:white;padding:10px;border-radius:8px;text-align:center;font-weight:600;">
                                📚 Bureau du Professeur
                            </div>
                        </div>
                    </div>
                    
                    <div class="eleves-liste">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px;">
                            <h3 style="margin: 0;">Élèves disponibles</h3>
                            <button id="placement-aleatoire-btn" class="btn-secondary" style="padding: 8px 12px; font-size: 1.2rem;" title="Placer aléatoirement les élèves">🎲</button>
                        </div>
                        <div class="manual-student-add">
                            <input type="text" id="ajout-eleve-input" placeholder="Ajouter un élève à la main" aria-label="Ajouter un élève">
                            <button id="ajouter-eleve-btn" class="btn-primary">Ajouter</button>
                        </div>
                        <div id="eleves-disponibles" class="eleves-container">
                            <p style="color:#888;font-style:italic;">Importez une liste d'élèves pour commencer</p>
                        </div>
                    </div>
                </div>

                <div class="plan-actions">
                    <button id="reset-plan-btn" class="btn-secondary">🔄 Réinitialiser le plan</button>
                    <button id="load-plan-btn" class="btn-secondary">📂 Charger un plan (fichier)</button>
                    <input type="file" id="load-plan-input" accept=".json" style="display: none;">
                    <button id="save-plan-btn" class="btn-primary">💾 Enregistrer le plan (fichier)</button>
                    <button id="save-plan-cloud-btn" class="btn-primary">☁️ Enregistrer en ligne</button>
                    <button id="load-plan-cloud-btn" class="btn-secondary">📚 Mes plans en ligne</button>
                    <button id="export-plan-pdf-btn" class="btn-primary">📥 Exporter en PDF</button>
                </div>
            </div>
        `;

        initPlanClasse(container);
    }

    function generateTablesHTML() {
        let html = '';
        // 5 lignes de tables
        for (let row = 1; row <= 5; row++) {
            html += `<div class="table-row">`;
            // 3 colonnes de 2 places
            for (let col = 1; col <= 3; col++) {
                html += `<div class="table-double">`;
                html += `<div class="place" data-row="${row}" data-col="${col}" data-position="left"></div>`;
                html += `<div class="place" data-row="${row}" data-col="${col}" data-position="right"></div>`;
                html += `</div>`;
            }
            html += `</div>`;
        }
        return html;
    }

    function initPlanClasse(container) {
        const configDefautBtn = container.querySelector('#config-defaut-btn');
        const configPersoBtn = container.querySelector('#config-perso-btn');
        const configAccordion = container.querySelector('#plan-config-accordion');
        const configPersoZone = container.querySelector('#config-perso-zone');
        const nbPlacesInput = container.querySelector('#nb-places-input');
        const creerGrilleBtn = container.querySelector('#creer-grille-btn');
        const tablesGridContainer = container.querySelector('#tables-grid-container');
        const importBrutBtn = container.querySelector('#import-brut-btn');
        const importExcelBtn = container.querySelector('#import-excel-btn');
        const importListeBtn = container.querySelector('#import-liste-btn');
        const importBrutZone = container.querySelector('#import-brut-zone');
        const importExcelZone = container.querySelector('#import-excel-zone');
        const importListeZone = container.querySelector('#import-liste-zone');
        const validerImportBtn = container.querySelector('#valider-import-btn');
        const excelFileInput = container.querySelector('#excel-file-input');
        const chargerListeBtn = container.querySelector('#charger-liste-btn');
        const resetPlanBtn = container.querySelector('#reset-plan-btn');
        const savePlanBtn = container.querySelector('#save-plan-btn');
        const loadPlanBtn = container.querySelector('#load-plan-btn');
        const loadPlanInput = container.querySelector('#load-plan-input');
        const savePlanCloudBtn = container.querySelector('#save-plan-cloud-btn');
        const loadPlanCloudBtn = container.querySelector('#load-plan-cloud-btn');
        const exportPlanPdfBtn = container.querySelector('#export-plan-pdf-btn');
        const elevesDisponibles = container.querySelector('#eleves-disponibles');
        const ajoutEleveInput = container.querySelector('#ajout-eleve-input');
        const ajouterEleveBtn = container.querySelector('#ajouter-eleve-btn');
        const placementAleatoireBtn = container.querySelector('#placement-aleatoire-btn');
        
        if (configAccordion) {
            configAccordion.open = false;
        }
        
        let currentEleves = [];
        let modePersonnalise = false;
        let modeConfigurationTables = false; // true = on configure les tables, false = on place les élèves

        // Gestion configuration défaut vs personnalisée
        configDefautBtn.addEventListener('click', function() {
            configPersoZone.style.display = 'none';
            modePersonnalise = false;
            modeConfigurationTables = false;
            tablesGridContainer.innerHTML = generateTablesHTML();
            activerDragDropPlaces(container, elevesDisponibles, currentEleves);
        });

        configPersoBtn.addEventListener('click', function() {
            configPersoZone.style.display = 'block';
            modePersonnalise = true;
            modeConfigurationTables = true;
        });

        creerGrilleBtn.addEventListener('click', function() {
            const nbPlaces = parseInt(nbPlacesInput.value);
            if (nbPlaces < 1 || nbPlaces > 64) {
                alert('Veuillez saisir un nombre entre 1 et 64');
                return;
            }
            modeConfigurationTables = true;
            tablesGridContainer.innerHTML = genererGrillePersonnalisee(nbPlaces);
            activerConfigurationGrille(container, elevesDisponibles, currentEleves);
        });

        // Gestion des boutons d'import
        importBrutBtn.addEventListener('click', function() {
            importBrutZone.style.display = 'block';
            importExcelZone.style.display = 'none';
            importListeZone.style.display = 'none';
        });

        importExcelBtn.addEventListener('click', function() {
            importBrutZone.style.display = 'none';
            importExcelZone.style.display = 'block';
            importListeZone.style.display = 'none';
        });

        importListeBtn.addEventListener('click', function() {
            importBrutZone.style.display = 'none';
            importExcelZone.style.display = 'none';
            importListeZone.style.display = 'block';
            // Charger les listes enregistrées (à implémenter plus tard avec suivi élèves)
        });

        validerImportBtn.addEventListener('click', function() {
            const textArea = container.querySelector('#eleves-brut');
            const lines = textArea.value.split('\n').filter(l => l.trim());
            if (lines.length === 0) {
                alert('Veuillez saisir au moins un nom d\'élève');
                return;
            }
            currentEleves.length = 0; // Vider le tableau sans changer la référence
            currentEleves.push(...lines.map(name => name.trim())); // Ajouter les nouveaux éléments
            afficherElevesDisponibles(currentEleves, elevesDisponibles);
            textArea.value = '';
            importBrutZone.style.display = 'none';
        });

        function ajouterEleveManuellement() {
            if (!ajoutEleveInput) return;
            const nom = ajoutEleveInput.value.trim();
            if (!nom) {
                alert('Veuillez saisir un prénom ou un nom pour ajouter un élève.');
                return;
            }
            if (!currentEleves.includes(nom)) {
                currentEleves.push(nom);
                afficherElevesDisponibles(currentEleves, elevesDisponibles);
            }
            ajoutEleveInput.value = '';
            ajoutEleveInput.focus();
        }

        if (ajouterEleveBtn) {
            ajouterEleveBtn.addEventListener('click', ajouterEleveManuellement);
        }

        if (ajoutEleveInput) {
            ajoutEleveInput.addEventListener('keydown', function(event) {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    ajouterEleveManuellement();
                }
            });
        }

        // Gestion de l'import Excel
        excelFileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = function(event) {
                try {
                    const data = new Uint8Array(event.target.result);
                    const workbook = XLSX.read(data, {type: 'array'});
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(firstSheet, {header: 1});
                    
                    // Extraire les élèves du fichier Excel
                    const eleves = extraireElevesExcel(jsonData);
                    
                    if (eleves.length === 0) {
                        alert('⚠️ Aucun élève trouvé dans le fichier Excel.\nAssurez-vous que le fichier contient une colonne "Nom", "Prénom" ou "Eleve".');
                        return;
                    }
                    
                    currentEleves.length = 0; // Vider le tableau sans changer la référence
                    currentEleves.push(...eleves); // Ajouter les nouveaux éléments
                    afficherElevesDisponibles(currentEleves, elevesDisponibles);
                    importExcelZone.style.display = 'none';
                    excelFileInput.value = '';
                    alert(`✅ ${eleves.length} élève(s) importé(s) avec succès !`);
                } catch (error) {
                    alert('❌ Erreur lors de la lecture du fichier Excel : ' + error.message);
                }
            };
            reader.readAsArrayBuffer(file);
        });

        chargerListeBtn.addEventListener('click', async function() {
            const classeSelect = container.querySelector('#liste-classe-select');
            const classe = classeSelect.value;
            
            if (!classe) {
                alert('⚠️ Veuillez sélectionner une classe');
                return;
            }
            
            try {
                const listes = window.getAvailableStudentLists ? window.getAvailableStudentLists() : {};
                const listeClasse = listes[classe];
                if (!listeClasse) {
                    throw new Error(`Liste non trouvée pour la classe "${classe}"`);
                }
                
                if (listeClasse.length === 0) {
                    alert(`⚠️ La liste de la classe "${classe}" est vide.`);
                    return;
                }
                
                // Créer la liste des élèves au format attendu
                const eleves = [];
                listeClasse.forEach(eleve => {
                    // Format : "Prénom NOM (Sexe)"
                    const eleveNom = `${eleve.prenom} ${eleve.nom.toUpperCase()} (${(eleve.sexe || '').toUpperCase()})`;
                    eleves.push(eleveNom);
                });
                
                if (eleves.length === 0) {
                    alert('⚠️ Aucun élève valide trouvé');
                    return;
                }
                
                // Vider et remplir currentEleves
                currentEleves.length = 0;
                currentEleves.push(...eleves);
                afficherElevesDisponibles(currentEleves, elevesDisponibles);
                importListeZone.style.display = 'none';
                
                alert(`✅ ${eleves.length} élève(s) de la classe "${classe}" importé(s) avec succès !`);
                
            } catch (error) {
                alert(`❌ Erreur lors du chargement de la liste :\n${error.message}`);
            }
        });

        resetPlanBtn.addEventListener('click', function() {
            if (confirm('Voulez-vous réinitialiser le plan de classe ?')) {
                // Retirer tous les élèves des places
                container.querySelectorAll('.place').forEach(place => {
                    place.innerHTML = '';
                    place.classList.remove('occupied', 'place-feminin', 'place-masculin', 'place-disabled');
                });
                // Réafficher les élèves disponibles
                if (currentEleves.length > 0) {
                    afficherElevesDisponibles(currentEleves, elevesDisponibles);
                }
            }
        });

        savePlanBtn.addEventListener('click', async function() {
            const nomFichier = prompt('📝 Entrez le nom du plan de classe :', 'plan-classe-' + new Date().toISOString().slice(0,10));
            if (!nomFichier) return;
            
            const plan = capturerPlan(container, modePersonnalise);
            plan.nomPlan = nomFichier;
            plan.dateCreation = new Date().toISOString();
            
            // Créer le contenu JSON
            const jsonStr = JSON.stringify(plan, null, 2);
            
            try {
                // Utiliser l'API File System Access pour sauvegarder directement
                if (window.showSaveFilePicker) {
                    const fileName = nomFichier.endsWith('.json') ? nomFichier : nomFichier + '.json';
                    const handle = await window.showSaveFilePicker({
                        suggestedName: fileName,
                        types: [{
                            description: 'Plan de classe JSON',
                            accept: { 'application/json': ['.json'] }
                        }]
                    });
                    
                    const writable = await handle.createWritable();
                    await writable.write(jsonStr);
                    await writable.close();
                    
                    alert(`✅ Plan de classe "${nomFichier}" enregistré !`);
                } else {
                    // Fallback pour navigateurs ne supportant pas l'API
                    const blob = new Blob([jsonStr], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = nomFichier.endsWith('.json') ? nomFichier : nomFichier + '.json';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    
                    alert(`✅ Plan de classe "${nomFichier}" enregistré !\n💡 Conseil: Déplacez le fichier dans le dossier eProf pour le retrouver facilement.`);
                }
            } catch (error) {
                if (error.name !== 'AbortError') {
                    alert('❌ Erreur lors de la sauvegarde : ' + error.message);
                }
            }
        });

        loadPlanBtn.addEventListener('click', function() {
            loadPlanInput.click();
        });

        // ===== Enregistrement / chargement en ligne (Supabase - table class_plans) =====
        savePlanCloudBtn.addEventListener('click', async function() {
            if (!window.EprofStore || !(await window.EprofStore.isOnlineReady())) {
                alert('☁️ Connectez-vous à votre compte eProf pour enregistrer un plan en ligne.');
                return;
            }
            const nomPlan = prompt('📝 Nom du plan à enregistrer en ligne :', 'plan-classe-' + new Date().toISOString().slice(0, 10));
            if (!nomPlan) return;

            const plan = capturerPlan(container, modePersonnalise);
            plan.nomPlan = nomPlan;

            const teacherId = await window.EprofStore.getTeacherId();
            const { error } = await window.EprofStore.insert('class_plans', {
                teacher_id: teacherId,
                name: nomPlan,
                data: plan
            });

            if (error) {
                alert('❌ Erreur lors de l\'enregistrement en ligne : ' + error.message);
            } else {
                alert(`✅ Plan "${nomPlan}" enregistré en ligne !`);
            }
        });

        loadPlanCloudBtn.addEventListener('click', async function() {
            if (!window.EprofStore || !(await window.EprofStore.isOnlineReady())) {
                alert('☁️ Connectez-vous à votre compte eProf pour accéder à vos plans en ligne.');
                return;
            }

            const teacherId = await window.EprofStore.getTeacherId();
            const { data, error } = await window.EprofStore.list('class_plans', {
                filters: { teacher_id: teacherId },
                orderBy: 'updated_at',
                ascending: false
            });

            if (error) {
                alert('❌ Impossible de récupérer vos plans en ligne : ' + error.message);
                return;
            }

            showCloudPlansModal(data || []);
        });

        function showCloudPlansModal(plans) {
            const modal = document.createElement('div');
            modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 2em;';

            const listHtml = plans.length ? plans.map(function(row) {
                const created = row.updated_at ? new Date(row.updated_at).toLocaleString('fr-FR') : '';
                return `
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:1em;padding:0.8em 1em;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:0.6em;">
                        <div>
                            <div style="font-weight:600;color:#1a2236;">${row.name}</div>
                            <div style="font-size:0.8em;color:#64748b;">${created}</div>
                        </div>
                        <div style="display:flex;gap:0.5em;">
                            <button class="btn-primary cloud-plan-load" data-id="${row.id}">📂 Charger</button>
                            <button class="btn-secondary cloud-plan-delete" data-id="${row.id}">🗑️</button>
                        </div>
                    </div>
                `;
            }).join('') : '<p style="color:#888;font-style:italic;">Aucun plan enregistré en ligne pour le moment.</p>';

            modal.innerHTML = `
                <div style="background: white; border-radius: 16px; max-width: 560px; width: 100%; max-height: 80vh; overflow-y: auto; padding: 2em; position: relative;">
                    <button id="close-cloud-plans-modal" style="position: absolute; top: 1em; right: 1em; background: #ef4444; color: white; border: none; border-radius: 50%; width: 32px; height: 32px; cursor: pointer; font-size: 1.2em;">×</button>
                    <h2 style="margin: 0 0 1em 0; color: #1a2236;">📚 Mes plans en ligne</h2>
                    ${listHtml}
                </div>
            `;

            document.body.appendChild(modal);

            modal.querySelector('#close-cloud-plans-modal').addEventListener('click', function() { modal.remove(); });
            modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });

            modal.querySelectorAll('.cloud-plan-load').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    const row = plans.find(function(p) { return p.id === btn.getAttribute('data-id'); });
                    if (!row) return;
                    modePersonnalise = !!row.data.modePersonnalise;
                    restaurerPlan(row.data, container);
                    modal.remove();
                    alert(`✅ Plan "${row.name}" chargé !`);
                });
            });

            modal.querySelectorAll('.cloud-plan-delete').forEach(function(btn) {
                btn.addEventListener('click', async function() {
                    const row = plans.find(function(p) { return p.id === btn.getAttribute('data-id'); });
                    if (!row) return;
                    if (!confirm(`Supprimer le plan "${row.name}" de votre espace en ligne ?`)) return;
                    const { error } = await window.EprofStore.remove('class_plans', row.id);
                    if (error) {
                        alert('❌ Erreur lors de la suppression : ' + error.message);
                        return;
                    }
                    modal.remove();
                    showCloudPlansModal(plans.filter(function(p) { return p.id !== row.id; }));
                });
            });
        }

        loadPlanInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = function(event) {
                try {
                    const plan = JSON.parse(event.target.result);
                    
                    // Vérifier que c'est bien un plan de classe valide
                    if (!plan.places || !Array.isArray(plan.places)) {
                        alert('⚠️ Fichier invalide. Ce n\'est pas un plan de classe.');
                        return;
                    }
                    
                    // Recréer le plan
                    if (plan.modePersonnalise) {
                        // Mode personnalisé
                        const nbPlaces = plan.places.length;
                        const nbPlacesInput = container.querySelector('#nb-places-input');
                        if (nbPlacesInput) {
                            nbPlacesInput.value = nbPlaces;
                        }
                        const tablesGridContainer = container.querySelector('#tables-grid-container');
                        tablesGridContainer.innerHTML = genererGrillePersonnalisee(nbPlaces);
                        
                        // Recréer les tables et placer les élèves
                        plan.places.forEach(p => {
                            const cell = container.querySelector(`.grille-cell[data-row="${p.row}"][data-col="${p.col}"]`);
                            if (cell) {
                                const place = document.createElement('div');
                                place.className = 'place';
                                
                                if (p.disabled) {
                                    place.classList.add('place-disabled');
                                }
                                
                                if (p.occupied && p.nom) {
                                    place.textContent = p.nom;
                                    place.classList.add('occupied');
                                    
                                    if (p.sexe === 'F') {
                                        place.classList.add('place-feminin');
                                    } else if (p.sexe === 'M') {
                                        place.classList.add('place-masculin');
                                    }
                                }
                                
                                cell.appendChild(place);
                            }
                        });
                        
                        // Valider l'organisation automatiquement
                        const grille = container.querySelector('.grille-perso-9x9');
                        if (grille) {
                            grille.classList.add('validated');
                        }
                        const validerBtn = container.querySelector('#valider-organisation-btn');
                        if (validerBtn) {
                            validerBtn.style.display = 'none';
                        }
                        
                        // Activer le drag and drop
                        setTimeout(() => {
                            const places = container.querySelectorAll('.grille-cell .place');
                            places.forEach(place => {
                                setupPlaceDragDrop(place, container, elevesDisponibles, currentEleves);
                                place.addEventListener('click', function(e) {
                                    if (!this.classList.contains('occupied')) {
                                        this.classList.toggle('place-disabled');
                                    }
                                });
                            });
                        }, 100);
                        
                        modePersonnalise = true;
                    } else {
                        // Mode par défaut
                        plan.places.forEach(function(p) {
                            const place = container.querySelector(`.place[data-row="${p.row}"][data-col="${p.col}"][data-position="${p.position}"]`);
                            if (place && p.occupied && p.nom) {
                                place.textContent = p.nom;
                                place.classList.add('occupied');
                                
                                if (p.sexe === 'F') {
                                    place.classList.add('place-feminin');
                                } else if (p.sexe === 'M') {
                                    place.classList.add('place-masculin');
                                }
                            }
                            
                            if (place && p.disabled) {
                                place.classList.add('place-disabled');
                            }
                        });
                    }
                    
                    // Restaurer les élèves disponibles
                    if (plan.elevesDisponibles && plan.elevesDisponibles.length > 0) {
                        currentEleves.length = 0;
                        currentEleves.push(...plan.elevesDisponibles);
                        afficherElevesDisponibles(currentEleves, elevesDisponibles);
                    }
                    
                    const nomPlan = plan.nomPlan || file.name;
                    alert(`✅ Plan "${nomPlan}" chargé avec succès !`);
                    
                } catch (error) {
                    alert('❌ Erreur lors de la lecture du fichier : ' + error.message);
                }
            };
            reader.readAsText(file);
            
            // Réinitialiser l'input pour permettre de recharger le même fichier
            e.target.value = '';
        });

        exportPlanPdfBtn.addEventListener('click', function() {
            exportPlanPDF(container);
        });

        // Placement aléatoire des élèves
        placementAleatoireBtn.addEventListener('click', function() {
            if (currentEleves.length === 0) {
                alert('⚠️ Aucun élève disponible. Importez d\'abord une liste d\'\u00e9lèves.');
                return;
            }
            
            // Récupérer toutes les places disponibles (non grisées et non occupées)
            const placesDisponibles = Array.from(container.querySelectorAll('.place'))
                .filter(place => !place.classList.contains('place-disabled') && !place.classList.contains('occupied'));
            
            if (placesDisponibles.length === 0) {
                alert('⚠️ Aucune place disponible. Vérifiez que des tables sont actives et vides.');
                return;
            }
            
            if (currentEleves.length > placesDisponibles.length) {
                const reponse = confirm(`⚠️ Il y a ${currentEleves.length} élèves mais seulement ${placesDisponibles.length} places disponibles.\nVoulez-vous placer les ${placesDisponibles.length} premiers élèves aléatoirement ?`);
                if (!reponse) return;
            }
            
            // Mélanger aléatoirement le tableau des élèves (algorithme Fisher-Yates)
            const elevesMelanges = [...currentEleves];
            for (let i = elevesMelanges.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [elevesMelanges[i], elevesMelanges[j]] = [elevesMelanges[j], elevesMelanges[i]];
            }
            
            // Mélanger aléatoirement les places disponibles
            const placesMelangees = [...placesDisponibles];
            for (let i = placesMelangees.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [placesMelangees[i], placesMelangees[j]] = [placesMelangees[j], placesMelangees[i]];
            }
            
            // Placer les élèves
            const nbAplacer = Math.min(elevesMelanges.length, placesMelangees.length);
            for (let i = 0; i < nbAplacer; i++) {
                const place = placesMelangees[i];
                const nom = elevesMelanges[i];
                
                place.textContent = nom;
                place.classList.add('occupied');
                
                // Ajouter la classe de couleur selon le sexe
                place.classList.remove('place-feminin', 'place-masculin');
                if (nom.includes('(F)')) {
                    place.classList.add('place-feminin');
                } else if (nom.includes('(M)')) {
                    place.classList.add('place-masculin');
                }
            }
            
            // Retirer les élèves placés de la liste
            currentEleves.splice(0, nbAplacer);
            afficherElevesDisponibles(currentEleves, elevesDisponibles);
            
            alert(`✅ ${nbAplacer} élève(s) placé(s) aléatoirement !`);
        });
        
        // Initialiser les places avec le drag and drop
        activerDragDropPlaces(container, elevesDisponibles, currentEleves);
    }

    // Fonction pour générer la grille personnalisée 9x9
    function genererGrillePersonnalisee(nbPlaces) {
        let html = '<div class="instructions-grille">📍 Cliquez sur une cellule pour y placer une table (max: ' + nbPlaces + '). Cliquez sur une table pour la supprimer.</div>';
        html += '<div class="grille-perso-9x9">';
        
        // Créer une grille 9x9 = 81 cellules
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                html += `<div class="grille-cell" data-row="${row}" data-col="${col}"></div>`;
            }
        }
        
        html += '</div>';
        html += '<button id="valider-organisation-btn" class="btn-action" style="margin: 15px auto; display: block; background: #10b981; font-size: 1.1rem; padding: 12px 24px;">✅ Valider l\'organisation des tables</button>';
        html += '<div class="bureau-prof">Bureau du professeur</div>';
        
        return html;
    }

    // Fonction pour configurer la grille personnalisée (créer et griser les tables)
    function activerConfigurationGrille(container, elevesDisponibles, currentEleves) {
        setTimeout(() => {
            const nbPlacesInput = container.querySelector('#nb-places-input');
            const nbPlacesMax = parseInt(nbPlacesInput.value) || 64;
            let nbPlacesCreees = 0;
            
            const grilleCells = container.querySelectorAll('.grille-cell');
            
            // Fonction de gestion des clics pendant la configuration
            const handleConfigClick = function(e) {
                if (this.querySelector('.place')) {
                    // Si la cellule contient déjà une place, on la supprime
                    if (confirm('Voulez-vous supprimer cette table ?')) {
                        this.querySelector('.place').remove();
                        nbPlacesCreees--;
                    }
                } else {
                    // Créer une nouvelle place si on n'a pas atteint la limite
                    if (nbPlacesCreees >= nbPlacesMax) {
                        alert(`⚠️ Vous avez atteint le nombre maximum de tables (${nbPlacesMax})`);
                        return;
                    }
                    const newPlace = document.createElement('div');
                    newPlace.className = 'place';
                    const tablePalette = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
                    const tableColor = tablePalette[nbPlacesCreees % tablePalette.length];
                    newPlace.style.borderColor = tableColor;
                    newPlace.style.boxShadow = `inset 0 0 0 2px ${tableColor}33`;
                    newPlace.textContent = '';
                    this.appendChild(newPlace);
                    nbPlacesCreees++;
                }
            };
            
            grilleCells.forEach(cell => {
                cell.addEventListener('click', handleConfigClick);
                // Stocker la référence pour pouvoir la retirer plus tard
                cell._handleConfigClick = handleConfigClick;
            });
            
            // Bouton de validation de l'organisation
            const validerBtn = container.querySelector('#valider-organisation-btn');
            if (validerBtn) {
                validerBtn.addEventListener('click', function() {
                    if (nbPlacesCreees === 0) {
                        alert('⚠️ Veuillez placer au moins une table avant de valider.');
                        return;
                    }
                    
                    // Retirer les événements de clic de configuration sur les cellules
                    grilleCells.forEach(cell => {
                        if (cell._handleConfigClick) {
                            cell.removeEventListener('click', cell._handleConfigClick);
                            delete cell._handleConfigClick;
                        }
                    });
                    
                    // Passer en mode placement des élèves
                    this.style.display = 'none';
                    
                    // Faire disparaître la grille
                    const grille = container.querySelector('.grille-perso-9x9');
                    if (grille) {
                        grille.classList.add('validated');
                    }
                    
                    const instructions = container.querySelector('.instructions-grille');
                    if (instructions) {
                        instructions.innerHTML = '🎓 Glissez-déposez les élèves sur les tables. Cliquez sur une table vide pour la griser. Double-cliquez sur une table occupée pour retirer un élève.';
                        instructions.style.background = '#dcfce7';
                        instructions.style.borderColor = '#10b981';
                    }
                    
                    // Activer le drag and drop sur toutes les places + possibilité de griser
                    const places = container.querySelectorAll('.grille-cell .place');
                    places.forEach(place => {
                        // Drag and drop
                        setupPlaceDragDrop(place, container, elevesDisponibles, currentEleves);
                        
                        // Clic pour griser (seulement si vide)
                        place.addEventListener('click', function(e) {
                            if (!this.classList.contains('occupied')) {
                                this.classList.toggle('place-disabled');
                            }
                        });
                    });
                    
                    alert('✅ Organisation validée ! Vous pouvez maintenant placer les élèves et griser les tables vides.');
                });
            }
        }, 100);
    }

    // Fonction pour activer le drag and drop sur les places (mode par défaut)
    function activerDragDropPlaces(container, elevesDisponibles, currentEleves) {
        setTimeout(() => {
            // Gérer les clics sur les places du mode par défaut pour les griser
            const placesDefaut = container.querySelectorAll('.tables-grid .place');
            placesDefaut.forEach(place => {
                // Clic pour griser
                place.addEventListener('click', function(e) {
                    // Toggle le mode disabled uniquement si la place est vide
                    if (!this.classList.contains('occupied')) {
                        this.classList.toggle('place-disabled');
                    }
                });
                
                // Activer le drag and drop
                setupPlaceDragDrop(place, container, elevesDisponibles, currentEleves);
            });
        }, 100);
    }

    // Configuration du drag & drop pour une place spécifique
    function setupPlaceDragDrop(place, mainContainer, elevesContainer, elevesArray) {
        // Rendre la place draggable si elle est occupée
        const updateDraggableState = function() {
            if (place.classList.contains('occupied')) {
                place.draggable = true;
                place.style.cursor = 'move';
            } else {
                place.draggable = false;
                place.style.cursor = 'pointer';
            }
        };
        
        // Initialiser l'état draggable
        updateDraggableState();
        
        // Observer les changements de classe pour mettre à jour draggable
        const observer = new MutationObserver(updateDraggableState);
        observer.observe(place, { attributes: true, attributeFilter: ['class'] });
        
        // Drag depuis une place occupée
        place.addEventListener('dragstart', function(e) {
            if (this.classList.contains('occupied')) {
                const nom = this.textContent;
                e.dataTransfer.setData('text/plain', nom);
                e.dataTransfer.setData('source', 'place'); // Indiquer que ça vient d'une place
                e.dataTransfer.effectAllowed = 'move';
                this.classList.add('dragging');
                this.style.opacity = '0.5';
            } else {
                e.preventDefault();
            }
        });
        
        place.addEventListener('dragend', function(e) {
            this.classList.remove('dragging');
            this.style.opacity = '1';
        });
        
        place.addEventListener('dragover', function(e) {
            e.preventDefault();
            if (!this.classList.contains('place-disabled')) {
                e.dataTransfer.dropEffect = 'move';
                this.classList.add('drag-over');
            }
        });

        place.addEventListener('dragleave', function(e) {
            this.classList.remove('drag-over');
        });

        place.addEventListener('drop', function(e) {
            e.preventDefault();
            this.classList.remove('drag-over');
            
            if (this.classList.contains('place-disabled')) {
                return; // Ne pas permettre de placer sur une table grisée
            }

            const nom = e.dataTransfer.getData('text/plain');
            const source = e.dataTransfer.getData('source');
            
            // Trouver la place source si le drag vient d'une autre place
            let placeSource = null;
            if (source === 'place') {
                placeSource = mainContainer.querySelector('.place.dragging');
            }
            
            // Si on drop sur la même place, ne rien faire
            if (placeSource === this) {
                return;
            }
            
            // Gérer l'échange ou le déplacement
            if (this.classList.contains('occupied')) {
                const oldName = this.textContent;
                
                if (placeSource) {
                    // Échange entre deux places
                    placeSource.textContent = oldName;
                    placeSource.classList.add('occupied');
                    placeSource.classList.remove('place-feminin', 'place-masculin');
                    if (oldName.includes('(F)')) {
                        placeSource.classList.add('place-feminin');
                    } else if (oldName.includes('(M)')) {
                        placeSource.classList.add('place-masculin');
                    }
                } else {
                    // Remettre l'ancien élève dans la liste (drag depuis la liste)
                    elevesArray.push(oldName);
                }
            } else if (placeSource) {
                // Déplacement depuis une place vers une place vide
                placeSource.textContent = '';
                placeSource.classList.remove('occupied', 'place-feminin', 'place-masculin');
            }
            
            // Placer le nouvel élève
            this.textContent = nom;
            this.classList.add('occupied');
            
            // Ajouter la classe de couleur selon le sexe
            this.classList.remove('place-feminin', 'place-masculin');
            if (nom.includes('(F)')) {
                this.classList.add('place-feminin');
            } else if (nom.includes('(M)')) {
                this.classList.add('place-masculin');
            }
            
            // Retirer l'élève de la liste disponible (seulement si drag depuis la liste)
            if (!placeSource) {
                const index = elevesArray.indexOf(nom);
                if (index > -1) {
                    elevesArray.splice(index, 1);
                }
            }
            
            afficherElevesDisponibles(elevesArray, elevesContainer);
        });

        // Double-clic pour retirer un élève d'une place
        place.addEventListener('dblclick', function() {
            if (this.classList.contains('occupied')) {
                const nom = this.textContent;
                elevesArray.push(nom);
                this.textContent = '';
                this.classList.remove('occupied', 'place-feminin', 'place-masculin');
                afficherElevesDisponibles(elevesArray, elevesContainer);
            }
        });
    }

    function afficherElevesDisponibles(eleves, container) {
        container.innerHTML = '';
        
        const placementBtn = document.querySelector('#placement-aleatoire-btn');
        if (placementBtn) {
            placementBtn.disabled = eleves.length === 0;
            placementBtn.style.opacity = eleves.length === 0 ? '0.5' : '1';
            placementBtn.style.cursor = eleves.length === 0 ? 'not-allowed' : 'pointer';
        }
        
        eleves.forEach(function(nom, index) {
            const eleveDiv = document.createElement('div');
            eleveDiv.className = 'eleve-card';
            
            if (nom.includes('(F)')) {
                eleveDiv.classList.add('eleve-feminin');
            } else if (nom.includes('(M)')) {
                eleveDiv.classList.add('eleve-masculin');
            }
            
            const label = document.createElement('span');
            label.className = 'eleve-label';
            label.textContent = nom;

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'eleve-remove';
            removeBtn.title = 'Retirer cet élève';
            removeBtn.textContent = '×';
            removeBtn.addEventListener('click', function(event) {
                event.stopPropagation();
                if (Array.isArray(eleves)) {
                    eleves.splice(index, 1);
                    const currentContainer = document.querySelector('#eleves-disponibles');
                    if (currentContainer) {
                        afficherElevesDisponibles(eleves, currentContainer);
                    }
                }
            });

            eleveDiv.appendChild(label);
            eleveDiv.appendChild(removeBtn);
            eleveDiv.draggable = true;
            eleveDiv.dataset.nom = nom;
            eleveDiv.dataset.index = index;

            eleveDiv.addEventListener('dragstart', function(e) {
                e.dataTransfer.setData('text/plain', nom);
                e.dataTransfer.effectAllowed = 'move';
                eleveDiv.classList.add('dragging');
            });

            eleveDiv.addEventListener('dragend', function(e) {
                eleveDiv.classList.remove('dragging');
            });

            container.appendChild(eleveDiv);
        });
    }

    function extraireElevesExcel(data) {
        if (!data || data.length < 7) return [];
        
        const eleves = [];
        
        // Commencer à la ligne 7 (index 6)
        for (let i = 6; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length === 0) continue;
            
            // Colonne B (index 1) = Nom
            // Colonne C (index 2) = Prénom
            // Colonne D (index 3) = Sexe
            const nom = row[1] ? row[1].toString().trim() : '';
            const prenom = row[2] ? row[2].toString().trim() : '';
            const sexe = row[3] ? row[3].toString().trim().toUpperCase() : '';
            
            // Vérifier que ce n'est pas juste un numéro
            if (!nom || !prenom) continue;
            if (!isNaN(nom) && !isNaN(prenom)) continue; // Skip si les deux sont des nombres
            
            // Construire le nom complet
            let nomComplet = `${prenom} ${nom}`;
            
            // Ajouter le sexe si disponible
            if (sexe === 'F' || sexe === 'M') {
                nomComplet += ` (${sexe})`;
            }
            
            eleves.push(nomComplet);
        }
        
        return eleves;
    }

    function capturerPlan(container, modePersonnalise) {
        const plan = {
            date: new Date().toISOString(),
            modePersonnalise: modePersonnalise,
            places: [],
            elevesDisponibles: []
        };
        
        // Capturer les élèves disponibles
        const elevesCards = container.querySelectorAll('.eleve-card');
        elevesCards.forEach(card => {
            plan.elevesDisponibles.push(card.textContent);
        });
        
        // En mode personnalisé, capturer aussi la position des tables dans la grille
        if (modePersonnalise) {
            const grilleCells = container.querySelectorAll('.grille-cell');
            grilleCells.forEach(cell => {
                const place = cell.querySelector('.place');
                if (place) {
                    const placeData = {
                        row: cell.dataset.row,
                        col: cell.dataset.col,
                        disabled: place.classList.contains('place-disabled')
                    };
                    
                    if (place.classList.contains('occupied')) {
                        placeData.nom = place.textContent;
                        placeData.occupied = true;
                        
                        // Capturer le sexe
                        if (place.classList.contains('place-feminin')) {
                            placeData.sexe = 'F';
                        } else if (place.classList.contains('place-masculin')) {
                            placeData.sexe = 'M';
                        }
                    }
                    
                    plan.places.push(placeData);
                }
            });
        } else {
            // Mode par défaut : capturer les places existantes
            container.querySelectorAll('.place').forEach(function(place) {
                const placeData = {
                    row: place.dataset.row,
                    col: place.dataset.col,
                    position: place.dataset.position
                };
                
                if (place.classList.contains('occupied')) {
                    placeData.nom = place.textContent;
                    placeData.occupied = true;
                    
                    if (place.classList.contains('place-feminin')) {
                        placeData.sexe = 'F';
                    } else if (place.classList.contains('place-masculin')) {
                        placeData.sexe = 'M';
                    }
                }
                
                plan.places.push(placeData);
            });
        }
        
        return plan;
    }

    function restaurerPlan(plan, container) {
        if (!plan || !plan.places) return;
        
        const elevesDisponibles = container.querySelector('#eleves-disponibles');
        
        // Restaurer le mode
        if (plan.modePersonnalise) {
            // Créer la grille personnalisée
            const tablesGrid = container.querySelector('#tables-grid-container');
            const nbPlaces = plan.places.length;
            tablesGrid.innerHTML = genererGrillePersonnalisee(nbPlaces);
            
            // Restaurer les places et leur contenu
            plan.places.forEach(p => {
                const cell = container.querySelector(`.grille-cell[data-row="${p.row}"][data-col="${p.col}"]`);
                if (cell) {
                    const place = document.createElement('div');
                    place.className = 'place';
                    
                    if (p.disabled) {
                        place.classList.add('place-disabled');
                    }
                    
                    if (p.occupied && p.nom) {
                        place.textContent = p.nom;
                        place.classList.add('occupied');
                        
                        if (p.sexe === 'F') {
                            place.classList.add('place-feminin');
                        } else if (p.sexe === 'M') {
                            place.classList.add('place-masculin');
                        }
                    }
                    
                    cell.appendChild(place);
                }
            });
        } else {
            // Mode par défaut
            plan.places.forEach(function(p) {
                const place = container.querySelector(`.place[data-row="${p.row}"][data-col="${p.col}"][data-position="${p.position}"]`);
                if (place && p.occupied && p.nom) {
                    place.textContent = p.nom;
                    place.classList.add('occupied');
                    
                    if (p.sexe === 'F') {
                        place.classList.add('place-feminin');
                    } else if (p.sexe === 'M') {
                        place.classList.add('place-masculin');
                    }
                }
            });
        }
        
        // Restaurer les élèves disponibles
        if (plan.elevesDisponibles && plan.elevesDisponibles.length > 0) {
            afficherElevesDisponibles(plan.elevesDisponibles, elevesDisponibles);
        }
    }

    function exportPlanPDF(container) {
        const salleClasse = container.querySelector('.salle-classe');
        
        if (window.html2canvas && window.jspdf) {
            html2canvas(salleClasse, {
                scale: 2,
                logging: false,
                backgroundColor: '#ffffff'
            }).then(function(canvas) {
                const { jsPDF } = window.jspdf;
                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF('l', 'mm', 'a4');
                const imgWidth = 297;
                const imgHeight = (canvas.height * imgWidth) / canvas.width;
                
                pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
                pdf.save('plan-classe.pdf');
                alert('✅ Plan de classe exporté en PDF !');
            }).catch(function(err) {
                alert('Erreur lors de l\'export PDF : ' + err.message);
            });
        } else {
            alert('Bibliothèques PDF non disponibles');
        }
    }
});

