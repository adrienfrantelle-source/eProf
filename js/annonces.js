// ===== ANNONCES INSTITUTIONNELLES (côté enseignant) =====
// Affichées comme des notifications, fermables par une croix.

(function () {
    const DISMISSED_KEY = 'eprof-annonces-masquees';
    const ICONS = { info: 'ℹ️', important: '⚠️', urgent: '🚨' };

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
        if (list.indexOf(id) === -1) list.push(id);
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
        const icon = ICONS[a.niveau] || ICONS.info;
        return `
            <article class="annonce-toast annonce-${escapeHtml(a.niveau)}" data-id="${escapeHtml(a.id)}" role="status">
                <div class="annonce-icon" aria-hidden="true">${icon}</div>
                <div class="annonce-body">
                    <h4>${a.epingle ? '<span class="annonce-pin">Épinglé</span>' : ''}${escapeHtml(a.titre)}</h4>
                    <p>${escapeHtml(a.message).replace(/\n/g, '<br>')}</p>
                    ${a.lien_url ? `<a class="annonce-lien" href="${escapeHtml(a.lien_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(a.lien_libelle || 'En savoir plus')}</a>` : ''}
                    <button type="button" class="annonce-report" title="Signaler ce contenu">Signaler</button>
                </div>
                <button type="button" class="annonce-close" title="Fermer la notification" aria-label="Fermer">×</button>
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
        if (!await window.EprofStore.isOnlineReady()) {
            container.innerHTML = '';
            return;
        }

        const result = await window.EprofStore.list('announcements', { orderBy: 'date_debut', ascending: false });
        if (result.error || !result.data) return;

        const masquees = readDismissed();
        const now = Date.now();
        const visibles = result.data.filter(function (a) {
            if (!a.actif) return false;
            if (new Date(a.date_debut).getTime() > now) return false;
            if (a.date_fin && new Date(a.date_fin).getTime() < now) return false;
            return masquees.indexOf(a.id) === -1;
        });

        container.innerHTML = visibles.map(cardHtml).join('');
        container.classList.toggle('annonces-visible', visibles.length > 0);
        visibles.forEach(function (a) { markAsRead(a.id); });

        container.querySelectorAll('.annonce-close').forEach(function (btn) {
            btn.addEventListener('click', function () {
                const card = btn.closest('.annonce-toast');
                if (!card) return;
                dismiss(card.dataset.id);
                card.classList.add('annonce-out');
                setTimeout(function () {
                    card.remove();
                    if (!container.querySelector('.annonce-toast')) {
                        container.classList.remove('annonces-visible');
                    }
                }, 220);
            });
        });

        container.querySelectorAll('.annonce-report').forEach(function (btn) {
            btn.addEventListener('click', function () {
                const card = btn.closest('.annonce-toast');
                const annonce = visibles.find(function (a) { return a.id === card.dataset.id; });
                reportContent('annonce', card.dataset.id, annonce ? annonce.titre : '');
            });
        });
    }

    window.EprofAnnonces = { render, reportContent };

    document.addEventListener('DOMContentLoaded', async function () {
        await (window.eprofSupabaseReady || Promise.resolve());
        render();
        if (window.eprofAuth) window.eprofAuth.onAuthStateChange(function () { render(); });
    });
})();
