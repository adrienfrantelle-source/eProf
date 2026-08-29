-- Un enseignant ne peut modifier ou supprimer sa suggestion
-- qu'avant le premier tri administrateur (statut = 'nouveau').

drop policy if exists "suggestions_update_own" on public.suggestions;
create policy "suggestions_update_own" on public.suggestions
    for update to authenticated
    using (auteur_id = auth.uid() and statut = 'nouveau')
    with check (auteur_id = auth.uid() and statut = 'nouveau');

drop policy if exists "suggestions_delete_own" on public.suggestions;
create policy "suggestions_delete_own" on public.suggestions
    for delete to authenticated
    using (auteur_id = auth.uid() and statut = 'nouveau');

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
    if old.statut is distinct from 'nouveau' then
        raise exception 'Cette demande a déjà été prise en charge et ne peut plus être modifiée.';
    end if;
    new.statut := old.statut;
    new.reponse_admin := old.reponse_admin;
    new.auteur_id := old.auteur_id;
    return new;
end;
$$;
