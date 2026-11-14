// Bilgisayardaki bir JSON dosyasına otomatik kayıt (File System Access API; Chrome / Edge masaüstü).
// Kullanıcı dosyayı bir kez seçer; dosya tutamacı (handle) IndexedDB'de saklanır. Her veri değişikliğinden
// ~1 sn sonra dosya yeniden yazılır. Bağlanınca ve sekmeye dönülünce dosya okunup yerel veriyle birleştirilir;
// böylece gizli sekmede ya da başka tarayıcıda aynı dosyayı açarak aynı kayıtlarla devam edilir.
// Sunucu yok: dosya yalnızca kullanıcının seçtiği klasörde durur.
const FileSync = (() => {
  const supported = "showSaveFilePicker" in window && "indexedDB" in window;
  const TYPES = [{ description: "Kendine Gel verisi", accept: { "application/json": [".json"] } }];
  let handle = null, state = supported ? "none" : "unsupported"; // none | need-permission | connected | error | unsupported
  let lastWrite = 0, lastSeenMod = 0, timer = null, writing = false, err = "";
  const listeners = [];
  const emit = () => listeners.forEach(f => { try { f(); } catch {} });

  // --- IndexedDB: tek anahtar, dosya tutamacı ---
  const idb = () => new Promise((res, rej) => {
    const r = indexedDB.open("kendinegel-fs", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("h");
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  async function idbDo(mode, fn) {
    const db = await idb();
    return new Promise((res, rej) => {
      const tx = db.transaction("h", mode), req = fn(tx.objectStore("h"));
      tx.oncomplete = () => res(req?.result); tx.onerror = () => rej(tx.error);
    });
  }
  const saveHandle = h => idbDo("readwrite", s => h ? s.put(h, "file") : s.delete("file"));
  const loadHandle = () => idbDo("readonly", s => s.get("file"));

  // --- Birleştirme ---
  // Kayıtlar id ile birleşir. Aynı kayıt iki tarafta varsa daha dolu olan (bitmiş, puanlanmış, geri bildirimli)
  // seçilir; eşitlikte dosyadaki kazanır (dosya, başka yerde yapılan son düzenlemeyi taşır).
  const fill = e => (e.endTs ? 4 : 0) + (e.focusShare != null ? 2 : 0) + (e.feedback ? 1 : 0);
  function merge(local, file) {
    const byId = new Map(local.entries.map(e => [e.id, e]));
    file.entries.forEach(f => { const l = byId.get(f.id); if (!l || fill(f) >= fill(l)) byId.set(f.id, f); });
    const entries = [...byId.values()].sort((a, b) => a.ts - b.ts);
    const fileEmpty = !file.entries.length;
    const base = fileEmpty ? local : file;
    return { ...base, entries, active: local.active, break: local.break,
      prefs: { ...local.prefs, ...(fileEmpty ? {} : file.prefs) }, guide: { ...local.guide, ...file.guide } };
  }

  async function readFile() {
    const f = await handle.getFile();
    lastSeenMod = f.lastModified;
    const text = await f.text();
    if (!text.trim()) return null;
    return Store.parseImport(text).data;
  }
  // Dosyayı oku, yerel veriyle birleştir, sonucu hem yerele hem dosyaya yaz.
  async function pull() {
    try {
      const data = await readFile();
      if (data) {
        const merged = merge(Store.get(), data);
        if (JSON.stringify(merged) !== JSON.stringify(Store.get())) { Store.replace(merged); window.dispatchEvent(new Event("kendinegel:data")); }
      }
      await write();
    } catch (e) { fail(e); }
  }
  async function write() {
    if (state !== "connected" || writing) return;
    writing = true;
    try {
      const w = await handle.createWritable();
      await w.write(JSON.stringify({ ...Store.get(), savedAt: Date.now() }, null, 2));
      await w.close();
      lastWrite = Date.now();
      lastSeenMod = (await handle.getFile()).lastModified;
      err = "";
    } catch (e) { fail(e); }
    writing = false; emit();
  }
  function fail(e) {
    if (e?.name === "NotAllowedError" || e?.name === "SecurityError") state = "need-permission";
    else if (e?.name === "NotFoundError") { state = "error"; err = "Dosya bulunamadı (taşınmış ya da silinmiş olabilir). Yeniden bağlan."; }
    else { state = "error"; err = e?.message || String(e); }
    emit();
  }
  function schedule() { if (state !== "connected") return; clearTimeout(timer); timer = setTimeout(write, 1000); }

  async function useHandle(h, { pullFirst }) {
    handle = h; await saveHandle(h);
    state = "connected"; err = ""; emit();
    if (pullFirst) await pull(); else await write();
  }

  // --- Dışarıya açık işlemler (kullanıcı dokunuşuyla çağrılmalı) ---
  async function createNew() {
    try {
      const h = await window.showSaveFilePicker({ suggestedName: "kendinegel-veri.json", types: TYPES });
      // Var olan bir dosyanın üzerine kaydediliyorsa önce içindekiyle birleştir.
      await useHandle(h, { pullFirst: true });
    } catch (e) { if (e?.name !== "AbortError") fail(e); }
  }
  async function openExisting() {
    try {
      const [h] = await window.showOpenFilePicker({ types: TYPES, multiple: false });
      if ((await h.requestPermission({ mode: "readwrite" })) !== "granted") { state = "need-permission"; handle = h; await saveHandle(h); emit(); return; }
      await useHandle(h, { pullFirst: true });
    } catch (e) { if (e?.name !== "AbortError") fail(e); }
  }
  async function grant() {
    if (!handle) return;
    try {
      if ((await handle.requestPermission({ mode: "readwrite" })) === "granted") { state = "connected"; emit(); await pull(); }
    } catch (e) { fail(e); }
  }
  async function disconnect() { clearTimeout(timer); handle = null; state = "none"; err = ""; try { await saveHandle(null); } catch {} emit(); }

  // Sekmeye dönülünce dosya başka yerde değiştiyse çek.
  async function checkExternal() {
    if (state !== "connected" || writing) return;
    try { const f = await handle.getFile(); if (f.lastModified > lastSeenMod + 1) await pull(); } catch (e) { fail(e); }
  }

  async function init() {
    if (!supported) return;
    Store.onSave(schedule);
    document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && checkExternal());
    window.addEventListener("focus", checkExternal);
    try {
      const h = await loadHandle(); if (!h) return;
      handle = h;
      const p = await h.queryPermission({ mode: "readwrite" });
      if (p === "granted") { state = "connected"; emit(); await pull(); } else { state = "need-permission"; emit(); }
    } catch (e) { fail(e); }
  }

  return {
    init, createNew, openExisting, grant, disconnect,
    onChange: f => listeners.push(f),
    info: () => ({ state, name: handle?.name || "", lastWrite, err }),
  };
})();
