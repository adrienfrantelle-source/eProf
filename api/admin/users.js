// Vercel serverless function : gestion des comptes enseignants (réservée à l'admin).
// Utilise SUPABASE_SERVICE_ROLE_KEY, qui ne doit JAMAIS être exposée au navigateur.
// L'appelant doit fournir son jeton d'accès Supabase ; son rôle admin est
// revérifié côté serveur avant toute opération.

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const EMAIL_DOMAIN = '@jeannedelanoue.com';

function serviceHeaders() {
    return {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json'
    };
}

async function getCaller(accessToken) {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok) return null;
    return response.json();
}

async function isAdmin(userId) {
    const response = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=is_admin`,
        { headers: serviceHeaders() }
    );
    if (!response.ok) return false;
    const rows = await response.json();
    return Array.isArray(rows) && rows.length > 0 && rows[0].is_admin === true;
}

async function findUserByIdentifiant(identifiant) {
    const email = encodeURIComponent(identifiant + EMAIL_DOMAIN);
    const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?filter=${email}`, {
        headers: serviceHeaders()
    });
    if (!response.ok) return null;
    const payload = await response.json();
    const users = payload.users || [];
    return users.find(function (u) {
        return (u.email || '').toLowerCase() === (identifiant + EMAIL_DOMAIN).toLowerCase();
    }) || null;
}

async function updateAuthUser(userId, body) {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
        method: 'PUT',
        headers: serviceHeaders(),
        body: JSON.stringify(body)
    });
    const payload = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(payload.msg || payload.message || 'Mise à jour du compte impossible.');
    return payload;
}

async function patchRest(path, body) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        method: 'PATCH',
        headers: Object.assign(serviceHeaders(), { Prefer: 'return=minimal' }),
        body: JSON.stringify(body)
    });
    if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || 'Mise à jour impossible.');
    }
}

async function logAction(actorIdentifiant, action, target, details) {
    await fetch(`${SUPABASE_URL}/rest/v1/admin_audit_log`, {
        method: 'POST',
        headers: Object.assign(serviceHeaders(), { Prefer: 'return=minimal' }),
        body: JSON.stringify({
            actor_identifiant: actorIdentifiant,
            action: action,
            target: target,
            details: details || {}
        })
    }).catch(function () {});
}

module.exports = async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Méthode non autorisée.' });
    }
    if (!SUPABASE_URL || !SERVICE_KEY) {
        return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY non configurée sur Vercel.' });
    }

    const authHeader = req.headers.authorization || '';
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!accessToken) return res.status(401).json({ error: 'Jeton d\'accès manquant.' });

    const caller = await getCaller(accessToken);
    if (!caller || !caller.id) return res.status(401).json({ error: 'Session invalide.' });
    if (!await isAdmin(caller.id)) return res.status(403).json({ error: 'Accès réservé à l\'administrateur.' });

    const callerIdentifiant = (caller.email || '').split('@')[0].toLowerCase();
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const action = body.action;
    const identifiant = (body.identifiant || '').trim().toLowerCase();

    try {
        if (action === 'reset_password') {
            if (!body.password || String(body.password).length < 8) {
                return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
            }
            const user = await findUserByIdentifiant(identifiant);
            if (!user) return res.status(404).json({ error: 'Compte introuvable.' });
            await updateAuthUser(user.id, { password: String(body.password) });
            await logAction(callerIdentifiant, 'mot_de_passe_reinitialise', identifiant, {});
            return res.status(200).json({ ok: true });
        }

        if (action === 'recovery_link') {
            const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
                method: 'POST',
                headers: serviceHeaders(),
                body: JSON.stringify({ type: 'recovery', email: identifiant + EMAIL_DOMAIN })
            });
            const payload = await response.json().catch(function () { return {}; });
            if (!response.ok) return res.status(400).json({ error: payload.msg || 'Génération du lien impossible.' });
            await logAction(callerIdentifiant, 'lien_recuperation_genere', identifiant, {});
            return res.status(200).json({ ok: true, link: payload.action_link || (payload.properties && payload.properties.action_link) });
        }

        if (action === 'change_identifiant') {
            const nouveau = (body.nouvelIdentifiant || '').trim().toLowerCase();
            if (!/^[a-z0-9._-]{3,40}$/.test(nouveau)) {
                return res.status(400).json({ error: 'Identifiant invalide (3 à 40 caractères, lettres/chiffres/.-_).' });
            }
            if (await findUserByIdentifiant(nouveau)) {
                return res.status(409).json({ error: 'Cet identifiant est déjà utilisé.' });
            }
            const user = await findUserByIdentifiant(identifiant);
            if (!user) return res.status(404).json({ error: 'Compte introuvable.' });

            const nouvelEmail = nouveau + EMAIL_DOMAIN;
            await updateAuthUser(user.id, { email: nouvelEmail, email_confirm: true });
            await patchRest(`profiles?id=eq.${user.id}`, { email: nouvelEmail });
            // La liste blanche est indexée par identifiant : elle doit suivre le renommage.
            await patchRest(`allowed_teachers?identifiant=eq.${encodeURIComponent(identifiant)}`, { identifiant: nouveau });
            await logAction(callerIdentifiant, 'identifiant_modifie', identifiant, { nouveau: nouveau });
            return res.status(200).json({ ok: true });
        }

        if (action === 'set_ban') {
            const user = await findUserByIdentifiant(identifiant);
            if (!user) return res.status(404).json({ error: 'Compte introuvable.' });
            if (user.id === caller.id) return res.status(400).json({ error: 'Impossible de bloquer son propre compte.' });

            const bloquer = body.bloquer === true;
            await updateAuthUser(user.id, { ban_duration: bloquer ? '876000h' : 'none' });
            await patchRest(`profiles?id=eq.${user.id}`, { actif: !bloquer });
            await logAction(callerIdentifiant, bloquer ? 'compte_bloque' : 'compte_debloque', identifiant, {});
            return res.status(200).json({ ok: true });
        }

        if (action === 'invite') {
            const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
                method: 'POST',
                headers: serviceHeaders(),
                body: JSON.stringify({
                    type: 'invite',
                    email: identifiant + EMAIL_DOMAIN
                })
            });
            const payload = await response.json().catch(function () { return {}; });
            if (!response.ok) return res.status(400).json({ error: payload.msg || 'Invitation impossible.' });
            await logAction(callerIdentifiant, 'invitation_envoyee', identifiant, {});
            return res.status(200).json({ ok: true, link: payload.action_link || (payload.properties && payload.properties.action_link) });
        }

        return res.status(400).json({ error: 'Action inconnue.' });
    } catch (error) {
        return res.status(500).json({ error: error.message || 'Erreur serveur.' });
    }
};
