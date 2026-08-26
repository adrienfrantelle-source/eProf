// ===== ANNONCES INSTITUTIONNELLES (côté enseignant) =====
// Affiche les annonces actives ciblant l'utilisateur connecté, enregistre
// l'accusé de lecture et permet de signaler un contenu à l'administrateur.

(function () {
    const DISMISSED_KEY = 'eprof-annonces-masquees';

    function escapeHtml(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function readDismissed() {
        try { return JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]'); } catch (e) { return []; }
    }

    function dismiss(id) {
        const list = readDismissed();
        list.push(id);
        try { localStorage.setItem(DISMISSED_KEY, JSON.stringify(list.slice(-100))); } catch (e) {}
    }

    async function markAsRead(announcementId) {
        try {
            const session = await window.EprofStore.getSession();
            if (!session) return;
            await window.EprofStore.upsert('announcement_reads', [{
                announcement_id: announcementId,
                user_id: session.user.id,
                identifiant: session.user.email ? session.user.email.split('@')[0] : null
            }], { onConflict: 'announcement_id,user_id' });
        } catch (e) {
            console.warn('⚠️ Accusé de lecture non enregistré.', e);
        }
    }

    function cardHtml(a) {
        return `
            <article class="annonce annonce-${escapeHtml(a.niveau)}" data-id="${escapeHtml(a.id)}">
                <div class="annonce-body">
                    <h4>${a.epingle ? '📌 ' : ''}${escapeHtml(a.titre)}</h4>
                    <p>${escapeHtml(a.message).replace(/\n/g, '<br>')}</p>
                    ${a.lien_url ? `<a class="annonce-lien" href="${escapeHtml(a.lien_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(a.lien_libelle || 'En savoir plus')}</a>` : ''}
                    <div class="annonce-meta">${escapeHtml(new Date(a.date_debut).toLocaleDateString('fr-FR'))}${a.auteur_identifiant ? ' · ' + escapeHtml(a.auteur_identifiant) : ''}</div>
                </div>
                <div class="annonce-actions">
                    <button type="button" class="annonce-report" title="Signaler ce contenu">🚩</button>
                    ${a.epingle ? '' : '<button type="button" class="annonce-close" title="Masquer">×</button>'}
                </div>
            </article>`;
    }

    async function reportContent(type, ref, extrait) {
        const motif = prompt('Motif du signalement (contenu inapproprié, erreur, lien cassé…) :');
        if (!motif) return;
        try {
            const session = await window.EprofStore.getSession();
            if (!session) return;
            const res = await window.EprofStore.insert('content_reports', {
                contenu_type: type,
                contenu_ref: ref,
                extrait: (extrait || '').slice(0, 300),
                motif: motif,
                reporter_id: session.user.id,
                reporter_identifiant: session.user.email ? session.user.email.split('@')[0] : null
            });
            if (res.error) throw res.error;
            alert('✅ Signalement transmis à l\'administrateur.');
        } catch (err) {
            alert('❌ Signalement impossible : ' + err.message);
        }
    }

    async function render() {
        const container = document.getElementById('eprof-announcements');
        if (!container || !window.EprofStore) return;
        if (!await window.EprofStore.isOnlineReady()) return;

        const result = await window.EprofStore.list('announcements', { orderBy: 'date_debut', ascending: false });
        if (result.error || !result.data) return;

        const masquees = readDismissed();
        const now = Date.now();
        const visibles = result.data.filter(function (a) {
            if (!a.actif) return false;
            if (new Date(a.date_debut).getTime() > now) return false;
            if (a.date_fin && new Date(a.date_fin).getTime() < now) return false;
            return a.epingle || masquees.indexOf(a.id) === -1;
        });

        container.innerHTML = visibles.map(cardHtml).join('');
        visibles.forEach(function (a) { markAsRead(a.id); });

        container.querySelectorAll('.annonce-close').forEach(function (btn) {
            btn.addEventListener('click', function () {
                const card = btn.closest('.annonce');
                dismiss(card.dataset.id);
                card.remove();
            });
        });

        container.querySelectorAll('.annonce-report').forEach(function (btn) {
            btn.addEventListener('click', function () {
                const card = btn.closest('.annonce');
                const annonce = visibles.find(function (a) { return a.id === card.dataset.id; });
                reportContent('annonce', card.dataset.id, annonce ? annonce.titre : '');
            });
        });
    }

    window.EprofAnnonces = { render, reportContent };

    document.addEventListener('DOMContentLoaded', async function () {
        await (window.eprofSupabaseReady || Promise.resolve());
        render();
        if (window.eprofAuth) window.eprofAuth.onAuthStateChange(render);
    });
})();
