import { calculateNonHdl, parseLocalizedNumber, validateLipidValues } from './lipid-markers-core';

type LipidUnit = 'mgdl' | 'mmoll';

const form = document.querySelector<HTMLFormElement>('[data-lipid-form]');

if (form) {
  const unit = form.querySelector<HTMLSelectElement>('[data-lipid-unit]');
  const total = form.querySelector<HTMLInputElement>('[data-lipid-total]');
  const hdl = form.querySelector<HTMLInputElement>('[data-lipid-hdl]');
  const error = form.querySelector<HTMLElement>('[data-lipid-error]');
  const empty = document.querySelector<HTMLElement>('[data-lipid-empty]');
  const content = document.querySelector<HTMLElement>('[data-lipid-content]');
  const result = document.querySelector<HTMLElement>('[data-lipid-result]');
  const resultUnit = document.querySelector<HTMLElement>('[data-lipid-result-unit]');
  const totalCopy = document.querySelector<HTMLElement>('[data-lipid-total-copy]');
  const hdlCopy = document.querySelector<HTMLElement>('[data-lipid-hdl-copy]');
  const resultCopy = document.querySelector<HTMLElement>('[data-lipid-result-copy]');
  const unitLabels = Array.from(document.querySelectorAll<HTMLElement>('[data-lipid-unit-label]'));

  const format = (value: number): string => value.toLocaleString('pl-PL', { maximumFractionDigits: 1 });
  const unitText = (): string => unit?.value === 'mmoll' ? 'mmol/l' : 'mg/dl';

  unit?.addEventListener('change', () => {
    unitLabels.forEach((label) => { label.textContent = unitText(); });
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const selectedUnit = (unit?.value === 'mmoll' ? 'mmoll' : 'mgdl') as LipidUnit;
    const totalValue = parseLocalizedNumber(total?.value ?? '');
    const hdlValue = parseLocalizedNumber(hdl?.value ?? '');
    const message = validateLipidValues(totalValue, hdlValue, selectedUnit);

    if (message) {
      if (error) { error.textContent = message; error.hidden = false; }
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
