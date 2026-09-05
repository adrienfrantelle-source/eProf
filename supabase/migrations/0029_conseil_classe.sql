-- ===== CONSEIL DE CLASSE (professeurs principaux) =====
-- Désignation PP par classe / année, lisible par l'enseignant concerné
-- et gérable aussi par l'administrateur. Les données de conseil (moyennes,
-- sanctions, appréciations) restent dans teacher_documents (doc_type conseil_classe).

create table if not exists public.class_principals (
    id uuid primary key default gen_random_uuid(),
    identifiant text not null,
    classe text not null,
    annee_scolaire text not null default '2026-2027',
    created_at timestamptz not null default now(),
    unique (identifiant, classe, annee_scolaire)
);

create index if not exists class_principals_identifiant_idx
    on public.class_principals (identifiant, annee_scolaire);

create index if not exists class_principals_classe_idx
    on public.class_principals (classe, annee_scolaire);

alter table public.class_principals enable row level security;

drop policy if exists "class_principals_read_own" on public.class_principals;
create policy "class_principals_read_own" on public.class_principals
    for select to authenticated
    using (identifiant = public.current_identifiant() or public.is_admin());

drop policy if exists "class_principals_write_own" on public.class_principals;
create policy "class_principals_write_own" on public.class_principals
    for all to authenticated
    using (identifiant = public.current_identifiant() or public.is_admin())
    with check (identifiant = public.current_identifiant() or public.is_admin());

-- Annuaire issu de la liste blanche (sanctions : nom du collègue).
create or replace function public.list_whitelist_teachers()
returns table (
    identifiant text,
    nom text,
    prenom text,
    matiere text
)
language sql
security definer
stable
set search_path = public
as $$
    select
        a.identifiant,
        coalesce(a.nom, ''),
        coalesce(a.prenom, ''),
        coalesce(a.matiere, '')
    from public.allowed_teachers a
    order by coalesce(nullif(trim(a.nom), ''), 'zzz'),
             coalesce(nullif(trim(a.prenom), ''), 'zzz'),
             a.identifiant;
$$;

grant execute on function public.list_whitelist_teachers() to authenticated;
