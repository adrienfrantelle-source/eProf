-- Auto-inscription enseignants restreinte à une liste blanche fournie par l'admin.
-- L'admin ajoute les identifiants autorisés via le SQL Editor (bypass RLS avec le
-- rôle postgres/service_role), par exemple :
--   insert into public.allowed_teachers (identifiant, nom, prenom, matiere)
--   values ('anboulord', 'Boulord', 'Anne', 'Mathématiques');

create table if not exists public.allowed_teachers (
    identifiant text primary key,
    nom text,
    prenom text,
    matiere text,
    is_registered boolean not null default false,
    created_at timestamptz not null default now()
);

-- RLS activé sans aucune policy : totalement invisible/inaccessible en anon ou
-- authenticated, sauf via les fonctions SECURITY DEFINER ci-dessous (ou le rôle
-- postgres/service_role, utilisé par le SQL Editor et les scripts d'admin).
alter table public.allowed_teachers enable row level security;

-- Vérification rapide côté client avant de tenter une inscription (retourne un
-- simple booléen, ne fuite jamais la liste complète des identifiants).
create or replace function public.is_identifiant_available(p_identifiant text)
returns boolean
language sql
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.allowed_teachers
        where identifiant = lower(trim(p_identifiant))
          and is_registered = false
    );
$$;

grant execute on function public.is_identifiant_available(text) to anon, authenticated;

-- Remplace le trigger de création de profil : refuse l'inscription si
-- l'identifiant ne figure pas dans la liste blanche ou a déjà été utilisé,
-- puis marque l'identifiant comme consommé et pré-remplit le profil.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
    v_identifiant text := lower(split_part(new.email, '@', 1));
    v_allowed public.allowed_teachers%rowtype;
begin
    select * into v_allowed
    from public.allowed_teachers
    where identifiant = v_identifiant
      and is_registered = false
    for update;

    if not found then
        raise exception 'Identifiant "%" non autorisé ou déjà utilisé.', v_identifiant;
    end if;

    update public.allowed_teachers
    set is_registered = true
    where identifiant = v_identifiant;

    insert into public.profiles (id, email, display_name, nom, prenom, matiere)
    values (
        new.id,
        new.email,
        coalesce(nullif(trim(concat_ws(' ', v_allowed.prenom, v_allowed.nom)), ''), v_identifiant),
        v_allowed.nom,
        v_allowed.prenom,
        v_allowed.matiere
    )
    on conflict (id) do nothing;

    return new;
end;
$$;
