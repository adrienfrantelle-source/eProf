-- ===== AGENDA DU PROFESSEUR =====
-- L'agenda réutilise volontairement la table calendar_events : ainsi tout élément
-- saisi dans l'agenda apparaît automatiquement dans le calendrier de l'application,
-- sans duplication ni synchronisation croisée à maintenir.

alter table public.calendar_events
    add column if not exists color text,
    add column if not exists emoji text,
    add column if not exists done boolean not null default false,
    add column if not exists reminder_minutes integer,
    add column if not exists source text not null default 'calendar';

create index if not exists calendar_events_teacher_source_idx
    on public.calendar_events (teacher_id, source, start_at);
