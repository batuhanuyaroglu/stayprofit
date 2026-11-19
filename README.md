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

## Arayüz (Faz 2)
- Canlı hesaplama: her değişiklikte `calculateProfit` çağrılır; sonuçlar brüt gelir, platform komisyonu, toplam gider, aylık net, yıllık net ve kâr marjıdır.
- Açılışta **örnek değerler** gelir (not ile belirtilir); "Örnek Değerlere Dön" düğmesi örneğe geri yükler.
- Temel giderler: bakım, elektrik, su, internet, sigorta. Gelişmiş (açılır): mülk yönetimi, diğer giderler.
- TRY/USD/EUR/GBP yalnızca gösterim içindir; kur dönüşümü yoktur.
- TR/EN dil anahtarı; `src/locales/tr.json` ve `en.json`. Yalnızca dil tercihi `localStorage`'da saklanır; mali veriler saklanmaz.
- Sayı girişi esnek: `12.5` ve `12,5` aynıdır, `1.234,56` ve `1,234.56` desteklenir. `1.234` gibi belirsiz girdiler yanlış değer üretmek yerine hata verir.
- **Örnek veri setleri:** TRY, USD, EUR ve GBP için ayrı örnek değerler vardır (`src/js/ui/samples.js`). Dil değişimi para birimini değiştirmez. Kullanıcı hiçbir alanı düzenlemediyse para birimi değişince ilgili örnek set yüklenir; en az bir alan düzenlendiyse girdiler olduğu gibi korunur. "Örnek Değerlere Dön" seçili para biriminin örneğine döner.
- **Arayüz üst sınırları** (`src/js/ui/limits.js`; motor sınırları değildir, aşırı büyük girdileri engeller): gecelik fiyat ≤ 1.000.000; rezervasyon başına temizlik ≤ 100.000; her aylık gider kalemi ≤ 10.000.000. Aşılırsa alan altında hata gösterilir ve motor çağrılmaz. Oranlar (0–100), müsait gece (1–31) ve rezervasyon sayısı motor tarafından sınırlanır.
- **Çeviri yükleme hataları:** seçilen dil dosyası yüklenemezse diğer dile düşülür ve uyarı gösterilir. İki dil de yüklenemezse form gizlenir ve sabit TR+EN hata kutusu görünür.
- **SEO:** sayfa başlığı, meta açıklaması ve `<html lang>` dil değişiminde güncellenir. `canonical` ve `hreflang` etiketleri gerçek domain henüz belirlenmediği için eklenmedi; domain belirlenince `src/index.html` `<head>` içine eklenecek (yer `index.html` içinde yorumla işaretlidir).
- Kapsam dışı: koyu tema, PDF, paylaşım, kur dönüşümü, backend, üyelik, ödeme.
