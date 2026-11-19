// Para birimine göre ÖRNEK veri setleri ve pristine/dirty durum mantığı. Saf, DOM'suz.
// Örnekler kullanıcının yazacağı biçimde metindir; yalnızca gösterim amaçlıdır.

const make = (v) =>
  Object.freeze({
    nightlyPrice: String(v[0]),
    availableNights: "30",
    occupancyRate: "65",
    platformFeeRate: "15",
    cleaningCostPerBooking: String(v[1]),
    bookingsPerMonth: "6",
    maintenance: String(v[2]),
    electricity: String(v[3]),
    water: String(v[4]),
    internet: String(v[5]),
    insurance: String(v[6]),
    propertyManagement: "",
    otherExpenses: "",
  });

//            gecelik, temizlik, bakım, elektrik, su, internet, sigorta
export const SAMPLES = Object.freeze({
  TRY: make([3500, 750, 2500, 1800, 600, 450, 900]),
  USD: make([120, 35, 50, 40, 15, 12, 20]),
  EUR: make([110, 30, 45, 38, 14, 12, 20]),
  GBP: make([95, 28, 40, 35, 12, 10, 18]),
});

/** Para birimine ait örnek set (bilinmiyorsa USD). Kopya döner. */
export function sampleFor(currency) {
  return { ...(SAMPLES[currency] || SAMPLES.USD) };
}

// ---- Sezonluk örnek ----
// Ay çarpanları gecelik fiyata, doluluk yüzdesi doğrudan uygulanır (Ocak..Aralık).
const SEASONAL_PRICE_FACTORS = Object.freeze([0.8, 0.8, 0.85, 0.95, 1.05, 1.2, 1.35, 1.35, 1.1, 0.95, 0.8, 0.9]);
const SEASONAL_OCCUPANCY = Object.freeze([35, 35, 40, 50, 60, 75, 90, 90, 70, 55, 40, 45]);

/**
 * Sezonluk örnek (kullanıcının yazacağı biçimde METİN). Fiyat, para biriminin basit mod
 * örnek gecelik fiyatından türetilir ve tam sayıya yuvarlanır. Her çağrıda yeni nesne döner.
 * @returns {{year:string, averageStayNights:string, months:{price:string, occupancy:string}[]}}
 */
export function seasonalSample(currency, year) {
  const base = Number((SAMPLES[currency] || SAMPLES.USD).nightlyPrice);
  return {
    year: String(year ?? ""),
    averageStayNights: "4",
    months: SEASONAL_PRICE_FACTORS.map((f, i) => ({
      price: String(Math.round(base * f)),
      occupancy: String(SEASONAL_OCCUPANCY[i]),
    })),
  };
}

/**
 * Sezonluk grubun KENDİ pristine durumu (ortak alanlar nextSampleState ile yönetilir).
 * @param {{seasonalPristine:boolean}} state
 * @param {{type:"edit"}|{type:"currency",currency:string,year:number}|{type:"reset",currency:string,year:number}} action
 * @returns {{seasonalPristine:boolean, values:object|null}} values null ise girdiler korunur.
 */
export function nextSeasonalSampleState(state, action) {
  const pristine = state?.seasonalPristine === true;
  switch (action?.type) {
    case "edit":
      return { seasonalPristine: false, values: null };
    case "currency":
      if (pristine) {
        return { seasonalPristine: true, values: seasonalSample(action.currency, action.year) };
      }
      return { seasonalPristine: false, values: null };
    case "reset":
      return { seasonalPristine: true, values: seasonalSample(action.currency, action.year) };
    default:
      return { seasonalPristine: pristine, values: null };
  }
}

// ---- Üç bağımsız pristine grubu ----
// common: iki modda paylaşılan alanlar; simpleOnly: yalnızca basit mod; seasonal: yıl, ort. konaklama, 12 ay.
export const COMMON_FIELDS = Object.freeze([
  "platformFeeRate",
  "cleaningCostPerBooking",
  "maintenance",
  "electricity",
  "water",
  "internet",
  "insurance",
  "propertyManagement",
  "otherExpenses",
]);
export const SIMPLE_ONLY_FIELDS = Object.freeze(["nightlyPrice", "availableNights", "occupancyRate", "bookingsPerMonth"]);
export const GROUPS = Object.freeze(["common", "simpleOnly", "seasonal"]);

/** Alan adı/id -> grup ("common" | "simpleOnly" | "seasonal") veya null. */
export function groupOfField(field) {
  if (COMMON_FIELDS.includes(field)) return "common";
  if (SIMPLE_ONLY_FIELDS.includes(field)) return "simpleOnly";
  if (/^(year|averageStayNights|price-\d+|occ-\d+)$/.test(String(field))) return "seasonal";
  return null;
}

/** Bir grubun örnek değerleri (para birimine göre). seasonal için seasonalSample(currency, year). */
export function groupSample(group, currency, year) {
  if (group === "seasonal") return seasonalSample(currency, year);
  const all = sampleFor(currency);
  const names = group === "common" ? COMMON_FIELDS : SIMPLE_ONLY_FIELDS;
  return Object.fromEntries(names.map((n) => [n, all[n]]));
}

export const ALL_PRISTINE = Object.freeze({ common: true, simpleOnly: true, seasonal: true });

/**
 * Grup bayrakları geçişi. Bir alan düzenlenince YALNIZCA kendi grubunun bayrağı düşer.
 * Para birimi değişince her grup kendi bayrağına göre: pristine ise yeni örneğe geçer, değilse korunur.
 * Reset üçünü de sıfırlar. Bilinmeyen aksiyon (ör. dil değişimi) hiçbir şeyi değiştirmez.
 * @param {{common:boolean,simpleOnly:boolean,seasonal:boolean}} flags
 * @param {{type:"edit",field:string}|{type:"currency"}|{type:"reset"}} action
 * @returns {{flags:object, fill:{common:boolean,simpleOnly:boolean,seasonal:boolean}}} fill: örnek yazılacak gruplar
 */
export function nextGroupState(flags, action) {
  const none = { common: false, simpleOnly: false, seasonal: false };
  switch (action?.type) {
    case "edit": {
      const g = groupOfField(action.field);
      return { flags: g ? { ...flags, [g]: false } : { ...flags }, fill: none };
    }
    case "currency":
      return { flags: { ...flags }, fill: { common: flags.common, simpleOnly: flags.simpleOnly, seasonal: flags.seasonal } };
    case "reset":
      return { flags: { ...ALL_PRISTINE }, fill: { ...ALL_PRISTINE } };
    default:
      return { flags: { ...flags }, fill: none };
  }
}

/** Örnek bildirimi görünür mü: basit modda common && simpleOnly; sezonluk modda common && seasonal. */
export function sampleNoticeVisible(mode, flags) {
  if (mode === "seasonal") return flags.common && flags.seasonal;
  return flags.common && flags.simpleOnly;
}

/** İlk açılış para birimi (yalnızca dil ipucundan): tr -> TRY, diğer -> USD. */
export function initialCurrency(lang) {
  return lang === "tr" ? "TRY" : "USD";
}

/**
 * Örnek/kullanıcı durumu geçişi. Dil değişimi bu fonksiyona hiç girmez: para birimini değiştirmez.
 * @param {{currency:string, pristine:boolean}} state
 * @param {{type:"edit"}|{type:"currency",currency:string}|{type:"reset"}} action
 * @returns {{currency:string, pristine:boolean, values:object|null}}
 *   values: forma yazılacak örnek set; null ise mevcut girdiler OLDUĞU GİBİ korunur.
 */
export function nextSampleState(state, action) {
  switch (action?.type) {
    case "edit":
      return { currency: state.currency, pristine: false, values: null };
    case "currency":
      if (state.pristine) {
        return { currency: action.currency, pristine: true, values: sampleFor(action.currency) };
      }
      return { currency: action.currency, pristine: false, values: null };
    case "reset":
      return { currency: state.currency, pristine: true, values: sampleFor(state.currency) };
    default:
      return { ...state, values: null };
  }
}
