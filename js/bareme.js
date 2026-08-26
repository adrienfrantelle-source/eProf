// ===== BARÈME DE MENTIONS (partagé entre index.html et carnet-notes.html) =====
// Lit parametres.notation.mentions (configuré dans Paramètres) pour associer
// un emoji/une mention à une moyenne, partout où c'est utile (carnet de notes...).
(function () {
    const DEFAULT_MENTIONS = [
        { emoji: '🏆', label: 'Très bien', seuilMin: 16 },
        { emoji: '😊', label: 'Bien', seuilMin: 14 },
        { emoji: '🙂', label: 'Assez bien', seuilMin: 12 },
        { emoji: '😐', label: 'Passable', seuilMin: 10 },
        { emoji: '📚', label: 'À retravailler', seuilMin: 0 }
    ];

    function readParametres() {
        try {
            return JSON.parse(localStorage.getItem('parametres') || '{}');
        } catch (e) {
            return {};
        }
    }

    // Échelle sur laquelle sont exprimés les seuils des mentions (20 ou 10).
    function getEchelle() {
        const notation = readParametres().notation || {};
        if (notation.echelle) return Number(notation.echelle);
        return notation.systeme === 'sur10' ? 10 : 20;
    }

    function getMentions() {
        const notation = readParametres().notation || {};
        const mentions = Array.isArray(notation.mentions) ? notation.mentions : null;
        return (mentions && mentions.length > 0) ? mentions : DEFAULT_MENTIONS;
    }

    // note : la valeur obtenue par l'élève ; maxNote : barème de cette note (20 par défaut)
    function getMentionForNote(note, maxNote) {
        if (note === null || note === undefined || isNaN(note)) return null;
        const echelle = getEchelle();
        const base = maxNote || 20;
        const noteRamenee = base === echelle ? note : (note / base) * echelle;
        const mentions = getMentions().slice().sort((a, b) => b.seuilMin - a.seuilMin);
        return mentions.find(m => noteRamenee >= m.seuilMin) || mentions[mentions.length - 1] || null;
    }

    window.EprofBareme = { DEFAULT_MENTIONS, getMentions, getMentionForNote, getEchelle };
})();
