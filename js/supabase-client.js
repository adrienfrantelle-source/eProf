// ===== CLIENT SUPABASE (mode en ligne) =====
// Charge la config publique (URL + clé anonyme) depuis /api/config, puis initialise
// le client supabase-js (chargé via CDN dans index.html avant ce script).
// Expose window.eprofSupabaseReady (Promise<SupabaseClient|null>) pour que les
// autres scripts puissent attendre le client avant de l'utiliser.

(function () {
    async function loadConfig() {
        // 1) Config injectée localement pour le dev hors Vercel (fichier non versionné)
        if (window.__EPROF_LOCAL_CONFIG__) {
            return window.__EPROF_LOCAL_CONFIG__;
        }
        // 2) Config servie par la fonction Vercel /api/config (production / vercel dev)
        try {
            const response = await fetch('/api/config', { cache: 'no-store' });
            if (!response.ok) throw new Error('Réponse /api/config invalide');
            return await response.json();
        } catch (error) {
            console.warn('⚠️ Impossible de charger la configuration Supabase (/api/config).', error);
            return null;
        }
    }

    async function initSupabase() {
        const config = await loadConfig();

        if (!config || !config.supabaseUrl || !config.supabaseAnonKey) {
            console.warn('⚠️ eProf fonctionne en mode local uniquement (Supabase non configuré).');
            return null;
        }

        if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
            console.error('❌ La librairie supabase-js n\'est pas chargée. Vérifiez le script CDN dans index.html.');
            return null;
        }

        const client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        });

        window.eprofSupabaseClient = client;
        console.log('✓ Client Supabase initialisé (mode en ligne actif)');
        return client;
    }

    window.eprofSupabaseReady = initSupabase();

    // Petit helper d'attente pour les autres modules
    window.getSupabaseClient = function () {
        return window.eprofSupabaseReady;
    };

    // ===== Helpers d'authentification enseignant =====
    window.eprofAuth = {
        async signIn(email, password) {
            const client = await window.getSupabaseClient();
            if (!client) throw new Error('Supabase non configuré.');
            return client.auth.signInWithPassword({ email, password });
        },
        async signUp(email, password) {
            const client = await window.getSupabaseClient();
            if (!client) throw new Error('Supabase non configuré.');
            return client.auth.signUp({ email, password });
        },
        async isIdentifiantAvailable(identifiant) {
            const client = await window.getSupabaseClient();
            if (!client) throw new Error('Supabase non configuré.');
            const { data, error } = await client.rpc('is_identifiant_available', { p_identifiant: identifiant });
            if (error) throw error;
            return !!data;
        },
        async signOut() {
            const client = await window.getSupabaseClient();
            if (!client) return;
            return client.auth.signOut();
        },
        async getSession() {
            const client = await window.getSupabaseClient();
            if (!client) return null;
            const { data } = await client.auth.getSession();
            return data.session;
        },
        async onAuthStateChange(callback) {
            const client = await window.getSupabaseClient();
            if (!client) return;
            client.auth.onAuthStateChange(callback);
        }
    };
})();
