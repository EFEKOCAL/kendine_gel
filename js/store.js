// localStorage sarmalayıcısı. Tüm veri yalnızca kullanıcının tarayıcısında kalır.
// Şema sürümü (v) değiştikçe migrate() eski veriyi yeni alanlara taşır.
const Store = (() => {
  const KEY = "kendinegel.v1";
  const VERSION = 2;
  const emptyPrefs = () => ({ env: null, minutes: 20, goalMin: 120, introSeen: false, notifAsked: false, wakeLock: true, plans: [], lastExport: null });
  const empty = () => ({ v: VERSION, entries: [], active: null, break: null, prefs: emptyPrefs(), guide: {}, prep: null, tomorrow: null, weekly: null });
  let mem = null, saveFailed = false;

  function migrate(d) {
    const out = Object.assign(empty(), d);
    out.prefs = { ...emptyPrefs(), ...(d.prefs || {}) };
    out.guide = d.guide || {};
    // v1 → v2: focusShare (bloğun odaklı kısmı) ve distr (dağılma kaydı) alanları.
    out.entries = (d.entries || []).map(e => ({ focusShare: null, distr: [], trigger: null, ...e }));
    out.v = VERSION;
    return out;
  }
  function load() {
    if (mem) return mem;
    try { const raw = JSON.parse(localStorage.getItem(KEY)); mem = raw ? migrate(raw) : empty(); }
    catch { mem = empty(); }
    return mem;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(mem)); saveFailed = false; }
    catch { saveFailed = true; }
  }

  const validEntry = e => e && typeof e.id === "string" && Number.isFinite(e.ts)
    && [0, 1, 2, 3, 4].includes(e.level) && (e.actualMin == null || Number.isFinite(e.actualMin))
    && (!e.feedback || ["evet", "kismen", "hayir"].includes(e.feedback.worked));

  return {
    KEY,
    get: () => load(),
    // Başka sekmede yazılmış olabilecek veriyi ezmemek için her yazmadan önce yeniden okunur.
    update(fn) { mem = null; fn(load()); save(); },
    reload() { mem = null; },
    failed: () => saveFailed,
    exportJSON: () => JSON.stringify(load(), null, 2),
    // Dosyayı doğrular, geçersiz kayıtları atar. Aktif blok / mola içe aktarılmaz.
    parseImport(text) {
      const d = JSON.parse(text);
      if (!d || !Array.isArray(d.entries)) throw new Error("Geçersiz dosya");
      const good = d.entries.filter(validEntry);
      return { data: migrate({ ...d, entries: good, active: null, break: null }), dropped: d.entries.length - good.length };
    },
    replace(data) { mem = data; save(); },
  };
})();
