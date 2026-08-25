// Gestion de Séjours - Données embarquées pour portabilité complète
// Ce fichier contient tous les séjours organisés

const SEJOURS_DATA = [
    // Format: {
    //   id: "unique_id",
    //   titre: "Nom du séjour",
    //   destination: "Ville, Pays",
    //   dateDebut: "2026-03-15",
    //   dateFin: "2026-03-20",
    //   classe: "2nde SAPAT",
    //   budget: { total: 5000, depenses: [...], reste: 4000 },
    //   participants: [...],
    //   programme: [...],
    //   hebergement: {...},
    //   transport: {...},
    //   coordonnees: { lat: 48.8566, lng: 2.3522 },
    //   documents: [...],
    //   notes: "..."
    // }
];

// Export pour utilisation dans app.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SEJOURS_DATA;
}
