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
- Geri bildirim protokolden hemen sonra sorulmaz; kullanıcı sonra Geçmiş sekmesinden verir.
- GitHub Pages: statik, build adımı yok, framework yok. Veri localStorage'da (`kendinegel.v1`), JSON dışa/içe aktarma var.

## Yapı
- `index.html`: iskelet. `css/style.css`: tokenlar `:root` altında, koyu mod desteği var.
- `js/data.js`: EVIDENCE, ENVS, LEVELS (1–4), SOURCES, INTERVENTIONS, PREP (hazırlık listesi), LEVEL4_NOTE.
- `js/guide.js`: GUIDE modülleri ve kartları.
- `js/store.js`: localStorage sarmalayıcısı.
- `js/app.js`: hash router (`#/`, `#/acil`, `#/blok`, `#/odak`, `#/hazirlik`, `#/rehber[/id]`, `#/gecmis`), akış, zamanlayıcı, mola, geçmiş, grafikler.
- `sw.js` + `manifest.webmanifest` + `icon.svg`: PWA (ağ öncelikli önbellek, ana ekrana ekleme). Yeni dosya eklenirse `sw.js` içindeki FILES listesine de ekle.
- Net süre = zamanlayıcıyla geçen blokların `actualMin` toplamı. Günlük hedef `prefs.goalMin` (varsayılan 120). Ana sayfada bugünün ilerlemesi; Geçmiş'te 14 günlük çubuk grafik + hedef çizgisi ve kriz saatleri grafiği (saf CSS).
- Doğrudan blok (`#/blok`, "Odağım yerinde"): `level: 0`, `intv: null`. Net süreye sayılır; kişisel protokol istatistiğine, seviye önerisine ve geri bildirim formuna girmez.
- Blok bitince `viewBitti`: 5/10 dk mola (`break`), "aynı görevle devam". Bitişte ses + tarayıcı bildirimi (izin ilk blokta istenir).
- Hazırlık (`prep`): günlük kontrol listesi, tarih değişince sıfırlanır.
- Mobil test: headless Chrome pencereyi en az 500px açar; 360px için sayfayı iframe içinde render et.
- Acil akış: seviye → ortam → müdahale (seviye + ortam filtresi) → başlangıç görevi + eğer–o zaman planı + süre → zamanlayıcı.
- Seviye önerisi: bugün son 4 saatte kayıt varsa ve günün 2. kaydı ya da sonrası ise bir üst seviye önerilir.
- Kayıtlar başlangıçta oluşturulur; `endTs` bitişte dolar.
- Kişisel öğrenme (`interventionStats`, `verdict`, `rankInterventions`, `bestFor` in app.js): geri bildirim puanı evet=1, kısmen=0.5, hayır=0. En az 2 denemede hüküm verilir (iyi ≥%70, zayıf ≤%30). Acil listede sıra: kişisel sonuç → kanıt seviyesi. Seviye kartında "Sende en iyisi", Geçmiş'te seviye bazlı "Kişisel protokolün" tablosu gösterilir.

## Kaynak notları
- Gemini araştırma PDF'i (dopamin, kısa video, porno, UPF) kullanıldı ama abartıları düzeltildi: kesitsel çalışmalar "kanıtladı" diye yazılmaz. Reddit, blog ve kitap özeti siteleri kaynak olarak alınmaz. Kaelberer 2018'in başlığı PDF'te yanlıştı.
- Doğrulanacak: `yan2024` (P300) künyesi eksik (dergi/sayfa); PDF'teki PMC10971362 numarasıyla kontrol edilmeli.

## Yol haritası
- [x] v0.2: kişisel protokol (geri bildirime göre sıralama), 4 yeni rehber modülü (ödül, kısa video, porno, gıda)
- [x] v0.1 MVP: acil akış, 16 müdahale, 6 rehber modülü, zamanlayıcı, geçmiş + geri bildirim, JSON yedek
- [x] GitHub repo + Pages yayını (EFEKOCAL/kendine_gel)
- [ ] Kaynak doğrulama turu: künyeleri tek tek kontrol et, DOI ekle
- [x] v0.3: net süre + günlük hedef, doğrudan blok, mola akışı, Hazırlık listesi, grafikler (14 gün, kriz saatleri), PWA, bildirim, uyku modülü, "zihni boşalt" müdahalesi
- [ ] İçerik: "dopamin orucu" mitleri, video oyunları modülü
- [ ] Haftalık / aylık özet (hafta karşılaştırması, en verimli saatler)
- [ ] Spor takibi sekmesi
- [ ] Kaydı silme / düzenleme
