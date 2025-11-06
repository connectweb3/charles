/**
 * Citadel of Charles - Background Tint Controller
 * - Click the three on-screen buttons (left/center/right) to set: Blue, Default, Red
 * - Keyboard: ←/→ to cycle, 1=Default, 2=Blue, 3=Red (also D/B/R keys)
 */
document.addEventListener("DOMContentLoaded", () => {
  const body = document.body;
  const buttons = Array.from(document.querySelectorAll(".screen-button"));
  const order = ["default", "blue", "red"];

  function setTint(name) {
    if (!order.includes(name)) name = "default";
    body.setAttribute("data-tint", name);

    // button states
    buttons.forEach((btn) => {
      const isActive = btn.dataset.color === name;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    });

    // persist
    try {
      localStorage.setItem("citadel_tint", name);
    } catch {
      /* ignore */
    }
  }

  // Restore saved preference or default
  const saved = (() => {
    try {
      return localStorage.getItem("citadel_tint");
    } catch {
      return null;
    }
  })();
  setTint(saved || "default");

  // Lightbox elements and helpers
  const lb = document.getElementById("lightbox");
  const lbPanel = lb?.querySelector(".lightbox-panel");
  const lbTitle = document.getElementById("lightbox-title");
  const sections = {
    blue: document.getElementById("lb-tokenomics"),
    default: document.getElementById("lb-nft"),
    red: document.getElementById("lb-utility"),
  };
  let lastFocus = null;

  function openLightbox(kind) {
    const sec = sections[kind] || sections.default;
    const titleMap = { blue: "Tokenomics", default: "NFT Collection", red: "Utility" };
    if (lbTitle) lbTitle.textContent = titleMap[kind] || "Panel";

    // Hide all, show selected
    Object.values(sections).forEach((el) => el && el.setAttribute("hidden", ""));
    if (sec) sec.removeAttribute("hidden");

    // Open
    lastFocus = document.activeElement;
    lb?.classList.add("open");
    lb?.setAttribute("aria-hidden", "false");

    // Reset defaults inside
    // Tokenomics tabs
    lbPanel?.querySelectorAll("#lb-tokenomics .neon-tab").forEach((t, i) => t.classList.toggle("active", i === 0));
    lbPanel?.querySelector(".bars-allocation")?.removeAttribute("hidden");
    lbPanel?.querySelector(".bars-vesting")?.setAttribute("hidden", "");

    // NFT tabs
    lbPanel?.querySelectorAll("#lb-nft .neon-tab").forEach((t, i) => t.classList.toggle("active", i === 0));
    lbPanel?.querySelectorAll("#lb-nft .view").forEach((v) => {
      v.classList.toggle("active", v.classList.contains("gallery"));
    });

    // Focus close
    lbPanel?.querySelector(".lightbox-close")?.focus();
  }

  function closeLightbox() {
    lb?.classList.remove("open");
    lb?.setAttribute("aria-hidden", "true");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  // Close handlers
  lbPanel?.querySelector(".lightbox-close")?.addEventListener("click", closeLightbox);
  lb?.addEventListener("click", (e) => {
    if (e.target === lb) closeLightbox();
  });

  // Tokenomics tab switching
  lbPanel?.addEventListener("click", (e) => {
    const tab = e.target.closest("#lb-tokenomics .neon-tab");
    if (tab) {
      const view = tab.getAttribute("data-token-view");
      lbPanel.querySelectorAll("#lb-tokenomics .neon-tab").forEach((t) => t.classList.toggle("active", t === tab));
      const alloc = lbPanel.querySelector(".bars-allocation");
      const vest = lbPanel.querySelector(".bars-vesting");
      if (view === "allocation") {
        alloc?.removeAttribute("hidden");
        vest?.setAttribute("hidden", "");
      } else {
        vest?.removeAttribute("hidden");
        alloc?.setAttribute("hidden", "");
      }
    }
  });

  // NFT tabs switching
  lbPanel?.addEventListener("click", (e) => {
    const t = e.target.closest("#lb-nft .neon-tab");
    if (t) {
      lbPanel.querySelectorAll("#lb-nft .neon-tab").forEach((btn) => btn.classList.toggle("active", btn === t));
      const target = t.getAttribute("data-tab-target");
      lbPanel.querySelectorAll("#lb-nft .view").forEach((v) => v.classList.toggle("active", v.dataset.view === target));
    }
  });

  // Gallery spotlight toggle
  lbPanel?.addEventListener("click", (e) => {
    const card = e.target.closest(".nft-card");
    if (card) card.classList.toggle("spotlight");
  });

  // Mint quantity controls
  lbPanel?.addEventListener("click", (e) => {
    if (e.target.classList.contains("qty-inc") || e.target.classList.contains("qty-dec")) {
      const input = lbPanel.querySelector(".qty-input");
      if (!input) return;
      const min = parseInt(input.min || "1", 10);
      const max = parseInt(input.max || "10", 10);
      let val = parseInt(input.value || "1", 10);
      if (e.target.classList.contains("qty-inc")) val = Math.min(max, val + 1);
      else val = Math.max(min, val - 1);
      input.value = String(val);
    }
  });

  // Copy to clipboard
  lbPanel?.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-copy]");
    if (!btn) return;
    const text = btn.getAttribute("data-copy-text") || "";
    const status = btn.parentElement?.querySelector(".copy-status");
    try {
      await navigator.clipboard.writeText(text);
      if (status) status.textContent = "Copied!";
    } catch {
      if (status) status.textContent = text;
    }
    setTimeout(() => status && (status.textContent = ""), 1600);
  });

  // Button clicks - set tint and open corresponding lightbox
  buttons.forEach((btn) =>
    btn.addEventListener("click", () => {
      const color = btn.dataset.color;
      setTint(color);
      openLightbox(color);
    })
  );

  // Keyboard controls (also open lightboxes)
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeLightbox();
      return;
    }

    const current = body.getAttribute("data-tint") || "default";
    const idx = order.indexOf(current);

    if (e.key === "ArrowRight") {
      const next = order[(idx + 1) % order.length];
      setTint(next);
      openLightbox(next);
    } else if (e.key === "ArrowLeft") {
      const prev = order[(idx - 1 + order.length) % order.length];
      setTint(prev);
      openLightbox(prev);
    } else if (e.key === "1" || e.key === "d" || e.key === "D") {
      setTint("default");
      openLightbox("default");
    } else if (e.key === "2" || e.key === "b" || e.key === "B") {
      setTint("blue");
      openLightbox("blue");
    } else if (e.key === "3" || e.key === "r" || e.key === "R") {
      setTint("red");
      openLightbox("red");
    }
  });
});
