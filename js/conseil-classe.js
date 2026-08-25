// ===== CONSEIL DE CLASSE - Module compartimenté =====
// Ce module est autonome et ne modifie aucune autre partie de eProf.
// Il lit les données depuis LISTES_ELEVES, le carnet de notes (localStorage), et le suivi élèves.

(function() {
    'use strict';

    // Données internes du module
    const ConseilClasse = {
        currentClass: '',
        currentTrimester: 'trimestre1',
        appreciations: {},    // { className: { studentKey: { text, date } } }
        generalAppreciation: {}, // { className: { trimester: text } }
        importedGrades: {},   // { className: [{ student, grades }] }

        init: function(container) {
            this.container = container;
            this.loadSavedData();
            this.render();
        },

        // Chargement des données sauvegardées
        loadSavedData: function() {
            try {
                const saved = localStorage.getItem('eprof_conseil_classe');
                if (saved) {
                    const data = JSON.parse(saved);
                    this.appreciations = data.appreciations || {};
                    this.generalAppreciation = data.generalAppreciation || {};
                    this.importedGrades = data.importedGrades || {};
                }
            } catch (e) { /* ignore */ }
        },

        saveData: function() {
            localStorage.setItem('eprof_conseil_classe', JSON.stringify({
                appreciations: this.appreciations,
                generalAppreciation: this.generalAppreciation,
                importedGrades: this.importedGrades
            }));
        },

        // Récupérer les notes depuis le carnet de notes
        getNotesFromCarnet: function(className) {
            try {
                // D'abord essayer les données embarquées
                if (typeof CARNET_NOTES_DATA !== 'undefined' && CARNET_NOTES_DATA.notes && CARNET_NOTES_DATA.notes[className]) {
                    return {
                        evaluations: CARNET_NOTES_DATA.evaluations[className] || [],
                        notes: CARNET_NOTES_DATA.notes[className] || {}
                    };
                }
                // Sinon essayer le localStorage
                const evalsKey = `eprof_evaluations_${className}`;
                const notesKey = `eprof_notes_${className}`;
                const evals = JSON.parse(localStorage.getItem(evalsKey) || '[]');
                const notes = JSON.parse(localStorage.getItem(notesKey) || '{}');
                return { evaluations: evals, notes: notes };
            } catch (e) {
                return { evaluations: [], notes: {} };
            }
        },

        // Récupérer le suivi élèves depuis localStorage
        getSuiviEleves: function(className) {
            try {
                const key = `suiviEleves_${className}`;
                return JSON.parse(localStorage.getItem(key) || '{}');
            } catch (e) {
                return {};
            }
        },

        // Calculer la moyenne d'un élève pour un trimestre
        calculateStudentAverage: function(className, studentKey, trimester) {
            const carnetData = this.getNotesFromCarnet(className);
            if (!carnetData.evaluations.length || !carnetData.notes[studentKey]) return null;

            let totalWeighted = 0;
            let totalCoeff = 0;

            carnetData.evaluations.forEach((eval_, idx) => {
                if (eval_.period !== trimester) return;
                const note = carnetData.notes[studentKey]?.[idx];
                if (note === undefined || note === null || note === '' || note === 'ABS' || note === 'DISP') return;
                const numNote = parseFloat(note);
                if (isNaN(numNote)) return;
                const maxPts = eval_.maxPoints || 20;
                const coeff = eval_.coefficient || 1;
                totalWeighted += (numNote / maxPts * 20) * coeff;
                totalCoeff += coeff;
            });

            return totalCoeff > 0 ? (totalWeighted / totalCoeff) : null;
        },

        // Calculer la moyenne de classe
        calculateClassAverage: function(className, trimester) {
            if (typeof LISTES_ELEVES === 'undefined' || !LISTES_ELEVES[className]) return null;
            const students = LISTES_ELEVES[className];
            let total = 0, count = 0;
            students.forEach(s => {
                const key = `${s.nom}-${s.prenom}`;
                const avg = this.calculateStudentAverage(className, key, trimester);
                if (avg !== null) { total += avg; count++; }
            });
            return count > 0 ? (total / count) : null;
        },

        // Obtenir les données complètes d'un élève
        getStudentData: function(className, student) {
            const key = `${student.nom}-${student.prenom}`;
            const avg = this.calculateStudentAverage(className, key, this.currentTrimester);
            const suivi = this.getSuiviEleves(className);
            const studentSuivi = suivi[key] || {};
            const appreciation = this.appreciations[className]?.[key]?.text || '';

            return {
                nom: student.nom,
                prenom: student.prenom,
                key: key,
                moyenne: avg,
                oublis: studentSuivi.oublis || [],
                mots: studentSuivi.mots || [],
                appreciation: appreciation
            };
        },

        // Niveau basé sur la moyenne
        getNiveau: function(moyenne) {
            if (moyenne === null) return { label: 'N/A', class: '' };
            if (moyenne >= 16) return { label: 'Excellent', class: 'niveau-excellent' };
            if (moyenne >= 12) return { label: 'Bien', class: 'niveau-bien' };
            if (moyenne >= 8) return { label: 'Moyen', class: 'niveau-moyen' };
            return { label: 'Insuffisant', class: 'niveau-insuffisant' };
        },

        // Templates d'appréciation
        templates: {
            excellent: [
                "Excellent trimestre. Résultats remarquables, continuez ainsi.",
                "Travail sérieux et régulier. Très bon niveau d'ensemble.",
                "Félicitations pour ces excellents résultats et cette attitude exemplaire."
            ],
            bien: [
                "Bon trimestre dans l'ensemble. Des résultats encourageants.",
                "Travail satisfaisant. Poursuivez vos efforts.",
                "Bonne participation en classe. Résultats solides."
            ],
            moyen: [
                "Résultats moyens. Des efforts supplémentaires sont nécessaires.",
                "Trimestre en demi-teinte. Il faut approfondir le travail personnel.",
                "Des capacités mais un travail insuffisant. Ressaisissez-vous."
            ],
            insuffisant: [
                "Résultats préoccupants. Un travail plus régulier est indispensable.",
                "Niveau insuffisant. Il est urgent de se mettre au travail.",
                "Trimestre difficile. Un accompagnement renforcé est recommandé."
            ]
        },

        // ===== RENDU PRINCIPAL =====
        render: function() {
            const classes = typeof LISTES_ELEVES !== 'undefined' ? Object.keys(LISTES_ELEVES) : [];

            this.container.innerHTML = `
                <link rel="stylesheet" href="css/conseil-classe.css">
                <div class="conseil-container">
                    <div class="conseil-header">
                        <h2>🎓 Préparation du conseil de classe</h2>
                        <div class="conseil-header-actions">
                            <button id="conseil-save-btn" style="background: #10b981; color: white;">💾 Sauvegarder</button>
                            <button id="conseil-export-btn" style="background: #3b82f6; color: white;">📤 Exporter JSON</button>
                            <button id="conseil-import-btn" style="background: #6366f1; color: white;">📥 Importer JSON</button>
                            <input type="file" id="conseil-import-file" accept=".json" style="display:none;">
                        </div>
                    </div>

                    <div class="conseil-class-selector">
                        <label>📚 Classe :</label>
                        <select id="conseil-class-select">
                            <option value="">-- Choisir une classe --</option>
                            ${classes.map(c => `<option value="${c}" ${c === this.currentClass ? 'selected' : ''}>${c}</option>`).join('')}
                        </select>
                        
                        <div class="conseil-trimester-selector">
                            <button class="conseil-trimester-btn ${this.currentTrimester === 'trimestre1' ? 'active' : ''}" data-trim="trimestre1">T1</button>
                            <button class="conseil-trimester-btn ${this.currentTrimester === 'trimestre2' ? 'active' : ''}" data-trim="trimestre2">T2</button>
                            <button class="conseil-trimester-btn ${this.currentTrimester === 'trimestre3' ? 'active' : ''}" data-trim="trimestre3">T3</button>
                        </div>
                    </div>

                    <div id="conseil-main-content">
                        ${this.currentClass ? this.renderClassContent() : this.renderEmptyState()}
                    </div>
                </div>
            `;

            this.bindEvents();
        },

        renderEmptyState: function() {
            return `
                <div style="text-align: center; padding: 60px 20px; color: #94a3b8;">
                    <div style="font-size: 4em; margin-bottom: 20px;">🎓</div>
                    <h3 style="color: #64748b; margin-bottom: 10px;">Sélectionnez une classe pour commencer</h3>
                    <p>Choisissez une classe et un trimestre pour préparer votre conseil de classe.</p>
                    <div style="margin-top: 30px; text-align: left; max-width: 500px; margin-left: auto; margin-right: auto; padding: 20px; background: #f8fafc; border-radius: 12px;">
                        <h4 style="color: #4338ca; margin-top: 0;">📋 Fonctionnalités disponibles :</h4>
                        <ul style="color: #475569; line-height: 2;">
                            <li>Vue d'ensemble avec statistiques de classe</li>
                            <li>Récupération automatique des notes du carnet</li>
                            <li>Rédaction d'appréciations individuelles avec templates</li>
                            <li>Appréciation générale de classe</li>
                            <li>Import de fichiers de notes (CSV)</li>
                            <li>Distribution visuelle des résultats</li>
                            <li>Export et impression du bilan</li>
                        </ul>
                    </div>
                </div>
            `;
        },

        renderClassContent: function() {
            return `
                <div class="conseil-tabs">
                    <button class="conseil-tab active" data-tab="synthese">📊 Synthèse</button>
                    <button class="conseil-tab" data-tab="appreciations">📝 Appréciations</button>
                    <button class="conseil-tab" data-tab="import">📥 Import données</button>
                    <button class="conseil-tab" data-tab="bilan">📄 Bilan & Export</button>
                </div>

                <div id="conseil-tab-synthese" class="conseil-tab-content active">
                    ${this.renderSynthese()}
                </div>
                <div id="conseil-tab-appreciations" class="conseil-tab-content">
                    ${this.renderAppreciations()}
                </div>
                <div id="conseil-tab-import" class="conseil-tab-content">
                    ${this.renderImport()}
                </div>
                <div id="conseil-tab-bilan" class="conseil-tab-content">
                    ${this.renderBilan()}
                </div>
            `;
        },

        // ===== ONGLET SYNTHÈSE =====
        renderSynthese: function() {
            const className = this.currentClass;
            if (!className || typeof LISTES_ELEVES === 'undefined') return '';

            const students = LISTES_ELEVES[className] || [];
            const classAvg = this.calculateClassAverage(className, this.currentTrimester);
            
            // Calculer toutes les moyennes
            const averages = [];
            students.forEach(s => {
                const key = `${s.nom}-${s.prenom}`;
                const avg = this.calculateStudentAverage(className, key, this.currentTrimester);
                if (avg !== null) averages.push(avg);
            });

            const minAvg = averages.length > 0 ? Math.min(...averages) : null;
            const maxAvg = averages.length > 0 ? Math.max(...averages) : null;
            const medianAvg = averages.length > 0 ? this.median(averages) : null;

            // Distribution
            let nbExcellent = 0, nbBien = 0, nbMoyen = 0, nbInsuffisant = 0;
            averages.forEach(a => {
                if (a >= 16) nbExcellent++;
                else if (a >= 12) nbBien++;
                else if (a >= 8) nbMoyen++;
                else nbInsuffisant++;
            });

            const total = averages.length || 1;

            // Suivi élèves stats
            const suivi = this.getSuiviEleves(className);
            let totalOublis = 0;
            Object.values(suivi).forEach(s => {
                totalOublis += (s.oublis || []).length;
            });

            return `
                <div class="conseil-stats-grid">
                    <div class="conseil-stat-card">
                        <div class="conseil-stat-value">${students.length}</div>
                        <div class="conseil-stat-label">Élèves</div>
                    </div>
                    <div class="conseil-stat-card ${classAvg !== null ? (classAvg >= 12 ? 'good' : classAvg >= 8 ? 'warning' : 'bad') : ''}">
                        <div class="conseil-stat-value">${classAvg !== null ? classAvg.toFixed(1) : '--'}</div>
                        <div class="conseil-stat-label">Moyenne classe</div>
                    </div>
                    <div class="conseil-stat-card good">
                        <div class="conseil-stat-value">${maxAvg !== null ? maxAvg.toFixed(1) : '--'}</div>
                        <div class="conseil-stat-label">Note max</div>
                    </div>
                    <div class="conseil-stat-card bad">
                        <div class="conseil-stat-value">${minAvg !== null ? minAvg.toFixed(1) : '--'}</div>
                        <div class="conseil-stat-label">Note min</div>
                    </div>
                    <div class="conseil-stat-card">
                        <div class="conseil-stat-value">${medianAvg !== null ? medianAvg.toFixed(1) : '--'}</div>
                        <div class="conseil-stat-label">Médiane</div>
                    </div>
                    <div class="conseil-stat-card warning">
                        <div class="conseil-stat-value">${totalOublis}</div>
                        <div class="conseil-stat-label">Oublis matériel</div>
                    </div>
                </div>

                <!-- Distribution visuelle -->
                <div class="conseil-chart-container">
                    <div class="conseil-chart-title">📊 Distribution des résultats</div>
                    <div class="conseil-distribution-bar">
                        <div class="conseil-distribution-segment" style="width: ${(nbExcellent/total*100)}%; background: #10b981;">${nbExcellent > 0 ? nbExcellent : ''}</div>
                        <div class="conseil-distribution-segment" style="width: ${(nbBien/total*100)}%; background: #3b82f6;">${nbBien > 0 ? nbBien : ''}</div>
                        <div class="conseil-distribution-segment" style="width: ${(nbMoyen/total*100)}%; background: #f59e0b;">${nbMoyen > 0 ? nbMoyen : ''}</div>
                        <div class="conseil-distribution-segment" style="width: ${(nbInsuffisant/total*100)}%; background: #ef4444;">${nbInsuffisant > 0 ? nbInsuffisant : ''}</div>
                    </div>
                    <div class="conseil-distribution-legend">
                        <span><span class="dot" style="background:#10b981;"></span> Excellent (≥16) : ${nbExcellent}</span>
                        <span><span class="dot" style="background:#3b82f6;"></span> Bien (12-16) : ${nbBien}</span>
                        <span><span class="dot" style="background:#f59e0b;"></span> Moyen (8-12) : ${nbMoyen}</span>
                        <span><span class="dot" style="background:#ef4444;"></span> Insuffisant (<8) : ${nbInsuffisant}</span>
                    </div>
                </div>

                <!-- Graphique en barres -->
                ${averages.length > 0 ? this.renderBarChart(students, className) : ''}

                <!-- Tableau détaillé -->
                <div class="conseil-table-container" style="max-height: 500px; overflow-y: auto;">
                    <table class="conseil-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Élève</th>
                                <th>Moyenne</th>
                                <th>Niveau</th>
                                <th>Oublis</th>
                                <th>Appréciation</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${students.map((s, i) => {
                                const data = this.getStudentData(className, s);
                                const niveau = this.getNiveau(data.moyenne);
                                return `<tr>
                                    <td>${i+1}</td>
                                    <td class="student-name" data-key="${data.key}">${s.prenom} ${s.nom}</td>
                                    <td><strong>${data.moyenne !== null ? data.moyenne.toFixed(1) : '--'}</strong></td>
                                    <td><span class="niveau-badge ${niveau.class}">${niveau.label}</span></td>
                                    <td>${data.oublis.length > 0 ? '⚠️ ' + data.oublis.length : '✅'}</td>
                                    <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${data.appreciation ? '✅' : '❌'}</td>
                                </tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        },

        renderBarChart: function(students, className) {
            const allAvgs = students.map(s => {
                const key = `${s.nom}-${s.prenom}`;
                return {
                    name: s.prenom.charAt(0) + '.' + s.nom.substring(0, 3),
                    avg: this.calculateStudentAverage(className, key, this.currentTrimester)
                };
            }).filter(s => s.avg !== null);

            if (allAvgs.length === 0) return '';

            const maxVal = 20;

            return `
                <div class="conseil-chart-container">
                    <div class="conseil-chart-title">📈 Moyennes par élève</div>
                    <div class="conseil-bar-chart">
                        ${allAvgs.map(s => {
                            const height = (s.avg / maxVal * 100);
                            const color = s.avg >= 16 ? '#10b981' : s.avg >= 12 ? '#3b82f6' : s.avg >= 8 ? '#f59e0b' : '#ef4444';
                            return `<div style="flex:1; text-align:center;">
                                <div style="height: 180px; display: flex; align-items: flex-end; justify-content: center;">
                                    <div class="conseil-bar" style="height: ${height}%; background: linear-gradient(180deg, ${color}, ${color}dd); width: 80%; position: relative;">
                                        <span class="conseil-bar-value">${s.avg.toFixed(1)}</span>
                                    </div>
                                </div>
                                <div class="conseil-bar-label">${s.name}</div>
                            </div>`;
                        }).join('')}
                    </div>
                </div>
            `;
        },

        // ===== ONGLET APPRÉCIATIONS =====
        renderAppreciations: function() {
            const className = this.currentClass;
            if (!className || typeof LISTES_ELEVES === 'undefined') return '';

            const students = LISTES_ELEVES[className] || [];
            const generalText = this.generalAppreciation[className]?.[this.currentTrimester] || '';

            return `
                <!-- Appréciation générale -->
                <div class="conseil-general-appreciation">
                    <h3>📋 Appréciation générale de la classe</h3>
                    <textarea class="conseil-general-textarea" id="conseil-general-text" 
                        placeholder="Rédigez l'appréciation générale de la classe pour ce trimestre...">${generalText}</textarea>
                    <div style="margin-top: 10px;">
                        <button id="conseil-save-general" style="padding: 8px 16px; background: #10b981; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">💾 Sauvegarder l'appréciation générale</button>
                    </div>
                </div>

                <h3 style="margin: 25px 0 15px 0; color: #1e293b;">📝 Appréciations individuelles</h3>
                
                <div style="margin-bottom: 15px; display: flex; gap: 10px; flex-wrap: wrap;">
                    <button id="conseil-expand-all" style="padding: 8px 14px; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 6px; cursor: pointer; font-size: 0.9em;">📖 Tout déplier</button>
                    <button id="conseil-collapse-all" style="padding: 8px 14px; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 6px; cursor: pointer; font-size: 0.9em;">📕 Tout replier</button>
                    <button id="conseil-auto-appreciate" style="padding: 8px 14px; background: #e0e7ff; border: 1px solid #a5b4fc; border-radius: 6px; cursor: pointer; font-size: 0.9em; color: #4338ca; font-weight: 600;">✨ Pré-remplir automatiquement</button>
                </div>

                <div id="conseil-appreciations-list">
                    ${students.map(s => {
                        const data = this.getStudentData(className, s);
                        const niveau = this.getNiveau(data.moyenne);
                        return `
                        <div class="conseil-appreciation-card" data-student="${data.key}">
                            <div class="conseil-appreciation-header">
                                <div class="conseil-appreciation-student">
                                    ${s.prenom} ${s.nom}
                                </div>
                                <div class="conseil-appreciation-moyenne">
                                    <span class="niveau-badge ${niveau.class}">${data.moyenne !== null ? data.moyenne.toFixed(1) + '/20' : 'N/A'}</span>
                                    ${data.oublis.length > 0 ? `<span style="color: #f59e0b; font-size: 0.85em;">⚠️ ${data.oublis.length} oubli(s)</span>` : ''}
                                </div>
                            </div>
                            <textarea class="conseil-appreciation-textarea appreciation-input" 
                                data-key="${data.key}" 
                                placeholder="Rédigez l'appréciation pour ${s.prenom} ${s.nom}...">${data.appreciation}</textarea>
                            <div class="conseil-appreciation-actions">
                                <button class="conseil-save-appreciation" data-key="${data.key}" style="background: #10b981; color: white;">💾 Sauvegarder</button>
                                <button class="conseil-clear-appreciation" data-key="${data.key}" style="background: #ef4444; color: white;">🗑️ Effacer</button>
                            </div>
                            <div class="conseil-templates">
                                ${this.getTemplatesForNiveau(niveau.label).map((t, tidx) => 
                                    `<button class="conseil-template-btn" data-key="${data.key}" data-template="${tidx}" data-niveau="${niveau.label.toLowerCase()}">"${t.substring(0, 40)}..."</button>`
                                ).join('')}
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            `;
        },

        getTemplatesForNiveau: function(niveauLabel) {
            switch(niveauLabel) {
                case 'Excellent': return this.templates.excellent;
                case 'Bien': return this.templates.bien;
                case 'Moyen': return this.templates.moyen;
                case 'Insuffisant': return this.templates.insuffisant;
                default: return this.templates.moyen;
            }
        },

        // ===== ONGLET IMPORT =====
        renderImport: function() {
            return `
                <h3 style="margin: 0 0 20px 0; color: #1e293b;">📥 Importer des données</h3>
                
                <div class="conseil-import-section" id="conseil-import-csv-zone">
                    <div class="import-icon">📊</div>
                    <h4>Importer un fichier de notes (CSV)</h4>
                    <p style="color: #64748b; margin-bottom: 15px;">Format attendu : Nom, Prénom, Matière1, Matière2, ...<br>Première ligne = en-têtes</p>
                    <input type="file" id="conseil-csv-input" accept=".csv" style="display:none;">
                    <button id="conseil-csv-btn" style="padding: 12px 24px; background: #6366f1; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 1em;">📁 Sélectionner un fichier CSV</button>
                </div>

                <div class="conseil-import-section" id="conseil-import-appreciation-zone" style="margin-top: 15px;">
                    <div class="import-icon">📝</div>
                    <h4>Importer des appréciations (CSV)</h4>
                    <p style="color: #64748b; margin-bottom: 15px;">Format attendu : Nom, Prénom, Appréciation</p>
                    <input type="file" id="conseil-appreciation-csv-input" accept=".csv" style="display:none;">
                    <button id="conseil-appreciation-csv-btn" style="padding: 12px 24px; background: #10b981; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 1em;">📁 Sélectionner un fichier CSV</button>
                </div>

                <div style="margin-top: 20px; padding: 20px; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 12px;">
                    <h4 style="margin: 0 0 10px 0; color: #92400e;">💡 Astuce : Récupérer les notes depuis eProf</h4>
                    <p style="color: #92400e; margin: 0; font-size: 0.95em;">
                        Les notes du <strong>Carnet de notes</strong> et les données du <strong>Suivi des élèves</strong>
                        sont automatiquement récupérées. Pas besoin de les importer manuellement si elles sont déjà saisies dans eProf !
                    </p>
                </div>

                ${Object.keys(this.importedGrades).length > 0 ? `
                    <div style="margin-top: 20px; padding: 15px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px;">
                        <h4 style="margin: 0 0 10px 0; color: #166534;">✅ Données importées</h4>
                        <ul style="margin: 0; color: #166534;">
                            ${Object.entries(this.importedGrades).map(([cls, data]) => 
                                `<li>${cls}: ${Array.isArray(data) ? data.length : 0} élèves</li>`
                            ).join('')}
                        </ul>
                    </div>
                ` : ''}
            `;
        },

        // ===== ONGLET BILAN =====
        renderBilan: function() {
            const className = this.currentClass;
            if (!className || typeof LISTES_ELEVES === 'undefined') return '';

            const students = LISTES_ELEVES[className] || [];
            const generalText = this.generalAppreciation[className]?.[this.currentTrimester] || '';
            const classAvg = this.calculateClassAverage(className, this.currentTrimester);
            const trimesterLabel = this.currentTrimester === 'trimestre1' ? 'Trimestre 1' : this.currentTrimester === 'trimestre2' ? 'Trimestre 2' : 'Trimestre 3';

            // Count appreciations
            let nbAppreciations = 0;
            students.forEach(s => {
                const key = `${s.nom}-${s.prenom}`;
                if (this.appreciations[className]?.[key]?.text) nbAppreciations++;
            });

            return `
                <div style="background: linear-gradient(135deg, #f0f4ff 0%, #e8f0fe 100%); padding: 25px; border-radius: 12px; margin-bottom: 20px;">
                    <h3 style="margin: 0 0 15px 0; color: #4338ca;">📄 Bilan du conseil de classe - ${className} - ${trimesterLabel}</h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px;">
                        <div style="text-align: center;">
                            <div style="font-size: 1.8em; font-weight: 700; color: #4338ca;">${students.length}</div>
                            <div style="font-size: 0.85em; color: #64748b;">élèves</div>
                        </div>
                        <div style="text-align: center;">
                            <div style="font-size: 1.8em; font-weight: 700; color: ${classAvg !== null ? (classAvg >= 12 ? '#10b981' : '#f59e0b') : '#94a3b8'};">${classAvg !== null ? classAvg.toFixed(1) : '--'}</div>
                            <div style="font-size: 0.85em; color: #64748b;">moyenne classe</div>
                        </div>
                        <div style="text-align: center;">
                            <div style="font-size: 1.8em; font-weight: 700; color: ${nbAppreciations === students.length ? '#10b981' : '#f59e0b'};">${nbAppreciations}/${students.length}</div>
                            <div style="font-size: 0.85em; color: #64748b;">appréciations</div>
                        </div>
                    </div>
                </div>

                ${generalText ? `
                    <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                        <h4 style="margin: 0 0 10px 0; color: #4338ca;">💬 Appréciation générale</h4>
                        <p style="color: #334155; line-height: 1.6;">${generalText}</p>
                    </div>
                ` : ''}

                <div class="conseil-table-container">
                    <table class="conseil-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Élève</th>
                                <th>Moyenne</th>
                                <th>Niveau</th>
                                <th>Appréciation</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${students.map((s, i) => {
                                const data = this.getStudentData(className, s);
                                const niveau = this.getNiveau(data.moyenne);
                                return `<tr>
                                    <td>${i+1}</td>
                                    <td><strong>${s.prenom} ${s.nom}</strong></td>
                                    <td>${data.moyenne !== null ? data.moyenne.toFixed(1) : '--'}</td>
                                    <td><span class="niveau-badge ${niveau.class}">${niveau.label}</span></td>
                                    <td style="max-width: 400px; font-size: 0.9em;">${data.appreciation || '<em style="color:#94a3b8;">Non rédigée</em>'}</td>
                                </tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                </div>

                <div class="conseil-export-section">
                    <button id="conseil-print-btn" style="background: #6366f1; color: white;">🖨️ Imprimer le bilan</button>
                    <button id="conseil-export-csv-btn" style="background: #10b981; color: white;">📊 Exporter CSV</button>
                    <button id="conseil-export-pdf-btn" style="background: #3b82f6; color: white;">📄 Exporter PDF</button>
                </div>
            `;
        },

        // ===== UTILITAIRES =====
        median: function(values) {
            const sorted = [...values].sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
        },

        // ===== ÉVÉNEMENTS =====
        bindEvents: function() {
            const self = this;

            // Sélection de classe
            const classSelect = document.getElementById('conseil-class-select');
            if (classSelect) {
                classSelect.addEventListener('change', function() {
                    self.currentClass = this.value;
                    const mainContent = document.getElementById('conseil-main-content');
                    if (mainContent) {
                        mainContent.innerHTML = self.currentClass ? self.renderClassContent() : self.renderEmptyState();
                        self.bindTabEvents();
                    }
                });
            }

            // Trimestre
            document.querySelectorAll('.conseil-trimester-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    document.querySelectorAll('.conseil-trimester-btn').forEach(b => b.classList.remove('active'));
                    this.classList.add('active');
                    self.currentTrimester = this.dataset.trim;
                    const mainContent = document.getElementById('conseil-main-content');
                    if (mainContent) {
                        mainContent.innerHTML = self.currentClass ? self.renderClassContent() : self.renderEmptyState();
                        self.bindTabEvents();
                    }
                });
            });

            // Sauvegarder
            const saveBtn = document.getElementById('conseil-save-btn');
            if (saveBtn) {
                saveBtn.addEventListener('click', function() {
                    self.saveAllAppreciations();
                    self.saveData();
                    this.textContent = '✅ Sauvegardé !';
                    this.style.background = '#059669';
                    setTimeout(() => { this.textContent = '💾 Sauvegarder'; this.style.background = '#10b981'; }, 2000);
                });
            }

            // Export JSON
            const exportBtn = document.getElementById('conseil-export-btn');
            if (exportBtn) {
                exportBtn.addEventListener('click', function() {
                    self.saveAllAppreciations();
                    self.saveData();
                    const data = JSON.stringify({
                        appreciations: self.appreciations,
                        generalAppreciation: self.generalAppreciation,
                        importedGrades: self.importedGrades,
                        exportDate: new Date().toISOString()
                    }, null, 2);
                    const blob = new Blob([data], { type: 'application/json' });
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = `conseil-classe-${self.currentClass || 'all'}-${new Date().toISOString().slice(0,10)}.json`;
                    a.click();
                    URL.revokeObjectURL(a.href);
                });
            }

            // Import JSON
            const importBtn = document.getElementById('conseil-import-btn');
            const importFile = document.getElementById('conseil-import-file');
            if (importBtn && importFile) {
                importBtn.addEventListener('click', () => importFile.click());
                importFile.addEventListener('change', function(e) {
                    const file = e.target.files[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = function(evt) {
                        try {
                            const data = JSON.parse(evt.target.result);
                            if (data.appreciations) self.appreciations = { ...self.appreciations, ...data.appreciations };
                            if (data.generalAppreciation) self.generalAppreciation = { ...self.generalAppreciation, ...data.generalAppreciation };
                            if (data.importedGrades) self.importedGrades = { ...self.importedGrades, ...data.importedGrades };
                            self.saveData();
                            alert('✅ Données importées avec succès !');
                            self.render();
                        } catch (err) {
                            alert('❌ Erreur lors de l\'import : ' + err.message);
                        }
                    };
                    reader.readAsText(file);
                });
            }

            this.bindTabEvents();
        },

        bindTabEvents: function() {
            const self = this;

            // Onglets
            document.querySelectorAll('.conseil-tab').forEach(tab => {
                tab.addEventListener('click', function() {
                    document.querySelectorAll('.conseil-tab').forEach(t => t.classList.remove('active'));
                    document.querySelectorAll('.conseil-tab-content').forEach(c => c.classList.remove('active'));
                    this.classList.add('active');
                    const content = document.getElementById('conseil-tab-' + this.dataset.tab);
                    if (content) content.classList.add('active');
                });
            });

            // Sauvegarder appréciation individuelle
            document.querySelectorAll('.conseil-save-appreciation').forEach(btn => {
                btn.addEventListener('click', function() {
                    const key = this.dataset.key;
                    const textarea = document.querySelector(`.appreciation-input[data-key="${key}"]`);
                    if (textarea) {
                        if (!self.appreciations[self.currentClass]) self.appreciations[self.currentClass] = {};
                        self.appreciations[self.currentClass][key] = { text: textarea.value, date: new Date().toISOString() };
                        self.saveData();
                        this.textContent = '✅ OK';
                        setTimeout(() => { this.textContent = '💾 Sauvegarder'; }, 1500);
                    }
                });
            });

            // Effacer appréciation
            document.querySelectorAll('.conseil-clear-appreciation').forEach(btn => {
                btn.addEventListener('click', function() {
                    const key = this.dataset.key;
                    const textarea = document.querySelector(`.appreciation-input[data-key="${key}"]`);
                    if (textarea) {
                        textarea.value = '';
                        if (self.appreciations[self.currentClass]?.[key]) {
                            delete self.appreciations[self.currentClass][key];
                            self.saveData();
                        }
                    }
                });
            });

            // Templates d'appréciation
            document.querySelectorAll('.conseil-template-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const key = this.dataset.key;
                    const niveau = this.dataset.niveau;
                    const idx = parseInt(this.dataset.template);
                    const templates = self.templates[niveau] || self.templates.moyen;
                    const textarea = document.querySelector(`.appreciation-input[data-key="${key}"]`);
                    if (textarea && templates[idx]) {
                        textarea.value = templates[idx];
                    }
                });
            });

            // Sauvegarder appréciation générale
            const saveGeneral = document.getElementById('conseil-save-general');
            if (saveGeneral) {
                saveGeneral.addEventListener('click', function() {
                    const textarea = document.getElementById('conseil-general-text');
                    if (textarea) {
                        if (!self.generalAppreciation[self.currentClass]) self.generalAppreciation[self.currentClass] = {};
                        self.generalAppreciation[self.currentClass][self.currentTrimester] = textarea.value;
                        self.saveData();
                        this.textContent = '✅ Sauvegardé !';
                        setTimeout(() => { this.textContent = '💾 Sauvegarder l\'appréciation générale'; }, 2000);
                    }
                });
            }

            // Tout déplier / replier
            const expandAll = document.getElementById('conseil-expand-all');
            if (expandAll) {
                expandAll.addEventListener('click', function() {
                    document.querySelectorAll('.conseil-appreciation-card').forEach(c => c.style.display = 'block');
                });
            }
            const collapseAll = document.getElementById('conseil-collapse-all');
            if (collapseAll) {
                collapseAll.addEventListener('click', function() {
                    document.querySelectorAll('.conseil-appreciation-card').forEach(c => {
                        c.querySelector('.conseil-appreciation-textarea').style.display = 'none';
                        c.querySelector('.conseil-appreciation-actions').style.display = 'none';
                        c.querySelector('.conseil-templates').style.display = 'none';
                    });
                });
            }

            // Auto-remplir les appréciations
            const autoBtn = document.getElementById('conseil-auto-appreciate');
            if (autoBtn) {
                autoBtn.addEventListener('click', function() {
                    if (!confirm('Pré-remplir automatiquement les appréciations vides avec un modèle adapté au niveau de chaque élève ?')) return;
                    const students = typeof LISTES_ELEVES !== 'undefined' ? LISTES_ELEVES[self.currentClass] || [] : [];
                    students.forEach(s => {
                        const key = `${s.nom}-${s.prenom}`;
                        const textarea = document.querySelector(`.appreciation-input[data-key="${key}"]`);
                        if (textarea && !textarea.value.trim()) {
                            const avg = self.calculateStudentAverage(self.currentClass, key, self.currentTrimester);
                            const niveau = self.getNiveau(avg);
                            const templates = self.getTemplatesForNiveau(niveau.label);
                            const randomTemplate = templates[Math.floor(Math.random() * templates.length)];
                            textarea.value = randomTemplate;
                        }
                    });
                });
            }

            // Import CSV notes
            const csvBtn = document.getElementById('conseil-csv-btn');
            const csvInput = document.getElementById('conseil-csv-input');
            if (csvBtn && csvInput) {
                csvBtn.addEventListener('click', () => csvInput.click());
                csvInput.addEventListener('change', function(e) {
                    const file = e.target.files[0];
                    if (!file) return;
                    self.importCSVGrades(file);
                });
            }

            // Import CSV appréciations
            const appCsvBtn = document.getElementById('conseil-appreciation-csv-btn');
            const appCsvInput = document.getElementById('conseil-appreciation-csv-input');
            if (appCsvBtn && appCsvInput) {
                appCsvBtn.addEventListener('click', () => appCsvInput.click());
                appCsvInput.addEventListener('change', function(e) {
                    const file = e.target.files[0];
                    if (!file) return;
                    self.importCSVAppreciations(file);
                });
            }

            // Export CSV
            const exportCsvBtn = document.getElementById('conseil-export-csv-btn');
            if (exportCsvBtn) {
                exportCsvBtn.addEventListener('click', () => self.exportToCSV());
            }

            // Print
            const printBtn = document.getElementById('conseil-print-btn');
            if (printBtn) {
                printBtn.addEventListener('click', () => self.printBilan());
            }

            // Export PDF (via print)
            const exportPdfBtn = document.getElementById('conseil-export-pdf-btn');
            if (exportPdfBtn) {
                exportPdfBtn.addEventListener('click', () => self.printBilan());
            }
        },

        // Sauvegarder toutes les appréciations visibles
        saveAllAppreciations: function() {
            document.querySelectorAll('.appreciation-input').forEach(textarea => {
                const key = textarea.dataset.key;
                if (key && textarea.value.trim()) {
                    if (!this.appreciations[this.currentClass]) this.appreciations[this.currentClass] = {};
                    this.appreciations[this.currentClass][key] = { text: textarea.value, date: new Date().toISOString() };
                }
            });
            const generalTextarea = document.getElementById('conseil-general-text');
            if (generalTextarea && generalTextarea.value.trim()) {
                if (!this.generalAppreciation[this.currentClass]) this.generalAppreciation[this.currentClass] = {};
                this.generalAppreciation[this.currentClass][this.currentTrimester] = generalTextarea.value;
            }
        },

        // Import CSV de notes
        importCSVGrades: function(file) {
            const self = this;
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const lines = e.target.result.split('\n').filter(l => l.trim());
                    if (lines.length < 2) { alert('Fichier vide ou invalide.'); return; }
                    const headers = lines[0].split(/[;,]/).map(h => h.trim().replace(/^"|"$/g, ''));
                    const data = [];
                    for (let i = 1; i < lines.length; i++) {
                        const cols = lines[i].split(/[;,]/).map(c => c.trim().replace(/^"|"$/g, ''));
                        if (cols.length >= 3) {
                            data.push({
                                nom: cols[0],
                                prenom: cols[1],
                                grades: cols.slice(2).map(g => parseFloat(g) || null)
                            });
                        }
                    }
                    self.importedGrades[self.currentClass || 'import'] = data;
                    self.saveData();
                    alert(`✅ ${data.length} élèves importés avec ${headers.length - 2} colonnes de notes.`);
                    // Re-render import tab
                    const importTab = document.getElementById('conseil-tab-import');
                    if (importTab) importTab.innerHTML = self.renderImport();
                    self.bindTabEvents();
                } catch (err) {
                    alert('❌ Erreur d\'import : ' + err.message);
                }
            };
            reader.readAsText(file);
        },

        // Import CSV d'appréciations
        importCSVAppreciations: function(file) {
            const self = this;
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const lines = e.target.result.split('\n').filter(l => l.trim());
                    let imported = 0;
                    for (let i = 1; i < lines.length; i++) {
                        const cols = lines[i].split(/[;,]/).map(c => c.trim().replace(/^"|"$/g, ''));
                        if (cols.length >= 3) {
                            const key = `${cols[0]}-${cols[1]}`;
                            if (!self.appreciations[self.currentClass]) self.appreciations[self.currentClass] = {};
                            self.appreciations[self.currentClass][key] = { text: cols[2], date: new Date().toISOString() };
                            imported++;
                        }
                    }
                    self.saveData();
                    alert(`✅ ${imported} appréciations importées.`);
                    self.render();
                } catch (err) {
                    alert('❌ Erreur d\'import : ' + err.message);
                }
            };
            reader.readAsText(file);
        },

        // Export CSV
        exportToCSV: function() {
            if (!this.currentClass || typeof LISTES_ELEVES === 'undefined') return;
            const students = LISTES_ELEVES[this.currentClass] || [];
            const trimLabel = this.currentTrimester === 'trimestre1' ? 'T1' : this.currentTrimester === 'trimestre2' ? 'T2' : 'T3';
            
            let csv = 'Nom,Prénom,Moyenne,Niveau,Appréciation\n';
            students.forEach(s => {
                const data = this.getStudentData(this.currentClass, s);
                const niveau = this.getNiveau(data.moyenne);
                const appreciation = (data.appreciation || '').replace(/"/g, '""');
                csv += `"${s.nom}","${s.prenom}",${data.moyenne !== null ? data.moyenne.toFixed(1) : ''},"${niveau.label}","${appreciation}"\n`;
            });

            const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `conseil-${this.currentClass}-${trimLabel}-${new Date().toISOString().slice(0,10)}.csv`;
            a.click();
            URL.revokeObjectURL(a.href);
        },

        // Impression du bilan
        printBilan: function() {
            if (!this.currentClass || typeof LISTES_ELEVES === 'undefined') return;
            this.saveAllAppreciations();
            this.saveData();

            const students = LISTES_ELEVES[this.currentClass] || [];
            const classAvg = this.calculateClassAverage(this.currentClass, this.currentTrimester);
            const generalText = this.generalAppreciation[this.currentClass]?.[this.currentTrimester] || '';
            const trimLabel = this.currentTrimester === 'trimestre1' ? 'Trimestre 1' : this.currentTrimester === 'trimestre2' ? 'Trimestre 2' : 'Trimestre 3';

            let rows = '';
            students.forEach((s, i) => {
                const data = this.getStudentData(this.currentClass, s);
                const niveau = this.getNiveau(data.moyenne);
                rows += `<tr>
                    <td>${i + 1}</td>
                    <td><strong>${s.prenom} ${s.nom}</strong></td>
                    <td>${data.moyenne !== null ? data.moyenne.toFixed(1) : '--'}</td>
                    <td>${niveau.label}</td>
                    <td style="font-size: 0.9em;">${data.appreciation || ''}</td>
                </tr>`;
            });

            const printWindow = window.open('', '_blank');
            printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
                <title>Conseil de classe - ${this.currentClass} - ${trimLabel}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 30px; line-height: 1.5; }
                    h1 { color: #4338ca; border-bottom: 3px solid #4338ca; padding-bottom: 10px; }
                    h2 { color: #1e293b; margin-top: 30px; }
                    table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 0.9em; }
                    th { background: #4338ca; color: white; padding: 10px; text-align: left; }
                    td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
                    tr:nth-child(even) { background: #f8fafc; }
                    .info-box { background: #f0f4ff; padding: 15px; border-radius: 8px; margin: 15px 0; }
                    .general { background: #f8fafc; padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px; margin: 20px 0; }
                    @media print { body { padding: 10px; } }
                </style></head><body>
                <h1>🎓 Conseil de classe - ${this.currentClass}</h1>
                <div class="info-box">
                    <strong>${trimLabel}</strong> | 
                    Effectif : ${students.length} élèves | 
                    Moyenne de classe : <strong>${classAvg !== null ? classAvg.toFixed(1) + '/20' : 'N/A'}</strong>
                </div>
                ${generalText ? `<div class="general"><h3>Appréciation générale</h3><p>${generalText}</p></div>` : ''}
                <h2>Appréciations individuelles</h2>
                <table>
                    <thead><tr><th>#</th><th>Élève</th><th>Moyenne</th><th>Niveau</th><th>Appréciation</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
                <p style="text-align: center; color: #94a3b8; margin-top: 40px; font-size: 0.85em;">
                    eProf - Lycée Jeanne Delanoue - Généré le ${new Date().toLocaleDateString('fr-FR')}
                </p>
                <script>window.onload=function(){window.print();}<\/script>
                </body></html>`);
            printWindow.document.close();
        }
    };

    // Exposer le module globalement
    window.ConseilClasse = ConseilClasse;
})();
