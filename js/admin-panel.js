// ===== PANNEAU D'ADMINISTRATION =====
// Réservé aux comptes marqués profiles.is_admin (migrations 0008 / 0009).
// Le bouton n'apparaît que pour un admin, et l'ouverture du panneau exige une
// nouvelle saisie de l'identifiant + mot de passe du compte administrateur.
//
// Organisation : un onglet = un module autonome (html + init), pour que chaque
// partie reste réparable isolément.

(function () {
    const EMAIL_DOMAIN = '@jeannedelanoue.com';

    function escapeHtml(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function formatDate(value) {
        if (!value) return '—';
        return new Date(value).toLocaleString('fr-FR');
    }

    async function getClient() {
        return window.getSupabaseClient ? window.getSupabaseClient() : null;
    }

    async function rpc(name, params) {
        const client = await getClient();
        if (!client) throw new Error('Supabase non disponible.');
        const { data, error } = await client.rpc(name, params || {});
        if (error) throw error;
        return data;
    }

    async function getCurrentIdentifiant() {
        const session = window.eprofAuth ? await window.eprofAuth.getSession() : null;
        if (!session || !session.user || !session.user.email) return null;
        return session.user.email.split('@')[0].toLowerCase();
    }

    async function isCurrentUserAdmin() {
        try {
            return !!await rpc('is_admin');
        } catch (err) {
            console.warn('⚠️ Vérification du rôle administrateur impossible.', err);
            return false;
        }
    }

    async function logAction(action, target, details) {
        try {
            await rpc('log_admin_action', { p_action: action, p_target: target || null, p_details: details || {} });
        } catch (err) {
            console.warn('⚠️ Journalisation de l\'action admin impossible.', err);
        }
    }

    function downloadJson(filename, payload) {
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        URL.revokeObjectURL(link.href);
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
                await logAction('ouverture_panneau_admin', identifiant, {});
                close(true);
            });

            overlay.querySelector('.admin-login-id').focus();
        });
    }

    // ================= ONGLET : LISTE BLANCHE =================
    const whitelistTab = {
        id: 'whitelist',
        label: '👥 Liste blanche',
        html: `
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
            <div class="admin-table-wrap">
                <table class="admin-table">
                    <thead>
                        <tr><th>Identifiant</th><th>Prénom</th><th>Nom</th><th>Matière</th><th>État</th><th>Actions</th></tr>
                    </thead>
                    <tbody class="admin-tbody"><tr><td colspan="6">Chargement…</td></tr></tbody>
                </table>
            </div>
            <p class="admin-hint">💾 enregistre la ligne · 🗑️ retire l'identifiant de la liste blanche (le compte existant reste actif) · 💥 supprime définitivement le compte et toutes ses données, puis libère l'identifiant.</p>`,

        init: function (root, ctx) {
            const tbody = root.querySelector('.admin-tbody');
            const counter = root.querySelector('.admin-counter');
            let entries = [];

            function rowHtml(entry) {
                return `
                    <tr data-identifiant="${escapeHtml(entry.identifiant)}">
                        <td><code>${escapeHtml(entry.identifiant)}</code></td>
                        <td><input type="text" class="admin-cell admin-prenom" value="${escapeHtml(entry.prenom || '')}"></td>
                        <td><input type="text" class="admin-cell admin-nom" value="${escapeHtml(entry.nom || '')}"></td>
                        <td><input type="text" class="admin-cell admin-matiere" value="${escapeHtml(entry.matiere || '')}"></td>
                        <td>${entry.is_registered ? '<span class="admin-badge admin-badge-on">Inscrit</span>' : '<span class="admin-badge">Libre</span>'}</td>
                        <td class="admin-actions">
                            <button type="button" class="admin-save-btn" title="Enregistrer les modifications">💾</button>
                            <button type="button" class="admin-remove-btn" title="Retirer de la liste blanche">🗑️</button>
                            ${entry.is_registered ? '<button type="button" class="admin-purge-btn" title="Supprimer le compte et toutes ses données">💥</button>' : ''}
                        </td>
                    </tr>`;
            }

            function renderRows() {
                const term = root.querySelector('.admin-search').value.trim().toLowerCase();
                const visible = entries.filter(function (e) {
                    return !term || [e.identifiant, e.prenom, e.nom, e.matiere].join(' ').toLowerCase().includes(term);
                });
                tbody.innerHTML = visible.length ? visible.map(rowHtml).join('') : '<tr><td colspan="6">Aucun résultat.</td></tr>';
                counter.textContent = entries.length + ' identifiant(s) · ' + entries.filter(function (e) { return e.is_registered; }).length + ' inscrit(s)';
            }

            async function reload() {
                const result = await window.EprofStore.list('allowed_teachers', { orderBy: 'identifiant' });
                if (result.error) {
                    tbody.innerHTML = '<tr><td colspan="6">Erreur de chargement : ' + escapeHtml(result.error.message) + '</td></tr>';
                    return;
                }
                entries = result.data || [];
                renderRows();
            }

            async function saveEntry(entry) {
                const result = await window.EprofStore.upsert('allowed_teachers', [entry], { onConflict: 'identifiant' });
                if (result.error) throw result.error;
            }

            root.querySelector('.admin-search').addEventListener('input', renderRows);

            root.querySelector('.admin-add-form').addEventListener('submit', async function (e) {
                e.preventDefault();
                const identifiant = root.querySelector('.admin-new-id').value.trim().toLowerCase();
                if (!identifiant) return;
                try {
                    await saveEntry({
                        identifiant: identifiant,
                        prenom: root.querySelector('.admin-new-prenom').value.trim() || null,
                        nom: root.querySelector('.admin-new-nom').value.trim() || null,
                        matiere: root.querySelector('.admin-new-matiere').value.trim() || null
                    });
                    await logAction('whitelist_ajout', identifiant, {});
                    e.target.reset();
                    await reload();
                    ctx.notify('✅ ' + identifiant + ' ajouté à la liste blanche.');
                } catch (err) {
                    ctx.notify('❌ ' + err.message, true);
                }
            });

            tbody.addEventListener('click', async function (e) {
                const row = e.target.closest('tr[data-identifiant]');
                if (!row) return;
                const identifiant = row.dataset.identifiant;

                if (e.target.classList.contains('admin-save-btn')) {
                    try {
                        await saveEntry({
                            identifiant: identifiant,
                            prenom: row.querySelector('.admin-prenom').value.trim() || null,
                            nom: row.querySelector('.admin-nom').value.trim() || null,
                            matiere: row.querySelector('.admin-matiere').value.trim() || null
                        });
                        await logAction('whitelist_modification', identifiant, {});
                        await reload();
                        ctx.notify('✅ ' + identifiant + ' mis à jour.');
                    } catch (err) {
                        ctx.notify('❌ ' + err.message, true);
                    }
                } else if (e.target.classList.contains('admin-remove-btn')) {
                    if (!confirm('Retirer « ' + identifiant + ' » de la liste blanche ?')) return;
                    try {
                        const result = await window.EprofStore.removeWhere('allowed_teachers', { identifiant: identifiant });
                        if (result.error) throw result.error;
                        await logAction('whitelist_suppression', identifiant, {});
                        await reload();
                        ctx.notify('✅ ' + identifiant + ' retiré de la liste blanche.');
                    } catch (err) {
                        ctx.notify('❌ ' + err.message, true);
                    }
                } else if (e.target.classList.contains('admin-purge-btn')) {
                    if (!confirm('SUPPRESSION DÉFINITIVE du compte « ' + identifiant + ' » et de toutes ses données (notes, agenda, plans de classe…).\n\nCette action est irréversible. Continuer ?')) return;
                    if (prompt('Pour confirmer, tapez l\'identifiant : ') !== identifiant) return;
                    try {
                        await rpc('admin_delete_teacher_account', { p_identifiant: identifiant });
                        await logAction('compte_supprime', identifiant, {});
                        await reload();
                        ctx.notify('✅ Compte ' + identifiant + ' supprimé, identifiant de nouveau disponible.');
                    } catch (err) {
                        ctx.notify('❌ ' + err.message, true);
                    }
                }
            });

            reload();
        }
    };

    // ================= ONGLET : RGPD =================
    const REGISTRE_CHAMPS = [
        { key: 'nom', label: 'Traitement' },
        { key: 'finalite', label: 'Finalité' },
        { key: 'base_legale', label: 'Base légale' },
        { key: 'personnes_concernees', label: 'Personnes concernées' },
        { key: 'categories_donnees', label: 'Catégories de données' },
        { key: 'destinataires', label: 'Destinataires' },
        { key: 'duree_conservation', label: 'Conservation' },
        { key: 'mesures_securite', label: 'Mesures de sécurité' },
        { key: 'responsable', label: 'Responsable' }
    ];

    const rgpdTab = {
        id: 'rgpd',
        label: '🛡️ RGPD',
        html: `
            <div class="admin-subtabs">
                <button type="button" class="admin-subtab admin-subtab-active" data-section="droits">Droits des personnes</button>
                <button type="button" class="admin-subtab" data-section="registre">Registre des traitements</button>
                <button type="button" class="admin-subtab" data-section="consentements">Consentements</button>
                <button type="button" class="admin-subtab" data-section="retention">Conservation & purge</button>
                <button type="button" class="admin-subtab" data-section="audit">Journal d'audit</button>
            </div>
            <div class="admin-section" data-section="droits"></div>
            <div class="admin-section" data-section="registre" style="display:none;"></div>
            <div class="admin-section" data-section="consentements" style="display:none;"></div>
            <div class="admin-section" data-section="retention" style="display:none;"></div>
            <div class="admin-section" data-section="audit" style="display:none;"></div>`,

        init: function (root, ctx) {
            const sections = {};
            root.querySelectorAll('.admin-section').forEach(function (el) { sections[el.dataset.section] = el; });

            // ----- Droits des personnes -----
            function renderDroits() {
                sections.droits.innerHTML = `
                    <div class="admin-card">
                        <h4>📤 Droit d'accès — export des données</h4>
                        <p class="admin-hint">Exporte au format JSON l'intégralité des données liées à un compte enseignant : profil, classes, élèves, évaluations, agenda, plans de classe, documents.</p>
                        <div class="admin-inline-form">
                            <input type="text" class="rgpd-export-id" placeholder="identifiant">
                            <button type="button" class="btn-primary rgpd-export-btn">Exporter (JSON)</button>
                        </div>
                    </div>
                    <div class="admin-card admin-card-danger">
                        <h4>🧹 Droit à l'oubli</h4>
                        <p class="admin-hint"><strong>Anonymiser</strong> conserve le compte mais efface toute donnée nominative (profil, élèves, documents, événements, plans). <strong>Supprimer</strong> détruit le compte et l'ensemble des données en cascade, et libère l'identifiant.</p>
                        <div class="admin-inline-form">
                            <input type="text" class="rgpd-forget-id" placeholder="identifiant">
                            <button type="button" class="btn-secondary rgpd-anonymize-btn">Anonymiser</button>
                            <button type="button" class="btn-danger rgpd-delete-btn">Supprimer définitivement</button>
                        </div>
                    </div>`;

                sections.droits.querySelector('.rgpd-export-btn').addEventListener('click', async function () {
                    const identifiant = sections.droits.querySelector('.rgpd-export-id').value.trim().toLowerCase();
                    if (!identifiant) return;
                    try {
                        const data = await rpc('admin_export_teacher_data', { p_identifiant: identifiant });
                        downloadJson('export-rgpd-' + identifiant + '-' + new Date().toISOString().slice(0, 10) + '.json', data);
                        ctx.notify('✅ Export généré pour ' + identifiant + '.');
                    } catch (err) {
                        ctx.notify('❌ ' + err.message, true);
                    }
                });

                sections.droits.querySelector('.rgpd-anonymize-btn').addEventListener('click', async function () {
                    const identifiant = sections.droits.querySelector('.rgpd-forget-id').value.trim().toLowerCase();
                    if (!identifiant) return;
                    if (!confirm('Anonymiser toutes les données de « ' + identifiant + ' » ? Action irréversible.')) return;
                    if (prompt('Pour confirmer, tapez l\'identifiant : ') !== identifiant) return;
                    try {
                        const result = await rpc('admin_anonymize_teacher', { p_identifiant: identifiant });
                        ctx.notify('✅ Anonymisé : ' + result.eleves_anonymises + ' élève(s), ' + result.documents_vides + ' document(s) vidé(s).');
                    } catch (err) {
                        ctx.notify('❌ ' + err.message, true);
                    }
                });

                sections.droits.querySelector('.rgpd-delete-btn').addEventListener('click', async function () {
                    const identifiant = sections.droits.querySelector('.rgpd-forget-id').value.trim().toLowerCase();
                    if (!identifiant) return;
                    if (!confirm('SUPPRESSION DÉFINITIVE du compte « ' + identifiant + ' » et de toutes ses données. Continuer ?')) return;
                    if (prompt('Pour confirmer, tapez l\'identifiant : ') !== identifiant) return;
                    try {
                        await rpc('admin_delete_teacher_account', { p_identifiant: identifiant });
                        await logAction('compte_supprime', identifiant, { motif: 'droit à l\'oubli' });
                        ctx.notify('✅ Compte ' + identifiant + ' supprimé.');
                    } catch (err) {
                        ctx.notify('❌ ' + err.message, true);
                    }
                });
            }

            // ----- Registre des traitements -----
            async function renderRegistre() {
                const result = await window.EprofStore.list('gdpr_processing_records', { orderBy: 'nom' });
                if (result.error) {
                    sections.registre.innerHTML = '<p class="admin-error">Erreur : ' + escapeHtml(result.error.message) + '</p>';
                    return;
                }
                const records = result.data || [];
                sections.registre.innerHTML = `
                    <div class="admin-toolbar">
                        <button type="button" class="btn-primary registre-add-btn">➕ Nouveau traitement</button>
                        <button type="button" class="btn-secondary registre-export-btn">📤 Exporter le registre</button>
                        <span class="admin-counter">${records.length} traitement(s)</span>
                    </div>
                    ${records.map(function (r) {
                        return `<div class="admin-card" data-id="${escapeHtml(r.id)}">
                            ${REGISTRE_CHAMPS.map(function (f) {
                                return `<label class="admin-field"><span>${f.label}</span><textarea rows="2" data-key="${f.key}">${escapeHtml(r[f.key] || '')}</textarea></label>`;
                            }).join('')}
                            <div class="admin-dialog-actions">
                                <button type="button" class="btn-primary registre-save-btn">💾 Enregistrer</button>
                                <button type="button" class="btn-danger registre-delete-btn">🗑️ Supprimer</button>
                            </div>
                        </div>`;
                    }).join('') || '<p class="admin-hint">Registre vide.</p>'}`;

                sections.registre.querySelector('.registre-add-btn').addEventListener('click', async function () {
                    const nom = prompt('Nom du traitement :');
                    if (!nom) return;
                    const res = await window.EprofStore.insert('gdpr_processing_records', { nom: nom });
                    if (res.error) return ctx.notify('❌ ' + res.error.message, true);
                    await logAction('rgpd_registre_ajout', nom, {});
                    renderRegistre();
                });

                sections.registre.querySelector('.registre-export-btn').addEventListener('click', function () {
                    downloadJson('registre-traitements-' + new Date().toISOString().slice(0, 10) + '.json', records);
                });

                sections.registre.querySelectorAll('.admin-card[data-id]').forEach(function (card) {
                    card.querySelector('.registre-save-btn').addEventListener('click', async function () {
                        const patch = {};
                        card.querySelectorAll('textarea[data-key]').forEach(function (ta) { patch[ta.dataset.key] = ta.value.trim() || null; });
                        const res = await window.EprofStore.update('gdpr_processing_records', card.dataset.id, patch);
                        if (res.error) return ctx.notify('❌ ' + res.error.message, true);
                        await logAction('rgpd_registre_modification', patch.nom, {});
                        ctx.notify('✅ Traitement enregistré.');
                    });
                    card.querySelector('.registre-delete-btn').addEventListener('click', async function () {
                        if (!confirm('Supprimer ce traitement du registre ?')) return;
                        const res = await window.EprofStore.remove('gdpr_processing_records', card.dataset.id);
                        if (res.error) return ctx.notify('❌ ' + res.error.message, true);
                        await logAction('rgpd_registre_suppression', card.dataset.id, {});
                        renderRegistre();
                    });
                });
            }

            // ----- Consentements -----
            async function renderConsentements() {
                const result = await window.EprofStore.list('gdpr_consents', { orderBy: 'personne_ref' });
                if (result.error) {
                    sections.consentements.innerHTML = '<p class="admin-error">Erreur : ' + escapeHtml(result.error.message) + '</p>';
                    return;
                }
                const rows = result.data || [];
                sections.consentements.innerHTML = `
                    <form class="admin-add-form consent-add-form">
                        <select class="consent-type">
                            <option value="eleve">Élève</option>
                            <option value="responsable">Responsable légal</option>
                            <option value="enseignant">Enseignant</option>
                        </select>
                        <input type="text" class="consent-ref" placeholder="Nom Prénom" required>
                        <input type="text" class="consent-classe" placeholder="Classe">
                        <input type="text" class="consent-finalite" placeholder="Finalité (ex : photo trombinoscope)" required>
                        <button type="submit" class="btn-primary">➕ Ajouter</button>
                    </form>
                    <div class="admin-toolbar">
                        <input type="search" class="consent-search" placeholder="Rechercher…">
                        <span class="admin-counter">${rows.length} consentement(s) · ${rows.filter(function (r) { return r.consenti; }).length} accordé(s)</span>
                    </div>
                    <div class="admin-table-wrap">
                        <table class="admin-table">
                            <thead><tr><th>Type</th><th>Personne</th><th>Classe</th><th>Finalité</th><th>Accordé</th><th>Date</th><th></th></tr></thead>
                            <tbody class="consent-tbody"></tbody>
                        </table>
                    </div>`;

                const tbody = sections.consentements.querySelector('.consent-tbody');

                function draw() {
                    const term = sections.consentements.querySelector('.consent-search').value.trim().toLowerCase();
                    const visible = rows.filter(function (r) {
                        return !term || [r.personne_ref, r.classe, r.finalite].join(' ').toLowerCase().includes(term);
                    });
                    tbody.innerHTML = visible.map(function (r) {
                        return `<tr data-id="${escapeHtml(r.id)}">
                            <td>${escapeHtml(r.personne_type)}</td>
                            <td>${escapeHtml(r.personne_ref)}</td>
                            <td>${escapeHtml(r.classe || '')}</td>
                            <td>${escapeHtml(r.finalite)}</td>
                            <td><input type="checkbox" class="consent-toggle" ${r.consenti ? 'checked' : ''}></td>
                            <td>${escapeHtml(r.consenti ? formatDate(r.date_consentement) : (r.date_retrait ? 'retiré le ' + formatDate(r.date_retrait) : '—'))}</td>
                            <td class="admin-actions"><button type="button" class="consent-delete-btn" title="Supprimer">🗑️</button></td>
                        </tr>`;
                    }).join('') || '<tr><td colspan="7">Aucun consentement enregistré.</td></tr>';
                }

                draw();
                sections.consentements.querySelector('.consent-search').addEventListener('input', draw);

                sections.consentements.querySelector('.consent-add-form').addEventListener('submit', async function (e) {
                    e.preventDefault();
                    const res = await window.EprofStore.insert('gdpr_consents', {
                        personne_type: sections.consentements.querySelector('.consent-type').value,
                        personne_ref: sections.consentements.querySelector('.consent-ref').value.trim(),
                        classe: sections.consentements.querySelector('.consent-classe').value.trim() || null,
                        finalite: sections.consentements.querySelector('.consent-finalite').value.trim()
                    });
                    if (res.error) return ctx.notify('❌ ' + res.error.message, true);
                    await logAction('rgpd_consentement_ajout', res.data.personne_ref, {});
                    renderConsentements();
                });

                tbody.addEventListener('change', async function (e) {
                    if (!e.target.classList.contains('consent-toggle')) return;
                    const id = e.target.closest('tr').dataset.id;
                    const consenti = e.target.checked;
                    const res = await window.EprofStore.update('gdpr_consents', id, {
                        consenti: consenti,
                        date_consentement: consenti ? new Date().toISOString() : null,
                        date_retrait: consenti ? null : new Date().toISOString()
                    });
                    if (res.error) return ctx.notify('❌ ' + res.error.message, true);
                    await logAction(consenti ? 'rgpd_consentement_accorde' : 'rgpd_consentement_retire', id, {});
                    renderConsentements();
                });

                tbody.addEventListener('click', async function (e) {
                    if (!e.target.classList.contains('consent-delete-btn')) return;
                    if (!confirm('Supprimer ce consentement ?')) return;
                    const id = e.target.closest('tr').dataset.id;
                    const res = await window.EprofStore.remove('gdpr_consents', id);
                    if (res.error) return ctx.notify('❌ ' + res.error.message, true);
                    await logAction('rgpd_consentement_suppression', id, {});
                    renderConsentements();
                });
            }

            // ----- Conservation & purge -----
            async function renderRetention() {
                const result = await window.EprofStore.list('gdpr_retention_policies', { orderBy: 'libelle' });
                if (result.error) {
                    sections.retention.innerHTML = '<p class="admin-error">Erreur : ' + escapeHtml(result.error.message) + '</p>';
                    return;
                }
                const policies = result.data || [];
                sections.retention.innerHTML = `
                    <div class="admin-table-wrap">
                        <table class="admin-table">
                            <thead><tr><th>Donnée</th><th>Cible</th><th>Durée (mois)</th><th>Active</th><th>Dernière purge</th><th></th></tr></thead>
                            <tbody>
                                ${policies.map(function (p) {
                                    return `<tr data-cle="${escapeHtml(p.cle)}" data-libelle="${escapeHtml(p.libelle)}" data-cible="${escapeHtml(p.cible)}">
                                        <td>${escapeHtml(p.libelle)}</td>
                                        <td><code>${escapeHtml(p.cible)}</code></td>
                                        <td><input type="number" min="1" class="admin-cell retention-duree" value="${p.duree_mois}"></td>
                                        <td><input type="checkbox" class="retention-actif" ${p.actif ? 'checked' : ''}></td>
                                        <td>${escapeHtml(formatDate(p.derniere_purge))}${(p.derniers_supprimes !== null && p.derniers_supprimes !== undefined) ? ' (' + p.derniers_supprimes + ')' : ''}</td>
                                        <td class="admin-actions"><button type="button" class="retention-save-btn" title="Enregistrer">💾</button></td>
                                    </tr>`;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                    <div class="admin-card admin-card-danger">
                        <h4>🧨 Purge des données périmées</h4>
                        <p class="admin-hint">Applique immédiatement toutes les durées actives ci-dessus. Le journal des connexions est purgé par Supabase lui-même et n'est pas concerné.</p>
                        <button type="button" class="btn-danger retention-purge-btn">Lancer la purge maintenant</button>
                    </div>`;

                sections.retention.querySelectorAll('.retention-save-btn').forEach(function (btn) {
                    btn.addEventListener('click', async function () {
                        const row = btn.closest('tr');
                        const res = await window.EprofStore.upsert('gdpr_retention_policies', [{
                            cle: row.dataset.cle,
                            libelle: row.dataset.libelle,
                            cible: row.dataset.cible,
                            duree_mois: parseInt(row.querySelector('.retention-duree').value, 10) || 12,
                            actif: row.querySelector('.retention-actif').checked
                        }], { onConflict: 'cle' });
                        if (res.error) return ctx.notify('❌ ' + res.error.message, true);
                        await logAction('rgpd_retention_modification', row.dataset.cle, {});
                        ctx.notify('✅ Durée de conservation mise à jour.');
                    });
                });

                sections.retention.querySelector('.retention-purge-btn').addEventListener('click', async function () {
                    if (!confirm('Lancer la purge des données au-delà des durées de conservation ? Action irréversible.')) return;
                    try {
                        const purge = await rpc('admin_run_retention_purge');
                        const detail = Object.keys(purge || {}).map(function (k) { return k + ' : ' + purge[k]; }).join(' · ');
                        ctx.notify('✅ Purge effectuée. ' + (detail || 'Rien à supprimer.'));
                        renderRetention();
                    } catch (err) {
                        ctx.notify('❌ ' + err.message, true);
                    }
                });
            }

            // ----- Journal d'audit -----
            async function renderAudit() {
                const result = await window.EprofStore.list('admin_audit_log', { orderBy: 'created_at', ascending: false });
                if (result.error) {
                    sections.audit.innerHTML = '<p class="admin-error">Erreur : ' + escapeHtml(result.error.message) + '</p>';
                    return;
                }
                const rows = result.data || [];
                sections.audit.innerHTML = `
                    <div class="admin-toolbar">
                        <input type="search" class="audit-search" placeholder="Filtrer par action, cible, auteur…">
                        <button type="button" class="btn-secondary audit-export-btn">📤 Exporter</button>
                        <span class="admin-counter">${rows.length} entrée(s)</span>
                    </div>
                    <div class="admin-table-wrap">
                        <table class="admin-table">
                            <thead><tr><th>Date</th><th>Auteur</th><th>Action</th><th>Cible</th><th>Détails</th></tr></thead>
                            <tbody class="audit-tbody"></tbody>
                        </table>
                    </div>`;

                const tbody = sections.audit.querySelector('.audit-tbody');
                function draw() {
                    const term = sections.audit.querySelector('.audit-search').value.trim().toLowerCase();
                    const visible = rows.filter(function (r) {
                        return !term || [r.actor_identifiant, r.action, r.target].join(' ').toLowerCase().includes(term);
                    });
                    tbody.innerHTML = visible.map(function (r) {
                        return `<tr>
                            <td>${escapeHtml(formatDate(r.created_at))}</td>
                            <td><code>${escapeHtml(r.actor_identifiant || '—')}</code></td>
                            <td>${escapeHtml(r.action)}</td>
                            <td>${escapeHtml(r.target || '—')}</td>
                            <td><small>${escapeHtml(JSON.stringify(r.details))}</small></td>
                        </tr>`;
                    }).join('') || '<tr><td colspan="5">Aucune entrée.</td></tr>';
                }
                draw();
                sections.audit.querySelector('.audit-search').addEventListener('input', draw);
                sections.audit.querySelector('.audit-export-btn').addEventListener('click', function () {
                    downloadJson('journal-audit-' + new Date().toISOString().slice(0, 10) + '.json', rows);
                });
            }

            const loaders = {
                droits: renderDroits,
                registre: renderRegistre,
                consentements: renderConsentements,
                retention: renderRetention,
                audit: renderAudit
            };

            root.querySelectorAll('.admin-subtab').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    root.querySelectorAll('.admin-subtab').forEach(function (b) { b.classList.toggle('admin-subtab-active', b === btn); });
                    Object.keys(sections).forEach(function (key) {
                        sections[key].style.display = key === btn.dataset.section ? 'block' : 'none';
                    });
                    loaders[btn.dataset.section]();
                });
            });

            renderDroits();
        }
    };

    // ================= ONGLET : SUPERVISION =================
    const supervisionTab = {
        id: 'supervision',
        label: '📡 Supervision',
        html: `
            <div class="admin-subtabs">
                <button type="button" class="admin-subtab admin-subtab-active" data-section="sante">Santé</button>
                <button type="button" class="admin-subtab" data-section="logs">Logs applicatifs</button>
                <button type="button" class="admin-subtab" data-section="connexions">Journal des connexions</button>
                <button type="button" class="admin-subtab" data-section="jobs">Jobs & sauvegardes</button>
            </div>
            <div class="admin-section" data-section="sante"></div>
            <div class="admin-section" data-section="logs" style="display:none;"></div>
            <div class="admin-section" data-section="connexions" style="display:none;"></div>
            <div class="admin-section" data-section="jobs" style="display:none;"></div>`,

        init: function (root, ctx) {
            const sections = {};
            root.querySelectorAll('.admin-section').forEach(function (el) { sections[el.dataset.section] = el; });

            function statLine(label, value) {
                return `<div class="admin-stat"><span class="admin-stat-value">${escapeHtml(value)}</span><span class="admin-stat-label">${escapeHtml(label)}</span></div>`;
            }

            async function pingSupabase() {
                const t0 = performance.now();
                try {
                    await rpc('is_admin');
                    return { ok: true, latence: Math.round(performance.now() - t0) };
                } catch (err) {
                    return { ok: false, latence: Math.round(performance.now() - t0), message: err.message };
                }
            }

            async function pingConfigEndpoint() {
                const t0 = performance.now();
                try {
                    const response = await fetch('/api/config?ping=' + Date.now(), { cache: 'no-store' });
                    const config = await response.json();
                    return {
                        ok: response.ok && !!config.supabaseUrl,
                        latence: Math.round(performance.now() - t0),
                        message: config.supabaseUrl ? 'configuration servie' : 'variables d\'environnement vides'
                    };
                } catch (err) {
                    return { ok: false, latence: Math.round(performance.now() - t0), message: err.message };
                }
            }

            function integrationRow(nom, etat) {
                return `<tr>
                    <td>${escapeHtml(nom)}</td>
                    <td>${etat.ok ? '<span class="admin-badge admin-badge-on">Opérationnel</span>' : '<span class="admin-badge admin-badge-off">En échec</span>'}</td>
                    <td>${etat.latence !== undefined ? etat.latence + ' ms' : '—'}</td>
                    <td><small>${escapeHtml(etat.message || '')}</small></td>
                </tr>`;
            }

            async function renderSante() {
                sections.sante.innerHTML = '<p class="admin-hint">Analyse en cours…</p>';
                let stats;
                try {
                    stats = await rpc('admin_platform_stats');
                } catch (err) {
                    sections.sante.innerHTML = '<p class="admin-error">Erreur : ' + escapeHtml(err.message) + '</p>';
                    return;
                }

                const supabase = await pingSupabase();
                const vercel = await pingConfigEndpoint();
                const mail = { ok: false, message: 'aucun SMTP dédié configuré (Supabase Auth par défaut)' };

                sections.sante.innerHTML = `
                    <div class="admin-stats-grid">
                        ${statLine('comptes', stats.comptes.total)}
                        ${statLine('actifs (30 j)', stats.comptes.actifs_30j)}
                        ${statLine('jamais connectés', stats.comptes.jamais_connectes)}
                        ${statLine('identifiants libres', stats.liste_blanche.total - stats.liste_blanche.inscrits)}
                        ${statLine('erreurs (24 h)', stats.erreurs.dernieres_24h)}
                        ${statLine('taille base', stats.base.taille)}
                    </div>

                    <div class="admin-card">
                        <h4>🔌 Statut des intégrations</h4>
                        <div class="admin-table-wrap">
                            <table class="admin-table">
                                <thead><tr><th>Service</th><th>État</th><th>Latence</th><th>Détail</th></tr></thead>
                                <tbody>
                                    ${integrationRow('Supabase (base + auth)', supabase)}
                                    ${integrationRow('Vercel /api/config', vercel)}
                                    ${integrationRow('Envoi d\'emails', mail)}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div class="admin-card">
                        <h4>📊 Volumétrie des données</h4>
                        <div class="admin-table-wrap">
                            <table class="admin-table">
                                <tbody>
                                    ${Object.keys(stats.donnees).map(function (k) {
                                        return `<tr><td>${escapeHtml(k.replace(/_/g, ' '))}</td><td><strong>${stats.donnees[k]}</strong></td></tr>`;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                        <p class="admin-hint">Dernière sauvegarde : ${escapeHtml(formatDate(stats.jobs.derniere_sauvegarde))} · dernière purge RGPD : ${escapeHtml(formatDate(stats.jobs.derniere_purge))}</p>
                    </div>

                    <button type="button" class="btn-secondary sante-refresh-btn">🔄 Rafraîchir</button>`;

                sections.sante.querySelector('.sante-refresh-btn').addEventListener('click', renderSante);
            }

            async function renderLogs() {
                const result = await window.EprofStore.list('app_logs', { orderBy: 'created_at', ascending: false });
                if (result.error) {
                    sections.logs.innerHTML = '<p class="admin-error">Erreur : ' + escapeHtml(result.error.message) + '</p>';
                    return;
                }
                const rows = result.data || [];
                sections.logs.innerHTML = `
                    <div class="admin-toolbar">
                        <input type="search" class="logs-search" placeholder="Filtrer par message, module, utilisateur…">
                        <select class="logs-level">
                            <option value="">Tous niveaux</option>
                            <option value="error">Erreurs</option>
                            <option value="warn">Avertissements</option>
                            <option value="info">Infos</option>
                        </select>
                        <input type="date" class="logs-depuis" title="Depuis le">
                        <button type="button" class="btn-secondary logs-export-btn">📤 Exporter</button>
                        <button type="button" class="btn-danger logs-clear-btn">🗑️ Vider</button>
                    </div>
                    <span class="admin-counter logs-counter"></span>
                    <div class="admin-table-wrap">
                        <table class="admin-table">
                            <thead><tr><th>Date</th><th>Niveau</th><th>Module</th><th>Utilisateur</th><th>Message</th><th>Page</th></tr></thead>
                            <tbody class="logs-tbody"></tbody>
                        </table>
                    </div>`;

                const tbody = sections.logs.querySelector('.logs-tbody');
                function draw() {
                    const term = sections.logs.querySelector('.logs-search').value.trim().toLowerCase();
                    const level = sections.logs.querySelector('.logs-level').value;
                    const depuis = sections.logs.querySelector('.logs-depuis').value;
                    const visible = rows.filter(function (r) {
                        if (level && r.level !== level) return false;
                        if (depuis && new Date(r.created_at) < new Date(depuis)) return false;
                        return !term || [r.message, r.module, r.identifiant].join(' ').toLowerCase().includes(term);
                    });
                    sections.logs.querySelector('.logs-counter').textContent = visible.length + ' / ' + rows.length + ' entrée(s)';
                    tbody.innerHTML = visible.slice(0, 300).map(function (r) {
                        return `<tr>
                            <td>${escapeHtml(formatDate(r.created_at))}</td>
                            <td><span class="admin-badge admin-badge-${escapeHtml(r.level)}">${escapeHtml(r.level)}</span></td>
                            <td><code>${escapeHtml(r.module || '—')}</code></td>
                            <td>${escapeHtml(r.identifiant || '—')}</td>
                            <td><small>${escapeHtml(r.message)}</small></td>
                            <td><small>${escapeHtml(r.url || '')}</small></td>
                        </tr>`;
                    }).join('') || '<tr><td colspan="6">Aucun log.</td></tr>';
                }
                draw();
                ['.logs-search', '.logs-level', '.logs-depuis'].forEach(function (sel) {
                    sections.logs.querySelector(sel).addEventListener('input', draw);
                });
                sections.logs.querySelector('.logs-export-btn').addEventListener('click', function () {
                    downloadJson('logs-eprof-' + new Date().toISOString().slice(0, 10) + '.json', rows);
                });
                sections.logs.querySelector('.logs-clear-btn').addEventListener('click', async function () {
                    if (!confirm('Supprimer définitivement tous les logs applicatifs ?')) return;
                    const client = await getClient();
                    const { error } = await client.from('app_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                    if (error) return ctx.notify('❌ ' + error.message, true);
                    await logAction('logs_vides', null, { supprimes: rows.length });
                    renderLogs();
                });
            }

            async function renderConnexions() {
                sections.connexions.innerHTML = '<p class="admin-hint">Chargement…</p>';
                let events;
                try {
                    events = await rpc('admin_list_auth_events', { p_limit: 500 });
                } catch (err) {
                    sections.connexions.innerHTML = '<p class="admin-error">Erreur : ' + escapeHtml(err.message) + '</p>';
                    return;
                }
                sections.connexions.innerHTML = `
                    <p class="admin-hint">Journal fourni par Supabase Auth (connexions, déconnexions, échecs, changements de mot de passe). Sa durée de conservation est gérée par Supabase.</p>
                    <div class="admin-toolbar">
                        <input type="search" class="conn-search" placeholder="Filtrer par action, utilisateur, IP…">
                        <button type="button" class="btn-secondary conn-export-btn">📤 Exporter</button>
                        <span class="admin-counter">${events.length} évènement(s)</span>
                    </div>
                    <div class="admin-table-wrap">
                        <table class="admin-table">
                            <thead><tr><th>Date</th><th>Action</th><th>Utilisateur</th><th>Adresse IP</th></tr></thead>
                            <tbody class="conn-tbody"></tbody>
                        </table>
                    </div>`;

                const tbody = sections.connexions.querySelector('.conn-tbody');
                function draw() {
                    const term = sections.connexions.querySelector('.conn-search').value.trim().toLowerCase();
                    const visible = events.filter(function (e) {
                        return !term || [e.action, e.acteur, e.ip].join(' ').toLowerCase().includes(term);
                    });
                    tbody.innerHTML = visible.map(function (e) {
                        return `<tr>
                            <td>${escapeHtml(formatDate(e.created_at))}</td>
                            <td>${escapeHtml(e.action || '—')}</td>
                            <td>${escapeHtml(e.acteur || '—')}</td>
                            <td><code>${escapeHtml(e.ip || '—')}</code></td>
                        </tr>`;
                    }).join('') || '<tr><td colspan="4">Aucun évènement.</td></tr>';
                }
                draw();
                sections.connexions.querySelector('.conn-search').addEventListener('input', draw);
                sections.connexions.querySelector('.conn-export-btn').addEventListener('click', function () {
                    downloadJson('connexions-eprof-' + new Date().toISOString().slice(0, 10) + '.json', events);
                });
            }

            async function renderJobs() {
                const result = await window.EprofStore.list('platform_jobs', { orderBy: 'started_at', ascending: false });
                const rows = (result.data || []);
                sections.jobs.innerHTML = `
                    <div class="admin-card">
                        <h4>💾 Sauvegarde globale</h4>
                        <p class="admin-hint">Export JSON de l'intégralité de la base (tous les enseignants, toutes les données). À conserver hors ligne : c'est le seul filet de sécurité avant une suppression ou une purge.</p>
                        <button type="button" class="btn-primary backup-run-btn">Générer et télécharger la sauvegarde</button>
                    </div>
                    <div class="admin-toolbar">
                        <span class="admin-counter">${rows.length} job(s) enregistré(s)</span>
                    </div>
                    <div class="admin-table-wrap">
                        <table class="admin-table">
                            <thead><tr><th>Date</th><th>Type</th><th>Statut</th><th>Déclenché par</th><th>Détails</th></tr></thead>
                            <tbody>
                                ${rows.map(function (j) {
                                    return `<tr>
                                        <td>${escapeHtml(formatDate(j.started_at))}</td>
                                        <td>${escapeHtml(j.job_type)}</td>
                                        <td>${j.statut === 'succes' ? '<span class="admin-badge admin-badge-on">succès</span>' : '<span class="admin-badge admin-badge-off">' + escapeHtml(j.statut) + '</span>'}</td>
                                        <td><code>${escapeHtml(j.declenche_par || '—')}</code></td>
                                        <td><small>${escapeHtml(JSON.stringify(j.details))}</small></td>
                                    </tr>`;
                                }).join('') || '<tr><td colspan="5">Aucun job enregistré.</td></tr>'}
                            </tbody>
                        </table>
                    </div>`;

                sections.jobs.querySelector('.backup-run-btn').addEventListener('click', async function (e) {
                    e.target.disabled = true;
                    e.target.textContent = 'Sauvegarde en cours…';
                    try {
                        const backup = await rpc('admin_full_backup');
                        downloadJson('sauvegarde-eprof-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.json', backup);
                        ctx.notify('✅ Sauvegarde générée et téléchargée.');
                        renderJobs();
                    } catch (err) {
                        ctx.notify('❌ ' + err.message, true);
                        e.target.disabled = false;
                        e.target.textContent = 'Générer et télécharger la sauvegarde';
                    }
                });
            }

            const loaders = {
                sante: renderSante,
                logs: renderLogs,
                connexions: renderConnexions,
                jobs: renderJobs
            };

            root.querySelectorAll('.admin-subtab').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    root.querySelectorAll('.admin-subtab').forEach(function (b) { b.classList.toggle('admin-subtab-active', b === btn); });
                    Object.keys(sections).forEach(function (key) {
                        sections[key].style.display = key === btn.dataset.section ? 'block' : 'none';
                    });
                    loaders[btn.dataset.section]();
                });
            });

            renderSante();
        }
    };

    // ================= ONGLET : COMMUNICATION =================
    const communicationTab = {
        id: 'communication',
        label: '📢 Communication',
        html: `
            <div class="admin-subtabs">
                <button type="button" class="admin-subtab admin-subtab-active" data-section="diffuser">Diffuser une annonce</button>
                <button type="button" class="admin-subtab" data-section="historique">Historique des envois</button>
                <button type="button" class="admin-subtab" data-section="modeles">Modèles</button>
                <button type="button" class="admin-subtab" data-section="moderation">Modération</button>
            </div>
            <div class="admin-section" data-section="diffuser"></div>
            <div class="admin-section" data-section="historique" style="display:none;"></div>
            <div class="admin-section" data-section="modeles" style="display:none;"></div>
            <div class="admin-section" data-section="moderation" style="display:none;"></div>`,

        init: function (root, ctx) {
            const sections = {};
            root.querySelectorAll('.admin-section').forEach(function (el) { sections[el.dataset.section] = el; });

            // ----- Diffuser -----
            async function renderDiffuser(prefill) {
                const templatesRes = await window.EprofStore.list('notification_templates', { orderBy: 'nom' });
                const templates = templatesRes.data || [];

                sections.diffuser.innerHTML = `
                    <form class="admin-card annonce-form">
                        <label class="admin-field"><span>Partir d'un modèle</span>
                            <select class="annonce-template">
                                <option value="">— Aucun —</option>
                                ${templates.map(function (t) { return `<option value="${escapeHtml(t.id)}">${escapeHtml(t.nom)}</option>`; }).join('')}
                            </select>
                        </label>
                        <label class="admin-field"><span>Titre</span>
                            <textarea rows="1" class="annonce-titre" required>${escapeHtml(prefill && prefill.titre || '')}</textarea>
                        </label>
                        <label class="admin-field"><span>Message</span>
                            <textarea rows="5" class="annonce-message" required>${escapeHtml(prefill && prefill.corps || '')}</textarea>
                        </label>
                        <div class="admin-form-grid">
                            <label class="admin-field"><span>Niveau</span>
                                <select class="annonce-niveau">
                                    <option value="info">Information</option>
                                    <option value="important">Important</option>
                                    <option value="urgent">Urgent</option>
                                </select>
                            </label>
                            <label class="admin-field"><span>Destinataires</span>
                                <select class="annonce-cible-type">
                                    <option value="tous">Tous les enseignants</option>
                                    <option value="identifiants">Identifiants précis</option>
                                    <option value="matieres">Par matière</option>
                                </select>
                            </label>
                            <label class="admin-field annonce-cible-wrap" style="display:none;"><span>Valeurs (séparées par des virgules)</span>
                                <textarea rows="1" class="annonce-cible-valeurs" placeholder="ex : anboulord, faviolet"></textarea>
                            </label>
                            <label class="admin-field"><span>Début de diffusion</span>
                                <input type="datetime-local" class="annonce-debut">
                            </label>
                            <label class="admin-field"><span>Fin de diffusion (facultatif)</span>
                                <input type="datetime-local" class="annonce-fin">
                            </label>
                            <label class="admin-field"><span>Lien (facultatif)</span>
                                <input type="url" class="annonce-lien" placeholder="https://…">
                            </label>
                            <label class="admin-field"><span>Libellé du lien</span>
                                <input type="text" class="annonce-lien-libelle" placeholder="En savoir plus">
                            </label>
                        </div>
                        <label class="admin-inline-check"><input type="checkbox" class="annonce-epingle"> Épingler (non masquable par les enseignants)</label>
                        <div class="admin-dialog-actions">
                            <button type="submit" class="btn-primary">📢 Diffuser</button>
                        </div>
                    </form>`;

                const form = sections.diffuser.querySelector('.annonce-form');
                const cibleType = form.querySelector('.annonce-cible-type');

                if (prefill && prefill.niveau) form.querySelector('.annonce-niveau').value = prefill.niveau;

                cibleType.addEventListener('change', function () {
                    form.querySelector('.annonce-cible-wrap').style.display = cibleType.value === 'tous' ? 'none' : 'block';
                });

                form.querySelector('.annonce-template').addEventListener('change', function (e) {
                    const template = templates.find(function (t) { return t.id === e.target.value; });
                    if (!template) return;
                    form.querySelector('.annonce-titre').value = template.titre;
                    form.querySelector('.annonce-message').value = template.corps;
                    form.querySelector('.annonce-niveau').value = template.niveau;
                });

                form.addEventListener('submit', async function (e) {
                    e.preventDefault();
                    const session = await window.EprofStore.getSession();
                    const debut = form.querySelector('.annonce-debut').value;
                    const fin = form.querySelector('.annonce-fin').value;
                    const valeurs = form.querySelector('.annonce-cible-valeurs').value
                        .split(',').map(function (v) { return v.trim().toLowerCase(); }).filter(Boolean);

                    if (cibleType.value !== 'tous' && !valeurs.length) {
                        return ctx.notify('❌ Précisez au moins un destinataire.', true);
                    }

                    const res = await window.EprofStore.insert('announcements', {
                        titre: form.querySelector('.annonce-titre').value.trim(),
                        message: form.querySelector('.annonce-message').value.trim(),
                        niveau: form.querySelector('.annonce-niveau').value,
                        cible_type: cibleType.value,
                        cible_valeurs: valeurs,
                        epingle: form.querySelector('.annonce-epingle').checked,
                        date_debut: debut ? new Date(debut).toISOString() : new Date().toISOString(),
                        date_fin: fin ? new Date(fin).toISOString() : null,
                        lien_url: form.querySelector('.annonce-lien').value.trim() || null,
                        lien_libelle: form.querySelector('.annonce-lien-libelle').value.trim() || null,
                        auteur_id: session ? session.user.id : null,
                        auteur_identifiant: session && session.user.email ? session.user.email.split('@')[0] : null
                    });
                    if (res.error) return ctx.notify('❌ ' + res.error.message, true);

                    await logAction('annonce_diffusee', res.data.titre, { cible: cibleType.value, niveau: res.data.niveau });
                    ctx.notify('✅ Annonce diffusée.');
                    renderDiffuser();
                    if (window.EprofAnnonces) window.EprofAnnonces.render();
                });
            }

            // ----- Historique -----
            async function renderHistorique() {
                let stats;
                try {
                    stats = await rpc('admin_announcement_stats');
                } catch (err) {
                    sections.historique.innerHTML = '<p class="admin-error">Erreur : ' + escapeHtml(err.message) + '</p>';
                    return;
                }
                sections.historique.innerHTML = `
                    <div class="admin-toolbar">
                        <button type="button" class="btn-secondary histo-export-btn">📤 Exporter</button>
                        <span class="admin-counter">${stats.length} annonce(s)</span>
                    </div>
                    <div class="admin-table-wrap">
                        <table class="admin-table">
                            <thead><tr><th>Date</th><th>Titre</th><th>Niveau</th><th>Cible</th><th>Lectures</th><th>État</th><th>Actions</th></tr></thead>
                            <tbody>
                                ${stats.map(function (a) {
                                    const taux = a.destinataires ? Math.round((a.lectures / a.destinataires) * 100) : 0;
                                    return `<tr data-id="${escapeHtml(a.id)}">
                                        <td>${escapeHtml(formatDate(a.date_debut))}</td>
                                        <td>${escapeHtml(a.titre)}</td>
                                        <td><span class="admin-badge admin-badge-${a.niveau === 'urgent' ? 'error' : (a.niveau === 'important' ? 'warn' : 'info')}">${escapeHtml(a.niveau)}</span></td>
                                        <td><small>${escapeHtml(a.cible_type === 'tous' ? 'tous' : (a.cible_valeurs || []).join(', '))}</small></td>
                                        <td>${a.lectures} / ${a.destinataires || '?'} <small>(${taux} %)</small></td>
                                        <td>${a.actif ? '<span class="admin-badge admin-badge-on">active</span>' : '<span class="admin-badge">archivée</span>'}</td>
                                        <td class="admin-actions">
                                            <button type="button" class="histo-toggle-btn" title="${a.actif ? 'Désactiver' : 'Réactiver'}">${a.actif ? '⏸️' : '▶️'}</button>
                                            <button type="button" class="histo-delete-btn" title="Supprimer">🗑️</button>
                                        </td>
                                    </tr>`;
                                }).join('') || '<tr><td colspan="7">Aucune annonce diffusée.</td></tr>'}
                            </tbody>
                        </table>
                    </div>`;

                sections.historique.querySelector('.histo-export-btn').addEventListener('click', function () {
                    downloadJson('annonces-eprof-' + new Date().toISOString().slice(0, 10) + '.json', stats);
                });

                sections.historique.querySelectorAll('tr[data-id]').forEach(function (row) {
                    const annonce = stats.find(function (a) { return a.id === row.dataset.id; });
                    row.querySelector('.histo-toggle-btn').addEventListener('click', async function () {
                        const res = await window.EprofStore.update('announcements', row.dataset.id, { actif: !annonce.actif });
                        if (res.error) return ctx.notify('❌ ' + res.error.message, true);
                        await logAction(annonce.actif ? 'annonce_desactivee' : 'annonce_reactivee', annonce.titre, {});
                        renderHistorique();
                    });
                    row.querySelector('.histo-delete-btn').addEventListener('click', async function () {
                        if (!confirm('Supprimer définitivement cette annonce et ses accusés de lecture ?')) return;
                        const res = await window.EprofStore.remove('announcements', row.dataset.id);
                        if (res.error) return ctx.notify('❌ ' + res.error.message, true);
                        await logAction('annonce_supprimee', annonce.titre, {});
                        renderHistorique();
                    });
                });
            }

            // ----- Modèles -----
            async function renderModeles() {
                const result = await window.EprofStore.list('notification_templates', { orderBy: 'nom' });
                if (result.error) {
                    sections.modeles.innerHTML = '<p class="admin-error">Erreur : ' + escapeHtml(result.error.message) + '</p>';
                    return;
                }
                const templates = result.data || [];
                sections.modeles.innerHTML = `
                    <div class="admin-toolbar">
                        <button type="button" class="btn-primary modele-add-btn">➕ Nouveau modèle</button>
                        <span class="admin-counter">${templates.length} modèle(s)</span>
                    </div>
                    ${templates.map(function (t) {
                        return `<div class="admin-card" data-id="${escapeHtml(t.id)}">
                            <label class="admin-field"><span>Nom</span><textarea rows="1" data-key="nom">${escapeHtml(t.nom)}</textarea></label>
                            <label class="admin-field"><span>Titre</span><textarea rows="1" data-key="titre">${escapeHtml(t.titre)}</textarea></label>
                            <label class="admin-field"><span>Corps</span><textarea rows="5" data-key="corps">${escapeHtml(t.corps)}</textarea></label>
                            <label class="admin-field"><span>Aide / variables</span><textarea rows="1" data-key="description">${escapeHtml(t.description || '')}</textarea></label>
                            <div class="admin-dialog-actions">
                                <button type="button" class="btn-primary modele-save-btn">💾 Enregistrer</button>
                                <button type="button" class="btn-secondary modele-use-btn">📢 Utiliser</button>
                                <button type="button" class="btn-danger modele-delete-btn">🗑️ Supprimer</button>
                            </div>
                        </div>`;
                    }).join('') || '<p class="admin-hint">Aucun modèle.</p>'}`;

                sections.modeles.querySelector('.modele-add-btn').addEventListener('click', async function () {
                    const nom = prompt('Nom du modèle :');
                    if (!nom) return;
                    const res = await window.EprofStore.insert('notification_templates', { nom: nom, titre: nom, corps: '' });
                    if (res.error) return ctx.notify('❌ ' + res.error.message, true);
                    renderModeles();
                });

                sections.modeles.querySelectorAll('.admin-card[data-id]').forEach(function (card) {
                    const template = templates.find(function (t) { return t.id === card.dataset.id; });
                    card.querySelector('.modele-save-btn').addEventListener('click', async function () {
                        const patch = {};
                        card.querySelectorAll('textarea[data-key]').forEach(function (ta) { patch[ta.dataset.key] = ta.value; });
                        const res = await window.EprofStore.update('notification_templates', card.dataset.id, patch);
                        if (res.error) return ctx.notify('❌ ' + res.error.message, true);
                        ctx.notify('✅ Modèle enregistré.');
                    });
                    card.querySelector('.modele-use-btn').addEventListener('click', function () {
                        root.querySelector('.admin-subtab[data-section="diffuser"]').click();
                        renderDiffuser(template);
                    });
                    card.querySelector('.modele-delete-btn').addEventListener('click', async function () {
                        if (!confirm('Supprimer ce modèle ?')) return;
                        const res = await window.EprofStore.remove('notification_templates', card.dataset.id);
                        if (res.error) return ctx.notify('❌ ' + res.error.message, true);
                        renderModeles();
                    });
                });
            }

            // ----- Modération -----
            async function renderModeration() {
                const result = await window.EprofStore.list('content_reports', { orderBy: 'created_at', ascending: false });
                if (result.error) {
                    sections.moderation.innerHTML = '<p class="admin-error">Erreur : ' + escapeHtml(result.error.message) + '</p>';
                    return;
                }
                const rows = result.data || [];
                const ouverts = rows.filter(function (r) { return r.statut === 'ouvert'; });
                sections.moderation.innerHTML = `
                    <div class="admin-toolbar">
                        <select class="moderation-filtre">
                            <option value="ouvert">Signalements ouverts</option>
                            <option value="">Tous</option>
                            <option value="traite">Traités</option>
                            <option value="rejete">Rejetés</option>
                        </select>
                        <span class="admin-counter">${ouverts.length} en attente sur ${rows.length}</span>
                    </div>
                    <div class="moderation-liste"></div>`;

                const liste = sections.moderation.querySelector('.moderation-liste');
                function draw() {
                    const filtre = sections.moderation.querySelector('.moderation-filtre').value;
                    const visible = rows.filter(function (r) { return !filtre || r.statut === filtre; });
                    liste.innerHTML = visible.map(function (r) {
                        return `<div class="admin-card${r.statut === 'ouvert' ? ' admin-card-danger' : ''}" data-id="${escapeHtml(r.id)}">
                            <h4>🚩 ${escapeHtml(r.contenu_type)} — ${escapeHtml(r.motif)}</h4>
                            <p class="admin-hint">Signalé par <code>${escapeHtml(r.reporter_identifiant || '—')}</code> le ${escapeHtml(formatDate(r.created_at))} · référence <code>${escapeHtml(r.contenu_ref)}</code></p>
                            ${r.extrait ? `<p><em>${escapeHtml(r.extrait)}</em></p>` : ''}
                            <label class="admin-field"><span>Note de traitement</span><textarea rows="2" class="moderation-note">${escapeHtml(r.note_admin || '')}</textarea></label>
                            <div class="admin-dialog-actions">
                                <span class="admin-badge admin-badge-${r.statut === 'ouvert' ? 'warn' : (r.statut === 'traite' ? 'on' : 'off')}">${escapeHtml(r.statut)}</span>
                                <button type="button" class="btn-primary moderation-traite-btn">✅ Marquer traité</button>
                                <button type="button" class="btn-secondary moderation-rejete-btn">🚫 Rejeter</button>
                                <button type="button" class="btn-danger moderation-delete-btn">🗑️</button>
                            </div>
                        </div>`;
                    }).join('') || '<p class="admin-hint">Aucun signalement.</p>';

                    liste.querySelectorAll('.admin-card[data-id]').forEach(function (card) {
                        async function setStatut(statut) {
                            const res = await window.EprofStore.update('content_reports', card.dataset.id, {
                                statut: statut,
                                note_admin: card.querySelector('.moderation-note').value.trim() || null,
                                traite_at: new Date().toISOString()
                            });
                            if (res.error) return ctx.notify('❌ ' + res.error.message, true);
                            await logAction('moderation_' + statut, card.dataset.id, {});
                            renderModeration();
                        }
                        card.querySelector('.moderation-traite-btn').addEventListener('click', function () { setStatut('traite'); });
                        card.querySelector('.moderation-rejete-btn').addEventListener('click', function () { setStatut('rejete'); });
                        card.querySelector('.moderation-delete-btn').addEventListener('click', async function () {
                            if (!confirm('Supprimer ce signalement ?')) return;
                            const res = await window.EprofStore.remove('content_reports', card.dataset.id);
                            if (res.error) return ctx.notify('❌ ' + res.error.message, true);
                            renderModeration();
                        });
                    });
                }
                draw();
                sections.moderation.querySelector('.moderation-filtre').addEventListener('change', draw);
            }

            const loaders = {
                diffuser: function () { renderDiffuser(); },
                historique: renderHistorique,
                modeles: renderModeles,
                moderation: renderModeration
            };

            root.querySelectorAll('.admin-subtab').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    root.querySelectorAll('.admin-subtab').forEach(function (b) { b.classList.toggle('admin-subtab-active', b === btn); });
                    Object.keys(sections).forEach(function (key) {
                        sections[key].style.display = key === btn.dataset.section ? 'block' : 'none';
                    });
                    loaders[btn.dataset.section]();
                });
            });

            renderDiffuser();
        }
    };

    // ================= ONGLET : PÉDAGOGIE =================
    const pedagogieTab = {
        id: 'pedagogie',
        label: '🎓 Pédagogie',
        html: `
            <div class="admin-subtabs">
                <button type="button" class="admin-subtab admin-subtab-active" data-section="classes">Classes & périodes</button>
                <button type="button" class="admin-subtab" data-section="matieres">Matières</button>
                <button type="button" class="admin-subtab" data-section="affectations">Affectations</button>
                <button type="button" class="admin-subtab" data-section="competences">Compétences</button>
                <button type="button" class="admin-subtab" data-section="modeles-eval">Modèles d'évaluation</button>
            </div>
            <div class="admin-section" data-section="classes"></div>
            <div class="admin-section" data-section="matieres" style="display:none;"></div>
            <div class="admin-section" data-section="affectations" style="display:none;"></div>
            <div class="admin-section" data-section="competences" style="display:none;"></div>
            <div class="admin-section" data-section="modeles-eval" style="display:none;"></div>`,

        init: function (root, ctx) {
            const sections = {};
            root.querySelectorAll('.admin-section').forEach(function (el) { sections[el.dataset.section] = el; });

            function invalidateReferentiel() {
                if (window.EprofReferentiel) window.EprofReferentiel.load(true);
            }

            // ----- Classes & périodes -----
            async function renderClasses() {
                const result = await window.EprofStore.list('school_classes', { orderBy: 'ordre' });
                if (result.error) {
                    sections.classes.innerHTML = '<p class="admin-error">Erreur : ' + escapeHtml(result.error.message) + '</p>';
                    return;
                }
                const classes = result.data || [];
                sections.classes.innerHTML = `
                    <form class="admin-add-form classe-add-form">
                        <input type="text" class="classe-nom" placeholder="Nom (ex : 2nde SAPAT D)" required>
                        <input type="text" class="classe-niveau" placeholder="Niveau (2nde)">
                        <input type="text" class="classe-filiere" placeholder="Filière (SAPAT)">
                        <select class="classe-periode">
                            <option value="trimestre">Trimestres</option>
                            <option value="semestre">Semestres</option>
                        </select>
                        <button type="submit" class="btn-primary">➕ Ajouter</button>
                    </form>
                    <p class="admin-hint">Le type de période détermine les onglets Trimestre/Semestre du carnet de notes pour tous les enseignants de la classe.</p>
                    <div class="admin-table-wrap">
                        <table class="admin-table">
                            <thead><tr><th>Nom</th><th>Niveau</th><th>Filière</th><th>Périodes</th><th>Nb</th><th>Ordre</th><th>Active</th><th></th></tr></thead>
                            <tbody>
                                ${classes.map(function (c) {
                                    return `<tr data-id="${escapeHtml(c.id)}">
                                        <td><input type="text" class="admin-cell c-nom" value="${escapeHtml(c.nom)}"></td>
                                        <td><input type="text" class="admin-cell c-niveau" value="${escapeHtml(c.niveau || '')}"></td>
                                        <td><input type="text" class="admin-cell c-filiere" value="${escapeHtml(c.filiere || '')}"></td>
                                        <td><select class="admin-cell c-periode">
                                            <option value="trimestre"${c.periode_type === 'trimestre' ? ' selected' : ''}>Trimestres</option>
                                            <option value="semestre"${c.periode_type === 'semestre' ? ' selected' : ''}>Semestres</option>
                                        </select></td>
                                        <td><input type="number" min="1" max="6" class="admin-cell c-nb" value="${c.nb_periodes}"></td>
                                        <td><input type="number" class="admin-cell c-ordre" value="${c.ordre}"></td>
                                        <td><input type="checkbox" class="c-actif" ${c.actif ? 'checked' : ''}></td>
                                        <td class="admin-actions">
                                            <button type="button" class="classe-save-btn" title="Enregistrer">💾</button>
                                            <button type="button" class="classe-delete-btn" title="Supprimer">🗑️</button>
                                        </td>
                                    </tr>`;
                                }).join('') || '<tr><td colspan="8">Aucune classe.</td></tr>'}
                            </tbody>
                        </table>
                    </div>`;

                sections.classes.querySelector('.classe-add-form').addEventListener('submit', async function (e) {
                    e.preventDefault();
                    const periode = sections.classes.querySelector('.classe-periode').value;
                    const res = await window.EprofStore.insert('school_classes', {
                        nom: sections.classes.querySelector('.classe-nom').value.trim(),
                        niveau: sections.classes.querySelector('.classe-niveau').value.trim() || null,
                        filiere: sections.classes.querySelector('.classe-filiere').value.trim() || null,
                        periode_type: periode,
                        nb_periodes: periode === 'semestre' ? 2 : 3,
                        ordre: classes.length + 1
                    });
                    if (res.error) return ctx.notify('❌ ' + res.error.message, true);
                    await logAction('classe_ajoutee', res.data.nom, {});
                    invalidateReferentiel();
                    renderClasses();
                });

                sections.classes.querySelectorAll('tr[data-id]').forEach(function (row) {
                    row.querySelector('.classe-save-btn').addEventListener('click', async function () {
                        const res = await window.EprofStore.update('school_classes', row.dataset.id, {
                            nom: row.querySelector('.c-nom').value.trim(),
                            niveau: row.querySelector('.c-niveau').value.trim() || null,
                            filiere: row.querySelector('.c-filiere').value.trim() || null,
                            periode_type: row.querySelector('.c-periode').value,
                            nb_periodes: parseInt(row.querySelector('.c-nb').value, 10) || 3,
                            ordre: parseInt(row.querySelector('.c-ordre').value, 10) || 0,
                            actif: row.querySelector('.c-actif').checked
                        });
                        if (res.error) return ctx.notify('❌ ' + res.error.message, true);
                        await logAction('classe_modifiee', res.data.nom, {});
                        invalidateReferentiel();
                        ctx.notify('✅ Classe mise à jour.');
                    });
                    row.querySelector('.classe-delete-btn').addEventListener('click', async function () {
                        if (!confirm('Supprimer cette classe du référentiel ? Les données déjà saisies par les enseignants ne sont pas supprimées.')) return;
                        const res = await window.EprofStore.remove('school_classes', row.dataset.id);
                        if (res.error) return ctx.notify('❌ ' + res.error.message, true);
                        await logAction('classe_supprimee', row.dataset.id, {});
                        invalidateReferentiel();
                        renderClasses();
                    });
                });
            }

            // ----- Matières -----
            async function renderMatieres() {
                const result = await window.EprofStore.list('school_subjects', { orderBy: 'ordre' });
                if (result.error) {
                    sections.matieres.innerHTML = '<p class="admin-error">Erreur : ' + escapeHtml(result.error.message) + '</p>';
                    return;
                }
                const matieres = result.data || [];
                sections.matieres.innerHTML = `
                    <form class="admin-add-form matiere-add-form">
                        <input type="text" class="matiere-nom" placeholder="Nom de la matière" required>
                        <button type="submit" class="btn-primary">➕ Ajouter</button>
                    </form>
                    <div class="admin-table-wrap">
                        <table class="admin-table">
                            <thead><tr><th>Matière</th><th>Ordre</th><th>Active</th><th></th></tr></thead>
                            <tbody>
                                ${matieres.map(function (m) {
                                    return `<tr data-id="${escapeHtml(m.id)}">
                                        <td><input type="text" class="admin-cell m-nom" value="${escapeHtml(m.nom)}"></td>
                                        <td><input type="number" class="admin-cell m-ordre" value="${m.ordre}"></td>
                                        <td><input type="checkbox" class="m-actif" ${m.actif ? 'checked' : ''}></td>
                                        <td class="admin-actions">
                                            <button type="button" class="matiere-save-btn" title="Enregistrer">💾</button>
                                            <button type="button" class="matiere-delete-btn" title="Supprimer">🗑️</button>
                                        </td>
                                    </tr>`;
                                }).join('') || '<tr><td colspan="4">Aucune matière.</td></tr>'}
                            </tbody>
                        </table>
                    </div>`;

                sections.matieres.querySelector('.matiere-add-form').addEventListener('submit', async function (e) {
                    e.preventDefault();
                    const res = await window.EprofStore.insert('school_subjects', {
                        nom: sections.matieres.querySelector('.matiere-nom').value.trim(),
                        ordre: matieres.length + 1
                    });
                    if (res.error) return ctx.notify('❌ ' + res.error.message, true);
                    await logAction('matiere_ajoutee', res.data.nom, {});
                    invalidateReferentiel();
                    renderMatieres();
                });

                sections.matieres.querySelectorAll('tr[data-id]').forEach(function (row) {
                    row.querySelector('.matiere-save-btn').addEventListener('click', async function () {
                        const res = await window.EprofStore.update('school_subjects', row.dataset.id, {
                            nom: row.querySelector('.m-nom').value.trim(),
                            ordre: parseInt(row.querySelector('.m-ordre').value, 10) || 0,
                            actif: row.querySelector('.m-actif').checked
                        });
                        if (res.error) return ctx.notify('❌ ' + res.error.message, true);
                        invalidateReferentiel();
                        ctx.notify('✅ Matière mise à jour.');
                    });
                    row.querySelector('.matiere-delete-btn').addEventListener('click', async function () {
                        if (!confirm('Supprimer cette matière du référentiel ?')) return;
                        const res = await window.EprofStore.remove('school_subjects', row.dataset.id);
                        if (res.error) return ctx.notify('❌ ' + res.error.message, true);
                        invalidateReferentiel();
                        renderMatieres();
                    });
                });
            }

            // ----- Affectations -----
            async function renderAffectations() {
                const [assignRes, classesRes, matieresRes, whitelistRes] = await Promise.all([
                    window.EprofStore.list('teacher_assignments', { orderBy: 'identifiant' }),
                    window.EprofStore.list('school_classes', { orderBy: 'ordre' }),
                    window.EprofStore.list('school_subjects', { orderBy: 'ordre' }),
                    window.EprofStore.list('allowed_teachers', { orderBy: 'identifiant' })
                ]);
                if (assignRes.error) {
                    sections.affectations.innerHTML = '<p class="admin-error">Erreur : ' + escapeHtml(assignRes.error.message) + '</p>';
                    return;
                }
                const affectations = assignRes.data || [];
                const classes = (classesRes.data || []).filter(function (c) { return c.actif; });
                const matieres = (matieresRes.data || []).filter(function (m) { return m.actif; });
                const profs = whitelistRes.data || [];

                sections.affectations.innerHTML = `
                    <form class="admin-add-form affect-add-form">
                        <select class="affect-prof" required>
                            <option value="">— Enseignant —</option>
                            ${profs.map(function (p) { return `<option value="${escapeHtml(p.identifiant)}">${escapeHtml(p.identifiant)} — ${escapeHtml(((p.prenom || '') + ' ' + (p.nom || '')).trim())}</option>`; }).join('')}
                        </select>
                        <select class="affect-classe" required>
                            <option value="">— Classe —</option>
                            ${classes.map(function (c) { return `<option value="${escapeHtml(c.nom)}">${escapeHtml(c.nom)}</option>`; }).join('')}
                        </select>
                        <select class="affect-matiere" required>
                            <option value="">— Matière —</option>
                            ${matieres.map(function (m) { return `<option value="${escapeHtml(m.nom)}">${escapeHtml(m.nom)}</option>`; }).join('')}
                        </select>
                        <button type="submit" class="btn-primary">➕ Affecter</button>
                    </form>
                    <div class="admin-toolbar">
                        <input type="search" class="affect-search" placeholder="Filtrer par enseignant, classe, matière…">
                        <button type="button" class="btn-secondary affect-export-btn">📤 Exporter « qui enseigne quoi »</button>
                        <span class="admin-counter">${affectations.length} affectation(s)</span>
                    </div>
                    <div class="admin-table-wrap">
                        <table class="admin-table">
                            <thead><tr><th>Enseignant</th><th>Classe</th><th>Matière</th><th></th></tr></thead>
                            <tbody class="affect-tbody"></tbody>
                        </table>
                    </div>`;

                const tbody = sections.affectations.querySelector('.affect-tbody');
                function draw() {
                    const term = sections.affectations.querySelector('.affect-search').value.trim().toLowerCase();
                    const visible = affectations.filter(function (a) {
                        return !term || [a.identifiant, a.classe, a.matiere].join(' ').toLowerCase().includes(term);
                    });
                    tbody.innerHTML = visible.map(function (a) {
                        return `<tr data-id="${escapeHtml(a.id)}">
                            <td><code>${escapeHtml(a.identifiant)}</code></td>
                            <td>${escapeHtml(a.classe)}</td>
                            <td>${escapeHtml(a.matiere)}</td>
                            <td class="admin-actions"><button type="button" class="affect-delete-btn" title="Retirer">🗑️</button></td>
                        </tr>`;
                    }).join('') || '<tr><td colspan="4">Aucune affectation.</td></tr>';
                }
                draw();
                sections.affectations.querySelector('.affect-search').addEventListener('input', draw);

                sections.affectations.querySelector('.affect-export-btn').addEventListener('click', async function () {
                    try {
                        const overview = await rpc('admin_teaching_overview');
                        downloadJson('qui-enseigne-quoi-' + new Date().toISOString().slice(0, 10) + '.json', overview);
                    } catch (err) {
                        ctx.notify('❌ ' + err.message, true);
                    }
                });

                sections.affectations.querySelector('.affect-add-form').addEventListener('submit', async function (e) {
                    e.preventDefault();
                    const res = await window.EprofStore.upsert('teacher_assignments', [{
                        identifiant: sections.affectations.querySelector('.affect-prof').value,
                        classe: sections.affectations.querySelector('.affect-classe').value,
                        matiere: sections.affectations.querySelector('.affect-matiere').value
                    }], { onConflict: 'identifiant,classe,matiere,annee_scolaire' });
                    if (res.error) return ctx.notify('❌ ' + res.error.message, true);
                    await logAction('affectation_ajoutee', sections.affectations.querySelector('.affect-prof').value, {});
                    renderAffectations();
                });

                tbody.addEventListener('click', async function (e) {
                    if (!e.target.classList.contains('affect-delete-btn')) return;
                    const id = e.target.closest('tr').dataset.id;
                    const res = await window.EprofStore.remove('teacher_assignments', id);
                    if (res.error) return ctx.notify('❌ ' + res.error.message, true);
                    await logAction('affectation_supprimee', id, {});
                    renderAffectations();
                });
            }

            // ----- Compétences -----
            async function renderCompetences() {
                const [fwRes, compRes] = await Promise.all([
                    window.EprofStore.list('competency_frameworks', { orderBy: 'nom' }),
                    window.EprofStore.list('competencies', { orderBy: 'ordre' })
                ]);
                if (fwRes.error) {
                    sections.competences.innerHTML = '<p class="admin-error">Erreur : ' + escapeHtml(fwRes.error.message) + '</p>';
                    return;
                }
                const frameworks = fwRes.data || [];
                const competences = compRes.data || [];

                sections.competences.innerHTML = `
                    <div class="admin-toolbar">
                        <button type="button" class="btn-primary fw-add-btn">➕ Nouveau référentiel</button>
                        <span class="admin-counter">${frameworks.length} référentiel(s) · ${competences.length} compétence(s)</span>
                    </div>
                    ${frameworks.map(function (f) {
                        const items = competences.filter(function (c) { return c.framework_id === f.id; });
                        return `<div class="admin-card" data-fw="${escapeHtml(f.id)}">
                            <div class="admin-form-grid">
                                <label class="admin-field"><span>Nom</span><input type="text" class="fw-nom" value="${escapeHtml(f.nom)}"></label>
                                <label class="admin-field"><span>Matière</span><input type="text" class="fw-matiere" value="${escapeHtml(f.matiere || '')}"></label>
                                <label class="admin-field"><span>Niveau</span><input type="text" class="fw-niveau" value="${escapeHtml(f.niveau || '')}"></label>
                            </div>
                            <div class="admin-table-wrap">
                                <table class="admin-table">
                                    <thead><tr><th>Code</th><th>Libellé</th><th>Ordre</th><th></th></tr></thead>
                                    <tbody>
                                        ${items.map(function (c) {
                                            return `<tr data-comp="${escapeHtml(c.id)}">
                                                <td><input type="text" class="admin-cell comp-code" value="${escapeHtml(c.code || '')}"></td>
                                                <td><input type="text" class="admin-cell comp-libelle" value="${escapeHtml(c.libelle)}"></td>
                                                <td><input type="number" class="admin-cell comp-ordre" value="${c.ordre}"></td>
                                                <td class="admin-actions">
                                                    <button type="button" class="comp-save-btn" title="Enregistrer">💾</button>
                                                    <button type="button" class="comp-delete-btn" title="Supprimer">🗑️</button>
                                                </td>
                                            </tr>`;
                                        }).join('') || '<tr><td colspan="4">Aucune compétence.</td></tr>'}
                                    </tbody>
                                </table>
                            </div>
                            <div class="admin-dialog-actions">
                                <button type="button" class="btn-primary fw-save-btn">💾 Enregistrer le référentiel</button>
                                <button type="button" class="btn-secondary comp-add-btn">➕ Ajouter une compétence</button>
                                <button type="button" class="btn-danger fw-delete-btn">🗑️ Supprimer le référentiel</button>
                            </div>
                        </div>`;
                    }).join('') || '<p class="admin-hint">Aucun référentiel de compétences.</p>'}`;

                sections.competences.querySelector('.fw-add-btn').addEventListener('click', async function () {
                    const nom = prompt('Nom du référentiel :');
                    if (!nom) return;
                    const res = await window.EprofStore.insert('competency_frameworks', { nom: nom });
                    if (res.error) return ctx.notify('❌ ' + res.error.message, true);
                    renderCompetences();
                });

                sections.competences.querySelectorAll('.admin-card[data-fw]').forEach(function (card) {
                    const fwId = card.dataset.fw;
                    card.querySelector('.fw-save-btn').addEventListener('click', async function () {
                        const res = await window.EprofStore.update('competency_frameworks', fwId, {
                            nom: card.querySelector('.fw-nom').value.trim(),
                            matiere: card.querySelector('.fw-matiere').value.trim() || null,
                            niveau: card.querySelector('.fw-niveau').value.trim() || null
                        });
                        if (res.error) return ctx.notify('❌ ' + res.error.message, true);
                        ctx.notify('✅ Référentiel enregistré.');
                    });
                    card.querySelector('.comp-add-btn').addEventListener('click', async function () {
                        const libelle = prompt('Libellé de la compétence :');
                        if (!libelle) return;
                        const res = await window.EprofStore.insert('competencies', { framework_id: fwId, libelle: libelle });
                        if (res.error) return ctx.notify('❌ ' + res.error.message, true);
                        renderCompetences();
                    });
                    card.querySelector('.fw-delete-btn').addEventListener('click', async function () {
                        if (!confirm('Supprimer ce référentiel et toutes ses compétences ?')) return;
                        const res = await window.EprofStore.remove('competency_frameworks', fwId);
                        if (res.error) return ctx.notify('❌ ' + res.error.message, true);
                        renderCompetences();
                    });
                    card.querySelectorAll('tr[data-comp]').forEach(function (row) {
                        row.querySelector('.comp-save-btn').addEventListener('click', async function () {
                            const res = await window.EprofStore.update('competencies', row.dataset.comp, {
                                code: row.querySelector('.comp-code').value.trim() || null,
                                libelle: row.querySelector('.comp-libelle').value.trim(),
                                ordre: parseInt(row.querySelector('.comp-ordre').value, 10) || 0
                            });
                            if (res.error) return ctx.notify('❌ ' + res.error.message, true);
                            ctx.notify('✅ Compétence enregistrée.');
                        });
                        row.querySelector('.comp-delete-btn').addEventListener('click', async function () {
                            if (!confirm('Supprimer cette compétence ?')) return;
                            const res = await window.EprofStore.remove('competencies', row.dataset.comp);
                            if (res.error) return ctx.notify('❌ ' + res.error.message, true);
                            renderCompetences();
                        });
                    });
                });
            }

            // ----- Modèles d'évaluation -----
            async function renderModelesEval() {
                const result = await window.EprofStore.list('evaluation_templates', { orderBy: 'nom' });
                if (result.error) {
                    sections['modeles-eval'].innerHTML = '<p class="admin-error">Erreur : ' + escapeHtml(result.error.message) + '</p>';
                    return;
                }
                const modeles = result.data || [];
                sections['modeles-eval'].innerHTML = `
                    <form class="admin-add-form modeval-add-form">
                        <input type="text" class="modeval-nom" placeholder="Nom du modèle" required>
                        <input type="number" step="0.5" class="modeval-bareme" placeholder="Barème" value="20">
                        <input type="number" step="0.5" class="modeval-coef" placeholder="Coefficient" value="1">
                        <button type="submit" class="btn-primary">➕ Ajouter</button>
                    </form>
                    <p class="admin-hint">Ces modèles sont proposés à tous les enseignants lors de la création d'une évaluation.</p>
                    <div class="admin-table-wrap">
                        <table class="admin-table">
                            <thead><tr><th>Nom</th><th>Type</th><th>Matière</th><th>Barème</th><th>Coef.</th><th>Durée</th><th>Actif</th><th></th></tr></thead>
                            <tbody>
                                ${modeles.map(function (m) {
                                    return `<tr data-id="${escapeHtml(m.id)}">
                                        <td><input type="text" class="admin-cell e-nom" value="${escapeHtml(m.nom)}"></td>
                                        <td><input type="text" class="admin-cell e-type" value="${escapeHtml(m.type_evaluation)}"></td>
                                        <td><input type="text" class="admin-cell e-matiere" value="${escapeHtml(m.matiere || '')}"></td>
                                        <td><input type="number" step="0.5" class="admin-cell e-bareme" value="${m.bareme}"></td>
                                        <td><input type="number" step="0.5" class="admin-cell e-coef" value="${m.coefficient}"></td>
                                        <td><input type="number" class="admin-cell e-duree" value="${m.duree_minutes || ''}"></td>
                                        <td><input type="checkbox" class="e-actif" ${m.actif ? 'checked' : ''}></td>
                                        <td class="admin-actions">
                                            <button type="button" class="modeval-save-btn" title="Enregistrer">💾</button>
                                            <button type="button" class="modeval-delete-btn" title="Supprimer">🗑️</button>
                                        </td>
                                    </tr>`;
                                }).join('') || '<tr><td colspan="8">Aucun modèle.</td></tr>'}
                            </tbody>
                        </table>
                    </div>`;

                sections['modeles-eval'].querySelector('.modeval-add-form').addEventListener('submit', async function (e) {
                    e.preventDefault();
                    const res = await window.EprofStore.insert('evaluation_templates', {
                        nom: sections['modeles-eval'].querySelector('.modeval-nom').value.trim(),
                        bareme: parseFloat(sections['modeles-eval'].querySelector('.modeval-bareme').value) || 20,
                        coefficient: parseFloat(sections['modeles-eval'].querySelector('.modeval-coef').value) || 1
                    });
                    if (res.error) return ctx.notify('❌ ' + res.error.message, true);
                    await logAction('modele_evaluation_ajoute', res.data.nom, {});
                    invalidateReferentiel();
                    renderModelesEval();
                });

                sections['modeles-eval'].querySelectorAll('tr[data-id]').forEach(function (row) {
                    row.querySelector('.modeval-save-btn').addEventListener('click', async function () {
                        const duree = parseInt(row.querySelector('.e-duree').value, 10);
                        const res = await window.EprofStore.update('evaluation_templates', row.dataset.id, {
                            nom: row.querySelector('.e-nom').value.trim(),
                            type_evaluation: row.querySelector('.e-type').value.trim(),
                            matiere: row.querySelector('.e-matiere').value.trim() || null,
                            bareme: parseFloat(row.querySelector('.e-bareme').value) || 20,
                            coefficient: parseFloat(row.querySelector('.e-coef').value) || 1,
                            duree_minutes: isNaN(duree) ? null : duree,
                            actif: row.querySelector('.e-actif').checked
                        });
                        if (res.error) return ctx.notify('❌ ' + res.error.message, true);
                        invalidateReferentiel();
                        ctx.notify('✅ Modèle enregistré.');
                    });
                    row.querySelector('.modeval-delete-btn').addEventListener('click', async function () {
                        if (!confirm('Supprimer ce modèle d\'évaluation ?')) return;
                        const res = await window.EprofStore.remove('evaluation_templates', row.dataset.id);
                        if (res.error) return ctx.notify('❌ ' + res.error.message, true);
                        invalidateReferentiel();
                        renderModelesEval();
                    });
                });
            }

            const loaders = {
                classes: renderClasses,
                matieres: renderMatieres,
                affectations: renderAffectations,
                competences: renderCompetences,
                'modeles-eval': renderModelesEval
            };

            root.querySelectorAll('.admin-subtab').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    root.querySelectorAll('.admin-subtab').forEach(function (b) { b.classList.toggle('admin-subtab-active', b === btn); });
                    Object.keys(sections).forEach(function (key) {
                        sections[key].style.display = key === btn.dataset.section ? 'block' : 'none';
                    });
                    loaders[btn.dataset.section]();
                });
            });

            renderClasses();
        }
    };

    // ================= ONGLET : SUGGESTIONS (TODOLIST) =================
    const SUGGESTION_COLONNES = [
        { statut: 'nouveau', titre: '🆕 À trier' },
        { statut: 'en_cours', titre: '🔧 En cours' },
        { statut: 'planifie', titre: '📅 Planifié' },
        { statut: 'termine', titre: '✅ Terminé' },
        { statut: 'refuse', titre: '🚫 Non retenu' }
    ];

    const SUGGESTION_TYPES = { bug: '🐞', amelioration: '✨', nouveaute: '💡', autre: '💬' };
    const SUGGESTION_PRIORITES = { basse: '', normale: '', haute: '❗', critique: '🔥' };

    const suggestionsTab = {
        id: 'suggestions',
        label: '💬 Suggestions',
        html: `
            <div class="admin-toolbar">
                <input type="search" class="sugg-search" placeholder="Filtrer par titre, auteur, module…">
                <select class="sugg-filtre-type">
                    <option value="">Tous types</option>
                    <option value="bug">🐞 Bugs</option>
                    <option value="amelioration">✨ Améliorations</option>
                    <option value="nouveaute">💡 Nouveautés</option>
                    <option value="autre">💬 Autres</option>
                </select>
                <button type="button" class="btn-secondary sugg-export-btn">📤 Exporter</button>
                <span class="admin-counter sugg-counter"></span>
            </div>
            <div class="sugg-board"></div>`,

        init: function (root, ctx) {
            const board = root.querySelector('.sugg-board');
            let items = [];

            function carteHtml(s) {
                return `<div class="sugg-card sugg-priorite-${escapeHtml(s.priorite)}" data-id="${escapeHtml(s.id)}">
                    <div class="sugg-card-title">${SUGGESTION_TYPES[s.type] || '💬'} ${SUGGESTION_PRIORITES[s.priorite] || ''} ${escapeHtml(s.titre)}</div>
                    <div class="sugg-card-meta"><code>${escapeHtml(s.auteur_identifiant || '—')}</code> · ${escapeHtml(s.module || 'Général')} · ${escapeHtml(formatDate(s.created_at))}${s.votes ? ' · 👍 ' + s.votes : ''}</div>
                    <details class="sugg-card-details">
                        <summary>Détail & traitement</summary>
                        <p class="sugg-card-desc">${escapeHtml(s.description).replace(/\n/g, '<br>')}</p>
                        <label class="admin-field"><span>Réponse à l'enseignant</span><textarea rows="2" class="sugg-reponse">${escapeHtml(s.reponse_admin || '')}</textarea></label>
                        <div class="sugg-card-actions">
                            <select class="sugg-statut">
                                ${SUGGESTION_COLONNES.map(function (c) { return `<option value="${c.statut}"${c.statut === s.statut ? ' selected' : ''}>${c.titre}</option>`; }).join('')}
                            </select>
                            <select class="sugg-priorite">
                                ${['basse', 'normale', 'haute', 'critique'].map(function (p) { return `<option value="${p}"${p === s.priorite ? ' selected' : ''}>${p}</option>`; }).join('')}
                            </select>
                            <button type="button" class="btn-primary sugg-save-btn">💾</button>
                            <button type="button" class="btn-danger sugg-delete-btn">🗑️</button>
                        </div>
                    </details>
                </div>`;
            }

            function draw() {
                const term = root.querySelector('.sugg-search').value.trim().toLowerCase();
                const type = root.querySelector('.sugg-filtre-type').value;
                const visible = items.filter(function (s) {
                    if (type && s.type !== type) return false;
                    return !term || [s.titre, s.description, s.auteur_identifiant, s.module].join(' ').toLowerCase().includes(term);
                });

                root.querySelector('.sugg-counter').textContent =
                    items.filter(function (s) { return s.statut === 'nouveau'; }).length + ' à trier sur ' + items.length;

                board.innerHTML = SUGGESTION_COLONNES.map(function (col) {
                    const cartes = visible.filter(function (s) { return s.statut === col.statut; });
                    return `<section class="sugg-colonne">
                        <h4>${col.titre} <span class="admin-badge">${cartes.length}</span></h4>
                        ${cartes.map(carteHtml).join('') || '<p class="admin-hint">—</p>'}
                    </section>`;
                }).join('');

                board.querySelectorAll('.sugg-card').forEach(function (card) {
                    card.querySelector('.sugg-save-btn').addEventListener('click', async function () {
                        const res = await window.EprofStore.update('suggestions', card.dataset.id, {
                            statut: card.querySelector('.sugg-statut').value,
                            priorite: card.querySelector('.sugg-priorite').value,
                            reponse_admin: card.querySelector('.sugg-reponse').value.trim() || null
                        });
                        if (res.error) return ctx.notify('❌ ' + res.error.message, true);
                        await logAction('suggestion_traitee', res.data.titre, { statut: res.data.statut });
                        ctx.notify('✅ Suggestion mise à jour.');
                        reload();
                    });
                    card.querySelector('.sugg-delete-btn').addEventListener('click', async function () {
                        if (!confirm('Supprimer définitivement cette demande ?')) return;
                        const res = await window.EprofStore.remove('suggestions', card.dataset.id);
                        if (res.error) return ctx.notify('❌ ' + res.error.message, true);
                        reload();
                    });
                });
            }

            async function reload() {
                try {
                    items = await rpc('admin_suggestions_board');
                } catch (err) {
                    board.innerHTML = '<p class="admin-error">Erreur : ' + escapeHtml(err.message) + '</p>';
                    return;
                }
                draw();
            }

            root.querySelector('.sugg-search').addEventListener('input', draw);
            root.querySelector('.sugg-filtre-type').addEventListener('change', draw);
            root.querySelector('.sugg-export-btn').addEventListener('click', function () {
                downloadJson('suggestions-eprof-' + new Date().toISOString().slice(0, 10) + '.json', items);
            });

            reload();
        }
    };

    // ================= ONGLET : LISTES D'ÉLÈVES =================
    const ANNEE_COURANTE = '2026-2027';

    // Import tolérant : séparateur ; ou , et entêtes optionnelles.
    function parseCsvEleves(texte, classeParDefaut) {
        const lignes = texte.split(/\r?\n/).filter(function (l) { return l.trim(); });
        if (!lignes.length) return [];

        const separateur = (lignes[0].match(/;/g) || []).length >= (lignes[0].match(/,/g) || []).length ? ';' : ',';
        const entete = lignes[0].toLowerCase();
        const aEntete = /nom/.test(entete) && /pr[ée]nom/.test(entete);

        let colNom = 0, colPrenom = 1, colSexe = 2, colClasse = 3;
        if (aEntete) {
            const cols = lignes[0].split(separateur).map(function (c) { return c.trim().toLowerCase(); });
            colNom = cols.findIndex(function (c) { return c === 'nom'; });
            colPrenom = cols.findIndex(function (c) { return c === 'prenom' || c === 'prénom'; });
            colSexe = cols.findIndex(function (c) { return c === 'sexe' || c === 'genre'; });
            colClasse = cols.findIndex(function (c) { return c === 'classe'; });
        }

        return lignes.slice(aEntete ? 1 : 0).map(function (ligne) {
            const cols = ligne.split(separateur).map(function (c) { return c.trim().replace(/^"|"$/g, ''); });
            const sexe = colSexe >= 0 ? (cols[colSexe] || '').toUpperCase().charAt(0) : '';
            return {
                nom: (cols[colNom] || '').toUpperCase(),
                prenom: cols[colPrenom] || '',
                sexe: (sexe === 'F' || sexe === 'M') ? sexe : null,
                classe: (colClasse >= 0 && cols[colClasse]) ? cols[colClasse] : classeParDefaut
            };
        }).filter(function (e) { return e.nom && e.classe; });
    }

    const elevesTab = {
        id: 'eleves',
        label: '👨‍🎓 Élèves',
        html: `
            <div class="admin-card">
                <h4>📥 Importer une liste (CSV)</h4>
                <p class="admin-hint">Colonnes attendues : <code>nom ; prenom ; sexe ; classe</code> (séparateur <code>;</code> ou <code>,</code>, entête facultative). Si le fichier ne contient pas de colonne classe, celle sélectionnée ci-dessous est utilisée. <strong>L'import remplace intégralement la liste de la classe.</strong></p>
                <div class="admin-inline-form">
                    <select class="eleves-classe-import"></select>
                    <input type="file" class="eleves-csv" accept=".csv,.txt">
                    <button type="button" class="btn-primary eleves-import-btn">Importer</button>
                </div>
                <div class="eleves-apercu"></div>
            </div>

            <form class="admin-add-form eleve-add-form">
                <input type="text" class="eleve-nom" placeholder="NOM" required>
                <input type="text" class="eleve-prenom" placeholder="Prénom" required>
                <select class="eleve-sexe">
                    <option value="">Sexe</option>
                    <option value="F">F</option>
                    <option value="M">M</option>
                </select>
                <select class="eleve-classe"></select>
                <button type="submit" class="btn-primary">➕ Ajouter</button>
            </form>

            <div class="admin-toolbar">
                <input type="search" class="eleves-search" placeholder="Rechercher un élève…">
                <select class="eleves-filtre-classe"><option value="">Toutes les classes</option></select>
                <button type="button" class="btn-secondary eleves-export-btn">📤 Exporter (CSV)</button>
                <button type="button" class="btn-danger eleves-vider-btn">🗑️ Vider la classe filtrée</button>
                <span class="admin-counter eleves-counter"></span>
            </div>
            <div class="admin-table-wrap">
                <table class="admin-table">
                    <thead><tr><th>Nom</th><th>Prénom</th><th>Sexe</th><th>Classe</th><th></th></tr></thead>
                    <tbody class="eleves-tbody"><tr><td colspan="5">Chargement…</td></tr></tbody>
                </table>
            </div>`,

        init: function (root, ctx) {
            const tbody = root.querySelector('.eleves-tbody');
            let eleves = [];
            let classes = [];

            function remplirSelectsClasses() {
                const options = classes.map(function (c) { return `<option value="${escapeHtml(c.nom)}">${escapeHtml(c.nom)}</option>`; }).join('');
                root.querySelector('.eleves-classe-import').innerHTML = options;
                root.querySelector('.eleve-classe').innerHTML = options;
                root.querySelector('.eleves-filtre-classe').innerHTML = '<option value="">Toutes les classes</option>' + options;
            }

            function draw() {
                const term = root.querySelector('.eleves-search').value.trim().toLowerCase();
                const classe = root.querySelector('.eleves-filtre-classe').value;
                const visible = eleves.filter(function (e) {
                    if (classe && e.classe !== classe) return false;
                    return !term || (e.nom + ' ' + e.prenom).toLowerCase().includes(term);
                });
                root.querySelector('.eleves-counter').textContent = visible.length + ' / ' + eleves.length + ' élève(s)';
                tbody.innerHTML = visible.map(function (e) {
                    return `<tr data-id="${escapeHtml(e.id)}">
                        <td><input type="text" class="admin-cell e-nom" value="${escapeHtml(e.nom)}"></td>
                        <td><input type="text" class="admin-cell e-prenom" value="${escapeHtml(e.prenom)}"></td>
                        <td><select class="admin-cell e-sexe">
                            <option value=""${!e.sexe ? ' selected' : ''}>—</option>
                            <option value="F"${e.sexe === 'F' ? ' selected' : ''}>F</option>
                            <option value="M"${e.sexe === 'M' ? ' selected' : ''}>M</option>
                        </select></td>
                        <td><select class="admin-cell e-classe">${classes.map(function (c) { return `<option value="${escapeHtml(c.nom)}"${c.nom === e.classe ? ' selected' : ''}>${escapeHtml(c.nom)}</option>`; }).join('')}</select></td>
                        <td class="admin-actions">
                            <button type="button" class="eleve-save-btn" title="Enregistrer">💾</button>
                            <button type="button" class="eleve-delete-btn" title="Supprimer">🗑️</button>
                        </td>
                    </tr>`;
                }).join('') || '<tr><td colspan="5">Aucun élève. Importez une liste CSV pour commencer.</td></tr>';

                tbody.querySelectorAll('tr[data-id]').forEach(function (row) {
                    row.querySelector('.eleve-save-btn').addEventListener('click', async function () {
                        const res = await window.EprofStore.update('school_students', row.dataset.id, {
                            nom: row.querySelector('.e-nom').value.trim().toUpperCase(),
                            prenom: row.querySelector('.e-prenom').value.trim(),
                            sexe: row.querySelector('.e-sexe').value || null,
                            classe: row.querySelector('.e-classe').value
                        });
                        if (res.error) return ctx.notify('❌ ' + res.error.message, true);
                        if (window.EprofReferentiel) window.EprofReferentiel.load(true);
                        ctx.notify('✅ Élève mis à jour.');
                        reload();
                    });
                    row.querySelector('.eleve-delete-btn').addEventListener('click', async function () {
                        if (!confirm('Supprimer cet élève de la liste ?')) return;
                        const res = await window.EprofStore.remove('school_students', row.dataset.id);
                        if (res.error) return ctx.notify('❌ ' + res.error.message, true);
                        if (window.EprofReferentiel) window.EprofReferentiel.load(true);
                        reload();
                    });
                });
            }

            async function reload() {
                const [elevesRes, classesRes] = await Promise.all([
                    window.EprofStore.list('school_students', { filters: { annee_scolaire: ANNEE_COURANTE }, orderBy: 'nom' }),
                    window.EprofStore.list('school_classes', { orderBy: 'ordre' })
                ]);
                if (elevesRes.error) {
                    tbody.innerHTML = '<tr><td colspan="5">Erreur : ' + escapeHtml(elevesRes.error.message) + '</td></tr>';
                    return;
                }
                eleves = elevesRes.data || [];
                classes = (classesRes.data || []).filter(function (c) { return c.actif; });
                remplirSelectsClasses();
                draw();
            }

            root.querySelector('.eleves-search').addEventListener('input', draw);
            root.querySelector('.eleves-filtre-classe').addEventListener('change', draw);

            root.querySelector('.eleve-add-form').addEventListener('submit', async function (e) {
                e.preventDefault();
                const res = await window.EprofStore.insert('school_students', {
                    nom: root.querySelector('.eleve-nom').value.trim().toUpperCase(),
                    prenom: root.querySelector('.eleve-prenom').value.trim(),
                    sexe: root.querySelector('.eleve-sexe').value || null,
                    classe: root.querySelector('.eleve-classe').value,
                    annee_scolaire: ANNEE_COURANTE
                });
                if (res.error) return ctx.notify('❌ ' + res.error.message, true);
                if (window.EprofReferentiel) window.EprofReferentiel.load(true);
                e.target.reset();
                remplirSelectsClasses();
                reload();
            });

            root.querySelector('.eleves-import-btn').addEventListener('click', function () {
                const fichier = root.querySelector('.eleves-csv').files[0];
                const classe = root.querySelector('.eleves-classe-import').value;
                if (!fichier) return ctx.notify('❌ Choisissez un fichier CSV.', true);
                if (!classe) return ctx.notify('❌ Aucune classe disponible : créez-en une dans l\'onglet Pédagogie.', true);

                const reader = new FileReader();
                reader.onload = async function (event) {
                    const lignes = parseCsvEleves(event.target.result, classe);
                    if (!lignes.length) return ctx.notify('❌ Aucun élève exploitable dans ce fichier.', true);

                    const apercu = root.querySelector('.eleves-apercu');
                    apercu.innerHTML = `<p class="admin-hint">${lignes.length} élève(s) détecté(s) : ${escapeHtml(lignes.slice(0, 5).map(function (e) { return e.prenom + ' ' + e.nom; }).join(', '))}${lignes.length > 5 ? '…' : ''}</p>`;

                    if (!confirm('Remplacer la liste de « ' + classe + ' » par ces ' + lignes.length + ' élève(s) ?')) return;
                    try {
                        const inseres = await rpc('admin_replace_class_students', {
                            p_classe: classe,
                            p_annee: ANNEE_COURANTE,
                            p_eleves: lignes
                        });
                        if (window.EprofReferentiel) window.EprofReferentiel.load(true);
                        ctx.notify('✅ ' + inseres + ' élève(s) importé(s) dans ' + classe + '.');
                        root.querySelector('.eleves-csv').value = '';
                        reload();
                    } catch (err) {
                        ctx.notify('❌ ' + err.message, true);
                    }
                };
                reader.readAsText(fichier, 'UTF-8');
            });

            root.querySelector('.eleves-export-btn').addEventListener('click', function () {
                const classe = root.querySelector('.eleves-filtre-classe').value;
                const lignes = eleves.filter(function (e) { return !classe || e.classe === classe; });
                const csv = 'nom;prenom;sexe;classe\n' + lignes.map(function (e) {
                    return [e.nom, e.prenom, e.sexe || '', e.classe].join(';');
                }).join('\n');
                const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = 'eleves-' + (classe || 'toutes-classes').replace(/\s+/g, '-') + '.csv';
                link.click();
                URL.revokeObjectURL(link.href);
            });

            root.querySelector('.eleves-vider-btn').addEventListener('click', async function () {
                const classe = root.querySelector('.eleves-filtre-classe').value;
                if (!classe) return ctx.notify('❌ Sélectionnez d\'abord une classe dans le filtre.', true);
                if (!confirm('Supprimer tous les élèves de « ' + classe + ' » ?')) return;
                try {
                    await rpc('admin_replace_class_students', { p_classe: classe, p_annee: ANNEE_COURANTE, p_eleves: [] });
                    if (window.EprofReferentiel) window.EprofReferentiel.load(true);
                    ctx.notify('✅ Liste de ' + classe + ' vidée.');
                    reload();
                } catch (err) {
                    ctx.notify('❌ ' + err.message, true);
                }
            });

            reload();
        }
    };

    // ================= ONGLET : COMPTES =================
    async function callAdminApi(payload) {
        const session = await window.EprofStore.getSession();
        if (!session) throw new Error('Session expirée.');
        const response = await fetch('/api/admin/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + session.access_token
            },
            body: JSON.stringify(payload)
        });
        const data = await response.json().catch(function () { return {}; });
        if (!response.ok) throw new Error(data.error || 'Erreur serveur.');
        return data;
    }

    const comptesTab = {
        id: 'comptes',
        label: '🔑 Comptes',
        html: `
            <p class="admin-hint">Les actions sur les mots de passe et les identifiants passent par une fonction serveur sécurisée (<code>/api/admin/users</code>). Elles nécessitent la variable d'environnement <code>SUPABASE_SERVICE_ROLE_KEY</code> sur Vercel.</p>
            <div class="admin-toolbar">
                <input type="search" class="comptes-search" placeholder="Rechercher un compte…">
                <button type="button" class="btn-secondary comptes-refresh-btn">🔄 Rafraîchir</button>
                <span class="admin-counter comptes-counter"></span>
            </div>
            <div class="admin-table-wrap">
                <table class="admin-table">
                    <thead><tr><th>Identifiant</th><th>Enseignant</th><th>Dernière connexion</th><th>État</th><th>Rôle</th><th>Actions</th></tr></thead>
                    <tbody class="comptes-tbody"><tr><td colspan="6">Chargement…</td></tr></tbody>
                </table>
            </div>
            <div class="admin-card comptes-lien" style="display:none;"></div>`,

        init: function (root, ctx) {
            const tbody = root.querySelector('.comptes-tbody');
            let comptes = [];

            function afficherLien(titre, lien) {
                const zone = root.querySelector('.comptes-lien');
                zone.style.display = 'block';
                zone.innerHTML = `<h4>${escapeHtml(titre)}</h4>
                    <p class="admin-hint">Transmettez ce lien à l'enseignant (il est à usage unique et expire).</p>
                    <textarea rows="3" readonly style="width:100%;">${escapeHtml(lien)}</textarea>`;
            }

            function draw() {
                const term = root.querySelector('.comptes-search').value.trim().toLowerCase();
                const visible = comptes.filter(function (c) {
                    return !term || [c.identifiant, c.nom, c.prenom, c.matiere].join(' ').toLowerCase().includes(term);
                });
                root.querySelector('.comptes-counter').textContent =
                    comptes.length + ' compte(s) · ' + comptes.filter(function (c) { return c.bloque || !c.actif; }).length + ' bloqué(s)';

                tbody.innerHTML = visible.map(function (c) {
                    const inactif = c.bloque || !c.actif;
                    return `<tr data-identifiant="${escapeHtml(c.identifiant)}">
                        <td><code>${escapeHtml(c.identifiant)}</code></td>
                        <td>${escapeHtml(((c.prenom || '') + ' ' + (c.nom || '')).trim() || '—')}<br><small>${escapeHtml(c.matiere || '')}</small></td>
                        <td><small>${escapeHtml(formatDate(c.last_sign_in_at))}</small></td>
                        <td>${inactif ? '<span class="admin-badge admin-badge-off">bloqué</span>' : '<span class="admin-badge admin-badge-on">actif</span>'}</td>
                        <td>${c.is_admin ? '<span class="admin-badge admin-badge-info">admin</span>' : 'enseignant'}</td>
                        <td class="admin-actions">
                            <button type="button" class="compte-mdp-btn" title="Définir un nouveau mot de passe">🔑</button>
                            <button type="button" class="compte-lien-btn" title="Générer un lien de réinitialisation">🔗</button>
                            <button type="button" class="compte-id-btn" title="Changer l'identifiant">✏️</button>
                            <button type="button" class="compte-ban-btn" title="${inactif ? 'Débloquer' : 'Bloquer'} le compte">${inactif ? '🔓' : '🔒'}</button>
                            <button type="button" class="compte-role-btn" title="${c.is_admin ? 'Retirer' : 'Accorder'} le rôle admin">${c.is_admin ? '⬇️' : '⬆️'}</button>
                        </td>
                    </tr>`;
                }).join('') || '<tr><td colspan="6">Aucun compte.</td></tr>';

                tbody.querySelectorAll('tr[data-identifiant]').forEach(function (row) {
                    const identifiant = row.dataset.identifiant;
                    const compte = comptes.find(function (c) { return c.identifiant === identifiant; });

                    row.querySelector('.compte-mdp-btn').addEventListener('click', async function () {
                        const mdp = prompt('Nouveau mot de passe pour « ' + identifiant +' » (8 caractères minimum) :');
                        if (!mdp) return;
                        try {
                            await callAdminApi({ action: 'reset_password', identifiant: identifiant, password: mdp });
                            ctx.notify('✅ Mot de passe redéfini pour ' + identifiant + '. Communiquez-le à l\'enseignant.');
                        } catch (err) {
                            ctx.notify('❌ ' + err.message, true);
                        }
                    });

                    row.querySelector('.compte-lien-btn').addEventListener('click', async function () {
                        try {
                            const res = await callAdminApi({ action: 'recovery_link', identifiant: identifiant });
                            afficherLien('Lien de réinitialisation pour ' + identifiant, res.link || '');
                        } catch (err) {
                            ctx.notify('❌ ' + err.message, true);
                        }
                    });

                    row.querySelector('.compte-id-btn').addEventListener('click', async function () {
                        const nouveau = prompt('Nouvel identifiant pour « ' + identifiant + ' » :', identifiant);
                        if (!nouveau || nouveau === identifiant) return;
                        try {
                            await callAdminApi({ action: 'change_identifiant', identifiant: identifiant, nouvelIdentifiant: nouveau });
                            ctx.notify('✅ Identifiant modifié : ' + identifiant + ' → ' + nouveau);
                            reload();
                        } catch (err) {
                            ctx.notify('❌ ' + err.message, true);
                        }
                    });

                    row.querySelector('.compte-ban-btn').addEventListener('click', async function () {
                        const bloquer = !(compte.bloque || !compte.actif);
                        if (!confirm((bloquer ? 'Bloquer' : 'Débloquer') + ' le compte « ' + identifiant + ' » ?')) return;
                        try {
                            await callAdminApi({ action: 'set_ban', identifiant: identifiant, bloquer: bloquer });
                            ctx.notify('✅ Compte ' + identifiant + (bloquer ? ' bloqué.' : ' débloqué.'));
                            reload();
                        } catch (err) {
                            ctx.notify('❌ ' + err.message, true);
                        }
                    });

                    row.querySelector('.compte-role-btn').addEventListener('click', async function () {
                        const accorder = !compte.is_admin;
                        if (!confirm((accorder ? 'Accorder' : 'Retirer') + ' le rôle administrateur à « ' + identifiant + ' » ?')) return;
                        try {
                            await rpc('admin_set_admin_role', { p_identifiant: identifiant, p_is_admin: accorder });
                            ctx.notify('✅ Rôle mis à jour pour ' + identifiant + '.');
                            reload();
                        } catch (err) {
                            ctx.notify('❌ ' + err.message, true);
                        }
                    });
                });
            }

            async function reload() {
                try {
                    comptes = await rpc('admin_list_accounts');
                } catch (err) {
                    tbody.innerHTML = '<tr><td colspan="6">Erreur : ' + escapeHtml(err.message) + '</td></tr>';
                    return;
                }
                draw();
            }

            root.querySelector('.comptes-search').addEventListener('input', draw);
            root.querySelector('.comptes-refresh-btn').addEventListener('click', reload);
            reload();
        }
    };

    const TABS = [whitelistTab, comptesTab, elevesTab, suggestionsTab, rgpdTab, supervisionTab, communicationTab, pedagogieTab];

    // ---------- Panneau ----------
    function openPanel() {
        const overlay = document.createElement('div');
        overlay.className = 'admin-overlay';
        overlay.innerHTML = `
            <div class="admin-dialog">
                <div class="admin-dialog-header">
                    <h3>🛠️ Administration eProf</h3>
                    <button type="button" class="admin-close" aria-label="Fermer">×</button>
                </div>
                <div class="admin-tabs">
                    ${TABS.map(function (t, i) { return `<button type="button" class="admin-tab${i === 0 ? ' admin-tab-active' : ''}" data-tab="${t.id}">${t.label}</button>`; }).join('')}
                </div>
                <div class="admin-feedback" style="display:none;"></div>
                <div class="admin-tab-content"></div>
            </div>`;
        document.body.appendChild(overlay);

        const feedback = overlay.querySelector('.admin-feedback');
        const content = overlay.querySelector('.admin-tab-content');

        const ctx = {
            notify: function (message, isError) {
                feedback.textContent = message;
                feedback.className = 'admin-feedback' + (isError ? ' admin-feedback-error' : '');
                feedback.style.display = 'block';
                setTimeout(function () { feedback.style.display = 'none'; }, 5000);
            }
        };

        function openTab(tab) {
            content.innerHTML = tab.html;
            tab.init(content, ctx);
        }

        overlay.querySelectorAll('.admin-tab').forEach(function (btn) {
            btn.addEventListener('click', function () {
                overlay.querySelectorAll('.admin-tab').forEach(function (b) { b.classList.toggle('admin-tab-active', b === btn); });
                openTab(TABS.find(function (t) { return t.id === btn.dataset.tab; }));
            });
        });

        overlay.querySelector('.admin-close').addEventListener('click', function () { overlay.remove(); });
        overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });

        openTab(TABS[0]);
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

    window.EprofAdmin = {
        setup: setupAdminButton,
        isCurrentUserAdmin: isCurrentUserAdmin,
        logAction: logAction,
        registerTab: function (tab) { TABS.push(tab); }
    };

    document.addEventListener('DOMContentLoaded', async function () {
        await (window.eprofSupabaseReady || Promise.resolve());
        setupAdminButton();
        if (window.eprofAuth) window.eprofAuth.onAuthStateChange(setupAdminButton);
    });
})();
