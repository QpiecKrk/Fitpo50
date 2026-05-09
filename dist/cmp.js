"use strict";
(() => {
  (() => {
    const STORAGE_KEY = "fitpo50_cookie_consent_v1";
    const GA_ID = "G-S21SKTVM7K";
    const ADS_ID = "AW-18108612630";
    const GA_SRC = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    const host = window.location.hostname.toLowerCase();
    const isLocal = host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local");
    if (isLocal) {
      window[`ga-disable-${GA_ID}`] = true;
      window[`ga-disable-${ADS_ID}`] = true;
      console.log("FitPo50: \u015Arodowisko lokalne wykryte. \u015Aledzenie Google Analytics zosta\u0142o zablokowane.");
    }
    const win = window;
    const styleId = "fitpo50-cmp-style";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
      :root {
        --cmp-bg: #fbf7f0;
        --cmp-border: #d7cebf;
        --cmp-text: #1f2b45;
        --cmp-muted: #34415d;
        --cmp-primary: #2f6f99;
        --cmp-accent: #b86b4f;
        --cmp-btn-text: #ffffff;
        --cmp-shadow: 0 12px 26px rgba(31, 43, 69, 0.16);
      }

      html.night-shell {
        --cmp-bg: #0f1623;
        --cmp-border: #2a3a55;
        --cmp-text: #e8eefb;
        --cmp-muted: #c8d4ec;
        --cmp-primary: #4d84b2;
        --cmp-accent: #c27a59;
        --cmp-shadow: 0 14px 30px rgba(3, 8, 16, 0.54);
      }

      .cmp-banner {
        position: fixed;
        left: 50%;
        bottom: max(10px, env(safe-area-inset-bottom));
        transform: translateX(-50%);
        width: min(980px, calc(100% - 16px));
        z-index: 9999;
        display: grid;
        gap: 8px;
        background: var(--cmp-bg);
        border: 1px solid var(--cmp-border);
        border-radius: 12px;
        box-shadow: var(--cmp-shadow);
        padding: 8px;
        color: var(--cmp-text);
        font-family: "Work Sans", system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      }

      .cmp-banner[hidden] { display: none !important; }

      .cmp-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        min-width: 0;
      }

      .cmp-text {
        margin: 0;
        font-size: 0.86rem;
        line-height: 1.25;
        color: var(--cmp-muted);
        min-width: 0;
      }

      .cmp-text strong { color: var(--cmp-text); }

      .cmp-actions {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
      }

      .cmp-btn {
        border: 1px solid transparent;
        border-radius: 999px;
        font-size: 0.77rem;
        font-weight: 700;
        line-height: 1;
        padding: 8px 12px;
        cursor: pointer;
        white-space: nowrap;
        transition: transform 0.16s ease, filter 0.16s ease;
      }

      .cmp-btn:hover { transform: translateY(-1px); filter: brightness(1.02); }
      .cmp-btn:focus-visible {
        outline: 2px solid #7ca0bf;
        outline-offset: 2px;
      }

      .cmp-btn--accept {
        background: var(--cmp-primary);
        color: var(--cmp-btn-text);
      }

      .cmp-btn--reject {
        background: transparent;
        color: var(--cmp-text);
        border-color: var(--cmp-border);
      }

      .cmp-btn--settings {
        background: #f0e3db;
        color: var(--cmp-text);
        border-color: #d8b09f;
      }

      .cmp-panel {
        border-top: 1px solid var(--cmp-border);
        padding-top: 8px;
        display: grid;
        gap: 8px;
      }

      .cmp-panel[hidden] { display: none !important; }

      .cmp-option {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }

      .cmp-option__label {
        margin: 0;
        font-size: 0.82rem;
        color: var(--cmp-muted);
      }

      .cmp-option__label strong {
        display: block;
        color: var(--cmp-text);
        font-size: 0.84rem;
        margin-bottom: 2px;
      }

      .cmp-toggle {
        appearance: none;
        position: relative;
        width: 42px;
        height: 24px;
        border-radius: 999px;
        background: #c6cddb;
        border: 1px solid var(--cmp-border);
        cursor: pointer;
        transition: background 0.2s ease;
      }

      .cmp-toggle::after {
        content: "";
        position: absolute;
        top: 2px;
        left: 2px;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: #fff;
        transition: transform 0.2s ease;
      }

      .cmp-toggle:checked {
        background: #5a8fb8;
      }

      .cmp-toggle:checked::after {
        transform: translateX(18px);
      }

      .cmp-toggle[disabled] {
        cursor: not-allowed;
        opacity: 0.75;
      }

      .cmp-panel__footer {
        display: flex;
        justify-content: flex-end;
      }

      @media (max-width: 820px) {
        .cmp-banner {
          width: calc(100% - 12px);
          bottom: max(8px, env(safe-area-inset-bottom));
          border-radius: 11px;
          padding: 8px;
        }

        .cmp-row {
          flex-direction: column;
          align-items: stretch;
          gap: 7px;
        }

        .cmp-actions {
          width: 100%;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 6px;
        }

        .cmp-btn {
          width: 100%;
          text-align: center;
          padding: 9px 8px;
        }
      }
    `;
      document.head.appendChild(style);
    }
    const safeParse = (raw) => {
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed.analytics !== "boolean" || typeof parsed.marketing !== "boolean") return null;
        return {
          necessary: true,
          analytics: parsed.analytics,
          marketing: parsed.marketing,
          updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : ""
        };
      } catch (_) {
        return null;
      }
    };
    let consentState = safeParse(localStorage.getItem(STORAGE_KEY));
    const hasAnalyticsConsent = () => Boolean(consentState == null ? void 0 : consentState.analytics);
    const hasMarketingConsent = () => Boolean(consentState == null ? void 0 : consentState.marketing);
    const hasAnyTagConsent = () => hasAnalyticsConsent() || hasMarketingConsent();
    const initGtagBridge = () => {
      window.dataLayer = window.dataLayer || [];
      if (typeof win.gtag !== "function") {
        win.gtag = function gtag(...args) {
          var _a;
          (_a = window.dataLayer) == null ? void 0 : _a.push(args);
        };
      }
    };
    const applyGtagConfig = () => {
      if (typeof win.gtag !== "function") return;
      if (hasAnalyticsConsent()) {
        win.gtag("config", GA_ID);
      }
      if (hasMarketingConsent()) {
        win.gtag("config", ADS_ID);
      }
    };
    const ensureAnalyticsLoaded = () => {
      if (isLocal) return;
      if (!hasAnyTagConsent()) return;
      initGtagBridge();
      if (!win.__fitpo50GtagBootstrapped && typeof win.gtag === "function") {
        win.gtag("js", /* @__PURE__ */ new Date());
        win.__fitpo50GtagBootstrapped = true;
      }
      if (win.__fitpo50AnalyticsInjected) {
        applyGtagConfig();
        return;
      }
      win.__fitpo50AnalyticsInjected = true;
      const existing = document.querySelector(`script[src*="googletagmanager.com/gtag/js?id=${GA_ID}"]`);
      if (existing) {
        applyGtagConfig();
        return;
      }
      const script = document.createElement("script");
      script.async = true;
      script.src = GA_SRC;
      script.onload = () => {
        applyGtagConfig();
      };
      document.head.appendChild(script);
    };
    if (!win.__fitpo50CmpPatched) {
      win.__fitpo50CmpPatched = true;
      const originalAppendChild = Node.prototype.appendChild;
      Node.prototype.appendChild = function patchedAppendChild(node) {
        if (node instanceof HTMLScriptElement && typeof node.src === "string" && node.src.includes("googletagmanager.com/gtag/js") && (isLocal || !hasAnyTagConsent())) {
          return node;
        }
        return originalAppendChild.call(this, node);
      };
    }
    const persist = (state) => {
      consentState = state;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      win.FitPo50Consent = state;
      window.dispatchEvent(new CustomEvent("fitpo50:consent-updated", { detail: state }));
      ensureAnalyticsLoaded();
    };
    if (consentState) {
      win.FitPo50Consent = consentState;
      ensureAnalyticsLoaded();
      return;
    }
    const banner = document.createElement("aside");
    banner.className = "cmp-banner";
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-label", "Ustawienia plik\xF3w cookies");
    banner.innerHTML = `
    <div class="cmp-row">
      <p class="cmp-text"><strong>Cookies</strong>: u\u017Cywamy ich do dzia\u0142ania strony, analityki i tre\u015Bci dopasowanych do Ciebie.</p>
      <div class="cmp-actions">
        <button type="button" class="cmp-btn cmp-btn--accept" data-cmp-action="accept">Akceptuj\u0119</button>
        <button type="button" class="cmp-btn cmp-btn--reject" data-cmp-action="reject">Odrzucam</button>
        <button type="button" class="cmp-btn cmp-btn--settings" data-cmp-action="toggle-settings" aria-expanded="false">Ustawienia</button>
      </div>
    </div>
    <div class="cmp-panel" data-cmp-panel hidden>
      <div class="cmp-option">
        <p class="cmp-option__label"><strong>Niezb\u0119dne</strong>Zawsze aktywne - wymagane do dzia\u0142ania strony.</p>
        <input class="cmp-toggle" type="checkbox" checked disabled aria-label="Niezb\u0119dne cookies">
      </div>
      <div class="cmp-option">
        <p class="cmp-option__label"><strong>Analityczne</strong>Pomagaj\u0105 mierzy\u0107 u\u017Cycie strony i poprawia\u0107 wygod\u0119.</p>
        <input class="cmp-toggle" type="checkbox" data-cmp-consent="analytics" aria-label="Analityczne cookies">
      </div>
      <div class="cmp-option">
        <p class="cmp-option__label"><strong>Marketingowe</strong>Pozwalaj\u0105 dopasowa\u0107 komunikacj\u0119 i kampanie.</p>
        <input class="cmp-toggle" type="checkbox" data-cmp-consent="marketing" aria-label="Marketingowe cookies">
      </div>
      <div class="cmp-panel__footer">
        <button type="button" class="cmp-btn cmp-btn--accept" data-cmp-action="save-selected">Zapisz wyb\xF3r</button>
      </div>
    </div>
  `;
    const closeBanner = () => {
      banner.hidden = true;
      banner.remove();
    };
    const panel = banner.querySelector("[data-cmp-panel]");
    const settingsBtn = banner.querySelector('[data-cmp-action="toggle-settings"]');
    const analyticsInput = banner.querySelector('[data-cmp-consent="analytics"]');
    const marketingInput = banner.querySelector('[data-cmp-consent="marketing"]');
    const saveState = (analytics, marketing) => {
      const state = {
        necessary: true,
        analytics,
        marketing,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      persist(state);
      closeBanner();
    };
    banner.addEventListener("click", (event) => {
      var _a;
      const target = event.target;
      const action = (_a = target == null ? void 0 : target.closest("[data-cmp-action]")) == null ? void 0 : _a.dataset.cmpAction;
      if (!action) return;
      if (action === "accept") {
        saveState(true, true);
        return;
      }
      if (action === "reject") {
        saveState(false, false);
        return;
      }
      if (action === "toggle-settings") {
        if (!panel || !settingsBtn) return;
        const expanded = settingsBtn.getAttribute("aria-expanded") === "true";
        settingsBtn.setAttribute("aria-expanded", String(!expanded));
        panel.hidden = expanded;
        return;
      }
      if (action === "save-selected") {
        saveState(Boolean(analyticsInput == null ? void 0 : analyticsInput.checked), Boolean(marketingInput == null ? void 0 : marketingInput.checked));
      }
    });
    document.body.appendChild(banner);
  })();
})();
