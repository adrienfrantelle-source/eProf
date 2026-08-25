// ===== GESTION GLOBALE DES ENSEIGNANTS =====
class TeacherManager {
    constructor() {
        this.currentTeacher = null;
        this.teacherConfig = {};
        this.init();
    }

    init() {
        // Connexion automatique pour adfrantelle - plus besoin de saisir l'identifiant
        this.login('adfrantelle');
    }

    showLoginModal() {
        const modal = document.getElementById('teacher-login-modal');
        if (!modal) {
            this.createLoginModal();
        } else {
            modal.style.display = 'block';
        }
    }

    createLoginModal() {
        const modalHTML = `
            <div id="teacher-login-modal" class="modal" style="display: block; backdrop-filter: blur(8px); background: rgba(0,0,0,0.5);">
                <div class="modal-content" style="max-width: 550px; animation: slideDown 0.3s ease;">
                    <div class="modal-header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
                        <div style="font-size: 4em; margin-bottom: 10px;">👨‍🏫</div>
                        <h2 style="margin: 0; font-size: 1.8em; font-weight: 600;">Connexion Enseignant</h2>
                        <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 0.95em;">Bienvenue sur eProf</p>
                    </div>
                    <div class="modal-body" style="padding: 40px 30px;">
                        <form id="teacher-login-form">
                            <div class="form-group" style="margin-bottom: 25px;">
                                <label for="teacher-id" style="display: block; font-weight: 600; margin-bottom: 10px; color: #333; font-size: 1.05em;">
                                    📝 Votre identifiant :
                                </label>
                                <input type="text" id="teacher-id" required autocomplete="username" 
                                       placeholder="Exemple: adfrantelle, anboulord..."
                                       style="width: 100%; padding: 15px; font-size: 1.1em; border: 2px solid #e0e0e0; border-radius: 8px; transition: all 0.3s; box-sizing: border-box;"
                                       onfocus="this.style.borderColor='#667eea'; this.style.boxShadow='0 0 0 3px rgba(102,126,234,0.1)'"
                                       onblur="this.style.borderColor='#e0e0e0'; this.style.boxShadow='none'">
                                <p style="margin: 10px 0 0 0; font-size: 0.9em; color: #666;">
                                    💡 <strong>Votre email sera :</strong> <span style="color: #667eea; font-weight: 600;">[identifiant]@jeannedelanoue.com</span>
                                </p>
                            </div>
                            <div class="form-actions" style="margin-top: 30px;">
                                <button type="submit" class="btn-primary" 
                                        style="width: 100%; padding: 16px; font-size: 1.15em; font-weight: 600; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; border-radius: 8px; color: white; cursor: pointer; transition: all 0.3s; box-shadow: 0 4px 15px rgba(102,126,234,0.4);"
                                        onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(102,126,234,0.6)'"
                                        onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(102,126,234,0.4)'">
                                    ✓ Se connecter
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
            <style>
                @keyframes slideDown {
                    from { opacity: 0; transform: translateY(-50px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            </style>
        `;
        
        document.body.insertAdjacentHTML('afterbegin', modalHTML);
        
        const form = document.getElementById('teacher-login-form');
        form.onsubmit = (e) => {
            e.preventDefault();
            const teacherId = document.getElementById('teacher-id').value.trim().toLowerCase();
            if (teacherId) {
                this.login(teacherId);
            }
        };
    }

    login(teacherId) {
        this.currentTeacher = teacherId;
        // Ne plus sauvegarder dans localStorage - connexion requise à chaque ouverture
        // localStorage.setItem('eprof_currentTeacher', teacherId);
        this.loadTeacherConfig();
        
        const modal = document.getElementById('teacher-login-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        
        // Mettre à jour l'interface AVANT de vérifier la config
        this.updateUI();
        
        // Forcer la mise à jour de l'email
        setTimeout(() => this.updateUI(), 100);
        
        // Vérifier si c'est la première connexion
        if (!this.teacherConfig.classes || this.teacherConfig.classes.length === 0) {
            this.showInitialConfig();
        }
        
        // Événement pour notifier les autres modules
        window.dispatchEvent(new CustomEvent('teacherLoggedIn', { detail: { teacherId } }));
        
        // Recharger les données selon l'enseignant
        this.reloadTeacherData();
    }

    logout() {
        if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
            this.currentTeacher = null;
            // Plus besoin de supprimer de localStorage car on ne sauvegarde plus l'enseignant actuel
            window.location.reload();
        }
    }

    loadTeacherConfig() {
        const configKey = `eprof_teacherConfig_${this.currentTeacher}`;
        const saved = localStorage.getItem(configKey);
        
        if (saved) {
            this.teacherConfig = JSON.parse(saved);
        } else {
            // Configuration par défaut pour adfrantelle
            if (this.currentTeacher === 'adfrantelle') {
                const activeLists = window.getAvailableStudentLists ? window.getAvailableStudentLists() : (typeof LISTES_ELEVES !== 'undefined' ? LISTES_ELEVES : {});
                this.teacherConfig = {
                    classes: Object.keys(activeLists),
                    subjectsByClass: {}
                };
                Object.keys(activeLists).forEach(className => {
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
    }

    getDefaultSubjectsForClass(className) {
        const subjects = ['Histoire', 'Géographie'];
        
        // TIM pour 4e, 3e, 2nde
        if (className.includes('4') || className.includes('3') || className.includes('2nde')) {
            subjects.push('TIM');
        }
        
        // EMC pour 3e, 4e, 2nde
        if (className.includes('3') || className.includes('4') || className.includes('2nde')) {
            subjects.push('EMC');
        }
        
        // MP9-10 et MP5-10 HG pour Terminale/Tle
        if (className.toLowerCase().includes('terminale') || className.toLowerCase().includes('tle')) {
            subjects.push('MP9-10', 'MP5-10 HG');
        }
        
        // Spécial pour adfrantelle : EIE pour 2nde SAPAT AB1
        if (this.currentTeacher === 'adfrantelle' && className === '2nde SAPAT AB1') {
            subjects.push('EIE');
        }
        
        return subjects;
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
        const ALL_SUBJECTS = [
            'Histoire', 'Géographie', 'TIM', 'EMC', 'MP9-10', 'MP5-10 HG', 'MP8',
            'Lettres', 'Mathématiques', 'Animation', 'Physique-Chimie', 'Biologie Ecologie',
            'SESG', 'Anglais', 'ESC', 'EPS', 'ESF', 'EIE PFMP', 'EIE', 'Nutrition', 'Cadre de vie'
        ];

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
                                Pour chaque classe sélectionnée, choisissez les matières que vous enseignez
                            </p>
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
    }

    populateConfigModal() {
        const classesContainer = document.getElementById('classes-checkboxes');
        if (!classesContainer) return;
        
        classesContainer.innerHTML = '';
        
        if (typeof LISTES_ELEVES !== 'undefined') {
            Object.keys(LISTES_ELEVES).forEach(className => {
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
        }
        
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

        const ALL_SUBJECTS = [
            'Histoire', 'Géographie', 'TIM', 'EMC', 'MP9-10', 'MP5-10 HG', 'MP8',
            'Lettres', 'Mathématiques', 'Animation', 'Physique-Chimie', 'Biologie Ecologie',
            'SESG', 'Anglais', 'ESC', 'EPS', 'ESF', 'EIE PFMP', 'EIE', 'Nutrition', 'Cadre de vie'
        ];
        
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
            
            ALL_SUBJECTS.forEach(subject => {
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
                
                label.appendChild(checkbox);
                label.appendChild(document.createTextNode(subject));
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
