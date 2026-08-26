// ===== PANNEAU D'ADMINISTRATION =====
// Réservé aux comptes marqués profiles.is_admin (voir migration 0008).
// Le bouton n'apparaît que pour un admin, et l'ouverture du panneau exige une
// nouvelle saisie de l'identifiant + mot de passe du compte administrateur.

(function () {
    const EMAIL_DOMAIN = '@jeannedelanoue.com';

    function escapeHtml(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    async function getClient() {
        return window.getSupabaseClient ? window.getSupabaseClient() : null;
    }

    async function getCurrentIdentifiant() {
        const session = window.eprofAuth ? await window.eprofAuth.getSession() : null;
        if (!session || !session.user || !session.user.email) return null;
        return session.user.email.split('@')[0].toLowerCase();
    }

    async function isCurrentUserAdmin() {
        const client = await getClient();
        if (!client) return false;
        const { data, error } = await client.rpc('is_admin');
        if (error) {
            console.warn('⚠️ Vérification du rôle administrateur impossible.', error);
            return false;
        }
        return !!data;
    }

    // ---------- Données ----------
    async function listAllowed() {
        const result = await window.EprofStore.list('allowed_teachers', { orderBy: 'identifiant' });
        if (result.error) throw result.error;
        return result.data || [];
    }

    async function saveAllowed(entry) {
        const result = await window.EprofStore.upsert('allowed_teachers', [entry], { onConflict: 'identifiant' });
        if (result.error) throw result.error;
    }

    async function removeAllowed(identifiant) {
        const result = await window.EprofStore.removeWhere('allowed_teachers', { identifiant });
        if (result.error) throw result.error;
    }

    async function deleteAccount(identifiant) {
        const client = await getClient();
        const { error } = await client.rpc('admin_delete_teacher_account', { p_identifiant: identifiant });
        if (error) throw error;
    }

    // ---------- Modale de ré-authentification ----------
    function askCredentials() {
        return new Promise(function (resolve) {
            const overlay = document.createElement('div');
            overlay.className = 'admin-overlay';
            overlay.innerHTML = `
                <div class="admin-dialog admin-dialog-small">
                    <h3>🔐 Accès administrateur</h3>
                    <p class="admin-hint">Confirmez vos identifiants pour ouvrir le panneau d'administration.</p>
                    <form class="admin-login-form">
                        <label>Identifiant
                            <input type="text" class="admin-login-id" autocomplete="username" required>
                        </label>
                        <label>Mot de passe
                            <input type="password" class="admin-login-pwd" autocomplete="current-password" required>
                        </label>
                        <div class="admin-error" style="display:none;"></div>
                        <div class="admin-dialog-actions">
                            <button type="submit" class="btn-primary">Déverrouiller</button>
                            <button type="button" class="btn-secondary admin-cancel">Annuler</button>
                        </div>
                    </form>
                </div>`;
            document.body.appendChild(overlay);

            const form = overlay.querySelector('.admin-login-form');
            const errorEl = overlay.querySelector('.admin-error');

            function close(result) {
                overlay.remove();
                resolve(result);
            }

            overlay.querySelector('.admin-cancel').addEventListener('click', function () { close(false); });
            overlay.addEventListener('click', function (e) { if (e.target === overlay) close(false); });

            form.addEventListener('submit', async function (e) {
                e.preventDefault();
                errorEl.style.display = 'none';
                const identifiant = overlay.querySelector('.admin-login-id').value.trim().toLowerCase();
                const password = overlay.querySelector('.admin-login-pwd').value;
                const current = await getCurrentIdentifiant();

                // On refuse un identifiant différent de la session en cours : le panneau
                // confirme l'identité de l'utilisateur connecté, il ne change pas de compte.
                if (identifiant !== current) {
                    errorEl.textContent = 'Identifiant différent du compte connecté.';
                    errorEl.style.display = 'block';
                    return;
                }

                try {
                    const { error } = await window.eprofAuth.signIn(identifiant + EMAIL_DOMAIN, password);
                    if (error) {
                        errorEl.textContent = 'Mot de passe incorrect.';
                        errorEl.style.display = 'block';
                        return;
                    }
                } catch (err) {
                    errorEl.textContent = 'Vérification impossible : ' + err.message;
                    errorEl.style.display = 'block';
                    return;
                }

                if (!await isCurrentUserAdmin()) {
                    errorEl.textContent = 'Ce compte n\'a pas les droits d\'administration.';
                    errorEl.style.display = 'block';
                    return;
                }
                close(true);
            });

            overlay.querySelector('.admin-login-id').focus();
        });
    }

    // ---------- Panneau ----------
    function rowHtml(entry) {
        return `
            <tr data-identifiant="${escapeHtml(entry.identifiant)}">
                <td><code>${escapeHtml(entry.identifiant)}</code></td>
                <td><input type="text" class="admin-cell admin-prenom" value="${escapeHtml(entry.prenom || '')}"></td>
                <td><input type="text" class="admin-cell admin-nom" value="${escapeHtml(entry.nom || '')}"></td>
                <td><input type="text" class="admin-cell admin-matiere" value="${escapeHtml(entry.matiere || '')}"></td>
                <td class="admin-status">${entry.is_registered ? '<span class="admin-badge admin-badge-on">Inscrit</span>' : '<span class="admin-badge">Libre</span>'}</td>
                <td class="admin-actions">
                    <button type="button" class="admin-save-btn" title="Enregistrer les modifications">💾</button>
                    <button type="button" class="admin-remove-btn" title="Retirer de la liste blanche">🗑️</button>
                    ${entry.is_registered ? '<button type="button" class="admin-purge-btn" title="Supprimer le compte et toutes ses données">💥</button>' : ''}
                </td>
            </tr>`;
    }

    async function openPanel() {
        const overlay = document.createElement('div');
        overlay.className = 'admin-overlay';
        overlay.innerHTML = `
            <div class="admin-dialog">
                <div class="admin-dialog-header">
                    <h3>🛠️ Administration — liste blanche des enseignants</h3>
                    <button type="button" class="admin-close" aria-label="Fermer">×</button>
                </div>

                <form class="admin-add-form">
                    <input type="text" class="admin-new-id" placeholder="identifiant" required>
                    <input type="text" class="admin-new-prenom" placeholder="Prénom">
                    <input type="text" class="admin-new-nom" placeholder="Nom">
                    <input type="text" class="admin-new-matiere" placeholder="Matière">
                    <button type="submit" class="btn-primary">➕ Ajouter</button>
                </form>

                <div class="admin-toolbar">
                    <input type="search" class="admin-search" placeholder="Rechercher…">
                    <span class="admin-counter"></span>
                </div>

                <div class="admin-feedback" style="display:none;"></div>

                <div class="admin-table-wrap">
                    <table class="admin-table">
                        <thead>
                            <tr><th>Identifiant</th><th>Prénom</th><th>Nom</th><th>Matière</th><th>État</th><th>Actions</th></tr>
                        </thead>
                        <tbody class="admin-tbody"><tr><td colspan="6">Chargement…</td></tr></tbody>
                    </table>
                </div>
                <p class="admin-hint">💾 enregistre la ligne · 🗑️ retire l'identifiant de la liste blanche (le compte existant reste actif) · 💥 supprime définitivement le compte et toutes ses données, puis libère l'identifiant.</p>
            </div>`;
        document.body.appendChild(overlay);

        const tbody = overlay.querySelector('.admin-tbody');
        const feedback = overlay.querySelector('.admin-feedback');
        const counter = overlay.querySelector('.admin-counter');
        let entries = [];

        function notify(message, isError) {
            feedback.textContent = message;
            feedback.className = 'admin-feedback' + (isError ? ' admin-feedback-error' : '');
            feedback.style.display = 'block';
            setTimeout(function () { feedback.style.display = 'none'; }, 4000);
        }

        function renderRows() {
            const term = overlay.querySelector('.admin-search').value.trim().toLowerCase();
            const visible = entries.filter(function (e) {
                return !term || [e.identifiant, e.prenom, e.nom, e.matiere].join(' ').toLowerCase().includes(term);
            });
            tbody.innerHTML = visible.length
                ? visible.map(rowHtml).join('')
                : '<tr><td colspan="6">Aucun résultat.</td></tr>';
            counter.textContent = entries.length + ' identifiant(s) · ' + entries.filter(function (e) { return e.is_registered; }).length + ' inscrit(s)';
        }

        async function reload() {
            try {
                entries = await listAllowed();
                renderRows();
            } catch (err) {
                tbody.innerHTML = '<tr><td colspan="6">Erreur de chargement : ' + escapeHtml(err.message) + '</td></tr>';
            }
        }

        overlay.querySelector('.admin-close').addEventListener('click', function () { overlay.remove(); });
        overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
        overlay.querySelector('.admin-search').addEventListener('input', renderRows);

        overlay.querySelector('.admin-add-form').addEventListener('submit', async function (e) {
            e.preventDefault();
            const identifiant = overlay.querySelector('.admin-new-id').value.trim().toLowerCase();
            if (!identifiant) return;
            try {
                await saveAllowed({
                    identifiant: identifiant,
                    prenom: overlay.querySelector('.admin-new-prenom').value.trim() || null,
                    nom: overlay.querySelector('.admin-new-nom').value.trim() || null,
                    matiere: overlay.querySelector('.admin-new-matiere').value.trim() || null
                });
                e.target.reset();
                await reload();
                notify('✅ ' + identifiant + ' ajouté à la liste blanche.');
            } catch (err) {
                notify('❌ ' + err.message, true);
            }
        });

        tbody.addEventListener('click', async function (e) {
            const row = e.target.closest('tr[data-identifiant]');
            if (!row) return;
            const identifiant = row.dataset.identifiant;

            if (e.target.classList.contains('admin-save-btn')) {
                try {
                    await saveAllowed({
                        identifiant: identifiant,
                        prenom: row.querySelector('.admin-prenom').value.trim() || null,
                        nom: row.querySelector('.admin-nom').value.trim() || null,
                        matiere: row.querySelector('.admin-matiere').value.trim() || null
                    });
                    await reload();
                    notify('✅ ' + identifiant + ' mis à jour.');
                } catch (err) {
                    notify('❌ ' + err.message, true);
                }
            } else if (e.target.classList.contains('admin-remove-btn')) {
                if (!confirm('Retirer « ' + identifiant + ' » de la liste blanche ?')) return;
                try {
                    await removeAllowed(identifiant);
                    await reload();
                    notify('✅ ' + identifiant + ' retiré de la liste blanche.');
                } catch (err) {
                    notify('❌ ' + err.message, true);
                }
            } else if (e.target.classList.contains('admin-purge-btn')) {
                if (!confirm('SUPPRESSION DÉFINITIVE du compte « ' + identifiant + ' » et de toutes ses données (notes, agenda, plans de classe…).\n\nCette action est irréversible. Continuer ?')) return;
                if (prompt('Pour confirmer, tapez l\'identifiant : ') !== identifiant) return;
                try {
                    await deleteAccount(identifiant);
                    await reload();
                    notify('✅ Compte ' + identifiant + ' supprimé, identifiant de nouveau disponible.');
                } catch (err) {
                    notify('❌ ' + err.message, true);
                }
            }
        });

        reload();
    }

    // ---------- Bouton du footer ----------
    let buttonWired = false;

    async function setupAdminButton() {
        const btn = document.getElementById('admin-panel-trigger');
        if (!btn) return;
        if (!await isCurrentUserAdmin()) {
            btn.style.display = 'none';
            return;
        }

        btn.style.display = 'inline-flex';
        if (buttonWired) return;
        buttonWired = true;
        btn.addEventListener('click', async function () {
            if (await askCredentials()) openPanel();
        });
    }

    window.EprofAdmin = { setup: setupAdminButton, isCurrentUserAdmin };

    document.addEventListener('DOMContentLoaded', async function () {
        await (window.eprofSupabaseReady || Promise.resolve());
        setupAdminButton();
        if (window.eprofAuth) window.eprofAuth.onAuthStateChange(setupAdminButton);
    });
})();
