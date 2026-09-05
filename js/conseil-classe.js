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

    var cache = { classes: {}, updatedAt: '' };
    var syncTimer = null;
    var directory = [];
    var view = { classe: '', periode: '', tab: 'vue', eleve: '', search: '', sort: 'nom', filter: 'all' };
    var ready = false;
    var rangsCache = null;

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
            cache.classes[classe] = { matieres: defaultMatieres(), periodes: {}, profs: [], archives: [], conseilAt: '', updatedAt: '' };
            created = true;
        }
        if (!cache.classes[classe].matieres || !cache.classes[classe].matieres.length) {
            cache.classes[classe].matieres = defaultMatieres();
            created = true;
        }
        if (!Array.isArray(cache.classes[classe].profs)) cache.classes[classe].profs = [];
        if (!Array.isArray(cache.classes[classe].archives)) cache.classes[classe].archives = [];
        if (typeof cache.classes[classe].conseilAt !== 'string') cache.classes[classe].conseilAt = '';
        if (normalizeProfs(cache.classes[classe]) && ready) created = true;
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
    function stampOf(obj) {
        return Date.parse((obj && obj.updatedAt) || '') || 0;
    }
    function touchClass(classe) {
        var now = new Date().toISOString();
        cache.updatedAt = now;
        if (classe && cache.classes && cache.classes[classe]) {
            cache.classes[classe].updatedAt = now;
        }
    }
    function mergeDocs(local, distant) {
        if (!distant || !distant.classes) return local && local.classes ? local : { classes: {} };
        if (!local || !local.classes) return distant;
        var out = { classes: {}, updatedAt: '' };
        var names = {};
        Object.keys(local.classes).forEach(function (k) { names[k] = true; });
        Object.keys(distant.classes).forEach(function (k) { names[k] = true; });
        Object.keys(names).forEach(function (k) {
            var L = local.classes[k];
            var D = distant.classes[k];
            if (!L) out.classes[k] = D;
            else if (!D) out.classes[k] = L;
            else {
                var ls = stampOf(L);
                var ds = stampOf(D);
                if (!ls && !ds) out.classes[k] = D;
                else out.classes[k] = ls >= ds ? L : D;
            }
        });
        var lsDoc = stampOf(local);
        var dsDoc = stampOf(distant);
        out.updatedAt = (lsDoc >= dsDoc ? local.updatedAt : distant.updatedAt) || local.updatedAt || distant.updatedAt || '';
        return out;
    }
    function planifierSync() {
        if (view.classe) touchClass(view.classe);
        else cache.updatedAt = new Date().toISOString();
        ecrireLocal(cache);
        clearTimeout(syncTimer);
        syncTimer = setTimeout(function () { sauverEnLigne(cache); }, 900);
        if (global.EprofAppHooks && typeof global.EprofAppHooks.updateNotifications === 'function') {
            global.EprofAppHooks.updateNotifications();
        }
    }
    async function hydrater() {
        try {
            var local = lireLocal();
            if (local && local.classes) cache = local;
            var distant = await chargerEnLigne();
            if (distant && distant.classes) {
                cache = mergeDocs(cache, distant);
                ecrireLocal(cache);
            }
            await chargerDirectory();
        } finally {
            ready = true;
            if (global.EprofAppHooks && typeof global.EprofAppHooks.updateNotifications === 'function') {
                global.EprofAppHooks.updateNotifications();
            }
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
        return String(p.identifiant || profLabel(p) || '').trim();
    }
    function normMatiereNom(nom) {
        return String(nom || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }
    function matchMatiereId(mats, nom) {
        var n = normMatiereNom(nom);
        if (!n || !mats || !mats.length) return '';
        var exact = mats.find(function (m) { return normMatiereNom(m.nom) === n; });
        if (exact) return exact.id;
        var fuzzy = mats.find(function (m) {
            var mn = normMatiereNom(m.nom);
            return mn && (mn.indexOf(n) !== -1 || n.indexOf(mn) !== -1);
        });
        return fuzzy ? fuzzy.id : '';
    }
    function collectMatiereIds(p, mats) {
        var valid = {};
        (mats || []).forEach(function (m) { valid[m.id] = true; });
        var ids = [];
        function add(id) {
            if (id && valid[id] && ids.indexOf(id) === -1) ids.push(id);
        }
        (Array.isArray(p.matiereIds) ? p.matiereIds : []).forEach(add);
        var names = [];
        if (p.matiere) names.push(p.matiere);
        if (Array.isArray(p.matieres)) names = names.concat(p.matieres);
        names.forEach(function (nom) { add(matchMatiereId(mats, nom)); });
        return ids;
    }
    function profMatieresLabel(classe, p) {
        var mats = classData(classe).matieres || [];
        var ids = p.matiereIds || [];
        return mats.filter(function (m) { return ids.indexOf(m.id) !== -1; }).map(function (m) { return m.nom; }).join(', ');
    }
    function normalizeProfs(c) {
        if (!c || !Array.isArray(c.profs)) return false;
        var mats = c.matieres || [];
        var oldList = c.profs;
        var needs = oldList.some(function (p) {
            return (p && (p.matiere || (p.matiereIds && p.matiereIds.some(function (id) {
                return !mats.some(function (m) { return m.id === id; });
            })))) || false;
        });
        var keys = {};
        oldList.forEach(function (p) {
            var k = profKey(p);
            if (k) keys[k] = (keys[k] || 0) + 1;
        });
        var hasDup = Object.keys(keys).some(function (k) { return keys[k] > 1; });
        var hasOldRetour = false;
        Object.keys(c.periodes || {}).forEach(function (per) {
            var map = (c.periodes[per] && c.periodes[per].retoursProfs) || {};
            Object.keys(map).forEach(function (k) {
                if (k.indexOf('::') !== -1) hasOldRetour = true;
            });
        });
        if (!needs && !hasDup && !hasOldRetour && oldList.every(function (p) { return Array.isArray(p.matiereIds); })) {
            return false;
        }
        var order = [];
        var index = {};
        oldList.forEach(function (p) {
            var k = profKey(p);
            if (!k) return;
            if (!index[k]) {
                index[k] = {
                    identifiant: p.identifiant || '',
                    nom: p.nom || '',
                    prenom: p.prenom || '',
                    matiereIds: []
                };
                order.push(index[k]);
            }
            var dest = index[k];
            if (!dest.nom && p.nom) dest.nom = p.nom;
            if (!dest.prenom && p.prenom) dest.prenom = p.prenom;
            if (!dest.identifiant && p.identifiant) dest.identifiant = p.identifiant;
            dest.matiereIds = collectMatiereIds({
                matiereIds: dest.matiereIds.concat(p.matiereIds || []),
                matiere: p.matiere,
                matieres: p.matieres
            }, mats);
        });
        c.profs = order;
        Object.keys(c.periodes || {}).forEach(function (per) {
            var map = (c.periodes[per] && c.periodes[per].retoursProfs) || {};
            var next = {};
            Object.keys(map).forEach(function (k) {
                var texte = map[k];
                var newKey = k.indexOf('::') !== -1 ? k.split('::')[0] : k;
                if (!newKey) return;
                if (next[newKey] && next[newKey] !== texte) {
                    next[newKey] = [next[newKey], texte].filter(Boolean).join('\n\n');
                } else if (!next[newKey]) {
                    next[newKey] = texte;
                }
            });
            c.periodes[per].retoursProfs = next;
        });
        return true;
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
                matiereIds: (p.matiereIds || []).slice(),
                matieresLabel: profMatieresLabel(classe, p),
                texte: map[profKey(p)] || ''
            };
        });
    }
    function mergeProfs(classe, incoming) {
        var c = classData(classe);
        var mats = c.matieres || [];
        var list = (c.profs || []).slice();
        var index = {};
        list.forEach(function (p) { index[profKey(p)] = p; });
        var added = 0;
        (incoming || []).forEach(function (p) {
            var k = profKey(p);
            if (!k) return;
            var ids = collectMatiereIds(p, mats);
            if (index[k]) {
                var dest = index[k];
                var before = (dest.matiereIds || []).join(',');
                dest.matiereIds = collectMatiereIds({
                    matiereIds: (dest.matiereIds || []).concat(ids),
                    matiere: p.matiere,
                    matieres: p.matieres
                }, mats);
                if (!dest.nom && p.nom) dest.nom = p.nom;
                if (!dest.prenom && p.prenom) dest.prenom = p.prenom;
                if (dest.matiereIds.join(',') !== before) added += 1;
                return;
            }
            var row = {
                identifiant: p.identifiant || '',
                nom: p.nom || '',
                prenom: p.prenom || '',
                matiereIds: ids
            };
            list.push(row);
            index[k] = row;
            added += 1;
        });
        c.profs = list;
        return added;
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

    function periodePrecedente(classe, periode) {
        var pers = periodesReelles(classe);
        var i = -1;
        pers.forEach(function (p, idx) { if (p.id === periode) i = idx; });
        return i > 0 ? pers[i - 1] : null;
    }
    function periodeSuivante(classe, periode) {
        var pers = periodesReelles(classe);
        var i = -1;
        pers.forEach(function (p, idx) { if (p.id === periode) i = idx; });
        return (i >= 0 && i < pers.length - 1) ? pers[i + 1] : null;
    }
    function rangsMap(classe, periode) {
        var list = eleves(classe).map(function (e) {
            return { nom: e.nomComplet, m: moyenneEleve(classe, periode, e.nomComplet) };
        }).filter(function (x) { return x.m != null; }).sort(function (a, b) { return b.m - a.m; });
        var map = {};
        list.forEach(function (x, i) {
            var rang = i + 1;
            if (i > 0 && Math.abs(list[i - 1].m - x.m) < 0.05) rang = map[list[i - 1].nom].rang;
            map[x.nom] = { rang: rang, n: list.length };
        });
        return map;
    }
    function rangsCourants() {
        if (!rangsCache) rangsCache = rangsMap(view.classe, view.periode);
        return rangsCache;
    }
    function fmtRang(nomComplet) {
        var r = rangsCourants()[nomComplet];
        return r ? (r.rang + ' / ' + r.n) : '—';
    }
    function elevesFiltres() {
        var list = eleves(view.classe);
        var q = String(view.search || '').trim().toLowerCase();
        if (q) {
            list = list.filter(function (e) {
                return e.nomComplet.toLowerCase().indexOf(q) !== -1;
            });
        }
        var prev = periodePrecedente(view.classe, view.periode);
        if (view.filter === 'sans-app') {
            list = list.filter(function (e) {
                return !appreciationEleve(view.classe, view.periode, e.nomComplet);
            });
        } else if (view.filter === 'sans-moy') {
            list = list.filter(function (e) {
                return moyenneEleve(view.classe, view.periode, e.nomComplet) == null;
            });
        } else if (view.filter === 'pap') {
            list = list.filter(function (e) {
                return infoPpEleve(e.nomComplet).dispositifs.indexOf('PAP') !== -1;
            });
        } else if (view.filter === 'baisse') {
            list = list.filter(function (e) {
                if (!prev) return false;
                var a = moyenneEleve(view.classe, view.periode, e.nomComplet);
                var b = moyenneEleve(view.classe, prev.id, e.nomComplet);
                return a != null && b != null && a < b - 0.05;
            });
        } else if (view.filter === 'sanctions') {
            list = list.filter(function (e) {
                return sanctionsEleve(view.classe, view.periode, e.nomComplet).length > 0;
            });
        }
        var sort = view.sort || 'nom';
        list = list.slice().sort(function (a, b) {
            if (sort === 'moyenne' || sort === 'rang') {
                var ma = moyenneEleve(view.classe, view.periode, a.nomComplet);
                var mb = moyenneEleve(view.classe, view.periode, b.nomComplet);
                if (ma == null && mb == null) return String(a.nom || '').localeCompare(String(b.nom || ''), 'fr');
                if (ma == null) return 1;
                if (mb == null) return -1;
                if (mb !== ma) return mb - ma;
            }
            if (sort === 'sanctions') {
                var d = sanctionsEleve(view.classe, view.periode, b.nomComplet).length
                    - sanctionsEleve(view.classe, view.periode, a.nomComplet).length;
                if (d) return d;
            }
            return String(a.nom || '').localeCompare(String(b.nom || ''), 'fr');
        });
        return list;
    }
    function checklist() {
        var list = eleves(view.classe);
        var sansApp = 0;
        var sansMoy = 0;
        list.forEach(function (e) {
            if (!appreciationEleve(view.classe, view.periode, e.nomComplet)) sansApp += 1;
            if (moyenneEleve(view.classe, view.periode, e.nomComplet) == null) sansMoy += 1;
        });
        var retours = retoursList(view.classe, view.periode);
        var retoursVides = retours.filter(function (r) { return !(r.texte || '').trim(); }).length;
        return {
            sansApp: sansApp,
            sansMoy: sansMoy,
            retoursVides: retoursVides,
            nbRetours: retours.length,
            effectif: list.length
        };
    }
    function toDatetimeLocal(iso) {
        if (!iso) return '';
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(iso)) return iso;
        var d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        function pad(n) { return String(n).padStart ? String(n).padStart(2, '0') : (n < 10 ? '0' + n : String(n)); }
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
            'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    }
    function formatDateTime(iso) {
        if (!iso) return '';
        try {
            var d = new Date(iso);
            if (isNaN(d.getTime())) return iso;
            return d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
        } catch (e) { return iso; }
    }
    function conseilDansDeuxSemaines(at) {
        if (!at) return false;
        var t = new Date(at).getTime();
        if (isNaN(t)) return false;
        var delta = t - Date.now();
        return delta >= 0 && delta <= 14 * 24 * 60 * 60 * 1000;
    }
    function nbAlertes() {
        var n = 0;
        var classes = ppClasses();
        var store = (cache && cache.classes && Object.keys(cache.classes).length)
            ? cache.classes
            : ((lireLocal() || {}).classes || {});
        classes.forEach(function (nom) {
            var c = store[nom];
            if (c && conseilDansDeuxSemaines(c.conseilAt)) n += 1;
        });
        return n;
    }
    function eleveNomBtn(nomComplet) {
        return '<button type="button" class="conseil-link-eleve" data-eleve="' + esc(nomComplet) +
            '" title="Ouvrir la fiche de suivi">' + esc(nomComplet) + '</button>';
    }
    function openSuiviEleve(nomComplet) {
        if (!E().openTool) return;
        E().openTool('eleves', {
            classe: view.classe,
            eleve: nomComplet,
            from: 'conseil-classe',
            conseil: {
                classe: view.classe,
                periode: view.periode,
                tab: view.tab,
                search: view.search,
                sort: view.sort,
                filter: view.filter
            }
        });
    }

    function render(container, extra) {
        extra = extra || {};
        ensureCss();
        if (extra.classe) view.classe = extra.classe;
        if (extra.periode) view.periode = extra.periode;
        if (extra.tab) view.tab = extra.tab;
        if (extra.search != null) view.search = extra.search;
        if (extra.sort) view.sort = extra.sort;
        if (extra.filter) view.filter = extra.filter;
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
        rangsCache = null;
        var pers = periodesFor(view.classe);
        if (!view.periode || !pers.some(function (p) { return p.id === view.periode; })) {
            view.periode = pers[0].id;
        }
        var nextPer = periodeSuivante(view.classe, view.periode);
        var listes = E().getListsForTeacher ? E().getListsForTeacher() : {};
        var conseilAt = toDatetimeLocal(classData(view.classe).conseilAt || '');
        container.innerHTML =
            '<div class="conseil-wrap" id="conseil-classe-module">' +
            '<div id="conseil-alerte-slot"></div>' +
            '<div class="conseil-head">' +
            '<div><h2>🎓 Conseil de classe</h2>' +
            '<p class="conseil-kicker">Espace professeur principal · ' + esc(annee()) +
            ' · enregistré en ligne, indépendant du carnet de notes</p></div>' +
            '<div class="conseil-head-actions">' +
            '<label class="conseil-datetime">Date du conseil' +
            '<input type="datetime-local" id="conseil-at" value="' + esc(conseilAt) + '"></label>' +
            '<button type="button" class="btn-secondary" id="conseil-config-matieres">⚙️ Matières</button>' +
            '<button type="button" class="btn-secondary" id="conseil-prep-periode"' +
            (nextPer && !isAnnee(view.periode) ? '' : ' hidden') + '>' +
            (nextPer ? 'Préparer ' + esc(nextPer.label) : 'Préparer') + '</button>' +
            '<button type="button" class="btn-secondary" id="conseil-archives">📁 Historique</button>' +
            '<button type="button" class="btn-secondary" id="conseil-pdf-classe">📄 PDF classe</button>' +
            '<button type="button" class="btn-secondary" id="conseil-pdf-seance">📄 PDF séance</button>' +
            '<button type="button" class="btn-secondary" id="conseil-pdf-moyennes">📄 PDF moyennes</button>' +
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
            '<div class="conseil-toolbar-filtres">' +
            '<input type="search" id="conseil-search" class="conseil-search" placeholder="Filtrer les élèves…" value="' + esc(view.search) + '" aria-label="Filtrer les élèves">' +
            '<label>Trier <select id="conseil-sort" aria-label="Trier">' +
            [['nom', 'Nom'], ['moyenne', 'Moyenne'], ['rang', 'Rang'], ['sanctions', 'Sanctions']].map(function (opt) {
                return '<option value="' + opt[0] + '"' + (view.sort === opt[0] ? ' selected' : '') + '>' + opt[1] + '</option>';
            }).join('') + '</select></label>' +
            '<label>Filtre <select id="conseil-filter" aria-label="Filtrer">' +
            [['all', 'Tous'], ['sans-app', 'Sans appréciation'], ['sans-moy', 'Sans moyenne'],
             ['pap', 'PAP'], ['baisse', 'En baisse'], ['sanctions', 'Avec sanctions']].map(function (opt) {
                return '<option value="' + opt[0] + '"' + (view.filter === opt[0] ? ' selected' : '') + '>' + opt[1] + '</option>';
            }).join('') + '</select></label>' +
            '</div>' +
            '<div id="conseil-body"></div>' +
            '</div>';
        bindShell(container);
        syncShellChrome(container);
        paintBody(container);
    }

    function syncShellChrome(container) {
        container.querySelectorAll('[data-periode]').forEach(function (btn) {
            btn.classList.toggle('is-on', btn.getAttribute('data-periode') === view.periode);
        });
        container.querySelectorAll('[data-tab]').forEach(function (btn) {
            btn.classList.toggle('is-on', btn.getAttribute('data-tab') === view.tab);
        });
        var filtres = container.querySelector('.conseil-toolbar-filtres');
        if (filtres) filtres.hidden = view.tab === 'retours';
        var nextPer = periodeSuivante(view.classe, view.periode);
        var prep = container.querySelector('#conseil-prep-periode');
        if (prep) {
            if (nextPer && !isAnnee(view.periode)) {
                prep.hidden = false;
                prep.textContent = 'Préparer ' + nextPer.label;
            } else {
                prep.hidden = true;
            }
        }
        var slot = container.querySelector('#conseil-alerte-slot');
        if (slot) {
            var at = classData(view.classe).conseilAt || '';
            slot.innerHTML = conseilDansDeuxSemaines(at)
                ? '<div class="conseil-alerte-date" role="status">Conseil de classe le ' +
                  esc(formatDateTime(at)) + ' — dans moins de deux semaines.</div>'
                : '';
        }
    }

    function bindShell(container) {
        container.querySelectorAll('.classe-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                view.classe = btn.getAttribute('data-classe');
                view.eleve = '';
                rangsCache = null;
                paint(container);
            });
        });
        container.querySelectorAll('[data-periode]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                view.periode = btn.getAttribute('data-periode');
                rangsCache = null;
                syncShellChrome(container);
                paintBody(container);
            });
        });
        container.querySelectorAll('[data-tab]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                view.tab = btn.getAttribute('data-tab');
                syncShellChrome(container);
                paintBody(container);
            });
        });
        var search = container.querySelector('#conseil-search');
        if (search) {
            search.addEventListener('input', function () {
                view.search = search.value;
                clearTimeout(search._t);
                search._t = setTimeout(function () { paintBody(container); }, 120);
            });
        }
        var sortSel = container.querySelector('#conseil-sort');
        if (sortSel) {
            sortSel.addEventListener('change', function () {
                view.sort = sortSel.value;
                paintBody(container);
            });
        }
        var filterSel = container.querySelector('#conseil-filter');
        if (filterSel) {
            filterSel.addEventListener('change', function () {
                view.filter = filterSel.value;
                paintBody(container);
            });
        }
        var atInp = container.querySelector('#conseil-at');
        if (atInp) {
            atInp.addEventListener('change', function () {
                classData(view.classe).conseilAt = atInp.value || '';
                planifierSync();
                syncShellChrome(container);
            });
        }
        var cfg = container.querySelector('#conseil-config-matieres');
        if (cfg) cfg.addEventListener('click', function () { openMatieresModal(container); });
        var prep = container.querySelector('#conseil-prep-periode');
        if (prep) prep.addEventListener('click', function () { preparerPeriode(container); });
        var arch = container.querySelector('#conseil-archives');
        if (arch) arch.addEventListener('click', function () { openArchivesModal(container); });
        var pdf = container.querySelector('#conseil-pdf-classe');
        if (pdf) pdf.addEventListener('click', function () { exportPdfClasse(); });
        var pdfS = container.querySelector('#conseil-pdf-seance');
        if (pdfS) pdfS.addEventListener('click', function () { exportPdfSeance(); });
        var pdfM = container.querySelector('#conseil-pdf-moyennes');
        if (pdfM) pdfM.addEventListener('click', function () { exportPdfMoyennes(); });
    }

    function preparerPeriode(container) {
        var next = periodeSuivante(view.classe, view.periode);
        if (!next) return;
        var src = periodeData(view.classe, view.periode);
        var dest = periodeData(view.classe, next.id);
        Object.keys(src.retoursProfs || {}).forEach(function (k) {
            if (dest.retoursProfs[k] == null) dest.retoursProfs[k] = '';
        });
        planifierSync();
        view.periode = next.id;
        rangsCache = null;
        syncShellChrome(container);
        paintBody(container);
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
        bindCharCounters(container);
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

    function htmlChecklist() {
        var c = checklist();
        var items = [
            { id: 'sans-moy', n: c.sansMoy, label: c.sansMoy + ' élève' + (c.sansMoy > 1 ? 's' : '') + ' sans moyenne' },
            { id: 'sans-app', n: c.sansApp, label: c.sansApp + ' élève' + (c.sansApp > 1 ? 's' : '') + ' sans appréciation' },
            { id: 'retours', n: c.retoursVides, label: c.retoursVides + ' retour' + (c.retoursVides > 1 ? 's' : '') + ' prof vide' + (c.nbRetours ? ' / ' + c.nbRetours : '') }
        ];
        var ok = !c.sansMoy && !c.sansApp && !c.retoursVides;
        return '<div class="conseil-checklist">' +
            '<h3>Préparation</h3>' +
            (ok
                ? '<p class="conseil-hint" style="margin:0">Tout est renseigné pour cette période.</p>'
                : '<ul>' + items.map(function (it) {
                    if (!it.n) return '';
                    if (it.id === 'retours') {
                        return '<li><button type="button" class="conseil-check-item" data-tab="retours">' +
                            esc(it.label) + '</button></li>';
                    }
                    return '<li><button type="button" class="conseil-check-item" data-filter="' + it.id + '">' +
                        esc(it.label) + '</button></li>';
                }).join('') + '</ul>') +
            '</div>';
    }

    function htmlAppClasseReadonly() {
        var txt = (periodeData(view.classe, view.periode).appreciationClasse || '').trim();
        return '<div class="conseil-panel"><h3>Appréciation de classe' + (isAnnee(view.periode) ? ' (année)' : '') + '</h3>' +
            (txt ? '<p class="conseil-app-preview">' + esc(txt) + '</p>' : '<p class="conseil-hint">Pas encore rédigée.</p>') +
            '<button type="button" class="btn-secondary conseil-goto-app">Éditer dans Appréciations</button></div>';
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
        var list = elevesFiltres().map(function (e) {
            var m = moyenneEleve(view.classe, view.periode, e.nomComplet);
            var nSanc = sanctionsEleve(view.classe, view.periode, e.nomComplet).length;
            var app = appreciationEleve(view.classe, view.periode, e.nomComplet);
            var info = infoPpEleve(e.nomComplet);
            var infoHtml = info.dispositifs.length
                ? info.dispositifs.map(function (id) { return '<span class="conseil-chip">' + esc(id) + '</span>'; }).join('')
                : '—';
            return '<tr><td class="sticky-col">' + eleveNomBtn(e.nomComplet) + '</td>' +
                '<td class="conseil-moy ' + moyClass(m) + '">' + fmtMoy(m) + '</td>' +
                '<td>' + fmtRang(e.nomComplet) + '</td>' +
                '<td>' + (nSanc ? '<span class="conseil-chip danger">' + nSanc + '</span>' : '—') + '</td>' +
                '<td><div class="conseil-chips" style="justify-content:center">' + infoHtml + '</div></td>' +
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
            '<h3>' + (isAnnee(view.periode) ? 'Sanctions de l’année' : 'Sanctions de la période') + '</h3><div class="conseil-chips">' + (types || '<span class="conseil-hint">Aucune</span>') + '</div>' +
            htmlChecklist() +
            '</div>' +
            htmlAppClasseReadonly() +
            '</div>' +
            '<div class="conseil-panel" style="margin-top:14px;"><h3>Tableau de bord</h3>' +
            '<div class="conseil-table-wrap"><table class="conseil-table"><thead><tr>' +
            '<th class="sticky-col">Élève</th><th>Moy.</th><th>Rang</th><th>Sanctions</th><th>Info</th><th>Appr.</th></tr></thead><tbody>' +
            (list || '<tr><td class="sticky-col">Aucun élève</td></tr>') + '</tbody></table></div></div>';
    }

    function htmlMoyennes() {
        if (isAnnee(view.periode)) return htmlMoyennesAnnee();
        var matieres = classData(view.classe).matieres || [];
        var list = elevesFiltres();
        var head = '<th class="sticky-col">Élève</th>' + matieres.map(function (m) {
            return '<th>' + esc(m.nom) + '<br><small>coef ' + esc(m.coef) + '</small></th>';
        }).join('') + '<th>Moy.</th><th>Rang</th>';
        var rows = list.map(function (e) {
            var m = moyenneEleve(view.classe, view.periode, e.nomComplet);
            return '<tr><td class="sticky-col">' + eleveNomBtn(e.nomComplet) + '</td>' +
                matieres.map(function (mat) {
                    var val = noteMatiere(view.classe, view.periode, e.nomComplet, mat.id);
                    return '<td><input type="number" min="0" max="20" step="0.1" inputmode="decimal" data-moy="' + esc(e.nomComplet) +
                        '" data-mat="' + esc(mat.id) + '" value="' + (val == null ? '' : esc(val)) + '"></td>';
                }).join('') +
                '<td class="conseil-moy ' + moyClass(m) + '" data-moy-cell="' + esc(e.nomComplet) + '">' + fmtMoy(m) + '</td>' +
                '<td data-rang-cell="' + esc(e.nomComplet) + '">' + fmtRang(e.nomComplet) + '</td></tr>';
        }).join('');
        return htmlStats() +
            '<div class="conseil-panel"><div class="conseil-toolbar"><p class="conseil-hint" style="margin:0">Moyennes coefficientées du conseil — elles ne sont <strong>pas</strong> reportées dans le carnet de notes.</p></div>' +
            '<div class="conseil-table-wrap"><table class="conseil-table"><thead><tr>' + head + '</tr></thead><tbody>' +
            (rows || '<tr><td class="sticky-col">Aucun élève</td></tr>') + '</tbody></table></div></div>';
    }

    function htmlMoyennesAnnee() {
        var pers = periodesReelles(view.classe);
        var matieres = classData(view.classe).matieres || [];
        var list = elevesFiltres();
        var headPer = '<th class="sticky-col">Élève</th>' + pers.map(function (p) {
            return '<th>' + esc(p.label) + '</th>';
        }).join('') + '<th>Année</th><th>Rang</th>';
        var rowsPer = list.map(function (e) {
            var an = moyenneEleve(view.classe, AN_ID, e.nomComplet);
            return '<tr><td class="sticky-col">' + eleveNomBtn(e.nomComplet) + '</td>' +
                pers.map(function (per) {
                    var m = moyenneEleve(view.classe, per.id, e.nomComplet);
                    return '<td class="conseil-moy ' + moyClass(m) + '">' + fmtMoy(m) + '</td>';
                }).join('') +
                '<td class="conseil-moy ' + moyClass(an) + '">' + fmtMoy(an) + '</td>' +
                '<td>' + fmtRang(e.nomComplet) + '</td></tr>';
        }).join('');
        var headMat = '<th class="sticky-col">Élève</th>' + matieres.map(function (m) {
            return '<th>' + esc(m.nom) + '<br><small>coef ' + esc(m.coef) + '</small></th>';
        }).join('') + '<th>Moy.</th>';
        var rowsMat = list.map(function (e) {
            var an = moyenneEleve(view.classe, AN_ID, e.nomComplet);
            return '<tr><td class="sticky-col">' + eleveNomBtn(e.nomComplet) + '</td>' +
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
        var list = elevesFiltres();
        var year = isAnnee(view.periode);
        var cards = list.map(function (e) {
            var items = sanctionsEleve(view.classe, view.periode, e.nomComplet);
            items.forEach(function (s) { if (!s.id) s.id = uid(); });
            var open = view.eleve === e.nomComplet ? ' is-open' : '';
            var body = view.eleve === e.nomComplet
                ? '<div class="conseil-eleve-body">' + htmlSanctionList(e.nomComplet, items, year) +
                  (year ? '' : '<button type="button" class="btn-primary conseil-add-sanc" data-eleve="' + esc(e.nomComplet) + '">➕ Ajouter une sanction</button>') +
                  '</div>'
                : '';
            return '<div class="conseil-eleve-card' + open + '">' +
                '<div class="conseil-eleve-head" data-open="' + esc(e.nomComplet) + '">' +
                '<strong>' + eleveNomBtn(e.nomComplet) + '</strong>' +
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
        return '<div class="conseil-sanctions">' + items.map(function (s) {
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
                (readOnly ? '' : '<div class="conseil-sanction-actions">' +
                '<button type="button" class="btn-secondary conseil-edit-sanc" data-eleve="' + esc(nomComplet) +
                '" data-sid="' + esc(s.id) + '">Modifier</button>' +
                '<button type="button" class="btn-secondary conseil-del-sanc" data-eleve="' + esc(nomComplet) +
                '" data-sid="' + esc(s.id) + '">Supprimer</button></div>') + '</div>';
        }).join('') + '</div>';
    }

    function htmlRetours() {
        var profs = retoursList(view.classe, view.periode);
        var mats = classData(view.classe).matieres || [];
        var already = {};
        profs.forEach(function (p) { already[p.key] = true; });
        var seenDir = {};
        var opts = directory.map(function (p) {
            var lab = profLabel(p);
            var k = String(p.identifiant || lab || '').trim();
            if (!k || already[k] || seenDir[k]) return '';
            seenDir[k] = true;
            return '<option value="' + esc(k) + '" data-matiere="' + esc(p.matiere || '') + '">' +
                esc(lab) + (p.matiere ? ' · ' + esc(p.matiere) : '') + '</option>';
        }).join('');
        var cards = profs.map(function (p) {
            var titre = profLabel(p) || p.identifiant || 'Enseignant';
            var picks = mats.length
                ? '<div class="conseil-matiere-picks" role="group" aria-label="Matières">' +
                  mats.map(function (m) {
                      var on = (p.matiereIds || []).indexOf(m.id) !== -1;
                      return '<label class="conseil-mat-chip' + (on ? ' is-on' : '') + '">' +
                          '<input type="checkbox" class="conseil-prof-mat" data-pkey="' + esc(p.key) +
                          '" data-matid="' + esc(m.id) + '"' + (on ? ' checked' : '') + '>' +
                          esc(m.nom) + '</label>';
                  }).join('') + '</div>'
                : '<p class="conseil-hint">Configurez d’abord les matières de la classe.</p>';
            return '<div class="conseil-eleve-card conseil-retour-card">' +
                '<div class="conseil-eleve-head" style="cursor:default">' +
                '<div><strong>' + esc(titre) + '</strong>' +
                (p.matieresLabel ? '<div class="conseil-sanction-meta">' + esc(p.matieresLabel) + '</div>' : '') +
                '</div>' +
                '<button type="button" class="btn-secondary conseil-del-prof" data-pkey="' + esc(p.key) + '">Retirer</button>' +
                '</div>' +
                picks +
                '<textarea class="conseil-app-area conseil-retour-texte" data-pkey="' + esc(p.key) +
                '" rows="4" placeholder="Appréciation générale de l’enseignant pour la classe…">' +
                esc(p.texte) + '</textarea></div>';
        }).join('');
        return htmlStats() +
            '<div class="conseil-panel"><h3>Retour des professeurs</h3>' +
            '<p class="conseil-hint">Appréciation générale de chaque enseignant. Associez-le à une ou plusieurs <strong>matières de la classe</strong>. Le tout figure sur le <strong>PDF classe</strong>' +
            (isAnnee(view.periode) ? ' (récapitulatif annuel).' : '.') + '</p>' +
            '<div class="conseil-toolbar">' +
            '<div class="conseil-add-prof-row">' +
            '<select id="conseil-pick-prof"><option value="">— Ajouter un enseignant —</option>' + opts + '</select>' +
            '<button type="button" class="btn-secondary" id="conseil-add-prof">Ajouter</button>' +
            '</div></div>' +
            (cards
                ? '<div class="conseil-eleve-list">' + cards + '</div>'
                : '<p class="conseil-hint">Aucun enseignant pour l’instant. Ajoutez un collègue depuis la liste blanche.</p>') +
            '</div>';
    }

    function htmlAppreciations() {
        var list = elevesFiltres();
        var p = periodeData(view.classe, view.periode);
        var rows = list.map(function (e) {
            var extra = '';
            if (isAnnee(view.periode)) {
                extra = '<p class="conseil-sanction-meta">' + periodesReelles(view.classe).map(function (per) {
                    var t = (periodeData(view.classe, per.id).appreciations[e.nomComplet] || '').trim();
                    return esc(per.label) + ' : ' + (t ? '✓' : '—');
                }).join(' · ') + '</p>';
            }
            return '<div class="conseil-eleve-card">' + eleveNomBtn(e.nomComplet) + extra +
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
        var list = elevesFiltres();
        var pers = periodesReelles(view.classe);
        var cards = list.map(function (e) {
            var m = moyenneEleve(view.classe, view.periode, e.nomComplet);
            var nSanc = sanctionsEleve(view.classe, view.periode, e.nomComplet).length;
            var app = appreciationEleve(view.classe, view.periode, e.nomComplet);
            var histo = pers.map(function (per) {
                return per.label.replace(/Semestre |Trimestre /, '') + ': ' + fmtMoy(moyenneEleve(view.classe, per.id, e.nomComplet));
            }).join(' · ') + ' · Année : ' + fmtMoy(moyenneEleve(view.classe, AN_ID, e.nomComplet));
            var info = infoPpEleve(e.nomComplet);
            var infoBlock = '';
            if (info.dispositifs.length || info.infosPerso.length) {
                infoBlock = '<div class="conseil-chips" style="margin:8px 0">' +
                    info.dispositifs.map(function (id) {
                        return '<span class="conseil-chip">' + esc(id) + '</span>';
                    }).join('') + '</div>' +
                    (info.infosPerso.length
                        ? '<p class="conseil-sanction-meta">' + info.infosPerso.slice(0, 2).map(function (n) {
                            return esc((n.texte || '').slice(0, 120));
                        }).join(' · ') + '</p>'
                        : '');
            }
            return '<div class="conseil-eleve-card">' +
                '<div class="conseil-eleve-head" style="cursor:default">' + eleveNomBtn(e.nomComplet) +
                '<span class="conseil-chips"><span class="conseil-chip">Moy. ' + fmtMoy(m) + '</span>' +
                '<span class="conseil-chip">Rang ' + fmtRang(e.nomComplet) + '</span>' +
                (nSanc ? '<span class="conseil-chip danger">' + nSanc + ' sanction' + (nSanc > 1 ? 's' : '') + '</span>' : '') +
                '</span></div>' +
                '<p class="conseil-sanction-meta">' + esc(histo) + '</p>' +
                infoBlock +
                '<p>' + (app ? esc(app) : '<span class="conseil-hint">Pas d’appréciation</span>') + '</p>' +
                '<button type="button" class="btn-secondary conseil-pdf-eleve" data-eleve="' + esc(e.nomComplet) + '">📄 Fiche PDF</button>' +
                '</div>';
        }).join('');
        return htmlStats() +
            '<div class="conseil-panel"><p class="conseil-hint">Suivi de l’année : moyennes par période, sanctions et appréciations. Export visuel pour le conseil.</p>' +
            '<div class="conseil-eleve-list">' + cards + '</div></div>';
    }

    function bindCharCounters(root) {
        if (!root) return;
        root.querySelectorAll('textarea.conseil-app-area').forEach(function (area) {
            var wrap = area.closest('.conseil-area-wrap');
            if (!wrap) {
                wrap = document.createElement('div');
                wrap.className = 'conseil-area-wrap';
                area.parentNode.insertBefore(wrap, area);
                wrap.appendChild(area);
                var count = document.createElement('span');
                count.className = 'conseil-char-count';
                wrap.appendChild(count);
            }
            var countEl = wrap.querySelector('.conseil-char-count');
            function refresh() {
                var n = (area.value || '').length;
                countEl.textContent = n + ' caractère' + (n > 1 ? 's' : '');
            }
            if (!area._charBound) {
                area._charBound = true;
                area.addEventListener('input', refresh);
            }
            refresh();
        });
    }

    function infoPpEleve(nomComplet) {
        if (global.EprofSuiviEleves && typeof global.EprofSuiviEleves.infoPpSummary === 'function') {
            return global.EprofSuiviEleves.infoPpSummary(nomComplet) || { dispositifs: [], infosPerso: [] };
        }
        return { dispositifs: [], infosPerso: [] };
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
                rangsCache = null;
                planifierSync();
                var m = moyenneEleve(view.classe, view.periode, nom);
                var row = input.closest('tr');
                var cell = row && row.querySelector('[data-moy-cell]');
                if (cell) {
                    cell.textContent = fmtMoy(m);
                    cell.className = 'conseil-moy ' + moyClass(m);
                }
            });
        });
        container.querySelectorAll('.conseil-app-eleve').forEach(function (area) {
            area.addEventListener('input', function () {
                periodeData(view.classe, view.periode).appreciations[area.getAttribute('data-eleve')] = area.value;
                planifierSync();
            });
        });
        container.querySelectorAll('.conseil-link-eleve').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                openSuiviEleve(btn.getAttribute('data-eleve'));
            });
        });
        container.querySelectorAll('.conseil-goto-app').forEach(function (btn) {
            btn.addEventListener('click', function () {
                view.tab = 'appreciations';
                syncShellChrome(container);
                paintBody(container);
            });
        });
        container.querySelectorAll('.conseil-check-item').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var tab = btn.getAttribute('data-tab');
                var f = btn.getAttribute('data-filter');
                if (tab) view.tab = tab;
                if (f) {
                    view.filter = f;
                    var sel = container.querySelector('#conseil-filter');
                    if (sel) sel.value = view.filter;
                }
                syncShellChrome(container);
                paintBody(container);
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
        container.querySelectorAll('.conseil-edit-sanc').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                openSanctionModal(container, btn.getAttribute('data-eleve'), btn.getAttribute('data-sid'));
            });
        });
        container.querySelectorAll('.conseil-del-sanc').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                var nom = btn.getAttribute('data-eleve');
                var sid = btn.getAttribute('data-sid');
                var arr = periodeData(view.classe, view.periode).sanctions[nom] || [];
                periodeData(view.classe, view.periode).sanctions[nom] = arr.filter(function (s) {
                    return s.id !== sid;
                });
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
        container.querySelectorAll('.conseil-prof-mat').forEach(function (cb) {
            cb.addEventListener('change', function () {
                var key = cb.getAttribute('data-pkey');
                var matId = cb.getAttribute('data-matid');
                var prof = (classData(view.classe).profs || []).find(function (p) { return profKey(p) === key; });
                if (!prof) return;
                if (!Array.isArray(prof.matiereIds)) prof.matiereIds = [];
                var idx = prof.matiereIds.indexOf(matId);
                if (cb.checked && idx === -1) prof.matiereIds.push(matId);
                if (!cb.checked && idx !== -1) prof.matiereIds.splice(idx, 1);
                var chip = cb.closest('.conseil-mat-chip');
                if (chip) chip.classList.toggle('is-on', cb.checked);
                var meta = cb.closest('.conseil-retour-card');
                if (meta) {
                    var line = meta.querySelector('.conseil-eleve-head .conseil-sanction-meta');
                    var label = profMatieresLabel(view.classe, prof);
                    if (line) line.textContent = label;
                    else if (label) {
                        var title = meta.querySelector('.conseil-eleve-head div');
                        if (title) {
                            var div = document.createElement('div');
                            div.className = 'conseil-sanction-meta';
                            div.textContent = label;
                            title.appendChild(div);
                        }
                    }
                }
                planifierSync();
            });
        });
        var addProf = container.querySelector('#conseil-add-prof');
        if (addProf) {
            addProf.addEventListener('click', function () {
                var sel = container.querySelector('#conseil-pick-prof');
                var ident = sel && sel.value;
                if (!ident) return;
                var opt = sel.options[sel.selectedIndex];
                var matiere = opt ? (opt.getAttribute('data-matiere') || '') : '';
                var src = directory.find(function (p) {
                    return String(p.identifiant || profLabel(p) || '').trim() === ident;
                });
                var prof = src
                    ? { identifiant: src.identifiant || ident, nom: src.nom || '', prenom: src.prenom || '', matiere: src.matiere || matiere }
                    : { identifiant: ident, nom: '', prenom: ident, matiere: matiere };
                mergeProfs(view.classe, [prof]);
                planifierSync();
                paintBody(container);
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

    function openSanctionModal(container, nomComplet, sid) {
        var modal = getOverlay();
        var today = new Date().toISOString().slice(0, 10);
        var existing = null;
        if (sid) {
            var arr0 = periodeData(view.classe, view.periode).sanctions[nomComplet] || [];
            existing = arr0.filter(function (s) { return s.id === sid; })[0] || null;
        }
        var profOpts = '<option value="">— Choisir un enseignant —</option>' + directory.map(function (p) {
            var lab = profLabel(p);
            return '<option value="' + esc(lab) + '"' +
                (existing && existing.prof === lab ? ' selected' : '') + '>' +
                esc(lab) + (p.matiere ? ' · ' + esc(p.matiere) : '') + '</option>';
        }).join('');
        modal.className = 'conseil-modale is-open';
        modal.innerHTML = '<div class="conseil-modale-card"><h3>' + (existing ? 'Modifier' : 'Sanction') +
            ' · ' + esc(nomComplet) + '</h3>' +
            '<div class="conseil-form-row"><label>Type</label><select id="s-type">' +
            SANCTIONS.map(function (s) {
                return '<option value="' + s.id + '"' + (existing && existing.type === s.id ? ' selected' : '') + '>' +
                    esc(s.label) + '</option>';
            }).join('') +
            '</select></div>' +
            '<div class="conseil-form-row"><label>Date</label><input type="date" id="s-date" value="' +
            esc((existing && existing.date) || today) + '"></div>' +
            '<div class="conseil-form-row" id="s-prof-row"><label>Enseignant à l’origine</label><select id="s-prof">' + profOpts + '</select></div>' +
            '<div class="conseil-form-row" id="s-duree-row" hidden><label>Durée</label><input type="text" id="s-duree" placeholder="ex. 2 jours" value="' +
            esc((existing && existing.duree) || '') + '"></div>' +
            '<div class="conseil-form-row" id="s-obj-row" hidden><label>Objectifs</label><div id="s-obj-list"></div>' +
            '<button type="button" class="btn-secondary" id="s-add-obj">➕ Objectif</button></div>' +
            '<div class="conseil-form-row"><label>Motif / commentaire</label><textarea id="s-motif" rows="3">' +
            esc((existing && existing.motif) || '') + '</textarea></div>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap;"><button type="button" class="btn-primary" id="s-save">Enregistrer</button>' +
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
        function addObjectif(val) {
            var box = modal.querySelector('#s-obj-list');
            var meta = sanctionMeta(modal.querySelector('#s-type').value);
            if (meta.objectifs && box.children.length >= meta.objectifs.max) return;
            var input = document.createElement('input');
            input.type = 'text';
            input.className = 's-obj';
            input.placeholder = 'Objectif';
            input.style.marginBottom = '6px';
            if (val) input.value = val;
            box.appendChild(input);
        }
        modal.querySelector('#s-type').addEventListener('change', function () {
            modal.querySelector('#s-obj-list').innerHTML = '';
            refreshFields();
        });
        modal.querySelector('#s-add-obj').addEventListener('click', function () { addObjectif(); });
        if (existing && existing.objectifs && existing.objectifs.length) {
            existing.objectifs.forEach(function (o) { addObjectif(o); });
        }
        refreshFields();
        modal.querySelector('#s-cancel').addEventListener('click', function () { closeOverlay(); });
        modal.querySelector('#s-save').addEventListener('click', function () {
            var type = modal.querySelector('#s-type').value;
            var meta = sanctionMeta(type);
            var entry = {
                id: (existing && existing.id) || uid(),
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
            if (existing) {
                p.sanctions[nomComplet] = p.sanctions[nomComplet].map(function (s) {
                    return s.id === existing.id ? entry : s;
                });
            } else {
                p.sanctions[nomComplet].push(entry);
            }
            planifierSync();
            closeOverlay();
            view.eleve = nomComplet;
            paintBody(container);
        });
        modal.onclick = function (e) { if (e.target === modal) closeOverlay(); };
    }

    function openArchivesModal(container) {
        var modal = getOverlay();
        function draw() {
            var c = classData(view.classe);
            var list = (c.archives || []).slice();
            modal.className = 'conseil-modale is-open';
            modal.innerHTML = '<div class="conseil-modale-card">' +
                '<h3>Historique · ' + esc(view.classe) + '</h3>' +
                '<p class="conseil-hint">Archivez un instantané de l’année (matières, profs, saisies). Restaurer remplace les données actuelles, sans supprimer l’archive.</p>' +
                '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">' +
                '<button type="button" class="btn-primary" id="conseil-arch-save">Archiver l’année</button>' +
                '<button type="button" class="btn-secondary" id="conseil-arch-clear">Vider les saisies</button>' +
                '<button type="button" class="btn-secondary" id="conseil-arch-close">Fermer</button>' +
                '</div>' +
                (list.length
                    ? '<div class="conseil-eleve-list">' + list.map(function (a) {
                        return '<div class="conseil-eleve-card"><strong>' + esc(a.label || a.annee || 'Archive') + '</strong>' +
                            '<p class="conseil-sanction-meta">' + esc(a.annee || '') +
                            (a.savedAt ? ' · ' + esc(formatDateTime(a.savedAt)) : '') + '</p>' +
                            '<div class="conseil-sanction-actions">' +
                            '<button type="button" class="btn-secondary" data-restore="' + esc(a.id) + '">Restaurer</button>' +
                            '<button type="button" class="btn-secondary" data-adel="' + esc(a.id) + '">Supprimer</button>' +
                            '</div></div>';
                    }).join('') + '</div>'
                    : '<p class="conseil-hint">Aucune archive pour l’instant.</p>') +
                '</div>';
            modal.querySelector('#conseil-arch-close').addEventListener('click', function () { closeOverlay(); });
            modal.querySelector('#conseil-arch-save').addEventListener('click', function () {
                var label = prompt('Libellé de l’archive', annee());
                if (label === null) return;
                var cur = classData(view.classe);
                cur.archives = cur.archives || [];
                cur.archives.unshift({
                    id: uid(),
                    annee: annee(),
                    savedAt: new Date().toISOString(),
                    label: String(label || annee()).trim(),
                    snapshot: JSON.parse(JSON.stringify({
                        matieres: cur.matieres,
                        profs: cur.profs,
                        periodes: cur.periodes,
                        conseilAt: cur.conseilAt
                    }))
                });
                planifierSync();
                draw();
            });
            modal.querySelector('#conseil-arch-clear').addEventListener('click', function () {
                if (!confirm('Vider les saisies (moyennes, appréciations, sanctions, retours) ? Les matières, professeurs et la date du conseil sont conservés.')) return;
                classData(view.classe).periodes = {};
                rangsCache = null;
                planifierSync();
                closeOverlay();
                paintBody(container);
            });
            modal.querySelectorAll('[data-restore]').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    var id = btn.getAttribute('data-restore');
                    var arch = (classData(view.classe).archives || []).filter(function (a) { return a.id === id; })[0];
                    if (!arch || !arch.snapshot) return;
                    if (!confirm('Remplacer les données actuelles par l’archive « ' + (arch.label || '') + ' » ?')) return;
                    var cur = classData(view.classe);
                    var snap = JSON.parse(JSON.stringify(arch.snapshot));
                    cur.matieres = snap.matieres || cur.matieres;
                    cur.profs = snap.profs || [];
                    cur.periodes = snap.periodes || {};
                    if (typeof snap.conseilAt === 'string') cur.conseilAt = snap.conseilAt;
                    rangsCache = null;
                    planifierSync();
                    closeOverlay();
                    paint(container);
                });
            });
            modal.querySelectorAll('[data-adel]').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    var id = btn.getAttribute('data-adel');
                    if (!confirm('Supprimer cette archive ?')) return;
                    var cur = classData(view.classe);
                    cur.archives = (cur.archives || []).filter(function (a) { return a.id !== id; });
                    planifierSync();
                    draw();
                });
            });
        }
        draw();
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
        var w = doc.internal.pageSize.getWidth();
        doc.setFillColor(30, 64, 175);
        doc.rect(0, 0, w, 28, 'F');
        doc.setFillColor(251, 191, 36);
        doc.rect(0, 28, w, 3, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('eProf  ·  Conseil de classe', 12, 12);
        doc.setFontSize(11);
        var titreLines = doc.splitTextToSize(titre, w - 24);
        doc.text(titreLines[0] || '', 12, 20);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(sousTitre, 12, 26);
        doc.setTextColor(15, 23, 42);
    }

    function pdfContentWidth(doc) {
        return doc.internal.pageSize.getWidth() - 24;
    }

    function pdfEnsure(doc, y, need) {
        var limit = doc.internal.pageSize.getHeight() - 16;
        if (y + (need || 16) > limit) {
            doc.addPage();
            return 18;
        }
        return y;
    }

    function stampPdfFooter(doc, text) {
        var n = doc.getNumberOfPages();
        var i;
        for (i = 1; i <= n; i++) {
            doc.setPage(i);
            var w = doc.internal.pageSize.getWidth();
            var h = doc.internal.pageSize.getHeight();
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            doc.text(text, 12, h - 8);
            doc.text(String(i) + ' / ' + n, w - 12, h - 8, { align: 'right' });
        }
        doc.setTextColor(15, 23, 42);
    }

    function pdfDateLine() {
        var at = classData(view.classe).conseilAt;
        return at ? 'Conseil le ' + formatDateTime(at) : '';
    }

    function exportPdfClasse() {
        var JsPDF = jsPdf();
        if (!JsPDF) { alert('jsPDF n’est pas chargé.'); return; }
        var doc = new JsPDF({ unit: 'mm', format: 'a4' });
        var s = statsClasse(view.classe, view.periode);
        var list = eleves(view.classe);
        var p = periodeData(view.classe, view.periode);
        var cw = pdfContentWidth(doc);
        var dateLine = pdfDateLine();
        drawPdfHeader(doc, view.classe + '  ·  ' + periodeLabel(),
            annee() + '  ·  professeur principal' + (dateLine ? '  ·  ' + dateLine : ''));
        var y = 40;
        doc.setFontSize(10);
        var statsLine = doc.splitTextToSize(
            'Effectif ' + s.effectif + '   ·   Moyenne de classe ' + fmtMoy(s.generale) +
            '   ·   ' + s.nbSanctions + ' sanction(s)   ·   ' + s.avecApp + ' appréciation(s)',
            cw
        );
        doc.text(statsLine, 12, y);
        y += statsLine.length * 5 + 3;
        if (p.appreciationClasse) {
            y = pdfEnsure(doc, y, 16);
            doc.setFont('helvetica', 'bold');
            doc.text('Appréciation de classe', 12, y);
            y += 6;
            doc.setFont('helvetica', 'normal');
            var lines = doc.splitTextToSize(p.appreciationClasse, cw);
            var i;
            for (i = 0; i < lines.length; i++) {
                y = pdfEnsure(doc, y, 6);
                doc.text(lines[i], 12, y);
                y += 5;
            }
            y += 4;
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
                var titre = (profLabel(r) || r.identifiant || 'Enseignant') +
                    (r.matieresLabel ? '  ·  ' + r.matieresLabel : '');
                y = pdfEnsure(doc, y, 12);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(9);
                doc.text(doc.splitTextToSize(titre, cw), 12, y);
                y += 5;
                doc.setFont('helvetica', 'normal');
                var rl = doc.splitTextToSize(r.texte.trim(), cw);
                var ri;
                for (ri = 0; ri < rl.length; ri++) {
                    y = pdfEnsure(doc, y, 6);
                    doc.text(rl[ri], 12, y);
                    y += 4.5;
                }
                y += 4;
            });
        }
        if (doc.autoTable) {
            var persPdf = periodesReelles(view.classe);
            var head = isAnnee(view.periode)
                ? [['Élève'].concat(persPdf.map(function (per) { return per.label; })).concat(['Année', 'Sanctions', 'Info', 'Appréciation'])]
                : [['Élève', 'Moyenne', 'Rang', 'Sanctions', 'Info', 'Appréciation']];
            var rangs = rangsMap(view.classe, view.periode);
            doc.autoTable({
                startY: y,
                margin: { left: 12, right: 12, bottom: 16 },
                head: head,
                body: list.map(function (e) {
                    var app = appreciationEleve(view.classe, view.periode, e.nomComplet) || '';
                    var info = infoPpEleve(e.nomComplet).dispositifs.join(', ') || '—';
                    var rg = rangs[e.nomComplet];
                    var rangTxt = rg ? (rg.rang + ' / ' + rg.n) : '—';
                    if (isAnnee(view.periode)) {
                        return [e.nomComplet]
                            .concat(persPdf.map(function (per) {
                                return fmtMoy(moyenneEleve(view.classe, per.id, e.nomComplet));
                            }))
                            .concat([
                                fmtMoy(moyenneEleve(view.classe, AN_ID, e.nomComplet)),
                                String(sanctionsEleve(view.classe, view.periode, e.nomComplet).length),
                                info,
                                app
                            ]);
                    }
                    return [
                        e.nomComplet,
                        fmtMoy(moyenneEleve(view.classe, view.periode, e.nomComplet)),
                        rangTxt,
                        String(sanctionsEleve(view.classe, view.periode, e.nomComplet).length),
                        info,
                        app
                    ];
                }),
                styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak', valign: 'top' },
                headStyles: { fillColor: [30, 64, 175] },
                columnStyles: isAnnee(view.periode)
                    ? { 0: { cellWidth: 32 } }
                    : { 0: { cellWidth: 36 }, 5: { cellWidth: 70 } }
            });
        }
        stampPdfFooter(doc, 'Document professeur principal — ne remplace pas le carnet de notes.');
        doc.save('Conseil_' + view.classe.replace(/\s+/g, '_') + '_' + view.periode + '.pdf');
    }

    function drawElevePage(doc, nomComplet) {
        var mats = classData(view.classe).matieres || [];
        var cw = pdfContentWidth(doc);
        var dateLine = pdfDateLine();
        drawPdfHeader(doc, nomComplet, view.classe + '  ·  ' + periodeLabel() + '  ·  ' + annee() +
            (dateLine ? '  ·  ' + dateLine : ''));
        var y = 40;
        var rang = fmtRang(nomComplet);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('Moyenne coefficientée : ' + fmtMoy(moyenneEleve(view.classe, view.periode, nomComplet)) +
            ' / 20    ·    Rang ' + rang, 12, y);
        y += 8;
        if (doc.autoTable) {
            doc.autoTable({
                startY: y,
                margin: { left: 12, right: 12, bottom: 16 },
                head: [['Matière', 'Coef.', 'Moyenne']],
                body: mats.map(function (m) {
                    var v = noteMatiere(view.classe, view.periode, nomComplet, m.id);
                    return [m.nom, String(m.coef), v == null ? '—' : fmtMoy(v)];
                }),
                styles: { fontSize: 9, overflow: 'linebreak' },
                headStyles: { fillColor: [30, 64, 175] }
            });
            y = doc.lastAutoTable.finalY + 10;
        }
        var pers = periodesReelles(view.classe);
        y = pdfEnsure(doc, y, 16);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('Évolution sur l’année', 12, y);
        y += 6;
        doc.setFont('helvetica', 'normal');
        var evo = pers.map(function (per) {
            return per.label + ' : ' + fmtMoy(moyenneEleve(view.classe, per.id, nomComplet));
        }).join('     ') + '     Année : ' + fmtMoy(moyenneEleve(view.classe, AN_ID, nomComplet));
        var evoLines = doc.splitTextToSize(evo, cw);
        doc.text(evoLines, 12, y);
        y += evoLines.length * 5 + 6;
        var sanc = sanctionsEleve(view.classe, view.periode, nomComplet);
        y = pdfEnsure(doc, y, 12);
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
                if (s.motif) line += ' · ' + s.motif;
                var wrapped = doc.splitTextToSize(line, cw);
                var wi;
                for (wi = 0; wi < wrapped.length; wi++) {
                    y = pdfEnsure(doc, y, 6);
                    doc.text(wrapped[wi], 12, y);
                    y += 4.5;
                }
                y += 2;
                if (s.objectifs && s.objectifs.length) {
                    s.objectifs.forEach(function (o) {
                        var ow = doc.splitTextToSize('• ' + o, cw - 6);
                        var oi;
                        for (oi = 0; oi < ow.length; oi++) {
                            y = pdfEnsure(doc, y, 6);
                            doc.text(ow[oi], 16, y);
                            y += 4.5;
                        }
                    });
                }
            });
        }
        y += 4;
        var infoPdf = infoPpEleve(nomComplet);
        y = pdfEnsure(doc, y, 16);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('Information', 12, y);
        y += 6;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text('Dispositifs : ' + (infoPdf.dispositifs.length ? infoPdf.dispositifs.join(', ') : 'aucun'), 12, y);
        y += 6;
        if (infoPdf.infosPerso.length) {
            infoPdf.infosPerso.slice().sort(function (a, b) {
                return String(b.date || '').localeCompare(String(a.date || ''));
            }).forEach(function (n) {
                var line = (n.date ? formatDate(n.date) + ' — ' : '') + (n.texte || '');
                var wrapped = doc.splitTextToSize(line, cw);
                var ii;
                for (ii = 0; ii < wrapped.length; ii++) {
                    y = pdfEnsure(doc, y, 6);
                    doc.text(wrapped[ii], 12, y);
                    y += 4.5;
                }
                y += 2;
            });
        } else {
            y = pdfEnsure(doc, y, 8);
            doc.text('Aucune information personnelle.', 12, y);
            y += 6;
        }
        y += 4;
        y = pdfEnsure(doc, y, 16);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('Appréciation générale', 12, y);
        y += 6;
        doc.setFont('helvetica', 'normal');
        var app = appreciationEleve(view.classe, view.periode, nomComplet) || '—';
        var al = doc.splitTextToSize(app, cw);
        var ai;
        for (ai = 0; ai < al.length; ai++) {
            y = pdfEnsure(doc, y, 6);
            doc.text(al[ai], 12, y);
            y += 5;
        }
    }

    function exportPdfEleve(nomComplet) {
        var JsPDF = jsPdf();
        if (!JsPDF) { alert('jsPDF n’est pas chargé.'); return; }
        var doc = new JsPDF({ unit: 'mm', format: 'a4' });
        drawElevePage(doc, nomComplet);
        stampPdfFooter(doc, 'Fiche conseil de classe — professeur principal');
        doc.save('Conseil_' + nomComplet.replace(/\s+/g, '_') + '_' + view.periode + '.pdf');
    }

    function exportPdfSeance() {
        var JsPDF = jsPdf();
        if (!JsPDF) { alert('jsPDF n’est pas chargé.'); return; }
        var list = eleves(view.classe);
        if (!list.length) { alert('Aucun élève dans cette classe.'); return; }
        var doc = new JsPDF({ unit: 'mm', format: 'a4' });
        list.forEach(function (e, i) {
            if (i) doc.addPage();
            drawElevePage(doc, e.nomComplet);
        });
        stampPdfFooter(doc, 'Séance conseil de classe — ' + view.classe + ' — ' + periodeLabel());
        doc.save('Conseil_seance_' + view.classe.replace(/\s+/g, '_') + '_' + view.periode + '.pdf');
    }

    function exportPdfMoyennes() {
        var JsPDF = jsPdf();
        if (!JsPDF) { alert('jsPDF n’est pas chargé.'); return; }
        var doc = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
        var mats = classData(view.classe).matieres || [];
        var list = eleves(view.classe);
        var dateLine = pdfDateLine();
        drawPdfHeader(doc, view.classe + '  ·  ' + periodeLabel() + '  ·  Moyennes',
            annee() + (dateLine ? '  ·  ' + dateLine : ''));
        var rangs = rangsMap(view.classe, view.periode);
        if (doc.autoTable) {
            var head;
            var body;
            if (isAnnee(view.periode)) {
                var pers = periodesReelles(view.classe);
                head = [['Élève'].concat(pers.map(function (p) { return p.label; })).concat(['Année', 'Rang'])];
                body = list.map(function (e) {
                    var rg = rangs[e.nomComplet];
                    return [e.nomComplet]
                        .concat(pers.map(function (per) {
                            return fmtMoy(moyenneEleve(view.classe, per.id, e.nomComplet));
                        }))
                        .concat([
                            fmtMoy(moyenneEleve(view.classe, AN_ID, e.nomComplet)),
                            rg ? (rg.rang + ' / ' + rg.n) : '—'
                        ]);
                });
            } else {
                head = [['Élève'].concat(mats.map(function (m) { return m.nom; })).concat(['Moy.', 'Rang'])];
                body = list.map(function (e) {
                    var rg = rangs[e.nomComplet];
                    return [e.nomComplet]
                        .concat(mats.map(function (m) {
                            var v = noteMatiere(view.classe, view.periode, e.nomComplet, m.id);
                            return v == null ? '—' : fmtMoy(v);
                        }))
                        .concat([
                            fmtMoy(moyenneEleve(view.classe, view.periode, e.nomComplet)),
                            rg ? (rg.rang + ' / ' + rg.n) : '—'
                        ]);
                });
            }
            doc.autoTable({
                startY: 38,
                margin: { left: 12, right: 12, bottom: 16 },
                head: head,
                body: body,
                styles: { fontSize: 8, cellPadding: 1.6, overflow: 'linebreak', halign: 'center' },
                columnStyles: { 0: { halign: 'left', cellWidth: 42 } },
                headStyles: { fillColor: [30, 64, 175] }
            });
        }
        stampPdfFooter(doc, 'Grille des moyennes — professeur principal');
        doc.save('Conseil_moyennes_' + view.classe.replace(/\s+/g, '_') + '_' + view.periode + '.pdf');
    }

    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        var el = document.getElementById('conseil-modale');
        if (el && el.classList.contains('is-open')) closeOverlay();
    });

    function hydraterPuisNotifier() {
        return hydrater().then(function () {
            if (global.EprofAppHooks && typeof global.EprofAppHooks.updateNotifications === 'function') {
                global.EprofAppHooks.updateNotifications();
            }
        });
    }

    global.EprofConseilClasse = {
        render: render,
        hydrate: hydraterPuisNotifier,
        nbAlertes: nbAlertes,
        isAvailable: function () { return ppClasses().length > 0; }
    };
})(window);
