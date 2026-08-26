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

    function getMentions() {
        try {
            const parametres = JSON.parse(localStorage.getItem('parametres') || '{}');
            const mentions = parametres.notation && Array.isArray(parametres.notation.mentions)
                ? parametres.notation.mentions
                : null;
            return (mentions && mentions.length > 0) ? mentions : DEFAULT_MENTIONS;
        } catch (e) {
            return DEFAULT_MENTIONS;
        }
    }

    // note : la valeur obtenue par l'élève ; maxNote : barème de cette note (20 par défaut)
    function getMentionForNote(note, maxNote) {
        if (note === null || note === undefined || isNaN(note)) return null;
        const noteSur20 = (maxNote && maxNote !== 20) ? (note / maxNote) * 20 : note;
        const mentions = getMentions().slice().sort((a, b) => b.seuilMin - a.seuilMin);
        return mentions.find(m => noteSur20 >= m.seuilMin) || mentions[mentions.length - 1] || null;
    }

    window.EprofBareme = { DEFAULT_MENTIONS, getMentions, getMentionForNote };
})();
