// Sezonluk sonuç paneli, aylık döküm tablosu ve sticky çubuk. Yalnızca biçimlenmiş sayılar yazılır
// (textContent / createElement; innerHTML yok). Yuvarlama yalnızca gösterimdedir.

import { t } from "./i18n.js";
import { formatCurrency, formatPercent, formatNumber, formatFixed, profitStatus } from "./format.js";
import { BADGE_ICON, badgeText, setSticky } from "./render.js";
import { MONTHS } from "./seasonal-form.js";

const NET_CLASS = { profit: "month-table__net--profit", loss: "month-table__net--loss", even: "month-table__net--even" };

function cell(tag, text, opts = {}) {
  const el = document.createElement(tag);
  el.textContent = text;
  el.setAttribute("role", opts.role || (tag === "th" ? "columnheader" : "cell"));
  if (opts.scope) el.setAttribute("scope", opts.scope);
  if (opts.label) el.dataset.label = opts.label;
  if (opts.className) el.className = opts.className;
  return el;
}

// Sütun tanımı: etiket anahtarı (data-label için t() ile yazılır) ve değer biçimleyici.
function columns(currency, lang, dash) {
  const money = (v) => formatCurrency(v, currency, lang) ?? dash;
  return [
    { label: t("seasonal.col.days"), value: (m) => formatNumber(m.days, lang) ?? dash },
    { label: t("seasonal.col.occupancy"), value: (m) => formatPercent(m.occupancyPercentage, lang) ?? dash },
    { label: t("seasonal.col.gross"), value: (m) => money(m.grossRevenue) },
    { label: t("seasonal.col.fee"), value: (m) => money(m.platformFee) },
    { label: t("seasonal.col.cleaning"), value: (m) => money(m.cleaningExpenses) },
    { label: t("seasonal.col.operating"), value: (m) => money(m.operatingExpenses) },
    {
      label: t("seasonal.col.net"),
      value: (m) => money(m.netOperatingIncome),
      net: true,
    },
    { label: t("seasonal.col.bookings"), value: (m) => formatFixed(m.bookings, lang, 1) ?? dash },
  ];
}

function buildRow(rowHeader, data, cols, dash) {
  const tr = document.createElement("tr");
  tr.setAttribute("role", "row");
  tr.append(cell("th", rowHeader, { scope: "row", role: "rowheader", className: "month-table__month" }));
  for (const c of cols) {
    const text = data ? c.value(data) : dash;
    let cls = "month-table__num";
    if (c.net) {
      cls += ` month-table__net ${data ? NET_CLASS[profitStatus(data.netOperatingIncome)] || "" : ""}`;
    }
    tr.append(cell("td", text, { label: c.label, className: cls.trim() }));
  }
  return tr;
}

/** Aylık döküm: 12 ay satırı + yıllık toplam (tfoot). result null ise değerler "—". */
export function renderBreakdown(result, currency, lang) {
  const body = document.getElementById("breakdown-body");
  const foot = document.getElementById("breakdown-foot");
  if (!body || !foot) return;
  const dash = t("result.dash");
  const cols = columns(currency, lang, dash);

  body.replaceChildren(
    ...MONTHS.map((n) => buildRow(t(`month.${n}`), result ? result.months[n - 1] : null, cols, dash))
  );
  // Toplam satırı etiketi: yıllık toplam (12 ayın gerçek toplamı).
  const footLabel = t("seasonal.table.total");
  foot.replaceChildren(buildRow(footLabel, result ? result.annual : null, cols, dash));
}

/**
 * @param {{result:object|null, lang:string, currency:string, hasErrors:boolean, generalMessages:string[]}} ctx
 */
export function renderSeasonalResults(ctx) {
  const { result, lang, currency, hasErrors, generalMessages } = ctx;
  const dash = t("result.dash");
  const a = result ? result.annual : null;

  const money = (v) => formatCurrency(v, currency, lang) ?? dash;
  const values = {
    annualNet: a ? money(a.netOperatingIncome) : dash,
    annualGross: a ? money(a.grossRevenue) : dash,
    annualFee: a ? money(a.platformFee) : dash,
    annualTotalExpenses: a ? money(a.totalExpenses) : dash,
    annualBookings: a ? formatFixed(a.bookings, lang, 1) ?? dash : dash,
    // Brüt gelir 0 iken marj anlamsız -> "—".
    annualMargin: a ? (a.grossRevenue === 0 ? dash : formatPercent(a.profitMargin, lang) ?? dash) : dash,
  };
  const status = a ? profitStatus(a.netOperatingIncome) : null;

  document.querySelectorAll("[data-sresult]").forEach((el) => {
    el.textContent = values[el.dataset.sresult] ?? dash;
  });

  setSticky(t("result.annualNetShort"), values.annualNet);

  const state = status || "none";
  document.querySelectorAll("[data-state-host]").forEach((el) => {
    el.dataset.state = state;
  });

  const badge = document.getElementById("result-badge-seasonal");
  const explain = document.getElementById("result-explain-seasonal");
  badge.hidden = !status;
  explain.hidden = status !== "loss";
  if (status) {
    document.getElementById("result-badge-seasonal-icon").textContent = BADGE_ICON[status];
    document.getElementById("result-badge-seasonal-text").textContent = badgeText(status);
  }
  if (status === "loss") explain.textContent = t("result.lossExplain");

  const parts = [];
  if (hasErrors) parts.push(t("errors.summary"), ...generalMessages);
  document.getElementById("result-status-seasonal").textContent = parts.join(" ");

  renderBreakdown(result, currency, lang);
}
