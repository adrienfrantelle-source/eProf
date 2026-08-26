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
    showInitialConfig() {
        const modal = document.getElementById('initial-config-modal');
        if (!modal) {
            this.createConfigModal();
        } else {
            modal.style.display = 'block';
            this.populateConfigModal();
        }
    }

    createConfigModal() {
        const modalHTML = `
            <div id="initial-config-modal" class="modal" style="display: block; backdrop-filter: blur(8px); background: rgba(0,0,0,0.5);">
                <div class="modal-content" style="max-width: 950px; max-height: 90vh; overflow-y: auto; animation: slideDown 0.3s ease;">
                    <div class="modal-header" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
                        <div style="font-size: 3.5em; margin-bottom: 10px;">⚙️</div>
                        <h2 style="margin: 0; font-size: 1.7em; font-weight: 600;">Configuration de vos classes</h2>
                        <p style="margin: 10px 0 0 0; opacity: 0.95; font-size: 1em;">Sélectionnez vos classes et matières enseignées</p>
                    </div>
                    <div class="modal-body" style="padding: 35px 30px;">
                        <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 15px 20px; border-radius: 8px; margin-bottom: 25px;">
                            <p style="margin: 0; color: #065f46; font-weight: 500;">
                                📚 <strong>Instructions :</strong> Choisissez d'abord vos classes, puis configurez les matières pour chacune d'elles.
                            </p>
                        </div>
                        
                        <div class="form-group" style=\"margin-bottom: 25px;\">
                            <label style=\"display: block; font-weight: 600; color: #333; font-size: 1.1em; margin-bottom: 15px;\">
                                📚 Sélectionnez vos classes :
                            </label>
                            <div id="classes-checkboxes" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; max-height: 250px; overflow-y: auto; padding: 20px; border: 2px solid #10b981; border-radius: 12px; background: white; box-shadow: 0 2px 8px rgba(16,185,129,0.1);">
                            </div>
                        </div>

                        <div class="form-group" style="margin-top: 30px;">
                            <label style=\"display: block; font-weight: 600; color: #333; font-size: 1.1em; margin-bottom: 10px;\">
                                🎓 Configuration des matières par classe :
                            </label>
                            <p style="font-size: 0.95em; color: #666; margin-bottom: 15px; padding-left: 5px;">
                                Pour chaque classe sélectionnée, choisissez les matières que vous enseignez.
                                Cliquez sur ✏️ pour renommer une matière (partout où elle est utilisée).
                            </p>
                            <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                                <input type="text" id="new-subject-input" placeholder="Ajouter une matière (ex : SVT)"
                                       style="flex: 1; padding: 10px 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 0.95em;">
                                <button id="add-subject-btn" type="button"
                                        style="padding: 10px 18px; background: #10b981; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                                    ➕ Ajouter
                                </button>
                            </div>
                            <div id="subjects-by-class-container" style="max-height: 500px; overflow-y: auto; padding-right: 10px;">
                            </div>
                        </div>

                        <div class="form-actions" style=\"margin-top: 35px;\">
                            <button id="save-config-btn" class="btn-primary" 
                                    style="width: 100%; padding: 18px; font-size: 1.15em; font-weight: 600; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border: none; border-radius: 10px; color: white; cursor: pointer; transition: all 0.3s; box-shadow: 0 4px 15px rgba(16,185,129,0.4);"
                                    onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(16,185,129,0.6)'"
                                    onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(16,185,129,0.4)'">
                                ✓ Enregistrer la configuration
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.populateConfigModal();
        
        document.getElementById('save-config-btn').onclick = () => this.saveConfiguration();

        const addSubjectBtn = document.getElementById('add-subject-btn');
        const newSubjectInput = document.getElementById('new-subject-input');
        if (addSubjectBtn && newSubjectInput) {
            const handleAddSubject = () => {
                if (this.addSubjectToCatalog(newSubjectInput.value)) {
                    newSubjectInput.value = '';
                    this.updateSubjectsForSelectedClasses();
                } else if (newSubjectInput.value.trim()) {
                    alert('Cette matière existe déjà dans la liste.');
                }
            };
            addSubjectBtn.addEventListener('click', handleAddSubject);
            newSubjectInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSubject();
                }
            });
        }
    }

    populateConfigModal() {
        const classesContainer = document.getElementById('classes-checkboxes');
        if (!classesContainer) return;
        
        classesContainer.innerHTML = '';
        
        const currentClasses = window.getCurrentClassNames ? window.getCurrentClassNames() : [];
        currentClasses.forEach(className => {
                const label = document.createElement('label');
                label.style.cssText = 'display: flex; align-items: center; gap: 8px; padding: 12px 15px; cursor: pointer; background: #f9fafb; border: 2px solid #e5e7eb; border-radius: 8px; transition: all 0.3s; font-weight: 500;';
                label.onmouseover = () => {
                    label.style.background = '#f0fdf4';
                    label.style.borderColor = '#10b981';
                };
                label.onmouseout = () => {
                    const checkbox = label.querySelector('input[type="checkbox"]');
                    if (!checkbox.checked) {
                        label.style.background = '#f9fafb';
                        label.style.borderColor = '#e5e7eb';
                    }
                };
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = className;
                checkbox.style.cssText = 'width: 18px; height: 18px; cursor: pointer;';
                checkbox.onchange = () => {
                    if (checkbox.checked) {
                        label.style.background = '#f0fdf4';
                        label.style.borderColor = '#10b981';
                    } else {
                        label.style.background = '#f9fafb';
                        label.style.borderColor = '#e5e7eb';
                    }
                    this.updateSubjectsForSelectedClasses();
                };
                checkbox.checked = this.teacherConfig.classes.includes(className);
                checkbox.onchange = () => this.updateSubjectsForSelectedClasses();
                
                label.appendChild(checkbox);
                label.appendChild(document.createTextNode(className));
                classesContainer.appendChild(label);
        });
        
        this.updateSubjectsForSelectedClasses();
    }

    updateSubjectsForSelectedClasses() {
        const container = document.getElementById('subjects-by-class-container');
        if (!container) return;
        
        container.innerHTML = '';
        
        const selectedClasses = Array.from(document.querySelectorAll('#classes-checkboxes input:checked')).map(cb => cb.value);
        
        if (selectedClasses.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">Sélectionnez au moins une classe ci-dessus</p>';
            return;
        }

        const subjectCatalog = this.getSubjectCatalog();
        
        selectedClasses.forEach((className, index) => {
            const classDiv = document.createElement('div');
            classDiv.style.cssText = 'margin-bottom: 20px; padding: 20px; border: 2px solid #10b981; border-radius: 12px; background: linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%); box-shadow: 0 2px 8px rgba(16,185,129,0.15);';
            
            const title = document.createElement('h4');
            title.textContent = `📚 ${className}`;
            title.style.cssText = 'margin: 0 0 15px 0; color: #10b981; font-size: 1.15em; font-weight: 600; padding-bottom: 10px; border-bottom: 2px solid #d1fae5;';
            classDiv.appendChild(title);
            
            const subjectsGrid = document.createElement('div');
            subjectsGrid.id = `subjects-for-${className.replace(/\s+/g, '-')}`;
            subjectsGrid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 10px;';
            
            const currentSubjects = this.teacherConfig.subjectsByClass[className] || this.getDefaultSubjectsForClass(className);
            
            subjectCatalog.forEach(subject => {
                const label = document.createElement('label');
                label.style.cssText = 'display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 8px 12px; background: white; border: 1.5px solid #e5e7eb; border-radius: 6px; transition: all 0.2s; font-weight: 500;';
                label.onmouseover = () => {
                    label.style.background = '#f9fafb';
                    label.style.borderColor = '#10b981';
                };
                label.onmouseout = () => {
                    const checkbox = label.querySelector('input[type="checkbox"]');
                    if (!checkbox.checked) {
                        label.style.background = 'white';
                        label.style.borderColor = '#e5e7eb';
                    }
                };
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = subject;
                checkbox.checked = currentSubjects.includes(subject);
                checkbox.style.cssText = 'width: 16px; height: 16px; cursor: pointer;';
                checkbox.onchange = () => {
                    if (checkbox.checked) {
                        label.style.background = '#f0fdf4';
                        label.style.borderColor = '#10b981';
                    } else {
                        label.style.background = 'white';
                        label.style.borderColor = '#e5e7eb';
                    }
                };
                
                // Appliquer le style si déjà coché
                if (checkbox.checked) {
                    label.style.background = '#f0fdf4';
                    label.style.borderColor = '#10b981';
                }
                
                const renameBtn = document.createElement('button');
                renameBtn.type = 'button';
                renameBtn.textContent = '✏️';
                renameBtn.title = `Renommer "${subject}" (pour toutes les classes)`;
                renameBtn.style.cssText = 'border:none;background:transparent;cursor:pointer;font-size:0.9em;margin-left:auto;padding:0 2px;line-height:1;';
                renameBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const nouveauNom = prompt(`Renommer la matière "${subject}" en :`, subject);
                    if (nouveauNom && this.renameSubjectInCatalog(subject, nouveauNom.trim())) {
                        this.updateSubjectsForSelectedClasses();
                    }
                };

                label.appendChild(checkbox);
                label.appendChild(document.createTextNode(subject));
                label.appendChild(renameBtn);
                subjectsGrid.appendChild(label);
            });
            
            classDiv.appendChild(subjectsGrid);
            container.appendChild(classDiv);
        });
    }

    saveConfiguration() {
        const selectedClasses = Array.from(document.querySelectorAll('#classes-checkboxes input:checked')).map(cb => cb.value);
        
        if (selectedClasses.length === 0) {
            alert('Veuillez sélectionner au moins une classe');
            return;
        }
        
        this.teacherConfig.classes = selectedClasses;
        this.teacherConfig.subjectsByClass = {};
        
        // Sauvegarder les matières sélectionnées pour chaque classe
        selectedClasses.forEach(className => {
            const checkboxes = document.querySelectorAll(`#subjects-for-${className.replace(/\s+/g, '-')} input:checked`);
            this.teacherConfig.subjectsByClass[className] = Array.from(checkboxes).map(cb => cb.value);
        });
        
        this.saveTeacherConfig();
        
        const modal = document.getElementById('initial-config-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        
        alert('✓ Configuration enregistrée avec succès !');
        
        // Recharger si on est sur le carnet de notes
        if (window.location.href.includes('carnet-notes.html')) {
            window.location.reload();
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
