// Basit hash yönlendirici + görünümler. Bağımlılık yok.
const $app = document.getElementById("app");
const $timerbar = document.getElementById("timerbar");

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const byId = (arr, id) => arr.find(x => x.id === id);
const fmtDate = ts => new Date(ts).toLocaleString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const evBadge = ev => `<span class="badge ${EVIDENCE[ev].cls}">${EVIDENCE[ev].label}</span>`;
const srcList = ids => (ids && ids.length) ? `<ol class="sources">${ids.map(id =>
  `<li>${esc(SOURCES[id])} <a target="_blank" rel="noopener" href="https://scholar.google.com/scholar?q=${encodeURIComponent(SOURCES[id])}">[ara]</a></li>`).join("")}</ol>` : "";

// ---------- Ana sayfa ----------
function viewHome() {
  const s = Store.get();
  const pending = s.entries.filter(e => !e.feedback && e.endTs).length;
  $app.innerHTML = `
    <section class="hero">
      <h1>Odağın kaydığında ne yapacağını önceden bil.</h1>
      <p>Durumunu seç, bulunduğun ortama uygun bir müdahale uygula, küçük bir başlangıç göreviyle işe dön. Öneriler kaynaklıdır ve kanıt seviyesiyle etiketlenmiştir.</p>
      <a class="btn big primary" href="#/acil">Odağım kaçtı</a>
    </section>
    <div class="grid2">
      <a class="tile" href="#/rehber"><h3>Rehber</h3><p>Kısa kartlarla: neden kaçıyoruz, dopamin, sürtünme, kafein, başlama.</p></a>
      <a class="tile" href="#/gecmis"><h3>Geçmiş ${pending ? `<span class="pill">${pending} geri bildirim bekliyor</span>` : ""}</h3><p>Hangi müdahale sende işe yarıyor, odak süren nasıl değişiyor.</p></a>
    </div>`;
}

// ---------- Acil akış ----------
const flow = { step: "level", level: null, env: null, intv: null };

function suggestedLevel() {
  const today = new Date().toDateString();
  const t = Store.get().entries.filter(e => new Date(e.ts).toDateString() === today);
  if (!t.length) return null;
  const last = t[t.length - 1];
  const recent = Date.now() - last.ts < 4 * 3600e3;
  if (!recent) return null;
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
        <button class="level lv${l.id} ${sug && sug.level === l.id ? "suggested" : ""}" data-level="${l.id}">
          <span class="lvnum">Seviye ${l.id}</span><strong>${esc(l.name)}</strong>
          <ul>${l.signs.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
          <span class="goal">${esc(l.goal)}</span>
        </button>`).join("")}</div>`;
    $app.querySelectorAll("[data-level]").forEach(b => b.onclick = () => { flow.level = +b.dataset.level; flow.step = "env"; viewAcil(); });
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
    const list = INTERVENTIONS.filter(i => i.levels.includes(flow.level) && i.envs.includes(flow.env));
    const stats = interventionStats();
    $app.innerHTML = `
      ${back()}
      <h2>3. Hangisini şimdi yapabilirsin?</h2>
      <p class="muted">Seviye ${flow.level} · ${esc(byId(ENVS, flow.env).label)}. Birini seç, uygula, sonra masaya dön.</p>
      ${flow.level === 4 ? `<p class="note warn">${esc(LEVEL4_NOTE)}</p>` : ""}
      <div class="intvs">${list.map(i => {
        const st = stats[i.id];
        return `<article class="intv">
          <header><h3>${esc(i.title)}</h3><span class="dur">${esc(i.dur)}</span></header>
          <div class="meta">${evBadge(i.ev)}${st ? `<span class="badge ev-own">Sende: ${st.ok}/${st.n} işe yaradı</span>` : ""}</div>
          <ol class="steps">${i.steps.map(x => `<li>${esc(x)}</li>`).join("")}</ol>
          ${i.caution ? `<p class="caution">${esc(i.caution)}</p>` : ""}
          <details><summary>Neden işe yarar?</summary><p>${esc(i.why)}</p>${srcList(i.src)}</details>
          <button class="btn primary" data-pick="${i.id}">Bunu yapacağım</button>
        </article>`; }).join("")}</div>`;
    $app.querySelectorAll("[data-pick]").forEach(b => b.onclick = () => { flow.intv = b.dataset.pick; flow.step = "start"; viewAcil(); });
  }
  else if (flow.step === "start") {
    const i = byId(INTERVENTIONS, flow.intv);
    const mins = [10, 15, 20, 25, 45];
    $app.innerHTML = `
      ${back()}
      <h2>4. Uygula, sonra başla</h2>
      <article class="intv solo"><h3>${esc(i.title)}</h3>
        <ol class="steps check">${i.steps.map(x => `<li><label><input type="checkbox"> ${esc(x)}</label></li>`).join("")}</ol></article>
      <form id="startForm" class="card">
        <label>Başlangıç görevi <span class="muted">(somut ve küçük)</span>
          <input name="task" required maxlength="140" placeholder="örn. Ayrık Matematik 3. bölüm, ilk 2 sayfa"></label>
        <label>Eğer dikkatim dağılırsa… <span class="muted">(isteğe bağlı)</span>
          <input name="plan" maxlength="140" placeholder="örn. telefona uzanırsam onu çantaya koyarım"></label>
        <div class="mins">${mins.map(m => `<label class="chip"><input type="radio" name="min" value="${m}" ${m === s.prefs.minutes ? "checked" : ""}> ${m} dk</label>`).join("")}</div>
        <button class="btn big primary">Müdahaleyi yaptım, zamanlayıcıyı başlat</button>
      </form>`;
    document.getElementById("startForm").onsubmit = e => {
      e.preventDefault();
      const f = new FormData(e.target), min = +f.get("min") || 20;
      startSession({ level: flow.level, env: flow.env, intv: flow.intv, task: f.get("task").trim(), plan: f.get("plan").trim(), min });
      Object.assign(flow, { step: "level", level: null, env: null, intv: null });
      location.hash = "#/odak";
    };
  }
  const bb = $app.querySelector("[data-back]");
  if (bb) bb.onclick = () => { flow.step = { env: "level", pick: "env", start: "pick" }[flow.step]; viewAcil(); };
}
const back = () => `<button class="link" data-back>← Geri</button>`;

// ---------- Oturum / zamanlayıcı ----------
function startSession(o) {
  const now = Date.now(), id = now.toString(36);
  Store.update(d => {
    d.prefs.minutes = o.min;
    d.entries.push({ id, ts: now, level: o.level, env: o.env, intv: o.intv, task: o.task, plan: o.plan, plannedMin: o.min, actualMin: null, endTs: null, completed: false, feedback: null });
    d.active = { id, start: now, end: now + o.min * 60e3 };
  });
}
function finishSession(completed) {
  Store.update(d => {
    const a = d.active; if (!a) return;
    const e = d.entries.find(x => x.id === a.id);
    if (e) { const end = Math.min(Date.now(), a.end); e.endTs = end; e.actualMin = Math.round((end - a.start) / 60e3); e.completed = completed; }
    d.active = null;
  });
}
function beep() {
  try { const c = new AudioContext(), o = c.createOscillator(); o.frequency.value = 660; o.connect(c.destination); o.start(); o.stop(c.currentTime + 0.4); } catch {}
}
const mmss = ms => { const t = Math.max(0, Math.ceil(ms / 1000)); return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`; };

function viewOdak() {
  const s = Store.get(), a = s.active;
  if (!a) { $app.innerHTML = `<p>Aktif oturum yok.</p><a class="btn primary" href="#/acil">Yeni protokol</a>`; return; }
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
  document.getElementById("stopEarly").onclick = () => { finishSession(false); location.hash = "#/gecmis"; };
}
function tick() {
  const a = Store.get().active;
  if (a && Date.now() >= a.end) { finishSession(true); beep(); if (location.hash === "#/odak") $app.innerHTML = `<section class="focus"><h2>Blok tamamlandı.</h2><p>Mola: uyaranı azalt (yürü, su iç, uzağa bak). Telefon molası mola değildir.</p><div class="row"><a class="btn primary" href="#/acil">Yeni protokol</a><a class="btn" href="#/gecmis">Geçmiş</a></div></section>`; }
  const act = Store.get().active;
  $timerbar.hidden = !act || location.hash === "#/odak";
  if (act) {
    const left = act.end - Date.now();
    $timerbar.innerHTML = `<a href="#/odak">Odak bloğu sürüyor: ${mmss(left)}</a>`;
    const c = document.getElementById("clock"), p = document.getElementById("prog");
    if (c) c.textContent = mmss(left);
    if (p) p.style.width = `${100 * (1 - left / (act.end - act.start))}%`;
    document.title = location.hash === "#/odak" ? `${mmss(left)} · Odak` : "Kendine Gel";
  } else document.title = "Kendine Gel";
}

// ---------- Geçmiş ----------
function interventionStats() {
  const r = {};
  Store.get().entries.forEach(e => {
    if (!e.feedback) return;
    const x = r[e.intv] ||= { n: 0, ok: 0, focus: 0 };
    x.n++; if (e.feedback.worked === "evet") x.ok++; x.focus += e.feedback.focus;
  });
  return r;
}

function viewGecmis() {
  const s = Store.get();
  const done = s.entries.filter(e => e.endTs);
  const stats = interventionStats();
  const last7 = done.filter(e => Date.now() - e.ts < 7 * 864e5);
  const avg = arr => arr.length ? Math.round(arr.reduce((a, e) => a + e.actualMin, 0) / arr.length) : 0;
  const workedLbl = { evet: "İşe yaradı", kismen: "Kısmen", hayir: "İşe yaramadı" };
  $app.innerHTML = `
    <h2>Geçmiş</h2>
    <div class="stats">
      <div><b>${last7.length}</b><span>blok (7 gün)</span></div>
      <div><b>${last7.reduce((a, e) => a + e.actualMin, 0)}</b><span>dk odak (7 gün)</span></div>
      <div><b>${avg(last7)}</b><span>ort. blok süresi (dk)</span></div>
    </div>
    ${Object.keys(stats).length ? `<h3>Müdahaleler sende nasıl çalışıyor?</h3>
      <table class="tbl"><tr><th>Müdahale</th><th>Deneme</th><th>İşe yaradı</th><th>Ort. odak</th></tr>
      ${Object.entries(stats).sort((a, b) => b[1].ok / b[1].n - a[1].ok / a[1].n).map(([id, x]) =>
        `<tr><td>${esc(byId(INTERVENTIONS, id)?.title || id)}</td><td>${x.n}</td><td>%${Math.round(100 * x.ok / x.n)}</td><td>${(x.focus / x.n).toFixed(1)}/5</td></tr>`).join("")}</table>` : ""}
    <h3>Kayıtlar</h3>
    ${done.length ? "" : `<p class="muted">Henüz tamamlanmış blok yok.</p>`}
    <div class="entries">${done.slice().reverse().map(e => `
      <article class="entry lvb${e.level}">
        <header><span>${fmtDate(e.ts)} · Seviye ${e.level} · ${esc(byId(ENVS, e.env)?.label)}</span><span>${e.actualMin}/${e.plannedMin} dk ${e.completed ? "✓" : ""}</span></header>
        <p><b>${esc(byId(INTERVENTIONS, e.intv)?.title)}</b> → ${esc(e.task)}</p>
        ${e.feedback
          ? `<p class="fb">${workedLbl[e.feedback.worked]} · odak ${e.feedback.focus}/5${e.feedback.note ? ` · ${esc(e.feedback.note)}` : ""}</p>`
          : `<details class="fbform"><summary>Geri bildirim ver</summary>
              <form data-fb="${e.id}">
                <div class="mins">${Object.entries(workedLbl).map(([k, v]) => `<label class="chip"><input type="radio" name="worked" value="${k}" required> ${v}</label>`).join("")}</div>
                <label>Odak kalitesi: <input type="range" name="focus" min="1" max="5" value="3" oninput="this.nextElementSibling.textContent=this.value"> <span>3</span>/5</label>
                <input name="note" maxlength="200" placeholder="Not (isteğe bağlı)">
                <button class="btn primary">Kaydet</button>
              </form></details>`}
      </article>`).join("")}</div>
    <div class="row io">
      <button class="btn" id="exp">Veriyi dışa aktar (JSON)</button>
      <label class="btn">İçe aktar<input type="file" id="imp" accept="application/json" hidden></label>
    </div>
    <p class="muted small">Veriler yalnızca bu tarayıcıda saklanır. Cihaz değiştirirken dışa aktar / içe aktar kullan.</p>`;
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
    $app.innerHTML = `<h2>Rehber</h2><p class="muted">Her modül 3–4 kısa karttan oluşur. Bir kart, bir fikir.</p>
      <div class="mods">${GUIDE.map((m, i) => {
        const seen = prog[m.id] ?? -1;
        return `<a class="tile" href="#/rehber/${m.id}"><span class="lvnum">Modül ${i + 1}</span><h3>${esc(m.title)}</h3>
          <div class="bar"><div style="width:${100 * (seen + 1) / m.cards.length}%"></div></div></a>`; }).join("")}</div>`;
    return;
  }
  const m = byId(GUIDE, modId); if (!m) return viewRehber();
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
        ${i < m.cards.length - 1 ? `<button class="btn primary" id="next">Sonraki →</button>` : `<a class="btn primary" href="#/rehber">Modülü bitir</a>`}</div>`;
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
  ({ acil: viewAcil, odak: viewOdak, gecmis: viewGecmis, rehber: () => viewRehber(sub) }[page] || viewHome)();
  window.scrollTo(0, 0); tick();
}
window.addEventListener("hashchange", route);
setInterval(tick, 1000);
route();
