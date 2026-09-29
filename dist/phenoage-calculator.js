"use strict";
(() => {
  // src/phenoage-core.ts
  function canonicalizePhenoAgeValues(values, units) {
    return {
      ...values,
      albumin: units.albuminUnit === "gdL" ? values.albumin * 10 : values.albumin,
      creatinine: units.creatinineUnit === "mgdL" ? values.creatinine * 88.4 : values.creatinine,
      glucose: units.glucoseUnit === "mgdL" ? values.glucose / 18 : values.glucose,
      crp: units.crpUnit === "mgL" ? values.crp / 10 : values.crp
    };
  }
  function calculatePhenoAge(values) {
    const inputs = [
      values.age,
      values.albumin,
      values.creatinine,
      values.glucose,
      values.crp,
      values.lymphocyte,
      values.mcv,
      values.rdw,
      values.alp,
      values.wbc
    ];
    if (inputs.some((value) => !Number.isFinite(value)) || values.crp <= 0) {
      return Number.NaN;
    }
    const linearPredictor = -19.90667 - 0.03359355 * values.albumin + 9506491e-9 * values.creatinine + 0.1953192 * values.glucose + 0.09536762 * Math.log(values.crp) - 0.01199984 * values.lymphocyte + 0.02676401 * values.mcv + 0.3306156 * values.rdw + 1868778e-9 * values.alp + 0.05542406 * values.wbc + 0.08035356 * values.age;
    const tenYearMortality = 1 - Math.exp(-1.51714 * Math.exp(linearPredictor) / 7692696e-9);
    return Math.log(-55305e-7 * Math.log(1 - tenYearMortality)) / 0.090165 + 141.50225;
  }
  function describeAgeDifference(difference) {
    if (difference < -0.05) return "poni\u017Cej wieku metrykalnego";
    if (difference > 0.05) return "powy\u017Cej wieku metrykalnego";
    return "zbli\u017Cony do wieku metrykalnego";
  }

  // src/phenoage-calculator.ts
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
    if (!form || !errorNode || !emptyNode || !contentNode || !progressLabel || !progressBar || !ageNode || !chronoNode || !differenceNode || !labelNode || !explanationNode) {
      return;
    }
    const safeForm = form;
    const safeError = errorNode;
    const safeEmpty = emptyNode;
    const safeContent = contentNode;
    const safeProgressLabel = progressLabel;
    const safeProgressBar = progressBar;
    const biomarkerInputs = Array.from(safeForm.querySelectorAll("input[required]"));
    function parse(name) {
      return Number(String(new FormData(safeForm).get(name) || "").replace(",", "."));
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
        const values = {
          age: parse("age"),
          albumin: parse("albumin"),
          creatinine: parse("creatinine"),
          glucose: parse("glucose"),
          crp: parse("crp"),
          lymphocyte: parse("lymphocyte"),
          mcv: parse("mcv"),
          rdw: parse("rdw"),
          alp: parse("alp"),
          wbc: parse("wbc")
        };
        const data = new FormData(safeForm);
        const units = {
          albuminUnit: String(data.get("albuminUnit")),
          creatinineUnit: String(data.get("creatinineUnit")),
          glucoseUnit: String(data.get("glucoseUnit")),
          crpUnit: String(data.get("crpUnit"))
        };
        const normalized = canonicalizePhenoAgeValues(values, units);
        if (normalized.crp <= 0) {
          showError("CRP musi by\u0107 wi\u0119ksze od zera, poniewa\u017C wz\xF3r wykorzystuje logarytm tego wyniku.");
          return;
        }
        const phenoAge = calculatePhenoAge(normalized);
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
        labelNode.textContent = describeAgeDifference(difference);
        if (difference < -0.05) {
          explanationNode.textContent = "Modelowy wynik jest ni\u017Cszy od wieku metrykalnego. Oznacza to korzystniejszy \u0142\u0105czny profil wprowadzonych danych w ramach tego wzoru, ale nie dowodzi, \u017Ce wszystkie narz\u0105dy s\u0105 m\u0142odsze.";
        } else if (difference > 0.05) {
          explanationNode.textContent = "Modelowy wynik jest wy\u017Cszy od wieku metrykalnego. Najwi\u0119cej sensu ma om\xF3wienie poszczeg\xF3lnych wynik\xF3w bada\u0144 z lekarzem, a nie pr\xF3ba obni\u017Cenia samej liczby PhenoAge.";
        } else {
          explanationNode.textContent = "Modelowy wynik jest zbli\u017Cony do wieku metrykalnego. Nadal warto interpretowa\u0107 ka\u017Cdy wynik laboratoryjny osobno i w odniesieniu do w\u0142asnego stanu zdrowia.";
        }
      } finally {
        if (button) button.disabled = false;
      }
    });
  })();
})();
