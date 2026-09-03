-- Photos de trombinoscope (import PDF Pronote par l'administrateur).
-- Lecture : tout enseignant connecté. Écriture : administrateur uniquement.

alter table public.school_students
    add column if not exists photo_path text;

insert into storage.buckets (id, name, public)
values ('student-photos', 'student-photos', false)
on conflict (id) do nothing;

drop policy if exists "student_photos_storage_read" on storage.objects;
create policy "student_photos_storage_read" on storage.objects
    for select to authenticated
    using (bucket_id = 'student-photos');

drop policy if exists "student_photos_storage_insert" on storage.objects;
create policy "student_photos_storage_insert" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'student-photos' and public.is_admin());

drop policy if exists "student_photos_storage_update" on storage.objects;
create policy "student_photos_storage_update" on storage.objects
    for update to authenticated
    using (bucket_id = 'student-photos' and public.is_admin())
    with check (bucket_id = 'student-photos' and public.is_admin());

drop policy if exists "student_photos_storage_delete" on storage.objects;
create policy "student_photos_storage_delete" on storage.objects
    for delete to authenticated
    using (bucket_id = 'student-photos' and public.is_admin());
