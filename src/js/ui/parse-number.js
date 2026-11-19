// Esnek TR/EN sayı ayrıştırıcı. Saf fonksiyon: DOM/window kullanmaz.
//
// KURALLAR
// 1. Boşluk, NBSP (U+00A0), dar NBSP (U+202F) ve U+2007 silinir. Baştaki tek "+" veya "-" işareti kabul edilir.
// 2. Boş (veya yalnız boşluk/null/undefined) -> { kind: "EMPTY", value: "" }.
// 3. Rakam, "." ve "," dışında karakter (harf, "e", para simgesi, vb.) veya hiç rakam yok -> NAN.
// 4. Hem "." hem "," varsa SON ayraç ondalık, diğeri binliktir.
//    "1.234,56" -> 1234.56 ; "1,234.56" -> 1234.56.
//    Binlik kısım düzgün gruplanmış olmalı (1-3 hane, sonra 3'er hane); aksi halde NAN. Ondalık kısım yalnız rakam ve boş olamaz.
// 5. Tek tür ayraç, birden fazla kez geçiyorsa: düzgün binlik gruplama ise ("1.234.567") binlik kabul edilir; değilse NAN ("1.2.3").
// 6. Tek tür ayraç, tek kez geçiyorsa:
//    - Sonrasında tam 3 hane VE öncesi 1-3 hane (baş rakamı 0 değil) ise ("1.234", "1,234", "12.345") -> AMBIGUOUS.
//      Yanlış değer üretilmez; kullanıcıdan net yazması istenir.
//    - Aksi halde ondalıktır: "12.5", "12,5", "0.125", "1234.567", ".5", "12." (sondaki ayraç ondalık, kesir yok).
// 7. Sonuç sonlu olmalı, değilse NAN. -0 -> 0.
//
// Dönüş: { kind: "OK" | "EMPTY" | "NAN" | "AMBIGUOUS", value: number | "" | NaN }

export const KIND = Object.freeze({
  OK: "OK",
  EMPTY: "EMPTY",
  NAN: "NAN",
  AMBIGUOUS: "AMBIGUOUS",
});

const EMPTY = Object.freeze({ kind: KIND.EMPTY, value: "" });
const NAN = Object.freeze({ kind: KIND.NAN, value: NaN });
const AMBIGUOUS = Object.freeze({ kind: KIND.AMBIGUOUS, value: NaN });

const escapeSep = (sep) => (sep === "." ? "\\." : ",");
const groupedPattern = (sep) => new RegExp(`^\\d{1,3}(${escapeSep(sep)}\\d{3})+$`);

function ok(sign, intPart, frac) {
  const n = sign * Number(`${intPart === "" ? "0" : intPart}.${frac === "" ? "0" : frac}`);
  if (!Number.isFinite(n)) return NAN;
  return { kind: KIND.OK, value: n === 0 ? 0 : n };
}

/** @param {unknown} raw */
export function parseNumber(raw) {
  if (raw === null || raw === undefined) return EMPTY;
  const s = String(raw).replace(/[\s   ]/g, "");
  if (s === "") return EMPTY;

  const m = /^([+-]?)([\d.,]+)$/.exec(s);
  if (!m || !/\d/.test(m[2])) return NAN;
  const sign = m[1] === "-" ? -1 : 1;
  const body = m[2];

  const hasDot = body.includes(".");
  const hasComma = body.includes(",");

  if (!hasDot && !hasComma) return ok(sign, body, "");

  if (hasDot && hasComma) {
    const decSep = body.lastIndexOf(".") > body.lastIndexOf(",") ? "." : ",";
    const thouSep = decSep === "." ? "," : ".";
    const idx = body.lastIndexOf(decSep);
    const intPart = body.slice(0, idx);
    const frac = body.slice(idx + 1);
    if (!/^\d+$/.test(frac)) return NAN;
    if (!groupedPattern(thouSep).test(intPart)) return NAN;
    return ok(sign, intPart.split(thouSep).join(""), frac);
  }

  const sep = hasDot ? "." : ",";
  const parts = body.split(sep);

  if (parts.length > 2) {
    if (!groupedPattern(sep).test(body)) return NAN;
    return ok(sign, parts.join(""), "");
  }

  const [a, b] = parts;
  if (a === "" && b === "") return NAN;
  if (b.length === 3 && /^[1-9]\d{0,2}$/.test(a)) return AMBIGUOUS;
  return ok(sign, a, b);
}
