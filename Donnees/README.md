# 📁 Dossier Donnees - Organisation

Ce dossier contient vos sauvegardes de données eProf.

## 📄 Fichiers

### sauvegarde-auto.json
**Créé automatiquement** quand vous activez le mode ⚡ Auto

- Contient TOUTES vos données (notes, suivi, calendrier, etc.)
- Mis à jour automatiquement 3 secondes après chaque modification
- Format JSON lisible avec n'importe quel éditeur de texte

**⚠️ NE PAS SUPPRIMER** si vous utilisez le mode automatique !

### _EXEMPLE_sauvegarde-auto.json
Fichier d'exemple montrant la structure des données.
Vous pouvez le supprimer sans problème.

## 📂 Sous-dossiers (anciens, optionnels)

### Notes/
Ancien système de sauvegarde CSV (version 1.0)
- `_EXEMPLE_evaluations.csv`
- `_EXEMPLE_notes.csv`

### SuiviEleves/
Ancien système de sauvegarde CSV (version 1.0)
- `_EXEMPLE_suivi-eleves.csv`

**Ces dossiers peuvent être supprimés** si vous utilisez le nouveau système automatique (version 3.0).

## 🔄 Migration

**Vous aviez l'ancien système CSV ?**

Pas de problème ! Pour migrer vers le nouveau système :

1. Ouvrez index.html
2. Si vous avez des données dans localStorage, elles seront automatiquement utilisées
3. Activez le mode ⚡ Auto
4. Toutes vos données seront sauvegardées dans `sauvegarde-auto.json`
5. Vous pouvez ensuite supprimer les anciens fichiers CSV

## 💡 Conseils

### Sauvegarde de sécurité
Même avec le mode automatique, faites des copies de `sauvegarde-auto.json` :
- Une fois par semaine, copiez-le dans un autre dossier
- Ou placez tout le dossier eProf sur OneDrive

### Restauration rapide
Pour restaurer vos données :
1. Remplacez `sauvegarde-auto.json` par votre backup
2. Rechargez la page
3. Ou utilisez le bouton 📂 Restaurer

### Transfert vers un autre PC
1. Copiez tout le dossier eProf (avec Donnees/)
2. Le fichier `sauvegarde-auto.json` sera automatiquement lu
3. Vos données sont immédiatement disponibles !

## 🛡️ Sécurité

- Le fichier est en JSON non crypté (lisible)
- Gardez ce dossier privé (ne le partagez pas publiquement)
- Faites des sauvegardes régulières
- Si vous partagez eProf avec quelqu'un, supprimez d'abord `sauvegarde-auto.json`

---

**Version :** 3.0 (Automatique)
**Date :** Janvier 2026
