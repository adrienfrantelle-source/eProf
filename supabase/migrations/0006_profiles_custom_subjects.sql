-- Catalogue de matières personnalisable par enseignant (ajout / renommage libre,
-- répercuté dans profiles.subjects_by_class au moment du renommage côté client).
alter table public.profiles add column if not exists custom_subjects jsonb not null default '[]'::jsonb;
