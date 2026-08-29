-- ===== MESSAGERIE INTERNE =====
-- Conversations (canaux) entre enseignants, messages texte + liens URL.
-- Pas de pièces jointes. Historique vidé chaque 31 juillet ; canaux inactifs
-- (aucun message depuis 6 mois) supprimés automatiquement.

-- ---------- Canaux ----------
create table if not exists public.message_channels (
    id uuid primary key default gen_random_uuid(),
    nom text not null,
    created_by uuid references auth.users (id) on delete set null,
    created_at timestamptz not null default now(),
    last_message_at timestamptz,
    updated_at timestamptz not null default now()
);

create index if not exists message_channels_last_msg_idx
    on public.message_channels (last_message_at);

drop trigger if exists trg_message_channels_updated on public.message_channels;
create trigger trg_message_channels_updated
    before update on public.message_channels
    for each row execute function public.set_updated_at();

alter table public.message_channels enable row level security;

-- ---------- Membres ----------
create table if not exists public.message_channel_members (
    channel_id uuid not null references public.message_channels (id) on delete cascade,
    user_id uuid not null references auth.users (id) on delete cascade,
    identifiant text,
    nom_affiche text,
    joined_at timestamptz not null default now(),
    last_read_at timestamptz,
    primary key (channel_id, user_id)
);

create index if not exists message_channel_members_user_idx
    on public.message_channel_members (user_id);

alter table public.message_channel_members enable row level security;

-- ---------- Messages ----------
create table if not exists public.message_messages (
    id uuid primary key default gen_random_uuid(),
    channel_id uuid not null references public.message_channels (id) on delete cascade,
    auteur_id uuid references auth.users (id) on delete set null,
    auteur_identifiant text,
    auteur_nom text,
    contenu text not null,
    created_at timestamptz not null default now()
);

create index if not exists message_messages_channel_idx
    on public.message_messages (channel_id, created_at);

alter table public.message_messages enable row level security;

-- ---------- Suivi du purge annuel ----------
create table if not exists public.messagerie_maintenance (
    id integer primary key default 1 check (id = 1),
    last_history_purge_on date
);

insert into public.messagerie_maintenance (id) values (1)
on conflict (id) do nothing;

alter table public.messagerie_maintenance enable row level security;

-- ---------- Helper d'appartenance (évite la récursion RLS) ----------
create or replace function public.is_message_channel_member(p_channel_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
    select exists (
        select 1 from public.message_channel_members
        where channel_id = p_channel_id and user_id = auth.uid()
    );
$$;

grant execute on function public.is_message_channel_member(uuid) to authenticated;

-- ---------- Policies ----------
drop policy if exists "message_channels_select_member" on public.message_channels;
create policy "message_channels_select_member" on public.message_channels
    for select to authenticated
    using (public.is_message_channel_member(id));

drop policy if exists "message_channels_update_member" on public.message_channels;
create policy "message_channels_update_member" on public.message_channels
    for update to authenticated
    using (public.is_message_channel_member(id))
    with check (public.is_message_channel_member(id));

drop policy if exists "message_channel_members_select" on public.message_channel_members;
create policy "message_channel_members_select" on public.message_channel_members
    for select to authenticated
    using (user_id = auth.uid() or public.is_message_channel_member(channel_id));

drop policy if exists "message_channel_members_update_own" on public.message_channel_members;
create policy "message_channel_members_update_own" on public.message_channel_members
    for update to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists "message_channel_members_delete_own" on public.message_channel_members;
create policy "message_channel_members_delete_own" on public.message_channel_members
    for delete to authenticated
    using (user_id = auth.uid());

drop policy if exists "message_messages_select_member" on public.message_messages;
create policy "message_messages_select_member" on public.message_messages
    for select to authenticated
    using (public.is_message_channel_member(channel_id));

-- ---------- Annuaire des collègues ----------
create or replace function public.list_teacher_directory()
returns table (
    id uuid,
    identifiant text,
    nom text,
    prenom text,
    matiere text
)
language sql
security definer
stable
set search_path = public
as $$
    select
        p.id,
        lower(split_part(coalesce(p.email, ''), '@', 1)),
        coalesce(p.nom, ''),
        coalesce(p.prenom, ''),
        coalesce(p.matiere, '')
    from public.profiles p
    where coalesce(p.actif, true)
    order by coalesce(nullif(trim(p.nom), ''), 'zzz'),
             coalesce(nullif(trim(p.prenom), ''), 'zzz'),
             2;
$$;

grant execute on function public.list_teacher_directory() to authenticated;

-- ---------- Libellé d'affichage ----------
create or replace function public.teacher_display_name(p_user_id uuid)
returns text
language sql
stable
set search_path = public
as $$
    select coalesce(
        nullif(trim(concat_ws(' ', nullif(trim(p.prenom), ''), nullif(trim(p.nom), ''))), ''),
        nullif(lower(split_part(coalesce(p.email, ''), '@', 1)), ''),
        'Enseignant'
    )
    from public.profiles p
    where p.id = p_user_id;
$$;

-- ---------- Création d'un canal ----------
create or replace function public.create_message_channel(p_nom text, p_member_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_id uuid;
    v_nom text;
    v_ids uuid[];
    v_uid uuid := auth.uid();
    v_member uuid;
    v_identifiant text;
    v_affiche text;
begin
    if v_uid is null then
        raise exception 'Non connecté.';
    end if;

    select array_agg(distinct x)
    into v_ids
    from unnest(coalesce(p_member_ids, '{}'::uuid[])) as x
    where x is not null;

    v_ids := coalesce(v_ids, '{}'::uuid[]) || v_uid;

    select array_agg(distinct x) into v_ids from unnest(v_ids) as x;

    if coalesce(array_length(v_ids, 1), 0) < 2 then
        raise exception 'Choisissez au moins un destinataire.';
    end if;

    if exists (
        select 1 from unnest(v_ids) as mid
        where not exists (
            select 1 from public.profiles p
            where p.id = mid and coalesce(p.actif, true)
        )
    ) then
        raise exception 'Un destinataire est introuvable ou inactif.';
    end if;

    v_nom := nullif(trim(coalesce(p_nom, '')), '');
    if v_nom is null then
        select string_agg(public.teacher_display_name(mid), ', ' order by public.teacher_display_name(mid))
        into v_nom
        from unnest(v_ids) as mid
        where mid <> v_uid;
    end if;
    if v_nom is null or v_nom = '' then
        v_nom := 'Conversation';
    end if;
    v_nom := left(v_nom, 80);

    insert into public.message_channels (nom, created_by)
    values (v_nom, v_uid)
    returning id into v_id;

    foreach v_member in array v_ids loop
        select
            lower(split_part(coalesce(p.email, ''), '@', 1)),
            public.teacher_display_name(p.id)
        into v_identifiant, v_affiche
        from public.profiles p
        where p.id = v_member;

        insert into public.message_channel_members (channel_id, user_id, identifiant, nom_affiche)
        values (v_id, v_member, v_identifiant, v_affiche);
    end loop;

    return v_id;
end;
$$;

grant execute on function public.create_message_channel(text, uuid[]) to authenticated;

-- ---------- Ajout de membres ----------
create or replace function public.add_message_channel_members(p_channel_id uuid, p_member_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_member uuid;
    v_identifiant text;
    v_affiche text;
begin
    if auth.uid() is null then
        raise exception 'Non connecté.';
    end if;
    if not public.is_message_channel_member(p_channel_id) then
        raise exception 'Vous ne faites pas partie de cette conversation.';
    end if;

    foreach v_member in array coalesce(p_member_ids, '{}'::uuid[]) loop
        if v_member is null then
            continue;
        end if;
        if not exists (
            select 1 from public.profiles p
            where p.id = v_member and coalesce(p.actif, true)
        ) then
            continue;
        end if;

        select
            lower(split_part(coalesce(p.email, ''), '@', 1)),
            public.teacher_display_name(p.id)
        into v_identifiant, v_affiche
        from public.profiles p
        where p.id = v_member;

        insert into public.message_channel_members (channel_id, user_id, identifiant, nom_affiche)
        values (p_channel_id, v_member, v_identifiant, v_affiche)
        on conflict (channel_id, user_id) do nothing;
    end loop;
end;
$$;

grant execute on function public.add_message_channel_members(uuid, uuid[]) to authenticated;

-- ---------- Envoi d'un message ----------
create or replace function public.send_channel_message(p_channel_id uuid, p_contenu text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_id uuid;
    v_uid uuid := auth.uid();
    v_texte text := trim(coalesce(p_contenu, ''));
    v_identifiant text;
    v_affiche text;
begin
    if v_uid is null then
        raise exception 'Non connecté.';
    end if;
    if not public.is_message_channel_member(p_channel_id) then
        raise exception 'Vous ne faites pas partie de cette conversation.';
    end if;
    if v_texte = '' then
        raise exception 'Le message est vide.';
    end if;
    if char_length(v_texte) > 4000 then
        raise exception 'Le message dépasse 4000 caractères.';
    end if;

    select
        lower(split_part(coalesce(p.email, ''), '@', 1)),
        public.teacher_display_name(p.id)
    into v_identifiant, v_affiche
    from public.profiles p
    where p.id = v_uid;

    insert into public.message_messages (channel_id, auteur_id, auteur_identifiant, auteur_nom, contenu)
    values (p_channel_id, v_uid, v_identifiant, v_affiche, v_texte)
    returning id into v_id;

    update public.message_channels
    set last_message_at = now()
    where id = p_channel_id;

    update public.message_channel_members
    set last_read_at = now()
    where channel_id = p_channel_id and user_id = v_uid;

    return v_id;
end;
$$;

grant execute on function public.send_channel_message(uuid, text) to authenticated;

-- ---------- Liste de mes conversations ----------
create or replace function public.list_my_message_channels()
returns table (
    id uuid,
    nom text,
    created_at timestamptz,
    last_message_at timestamptz,
    last_preview text,
    unread_count integer,
    membres jsonb
)
language sql
security definer
stable
set search_path = public
as $$
    select
        c.id,
        c.nom,
        c.created_at,
        c.last_message_at,
        (
            select left(m.contenu, 120)
            from public.message_messages m
            where m.channel_id = c.id
            order by m.created_at desc
            limit 1
        ) as last_preview,
        (
            select count(*)::integer
            from public.message_messages m
            where m.channel_id = c.id
              and m.auteur_id is distinct from auth.uid()
              and (me.last_read_at is null or m.created_at > me.last_read_at)
        ) as unread_count,
        (
            select coalesce(jsonb_agg(jsonb_build_object(
                'user_id', mb.user_id,
                'identifiant', mb.identifiant,
                'nom_affiche', mb.nom_affiche
            ) order by mb.nom_affiche), '[]'::jsonb)
            from public.message_channel_members mb
            where mb.channel_id = c.id
        ) as membres
    from public.message_channels c
    join public.message_channel_members me
      on me.channel_id = c.id and me.user_id = auth.uid()
    order by coalesce(c.last_message_at, c.created_at) desc;
$$;

grant execute on function public.list_my_message_channels() to authenticated;

-- ---------- Quitter un canal (supprimé s'il ne reste plus personne) ----------
create or replace function public.leave_message_channel(p_channel_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if auth.uid() is null then
        raise exception 'Non connecté.';
    end if;

    delete from public.message_channel_members
    where channel_id = p_channel_id and user_id = auth.uid();

    if not exists (
        select 1 from public.message_channel_members where channel_id = p_channel_id
    ) then
        delete from public.message_channels where id = p_channel_id;
    end if;
end;
$$;

grant execute on function public.leave_message_channel(uuid) to authenticated;

-- ---------- Nettoyage automatique ----------
-- 1) Au 31 juillet (et après, jusqu'à exécution) : on vide l'historique, on garde les canaux.
-- 2) Canaux sans message depuis 6 mois (ou jamais utilisés depuis leur création) : suppression.
create or replace function public.cleanup_messagerie()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_today date := (timezone('Europe/Paris', now()))::date;
    v_cutoff date;
    v_last date;
    v_messages integer := 0;
    v_canaux integer := 0;
begin
    if extract(month from v_today) > 7
       or (extract(month from v_today) = 7 and extract(day from v_today) >= 31) then
        v_cutoff := make_date(extract(year from v_today)::integer, 7, 31);
    else
        v_cutoff := make_date(extract(year from v_today)::integer - 1, 7, 31);
    end if;

    select last_history_purge_on into v_last
    from public.messagerie_maintenance
    where id = 1;

    if v_today >= v_cutoff and v_last is distinct from v_cutoff then
        delete from public.message_messages
        where created_at < ((v_cutoff + 1)::timestamp at time zone 'Europe/Paris');
        get diagnostics v_messages = row_count;
        update public.messagerie_maintenance
        set last_history_purge_on = v_cutoff
        where id = 1;
    end if;

    delete from public.message_channels
    where coalesce(last_message_at, created_at) < now() - interval '6 months';
    get diagnostics v_canaux = row_count;

    return jsonb_build_object(
        'messages_purged', v_messages,
        'channels_removed', v_canaux,
        'history_cutoff', v_cutoff
    );
end;
$$;

grant execute on function public.cleanup_messagerie() to authenticated;

-- Planification optionnelle (pg_cron) :
--   select cron.schedule('eprof-messagerie-cleanup', '20 3 * * *',
--       $$select public.cleanup_messagerie()$$);
