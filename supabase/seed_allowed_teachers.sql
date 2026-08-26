-- Liste blanche des enseignants autorisés à s'auto-inscrire (équipe agri).
-- À exécuter dans le SQL Editor de Supabase (rôle postgres, bypass RLS).
-- Idempotent : relancer le script n'écrase pas les comptes déjà créés.

insert into public.allowed_teachers (identifiant, prenom, nom, matiere) values
    ('adfrantelle',    'Adrien',    'Frantelle',    'Histoire-géographie'),
    ('ammartineau',    'Amélie',    'Martineau',    'Biologie'),
    ('anboulord',      'Anne',      'Boulord',      'MP8'),
    ('armorisset',     'Arthur',    'Morisset',     'EPS'),
    ('camichaud',      'Carla',     'Michaud',      'Espagnol'),
    ('cagabory',       'Catherine', 'Gabory',       'MP8'),
    ('dacherel',       'Daphné',    'Cherel',       'Biologie'),
    ('elgroleau',      'Élodie',    'Groleau',      'Anglais'),
    ('emauger',        'Emmanuel',  'Auger',        'Physique'),
    ('faviolet',       'Fabien',    'Violet',       'Mathématiques'),
    ('frbrunet',       'François',  'Brunet',       'ESC'),
    ('ghamiot',        'Ghislaine', 'Amiot',        'Biologie'),
    ('gumartin',       'Guillem',   'Martin',       'EPS'),
    ('gulambert',      'Guyleine',  'Lambert',      'Direction'),
    ('ischouteau',     'Isabelle',  'Chouteau',     'MP9-10'),
    ('isclochard',     'Isabelle',  'Clochard',     'ESC'),
    ('lapotin',        'Lana',      'Potin',        'Mathématiques'),
    ('luguineberteau', 'Lucie',     'Guineberteau', 'Lettres'),
    ('magendronneau',  'Marion',    'Gendronneau',  'MP8'),
    ('mapoirier',      'Maryse',    'Poirier',      'Histoire-géographie'),
    ('megazeau',       'Mélissa',   'Gazeau',       'TP'),
    ('misauvetre',     'Michèle',   'Sauvetre',     'Mathématiques'),
    ('nejounot',       'Nelly',     'Jounot',       'Anglais'),
    ('pahobon',        'Pauline',   'Hobon',        'Lettres'),
    ('phprevost',      'Philippe',  'Prevost',      'ESC'),
    ('sodecasanove',   'Sophie',    'Decasanove',   'Mathématiques'),
    ('stgangnard',     'Stéphane',  'Gangnard',     'EPS'),
    ('stprevost',      'Stéphanie', 'Prevost',      'Anglais'),
    ('sychupin',       'Sylvie',    'Chupin',       'MP8'),
    ('vedevin',        'Véronique', 'Devin',        'Biologie'),
    ('vegabaret',      'Véronique', 'Gabaret',      'Anglais')
on conflict (identifiant) do update set
    prenom  = excluded.prenom,
    nom     = excluded.nom,
    matiere = excluded.matiere;
