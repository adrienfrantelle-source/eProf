# Mise en ligne eProf — Supabase + Vercel

Ce document explique comment déployer eProf en ligne. Le site reste 100 %
HTML/CSS/JS (pas de framework, pas de build), avec :
- **Vercel** pour l'hébergement statique + une petite fonction serverless (`/api/config`).
- **Supabase** pour l'authentification des enseignants et le stockage des données
  (classes, élèves, notes, calendrier, plans de classe, jeux pédagogiques).

## 1. Créer le projet Supabase

1. Aller sur https://supabase.com → **New project**.
2. Noter l'**URL du projet** et la **clé `anon` (public)** (Project Settings → API).
3. Dans **SQL Editor**, exécuter dans l'ordre les fichiers du dossier
   [`supabase/migrations/`](supabase/migrations/) :
   - `0001_init_schema.sql` : tables `profiles`, `classes`, `students`,
     `evaluations`, `grades`, `calendar_events`, `class_plans`,
     `pedagogical_games`, toutes protégées par des policies RLS qui limitent
     chaque enseignant à ses propres données.
   - `0002_teacher_documents.sql` : table générique `teacher_documents`
     (un document JSON par enseignant et par type, ex. carnet de notes)
     pour les modules dont le modèle de données n'est pas encore normalisé.
   - `0003_profiles_name_fields.sql` : ajoute les colonnes `nom`/`prenom` au profil.
   - `0004_profiles_teacher_config.sql` : ajoute les colonnes `classes` et
     `subjects_by_class` (config choisie à la première connexion).
   - `0005_allowed_teachers.sql` : liste blanche `allowed_teachers` + fonction
     `is_identifiant_available` + mise à jour du trigger `handle_new_user`
     pour restreindre l'auto-inscription aux identifiants autorisés.
   - `0006_profiles_custom_subjects.sql` : ajoute la colonne `custom_subjects`
     (catalogue de matières personnalisable, ajout/renommage par l'enseignant).
   - `0007_agenda_calendar_events.sql` : ajoute `color`, `emoji`, `done`,
     `reminder_minutes` et `source` à `calendar_events` (module Agenda ; les
     éléments d'agenda sont des événements de calendrier avec `source = 'agenda'`).
   (ou utiliser la CLI, voir section 4 : `supabase db push` applique tous les
   fichiers en une fois, dans l'ordre.)
4. Dans **Authentication → Providers → Email**, laisser **"Allow new users to
   sign up"** activé (l'auto-inscription est gérée et restreinte côté base de
   données, pas ici) et désactiver **"Confirm email"** (sinon le compte reste
   bloqué en attente de confirmation après l'inscription).

## 2. Autoriser des enseignants à créer leur compte

L'inscription se fait en libre-service sur le site (écran de connexion →
"Créer mon compte"), mais uniquement pour les identifiants que tu ajoutes
toi-même à la liste blanche. Dans **SQL Editor** :

```sql
insert into public.allowed_teachers (identifiant, nom, prenom, matiere)
values
  ('adfrantelle', 'Frantelle', 'Adrien', 'Histoire-Géographie'),
  ('anboulord', 'Boulord', 'Anne', 'Mathématiques');
```

- L'enseignant se connecte ensuite avec `identifiant` + le mot de passe de son
  choix ; l'email envoyé à Supabase est toujours `identifiant@jeannedelanoue.com`.
- Une fois l'inscription utilisée, `is_registered` passe à `true` et cet
  identifiant ne peut plus servir à créer un second compte.
- Le trigger `handle_new_user` crée automatiquement la ligne `profiles`
  correspondante (pré-remplie avec nom/prénom/matière si fournis ci-dessus).

## 3. Déployer sur Vercel

1. Sur https://vercel.com → **Add New Project** → importer le dépôt GitHub
   `adrienfrantelle-source/eprof`.
2. Vercel détecte un site statique + le dossier `api/` (fonctions serverless) :
   aucune configuration de build n'est nécessaire.
3. Dans **Project Settings → Environment Variables**, ajouter :
   | Nom | Valeur | Environnements |
   |---|---|---|
   | `SUPABASE_URL` | URL du projet Supabase | Production, Preview, Development |
   | `SUPABASE_ANON_KEY` | clé anonyme Supabase | Production, Preview, Development |
   (Ne pas ajouter la clé `service_role` sur Vercel : elle n'est jamais utilisée
   côté serveur/navigateur pour ce projet.)
4. Déployer. Le site est servi à la racine, la fonction `/api/config` renvoie
   `{ supabaseUrl, supabaseAnonKey }` au navigateur, qui initialise
   `js/supabase-client.js`.

## 4. (Optionnel) Travailler avec la CLI Supabase en local

```bash
npm install -g supabase
supabase login
supabase link --project-ref <ref-du-projet>
supabase db push        # applique supabase/migrations/*.sql
```

## 5. Développement local

- Copier `.env.example` en `.env` et renseigner `SUPABASE_URL` / `SUPABASE_ANON_KEY`.
- Avec la CLI Vercel : `npx vercel dev` (sert le statique **et** `/api/config`
  à partir des variables d'environnement locales).
- Sans Vercel CLI : créer un fichier non versionné `js/local-config.js` chargé
  avant `js/supabase-client.js` avec :
  ```html
  <script>
    window.__EPROF_LOCAL_CONFIG__ = {
      supabaseUrl: 'https://xxxx.supabase.co',
      supabaseAnonKey: 'eyJhbGciOi...'
    };
  </script>
  ```
  `supabase-client.js` utilise cette config en priorité si elle est présente.

## État actuel par module (sidebar)

La synchronisation Supabase est câblée module par module, chaque module
gardant un repli 100 % local (localStorage / fichiers) si Supabase n'est pas
configuré ou si l'enseignant n'est pas connecté :

| Module | État |
|---|---|
| Accueil | Badge "En ligne / Hors ligne" dans le header |
| Calendrier | Synchronisé (`calendar_events`) |
| Tableau blanc | Local uniquement (outil de session, pas de compte à synchroniser) |
| Plan de classe | Export/import fichier existant **+** enregistrement en ligne (`class_plans`) |
| Jeu pédagogique | Synchronisé (`pedagogical_games`) |
| Trombinoscopes | Statique (rien à synchroniser) |
| Suivi des élèves | Fonctionnalité en pause (listes 2026-2027 non importées) ; prêt à suivre le même schéma que le carnet de notes (`teacher_documents`) une fois réactivé |
| Carnet de notes (`carnet-notes.html`) | Sauvegarde/chargement en ligne (`teacher_documents`, doc_type `carnet_notes`) + correction d'un bug bloquant (`allowedClasses`) |
| Conversion de fichier | Aucune donnée persistée |
| Archives | Lecture seule (données historiques statiques) |
| Ressources pédagogiques | Fonctionnalité à venir |
| Paramètres | Profil enseignant synchronisé (`profiles`) + correction d'un bug bloquant (sélecteur de périodes manquant) |

### Bugs corrigés au passage
- `js/carnet-notes.js` : `initClassSelector` référençait une variable
  `allowedClasses` inexistante → la page carnet de notes plantait au
  chargement. Corrigé pour utiliser `classes`.
- `js/app.js` (Paramètres) : le code tentait d'attacher un `addEventListener`
  sur `#param-classe-select`, un élément absent du gabarit actuel → toute la
  page Paramètres plantait avant même d'attacher les autres boutons. Le bloc
  "gestion des périodes par classe" est maintenant protégé par une garde et
  ne s'exécute que si l'élément existe.

## Connexion enseignant (Supabase Auth)

Un écran de connexion (`#eprof-auth-gate`, dans `index.html` et
`carnet-notes.html`) bloque l'accès à l'application tant que l'enseignant n'est
pas authentifié. Il se connecte avec son `identifiant` + mot de passe ;
l'email envoyé à Supabase est toujours `identifiant@jeannedelanoue.com`
(construit par `js/teacher-manager.js`, jamais saisi directement).

- **Première connexion** : si aucune classe n'est encore enregistrée sur le
  profil, la fenêtre de configuration des classes/matières s'ouvre
  automatiquement. Le choix est sauvegardé en local **et** sur
  `profiles.classes` / `profiles.subjects_by_class`.
- **Header** : une fois connecté, l'identifiant s'affiche en haut à droite et
  l'adresse mail (toujours `identifiant@jeannedelanoue.com`) en dessous, avec
  un lien direct vers la messagerie web.
- **Gestion du compte** : changement de mot de passe et d'identifiant depuis
  **Paramètres → 🔐 Mon compte** (`window.teacherManager.changePassword(...)`
  / `changeIdentifiant(...)`), ainsi que la déconnexion.
- **Première connexion / inscription** : sur l'écran de connexion, un
  enseignant clique sur "Créer mon compte", saisit son identifiant + un mot de
  passe de son choix. L'inscription n'est acceptée que si l'identifiant a été
  ajouté à `allowed_teachers` (section 2) et n'a pas déjà servi. Juste après,
  la fenêtre de configuration des classes/matières s'ouvre automatiquement ;
  le choix est sauvegardé en local **et** sur `profiles.classes` /
  `profiles.subjects_by_class`, donc plus jamais redemandé ensuite.
- **Header** : une fois connecté, l'identifiant s'affiche en haut à droite et
  l'adresse mail (toujours `identifiant@jeannedelanoue.com`) en dessous, avec
  un lien direct vers la messagerie web.
- **Gestion du compte** : changement de mot de passe et d'identifiant depuis
  **Paramètres → 🔐 Mon compte** (`window.teacherManager.changePassword(...)`
  / `changeIdentifiant(...)`), ainsi que la déconnexion.
- Tant qu'un identifiant n'a pas été ajouté à `allowed_teachers`, toute
  tentative de création de compte échoue avec un message clair. La session
  Supabase est ensuite mise en cache par le navigateur, ce qui permet de
  rouvrir l'application hors connexion après une première connexion réussie
  en ligne.
