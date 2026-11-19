// Sonuç paneli ve sticky alt çubuğu. Kullanıcı girdisi değil, yalnızca biçimlenmiş sayılar yazılır (textContent).

import { t } from "./i18n.js";
import { formatCurrency, formatPercent, profitStatus } from "./format.js";

const RESULT_KEYS = [
  "grossRevenue",
  "platformFee",
  "totalExpenses",
  "monthlyNetOperatingIncome",
  "annualEstimatedNetOperatingIncome",
  "profitMargin",
];

export function badgeText(status) {
  switch (status) {
    case "profit":
      return t("result.profit");
    case "loss":
      return t("result.loss");
    default:
      return t("result.breakEven");
  }
}

export const BADGE_ICON = { profit: "▲", loss: "▼", even: "=" };

/** Sticky alt çubuğun etiketi ve değeri (iki mod aynı çubuğu kullanır). */
export function setSticky(labelText, valueText) {
  const label = document.getElementById("sticky-label");
  const value = document.getElementById("sticky-value");
  if (label) label.textContent = labelText;
  if (value) value.textContent = valueText;
}

/**
 * @param {{result:object|null, lang:string, currency:string, hasErrors:boolean, generalMessages:string[]}} ctx
 */
export function renderResults(ctx) {
  const { result, lang, currency, hasErrors, generalMessages } = ctx;
  const dash = t("result.dash");

  const values = {};
  for (const key of RESULT_KEYS) values[key] = dash;
  let status = null;

  if (result) {
    values.grossRevenue = formatCurrency(result.grossRevenue, currency, lang) ?? dash;
    values.platformFee = formatCurrency(result.platformFee, currency, lang) ?? dash;
    values.totalExpenses = formatCurrency(result.totalExpenses, currency, lang) ?? dash;
    values.monthlyNetOperatingIncome =
      formatCurrency(result.monthlyNetOperatingIncome, currency, lang) ?? dash;
    values.annualEstimatedNetOperatingIncome =
      formatCurrency(result.annualEstimatedNetOperatingIncome, currency, lang) ?? dash;
    // Brüt gelir 0 iken marj anlamsız -> "—".
    values.profitMargin =
      result.grossRevenue === 0 ? dash : formatPercent(result.profitMargin, lang) ?? dash;
    status = profitStatus(result.monthlyNetOperatingIncome);
  }

  document.querySelectorAll("[data-result]").forEach((el) => {
    el.textContent = values[el.dataset.result] ?? dash;
  });

  setSticky(t("result.monthlyNet"), values.monthlyNetOperatingIncome ?? dash);

  const state = status || "none";
  document.querySelectorAll("[data-state-host]").forEach((el) => {
    el.dataset.state = state;
  });

  const badge = document.getElementById("result-badge");
  const badgeIcon = document.getElementById("result-badge-icon");
  const badgeLabel = document.getElementById("result-badge-text");
  const explain = document.getElementById("result-explain");
  badge.hidden = !status;
  explain.hidden = status !== "loss";
  if (status) {
    badgeIcon.textContent = BADGE_ICON[status];
    badgeLabel.textContent = badgeText(status);
  }
  if (status === "loss") explain.textContent = t("result.lossExplain");

  const statusEl = document.getElementById("result-status");
  const parts = [];
  if (hasErrors) parts.push(t("errors.summary"), ...generalMessages);
  // role="status" bölgesi DOM'da kalır; yalnızca içerik değişir.
  statusEl.textContent = parts.join(" ");
}
