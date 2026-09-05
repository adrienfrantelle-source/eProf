/* Suivi des élèves — extraits de app.js */
(function (global) {
    var E = function () { return global.EprofEleves || {}; };
    var suiviNav = { from: '', conseil: null };
    function getAnneeScolaire() { return E().getAnneeScolaire(); }
    function getAlertesSeuils() { return E().getAlertesSeuils(); }
    function getVisibleTeacherClasses() { return E().getVisibleTeacherClasses(); }
    function getListsForTeacher() { return E().getListsForTeacher(); }
    function classeBtnHtml(classe, count) { return E().classeBtnHtml(classe, count); }
    function emptyTeacherClassesHtml() { return E().emptyTeacherClassesHtml(); }
    function getPlansForClasse(classe) { return E().getPlansForClasse(classe); }
    function mergeCloudPlansIntoLocal(rows) { E().mergeCloudPlansIntoLocal(rows); }
    function handleDashboardTool(tool, extra) { E().openTool(tool, extra); }
    function updateNotifications() {
        if (global.EprofAppHooks && typeof global.EprofAppHooks.updateNotifications === 'function') {
            global.EprofAppHooks.updateNotifications();
        }
    }
    function photoHtml(classe, eleve) { return E().photoHtml(classe, eleve, { compact: true }); }
    function resolvePhotoUrls(eleves, classe) { return E().resolvePhotoUrls(eleves, classe); }
    function studentsForClass(classe) {
        if (E().studentsForClass) return E().studentsForClass(classe) || [];
        const listes = window.getAvailableStudentLists ? window.getAvailableStudentLists() : {};
        return listes[classe] || [];
    }
    function rememberSuiviContext(classe, eleve) {
        if (global.EprofAppHooks && typeof global.EprofAppHooks.setOutilExtra === 'function') {
            var extra = null;
            if (classe || suiviNav.from) {
                extra = {};
                if (classe) {
                    extra.classe = classe;
                    extra.eleve = eleve || undefined;
                }
                if (suiviNav.from) extra.from = suiviNav.from;
                if (suiviNav.conseil) extra.conseil = suiviNav.conseil;
            }
            global.EprofAppHooks.setOutilExtra(extra);
        }
    }

    // ========================================
    // SUIVI DES ÉLÈVES
    // ========================================
    // Synchronisation du suivi des élèves (données propres à chaque enseignant)
    // ========================================
    const SUIVI_DOC_TYPE = 'suivi_eleves';
    const CARNET_DOC_TYPE_SUIVI = 'carnet_notes';
    const DISPOSITIFS_PP = [
        { id: 'PAP', label: 'PAP', hint: 'Plan d’accompagnement personnalisé' },
        { id: 'PAI', label: 'PAI', hint: 'Projet d’accueil individualisé' },
        { id: 'GEVASCO', label: 'GEVASCO', hint: 'Guide d’évaluation des besoins de compensation en matière de scolarisation' },
        { id: 'PPRE', label: 'PPRE', hint: 'Programme personnalisé de réussite éducative' }
    ];
    let syncSuiviTimer = null;
    let carnetCacheSuivi = { evaluations: {}, notes: {} };
    let carnetCachePromise = null;

    function getSuiviStorageKey() {
        if (window.teacherManager && window.teacherManager.getCurrentTeacher()) {
            return window.teacherManager.getStorageKey('suiviEleves');
        }
        return 'suiviEleves';
    }

    function lireSuiviLocal() {
        try {
            const specifique = JSON.parse(localStorage.getItem(getSuiviStorageKey()) || 'null');
            if (specifique && typeof specifique === 'object' && Object.keys(specifique).length) {
                return specifique;
            }
        } catch (e) { /* ignore */ }
        try {
            return JSON.parse(localStorage.getItem('suiviEleves') || '{}');
        } catch (e) {
            return {};
        }
    }

    function ecrireSuiviLocal(suiviData) {
        localStorage.setItem(getSuiviStorageKey(), JSON.stringify(suiviData));
        localStorage.setItem('suiviEleves', JSON.stringify(suiviData));
    }

    function suiviHasContent(data) {
        return !!(data && typeof data === 'object' && Object.keys(data).length > 0);
    }

    function findSuiviRecord(data, nomComplet) {
        if (!data || !nomComplet) return null;
        if (data[nomComplet]) return data[nomComplet];
        var cible = String(nomComplet).toLowerCase().replace(/\s+/g, ' ').trim();
        var cle = Object.keys(data).find(function (k) {
            return String(k).toLowerCase().replace(/\s+/g, ' ').trim() === cible;
        });
        return cle ? data[cle] : null;
    }

    function infoPpFromRecord(rec) {
        var info = (rec && rec.infoPp) || {};
        var dispositifs = {};
        DISPOSITIFS_PP.forEach(function (d) {
            dispositifs[d.id] = !!(info.dispositifs && info.dispositifs[d.id]);
        });
        return {
            dispositifs: dispositifs,
            infosPerso: Array.isArray(info.infosPerso) ? info.infosPerso.slice() : []
        };
    }

    function infoPpSummary(nomComplet) {
        var info = infoPpFromRecord(findSuiviRecord(lireSuiviLocal(), nomComplet));
        return {
            dispositifs: DISPOSITIFS_PP.filter(function (d) { return info.dispositifs[d.id]; }).map(function (d) { return d.id; }),
            infosPerso: info.infosPerso
        };
    }

    async function chargerSuiviEnLigne() {
        if (!window.EprofStore || !await window.EprofStore.isOnlineReady()) return null;
        const { data, error } = await window.EprofStore.getTeacherDocument(SUIVI_DOC_TYPE);
        if (error || !data) return null;
        return data.data || null;
    }

    async function sauvegarderSuiviEnLigne(suiviData) {
        if (!window.EprofStore || !await window.EprofStore.isOnlineReady()) return false;
        const { error } = await window.EprofStore.saveTeacherDocument(SUIVI_DOC_TYPE, suiviData);
        if (error) console.error('❌ Suivi des élèves : sauvegarde en ligne échouée', error);
        return !error;
    }

    function planifierSyncSuivi(suiviData) {
        clearTimeout(syncSuiviTimer);
        syncSuiviTimer = setTimeout(function () { sauvegarderSuiviEnLigne(suiviData); }, 1500);
    }

    function lireCarnetLocalPourSuivi() {
        let evaluations = {};
        let notes = {};
        if (window.teacherManager && window.teacherManager.getCurrentTeacher()) {
            try {
                evaluations = JSON.parse(localStorage.getItem(window.teacherManager.getStorageKey('carnetNotesEvaluations')) || '{}');
            } catch (e) { evaluations = {}; }
            try {
                notes = JSON.parse(localStorage.getItem(window.teacherManager.getStorageKey('carnetNotesNotes')) || '{}');
            } catch (e) { notes = {}; }
        }
        if (!Object.keys(evaluations).length) {
            try { evaluations = JSON.parse(localStorage.getItem('carnetNotesEvaluations') || '{}'); } catch (e) { evaluations = {}; }
        }
        if (!Object.keys(notes).length) {
            try { notes = JSON.parse(localStorage.getItem('carnetNotesNotes') || '{}'); } catch (e) { notes = {}; }
        }
        return { evaluations, notes };
    }

    function carnetHasContentSuivi(data) {
        if (!data) return false;
        const evals = data.evaluations || {};
        const nts = data.notes || {};
        return Object.keys(evals).some(function (k) { return (evals[k] || []).length > 0; })
            || Object.keys(nts).some(function (k) { return Object.keys(nts[k] || {}).length > 0; });
    }

    async function chargerCarnetPourSuivi(force) {
        if (carnetCachePromise && !force) return carnetCachePromise;
        carnetCachePromise = (async function () {
            const local = lireCarnetLocalPourSuivi();
            if (carnetHasContentSuivi(local)) carnetCacheSuivi = local;
            if (window.EprofStore && await window.EprofStore.isOnlineReady()) {
                const { data, error } = await window.EprofStore.getTeacherDocument(CARNET_DOC_TYPE_SUIVI);
                if (!error && data && data.data && carnetHasContentSuivi(data.data)) {
                    carnetCacheSuivi = {
                        evaluations: data.data.evaluations || {},
                        notes: data.data.notes || {}
                    };
                    if (window.teacherManager && window.teacherManager.getCurrentTeacher()) {
                        localStorage.setItem(window.teacherManager.getStorageKey('carnetNotesEvaluations'), JSON.stringify(carnetCacheSuivi.evaluations));
                        localStorage.setItem(window.teacherManager.getStorageKey('carnetNotesNotes'), JSON.stringify(carnetCacheSuivi.notes));
                    }
                }
            }
            return carnetCacheSuivi;
        })().finally(function () {
            carnetCachePromise = null;
        });
        return carnetCachePromise;
    }

    function normaliserPeriodeSuivi(period) {
        if (!period) return '';
        const normalized = String(period).toLowerCase().trim();
        const periodMap = {
            trimestre1: 'T1', trimestre2: 'T2', trimestre3: 'T3',
            semestre1: 'S1', semestre2: 'S2',
            t1: 'T1', t2: 'T2', t3: 'T3', s1: 'S1', s2: 'S2'
        };
        return periodMap[normalized] || String(period).toUpperCase();
    }

    function trouverNotesEleve(notesClasse, eleve) {
        if (!notesClasse || !eleve) return null;
        const candidats = [
            eleve.nomComplet,
            eleve.prenom + ' ' + eleve.nom,
            eleve.prenom + ' ' + String(eleve.nom || '').toUpperCase(),
            (eleve.prenom || '') + ' ' + (eleve.nom || '')
        ];
        for (let i = 0; i < candidats.length; i++) {
            if (notesClasse[candidats[i]]) return notesClasse[candidats[i]];
        }
        const cible = String(eleve.nomComplet || '').toLowerCase().replace(/\s+/g, ' ').trim();
        const cle = Object.keys(notesClasse).find(function (k) {
            return String(k).toLowerCase().replace(/\s+/g, ' ').trim() === cible;
        });
        return cle ? notesClasse[cle] : null;
    }


    function formatEnseignantNomPrenom(enseignant) {
        if (!enseignant) return '';
        const nom = String(enseignant.nom || '').trim();
        const prenom = String(enseignant.prenom || '').trim();
        if (!nom && !prenom) return '';
        return [nom ? nom.toUpperCase() : '', prenom].filter(Boolean).join(' ');
    }

    function retirerEmojisTexte(texte) {
        return String(texte || '')
            .replace(/[\uFE0F\u200D]/g, '')
            .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function getEnseignantNomPrenomLocal() {
        try {
            const parametres = JSON.parse(localStorage.getItem('parametres') || '{}');
            return formatEnseignantNomPrenom(parametres.enseignant);
        } catch (e) {
            return '';
        }
    }

    async function remplirChampEmargementProf(input) {
        if (!input) return;
        let nom = getEnseignantNomPrenomLocal();
        if (!nom && window.EprofStore && await window.EprofStore.isOnlineReady()) {
            const teacherId = await window.EprofStore.getTeacherId();
            const { data } = await window.EprofStore.list('profiles', { filters: { id: teacherId } });
            const profile = data && data[0];
            if (profile) nom = formatEnseignantNomPrenom(profile);
        }
        input.value = retirerEmojisTexte(nom);
    }

    // ========================================
    function renderSuiviEleves(container, classeInitiale, eleveInitial) {
        const listesEleves = getListsForTeacher();
        const classes = getVisibleTeacherClasses();

        container.innerHTML = `
            <div id="suivi-eleves-module">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; gap: 10px; flex-wrap: wrap;">
                    <h2>👨‍🎓 Suivi des élèves</h2>
                    ${suiviNav.from === 'conseil-classe' ? '<button type="button" id="retour-conseil-classe" class="btn-primary">← Retour au conseil de classe</button>' : ''}
                </div>
                
                ${classes.length === 0 ? emptyTeacherClassesHtml() : `
                <div class="selection-classe-suivi">
                    <h3>Sélectionnez une classe</h3>
                    <div class="classes-grid">
                        ${classes.map(classe => classeBtnHtml(classe, (listesEleves[classe] || []).length)).join('')}
                    </div>
                </div>
                `}
                
                <!-- Génération de liste d'émargement / fiches -->
                <div id="emargement-container" class="suivi-export-actions" style="display: none; margin-top: 20px;">
                    <button id="generer-emargement-btn" class="btn-primary">
                        📋 Générer une liste d'émargement
                    </button>
                    <button type="button" id="generer-fiche-classe-btn" class="btn-secondary">
                        📄 Générer une fiche de la classe
                    </button>
                </div>
                
                <!-- Liste des élèves -->
                <div id="liste-eleves-suivi" style="display: none;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin: 20px 0; gap: 10px; flex-wrap: wrap;">
                        <h3 id="titre-classe-suivi"></h3>
                        <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                            <input type="search" id="suivi-recherche-eleve" class="suivi-recherche-eleve" placeholder="Filtrer les élèves…" aria-label="Filtrer les élèves">
                            <button type="button" id="ouvrir-tableau-suivi-btn" class="btn-primary">📊 Tableau de suivi</button>
                            <button type="button" id="ouvrir-edt-btn" class="btn-secondary">📅 EDT</button>
                            <span id="suivi-plan-classe-actions" class="suivi-plan-classe-actions" hidden>
                                <button type="button" id="ouvrir-plan-classe-btn" class="btn-secondary">🪑 Plan de classe</button>
                                <select id="suivi-plan-classe-select" class="plan-select suivi-plan-classe-select" hidden aria-label="Autres plans de classe"></select>
                            </span>
                            <button id="retour-selection-suivi" class="btn-secondary">← Retour</button>
                        </div>
                    </div>
                    <div id="grille-eleves-suivi" class="grille-eleves"></div>
                </div>
                
                <!-- Modale élève -->
                <div id="modale-eleve" class="modale-eleve" style="display: none;">
                    <div class="modale-eleve-content modale-eleve-resizable">
                        <span class="close-modale-eleve">&times;</span>
                        <div class="modale-eleve-inner">
                        <div class="modale-eleve-title-row">
                            <div id="photo-eleve-modale" class="modale-eleve-photo"></div>
                            <h3 id="nom-eleve-modale"></h3>
                            <button type="button" id="retour-conseil-depuis-fiche" class="btn-primary" hidden>← Conseil de classe</button>
                            <button type="button" id="generer-fiche-eleve-btn" class="btn-secondary">📄 Fiche</button>
                        </div>
                        
                        <div class="tabs-modale">
                            <button class="tab-btn active" data-tab="synthese">📋 Synthèse</button>
                            <button class="tab-btn" data-tab="oublis">📦 Oublis</button>
                            <button class="tab-btn" data-tab="mots">📝 Mots</button>
                            <button class="tab-btn" data-tab="remarques">🗒️ Notes</button>
                            <button class="tab-btn tab-info-pp" data-tab="info-pp" hidden>ℹ️ Information</button>
                            <button class="tab-btn" data-tab="moyennes">📊 Moyennes</button>
                        </div>

                        <div id="tab-synthese" class="tab-content active">
                            <div id="synthese-eleve"></div>
                        </div>
                        
                        <div id="tab-oublis" class="tab-content" style="display: none;">
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

                        <div id="tab-remarques" class="tab-content" style="display: none;">
                            <h4>Ajouter une note</h4>
                            <p class="note-perso-hint">Ces notes sont personnelles : elles se synchronisent en ligne pour votre compte, pas pour les autres enseignants.</p>
                            <div class="ajout-note-perso">
                                <textarea id="texte-note-perso" rows="3" placeholder="Observation, comportement, suivi particulier…"></textarea>
                                <div class="ajout-note-perso-actions">
                                    <input type="date" id="date-note-perso">
                                    <button type="button" id="ajouter-note-perso-btn" class="btn-primary">+ Ajouter la note</button>
                                </div>
                            </div>
                            <hr style="margin: 20px 0; border: none; border-top: 2px solid #e2e8f0;">
                            <h4>Notes enregistrées</h4>
                            <div id="liste-notes-perso"></div>
                        </div>
                        
                        <div id="tab-info-pp" class="tab-content" style="display: none;">
                            <h4>Dispositifs</h4>
                            <p class="note-perso-hint">Cochez les aménagements connus pour cet élève. Visible dans la synthèse et le conseil de classe.</p>
                            <div class="oubli-checkboxes info-pp-checks">
                                <label class="checkbox-oubli" title="Plan d’accompagnement personnalisé">
                                    <input type="checkbox" id="info-pp-PAP" data-dispositif="PAP">
                                    <span>PAP</span>
                                </label>
                                <label class="checkbox-oubli" title="Projet d’accueil individualisé">
                                    <input type="checkbox" id="info-pp-PAI" data-dispositif="PAI">
                                    <span>PAI</span>
                                </label>
                                <label class="checkbox-oubli" title="Guide d’évaluation des besoins de compensation en matière de scolarisation">
                                    <input type="checkbox" id="info-pp-GEVASCO" data-dispositif="GEVASCO">
                                    <span>GEVASCO</span>
                                </label>
                                <label class="checkbox-oubli" title="Programme personnalisé de réussite éducative">
                                    <input type="checkbox" id="info-pp-PPRE" data-dispositif="PPRE">
                                    <span>PPRE</span>
                                </label>
                            </div>
                            <hr style="margin: 20px 0; border: none; border-top: 2px solid #e2e8f0;">
                            <h4>Information personnelle</h4>
                            <p class="note-perso-hint">Notes du professeur principal, sur le même modèle que l’onglet Notes.</p>
                            <div class="ajout-note-perso">
                                <div class="char-count-wrap">
                                    <textarea id="texte-info-perso" rows="3" placeholder="Information personnelle concernant l’élève…"></textarea>
                                    <span class="char-count" id="count-info-perso">0 caractère</span>
                                </div>
                                <div class="ajout-note-perso-actions">
                                    <input type="date" id="date-info-perso">
                                    <button type="button" id="ajouter-info-perso-btn" class="btn-primary">+ Ajouter</button>
                                </div>
                            </div>
                            <hr style="margin: 20px 0; border: none; border-top: 2px solid #e2e8f0;">
                            <h4>Informations enregistrées</h4>
                            <div id="liste-infos-perso"></div>
                        </div>

                        <div id="tab-moyennes" class="tab-content" style="display: none;">
                            <h4>Moyennes</h4>
                            <p style="color: #64748b; font-style: italic;">Chargement des notes…</p>
                        </div>
                        </div>
                        <div class="modale-eleve-resize" title="Redimensionner" aria-label="Redimensionner la fenêtre"></div>
                    </div>
                </div>
                
                <!-- Modale fiche de suivi -->
                <div id="modale-fiche-suivi" class="modale-eleve" style="display: none;">
                    <div class="modale-eleve-content" style="max-width: 520px;">
                        <span class="close-modale-fiche">&times;</span>
                        <h3 id="titre-modale-fiche">📄 Fiche de suivi</h3>
                        <p class="fiche-suivi-cible" id="fiche-suivi-cible"></p>
                        <p class="fiche-suivi-hint">Choisissez ce que la fiche doit contenir, puis générez un document prêt à imprimer ou à enregistrer en PDF.</p>
                        <div class="fiche-suivi-options">
                            <label class="fiche-opt">
                                <input type="checkbox" id="fiche-inclure-oublis" checked>
                                <span class="fiche-opt-icon">📦</span>
                                <span class="fiche-opt-text">
                                    <strong>Oublis de matériel</strong>
                                    <small>Date, matériel oublié, mot déjà mis ou non</small>
                                </span>
                            </label>
                            <label class="fiche-opt">
                                <input type="checkbox" id="fiche-inclure-mots" checked>
                                <span class="fiche-opt-icon">📝</span>
                                <span class="fiche-opt-text">
                                    <strong>Mots à mettre</strong>
                                    <small>Motifs, dates, statut (à mettre / déjà mis)</small>
                                </span>
                            </label>
                            <label class="fiche-opt">
                                <input type="checkbox" id="fiche-inclure-moyennes" checked>
                                <span class="fiche-opt-icon">📊</span>
                                <span class="fiche-opt-text">
                                    <strong>Moyennes</strong>
                                    <small>Moyenne générale, périodes et matières du carnet</small>
                                </span>
                            </label>
                            <label class="fiche-opt">
                                <input type="checkbox" id="fiche-inclure-notes" checked>
                                <span class="fiche-opt-icon">🗒️</span>
                                <span class="fiche-opt-text">
                                    <strong>Notes personnelles</strong>
                                    <small>Observations de l’enseignant, visibles uniquement par vous</small>
                                </span>
                            </label>
                            <label class="fiche-opt" id="fiche-opt-info-pp" hidden>
                                <input type="checkbox" id="fiche-inclure-info-pp" checked>
                                <span class="fiche-opt-icon">ℹ️</span>
                                <span class="fiche-opt-text">
                                    <strong>Information (PP)</strong>
                                    <small>PAP, PAI, GEVASCO, PPRE et informations personnelles</small>
                                </span>
                            </label>
                        </div>
                        <div style="display: flex; gap: 10px; margin-top: 18px;">
                            <button type="button" id="confirmer-fiche-suivi" class="btn-primary" style="flex: 1;">Générer la fiche</button>
                            <button type="button" class="close-modale-fiche-btn btn-secondary" style="flex: 1;">Annuler</button>
                        </div>
                    </div>
                </div>
                
                <!-- Modale liste d'émargement -->
                <div id="modale-emargement" class="modale-eleve" style="display: none;">
                    <div class="modale-eleve-content" style="max-width: 640px; max-height: 90vh; overflow-y: auto;">
                        <span class="close-modale-emargement">&times;</span>
                        <h3>📋 Générer une liste d'émargement</h3>
                        <p style="color:#64748b;font-size:0.9rem;margin:0 0 12px;">Les champs d'en-tête sont facultatifs : laissez vides ceux dont vous n'avez pas besoin.</p>
                        <div class="emargement-meta-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0;">
                            <label style="display:flex;flex-direction:column;gap:4px;font-size:0.85rem;font-weight:600;">Titre
                                <input type="text" id="emargement-titre" placeholder="Liste d'émargement" style="padding:8px;border:2px solid #e2e8f0;border-radius:6px;font-weight:400;">
                            </label>
                            <label style="display:flex;flex-direction:column;gap:4px;font-size:0.85rem;font-weight:600;">Sous-titre
                                <input type="text" id="emargement-sous-titre" placeholder="ex. Contrôle, sortie…" style="padding:8px;border:2px solid #e2e8f0;border-radius:6px;font-weight:400;">
                            </label>
                            <label style="display:flex;flex-direction:column;gap:4px;font-size:0.85rem;font-weight:600;">Date
                                <input type="date" id="emargement-date" style="padding:8px;border:2px solid #e2e8f0;border-radius:6px;font-weight:400;">
                            </label>
                            <label style="display:flex;flex-direction:column;gap:4px;font-size:0.85rem;font-weight:600;">Salle
                                <input type="text" id="emargement-salle" placeholder="ex. B204" style="padding:8px;border:2px solid #e2e8f0;border-radius:6px;font-weight:400;">
                            </label>
                            <label style="display:flex;flex-direction:column;gap:4px;font-size:0.85rem;font-weight:600;">Enseignant
                                <input type="text" id="emargement-prof" placeholder="NOM Prénom" style="padding:8px;border:2px solid #e2e8f0;border-radius:6px;font-weight:400;">
                            </label>
                            <label style="display:flex;flex-direction:column;gap:4px;font-size:0.85rem;font-weight:600;">Classe (affichée)
                                <input type="text" id="emargement-classe-libelle" placeholder="Laissée vide = nom de la classe" style="padding:8px;border:2px solid #e2e8f0;border-radius:6px;font-weight:400;">
                            </label>
                        </div>
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
        let notePersoEdition = null;
        let infoPersoEdition = null;
        let filtreEleves = '';
        let suiviData = lireSuiviLocal();
        chargerCarnetPourSuivi();
        
        // Éléments DOM
        const selectionDiv = container.querySelector('.selection-classe-suivi');
        const listeDiv = container.querySelector('#liste-eleves-suivi');
        const grilleEleves = container.querySelector('#grille-eleves-suivi');
        const titreClasse = container.querySelector('#titre-classe-suivi');
        const retourBtn = container.querySelector('#retour-selection-suivi');
        const modale = container.querySelector('#modale-eleve');
        const closeModale = container.querySelector('.close-modale-eleve');
        const cardModale = modale && modale.querySelector('.modale-eleve-content');

        function clampEleveModalSize(w, h) {
            var maxW = Math.max(320, window.innerWidth - 32);
            var maxH = Math.max(280, window.innerHeight - 32);
            return {
                w: Math.min(maxW, Math.max(320, w)),
                h: Math.min(maxH, Math.max(280, h))
            };
        }
        function applyEleveModalSize() {
            if (!cardModale) return;
            try {
                var stored = JSON.parse(localStorage.getItem('suiviEleveModalSize') || 'null');
                if (stored && stored.w && stored.h) {
                    var s = clampEleveModalSize(stored.w, stored.h);
                    cardModale.style.width = s.w + 'px';
                    cardModale.style.height = s.h + 'px';
                }
            } catch (e) { /* ignore */ }
        }
        function bindEleveModalResize() {
            if (!modale || !cardModale || modale._suiviResizeBound) return;
            var handle = modale.querySelector('.modale-eleve-resize');
            if (!handle) return;
            modale._suiviResizeBound = true;
            var drag = null;
            handle.addEventListener('mousedown', function (e) {
                if (e.button !== 0) return;
                e.preventDefault();
                e.stopPropagation();
                var rect = cardModale.getBoundingClientRect();
                drag = { x: e.clientX, y: e.clientY, w: rect.width, h: rect.height };
                document.body.classList.add('suivi-modale-resizing');
            });
            handle.addEventListener('dblclick', function (e) {
                e.preventDefault();
                cardModale.style.width = '';
                cardModale.style.height = '';
                try { localStorage.removeItem('suiviEleveModalSize'); } catch (err) { /* ignore */ }
            });
            function onMove(e) {
                if (!drag) return;
                var s = clampEleveModalSize(
                    drag.w + 2 * (e.clientX - drag.x),
                    drag.h + 2 * (e.clientY - drag.y)
                );
                cardModale.style.width = s.w + 'px';
                cardModale.style.height = s.h + 'px';
            }
            function onUp() {
                if (!drag) return;
                drag = null;
                document.body.classList.remove('suivi-modale-resizing');
                var rect = cardModale.getBoundingClientRect();
                try {
                    localStorage.setItem('suiviEleveModalSize', JSON.stringify({
                        w: Math.round(rect.width),
                        h: Math.round(rect.height)
                    }));
                } catch (err) { /* ignore */ }
            }
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        }
        function ouvrirFicheModale() {
            document.body.classList.add('suivi-fiche-open');
            applyEleveModalSize();
            bindEleveModalResize();
            modale.style.display = 'flex';
        }
        function fermerFicheModale() {
            document.body.classList.remove('suivi-fiche-open');
            document.body.classList.remove('suivi-modale-resizing');
            if (modale) modale.style.display = 'none';
        }
        fermerFicheModale();
        
        let classeActuelle = null;
        
        if (window.EprofSuiviTableau) {
            window.EprofSuiviTableau.attach(container, {
                getClasse: function () { return classeActuelle; },
                getEleves: function () { return elevesActuels; }
            });
        }

        const edtBtn = container.querySelector('#ouvrir-edt-btn');
        if (edtBtn) {
            edtBtn.addEventListener('click', function () {
                if (!classeActuelle) return;
                if (window.EprofEdtClasses) window.EprofEdtClasses.ouvrir(classeActuelle);
            });
        }

        function formatPlanDate(iso) {
            try {
                return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
            } catch (e) {
                return '';
            }
        }

        function refreshPlanClasseAccess(classe) {
            const wrap = container.querySelector('#suivi-plan-classe-actions');
            const sel = container.querySelector('#suivi-plan-classe-select');
            if (!wrap || !sel) return;
            const plans = getPlansForClasse(classe);
            if (!plans.length) {
                wrap.hidden = true;
                sel.hidden = true;
                sel.innerHTML = '';
                return;
            }
            wrap.hidden = false;
            if (plans.length > 1) {
                sel.hidden = false;
                sel.innerHTML = plans.map(function (p, i) {
                    const when = formatPlanDate(p.date);
                    const label = (p.name || 'Plan') + (i === 0 ? ' (récent)' : '') + (when ? ' — ' + when : '');
                    return `<option value="${p.localId}">${label}</option>`;
                }).join('');
            } else {
                sel.hidden = true;
                sel.innerHTML = `<option value="${plans[0].localId}" selected></option>`;
            }
        }

        async function syncCloudPlansForClasse(classe) {
            if (!window.EprofStore || !(await window.EprofStore.isOnlineReady())) return;
            try {
                const teacherId = await window.EprofStore.getTeacherId();
                const { data, error } = await window.EprofStore.list('class_plans', {
                    filters: { teacher_id: teacherId },
                    orderBy: 'updated_at',
                    ascending: false
                });
                if (error || !data) return;
                mergeCloudPlansIntoLocal(data);
                if (classeActuelle === classe) refreshPlanClasseAccess(classe);
            } catch (e) { /* hors ligne */ }
        }

        const planClasseBtn = container.querySelector('#ouvrir-plan-classe-btn');
        if (planClasseBtn) {
            planClasseBtn.addEventListener('click', function () {
                if (!classeActuelle) return;
                const plans = getPlansForClasse(classeActuelle);
                if (!plans.length) return;
                const sel = container.querySelector('#suivi-plan-classe-select');
                const chosen = (sel && sel.value && plans.find(function (p) { return p.localId === sel.value; })) || plans[0];
                handleDashboardTool('plan-classe', { planToLoad: chosen.plan, planLocalId: chosen.localId });
            });
        }

        // Event listeners sur les boutons de classe
        function retourConseilClasse() {
            var ctx = suiviNav.conseil || {};
            handleDashboardTool('conseil-classe', {
                classe: ctx.classe || classeActuelle,
                periode: ctx.periode,
                tab: ctx.tab,
                search: ctx.search,
                sort: ctx.sort,
                filter: ctx.filter
            });
        }
        var backConseil = container.querySelector('#retour-conseil-classe');
        if (backConseil) backConseil.addEventListener('click', retourConseilClasse);
        var backConseilFiche = container.querySelector('#retour-conseil-depuis-fiche');
        if (backConseilFiche) {
            if (suiviNav.from === 'conseil-classe') backConseilFiche.hidden = false;
            backConseilFiche.addEventListener('click', retourConseilClasse);
        }
        container.querySelectorAll('.classe-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const classe = this.getAttribute('data-classe');
                chargerClasse(classe);
            });
        });
        
        // Charger une classe
        function trouverEleveParLabel(label) {
            const cible = String(label || '').toLowerCase().replace(/\s+/g, ' ').trim();
            return elevesActuels.find(function (e) {
                const a = String(e.nomComplet || '').toLowerCase().replace(/\s+/g, ' ').trim();
                const b = ((e.prenom || '') + ' ' + (e.nom || '')).toLowerCase().replace(/\s+/g, ' ').trim();
                return a === cible || b === cible;
            }) || null;
        }

        function chargerClasse(classe, eleveAOuvrir) {
            if (window.EprofSuiviTableau) window.EprofSuiviTableau.fermer(container);
            const resolved = (window.EprofEleves && window.EprofEleves.resolveTaughtClass)
                ? (window.EprofEleves.resolveTaughtClass(classe) || classe)
                : classe;
            classeActuelle = resolved;
            rememberSuiviContext(resolved, eleveAOuvrir);

            const listeClasse = studentsForClass(resolved);
            elevesActuels = (listeClasse || []).map(e => ({
                nom: e.nom,
                prenom: e.prenom,
                sexe: e.sexe,
                photo_path: e.photo_path || '',
                nomComplet: `${e.prenom || ''} ${String(e.nom || '').toUpperCase()}`.trim()
            }));
            
            elevesActuels.sort((a, b) => String(a.nom || '').localeCompare(String(b.nom || ''), 'fr'));
            
            afficherEleves(resolved);
            refreshPlanClasseAccess(resolved);
            refreshInfoPpTab();
            syncCloudPlansForClasse(resolved);
            
            const emargementContainer = container.querySelector('#emargement-container');
            if (emargementContainer) {
                emargementContainer.style.display = 'block';
            }

            resolvePhotoUrls(elevesActuels, resolved).then(function (list) {
                elevesActuels = list;
                afficherEleves(resolved);
                if (eleveAOuvrir) {
                    const hit = trouverEleveParLabel(eleveAOuvrir);
                    if (hit) ouvrirModaleEleve(hit.nomComplet);
                }
            });
        }

        const suiviRecherche = container.querySelector('#suivi-recherche-eleve');
        if (suiviRecherche) {
            suiviRecherche.addEventListener('input', function () {
                filtreEleves = this.value.trim();
                if (classeActuelle) afficherEleves(classeActuelle);
            });
        }

        if (classeInitiale) chargerClasse(classeInitiale, eleveInitial);

        function afficherEleves(classe) {
            if (!selectionDiv || !listeDiv || !grilleEleves || !titreClasse) return;
            selectionDiv.style.display = 'none';
            listeDiv.style.display = 'block';
            const q = (window.EprofEleves && window.EprofEleves.fold)
                ? window.EprofEleves.fold(filtreEleves)
                : String(filtreEleves || '').toUpperCase();
            const visibles = !q ? elevesActuels : elevesActuels.filter(function (eleve) {
                return window.EprofEleves.fold(eleve.nomComplet + ' ' + (eleve.nom || '') + ' ' + (eleve.prenom || '')).indexOf(q) !== -1;
            });
            titreClasse.textContent = `Classe : ${classe} (${visibles.length}${q ? ' / ' + elevesActuels.length : ''} élèves)`;
            if (!visibles.length) {
                grilleEleves.innerHTML = q
                    ? '<p class="trombi-empty">Aucun élève ne correspond au filtre.</p>'
                    : '<p class="trombi-empty">Aucun élève dans cette classe pour l’instant.</p>';
                return;
            }
            
            grilleEleves.innerHTML = visibles.map(eleve => {
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
                const seuils = getAlertesSeuils();
                const totalMotsNonMis = nbMotsNonMis + (oublisNonTraites.length >= seuils.seuilOublis ? 1 : 0);
                
                // Badge oublis : alerte si le seuil d’oublis non traités est atteint
                let badgeOublis = '';
                if (oublisNonTraites.length >= seuils.seuilOublis) {
                    badgeOublis = `<div class="badge-mots">📋 Mot à mettre</div>`;
                } else if (nbOublis > 0) {
                    const alerteOublis = nbOublis >= seuils.seuilOublis ? ' badge-oublis-alerte' : '';
                    badgeOublis = `<div class="badge-oublis${alerteOublis}">📦 ${nbOublis}</div>`;
                }
                
                // Badge mots : alerte si le seuil de mots non mis est atteint
                let badgeMots = '';
                if (totalMots > 0) {
                    const badgeClass = totalMotsNonMis === 0
                        ? 'badge-mots-mis'
                        : (totalMotsNonMis >= seuils.seuilMots ? 'badge-mots-alerte' : 'badge-mots');
                    badgeMots = `<div class="${badgeClass}" style="top: 40px;">📝 ${totalMots}</div>`;
                }

                let badgeNotes = '';
                const nbNotesPerso = (suiviData[eleve.nomComplet]?.notesPerso || []).length;
                if (nbNotesPerso > 0) {
                    badgeNotes = `<div class="badge-notes-perso">🗒️ ${nbNotesPerso}</div>`;
                }

                let badgeInfo = '';
                if (isPpClasseActuelle()) {
                    const info = infoPpFromRecord(suiviData[eleve.nomComplet]);
                    const labels = DISPOSITIFS_PP.filter(function (d) { return info.dispositifs[d.id]; }).map(function (d) { return d.id; });
                    if (labels.length) {
                        badgeInfo = '<div class="badge-info-pp">' + labels.map(function (id) {
                            return '<span>' + id + '</span>';
                        }).join('') + '</div>';
                    }
                }
                
                return `
                    <div class="carte-eleve ${sexeClass}" data-nom="${eleve.nomComplet}">
                        ${photoHtml(classe, eleve)}
                        <div class="nom-eleve">${eleve.nomComplet}</div>
                        <div class="sexe-badge">${eleve.sexe}</div>
                        ${badgeOublis}
                        ${badgeMots}
                        ${badgeNotes}
                        ${badgeInfo}
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
            
            ensureEleveData(nomComplet);
            
            const nomEleveModale = container.querySelector('#nom-eleve-modale');
            nomEleveModale.textContent = nomComplet;
            const photoModale = container.querySelector('#photo-eleve-modale');
            if (photoModale) {
                const eleveFiche = elevesActuels.find(function (e) { return e.nomComplet === nomComplet; });
                photoModale.innerHTML = eleveFiche ? photoHtml(classeActuelle, eleveFiche) : '';
            }
            
            // Initialiser la date du jour automatiquement
            const dateInput = container.querySelector('#date-oubli');
            const aujourd_hui = new Date().toISOString().split('T')[0];
            dateInput.value = aujourd_hui;
            
            // Initialiser la date du jour automatiquement pour les mots aussi
            const dateInputMot = container.querySelector('#date-mot');
            dateInputMot.value = aujourd_hui;

            const dateInputNote = container.querySelector('#date-note-perso');
            if (dateInputNote) dateInputNote.value = aujourd_hui;
            notePersoEdition = null;
            infoPersoEdition = null;
            refreshInfoPpTab();
            syncInfoPpForm();
            
            afficherOublis();
            afficherMots();
            afficherNotesPerso();
            afficherMoyennes();
            afficherSynthese();
            container.querySelectorAll('.tab-btn').forEach(function (b) {
                b.classList.toggle('active', b.getAttribute('data-tab') === 'synthese');
            });
            container.querySelectorAll('.tab-content').forEach(function (c) {
                c.style.display = c.id === 'tab-synthese' ? 'block' : 'none';
            });
            ouvrirFicheModale();
        }

        function afficherSynthese() {
            const box = container.querySelector('#synthese-eleve');
            if (!box || !eleveSelectionne) return;
            const eleve = elevesActuels.find(function (e) { return e.nomComplet === eleveSelectionne; })
                || { nomComplet: eleveSelectionne };
            const data = suiviData[eleveSelectionne] || {};
            const oublis = data.oublis || [];
            const mots = data.motsAMettre || [];
            const notes = Array.isArray(data.notesPerso) ? data.notesPerso.slice() : [];
            const info = infoPpFromRecord(data);
            const dispositifsOn = DISPOSITIFS_PP.filter(function (d) { return info.dispositifs[d.id]; });
            const infosPerso = info.infosPerso.slice();
            const oublisOuverts = oublis.filter(function (o) { return !o.motMis; });
            const motsOuverts = mots.filter(function (m) { return !m.mis; });
            notes.sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')); });
            const resume = resumeMoyennesFiche(eleve);
            const moyTxt = resume && resume.generale != null
                ? resume.generale.toFixed(1).replace('.', ',') + ' / 20'
                : '—';
            const moyClass = resume && resume.generale != null
                ? (resume.generale >= 10 ? 'ok' : 'warn')
                : '';

            function byDateDesc(a, b) {
                return String(b.date || '').localeCompare(String(a.date || ''));
            }
            function recentList(items, empty, render) {
                const sorted = items.slice().sort(byDateDesc);
                if (!sorted.length) return '<p class="vide">' + empty + '</p>';
                return '<ul class="synthese-list">' + sorted.slice(0, 3).map(render).join('') +
                    (sorted.length > 3 ? '<li class="synthese-more">+' + (sorted.length - 3) + ' autre(s)</li>' : '') +
                    '</ul>';
            }

            box.innerHTML =
                '<div class="synthese-chips">' +
                    '<div class="synthese-chip"><span>Oublis à traiter</span><strong>' + oublisOuverts.length + '</strong></div>' +
                    '<div class="synthese-chip"><span>Mots à mettre</span><strong>' + motsOuverts.length + '</strong></div>' +
                    '<div class="synthese-chip"><span>Notes perso</span><strong>' + notes.length + '</strong></div>' +
                    (isPpClasseActuelle()
                        ? '<div class="synthese-chip"><span>Dispositifs</span><strong>' + (dispositifsOn.length ? dispositifsOn.map(function (d) { return d.id; }).join(' · ') : '—') + '</strong></div>'
                        : '') +
                    '<div class="synthese-chip ' + moyClass + '"><span>Moyenne</span><strong>' + moyTxt + '</strong></div>' +
                '</div>' +
                (isPpClasseActuelle()
                    ? '<section class="synthese-info-pp"><h4>Information PP</h4>' +
                      (dispositifsOn.length
                          ? '<div class="synthese-chips">' + dispositifsOn.map(function (d) {
                              return '<span class="synthese-pill" title="' + escapeFicheHtml(d.hint) + '">' + d.id + '</span>';
                          }).join('') + '</div>'
                          : '<p class="vide">Aucun dispositif coché.</p>') +
                      recentList(infosPerso, 'Aucune information personnelle.', function (n) {
                          return '<li>' + escapeFicheHtml(formatDateFiche(n.date)) + ' · ' + escapeFicheHtml((n.texte || '').slice(0, 100)) + '</li>';
                      }) +
                      '</section>'
                    : '') +
                '<div class="synthese-cols">' +
                    '<section><h4>Derniers oublis</h4>' +
                    recentList(oublisOuverts.concat(oublis.filter(function (o) { return o.motMis; })), 'Aucun oubli.', function (o) {
                        return '<li>' + escapeFicheHtml(formatDateFiche(o.date)) + ' · ' + escapeFicheHtml(o.materiel || '') +
                            (o.motMis ? ' <em>traité</em>' : '') + '</li>';
                    }) + '</section>' +
                    '<section><h4>Derniers mots</h4>' +
                    recentList(motsOuverts.concat(mots.filter(function (m) { return m.mis; })), 'Aucun mot.', function (m) {
                        return '<li>' + escapeFicheHtml(formatDateFiche(m.date)) + ' · ' + escapeFicheHtml((m.motif || '').slice(0, 80)) +
                            (m.mis ? ' <em>mis</em>' : '') + '</li>';
                    }) + '</section>' +
                    '<section><h4>Dernières notes</h4>' +
                    recentList(notes, 'Aucune note personnelle.', function (n) {
                        return '<li>' + escapeFicheHtml(formatDateFiche(n.date)) + ' · ' + escapeFicheHtml((n.texte || '').slice(0, 80)) + '</li>';
                    }) + '</section>' +
                '</div>' +
                '<div class="synthese-actions">' +
                    '<button type="button" id="synthese-fiche-courte-btn" class="btn-primary">📄 Fiche courte (1 page)</button>' +
                    '<button type="button" id="synthese-fiche-complete-btn" class="btn-secondary">📄 Fiche complète</button>' +
                '</div>';

            const courte = box.querySelector('#synthese-fiche-courte-btn');
            if (courte) courte.addEventListener('click', function () {
                imprimerFichesSuivi([eleve], { oublis: true, mots: true, notes: true, moyennes: true, info: isPpClasseActuelle(), courte: true });
            });
            const complete = box.querySelector('#synthese-fiche-complete-btn');
            if (complete) complete.addEventListener('click', function () {
                ouvrirModaleFiche('eleve');
            });
        }
        
        function rendreMoyennes(periodeSelectionnee, matiereSelectionnee) {
            periodeSelectionnee = periodeSelectionnee || null;
            matiereSelectionnee = matiereSelectionnee || null;
            const tabNotes = container.querySelector('#tab-moyennes');
            const carnetEvaluations = carnetCacheSuivi.evaluations || {};
            const carnetNotes = carnetCacheSuivi.notes || {};
            const evaluationsClasse = carnetEvaluations[classeActuelle] || [];
            if (!evaluationsClasse.length) {
                tabNotes.innerHTML = `
                    <h4>Moyennes</h4>
                    <p style="color: #64748b; font-style: italic;">Aucune évaluation enregistrée pour cette classe</p>
                `;
                return;
            }

            const eleveActuel = elevesActuels.find(function (e) { return e.nomComplet === eleveSelectionne; }) || { nomComplet: eleveSelectionne };
            const notesEleve = trouverNotesEleve(carnetNotes[classeActuelle] || {}, eleveActuel);
            if (!notesEleve) {
                tabNotes.innerHTML = `
                    <h4>Moyennes</h4>
                    <p style="color: #64748b; font-style: italic;">Aucune note enregistrée pour cet élève</p>
                `;
                return;
            }

            const enSemestres = window.EprofReferentiel
                ? window.EprofReferentiel.getPeriodType(classeActuelle) === 'semestre'
                : (String(classeActuelle).toLowerCase().includes('terminale') || String(classeActuelle).toLowerCase().includes('tle') || String(classeActuelle).toLowerCase().includes('1ère') || String(classeActuelle).toLowerCase().includes('1ere'));
            const periodes = enSemestres ? ['semestre1', 'semestre2'] : ['trimestre1', 'trimestre2', 'trimestre3'];
            const periodesLabels = enSemestres ? ['Semestre 1', 'Semestre 2'] : ['Trimestre 1', 'Trimestre 2', 'Trimestre 3'];
            const isTerminale = enSemestres;
            
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
                const periodeNorm = normaliserPeriodeSuivi(periode);
                const evalsP = evaluationsClasse.filter(function (e) {
                    return normaliserPeriodeSuivi(e.period) === periodeNorm;
                });
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

        function afficherMoyennes(periodeSelectionnee, matiereSelectionnee) {
            chargerCarnetPourSuivi(true).then(function () {
                rendreMoyennes(periodeSelectionnee, matiereSelectionnee);
            });
        }

        function isPpClasseActuelle() {
            return !!(E().isPpClass && E().isPpClass(classeActuelle));
        }

        function refreshInfoPpTab() {
            const on = isPpClasseActuelle();
            const btn = container.querySelector('[data-tab="info-pp"]');
            if (btn) btn.hidden = !on;
            const tab = container.querySelector('#tab-info-pp');
            if (tab && !on) tab.style.display = 'none';
            const ficheOpt = container.querySelector('#fiche-opt-info-pp');
            if (ficheOpt) ficheOpt.hidden = !on;
        }

        function ensureEleveData(nom) {
            if (!suiviData[nom]) {
                suiviData[nom] = { oublis: [], notes: [], motsAMettre: [], notesPerso: [] };
            }
            if (!suiviData[nom].motsAMettre) suiviData[nom].motsAMettre = [];
            if (!Array.isArray(suiviData[nom].notesPerso)) suiviData[nom].notesPerso = [];
            if (!suiviData[nom].infoPp) suiviData[nom].infoPp = { dispositifs: {}, infosPerso: [] };
            if (!suiviData[nom].infoPp.dispositifs) suiviData[nom].infoPp.dispositifs = {};
            if (!Array.isArray(suiviData[nom].infoPp.infosPerso)) suiviData[nom].infoPp.infosPerso = [];
            return suiviData[nom];
        }

        function notesPersoEleve(nom) {
            return ensureEleveData(nom).notesPerso;
        }

        function infosPersoEleve(nom) {
            return ensureEleveData(nom).infoPp.infosPerso;
        }

        function syncInfoPpForm() {
            if (!eleveSelectionne || !isPpClasseActuelle()) return;
            const rec = ensureEleveData(eleveSelectionne);
            DISPOSITIFS_PP.forEach(function (d) {
                const cb = container.querySelector('#info-pp-' + d.id);
                if (cb) cb.checked = !!rec.infoPp.dispositifs[d.id];
            });
            const dateInput = container.querySelector('#date-info-perso');
            if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
            const area = container.querySelector('#texte-info-perso');
            if (area) {
                area.value = '';
                refreshCharCount(area, container.querySelector('#count-info-perso'));
            }
            infoPersoEdition = null;
            afficherInfosPerso();
        }

        function refreshCharCount(area, label) {
            if (!label || !area) return;
            const n = (area.value || '').length;
            label.textContent = n + ' caractère' + (n > 1 ? 's' : '');
        }

        function afficherInfosPerso() {
            const liste = container.querySelector('#liste-infos-perso');
            if (!liste || !eleveSelectionne) return;
            const notes = infosPersoEleve(eleveSelectionne);
            if (!notes.length) {
                liste.innerHTML = '<p style="color:#64748b;font-style:italic;">Aucune information personnelle pour cet élève.</p>';
                return;
            }
            const ordered = notes.map(function (note, index) {
                return { note: note, index: index };
            }).sort(function (a, b) {
                return String(b.note.date || '').localeCompare(String(a.note.date || ''));
            });
            liste.innerHTML = ordered.map(function (item) {
                const note = item.note;
                const idx = item.index;
                if (infoPersoEdition === idx) {
                    return '<div class="item-note-perso is-editing">' +
                        '<div class="char-count-wrap">' +
                        '<textarea class="note-perso-edit info-perso-edit" rows="3">' + escapeFicheHtml(note.texte || '') + '</textarea>' +
                        '<span class="char-count">' + (note.texte || '').length + ' caractère' + ((note.texte || '').length > 1 ? 's' : '') + '</span>' +
                        '</div>' +
                        '<div class="note-perso-actions">' +
                        '<button type="button" class="btn-primary btn-sauver-info" data-index="' + idx + '">Enregistrer</button>' +
                        '<button type="button" class="btn-secondary btn-annuler-info">Annuler</button>' +
                        '</div></div>';
                }
                return '<div class="item-note-perso">' +
                    '<div class="note-perso-body">' +
                    '<div class="note-perso-date">' + escapeFicheHtml(formatDateFiche(note.date)) + '</div>' +
                    '<div class="note-perso-texte">' + escapeFicheHtml(note.texte || '').replace(/\n/g, '<br>') + '</div>' +
                    '</div>' +
                    '<div class="note-perso-actions">' +
                    '<button type="button" class="btn-editer-info" data-index="' + idx + '" title="Modifier">✏️</button>' +
                    '<button type="button" class="btn-supprimer btn-supprimer-info" data-index="' + idx + '" title="Supprimer">🗑️</button>' +
                    '</div></div>';
            }).join('');

            liste.querySelectorAll('.info-perso-edit').forEach(function (area) {
                const label = area.parentElement.querySelector('.char-count');
                area.addEventListener('input', function () { refreshCharCount(area, label); });
            });
            liste.querySelectorAll('.btn-editer-info').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    infoPersoEdition = parseInt(this.getAttribute('data-index'), 10);
                    afficherInfosPerso();
                });
            });
            liste.querySelectorAll('.btn-supprimer-info').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    const index = parseInt(this.getAttribute('data-index'), 10);
                    if (!confirm('Supprimer cette information ?')) return;
                    infosPersoEleve(eleveSelectionne).splice(index, 1);
                    infoPersoEdition = null;
                    sauvegarderSuivi();
                    afficherInfosPerso();
                    afficherSynthese();
                    afficherEleves(classeActuelle);
                });
            });
            liste.querySelectorAll('.btn-sauver-info').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    const index = parseInt(this.getAttribute('data-index'), 10);
                    const area = liste.querySelector('.info-perso-edit');
                    const texte = area ? area.value.trim() : '';
                    if (!texte) {
                        alert('⚠️ L’information ne peut pas être vide.');
                        return;
                    }
                    infosPersoEleve(eleveSelectionne)[index].texte = texte;
                    infosPersoEleve(eleveSelectionne)[index].updatedAt = new Date().toISOString();
                    infoPersoEdition = null;
                    sauvegarderSuivi();
                    afficherInfosPerso();
                    afficherSynthese();
                });
            });
            liste.querySelectorAll('.btn-annuler-info').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    infoPersoEdition = null;
                    afficherInfosPerso();
                });
            });
        }

        function afficherNotesPerso() {
            const liste = container.querySelector('#liste-notes-perso');
            if (!liste || !eleveSelectionne) return;
            const notes = notesPersoEleve(eleveSelectionne);
            if (!notes.length) {
                liste.innerHTML = '<p style="color:#64748b;font-style:italic;">Aucune note pour cet élève.</p>';
                return;
            }
            const ordered = notes.map(function (note, index) {
                return { note: note, index: index };
            }).sort(function (a, b) {
                return String(b.note.date || '').localeCompare(String(a.note.date || ''));
            });
            liste.innerHTML = ordered.map(function (item) {
                const note = item.note;
                const idx = item.index;
                if (notePersoEdition === idx) {
                    return '<div class="item-note-perso is-editing">' +
                        '<textarea class="note-perso-edit" rows="3">' + escapeFicheHtml(note.texte || '') + '</textarea>' +
                        '<div class="note-perso-actions">' +
                        '<button type="button" class="btn-primary btn-sauver-note" data-index="' + idx + '">Enregistrer</button>' +
                        '<button type="button" class="btn-secondary btn-annuler-note">Annuler</button>' +
                        '</div></div>';
                }
                return '<div class="item-note-perso">' +
                    '<div class="note-perso-body">' +
                    '<div class="note-perso-date">' + escapeFicheHtml(formatDateFiche(note.date)) + '</div>' +
                    '<div class="note-perso-texte">' + escapeFicheHtml(note.texte || '').replace(/\n/g, '<br>') + '</div>' +
                    '</div>' +
                    '<div class="note-perso-actions">' +
                    '<button type="button" class="btn-editer-note" data-index="' + idx + '" title="Modifier">✏️</button>' +
                    '<button type="button" class="btn-supprimer btn-supprimer-note" data-index="' + idx + '" title="Supprimer">🗑️</button>' +
                    '</div></div>';
            }).join('');

            liste.querySelectorAll('.btn-editer-note').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    notePersoEdition = parseInt(this.getAttribute('data-index'), 10);
                    afficherNotesPerso();
                });
            });
            liste.querySelectorAll('.btn-supprimer-note').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    const index = parseInt(this.getAttribute('data-index'), 10);
                    if (!confirm('Supprimer cette note ?')) return;
                    notesPersoEleve(eleveSelectionne).splice(index, 1);
                    notePersoEdition = null;
                    sauvegarderSuivi();
                    afficherNotesPerso();
                    afficherEleves(classeActuelle);
                });
            });
            liste.querySelectorAll('.btn-sauver-note').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    const index = parseInt(this.getAttribute('data-index'), 10);
                    const area = liste.querySelector('.note-perso-edit');
                    const texte = area ? area.value.trim() : '';
                    if (!texte) {
                        alert('⚠️ La note ne peut pas être vide.');
                        return;
                    }
                    notesPersoEleve(eleveSelectionne)[index].texte = texte;
                    notesPersoEleve(eleveSelectionne)[index].updatedAt = new Date().toISOString();
                    notePersoEdition = null;
                    sauvegarderSuivi();
                    afficherNotesPerso();
                });
            });
            liste.querySelectorAll('.btn-annuler-note').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    notePersoEdition = null;
                    afficherNotesPerso();
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
                
                const seuils = getAlertesSeuils();
                let alerteHtml = '';
                if (oublisNonTraites.length >= seuils.seuilOublis) {
                    alerteHtml = `
                        <div class="alerte-oublis">
                            <strong>⚠️ ATTENTION !</strong>
                            <p>${oublisNonTraites.length} oubli(s) non traités (seuil : ${seuils.seuilOublis}) — Mettre un mot dans le carnet de correspondance</p>
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

        const ajouterNotePersoBtn = container.querySelector('#ajouter-note-perso-btn');
        if (ajouterNotePersoBtn) {
            ajouterNotePersoBtn.addEventListener('click', function () {
                if (!eleveSelectionne) return;
                const texteInput = container.querySelector('#texte-note-perso');
                const dateInput = container.querySelector('#date-note-perso');
                const texte = texteInput ? texteInput.value.trim() : '';
                const date = dateInput ? dateInput.value : '';
                if (!texte) {
                    alert('⚠️ Saisissez une note.');
                    return;
                }
                if (!date) {
                    alert('⚠️ Sélectionnez une date.');
                    return;
                }
                notesPersoEleve(eleveSelectionne).unshift({
                    id: Date.now().toString(36),
                    texte: texte,
                    date: date,
                    createdAt: new Date().toISOString()
                });
                sauvegarderSuivi();
                texteInput.value = '';
                dateInput.value = new Date().toISOString().split('T')[0];
                notePersoEdition = null;
                afficherNotesPerso();
                afficherEleves(classeActuelle);
            });
        }

        container.querySelectorAll('#tab-info-pp [data-dispositif]').forEach(function (cb) {
            cb.addEventListener('change', function () {
                if (!eleveSelectionne) return;
                const id = cb.getAttribute('data-dispositif');
                ensureEleveData(eleveSelectionne).infoPp.dispositifs[id] = cb.checked;
                sauvegarderSuivi();
                afficherEleves(classeActuelle);
                afficherSynthese();
            });
        });

        const texteInfoPerso = container.querySelector('#texte-info-perso');
        if (texteInfoPerso) {
            texteInfoPerso.addEventListener('input', function () {
                refreshCharCount(texteInfoPerso, container.querySelector('#count-info-perso'));
            });
            refreshCharCount(texteInfoPerso, container.querySelector('#count-info-perso'));
        }

        const ajouterInfoPersoBtn = container.querySelector('#ajouter-info-perso-btn');
        if (ajouterInfoPersoBtn) {
            ajouterInfoPersoBtn.addEventListener('click', function () {
                if (!eleveSelectionne) return;
                const texteInput = container.querySelector('#texte-info-perso');
                const dateInput = container.querySelector('#date-info-perso');
                const texte = texteInput ? texteInput.value.trim() : '';
                const date = dateInput ? dateInput.value : '';
                if (!texte) {
                    alert('⚠️ Saisissez une information.');
                    return;
                }
                if (!date) {
                    alert('⚠️ Sélectionnez une date.');
                    return;
                }
                infosPersoEleve(eleveSelectionne).unshift({
                    id: Date.now().toString(36),
                    texte: texte,
                    date: date,
                    createdAt: new Date().toISOString()
                });
                sauvegarderSuivi();
                texteInput.value = '';
                dateInput.value = new Date().toISOString().split('T')[0];
                refreshCharCount(texteInput, container.querySelector('#count-info-perso'));
                infoPersoEdition = null;
                afficherInfosPerso();
                afficherSynthese();
                afficherEleves(classeActuelle);
            });
        }
        
        function sauvegarderSuivi() {
            ecrireSuiviLocal(suiviData);
            updateNotifications();
            planifierSyncSuivi(suiviData);
            if (window.dataManager) {
                window.dataManager.triggerAutoSave();
            }
        }
        
        // Fermer la modale
        closeModale.addEventListener('click', fermerFicheModale);
        modale.addEventListener('click', function(e) {
            if (e.target === modale) fermerFicheModale();
        });
        
        // Retour à la sélection
        retourBtn.addEventListener('click', function() {
            if (window.EprofSuiviTableau) window.EprofSuiviTableau.fermer(container);
            classeActuelle = null;
            rememberSuiviContext(null);
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
                if (tab === 'moyennes') {
                    afficherMoyennes();
                }
                if (tab === 'synthese') {
                    afficherSynthese();
                }
                if (tab === 'remarques') {
                    afficherNotesPerso();
                }
                if (tab === 'info-pp') {
                    syncInfoPpForm();
                }
            });
        });
        
        chargerSuiviEnLigne().then(function (distant) {
            if (suiviHasContent(distant)) {
                suiviData = distant;
                ecrireSuiviLocal(suiviData);
                updateNotifications();
                if (classeActuelle) afficherEleves(classeActuelle);
                return;
            }
            if (suiviHasContent(suiviData)) {
                planifierSyncSuivi(suiviData);
            }
        });

        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState !== 'visible') return;
            chargerSuiviEnLigne().then(function (distant) {
                if (!suiviHasContent(distant)) return;
                suiviData = distant;
                ecrireSuiviLocal(suiviData);
                updateNotifications();
                if (classeActuelle) afficherEleves(classeActuelle);
            });
            chargerCarnetPourSuivi(true);
        });
        
        function escapeFicheHtml(value) {
            return String(value == null ? '' : value)
                .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        }

        function formatDateFiche(value) {
            if (!value) return '';
            const d = new Date(value);
            return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('fr-FR');
        }

        function resumeMoyennesFiche(eleve) {
            const evaluationsClasse = (carnetCacheSuivi.evaluations || {})[classeActuelle] || [];
            const notesEleve = trouverNotesEleve((carnetCacheSuivi.notes || {})[classeActuelle] || {}, eleve);
            if (!evaluationsClasse.length || !notesEleve) return null;
            const enSemestres = window.EprofReferentiel
                ? window.EprofReferentiel.getPeriodType(classeActuelle) === 'semestre'
                : /terminale|tle|1ère|1ere/i.test(String(classeActuelle));
            const periodes = enSemestres ? ['semestre1', 'semestre2'] : ['trimestre1', 'trimestre2', 'trimestre3'];
            const labels = enSemestres ? ['Semestre 1', 'Semestre 2'] : ['Trimestre 1', 'Trimestre 2', 'Trimestre 3'];
            const parPeriode = periodes.map(function (periode, index) {
                const evalsP = evaluationsClasse.filter(function (ev) {
                    return normaliserPeriodeSuivi(ev.period) === normaliserPeriodeSuivi(periode)
                        && ev.nonSignificative !== true;
                });
                const bySubject = {};
                evalsP.forEach(function (ev) {
                    (bySubject[ev.subject] = bySubject[ev.subject] || []).push(ev);
                });
                const matieres = [];
                let somme = 0;
                let n = 0;
                Object.keys(bySubject).forEach(function (matiere) {
                    let s = 0;
                    let c = 0;
                    const details = [];
                    bySubject[matiere].forEach(function (ev) {
                        const note = notesEleve[ev.id];
                        if (note === undefined || note === 'abs' || note === null || note === '') return;
                        const n20 = (parseFloat(note) / ev.maxPoints) * 20;
                        s += n20 * ev.coefficient;
                        c += ev.coefficient;
                        details.push({
                            titre: ev.title,
                            date: ev.date,
                            note: note,
                            max: ev.maxPoints,
                            coef: ev.coefficient,
                            note20: n20
                        });
                    });
                    if (c > 0) {
                        const moy = s / c;
                        matieres.push({ nom: matiere, moyenne: moy, details: details });
                        somme += moy;
                        n += 1;
                    }
                });
                return { label: labels[index], moyenne: n > 0 ? somme / n : null, matieres: matieres };
            });
            const valides = parPeriode.filter(function (p) { return p.moyenne !== null; });
            return {
                generale: valides.length
                    ? valides.reduce(function (acc, p) { return acc + p.moyenne; }, 0) / valides.length
                    : null,
                periodes: parPeriode
            };
        }

        function htmlFicheEleve(eleve, options) {
            options = options || {};
            const data = suiviData[eleve.nomComplet] || {};
            const oublis = data.oublis || [];
            const mots = data.motsAMettre || [];
            const recent = function (items, n) {
                return items.slice().sort(function (a, b) {
                    return String(b.date || '').localeCompare(String(a.date || ''));
                }).slice(0, n);
            };
            let html = '<article class="fiche' + (options.courte ? ' fiche-courte' : '') + '">' +
                '<header class="fiche-head">' +
                '<p class="fiche-kicker">eProf · ' + (options.courte ? 'Fiche courte' : 'Suivi des élèves') + '</p>' +
                '<h2>' + escapeFicheHtml(eleve.nomComplet) + '</h2>' +
                '<p class="fiche-meta">' + escapeFicheHtml(classeActuelle || '') +
                (eleve.sexe ? ' · ' + escapeFicheHtml(eleve.sexe) : '') +
                '</p></header>';

            if (options.oublis) {
                html += '<section class="bloc"><div class="bloc-head"><span>📦 Oublis de matériel</span><em>' +
                    oublis.length + '</em></div>';
                if (!oublis.length) {
                    html += '<p class="vide">Aucun oubli enregistré.</p>';
                } else {
                    html += '<table><thead><tr><th>Date</th><th>Matériel</th><th>Statut</th></tr></thead><tbody>' +
                        (options.courte ? recent(oublis, 5) : oublis).map(function (o) {
                            const ok = !!o.motMis;
                            return '<tr><td>' + escapeFicheHtml(formatDateFiche(o.date)) + '</td><td>' +
                                escapeFicheHtml(o.materiel || '') + '</td><td><span class="pill ' +
                                (ok ? 'ok' : 'warn') + '">' + (ok ? 'Mot mis' : 'À traiter') +
                                '</span></td></tr>';
                        }).join('') + '</tbody></table>';
                }
                html += '</section>';
            }

            if (options.mots) {
                html += '<section class="bloc"><div class="bloc-head"><span>📝 Mots</span><em>' +
                    mots.length + '</em></div>';
                if (!mots.length) {
                    html += '<p class="vide">Aucun mot enregistré.</p>';
                } else {
                    html += '<table><thead><tr><th>Date</th><th>Motif</th><th>Statut</th></tr></thead><tbody>' +
                        (options.courte ? recent(mots, 5) : mots).map(function (m) {
                            const ok = !!m.mis;
                            return '<tr><td>' + escapeFicheHtml(formatDateFiche(m.date)) + '</td><td>' +
                                escapeFicheHtml(m.motif || '') + '</td><td><span class="pill ' +
                                (ok ? 'ok' : 'warn') + '">' +
                                (ok ? 'Mis' + (m.dateMis ? ' le ' + formatDateFiche(m.dateMis) : '') : 'À mettre') +
                                '</span></td></tr>';
                        }).join('') + '</tbody></table>';
                }
                html += '</section>';
            }

            if (options.notes) {
                const notesPerso = data.notesPerso || [];
                html += '<section class="bloc"><div class="bloc-head"><span>🗒️ Notes personnelles</span><em>' +
                    notesPerso.length + '</em></div>';
                if (!notesPerso.length) {
                    html += '<p class="vide">Aucune note personnelle.</p>';
                } else {
                    html += '<table><thead><tr><th>Date</th><th>Note</th></tr></thead><tbody>' +
                        notesPerso.slice().sort(function (a, b) {
                            return String(b.date || '').localeCompare(String(a.date || ''));
                        }).slice(0, options.courte ? 5 : notesPerso.length).map(function (n) {
                            return '<tr><td>' + escapeFicheHtml(formatDateFiche(n.date)) +
                                '</td><td>' + escapeFicheHtml(n.texte || '').replace(/\n/g, '<br>') +
                                '</td></tr>';
                        }).join('') + '</tbody></table>';
                }
                html += '</section>';
            }

            if (options.info) {
                const info = infoPpFromRecord(data);
                const labels = DISPOSITIFS_PP.filter(function (d) { return info.dispositifs[d.id]; });
                const infosPerso = info.infosPerso || [];
                html += '<section class="bloc"><div class="bloc-head"><span>ℹ️ Information</span></div>';
                html += '<p style="margin:0 0 8px;"><strong>Dispositifs :</strong> ' +
                    (labels.length ? labels.map(function (d) { return d.id; }).join(' · ') : 'aucun') + '</p>';
                if (!infosPerso.length) {
                    html += '<p class="vide">Aucune information personnelle.</p>';
                } else {
                    html += '<table><thead><tr><th>Date</th><th>Information</th></tr></thead><tbody>' +
                        infosPerso.slice().sort(function (a, b) {
                            return String(b.date || '').localeCompare(String(a.date || ''));
                        }).slice(0, options.courte ? 5 : infosPerso.length).map(function (n) {
                            return '<tr><td>' + escapeFicheHtml(formatDateFiche(n.date)) +
                                '</td><td>' + escapeFicheHtml(n.texte || '').replace(/\n/g, '<br>') +
                                '</td></tr>';
                        }).join('') + '</tbody></table>';
                }
                html += '</section>';
            }

            if (options.moyennes) {
                const resume = resumeMoyennesFiche(eleve);
                html += '<section class="bloc"><div class="bloc-head"><span>📊 Moyennes</span></div>';
                if (!resume) {
                    html += '<p class="vide">Aucune note enregistrée pour cet élève.</p>';
                } else {
                    const gen = resume.generale;
                    const genClass = gen === null ? '' : (gen >= 10 ? 'ok' : 'warn');
                    html += '<div class="moy-hero ' + genClass + '">' +
                        '<span>Moyenne générale</span>' +
                        '<strong>' + (gen !== null ? gen.toFixed(2) : '—') + '</strong>' +
                        '<small>/ 20</small></div>';
                    html += '<div class="periodes">';
                    resume.periodes.forEach(function (p) {
                        html += '<div class="periode"><h4>' + escapeFicheHtml(p.label) +
                            '<b>' + (p.moyenne !== null ? p.moyenne.toFixed(2) + ' / 20' : 'sans note') +
                            '</b></h4>';
                        if (options.courte) {
                            html += '';
                        } else if (p.matieres.length) {
                            html += '<ul>' + p.matieres.map(function (mat) {
                                const cls = mat.moyenne >= 10 ? 'ok' : 'warn';
                                return '<li><span>' + escapeFicheHtml(mat.nom) +
                                    '</span><span class="' + cls + '">' + mat.moyenne.toFixed(2) +
                                    '</span></li>';
                            }).join('') + '</ul>';
                        } else {
                            html += '<p class="vide">Pas de note sur cette période.</p>';
                        }
                        html += '</div>';
                    });
                    html += '</div>';
                }
                html += '</section>';
            }

            html += '</article>';
            return html;
        }

        function imprimerFichesSuivi(eleves, options) {
            const pourClasse = eleves.length > 1;
            const titre = pourClasse
                ? 'Fiches de suivi — ' + (classeActuelle || '')
                : ((options && options.courte ? 'Fiche courte — ' : 'Fiche de suivi — ') + (eleves[0] && eleves[0].nomComplet || ''));
            const corps = eleves.map(function (eleve) {
                return htmlFicheEleve(eleve, options);
            }).join('');
            const w = window.open('', '_blank');
            if (!w) {
                alert('Autorisez les fenêtres contextuelles pour générer la fiche.');
                return;
            }
            w.document.write('<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>' +
                escapeFicheHtml(titre) + '</title><style>' +
                'body{font-family:Segoe UI,Arial,sans-serif;margin:0;background:#f1f5f9;color:#0f172a;}' +
                '.page{max-width:900px;margin:0 auto;padding:24px;}' +
                '.doc-top{background:#1a2236;color:#fff;padding:18px 24px;border-radius:12px;margin-bottom:18px;}' +
                '.doc-top h1{margin:0;font-size:1.35rem;} .doc-top p{margin:6px 0 0;opacity:.8;font-size:.9rem;}' +
                '.fiche{background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;margin-bottom:22px;page-break-after:always;box-shadow:0 2px 8px #0001;}' +
                '.fiche:last-child{page-break-after:auto;}' +
                '.fiche-head{background:linear-gradient(135deg,#1e3a8a,#2563eb);color:#fff;padding:18px 20px;}' +
                '.fiche-kicker{margin:0;font-size:.75rem;letter-spacing:.04em;text-transform:uppercase;opacity:.85;}' +
                '.fiche-head h2{margin:4px 0 2px;font-size:1.45rem;}' +
                '.fiche-meta{margin:0;opacity:.9;}' +
                '.bloc{padding:16px 20px;border-top:1px solid #e2e8f0;}' +
                '.bloc-head{display:flex;justify-content:space-between;align-items:center;font-weight:800;margin-bottom:10px;color:#1e3a8a;}' +
                '.bloc-head em{background:#e2e8f0;color:#334155;font-style:normal;border-radius:999px;padding:2px 8px;font-size:.8rem;}' +
                'table{width:100%;border-collapse:collapse;font-size:.92rem;}' +
                'th{text-align:left;background:#f8fafc;padding:8px;border-bottom:2px solid #e2e8f0;}' +
                'td{padding:8px;border-bottom:1px solid #e2e8f0;vertical-align:top;}' +
                '.pill{display:inline-block;border-radius:999px;padding:2px 8px;font-size:.78rem;font-weight:700;}' +
                '.pill.ok,.ok{color:#166534;} .pill.ok{background:#dcfce7;} .pill.warn,.warn{color:#9a3412;} .pill.warn{background:#ffedd5;}' +
                '.vide{color:#64748b;font-style:italic;margin:0;}' +
                '.moy-hero{display:flex;align-items:baseline;gap:8px;background:#f8fafc;border-radius:10px;padding:12px 14px;margin-bottom:12px;}' +
                '.moy-hero span{color:#64748b;font-weight:600;} .moy-hero strong{font-size:1.8rem;} .moy-hero small{color:#64748b;}' +
                '.moy-hero.ok strong{color:#166534;} .moy-hero.warn strong{color:#9a3412;}' +
                '.periodes{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;}' +
                '.periode{border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;background:#fafbfc;}' +
                '.periode h4{margin:0 0 8px;display:flex;justify-content:space-between;gap:8px;font-size:.95rem;}' +
                '.periode ul{list-style:none;margin:0;padding:0;} .periode li{display:flex;justify-content:space-between;padding:4px 0;border-top:1px dashed #e2e8f0;}' +
                '.periode li span:last-child{font-weight:700;}' +
                '.fiche-courte{font-size:.88rem;} .fiche-courte .bloc{padding:10px 16px;} .fiche-courte .moy-hero strong{font-size:1.35rem;}' +
                '@media print{body{background:#fff;} .page{padding:0;max-width:none;} .doc-top{border-radius:0;display:none;} .fiche{box-shadow:none;} .fiche-courte{page-break-after:auto;page-break-inside:avoid;}}' +
                '</style></head><body><div class="page"><div class="doc-top"><h1>' + escapeFicheHtml(titre) +
                '</h1><p>' + escapeFicheHtml(classeActuelle || '') + ' · ' +
                escapeFicheHtml(new Date().toLocaleDateString('fr-FR')) +
                (pourClasse ? ' · ' + eleves.length + ' élève(s)' : '') +
                '</p></div>' + corps + '</div></body></html>');
            w.document.close();
            w.focus();
            setTimeout(function () { w.print(); }, 250);
        }

        let ficheScope = 'classe';
        const modaleFiche = container.querySelector('#modale-fiche-suivi');
        const titreModaleFiche = container.querySelector('#titre-modale-fiche');

        function ouvrirModaleFiche(scope) {
            ficheScope = scope;
            if (titreModaleFiche) {
                titreModaleFiche.textContent = scope === 'eleve'
                    ? '📄 Fiche élève'
                    : '📄 Fiche de classe';
            }
            const cible = container.querySelector('#fiche-suivi-cible');
            if (cible) {
                cible.textContent = scope === 'eleve'
                    ? (eleveSelectionne || 'Élève') + ' · ' + (classeActuelle || '')
                    : (classeActuelle || 'Classe') + ' · ' + elevesActuels.length + ' élève(s)';
            }
            if (modaleFiche) modaleFiche.style.display = 'flex';
        }

        function fermerModaleFiche() {
            if (modaleFiche) modaleFiche.style.display = 'none';
        }

        const btnFicheClasse = container.querySelector('#generer-fiche-classe-btn');
        if (btnFicheClasse) {
            btnFicheClasse.addEventListener('click', function () {
                if (!elevesActuels.length) {
                    alert('Sélectionnez d’abord une classe.');
                    return;
                }
                ouvrirModaleFiche('classe');
            });
        }
        const btnFicheEleve = container.querySelector('#generer-fiche-eleve-btn');
        if (btnFicheEleve) {
            btnFicheEleve.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                if (!eleveSelectionne) return;
                ouvrirModaleFiche('eleve');
            });
        }
        container.querySelectorAll('.close-modale-fiche, .close-modale-fiche-btn').forEach(function (btn) {
            btn.addEventListener('click', fermerModaleFiche);
        });
        if (modaleFiche) {
            modaleFiche.addEventListener('click', function (e) {
                if (e.target === modaleFiche) fermerModaleFiche();
            });
        }
        const confirmerFiche = container.querySelector('#confirmer-fiche-suivi');
        if (confirmerFiche) {
            confirmerFiche.addEventListener('click', function () {
                const options = {
                    oublis: !!(container.querySelector('#fiche-inclure-oublis') || {}).checked,
                    mots: !!(container.querySelector('#fiche-inclure-mots') || {}).checked,
                    moyennes: !!(container.querySelector('#fiche-inclure-moyennes') || {}).checked,
                    notes: !!(container.querySelector('#fiche-inclure-notes') || {}).checked,
                    info: isPpClasseActuelle() && !!(container.querySelector('#fiche-inclure-info-pp') || {}).checked
                };
                if (!options.oublis && !options.mots && !options.moyennes && !options.notes && !options.info) {
                    alert('Cochez au moins une information à inclure.');
                    return;
                }
                const eleves = ficheScope === 'eleve'
                    ? elevesActuels.filter(function (e) { return e.nomComplet === eleveSelectionne; })
                    : elevesActuels.slice();
                if (!eleves.length) {
                    alert('Aucun élève à inclure.');
                    return;
                }
                fermerModaleFiche();
                imprimerFichesSuivi(eleves, options);
            });
        }

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
                const dateInput = container.querySelector('#emargement-date');
                if (dateInput && !dateInput.value) dateInput.value = new Date().toISOString().slice(0, 10);
                const profInput = container.querySelector('#emargement-prof');
                if (profInput) {
                    remplirChampEmargementProf(profInput);
                }
                const classeLibelle = container.querySelector('#emargement-classe-libelle');
                if (classeLibelle && classeActuelle) classeLibelle.value = classeActuelle;
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
                const meta = {
                    titre: (container.querySelector('#emargement-titre') || {}).value || '',
                    sousTitre: (container.querySelector('#emargement-sous-titre') || {}).value || '',
                    date: (container.querySelector('#emargement-date') || {}).value || '',
                    salle: (container.querySelector('#emargement-salle') || {}).value || '',
                    prof: retirerEmojisTexte((container.querySelector('#emargement-prof') || {}).value || ''),
                    classeLibelle: (container.querySelector('#emargement-classe-libelle') || {}).value || ''
                };
                
                if (colonnes.length === 0) {
                    alert('⚠️ Veuillez saisir au moins un intitulé de colonne');
                    return;
                }
                
                const listeClasseEmargement = classeActuelle
                    ? studentsForClass(classeActuelle)
                    : null;

                if (!listeClasseEmargement || listeClasseEmargement.length === 0) {
                    alert('⚠️ Erreur : aucune classe sélectionnée');
                    return;
                }
                
                const eleves = listeClasseEmargement.map(e => ({
                    nom: e.nom,
                    prenom: e.prenom,
                    nomComplet: `${e.prenom} ${e.nom.toUpperCase()}`
                })).sort((a, b) => a.nom.localeCompare(b.nom));
                
                if (format === 'excel') {
                    genererExcelEmargement(classeActuelle, eleves, colonnes, meta);
                } else {
                    genererPDFEmargement(classeActuelle, eleves, colonnes, meta);
                }
                
                modaleEmargement.style.display = 'none';
            });
        }
        
        // Fonction pour générer Excel
        function genererExcelEmargement(classe, eleves, colonnes, meta) {
            meta = meta || {};
            if (typeof XLSX === 'undefined') {
                alert('❌ La bibliothèque XLSX n\'est pas chargée. Impossible de générer le fichier Excel.');
                return;
            }

            const libelleClasse = (meta.classeLibelle || classe || '').trim();
            const headerRows = [];
            const titre = (meta.titre || '').trim() || ('Liste d\'émargement' + (libelleClasse ? ' - ' + libelleClasse : ''));
            headerRows.push([titre]);
            if ((meta.sousTitre || '').trim()) headerRows.push([meta.sousTitre.trim()]);
            const infos = [];
            if (libelleClasse) infos.push('Classe : ' + libelleClasse);
            if ((meta.date || '').trim()) {
                const d = meta.date.trim();
                infos.push('Date : ' + (/^\d{4}-\d{2}-\d{2}$/.test(d) ? d.split('-').reverse().join('/') : d));
            }
            if ((meta.salle || '').trim()) infos.push('Salle : ' + meta.salle.trim());
            if ((meta.prof || '').trim()) infos.push('Enseignant : ' + meta.prof.trim());
            if (infos.length) headerRows.push([infos.join('  ·  ')]);
            headerRows.push([]);

            const headers = ['Élève', ...colonnes];
            const data = [
                ...headerRows,
                headers,
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
        
        function genererPDFEmargement(classe, eleves, colonnes, meta) {
            meta = meta || {};
            if (typeof jspdf === 'undefined' && typeof window.jspdf === 'undefined') {
                alert('❌ La bibliothèque jsPDF n\'est pas chargée. Impossible de générer le fichier PDF.');
                return;
            }

            const { jsPDF } = window.jspdf || jspdf;
            const paysage = colonnes.length >= 4;
            const doc = new jsPDF({ orientation: paysage ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
            const pageW = doc.internal.pageSize.getWidth();
            const pageH = doc.internal.pageSize.getHeight();
            const marginX = 12;
            const marginBottom = 16;
            const tableWidth = pageW - marginX * 2;
            const libelleClasse = (meta.classeLibelle || classe || '').trim();
            const titre = (meta.titre || '').trim() || 'Liste d\'émargement';
            const sousTitre = (meta.sousTitre || '').trim();
            const dateLibelle = (function () {
                const d = (meta.date || '').trim();
                if (!d) return '';
                return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d.split('-').reverse().join('/') : d;
            })();
            const metaItems = [];
            if (libelleClasse) metaItems.push({ label: 'Classe', value: libelleClasse });
            if (dateLibelle) metaItems.push({ label: 'Date', value: dateLibelle });
            if ((meta.salle || '').trim()) metaItems.push({ label: 'Salle', value: meta.salle.trim() });
            if ((meta.prof || '').trim()) metaItems.push({ label: 'Enseignant', value: meta.prof.trim() });

            const colNumWidth = 10;
            const minNomWidth = 48;
            const remaining = tableWidth - colNumWidth;
            const emargWidth = colonnes.length ? remaining * 0.52 / colonnes.length : 0;
            const colNomWidth = Math.max(minNomWidth, remaining - emargWidth * colonnes.length);

            function wrapLines(text, width, fontSize, fontStyle) {
                doc.setFont('helvetica', fontStyle || 'normal');
                doc.setFontSize(fontSize);
                return doc.splitTextToSize(String(text || ''), Math.max(8, width));
            }

            function drawHeader() {
                let y = 12;
                doc.setFillColor(30, 64, 175);
                doc.rect(0, 0, pageW, 4, 'F');

                doc.setFont('times', 'bold');
                doc.setFontSize(titre.length > 42 ? 15 : 18);
                doc.setTextColor(15, 23, 42);
                const titreLines = doc.splitTextToSize(titre, tableWidth);
                titreLines.forEach(function (line) {
                    doc.text(line, pageW / 2, y + 6, { align: 'center' });
                    y += 7;
                });

                if (sousTitre) {
                    doc.setFont('times', 'italic');
                    doc.setFontSize(11);
                    doc.setTextColor(51, 65, 85);
                    wrapLines(sousTitre, tableWidth, 11, 'italic').forEach(function (line) {
                        doc.text(line, pageW / 2, y + 4, { align: 'center' });
                        y += 5;
                    });
                    y += 2;
                }

                if (metaItems.length) {
                    y += 2;
                    const colW = tableWidth / 2;
                    const rowH = 6;
                    const rows = Math.ceil(metaItems.length / 2);
                    const boxH = rows * rowH + 4;
                    doc.setFillColor(248, 250, 252);
                    doc.setDrawColor(203, 213, 225);
                    if (typeof doc.roundedRect === 'function') {
                        doc.roundedRect(marginX, y, tableWidth, boxH, 1.5, 1.5, 'FD');
                    } else {
                        doc.rect(marginX, y, tableWidth, boxH, 'FD');
                    }
                    metaItems.forEach(function (item, i) {
                        const col = i % 2;
                        const row = Math.floor(i / 2);
                        const x = marginX + 3 + col * colW;
                        const iy = y + 5 + row * rowH;
                        doc.setFont('helvetica', 'bold');
                        doc.setFontSize(8);
                        doc.setTextColor(100, 116, 139);
                        doc.text(item.label.toUpperCase(), x, iy);
                        doc.setFont('helvetica', 'normal');
                        doc.setFontSize(10);
                        doc.setTextColor(15, 23, 42);
                        const valueLines = doc.splitTextToSize(item.value, colW - 8);
                        doc.text(valueLines[0], x + 22, iy);
                    });
                    y += boxH + 5;
                } else {
                    y += 4;
                }
                return y;
            }

            function drawTableHeader(y) {
                const headerLines = colonnes.map(function (col) {
                    return wrapLines(col, emargWidth - 3, 8, 'bold');
                });
                const nomLines = wrapLines('Élève', colNomWidth - 3, 8, 'bold');
                const maxLines = Math.max(1, nomLines.length, ...headerLines.map(function (l) { return l.length; }));
                const h = Math.max(9, 4 + maxLines * 3.4);

                doc.setFillColor(30, 64, 175);
                doc.setTextColor(255, 255, 255);
                doc.rect(marginX, y, tableWidth, h, 'F');
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(8);
                doc.text('N°', marginX + colNumWidth / 2, y + h / 2 + 1, { align: 'center' });
                doc.text(nomLines, marginX + colNumWidth + 2, y + 4.2);
                colonnes.forEach(function (col, index) {
                    const x = marginX + colNumWidth + colNomWidth + index * emargWidth;
                    doc.text(headerLines[index], x + emargWidth / 2, y + 4.2, { align: 'center' });
                });
                return y + h;
            }

            function drawFooter() {
                const pages = doc.getNumberOfPages();
                for (let p = 1; p <= pages; p++) {
                    doc.setPage(p);
                    doc.setDrawColor(203, 213, 225);
                    doc.line(marginX, pageH - 10, pageW - marginX, pageH - 10);
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(8);
                    doc.setTextColor(100, 116, 139);
                    doc.text('eProf — émargement', marginX, pageH - 6);
                    doc.text('Page ' + p + ' / ' + pages, pageW - marginX, pageH - 6, { align: 'right' });
                }
            }

            let y = drawHeader();
            y = drawTableHeader(y);

            eleves.forEach(function (eleve, index) {
                const nomLines = wrapLines(eleve.nomComplet, colNomWidth - 4, 9, 'normal');
                const rowH = Math.max(8, 3.2 + nomLines.length * 3.6);
                if (y + rowH > pageH - marginBottom) {
                    doc.addPage();
                    y = drawHeader();
                    y = drawTableHeader(y);
                }

                if (index % 2 === 0) {
                    doc.setFillColor(241, 245, 249);
                    doc.rect(marginX, y, tableWidth, rowH, 'F');
                }
                doc.setDrawColor(226, 232, 240);
                doc.rect(marginX, y, colNumWidth, rowH);
                doc.rect(marginX + colNumWidth, y, colNomWidth, rowH);
                colonnes.forEach(function (_, colIndex) {
                    doc.rect(marginX + colNumWidth + colNomWidth + colIndex * emargWidth, y, emargWidth, rowH);
                });

                doc.setTextColor(15, 23, 42);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8);
                doc.text(String(index + 1), marginX + colNumWidth / 2, y + rowH / 2 + 1, { align: 'center' });
                doc.setFontSize(9);
                doc.text(nomLines, marginX + colNumWidth + 2, y + 4.4);
                y += rowH;
            });

            drawFooter();
            const fileName = `Emargement_${classe.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
            doc.save(fileName);
            alert('✓ Liste d\'émargement PDF générée !\n\nFichier : ' + fileName);
        }
    }

    function hydrateSuivi(hooks) {
        if (hooks && typeof hooks.updateNotifications === 'function') {
            global.EprofAppHooks = global.EprofAppHooks || {};
            global.EprofAppHooks.updateNotifications = hooks.updateNotifications;
        }
        if (window.teacherManager && window.teacherManager.getCurrentTeacher()) {
            chargerCarnetPourSuivi(true);
            chargerSuiviEnLigne().then(function (distant) {
                if (suiviHasContent(distant)) ecrireSuiviLocal(distant);
                updateNotifications();
            });
            if (window.EprofSuiviTableau) window.EprofSuiviTableau.hydrater();
        }
    }

    global.EprofSuiviEleves = {
        render: function (container, extra) {
            extra = extra || {};
            suiviNav.from = extra.from || '';
            suiviNav.conseil = extra.conseil || null;
            renderSuiviEleves(container, extra.classe, extra.eleve);
        },
        hydrate: hydrateSuivi,
        lireSuiviLocal: lireSuiviLocal,
        infoPpSummary: infoPpSummary
    };
})(window);
