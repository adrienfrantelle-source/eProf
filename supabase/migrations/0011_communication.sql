-- ===== COMMUNICATION INSTITUTIONNELLE =====
-- Annonces diffusées dans l'application (globales ou ciblées), modèles de
-- notification, accusés de lecture et modération des contenus signalés.

-- Identifiant de l'utilisateur courant, réutilisé par les policies de ciblage.
create or replace function public.current_identifiant()
returns text
language sql
security definer
stable
set search_path = public
as $$
    select lower(split_part(email, '@', 1)) from auth.users where id = auth.uid();
$$;

grant execute on function public.current_identifiant() to authenticated;

-- ---------- Annonces ----------
create table if not exists public.announcements (
    id uuid primary key default gen_random_uuid(),
    titre text not null,
    message text not null,
    niveau text not null default 'info' check (niveau in ('info', 'important', 'urgent')),
    cible_type text not null default 'tous' check (cible_type in ('tous', 'identifiants', 'matieres')),
    cible_valeurs text[] not null default '{}',
    epingle boolean not null default false,
    actif boolean not null default true,
    date_debut timestamptz not null default now(),
    date_fin timestamptz,
    lien_url text,
    lien_libelle text,
    auteur_id uuid references auth.users (id) on delete set null,
    auteur_identifiant text,
    created_at timestamptz not null default now()
);

create index if not exists announcements_actif_idx on public.announcements (actif, date_debut desc);

alter table public.announcements enable row level security;

drop policy if exists "announcements_read_targeted" on public.announcements;
create policy "announcements_read_targeted" on public.announcements
    for select to authenticated using (
        public.is_admin()
        or (
            actif
            and date_debut <= now()
            and (date_fin is null or date_fin >= now())
            and (
                cible_type = 'tous'
                or (cible_type = 'identifiants' and public.current_identifiant() = any (cible_valeurs))
                or (cible_type = 'matieres' and exists (
                        select 1 from public.profiles p
                        where p.id = auth.uid() and p.matiere = any (cible_valeurs)
                    ))
            )
        )
    );

drop policy if exists "announcements_admin_write" on public.announcements;
create policy "announcements_admin_write" on public.announcements
    for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- Accusés de lecture ----------
create table if not exists public.announcement_reads (
    announcement_id uuid not null references public.announcements (id) on delete cascade,
    user_id uuid not null references auth.users (id) on delete cascade,
    identifiant text,
    read_at timestamptz not null default now(),
    primary key (announcement_id, user_id)
);

alter table public.announcement_reads enable row level security;

drop policy if exists "announcement_reads_insert_own" on public.announcement_reads;
create policy "announcement_reads_insert_own" on public.announcement_reads
    for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "announcement_reads_select" on public.announcement_reads;
create policy "announcement_reads_select" on public.announcement_reads
    for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- ---------- Modèles de notification ----------
create table if not exists public.notification_templates (
    id uuid primary key default gen_random_uuid(),
    nom text not null,
    niveau text not null default 'info',
    titre text not null,
    corps text not null,
    description text,
    created_at timestamptz not null default now()
);

alter table public.notification_templates enable row level security;

drop policy if exists "notification_templates_admin_all" on public.notification_templates;
create policy "notification_templates_admin_all" on public.notification_templates
    for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.notification_templates (nom, niveau, titre, corps, description)
select * from (values
    ('Maintenance planifiée', 'important', 'Maintenance de eProf le {date}',
     'Bonjour,' || chr(10) || chr(10) || 'eProf sera indisponible le {date} de {heure_debut} à {heure_fin} pour maintenance. Pensez à sauvegarder vos données en ligne avant cette échéance.' || chr(10) || chr(10) || 'Merci de votre compréhension.',
     'Variables : {date}, {heure_debut}, {heure_fin}'),
    ('Rappel de saisie des notes', 'important', 'Saisie des notes avant le {date}',
     'Bonjour,' || chr(10) || chr(10) || 'La saisie des notes du {periode} doit être terminée avant le {date}. Pensez à cliquer sur « Sauvegarder en ligne » dans le carnet de notes.' || chr(10) || chr(10) || 'Merci.',
     'Variables : {periode}, {date}'),
    ('Nouvelle fonctionnalité', 'info', '{fonctionnalite} est disponible',
     'Bonjour,' || chr(10) || chr(10) || 'La fonctionnalité « {fonctionnalite} » est désormais accessible dans eProf. {details}' || chr(10) || chr(10) || 'Bonne utilisation !',
     'Variables : {fonctionnalite}, {details}'),
    ('Alerte urgente', 'urgent', '{objet}',
     '{message}',
     'Message libre à diffusion immédiate. Variables : {objet}, {message}')
) as v(nom, niveau, titre, corps, description)
where not exists (select 1 from public.notification_templates);

-- ---------- Modération des contenus signalés ----------
create table if not exists public.content_reports (
    id uuid primary key default gen_random_uuid(),
    contenu_type text not null,
    contenu_ref text not null,
    extrait text,
    motif text not null,
    commentaire text,
    statut text not null default 'ouvert' check (statut in ('ouvert', 'traite', 'rejete')),
    note_admin text,
    reporter_id uuid references auth.users (id) on delete set null,
    reporter_identifiant text,
    created_at timestamptz not null default now(),
    traite_at timestamptz
);

create index if not exists content_reports_statut_idx on public.content_reports (statut, created_at desc);

alter table public.content_reports enable row level security;

drop policy if exists "content_reports_insert_own" on public.content_reports;
create policy "content_reports_insert_own" on public.content_reports
    for insert to authenticated with check (reporter_id = auth.uid());

drop policy if exists "content_reports_select" on public.content_reports;
create policy "content_reports_select" on public.content_reports
    for select to authenticated using (reporter_id = auth.uid() or public.is_admin());

drop policy if exists "content_reports_admin_write" on public.content_reports;
create policy "content_reports_admin_write" on public.content_reports
    for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "content_reports_admin_delete" on public.content_reports;
create policy "content_reports_admin_delete" on public.content_reports
    for delete to authenticated using (public.is_admin());

-- ---------- Statistiques de diffusion ----------
create or replace function public.admin_announcement_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_result jsonb;
    v_destinataires integer;
begin
    if not public.is_admin() then
        raise exception 'Action réservée à l''administrateur.';
    end if;

    select count(*) into v_destinataires from auth.users;

    select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) into v_result
    from (
        select
            a.id, a.titre, a.niveau, a.cible_type, a.cible_valeurs, a.actif,
            a.date_debut, a.date_fin, a.created_at, a.auteur_identifiant,
            (select count(*) from public.announcement_reads r where r.announcement_id = a.id) as lectures,
            case when a.cible_type = 'identifiants'
                 then array_length(a.cible_valeurs, 1)
                 else v_destinataires
            end as destinataires
        from public.announcements a
    ) x;

    return v_result;
end;
$$;

grant execute on function public.admin_announcement_stats() to authenticated;

-- ---------- Conservation ----------
insert into public.gdpr_retention_policies (cle, libelle, cible, duree_mois) values
    ('annonces', 'Annonces institutionnelles expirées', 'announcements', 24),
    ('signalements', 'Signalements de contenus traités', 'content_reports', 24)
on conflict (cle) do nothing;

-- La purge doit connaître les cibles de communication.
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

        elsif v_policy.cible = 'announcements' then
            delete from public.announcements
            where created_at < now() - make_interval(months => v_policy.duree_mois)
              and (date_fin is null or date_fin < now());
            get diagnostics v_count = row_count;

        elsif v_policy.cible = 'content_reports' then
            delete from public.content_reports
            where statut <> 'ouvert'
              and created_at < now() - make_interval(months => v_policy.duree_mois);
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
