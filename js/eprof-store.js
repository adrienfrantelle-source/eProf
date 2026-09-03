// ===== COUCHE D'ACCÈS AUX DONNÉES (Supabase + repli local) =====
// Socle commun réutilisé par tous les modules eProf. Chaque module garde son propre
// format localStorage (rétrocompatibilité hors-ligne) et appelle ces helpers
// génériques pour la synchronisation en ligne quand un enseignant est connecté.
//
// Règle : ce fichier ne connaît AUCUNE règle métier (pas de "carnet de notes",
// pas de "plan de classe"...). Il ne fait que parler à Supabase de façon générique.
// Les adaptateurs métier vivent dans chaque module (app.js, tableau-blanc.js...).

(function () {
    async function getClient() {
        if (!window.getSupabaseClient) return null;
        return window.getSupabaseClient();
    }

    async function getSession() {
        const client = await getClient();
        if (!client) return null;
        const { data, error } = await client.auth.getSession();
        if (error) {
            console.error('❌ EprofStore.getSession', error);
            return null;
        }
        return data.session || null;
    }

    async function getTeacherId() {
        const session = await getSession();
        return session ? session.user.id : null;
    }

    // true si Supabase est configuré ET qu'un enseignant est authentifié
    async function isOnlineReady() {
        const session = await getSession();
        return !!session;
    }

    function applyFilters(query, filters) {
        Object.entries(filters || {}).forEach(([column, value]) => {
            query = query.eq(column, value);
        });
        return query;
    }

    // ----- CRUD générique -----
    async function list(table, { filters = {}, orderBy = null, ascending = true } = {}) {
        const client = await getClient();
        if (!client) return { data: null, error: new Error('Supabase non disponible') };

        let query = client.from(table).select('*');
        query = applyFilters(query, filters);
        if (orderBy) query = query.order(orderBy, { ascending });

        const { data, error } = await query;
        if (error) console.error(`❌ EprofStore.list(${table})`, error);
        return { data, error };
    }

    async function insert(table, row) {
        const client = await getClient();
        if (!client) return { data: null, error: new Error('Supabase non disponible') };

        const { data, error } = await client.from(table).insert(row).select().single();
        if (error) console.error(`❌ EprofStore.insert(${table})`, error);
        return { data, error };
    }

    async function update(table, id, patch) {
        const client = await getClient();
        if (!client) return { data: null, error: new Error('Supabase non disponible') };

        const { data, error } = await client.from(table).update(patch).eq('id', id).select().single();
        if (error) console.error(`❌ EprofStore.update(${table})`, error);
        return { data, error };
    }

    async function upsert(table, rows, options = {}) {
        const client = await getClient();
        if (!client) return { data: null, error: new Error('Supabase non disponible') };

        const { data, error } = await client.from(table).upsert(rows, options).select();
        if (error) console.error(`❌ EprofStore.upsert(${table})`, error);
        return { data, error };
    }

    async function remove(table, id) {
        const client = await getClient();
        if (!client) return { error: new Error('Supabase non disponible') };

        const { error } = await client.from(table).delete().eq('id', id);
        if (error) console.error(`❌ EprofStore.remove(${table})`, error);
        return { error };
    }

    async function removeWhere(table, filters) {
        const client = await getClient();
        if (!client) return { error: new Error('Supabase non disponible') };

        let query = client.from(table).delete();
        query = applyFilters(query, filters);
        const { error } = await query;
        if (error) console.error(`❌ EprofStore.removeWhere(${table})`, error);
        return { error };
    }

    // Documents JSON par enseignant (carnet de notes, suivi…).
    // Un seul document par (teacher_id, doc_type) — chaque prof a ses propres données.
    async function getTeacherDocument(docType) {
        const teacherId = await getTeacherId();
        if (!teacherId) return { data: null, error: new Error('Non connecté') };
        const result = await list('teacher_documents', {
            filters: { teacher_id: teacherId, doc_type: docType }
        });
        if (result.error) return result;
        return { data: result.data && result.data[0] ? result.data[0] : null, error: null };
    }

    async function saveTeacherDocument(docType, payload) {
        const teacherId = await getTeacherId();
        if (!teacherId) return { data: null, error: new Error('Non connecté') };
        return upsert('teacher_documents', [{
            teacher_id: teacherId,
            doc_type: docType,
            data: payload
        }], { onConflict: 'teacher_id,doc_type' });
    }

    async function uploadFile(bucket, path, file, options) {
        const client = await getClient();
        if (!client) return { data: null, error: new Error('Supabase non disponible') };
        const { data, error } = await client.storage.from(bucket).upload(path, file, options || {});
        if (error) console.error('❌ EprofStore.uploadFile', error);
        return { data, error };
    }

    async function removeFile(bucket, path) {
        const client = await getClient();
        if (!client) return { error: new Error('Supabase non disponible') };
        const { error } = await client.storage.from(bucket).remove([path]);
        if (error) console.error('❌ EprofStore.removeFile', error);
        return { error };
    }

    async function createSignedUrl(bucket, path, expiresIn) {
        const client = await getClient();
        if (!client) return { data: null, error: new Error('Supabase non disponible') };
        const { data, error } = await client.storage.from(bucket).createSignedUrl(path, expiresIn || 3600);
        if (error) console.error('❌ EprofStore.createSignedUrl', error);
        return { data, error };
    }

    async function createSignedUrls(bucket, paths, expiresIn) {
        const client = await getClient();
        if (!client) return { data: null, error: new Error('Supabase non disponible') };
        const list = (paths || []).filter(Boolean);
        if (!list.length) return { data: [], error: null };
        const { data, error } = await client.storage.from(bucket).createSignedUrls(list, expiresIn || 3600);
        if (error) console.error('❌ EprofStore.createSignedUrls', error);
        return { data, error };
    }

    window.EprofStore = {
        getClient,
        getSession,
        getTeacherId,
        isOnlineReady,
        list,
        insert,
        update,
        upsert,
        remove,
        removeWhere,
        getTeacherDocument,
        saveTeacherDocument,
        uploadFile,
        removeFile,
        createSignedUrl,
        createSignedUrls
    };
})();
