/* Helpers partagés : listes, photos, consentements, plans liés par nom de classe. */
(function (global) {
    var CONSENT_CACHE = null;
    var CONSENT_LOADING = null;

    function fold(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/['’]/g, '')
            .replace(/--/g, '-')
            .replace(/\s+/g, ' ')
            .trim()
            .toUpperCase();
    }

    function normClasse(nom) {
        return fold(nom).replace(/[^A-Z0-9]+/g, ' ').trim();
    }

    function classesMatch(a, b) {
        if (!a || !b) return false;
        return normClasse(a) === normClasse(b);
    }

    function resolveTaughtClass(nom) {
        if (!nom) return '';
        var names = getVisibleTeacherClasses();
        var hit = names.find(function (n) { return classesMatch(n, nom); });
        return hit || '';
    }

    function searchStudents(query, limit) {
        var q = fold(query);
        if (q.length < 2) return [];
        var listes = getListsForTeacher();
        var out = [];
        Object.keys(listes).sort().forEach(function (classe) {
            (listes[classe] || []).forEach(function (e) {
                var hay = fold((e.prenom || '') + ' ' + (e.nom || '') + ' ' + classe);
                if (hay.indexOf(q) === -1) return;
                out.push({
                    classe: classe,
                    nom: e.nom,
                    prenom: e.prenom,
                    sexe: e.sexe,
                    photo_path: e.photo_path || '',
                    nomComplet: ((e.prenom || '') + ' ' + String(e.nom || '').toUpperCase()).trim()
                });
            });
        });
        out.sort(function (a, b) {
            return (a.nom + ' ' + a.prenom).localeCompare(b.nom + ' ' + b.prenom, 'fr');
        });
        return out.slice(0, limit || 12);
    }

    function makePersonKey(nom, prenom) {
        return fold(nom) + '|' + fold(prenom);
    }

    function parseEleveLabel(label) {
        var raw = String(label || '').replace(/\s*\(([FMfm])\)\s*$/, '').trim();
        var sexeMatch = String(label || '').match(/\(([FMfm])\)\s*$/);
        var parts = raw.split(/\s+/);
        var prenom = parts.shift() || '';
        var nom = parts.join(' ');
        return { prenom: prenom, nom: nom, sexe: sexeMatch ? sexeMatch[1].toUpperCase() : '' };
    }

    function getAnneeScolaire() {
        try {
            var p = JSON.parse(localStorage.getItem('parametres') || '{}');
            return p.anneeScolaire || '2026-2027';
        } catch (e) {
            return '2026-2027';
        }
    }

    function getAlertesSeuils() {
        try {
            var a = (JSON.parse(localStorage.getItem('parametres') || '{}').alertes) || {};
            var oublis = parseInt(a.seuilOublis, 10);
            var mots = parseInt(a.seuilMots, 10);
            return {
                seuilOublis: oublis > 0 ? oublis : 3,
                seuilMots: mots > 0 ? mots : 5
            };
        } catch (e) {
            return { seuilOublis: 3, seuilMots: 5 };
        }
    }

    function getVisibleTeacherClasses() {
        if (global.getTeacherClassNames) return global.getTeacherClassNames().slice().sort();
        if (global.teacherManager && global.teacherManager.getTeacherClasses) {
            return (global.teacherManager.getTeacherClasses() || []).slice().sort();
        }
        return [];
    }

    function lookupListKey(listes, classe) {
        if (!classe || !listes) return '';
        if (listes[classe] && listes[classe].length) return classe;
        var keys = Object.keys(listes);
        var hit = keys.find(function (k) { return classesMatch(k, classe) && listes[k] && listes[k].length; });
        if (hit) return hit;
        if (Object.prototype.hasOwnProperty.call(listes, classe)) return classe;
        return keys.find(function (k) { return classesMatch(k, classe); }) || '';
    }

    function studentsForClass(classe) {
        if (!classe) return [];
        var listes = global.getAvailableStudentLists ? global.getAvailableStudentLists() : {};
        var key = lookupListKey(listes, classe);
        if (key && listes[key] && listes[key].length) return listes[key];
        var taught = getListsForTeacher();
        key = lookupListKey(taught, classe);
        return (key && taught[key]) ? taught[key] : [];
    }

    function getListsForTeacher() {
        if (global.getTeacherStudentLists) return global.getTeacherStudentLists();
        var listes = global.getAvailableStudentLists ? global.getAvailableStudentLists() : {};
        var out = {};
        getVisibleTeacherClasses().forEach(function (nom) {
            var key = lookupListKey(listes, nom);
            out[nom] = key ? (listes[key] || []) : [];
        });
        return out;
    }

    function getPpClasses() {
        if (global.teacherManager && typeof global.teacherManager.getPpClasses === 'function') {
            return (global.teacherManager.getPpClasses() || []).slice();
        }
        return [];
    }

    function isPpClass(classe) {
        if (!classe) return false;
        return getPpClasses().some(function (n) { return classesMatch(n, classe); });
    }

    function isProfPrincipal() {
        return getPpClasses().length > 0;
    }

    function ppBadgeHtml(classe) {
        return isPpClass(classe)
            ? ' <span class="pp-badge" title="Professeur principal de cette classe">PP</span>'
            : '';
    }

    function classeBtnHtml(classe, count) {
        var color = global.getClassColor ? global.getClassColor(classe) : 'var(--eprof-accent, #2563eb)';
        var extra = typeof count === 'number' ? ' <small>(' + count + ')</small>' : '';
        return '<button class="classe-btn" data-classe="' + classe + '" style="background:' + color + ';">📚 ' + classe + ppBadgeHtml(classe) + extra + '</button>';
    }

    function emptyTeacherClassesHtml() {
        return '<div class="selection-classe-suivi empty-state-box">' +
            '<h3>Aucune classe sélectionnée</h3>' +
            '<p>Choisissez vos classes dans la configuration enseignant (première connexion ou Paramètres) pour les voir ici.</p>' +
            '</div>';
    }

    function consentLooksLikePhoto(finalite) {
        var f = fold(finalite);
        return f.indexOf('PHOTO') !== -1 || f.indexOf('TROMBI') !== -1 || f.indexOf('IMAGE') !== -1;
    }

    function personRefMatches(ref, nom, prenom) {
        var r = fold(ref);
        var a = fold(prenom + ' ' + nom);
        var b = fold(nom + ' ' + prenom);
        return r === a || r === b || (r.indexOf(fold(nom)) !== -1 && r.indexOf(fold(prenom)) !== -1);
    }

    function photoConsentDenied(eleve, classe) {
        var rows = CONSENT_CACHE;
        if (!rows || !rows.length) return false;
        var nom = eleve && eleve.nom;
        var prenom = eleve && eleve.prenom;
        var denied = false;
        var granted = false;
        rows.forEach(function (row) {
            if (row.personne_type && row.personne_type !== 'eleve') return;
            if (!consentLooksLikePhoto(row.finalite)) return;
            if (!personRefMatches(row.personne_ref, nom, prenom)) return;
            if (row.classe && classe && !classesMatch(row.classe, classe)) return;
            if (row.consenti) granted = true;
            else denied = true;
        });
        return denied && !granted;
    }

    async function loadPhotoConsents(force) {
        if (CONSENT_CACHE && !force) return CONSENT_CACHE;
        if (CONSENT_LOADING && !force) return CONSENT_LOADING;
        CONSENT_LOADING = (async function () {
            try {
                if (!global.EprofStore || !(await global.EprofStore.isOnlineReady())) {
                    CONSENT_CACHE = CONSENT_CACHE || [];
                    return CONSENT_CACHE;
                }
                var res = await global.EprofStore.list('gdpr_consents', { orderBy: 'personne_ref' });
                CONSENT_CACHE = res.error ? [] : (res.data || []);
            } catch (e) {
                CONSENT_CACHE = CONSENT_CACHE || [];
            }
            return CONSENT_CACHE;
        })();
        var data = await CONSENT_LOADING;
        CONSENT_LOADING = null;
        return data;
    }

    function localPhotoSrc(classe, eleve) {
        if (global.EprofTrombiPhotos && global.EprofTrombiPhotos.lookup) {
            return global.EprofTrombiPhotos.lookup(classe, eleve.nom, eleve.prenom);
        }
        return null;
    }

    function photoHtml(classe, eleve, options) {
        options = options || {};
        if (photoConsentDenied(eleve, classe)) {
            return '<div class="trombi-photo trombi-photo-blocked" title="Photo masquée (consentement retiré)">🚫</div>';
        }
        var src = eleve.photoUrl || localPhotoSrc(classe, eleve);
        if (src) {
            var alt = ((eleve.prenom || '') + ' ' + (eleve.nom || '')).trim();
            var extraClass = options.compact ? ' trombi-photo-compact' : '';
            return '<div class="trombi-photo trombi-photo-img' + extraClass + '"><img src="' + src + '" alt="' + alt + '" onerror="this.parentNode.classList.remove(\'trombi-photo-img\'); this.parentNode.textContent=\'🧑\';"></div>';
        }
        var emoji = eleve.sexe === 'F' ? '👧' : (eleve.sexe === 'M' ? '👦' : '🧑');
        return '<div class="trombi-photo">' + emoji + '</div>';
    }

    async function resolvePhotoUrls(eleves, classe) {
        await loadPhotoConsents();
        var list = (eleves || []).map(function (e) { return Object.assign({}, e); });
        var paths = list.map(function (e) { return e.photo_path; }).filter(Boolean);
        if (paths.length && global.EprofStore && typeof global.EprofStore.createSignedUrls === 'function') {
            try {
                if (await global.EprofStore.isOnlineReady()) {
                    var res = await global.EprofStore.createSignedUrls('student-photos', paths, 3600);
                    if (!res.error && res.data) {
                        var map = {};
                        res.data.forEach(function (item) {
                            if (item && item.path && item.signedUrl && !item.error) map[item.path] = item.signedUrl;
                        });
                        list.forEach(function (e) {
                            if (e.photo_path && map[e.photo_path]) e.photoUrl = map[e.photo_path];
                        });
                    }
                }
            } catch (err) { /* hors ligne */ }
        }
        if (classe) {
            list.forEach(function (e) { e._photoDenied = photoConsentDenied(e, classe); });
        }
        return list;
    }

    function getLinkedPlansStorageKey() {
        if (global.teacherManager && global.teacherManager.getStorageKey) {
            return global.teacherManager.getStorageKey('linkedClassPlans');
        }
        return 'eprof-linked-class-plans';
    }

    function loadLinkedClassPlans() {
        try {
            var raw = JSON.parse(localStorage.getItem(getLinkedPlansStorageKey()) || '[]');
            return Array.isArray(raw) ? raw : [];
        } catch (e) {
            return [];
        }
    }

    function writeLinkedClassPlans(list) {
        try {
            localStorage.setItem(getLinkedPlansStorageKey(), JSON.stringify((list || []).slice(0, 40)));
        } catch (e) { /* quota */ }
    }

    function rememberLinkedClassPlan(plan, name) {
        if (!plan) return null;
        var list = loadLinkedClassPlans();
        var id = plan.localId || ('plan-' + Date.now());
        plan.localId = id;
        var entry = {
            localId: id,
            cloudId: plan.cloudId || null,
            name: name || plan.nomPlan || 'Plan de classe',
            classeLiee: plan.classeLiee || '',
            date: plan.date || new Date().toISOString(),
            plan: plan
        };
        var idx = list.findIndex(function (p) { return p.localId === id; });
        if (idx >= 0) list[idx] = entry;
        else list.unshift(entry);
        writeLinkedClassPlans(list);
        return entry;
    }

    function getPlansForClasse(classe) {
        if (!classe) return [];
        return loadLinkedClassPlans()
            .filter(function (p) { return classesMatch(p.classeLiee, classe) && p.plan; })
            .sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
    }

    function planClasseLieeOptionsHtml(selected) {
        var noms = getVisibleTeacherClasses();
        var sel = selected || '';
        if (!noms.length) return '<option value="">— Aucune classe enseignée —</option>';
        return '<option value="">— Aucune classe —</option>' + noms.map(function (n) {
            var on = classesMatch(n, sel) ? ' selected' : '';
            return '<option value="' + n + '"' + on + '>' + n + '</option>';
        }).join('');
    }

    function setPlanClasseLieeSelect(container, classe) {
        var sel = container.querySelector('#plan-classe-liee');
        if (!sel) return;
        var match = Array.prototype.find.call(sel.options, function (o) { return classesMatch(o.value, classe); });
        if (classe && !match) {
            var opt = document.createElement('option');
            opt.value = classe;
            opt.textContent = classe;
            sel.appendChild(opt);
            sel.value = classe;
            return;
        }
        sel.value = match ? match.value : (classe || '');
    }

    function mergeCloudPlansIntoLocal(rows) {
        (rows || []).forEach(function (row) {
            var plan = Object.assign({}, row.data || {});
            if (!plan.classeLiee && row.name) {
                var guessed = getVisibleTeacherClasses().find(function (n) {
                    return fold(row.name).indexOf(normClasse(n).replace(/ /g, '')) !== -1;
                });
                if (guessed) plan.classeLiee = guessed;
            }
            if (!plan.classeLiee) return;
            plan.cloudId = row.id;
            plan.nomPlan = row.name || plan.nomPlan;
            plan.localId = plan.localId || ('cloud-' + row.id);
            plan.date = row.updated_at || plan.date || new Date().toISOString();
            rememberLinkedClassPlan(plan, row.name);
        });
    }

    function openTool(tool, extra) {
        if (typeof global.EprofElevesOpenTool === 'function') {
            global.EprofElevesOpenTool(tool, extra);
        }
    }

    global.EprofEleves = {
        fold: fold,
        normClasse: normClasse,
        classesMatch: classesMatch,
        makePersonKey: makePersonKey,
        parseEleveLabel: parseEleveLabel,
        getAnneeScolaire: getAnneeScolaire,
        getAlertesSeuils: getAlertesSeuils,
        getVisibleTeacherClasses: getVisibleTeacherClasses,
        getListsForTeacher: getListsForTeacher,
        studentsForClass: studentsForClass,
        getPpClasses: getPpClasses,
        isPpClass: isPpClass,
        isProfPrincipal: isProfPrincipal,
        ppBadgeHtml: ppBadgeHtml,
        classeBtnHtml: classeBtnHtml,
        emptyTeacherClassesHtml: emptyTeacherClassesHtml,
        photoHtml: photoHtml,
        resolvePhotoUrls: resolvePhotoUrls,
        photoConsentDenied: photoConsentDenied,
        loadPhotoConsents: loadPhotoConsents,
        rememberLinkedClassPlan: rememberLinkedClassPlan,
        getPlansForClasse: getPlansForClasse,
        planClasseLieeOptionsHtml: planClasseLieeOptionsHtml,
        setPlanClasseLieeSelect: setPlanClasseLieeSelect,
        mergeCloudPlansIntoLocal: mergeCloudPlansIntoLocal,
        loadLinkedClassPlans: loadLinkedClassPlans,
        resolveTaughtClass: resolveTaughtClass,
        searchStudents: searchStudents,
        openTool: openTool
    };
})(window);
