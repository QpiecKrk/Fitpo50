"use strict";
(() => {
  // src/lipid-markers-core.ts
  function parseLocalizedNumber(value) {
    const normalized = value.trim().replace(/\s+/g, "").replace(",", ".");
    return normalized === "" ? Number.NaN : Number(normalized);
  }
  function validateLipidValues(total, hdl, unit) {
    if (!Number.isFinite(total) || !Number.isFinite(hdl)) return "Wpisz oba wyniki w postaci liczb.";
    if (total <= 0 || hdl <= 0) return "Oba wyniki musz\u0105 by\u0107 wi\u0119ksze od zera.";
    const maximum = unit === "mgdl" ? 1e3 : 30;
    if (total > maximum || hdl > maximum) return "Sprawd\u017A warto\u015B\u0107 i wybran\u0105 jednostk\u0119.";
    if (hdl > total) return "HDL-C nie mo\u017Ce by\u0107 wy\u017Csze od cholesterolu ca\u0142kowitego. Sprawd\u017A przepisane warto\u015Bci.";
    return null;
  }
  function calculateNonHdl(total, hdl) {
    return Math.round((total - hdl) * 10) / 10;
  }

  // src/lipid-markers-explainer.ts
  var form = document.querySelector("[data-lipid-form]");
  if (form) {
    const unit = form.querySelector("[data-lipid-unit]");
    const total = form.querySelector("[data-lipid-total]");
    const hdl = form.querySelector("[data-lipid-hdl]");
    const error = form.querySelector("[data-lipid-error]");
    const empty = document.querySelector("[data-lipid-empty]");
    const content = document.querySelector("[data-lipid-content]");
    const result = document.querySelector("[data-lipid-result]");
    const resultUnit = document.querySelector("[data-lipid-result-unit]");
    const totalCopy = document.querySelector("[data-lipid-total-copy]");
    const hdlCopy = document.querySelector("[data-lipid-hdl-copy]");
    const resultCopy = document.querySelector("[data-lipid-result-copy]");
    const unitLabels = Array.from(document.querySelectorAll("[data-lipid-unit-label]"));
    const format = (value) => value.toLocaleString("pl-PL", { maximumFractionDigits: 1 });
    const unitText = () => (unit == null ? void 0 : unit.value) === "mmoll" ? "mmol/l" : "mg/dl";
    unit == null ? void 0 : unit.addEventListener("change", () => {
      unitLabels.forEach((label) => {
        label.textContent = unitText();
      });
    });
    form.addEventListener("submit", (event) => {
      var _a, _b;
      event.preventDefault();
      const selectedUnit = (unit == null ? void 0 : unit.value) === "mmoll" ? "mmoll" : "mgdl";
      const totalValue = parseLocalizedNumber((_a = total == null ? void 0 : total.value) != null ? _a : "");
      const hdlValue = parseLocalizedNumber((_b = hdl == null ? void 0 : hdl.value) != null ? _b : "");
      const message = validateLipidValues(totalValue, hdlValue, selectedUnit);
      if (message) {
        if (error) {
          error.textContent = message;
          error.hidden = false;
        }
        return;
      }
      if (error) error.hidden = true;
      const nonHdl = calculateNonHdl(totalValue, hdlValue);
      if (result) result.textContent = format(nonHdl);
      if (resultUnit) resultUnit.textContent = unitText();
      if (totalCopy) totalCopy.textContent = format(totalValue);
      if (hdlCopy) hdlCopy.textContent = format(hdlValue);
      if (resultCopy) resultCopy.textContent = format(nonHdl);
      if (empty) empty.hidden = true;
      if (content) content.hidden = false;
    });
  }
})();
