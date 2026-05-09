const SUPABASE_URL = "https://dmsovrbkoeivkvmlzals.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtc292cmJrb2Vpdmt2bWx6YWxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNTg3NTMsImV4cCI6MjA5MjkzNDc1M30.Tf_8-AEkON4hvKsWiljiDV5z_LJW7KUebIkU-0R8x_A";
const VAPID_PUBLIC_KEY = "BAi5RqXIHt50gvHTCOLT0XJxzW6f8OB_pYt_JN4nOKIIP8Cj9KkUu44hsLRZKLxxOKrZVdPFX_c5qc141bJt4Hc";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const state = {
  products: [], filteredProducts: [], movements: [], stockRequests: [], requestFilter: "all",
  activeTab: "requests", loading: false, selectedStockRequestId: null, seenRequestIds: new Set(), realtimeReady: false, newRequestCount: 0,
highlightRequestIds: new Set(),
originalTitle: document.title,
  saleCart: [],
  lastQuickSale: null,
};

const el = {
  totalProductCount: document.getElementById("totalProductCount"), totalStockCount: document.getElementById("totalStockCount"), reservedStockCount: document.getElementById("reservedStockCount"), criticalStockCount: document.getElementById("criticalStockCount"),
  refreshBtn: document.getElementById("refreshBtn"), enableNotifyBtn: document.getElementById("enableNotifyBtn"), productForm: document.getElementById("productForm"), productId: document.getElementById("productId"), barcode: document.getElementById("barcode"),
  productBrand: document.getElementById("productBrand"), category: document.getElementById("category"), carBrand: document.getElementById("carBrand"), carModel: document.getElementById("carModel"), carType: document.getElementById("carType"), vehicleYear: document.getElementById("vehicleYear"), stock: document.getElementById("stock"), minStock: document.getElementById("minStock"), location: document.getElementById("location"), note: document.getElementById("note"),
  saveProductBtn: document.getElementById("saveProductBtn"), clearProductBtn: document.getElementById("clearProductBtn"), movementSearchInput: document.getElementById("movementSearchInput"), movementSearchList: document.getElementById("movementSearchList"), searchInput: document.getElementById("searchInput"), productTableBody: document.getElementById("productTableBody"), movementList: document.getElementById("movementList"),
  stockRequestsBox: document.getElementById("stockRequestsBox"), reservationPanel: document.getElementById("reservationPanel"), requestedTextBox: document.getElementById("requestedTextBox"), productSearchInput: document.getElementById("productSearchInput"), productMatchBox: document.getElementById("productMatchBox"), toast: document.getElementById("toast"),
  saleSearchInput: document.getElementById("saleSearchInput"), saleProductList: document.getElementById("saleProductList"), saleCartList: document.getElementById("saleCartList"), saleTotal: document.getElementById("saleTotal"), salePaymentType: document.getElementById("salePaymentType"), saleCustomerNote: document.getElementById("saleCustomerNote"), completeSaleBtn: document.getElementById("completeSaleBtn"), clearSaleBtn: document.getElementById("clearSaleBtn"), todaySaleTotal: document.getElementById("todaySaleTotal"), todaySaleQty: document.getElementById("todaySaleQty"), todayCashTotal: document.getElementById("todayCashTotal"), todayCardTotal: document.getElementById("todayCardTotal"), topSaleProducts: document.getElementById("topSaleProducts"), currentStaffSelect: document.getElementById("currentStaffSelect"), staffRoleBadge: document.getElementById("staffRoleBadge"), staffEditor: document.getElementById("staffEditor"), staffEditorBody: document.getElementById("staffEditorBody"), printLastSaleBtn: document.getElementById("printLastSaleBtn"), cancelLastSaleBtn: document.getElementById("cancelLastSaleBtn")
};

function showToast(message, isError = false) {
  el.toast.textContent = message; el.toast.classList.remove("hidden");
  el.toast.style.borderColor = isError ? "rgba(220,38,38,0.5)" : "rgba(22,163,74,0.5)";
  setTimeout(() => el.toast.classList.add("hidden"), 3500);
}
function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function normalizeText(value) { return String(value || "").toLocaleLowerCase("tr-TR").trim(); }
function formatDate(value) { if (!value) return "-"; const d = new Date(value); if (Number.isNaN(d.getTime())) return value; return d.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" }); }
function buildProductName(row) { return [row.product_brand, row.category, row.vehicle_brand, row.vehicle_model, row.vehicle_type, row.vehicle_year].filter(Boolean).join(" ").replace(/\s+/g, " ").trim(); }
function mapProduct(row) {
  return { id: row.id || "", barcode: row.barcode || "", name: row.product_name || buildProductName(row), productBrand: row.product_brand || "", category: row.category || "", carBrand: row.vehicle_brand || "", carModel: row.vehicle_model || "", carType: row.vehicle_type || "", vehicleYear: row.vehicle_year || "", stock: Number(row.quantity || 0), reserved: Number(row.reserved_quantity || 0), minStock: Number(row.min_stock || 0), location: row.location || "", note: row.note || "", createdAt: row.created_at || "" };
}
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

function updateNotifyButtonUI(isWorking = false) {
  if (!el.enableNotifyBtn) return;

  if (isWorking) {
    el.enableNotifyBtn.textContent = "Bildirim Açılıyor...";
    el.enableNotifyBtn.disabled = true;
    return;
  }

  if ("Notification" in window && Notification.permission === "granted") {
    el.enableNotifyBtn.textContent = "Bildirim Açık ✅";
    el.enableNotifyBtn.classList.remove("ghost");
    el.enableNotifyBtn.classList.add("success");
    el.enableNotifyBtn.disabled = true;
  } else {
    el.enableNotifyBtn.textContent = "Bildirim Aç";
    el.enableNotifyBtn.classList.remove("success");
    el.enableNotifyBtn.classList.add("ghost");
    el.enableNotifyBtn.disabled = false;
  }
}

async function enablePushNotifications() {
  try {
    updateNotifyButtonUI(true);

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      showToast("Bu cihaz push bildirim desteklemiyor", true);
      updateNotifyButtonUI(false);
      return;
    }

    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      showToast("Bildirim izni verilmedi", true);
      updateNotifyButtonUI(false);
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }

    const res = await fetch("/api/subscribe-push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription)
    });

    const data = await res.json();

    if (!data.ok) {
      throw new Error(data.message || "Push aboneliği kaydedilemedi");
    }

    updateNotifyButtonUI(false);
    showToast("Bildirim açık ✅");
  } catch (err) {
    console.error("Bildirim açma hatası:", err);
    updateNotifyButtonUI(false);
    showToast(err.message || "Bildirim açılamadı", true);
  }
}
function playNotificationSound() {
  try {
    const audio = new Audio("./notification.mp3");
    audio.volume = 1;
    audio.play().catch((err) => {
      console.warn("Ses otomatik çalınamadı:", err);
    });
  } catch (err) {
    console.warn("Bildirim sesi hatası:", err);
  }
}
function toProductRow(payload) {
  const productName = [payload.productBrand, payload.category, payload.carBrand, payload.carModel, payload.carType, payload.vehicleYear].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  return { barcode: payload.barcode || null, product_name: productName || payload.category, product_brand: payload.productBrand || null, category: payload.category || null, vehicle_brand: payload.carBrand || null, vehicle_model: payload.carModel || null, vehicle_type: payload.carType || null, vehicle_year: payload.vehicleYear || null, quantity: Number(payload.stock || 0), min_stock: Number(payload.minStock || 0), location: payload.location || null, note: payload.note || null };
}
function formatRequestStatus(status) { return ({ bekliyor: "Bekliyor", rezerve_edildi: "Rezerve", teslim_edildi: "Teslim Edildi", montaj_bitti: "Tamamlandı", iptal: "İptal" })[status] || status || "-"; }
function requestVehicleText(req) {
  return [req?.vehicle_brand, req?.vehicle_model, req?.vehicle_type, req?.vehicle_year].filter(Boolean).join(" ");
}

function renderSelectedRequestDetail(req) {
  const vehicleText = requestVehicleText(req);
  el.requestedTextBox.innerHTML = `
    <div style="font-weight:700;color:#fff;">${escapeHtml(req?.requested_text || "-")}</div>
    <div class="muted">${escapeHtml(vehicleText || "Araç bilgisi yok")}</div>
  `;
}
function updateNewRequestAlert() {
  const alertBox = document.getElementById("newRequestAlert");
  const alertText = document.getElementById("newRequestAlertText");

  if (!alertBox || !alertText) return;

  if (state.newRequestCount > 0) {
    alertBox.classList.remove("hidden");
    alertText.textContent = `${state.newRequestCount} yeni depo talebi var`;
    document.title = `(${state.newRequestCount}) Depo Talebi`;
  } else {
    alertBox.classList.add("hidden");
    document.title = state.originalTitle || "Stok Takip";
  }
}

window.clearNewRequestAlert = function() {
  state.newRequestCount = 0;
  state.highlightRequestIds.clear();
  updateNewRequestAlert();
  renderStockRequests();
};
function setLoading(flag) { state.loading = flag; el.refreshBtn.disabled = flag; el.saveProductBtn.disabled = flag; el.movementSearchInput.disabled = flag; el.refreshBtn.textContent = flag ? "Yükleniyor..." : "Yenile"; el.saveProductBtn.textContent = flag ? "Kaydediliyor..." : "Ürünü Kaydet"; }

async function loadProducts() { const { data, error } = await supabaseClient.from("stock_products").select("*").order("product_name", { ascending: true }); if (error) throw error; state.products = (data || []).map(mapProduct); applySearch(); updateStats(); refreshProductQuickLists(); if (typeof renderSaleProducts === "function") renderSaleProducts(); }
async function loadMovements() { const { data, error } = await supabaseClient.from("stock_movements").select("*, stock_products(product_name, barcode)").order("created_at", { ascending: false }).limit(300); if (error) throw error; state.movements = data || []; renderMovements(); if (typeof renderSaleDashboard === "function") renderSaleDashboard(); }
async function loadStockRequests() {
  const { data, error } = await supabaseClient.from("stock_requests").select("*").in("status", ["bekliyor", "rezerve_edildi", "teslim_edildi", "montaj_bitti", "iptal"]).order("created_at", { ascending: false }).limit(150);
  if (error) { el.stockRequestsBox.innerHTML = `<div class="empty-state">Talep alınamadı: ${escapeHtml(error.message)}</div>`; return; }
  state.stockRequests = data || []; state.stockRequests.forEach((r) => state.seenRequestIds.add(r.id)); renderStockRequests();
}
window.loadStockRequests = loadStockRequests;
async function loadAll() { try { setLoading(true); await Promise.all([loadProducts(), loadMovements(), loadStockRequests()]); } catch (err) { console.error(err); showToast(err.message || "Veriler yüklenemedi", true); } finally { setLoading(false); } }
function updateStats() { const totalProduct = state.products.length; const totalStock = state.products.reduce((sum, p) => sum + Number(p.stock || 0), 0); const reserved = state.products.reduce((sum, p) => sum + Number(p.reserved || 0), 0); const critical = state.products.filter((p) => (Number(p.stock || 0) - Number(p.reserved || 0)) <= Number(p.minStock || 0)).length; el.totalProductCount.textContent = totalProduct; el.totalStockCount.textContent = totalStock; el.reservedStockCount.textContent = reserved; el.criticalStockCount.textContent = critical; }
function uniqueCleanValues(values) {
  return [...new Set((values || []).map(v => String(v || "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "tr"));
}
function setDatalistOptions(id, values) {
  const list = document.getElementById(id);
  if (!list) return;
  list.innerHTML = uniqueCleanValues(values)
    .map(v => `<option value="${escapeHtml(v)}"></option>`)
    .join("");
}
function refreshProductQuickLists() {
  setDatalistOptions("productBrandList", state.products.map(p => p.productBrand));
  setDatalistOptions("categoryList", state.products.map(p => p.category));
  setDatalistOptions("carBrandList", state.products.map(p => p.carBrand));
  setDatalistOptions("carModelList", state.products.map(p => p.carModel));
  setDatalistOptions("carTypeList", state.products.map(p => p.carType));
  setDatalistOptions("locationList", state.products.map(p => p.location));
}

function productSearchText(p) { return normalizeText([p.name, p.productBrand, p.category, p.carBrand, p.carModel, p.carType, p.vehicleYear, p.location, p.note].join(" ")); }
function applySearch() { const q = normalizeText(el.searchInput.value); state.filteredProducts = q ? state.products.filter((p) => productSearchText(p).includes(q)) : state.products; renderProducts(); }
function renderProducts() {
  if (!state.filteredProducts.length) { el.productTableBody.innerHTML = `<tr><td colspan="12" class="empty-cell">Kayıt bulunamadı</td></tr>`; return; }
  el.productTableBody.innerHTML = state.filteredProducts.map((p) => { const available = Number(p.stock || 0) - Number(p.reserved || 0); const isLow = available <= Number(p.minStock || 0); return `<tr><td>${escapeHtml(p.productBrand || "-")}</td><td>${escapeHtml(p.category || "-")}</td><td>${escapeHtml(p.carBrand || "-")}</td><td>${escapeHtml(p.carModel || "-")}</td><td>${escapeHtml(p.carType || "-")}</td><td>${escapeHtml(p.vehicleYear || "-")}</td><td>${Number(p.stock || 0)}</td><td>${Number(p.reserved || 0)}</td><td class="${isLow ? "low-stock" : ""}">${available}</td><td>${Number(p.minStock || 0)}</td><td>${escapeHtml(p.location || "-")}</td><td><div class="action-group"><button class="action-btn edit" onclick="editProduct('${p.id}')">Düzenle</button><button class="action-btn delete" onclick="deleteProduct('${p.id}')">Sil</button></div></td></tr>`; }).join("");
}
function renderMovements() {
  if (!state.movements.length) { el.movementList.innerHTML = `<div class="empty-state">Henüz hareket yok</div>`; return; }
  el.movementList.innerHTML = state.movements.map((m) => { const productName = m.stock_products?.product_name || m.description || "-"; const type = String(m.movement_type || "").toLowerCase(); const typeClass = type.includes("giris") || type.includes("iade") || (type.includes("rezerv") && !type.includes("iptal")) ? "giris" : "cikis"; return `<div class="movement-item"><div class="movement-top"><div><strong>${escapeHtml(productName)}</strong><div class="muted">${escapeHtml(m.description || "-")}</div></div><span class="badge ${typeClass}">${escapeHtml(m.movement_type || "-")}</span></div><div>Miktar: <strong>${Number(m.quantity || 0)}</strong></div><div>Plaka: <strong>${escapeHtml(m.plate || "-")}</strong></div><div>Kayıt No: <strong>${escapeHtml(m.record_no || "-")}</strong></div><div>Tarih: <strong>${formatDate(m.created_at)}</strong></div></div>`; }).join("");
}
function renderMovementSearchResults() {
  const q = normalizeText(el.movementSearchInput.value); if (!q) { el.movementSearchList.innerHTML = `<div class="empty-state">Arama yaparak ürün seç</div>`; return; }
  const results = state.products.filter((p) => productSearchText(p).includes(q)).slice(0, 30); if (!results.length) { el.movementSearchList.innerHTML = `<div class="empty-state">Eşleşen ürün bulunamadı</div>`; return; }
  el.movementSearchList.innerHTML = results.map((p) => { const available = Number(p.stock || 0) - Number(p.reserved || 0); return `<div class="movement-search-item"><div class="movement-search-info"><strong>${escapeHtml(p.category || p.name || "-")}</strong><div class="muted">${escapeHtml(p.productBrand || "-")} / ${escapeHtml(p.carBrand || "-")} ${escapeHtml(p.carModel || "-")} ${escapeHtml(p.carType || "")} ${escapeHtml(p.vehicleYear || "")}</div><div class="muted">Stok: <strong>${p.stock}</strong> | Rezerve: <strong>${p.reserved}</strong> | Kullanılabilir: <strong>${available}</strong></div></div><div class="movement-search-actions"><button class="btn success" onclick="quickStockAction('${p.id}', 'giris')">Giriş</button><button class="btn danger" onclick="quickStockAction('${p.id}', 'cikis')">Çıkış</button></div></div>`; }).join("");
}
function renderStockRequests() {
  let list = state.stockRequests || []; if (state.requestFilter !== "all") list = list.filter(req => req.status === state.requestFilter);
  if (!list.length) { el.stockRequestsBox.innerHTML = `<div class="empty-state">Bu filtrede talep yok</div>`; return; }
  el.stockRequestsBox.innerHTML = list.map((req) => `<div class="movement-item ${state.highlightRequestIds.has(req.id) ? "new-request-glow" : ""}"><div class="movement-top"><div><strong>${escapeHtml(req.plate || "Plaka yok")}</strong><div class="muted">${escapeHtml(req.customer_name || "-")}</div></div><span class="badge status-${escapeHtml(req.status || "bos")}">${formatRequestStatus(req.status)}</span></div><div>Usta: <strong>${escapeHtml(req.technician_name || "-")}</strong></div><div>İstenen: <strong>${escapeHtml(req.requested_text || "-")}</strong></div><div>Araç: <strong>${escapeHtml([
  req.vehicle_brand,
  req.vehicle_model,
  req.vehicle_type
].filter(Boolean).join(" ") || "-")}</strong></div><div>Tarih: <strong>${formatDate(req.created_at)}</strong></div><div class="row-gap" style="margin-top:10px;"><button class="btn primary" onclick="openReservationPanel('${req.id}')">Ürün Eşleştir</button>${req.status === "rezerve_edildi" ? `<button class="btn danger" onclick="cancelReservation('${req.id}')">Rezervi İptal Et</button>` : ""}</div></div>`).join("");
}
window.setRequestFilter = function(status) { state.requestFilter = status; renderStockRequests(); };
function clearProductForm() { [el.productId, el.barcode, el.productBrand, el.category, el.carBrand, el.carModel, el.carType, el.vehicleYear, el.stock, el.minStock, el.location, el.note].forEach((x) => x.value = ""); }
function fillProductForm(product) { el.productId.value = product.id || ""; el.barcode.value = product.barcode || ""; el.productBrand.value = product.productBrand || ""; el.category.value = product.category || ""; el.carBrand.value = product.carBrand || ""; el.carModel.value = product.carModel || ""; el.carType.value = product.carType || ""; el.vehicleYear.value = product.vehicleYear || ""; el.stock.value = product.stock ?? ""; el.minStock.value = product.minStock ?? ""; el.location.value = product.location || ""; el.note.value = product.note || ""; switchTab("add"); window.scrollTo({ top: 0, behavior: "smooth" }); }
window.editProduct = function(id) { const product = state.products.find((p) => String(p.id) === String(id)); if (!product) return showToast("Ürün bulunamadı", true); fillProductForm(product); };
window.deleteProduct = async function(id) { if (!confirm("Bu ürünü silmek istediğine emin misin?")) return; try { setLoading(true); const { error } = await supabaseClient.from("stock_products").delete().eq("id", id); if (error) throw error; showToast("Ürün silindi"); await loadAll(); } catch (err) { console.error(err); showToast(err.message || "Ürün silinemedi", true); } finally { setLoading(false); } };
window.quickStockAction = async function(id, type) {
  const product = state.products.find((p) => String(p.id) === String(id)); if (!product) return showToast("Ürün bulunamadı", true);
  const qtyText = prompt(`${product.category || product.name} için ${type === "giris" ? "giriş" : "çıkış"} miktarı gir:`, "1"); if (qtyText === null) return;
  const quantity = Number(qtyText); if (!quantity || quantity <= 0) return showToast("Geçerli miktar gir", true);
  const available = Number(product.stock || 0) - Number(product.reserved || 0); if (type === "cikis" && available < quantity) return showToast(`Yeterli kullanılabilir stok yok. Kullanılabilir: ${available}`, true);
  if (!confirm(`${product.category || product.name} için ${quantity} adet ${type === "giris" ? "giriş" : "çıkış"} yapılsın mı?`)) return;
  try { setLoading(true); const newQty = type === "giris" ? Number(product.stock) + quantity : Number(product.stock) - quantity; const { error: updateError } = await supabaseClient.from("stock_products").update({ quantity: newQty }).eq("id", id); if (updateError) throw updateError; const { error: movementError } = await supabaseClient.from("stock_movements").insert({ product_id: id, movement_type: type, quantity, description: `Manuel ${type === "giris" ? "stok giriş" : "stok çıkış"}` }); if (movementError) throw movementError; showToast("Hareket kaydedildi"); await loadAll(); renderMovementSearchResults(); } catch (err) { console.error(err); showToast(err.message || "Hareket kaydedilemedi", true); } finally { setLoading(false); }
};

function formatSaleMoney(value) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function saleAvailable(product) {
  return Number(product?.stock || 0) - Number(product?.reserved || 0);
}

function isSameTurkeyDate(value, date = new Date()) {
  if (!value) return false;
  const tr = new Date(value).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" });
  const now = date.toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" });
  return tr === now;
}

function parseSaleMovement(m) {
  const desc = String(m.description || "");
  const movementType = String(m.movement_type || "").toLowerCase();
  const isRefund = movementType === "hizli_satis_iade" || desc.toLocaleLowerCase("tr-TR").includes("hızlı satış iade");
  const isSale = movementType === "hizli_satis" || isRefund || desc.toLocaleLowerCase("tr-TR").includes("hızlı satış");
  if (!isSale) return null;

  const paymentMatch = desc.match(/Hızlı satış \((.*?)\)/i);
  const totalMatch = desc.match(/Toplam:\s*([^\-]+)/i);
  const unitMatch = desc.match(/Birim:\s*([^\-]+)/i);
  const qty = Number(m.quantity || 0);

  const parseMoney = (txt) => {
    const cleaned = String(txt || "")
      .replace(/[^0-9,\.]/g, "")
      .replace(/\./g, "")
      .replace(",", ".");
    return Number(cleaned || 0);
  };

  const total = totalMatch ? parseMoney(totalMatch[1]) : (unitMatch ? parseMoney(unitMatch[1]) * qty : 0);

  return {
    paymentType: paymentMatch ? paymentMatch[1].trim() : "Bilinmiyor",
    total: isRefund ? -Math.abs(total) : total,
    qty: isRefund ? -Math.abs(qty) : qty,
    productName: m.stock_products?.product_name || m.description || "Ürün",
    isRefund
  };
}

function todaySaleStats() {
  const todays = (state.movements || [])
    .filter(m => isSameTurkeyDate(m.created_at))
    .map(parseSaleMovement)
    .filter(Boolean);

  const stats = {
    total: 0,
    qty: 0,
    cash: 0,
    card: 0,
    partial: 0,
    none: 0,
    top: new Map()
  };

  todays.forEach(s => {
    stats.total += Number(s.total || 0);
    stats.qty += Number(s.qty || 0);
    const p = String(s.paymentType || "").toLocaleLowerCase("tr-TR");
    if (p.includes("nakit")) stats.cash += Number(s.total || 0);
    else if (p.includes("kart")) stats.card += Number(s.total || 0);
    else if (p.includes("kısmi") || p.includes("kismi")) stats.partial += Number(s.total || 0);
    else stats.none += Number(s.total || 0);

    const key = s.productName || "Ürün";
    const old = stats.top.get(key) || { name: key, qty: 0, total: 0 };
    old.qty += Number(s.qty || 0);
    old.total += Number(s.total || 0);
    stats.top.set(key, old);
  });

  return stats;
}

function renderSaleDashboard() {
  const stats = todaySaleStats();
  if (el.todaySaleTotal) el.todaySaleTotal.textContent = formatSaleMoney(stats.total);
  if (el.todaySaleQty) el.todaySaleQty.textContent = String(stats.qty || 0);
  if (el.todayCashTotal) el.todayCashTotal.textContent = formatSaleMoney(stats.cash);
  if (el.todayCardTotal) el.todayCardTotal.textContent = formatSaleMoney(stats.card);

  if (el.topSaleProducts) {
    const top = [...stats.top.values()].sort((a, b) => b.qty - a.qty || b.total - a.total).slice(0, 5);
    el.topSaleProducts.innerHTML = top.length ? top.map((item, index) => `
      <div class="top-sale-item">
        <span>${index + 1}</span>
        <div><strong>${escapeHtml(item.name)}</strong><small>${item.qty} adet · ${formatSaleMoney(item.total)}</small></div>
      </div>
    `).join("") : `<div class="empty-state">Henüz hızlı satış yok</div>`;
  }
}



const STAFF_STORE_KEY = "garage_staff_list_v1";
const CURRENT_STAFF_STORE_KEY = "garage_current_staff_v1";
const DEFAULT_STAFF_LIST = [
  { name: "Admin", role: "admin" },
  { name: "Kasa", role: "kasa" },
  { name: "Depo", role: "depo" },
  { name: "Usta", role: "usta" }
];

function normalizeStaffName(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function roleLabel(role) {
  return ({ admin: "Admin", kasa: "Kasa", depo: "Depo", usta: "Usta" })[role] || "Personel";
}

function readStaffList() {
  try {
    const raw = localStorage.getItem(STAFF_STORE_KEY);
    if (!raw) return [...DEFAULT_STAFF_LIST];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_STAFF_LIST];
    const cleaned = parsed
      .map(item => ({ name: normalizeStaffName(item?.name), role: String(item?.role || "kasa") }))
      .filter(item => item.name)
      .slice(0, 30);
    return cleaned.length ? cleaned : [...DEFAULT_STAFF_LIST];
  } catch {
    return [...DEFAULT_STAFF_LIST];
  }
}

function writeStaffList(list) {
  const cleaned = (list || [])
    .map(item => ({ name: normalizeStaffName(item?.name), role: String(item?.role || "kasa") }))
    .filter(item => item.name)
    .filter((item, index, arr) => arr.findIndex(x => x.name.toLocaleLowerCase("tr-TR") === item.name.toLocaleLowerCase("tr-TR")) === index)
    .slice(0, 30);
  localStorage.setItem(STAFF_STORE_KEY, JSON.stringify(cleaned.length ? cleaned : DEFAULT_STAFF_LIST));
  return cleaned.length ? cleaned : [...DEFAULT_STAFF_LIST];
}

function currentStaffName() {
  const saved = localStorage.getItem(CURRENT_STAFF_STORE_KEY);
  const staff = readStaffList();
  if (saved && staff.some(s => s.name === saved)) return saved;
  return staff[0]?.name || "Kasa";
}

function currentStaff() {
  const name = currentStaffName();
  return readStaffList().find(s => s.name === name) || { name, role: "kasa" };
}

function renderStaffSelector() {
  if (!el.currentStaffSelect) return;
  const staff = readStaffList();
  const current = currentStaffName();
  el.currentStaffSelect.innerHTML = staff.map(s => `<option value="${escapeHtml(s.name)}" ${s.name === current ? "selected" : ""}>${escapeHtml(s.name)}</option>`).join("");
  const active = currentStaff();
  if (el.staffRoleBadge) el.staffRoleBadge.textContent = roleLabel(active.role);
}

window.setCurrentStaff = function(name) {
  if (!name) return;
  localStorage.setItem(CURRENT_STAFF_STORE_KEY, name);
  renderStaffSelector();
  showToast(`Aktif personel: ${name} ✅`);
};

function staffEditorRow(item = { name: "", role: "kasa" }) {
  const id = Math.random().toString(36).slice(2);
  return `
    <div class="staff-editor-row" data-staff-row>
      <input data-staff-name value="${escapeHtml(item.name || "")}" placeholder="Personel adı" />
      <select data-staff-role>
        <option value="admin" ${item.role === "admin" ? "selected" : ""}>Admin</option>
        <option value="kasa" ${item.role === "kasa" ? "selected" : ""}>Kasa</option>
        <option value="depo" ${item.role === "depo" ? "selected" : ""}>Depo</option>
        <option value="usta" ${item.role === "usta" ? "selected" : ""}>Usta</option>
      </select>
      <button type="button" class="btn danger" onclick="this.closest('[data-staff-row]').remove()">Sil</button>
    </div>`;
}

window.openStaffEditor = function() {
  if (!el.staffEditor || !el.staffEditorBody) return;
  el.staffEditorBody.innerHTML = readStaffList().map(staffEditorRow).join("");
  el.staffEditor.classList.remove("hidden");
};

window.closeStaffEditor = function() {
  if (el.staffEditor) el.staffEditor.classList.add("hidden");
};

window.addStaffEditorRow = function() {
  if (!el.staffEditorBody) return;
  el.staffEditorBody.insertAdjacentHTML("beforeend", staffEditorRow({ name: "", role: "kasa" }));
};

window.saveStaffEditor = function() {
  if (!el.staffEditorBody) return;
  const rows = [...el.staffEditorBody.querySelectorAll("[data-staff-row]")];
  const staff = rows.map(row => ({
    name: normalizeStaffName(row.querySelector("[data-staff-name]")?.value),
    role: row.querySelector("[data-staff-role]")?.value || "kasa"
  })).filter(x => x.name);
  const saved = writeStaffList(staff);
  if (!saved.some(s => s.name === currentStaffName())) localStorage.setItem(CURRENT_STAFF_STORE_KEY, saved[0]?.name || "Kasa");
  renderStaffSelector();
  closeStaffEditor();
  showToast("Personel listesi kaydedildi ✅");
};

window.resetStaffEditor = function() {
  localStorage.removeItem(STAFF_STORE_KEY);
  localStorage.removeItem(CURRENT_STAFF_STORE_KEY);
  if (el.staffEditorBody) el.staffEditorBody.innerHTML = readStaffList().map(staffEditorRow).join("");
  renderStaffSelector();
  showToast("Personel listesi varsayılana döndü ✅");
};

const SALE_FAVORITES_STORE_KEY = "garage_sale_favorites_v1";
const DEFAULT_SALE_FAVORITES = [
  "Paspas",
  "Bagaj Havuzu",
  "Cam Rüzgarlığı",
  "LED",
  "Xenon",
  "Sensör"
];

function normalizeFavoriteLine(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function readSaleFavorites() {
  try {
    const raw = localStorage.getItem(SALE_FAVORITES_STORE_KEY);
    if (!raw) return [...DEFAULT_SALE_FAVORITES];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_SALE_FAVORITES];

    const cleaned = parsed
      .map(normalizeFavoriteLine)
      .filter(Boolean)
      .slice(0, 20);

    return cleaned.length ? cleaned : [...DEFAULT_SALE_FAVORITES];
  } catch {
    return [...DEFAULT_SALE_FAVORITES];
  }
}

function writeSaleFavorites(list) {
  const cleaned = (list || [])
    .map(normalizeFavoriteLine)
    .filter(Boolean)
    .filter((value, index, arr) => arr.findIndex(x => x.toLocaleLowerCase("tr-TR") === value.toLocaleLowerCase("tr-TR")) === index)
    .slice(0, 20);

  localStorage.setItem(SALE_FAVORITES_STORE_KEY, JSON.stringify(cleaned.length ? cleaned : DEFAULT_SALE_FAVORITES));
  return cleaned.length ? cleaned : [...DEFAULT_SALE_FAVORITES];
}

function renderSaleFavorites() {
  const box = document.getElementById("saleFavoriteButtons");
  if (!box) return;

  const favorites = readSaleFavorites();

  box.innerHTML = favorites.map((name) => `
    <button type="button" onclick="setSaleFavoriteSearch(decodeURIComponent('${encodeURIComponent(name)}'))">${escapeHtml(name)}</button>
  `).join("");
}

window.openSaleFavoritesEditor = function() {
  const editor = document.getElementById("saleFavoriteEditor");
  const textarea = document.getElementById("saleFavoriteTextarea");
  if (!editor || !textarea) return;

  textarea.value = readSaleFavorites().join("\n");
  editor.classList.remove("hidden");
  setTimeout(() => textarea.focus(), 50);
};

window.closeSaleFavoritesEditor = function() {
  const editor = document.getElementById("saleFavoriteEditor");
  if (editor) editor.classList.add("hidden");
};

window.saveSaleFavoritesFromEditor = function() {
  const textarea = document.getElementById("saleFavoriteTextarea");
  if (!textarea) return;

  const favorites = textarea.value
    .split(/\n|,/)
    .map(normalizeFavoriteLine)
    .filter(Boolean);

  writeSaleFavorites(favorites);
  renderSaleFavorites();
  closeSaleFavoritesEditor();
  showToast("Favori butonlar kaydedildi ✅");
};

window.resetSaleFavorites = function() {
  localStorage.removeItem(SALE_FAVORITES_STORE_KEY);
  renderSaleFavorites();

  const textarea = document.getElementById("saleFavoriteTextarea");
  if (textarea) textarea.value = DEFAULT_SALE_FAVORITES.join("\n");

  showToast("Favoriler varsayılana döndü ✅");
};

window.setSaleFavoriteSearch = function(keyword) {
  if (!el.saleSearchInput) return;
  el.saleSearchInput.value = keyword;
  renderSaleProducts();
  el.saleSearchInput.focus();
};

function findExactBarcodeProduct(value) {
  const q = String(value || "").trim();
  if (q.length < 4) return null;
  return state.products.find(p => String(p.barcode || "").trim() === q) || null;
}

function handleSaleSearchInput() {
  const value = el.saleSearchInput?.value || "";
  const exact = findExactBarcodeProduct(value);
  if (exact) {
    addToSaleCart(exact.id, { silent: true });
    el.saleSearchInput.value = "";
    renderSaleProducts();
    showToast("Barkod ile sepete eklendi ✅");
    return;
  }
  renderSaleProducts();
}

function renderSaleProducts() {
  if (!el.saleProductList) return;

  const q = normalizeText(el.saleSearchInput?.value || "");
  if (!q) {
    el.saleProductList.innerHTML = `<div class="empty-state">Satışa ürün eklemek için arama yap</div>`;
    return;
  }

  const results = state.products
    .filter((p) => productSearchText(p).includes(q) || normalizeText(p.barcode).includes(q))
    .slice(0, 40);

  if (!results.length) {
    el.saleProductList.innerHTML = `<div class="empty-state">Eşleşen ürün bulunamadı</div>`;
    return;
  }

  el.saleProductList.innerHTML = results.map((p) => {
    const available = saleAvailable(p);
    return `
      <div class="sale-product-item">
        <div>
          <div class="sale-product-title">${escapeHtml(p.category || p.name || "-")}</div>
          <div class="sale-product-meta">
            ${escapeHtml(p.productBrand || "-")} / ${escapeHtml(p.carBrand || "-")} ${escapeHtml(p.carModel || "-")} ${escapeHtml(p.carType || "")} ${escapeHtml(p.vehicleYear || "")}<br>
            Barkod: ${escapeHtml(p.barcode || "-")} · Raf: ${escapeHtml(p.location || "-")} · Kullanılabilir: <strong class="${available <= 0 ? "stock-warning" : ""}">${available}</strong>
          </div>
        </div>
        <div class="sale-product-actions">
          <button class="btn primary" onclick="addToSaleCart('${p.id}')" ${available <= 0 ? "disabled" : ""}>Sepete Ekle</button>
        </div>
      </div>
    `;
  }).join("");
}

window.addToSaleCart = function(productId, options = {}) {
  const product = state.products.find((p) => String(p.id) === String(productId));
  if (!product) return showToast("Ürün bulunamadı", true);

  const available = saleAvailable(product);
  if (available <= 0) return showToast("Bu üründe kullanılabilir stok yok", true);

  const existing = state.saleCart.find((item) => String(item.productId) === String(productId));
  if (existing) {
    if (Number(existing.qty || 0) + 1 > available) return showToast(`Yeterli stok yok. Kullanılabilir: ${available}`, true);
    existing.qty = Number(existing.qty || 0) + 1;
  } else {
    state.saleCart.push({
      productId: product.id,
      name: product.category || product.name || "Ürün",
      detail: [product.productBrand, product.carBrand, product.carModel, product.carType, product.vehicleYear].filter(Boolean).join(" "),
      qty: 1,
      price: ""
    });
  }

  renderSaleCart();
  if (!options.silent) showToast("Ürün sepete eklendi ✅");
};

window.updateSaleCartItem = function(productId, key, value) {
  const item = state.saleCart.find((x) => String(x.productId) === String(productId));
  if (!item) return;

  if (key === "qty") {
    const product = state.products.find((p) => String(p.id) === String(productId));
    const available = saleAvailable(product);
    const qty = Math.max(1, Math.floor(Number(value || 1)));
    item.qty = Math.min(qty, available || qty);
  }

  if (key === "price") {
    item.price = String(value || "").replace(",", ".");
  }

  // Input yazarken sepeti komple render etme; render odak kaçırıyor.
  updateSaleTotalDisplay();
};

window.removeSaleCartItem = function(productId) {
  state.saleCart = state.saleCart.filter((x) => String(x.productId) !== String(productId));
  renderSaleCart();
};

function saleCartTotal() {
  return state.saleCart.reduce((sum, item) => sum + (Number(item.qty || 0) * Number(item.price || 0)), 0);
}

function updateSaleTotalDisplay() {
  if (el.saleTotal) {
    el.saleTotal.textContent = formatSaleMoney(saleCartTotal());
  }
}

function renderSaleCart() {
  if (!el.saleCartList) return;

  if (!state.saleCart.length) {
    el.saleCartList.innerHTML = `<div class="empty-state">Sepet boş</div>`;
    if (el.saleTotal) el.saleTotal.textContent = formatSaleMoney(0);
    return;
  }

  el.saleCartList.innerHTML = state.saleCart.map((item) => `
    <div class="sale-cart-item">
      <div>
        <div class="sale-cart-title">${escapeHtml(item.name)}</div>
        <div class="sale-cart-meta">${escapeHtml(item.detail || "-")}</div>
      </div>
      <div class="sale-cart-actions">
        <input type="number" min="1" step="1" value="${Number(item.qty || 1)}" oninput="updateSaleCartItem('${item.productId}', 'qty', this.value)" />
        <input type="number" min="0" step="0.01" placeholder="Fiyat" value="${escapeHtml(item.price)}" oninput="updateSaleCartItem('${item.productId}', 'price', this.value)" />
        <button class="btn danger" onclick="removeSaleCartItem('${item.productId}')">Sil</button>
      </div>
    </div>
  `).join("");

  if (el.saleTotal) el.saleTotal.textContent = formatSaleMoney(saleCartTotal());
}

window.clearSaleCart = function() {
  state.saleCart = [];
  if (el.saleCustomerNote) el.saleCustomerNote.value = "";
  renderSaleCart();
};

const LAST_QUICK_SALE_STORE_KEY = "garage_last_quick_sale_v1";

function saveLastQuickSale(sale) {
  state.lastQuickSale = sale || null;

  try {
    if (sale) localStorage.setItem(LAST_QUICK_SALE_STORE_KEY, JSON.stringify(sale));
    else localStorage.removeItem(LAST_QUICK_SALE_STORE_KEY);
  } catch (e) {
    console.warn("Son satış hafızaya alınamadı:", e);
  }

  updateLastSaleButtons();
}

function loadLastQuickSale() {
  try {
    const raw = localStorage.getItem(LAST_QUICK_SALE_STORE_KEY);
    state.lastQuickSale = raw ? JSON.parse(raw) : null;
  } catch {
    state.lastQuickSale = null;
  }
  updateLastSaleButtons();
}

function updateLastSaleButtons() {
  const hasSale = !!(state.lastQuickSale && state.lastQuickSale.items && state.lastQuickSale.items.length);
  const isCancelled = !!state.lastQuickSale?.cancelledAt;

  if (el.printLastSaleBtn) el.printLastSaleBtn.disabled = !hasSale;
  if (el.cancelLastSaleBtn) {
    el.cancelLastSaleBtn.disabled = !hasSale || isCancelled;
    el.cancelLastSaleBtn.textContent = isCancelled ? "Son Satış İptal Edildi" : "Son Satışı İptal Et";
  }
}


function buildQuickSaleSnapshot() {
  const staff = currentStaff();
  return {
    saleNo: "HS-" + Date.now().toString().slice(-8),
    createdAt: new Date().toISOString(),
    staffName: staff.name,
    staffRole: roleLabel(staff.role),
    paymentType: el.salePaymentType?.value || "Nakit",
    note: String(el.saleCustomerNote?.value || "").trim(),
    total: saleCartTotal(),
    items: state.saleCart.map(item => ({
      productId: item.productId,
      name: item.name,
      detail: item.detail,
      qty: Number(item.qty || 0),
      price: Number(item.price || 0),
      lineTotal: Number(item.qty || 0) * Number(item.price || 0)
    }))
  };
}

function printQuickSaleReceipt(sale = state.lastQuickSale) {
  if (!sale || !sale.items?.length) return showToast("Yazdırılacak satış fişi yok", true);

  const itemsHtml = sale.items.map(item => `
    <tr>
      <td>
        <strong>${escapeHtml(item.name || "Ürün")}</strong>
        <small>${escapeHtml(item.detail || "")}</small>
      </td>
      <td>${Number(item.qty || 0)}</td>
      <td>${formatSaleMoney(item.price)}</td>
      <td>${formatSaleMoney(item.lineTotal)}</td>
    </tr>
  `).join("");

  const win = window.open("", "_blank", "width=420,height=720");
  if (!win) return showToast("Fiş penceresi açılamadı. Popup iznini kontrol et.", true);

  win.document.write(`
    <html>
      <head>
        <title>Hızlı Satış Fişi - ${escapeHtml(sale.saleNo)}</title>
        <style>
          @page { size: A5 portrait; margin: 6mm; }
          body { margin:0; font-family: Arial, sans-serif; color:#111; background:#fff; font-size:11px; }
          .page { padding:6mm; }
          .head { text-align:center; border-bottom:1px solid #ddd; padding-bottom:8px; margin-bottom:8px; }
          .head img { max-width:110px; max-height:64px; object-fit:contain; margin-bottom:4px; }
          h1 { font-size:16px; margin:3px 0; }
          .muted { color:#666; font-size:10px; }
          .info { display:grid; grid-template-columns:1fr 1fr; gap:5px; margin:8px 0; }
          .box { border:1px solid #ddd; border-radius:8px; padding:6px; }
          table { width:100%; border-collapse:collapse; margin-top:8px; }
          th,td { border-bottom:1px dashed #ddd; padding:5px 3px; text-align:left; vertical-align:top; }
          th:nth-child(2),td:nth-child(2){ text-align:center; width:34px; }
          th:nth-child(3),th:nth-child(4),td:nth-child(3),td:nth-child(4){ text-align:right; white-space:nowrap; }
          small { display:block; color:#666; margin-top:2px; }
          .total { display:flex; justify-content:space-between; align-items:center; margin-top:10px; padding:8px; border-radius:8px; background:#f3f4f6; font-size:14px; font-weight:800; }
          .foot { margin-top:12px; text-align:center; color:#666; font-size:10px; }
          .print { margin:8px; padding:10px 14px; border:0; border-radius:10px; background:#111; color:#fff; font-weight:700; cursor:pointer; }
          @media print { .print { display:none; } }
        </style>
      </head>
      <body>
        <button class="print" onclick="window.print()">Yazdır</button>
        <div class="page">
          <div class="head">
            <img src="/logo.png" onerror="this.style.display='none'" />
            <h1>Garage İstanbul</h1>
            <div class="muted">Hızlı Satış Fişi</div>
          </div>
          <div class="info">
            <div class="box"><b>Fiş No</b><br>${escapeHtml(sale.saleNo)}</div>
            <div class="box"><b>Tarih</b><br>${formatDate(sale.createdAt)}</div>
            <div class="box"><b>Personel</b><br>${escapeHtml(sale.staffName || "-")} (${escapeHtml(sale.staffRole || "-")})</div>
            <div class="box"><b>Ödeme</b><br>${escapeHtml(sale.paymentType || "-")}</div>
          </div>
          <table>
            <thead><tr><th>Ürün</th><th>Ad.</th><th>Birim</th><th>Tutar</th></tr></thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          <div class="total"><span>TOPLAM</span><span>${formatSaleMoney(sale.total)}</span></div>
          ${sale.note ? `<div class="box" style="margin-top:8px"><b>Not</b><br>${escapeHtml(sale.note)}</div>` : ""}
          <div class="foot">Teşekkür ederiz · Powered By GPT & SchEAx</div>
        </div>
      </body>
    </html>
  `);
  win.document.close();
  setTimeout(() => { try { win.focus(); } catch {} }, 250);
}

window.printLastQuickSale = function() {
  printQuickSaleReceipt(state.lastQuickSale);
};

window.cancelLastQuickSale = async function() {
  const sale = state.lastQuickSale;
  if (!sale || !sale.items?.length) return showToast("İptal edilecek son satış yok", true);
  if (sale.cancelledAt) return showToast("Bu satış zaten iptal edilmiş", true);

  const reason = prompt(`Son satış iptal edilecek.
Fiş: ${sale.saleNo}
Toplam: ${formatSaleMoney(sale.total)}

İade/iptal nedeni:`, "Müşteri iadesi");
  if (reason === null) return;

  if (!confirm(`${sale.saleNo} numaralı satış iptal edilsin mi?
Stoklar geri eklenecek ve cirodan düşülecek.`)) return;

  try {
    setLoading(true);
    const staff = currentStaff();

    for (const item of sale.items) {
      const product = state.products.find((p) => String(p.id) === String(item.productId));
      const currentQty = Number(product?.stock || 0);
      const newQty = currentQty + Number(item.qty || 0);

      const { error: updateError } = await supabaseClient
        .from("stock_products")
        .update({ quantity: newQty })
        .eq("id", item.productId);

      if (updateError) throw updateError;

      const desc = `Hızlı satış iade (${sale.paymentType || "-"}) - Personel: ${staff.name} (${roleLabel(staff.role)}) - İptal Fiş: ${sale.saleNo} - Birim: ${formatSaleMoney(item.price)} - Toplam: ${formatSaleMoney(item.lineTotal)} - Neden: ${reason || "-"}`;

      const { error: movementError } = await supabaseClient
        .from("stock_movements")
        .insert({
          product_id: item.productId,
          movement_type: "hizli_satis_iade",
          quantity: Number(item.qty || 0),
          description: desc
        });

      if (movementError) throw movementError;
    }

    saveLastQuickSale({
      ...sale,
      cancelledAt: new Date().toISOString(),
      cancelReason: reason || "-",
      cancelledBy: staff.name
    });

    showToast("Satış iptal edildi, stoklar geri eklendi ✅");
    await loadAll();
    renderSaleProducts();
    renderSaleDashboard();
  } catch (err) {
    console.error("Satış iptal hatası:", err);
    showToast(err.message || "Satış iptal edilemedi", true);
  } finally {
    setLoading(false);
  }
};

async function completeQuickSale() {
  if (!state.saleCart.length) return showToast("Sepet boş", true);

  const missingPrice = state.saleCart.find((item) => Number(item.price || 0) <= 0);
  if (missingPrice) return showToast("Sepette fiyatı girilmeyen ürün var", true);

  for (const item of state.saleCart) {
    const product = state.products.find((p) => String(p.id) === String(item.productId));
    const available = saleAvailable(product);
    if (!product) return showToast(`${item.name} ürünü bulunamadı`, true);
    if (available < Number(item.qty || 0)) return showToast(`${item.name} için stok yetersiz. Kullanılabilir: ${available}`, true);
  }

  const saleSnapshot = buildQuickSaleSnapshot();
  const total = saleSnapshot.total;
  const paymentType = saleSnapshot.paymentType;
  const note = saleSnapshot.note;
  const staff = currentStaff();

  if (!confirm(`${state.saleCart.length} kalem satış tamamlanacak. Toplam: ${formatSaleMoney(total)}\nDevam edilsin mi?`)) return;

  try {
    setLoading(true);

    for (const item of state.saleCart) {
      const product = state.products.find((p) => String(p.id) === String(item.productId));
      const newQty = Number(product.stock || 0) - Number(item.qty || 0);

      const { error: updateError } = await supabaseClient
        .from("stock_products")
        .update({ quantity: newQty })
        .eq("id", item.productId);

      if (updateError) throw updateError;

      const desc = `Hızlı satış (${paymentType}) - Personel: ${staff.name} (${roleLabel(staff.role)}) - Fiş: ${saleSnapshot.saleNo} - Birim: ${formatSaleMoney(item.price)} - Toplam: ${formatSaleMoney(Number(item.qty || 0) * Number(item.price || 0))}${note ? " - Not: " + note : ""}`;

      const { error: movementError } = await supabaseClient
        .from("stock_movements")
        .insert({
          product_id: item.productId,
          movement_type: "hizli_satis",
          quantity: Number(item.qty || 0),
          description: desc
        });

      if (movementError) throw movementError;
    }

    saveLastQuickSale(saleSnapshot);
    showToast(`Satış tamamlandı ✅ Toplam: ${formatSaleMoney(total)}`);
    const shouldPrint = confirm("Satış tamamlandı. Fiş yazdırılsın mı?");
    clearSaleCart();
    await loadAll();
    renderSaleProducts();
    renderSaleDashboard();
    if (shouldPrint) printQuickSaleReceipt(saleSnapshot);
  } catch (err) {
    console.error("Hızlı satış hatası:", err);
    showToast(err.message || "Satış tamamlanamadı", true);
  } finally {
    setLoading(false);
  }
}

window.openReservationPanel = function(requestId) {
  const req = state.stockRequests.find((r) => String(r.id) === String(requestId));
  if (!req) return showToast("Talep bulunamadı", true);

  state.selectedStockRequestId = requestId;
  el.reservationPanel.classList.remove("hidden");

  renderSelectedRequestDetail(req);

el.productSearchInput.value = req.requested_text || "";
searchProductsForRequest(req.requested_text || "", true);
};

function softText(value) {
  return String(value || "")
    .toLocaleLowerCase("tr-TR")
    .replaceAll("ı", "i")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ş", "s")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function searchProductsForRequest(query = "", autoSuggest = false) {
  const selectedReq = state.stockRequests.find(
    r => String(r.id) === String(state.selectedStockRequestId)
  );

  const q = softText(query);

  const reqBrand = softText(selectedReq?.vehicle_brand);
  const reqModel = softText(selectedReq?.vehicle_model);
  const reqType = softText(selectedReq?.vehicle_type);
  const reqYear = softText(selectedReq?.vehicle_year);
  const reqText = softText(selectedReq?.requested_text);

  const searchSource = autoSuggest
    ? softText([reqText, reqBrand, reqModel, reqType, reqYear].filter(Boolean).join(" "))
    : q;

  if (!searchSource) {
    el.productMatchBox.innerHTML = `<div class="empty-state">Ürün aramak için yazmaya başla</div>`;
    return;
  }

  const words = searchSource
    .split(/\s+/)
    .filter(w => w.length >= 2)
    .map(w => w.replace(/ligi$|ligi$|lik$|ligi$|ligi$/g, ""));

  const results = state.products
    .map((p) => {
      const text = softText([
        p.name,
        p.productBrand,
        p.category,
        p.carBrand,
        p.carModel,
        p.carType,
        p.vehicleYear,
        p.location,
        p.note
      ].join(" "));

      let score = 0;

      words.forEach(w => {
        if (text.includes(w)) score += 2;
      });

      if (q && text.includes(q)) score += 8;

      if (reqBrand && softText(p.carBrand).includes(reqBrand)) score += 30;
      if (reqModel && softText(p.carModel).includes(reqModel)) score += 25;
      if (reqType && softText(p.carType).includes(reqType)) score += 15;
      if (reqYear && softText(p.vehicleYear).includes(reqYear)) score += 6;

      return { p, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 25)
    .map(x => x.p);

  if (!results.length) {
    el.productMatchBox.innerHTML = `<div class="empty-state">Eşleşen ürün bulunamadı</div>`;
    return;
  }

  el.productMatchBox.innerHTML = results.map((p) => {
    const available = Number(p.stock || 0) - Number(p.reserved || 0);

    return `
      <div class="movement-search-item">
        <div class="movement-search-info">
          <strong>${escapeHtml(p.category || p.name || "-")}</strong>
          <div class="muted">
            ${escapeHtml(p.productBrand || "-")} /
            ${escapeHtml(p.carBrand || "-")}
            ${escapeHtml(p.carModel || "-")}
            ${escapeHtml(p.carType || "-")}
            ${escapeHtml(p.vehicleYear || "")}
          </div>
          <div class="muted">
            Stok: ${p.stock} | Rezerve: ${p.reserved} | Kullanılabilir:
            <strong class="${available <= 0 ? "stock-warning" : ""}">${available}</strong>
          </div>
        </div>

        <div class="movement-search-actions">
          <input id="qty_${p.id}" type="number" value="1" min="1" style="max-width:90px" />
          <button
            class="btn primary"
            onclick="reserveProductForRequest('${p.id}')"
            ${available <= 0 ? "disabled" : ""}
          >
            ${available <= 0 ? "Stok Yok" : "Rezerve Et"}
          </button>
        </div>
      </div>
    `;
  }).join("");
}


window.reserveProductForRequest = async function(productId) {
  if (!state.selectedStockRequestId) return showToast("Talep seçilmedi", true); const quantity = Number(document.getElementById("qty_" + productId)?.value || 1); if (!quantity || quantity <= 0) return showToast("Geçerli adet gir", true);
  try { setLoading(true); const { error } = await supabaseClient.rpc("reserve_stock_for_request", { p_request_id: state.selectedStockRequestId, p_product_id: productId, p_quantity: quantity, p_delivered_to: "" }); if (error) throw error; showToast("Stok rezerve edildi ✅ Yeni ürün ekleyebilirsin."); await loadAll(); const stillSelected = state.stockRequests.find(r => String(r.id) === String(state.selectedStockRequestId)); if (stillSelected) { el.reservationPanel.classList.remove("hidden"); renderSelectedRequestDetail(stillSelected); searchProductsForRequest(el.productSearchInput.value); } } catch (err) { console.error(err); showToast(err.message || "Rezerve edilemedi", true); } finally { setLoading(false); }
};
window.cancelReservation = async function(requestId) { if (!confirm("Bu rezervi iptal etmek istediğine emin misin?")) return; try { setLoading(true); const { error } = await supabaseClient.rpc("cancel_stock_reservation", { p_request_id: requestId }); if (error) throw error; showToast("Rezerv iptal edildi ✅"); await loadAll(); } catch (err) { console.error(err); showToast(err.message || "Rezerv iptal edilemedi", true); } finally { setLoading(false); } };
function switchTab(tab) { state.activeTab = tab; ["search", "add", "requests", "movements", "sale"].forEach((key) => { document.getElementById("page-" + key).classList.add("hidden"); document.getElementById("nav-" + key).classList.remove("active"); }); document.getElementById("page-" + tab).classList.remove("hidden"); document.getElementById("nav-" + tab).classList.add("active"); if (tab === "requests") {
  state.newRequestCount = 0;
  updateNewRequestAlert();
  loadStockRequests();
}
if (tab === "sale") {
  renderSaleFavorites();
  renderSaleProducts();
  renderSaleCart();
  renderSaleDashboard();
} }
window.switchTab = switchTab;
function showUpdateNotice(newVersion) {
  if (document.getElementById("updateNotice")) return;

  const notice = document.createElement("div");
  notice.id = "updateNotice";
  notice.className = "update-notice";
  notice.innerHTML = `⚡ Yeni sürüm hazır <strong>${escapeHtml(newVersion || "")}</strong><span>Güncellemek için tıkla</span>`;

  notice.addEventListener("click", async () => {
    notice.innerHTML = "⚡ Güncelleniyor...";

    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(key => caches.delete(key)));
      }

      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(reg => reg.unregister()));
      }

      localStorage.setItem("stok_app_version", String(newVersion || Date.now()));
    } catch (err) {
      console.warn("Güncelleme temizliği yapılamadı:", err);
    }

    window.location.reload(true);
  });

  document.body.appendChild(notice);
  showToast("Yeni sürüm mevcut ⚡ Sağ alttaki uyarıya tıkla.");
}

async function checkAppVersion() {
  try {
    const res = await fetch("./version.json?_=" + Date.now(), { cache: "no-store" });
    if (!res.ok) return;

    const data = await res.json();
    const remoteVersion = String(data.version || "").trim();
    if (!remoteVersion) return;

    const localVersion = localStorage.getItem("stok_app_version");

    if (!localVersion) {
      localStorage.setItem("stok_app_version", remoteVersion);
      return;
    }

    if (localVersion !== remoteVersion) {
      showUpdateNotice(remoteVersion);
    }
  } catch (err) {
    console.warn("Sürüm kontrolü yapılamadı:", err);
  }
}

function initUpdateChecker() {
  checkAppVersion();
  setInterval(checkAppVersion, 60 * 1000);
}

function playNotifySound() { try { const AudioContext = window.AudioContext || window.webkitAudioContext; const ctx = new AudioContext(); const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.type = "sine"; osc.frequency.value = 880; gain.gain.setValueAtTime(0.001, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.03); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45); osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.5); } catch (e) { console.warn("Ses çalınamadı", e); } }
async function requestNotificationPermission() { if (!("Notification" in window)) { showToast("Bu tarayıcı bildirim desteklemiyor", true); return; } const result = await Notification.requestPermission(); showToast(result === "granted" ? "Bildirim izni açıldı ✅" : "Bildirim izni verilmedi", result !== "granted"); }
function notifyNewRequest(req) {
  state.newRequestCount += 1;
  state.highlightRequestIds.add(req.id);

  updateNewRequestAlert();
  playNotificationSound();

  if (typeof showToast === "function") {
    showToast("Yeni depo talebi geldi ✅");
  }

  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("Depo Talebi", {
      body: `1 yeni sipariş var\nPlaka: ${req.plate || "-"}\nİstenen: ${req.requested_text || "-"}`,
      tag: "stock-request-" + req.id,
      renotify: true
    });
  }

  setTimeout(() => {
    state.highlightRequestIds.delete(req.id);
    renderStockRequests();
  }, 15000);
}function initRealtimeNotifications() {
  if (state.realtimeReady) return;
  state.realtimeReady = true;

  supabaseClient
    .channel("stock_requests_watch")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "stock_requests" },
      async (payload) => {
        const req = payload.new;
        if (!req || state.seenRequestIds.has(req.id)) return;

        state.seenRequestIds.add(req.id);
        notifyNewRequest(req);
        await loadStockRequests();
      }
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "stock_requests" },
      async (payload) => {
        const updatedReq = payload.new;
        if (!updatedReq) return;

        const index = state.stockRequests.findIndex(
          r => String(r.id) === String(updatedReq.id)
        );

        if (index >= 0) {
          state.stockRequests[index] = updatedReq;
        } else {
          state.stockRequests.unshift(updatedReq);
        }

        renderStockRequests();

        if (String(state.selectedStockRequestId) === String(updatedReq.id)) {
          renderSelectedRequestDetail(updatedReq);
          el.productSearchInput.value = updatedReq.requested_text || "";
          searchProductsForRequest(updatedReq.requested_text || "", true);
        }

        showToast("Depo talebi güncellendi ✅");
      }
    )
    .subscribe();
}
el.productForm.addEventListener("submit", async (e) => { e.preventDefault(); const payload = { id: el.productId.value.trim(), barcode: el.barcode.value.trim(), productBrand: el.productBrand.value.trim(), category: el.category.value.trim(), carBrand: el.carBrand.value.trim(), carModel: el.carModel.value.trim(), carType: el.carType.value.trim(), vehicleYear: el.vehicleYear.value.trim(), stock: el.stock.value.trim(), minStock: el.minStock.value.trim(), location: el.location.value.trim(), note: el.note.value.trim() }; if (!payload.category || !payload.carBrand || !payload.carModel) return showToast("Zorunlu alanlar: Ürün Kategorisi, Araç Markası, Araç Modeli", true); try { setLoading(true); if (payload.id) { const { error } = await supabaseClient.from("stock_products").update(toProductRow(payload)).eq("id", payload.id); if (error) throw error; showToast("Ürün güncellendi"); } else { const { error } = await supabaseClient.from("stock_products").insert(toProductRow(payload)); if (error) throw error; showToast("Ürün kaydedildi"); } clearProductForm(); await loadProducts(); } catch (err) { console.error(err); showToast(err.message || "Ürün kaydedilemedi", true); } finally { setLoading(false); } });
el.clearProductBtn.addEventListener("click", clearProductForm); el.refreshBtn.addEventListener("click", loadAll); el.enableNotifyBtn.addEventListener("click", enablePushNotifications); el.searchInput.addEventListener("input", applySearch); el.movementSearchInput.addEventListener("input", renderMovementSearchResults); el.productSearchInput.addEventListener("input", () => searchProductsForRequest(el.productSearchInput.value));
if (el.saleSearchInput) {
  el.saleSearchInput.addEventListener("input", handleSaleSearchInput);
  el.saleSearchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const exact = findExactBarcodeProduct(el.saleSearchInput.value);
      if (exact) {
        addToSaleCart(exact.id);
        el.saleSearchInput.value = "";
        renderSaleProducts();
      }
    }
  });
}
if (el.completeSaleBtn) el.completeSaleBtn.addEventListener("click", completeQuickSale);
if (el.clearSaleBtn) el.clearSaleBtn.addEventListener("click", clearSaleCart);
if (el.printLastSaleBtn) el.printLastSaleBtn.addEventListener("click", printLastQuickSale);
if (el.cancelLastSaleBtn) el.cancelLastSaleBtn.addEventListener("click", cancelLastQuickSale);
if (el.currentStaffSelect) el.currentStaffSelect.addEventListener("change", (e) => setCurrentStaff(e.target.value));
if ("serviceWorker" in navigator) { window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(console.error)); }
renderStaffSelector(); renderSaleFavorites(); loadLastQuickSale(); switchTab("requests"); updateNotifyButtonUI(); loadAll(); initRealtimeNotifications(); initUpdateChecker();
