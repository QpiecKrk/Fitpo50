"use strict";
(() => {
  (function() {
    "use strict";
    const form = document.querySelector("[data-pheno-form]");
    const errorNode = document.querySelector("[data-pheno-error]");
    const emptyNode = document.querySelector("[data-pheno-empty]");
    const contentNode = document.querySelector("[data-pheno-content]");
    const progressLabel = document.querySelector("[data-pheno-progress-label]");
    const progressBar = document.querySelector("[data-pheno-progress-bar]");
    const ageNode = document.querySelector("[data-pheno-age]");
    const chronoNode = document.querySelector("[data-chrono-age]");
    const differenceNode = document.querySelector("[data-age-difference]");
    const labelNode = document.querySelector("[data-age-label]");
    const explanationNode = document.querySelector("[data-pheno-explanation]");
    if (!form || !errorNode || !emptyNode || !contentNode || !progressLabel || !progressBar || !ageNode || !chronoNode || !differenceNode || !labelNode || !explanationNode) return;
    const safeForm = form, safeError = errorNode, safeEmpty = emptyNode, safeContent = contentNode;
    const safeProgressLabel = progressLabel, safeProgressBar = progressBar;
    const biomarkerInputs = Array.from(safeForm.querySelectorAll("input[required]"));
    function parse(name) {
      return Number(String(new FormData(safeForm).get(name) || "").replace(",", "."));
    }
    function canonical(values, units) {
      return { ...values, albumin: units.albuminUnit === "gdL" ? values.albumin * 10 : values.albumin, creatinine: units.creatinineUnit === "mgdL" ? values.creatinine * 88.4 : values.creatinine, glucose: units.glucoseUnit === "mgdL" ? values.glucose / 18 : values.glucose, crp: units.crpUnit === "mgL" ? values.crp / 10 : values.crp };
    }
    function calculate(v) {
      const xb = -19.9067 - 0.0336 * v.albumin + 95e-4 * v.creatinine + 0.1953 * v.glucose + 0.0954 * Math.log(v.crp) - 0.012 * v.lymphocyte + 0.0268 * v.mcv + 0.3306 * v.rdw + 188e-5 * v.alp + 0.0554 * v.wbc + 0.0804 * v.age;
      const mortality = 1 - Math.exp(-Math.exp(xb) * (Math.exp(120 * 76927e-7) - 1) / 76927e-7);
      return 141.50225 + Math.log(-553e-5 * Math.log(1 - mortality)) / 0.090165;
    }
    function updateProgress() {
      let complete = 0;
      biomarkerInputs.forEach((input) => {
        const card = input.closest(".pheno-field");
        const valid = input.value.trim() !== "" && input.checkValidity();
        if (valid) complete += 1;
        if (card) card.classList.toggle("is-complete", valid);
      });
      safeProgressLabel.textContent = `${complete} / 10`;
      safeProgressBar.style.width = `${complete * 10}%`;
    }
    biomarkerInputs.forEach((input) => {
      input.addEventListener("input", updateProgress);
      input.addEventListener("change", updateProgress);
    });
    updateProgress();
    function showError(message) {
      safeError.textContent = message;
      safeError.hidden = false;
      safeEmpty.hidden = false;
      safeContent.hidden = true;
    }
    safeForm.addEventListener("submit", (event) => {
      event.preventDefault();
      safeError.hidden = true;
      const button = safeForm.querySelector("[data-pheno-submit]");
      if (button) button.disabled = true;
      try {
        if (!safeForm.checkValidity()) {
          showError("Uzupe\u0142nij wszystkie pola i sprawd\u017A, czy warto\u015Bci mieszcz\u0105 si\u0119 w dozwolonym zakresie.");
          safeForm.reportValidity();
          return;
        }
        const values = { age: parse("age"), albumin: parse("albumin"), creatinine: parse("creatinine"), glucose: parse("glucose"), crp: parse("crp"), lymphocyte: parse("lymphocyte"), mcv: parse("mcv"), rdw: parse("rdw"), alp: parse("alp"), wbc: parse("wbc") };
        const data = new FormData(safeForm);
        const units = { albuminUnit: String(data.get("albuminUnit")), creatinineUnit: String(data.get("creatinineUnit")), glucoseUnit: String(data.get("glucoseUnit")), crpUnit: String(data.get("crpUnit")) };
        const normalized = canonical(values, units);
        if (normalized.crp <= 0) {
          showError("CRP musi by\u0107 wi\u0119ksze od zera, poniewa\u017C wz\xF3r wykorzystuje logarytm tego wyniku.");
          return;
        }
        const phenoAge = calculate(normalized);
        if (!Number.isFinite(phenoAge)) {
          showError("Nie uda\u0142o si\u0119 obliczy\u0107 wyniku. Sprawd\u017A warto\u015Bci i jednostki.");
          return;
        }
        const rounded = Math.round(phenoAge * 10) / 10;
        const difference = Math.round((rounded - values.age) * 10) / 10;
        safeEmpty.hidden = true;
        safeContent.hidden = false;
        ageNode.textContent = rounded.toFixed(1).replace(".", ",");
        chronoNode.textContent = `${values.age} lat`;
        differenceNode.textContent = `${difference > 0 ? "+" : ""}${difference.toFixed(1).replace(".", ",")} lat`;
        if (difference <= -3) {
          labelNode.textContent = "ni\u017Cszy";
          explanationNode.textContent = "Wynik jest ni\u017Cszy od wieku metrykalnego. Oznacza to korzystniejszy profil dziewi\u0119ciu marker\xF3w w ramach tego modelu, ale nie dowodzi wolniejszego starzenia wszystkich narz\u0105d\xF3w.";
        } else if (difference >= 3) {
          labelNode.textContent = "wy\u017Cszy";
          explanationNode.textContent = "Wynik jest wy\u017Cszy od wieku metrykalnego. Warto om\xF3wi\u0107 poszczeg\xF3lne wyniki bada\u0144 z lekarzem, zamiast pr\xF3bowa\u0107 obni\u017Ca\u0107 sam\u0105 liczb\u0119 PhenoAge.";
        } else {
          labelNode.textContent = "zbli\u017Cony";
          explanationNode.textContent = "Wynik jest zbli\u017Cony do wieku metrykalnego. Najwi\u0119cej informacji daje obserwowanie marker\xF3w i ich trendu, nie pojedynczej warto\u015Bci modelu.";
        }
      } finally {
        if (button) button.disabled = false;
      }
    });
  })();
})();
