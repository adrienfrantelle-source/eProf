// Carnet de Notes - Données embarquées pour portabilité complète
// Ce fichier contient les évaluations et notes sauvegardées
// Remplacez le fichier js/carnet-notes-data.js par celui-ci pour restaurer vos données

const CARNET_NOTES_DATA = {
    evaluations: {},
    notes: {}
};

// Export pour utilisation dans carnet-notes.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CARNET_NOTES_DATA;
}
