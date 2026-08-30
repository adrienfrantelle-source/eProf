// ===== GESTION GLOBALE DES ENSEIGNANTS =====
const DEFAULT_SUBJECT_CATALOG = [
    'Histoire', 'Géographie', 'TIM', 'EMC', 'MP9-10', 'MP5-10 HG', 'MP8',
    'Lettres', 'Mathématiques', 'Animation', 'Physique-Chimie', 'Biologie Ecologie',
    'SESG', 'Anglais', 'ESC', 'EPS', 'ESF', 'EIE PFMP', 'EIE', 'Nutrition', 'Cadre de vie'
];

class TeacherManager {
    constructor() {
        this.currentTeacher = null;
        this.teacherConfig = {};
        this.init();
    }

    async init() {
        this.wireAuthGateForm();

        const session = window.EprofStore ? await window.EprofStore.getSession() : null;
        if (session && session.user && session.user.email) {
            this.hideAuthGate();
            await this.login(session.user.email.split('@')[0]);
        } else {
            this.showAuthGate();
        }

        if (window.eprofAuth) {
            window.eprofAuth.onAuthStateChange((event) => {
                if (event === 'SIGNED_OUT') {
                    this.currentTeacher = null;
                    this.showAuthGate();
                }
            });
        }
    }

    // ===== Porte de connexion (Supabase Auth) =====
    showAuthGate() {
        const gate = document.getElementById('eprof-auth-gate');
        if (gate) gate.style.display = 'flex';
    }

    hideAuthGate() {
        const gate = document.getElementById('eprof-auth-gate');
        if (gate) gate.style.display = 'none';
    }

    wireAuthGateForm() {
        const form = document.getElementById('eprof-auth-form');
        if (!form) return;

        const toggleLink = document.getElementById('eprof-auth-toggle-mode');
        const title = document.getElementById('eprof-auth-title');
        const subtitle = document.getElementById('eprof-auth-subtitle');
        const confirmWrap = document.getElementById('eprof-auth-confirm-wrap');
        const submitBtn = document.getElementById('eprof-auth-submit');
        const errorBox = document.getElementById('eprof-auth-error');

        let mode = 'login';

        const applyMode = () => {
            if (errorBox) errorBox.style.display = 'none';
            if (mode === 'signup') {
                if (title) title.textContent = 'Créer mon compte';
                if (subtitle) subtitle.textContent = 'Première connexion : choisissez votre mot de passe';
                if (confirmWrap) confirmWrap.style.display = 'block';
                if (submitBtn) submitBtn.textContent = 'Créer mon compte';
                if (toggleLink) toggleLink.textContent = 'Déjà un compte ? Se connecter';
            } else {
                if (title) title.textContent = 'Connexion';
                if (subtitle) subtitle.textContent = 'Accédez à votre espace eProf';
                if (confirmWrap) confirmWrap.style.display = 'none';
                if (submitBtn) submitBtn.textContent = 'Se connecter';
                if (toggleLink) toggleLink.textContent = 'Pas encore de compte ? Créer mon compte';
            }
        };

        if (toggleLink) {
            toggleLink.addEventListener('click', (e) => {
                e.preventDefault();
                mode = mode === 'login' ? 'signup' : 'login';
                applyMode();
            });
        }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const idInput = document.getElementById('eprof-auth-id');
            const pwdInput = document.getElementById('eprof-auth-password');
            const pwdConfirmInput = document.getElementById('eprof-auth-password-confirm');
            if (errorBox) errorBox.style.display = 'none';

            const identifiant = idInput.value.trim().toLowerCase();
            const password = pwdInput.value;
            if (!identifiant || !password) return;

            const showError = (message) => {
                if (!errorBox) return;
                errorBox.textContent = '❌ ' + message;
                errorBox.style.display = 'block';
            };

            if (!window.eprofAuth) {
                showError('Service de connexion indisponible pour le moment.');
                return;
            }
            const email = `${identifiant}@jeannedelanoue.com`;

            if (mode === 'signup') {
                if (password.length < 8) {
                    showError('Le mot de passe doit contenir au moins 8 caractères.');
                    return;
                }
                if (password !== (pwdConfirmInput ? pwdConfirmInput.value : '')) {
                    showError('Les deux mots de passe ne correspondent pas.');
                    return;
                }

                submitBtn.disabled = true;
                submitBtn.textContent = 'Création...';
                try {
                    const disponible = await window.eprofAuth.isIdentifiantAvailable(identifiant);
                    if (!disponible) {
                        throw new Error(`L'identifiant "${identifiant}" n'est pas autorisé ou a déjà été utilisé. Contactez l'administration.`);
                    }

                    const { data, error } = await window.eprofAuth.signUp(email, password);
                    if (error) throw error;

                    pwdInput.value = '';
                    if (pwdConfirmInput) pwdConfirmInput.value = '';

                    if (data && data.session) {
                        this.hideAuthGate();
                        await this.login(identifiant);
                    } else {
                        showError('Compte créé. Reconnectez-vous avec votre identifiant et mot de passe.');
                        mode = 'login';
                        applyMode();
                    }
                } catch (err) {
                    showError((err && err.message) || 'Création de compte impossible.');
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.textContent = mode === 'signup' ? 'Créer mon compte' : 'Se connecter';
                }
                return;
            }

            submitBtn.disabled = true;
            submitBtn.textContent = 'Connexion...';
            try {
                const { error } = await window.eprofAuth.signIn(email, password);
                if (error) throw error;

                pwdInput.value = '';
                this.hideAuthGate();
                await this.login(identifiant);
            } catch (err) {
                const message = err && err.message === 'Invalid login credentials'
                    ? 'Identifiant ou mot de passe incorrect.'
                    : (err && err.message) || 'Connexion impossible.';
                showError(message);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Se connecter';
            }
        });
    }

    async login(teacherId) {
        this.currentTeacher = teacherId;

        await this.loadTeacherConfig();

        this.updateUI();
        setTimeout(() => this.updateUI(), 100);

        if (!this.teacherConfig.classes || this.teacherConfig.classes.length === 0) {
            this.showInitialConfig();
        }

        window.dispatchEvent(new CustomEvent('teacherLoggedIn', { detail: { teacherId } }));

        this.reloadTeacherData();
    }

    async logout() {
        if (!confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) return;
        if (window.eprofAuth) {
            await window.eprofAuth.signOut();
        }
        window.location.reload();
    }

    async loadTeacherConfig() {
        const configKey = `eprof_teacherConfig_${this.currentTeacher}`;

        // Le profil en ligne fait foi quand l'enseignant est connecté à Supabase
        if (window.EprofStore && await window.EprofStore.isOnlineReady()) {
            const teacherId = await window.EprofStore.getTeacherId();
            const { data, error } = await window.EprofStore.list('profiles', { filters: { id: teacherId } });
            const profile = !error && data && data[0];
            if (profile) this.syncEnseignantNomPrenom(profile);
            if (profile && Array.isArray(profile.classes) && profile.classes.length > 0) {
                this.teacherConfig = {
                    classes: profile.classes,
                    subjectsByClass: profile.subjects_by_class || {},
                    customSubjects: (Array.isArray(profile.custom_subjects) && profile.custom_subjects.length > 0)
                        ? profile.custom_subjects
                        : [...DEFAULT_SUBJECT_CATALOG]
                };
                localStorage.setItem(configKey, JSON.stringify(this.teacherConfig));
                return;
            }
        }

        const saved = localStorage.getItem(configKey);
        if (saved) {
            this.teacherConfig = JSON.parse(saved);
        } else {
            // Configuration par défaut pour adfrantelle
            if (this.currentTeacher === 'adfrantelle') {
                const currentClasses = window.getCurrentClassNames ? window.getCurrentClassNames() : [];
                this.teacherConfig = {
                    classes: currentClasses,
                    subjectsByClass: {}
                };
                currentClasses.forEach(className => {
                    this.teacherConfig.subjectsByClass[className] = this.getDefaultSubjectsForClass(className);
                });
                this.saveTeacherConfig();
            } else {
                this.teacherConfig = {
                    classes: [],
                    subjectsByClass: {}
                };
            }
        }
    }

    syncEnseignantNomPrenom(profile) {
        if (!profile) return;
        try {
            const parametres = JSON.parse(localStorage.getItem('parametres') || '{}');
            if (!parametres.enseignant) {
                parametres.enseignant = { nom: '', prenom: '', matiere: '', email: '' };
            }
            if (profile.nom) parametres.enseignant.nom = profile.nom;
            if (profile.prenom) parametres.enseignant.prenom = profile.prenom;
            if (profile.matiere) parametres.enseignant.matiere = profile.matiere;
            if (profile.email) parametres.enseignant.email = profile.email;
            localStorage.setItem('parametres', JSON.stringify(parametres));
        } catch (e) { /* ignore */ }
    }

    saveTeacherConfig() {
        const configKey = `eprof_teacherConfig_${this.currentTeacher}`;
        localStorage.setItem(configKey, JSON.stringify(this.teacherConfig));

        // Synchronise aussi le profil en ligne (silencieux, sans bloquer l'UI)
        if (window.EprofStore) {
            (async () => {
                if (!(await window.EprofStore.isOnlineReady())) return;
                const teacherId = await window.EprofStore.getTeacherId();
                const { error } = await window.EprofStore.upsert('profiles', [{
                    id: teacherId,
                    classes: this.teacherConfig.classes,
                    subjects_by_class: this.teacherConfig.subjectsByClass,
                    custom_subjects: this.teacherConfig.customSubjects || []
                }], { onConflict: 'id' });
                if (error) {
                    console.error('❌ Synchronisation de la configuration enseignant échouée', error);
                }
            })();
        }
    }

    // ===== Compte (gérés depuis la page Paramètres) =====
    async changePassword(newPassword) {
        if (!window.EprofStore) throw new Error('Supabase non configuré.');
        const client = await window.EprofStore.getClient();
        if (!client) throw new Error('Vous devez être connecté pour changer votre mot de passe.');
        const { error } = await client.auth.updateUser({ password: newPassword });
        if (error) throw error;
    }

    async changeIdentifiant(newIdentifiant) {
        if (!window.EprofStore) throw new Error('Supabase non configuré.');
        const client = await window.EprofStore.getClient();
        if (!client) throw new Error('Vous devez être connecté pour changer votre identifiant.');
        const newEmail = `${newIdentifiant.trim().toLowerCase()}@jeannedelanoue.com`;
        const { error } = await client.auth.updateUser({ email: newEmail });
        if (error) throw error;
    }

    getDefaultSubjectsForClass(className) {
        const subjects = ['Histoire', 'Géographie'];
        const lower = className.toLowerCase();

        // TIM + EMC pour 4e, 3e, 2nde
        if (lower.includes('4e') || lower.includes('3e') || lower.includes('2nde')) {
            subjects.push('TIM', 'EMC');
        }

        // MP9-10 et MP5-10 HG pour 1ère et Terminale/Tle
        if (lower.includes('1ère') || lower.includes('1ere') || lower.includes('terminale') || lower.includes('tle')) {
            subjects.push('MP9-10', 'MP5-10 HG');
        }

        return subjects;
    }

    // ===== Catalogue de matières personnalisable par enseignant =====
    getSubjectCatalog() {
        if (!Array.isArray(this.teacherConfig.customSubjects) || this.teacherConfig.customSubjects.length === 0) {
            this.teacherConfig.customSubjects = [...DEFAULT_SUBJECT_CATALOG];
        }
        return this.teacherConfig.customSubjects;
    }

    addSubjectToCatalog(name) {
        const trimmed = (name || '').trim();
        if (!trimmed) return false;
        const catalog = this.getSubjectCatalog();
        if (catalog.some(s => s.toLowerCase() === trimmed.toLowerCase())) return false;
        catalog.push(trimmed);
        this.saveTeacherConfig();
        return true;
    }

    renameSubjectInCatalog(oldName, newName) {
        const trimmed = (newName || '').trim();
        if (!trimmed || trimmed === oldName) return false;
        const catalog = this.getSubjectCatalog();
        const index = catalog.indexOf(oldName);
        if (index === -1) return false;
        catalog[index] = trimmed;

        // Répercute le renommage partout où la matière était déjà cochée pour une classe
        Object.keys(this.teacherConfig.subjectsByClass || {}).forEach(className => {
            const subjects = this.teacherConfig.subjectsByClass[className];
            const subjectIndex = subjects.indexOf(oldName);
            if (subjectIndex !== -1) {
                subjects[subjectIndex] = trimmed;
            }
        });

        this.saveTeacherConfig();
        return true;
    }
    escapeConfigHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    getClassNiveau(className) {
        const ref = window.EprofReferentiel && typeof window.EprofReferentiel.findClass === 'function'
            ? window.EprofReferentiel.findClass(className)
            : null;
        if (ref && ref.niveau) return ref.niveau;
        const n = String(className || '').toLowerCase();
        if (n.includes('4e') || n.includes('4ème') || n.includes('4eme')) return '4e';
        if (n.includes('3e') || n.includes('3ème') || n.includes('3eme')) return '3e';
        if (n.includes('2nde') || n.includes('seconde')) return '2nde';
        if (n.includes('1ère') || n.includes('1ere') || n.includes('premiere')) return '1ère';
        if (n.includes('tle') || n.includes('terminale')) return 'Terminale';
        if (n.includes('6e') || n.includes('6ème')) return '6e';
        if (n.includes('5e') || n.includes('5ème')) return '5e';
        return 'Autres';
    }

    groupClassesByNiveau(names) {
        const order = ['6e', '5e', '4e', '3e', '2nde', '1ère', 'Terminale', 'Autres'];
        const groups = {};
        names.forEach((name) => {
            const niveau = this.getClassNiveau(name);
            if (!groups[niveau]) groups[niveau] = [];
            groups[niveau].push(name);
        });
        return order.filter((niveau) => groups[niveau] && groups[niveau].length).map((niveau) => ({
            niveau,
            classes: groups[niveau]
        }));
    }

    showInitialConfig() {
        const modal = document.getElementById('initial-config-modal');
        if (!modal) {
            this.createConfigModal();
        } else {
            this.openConfigModal();
        }
    }

    createConfigModal() {
        const html = `
            <div id="initial-config-modal" class="eprof-config-overlay" role="dialog" aria-modal="true" aria-labelledby="eprof-config-title">
                <div class="eprof-config-dialog">
                    <header class="eprof-config-header">
                        <div>
                            <h2 id="eprof-config-title">Vos classes et matières</h2>
                            <p class="eprof-config-summary" id="eprof-config-summary"></p>
                        </div>
                        <button type="button" class="eprof-config-close" id="eprof-config-close" aria-label="Fermer">×</button>
                    </header>
                    <div class="eprof-config-body">
                        <aside class="eprof-config-classes">
                            <div class="eprof-config-pane-head">
                                <h3>Classes</h3>
                                <button type="button" class="eprof-config-text-btn" id="eprof-config-toggle-all-classes">Tout cocher</button>
                            </div>
                            <input type="search" id="eprof-config-class-search" placeholder="Rechercher une classe…" autocomplete="off">
                            <div id="eprof-config-class-list" class="eprof-config-class-list"></div>
                        </aside>
                        <section class="eprof-config-subjects">
                            <div id="eprof-config-subjects-panel"></div>
                        </section>
                    </div>
                    <footer class="eprof-config-footer">
                        <p class="eprof-config-error" id="eprof-config-error" hidden></p>
                        <button type="button" class="eprof-config-btn eprof-config-btn-ghost" id="eprof-config-cancel">Annuler</button>
                        <button type="button" class="eprof-config-btn eprof-config-btn-primary" id="save-config-btn">Enregistrer</button>
                    </footer>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
        this.bindConfigModalEvents();
        this.openConfigModal();
    }

    openConfigModal() {
        const overlay = document.getElementById('initial-config-modal');
        if (!overlay) return;
        const alreadySelected = (this.teacherConfig && this.teacherConfig.classes) || [];
        const subjectsByClass = {};
        Object.keys((this.teacherConfig && this.teacherConfig.subjectsByClass) || {}).forEach((name) => {
            subjectsByClass[name] = (this.teacherConfig.subjectsByClass[name] || []).slice();
        });
        this._configDraft = {
            selected: new Set(alreadySelected),
            subjectsByClass,
            activeClass: alreadySelected[0] || null,
            query: '',
            renaming: null,
            feedback: ''
        };
        const cancelBtn = document.getElementById('eprof-config-cancel');
        if (cancelBtn) {
            cancelBtn.textContent = alreadySelected.length ? 'Annuler' : 'Plus tard';
        }
        this.setConfigError('');
        overlay.classList.add('is-open');
        overlay.style.display = 'flex';
        document.body.classList.add('eprof-config-open');
        this.renderConfigModal();
        const search = document.getElementById('eprof-config-class-search');
        if (search) {
            search.value = '';
            setTimeout(() => search.focus(), 40);
        }
    }

    closeConfigModal() {
        const overlay = document.getElementById('initial-config-modal');
        if (overlay) {
            overlay.classList.remove('is-open');
            overlay.style.display = 'none';
        }
        document.body.classList.remove('eprof-config-open');
        this._configDraft = null;
    }

    setConfigError(message) {
        const el = document.getElementById('eprof-config-error');
        if (!el) return;
        if (message) {
            el.hidden = false;
            el.textContent = message;
        } else {
            el.hidden = true;
            el.textContent = '';
        }
    }

    bindConfigModalEvents() {
        const overlay = document.getElementById('initial-config-modal');
        if (!overlay || overlay.dataset.bound === '1') return;
        overlay.dataset.bound = '1';

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.closeConfigModal();
        });

        overlay.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this._configDraft && this._configDraft.renaming) {
                    this._configDraft.renaming = null;
                    this.renderSubjectsPanel();
                    e.stopPropagation();
                    return;
                }
                this.closeConfigModal();
            }
        });

        overlay.querySelector('#eprof-config-close').addEventListener('click', () => this.closeConfigModal());
        overlay.querySelector('#eprof-config-cancel').addEventListener('click', () => this.closeConfigModal());
        overlay.querySelector('#save-config-btn').addEventListener('click', () => this.saveConfiguration());

        overlay.querySelector('#eprof-config-class-search').addEventListener('input', (e) => {
            if (!this._configDraft) return;
            this._configDraft.query = e.target.value;
            this.renderClassList();
        });

        overlay.querySelector('#eprof-config-toggle-all-classes').addEventListener('click', () => {
            this.toggleVisibleClasses();
        });

        overlay.querySelector('#eprof-config-class-list').addEventListener('click', (e) => {
            const niveauBtn = e.target.closest('[data-action="toggle-niveau"]');
            if (niveauBtn) {
                this.toggleNiveau(niveauBtn.getAttribute('data-niveau'));
                return;
            }
            const row = e.target.closest('[data-class-focus]');
            if (!row) return;
            const name = row.getAttribute('data-class-focus');
            if (e.target.closest('[data-class-check]')) return;
            this.focusClass(name, true);
        });

        overlay.querySelector('#eprof-config-class-list').addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            const row = e.target.closest('[data-class-focus]');
            if (!row || e.target.closest('[data-class-check]')) return;
            e.preventDefault();
            this.focusClass(row.getAttribute('data-class-focus'), true);
        });

        overlay.querySelector('#eprof-config-class-list').addEventListener('change', (e) => {
            const checkbox = e.target.closest('[data-class-check]');
            if (!checkbox || !this._configDraft) return;
            this.setClassSelected(checkbox.getAttribute('data-class-check'), checkbox.checked);
        });

        overlay.querySelector('#eprof-config-subjects-panel').addEventListener('click', (e) => {
            const actionBtn = e.target.closest('[data-action]');
            if (actionBtn) {
                const action = actionBtn.getAttribute('data-action');
                if (action === 'subjects-all') this.setAllSubjectsForActive(true);
                if (action === 'subjects-none') this.setAllSubjectsForActive(false);
                if (action === 'subjects-apply') this.applySubjectsToOtherClasses();
                if (action === 'add-subject') this.addSubjectFromInput();
                if (action === 'rename-subject') {
                    e.preventDefault();
                    e.stopPropagation();
                    this.startRenameSubject(actionBtn.getAttribute('data-subject'));
                }
            }
        });

        overlay.querySelector('#eprof-config-subjects-panel').addEventListener('change', (e) => {
            const checkbox = e.target.closest('[data-subject-check]');
            if (!checkbox || !this._configDraft) return;
            this.setSubjectSelected(checkbox.getAttribute('data-subject-check'), checkbox.checked);
        });

        overlay.querySelector('#eprof-config-subjects-panel').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.target.id === 'eprof-config-new-subject') {
                e.preventDefault();
                this.addSubjectFromInput();
            }
            if (e.target.classList.contains('eprof-config-rename-input')) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.commitRenameSubject(e.target.value);
                }
                if (e.key === 'Escape') {
                    e.preventDefault();
                    this._configDraft.renaming = null;
                    this.renderSubjectsPanel();
                }
            }
        });

        overlay.querySelector('#eprof-config-subjects-panel').addEventListener('blur', (e) => {
            if (e.target.classList.contains('eprof-config-rename-input') && this._configDraft && this._configDraft.renaming) {
                this.commitRenameSubject(e.target.value);
            }
        }, true);
    }

    visibleClassNames() {
        const all = window.getCurrentClassNames ? window.getCurrentClassNames() : [];
        const query = ((this._configDraft && this._configDraft.query) || '').trim().toLowerCase();
        if (!query) return all;
        return all.filter((name) => name.toLowerCase().indexOf(query) !== -1);
    }

    toggleVisibleClasses() {
        if (!this._configDraft) return;
        const visible = this.visibleClassNames();
        const allOn = visible.length > 0 && visible.every((name) => this._configDraft.selected.has(name));
        visible.forEach((name) => this.setClassSelected(name, !allOn, true));
        this.renderConfigModal();
    }

    toggleNiveau(niveau) {
        if (!this._configDraft) return;
        const visible = this.visibleClassNames().filter((name) => this.getClassNiveau(name) === niveau);
        const allOn = visible.length > 0 && visible.every((name) => this._configDraft.selected.has(name));
        visible.forEach((name) => this.setClassSelected(name, !allOn, true));
        this.renderConfigModal();
    }

    setClassSelected(name, selected, silent) {
        if (!this._configDraft) return;
        if (selected) {
            this._configDraft.selected.add(name);
            if (!this._configDraft.subjectsByClass[name] || this._configDraft.subjectsByClass[name].length === 0) {
                this._configDraft.subjectsByClass[name] = this.getDefaultSubjectsForClass(name);
            }
            this._configDraft.activeClass = name;
        } else {
            this._configDraft.selected.delete(name);
            if (this._configDraft.activeClass === name) {
                this._configDraft.activeClass = Array.from(this._configDraft.selected)[0] || null;
            }
        }
        if (!silent) this.renderConfigModal();
    }

    focusClass(name, alsoSelect) {
        if (!this._configDraft) return;
        if (alsoSelect) this.setClassSelected(name, true, true);
        this._configDraft.activeClass = name;
        this._configDraft.renaming = null;
        this._configDraft.feedback = '';
        this.renderConfigModal();
    }

    setSubjectSelected(subject, selected) {
        const draft = this._configDraft;
        if (!draft || !draft.activeClass) return;
        const list = draft.subjectsByClass[draft.activeClass] || [];
        const next = selected
            ? (list.indexOf(subject) === -1 ? list.concat([subject]) : list)
            : list.filter((item) => item !== subject);
        draft.subjectsByClass[draft.activeClass] = next;
        this.renderClassList();
        this.updateConfigSummary();
        const panel = document.getElementById('eprof-config-subjects-panel');
        if (!panel) return;
        const label = Array.from(panel.querySelectorAll('[data-subject]')).find(function (el) {
            return el.getAttribute('data-subject') === subject;
        });
        if (label) label.classList.toggle('is-on', selected);
    }

    setAllSubjectsForActive(on) {
        const draft = this._configDraft;
        if (!draft || !draft.activeClass) return;
        draft.subjectsByClass[draft.activeClass] = on ? this.getSubjectCatalog().slice() : [];
        this.renderConfigModal();
    }

    applySubjectsToOtherClasses() {
        const draft = this._configDraft;
        if (!draft || !draft.activeClass) return;
        const source = (draft.subjectsByClass[draft.activeClass] || []).slice();
        let count = 0;
        draft.selected.forEach((name) => {
            if (name === draft.activeClass) return;
            draft.subjectsByClass[name] = source.slice();
            count += 1;
        });
        draft.feedback = count
            ? 'Matières copiées vers ' + count + ' autre' + (count > 1 ? 's' : '') + ' classe' + (count > 1 ? 's' : '') + '.'
            : 'Cochez d’abord une autre classe.';
        this.renderConfigModal();
    }

    addSubjectFromInput() {
        const input = document.getElementById('eprof-config-new-subject');
        if (!input || !this._configDraft) return;
        const name = input.value.trim();
        if (!name) return;
        if (this.addSubjectToCatalog(name)) {
            if (this._configDraft.activeClass) {
                const list = this._configDraft.subjectsByClass[this._configDraft.activeClass] || [];
                if (list.indexOf(name) === -1) list.push(name);
                this._configDraft.subjectsByClass[this._configDraft.activeClass] = list;
            }
            input.value = '';
            this._configDraft.feedback = '';
            this.setConfigError('');
            this.renderConfigModal();
        } else {
            this.setConfigError('Cette matière existe déjà.');
        }
    }

    startRenameSubject(subject) {
        if (!this._configDraft) return;
        this._configDraft.renaming = subject;
        this.renderSubjectsPanel();
        const input = document.querySelector('.eprof-config-rename-input');
        if (input) {
            input.focus();
            input.select();
        }
    }

    commitRenameSubject(newName) {
        const draft = this._configDraft;
        if (!draft || !draft.renaming) return;
        const oldName = draft.renaming;
        draft.renaming = null;
        const trimmed = (newName || '').trim();
        if (trimmed && trimmed !== oldName) {
            this.renameSubjectInCatalog(oldName, trimmed);
            Object.keys(draft.subjectsByClass).forEach((className) => {
                draft.subjectsByClass[className] = (draft.subjectsByClass[className] || []).map((item) => (
                    item === oldName ? trimmed : item
                ));
            });
        }
        this.renderConfigModal();
    }

    renderConfigModal() {
        this.renderClassList();
        this.renderSubjectsPanel();
        this.updateConfigSummary();
        const toggle = document.getElementById('eprof-config-toggle-all-classes');
        if (toggle && this._configDraft) {
            const visible = this.visibleClassNames();
            const allOn = visible.length > 0 && visible.every((name) => this._configDraft.selected.has(name));
            toggle.textContent = allOn ? 'Tout décocher' : 'Tout cocher';
        }
    }

    updateConfigSummary() {
        const el = document.getElementById('eprof-config-summary');
        if (!el || !this._configDraft) return;
        const nClasses = this._configDraft.selected.size;
        const matieres = new Set();
        this._configDraft.selected.forEach((name) => {
            (this._configDraft.subjectsByClass[name] || []).forEach((m) => matieres.add(m));
        });
        if (!nClasses) {
            el.textContent = 'Cochez les classes que vous avez, puis leurs matières.';
            return;
        }
        el.textContent = nClasses + ' classe' + (nClasses > 1 ? 's' : '') + ' · ' +
            matieres.size + ' matière' + (matieres.size > 1 ? 's' : '');
    }

    renderClassList() {
        const container = document.getElementById('eprof-config-class-list');
        if (!container || !this._configDraft) return;
        const visible = this.visibleClassNames();
        if (!visible.length) {
            container.innerHTML = '<p class="eprof-config-empty">Aucune classe ne correspond à la recherche.</p>';
            return;
        }
        const groups = this.groupClassesByNiveau(visible);
        container.innerHTML = groups.map((group) => {
            const rows = group.classes.map((name) => {
                const selected = this._configDraft.selected.has(name);
                const active = this._configDraft.activeClass === name;
                const count = (this._configDraft.subjectsByClass[name] || []).length;
                const color = window.getClassColor ? window.getClassColor(name) : '#059669';
                const classes = ['eprof-config-class'];
                if (selected) classes.push('is-selected');
                if (active) classes.push('is-active');
                return `
                    <div class="${classes.join(' ')}" data-class-focus="${this.escapeConfigHtml(name)}" style="border-left-color:${color}" role="button" tabindex="0">
                        <input type="checkbox" data-class-check="${this.escapeConfigHtml(name)}" ${selected ? 'checked' : ''} aria-label="Enseigner ${this.escapeConfigHtml(name)}">
                        <span class="eprof-config-class-name">${this.escapeConfigHtml(name)}</span>
                        <span class="eprof-config-class-count">${count}</span>
                    </div>`;
            }).join('');
            return `
                <div class="eprof-config-niveau">
                    <span>${this.escapeConfigHtml(group.niveau)}</span>
                    <button type="button" class="eprof-config-text-btn" data-action="toggle-niveau" data-niveau="${this.escapeConfigHtml(group.niveau)}">toutes</button>
                </div>
                ${rows}`;
        }).join('');
    }

    renderSubjectsPanel() {
        const panel = document.getElementById('eprof-config-subjects-panel');
        if (!panel || !this._configDraft) return;
        const active = this._configDraft.activeClass;
        if (!active || !this._configDraft.selected.has(active)) {
            panel.innerHTML = `
                <div class="eprof-config-placeholder">
                    <strong>Choisissez une classe</strong>
                    Cochez une classe à gauche, puis sélectionnez les matières que vous y enseignez.
                </div>`;
            return;
        }
        const catalog = this.getSubjectCatalog();
        const selected = this._configDraft.subjectsByClass[active] || [];
        const color = window.getClassColor ? window.getClassColor(active) : '#059669';
        const feedback = this._configDraft.feedback
            ? `<p class="eprof-config-feedback">${this.escapeConfigHtml(this._configDraft.feedback)}</p>`
            : '';
        panel.innerHTML = `
            <div class="eprof-config-subjects-head">
                <h3 style="border-left:4px solid ${color};padding-left:10px;">${this.escapeConfigHtml(active)}</h3>
                <div class="eprof-config-subjects-tools">
                    <button type="button" class="eprof-config-chip-btn" data-action="subjects-all">Tout cocher</button>
                    <button type="button" class="eprof-config-chip-btn" data-action="subjects-none">Aucune</button>
                    <button type="button" class="eprof-config-chip-btn" data-action="subjects-apply">Appliquer aux autres classes</button>
                </div>
            </div>
            <div class="eprof-config-add">
                <input type="text" id="eprof-config-new-subject" placeholder="Ajouter une matière (ex. SVT)" autocomplete="off">
                <button type="button" data-action="add-subject">Ajouter</button>
            </div>
            <div class="eprof-config-subject-grid">
                ${catalog.map((subject) => {
                    const on = selected.indexOf(subject) !== -1;
                    const renaming = this._configDraft.renaming === subject;
                    const nameHtml = renaming
                        ? `<input class="eprof-config-rename-input" value="${this.escapeConfigHtml(subject)}" aria-label="Nouveau nom">`
                        : `<span class="eprof-config-subject-name">${this.escapeConfigHtml(subject)}</span>`;
                    return `
                        <label class="eprof-config-subject ${on ? 'is-on' : ''}" data-subject="${this.escapeConfigHtml(subject)}">
                            <input type="checkbox" data-subject-check="${this.escapeConfigHtml(subject)}" ${on ? 'checked' : ''}>
                            ${nameHtml}
                            <button type="button" class="eprof-config-rename-btn" data-action="rename-subject" data-subject="${this.escapeConfigHtml(subject)}" title="Renommer pour toutes les classes">✏️</button>
                        </label>`;
                }).join('')}
            </div>
            ${feedback}`;
    }

    saveConfiguration() {
        const draft = this._configDraft;
        const selectedClasses = draft ? Array.from(draft.selected) : [];

        if (selectedClasses.length === 0) {
            this.setConfigError('Sélectionnez au moins une classe.');
            return;
        }

        this.teacherConfig.classes = selectedClasses;
        this.teacherConfig.subjectsByClass = {};
        selectedClasses.forEach((className) => {
            this.teacherConfig.subjectsByClass[className] = (draft.subjectsByClass[className] || []).slice();
        });

        this.saveTeacherConfig();
        this.closeConfigModal();

        if (window.location.href.indexOf('carnet-notes.html') !== -1) {
            window.location.reload();
        } else {
            this.reloadTeacherData();
            this.updateUI();
        }
    }

    updateUI() {
        // Mettre à jour l'affichage du nom de l'enseignant
        const nameDisplay = document.getElementById('user-name-display');
        if (nameDisplay) {
            nameDisplay.textContent = `👨‍🏫 ${this.currentTeacher}`;
            nameDisplay.style.cursor = 'pointer';
            nameDisplay.title = 'Cliquer pour gérer vos classes et matières';
            nameDisplay.onclick = () => this.showInitialConfig();
        }

        const teacherNameDisplay = document.getElementById('teacher-name-display');
        if (teacherNameDisplay) {
            teacherNameDisplay.textContent = `👨‍🏫 ${this.currentTeacher}`;
        }

        // Mettre à jour l'email dans le header (format: [identifiant]@jeannedelanoue.com)
        const emailDisplays = document.querySelectorAll('.user-email');
        emailDisplays.forEach(emailDisplay => {
            if (emailDisplay) {
                const email = `${this.currentTeacher}@jeannedelanoue.com`;
                emailDisplay.textContent = email;
                emailDisplay.href = `https://outlook.office.com/mail/?realm=jeannedelanoue.com&login_hint=${email}`;
            }
        });
        
        console.log('✓ Interface mise à jour pour:', this.currentTeacher);
    }

    // Recharger les données selon l'enseignant connecté
    reloadTeacherData() {
        console.log('🔄 Rechargement des données pour:', this.currentTeacher);
        
        // Recharger les classes dans les sélecteurs
        this.reloadClassSelectors();
        
        // Déclencher un événement pour que les autres modules se mettent à jour
        window.dispatchEvent(new CustomEvent('teacherDataReloaded', { 
            detail: { 
                teacherId: this.currentTeacher,
                classes: this.getTeacherClasses()
            } 
        }));
    }

    // Recharger les sélecteurs de classes
    reloadClassSelectors() {
        const classSelectors = document.querySelectorAll('#class-select, .class-selector select');
        const teacherClasses = this.getTeacherClasses();
        
        classSelectors.forEach(select => {
            if (!select) return;
            
            const currentValue = select.value;
            select.innerHTML = '<option value="">-- Choisir une classe --</option>';
            
            teacherClasses.forEach(className => {
                const option = document.createElement('option');
                option.value = className;
                option.textContent = className;
                select.appendChild(option);
            });
            
            // Restaurer la valeur si elle existe toujours
            if (teacherClasses.includes(currentValue)) {
                select.value = currentValue;
            }
        });
        
        console.log('✓ Sélecteurs de classes mis à jour avec:', teacherClasses);
    }

    // Méthodes d'accès pour les autres modules
    getCurrentTeacher() {
        return this.currentTeacher;
    }

    getTeacherClasses() {
        return this.teacherConfig.classes || [];
    }

    getSubjectsForClass(className) {
        return this.teacherConfig.subjectsByClass[className] || [];
    }

    getStorageKey(baseKey) {
        return `eprof_${baseKey}_${this.currentTeacher}`;
    }
}

// Initialiser le gestionnaire d'enseignants
window.teacherManager = null;

document.addEventListener('DOMContentLoaded', () => {
    window.teacherManager = new TeacherManager();
});
