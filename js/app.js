// Basit hash yönlendirici + görünümler. Bağımlılık yok.
const $app = document.getElementById("app");
const $timerbar = document.getElementById("timerbar");

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const byId = (arr, id) => arr.find(x => x.id === id);
const fmtDate = ts => new Date(ts).toLocaleString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const dayKey = ts => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const fmtMin = m => m >= 60 ? `${Math.floor(m / 60)} sa ${m % 60} dk` : `${m} dk`;
const evBadge = ev => `<span class="badge ${EVIDENCE[ev].cls}">${EVIDENCE[ev].label}</span>`;
const srcList = ids => (ids && ids.length) ? `<ol class="sources">${ids.map(id =>
  `<li>${esc(SOURCES[id])} <a target="_blank" rel="noopener" href="https://scholar.google.com/scholar?q=${encodeURIComponent(SOURCES[id])}">[ara]</a></li>`).join("")}</ol>` : "";
const goalMin = () => Store.get().prefs.goalMin ?? 120;
const doneEntries = () => Store.get().entries.filter(e => e.endTs);
const netMinutes = entries => entries.reduce((a, e) => a + (e.actualMin || 0), 0);
const todayEntries = () => doneEntries().filter(e => dayKey(e.ts) === dayKey(Date.now()));
const intvTitle = e => e.intv ? (byId(INTERVENTIONS, e.intv)?.title || e.intv) : "Doğrudan blok";

// ---------- Ana sayfa ----------
function goalBar(min, goal) {
  const pct = Math.min(100, Math.round(100 * min / goal));
  return `<div class="goal-row"><span><b>${fmtMin(min)}</b> / ${fmtMin(goal)} net</span><span class="muted">%${pct}</span></div>
    <div class="bar big"><div style="width:${pct}%"></div></div>`;
}
function viewHome() {
  const s = Store.get();
  const pending = s.entries.filter(e => !e.feedback && e.endTs && e.intv).length;
  const today = netMinutes(todayEntries());
  const prepDone = s.prep?.date === dayKey(Date.now()) ? s.prep.done.length : 0;
  $app.innerHTML = `
    <section class="today card">
      <p class="muted small">Bugün</p>
      ${goalBar(today, goalMin())}
      <p class="muted small">Net süre: yalnızca zamanlayıcıyla geçen odak blokları sayılır. Hedefi Geçmiş sekmesinden değiştirebilirsin.</p>
    </section>
    <div class="actions">
      <a class="btn big primary" href="#/acil">Odağım kaçtı</a>
      <a class="btn big" href="#/blok">Odağım yerinde, blok başlat</a>
    </div>
    <div class="grid2">
      <a class="tile" href="#/hazirlik"><h3>Hazırlık <span class="muted small">${prepDone}/${PREP.length}</span></h3><p>Oturmadan önce 2 dakikalık kontrol listesi. Kriz çıkmadan sürtünmeyi ayarla.</p></a>
      <a class="tile" href="#/rehber"><h3>Rehber</h3><p>Kısa kartlarla: neden kaçıyoruz, ödül, kısa video, porno, gıda, uyku, kafein, başlama.</p></a>
      <a class="tile" href="#/gecmis"><h3>Geçmiş ${pending ? `<span class="pill">${pending} geri bildirim bekliyor</span>` : ""}</h3><p>Net süre grafiği, kriz saatlerin ve kişisel protokolün: sende işe yarayan müdahaleler acil listede üste çıkar.</p></a>
    </div>`;
}

// ---------- Hazırlık ----------
function viewHazirlik() {
  const s = Store.get(), today = dayKey(Date.now());
  const done = s.prep?.date === today ? s.prep.done : [];
  $app.innerHTML = `
    <h2>Hazırlık</h2>
    <p class="muted">Oturmadan önce. Her madde işaretlendiğinde gün boyunca kalır; ertesi gün sıfırlanır.</p>
    <div class="prep">${PREP.map(p => `
      <label class="prep-item ${done.includes(p.id) ? "on" : ""}">
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

// ---------- Doğrudan blok ----------
const MINS = [10, 15, 20, 25, 45, 60];
function startForm(opts) {
  const s = Store.get();
  return `<form id="startForm" class="card">
    <label>Başlangıç görevi <span class="muted">(somut ve küçük)</span>
      <input name="task" required maxlength="140" value="${esc(opts.task || "")}" placeholder="örn. Ayrık Matematik 3. bölüm, ilk 2 sayfa"></label>
    <label>Eğer dikkatim dağılırsa… <span class="muted">(isteğe bağlı)</span>
      <input name="plan" maxlength="140" value="${esc(opts.plan || "")}" placeholder="örn. telefona uzanırsam onu çantaya koyarım"></label>
    <div class="mins">${MINS.map(m => `<label class="chip"><input type="radio" name="min" value="${m}" ${m === s.prefs.minutes ? "checked" : ""}> ${m} dk</label>`).join("")}</div>
    <button class="btn big primary">${esc(opts.label)}</button>
  </form>`;
}
function bindStartForm(extra) {
  document.getElementById("startForm").onsubmit = e => {
    e.preventDefault();
    const f = new FormData(e.target);
    startSession({ ...extra, task: f.get("task").trim(), plan: f.get("plan").trim(), min: +f.get("min") || 20 });
    location.hash = "#/odak";
  };
}
function viewBlok() {
  const last = doneEntries().slice(-1)[0];
  $app.innerHTML = `
    <h2>Blok başlat</h2>
    <p class="muted">Müdahale gerekmiyor; doğrudan zamanlayıcı. Odağın henüz yerindeyken küçük, somut bir görevle başla.</p>
    ${startForm({ task: last && dayKey(last.ts) === dayKey(Date.now()) ? last.task : "", plan: last?.plan, label: "Zamanlayıcıyı başlat" })}`;
  bindStartForm({ level: 0, env: Store.get().prefs.env, intv: null });
}

// ---------- Acil akış ----------
const flow = { step: "level", level: null, env: null, intv: null };

function suggestedLevel() {
  const t = Store.get().entries.filter(e => e.level > 0 && dayKey(e.ts) === dayKey(Date.now()));
  if (!t.length) return null;
  const last = t[t.length - 1];
  if (Date.now() - last.ts > 4 * 3600e3) return null;
  return { level: Math.min(4, last.level + (t.length >= 2 ? 1 : 0)), last, count: t.length };
}

function viewAcil() {
  const s = Store.get();
  if (flow.step === "level") {
    const sug = suggestedLevel();
    $app.innerHTML = `
      <h2>1. Şu an hangi durumdasın?</h2>
      ${sug ? `<p class="note">Bugün ${sug.count} müdahale uyguladın, sonuncusu Seviye ${sug.last.level}. Odak gün içinde zayıfladıkça seviye yükselir: <b>Seviye ${sug.level}</b> öneriliyor.</p>` : ""}
      <div class="levels">${LEVELS.map(l => `
        <div class="level lv${l.id} ${sug && sug.level === l.id ? "suggested" : ""}" role="button" tabindex="0" data-level="${l.id}">
          <span class="lvnum">Seviye ${l.id}</span><strong>${esc(l.name)}</strong>
          <ul>${l.signs.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
          <span class="goal">${esc(l.goal)}</span>
          ${(b => b ? `<span class="best">Sende en iyisi: ${esc(b.title)}</span>` : "")(bestFor(l.id))}
        </div>`).join("")}</div>`;
    $app.querySelectorAll("[data-level]").forEach(b => {
      const go = () => { flow.level = +b.dataset.level; flow.step = "env"; viewAcil(); };
      b.onclick = go; b.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } };
    });
  }
  else if (flow.step === "env") {
    $app.innerHTML = `
      ${back()}
      <h2>2. Neredesin?</h2>
      <div class="envs">${ENVS.map(e => `<button class="btn ${s.prefs.env === e.id ? "primary" : ""}" data-env="${e.id}">${e.label}</button>`).join("")}</div>`;
    $app.querySelectorAll("[data-env]").forEach(b => b.onclick = () => {
      flow.env = b.dataset.env; Store.update(d => d.prefs.env = flow.env); flow.step = "pick"; viewAcil();
    });
  }
  else if (flow.step === "pick") {
    const stats = interventionStats(flow.level);
    const list = rankInterventions(INTERVENTIONS.filter(i => i.levels.includes(flow.level) && i.envs.includes(flow.env)), stats);
    $app.innerHTML = `
      ${back()}
      <h2>3. Hangisini şimdi yapabilirsin?</h2>
      <p class="muted">Seviye ${flow.level} · ${esc(byId(ENVS, flow.env).label)}. Birini seç, uygula, sonra masaya dön.</p>
      ${flow.level === 4 ? `<p class="note warn">${esc(LEVEL4_NOTE)}</p>` : ""}
      <div class="intvs">${list.map(i => {
        const st = stats[i.id];
        return `<article class="intv">
          <header><h3>${esc(i.title)}</h3><span class="dur">${esc(i.dur)}</span></header>
          <div class="meta">${evBadge(i.ev)}${st ? `<span class="badge ${st.verdict.cls}">${esc(st.verdict.label)}</span>` : `<span class="badge ev-own">Henüz denemedin</span>`}</div>
          ${st?.lastNote ? `<p class="mynote">Son notun: ${esc(st.lastNote)}</p>` : ""}
          <ol class="steps">${i.steps.map(x => `<li>${esc(x)}</li>`).join("")}</ol>
          ${i.caution ? `<p class="caution">${esc(i.caution)}</p>` : ""}
          <details><summary>Neden işe yarar?</summary><p>${esc(i.why)}</p>${srcList(i.src)}</details>
          <button class="btn primary" data-pick="${i.id}">Bunu yapacağım</button>
        </article>`; }).join("")}</div>`;
    $app.querySelectorAll("[data-pick]").forEach(b => b.onclick = () => { flow.intv = b.dataset.pick; flow.step = "start"; viewAcil(); });
  }
  else if (flow.step === "start") {
    const i = byId(INTERVENTIONS, flow.intv);
    $app.innerHTML = `
      ${back()}
      <h2>4. Uygula, sonra başla</h2>
      <article class="intv solo"><h3>${esc(i.title)}</h3>
        <ol class="steps check">${i.steps.map(x => `<li><label><input type="checkbox"> ${esc(x)}</label></li>`).join("")}</ol></article>
      ${startForm({ label: "Müdahaleyi yaptım, zamanlayıcıyı başlat" })}`;
    bindStartForm({ level: flow.level, env: flow.env, intv: flow.intv });
  }
  const bb = $app.querySelector("[data-back]");
  if (bb) bb.onclick = () => { flow.step = { env: "level", pick: "env", start: "pick" }[flow.step]; viewAcil(); };
}
const back = () => `<button class="link" data-back>← Geri</button>`;

// ---------- Oturum / zamanlayıcı ----------
function startSession(o) {
  const now = Date.now(), id = now.toString(36);
  Store.update(d => {
    d.prefs.minutes = o.min; d.break = null;
    d.entries.push({ id, ts: now, level: o.level, env: o.env, intv: o.intv, task: o.task, plan: o.plan, plannedMin: o.min, actualMin: null, endTs: null, completed: false, feedback: null });
    d.active = { id, start: now, end: now + o.min * 60e3 };
  });
  Object.assign(flow, { step: "level", level: null, env: null, intv: null });
  try { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission(); } catch {}
}
function finishSession(completed) {
  Store.update(d => {
    const a = d.active; if (!a) return;
    const e = d.entries.find(x => x.id === a.id);
    if (e) { const end = Math.min(Date.now(), a.end); e.endTs = end; e.actualMin = Math.round((end - a.start) / 60e3); e.completed = completed; }
    d.active = null;
  });
}
function startBreak(min) { Store.update(d => d.break = { start: Date.now(), end: Date.now() + min * 60e3 }); }
function beep(n = 1) {
  try {
    const c = new AudioContext();
    for (let k = 0; k < n; k++) { const o = c.createOscillator(); o.frequency.value = 660; o.connect(c.destination); o.start(c.currentTime + k * 0.5); o.stop(c.currentTime + k * 0.5 + 0.3); }
  } catch {}
}
function notify(title, body) {
  try { if ("Notification" in window && Notification.permission === "granted") new Notification(title, { body, silent: true }); } catch {}
}
const mmss = ms => { const t = Math.max(0, Math.ceil(ms / 1000)); return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`; };

function viewOdak() {
  const s = Store.get(), a = s.active;
  if (!a) return viewBitti();
  const e = s.entries.find(x => x.id === a.id);
  $app.innerHTML = `
    <section class="focus">
      <p class="muted">Görev</p><h2>${esc(e.task)}</h2>
      ${e.plan ? `<p class="note">Eğer dikkatin dağılırsa: ${esc(e.plan)}</p>` : ""}
      <div class="clock" id="clock">${mmss(a.end - Date.now())}</div>
      <div class="bar"><div id="prog"></div></div>
      <div class="row"><button class="btn" id="stopEarly">Erken bitir</button></div>
      <p class="muted small">Geri bildirimi şimdi değil, sonra Geçmiş sekmesinden verebilirsin.</p>
    </section>`;
  document.getElementById("stopEarly").onclick = () => { if (confirm("Bloğu şimdi bitir?")) { finishSession(false); viewBitti(); } };
}
// Blok bittikten sonraki ekran: mola, aynı görevle devam, yeni protokol.
function viewBitti() {
  const s = Store.get(), last = doneEntries().slice(-1)[0];
  if (!last) { $app.innerHTML = `<p>Aktif blok yok.</p><div class="row"><a class="btn primary" href="#/blok">Blok başlat</a><a class="btn" href="#/acil">Odağım kaçtı</a></div>`; return; }
  const br = s.break, today = netMinutes(todayEntries());
  $app.innerHTML = `
    <section class="focus">
      <h2>${last.completed ? "Blok tamamlandı." : "Blok erken bitti."}</h2>
      <p class="muted">${esc(last.task)} · ${last.actualMin} dk</p>
      ${goalBar(today, goalMin())}
      ${br ? `<div class="clock small" id="clock">${mmss(br.end - Date.now())}</div><p class="muted">Mola. Uyaranı azalt: yürü, su iç, uzağa bak. Telefon molası mola değildir.</p>`
           : `<p>Mola uyaransız olmalı: yürü, su iç, uzağa bak. Kısa video bir mola değil, yeni bir uyarandır.</p>`}
      <div class="row">
        ${br ? "" : `<button class="btn" id="brk5">5 dk mola</button><button class="btn" id="brk10">10 dk mola</button>`}
        <button class="btn primary" id="again">Aynı görevle devam</button>
      </div>
      <div class="row"><a class="btn" href="#/acil">Odağım kaçtı</a><a class="btn" href="#/gecmis">Geçmiş</a></div>
    </section>`;
  const b5 = document.getElementById("brk5"), b10 = document.getElementById("brk10");
  if (b5) b5.onclick = () => { startBreak(5); viewBitti(); };
  if (b10) b10.onclick = () => { startBreak(10); viewBitti(); };
  document.getElementById("again").onclick = () => {
    startSession({ level: 0, env: last.env, intv: null, task: last.task, plan: last.plan, min: last.plannedMin });
    viewOdak();
  };
}
function tick() {
  const s = Store.get(), a = s.active;
  if (a && Date.now() >= a.end) {
    finishSession(true); beep(2); notify("Blok tamamlandı", "Mola: uyaranı azalt. Sonra aynı görevle devam et.");
    if (location.hash === "#/odak") viewBitti();
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
}

// ---------- Kişisel öğrenme ----------
// Geri bildirimler müdahale başına birikir. Puan: evet=1, kısmen=0.5, hayır=0.
// level verilirse yalnızca o seviyedeki kayıtlar sayılır. Doğrudan bloklar (intv null) sayılmaz.
const WORKED_SCORE = { evet: 1, kismen: 0.5, hayir: 0 };
function interventionStats(level) {
  const r = {};
  Store.get().entries.forEach(e => {
    if (!e.feedback || !e.intv || (level && e.level !== level)) return;
    const x = r[e.intv] ||= { n: 0, ok: 0, score: 0, focus: 0, min: 0, lastNote: "" };
    x.n++; if (e.feedback.worked === "evet") x.ok++;
    x.score += WORKED_SCORE[e.feedback.worked]; x.focus += e.feedback.focus; x.min += e.actualMin || 0;
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
function rankInterventions(list, stats) {
  return list.slice().sort((a, b) =>
    VERDICT_RANK[stats[a.id]?.verdict.key || "yok"] - VERDICT_RANK[stats[b.id]?.verdict.key || "yok"]
    || (stats[b.id]?.rate ?? -1) - (stats[a.id]?.rate ?? -1)
    || EV_RANK[a.ev] - EV_RANK[b.ev]);
}
function bestFor(level) {
  const st = interventionStats(level);
  const best = Object.entries(st).filter(([, x]) => x.verdict.key === "iyi").sort((a, b) => b[1].rate - a[1].rate)[0];
  return best ? byId(INTERVENTIONS, best[0]) : null;
}

// ---------- Geçmiş ----------
function dailyChart(done, days) {
  const goal = goalMin(), map = {};
  done.forEach(e => { const k = dayKey(e.ts); map[k] = (map[k] || 0) + (e.actualMin || 0); });
  const cols = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const k = dayKey(d.getTime()), v = map[k] || 0;
    cols.push({ k, v, lbl: d.toLocaleDateString("tr-TR", { weekday: "short" }).slice(0, 2), day: d.getDate() });
  }
  const max = Math.max(goal, ...cols.map(c => c.v));
  return `<div class="chart" style="--goal:${100 * goal / max}%">
    ${cols.map(c => `<div class="col" title="${c.k}: ${c.v} dk"><div class="colbar ${c.v >= goal ? "hit" : ""}" style="height:${100 * c.v / max}%"></div><span>${c.day}</span></div>`).join("")}
    <div class="goal-line"></div></div>
    <p class="muted small">Son ${days} gün, günlük net dakika. Çizgi: hedef (${fmtMin(goal)}).</p>`;
}
function hourChart(entries) {
  const h = Array(24).fill(0);
  entries.forEach(e => h[new Date(e.ts).getHours()]++);
  const max = Math.max(1, ...h);
  return `<div class="chart hours">${h.map((v, i) => `<div class="col" title="${String(i).padStart(2, "0")}:00 → ${v} kriz"><div class="colbar warn" style="height:${100 * v / max}%"></div>${i % 6 === 0 ? `<span>${String(i).padStart(2, "0")}</span>` : "<span></span>"}</div>`).join("")}</div>
    <p class="muted small">Odağın hangi saatlerde kaçıyor (Seviye 1–4 kayıtları). Yoğun saatlerden önce Hazırlık listesini uygula.</p>`;
}

function viewGecmis() {
  const s = Store.get();
  const done = doneEntries();
  const stats = interventionStats();
  const within = d => done.filter(e => Date.now() - e.ts < d * 864e5);
  const last7 = within(7), last30 = within(30);
  const activeDays = n => new Set(within(n).map(e => dayKey(e.ts))).size || 1;
  const crises = s.entries.filter(e => e.level > 0);
  const workedLbl = { evet: "İşe yaradı", kismen: "Kısmen", hayir: "İşe yaramadı" };
  $app.innerHTML = `
    <h2>Geçmiş</h2>
    <div class="stats">
      <div><b>${fmtMin(netMinutes(todayEntries()))}</b><span>bugün net</span></div>
      <div><b>${fmtMin(netMinutes(last7))}</b><span>7 gün net</span></div>
      <div><b>${fmtMin(netMinutes(last30))}</b><span>30 gün net</span></div>
      <div><b>${fmtMin(Math.round(netMinutes(last7) / activeDays(7)))}</b><span>çalışılan gün ort. (7g)</span></div>
      <div><b>${last7.length}</b><span>blok (7 gün)</span></div>
      <div><b>${crises.filter(e => Date.now() - e.ts < 7 * 864e5).length}</b><span>kriz (7 gün)</span></div>
    </div>
    <form id="goalForm" class="goal-form"><label>Günlük hedef (dk) <input type="number" name="goal" min="15" max="900" step="15" value="${goalMin()}"></label><button class="btn">Kaydet</button></form>
    <h3>Net süre</h3>
    ${dailyChart(done, 14)}
    ${crises.length ? `<h3>Kriz saatleri</h3>${hourChart(crises)}` : ""}
    ${Object.keys(stats).length ? `<h3>Kişisel protokolün</h3>
      <p class="muted small">Geri bildirimlerinden çıkan sonuç. Seviye başına işe yarayan üstte, zayıf olan altta. Hüküm için en az 2 deneme gerekir.</p>
      <div class="personal">${LEVELS.map(l => {
        const st = interventionStats(l.id), ids = Object.keys(st);
        if (!ids.length) return "";
        const ranked = rankInterventions(ids.map(id => byId(INTERVENTIONS, id)).filter(Boolean), st);
        return `<article class="entry lvb${l.id}"><header><span>Seviye ${l.id} · ${esc(l.name)}</span></header>
          <table class="tbl"><tr><th>Müdahale</th><th>Sonuç</th><th>Ort. odak</th><th>Ort. blok</th></tr>
          ${ranked.map(i => { const x = st[i.id]; return `<tr><td>${esc(i.title)}</td><td><span class="badge ${x.verdict.cls}">${esc(x.verdict.label)}</span></td><td>${(x.focus / x.n).toFixed(1)}/5</td><td>${Math.round(x.min / x.n)} dk</td></tr>`; }).join("")}
          </table></article>`; }).join("")}</div>` : ""}
    <h3>Kayıtlar</h3>
    ${done.length ? "" : `<p class="muted">Henüz tamamlanmış blok yok.</p>`}
    <div class="entries">${done.slice().reverse().slice(0, 60).map(e => `
      <article class="entry lvb${e.level}">
        <header><span>${fmtDate(e.ts)} · ${e.level ? `Seviye ${e.level}` : "Doğrudan"} · ${esc(byId(ENVS, e.env)?.label || "")}</span><span>${e.actualMin}/${e.plannedMin} dk ${e.completed ? "✓" : ""}</span></header>
        <p><b>${esc(intvTitle(e))}</b> → ${esc(e.task)}</p>
        ${!e.intv ? "" : e.feedback
          ? `<p class="fb">${workedLbl[e.feedback.worked]} · odak ${e.feedback.focus}/5${e.feedback.note ? ` · ${esc(e.feedback.note)}` : ""}</p>`
          : `<details class="fbform"><summary>Geri bildirim ver</summary>
              <form data-fb="${e.id}">
                <div class="mins">${Object.entries(workedLbl).map(([k, v]) => `<label class="chip"><input type="radio" name="worked" value="${k}" required> ${v}</label>`).join("")}</div>
                <label>Odak kalitesi: <input type="range" name="focus" min="1" max="5" value="3" oninput="this.nextElementSibling.textContent=this.value"> <span>3</span>/5</label>
                <input name="note" maxlength="200" placeholder="Not (isteğe bağlı): ne işe yaradı, ne yaramadı?">
                <button class="btn primary">Kaydet</button>
              </form></details>`}
      </article>`).join("")}</div>
    <div class="row io">
      <button class="btn" id="exp">Veriyi dışa aktar (JSON)</button>
      <label class="btn">İçe aktar<input type="file" id="imp" accept="application/json" hidden></label>
    </div>
    <p class="muted small">Veriler yalnızca bu tarayıcıda saklanır. Cihaz değiştirirken dışa aktar / içe aktar kullan.</p>`;
  document.getElementById("goalForm").onsubmit = ev => {
    ev.preventDefault(); const g = +new FormData(ev.target).get("goal");
    if (g >= 15) { Store.update(d => d.prefs.goalMin = g); viewGecmis(); }
  };
  $app.querySelectorAll("[data-fb]").forEach(f => f.onsubmit = ev => {
    ev.preventDefault();
    const d = new FormData(f);
    Store.update(s => { const e = s.entries.find(x => x.id === f.dataset.fb); e.feedback = { worked: d.get("worked"), focus: +d.get("focus"), note: d.get("note").trim(), ts: Date.now() }; });
    viewGecmis();
  });
  document.getElementById("exp").onclick = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([Store.exportJSON()], { type: "application/json" }));
    a.download = `kendinegel-yedek-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  };
  document.getElementById("imp").onchange = async ev => {
    try { Store.importJSON(await ev.target.files[0].text()); viewGecmis(); } catch (err) { alert("İçe aktarılamadı: " + err.message); }
  };
}

// ---------- Rehber ----------
function viewRehber(modId) {
  if (!modId) {
    const prog = Store.get().guide;
    $app.innerHTML = `<h2>Rehber</h2><p class="muted">Her modül 3–5 kısa karttan oluşur. Bir kart, bir fikir. Ok tuşlarıyla ilerleyebilirsin.</p>
      <div class="mods">${GUIDE.map((m, i) => {
        const seen = prog[m.id] ?? -1;
        return `<a class="tile" href="#/rehber/${m.id}"><span class="lvnum">Modül ${i + 1} · ${m.cards.length} kart</span><h3>${esc(m.title)}</h3>
          <div class="bar"><div style="width:${100 * (seen + 1) / m.cards.length}%"></div></div></a>`; }).join("")}</div>`;
    return;
  }
  const m = byId(GUIDE, modId); if (!m) return viewRehber();
  const idx = GUIDE.indexOf(m), nextMod = GUIDE[idx + 1];
  let i = Math.min(Store.get().guide[m.id] ?? 0, m.cards.length - 1);
  const draw = () => {
    const c = m.cards[i];
    Store.update(d => d.guide[m.id] = Math.max(d.guide[m.id] ?? -1, i));
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
    document.getElementById("prev").onclick = () => { if (i > 0) { i--; draw(); } };
    const n = document.getElementById("next"); if (n) n.onclick = () => { i++; draw(); };
  };
  draw();
  document.onkeydown = e => { if (!location.hash.startsWith("#/rehber/")) return;
    if (e.key === "ArrowRight" && i < m.cards.length - 1) { i++; draw(); } if (e.key === "ArrowLeft" && i > 0) { i--; draw(); } };
}

// ---------- Yönlendirici ----------
function route() {
  const [, page, sub] = location.hash.split("/");
  document.querySelectorAll("[data-nav]").forEach(a => a.classList.toggle("on", a.dataset.nav === page));
  if (page !== "acil") Object.assign(flow, { step: "level" });
  ({ acil: viewAcil, blok: viewBlok, odak: viewOdak, hazirlik: viewHazirlik, gecmis: viewGecmis, rehber: () => viewRehber(sub) }[page] || viewHome)();
  window.scrollTo(0, 0); tick();
}
window.addEventListener("hashchange", route);
setInterval(tick, 1000);
route();
