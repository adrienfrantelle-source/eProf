// ===== INITIALISATION =====
let pdfFullscreenMode = false;
let canvas, ctx;
let isDrawing = false;
let currentTool = null;
let currentColor = '#000000';
let lineWidth = 3;
let timerInterval = null;
let timerSeconds = 0;
let timerRunning = false;
let timerBaseSeconds = 0;
let timerStartTimestamp = null;

// Système de pagination
let currentPage = 1;
const totalPages = 3;
let pageStates = {
    1: { canvasData: null, panels: {} },
    2: { canvasData: null, panels: {} },
    3: { canvasData: null, panels: {} }
};

// ===== CHARGEMENT =====
window.addEventListener('DOMContentLoaded', () => {
    // Charger la préférence de fond
    loadBackgroundPreference();
    
    // Initialiser le canvas
    initCanvas();
    
    // Événements des boutons de contrôle
    document.getElementById('fullscreen-btn').addEventListener('click', toggleFullscreen);
    document.getElementById('settings-btn').addEventListener('click', () => openToolPanel('settings-panel'));
    
    // Événements des outils
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const toolId = e.currentTarget.id;
            handleToolClick(toolId);
        });
    });
    
    // Initialiser l'horloge
    updateClock();
    setInterval(updateClock, 1000);
    
    // Initialiser le calendrier
    updateCalendar();
    
    // Initialiser le sélecteur de classe
    initStudentPicker();
    
    // Charger les notes sauvegardées
    loadNotes();
    
    // Initialiser l'éditeur de notes
    initNotesEditor();
    
    // Initialiser la visionneuse PDF
    initPDFViewer();
    
    // Initialiser le nuage de mots
    WordCloud.init();
    
    // Événements outil dessin
    const colorPicker = document.getElementById('draw-color');
    const widthSlider = document.getElementById('draw-width');
    const widthValue = document.getElementById('width-value');
    
    if (colorPicker) {
        colorPicker.addEventListener('input', (e) => {
            currentColor = e.target.value;
        });
    }
    
    if (widthSlider) {
        widthSlider.addEventListener('input', (e) => {
            lineWidth = parseInt(e.target.value);
            if (widthValue) {
                widthValue.textContent = lineWidth;
            }
        });
    }
    
    // Initialiser le drag and drop pour toutes les modales
    initDraggablePanels();
    bindTaskbarControls();
    
    // Charger les couleurs sauvegardées des panneaux
    loadPanelColors();
    
    // Initialiser le système de pages
    loadPagesFromStorage();
    loadPage(currentPage);
    updatePageIndicator();
});

// ===== FOND ALÉATOIRE =====
function loadRandomBackground() {
    // Liste des images de fond possibles (35 images)
    const backgrounds = Array.from({length: 35}, (_, i) => `img/fond${i + 1}.jpg`);
    
    // Sélectionner une image aléatoire
    const randomBg = backgrounds[Math.floor(Math.random() * backgrounds.length)];
    console.log('Tentative de chargement du fond:', randomBg);
    
    // Vérifier si l'image existe, sinon utiliser une couleur de fond
    const img = new Image();
    img.onload = () => {
        console.log('Image chargée avec succès:', randomBg);
        document.body.style.backgroundImage = `url('${randomBg}')`;
    };
    img.onerror = () => {
        console.error('Erreur chargement image:', randomBg);
        // Fond par défaut si pas d'image
        document.body.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    };
    img.src = randomBg;
}

function loadBackgroundPreference() {
    const savedBgType = localStorage.getItem('tableauBlancBgType');
    const whiteCheckbox = document.getElementById('white-background');
    
    // Par défaut : images aléatoires (pas de fond blanc)
    if (savedBgType === 'white') {
        if (whiteCheckbox) whiteCheckbox.checked = true;
        document.body.style.backgroundImage = 'none';
        document.body.style.background = '#ffffff';
    } else {
        if (whiteCheckbox) whiteCheckbox.checked = false;
        loadRandomBackground();
    }
}

function changeBackground() {
    // Charger une nouvelle image aléatoire (ne change que l'image)
    const isWhite = document.getElementById('white-background')?.checked;
    if (!isWhite) {
        loadRandomBackground();
    }
}

function toggleWhiteBackground() {
    const isWhite = document.getElementById('white-background').checked;
    if (isWhite) {
        document.body.style.backgroundImage = 'none';
        document.body.style.background = '#ffffff';
        localStorage.setItem('tableauBlancBgType', 'white');
    } else {
        loadRandomBackground();
        localStorage.setItem('tableauBlancBgType', 'random');
    }
}

// ===== CANVAS =====
function initCanvas() {
    canvas = document.getElementById('whiteboard-canvas');
    ctx = canvas.getContext('2d');
    
    // Ajuster la taille du canvas
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Événements de dessin
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    
    // Support tactile
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousedown', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        canvas.dispatchEvent(mouseEvent);
    });
    
    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousemove', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        canvas.dispatchEvent(mouseEvent);
    });
    
    canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        const mouseEvent = new MouseEvent('mouseup', {});
        canvas.dispatchEvent(mouseEvent);
    });
}

function resizeCanvas() {
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    tempCtx.drawImage(canvas, 0, 0);
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    if (tempCanvas.width > 0) {
        ctx.drawImage(tempCanvas, 0, 0);
    }
}

function startDrawing(e) {
    if (currentTool !== 'draw' && currentTool !== 'eraser') return;
    
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
}

function draw(e) {
    if (!isDrawing) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    ctx.lineTo(x, y);
    ctx.strokeStyle = currentTool === 'eraser' ? 'rgba(0, 0, 0, 0.1)' : currentColor;
    ctx.lineWidth = currentTool === 'eraser' ? lineWidth * 3 : lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    if (currentTool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
    } else {
        ctx.globalCompositeOperation = 'source-over';
    }
    
    ctx.stroke();
}

function stopDrawing() {
    if (isDrawing) {
        isDrawing = false;
        ctx.beginPath();
        // Sauvegarder après le dessin
        savePage(currentPage);
    }
}

function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Sauvegarder après effacement
    savePage(currentPage);
}

// ===== GESTION DES OUTILS =====
function openToolPanel(panelId) {
    const panel = document.getElementById(panelId);
    if (panel) {
        panel.style.display = 'block';
        panel.dataset.minimized = 'false';
        panel.classList.remove('panel-minimized');
        if (panel.dataset.maximized === 'true') {
            panel.style.transform = 'none';
        }
        bringPanelToFront(panel);
        refreshTaskbar();
        setTimeout(() => savePage(currentPage), 100);
    }
}

function closePanel(panelId) {
    const panel = document.getElementById(panelId);
    if (panel) {
        panel.style.display = 'none';
        panel.dataset.minimized = 'false';
        panel.classList.remove('panel-maximized');
        panel.style.transform = 'none';
        setTimeout(() => savePage(currentPage), 100);
    }
    const toolKey = panelId.replace('-panel', '-tool');
    const toolBtn = document.getElementById(toolKey);
    if (toolBtn) toolBtn.classList.remove('active');
    if (currentTool === toolKey.replace('-tool', '')) {
        currentTool = null;
    }
    canvas.style.cursor = 'crosshair';
    refreshTaskbar();
}

function minimizePanel(panelId) {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    panel.dataset.minimized = 'true';
    panel.style.display = 'none';
    panel.classList.add('panel-minimized');
    refreshTaskbar();
}

function toggleMaximizePanel(panelId) {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    const isMax = panel.dataset.maximized === 'true';
    panel.dataset.maximized = isMax ? 'false' : 'true';
    panel.classList.toggle('panel-maximized', !isMax);
    panel.style.transform = 'none';
    if (!isMax) {
        panel.dataset.normalWidth = panel.style.width || getComputedStyle(panel).width;
        panel.dataset.normalHeight = panel.style.height || getComputedStyle(panel).height;
        panel.dataset.normalLeft = panel.style.left || getComputedStyle(panel).left;
        panel.dataset.normalTop = panel.style.top || getComputedStyle(panel).top;
        panel.style.left = '20px';
        panel.style.top = '20px';
        panel.style.width = 'calc(100vw - 40px)';
        panel.style.height = 'calc(100vh - 120px)';
    } else {
        panel.style.left = panel.dataset.normalLeft || '50%';
        panel.style.top = panel.dataset.normalTop || '50%';
        panel.style.width = panel.dataset.normalWidth || '320px';
        panel.style.height = panel.dataset.normalHeight || 'auto';
    }
    bringPanelToFront(panel);
}

function refreshTaskbar() {
    const taskbar = document.getElementById('workspace-taskbar');
    if (!taskbar) return;
    const panels = [...document.querySelectorAll('.tool-panel')].filter(panel => (panel.style.display !== 'none') || (panel.dataset.minimized === 'true'));
    const items = panels.map(panel => {
        const label = panel.id.replace('-panel', '').replace(/-/g, ' ');
        const isMinimized = panel.dataset.minimized === 'true';
        return `<button type="button" class="task-btn ${isMinimized ? 'minimized' : 'active'}" data-panel-id="${panel.id}">${label}</button>`;
    }).join('');
    taskbar.innerHTML = items || '<span class="taskbar-empty">Aucun outil ouvert</span>';
    taskbar.querySelectorAll('.task-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const panel = document.getElementById(btn.dataset.panelId);
            if (!panel) return;
            if (panel.style.display === 'none') {
                panel.dataset.minimized = 'false';
                panel.style.display = 'block';
                bringPanelToFront(panel);
            } else {
                minimizePanel(panel.id);
            }
            refreshTaskbar();
        });
    });
}

function bindTaskbarControls() {
    document.querySelectorAll('.tool-panel').forEach(panel => {
        const controls = panel.querySelector('.panel-header-controls');
        if (!controls || controls.dataset.bound === 'true') return;
        controls.dataset.bound = 'true';
        const minBtn = document.createElement('button');
        minBtn.type = 'button';
        minBtn.className = 'panel-action-btn';
        minBtn.title = 'Réduire';
        minBtn.textContent = '—';
        minBtn.addEventListener('click', () => minimizePanel(panel.id));
        const maxBtn = document.createElement('button');
        maxBtn.type = 'button';
        maxBtn.className = 'panel-action-btn';
        maxBtn.title = 'Plein écran';
        maxBtn.textContent = '□';
        maxBtn.addEventListener('click', () => toggleMaximizePanel(panel.id));
        controls.insertBefore(maxBtn, controls.querySelector('.close-panel'));
        controls.insertBefore(minBtn, controls.querySelector('.close-panel'));
    });
}

function bringPanelToFront(panel) {
    const allPanels = document.querySelectorAll('.tool-panel');
    let maxZ = 200;
    allPanels.forEach(p => {
        const z = parseInt(window.getComputedStyle(p).zIndex) || 200;
        if (z > maxZ) maxZ = z;
    });
    panel.style.zIndex = maxZ + 1;
}

function changePanelColor(panelId, color) {
    const panel = document.getElementById(panelId);
    if (panel) {
        panel.style.backgroundColor = color;
        // Sauvegarder la couleur dans localStorage
        const savedColors = JSON.parse(localStorage.getItem('panelColors') || '{}');
        savedColors[panelId] = color;
        localStorage.setItem('panelColors', JSON.stringify(savedColors));
    }
}

function loadPanelColors() {
    const savedColors = JSON.parse(localStorage.getItem('panelColors') || '{}');
    Object.keys(savedColors).forEach(panelId => {
        const panel = document.getElementById(panelId);
        if (panel) {
            panel.style.backgroundColor = savedColors[panelId];
            // Mettre à jour le color picker
            const colorInput = panel.querySelector('.color-picker-btn input[type="color"]');
            if (colorInput) {
                colorInput.value = savedColors[panelId];
            }
        }
    });
}

function clearToolSelection() {
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    currentTool = null;
    canvas.style.cursor = 'crosshair';
}

function handleToolClick(toolId) {
    const toolBtn = document.getElementById(toolId);
    const panelId = toolId.replace('-tool', '-panel');
    const panel = document.getElementById(panelId);

    if (toolBtn && toolBtn.classList.contains('active') && panel && panel.style.display !== 'none') {
        minimizePanel(panelId);
        toolBtn.classList.remove('active');
        refreshTaskbar();
        return;
    }

    if (panel && panel.dataset.minimized === 'true') {
        panel.dataset.minimized = 'false';
        panel.style.display = 'block';
        if (toolBtn) toolBtn.classList.add('active');
        bringPanelToFront(panel);
        refreshTaskbar();
        return;
    }

    clearToolSelection();

    switch(toolId) {
        case 'draw-tool':
            currentTool = 'draw';
            if (toolBtn) toolBtn.classList.add('active');
            openToolPanel('draw-panel');
            break;
        case 'eraser-tool':
            currentTool = 'eraser';
            if (toolBtn) toolBtn.classList.add('active');
            canvas.style.cursor = 'grab';
            openToolPanel('draw-panel');
            break;
        case 'student-picker-tool':
            if (toolBtn) toolBtn.classList.add('active');
            openToolPanel('student-picker-panel');
            break;
        case 'timer-tool':
            if (toolBtn) toolBtn.classList.add('active');
            openToolPanel('timer-panel');
            break;
        case 'clock-tool':
            if (toolBtn) toolBtn.classList.add('active');
            openToolPanel('clock-panel');
            break;
        case 'calendar-tool':
            if (toolBtn) toolBtn.classList.add('active');
            openToolPanel('calendar-panel');
            break;
        case 'dice-tool':
            if (toolBtn) toolBtn.classList.add('active');
            openToolPanel('dice-panel');
            break;
        case 'qrcode-tool':
            if (toolBtn) toolBtn.classList.add('active');
            openToolPanel('qrcode-panel');
            break;
        case 'notes-tool':
            if (toolBtn) toolBtn.classList.add('active');
            openToolPanel('notes-panel');
            break;
        case 'wordcloud-tool':
            if (toolBtn) toolBtn.classList.add('active');
            openToolPanel('wordcloud-panel');
            break;
        case 'calculator-tool':
            if (toolBtn) toolBtn.classList.add('active');
            openToolPanel('calculator-panel');
            break;
        case 'pdf-viewer-tool':
            if (toolBtn) toolBtn.classList.add('active');
            openToolPanel('pdf-viewer-panel');
            break;
        default:
            clearToolSelection();
            break;
    }
}

// ===== DRAG AND DROP POUR LES PANNEAUX =====
function initDraggablePanels() {
    const panels = document.querySelectorAll('.tool-panel');
    
    panels.forEach(panel => {
        let isDragging = false;
        let isResizing = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;
        let xOffset = 0;
        let yOffset = 0;
        
        const header = panel.querySelector('.panel-header') || panel.querySelector('h3');
        const resizeHandle = panel.querySelector('.resize-handle');
        panel.style.left = panel.style.left || '50%';
        panel.style.top = panel.style.top || '50%';
        panel.style.transform = panel.dataset.maximized === 'true' ? 'none' : 'translate(-50%, -50%)';
        
        if (header) {
            header.addEventListener('mousedown', dragStart);
            document.addEventListener('mousemove', drag);
            document.addEventListener('mouseup', dragEnd);
            
            header.addEventListener('touchstart', dragStart);
            document.addEventListener('touchmove', drag);
            document.addEventListener('touchend', dragEnd);
        }
        
        // Gestion du resize
        if (resizeHandle) {
            resizeHandle.addEventListener('mousedown', resizeStart);
            document.addEventListener('mousemove', resize);
            document.addEventListener('mouseup', resizeEnd);
        }
        
        function dragStart(e) {
            if (panel.dataset.maximized === 'true') return;
            if (e.target.classList.contains('close-panel') ||
                e.target.closest('.color-picker-btn') ||
                e.target.closest('.panel-action-btn')) return;
            
            if (e.type === 'touchstart') {
                initialX = e.touches[0].clientX;
                initialY = e.touches[0].clientY;
            } else {
                initialX = e.clientX;
                initialY = e.clientY;
            }
            
            const panelRect = panel.getBoundingClientRect();
            xOffset = initialX - panelRect.left;
            yOffset = initialY - panelRect.top;
            
            if (e.target === header || header.contains(e.target)) {
                isDragging = true;
                panel.style.transform = 'none';
                bringPanelToFront(panel);
            }
        }
        
        function drag(e) {
            if (isDragging && !isResizing) {
                e.preventDefault();
                const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
                const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
                const nextLeft = Math.max(10, Math.min(window.innerWidth - panel.offsetWidth - 10, clientX - xOffset));
                const nextTop = Math.max(10, Math.min(window.innerHeight - panel.offsetHeight - 10, clientY - yOffset));
                panel.style.left = `${nextLeft}px`;
                panel.style.top = `${nextTop}px`;
            }
        }
        
        function dragEnd() {
            initialX = currentX;
            initialY = currentY;
            isDragging = false;
            if (!isResizing) {
                setTimeout(() => savePage(currentPage), 100);
            }
        }
        
        // Fonctions de redimensionnement
        let startWidth, startHeight, startX, startY;
        
        function resizeStart(e) {
            e.preventDefault();
            e.stopPropagation();
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startWidth = parseInt(window.getComputedStyle(panel).width, 10);
            startHeight = parseInt(window.getComputedStyle(panel).height, 10);
            bringPanelToFront(panel);
        }
        
        function resize(e) {
            if (isResizing) {
                e.preventDefault();
                const width = startWidth + (e.clientX - startX);
                const height = startHeight + (e.clientY - startY);
                
                if (width > 300) {
                    panel.style.width = width + 'px';
                }
                if (height > 200) {
                    panel.style.height = height + 'px';
                }
            }
        }
        
        function resizeEnd() {
            if (isResizing) {
                isResizing = false;
                setTimeout(() => savePage(currentPage), 100);
            }
        }
    });
}

// ===== OUTIL TIRAGE AU SORT =====
async function initStudentPicker() {
    const classSelect = document.getElementById('student-class-select');
    const groupsClassSelect = document.getElementById('groups-class-select');
    
    if (!classSelect) return;

    const premiereOption = classSelect.querySelector('option');
    classSelect.innerHTML = '';
    if (premiereOption) classSelect.appendChild(premiereOption);
    if (groupsClassSelect) {
        const premiereOptionGroupes = groupsClassSelect.querySelector('option');
        groupsClassSelect.innerHTML = '';
        if (premiereOptionGroupes) groupsClassSelect.appendChild(premiereOptionGroupes);
    }

    const activeLists = window.getAvailableStudentLists ? window.getAvailableStudentLists() : {};
    let classNames = window.getTeacherClassNames ? window.getTeacherClassNames() : [];
    if (!classNames.length && window.EprofStore && await window.EprofStore.isOnlineReady()) {
        try {
            const teacherId = await window.EprofStore.getTeacherId();
            const result = await window.EprofStore.list('profiles', { filters: { id: teacherId } });
            const profile = result.data && result.data[0];
            if (profile && Array.isArray(profile.classes) && profile.classes.length) {
                classNames = profile.classes.slice();
            }
        } catch (e) {}
    }
    if (!classNames.length) {
        classNames = Object.keys(activeLists).sort();
    } else {
        classNames = classNames.slice().sort();
    }
    classNames.forEach(className => {
        const option = document.createElement('option');
        option.value = className;
        option.textContent = className;
        classSelect.appendChild(option);

        if (groupsClassSelect) {
            const option2 = document.createElement('option');
            option2.value = className;
            option2.textContent = className;
            groupsClassSelect.appendChild(option2);
        }
    });
}

document.addEventListener('eprof-referentiel-maj', initStudentPicker);
window.addEventListener('teacherLoggedIn', initStudentPicker);
window.addEventListener('teacherDataReloaded', initStudentPicker);

// Basculer entre les onglets
function switchStudentTab(tab) {
    const randomTab = document.getElementById('random-tab-content');
    const groupsTab = document.getElementById('groups-tab-content');
    const tabs = document.querySelectorAll('.student-tab');
    
    tabs.forEach(t => t.classList.remove('active'));
    
    if (tab === 'random') {
        randomTab.style.display = 'block';
        groupsTab.style.display = 'none';
        tabs[0].classList.add('active');
    } else {
        randomTab.style.display = 'none';
        groupsTab.style.display = 'block';
        tabs[1].classList.add('active');
    }
}

// Afficher la liste des élèves pour marquer les absents (tirage élèves)
function getManualStudentList(className) {
    const storage = JSON.parse(localStorage.getItem('tableauBlancManualStudents') || '{}');
    const key = className || '__no_class__';
    return Array.isArray(storage[key]) ? storage[key] : [];
}

function saveManualStudentList(className, names) {
    const storage = JSON.parse(localStorage.getItem('tableauBlancManualStudents') || '{}');
    const key = className || '__no_class__';
    storage[key] = names;
    localStorage.setItem('tableauBlancManualStudents', JSON.stringify(storage));
}

function getClassStudentOptions(className) {
    const baseOptions = [];
    const listes = window.getAvailableStudentLists ? window.getAvailableStudentLists() : {};
    const lookup = className && className !== '__no_class__' ? className : '';
    if (lookup && listes[lookup]) {
        listes[lookup].forEach(student => {
            const fullName = `${student.prenom || ''} ${student.nom || ''}`.trim();
            if (fullName) baseOptions.push(fullName);
        });
    }
    const customNames = getManualStudentList(className);
    return [...new Set([...baseOptions, ...customNames])];
}

function renderManualStudentEditor(className, kind) {
    const container = document.getElementById(kind === 'random' ? 'manual-student-list-random' : 'manual-student-list-groups');
    if (!container) return;
    const names = getManualStudentList(className);
    const safeClassName = className || 'Sans classe';
    container.innerHTML = `
        <div class="manual-student-editor">
            <div class="manual-student-input-line">
                <input type="text" class="manual-student-input" placeholder="Ajouter un nom d'élève${className ? '' : ' (sans classe)'}">
                <button type="button" class="manual-student-add-btn" data-kind="${kind}" data-class="${safeClassName}">Ajouter</button>
            </div>
            <div class="manual-student-tags">
                ${names.length ? names.map(name => `
                    <span class="manual-student-tag">${name}
                        <button type="button" class="manual-student-remove" data-kind="${kind}" data-class="${safeClassName}" data-name="${name}">×</button>
                    </span>
                `).join('') : '<span class="manual-student-empty">Aucun nom manuel.</span>'}
            </div>
        </div>
    `;

    const addStudent = () => {
        const input = container.querySelector('.manual-student-input');
        const value = input ? input.value.trim() : '';
        if (!value) return;
        const targetClass = className || '__no_class__';
        const existing = getManualStudentList(targetClass);
        if (!existing.includes(value)) {
            saveManualStudentList(targetClass, [...existing, value]);
        }
        renderManualStudentEditor(targetClass, kind);
        if (kind === 'random') showAbsentPickerRandom();
        else showAbsentPickerGroups();
    };

    const addBtn = container.querySelector('.manual-student-add-btn');
    const input = container.querySelector('.manual-student-input');
    if (addBtn) {
        addBtn.addEventListener('click', addStudent);
    }
    if (input) {
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                addStudent();
            }
        });
    }

    container.querySelectorAll('.manual-student-remove').forEach(button => {
        button.addEventListener('click', () => {
            const selectedName = button.dataset.name;
            const selectedClass = className || '__no_class__';
            const existing = getManualStudentList(selectedClass).filter(name => name !== selectedName);
            saveManualStudentList(selectedClass, existing);
            renderManualStudentEditor(selectedClass, kind);
            if (kind === 'random') showAbsentPickerRandom();
            else showAbsentPickerGroups();
        });
    });
}

function showAbsentPickerRandom() {
    const className = document.getElementById('student-class-select').value;
    const container = document.getElementById('absent-list-random');
    const names = getClassStudentOptions(className || '__no_class__');
    
    if (!className) {
        renderManualStudentEditor(className || '__no_class__', 'random');
        if (!names.length) {
            container.innerHTML = '<p style="color: #ef4444; margin: 10px 0;">Aucun élève sélectionné. Ajoutez un nom manuel pour lancer le tirage.</p>';
            return;
        }
        container.innerHTML = `
            <div style="max-height: 300px; overflow-y: auto; border: 2px solid #e2e8f0; border-radius: 8px; padding: 15px; background: white;">
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px;">
                    ${names.map(name => `
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 8px; border-radius: 6px; transition: background 0.2s;" 
                               onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'">
                            <input type="checkbox" class="absent-checkbox-random" value="${name}" 
                                   style="width: 18px; height: 18px; cursor: pointer;">
                            <span style="font-size: 14px;">${name}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
        `;
        return;
    }

    if (!names.length) {
        container.innerHTML = '<p style="color: #ef4444; margin: 10px 0;">Aucun élève dans cette classe</p>';
        renderManualStudentEditor(className, 'random');
        return;
    }
    
    renderManualStudentEditor(className, 'random');
    container.innerHTML = `
        <div style="max-height: 300px; overflow-y: auto; border: 2px solid #e2e8f0; border-radius: 8px; padding: 15px; background: white;">
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px;">
                ${names.map(name => `
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 8px; border-radius: 6px; transition: background 0.2s;" 
                           onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'">
                        <input type="checkbox" class="absent-checkbox-random" value="${name.replace(/"/g, '&quot;')}" 
                               style="width: 18px; height: 18px; cursor: pointer;">
                        <span style="font-size: 14px;">${name}</span>
                    </label>
                `).join('')}
            </div>
        </div>
    `;
}

// Afficher la liste des élèves pour marquer les absents (groupes)
function showAbsentPickerGroups() {
    const className = document.getElementById('groups-class-select').value;
    const container = document.getElementById('absent-list-groups');
    
    if (!className) {
        container.innerHTML = '<p style="color: #ef4444; margin: 10px 0;">Sélectionnez d\'abord une classe</p>';
        renderManualStudentEditor('', 'groups');
        return;
    }
    
    const students = getClassStudentOptions(className);
    if (!students.length) {
        container.innerHTML = '<p style="color: #ef4444; margin: 10px 0;">Aucun élève dans cette classe</p>';
        renderManualStudentEditor(className, 'groups');
        return;
    }
    
    renderManualStudentEditor(className, 'groups');
    container.innerHTML = `
        <div style="max-height: 300px; overflow-y: auto; border: 2px solid #e2e8f0; border-radius: 8px; padding: 15px; background: white;">
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px;">
                ${students.map(name => `
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 8px; border-radius: 6px; transition: background 0.2s;" 
                           onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'">
                        <input type="checkbox" class="absent-checkbox-groups" value="${name}" 
                               style="width: 18px; height: 18px; cursor: pointer;">
                        <span style="font-size: 14px;">${name}</span>
                    </label>
                `).join('')}
            </div>
        </div>
    `;
}

// Mettre à jour le mode de groupes
function updateGroupsMode() {
    const mode = document.getElementById('groups-mode').value;
    const countLabel = document.getElementById('groups-count-label');
    const sizeLabel = document.getElementById('groups-size-label');
    
    if (mode === 'count') {
        countLabel.style.display = 'block';
        sizeLabel.style.display = 'none';
    } else {
        countLabel.style.display = 'none';
        sizeLabel.style.display = 'block';
    }
}

// Créer des groupes aléatoires
function createRandomGroups() {
    const className = document.getElementById('groups-class-select').value;
    const mode = document.getElementById('groups-mode').value;
    const groupsCount = parseInt(document.getElementById('groups-count').value) || 3;
    const groupsSize = parseInt(document.getElementById('groups-size').value) || 4;
    const resultsDiv = document.getElementById('groups-result');
    const absentCheckboxes = document.querySelectorAll('.absent-checkbox-groups:checked');

    if (!className) {
        resultsDiv.innerHTML = '<p style="color: #ef4444;">Aucune classe sélectionnée</p>';
        return;
    }

    const students = getClassStudentOptions(className);
    if (!students.length) {
        resultsDiv.innerHTML = '<p style="color: #ef4444;">Aucun élève dans cette classe</p>';
        return;
    }

    const absentsNames = Array.from(absentCheckboxes).map(cb => cb.value);
    const absents = students.filter(name => absentsNames.includes(name));
    const presents = students.filter(name => !absentsNames.includes(name));

    if (presents.length === 0) {
        resultsDiv.innerHTML = '<p style="color: #ef4444;">Tous les élèves sont absents</p>';
        return;
    }

    const shuffled = [...presents];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    let groups = [];
    if (mode === 'count') {
        const numGroups = Math.min(groupsCount, shuffled.length);
        const baseSize = Math.floor(shuffled.length / numGroups);
        const remainder = shuffled.length % numGroups;
        let currentIndex = 0;
        for (let i = 0; i < numGroups; i++) {
            const size = baseSize + (i < remainder ? 1 : 0);
            groups.push(shuffled.slice(currentIndex, currentIndex + size));
            currentIndex += size;
        }
    } else {
        const numGroups = Math.ceil(shuffled.length / groupsSize);
        for (let i = 0; i < numGroups; i++) {
            const start = i * groupsSize;
            const end = Math.min(start + groupsSize, shuffled.length);
            groups.push(shuffled.slice(start, end));
        }
    }

    if (absents.length > 0) {
        const shuffledAbsents = [...absents];
        for (let i = shuffledAbsents.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledAbsents[i], shuffledAbsents[j]] = [shuffledAbsents[j], shuffledAbsents[i]];
        }
        shuffledAbsents.forEach(absent => {
            let minSize = Infinity;
            let minGroupIndex = 0;
            groups.forEach((group, index) => {
                const totalSize = group.length + (group.absents ? group.absents.length : 0);
                if (totalSize < minSize) {
                    minSize = totalSize;
                    minGroupIndex = index;
                }
            });
            if (!groups[minGroupIndex].absents) groups[minGroupIndex].absents = [];
            groups[minGroupIndex].absents.push(absent);
        });
    }

    resultsDiv.innerHTML = '';
    resultsDiv.style.display = 'grid';
    resultsDiv.style.gridTemplateColumns = 'repeat(auto-fit, minmax(200px, 1fr))';
    resultsDiv.style.gap = '15px';

    groups.forEach((group, groupIndex) => {
        setTimeout(() => {
            const groupCard = document.createElement('div');
            groupCard.className = 'group-card';
            const totalMembers = group.length + (group.absents ? group.absents.length : 0);
            const groupHeader = document.createElement('div');
            groupHeader.className = 'group-header';
            groupHeader.textContent = `Groupe ${groupIndex + 1} (${totalMembers})`;
            groupCard.appendChild(groupHeader);
            const studentsList = document.createElement('div');
            studentsList.className = 'group-students';
            group.forEach((student, studentIndex) => {
                setTimeout(() => {
                    const studentItem = document.createElement('div');
                    studentItem.className = 'group-student-item';
                    studentItem.textContent = student;
                    studentsList.appendChild(studentItem);
                }, studentIndex * 100);
            });
            if (group.absents && group.absents.length > 0) {
                group.absents.forEach((absent, absentIndex) => {
                    setTimeout(() => {
                        const absentItem = document.createElement('div');
                        absentItem.className = 'group-student-item absent-student';
                        absentItem.textContent = `(${absent})`;
                        studentsList.appendChild(absentItem);
                    }, (group.length + absentIndex) * 100);
                });
            }
            groupCard.appendChild(studentsList);
            resultsDiv.appendChild(groupCard);
        }, groupIndex * 300);
    });
}

function pickStudents() {
    const className = document.getElementById('student-class-select').value;
    const count = parseInt(document.getElementById('student-count').value) || 1;
    const resultsDiv = document.getElementById('picked-students');
    const absentCheckboxes = document.querySelectorAll('.absent-checkbox-random:checked');

    if (!className) {
        resultsDiv.innerHTML = '<p style="color: #ef4444;">Aucune classe sélectionnée</p>';
        return;
    }

    const students = getClassStudentOptions(className);
    if (!students.length) {
        resultsDiv.innerHTML = '<p style="color: #ef4444;">Aucun élève dans cette classe</p>';
        return;
    }

    const absents = Array.from(absentCheckboxes).map(cb => cb.value);
    const availableStudents = students.filter(name => !absents.includes(name));

    if (!availableStudents.length) {
        resultsDiv.innerHTML = '<p style="color: #ef4444;">Tous les élèves sont absents</p>';
        return;
    }

    const picked = [];
    const pickCount = Math.min(count, availableStudents.length);
    for (let i = 0; i < pickCount; i++) {
        const randomIndex = Math.floor(Math.random() * availableStudents.length);
        picked.push(availableStudents.splice(randomIndex, 1)[0]);
    }

    resultsDiv.innerHTML = '';
    if (pickCount > 5) {
        resultsDiv.style.display = 'grid';
        resultsDiv.style.gridTemplateColumns = 'repeat(auto-fill, minmax(200px, 1fr))';
    } else {
        resultsDiv.style.display = 'block';
    }

    picked.forEach((student, index) => {
        setTimeout(() => {
            const card = document.createElement('div');
            card.className = 'picked-student-card';
            card.textContent = student;
            resultsDiv.appendChild(card);
        }, index * 300);
    });
}

// ===== OUTIL TIMER =====
function drawTimerAnalog() {
    const canvas = document.getElementById('timer-analog');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = canvas.width / 2 - 12;
    const ratio = timerBaseSeconds > 0 ? Math.max(0, Math.min(1, timerSeconds / timerBaseSeconds)) : 0;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.lineWidth = 16;
    ctx.strokeStyle = '#e2e8f0';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, -Math.PI / 2, (-Math.PI / 2) + (Math.PI * 2 * ratio));
    ctx.lineWidth = 16;
    ctx.strokeStyle = '#ef4444';
    ctx.stroke();

    const angle = -Math.PI / 2 + (Math.PI * 2 * ratio);
    const dotX = centerX + Math.cos(angle) * radius;
    const dotY = centerY + Math.sin(angle) * radius;
    ctx.beginPath();
    ctx.arc(dotX, dotY, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444';
    ctx.fill();
}

function startTimer() {
    const minutes = parseInt(document.getElementById('timer-minutes').value) || 0;
    const seconds = parseInt(document.getElementById('timer-seconds').value) || 0;
    if (timerRunning) return;
    timerBaseSeconds = (minutes * 60) + seconds;
    timerSeconds = timerBaseSeconds;
    if (timerSeconds <= 0) return;
    timerRunning = true;
    timerStartTimestamp = performance.now();
    timerInterval = setInterval(() => {
        const now = performance.now();
        const elapsed = (now - timerStartTimestamp) / 1000;
        timerSeconds = Math.max(0, timerBaseSeconds - elapsed);
        if (timerSeconds <= 0) {
            timerSeconds = 0;
            clearInterval(timerInterval);
            timerRunning = false;
            playTimerSound();
        }
        updateTimerDisplay();
    }, 50);
}

function pauseTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
        timerRunning = false;
    }
}

function resetTimer() {
    pauseTimer();
    timerSeconds = 0;
    timerBaseSeconds = 0;
    updateTimerDisplay();
}

function updateTimerDisplay() {
    const display = document.getElementById('timer-display');
    const secondary = document.getElementById('timer-display-secondary');
    const totalSeconds = Math.max(0, timerSeconds);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const hundredths = Math.floor((totalSeconds % 1) * 100);

    display.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    secondary.textContent = totalSeconds <= 10 ? `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}` : '00:00.00';

    display.classList.remove('warning', 'danger');
    if (totalSeconds <= 10 && totalSeconds > 0) {
        display.classList.add('danger');
    } else if (totalSeconds <= 60) {
        display.classList.add('warning');
    }
    drawTimerAnalog();
}

function playTimerSound() {
    // Son de fin de timer (beep)
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 1);
}

// ===== OUTIL HORLOGE =====
let clockType = 'digital';
let clockInterval = null;

function updateClockType() {
    const type = document.getElementById('clock-type').value;
    clockType = type;
    
    const digitalDisplay = document.getElementById('clock-display');
    const analogCanvas = document.getElementById('analog-clock');
    
    if (type === 'digital') {
        digitalDisplay.style.display = 'block';
        analogCanvas.style.display = 'none';
        if (clockInterval) clearInterval(clockInterval);
        updateClock();
        clockInterval = setInterval(updateClock, 1000);
    } else {
        digitalDisplay.style.display = 'none';
        analogCanvas.style.display = 'block';
        if (clockInterval) clearInterval(clockInterval);
        drawAnalogClock();
        clockInterval = setInterval(drawAnalogClock, 1000);
    }
}

function updateClock() {
    const clockDisplay = document.getElementById('clock-display');
    if (!clockDisplay) return;
    
    const timezone = document.getElementById('clock-timezone')?.value || 'local';
    let now;
    
    if (timezone === 'local') {
        now = new Date();
    } else if (timezone === 'UTC') {
        now = new Date();
        const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
        now = new Date(utcTime);
    } else {
        // Utiliser Intl pour les fuseaux horaires
        now = new Date(new Date().toLocaleString('en-US', { timeZone: timezone }));
    }
    
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    clockDisplay.textContent = `${hours}:${minutes}:${seconds}`;
}

function drawAnalogClock() {
    const canvas = document.getElementById('analog-clock');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const radius = canvas.width / 2;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Obtenir l'heure selon le fuseau horaire sélectionné
    const timezone = document.getElementById('clock-timezone')?.value || 'local';
    let now;
    
    if (timezone === 'local') {
        now = new Date();
    } else if (timezone === 'UTC') {
        now = new Date();
        const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
        now = new Date(utcTime);
    } else {
        now = new Date(new Date().toLocaleString('en-US', { timeZone: timezone }));
    }
    
    ctx.translate(radius, radius);
    
    // Fond blanc du cadran
    ctx.beginPath();
    ctx.arc(0, 0, radius - 10, 0, 2 * Math.PI);
    ctx.fillStyle = 'white';
    ctx.fill();
    
    // Cadran externe
    ctx.beginPath();
    ctx.arc(0, 0, radius - 10, 0, 2 * Math.PI);
    ctx.strokeStyle = '#1a2236';
    ctx.lineWidth = 8;
    ctx.stroke();
    
    // Marques des heures
    ctx.strokeStyle = '#1a2236';
    ctx.lineWidth = 3;
    for (let i = 0; i < 12; i++) {
        const angle = (i * Math.PI / 6);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(0, -radius + 20);
        ctx.lineTo(0, -radius + 35);
        ctx.stroke();
        ctx.rotate(-angle);
    }
    
    // Chiffres des heures
    ctx.fillStyle = '#1a2236';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 1; i <= 12; i++) {
        const angle = (i * Math.PI / 6) - Math.PI / 2;
        const x = Math.cos(angle) * (radius - 50);
        const y = Math.sin(angle) * (radius - 50);
        ctx.fillText(i.toString(), x, y);
    }
    
    const hour = now.getHours() % 12;
    const minute = now.getMinutes();
    const second = now.getSeconds();
    
    // Aiguille des heures
    drawHand(ctx, (hour * Math.PI / 6) + (minute * Math.PI / 360), radius * 0.5, 6, '#1a2236');
    
    // Aiguille des minutes
    drawHand(ctx, (minute * Math.PI / 30) + (second * Math.PI / 1800), radius * 0.7, 4, '#1a2236');
    
    // Aiguille des secondes
    drawHand(ctx, second * Math.PI / 30, radius * 0.8, 2, '#ef4444');
    
    // Centre
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, 2 * Math.PI);
    ctx.fillStyle = '#1a2236';
    ctx.fill();
    
    ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function drawHand(ctx, angle, length, width, color) {
    ctx.beginPath();
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.strokeStyle = color;
    ctx.moveTo(0, 0);
    angle -= Math.PI / 2; // Ajuster pour que 0 soit en haut
    ctx.lineTo(Math.cos(angle) * length, Math.sin(angle) * length);
    ctx.stroke();
}

// ===== OUTIL CALENDRIER =====
function updateCalendar() {
    const calendarDisplay = document.getElementById('calendar-display');
    if (!calendarDisplay) return;
    
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateStr = now.toLocaleDateString('fr-FR', options);
    
    calendarDisplay.textContent = dateStr;
}

// ===== OUTIL DÉ =====
function rollDice() {
    const min = parseInt(document.getElementById('dice-min').value) || 1;
    const max = parseInt(document.getElementById('dice-max').value) || 6;
    const count = parseInt(document.getElementById('dice-count').value) || 1;
    const resultDisplay = document.getElementById('dice-result');
    const resultsList = document.getElementById('dice-results-list');

    if (min > max) {
        resultDisplay.textContent = '❌';
        resultsList.innerHTML = '';
        return;
    }

    const results = [];
    for (let i = 0; i < count; i++) {
        results.push(Math.floor(Math.random() * (max - min + 1)) + min);
    }

    let rolls = 0;
    const rollInterval = setInterval(() => {
        const tempResults = [];
        for (let i = 0; i < count; i++) {
            tempResults.push(Math.floor(Math.random() * (max - min + 1)) + min);
        }
        resultDisplay.textContent = count > 1 ? tempResults.join(' • ') : String(tempResults[0]);
        resultsList.innerHTML = tempResults.map((value, index) => `<div class="dice-result-item">Dé ${index + 1}: <strong>${value}</strong></div>`).join('');
        rolls++;

        if (rolls >= 10) {
            clearInterval(rollInterval);
            const finalText = count > 1 ? results.join(' • ') : String(results[0]);
            resultDisplay.textContent = finalText;
            resultsList.innerHTML = results.map((value, index) => `<div class="dice-result-item">Dé ${index + 1}: <strong>${value}</strong></div>`).join('');
        }
    }, 100);
}

// ===== OUTIL QR CODE =====
function generateQRCode() {
    const text = document.getElementById('qrcode-text').value;
    const qrcodeDiv = document.getElementById('qrcode-display');
    
    if (!text) {
        qrcodeDiv.innerHTML = '<p style="color: #ef4444;">Entrez du texte ou une URL</p>';
        return;
    }
    
    // Vider le contenu précédent
    qrcodeDiv.innerHTML = '';
    
    // Générer le QR code
    if (typeof QRCode !== 'undefined') {
        new QRCode(qrcodeDiv, {
            text: text,
            width: 256,
            height: 256,
            colorDark: '#000000',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.H
        });
    } else {
        qrcodeDiv.innerHTML = '<p style="color: #ef4444;">Erreur: Bibliothèque QRCode non chargée</p>';
    }
}

// ===== PLEIN ÉCRAN =====
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.error('Erreur plein écran:', err);
        });
    } else {
        document.exitFullscreen();
    }
}

// ===== GESTION DES PAGES =====
function changePage(direction) {
    // Sauvegarder l'état de la page actuelle
    savePage(currentPage);
    
    // Calculer la nouvelle page
    const newPage = currentPage + direction;
    
    // Vérifier les limites
    if (newPage < 1 || newPage > totalPages) return;
    
    currentPage = newPage;
    
    // Charger la nouvelle page
    loadPage(currentPage);
    
    // Mettre à jour l'indicateur
    updatePageIndicator();
}

function savePage(pageNum) {
    // Sauvegarder le canvas
    pageStates[pageNum].canvasData = canvas.toDataURL();
    
    // Sauvegarder l'état des panneaux
    const panels = {};
    document.querySelectorAll('.tool-panel').forEach(panel => {
        panels[panel.id] = {
            display: panel.style.display,
            transform: panel.style.transform,
            backgroundColor: panel.style.backgroundColor,
            zIndex: panel.style.zIndex,
            width: panel.style.width,
            height: panel.style.height
        };
    });
    pageStates[pageNum].panels = panels;
    
    // Sauvegarder dans localStorage
    localStorage.setItem('tableauBlancPages', JSON.stringify(pageStates));
}

function loadPage(pageNum) {
    // Charger le canvas
    if (pageStates[pageNum].canvasData) {
        const img = new Image();
        img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
        };
        img.src = pageStates[pageNum].canvasData;
    } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    
    // Fermer tous les panneaux d'abord et réinitialiser taille
    document.querySelectorAll('.tool-panel').forEach(panel => {
        panel.style.display = 'none';
        panel.style.transform = 'translate(-50%, -50%)';
        panel.style.width = '';
        panel.style.height = '';
    });
    
    // Charger l'état des panneaux
    if (pageStates[pageNum].panels) {
        Object.keys(pageStates[pageNum].panels).forEach(panelId => {
            const panel = document.getElementById(panelId);
            if (panel) {
                const state = pageStates[pageNum].panels[panelId];
                panel.style.display = state.display || 'none';
                panel.style.transform = state.transform || 'translate(-50%, -50%)';
                if (state.backgroundColor) {
                    panel.style.backgroundColor = state.backgroundColor;
                }
                if (state.zIndex) {
                    panel.style.zIndex = state.zIndex;
                }
                if (state.width) {
                    panel.style.width = state.width;
                }
                if (state.height) {
                    panel.style.height = state.height;
                }
            }
        });
    }
}

function updatePageIndicator() {
    const indicator = document.getElementById('page-indicator');
    const prevBtn = document.getElementById('prev-page-btn');
    const nextBtn = document.getElementById('next-page-btn');
    
    if (indicator) {
        indicator.textContent = `${currentPage}/${totalPages}`;
    }
    
    // Désactiver les boutons aux extrémités
    if (prevBtn) {
        prevBtn.disabled = currentPage === 1;
    }
    if (nextBtn) {
        nextBtn.disabled = currentPage === totalPages;
    }
}

function loadPagesFromStorage() {
    const saved = localStorage.getItem('tableauBlancPages');
    if (saved) {
        try {
            pageStates = JSON.parse(saved);
        } catch (e) {
            console.error('Erreur chargement pages:', e);
        }
    }
}

// ===== PARAMÈTRES =====
function resetAll() {
    if (confirm('Voulez-vous vraiment tout réinitialiser ?')) {
        clearCanvas();
        closePanel('settings-panel');
        resetTimer();
    }
}

// ===== OUTIL BLOC-NOTES =====
function loadNotes() {
    const savedNotes = localStorage.getItem('tableauBlancNotes');
    const editor = document.getElementById('notes-editor');
    if (editor && savedNotes) {
        editor.innerHTML = savedNotes;
    }
}

function saveNotes() {
    const editor = document.getElementById('notes-editor');
    if (editor) {
        localStorage.setItem('tableauBlancNotes', editor.innerHTML);
        
        // Feedback visuel
        const btn = event.target;
        const originalText = btn.textContent;
        btn.textContent = '✅ Sauvegardé !';
        btn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
        
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = '';
        }, 2000);
    }
}

function clearNotes() {
    if (confirm('Voulez-vous vraiment effacer toutes les notes ?')) {
        const editor = document.getElementById('notes-editor');
        if (editor) {
            editor.innerHTML = '';
            localStorage.removeItem('tableauBlancNotes');
        }
    }
}

// Initialiser l'éditeur de notes avec formatage
function initNotesEditor() {
    const editor = document.getElementById('notes-editor');
    if (!editor) return;
    
    // Gérer le placeholder
    editor.addEventListener('focus', function() {
        if (this.textContent === '') {
            this.innerHTML = '';
        }
    });
    
    editor.addEventListener('blur', function() {
        if (this.textContent.trim() === '') {
            this.innerHTML = '';
        }
    });
    
    // Sauvegarder automatiquement toutes les 30 secondes
    setInterval(() => {
        const editor = document.getElementById('notes-editor');
        if (editor && editor.innerHTML.trim() !== '') {
            localStorage.setItem('tableauBlancNotes', editor.innerHTML);
        }
    }, 30000);
}

// Fonction de formatage de texte
function formatText(command, value = null) {
    const editor = document.getElementById('notes-editor');
    if (!editor) return;
    
    editor.focus();
    
    if (value) {
        document.execCommand(command, false, value);
    } else {
        document.execCommand(command, false, null);
    }
}

// Export notes en PDF
function exportNotesAsPDF() {
    const editor = document.getElementById('notes-editor');
    if (!editor || editor.innerHTML.trim() === '') {
        alert('⚠️ Aucune note à exporter');
        return;
    }
    
    // Créer une fenêtre d'impression avec le contenu formaté
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Notes - Tableau Blanc eProf</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    padding: 40px;
                    line-height: 1.6;
                    max-width: 800px;
                    margin: 0 auto;
                }
                h1 {
                    color: #667eea;
                    border-bottom: 3px solid #667eea;
                    padding-bottom: 10px;
                    margin-bottom: 20px;
                }
                @media print {
                    body { padding: 20px; }
                }
            </style>
        </head>
        <body>
            <h1>📝 Notes - Tableau Blanc eProf</h1>
            <div>${editor.innerHTML}</div>
            <script>
                window.onload = function() {
                    window.print();
                    setTimeout(() => window.close(), 100);
                };
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

function loadNotes_OLD() {
    const savedNotes = localStorage.getItem('tableauBlancNotes');
    const textarea = document.getElementById('notes-textarea');
    if (textarea && savedNotes) {
        textarea.value = savedNotes;
    }
}

function saveNotes_OLD() {
    const textarea = document.getElementById('notes-textarea');
    if (textarea) {
        localStorage.setItem('tableauBlancNotes', textarea.value);
        
        // Feedback visuel
        const btn = event.target;
        const originalText = btn.textContent;
        btn.textContent = '✅ Sauvegardé !';
        btn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
        
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = '';
        }, 2000);
    }
}

function clearNotes_OLD() {
    if (confirm('Voulez-vous vraiment effacer toutes les notes ?')) {
        const textarea = document.getElementById('notes-textarea');
        if (textarea) {
            textarea.value = '';
            localStorage.removeItem('tableauBlancNotes');
        }
    }
}

// ===== GESTION DES PAGES =====
function changePage(direction) {
    // Sauvegarder l'état de la page actuelle
    savePage(currentPage);
    
    // Calculer la nouvelle page
    const newPage = currentPage + direction;
    
    // Vérifier les limites
    if (newPage < 1 || newPage > totalPages) return;
    if (newPage < 1 || newPage > totalPages) return;
    
    currentPage = newPage;
    
    // Charger la nouvelle page
    loadPage(currentPage);
    
    // Mettre à jour l'indicateur
    updatePageIndicator();
}

function savePage(pageNum) {
    // Sauvegarder le canvas
    pageStates[pageNum].canvasData = canvas.toDataURL();
    
    // Sauvegarder l'état des panneaux
    const panels = {};
    document.querySelectorAll('.tool-panel').forEach(panel => {
        panels[panel.id] = {
            display: panel.style.display,
            transform: panel.style.transform,
            backgroundColor: panel.style.backgroundColor,
            zIndex: panel.style.zIndex,
            width: panel.style.width,
            height: panel.style.height
        };
    });
    pageStates[pageNum].panels = panels;
    
    // Sauvegarder dans localStorage
    localStorage.setItem('tableauBlancPages', JSON.stringify(pageStates));
}

function loadPage(pageNum) {
    // Charger le canvas
    if (pageStates[pageNum].canvasData) {
        const img = new Image();
        img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
        };
        img.src = pageStates[pageNum].canvasData;
    } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    
    // Fermer tous les panneaux d'abord et réinitialiser taille
    document.querySelectorAll('.tool-panel').forEach(panel => {
        panel.style.display = 'none';
        panel.style.transform = 'translate(-50%, -50%)';
        panel.style.width = '';
        panel.style.height = '';
    });
    
    // Charger l'état des panneaux
    if (pageStates[pageNum].panels) {
        Object.keys(pageStates[pageNum].panels).forEach(panelId => {
            const panel = document.getElementById(panelId);
            if (panel) {
                const state = pageStates[pageNum].panels[panelId];
                panel.style.display = state.display || 'none';
                panel.style.transform = state.transform || 'translate(-50%, -50%)';
                if (state.backgroundColor) {
                    panel.style.backgroundColor = state.backgroundColor;
                }
                if (state.zIndex) {
                    panel.style.zIndex = state.zIndex;
                }
                if (state.width) {
                    panel.style.width = state.width;
                }
                if (state.height) {
                    panel.style.height = state.height;
                }
            }
        });
    }
}

function updatePageIndicator() {
    const indicator = document.getElementById('page-indicator');
    const prevBtn = document.getElementById('prev-page-btn');
    const nextBtn = document.getElementById('next-page-btn');
    
    if (indicator) {
        indicator.textContent = `${currentPage}/`;
    }
    
    // Désactiver les boutons aux extrémités
    if (prevBtn) {
        prevBtn.disabled = currentPage === 1;
    }
    if (nextBtn) {
        nextBtn.disabled = currentPage === totalPages;
    }
}

function loadPagesFromStorage() {
    const saved = localStorage.getItem('tableauBlancPages');
    if (saved) {
        try {
            pageStates = JSON.parse(saved);
        } catch (e) {
            console.error('Erreur chargement pages:', e);
        }
    }
}

function resetAll() {
    if (confirm('Voulez-vous vraiment tout réinitialiser (dessins, notes, pages) ?')) {
        // Effacer le canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Fermer tous les panneaux
        document.querySelectorAll('.tool-panel').forEach(panel => {
            panel.style.display = 'none';
        });
        
        // Réinitialiser le stockage
        localStorage.removeItem('tableauBlancPages');
        localStorage.removeItem('tableauBlancNotes');
        localStorage.removeItem('panelColors');
        
        // Réinitialiser les états de page
        pageStates = {
            1: { canvasData: null, panels: {} },
            2: { canvasData: null, panels: {} },
            3: { canvasData: null, panels: {} }
        };
        
        // Retourner à la page 1
        currentPage = 1;
        updatePageIndicator();
        
        // Réinitialiser les notes
        const textarea = document.getElementById('notes-textarea');
        if (textarea) {
            textarea.value = '';
        }
    }
}

// ===== VISIONNEUSE PDF =====
let currentPDF = null;
let currentPDFPage = 1;
let totalPDFPages = 0;
let pdfZoom = 1.0;
let currentPDFFileName = '';

function initPDFViewer() {
    const dropZone = document.getElementById('pdf-drop-zone');
    const fileInput = document.getElementById('pdf-file-input');
    
    if (dropZone) {
        // Clic sur la zone = ouvrir le sélecteur de fichier
        dropZone.addEventListener('click', () => {
            fileInput.click();
        });
        
        // Empêcher le comportement par défaut pour le drag & drop
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, preventDefaults, false);
        });
        
        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        // Highlight de la zone lors du survol
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.style.borderColor = '#3b82f6';
                dropZone.style.background = '#dbeafe';
            });
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.style.borderColor = '#94a3b8';
                dropZone.style.background = '#f8fafc';
            });
        });
        
        // Gestion du drop
        dropZone.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].type === 'application/pdf') {
                loadPDFFromFile(files[0]);
            } else {
                alert('⚠️ Veuillez déposer un fichier PDF valide.');
            }
        });
    }
}

function loadPDFFile(event) {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
        loadPDFFromFile(file);
    } else {
        alert('⚠️ Veuillez sélectionner un fichier PDF valide.');
    }
}

function loadPDFFromFile(file) {
    currentPDFFileName = file.name;
    
    const fileReader = new FileReader();
    fileReader.onload = function() {
        const typedArray = new Uint8Array(this.result);
        
        if (typeof pdfjsLib === 'undefined') {
            alert('❌ Erreur : La bibliothèque PDF.js n\'est pas chargée.');
            return;
        }
        
        pdfjsLib.getDocument(typedArray).promise.then(pdf => {
            currentPDF = pdf;
            totalPDFPages = pdf.numPages;
            currentPDFPage = 1;
            pdfZoom = 1.0;
            
            // Afficher le conteneur et masquer la section d'import
            document.getElementById('pdf-viewer-container').style.display = 'block';
            document.getElementById('pdf-import-section').style.display = 'none';
            document.getElementById('show-import-btn').style.display = 'block';
            document.getElementById('pdf-filename').textContent = '📄 ' + currentPDFFileName;
            
            renderPDFPage(currentPDFPage);
        }).catch(err => {
            console.error('Erreur chargement PDF:', err);
            alert('❌ Erreur lors du chargement du PDF : ' + err.message);
        });
    };
    fileReader.readAsArrayBuffer(file);
}

function renderPDFPage(pageNum) {
    if (!currentPDF) return;
    
    currentPDF.getPage(pageNum).then(page => {
        const canvas = document.getElementById('pdf-canvas');
        const context = canvas.getContext('2d');
        
        const viewport = page.getViewport({ scale: 1.5 * pdfZoom });
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };
        
        page.render(renderContext).promise.then(() => {
            updatePDFPageInfo();
        });
    }).catch(err => {
        console.error('Erreur rendu page PDF:', err);
        alert('❌ Erreur lors du rendu de la page : ' + err.message);
    });
}

function updatePDFPageInfo() {
    const info = document.getElementById('pdf-page-info');
    if (info) {
        info.textContent = `Page ${currentPDFPage} / ${totalPDFPages}`;
    }
    
    const zoomInfo = document.getElementById('pdf-zoom-info');
    if (zoomInfo) {
        zoomInfo.textContent = Math.round(pdfZoom * 100) + '%';
    }
}

function previousPDFPage() {
    if (currentPDFPage > 1) {
        currentPDFPage--;
        renderPDFPage(currentPDFPage);
    }
}

function nextPDFPage() {
    if (currentPDFPage < totalPDFPages) {
        currentPDFPage++;
        renderPDFPage(currentPDFPage);
    }
}

function zoomInPDF() {
    if (pdfZoom < 3.0) {
        pdfZoom += 0.25;
        renderPDFPage(currentPDFPage);
    }
}

function zoomOutPDF() {
    if (pdfZoom > 0.5) {
        pdfZoom -= 0.25;
        renderPDFPage(currentPDFPage);
    }
}

function closePDFViewer() {
    currentPDF = null;
    currentPDFPage = 1;
    totalPDFPages = 0;
    pdfZoom = 1.0;
    currentPDFFileName = '';
    
    document.getElementById('pdf-viewer-container').style.display = 'none';
    document.getElementById('pdf-import-section').style.display = 'block';
    document.getElementById('show-import-btn').style.display = 'none';
    document.getElementById('pdf-file-input').value = '';
    
    const canvas = document.getElementById('pdf-canvas');
    if (canvas) {
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, canvas.width, canvas.height);
    }
}

function togglePDFImportSection() {
    const importSection = document.getElementById('pdf-import-section');
    if (importSection.style.display === 'none') {
        importSection.style.display = 'block';
    } else {
        importSection.style.display = 'none';
    }
}

let pdfControlsCollapsed = false;
function togglePDFControls() {
    const controlsSection = document.getElementById('pdf-controls-section');
    const toggleBtn = document.getElementById('pdf-toggle-controls-btn');
    const canvasContainer = document.getElementById('pdf-canvas-container');
    pdfControlsCollapsed = !pdfControlsCollapsed;
    if (pdfControlsCollapsed) {
        controlsSection.style.display = 'none';
        toggleBtn.textContent = '▼ Afficher les contrôles';
        if (pdfFullscreenMode) {
            canvasContainer.style.maxHeight = 'calc(100vh - 100px)';
        } else {
            canvasContainer.style.maxHeight = '700px';
        }
    } else {
        controlsSection.style.display = 'block';
        toggleBtn.textContent = '▲ Réduire les contrôles';
        if (pdfFullscreenMode) {
            canvasContainer.style.maxHeight = 'calc(100vh - 200px)';
        } else {
            canvasContainer.style.maxHeight = '500px';
        }
    }
    if (currentPDF) {
        setTimeout(() => renderPDFPage(currentPDFPage), 50);
    }
}

function togglePDFFullscreen() {
    const panel = document.getElementById('pdf-viewer-panel');
    const canvasContainer = document.getElementById('pdf-canvas-container');
    const fullscreenBtn = document.getElementById('pdf-fullscreen-btn');
    
    pdfFullscreenMode = !pdfFullscreenMode;
    
    if (pdfFullscreenMode) {
        // Mode plein écran
        panel.style.position = 'fixed';
        panel.style.top = '0px';
        panel.style.left = '0px';
        panel.style.width = '100vw';
        panel.style.height = '100vh';
        panel.style.maxWidth = 'none';
        panel.style.maxHeight = 'none';
        panel.style.minWidth = 'none';
        panel.style.minHeight = 'none';
        panel.style.zIndex = '10000';
        panel.style.margin = '0px';
        panel.style.borderRadius = '0px';
        panel.style.transform = 'none';
        panel.style.padding = '10px';
        panel.style.overflow = 'auto';
        panel.style.flexDirection = 'column';
        
        canvasContainer.style.maxHeight = 'calc(100vh - 200px)';
        canvasContainer.style.overflow = 'auto';
        canvasContainer.style.flex = '1';
        
        if (fullscreenBtn) {
            fullscreenBtn.innerHTML = '🗗 Quitter plein écran';
        }
        
        // Re-render pour adapter la taille
        if (currentPDF) {
            setTimeout(() => renderPDFPage(currentPDFPage), 50);
        }
    } else {
        // Mode normal
        panel.style.position = 'absolute';
        panel.style.top = '50%';
        panel.style.left = '50%';
        panel.style.width = 'auto';
        panel.style.height = 'auto';
        panel.style.maxWidth = '90vw';
        panel.style.maxHeight = '85vh';
        panel.style.minWidth = '320px';
        panel.style.minHeight = '200px';
        panel.style.zIndex = '200';
        panel.style.margin = '0';
        panel.style.borderRadius = '12px';
        panel.style.transform = 'translate(-50%, -50%)';
        panel.style.padding = '22px';
        panel.style.overflow = 'hidden';
        panel.style.flexDirection = 'column';
        
        canvasContainer.style.maxHeight = '500px';
        canvasContainer.style.overflow = 'auto';
        
        if (fullscreenBtn) {
            fullscreenBtn.innerHTML = '🖥️ Plein écran';
        }
        
        // Re-render pour adapter la taille
        if (currentPDF) {
            setTimeout(() => renderPDFPage(currentPDFPage), 50);
        }
    }
}

// ===== OUTIL NUAGE DE MOTS =====
const WordCloud = (function() {
    let state = {
        phase: 'setup',
        theme: '',
        shape: 'free',
        palette: 'vibrant',
        words: []
    };
    let nextId = 1;
    let dragState = null;

    const palettes = {
        vibrant: ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#2980b9', '#c0392b', '#27ae60'],
        ocean: ['#0077b6', '#00b4d8', '#0096c7', '#023e8a', '#48cae4', '#90e0ef', '#0353a4', '#006494', '#01497c', '#014f86'],
        sunset: ['#ff6b6b', '#ee5a24', '#f0932b', '#eb4d4b', '#e55039', '#fa983a', '#e15f41', '#c44569', '#f78fb3', '#f19066'],
        forest: ['#27ae60', '#2ecc71', '#1abc9c', '#16a085', '#2d6a4f', '#40916c', '#52b788', '#74c69d', '#95d5b2', '#3a5a40'],
        pastel: ['#a8dadc', '#f4a261', '#e76f51', '#264653', '#2a9d8f', '#e9c46a', '#457b9d', '#f4acb7', '#9d8189', '#6d6875'],
        neon: ['#ff006e', '#8338ec', '#3a86ff', '#06d6a0', '#ffd166', '#ef476f', '#118ab2', '#073b4c', '#06d6a0', '#ffd166']
    };

    const shapeLabels = { free: '✨ Libre', circle: '⭕ Cercle', square: '⬜ Carré', diamond: '💎 Losange', heart: '❤️ Cœur' };
    const paletteLabels = { vibrant: '🌈 Vibrant', ocean: '🌊 Océan', sunset: '🌅 Coucher de soleil', forest: '🌲 Forêt', pastel: '🎨 Pastel', neon: '💡 Néon' };

    function init() {
        const wordInput = document.getElementById('wc-word-input');
        if (wordInput) {
            wordInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); addWord(); }
            });
        }

        const paletteSelect = document.getElementById('wc-palette-select');
        if (paletteSelect) {
            paletteSelect.addEventListener('change', updatePalettePreview);
            updatePalettePreview();
        }

        const cloudArea = document.getElementById('wc-cloud-area');
        if (cloudArea) {
            cloudArea.addEventListener('mousemove', onDragMove);
            cloudArea.addEventListener('mouseup', onDragEnd);
            cloudArea.addEventListener('mouseleave', onDragEnd);
        }

        loadFromStorage();
    }

    function updatePalettePreview() {
        const select = document.getElementById('wc-palette-select');
        const preview = document.getElementById('wc-palette-preview');
        if (!select || !preview) return;
        const pal = palettes[select.value] || palettes.vibrant;
        preview.innerHTML = pal.map(c => '<div class="wc-palette-swatch" style="background:' + c + '"></div>').join('');
    }

    function escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function confirm() {
        const themeInput = document.getElementById('wc-theme-input');
        const theme = themeInput ? themeInput.value.trim() : '';
        if (!theme) {
            if (themeInput) {
                themeInput.style.borderColor = '#ef4444';
                themeInput.focus();
                setTimeout(() => { themeInput.style.borderColor = '#e2e8f0'; }, 2000);
            }
            return;
        }

        state.theme = theme;
        state.shape = document.getElementById('wc-shape-select') ? document.getElementById('wc-shape-select').value : 'free';
        state.palette = document.getElementById('wc-palette-select') ? document.getElementById('wc-palette-select').value : 'vibrant';
        state.phase = 'editor';

        showEditor();
    }

    function showEditor() {
        document.getElementById('wc-setup').style.display = 'none';
        document.getElementById('wc-editor').style.display = 'block';

        var summary = document.getElementById('wc-config-summary');
        summary.innerHTML =
            '<span class="wc-summary-tag">🎯 ' + escapeHTML(state.theme) + '</span>' +
            '<span class="wc-summary-tag">' + (shapeLabels[state.shape] || state.shape) + '</span>' +
            '<span class="wc-summary-tag">' + (paletteLabels[state.palette] || state.palette) + '</span>' +
            '<button class="wc-edit-btn" onclick="WordCloud.backToSetup()">✏️ Modifier</button>';

        renderCloud();
        var wordInput = document.getElementById('wc-word-input');
        if (wordInput) wordInput.focus();
    }

    function backToSetup() {
        state.phase = 'setup';
        document.getElementById('wc-setup').style.display = 'block';
        document.getElementById('wc-editor').style.display = 'none';
        document.getElementById('wc-theme-input').value = state.theme;
        document.getElementById('wc-shape-select').value = state.shape;
        document.getElementById('wc-palette-select').value = state.palette;
        updatePalettePreview();
    }

    function calculateFontSize(weight) {
        return 16 + (weight - 1) * 6;
    }

    function addWord() {
        var input = document.getElementById('wc-word-input');
        var word = input ? input.value.trim() : '';
        if (!word) return;

        var existing = state.words.find(function(w) { return w.text.toLowerCase() === word.toLowerCase(); });
        if (existing) {
            existing.weight = Math.min(existing.weight + 1, 8);
            existing.fontSize = calculateFontSize(existing.weight);
            input.value = '';
            input.focus();
            renderCloud(existing.id);
            return;
        }

        var pal = palettes[state.palette] || palettes.vibrant;
        var color = pal[state.words.length % pal.length];
        var rotation = (Math.random() - 0.5) * 30;

        var wordObj = {
            id: nextId++,
            text: word,
            weight: 1,
            fontSize: calculateFontSize(1),
            color: color,
            rotation: rotation,
            x: 0,
            y: 0,
            placed: false
        };

        state.words.push(wordObj);
        input.value = '';
        input.focus();
        renderCloud(wordObj.id);
    }

    function removeWordById(id) {
        state.words = state.words.filter(function(w) { return w.id !== id; });
        renderCloud();
    }

    function measureWord(text, fontSize) {
        var c = document.createElement('canvas').getContext('2d');
        c.font = 'bold ' + fontSize + 'px Arial, sans-serif';
        var m = c.measureText(text);
        return { w: m.width + 16, h: fontSize * 1.3 + 8 };
    }

    function findPosition(wordObj, cloudArea) {
        var areaW = cloudArea.offsetWidth;
        var areaH = cloudArea.offsetHeight;
        var cx = areaW / 2;
        var cy = areaH / 2;

        var dim = measureWord(wordObj.text, wordObj.fontSize);
        var estW = dim.w;
        var estH = dim.h;

        var existingRects = [];

        // Reserve center for theme
        var themeEl = cloudArea.querySelector('.wc-theme-label');
        if (themeEl) {
            existingRects.push({
                x: cx - themeEl.offsetWidth / 2 - 10,
                y: cy - themeEl.offsetHeight / 2 - 10,
                w: themeEl.offsetWidth + 20,
                h: themeEl.offsetHeight + 20
            });
        }

        var wordEls = cloudArea.querySelectorAll('.wc-word');
        wordEls.forEach(function(el) {
            var elId = parseInt(el.dataset.id);
            if (elId === wordObj.id) return;
            existingRects.push({
                x: parseInt(el.style.left) || 0,
                y: parseInt(el.style.top) || 0,
                w: el.offsetWidth || estW,
                h: el.offsetHeight || estH
            });
        });

        function overlaps(x, y, w, h) {
            for (var i = 0; i < existingRects.length; i++) {
                var r = existingRects[i];
                if (x < r.x + r.w && x + w > r.x && y < r.y + r.h && y + h > r.y) return true;
            }
            return false;
        }

        function inShape(x, y, w, h) {
            if (state.shape === 'free') return true;
            var px = (x + w / 2 - cx) / (areaW * 0.42);
            var py = (y + h / 2 - cy) / (areaH * 0.42);
            switch (state.shape) {
                case 'circle': return px * px + py * py <= 1;
                case 'square': return Math.abs(px) <= 1 && Math.abs(py) <= 1;
                case 'diamond': return Math.abs(px) + Math.abs(py) <= 1;
                case 'heart':
                    var hx = px, hy = -py + 0.3;
                    return Math.pow(hx * hx + hy * hy - 0.3, 3) - hx * hx * hy * hy * hy < 0;
                default: return true;
            }
        }

        // Spiral search from center outward
        for (var r = 40; r < Math.max(areaW, areaH) * 0.6; r += 6) {
            for (var angle = 0; angle < Math.PI * 2; angle += 0.2) {
                var x = cx + r * Math.cos(angle) - estW / 2;
                var y = cy + r * Math.sin(angle) - estH / 2;
                if (x >= 5 && y >= 5 && x + estW <= areaW - 5 && y + estH <= areaH - 5
                    && inShape(x, y, estW, estH) && !overlaps(x, y, estW, estH)) {
                    return { x: Math.round(x), y: Math.round(y) };
                }
            }
        }

        // Fallback
        for (var i = 0; i < 80; i++) {
            var x = 20 + Math.random() * (areaW - estW - 40);
            var y = 20 + Math.random() * (areaH - estH - 40);
            if (!overlaps(x, y, estW, estH)) return { x: Math.round(x), y: Math.round(y) };
        }
        return { x: Math.round(20 + Math.random() * (areaW - estW - 40)), y: Math.round(20 + Math.random() * (areaH - estH - 40)) };
    }

    function renderCloud(animateId) {
        var cloudArea = document.getElementById('wc-cloud-area');
        if (!cloudArea) return;

        cloudArea.innerHTML = '';

        // Theme in center
        if (state.theme) {
            var themeEl = document.createElement('div');
            themeEl.className = 'wc-theme-label';
            themeEl.textContent = state.theme;
            cloudArea.appendChild(themeEl);
        }

        if (state.words.length === 0) {
            var ph = document.createElement('div');
            ph.className = 'wc-placeholder';
            ph.textContent = 'Ajoutez des mots pour construire votre nuage...';
            cloudArea.appendChild(ph);
        }

        // Sort by weight desc for placement priority
        var sortedWords = state.words.slice().sort(function(a, b) { return b.weight - a.weight; });

        sortedWords.forEach(function(wordObj) {
            var el = document.createElement('div');
            el.className = 'wc-word';
            el.dataset.id = wordObj.id;
            el.style.fontSize = wordObj.fontSize + 'px';
            el.style.color = wordObj.color;
            el.style.setProperty('--wc-rot', wordObj.rotation + 'deg');
            el.style.transform = 'rotate(' + wordObj.rotation + 'deg)';

            var textSpan = document.createTextNode(wordObj.text);
            el.appendChild(textSpan);

            var removeBtn = document.createElement('button');
            removeBtn.className = 'wc-word-remove';
            removeBtn.textContent = '\u00D7';
            removeBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                removeWordById(wordObj.id);
            });
            el.appendChild(removeBtn);

            el.addEventListener('mousedown', function(e) { onDragStart(e, wordObj.id); });
            el.addEventListener('touchstart', function(e) { onTouchStart(e, wordObj.id); }, { passive: false });

            cloudArea.appendChild(el);

            // Find position if not already placed
            if (!wordObj.placed) {
                var pos = findPosition(wordObj, cloudArea);
                wordObj.x = pos.x;
                wordObj.y = pos.y;
                wordObj.placed = true;
            }

            el.style.left = wordObj.x + 'px';
            el.style.top = wordObj.y + 'px';

            // Animate new/updated word
            if (animateId && wordObj.id === animateId) {
                el.classList.add('wc-word-animated');
            }
        });

        updateWordCount();
    }

    function updateWordCount() {
        var countEl = document.getElementById('wc-word-count');
        if (countEl) {
            countEl.textContent = state.words.length > 0 ? state.words.length + ' mot' + (state.words.length > 1 ? 's' : '') : '';
        }
    }

    // ===== DRAG & DROP =====
    function onDragStart(e, wordId) {
        if (e.target.classList.contains('wc-word-remove')) return;
        e.preventDefault();
        var el = e.currentTarget;
        el.classList.add('wc-dragging');
        dragState = {
            wordId: wordId,
            el: el,
            startX: e.clientX,
            startY: e.clientY,
            origLeft: parseInt(el.style.left),
            origTop: parseInt(el.style.top)
        };
    }

    function onTouchStart(e, wordId) {
        if (e.target.classList.contains('wc-word-remove')) return;
        e.preventDefault();
        var touch = e.touches[0];
        var el = e.currentTarget;
        el.classList.add('wc-dragging');
        dragState = {
            wordId: wordId,
            el: el,
            startX: touch.clientX,
            startY: touch.clientY,
            origLeft: parseInt(el.style.left),
            origTop: parseInt(el.style.top),
            isTouch: true
        };
        document.addEventListener('touchmove', onTouchMove, { passive: false });
        document.addEventListener('touchend', onTouchEnd);
    }

    function onDragMove(e) {
        if (!dragState || dragState.isTouch) return;
        var dx = e.clientX - dragState.startX;
        var dy = e.clientY - dragState.startY;
        dragState.el.style.left = (dragState.origLeft + dx) + 'px';
        dragState.el.style.top = (dragState.origTop + dy) + 'px';
    }

    function onTouchMove(e) {
        if (!dragState) return;
        e.preventDefault();
        var touch = e.touches[0];
        var dx = touch.clientX - dragState.startX;
        var dy = touch.clientY - dragState.startY;
        dragState.el.style.left = (dragState.origLeft + dx) + 'px';
        dragState.el.style.top = (dragState.origTop + dy) + 'px';
    }

    function onDragEnd() {
        if (!dragState) return;
        dragState.el.classList.remove('wc-dragging');
        var word = state.words.find(function(w) { return w.id === dragState.wordId; });
        if (word) {
            word.x = parseInt(dragState.el.style.left);
            word.y = parseInt(dragState.el.style.top);
        }
        if (dragState.isTouch) {
            document.removeEventListener('touchmove', onTouchMove);
            document.removeEventListener('touchend', onTouchEnd);
        }
        dragState = null;
    }

    function onTouchEnd() { onDragEnd(); }

    // ===== SAUVEGARDE =====
    function save() {
        localStorage.setItem('wordCloudData', JSON.stringify(state));
        var btns = document.querySelectorAll('.wc-btn-info');
        if (btns.length > 0) {
            var btn = btns[btns.length - 1];
            var orig = btn.innerHTML;
            btn.innerHTML = '✅ Sauvegardé !';
            btn.style.background = '#10b981';
            setTimeout(function() { btn.innerHTML = orig; btn.style.background = '#3b82f6'; }, 2000);
        }
    }

    function loadFromStorage() {
        var saved = localStorage.getItem('wordCloudData');
        if (!saved) return;
        try {
            var data = JSON.parse(saved);
            state = {
                phase: data.phase || 'setup',
                theme: data.theme || '',
                shape: data.shape || 'free',
                palette: data.palette || 'vibrant',
                words: data.words || []
            };
            nextId = state.words.reduce(function(max, w) { return Math.max(max, w.id + 1); }, 1);

            if (state.phase === 'editor' && state.theme) {
                var themeInput = document.getElementById('wc-theme-input');
                if (themeInput) themeInput.value = state.theme;
                var shapeSelect = document.getElementById('wc-shape-select');
                if (shapeSelect) shapeSelect.value = state.shape;
                var paletteSelect = document.getElementById('wc-palette-select');
                if (paletteSelect) paletteSelect.value = state.palette;
                showEditor();
            }
        } catch (e) { /* ignore */ }
    }

    function clear() {
        if (state.words.length === 0 && !state.theme) return;
        if (!window.confirm('Effacer tout le nuage de mots ?')) return;
        state.words = [];
        state.phase = 'setup';
        state.theme = '';
        localStorage.removeItem('wordCloudData');

        document.getElementById('wc-setup').style.display = 'block';
        document.getElementById('wc-editor').style.display = 'none';
        var themeInput = document.getElementById('wc-theme-input');
        if (themeInput) themeInput.value = '';
        var shapeSelect = document.getElementById('wc-shape-select');
        if (shapeSelect) shapeSelect.value = 'free';
        var paletteSelect = document.getElementById('wc-palette-select');
        if (paletteSelect) paletteSelect.value = 'vibrant';
        updatePalettePreview();
    }

    // ===== EXPORT PDF =====
    function exportPDF() {
        var cloudArea = document.getElementById('wc-cloud-area');
        if (!cloudArea || state.words.length === 0) return;

        var rect = cloudArea.getBoundingClientRect();
        var scale = 2;
        var cvs = document.createElement('canvas');
        cvs.width = rect.width * scale;
        cvs.height = rect.height * scale;
        var ctx = cvs.getContext('2d');
        ctx.scale(scale, scale);

        // White background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, rect.width, rect.height);

        // Draw theme in center
        if (state.theme) {
            var themeEl = cloudArea.querySelector('.wc-theme-label');
            if (themeEl) {
                var cs = getComputedStyle(themeEl);
                ctx.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
                ctx.fillStyle = cs.color;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(state.theme, rect.width / 2, rect.height / 2);
            }
        }

        // Draw each word
        state.words.forEach(function(word) {
            var el = cloudArea.querySelector('[data-id="' + word.id + '"]');
            if (!el) return;
            ctx.save();
            var wx = word.x + el.offsetWidth / 2;
            var wy = word.y + el.offsetHeight / 2;
            ctx.translate(wx, wy);
            ctx.rotate(word.rotation * Math.PI / 180);
            ctx.font = 'bold ' + word.fontSize + 'px Arial, sans-serif';
            ctx.fillStyle = word.color;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(word.text, 0, 0);
            ctx.restore();
        });

        // Build PDF with embedded JPEG
        var jpegUrl = cvs.toDataURL('image/jpeg', 0.95);
        var raw = atob(jpegUrl.split(',')[1]);
        var jpegLen = raw.length;
        var jpegBytes = new Uint8Array(jpegLen);
        for (var i = 0; i < jpegLen; i++) jpegBytes[i] = raw.charCodeAt(i);

        var imgW = cvs.width;
        var imgH = cvs.height;
        var pageW = 841.89, pageH = 595.28, margin = 30;
        var maxW = pageW - 2 * margin, maxH = pageH - 2 * margin;
        var ratio = imgW / imgH;
        var dW, dH;
        if (maxW / maxH > ratio) { dH = maxH; dW = dH * ratio; }
        else { dW = maxW; dH = dW / ratio; }
        var dX = margin + (maxW - dW) / 2;
        var dY = margin + (maxH - dH) / 2;

        var contentStream = 'q ' + dW.toFixed(2) + ' 0 0 ' + dH.toFixed(2) + ' ' + dX.toFixed(2) + ' ' + dY.toFixed(2) + ' cm /Img Do Q';

        // Build PDF as byte array
        var parts = [];
        var offsets = {};
        var bytePos = 0;

        function addText(s) {
            var bytes = new Uint8Array(s.length);
            for (var i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
            parts.push(bytes);
            bytePos += bytes.length;
        }
        function addBinary(data) {
            parts.push(data);
            bytePos += data.length;
        }

        addText('%PDF-1.4\n');

        offsets[1] = bytePos;
        addText('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

        offsets[2] = bytePos;
        addText('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

        offsets[3] = bytePos;
        addText('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pageW + ' ' + pageH + '] /Contents 4 0 R /Resources << /XObject << /Img 5 0 R >> >> >>\nendobj\n');

        offsets[4] = bytePos;
        addText('4 0 obj\n<< /Length ' + contentStream.length + ' >>\nstream\n' + contentStream + '\nendstream\nendobj\n');

        offsets[5] = bytePos;
        addText('5 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + imgW + ' /Height ' + imgH + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpegLen + ' >>\nstream\n');
        addBinary(jpegBytes);
        addText('\nendstream\nendobj\n');

        var xrefPos = bytePos;
        addText('xref\n0 6\n');
        addText('0000000000 65535 f \n');
        for (var i = 1; i <= 5; i++) {
            var off = String(offsets[i]);
            while (off.length < 10) off = '0' + off;
            addText(off + ' 00000 n \n');
        }
        addText('trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xrefPos + '\n%%EOF');

        // Merge into single array
        var totalLen = 0;
        for (var i = 0; i < parts.length; i++) totalLen += parts[i].length;
        var result = new Uint8Array(totalLen);
        var off = 0;
        for (var i = 0; i < parts.length; i++) {
            result.set(parts[i], off);
            off += parts[i].length;
        }

        var blob = new Blob([result], { type: 'application/pdf' });
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        var safeName = state.theme.replace(/[^a-zA-Z0-9àâäéèêëïîôùûüÿçœæ ]/gi, '').replace(/\s+/g, '_') || 'nuage';
        link.download = 'nuage-de-mots-' + safeName + '.pdf';
        link.href = url;
        link.click();
        setTimeout(function() { URL.revokeObjectURL(url); }, 5000);
    }

    return {
        init: init,
        confirm: confirm,
        addWord: addWord,
        backToSetup: backToSetup,
        clear: clear,
        save: save,
        exportPDF: exportPDF
    };
})();
