/**
 * ADA Arcana - Supabase client + simple persistence helpers
 *
 * IMPORTANT:
 * - Uses anon public key (safe in browser for RLS-protected reads/writes).
 * - Assumes you ran supabase_schema.md successfully.
 * - Maps a connected wallet to `users` and logs:
 *    - pack balances (packs)
 *    - pack opens (pack_opens)
 *    - opened cards (cards)
 *    - NFT exchanges (nft_exchanges) and marks NFTs used
 *
 * This is a minimal, single-file helper. You must:
 *  1) Include this in index.html: <script type="module" src="supabase_client.js"></script>
 *  2) Call exported functions from your existing wallet/pack logic.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://jralfkzdfajroshkpdln.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpyYWxma3pkZmFqcm9zaGtwZGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1NTA1NzMsImV4cCI6MjA3ODEyNjU3M30.xuy6-dn2JBIs9LsTyzHrCuevHclCWoyKYvj5sbqj7cw";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false
  },
  global: {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`
    }
  }
});

/**
 * Ensure a user row exists for this wallet and return its id.
 * Use bech32 base address or stake address as stable key (pass whichever you trust).
 */
export async function ensureUser({ walletKey, walletAddr, stakeAddress }) {
  if (!walletAddr) {
    console.warn("[supabase] ensureUser missing walletAddr");
    return null;
  }

  const payload = {
    wallet_key: walletKey || "UNKNOWN",
    wallet_addr: walletAddr,
    stake_address: stakeAddress || null
  };

  const { data, error } = await supabase
    .from("users")
    .upsert(payload, {
      onConflict: "wallet_addr",
      ignoreDuplicates: false
    })
    .select("id")
    .single();

  if (error) {
    console.error("[supabase] ensureUser error", error);
    return null;
  }
  return data?.id || null;
}

/**
 * Upsert NFT inventory rows for this user based on discovered NFTs.
 * nfts: [{ policy_id, asset_name, unit, display_name, image_url, metadata_json }]
 */
export async function syncUserNfts(userId, nfts) {
  if (!userId || !Array.isArray(nfts) || !nfts.length) return;

  const rows = nfts.map(n => ({
    user_id: userId,
    policy_id: n.policy_id,
    asset_name: n.asset_name,
    unit: n.unit,
    display_name: n.display_name || null,
    image_url: n.image_url || null,
    metadata_json: n.metadata_json || null
  }));

  const { error } = await supabase
    .from("nfts")
    .upsert(rows, {
      onConflict: "user_id,unit",
      ignoreDuplicates: false
    });

  if (error) {
    console.error("[supabase] syncUserNfts error", error);
  }
}

/**
 * Persist pack balances snapshot for a user.
 * balances: { GENESIS_SIGIL: number, CRAWJU_FORGE: number, ... }
 */
export async function savePackBalances(userId, balances) {
  if (!userId || !balances) return;

  const rows = Object.entries(balances).map(([pack_type, balance]) => ({
    user_id: userId,
    pack_type,
    balance: Number(balance || 0)
  }));

  const { error } = await supabase
    .from("packs")
    .upsert(rows, {
      onConflict: "user_id,pack_type",
      ignoreDuplicates: false
    });

  if (error) {
    console.error("[supabase] savePackBalances error", error);
  }
}

/**
 * Log a pack open event and save its cards.
 * cards: [{ card_def_id, rarity, name, description, image_url }]
 */
export async function logPackOpen({ userId, packType, source, cards }) {
  if (!userId || !packType) return;

  const { data: po, error: poErr } = await supabase
    .from("pack_opens")
    .insert({
      user_id: userId,
      pack_type: packType,
      source: source || "DIRECT"
    })
    .select("id")
    .single();

  if (poErr) {
    console.error("[supabase] logPackOpen insert pack_opens error", poErr);
    return;
  }

  if (Array.isArray(cards) && cards.length) {
    const rows = cards.map(c => ({
      user_id: userId,
      pack_open_id: po.id,
      card_def_id: c.card_def_id,
      rarity: c.rarity || null,
      name: c.name || null,
      description: c.description || null,
      image_url: c.image_url || null
    }));

    const { error: cErr } = await supabase
      .from("cards")
      .insert(rows);

    if (cErr) {
      console.error("[supabase] logPackOpen insert cards error", cErr);
    }
  }
}

/**
 * Record NFT ➜ pack exchange and mark NFT as used (trigger in DB will flip used=true).
 * nft: { id (nfts.id), unit, policy_id, type }
 * awardedPacks: integer count
 * awardedType: text: logical pack_type or 'RANDOM'
 */
export async function recordNftExchange({ userId, nft, awardedPacks, awardedType }) {
  if (!userId || !nft || !nft.id) return;

  const { error } = await supabase
    .from("nft_exchanges")
    .insert({
      user_id: userId,
      nft_id: nft.id,
      nft_unit: nft.unit,
      nft_policy_id: nft.policy_id,
      nft_type: nft.type || "NFT",
      awarded_packs: awardedPacks,
      awarded_type: awardedType || "RANDOM"
    });

  if (error) {
    console.error("[supabase] recordNftExchange error", error);
  }
}
