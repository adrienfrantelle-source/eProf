// ===== TABLEAU BLANC eProf =====
const DRAW_TOOLS = new Set(['draw', 'eraser', 'highlighter', 'line', 'arrow', 'rect', 'circle', 'text', 'laser']);
const DRAW_TOOL_META = {
    draw: { icon: '✏️', label: 'Crayon' },
    highlighter: { icon: '🟨', label: 'Surligneur' },
    line: { icon: '／', label: 'Trait' },
    arrow: { icon: '➡️', label: 'Flèche' },
    rect: { icon: '▭', label: 'Rectangle' },
    circle: { icon: '⭕', label: 'Cercle' },
    text: { icon: 'T', label: 'Texte' },
    laser: { icon: '🔦', label: 'Laser' },
    eraser: { icon: '🧹', label: 'Gomme' }
};
const STORAGE_KEY = 'tableauBlancState';
const PANEL_COLORS_KEY = 'panelColors';
const MANUAL_STUDENTS_KEY = 'tableauBlancManualStudents';
const QR_HISTORY_KEY = 'tableauBlancQrHistory';
const BG_TYPE_LEGACY = 'tableauBlancBgType';
const CHROME_PIN_KEY = 'tableauBlancChromePinned';

let canvas, ctx;
let currentTool = 'draw';
let currentColor = '#000000';
let lineWidth = 3;
let isDrawing = false;
let activeStroke = null;
let pointerId = null;

let pages = [emptyPage()];
let currentPage = 0;
let boardStyle = 'image';
let availableBackgrounds = [];
let lastBackgroundSrc = '';
let wallpaperImg = null;
let bgImages = {};

let timerInterval = null;
let timerMode = 'countdown';
let timerRunning = false;
let timerRemaining = 0;
let timerDuration = 0;
let timerElapsed = 0;
let timerAnchor = 0;

let clockType = 'digital';
let clockInterval = null;
let calendarCursor = new Date();

let pdfFullscreenMode = false;
let currentPDF = null;
let currentPDFPage = 1;
let totalPDFPages = 0;
let pdfZoom = 1.0;
let currentPDFFileName = '';
let pdfControlsCollapsed = false;

let pickedHistory = [];
let currentGroups = [];
let chromeTimer = null;
let chromePinned = false;
let laserRaf = 0;

function emptyPage() {
    return { strokes: [], notes: '', bgImage: null };
}

function escapeHtml(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function toast(message) {
    const old = document.querySelector('.storage-toast');
    if (old) old.remove();
    const el = document.createElement('div');
    el.className = 'storage-toast';
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
}

function currentPageData() {
    if (!pages[currentPage]) pages[currentPage] = emptyPage();
    return pages[currentPage];
}

window.addEventListener('DOMContentLoaded', () => {
    loadBoardStyle();
    discoverBackgrounds().then(() => {
        if (boardStyle === 'image') loadRandomBackground();
        markBoardStyleButtons();
    });
    initCanvas();
    bindChrome();
    bindToolbar();
    bindDrawControls();
    showDrawPalette();
    bindTaskbarControls();
    initDraggablePanels();
    loadPanelColors();
    loadPagesFromStorage();
    redraw();
    updatePageIndicator();
    loadNotesIntoEditor();
    updateClock();
    setInterval(updateClock, 1000);
    renderCalendar();
    renderQrHistory();
    initNotesEditor();
    initPDFViewer();
    if (window.WordCloud) WordCloud.init();
    bootStudentPicker();
    applyTimerModeUi();
    markBoardStyleButtons();
    loadChromePinned();
    bumpChrome();
});

function bindChrome() {
    document.getElementById('fullscreen-btn').addEventListener('click', toggleFullscreen);
    document.getElementById('settings-btn').addEventListener('click', () => openToolPanel('settings-panel'));
    document.getElementById('undo-btn').addEventListener('click', undoStroke);
    document.getElementById('redo-btn').addEventListener('click', redoStroke);
    document.getElementById('export-page-btn').addEventListener('click', exportCurrentPage);
    document.getElementById('prev-page-btn').addEventListener('click', () => changePage(-1));
    document.getElementById('next-page-btn').addEventListener('click', () => changePage(1));
    document.getElementById('add-page-btn').addEventListener('click', addPage);
    document.getElementById('remove-page-btn').addEventListener('click', removePage);
    document.getElementById('toolbar-more-btn').addEventListener('click', () => {
        const more = document.getElementById('toolbar-more');
        more.classList.toggle('is-open');
        more.hidden = false;
    });
    document.getElementById('draw-folder-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDrawWheel();
    });
    const peek = document.getElementById('toolbar-peek');
    const toolbar = document.getElementById('main-toolbar');
    const topLeft = document.querySelector('.top-left-controls');
    const topRight = document.querySelector('.top-controls');
    const pageNav = document.querySelector('.page-navigation');
    peek?.addEventListener('mouseenter', showChrome);
    peek?.addEventListener('mouseleave', () => scheduleHideChrome(400));
    peek?.addEventListener('touchstart', showChrome, { passive: true });
    toolbar?.addEventListener('mouseenter', showChrome);
    toolbar?.addEventListener('mouseleave', () => scheduleHideChrome(800));
    topLeft?.addEventListener('mouseenter', showChrome);
    topLeft?.addEventListener('mouseleave', () => scheduleHideChrome(800));
    topRight?.addEventListener('mouseenter', showChrome);
    topRight?.addEventListener('mouseleave', () => scheduleHideChrome(800));
    pageNav?.addEventListener('mouseenter', showChrome);
    pageNav?.addEventListener('mouseleave', () => scheduleHideChrome(800));
    document.getElementById('pin-chrome-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleChromePin();
    });
    document.getElementById('whiteboard-canvas')?.addEventListener('pointerdown', hideChromeForBoard);
    document.addEventListener('click', (e) => {
        const wrap = document.querySelector('.draw-folder-wrap');
        if (wrap && !wrap.contains(e.target)) closeDrawWheel();
    });
    document.addEventListener('keydown', onGlobalKey);
}

function loadChromePinned() {
    chromePinned = localStorage.getItem(CHROME_PIN_KEY) === '1';
    applyChromePinned();
}

function toggleChromePin() {
    chromePinned = !chromePinned;
    localStorage.setItem(CHROME_PIN_KEY, chromePinned ? '1' : '0');
    applyChromePinned();
    if (chromePinned) showChrome();
    else scheduleHideChrome(1200);
}

function applyChromePinned() {
    document.body.classList.toggle('chrome-pinned', chromePinned);
    const btn = document.getElementById('pin-chrome-btn');
    if (!btn) return;
    btn.classList.toggle('is-pinned', chromePinned);
    btn.setAttribute('aria-pressed', chromePinned ? 'true' : 'false');
    btn.title = chromePinned
        ? 'Désépingler les barres'
        : 'Épingler les barres (elles restent visibles)';
}

function showChrome() {
    document.body.classList.remove('chrome-hidden');
    clearTimeout(chromeTimer);
}

function hideChromeForBoard() {
    if (chromePinned || hasOpenPanel()) return;
    hideChromeNow();
}

function hideChromeNow() {
    if (chromePinned) return;
    clearTimeout(chromeTimer);
    closeDrawWheel();
    document.body.classList.add('chrome-hidden');
}

function scheduleHideChrome(delay) {
    if (chromePinned) return;
    clearTimeout(chromeTimer);
    if (hasOpenPanel()) return;
    chromeTimer = setTimeout(hideChromeNow, delay);
}

function bumpChrome() {
    showChrome();
    if (chromePinned || hasOpenPanel()) return;
    scheduleHideChrome(3000);
}

function hasOpenPanel() {
    return [...document.querySelectorAll('.tool-panel')].some(p => p.style.display !== 'none');
}

function onGlobalKey(e) {
    const inField = /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (inField) return;
        e.preventDefault();
        if (e.shiftKey) redoStroke();
        else undoStroke();
        return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        if (inField) return;
        e.preventDefault();
        redoStroke();
        return;
    }
    if (e.key === 'Escape') {
        hideTextInput();
        closeDrawWheel();
        if (hasOpenPanel()) {
            const open = [...document.querySelectorAll('.tool-panel')].filter(p => p.style.display !== 'none');
            const top = open.sort((a, b) => (parseInt(b.style.zIndex) || 0) - (parseInt(a.style.zIndex) || 0))[0];
            if (top) closePanel(top.id);
        } else if (currentTool === 'laser') {
            setCurrentTool('draw');
        }
        return;
    }
    if (inField) return;
    if (e.key === 'ArrowLeft') changePage(-1);
    if (e.key === 'ArrowRight') changePage(1);
}

function bindToolbar() {
    document.querySelectorAll('#main-toolbar .tool-btn[id$="-tool"]').forEach(btn => {
        btn.addEventListener('click', () => handleToolClick(btn.id));
    });
    updateDrawFolderButton();
    applyDefaultPenForBoard();
}

function bindDrawControls() {
    const colorPicker = document.getElementById('draw-color');
    const widthSlider = document.getElementById('draw-width');
    const widthValue = document.getElementById('width-value');
    if (colorPicker) {
        colorPicker.addEventListener('input', (e) => setDrawColor(e.target.value));
    }
    if (widthSlider) {
        widthSlider.addEventListener('input', (e) => {
            lineWidth = parseInt(e.target.value, 10);
            if (widthValue) widthValue.textContent = lineWidth;
        });
    }
    document.querySelectorAll('.draw-swatch').forEach(btn => {
        btn.addEventListener('click', () => setDrawColor(btn.dataset.color));
    });
    document.getElementById('draw-palette-close')?.addEventListener('click', (e) => {
        e.stopPropagation();
        hideDrawPalette();
    });
    markActiveSwatch();
}

function setDrawColor(hex) {
    if (!hex) return;
    currentColor = hex.length === 4
        ? '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3]
        : hex.toLowerCase();
    const picker = document.getElementById('draw-color');
    if (picker) picker.value = currentColor;
    markActiveSwatch();
}

function markActiveSwatch() {
    const current = (currentColor || '').toLowerCase();
    document.querySelectorAll('.draw-swatch').forEach(btn => {
        btn.classList.toggle('active', (btn.dataset.color || '').toLowerCase() === current);
    });
}

function showDrawPalette() {
    const palette = document.getElementById('draw-palette');
    if (palette) palette.hidden = false;
    bumpChrome();
}

function hideDrawPalette() {
    const palette = document.getElementById('draw-palette');
    if (palette) palette.hidden = true;
}

function pageRedo(page) {
    const p = page || currentPageData();
    if (!p.redo) p.redo = [];
    return p.redo;
}

// ===== FOND =====
function loadBoardStyle() {
    const saved = localStorage.getItem('tableauBlancBoardStyle');
    const legacy = localStorage.getItem(BG_TYPE_LEGACY);
    if (saved === 'black' || saved === 'lined' || saved === 'grid' || saved === 'image') {
        boardStyle = saved;
    } else if (legacy === 'white') {
        boardStyle = 'white';
    } else {
        boardStyle = 'image';
    }
    applyBoardStyleClass();
    markBoardStyleButtons();
}

async function discoverBackgrounds() {
    const found = new Set();
    try {
        const res = await fetch('img/');
        if (res.ok) {
            const html = await res.text();
            const re = /href="([^"?#]+\.(?:jpg|jpeg|png|webp|gif))"/gi;
            let match;
            while ((match = re.exec(html))) {
                let name = match[1].split('/').pop();
                try { name = decodeURIComponent(name); } catch (e) { /* keep */ }
                if (name && !name.startsWith('.')) found.add('img/' + name);
            }
        }
    } catch (e) { /* listing indisponible */ }
    if (!found.size) {
        const probes = [];
        for (let i = 1; i <= 40; i++) {
            probes.push('img/fond' + i + '.jpg', 'img/fond' + i + '.png');
        }
        await Promise.all(probes.map(src => new Promise(resolve => {
            const img = new Image();
            img.onload = () => { found.add(src); resolve(); };
            img.onerror = () => resolve();
            img.src = src;
        })));
    }
    availableBackgrounds = [...found];
    return availableBackgrounds;
}

function loadRandomBackground() {
    if (!availableBackgrounds.length) {
        document.body.style.backgroundImage = 'none';
        return;
    }
    let pool = availableBackgrounds;
    if (pool.length > 1 && lastBackgroundSrc) {
        pool = pool.filter(src => src !== lastBackgroundSrc);
    }
    const src = pool[Math.floor(Math.random() * pool.length)];
    lastBackgroundSrc = src;
    document.body.style.backgroundImage = 'url("' + src.replace(/"/g, '\\"') + '")';
    const img = new Image();
    img.onload = () => {
        wallpaperImg = img;
        maybeAutoPenFromImage(img);
    };
    img.onerror = () => { wallpaperImg = null; };
    img.src = src;
}

function changeBackgroundImage() {
    if (boardStyle !== 'image') setBoardStyle('image');
    else if (!availableBackgrounds.length) toast('Aucune image trouvée dans le dossier img.');
    else loadRandomBackground();
}

function setBoardStyle(style) {
    boardStyle = style;
    localStorage.setItem('tableauBlancBoardStyle', style);
    applyBoardStyleClass();
    markBoardStyleButtons();
    if (style === 'image') {
        loadRandomBackground();
    } else {
        wallpaperImg = null;
        applyDefaultPenForBoard();
    }
}

function isDefaultPenColor() {
    const c = (currentColor || '').toLowerCase();
    return c === '#000000' || c === '#ffffff';
}

function applyDefaultPenForBoard() {
    if (!isDefaultPenColor()) return;
    if (boardStyle === 'black') setDrawColor('#ffffff');
    else setDrawColor('#000000');
}

function maybeAutoPenFromImage(img) {
    if (!isDefaultPenColor() || !img) return;
    try {
        const c = document.createElement('canvas');
        c.width = 24;
        c.height = 24;
        const x = c.getContext('2d');
        x.drawImage(img, 0, 0, 24, 24);
        const data = x.getImageData(0, 0, 24, 24).data;
        let lum = 0;
        for (let i = 0; i < data.length; i += 4) {
            lum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        }
        lum /= data.length / 4;
        setDrawColor(lum < 110 ? '#ffffff' : '#000000');
    } catch (e) {
        applyDefaultPenForBoard();
    }
}

function applyBoardStyleClass() {
    document.body.classList.remove('board-white', 'board-black', 'board-lined', 'board-grid', 'board-image');
    document.body.classList.add('board-' + boardStyle);
    const changeBtn = document.getElementById('change-bg-image-btn');
    if (changeBtn) changeBtn.style.display = boardStyle === 'image' ? '' : 'none';
    if (boardStyle !== 'image') {
        document.body.style.backgroundImage = 'none';
    }
}

function markBoardStyleButtons() {
    document.querySelectorAll('.board-style-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.style === boardStyle);
    });
}

function toggleDrawWheel() {
    const wheel = document.getElementById('draw-wheel');
    if (!wheel) return;
    wheel.hidden = !wheel.hidden;
    if (!wheel.hidden) bumpChrome();
}

function closeDrawWheel() {
    const wheel = document.getElementById('draw-wheel');
    if (wheel) wheel.hidden = true;
}

function updateDrawFolderButton() {
    const btn = document.getElementById('draw-folder-btn');
    if (!btn) return;
    const meta = DRAW_TOOL_META[currentTool] || DRAW_TOOL_META.draw;
    btn.textContent = DRAW_TOOLS.has(currentTool) ? meta.icon : '✏️';
    btn.title = 'Outils de dessin — ' + meta.label;
    btn.classList.toggle('active', DRAW_TOOLS.has(currentTool));
}

// ===== CANVAS =====
function initCanvas() {
    canvas = document.getElementById('whiteboard-canvas');
    ctx = canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
}

function resizeCanvas() {
    const prevW = canvas.width;
    const prevH = canvas.height;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    if (prevW > 0 && prevH > 0) {
        const sx = canvas.width / prevW;
        const sy = canvas.height / prevH;
        pages.forEach(page => {
            page.strokes.forEach(stroke => scaleStroke(stroke, sx, sy));
        });
    }
    redraw();
}

function scaleStroke(stroke, sx, sy) {
    if (stroke.points) stroke.points.forEach(p => { p.x *= sx; p.y *= sy; });
    ['x', 'x1', 'x2'].forEach(k => { if (typeof stroke[k] === 'number') stroke[k] *= sx; });
    ['y', 'y1', 'y2'].forEach(k => { if (typeof stroke[k] === 'number') stroke[k] *= sy; });
}

function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (e.clientX - rect.left) * (canvas.width / rect.width),
        y: (e.clientY - rect.top) * (canvas.height / rect.height)
    };
}

function setCurrentTool(tool) {
    currentTool = tool;
    document.querySelectorAll('#main-toolbar .tool-btn[id$="-tool"]').forEach(btn => {
        const name = btn.id.replace('-tool', '');
        btn.classList.toggle('active', name === tool);
    });
    updateDrawFolderButton();
    const cursors = {
        draw: 'crosshair', eraser: 'cell', highlighter: 'crosshair',
        line: 'crosshair', arrow: 'crosshair', rect: 'crosshair',
        circle: 'crosshair', text: 'text', laser: 'none'
    };
    canvas.style.cursor = cursors[tool] || 'crosshair';
}

function handleToolClick(toolId) {
    const tool = toolId.replace('-tool', '');
    const panelId = toolId.replace('-tool', '-panel');
    const panel = document.getElementById(panelId);

    if (DRAW_TOOLS.has(tool)) {
        setCurrentTool(tool);
        closeDrawWheel();
        if (tool === 'laser') hideDrawPalette();
        else showDrawPalette();
        return;
    }

    closeDrawWheel();

    if (panel && panel.style.display !== 'none') {
        minimizePanel(panelId);
        document.getElementById(toolId)?.classList.remove('active');
        return;
    }
    if (panel && panel.dataset.minimized === 'true') {
        panel.dataset.minimized = 'false';
        panel.style.display = 'block';
        document.getElementById(toolId)?.classList.add('active');
        bringPanelToFront(panel);
        refreshTaskbar();
        bumpChrome();
        return;
    }

    document.querySelectorAll('#main-toolbar .tool-btn[id$="-tool"]').forEach(btn => {
        if (!DRAW_TOOLS.has(btn.id.replace('-tool', ''))) btn.classList.remove('active');
    });
    document.getElementById(toolId)?.classList.add('active');
    updateDrawFolderButton();
    if (panel) openToolPanel(panelId);
}

function onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    const pos = getPos(e);
    if (currentTool === 'laser') {
        showLaser(e.clientX, e.clientY);
        pointerId = e.pointerId;
        canvas.setPointerCapture?.(e.pointerId);
        return;
    }
    if (currentTool === 'text') {
        startTextInput(pos, e);
        return;
    }
    if (!DRAW_TOOLS.has(currentTool)) return;
    isDrawing = true;
    pointerId = e.pointerId;
    canvas.setPointerCapture?.(e.pointerId);
    pageRedo().length = 0;
    if (currentTool === 'draw' || currentTool === 'eraser' || currentTool === 'highlighter') {
        activeStroke = {
            type: currentTool,
            color: currentColor,
            width: currentTool === 'eraser' ? lineWidth * 3 : (currentTool === 'highlighter' ? lineWidth * 4 : lineWidth),
            points: [pos]
        };
    } else {
        activeStroke = {
            type: currentTool,
            color: currentColor,
            width: lineWidth,
            x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y
        };
    }
}

function onPointerMove(e) {
    if (currentTool === 'laser' && pointerId === e.pointerId) {
        showLaser(e.clientX, e.clientY);
        return;
    }
    if (!isDrawing || !activeStroke) return;
    const pos = getPos(e);
    if (activeStroke.points) activeStroke.points.push(pos);
    else {
        activeStroke.x2 = pos.x;
        activeStroke.y2 = pos.y;
    }
    redraw();
}

function onPointerUp(e) {
    if (currentTool === 'laser') {
        hideLaserSoon();
        pointerId = null;
        return;
    }
    if (!isDrawing || !activeStroke) return;
    isDrawing = false;
    if (activeStroke.points && activeStroke.points.length < 2) {
        activeStroke.points.push({ x: activeStroke.points[0].x + 0.1, y: activeStroke.points[0].y + 0.1 });
    }
    currentPageData().strokes.push(activeStroke);
    activeStroke = null;
    pointerId = null;
    redraw();
    persistState();
}

function showLaser(x, y) {
    const dot = document.getElementById('laser-dot');
    if (!dot) return;
    dot.hidden = false;
    dot.style.left = x + 'px';
    dot.style.top = y + 'px';
    hideLaserSoon();
}

function hideLaserSoon() {
    cancelAnimationFrame(laserRaf);
    laserRaf = requestAnimationFrame(() => {
        setTimeout(() => {
            const dot = document.getElementById('laser-dot');
            if (dot && !isDrawing) dot.hidden = true;
        }, 400);
    });
}

function startTextInput(pos, e) {
    const wrap = document.getElementById('text-input-wrap');
    const input = document.getElementById('canvas-text-input');
    wrap.hidden = false;
    wrap.style.left = e.clientX + 'px';
    wrap.style.top = e.clientY + 'px';
    wrap.dataset.x = String(pos.x);
    wrap.dataset.y = String(pos.y);
    input.value = '';
    setTimeout(() => input.focus(), 0);
    input.onkeydown = (ev) => {
        if (ev.key === 'Enter') { ev.preventDefault(); commitTextInput(); }
        if (ev.key === 'Escape') hideTextInput();
    };
    input.onblur = () => commitTextInput();
}

function commitTextInput() {
    const wrap = document.getElementById('text-input-wrap');
    const input = document.getElementById('canvas-text-input');
    if (wrap.hidden) return;
    const text = (input.value || '').trim();
    if (text) {
        currentPageData().strokes.push({
            type: 'text',
            text,
            x: parseFloat(wrap.dataset.x),
            y: parseFloat(wrap.dataset.y),
            color: currentColor,
            width: Math.max(16, lineWidth * 6)
        });
        pageRedo().length = 0;
        persistState();
        redraw();
    }
    hideTextInput();
}

function hideTextInput() {
    const wrap = document.getElementById('text-input-wrap');
    if (wrap) wrap.hidden = true;
}

function paintStroke(context, stroke) {
    context.save();
    if (stroke.type === 'eraser') {
        context.globalCompositeOperation = 'destination-out';
        context.strokeStyle = 'rgba(0,0,0,1)';
        context.lineWidth = stroke.width;
        context.lineCap = 'round';
        context.lineJoin = 'round';
        tracePath(context, stroke.points);
        context.stroke();
    } else if (stroke.type === 'highlighter') {
        context.globalAlpha = 0.35;
        context.strokeStyle = stroke.color;
        context.lineWidth = stroke.width;
        context.lineCap = 'round';
        context.lineJoin = 'round';
        tracePath(context, stroke.points);
        context.stroke();
    } else if (stroke.type === 'draw') {
        context.strokeStyle = stroke.color;
        context.lineWidth = stroke.width;
        context.lineCap = 'round';
        context.lineJoin = 'round';
        tracePath(context, stroke.points);
        context.stroke();
    } else if (stroke.type === 'line' || stroke.type === 'arrow') {
        context.strokeStyle = stroke.color;
        context.lineWidth = stroke.width;
        context.lineCap = 'round';
        context.beginPath();
        context.moveTo(stroke.x1, stroke.y1);
        context.lineTo(stroke.x2, stroke.y2);
        context.stroke();
        if (stroke.type === 'arrow') drawArrowHead(context, stroke);
    } else if (stroke.type === 'rect') {
        context.strokeStyle = stroke.color;
        context.lineWidth = stroke.width;
        context.strokeRect(stroke.x1, stroke.y1, stroke.x2 - stroke.x1, stroke.y2 - stroke.y1);
    } else if (stroke.type === 'circle') {
        context.strokeStyle = stroke.color;
        context.lineWidth = stroke.width;
        const rx = (stroke.x2 - stroke.x1) / 2;
        const ry = (stroke.y2 - stroke.y1) / 2;
        context.beginPath();
        context.ellipse(stroke.x1 + rx, stroke.y1 + ry, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2);
        context.stroke();
    } else if (stroke.type === 'text') {
        context.fillStyle = stroke.color;
        context.font = `700 ${stroke.width}px "Segoe UI", sans-serif`;
        context.fillText(stroke.text, stroke.x, stroke.y);
    }
    context.restore();
}

function tracePath(context, points) {
    if (!points || !points.length) return;
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) context.lineTo(points[i].x, points[i].y);
}

function drawArrowHead(context, stroke) {
    const angle = Math.atan2(stroke.y2 - stroke.y1, stroke.x2 - stroke.x1);
    const len = 12 + stroke.width * 2;
    context.beginPath();
    context.moveTo(stroke.x2, stroke.y2);
    context.lineTo(stroke.x2 - len * Math.cos(angle - 0.4), stroke.y2 - len * Math.sin(angle - 0.4));
    context.moveTo(stroke.x2, stroke.y2);
    context.lineTo(stroke.x2 - len * Math.cos(angle + 0.4), stroke.y2 - len * Math.sin(angle + 0.4));
    context.stroke();
}

let strokeLayer = null;
let strokeCtx = null;

function ensureStrokeLayer() {
    if (!strokeLayer) {
        strokeLayer = document.createElement('canvas');
        strokeCtx = strokeLayer.getContext('2d');
    }
    if (strokeLayer.width !== canvas.width || strokeLayer.height !== canvas.height) {
        strokeLayer.width = canvas.width;
        strokeLayer.height = canvas.height;
    }
}

function redraw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const page = currentPageData();
    if (page.bgImage && bgImages[page.bgImage]) {
        const img = bgImages[page.bgImage];
        const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
    }
    ensureStrokeLayer();
    strokeCtx.clearRect(0, 0, strokeLayer.width, strokeLayer.height);
    page.strokes.forEach(stroke => paintStroke(strokeCtx, stroke));
    if (activeStroke) paintStroke(strokeCtx, activeStroke);
    ctx.drawImage(strokeLayer, 0, 0);
}

function undoStroke() {
    const page = currentPageData();
    if (!page.strokes.length) return;
    pageRedo(page).push(page.strokes.pop());
    redraw();
    persistState();
}

function redoStroke() {
    const page = currentPageData();
    const stack = pageRedo(page);
    if (!stack.length) return;
    page.strokes.push(stack.pop());
    redraw();
    persistState();
}

function clearCanvas() {
    if (!confirm('Effacer le dessin de cette page ?')) return;
    currentPageData().strokes = [];
    currentPageData().bgImage = null;
    pageRedo().length = 0;
    redraw();
    persistState();
}

function boardFillColor() {
    if (boardStyle === 'black') return '#1a1a1a';
    if (boardStyle === 'lined') return '#fffef5';
    return '#ffffff';
}

function drawImageCover(context, img, w, h) {
    if (!img || !img.width) return;
    const ir = img.width / img.height;
    const cr = w / h;
    let dw, dh, dx, dy;
    if (ir > cr) {
        dh = h;
        dw = img.width * (h / img.height);
        dx = (w - dw) / 2;
        dy = 0;
    } else {
        dw = w;
        dh = img.height * (w / img.width);
        dx = 0;
        dy = (h - dh) / 2;
    }
    context.drawImage(img, dx, dy, dw, dh);
}

function exportCurrentPage() {
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const ex = exportCanvas.getContext('2d');
    ex.fillStyle = boardFillColor();
    ex.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    if (boardStyle === 'image' && wallpaperImg) {
        drawImageCover(ex, wallpaperImg, exportCanvas.width, exportCanvas.height);
    }
    if (boardStyle === 'lined' || boardStyle === 'grid') {
        ex.strokeStyle = boardStyle === 'lined' ? '#c7d2fe' : '#e2e8f0';
        ex.lineWidth = 1;
        for (let y = 32; y < exportCanvas.height; y += 32) {
            ex.beginPath(); ex.moveTo(0, y); ex.lineTo(exportCanvas.width, y); ex.stroke();
        }
        if (boardStyle === 'grid') {
            for (let x = 32; x < exportCanvas.width; x += 32) {
                ex.beginPath(); ex.moveTo(x, 0); ex.lineTo(x, exportCanvas.height); ex.stroke();
            }
        }
    }
    ex.drawImage(canvas, 0, 0);
    const link = document.createElement('a');
    link.download = 'tableau-page-' + (currentPage + 1) + '.png';
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
}

function pinPdfToBoard() {
    const pdfCanvas = document.getElementById('pdf-canvas');
    if (!pdfCanvas || !currentPDF) {
        toast('Chargez d’abord un PDF.');
        return;
    }
    const jpeg = pdfCanvas.toDataURL('image/jpeg', 0.82);
    const id = 'pdf-' + Date.now();
    const img = new Image();
    img.onload = () => {
        bgImages[id] = img;
        currentPageData().bgImage = id;
        persistState();
        redraw();
        toast('PDF posé en fond de la page ' + (currentPage + 1) + '. Dessinez par-dessus.');
    };
    img.src = jpeg;
    rememberBgData(id, jpeg);
}

const bgDataStore = {};
function rememberBgData(id, dataUrl) {
    bgDataStore[id] = dataUrl;
}

function loadBgImage(id, dataUrl) {
    if (!dataUrl) return;
    rememberBgData(id, dataUrl);
    const img = new Image();
    img.onload = () => { bgImages[id] = img; redraw(); };
    img.src = dataUrl;
}

// ===== PAGES =====
function changePage(direction) {
    saveNotesFromEditor();
    const next = currentPage + direction;
    if (next < 0 || next >= pages.length) return;
    currentPage = next;
    redraw();
    updatePageIndicator();
    loadNotesIntoEditor();
    persistState();
}

function addPage() {
    saveNotesFromEditor();
    pages.push(emptyPage());
    currentPage = pages.length - 1;
    redraw();
    updatePageIndicator();
    loadNotesIntoEditor();
    persistState();
}

function removePage() {
    if (pages.length <= 1) {
        toast('Il faut au moins une page.');
        return;
    }
    if (!confirm('Supprimer cette page ?')) return;
    pages.splice(currentPage, 1);
    if (currentPage >= pages.length) currentPage = pages.length - 1;
    redraw();
    updatePageIndicator();
    loadNotesIntoEditor();
    persistState();
}

function updatePageIndicator() {
    const indicator = document.getElementById('page-indicator');
    const prevBtn = document.getElementById('prev-page-btn');
    const nextBtn = document.getElementById('next-page-btn');
    if (indicator) indicator.textContent = (currentPage + 1) + '/' + pages.length;
    if (prevBtn) prevBtn.disabled = currentPage === 0;
    if (nextBtn) nextBtn.disabled = currentPage === pages.length - 1;
}

function persistState() {
    const payload = {
        currentPage,
        boardStyle,
        pages: pages.map(p => ({
            strokes: p.strokes,
            notes: p.notes,
            bgImage: p.bgImage && bgDataStore[p.bgImage] ? p.bgImage : null,
            bgData: p.bgImage && bgDataStore[p.bgImage] ? bgDataStore[p.bgImage] : null
        }))
    };
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        return;
    } catch (e) { /* quota */ }
    try {
        const slim = {
            currentPage,
            boardStyle,
            pages: pages.map(p => ({ strokes: p.strokes, notes: p.notes, bgImage: null, bgData: null }))
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
        toast('Espace local saturé : le fond PDF n’a pas été enregistré.');
    } catch (err) {
        toast('Impossible d’enregistrer le tableau (quota du navigateur).');
    }
}

function loadPagesFromStorage() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
        migrateLegacyPages();
        return;
    }
    try {
        const data = JSON.parse(raw);
        if (Array.isArray(data.pages) && data.pages.length) {
            pages = data.pages.map(p => {
                const page = { strokes: p.strokes || [], notes: p.notes || '', bgImage: p.bgImage || null };
                if (p.bgData && p.bgImage) loadBgImage(p.bgImage, p.bgData);
                return page;
            });
            currentPage = Math.min(data.currentPage || 0, pages.length - 1);
        }
        const legacyNotes = localStorage.getItem('tableauBlancNotes');
        if (legacyNotes && pages[0] && !pages[0].notes) pages[0].notes = legacyNotes;
    } catch (e) {
        console.error('Chargement tableau blanc', e);
    }
}

function migrateLegacyPages() {
    const saved = localStorage.getItem('tableauBlancPages');
    const notes = localStorage.getItem('tableauBlancNotes') || '';
    if (!saved) {
        if (notes) pages[0].notes = notes;
        return;
    }
    try {
        const data = JSON.parse(saved);
        const keys = Object.keys(data).sort((a, b) => Number(a) - Number(b));
        if (!keys.length) return;
        pages = keys.map((k, i) => ({ strokes: [], notes: i === 0 ? notes : '', bgImage: null }));
        keys.forEach((k, i) => {
            const url = data[k] && data[k].canvasData;
            if (!url) return;
            const img = new Image();
            img.onload = () => {
                const id = 'legacy-' + i;
                bgImages[id] = img;
                pages[i].bgImage = id;
                rememberBgData(id, url);
                if (i === currentPage) redraw();
            };
            img.src = url;
        });
        currentPage = 0;
    } catch (e) { /* ignore */ }
}

function resetAll() {
    if (!confirm('Réinitialiser le tableau (dessins, notes, pages) ?')) return;
    pages = [emptyPage()];
    currentPage = 0;
    pickedHistory = [];
    currentGroups = [];
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('tableauBlancPages');
    localStorage.removeItem('tableauBlancNotes');
    localStorage.removeItem(PANEL_COLORS_KEY);
    redraw();
    updatePageIndicator();
    loadNotesIntoEditor();
    resetTimer();
    document.querySelectorAll('.tool-panel').forEach(p => { p.style.display = 'none'; });
    refreshTaskbar();
}

// ===== PANNEAUX =====
function openToolPanel(panelId) {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    panel.style.display = 'flex';
    panel.dataset.minimized = 'false';
    panel.classList.remove('panel-minimized');
    bringPanelToFront(panel);
    refreshTaskbar();
    bumpChrome();
}

function closePanel(panelId) {
    const panel = document.getElementById(panelId);
    if (panel) {
        panel.style.display = 'none';
        panel.dataset.minimized = 'false';
        panel.classList.remove('panel-maximized');
    }
    const toolKey = panelId.replace('-panel', '-tool');
    if (!DRAW_TOOLS.has(toolKey.replace('-tool', ''))) {
        document.getElementById(toolKey)?.classList.remove('active');
    }
    refreshTaskbar();
    bumpChrome();
}

function minimizePanel(panelId) {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    panel.dataset.minimized = 'true';
    panel.style.display = 'none';
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
    const panels = [...document.querySelectorAll('.tool-panel')].filter(panel =>
        panel.style.display !== 'none' || panel.dataset.minimized === 'true'
    );
    if (!panels.length) {
        taskbar.innerHTML = '';
        return;
    }
    const labels = {
        'student-picker-panel': 'Tirage',
        'timer-panel': 'Chrono',
        'clock-panel': 'Horloge',
        'calendar-panel': 'Calendrier',
        'dice-panel': 'Dé',
        'qrcode-panel': 'QR',
        'notes-panel': 'Notes',
        'wordcloud-panel': 'Nuage',
        'calculator-panel': 'Calc',
        'pdf-viewer-panel': 'PDF',
        'settings-panel': 'Réglages'
    };
    taskbar.innerHTML = panels.map(panel => {
        const isMinimized = panel.dataset.minimized === 'true';
        const label = labels[panel.id] || panel.id.replace('-panel', '');
        return `<button type="button" class="task-btn ${isMinimized ? 'minimized' : 'active'}" data-panel-id="${panel.id}">${label}</button>`;
    }).join('');
    taskbar.querySelectorAll('.task-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const panel = document.getElementById(btn.dataset.panelId);
            if (!panel) return;
            if (panel.style.display === 'none') {
                panel.dataset.minimized = 'false';
                panel.style.display = 'flex';
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
        maxBtn.title = 'Agrandir';
        maxBtn.textContent = '□';
        maxBtn.addEventListener('click', () => toggleMaximizePanel(panel.id));
        controls.insertBefore(maxBtn, controls.querySelector('.close-panel'));
        controls.insertBefore(minBtn, controls.querySelector('.close-panel'));
    });
}

function bringPanelToFront(panel) {
    let maxZ = 200;
    document.querySelectorAll('.tool-panel').forEach(p => {
        const z = parseInt(window.getComputedStyle(p).zIndex, 10) || 200;
        if (z > maxZ) maxZ = z;
    });
    panel.style.zIndex = maxZ + 1;
}

function changePanelColor(panelId, color) {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    panel.style.backgroundColor = color;
    const saved = JSON.parse(localStorage.getItem(PANEL_COLORS_KEY) || '{}');
    saved[panelId] = color;
    localStorage.setItem(PANEL_COLORS_KEY, JSON.stringify(saved));
}

function loadPanelColors() {
    const saved = JSON.parse(localStorage.getItem(PANEL_COLORS_KEY) || '{}');
    Object.keys(saved).forEach(panelId => {
        const panel = document.getElementById(panelId);
        if (!panel) return;
        panel.style.backgroundColor = saved[panelId];
        const colorInput = panel.querySelector('.color-picker-btn input[type="color"]');
        if (colorInput) colorInput.value = saved[panelId];
    });
}

function initDraggablePanels() {
    document.querySelectorAll('.tool-panel').forEach(panel => {
        let dragging = false;
        let resizing = false;
        let xOffset = 0;
        let yOffset = 0;
        let startWidth, startHeight, startX, startY;
        const header = panel.querySelector('.panel-header');
        const resizeHandle = panel.querySelector('.resize-handle');
        panel.style.left = panel.style.left || '50%';
        panel.style.top = panel.style.top || '50%';
        panel.style.transform = panel.dataset.maximized === 'true' ? 'none' : 'translate(-50%, -50%)';

        header?.addEventListener('mousedown', dragStart);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', () => { dragging = false; resizing = false; });
        if (resizeHandle) {
            resizeHandle.addEventListener('mousedown', resizeStart);
            document.addEventListener('mousemove', resize);
        }

        function dragStart(e) {
            if (panel.dataset.maximized === 'true') return;
            if (e.target.classList.contains('close-panel') || e.target.closest('.color-picker-btn') || e.target.closest('.panel-action-btn')) return;
            const rect = panel.getBoundingClientRect();
            xOffset = e.clientX - rect.left;
            yOffset = e.clientY - rect.top;
            dragging = true;
            panel.style.transform = 'none';
            bringPanelToFront(panel);
        }
        function drag(e) {
            if (!dragging || resizing) return;
            panel.style.left = Math.max(10, Math.min(window.innerWidth - panel.offsetWidth - 10, e.clientX - xOffset)) + 'px';
            panel.style.top = Math.max(10, Math.min(window.innerHeight - panel.offsetHeight - 10, e.clientY - yOffset)) + 'px';
        }
        function resizeStart(e) {
            e.preventDefault();
            e.stopPropagation();
            resizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startWidth = parseInt(getComputedStyle(panel).width, 10);
            startHeight = parseInt(getComputedStyle(panel).height, 10);
            bringPanelToFront(panel);
        }
        function resize(e) {
            if (!resizing) return;
            const width = startWidth + (e.clientX - startX);
            const height = startHeight + (e.clientY - startY);
            if (width > 280) panel.style.width = width + 'px';
            if (height > 180) panel.style.height = height + 'px';
        }
    });
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
    } else {
        document.exitFullscreen();
    }
}

// ===== CLASSES DU PROF (session déjà ouverte, pas de gate) =====
async function resolveTeacherClassNames() {
    if (window.getTeacherClassNames) {
        const names = window.getTeacherClassNames();
        if (names && names.length) return names.slice().sort();
    }
    try {
        await (window.eprofSupabaseReady || Promise.resolve());
        if (!window.EprofStore) return [];
        const session = await window.EprofStore.getSession();
        if (session && session.user && session.user.email) {
            const identifiant = session.user.email.split('@')[0];
            const local = localStorage.getItem('eprof_teacherConfig_' + identifiant);
            if (local) {
                const cfg = JSON.parse(local);
                if (cfg.classes && cfg.classes.length) return cfg.classes.slice().sort();
            }
        }
        if (await window.EprofStore.isOnlineReady()) {
            const teacherId = await window.EprofStore.getTeacherId();
            const result = await window.EprofStore.list('profiles', { filters: { id: teacherId } });
            const profile = result.data && result.data[0];
            if (profile && Array.isArray(profile.classes) && profile.classes.length) {
                return profile.classes.slice().sort();
            }
        }
    } catch (e) { /* hors ligne */ }
    return [];
}

async function bootStudentPicker() {
    await (window.eprofSupabaseReady || Promise.resolve());
    if (window.EprofReferentiel) await window.EprofReferentiel.load();
    await initStudentPicker();
}
document.addEventListener('eprof-referentiel-maj', () => initStudentPicker());
window.addEventListener('teacherLoggedIn', () => initStudentPicker());
window.addEventListener('teacherDataReloaded', () => initStudentPicker());

async function initStudentPicker() {
    const classNames = await resolveTeacherClassNames();
    fillClassChecks('student-class-list', classNames, 'random');
    fillClassChecks('groups-class-list', classNames, 'groups');
    renderManualStudentEditor('__no_class__', 'random');
    renderManualStudentEditor('__no_class__', 'groups');
    refreshAbsentLists();
}

function fillClassChecks(containerId, classNames, kind) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const previous = getSelectedClassNames(kind);
    if (!classNames.length) {
        container.innerHTML = '<span class="manual-student-empty">Aucune classe du compte en cours. Ajoutez des noms manuellement, ou ouvrez eProf connecté.</span>';
        return;
    }
    container.innerHTML = classNames.map(name => {
        const checked = previous.length
            ? (previous.includes(name) ? 'checked' : '')
            : (name === classNames[0] ? 'checked' : '');
        return `<label><input type="checkbox" class="class-check-${kind}" value="${escapeHtml(name)}" ${checked}> ${escapeHtml(name)}</label>`;
    }).join('');
    container.querySelectorAll('input').forEach(input => {
        input.addEventListener('change', refreshAbsentLists);
    });
}

function selectAllClasses(kind, on) {
    document.querySelectorAll('.class-check-' + kind).forEach(cb => { cb.checked = on; });
    refreshAbsentLists();
}

function getSelectedClassNames(kind) {
    return [...document.querySelectorAll('.class-check-' + kind + ':checked')].map(cb => cb.value);
}

function getManualStudentList(className) {
    const storage = JSON.parse(localStorage.getItem(MANUAL_STUDENTS_KEY) || '{}');
    const key = className || '__no_class__';
    return Array.isArray(storage[key]) ? storage[key] : [];
}

function saveManualStudentList(className, names) {
    const storage = JSON.parse(localStorage.getItem(MANUAL_STUDENTS_KEY) || '{}');
    storage[className || '__no_class__'] = names;
    localStorage.setItem(MANUAL_STUDENTS_KEY, JSON.stringify(storage));
}

function studentsOfClass(className) {
    const listes = window.getAvailableStudentLists ? window.getAvailableStudentLists() : {};
    const out = [];
    if (className && listes[className]) {
        listes[className].forEach(student => {
            const fullName = `${student.prenom || ''} ${student.nom || ''}`.trim();
            if (fullName) out.push({ name: fullName, className, key: className + '|' + fullName });
        });
    }
    getManualStudentList(className).forEach(name => {
        out.push({ name, className: className === '__no_class__' ? '' : className, key: (className || '') + '|' + name });
    });
    return out;
}

function getPooledStudents(kind) {
    const classes = getSelectedClassNames(kind);
    const pool = [];
    const seen = new Set();
    const add = (item) => {
        if (seen.has(item.key)) return;
        seen.add(item.key);
        pool.push(item);
    };
    if (classes.length) {
        classes.forEach(c => studentsOfClass(c).forEach(add));
    } else {
        studentsOfClass('__no_class__').forEach(add);
    }
    getManualStudentList('__no_class__').forEach(name => add({ name, className: '', key: '|' + name }));
    return pool;
}

function labelStudent(item, multi) {
    if (multi && item.className) return item.name + ' · ' + item.className;
    return item.name;
}

function refreshAbsentLists() {
    renderAbsentList('random');
    renderAbsentList('groups');
    const randomClass = getSelectedClassNames('random')[0] || '__no_class__';
    const groupClass = getSelectedClassNames('groups')[0] || '__no_class__';
    renderManualStudentEditor(randomClass, 'random');
    renderManualStudentEditor(groupClass, 'groups');
}

function renderAbsentList(kind) {
    const container = document.getElementById(kind === 'random' ? 'absent-list-random' : 'absent-list-groups');
    if (!container) return;
    const pool = getPooledStudents(kind);
    const multi = getSelectedClassNames(kind).length > 1;
    if (!pool.length) {
        container.innerHTML = '<p style="color:#ef4444;margin:10px 0;">Aucun élève. Cochez une classe ou ajoutez un nom.</p>';
        return;
    }
    container.innerHTML = `<div style="max-height:240px;overflow-y:auto;border:2px solid #e2e8f0;border-radius:8px;padding:10px;background:white;">
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;">
            ${pool.map(item => `<label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin:0;">
                <input type="checkbox" class="absent-checkbox-${kind}" value="${escapeHtml(item.key)}">
                <span>${escapeHtml(labelStudent(item, multi))}</span>
            </label>`).join('')}
        </div></div>`;
}

function renderManualStudentEditor(className, kind) {
    const container = document.getElementById(kind === 'random' ? 'manual-student-list-random' : 'manual-student-list-groups');
    if (!container) return;
    const names = getManualStudentList(className);
    container.innerHTML = `<div class="manual-student-editor">
        <div class="manual-student-input-line">
            <input type="text" class="manual-student-input" placeholder="Ajouter un nom">
            <button type="button" class="manual-student-add-btn">Ajouter</button>
        </div>
        <div class="manual-student-tags">
            ${names.length ? names.map(name => `<span class="manual-student-tag">${escapeHtml(name)}
                <button type="button" class="manual-student-remove" data-name="${escapeHtml(name)}">×</button>
            </span>`).join('') : '<span class="manual-student-empty">Aucun nom manuel.</span>'}
        </div>
    </div>`;
    const add = () => {
        const input = container.querySelector('.manual-student-input');
        const value = input ? input.value.trim() : '';
        if (!value) return;
        const existing = getManualStudentList(className);
        if (!existing.includes(value)) saveManualStudentList(className, [...existing, value]);
        renderManualStudentEditor(className, kind);
        refreshAbsentLists();
    };
    container.querySelector('.manual-student-add-btn')?.addEventListener('click', add);
    container.querySelector('.manual-student-input')?.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') { ev.preventDefault(); add(); }
    });
    container.querySelectorAll('.manual-student-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            saveManualStudentList(className, getManualStudentList(className).filter(n => n !== btn.dataset.name));
            renderManualStudentEditor(className, kind);
            refreshAbsentLists();
        });
    });
}

function collapsePickerSetup(kind) {
    const setup = document.getElementById(kind === 'groups' ? 'groups-setup' : 'random-setup');
    if (setup) setup.open = false;
}

function switchStudentTab(tab) {
    const randomTab = document.getElementById('random-tab-content');
    const groupsTab = document.getElementById('groups-tab-content');
    const tabs = document.querySelectorAll('.student-tab');
    tabs.forEach(t => t.classList.remove('active'));
    if (tab === 'random') {
        randomTab.style.display = 'flex';
        groupsTab.style.display = 'none';
        tabs[0].classList.add('active');
    } else {
        randomTab.style.display = 'none';
        groupsTab.style.display = 'flex';
        tabs[1].classList.add('active');
    }
}

function pickStudents() {
    const count = parseInt(document.getElementById('student-count').value, 10) || 1;
    const resultsDiv = document.getElementById('picked-students');
    const avoid = document.getElementById('avoid-picked')?.checked;
    const absents = new Set([...document.querySelectorAll('.absent-checkbox-random:checked')].map(cb => cb.value));
    let available = getPooledStudents('random').filter(s => !absents.has(s.key));
    if (avoid) available = available.filter(s => !pickedHistory.includes(s.key));
    if (!available.length) {
        resultsDiv.innerHTML = '<p style="color:#ef4444;">Plus personne à tirer (absents ou déjà interrogés).</p>';
        return;
    }
    const picked = [];
    const n = Math.min(count, available.length);
    for (let i = 0; i < n; i++) {
        const idx = Math.floor(Math.random() * available.length);
        picked.push(available.splice(idx, 1)[0]);
    }
    picked.forEach(s => { if (!pickedHistory.includes(s.key)) pickedHistory.push(s.key); });
    renderPickedHistory();
    collapsePickerSetup('random');
    const multi = getSelectedClassNames('random').length > 1;
    resultsDiv.innerHTML = '';
    picked.forEach((student, index) => {
        setTimeout(() => {
            const card = document.createElement('div');
            card.className = 'picked-student-card';
            card.textContent = labelStudent(student, multi);
            resultsDiv.appendChild(card);
        }, index * 250);
    });
}

function renderPickedHistory() {
    const el = document.getElementById('picked-history');
    if (!el) return;
    if (!pickedHistory.length) {
        el.textContent = '';
        return;
    }
    const pool = getPooledStudents('random');
    const multi = getSelectedClassNames('random').length > 1;
    const labels = pickedHistory.map(key => {
        const found = pool.find(s => s.key === key);
        return found ? labelStudent(found, multi) : key.split('|')[1];
    });
    el.textContent = 'Déjà tirés (' + labels.length + ') : ' + labels.join(', ');
}

function resetPickedHistory() {
    pickedHistory = [];
    renderPickedHistory();
    const resultsDiv = document.getElementById('picked-students');
    if (resultsDiv) resultsDiv.innerHTML = '';
}

function updateGroupsMode() {
    const mode = document.getElementById('groups-mode').value;
    document.getElementById('groups-count-label').style.display = mode === 'count' ? '' : 'none';
    document.getElementById('groups-size-label').style.display = mode === 'size' ? '' : 'none';
}

function createRandomGroups() {
    const mode = document.getElementById('groups-mode').value;
    const groupsCount = parseInt(document.getElementById('groups-count').value, 10) || 3;
    const groupsSize = parseInt(document.getElementById('groups-size').value, 10) || 4;
    const absentsKeys = new Set([...document.querySelectorAll('.absent-checkbox-groups:checked')].map(cb => cb.value));
    const pool = getPooledStudents('groups');
    if (!pool.length) {
        document.getElementById('groups-result').innerHTML = '<p style="color:#ef4444;">Aucun élève.</p>';
        return;
    }
    const presents = pool.filter(s => !absentsKeys.has(s.key));
    const absents = pool.filter(s => absentsKeys.has(s.key));
    if (!presents.length) {
        document.getElementById('groups-result').innerHTML = '<p style="color:#ef4444;">Tous les élèves sont absents.</p>';
        return;
    }
    const shuffled = [...presents];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    let groups = [];
    if (mode === 'count') {
        const num = Math.min(groupsCount, shuffled.length);
        const base = Math.floor(shuffled.length / num);
        const rem = shuffled.length % num;
        let idx = 0;
        for (let i = 0; i < num; i++) {
            const size = base + (i < rem ? 1 : 0);
            groups.push({ members: shuffled.slice(idx, idx + size).map(s => ({ ...s, absent: false })) });
            idx += size;
        }
    } else {
        const num = Math.ceil(shuffled.length / groupsSize);
        for (let i = 0; i < num; i++) {
            groups.push({ members: shuffled.slice(i * groupsSize, (i + 1) * groupsSize).map(s => ({ ...s, absent: false })) });
        }
    }
    absents.forEach(absent => {
        let min = Infinity;
        let minI = 0;
        groups.forEach((g, i) => {
            if (g.members.length < min) { min = g.members.length; minI = i; }
        });
        groups[minI].members.push({ ...absent, absent: true });
    });
    currentGroups = groups;
    collapsePickerSetup('groups');
    renderGroups();
}

function renderGroups() {
    const resultsDiv = document.getElementById('groups-result');
    const multi = getSelectedClassNames('groups').length > 1;
    resultsDiv.innerHTML = '';
    currentGroups.forEach((group, gi) => {
        const card = document.createElement('div');
        card.className = 'group-card';
        card.dataset.group = String(gi);
        const header = document.createElement('div');
        header.className = 'group-header';
        header.textContent = 'Groupe ' + (gi + 1) + ' (' + group.members.length + ')';
        const list = document.createElement('div');
        list.className = 'group-students';
        group.members.forEach((member, mi) => {
            const item = document.createElement('div');
            item.className = 'group-student-item' + (member.absent ? ' absent-student' : '');
            item.draggable = true;
            item.dataset.group = String(gi);
            item.dataset.index = String(mi);
            item.textContent = (member.absent ? '(' : '') + labelStudent(member, multi) + (member.absent ? ')' : '');
            item.addEventListener('dragstart', (e) => {
                item.classList.add('dragging');
                e.dataTransfer.setData('text/plain', gi + ':' + mi);
            });
            item.addEventListener('dragend', () => item.classList.remove('dragging'));
            list.appendChild(item);
        });
        card.addEventListener('dragover', (e) => { e.preventDefault(); card.classList.add('drop-target'); });
        card.addEventListener('dragleave', () => card.classList.remove('drop-target'));
        card.addEventListener('drop', (e) => {
            e.preventDefault();
            card.classList.remove('drop-target');
            const [fromG, fromI] = e.dataTransfer.getData('text/plain').split(':').map(Number);
            const toG = gi;
            if (fromG === toG) return;
            const [moved] = currentGroups[fromG].members.splice(fromI, 1);
            if (moved) currentGroups[toG].members.push(moved);
            renderGroups();
        });
        card.appendChild(header);
        card.appendChild(list);
        resultsDiv.appendChild(card);
    });
}

function groupsAsText() {
    const multi = getSelectedClassNames('groups').length > 1;
    return currentGroups.map((g, i) => {
        const lines = g.members.map(m => '- ' + (m.absent ? '(' : '') + labelStudent(m, multi) + (m.absent ? ')' : ''));
        return 'Groupe ' + (i + 1) + '\n' + lines.join('\n');
    }).join('\n\n');
}

function copyGroups() {
    if (!currentGroups.length) { toast('Aucun groupe à copier.'); return; }
    navigator.clipboard.writeText(groupsAsText()).then(() => toast('Groupes copiés.')).catch(() => toast('Copie impossible.'));
}

function printGroups() {
    if (!currentGroups.length) { toast('Aucun groupe à imprimer.'); return; }
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Groupes</title>
        <style>body{font-family:sans-serif;padding:24px;} .g{break-inside:avoid;margin-bottom:16px;border:1px solid #ddd;padding:12px;border-radius:8px;} h2{margin:0 0 8px;}</style>
        </head><body><h1>Groupes</h1>${currentGroups.map((g, i) => {
            const multi = getSelectedClassNames('groups').length > 1;
            return `<div class="g"><h2>Groupe ${i + 1}</h2><ul>${g.members.map(m => `<li>${escapeHtml(labelStudent(m, multi))}${m.absent ? ' (absent)' : ''}</li>`).join('')}</ul></div>`;
        }).join('')}<script>onload=()=>{print();setTimeout(()=>close(),200);}<\/script></body></html>`);
    w.document.close();
}

// ===== TIMER =====
function setTimerMode(mode) {
    timerMode = mode;
    applyTimerModeUi();
    resetTimer();
}

function applyTimerModeUi() {
    const fields = document.getElementById('timer-countdown-fields');
    if (fields) fields.style.display = timerMode === 'countdown' ? '' : 'none';
}

function applyTimerPreset(minutes) {
    document.getElementById('timer-minutes').value = minutes;
    document.getElementById('timer-seconds').value = 0;
    document.querySelector('input[name="timer-mode"][value="countdown"]').checked = true;
    setTimerMode('countdown');
}

function startTimer() {
    if (timerRunning) return;
    if (timerMode === 'countdown') {
        if (timerRemaining <= 0) {
            const minutes = parseInt(document.getElementById('timer-minutes').value, 10) || 0;
            const seconds = parseInt(document.getElementById('timer-seconds').value, 10) || 0;
            timerDuration = minutes * 60 + seconds;
            timerRemaining = timerDuration;
        }
        if (timerRemaining <= 0) return;
        timerAnchor = performance.now();
        const snapshot = timerRemaining;
        timerRunning = true;
        document.getElementById('timer-start-btn').textContent = '▶️ Reprendre';
        timerInterval = setInterval(() => {
            const elapsed = (performance.now() - timerAnchor) / 1000;
            timerRemaining = Math.max(0, snapshot - elapsed);
            if (timerRemaining <= 0) {
                timerRemaining = 0;
                pauseTimer();
                playTimerSound();
            }
            updateTimerDisplay();
        }, 50);
    } else {
        timerAnchor = performance.now();
        const snapshot = timerElapsed;
        timerRunning = true;
        document.getElementById('timer-start-btn').textContent = '▶️ Reprendre';
        timerInterval = setInterval(() => {
            timerElapsed = snapshot + (performance.now() - timerAnchor) / 1000;
            updateTimerDisplay();
        }, 50);
    }
    updateTimerDisplay();
}

function pauseTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    timerRunning = false;
}

function resetTimer() {
    pauseTimer();
    timerRemaining = 0;
    timerElapsed = 0;
    timerDuration = 0;
    const btn = document.getElementById('timer-start-btn');
    if (btn) btn.textContent = '▶️ Démarrer';
    updateTimerDisplay();
}

function updateTimerDisplay() {
    const display = document.getElementById('timer-display');
    const secondary = document.getElementById('timer-display-secondary');
    if (!display) return;
    const total = timerMode === 'countdown' ? timerRemaining : timerElapsed;
    const minutes = Math.floor(total / 60);
    const seconds = Math.floor(total % 60);
    const hundredths = Math.floor((total % 1) * 100);
    display.textContent = String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
    if (secondary) {
        secondary.textContent = (timerMode === 'countdown' && total <= 10)
            ? display.textContent + '.' + String(hundredths).padStart(2, '0')
            : (timerMode === 'stopwatch' ? display.textContent + '.' + String(hundredths).padStart(2, '0') : '00:00.00');
    }
    display.classList.remove('warning', 'danger');
    if (timerMode === 'countdown') {
        if (total <= 10 && total > 0) display.classList.add('danger');
        else if (total <= 60 && timerDuration > 60) display.classList.add('warning');
    }
    drawTimerAnalog();
}

function drawTimerAnalog() {
    const c = document.getElementById('timer-analog');
    if (!c) return;
    const cctx = c.getContext('2d');
    const cx = c.width / 2;
    const cy = c.height / 2;
    const radius = c.width / 2 - 12;
    const ratio = timerMode === 'countdown'
        ? (timerDuration > 0 ? Math.max(0, Math.min(1, timerRemaining / timerDuration)) : 0)
        : Math.min(1, (timerElapsed % 60) / 60);
    cctx.clearRect(0, 0, c.width, c.height);
    cctx.beginPath();
    cctx.arc(cx, cy, radius, 0, Math.PI * 2);
    cctx.lineWidth = 16;
    cctx.strokeStyle = '#e2e8f0';
    cctx.stroke();
    cctx.beginPath();
    cctx.arc(cx, cy, radius, -Math.PI / 2, (-Math.PI / 2) + (Math.PI * 2 * ratio));
    cctx.lineWidth = 16;
    cctx.strokeStyle = '#ef4444';
    cctx.stroke();
}

function playTimerSound() {
    try {
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
    } catch (e) { /* ignore */ }
}

// ===== HORLOGE =====
function clockNow() {
    const timezone = document.getElementById('clock-timezone')?.value || 'local';
    if (timezone === 'local') return new Date();
    try {
        const parts = new Intl.DateTimeFormat('en-GB', {
            timeZone: timezone === 'UTC' ? 'UTC' : timezone,
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
        }).formatToParts(new Date());
        const get = (t) => parseInt(parts.find(p => p.type === t).value, 10);
        const d = new Date();
        d.setHours(get('hour'), get('minute'), get('second'), 0);
        return d;
    } catch (e) {
        return new Date();
    }
}

function updateClockType() {
    clockType = document.getElementById('clock-type').value;
    document.getElementById('clock-display').style.display = clockType === 'digital' ? 'block' : 'none';
    document.getElementById('analog-clock').style.display = clockType === 'analog' ? 'block' : 'none';
    updateClock();
}

function updateClock() {
    const now = clockNow();
    const clockDisplay = document.getElementById('clock-display');
    if (clockDisplay) {
        clockDisplay.textContent = [now.getHours(), now.getMinutes(), now.getSeconds()]
            .map(n => String(n).padStart(2, '0')).join(':');
    }
    if (clockType === 'analog') drawAnalogClock(now);
}

function drawAnalogClock(now) {
    const c = document.getElementById('analog-clock');
    if (!c) return;
    const cctx = c.getContext('2d');
    const radius = c.width / 2;
    cctx.setTransform(1, 0, 0, 1, 0, 0);
    cctx.clearRect(0, 0, c.width, c.height);
    cctx.save();
    cctx.translate(radius, radius);
    cctx.beginPath();
    cctx.arc(0, 0, radius - 10, 0, 2 * Math.PI);
    cctx.fillStyle = 'white';
    cctx.fill();
    cctx.lineWidth = 8;
    cctx.strokeStyle = '#1a2236';
    cctx.stroke();
    cctx.strokeStyle = '#1a2236';
    cctx.lineWidth = 3;
    for (let i = 0; i < 12; i++) {
        const angle = i * Math.PI / 6;
        cctx.beginPath();
        cctx.moveTo(Math.sin(angle) * (radius - 20), -Math.cos(angle) * (radius - 20));
        cctx.lineTo(Math.sin(angle) * (radius - 35), -Math.cos(angle) * (radius - 35));
        cctx.stroke();
    }
    cctx.fillStyle = '#1a2236';
    cctx.font = 'bold 20px Arial';
    cctx.textAlign = 'center';
    cctx.textBaseline = 'middle';
    for (let i = 1; i <= 12; i++) {
        const angle = i * Math.PI / 6;
        cctx.fillText(String(i), Math.sin(angle) * (radius - 50), -Math.cos(angle) * (radius - 50));
    }
    const hour = now.getHours() % 12;
    const minute = now.getMinutes();
    const second = now.getSeconds();
    drawHand(cctx, (hour * Math.PI / 6) + (minute * Math.PI / 360), radius * 0.5, 6, '#1a2236');
    drawHand(cctx, (minute * Math.PI / 30) + (second * Math.PI / 1800), radius * 0.7, 4, '#334155');
    drawHand(cctx, second * Math.PI / 30, radius * 0.8, 2, '#ef4444');
    cctx.restore();
}

function drawHand(cctx, angle, length, width, color) {
    cctx.beginPath();
    cctx.lineWidth = width;
    cctx.lineCap = 'round';
    cctx.strokeStyle = color;
    cctx.moveTo(0, 0);
    cctx.lineTo(Math.sin(angle) * length, -Math.cos(angle) * length);
    cctx.stroke();
}

// ===== CALENDRIER =====
function getAnneeScolaireLocal() {
    try { return JSON.parse(localStorage.getItem('parametres') || '{}').anneeScolaire || '2026-2027'; }
    catch (e) { return '2026-2027'; }
}

function holidayMap() {
    const annee = getAnneeScolaireLocal();
    const parts = String(annee).split('-');
    const y1 = parseInt(parts[0], 10) || 2026;
    const y2 = parseInt(parts[1], 10) || y1 + 1;
    const map = {};
    function add(title, start, end, kind) {
        const from = new Date(start);
        const to = end ? new Date(end) : from;
        for (let d = new Date(from); d < to; d.setDate(d.getDate() + 1)) {
            map[d.toISOString().slice(0, 10)] = { title, kind };
        }
        if (!end) map[start] = { title, kind };
    }
    const vacances = {
        '2025-2026': [
            ['Vacances de la Toussaint', '2025-10-18', '2025-11-03'],
            ['Vacances de Noël', '2025-12-20', '2026-01-05'],
            ['Vacances d\'hiver', '2026-02-07', '2026-02-23'],
            ['Vacances de printemps', '2026-04-04', '2026-04-20'],
            ['Vacances d\'été', '2026-07-04', '2026-09-01']
        ],
        '2026-2027': [
            ['Vacances de la Toussaint', '2026-10-17', '2026-11-02'],
            ['Vacances de Noël', '2026-12-19', '2027-01-04'],
            ['Vacances d\'hiver', '2027-02-13', '2027-03-01'],
            ['Vacances de printemps', '2027-04-10', '2027-04-26'],
            ['Vacances d\'été', '2027-07-03', '2027-09-01']
        ],
        '2027-2028': [
            ['Vacances de la Toussaint', '2027-10-23', '2027-11-03'],
            ['Vacances de Noël', '2027-12-18', '2028-01-03'],
            ['Vacances d\'hiver', '2028-02-19', '2028-03-06'],
            ['Vacances de printemps', '2028-04-15', '2028-05-02'],
            ['Vacances d\'été', '2028-07-08', '2028-09-04']
        ]
    };
    (vacances[annee] || vacances['2026-2027']).forEach(v => add(v[0], v[1], v[2], 'vacation'));
    [y1, y2].forEach(year => {
        add('Jour de l\'An', year + '-01-01', null, 'holiday');
        add('Fête du Travail', year + '-05-01', null, 'holiday');
        add('Victoire 1945', year + '-05-08', null, 'holiday');
        add('Fête Nationale', year + '-07-14', null, 'holiday');
        add('Assomption', year + '-08-15', null, 'holiday');
        add('Toussaint', year + '-11-01', null, 'holiday');
        add('Armistice', year + '-11-11', null, 'holiday');
        add('Noël', year + '-12-25', null, 'holiday');
    });
    return map;
}

function shiftCalendarMonth(delta) {
    calendarCursor.setMonth(calendarCursor.getMonth() + delta);
    renderCalendar();
}

function renderCalendar() {
    const root = document.getElementById('calendar-display');
    const label = document.getElementById('calendar-month-label');
    if (!root) return;
    const year = calendarCursor.getFullYear();
    const month = calendarCursor.getMonth();
    if (label) {
        label.textContent = calendarCursor.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    }
    const first = new Date(year, month, 1);
    const startDow = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    const marks = holidayMap();
    const dows = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
    let html = '<div class="cal-grid">';
    html += dows.map(d => `<div class="cal-dow">${d}</div>`).join('');
    for (let i = 0; i < startDow; i++) html += '<div class="cal-day empty"></div>';
    for (let day = 1; day <= daysInMonth; day++) {
        const iso = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
        const mark = marks[iso];
        const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
        const cls = ['cal-day', isToday ? 'today' : '', mark ? mark.kind : ''].filter(Boolean).join(' ');
        html += `<div class="${cls}" title="${mark ? escapeHtml(mark.title) : ''}">${day}${mark ? `<span class="cal-mark">${escapeHtml(mark.title.replace('Vacances de la ', '').replace('Vacances d\'', ''))}</span>` : ''}</div>`;
    }
    html += '</div>';
    root.innerHTML = html;
}

// ===== DÉ =====
function rollDice() {
    const min = parseInt(document.getElementById('dice-min').value, 10) || 1;
    const max = parseInt(document.getElementById('dice-max').value, 10) || 6;
    const count = parseInt(document.getElementById('dice-count').value, 10) || 1;
    const resultDisplay = document.getElementById('dice-result');
    const resultsList = document.getElementById('dice-results-list');
    if (min > max) {
        resultDisplay.textContent = '❌';
        resultsList.innerHTML = '';
        return;
    }
    const results = [];
    for (let i = 0; i < count; i++) results.push(Math.floor(Math.random() * (max - min + 1)) + min);
    let rolls = 0;
    const rollInterval = setInterval(() => {
        const temp = [];
        for (let i = 0; i < count; i++) temp.push(Math.floor(Math.random() * (max - min + 1)) + min);
        resultDisplay.textContent = count > 1 ? temp.join(' • ') : String(temp[0]);
        resultsList.innerHTML = temp.map((v, i) => `<div class="dice-result-item">Dé ${i + 1}: <strong>${v}</strong></div>`).join('');
        rolls++;
        if (rolls >= 10) {
            clearInterval(rollInterval);
            resultDisplay.textContent = count > 1 ? results.join(' • ') : String(results[0]);
            resultsList.innerHTML = results.map((v, i) => `<div class="dice-result-item">Dé ${i + 1}: <strong>${v}</strong></div>`).join('');
        }
    }, 80);
}

// ===== QR =====
function fillQrPreset() {
    const input = document.getElementById('qrcode-text');
    if (!input) return;
    input.value = window.location.href;
    generateQRCode();
}

function renderQrHistory() {
    const box = document.getElementById('qr-history');
    if (!box) return;
    const hist = JSON.parse(localStorage.getItem(QR_HISTORY_KEY) || '[]');
    box.innerHTML = '';
    hist.forEach(item => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = item.length > 32 ? item.slice(0, 32) + '…' : item;
        btn.addEventListener('click', () => {
            document.getElementById('qrcode-text').value = item;
            generateQRCode();
        });
        box.appendChild(btn);
    });
}

function generateQRCode() {
    const text = document.getElementById('qrcode-text').value.trim();
    const qrcodeDiv = document.getElementById('qrcode-display');
    if (!text) {
        qrcodeDiv.innerHTML = '<p style="color:#ef4444;">Entrez du texte ou une URL</p>';
        return;
    }
    qrcodeDiv.innerHTML = '';
    if (typeof QRCode === 'undefined') {
        qrcodeDiv.innerHTML = '<p style="color:#ef4444;">Bibliothèque QRCode non chargée</p>';
        return;
    }
    new QRCode(qrcodeDiv, { text, width: 256, height: 256, colorDark: '#000000', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.H });
    const hist = JSON.parse(localStorage.getItem(QR_HISTORY_KEY) || '[]').filter(x => x !== text);
    hist.unshift(text);
    localStorage.setItem(QR_HISTORY_KEY, JSON.stringify(hist.slice(0, 5)));
    renderQrHistory();
}

// ===== NOTES =====
function notesHint() {
    const hint = document.getElementById('notes-page-hint');
    if (hint) hint.textContent = 'Notes de la page ' + (currentPage + 1);
}

function loadNotesIntoEditor() {
    const editor = document.getElementById('notes-editor');
    if (editor) editor.innerHTML = currentPageData().notes || '';
    notesHint();
}

function saveNotesFromEditor() {
    const editor = document.getElementById('notes-editor');
    if (editor) currentPageData().notes = editor.innerHTML;
}

function saveNotes() {
    saveNotesFromEditor();
    persistState();
    toast('Notes de la page ' + (currentPage + 1) + ' enregistrées.');
}

function clearNotes() {
    if (!confirm('Effacer les notes de cette page ?')) return;
    const editor = document.getElementById('notes-editor');
    if (editor) editor.innerHTML = '';
    currentPageData().notes = '';
    persistState();
}

function initNotesEditor() {
    const editor = document.getElementById('notes-editor');
    if (!editor) return;
    setInterval(() => {
        saveNotesFromEditor();
        persistState();
    }, 30000);
}

function formatText(command, value) {
    const editor = document.getElementById('notes-editor');
    if (!editor) return;
    editor.focus();
    document.execCommand(command, false, value || null);
}

function exportNotesAsPDF() {
    saveNotesFromEditor();
    const all = pages.map((p, i) => {
        if (!p.notes || !p.notes.trim()) return '';
        return `<h2>Page ${i + 1}</h2><div>${p.notes}</div>`;
    }).join('');
    if (!all.trim()) {
        alert('Aucune note à exporter');
        return;
    }
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Notes</title>
        <style>body{font-family:Arial,sans-serif;padding:40px;line-height:1.6;max-width:800px;margin:0 auto;} h1{color:#667eea;}</style>
        </head><body><h1>Notes — Tableau blanc eProf</h1>${all}
        <script>onload=()=>{print();setTimeout(()=>close(),150);}<\/script></body></html>`);
    w.document.close();
}

// ===== PDF =====
function initPDFViewer() {
    const dropZone = document.getElementById('pdf-drop-zone');
    const fileInput = document.getElementById('pdf-file-input');
    if (!dropZone) return;
    dropZone.addEventListener('click', () => fileInput.click());
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(name => {
        dropZone.addEventListener(name, (e) => { e.preventDefault(); e.stopPropagation(); });
    });
    ['dragenter', 'dragover'].forEach(name => dropZone.addEventListener(name, () => {
        dropZone.style.borderColor = '#3b82f6';
        dropZone.style.background = '#dbeafe';
    }));
    ['dragleave', 'drop'].forEach(name => dropZone.addEventListener(name, () => {
        dropZone.style.borderColor = '#94a3b8';
        dropZone.style.background = '#f8fafc';
    }));
    dropZone.addEventListener('drop', (e) => {
        const file = e.dataTransfer.files[0];
        if (file && file.type === 'application/pdf') loadPDFFromFile(file);
        else alert('Veuillez déposer un fichier PDF.');
    });
}

function loadPDFFile(event) {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') loadPDFFromFile(file);
    else alert('Veuillez sélectionner un fichier PDF.');
}

function loadPDFFromFile(file) {
    currentPDFFileName = file.name;
    const reader = new FileReader();
    reader.onload = function () {
        if (typeof pdfjsLib === 'undefined') {
            alert('PDF.js n’est pas chargé.');
            return;
        }
        pdfjsLib.getDocument(new Uint8Array(this.result)).promise.then(pdf => {
            currentPDF = pdf;
            totalPDFPages = pdf.numPages;
            currentPDFPage = 1;
            pdfZoom = 1;
            document.getElementById('pdf-viewer-container').style.display = 'block';
            document.getElementById('pdf-import-section').style.display = 'none';
            document.getElementById('show-import-btn').style.display = 'block';
            document.getElementById('pdf-filename').textContent = '📄 ' + currentPDFFileName;
            renderPDFPage(currentPDFPage);
        }).catch(err => alert('Erreur PDF : ' + err.message));
    };
    reader.readAsArrayBuffer(file);
}

function renderPDFPage(pageNum) {
    if (!currentPDF) return;
    currentPDF.getPage(pageNum).then(page => {
        const pdfCanvas = document.getElementById('pdf-canvas');
        const context = pdfCanvas.getContext('2d');
        const viewport = page.getViewport({ scale: 1.5 * pdfZoom });
        pdfCanvas.height = viewport.height;
        pdfCanvas.width = viewport.width;
        page.render({ canvasContext: context, viewport }).promise.then(updatePDFPageInfo);
    });
}

function updatePDFPageInfo() {
    const info = document.getElementById('pdf-page-info');
    if (info) info.textContent = `Page ${currentPDFPage} / ${totalPDFPages}`;
    const zoomInfo = document.getElementById('pdf-zoom-info');
    if (zoomInfo) zoomInfo.textContent = Math.round(pdfZoom * 100) + '%';
}

function previousPDFPage() { if (currentPDFPage > 1) { currentPDFPage--; renderPDFPage(currentPDFPage); } }
function nextPDFPage() { if (currentPDFPage < totalPDFPages) { currentPDFPage++; renderPDFPage(currentPDFPage); } }
function zoomInPDF() { if (pdfZoom < 3) { pdfZoom += 0.25; renderPDFPage(currentPDFPage); } }
function zoomOutPDF() { if (pdfZoom > 0.5) { pdfZoom -= 0.25; renderPDFPage(currentPDFPage); } }

function closePDFViewer() {
    currentPDF = null;
    document.getElementById('pdf-viewer-container').style.display = 'none';
    document.getElementById('pdf-import-section').style.display = 'block';
    document.getElementById('show-import-btn').style.display = 'none';
    document.getElementById('pdf-file-input').value = '';
}

function togglePDFImportSection() {
    const section = document.getElementById('pdf-import-section');
    section.style.display = section.style.display === 'none' ? 'block' : 'none';
}

function togglePDFControls() {
    const controlsSection = document.getElementById('pdf-controls-section');
    const toggleBtn = document.getElementById('pdf-toggle-controls-btn');
    const canvasContainer = document.getElementById('pdf-canvas-container');
    pdfControlsCollapsed = !pdfControlsCollapsed;
    controlsSection.style.display = pdfControlsCollapsed ? 'none' : 'block';
    toggleBtn.textContent = pdfControlsCollapsed ? '▼ Afficher les contrôles' : '▲ Réduire les contrôles';
    canvasContainer.style.maxHeight = pdfControlsCollapsed ? '700px' : '500px';
}

function togglePDFFullscreen() {
    const panel = document.getElementById('pdf-viewer-panel');
    const canvasContainer = document.getElementById('pdf-canvas-container');
    const fullscreenBtn = document.getElementById('pdf-fullscreen-btn');
    pdfFullscreenMode = !pdfFullscreenMode;
    if (pdfFullscreenMode) {
        Object.assign(panel.style, {
            position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
            maxWidth: 'none', maxHeight: 'none', zIndex: '10000', transform: 'none', borderRadius: '0'
        });
        canvasContainer.style.maxHeight = 'calc(100vh - 200px)';
        if (fullscreenBtn) fullscreenBtn.textContent = '🗗 Quitter plein écran';
    } else {
        Object.assign(panel.style, {
            position: 'absolute', top: '50%', left: '50%', width: 'auto', height: 'auto',
            maxWidth: '90vw', maxHeight: '85vh', zIndex: '200', transform: 'translate(-50%, -50%)', borderRadius: '12px'
        });
        canvasContainer.style.maxHeight = '500px';
        if (fullscreenBtn) fullscreenBtn.textContent = '🖥️ Plein écran';
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
            x: 0, y: 0, placed: false
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
        var themeEl = cloudArea.querySelector('.wc-theme-label');
        if (themeEl) {
            existingRects.push({
                x: cx - themeEl.offsetWidth / 2 - 10,
                y: cy - themeEl.offsetHeight / 2 - 10,
                w: themeEl.offsetWidth + 20,
                h: themeEl.offsetHeight + 20
            });
        }
        cloudArea.querySelectorAll('.wc-word').forEach(function(el) {
            var elId = parseInt(el.dataset.id, 10);
            if (elId === wordObj.id) return;
            existingRects.push({
                x: parseInt(el.style.left, 10) || 0,
                y: parseInt(el.style.top, 10) || 0,
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
        var sortedWords = state.words.slice().sort(function(a, b) { return b.weight - a.weight; });
        sortedWords.forEach(function(wordObj) {
            var el = document.createElement('div');
            el.className = 'wc-word';
            el.dataset.id = wordObj.id;
            el.style.fontSize = wordObj.fontSize + 'px';
            el.style.color = wordObj.color;
            el.style.setProperty('--wc-rot', wordObj.rotation + 'deg');
            el.style.transform = 'rotate(' + wordObj.rotation + 'deg)';
            el.appendChild(document.createTextNode(wordObj.text));
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
            if (!wordObj.placed) {
                var pos = findPosition(wordObj, cloudArea);
                wordObj.x = pos.x;
                wordObj.y = pos.y;
                wordObj.placed = true;
            }
            el.style.left = wordObj.x + 'px';
            el.style.top = wordObj.y + 'px';
            if (animateId && wordObj.id === animateId) el.classList.add('wc-word-animated');
        });
        updateWordCount();
    }

    function updateWordCount() {
        var countEl = document.getElementById('wc-word-count');
        if (countEl) {
            countEl.textContent = state.words.length > 0 ? state.words.length + ' mot' + (state.words.length > 1 ? 's' : '') : '';
        }
    }

    function onDragStart(e, wordId) {
        if (e.target.classList.contains('wc-word-remove')) return;
        e.preventDefault();
        var el = e.currentTarget;
        el.classList.add('wc-dragging');
        dragState = {
            wordId: wordId, el: el, startX: e.clientX, startY: e.clientY,
            origLeft: parseInt(el.style.left, 10), origTop: parseInt(el.style.top, 10)
        };
    }

    function onTouchStart(e, wordId) {
        if (e.target.classList.contains('wc-word-remove')) return;
        e.preventDefault();
        var touch = e.touches[0];
        var el = e.currentTarget;
        el.classList.add('wc-dragging');
        dragState = {
            wordId: wordId, el: el, startX: touch.clientX, startY: touch.clientY,
            origLeft: parseInt(el.style.left, 10), origTop: parseInt(el.style.top, 10), isTouch: true
        };
        document.addEventListener('touchmove', onTouchMove, { passive: false });
        document.addEventListener('touchend', onTouchEnd);
    }

    function onDragMove(e) {
        if (!dragState || dragState.isTouch) return;
        dragState.el.style.left = (dragState.origLeft + e.clientX - dragState.startX) + 'px';
        dragState.el.style.top = (dragState.origTop + e.clientY - dragState.startY) + 'px';
    }

    function onTouchMove(e) {
        if (!dragState) return;
        e.preventDefault();
        var touch = e.touches[0];
        dragState.el.style.left = (dragState.origLeft + touch.clientX - dragState.startX) + 'px';
        dragState.el.style.top = (dragState.origTop + touch.clientY - dragState.startY) + 'px';
    }

    function onDragEnd() {
        if (!dragState) return;
        dragState.el.classList.remove('wc-dragging');
        var word = state.words.find(function(w) { return w.id === dragState.wordId; });
        if (word) {
            word.x = parseInt(dragState.el.style.left, 10);
            word.y = parseInt(dragState.el.style.top, 10);
        }
        if (dragState.isTouch) {
            document.removeEventListener('touchmove', onTouchMove);
            document.removeEventListener('touchend', onTouchEnd);
        }
        dragState = null;
    }

    function onTouchEnd() { onDragEnd(); }

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

    function exportPDF() {
        var cloudArea = document.getElementById('wc-cloud-area');
        if (!cloudArea || state.words.length === 0) return;
        var rect = cloudArea.getBoundingClientRect();
        var scale = 2;
        var cvs = document.createElement('canvas');
        cvs.width = rect.width * scale;
        cvs.height = rect.height * scale;
        var cctx = cvs.getContext('2d');
        cctx.scale(scale, scale);
        cctx.fillStyle = '#ffffff';
        cctx.fillRect(0, 0, rect.width, rect.height);
        if (state.theme) {
            var themeEl = cloudArea.querySelector('.wc-theme-label');
            if (themeEl) {
                var cs = getComputedStyle(themeEl);
                cctx.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
                cctx.fillStyle = cs.color;
                cctx.textAlign = 'center';
                cctx.textBaseline = 'middle';
                cctx.fillText(state.theme, rect.width / 2, rect.height / 2);
            }
        }
        state.words.forEach(function(word) {
            var el = cloudArea.querySelector('[data-id="' + word.id + '"]');
            if (!el) return;
            cctx.save();
            cctx.translate(word.x + el.offsetWidth / 2, word.y + el.offsetHeight / 2);
            cctx.rotate(word.rotation * Math.PI / 180);
            cctx.font = 'bold ' + word.fontSize + 'px Arial, sans-serif';
            cctx.fillStyle = word.color;
            cctx.textAlign = 'center';
            cctx.textBaseline = 'middle';
            cctx.fillText(word.text, 0, 0);
            cctx.restore();
        });
        var jpegUrl = cvs.toDataURL('image/jpeg', 0.95);
        var raw = atob(jpegUrl.split(',')[1]);
        var jpegLen = raw.length;
        var jpegBytes = new Uint8Array(jpegLen);
        for (var i = 0; i < jpegLen; i++) jpegBytes[i] = raw.charCodeAt(i);
        var imgW = cvs.width, imgH = cvs.height;
        var pageW = 841.89, pageH = 595.28, margin = 30;
        var maxW = pageW - 2 * margin, maxH = pageH - 2 * margin;
        var ratio = imgW / imgH;
        var dW, dH;
        if (maxW / maxH > ratio) { dH = maxH; dW = dH * ratio; }
        else { dW = maxW; dH = dW / ratio; }
        var dX = margin + (maxW - dW) / 2;
        var dY = margin + (maxH - dH) / 2;
        var contentStream = 'q ' + dW.toFixed(2) + ' 0 0 ' + dH.toFixed(2) + ' ' + dX.toFixed(2) + ' ' + dY.toFixed(2) + ' cm /Img Do Q';
        var parts = [];
        var offsets = {};
        var bytePos = 0;
        function addText(s) {
            var bytes = new Uint8Array(s.length);
            for (var j = 0; j < s.length; j++) bytes[j] = s.charCodeAt(j);
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
        for (var n = 1; n <= 5; n++) {
            var off = String(offsets[n]);
            while (off.length < 10) off = '0' + off;
            addText(off + ' 00000 n \n');
        }
        addText('trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xrefPos + '\n%%EOF');
        var totalLen = 0;
        for (var p = 0; p < parts.length; p++) totalLen += parts[p].length;
        var result = new Uint8Array(totalLen);
        var pos = 0;
        for (var q = 0; q < parts.length; q++) {
            result.set(parts[q], pos);
            pos += parts[q].length;
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

