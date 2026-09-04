/* Plan de classe — extraits de app.js */
(function (global) {
    var E = function () { return global.EprofEleves || {}; };
    function getAnneeScolaire() { return E().getAnneeScolaire(); }
    function getVisibleTeacherClasses() { return E().getVisibleTeacherClasses(); }
    function getListsForTeacher() { return E().getListsForTeacher(); }
    function planClasseLieeOptionsHtml(selected) { return E().planClasseLieeOptionsHtml(selected); }
    function setPlanClasseLieeSelect(container, classe) { E().setPlanClasseLieeSelect(container, classe); }
    function rememberLinkedClassPlan(plan, name) { return E().rememberLinkedClassPlan(plan, name); }
    function photoHtml(classe, eleve) { return E().photoHtml(classe, eleve, { compact: true }); }
    function resolvePhotoUrls(eleves, classe) { return E().resolvePhotoUrls(eleves, classe); }
    function parseEleveLabel(label) { return E().parseEleveLabel(label); }

    // ========================================
    // PLAN DE CLASSE
    // ========================================
    function renderPlanClasse(container, extra) {
        container.innerHTML = `
            <div id="plan-classe-module">
                <h2>🪑 Plan de classe</h2>
                
                <div class="plan-classe-controls">
                    <div class="plan-lien-classe-row">
                        <label for="plan-classe-nom">Titre du plan</label>
                        <input type="text" id="plan-classe-nom" class="plan-select" maxlength="80" placeholder="Ex. Tle SAPAT A — salle 12">
                    </div>
                    <div class="plan-lien-classe-row">
                        <label for="plan-classe-liee">Lier à une classe</label>
                        <select id="plan-classe-liee" class="plan-select">
                            ${planClasseLieeOptionsHtml('')}
                        </select>
                        <p class="plan-hint-text">Accessible ensuite depuis le suivi des élèves. Le nom de classe est comparé sans tenir compte des accents ni de la casse. Si plusieurs plans sont liés, le plus récent est proposé en premier.</p>
                    </div>
                    <details class="plan-config-accordion" id="plan-config-accordion">
                        <summary>⚙️ Configuration de la classe</summary>
                        <div class="config-accordion-body">
                            <div class="import-section">
                                <div style="display:flex;gap:10px;margin-bottom:15px;flex-wrap:wrap;">
                                    <button id="config-defaut-btn" class="btn-secondary">📐 Organisation par défaut</button>
                                    <button id="config-perso-btn" class="btn-secondary">🎨 Organisation personnalisée</button>
                                </div>
                                
                                <div id="config-perso-zone" class="plan-info-zone">
                                    <label>Nombre de places dans la classe :</label>
                                    <input type="number" id="nb-places-input" class="plan-number-input" min="1" max="64" value="30" />
                                    <button id="creer-grille-btn" class="btn-primary" style="margin-left:10px;">Créer la grille</button>
                                    <p class="plan-hint-text">
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
                                    <p class="plan-hint-text">
                                        📋 Format attendu : Colonne B = Nom, Colonne C = Prénom, Colonne D = Sexe (F/M)<br>
                                        📍 Les données doivent commencer à la ligne 7
                                    </p>
                                </div>
                                
                                <div id="import-liste-zone" style="display:none;">
                                    <label>Liste ${getAnneeScolaire()} :</label>
                                    <select id="liste-classe-select" class="plan-select">
                                        ${(function () {
                                            const listes = getListsForTeacher();
                                            const noms = getVisibleTeacherClasses();
                                            if (!noms.length) return '<option value="">-- Aucune classe sélectionnée --</option>';
                                            return '<option value="">-- Choisir une classe --</option>' +
                                                noms.map(n => `<option value="${n}">${n} (${(listes[n] || []).length})</option>`).join('');
                                        })()}
                                    </select>
                                    <button id="charger-liste-btn" class="btn-primary">📥 Charger la liste</button>
                                    <p class="plan-hint-text">
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
                            <div class="bureau-prof-label">
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
                            <p class="plan-empty-msg">Importez une liste d'élèves pour commencer</p>
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

        initPlanClasse(container, extra);
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

    function initPlanClasse(container, extra) {
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
        let currentPlanLocalId = (extra && extra.planLocalId) || '';

        function lireTitrePlan() {
            const input = container.querySelector('#plan-classe-nom');
            const saisie = input && input.value.trim();
            if (saisie) return saisie;
            const classe = (container.querySelector('#plan-classe-liee') || {}).value || '';
            return (classe ? classe + ' — ' : '') + 'plan ' + new Date().toISOString().slice(0, 10);
        }

        function ecrireTitrePlan(name) {
            const input = container.querySelector('#plan-classe-nom');
            if (input && name) input.value = name;
        }

        function persistCurrentLinkedPlan(name) {
            const titre = name || lireTitrePlan();
            ecrireTitrePlan(titre);
            const plan = capturerPlan(container, modePersonnalise);
            if (currentPlanLocalId) plan.localId = currentPlanLocalId;
            plan.nomPlan = titre;
            if (!plan.classeLiee && !currentPlanLocalId) return plan;
            const entry = rememberLinkedClassPlan(plan, titre);
            if (entry) currentPlanLocalId = entry.localId;
            return plan;
        }

        const planNomInput = container.querySelector('#plan-classe-nom');
        if (planNomInput) {
            planNomInput.addEventListener('change', function () {
                persistCurrentLinkedPlan(planNomInput.value.trim());
            });
        }

        const planLieeSelect = container.querySelector('#plan-classe-liee');
        if (planLieeSelect) {
            planLieeSelect.addEventListener('change', function () {
                persistCurrentLinkedPlan();
            });
        }

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
                setPlanClasseLieeSelect(container, classe);
                persistCurrentLinkedPlan(lireTitrePlan());
                resolvePhotoUrls(listeClasse, classe).then(function (list) {
                    list.forEach(function (e, i) {
                        if (listeClasse[i]) listeClasse[i].photoUrl = e.photoUrl;
                    });
                    afficherElevesDisponibles(currentEleves, elevesDisponibles);
                });
                
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
            const nomFichier = lireTitrePlan();
            ecrireTitrePlan(nomFichier);
            
            const plan = persistCurrentLinkedPlan(nomFichier);
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
            const nomPlan = lireTitrePlan();
            ecrireTitrePlan(nomPlan);

            const plan = persistCurrentLinkedPlan(nomPlan);
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
                    if (row.data.localId) currentPlanLocalId = row.data.localId;
                    restaurerPlan(row.data, container);
                    if (row.data.elevesDisponibles) {
                        currentEleves.length = 0;
                        currentEleves.push(...row.data.elevesDisponibles);
                    }
                    persistCurrentLinkedPlan(row.name);
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
                    if (plan.localId) currentPlanLocalId = plan.localId;
                    ecrireTitrePlan(nomPlan);
                    setPlanClasseLieeSelect(container, plan.classeLiee);
                    persistCurrentLinkedPlan(nomPlan);
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
        if (extra && extra.planToLoad) {
            const plan = extra.planToLoad;
            currentPlanLocalId = extra.planLocalId || plan.localId || currentPlanLocalId;
            modePersonnalise = !!plan.modePersonnalise;
            restaurerPlan(plan, container);
            if (plan.elevesDisponibles && plan.elevesDisponibles.length) {
                currentEleves.length = 0;
                currentEleves.push(...plan.elevesDisponibles);
            }
            setPlanClasseLieeSelect(container, plan.classeLiee);
            if (plan.nomPlan) {
                const titreInput = container.querySelector('#plan-classe-nom');
                if (titreInput) titreInput.value = plan.nomPlan;
            }
        }
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
        html += '<button id="valider-organisation-btn" class="btn-action btn-valider-organisation">✅ Valider l\'organisation des tables</button>';
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
                    const tablePalette = ['var(--eprof-info, #3b82f6)', 'var(--eprof-success, #10b981)', 'var(--eprof-warning, #f59e0b)', 'var(--eprof-danger, #ef4444)', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
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
                        instructions.style.borderColor = 'var(--eprof-success, #10b981)';
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
        
        const classeLiee = (document.querySelector('#plan-classe-liee') || {}).value || '';
        const listes = getListsForTeacher();
        const listeOfficielle = listes[classeLiee] || [];

        eleves.forEach(function(nom, index) {
            const eleveDiv = document.createElement('div');
            eleveDiv.className = 'eleve-card';
            
            if (nom.includes('(F)')) {
                eleveDiv.classList.add('eleve-feminin');
            } else if (nom.includes('(M)')) {
                eleveDiv.classList.add('eleve-masculin');
            }
            
            const parsed = parseEleveLabel(nom);
            const identite = listeOfficielle.find(function (e) {
                return E().makePersonKey(e.nom, e.prenom) === E().makePersonKey(parsed.nom, parsed.prenom);
            });
            if (identite) {
                parsed.photo_path = identite.photo_path;
                parsed.photoUrl = identite.photoUrl;
                parsed.sexe = identite.sexe || parsed.sexe;
            }
            const photoWrap = document.createElement('div');
            photoWrap.className = 'eleve-card-photo';
            photoWrap.innerHTML = photoHtml(classeLiee, parsed);
            eleveDiv.appendChild(photoWrap);

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
            elevesDisponibles: [],
            classeLiee: (container.querySelector('#plan-classe-liee') || {}).value || ''
        };
        
        // Capturer les élèves disponibles
        const elevesCards = container.querySelectorAll('.eleve-card');
        elevesCards.forEach(card => {
            plan.elevesDisponibles.push(card.dataset.nom || card.textContent);
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

        setPlanClasseLieeSelect(container, plan.classeLiee);
        const titreInput = container.querySelector('#plan-classe-nom');
        if (titreInput && plan.nomPlan) titreInput.value = plan.nomPlan;
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

    global.EprofPlanClasse = {
        render: renderPlanClasse
    };
})(window);
