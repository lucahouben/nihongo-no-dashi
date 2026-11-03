-- Sentence decks and sentences for Nihongo no Dashi.
-- Run this in the Supabase SQL Editor before using sentence decks.
-- If you already created the original single sentences table, run
-- supabase/sql/sentence_decks.sql instead to migrate it in place.

create table public.sentence_decks (
    id uuid primary key default gen_random_uuid(),
    name text not null check (length(trim(name)) > 0),
    created_at timestamptz not null default now()
);

create unique index sentence_decks_name_idx on public.sentence_decks (lower(name));

create table public.sentences (
    id uuid primary key default gen_random_uuid(),
    deck_id uuid not null references public.sentence_decks(id) on delete cascade,
    sentence text not null,
    translation text not null,
    level smallint not null default 0 check (level between 0 and 99),
    next_review timestamptz not null default now(),
    created_at timestamptz not null default now()
);

create index sentences_deck_id_idx on public.sentences (deck_id);
create index sentences_next_review_idx on public.sentences (next_review);
create index sentences_created_at_idx on public.sentences (created_at);

-- Start with one deck so new installs have somewhere to add sentences.
insert into public.sentence_decks (name) values ('Sentences')
on conflict do nothing;

alter table public.sentence_decks enable row level security;
alter table public.sentences enable row level security;
grant select, insert, update, delete on public.sentence_decks to anon;
grant select, insert, update on public.sentences to anon;

create policy "Public can read sentence decks"
    on public.sentence_decks for select to anon using (true);
create policy "Public can add sentence decks"
    on public.sentence_decks for insert to anon with check (true);
create policy "Public can update sentence decks"
    on public.sentence_decks for update to anon using (true) with check (true);
create policy "Public can delete sentence decks"
    on public.sentence_decks for delete to anon using (true);

create policy "Public can read sentences"
    on public.sentences for select to anon using (true);
create policy "Public can add sentences"
    on public.sentences for insert to anon with check (true);
create policy "Public can update sentences"
    on public.sentences for update to anon using (true) with check (true);

-- Optional bulk import example for a specific deck:
-- insert into public.sentences (deck_id, sentence, translation)
-- values (
--     (select id from public.sentence_decks where lower(name) = lower('Sentences')),
--     '日本語の文です。',
--     'This is a Japanese sentence.'
-- );
