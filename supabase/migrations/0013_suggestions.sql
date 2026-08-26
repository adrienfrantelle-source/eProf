-- ===== SUGGESTIONS ET SIGNALEMENTS DE BUGS =====
-- Ouvert à tous les enseignants connectés ; l'administrateur les traite sous
-- forme de todolist dans son panneau.

create table if not exists public.suggestions (
    id uuid primary key default gen_random_uuid(),
    type text not null default 'amelioration' check (type in ('amelioration', 'bug', 'nouveaute', 'autre')),
    titre text not null,
    description text not null,
    module text,
    priorite text not null default 'normale' check (priorite in ('basse', 'normale', 'haute', 'critique')),
    statut text not null default 'nouveau' check (statut in ('nouveau', 'en_cours', 'planifie', 'termine', 'refuse')),
    reponse_admin text,
    auteur_id uuid references auth.users (id) on delete set null,
    auteur_identifiant text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists suggestions_statut_idx on public.suggestions (statut, created_at desc);

drop trigger if exists trg_suggestions_updated_at on public.suggestions;
create trigger trg_suggestions_updated_at
    before update on public.suggestions
    for each row execute function public.set_updated_at();

alter table public.suggestions enable row level security;

-- Chacun dépose ses propres suggestions et suit leur avancement ; l'admin voit tout.
drop policy if exists "suggestions_insert_own" on public.suggestions;
create policy "suggestions_insert_own" on public.suggestions
    for insert to authenticated with check (auteur_id = auth.uid());

drop policy if exists "suggestions_select" on public.suggestions;
create policy "suggestions_select" on public.suggestions
    for select to authenticated using (auteur_id = auth.uid() or public.is_admin());

drop policy if exists "suggestions_admin_update" on public.suggestions;
create policy "suggestions_admin_update" on public.suggestions
    for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "suggestions_admin_delete" on public.suggestions;
create policy "suggestions_admin_delete" on public.suggestions
    for delete to authenticated using (public.is_admin());

-- ---------- Votes (une même demande peut être soutenue par plusieurs profs) ----------
create table if not exists public.suggestion_votes (
    suggestion_id uuid not null references public.suggestions (id) on delete cascade,
    user_id uuid not null references auth.users (id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (suggestion_id, user_id)
);

alter table public.suggestion_votes enable row level security;

drop policy if exists "suggestion_votes_insert_own" on public.suggestion_votes;
create policy "suggestion_votes_insert_own" on public.suggestion_votes
    for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "suggestion_votes_delete_own" on public.suggestion_votes;
create policy "suggestion_votes_delete_own" on public.suggestion_votes
    for delete to authenticated using (user_id = auth.uid());

drop policy if exists "suggestion_votes_select" on public.suggestion_votes;
create policy "suggestion_votes_select" on public.suggestion_votes
    for select to authenticated using (true);

-- ---------- Synthèse pour le panneau d'administration ----------
create or replace function public.admin_suggestions_board()
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

    select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) into v_result
    from (
        select s.*, (select count(*) from public.suggestion_votes v where v.suggestion_id = s.id) as votes
        from public.suggestions s
    ) x;

    return v_result;
end;
$$;

grant execute on function public.admin_suggestions_board() to authenticated;

insert into public.gdpr_retention_policies (cle, libelle, cible, duree_mois) values
    ('suggestions', 'Suggestions traitées ou refusées', 'suggestions', 24)
on conflict (cle) do nothing;

-- Purge d'une cible donnée : chaque table a sa propre règle d'ancienneté.
-- Isolé ici pour que la purge globale n'ait plus à être réécrite à chaque
-- nouvelle table ajoutée au produit.
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
        v_count := public.purge_retention_target(v_policy.cible, v_policy.duree_mois);

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
