-- Emplois du temps par classe (images), partagés entre enseignants.
-- Lecture : tout enseignant connecté. Écriture : administrateur uniquement.

create table if not exists public.class_timetables (
    id uuid primary key default gen_random_uuid(),
    classe text not null,
    annee_scolaire text not null,
    storage_path text not null,
    mime_type text,
    original_name text,
    uploaded_by uuid references public.profiles (id) on delete set null,
    updated_at timestamptz not null default now(),
    unique (classe, annee_scolaire)
);

create index if not exists class_timetables_annee_idx
    on public.class_timetables (annee_scolaire, classe);

alter table public.class_timetables enable row level security;

drop policy if exists "class_timetables_read_all" on public.class_timetables;
create policy "class_timetables_read_all" on public.class_timetables
    for select to authenticated using (true);

drop policy if exists "class_timetables_admin_write" on public.class_timetables;
create policy "class_timetables_admin_write" on public.class_timetables
    for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public)
values ('class-timetables', 'class-timetables', false)
on conflict (id) do nothing;

drop policy if exists "class_timetables_storage_read" on storage.objects;
create policy "class_timetables_storage_read" on storage.objects
    for select to authenticated
    using (bucket_id = 'class-timetables');

drop policy if exists "class_timetables_storage_insert" on storage.objects;
create policy "class_timetables_storage_insert" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'class-timetables' and public.is_admin());

drop policy if exists "class_timetables_storage_update" on storage.objects;
create policy "class_timetables_storage_update" on storage.objects
    for update to authenticated
    using (bucket_id = 'class-timetables' and public.is_admin())
    with check (bucket_id = 'class-timetables' and public.is_admin());

drop policy if exists "class_timetables_storage_delete" on storage.objects;
create policy "class_timetables_storage_delete" on storage.objects
    for delete to authenticated
    using (bucket_id = 'class-timetables' and public.is_admin());
