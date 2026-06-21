"use strict";
(() => {
  (function() {
    "use strict";
    const form = document.querySelector("[data-protein-form]");
    const errorNode = document.querySelector("[data-protein-error]");
    const emptyNode = document.querySelector("[data-protein-empty]");
    const contentNode = document.querySelector("[data-protein-content]");
    const blockedNode = document.querySelector("[data-protein-blocked]");
    const dailyRangeNode = document.querySelector("[data-daily-range]");
    const factorRangeNode = document.querySelector("[data-factor-range]");
    const mealRangeNode = document.querySelector("[data-meal-range]");
    const explanationNode = document.querySelector("[data-result-explanation]");
    const nextStepNode = document.querySelector("[data-result-next-step]");
    if (!form || !errorNode || !emptyNode || !contentNode || !blockedNode || !dailyRangeNode || !factorRangeNode || !mealRangeNode || !explanationNode || !nextStepNode) {
      return;
    }
    const proteinForm = form;
    const proteinErrorNode = errorNode;
    const proteinEmptyNode = emptyNode;
    const proteinContentNode = contentNode;
    const proteinBlockedNode = blockedNode;
    const trackedFields = Array.from(proteinForm.querySelectorAll('input[name="weight"], select'));
    function updateFieldState(field) {
      const fieldContainer = field.closest(".calculator-field");
      if (!fieldContainer) return;
      const hasValue = field.value.trim() !== "";
      const isComplete = hasValue && field.checkValidity();
      fieldContainer.classList.toggle("is-complete", isComplete);
    }
    trackedFields.forEach((field) => {
      updateFieldState(field);
      field.addEventListener("input", () => updateFieldState(field));
      field.addEventListener("change", () => updateFieldState(field));
    });
    function getFactors(activity, goal) {
      const activityRanges = {
        low: [1, 1.2],
        regular: [1.2, 1.4],
        strength: [1.2, 1.6]
      };
      let [minimumFactor, maximumFactor] = activityRanges[activity];
      if (goal === "muscle") {
        minimumFactor = Math.max(minimumFactor, 1.4);
        maximumFactor = 1.6;
      }
      if (goal === "reduction") {
        minimumFactor = Math.max(minimumFactor, 1.2);
        maximumFactor = 1.6;
      }
      return [minimumFactor, maximumFactor];
    }
    function calculateProtein(weight, activity, goal, meals) {
      const [minimumFactor, maximumFactor] = getFactors(activity, goal);
      const minimumDaily = Math.round(weight * minimumFactor);
      const maximumDaily = Math.round(weight * maximumFactor);
      return {
        minimumFactor,
        maximumFactor,
        minimumDaily,
        maximumDaily,
        minimumMeal: Math.round(minimumDaily / meals),
        maximumMeal: Math.round(maximumDaily / meals)
      };
    }
    function getExplanation(activity, goal) {
      if (goal === "muscle") {
        return "Wy\u017Cszy zakres wynika z celu budowania lub odbudowy mi\u0119\u015Bni. Samo bia\u0142ko nie zast\u0119puje treningu si\u0142owego, odpowiedniej ilo\u015Bci energii i regeneracji.";
      }
      if (goal === "reduction") {
        return "Podczas redukcji wy\u017Cszy udzia\u0142 bia\u0142ka mo\u017Ce u\u0142atwia\u0107 ochron\u0119 mi\u0119\u015Bni i syto\u015B\u0107. Zbyt du\u017Cy deficyt energii nadal mo\u017Ce jednak pogarsza\u0107 regeneracj\u0119.";
      }
      if (activity === "low") {
        return "To zakres startowy dla osoby po 50-tce z ma\u0142\u0105 aktywno\u015Bci\u0105. Regularny ruch lub trening si\u0142owy mog\u0105 przesun\u0105\u0107 potrzeby w g\xF3r\u0119.";
      }
      return "Zakres uwzgl\u0119dnia regularn\u0105 aktywno\u015B\u0107. W dni treningowe i przy zwi\u0119kszaniu obci\u0105\u017Ce\u0144 praktyczne zapotrzebowanie mo\u017Ce znajdowa\u0107 si\u0119 bli\u017Cej g\xF3rnej granicy.";
    }
    function showError(message) {
      proteinErrorNode.textContent = message;
      proteinErrorNode.hidden = false;
      proteinEmptyNode.hidden = false;
      proteinContentNode.hidden = true;
      proteinBlockedNode.hidden = true;
    }
    function clearError() {
      proteinErrorNode.textContent = "";
      proteinErrorNode.hidden = true;
    }
    proteinForm.addEventListener("submit", (event) => {
      event.preventDefault();
      clearError();
      const submitButton = proteinForm.querySelector('button[type="submit"]');
      if (submitButton) submitButton.disabled = true;
      try {
        const data = new FormData(proteinForm);
        const weight = Number(String(data.get("weight") || "").replace(",", "."));
        const activity = String(data.get("activity") || "");
        const goal = String(data.get("goal") || "");
        const meals = Number(data.get("meals"));
        const kidneyRestriction = data.get("kidney") === "on";
        if (!Number.isFinite(weight) || weight < 40 || weight > 250) {
          showError("Podaj mas\u0119 cia\u0142a od 40 do 250 kg.");
          return;
        }
        if (["low", "regular", "strength"].indexOf(activity) === -1) {
          showError("Wybierz poziom aktywno\u015Bci.");
          return;
        }
        if (["maintain", "muscle", "reduction"].indexOf(goal) === -1) {
          showError("Wybierz g\u0142\xF3wny cel.");
          return;
        }
        if ([3, 4, 5].indexOf(meals) === -1) {
          showError("Wybierz liczb\u0119 posi\u0142k\xF3w.");
          return;
        }
        proteinEmptyNode.hidden = true;
        if (kidneyRestriction) {
          proteinContentNode.hidden = true;
          proteinBlockedNode.hidden = false;
          return;
        }
        const result = calculateProtein(weight, activity, goal, meals);
        proteinBlockedNode.hidden = true;
        proteinContentNode.hidden = false;
        dailyRangeNode.textContent = `${result.minimumDaily}\u2013${result.maximumDaily}`;
        factorRangeNode.textContent = `${result.minimumFactor.toFixed(1).replace(".", ",")}\u2013${result.maximumFactor.toFixed(1).replace(".", ",")} g/kg`;
        mealRangeNode.textContent = `${result.minimumMeal}\u2013${result.maximumMeal} g`;
        explanationNode.textContent = getExplanation(activity, goal);
        nextStepNode.textContent = `Spr\xF3buj roz\u0142o\u017Cy\u0107 dzienny zakres na ${meals} podobne porcje. Zacznij od sprawdzenia jednego typowego dnia zamiast zmienia\u0107 od razu ca\u0142y jad\u0142ospis.`;
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });
  })();
})();
