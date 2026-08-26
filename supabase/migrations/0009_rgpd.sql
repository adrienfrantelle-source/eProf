-- ===== CONFORMITÉ RGPD + JOURNAL D'AUDIT ADMIN =====
-- Couvre les personnes concernées : enseignants (comptes) et élèves (données
-- nominatives présentes dans teacher_documents / students).

-- ---------- Journal des actions d'administration (audit trail) ----------
create table if not exists public.admin_audit_log (
    id uuid primary key default gen_random_uuid(),
    actor_id uuid references auth.users (id) on delete set null,
    actor_identifiant text,
    action text not null,
    target text,
    details jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_created_idx on public.admin_audit_log (created_at desc);

alter table public.admin_audit_log enable row level security;

drop policy if exists "admin_audit_log_admin_select" on public.admin_audit_log;
create policy "admin_audit_log_admin_select" on public.admin_audit_log
    for select to authenticated using (public.is_admin());

-- L'écriture passe uniquement par la fonction ci-dessous : un admin ne peut pas
-- forger ni modifier une entrée du journal depuis le client.
create or replace function public.log_admin_action(p_action text, p_target text default null, p_details jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.is_admin() then
        raise exception 'Action réservée à l''administrateur.';
    end if;

    insert into public.admin_audit_log (actor_id, actor_identifiant, action, target, details)
    values (
        auth.uid(),
        (select lower(split_part(email, '@', 1)) from auth.users where id = auth.uid()),
        p_action,
        p_target,
        coalesce(p_details, '{}'::jsonb)
    );
end;
$$;

grant execute on function public.log_admin_action(text, text, jsonb) to authenticated;

-- ---------- Registre des traitements ----------
create table if not exists public.gdpr_processing_records (
    id uuid primary key default gen_random_uuid(),
    nom text not null,
    finalite text,
    base_legale text,
    personnes_concernees text,
    categories_donnees text,
    destinataires text,
    duree_conservation text,
    mesures_securite text,
    responsable text,
    actif boolean not null default true,
    updated_at timestamptz not null default now()
);

drop trigger if exists trg_gdpr_processing_updated_at on public.gdpr_processing_records;
create trigger trg_gdpr_processing_updated_at
    before update on public.gdpr_processing_records
    for each row execute function public.set_updated_at();

alter table public.gdpr_processing_records enable row level security;

drop policy if exists "gdpr_processing_admin_all" on public.gdpr_processing_records;
create policy "gdpr_processing_admin_all" on public.gdpr_processing_records
    for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- Consentements ----------
create table if not exists public.gdpr_consents (
    id uuid primary key default gen_random_uuid(),
    personne_type text not null default 'eleve',
    personne_ref text not null,
    classe text,
    finalite text not null,
    base_legale text,
    consenti boolean not null default false,
    date_consentement timestamptz,
    date_retrait timestamptz,
    note text,
    created_at timestamptz not null default now()
);

create index if not exists gdpr_consents_personne_idx on public.gdpr_consents (personne_type, personne_ref);

alter table public.gdpr_consents enable row level security;

drop policy if exists "gdpr_consents_admin_all" on public.gdpr_consents;
create policy "gdpr_consents_admin_all" on public.gdpr_consents
    for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- Durées de conservation ----------
create table if not exists public.gdpr_retention_policies (
    cle text primary key,
    libelle text not null,
    cible text not null,
    duree_mois integer not null,
    actif boolean not null default true,
    derniere_purge timestamptz,
    derniers_supprimes integer
);

alter table public.gdpr_retention_policies enable row level security;

drop policy if exists "gdpr_retention_admin_all" on public.gdpr_retention_policies;
create policy "gdpr_retention_admin_all" on public.gdpr_retention_policies
    for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.gdpr_retention_policies (cle, libelle, cible, duree_mois) values
    ('donnees_eleves',   'Données élèves (carnet de notes, suivi)', 'teacher_documents', 12),
    ('calendrier',       'Événements de calendrier et agenda',      'calendar_events',   24),
    ('plans_classe',     'Plans de classe',                         'class_plans',       24),
    ('audit_admin',      'Journal des actions d''administration',   'admin_audit_log',   12),
    ('journal_connexion','Journal des connexions',                  'auth_audit',         6)
on conflict (cle) do nothing;

-- ---------- Registre pré-rempli ----------
insert into public.gdpr_processing_records (nom, finalite, base_legale, personnes_concernees, categories_donnees, destinataires, duree_conservation, mesures_securite, responsable)
select * from (values
    ('Gestion des comptes enseignants',
     'Authentification et accès à la plateforme pédagogique',
     'Intérêt légitime de l''établissement (mission éducative)',
     'Enseignants',
     'Identifiant, nom, prénom, email professionnel, matière, classes',
     'Administrateur de la plateforme uniquement',
     '2 ans après le départ de l''enseignant',
     'Authentification Supabase, mots de passe hachés, RLS par utilisateur, HTTPS',
     'Lycée Jeanne Delanoue, Cholet'),
    ('Suivi pédagogique des élèves',
     'Saisie et calcul des notes, moyennes et suivi comportemental',
     'Mission d''intérêt public (suivi scolaire)',
     'Élèves',
     'Nom, prénom, classe, notes, appréciations, observations de suivi',
     'Enseignant propriétaire des données uniquement',
     '1 an après la fin de l''année scolaire',
     'Cloisonnement RLS par enseignant, chiffrement en transit et au repos',
     'Lycée Jeanne Delanoue, Cholet'),
    ('Organisation de l''enseignant (agenda, calendrier, plans de classe)',
     'Organisation personnelle du travail de l''enseignant',
     'Intérêt légitime',
     'Enseignants, élèves (prénoms sur les plans de classe)',
     'Titres d''événements, dates, notes libres, placement des élèves',
     'Enseignant propriétaire uniquement',
     '2 ans',
     'Cloisonnement RLS par enseignant',
     'Lycée Jeanne Delanoue, Cholet'),
    ('Journalisation des actions d''administration',
     'Traçabilité et sécurité de la plateforme',
     'Obligation légale (sécurité des traitements, art. 32 RGPD)',
     'Administrateur',
     'Identifiant admin, action réalisée, cible, horodatage',
     'Administrateur de la plateforme',
     '1 an',
     'Journal en écriture seule via fonction contrôlée, lecture réservée à l''admin',
     'Lycée Jeanne Delanoue, Cholet')
) as v(nom, finalite, base_legale, personnes_concernees, categories_donnees, destinataires, duree_conservation, mesures_securite, responsable)
where not exists (select 1 from public.gdpr_processing_records);

-- ---------- Droit d'accès : export complet des données d'un enseignant ----------
create or replace function public.admin_export_teacher_data(p_identifiant text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_identifiant text := lower(trim(p_identifiant));
    v_user_id uuid;
    v_result jsonb;
begin
    if not public.is_admin() then
        raise exception 'Action réservée à l''administrateur.';
    end if;

    select id into v_user_id from auth.users
    where lower(split_part(email, '@', 1)) = v_identifiant;

    if v_user_id is null then
        raise exception 'Aucun compte pour l''identifiant "%".', v_identifiant;
    end if;

    select jsonb_build_object(
        'genere_le', now(),
        'identifiant', v_identifiant,
        'compte', (select jsonb_build_object('id', u.id, 'email', u.email, 'cree_le', u.created_at, 'derniere_connexion', u.last_sign_in_at)
                   from auth.users u where u.id = v_user_id),
        'profil', (select to_jsonb(p) from public.profiles p where p.id = v_user_id),
        'liste_blanche', (select to_jsonb(a) from public.allowed_teachers a where a.identifiant = v_identifiant),
        'classes', coalesce((select jsonb_agg(to_jsonb(c)) from public.classes c where c.teacher_id = v_user_id), '[]'::jsonb),
        'eleves', coalesce((select jsonb_agg(to_jsonb(s)) from public.students s
                            join public.classes c on c.id = s.class_id where c.teacher_id = v_user_id), '[]'::jsonb),
        'evaluations', coalesce((select jsonb_agg(to_jsonb(e)) from public.evaluations e where e.teacher_id = v_user_id), '[]'::jsonb),
        'evenements', coalesce((select jsonb_agg(to_jsonb(ev)) from public.calendar_events ev where ev.teacher_id = v_user_id), '[]'::jsonb),
        'plans_de_classe', coalesce((select jsonb_agg(to_jsonb(cp)) from public.class_plans cp where cp.teacher_id = v_user_id), '[]'::jsonb),
        'jeux', coalesce((select jsonb_agg(to_jsonb(g)) from public.pedagogical_games g where g.teacher_id = v_user_id), '[]'::jsonb),
        'documents', coalesce((select jsonb_agg(to_jsonb(d)) from public.teacher_documents d where d.teacher_id = v_user_id), '[]'::jsonb)
    ) into v_result;

    perform public.log_admin_action('export_rgpd', v_identifiant, jsonb_build_object('motif', 'droit d''accès'));
    return v_result;
end;
$$;

grant execute on function public.admin_export_teacher_data(text) to authenticated;

-- ---------- Droit à l'oubli : anonymisation (le compte et l'historique restent) ----------
create or replace function public.admin_anonymize_teacher(p_identifiant text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_identifiant text := lower(trim(p_identifiant));
    v_user_id uuid;
    v_docs integer := 0;
    v_students integer := 0;
begin
    if not public.is_admin() then
        raise exception 'Action réservée à l''administrateur.';
    end if;

    select id into v_user_id from auth.users
    where lower(split_part(email, '@', 1)) = v_identifiant;

    if v_user_id is null then
        raise exception 'Aucun compte pour l''identifiant "%".', v_identifiant;
    end if;

    if v_user_id = auth.uid() then
        raise exception 'Impossible d''anonymiser son propre compte administrateur.';
    end if;

    update public.profiles
    set nom = 'Anonymisé', prenom = '', display_name = 'Compte anonymisé', email = null, matiere = null
    where id = v_user_id;

    -- Les documents contiennent des données nominatives d'élèves : ils sont vidés,
    -- l'anonymisation partielle d'un JSON libre n'offrirait aucune garantie.
    with vides as (
        update public.teacher_documents set data = '{}'::jsonb where teacher_id = v_user_id returning 1
    ) select count(*) into v_docs from vides;

    with anon as (
        update public.students s set nom = 'Anonymisé', prenom = ''
        from public.classes c where c.id = s.class_id and c.teacher_id = v_user_id returning 1
    ) select count(*) into v_students from anon;

    update public.calendar_events
    set title = 'Événement anonymisé', description = null, lieu = null
    where teacher_id = v_user_id;

    update public.class_plans set name = 'Plan anonymisé', data = '{}'::jsonb where teacher_id = v_user_id;

    perform public.log_admin_action('anonymisation_rgpd', v_identifiant,
        jsonb_build_object('documents_vides', v_docs, 'eleves_anonymises', v_students));

    return jsonb_build_object('documents_vides', v_docs, 'eleves_anonymises', v_students);
end;
$$;

grant execute on function public.admin_anonymize_teacher(text) to authenticated;

-- ---------- Purge selon les durées de conservation ----------
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

    perform public.log_admin_action('purge_retention', null, v_result);
    return v_result;
end;
$$;

grant execute on function public.admin_run_retention_purge() to authenticated;

-- ---------- Planification automatique (optionnel) ----------
-- Nécessite l'extension pg_cron (Database → Extensions). À exécuter séparément :
--
--   create extension if not exists pg_cron;
--   select cron.schedule('eprof-purge-rgpd', '0 3 1 * *', $$select public.admin_run_retention_purge()$$);
--
-- Note : appelée par pg_cron, la fonction s'exécute sans auth.uid() ; il faut
-- alors retirer le contrôle is_admin() ou créer une variante dédiée au cron.
