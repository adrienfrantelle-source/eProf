// ===== GESTIONNAIRE DE DONNÉES - VERSION AUTOMATIQUE =====
// Sauvegarde automatique dans un fichier JSON (sans manipulation manuelle)

class DataManager {
    constructor() {
        this.autoSaveEnabled = true;
        this.autoSaveDelay = 3000; // 3 secondes après modification
        this.saveTimeout = null;
        this.lastBackupDate = null;
        this.fileHandle = null; // Handle du fichier de sauvegarde
        this.directoryHandle = null; // Handle du dossier
        this.autoSaveToFile = false; // Sauvegarde auto dans fichier activée
        this.init();
    }

    /**
     * Initialisation
     */
    async init() {
        // Vérifier si une sauvegarde est nécessaire
        const lastBackup = localStorage.getItem('lastBackupDate');
        if (lastBackup) {
            this.lastBackupDate = new Date(lastBackup);
            const daysSinceBackup = (Date.now() - this.lastBackupDate) / (1000 * 60 * 60 * 24);
            
            if (daysSinceBackup > 1) {
                console.log(`⚠️ Dernière sauvegarde il y a ${Math.floor(daysSinceBackup)} jour(s)`);
            }
        }
        
        // Vérifier si on a déjà un handle de dossier sauvegardé
        const savedHandle = localStorage.getItem('eprofDirectoryHandle');
        if (savedHandle && 'showDirectoryPicker' in window) {
            // Tenter de récupérer le handle
            try {
                // Note: IndexedDB serait mieux pour stocker les handles, mais pour simplifier...
                console.log('✓ Mode sauvegarde automatique disponible');
            } catch (e) {
                console.log('Mode sauvegarde manuelle');
            }
        }
        
        console.log('✓ DataManager initialisé');
    }

    /**
     * Déclenche une sauvegarde automatique (debounced)
     */
    triggerAutoSave() {
        if (!this.autoSaveEnabled) return;
        
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        
        this.saveTimeout = setTimeout(() => {
            this.performAutoBackup();
        }, this.autoSaveDelay);
    }

    /**
     * Sauvegarde automatique en arrière-plan
     */
    async performAutoBackup() {
        try {
            const allData = this.getAllData();
            
            // Toujours sauvegarder dans localStorage
            localStorage.setItem('eprofBackupData', JSON.stringify(allData));
            localStorage.setItem('lastBackupDate', new Date().toISOString());
            this.lastBackupDate = new Date();
            
            // Si la sauvegarde auto dans fichier est activée, sauvegarder aussi dans le fichier
            if (this.autoSaveToFile && this.fileHandle) {
                await this.writeToFile(allData);
                console.log('✓ Sauvegarde auto (localStorage + fichier)');
            } else {
                console.log('✓ Sauvegarde auto (localStorage uniquement)');
            }
        } catch (error) {
            console.error('❌ Erreur sauvegarde auto:', error);
        }
    }
    
    /**
     * Configure la sauvegarde automatique dans un fichier
     */
    async setupAutoSaveToFile() {
        if (!('showDirectoryPicker' in window)) {
            alert('⚠️ Votre navigateur ne supporte pas la sauvegarde automatique.\n\nUtilisez Chrome, Edge ou un navigateur récent.\n\nVous pouvez continuer à utiliser les boutons de sauvegarde manuelle.');
            return false;
        }
        
        try {
            // Demander à l'utilisateur de choisir le dossier Donnees
            const dirHandle = await window.showDirectoryPicker({
                mode: 'readwrite',
                startIn: 'documents'
            });
            
            this.directoryHandle = dirHandle;
            
            // Créer ou récupérer le fichier de sauvegarde
            this.fileHandle = await dirHandle.getFileHandle('sauvegarde-auto.json', { create: true });
            
            // Activer la sauvegarde auto
            this.autoSaveToFile = true;
            localStorage.setItem('autoSaveToFileEnabled', 'true');
            
            // Faire une première sauvegarde
            await this.performAutoBackup();
            
            return true;
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('Sauvegarde automatique annulée par l\'utilisateur');
            } else {
                console.error('Erreur configuration sauvegarde auto:', error);
            }
            return false;
        }
    }
    
    /**
     * Désactive la sauvegarde automatique dans fichier
     */
    disableAutoSaveToFile() {
        this.autoSaveToFile = false;
        this.fileHandle = null;
        this.directoryHandle = null;
        localStorage.removeItem('autoSaveToFileEnabled');
        console.log('Sauvegarde automatique dans fichier désactivée');
    }
    
    /**
     * Écrit les données dans le fichier
     */
    async writeToFile(data) {
        if (!this.fileHandle) return;
        
        try {
            const writable = await this.fileHandle.createWritable();
            const jsonContent = JSON.stringify(data, null, 2);
            await writable.write(jsonContent);
            await writable.close();
            console.log('📝 Fichier sauvegarde-auto.json mis à jour');
        } catch (error) {
            console.error('Erreur écriture fichier:', error);
            // Si erreur, désactiver la sauvegarde auto
            this.disableAutoSaveToFile();
            throw error;
        }
    }
    
    /**
     * Lit les données depuis le fichier automatique
     */
    async loadFromAutoSaveFile() {
        if (!this.fileHandle) {
            throw new Error('Aucun fichier de sauvegarde automatique configuré');
        }
        
        try {
            const file = await this.fileHandle.getFile();
            const content = await file.text();
            const data = JSON.parse(content);
            
            // Restaurer dans localStorage
            if (data.evaluations) {
                localStorage.setItem('carnetNotesEvaluations', JSON.stringify(data.evaluations));
            }
            if (data.notes) {
                localStorage.setItem('carnetNotesNotes', JSON.stringify(data.notes));
            }
            if (data.suiviEleves) {
                localStorage.setItem('suiviEleves', JSON.stringify(data.suiviEleves));
            }
            if (data.suiviTableaux) {
                localStorage.setItem('suiviTableaux', JSON.stringify(data.suiviTableaux));
            }
            if (data.calendrier) {
                localStorage.setItem('eprof-events', JSON.stringify(data.calendrier));
            }
            if (data.parametres) {
                localStorage.setItem('parametres', JSON.stringify(data.parametres));
            }
            
            localStorage.setItem('lastBackupDate', new Date().toISOString());
            
            return data;
        } catch (error) {
            console.error('Erreur lecture fichier auto:', error);
            throw error;
        }
    }

    /**
     * Récupère toutes les données
     */
    getAllData() {
        return {
            evaluations: JSON.parse(localStorage.getItem('carnetNotesEvaluations') || '{}'),
            notes: JSON.parse(localStorage.getItem('carnetNotesNotes') || '{}'),
            suiviEleves: JSON.parse(localStorage.getItem('suiviEleves') || '{}'),
            suiviTableaux: JSON.parse(localStorage.getItem('suiviTableaux') || '{}'),
            calendrier: JSON.parse(localStorage.getItem('eprof-events') || '[]'),
            parametres: JSON.parse(localStorage.getItem('parametres') || '{}'),
            timestamp: new Date().toISOString(),
            version: '1.0'
        };
    }

    /**
     * Exporte toutes les données dans un fichier JSON
     */
    exportAllData() {
        try {
            const allData = this.getAllData();
            const jsonContent = JSON.stringify(allData, null, 2);
            const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
            
            // Nom du fichier avec date
            const date = new Date();
            const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            const filename = `eprof-sauvegarde-${dateStr}.json`;
            
            // Télécharger
            this.downloadBlob(blob, filename);
            
            // Mise à jour date backup
            localStorage.setItem('lastBackupDate', new Date().toISOString());
            this.lastBackupDate = new Date();
            
            return true;
        } catch (error) {
            console.error('❌ Erreur export:', error);
            throw error;
        }
    }

    /**
     * Importe des données depuis un fichier JSON
     */
    importAllData() {
        return new Promise((resolve, reject) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) {
                    reject(new Error('Aucun fichier sélectionné'));
                    return;
                }
                
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const data = JSON.parse(event.target.result);
                        
                        // Restaurer dans localStorage
                        if (data.evaluations) {
                            localStorage.setItem('carnetNotesEvaluations', JSON.stringify(data.evaluations));
                        }
                        if (data.notes) {
                            localStorage.setItem('carnetNotesNotes', JSON.stringify(data.notes));
                        }
                        if (data.suiviEleves) {
                            localStorage.setItem('suiviEleves', JSON.stringify(data.suiviEleves));
                        }
                        if (data.suiviTableaux) {
                            localStorage.setItem('suiviTableaux', JSON.stringify(data.suiviTableaux));
                        }
                        if (data.calendrier) {
                            localStorage.setItem('eprof-events', JSON.stringify(data.calendrier));
                        }
                        if (data.parametres) {
                            localStorage.setItem('parametres', JSON.stringify(data.parametres));
                        }
                        
                        localStorage.setItem('lastBackupDate', new Date().toISOString());
                        
                        resolve(data);
                    } catch (parseError) {
                        reject(new Error('Fichier JSON invalide : ' + parseError.message));
                    }
                };
                reader.onerror = () => reject(new Error('Erreur lecture fichier'));
                reader.readAsText(file, 'UTF-8');
            };
            
            input.click();
        });
    }

    /**
     * Télécharge un Blob
     */
    downloadBlob(blob, filename) {
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 100);
    }
}

// Instance globale (chargée une seule fois)
if (typeof window.dataManager === 'undefined') {
    window.dataManager = new DataManager();
    console.log('✓ DataManager global créé');
}
