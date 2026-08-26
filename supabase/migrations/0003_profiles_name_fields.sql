-- Ajoute les champs nom/prénom séparés utilisés par la page Paramètres eProf.
alter table public.profiles add column if not exists nom text;
alter table public.profiles add column if not exists prenom text;
