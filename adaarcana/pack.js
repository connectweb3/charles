// ADA Arcana Pack Inventory + Gating Logic
// This module centralizes pack balances and enforces that a user must OWN a pack
// before they can open it. It is designed to be imported by index.html (module type).

// IMPORTANT:
// - This implementation is LOCAL-STATE based (localStorage) unless wired to real on-chain pack NFTs.
// - It supports four logical pack SKUs:
//     "GENESIS_SIGIL", "CRAWJU_FORGE", "BISON_DOMINION", "CELESTIAL_CHAIN"
// - Exposes helpers for:
//     - querying balances
//     - rendering counts into the Profile Dashboard
//     - gating "open pack" attempts

const PACK_STORAGE_KEY = "adaarcana.packBalances.v1";

// Canonical pack IDs for display and gating
export const PACK_TYPES = {
  GENESIS_SIGIL: "GENESIS_SIGIL",
  CRAWJU_FORGE: "CRAWJU_FORGE",
  BISON_DOMINION: "BISON_DOMINION",
  CELESTIAL_CHAIN: "CELESTIAL_CHAIN"
};

// Map from internal key -> human label
export const PACK_LABELS = {
  [PACK_TYPES.GENESIS_SIGIL]: "Genesis Sigil Pack",
  [PACK_TYPES.CRAWJU_FORGE]: "Crawju Forge Pack",
  [PACK_TYPES.BISON_DOMINION]: "Bison Dominion Pack",
  [PACK_TYPES.CELESTIAL_CHAIN]: "Celestial Chain Pack"
};

// Initialize default balances if not yet present
function loadBalances() {
  try {
    const raw = localStorage.getItem(PACK_STORAGE_KEY);
    if (!raw) {
      // Default: zero of each pack (STRICT gating)
      const initial = {
        [PACK_TYPES.GENESIS_SIGIL]: 0,
        [PACK_TYPES.CRAWJU_FORGE]: 0,
        [PACK_TYPES.BISON_DOMINION]: 0,
        [PACK_TYPES.CELESTIAL_CHAIN]: 0
      };
      localStorage.setItem(PACK_STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    return {
      [PACK_TYPES.GENESIS_SIGIL]: Number(parsed[PACK_TYPES.GENESIS_SIGIL] || 0),
      [PACK_TYPES.CRAWJU_FORGE]: Number(parsed[PACK_TYPES.CRAWJU_FORGE] || 0),
      [PACK_TYPES.BISON_DOMINION]: Number(parsed[PACK_TYPES.BISON_DOMINION] || 0),
      [PACK_TYPES.CELESTIAL_CHAIN]: Number(parsed[PACK_TYPES.CELESTIAL_CHAIN] || 0)
    };
  } catch {
    return {
      [PACK_TYPES.GENESIS_SIGIL]: 0,
      [PACK_TYPES.CRAWJU_FORGE]: 0,
      [PACK_TYPES.BISON_DOMINION]: 0,
      [PACK_TYPES.CELESTIAL_CHAIN]: 0
    };
  }
}

function saveBalances(balances) {
  try {
    localStorage.setItem(PACK_STORAGE_KEY, JSON.stringify(balances));
  } catch {
    // ignore
  }
}

let balances = loadBalances();

// Public API

export function getPackBalances() {
  return { ...balances };
}

export function getPackCount(type) {
  return balances[type] || 0;
}

// Increment helper (for dev/testing or future purchase/mint integration)
export function addPacks(type, count = 1) {
  if (!PACK_TYPES[type] && !Object.values(PACK_TYPES).includes(type)) return;
  const key = Object.values(PACK_TYPES).includes(type) ? type : PACK_TYPES[type];
  balances[key] = (balances[key] || 0) + Math.max(0, Number(count) || 0);
  saveBalances(balances);
  renderProfilePackCounts();
}

// Consume one pack of given type if available
export function consumePack(type) {
  const key = type;
  if (!(key in balances)) return false;
  if (balances[key] <= 0) return false;
  balances[key] -= 1;
  saveBalances(balances);
  renderProfilePackCounts();
  return true;
}

// Given a selected pack metadata object from packs.json, resolve its logical key
// You should align this mapping to your actual packs.json configuration.
export function resolvePackTypeFromMetadata(packMeta) {
  if (!packMeta) return null;
  const name = (packMeta.pack_name || "").toLowerCase();

  if (name.includes("genesis")) return PACK_TYPES.GENESIS_SIGIL;
  if (name.includes("crawju")) return PACK_TYPES.CRAWJU_FORGE;
  if (name.includes("bison")) return PACK_TYPES.BISON_DOMINION;
  if (name.includes("celestial") || name.includes("chain")) return PACK_TYPES.CELESTIAL_CHAIN;

  // Fallback: treat unknown as Genesis for now (or null to block)
  return PACK_TYPES.GENESIS_SIGIL;
}

// Check if the user can open the given pack; if so, consume one and return true.
// If no balance, returns false and DOES NOT mutate.
export function tryConsumeForPack(packMeta) {
  const type = resolvePackTypeFromMetadata(packMeta);
  if (!type) return false;
  if (getPackCount(type) <= 0) return false;
  consumePack(type);
  return true;
}

// Render balances into Profile Dashboard (called on load / connect / update)
export function renderProfilePackCounts() {
  const root = document.getElementById("profile-dashboard-pack-counts");
  if (!root) return;

  const current = getPackBalances();
  root.innerHTML = `
    <div class="profile-row-label">Pack Inventory</div>
    <div class="profile-row-value">
      <div>Genesis Sigil Pack: <span>${current[PACK_TYPES.GENESIS_SIGIL]}</span></div>
      <div>Crawju Forge Pack: <span>${current[PACK_TYPES.CRAWJU_FORGE]}</span></div>
      <div>Bison Dominion Pack: <span>${current[PACK_TYPES.BISON_DOMINION]}</span></div>
      <div>Celestial Chain Pack: <span>${current[PACK_TYPES.CELESTIAL_CHAIN]}</span></div>
    </div>
  `;
}

// Development helper to expose in console if desired:
// window.adaPack = { getPackBalances, addPacks, consumePack };
