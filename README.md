# Nihongo no Dashi

A single-page Japanese vocabulary flashcard app with spaced repetition, a cyberpunk terminal interface, and a Tokyo Night-inspired theme. Vocabulary and review schedules are stored in Supabase.

## Features

- Flip cards to reveal readings, meanings, word types, and optional example sentences.
- Review cards due for repetition, or practice all words or a selected memory stage without changing SRS data.
- Track vocabulary through five themed stages:

  | SRS level | Stage | Description |
  | --- | --- | --- |
  | 0–2 | `RAW_DATA` | Newly captured items undergoing initial review |
  | 3–4 | `DECODING` | Active memory formation and pattern recognition |
  | 5–6 | `CACHED` | Fast-recall short-term memory buffer |
  | 7–8 | `COMPILED` | Deeply integrated vocabulary |
  | 9+ | `FIRMWARE` | Permanently mastered / Read-Only Memory |

- Add words manually or use dictionary auto-fill and example lookup powered by Jotoba.
- View kanji readings, definitions, radicals, and stroke counts from the card prompt. The interface uses KanjiAPI and KanjiVG for these details.
- Play Japanese pronunciation with the browser's speech synthesis.
- Switch between dark and light themes; the interface is responsive and includes accessible labels and tooltips.
- Add a word from a URL with `kanji`, `reading`, `meaning`, `type`, and `example` parameters. Missing reading, meaning, or type are looked up when possible; an example sentence is also searched for when one is not provided.

## Run the app

The app is a static `index.html` page and does not require a build step or package installation. Serve the project directory with any static web server, or deploy it to a static host such as GitHub Pages or Vercel. Use HTTPS so browser integrations and Supabase requests work as expected.

The page loads Supabase JS and fonts from external CDNs. Dictionary and kanji lookup features also require network access to their respective services.

## Supabase setup

The app reads and writes the `public.vocabulary` table. Create the table in the Supabase SQL Editor:

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

The app's Supabase URL and browser-safe publishable/anon key are configured in the constants near the top of the script in `index.html`. Never put a Supabase `service_role` key in browser code.

These example policies allow any visitor to read, add, and update vocabulary. This is suitable only for a public, shared dataset. For private data or user-specific collections, add Supabase Auth and restrict the Row Level Security policies before deployment.

The database column names must stay in sync with the `DatabaseService` mapping in `index.html`. `next_review` is stored as a timestamp; the app converts it to milliseconds for review calculations and back to an ISO timestamp when saving.

## Spaced repetition

Marking a card correct raises its level by one. Marking it incorrect lowers the level by one, stopping at level 0. In a due-card session, incorrect cards remain in the session queue to be reviewed again; correct cards leave the queue. Practice sessions do not save SRS changes.

After an answer in a due-card session, the next review time is calculated from the resulting level:

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
| **F** | Show or hide the example sentence |
| **V** | Play Japanese pronunciation |
| **Esc** | Exit the review session |
| Click or tap a kanji | Open kanji details |

The answer actions are available after revealing the card. Kanji details can also appear on hover with a mouse; click or tap to pin the details panel.
