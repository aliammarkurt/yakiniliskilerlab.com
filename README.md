# Yakın İlişkiler Araştırma Laboratuvarı — Web Sitesi

Close Relationships Research Lab · Mersin Üniversitesi

## Dosya yapısı

```
index.html     Ana sayfa
hakkimizda.html  Hakkımızda sayfası (yakiniliskilerlab.com/hakkimizda)
site.css       Ortak stil: renk paleti, açık/koyu tema, dil görünürlüğü
site.js        Ortak davranış: TR/EN geçişi, tema düğmesi
logo-*.png     Tam logo (açık ve koyu tema sürümleri)
mark-*.png     Yalnızca sembol (üst bar için)
favicon.png, apple-touch-icon.png
```

## Çift dil nasıl çalışır?

Her metin iki kez yazılır; sayfanın diline göre biri gizlenir:

```html
<span data-l="tr">Hakkımızda</span>
<span data-l="en">About us</span>
```

Sekme başlığı ve açıklama `<html>` etiketindeki `data-title-tr/en` ve
`data-desc-tr/en` alanlarından gelir. Dil seçimi tarayıcıda hatırlanır;
`?lang=en` eklenerek bağlantı doğrudan İngilizce açılabilir.

## Tema

Varsayılan olarak cihazın açık/koyu ayarını izler; sağ üstteki düğme ile
değiştirilir ve seçim hatırlanır.

## Renkler

| Ad | Açık tema | Koyu tema |
|---|---|---|
| Koyu yeşil (logo) | `#1f4e4a` | `#f2ebe1` (yazı/logo) |
| Turuncu (logo) | `#c1663f` | `#d97a52` |
| Zemin | `#f7f2ea` | `#132523` |

## Yeni sayfa eklemek

`index.html` dosyasını kopyalayıp yeniden adlandırın (ör. `hakkimizda.html`),
`<main>` içeriğini değiştirin. Üst bar, alt bilgi, dil ve tema kendiliğinden çalışır.
Yeni sayfayı tüm sayfalardaki `<nav class="site-nav">` menüsüne ekleyin; bulunulan sayfanın
bağlantısına `aria-current="page"` verin.

## Alan adı

`CNAME` dosyası sitenin `yakiniliskilerlab.com` adresinde yayınlanmasını sağlar; silinmemeli.

## Ziyaret istatistikleri

Cloudflare Web Analytics kullanılıyor (çerez kullanmaz). Panel: Cloudflare → Analytics & Logs → Web Analytics.
Her yeni sayfanın `<head>` bölümüne şu satır eklenmeli:

```html
<script type="module" src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "48c4dcce47294892a5597a2c69c73c7a"}'></script>
```
