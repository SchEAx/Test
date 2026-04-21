import { useEffect, useMemo, useState } from "react";

const API_URL = "https://script.google.com/macros/s/AKfycbzI4RbRYqWrMLAoAEGYI9QrgDdRDgycXhDchid64w8RIdxkbT8JKoexCso1C3mdl1tY/exec";

const mockProducts = [
  {
    id: "1",
    code: "PAS-001",
    barcode: "",
    name: "Rizline Paspas",
    category: "Paspas",
    subCategory: "Havuzlu",
    brand: "Renault",
    model: "Clio 5",
    vehicleType: "Binek",
    variant: "Otomatik / Siyah",
    stock: 12,
    minStock: 3,
    shelf: "A-01",
    note: "",
    updatedAt: "2026-04-21 10:30",
  },
  {
    id: "2",
    code: "ONEK-014",
    barcode: "",
    name: "Ön Ek",
    category: "Body Kit",
    subCategory: "Ön Ek",
    brand: "Fiat",
    model: "Egea",
    vehicleType: "Sedan",
    variant: "Makyajlı / Siyah",
    stock: 2,
    minStock: 3,
    shelf: "B-02",
    note: "",
    updatedAt: "2026-04-21 10:25",
  },
  {
    id: "3",
    code: "CAMR-008",
    barcode: "",
    name: "Cam Rüzgarlığı",
    category: "Cam Aksesuar",
    subCategory: "Rüzgarlık",
    brand: "VW",
    model: "Caddy",
    vehicleType: "Ticari",
    variant: "Kısa Şasi / Füme",
    stock: 0,
    minStock: 2,
    shelf: "C-03",
    note: "",
    updatedAt: "2026-04-21 09:58",
  },
  {
    id: "4",
    code: "BASA-022",
    barcode: "",
    name: "Yan Basamak",
    category: "Basamak",
    subCategory: "Yan Basamak",
    brand: "Kia",
    model: "Sportage",
    vehicleType: "SUV",
    variant: "2022+ / Alüminyum",
    stock: 5,
    minStock: 2,
    shelf: "D-01",
    note: "",
    updatedAt: "2026-04-21 09:42",
  },
];

const mockMovements = [
  {
    id: "m1",
    createdAt: "2026-04-21 10:42",
    type: "GIRIS",
    productCode: "PAS-001",
    productName: "Rizline Paspas",
    quantity: 6,
    previousStock: 6,
    newStock: 12,
    user: "Enes",
    note: "Yeni sevkiyat",
  },
  {
    id: "m2",
    createdAt: "2026-04-21 11:08",
    type: "CIKIS",
    productCode: "ONEK-014",
    productName: "Ön Ek",
    quantity: 1,
    previousStock: 3,
    newStock: 2,
    user: "Kasiyer 1",
    note: "Müşteri montajı",
  },
  {
    id: "m3",
    createdAt: "2026-04-21 11:26",
    type: "DUZELTME",
    productCode: "CAMR-008",
    productName: "Cam Rüzgarlığı",
    quantity: 2,
    previousStock: 0,
    newStock: 2,
    user: "Depo",
    note: "Sayım düzeltme",
  },
];

const initialForm = {
  productId: "",
  type: "GIRIS",
  quantity: 1,
  note: "",
  user: "",
};

function formatDate(value) {
  if (!value) return "-";
  return value.replace("T", " ").slice(0, 16);
}

function getStatus(product) {
  if (Number(product.stock) <= 0) return "Tükendi";
  if (Number(product.stock) <= Number(product.minStock || 0)) return "Kritik";
  return "Stok Var";
}

function classForStatus(status) {
  if (status === "Stok Var") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/20";
  if (status === "Kritik") return "bg-amber-500/15 text-amber-300 border-amber-500/20";
  return "bg-rose-500/15 text-rose-300 border-rose-500/20";
}

function classForMovement(type) {
  if (type === "GIRIS") return "bg-emerald-500/15 text-emerald-300";
  if (type === "CIKIS") return "bg-rose-500/15 text-rose-300";
  return "bg-sky-500/15 text-sky-300";
}

async function apiGet(action) {
  const res = await fetch(`${API_URL}?action=${action}`, { method: "GET" });
  if (!res.ok) throw new Error(`GET ${action} başarısız`);
  return res.json();
}

async function apiPost(payload) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("POST başarısız");
  return res.json();
}

export default function StockTakipUIDemo() {
  const [products, setProducts] = useState(mockProducts);
  const [movements, setMovements] = useState(mockMovements);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("TUMU");
  const [selectedProductId, setSelectedProductId] = useState(mockProducts[0]?.id || "");
  const [form, setForm] = useState({ ...initialForm, productId: mockProducts[0]?.id || "", user: "Enes" });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [usingMock, setUsingMock] = useState(true);
  const [message, setMessage] = useState("Demo veri açık. Apps Script URL girince canlı veriye geçer.");

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId) || products[0] || null,
    [products, selectedProductId]
  );

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((product) => {
      const status = getStatus(product);
      const matchesSearch = !q || [
        product.code,
        product.name,
        product.category,
        product.brand,
        product.model,
        product.variant,
        product.shelf,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);

      const matchesFilter =
        filter === "TUMU" ||
        (filter === "KRITIK" && status === "Kritik") ||
        (filter === "TUKENDI" && status === "Tükendi") ||
        product.category === filter;

      return matchesSearch && matchesFilter;
    });
  }, [products, search, filter]);

  const stats = useMemo(() => {
    const totalProduct = products.length;
    const totalStock = products.reduce((sum, item) => sum + Number(item.stock || 0), 0);
    const criticalCount = products.filter((item) => getStatus(item) === "Kritik").length;
    const outOfStockCount = products.filter((item) => getStatus(item) === "Tükendi").length;
    return [
      { label: "Toplam Ürün", value: String(totalProduct), note: "Aktif ürün kartı" },
      { label: "Toplam Stok", value: String(totalStock), note: "Tüm ürünlerin toplamı" },
      { label: "Kritik Stok", value: String(criticalCount), note: "Min. stok altı" },
      { label: "Tükendi", value: String(outOfStockCount), note: "Stok 0 olanlar" },
    ];
  }, [products]);

  async function loadData() {
    if (!API_URL || API_URL.includes("SCRIPT_URL_BURAYA_YAPISTIR")) {
      setUsingMock(true);
      setProducts(mockProducts);
      setMovements(mockMovements);
      setSelectedProductId(mockProducts[0]?.id || "");
      setForm((prev) => ({ ...prev, productId: mockProducts[0]?.id || "" }));
      return;
    }

    try {
      setLoading(true);
      const [productRes, movementRes] = await Promise.all([
        apiGet("listProducts"),
        apiGet("listMovements"),
      ]);

      const liveProducts = Array.isArray(productRes?.data) ? productRes.data : [];
      const liveMovements = Array.isArray(movementRes?.data) ? movementRes.data : [];

      setProducts(liveProducts);
      setMovements(liveMovements);
      setSelectedProductId(liveProducts[0]?.id || "");
      setForm((prev) => ({ ...prev, productId: liveProducts[0]?.id || "" }));
      setUsingMock(false);
      setMessage("Canlı veri bağlı. Ürünler ve hareketler Google Sheets’ten geliyor.");
    } catch (error) {
      console.error(error);
      setUsingMock(true);
      setProducts(mockProducts);
      setMovements(mockMovements);
      setMessage("Canlı veride hata oldu. Demo veriyle devam ediliyor.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!selectedProduct && products[0]) {
      setSelectedProductId(products[0].id);
    }
  }, [selectedProduct, products]);

  function handlePickProduct(productId) {
    setSelectedProductId(productId);
    setForm((prev) => ({ ...prev, productId }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.productId) {
      setMessage("Önce bir ürün seç knk.");
      return;
    }
    if (!form.quantity || Number(form.quantity) <= 0) {
      setMessage("Miktar 0’dan büyük olmalı.");
      return;
    }

    const product = products.find((item) => item.id === form.productId);
    if (!product) {
      setMessage("Ürün bulunamadı.");
      return;
    }

    const qty = Number(form.quantity);
    const prevStock = Number(product.stock || 0);
    const nextStock =
      form.type === "GIRIS"
        ? prevStock + qty
        : form.type === "CIKIS"
        ? prevStock - qty
        : qty;

    if (form.type === "CIKIS" && nextStock < 0) {
      setMessage("Bu ürün için yeterli stok yok.");
      return;
    }

    const optimisticProducts = products.map((item) =>
      item.id === product.id ? { ...item, stock: nextStock, updatedAt: new Date().toISOString() } : item
    );

    const optimisticMovement = {
      id: String(Date.now()),
      createdAt: new Date().toISOString(),
      type: form.type,
      productCode: product.code,
      productName: product.name,
      quantity: qty,
      previousStock: prevStock,
      newStock: nextStock,
      user: form.user || "Bilinmiyor",
      note: form.note || "",
    };

    setProducts(optimisticProducts);
    setMovements((prev) => [optimisticMovement, ...prev].slice(0, 20));
    setSaving(true);
    setMessage("İşlem kaydediliyor...");

    try {
      if (!usingMock) {
        await apiPost({
          action: "saveStockMovement",
          productId: product.id,
          productCode: product.code,
          productName: product.name,
          type: form.type,
          quantity: qty,
          previousStock: prevStock,
          newStock: nextStock,
          note: form.note,
          user: form.user,
        });
      }

      setForm((prev) => ({ ...prev, quantity: 1, note: "" }));
      setMessage(usingMock ? "Demo işlem tamam. Apps Script bağlanınca gerçek Sheets’e yazacak." : "Stok işlemi kaydedildi.");

      if (!usingMock) {
        await loadData();
      }
    } catch (error) {
      console.error(error);
      setMessage("Kayıtta hata oldu. Ağ veya Apps Script tarafını kontrol et.");
      await loadData();
    } finally {
      setSaving(false);
    }
  }

  const categoryOptions = [
    "TUMU",
    "KRITIK",
    "TUKENDI",
    ...Array.from(new Set(products.map((item) => item.category).filter(Boolean))),
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto grid min-h-screen max-w-7xl grid-cols-1 lg:grid-cols-[270px_1fr]">
        <aside className="hidden border-r border-white/10 bg-zinc-900/70 p-5 lg:block">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-lg font-bold text-zinc-900 shadow-lg">
              GI
            </div>
            <div>
              <div className="text-lg font-semibold">Garage İstanbul</div>
              <div className="text-sm text-zinc-400">Stok Takip</div>
            </div>
          </div>

          <nav className="space-y-2 text-sm">
            {[
              "Ana Sayfa",
              "Ürünler",
              "Stok Giriş/Çıkış",
              "Hareketler",
              "Raporlar",
              "Ayarlar",
            ].map((item, index) => (
              <button
                key={item}
                className={`w-full rounded-2xl px-4 py-3 text-left transition ${
                  index === 0 ? "bg-white text-zinc-900 shadow" : "bg-white/5 text-zinc-200 hover:bg-white/10"
                }`}
              >
                {item}
              </button>
            ))}
          </nav>

          <div className="mt-8 rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-800 to-zinc-900 p-4">
            <div className="text-sm text-zinc-400">Bağlantı Durumu</div>
            <div className="mt-2 text-2xl font-bold">{usingMock ? "Demo" : "Canlı"}</div>
            <div className="text-sm text-zinc-300">
              {usingMock ? "Apps Script URL bekleniyor" : "Sheets senkron aktif"}
            </div>
            <button
              onClick={loadData}
              className="mt-4 w-full rounded-2xl bg-amber-400 px-4 py-3 font-semibold text-zinc-900 transition hover:scale-[1.01]"
            >
              Veriyi Yenile
            </button>
          </div>
        </aside>

        <main className="p-4 sm:p-6">
          <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-sm text-zinc-400">Hoş geldin</div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Stok Kontrol Paneli</h1>
              <p className="mt-2 text-sm text-zinc-500">{message}</p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Ürün, kod, kategori ara..."
                className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none placeholder:text-zinc-500 sm:w-80"
              />
              <button
                onClick={loadData}
                className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-zinc-900 shadow transition hover:scale-[1.01]"
              >
                {loading ? "Yükleniyor..." : "Yenile"}
              </button>
            </div>
          </header>

          <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {stats.map((item) => (
              <div key={item.label} className="rounded-3xl border border-white/10 bg-zinc-900/80 p-4 shadow-xl shadow-black/20">
                <div className="text-sm text-zinc-400">{item.label}</div>
                <div className="mt-2 text-2xl font-bold sm:text-3xl">{item.value}</div>
                <div className="mt-1 text-xs text-zinc-500">{item.note}</div>
              </div>
            ))}
          </section>

          <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_0.9fr]">
            <div className="rounded-[28px] border border-white/10 bg-zinc-900/80 p-4 sm:p-5">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Ürün Listesi</h2>
                  <p className="text-sm text-zinc-400">Kategori, stok ve raf bilgisiyle hızlı görünüm</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {categoryOptions.map((chip, i) => (
                    <button
                      key={chip}
                      onClick={() => setFilter(chip)}
                      className={`rounded-full px-3 py-2 text-xs font-medium ${
                        filter === chip || (i === 0 && filter === "TUMU")
                          ? "bg-white text-zinc-900"
                          : "bg-white/5 text-zinc-300"
                      }`}
                    >
                      {chip === "TUMU" ? "Tümü" : chip === "KRITIK" ? "Kritik" : chip === "TUKENDI" ? "Tükendi" : chip}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                {filteredProducts.map((product) => {
                  const status = getStatus(product);
                  return (
                    <div
                      key={product.id}
                      className={`rounded-3xl border p-4 transition ${
                        selectedProductId === product.id
                          ? "border-white/30 bg-zinc-900"
                          : "border-white/10 bg-zinc-950/70 hover:border-white/20"
                      }`}
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold">{product.name}</h3>
                            <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-zinc-300">{product.code}</span>
                            <span className={`rounded-full border px-2.5 py-1 text-[11px] ${classForStatus(status)}`}>{status}</span>
                          </div>
                          <div className="mt-2 text-sm text-zinc-400">
                            {product.category} • {product.brand} {product.model}
                          </div>
                          <div className="mt-1 text-sm text-zinc-500">{product.variant}</div>
                        </div>

                        <div className="grid grid-cols-3 gap-3 text-center sm:min-w-[260px]">
                          <div className="rounded-2xl bg-white/5 p-3">
                            <div className="text-xs text-zinc-500">Stok</div>
                            <div className="mt-1 text-lg font-bold">{product.stock}</div>
                          </div>
                          <div className="rounded-2xl bg-white/5 p-3">
                            <div className="text-xs text-zinc-500">Min.</div>
                            <div className="mt-1 text-lg font-bold">{product.minStock}</div>
                          </div>
                          <div className="rounded-2xl bg-white/5 p-3">
                            <div className="text-xs text-zinc-500">Raf</div>
                            <div className="mt-1 text-lg font-bold">{product.shelf || "-"}</div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          onClick={() => handlePickProduct(product.id)}
                          className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-zinc-900"
                        >
                          Seç
                        </button>
                        <button
                          onClick={() => {
                            handlePickProduct(product.id);
                            setForm((prev) => ({ ...prev, productId: product.id, type: "GIRIS" }));
                          }}
                          className="rounded-2xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-900"
                        >
                          + Giriş
                        </button>
                        <button
                          onClick={() => {
                            handlePickProduct(product.id);
                            setForm((prev) => ({ ...prev, productId: product.id, type: "CIKIS" }));
                          }}
                          className="rounded-2xl bg-rose-400 px-4 py-2 text-sm font-semibold text-zinc-900"
                        >
                          - Çıkış
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-6">
              <form onSubmit={handleSubmit} className="rounded-[28px] border border-white/10 bg-zinc-900/80 p-4 sm:p-5">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold">Hızlı Stok İşlemi</h2>
                  <p className="text-sm text-zinc-400">Mobilde 3 adımda giriş/çıkış yap</p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs text-zinc-500">Ürün</label>
                    <select
                      value={form.productId}
                      onChange={(e) => {
                        setForm((prev) => ({ ...prev, productId: e.target.value }));
                        setSelectedProductId(e.target.value);
                      }}
                      className="w-full rounded-2xl border border-white/10 bg-zinc-950 px-4 py-3 text-sm"
                    >
                      {products.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.code} - {item.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedProduct && (
                    <div className="rounded-2xl bg-zinc-950/80 p-3 text-sm text-zinc-300">
                      <div className="font-medium text-white">{selectedProduct.name}</div>
                      <div className="mt-1 text-zinc-400">
                        {selectedProduct.brand} {selectedProduct.model} • Raf: {selectedProduct.shelf || "-"}
                      </div>
                      <div className="mt-1 text-zinc-400">Mevcut stok: {selectedProduct.stock}</div>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { key: "GIRIS", label: "Giriş", className: "bg-emerald-400 text-zinc-900" },
                      { key: "CIKIS", label: "Çıkış", className: "bg-rose-400 text-zinc-900" },
                      { key: "DUZELTME", label: "Düzeltme", className: "bg-sky-400 text-zinc-900" },
                    ].map((btn) => (
                      <button
                        key={btn.key}
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, type: btn.key }))}
                        className={`rounded-2xl px-4 py-3 font-semibold ${
                          form.type === btn.key ? btn.className : "bg-white/5 text-zinc-300"
                        }`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs text-zinc-500">Miktar</label>
                      <input
                        type="number"
                        min="1"
                        value={form.quantity}
                        onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))}
                        className="w-full rounded-2xl border border-white/10 bg-zinc-950 px-4 py-3 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-zinc-500">İşlemi Yapan</label>
                      <input
                        value={form.user}
                        onChange={(e) => setForm((prev) => ({ ...prev, user: e.target.value }))}
                        className="w-full rounded-2xl border border-white/10 bg-zinc-950 px-4 py-3 text-sm"
                        placeholder="Enes"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-zinc-500">Açıklama</label>
                    <textarea
                      value={form.note}
                      onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
                      className="min-h-[100px] w-full rounded-2xl border border-white/10 bg-zinc-950 px-4 py-3 text-sm"
                      placeholder="Toplu giriş - yeni sevkiyat"
                    />
                  </div>

                  <button
                    disabled={saving}
                    className="w-full rounded-2xl bg-white px-4 py-3 font-semibold text-zinc-900 shadow transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? "Kaydediliyor..." : "İşlemi Kaydet"}
                  </button>
                </div>
              </form>

              <div className="rounded-[28px] border border-white/10 bg-zinc-900/80 p-4 sm:p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Son Hareketler</h2>
                    <p className="text-sm text-zinc-400">Canlı stok akışı</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {movements.slice(0, 8).map((move) => (
                    <div key={move.id} className="flex items-center gap-3 rounded-2xl bg-zinc-950/80 p-3">
                      <div className={`rounded-2xl px-3 py-2 text-xs font-semibold ${classForMovement(move.type)}`}>
                        {move.type === "GIRIS" ? "Giriş" : move.type === "CIKIS" ? "Çıkış" : "Düzeltme"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{move.productName}</div>
                        <div className="text-xs text-zinc-500">
                          {formatDate(move.createdAt)} • {move.user}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold">
                          {move.type === "CIKIS" ? "-" : "+"}
                          {move.quantity}
                        </div>
                        <div className="text-[11px] text-zinc-500">{move.previousStock} → {move.newStock}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <div className="mt-6 grid grid-cols-1 gap-3 lg:hidden">
            <div className="rounded-3xl border border-white/10 bg-zinc-900/90 p-3">
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                {['Ana Sayfa', 'Ürünler', 'İşlem', 'Hareket'].map((item, i) => (
                  <button
                    key={item}
                    className={`rounded-2xl px-2 py-3 ${i === 0 ? 'bg-white text-zinc-900 font-semibold' : 'bg-white/5 text-zinc-300'}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <section className="mt-6 rounded-[28px] border border-dashed border-white/10 bg-zinc-900/40 p-4 sm:p-5">
            <h3 className="text-lg font-semibold">Apps Script bağlantı notu</h3>
            <div className="mt-3 space-y-2 text-sm text-zinc-400">
              <p>1. En üstteki <span className="text-white">API_URL</span> değerine Web App URL’ni yapıştır.</p>
              <p>2. GET tarafında <span className="text-white">action=listProducts</span> ve <span className="text-white">action=listMovements</span> dönecek.</p>
              <p>3. POST tarafında <span className="text-white">action=saveStockMovement</span> ile stok hareketi kaydedilecek.</p>
              <p>4. Bu haliyle demo veriyle bile akışı gösterir; URL gelince canlıya döner.</p>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
