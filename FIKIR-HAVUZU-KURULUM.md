# Fikir Havuzu — Kurulum Rehberi

Fikir Havuzu (`yakiniliskilerlab.com/fikir-havuzu`), ekip üyelerinin giriş yapıp fikir paylaştığı,
tüm fikirleri ve yorumları birlikte gördüğü, akademisyenlerin fikirlere akademik değerlendirme eklediği
korumalı bir sayfadır. Site GitHub Pages'te statik olarak yayınlandığı için giriş ve veri saklama
**Firebase** (Google) üzerinden yapılır. Ücretsiz (Spark) plan bu ekip için fazlasıyla yeterlidir.

Kurulum bir kez yapılır ve yaklaşık 15 dakika sürer. Laboratuvarın Google hesabıyla yapılması önerilir.

## 1. Firebase projesi oluşturun

1. <https://console.firebase.google.com> adresine laboratuvarın Google hesabıyla girin.
2. **Proje ekle** → ad: `yakiniliskilerlab` → Google Analytics'i kapatabilirsiniz → **Proje oluştur**.

## 2. Web uygulamasını ekleyin ve ayarları siteye yazın

1. Proje ana sayfasında **</>** (Web) simgesine tıklayın. Uygulama adı: `Fikir Havuzu`.
   "Firebase Hosting" kutusunu işaretlemeyin (site GitHub Pages'te kalıyor).
2. Ekranda çıkan `firebaseConfig` değerlerini (`apiKey`, `authDomain`, `projectId` …) depodaki
   **`firebase-config.js`** dosyasındaki `BURAYA_…` yazan yerlere kopyalayın.
   Bu değerler gizli değildir; verileri güvenlik kuralları korur.

## 3. Girişi açın

**Authentication → Başlayın → Sign-in method** sekmesinde:

1. **E-posta/Şifre**'yi etkinleştirin. ("E-posta bağlantısı (şifresiz giriş)" seçeneğini açmayın:
   ücretsiz planda günde yalnızca 5 e-postayla sınırlıdır.)
2. **Google**'ı etkinleştirin; destek e-postası olarak laboratuvar adresini seçin.
3. **Settings → Authorized domains** listesine `yakiniliskilerlab.com` ekleyin
   (site `www.` ile de açılıyorsa onu da ekleyin).
4. **Templates** sekmesinde şablon dilini **Türkçe** yapın ve gönderen adını
   `Yakın İlişkiler Araştırma Laboratuvarı` olarak değiştirin. Doğrulama ve şifre yenileme e-postaları bu adla gider.

## 4. Veritabanını oluşturun

1. **Firestore Database → Create database** → konum olarak Avrupa'yı seçin (ör. `eur3` ya da `europe-west1`)
   → **Production mode** ile başlatın.
2. **Rules** sekmesine depodaki **`firestore.rules`** dosyasının tamamını yapıştırın → **Publish**.

## 5. İlk akademisyeni ekleyin

Üye listesini site üzerinden akademisyenler yönetir; ancak ilk akademisyen konsoldan eklenmelidir.

1. **Firestore Database → Data → Start collection** → koleksiyon kimliği: `members`
2. Belge kimliği (Document ID): **küçük harflerle** e-posta adresiniz, ör. `aliammarkurt@mersin.edu.tr`
3. Alanlar:
   - `name` (string): `Ali Ammar Kurt`
   - `role` (string): `academic`
4. Kaydedin.

## 6. Sitede ilk giriş ve ekibin eklenmesi

1. Bu dal yayına alındıktan sonra `yakiniliskilerlab.com/fikir-havuzu` adresine gidin.
2. **Hesap oluştur** sekmesinden 5. adımdaki e-posta adresiyle bir şifre belirleyin
   (ya da adres bir Google hesabıysa **Google ile devam et**'e basın) ve gelen e-postadaki bağlantıyla adresi doğrulayın.
3. Girişten sonra **Üyeler** sekmesinden direktör yardımcılarını (rol: Akademisyen) ve araştırmacıları
   (rol: Araştırmacı) e-posta adresleriyle ekleyin. Araştırmacıların laboratuvara bildirdiği adresleri kullanın.

## Araştırmacılara gönderilecek kısa not

> Fikir Havuzu açıldı: **yakiniliskilerlab.com/fikir-havuzu**
> İlk girişte **Hesap oluştur** sekmesinden laboratuvara bildirdiğin e-posta adresiyle bir şifre belirle
> ve e-postana gelen doğrulama bağlantısına tıkla. Gmail adresin kayıtlıysa doğrudan **Google ile devam et**
> diyebilirsin. Merak ettiğin her şeyi kendi cümlelerinle yazabilirsin; kuram, yöntem ya da analiz bilmen gerekmiyor.

## Nasıl çalışır?

| Kim | Ne yapabilir |
|---|---|
| Araştırmacı | Fikir paylaşır, kendi fikrini düzenler, tüm fikirleri ve değerlendirmeleri okur, yorum yazar, kendi yorumunu siler, değerlendirilmemiş kendi fikrini silebilir |
| Akademisyen | Yukarıdakilerin hepsi + fikirlere akademik değerlendirme (kuramsal çerçeve, düzey, desen, olgunluk, yol, küme, 1–5 puanlar, yazara not) ekler, her fikri ve yorumu silebilir, üye ekler ve çıkarır |
| Listede olmayan biri | Giriş yapsa bile hiçbir fikri göremez |

Bu kurallar tarayıcıda değil, Firebase sunucusunda (`firestore.rules`) uygulanır.

## Güvenlik kurallarını denemek (isteğe bağlı)

**Firestore Database → Rules → Rules Playground** ile kuralları yayınlamadan deneyebilirsiniz.
Örneğin `get /ideas/herhangi` isteğini "Authenticated" ve e-postası listede olmayan bir kullanıcıyla
çalıştırdığınızda **Denied** görmelisiniz.

## Ek güvenlik (isteğe bağlı)

Google Cloud Console → **APIs & Services → Credentials** bölümünde Firebase'in oluşturduğu API anahtarına
"HTTP referrers" kısıtlaması ekleyerek yalnızca `yakiniliskilerlab.com/*` adresinden kullanılmasını sağlayabilirsiniz.

## Dosyalar

```
fikir-havuzu.html   Sayfa (üst bar, alt bilgi, dil ve tema diğer sayfalarla aynı)
fikir-havuzu.js     Uygulama: giriş, fikir formu, liste, detay, değerlendirme, yorumlar, üyeler
fikir-havuzu.css    Yalnızca bu sayfanın stilleri (site.css renklerini kullanır)
firebase-config.js  Firebase bağlantı ayarları (2. adımda doldurulur)
firestore.rules     Veritabanı güvenlik kuralları (4. adımda konsola yapıştırılır)
```

Sayfa arama motorlarında listelenmez (`noindex`) ve üst menüde yer almaz; alt bilgideki **Ekip alanı** bağlantısıyla açılır.
`firebase-config.js` doldurulmadan sayfa "Kurulum bekleniyor" mesajı gösterir.
