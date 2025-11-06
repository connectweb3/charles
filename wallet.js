/**
 * Cardano Wallet Integration with NFT Gating (Policy ID)
 * - Shows a futuristic modal listing detected Cardano wallets (e.g., Vespr, Nami, Eternl, etc.)
 * - Uses CIP-30 to enable a selected wallet
 * - Verifies ownership of at least one asset under the specified policy before "connecting"
 * - Updates UI status if access is granted
 *
 * Requirements:
 * - Page should be served via http(s) with a CIP-30 compatible wallet extension installed
 * - Cardano Serialization Library must be loaded (window.CardanoSerializationLib)
 */

(function () {
  const POLICY_ID = "8ba415901810af78c8ae75239b0c61fc54f09850a4c32f4acd206308"; // 56-hex policy id
  const STATE = {
    api: null,
    walletKey: null,
    bech32: null,
  };

  // Known wallets (key = injected window.cardano[key])
  const WALLETS = [
    { key: "vespr", name: "Vespr", url: "https://vespr.xyz/", icon: "https://www.google.com/s2/favicons?domain=vespr.xyz&sz=32" },
    { key: "eternl", name: "Eternl", url: "https://eternl.io/", icon: "https://eternl.io/favicon.ico" },
    { key: "gerowallet", name: "Gero", url: "https://gerowallet.io/", icon: "https://gerowallet.io/favicon.ico" },
    { key: "lace", name: "Lace", url: "https://www.lace.io/", icon: "https://www.lace.io/favicon.ico" },
    { key: "typhoncip30", name: "Typhon", url: "https://typhonwallet.io/", icon: "https://typhonwallet.io/favicon.ico" },
  ];

  // No generic SVG; use wallet-specific icons

  function hexToBytes(hex) {
    if (!hex || typeof hex !== "string") return new Uint8Array();
    const len = hex.length / 2;
    const out = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      out[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return out;
  }
  function bytesToHex(bytes) {
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  function shortBech32(addr, head = 10, tail = 6) {
    if (!addr) return "";
    if (addr.length <= head + tail + 1) return addr;
    return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
  }

  function getDOM() {
    return {
      connectBtn: document.getElementById("connectWalletBtn"),
      status: document.getElementById("walletStatus"),
      box: document.getElementById("walletbox"),
      panel: document.querySelector("#walletbox .wallet-panel"),
      closeBtn: document.querySelector("#walletbox .lightbox-close"),
      list: document.getElementById("walletList"),
      msg: document.getElementById("walletMessage"),
    };
  }

  function setMessage(text, type = "info") {
    const { msg } = getDOM();
    if (!msg) return;
    msg.textContent = text || "";
    msg.setAttribute("data-type", type);
  }

  function openWalletModal() {
    const { box } = getDOM();
    if (!box) return;
    box.classList.add("open");
    box.setAttribute("aria-hidden", "false");
  }

  function closeWalletModal() {
    const { box } = getDOM();
    if (!box) return;
    box.classList.remove("open");
    box.setAttribute("aria-hidden", "true");
    setMessage("", "info");
  }

  // Toggle Connect/Disconnect button mode and label
  function setConnectButtonMode(mode) {
    const { connectBtn } = getDOM();
    if (!connectBtn) return;
    if (mode === "disconnect") {
      connectBtn.textContent = "Disconnect";
      connectBtn.setAttribute("data-mode", "disconnect");
      connectBtn.setAttribute("aria-label", "Disconnect wallet");
    } else {
      connectBtn.textContent = "Connect Wallet";
      connectBtn.setAttribute("data-mode", "connect");
      connectBtn.setAttribute("aria-label", "Open wallet selector");
    }
  }

  // Clear in-app connection state (CIP-30 has no standard programmatic revoke)
  function disconnectWallet() {
    const { status } = getDOM();
    try {
      // Best-effort: some wallets expose non-standard methods; we don't rely on them.
    } catch {}
    STATE.api = null;
    STATE.walletKey = null;
    STATE.bech32 = null;
    if (status) {
      status.textContent = "";
      status.removeAttribute("data-state");
    }
    setConnectButtonMode("connect");
    setMessage("Disconnected.", "info");
  }

  function renderWalletList() {
    const { list } = getDOM();
    if (!list) return;
    const detected = [];
    const notDetected = [];
    for (const w of WALLETS) {
      const present = !!(window.cardano && window.cardano[w.key]);
      (present ? detected : notDetected).push({ ...w, present });
    }

    // Build HTML
    const items = [];

    for (const w of detected) {
      items.push(`
        <button class="wallet-item" role="option" data-wallet="${w.key}" aria-label="${w.name}">
          <span class="wi-icon"><img src="${w.icon}" alt="${w.name} icon" width="18" height="18" loading="lazy"></span>
          <span class="wi-label">${w.name}</span>
          <span class="wi-tag detected">Detected</span>
        </button>
      `);
    }
    for (const w of notDetected) {
      items.push(`
        <a class="wallet-item missing" role="option" data-wallet="${w.key}" href="${w.url}" target="_blank" rel="noopener noreferrer" aria-label="Install ${w.name}">
          <span class="wi-icon"><img src="${w.icon}" alt="${w.name} icon" width="18" height="18" loading="lazy"></span>
          <span class="wi-label">${w.name}</span>
          <span class="wi-tag missing">Install</span>
        </a>
      `);
    }

    list.innerHTML = items.join("");

    if (detected.length === 0) {
      setMessage("No Cardano wallets detected. Install one to continue (e.g., Vespr, Nami, Eternl).", "warn");
    } else {
      setMessage("Select a wallet to continue.", "info");
    }
  }

  async function getBech32Address(api, CSL) {
    try {
      const used = await api.getUsedAddresses();
      const arr = Array.isArray(used) ? used : [];
      const hex = arr[0] || (api.getChangeAddress ? await api.getChangeAddress() : null); // fallback
      if (!hex) return null;
      const addr = CSL.Address.from_bytes(hexToBytes(hex));
      return addr.to_bech32();
    } catch {
      return null;
    }
  }

  async function hasNftUnderPolicy(api, CSL, policyIdHex) {
    // Try getBalance first (aggregated)
    try {
      const balHex = await api.getBalance();
      if (balHex) {
        const value = CSL.Value.from_bytes(hexToBytes(balHex));
        const ma = value.multiasset();
        if (ma) {
          const policies = ma.keys();
          for (let i = 0; i < policies.len(); i++) {
            const pol = policies.get(i);
            const pid = bytesToHex(pol.to_bytes());
            if (pid === policyIdHex) {
              const assets = ma.get(pol);
              const names = assets.keys();
              for (let j = 0; j < names.len(); j++) {
                const nm = names.get(j);
                const qty = assets.get(nm); // BigNum
                if (qty && qty.to_str() !== "0") {
                  return true;
                }
              }
            }
          }
        }
      }
    } catch (e) {
      // fallback to scanning UTxOs
    }

    // Fallback: scan UTXOs
    try {
      const utxos = await api.getUtxos();
      if (!utxos || !Array.isArray(utxos)) return false;
      for (const u of utxos) {
        const utxo = CSL.TransactionUnspentOutput.from_bytes(hexToBytes(u));
        const out = utxo.output();
        const value = out.amount();
        const ma = value.multiasset();
        if (!ma) continue;
        const policies = ma.keys();
        for (let i = 0; i < policies.len(); i++) {
          const pol = policies.get(i);
          const pid = bytesToHex(pol.to_bytes());
          if (pid === policyIdHex) {
            const assets = ma.get(pol);
            const names = assets.keys();
            for (let j = 0; j < names.len(); j++) {
              const nm = names.get(j);
              const qty = assets.get(nm);
              if (qty && qty.to_str() !== "0") {
                return true;
              }
            }
          }
        }
      }
    } catch (e) {
      // ignore
    }
    return false;
  }

  async function onWalletSelect(key) {
    const { status } = getDOM();
    setMessage("Requesting wallet access…", "info");

    if (!window.cardano || !window.cardano[key]) {
      setMessage("Wallet not detected. Please install it.", "error");
      return;
    }

    const CSL = window.CardanoSerializationLib || window.Cardano || window.CardanoWasm;
    if (!CSL) {
      setMessage("Cardano Serialization Library not loaded. Ensure the page is served over http(s) and refresh.", "error");
      return;
    }

    try {
      const provider = window.cardano[key];
      const enabled = provider.isEnabled ? await provider.isEnabled() : false;
      const api = enabled ? await provider.enable() : await provider.enable();

      // Optional: verify network (1 = mainnet). We don't block testnet here, just inform.
      try {
        const networkId = await api.getNetworkId?.();
        if (typeof networkId === "number" && networkId !== 1) {
          setMessage("Warning: You are not on mainnet. NFT verification may fail.", "warn");
        }
      } catch {
        // ignore
      }

      // Gate by NFT ownership
      setMessage("Verifying NFT ownership…", "info");
      const ok = await hasNftUnderPolicy(api, CSL, POLICY_ID);
      if (!ok) {
        setMessage("Access denied: You must hold COC NFT under the required policy to connect.", "error");
        return;
      }

      // Success: finalize connection
      const bech32 = await getBech32Address(api, CSL);
      STATE.api = api;
      STATE.walletKey = key;
      STATE.bech32 = bech32;

      if (status) {
        status.textContent = bech32
          ? `Connected: ${shortBech32(bech32)} ✓`
          : `Connected ✓`;
        status.setAttribute("data-state", "connected");
      }
      setConnectButtonMode("disconnect");

      setMessage("Access granted. NFT verified.", "success");
      // Close modal after short delay for UX
      setTimeout(closeWalletModal, 550);
    } catch (err) {
      console.error(err);
      setMessage("Wallet authorization failed or was rejected.", "error");
    }
  }

  function wireEvents() {
    const { connectBtn, box, closeBtn, list } = getDOM();

    connectBtn?.addEventListener("click", () => {
      const mode = connectBtn.getAttribute("data-mode") || "connect";
      if (mode === "disconnect") {
        disconnectWallet();
      } else {
        renderWalletList();
        openWalletModal();
      }
    });

    closeBtn?.addEventListener("click", closeWalletModal);

    box?.addEventListener("click", (e) => {
      if (e.target === box) closeWalletModal();
    });

    list?.addEventListener("click", (e) => {
      const el = e.target.closest(".wallet-item");
      if (!el) return;
      const key = el.getAttribute("data-wallet");
      // If it's an anchor for install, let the default navigation happen
      if (el.tagName.toLowerCase() === "a") return;
      if (key) onWalletSelect(key);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    // Initialize button as "Connect" by default
    setConnectButtonMode("connect");
    // If already connected previously and wallet persists permission, we could try auto-detect here
    wireEvents();
  });
})();
