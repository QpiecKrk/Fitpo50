(function () {
  'use strict';

  type Activity = 'low' | 'regular' | 'strength';
  type Goal = 'maintain' | 'muscle' | 'reduction';

  type ProteinRange = {
    minimumFactor: number;
    maximumFactor: number;
    minimumDaily: number;
    maximumDaily: number;
    minimumMeal: number;
    maximumMeal: number;
  };

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
  const trackedFields = Array.from(proteinForm.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input[name="weight"], select'));

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

  function getFactors(activity: Activity, goal: Goal): [number, number] {
    const activityRanges: Record<Activity, [number, number]> = {
      low: [1.0, 1.2],
      regular: [1.2, 1.4],
      strength: [1.2, 1.6]
    };

    let [minimumFactor, maximumFactor] = activityRanges[activity];

    if (goal === 'muscle') {
      minimumFactor = Math.max(minimumFactor, 1.4);
      maximumFactor = 1.6;
    }

    if (goal === 'reduction') {
      minimumFactor = Math.max(minimumFactor, 1.2);
      maximumFactor = 1.6;
    }

    return [minimumFactor, maximumFactor];
  }

  function calculateProtein(weight: number, activity: Activity, goal: Goal, meals: number): ProteinRange {
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

  function getExplanation(activity: Activity, goal: Goal): string {
    if (goal === 'muscle') {
      return 'Wyższy zakres wynika z celu budowania lub odbudowy mięśni. Samo białko nie zastępuje treningu siłowego, odpowiedniej ilości energii i regeneracji.';
    }

    if (goal === 'reduction') {
      return 'Podczas redukcji wyższy udział białka może ułatwiać ochronę mięśni i sytość. Zbyt duży deficyt energii nadal może jednak pogarszać regenerację.';
    }

    if (activity === 'low') {
      return 'To zakres startowy dla osoby po 50-tce z małą aktywnością. Regularny ruch lub trening siłowy mogą przesunąć potrzeby w górę.';
    }

    return 'Zakres uwzględnia regularną aktywność. W dni treningowe i przy zwiększaniu obciążeń praktyczne zapotrzebowanie może znajdować się bliżej górnej granicy.';
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

  proteinForm.addEventListener('submit', (event) => {
    event.preventDefault();
    clearError();

    const submitButton = proteinForm.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    try {
      const data = new FormData(proteinForm);
      const weight = Number(String(data.get('weight') || '').replace(',', '.'));
      const activity = String(data.get('activity') || '') as Activity;
      const goal = String(data.get('goal') || '') as Goal;
      const meals = Number(data.get('meals'));
      const kidneyRestriction = data.get('kidney') === 'on';

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

      const result = calculateProtein(weight, activity, goal, meals);
      proteinBlockedNode.hidden = true;
      proteinContentNode.hidden = false;
      dailyRangeNode.textContent = `${result.minimumDaily}–${result.maximumDaily}`;
      factorRangeNode.textContent = `${result.minimumFactor.toFixed(1).replace('.', ',')}–${result.maximumFactor.toFixed(1).replace('.', ',')} g/kg`;
      mealRangeNode.textContent = `${result.minimumMeal}–${result.maximumMeal} g`;
      explanationNode.textContent = getExplanation(activity, goal);
      nextStepNode.textContent = `Spróbuj rozłożyć dzienny zakres na ${meals} podobne porcje. Zacznij od sprawdzenia jednego typowego dnia zamiast zmieniać od razu cały jadłospis.`;
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
})();
