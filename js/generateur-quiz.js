// Générateur de Quiz - JavaScript (Version Manuel)

let currentStep = 1;
let generatedQuiz = null;
let questions = [];
let questionCounter = 0;

// Initialisation
document.addEventListener('DOMContentLoaded', function() {
    initializeClassSelect();
    addQuestion(); // Ajouter une première question par défaut
});

// Charger les classes disponibles
function initializeClassSelect() {
    const classeSelect = document.getElementById('classe-select');
    
    if (typeof LISTES_ELEVES !== 'undefined') {
        const classes = Object.keys(LISTES_ELEVES);
        classes.forEach(classe => {
            const option = document.createElement('option');
            option.value = classe;
            option.textContent = classe;
            classeSelect.appendChild(option);
        });
    }
}

// Navigation entre les étapes
function goToStep(step) {
    document.querySelectorAll('.quiz-step').forEach(s => s.classList.remove('active'));
    document.getElementById(`step-${step}`).classList.add('active');
    currentStep = step;
}

// Ajouter une nouvelle question
function addQuestion() {
    questionCounter++;
    const questionsList = document.getElementById('questions-list');
    
    const questionDiv = document.createElement('div');
    questionDiv.className = 'question-editor';
    questionDiv.id = `question-${questionCounter}`;
    questionDiv.dataset.questionId = questionCounter;
    
    questionDiv.innerHTML = `
        <div class="question-header">
            <h3>Question ${questionCounter}</h3>
            <button class="btn-remove-question" onclick="removeQuestion(${questionCounter})" title="Supprimer cette question">
                🗑️
            </button>
        </div>
        
        <div class="config-group">
            <label>Type de question :</label>
            <select class="question-type" onchange="updateQuestionType(${questionCounter})">
                <option value="qcm">QCM (Choix multiples)</option>
                <option value="vf">Vrai/Faux</option>
                <option value="texte">Réponse courte (texte)</option>
            </select>
        </div>
        
        <div class="config-group">
            <label>Énoncé de la question :</label>
            <textarea class="question-text" rows="3" placeholder="Saisissez votre question ici..."></textarea>
        </div>
        
        <div class="config-group question-options" id="options-${questionCounter}">
            <label>Réponses possibles :</label>
            <div class="options-list" id="options-list-${questionCounter}">
                <!-- Les options seront ajoutées ici -->
            </div>
            <button class="btn-add-option" onclick="addOption(${questionCounter})">
                ➕ Ajouter une réponse
            </button>
        </div>
        
        <div class="config-group question-answer-text" id="answer-text-${questionCounter}" style="display: none;">
            <label>Réponse attendue (pour correction) :</label>
            <textarea class="answer-text" rows="2" placeholder="Saisissez la réponse attendue..."></textarea>
        </div>
        
        <div class="config-group">
            <label>Points :</label>
            <input type="number" class="question-points" min="1" max="100" value="1">
        </div>
    `;
    
    questionsList.appendChild(questionDiv);
    updateQuestionType(questionCounter);
}

// Mettre à jour le type de question
function updateQuestionType(questionId) {
    const questionDiv = document.getElementById(`question-${questionId}`);
    const typeSelect = questionDiv.querySelector('.question-type');
    const optionsDiv = questionDiv.querySelector('.question-options');
    const answerTextDiv = questionDiv.querySelector('.question-answer-text');
    const optionsList = document.getElementById(`options-list-${questionId}`);
    
    const type = typeSelect.value;
    
    if (type === 'qcm') {
        optionsDiv.style.display = 'block';
        answerTextDiv.style.display = 'none';
        
        // Réinitialiser avec 4 options par défaut si vide
        if (optionsList.children.length === 0) {
            for (let i = 0; i < 4; i++) {
                addOption(questionId);
            }
        }
    } else if (type === 'vf') {
        optionsDiv.style.display = 'block';
        answerTextDiv.style.display = 'none';
        
        // Créer les options Vrai/Faux
        optionsList.innerHTML = `
            <div class="option-item">
                <input type="radio" name="correct-${questionId}" class="option-correct">
                <input type="text" class="option-text" value="Vrai" readonly>
            </div>
            <div class="option-item">
                <input type="radio" name="correct-${questionId}" class="option-correct">
                <input type="text" class="option-text" value="Faux" readonly>
            </div>
        `;
    } else if (type === 'texte') {
        optionsDiv.style.display = 'none';
        answerTextDiv.style.display = 'block';
    }
}

// Ajouter une option de réponse
function addOption(questionId) {
    const optionsList = document.getElementById(`options-list-${questionId}`);
    const optionCount = optionsList.children.length + 1;
    
    const optionDiv = document.createElement('div');
    optionDiv.className = 'option-item';
    optionDiv.innerHTML = `
        <input type="radio" name="correct-${questionId}" class="option-correct" title="Cocher si c'est la bonne réponse">
        <input type="text" class="option-text" placeholder="Réponse ${optionCount}">
        <button class="btn-remove-option" onclick="this.parentElement.remove()" title="Supprimer cette réponse">❌</button>
    `;
    
    optionsList.appendChild(optionDiv);
}

// Supprimer une question
function removeQuestion(questionId) {
    const questionDiv = document.getElementById(`question-${questionId}`);
    if (questionDiv) {
        if (confirm('Voulez-vous vraiment supprimer cette question ?')) {
            questionDiv.remove();
            renumberQuestions();
        }
    }
}

// Renuméroter les questions après suppression
function renumberQuestions() {
    const questionDivs = document.querySelectorAll('.question-editor');
    questionDivs.forEach((div, index) => {
        const header = div.querySelector('.question-header h3');
        header.textContent = `Question ${index + 1}`;
    });
}

// Valider et afficher l'aperçu
function validateAndPreview() {
    const titre = document.getElementById('quiz-titre').value.trim();
    
    if (!titre) {
        alert('⚠️ Veuillez saisir un titre pour le quiz.');
        return;
    }
    
    // Collecter toutes les questions
    const questionDivs = document.querySelectorAll('.question-editor');
    
    if (questionDivs.length === 0) {
        alert('⚠️ Veuillez ajouter au moins une question.');
        return;
    }
    
    questions = [];
    let hasError = false;
    
    questionDivs.forEach((div, index) => {
        const questionText = div.querySelector('.question-text').value.trim();
        const type = div.querySelector('.question-type').value;
        const points = parseInt(div.querySelector('.question-points').value) || 1;
        
        if (!questionText) {
            alert(`⚠️ La question ${index + 1} n'a pas d'énoncé.`);
            hasError = true;
            return;
        }
        
        const question = {
            id: index + 1,
            question: questionText,
            type: type,
            points: points
        };
        
        if (type === 'qcm' || type === 'vf') {
            const optionInputs = div.querySelectorAll('.option-text');
            const correctRadio = div.querySelector('input[name="correct-' + div.dataset.questionId + '"]:checked');
            
            const options = Array.from(optionInputs).map(input => input.value.trim()).filter(v => v);
            
            if (options.length < 2) {
                alert(`⚠️ La question ${index + 1} doit avoir au moins 2 réponses possibles.`);
                hasError = true;
                return;
            }
            
            if (!correctRadio) {
                alert(`⚠️ La question ${index + 1} : veuillez cocher la bonne réponse.`);
                hasError = true;
                return;
            }
            
            const correctIndex = Array.from(div.querySelectorAll('.option-correct')).indexOf(correctRadio);
            
            question.reponses = options;
            question.bonneReponse = correctIndex;
        } else if (type === 'texte') {
            const answerText = div.querySelector('.answer-text').value.trim();
            
            if (!answerText) {
                alert(`⚠️ La question ${index + 1} : veuillez saisir la réponse attendue.`);
                hasError = true;
                return;
            }
            
            question.reponseAttendue = answerText;
        }
        
        questions.push(question);
    });
    
    if (hasError) {
        return;
    }
    
    // Créer l'objet quiz complet
    generatedQuiz = {
        id: generateQuizId(),
        titre: titre,
        matiere: document.getElementById('quiz-matiere').value.trim() || 'Non spécifié',
        classe: document.getElementById('classe-select').value || 'Non spécifié',
        duree: parseInt(document.getElementById('quiz-duree').value) || 15,
        description: document.getElementById('quiz-description').value.trim(),
        dateCreation: new Date().toISOString(),
        nbQuestions: questions.length,
        questions: questions
    };
    
    // Afficher l'aperçu
    displayPreview();
    goToStep(3);
}

// Afficher l'aperçu du quiz
function displayPreview() {
    const preview = document.getElementById('quiz-preview');
    const previewTitre = document.getElementById('preview-titre');
    const previewInfo = document.getElementById('preview-info');
    const previewContainer = document.getElementById('preview-questions-container');
    
    previewTitre.textContent = generatedQuiz.titre;
    previewInfo.innerHTML = `
        📚 ${generatedQuiz.matiere} • 🎓 ${generatedQuiz.classe} • 
        ⏱️ ${generatedQuiz.duree} min • 
        ❓ ${generatedQuiz.nbQuestions} question${generatedQuiz.nbQuestions > 1 ? 's' : ''}
        ${generatedQuiz.description ? '<br><em>' + generatedQuiz.description + '</em>' : ''}
    `;
    
    previewContainer.innerHTML = '';
    
    generatedQuiz.questions.forEach((q, index) => {
        const questionDiv = document.createElement('div');
        questionDiv.className = 'preview-question';
        
        let optionsHTML = '';
        
        if (q.type === 'qcm' || q.type === 'vf') {
            optionsHTML = `
                <div class="preview-options">
                    ${q.reponses.map((rep, i) => `
                        <div class="preview-option ${i === q.bonneReponse ? 'correct-answer' : ''}">
                            <span class="option-letter">${String.fromCharCode(65 + i)}</span>
                            <span>${rep}</span>
                            ${i === q.bonneReponse ? '<span class="correct-mark">✓ Bonne réponse</span>' : ''}
                        </div>
                    `).join('')}
                </div>
            `;
        } else if (q.type === 'texte') {
            optionsHTML = `
                <div class="preview-answer-text">
                    <strong>Réponse attendue :</strong> ${q.reponseAttendue}
                </div>
            `;
        }
        
        questionDiv.innerHTML = `
            <div class="preview-question-header">
                <span class="preview-question-number">Question ${index + 1}</span>
                <span class="preview-question-points">${q.points} point${q.points > 1 ? 's' : ''}</span>
            </div>
            <div class="preview-question-text">${q.question}</div>
            ${optionsHTML}
        `;
        
        previewContainer.appendChild(questionDiv);
    });
    
    preview.style.display = 'block';
}

// Générer un ID unique pour le quiz
function generateQuizId() {
    return 'quiz_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Sauvegarder le quiz dans localStorage
function saveQuiz() {
    if (!generatedQuiz) {
        alert('⚠️ Aucun quiz à sauvegarder.');
        return;
    }
    
    // Récupérer les quiz existants
    let quizData = JSON.parse(localStorage.getItem('QUIZ_DATA') || '{"quiz": []}');
    let eprofQuizzes = JSON.parse(localStorage.getItem('eprof_quizzes') || '[]');
    
    // Vérifier si le quiz existe déjà (en mode édition)
    const existingIndex = quizData.quiz.findIndex(q => q.id === generatedQuiz.id);
    const eprofIndex = eprofQuizzes.findIndex(q => q.id === generatedQuiz.id);
    
    if (existingIndex >= 0) {
        // Mettre à jour le quiz existant
        quizData.quiz[existingIndex] = generatedQuiz;
        alert('✓ Quiz mis à jour avec succès !');
    } else {
        // Ajouter le nouveau quiz
        quizData.quiz.push(generatedQuiz);
        alert('✓ Quiz sauvegardé avec succès !');
    }
    
    // Synchroniser avec eprof_quizzes
    if (eprofIndex >= 0) {
        eprofQuizzes[eprofIndex] = generatedQuiz;
    } else {
        eprofQuizzes.push(generatedQuiz);
    }
    
    // Sauvegarder dans localStorage (les deux clés)
    localStorage.setItem('QUIZ_DATA', JSON.stringify(quizData));
    localStorage.setItem('eprof_quizzes', JSON.stringify(eprofQuizzes));
    
    // Rediriger vers l'accueil
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 1000);
}

// Générer un lien partageable
function generateShareableLink() {
    if (!generatedQuiz) {
        alert('⚠️ Veuillez d''abord créer un quiz.');
        return;
    }
    
    // Sauvegarder d'abord le quiz (dans les deux systèmes)
    let quizData = JSON.parse(localStorage.getItem('QUIZ_DATA') || '{"quiz": []}');
    let eprofQuizzes = JSON.parse(localStorage.getItem('eprof_quizzes') || '[]');
    
    const existingIndex = quizData.quiz.findIndex(q => q.id === generatedQuiz.id);
    const eprofIndex = eprofQuizzes.findIndex(q => q.id === generatedQuiz.id);
    
    if (existingIndex < 0) {
        quizData.quiz.push(generatedQuiz);
        localStorage.setItem('QUIZ_DATA', JSON.stringify(quizData));
    }
    
    if (eprofIndex < 0) {
        eprofQuizzes.push(generatedQuiz);
    } else {
        eprofQuizzes[eprofIndex] = generatedQuiz;
    }
    localStorage.setItem('eprof_quizzes', JSON.stringify(eprofQuizzes));
    
    // Générer le lien
    const baseUrl = window.location.origin + window.location.pathname.replace('generateur-quiz.html', '');
    const shareLink = `${baseUrl}quiz-eleve.html?id=${generatedQuiz.id}`;
    
    // Créer une modale avec le lien et le QR code
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.8); display: flex; align-items: center;
        justify-content: center; z-index: 10000;
    `;
    
    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 12px; max-width: 600px; width: 90%;">
            <h2 style="margin-top: 0;">📤 Partager le quiz avec les élèves</h2>
            
            <div style="margin: 20px 0;">
                <label style="display: block; font-weight: 600; margin-bottom: 8px;">Lien du quiz :</label>
                <div style="display: flex; gap: 10px;">
                    <input type="text" id="share-link-input" value="${shareLink}" readonly
                           style="flex: 1; padding: 10px; border: 2px solid #e2e8f0; border-radius: 6px; font-size: 14px;">
                    <button onclick="copyShareLink()" style="padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                        📋 Copier
                    </button>
                </div>
            </div>
            
            <div style="margin: 20px 0; text-align: center;">
                <p style="font-weight: 600; margin-bottom: 10px;">QR Code :</p>
                <div id="qrcode-container" style="display: inline-block; padding: 10px; background: white; border: 2px solid #e2e8f0; border-radius: 8px;"></div>
            </div>
            
            <div style="text-align: center; margin-top: 20px;">
                <button onclick="this.closest(''div[style*=fixed]'').remove()" 
                        style="padding: 10px 30px; background: #64748b; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                    Fermer
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Générer le QR code
    generateQRCode(shareLink);
}

// Générer le QR code
function generateQRCode(url) {
    const container = document.getElementById('qrcode-container');
    
    if (!container) {
        console.error('Container qrcode-container introuvable');
        return;
    }
    
    container.innerHTML = '';
    
    // Utiliser une API externe pour générer le QR code
    const qrCodeURL = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
    
    const img = document.createElement('img');
    img.src = qrCodeURL;
    img.alt = 'QR Code du quiz';
    img.style.cssText = 'max-width: 200px; height: auto;';
    
    container.appendChild(img);
}

// Copier le lien partageable
function copyShareLink() {
    const input = document.getElementById('share-link-input');
    input.select();
    document.execCommand('copy');
    
    const btn = event.target;
    const originalText = btn.textContent;
    btn.textContent = '✓ Copié !';
    btn.style.background = '#10b981';
    
    setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '#3b82f6';
    }, 2000);
}

// Exporter le quiz en PDF
function exportQuiz() {
    if (!generatedQuiz) {
        alert('⚠️ Aucun quiz à exporter.');
        return;
    }
    
    if (typeof jspdf === 'undefined' && typeof window.jspdf === 'undefined') {
        alert('❌ La bibliothèque jsPDF n''est pas chargée.');
        return;
    }
    
    const { jsPDF } = window.jspdf || jspdf;
    const doc = new jsPDF();
    
    let y = 20;
    const lineHeight = 7;
    const pageHeight = 280;
    
    // Titre
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text(generatedQuiz.titre, 105, y, { align: 'center' });
    y += 10;
    
    // Informations
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Matière : ${generatedQuiz.matiere} | Classe : ${generatedQuiz.classe} | Durée : ${generatedQuiz.duree} min`, 105, y, { align: 'center' });
    y += 15;
    
    // Description si présente
    if (generatedQuiz.description) {
        doc.setFontSize(9);
        doc.setFont(undefined, 'italic');
        const descLines = doc.splitTextToSize(generatedQuiz.description, 180);
        doc.text(descLines, 15, y);
        y += descLines.length * lineHeight + 5;
    }
    
    // Questions
    doc.setFont(undefined, 'normal');
    
    generatedQuiz.questions.forEach((q, index) => {
        // Vérifier si on doit ajouter une nouvelle page
        if (y > pageHeight - 40) {
            doc.addPage();
            y = 20;
        }
        
        // Numéro et question
        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        const questionLines = doc.splitTextToSize(`${index + 1}. ${q.question}`, 180);
        doc.text(questionLines, 15, y);
        y += questionLines.length * lineHeight + 2;
        
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        
        // Options de réponse
        if (q.type === 'qcm' || q.type === 'vf') {
            q.reponses.forEach((rep, i) => {
                if (y > pageHeight - 10) {
                    doc.addPage();
                    y = 20;
                }
                
                const letter = String.fromCharCode(65 + i);
                const repLines = doc.splitTextToSize(`   ${letter}) ${rep}`, 175);
                doc.text(repLines, 20, y);
                y += repLines.length * lineHeight;
            });
        } else if (q.type === 'texte') {
            doc.text('   Réponse : ___________________________________', 20, y);
            y += lineHeight;
        }
        
        y += 5;
    });
    
    // Télécharger le PDF
    const fileName = `Quiz_${generatedQuiz.titre.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
    
    alert(`✓ Quiz exporté en PDF !\n\nFichier : ${fileName}`);
}

// Créer un nouveau quiz
function newQuiz() {
    if (confirm('Créer un nouveau quiz ? Les modifications non sauvegardées seront perdues.')) {
        location.reload();
    }
}
