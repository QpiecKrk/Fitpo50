import {
  calculateProtein,
  type ProteinActivity,
  type ProteinGoal
} from './protein-core';

(function () {
  'use strict';

  const form = document.querySelector<HTMLFormElement>('[data-protein-form]');
  const errorNode = document.querySelector<HTMLElement>('[data-protein-error]');
  const emptyNode = document.querySelector<HTMLElement>('[data-protein-empty]');
  const contentNode = document.querySelector<HTMLElement>('[data-protein-content]');
  const blockedNode = document.querySelector<HTMLElement>('[data-protein-blocked]');
  const dailyRangeNode = document.querySelector<HTMLElement>('[data-daily-range]');
  const factorRangeNode = document.querySelector<HTMLElement>('[data-factor-range]');
  const mealRangeNode = document.querySelector<HTMLElement>('[data-meal-range]');
  const explanationNode = document.querySelector<HTMLElement>('[data-result-explanation]');
  const nextStepNode = document.querySelector<HTMLElement>('[data-result-next-step]');

  if (!form || !errorNode || !emptyNode || !contentNode || !blockedNode || !dailyRangeNode || !factorRangeNode || !mealRangeNode || !explanationNode || !nextStepNode) {
    return;
  }

  const proteinForm = form;
  const proteinErrorNode = errorNode;
  const proteinEmptyNode = emptyNode;
  const proteinContentNode = contentNode;
  const proteinBlockedNode = blockedNode;
  const trackedFields = Array.from(proteinForm.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input[name="age"], input[name="weight"], select'));

  function updateFieldState(field: HTMLInputElement | HTMLSelectElement): void {
    const fieldContainer = field.closest('.calculator-field');
    if (!fieldContainer) return;

    const hasValue = field.value.trim() !== '';
    const isComplete = hasValue && field.checkValidity();
    fieldContainer.classList.toggle('is-complete', isComplete);
  }

  trackedFields.forEach((field) => {
    updateFieldState(field);
    field.addEventListener('input', () => updateFieldState(field));
    field.addEventListener('change', () => updateFieldState(field));
  });

  function getExplanation(age: number, activity: ProteinActivity, goal: ProteinGoal): string {
    if (goal === 'muscle') {
      return 'Zakres uwzględnia cel budowania lub odbudowy mięśni. Samo białko nie zastępuje treningu siłowego, odpowiedniej ilości energii i regeneracji.';
    }

    if (goal === 'reduction') {
      return 'Podczas redukcji taki zakres bywa stosowany w planach mających ograniczać utratę mięśni. Zbyt duży deficyt energii nadal może pogarszać regenerację.';
    }

    if (activity === 'low') {
      return age >= 65
        ? 'To zakres zalecany zdrowym osobom starszym z małą aktywnością. Choroba, niedożywienie lub leczenie wymagają indywidualnego ustalenia celu.'
        : 'To ostrożny zakres startowy dla osoby w wieku 50–64 lat z małą aktywnością. Dolna granica odpowiada europejskiej wartości referencyjnej dla zdrowych dorosłych.';
    }

    return 'Zakres uwzględnia regularną aktywność. To punkt do planowania jadłospisu, a nie granica, do której trzeba dobijać każdego dnia.';
  }

  function showError(message: string): void {
    proteinErrorNode.textContent = message;
    proteinErrorNode.hidden = false;
    proteinEmptyNode.hidden = false;
    proteinContentNode.hidden = true;
    proteinBlockedNode.hidden = true;
  }

  function clearError(): void {
    proteinErrorNode.textContent = '';
    proteinErrorNode.hidden = true;
  }

  function formatFactor(value: number): string {
    return value.toLocaleString('pl-PL', { maximumFractionDigits: 2 });
  }

  proteinForm.addEventListener('submit', (event) => {
    event.preventDefault();
    clearError();

    const submitButton = proteinForm.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    try {
      const data = new FormData(proteinForm);
      const age = Number(data.get('age'));
      const weight = Number(String(data.get('weight') || '').replace(',', '.'));
      const activity = String(data.get('activity') || '') as ProteinActivity;
      const goal = String(data.get('goal') || '') as ProteinGoal;
      const meals = Number(data.get('meals'));
      const kidneyRestriction = data.get('kidney') === 'on';

      if (!Number.isInteger(age) || age < 50 || age > 120) {
        showError('Podaj wiek od 50 do 120 lat.');
        return;
      }

      if (!Number.isFinite(weight) || weight < 40 || weight > 250) {
        showError('Podaj masę ciała od 40 do 250 kg.');
        return;
      }

      if (['low', 'regular', 'strength'].indexOf(activity) === -1) {
        showError('Wybierz poziom aktywności.');
        return;
      }

      if (['maintain', 'muscle', 'reduction'].indexOf(goal) === -1) {
        showError('Wybierz główny cel.');
        return;
      }

      if ([3, 4, 5].indexOf(meals) === -1) {
        showError('Wybierz liczbę posiłków.');
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
      dailyRangeNode.textContent = `${result.minimumDaily}–${result.maximumDaily}`;
      factorRangeNode.textContent = `${formatFactor(result.minimumFactor)}–${formatFactor(result.maximumFactor)} g/kg`;
      mealRangeNode.textContent = `${result.minimumMeal}–${result.maximumMeal} g`;
      explanationNode.textContent = getExplanation(age, activity, goal);
      nextStepNode.textContent = `Podział ${result.minimumMeal}–${result.maximumMeal} g na posiłek to tylko równe dzielenie wyniku przez ${meals}. Zacznij od sprawdzenia jednego typowego dnia zamiast zmieniać od razu cały jadłospis.`;
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
})();
