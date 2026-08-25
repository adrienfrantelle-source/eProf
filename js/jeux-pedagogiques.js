// Jeux pédagogiques - Données embarquées pour portabilité complète
// Ce fichier contient la liste des jeux pédagogiques sauvegardés
// Remplacez le fichier js/jeux-pedagogiques.js par celui-ci pour restaurer vos jeux

const JEUX_PEDAGOGIQUES = [
    {
        "titre": "Pays du monde",
        "url": "https://www.jetpunk.com/quizzes/pays-du-monde"
    },
    {
        "titre": "Pays d'Europe",
        "url": "https://www.jetpunk.com/user-quizzes/6121/pays-d-europe"
    },
    {
        "titre": "Worldle",
        "url": "https://worldle.teuteuf.fr"
    },
    {
        "titre": "Globle",
        "url": "https://globle-game.com"
    },
    {
        "titre": "Pays d'Asie",
        "url": "https://www.jetpunk.com/user-quizzes/6121/pays-d-asie"
    },
    {
        "titre": "Pays d'Afrique",
        "url": "https://www.jetpunk.com/user-quizzes/6121/pays-d-afrique"
    },
    {
        "titre": "Kahoot",
        "url": "https://kahoot.com/fr/"
    },
    {
        "titre": "Pays d'Océanie",
        "url": "https://www.jetpunk.com/user-quizzes/6121/pays-doceanie"
    },
    {
        "titre": "Pays d'Amérique du Nord",
        "url": "https://www.jetpunk.com/user-quizzes/176134/pays-damerique-du-nord"
    },
    {
        "titre": "Pays d'Amérique du Sud",
        "url": "https://www.jetpunk.com/user-quizzes/6121/pays-damerique-du-sud"
    },
    {
        "titre": "GoogleMap",
        "url": "https://www.google.fr/maps/@46.6142431,1.3778534,1137218m/data=!3m1!1e3?entry=ttu&g_ep=EgoyMDI1MTIwOS4wIKXMDSoKLDEwMDc5MjA2OUgBUAM%3D"
    },
    {
        "titre": "TrueSizeMap",
        "url": "https://thetruesize.com/"
    }
];

// Export pour utilisation dans app.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = JEUX_PEDAGOGIQUES;
}
