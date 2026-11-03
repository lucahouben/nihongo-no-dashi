# Nihongo no Dashi

A single-page Japanese vocabulary and sentence flashcard app with spaced repetition, a cyberpunk terminal interface, and a Tokyo Night-inspired theme. Decks and review schedules are stored in Supabase.

## Features

- Review the vocabulary deck or any of your named sentence decks from the dashboard. Every deck keeps its own items, due counts, stages, and review schedule.
- Create, rename, and delete sentence decks. The vocabulary deck stays as a single deck and is unchanged.
- Review each item in both directions: Japanese → English and English → Japanese. Vocabulary answers include kanji, reading, meaning, type, conjugation, and an example sentence; sentence answers show the full Japanese sentence and its translation.
- Review cards due for repetition, or practice all items or a selected memory stage without changing SRS data.
- Track vocabulary through five themed stages:

  | SRS level | Stage | Description |
  | --- | --- | --- |
  | 0–2 | `RAW_DATA` | Newly captured items undergoing initial review |
  | 3–4 | `DECODING` | Active memory formation and pattern recognition |
  | 5–6 | `CACHED` | Fast-recall short-term memory buffer |
  | 7–8 | `COMPILED` | Deeply integrated vocabulary |
  | 9+ | `FIRMWARE` | Permanently mastered / Read-Only Memory |

- Add words or sentences manually. Vocabulary capture supports dictionary auto-fill and example lookup powered by Jotoba. The `+` button adapts to the active deck; the sentence form also lets you pick which sentence deck receives the item, defaulting to the active one.
- View kanji readings, definitions, radicals, and stroke counts from the card prompt. The interface uses KanjiAPI and KanjiVG for these details.
- Play Japanese pronunciation with the browser's speech synthesis from the front of the card or the revealed answer (or press `V`). Sentence cards speak the full Japanese sentence.
- Switch between dark and light themes; the interface is responsive and includes accessible labels and tooltips.
- Add a word from a URL with `kanji`, `reading`, `meaning`, `type`, and `example` parameters. Missing reading, meaning, or type are looked up when possible; an example sentence is also searched for when one is not provided. URL quick-add always targets the vocabulary deck.

## Run the app

The app is a static `index.html` page and does not require a build step or package installation. Serve the project directory with any static web server, or deploy it to a static host such as GitHub Pages or Vercel. Use HTTPS so browser integrations and Supabase requests work as expected.

The page loads Supabase JS and fonts from external CDNs. Dictionary and kanji lookup features also require network access to their respective services.

## Supabase setup

The app reads and writes `public.vocabulary`, `public.sentence_decks`, and `public.sentences`. Create the vocabulary table in the Supabase SQL Editor:

```sql
create table public.vocabulary (
    id uuid primary key default gen_random_uuid(),
    kanji text not null,
    reading text not null,
    meaning text not null,
    type text not null default 'Unknown',
    conjugation text not null default '',
    sent text not null default '',
    level smallint not null default 0 check (level between 0 and 99),
    next_review timestamptz not null default now(),
    created_at timestamptz not null default now()
);

alter table public.vocabulary enable row level security;
grant select, insert, update on public.vocabulary to anon;

create policy "Public can read vocabulary"
    on public.vocabulary for select to anon using (true);
create policy "Public can add vocabulary"
    on public.vocabulary for insert to anon with check (true);
create policy "Public can update vocabulary"
    on public.vocabulary for update to anon using (true) with check (true);
```

Create the sentence deck tables with `supabase/sql/sentences.sql`, or run:

```sql
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
```

If you already created the original single `sentences` table, run `supabase/sql/sentence_decks.sql` instead. It adds `sentence_decks`, adds `sentences.deck_id`, and moves existing sentences into a deck named `Sentences`.

The app's Supabase URL and browser-safe publishable/anon key are configured in the constants near the top of the script in `index.html`. Never put a Supabase `service_role` key in browser code.

These example policies allow any visitor to read, add, update, and delete decks and sentences. This is suitable only for a public, shared dataset. For private data or user-specific collections, add Supabase Auth and restrict the Row Level Security policies before deployment. Deleting a sentence deck deletes its sentences through the `on delete cascade` foreign key.

The database column names must stay in sync with the `VOCAB_DECK`, `makeSentenceDeck`, and `DatabaseService` mappings in `index.html`. `next_review` is stored as a timestamp; the app converts it to milliseconds for review calculations and back to an ISO timestamp when saving.

## Spaced repetition

Each due session has two shuffled passes. In the first pass, each item is prompted in one randomly chosen direction; the second pass tests that same item in the opposite direction. This separates the prompts instead of showing an item's answer immediately before testing it in reverse:

1. Recall the English meaning from the Japanese word (or Japanese audio when audio mode is enabled).
2. Recall the Japanese word from its English meaning.
3. Reveal the answer, which includes the kanji, reading, meaning, word type, conjugation when present, and example.

An item advances one level only when both directions are marked correct. If either direction is marked incorrect, the level drops by one, stopping at level 0, after both prompts have been answered. The item remains in the due-session queue for another pair of prompts after the other queued prompts; a successful item leaves the queue. Practice sessions use the same two-pass prompts but do not save SRS changes. Existing levels, due dates, and the interval schedule are unchanged, so no database migration is needed.

This design applies two established learning principles: spaced review and retrieval practice. The evidence supports distributing retrieval over time, and each prompt direction exercises recall from a different cue. The cited research does not prescribe this exact two-prompt rule or the app's level schedule; the two-direction gate is a practical way to require success with both kinds of recall before increasing the shared item level.

- Cepeda et al. (2006), [Distributed practice in verbal recall tasks: A review and quantitative synthesis](https://doi.org/10.1037/0033-2909.132.3.354), *Psychological Bulletin*.
- Karpicke & Roediger (2008), [The critical importance of retrieval for learning](https://doi.org/10.1126/science.1152408), *Science*.

After a completed two-direction round in a due-card session, the next review time is calculated from the resulting level:

| Resulting level | Interval |
| --- | --- |
| 0 | Immediate |
| 1 | 4 hours |
| 2 | 8 hours |
| 3 | 1 day |
| 4 | 2 days |
| 5 | 1 week |
| 6 | 2 weeks |
| 7 | 30 days |
| 8 and above | About 116 days |

## Review controls

| Key or action | Function |
| --- | --- |
| Click or tap the card / **Space** | Reveal the answer |
| **1** | Mark correct |
| **2** | Mark incorrect |
| **F** | Show or hide example and conjugation details |
| **V** | Play the Japanese text (sentence decks speak the full sentence) |
| **Esc** | Exit the review session |
| Click or tap a kanji | Open kanji details |

The answer actions are available after revealing the card. Kanji details can also appear on hover with a mouse; click or tap to pin the details panel.
