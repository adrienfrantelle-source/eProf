-- ===== SUPERVISION DE LA PLATEFORME =====
-- Santé, logs applicatifs, journal des connexions, suivi des jobs, sauvegarde globale.

-- ---------- Logs applicatifs ----------
create table if not exists public.app_logs (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),
    level text not null default 'error',
    module text,
    message text not null,
    details jsonb not null default '{}'::jsonb,
    user_id uuid references auth.users (id) on delete set null,
    identifiant text,
    url text,
    user_agent text
);

create index if not exists app_logs_created_idx on public.app_logs (created_at desc);
create index if not exists app_logs_level_idx on public.app_logs (level, created_at desc);

alter table public.app_logs enable row level security;

-- Chaque utilisateur connecté peut déposer un log pour lui-même, seul l'admin les lit.
drop policy if exists "app_logs_insert_own" on public.app_logs;
create policy "app_logs_insert_own" on public.app_logs
    for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "app_logs_admin_select" on public.app_logs;
create policy "app_logs_admin_select" on public.app_logs
    for select to authenticated using (public.is_admin());

drop policy if exists "app_logs_admin_delete" on public.app_logs;
create policy "app_logs_admin_delete" on public.app_logs
    for delete to authenticated using (public.is_admin());

-- ---------- Suivi des jobs (sauvegardes, purges, imports) ----------
create table if not exists public.platform_jobs (
    id uuid primary key default gen_random_uuid(),
    job_type text not null,
    statut text not null default 'succes',
    started_at timestamptz not null default now(),
    finished_at timestamptz,
    declenche_par text,
    details jsonb not null default '{}'::jsonb
);

create index if not exists platform_jobs_started_idx on public.platform_jobs (started_at desc);

alter table public.platform_jobs enable row level security;

drop policy if exists "platform_jobs_admin_all" on public.platform_jobs;
create policy "platform_jobs_admin_all" on public.platform_jobs
    for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.record_platform_job(p_type text, p_statut text, p_details jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_id uuid;
begin
    if not public.is_admin() then
        raise exception 'Action réservée à l''administrateur.';
    end if;

    insert into public.platform_jobs (job_type, statut, finished_at, declenche_par, details)
    values (p_type, p_statut, now(),
            (select lower(split_part(email, '@', 1)) from auth.users where id = auth.uid()),
            coalesce(p_details, '{}'::jsonb))
    returning id into v_id;

    return v_id;
end;
$$;

grant execute on function public.record_platform_job(text, text, jsonb) to authenticated;

-- ---------- Tableau de bord santé ----------
create or replace function public.admin_platform_stats()
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

    select jsonb_build_object(
        'genere_le', now(),
        'comptes', jsonb_build_object(
            'total', (select count(*) from auth.users),
            'admins', (select count(*) from public.profiles where is_admin),
            'actifs_30j', (select count(*) from auth.users where last_sign_in_at > now() - interval '30 days'),
            'jamais_connectes', (select count(*) from auth.users where last_sign_in_at is null)
        ),
        'liste_blanche', jsonb_build_object(
            'total', (select count(*) from public.allowed_teachers),
            'inscrits', (select count(*) from public.allowed_teachers where is_registered)
        ),
        'donnees', jsonb_build_object(
            'classes', (select count(*) from public.classes),
            'eleves', (select count(*) from public.students),
            'evaluations', (select count(*) from public.evaluations),
            'notes', (select count(*) from public.grades),
            'evenements', (select count(*) from public.calendar_events),
            'agenda', (select count(*) from public.calendar_events where source = 'agenda'),
            'plans_de_classe', (select count(*) from public.class_plans),
            'jeux', (select count(*) from public.pedagogical_games),
            'documents', (select count(*) from public.teacher_documents)
        ),
        'erreurs', jsonb_build_object(
            'total', (select count(*) from public.app_logs),
            'dernieres_24h', (select count(*) from public.app_logs where created_at > now() - interval '24 hours' and level = 'error'),
            'derniers_7j', (select count(*) from public.app_logs where created_at > now() - interval '7 days' and level = 'error')
        ),
        'jobs', jsonb_build_object(
            'total', (select count(*) from public.platform_jobs),
            'derniere_sauvegarde', (select max(started_at) from public.platform_jobs where job_type = 'sauvegarde'),
            'derniere_purge', (select max(started_at) from public.platform_jobs where job_type = 'purge_rgpd'),
            'echecs_30j', (select count(*) from public.platform_jobs where statut <> 'succes' and started_at > now() - interval '30 days')
        ),
        'base', jsonb_build_object(
            'taille', pg_size_pretty(pg_database_size(current_database())),
            'version', version()
        )
    ) into v_result;

    return v_result;
end;
$$;

grant execute on function public.admin_platform_stats() to authenticated;

-- ---------- Journal des connexions (auth.audit_log_entries) ----------
create or replace function public.admin_list_auth_events(p_limit integer default 200)
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

    select coalesce(jsonb_agg(e order by e.created_at desc), '[]'::jsonb) into v_result
    from (
        select
            a.created_at,
            a.payload ->> 'action' as action,
            a.payload ->> 'actor_username' as acteur,
            a.payload -> 'traits' ->> 'provider' as fournisseur,
            a.ip_address::text as ip
        from auth.audit_log_entries a
        order by a.created_at desc
        limit greatest(1, least(coalesce(p_limit, 200), 1000))
    ) e;

    return v_result;
end;
$$;

grant execute on function public.admin_list_auth_events(integer) to authenticated;

-- ---------- Sauvegarde globale ----------
-- Export intégral au format JSON, déclenché manuellement depuis le panneau admin.
create or replace function public.admin_full_backup()
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

    select jsonb_build_object(
        'genere_le', now(),
        'version_schema', '0010',
        'comptes', coalesce((select jsonb_agg(jsonb_build_object('id', u.id, 'email', u.email, 'cree_le', u.created_at, 'derniere_connexion', u.last_sign_in_at)) from auth.users u), '[]'::jsonb),
        'profiles', coalesce((select jsonb_agg(to_jsonb(t)) from public.profiles t), '[]'::jsonb),
        'allowed_teachers', coalesce((select jsonb_agg(to_jsonb(t)) from public.allowed_teachers t), '[]'::jsonb),
        'classes', coalesce((select jsonb_agg(to_jsonb(t)) from public.classes t), '[]'::jsonb),
        'students', coalesce((select jsonb_agg(to_jsonb(t)) from public.students t), '[]'::jsonb),
        'evaluations', coalesce((select jsonb_agg(to_jsonb(t)) from public.evaluations t), '[]'::jsonb),
        'grades', coalesce((select jsonb_agg(to_jsonb(t)) from public.grades t), '[]'::jsonb),
        'calendar_events', coalesce((select jsonb_agg(to_jsonb(t)) from public.calendar_events t), '[]'::jsonb),
        'class_plans', coalesce((select jsonb_agg(to_jsonb(t)) from public.class_plans t), '[]'::jsonb),
        'pedagogical_games', coalesce((select jsonb_agg(to_jsonb(t)) from public.pedagogical_games t), '[]'::jsonb),
        'teacher_documents', coalesce((select jsonb_agg(to_jsonb(t)) from public.teacher_documents t), '[]'::jsonb),
        'gdpr_processing_records', coalesce((select jsonb_agg(to_jsonb(t)) from public.gdpr_processing_records t), '[]'::jsonb),
        'gdpr_consents', coalesce((select jsonb_agg(to_jsonb(t)) from public.gdpr_consents t), '[]'::jsonb),
        'gdpr_retention_policies', coalesce((select jsonb_agg(to_jsonb(t)) from public.gdpr_retention_policies t), '[]'::jsonb)
    ) into v_result;

    perform public.record_platform_job('sauvegarde', 'succes', jsonb_build_object(
        'profils', jsonb_array_length(v_result -> 'profiles'),
        'documents', jsonb_array_length(v_result -> 'teacher_documents'),
        'evenements', jsonb_array_length(v_result -> 'calendar_events')
    ));
    perform public.log_admin_action('sauvegarde_globale', null, jsonb_build_object('format', 'json'));

    return v_result;
end;
$$;

grant execute on function public.admin_full_backup() to authenticated;

-- ---------- Conservation des logs applicatifs ----------
insert into public.gdpr_retention_policies (cle, libelle, cible, duree_mois) values
    ('logs_applicatifs', 'Logs applicatifs (erreurs)', 'app_logs', 6),
    ('jobs_plateforme', 'Historique des jobs plateforme', 'platform_jobs', 12)
on conflict (cle) do nothing;

-- La purge doit connaître les nouvelles cibles.
create or replace function public.admin_run_retention_purge()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_policy record;
    v_count integer;
    v_result jsonb := '{}'::jsonb;
begin
    if not public.is_admin() then
        raise exception 'Action réservée à l''administrateur.';
    end if;

    for v_policy in select * from public.gdpr_retention_policies where actif loop
        v_count := 0;

        if v_policy.cible = 'calendar_events' then
            delete from public.calendar_events
            where start_at < now() - make_interval(months => v_policy.duree_mois);
            get diagnostics v_count = row_count;

        elsif v_policy.cible = 'class_plans' then
            delete from public.class_plans
            where updated_at < now() - make_interval(months => v_policy.duree_mois);
            get diagnostics v_count = row_count;

        elsif v_policy.cible = 'admin_audit_log' then
            delete from public.admin_audit_log
            where created_at < now() - make_interval(months => v_policy.duree_mois);
            get diagnostics v_count = row_count;

        elsif v_policy.cible = 'app_logs' then
            delete from public.app_logs
            where created_at < now() - make_interval(months => v_policy.duree_mois);
            get diagnostics v_count = row_count;

        elsif v_policy.cible = 'platform_jobs' then
            delete from public.platform_jobs
            where started_at < now() - make_interval(months => v_policy.duree_mois);
            get diagnostics v_count = row_count;

        elsif v_policy.cible = 'teacher_documents' then
            -- Données élèves : on vide le contenu sans casser la ligne de synchronisation
            update public.teacher_documents set data = '{}'::jsonb
            where updated_at < now() - make_interval(months => v_policy.duree_mois)
              and data <> '{}'::jsonb;
            get diagnostics v_count = row_count;

        else
            -- 'auth_audit' et cibles non gérées : purge assurée par Supabase lui-même
            continue;
        end if;

        update public.gdpr_retention_policies
        set derniere_purge = now(), derniers_supprimes = v_count
        where cle = v_policy.cle;

        v_result := v_result || jsonb_build_object(v_policy.cle, v_count);
    end loop;

    perform public.record_platform_job('purge_rgpd', 'succes', v_result);
    perform public.log_admin_action('purge_retention', null, v_result);
    return v_result;
end;
$$;

grant execute on function public.admin_run_retention_purge() to authenticated;
