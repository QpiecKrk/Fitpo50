import {
  calculateRelativeStrength,
  describeEstimateQuality,
  strengthChangePercent,
  type RelativeStrengthResult,
  type SetEffort,
  type StrengthEquipment
} from './relative-strength-core';

interface StrengthHistoryItem {
  id: string;
  date: string;
  exercise: string;
  exerciseLabel: string;
  equipment: StrengthEquipment;
  bodyWeightKg: number;
  loadKg: number;
  repetitions: number;
  estimatedOneRepMaxKg: number;
  relativeStrength: number;
  createdAt: number;
}

const STORAGE_KEY = 'fitpo50.relative-strength.v1';
const SVG_NS = 'http://www.w3.org/2000/svg';

const form = document.querySelector<HTMLFormElement>('[data-strength-form]');
const exerciseInput = document.querySelector<HTMLSelectElement>('[data-strength-exercise]');
const equipmentInput = document.querySelector<HTMLSelectElement>('[data-strength-equipment]');
const bodyWeightInput = document.querySelector<HTMLInputElement>('[data-strength-body-weight]');
const loadInput = document.querySelector<HTMLInputElement>('[data-strength-load]');
const repetitionsInput = document.querySelector<HTMLInputElement>('[data-strength-repetitions]');
const dateInput = document.querySelector<HTMLInputElement>('[data-strength-date]');
const equipmentHint = document.querySelector<HTMLElement>('[data-strength-equipment-hint]');
const errorNode = document.querySelector<HTMLElement>('[data-strength-error]');
const emptyNode = document.querySelector<HTMLElement>('[data-strength-empty]');
const contentNode = document.querySelector<HTMLElement>('[data-strength-content]');
const oneRepMaxNode = document.querySelector<HTMLElement>('[data-strength-one-rep-max]');
const ratioNode = document.querySelector<HTMLElement>('[data-strength-ratio]');
const bodyPercentNode = document.querySelector<HTMLElement>('[data-strength-body-percent]');
const workingPercentNode = document.querySelector<HTMLElement>('[data-strength-working-percent]');
const seriesNode = document.querySelector<HTMLElement>('[data-strength-series]');
const estimateCopyNode = document.querySelector<HTMLElement>('[data-strength-estimate-copy]');
const qualityNode = document.querySelector<HTMLElement>('[data-strength-quality]');
const qualityCopyNode = document.querySelector<HTMLElement>('[data-strength-quality-copy]');
const resultExerciseNode = document.querySelector<HTMLElement>('[data-strength-result-exercise]');
const saveButton = document.querySelector<HTMLButtonElement>('[data-strength-save]');
const clearButton = document.querySelector<HTMLButtonElement>('[data-strength-clear]');
const historyEmptyNode = document.querySelector<HTMLElement>('[data-strength-history-empty]');
const historyTable = document.querySelector<HTMLTableElement>('[data-strength-history-table]');
const historyBody = document.querySelector<HTMLTableSectionElement>('[data-strength-history-body]');
const chart = document.querySelector<SVGSVGElement>('[data-strength-chart]');
const chartEmpty = document.querySelector<HTMLElement>('[data-strength-chart-empty]');
const chartTitle = document.querySelector<HTMLElement>('[data-strength-chart-title]');

let latestResult: RelativeStrengthResult | null = null;

function parseNumber(input: HTMLInputElement): number | null {
  const normalized = input.value.trim().replace(',', '.');
  if (!normalized) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function getEquipment(): StrengthEquipment {
  const value = equipmentInput?.value;
  if (value === 'dumbbells' || value === 'machine' || value === 'other') return value;
  return 'barbell';
}

function getEffort(): SetEffort {
  const checked = document.querySelector<HTMLInputElement>('input[name="strength-effort"]:checked');
  return checked?.value === 'near-limit' ? 'near-limit' : 'not-near';
}

function getExerciseLabel(): string {
  const selected = exerciseInput?.selectedOptions.item(0);
  return selected?.textContent?.trim() || 'Inne ćwiczenie';
}

function isHistoryItem(value: unknown): value is StrengthHistoryItem {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Partial<StrengthHistoryItem>;
  return typeof item.id === 'string'
    && typeof item.date === 'string'
    && typeof item.exercise === 'string'
    && typeof item.exerciseLabel === 'string'
    && typeof item.bodyWeightKg === 'number'
    && typeof item.loadKg === 'number'
    && typeof item.repetitions === 'number'
    && typeof item.estimatedOneRepMaxKg === 'number'
    && typeof item.relativeStrength === 'number'
    && typeof item.createdAt === 'number'
    && (item.equipment === 'barbell' || item.equipment === 'dumbbells' || item.equipment === 'machine' || item.equipment === 'other');
}

function readHistory(): StrengthHistoryItem[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter(isHistoryItem) : [];
  } catch (_) {
    return [];
  }
}

function writeHistory(items: StrengthHistoryItem[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(-40)));
  } catch (_) {}
}

function formatDate(value: string): string {
  const parts = value.split('-');
  return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : value;
}

function formatKg(value: number): string {
  return `${value.toLocaleString('pl-PL', { maximumFractionDigits: 1 })} kg`;
}

function updateEquipmentHint(): void {
  if (!equipmentHint) return;
  const copy: Record<StrengthEquipment, string> = {
    barbell: 'Wpisz łączną masę gryfu i wszystkich talerzy.',
    dumbbells: 'Wpisz sumę obu hantli, np. 2 × 12 kg = 24 kg.',
    machine: 'Wpisz wartość ustawioną na stosie. Porównuj tylko tę samą maszynę.',
    other: 'Wpisuj ciężar zawsze w ten sam sposób przy kolejnych pomiarach.'
  };
  equipmentHint.textContent = copy[getEquipment()];
}

function createSvgElement<K extends keyof SVGElementTagNameMap>(name: K): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NS, name);
}

function renderChart(items: StrengthHistoryItem[]): void {
  if (!chart || !chartEmpty || !chartTitle || !exerciseInput) return;
  const exercise = exerciseInput.value;
  const exerciseLabel = getExerciseLabel();
  const recent = items
    .filter((item) => item.exercise === exercise)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
    .slice(-8);
  chart.replaceChildren();
  chart.toggleAttribute('hidden', recent.length === 0);
  chartEmpty.hidden = recent.length > 0;
  chartTitle.textContent = recent.length > 0 ? `Trend: ${exerciseLabel}` : 'Trend wybranego ćwiczenia';
  if (recent.length === 0) return;

  const title = createSvgElement('title');
  title.textContent = `Szacowane maksimum dla ćwiczenia ${exerciseLabel}. Im wyżej znajduje się punkt, tym większy wynik.`;
  chart.appendChild(title);
  const left = 42;
  const right = 638;
  const top = 24;
  const bottom = 166;
  const values = recent.map((item) => item.estimatedOneRepMaxKg);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const range = Math.max(rawMax - rawMin, Math.max(rawMax * 0.1, 5));
  const min = rawMin - ((range - (rawMax - rawMin)) / 2);
  const max = rawMax + ((range - (rawMax - rawMin)) / 2);

  [top, (top + bottom) / 2, bottom].forEach((y) => {
    const line = createSvgElement('line');
    line.setAttribute('x1', String(left));
    line.setAttribute('x2', String(right));
    line.setAttribute('y1', String(y));
    line.setAttribute('y2', String(y));
    line.setAttribute('class', 'strength-chart__grid');
    chart.appendChild(line);
  });

  const points = recent.map((item, index) => {
    const x = recent.length === 1 ? (left + right) / 2 : left + ((right - left) * index / (recent.length - 1));
    const y = bottom - ((item.estimatedOneRepMaxKg - min) / (max - min)) * (bottom - top);
    return { item, x, y };
  });
  if (points.length > 1) {
    const polyline = createSvgElement('polyline');
    polyline.setAttribute('points', points.map((point) => `${point.x},${point.y}`).join(' '));
    polyline.setAttribute('class', 'strength-chart__line');
    chart.appendChild(polyline);
  }
  points.forEach(({ item, x, y }) => {
    const circle = createSvgElement('circle');
    circle.setAttribute('cx', String(x));
    circle.setAttribute('cy', String(y));
    circle.setAttribute('r', '7');
    circle.setAttribute('class', 'strength-chart__dot');
    const pointTitle = createSvgElement('title');
    pointTitle.textContent = `${formatDate(item.date)}: ${formatKg(item.estimatedOneRepMaxKg)}`;
    circle.appendChild(pointTitle);
    chart.appendChild(circle);
    const label = createSvgElement('text');
    label.setAttribute('x', String(x));
    label.setAttribute('y', '202');
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('class', 'strength-chart__label');
    label.textContent = formatDate(item.date).slice(0, 5);
    chart.appendChild(label);
  });
}

function renderHistory(): void {
  if (!historyEmptyNode || !historyTable || !historyBody || !clearButton) return;
  const items = readHistory().sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
  historyBody.replaceChildren();
  historyEmptyNode.hidden = items.length > 0;
  historyTable.hidden = items.length === 0;
  clearButton.hidden = items.length === 0;
  items.slice().reverse().forEach((item) => {
    const comparable = items.filter((candidate) => candidate.exercise === item.exercise);
    const index = comparable.findIndex((candidate) => candidate.id === item.id);
    const previous = index > 0 ? comparable[index - 1] : null;
    const change = previous ? strengthChangePercent(item.estimatedOneRepMaxKg, previous.estimatedOneRepMaxKg) : null;
    const row = document.createElement('tr');
    const dateCell = document.createElement('th');
    dateCell.scope = 'row';
    dateCell.textContent = formatDate(item.date);
    const exerciseCell = document.createElement('td');
    exerciseCell.textContent = item.exerciseLabel;
    const setCell = document.createElement('td');
    setCell.textContent = `${formatKg(item.loadKg)} × ${item.repetitions}`;
    const resultCell = document.createElement('td');
    resultCell.textContent = formatKg(item.estimatedOneRepMaxKg);
    const changeCell = document.createElement('td');
    changeCell.textContent = change === null || Math.abs(change) < 0.05
      ? (change === null ? '—' : 'bez zmiany')
      : `${change > 0 ? '+' : ''}${change.toLocaleString('pl-PL', { maximumFractionDigits: 1 })}%`;
    row.append(dateCell, exerciseCell, setCell, resultCell, changeCell);
    historyBody.appendChild(row);
  });
  renderChart(items);
}

function resetResult(): void {
  if (emptyNode && contentNode) {
    emptyNode.hidden = false;
    contentNode.hidden = true;
  }
  latestResult = null;
}

if (form && exerciseInput && equipmentInput && bodyWeightInput && loadInput && repetitionsInput && dateInput && errorNode && emptyNode && contentNode && oneRepMaxNode && ratioNode && bodyPercentNode && workingPercentNode && seriesNode && estimateCopyNode && qualityNode && qualityCopyNode && resultExerciseNode && saveButton) {
  const safeForm = form;
  const safeExerciseInput = exerciseInput;
  const safeEquipmentInput = equipmentInput;
  const safeBodyWeightInput = bodyWeightInput;
  const safeLoadInput = loadInput;
  const safeRepetitionsInput = repetitionsInput;
  const safeDateInput = dateInput;
  const safeErrorNode = errorNode;
  const safeEmptyNode = emptyNode;
  const safeContentNode = contentNode;
  const safeSaveButton = saveButton;

  safeDateInput.value = new Date().toISOString().slice(0, 10);
  safeEquipmentInput.addEventListener('change', updateEquipmentHint);
  safeExerciseInput.addEventListener('change', () => renderChart(readHistory()));
  safeForm.addEventListener('input', resetResult);
  safeForm.addEventListener('change', resetResult);

  safeForm.addEventListener('submit', (event) => {
    event.preventDefault();
    safeErrorNode.hidden = true;
    const bodyWeightKg = parseNumber(safeBodyWeightInput);
    const loadKg = parseNumber(safeLoadInput);
    const repetitions = parseNumber(safeRepetitionsInput);
    if (bodyWeightKg === null || bodyWeightKg < 35 || bodyWeightKg > 300) {
      safeErrorNode.textContent = 'Podaj masę ciała od 35 do 300 kg.';
      safeErrorNode.hidden = false;
      return;
    }
    if (loadKg === null || loadKg < 1 || loadKg > 1000) {
      safeErrorNode.textContent = 'Podaj łączny ciężar od 1 do 1000 kg.';
      safeErrorNode.hidden = false;
      return;
    }
    if (repetitions === null || !Number.isInteger(repetitions) || repetitions < 2 || repetitions > 10) {
      safeErrorNode.textContent = 'Podaj od 2 do 10 pełnych powtórzeń.';
      safeErrorNode.hidden = false;
      return;
    }
    try {
      const result = calculateRelativeStrength(bodyWeightKg, loadKg, repetitions);
      const quality = describeEstimateQuality(getEffort(), getEquipment());
      latestResult = result;
      oneRepMaxNode.textContent = result.estimatedOneRepMaxKg.toLocaleString('pl-PL', { maximumFractionDigits: 1 });
      ratioNode.textContent = result.relativeStrength.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      bodyPercentNode.textContent = `${Math.round(result.bodyweightPercent)}% masy ciała`;
      workingPercentNode.textContent = `${Math.round(result.workingLoadPercent)}% szacowanego 1RM`;
      seriesNode.textContent = `${loadKg.toLocaleString('pl-PL', { maximumFractionDigits: 1 })} kg × ${repetitions}`;
      estimateCopyNode.textContent = formatKg(result.estimatedOneRepMaxKg);
      qualityNode.textContent = quality.label;
      qualityCopyNode.textContent = quality.explanation;
      resultExerciseNode.textContent = getExerciseLabel();
      safeEmptyNode.hidden = true;
      safeContentNode.hidden = false;
    } catch (_) {
      safeErrorNode.textContent = 'Nie udało się policzyć wyniku. Sprawdź wszystkie wartości.';
      safeErrorNode.hidden = false;
    }
  });

  safeSaveButton.addEventListener('click', () => {
    const result = latestResult;
    const bodyWeightKg = parseNumber(safeBodyWeightInput);
    const loadKg = parseNumber(safeLoadInput);
    const repetitions = parseNumber(safeRepetitionsInput);
    if (!result || bodyWeightKg === null || loadKg === null || repetitions === null || !safeDateInput.value) return;
    const now = Date.now();
    const items = readHistory();
    items.push({
      id: `${safeDateInput.value}-${now}`,
      date: safeDateInput.value,
      exercise: safeExerciseInput.value,
      exerciseLabel: getExerciseLabel(),
      equipment: getEquipment(),
      bodyWeightKg,
      loadKg,
      repetitions,
      estimatedOneRepMaxKg: result.estimatedOneRepMaxKg,
      relativeStrength: result.relativeStrength,
      createdAt: now
    });
    writeHistory(items);
    renderHistory();
    safeSaveButton.textContent = 'Wynik zapisany ✓';
    window.setTimeout(() => { safeSaveButton.textContent = 'Zapisz wynik na tym urządzeniu'; }, 1800);
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

updateEquipmentHint();
renderHistory();
