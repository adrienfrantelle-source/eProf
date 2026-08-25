// ========================================
// QUIZ_DATA - Données des quiz créés dans eProf
// Ce fichier est vide par défaut
// Utilisez l'export depuis le générateur de quiz pour le remplir
// ========================================

const QUIZ_DATA = {
    quiz: []
};

// Chargement automatique au démarrage (si des quiz existent)
if (typeof window !== 'undefined' && QUIZ_DATA.quiz.length > 0) {
    const existingQuiz = JSON.parse(localStorage.getItem('quizList') || '[]');
    
    // Fusionner sans doublons (basé sur l'ID)
    QUIZ_DATA.quiz.forEach(quiz => {
        if (!existingQuiz.find(q => q.id === quiz.id)) {
            existingQuiz.push(quiz);
        }
    });
    
    localStorage.setItem('quizList', JSON.stringify(existingQuiz));
    console.log('✓ Quiz chargés depuis quiz-data.js');
}
