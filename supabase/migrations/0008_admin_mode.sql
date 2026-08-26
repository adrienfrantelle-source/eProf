-- ===== MODE ADMINISTRATEUR =====
-- Un administrateur (profiles.is_admin = true) peut gérer la liste blanche
-- d'auto-inscription depuis l'interface du site.

alter table public.profiles
    add column if not exists is_admin boolean not null default false;

-- SECURITY DEFINER : contourne le RLS de profiles pour éviter toute récursion de policy.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
    select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

grant execute on function public.is_admin() to authenticated;

-- Promotion de l'administrateur (par identifiant, la partie avant @ de l'email).
update public.profiles set is_admin = true
where id in (
    select id from auth.users where lower(split_part(email, '@', 1)) = 'adfrantelle'
);

-- Le compte admin est promu automatiquement même s'il est créé après cette migration.
create or replace function public.promote_admin_on_profile_insert()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
    if lower(split_part(coalesce(new.email, ''), '@', 1)) = 'adfrantelle' then
        new.is_admin := true;
    end if;
    return new;
end;
$$;

drop trigger if exists promote_admin_on_profile_insert on public.profiles;
create trigger promote_admin_on_profile_insert
    before insert on public.profiles
    for each row execute function public.promote_admin_on_profile_insert();

-- ===== Accès administrateur à la liste blanche =====
drop policy if exists "allowed_teachers_admin_select" on public.allowed_teachers;
drop policy if exists "allowed_teachers_admin_insert" on public.allowed_teachers;
drop policy if exists "allowed_teachers_admin_update" on public.allowed_teachers;
drop policy if exists "allowed_teachers_admin_delete" on public.allowed_teachers;

create policy "allowed_teachers_admin_select" on public.allowed_teachers
    for select to authenticated using (public.is_admin());
create policy "allowed_teachers_admin_insert" on public.allowed_teachers
    for insert to authenticated with check (public.is_admin());
create policy "allowed_teachers_admin_update" on public.allowed_teachers
    for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "allowed_teachers_admin_delete" on public.allowed_teachers
    for delete to authenticated using (public.is_admin());

-- Suppression complète d'un compte enseignant : supprime l'utilisateur Auth
-- (cascade sur profiles et toutes ses données) et libère son identifiant.
create or replace function public.admin_delete_teacher_account(p_identifiant text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_identifiant text := lower(trim(p_identifiant));
    v_user_id uuid;
begin
    if not public.is_admin() then
        raise exception 'Action réservée à l''administrateur.';
    end if;

    select id into v_user_id from auth.users
    where lower(split_part(email, '@', 1)) = v_identifiant;

    if v_user_id = auth.uid() then
        raise exception 'Impossible de supprimer son propre compte administrateur.';
    end if;

    if v_user_id is not null then
        delete from auth.users where id = v_user_id;
    end if;

    update public.allowed_teachers
    set is_registered = false
    where identifiant = v_identifiant;
end;
$$;

grant execute on function public.admin_delete_teacher_account(text) to authenticated;
