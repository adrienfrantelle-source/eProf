(function (global) {
    var FOND_KEY = 'eprof-fond-perso';
    var AMBIANCE_CLASSES = ['ambiance-none', 'ambiance-eprof', 'ambiance-lycee', 'ambiance-chlorofil', 'ambiance-points', 'ambiance-losanges', 'ambiance-vagues', 'ambiance-custom'];
    var CHROME_CLASSES = ['chrome-uni', 'chrome-degrade', 'chrome-texture'];
    var COLOR_CLASSES = ['theme-ocean', 'theme-foret', 'theme-crepuscule', 'theme-rose', 'theme-ambre', 'theme-custom'];

    function padHex(n) {
        return Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
    }

    function parseHex(hex) {
        var h = String(hex || '').replace('#', '').trim();
        if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        if (h.length !== 6) return null;
        var r = parseInt(h.slice(0, 2), 16);
        var g = parseInt(h.slice(2, 4), 16);
        var b = parseInt(h.slice(4, 6), 16);
        if ([r, g, b].some(function (n) { return Number.isNaN(n); })) return null;
        return { r: r, g: g, b: b };
    }

    function mix(c, t, amount) {
        return {
            r: Math.round(c.r + (t.r - c.r) * amount),
            g: Math.round(c.g + (t.g - c.g) * amount),
            b: Math.round(c.b + (t.b - c.b) * amount)
        };
    }

    function toHex(c) {
        return '#' + padHex(c.r) + padHex(c.g) + padHex(c.b);
    }

    function darken(c, amount) {
        return mix(c, { r: 0, g: 0, b: 0 }, amount);
    }

    function lighten(c, amount) {
        return mix(c, { r: 255, g: 255, b: 255 }, amount);
    }

    var LIGHT = {
        defaut: { accent: '#2563eb', chrome: '#1e3a8a', bg: '#e0e7ff' },
        ocean: { accent: '#0891b2', chrome: '#155e75', bg: '#bae6fd' },
        foret: { accent: '#16a34a', chrome: '#166534', bg: '#bbf7d0' },
        crepuscule: { accent: '#7c3aed', chrome: '#5b21b6', bg: '#ddd6fe' },
        rose: { accent: '#e11d48', chrome: '#9f1239', bg: '#fecdd3' },
        ambre: { accent: '#d97706', chrome: '#92400e', bg: '#fde68a' }
    };

    var DARK_CHROME = {
        defaut: '#0f172a',
        ocean: '#164e63',
        foret: '#14532d',
        crepuscule: '#4c1d95',
        rose: '#881337',
        ambre: '#78350f'
    };

    var OPACITY = { faible: 0.05, moyen: 0.1, fort: 0.18 };

    function buildPalette(name, customHex, sombre) {
        var key = name === 'custom' ? 'custom' : (LIGHT[name] ? name : 'defaut');
        var base = parseHex(name === 'custom' ? customHex : LIGHT[key].accent);
        if (!base) base = parseHex(LIGHT.defaut.accent);
        var accent = toHex(base);
        var accentDark = toHex(darken(base, 0.22));
        var accentLight = toHex(lighten(base, sombre ? 0.15 : 0.82));
        var chrome = sombre
            ? (DARK_CHROME[key] || toHex(darken(base, 0.55)))
            : (LIGHT[key] && LIGHT[key].chrome) || toHex(darken(base, 0.45));
        if (name === 'custom') chrome = toHex(darken(base, sombre ? 0.55 : 0.42));
        var bg = sombre
            ? toHex(mix(darken(base, 0.78), { r: 15, g: 23, b: 42 }, 0.45))
            : (LIGHT[key] && LIGHT[key].bg) || toHex(lighten(base, 0.82));
        if (name === 'custom' && !sombre) bg = toHex(lighten(base, 0.84));
        return {
            accent: accent,
            accentDark: accentDark,
            accentLight: accentLight,
            rgb: base.r + ', ' + base.g + ', ' + base.b,
            chrome: chrome,
            bg: bg,
            surface: sombre ? '#0f172a' : '#ffffff',
            surfaceAlt: sombre ? '#1e293b' : toHex(lighten(base, 0.9))
        };
    }

    function wallpaperFor(ambiance, customUrl) {
        if (ambiance === 'eprof') {
            return { image: 'url("images/logo eProf.jpg")', size: 'min(48vw, 380px)', repeat: 'no-repeat', pos: 'center 38%' };
        }
        if (ambiance === 'lycee') {
            return { image: 'url("images/LOGO JD - Cholet blanc sans fond.png")', size: 'min(55vw, 440px)', repeat: 'no-repeat', pos: 'center 40%' };
        }
        if (ambiance === 'chlorofil') {
            return { image: 'url("images/logo-chlorofil.png")', size: '160px', repeat: 'repeat', pos: '0 0' };
        }
        if (ambiance === 'points') {
            return {
                image: 'radial-gradient(circle, rgba(15,23,42,0.22) 1.2px, transparent 1.4px)',
                size: '18px 18px',
                repeat: 'repeat',
                pos: '0 0'
            };
        }
        if (ambiance === 'losanges') {
            return {
                image: 'repeating-linear-gradient(135deg, rgba(15,23,42,0.08) 0 12px, transparent 12px 24px)',
                size: 'auto',
                repeat: 'repeat',
                pos: '0 0'
            };
        }
        if (ambiance === 'vagues') {
            return {
                image: 'repeating-linear-gradient(180deg, transparent 0 18px, rgba(8,145,178,0.12) 18px 20px)',
                size: 'auto',
                repeat: 'repeat',
                pos: '0 0'
            };
        }
        if (ambiance === 'custom' && customUrl) {
            return { image: 'url("' + customUrl + '")', size: 'cover', repeat: 'no-repeat', pos: 'center' };
        }
        return { image: 'none', size: 'auto', repeat: 'no-repeat', pos: 'center' };
    }

    function syncClasses(el, all, keep) {
        if (!el) return;
        all.forEach(function (c) { el.classList.remove(c); });
        if (keep) el.classList.add(keep);
    }

    function writeVars(palette, wallpaper, intensite, chromeStyle) {
        var root = document.documentElement;
        root.style.setProperty('--eprof-accent', palette.accent);
        root.style.setProperty('--eprof-accent-dark', palette.accentDark);
        root.style.setProperty('--eprof-accent-light', palette.accentLight);
        root.style.setProperty('--eprof-accent-rgb', palette.rgb);
        root.style.setProperty('--eprof-chrome', palette.chrome);
        root.style.setProperty('--eprof-bg', palette.bg);
        root.style.setProperty('--eprof-surface', palette.surface);
        root.style.setProperty('--eprof-surface-alt', palette.surfaceAlt);
        root.style.setProperty('--eprof-surface-hover', palette.surfaceAlt);
        root.style.setProperty('--eprof-wallpaper-image', wallpaper.image);
        root.style.setProperty('--eprof-wallpaper-size', wallpaper.size);
        root.style.setProperty('--eprof-wallpaper-repeat', wallpaper.repeat);
        root.style.setProperty('--eprof-wallpaper-pos', wallpaper.pos);
        root.style.setProperty('--eprof-wallpaper-opacity', String(OPACITY[intensite] || OPACITY.moyen));
        if (document.body) {
            document.body.style.setProperty('--eprof-accent', palette.accent);
            document.body.style.setProperty('--eprof-chrome', palette.chrome);
            document.body.style.setProperty('--eprof-bg', palette.bg);
        }
        var chromeImage = 'none';
        if (chromeStyle === 'degrade') {
            chromeImage = 'linear-gradient(90deg, ' + palette.chrome + ' 0%, ' + palette.accentDark + ' 100%)';
        } else if (chromeStyle === 'texture') {
            chromeImage = 'linear-gradient(180deg, rgba(0,0,0,0.12), rgba(0,0,0,0.28)), url("images/logo eProf.jpg")';
        }
        root.style.setProperty('--eprof-chrome-image', chromeImage);
    }

    function apply(couleurTheme, couleurAccent, sombre, extras) {
        extras = extras || {};
        var name = couleurTheme || 'defaut';
        if (name !== 'custom' && !LIGHT[name]) name = 'defaut';
        var ambiance = extras.ambiance || 'none';
        var intensite = extras.fondIntensite || 'moyen';
        var chromeStyle = extras.chromeStyle || 'uni';
        var customUrl = extras.fondPersoUrl || '';
        if (ambiance === 'custom' && !customUrl) ambiance = 'none';

        [document.documentElement, document.body].forEach(function (el) {
            syncClasses(el, COLOR_CLASSES, name !== 'defaut' ? 'theme-' + name : '');
            syncClasses(el, AMBIANCE_CLASSES, 'ambiance-' + ambiance);
            syncClasses(el, CHROME_CLASSES, 'chrome-' + chromeStyle);
        });
        writeVars(buildPalette(name, couleurAccent, !!sombre), wallpaperFor(ambiance, customUrl), intensite, chromeStyle);
        if (document.body) {
            document.body.dataset.eprofColorTheme = name;
            document.body.dataset.eprofAmbiance = ambiance;
        }
    }

    function readFondPerso() {
        try { return localStorage.getItem(FOND_KEY) || ''; } catch (e) { return ''; }
    }

    function saveFondPerso(dataUrl) {
        try {
            if (!dataUrl) localStorage.removeItem(FOND_KEY);
            else localStorage.setItem(FOND_KEY, dataUrl);
            return true;
        } catch (e) {
            return false;
        }
    }

    function applyFromStorage() {
        var affichage = {};
        try {
            affichage = (JSON.parse(localStorage.getItem('parametres') || '{}').affichage) || {};
        } catch (e) {}
        var sombre = affichage.theme === 'sombre';
        [document.documentElement, document.body].forEach(function (el) {
            if (el) el.classList.toggle('theme-sombre', sombre);
        });
        apply(affichage.couleurTheme || 'defaut', affichage.couleurAccent || '', sombre, {
            ambiance: affichage.ambiance || 'none',
            fondIntensite: affichage.fondIntensite || 'moyen',
            chromeStyle: affichage.chromeStyle || 'uni',
            fondPersoUrl: readFondPerso()
        });
        var densite = affichage.densite || 'normal';
        [document.documentElement, document.body].forEach(function (el) {
            if (!el) return;
            el.classList.remove('densite-compact', 'densite-confortable');
            if (densite === 'compact') el.classList.add('densite-compact');
            if (densite === 'confortable') el.classList.add('densite-confortable');
        });
    }

    function compressImageFile(file, maxW, quality) {
        return new Promise(function (resolve, reject) {
            var img = new Image();
            var url = URL.createObjectURL(file);
            img.onload = function () {
                var w = img.naturalWidth;
                var h = img.naturalHeight;
                var scale = Math.min(1, maxW / Math.max(w, h));
                var canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(w * scale));
                canvas.height = Math.max(1, Math.round(h * scale));
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                URL.revokeObjectURL(url);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = function () {
                URL.revokeObjectURL(url);
                reject(new Error('Image illisible'));
            };
            img.src = url;
        });
    }

    global.EprofTheme = {
        apply: apply,
        applyFromStorage: applyFromStorage,
        readFondPerso: readFondPerso,
        saveFondPerso: saveFondPerso,
        compressImageFile: compressImageFile
    };

    try { applyFromStorage(); } catch (e) {}
    document.addEventListener('DOMContentLoaded', function () {
        try { applyFromStorage(); } catch (e) {}
    });
})(window);
