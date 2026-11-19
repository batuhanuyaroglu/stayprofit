// Sezonluk formun DOM tarafı: 12 aylık satırlar, okuma/yazma, hata gösterimi.
// Yalnızca çağrılınca DOM'a dokunur. Kullanıcı girdisi yalnızca .value ile okunur/yazılır (innerHTML yok).

import { t } from "./i18n.js";
import { daysInMonth } from "../../calculator/calculateSeasonalProfit.js";
import { MONTHS, effectiveYear } from "./seasonal-form.js";

function el(tag, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function makeCell(id, unit) {
  const wrap = el("div", "field seasonal__cell");
  const control = el("div", "field__control");
  const input = el("input", "field__input");
  input.id = id;
  input.name = id;
  input.type = "text";
  input.inputMode = "decimal";
  const u = el("span", "field__unit");
  if (unit === "currency") u.dataset.unit = "currency";
  else u.textContent = unit;
  control.append(input, u);
  const error = el("p", "field__error");
  error.id = `${id}-error`;
  error.hidden = true;
  wrap.append(control, error);
  return wrap;
}

/** 12 aylık satırları üretir (içerik/etiketler refreshMonthLabels ile yazılır). */
export function buildMonthRows(container) {
  container.replaceChildren();
  for (const n of MONTHS) {
    const row = el("div", "seasonal__row");
    row.dataset.month = String(n);
    const name = el("div", "seasonal__name");
    const month = el("span", "seasonal__month");
    const days = el("span", "seasonal__days");
    name.append(month, days);
    row.append(name, makeCell(`price-${n}`, "currency"), makeCell(`occ-${n}`, "%"));
    container.append(row);
  }
}

/** Ay adları, gün sayıları ve giriş etiketleri; dil veya yıl değişince çağrılır. */
export function refreshMonthLabels(container, year) {
  for (const n of MONTHS) {
    const row = container.querySelector(`[data-month="${n}"]`);
    if (!row) continue;
    const monthName = t(`month.${n}`);
    row.querySelector(".seasonal__month").textContent = monthName;
    row.querySelector(".seasonal__days").textContent = t("seasonal.month.days", {
      days: daysInMonth(year, n),
    });
    document.getElementById(`price-${n}`).setAttribute("aria-label", t("seasonal.month.price", { month: monthName }));
    document.getElementById(`occ-${n}`).setAttribute("aria-label", t("seasonal.month.occupancy", { month: monthName }));
  }
}

export function currentYear(yearInput, fallback) {
  return effectiveYear(yearInput.value, fallback);
}

const val = (id) => document.getElementById(id)?.value ?? "";

/** Sezonluk ham girdiler (metin). */
export function readSeasonalRaw() {
  return {
    year: val("year"),
    averageStayNights: val("averageStayNights"),
    months: MONTHS.map((n) => ({ price: val(`price-${n}`), occupancy: val(`occ-${n}`) })),
  };
}

function setVal(id, value) {
  const input = document.getElementById(id);
  if (input) input.value = value ?? "";
}

export function fillSeasonalMonths(months) {
  for (const n of MONTHS) {
    setVal(`price-${n}`, months?.[n - 1]?.price);
    setVal(`occ-${n}`, months?.[n - 1]?.occupancy);
  }
}

export function fillSeasonalValues(values) {
  setVal("year", values.year);
  setVal("averageStayNights", values.averageStayNights);
  fillSeasonalMonths(values.months);
}

/** Alan hatasını gösterir/temizler (aria-invalid + aria-describedby). id: input id. */
export function setInputError(id, message) {
  const input = document.getElementById(id);
  const errEl = document.getElementById(`${id}-error`);
  if (!input || !errEl) return;
  const base = document.getElementById(`${id}-hint`) ? `${id}-hint` : "";
  if (message) {
    input.setAttribute("aria-invalid", "true");
    input.setAttribute("aria-describedby", `${base} ${id}-error`.trim());
    errEl.textContent = message;
    errEl.hidden = false;
  } else {
    input.removeAttribute("aria-invalid");
    if (base) input.setAttribute("aria-describedby", base);
    else input.removeAttribute("aria-describedby");
    errEl.textContent = "";
    errEl.hidden = true;
  }
}
