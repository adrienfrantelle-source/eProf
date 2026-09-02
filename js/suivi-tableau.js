// Tableaux de suivi dynamiques (par classe), dans le module Suivi des élèves.
(function () {
    const DOC_TYPE = 'suivi_tableaux';
    const TYPES = {
        checkbox: { label: 'Case à cocher', hint: 'Rendu, fait / non fait' },
        note: { label: 'Note', hint: 'Note chiffrée, avec un barème au choix' },
        texte: { label: 'Texte', hint: 'Identifiant, commentaire, référence' },
        date: { label: 'Date', hint: 'Date de rendu ou d’événement' },
        choix: { label: 'Liste de choix', hint: 'Oui / Non, niveaux, statuts…' }
    };

    let syncTimer = null;
    let cache = {};

    function uid() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }

    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function storageKey() {
        if (window.teacherManager && window.teacherManager.getCurrentTeacher()) {
            return window.teacherManager.getStorageKey('suiviTableaux');
        }
        return 'suiviTableaux';
    }

    function lireLocal() {
        try {
            const specifique = JSON.parse(localStorage.getItem(storageKey()) || 'null');
            if (specifique && typeof specifique === 'object' && Object.keys(specifique).length) {
                return specifique;
            }
        } catch (e) { /* ignore */ }
        try {
            return JSON.parse(localStorage.getItem('suiviTableaux') || '{}');
        } catch (e) {
            return {};
        }
    }

    function ecrireLocal(data) {
        cache = data || {};
        localStorage.setItem(storageKey(), JSON.stringify(cache));
        localStorage.setItem('suiviTableaux', JSON.stringify(cache));
    }

    function hasContent(data) {
        if (!data || typeof data !== 'object') return false;
        return Object.keys(data).some(function (classe) {
            const feuilles = (data[classe] && data[classe].feuilles) || [];
            return feuilles.some(function (f) {
                return (f.colonnes && f.colonnes.length) || (f.valeurs && Object.keys(f.valeurs).length);
            });
        });
    }

    async function chargerEnLigne() {
        if (!window.EprofStore || !await window.EprofStore.isOnlineReady()) return null;
        const { data, error } = await window.EprofStore.getTeacherDocument(DOC_TYPE);
        if (error || !data) return null;
        return data.data || null;
    }

    async function sauvegarderEnLigne(data) {
        if (!window.EprofStore || !await window.EprofStore.isOnlineReady()) return false;
        const { error } = await window.EprofStore.saveTeacherDocument(DOC_TYPE, data);
        if (error) console.error('❌ Tableaux de suivi : sauvegarde en ligne échouée', error);
        return !error;
    }

    function planifierSync() {
        clearTimeout(syncTimer);
        syncTimer = setTimeout(function () { sauvegarderEnLigne(cache); }, 1500);
        if (window.dataManager) window.dataManager.triggerAutoSave();
    }

    function sauvegarder() {
        ecrireLocal(cache);
        planifierSync();
    }

    function ensureClasse(classe) {
        if (!cache[classe]) {
            cache[classe] = { feuilles: [], feuilleActiveId: null };
        }
        if (!cache[classe].feuilles.length) {
            const id = uid();
            cache[classe].feuilles.push({
                id: id,
                titre: 'Suivi',
                colonnes: [],
                valeurs: {}
            });
            cache[classe].feuilleActiveId = id;
        }
        const ids = cache[classe].feuilles.map(function (f) { return f.id; });
        if (!ids.includes(cache[classe].feuilleActiveId)) {
            cache[classe].feuilleActiveId = cache[classe].feuilles[0].id;
        }
        return cache[classe];
    }

    function feuilleActive(classe) {
        const pack = ensureClasse(classe);
        return pack.feuilles.find(function (f) { return f.id === pack.feuilleActiveId; }) || pack.feuilles[0];
    }

    function valeurEleve(feuille, nom, colId) {
        const row = (feuille.valeurs && feuille.valeurs[nom]) || {};
        return row[colId];
    }

    function setValeur(feuille, nom, colId, value) {
        if (!feuille.valeurs) feuille.valeurs = {};
        if (!feuille.valeurs[nom]) feuille.valeurs[nom] = {};
        if (value === '' || value === undefined || value === null) {
            delete feuille.valeurs[nom][colId];
        } else {
            feuille.valeurs[nom][colId] = value;
        }
    }

    function typesOptionsHtml(selected) {
        return Object.keys(TYPES).map(function (key) {
            return '<option value="' + key + '"' + (selected === key ? ' selected' : '') + '>' + TYPES[key].label + '</option>';
        }).join('');
    }

    function injectUi(container) {
        if (container.querySelector('#tableau-suivi-panel')) return;

        const liste = container.querySelector('#liste-eleves-suivi');
        if (!liste) return;

        const panel = document.createElement('div');
        panel.id = 'tableau-suivi-panel';
        panel.className = 'tableau-suivi-panel';
        panel.style.display = 'none';
        panel.innerHTML = `
            <div class="ts-toolbar">
                <div class="ts-feuilles" id="ts-feuilles"></div>
                <div class="ts-toolbar-actions">
                    <button type="button" id="ts-nouvelle-feuille" class="btn-secondary">+ Feuille</button>
                    <button type="button" id="ts-renommer-feuille" class="btn-secondary">✏️ Renommer</button>
                    <button type="button" id="ts-supprimer-feuille" class="btn-secondary">🗑️ Feuille</button>
                    <button type="button" id="ts-ajouter-colonne" class="btn-primary">+ Colonne</button>
                </div>
            </div>
            <p class="ts-hint" id="ts-hint"></p>
            <div class="ts-table-wrap" id="ts-table-wrap"></div>
        `;
        liste.appendChild(panel);

        const modale = document.createElement('div');
        modale.id = 'modale-colonne-suivi';
        modale.className = 'modale-eleve';
        modale.style.display = 'none';
        modale.innerHTML = `
            <div class="modale-eleve-content" style="max-width: 480px;">
                <span class="close-modale-colonne-suivi">&times;</span>
                <h3 id="ts-colonne-titre-modale">Nouvelle colonne</h3>
                <p class="fiche-suivi-hint">Choisissez le type de saisie : ce sera une colonne du tableau, comme une évaluation dans le carnet de notes.</p>
                <label class="ts-field">
                    <span>Intitulé</span>
                    <input type="text" id="ts-col-intitule" placeholder="ex. Rendu livret, Oral 1, Groupe…">
                </label>
                <label class="ts-field">
                    <span>Type de notation</span>
                    <select id="ts-col-type">${typesOptionsHtml('checkbox')}</select>
                </label>
                <p class="ts-type-hint" id="ts-col-type-hint"></p>
                <label class="ts-field ts-opt-note" style="display:none;">
                    <span>Note sur</span>
                    <input type="number" id="ts-col-max" min="1" step="1" value="20">
                </label>
                <label class="ts-field ts-opt-choix" style="display:none;">
                    <span>Choix possibles (séparés par des virgules)</span>
                    <input type="text" id="ts-col-choix" placeholder="Oui, Non, Partiel">
                </label>
                <div style="display:flex; gap:10px; margin-top:16px; flex-wrap:wrap;">
                    <button type="button" id="ts-col-valider" class="btn-primary" style="flex:1;">Enregistrer</button>
                    <button type="button" class="close-modale-colonne-suivi-btn btn-secondary" style="flex:1;">Annuler</button>
                    <button type="button" id="ts-col-supprimer" class="btn-secondary" style="display:none; flex:1; background:#ef4444;">Supprimer la colonne</button>
                </div>
            </div>
        `;
        container.appendChild(modale);
    }

    function resumeCheckbox(feuille, col, eleves) {
        let n = 0;
        eleves.forEach(function (e) {
            if (valeurEleve(feuille, e.nomComplet, col.id) === true) n++;
        });
        return n + '/' + eleves.length;
    }

    function resumeNote(feuille, col, eleves) {
        const max = Number(col.max) || 20;
        let somme = 0;
        let nb = 0;
        eleves.forEach(function (e) {
            const v = parseFloat(valeurEleve(feuille, e.nomComplet, col.id));
            if (!isNaN(v)) {
                somme += (v / max) * 20;
                nb++;
            }
        });
        if (!nb) return '—';
        return (somme / nb).toFixed(1) + '/20';
    }

    function celluleHtml(feuille, eleve, col, eleveIndex) {
        const nom = eleve.nomComplet;
        const val = valeurEleve(feuille, nom, col.id);
        const attrs = 'data-eleve-index="' + eleveIndex + '" data-col-id="' + esc(col.id) + '"';
        if (col.type === 'checkbox') {
            return '<td class="ts-cell-check"><input type="checkbox" class="ts-input" ' + attrs + (val === true ? ' checked' : '') + '></td>';
        }
        if (col.type === 'note') {
            const max = Number(col.max) || 20;
            return '<td><input type="text" inputmode="decimal" class="ts-input ts-input-note" ' + attrs + ' data-max="' + max + '" value="' + esc(val == null ? '' : val) + '" placeholder="/' + max + '"></td>';
        }
        if (col.type === 'date') {
            return '<td><input type="date" class="ts-input" ' + attrs + ' value="' + esc(val || '') + '"></td>';
        }
        if (col.type === 'choix') {
            const options = (col.options || []).filter(Boolean);
            const opts = ['<option value=""></option>'].concat(options.map(function (o) {
                return '<option value="' + esc(o) + '"' + (String(val) === String(o) ? ' selected' : '') + '>' + esc(o) + '</option>';
            }));
            return '<td><select class="ts-input" ' + attrs + '>' + opts.join('') + '</select></td>';
        }
        return '<td><input type="text" class="ts-input" ' + attrs + ' value="' + esc(val == null ? '' : val) + '" placeholder="…"></td>';
    }

    function renderFeuilles(container, classe) {
        const pack = ensureClasse(classe);
        const wrap = container.querySelector('#ts-feuilles');
        if (!wrap) return;
        wrap.innerHTML = pack.feuilles.map(function (f) {
            const active = f.id === pack.feuilleActiveId ? ' active' : '';
            return '<button type="button" class="ts-feuille-btn' + active + '" data-feuille-id="' + esc(f.id) + '">' + esc(f.titre) + '</button>';
        }).join('');
    }

    function renderTable(container, classe, eleves) {
        const feuille = feuilleActive(classe);
        const wrap = container.querySelector('#ts-table-wrap');
        const hint = container.querySelector('#ts-hint');
        if (!wrap) return;

        hint.textContent = feuille.colonnes.length
            ? 'Saisie directe dans le tableau. Cliquez sur l’en-tête d’une colonne pour la modifier.'
            : 'Aucune colonne pour l’instant. Ajoutez par exemple « Rendu du document », une note, ou une identification.';

        if (!eleves.length) {
            wrap.innerHTML = '<p class="ts-empty">Aucun élève dans cette classe.</p>';
            return;
        }

        let html = '<table class="tableau-suivi-table"><thead><tr>';
        html += '<th class="ts-col-eleve">Élève</th>';
        feuille.colonnes.forEach(function (col) {
            const typeLabel = (TYPES[col.type] || {}).label || col.type;
            const extra = col.type === 'note' ? ' /' + (col.max || 20) : '';
            html += '<th class="ts-col-header" data-col-id="' + esc(col.id) + '" title="Cliquer pour modifier">';
            html += '<span class="ts-col-title">' + esc(col.titre) + extra + '</span>';
            html += '<span class="ts-col-type">' + esc(typeLabel) + '</span>';
            html += '</th>';
        });
        html += '</tr></thead><tbody>';

        eleves.forEach(function (eleve, index) {
            html += '<tr>';
            html += '<td class="ts-nom-eleve">' + esc(eleve.nomComplet) + '</td>';
            feuille.colonnes.forEach(function (col) {
                html += celluleHtml(feuille, eleve, col, index);
            });
            html += '</tr>';
        });

        if (feuille.colonnes.length) {
            html += '<tr class="ts-resume"><td>Bilan</td>';
            feuille.colonnes.forEach(function (col) {
                let txt = '—';
                if (col.type === 'checkbox') txt = resumeCheckbox(feuille, col, eleves);
                else if (col.type === 'note') txt = resumeNote(feuille, col, eleves);
                html += '<td>' + esc(txt) + '</td>';
            });
            html += '</tr>';
        }

        html += '</tbody></table>';
        wrap.innerHTML = html;
    }

    function majTypeHint(container) {
        const type = (container.querySelector('#ts-col-type') || {}).value || 'checkbox';
        const hint = container.querySelector('#ts-col-type-hint');
        if (hint) hint.textContent = (TYPES[type] || {}).hint || '';
        const note = container.querySelector('.ts-opt-note');
        const choix = container.querySelector('.ts-opt-choix');
        if (note) note.style.display = type === 'note' ? '' : 'none';
        if (choix) choix.style.display = type === 'choix' ? '' : 'none';
    }

    function ouvrirModaleColonne(container, col) {
        const modale = container.querySelector('#modale-colonne-suivi');
        const titre = container.querySelector('#ts-colonne-titre-modale');
        const intitule = container.querySelector('#ts-col-intitule');
        const type = container.querySelector('#ts-col-type');
        const max = container.querySelector('#ts-col-max');
        const choix = container.querySelector('#ts-col-choix');
        modale.dataset.colId = col && col.id ? col.id : '';
        titre.textContent = col ? 'Modifier la colonne' : 'Nouvelle colonne';
        intitule.value = col ? (col.titre || '') : '';
        type.value = col ? (col.type || 'checkbox') : 'checkbox';
        max.value = col && col.max ? col.max : 20;
        choix.value = col && col.options ? col.options.join(', ') : 'Oui, Non, Partiel';
        const btnSuppr = container.querySelector('#ts-col-supprimer');
        if (btnSuppr) btnSuppr.style.display = col && col.id ? '' : 'none';
        majTypeHint(container);
        modale.style.display = 'flex';
        intitule.focus();
    }

    function fermerModaleColonne(container) {
        const modale = container.querySelector('#modale-colonne-suivi');
        if (modale) modale.style.display = 'none';
    }

    function rafraichir(container, getClasse, getEleves) {
        const classe = getClasse();
        if (!classe) return;
        renderFeuilles(container, classe);
        renderTable(container, classe, getEleves() || []);
    }

    function attach(container, api) {
        injectUi(container);
        cache = lireLocal();

        const panel = container.querySelector('#tableau-suivi-panel');
        const btnToggle = container.querySelector('#ouvrir-tableau-suivi-btn');
        const grille = container.querySelector('#grille-eleves-suivi');
        if (!panel || !btnToggle) return;

        function estOuvert() {
            return panel.style.display !== 'none';
        }

        function ouvrir() {
            if (!api.getClasse()) return;
            panel.style.display = 'block';
            if (grille) grille.style.display = 'none';
            btnToggle.textContent = '👥 Fiches élèves';
            rafraichir(container, api.getClasse, api.getEleves);
        }

        function fermer() {
            panel.style.display = 'none';
            if (grille) grille.style.display = '';
            btnToggle.textContent = '📊 Tableau de suivi';
            fermerModaleColonne(container);
        }

        btnToggle.addEventListener('click', function () {
            if (estOuvert()) fermer();
            else ouvrir();
        });

        container.querySelector('#ts-nouvelle-feuille').addEventListener('click', function () {
            const classe = api.getClasse();
            if (!classe) return;
            const titre = prompt('Nom de la nouvelle feuille :', 'Nouveau suivi');
            if (!titre || !titre.trim()) return;
            const pack = ensureClasse(classe);
            const id = uid();
            pack.feuilles.push({ id: id, titre: titre.trim(), colonnes: [], valeurs: {} });
            pack.feuilleActiveId = id;
            sauvegarder();
            rafraichir(container, api.getClasse, api.getEleves);
        });

        container.querySelector('#ts-renommer-feuille').addEventListener('click', function () {
            const classe = api.getClasse();
            if (!classe) return;
            const feuille = feuilleActive(classe);
            const titre = prompt('Nouveau nom de la feuille :', feuille.titre);
            if (!titre || !titre.trim()) return;
            feuille.titre = titre.trim();
            sauvegarder();
            rafraichir(container, api.getClasse, api.getEleves);
        });

        container.querySelector('#ts-supprimer-feuille').addEventListener('click', function () {
            const classe = api.getClasse();
            if (!classe) return;
            const pack = ensureClasse(classe);
            if (pack.feuilles.length <= 1) {
                if (!confirm('Supprimer toutes les colonnes et saisies de cette feuille ?')) return;
                pack.feuilles[0].colonnes = [];
                pack.feuilles[0].valeurs = {};
            } else {
                const feuille = feuilleActive(classe);
                if (!confirm('Supprimer la feuille « ' + feuille.titre + ' » ?')) return;
                pack.feuilles = pack.feuilles.filter(function (f) { return f.id !== feuille.id; });
                pack.feuilleActiveId = pack.feuilles[0].id;
            }
            sauvegarder();
            rafraichir(container, api.getClasse, api.getEleves);
        });

        container.querySelector('#ts-ajouter-colonne').addEventListener('click', function () {
            ouvrirModaleColonne(container, null);
        });

        container.querySelector('#ts-col-type').addEventListener('change', function () {
            majTypeHint(container);
        });

        container.querySelector('#ts-col-valider').addEventListener('click', function () {
            const classe = api.getClasse();
            if (!classe) return;
            const intitule = (container.querySelector('#ts-col-intitule').value || '').trim();
            if (!intitule) {
                alert('Indiquez un intitulé pour la colonne.');
                return;
            }
            const type = container.querySelector('#ts-col-type').value;
            const max = parseFloat(container.querySelector('#ts-col-max').value);
            const options = (container.querySelector('#ts-col-choix').value || '')
                .split(',')
                .map(function (s) { return s.trim(); })
                .filter(Boolean);
            const feuille = feuilleActive(classe);
            const colId = container.querySelector('#modale-colonne-suivi').dataset.colId;
            if (colId) {
                const col = feuille.colonnes.find(function (c) { return c.id === colId; });
                if (col) {
                    col.titre = intitule;
                    col.type = type;
                    col.max = type === 'note' ? (max > 0 ? max : 20) : undefined;
                    col.options = type === 'choix' ? (options.length ? options : ['Oui', 'Non']) : undefined;
                }
            } else {
                feuille.colonnes.push({
                    id: uid(),
                    titre: intitule,
                    type: type,
                    max: type === 'note' ? (max > 0 ? max : 20) : undefined,
                    options: type === 'choix' ? (options.length ? options : ['Oui', 'Non']) : undefined
                });
            }
            sauvegarder();
            fermerModaleColonne(container);
            rafraichir(container, api.getClasse, api.getEleves);
        });

        container.querySelectorAll('.close-modale-colonne-suivi, .close-modale-colonne-suivi-btn').forEach(function (el) {
            el.addEventListener('click', function () { fermerModaleColonne(container); });
        });
        container.querySelector('#modale-colonne-suivi').addEventListener('click', function (e) {
            if (e.target.id === 'modale-colonne-suivi') fermerModaleColonne(container);
        });

        container.querySelector('#ts-feuilles').addEventListener('click', function (e) {
            const btn = e.target.closest('.ts-feuille-btn');
            if (!btn) return;
            const classe = api.getClasse();
            if (!classe) return;
            ensureClasse(classe).feuilleActiveId = btn.getAttribute('data-feuille-id');
            sauvegarder();
            rafraichir(container, api.getClasse, api.getEleves);
        });

        container.querySelector('#ts-col-supprimer').addEventListener('click', function () {
            const classe = api.getClasse();
            if (!classe) return;
            const colId = container.querySelector('#modale-colonne-suivi').dataset.colId;
            if (!colId) return;
            const feuille = feuilleActive(classe);
            const col = feuille.colonnes.find(function (c) { return c.id === colId; });
            if (!col) return;
            if (!confirm('Supprimer définitivement la colonne « ' + col.titre + ' » ?')) return;
            feuille.colonnes = feuille.colonnes.filter(function (c) { return c.id !== col.id; });
            Object.keys(feuille.valeurs || {}).forEach(function (nom) {
                if (feuille.valeurs[nom]) delete feuille.valeurs[nom][col.id];
            });
            sauvegarder();
            fermerModaleColonne(container);
            rafraichir(container, api.getClasse, api.getEleves);
        });

        container.querySelector('#ts-table-wrap').addEventListener('click', function (e) {
            const th = e.target.closest('.ts-col-header');
            if (!th) return;
            const classe = api.getClasse();
            if (!classe) return;
            const feuille = feuilleActive(classe);
            const col = feuille.colonnes.find(function (c) { return c.id === th.getAttribute('data-col-id'); });
            if (!col) return;
            ouvrirModaleColonne(container, col);
        });

        container.querySelector('#ts-table-wrap').addEventListener('change', function (e) {
            const input = e.target.closest('.ts-input');
            if (!input) return;
            const classe = api.getClasse();
            const eleves = api.getEleves() || [];
            if (!classe) return;
            const eleve = eleves[Number(input.getAttribute('data-eleve-index'))];
            const colId = input.getAttribute('data-col-id');
            if (!eleve || !colId) return;
            const feuille = feuilleActive(classe);
            const col = feuille.colonnes.find(function (c) { return c.id === colId; });
            if (!col) return;

            let value;
            if (col.type === 'checkbox') {
                value = input.checked ? true : '';
            } else if (col.type === 'note') {
                const raw = String(input.value || '').trim().replace(',', '.');
                if (!raw) value = '';
                else if (/^(abs|disp)$/i.test(raw)) value = raw.toLowerCase();
                else {
                    const n = parseFloat(raw);
                    const max = Number(col.max) || 20;
                    if (isNaN(n) || n < 0 || n > max) {
                        alert('Note invalide (0 à ' + max + ', ou abs).');
                        input.value = valeurEleve(feuille, eleve.nomComplet, colId) || '';
                        return;
                    }
                    value = n;
                }
            } else {
                value = input.value;
            }
            setValeur(feuille, eleve.nomComplet, colId, value);
            sauvegarder();
            if (col.type === 'checkbox' || col.type === 'note') {
                rafraichir(container, api.getClasse, api.getEleves);
            }
        });

        container._eprofSuiviTableau = { ouvrir: ouvrir, fermer: fermer, rafraichir: function () {
            rafraichir(container, api.getClasse, api.getEleves);
        } };
    }

    async function hydrater() {
        cache = lireLocal();
        const distant = await chargerEnLigne();
        if (hasContent(distant)) {
            ecrireLocal(distant);
        }
        return cache;
    }

    window.addEventListener('teacherLoggedIn', function () {
        hydrater();
    });
    if (window.teacherManager && window.teacherManager.getCurrentTeacher()) {
        hydrater();
    }

    window.EprofSuiviTableau = {
        hydrater: hydrater,
        attach: attach,
        fermer: function (container) {
            if (container && container._eprofSuiviTableau) container._eprofSuiviTableau.fermer();
        }
    };
})();
