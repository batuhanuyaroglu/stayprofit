# StayProfit

**Know Your Real Rental Profit.**

Tatil amaçlı kiralama yapan ev sahipleri ve profesyonel mülk yöneticileri için kira kârlılığı hesaplama platformu. Türkiye ve global pazar; Türkçe ve İngilizce.

> Durum: Faz 1 (hesaplama motoru) tamamlandı. Faz 2 (arayüz) uygulandı, QA incelemesi sürüyor.

## Teknolojiler
HTML5, CSS3, Vanilla JavaScript, JSON localization. Backend ve veritabanı yok (ilk sürüm).

## Klasör yapısı
```
.claude/agents/   Uzman agent tanımları (architect, frontend, calculation, seo-localization, qa-reviewer)
scripts/          dev-server.js (Node.js yerel geliştirme sunucusu)
src/index.html    Ana sayfa
src/calculator/   Hesaplama motoru (UI'dan bağımsız): calculateProfit.js, validation.js
src/css/          Stiller (tokens, base, layout, components, calculator)
src/js/ui/        Arayüz modülleri (main, i18n, form, render, format, parse-number, storage)
src/locales/      tr.json, en.json
tests/            node:test testleri (motor + UI saf modülleri)
package.json      "type":"module", `npm test`, `npm start`; bağımlılık yok
CLAUDE.md         Claude Code proje kuralları
```

## Hesaplama motoru
Testler: `npm test` (Node.js yerleşik `node:test`).

```js
import { calculateProfit } from "./src/calculator/calculateProfit.js";
const out = calculateProfit({ currency: "USD", nightlyPrice: 100, availableNights: 30, occupancyRate: 70, platformFeeRate: 15, cleaningCostPerBooking: 30, bookingsPerMonth: 6, maintenance: 50, electricity: 40, water: 20, internet: 15, insurance: 25, propertyManagement: 0, otherExpenses: 0 });
// başarı: { ok: true, result } — hata: { ok: false, errors: [{ field, code, message }] }
```

**Oran standardı:** tüm oranlar yüzde 0–100 olarak girilir ve döner (%20 için `20`). `/100` dönüşümü yalnızca `calculateProfit` içinde yapılır. Hiçbir değer iç hesapta yuvarlanmaz; yuvarlama gösterim katmanında (`Intl.NumberFormat`) yapılır.

**Girdi:** `currency` (TRY/USD/EUR/GBP), `nightlyPrice`, `availableNights` (1–31 tam sayı), `occupancyRate`, `platformFeeRate`, `cleaningCostPerBooking`, `bookingsPerMonth` (tam sayı, dolu geceyi aşamaz), aylık giderler: `maintenance`, `electricity`, `water`, `internet`, `insurance`, `propertyManagement`, `otherExpenses`. Sayılar gerçek `number` olmalı; motor metni sessizce dönüştürmez.

**Formüller:**
- `bookedNights = availableNights × occupancyRate / 100`
- `grossRevenue = bookedNights × nightlyPrice`
- `platformFee = grossRevenue × platformFeeRate / 100` (yalnızca konaklama geliri; misafire yansıtılan temizlik ücreti gelir sayılmaz)
- `cleaningExpenses = bookingsPerMonth × cleaningCostPerBooking`
- Sonuçtaki `operatingExpenses` = 7 aylık gider kaleminin toplamı (girdideki `otherExpenses` bu toplamın yalnızca bir kalemidir)
- `totalExpenses = platformFee + cleaningExpenses + operatingExpenses`
- `monthlyNetOperatingIncome = grossRevenue − totalExpenses` (negatif olabilir)
- `annualEstimatedNetOperatingIncome = aylık × 12` (aynı aylık performansın 12 ay sürdüğü varsayımı)
- `profitMargin = aylık net / grossRevenue × 100` (gelir 0 ise 0)
- Vergiler dahil değildir.

**Hata kodları** (i18n anahtarı olarak `errors.<code>` önerilir; `message` yalnızca geliştirici içindir): `REQUIRED`, `NOT_A_NUMBER`, `NOT_AN_INTEGER`, `OUT_OF_RANGE`, `NEGATIVE_VALUE`, `INVALID_CURRENCY`, `BOOKINGS_EXCEED_BOOKED_NIGHTS`, `INVALID_INPUT`, `RESULT_OUT_OF_RANGE`.

## Çalıştırma
Uygulama ES modülleri ve JSON `fetch` kullandığı için `src/index.html` dosyasını çift tıklayıp (`file://`) açmak **çalışmaz**; sayfa bu durumda TR/EN bir uyarı gösterir. Yalnızca Node.js gerekir (harici paket yok):
```
npm start
```
Ardından tarayıcıda http://localhost:8000 adresini açın. `npm start`, `scripts/dev-server.js` dosyasını çalıştırır:
- Web kökü `src/` klasörüdür; `src` dışındaki dosyalara (`..` ve kodlanmış varyantları dahil) erişim reddedilir.
- Varsayılan olarak yalnızca `127.0.0.1` (localhost) üzerinde dinler, dışarıdan erişilemez.
- Varsayılan port 8000. Başka port için: `PORT=8080 npm start` (PowerShell: `$env:PORT=8080; npm start`).
- HTML, CSS, JS ve JSON dosyalarını doğru `Content-Type` ile sunar. Yalnızca GET/HEAD kabul eder.
- Sadece geliştirme içindir; üretim sunucusu değildir.

**iPhone / yerel ağ testi:** telefon ve bilgisayar aynı Wi-Fi ağında olmalı.
```
npm run start:lan
```
Terminal, ağdaki cihazlar için erişim adresini yazar (ör. `http://192.168.x.x:8000`); bu adresi iPhone Safari'de açın. Bu komut `--lan` bayrağıyla `0.0.0.0` üzerinde dinler. Aynı sonuç için `HOST=0.0.0.0 npm start` (PowerShell: `$env:HOST="0.0.0.0"; npm start`) da kullanılabilir. Güvenlik kuralları (yalnızca `src/`, yalnızca GET/HEAD) bu modda da geçerlidir, ancak aynı ağdaki herkes siteye erişebilir: yalnızca güvendiğiniz ağda kullanın. Windows Güvenlik Duvarı izin sorarsa yalnızca özel ağa izin verin. Test bitince sunucuyu Ctrl+C ile durdurun.

## Sezonluk hesaplama (isteğe bağlı mod)
Basit mod varsayılandır ve değişmemiştir. "Sezonluk" modda 12 ayın her biri için ayrı gecelik fiyat ve doluluk girilir; `calculateSeasonalProfit(input)` (`src/calculator/calculateSeasonalProfit.js`) kullanılır.

- **Girdi:** `currency`, `year` (1900–2200 tam sayı; Şubat'ın 28 veya 29 gün olması için), `averageStayNights` (1–365, kesirli olabilir), `platformFeeRate`, `cleaningCostPerBooking`, 7 aylık gider kalemi (tüm aylarda aynı tutar) ve `months` (12 elemanlı dizi, her biri `{nightlyPrice, occupancyRate}`). Hata alanları `months.N.nightlyPrice` / `months.N.occupancyRate` biçimindedir (N = 1–12).
- **Her ay:** `days` = ayın gerçek gün sayısı; `bookedNights = days × doluluk / 100`; `grossRevenue = bookedNights × fiyat`; `platformFee = grossRevenue × komisyon / 100` (yalnızca konaklama geliri); `bookings = bookedNights / averageStayNights`; `cleaningExpenses = temizlik maliyeti × bookings`; `operatingExpenses` = 7 gider kaleminin toplamı; `netOperatingIncome = grossRevenue − platformFee − cleaning − operating`.
- **Rezervasyon sayısı kesirli ve yuvarlanmaz:** tahmini ortalamadır (basit moddaki tam sayı rezervasyon girişinden farklıdır). Arayüzde de bu belirtilir.
- **Yıllık değerler 12 ayın gerçek toplamıdır**, "aylık × 12" değildir. `profitMargin = yıllık net / yıllık brüt × 100` (brüt 0 ise 0). Basit moddaki "yıllık = aylık × 12" notu sezonluk modda gösterilmez.
- Vergi ve para birimi dönüşümü yoktur. Sonuçlar tahminidir.
- **Arayüz:** form üstünde Basit/Sezonluk anahtarı; 12 aylık fiyat/doluluk satırları, "Tüm aylara uygula", yıl ve ortalama konaklama süresi; yıllık özet ve açılır aylık döküm tablosu (mobilde kart düzeni). Mobil alt çubuk sezonluk modda yıllık neti gösterir.
- **Saklama:** sezonluk veriler (ve tüm mali veriler) saklanmaz; sayfa yenilenince örnek değerlere dönülür. Örnek değerler üç bağımsız grupta izlenir (ortak, basit-moda özgü, sezonluk): kullanıcının düzenlemediği grup para birimi değişince yeni para biriminin örneğine geçer, düzenlenen grup korunur.

## Arayüz (Faz 2)
- Canlı hesaplama: her değişiklikte `calculateProfit` çağrılır; sonuçlar brüt gelir, platform komisyonu, toplam gider, aylık net, yıllık net ve kâr marjıdır.
- Açılışta **örnek değerler** gelir (not ile belirtilir); "Örnek Değerlere Dön" düğmesi örneğe geri yükler.
- Temel giderler: bakım, elektrik, su, internet, sigorta. Gelişmiş (açılır): mülk yönetimi, diğer giderler.
- TRY/USD/EUR/GBP yalnızca gösterim içindir; kur dönüşümü yoktur.
- TR/EN dil anahtarı; `src/locales/tr.json` ve `en.json`. Yalnızca dil ve tema tercihi `localStorage`'da saklanır; mali veriler saklanmaz.
- Sayı girişi esnek: `12.5` ve `12,5` aynıdır, `1.234,56` ve `1,234.56` desteklenir. `1.234` gibi belirsiz girdiler yanlış değer üretmek yerine hata verir.
- **Örnek veri setleri:** TRY, USD, EUR ve GBP için ayrı örnek değerler vardır (`src/js/ui/samples.js`). Dil değişimi para birimini değiştirmez. Kullanıcı hiçbir alanı düzenlemediyse para birimi değişince ilgili örnek set yüklenir; en az bir alan düzenlendiyse girdiler olduğu gibi korunur. "Örnek Değerlere Dön" seçili para biriminin örneğine döner.
- **Arayüz üst sınırları** (`src/js/ui/limits.js`; motor sınırları değildir, aşırı büyük girdileri engeller): gecelik fiyat ≤ 1.000.000; rezervasyon başına temizlik ≤ 100.000; her aylık gider kalemi ≤ 10.000.000. Aşılırsa alan altında hata gösterilir ve motor çağrılmaz. Oranlar (0–100), müsait gece (1–31) ve rezervasyon sayısı motor tarafından sınırlanır.
- **Çeviri yükleme hataları:** seçilen dil dosyası yüklenemezse diğer dile düşülür ve uyarı gösterilir. İki dil de yüklenemezse form gizlenir ve sabit TR+EN hata kutusu görünür.
- **SEO:** sayfa başlığı, meta açıklaması ve `<html lang>` dil değişiminde güncellenir. `canonical` ve `hreflang` etiketleri gerçek domain henüz belirlenmediği için eklenmedi; domain belirlenince `src/index.html` `<head>` içine eklenecek (yer `index.html` içinde yorumla işaretlidir).
- **Logo ve tema:** `src/favicon.svg` ve başlıktaki SVG simge (ev silüeti + yükselen kâr çizgisi). Açık/koyu tema: başlıktaki güneş/ay düğmesi. Kayıtlı tercih varsa o, yoksa cihazın `prefers-color-scheme` ayarı kullanılır; manuel seçim cihaz ayarından önceliklidir. Dil ve tema tercihleri birbirinden bağımsızdır, tema değişimi girdileri ve sonuçları etkilemez. Tüm renkler `src/css/tokens.css` değişkenlerindedir.
- Kapsam dışı: PDF, paylaşım, kur dönüşümü, backend, üyelik, ödeme.
