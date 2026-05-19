function getPageConfig() {
  return window.NUMO_PAGE_CONFIG || {};
}

function getButtonText() {
  return window.NUMO_BUTTON_TEXT || {};
}

function setText(id, value, isHtml = false) {
  const el = document.getElementById(id);

  if (!el || value === undefined || value === null) return;

  if (isHtml) {
    el.innerHTML = value;
  } else {
    el.textContent = value;
  }
}

function applyTextConfig() {
  const config = getPageConfig();
  const buttonText = getButtonText();
  const text = config.TEXT || {};

  setText("brandTitle", text.brandTitle);
  setText("brandSubtitle", text.brandSubtitle);
  setText("topNotice", text.topNotice);
  setText("stockTitle", text.stockTitle);
  setText("paymentTitle", text.paymentTitle);
  setText("paymentInstruction", text.paymentInstruction, true);
  setText("paymentNote", text.paymentNote, true);
  setText("footerText", text.footerText);

  setText("refreshButton", buttonText.refreshButton);
  setText("orderButton", buttonText.orderButton);

  const orderButton = document.getElementById("orderButton");
  if (orderButton) {
    orderButton.href = config.RESELLER_BOT_LINK || "#";
  }

  renderPaymentQr();
}

function renderPaymentQr() {
  const config = getPageConfig();
  const qrContainer = document.getElementById("qrContainer");

  if (!qrContainer) return;

  if (config.PAYMENT_QR_IMAGE) {
    qrContainer.innerHTML = `
      <img class="qr-image" src="${escapeHtml(config.PAYMENT_QR_IMAGE)}" alt="QR Payment" />
    `;
  } else {
    qrContainer.innerHTML = `
      <div class="qr-placeholder">LETAK QR PAYMENT DI SINI</div>
    `;
  }
}

function jsonp(url) {
  return new Promise((resolve, reject) => {
    const callbackName = "jsonp_callback_" + Date.now() + "_" + Math.round(100000 * Math.random());

    window[callbackName] = function(data) {
      delete window[callbackName];
      if (script && script.parentNode) {
        script.parentNode.removeChild(script);
      }
      resolve(data);
    };

    const script = document.createElement("script");
    script.src = url + (url.includes("?") ? "&" : "?") + "callback=" + callbackName;

    script.onerror = function() {
      delete window[callbackName];
      if (script && script.parentNode) {
        script.parentNode.removeChild(script);
      }
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
  const config = getPageConfig();
  const buttonText = getButtonText();
  const stockList = document.getElementById("stockList");
  const updatedAt = document.getElementById("updatedAt");

  if (!stockList) return;

  stockList.innerHTML = `<div class="loading">${buttonText.loadingText || "Loading stock..."}</div>`;

  if (updatedAt) updatedAt.textContent = "";

  try {
    const apiUrl = config.RESELLER_STOCK_API_URL || "";

    if (!apiUrl || apiUrl.includes("PASTE_")) {
      throw new Error("RESELLER_STOCK_API_URL belum diset");
    }

    const data = await jsonp(apiUrl + "?mode=resellerStock");

    if (!data.ok) {
      throw new Error(data.error || "API error");
    }

    renderStock(data.products || []);

    if (updatedAt) {
      updatedAt.textContent = `${buttonText.lastUpdatedText || "Last updated:"} ${formatDate(data.updatedAt)}`;
    }
  } catch (err) {
    stockList.innerHTML = `
      <div class="error">
        ${buttonText.errorText || "Gagal load stock.<br />Sila refresh semula atau hubungi admin."}
      </div>
    `;
  }
}

function renderStock(products) {
  const config = getPageConfig();
  const buttonText = getButtonText();
  const pricesConfig = config.PRICES || {};
  const stockList = document.getElementById("stockList");

  if (!stockList) return;

  if (!products.length) {
    stockList.innerHTML = `<div class="loading">${buttonText.noDataText || "Tiada data stock."}</div>`;
    return;
  }

  stockList.innerHTML = products.map(product => {
    const prices = pricesConfig[product.key] || [];

    return `
      <div class="stock-item" data-product="${escapeHtml(product.key)}">
        <button class="stock-head" type="button" onclick="togglePrice('${escapeJs(product.key)}')">
          <div class="product-left">
            <div class="product-icon">${escapeHtml(product.icon || "📦")}</div>
            <div>
              <div class="product-name">${escapeHtml(product.name || "Produk")}</div>
              <div class="slot-count">
                ${escapeHtml(String(product.available || 0))} ${escapeHtml(buttonText.slotText || "slot available")}
              </div>
            </div>
          </div>

          <div class="badge ${escapeHtml(product.statusClass || "out")}">
            ${escapeHtml(product.status || "Habis Stok")}
          </div>
        </button>

        <div class="price-panel">
          ${renderPricePanel(prices)}
        </div>
      </div>
    `;
  }).join("");
}

function renderPricePanel(prices) {
  const buttonText = getButtonText();

  if (!prices || !prices.length) {
    return `
      <div class="small-text">
        ${escapeHtml(buttonText.noPriceText || "Harga belum tersedia. Sila tanya admin.")}
      </div>
    `;
  }

  return `
    <div class="price-title">Harga Pakej</div>

    <div class="price-labels">
      <div>${escapeHtml(buttonText.priceHeaderPlan || "Plan")}</div>
      <div>${escapeHtml(buttonText.priceHeaderReseller || "Reseller")}</div>
      <div>${escapeHtml(buttonText.priceHeaderSell || "Jual Min")}</div>
    </div>

    ${prices.map(item => `
      <div class="price-row">
        <div class="plan-name">${escapeHtml(item.plan || "-")}</div>
        <div class="reseller-price">${escapeHtml(item.reseller || "-")}</div>
        <div class="sell-price">${escapeHtml(item.sell || "-")}</div>
        ${item.note ? `<div class="bonus-note">🎁 ${escapeHtml(item.note)}</div>` : ""}
      </div>
    `).join("")}
  `;
}

function togglePrice(productKey) {
  const item = document.querySelector(`.stock-item[data-product="${CSS.escape(productKey)}"]`);
  if (!item) return;
  item.classList.toggle("open");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeJs(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll("'", "\\'");
}

function waitForConfigAndInit() {
  const frame = document.getElementById("configFrame");

  function initNow() {
    if (frame && frame.contentWindow && frame.contentWindow.NUMO_PAGE_CONFIG) {
      window.NUMO_PAGE_CONFIG = frame.contentWindow.NUMO_PAGE_CONFIG;
    }

    applyTextConfig();
    loadStock();
  }

  if (frame) {
    frame.addEventListener("load", initNow, { once: true });

    // Backup kalau iframe load event terlepas.
    setTimeout(() => {
      if (!window.NUMO_PAGE_HAS_INIT) {
        window.NUMO_PAGE_HAS_INIT = true;
        initNow();
      }
    }, 800);
  } else {
    initNow();
  }
}

window.addEventListener("load", () => {
  if (window.NUMO_PAGE_HAS_INIT) return;
  window.NUMO_PAGE_HAS_INIT = true;
  waitForConfigAndInit();
});
