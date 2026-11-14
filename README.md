# Nihongo no Dashi

A single-page Japanese vocabulary and sentence flashcard app with spaced repetition, a cyberpunk terminal interface, and a Tokyo Night-inspired theme. Decks and review schedules are stored in Supabase.

## Features

- Review the built-in vocabulary deck or any of your named vocabulary or sentence decks from the dashboard. Every deck keeps its own items, due counts, stages, and review schedule.
- Create, rename, and delete named decks. A new deck can be a vocabulary deck with the full set of word fields or a sentence deck with a Japanese sentence and translation. The built-in vocabulary deck stays as the default deck.
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

- Add words or sentences manually. Vocabulary capture supports dictionary auto-fill and example lookup powered by Jotoba. The `+` button adapts to the active deck; the capture form lets you pick which vocabulary or sentence deck receives the item, defaulting to the active one.
- View kanji readings, definitions, radicals, and stroke counts from the card prompt. The interface uses KanjiAPI and KanjiVG for these details.
- Play Japanese pronunciation with the browser's speech synthesis from the front of the card or the revealed answer (or press `V`). Sentence cards speak the full Japanese sentence.
- Switch between dark and light themes; the interface is responsive and includes accessible labels and tooltips.
- Add a word from a URL with `kanji`, `reading`, `meaning`, `type`, and `example` parameters. Missing reading, meaning, or type are looked up when possible; an example sentence is also searched for when one is not provided. URL quick-add always targets the vocabulary deck.
- Open `BETA_EMULINGO` from the dashboard to load a local GBA ROM into an isolated EmulatorJS player. ROMs are read in the browser and never uploaded, while battery saves and browser save states sync automatically across devices via Supabase for the same ROM. Use `TRANSLATE_SCREEN` to send a paused frame to the Gemini-backed `translate-screen` function, review the Japanese text and English translation, and add suggested vocabulary or dialogue lines to a chosen deck.

## Run the app

The app is a static `index.html` page and does not require a build step or package installation. Serve the project directory with any static web server, or deploy it to a static host such as GitHub Pages or Vercel. Use HTTPS so browser integrations and Supabase requests work as expected.

The page loads Supabase JS and fonts from external CDNs. Dictionary and kanji lookup features also require network access to their respective services.

## Emulingo beta

`BETA_EMULINGO` opens a GBA player powered by [EmulatorJS](https://emulatorjs.org/). The emulator runtime and cores load from `cdn.emulatorjs.org` on first use, so this mode needs network access. Choose a `.gba`, `.agb`, or `.zip` ROM from your device; the ROM is read in the browser and is not uploaded.

Battery saves and browser save states (slots 1–9 and quick save/load) are cached in the browser's IndexedDB and synced automatically to Supabase (`public.emulingo_saves`, compressed and keyed by the ROM hash) so you can continue on another device by loading the same ROM file. `SAVE_AND_CLOSE` and `EJECT_ROM` also flush the current save before leaving, and offline saves upload on the next online session. Save-file import/export is available from the in-emulator menu. The emulator runs in an isolated same-origin iframe so it does not interfere with the flashcard app.

`TRANSLATE_SCREEN` pauses the game, captures the emulator canvas at 2× resolution, and sends the frame to the `translate-screen` Edge Function. The panel shows the detected Japanese, an English translation, a reading, and optional notes, plus suggested vocabulary and dialogue lines. Each candidate has a deck selector and an `ADD` button: vocabulary goes to a vocabulary deck and sentences go to a sentence deck. Closing the panel resumes the game. Capture is always user-triggered; nothing is extracted automatically.

## Supabase setup

The app reads and writes `public.vocabulary`, `public.sentence_decks`, `public.sentences`, and `public.emulingo_saves`. Create the vocabulary table in the Supabase SQL Editor:

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

Then run `supabase/sql/named_decks.sql`. It adds `sentence_decks.kind` so the shared deck registry can hold both vocabulary and sentence decks, adds `vocabulary.deck_id` for items in named vocabulary decks, and allows deleting a named vocabulary deck and its items. Items in the built-in vocabulary deck have `deck_id = null`.

For Emulingo cross-device save sync, run `supabase/sql/emulingo_saves.sql`. It creates `public.emulingo_saves` for compressed battery saves (`srm`) and browser save states (`state:1`–`state:9`) keyed by the ROM hash.

The app's Supabase URL and browser-safe publishable/anon key are configured in the constants near the top of the script in `index.html`. Never put a Supabase `service_role` key in browser code.

These example policies allow any visitor to read, add, update, and delete decks, sentences, and vocabulary items. This is suitable only for a public, shared dataset. For private data or user-specific collections, add Supabase Auth and restrict the Row Level Security policies before deployment. Deleting a named deck deletes its items through the `on delete cascade` foreign key.

The database column names must stay in sync with the `VOCAB_DECK`, `makeVocabDeck`, `makeSentenceDeck`, and `DatabaseService` mappings in `index.html`. `sentence_decks.kind` is either `vocabulary` or `sentences`. `next_review` is stored as a timestamp; the app converts it to milliseconds for review calculations and back to an ISO timestamp when saving.

## Screen translation setup

`TRANSLATE_SCREEN` is backed by `supabase/functions/translate-screen`, which sends the captured frame to Gemini. The function reads `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) from the project's Edge Function secrets and is deployed without JWT verification because the browser app does not sign users in.

```sh
supabase secrets set GEMINI_API_KEY=...
supabase functions deploy translate-screen --no-verify-jwt
```

Set `VISION_MODEL` to pin a specific Gemini vision model. Otherwise the function tries the listed `gemini-*-flash` models in order and retries when a model is unavailable or rate-limited.

Because the function is public, anyone who knows the project URL and publishable key can invoke it. Configure Gemini quota limits before sharing the app widely.

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
