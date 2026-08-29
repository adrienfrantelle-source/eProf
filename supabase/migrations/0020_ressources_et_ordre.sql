-- Ressources pédagogiques (liens perso + dossier officiel partagé)
-- et ordre des liens dans les dossiers (jeux + ressources).

alter table public.pedagogical_games
    add column if not exists position integer not null default 0;

create table if not exists public.pedagogical_resources (
    id uuid primary key default gen_random_uuid(),
    teacher_id uuid references public.profiles (id) on delete cascade,
    created_by uuid references auth.users (id) on delete set null,
    title text not null,
    url text not null,
    famille text not null default 'Général',
    position integer not null default 0,
    officiel boolean not null default false,
    created_at timestamptz not null default now()
);

create index if not exists pedagogical_resources_teacher_idx
    on public.pedagogical_resources (teacher_id, famille, position);

create index if not exists pedagogical_resources_officiel_idx
    on public.pedagogical_resources (officiel, position)
    where officiel;

alter table public.pedagogical_resources enable row level security;

drop policy if exists "pedagogical_resources_select" on public.pedagogical_resources;
create policy "pedagogical_resources_select" on public.pedagogical_resources
    for select to authenticated
    using (officiel or teacher_id = auth.uid());

drop policy if exists "pedagogical_resources_insert" on public.pedagogical_resources;
create policy "pedagogical_resources_insert" on public.pedagogical_resources
    for insert to authenticated
    with check (
        (officiel and teacher_id is null)
        or (not officiel and teacher_id = auth.uid())
    );

drop policy if exists "pedagogical_resources_update" on public.pedagogical_resources;
create policy "pedagogical_resources_update" on public.pedagogical_resources
    for update to authenticated
    using (officiel or teacher_id = auth.uid())
    with check (officiel or teacher_id = auth.uid());

drop policy if exists "pedagogical_resources_delete" on public.pedagogical_resources;
create policy "pedagogical_resources_delete" on public.pedagogical_resources
    for delete to authenticated
    using (officiel or teacher_id = auth.uid());
