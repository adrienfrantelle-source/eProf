// ===== SUGGESTIONS ET BUGS (côté enseignant) =====
// Bouton du footer accessible à tous : dépôt d'une demande, suivi de ses propres
// demandes et soutien des demandes des collègues.

(function () {
    const TYPES = [
        { value: 'bug', label: '🐞 Signaler un bug' },
        { value: 'amelioration', label: '✨ Proposer une amélioration' },
        { value: 'nouveaute', label: '💡 Demander une nouveauté' },
        { value: 'autre', label: '💬 Autre' }
    ];

    const MODULES = ['Général', 'Calendrier', 'Agenda', 'Carnet de notes', 'Plan de classe',
        'Trombinoscopes', 'Suivi des élèves', 'Tableau blanc', 'Jeux pédagogiques',
        'Ressources pédagogiques', 'Conversion de fichier', 'Messagerie', 'Paramètres', 'Connexion'];

    const STATUTS = {
        nouveau: '🆕 Nouveau',
        en_cours: '🔧 En cours',
        planifie: '📅 Planifié',
        termine: '✅ Terminé',
        refuse: '🚫 Non retenu'
    };

    function escapeHtml(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function isEditable(item) {
        return !!(item && item.statut === 'nouveau');
    }

    async function loadMine() {
        const session = await window.EprofStore.getSession();
        if (!session) return [];
        const result = await window.EprofStore.list('suggestions', {
            filters: { auteur_id: session.user.id },
            orderBy: 'created_at',
            ascending: false
        });
        if (result.error) return [];
        return (result.data || []).filter(function (s) { return s.auteur_id === session.user.id; });
    }

    function open() {
        const overlay = document.createElement('div');
        overlay.className = 'suggest-overlay';
        overlay.innerHTML = `
            <div class="suggest-dialog">
                <div class="suggest-header">
                    <h3>💬 Suggestions & bugs</h3>
                    <button type="button" class="suggest-close" aria-label="Fermer">×</button>
                </div>
                <p class="suggest-hint">Votre retour est transmis à l'administrateur d'eProf. Vous pouvez suivre son avancement ici.</p>

                <form class="suggest-form">
                    <div class="suggest-row">
                        <label>Type
                            <select class="suggest-type">
                                ${TYPES.map(function (t) { return `<option value="${t.value}">${t.label}</option>`; }).join('')}
                            </select>
                        </label>
                        <label>Module concerné
                            <select class="suggest-module">
                                ${MODULES.map(function (m) { return `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`; }).join('')}
                            </select>
                        </label>
                        <label>Importance
                            <select class="suggest-priorite">
                                <option value="basse">Basse</option>
                                <option value="normale" selected>Normale</option>
                                <option value="haute">Haute</option>
                                <option value="critique">Bloquant</option>
                            </select>
                        </label>
                    </div>
                    <label class="suggest-full">Titre
                        <input type="text" class="suggest-titre" maxlength="120" placeholder="Résumé en une phrase" required>
                    </label>
                    <label class="suggest-full">Description
                        <textarea class="suggest-description" rows="4" placeholder="Ce que vous faisiez, ce qui s'est passé, ce que vous attendiez…" required></textarea>
                    </label>
                    <div class="suggest-actions">
                        <button type="submit" class="btn-primary">📨 Envoyer</button>
                        <span class="suggest-feedback"></span>
                    </div>
                </form>

                <h4 class="suggest-subtitle">Mes demandes</h4>
                <div class="suggest-list">Chargement…</div>
            </div>`;
        document.body.appendChild(overlay);

        const liste = overlay.querySelector('.suggest-list');
        let editingId = null;
        let itemsCache = [];

        function fillForm(item) {
            overlay.querySelector('.suggest-type').value = item.type || 'amelioration';
            overlay.querySelector('.suggest-module').value = item.module || 'Général';
            overlay.querySelector('.suggest-priorite').value = item.priorite || 'normale';
            overlay.querySelector('.suggest-titre').value = item.titre || '';
            overlay.querySelector('.suggest-description').value = item.description || '';
            overlay.querySelector('.suggest-form button[type="submit"]').textContent = item ? '💾 Enregistrer les modifications' : '📨 Envoyer';
        }

        async function renderMine() {
            itemsCache = await loadMine();
            liste.innerHTML = itemsCache.map(function (s) {
                return `<div class="suggest-item suggest-statut-${escapeHtml(s.statut)}">
                    <div class="suggest-item-head">
                        <strong>${escapeHtml(s.titre)}</strong>
                        <span class="suggest-badge">${escapeHtml(STATUTS[s.statut] || s.statut)}</span>
                    </div>
                    <p class="suggest-item-desc">${escapeHtml(s.description || '')}</p>
                    <div class="suggest-item-meta">${escapeHtml(s.module || 'Général')} · ${escapeHtml(new Date(s.created_at).toLocaleDateString('fr-FR'))}</div>
                    ${s.reponse_admin ? `<div class="suggest-reponse">💬 ${escapeHtml(s.reponse_admin)}</div>` : ''}
                    ${isEditable(s) ? `<div class="suggest-item-actions">
                        <button type="button" class="suggest-edit-btn" data-id="${escapeHtml(s.id)}">Modifier</button>
                        <button type="button" class="suggest-delete-btn" data-id="${escapeHtml(s.id)}">Supprimer</button>
                    </div>` : '<p class="suggest-locked">Prise en charge par l\'administration — modification fermée.</p>'}
                </div>`;
            }).join('') || '<p class="suggest-hint">Aucune demande pour le moment.</p>';

            liste.querySelectorAll('.suggest-edit-btn').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    const item = itemsCache.find(function (s) { return s.id === btn.dataset.id; });
                    if (!item || !isEditable(item)) return;
                    editingId = item.id;
                    fillForm(item);
                    overlay.querySelector('.suggest-titre').focus();
                });
            });

            liste.querySelectorAll('.suggest-delete-btn').forEach(function (btn) {
                btn.addEventListener('click', async function () {
                    const item = itemsCache.find(function (s) { return s.id === btn.dataset.id; });
                    if (!item || !isEditable(item) || !confirm('Supprimer la demande « ' + item.titre + ' » ?')) return;
                    const res = await window.EprofStore.remove('suggestions', item.id);
                    if (res.error) {
                        alert(res.error.message);
                        return;
                    }
                    if (editingId === item.id) {
                        editingId = null;
                        overlay.querySelector('.suggest-form').reset();
                        overlay.querySelector('.suggest-form button[type="submit"]').textContent = '📨 Envoyer';
                    }
                    renderMine();
                });
            });
        }

        overlay.querySelector('.suggest-close').addEventListener('click', function () { overlay.remove(); });
        overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });

        overlay.querySelector('.suggest-form').addEventListener('submit', async function (e) {
            e.preventDefault();
            const feedback = overlay.querySelector('.suggest-feedback');
            const session = await window.EprofStore.getSession();
            if (!session) {
                feedback.textContent = '❌ Vous devez être connecté.';
                return;
            }

            const payload = {
                type: overlay.querySelector('.suggest-type').value,
                module: overlay.querySelector('.suggest-module').value,
                priorite: overlay.querySelector('.suggest-priorite').value,
                titre: overlay.querySelector('.suggest-titre').value.trim(),
                description: overlay.querySelector('.suggest-description').value.trim()
            };

            let res;
            if (editingId) {
                const current = itemsCache.find(function (s) { return s.id === editingId; });
                if (!isEditable(current)) {
                    feedback.textContent = '❌ Cette demande a déjà été triée et ne peut plus être modifiée.';
                    return;
                }
                res = await window.EprofStore.update('suggestions', editingId, payload);
            } else {
                res = await window.EprofStore.insert('suggestions', {
                    ...payload,
                    auteur_id: session.user.id,
                    auteur_identifiant: session.user.email ? session.user.email.split('@')[0] : null
                });
            }

            if (res.error) {
                feedback.textContent = '❌ ' + res.error.message;
                return;
            }
            const wasEdit = !!editingId;
            e.target.reset();
            editingId = null;
            overlay.querySelector('.suggest-form button[type="submit"]').textContent = '📨 Envoyer';
            feedback.textContent = wasEdit ? '✅ Demande mise à jour.' : '✅ Merci, votre demande a été transmise.';
            setTimeout(function () { feedback.textContent = ''; }, 4000);
            renderMine();
        });

        renderMine();
    }

    window.EprofSuggestions = { open };

    document.addEventListener('DOMContentLoaded', function () {
        const btn = document.getElementById('suggest-trigger');
        if (btn) btn.addEventListener('click', open);
    });
})();
