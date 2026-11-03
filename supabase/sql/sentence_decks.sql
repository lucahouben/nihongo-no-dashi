-- Migration: turn the single sentences deck into named sentence decks.
-- Run this once in the Supabase SQL Editor if you already ran the original
-- supabase/sql/sentences.sql. Existing sentences are moved into a deck named
-- "Sentences". New installs can run supabase/sql/sentences.sql instead.

create table if not exists public.sentence_decks (
    id uuid primary key default gen_random_uuid(),
    name text not null check (length(trim(name)) > 0),
    created_at timestamptz not null default now()
);

create unique index if not exists sentence_decks_name_idx
    on public.sentence_decks (lower(name));

insert into public.sentence_decks (name) values ('Sentences')
on conflict do nothing;

alter table public.sentences
    add column if not exists deck_id uuid references public.sentence_decks(id) on delete cascade;

update public.sentences
set deck_id = (
    select id from public.sentence_decks
    where lower(name) = lower('Sentences')
    limit 1
)
where deck_id is null;

alter table public.sentences alter column deck_id set not null;

create index if not exists sentences_deck_id_idx on public.sentences (deck_id);

alter table public.sentence_decks enable row level security;

grant select, insert, update, delete on public.sentence_decks to anon;

drop policy if exists "Public can read sentence decks" on public.sentence_decks;
create policy "Public can read sentence decks"
    on public.sentence_decks for select to anon using (true);

drop policy if exists "Public can add sentence decks" on public.sentence_decks;
create policy "Public can add sentence decks"
    on public.sentence_decks for insert to anon with check (true);

drop policy if exists "Public can update sentence decks" on public.sentence_decks;
create policy "Public can update sentence decks"
    on public.sentence_decks for update to anon using (true) with check (true);

drop policy if exists "Public can delete sentence decks" on public.sentence_decks;
create policy "Public can delete sentence decks"
    on public.sentence_decks for delete to anon using (true);
