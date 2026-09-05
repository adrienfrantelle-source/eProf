-- Enseignants d’une classe (affectations), lisibles par le PP de cette classe
-- et par l’administrateur. Sert à l’onglet « Retour des profs » du conseil.

create or replace function public.list_class_teachers(p_classe text, p_annee text default null)
returns table (
    identifiant text,
    nom text,
    prenom text,
    matiere text
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
    if p_classe is null or btrim(p_classe) = '' then
        return;
    end if;

    if not public.is_admin() and not exists (
        select 1
        from public.class_principals cp
        where cp.identifiant = public.current_identifiant()
          and cp.classe = p_classe
          and (coalesce(p_annee, '') = '' or cp.annee_scolaire = p_annee)
    ) then
        return;
    end if;

    return query
    select
        a.identifiant,
        coalesce(w.nom, ''),
        coalesce(w.prenom, ''),
        coalesce(a.matiere, '')
    from public.teacher_assignments a
    left join public.allowed_teachers w on w.identifiant = a.identifiant
    where a.classe = p_classe
      and (coalesce(p_annee, '') = '' or a.annee_scolaire = p_annee)
    order by coalesce(nullif(btrim(w.nom), ''), 'zzz'),
             coalesce(nullif(btrim(w.prenom), ''), 'zzz'),
             coalesce(a.matiere, ''),
             a.identifiant;
end;
$$;

grant execute on function public.list_class_teachers(text, text) to authenticated;
