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
   - `0008_admin_mode.sql` : colonne `profiles.is_admin`, fonction `is_admin()`,
     policies d'administration sur `allowed_teachers` et fonction
     `admin_delete_teacher_account`. Le compte `adfrantelle` est promu
     administrateur (panneau accessible via le bouton « 🔐 Admin » du footer).
   - `0009_rgpd.sql` : journal d'audit admin (`admin_audit_log` +
     `log_admin_action`), registre des traitements, consentements, durées de
     conservation, et fonctions `admin_export_teacher_data` (droit d'accès),
     `admin_anonymize_teacher` (droit à l'oubli) et `admin_run_retention_purge`.
     La purge automatique via `pg_cron` est optionnelle (SQL fourni en fin de
     fichier de migration).
   - `0010_supervision.sql` : logs applicatifs (`app_logs`), suivi des jobs
     (`platform_jobs`), tableau de bord (`admin_platform_stats`), journal des
     connexions (`admin_list_auth_events`) et sauvegarde globale
     (`admin_full_backup`). Met aussi à jour la purge RGPD pour couvrir les
     nouvelles tables.
   - `0011_communication.sql` : annonces institutionnelles (`announcements`,
     ciblage par identifiant ou par matière via RLS), accusés de lecture,
     modèles de notification, modération des contenus signalés
     (`content_reports`) et statistiques de diffusion.
   - `0012_administration_pedagogique.sql` : référentiels mutualisés de
     l'établissement — classes officielles avec leur type de période
     (`school_classes`), matières (`school_subjects`), affectations
     prof ↔ classe ↔ matière (`teacher_assignments`), référentiels de
     compétences et modèles d'évaluation. Lecture ouverte aux enseignants
     connectés, écriture réservée à l'administrateur.
   - `0013_suggestions.sql` : suggestions et signalements de bugs déposés par
     les enseignants (`suggestions`, `suggestion_votes`), synthèse todolist
     `admin_suggestions_board`. Refactore aussi la purge RGPD via
     `purge_retention_target` pour ne plus la réécrire à chaque nouvelle table.
   - `0014_eleves_et_comptes.sql` : listes d'élèves de l'établissement
     (`school_students`, import CSV via `admin_replace_class_students`),
     drapeau `profiles.actif`, et fonctions de gestion des comptes
     (`admin_list_accounts`, `admin_set_account_active`, `admin_set_admin_role`).
   - `0015_vue_profs_couleurs_suggestions.sql` : couleurs de classes partagées,
     familles de jeux, édition des suggestions par l'auteur, vue d'ensemble admin.
   - `0016_suggestions_lock_after_triage.sql` : verrouillage des suggestions après triage.
   - `0017_messagerie.sql` : messagerie interne (canaux, membres, messages texte/liens),
     annuaire des collègues, et nettoyage auto (historique au 31 juillet, canaux
     inactifs au bout de 6 mois).
   - `0018_messagerie_channel_admin.sql` : configuration des canaux (retrait de
     membres, suppression, auteur exposé).
   - `0019_messagerie_cleanup_where.sql` : purge du 31 juillet avec clause WHERE
     (évite l'erreur « DELETE requires a WHERE clause »).
   - `0020_ressources_et_ordre.sql` : table `pedagogical_resources` (liens perso +
     dossier officiel partagé) et colonne `position` sur les jeux pour l'ordre
     par glisser-déposer.
   - `0021_ressources_dossiers_partage.sql` : dossiers public/privé, masquage des
     partages, et dossier officiel réservé à l'administrateur.
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
   | `SUPABASE_SERVICE_ROLE_KEY` | clé `service_role` Supabase | Production, Preview, Development |

   La clé `service_role` est utilisée **uniquement** par la fonction serveur
   `api/admin/users.js` (gestion des mots de passe et identifiants depuis le
   panneau d'administration). Elle n'est jamais renvoyée au navigateur :
   `/api/config` n'expose que l'URL et la clé anonyme.
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
