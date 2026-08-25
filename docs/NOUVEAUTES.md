# Nouvelles fonctionnalités eProf

## ❓ Générateur de Quiz - Version manuelle

### Description
Créez des quiz interactifs personnalisés en saisissant manuellement vos questions une par une. Contrôle total sur le contenu, partage facile via QR code et lien de partage.

### Utilisation

#### Création d'un nouveau quiz
1. Ouvrez le module **Générateur de Quiz** depuis le dashboard
2. Cliquez sur **🚀 Créer un nouveau quiz**
3. Le générateur s'ouvre dans un nouvel onglet

#### Étape 1 : Informations générales
Remplissez les champs :
- **Titre** : Nom du quiz (ex: "Révisions Seconde Guerre Mondiale")
- **Matière** : Discipline concernée
- **Classe** : Sélectionnez dans la liste (listes d'élèves)
- **Durée** : Temps estimé en minutes
- **Description** : Notes optionnelles

#### Étape 2 : Création des questions
1. Cliquez sur **➕ Ajouter une question**
2. Saisissez le texte de la question
3. Choisissez le type de question :

**📊 QCM (Choix multiple)**
- 4 réponses par défaut (modifiable de 2 à 6)
- Bouton **➕** pour ajouter des options
- Bouton **✕** pour supprimer une option
- Cochez la radio button de la bonne réponse

**✅ Vrai / Faux**
- Exactement 2 options (Vrai/Faux)
- Cochez la bonne réponse

**✍️ Réponse courte (texte libre)**
- Saisissez la réponse attendue (référence pour correction)
- L'élève saisira sa réponse librement

4. Définissez le nombre de **points** pour la question
5. Répétez pour toutes vos questions
6. Utilisez le bouton **🗑️** pour supprimer une question

#### Étape 3 : Prévisualisation et sauvegarde
1. Cliquez sur **Valider et prévisualiser**
2. Vérifiez toutes les questions
3. Les bonnes réponses sont affichées en **vert**
4. Actions disponibles :
   - **💾 Enregistrer le quiz** : Sauvegarde dans localStorage
   - **🔗 Générer un lien de partage** : Crée un lien + QR code pour les élèves
   - **📄 Exporter en PDF** : Version imprimable avec toutes les questions et réponses
   - **🔄 Nouveau quiz** : Recommencer (demande confirmation)

### Gestion des quiz créés
Dans le module principal, tous vos quiz sont listés avec :
- Titre, matière, classe, durée
- Nombre de questions
- Date de création

**Actions disponibles :**
- **👁️ Voir** : Affiche le quiz complet
- **📋 Dupliquer** : Crée une copie modifiable
- **🗑️ Supprimer** : Suppression définitive (avec confirmation)

### Sauvegarde et portabilité
- **💾 Sauvegarder la liste** : Exporte tous vos quiz dans un fichier `.js`
- **📂 Restaurer la liste** : Importe des quiz depuis un fichier `.js`
- Format JSON dans localStorage (clé : `QUIZ_DATA`)

### Partage avec les élèves
1. Après création, cliquez sur **🔗 Générer un lien de partage**
2. Une modale s'affiche avec :
   - Lien de partage complet (copiable)
   - QR code généré automatiquement (200x200px)
3. Les élèves scannent le QR code ou cliquent sur le lien
4. Le quiz s'ouvre dans `quiz-eleve.html`
5. Les réponses sont enregistrées et consultables dans `quiz-resultats.js`

### Types de questions

| Type | Icône | Description | Réponses | Utilisation |
|------|-------|-------------|----------|-------------|
| **QCM** | 📊 | Choix multiple | 2 à 6 options | Connaissances factuelles, concepts |
| **Vrai/Faux** | ✅ | Question binaire | Exactement 2 | Révisions rapides, validation |
| **Texte** | ✍️ | Réponse libre | Réponse attendue en référence | Définitions, calculs, expressions |

### Exemples d'utilisation

**Quiz d'Histoire (QCM)**
- Titre : "La Révolution française"
- 10 questions QCM, 4 réponses chacune
- 1 point par question
- Durée : 15 minutes

**Quiz de Mathématiques (mixte)**
- Titre : "Fractions et calculs"
- 5 questions texte (calculs) - 2 points
- 5 questions QCM (concepts) - 1 point
- Durée : 20 minutes

**Quiz de SVT (Vrai/Faux)**
- Titre : "La photosynthèse - Révisions rapides"
- 15 questions Vrai/Faux
- 1 point par question
- Durée : 10 minutes

### Avantages de la version manuelle
- ✅ **Contrôle total** sur chaque question et réponse
- ✅ **Qualité garantie** - questions parfaitement adaptées à votre enseignement
- ✅ **Flexibilité** - 3 types de questions, points personnalisables
- ✅ **Simplicité** - pas de dépendance à des services externes ou IA
- ✅ **Portabilité** - fonctionne 100% hors ligne
- ✅ **Partage facile** - lien + QR code pour accès instantané
- ✅ **Pas de limite** - créez autant de questions que nécessaire

### Conseils pédagogiques
- **Variez les types** : mélangez QCM, V/F et texte pour maintenir l'attention
- **Progression** : commencez facile, augmentez la difficulté progressivement
- **Durée** : environ 1 minute par question simple, 2-3 min pour réflexion
- **Points** : questions faciles 1pt, moyennes 2-3pts, difficiles 4-5pts
- **Formulation** : questions courtes, claires, sans ambiguïté
- **Évitez** : double-négations, questions pièges, trop de détails techniques

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
