-- ===== LISTES D'ÉLÈVES DE L'ÉTABLISSEMENT =====
-- Listes officielles de l'année en cours, administrées par l'admin et lues par
-- tous les enseignants (carnet de notes, plan de classe, trombinoscopes...).

create table if not exists public.school_students (
    id uuid primary key default gen_random_uuid(),
    nom text not null,
    prenom text not null,
    sexe text check (sexe in ('F', 'M')),
    classe text not null,
    annee_scolaire text not null default '2026-2027',
    date_naissance date,
    notes text,
    created_at timestamptz not null default now(),
    unique (nom, prenom, classe, annee_scolaire)
);

create index if not exists school_students_classe_idx on public.school_students (annee_scolaire, classe, nom);

alter table public.school_students enable row level security;

drop policy if exists "school_students_read_all" on public.school_students;
create policy "school_students_read_all" on public.school_students
    for select to authenticated using (true);

drop policy if exists "school_students_admin_write" on public.school_students;
create policy "school_students_admin_write" on public.school_students
    for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Remplacement complet de la liste d'une classe (import CSV) en une transaction.
create or replace function public.admin_replace_class_students(
    p_classe text,
    p_annee text,
    p_eleves jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    v_count integer;
begin
    if not public.is_admin() then
        raise exception 'Action réservée à l''administrateur.';
    end if;

    delete from public.school_students
    where classe = p_classe and annee_scolaire = p_annee;

    insert into public.school_students (nom, prenom, sexe, classe, annee_scolaire)
    select
        upper(trim(e ->> 'nom')),
        trim(e ->> 'prenom'),
        nullif(upper(trim(coalesce(e ->> 'sexe', ''))), ''),
        p_classe,
        p_annee
    from jsonb_array_elements(p_eleves) as e
    where nullif(trim(e ->> 'nom'), '') is not null
    on conflict (nom, prenom, classe, annee_scolaire) do nothing;

    get diagnostics v_count = row_count;

    perform public.log_admin_action('import_liste_eleves', p_classe,
        jsonb_build_object('annee', p_annee, 'eleves', v_count));

    return v_count;
end;
$$;

grant execute on function public.admin_replace_class_students(text, text, jsonb) to authenticated;

-- ===== GESTION DES COMPTES =====
-- Le blocage réel d'un compte se fait via l'API Auth (endpoint Vercel) ; ce
-- drapeau permet en plus de refuser l'accès applicatif et de l'afficher.
alter table public.profiles
    add column if not exists actif boolean not null default true;

create or replace function public.admin_list_accounts()
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
            lower(split_part(u.email, '@', 1)) as identifiant,
            u.id as user_id,
            u.email,
            u.created_at,
            u.last_sign_in_at,
            (u.email_confirmed_at is not null) as email_confirme,
            (u.banned_until is not null and u.banned_until > now()) as bloque,
            coalesce(p.is_admin, false) as is_admin,
            coalesce(p.actif, true) as actif,
            p.nom,
            p.prenom,
            p.matiere
        from auth.users u
        left join public.profiles p on p.id = u.id
    ) x;

    return v_result;
end;
$$;

grant execute on function public.admin_list_accounts() to authenticated;

-- Activation / désactivation applicative d'un compte.
create or replace function public.admin_set_account_active(p_identifiant text, p_actif boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid;
begin
    if not public.is_admin() then
        raise exception 'Action réservée à l''administrateur.';
    end if;

    select id into v_user_id from auth.users
    where lower(split_part(email, '@', 1)) = lower(trim(p_identifiant));

    if v_user_id is null then
        raise exception 'Aucun compte pour cet identifiant.';
    end if;
    if v_user_id = auth.uid() then
        raise exception 'Impossible de désactiver son propre compte administrateur.';
    end if;

    update public.profiles set actif = p_actif where id = v_user_id;
    perform public.log_admin_action(case when p_actif then 'compte_reactive' else 'compte_desactive' end, p_identifiant, '{}'::jsonb);
end;
$$;

grant execute on function public.admin_set_account_active(text, boolean) to authenticated;

-- Accorder ou retirer le rôle administrateur.
create or replace function public.admin_set_admin_role(p_identifiant text, p_is_admin boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid;
begin
    if not public.is_admin() then
        raise exception 'Action réservée à l''administrateur.';
    end if;

    select id into v_user_id from auth.users
    where lower(split_part(email, '@', 1)) = lower(trim(p_identifiant));

    if v_user_id is null then
        raise exception 'Aucun compte pour cet identifiant.';
    end if;
    if v_user_id = auth.uid() and not p_is_admin then
        raise exception 'Impossible de retirer son propre rôle administrateur.';
    end if;

    update public.profiles set is_admin = p_is_admin where id = v_user_id;
    perform public.log_admin_action(case when p_is_admin then 'role_admin_accorde' else 'role_admin_retire' end, p_identifiant, '{}'::jsonb);
end;
$$;

grant execute on function public.admin_set_admin_role(text, boolean) to authenticated;

-- Un compte désactivé ne doit plus accéder à ses données.
create or replace function public.is_account_active()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
    select coalesce((select p.actif from public.profiles p where p.id = auth.uid()), true);
$$;

grant execute on function public.is_account_active() to authenticated;

insert into public.gdpr_retention_policies (cle, libelle, cible, duree_mois) values
    ('listes_eleves', 'Listes d''élèves des années révolues', 'school_students', 24)
on conflict (cle) do nothing;

-- Prise en charge de la nouvelle cible par la purge RGPD.
create or replace function public.purge_retention_target(p_cible text, p_mois integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    v_count integer := 0;
begin
    if p_cible = 'calendar_events' then
        delete from public.calendar_events where start_at < now() - make_interval(months => p_mois);
    elsif p_cible = 'class_plans' then
        delete from public.class_plans where updated_at < now() - make_interval(months => p_mois);
    elsif p_cible = 'admin_audit_log' then
        delete from public.admin_audit_log where created_at < now() - make_interval(months => p_mois);
    elsif p_cible = 'app_logs' then
        delete from public.app_logs where created_at < now() - make_interval(months => p_mois);
    elsif p_cible = 'platform_jobs' then
        delete from public.platform_jobs where started_at < now() - make_interval(months => p_mois);
    elsif p_cible = 'announcements' then
        delete from public.announcements
        where created_at < now() - make_interval(months => p_mois)
          and (date_fin is null or date_fin < now());
    elsif p_cible = 'content_reports' then
        delete from public.content_reports
        where statut <> 'ouvert' and created_at < now() - make_interval(months => p_mois);
    elsif p_cible = 'suggestions' then
        delete from public.suggestions
        where statut in ('termine', 'refuse') and updated_at < now() - make_interval(months => p_mois);
    elsif p_cible = 'school_students' then
        delete from public.school_students
        where created_at < now() - make_interval(months => p_mois);
    elsif p_cible = 'teacher_documents' then
        -- Données élèves : on vide le contenu sans casser la ligne de synchronisation
        update public.teacher_documents set data = '{}'::jsonb
        where updated_at < now() - make_interval(months => p_mois) and data <> '{}'::jsonb;
    else
        -- 'auth_audit' et cibles non gérées : purge assurée par Supabase lui-même
        return 0;
    end if;

    get diagnostics v_count = row_count;
    return v_count;
end;
$$;
