-- Photos d'identité (suivent l'élève au changement de classe), lecture des
-- consentements photo par les enseignants, purge Storage des portraits.

-- Clé normalisée (sans accents) pour apparier listes CSV et photos Pronote.
create or replace function public.fold_person_name(p text)
returns text
language sql
immutable
as $$
    select upper(trim(both from regexp_replace(
        translate(
            coalesce(p, ''),
            'àáâãäåçèéêëìíîïñòóôõöùúûüýÿÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝ''’',
            'aaaaaaceeeeiiiinooooouuuuyyAAAAAACEEEEIIIINOOOOOUUUUY'
        ),
        '\s+', ' ', 'g'
    )));
$$;

-- Registre des portraits par identité (année + nom + prénom), hors classe.
create table if not exists public.school_student_photos (
    annee_scolaire text not null,
    nom_key text not null,
    prenom_key text not null,
    photo_path text not null,
    updated_at timestamptz not null default now(),
    primary key (annee_scolaire, nom_key, prenom_key)
);

alter table public.school_student_photos enable row level security;

drop policy if exists "school_student_photos_read" on public.school_student_photos;
create policy "school_student_photos_read" on public.school_student_photos
    for select to authenticated using (true);

drop policy if exists "school_student_photos_admin_write" on public.school_student_photos;
create policy "school_student_photos_admin_write" on public.school_student_photos
    for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.restore_student_photo_from_registry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_homonyms integer;
    v_path text;
begin
    if new.photo_path is not null and btrim(new.photo_path) <> '' then
        return new;
    end if;

    select count(*) into v_homonyms
    from public.school_students s
    where s.annee_scolaire = new.annee_scolaire
      and public.fold_person_name(s.nom) = public.fold_person_name(new.nom)
      and public.fold_person_name(s.prenom) = public.fold_person_name(new.prenom);

    -- Un autre élève du même nom existe déjà : homonyme possible, ne pas coller la photo.
    if v_homonyms >= 1 then
        return new;
    end if;

    select p.photo_path into v_path
    from public.school_student_photos p
    where p.annee_scolaire = new.annee_scolaire
      and p.nom_key = public.fold_person_name(new.nom)
      and p.prenom_key = public.fold_person_name(new.prenom);

    if v_path is not null then
        new.photo_path := v_path;
    end if;
    return new;
end;
$$;

drop trigger if exists school_students_restore_photo on public.school_students;
create trigger school_students_restore_photo
    before insert on public.school_students
    for each row
    execute function public.restore_student_photo_from_registry();

-- L'admin pose une photo : registre + toutes les fiches de la même identité
-- (sauf homonymes : uniquement la fiche ciblée).
create or replace function public.admin_set_student_photo(p_student_id uuid, p_photo_path text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    v_nom text;
    v_prenom text;
    v_annee text;
    v_nom_key text;
    v_prenom_key text;
    v_homonyms integer;
    v_count integer := 0;
begin
    if not public.is_admin() then
        raise exception 'Action réservée à l''administrateur.';
    end if;

    select nom, prenom, annee_scolaire into v_nom, v_prenom, v_annee
    from public.school_students
    where id = p_student_id;

    if v_nom is null then
        raise exception 'Élève introuvable.';
    end if;

    v_nom_key := public.fold_person_name(v_nom);
    v_prenom_key := public.fold_person_name(v_prenom);

    select count(*) into v_homonyms
    from public.school_students
    where annee_scolaire = v_annee
      and public.fold_person_name(nom) = v_nom_key
      and public.fold_person_name(prenom) = v_prenom_key;

    if v_homonyms <= 1 then
        insert into public.school_student_photos (annee_scolaire, nom_key, prenom_key, photo_path, updated_at)
        values (v_annee, v_nom_key, v_prenom_key, p_photo_path, now())
        on conflict (annee_scolaire, nom_key, prenom_key)
        do update set photo_path = excluded.photo_path, updated_at = now();

        update public.school_students
        set photo_path = p_photo_path
        where annee_scolaire = v_annee
          and public.fold_person_name(nom) = v_nom_key
          and public.fold_person_name(prenom) = v_prenom_key;
        get diagnostics v_count = row_count;
    else
        update public.school_students
        set photo_path = p_photo_path
        where id = p_student_id;
        get diagnostics v_count = row_count;
    end if;

    return v_count;
end;
$$;

grant execute on function public.admin_set_student_photo(uuid, text) to authenticated;

-- Remplacement CSV : la photo est restaurée par le trigger BEFORE INSERT.
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

    -- Restaurer la photo d'identité si un seul élève porte ce nom cette année
    -- (changement de classe) ; si deux lignes (ancien + nouveau groupe), copier
    -- depuis la fiche qui a encore un portrait.
    update public.school_students s
    set photo_path = p.photo_path
    from public.school_student_photos p
    where s.classe = p_classe
      and s.annee_scolaire = p_annee
      and (s.photo_path is null or btrim(s.photo_path) = '')
      and p.annee_scolaire = p_annee
      and p.nom_key = public.fold_person_name(s.nom)
      and p.prenom_key = public.fold_person_name(s.prenom)
      and (
          select count(*) from public.school_students x
          where x.annee_scolaire = s.annee_scolaire
            and public.fold_person_name(x.nom) = public.fold_person_name(s.nom)
            and public.fold_person_name(x.prenom) = public.fold_person_name(s.prenom)
      ) = 1;

    update public.school_students s
    set photo_path = sib.photo_path
    from public.school_students sib
    where s.classe = p_classe
      and s.annee_scolaire = p_annee
      and (s.photo_path is null or btrim(s.photo_path) = '')
      and sib.annee_scolaire = s.annee_scolaire
      and sib.id <> s.id
      and public.fold_person_name(sib.nom) = public.fold_person_name(s.nom)
      and public.fold_person_name(sib.prenom) = public.fold_person_name(s.prenom)
      and sib.photo_path is not null
      and (
          select count(*) from public.school_students x
          where x.annee_scolaire = s.annee_scolaire
            and public.fold_person_name(x.nom) = public.fold_person_name(s.nom)
            and public.fold_person_name(x.prenom) = public.fold_person_name(s.prenom)
      ) = 2;

    perform public.log_admin_action('import_liste_eleves', p_classe,
        jsonb_build_object('annee', p_annee, 'eleves', v_count));

    return v_count;
end;
$$;

grant execute on function public.admin_replace_class_students(text, text, jsonb) to authenticated;

-- Reprendre les portraits déjà liés aux fiches pour qu'ils survivent au prochain CSV.
insert into public.school_student_photos (annee_scolaire, nom_key, prenom_key, photo_path, updated_at)
select distinct on (annee_scolaire, public.fold_person_name(nom), public.fold_person_name(prenom))
    annee_scolaire,
    public.fold_person_name(nom),
    public.fold_person_name(prenom),
    photo_path,
    now()
from public.school_students
where photo_path is not null and btrim(photo_path) <> ''
order by annee_scolaire, public.fold_person_name(nom), public.fold_person_name(prenom), created_at desc
on conflict do nothing;

-- Enseignants : lecture des consentements (masquer une photo retirée).
-- L'écriture reste réservée à l'administrateur.
drop policy if exists "gdpr_consents_read_auth" on public.gdpr_consents;
create policy "gdpr_consents_read_auth" on public.gdpr_consents
    for select to authenticated using (true);

insert into public.gdpr_retention_policies (cle, libelle, cible, duree_mois) values
    ('photos_eleves', 'Photos de trombinoscope (fichiers Storage)', 'student_photos', 24)
on conflict (cle) do nothing;

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
    elsif p_cible = 'student_photos' then
        delete from storage.objects
        where bucket_id = 'student-photos'
          and created_at < now() - make_interval(months => p_mois);
        get diagnostics v_count = row_count;
        delete from public.school_student_photos
        where updated_at < now() - make_interval(months => p_mois);
        return v_count;
    elsif p_cible = 'teacher_documents' then
        update public.teacher_documents set data = '{}'::jsonb
        where updated_at < now() - make_interval(months => p_mois) and data <> '{}'::jsonb;
    else
        return 0;
    end if;

    get diagnostics v_count = row_count;
    return v_count;
end;
$$;
