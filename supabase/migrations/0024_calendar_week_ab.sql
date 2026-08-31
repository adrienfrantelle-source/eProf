-- Semaine A (paire) / B (impaire) pour les séries récurrentes.

alter table public.calendar_events
    add column if not exists week_ab text;
