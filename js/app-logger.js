// ===== COLLECTE DES ERREURS APPLICATIVES =====
// Remonte les erreurs JavaScript vers la table app_logs pour la supervision.
// Ne remonte jamais de données pédagogiques : uniquement message, module, URL.

(function () {
    const MAX_PAR_SESSION = 20;
    const recent = new Set();
    let envoyes = 0;

    async function pushLog(level, module, message, details) {
        if (envoyes >= MAX_PAR_SESSION) return;
        // Une même erreur en boucle ne doit pas inonder la table
        const signature = level + '|' + module + '|' + message;
        if (recent.has(signature)) return;
        recent.add(signature);

        try {
            if (!window.EprofStore || !await window.EprofStore.isOnlineReady()) return;
            const session = await window.EprofStore.getSession();
            if (!session) return;

            envoyes++;
            await window.EprofStore.insert('app_logs', {
                level: level,
                module: module || 'inconnu',
                message: String(message).slice(0, 500),
                details: details || {},
                user_id: session.user.id,
                identifiant: session.user.email ? session.user.email.split('@')[0] : null,
                url: location.pathname,
                user_agent: navigator.userAgent.slice(0, 250)
            });
        } catch (e) {
            // La journalisation ne doit jamais casser l'application
        }
    }

    window.addEventListener('error', function (e) {
        const fichier = e.filename ? e.filename.split('/').pop() : 'inconnu';
        pushLog('error', fichier, e.message, { ligne: e.lineno, colonne: e.colno });
    });

    window.addEventListener('unhandledrejection', function (e) {
        const raison = e.reason && e.reason.message ? e.reason.message : String(e.reason);
        pushLog('error', 'promesse', raison, {});
    });

    window.EprofLogger = {
        error: function (module, message, details) { return pushLog('error', module, message, details); },
        warn: function (module, message, details) { return pushLog('warn', module, message, details); },
        info: function (module, message, details) { return pushLog('info', module, message, details); }
    };
})();
