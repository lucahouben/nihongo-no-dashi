# Nihongo no Dashi

A single-page Japanese vocabulary flashcard app with spaced repetition, a cyberpunk terminal interface, and a Tokyo Night-inspired theme. Vocabulary and review schedules are stored in Supabase.

## Features

- Review each vocabulary item in both directions: Japanese → English and English → Japanese. The revealed answer includes the kanji, reading, meaning, type, conjugation, and example sentence.
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
| **V** | Play Japanese pronunciation |
| **Esc** | Exit the review session |
| Click or tap a kanji | Open kanji details |

The answer actions are available after revealing the card. Kanji details can also appear on hover with a mouse; click or tap to pin the details panel.
