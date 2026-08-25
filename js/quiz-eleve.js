// Quiz Élève - JavaScript

let currentQuiz = null;
let currentQuestionIndex = 0;
let studentAnswers = [];
let studentInfo = {};
let startTime = null;

// Initialisation
document.addEventListener('DOMContentLoaded', function() {
    loadQuizFromURL();
});

// Charger le quiz depuis l'URL
function loadQuizFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const quizId = urlParams.get('id');
    
    if (!quizId) {
        showError();
        return;
    }
    
    // Charger le quiz depuis localStorage
    const quiz = loadQuizById(quizId);
    
    if (!quiz) {
        showError();
        return;
    }
    
    currentQuiz = quiz;
    displayQuizIntro();
}

// Charger un quiz par son ID
function loadQuizById(quizId) {
    try {
        const quizzes = JSON.parse(localStorage.getItem('eprof_quizzes') || '[]');
        return quizzes.find(q => q.id === quizId);
    } catch (error) {
        console.error('Erreur chargement quiz:', error);
        return null;
    }
}

// Afficher l'intro du quiz
function displayQuizIntro() {
    document.getElementById('quiz-title-intro').textContent = currentQuiz.titre;
    document.getElementById('quiz-description').textContent = 
        'Répondez aux questions suivantes. Prenez votre temps et lisez attentivement.';
    document.getElementById('quiz-questions-count').textContent = 
        `${currentQuiz.nbQuestions} questions`;
    document.getElementById('quiz-niveau').textContent = 
        `Niveau: ${currentQuiz.niveau}`;
    
    showSection('quiz-intro');
}

// Démarrer le quiz
function startQuiz() {
    const name = document.getElementById('student-name').value.trim();
    
    if (!name) {
        alert('⚠️ Veuillez entrer votre nom.');
        return;
    }
    
    studentInfo = {
        name: name,
        classe: document.getElementById('student-classe').value.trim(),
        startTime: new Date().toISOString()
    };
    
    startTime = Date.now();
    currentQuestionIndex = 0;
    studentAnswers = new Array(currentQuiz.questions.length).fill(null);
    
    showSection('quiz-questions');
    displayQuestion(0);
}

// Afficher une question
function displayQuestion(index) {
    currentQuestionIndex = index;
    const question = currentQuiz.questions[index];
    
    // Mettre à jour la progression
    const progress = ((index + 1) / currentQuiz.questions.length) * 100;
    document.getElementById('progress-bar').style.width = progress + '%';
    document.getElementById('current-question').textContent = index + 1;
    document.getElementById('total-questions').textContent = currentQuiz.questions.length;
    
    // Afficher la question
    const container = document.getElementById('question-container');
    container.innerHTML = `
        <div class="question-header">
            <span class="question-type-badge">${question.type}</span>
        </div>
        <div class="question-text">${question.question}</div>
        ${renderAnswerInput(question, index)}
    `;
    
    // Restaurer la réponse si elle existe
    if (studentAnswers[index] !== null) {
        restoreAnswer(question, index);
    }
    
    // Gérer les boutons de navigation
    document.getElementById('btn-prev').disabled = index === 0;
    
    const btnNext = document.getElementById('btn-next');
    if (index === currentQuiz.questions.length - 1) {
        btnNext.textContent = '✅ Terminer';
        btnNext.className = 'btn-nav btn-submit';
    } else {
        btnNext.textContent = 'Suivant →';
        btnNext.className = 'btn-nav btn-next';
    }
}

// Générer l'input de réponse selon le type de question
function renderAnswerInput(question, index) {
    if (question.options) {
        // QCM ou Vrai/Faux
        let html = '<div class="answer-options">';
        question.options.forEach((option, optIndex) => {
            const letter = String.fromCharCode(65 + optIndex);
            html += `
                <label class="answer-option" data-option="${optIndex}">
                    <input type="radio" name="question-${index}" value="${optIndex}" 
                           onchange="selectAnswer(${index}, ${optIndex})">
                    <span class="answer-label">${letter}.</span>
                    <span class="answer-text">${option.text}</span>
                </label>
            `;
        });
        html += '</div>';
        return html;
    } else {
        // Réponse libre
        return `
            <div class="answer-free">
                <textarea id="free-answer-${index}" 
                          placeholder="Tapez votre réponse ici..."
                          onchange="selectFreeAnswer(${index}, this.value)"></textarea>
            </div>
        `;
    }
}

// Sélectionner une réponse QCM
function selectAnswer(questionIndex, optionIndex) {
    studentAnswers[questionIndex] = {
        type: 'choice',
        value: optionIndex
    };
    
    // Mettre à jour visuellement
    const options = document.querySelectorAll(`label[data-option]`);
    options.forEach(opt => opt.classList.remove('selected'));
    const selected = document.querySelector(`label[data-option="${optionIndex}"]`);
    if (selected) selected.classList.add('selected');
}

// Sélectionner une réponse libre
function selectFreeAnswer(questionIndex, value) {
    studentAnswers[questionIndex] = {
        type: 'free',
        value: value.trim()
    };
}

// Restaurer une réponse
function restoreAnswer(question, index) {
    const answer = studentAnswers[index];
    if (!answer) return;
    
    if (answer.type === 'choice') {
        const radio = document.querySelector(`input[name="question-${index}"][value="${answer.value}"]`);
        if (radio) {
            radio.checked = true;
            const label = radio.closest('label');
            if (label) label.classList.add('selected');
        }
    } else if (answer.type === 'free') {
        const textarea = document.getElementById(`free-answer-${index}`);
        if (textarea) textarea.value = answer.value;
    }
}

// Question suivante
function nextQuestion() {
    if (currentQuestionIndex === currentQuiz.questions.length - 1) {
        submitQuiz();
    } else {
        displayQuestion(currentQuestionIndex + 1);
    }
}

// Question précédente
function previousQuestion() {
    if (currentQuestionIndex > 0) {
        displayQuestion(currentQuestionIndex - 1);
    }
}

// Soumettre le quiz
function submitQuiz() {
    // Vérifier si toutes les questions ont une réponse
    const unanswered = studentAnswers.findIndex(a => a === null);
    if (unanswered !== -1) {
        if (!confirm(`⚠️ Vous n'avez pas répondu à toutes les questions (Question ${unanswered + 1} non répondue). Voulez-vous quand même soumettre ?`)) {
            displayQuestion(unanswered);
            return;
        }
    }
    
    // Calculer le score
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000); // en secondes
    
    let correctCount = 0;
    currentQuiz.questions.forEach((question, index) => {
        const answer = studentAnswers[index];
        if (!answer) return;
        
        if (answer.type === 'choice' && question.options) {
            if (question.options[answer.value]?.correct) {
                correctCount++;
            }
        }
    });
    
    // Sauvegarder la soumission
    const submission = {
        quizId: currentQuiz.id,
        student: studentInfo,
        answers: studentAnswers,
        score: correctCount,
        total: currentQuiz.questions.filter(q => q.options).length,
        duration: duration,
        submittedAt: new Date().toISOString()
    };
    
    saveSubmission(submission);
    
    // Afficher les résultats
    displayResults(submission);
}

// Sauvegarder une soumission
function saveSubmission(submission) {
    try {
        const submissions = JSON.parse(localStorage.getItem('eprof_quiz_submissions') || '[]');
        submissions.push(submission);
        localStorage.setItem('eprof_quiz_submissions', JSON.stringify(submissions));
    } catch (error) {
        console.error('Erreur sauvegarde soumission:', error);
    }
}

// Afficher les résultats
function displayResults(submission) {
    showSection('quiz-results');
    
    document.getElementById('final-score').textContent = submission.score;
    document.getElementById('total-score').textContent = submission.total;
    
    const percentage = submission.total > 0 
        ? Math.round((submission.score / submission.total) * 100) 
        : 0;
    document.getElementById('score-percentage').textContent = `${percentage}% de réussite`;
    
    // Résumé des réponses
    const summaryContainer = document.getElementById('answers-summary');
    let summaryHTML = '<h3 style="margin-bottom: 15px; color: #1e293b;">Récapitulatif</h3>';
    
    currentQuiz.questions.forEach((question, index) => {
        const answer = studentAnswers[index];
        let isCorrect = false;
        let icon = '📝';
        let className = '';
        
        if (answer && answer.type === 'choice' && question.options) {
            isCorrect = question.options[answer.value]?.correct;
            icon = isCorrect ? '✅' : '❌';
            className = isCorrect ? 'correct' : 'incorrect';
        }
        
        summaryHTML += `
            <div class="summary-item ${className}">
                <span class="summary-icon">${icon}</span>
                <span class="summary-text">
                    Question ${index + 1}: ${question.type}
                    ${answer ? (answer.type === 'choice' ? '' : '(Réponse libre)') : '(Non répondu)'}
                </span>
            </div>
        `;
    });
    
    summaryContainer.innerHTML = summaryHTML;
    
    // Info de soumission
    const minutes = Math.floor(submission.duration / 60);
    const seconds = submission.duration % 60;
    document.getElementById('submission-info').textContent = 
        `Quiz soumis le ${new Date(submission.submittedAt).toLocaleString('fr-FR')} • Temps: ${minutes}m ${seconds}s`;
}

// Revoir les réponses
function reviewAnswers() {
    showSection('quiz-questions');
    currentQuestionIndex = 0;
    displayQuestion(0);
    
    // Désactiver la modification et afficher les corrections
    setTimeout(() => {
        document.querySelectorAll('input, textarea').forEach(el => {
            el.disabled = true;
        });
        
        // Afficher les corrections pour les QCM
        currentQuiz.questions.forEach((question, qIndex) => {
            if (question.options) {
                question.options.forEach((option, oIndex) => {
                    const label = document.querySelector(`label[data-option="${oIndex}"]`);
                    if (label) {
                        if (option.correct) {
                            label.classList.add('correct');
                        }
                        const answer = studentAnswers[qIndex];
                        if (answer && answer.type === 'choice' && answer.value === oIndex && !option.correct) {
                            label.classList.add('incorrect');
                        }
                    }
                });
            }
        });
        
        document.getElementById('btn-next').textContent = 'Question suivante →';
        document.getElementById('btn-next').className = 'btn-nav btn-next';
    }, 100);
}

// Afficher une section
function showSection(sectionId) {
    document.querySelectorAll('.quiz-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionId).classList.add('active');
}

// Afficher une erreur
function showError() {
    showSection('quiz-error');
}
