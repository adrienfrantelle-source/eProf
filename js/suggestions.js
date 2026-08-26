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
        'Conversion de fichier', 'Paramètres', 'Connexion'];

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

    async function loadMine() {
        const result = await window.EprofStore.list('suggestions', { orderBy: 'created_at', ascending: false });
        return result.error ? [] : (result.data || []);
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

        async function renderMine() {
            const items = await loadMine();
            liste.innerHTML = items.map(function (s) {
                return `<div class="suggest-item suggest-statut-${escapeHtml(s.statut)}">
                    <div class="suggest-item-head">
                        <strong>${escapeHtml(s.titre)}</strong>
                        <span class="suggest-badge">${escapeHtml(STATUTS[s.statut] || s.statut)}</span>
                    </div>
                    <div class="suggest-item-meta">${escapeHtml(s.module || 'Général')} · ${escapeHtml(new Date(s.created_at).toLocaleDateString('fr-FR'))}${s.auteur_identifiant ? ' · ' + escapeHtml(s.auteur_identifiant) : ''}</div>
                    ${s.reponse_admin ? `<div class="suggest-reponse">💬 ${escapeHtml(s.reponse_admin)}</div>` : ''}
                </div>`;
            }).join('') || '<p class="suggest-hint">Aucune demande pour le moment.</p>';
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

            const res = await window.EprofStore.insert('suggestions', {
                type: overlay.querySelector('.suggest-type').value,
                module: overlay.querySelector('.suggest-module').value,
                priorite: overlay.querySelector('.suggest-priorite').value,
                titre: overlay.querySelector('.suggest-titre').value.trim(),
                description: overlay.querySelector('.suggest-description').value.trim(),
                auteur_id: session.user.id,
                auteur_identifiant: session.user.email ? session.user.email.split('@')[0] : null
            });

            if (res.error) {
                feedback.textContent = '❌ ' + res.error.message;
                return;
            }
            e.target.reset();
            feedback.textContent = '✅ Merci, votre demande a été transmise.';
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
