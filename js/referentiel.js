// ===== RÉFÉRENTIEL PÉDAGOGIQUE DE L'ÉTABLISSEMENT =====
// Source de vérité partagée pour les classes, matières, périodes et modèles.
// Chargé une fois au démarrage, mis en cache localStorage pour rester utilisable
// hors ligne. Repli sur les listes codées en dur si la base est injoignable.

(function () {
    const CACHE_KEY = 'eprof-referentiel';

    let cache = null;

    function readCache() {
        try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch (e) { return null; }
    }

    function writeCache(data) {
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch (e) {}
    }

    async function load(force) {
        if (cache && !force) return cache;

        const local = readCache();
        if (local && !force) cache = local;

        try {
            if (window.EprofStore && await window.EprofStore.isOnlineReady()) {
                const [classes, matieres, modeles, eleves] = await Promise.all([
                    window.EprofStore.list('school_classes', { orderBy: 'ordre' }),
                    window.EprofStore.list('school_subjects', { orderBy: 'ordre' }),
                    window.EprofStore.list('evaluation_templates', { orderBy: 'nom' }),
                    window.EprofStore.list('school_students', { orderBy: 'nom' })
                ]);
                if (!classes.error && classes.data) {
                    cache = {
                        classes: classes.data.filter(function (c) { return c.actif; }),
                        matieres: (matieres.data || []).filter(function (m) { return m.actif; }),
                        modeles: (modeles.data || []).filter(function (m) { return m.actif; }),
                        eleves: eleves.error ? [] : (eleves.data || []),
                        maj: new Date().toISOString()
                    };
                    writeCache(cache);
                    // Les vues déjà rendues doivent se réactualiser sans rechargement.
                    document.dispatchEvent(new CustomEvent('eprof-referentiel-maj'));
                }
            }
        } catch (e) {
            console.warn('⚠️ Référentiel pédagogique : lecture en ligne impossible, cache utilisé.', e);
        }

        return cache || local;
    }

    function getClasses() {
        const data = cache || readCache();
        return data && data.classes ? data.classes.slice() : [];
    }

    function getClassNames() {
        return getClasses().map(function (c) { return c.nom; });
    }

    function findClass(nom) {
        if (!nom) return null;
        const cible = String(nom).trim().toLowerCase();
        return getClasses().find(function (c) { return c.nom.toLowerCase() === cible; }) || null;
    }

    // Le type de période vient du référentiel ; sinon on retombe sur la règle
    // historique (1ère et Terminale en semestres).
    function getPeriodType(nom) {
        const classe = findClass(nom);
        if (classe) return classe.periode_type;
        const lower = String(nom || '').toLowerCase();
        return (lower.includes('1ère') || lower.includes('1ere') || lower.includes('terminale') || lower.includes('tle'))
            ? 'semestre' : 'trimestre';
    }

    function getPeriodCount(nom) {
        const classe = findClass(nom);
        if (classe) return classe.nb_periodes;
        return getPeriodType(nom) === 'semestre' ? 2 : 3;
    }

    function getSubjectNames() {
        const data = cache || readCache();
        return data && data.matieres ? data.matieres.map(function (m) { return m.nom; }) : [];
    }

    function getEvaluationTemplates() {
        const data = cache || readCache();
        return data && data.modeles ? data.modeles.slice() : [];
    }

    // Listes d'élèves de l'année en cours, au format attendu par les modules
    // ({ "2nde LCQ": [{ nom, prenom, sexe }, ...] }).
    function getStudentLists() {
        const data = cache || readCache();
        const eleves = (data && data.eleves) || [];
        return eleves.reduce(function (acc, e) {
            (acc[e.classe] = acc[e.classe] || []).push({
                nom: e.nom,
                prenom: e.prenom,
                sexe: e.sexe || '',
                photo_path: e.photo_path || ''
            });
            return acc;
        }, {});
    }

    window.EprofReferentiel = {
        load,
        getClasses,
        getClassNames,
        findClass,
        getPeriodType,
        getPeriodCount,
        getSubjectNames,
        getEvaluationTemplates,
        getStudentLists
    };

    document.addEventListener('DOMContentLoaded', async function () {
        await (window.eprofSupabaseReady || Promise.resolve());
        load();
    });
})();
