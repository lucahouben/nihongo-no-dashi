-- Migration: allow named decks to be either vocabulary or sentence decks.
--
-- sentence_decks is now the shared registry for every named deck. Existing rows
-- keep the default kind of 'sentences'. Vocabulary decks store their items in
-- public.vocabulary with vocabulary.deck_id pointing at the deck row. The
-- built-in vocabulary deck keeps deck_id as null.
--
-- Run this once in the Supabase SQL Editor after supabase/sql/sentences.sql
-- (or sentence_decks.sql for older installs).

alter table public.sentence_decks
    add column if not exists kind text not null default 'sentences'
    check (kind in ('vocabulary', 'sentences'));

alter table public.vocabulary
    add column if not exists deck_id uuid references public.sentence_decks(id) on delete cascade;

create index if not exists vocabulary_deck_id_idx on public.vocabulary (deck_id);

-- Deleting a named vocabulary deck removes its items through the cascade.
grant delete on public.vocabulary to anon;

drop policy if exists "Public can delete vocabulary" on public.vocabulary;
create policy "Public can delete vocabulary"
    on public.vocabulary for delete to anon using (true);
