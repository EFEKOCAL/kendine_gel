# Kendine Gel — proje notları (Claude için)

Yüksek dopaminli alışkanlıkları (kısa video, oyun, porno, işlenmiş gıda) olan ve ders / kitap / spor gibi düşük uyarımlı işleri hayatına entegre etmek isteyen kişiler için odak müdahale sitesi. Sahibi bir bilgisayar mühendisliği öğrencisi; siteyi kendisi kullanıyor ama genel kullanıma uygun olmalı. Kod tamamen Claude'a ait; proje seans seans geliştiriliyor.

## Ana hedef
Günlük, haftalık ve aylık **net çalışma süresini** (gerçekten odaklı geçen süre) en yükseğe çıkarmak. Kaynağın başında odaksız oturmak çalışma sayılmaz. İki kol var:
1. **Müdahale:** Odak kaydığında seviyeye göre toparlama.
2. **Önleme ve bilinçlenme:** Kişinin kendini tanıması, dikkat dağıtıcılardan baştan uzaklaşması, bedeni ve zihni odağa önceden hazırlaması. Rehber ve geçmiş verisi bu kolu besler.

## Kurallar
- Dil: Türkçe. Yaygın kavramlar parantez içinde İngilizce, örn. "sürtünme (friction)".
- Ton: düz bilgi aktarımı. Tatlılık, motivasyon cümlesi, emoji, askerî/"reboot" jargonu yok.
- Öneriler yapay zekâ tarafından üretilmez; elle yazılmış, kaynaklı kurallardır. Her müdahalede `ev` (guclu/orta/zayif) ve `src` (SOURCES anahtarları) zorunlu. Popüler abartıları (ör. "soğuk duş dopamini %250 artırır") düzelterek yaz.
- Rehber: düz metin yok. Kart başına tek fikir, 2–4 cümle, bir `key` özet cümlesi.
- Müdahale geri bildirimi ("işe yaradı mı?") protokolden hemen sonra sorulmaz; kullanıcı sonra Geçmiş sekmesinden verir. Blok sonundaki odak oranı sorusu bundan farklıdır (müdahaleyi değil bloğun çıktısını ölçer), tek dokunuş ve isteğe bağlıdır.
- Dil: "kriz" değil "kayma". Seri (streak), puan, rozet gibi oyunlaştırma yok; başarısızlık rengi yok.
- Sağlık belirtisi olabilecek durumlarda tanı dili kullanılmaz: yalnızca "olabilir" + yönlendirme (Rehber → `belirti` modülü, 112, YEDAM 115, üniversite PDR).
- İçerik değişikliklerinde uzman bakışı: klinik psikolog, psikiyatrist, nörobilim/evrimsel psikoloji, davranış tasarımı/UX ve kaynak doğrulama. Evrimsel açıklamalar çoğu zaman hipotezdir; öyle yazılır.
- GitHub Pages: statik, build adımı yok, framework yok. Veri localStorage'da (`kendinegel.v1`), JSON dışa/içe aktarma var.

## Yapı
- `index.html`: iskelet. `css/style.css`: tokenlar `:root` altında, koyu mod desteği var.
- `js/data.js`: EVIDENCE, ENVS, LEVELS (1–4), SOURCES (DOI'li), INTERVENTIONS (`pin: true` = kişisel veri yokken üstte), TRIGGERS (kayma öncesi his), PREP, LEVEL4_NOTE, LAPSE_NOTE, HELP_NOTE.
- `js/guide.js`: GUIDE modülleri ve kartları.
- `js/store.js`: localStorage sarmalayıcısı. Şema sürümü `v` + `migrate()`; yeni alan eklenince migrate'e varsayılan ekle. `update()` her yazmada yeniden okur (çoklu sekme). İçe aktarma doğrular, onay ister, `active`/`break` almaz.
- `js/app.js`: hash router (`#/`, `#/acil`, `#/blok`, `#/odak`, `#/hazirlik`, `#/rehber[/id]`, `#/gecmis`), akış, zamanlayıcı, mola, geçmiş, grafikler.
- `sw.js` + `manifest.webmanifest` + `icon.svg`: PWA (ağ öncelikli önbellek, ana ekrana ekleme). Yeni dosya eklenirse `sw.js` içindeki FILES listesine de ekle.
- Net süre = Σ `actualMin × (focusShare ?? 1)` (`focusedMin`). `focusShare` blok sonunda tek dokunuşla sorulur (1 / 0.75 / 0.5 / 0.25 / 0); puanlanmamış blok tam sayılır, Geçmiş'ten sonradan puanlanabilir. Günlük hedef `prefs.goalMin` (ilk girişte seçilir). Geçmiş: 14 gün grafiği, Haftalar tablosu (8 hafta), en verimli 2 saat, dağılma nedenleri, kayma saatleri, tetikleyiciler, kişisel protokol, kayıt düzenle/sil.
- Blok sırasında "Dikkatim dağıldı": `entry.distr = [{t, k}]` (k: telefon/dusunce/cevre/beden/diger); sayaç gösterilmez. Odak ekranında üst menü gizli (`body.focusing`), Screen Wake Lock isteğe bağlı.
- Ana sayfa: ilk girişte tanıtım kartı (`prefs.introSeen`), 18:00 sonrası "Yarının ilk bloğu" planı (`tomorrow`), hafta başında "Geçen hafta" özeti + "tek değişiklik" (`weekly`), kayma saatine yakınsa Hazırlık uyarısı, 14 günden eski yedek uyarısı.
- Doğrudan blok (`#/blok`, "Odağım yerinde"): `level: 0`, `intv: null`. Net süreye sayılır; kişisel protokol istatistiğine, seviye önerisine ve geri bildirim formuna girmez.
- Blok bitince `viewBitti`: odak oranı, "kaldığın yer / sıradaki ilk adım" (`entry.next`, sonraki görevi doldurur), 5/10 dk mola, devam. Bildirim service worker üzerinden (`showNotification`, Android için şart); izin ilk blok sonunda açıklamayla istenir. Ses tek AudioContext ile, kullanıcı dokunuşunda açılır. 1 dk'dan kısa blok iptal edilince kayıt tutulmaz.
- Hazırlık (`prep`): günlük kontrol listesi, tarih değişince sıfırlanır.
- Mobil test: headless Chrome pencereyi en az 500px açar; 360px için sayfayı iframe içinde render et.
- Protokol akışı (`#/acil`, menüde "Protokol"): seviye → (ortam kayıtlıysa atlanır) → ilk 3 müdahale + "Diğer seçenekler" → başlangıç görevi + engel/eğer–o zaman planı + süre + isteğe bağlı tetikleyici his → zamanlayıcı. Seviye kartındaki "Sende en iyisi" doğrudan başlangıç adımına atlar. Seviye 3'te varsayılan blok 10 dk ve LAPSE_NOTE.
- Seviyeler şiddet merdiveni değil: 2 düşük, 4 yüksek uyarılmışlık. Seviye önerisi: son 4 saatte kayma varsa aynı seviye; önceki müdahale işe yaramadıysa (hayır / odak ≤0.25 / blok yarıdan önce bitti) bir üst seviye; Seviye 4 otomatik önerilmez.
- Son 14 günde ≥3 Seviye 4 ya da ≥6 Seviye 3+ kayıt varsa Geçmiş'te "belirti" yönlendirmesi çıkar.
- Kayıtlar başlangıçta oluşturulur; `endTs` bitişte dolar.
- Kişisel öğrenme (`interventionStats`, `verdict`, `rankInterventions`, `bestFor` in app.js): geri bildirim puanı evet=1, kısmen=0.5, hayır=0. En az 2 denemede hüküm verilir (iyi ≥%70, zayıf ≤%30). Acil listede sıra: kişisel sonuç → kanıt seviyesi. Seviye kartında "Sende en iyisi", Geçmiş'te seviye bazlı "Kişisel protokolün" tablosu gösterilir.

## Kaynak notları
- Gemini araştırma PDF'i (dopamin, kısa video, porno, UPF) kullanıldı ama abartıları düzeltildi: kesitsel çalışmalar "kanıtladı" diye yazılmaz. Reddit, blog ve kitap özeti siteleri kaynak olarak alınmaz. Kaelberer 2018'in başlığı PDF'te yanlıştı.
- Kaynak doğrulama turu yapıldı (Kasım 2026, Crossref / Europe PMC): tüm künyelere DOI eklendi. `yan2024` aslında Walla & Zheng 2024 (Life 14(3):290) idi → `walla2024`. Brain drain (Ward 2017) ön kayıtlı tekrarında bulunamadı; meta-analizde yalnız küçük etki (Parry 2024).
- YEDAM 115 bilgisi Yeşilay bültenlerinden; yayından önce yedam.org.tr'den tekrar kontrol et. Türkçe ASRS geçerlik künyesi (Doğan ve ark. 2009) doğrulanmadığı için eklenmedi.

## Yol haritası
- [x] v0.2: kişisel protokol (geri bildirime göre sıralama), 4 yeni rehber modülü (ödül, kısa video, porno, gıda)
- [x] v0.1 MVP: acil akış, 16 müdahale, 6 rehber modülü, zamanlayıcı, geçmiş + geri bildirim, JSON yedek
- [x] GitHub repo + Pages yayını (EFEKOCAL/kendine_gel)
- [x] Kaynak doğrulama turu: künyeler kontrol edildi, DOI eklendi
- [x] v0.4 (uzman grubu incelemesi): odak oranlı net süre, dağılma kaydı, kısaltılmış protokol akışı, kayma sonrası akış (affet, LAPSE_NOTE), dürtü izleme, tetikleyici kaydı, haftalık özet + haftalar tablosu, yarının ilk bloğu, tanıtım kartı, kayıt düzenle/sil, güvenli içe aktarma, SW bildirimleri + wake lock, kontrast/koyu mod/erişilebilirlik, 5 yeni rehber modülü (kayma, evrim, oyun, dopamin orucu, belirti), uyku modülüne CBT-I kartları, güvenlik yönlendirmeleri
- [x] v0.3: net süre + günlük hedef, doğrudan blok, mola akışı, Hazırlık listesi, grafikler (14 gün, kriz saatleri), PWA, bildirim, uyku modülü, "zihni boşalt" müdahalesi
- [ ] Aylık özet; isteğe bağlı blok içi zihin gezinmesi yoklaması (thought probe, Szpunar 2013)
- [ ] Blok sonu "aklında kalan 3 şey" kısa test alanı (rehberde kartı var)
- [ ] Tetikleyiciye göre müdahale önerisi (belirsizlik → zihni boşalt, kaygı → nefes)
- [ ] Spor takibi sekmesi
