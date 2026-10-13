# nihongo no dashi - Documentation

This document describes the database schema and operating notes for the Japanese Spaced Repetition System (SRS).

---

## 1. Supabase Database
The app uses the `public.vocabulary` table. Create it in the Supabase SQL Editor:

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

`next_review` is stored as `timestamptz`; the app converts it to and from Unix milliseconds for review calculations. `id` identifies the row when updating SRS data.

Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` near the top of the script in `index.html`. The anon key is intended for browser use; never put a Supabase `service_role` key in this file.

The policies above allow this unauthenticated static app to read, insert, and update vocabulary rows. Anyone with access to the app can perform those actions. Add Supabase Auth and narrower RLS policies before using this for private or sensitive data.

---

## 2. SRS Level Logic (WaniKani Style)
The system translates the numeric value in **Column G** into visual feedback using the following mapping:

- **0 - 4: Apprentice** (Color: `#dd0093` / Pink)
- **5 - 6: Guru** (Color: `#882d9e` / Purple)
- **7: Master** (Color: `#294ddb` / Blue)
- **8: Enlightened** (Color: `#0093dd` / Cyan)
- **9+: Burned** (Color: `#434343` / Grey)

**Timing Intervals:**
- Level 1: +4 Hours
- Level 2: +8 Hours
- Level 3: +24 Hours (1 Day)
- Level 4: +48 Hours (2 Days)
- Level 5: +1 Week
- Level 6: +2 Weeks
- Level 7: +1 Month
- Level 8: +4 Months (Approx)

---

## 3. UI Features & Keyboard Shortcuts
To maintain a "fast-review" flow, the app supports the following mapped keys:

| Key | Action |
| :--- | :--- |
| **SPACE** | Flip the card to reveal the answer. |
| **F** | Toggle 'More Details' (Sentence & Conjugation) - *Only when flipped*. |
| **1** | Mark as **CORRECT** (Increases Level, moves NextReview forward). |
| **2** | Mark as **WRONG** (Decreases Level, resets to immediate review). |

---

## 4. Maintenance & Safety Rules
1. Keep the Supabase column names and the `DatabaseService` mappings in `index.html` in sync.
2. Preserve the `next_review` timestamp conversion when changing review scheduling code.
3. Keep the `service_role` key server-side only; browser code must use the anon key with appropriate RLS policies.
4. Sentence examples may use `**word**` to mark the target word.

---

## 5. Deployment Instructions
- Create the table and RLS policies above in Supabase.
- Set the project URL and anon key in the global constants in `index.html`.
- Host the page over HTTPS (for example, GitHub Pages or Vercel) so the Supabase client can connect.

---
*Created to ensure consistency between the Cloud Database and the Application Interface.*
