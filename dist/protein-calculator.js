"use strict";
(() => {
  // src/protein-core.ts
  function getProteinFactors(age, activity, goal) {
    const isOlderAdult = age >= 65;
    if (activity === "strength" || goal === "muscle" || goal === "reduction") {
      return [1.2, 1.5];
    }
    if (activity === "regular") {
      return isOlderAdult ? [1.2, 1.5] : [1, 1.2];
    }
    return isOlderAdult ? [1, 1.2] : [0.83, 1];
  }
  function calculateProtein(input) {
    const [minimumFactor, maximumFactor] = getProteinFactors(input.age, input.activity, input.goal);
    const minimumDaily = Math.round(input.weight * minimumFactor);
    const maximumDaily = Math.round(input.weight * maximumFactor);
    return {
      minimumFactor,
      maximumFactor,
      minimumDaily,
      maximumDaily,
      minimumMeal: Math.round(minimumDaily / input.meals),
      maximumMeal: Math.round(maximumDaily / input.meals)
    };
  }

  // src/protein-calculator.ts
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
    const trackedFields = Array.from(proteinForm.querySelectorAll('input[name="age"], input[name="weight"], select'));
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
    function getExplanation(age, activity, goal) {
      if (goal === "muscle") {
        return "Zakres uwzgl\u0119dnia cel budowania lub odbudowy mi\u0119\u015Bni. Samo bia\u0142ko nie zast\u0119puje treningu si\u0142owego, odpowiedniej ilo\u015Bci energii i regeneracji.";
      }
      if (goal === "reduction") {
        return "Podczas redukcji taki zakres bywa stosowany w planach maj\u0105cych ogranicza\u0107 utrat\u0119 mi\u0119\u015Bni. Zbyt du\u017Cy deficyt energii nadal mo\u017Ce pogarsza\u0107 regeneracj\u0119.";
      }
      if (activity === "low") {
        return age >= 65 ? "To zakres zalecany zdrowym osobom starszym z ma\u0142\u0105 aktywno\u015Bci\u0105. Choroba, niedo\u017Cywienie lub leczenie wymagaj\u0105 indywidualnego ustalenia celu." : "To ostro\u017Cny zakres startowy dla osoby w wieku 50\u201364 lat z ma\u0142\u0105 aktywno\u015Bci\u0105. Dolna granica odpowiada europejskiej warto\u015Bci referencyjnej dla zdrowych doros\u0142ych.";
      }
      return "Zakres uwzgl\u0119dnia regularn\u0105 aktywno\u015B\u0107. To punkt do planowania jad\u0142ospisu, a nie granica, do kt\xF3rej trzeba dobija\u0107 ka\u017Cdego dnia.";
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
    function formatFactor(value) {
      return value.toLocaleString("pl-PL", { maximumFractionDigits: 2 });
    }
    proteinForm.addEventListener("submit", (event) => {
      event.preventDefault();
      clearError();
      const submitButton = proteinForm.querySelector('button[type="submit"]');
      if (submitButton) submitButton.disabled = true;
      try {
        const data = new FormData(proteinForm);
        const age = Number(data.get("age"));
        const weight = Number(String(data.get("weight") || "").replace(",", "."));
        const activity = String(data.get("activity") || "");
        const goal = String(data.get("goal") || "");
        const meals = Number(data.get("meals"));
        const kidneyRestriction = data.get("kidney") === "on";
        if (!Number.isInteger(age) || age < 50 || age > 120) {
          showError("Podaj wiek od 50 do 120 lat.");
          return;
        }
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
        const result = calculateProtein({ age, weight, activity, goal, meals });
        proteinBlockedNode.hidden = true;
        proteinContentNode.hidden = false;
        dailyRangeNode.textContent = `${result.minimumDaily}\u2013${result.maximumDaily}`;
        factorRangeNode.textContent = `${formatFactor(result.minimumFactor)}\u2013${formatFactor(result.maximumFactor)} g/kg`;
        mealRangeNode.textContent = `${result.minimumMeal}\u2013${result.maximumMeal} g`;
        explanationNode.textContent = getExplanation(age, activity, goal);
        nextStepNode.textContent = `Podzia\u0142 ${result.minimumMeal}\u2013${result.maximumMeal} g na posi\u0142ek to tylko r\xF3wne dzielenie wyniku przez ${meals}. Zacznij od sprawdzenia jednego typowego dnia zamiast zmienia\u0107 od razu ca\u0142y jad\u0142ospis.`;
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });
  })();
})();
