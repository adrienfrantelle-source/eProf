-- Générique "document JSON par enseignant", utilisé pour les modules dont le
-- modèle de données n'est pas encore normalisé en tables relationnelles
-- (carnet de notes, suivi des élèves...). Un seul document par (teacher_id, doc_type).

create table if not exists public.teacher_documents (
    id uuid primary key default gen_random_uuid(),
    teacher_id uuid not null references public.profiles (id) on delete cascade,
    doc_type text not null,
    data jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now(),
    unique (teacher_id, doc_type)
);

drop trigger if exists trg_teacher_documents_updated_at on public.teacher_documents;
create trigger trg_teacher_documents_updated_at
    before update on public.teacher_documents
    for each row execute function public.set_updated_at();

alter table public.teacher_documents enable row level security;

create policy "teacher_documents_all_own" on public.teacher_documents
    for all using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
