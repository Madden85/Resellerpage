let PAGE_CONFIG = {};
let BUTTON_TEXT = window.NUMO_BUTTON_TEXT || {};

async function loadPageConfig() {
  try {
    const res = await fetch("index2.html?v=" + Date.now(), { cache: "no-store" });
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const configEl = doc.getElementById("numoConfig");

    if (!configEl) {
      throw new Error("Config tidak jumpa dalam index2.html");
    }

    PAGE_CONFIG = JSON.parse(configEl.textContent.trim());
  } catch (err) {
    console.error("Gagal load config:", err);
    PAGE_CONFIG = {};
  }
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
  setText("topNotice", TEXT.topNotice);
  setText("stockTitle", TEXT.stockTitle);
  setText("paymentTitle", TEXT.paymentTitle);
  setText("paymentInstruction", TEXT.paymentInstruction, true);
  setText("paymentNote", TEXT.paymentNote, true);
  setText("footerText", TEXT.footerText);
  setText("refreshButton", BUTTON_TEXT.refreshButton);
  setText("orderButton", BUTTON_TEXT.orderButton);

  const orderButton = document.getElementById("orderButton");
  if (orderButton) {
    let botLink = PAGE_CONFIG.RESELLER_BOT_LINK || "https://t.me/NumoReseller_bot";
    if (botLink && !botLink.startsWith("http")) {
      botLink = "https://t.me/" + botLink.replace("@", "");
    }
    orderButton.href = botLink;
  }

  renderPaymentQr();
}

function renderPaymentQr() {
  const qrContainer = document.getElementById("qrContainer");
  if (!qrContainer) return;

  const qrImage = PAGE_CONFIG.PAYMENT_QR_IMAGE || "./paymentqr.jpg";

  if (qrImage) {
    qrContainer.innerHTML = `<img class="qr-image" src="${qrImage}?v=${Date.now()}" alt="QR Payment" />`;
  } else {
    qrContainer.innerHTML = `<div class="qr-placeholder">LETAK QR PAYMENT DI SINI</div>`;
  }
}

function jsonp(url) {
  return new Promise((resolve, reject) => {
    const callbackName = "jsonp_callback_" + Math.round(100000 * Math.random());

    window[callbackName] = function(data) {
      delete window[callbackName];
      document.body.removeChild(script);
      resolve(data);
    };

    const script = document.createElement("script");
    script.src = url + (url.includes("?") ? "&" : "?") + "callback=" + callbackName;

    script.onerror = function() {
      delete window[callbackName];
      document.body.removeChild(script);
      reject(new Error("Gagal load data stock"));
    };

    document.body.appendChild(script);
  });
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

async function loadStock() {
  const stockList = document.getElementById("stockList");
  const updatedAt = document.getElementById("updatedAt");
  if (!stockList) return;

  stockList.innerHTML = `<div class="loading">${BUTTON_TEXT.loadingText || "Loading stock..."}</div>`;
  if (updatedAt) updatedAt.textContent = "";

  try {
    const apiUrl = PAGE_CONFIG.RESELLER_STOCK_API_URL || "https://script.google.com/macros/s/AKfycbxNGsUEvcHCngNotv3qRmnBYi4VAX9XU7fPv7Mv7cqyl3LT3WdjT9ZsuSu9I-GI43qS2Q/exec";
    const data = await jsonp(apiUrl + "?mode=resellerStock");

    if (!data.ok) {
      throw new Error(data.error || "API error");
    }

    renderStock(data.products || []);

    if (updatedAt) {
      updatedAt.textContent = `${BUTTON_TEXT.lastUpdatedText || "Last updated:"} ${formatDate(data.updatedAt)}`;
    }
  } catch (err) {
    console.error("Stock error:", err);
    stockList.innerHTML = `<div class="error">${BUTTON_TEXT.errorText || "Gagal load stock.<br />Sila refresh semula atau hubungi admin."}</div>`;
  }
}

function renderStock(products) {
  const stockList = document.getElementById("stockList");
  const PRICES = PAGE_CONFIG.PRICES || {};
  if (!stockList) return;

  if (!products.length) {
    stockList.innerHTML = `<div class="loading">${BUTTON_TEXT.noDataText || "Tiada data stock."}</div>`;
    return;
  }

  stockList.innerHTML = products.map(product => {
    const prices = PRICES[product.key] || [];
    return `
      <div class="stock-item" data-product="${product.key}">
        <button class="stock-head" type="button" onclick="togglePrice('${product.key}')">
          <div class="product-left">
            <div class="product-icon">${product.icon || "📦"}</div>
            <div>
              <div class="product-name">${product.name}</div>
              <div class="slot-count">${product.available} ${BUTTON_TEXT.slotText || "slot available"}</div>
            </div>
          </div>
          <div class="badge ${product.statusClass}">${product.status}</div>
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
        <div class="plan-name">${item.plan}</div>
        <div class="reseller-price">${item.reseller}</div>
        <div class="sell-price">${item.sell}</div>
        ${item.note ? `<div class="bonus-note">🎁 ${item.note}</div>` : ""}
      </div>
    `).join("")}
  `;
}

function togglePrice(productKey) {
  const item = document.querySelector(`.stock-item[data-product="${productKey}"]`);
  if (!item) return;
  item.classList.toggle("open");
}

async function initPage() {
  await loadPageConfig();
  applyTextConfig();
  loadStock();
}

window.addEventListener("DOMContentLoaded", initPage);
