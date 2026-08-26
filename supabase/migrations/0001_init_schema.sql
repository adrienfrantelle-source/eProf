-- eProf online schema
-- One teacher = one Supabase Auth user (auth.users). Every table below is scoped
-- to the authenticated teacher via Row Level Security so teachers only ever see
-- and modify their own data.

create extension if not exists "pgcrypto";

-- ===== PROFILES (1 row per teacher, mirrors auth.users) =====
create table if not exists public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    email text,
    display_name text,
    matiere text,
    etablissement text,
    created_at timestamptz not null default now()
);

-- ===== CLASSES =====
create table if not exists public.classes (
    id uuid primary key default gen_random_uuid(),
    teacher_id uuid not null references public.profiles (id) on delete cascade,
    name text not null,
    school_year text not null default '2026-2027',
    created_at timestamptz not null default now(),
    unique (teacher_id, name, school_year)
);

-- ===== STUDENTS =====
create table if not exists public.students (
    id uuid primary key default gen_random_uuid(),
    class_id uuid not null references public.classes (id) on delete cascade,
    nom text not null,
    prenom text not null,
    sexe text check (sexe in ('F', 'M')),
    created_at timestamptz not null default now()
);

-- ===== EVALUATIONS (carnet de notes) =====
create table if not exists public.evaluations (
    id uuid primary key default gen_random_uuid(),
    class_id uuid not null references public.classes (id) on delete cascade,
    teacher_id uuid not null references public.profiles (id) on delete cascade,
    title text not null,
    subject text,
    eval_date date,
    max_points numeric not null default 20,
    coefficient numeric not null default 1,
    period text,
    created_at timestamptz not null default now()
);

-- ===== GRADES =====
create table if not exists public.grades (
    id uuid primary key default gen_random_uuid(),
    evaluation_id uuid not null references public.evaluations (id) on delete cascade,
    student_id uuid not null references public.students (id) on delete cascade,
    value numeric,
    is_absent boolean not null default false,
    created_at timestamptz not null default now(),
    unique (evaluation_id, student_id)
);

-- ===== CALENDAR EVENTS =====
create table if not exists public.calendar_events (
    id uuid primary key default gen_random_uuid(),
    teacher_id uuid not null references public.profiles (id) on delete cascade,
    title text not null,
    event_type text not null default 'event',
    lieu text,
    description text,
    start_at timestamptz not null,
    end_at timestamptz,
    all_day boolean not null default false,
    created_at timestamptz not null default now()
);

-- ===== SAVED CLASS PLANS (plan de classe) =====
create table if not exists public.class_plans (
    id uuid primary key default gen_random_uuid(),
    teacher_id uuid not null references public.profiles (id) on delete cascade,
    class_id uuid references public.classes (id) on delete set null,
    name text not null,
    data jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ===== PEDAGOGICAL GAMES LIBRARY =====
create table if not exists public.pedagogical_games (
    id uuid primary key default gen_random_uuid(),
    teacher_id uuid not null references public.profiles (id) on delete cascade,
    title text not null,
    url text not null,
    created_at timestamptz not null default now()
);

-- ===== updated_at trigger for class_plans =====
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists trg_class_plans_updated_at on public.class_plans;
create trigger trg_class_plans_updated_at
    before update on public.class_plans
    for each row execute function public.set_updated_at();

-- ===== auto-create a profile row when a teacher signs up =====
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
    insert into public.profiles (id, email, display_name)
    values (new.id, new.email, split_part(new.email, '@', 1))
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- ===== Row Level Security =====
alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.evaluations enable row level security;
alter table public.grades enable row level security;
alter table public.calendar_events enable row level security;
alter table public.class_plans enable row level security;
alter table public.pedagogical_games enable row level security;

-- profiles: a teacher can only read/update their own profile
create policy "profiles_select_own" on public.profiles
    for select using (id = auth.uid());
create policy "profiles_update_own" on public.profiles
    for update using (id = auth.uid());

-- classes: full CRUD scoped to owning teacher
create policy "classes_all_own" on public.classes
    for all using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

-- students: scoped via the parent class ownership
create policy "students_all_own" on public.students
    for all using (
        exists (
            select 1 from public.classes c
            where c.id = students.class_id and c.teacher_id = auth.uid()
        )
    ) with check (
        exists (
            select 1 from public.classes c
            where c.id = students.class_id and c.teacher_id = auth.uid()
        )
    );

-- evaluations: scoped to owning teacher
create policy "evaluations_all_own" on public.evaluations
    for all using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

-- grades: scoped via the parent evaluation ownership
create policy "grades_all_own" on public.grades
    for all using (
        exists (
            select 1 from public.evaluations e
            where e.id = grades.evaluation_id and e.teacher_id = auth.uid()
        )
    ) with check (
        exists (
            select 1 from public.evaluations e
            where e.id = grades.evaluation_id and e.teacher_id = auth.uid()
        )
    );

-- calendar_events: scoped to owning teacher
create policy "calendar_events_all_own" on public.calendar_events
    for all using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

-- class_plans: scoped to owning teacher
create policy "class_plans_all_own" on public.class_plans
    for all using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

-- pedagogical_games: scoped to owning teacher
create policy "pedagogical_games_all_own" on public.pedagogical_games
    for all using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
