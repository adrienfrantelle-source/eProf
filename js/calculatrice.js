// ===== CALCULATRICE (standard + scientifique) =====
// Évaluateur maison : aucun eval() ni Function(), l'expression saisie n'est
// jamais exécutée comme du code.

let calcExpression = '';
let calcAngleUnit = 'deg';
let calcHistorique = [];

function calcDisplayEl() { return document.getElementById('calc-display'); }

function calcRefresh() {
    const display = calcDisplayEl();
    if (display) display.textContent = calcExpression || '0';
}

function calcAppend(token) {
    calcExpression += token;
    calcRefresh();
}

function calcFn(nom) {
    calcExpression += nom;
    calcRefresh();
}

function calcClear() {
    calcExpression = '';
    const expr = document.getElementById('calc-expression');
    if (expr) expr.textContent = '';
    calcRefresh();
}

function calcBackspace() {
    calcExpression = calcExpression.slice(0, -1);
    calcRefresh();
}

function calcSetAngle(unite) {
    calcAngleUnit = unite;
}

function calcToggleScientific() {
    const actif = document.getElementById('calc-scientific').checked;
    document.getElementById('calc-keys-scientific').style.display = actif ? 'grid' : 'none';
    document.getElementById('calc-angle-wrap').style.display = actif ? 'inline-block' : 'none';
}

function calcCompute() {
    try {
        const resultat = calcEvaluer(calcExpression);
        if (!isFinite(resultat)) throw new Error('Résultat indéfini');

        const arrondi = Math.round(resultat * 1e10) / 1e10;
        const expr = document.getElementById('calc-expression');
        if (expr) expr.textContent = calcExpression + ' =';

        calcHistorique.unshift(calcExpression + ' = ' + arrondi);
        calcHistorique = calcHistorique.slice(0, 8);
        const histo = document.getElementById('calc-history');
        if (histo) histo.innerHTML = calcHistorique.map(function (l) { return '<div>' + l + '</div>'; }).join('');

        calcExpression = String(arrondi);
        calcRefresh();
    } catch (e) {
        const display = calcDisplayEl();
        if (display) display.textContent = 'Erreur';
        calcExpression = '';
    }
}

// ----- Analyseur syntaxique -----
function calcEvaluer(source) {
    const texte = String(source || '').replace(/\s+/g, '').replace(/,/g, '.');
    if (!texte) throw new Error('Expression vide');

    let position = 0;

    function fin() { return position >= texte.length; }
    function courant() { return texte[position]; }
    function consommer(attendu) {
        if (texte[position] !== attendu) throw new Error('Attendu ' + attendu);
        position++;
    }

    function versRadians(x) { return calcAngleUnit === 'deg' ? x * Math.PI / 180 : x; }
    function depuisRadians(x) { return calcAngleUnit === 'deg' ? x * 180 / Math.PI : x; }

    const FONCTIONS = {
        sin: function (x) { return Math.sin(versRadians(x)); },
        cos: function (x) { return Math.cos(versRadians(x)); },
        tan: function (x) { return Math.tan(versRadians(x)); },
        asin: function (x) { return depuisRadians(Math.asin(x)); },
        acos: function (x) { return depuisRadians(Math.acos(x)); },
        atan: function (x) { return depuisRadians(Math.atan(x)); },
        sqrt: Math.sqrt,
        ln: Math.log,
        log: Math.log10,
        exp: Math.exp,
        abs: Math.abs
    };

    function factorielle(n) {
        if (n < 0 || n !== Math.floor(n)) throw new Error('Factorielle invalide');
        if (n > 170) throw new Error('Trop grand');
        let resultat = 1;
        for (let i = 2; i <= n; i++) resultat *= i;
        return resultat;
    }

    // expression := terme (('+' | '-') terme)*
    function expression() {
        let valeur = terme();
        while (!fin() && (courant() === '+' || courant() === '-')) {
            const operateur = courant();
            position++;
            const droite = terme();
            valeur = operateur === '+' ? valeur + droite : valeur - droite;
        }
        return valeur;
    }

    // terme := puissance (('*' | '/' | '%') puissance)*
    function terme() {
        let valeur = puissance();
        while (!fin() && (courant() === '*' || courant() === '/' || courant() === '%')) {
            const operateur = courant();
            position++;
            const droite = puissance();
            if (operateur === '*') valeur *= droite;
            else if (operateur === '/') {
                if (droite === 0) throw new Error('Division par zéro');
                valeur /= droite;
            } else valeur = valeur % droite;
        }
        return valeur;
    }

    // puissance := unaire ('^' puissance)?  (associative à droite)
    function puissance() {
        const base = unaire();
        if (!fin() && courant() === '^') {
            position++;
            return Math.pow(base, puissance());
        }
        return base;
    }

    function unaire() {
        if (!fin() && courant() === '-') {
            position++;
            return -unaire();
        }
        if (!fin() && courant() === '+') {
            position++;
            return unaire();
        }
        return postfixe();
    }

    function postfixe() {
        let valeur = primaire();
        while (!fin() && courant() === '!') {
            position++;
            valeur = factorielle(valeur);
        }
        return valeur;
    }

    function primaire() {
        if (fin()) throw new Error('Expression incomplète');

        if (courant() === '(') {
            position++;
            const valeur = expression();
            consommer(')');
            return valeur;
        }

        const nombre = /^\d+(\.\d+)?/.exec(texte.slice(position));
        if (nombre) {
            position += nombre[0].length;
            return parseFloat(nombre[0]);
        }

        const identifiant = /^[a-z]+/.exec(texte.slice(position));
        if (identifiant) {
            const nom = identifiant[0];
            position += nom.length;

            if (nom === 'pi') return Math.PI;
            if (nom === 'e') return Math.E;

            if (nom === 'mod') {
                consommer('(');
                const a = expression();
                consommer(',');
                const b = expression();
                consommer(')');
                if (b === 0) throw new Error('Division par zéro');
                return a % b;
            }

            if (FONCTIONS[nom]) {
                consommer('(');
                const argument = expression();
                consommer(')');
                return FONCTIONS[nom](argument);
            }

            throw new Error('Fonction inconnue : ' + nom);
        }

        throw new Error('Caractère inattendu : ' + courant());
    }

    const resultat = expression();
    if (!fin()) throw new Error('Expression invalide');
    return resultat;
}

// Saisie au clavier quand la calculatrice est ouverte
document.addEventListener('keydown', function (e) {
    const panneau = document.getElementById('calculator-panel');
    if (!panneau || panneau.style.display === 'none') return;
    if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

    if (/^[0-9+\-*/().^%!]$/.test(e.key)) {
        calcAppend(e.key);
        e.preventDefault();
    } else if (e.key === 'Enter' || e.key === '=') {
        calcCompute();
        e.preventDefault();
    } else if (e.key === 'Backspace') {
        calcBackspace();
        e.preventDefault();
    } else if (e.key === 'Escape') {
        calcClear();
        e.preventDefault();
    } else if (e.key === ',') {
        calcAppend('.');
        e.preventDefault();
    }
});
