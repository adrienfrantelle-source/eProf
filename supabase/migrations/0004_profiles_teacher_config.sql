-- Config "classes enseignées + matières par classe" choisie à la première connexion,
-- une par enseignant (jsonb, miroir de ce qui était uniquement en localStorage).
alter table public.profiles add column if not exists classes jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists subjects_by_class jsonb not null default '{}'::jsonb;

-- Filet de sécurité : permet l'upsert du profil même si le trigger de création
-- automatique (handle_new_user) n'a pas encore créé la ligne pour une raison quelconque.
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
    for insert with check (id = auth.uid());
