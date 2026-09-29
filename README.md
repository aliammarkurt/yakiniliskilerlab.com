# Yakın İlişkiler Araştırma Laboratuvarı — Web Sitesi

Close Relationships Research Lab · Mersin Üniversitesi

## Dosya yapısı

```
index.html            Ana sayfa ("Çok yakında")
assets/site.css       Ortak stil: renk paleti, açık/koyu tema, dil görünürlüğü
assets/site.js        Ortak davranış: TR/EN geçişi, tema düğmesi
assets/logo-*.png     Tam logo (açık ve koyu tema sürümleri)
assets/mark-*.png     Yalnızca sembol (üst bar için)
assets/favicon.png, assets/apple-touch-icon.png
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

## Alan adı

`CNAME` dosyası sitenin `yakiniliskilerlab.com` adresinde yayınlanmasını sağlar; silinmemeli.

## Ziyaret istatistikleri

GoatCounter kullanılıyor (çerez kullanmaz). Panel: https://yakiniliskilerlab.goatcounter.com
Her yeni sayfanın `<head>` bölümüne şu satır eklenmeli:

```html
<script data-goatcounter="https://yakiniliskilerlab.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>
```
