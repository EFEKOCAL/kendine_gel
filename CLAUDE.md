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
- `js/data.js`: EVIDENCE, ENVS, LEVELS (1–4), SOURCES, INTERVENTIONS, LEVEL4_NOTE.
- `js/guide.js`: GUIDE modülleri ve kartları.
- `js/store.js`: localStorage sarmalayıcısı.
- `js/app.js`: hash router (`#/`, `#/acil`, `#/odak`, `#/rehber[/id]`, `#/gecmis`), akış, zamanlayıcı, geçmiş.
- Acil akış: seviye → ortam → müdahale (seviye + ortam filtresi) → başlangıç görevi + eğer–o zaman planı + süre → zamanlayıcı.
- Seviye önerisi: bugün son 4 saatte kayıt varsa ve günün 2. kaydı ya da sonrası ise bir üst seviye önerilir.
- Kayıtlar başlangıçta oluşturulur; `endTs` bitişte dolar.

## Yol haritası
- [x] v0.1 MVP: acil akış, 16 müdahale, 6 rehber modülü, zamanlayıcı, geçmiş + geri bildirim, JSON yedek
- [ ] GitHub repo + Pages yayını
- [ ] Kaynak doğrulama turu: künyeleri tek tek kontrol et, DOI ekle
- [ ] İçerik: uyku, beslenme / işlenmiş gıda, kısa video ve porno özelinde modüller, "dopamin orucu" mitleri
- [ ] Geçmişte grafikler (odak süresi trendi), seviye ve saat dağılımı
- [ ] Spor takibi sekmesi
- [ ] PWA: offline kullanım, ana ekrana ekleme, bildirim
- [ ] Önleyici mod: güne başlarken plan, sürtünme kontrol listesi
