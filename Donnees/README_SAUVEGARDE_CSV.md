# 📁 Guide d'utilisation du système de sauvegarde CSV

## 🔍 Problème résolu

Auparavant, les données (notes, suivi des élèves) étaient sauvegardées dans le **localStorage** du navigateur. 
Ce système posait problème car :
- ❌ Les données ne se transfèrent pas d'un ordinateur à l'autre
- ❌ Les données sont perdues si on change de navigateur
- ❌ Aucune sauvegarde portable n'était possible

## ✅ Solution mise en place

Un système de sauvegarde en **fichiers CSV** a été créé. Les données sont maintenant :
- ✓ Exportables en fichiers CSV
- ✓ Importables depuis n'importe quel ordinateur
- ✓ Sauvegardées automatiquement à chaque modification
- ✓ Facilement consultables avec Excel ou LibreOffice

## 📂 Organisation des fichiers

```
eProf/
├── Donnees/
│   ├── Notes/
│   │   ├── evaluations.csv     (Liste de toutes les évaluations)
│   │   └── notes.csv            (Toutes les notes des élèves)
│   └── SuiviEleves/
│       └── suivi-eleves.csv     (Observations, incidents, etc.)
```

## 🎯 Comment utiliser le système

### 1️⃣ Exporter les données (sur l'ordinateur actuel)

**Dans le Carnet de notes :**
1. Ouvrez [carnet-notes.html](carnet-notes.html)
2. Cliquez sur le bouton **💾 Exporter** en haut à droite
3. Les fichiers `evaluations.csv` et `notes.csv` seront téléchargés

**Dans le Suivi des élèves :**
1. Ouvrez l'application principale [index.html](index.html)
2. Allez dans **👨‍🎓 Suivi des élèves**
3. Cliquez sur le bouton **💾 Exporter** en haut à droite
4. Le fichier `suivi-eleves.csv` sera téléchargé

### 2️⃣ Transférer les données vers un autre ordinateur

1. **Copiez tout le dossier eProf** sur une clé USB ou OneDrive
2. Les fichiers CSV téléchargés doivent être placés dans les bons dossiers :
   - `evaluations.csv` et `notes.csv` → `Donnees/Notes/`
   - `suivi-eleves.csv` → `Donnees/SuiviEleves/`

### 3️⃣ Importer les données (sur le nouvel ordinateur)

**Dans le Carnet de notes :**
1. Ouvrez [carnet-notes.html](carnet-notes.html)
2. Cliquez sur le bouton **📂 Importer**
3. Sélectionnez le fichier `evaluations.csv` quand demandé
4. Puis sélectionnez le fichier `notes.csv` quand demandé
5. ✓ Les données sont chargées !

**Dans le Suivi des élèves :**
1. Ouvrez [index.html](index.html)
2. Allez dans **👨‍🎓 Suivi des élèves**
3. Cliquez sur le bouton **📂 Importer**
4. Sélectionnez le fichier `suivi-eleves.csv`
5. ✓ Les données sont chargées !

## ⚠️ Important

### Sauvegarde automatique
À chaque fois que vous modifiez des données (ajout de note, nouvelle évaluation, etc.), le système :
1. ✅ Sauvegarde dans le localStorage (pour usage immédiat)
2. ✅ Propose le téléchargement du fichier CSV (pour portabilité)

### Recommandations
- 💾 **Exportez régulièrement** vos données (au moins une fois par semaine)
- 📁 **Conservez vos CSV** dans le dossier `Donnees/` approprié
- ☁️ **Sauvegardez** votre dossier eProf complet sur OneDrive ou une clé USB
- 🔄 **Importez** les données au début de chaque session sur un nouvel ordinateur

## 📊 Format des fichiers CSV

### evaluations.csv
```csv
Classe,ID,Nom,Date,Coefficient,Type,Periode,Competences
"2nde SAPAT AB1","eval-123","Contrôle Histoire","2026-01-15","1","DS","trimestre2","Analyser|Argumenter"
```

### notes.csv
```csv
Classe,Eleve,EvaluationID,Note,Appreciation
"2nde SAPAT AB1","DUPONT Jean","eval-123","15","Bon travail"
```

### suivi-eleves.csv
```csv
Classe,Eleve,Date,Type,Contenu,Statut
"2nde SAPAT AB1","MARTIN Sophie","2026-01-09","Incident","Retard de 10 minutes","Résolu"
```

## 🆘 Dépannage

**Problème : Les données ne se chargent pas**
- Vérifiez que les fichiers CSV sont dans le bon dossier
- Vérifiez que les noms de fichiers sont corrects (sensible à la casse)
- Essayez d'exporter puis réimporter pour tester le système

**Problème : Fichiers CSV corrompus**
- Ouvrez le fichier avec Excel ou un éditeur de texte
- Vérifiez que la structure correspond au format ci-dessus
- Assurez-vous que les guillemets et virgules sont corrects

**Problème : Données manquantes après import**
- Vérifiez que vous avez importé TOUS les fichiers nécessaires
- Le carnet de notes nécessite evaluations.csv ET notes.csv

## 📝 Note technique

Le système utilise toujours le localStorage en interne pour les performances, mais génère également des CSV pour la portabilité. Cela vous permet de :
- Travailler normalement sans vous soucier de la sauvegarde
- Exporter quand vous le souhaitez pour transférer vos données
- Consulter vos données dans Excel/LibreOffice si besoin
