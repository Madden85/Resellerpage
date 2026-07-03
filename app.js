let PAGE_CONFIG = {};
let BUTTON_TEXT = {};
let pageStarted = false;
let CURRENT_RESELLER = null;
let PAGE_PRICES = {};

function getConfig() {
  const frame = document.getElementById("configFrame");

  if (frame && frame.contentWindow && frame.contentWindow.NUMO_PAGE_CONFIG) {
    PAGE_CONFIG = frame.contentWindow.NUMO_PAGE_CONFIG || {};
  } else {
    PAGE_CONFIG = window.NUMO_PAGE_CONFIG || {};
  }

  BUTTON_TEXT = window.NUMO_BUTTON_TEXT || {};
}

function setText(id, value, isHtml = false) {
  const el = document.getElementById(id);
  if (!el || value === undefined || value === null) return;
  if (isHtml) el.innerHTML = value;
  else el.textContent = value;
}

function applyTextConfig() {
  const TEXT = PAGE_CONFIG.TEXT || {};

  setText("brandTitle", TEXT.brandTitle);
  setText("brandSubtitle", TEXT.brandSubtitle);
  setText("loginTitle", TEXT.loginTitle);
  setText("loginInstruction", TEXT.loginInstruction);
  setText("creditSectionTitle", TEXT.creditSectionTitle);
  setText("creditIntro", TEXT.creditIntro, true);
  setText("topNotice", TEXT.topNotice, true);
  setText("stockTitle", TEXT.stockTitle);
  setText("paymentTitle", TEXT.paymentTitle);
  setText("paymentInstruction", TEXT.paymentInstruction, true);
  setText("paymentNote", TEXT.paymentNote, true);
  setText("footerText", TEXT.footerText);
  setText("creditNote", TEXT.creditNote);
  setText("availableCreditLabel", TEXT.availableCreditLabel);
  setText("balanceLabel", TEXT.balanceLabel);
  setText("holdLabel", TEXT.holdLabel);

  setText("refreshButton", BUTTON_TEXT.refreshButton);
  setText("orderButton", BUTTON_TEXT.orderButton);
  setText("loginButton", BUTTON_TEXT.loginButton);
  setText("logoutButton", BUTTON_TEXT.logoutButton);
  setText("topupButton", BUTTON_TEXT.topupButton);

  const passwordInput = document.getElementById("passwordInput");
  if (passwordInput && BUTTON_TEXT.passwordPlaceholder) {
    passwordInput.placeholder = BUTTON_TEXT.passwordPlaceholder;
  }

  const topupButton = document.getElementById("topupButton");
  if (topupButton) {
    topupButton.href = PAGE_CONFIG.ADMIN_LINK || "https://t.me/ownernumoventures";
  }

  updateOrderButtonLink();

  renderPaymentQr();
}

function renderPaymentQr() {
  const qrContainer = document.getElementById("qrContainer");
  if (!qrContainer) return;

  const qrImage = PAGE_CONFIG.PAYMENT_QR_IMAGE || "";

  if (qrImage) {
    qrContainer.innerHTML = `<img class="qr-image" src="${escapeHtml(qrImage)}" alt="QR Payment" />`;
  } else {
    qrContainer.innerHTML = `<div class="qr-placeholder">LETAK QR PAYMENT DI SINI</div>`;
  }
}

function getBotBaseLink() {
  let botLink = PAGE_CONFIG.RESELLER_BOT_LINK || "#";
  if (botLink && !botLink.startsWith("http")) {
    botLink = "https://t.me/" + botLink.replace("@", "");
  }
  return botLink.split("?")[0];
}

function updateOrderButtonLink() {
  const orderButton = document.getElementById("orderButton");
  if (!orderButton) return;

  const token = sessionStorage.getItem("numo_reseller_token") || "";
  const base = getBotBaseLink();

  if (token && base && base !== "#") {
    orderButton.href = base + "?start=" + encodeURIComponent("bind_" + token);
  } else {
    orderButton.href = base || "#";
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function removeJsonpScript(script) {
  try {
    if (script && script.parentNode) script.parentNode.removeChild(script);
  } catch (err) {}
}

function jsonpOnce(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const callbackName = "jsonp_callback_" + Date.now() + "_" + Math.round(100000000 * Math.random());
    let done = false;
    let timer = null;

    const script = document.createElement("script");

    function cleanup() {
      if (timer) clearTimeout(timer);
      try { delete window[callbackName]; } catch (err) { window[callbackName] = undefined; }
      removeJsonpScript(script);
    }

    window[callbackName] = function(data) {
      if (done) return;
      done = true;
      cleanup();
      resolve(data);
    };

    timer = setTimeout(function() {
      if (done) return;
      done = true;
      cleanup();
      reject(new Error("API timeout"));
    }, timeoutMs);

    script.onerror = function() {
      if (done) return;
      done = true;
      cleanup();
      reject(new Error("Gagal load data"));
    };

    const sep = url.includes("?") ? "&" : "?";
    script.src = url + sep + "callback=" + encodeURIComponent(callbackName) + "&_ts=" + Date.now();
    document.body.appendChild(script);
  });
}

async function jsonp(url, options = {}) {
  const retries = Number(options.retries || 3);
  const timeoutMs = Number(options.timeoutMs || 15000);
  let lastErr = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await jsonpOnce(url, timeoutMs);
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await sleep(700 * attempt);
      }
    }
  }

  throw lastErr || new Error("Gagal load data");
}

function buildUrl(baseUrl, params) {
  const query = Object.keys(params || {})
    .filter(key => params[key] !== undefined && params[key] !== null && params[key] !== "")
    .map(key => encodeURIComponent(key) + "=" + encodeURIComponent(params[key]))
    .join("&");

  return baseUrl + (baseUrl.includes("?") ? "&" : "?") + query;
}

function showLoginMessage(type, text) {
  const box = document.getElementById("loginMessage");
  if (!box) return;

  if (!text) {
    box.innerHTML = "";
    return;
  }

  box.innerHTML = `<div class="${type === "success" ? "success" : "error"}">${text}</div>`;
}

function getCreditApiUrl() {
  return PAGE_CONFIG.RESELLER_CREDIT_API_URL || PAGE_CONFIG.RESELLER_STOCK_API_URL || "";
}

function setLoginButtonLoading(isLoading) {
  const loginButton = document.getElementById("loginButton");
  if (!loginButton) return;

  if (isLoading) {
    loginButton.disabled = true;
    loginButton.style.opacity = "0.7";
    loginButton.style.pointerEvents = "none";
    loginButton.textContent = BUTTON_TEXT.checkingPasswordText || "Checking password...";
  } else {
    loginButton.disabled = false;
    loginButton.style.opacity = "";
    loginButton.style.pointerEvents = "";
    loginButton.textContent = BUTTON_TEXT.loginButton || "LOGIN";
  }
}

async function checkPassword() {
  const input = document.getElementById("passwordInput");
  const password = input ? input.value.trim() : "";

  if (!password) {
    showLoginMessage("error", "Sila masukkan password.");
    return;
  }

  showLoginMessage("success", BUTTON_TEXT.checkingPasswordText || "Checking password...");
  setLoginButtonLoading(true);

  try {
    const apiUrl = getCreditApiUrl();
    if (!apiUrl || apiUrl.includes("PASTE_")) throw new Error("RESELLER_CREDIT_API_URL belum diset");

    const data = await jsonp(buildUrl(apiUrl, {
      mode: "loginReseller",
      password
    }), { retries: 3, timeoutMs: 18000 });

    if (data && data.ok && data.valid && data.reseller && data.token) {
      CURRENT_RESELLER = data.reseller;
      sessionStorage.setItem("numo_reseller_logged_in", "YES");
      sessionStorage.setItem("numo_reseller_token", data.token);
      sessionStorage.setItem("numo_reseller_profile", JSON.stringify(data.reseller));

      showLoginMessage("success", BUTTON_TEXT.loginSuccessText || "Login berjaya.");
      showMainContent(data.reseller);
      return;
    }

    showLoginMessage("error", (data && data.error) || BUTTON_TEXT.wrongPasswordText || "Password salah / akaun tidak aktif. Sila cuba semula.");
  } catch (err) {
    showLoginMessage("error", BUTTON_TEXT.serverBusyText || "Server lambat/gagal respond. Sila tunggu 10 saat dan cuba LOGIN semula.");
  } finally {
    setLoginButtonLoading(false);
  }
}


async function restoreSession() {
  const token = sessionStorage.getItem("numo_reseller_token") || "";
  const cachedProfile = sessionStorage.getItem("numo_reseller_profile") || "";

  if (!token) return false;

  try {
    const apiUrl = getCreditApiUrl();
    if (!apiUrl || apiUrl.includes("PASTE_")) throw new Error("RESELLER_CREDIT_API_URL belum diset");

    const data = await jsonp(buildUrl(apiUrl, {
      mode: "getResellerProfile",
      token
    }), { retries: 3, timeoutMs: 18000 });

    if (data && data.ok && data.reseller) {
      CURRENT_RESELLER = data.reseller;
      sessionStorage.setItem("numo_reseller_profile", JSON.stringify(data.reseller));
      showMainContent(data.reseller);
      return true;
    }
  } catch (err) {
    // If API temporarily fails, use cached profile so the page still opens.
    if (cachedProfile) {
      try {
        CURRENT_RESELLER = JSON.parse(cachedProfile);
        showMainContent(CURRENT_RESELLER);
        return true;
      } catch (parseErr) {}
    }
  }

  logoutPage(false);
  return false;
}

function showMainContent(reseller) {
  const loginCard = document.getElementById("loginCard");
  const mainContent = document.getElementById("mainContent");

  if (loginCard) loginCard.style.display = "none";
  if (mainContent) mainContent.style.display = "block";

  renderResellerProfile(reseller || CURRENT_RESELLER);
  updateOrderButtonLink();
  loadPricesThenStock();
}

function renderResellerProfile(reseller) {
  if (!reseller) return;

  setText("resellerName", reseller.name || "Reseller");
  setText("resellerMeta", `ID: ${reseller.resellerId || "-"}${reseller.telegramUsername ? " • " + reseller.telegramUsername : ""}`);
  setText("resellerStatus", reseller.status || "ACTIVE");

  setText("creditBalance", money(reseller.balance));
  setText("creditHold", money(reseller.hold));
  setText("availableCredit", money(reseller.availableCredit));

  const note = document.getElementById("creditNote");
  if (note) {
    if (Number(reseller.availableCredit || 0) <= 0) {
      note.textContent = "Kredit anda kosong. Sila topup dengan admin sebelum buat order.";
    } else if (Number(reseller.availableCredit || 0) < 10) {
      note.textContent = "Kredit anda rendah. Sila topup dengan admin jika mahu terus buat order.";
    } else {
      note.textContent = (PAGE_CONFIG.TEXT && PAGE_CONFIG.TEXT.creditNote) || "Jika kredit tidak cukup, sila topup dengan admin.";
    }
  }
}

function logoutPage(clearMessage = true) {
  sessionStorage.removeItem("numo_reseller_logged_in");
  sessionStorage.removeItem("numo_reseller_token");
  sessionStorage.removeItem("numo_reseller_profile");
  CURRENT_RESELLER = null;

  const loginCard = document.getElementById("loginCard");
  const mainContent = document.getElementById("mainContent");
  const passwordInput = document.getElementById("passwordInput");

  if (mainContent) mainContent.style.display = "none";
  if (loginCard) loginCard.style.display = "block";
  if (passwordInput) passwordInput.value = "";
  updateOrderButtonLink();
  if (clearMessage) showLoginMessage("", "");
}

function togglePassword() {
  const input = document.getElementById("passwordInput");
  const btn = document.getElementById("togglePasswordButton");
  if (!input || !btn) return;

  const isPassword = input.type === "password";
  input.type = isPassword ? "text" : "password";
  btn.textContent = isPassword ? "🙈" : "👁";
  btn.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");
}

function formatDate(isoString) {
  try {
    const date = new Date(isoString);
    return date.toLocaleString("ms-MY", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch (err) {
    return "-";
  }
}


async function loadPricesThenStock() {
  await loadResellerPrices();
  await loadStock();
}

async function loadResellerPrices() {
  const fallback = PAGE_CONFIG.PRICES || {};
  PAGE_PRICES = fallback;

  try {
    const apiUrl = getCreditApiUrl();
    if (!apiUrl || apiUrl.includes("PASTE_")) return;

    const data = await jsonp(buildUrl(apiUrl, {
      mode: "getResellerPrices"
    }), { retries: 3, timeoutMs: 18000 });

    if (!data || !data.ok || !Array.isArray(data.prices)) return;

    const grouped = {};

    data.prices.forEach(item => {
      const product = String(item.product || "").trim();
      if (!product) return;

      if (!grouped[product]) grouped[product] = [];

      grouped[product].push({
        plan: item.plan || "",
        reseller: "RM" + Number(item.resellerPrice || 0).toFixed(2).replace(".00", ""),
        sell: item.sellPrice ? "RM" + Number(item.sellPrice || 0).toFixed(2).replace(".00", "") : "-",
        note: item.note || "",
        warning: item.warning || ""
      });
    });

    PAGE_PRICES = grouped;
  } catch (err) {
    PAGE_PRICES = fallback;
  }
}


async function loadStock() {
  const stockList = document.getElementById("stockList");
  const updatedAt = document.getElementById("updatedAt");
  if (!stockList) return;

  stockList.innerHTML = `<div class="loading">${BUTTON_TEXT.loadingText || "Loading stock..."}</div>`;
  if (updatedAt) updatedAt.textContent = "";

  try {
    const apiUrl = PAGE_CONFIG.RESELLER_STOCK_API_URL || "";
    if (!apiUrl || apiUrl.includes("PASTE_")) throw new Error("RESELLER_STOCK_API_URL belum diset");

    const data = await jsonp(apiUrl + "?mode=resellerStock", { retries: 3, timeoutMs: 18000 });
    if (!data.ok) throw new Error(data.error || "API error");

    renderStock(data.products || []);

    if (updatedAt) {
      updatedAt.textContent = `${BUTTON_TEXT.lastUpdatedText || "Last updated:"} ${formatDate(data.updatedAt)}`;
    }
  } catch (err) {
    stockList.innerHTML = `<div class="error">${BUTTON_TEXT.errorText || "Gagal load stock.<br />Sila refresh semula atau hubungi admin."}</div>`;
  }
}

function renderStock(products) {
  const stockList = document.getElementById("stockList");
  const PRICES = PAGE_PRICES || PAGE_CONFIG.PRICES || {};
  if (!stockList) return;

  if (!products.length) {
    stockList.innerHTML = `<div class="loading">${BUTTON_TEXT.noDataText || "Tiada data stock."}</div>`;
    return;
  }

  stockList.innerHTML = products.map(product => {
    const prices = PRICES[product.key] || [];

    return `
      <div class="stock-item" data-product="${escapeHtml(product.key)}">
        <button class="stock-head" type="button" onclick="togglePrice('${escapeAttr(product.key)}')">
          <div class="product-left">
            <div class="product-icon">${product.icon || "📦"}</div>
            <div>
              <div class="product-name">${escapeHtml(product.name)}</div>
              <div class="slot-count">${escapeHtml(product.available)} ${BUTTON_TEXT.slotText || "slot available"}</div>
            </div>
          </div>
          <div class="badge ${escapeHtml(product.statusClass)}">${escapeHtml(product.status)}</div>
        </button>
        <div class="price-panel">${renderPricePanel(prices)}</div>
      </div>
    `;
  }).join("");
}

function renderPricePanel(prices) {
  if (!prices || !prices.length) {
    return `<div class="small-text">${BUTTON_TEXT.noPriceText || "Harga belum tersedia. Sila tanya admin."}</div>`;
  }

  return `
    <div class="price-title">Harga Pakej</div>
    <div class="price-labels">
      <div>${BUTTON_TEXT.priceHeaderPlan || "Plan"}</div>
      <div>${BUTTON_TEXT.priceHeaderReseller || "Reseller"}</div>
      <div>${BUTTON_TEXT.priceHeaderSell || "Jual Min"}</div>
    </div>
    ${prices.map(item => `
      <div class="price-row">
        <div class="plan-name">${escapeHtml(item.plan)}</div>
        <div class="reseller-price">${escapeHtml(item.reseller)}</div>
        <div class="sell-price">${escapeHtml(item.sell)}</div>
        ${item.note ? `<div class="bonus-note">🎁 ${escapeHtml(item.note)}</div>` : ""}
        ${item.warning ? `<div class="warning-note">${escapeHtml(item.warning)}</div>` : ""}
      </div>
    `).join("")}
  `;
}

function togglePrice(productKey) {
  const item = document.querySelector(`.stock-item[data-product="${CSS.escape(productKey)}"]`);
  if (!item) return;
  item.classList.toggle("open");
}

function money(value) {
  const num = Number(value || 0);
  return "RM" + num.toFixed(2).replace(".00", "");
}

function escapeHtml(value) {
  return String(value === undefined || value === null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(value) {
  return String(value === undefined || value === null ? "" : value)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");
}

function initPage() {
  if (pageStarted) return;
  pageStarted = true;

  getConfig();
  applyTextConfig();

  const loginButton = document.getElementById("loginButton");
  const logoutButton = document.getElementById("logoutButton");
  const passwordInput = document.getElementById("passwordInput");
  const togglePasswordButton = document.getElementById("togglePasswordButton");

  if (loginButton) loginButton.addEventListener("click", checkPassword);
  if (logoutButton) logoutButton.addEventListener("click", () => logoutPage(true));
  if (togglePasswordButton) togglePasswordButton.addEventListener("click", togglePassword);

  if (passwordInput) {
    passwordInput.addEventListener("keydown", function(e) {
      if (e.key === "Enter") checkPassword();
    });
  }

  if (sessionStorage.getItem("numo_reseller_logged_in") === "YES") {
    restoreSession();
  }
}

window.addEventListener("load", function() {
  const frame = document.getElementById("configFrame");
  if (frame) {
    frame.addEventListener("load", initPage);
    setTimeout(initPage, 800);
  } else {
    initPage();
  }
});
