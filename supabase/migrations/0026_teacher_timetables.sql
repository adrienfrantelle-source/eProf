-- Emploi du temps personnel (image), un par enseignant et par année.
-- Chaque prof lit et écrit uniquement le sien.

create table if not exists public.teacher_timetables (
    id uuid primary key default gen_random_uuid(),
    teacher_id uuid not null references public.profiles (id) on delete cascade,
    annee_scolaire text not null,
    storage_path text not null,
    mime_type text,
    original_name text,
    updated_at timestamptz not null default now(),
    unique (teacher_id, annee_scolaire)
);

create index if not exists teacher_timetables_teacher_idx
    on public.teacher_timetables (teacher_id, annee_scolaire);

alter table public.teacher_timetables enable row level security;

drop policy if exists "teacher_timetables_own_select" on public.teacher_timetables;
create policy "teacher_timetables_own_select" on public.teacher_timetables
    for select to authenticated using (teacher_id = auth.uid());

drop policy if exists "teacher_timetables_own_insert" on public.teacher_timetables;
create policy "teacher_timetables_own_insert" on public.teacher_timetables
    for insert to authenticated with check (teacher_id = auth.uid());

drop policy if exists "teacher_timetables_own_update" on public.teacher_timetables;
create policy "teacher_timetables_own_update" on public.teacher_timetables
    for update to authenticated using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

drop policy if exists "teacher_timetables_own_delete" on public.teacher_timetables;
create policy "teacher_timetables_own_delete" on public.teacher_timetables
    for delete to authenticated using (teacher_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('teacher-timetables', 'teacher-timetables', false)
on conflict (id) do nothing;

drop policy if exists "teacher_timetables_storage_select" on storage.objects;
create policy "teacher_timetables_storage_select" on storage.objects
    for select to authenticated
    using (bucket_id = 'teacher-timetables' and split_part(name, '/', 1) = auth.uid()::text);

drop policy if exists "teacher_timetables_storage_insert" on storage.objects;
create policy "teacher_timetables_storage_insert" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'teacher-timetables' and split_part(name, '/', 1) = auth.uid()::text);

drop policy if exists "teacher_timetables_storage_update" on storage.objects;
create policy "teacher_timetables_storage_update" on storage.objects
    for update to authenticated
    using (bucket_id = 'teacher-timetables' and split_part(name, '/', 1) = auth.uid()::text)
    with check (bucket_id = 'teacher-timetables' and split_part(name, '/', 1) = auth.uid()::text);

drop policy if exists "teacher_timetables_storage_delete" on storage.objects;
create policy "teacher_timetables_storage_delete" on storage.objects
    for delete to authenticated
    using (bucket_id = 'teacher-timetables' and split_part(name, '/', 1) = auth.uid()::text);
