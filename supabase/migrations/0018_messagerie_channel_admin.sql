-- Configuration des canaux : suppression, retrait de membres, auteur exposé.

create or replace function public.list_my_message_channels()
returns table (
    id uuid,
    nom text,
    created_by uuid,
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
        c.created_by,
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

create or replace function public.remove_message_channel_members(p_channel_id uuid, p_member_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if auth.uid() is null then
        raise exception 'Non connecté.';
    end if;
    if not public.is_message_channel_member(p_channel_id) then
        raise exception 'Vous ne faites pas partie de cette conversation.';
    end if;

    delete from public.message_channel_members
    where channel_id = p_channel_id
      and user_id = any (coalesce(p_member_ids, '{}'::uuid[]))
      and user_id is distinct from auth.uid();

    if not exists (
        select 1 from public.message_channel_members where channel_id = p_channel_id
    ) then
        delete from public.message_channels where id = p_channel_id;
    end if;
end;
$$;

grant execute on function public.remove_message_channel_members(uuid, uuid[]) to authenticated;

create or replace function public.delete_message_channel(p_channel_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if auth.uid() is null then
        raise exception 'Non connecté.';
    end if;
    if not public.is_message_channel_member(p_channel_id) then
        raise exception 'Vous ne faites pas partie de cette conversation.';
    end if;

    delete from public.message_channels where id = p_channel_id;
end;
$$;

grant execute on function public.delete_message_channel(uuid) to authenticated;
