# Kendine Gel

**Canlı site: [efekocal.github.io/kendine_gel](https://efekocal.github.io/kendine_gel/)**

Odak kaydığında, bulunduğun duruma (Seviye 1–4) ve ortama (ev, yurt, okul, kütüphane) göre kaynaklı bir müdahale önerir. Seçtiğin müdahaleden sonra küçük bir başlangıç göreviyle bir odak bloğu başlatırsın. Blok sonunda bloğun ne kadarının gerçekten odaklı geçtiğini işaretlersin; net süre buna göre hesaplanır. Blok sırasında dikkatin dağıldığında tek dokunuşla neyin çektiğini kaydedebilirsin.

Geçmiş sekmesi günlük ve haftalık net süreyi, en verimli saatlerini, odağın kaydığı saatleri, dağılma nedenlerini ve hangi müdahalenin sende işe yaradığını gösterir. Rehber bölümü dikkat, ödül sistemi, evrimsel uyumsuzluk, kısa video, porno, oyun, gıda, uyku ve başlama üzerine kısa kartlardan oluşur; her iddia kanıt seviyesi ve DOI'li kaynakla verilir. Hazırlık listesi, oturmadan önce dikkat dağıtıcıları kaldırmak içindir.

Bu site tıbbi veya psikolojik tavsiye yerine geçmez. Rehber'deki "Alışkanlık mı, belirti mi?" bölümü, odak sorununun bir sağlık durumunun belirtisi olabileceği durumları ve başvuru yerlerini anlatır.

Telefonda tarayıcı menüsünden "Ana ekrana ekle" ile uygulama gibi kullanılabilir; çevrimdışı da açılır.

Statik site: build adımı yok. Veriler yalnızca tarayıcıda (localStorage) saklanır.

## Yerelde çalıştırma
`index.html` dosyasını tarayıcıda açman yeterli.

## GitHub Pages
1. GitHub'da yeni bir repo aç (ör. `kendine_gel`) ve dosyaları push'la.
2. Settings → Pages → Source: `GitHub Actions`. `.github/workflows/deploy.yml` her `main` push'unda siteyi yayınlar.
3. Site `https://<kullanıcı>.github.io/kendine_gel/` adresinde yayına girer (bu repo için: https://efekocal.github.io/kendine_gel/).
