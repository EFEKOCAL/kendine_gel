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
// Tarayıcı, sayfada bir dokunuş/tuş olmadan sesi açmaz. Sayfa yenilendiyse (ya da Chrome arka
// plandaki sekmeyi boşaltıp yeniden yüklediyse) ses bağlamı askıda kalır ve alarm sessiz çalar.
// Bu yüzden her dokunuşta ses açılır; odak ekranında ses kapalıysa uyarı gösterilir.
function unlockAudio() { try { audio ||= new AudioContext(); audio.onstatechange = syncSoundNote; audio.resume().then(syncSoundNote, () => {}); } catch {} }
const audioOk = () => audio?.state === "running";
function syncSoundNote() { const n = document.getElementById("soundNote"); if (n) n.hidden = audioOk(); }
document.addEventListener("pointerdown", () => audioOk() || unlockAudio(), true);
document.addEventListener("keydown", () => audioOk() || unlockAudio(), true);
function testBeep() {
  unlockAudio();
  try {
    const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime;
    o.frequency.value = 660; g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g).connect(audio.destination); o.start(t); o.stop(t + 0.3);
  } catch {}
}
// Alarm: kullanıcı susturana kadar çalar. Desen ses tamponuna yazılıp döngüye alınır;
// böylece arka plan sekmesinde zamanlayıcılar yavaşlasa da ses aralıksız sürer.
// Susturma: alt şerit, sayfada herhangi bir dokunuş/tuş, bildirime dokunma veya bildirimi kapatma.
let alarm = null;
const $alarm = document.getElementById("alarm");
const alarmChan = "BroadcastChannel" in window ? new BroadcastChannel("kendinegel-alarm") : null;
function startAlarm(n, text) {
  stopAlarm(false);
  try {
    unlockAudio();
    const sr = audio.sampleRate, buf = audio.createBuffer(1, Math.round(sr * 2), sr), d = buf.getChannelData(0), dur = 0.3;
    for (let k = 0; k < n; k++) {
      const off = Math.round(k * 0.45 * sr);
      for (let i = 0; i < dur * sr; i++) {
        const t = i / sr, env = Math.min(1, t / 0.02, (dur - t) / 0.05);
        d[off + i] = 0.3 * env * Math.sin(2 * Math.PI * 660 * t);
      }
    }
    const src = audio.createBufferSource();
    src.buffer = buf; src.loop = true; src.connect(audio.destination); src.start();
    alarm = src;
  } catch {}
  $alarm.querySelector("span").textContent = text;
  $alarm.hidden = false;
}
function stopAlarm(broadcast = true) {
  if (alarm) { try { alarm.stop(); } catch {} alarm = null; }
  $alarm.hidden = true;
  if (broadcast) alarmChan?.postMessage("stop");
  navigator.serviceWorker?.getRegistration().then(r => r?.getNotifications({ tag: "kendinegel" })).then(ns => ns?.forEach(x => x.close())).catch(() => {});
}
const silence = () => { if (!$alarm.hidden) stopAlarm(); };
document.addEventListener("pointerdown", silence, true);
document.addEventListener("keydown", silence, true);
if (alarmChan) alarmChan.onmessage = e => { if (e.data === "stop") stopAlarm(false); };
navigator.serviceWorker?.addEventListener("message", e => { if (e.data === "alarm-stop") stopAlarm(); });
// Android Chrome'da new Notification() çalışmaz; servis çalışanı üzerinden gösterilir.
async function notify(title, body) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try { const r = await navigator.serviceWorker?.getRegistration(); if (r) return r.showNotification(title, { body, tag: "kendinegel", icon: "icon.svg", requireInteraction: true, renotify: true }); } catch {}
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

// Çalışma süresi: bloğun açık kaldığı sürenin tamamı (kullanıcıya güvenilir; odak oranı düşülmez).
// Süren blok canlı eklenir. Net süre bundan ayrı tutulur (odak oranıyla çarpılmış hâli).
function workTotals() {
  const done = doneEntries(), a = Store.get().active;
  const t = { today: timerMinutes(todayEntries()), w: timerMinutes(within(done, 7)), m: timerMinutes(within(done, 30)), all: timerMinutes(done) };
  if (a) {
    const live = Math.floor(workedMs(a) / 60e3);
    for (const k in t) if (k !== "today" || dayKey(a.start) === todayKey()) t[k] += live;
  }
  return t;
}
const fmtHours = m => m >= 600 ? `${Math.round(m / 6) / 10} sa`.replace(".", ",") : fmtMin(m);
const fmtShort = m => m % 60 ? fmtHours(m) : `${m / 60} sa`;
function workCard() {
  const t = workTotals(), live = !!Store.get().active;
  const cell = (k, l) => `<div><b data-wt="${k}">${fmtHours(t[k])}</b><span>${l}</span></div>`;
  return `<section class="card work">
    <p class="muted small">Çalışma süren${live ? " · blok sürüyor, süre canlı ekleniyor" : ""}</p>
    <div class="stats four">${cell("today", "bugün")}${cell("w", "son 7 gün")}${cell("m", "son 30 gün")}${cell("all", "toplam")}</div>
    <p class="muted small">Başlattığın blokların açık kaldığı süre. Bitirirsen o ana kadarki süre eklenir; duraklatılan süre sayılmaz.</p>
  </section>`;
}
function refreshWorkCard() {
  const els = document.querySelectorAll("[data-wt]");
  if (!els.length) return;
  const t = workTotals();
  els.forEach(el => el.textContent = fmtHours(t[el.dataset.wt]));
  const cc = document.getElementById("courseCard"); if (cc) cc.outerHTML = courseCard();
}

// ---------- Dersler ----------
// Ders bazlı çalışma süresi (Σ actualMin, odak oranı düşülmez; workTotals ile aynı ölçü).
// "Diğer" sıralamaya girmez, tablonun sonunda ayrı satırda durur.
const OTHER = "diger";
const courses = () => Store.get().prefs.courses || [];
const courseLabel = e => !e.course ? "" : e.course === OTHER ? `Diğer${e.courseOther ? `: ${e.courseOther}` : ""}` : e.course;
function courseTotals() {
  const s = Store.get(), a = s.active, now = Date.now(), wk = weekStart(now), rows = {};
  const add = (c, ts, m) => {
    const r = rows[c] ||= { wk: 0, m: 0, all: 0 };
    r.all += m; if (now - ts < 30 * DAY) r.m += m; if (ts >= wk) r.wk += m;
  };
  doneEntries().forEach(e => e.course && add(e.course, e.ts, e.actualMin || 0));
  const ae = a && s.entries.find(x => x.id === a.id);
  if (ae?.course) add(ae.course, ae.ts, Math.floor(workedMs(a) / 60e3));
  return rows;
}
// Haftalık en az çalışma hedefi: her ders için sabit 1 saat (Pazartesi–Pazar), elle girilmez.
// Derste anlatılanın tekrarı önceden belirlenmez; o dersle başlatılan bloklar sayılır. Fazlası sorun değil.
const WEEK_GOAL_MIN = 60;
const courseGoal = c => c === OTHER ? 0 : WEEK_GOAL_MIN;

// Ders seçimi gelmeden önceki bloklar: ders, görev notundan anahtar kelimeyle bulunur.
// Tek bir derse uyuyorsa o derse, hiçbirine ya da birden fazlasına uyuyorsa "Diğer"e yazılır.
// Kesim tarihinden sonraki bloklara dokunulmaz (orada ders bilerek boş bırakılmış olabilir). Geçmiş → Düzenle ile düzeltilebilir.
const COURSE_BACKFILL_BEFORE = new Date(2026, 10, 20).getTime();
const COURSE_KEYWORDS = {
  "İşletim Sistemleri": /isletim|\bos\b|operating|\bisl\.? ?sis/,
  "Sinyaller ve Sistemler": /sinyal|signal|fourier|laplace|konvolusyon|convolution/,
  "Mikrodenetleyiciler": /mikro ?denet|mikro\b|microcontroller|\bmcu\b|arduino|stm32|gomulu|embedded/,
  "Yapay Sinir Ağları": /sinir ag|\bysa\b|neural|perceptron|backprop|yapay sinir/,
  "Nesne Yönelimli Programlama": /nesne|\boop\b|\bnyp\b|object.?orient|kalitim|inheritance|polimorf/,
  "Atatürk İlkeleri ve İnkılap Tarihi": /ataturk|inkilap|\bait\b|\bink\.? ?tar/,
  "Algoritma Analizi": /algoritma|algorithm|\balgo\b|big.?o\b|karmasiklik|complexity|recurrence|master teorem/,
};
const fold = t => String(t || "").toLocaleLowerCase("tr").replace(/[ıİ]/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c").replace(/â/g, "a");
function guessCourse(text) {
  const t = fold(text), hits = Object.keys(COURSE_KEYWORDS).filter(c => COURSE_KEYWORDS[c].test(t));
  return hits.length === 1 ? hits[0] : OTHER;
}
function backfillCourses() {
  const need = Store.get().entries.some(e => !e.course && e.endTs && e.ts < COURSE_BACKFILL_BEFORE);
  if (!need) return;
  Store.update(d => d.entries.forEach(e => {
    if (e.course || !e.endTs || e.ts >= COURSE_BACKFILL_BEFORE) return;
    e.course = guessCourse(`${e.task || ""} ${e.next || ""}`); e.courseOther = ""; e.courseAuto = true;
  }));
}
function weekCell(min, goal) {
  if (!goal) return fmtHours(min);
  const pct = Math.min(100, Math.round(100 * min / goal));
  return `${fmtHours(min)} <span class="muted">/ ${fmtShort(goal)}</span>
    <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${goal}" aria-valuenow="${min}" aria-label="Haftalık hedef"><div class="${min >= goal ? "hit" : ""}" style="width:${pct}%"></div></div>`;
}
function courseCard() {
  const rows = courseTotals(), other = rows[OTHER], z = { wk: 0, m: 0, all: 0 };
  courses().forEach(c => { rows[c] ||= { ...z }; });
  const list = Object.keys(rows).filter(c => c !== OTHER && (rows[c].all > 0 || courses().includes(c))).sort((x, y) => rows[y].all - rows[x].all || rows[y].wk - rows[x].wk);
  if (!list.length && !other?.all) return `<div id="courseCard" hidden></div>`;
  const tr = (name, r, goal, cls = "") => `<tr${cls}><td>${esc(name)}</td><td class="wk">${weekCell(r.wk, goal)}</td><td>${fmtHours(r.m)}</td><td><b>${fmtHours(r.all)}</b></td></tr>`;
  return `<section class="card work courses" id="courseCard">
    <p class="muted small">Derslere göre çalışma süresi · haftalık hedef her ders için 1 saat (<a href="#/program">Ders programı</a>)</p>
    <table class="tbl"><tr><th>Ders</th><th>Bu hafta</th><th>30 gün</th><th>Toplam</th></tr>
      ${list.map(c => tr(c, rows[c], courseGoal(c))).join("")}
      ${other?.all ? tr("Diğer", other, 0, ' class="other"') : ""}
    </table>
  </section>`;
}

// ---------- Program: haftalık ders programı, yoklama ----------
// schedule: [{id, course, day (0=Pzt … 6=Paz), start "09:00", end "10:50", place, since (gün anahtarı)}]
// attend: { "YYYY-MM-DD|slotId": {c: ders, st: "gittim"|"gitmedim"|"yok", t: başlangıç} }
// Ders saatinin başlangıcı geçince yoklama sorulur. Programdan silinen dersin yoklama kayıtları kalır.
const DAYS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
const ATTEND = [["gittim", "Gittim"], ["gitmedim", "Gitmedim"], ["yok", "Ders yapılmadı"]];
const weekday = ts => (new Date(ts).getDay() + 6) % 7;
const atTime = (key, hm) => { const [y, mo, d] = key.split("-").map(Number), [h, mi] = hm.split(":").map(Number); return new Date(y, mo - 1, d, h, mi).getTime(); };
const slotSort = (a, b) => a.day - b.day || a.start.localeCompare(b.start);
// Geçmiş ders saatleri (en yeni önce). Başlangıç: yoklama başlangıç tarihi ya da dersin programa eklendiği gün; en çok 16 hafta geriye.
function lectureOccurrences(days = 112) {
  const s = Store.get(), now = Date.now(), out = [];
  const from = Math.max(now - days * DAY, weekStart(now) - 16 * 7 * DAY);
  for (const sl of s.schedule || []) {
    const startKey = s.prefs.attendFrom && s.prefs.attendFrom < sl.since ? s.prefs.attendFrom : sl.since;
    for (let t = weekStart(from) + sl.day * DAY; t <= now; t += 7 * DAY) {
      const key = dayKey(t); if (key < startKey || t < from - DAY) continue;
      const ts = atTime(key, sl.start); if (ts > now) continue;
      const id = `${key}|${sl.id}`, rec = s.attend?.[id];
      out.push({ id, ts, key, course: sl.course, start: sl.start, end: sl.end, st: rec?.st || null });
    }
  }
  // Programdan silinmiş derslerin kayıtları
  const seen = new Set(out.map(o => o.id));
  for (const [id, r] of Object.entries(s.attend || {})) if (!seen.has(id)) {
    const key = id.split("|")[0]; out.push({ id, ts: atTime(key, r.t || "00:00"), key, course: r.c, start: r.t || "", st: r.st });
  }
  return out.sort((a, b) => b.ts - a.ts);
}
const pendingAttendance = (days = 7) => lectureOccurrences().filter(o => !o.st && Date.now() - o.ts < days * DAY);
function setAttend(id, course, start, st) {
  Store.update(d => { d.attend ||= {}; if (st) d.attend[id] = { c: course, st, t: start }; else delete d.attend[id]; });
}
function attendButtons(o) {
  return `<div class="row tight">${ATTEND.map(([k, l]) => `<button class="chip xs${o.st === k ? " on" : ""}" data-att="${esc(o.id)}" data-c="${esc(o.course)}" data-t="${esc(o.start)}" data-v="${k}">${l}</button>`).join("")}</div>`;
}
function bindAttend(after) {
  $app.querySelectorAll("[data-att]").forEach(b => b.onclick = () => {
    const cur = Store.get().attend?.[b.dataset.att]?.st;
    setAttend(b.dataset.att, b.dataset.c, b.dataset.t, cur === b.dataset.v ? null : b.dataset.v); after();
  });
}
const occLabel = o => `${new Date(o.ts).toLocaleDateString("tr-TR", { day: "numeric", month: "short", weekday: "short" })} ${o.start}`;
// Ana sayfa: bugünün dersleri ve cevaplanmamış yoklamalar
function attendHomeCard() {
  const s = Store.get(), today = weekday(Date.now()), now = Date.now();
  const todays = (s.schedule || []).filter(sl => sl.day === today).sort(slotSort);
  const pend = pendingAttendance().slice(0, 4);
  if (!todays.length && !pend.length) return "";
  return `<section class="card attend">
    ${todays.length ? `<p class="muted small">Bugünkü dersler</p><p>${todays.map(sl => `<span${atTime(todayKey(), sl.end || sl.start) < now ? ' class="muted"' : ""}>${esc(sl.start)} ${esc(sl.course)}</span>`).join(" · ")}</p>` : ""}
    ${pend.length ? `<p class="muted small">Derse gittin mi?</p>${pend.map(o => `<div class="attrow"><span>${esc(occLabel(o))} · <b>${esc(o.course)}</b></span>${attendButtons(o)}</div>`).join("")}` : ""}
  </section>`;
}
function attendanceStats() {
  const r = {};
  for (const o of lectureOccurrences()) {
    if (!o.st || o.st === "yok") continue;
    const x = r[o.course] ||= { go: 0, n: 0, go4: 0, n4: 0 };
    x.n++; if (o.st === "gittim") x.go++;
    if (Date.now() - o.ts < 28 * DAY) { x.n4++; if (o.st === "gittim") x.go4++; }
  }
  return r;
}
function viewProgram() {
  const s = Store.get(), cs = courses(), slots = (s.schedule || []).slice().sort(slotSort);
  const rows = courseTotals(), st = attendanceStats(), occ = lectureOccurrences();
  const pct = (a, b) => b ? `${a}/${b} (%${Math.round(100 * a / b)})` : "–";
  const byWeek = {};
  occ.forEach(o => (byWeek[weekStart(o.ts)] ||= []).push(o));
  // Hafta içi 5 gün her zaman görünür; hafta sonu yalnızca o güne ders girilmişse.
  const showDays = DAYS.map((dn, i) => i).filter(i => i < 5 || slots.some(x => x.day === i));
  $app.innerHTML = `
    <h2>Ders programı</h2>
    <p class="muted small">Her günün altındaki "Ders ekle" ile o günün derslerini gir. Ders saati başlayınca ana sayfada "Derse gittin mi?" sorulur; aşağıdaki Yoklama bölümünden geçmişe dönük de işaretleyebilirsin.</p>
    <div class="tt">${showDays.map(i => { const ds = slots.filter(x => x.day === i); return `
      <div class="sday"><h4>${DAYS[i]}</h4>
        ${ds.length ? ds.map(x => `<div class="slot"><span class="stime">${esc(x.start)}${x.end ? `–${esc(x.end)}` : ""}</span><span><b>${esc(x.course)}</b>${x.place ? ` <span class="muted">· ${esc(x.place)}</span>` : ""}</span><button class="link inline" data-delslot="${x.id}" aria-label="${esc(x.course)} ${DAYS[i]} ${esc(x.start)} sil">sil</button></div>`).join("") : `<p class="muted small">Ders yok</p>`}
        <details class="addslot"><summary>Ders ekle</summary>
          <form class="stack" data-slotday="${i}">
            <select name="course" required aria-label="Ders">${cs.map(c => `<option>${esc(c)}</option>`).join("")}</select>
            <div class="row tight"><label>Başlangıç <input type="time" name="start" required value="${esc(ds.at(-1)?.end || "09:00")}"></label><label>Bitiş <input type="time" name="end"></label></div>
            <input name="place" maxlength="40" placeholder="Derslik (isteğe bağlı)" aria-label="Derslik">
            <button class="btn small primary">Ekle</button>
          </form></details>
      </div>`; }).join("")}</div>

    <h3>Yoklama</h3>
    <form id="attFromForm" class="goal-form"><label>Dönem başı <input type="date" name="from" value="${esc(s.prefs.attendFrom || "")}"></label><button class="btn">Kaydet</button></form>
    <p class="muted small">Dönem başını girersen o tarihten bu yana geçen ders saatleri listelenir ve geriye dönük işaretlenebilir. Girmezsen yoklama, dersin programa eklendiği günden başlar. "Ders yapılmadı" orana girmez. Seçili butona tekrar dokununca işaret kalkar.</p>
    ${Object.keys(st).length ? `<table class="tbl"><tr><th>Ders</th><th>Son 4 hafta</th><th>Tümü</th></tr>
      ${Object.keys(st).sort().map(c => `<tr><td>${esc(c)}</td><td>${pct(st[c].go4, st[c].n4)}</td><td>${pct(st[c].go, st[c].n)}</td></tr>`).join("")}</table>` : ""}
    ${occ.length ? Object.keys(byWeek).sort((a, b) => b - a).map(w => `
      <div class="attweek"><h4>${new Date(+w).toLocaleDateString("tr-TR", { day: "numeric", month: "long" })} haftası</h4>
      ${byWeek[w].map(o => `<div class="attrow"><span>${esc(occLabel(o))} · <b>${esc(o.course)}</b></span>${attendButtons(o)}</div>`).join("")}</div>`).join("")
      : `<p class="muted">Geçmiş ders saati yok.</p>`}

    <h3>Haftalık çalışma hedefi</h3>
    <p class="muted small">Her ders için haftada en az 1 saat (Pazartesi–Pazar). O dersle başlattığın bloklar sayılır; fazlası sorun değil.</p>
    <section class="card goals">
      <table class="tbl"><tr><th>Ders</th><th>Bu hafta</th></tr>
      ${cs.map(c => `<tr><td>${esc(c)}</td><td class="wk">${weekCell(rows[c]?.wk || 0, courseGoal(c))}</td></tr>`).join("")}
      </table>
    </section>

    <h3>Dersler</h3>
    <form id="coursesForm" class="stack">
      <textarea name="list" rows="${Math.max(3, cs.length)}" aria-label="Dersler, her satıra bir tane">${esc(cs.join("\n"))}</textarea>
      <button class="btn">Ders listesini kaydet</button>
      <p class="muted small">Her satıra bir ders. Adı değişen ders yeni ders sayılır; eski adla tutulan süre ve yoklama kayıtlarda kalır.</p>
    </form>`;

  $app.querySelectorAll("[data-slotday]").forEach(form => form.onsubmit = e => {
    e.preventDefault(); const f = new FormData(form);
    const sl = { id: Date.now().toString(36), course: f.get("course"), day: +form.dataset.slotday, start: f.get("start"), end: f.get("end") || "", place: f.get("place").trim(), since: todayKey() };
    if (!sl.course || !sl.start) return;
    Store.update(d => (d.schedule ||= []).push(sl)); viewProgram();
    // Aynı güne art arda ders girilebilsin diye o günün formu açık kalır.
    const again = $app.querySelector(`[data-slotday="${sl.day}"]`); if (again) { again.closest("details").open = true; again.querySelector("select").focus(); }
  });
  $app.querySelectorAll("[data-delslot]").forEach(b => b.onclick = () => {
    if (!confirm("Bu ders saati programdan silinsin mi? İşaretlenmiş yoklamalar kalır.")) return;
    Store.update(d => d.schedule = (d.schedule || []).filter(x => x.id !== b.dataset.delslot)); viewProgram();
  });
  document.getElementById("attFromForm").onsubmit = e => {
    e.preventDefault(); const v = new FormData(e.target).get("from") || null;
    Store.update(d => d.prefs.attendFrom = v); viewProgram();
  };
  document.getElementById("coursesForm").onsubmit = e => {
    e.preventDefault();
    const list = [...new Set(new FormData(e.target).get("list").split("\n").map(x => x.trim()).filter(Boolean))].slice(0, 20);
    Store.update(d => d.prefs.courses = list); viewProgram();
  };
  bindAttend(viewProgram);
}
// Başlangıç formundaki ders butonları. Seçim isteğe bağlı; "Diğer" seçilince metin kutusu açılır.
function courseChips(cur, curOther) {
  const cs = courses();
  if (cur && cur !== OTHER && !cs.includes(cur)) cur = null;
  return `<fieldset class="coursepick"><legend>Ders <span class="muted">(isteğe bağlı)</span></legend>
    <div class="mins">${cs.map(c => `<label class="chip"><input type="radio" name="course" value="${esc(c)}" ${c === cur ? "checked" : ""}> ${esc(c)}</label>`).join("")}
      <label class="chip"><input type="radio" name="course" value="${OTHER}" ${cur === OTHER ? "checked" : ""}> Diğer</label></div>
    <input name="courseOther" maxlength="80" placeholder="Ne çalışacaksın? (isteğe bağlı)" value="${esc(curOther || "")}" ${cur === OTHER ? "" : "hidden"} aria-label="Diğer: ne çalışacaksın">
    <details class="fbform"><summary>Dersleri düzenle</summary>
      <textarea id="courseEdit" rows="${Math.max(3, cs.length)}" aria-label="Dersler, her satıra bir tane">${esc(cs.join("\n"))}</textarea>
      <button class="btn small" type="button" id="courseSave">Kaydet</button>
      <p class="muted small">Her satıra bir ders. Listeden çıkan dersin geçmiş süresi kayıtlarda kalır.</p></details>
  </fieldset>`;
}
function bindCourseChips(form) {
  const other = form.querySelector("[name=courseOther]"), radios = form.querySelectorAll("[name=course]");
  const mark = () => radios.forEach(x => x.dataset.was = x.checked ? "1" : "");
  radios.forEach(r => r.onclick = () => {
    if (r.dataset.was === "1") r.checked = false; // seçili butona tekrar dokununca seçim kalkar
    mark();
    other.hidden = !(r.checked && r.value === OTHER);
    if (!other.hidden) other.focus();
  });
  mark();
  form.querySelector("#courseSave").onclick = () => {
    const list = [...new Set(form.querySelector("#courseEdit").value.split("\n").map(x => x.trim()).filter(Boolean))].slice(0, 20);
    Store.update(d => d.prefs.courses = list);
    const cur = form.querySelector("[name=course]:checked")?.value;
    form.querySelector(".coursepick").outerHTML = courseChips(cur, other.value);
    bindCourseChips(form);
  };
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
  const needBackup = s.entries.length >= 10 && FileSync.info().state !== "connected" &&(!s.prefs.lastExport || Date.now() - s.prefs.lastExport > 14 * DAY);
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
    ${workCard()}
    ${courseCard()}
    ${attendHomeCard()}
    <div id="fsHome">${fsHomeNote()}</div>
    ${weeklyCard()}
    ${needBackup ? `<p class="note">Veriler yalnızca bu tarayıcıda. Son yedek: ${s.prefs.lastExport ? `${Math.floor((Date.now() - s.prefs.lastExport) / DAY)} gün önce` : "hiç alınmadı"}. <button class="link inline" id="quickExport">Şimdi dışa aktar</button></p>` : ""}
    <div class="grid2">
      <a class="tile" href="#/hazirlik"><h3>Hazırlık <span class="muted small">${prepDone}/${PREP.length}</span></h3><p>Oturmadan önce 2 dakikalık kontrol listesi. Odak kaymadan önce sürtünmeyi ayarla.</p></a>
      <a class="tile" href="#/rehber"><h3>Rehber</h3><p>Kaynaklı kısa yazılar: neden kaçıyoruz, ödül sistemi, telefon ve kısa video, uyku, verimli çalışma.</p></a>
      <a class="tile" href="#/gecmis"><h3>Geçmiş ${pending ? `<span class="pill">${pending} geri bildirim bekliyor</span>` : ""}</h3><p>Net süre, haftalar, kayma saatlerin, dağılma nedenlerin ve sende işe yarayan müdahaleler.</p></a>
    </div>`;
  bindIntro(); bindWeekly(); bindAttend(viewHome);
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
function defaultCourse() {
  const last = doneEntries().slice(-1)[0];
  return last && dayKey(last.ts) === todayKey() ? { c: last.course, o: last.courseOther } : { c: null, o: "" };
}
function defaultTask() {
  const s = Store.get(), last = doneEntries().slice(-1)[0];
  if (s.tomorrow?.date === todayKey() && !todayEntries().length) return s.tomorrow.task;
  return last && dayKey(last.ts) === todayKey() ? (last.next || last.task) : "";
}
function startForm(opts) {
  const s = Store.get(), base = MINS.includes(s.prefs.minutes) ? s.prefs.minutes : 20;
  const hint = opts.min ? null : lengthHint(base), sel = opts.min || (hint ? hint.min : base);
  const plans = (s.prefs.plans || []).slice(0, 5), dc = defaultCourse();
  return `<form id="startForm" class="card">
    ${courseChips(dc.c, dc.o)}
    <label>Başlangıç görevi <span class="muted">(somut ve küçük; ders seçtiysen boş bırakılabilir)</span>
      <input name="task" maxlength="140" value="${esc(opts.task ?? defaultTask())}" placeholder="örn. 3. bölüm, ilk 2 sayfa"></label>
    <p class="muted small" id="startErr" role="alert"></p>
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
  const form = document.getElementById("startForm");
  bindCourseChips(form);
  form.onsubmit = e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const course = f.get("course") || null, courseOther = course === OTHER ? (f.get("courseOther") || "").trim() : "";
    // Ders seçildiyse görev boş kalabilir; görev adı ders adı olur.
    const task = f.get("task").trim() || (course ? courseLabel({ course, courseOther }) : "");
    if (!task) { document.getElementById("startErr").textContent = "Bir ders seç ya da başlangıç görevini yaz."; form.querySelector("[name=task]").focus(); return; }
    unlockAudio();
    startSession({ ...extra(), task, course, courseOther, plan: f.get("plan").trim(), min: +f.get("min") || 20 });
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
      course: o.course || null, courseOther: o.courseOther || "",
      plannedMin: o.min, actualMin: null, endTs: null, completed: false, feedback: null, focusShare: null, distr: [], pauses: [] });
    d.active = { id, start: now, end: now + o.min * 60e3, paused: 0, pause: null };
  });
  resetFlow();
  try { navigator.storage?.persist?.(); } catch {}
}
function finishSession(completed) {
  Store.update(d => {
    const a = d.active; if (!a) return;
    const e = d.entries.find(x => x.id === a.id);
    if (e) {
      if (a.pause) closePause(d, a, Math.min(Date.now() - a.pause.t, a.pause.min * 60e3), pauseLeft(a) <= 0);
      const end = a.pause ? a.pause.t : Math.min(Date.now(), a.end);
      e.endTs = end; e.actualMin = Math.round(workedMs(a) / 60e3); e.completed = completed;
      if (!a.pause && Date.now() - a.end > 15 * 60e3) e.lateClose = true;
    }
    d.active = null;
  });
  syncWakeLock();
}

// Duraklatma: blok 5 ya da 10 dk bekletilir. Duraklatılan süre çalışmaya sayılmaz.
// Süre dolarsa blok, duraklatmanın başladığı ana kadarki çalışmayla kapanır (tick).
const PAUSE_OPTS = [5, 10];
const pauseLeft = a => a?.pause ? a.pause.t + a.pause.min * 60e3 - Date.now() : 0;
const blockLeft = a => a.end - (a.pause ? a.pause.t : Date.now());
const blockTotal = a => a.end - a.start - (a.paused || 0);
function workedMs(a) {
  const stop = a.pause ? a.pause.t : Math.min(Date.now(), a.end);
  return Math.max(0, stop - a.start - (a.paused || 0));
}
function closePause(d, a, dur, over) {
  const e = d.entries.find(x => x.id === a.id), p = e?.pauses?.find(x => x.t === a.pause.t);
  if (p) { p.dur = dur; if (over) p.over = true; }
}
function pauseBlock(min, note) {
  unlockAudio();
  Store.update(d => {
    const a = d.active; if (!a || a.pause) return;
    const t = Date.now(), e = d.entries.find(x => x.id === a.id);
    a.pause = { t, min, note: note || "" };
    if (e) (e.pauses ||= []).push({ t, min, note: note || "", dur: null });
  });
}
function resumeBlock() {
  Store.update(d => {
    const a = d.active; if (!a?.pause) return;
    const dur = Date.now() - a.pause.t;
    closePause(d, a, dur, false);
    a.end += dur; a.paused = (a.paused || 0) + dur; a.pause = null;
  });
}
const pauseSummary = ps => (ps || []).filter(p => p.dur != null)
  .map(p => `${Math.max(1, Math.round(p.dur / 60e3))} dk${p.note ? ` (${esc(p.note)})` : ""}${p.over ? ", süre doldu" : ""}`).join(" · ");
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
  const stopEarly = () => {
    const cur = Store.get().active; if (!cur) return viewBitti();
    const w = workedMs(cur);
    if (w < 60e3) { if (confirm("Blok 1 dakikadan kısa. İptal edilsin mi? Kayıt tutulmaz.")) { cancelSession(); location.hash = "#/"; } return; }
    if (confirm(`Bloğu bitir? Geçen ${fmtMin(Math.round(w / 60e3))} çalışma süresine eklenir.`)) { finishSession(false); viewBitti(); }
  };
  if (a.pause) {
    $app.innerHTML = `
    <section class="focus">
      <p class="muted">Görev</p><h2>${esc(e.task)}</h2>
      <p class="muted small">Duraklatıldı · kalan blok süresi</p>
      <div class="clock" id="clock">${mmss(blockLeft(a))}</div>
      <div class="bar"><div id="prog"></div></div>
      <p>Duraklatmanın bitmesine <b id="pclock">${mmss(pauseLeft(a))}</b></p>
      ${a.pause.note ? `<p class="note">Sebep: ${esc(a.pause.note)}</p>` : ""}
      <p class="muted small">Süre dolarsa alarm çalar ve blok, duraklattığın ana kadarki çalışmayla kaydedilir.</p>
      <div class="row"><button class="btn primary" id="resume">Devam et</button><button class="btn" id="stopEarly">Bitir</button></div>
      <a class="link" href="#/">Ana sayfa</a>
    </section>`;
    document.getElementById("resume").onclick = () => { unlockAudio(); resumeBlock(); viewOdak(); };
    document.getElementById("stopEarly").onclick = stopEarly;
    syncWakeLock();
    return;
  }
  $app.innerHTML = `
    <section class="focus">
      <p class="muted">Görev</p><h2>${esc(e.task)}</h2>
      <div class="clock" id="clock">${mmss(blockLeft(a))}</div>
      <div class="bar"><div id="prog"></div></div>
      <div id="distrBox" class="distr"><button class="btn" id="distr">Dikkatim dağıldı</button></div>
      <div id="pauseBox" class="row"><button class="btn" id="pause">Duraklat</button><button class="btn" id="stopEarly">Bitir</button></div>
      <p class="note" id="soundNote" ${audioOk() ? "hidden" : ""}>Bitiş sesi kapalı: tarayıcı, sayfa yenilendikten sonra sesi ancak bir dokunuşla açar. <button class="btn" id="soundOn">Sesi aç ve dene</button></p>
      <label class="check small muted"><input type="checkbox" id="wl" ${s.prefs.wakeLock ? "checked" : ""}> Ekranı açık tut</label>
      <p class="muted small">Telefon kilitlenirse bitiş sesi gecikebilir; süre yine doğru sayılır.</p>
      <a class="link" href="#/">Ana sayfa</a>
    </section>`;
  document.getElementById("soundOn").onclick = testBeep;
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
  document.getElementById("stopEarly").onclick = stopEarly;
  document.getElementById("pause").onclick = () => {
    const box = document.getElementById("pauseBox");
    box.className = "card ask";
    box.innerHTML = `<p class="small">Ne kadar duraklatayım? Duraklatılan süre çalışmaya sayılmaz.</p>
      <input id="pauseNote" maxlength="140" aria-label="Duraklatma sebebi (isteğe bağlı)" placeholder="Sebep (isteğe bağlı): kapı, telefon görüşmesi…">
      <div class="mins center">${PAUSE_OPTS.map(m => `<button class="chip" data-pm="${m}">${m} dk</button>`).join("")}</div>
      <div class="row tight center"><button class="btn small" id="pauseCancel">Vazgeç</button></div>`;
    document.getElementById("pauseNote").focus();
    box.querySelectorAll("[data-pm]").forEach(b => b.onclick = () => {
      pauseBlock(+b.dataset.pm, document.getElementById("pauseNote").value.trim()); viewOdak();
    });
    document.getElementById("pauseCancel").onclick = viewOdak;
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
  const ps = last.pauses || [], over = ps.some(p => p.over);
  const rem = last.completed ? 0 : last.plannedMin - last.actualMin;
  $app.innerHTML = `
    <section class="focus">
      <h2>${last.completed ? "Blok tamamlandı." : over ? "Duraklatma süresi doldu." : "Blok durduruldu."}</h2>
      <p class="muted">${esc(last.task)} · ${last.actualMin} dk${dn ? ` · ${dn} dağılma${dk ? ` (en çok ${esc(DISTR.find(x => x[0] === dk[0])[1].toLowerCase())})` : ""}` : ""}${ps.length ? ` · ${ps.length} duraklatma` : ""}</p>
      ${over ? `<p class="small">Blok, duraklattığın ana kadarki ${last.actualMin} dk ile kaydedildi.</p>` : ""}
      ${last.focusShare == null ? `<div class="card ask">
        ${last.lateClose ? `<p class="small">Blok, uygulama kapalıyken bitti. Süreyi Geçmiş'ten düzeltebilirsin.</p>` : ""}
        <p>Bu bloğun ne kadarı gerçekten odaklıydı?</p>
        <div class="mins center">${FOCUS_OPTS.map(([v, l]) => `<button class="chip" data-fs="${v}">${l}</button>`).join("")}</div>
      </div>` : `<p class="muted small">Odak: ${focusLabel(last.focusShare)}</p>
        ${last.focusShare <= 0.25 ? `<p class="note">Düşük odak bir veri, karakter kanıtı değil. Sıradaki blok 10 dk; hâlâ zor geliyorsa önce <a href="#/acil">Protokol</a>'den bir müdahale seç.</p>` : ""}`}
      ${goalBar(todayEntries(), goalMin())}
      ${br ? `<div class="clock small" id="clock">${mmss(br.end - Date.now())}</div><p class="muted">Mola. Uyaranı azalt: yürü, su iç, uzağa bak.</p>`
           : `<p>Mola uyaransız olmalı: yürü, su iç, uzağa bak. Kısa video mola değil, yeni bir uyarandır.</p>`}
      <label class="resume">Kaldığın yer / sıradaki ilk adım <span class="muted">(dönüşü kolaylaştırır)</span>
        <input id="nextTask" maxlength="140" value="${esc(last.next || last.task)}"></label>
      <div class="row">
        ${br ? "" : `<button class="btn" id="brk5">5 dk mola</button><button class="btn" id="brk10">10 dk mola</button>`}
        ${rem >= 1 ? `<button class="btn primary" id="rest">Kalan ${rem} dk ile devam</button>` : ""}
        <button class="btn${rem >= 1 ? "" : " primary"}" id="again">${rem >= 1 ? `Yeni blok (${last.plannedMin} dk)` : "Devam et"}</button>
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
  const cont = min => {
    unlockAudio(); saveNext();
    startSession({ level: 0, env: last.env, intv: null, task: nt.value.trim() || last.task, plan: last.plan, min, course: last.course, courseOther: last.courseOther });
    viewOdak();
  };
  document.getElementById("again").onclick = () => {
    const low = last.focusShare != null && last.focusShare <= 0.25;
    cont(low ? Math.min(10, last.plannedMin) : last.plannedMin);
  };
  const restBtn = document.getElementById("rest");
  if (restBtn) restBtn.onclick = () => cont(rem);
  const ny = document.getElementById("nYes"), nn = document.getElementById("nNo");
  if (ny) ny.onclick = async () => { Store.update(d => d.prefs.notifAsked = true); try { await Notification.requestPermission(); } catch {} viewBitti(); };
  if (nn) nn.onclick = () => { Store.update(d => d.prefs.notifAsked = true); viewBitti(); };
}

function tick() {
  const s = Store.get(), a = s.active;
  if (a?.pause && pauseLeft(a) <= 0) {
    const short = workedMs(a) < 60e3;
    if (short) cancelSession(); else finishSession(false);
    const msg = short ? "Blok 1 dakikadan kısa olduğu için kaydedilmedi." : "Blok o ana kadarki süreyle kaydedildi. Kalan süreyle devam edebilirsin.";
    startAlarm(2, "Duraklatma bitti"); notify("Duraklatma bitti", msg);
    if (location.hash === "#/odak") { document.body.classList.remove("focusing"); if (short) location.hash = "#/"; else viewBitti(); }
  } else if (a && !a.pause && Date.now() >= a.end) {
    finishSession(true); startAlarm(2, "Blok tamamlandı"); notify("Blok tamamlandı", "Mola: uyaranı azalt. Sonra aynı görevle devam et.");
    if (location.hash === "#/odak") { document.body.classList.remove("focusing"); viewBitti(); }
  }
  if (s.break && Date.now() >= s.break.end) {
    Store.update(d => d.break = null); startAlarm(1, "Mola bitti"); notify("Mola bitti", "Aynı görevle devam et.");
    if (location.hash === "#/odak") viewBitti();
  }
  const act = Store.get().active, br = Store.get().break;
  const onOdak = location.hash === "#/odak";
  $timerbar.hidden = !(act || br) || onOdak;
  const c = document.getElementById("clock"), p = document.getElementById("prog");
  if (act) {
    const left = blockLeft(act), pl = pauseLeft(act), pc = document.getElementById("pclock");
    $timerbar.innerHTML = act.pause ? `<a href="#/odak">Blok duraklatıldı: ${mmss(pl)}</a>` : `<a href="#/odak">Odak bloğu sürüyor: ${mmss(left)}</a>`;
    if (c) c.textContent = mmss(left);
    if (pc) pc.textContent = mmss(pl);
    if (p) p.style.width = `${100 * (1 - left / blockTotal(act))}%`;
    document.title = onOdak ? (act.pause ? `${mmss(pl)} · Duraklatıldı` : `${mmss(left)} · Odak`) : "Kendine Gel";
  } else if (br) {
    const left = br.end - Date.now();
    $timerbar.innerHTML = `<a href="#/odak">Mola: ${mmss(left)}</a>`;
    if (c) c.textContent = mmss(left);
    document.title = onOdak ? `${mmss(left)} · Mola` : "Kendine Gel";
  } else document.title = "Kendine Gel";
  if (act) refreshWorkCard();
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
    ${workCard()}
    ${courseCard()}
    <p class="muted small" id="persistNote"></p>
    <h3>Net süre (odak oranıyla)</h3>
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
        <p><b>${esc(intvTitle(e))}</b> → ${esc(e.task)}${e.course && courseLabel(e) !== e.task ? ` <span class="ctag">${esc(courseLabel(e))}</span>` : ""}</p>
        <p class="fb">${e.focusShare != null ? `Odak: ${focusLabel(e.focusShare)} (${focusedMin(e)} dk net)` : `Odak puanlanmadı: ${FOCUS_OPTS.map(([v, l]) => `<button class="chip xs" data-fsid="${e.id}" data-v="${v}">${l}</button>`).join("")}`}${(e.distr || []).length ? ` · ${e.distr.length} dağılma` : ""}</p>
        ${pauseSummary(e.pauses) ? `<p class="fb">Duraklatma: ${pauseSummary(e.pauses)}</p>` : ""}
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
            <label>Ders <select name="course"><option value="">Yok</option>${[...new Set([...courses(), ...(e.course && e.course !== OTHER ? [e.course] : [])])].map(c => `<option ${c === e.course ? "selected" : ""}>${esc(c)}</option>`).join("")}<option value="${OTHER}" ${e.course === OTHER ? "selected" : ""}>Diğer</option></select></label>
            <label>Süre (dk) <input name="min" type="number" min="0" max="${(e.plannedMin || 60) + 5}" value="${e.actualMin}"></label>
            <div class="row tight"><button class="btn">Kaydet</button><button class="btn danger" type="button" data-del="${e.id}">Kaydı sil</button></div>
          </form></details>
      </article>`).join("")}</div>
    <h3>Bilgisayarına kayıt</h3>
    <section class="card" id="fileSync">${fileSyncHTML()}</section>
    <div class="row io">
      <button class="btn" id="exp">Veriyi dışa aktar (JSON)</button>
      <button class="btn" id="impBtn">İçe aktar</button><input type="file" id="imp" accept="application/json,.json" hidden>
      <button class="btn danger" id="wipe">Tüm veriyi sil</button>
    </div>
    <p class="muted small">Veriler yalnızca bu tarayıcıda ve (bağladıysan) seçtiğin dosyada saklanır; hiçbir sunucuya gönderilmez. Cihaz değiştirirken dışa aktar / içe aktar kullan. Yedek dosyası kayma kayıtlarını, notlarını ve tetikleyicileri düz metin olarak içerir: paylaşılan bir bilgisayarda indirme klasöründe bırakma. Bu cihazı başkası da kullanıyorsa işin bitince tarayıcının gizli penceresini tercih et ya da veriyi sil.</p>`;

  // Kalıcı depolama: tarayıcı yer açmak için bu sitenin verisini kendiliğinden silmez (kullanıcı silebilir).
  (async () => {
    const pn = document.getElementById("persistNote"); if (!pn || !navigator.storage?.persist) return;
    let ok = false; try { ok = await navigator.storage.persisted() || await navigator.storage.persist(); } catch {}
    pn.textContent = ok ? "Kayıtlar bu tarayıcıda kalıcı depoda; tarayıcı yer açmak için silmez. Başka cihaza taşımak için dışa aktar."
      : "Kayıtlar bu tarayıcıda. Tarayıcı verisini silersen gider; düzenli dışa aktar.";
  })();
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
      e.actualMin = m; e.task = d.get("task").trim() || e.task;
      const c = d.get("course") || null; if (c !== e.course) { e.course = c; if (c !== OTHER) e.courseOther = ""; } });
    viewGecmis();
  });
  $app.querySelectorAll("[data-del]").forEach(b => b.onclick = () => {
    if (!confirm("Bu kayıt silinecek ve net süreden düşülecek. Emin misin?")) return;
    Store.update(s => s.entries = s.entries.filter(x => x.id !== b.dataset.del)); viewGecmis();
  });
  document.getElementById("exp").onclick = () => { exportData(); };
  document.getElementById("impBtn").onclick = () => document.getElementById("imp").click();
  document.getElementById("wipe").onclick = () => {
    const n = Store.get().entries.length;
    if (!confirm(`Bu tarayıcıdaki ${n} kayıt, ayarlar ve rehber ilerlemesi kalıcı olarak silinecek. Geri alınamaz. Önce dışa aktarmak istersen İptal'e bas.`)) return;
    if (!confirm("Son onay: tüm veriler silinsin mi?")) return;
    Store.replace(Store.parseImport('{"entries":[]}').data);
    location.hash = "#/";
  };
  document.getElementById("imp").onchange = async ev => {
    try {
      const { data, dropped } = Store.parseImport(await ev.target.files[0].text());
      const cur = Store.get().entries.length;
      if (!confirm(`Bu tarayıcıdaki ${cur} kayıt silinip dosyadaki ${data.entries.length} kayıt yüklenecek.${dropped ? ` ${dropped} geçersiz kayıt atlanacak.` : ""} Devam?`)) return;
      Store.replace(data); viewGecmis();
    } catch (err) { alert("İçe aktarılamadı: " + err.message); }
  };
}
// ---------- Dosyaya otomatik kayıt (FileSync) ----------
function fileSyncHTML() {
  const i = FileSync.info();
  const pick = `<div class="row tight"><button class="btn small primary" data-fs-act="createNew">Yeni kayıt dosyası oluştur</button><button class="btn small" data-fs-act="openExisting">Var olan dosyayı aç</button></div>`;
  const time = i.lastWrite ? new Date(i.lastWrite).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
  switch (i.state) {
    case "unsupported":
      return `<p class="muted small">Bu tarayıcı bilgisayardaki bir dosyaya doğrudan yazamıyor (Chrome veya Edge masaüstü gerekir). Aşağıdaki dışa / içe aktarmayı kullan.</p>`;
    case "connected":
      return `<p><b>Dosyaya kaydediliyor:</b> ${esc(i.name)}${time ? ` <span class="muted small">· son kayıt ${time}</span>` : ""}</p>
        <p class="muted small">Her değişiklik birkaç saniye içinde dosyaya yazılır. Gizli sekmede ya da başka tarayıcıda "Var olan dosyayı aç" ile aynı dosyayı seçersen aynı kayıtlarla devam edersin. Aynı dosyayı iki tarayıcıda aynı anda açık tutma.</p>
        <div class="row tight"><button class="btn small" data-fs-act="disconnect">Bağlantıyı kes</button></div>`;
    case "need-permission":
      return `<p><b>${esc(i.name)}</b> dosyasına yazmak için tarayıcı izni gerekiyor. Chrome'da "Her ziyarette izin ver" seçersen bir daha sorulmaz.</p>
        <div class="row tight"><button class="btn small primary" data-fs-act="grant">İzin ver</button><button class="btn small" data-fs-act="disconnect">Bağlantıyı kes</button></div>`;
    case "error":
      return `<p class="note warn">${esc(i.err)}</p>${pick}`;
    default:
      return `<p>Kayıtlar her değişiklikte bilgisayarındaki bir JSON dosyasına yazılsın. Çerez ya da tarayıcı verisi silinse de dosya kalır; gizli sekmede veya başka tarayıcıda aynı dosyayı açarak devam edersin.</p>
        <p class="muted small">Dosyayı OneDrive / Google Drive klasörüne koyarsan diğer bilgisayarlarında da açılır. Dosya kayma kayıtlarını ve notlarını düz metin olarak içerir; herkese açık bir klasöre ya da GitHub'a gönderilen bir klasöre koyma.</p>
        ${pick}`;
  }
}
function fsHomeNote() {
  const i = FileSync.info();
  return i.state === "need-permission" ? `<p class="note">Kayıtların <b>${esc(i.name)}</b> dosyasına yazılmıyor: tarayıcı izni gerekiyor. <button class="link inline" data-fs-act="grant">İzin ver</button></p>`
    : i.state === "error" ? `<p class="note">Kayıt dosyasına yazılamadı. <a href="#/gecmis">Geçmiş → Bilgisayarına kayıt</a></p>` : "";
}
document.addEventListener("click", ev => {
  const b = ev.target.closest("[data-fs-act]");
  if (b && FileSync[b.dataset.fsAct]) FileSync[b.dataset.fsAct]();
});
FileSync.onChange(() => {
  const c = document.getElementById("fileSync"); if (c) c.innerHTML = fileSyncHTML();
  const h = document.getElementById("fsHome"); if (h) h.innerHTML = fsHomeNote();
});
// Dosyadan gelen veri yerel veriyi değiştirdiyse ekranı tazele (yazarken değil).
window.addEventListener("kendinegel:data", () => { backfillCourses(); if (!document.activeElement?.closest("input, textarea, select")) route(); });

function exportData() {
  Store.update(d => d.prefs.lastExport = Date.now());
  const a = document.createElement("a"), url = URL.createObjectURL(new Blob([Store.exportJSON()], { type: "application/json" }));
  a.href = url; a.download = `kendinegel-yedek-${todayKey()}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- Rehber (blog) ----------
// Liste: arama + kategori, "Buradan başla" sırası, "kaldığın yer". Yazı: içindekiler, numaralı atıflar,
// "Ayrıntı", kanıt durumu, "Bu hafta dene", kaynakça, önceki/sonraki ve ilgili yazılar.
// İlerleme: ekranda görülen en ileri bölüm Store.guide[id]'ye yazılır.
const guideUI = { q: "", cat: "" };
let guideCleanup = null;
const catOf = m => byId(GUIDE_CATS, m.cat);
const guideSeen = m => Store.get().guide[m.id] ?? -1;
const guideDone = m => guideSeen(m) + 1 >= m.cards.length;
const readMin = m => Math.max(2, Math.round([m.lede, ...m.cards.flatMap(c => [c.body, c.more || ""])].join(" ").split(/\s+/).length / 170));
const guideStatus = m => guideDone(m) ? `<span class="gstat done">Okundu</span>` : guideSeen(m) >= 0 ? `<span class="gstat">Yarım kaldı</span>` : "";
const doiLink = id => {
  const s = SOURCES[id] || id, i = s.indexOf("https://doi.org/");
  if (i < 0) return esc(s);
  const url = s.slice(i).trim();
  return `${esc(s.slice(0, i))}<a href="${esc(url)}" target="_blank" rel="noopener">${esc(url.replace("https://", ""))}</a>`;
};
const postRow = m => `<a class="post" href="#/rehber/${m.id}">
    <span class="kicker">${esc(catOf(m).title)}</span>
    <h3>${esc(m.title)}</h3><p>${esc(m.lede)}</p>
    <span class="post-meta">${readMin(m)} dk okuma · ${m.cards.length} bölüm ${guideStatus(m)}</span></a>`;
const guideHay = m => [m.title, m.lede, ...m.cards.flatMap(c => [c.h, c.body, c.key || ""])].join(" ").toLocaleLowerCase("tr");

function viewRehber(modId, secIdx) {
  if (!modId) return viewRehberList();
  const m = byId(GUIDE, modId); if (!m) return viewRehberList();
  const idx = GUIDE.indexOf(m), prev = GUIDE[idx - 1], next = GUIDE[idx + 1], cat = catOf(m);
  // Atıf numaraları: yazıdaki ilk geçiş sırasına göre
  const refs = [];
  m.cards.forEach(c => (c.src || []).forEach(s => { if (!refs.includes(s)) refs.push(s); }));
  const cite = c => c.src && c.src.length ? `<span class="cites">${c.src.map(s => { const n = refs.indexOf(s) + 1;
    return `<a href="#" class="cite" data-ref="${n}" aria-label="Kaynak ${n}">${n}</a>`; }).join("")}</span>` : "";
  const related = GUIDE.filter(g => g.cat === m.cat && g !== m);
  const pathPos = GUIDE_PATH.indexOf(m.id);
  $app.innerHTML = `<div class="readbar" aria-hidden="true"><div></div></div>
    <article class="post-full">
      <nav class="crumbs"><a href="#/rehber">Rehber</a> <span aria-hidden="true">›</span> ${esc(cat.title)}</nav>
      <header class="post-head">
        <h1>${esc(m.title)}</h1>
        <p class="lede">${esc(m.lede)}</p>
        <p class="post-meta">${readMin(m)} dk okuma · ${m.cards.length} bölüm · ${refs.length} kaynak${pathPos >= 0 ? ` · Başlangıç yolu ${pathPos + 1}/${GUIDE_PATH.length}` : ""}</p>
      </header>
      ${m.cards.length > 3 ? `<details class="toc" open><summary>İçindekiler</summary><ol>${m.cards.map((c, i) =>
        `<li><a href="#" data-sec="${i}">${esc(c.h)}</a></li>`).join("")}</ol></details>` : ""}
      ${m.cards.map((c, i) => `<section class="psec" id="sec-${i}" data-i="${i}">
        <h2><span class="secnum">${i + 1}</span>${esc(c.h)}</h2>
        <p>${esc(c.body)}${cite(c)}</p>
        ${c.more ? `<details class="more"><summary>Ayrıntı</summary><p>${esc(c.more)}</p></details>` : ""}
        ${c.key ? `<p class="key">${esc(c.key)}</p>` : ""}
      </section>`).join("")}
      ${m.sure ? `<aside class="sure"><h2>Ne kadar emin olabiliriz?</h2><p>${esc(m.sure)}</p></aside>` : ""}
      ${m.try && m.try.length ? `<aside class="try"><h2>Bu hafta dene</h2><ul>${m.try.map(t =>
        `<li>${esc(t.t)}${t.href ? ` <a href="${t.href}">Aç →</a>` : ""}</li>`).join("")}</ul></aside>` : ""}
      ${refs.length ? `<section class="refs" id="refs"><h2>Kaynaklar</h2><ol>${refs.map((s, i) => `<li id="ref-${i + 1}">${doiLink(s)}</li>`).join("")}</ol></section>` : ""}
      <div id="postEnd"></div>
      <nav class="post-nav">
        ${prev ? `<a class="post-nav-a" href="#/rehber/${prev.id}"><span>← Önceki</span>${esc(prev.title)}</a>` : "<span></span>"}
        ${next ? `<a class="post-nav-a next" href="#/rehber/${next.id}"><span>Sonraki →</span>${esc(next.title)}</a>` : `<a class="post-nav-a next" href="#/rehber"><span>Bitti</span>Tüm yazılar</a>`}
      </nav>
      ${related.length ? `<section class="related"><h2>${esc(cat.title)} başlığında diğer yazılar</h2><div class="posts">${related.map(postRow).join("")}</div></section>` : ""}
    </article>`;

  const secs = [...$app.querySelectorAll(".psec")];
  const mark = i => { if (guideSeen(m) < i) Store.update(d => d.guide[m.id] = Math.max(d.guide[m.id] ?? -1, i)); };
  $app.querySelectorAll("[data-sec]").forEach(a => a.onclick = e => { e.preventDefault(); secs[+a.dataset.sec].scrollIntoView({ behavior: "smooth" }); });
  $app.querySelectorAll(".cite").forEach(a => a.onclick = e => {
    e.preventDefault();
    const li = document.getElementById("ref-" + a.dataset.ref); if (!li) return;
    li.scrollIntoView({ behavior: "smooth", block: "center" }); li.classList.remove("flash"); void li.offsetWidth; li.classList.add("flash");
  });
  // Okunan bölüm: bölüm ekranın üst yarısına girince sayılır; yazı sonu görülünce tamamı.
  let io = null;
  if ("IntersectionObserver" in window) {
    io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      if (e.target.id === "postEnd") mark(m.cards.length - 1); else mark(+e.target.dataset.i);
    }), { rootMargin: "0px 0px -50% 0px" });
    secs.forEach(s => io.observe(s)); io.observe(document.getElementById("postEnd"));
  } else mark(m.cards.length - 1);
  const bar = $app.querySelector(".readbar > div");
  const onScroll = () => {
    const el = $app.querySelector(".post-full"); if (!el || !bar) return;
    const r = el.getBoundingClientRect(), total = r.height - innerHeight;
    bar.style.width = `${Math.min(100, Math.max(0, total > 0 ? -r.top / total * 100 : 100))}%`;
  };
  addEventListener("scroll", onScroll, { passive: true }); onScroll();
  guideCleanup = () => { removeEventListener("scroll", onScroll); io?.disconnect(); };
  const target = secs[+secIdx];
  if (target) setTimeout(() => target.scrollIntoView(), 0);
}

function viewRehberList() {
  const inProgress = GUIDE.filter(m => guideSeen(m) >= 0 && !guideDone(m));
  const doneN = GUIDE.filter(guideDone).length;
  $app.innerHTML = `<header class="blog-head">
      <h1>Rehber</h1>
      <p class="lede">Odak, ödül sistemi, uyku ve alışkanlıklar üzerine kısa, kaynaklı yazılar. Her bölüm tek bir fikir ve bir özet cümlesiyle biter; her iddianın kaynağı ve kanıt durumu yazının içinde.</p>
      <p class="post-meta">${GUIDE.length} yazı · ${doneN} okundu</p>
    </header>
    <div class="gfilter">
      <input type="search" id="gq" placeholder="Yazılarda ara: uyku, bildirim, erteleme…" aria-label="Rehberde ara" value="${esc(guideUI.q)}">
      <div class="chips" role="group" aria-label="Kategori">
        <button type="button" class="chip${guideUI.cat ? "" : " on"}" data-cat="">Tümü</button>
        ${GUIDE_CATS.map(c => `<button type="button" class="chip${guideUI.cat === c.id ? " on" : ""}" data-cat="${c.id}">${esc(c.title)}</button>`).join("")}
      </div>
    </div>
    <div id="glist"></div>`;
  const drawList = () => {
    const q = guideUI.q.trim().toLocaleLowerCase("tr"), cat = guideUI.cat;
    const list = $app.querySelector("#glist");
    $app.querySelectorAll("[data-cat]").forEach(b => { b.classList.toggle("on", b.dataset.cat === cat); b.setAttribute("aria-pressed", b.dataset.cat === cat); });
    if (q) {
      const hits = GUIDE.filter(m => (!cat || m.cat === cat) && guideHay(m).includes(q));
      list.innerHTML = hits.length ? `<p class="muted small">${hits.length} yazı bulundu.</p><div class="posts">${hits.map(postRow).join("")}</div>`
        : `<p class="muted">"${esc(guideUI.q)}" için sonuç yok. Daha kısa bir kelime dene.</p>`;
      return;
    }
    const cats = cat ? GUIDE_CATS.filter(c => c.id === cat) : GUIDE_CATS;
    list.innerHTML = `${!cat && inProgress.length ? `<section class="gsec"><h2>Kaldığın yer</h2><div class="posts">${inProgress.slice(0, 2).map(postRow).join("")}</div></section>` : ""}
      ${!cat ? `<section class="gsec path"><h2>Buradan başla</h2><p class="muted small">Yeni başlıyorsan bu dört yazı sitenin temel fikrini sırayla anlatır.</p>
        <ol class="pathlist">${GUIDE_PATH.map(id => byId(GUIDE, id)).map(m => `<li class="${guideDone(m) ? "done" : ""}"><a href="#/rehber/${m.id}"><b>${esc(m.title)}</b><span>${readMin(m)} dk${guideDone(m) ? " · okundu" : ""}</span></a></li>`).join("")}</ol></section>` : ""}
      ${cats.map(c => `<section class="gsec"><h2>${esc(c.title)}</h2><p class="muted small">${esc(c.desc)}</p>
        <div class="posts">${GUIDE.filter(m => m.cat === c.id).map(postRow).join("")}</div></section>`).join("")}`;
  };
  const inp = $app.querySelector("#gq");
  inp.oninput = () => { guideUI.q = inp.value; drawList(); };
  $app.querySelectorAll("[data-cat]").forEach(b => b.onclick = () => { guideUI.cat = b.dataset.cat; drawList(); });
  drawList();
}

// ---------- Yönlendirici ----------
function route() {
  const [, page, sub, sub2] = location.hash.split("/");
  if (guideCleanup) { guideCleanup(); guideCleanup = null; }
  document.querySelectorAll("[data-nav]").forEach(a => a.classList.toggle("on", a.dataset.nav === page));
  if (page !== "acil") resetFlow();
  document.body.classList.toggle("focusing", page === "odak" && !!Store.get().active);
  ({ acil: viewAcil, blok: viewBlok, odak: viewOdak, hazirlik: viewHazirlik, gecmis: viewGecmis, program: viewProgram, rehber: () => viewRehber(sub, sub2) }[page] || viewHome)();
  if (!(page === "rehber" && sub2)) window.scrollTo(0, 0);
  tick(); syncWakeLock();
}
// Başka sekmede veri değişirse bu sekmeyi tazele (yazarken değil).
window.addEventListener("storage", e => {
  if (e.key !== Store.KEY) return;
  Store.reload();
  if (!document.activeElement?.closest("input, textarea, select")) route();
});
if ("scrollRestoration" in history) history.scrollRestoration = "manual"; // kaydırmayı yönlendirici yönetir
window.addEventListener("hashchange", route);
setInterval(tick, 1000);
backfillCourses();
route();
FileSync.init();
