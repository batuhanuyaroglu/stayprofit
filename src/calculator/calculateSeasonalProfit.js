// StayProfit sezonluk (12 aylık) kâr hesaplama motoru. Saf, DOM'suz, Date kullanmaz.
// İç hesapta yuvarlama yok. Tutarlar seçilen para biriminde; oranlar girdide yüzde (20 = %20).
// Vergi ve para birimi dönüşümü yoktur.
//
// Basit moddan (calculateProfit) farkları:
//  - Her ayın fiyatı/doluluğu ayrıdır; gün sayısı takvimden gelir (artık yıl dahil).
//  - Yıllık net = 12 ayın GERÇEK toplamı (aylık net x 12 değildir).
//  - Rezervasyon sayısı "tahmini ortalama"dır: bookedNights / averageStayNights, KESİRLİ, yuvarlanmaz.
//  - İşletme giderleri (7 kalem) her aya aynı tutarla uygulanır.
//
// Aylık formüller (m = ay):
//  days                = daysInMonth(year, m)
//  bookedNights        = days * occupancyRate / 100
//  grossRevenue        = nightlyPrice * bookedNights (yalnızca konaklama geliri)
//  platformFee         = grossRevenue * platformFeeRate / 100
//  bookings            = bookedNights / averageStayNights (tahmini ortalama, kesirli)
//  cleaningExpenses    = cleaningCostPerBooking * bookings
//  operatingExpenses   = 7 gider kaleminin toplamı
//  totalExpenses       = platformFee + cleaningExpenses + operatingExpenses
//  netOperatingIncome  = grossRevenue - totalExpenses (negatif olabilir)
//  profitMargin (%)    = grossRevenue === 0 ? 0 : net / grossRevenue * 100
//  occupancyPercentage = bookedNights / days * 100
// Yıllık: toplamlar 12 ayın toplamıdır; occupancyPercentage = toplam bookedNights / toplam days * 100;
//  profitMargin = annualNet / annualGross * 100 (gross 0 ise 0).

import { EXPENSE_FIELDS } from "./validation.js";
import { validateSeasonalInput } from "./seasonal-validation.js";

const noNegZero = (n) => (n === 0 ? 0 : n);

/** Artık yıl (Gregoryen): 4'e bölünür, 100'e bölünmez veya 400'e bölünür. */
export function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Ayın gün sayısı; month1to12 1 tabanlı. Saf aritmetik. */
export function daysInMonth(year, month1to12) {
  if (month1to12 === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month1to12) ? 30 : 31;
}

const FIELDS = [
  "bookedNights",
  "bookings",
  "grossRevenue",
  "platformFee",
  "cleaningExpenses",
  "operatingExpenses",
  "totalExpenses",
  "netOperatingIncome",
];

/**
 * @param {unknown} input
 * @returns {{ok:true,result:object}|{ok:false,errors:object[]}}
 */
export function calculateSeasonalProfit(input) {
  const v = validateSeasonalInput(input);
  if (!v.ok) return v;
  const d = v.value;

  const operatingExpenses = EXPENSE_FIELDS.reduce((sum, f) => sum + d[f], 0);

  const months = d.months.map((m, i) => {
    const month = i + 1;
    const days = daysInMonth(d.year, month);
    const bookedNights = (days * m.occupancyRate) / 100;
    const grossRevenue = m.nightlyPrice * bookedNights;
    const platformFee = (grossRevenue * d.platformFeeRate) / 100;
    // Tahmini ortalama rezervasyon sayısı (kesirli; averageStayNights >= 1, sıfıra bölme yok)
    const bookings = bookedNights / d.averageStayNights;
    const cleaningExpenses = d.cleaningCostPerBooking * bookings;
    const totalExpenses = platformFee + cleaningExpenses + operatingExpenses;
    const netOperatingIncome = grossRevenue - totalExpenses;
    const profitMargin = grossRevenue === 0 ? 0 : (netOperatingIncome / grossRevenue) * 100;
    const occupancyPercentage = (bookedNights / days) * 100;
    return {
      month,
      days,
      bookedNights,
      occupancyPercentage,
      bookings,
      grossRevenue,
      platformFee,
      cleaningExpenses,
      operatingExpenses,
      totalExpenses,
      netOperatingIncome,
      profitMargin,
    };
  });

  const sum = (f) => months.reduce((s, m) => s + m[f], 0);
  const annualDays = sum("days");
  const annualBooked = sum("bookedNights");
  const annualGross = sum("grossRevenue");
  const annualNet = sum("netOperatingIncome");
  const annual = { days: annualDays, occupancyPercentage: (annualBooked / annualDays) * 100 };
  for (const f of FIELDS) annual[f] = sum(f);
  annual.profitMargin = annualGross === 0 ? 0 : (annualNet / annualGross) * 100;

  // Çok büyük (sonlu) girdiler taşarak Infinity/NaN üretebilir; bunları reddet.
  const allFinite = (o) => Object.values(o).every(Number.isFinite);
  if (!months.every(allFinite) || !allFinite(annual)) {
    return {
      ok: false,
      errors: [
        {
          field: "input",
          code: "RESULT_OUT_OF_RANGE",
          message: "Calculated result is out of the representable range.",
        },
      ],
    };
  }

  const clean = (o) => Object.fromEntries(Object.entries(o).map(([k, x]) => [k, noNegZero(x)]));
  return {
    ok: true,
    result: {
      currency: d.currency,
      year: d.year,
      months: months.map(clean),
      annual: clean(annual),
    },
  };
}
