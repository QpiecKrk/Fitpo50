import {
  calculateBmi,
  calculateWaistHeight,
  type WaistHeightLevel,
  type WaistHeightResult
} from './waist-height-core';

interface SavedMeasurement {
  id: string;
  date: string;
  heightCm: number;
  waistCm: number;
  ratio: number;
}

const STORAGE_KEY = 'fitpo50-waist-height-history-v1';
const form = document.querySelector<HTMLFormElement>('[data-whtr-form]');
const heightInput = document.querySelector<HTMLInputElement>('[data-whtr-height]');
const waistInput = document.querySelector<HTMLInputElement>('[data-whtr-waist]');
const weightInput = document.querySelector<HTMLInputElement>('[data-whtr-weight]');
const dateInput = document.querySelector<HTMLInputElement>('[data-whtr-date]');
const errorNode = document.querySelector<HTMLElement>('[data-whtr-error]');
const emptyNode = document.querySelector<HTMLElement>('[data-whtr-empty]');
const contentNode = document.querySelector<HTMLElement>('[data-whtr-content]');
const ratioNode = document.querySelector<HTMLElement>('[data-whtr-ratio]');
const levelNode = document.querySelector<HTMLElement>('[data-whtr-level]');
const headlineNode = document.querySelector<HTMLElement>('[data-whtr-headline]');
const explanationNode = document.querySelector<HTMLElement>('[data-whtr-explanation]');
const halfNode = document.querySelector<HTMLElement>('[data-whtr-half]');
const differenceNode = document.querySelector<HTMLElement>('[data-whtr-difference]');
const applicabilityNode = document.querySelector<HTMLElement>('[data-whtr-applicability]');
const saveButton = document.querySelector<HTMLButtonElement>('[data-whtr-save]');
const clearButton = document.querySelector<HTMLButtonElement>('[data-whtr-clear]');
const historyEmptyNode = document.querySelector<HTMLElement>('[data-whtr-history-empty]');
const historyTable = document.querySelector<HTMLTableElement>('[data-whtr-history-table]');
const historyBody = document.querySelector<HTMLTableSectionElement>('[data-whtr-history-body]');

let latestResult: WaistHeightResult | null = null;

function parseNumber(input: HTMLInputElement): number | null {
  const raw = input.value.trim();
  if (raw === '') return null;
  const value = Number(raw.replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

function readHistory(): SavedMeasurement[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is SavedMeasurement => {
      if (typeof item !== 'object' || item === null) return false;
      const candidate = item as Record<string, unknown>;
      return typeof candidate.id === 'string'
        && typeof candidate.date === 'string'
        && typeof candidate.heightCm === 'number'
        && typeof candidate.waistCm === 'number'
        && typeof candidate.ratio === 'number';
    }).slice(-12);
  } catch (_) {
    return [];
  }
}

function writeHistory(items: SavedMeasurement[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(-12)));
  } catch (_) {
    if (errorNode) {
      errorNode.textContent = 'Przeglądarka nie pozwoliła zapisać historii na tym urządzeniu.';
      errorNode.hidden = false;
    }
  }
}

function formatDate(date: string): string {
  const parts = date.split('-');
  return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : date;
}

function renderHistory(): void {
  if (!historyEmptyNode || !historyTable || !historyBody || !clearButton) return;
  const items = readHistory().sort((a, b) => a.date.localeCompare(b.date));
  historyBody.replaceChildren();
  historyEmptyNode.hidden = items.length > 0;
  historyTable.hidden = items.length === 0;
  clearButton.hidden = items.length === 0;

  items.forEach((item, index) => {
    const previous = index > 0 ? items[index - 1] : null;
    const change = previous ? item.waistCm - previous.waistCm : null;
    const row = document.createElement('tr');
    const dateCell = document.createElement('th');
    dateCell.scope = 'row';
    dateCell.textContent = formatDate(item.date);
    const waistCell = document.createElement('td');
    waistCell.textContent = `${item.waistCm.toLocaleString('pl-PL', { maximumFractionDigits: 1 })} cm`;
    const ratioCell = document.createElement('td');
    ratioCell.textContent = item.ratio.toFixed(2).replace('.', ',');
    const changeCell = document.createElement('td');
    changeCell.textContent = change === null
      ? '—'
      : `${change > 0 ? '+' : ''}${change.toLocaleString('pl-PL', { maximumFractionDigits: 1 })} cm`;
    row.append(dateCell, waistCell, ratioCell, changeCell);
    historyBody.appendChild(row);
  });
}

function getLevelCopy(level: WaistHeightLevel): { label: string; headline: string; explanation: string } {
  const copy: Record<WaistHeightLevel, { label: string; headline: string; explanation: string }> = {
    'below-range': {
      label: 'Poniżej zakresu klasyfikacji',
      headline: 'Wynik jest niższy niż zakres opisany przez NICE',
      explanation: 'NICE rozpoczyna klasyfikację centralnego otłuszczenia od wyniku 0,40. Niska wartość sama nie rozpoznaje problemu, ale niezamierzony spadek masy lub obwodu warto omówić ze specjalistą.'
    },
    healthy: {
      label: 'Poniżej połowy wzrostu',
      headline: 'Wynik nie wskazuje na zwiększone ryzyko związane z centralnym otłuszczeniem',
      explanation: 'Zakres 0,40–0,49 NICE opisuje jako zdrowy poziom centralnego otłuszczenia. Nie oznacza to braku wszystkich innych czynników ryzyka.'
    },
    increased: {
      label: 'Podwyższony',
      headline: 'Obwód talii przekracza połowę wzrostu',
      explanation: 'Zakres 0,50–0,59 wskazuje na zwiększone ryzyko zdrowotne związane z centralnym otłuszczeniem. To sygnał do oceny także ciśnienia, glikemii i lipidów.'
    },
    high: {
      label: 'Wysoki',
      headline: 'Wynik wskazuje na wysoki poziom centralnego otłuszczenia',
      explanation: 'Wartość 0,60 lub wyższa oznacza według NICE dalszy wzrost ryzyka. Wynik przesiewowy warto omówić z lekarzem i zestawić z pozostałymi czynnikami ryzyka.'
    }
  };
  return copy[level];
}

if (form && heightInput && waistInput && weightInput && dateInput && errorNode && emptyNode && contentNode && ratioNode && levelNode && headlineNode && explanationNode && halfNode && differenceNode && applicabilityNode && saveButton) {
  const safeForm = form;
  const safeHeightInput = heightInput;
  const safeWaistInput = waistInput;
  const safeWeightInput = weightInput;
  const safeDateInput = dateInput;
  const safeErrorNode = errorNode;
  const safeEmptyNode = emptyNode;
  const safeContentNode = contentNode;

  safeDateInput.value = new Date().toISOString().slice(0, 10);

  safeForm.addEventListener('input', () => {
    safeEmptyNode.hidden = false;
    safeContentNode.hidden = true;
    latestResult = null;
  });

  safeForm.addEventListener('submit', (event) => {
    event.preventDefault();
    safeErrorNode.hidden = true;
    const heightCm = parseNumber(safeHeightInput);
    const waistCm = parseNumber(safeWaistInput);
    const weightKg = parseNumber(safeWeightInput);

    if (heightCm === null || heightCm < 120 || heightCm > 230) {
      safeErrorNode.textContent = 'Podaj wzrost od 120 do 230 cm.';
      safeErrorNode.hidden = false;
      return;
    }
    if (waistCm === null || waistCm < 40 || waistCm > 250) {
      safeErrorNode.textContent = 'Podaj obwód talii od 40 do 250 cm.';
      safeErrorNode.hidden = false;
      return;
    }
    if (weightKg !== null && (weightKg < 30 || weightKg > 350)) {
      safeErrorNode.textContent = 'Opcjonalna masa ciała powinna mieścić się od 30 do 350 kg.';
      safeErrorNode.hidden = false;
      return;
    }

    const result = calculateWaistHeight(heightCm, waistCm);
    const copy = getLevelCopy(result.level);
    latestResult = result;
    ratioNode.textContent = result.ratio.toFixed(2).replace('.', ',');
    levelNode.textContent = copy.label;
    headlineNode.textContent = copy.headline;
    explanationNode.textContent = copy.explanation;
    halfNode.textContent = `${result.halfHeightCm.toLocaleString('pl-PL', { maximumFractionDigits: 1 })} cm`;
    const differenceAbs = Math.abs(result.differenceFromHalfCm).toLocaleString('pl-PL', { maximumFractionDigits: 1 });
    differenceNode.textContent = result.differenceFromHalfCm > 0
      ? `${differenceAbs} cm powyżej połowy wzrostu`
      : result.differenceFromHalfCm < 0
        ? `${differenceAbs} cm poniżej połowy wzrostu`
        : 'dokładnie połowa wzrostu';

    if (weightKg === null) {
      applicabilityNode.textContent = 'Klasyfikację NICE stosuje się przede wszystkim u dorosłych z BMI poniżej 35. Bez masy ciała nie możemy sprawdzić tego warunku.';
    } else {
      const bmi = calculateBmi(heightCm, weightKg);
      applicabilityNode.textContent = bmi < 35
        ? `Podana masa ciała daje BMI ${bmi.toFixed(1).replace('.', ',')}. Klasyfikacja WHtR NICE obejmuje dorosłych z BMI poniżej 35.`
        : `Podana masa ciała daje BMI ${bmi.toFixed(1).replace('.', ',')}. Przy BMI 35 lub wyższym NICE nie opiera oceny centralnego otłuszczenia na samym WHtR.`;
    }

    safeEmptyNode.hidden = true;
    safeContentNode.hidden = false;
  });

  saveButton.addEventListener('click', () => {
    const heightCm = parseNumber(safeHeightInput);
    const waistCm = parseNumber(safeWaistInput);
    if (!latestResult || heightCm === null || waistCm === null || !safeDateInput.value) return;
    const items = readHistory();
    items.push({
      id: `${safeDateInput.value}-${Date.now()}`,
      date: safeDateInput.value,
      heightCm,
      waistCm,
      ratio: latestResult.ratio
    });
    writeHistory(items);
    renderHistory();
    saveButton.textContent = 'Pomiar zapisany ✓';
    window.setTimeout(() => { saveButton.textContent = 'Zapisz pomiar na tym urządzeniu'; }, 1800);
  });
}

if (clearButton) {
  clearButton.addEventListener('click', () => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
    renderHistory();
  });
}

renderHistory();
