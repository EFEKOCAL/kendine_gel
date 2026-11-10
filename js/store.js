// localStorage sarmalayıcısı. Tüm veri yalnızca kullanıcının tarayıcısında kalır.
const Store = (() => {
  const KEY = "kendinegel.v1";
  const empty = () => ({ entries: [], active: null, break: null, prefs: { env: null, minutes: 20, goalMin: 120 }, guide: {}, prep: null });
  let mem = null;

  function load() {
    if (mem) return mem;
    try { mem = Object.assign(empty(), JSON.parse(localStorage.getItem(KEY)) || {}); }
    catch { mem = empty(); }
    return mem;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch {} }

  return {
    get: () => load(),
    update(fn) { fn(load()); save(); },
    exportJSON: () => JSON.stringify(load(), null, 2),
    importJSON(text) {
      const d = JSON.parse(text);
      if (!Array.isArray(d.entries)) throw new Error("Geçersiz dosya");
      mem = Object.assign(empty(), d); save();
    },
  };
})();
