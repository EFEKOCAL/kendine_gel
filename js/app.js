// Basit hash yönlendirici + görünümler. Bağımlılık yok.
const $app = document.getElementById("app");
const $timerbar = document.getElementById("timerbar");
const $notice = document.getElementById("notice");

// ---------- Yardımcılar ----------
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const byId = (arr, id) => arr.find(x => x.id === id);
const DAY = 864e5;
const fmtDate = ts => new Date(ts).toLocaleString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const dayKey = ts => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const todayKey = () => dayKey(Date.now());
const tomorrowKey = () => dayKey(Date.now() + DAY);
const weekStart = ts => { const d = new Date(ts); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return d.getTime(); };
const fmtMin = m => m >= 60 ? `${Math.floor(m / 60)} sa ${m % 60} dk` : `${m} dk`;
const hh = h => String((h + 24) % 24).padStart(2, "0");
const evBadge = ev => `<span class="badge ${EVIDENCE[ev].cls}">${EVIDENCE[ev].label}</span>`;
const srcList = ids => (ids && ids.length) ? `<ol class="sources">${ids.map(id =>
  `<li>${esc(SOURCES[id])} <a target="_blank" rel="noopener" href="https://scholar.google.com/scholar?q=${encodeURIComponent(SOURCES[id])}">[ara]</a></li>`).join("")}</ol>` : "";
const goalMin = () => Store.get().prefs.goalMin ?? 120;

// Net süre = zamanlayıcı süresi × bloğun odaklı kısmı (focusShare). Puanlanmamış blok tam sayılır.
const focusedMin = e => Math.round((e.actualMin || 0) * (e.focusShare ?? 1));
const doneEntries = () => Store.get().entries.filter(e => e.endTs);
const netMinutes = entries => entries.reduce((a, e) => a + focusedMin(e), 0);
const timerMinutes = entries => entries.reduce((a, e) => a + (e.actualMin || 0), 0);
const todayEntries = () => doneEntries().filter(e => dayKey(e.ts) === todayKey());
const within = (list, days) => list.filter(e => Date.now() - e.ts < days * DAY);
const intvTitle = e => e.intv ? (byId(INTERVENTIONS, e.intv)?.title || e.intv) : "Doğrudan blok";

const FOCUS_OPTS = [[1, "Neredeyse tamamı"], [0.75, "Çoğu"], [0.5, "Yarısı"], [0.25, "Azı"], [0, "Hiç"]];
const focusLabel = v => (FOCUS_OPTS.find(o => o[0] === v) || [, "?"])[1];
const DISTR = [["telefon", "Telefon"], ["dusunce", "Düşünce"], ["cevre", "Kişi / ses"], ["beden", "Beden (açlık, yorgunluk)"], ["diger", "Diğer"]];
const countBy = (arr, f) => arr.reduce((m, x) => { const k = f(x); if (k != null) m[k] = (m[k] || 0) + 1; return m; }, {});
const topKey = m => Object.entries(m).sort((a, b) => b[1] - a[1])[0];

function topDistraction(days = 7) {
  const all = within(doneEntries(), days).flatMap(e => e.distr || []).filter(d => d.k);
  const t = topKey(countBy(all, d => d.k));
  return t ? { k: t[0], n: t[1], label: byId(DISTR.map(([id, label]) => ({ id, label })), t[0])?.label } : null;
}
// Son 30 günde net dakikası en yüksek 2 saatlik aralık.
function bestWindow() {
  const h = Array(12).fill(0);
  within(doneEntries(), 30).forEach(e => h[Math.floor(new Date(e.ts).getHours() / 2)] += focusedMin(e));
  const max = Math.max(...h);
  if (max < 30) return null;
  const i = h.indexOf(max);
  return `${hh(i * 2)}:00–${hh(i * 2 + 2)}:00`;
}
// Son 30 günde en çok kayma yaşanan 2 saat (en az 5 kayma varsa).
function crisisHours() {
  const c = within(Store.get().entries.filter(e => e.level > 0), 30);
  if (c.length < 5) return [];
  const h = countBy(c, e => new Date(e.ts).getHours());
  return Object.entries(h).sort((a, b) => b[1] - a[1]).slice(0, 2).map(x => +x[0]);
}

// ---------- Ses, bildirim, ekran kilidi ----------
let audio = null;
function unlockAudio() { try { audio ||= new AudioContext(); audio.resume(); } catch {} }
function beep(n = 1) {
  try {
    unlockAudio();
    for (let k = 0; k < n; k++) {
      const t = audio.currentTime + k * 0.5, o = audio.createOscillator(), g = audio.createGain();
      o.frequency.value = 660; o.connect(g); g.connect(audio.destination);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.3, t + 0.02); g.gain.linearRampToValueAtTime(0, t + 0.3);
      o.start(t); o.stop(t + 0.32);
    }
  } catch {}
}
// Android Chrome'da new Notification() çalışmaz; servis çalışanı üzerinden gösterilir.
async function notify(title, body) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try { const r = await navigator.serviceWorker?.getRegistration(); if (r) return r.showNotification(title, { body, tag: "kendinegel", icon: "icon.svg" }); } catch {}
  try { new Notification(title, { body }); } catch {}
}
let wakeLock = null;
async function syncWakeLock() {
  const s = Store.get();
  const want = location.hash === "#/odak" && !!s.active && s.prefs.wakeLock && document.visibilityState === "visible";
  if (want && !wakeLock && navigator.wakeLock) {
    try { wakeLock = await navigator.wakeLock.request("screen"); wakeLock.addEventListener("release", () => wakeLock = null); } catch {}
  } else if (!want && wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
}
document.addEventListener("visibilitychange", () => { syncWakeLock(); if (document.visibilityState === "visible") tick(); });

// ---------- Ana sayfa ----------
function goalBar(entries, goal) {
  const net = netMinutes(entries), tm = timerMinutes(entries);
  const pct = Math.min(100, Math.round(100 * net / goal));
  return `<div class="goal-row"><span><b>${fmtMin(net)}</b> / ${fmtMin(goal)} net</span><span class="muted">%${pct}</span></div>
    <div class="bar big" role="progressbar" aria-valuemin="0" aria-valuemax="${goal}" aria-valuenow="${net}" aria-label="Bugünkü net süre"><div class="${net >= goal ? "hit" : ""}" style="width:${pct}%"></div></div>
    ${tm !== net ? `<p class="muted small">Zamanlayıcı: ${fmtMin(tm)}. Net süre, blok sonunda verdiğin odak oranıyla hesaplanır.</p>` : ""}`;
}

function weekSummary(start) {
  const end = start + 7 * DAY, goal = goalMin();
  const done = doneEntries().filter(e => e.ts >= start && e.ts < end);
  const perDay = countBy([], () => null);
  done.forEach(e => { const k = dayKey(e.ts); perDay[k] = (perDay[k] || 0) + focusedMin(e); });
  return {
    net: netMinutes(done), blocks: done.length,
    goalDays: Object.values(perDay).filter(v => v >= goal).length,
    crises: Store.get().entries.filter(e => e.level > 0 && e.ts >= start && e.ts < end).length,
  };
}

function weeklyCard() {
  const s = Store.get(), thisWeek = weekStart(Date.now()), lastWeek = thisWeek - 7 * DAY;
  const w = weekSummary(lastWeek);
  if (s.weekly?.week === thisWeek) {
    return s.weekly.change ? `<p class="note">Bu haftanın tek değişikliği: <b>${esc(s.weekly.change)}</b></p>` : "";
  }
  if (!w.blocks) return "";
  const prev = weekSummary(lastWeek - 7 * DAY);
  const diff = prev.net ? Math.round(100 * (w.net - prev.net) / prev.net) : null;
  const td = topDistraction(14), bw = bestWindow();
  const best = LEVELS.map(l => bestFor(l.id)).find(Boolean);
  return `<section class="card weekly">
    <h3>Geçen hafta</h3>
    <ul class="plain">
      <li>Net süre: <b>${fmtMin(w.net)}</b>${diff != null ? ` (önceki haftaya göre ${diff >= 0 ? "+" : ""}%${diff})` : ""}</li>
      <li>Hedefe ulaşılan gün: <b>${w.goalDays}/7</b> · ${w.blocks} blok · ${w.crises} kayma</li>
      ${bw ? `<li>En verimli saat aralığın (30 gün): <b>${bw}</b></li>` : ""}
      ${td ? `<li>En sık dağılma nedeni: <b>${esc(td.label)}</b></li>` : ""}
      ${best ? `<li>Sende en iyi işleyen müdahale: <b>${esc(best.title)}</b></li>` : ""}
    </ul>
    <form id="weeklyForm" class="stack">
      <label>Bu hafta tek bir şeyi değiştir
        <select name="change"><option value="">Seç…</option>${PREP.map(p => `<option>${esc(p.text)}</option>`).join("")}<option value="__other">Başka bir şey (yaz)</option></select></label>
      <input name="other" maxlength="120" placeholder="Kendi değişikliğin" hidden>
      <div class="row tight"><button class="btn primary">Kaydet</button><button class="btn" type="button" id="weeklySkip">Geç</button></div>
    </form>
  </section>`;
}
function bindWeekly() {
  const f = document.getElementById("weeklyForm"); if (!f) return;
  const week = weekStart(Date.now());
  f.change.onchange = () => { f.other.hidden = f.change.value !== "__other"; };
  f.onsubmit = ev => {
    ev.preventDefault();
    const v = f.change.value === "__other" ? f.other.value.trim() : f.change.value;
    Store.update(d => d.weekly = { week, change: v }); viewHome();
  };
  document.getElementById("weeklySkip").onclick = () => { Store.update(d => d.weekly = { week, change: "" }); viewHome(); };
}

function planCard() {
  const s = Store.get(), t = s.tomorrow, hour = new Date().getHours();
  const envLabel = id => byId(ENVS, id)?.label || "";
  if (t?.date === todayKey() && !todayEntries().length) {
    return `<section class="card plan-today"><p class="muted small">Dün akşam planladığın ilk blok</p>
      <p><b>${esc(t.task)}</b>${t.time ? ` · ${esc(t.time)}` : ""}${t.env ? ` · ${esc(envLabel(t.env))}` : ""}</p>
      <div><a class="btn primary" href="#/blok">Şimdi başlat</a></div></section>`;
  }
  if (t?.date === tomorrowKey()) {
    return `<p class="muted small">Yarının ilk bloğu: ${esc(t.task)}${t.time ? ` · ${esc(t.time)}` : ""} <button class="link inline" id="planClear">değiştir</button></p>`;
  }
  if (hour < 18) return "";
  return `<form id="planForm" class="card">
    <h3>Yarının ilk bloğu</h3>
    <p class="muted small">Ne, ne zaman, nerede: önceden verilen karar sabah başlamayı kolaylaştırır.</p>
    <label>Görev <input name="task" required maxlength="140" placeholder="örn. Olasılık 4. bölüm, ilk 3 soru"></label>
    <div class="row tight">
      <label class="grow">Saat <input name="time" type="time" value="09:00"></label>
      <label class="grow">Yer <select name="env">${ENVS.map(e => `<option value="${e.id}" ${s.prefs.env === e.id ? "selected" : ""}>${e.label}</option>`).join("")}</select></label>
    </div>
    <button class="btn">Planı kaydet</button>
  </form>`;
}
function bindPlan() {
  const f = document.getElementById("planForm");
  if (f) f.onsubmit = ev => {
    ev.preventDefault(); const d = new FormData(f);
    Store.update(s => s.tomorrow = { date: tomorrowKey(), task: d.get("task").trim(), time: d.get("time"), env: d.get("env") });
    viewHome();
  };
  const c = document.getElementById("planClear");
  if (c) c.onclick = () => { Store.update(s => s.tomorrow = null); viewHome(); };
}

function introCard() {
  return `<section class="card intro">
    <h2>Kendine Gel</h2>
    <p>Odak kaydığında ne yapacağını söyler ve gerçekten odaklı geçen süreyi sayar.</p>
    <ol>
      <li>Odağın yerindeyse <b>blok başlat</b>: küçük bir görev, kısa bir süre.</li>
      <li>Kaydıysa <b>Odağım kaçtı</b>: durumuna göre kaynaklı bir müdahale seç.</li>
      <li><b>Geçmiş</b>'te neyin sende işe yaradığını gör.</li>
    </ol>
    <p class="muted small">Günlük net süre hedefi. Tutturabileceğin bir değerle başla; Geçmiş'ten değiştirebilirsin.</p>
    <div class="mins" id="introGoal">${[30, 60, 90, 120].map(m => `<label class="chip"><input type="radio" name="g" value="${m}" ${m === 60 ? "checked" : ""}> ${m} dk</label>`).join("")}</div>
    <div class="row tight"><button class="btn primary" id="introStart">İlk bloğu başlat (15 dk)</button><button class="btn" id="introClose">Kapat</button></div>
  </section>`;
}
function bindIntro() {
  const st = document.getElementById("introStart"); if (!st) return;
  const save = () => Store.update(d => { d.prefs.introSeen = true; d.prefs.goalMin = +document.querySelector("#introGoal input:checked").value; });
  st.onclick = () => { save(); Store.update(d => d.prefs.minutes = 15); location.hash = "#/blok"; };
  document.getElementById("introClose").onclick = () => { save(); viewHome(); };
}

function viewHome() {
  const s = Store.get();
  const pending = s.entries.filter(e => !e.feedback && e.endTs && e.intv).length;
  const prepDone = s.prep?.date === todayKey() ? s.prep.done.length : 0;
  const ch = crisisHours(), h = new Date().getHours();
  const riskNow = ch.some(x => x === h || x === (h + 1) % 24) && prepDone < PREP.length / 2;
  const needBackup = s.entries.length >= 10 && (!s.prefs.lastExport || Date.now() - s.prefs.lastExport > 14 * DAY);
  const showIntro = !s.prefs.introSeen && !s.entries.length;
  $app.innerHTML = `
    ${showIntro ? introCard() : ""}
    <div class="actions">
      <a class="btn big primary" href="#/blok">Blok başlat</a>
      <a class="btn big alert" href="#/acil">Odağım kaçtı</a>
    </div>
    ${riskNow ? `<p class="note">Son 30 günde odağın en çok ${ch.map(x => `${hh(x)}:00`).join(" ve ")} civarında kaçmış. Önce <a href="#/hazirlik">Hazırlık</a> listesini uygula.</p>` : ""}
    <section class="today card">
      <p class="muted small">Bugün</p>
      ${goalBar(todayEntries(), goalMin())}
    </section>
    ${planCard()}
    ${weeklyCard()}
    ${needBackup ? `<p class="note">Veriler yalnızca bu tarayıcıda. Son yedek: ${s.prefs.lastExport ? `${Math.floor((Date.now() - s.prefs.lastExport) / DAY)} gün önce` : "hiç alınmadı"}. <button class="link inline" id="quickExport">Şimdi dışa aktar</button></p>` : ""}
    <div class="grid2">
      <a class="tile" href="#/hazirlik"><h3>Hazırlık <span class="muted small">${prepDone}/${PREP.length}</span></h3><p>Oturmadan önce 2 dakikalık kontrol listesi. Odak kaymadan önce sürtünmeyi ayarla.</p></a>
      <a class="tile" href="#/rehber"><h3>Rehber</h3><p>Kısa kartlarla: neden kaçıyoruz, ödül sistemi, kısa video, porno, oyun, gıda, uyku, başlama.</p></a>
      <a class="tile" href="#/gecmis"><h3>Geçmiş ${pending ? `<span class="pill">${pending} geri bildirim bekliyor</span>` : ""}</h3><p>Net süre, haftalar, kayma saatlerin, dağılma nedenlerin ve sende işe yarayan müdahaleler.</p></a>
    </div>`;
  bindIntro(); bindPlan(); bindWeekly();
  const qe = document.getElementById("quickExport"); if (qe) qe.onclick = () => { exportData(); viewHome(); };
}

// ---------- Hazırlık ----------
function viewHazirlik() {
  const s = Store.get(), today = todayKey();
  if (s.tomorrow?.date === today && !(s.prep?.date === today && s.prep.done.includes("gorev")))
    Store.update(d => { if (d.prep?.date !== today) d.prep = { date: today, done: [] }; d.prep.done.push("gorev"); });
  const done = Store.get().prep?.date === today ? Store.get().prep.done : [];
  const td = topDistraction(7);
  $app.innerHTML = `
    <h2>Hazırlık</h2>
    <p class="muted">Oturmadan önce. İşaretlediğin maddeler gün boyunca kalır; ertesi gün sıfırlanır.</p>
    ${td ? `<p class="note">Son 7 günde en sık dağılma nedenin: <b>${esc(td.label)}</b> (${td.n} kez).</p>` : ""}
    <div class="prep">${PREP.map(p => `
      <label class="prep-item ${done.includes(p.id) ? "on" : ""} ${td?.k === "telefon" && p.id === "telefon" ? "hl" : ""}">
        <input type="checkbox" data-prep="${p.id}" ${done.includes(p.id) ? "checked" : ""}>
        <span><span class="prep-text">${esc(p.text)}</span><span class="prep-why">${esc(p.why)}</span></span>
      </label>`).join("")}</div>
    <p class="muted small">${done.length}/${PREP.length} tamam.</p>
    <div class="row"><a class="btn big primary" href="#/blok">Blok başlat</a></div>`;
  $app.querySelectorAll("[data-prep]").forEach(cb => cb.onchange = () => {
    Store.update(d => {
      if (d.prep?.date !== today) d.prep = { date: today, done: [] };
      const set = new Set(d.prep.done); cb.checked ? set.add(cb.dataset.prep) : set.delete(cb.dataset.prep);
      d.prep.done = [...set];
    });
    viewHazirlik();
  });
}

// ---------- Başlangıç formu (blok ve protokol ortak) ----------
const MINS = [5, 10, 15, 20, 25, 30, 45, 60];
// Kural tabanlı süre önerisi: son 5 aynı süreli bloğun tamamlanma oranına göre bir kademe yukarı / aşağı.
function lengthHint(min) {
  const same = doneEntries().filter(e => e.plannedMin === min).slice(-5);
  if (same.length < 5) return null;
  const k = same.filter(e => e.completed).length;
  const rated = same.filter(e => e.focusShare != null);
  const fs = rated.length ? rated.reduce((a, e) => a + e.focusShare, 0) / rated.length : 1;
  const i = MINS.indexOf(min);
  if (k >= 4 && fs >= 0.75 && i < MINS.length - 1) return { min: MINS[i + 1], text: `Son 5 ${min} dk bloğunun ${k} tanesi tamamlandı. ${MINS[i + 1]} dk deneyebilirsin.` };
  if (k <= 2 && i > 0) return { min: MINS[i - 1], text: `Son 5 ${min} dk bloğunun ${k} tanesi tamamlandı. Kısa blok daha çok tamamlanır: ${MINS[i - 1]} dk seçildi.` };
  return null;
}
function defaultTask() {
  const s = Store.get(), last = doneEntries().slice(-1)[0];
  if (s.tomorrow?.date === todayKey() && !todayEntries().length) return s.tomorrow.task;
  return last && dayKey(last.ts) === todayKey() ? (last.next || last.task) : "";
}
function startForm(opts) {
  const s = Store.get(), base = MINS.includes(s.prefs.minutes) ? s.prefs.minutes : 20;
  const hint = opts.min ? null : lengthHint(base), sel = opts.min || (hint ? hint.min : base);
  const plans = (s.prefs.plans || []).slice(0, 5);
  return `<form id="startForm" class="card">
    <label>Başlangıç görevi <span class="muted">(somut ve küçük)</span>
      <input name="task" required maxlength="140" value="${esc(opts.task ?? defaultTask())}" placeholder="örn. Ayrık Matematik 3. bölüm, ilk 2 sayfa"></label>
    <label>En olası engel ve cevabın <span class="muted">(eğer–o zaman, isteğe bağlı)</span>
      <input name="plan" maxlength="140" list="planList" value="${esc(opts.plan ?? plans[0] ?? "")}" placeholder="örn. telefona uzanırsam → çantaya koyarım"></label>
    <datalist id="planList">${plans.map(p => `<option value="${esc(p)}">`).join("")}</datalist>
    <div><div class="mins">${MINS.map(m => `<label class="chip"><input type="radio" name="min" value="${m}" ${m === sel ? "checked" : ""}> ${m} dk</label>`).join("")}</div>
      ${hint ? `<p class="muted small">${esc(hint.text)} (Kural tabanlı öneri.)</p>` : ""}</div>
    ${opts.extra || ""}
    <button class="btn big primary">${esc(opts.label)}</button>
  </form>`;
}
function bindStartForm(extra) {
  document.getElementById("startForm").onsubmit = e => {
    e.preventDefault();
    const f = new FormData(e.target);
    unlockAudio();
    startSession({ ...extra(), task: f.get("task").trim(), plan: f.get("plan").trim(), min: +f.get("min") || 20 });
    location.hash = "#/odak";
  };
}
function viewBlok() {
  $app.innerHTML = `
    <h2>Blok başlat</h2>
    <p class="muted">Müdahale gerekmiyor; doğrudan zamanlayıcı. Odağın yerindeyken küçük, somut bir görevle başla.</p>
    ${startForm({ label: "Zamanlayıcıyı başlat" })}`;
  const t = Store.get().tomorrow;
  bindStartForm(() => ({ level: 0, env: (t?.date === todayKey() && t.env) || Store.get().prefs.env, intv: null }));
}

// ---------- Protokol (acil akış) ----------
const flow = { step: "level", level: null, env: null, intv: null, envAuto: false, showAll: false };
const resetFlow = () => Object.assign(flow, { step: "level", level: null, env: null, intv: null, envAuto: false, showAll: false });

// Bugün son 4 saatte kayma kaydı varsa aynı seviye önerilir. Önceki müdahale işe yaramadıysa
// (geri bildirim "hayır", odak "azı/hiç" ya da blok yarıdan önce bitti) bir üst seviye; Seviye 4 hiçbir zaman otomatik önerilmez.
// Kayma sayısı tek başına ağırlaşma göstergesi değildir.
function suggestedLevel() {
  const t = Store.get().entries.filter(e => e.level > 0 && dayKey(e.ts) === todayKey());
  if (!t.length) return null;
  const last = t[t.length - 1];
  if (Date.now() - last.ts > 4 * 3600e3) return null;
  const failed = last.feedback?.worked === "hayir" || (last.focusShare != null && last.focusShare <= 0.25)
    || (last.endTs && !last.completed && last.actualMin < last.plannedMin / 2);
  return { level: Math.min(3, last.level + (failed ? 1 : 0)), last, failed, count: t.length };
}
// Son 14 günde sık ve ağır kayma: belirti olabilir notu.
function heavyPattern() {
  const c = within(Store.get().entries.filter(e => e.level > 0), 14);
  return c.filter(e => e.level === 4).length >= 3 || c.filter(e => e.level >= 3).length >= 6;
}

function viewAcil() {
  const s = Store.get();
  if (flow.step === "level") {
    const sug = suggestedLevel();
    $app.innerHTML = `
      <h2>Şu an hangi durumdasın?</h2>
      <p class="muted small">Belirtilere bak, şimdiki durumuna uyan seviyeyi seç.</p>
      ${sug ? `<p class="note">Bugün ${sug.count}. kez buradasın; son seferde Seviye ${sug.last.level} ve "${esc(intvTitle(sug.last))}" denedin.
        ${sug.failed ? `İşe yaramadıysa <b>Seviye ${sug.level}</b> düşünülebilir.` : `Aynı seviyede farklı bir müdahale denemek de bir seçenek.`}</p>` : ""}
      <div class="levels">${LEVELS.map(l => {
        const b = bestFor(l.id);
        return `<article class="level lv${l.id}">
          <button class="level-main" data-level="${l.id}">
            <span class="lvnum">Seviye ${l.id}${sug && sug.level === l.id ? ` <span class="tag">Önerilen</span>` : ""}</span>
            <strong>${esc(l.name)}</strong>
            ${l.signs.map(x => `<span class="sign">${esc(x)}</span>`).join("")}
            <span class="goal">${esc(l.goal)}</span>
          </button>
          ${b && s.prefs.env ? `<button class="btn small best" data-best="${l.id}:${b.id}">Sende en iyisi: ${esc(b.title)} →</button>` : ""}
        </article>`; }).join("")}</div>
      <p class="muted small">Odak sorunu çoğu gün ve aylardır sürüyorsa: <a href="#/rehber/belirti">Rehber → Alışkanlık mı, belirti mi?</a></p>`;
    $app.querySelectorAll("[data-level]").forEach(b => b.onclick = () => {
      flow.level = +b.dataset.level;
      if (s.prefs.env) { flow.env = s.prefs.env; flow.envAuto = true; flow.step = "pick"; } else flow.step = "env";
      viewAcil();
    });
    $app.querySelectorAll("[data-best]").forEach(b => b.onclick = () => {
      const [lv, id] = b.dataset.best.split(":");
      Object.assign(flow, { level: +lv, intv: id, env: s.prefs.env, envAuto: true, step: "start" }); viewAcil();
    });
  }
  else if (flow.step === "env") {
    $app.innerHTML = `
      ${back()}
      <h2>Neredesin?</h2>
      <div class="envs">${ENVS.map(e => `<button class="btn ${s.prefs.env === e.id ? "primary" : ""}" data-env="${e.id}">${e.label}</button>`).join("")}</div>`;
    $app.querySelectorAll("[data-env]").forEach(b => b.onclick = () => {
      flow.env = b.dataset.env; flow.envAuto = false; Store.update(d => d.prefs.env = flow.env); flow.step = "pick"; viewAcil();
    });
  }
  else if (flow.step === "pick") {
    const stats = interventionStats(flow.level);
    const list = rankInterventions(INTERVENTIONS.filter(i => i.levels.includes(flow.level) && i.envs.includes(flow.env)), stats);
    const shown = flow.showAll ? list : list.slice(0, 3);
    $app.innerHTML = `
      ${back()}
      <h2>Hangisini şimdi yapabilirsin?</h2>
      <p class="muted">Seviye ${flow.level} · ${esc(byId(ENVS, flow.env).label)} <button class="link inline" id="chEnv">yeri değiştir</button></p>
      ${flow.level === 4 ? `<p class="note warn">${esc(LEVEL4_NOTE)}</p>` : ""}
      <div class="intvs">${shown.map(i => {
        const st = stats[i.id];
        return `<article class="intv">
          <header><h3>${esc(i.title)}</h3><span class="dur">${esc(i.dur)}</span></header>
          <div class="meta">${evBadge(i.ev)}${st ? `<span class="badge ${st.verdict.cls}">${esc(st.verdict.label)}</span>` : `<span class="badge ev-own">Henüz denemedin</span>`}</div>
          ${st?.lastNote ? `<p class="mynote">Son notun: ${esc(st.lastNote)}</p>` : ""}
          ${i.caution ? `<p class="caution">${esc(i.caution)}</p>` : ""}
          <details><summary>Adımlar ve neden</summary><ol class="steps">${i.steps.map(x => `<li>${esc(x)}</li>`).join("")}</ol><p>${esc(i.why)}</p>${srcList(i.src)}</details>
          <button class="btn primary" data-pick="${i.id}">Bunu yapacağım</button>
        </article>`; }).join("")}</div>
      ${list.length > shown.length ? `<div class="row"><button class="btn" id="showAll">Diğer seçenekler (${list.length - shown.length})</button></div>` : ""}`;
    $app.querySelectorAll("[data-pick]").forEach(b => b.onclick = () => { flow.intv = b.dataset.pick; flow.step = "start"; viewAcil(); });
    document.getElementById("chEnv").onclick = () => { flow.step = "env"; viewAcil(); };
    const sa = document.getElementById("showAll"); if (sa) sa.onclick = () => { flow.showAll = true; viewAcil(); };
  }
  else if (flow.step === "start") {
    const i = byId(INTERVENTIONS, flow.intv);
    const lapse = flow.level === 3 ? `<p class="note">${esc(LAPSE_NOTE)}</p>` : "";
    const trig = `<fieldset class="trig"><legend>Hemen öncesinde ne hissediyordun? <span class="muted">(isteğe bağlı)</span></legend>
      <div class="mins">${TRIGGERS.map(([k, v]) => `<label class="chip"><input type="radio" name="trigger" value="${k}"> ${v}</label>`).join("")}</div></fieldset>`;
    $app.innerHTML = `
      ${back()}
      <h2>Uygula, sonra başla</h2>
      ${lapse}
      <article class="intv solo"><h3>${esc(i.title)}</h3>
        <ol class="steps check">${i.steps.map(x => `<li><label><input type="checkbox"> ${esc(x)}</label></li>`).join("")}</ol>
        ${i.caution ? `<p class="caution">${esc(i.caution)}</p>` : ""}</article>
      ${startForm({ label: "Müdahaleyi yaptım, zamanlayıcıyı başlat", extra: trig, min: flow.level === 3 ? 10 : null })}`;
    bindStartForm(() => ({ level: flow.level, env: flow.env, intv: flow.intv, trigger: document.querySelector("[name=trigger]:checked")?.value || null }));
  }
  const bb = $app.querySelector("[data-back]");
  if (bb) bb.onclick = () => {
    flow.step = { env: "level", pick: flow.envAuto ? "level" : "env", start: flow.intv && flow.step === "start" && !$app.querySelector("[data-pick]") ? "pick" : "pick" }[flow.step];
    viewAcil();
  };
}
const back = () => `<button class="link" data-back>← Geri</button>`;

// ---------- Oturum / zamanlayıcı ----------
function startSession(o) {
  const now = Date.now(), id = now.toString(36);
  Store.update(d => {
    d.prefs.minutes = o.min; d.break = null;
    if (o.plan) d.prefs.plans = [o.plan, ...(d.prefs.plans || []).filter(p => p !== o.plan)].slice(0, 5);
    d.entries.push({ id, ts: now, level: o.level, env: o.env, intv: o.intv, task: o.task, plan: o.plan, trigger: o.trigger || null,
      plannedMin: o.min, actualMin: null, endTs: null, completed: false, feedback: null, focusShare: null, distr: [] });
    d.active = { id, start: now, end: now + o.min * 60e3 };
  });
  resetFlow();
  try { navigator.storage?.persist?.(); } catch {}
}
function finishSession(completed) {
  Store.update(d => {
    const a = d.active; if (!a) return;
    const e = d.entries.find(x => x.id === a.id);
    if (e) {
      const end = Math.min(Date.now(), a.end);
      e.endTs = end; e.actualMin = Math.round((end - a.start) / 60e3); e.completed = completed;
      if (Date.now() - a.end > 15 * 60e3) e.lateClose = true;
    }
    d.active = null;
  });
  syncWakeLock();
}
function cancelSession() {
  Store.update(d => { const a = d.active; if (!a) return; d.entries = d.entries.filter(x => x.id !== a.id); d.active = null; });
  syncWakeLock();
}
function startBreak(min) { unlockAudio(); Store.update(d => d.break = { start: Date.now(), end: Date.now() + min * 60e3 }); }
const mmss = ms => { const t = Math.max(0, Math.ceil(ms / 1000)); return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`; };

function viewOdak() {
  const s = Store.get(), a = s.active;
  if (!a) return viewBitti();
  const e = s.entries.find(x => x.id === a.id);
  $app.innerHTML = `
    <section class="focus">
      <p class="muted">Görev</p><h2>${esc(e.task)}</h2>
      <div class="clock" id="clock">${mmss(a.end - Date.now())}</div>
      <div class="bar"><div id="prog"></div></div>
      <div id="distrBox" class="distr"><button class="btn" id="distr">Dikkatim dağıldı</button></div>
      <div class="row"><button class="btn subtle" id="stopEarly">Erken bitir</button></div>
      <label class="check small muted"><input type="checkbox" id="wl" ${s.prefs.wakeLock ? "checked" : ""}> Ekranı açık tut</label>
      <p class="muted small">Telefon kilitlenirse bitiş sesi gecikebilir; süre yine doğru sayılır.</p>
      <a class="link" href="#/">Ana sayfa</a>
    </section>`;
  document.getElementById("distr").onclick = () => {
    const t = Date.now();
    Store.update(d => d.entries.find(x => x.id === a.id).distr.push({ t, k: null }));
    const box = document.getElementById("distrBox");
    box.innerHTML = `<p class="small">Kaydedildi. Ne çekti?</p><div class="mins center">${DISTR.map(([k, v]) => `<button class="chip" data-k="${k}">${v}</button>`).join("")}</div>
      ${e.plan ? `<p class="note">Planın: ${esc(e.plan)}</p>` : `<p class="muted small">Fark etmek yeterli. Kaldığın satıra dön.</p>`}`;
    const restore = setTimeout(() => location.hash === "#/odak" && viewOdak(), e.plan ? 8000 : 5000);
    box.querySelectorAll("[data-k]").forEach(b => b.onclick = () => {
      Store.update(d => { const x = d.entries.find(y => y.id === a.id).distr.find(y => y.t === t); if (x) x.k = b.dataset.k; });
      clearTimeout(restore); setTimeout(() => location.hash === "#/odak" && viewOdak(), e.plan ? 3000 : 600);
      box.querySelector(".mins").remove();
    });
  };
  document.getElementById("wl").onchange = ev => { Store.update(d => d.prefs.wakeLock = ev.target.checked); syncWakeLock(); };
  document.getElementById("stopEarly").onclick = () => {
    if (Date.now() - a.start < 60e3) { if (confirm("Blok 1 dakikadan kısa. İptal edilsin mi? Kayıt tutulmaz.")) { cancelSession(); location.hash = "#/"; } return; }
    if (confirm("Bloğu şimdi bitir?")) { finishSession(false); viewBitti(); }
  };
  syncWakeLock();
}

// Blok bittikten sonraki ekran: odak oranı (tek dokunuş), mola, aynı görevle devam.
function viewBitti() {
  const s = Store.get(), last = doneEntries().slice(-1)[0];
  if (!last) { $app.innerHTML = `<p>Aktif blok yok.</p><div class="row"><a class="btn primary" href="#/blok">Blok başlat</a><a class="btn" href="#/acil">Odağım kaçtı</a></div>`; return; }
  const br = s.break;
  const dn = (last.distr || []).length, dk = topKey(countBy((last.distr || []).filter(d => d.k), d => d.k));
  const askNotif = "Notification" in window && Notification.permission === "default" && !s.prefs.notifAsked;
  $app.innerHTML = `
    <section class="focus">
      <h2>${last.completed ? "Blok tamamlandı." : "Blok erken bitti."}</h2>
      <p class="muted">${esc(last.task)} · ${last.actualMin} dk${dn ? ` · ${dn} dağılma${dk ? ` (en çok ${esc(DISTR.find(x => x[0] === dk[0])[1].toLowerCase())})` : ""}` : ""}</p>
      ${last.focusShare == null ? `<div class="card ask">
        ${last.lateClose ? `<p class="small">Blok, uygulama kapalıyken bitti. Süreyi Geçmiş'ten düzeltebilirsin.</p>` : ""}
        <p>Bu bloğun ne kadarı gerçekten odaklıydı?</p>
        <div class="mins center">${FOCUS_OPTS.map(([v, l]) => `<button class="chip" data-fs="${v}">${l}</button>`).join("")}</div>
      </div>` : `<p class="muted small">Odak: ${focusLabel(last.focusShare)}</p>`}
      ${goalBar(todayEntries(), goalMin())}
      ${br ? `<div class="clock small" id="clock">${mmss(br.end - Date.now())}</div><p class="muted">Mola. Uyaranı azalt: yürü, su iç, uzağa bak.</p>`
           : `<p>Mola uyaransız olmalı: yürü, su iç, uzağa bak. Kısa video mola değil, yeni bir uyarandır.</p>`}
      <label class="resume">Kaldığın yer / sıradaki ilk adım <span class="muted">(dönüşü kolaylaştırır)</span>
        <input id="nextTask" maxlength="140" value="${esc(last.next || last.task)}"></label>
      <div class="row">
        ${br ? "" : `<button class="btn" id="brk5">5 dk mola</button><button class="btn" id="brk10">10 dk mola</button>`}
        <button class="btn primary" id="again">Devam et</button>
      </div>
      <div class="row"><a class="btn" href="#/blok">Yeni görev</a><a class="btn" href="#/acil">Odağım kaçtı</a></div>
      ${askNotif ? `<div class="card ask"><p class="small">Blok ve mola bitince bildirim göndereyim mi?</p>
        <div class="row tight center"><button class="btn small" id="nYes">Evet</button><button class="btn small" id="nNo">Hayır</button></div></div>` : ""}
    </section>`;
  $app.querySelectorAll("[data-fs]").forEach(b => b.onclick = () => {
    Store.update(d => { const e = d.entries.find(x => x.id === last.id); e.focusShare = +b.dataset.fs; delete e.lateClose; });
    viewBitti();
  });
  // "Kaldığın yer" notu, ara verirken dikkat kalıntısını azaltır (ready-to-resume plan).
  const nt = document.getElementById("nextTask");
  const saveNext = () => { const v = nt.value.trim(); if (v && v !== last.next) Store.update(d => d.entries.find(x => x.id === last.id).next = v); };
  nt.onchange = saveNext;
  const b5 = document.getElementById("brk5"), b10 = document.getElementById("brk10");
  if (b5) b5.onclick = () => { saveNext(); startBreak(5); viewBitti(); };
  if (b10) b10.onclick = () => { saveNext(); startBreak(10); viewBitti(); };
  document.getElementById("again").onclick = () => {
    unlockAudio(); saveNext();
    startSession({ level: 0, env: last.env, intv: null, task: nt.value.trim() || last.task, plan: last.plan, min: last.plannedMin });
    viewOdak();
  };
  const ny = document.getElementById("nYes"), nn = document.getElementById("nNo");
  if (ny) ny.onclick = async () => { Store.update(d => d.prefs.notifAsked = true); try { await Notification.requestPermission(); } catch {} viewBitti(); };
  if (nn) nn.onclick = () => { Store.update(d => d.prefs.notifAsked = true); viewBitti(); };
}

function tick() {
  const s = Store.get(), a = s.active;
  if (a && Date.now() >= a.end) {
    finishSession(true); beep(2); notify("Blok tamamlandı", "Mola: uyaranı azalt. Sonra aynı görevle devam et.");
    if (location.hash === "#/odak") { document.body.classList.remove("focusing"); viewBitti(); }
  }
  if (s.break && Date.now() >= s.break.end) {
    Store.update(d => d.break = null); beep(1); notify("Mola bitti", "Aynı görevle devam et.");
    if (location.hash === "#/odak") viewBitti();
  }
  const act = Store.get().active, br = Store.get().break;
  const onOdak = location.hash === "#/odak";
  $timerbar.hidden = !(act || br) || onOdak;
  const c = document.getElementById("clock"), p = document.getElementById("prog");
  if (act) {
    const left = act.end - Date.now();
    $timerbar.innerHTML = `<a href="#/odak">Odak bloğu sürüyor: ${mmss(left)}</a>`;
    if (c) c.textContent = mmss(left);
    if (p) p.style.width = `${100 * (1 - left / (act.end - act.start))}%`;
    document.title = onOdak ? `${mmss(left)} · Odak` : "Kendine Gel";
  } else if (br) {
    const left = br.end - Date.now();
    $timerbar.innerHTML = `<a href="#/odak">Mola: ${mmss(left)}</a>`;
    if (c) c.textContent = mmss(left);
    document.title = onOdak ? `${mmss(left)} · Mola` : "Kendine Gel";
  } else document.title = "Kendine Gel";
  $notice.hidden = !Store.failed();
}

// ---------- Kişisel öğrenme ----------
// Geri bildirimler müdahale başına birikir. Puan: evet=1, kısmen=0.5, hayır=0.
// level verilirse yalnızca o seviyedeki kayıtlar sayılır. Doğrudan bloklar (intv null) sayılmaz.
const WORKED_SCORE = { evet: 1, kismen: 0.5, hayir: 0 };
function interventionStats(level) {
  const r = {};
  Store.get().entries.forEach(e => {
    if (!e.feedback || !e.intv || (level && e.level !== level)) return;
    const x = r[e.intv] ||= { n: 0, score: 0, fs: 0, fsn: 0, min: 0, lastNote: "" };
    x.n++; x.score += WORKED_SCORE[e.feedback.worked]; x.min += e.actualMin || 0;
    if (e.focusShare != null) { x.fs += e.focusShare; x.fsn++; }
    if (e.feedback.note) x.lastNote = e.feedback.note;
  });
  Object.values(r).forEach(x => { x.rate = x.score / x.n; x.verdict = verdict(x); });
  return r;
}
// En az 2 deneme olmadan hüküm verilmez.
function verdict(x) {
  if (x.n < 2) return { key: "az", label: `1 deneme, karar için az`, cls: "ev-weak" };
  if (x.rate >= 0.7) return { key: "iyi", label: `Sende işe yarıyor (%${Math.round(100 * x.rate)}, ${x.n} deneme)`, cls: "ev-strong" };
  if (x.rate <= 0.3) return { key: "zayif", label: `Sende zayıf (%${Math.round(100 * x.rate)}, ${x.n} deneme)`, cls: "ev-bad" };
  return { key: "karisik", label: `Karışık (%${Math.round(100 * x.rate)}, ${x.n} deneme)`, cls: "ev-mid" };
}
const EV_RANK = { guclu: 0, orta: 1, zayif: 2 };
const VERDICT_RANK = { iyi: 0, karisik: 1, az: 2, yok: 2, zayif: 3 };
// Sıralama: önce kişisel sonuç (işe yarayan üste, zayıf alta), sonra kanıt seviyesi.
// pin: kişisel veri yokken üstte tutulan müdahale (ör. kayma sonrası "affet").
function rankInterventions(list, stats) {
  return list.slice().sort((a, b) =>
    (b.pin && !stats[b.id] ? 1 : 0) - (a.pin && !stats[a.id] ? 1 : 0)
    || VERDICT_RANK[stats[a.id]?.verdict.key || "yok"] - VERDICT_RANK[stats[b.id]?.verdict.key || "yok"]
    || (stats[b.id]?.rate ?? -1) - (stats[a.id]?.rate ?? -1)
    || EV_RANK[a.ev] - EV_RANK[b.ev]);
}
function bestFor(level) {
  const st = interventionStats(level);
  const best = Object.entries(st).filter(([id, x]) => x.verdict.key === "iyi" && byId(INTERVENTIONS, id)).sort((a, b) => b[1].rate - a[1].rate)[0];
  return best ? byId(INTERVENTIONS, best[0]) : null;
}

// ---------- Geçmiş ----------
function dailyChart(done, days) {
  const goal = goalMin(), map = {};
  done.forEach(e => { const k = dayKey(e.ts); map[k] = (map[k] || 0) + focusedMin(e); });
  const cols = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const k = dayKey(d.getTime()), v = map[k] || 0;
    cols.push({ k, v, day: d.getDate() });
  }
  const max = Math.max(goal, ...cols.map(c => c.v)), hits = cols.filter(c => c.v >= goal).length;
  const label = `Son ${days} gün: ${hits} gün hedefe ulaşıldı, en yüksek ${fmtMin(Math.max(...cols.map(c => c.v)))}.`;
  return `<div class="chart" role="img" aria-label="${label}" style="--goal:${100 * goal / max}%">
    ${cols.map(c => `<div class="col" title="${c.k}: ${c.v} dk"><div class="colbar ${c.v >= goal ? "hit" : ""}" style="height:${100 * c.v / max}%"></div><span>${c.day}${c.v >= goal ? "✓" : ""}</span></div>`).join("")}
    <div class="goal-line"></div></div>
    <p class="muted small">${label} Çizgi: hedef (${fmtMin(goal)}).</p>`;
}
function hourChart(entries) {
  const h = Array(24).fill(0);
  entries.forEach(e => h[new Date(e.ts).getHours()]++);
  const max = Math.max(1, ...h), top = h.indexOf(Math.max(...h));
  return `<div class="chart hours" role="img" aria-label="En çok kayma ${hh(top)}:00 saatinde.">${h.map((v, i) => `<div class="col" title="${hh(i)}:00 → ${v} kayma"><div class="colbar warn" style="height:${100 * v / max}%"></div>${i % 6 === 0 ? `<span>${hh(i)}</span>` : "<span></span>"}</div>`).join("")}</div>
    <p class="muted small">Odağın hangi saatlerde kaçıyor (Seviye 1–4 kayıtları). Yoğun saatlerden önce Hazırlık listesini uygula.</p>`;
}
function weeksTable() {
  const rows = [], now = weekStart(Date.now());
  for (let i = 0; i < 8; i++) {
    const st = now - i * 7 * DAY, w = weekSummary(st);
    if (!w.blocks && !w.crises && i > 0) continue;
    rows.push(`<tr><td>${new Date(st).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" })}${i === 0 ? " (bu hafta)" : ""}</td><td>${fmtMin(w.net)}</td><td>${w.goalDays}/7</td><td>${w.blocks}</td><td>${w.crises}</td></tr>`);
  }
  return `<table class="tbl"><tr><th>Hafta</th><th>Net</th><th>Hedef günü</th><th>Blok</th><th>Kayma</th></tr>${rows.join("")}</table>`;
}
function countList(map, labels) {
  const items = Object.entries(map).sort((a, b) => b[1] - a[1]);
  return `<ul class="bars">${items.map(([k, n]) => `<li><span>${esc(labels[k] || k)}</span><span class="bar"><span style="width:${100 * n / items[0][1]}%"></span></span><b>${n}</b></li>`).join("")}</ul>`;
}

function viewGecmis() {
  const s = Store.get();
  const done = doneEntries();
  const stats = interventionStats();
  const last7 = within(done, 7), last30 = within(done, 30);
  const activeDays = new Set(last7.map(e => dayKey(e.ts))).size || 1;
  const crises = s.entries.filter(e => e.level > 0);
  const share = timerMinutes(last7) ? Math.round(100 * netMinutes(last7) / timerMinutes(last7)) : null;
  const distr7 = countBy(last7.flatMap(e => e.distr || []).filter(d => d.k), d => d.k);
  const trig30 = countBy(within(crises, 30).filter(e => e.trigger), e => e.trigger);
  const workedLbl = { evet: "İşe yaradı", kismen: "Kısmen", hayir: "İşe yaramadı" };
  const bw = bestWindow();
  $app.innerHTML = `
    <h2>Geçmiş</h2>
    ${heavyPattern() ? `<p class="note warn">Son iki haftada sık ve ağır kayma kaydın var. Bu tek başına bir şey göstermez; ama uyku, ruh hâli veya dikkatle ilgili sürekli bir sorun olabilir. <a href="#/rehber/belirti">Alışkanlık mı, belirti mi?</a></p>` : ""}
    <div class="stats">
      <div><b>${fmtMin(netMinutes(todayEntries()))}</b><span>bugün net</span></div>
      <div><b>${fmtMin(netMinutes(last7))}</b><span>7 gün net</span></div>
      <div><b>${fmtMin(netMinutes(last30))}</b><span>30 gün net</span></div>
      <div><b>${fmtMin(Math.round(netMinutes(last7) / activeDays))}</b><span>çalışılan gün ort. (7g)</span></div>
      <div><b>${share == null ? "–" : `%${share}`}</b><span>odak oranı (7g)</span></div>
      <div><b>${within(crises, 7).length}</b><span>kayma (7 gün)</span></div>
    </div>
    <form id="goalForm" class="goal-form"><label>Günlük hedef (dk) <input type="number" name="goal" min="15" max="900" step="15" value="${goalMin()}"></label><button class="btn">Kaydet</button><span class="muted small" id="goalErr"></span></form>
    ${done.length ? `
      <h3>Net süre</h3>
      ${dailyChart(done, 14)}
      ${bw ? `<p class="muted small">En verimli saat aralığın (30 gün): <b>${bw}</b>. Zor işleri buraya koy.</p>` : ""}
      <h3>Haftalar</h3>${weeksTable()}` : `<p class="note">İlk bloğunu bitirince burada günlük net süren, haftaların ve en verimli saatlerin görünür.</p>`}
    ${Object.keys(distr7).length ? `<h3>Dağılma nedenleri (7 gün)</h3>${countList(distr7, Object.fromEntries(DISTR))}` : ""}
    ${crises.length ? `<h3>Kayma saatleri</h3>${hourChart(crises)}` : ""}
    ${Object.keys(trig30).length ? `<h3>Neyden kaçıyordun? (30 gün)</h3>${countList(trig30, Object.fromEntries(TRIGGERS))}
      <p class="muted small">Kaçış genellikle görevin verdiği histen olur. En sık his için Rehber'deki ilgili modüle bak.</p>` : ""}
    ${Object.keys(stats).length ? `<h3>Kişisel protokolün</h3>
      <p class="muted small">Geri bildirimlerinden çıkan sonuç. Seviye başına işe yarayan üstte, zayıf olan altta. Hüküm için en az 2 deneme gerekir. Az sayıda denemeye dayanır; durum ağırlaştıkça her müdahale daha zayıf görünür.</p>
      <div class="personal">${LEVELS.map(l => {
        const st = interventionStats(l.id), ids = Object.keys(st).filter(id => byId(INTERVENTIONS, id));
        if (!ids.length) return "";
        const ranked = rankInterventions(ids.map(id => byId(INTERVENTIONS, id)), st);
        return `<article class="entry lvb${l.id}"><header><span>Seviye ${l.id} · ${esc(l.name)}</span></header>
          <table class="tbl"><tr><th>Müdahale</th><th>Sonuç</th><th>Ort. odak</th><th>Ort. blok</th></tr>
          ${ranked.map(i => { const x = st[i.id]; return `<tr><td>${esc(i.title)}</td><td><span class="badge ${x.verdict.cls}">${esc(x.verdict.label)}</span></td><td>${x.fsn ? `%${Math.round(100 * x.fs / x.fsn)}` : "–"}</td><td>${Math.round(x.min / x.n)} dk</td></tr>`; }).join("")}
          </table></article>`; }).join("")}</div>` : ""}
    <h3>Kayıtlar</h3>
    ${done.length ? "" : `<p class="muted">Henüz tamamlanmış blok yok.</p>`}
    <div class="entries">${done.slice().reverse().slice(0, 60).map(e => `
      <article class="entry lvb${e.level}">
        <header><span>${fmtDate(e.ts)} · ${e.level ? `Seviye ${e.level}` : "Doğrudan"}${e.env ? ` · ${esc(byId(ENVS, e.env)?.label || "")}` : ""}</span><span>${e.actualMin}/${e.plannedMin} dk ${e.completed ? "✓" : ""}</span></header>
        <p><b>${esc(intvTitle(e))}</b> → ${esc(e.task)}</p>
        <p class="fb">${e.focusShare != null ? `Odak: ${focusLabel(e.focusShare)} (${focusedMin(e)} dk net)` : `Odak puanlanmadı: ${FOCUS_OPTS.map(([v, l]) => `<button class="chip xs" data-fsid="${e.id}" data-v="${v}">${l}</button>`).join("")}`}${(e.distr || []).length ? ` · ${e.distr.length} dağılma` : ""}</p>
        ${!e.intv ? "" : e.feedback
          ? `<p class="fb">Müdahale: ${workedLbl[e.feedback.worked]}${e.feedback.note ? ` · ${esc(e.feedback.note)}` : ""}</p>`
          : `<details class="fbform"><summary>Müdahale işe yaradı mı?</summary>
              <form data-fb="${e.id}">
                <div class="mins">${Object.entries(workedLbl).map(([k, v]) => `<label class="chip"><input type="radio" name="worked" value="${k}" required> ${v}</label>`).join("")}</div>
                <input name="note" maxlength="200" placeholder="Not (isteğe bağlı): ne işe yaradı, ne yaramadı?">
                <button class="btn primary">Kaydet</button>
              </form></details>`}
        <details class="fbform"><summary>Düzenle</summary>
          <form data-edit="${e.id}" class="stack">
            <label>Görev <input name="task" maxlength="140" value="${esc(e.task)}"></label>
            <label>Süre (dk) <input name="min" type="number" min="0" max="${(e.plannedMin || 60) + 5}" value="${e.actualMin}"></label>
            <div class="row tight"><button class="btn">Kaydet</button><button class="btn danger" type="button" data-del="${e.id}">Kaydı sil</button></div>
          </form></details>
      </article>`).join("")}</div>
    <div class="row io">
      <button class="btn" id="exp">Veriyi dışa aktar (JSON)</button>
      <button class="btn" id="impBtn">İçe aktar</button><input type="file" id="imp" accept="application/json,.json" hidden>
    </div>
    <p class="muted small">Veriler yalnızca bu tarayıcıda saklanır. Cihaz değiştirirken dışa aktar / içe aktar kullan.</p>`;

  document.getElementById("goalForm").onsubmit = ev => {
    ev.preventDefault(); const g = +new FormData(ev.target).get("goal");
    if (g >= 15 && g <= 900) { Store.update(d => d.prefs.goalMin = g); viewGecmis(); }
    else document.getElementById("goalErr").textContent = "15–900 dk arası bir değer gir.";
  };
  $app.querySelectorAll("[data-fsid]").forEach(b => b.onclick = () => {
    Store.update(d => { const e = d.entries.find(x => x.id === b.dataset.fsid); e.focusShare = +b.dataset.v; delete e.lateClose; }); viewGecmis();
  });
  $app.querySelectorAll("[data-fb]").forEach(f => f.onsubmit = ev => {
    ev.preventDefault();
    const d = new FormData(f);
    Store.update(s => { const e = s.entries.find(x => x.id === f.dataset.fb); e.feedback = { worked: d.get("worked"), note: d.get("note").trim(), ts: Date.now() }; });
    viewGecmis();
  });
  $app.querySelectorAll("[data-edit]").forEach(f => f.onsubmit = ev => {
    ev.preventDefault(); const d = new FormData(f);
    Store.update(s => { const e = s.entries.find(x => x.id === f.dataset.edit);
      const m = Math.max(0, Math.min((e.plannedMin || 60) + 5, Math.round(+d.get("min") || 0)));
      e.actualMin = m; e.task = d.get("task").trim() || e.task; });
    viewGecmis();
  });
  $app.querySelectorAll("[data-del]").forEach(b => b.onclick = () => {
    if (!confirm("Bu kayıt silinecek ve net süreden düşülecek. Emin misin?")) return;
    Store.update(s => s.entries = s.entries.filter(x => x.id !== b.dataset.del)); viewGecmis();
  });
  document.getElementById("exp").onclick = () => { exportData(); };
  document.getElementById("impBtn").onclick = () => document.getElementById("imp").click();
  document.getElementById("imp").onchange = async ev => {
    try {
      const { data, dropped } = Store.parseImport(await ev.target.files[0].text());
      const cur = Store.get().entries.length;
      if (!confirm(`Bu tarayıcıdaki ${cur} kayıt silinip dosyadaki ${data.entries.length} kayıt yüklenecek.${dropped ? ` ${dropped} geçersiz kayıt atlanacak.` : ""} Devam?`)) return;
      Store.replace(data); viewGecmis();
    } catch (err) { alert("İçe aktarılamadı: " + err.message); }
  };
}
function exportData() {
  Store.update(d => d.prefs.lastExport = Date.now());
  const a = document.createElement("a"), url = URL.createObjectURL(new Blob([Store.exportJSON()], { type: "application/json" }));
  a.href = url; a.download = `kendinegel-yedek-${todayKey()}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- Rehber ----------
const guideState = { m: null, i: 0, draw: null };
function viewRehber(modId) {
  if (!modId) {
    guideState.m = null;
    const prog = Store.get().guide;
    $app.innerHTML = `<h2>Rehber</h2><p class="muted">Her modül 3–5 kısa karttan oluşur. Bir kart, bir fikir. Ok tuşlarıyla ilerleyebilirsin.</p>
      <div class="mods">${GUIDE.map((m, i) => {
        const seen = prog[m.id] ?? -1;
        return `<a class="tile" href="#/rehber/${m.id}"><span class="lvnum">Modül ${i + 1} · ${m.cards.length} kart${seen + 1 >= m.cards.length ? " · okundu" : ""}</span><h3>${esc(m.title)}</h3>
          <div class="bar"><div style="width:${100 * (seen + 1) / m.cards.length}%"></div></div></a>`; }).join("")}</div>`;
    return;
  }
  const m = byId(GUIDE, modId); if (!m) return viewRehber();
  const idx = GUIDE.indexOf(m), nextMod = GUIDE[idx + 1];
  guideState.m = m;
  guideState.i = Math.min(Store.get().guide[m.id] ?? 0, m.cards.length - 1);
  const draw = () => {
    const i = guideState.i, c = m.cards[i];
    if ((Store.get().guide[m.id] ?? -1) < i) Store.update(d => d.guide[m.id] = i);
    $app.innerHTML = `
      <a class="link" href="#/rehber">← Modüller</a>
      <p class="muted">${esc(m.title)} · ${i + 1}/${m.cards.length}</p>
      <div class="bar"><div style="width:${100 * (i + 1) / m.cards.length}%"></div></div>
      <article class="gcard"><h2>${esc(c.h)}</h2><p>${esc(c.body)}</p>
        ${c.key ? `<p class="key">${esc(c.key)}</p>` : ""}
        ${c.src ? `<details><summary>Kaynaklar</summary>${srcList(c.src)}</details>` : ""}</article>
      <div class="row"><button class="btn" id="prev" ${i === 0 ? "disabled" : ""}>← Önceki</button>
        ${i < m.cards.length - 1 ? `<button class="btn primary" id="next">Sonraki →</button>`
          : nextMod ? `<a class="btn primary" href="#/rehber/${nextMod.id}">Sonraki modül: ${esc(nextMod.title)} →</a>` : `<a class="btn primary" href="#/rehber">Modülleri bitirdin</a>`}</div>`;
    document.getElementById("prev").onclick = () => { if (guideState.i > 0) { guideState.i--; draw(); } };
    const n = document.getElementById("next"); if (n) n.onclick = () => { guideState.i++; draw(); };
  };
  guideState.draw = draw;
  draw();
}
document.addEventListener("keydown", e => {
  const g = guideState; if (!g.m || !location.hash.startsWith("#/rehber/") || e.target.closest("input, textarea, select")) return;
  if (e.key === "ArrowRight" && g.i < g.m.cards.length - 1) { g.i++; g.draw(); }
  if (e.key === "ArrowLeft" && g.i > 0) { g.i--; g.draw(); }
});

// ---------- Yönlendirici ----------
function route() {
  const [, page, sub] = location.hash.split("/");
  document.querySelectorAll("[data-nav]").forEach(a => a.classList.toggle("on", a.dataset.nav === page));
  if (page !== "acil") resetFlow();
  if (page !== "rehber") guideState.m = null;
  document.body.classList.toggle("focusing", page === "odak" && !!Store.get().active);
  ({ acil: viewAcil, blok: viewBlok, odak: viewOdak, hazirlik: viewHazirlik, gecmis: viewGecmis, rehber: () => viewRehber(sub) }[page] || viewHome)();
  window.scrollTo(0, 0); tick(); syncWakeLock();
}
// Başka sekmede veri değişirse bu sekmeyi tazele (yazarken değil).
window.addEventListener("storage", e => {
  if (e.key !== Store.KEY) return;
  Store.reload();
  if (!document.activeElement?.closest("input, textarea, select")) route();
});
window.addEventListener("hashchange", route);
setInterval(tick, 1000);
route();
