const API_URL = "https://script.google.com/macros/s/AKfycbzI4RbRYqWrMLAoAEGYI9QrgDdRDgycXhDchid64w8RIdxkbT8JKoexCso1C3mdl1tY/exec";

const state = {
  products: [],
  filteredProducts: [],
  movements: [],
  loading: false,
};

const el = {
  totalProductCount: document.getElementById("totalProductCount"),
  totalStockCount: document.getElementById("totalStockCount"),
  criticalStockCount: document.getElementById("criticalStockCount"),

  refreshBtn: document.getElementById("refreshBtn"),

  productForm: document.getElementById("productForm"),
  productId: document.getElementById("productId"),
  barcode: document.getElementById("barcode"),
name: document.getElementById("name"),
productBrand: document.getElementById("productBrand"),
category: document.getElementById("category"),
subCategory: document.getElementById("subCategory"),
carBrand: document.getElementById("carBrand"),
carModel: document.getElementById("carModel"),
carType: document.getElementById("carType"),
variant: document.getElementById("variant"),
stock: document.getElementById("stock"),
minStock: document.getElementById("minStock"),
location: document.getElementById("location"),
note: document.getElementById("note"),
  saveProductBtn: document.getElementById("saveProductBtn"),
  clearProductBtn: document.getElementById("clearProductBtn"),

  movementSearchInput: document.getElementById("movementSearchInput"),
movementSearchList: document.getElementById("movementSearchList"),

  searchInput: document.getElementById("searchInput"),
  productTableBody: document.getElementById("productTableBody"),
  movementList: document.getElementById("movementList"),
  toast: document.getElementById("toast"),
};

function showToast(message, isError = false) {
  el.toast.textContent = message;
  el.toast.classList.remove("hidden");
  el.toast.style.borderColor = isError ? "rgba(220,38,38,0.5)" : "rgba(22,163,74,0.5)";
  setTimeout(() => el.toast.classList.add("hidden"), 2500);
}

function formatMoney(value) {
  const num = Number(value || 0);
  return num.toLocaleString("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  });
}

function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("tr-TR");
}

function calculateMovementTotal() {
  const qty = Number(el.moveQuantity.value || 0);
  const unitPrice = Number(el.moveUnitPrice.value || 0);
  el.moveTotal.value = formatMoney(qty * unitPrice);
}

async function api(action, payload = {}) {
  if (!API_URL || API_URL.includes("BURAYA_APPS_SCRIPT")) {
    throw new Error("API_URL henüz tanımlanmadı.");
  }

  const isReadAction = action === "listProducts" || action === "listMovements";

  let res;

  if (isReadAction) {
    const query = new URLSearchParams({ action, ...payload }).toString();
    res = await fetch(`${API_URL}?${query}`, {
      method: "GET",
    });
  } else {
    const formData = new URLSearchParams();
    formData.append("action", action);

    Object.entries(payload).forEach(([key, value]) => {
      formData.append(key, value ?? "");
    });

    res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: formData.toString(),
    });
  }

  const text = await res.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Sunucudan JSON dönmedi: " + text);
  }

  if (!data.ok) {
    throw new Error(data.message || "Bilinmeyen bir hata oluştu.");
  }

  return data;
}

async function loadProducts() {
  const data = await api("listProducts");
  state.products = Array.isArray(data.products) ? data.products : [];
  applySearch();
  updateStats();
}

async function loadMovements() {
  const data = await api("listMovements");
  state.movements = Array.isArray(data.movements) ? data.movements : [];
  renderMovements();
}

async function loadAll() {
  try {
    setLoading(true);
    await Promise.all([loadProducts(), loadMovements()]);
  } catch (err) {
    console.error(err);
    showToast(err.message || "Veriler yüklenemedi", true);
  } finally {
    setLoading(false);
  }
}

function setLoading(flag) {
  state.loading = flag;
  el.refreshBtn.disabled = flag;
  el.saveProductBtn.disabled = flag;
  el.movementSearchInput.disabled = flag;

  el.refreshBtn.textContent = flag ? "Yükleniyor..." : "Yenile";
  el.saveProductBtn.textContent = flag ? "Kaydediliyor..." : "Ürünü Kaydet";
}

function updateStats() {
  const totalProduct = state.products.length;
  const totalStock = state.products.reduce((sum, p) => sum + Number(p.stock || 0), 0);
  const critical = state.products.filter((p) => Number(p.stock || 0) <= Number(p.minStock || 0)).length;

  el.totalProductCount.textContent = totalProduct;
  el.totalStockCount.textContent = totalStock;
  el.criticalStockCount.textContent = critical;
}

function applySearch() {
  const q = (el.searchInput.value || "").trim().toLowerCase();

  state.filteredProducts = state.products.filter((p) => {
    const text = [
      p.name,
      p.productBrand,
      p.category,
      p.subCategory,
      p.carBrand,
      p.carModel,
      p.carType,
      p.variant
    ].join(" ").toLowerCase();

    return text.includes(q);
  });

  renderProducts();
}

function renderProducts() {
  if (!state.filteredProducts.length) {
    el.productTableBody.innerHTML = `
      <tr>
        <td colspan="13" class="empty-cell">Kayıt bulunamadı</td>
      </tr>
    `;
    return;
  }

  el.productTableBody.innerHTML = state.filteredProducts.map((p) => {
  const isLow = Number(p.stock || 0) <= Number(p.minStock || 0);

  return `
    <tr>
      <td>${escapeHtml(p.barcode || "-")}</td>
      <td>${escapeHtml(p.name || "-")}</td>
      <td>${escapeHtml(p.productBrand || "-")}</td>
      <td>${escapeHtml(p.category || "-")}</td>
      <td>${escapeHtml(p.subCategory || "-")}</td>
      <td>${escapeHtml(p.carBrand || "-")}</td>
      <td>${escapeHtml(p.carModel || "-")}</td>
      <td>${escapeHtml(p.carType || "-")}</td>
      <td>${escapeHtml(p.variant || "-")}</td>
      <td class="${isLow ? "low-stock" : ""}">${Number(p.stock || 0)}</td>
      <td>${Number(p.minStock || 0)}</td>
      <td>${escapeHtml(p.location || "-")}</td>
      <td>
        <div class="action-group">
          <button class="action-btn edit" onclick="editProduct('${String(p.id || "").replace(/'/g, "\\'")}')">Düzenle</button>
          <button class="action-btn delete" onclick="deleteProduct('${String(p.id || "").replace(/'/g, "\\'")}')">Sil</button>
        </div>
      </td>
    </tr>
  `;
}).join("");
}

function renderMovements() {
  if (!state.movements.length) {
    el.movementList.innerHTML = `<div class="empty-state">Henüz hareket yok</div>`;
    return;
  }

  el.movementList.innerHTML = state.movements.map((m) => {
    const typeClass = (m.type || "").toUpperCase() === "GIRIS" ? "giris" : "cikis";
    const typeLabel = (m.type || "").toUpperCase() === "GIRIS" ? "Giriş" : "Çıkış";

    return `
      <div class="movement-item">
        <div class="movement-top">
          <div>
            <strong>${escapeHtml(m.name || "-")}</strong>
            <div class="muted">${escapeHtml(m.barcode || "-")}</div>
          </div>
          <div>
            <span class="badge ${typeClass}">${typeLabel}</span>
          </div>
        </div>

        <div>Miktar: <strong>${Number(m.quantity || 0)}</strong></div>
        <div>Birim Fiyat: <strong>${formatMoney(m.unitPrice || 0)}</strong></div>
        <div>Tutar: <strong>${formatMoney(m.total || 0)}</strong></div>
        <div>Tarih: <strong>${formatDate(m.date)}</strong></div>
        <div>Not: <strong>${escapeHtml(m.note || "-")}</strong></div>
      </div>
    `;
  }).join("");
}
function renderMovementSearchResults() {
  const q = (el.movementSearchInput.value || "").trim().toLowerCase();

  if (!q) {
    el.movementSearchList.innerHTML = `<div class="empty-state">Arama yaparak ürün seç</div>`;
    return;
  }

  const results = state.products.filter((p) => {
    const text = [
      p.name,
      p.productBrand,
      p.category,
      p.subCategory,
      p.carBrand,
      p.carModel,
      p.carType,
      p.variant,
      p.barcode
    ].join(" ").toLowerCase();

    return text.includes(q);
  });

  if (!results.length) {
    el.movementSearchList.innerHTML = `<div class="empty-state">Eşleşen ürün bulunamadı</div>`;
    return;
  }

  el.movementSearchList.innerHTML = results.map((p) => `
    <div class="movement-search-item">
      <div class="movement-search-info">
        <strong>${escapeHtml(p.name || "-")}</strong>
        <div class="muted">${escapeHtml(p.category || "-")} / ${escapeHtml(p.subCategory || "-")}</div>
        <div class="muted">
          ${escapeHtml(p.carBrand || "-")} ${escapeHtml(p.carModel || "-")} ${escapeHtml(p.carType || "-")} ${escapeHtml(p.variant || "")}
        </div>
        <div class="muted">
          Barkod: ${escapeHtml(p.barcode || "-")} | Stok: <strong>${Number(p.stock || 0)}</strong>
        </div>
      </div>

      <div class="movement-search-actions">
        <button class="btn success" onclick="quickStockAction('${String(p.id || "").replace(/'/g, "\\'")}', 'GIRIS')">Giriş</button>
        <button class="btn danger" onclick="quickStockAction('${String(p.id || "").replace(/'/g, "\\'")}', 'CIKIS')">Çıkış</button>
      </div>
    </div>
  `).join("");
}

function clearProductForm() {
  el.productId.value = "";
  el.barcode.value = "";
  el.name.value = "";
  el.productBrand.value = "";
  el.category.value = "";
  el.subCategory.value = "";
  el.carBrand.value = "";
  el.carModel.value = "";
  el.carType.value = "";
  el.variant.value = "";
  el.stock.value = "";
  el.minStock.value = "";
  el.location.value = "";
  el.note.value = "";
}

function clearMovementForm() {
  el.movementSearchInput.value = "";
  el.movementSearchList.innerHTML = `<div class="empty-state">Arama yaparak ürün seç</div>`;
}

function fillProductForm(product) {
  el.productId.value = product.id || "";
  el.barcode.value = product.barcode || "";
  el.name.value = product.name || "";
  el.productBrand.value = product.productBrand || "";
  el.category.value = product.category || "";
  el.subCategory.value = product.subCategory || "";
  el.carBrand.value = product.carBrand || "";
  el.carModel.value = product.carModel || "";
  el.carType.value = product.carType || "";
  el.variant.value = product.variant || "";
  el.stock.value = product.stock ?? "";
  el.minStock.value = product.minStock ?? "";
  el.location.value = product.location || "";
  el.note.value = product.note || "";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function findProductByBarcode(barcode) {
  return state.products.find((p) => String(p.barcode || "").trim() === String(barcode || "").trim());
}

window.editProduct = function(id) {
  const product = state.products.find((p) => String(p.id) === String(id));
  if (!product) {
    showToast("Ürün bulunamadı", true);
    return;
  }
  fillProductForm(product);
};

window.deleteProduct = async function(id) {
  const ok = confirm("Bu ürünü silmek istediğine emin misin?");
  if (!ok) return;

  try {
    setLoading(true);
    await api("deleteProduct", { id });
    showToast("Ürün silindi");
    await loadAll();
  } catch (err) {
    console.error(err);
    showToast(err.message || "Ürün silinemedi", true);
  } finally {
    setLoading(false);
  }
};
window.quickStockAction = async function(id, type) {
  const product = state.products.find((p) => String(p.id) === String(id));

  if (!product) {
    showToast("Ürün bulunamadı", true);
    return;
  }

  const qtyText = prompt(
    `${product.name} için ${type === "GIRIS" ? "giriş" : "çıkış"} miktarı gir:`,
    "1"
  );

  if (qtyText === null) return;

  const quantity = Number(qtyText);
  if (!quantity || quantity <= 0) {
    showToast("Geçerli bir miktar gir", true);
    return;
  }

  const ok = confirm(
    `${product.name} için ${quantity} adet ${type === "GIRIS" ? "giriş" : "çıkış"} yapılsın mı?`
  );

  if (!ok) return;

  try {
    setLoading(true);

    await api("saveMovement", {
      barcode: product.barcode || "",
      name: product.name || "",
      type,
      quantity,
      unitPrice: 0,
      note: `Hızlı ${type === "GIRIS" ? "giriş" : "çıkış"}`
    });

    showToast(`${product.name} için hareket kaydedildi`);
    await loadAll();
    renderMovementSearchResults();
  } catch (err) {
    console.error(err);
    showToast(err.message || "Hareket kaydedilemedi", true);
  } finally {
    setLoading(false);
  }
};
function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

el.productForm.addEventListener("submit", async (e) => {
  e.preventDefault();

const payload = {
  id: el.productId.value.trim(),
  barcode: el.barcode.value.trim(),
  name: el.name.value.trim(),
  productBrand: el.productBrand.value.trim(),
  category: el.category.value.trim(),
  subCategory: el.subCategory.value.trim(),
  carBrand: el.carBrand.value.trim(),
  carModel: el.carModel.value.trim(),
  carType: el.carType.value.trim(),
  variant: el.variant.value.trim(),
  stock: el.stock.value.trim(),
  minStock: el.minStock.value.trim(),
  location: el.location.value.trim(),
  note: el.note.value.trim(),
};

  if (!payload.name) return showToast("Ürün adı zorunlu", true);

  try {
    setLoading(true);
    await api("saveProduct", payload);
    showToast(payload.id ? "Ürün güncellendi" : "Ürün kaydedildi");
    clearProductForm();
    await loadProducts();
  } catch (err) {
    console.error(err);
    showToast(err.message || "Ürün kaydedilemedi", true);
  } finally {
    setLoading(false);
  }
});


el.clearProductBtn.addEventListener("click", clearProductForm);

el.refreshBtn.addEventListener("click", loadAll);
el.searchInput.addEventListener("input", applySearch);
el.movementSearchInput.addEventListener("input", renderMovementSearchResults);

el.moveBarcode.addEventListener("change", () => {
  const product = findProductByBarcode(el.moveBarcode.value);
  if (product) {
    el.moveName.value = product.name || "";
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(console.error);
  });
}
function switchTab(tab) {
  document.getElementById("page-search").classList.add("hidden");
  document.getElementById("page-add").classList.add("hidden");
  document.getElementById("page-movements").classList.add("hidden");

  document.getElementById("page-" + tab).classList.remove("hidden");
}


clearMovementForm();
loadAll();
