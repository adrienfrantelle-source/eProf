# 💾 Guide de sauvegarde eProf - VERSION SIMPLIFIÉE

## 🎯 Principe simple

Toutes vos données (notes, suivi élèves, calendrier, etc.) sont maintenant sauvegardées **automatiquement** dans un seul fichier JSON.

## ✨ Comment ça fonctionne ?

### 🔄 Sauvegarde automatique (en arrière-plan)
- **Vous ne faites rien !** Le système sauvegarde automatiquement 2 secondes après chaque modification
- Pas besoin de cliquer sur des boutons à chaque fois
- Vos données sont en sécurité dans le navigateur

### 💾 Export manuel (pour transférer sur un autre PC)

**Quand exporter ?**
- 1 fois par semaine (recommandé)
- Avant de changer d'ordinateur
- Avant une réinstallation du système

**Comment exporter ?**

**Méthode 1 : Depuis le Carnet de notes**
1. Ouvrez [carnet-notes.html](../carnet-notes.html)
2. Cliquez sur **💾 Exporter** (en haut à droite)
3. Un fichier `eprof-sauvegarde-2026-01-09.json` est téléchargé
4. ✅ C'est tout !

**Méthode 2 : Depuis Suivi des élèves**
1. Ouvrez [index.html](../index.html)
2. Allez dans **👨‍🎓 Suivi des élèves**
3. Cliquez sur **💾 Exporter**
4. Le fichier JSON est téléchargé
5. ✅ Terminé !

> **Note :** Les deux méthodes exportent **TOUTES** vos données (pas seulement les notes ou le suivi).

### 📂 Import (sur un nouvel ordinateur)

**Étape 1 :** Copiez tout le dossier eProf sur le nouvel ordinateur

**Étape 2 :** Importez vos données
1. Ouvrez n'importe quelle page (index.html ou carnet-notes.html)
2. Cliquez sur **📂 Importer**
3. Sélectionnez votre fichier `eprof-sauvegarde-XXXX.json`
4. ✅ Toutes vos données sont restaurées !

## 📁 Où conserver les fichiers de sauvegarde ?

Créez un dossier **Sauvegardes** dans eProf :
```
eProf/
├── Sauvegardes/
│   ├── eprof-sauvegarde-2026-01-09.json
│   ├── eprof-sauvegarde-2026-01-16.json
│   └── eprof-sauvegarde-2026-01-23.json
```

Ou mieux : sauvegardez aussi sur **OneDrive** ou une **clé USB** !

## ⚡ Avantages de ce système

✅ **Automatique** : Sauvegarde en arrière-plan sans intervention
✅ **Simple** : Un seul fichier JSON à gérer
✅ **Complet** : Toutes les données en un clic
✅ **Portable** : Fonctionne sur n'importe quel ordinateur
✅ **Rapide** : Import/Export instantané

## 🔍 Contenu du fichier de sauvegarde

Le fichier JSON contient :
- 📒 **Évaluations** : Toutes vos évaluations créées
- 📝 **Notes** : Toutes les notes de tous les élèves
- 👨‍🎓 **Suivi élèves** : Observations, incidents, etc.
- 📅 **Calendrier** : Vos événements et rendez-vous
- ⚙️ **Paramètres** : Vos préférences

## ⚠️ Important

### ⏰ Rappel de sauvegarde
Le système vous avertira s'il n'y a pas eu d'export depuis plus de 24h :
```
⚠️ Dernière sauvegarde il y a 3 jour(s). Pensez à exporter vos données !
```

### 🔒 Sécurité
- Le fichier JSON est lisible avec n'importe quel éditeur de texte
- Vous pouvez faire autant de sauvegardes que vous voulez
- Gardez toujours au moins 2 copies (PC + clé USB ou OneDrive)

## 🆘 Problèmes fréquents

**"dataManager is not defined"**
- ✅ **Résolu !** Le nouveau système utilise `window.dataManager`
- Rechargez la page si le message persiste

**"Les données ne se chargent pas sur le nouvel ordinateur"**
- Vérifiez que vous avez bien importé le fichier JSON
- Assurez-vous d'avoir copié tout le dossier eProf

**"J'ai perdu mon fichier de sauvegarde"**
- Les données sont toujours dans le localStorage du navigateur actuel
- Exportez immédiatement pour créer un nouveau fichier

## 💡 Conseil Pro

**Créez une routine hebdomadaire :**
- Chaque vendredi : Exportez vos données
- Sauvegardez le fichier JSON sur OneDrive
- Supprimez les sauvegardes de plus d'1 mois pour gagner de la place

---

**Version du système :** 2.0 (Simplifié - Janvier 2026)
