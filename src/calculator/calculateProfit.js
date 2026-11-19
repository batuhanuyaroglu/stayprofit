// StayProfit kâr hesaplama motoru. Saf, DOM'suz. İç hesapta yuvarlama yok.
// Tutarlar seçilen para biriminde, aylık; oranlar girdide yüzde (20 = %20).
// Vergi hesaba katılmaz.

import { validateInput, EXPENSE_FIELDS } from "./validation.js";

// -0 değerini 0'a çevirir.
const noNegZero = (n) => (n === 0 ? 0 : n);

/**
 * @param {unknown} input
 * @returns {{ok:true,result:object}|{ok:false,errors:object[]}}
 */
export function calculateProfit(input) {
  const v = validateInput(input);
  if (!v.ok) return v;
  const d = v.value;

  // Dolu gece = müsait gece * doluluk% / 100
  const bookedNights = (d.availableNights * d.occupancyRate) / 100;
  // Doluluk yüzdesi = dolu gece / müsait gece * 100 (availableNights >= 1, sıfıra bölme yok)
  const occupancyPercentage = (bookedNights / d.availableNights) * 100;
  // Brüt gelir = gecelik fiyat * dolu gece (yalnızca konaklama; misafire yansıtılan temizlik ücreti gelir değil)
  const grossRevenue = d.nightlyPrice * bookedNights;
  // Platform komisyonu = brüt gelir * komisyon% / 100
  const platformFee = (grossRevenue * d.platformFeeRate) / 100;
  // Temizlik gideri = rezervasyon başına maliyet * aylık rezervasyon sayısı
  const cleaningExpenses = d.cleaningCostPerBooking * d.bookingsPerMonth;
  // İşletme giderleri = 7 aylık kalemin toplamı
  const operatingExpenses = EXPENSE_FIELDS.reduce((sum, f) => sum + d[f], 0);
  // Toplam gider = komisyon + temizlik + işletme giderleri
  const totalExpenses = platformFee + cleaningExpenses + operatingExpenses;
  // Aylık net işletme geliri = brüt gelir - toplam gider (negatif olabilir)
  const monthlyNetOperatingIncome = grossRevenue - totalExpenses;
  // Yıllık tahmin = aylık * 12 (aynı performansın 12 ay sürdüğü varsayımı)
  const annualEstimatedNetOperatingIncome = monthlyNetOperatingIncome * 12;
  // Kâr marjı (%) = aylık net / brüt gelir * 100; brüt gelir 0 ise 0
  const profitMargin =
    grossRevenue === 0 ? 0 : (monthlyNetOperatingIncome / grossRevenue) * 100;

  const numeric = {
    bookedNights: noNegZero(bookedNights),
    occupancyPercentage: noNegZero(occupancyPercentage),
    grossRevenue: noNegZero(grossRevenue),
    platformFee: noNegZero(platformFee),
    cleaningExpenses: noNegZero(cleaningExpenses),
    operatingExpenses: noNegZero(operatingExpenses),
    totalExpenses: noNegZero(totalExpenses),
    monthlyNetOperatingIncome: noNegZero(monthlyNetOperatingIncome),
    annualEstimatedNetOperatingIncome: noNegZero(annualEstimatedNetOperatingIncome),
    profitMargin: noNegZero(profitMargin),
  };

  // Çok büyük (sonlu) girdiler taşarak Infinity/NaN üretebilir; bunları reddet.
  if (!Object.values(numeric).every(Number.isFinite)) {
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

  return { ok: true, result: { ...numeric, currency: d.currency } };
}
