/* Conseil de classe — réservé aux professeurs principaux, données en ligne. */
(function (global) {
    var DOC_TYPE = 'conseil_classe';
    var TABS = [
        { id: 'vue', label: 'Vue d’ensemble' },
        { id: 'moyennes', label: 'Moyennes' },
        { id: 'sanctions', label: 'Sanctions' },
        { id: 'retours', label: 'Retour des profs' },
        { id: 'appreciations', label: 'Appréciations' },
        { id: 'synthese', label: 'Synthèse' }
    ];
    var AN_ID = 'AN';
    var SANCTIONS = [
        { id: 'mots', label: 'Mot', needsProf: true },
        { id: 'retenue', label: 'Retenue', needsProf: true },
        { id: 'avertissement_oral', label: 'Avertissement oral', needsProf: true },
        { id: 'fiche_accompagnement', label: 'Fiche d’accompagnement', objectifs: { min: 2, max: 3 } },
        { id: 'avertissement_ecrit', label: 'Avertissement écrit', needsProf: true },
        { id: 'contrat_educatif', label: 'Contrat éducatif', objectifs: { min: 1, max: 8 } },
        { id: 'exclusion_temporaire', label: 'Exclusion temporaire', duree: true },
        { id: 'exclusion_definitive', label: 'Exclusion définitive' },
        { id: 'conseil_educatif', label: 'Conseil éducatif' },
        { id: 'conseil_discipline', label: 'Conseil de discipline' }
    ];

    var cache = { classes: {} };
    var syncTimer = null;
    var directory = [];
    var view = { classe: '', periode: '', tab: 'vue', eleve: '', search: '' };
    var ready = false;

    function E() { return global.EprofEleves || {}; }
    function esc(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function uid() {
        return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    }
    function annee() {
        return E().getAnneeScolaire ? E().getAnneeScolaire() : '2026-2027';
    }
    function ppClasses() {
        return E().getPpClasses ? E().getPpClasses() : [];
    }
    function periodesReelles(classe) {
        var type = (global.EprofReferentiel && global.EprofReferentiel.getPeriodType)
            ? global.EprofReferentiel.getPeriodType(classe)
            : 'trimestre';
        if (type === 'semestre') {
            return [
                { id: 'S1', label: 'Semestre 1' },
                { id: 'S2', label: 'Semestre 2' }
            ];
        }
        return [
            { id: 'T1', label: 'Trimestre 1' },
            { id: 'T2', label: 'Trimestre 2' },
            { id: 'T3', label: 'Trimestre 3' }
        ];
    }
    function periodesFor(classe) {
        return periodesReelles(classe).concat([{ id: AN_ID, label: 'Année' }]);
    }
    function isAnnee(periode) {
        return periode === AN_ID;
    }
    function eleves(classe) {
        var list = (E().studentsForClass ? E().studentsForClass(classe) : []).slice();
        return list.map(function (e) {
            return {
                nom: e.nom,
                prenom: e.prenom,
                sexe: e.sexe,
                photo_path: e.photo_path || '',
                nomComplet: ((e.prenom || '') + ' ' + String(e.nom || '').toUpperCase()).trim()
            };
        }).sort(function (a, b) {
            return String(a.nom || '').localeCompare(String(b.nom || ''), 'fr');
        });
    }
    function sanctionMeta(id) {
        return SANCTIONS.find(function (s) { return s.id === id; }) || { id: id, label: id };
    }
    function defaultMatieres() {
        var noms = [];
        if (global.EprofReferentiel && global.EprofReferentiel.getSubjectNames) {
            noms = global.EprofReferentiel.getSubjectNames() || [];
        }
        if (!noms.length && global.teacherManager && global.teacherManager.getSubjectCatalog) {
            noms = global.teacherManager.getSubjectCatalog() || [];
        }
        if (!noms.length) {
            noms = ['Anglais', 'Lettres', 'Mathématiques', 'Histoire-géographie', 'EPS', 'EMC'];
        }
        return noms.map(function (nom) {
            return { id: uid(), nom: nom, coef: 1 };
        });
    }
    function classData(classe) {
        if (!cache.classes) cache.classes = {};
        var created = false;
        if (!cache.classes[classe]) {
            cache.classes[classe] = { matieres: defaultMatieres(), periodes: {}, profs: [] };
            created = true;
        }
        if (!cache.classes[classe].matieres || !cache.classes[classe].matieres.length) {
            cache.classes[classe].matieres = defaultMatieres();
            created = true;
        }
        if (!Array.isArray(cache.classes[classe].profs)) cache.classes[classe].profs = [];
        if (ready && created) planifierSync();
        return cache.classes[classe];
    }
    function periodeData(classe, periode) {
        var c = classData(classe);
        if (!c.periodes) c.periodes = {};
        if (!c.periodes[periode]) {
            c.periodes[periode] = { moyennes: {}, appreciations: {}, appreciationClasse: '', sanctions: {}, retoursProfs: {} };
        }
        var p = c.periodes[periode];
        if (!p.moyennes) p.moyennes = {};
        if (!p.appreciations) p.appreciations = {};
        if (!p.sanctions) p.sanctions = {};
        if (!p.retoursProfs || typeof p.retoursProfs !== 'object') p.retoursProfs = {};
        if (typeof p.appreciationClasse !== 'string') p.appreciationClasse = '';
        return p;
    }
    function storageKey() {
        if (global.teacherManager && global.teacherManager.getStorageKey) {
            return global.teacherManager.getStorageKey('conseilClasse');
        }
        return 'conseilClasse';
    }
    function lireLocal() {
        try {
            var raw = JSON.parse(localStorage.getItem(storageKey()) || 'null');
            if (raw && typeof raw === 'object') return raw;
        } catch (e) { /* ignore */ }
        try {
            return JSON.parse(localStorage.getItem('conseilClasse') || '{"classes":{}}');
        } catch (e2) {
            return { classes: {} };
        }
    }
    function ecrireLocal(data) {
        try {
            localStorage.setItem(storageKey(), JSON.stringify(data));
            localStorage.setItem('conseilClasse', JSON.stringify(data));
        } catch (e) { /* quota */ }
    }
    async function chargerEnLigne() {
        if (!global.EprofStore || !(await global.EprofStore.isOnlineReady())) return null;
        var res = await global.EprofStore.getTeacherDocument(DOC_TYPE);
        if (res.error || !res.data) return null;
        return res.data.data || null;
    }
    async function sauverEnLigne(data) {
        if (!global.EprofStore || !(await global.EprofStore.isOnlineReady())) return false;
        var res = await global.EprofStore.saveTeacherDocument(DOC_TYPE, data);
        if (res.error) console.error('❌ Conseil de classe : sauvegarde en ligne échouée', res.error);
        return !res.error;
    }
    function planifierSync() {
        ecrireLocal(cache);
        clearTimeout(syncTimer);
        syncTimer = setTimeout(function () { sauverEnLigne(cache); }, 900);
    }
    async function hydrater() {
        try {
            var local = lireLocal();
            if (local && local.classes) cache = local;
            var distant = await chargerEnLigne();
            if (distant && distant.classes) {
                cache = distant;
                ecrireLocal(cache);
            }
            await chargerDirectory();
        } finally {
            ready = true;
        }
    }
    async function chargerDirectory() {
        directory = [];
        if (!global.EprofStore || !(await global.EprofStore.isOnlineReady())) return;
        try {
            var client = await global.EprofStore.getClient();
            if (!client) return;
            var res = await client.rpc('list_whitelist_teachers');
            if (!res.error && Array.isArray(res.data) && res.data.length) {
                directory = res.data;
                return;
            }
            var alt = await client.rpc('list_teacher_directory');
            if (!alt.error && Array.isArray(alt.data)) directory = alt.data;
        } catch (e) { /* hors ligne */ }
    }
    function profLabel(p) {
        if (!p) return '';
        var n = [p.prenom, p.nom].filter(Boolean).join(' ').trim();
        return n || p.identifiant || '';
    }
    function profKey(p) {
        if (!p) return '';
        return String(p.identifiant || profLabel(p)) + '::' + String(p.matiere || '');
    }
    function noteMatiere(classe, periode, nomComplet, matId) {
        if (isAnnee(periode)) {
            var vals = [];
            periodesReelles(classe).forEach(function (per) {
                var v = ((periodeData(classe, per.id).moyennes || {})[nomComplet] || {})[matId];
                if (v === '' || v == null || isNaN(Number(v))) return;
                vals.push(Number(v));
            });
            return vals.length
                ? vals.reduce(function (a, b) { return a + b; }, 0) / vals.length
                : null;
        }
        var v = ((periodeData(classe, periode).moyennes || {})[nomComplet] || {})[matId];
        if (v === '' || v == null || isNaN(Number(v))) return null;
        return Number(v);
    }
    function moyenneElevePeriode(classe, periode, nomComplet) {
        var matieres = classData(classe).matieres || [];
        var som = 0, coef = 0;
        matieres.forEach(function (m) {
            var v = noteMatiere(classe, periode, nomComplet, m.id);
            if (v == null) return;
            var c = Number(m.coef) > 0 ? Number(m.coef) : 1;
            som += v * c;
            coef += c;
        });
        return coef ? som / coef : null;
    }
    function moyenneEleve(classe, periode, nomComplet) {
        if (isAnnee(periode)) {
            var vals = [];
            periodesReelles(classe).forEach(function (per) {
                var m = moyenneElevePeriode(classe, per.id, nomComplet);
                if (m != null) vals.push(m);
            });
            return vals.length
                ? vals.reduce(function (a, b) { return a + b; }, 0) / vals.length
                : null;
        }
        return moyenneElevePeriode(classe, periode, nomComplet);
    }
    function sanctionsEleve(classe, periode, nomComplet) {
        if (isAnnee(periode)) {
            var all = [];
            periodesReelles(classe).forEach(function (per) {
                (periodeData(classe, per.id).sanctions[nomComplet] || []).forEach(function (s) {
                    all.push(Object.assign({}, s, { periode: per.id, periodeLabel: per.label }));
                });
            });
            return all;
        }
        return (periodeData(classe, periode).sanctions[nomComplet] || []).slice();
    }
    function appreciationEleve(classe, periode, nomComplet) {
        if (isAnnee(periode)) {
            var an = (periodeData(classe, AN_ID).appreciations[nomComplet] || '').trim();
            if (an) return an;
            var found = '';
            periodesReelles(classe).forEach(function (per) {
                var t = (periodeData(classe, per.id).appreciations[nomComplet] || '').trim();
                if (!found && t) found = t;
            });
            return found;
        }
        return (periodeData(classe, periode).appreciations[nomComplet] || '').trim();
    }
    function retoursList(classe, periode) {
        var profs = classData(classe).profs || [];
        var map = periodeData(classe, periode).retoursProfs || {};
        return profs.map(function (p) {
            return {
                key: profKey(p),
                identifiant: p.identifiant || '',
                nom: p.nom || '',
                prenom: p.prenom || '',
                matiere: p.matiere || '',
                texte: map[profKey(p)] || ''
            };
        });
    }
    function mapRpcProf(row) {
        return {
            identifiant: row.identifiant || '',
            nom: row.nom || '',
            prenom: row.prenom || '',
            matiere: row.matiere || ''
        };
    }
    async function chargerProfsClasse(classe) {
        var loaded = [];
        if (!global.EprofStore || !(await global.EprofStore.isOnlineReady())) return loaded;
        try {
            var client = await global.EprofStore.getClient();
            if (!client) return loaded;
            var res = await client.rpc('list_class_teachers', {
                p_classe: classe,
                p_annee: annee()
            });
            if (!res.error && Array.isArray(res.data)) {
                loaded = res.data.map(mapRpcProf);
            }
        } catch (e) { /* hors ligne / RPC absente */ }
        return loaded;
    }
    function mergeProfs(classe, incoming) {
        var c = classData(classe);
        var list = (c.profs || []).slice();
        var seen = {};
        list.forEach(function (p) { seen[profKey(p)] = true; });
        var added = 0;
        (incoming || []).forEach(function (p) {
            var k = profKey(p);
            if (!k || k === '::' || seen[k]) return;
            list.push({
                identifiant: p.identifiant || '',
                nom: p.nom || '',
                prenom: p.prenom || '',
                matiere: p.matiere || ''
            });
            seen[k] = true;
            added += 1;
        });
        c.profs = list;
        return added;
    }
    async function ensureProfs(classe, force) {
        var c = classData(classe);
        if (!force && c.profs && c.profs.length) return false;
        var loaded = await chargerProfsClasse(classe);
        if (!loaded.length) return false;
        if (force) {
            mergeProfs(classe, loaded);
        } else {
            c.profs = loaded;
        }
        planifierSync();
        return true;
    }
    function fmtMoy(v) {
        if (v == null || isNaN(v)) return '—';
        return (Math.round(v * 10) / 10).toFixed(1).replace('.', ',');
    }
    function moyClass(v) {
        if (v == null) return '';
        if (v < 10) return 'low';
        if (v < 12) return 'mid';
        return 'ok';
    }
    function statsClasse(classe, periode) {
        var list = eleves(classe);
        var moyennes = [];
        var avecApp = 0;
        var nbSanctions = 0;
        var parType = {};
        var retours = retoursList(classe, periode);
        var avecRetours = retours.filter(function (r) { return (r.texte || '').trim(); }).length;
        list.forEach(function (e) {
            var m = moyenneEleve(classe, periode, e.nomComplet);
            if (m != null) moyennes.push(m);
            if (appreciationEleve(classe, periode, e.nomComplet)) avecApp += 1;
            sanctionsEleve(classe, periode, e.nomComplet).forEach(function (s) {
                nbSanctions += 1;
                parType[s.type] = (parType[s.type] || 0) + 1;
            });
        });
        var gen = moyennes.length
            ? moyennes.reduce(function (a, b) { return a + b; }, 0) / moyennes.length
            : null;
        var bins = [
            { label: '< 8', min: 0, max: 8, n: 0 },
            { label: '8–10', min: 8, max: 10, n: 0 },
            { label: '10–12', min: 10, max: 12, n: 0 },
            { label: '12–14', min: 12, max: 14, n: 0 },
            { label: '14–16', min: 14, max: 16, n: 0 },
            { label: '≥ 16', min: 16, max: 21, n: 0 }
        ];
        moyennes.forEach(function (m) {
            bins.forEach(function (b) {
                if (m >= b.min && m < b.max) b.n += 1;
            });
        });
        return {
            effectif: list.length,
            renseignees: moyennes.length,
            generale: gen,
            avecApp: avecApp,
            sansApp: list.length - avecApp,
            nbSanctions: nbSanctions,
            parType: parType,
            bins: bins,
            avecRetours: avecRetours,
            nbProfs: retours.length
        };
    }

    function render(container, extra) {
        extra = extra || {};
        ensureCss();
        hydrater().then(function () {
            var classes = ppClasses();
            if (extra.classe && classes.some(function (c) { return E().classesMatch ? E().classesMatch(c, extra.classe) : c === extra.classe; })) {
                view.classe = extra.classe;
            } else if (!view.classe || classes.indexOf(view.classe) === -1) {
                view.classe = classes[0] || '';
            }
            paint(container);
        });
        paint(container);
    }

    function ensureCss() {
        if (document.querySelector('link[href="css/conseil-classe.css"]')) return;
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'css/conseil-classe.css';
        document.head.appendChild(link);
    }

    function paint(container) {
        closeOverlay();
        var classes = ppClasses();
        if (!classes.length) {
            container.innerHTML =
                '<div class="conseil-wrap conseil-empty">' +
                '<h2>🎓 Conseil de classe</h2>' +
                '<p>Cet outil est réservé aux <strong>professeurs principaux</strong>.</p>' +
                '<p>Cochez <strong>PP</strong> pour votre classe dans <em>Gérer mes classes et matières</em> (Paramètres), ou demandez à l’administrateur de vous désigner dans les affectations.</p>' +
                '<p class="conseil-hint">Un petit badge <span class="pp-badge">PP</span> apparaît ensuite sur les boutons de votre classe.</p>' +
                '</div>';
            return;
        }
        if (!view.classe) view.classe = classes[0];
        var pers = periodesFor(view.classe);
        if (!view.periode || !pers.some(function (p) { return p.id === view.periode; })) {
            view.periode = pers[0].id;
        }
        var listes = E().getListsForTeacher ? E().getListsForTeacher() : {};
        container.innerHTML =
            '<div class="conseil-wrap" id="conseil-classe-module">' +
            '<div class="conseil-head">' +
            '<div><h2>🎓 Conseil de classe</h2>' +
            '<p class="conseil-kicker">Espace professeur principal · ' + esc(annee()) +
            ' · enregistré en ligne, indépendant du carnet de notes</p></div>' +
            '<div class="conseil-head-actions">' +
            '<button type="button" class="btn-secondary" id="conseil-config-matieres">⚙️ Matières de la classe</button>' +
            '<button type="button" class="btn-secondary" id="conseil-pdf-classe">📄 PDF classe</button>' +
            '</div></div>' +
            (classes.length > 1
                ? '<div class="selection-classe-suivi" style="padding:16px;margin-bottom:12px;"><div class="classes-grid">' +
                  classes.map(function (c) { return E().classeBtnHtml(c, (listes[c] || []).length); }).join('') +
                  '</div></div>'
                : '<p class="conseil-kicker" style="margin-bottom:10px;">Classe : <strong>' + esc(view.classe) + '</strong>' +
                  (E().ppBadgeHtml ? E().ppBadgeHtml(view.classe) : '') + '</p>') +
            '<div class="conseil-periodes">' + pers.map(function (p) {
                return '<button type="button" class="conseil-periode-btn' +
                    (p.id === view.periode ? ' is-on' : '') +
                    (p.id === AN_ID ? ' is-year' : '') +
                    '" data-periode="' + p.id + '">' + esc(p.label) + '</button>';
            }).join('') + '</div>' +
            '<div class="conseil-tabs">' + TABS.map(function (t) {
                return '<button type="button" class="conseil-tab' + (t.id === view.tab ? ' is-on' : '') +
                    '" data-tab="' + t.id + '">' + t.label + '</button>';
            }).join('') + '</div>' +
            '<div id="conseil-body"></div>' +
            '</div>';
        bindShell(container);
        paintBody(container);
    }

    function bindShell(container) {
        container.querySelectorAll('.classe-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                view.classe = btn.getAttribute('data-classe');
                view.eleve = '';
                paint(container);
            });
        });
        container.querySelectorAll('[data-periode]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                view.periode = btn.getAttribute('data-periode');
                paint(container);
            });
        });
        container.querySelectorAll('[data-tab]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                view.tab = btn.getAttribute('data-tab');
                paint(container);
            });
        });
        var cfg = container.querySelector('#conseil-config-matieres');
        if (cfg) cfg.addEventListener('click', function () { openMatieresModal(container); });
        var pdf = container.querySelector('#conseil-pdf-classe');
        if (pdf) pdf.addEventListener('click', function () { exportPdfClasse(); });
    }

    function paintBody(container) {
        var body = container.querySelector('#conseil-body');
        if (!body) return;
        if (view.tab === 'vue') body.innerHTML = htmlVue();
        else if (view.tab === 'moyennes') body.innerHTML = htmlMoyennes();
        else if (view.tab === 'sanctions') body.innerHTML = htmlSanctions();
        else if (view.tab === 'retours') body.innerHTML = htmlRetours();
        else if (view.tab === 'appreciations') body.innerHTML = htmlAppreciations();
        else body.innerHTML = htmlSynthese();
        bindBody(container);
        if (view.tab === 'retours') {
            ensureProfs(view.classe, false).then(function (changed) {
                if (!changed || view.tab !== 'retours') return;
                var still = container.querySelector('#conseil-body');
                if (!still) return;
                still.innerHTML = htmlRetours();
                bindBody(container);
            });
        }
    }

    function htmlStats() {
        var s = statsClasse(view.classe, view.periode);
        return '<div class="conseil-stats">' +
            '<div class="conseil-stat"><strong>' + s.effectif + '</strong><span>Élèves</span></div>' +
            '<div class="conseil-stat ' + moyClass(s.generale) + '"><strong>' + fmtMoy(s.generale) + '</strong><span>' +
            (isAnnee(view.periode) ? 'Moyenne annuelle' : 'Moyenne de classe') + '</span></div>' +
            '<div class="conseil-stat"><strong>' + s.renseignees + '</strong><span>' +
            (isAnnee(view.periode) ? 'Élèves avec moyenne' : 'Moyennes renseignées') + '</span></div>' +
            '<div class="conseil-stat ' + (s.nbSanctions ? 'warn' : 'ok') + '"><strong>' + s.nbSanctions + '</strong><span>Sanctions</span></div>' +
            '<div class="conseil-stat"><strong>' + s.avecRetours + '</strong><span>Retours profs</span></div>' +
            '<div class="conseil-stat"><strong>' + s.avecApp + '</strong><span>Appréciations</span></div>' +
            '</div>';
    }

    function htmlVue() {
        var s = statsClasse(view.classe, view.periode);
        var maxBin = Math.max.apply(null, s.bins.map(function (b) { return b.n; }).concat([1]));
        var bars = s.bins.map(function (b) {
            var pct = Math.round(100 * b.n / maxBin);
            return '<div class="conseil-bar-row"><span>' + b.label + '</span><div class="conseil-bar"><span style="width:' + pct + '%"></span></div><span>' + b.n + '</span></div>';
        }).join('');
        var types = SANCTIONS.map(function (t) {
            var n = s.parType[t.id] || 0;
            if (!n) return '';
            return '<span class="conseil-chip' + (n ? ' warn' : '') + '">' + esc(t.label) + ' · ' + n + '</span>';
        }).join('');
        var list = eleves(view.classe).map(function (e) {
            var m = moyenneEleve(view.classe, view.periode, e.nomComplet);
            var nSanc = sanctionsEleve(view.classe, view.periode, e.nomComplet).length;
            var app = appreciationEleve(view.classe, view.periode, e.nomComplet);
            return '<tr><td class="sticky-col">' + esc(e.nomComplet) + '</td>' +
                '<td class="conseil-moy ' + moyClass(m) + '">' + fmtMoy(m) + '</td>' +
                '<td>' + (nSanc ? '<span class="conseil-chip danger">' + nSanc + '</span>' : '—') + '</td>' +
                '<td>' + (app ? '✓' : '—') + '</td></tr>';
        }).join('');
        return htmlStats() +
            '<div class="conseil-synth-grid">' +
            '<div class="conseil-panel"><h3>Répartition des moyennes</h3>' +
            (s.renseignees
                ? '<div class="conseil-bars">' + bars + '</div>'
                : '<p class="conseil-hint">' + (isAnnee(view.periode)
                    ? 'Les moyennes de l’année se calculent à partir des trimestres ou semestres renseignés.'
                    : 'Saisissez les moyennes dans l’onglet dédié.') + '</p>') +
            '<h3>' + (isAnnee(view.periode) ? 'Sanctions de l’année' : 'Sanctions de la période') + '</h3><div class="conseil-chips">' + (types || '<span class="conseil-hint">Aucune</span>') + '</div></div>' +
            '<div class="conseil-panel"><h3>Appréciation de classe' + (isAnnee(view.periode) ? ' (année)' : '') + '</h3>' +
            '<textarea class="conseil-app-area" id="conseil-app-classe" rows="5" placeholder="Synthèse du conseil pour la classe…">' +
            esc(periodeData(view.classe, view.periode).appreciationClasse) + '</textarea></div></div>' +
            '<div class="conseil-panel" style="margin-top:14px;"><h3>Tableau de bord</h3>' +
            '<div class="conseil-table-wrap"><table class="conseil-table"><thead><tr>' +
            '<th class="sticky-col">Élève</th><th>Moy.</th><th>Sanctions</th><th>Appr.</th></tr></thead><tbody>' +
            list + '</tbody></table></div></div>';
    }

    function htmlMoyennes() {
        if (isAnnee(view.periode)) return htmlMoyennesAnnee();
        var matieres = classData(view.classe).matieres || [];
        var list = eleves(view.classe);
        var head = '<th class="sticky-col">Élève</th>' + matieres.map(function (m) {
            return '<th>' + esc(m.nom) + '<br><small>coef ' + esc(m.coef) + '</small></th>';
        }).join('') + '<th>Moy.</th>';
        var rows = list.map(function (e) {
            var m = moyenneEleve(view.classe, view.periode, e.nomComplet);
            return '<tr><td class="sticky-col">' + esc(e.nomComplet) + '</td>' +
                matieres.map(function (mat) {
                    var val = noteMatiere(view.classe, view.periode, e.nomComplet, mat.id);
                    return '<td><input type="number" min="0" max="20" step="0.1" data-moy="' + esc(e.nomComplet) +
                        '" data-mat="' + esc(mat.id) + '" value="' + (val == null ? '' : esc(val)) + '"></td>';
                }).join('') +
                '<td class="conseil-moy ' + moyClass(m) + '">' + fmtMoy(m) + '</td></tr>';
        }).join('');
        return htmlStats() +
            '<div class="conseil-panel"><div class="conseil-toolbar"><p class="conseil-hint" style="margin:0">Moyennes coefficientées du conseil — elles ne sont <strong>pas</strong> reportées dans le carnet de notes.</p></div>' +
            '<div class="conseil-table-wrap"><table class="conseil-table"><thead><tr>' + head + '</tr></thead><tbody>' +
            (rows || '<tr><td class="sticky-col">Aucun élève</td></tr>') + '</tbody></table></div></div>';
    }

    function htmlMoyennesAnnee() {
        var pers = periodesReelles(view.classe);
        var matieres = classData(view.classe).matieres || [];
        var list = eleves(view.classe);
        var headPer = '<th class="sticky-col">Élève</th>' + pers.map(function (p) {
            return '<th>' + esc(p.label) + '</th>';
        }).join('') + '<th>Année</th>';
        var rowsPer = list.map(function (e) {
            var an = moyenneEleve(view.classe, AN_ID, e.nomComplet);
            return '<tr><td class="sticky-col">' + esc(e.nomComplet) + '</td>' +
                pers.map(function (per) {
                    var m = moyenneEleve(view.classe, per.id, e.nomComplet);
                    return '<td class="conseil-moy ' + moyClass(m) + '">' + fmtMoy(m) + '</td>';
                }).join('') +
                '<td class="conseil-moy ' + moyClass(an) + '">' + fmtMoy(an) + '</td></tr>';
        }).join('');
        var headMat = '<th class="sticky-col">Élève</th>' + matieres.map(function (m) {
            return '<th>' + esc(m.nom) + '<br><small>coef ' + esc(m.coef) + '</small></th>';
        }).join('') + '<th>Moy.</th>';
        var rowsMat = list.map(function (e) {
            var an = moyenneEleve(view.classe, AN_ID, e.nomComplet);
            return '<tr><td class="sticky-col">' + esc(e.nomComplet) + '</td>' +
                matieres.map(function (mat) {
                    var val = noteMatiere(view.classe, AN_ID, e.nomComplet, mat.id);
                    return '<td class="conseil-moy ' + moyClass(val) + '">' + fmtMoy(val) + '</td>';
                }).join('') +
                '<td class="conseil-moy ' + moyClass(an) + '">' + fmtMoy(an) + '</td></tr>';
        }).join('');
        return htmlStats() +
            '<div class="conseil-panel"><p class="conseil-hint">Récapitulatif annuel en lecture seule : moyenne de chaque période, puis moyenne de l’année (périodes renseignées uniquement).</p>' +
            '<div class="conseil-table-wrap"><table class="conseil-table"><thead><tr>' + headPer + '</tr></thead><tbody>' +
            (rowsPer || '<tr><td class="sticky-col">Aucun élève</td></tr>') + '</tbody></table></div></div>' +
            '<div class="conseil-panel" style="margin-top:14px;"><h3>Moyennes par matière (année)</h3>' +
            '<p class="conseil-hint">Moyenne des notes saisies sur les trimestres ou semestres.</p>' +
            '<div class="conseil-table-wrap"><table class="conseil-table"><thead><tr>' + headMat + '</tr></thead><tbody>' +
            (rowsMat || '<tr><td class="sticky-col">Aucun élève</td></tr>') + '</tbody></table></div></div>';
    }

    function htmlSanctions() {
        var list = eleves(view.classe);
        var year = isAnnee(view.periode);
        var cards = list.map(function (e) {
            var items = sanctionsEleve(view.classe, view.periode, e.nomComplet);
            var open = view.eleve === e.nomComplet ? ' is-open' : '';
            var body = view.eleve === e.nomComplet
                ? '<div class="conseil-eleve-body">' + htmlSanctionList(e.nomComplet, items, year) +
                  (year ? '' : '<button type="button" class="btn-primary conseil-add-sanc" data-eleve="' + esc(e.nomComplet) + '">➕ Ajouter une sanction</button>') +
                  '</div>'
                : '';
            return '<div class="conseil-eleve-card' + open + '">' +
                '<div class="conseil-eleve-head" data-open="' + esc(e.nomComplet) + '">' +
                '<strong>' + esc(e.nomComplet) + '</strong>' +
                '<span class="conseil-chips">' +
                (items.length ? '<span class="conseil-chip danger">' + items.length + '</span>' : '<span class="conseil-chip">Aucune</span>') +
                '</span></div>' + body + '</div>';
        }).join('');
        return htmlStats() + '<div class="conseil-panel"><p class="conseil-hint">' +
            (year
                ? 'Récapitulatif des sanctions de l’année (lecture seule). Pour en ajouter, ouvrez le trimestre ou le semestre concerné.'
                : 'Hiérarchie libre : attribuez une ou plusieurs mesures, selon la situation. Pour les mots, retenues et avertissements, indiquez le collègue (liste blanche).') +
            '</p><div class="conseil-eleve-list">' + cards + '</div></div>';
    }

    function htmlSanctionList(nomComplet, items, readOnly) {
        if (!items.length) return '<p class="conseil-hint">Aucune sanction pour cette période.</p>';
        return '<div class="conseil-sanctions">' + items.map(function (s, i) {
            var meta = sanctionMeta(s.type);
            var extra = [];
            if (s.periodeLabel) extra.push(s.periodeLabel);
            if (s.prof) extra.push('par ' + s.prof);
            if (s.duree) extra.push(s.duree);
            if (s.objectifs && s.objectifs.length) extra.push(s.objectifs.filter(Boolean).join(' · '));
            return '<div class="conseil-sanction"><strong>' + esc(meta.label) + '</strong> · ' +
                esc(formatDate(s.date)) +
                (extra.length ? '<div class="conseil-sanction-meta">' + esc(extra.join(' · ')) + '</div>' : '') +
                (s.motif ? '<div>' + esc(s.motif) + '</div>' : '') +
                (readOnly ? '' : '<button type="button" class="btn-secondary conseil-del-sanc" data-eleve="' + esc(nomComplet) +
                '" data-idx="' + i + '" style="margin-top:6px;">Supprimer</button>') + '</div>';
        }).join('') + '</div>';
    }

    function htmlRetours() {
        var profs = retoursList(view.classe, view.periode);
        var opts = directory.map(function (p) {
            var lab = profLabel(p);
            var val = (p.identifiant || lab) + '::' + (p.matiere || '');
            return '<option value="' + esc(val) + '">' + esc(lab) + (p.matiere ? ' · ' + esc(p.matiere) : '') + '</option>';
        }).join('');
        var cards = profs.map(function (p) {
            var titre = profLabel(p) || p.identifiant || 'Enseignant';
            return '<div class="conseil-eleve-card conseil-retour-card">' +
                '<div class="conseil-eleve-head" style="cursor:default">' +
                '<div><strong>' + esc(titre) + '</strong>' +
                (p.matiere ? '<div class="conseil-sanction-meta">' + esc(p.matiere) + '</div>' : '') +
                '</div>' +
                '<button type="button" class="btn-secondary conseil-del-prof" data-pkey="' + esc(p.key) + '">Retirer</button>' +
                '</div>' +
                '<textarea class="conseil-app-area conseil-retour-texte" data-pkey="' + esc(p.key) +
                '" rows="4" placeholder="Appréciation générale de l’enseignant pour la classe…">' +
                esc(p.texte) + '</textarea></div>';
        }).join('');
        return htmlStats() +
            '<div class="conseil-panel"><h3>Retour des professeurs</h3>' +
            '<p class="conseil-hint">Appréciation générale de chaque enseignant de la classe, à présenter au conseil. Elle figure sur le <strong>PDF classe</strong>' +
            (isAnnee(view.periode) ? ' (récapitulatif annuel).' : '.') + '</p>' +
            '<div class="conseil-toolbar">' +
            '<div class="conseil-add-prof-row">' +
            '<select id="conseil-pick-prof"><option value="">— Ajouter un enseignant —</option>' + opts + '</select>' +
            '<button type="button" class="btn-secondary" id="conseil-add-prof">Ajouter</button>' +
            '<button type="button" class="btn-secondary" id="conseil-refresh-profs">Importer les affectations</button>' +
            '</div></div>' +
            (cards
                ? '<div class="conseil-eleve-list">' + cards + '</div>'
                : '<p class="conseil-hint">Aucun enseignant pour l’instant. Importez les affectations de la classe ou ajoutez un collègue depuis la liste blanche.</p>') +
            '</div>';
    }

    function htmlAppreciations() {
        var list = eleves(view.classe);
        var p = periodeData(view.classe, view.periode);
        var rows = list.map(function (e) {
            var extra = '';
            if (isAnnee(view.periode)) {
                extra = '<p class="conseil-sanction-meta">' + periodesReelles(view.classe).map(function (per) {
                    var t = (periodeData(view.classe, per.id).appreciations[e.nomComplet] || '').trim();
                    return esc(per.label) + ' : ' + (t ? '✓' : '—');
                }).join(' · ') + '</p>';
            }
            return '<div class="conseil-eleve-card"><strong>' + esc(e.nomComplet) + '</strong>' + extra +
                '<textarea class="conseil-app-area conseil-app-eleve" data-eleve="' + esc(e.nomComplet) +
                '" rows="3" placeholder="' + (isAnnee(view.periode) ? 'Appréciation annuelle…' : 'Appréciation générale…') + '">' +
                esc(p.appreciations[e.nomComplet] || '') +
                '</textarea></div>';
        }).join('');
        return htmlStats() +
            '<div class="conseil-panel"><h3>Appréciation de classe' + (isAnnee(view.periode) ? ' (année)' : '') + '</h3>' +
            '<textarea class="conseil-app-area" id="conseil-app-classe" rows="4" placeholder="Synthèse collective…">' +
            esc(p.appreciationClasse) + '</textarea></div>' +
            '<div class="conseil-panel" style="margin-top:14px;"><h3>Appréciations individuelles</h3>' +
            '<div class="conseil-eleve-list">' + rows + '</div></div>';
    }

    function htmlSynthese() {
        var list = eleves(view.classe);
        var pers = periodesReelles(view.classe);
        var cards = list.map(function (e) {
            var m = moyenneEleve(view.classe, view.periode, e.nomComplet);
            var nSanc = sanctionsEleve(view.classe, view.periode, e.nomComplet).length;
            var app = appreciationEleve(view.classe, view.periode, e.nomComplet);
            var histo = pers.map(function (per) {
                return per.label.replace(/Semestre |Trimestre /, '') + ': ' + fmtMoy(moyenneEleve(view.classe, per.id, e.nomComplet));
            }).join(' · ') + ' · Année : ' + fmtMoy(moyenneEleve(view.classe, AN_ID, e.nomComplet));
            return '<div class="conseil-eleve-card">' +
                '<div class="conseil-eleve-head"><strong>' + esc(e.nomComplet) + '</strong>' +
                '<span class="conseil-chips"><span class="conseil-chip">Moy. ' + fmtMoy(m) + '</span>' +
                (nSanc ? '<span class="conseil-chip danger">' + nSanc + ' sanction' + (nSanc > 1 ? 's' : '') + '</span>' : '') +
                '</span></div>' +
                '<p class="conseil-sanction-meta">' + esc(histo) + '</p>' +
                '<p>' + (app ? esc(app) : '<span class="conseil-hint">Pas d’appréciation</span>') + '</p>' +
                '<button type="button" class="btn-secondary conseil-pdf-eleve" data-eleve="' + esc(e.nomComplet) + '">📄 Fiche PDF</button>' +
                '</div>';
        }).join('');
        return htmlStats() +
            '<div class="conseil-panel"><p class="conseil-hint">Suivi de l’année : moyennes par période, sanctions et appréciations. Export visuel pour le conseil.</p>' +
            '<div class="conseil-eleve-list">' + cards + '</div></div>';
    }

    function bindBody(container) {
        var appClasse = container.querySelector('#conseil-app-classe');
        if (appClasse) {
            appClasse.addEventListener('input', function () {
                periodeData(view.classe, view.periode).appreciationClasse = appClasse.value;
                planifierSync();
            });
        }
        container.querySelectorAll('[data-moy]').forEach(function (input) {
            input.addEventListener('change', function () {
                var nom = input.getAttribute('data-moy');
                var mat = input.getAttribute('data-mat');
                var p = periodeData(view.classe, view.periode);
                if (!p.moyennes[nom]) p.moyennes[nom] = {};
                var raw = input.value.trim();
                if (raw === '') delete p.moyennes[nom][mat];
                else p.moyennes[nom][mat] = Number(raw);
                planifierSync();
                paintBody(container);
            });
        });
        container.querySelectorAll('.conseil-app-eleve').forEach(function (area) {
            area.addEventListener('input', function () {
                periodeData(view.classe, view.periode).appreciations[area.getAttribute('data-eleve')] = area.value;
                planifierSync();
            });
        });
        container.querySelectorAll('[data-open]').forEach(function (el) {
            el.addEventListener('click', function () {
                var nom = el.getAttribute('data-open');
                view.eleve = view.eleve === nom ? '' : nom;
                paintBody(container);
            });
        });
        container.querySelectorAll('.conseil-add-sanc').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                openSanctionModal(container, btn.getAttribute('data-eleve'));
            });
        });
        container.querySelectorAll('.conseil-del-sanc').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                var nom = btn.getAttribute('data-eleve');
                var idx = Number(btn.getAttribute('data-idx'));
                var arr = periodeData(view.classe, view.periode).sanctions[nom] || [];
                arr.splice(idx, 1);
                periodeData(view.classe, view.periode).sanctions[nom] = arr;
                planifierSync();
                paintBody(container);
            });
        });
        container.querySelectorAll('.conseil-pdf-eleve').forEach(function (btn) {
            btn.addEventListener('click', function () { exportPdfEleve(btn.getAttribute('data-eleve')); });
        });
        container.querySelectorAll('.conseil-retour-texte').forEach(function (area) {
            area.addEventListener('input', function () {
                periodeData(view.classe, view.periode).retoursProfs[area.getAttribute('data-pkey')] = area.value;
                planifierSync();
            });
        });
        var addProf = container.querySelector('#conseil-add-prof');
        if (addProf) {
            addProf.addEventListener('click', function () {
                var sel = container.querySelector('#conseil-pick-prof');
                var raw = sel && sel.value;
                if (!raw) return;
                var parts = raw.split('::');
                var ident = parts[0] || '';
                var matiere = parts.slice(1).join('::');
                var src = directory.find(function (p) {
                    return (p.identifiant || profLabel(p)) === ident && String(p.matiere || '') === matiere;
                }) || directory.find(function (p) {
                    return (p.identifiant || profLabel(p)) === ident;
                });
                var prof = src
                    ? { identifiant: src.identifiant || ident, nom: src.nom || '', prenom: src.prenom || '', matiere: src.matiere || matiere }
                    : { identifiant: ident, nom: '', prenom: ident, matiere: matiere };
                mergeProfs(view.classe, [prof]);
                planifierSync();
                paintBody(container);
            });
        }
        var refreshProfs = container.querySelector('#conseil-refresh-profs');
        if (refreshProfs) {
            refreshProfs.addEventListener('click', function () {
                refreshProfs.disabled = true;
                ensureProfs(view.classe, true).then(function () {
                    paintBody(container);
                }).finally(function () {
                    refreshProfs.disabled = false;
                });
            });
        }
        container.querySelectorAll('.conseil-del-prof').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var key = btn.getAttribute('data-pkey');
                classData(view.classe).profs = (classData(view.classe).profs || []).filter(function (p) {
                    return profKey(p) !== key;
                });
                planifierSync();
                paintBody(container);
            });
        });
    }

    function formatDate(iso) {
        if (!iso) return '';
        try {
            return new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR');
        } catch (e) { return iso; }
    }

    function getOverlay() {
        var el = document.getElementById('conseil-modale');
        if (!el) {
            el = document.createElement('div');
            el.id = 'conseil-modale';
            el.className = 'conseil-modale';
            document.body.appendChild(el);
        }
        return el;
    }
    function closeOverlay() {
        var el = document.getElementById('conseil-modale');
        if (!el) return;
        if (el._conseilResizeCleanup) el._conseilResizeCleanup();
        el.classList.remove('is-open');
        el.innerHTML = '';
        el.onclick = null;
        document.body.classList.remove('conseil-modale-resizing');
    }
    function applyModalSize(card) {
        try {
            var stored = JSON.parse(localStorage.getItem('conseilMatieresModalSize') || 'null');
            if (stored && stored.w && stored.h) {
                var maxW = window.innerWidth - 48;
                var maxH = window.innerHeight - 48;
                card.style.width = Math.min(maxW, Math.max(360, stored.w)) + 'px';
                card.style.height = Math.min(maxH, Math.max(280, stored.h)) + 'px';
            }
        } catch (e) { /* ignore */ }
    }
    function bindModalResize(overlay, card) {
        if (overlay._conseilResizeCleanup) overlay._conseilResizeCleanup();
        var handle = overlay.querySelector('.conseil-modale-resize');
        if (!handle || !card) return;
        var drag = null;
        handle.addEventListener('mousedown', function (e) {
            if (e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            var rect = card.getBoundingClientRect();
            drag = { x: e.clientX, y: e.clientY, w: rect.width, h: rect.height };
            document.body.classList.add('conseil-modale-resizing');
        });
        handle.addEventListener('dblclick', function (e) {
            e.preventDefault();
            card.style.width = '';
            card.style.height = '';
            try { localStorage.removeItem('conseilMatieresModalSize'); } catch (err) { /* ignore */ }
        });
        function onMove(e) {
            if (!drag) return;
            var maxW = window.innerWidth - 48;
            var maxH = window.innerHeight - 48;
            var w = Math.min(maxW, Math.max(360, drag.w + 2 * (e.clientX - drag.x)));
            var h = Math.min(maxH, Math.max(280, drag.h + 2 * (e.clientY - drag.y)));
            card.style.width = w + 'px';
            card.style.height = h + 'px';
        }
        function onUp() {
            if (!drag) return;
            drag = null;
            document.body.classList.remove('conseil-modale-resizing');
            var rect = card.getBoundingClientRect();
            try {
                localStorage.setItem('conseilMatieresModalSize', JSON.stringify({
                    w: Math.round(rect.width),
                    h: Math.round(rect.height)
                }));
            } catch (err) { /* ignore */ }
        }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        overlay._conseilResizeCleanup = function () {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            overlay._conseilResizeCleanup = null;
        };
    }
    function bindMatieresDnD(listEl, mats, redraw) {
        var dragIdx = -1;
        listEl.querySelectorAll('.conseil-matiere-row').forEach(function (row) {
            var handle = row.querySelector('.conseil-drag-handle');
            if (handle) {
                handle.addEventListener('mousedown', function () { row.setAttribute('draggable', 'true'); });
            }
            row.addEventListener('dragstart', function (e) {
                if (e.target.closest('input, button')) {
                    e.preventDefault();
                    return;
                }
                dragIdx = Number(row.getAttribute('data-idx'));
                row.classList.add('is-dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(dragIdx));
            });
            row.addEventListener('dragend', function () {
                row.classList.remove('is-dragging');
                row.removeAttribute('draggable');
                listEl.querySelectorAll('.is-drop').forEach(function (el) { el.classList.remove('is-drop'); });
            });
            row.addEventListener('dragover', function (e) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                row.classList.add('is-drop');
            });
            row.addEventListener('dragleave', function () { row.classList.remove('is-drop'); });
            row.addEventListener('drop', function (e) {
                e.preventDefault();
                var to = Number(row.getAttribute('data-idx'));
                var from = dragIdx;
                row.classList.remove('is-drop');
                if (from < 0 || from === to || from >= mats.length || to >= mats.length) return;
                var item = mats.splice(from, 1)[0];
                mats.splice(to, 0, item);
                redraw();
            });
        });
    }

    function openMatieresModal(container) {
        var modal = getOverlay();
        var mats = classData(view.classe).matieres.slice();
        function draw() {
            modal.className = 'conseil-modale is-open';
            modal.innerHTML = '<div class="conseil-modale-card conseil-modale-resizable">' +
                '<div class="conseil-modale-inner">' +
                '<h3>Matières du conseil · ' + esc(view.classe) + '</h3>' +
                '<p class="conseil-hint">Liste et coefficients pour l’année. Glissez les poignées pour réordonner. Indépendants du carnet de notes.</p>' +
                '<div class="conseil-matieres-list">' + mats.map(function (m, i) {
                    return '<div class="conseil-matiere-row" data-idx="' + i + '">' +
                        '<span class="conseil-drag-handle" title="Glisser pour réordonner" aria-label="Réordonner" role="button">⋮⋮</span>' +
                        '<input type="text" data-mn="' + i + '" value="' + esc(m.nom) + '">' +
                        '<label>Coef. <input type="number" min="0.5" step="0.5" data-mc="' + i + '" value="' + esc(m.coef) + '"></label>' +
                        '<button type="button" class="btn-secondary" data-mdel="' + i + '">Retirer</button></div>';
                }).join('') + '</div>' +
                '<p><button type="button" class="btn-secondary" id="conseil-add-mat">➕ Matière</button></p>' +
                '<div style="display:flex;gap:8px;flex-wrap:wrap;"><button type="button" class="btn-primary" id="conseil-save-mat">Enregistrer</button>' +
                '<button type="button" class="btn-secondary" id="conseil-close-mat">Annuler</button></div>' +
                '</div>' +
                '<div class="conseil-modale-resize" title="Redimensionner" aria-label="Redimensionner la fenêtre"></div>' +
                '</div>';
            var card = modal.querySelector('.conseil-modale-card');
            applyModalSize(card);
            bindModalResize(modal, card);
            modal.querySelectorAll('[data-mn]').forEach(function (inp) {
                inp.addEventListener('input', function () { mats[Number(inp.getAttribute('data-mn'))].nom = inp.value; });
            });
            modal.querySelectorAll('[data-mc]').forEach(function (inp) {
                inp.addEventListener('input', function () { mats[Number(inp.getAttribute('data-mc'))].coef = Number(inp.value) || 1; });
            });
            modal.querySelectorAll('[data-mdel]').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    mats.splice(Number(btn.getAttribute('data-mdel')), 1);
                    draw();
                });
            });
            bindMatieresDnD(modal.querySelector('.conseil-matieres-list'), mats, draw);
            modal.querySelector('#conseil-add-mat').addEventListener('click', function () {
                mats.push({ id: uid(), nom: 'Nouvelle matière', coef: 1 });
                draw();
            });
            modal.querySelector('#conseil-save-mat').addEventListener('click', function () {
                classData(view.classe).matieres = mats.filter(function (m) { return (m.nom || '').trim(); });
                planifierSync();
                closeOverlay();
                paint(container);
            });
            modal.querySelector('#conseil-close-mat').addEventListener('click', function () {
                closeOverlay();
            });
        }
        draw();
        modal.onclick = function (e) { if (e.target === modal) closeOverlay(); };
    }

    function openSanctionModal(container, nomComplet) {
        var modal = getOverlay();
        var today = new Date().toISOString().slice(0, 10);
        var profOpts = '<option value="">— Choisir un enseignant —</option>' + directory.map(function (p) {
            var lab = profLabel(p);
            return '<option value="' + esc(lab) + '">' + esc(lab) + (p.matiere ? ' · ' + esc(p.matiere) : '') + '</option>';
        }).join('');
        modal.className = 'conseil-modale is-open';
        modal.innerHTML = '<div class="conseil-modale-card"><h3>Sanction · ' + esc(nomComplet) + '</h3>' +
            '<div class="conseil-form-row"><label>Type</label><select id="s-type">' +
            SANCTIONS.map(function (s) { return '<option value="' + s.id + '">' + esc(s.label) + '</option>'; }).join('') +
            '</select></div>' +
            '<div class="conseil-form-row"><label>Date</label><input type="date" id="s-date" value="' + today + '"></div>' +
            '<div class="conseil-form-row" id="s-prof-row"><label>Enseignant à l’origine</label><select id="s-prof">' + profOpts + '</select></div>' +
            '<div class="conseil-form-row" id="s-duree-row" hidden><label>Durée</label><input type="text" id="s-duree" placeholder="ex. 2 jours"></div>' +
            '<div class="conseil-form-row" id="s-obj-row" hidden><label>Objectifs</label><div id="s-obj-list"></div>' +
            '<button type="button" class="btn-secondary" id="s-add-obj">➕ Objectif</button></div>' +
            '<div class="conseil-form-row"><label>Motif / commentaire</label><textarea id="s-motif" rows="3"></textarea></div>' +
            '<div style="display:flex;gap:8px;"><button type="button" class="btn-primary" id="s-save">Enregistrer</button>' +
            '<button type="button" class="btn-secondary" id="s-cancel">Annuler</button></div></div>';

        function refreshFields() {
            var meta = sanctionMeta(modal.querySelector('#s-type').value);
            modal.querySelector('#s-prof-row').hidden = !meta.needsProf;
            modal.querySelector('#s-duree-row').hidden = !meta.duree;
            var objRow = modal.querySelector('#s-obj-row');
            objRow.hidden = !meta.objectifs;
            if (meta.objectifs) {
                var box = modal.querySelector('#s-obj-list');
                if (!box.children.length) {
                    var n = meta.objectifs.min || 1;
                    for (var i = 0; i < n; i++) addObjectif();
                }
            }
        }
        function addObjectif() {
            var box = modal.querySelector('#s-obj-list');
            var meta = sanctionMeta(modal.querySelector('#s-type').value);
            if (meta.objectifs && box.children.length >= meta.objectifs.max) return;
            var input = document.createElement('input');
            input.type = 'text';
            input.className = 's-obj';
            input.placeholder = 'Objectif';
            input.style.marginBottom = '6px';
            box.appendChild(input);
        }
        modal.querySelector('#s-type').addEventListener('change', refreshFields);
        modal.querySelector('#s-add-obj').addEventListener('click', addObjectif);
        refreshFields();
        modal.querySelector('#s-cancel').addEventListener('click', function () { closeOverlay(); });
        modal.querySelector('#s-save').addEventListener('click', function () {
            var type = modal.querySelector('#s-type').value;
            var meta = sanctionMeta(type);
            var entry = {
                id: uid(),
                type: type,
                date: modal.querySelector('#s-date').value,
                motif: modal.querySelector('#s-motif').value.trim(),
                prof: meta.needsProf ? modal.querySelector('#s-prof').value : '',
                duree: meta.duree ? modal.querySelector('#s-duree').value.trim() : '',
                objectifs: meta.objectifs
                    ? Array.prototype.map.call(modal.querySelectorAll('.s-obj'), function (i) { return i.value.trim(); }).filter(Boolean)
                    : []
            };
            if (meta.objectifs && entry.objectifs.length < meta.objectifs.min) {
                alert('Indiquez au moins ' + meta.objectifs.min + ' objectif(s).');
                return;
            }
            var p = periodeData(view.classe, view.periode);
            if (!p.sanctions[nomComplet]) p.sanctions[nomComplet] = [];
            p.sanctions[nomComplet].push(entry);
            planifierSync();
            closeOverlay();
            view.eleve = nomComplet;
            paintBody(container);
        });
        modal.onclick = function (e) { if (e.target === modal) closeOverlay(); };
    }

    function periodeLabel() {
        var hit = periodesFor(view.classe).find(function (p) { return p.id === view.periode; });
        return hit ? hit.label : view.periode;
    }

    function jsPdf() {
        var ns = global.jspdf || global.jsPDF;
        if (ns && ns.jsPDF) return ns.jsPDF;
        return ns;
    }

    function drawPdfHeader(doc, titre, sousTitre) {
        doc.setFillColor(30, 64, 175);
        doc.rect(0, 0, 210, 28, 'F');
        doc.setFillColor(251, 191, 36);
        doc.rect(0, 28, 210, 3, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('eProf  ·  Conseil de classe', 12, 12);
        doc.setFontSize(11);
        doc.text(titre, 12, 20);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(sousTitre, 12, 26);
        doc.setTextColor(15, 23, 42);
    }

    function pdfEnsure(doc, y, need) {
        if (y + (need || 16) > 278) {
            doc.addPage();
            return 18;
        }
        return y;
    }

    function exportPdfClasse() {
        var JsPDF = jsPdf();
        if (!JsPDF) { alert('jsPDF n’est pas chargé.'); return; }
        var doc = new JsPDF({ unit: 'mm', format: 'a4' });
        var s = statsClasse(view.classe, view.periode);
        var list = eleves(view.classe);
        var p = periodeData(view.classe, view.periode);
        drawPdfHeader(doc, view.classe + '  ·  ' + periodeLabel(), annee() + '  ·  professeur principal');
        var y = 40;
        doc.setFontSize(10);
        doc.text('Effectif ' + s.effectif + '   ·   Moyenne de classe ' + fmtMoy(s.generale) +
            '   ·   ' + s.nbSanctions + ' sanction(s)   ·   ' + s.avecApp + ' appréciation(s)', 12, y);
        y += 8;
        if (p.appreciationClasse) {
            doc.setFont('helvetica', 'bold');
            doc.text('Appréciation de classe', 12, y);
            y += 6;
            doc.setFont('helvetica', 'normal');
            var lines = doc.splitTextToSize(p.appreciationClasse, 186);
            doc.text(lines, 12, y);
            y += lines.length * 5 + 4;
        }
        var retours = retoursList(view.classe, view.periode).filter(function (r) {
            return (r.texte || '').trim();
        });
        if (retours.length) {
            y = pdfEnsure(doc, y, 18);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.text('Retour des professeurs', 12, y);
            y += 6;
            retours.forEach(function (r) {
                var titre = (profLabel(r) || r.identifiant || 'Enseignant') + (r.matiere ? '  ·  ' + r.matiere : '');
                y = pdfEnsure(doc, y, 16);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(9);
                doc.text(titre, 12, y);
                y += 5;
                doc.setFont('helvetica', 'normal');
                var rl = doc.splitTextToSize(r.texte.trim(), 186);
                y = pdfEnsure(doc, y, rl.length * 4.5 + 4);
                doc.text(rl, 12, y);
                y += rl.length * 4.5 + 4;
            });
        }
        if (doc.autoTable) {
            var persPdf = periodesReelles(view.classe);
            var head = isAnnee(view.periode)
                ? [['Élève'].concat(persPdf.map(function (per) { return per.label; })).concat(['Année', 'Sanctions', 'Appréciation'])]
                : [['Élève', 'Moyenne', 'Sanctions', 'Appréciation']];
            doc.autoTable({
                startY: y,
                head: head,
                body: list.map(function (e) {
                    var app = appreciationEleve(view.classe, view.periode, e.nomComplet);
                    var short = app.length > 90 ? app.slice(0, 87) + '…' : app;
                    if (isAnnee(view.periode)) {
                        return [e.nomComplet]
                            .concat(persPdf.map(function (per) {
                                return fmtMoy(moyenneEleve(view.classe, per.id, e.nomComplet));
                            }))
                            .concat([
                                fmtMoy(moyenneEleve(view.classe, AN_ID, e.nomComplet)),
                                String(sanctionsEleve(view.classe, view.periode, e.nomComplet).length),
                                short
                            ]);
                    }
                    return [
                        e.nomComplet,
                        fmtMoy(moyenneEleve(view.classe, view.periode, e.nomComplet)),
                        String(sanctionsEleve(view.classe, view.periode, e.nomComplet).length),
                        short
                    ];
                }),
                styles: { fontSize: 8, cellPadding: 2 },
                headStyles: { fillColor: [30, 64, 175] },
                columnStyles: isAnnee(view.periode) ? {} : { 3: { cellWidth: 80 } }
            });
        }
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text('Document professeur principal — ne remplace pas le carnet de notes.', 12, 287);
        doc.save('Conseil_' + view.classe.replace(/\s+/g, '_') + '_' + view.periode + '.pdf');
    }

    function exportPdfEleve(nomComplet) {
        var JsPDF = jsPdf();
        if (!JsPDF) { alert('jsPDF n’est pas chargé.'); return; }
        var doc = new JsPDF({ unit: 'mm', format: 'a4' });
        var mats = classData(view.classe).matieres || [];
        drawPdfHeader(doc, nomComplet, view.classe + '  ·  ' + periodeLabel() + '  ·  ' + annee());
        var y = 40;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('Moyenne coefficientée : ' + fmtMoy(moyenneEleve(view.classe, view.periode, nomComplet)) + ' / 20', 12, y);
        y += 8;
        if (doc.autoTable) {
            doc.autoTable({
                startY: y,
                head: [['Matière', 'Coef.', 'Moyenne']],
                body: mats.map(function (m) {
                    var v = noteMatiere(view.classe, view.periode, nomComplet, m.id);
                    return [m.nom, String(m.coef), v == null ? '—' : fmtMoy(v)];
                }),
                styles: { fontSize: 9 },
                headStyles: { fillColor: [30, 64, 175] }
            });
            y = doc.lastAutoTable.finalY + 10;
        }
        var pers = periodesReelles(view.classe);
        doc.setFont('helvetica', 'bold');
        doc.text('Évolution sur l’année', 12, y);
        y += 6;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(pers.map(function (per) {
            return per.label + ' : ' + fmtMoy(moyenneEleve(view.classe, per.id, nomComplet));
        }).join('     ') + '     Année : ' + fmtMoy(moyenneEleve(view.classe, AN_ID, nomComplet)), 12, y);
        y += 10;
        var sanc = sanctionsEleve(view.classe, view.periode, nomComplet);
        doc.setFont('helvetica', 'bold');
        doc.text('Sanctions (' + sanc.length + ')', 12, y);
        y += 6;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        if (!sanc.length) {
            doc.text('Aucune.', 12, y);
            y += 8;
        } else {
            sanc.forEach(function (s) {
                var line = (s.periodeLabel ? s.periodeLabel + ' — ' : '') + sanctionMeta(s.type).label + ' — ' + formatDate(s.date);
                if (s.prof) line += ' — ' + s.prof;
                if (s.duree) line += ' — ' + s.duree;
                var wrapped = doc.splitTextToSize(line + (s.motif ? ' · ' + s.motif : ''), 186);
                if (y > 270) { doc.addPage(); y = 20; }
                doc.text(wrapped, 12, y);
                y += wrapped.length * 4.5 + 2;
                if (s.objectifs && s.objectifs.length) {
                    s.objectifs.forEach(function (o) {
                        var ow = doc.splitTextToSize('• ' + o, 180);
                        doc.text(ow, 16, y);
                        y += ow.length * 4.5;
                    });
                }
            });
        }
        y += 4;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('Appréciation générale', 12, y);
        y += 6;
        doc.setFont('helvetica', 'normal');
        var app = appreciationEleve(view.classe, view.periode, nomComplet) || '—';
        var al = doc.splitTextToSize(app, 186);
        doc.text(al, 12, y);
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text('Fiche conseil de classe — professeur principal', 12, 287);
        doc.save('Conseil_' + nomComplet.replace(/\s+/g, '_') + '_' + view.periode + '.pdf');
    }

    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        var el = document.getElementById('conseil-modale');
        if (el && el.classList.contains('is-open')) closeOverlay();
    });

    global.EprofConseilClasse = {
        render: render,
        isAvailable: function () { return ppClasses().length > 0; }
    };
})(window);
