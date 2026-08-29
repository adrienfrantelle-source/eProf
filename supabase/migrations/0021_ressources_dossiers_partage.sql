-- Dossiers perso public/privé, masquage des partages, dossier officiel réservé à l'admin.

alter table public.pedagogical_resources
    add column if not exists folder_id uuid;

create table if not exists public.pedagogical_resource_folders (
    id uuid primary key default gen_random_uuid(),
    teacher_id uuid not null references public.profiles (id) on delete cascade,
    nom text not null,
    visibilite text not null default 'prive' check (visibilite in ('prive', 'public')),
    created_at timestamptz not null default now(),
    unique (teacher_id, nom)
);

create index if not exists pedagogical_resource_folders_teacher_idx
    on public.pedagogical_resource_folders (teacher_id, visibilite);

alter table public.pedagogical_resources
    drop constraint if exists pedagogical_resources_folder_id_fkey;
alter table public.pedagogical_resources
    add constraint pedagogical_resources_folder_id_fkey
    foreign key (folder_id) references public.pedagogical_resource_folders (id) on delete set null;

create table if not exists public.pedagogical_resource_hidden_folders (
    user_id uuid not null references auth.users (id) on delete cascade,
    folder_id uuid not null references public.pedagogical_resource_folders (id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (user_id, folder_id)
);

alter table public.pedagogical_resource_folders enable row level security;
alter table public.pedagogical_resource_hidden_folders enable row level security;

drop policy if exists "prf_select" on public.pedagogical_resource_folders;
create policy "prf_select" on public.pedagogical_resource_folders
    for select to authenticated
    using (teacher_id = auth.uid() or visibilite = 'public');

drop policy if exists "prf_insert_own" on public.pedagogical_resource_folders;
create policy "prf_insert_own" on public.pedagogical_resource_folders
    for insert to authenticated
    with check (teacher_id = auth.uid());

drop policy if exists "prf_update_own" on public.pedagogical_resource_folders;
create policy "prf_update_own" on public.pedagogical_resource_folders
    for update to authenticated
    using (teacher_id = auth.uid())
    with check (teacher_id = auth.uid());

drop policy if exists "prf_delete_own" on public.pedagogical_resource_folders;
create policy "prf_delete_own" on public.pedagogical_resource_folders
    for delete to authenticated
    using (teacher_id = auth.uid());

drop policy if exists "prhf_own" on public.pedagogical_resource_hidden_folders;
create policy "prhf_own" on public.pedagogical_resource_hidden_folders
    for all to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists "pedagogical_resources_select" on public.pedagogical_resources;
create policy "pedagogical_resources_select" on public.pedagogical_resources
    for select to authenticated
    using (
        officiel
        or teacher_id = auth.uid()
        or (
            folder_id is not null
            and exists (
                select 1 from public.pedagogical_resource_folders f
                where f.id = folder_id and f.visibilite = 'public'
            )
        )
    );

drop policy if exists "pedagogical_resources_insert" on public.pedagogical_resources;
create policy "pedagogical_resources_insert" on public.pedagogical_resources
    for insert to authenticated
    with check (
        (officiel and teacher_id is null and public.is_admin())
        or (not officiel and teacher_id = auth.uid())
    );

drop policy if exists "pedagogical_resources_update" on public.pedagogical_resources;
create policy "pedagogical_resources_update" on public.pedagogical_resources
    for update to authenticated
    using ((officiel and public.is_admin()) or (not officiel and teacher_id = auth.uid()))
    with check ((officiel and public.is_admin()) or (not officiel and teacher_id = auth.uid()));

drop policy if exists "pedagogical_resources_delete" on public.pedagogical_resources;
create policy "pedagogical_resources_delete" on public.pedagogical_resources
    for delete to authenticated
    using ((officiel and public.is_admin()) or (not officiel and teacher_id = auth.uid()));

create or replace function public.list_visible_resource_folders()
returns table (
    id uuid,
    teacher_id uuid,
    nom text,
    visibilite text,
    owner_nom text,
    owner_prenom text,
    owner_identifiant text
)
language sql
security definer
stable
set search_path = public
as $$
    select
        f.id,
        f.teacher_id,
        f.nom,
        f.visibilite,
        coalesce(p.nom, ''),
        coalesce(p.prenom, ''),
        lower(split_part(coalesce(p.email, ''), '@', 1))
    from public.pedagogical_resource_folders f
    left join public.profiles p on p.id = f.teacher_id
    where f.teacher_id = auth.uid()
       or f.visibilite = 'public'
    order by f.nom;
$$;

grant execute on function public.list_visible_resource_folders() to authenticated;

create or replace function public.list_visible_pedagogical_resources()
returns table (
    id uuid,
    teacher_id uuid,
    title text,
    url text,
    famille text,
    position integer,
    officiel boolean,
    folder_id uuid
)
language sql
security definer
stable
set search_path = public
as $$
    select
        r.id,
        r.teacher_id,
        r.title,
        r.url,
        r.famille,
        r.position,
        r.officiel,
        r.folder_id
    from public.pedagogical_resources r
    where r.officiel
       or r.teacher_id = auth.uid()
       or (
            r.folder_id is not null
            and exists (
                select 1 from public.pedagogical_resource_folders f
                where f.id = r.folder_id and f.visibilite = 'public'
            )
       )
    order by r.position, r.created_at;
$$;

grant execute on function public.list_visible_pedagogical_resources() to authenticated;
