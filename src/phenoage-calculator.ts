import {
  calculatePhenoAge,
  canonicalizePhenoAgeValues,
  describeAgeDifference,
  type PhenoAgeUnits,
  type PhenoAgeValues
} from './phenoage-core';

(function () {
  'use strict';

  const form = document.querySelector<HTMLFormElement>('[data-pheno-form]');
  const errorNode = document.querySelector<HTMLElement>('[data-pheno-error]');
  const emptyNode = document.querySelector<HTMLElement>('[data-pheno-empty]');
  const contentNode = document.querySelector<HTMLElement>('[data-pheno-content]');
  const progressLabel = document.querySelector<HTMLElement>('[data-pheno-progress-label]');
  const progressBar = document.querySelector<HTMLElement>('[data-pheno-progress-bar]');
  const ageNode = document.querySelector<HTMLElement>('[data-pheno-age]');
  const chronoNode = document.querySelector<HTMLElement>('[data-chrono-age]');
  const differenceNode = document.querySelector<HTMLElement>('[data-age-difference]');
  const labelNode = document.querySelector<HTMLElement>('[data-age-label]');
  const explanationNode = document.querySelector<HTMLElement>('[data-pheno-explanation]');

  if (!form || !errorNode || !emptyNode || !contentNode || !progressLabel || !progressBar || !ageNode || !chronoNode || !differenceNode || !labelNode || !explanationNode) {
    return;
  }

  const safeForm = form;
  const safeError = errorNode;
  const safeEmpty = emptyNode;
  const safeContent = contentNode;
  const safeProgressLabel = progressLabel;
  const safeProgressBar = progressBar;
  const biomarkerInputs = Array.from(safeForm.querySelectorAll<HTMLInputElement>('input[required]'));

  function parse(name: string): number {
    return Number(String(new FormData(safeForm).get(name) || '').replace(',', '.'));
  }

  function updateProgress(): void {
    let complete = 0;
    biomarkerInputs.forEach((input) => {
      const card = input.closest('.pheno-field');
      const valid = input.value.trim() !== '' && input.checkValidity();
      if (valid) complete += 1;
      if (card) card.classList.toggle('is-complete', valid);
    });
    safeProgressLabel.textContent = `${complete} / 10`;
    safeProgressBar.style.width = `${complete * 10}%`;
  }

  biomarkerInputs.forEach((input) => {
    input.addEventListener('input', updateProgress);
    input.addEventListener('change', updateProgress);
  });
  updateProgress();

  function showError(message: string): void {
    safeError.textContent = message;
    safeError.hidden = false;
    safeEmpty.hidden = false;
    safeContent.hidden = true;
  }

  safeForm.addEventListener('submit', (event) => {
    event.preventDefault();
    safeError.hidden = true;
    const button = safeForm.querySelector<HTMLButtonElement>('[data-pheno-submit]');
    if (button) button.disabled = true;

    try {
      if (!safeForm.checkValidity()) {
        showError('Uzupełnij wszystkie pola i sprawdź, czy wartości mieszczą się w dozwolonym zakresie.');
        safeForm.reportValidity();
        return;
      }

      const values: PhenoAgeValues = {
        age: parse('age'),
        albumin: parse('albumin'),
        creatinine: parse('creatinine'),
        glucose: parse('glucose'),
        crp: parse('crp'),
        lymphocyte: parse('lymphocyte'),
        mcv: parse('mcv'),
        rdw: parse('rdw'),
        alp: parse('alp'),
        wbc: parse('wbc')
      };
      const data = new FormData(safeForm);
      const units: PhenoAgeUnits = {
        albuminUnit: String(data.get('albuminUnit')) as PhenoAgeUnits['albuminUnit'],
        creatinineUnit: String(data.get('creatinineUnit')) as PhenoAgeUnits['creatinineUnit'],
        glucoseUnit: String(data.get('glucoseUnit')) as PhenoAgeUnits['glucoseUnit'],
        crpUnit: String(data.get('crpUnit')) as PhenoAgeUnits['crpUnit']
      };
      const normalized = canonicalizePhenoAgeValues(values, units);

      if (normalized.crp <= 0) {
        showError('CRP musi być większe od zera, ponieważ wzór wykorzystuje logarytm tego wyniku.');
        return;
      }

      const phenoAge = calculatePhenoAge(normalized);
      if (!Number.isFinite(phenoAge)) {
        showError('Nie udało się obliczyć wyniku. Sprawdź wartości i jednostki.');
        return;
      }

      const rounded = Math.round(phenoAge * 10) / 10;
      const difference = Math.round((rounded - values.age) * 10) / 10;
      safeEmpty.hidden = true;
      safeContent.hidden = false;
      ageNode.textContent = rounded.toFixed(1).replace('.', ',');
      chronoNode.textContent = `${values.age} lat`;
      differenceNode.textContent = `${difference > 0 ? '+' : ''}${difference.toFixed(1).replace('.', ',')} lat`;
      labelNode.textContent = describeAgeDifference(difference);

      if (difference < -0.05) {
        explanationNode.textContent = 'Modelowy wynik jest niższy od wieku metrykalnego. Oznacza to korzystniejszy łączny profil wprowadzonych danych w ramach tego wzoru, ale nie dowodzi, że wszystkie narządy są młodsze.';
      } else if (difference > 0.05) {
        explanationNode.textContent = 'Modelowy wynik jest wyższy od wieku metrykalnego. Najwięcej sensu ma omówienie poszczególnych wyników badań z lekarzem, a nie próba obniżenia samej liczby PhenoAge.';
      } else {
        explanationNode.textContent = 'Modelowy wynik jest zbliżony do wieku metrykalnego. Nadal warto interpretować każdy wynik laboratoryjny osobno i w odniesieniu do własnego stanu zdrowia.';
      }
    } finally {
      if (button) button.disabled = false;
    }
  });
})();
