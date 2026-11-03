-- S/_ave: data telefonu a PC v Supabase.
-- Spustit jednou v Supabase → SQL Editor (celý soubor). Jde spustit znovu, nic nesmaže.
--
-- Kdo smí co: každý řádek patří přihlášenému uživateli (user_id = auth.uid()), RLS pustí
-- jen jeho. Telefon i PC (pc/most.mjs) se přihlašují stejným účtem, anon klíč sám nic nepřečte.
-- Registraci v Authentication → Sign In / Providers vypnout ("Allow new users to sign up" off)
-- a uživatele založit ručně (Authentication → Users → Add user).

-- Tabulky (mini Excel): jeden řádek = jeden sešit, listy s buňkami jako JSON
-- [{ "id": "...", "nazev": "List1", "bunky": { "0,0": "Jméno", "1,0": "=A1" } }]
-- klíč buňky je "řádek,sloupec" od nuly, prázdné buňky v JSONu nejsou.
create table if not exists public.tabulky (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nazev text not null check (length(nazev) between 1 and 200),
  listy jsonb not null default '[]' check (jsonb_typeof(listy) = 'array'),
  upraveno timestamptz not null default now()
);

-- Kalendář: dny jako text YYYY-MM-DD v místním čase (bez posunu přes UTC), časy HH:MM.
create table if not exists public.udalosti (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nazev text not null check (length(nazev) between 1 and 500),
  od text not null check (od ~ '^\d{4}-\d{2}-\d{2}$'),
  "do" text not null check ("do" ~ '^\d{4}-\d{2}-\d{2}$' and "do" >= od),
  cely_den boolean not null default true,
  cas_od text not null default '' check (cas_od = '' or cas_od ~ '^\d{2}:\d{2}$'),
  cas_do text not null default '' check (cas_do = '' or cas_do ~ '^\d{2}:\d{2}$'),
  misto text not null default '',
  poznamka text not null default '',
  upraveno timestamptz not null default now()
);

-- Fronta příkazů: telefon vloží text, PC (pc/most.mjs) ho vezme, provede přes Claude Code
-- a zapíše výsledek. stav: ceka → bezi → hotovo | chyba.
create table if not exists public.prikazy (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  text text not null check (length(text) between 1 and 10000),
  stav text not null default 'ceka' check (stav in ('ceka', 'bezi', 'hotovo', 'chyba')),
  vysledek text not null default '',
  vytvoreno timestamptz not null default now(),
  upraveno timestamptz not null default now()
);
create index if not exists prikazy_stav on public.prikazy (user_id, stav, vytvoreno);

-- upraveno se hlídá v databázi (udalosti, prikazy); tabulky si ho posílají samy (řazení v seznamu).
create or replace function public.nastav_upraveno() returns trigger language plpgsql as $$
begin
  new.upraveno = now();
  return new;
end $$;

drop trigger if exists udalosti_upraveno on public.udalosti;
create trigger udalosti_upraveno before update on public.udalosti
  for each row execute function public.nastav_upraveno();
drop trigger if exists prikazy_upraveno on public.prikazy;
create trigger prikazy_upraveno before update on public.prikazy
  for each row execute function public.nastav_upraveno();

-- RLS: jen vlastní řádky, jen přihlášený uživatel.
alter table public.tabulky enable row level security;
alter table public.udalosti enable row level security;
alter table public.prikazy enable row level security;

drop policy if exists vlastni on public.tabulky;
create policy vlastni on public.tabulky for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists vlastni on public.udalosti;
create policy vlastni on public.udalosti for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists vlastni on public.prikazy;
create policy vlastni on public.prikazy for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Realtime: telefon se dozví o změně z PC hned (a PC o novém příkazu).
do $$
declare t text;
begin
  foreach t in array array['tabulky', 'udalosti', 'prikazy'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
