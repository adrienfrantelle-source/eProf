-- ===== ADMINISTRATION PÉDAGOGIQUE GLOBALE =====
-- Référentiels mutualisés à l'échelle de l'établissement : classes officielles,
-- affectations prof ↔ classe ↔ matière, périodes, compétences, modèles d'évaluation.
-- Lecture ouverte à tous les enseignants connectés, écriture réservée à l'admin.

-- ---------- Classes de l'établissement ----------
create table if not exists public.school_classes (
    id uuid primary key default gen_random_uuid(),
    nom text not null,
    niveau text,
    filiere text,
    annee_scolaire text not null default '2026-2027',
    periode_type text not null default 'trimestre' check (periode_type in ('trimestre', 'semestre')),
    nb_periodes integer not null default 3,
    effectif_prevu integer,
    actif boolean not null default true,
    ordre integer not null default 0,
    created_at timestamptz not null default now(),
    unique (nom, annee_scolaire)
);

alter table public.school_classes enable row level security;

drop policy if exists "school_classes_read_all" on public.school_classes;
create policy "school_classes_read_all" on public.school_classes
    for select to authenticated using (true);

drop policy if exists "school_classes_admin_write" on public.school_classes;
create policy "school_classes_admin_write" on public.school_classes
    for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Classes 2026-2027 (les 1ère et Tle sont en semestres, les autres en trimestres).
insert into public.school_classes (nom, niveau, filiere, periode_type, nb_periodes, ordre) values
    ('4e',            '4e',   null,    'trimestre', 3,  1),
    ('3e A',          '3e',   null,    'trimestre', 3,  2),
    ('3e B',          '3e',   null,    'trimestre', 3,  3),
    ('2nde SAPAT A',  '2nde', 'SAPAT', 'trimestre', 3,  4),
    ('2nde SAPAT B',  '2nde', 'SAPAT', 'trimestre', 3,  5),
    ('2nde SAPAT C',  '2nde', 'SAPAT', 'trimestre', 3,  6),
    ('2nde LCQ',      '2nde', 'LCQ',   'trimestre', 3,  7),
    ('1ère SAPAT A',  '1ère', 'SAPAT', 'semestre',  2,  8),
    ('1ère SAPAT B',  '1ère', 'SAPAT', 'semestre',  2,  9),
    ('1ère SAPAT C',  '1ère', 'SAPAT', 'semestre',  2, 10),
    ('1ère LCQ',      '1ère', 'LCQ',   'semestre',  2, 11),
    ('Tle SAPAT A',   'Tle',  'SAPAT', 'semestre',  2, 12),
    ('Tle SAPAT B',   'Tle',  'SAPAT', 'semestre',  2, 13),
    ('Tle LCQ',       'Tle',  'LCQ',   'semestre',  2, 14)
on conflict (nom, annee_scolaire) do nothing;

-- ---------- Matières de l'établissement ----------
create table if not exists public.school_subjects (
    id uuid primary key default gen_random_uuid(),
    nom text not null unique,
    couleur text,
    actif boolean not null default true,
    ordre integer not null default 0
);

alter table public.school_subjects enable row level security;

drop policy if exists "school_subjects_read_all" on public.school_subjects;
create policy "school_subjects_read_all" on public.school_subjects
    for select to authenticated using (true);

drop policy if exists "school_subjects_admin_write" on public.school_subjects;
create policy "school_subjects_admin_write" on public.school_subjects
    for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.school_subjects (nom, ordre)
select nom, row_number() over () from (values
    ('Anglais'), ('Biologie'), ('Direction'), ('EMC'), ('EPS'), ('ESC'), ('Espagnol'),
    ('Histoire-géographie'), ('Lettres'), ('Mathématiques'), ('MP5-10 HG'), ('MP8'),
    ('MP9-10'), ('Physique'), ('TIM'), ('TP')
) as v(nom)
on conflict (nom) do nothing;

-- ---------- Affectations prof ↔ classe ↔ matière ----------
create table if not exists public.teacher_assignments (
    id uuid primary key default gen_random_uuid(),
    identifiant text not null,
    classe text not null,
    matiere text not null,
    annee_scolaire text not null default '2026-2027',
    created_at timestamptz not null default now(),
    unique (identifiant, classe, matiere, annee_scolaire)
);

create index if not exists teacher_assignments_identifiant_idx on public.teacher_assignments (identifiant);

alter table public.teacher_assignments enable row level security;

-- Un enseignant voit ses propres affectations, l'admin voit et modifie tout.
drop policy if exists "teacher_assignments_read_own" on public.teacher_assignments;
create policy "teacher_assignments_read_own" on public.teacher_assignments
    for select to authenticated using (identifiant = public.current_identifiant() or public.is_admin());

drop policy if exists "teacher_assignments_admin_write" on public.teacher_assignments;
create policy "teacher_assignments_admin_write" on public.teacher_assignments
    for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- Référentiels de compétences mutualisés ----------
create table if not exists public.competency_frameworks (
    id uuid primary key default gen_random_uuid(),
    nom text not null,
    description text,
    niveau text,
    matiere text,
    actif boolean not null default true,
    created_at timestamptz not null default now()
);

create table if not exists public.competencies (
    id uuid primary key default gen_random_uuid(),
    framework_id uuid not null references public.competency_frameworks (id) on delete cascade,
    code text,
    libelle text not null,
    description text,
    ordre integer not null default 0
);

create index if not exists competencies_framework_idx on public.competencies (framework_id, ordre);

alter table public.competency_frameworks enable row level security;
alter table public.competencies enable row level security;

drop policy if exists "frameworks_read_all" on public.competency_frameworks;
create policy "frameworks_read_all" on public.competency_frameworks
    for select to authenticated using (true);
drop policy if exists "frameworks_admin_write" on public.competency_frameworks;
create policy "frameworks_admin_write" on public.competency_frameworks
    for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "competencies_read_all" on public.competencies;
create policy "competencies_read_all" on public.competencies
    for select to authenticated using (true);
drop policy if exists "competencies_admin_write" on public.competencies;
create policy "competencies_admin_write" on public.competencies
    for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- Modèles d'évaluations globaux ----------
create table if not exists public.evaluation_templates (
    id uuid primary key default gen_random_uuid(),
    nom text not null,
    type_evaluation text not null default 'devoir',
    matiere text,
    niveau text,
    bareme numeric not null default 20,
    coefficient numeric not null default 1,
    duree_minutes integer,
    description text,
    framework_id uuid references public.competency_frameworks (id) on delete set null,
    actif boolean not null default true,
    created_at timestamptz not null default now()
);

alter table public.evaluation_templates enable row level security;

drop policy if exists "evaluation_templates_read_all" on public.evaluation_templates;
create policy "evaluation_templates_read_all" on public.evaluation_templates
    for select to authenticated using (true);

drop policy if exists "evaluation_templates_admin_write" on public.evaluation_templates;
create policy "evaluation_templates_admin_write" on public.evaluation_templates
    for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.evaluation_templates (nom, type_evaluation, bareme, coefficient, duree_minutes, description)
select * from (values
    ('Devoir sur table',        'devoir',   20::numeric, 1::numeric, 55,  'Évaluation écrite en classe'),
    ('Devoir surveillé',        'ds',       20::numeric, 2::numeric, 110, 'Évaluation longue coefficient double'),
    ('Interrogation courte',    'interro',  10::numeric, 0.5::numeric, 15, 'Contrôle de connaissances rapide'),
    ('Oral',                    'oral',     20::numeric, 1::numeric, 15,  'Présentation orale évaluée'),
    ('Travaux pratiques',       'tp',       20::numeric, 1::numeric, 110, 'Évaluation pratique'),
    ('CCF',                     'ccf',      20::numeric, 2::numeric, null, 'Contrôle en cours de formation')
) as v(nom, type_evaluation, bareme, coefficient, duree_minutes, description)
where not exists (select 1 from public.evaluation_templates);

-- ---------- Vue synthétique "qui enseigne quoi" ----------
create or replace function public.admin_teaching_overview()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_result jsonb;
begin
    if not public.is_admin() then
        raise exception 'Action réservée à l''administrateur.';
    end if;

    select coalesce(jsonb_agg(x order by x.identifiant), '[]'::jsonb) into v_result
    from (
        select
            a.identifiant,
            coalesce(trim(concat_ws(' ', w.prenom, w.nom)), a.identifiant) as nom_complet,
            w.is_registered,
            count(*) as nb_affectations,
            jsonb_agg(distinct a.classe) as classes,
            jsonb_agg(distinct a.matiere) as matieres
        from public.teacher_assignments a
        left join public.allowed_teachers w on w.identifiant = a.identifiant
        group by a.identifiant, w.prenom, w.nom, w.is_registered
    ) x;

    return v_result;
end;
$$;

grant execute on function public.admin_teaching_overview() to authenticated;
