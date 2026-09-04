# Nouvelles fonctionnalités eProf

## V2.5.19 — Fiche élève, recherche, calendrier → classe, modules retirés

### Fiche élève
L’ouverture d’un élève affiche d’abord l’onglet **Synthèse** : compteurs (oublis à traiter, mots à mettre, notes, moyenne), 3 derniers faits, boutons **Fiche courte (1 page)** et **Fiche complète**.

### Recherche élève
Champ en en-tête (raccourci `/`) : recherche dans toutes les classes enseignées. Un clic ouvre la fiche. Dans le suivi, un filtre affine la grille de la classe.

### Calendrier → classe
Le détail d’un cours avec une classe propose **Suivi** et, s’il existe un plan lié, **Plan de classe**.

### Modules retirés
Le générateur de quiz, les pages quiz élève / résultats, les séjours et le conseil de classe ne sont plus dans l’application. Le carnet de notes, la messagerie, les archives et les jeux pédagogiques restent. Pas de module d’appel.

---

## V2.5.18 — Quotidien prof, photos d’identité, modules extraits, RGPD

### Liaison plan de classe par nom
Le plan se lie à une **classe enseignée** (nom, sans tenir compte des accents ni de la casse). Un champ **titre du plan** remplace les invites à chaque enregistrement. Le suivi propose toujours le plan le plus récent pour cette classe.

### Homonymes (import PDF)
Si deux élèves ont le même nom et prénom, l’aperçu admin n’associe plus automatiquement la photo. Un bandeau orange demande un choix manuel. Deux photos qui pointent vers le même élève sont signalées.

### Photos partout et trombinoscope
Les portraits apparaissent dans le **suivi** (cartes et fiche), le **plan de classe** (liste des élèves) et le **trombinoscope**. Un clic sur une carte du trombi ouvre la fiche suivi. Une **recherche** filtre la grille. **Imprimer** n’affiche que le trombinoscope.

### Photos qui suivent l’élève
Le fichier n’est plus rangé par dossier de classe : `{année}/{Nom}_{Prenom}.jpg`. Un registre d’identité restaure `photo_path` après un import CSV (changement de classe). Les homonymes de la même année gardent un suffixe d’identifiant. Migration : `0028_photos_identite_rgpd.sql`.

### Cours 55 min / 1 h 50
Sous les horaires d’un **Cours**, deux boutons : 55 minutes (défaut) et 1 h 50 (double séance). Modifier la fin à la main conserve la durée saisie.

### Thème
Les bleus, verts et rouges « en dur » du fichier de style principal passent par les variables du thème (`--eprof-accent`, `--eprof-success`, `--eprof-danger`…).

### Modules extraits
Plan de classe, suivi des élèves et trombinoscopes ne vivent plus dans `app.js` (`js/plan-classe.js`, `js/suivi-eleves.js`, `js/trombinoscopes.js`, helpers `js/eleves-shared.js`).

### RGPD photos
Un consentement « photo / trombi » **retiré** masque le portrait (sans ligne, la photo reste visible). Les enseignants peuvent **lire** les consentements. La purge de rétention peut supprimer les fichiers du bucket `student-photos`.

---

## V2.5.17 — Calendrier, plans de classe et trombinoscopes

### Cours de 55 minutes (calendrier et agenda)
Lors de la création d’un événement de nature **Cours**, l’heure de fin se cale automatiquement 55 minutes après l’heure de début. Elle se réajuste si le début change. Dès que l’enseignant saisit la fin à la main, eProf ne force plus cette durée. Un cours déjà enregistré avec une autre durée (ex. 90 min) reste tel quel à la réouverture.

### Lien plan de classe ↔ suivi des élèves
En haut du **plan de classe**, une liste permet de lier le plan à une classe enseignée. Le lien est enregistré (local et, si l’enseignant sauvegarde en ligne, dans le JSON du plan). Charger une liste d’élèves sélectionne automatiquement cette classe. Dans le **suivi des élèves**, un bouton **Plan de classe** ouvre le plan le plus récent lié à la classe ; s’il y en a plusieurs, un menu permet d’en choisir un autre.

### Photos de trombinoscope
Les trombinoscopes affichent les portraits lorsqu’ils sont disponibles (fichiers locaux ou photos importées en ligne). Sans photo, une pastille reste affichée.

**Année 2026-2027 — Tle SAPAT A (23) et Tle SAPAT B (25)** : portraits extraits des PDF Pronote (photo au-dessus du nom).

**Administrateur** : dans Admin → Élèves, **Importer un trombinoscope (PDF)**. Le fichier Pronote est lu dans le navigateur ; un aperçu permet de corriger le nom ou l’élève associé. Les photos sont enregistrées dans le bucket Storage `student-photos` et liées à `school_students.photo_path`. Aucune fiche élève n’est créée : la liste CSV reste la source officielle. Migration : `0027_student_photos.sql`.

---

## Archive — Générateur de Quiz (module retiré en V2.5.19)

Le générateur de quiz et les pages associées ne font plus partie d’eProf. L’ancien guide est conservé dans `docs/GUIDE_QUIZ_COPILOT.txt` à titre d’archive uniquement.

---

## 📋 Liste d'émargement (Suivi des élèves)

### Description
Génération automatique de listes d'émargement personnalisables au format Excel ou PDF pour faciliter le suivi de présence ou le suivi d'activités.

### Utilisation
1. Ouvrez le module **Suivi des élèves**
2. Sélectionnez une classe
3. Cliquez sur le bouton **📋 Générer une liste d'émargement**
4. Dans la fenêtre qui s'ouvre :
   - Saisissez l'intitulé de la première colonne (ex: "Présence")
   - Cliquez sur **➕ Ajouter une colonne** pour ajouter d'autres colonnes (ex: "Matin", "Après-midi", ou "TP1", "TP2", "TP3"...)
   - Vous pouvez supprimer les colonnes superflues avec le bouton 🗑️ (minimum 1 colonne)
   - Choisissez le format d'export : **Excel** ou **PDF**
5. Cliquez sur **Générer et télécharger**

### Exemples de colonnes multiples
- **Présence sur plusieurs jours** : "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"
- **Suivi TP/Ateliers** : "TP1", "TP2", "TP3", "TP4"
- **Rendu de dossiers** : "Brouillon", "Version finale", "Annexes"
- **Présence matin/après-midi** : "Matin", "Après-midi"

### Formats disponibles

#### Excel (.xlsx)
- Tableau avec colonnes : Élève | [Colonnes personnalisées]
- Support de plusieurs colonnes d'émargement
- Liste alphabétique des élèves
- Colonnes auto-dimensionnées
- Format modifiable pour ajouts manuels

#### PDF
- Document formaté avec en-tête (classe + date)
- Tableau numéroté : N° | Élève | [Colonnes personnalisées]
- Adaptation automatique de la largeur des colonnes
- Multi-pages automatique si classe nombreuse
- Format imprimable

---

## ❌ Gestion des absents (Tableau blanc)

### Description
Marquage des élèves absents lors des tirages au sort et de la création de groupes aléatoires.

### Utilisation

#### Tirage au sort d'élèves
1. Ouvrez le **Tableau blanc**
2. Sélectionnez l'outil **Tirage au sort**
3. Choisissez une classe
4. Dépliez l'accordéon **❌ Marquer des absents**
5. Cochez les élèves absents
6. Les élèves cochés seront **exclus** du tirage au sort

#### Création de groupes aléatoires
1. Ouvrez le **Tableau blanc**
2. Sélectionnez l'outil **Tirage au sort**
3. Allez dans l'onglet **Groupes**
4. Choisissez une classe
5. Dépliez l'accordéon **❌ Marquer des absents (seront mis entre parenthèses)**
6. Cochez les élèves absents
7. Configurez le nombre de groupes ou d'élèves par groupe
8. Cliquez sur **Créer les groupes**

**Résultat** : 
- Les élèves présents sont répartis équitablement dans les groupes
- Les élèves absents sont ajoutés **en priorité dans les groupes les plus petits** pour équilibrer
- Garantie d'équilibrage : maximum 2 élèves de différence entre les groupes
- Style visuel différencié (texte grisé, italique) pour identifier les absents
- Permet de maintenir la composition des groupes pour une reprise ultérieure du travail

### Avantages
- **Tirage équitable** : seuls les élèves présents participent au tirage
- **Équilibrage automatique** : les absents sont placés stratégiquement pour équilibrer les groupes
- **Continuité pédagogique** : les groupes conservent leurs membres absents pour la suite
- **Visibilité** : identification immédiate des absents dans les groupes (parenthèses + style)

---

## 📊 Technologies utilisées

- **Export Excel** : SheetJS (XLSX.js) - déjà intégré
- **Export PDF** : jsPDF - déjà intégré
- **Interface** : HTML5, CSS3, JavaScript vanilla
- **Stockage** : localStorage + système d'import/export JSON

---

## 📝 Notes techniques

### Gestion des absents
- Stockage temporaire (pas de sauvegarde persistante)
- Basé sur les cases à cocher, réinitialisé à chaque sélection de classe
- Filtrage côté client pour performance optimale

### Listes d'émargement
- Utilise la structure `LISTES_ELEVES` existante
- Tri alphabétique automatique par nom de famille
- Format de nom : "Prénom NOM" (majuscules pour le nom de famille)
- Noms de fichiers : `Emargement_[Classe]_[Date].xlsx|pdf`
- Date au format ISO (YYYY-MM-DD) dans le nom de fichier
- Date française (JJ/MM/AAAA) dans le contenu PDF

---

## 🎯 Cas d'usage

### Liste d'émargement
- ✅ Feuille de présence quotidienne ou hebdomadaire (plusieurs jours)
- ✅ Suivi de rendu de dossiers en plusieurs étapes
- ✅ Signature de documents multiples
- ✅ Contrôle de matériel sur plusieurs séances
- ✅ Validation d'ateliers/TP successifs
- ✅ Émargement matin/après-midi
- ✅ Tout suivi nécessitant plusieurs validations

### Gestion des absents
- ✅ Interrogations orales équitables
- ✅ Tirages au sort pour présentations
- ✅ Création de groupes de TP/TD équilibrés
- ✅ Groupes de projets avec continuité et équilibrage automatique
- ✅ Ateliers en rotation avec effectifs équilibrés
- ✅ Travaux collaboratifs sur plusieurs séances
