// Quiz Résultats - JavaScript

let currentQuiz = null;
let submissions = [];

// Initialisation
document.addEventListener('DOMContentLoaded', function() {
    loadQuizResults();
});

// Charger les résultats depuis l'URL
function loadQuizResults() {
    const urlParams = new URLSearchParams(window.location.search);
    const quizId = urlParams.get('id');
    
    if (!quizId) {
        showEmptyState('Aucun quiz sélectionné');
        return;
    }
    
    // Charger le quiz
    currentQuiz = loadQuizById(quizId);
    if (!currentQuiz) {
        showEmptyState('Quiz introuvable');
        return;
    }
    
    // Charger les soumissions
    submissions = loadSubmissionsByQuizId(quizId);
    
    // Afficher les résultats
    displayResults();
}

// Charger un quiz par ID
function loadQuizById(quizId) {
    try {
        const quizzes = JSON.parse(localStorage.getItem('eprof_quizzes') || '[]');
        return quizzes.find(q => q.id === quizId);
    } catch (error) {
        console.error('Erreur chargement quiz:', error);
        return null;
    }
}

// Charger les soumissions d'un quiz
function loadSubmissionsByQuizId(quizId) {
    try {
        const allSubmissions = JSON.parse(localStorage.getItem('eprof_quiz_submissions') || '[]');
        return allSubmissions.filter(s => s.quizId === quizId);
    } catch (error) {
        console.error('Erreur chargement soumissions:', error);
        return [];
    }
}

// Afficher les résultats
function displayResults() {
    // Titre
    document.getElementById('quiz-title').textContent = currentQuiz.titre;
    
    // Calculer les statistiques
    const stats = calculateStats();
    displayStats(stats);
    
    // Afficher les participants
    displayParticipants();
    
    // Analyser les questions
    displayQuestionsAnalysis();
    
    // Détails
    displayDetailedResults();
}

// Calculer les statistiques
function calculateStats() {
    if (submissions.length === 0) {
        return {
            totalParticipants: 0,
            avgScore: 0,
            avgTime: 0,
            bestScore: 0
        };
    }
    
    const scores = submissions.map(s => s.score);
    const times = submissions.map(s => s.duration);
    
    return {
        totalParticipants: submissions.length,
        avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
        avgTotal: submissions[0].total,
        avgTime: times.reduce((a, b) => a + b, 0) / times.length,
        bestScore: Math.max(...scores)
    };
}

// Afficher les statistiques
function displayStats(stats) {
    document.getElementById('total-participants').textContent = stats.totalParticipants;
    
    const avgPercentage = stats.avgTotal > 0 
        ? Math.round((stats.avgScore / stats.avgTotal) * 100) 
        : 0;
    document.getElementById('avg-score').textContent = avgPercentage + '%';
    
    const minutes = Math.floor(stats.avgTime / 60);
    const seconds = Math.round(stats.avgTime % 60);
    document.getElementById('avg-time').textContent = `${minutes}m ${seconds}s`;
    
    document.getElementById('best-score').textContent = 
        `${stats.bestScore}/${stats.avgTotal || currentQuiz.nbQuestions}`;
}

// Afficher la liste des participants
function displayParticipants() {
    const container = document.getElementById('participants-list');
    
    if (submissions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📭</div>
                <h3>Aucune soumission</h3>
                <p>Les élèves n'ont pas encore répondu au quiz.</p>
            </div>
        `;
        return;
    }
    
    // Trier par score décroissant
    const sortedSubmissions = [...submissions].sort((a, b) => b.score - a.score);
    
    container.innerHTML = '';
    sortedSubmissions.forEach(submission => {
        const card = createParticipantCard(submission);
        container.appendChild(card);
    });
}

// Créer une carte participant
function createParticipantCard(submission) {
    const card = document.createElement('div');
    card.className = 'participant-card';
    
    const percentage = submission.total > 0 
        ? Math.round((submission.score / submission.total) * 100) 
        : 0;
    
    let badge = '';
    let badgeClass = '';
    if (percentage >= 80) {
        badge = 'Excellent';
        badgeClass = 'excellent';
    } else if (percentage >= 60) {
        badge = 'Bien';
        badgeClass = 'good';
    } else if (percentage >= 40) {
        badge = 'Moyen';
        badgeClass = 'average';
    } else {
        badge = 'À améliorer';
        badgeClass = 'poor';
    }
    
    const initials = submission.student.name
        .split(' ')
        .map(n => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase();
    
    const submittedDate = new Date(submission.submittedAt).toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    const minutes = Math.floor(submission.duration / 60);
    const seconds = submission.duration % 60;
    
    card.innerHTML = `
        <div class="participant-info">
            <div class="participant-avatar">${initials}</div>
            <div class="participant-details">
                <h4>${submission.student.name}</h4>
                <div class="participant-meta">
                    ${submission.student.classe ? submission.student.classe + ' • ' : ''}
                    ${submittedDate} • Temps: ${minutes}m ${seconds}s
                </div>
            </div>
        </div>
        <div class="participant-score">
            <div class="score-value">${submission.score}/${submission.total}</div>
            <div class="score-percentage">${percentage}%</div>
            <span class="score-badge ${badgeClass}">${badge}</span>
        </div>
    `;
    
    return card;
}

// Analyser les questions
function displayQuestionsAnalysis() {
    const container = document.getElementById('questions-analysis');
    
    if (submissions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📊</div>
                <h3>Aucune donnée</h3>
                <p>Pas encore de réponses pour analyser.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    
    currentQuiz.questions.forEach((question, qIndex) => {
        if (!question.options) return; // Skip questions libres pour l'analyse
        
        const analysis = analyzeQuestion(question, qIndex);
        const card = createQuestionAnalysisCard(question, qIndex, analysis);
        container.appendChild(card);
    });
}

// Analyser une question
function analyzeQuestion(question, qIndex) {
    const answers = submissions.map(s => s.answers[qIndex]).filter(a => a !== null);
    
    if (!question.options) {
        return { type: 'free', count: answers.length };
    }
    
    const distribution = question.options.map((option, oIndex) => {
        const count = answers.filter(a => a.type === 'choice' && a.value === oIndex).length;
        return {
            option: option,
            count: count,
            percentage: answers.length > 0 ? (count / answers.length) * 100 : 0
        };
    });
    
    const correctAnswers = answers.filter(a => {
        return a.type === 'choice' && question.options[a.value]?.correct;
    }).length;
    
    const successRate = answers.length > 0 ? (correctAnswers / answers.length) * 100 : 0;
    
    return {
        type: 'choice',
        distribution: distribution,
        successRate: successRate,
        totalAnswers: answers.length
    };
}

// Créer une carte d'analyse de question
function createQuestionAnalysisCard(question, qIndex, analysis) {
    const card = document.createElement('div');
    card.className = 'question-analysis-card';
    
    let html = `
        <div class="question-header">
            <span class="question-number">Question ${qIndex + 1}</span>
            ${analysis.type === 'choice' ? `
                <div class="success-rate">
                    <div class="success-value">${Math.round(analysis.successRate)}%</div>
                    <div class="success-label">Taux de réussite</div>
                </div>
            ` : ''}
        </div>
        <div class="question-text">${question.question}</div>
    `;
    
    if (analysis.type === 'choice') {
        html += '<div class="answers-distribution">';
        analysis.distribution.forEach((item, index) => {
            const letter = String.fromCharCode(65 + index);
            const fillClass = item.option.correct ? 'correct' : '';
            html += `
                <div class="answer-bar">
                    <span class="answer-label">${letter}</span>
                    <div class="answer-bar-bg">
                        <div class="answer-bar-fill ${fillClass}" style="width: ${item.percentage}%">
                            ${item.percentage > 10 ? Math.round(item.percentage) + '%' : ''}
                        </div>
                    </div>
                    <span class="answer-count">${item.count} réponse${item.count > 1 ? 's' : ''}</span>
                </div>
            `;
        });
        html += '</div>';
    } else {
        html += `<p style="color: #64748b; font-style: italic;">Question à réponse libre (${analysis.count} réponse${analysis.count > 1 ? 's' : ''})</p>`;
    }
    
    card.innerHTML = html;
    return card;
}

// Afficher les résultats détaillés
function displayDetailedResults() {
    const container = document.getElementById('detailed-results');
    
    if (submissions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📋</div>
                <h3>Aucune donnée</h3>
                <p>Pas de résultats détaillés disponibles.</p>
            </div>
        `;
        return;
    }
    
    let html = '<table class="detailed-table"><thead><tr>';
    html += '<th>Élève</th>';
    
    currentQuiz.questions.forEach((q, i) => {
        html += `<th>Q${i + 1}</th>`;
    });
    
    html += '<th>Score</th><th>%</th></tr></thead><tbody>';
    
    submissions.forEach(submission => {
        const percentage = submission.total > 0 
            ? Math.round((submission.score / submission.total) * 100) 
            : 0;
        
        html += '<tr>';
        html += `<td><strong>${submission.student.name}</strong></td>`;
        
        currentQuiz.questions.forEach((question, qIndex) => {
            const answer = submission.answers[qIndex];
            let cellContent = '-';
            let cellClass = '';
            
            if (answer) {
                if (answer.type === 'choice' && question.options) {
                    const isCorrect = question.options[answer.value]?.correct;
                    cellContent = isCorrect ? '✓' : '✗';
                    cellClass = isCorrect ? 'correct' : 'incorrect';
                } else if (answer.type === 'free') {
                    cellContent = '📝';
                    cellClass = 'free';
                }
            }
            
            html += `<td class="answer-cell ${cellClass}">${cellContent}</td>`;
        });
        
        html += `<td><strong>${submission.score}/${submission.total}</strong></td>`;
        html += `<td><strong>${percentage}%</strong></td>`;
        html += '</tr>';
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
}

// Changer d'onglet
function switchTab(tabName) {
    // Désactiver tous les onglets
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Activer l'onglet sélectionné
    event.target.classList.add('active');
    document.getElementById(`tab-${tabName}`).classList.add('active');
}

// Exporter en PDF
async function exportResults() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    let y = 20;
    
    // Titre
    doc.setFontSize(16);
    doc.text('Résultats du Quiz', 105, y, { align: 'center' });
    y += 10;
    
    doc.setFontSize(12);
    doc.text(currentQuiz.titre, 105, y, { align: 'center' });
    y += 15;
    
    // Statistiques
    const stats = calculateStats();
    doc.setFontSize(10);
    doc.text(`Participants: ${stats.totalParticipants}`, 15, y);
    const avgPercentage = stats.avgTotal > 0 
        ? Math.round((stats.avgScore / stats.avgTotal) * 100) 
        : 0;
    doc.text(`Score moyen: ${avgPercentage}%`, 80, y);
    doc.text(`Meilleur score: ${stats.bestScore}/${stats.avgTotal}`, 140, y);
    y += 15;
    
    // Liste des participants
    doc.setFontSize(12);
    doc.text('Liste des participants:', 15, y);
    y += 8;
    
    doc.setFontSize(9);
    submissions.forEach(submission => {
        if (y > 270) {
            doc.addPage();
            y = 20;
        }
        
        const percentage = submission.total > 0 
            ? Math.round((submission.score / submission.total) * 100) 
            : 0;
        
        doc.text(`${submission.student.name}`, 20, y);
        doc.text(`${submission.score}/${submission.total} (${percentage}%)`, 150, y);
        y += 6;
    });
    
    doc.save('resultats-quiz.pdf');
}

// Afficher un état vide
function showEmptyState(message) {
    document.querySelector('.resultats-container').innerHTML = `
        <div class="empty-state" style="margin-top: 100px;">
            <div class="empty-icon">⚠️</div>
            <h3>${message}</h3>
            <p>Retournez au générateur de quiz pour créer un nouveau quiz.</p>
            <a href="generateur-quiz.html" class="btn-action" style="margin-top: 20px; display: inline-block;">
                Retour au générateur
            </a>
        </div>
    `;
}
