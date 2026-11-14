-- Emulingo cross-device save storage.
--
-- Stores compressed battery saves ('srm') and browser save states ('state:1'..'state:9')
-- keyed by the deterministic ROM hash (game_id) and slot name.
-- Run this once in the Supabase SQL Editor.

create table if not exists public.emulingo_saves (
    game_id bigint not null check (game_id > 0),
    slot text not null check (slot = 'srm' or slot ~ '^state:[1-9]$'),
    encoding text not null default 'gzip+base64' check (encoding in ('base64', 'gzip+base64')),
    data_base64 text not null check (length(data_base64) > 0 and length(data_base64) <= 2097152),
    data_hash text not null check (length(data_hash) > 0 and length(data_hash) <= 64),
    byte_length integer not null check (byte_length > 0 and byte_length <= 2097152),
    updated_at timestamptz not null default now(),
    primary key (game_id, slot)
);

create or replace function public.set_emulingo_saves_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists emulingo_saves_set_updated_at on public.emulingo_saves;
create trigger emulingo_saves_set_updated_at
    before insert or update on public.emulingo_saves
    for each row execute function public.set_emulingo_saves_updated_at();

alter table public.emulingo_saves enable row level security;

grant select, insert, update, delete on public.emulingo_saves to anon;

drop policy if exists "Public can read emulingo saves" on public.emulingo_saves;
create policy "Public can read emulingo saves"
    on public.emulingo_saves for select to anon using (true);

drop policy if exists "Public can add emulingo saves" on public.emulingo_saves;
create policy "Public can add emulingo saves"
    on public.emulingo_saves for insert to anon with check (true);

drop policy if exists "Public can update emulingo saves" on public.emulingo_saves;
create policy "Public can update emulingo saves"
    on public.emulingo_saves for update to anon using (true) with check (true);

drop policy if exists "Public can delete emulingo saves" on public.emulingo_saves;
create policy "Public can delete emulingo saves"
    on public.emulingo_saves for delete to anon using (true);

notify pgrst, 'reload schema';

