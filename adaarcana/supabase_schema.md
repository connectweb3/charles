# ADA Arcana - Supabase Schema (SQL Editor)

Use this script in your Supabase SQL Editor to:

- Persist:
  - Wallets
  - Packs (balances and usage)
  - Cards (opened cards)
  - NFTs (inventory and usage)
- Mark NFTs as USED when they are consumed for pack exchange.
- Keep schema simple and app-driven (no RPC yet) so you can wire from frontend.

IMPORTANT:
- Replace ANY client-side use of the service_role key with backend or Supabase Edge Functions.
- In the browser, ONLY use the anon public key.

---

```sql
-- =========================================================
-- 1. SECURITY: BASIC SETUP
-- =========================================================

-- Enable required extensions (id/uuid helpers).
create extension if not exists "uuid-ossp";

-- =========================================================
-- 2. CORE TABLES
-- =========================================================

-- 2.1 Users mapped by wallet + stake key
create table if not exists public.users (
  id            uuid primary key default uuid_generate_v4(),
  wallet_key    text not null,  -- e.g. "NAMI", "LACE" label or CIP-30 key
  wallet_addr   text not null,  -- bech32 base address
  stake_address text,           -- bech32 stake address (if resolved)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index if not exists users_wallet_addr_key
  on public.users (wallet_addr);

create unique index if not exists users_stake_address_key
  on public.users (stake_address)
  where stake_address is not null;

create index if not exists users_wallet_key_idx
  on public.users (wallet_key);

create trigger set_users_updated_at
before update on public.users
for each row execute procedure
  public.trigger_set_timestamp();

-- Helper function used by multiple tables.
create or replace function public.trigger_set_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- 2.2 NFTs held by the user (off-chain synced view + usage flag)
create table if not exists public.nfts (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null references public.users(id) on delete cascade,
  policy_id      text not null,
  asset_name     text not null,
  unit           text not null,           -- policy + hex asset name
  display_name   text,
  image_url      text,
  metadata_json  jsonb,
  used           boolean not null default false,  -- MARKED USED when consumed
  used_reason    text,             -- e.g. 'BISON_NFT_TO_PACKS'
  used_at        timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create unique index if not exists nfts_unit_user_unique
  on public.nfts(user_id, unit);

create index if not exists nfts_user_id_idx
  on public.nfts(user_id);

create index if not exists nfts_used_idx
  on public.nfts(used);

create trigger set_nfts_updated_at
before update on public.nfts
for each row execute procedure
  public.trigger_set_timestamp();

-- 2.3 Pack balances (logical SKUs from pack.js)
-- One row per (user, pack_type).
create table if not exists public.packs (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.users(id) on delete cascade,
  pack_type   text not null,     -- 'GENESIS_SIGIL' | 'CRAWJU_FORGE' | 'BISON_DOMINION' | 'CELESTIAL_CHAIN'
  balance     integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index if not exists packs_user_type_unique
  on public.packs(user_id, pack_type);

create index if not exists packs_user_id_idx
  on public.packs(user_id);

create trigger set_packs_updated_at
before update on public.packs
for each row execute procedure
  public.trigger_set_timestamp();

-- 2.4 Pack open history
-- Each time a pack is opened in the app, insert a row here.
create table if not exists public.pack_opens (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.users(id) on delete cascade,
  pack_type     text not null,
  source        text,            -- e.g. 'DIRECT', 'BISON_NFT_EXCHANGE', 'CHARLES_NFT_EXCHANGE', '20_CARD_EXCHANGE'
  tx_hash       text,            -- if you later bind on-chain proof
  created_at    timestamptz not null default now()
);

create index if not exists pack_opens_user_idx
  on public.pack_opens(user_id);

-- 2.5 Cards opened from packs
-- One row per card instance granted to the user.
create table if not exists public.cards (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null references public.users(id) on delete cascade,
  pack_open_id   uuid references public.pack_opens(id) on delete set null,
  card_def_id    integer not null,   -- id from cards.json
  rarity         text,
  name           text,
  description    text,
  image_url      text,
  created_at     timestamptz not null default now()
);

create index if not exists cards_user_idx
  on public.cards(user_id);

create index if not exists cards_pack_open_idx
  on public.cards(pack_open_id);

-- 2.6 Optional: 20-card => pack exchanges
create table if not exists public.card_exchanges (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references public.users(id) on delete cascade,
  consumed_card_ids uuid[] not null, -- store list of cards.id consumed
  awarded_pack_type text not null,
  created_at      timestamptz not null default now()
);

create index if not exists card_exchanges_user_idx
  on public.card_exchanges(user_id);

-- =========================================================
-- 3. NFT ➜ PACK EXCHANGE: MARK NFT AS USED
-- =========================================================

-- This table records usages of specific NFTs for exchanges.
create table if not exists public.nft_exchanges (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null references public.users(id) on delete cascade,
  nft_id         uuid not null references public.nfts(id) on delete restrict,
  nft_unit       text not null,
  nft_policy_id  text not null,
  nft_type       text not null,   -- 'BISON', 'CHARLES', 'HALLOW'
  awarded_packs  integer not null,
  awarded_type   text not null,   -- logical pack_type or 'RANDOM'
  created_at     timestamptz not null default now()
);

create unique index if not exists nft_exchanges_nft_unique
  on public.nft_exchanges(nft_id);

create index if not exists nft_exchanges_user_idx
  on public.nft_exchanges(user_id);

-- Trigger: when inserting into nft_exchanges, automatically mark NFT as used.
create or replace function public.mark_nft_used_on_exchange()
returns trigger as $$
begin
  update public.nfts
     set used = true,
         used_reason = coalesce(new.nft_type, 'NFT_EXCHANGE'),
         used_at = now()
   where id = new.nft_id
     and used = false;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_mark_nft_used_on_exchange on public.nft_exchanges;

create trigger trg_mark_nft_used_on_exchange
after insert on public.nft_exchanges
for each row
execute procedure public.mark_nft_used_on_exchange();

-- =========================================================
-- 4. RLS POLICIES
-- =========================================================

-- Enable Row Level Security
alter table public.users          enable row level security;
alter table public.nfts           enable row level security;
alter table public.packs          enable row level security;
alter table public.pack_opens     enable row level security;
alter table public.cards          enable row level security;
alter table public.card_exchanges enable row level security;
alter table public.nft_exchanges  enable row level security;

-- Assumes you'll set auth.jwt() or a custom JWT with 'sub' = users.id
-- If you're authenticating purely by wallet, you can map by wallet_addr
-- in a custom Edge Function. For now, keep policies simple and owner-only.

-- USERS: read/update own row (by id in JWT).
create policy "Users: select own"
on public.users
for select
using (auth.uid() = id);

create policy "Users: update own"
on public.users
for update
using (auth.uid() = id);

-- NFTs: only owner can see.
create policy "NFTs: owner select"
on public.nfts
for select
using (user_id = auth.uid());

-- PACKS: only owner can see.
create policy "Packs: owner select"
on public.packs
for select
using (user_id = auth.uid());

-- PACK_OPENS: only owner can see.
create policy "PackOpens: owner select"
on public.pack_opens
for select
using (user_id = auth.uid());

-- CARDS: only owner can see.
create policy "Cards: owner select"
on public.cards
for select
using (user_id = auth.uid());

-- CARD_EXCHANGES: only owner can see.
create policy "CardExchanges: owner select"
on public.card_exchanges
for select
using (user_id = auth.uid());

-- NFT_EXCHANGES: only owner can see.
create policy "NftExchanges: owner select"
on public.nft_exchanges
for select
using (user_id = auth.uid());

-- NOTE:
-- For inserts/updates from your backend / Edge Functions, use service_role
-- (which bypasses RLS) to:
--   - upsert users
--   - sync nfts from Blockfrost
--   - increment/decrement packs
--   - insert pack_opens + cards
--   - insert nft_exchanges (auto-marks nft as used)

-- Client-side (browser) should:
--   - Use anon key
--   - Call safe RPC / Edge Functions which perform writes with service_role.


-- =========================================================
-- 5. HELPER: UPSERT / ENSURE PACK ROW
-- =========================================================

-- Helper function to increase pack balance (for backend/Edge).
create or replace function public.increment_pack_balance(
  p_user_id uuid,
  p_pack_type text,
  p_delta integer
)
returns void
language plpgsql
security definer
as $$
begin
  if p_delta = 0 then
    return;
  end if;

  insert into public.packs (user_id, pack_type, balance)
  values (p_user_id, p_pack_type, greatest(p_delta,0))
  on conflict (user_id, pack_type)
  do update
     set balance = greatest(public.packs.balance + p_delta, 0),
         updated_at = now();
end;
$$;
```

---

# HOW TO WIRE FRONTEND (SUMMARY)

Not executable in SQL editor; this is guidance for your app code.

- When wallet connects:
  - Call an Edge Function like `sync_user_and_nfts` (using service_role) to:
    - upsert into `users`
    - sync Blockfrost NFTs into `nfts` table (used=false)
- When user spends:
  - Bison NFT:
    - Edge Function verifies ownership (on-chain) and that `nfts.used = false`
    - Inserts into `nft_exchanges` with `nft_type='BISON'`, `awarded_packs=2`
    - Calls `increment_pack_balance(user_id, 'RANDOM', 2)` or concrete types
    - Trigger automatically sets that NFT row to `used = true`
- When user opens pack:
  - Backend/Edge:
    - Checks `packs.balance > 0` for chosen `pack_type`
    - Decrements it
    - Inserts `pack_opens`
    - Inserts `cards` rows for drawn cards

This ensures:
- Packs, cards, and NFT usage are recorded in Supabase.
- NFT consumed in exchange is permanently marked as USED in database.
