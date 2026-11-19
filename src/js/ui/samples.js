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
