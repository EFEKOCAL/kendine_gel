# Kendine Gel

**Canlı site: [efekocal.github.io/kendine_gel](https://efekocal.github.io/kendine_gel/)**

Odak kaydığında, bulunduğun duruma (Seviye 1–4) ve ortama (ev, yurt, okul, kütüphane) göre bir müdahale önerir. Seçtiğin müdahaleden sonra küçük bir başlangıç göreviyle bir odak bloğu başlatırsın. Geçmiş sekmesinden geri bildirim verirsin ve hangi müdahalenin sende işe yaradığını görürsün. Rehber bölümü konuyu kısa kartlarla anlatır. Hazırlık listesi, oturmadan önce dikkat dağıtıcıları kaldırmak içindir. Geçmiş sekmesi günlük net çalışma süresini, kriz saatlerini ve kişisel protokolü gösterir.

Telefonda tarayıcı menüsünden "Ana ekrana ekle" ile uygulama gibi kullanılabilir; çevrimdışı da açılır.

Statik site: build adımı yok. Veriler yalnızca tarayıcıda (localStorage) saklanır.

## Yerelde çalıştırma
`index.html` dosyasını tarayıcıda açman yeterli.

## GitHub Pages
1. GitHub'da yeni bir repo aç (ör. `kendine_gel`) ve dosyaları push'la.
2. Settings → Pages → Source: `GitHub Actions`. `.github/workflows/deploy.yml` her `main` push'unda siteyi yayınlar.
3. Site `https://<kullanıcı>.github.io/kendine_gel/` adresinde yayına girer (bu repo için: https://efekocal.github.io/kendine_gel/).
