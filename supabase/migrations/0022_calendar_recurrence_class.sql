-- Récurrence d'emploi du temps, classe associée, horaires de série.

alter table public.calendar_events
    add column if not exists class_name text,
    add column if not exists days_of_week integer[],
    add column if not exists start_recur date,
    add column if not exists end_recur date,
    add column if not exists start_time text,
    add column if not exists end_time text;

create index if not exists calendar_events_teacher_class_idx
    on public.calendar_events (teacher_id, class_name);
