-- Dates exclues d'une série récurrente (séance supprimée ou détachée).

alter table public.calendar_events
    add column if not exists exclude_dates date[];
