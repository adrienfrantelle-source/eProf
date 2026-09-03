(function (global) {
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
        if (name === 'custom') {
            chrome = toHex(darken(base, sombre ? 0.55 : 0.42));
        }
        var bg = sombre ? toHex(mix(darken(base, 0.78), { r: 15, g: 23, b: 42 }, 0.45)) : (LIGHT[key] && LIGHT[key].bg) || toHex(lighten(base, 0.82));
        if (name === 'custom' && !sombre) bg = toHex(lighten(base, 0.84));
        var surface = sombre ? '#0f172a' : '#ffffff';
        var surfaceAlt = sombre ? '#1e293b' : toHex(lighten(base, 0.9));
        return {
            accent: accent,
            accentDark: accentDark,
            accentLight: accentLight,
            rgb: base.r + ', ' + base.g + ', ' + base.b,
            chrome: chrome,
            bg: bg,
            surface: surface,
            surfaceAlt: surfaceAlt
        };
    }

    var VAR_KEYS = [
        '--eprof-accent', '--eprof-accent-dark', '--eprof-accent-light', '--eprof-accent-rgb',
        '--eprof-chrome', '--eprof-bg', '--eprof-surface', '--eprof-surface-alt', '--eprof-surface-hover'
    ];

    function clearInlineVars(el) {
        if (!el || !el.style) return;
        VAR_KEYS.forEach(function (k) { el.style.removeProperty(k); });
    }

    function writeVars(palette) {
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
        if (document.body) {
            document.body.style.setProperty('--eprof-accent', palette.accent);
            document.body.style.setProperty('--eprof-chrome', palette.chrome);
            document.body.style.setProperty('--eprof-bg', palette.bg);
        }
    }

    function syncColorClasses(name) {
        var classes = ['theme-ocean', 'theme-foret', 'theme-crepuscule', 'theme-rose', 'theme-ambre', 'theme-custom'];
        [document.documentElement, document.body].forEach(function (el) {
            if (!el) return;
            classes.forEach(function (c) { el.classList.remove(c); });
            if (name && name !== 'defaut') el.classList.add('theme-' + name);
        });
    }

    function apply(couleurTheme, couleurAccent, sombre) {
        var name = couleurTheme || 'defaut';
        if (name !== 'custom' && !LIGHT[name]) name = 'defaut';
        syncColorClasses(name);
        writeVars(buildPalette(name, couleurAccent, !!sombre));
        if (document.body) document.body.dataset.eprofColorTheme = name;
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
        apply(affichage.couleurTheme || 'defaut', affichage.couleurAccent || '', sombre);
        var densite = affichage.densite || 'normal';
        [document.documentElement, document.body].forEach(function (el) {
            if (!el) return;
            el.classList.remove('densite-compact', 'densite-confortable');
            if (densite === 'compact') el.classList.add('densite-compact');
            if (densite === 'confortable') el.classList.add('densite-confortable');
        });
    }

    global.EprofTheme = {
        apply: apply,
        applyFromStorage: applyFromStorage,
        clearInlineVars: clearInlineVars
    };

    try { applyFromStorage(); } catch (e) {}
    document.addEventListener('DOMContentLoaded', function () {
        try { applyFromStorage(); } catch (e) {}
    });
})(window);
