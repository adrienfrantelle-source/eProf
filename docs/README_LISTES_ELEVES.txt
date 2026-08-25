╔═══════════════════════════════════════════════════════════════╗
║              GESTION DES LISTES D'ÉLÈVES                      ║
╚═══════════════════════════════════════════════════════════════╝

📁 STRUCTURE DES FICHIERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Trombinoscopes/2025-2026/Listes/
├── *.csv                    → Fichiers sources (format CSV)
├── _EXEMPLE.csv             → Modèle pour créer de nouvelles listes
├── EFFECTIFS.txt            → Récapitulatif des effectifs par classe
└── README.txt               → Instructions

listes-eleves.js             → Fichier JavaScript généré (ne pas modifier)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 FORMAT DES FICHIERS CSV
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Ligne 1 (en-tête) : Nom,Prénom,Sexe
Lignes suivantes   : MARTIN,Lucas,M
                      DURAND,Emma,F
                      ...

⚠️ IMPORTANT :
   • Pas d'espaces avant/après les virgules
   • Sexe = "M" ou "F" (majuscule)
   • Encodage UTF-8
   • Nom du fichier = nom de la classe affiché dans l'appli

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔄 MODIFIER LES LISTES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Ouvrir le fichier CSV avec Excel, Notepad++, ou un éditeur de texte

2. Modifier les données (ajouter/supprimer/modifier des élèves)

3. Enregistrer le fichier CSV (garder le format CSV UTF-8)

4. Double-cliquer sur : REGENERER_LISTES.bat

   → Cela met à jour automatiquement listes-eleves.js
   → L'application utilisera les nouvelles données

⚠️ NE PAS modifier directement listes-eleves.js !
   Il sera écrasé à chaque régénération.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

➕ AJOUTER UNE NOUVELLE CLASSE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Copier le fichier _EXEMPLE.csv

2. Renommer avec le nom de la classe (ex: "1ere STAV.csv")

3. Remplir avec les élèves de la classe

4. Double-cliquer sur : REGENERER_LISTES.bat

5. La nouvelle classe apparaîtra automatiquement dans l'application

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❓ DÉPANNAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔴 Les modifications ne sont pas prises en compte :
   → Avez-vous lancé REGENERER_LISTES.bat ?
   → Rafraîchissez la page de l'application (F5)

🔴 Une classe n'apparaît pas dans l'application :
   → Vérifiez que le fichier CSV existe bien
   → Vérifiez le nom du fichier (doit finir par .csv)
   → Relancez REGENERER_LISTES.bat

🔴 Les élèves n'ont pas de couleur :
   → Vérifiez que la colonne Sexe contient "M" ou "F"
   → Vérifiez qu'il n'y a pas d'espaces (M, F, ou " M")

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 CLASSES ACTUELLES (2025-2026)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• 2nde LCQ              (10 élèves)
• 2nde SAPAT AB1        (22 élèves)
• 2nde SAPAT AB2        (21 élèves)
• 2nde SAPAT AB3        (22 élèves)
• 3e A                  (21 élèves)
• 3e B                  (21 élèves)
• 4e                    (20 élèves)
• Tle SAPAT A           (26 élèves)
• Tle SAPAT B           (25 élèves)

TOTAL : 188 élèves

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
