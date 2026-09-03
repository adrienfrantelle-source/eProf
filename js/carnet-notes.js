// ===== VARIABLES GLOBALES =====
let currentClass = null;
let evaluations = {};
let notes = {};
const CARNET_DOC_TYPE = 'carnet_notes';
let cloudHydrated = false;
let cloudHydratePromise = null;
let cloudAutoSaveTimer = null;

function getAnneeScolaireFromPrefs() {
    try {
        const p = JSON.parse(localStorage.getItem('parametres') || '{}');
        return p.anneeScolaire || '2026-2027';
    } catch (e) {
        return '2026-2027';
    }
}

function applyCarnetDisplayTheme() {
    var sombre = false;
    try {
        var p = JSON.parse(localStorage.getItem('parametres') || '{}');
        sombre = (p.affichage || {}).theme === 'sombre';
    } catch (e) {}
    document.documentElement.classList.toggle('theme-sombre', sombre);
    if (document.body) document.body.classList.toggle('theme-sombre', sombre);
    var ct = (p.affichage || {}).couleurTheme || 'defaut';
    if (ct !== 'defaut' && ct !== 'custom') {
        document.documentElement.classList.add('theme-' + ct);
        if (document.body) document.body.classList.add('theme-' + ct);
    }
    if (ct === 'custom' && (p.affichage || {}).couleurAccent) {
        var hex = p.affichage.couleurAccent.replace('#', '');
        var r = parseInt(hex.substring(0, 2), 16);
        var g = parseInt(hex.substring(2, 4), 16);
        var b = parseInt(hex.substring(4, 6), 16);
        document.documentElement.style.setProperty('--eprof-accent', p.affichage.couleurAccent);
        document.documentElement.style.setProperty('--eprof-accent-rgb', r + ', ' + g + ', ' + b);
    }
    var densite = (p.affichage || {}).densite || 'normal';
    if (densite === 'compact') {
        document.documentElement.classList.add('densite-compact');
        if (document.body) document.body.classList.add('densite-compact');
    } else if (densite === 'confortable') {
        document.documentElement.classList.add('densite-confortable');
        if (document.body) document.body.classList.add('densite-confortable');
    }
    if (sombre && window.Chart && window.Chart.defaults) {
        Chart.defaults.color = '#cbd5e1';
        if (Chart.defaults.plugins && Chart.defaults.plugins.legend) {
            Chart.defaults.plugins.legend.labels = Chart.defaults.plugins.legend.labels || {};
            Chart.defaults.plugins.legend.labels.color = '#e2e8f0';
        }
    }
}

function isCarnetDarkTheme() {
    return document.documentElement.classList.contains('theme-sombre') ||
        (document.body && document.body.classList.contains('theme-sombre'));
}

function carnetChartColors() {
    const dark = isCarnetDarkTheme();
    return {
        text: dark ? '#e2e8f0' : '#1e293b',
        muted: dark ? '#94a3b8' : '#64748b',
        grid: dark ? 'rgba(148, 163, 184, 0.22)' : 'rgba(15, 23, 42, 0.08)',
        pointBorder: dark ? '#1e293b' : '#fff'
    };
}

function carnetRadarScaleOptions() {
    const c = carnetChartColors();
    return {
        suggestedMin: 0,
        suggestedMax: 20,
        ticks: {
            stepSize: 5,
            showLabelBackdrop: false,
            backdropColor: 'transparent',
            color: c.muted
        },
        grid: { color: c.grid },
        angleLines: { color: c.grid },
        pointLabels: {
            color: c.text,
            font: { size: 13, weight: '600' }
        }
    };
}

// ===== CHARGEMENT =====
document.addEventListener('DOMContentLoaded', () => {
    applyCarnetDisplayTheme();
    console.log('Carnet de notes chargé');
    
    // Attendre que le TeacherManager soit initialisé
    if (window.teacherManager && window.teacherManager.getCurrentTeacher()) {
        initAfterLogin();
    } else {
        // Écouter l'événement de connexion
        window.addEventListener('teacherLoggedIn', () => {
            initAfterLogin();
        });
    }
    
    // Permettre de cliquer sur le nom de l'enseignant pour configurer
    const teacherNameDisplay = document.getElementById('teacher-name-display');
    if (teacherNameDisplay) {
        teacherNameDisplay.onclick = () => {
            if (window.teacherManager) {
                window.teacherManager.showInitialConfig();
            }
        };
    }
});

function initAfterLogin() {
    localStorage.removeItem('carnetNotesEvaluations');
    localStorage.removeItem('carnetNotesNotes');

    const teacherNameDisplay = document.getElementById('teacher-name-display');
    if (teacherNameDisplay && window.teacherManager) {
        teacherNameDisplay.textContent = `👨‍🏫 ${window.teacherManager.getCurrentTeacher()}`;
    }
    
    initClassSelector();
    loadDataFromStorage();
    initEventListeners();
    hydraterCarnetDepuisCloud();
}

function initEventListeners() {
    // Événements
    const classSelect = document.getElementById('class-select');
    const addEvalBtn = document.getElementById('add-eval-btn');
    const closeModalBtn = document.querySelector('.close-modal');
    const evalForm = document.getElementById('eval-form');
    const importBtn = document.getElementById('import-data-btn');
    const exportBtn = document.getElementById('export-data-btn');
    const savePortableBtn = document.getElementById('save-portable-btn');
    const restorePortableBtn = document.getElementById('restore-portable-btn');
    const restoreFileInput = document.getElementById('restore-file-input');
    const configBtn = document.getElementById('config-btn');
    const saveCloudBtn = document.getElementById('save-cloud-btn');
    const loadCloudBtn = document.getElementById('load-cloud-btn');
    
    if (classSelect) {
        classSelect.addEventListener('change', handleClassChange);
    }
    
    if (addEvalBtn) {
        addEvalBtn.addEventListener('click', () => {
            console.log('Bouton nouvelle évaluation cliqué');
            openEvalModal();
        });
    }
    
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeEvalModal);
    }
    
    if (evalForm) {
        evalForm.addEventListener('submit', handleEvalFormSubmit);
    }
    
    if (importBtn) {
        importBtn.addEventListener('click', handleImportData);
    }
    
    if (exportBtn) {
        exportBtn.addEventListener('click', handleExportData);
    }
    
    if (savePortableBtn) {
        savePortableBtn.addEventListener('click', handleSavePortable);
    }
    
    if (restorePortableBtn) {
        restorePortableBtn.addEventListener('click', () => {
            restoreFileInput.click();
        });
    }
    
    if (restoreFileInput) {
        restoreFileInput.addEventListener('change', handleRestorePortable);
    }
    
    if (saveCloudBtn) {
        saveCloudBtn.addEventListener('click', handleSaveCloud);
    }
    
    if (loadCloudBtn) {
        loadCloudBtn.addEventListener('click', handleLoadCloud);
    }
    
    // Toggle évaluations
    const toggleEvalsBtn = document.getElementById('toggle-evals-btn');
    if (toggleEvalsBtn) {
        toggleEvalsBtn.addEventListener('click', toggleEvaluationsList);
    }
    
    // Statistiques de classe
    const classStatsBtn = document.getElementById('class-stats-btn');
    if (classStatsBtn) {
        classStatsBtn.addEventListener('click', openClassStats);
    }
}

// ===== INITIALISATION =====
function initClassSelector() {
    const select = document.getElementById('class-select');
    const classEmptyMessage = document.getElementById('class-empty-message');
    
    if (!window.teacherManager) {
        console.warn('TeacherManager non disponible');
        return;
    }
    
    const classes = window.teacherManager.getTeacherClasses();
    if (classes && classes.length > 0) {
        classes.forEach(className => {
            const option = document.createElement('option');
            option.value = className;
            option.textContent = className;
            select.appendChild(option);
        });
        if (classEmptyMessage) {
            classEmptyMessage.style.display = 'none';
        }
        console.log('Classes chargées:', classes.length);
    } else {
        console.warn('Aucune classe configurée');
        if (classEmptyMessage) {
            classEmptyMessage.style.display = 'block';
        }
        if (select) {
            select.innerHTML = '<option value="">-- Les listes ' + getAnneeScolaireFromPrefs() + ' arrivent bientôt --</option>';
        }
    }
}

function loadDataFromStorage() {
    localStorage.removeItem('carnetNotesEvaluations');
    localStorage.removeItem('carnetNotesNotes');

    if (!window.teacherManager) {
        console.warn('TeacherManager non disponible');
        return;
    }
    
    // Utiliser des clés spécifiques à l'enseignant via TeacherManager
    const evalsKey = window.teacherManager.getStorageKey('carnetNotesEvaluations');
    const notesKey = window.teacherManager.getStorageKey('carnetNotesNotes');
    
    // Priorité 1: Charger depuis CARNET_NOTES_DATA si défini et non vide
    if (typeof CARNET_NOTES_DATA !== 'undefined' && CARNET_NOTES_DATA) {
        if (CARNET_NOTES_DATA.evaluations && Object.keys(CARNET_NOTES_DATA.evaluations).length > 0) {
            evaluations = { ...CARNET_NOTES_DATA.evaluations };
            console.log('Évaluations chargées depuis fichier portable');
        }
        if (CARNET_NOTES_DATA.notes && Object.keys(CARNET_NOTES_DATA.notes).length > 0) {
            notes = { ...CARNET_NOTES_DATA.notes };
            console.log('Notes chargées depuis fichier portable');
        }
    }
    
    // Priorité 2: localStorage en fallback
    if (Object.keys(evaluations).length === 0) {
        const savedEvaluations = localStorage.getItem(evalsKey);
        if (savedEvaluations) {
            try {
                evaluations = JSON.parse(savedEvaluations);
                console.log('Évaluations chargées depuis localStorage:', evalsKey);
            } catch (e) {
                console.error('Erreur chargement évaluations:', e);
            }
        }
    }
    
    if (Object.keys(notes).length === 0) {
        const savedNotes = localStorage.getItem(notesKey);
        if (savedNotes) {
            try {
                notes = JSON.parse(savedNotes);
                console.log('Notes chargées depuis localStorage:', notesKey);
            } catch (e) {
                console.error('Erreur chargement notes:', e);
            }
        }
    }
}

function persistCarnetLocal() {
    if (!window.teacherManager) {
        console.warn('TeacherManager non disponible');
        return;
    }
    const evalsKey = window.teacherManager.getStorageKey('carnetNotesEvaluations');
    const notesKey = window.teacherManager.getStorageKey('carnetNotesNotes');
    localStorage.setItem(evalsKey, JSON.stringify(evaluations));
    localStorage.setItem(notesKey, JSON.stringify(notes));
}

function saveData() {
    persistCarnetLocal();
    
    if (window.dataManager) {
        window.dataManager.triggerAutoSave();
    }

    markUnsavedCloudChanges();
    planifierSauvegardeCloud();
}

function carnetHasContent(data) {
    if (!data) return false;
    const evals = data.evaluations || {};
    const nts = data.notes || {};
    return Object.keys(evals).some(function (k) { return (evals[k] || []).length > 0; })
        || Object.keys(nts).some(function (k) { return Object.keys(nts[k] || {}).length > 0; });
}

function appliquerCarnetDistant(payload) {
    clearTimeout(cloudAutoSaveTimer);
    evaluations = payload.evaluations || {};
    notes = payload.notes || {};
    persistCarnetLocal();
    clearUnsavedCloudChanges();
    if (currentClass) {
        renderEvaluations();
        renderNotesTable();
    }
}

async function hydraterCarnetDepuisCloud() {
    if (cloudHydratePromise) return cloudHydratePromise;
    cloudHydratePromise = (async function () {
        if (!window.EprofStore || !window.eprofSupabaseReady) return;
        await window.eprofSupabaseReady;
        if (!(await window.EprofStore.isOnlineReady())) return;

        const { data, error } = await window.EprofStore.getTeacherDocument(CARNET_DOC_TYPE);
        if (error) {
            console.error('❌ Carnet de notes : chargement automatique en ligne échoué', error);
            return;
        }

        if (data && data.data && carnetHasContent(data.data)) {
            appliquerCarnetDistant(data.data);
            cloudHydrated = true;
            console.log('✓ Carnet de notes chargé automatiquement depuis le cloud');
            return;
        }

        // Première synchro : le poste local a déjà des données, on les pousse en ligne.
        if (carnetHasContent({ evaluations, notes })) {
            await sauvegarderCarnetEnLigne(true);
        }
        cloudHydrated = true;
    })().finally(function () {
        cloudHydratePromise = null;
    });
    return cloudHydratePromise;
}

async function sauvegarderCarnetEnLigne(silencieux) {
    if (!window.EprofStore || !(await window.EprofStore.isOnlineReady())) {
        if (!silencieux) {
            alert('☁️ Connectez-vous à votre compte eProf pour sauvegarder le carnet de notes en ligne.');
        }
        return false;
    }

    const { error } = await window.EprofStore.saveTeacherDocument(CARNET_DOC_TYPE, { evaluations, notes });
    if (error) {
        if (!silencieux) {
            alert('❌ Erreur lors de la sauvegarde en ligne : ' + error.message);
        } else {
            console.error('❌ Carnet de notes : sauvegarde automatique en ligne échouée', error);
        }
        return false;
    }
    clearUnsavedCloudChanges();
    return true;
}

function planifierSauvegardeCloud() {
    clearTimeout(cloudAutoSaveTimer);
    cloudAutoSaveTimer = setTimeout(async function () {
        await sauvegarderCarnetEnLigne(true);
    }, 1500);
}

// ===== Rappel de sauvegarde en ligne (bannière + liseré + confirmation avant fermeture) =====
let hasUnsavedCloudChanges = false;

function updateCloudSaveIndicator() {
    const banner = document.getElementById('unsaved-cloud-banner');
    const saveCloudBtn = document.getElementById('save-cloud-btn');
    if (banner) banner.style.display = hasUnsavedCloudChanges ? 'block' : 'none';
    if (saveCloudBtn) saveCloudBtn.classList.toggle('needs-cloud-save', hasUnsavedCloudChanges);
}

function markUnsavedCloudChanges() {
    hasUnsavedCloudChanges = true;
    updateCloudSaveIndicator();
}

function clearUnsavedCloudChanges() {
    hasUnsavedCloudChanges = false;
    updateCloudSaveIndicator();
}

window.addEventListener('beforeunload', (e) => {
    if (!hasUnsavedCloudChanges) return;
    e.preventDefault();
    e.returnValue = '';
});

// ===== GESTION DES CLASSES =====
function handleClassChange(e) {
    currentClass = e.target.value;
    
    if (currentClass) {
        document.getElementById('evaluations-section').style.display = 'block';
        
        // Initialiser les structures de données pour cette classe si nécessaire
        if (!evaluations[currentClass]) {
            evaluations[currentClass] = [];
        }
        if (!notes[currentClass]) {
            notes[currentClass] = {};
        }
        
        // Générer les boutons de période selon la classe
        generatePeriodButtons();
        
        renderEvaluations();
        renderNotesTable();
    } else {
        document.getElementById('evaluations-section').style.display = 'none';
    }
}

// Liste d'élèves de l'année en cours pour une classe (jamais l'archive : les noms
// de classe se répètent d'une année sur l'autre).
function getStudentsForClass(className) {
    if (!className || !window.getAvailableStudentLists) return [];
    return window.getAvailableStudentLists()[className] || [];
}

// Une classe est en semestres ou en trimestres selon le référentiel de
// l'établissement ; à défaut, 1ère et Terminale sont en semestres.
function usesSemestres(className) {
    if (!className) return false;
    if (window.EprofReferentiel) {
        return window.EprofReferentiel.getPeriodType(className) === 'semestre';
    }
    const lower = className.toLowerCase();
    return lower.includes('1ère') || lower.includes('1ere') || lower.includes('terminale') || lower.includes('tle');
}

// Générer les boutons de période selon le type de classe
function generatePeriodButtons() {
    const isTerminale = usesSemestres(currentClass);
    
    const periodButtonsContainer = document.getElementById('period-buttons');
    if (!periodButtonsContainer) return;
    
    // Définir les périodes selon le type de classe
    let periods = [];
    if (isTerminale) {
        periods = [
            { value: 'all', label: 'Toutes' },
            { value: 'semestre1', label: 'Semestre 1' },
            { value: 'semestre2', label: 'Semestre 2' }
        ];
    } else {
        periods = [
            { value: 'all', label: 'Toutes' },
            { value: 'trimestre1', label: 'Trimestre 1' },
            { value: 'trimestre2', label: 'Trimestre 2' },
            { value: 'trimestre3', label: 'Trimestre 3' }
        ];
    }
    
    // Générer les boutons
    periodButtonsContainer.innerHTML = periods.map(p => 
        `<button class="period-btn ${p.value === 'all' ? 'active' : ''}" data-period="${p.value}">${p.label}</button>`
    ).join('');
    
    // Attacher les événements
    periodButtonsContainer.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            // Retirer la classe active de tous les boutons
            periodButtonsContainer.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
            // Ajouter la classe active au bouton cliqué
            this.classList.add('active');
            // Re-render le tableau
            renderNotesTable();
        });
    });
}

// Obtenir la période sélectionnée
function getSelectedPeriod() {
    const activeBtn = document.querySelector('#period-buttons .period-btn.active');
    return activeBtn ? activeBtn.dataset.period : 'all';
}

// Générer les boutons de période dans le formulaire
function generateFormPeriodButtons() {
    const isTerminale = usesSemestres(currentClass);
    
    const periodButtonsContainer = document.getElementById('eval-period-buttons');
    if (!periodButtonsContainer) return;
    
    // Définir les périodes selon le type de classe
    let periods = [];
    if (isTerminale) {
        periods = [
            { value: 'semestre1', label: 'Semestre 1' },
            { value: 'semestre2', label: 'Semestre 2' }
        ];
    } else {
        periods = [
            { value: 'trimestre1', label: 'Trimestre 1' },
            { value: 'trimestre2', label: 'Trimestre 2' },
            { value: 'trimestre3', label: 'Trimestre 3' }
        ];
    }
    
    // Générer les boutons
    periodButtonsContainer.innerHTML = periods.map(p => 
        `<button type="button" class="period-btn" data-period="${p.value}">${p.label}</button>`
    ).join('');
    
    // Attacher les événements
    periodButtonsContainer.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            // Retirer la classe active de tous les boutons
            periodButtonsContainer.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
            // Ajouter la classe active au bouton cliqué
            this.classList.add('active');
            // Mettre à jour le champ caché
            document.getElementById('eval-period').value = this.dataset.period;
        });
    });
}

// Activer un bouton de période spécifique dans le formulaire
function setFormPeriodActive(periodValue) {
    const periodButtonsContainer = document.getElementById('eval-period-buttons');
    if (!periodButtonsContainer) return;
    
    periodButtonsContainer.querySelectorAll('.period-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.period === periodValue) {
            btn.classList.add('active');
        }
    });
}

// ===== GESTION DES ÉVALUATIONS =====
function openEvalModal(evalId = null) {
    console.log('openEvalModal appelé avec evalId:', evalId);
    
    const modal = document.getElementById('eval-modal');
    const form = document.getElementById('eval-form');
    const title = document.getElementById('modal-title');
    const subjectSelect = document.getElementById('eval-subject');
    
    if (!modal || !form || !title) {
        console.error('Éléments du modal non trouvés');
        return;
    }
    
    form.reset();
    
    // Remplir le select de duplication avec les évaluations des autres classes
    const copySelect = document.getElementById('copy-eval-select');
    if (copySelect && evalId === null) {
        populateCopyEvalSelect();
        copySelect.style.display = 'block';
        copySelect.closest('.form-group').style.display = 'block';
        
        // Événement pour remplir automatiquement le formulaire
        copySelect.onchange = function() {
            if (this.value) {
                const [className, evalIndex] = this.value.split('|');
                const evalToCopy = evaluations[className][parseInt(evalIndex)];
                if (evalToCopy) {
                    document.getElementById('eval-title').value = evalToCopy.title;
                    document.getElementById('eval-date').value = evalToCopy.date;
                    document.getElementById('eval-subject').value = evalToCopy.subject;
                    document.getElementById('eval-max').value = evalToCopy.maxPoints;
                    document.getElementById('eval-coef').value = evalToCopy.coefficient;
                    document.getElementById('eval-period').value = evalToCopy.period;
                }
            }
        };
    } else if (copySelect) {
        copySelect.style.display = 'none';
        copySelect.closest('.form-group').style.display = 'none';
    }
    
    // Remplir le select des matières selon la classe
    if (subjectSelect && currentClass && window.teacherManager) {
        subjectSelect.innerHTML = '<option value="">-- Choisir --</option>';
        
        // Utiliser les matières configurées pour cette classe via TeacherManager
        const classSubjects = window.teacherManager.getSubjectsForClass(currentClass);
        classSubjects.forEach(subject => {
            subjectSelect.innerHTML += `<option value="${subject}">${subject}</option>`;
        });
    }
    
    // Générer les boutons de période dans le formulaire
    generateFormPeriodButtons();
    
    if (evalId !== null) {
        // Mode édition
        const eval = evaluations[currentClass][evalId];
        title.textContent = 'Modifier l\'évaluation';
        document.getElementById('eval-title').value = eval.title;
        document.getElementById('eval-date').value = eval.date;
        document.getElementById('eval-subject').value = eval.subject;
        document.getElementById('eval-max').value = eval.maxPoints;
        document.getElementById('eval-coef').value = eval.coefficient;
        document.getElementById('eval-period').value = eval.period;
        document.getElementById('eval-non-significative').checked = eval.nonSignificative === true;
        // Activer le bouton correspondant
        setFormPeriodActive(eval.period);
        form.dataset.evalId = evalId;
    } else {
        // Mode création
        title.textContent = 'Nouvelle évaluation';
        delete form.dataset.evalId;
        document.getElementById('eval-non-significative').checked = false;
        // Date par défaut : aujourd'hui
        document.getElementById('eval-date').value = new Date().toISOString().split('T')[0];
        // Sélectionner la première période par défaut
        const isTerminale = usesSemestres(currentClass);
        const defaultPeriod = isTerminale ? 'semestre1' : 'trimestre1';
        document.getElementById('eval-period').value = defaultPeriod;
        setFormPeriodActive(defaultPeriod);
    }
    
    modal.style.display = 'block';
}

function closeEvalModal() {
    document.getElementById('eval-modal').style.display = 'none';
}

function handleEvalFormSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const evalData = {
        title: document.getElementById('eval-title').value,
        date: document.getElementById('eval-date').value,
        subject: document.getElementById('eval-subject').value,
        maxPoints: parseFloat(document.getElementById('eval-max').value),
        coefficient: parseFloat(document.getElementById('eval-coef').value),
        period: document.getElementById('eval-period').value,
        nonSignificative: document.getElementById('eval-non-significative').checked,
        id: Date.now().toString()
    };
    
    if (form.dataset.evalId !== undefined) {
        // Modification : on conserve l'identifiant existant, référencé par les notes
        const evalId = parseInt(form.dataset.evalId);
        evalData.id = evaluations[currentClass][evalId].id;
        evaluations[currentClass][evalId] = evalData;
    } else {
        // Création
        evaluations[currentClass].push(evalData);
    }
    
    saveData();
    renderEvaluations();
    renderNotesTable();
    closeEvalModal();
    
    // Initialiser le bouton toggle
    initToggleButton();
}

function deleteEvaluation(index) {
    if (confirm('Voulez-vous vraiment supprimer cette évaluation et toutes les notes associées ?')) {
        const evalId = evaluations[currentClass][index].id;
        
        // Supprimer l'évaluation
        evaluations[currentClass].splice(index, 1);
        
        // Supprimer les notes associées
        if (notes[currentClass]) {
            Object.keys(notes[currentClass]).forEach(studentName => {
                if (notes[currentClass][studentName] && notes[currentClass][studentName][evalId]) {
                    delete notes[currentClass][studentName][evalId];
                }
            });
        }
        
        saveData();
        renderEvaluations();
        renderNotesTable();
    }
}

function renderEvaluations() {
    const container = document.getElementById('evaluations-list');
    const evals = evaluations[currentClass] || [];
    
    // Trier par date (plus récent en premier)
    const sortedEvals = [...evals].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    if (sortedEvals.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Aucune évaluation pour le moment.<br>Cliquez sur "+ Nouvelle évaluation" pour commencer.</p></div>';
        return;
    }
    
    container.innerHTML = sortedEvals.map((eval, index) => {
        // Trouver l'index original pour la suppression/modification
        const originalIndex = evals.findIndex(e => e.id === eval.id);
        return `
        <div class="eval-card">
            <h3>${eval.title}</h3>
            <p>📅 ${new Date(eval.date).toLocaleDateString('fr-FR')}</p>
            <p>📚 ${eval.subject}</p>
            <p>📊 ${eval.maxPoints} points × ${eval.coefficient}</p>
            <p>📆 ${getPeriodLabel(eval.period)}</p>
            <div class="eval-card-actions">
                <button class="btn-edit" onclick="openEvalModal(${originalIndex})">✏️ Modifier</button>
                <button class="btn-danger" onclick="deleteEvaluation(${originalIndex})">🗑️ Supprimer</button>
            </div>
        </div>
    `;
    }).join('');
}

function getPeriodLabel(period) {
    const labels = {
        'trimestre1': 'Trimestre 1',
        'trimestre2': 'Trimestre 2',
        'trimestre3': 'Trimestre 3',
        'semestre1': 'Semestre 1',
        'semestre2': 'Semestre 2'
    };
    return labels[period] || period;
}

// ===== TABLEAU DES NOTES =====
function renderNotesTable() {
    const wrapper = document.getElementById('notes-table-wrapper');
    const evals = evaluations[currentClass] || [];
    
    if (!wrapper) {
        console.error('Éléments du tableau non trouvés');
        return;
    }
    
    // Obtenir la période sélectionnée via les boutons
    const periodFilterValue = getSelectedPeriod();
    
    // Filtrer les évaluations selon la période
    let filteredEvals = periodFilterValue === 'all' 
        ? evals 
        : evals.filter(e => e.period === periodFilterValue);
    
    // Trier par date chronologique
    filteredEvals = [...filteredEvals].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    if (filteredEvals.length === 0) {
        wrapper.innerHTML = '<div class="empty-state"><p>Aucune évaluation pour cette période.</p></div>';
        return;
    }
    
    // Récupérer la liste des élèves
    const students = getStudentsForClass(currentClass);
    
    if (students.length === 0) {
        wrapper.innerHTML = '<div class="empty-state"><p>Aucune liste d’élèves n’est encore disponible pour <strong>' + currentClass + '</strong> en ' + getAnneeScolaireFromPrefs() + '.</p><p>Les listes de l’année précédente restent consultables dans le module Archives.</p></div>';
        return;
    }
    
    // Initialiser les notes pour cette classe si nécessaire
    if (!notes[currentClass]) {
        notes[currentClass] = {};
    }
    
    // Générer le tableau
    let html = '<table class="notes-table">';
    
    // En-tête
    html += '<thead><tr>';
    html += '<th rowspan="2" class="col-eleve">Élève</th>';
    html += '<th rowspan="2" class="col-moy-gen" title="Moyenne générale de la période sélectionnée">Moy.</th>';
    
    // Grouper les évaluations par matière
    const evalsBySubject = {};
    filteredEvals.forEach(eval => {
        if (!evalsBySubject[eval.subject]) {
            evalsBySubject[eval.subject] = [];
        }
        evalsBySubject[eval.subject].push(eval);
    });
    
    // Première ligne d'en-tête : Matières avec colspan
    Object.keys(evalsBySubject).forEach(subject => {
        const subjectEvals = evalsBySubject[subject];
        html += `<th class="th-subject-group" colspan="${subjectEvals.length + 1}">${subject}</th>`;
    });
    html += '</tr><tr>';
    
    // Deuxième ligne d'en-tête : Évaluations + Moyenne par matière
    Object.keys(evalsBySubject).forEach(subject => {
        const subjectEvals = evalsBySubject[subject];
        subjectEvals.forEach(eval => {
            const nonSignif = !compteDansMoyennes(eval);
            const infos = nonSignif ? 'non comptée' : `/${eval.maxPoints} (×${eval.coefficient})`;
            html += `<th class="eval-header${nonSignif ? ' eval-non-significative' : ''}" title="${eval.subject} - ${new Date(eval.date).toLocaleDateString('fr-FR')}${nonSignif ? ' — note non significative' : ''}">${nonSignif ? '📌 ' : ''}${eval.title}<br><small>${infos}</small></th>`;
        });
        html += `<th class="col-moy-matiere">Moy. ${subject}</th>`;
    });
    html += '</tr></thead>';
    
    // Corps du tableau
    html += '<tbody>';
    students.forEach(student => {
        const studentName = student.prenom + ' ' + student.nom;
        
        // Initialiser les notes de l'élève si nécessaire
        if (!notes[currentClass][studentName]) {
            notes[currentClass][studentName] = {};
        }
        
        const generalAverage = calculateStudentAverage(studentName, filteredEvals);
        const generalMention = (generalAverage !== null && window.EprofBareme) ? window.EprofBareme.getMentionForNote(generalAverage, 20) : null;
        
        html += '<tr>';
        html += `<td class="student-name-cell" onclick="openStudentStats('${studentName.replace(/'/g, "\\'")}')" title="Cliquez pour voir les statistiques">${studentName}</td>`;
        html += `<td class="student-average-gen">${generalAverage !== null ? generalAverage.toFixed(2) : '-'}${generalMention ? ' ' + generalMention.emoji : ''}</td>`;
        
        // Pour chaque matière
        Object.keys(evalsBySubject).forEach(subject => {
            const subjectEvals = evalsBySubject[subject];
            
            // Notes pour chaque évaluation de cette matière
            subjectEvals.forEach((eval, evalIndex) => {
                const noteValue = notes[currentClass][studentName][eval.id];
                const displayValue = noteValue === 'abs' ? 'abs' : (noteValue || '');
                const studentIndex = students.indexOf(student);
                const globalEvalIndex = filteredEvals.indexOf(eval);
                html += `<td><input type="text" class="note-input" data-student="${studentName}" data-eval-id="${eval.id}" data-eval-index="${globalEvalIndex}" data-student-index="${studentIndex}" data-max="${eval.maxPoints}" value="${displayValue}"></td>`;
            });
            
            // Moyenne pour cette matière
            const subjectAverage = calculateStudentAverageBySubject(studentName, subjectEvals);
            const subjectMention = (subjectAverage !== null && window.EprofBareme) ? window.EprofBareme.getMentionForNote(subjectAverage, 20) : null;
            html += `<td class="student-average">${subjectAverage !== null ? subjectAverage.toFixed(2) : '-'}${subjectMention ? ' ' + subjectMention.emoji : ''}</td>`;
        });
        
        html += '</tr>';
    });
    
    // Ligne moyenne de classe
    const classGeneralAvg = calculateClassAverage(students, filteredEvals);
    const classGeneralMention = (classGeneralAvg !== null && window.EprofBareme) ? window.EprofBareme.getMentionForNote(classGeneralAvg, 20) : null;
    html += '<tr class="class-average-row">';
    html += '<td><strong>Moyenne de classe</strong></td>';
    html += `<td class="student-average-gen">${classGeneralAvg !== null ? classGeneralAvg.toFixed(2) : '-'}${classGeneralMention ? ' ' + classGeneralMention.emoji : ''}</td>`;
    
    Object.keys(evalsBySubject).forEach(subject => {
        const subjectEvals = evalsBySubject[subject];
        
        // Moyennes par évaluation
        subjectEvals.forEach(eval => {
            const evalAverage = calculateEvalAverage(eval.id, students);
            html += `<td style="text-align:center; font-weight:600;">${evalAverage !== null ? evalAverage.toFixed(2) : '-'}</td>`;
        });
        
        // Moyenne générale de la classe pour cette matière
        const classSubjectAvg = calculateClassAverageBySubject(students, subjectEvals);
        const classMention = (classSubjectAvg !== null && window.EprofBareme) ? window.EprofBareme.getMentionForNote(classSubjectAvg, 20) : null;
        html += `<td class="student-average student-average-class">${classSubjectAvg !== null ? classSubjectAvg.toFixed(2) : '-'}${classMention ? ' ' + classMention.emoji : ''}</td>`;
    });
    
    html += '</tr>';
    html += '</tbody></table>';
    
    wrapper.innerHTML = html;
    
    // Attacher les événements aux inputs après le rendu
    attachNoteInputEvents();
}

function attachNoteInputEvents() {
    const inputs = document.querySelectorAll('.note-input');
    inputs.forEach(input => {
        // Keydown pour la navigation
        input.addEventListener('keydown', handleNoteNavigation);
        
        // Input pour gérer la conversion 'a' -> 'abs' en temps réel
        input.addEventListener('input', function(e) {
            const value = e.target.value.toLowerCase();
            if (value === 'a' || value === 'abs') {
                e.target.value = 'abs';
            }
        });
        
        // Blur pour sauvegarder quand l'utilisateur quitte le champ
        input.addEventListener('blur', function(e) {
            const studentName = e.target.dataset.student;
            const evalId = e.target.dataset.evalId;
            const maxPoints = parseFloat(e.target.dataset.max);
            const value = e.target.value;
            
            saveNoteWithoutRender(studentName, evalId, value, maxPoints);
            updateAveragesDisplay();
        });
    });
}

function saveNote(studentName, evalId, value, maxPoints) {
    saveNoteWithoutRender(studentName, evalId, value, maxPoints);
    renderNotesTable();
}

function saveNoteWithoutRender(studentName, evalId, value, maxPoints) {
    // Gérer l'absence
    if (value.toLowerCase() === 'a' || value.toLowerCase() === 'abs') {
        notes[currentClass][studentName][evalId] = 'abs';
        saveData();
        return;
    }
    
    const numValue = parseFloat(value);
    
    if (value === '' || isNaN(numValue)) {
        delete notes[currentClass][studentName][evalId];
    } else if (numValue >= 0 && numValue <= maxPoints) {
        notes[currentClass][studentName][evalId] = numValue;
    } else {
        alert(`La note doit être entre 0 et ${maxPoints}`);
        return;
    }
    
    saveData();
}

function formatAverageCell(value) {
    if (value === null || value === undefined) return '-';
    const mention = window.EprofBareme ? window.EprofBareme.getMentionForNote(value, 20) : null;
    return value.toFixed(2) + (mention ? ' ' + mention.emoji : '');
}

function updateAveragesDisplay() {
    const evals = evaluations[currentClass] || [];
    const periodFilterValue = getSelectedPeriod();
    let filteredEvals = periodFilterValue === 'all'
        ? evals
        : evals.filter(e => e.period === periodFilterValue);
    filteredEvals = [...filteredEvals].sort((a, b) => new Date(a.date) - new Date(b.date));
    const students = getStudentsForClass(currentClass);

    const evalsBySubject = {};
    filteredEvals.forEach(function (evaluation) {
        if (!evalsBySubject[evaluation.subject]) evalsBySubject[evaluation.subject] = [];
        evalsBySubject[evaluation.subject].push(evaluation);
    });
    const subjects = Object.keys(evalsBySubject);

    document.querySelectorAll('.notes-table tbody tr:not(.class-average-row)').forEach(function (row, index) {
        if (index >= students.length) return;
        const studentName = students[index].prenom + ' ' + students[index].nom;
        const genCell = row.querySelector('.student-average-gen');
        if (genCell) genCell.textContent = formatAverageCell(calculateStudentAverage(studentName, filteredEvals));
        const subjectCells = row.querySelectorAll('.student-average');
        subjects.forEach(function (subject, i) {
            if (subjectCells[i]) {
                subjectCells[i].textContent = formatAverageCell(calculateStudentAverageBySubject(studentName, evalsBySubject[subject]));
            }
        });
    });

    const classAvgRow = document.querySelector('.class-average-row');
    if (!classAvgRow) return;
    const classGenCell = classAvgRow.querySelector('.student-average-gen');
    if (classGenCell) classGenCell.textContent = formatAverageCell(calculateClassAverage(students, filteredEvals));
    const classTds = classAvgRow.querySelectorAll('td');
    let col = 2;
    subjects.forEach(function (subject) {
        evalsBySubject[subject].forEach(function (evaluation) {
            const evalAverage = calculateEvalAverage(evaluation.id, students);
            if (classTds[col]) classTds[col].textContent = evalAverage !== null ? evalAverage.toFixed(2) : '-';
            col += 1;
        });
        if (classTds[col]) {
            classTds[col].textContent = formatAverageCell(calculateClassAverageBySubject(students, evalsBySubject[subject]));
        }
        col += 1;
    });
}


// Une évaluation marquée « non significative » reste affichée mais ne compte
// dans aucune moyenne ni statistique.
function compteDansMoyennes(evaluation) {
    return !!evaluation && evaluation.nonSignificative !== true;
}

function calculateStudentAverage(studentName, evals) {
    let totalPoints = 0;
    let totalCoef = 0;
    
    evals.forEach(eval => {
        if (!compteDansMoyennes(eval)) return;
        const note = notes[currentClass][studentName][eval.id];
        if (note !== undefined && note !== null && note !== '' && note !== 'abs') {
            // Convertir la note sur 20
            const noteSur20 = (parseFloat(note) / eval.maxPoints) * 20;
            totalPoints += noteSur20 * eval.coefficient;
            totalCoef += eval.coefficient;
        }
    });
    
    return totalCoef > 0 ? totalPoints / totalCoef : null;
}

// Calculer la moyenne d'un élève pour une matière spécifique
function calculateStudentAverageBySubject(studentName, subjectEvals) {
    let totalPoints = 0;
    let totalCoef = 0;
    
    subjectEvals.forEach(eval => {
        if (!compteDansMoyennes(eval)) return;
        const note = notes[currentClass][studentName][eval.id];
        if (note !== undefined && note !== null && note !== '' && note !== 'abs') {
            // Convertir la note sur 20
            const noteSur20 = (parseFloat(note) / eval.maxPoints) * 20;
            totalPoints += noteSur20 * eval.coefficient;
            totalCoef += eval.coefficient;
        }
    });
    
    return totalCoef > 0 ? totalPoints / totalCoef : null;
}

function calculateClassAverage(students, evals) {
    let sum = 0;
    let count = 0;
    
    students.forEach(student => {
        const studentName = student.prenom + ' ' + student.nom;
        const avg = calculateStudentAverage(studentName, evals);
        if (avg !== null) {
            sum += avg;
            count++;
        }
    });
    
    return count > 0 ? sum / count : null;
}

// Calculer la moyenne de classe pour une matière spécifique
function calculateClassAverageBySubject(students, subjectEvals) {
    let sum = 0;
    let count = 0;
    
    students.forEach(student => {
        const studentName = student.prenom + ' ' + student.nom;
        const avg = calculateStudentAverageBySubject(studentName, subjectEvals);
        if (avg !== null) {
            sum += avg;
            count++;
        }
    });
    
    return count > 0 ? sum / count : null;
}

function calculateEvalAverage(evalId, students) {
    // Trouver l'évaluation pour obtenir maxPoints
    const eval = (evaluations[currentClass] || []).find(e => e.id === evalId);
    if (!eval) return null;
    const maxPoints = parseFloat(eval.maxPoints) || 20;
    let sum = 0;
    let count = 0;
    
    students.forEach(student => {
        const studentName = student.prenom + ' ' + student.nom;
        const note = notes[currentClass][studentName][evalId];
        if (note !== undefined && note !== null && note !== '' && note !== 'abs') {
            const noteNum = parseFloat(note);
            // Normaliser la note sur 20
            const noteSur20 = (noteNum / maxPoints) * 20;
            sum += noteSur20;
            count++;
        }
    });
    
    return count > 0 ? sum / count : null;
}

// ===== NAVIGATION CLAVIER =====
function handleNoteNavigation(event) {
    // Enter ou Tab : sauvegarder et passer à l'élève suivant (même évaluation)
    if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        event.stopPropagation();
        
        const currentInput = event.target;
        
        // Sauvegarder d'abord la note actuelle
        const studentName = currentInput.dataset.student;
        const evalId = currentInput.dataset.evalId;
        const maxPoints = parseFloat(currentInput.dataset.max);
        const value = currentInput.value;
        
        console.log('Navigation: Sauvegarde note pour', studentName, 'eval', evalId, 'valeur:', value);
        
        // Sauvegarder sans rerender
        saveNoteWithoutRender(studentName, evalId, value, maxPoints);
        
        // Trouver tous les inputs du tableau (sauf ligne de moyenne)
        const tbody = currentInput.closest('tbody');
        const allRows = Array.from(tbody.querySelectorAll('tr:not(.class-average-row)'));
        
        // Trouver la ligne et la cellule actuelles
        const currentRow = currentInput.closest('tr');
        const currentCell = currentInput.closest('td');
        const currentRowIndex = allRows.indexOf(currentRow);
        
        // Trouver l'index de la colonne (cellule)
        const cellsInRow = Array.from(currentRow.querySelectorAll('td'));
        const columnIndex = cellsInRow.indexOf(currentCell);
        
        console.log('Position actuelle: ligne', currentRowIndex, 'colonne', columnIndex);
        
        // Déterminer la prochaine ligne
        let nextRowIndex = currentRowIndex + 1;
        if (nextRowIndex >= allRows.length) {
            nextRowIndex = 0; // Revenir au début
        }
        
        const nextRow = allRows[nextRowIndex];
        const nextCells = Array.from(nextRow.querySelectorAll('td'));
        const nextCell = nextCells[columnIndex];
        
        console.log('Prochaine position: ligne', nextRowIndex, 'colonne', columnIndex);
        
        if (nextCell) {
            const nextInput = nextCell.querySelector('.note-input');
            if (nextInput) {
                console.log('Input suivant trouvé, déplacement du focus...');
                
                // Mettre à jour les moyennes d'abord
                updateAveragesDisplay();
                
                // Utiliser un micro-délai pour garantir que le DOM est prêt
                setTimeout(() => {
                    nextInput.focus();
                    nextInput.select();
                    console.log('Focus déplacé vers:', nextInput.dataset.student);
                    console.log('Input actif:', document.activeElement === nextInput);
                }, 0);
            } else {
                console.log('Pas d\'input trouvé dans la cellule');
            }
        } else {
            console.log('Cellule suivante non trouvée');
        }
    }
}

// Fonction pour extraire le niveau d'une classe
function extractClassLevel(className) {
    if (!className) return '';
    
    const normalized = className.toUpperCase().trim();
    
    // Détecter les différents niveaux
    if (normalized.includes('4E') || normalized.includes('4È')) {
        return '4e';
    } else if (normalized.includes('3E') || normalized.includes('3È')) {
        return '3e';
    } else if (normalized.includes('2NDE') || normalized.includes('2DE')) {
        return '2nde';
    } else if (normalized.includes('TERMINALE') || normalized.includes('TLE')) {
        return 'Terminale';
    } else if (normalized.includes('1ERE') || normalized.includes('1ÈRE') || normalized.includes('1RE')) {
        return '1ere';
    } else if (normalized.includes('6E') || normalized.includes('6È')) {
        return '6e';
    } else if (normalized.includes('5E') || normalized.includes('5È')) {
        return '5e';
    }
    
    return '';
}

// Fonction pour remplir le sélecteur de copie d'évaluation
function populateCopyEvalSelect() {
    const currentClass = document.getElementById('class-select')?.value;
    if (!currentClass) return;
    
    const currentLevel = extractClassLevel(currentClass);
    if (!currentLevel) return;
    
    const copySelect = document.getElementById('copy-eval-select');
    if (!copySelect) return;
    
    // Réinitialiser les options
    copySelect.innerHTML = '<option value="">-- Créer une nouvelle évaluation --</option>';
    
    // Parcourir toutes les classes du même niveau
    let hasOptions = false;
    for (const className in evaluations) {
        if (className === currentClass) continue; // Ignorer la classe actuelle
        
        const classLevel = extractClassLevel(className);
        if (classLevel !== currentLevel) continue; // Ignorer les classes d'autres niveaux
        
        const classEvals = evaluations[className];
        if (!classEvals || classEvals.length === 0) continue;
        
        // Créer un optgroup pour cette classe
        const optgroup = document.createElement('optgroup');
        optgroup.label = className;
        
        // Ajouter les évaluations de cette classe
        classEvals.forEach((evaluation, index) => {
            const option = document.createElement('option');
            option.value = `${className}|${index}`;
            
            const date = new Date(evaluation.date).toLocaleDateString('fr-FR');
            option.textContent = `${evaluation.title} - ${evaluation.subject} (${date})`;
            
            optgroup.appendChild(option);
            hasOptions = true;
        });
        
        copySelect.appendChild(optgroup);
    }
    
    // Si aucune évaluation trouvée, désactiver le sélecteur
    if (!hasOptions) {
        copySelect.disabled = true;
        copySelect.title = 'Aucune évaluation disponible pour ce niveau';
    } else {
        copySelect.disabled = false;
        copySelect.title = 'Sélectionner une évaluation existante à dupliquer';
    }
}

// ===== IMPORT/EXPORT CSV =====
async function handleImportData() {
    if (!confirm('Importer les données ? Cela va remplacer les données actuelles en mémoire.')) {
        return;
    }
    
    try {
        const importedData = await window.dataManager.importAllData();
        
        // Mettre à jour les variables globales
        evaluations = importedData.evaluations || {};
        notes = importedData.notes || {};
        
        // Rafraîchir l'affichage
        if (currentClass) {
            renderEvaluations();
            renderNotesTable();
        }
        
        alert('✓ Données importées avec succès !');
        location.reload(); // Recharger pour tout actualiser
    } catch (error) {
        alert('❌ Erreur lors de l\'importation : ' + error.message);
    }
}

async function handleExportData() {
    try {
        window.dataManager.exportAllData();
        alert('✓ Données exportées avec succès !\n\nLe fichier JSON a été téléchargé.\nConservez-le précieusement pour le réutiliser sur un autre ordinateur.');
    } catch (error) {
        alert('❌ Erreur lors de l\'exportation : ' + error.message);
    }
}

// ===== SAUVEGARDE/RESTAURATION PORTABLE =====
function handleSavePortable() {
    const contenuFichier = `// Carnet de Notes - Données embarquées pour portabilité complète
// Ce fichier contient les évaluations et notes sauvegardées
// Remplacez le fichier js/carnet-notes-data.js par celui-ci pour restaurer vos données

const CARNET_NOTES_DATA = {
    evaluations: ${JSON.stringify(evaluations, null, 4)},
    notes: ${JSON.stringify(notes, null, 4)}
};

// Export pour utilisation dans carnet-notes.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CARNET_NOTES_DATA;
}
`;
    
    const blob = new Blob([contenuFichier], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'carnet-notes-data.js';
    a.click();
    URL.revokeObjectURL(url);
    
    const totalEvals = Object.values(evaluations).reduce((sum, evals) => sum + evals.length, 0);
    const totalClasses = Object.keys(evaluations).length;
    
    alert(`✅ Fichier carnet-notes-data.js téléchargé !

📊 Contenu sauvegardé :
• ${totalClasses} classe(s)
• ${totalEvals} évaluation(s)

💡 Pour portabilité complète :
Remplacez le fichier js/carnet-notes-data.js dans votre dossier eProf par ce fichier téléchargé.
Vos notes seront alors disponibles sur n'importe quel appareil avec le dossier eProf !`);
}

async function handleRestorePortable(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
        const texte = await file.text();
        
        // Extraire CARNET_NOTES_DATA du fichier
        const evalMatch = texte.match(/evaluations:\s*(\{[\s\S]*?\}),?\s*notes:/);
        const notesMatch = texte.match(/notes:\s*(\{[\s\S]*?\})\s*\}/);
        
        if (evalMatch && evalMatch[1] && notesMatch && notesMatch[1]) {
            const evaluationsImportees = JSON.parse(evalMatch[1]);
            const notesImportees = JSON.parse(notesMatch[1]);
            
            const totalEvals = Object.values(evaluationsImportees).reduce((sum, evals) => sum + evals.length, 0);
            const totalClasses = Object.keys(evaluationsImportees).length;
            
            if (confirm(`Restaurer les données ?\n\n📊 Contenu trouvé :\n• ${totalClasses} classe(s)\n• ${totalEvals} évaluation(s)\n\n⚠️ Cela remplacera toutes vos données actuelles.`)) {
                evaluations = evaluationsImportees;
                notes = notesImportees;
                
                // Sauvegarder dans localStorage
                saveData();
                
                // Rafraîchir l'affichage
                if (currentClass) {
                    renderEvaluations();
                    renderNotesTable();
                }
                
                alert(`✅ ${totalEvals} évaluation(s) restaurée(s) avec succès !

💡 Astuce : Pour que ces données soient toujours disponibles,
remplacez js/carnet-notes-data.js dans votre dossier eProf par ce fichier.`);
            }
        } else {
            alert('⚠️ Format de fichier invalide : impossible de trouver les données CARNET_NOTES_DATA.');
        }
    } catch (error) {
        console.error('Erreur restauration portable:', error);
        alert('❌ Erreur lors de la restauration du fichier.\nVérifiez que c\'est bien un fichier carnet-notes-data.js valide.');
    }
    
    e.target.value = '';
}

// ===== SYNCHRONISATION EN LIGNE (Supabase - table teacher_documents) =====
// Le carnet de notes est encore adossé à des classes identifiées par leur nom
// (pas encore de students/classes normalisés côté Supabase tant que les listes
// 2026-2027 ne sont pas importées) : on synchronise donc tout le document
// {evaluations, notes} en un seul bloc JSON, propre à chaque enseignant.

async function handleSaveCloud() {
    const ok = await sauvegarderCarnetEnLigne(false);
    if (!ok) return;
    const totalEvals = Object.values(evaluations).reduce((sum, evals) => sum + evals.length, 0);
    alert(`✅ Carnet de notes sauvegardé en ligne !\n\n📊 ${Object.keys(evaluations).length} classe(s), ${totalEvals} évaluation(s).`);
}

async function handleLoadCloud() {
    if (!window.EprofStore || !(await window.EprofStore.isOnlineReady())) {
        alert('☁️ Connectez-vous à votre compte eProf pour charger le carnet de notes depuis le cloud.');
        return;
    }

    const { data, error } = await window.EprofStore.getTeacherDocument(CARNET_DOC_TYPE);
    if (error) {
        alert('❌ Erreur lors du chargement en ligne : ' + error.message);
        return;
    }

    if (!data || !data.data) {
        alert('ℹ️ Aucune sauvegarde en ligne trouvée pour ce compte.');
        return;
    }

    appliquerCarnetDistant(data.data);
    alert('✅ Carnet de notes chargé depuis le cloud !');
}

document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && !hasUnsavedCloudChanges) {
        hydraterCarnetDepuisCloud();
    }
});

// ===== TOGGLE LISTE DES ÉVALUATIONS =====
function toggleEvaluationsList() {
    const evalsList = document.getElementById('evaluations-list');
    const toggleBtn = document.getElementById('toggle-evals-btn');
    
    if (!evalsList || !toggleBtn) return;
    
    const isCollapsed = evalsList.classList.contains('collapsed');
    
    if (isCollapsed) {
        // Afficher
        evalsList.classList.remove('collapsed');
        toggleBtn.classList.remove('collapsed');
        toggleBtn.innerHTML = '<span class="toggle-icon">▼</span> Réduire';
    } else {
        // Masquer
        evalsList.classList.add('collapsed');
        toggleBtn.classList.add('collapsed');
        toggleBtn.innerHTML = '<span class="toggle-icon">▼</span> Agrandir';
    }
}

// Initialiser le texte du bouton au chargement
function initToggleButton() {
    const toggleBtn = document.getElementById('toggle-evals-btn');
    const evalsList = document.getElementById('evaluations-list');
    
    if (toggleBtn && evalsList && evalsList.classList.contains('collapsed')) {
        toggleBtn.classList.add('collapsed');
        toggleBtn.innerHTML = '<span class="toggle-icon">▼</span> Agrandir';
    }
}

// ===== NORMALISATION DES PÉRIODES =====
function normalizePeriod(period) {
    if (!period) return null;
    
    // Normaliser en majuscules et retirer les espaces
    const normalized = period.toString().toLowerCase().trim();
    
    // Mapper les différents formats vers le format standard
    const periodMap = {
        'trimestre1': 'T1',
        'trimestre2': 'T2',
        'trimestre3': 'T3',
        'semestre1': 'S1',
        'semestre2': 'S2',
        't1': 'T1',
        't2': 'T2',
        't3': 'T3',
        's1': 'S1',
        's2': 'S2'
    };
    
    return periodMap[normalized] || period.toUpperCase();
}

// ===== STATISTIQUES ÉLÈVE =====
let currentStatsChart = null;
let currentStatsRadarChart = null;
let currentEvolutionChart = null;
let currentStatsStudentName = null;
let currentStatsPeriod = 'all';

function openStudentStats(studentName) {
    const modal = document.getElementById('student-stats-modal');
    const title = document.getElementById('student-stats-title');
    
    if (!modal || !title) return;
    
    currentStatsStudentName = studentName;
    currentStatsPeriod = 'all';
    
    title.textContent = `📊 Statistiques - ${studentName}`;
    modal.style.display = 'block';
    
    // Générer les boutons de période
    setupStatsPeriodButtons();
    
    // Calculer les statistiques
    refreshStudentStats();
    
    // Gérer les onglets
    setupStatsTabs();
}

function setupStatsPeriodButtons() {
    const container = document.getElementById('stats-period-buttons');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Bouton "Année complète"
    const btnAll = document.createElement('button');
    btnAll.className = 'period-filter-btn active';
    btnAll.textContent = '📚 Année complète';
    btnAll.dataset.period = 'all';
    btnAll.onclick = () => selectStatsPeriod('all');
    container.appendChild(btnAll);
    
    // Déterminer les périodes selon la classe
    const classData = getStudentsForClass(currentClass);
    if (classData && classData.length > 0) {
        const firstStudent = classData[0];
        const isPro = firstStudent.classe && (firstStudent.classe.includes('Bac Pro') || firstStudent.classe.includes('CAP'));
        
        if (isPro) {
            // Semestres pour Bac Pro/CAP
            ['S1', 'S2'].forEach(sem => {
                const btn = document.createElement('button');
                btn.className = 'period-filter-btn';
                btn.textContent = sem === 'S1' ? '📖 Semestre 1' : '📖 Semestre 2';
                btn.dataset.period = sem;
                btn.onclick = () => selectStatsPeriod(sem);
                container.appendChild(btn);
            });
        } else {
            // Trimestres pour collège/général
            ['T1', 'T2', 'T3'].forEach(trim => {
                const btn = document.createElement('button');
                btn.className = 'period-filter-btn';
                const labels = { T1: '📗 Trimestre 1', T2: '📘 Trimestre 2', T3: '📙 Trimestre 3' };
                btn.textContent = labels[trim];
                btn.dataset.period = trim;
                btn.onclick = () => selectStatsPeriod(trim);
                container.appendChild(btn);
            });
        }
    }
}

function selectStatsPeriod(period) {
    currentStatsPeriod = period;
    
    // Mettre à jour les boutons actifs
    const buttons = document.querySelectorAll('.period-filter-btn');
    buttons.forEach(btn => {
        if (btn.dataset.period === period) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Recalculer et afficher les stats
    refreshStudentStats();
}

function refreshStudentStats() {
    // Détruire les graphiques existants avant de recalculer
    if (currentStatsChart) {
        currentStatsChart.destroy();
        currentStatsChart = null;
    }
    if (currentEvolutionChart) {
        currentEvolutionChart.destroy();
        currentEvolutionChart = null;
    }
    
    const stats = calculateStudentStats(currentStatsStudentName, currentStatsPeriod);
    fillStudentStats(stats, currentStatsStudentName);
}

function setupStatsTabs() {
    const tabs = document.querySelectorAll('.stats-tab');
    const contents = document.querySelectorAll('.stats-tab-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Désactiver tous les onglets
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            
            // Activer l'onglet cliqué
            tab.classList.add('active');
            const tabId = tab.dataset.tab;
            document.getElementById(`tab-${tabId}`).classList.add('active');
        });
    });
    
    // Fermeture du modal
    const closeBtn = document.querySelector('.close-student-stats');
    if (closeBtn) {
        closeBtn.onclick = () => {
            document.getElementById('student-stats-modal').style.display = 'none';
            // Détruire les graphiques
            if (currentStatsChart) {
                currentStatsChart.destroy();
                currentStatsChart = null;
            }
            if (currentStatsRadarChart) {
                currentStatsRadarChart.destroy();
                currentStatsRadarChart = null;
            }
            if (currentEvolutionChart) {
                currentEvolutionChart.destroy();
                currentEvolutionChart = null;
            }
        };
    }
    
    // Fermer en cliquant à l'extérieur
    window.onclick = (e) => {
        const modal = document.getElementById('student-stats-modal');
        if (e.target === modal) {
            modal.style.display = 'none';
            if (currentStatsChart) currentStatsChart.destroy();
            if (currentEvolutionChart) currentEvolutionChart.destroy();
        }
    };
}

function calculateStudentStats(studentName, period = 'all') {
    let evals = (evaluations[currentClass] || []).filter(compteDansMoyennes);
    
    console.log('═══════════════════════════════');
    console.log('Calcul stats pour:', studentName);
    console.log('Période sélectionnée:', period);
    console.log('Évaluations totales:', evals.length);
    
    // Debug: afficher toutes les périodes disponibles
    if (evals.length > 0) {
        console.log('Périodes des évaluations:', evals.map(e => `${e.title}: ${e.period}`).join(', '));
    }
    
    // Filtrer par période si nécessaire
    if (period !== 'all') {
        const evalsAvantFiltre = evals.length;
        const normalizedTargetPeriod = normalizePeriod(period);
        console.log('Période cible normalisée:', normalizedTargetPeriod);
        
        evals = evals.filter(e => {
            const normalizedEvalPeriod = normalizePeriod(e.period);
            const match = normalizedEvalPeriod === normalizedTargetPeriod;
            if (!match) {
                console.log(`Éval "${e.title}" exclue (période: ${e.period} [${normalizedEvalPeriod}] !== ${normalizedTargetPeriod})`);
            } else {
                console.log(`Éval "${e.title}" INCLUSE (période: ${e.period} [${normalizedEvalPeriod}] === ${normalizedTargetPeriod})`);
            }
            return match;
        });
        console.log(`Filtrage ${period}: ${evalsAvantFiltre} → ${evals.length} évaluations`);
    }
    
    const studentNotes = notes[currentClass]?.[studentName] || {};
    console.log('Notes de l\'élève:', Object.keys(studentNotes).length, 'évaluations notées');
    
    const statsBySubject = {};
    let allNotes = [];
    let totalPoints = 0;
    let totalMaxPoints = 0;
    
    evals.forEach(eval => {
        const note = studentNotes[eval.id];
        
        if (note !== undefined && note !== '' && note !== 'abs') {
            const noteNum = parseFloat(note);
            const maxPoints = parseFloat(eval.maxPoints);
            const coef = parseFloat(eval.coefficient);
            
            // Note sur 20
            const noteSur20 = (noteNum / maxPoints) * 20;
            
            allNotes.push({
                note: noteNum,
                noteSur20: noteSur20,
                max: maxPoints,
                eval: eval,
                coef: coef
            });
            
            // Par matière
            if (!statsBySubject[eval.subject]) {
                statsBySubject[eval.subject] = {
                    notes: [],
                    totalPoints: 0,
                    totalMaxPoints: 0,
                    count: 0
                };
            }
            
            statsBySubject[eval.subject].notes.push({
                note: noteNum,
                noteSur20: noteSur20,
                max: maxPoints,
                eval: eval
            });
            statsBySubject[eval.subject].totalPoints += noteSur20 * coef;
            statsBySubject[eval.subject].totalMaxPoints += 20 * coef;
            statsBySubject[eval.subject].count++;
            
            totalPoints += noteSur20 * coef;
            totalMaxPoints += 20 * coef;
        }
    });
    
    // Calculer les moyennes
    const moyenneGenerale = totalMaxPoints > 0 ? (totalPoints / totalMaxPoints) * 20 : 0;
    
    const moyennesParMatiere = {};
    Object.keys(statsBySubject).forEach(subject => {
        const subjectStats = statsBySubject[subject];
        moyennesParMatiere[subject] = subjectStats.totalMaxPoints > 0
            ? (subjectStats.totalPoints / subjectStats.totalMaxPoints) * 20
            : 0;
    });
    
    // Notes min/max
    const notesSur20 = allNotes.map(n => n.noteSur20);
    const meilleureNote = notesSur20.length > 0 ? Math.max(...notesSur20) : 0;
    const noteMinimale = notesSur20.length > 0 ? Math.min(...notesSur20) : 0;
    
    return {
        moyenneGenerale,
        moyennesParMatiere,
        statsBySubject,
        meilleureNote,
        noteMinimale,
        nombreEvaluations: allNotes.length,
        allNotes
    };
}

function fillStudentStats(stats, studentName) {
    // Vue d'ensemble - Cartes statistiques
    document.getElementById('stat-moyenne-generale').innerHTML = 
        `${stats.moyenneGenerale.toFixed(2)}<small>/20</small>`;
    
    document.getElementById('stat-meilleure-note').innerHTML = 
        `${stats.meilleureNote.toFixed(2)}<small>/20</small>`;
    
    document.getElementById('stat-note-basse').innerHTML = 
        `${stats.noteMinimale.toFixed(2)}<small>/20</small>`;
    
    document.getElementById('stat-nb-evals').innerHTML = stats.nombreEvaluations;
    
    // Graphique des moyennes par matière
    renderMoyennesChart(stats.moyennesParMatiere);
    renderRadarMatieresChart('chart-radar-matieres', stats.moyennesParMatiere, 'student');
    
    // Onglet Détails
    renderDetailsParMatiere(stats.statsBySubject);
    
    // Graphique d'évolution
    renderEvolutionChart(stats.allNotes);
}

function renderMoyennesChart(moyennesParMatiere) {
    const ctx = document.getElementById('chart-moyennes-matieres');
    if (!ctx) return;
    
    // Détruire le graphique existant
    if (currentStatsChart) {
        currentStatsChart.destroy();
    }
    
    const matieres = Object.keys(moyennesParMatiere);
    const moyennes = Object.values(moyennesParMatiere);
    
    const colors = [
        'rgba(102, 126, 234, 0.8)',
        'rgba(118, 75, 162, 0.8)',
        'rgba(237, 100, 166, 0.8)',
        'rgba(255, 154, 158, 0.8)',
        'rgba(52, 211, 153, 0.8)',
        'rgba(251, 146, 60, 0.8)'
    ];
    
    // Assigner une couleur à chaque matière
    const backgroundColors = matieres.map((_, i) => colors[i % colors.length]);
    const borderColors = backgroundColors.map(c => c.replace('0.8', '1'));
    
    const palette = carnetChartColors();
    currentStatsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: matieres,
            datasets: [{
                label: 'Moyenne (/20)',
                data: moyennes,
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 2,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: 'Moyennes par matière',
                    color: palette.text,
                    font: {
                        size: 16,
                        weight: 'bold'
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 20,
                    ticks: {
                        stepSize: 5,
                        color: palette.muted
                    },
                    grid: {
                        color: palette.grid
                    }
                },
                x: {
                    ticks: { color: palette.text },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

function renderRadarMatieresChart(canvasId, moyennesParMatiere, kind) {
    const ctx = document.getElementById(canvasId);
    if (!ctx || typeof Chart === 'undefined') return;
    const matieres = Object.keys(moyennesParMatiere || {});
    const valeurs = matieres.map(function (m) { return Number(moyennesParMatiere[m]) || 0; });
    if (kind === 'student') {
        if (currentStatsRadarChart) { currentStatsRadarChart.destroy(); currentStatsRadarChart = null; }
    } else {
        if (currentClassRadarChart) { currentClassRadarChart.destroy(); currentClassRadarChart = null; }
    }
    if (!matieres.length) return;
    const chart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: matieres,
            datasets: [{
                label: kind === 'student' ? 'Moyenne élève (/20)' : 'Moyenne classe (/20)',
                data: valeurs,
                backgroundColor: kind === 'student' ? 'rgba(102, 126, 234, 0.25)' : 'rgba(16, 185, 129, 0.25)',
                borderColor: kind === 'student' ? 'rgba(102, 126, 234, 1)' : 'rgba(16, 185, 129, 1)',
                borderWidth: 2,
                pointBackgroundColor: kind === 'student' ? '#667eea' : '#10b981',
                pointBorderColor: carnetChartColors().pointBorder,
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                r: carnetRadarScaleOptions()
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
    if (kind === 'student') currentStatsRadarChart = chart;
    else currentClassRadarChart = chart;
}

// Initialiser le texte du bouton au chargement
function initToggleButton() {
    const toggleBtn = document.getElementById('toggle-evals-btn');
    const evalsList = document.getElementById('evaluations-list');
    
    if (toggleBtn && evalsList && evalsList.classList.contains('collapsed')) {
        toggleBtn.classList.add('collapsed');
        toggleBtn.innerHTML = '<span class="toggle-icon">▼</span> Agrandir';
    }
}

// ===== STATISTIQUES DE LA CLASSE =====
let currentClassStatsChart = null;
let currentClassRadarChart = null;
let currentClassEvolutionChart = null;
let currentClassDistributionChart = null;
let currentClassStatsPeriod = 'all';

function openClassStats() {
    const modal = document.getElementById('class-stats-modal');
    const title = document.getElementById('class-stats-title');
    
    if (!modal || !title || !currentClass) return;
    
    currentClassStatsPeriod = 'all';
    
    title.textContent = `📊 Statistiques - ${currentClass}`;
    modal.style.display = 'block';
    
    // Générer les boutons de période
    setupClassStatsPeriodButtons();
    
    // Calculer et afficher les statistiques
    refreshClassStats();
    
    // Gérer les onglets
    setupClassStatsTabs();
}

function setupClassStatsPeriodButtons() {
    const container = document.getElementById('class-stats-period-buttons');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Bouton "Année complète"
    const btnAll = document.createElement('button');
    btnAll.className = 'period-filter-btn active';
    btnAll.textContent = '📚 Année complète';
    btnAll.dataset.period = 'all';
    btnAll.onclick = () => selectClassStatsPeriod('all');
    container.appendChild(btnAll);
    
    // Déterminer les périodes selon la classe
    const classData = getStudentsForClass(currentClass);
    if (classData && classData.length > 0) {
        const firstStudent = classData[0];
        const isPro = firstStudent.classe && (firstStudent.classe.includes('Bac Pro') || firstStudent.classe.includes('CAP'));
        
        if (isPro) {
            ['S1', 'S2'].forEach(sem => {
                const btn = document.createElement('button');
                btn.className = 'period-filter-btn';
                btn.textContent = sem === 'S1' ? '📖 Semestre 1' : '📖 Semestre 2';
                btn.dataset.period = sem;
                btn.onclick = () => selectClassStatsPeriod(sem);
                container.appendChild(btn);
            });
        } else {
            ['T1', 'T2', 'T3'].forEach(trim => {
                const btn = document.createElement('button');
                btn.className = 'period-filter-btn';
                const labels = { T1: '📗 Trimestre 1', T2: '📘 Trimestre 2', T3: '📙 Trimestre 3' };
                btn.textContent = labels[trim];
                btn.dataset.period = trim;
                btn.onclick = () => selectClassStatsPeriod(trim);
                container.appendChild(btn);
            });
        }
    }
}

function selectClassStatsPeriod(period) {
    currentClassStatsPeriod = period;
    
    const buttons = document.querySelectorAll('#class-stats-period-buttons .period-filter-btn');
    buttons.forEach(btn => {
        if (btn.dataset.period === period) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    refreshClassStats();
}

function refreshClassStats() {
    if (currentClassStatsChart) {
        currentClassStatsChart.destroy();
        currentClassStatsChart = null;
    }
    if (currentClassEvolutionChart) {
        currentClassEvolutionChart.destroy();
        currentClassEvolutionChart = null;
    }
    if (currentClassDistributionChart) {
        currentClassDistributionChart.destroy();
        currentClassDistributionChart = null;
    }
    
    const stats = calculateClassStats(currentClassStatsPeriod);
    fillClassStats(stats);
}

function setupClassStatsTabs() {
    const tabs = document.querySelectorAll('#class-stats-modal .stats-tab');
    const contents = document.querySelectorAll('#class-stats-modal .stats-tab-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            
            tab.classList.add('active');
            const tabId = tab.dataset.tab;
            document.getElementById(`tab-class-${tabId}`).classList.add('active');
        });
    });
    
    const closeBtn = document.querySelector('.close-class-stats');
    if (closeBtn) {
        closeBtn.onclick = () => {
            document.getElementById('class-stats-modal').style.display = 'none';
            if (currentClassStatsChart) currentClassStatsChart.destroy();
            if (currentClassEvolutionChart) currentClassEvolutionChart.destroy();
            if (currentClassDistributionChart) currentClassDistributionChart.destroy();
        };
    }
    
    window.onclick = (e) => {
        const modal = document.getElementById('class-stats-modal');
        if (e.target === modal) {
            modal.style.display = 'none';
            if (currentClassStatsChart) currentClassStatsChart.destroy();
            if (currentClassEvolutionChart) currentClassEvolutionChart.destroy();
            if (currentClassDistributionChart) currentClassDistributionChart.destroy();
        }
    };
}

function calculateClassStats(period = 'all') {
    let evals = (evaluations[currentClass] || []).filter(compteDansMoyennes);
    const students = getStudentsForClass(currentClass);
    
    if (period !== 'all') {
        const normalizedTargetPeriod = normalizePeriod(period);
        evals = evals.filter(e => normalizePeriod(e.period) === normalizedTargetPeriod);
    }
    
    const statsBySubject = {};
    const allStudentAverages = [];
    const evolutionData = [];
    const distributionData = [];
    
    // Calculer les stats par matière
    evals.forEach(eval => {
        if (!statsBySubject[eval.subject]) {
            statsBySubject[eval.subject] = {
                totalPoints: 0,
                totalMaxPoints: 0,
                evals: [],
                count: 0
            };
        }
        
        const evalAvg = calculateEvalAverage(eval.id, students);
        if (evalAvg !== null) {
            statsBySubject[eval.subject].evals.push({ eval, avg: evalAvg });
            statsBySubject[eval.subject].totalPoints += evalAvg * eval.coefficient;
            statsBySubject[eval.subject].totalMaxPoints += 20 * eval.coefficient;
            statsBySubject[eval.subject].count++;
            
            evolutionData.push({
                date: eval.date,
                title: eval.title,
                subject: eval.subject,
                avg: evalAvg
            });
        }
    });
    
    // Calculer les moyennes par élève
    students.forEach(student => {
        const studentName = student.prenom + ' ' + student.nom;
        const studentStats = calculateStudentStats(studentName, period);
        if (studentStats.nombreEvaluations > 0) {
            allStudentAverages.push({
                name: studentName,
                average: studentStats.moyenneGenerale
            });
            
            // Pour la distribution
            const avg = Math.round(studentStats.moyenneGenerale);
            distributionData.push(avg);
        }
    });
    
    // Moyennes par matière
    const moyennesParMatiere = {};
    Object.keys(statsBySubject).forEach(subject => {
        const subjectData = statsBySubject[subject];
        moyennesParMatiere[subject] = subjectData.totalMaxPoints > 0
            ? (subjectData.totalPoints / subjectData.totalMaxPoints) * 20
            : 0;
    });
    
    // Moyenne générale de la classe
    const moyenneGenerale = allStudentAverages.length > 0
        ? allStudentAverages.reduce((sum, s) => sum + s.average, 0) / allStudentAverages.length
        : 0;
    
    const meilleureMoyenne = allStudentAverages.length > 0
        ? Math.max(...allStudentAverages.map(s => s.average))
        : 0;
    
    return {
        moyenneGenerale,
        meilleureMoyenne,
        nombreEleves: students.length,
        nombreEvaluations: evals.length,
        moyennesParMatiere,
        statsBySubject,
        evolutionData: evolutionData.sort((a, b) => new Date(a.date) - new Date(b.date)),
        distributionData
    };
}

function fillClassStats(stats) {
    document.getElementById('class-stat-moyenne-generale').innerHTML = 
        `${stats.moyenneGenerale.toFixed(2)}<small>/20</small>`;
    
    document.getElementById('class-stat-meilleure-moyenne').innerHTML = 
        `${stats.meilleureMoyenne.toFixed(2)}<small>/20</small>`;
    
    document.getElementById('class-stat-nb-eleves').innerHTML = stats.nombreEleves;
    
    document.getElementById('class-stat-nb-evals').innerHTML = stats.nombreEvaluations;
    
    renderClassMoyennesChart(stats.moyennesParMatiere);
    renderRadarMatieresChart('chart-class-radar-matieres', stats.moyennesParMatiere, 'class');
    renderClassDetailsParMatiere(stats.statsBySubject);
    renderClassEvolutionChart(stats.evolutionData);
    renderClassDistributionChart(stats.distributionData);
}

function renderClassMoyennesChart(moyennesParMatiere) {
    const ctx = document.getElementById('chart-class-moyennes-matieres');
    if (!ctx) return;
    
    if (currentClassStatsChart) currentClassStatsChart.destroy();
    
    const matieres = Object.keys(moyennesParMatiere);
    const moyennes = Object.values(moyennesParMatiere);
    
    const colors = [
        'rgba(16, 185, 129, 0.8)',
        'rgba(59, 130, 246, 0.8)',
        'rgba(249, 115, 22, 0.8)',
        'rgba(168, 85, 247, 0.8)',
        'rgba(236, 72, 153, 0.8)',
        'rgba(234, 179, 8, 0.8)'
    ];
    
    const backgroundColors = matieres.map((_, i) => colors[i % colors.length]);
    const borderColors = backgroundColors.map(c => c.replace('0.8', '1'));
    
    const palette = carnetChartColors();
    currentClassStatsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: matieres,
            datasets: [{
                label: 'Moyenne de classe (/20)',
                data: moyennes,
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 2,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                title: {
                    display: true,
                    text: 'Moyennes par matière',
                    color: palette.text,
                    font: { size: 16, weight: 'bold' }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 20,
                    ticks: { stepSize: 5, color: palette.muted },
                    grid: { color: palette.grid }
                },
                x: { ticks: { color: palette.text }, grid: { display: false } }
            }
        }
    });
}

function renderClassDetailsParMatiere(statsBySubject) {
    const container = document.getElementById('class-details-par-matiere');
    if (!container) return;
    
    container.innerHTML = '';
    
    Object.keys(statsBySubject).forEach(subject => {
        const subjectData = statsBySubject[subject];
        const moyenne = subjectData.totalMaxPoints > 0
            ? (subjectData.totalPoints / subjectData.totalMaxPoints) * 20
            : 0;
        
        const div = document.createElement('div');
        div.className = 'matiere-detail';
        
        let html = `
            <h4>${subject}</h4>
            <div class="matiere-stats">
                <div class="mini-stat">
                    <div class="mini-stat-label">Moyenne</div>
                    <div class="mini-stat-value">${moyenne.toFixed(2)}</div>
                </div>
                <div class="mini-stat">
                    <div class="mini-stat-label">Évaluations</div>
                    <div class="mini-stat-value">${subjectData.count}</div>
                </div>
            </div>
            <div class="notes-list">
                <h5>📋 Évaluations</h5>
                <div class="notes-list-items">
        `;
        
        subjectData.evals.sort((a, b) => new Date(a.eval.date) - new Date(b.eval.date)).forEach(item => {
            const date = new Date(item.eval.date).toLocaleDateString('fr-FR');
            html += `
                <div class="note-item">
                    <div>
                        <span class="note-item-title">${item.eval.title}</span>
                        <span class="note-item-date">${date}</span>
                    </div>
                    <span class="note-item-score">${item.avg.toFixed(2)}/20</span>
                </div>
            `;
        });
        
        html += `</div></div>`;
        div.innerHTML = html;
        container.appendChild(div);
    });
}

function renderClassEvolutionChart(evolutionData) {
    const ctx = document.getElementById('chart-class-evolution');
    if (!ctx) return;
    
    if (currentClassEvolutionChart) currentClassEvolutionChart.destroy();
    
    const labels = evolutionData.map(d => {
        const date = new Date(d.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
        return `${d.title}\n${date}`;
    });
    
    const data = evolutionData.map(d => d.avg);
    
    const palette = carnetChartColors();
    currentClassEvolutionChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Moyenne de classe (/20)',
                data: data,
                borderColor: 'rgba(16, 185, 129, 1)',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 6,
                pointHoverRadius: 8,
                pointBackgroundColor: 'rgba(16, 185, 129, 1)',
                pointBorderColor: palette.pointBorder,
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                title: {
                    display: true,
                    text: 'Évolution des moyennes dans le temps',
                    color: palette.text,
                    font: { size: 16, weight: 'bold' }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 20,
                    ticks: { stepSize: 5, color: palette.muted },
                    grid: { color: palette.grid }
                },
                x: { ticks: { color: palette.muted }, grid: { display: false } }
            }
        }
    });
}

function renderClassDistributionChart(distributionData) {
    const ctx = document.getElementById('chart-class-distribution');
    if (!ctx) return;
    
    if (currentClassDistributionChart) currentClassDistributionChart.destroy();
    
    // Créer des tranches de notes
    const tranches = {
        '0-5': 0,
        '5-8': 0,
        '8-10': 0,
        '10-12': 0,
        '12-14': 0,
        '14-16': 0,
        '16-18': 0,
        '18-20': 0
    };
    
    distributionData.forEach(note => {
        if (note < 5) tranches['0-5']++;
        else if (note < 8) tranches['5-8']++;
        else if (note < 10) tranches['8-10']++;
        else if (note < 12) tranches['10-12']++;
        else if (note < 14) tranches['12-14']++;
        else if (note < 16) tranches['14-16']++;
        else if (note < 18) tranches['16-18']++;
        else tranches['18-20']++;
    });
    
    currentClassDistributionChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(tranches),
            datasets: [{
                label: 'Nombre d\'élèves',
                data: Object.values(tranches),
                backgroundColor: [
                    'rgba(239, 68, 68, 0.8)',
                    'rgba(251, 146, 60, 0.8)',
                    'rgba(250, 204, 21, 0.8)',
                    'rgba(163, 230, 53, 0.8)',
                    'rgba(34, 197, 94, 0.8)',
                    'rgba(14, 165, 233, 0.8)',
                    'rgba(99, 102, 241, 0.8)',
                    'rgba(168, 85, 247, 0.8)'
                ],
                borderWidth: 2,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                title: {
                    display: true,
                    text: 'Distribution des moyennes',
                    color: carnetChartColors().text,
                    font: { size: 16, weight: 'bold' }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1, color: carnetChartColors().muted },
                    grid: { color: carnetChartColors().grid }
                },
                x: { ticks: { color: carnetChartColors().muted }, grid: { display: false } }
            }
        }
    });
}

function renderDetailsParMatiere(statsBySubject) {
    const container = document.getElementById('details-par-matiere');
    if (!container) return;
    
    container.innerHTML = '';
    
    Object.keys(statsBySubject).forEach(subject => {
        const subjectData = statsBySubject[subject];
        const moyenne = subjectData.totalMaxPoints > 0
            ? (subjectData.totalPoints / subjectData.totalMaxPoints) * 20
            : 0;
        
        const notesSur20 = subjectData.notes.map(n => n.noteSur20);
        const max = Math.max(...notesSur20);
        const min = Math.min(...notesSur20);
        
        const div = document.createElement('div');
        div.className = 'matiere-detail';
        
        let html = `
            <h4>${subject}</h4>
            <div class="matiere-stats">
                <div class="mini-stat">
                    <div class="mini-stat-label">Moyenne</div>
                    <div class="mini-stat-value">${moyenne.toFixed(2)}</div>
                </div>
                <div class="mini-stat">
                    <div class="mini-stat-label">Meilleure</div>
                    <div class="mini-stat-value">${max.toFixed(2)}</div>
                </div>
                <div class="mini-stat">
                    <div class="mini-stat-label">Plus basse</div>
                    <div class="mini-stat-value">${min.toFixed(2)}</div>
                </div>
                <div class="mini-stat">
                    <div class="mini-stat-label">Nombre</div>
                    <div class="mini-stat-value">${subjectData.count}</div>
                </div>
            </div>
            <div class="notes-list">
                <h5>📋 Détail des évaluations</h5>
                <div class="notes-list-items">
        `;
        
        // Trier par date
        const notesSorted = [...subjectData.notes].sort((a, b) => 
            new Date(a.eval.date) - new Date(b.eval.date)
        );
        
        notesSorted.forEach(n => {
            const noteSur20 = n.noteSur20.toFixed(2);
            const date = new Date(n.eval.date).toLocaleDateString('fr-FR');
            html += `
                <div class="note-item">
                    <div>
                        <span class="note-item-title">${n.eval.title}</span>
                        <span class="note-item-date">${date}</span>
                    </div>
                    <span class="note-item-score">${noteSur20}/20</span>
                </div>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
        
        div.innerHTML = html;
        container.appendChild(div);
    });
}

function renderEvolutionChart(allNotes) {
    const ctx = document.getElementById('chart-evolution');
    if (!ctx) return;
    
    // Détruire le graphique existant
    if (currentEvolutionChart) {
        currentEvolutionChart.destroy();
    }
    
    // Trier par date
    const notesSorted = [...allNotes].sort((a, b) => 
        new Date(a.eval.date) - new Date(b.eval.date)
    );
    
    const labels = notesSorted.map(n => {
        const date = new Date(n.eval.date).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: 'short'
        });
        return `${n.eval.title}\n${date}`;
    });
    
    const data = notesSorted.map(n => n.noteSur20);
    
    const palette = carnetChartColors();
    currentEvolutionChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Note (/20)',
                data: data,
                borderColor: 'rgba(102, 126, 234, 1)',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 6,
                pointHoverRadius: 8,
                pointBackgroundColor: 'rgba(102, 126, 234, 1)',
                pointBorderColor: palette.pointBorder,
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: 'Évolution des notes dans le temps',
                    color: palette.text,
                    font: {
                        size: 16,
                        weight: 'bold'
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 20,
                    ticks: {
                        stepSize: 5,
                        color: palette.muted
                    },
                    grid: {
                        color: palette.grid
                    }
                },
                x: {
                    ticks: { color: palette.muted },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}