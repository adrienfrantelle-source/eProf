-- Vue d'ensemble admin (config profs), couleurs de classes partagées,
-- familles de jeux pédagogiques, édition/suppression des suggestions par l'auteur.

-- ---------- Couleur de classe (même teinte pour tous les enseignants) ----------
alter table public.school_classes
    add column if not exists couleur text;

-- Palette distincte pour les classes déjà présentes (ordre stable).
with numbered as (
    select id, row_number() over (order by ordre, nom) as n
    from public.school_classes
    where couleur is null
)
update public.school_classes sc
set couleur = (array[
    '#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2',
    '#db2777', '#65a30d', '#ea580c', '#4f46e5', '#0d9488', '#c026d3',
    '#ca8a04', '#0284c7', '#be123c', '#4338ca', '#166534', '#9a3412'
])[((numbered.n - 1) % 18) + 1]
from numbered
where sc.id = numbered.id;

-- ---------- Famille / dossier des jeux pédagogiques ----------
alter table public.pedagogical_games
    add column if not exists famille text not null default 'Général';

-- ---------- Suggestions : l'auteur peut modifier / supprimer les siennes ----------
drop policy if exists "suggestions_update_own" on public.suggestions;
create policy "suggestions_update_own" on public.suggestions
    for update to authenticated
    using (auteur_id = auth.uid())
    with check (auteur_id = auth.uid());

drop policy if exists "suggestions_delete_own" on public.suggestions;
create policy "suggestions_delete_own" on public.suggestions
    for delete to authenticated
    using (auteur_id = auth.uid());

create or replace function public.suggestions_protect_admin_fields()
returns trigger
language plpgsql
as $$
begin
    if public.is_admin() then
        return new;
    end if;
    if auth.uid() is distinct from old.auteur_id then
        raise exception 'Accès refusé';
    end if;
    new.statut := old.statut;
    new.reponse_admin := old.reponse_admin;
    new.auteur_id := old.auteur_id;
    return new;
end;
$$;

drop trigger if exists trg_suggestions_protect_admin_fields on public.suggestions;
create trigger trg_suggestions_protect_admin_fields
    before update on public.suggestions
    for each row execute function public.suggestions_protect_admin_fields();

-- ---------- Synthèse globale profs / classes / matières ----------
create or replace function public.admin_teachers_config_overview()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_enseignants jsonb;
    v_par_classe jsonb;
begin
    if not public.is_admin() then
        raise exception 'Accès refusé';
    end if;

    select coalesce(jsonb_agg(to_jsonb(x) order by x.identifiant), '[]'::jsonb)
    into v_enseignants
    from (
        select
            coalesce(nullif(split_part(coalesce(p.email, ''), '@', 1), ''), p.display_name) as identifiant,
            p.prenom,
            p.nom,
            p.matiere,
            coalesce(p.classes, '[]'::jsonb) as classes,
            coalesce(p.subjects_by_class, '{}'::jsonb) as subjects_by_class,
            coalesce(p.actif, true) as actif,
            coalesce(p.is_admin, false) as is_admin
        from public.profiles p
    ) x;

    select coalesce(jsonb_agg(to_jsonb(y) order by y.ordre, y.nom), '[]'::jsonb)
    into v_par_classe
    from (
        select
            c.nom,
            c.couleur,
            c.ordre,
            coalesce((
                select jsonb_agg(jsonb_build_object(
                    'identifiant', a.identifiant,
                    'matiere', a.matiere
                ) order by a.identifiant, a.matiere)
                from public.teacher_assignments a
                where a.classe = c.nom
            ), '[]'::jsonb) as affectations
        from public.school_classes c
        where c.actif
    ) y;

    return jsonb_build_object(
        'enseignants', v_enseignants,
        'par_classe', v_par_classe
    );
end;
$$;

grant execute on function public.admin_teachers_config_overview() to authenticated;
