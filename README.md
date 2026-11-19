# StayProfit

**Know Your Real Rental Profit.**

Tatil amaçlı kiralama yapan ev sahipleri ve profesyonel mülk yöneticileri için kira kârlılığı hesaplama platformu. Türkiye ve global pazar; Türkçe ve İngilizce.

> Durum: Faz 1 (hesaplama motoru) tamamlandı. Arayüz henüz yok.

## Teknolojiler
HTML5, CSS3, Vanilla JavaScript, JSON localization. Backend ve veritabanı yok (ilk sürüm).

## Klasör yapısı
```
.claude/agents/   Uzman agent tanımları (architect, frontend, calculation, seo-localization, qa-reviewer)
src/calculator/   Hesaplama motoru (UI'dan bağımsız): calculateProfit.js, validation.js
tests/            node:test testleri (calculator.test.js)
package.json      Yalnızca "type":"module" ve test betiği; bağımlılık yok
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
Henüz uygulama yok. Geliştirme tamamlandığında `src/index.html` dosyasını tarayıcıda açmak yeterli olacak. JSON çeviri dosyaları için gerekirse basit bir statik sunucu kullanılabilir:
```
python -m http.server 8000 --directory src
```
