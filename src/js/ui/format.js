// Gösterim biçimlendirme. Saf, DOM'suz. Yuvarlama yalnızca burada (gösterimde) yapılır.

const LOCALES = { tr: "tr-TR", en: "en-US" };

export function localeFor(lang) {
  return LOCALES[lang] || LOCALES.en;
}

// Gösterimde 0,00 görünecek kadar küçük değerleri 0 yapar ("-0,00" çıkmasın).
function snap(value) {
  return Math.abs(value) < 0.005 ? 0 : value;
}

/** Para tutarı; sonlu değilse null. Negatif değer eksi işaretiyle gösterilir. */
export function formatCurrency(value, currency, lang) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat(localeFor(lang), { style: "currency", currency }).format(snap(value));
}

/** Yüzde; `value` zaten yüzde cinsindedir (12.5 -> %12,5), /100 yapılmaz. */
export function formatPercent(value, lang) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat(localeFor(lang), {
    style: "unit",
    unit: "percent",
    maximumFractionDigits: 2,
  }).format(snap(value));
}

/** Düz sayı (ör. hata mesajı parametresi). */
export function formatNumber(value, lang) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat(localeFor(lang), { maximumFractionDigits: 2 }).format(value);
}

/** Sabit ondalık basamaklı sayı (ör. tahmini rezervasyon sayısı, 1 ondalık); yalnızca gösterim. */
export function formatFixed(value, lang, digits = 1) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat(localeFor(lang), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Math.abs(value) < 0.5 * 10 ** -digits ? 0 : value);
}

/** Aylık net için durum: "profit" | "loss" | "even" | null (geçersiz). Gösterim hassasiyetine göre. */
export function profitStatus(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const v = snap(value);
  if (v > 0) return "profit";
  if (v < 0) return "loss";
  return "even";
}
