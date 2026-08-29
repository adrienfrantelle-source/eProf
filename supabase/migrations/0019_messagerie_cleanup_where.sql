-- Le DELETE sans WHERE est refusé (extension safeupdate / PostgREST).
-- On ne vide que l'historique antérieur au 31 juillet, pas les messages d'après.

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
