# 💾 SYSTÈME DE SAUVEGARDE - MODE D'EMPLOI

## ⚡ NOUVEAU : SAUVEGARDE 100% AUTOMATIQUE

**Plus besoin de manipulations manuelles !**

### 🎯 Configuration initiale (une seule fois)

1. Ouvrez [index.html](index.html)
2. Cliquez sur le bouton **⚡ Auto OFF** (en haut à droite)
3. Sélectionnez le dossier **Donnees** de votre projet eProf
4. ✅ C'est tout ! Le bouton devient **⚡ Auto ON** (vert)

**Résultat :** 
- Toutes vos modifications sont **sauvegardées automatiquement** dans `Donnees/sauvegarde-auto.json`
- Aucune action manuelle requise
- Le fichier est mis à jour 3 secondes après chaque modification

### 📋 Utilisation quotidienne

**RIEN À FAIRE !** 🎉

Travaillez normalement :
- Ajoutez des notes
- Créez des évaluations  
- Notez le suivi des élèves
- Modifiez votre calendrier

→ Tout est automatiquement sauvegardé dans `Donnees/sauvegarde-auto.json`

### 🔄 Sur un autre ordinateur

**Option 1 : Mode automatique (recommandé)**
1. Copiez tout le dossier **eProf** (avec Donnees/)
2. Ouvrez index.html
3. Le fichier `sauvegarde-auto.json` est automatiquement détecté
4. ✅ Vos données sont là !

**Option 2 : Import manuel**
1. Cliquez sur **📂 Restaurer**
2. Sélectionnez `Donnees/sauvegarde-auto.json`
3. ✅ Données restaurées !

## 💾 ALTERNATIVE : SAUVEGARDE MANUELLE

Si votre navigateur ne supporte pas l'API (ou si vous préférez), vous pouvez toujours :

1. **💾 Sauvegarder** : Télécharge un fichier JSON daté
2. **📂 Restaurer** : Importe un fichier de sauvegarde

## ⚙️ Configuration requise

**Pour la sauvegarde automatique :**
- Chrome 86+ ou Edge 86+ (recommandé)
- Firefox 111+ (avec activation manuelle)

**Pour la sauvegarde manuelle :**
- N'importe quel navigateur moderne

## 📁 Fichiers de sauvegarde

```
eProf/
├── Donnees/
│   └── sauvegarde-auto.json     ← Mise à jour automatiquement
├── Téléchargements/
│   ├── eprof-sauvegarde-2026-01-09.json  ← Sauvegardes manuelles
│   └── eprof-sauvegarde-2026-01-16.json
```

## ⚠️ Important

### Première utilisation
- Cliquez sur **⚡ Auto OFF** pour activer le mode automatique
- Autorisez l'accès au dossier Donnees (permission unique)
- Le bouton devient vert : **⚡ Auto ON**

### Sauvegarde sur OneDrive
Recommandé : placez tout le dossier eProf sur OneDrive pour :
- Synchronisation automatique entre ordinateurs
- Sauvegarde cloud de `sauvegarde-auto.json`
- Protection contre la perte de données

## 💡 Conseils Pro

**Setup idéal :**
1. Activez le mode **⚡ Auto ON**
2. Placez eProf dans OneDrive
3. Travaillez normalement
4. Vos données sont automatiquement sauvegardées ET synchronisées !

**Sauvegarde de sécurité hebdomadaire :**
- Même avec le mode auto, faites une sauvegarde manuelle (💾) une fois par semaine
- Gardez ces fichiers dans un dossier séparé

## 🆘 Dépannage

**Le bouton ⚡ Auto ne fonctionne pas**
- Utilisez Chrome ou Edge récent
- Ou utilisez les boutons 💾/📂 manuels

**"Sauvegarde manuelle" s'affiche**
- Normal, le mode auto n'est pas activé
- Cliquez sur **⚡ Auto OFF** pour l'activer

**Mes données ne se synchronisent pas entre PC**
- Vérifiez que le dossier eProf est bien sur OneDrive
- Attendez la synchronisation OneDrive
- Ou copiez manuellement `sauvegarde-auto.json`

---

**Version :** 3.0 (Automatique - Janvier 2026)
