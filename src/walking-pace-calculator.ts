import {
  calculateWalkingPace,
  convertDistanceToKm,
  describeTalkTest,
  durationToSeconds,
  formatDuration,
  formatPace,
  paceChangeSeconds,
  type DistanceUnit,
  type TalkTest,
  type WalkingPaceResult
} from './walking-pace-core';

interface WalkingHistoryItem {
  id: string;
  date: string;
  distanceKm: number;
  durationSeconds: number;
  paceSecondsPerKm: number;
  speedKmh: number;
  talkTest: TalkTest;
  createdAt: number;
}

const STORAGE_KEY = 'fitpo50.walking-pace.v1';
const SVG_NS = 'http://www.w3.org/2000/svg';

const form = document.querySelector<HTMLFormElement>('[data-walk-form]');
const distanceInput = document.querySelector<HTMLInputElement>('[data-walk-distance]');
const distanceUnitInput = document.querySelector<HTMLSelectElement>('[data-walk-distance-unit]');
const hoursInput = document.querySelector<HTMLInputElement>('[data-walk-hours]');
const minutesInput = document.querySelector<HTMLInputElement>('[data-walk-minutes]');
const secondsInput = document.querySelector<HTMLInputElement>('[data-walk-seconds]');
const dateInput = document.querySelector<HTMLInputElement>('[data-walk-date]');
const errorNode = document.querySelector<HTMLElement>('[data-walk-error]');
const emptyNode = document.querySelector<HTMLElement>('[data-walk-empty]');
const contentNode = document.querySelector<HTMLElement>('[data-walk-content]');
const paceNode = document.querySelector<HTMLElement>('[data-walk-pace]');
const speedNode = document.querySelector<HTMLElement>('[data-walk-speed]');
const oneKmNode = document.querySelector<HTMLElement>('[data-walk-one-km]');
const threeKmNode = document.querySelector<HTMLElement>('[data-walk-three-km]');
const fiveKmNode = document.querySelector<HTMLElement>('[data-walk-five-km]');
const intensityNode = document.querySelector<HTMLElement>('[data-walk-intensity]');
const intensityCopyNode = document.querySelector<HTMLElement>('[data-walk-intensity-copy]');
const saveButton = document.querySelector<HTMLButtonElement>('[data-walk-save]');
const clearButton = document.querySelector<HTMLButtonElement>('[data-walk-clear]');
const historyEmptyNode = document.querySelector<HTMLElement>('[data-walk-history-empty]');
const historyTable = document.querySelector<HTMLTableElement>('[data-walk-history-table]');
const historyBody = document.querySelector<HTMLTableSectionElement>('[data-walk-history-body]');
const chart = document.querySelector<SVGSVGElement>('[data-walk-chart]');
const chartEmpty = document.querySelector<HTMLElement>('[data-walk-chart-empty]');

let latestResult: WalkingPaceResult | null = null;
let latestTalkTest: TalkTest = 'not-checked';

function parseFloatInput(input: HTMLInputElement): number | null {
  const normalized = input.value.trim().replace(',', '.');
  if (!normalized) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function parseIntegerInput(input: HTMLInputElement): number | null {
  const normalized = input.value.trim();
  if (!normalized) return 0;
  const value = Number(normalized);
  return Number.isInteger(value) ? value : null;
}

function getTalkTest(): TalkTest {
  const selected = document.querySelector<HTMLInputElement>('input[name="walk-talk-test"]:checked');
  const value = selected?.value;
  if (value === 'easy' || value === 'moderate' || value === 'vigorous') return value;
  return 'not-checked';
}

function isHistoryItem(value: unknown): value is WalkingHistoryItem {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Partial<WalkingHistoryItem>;
  return typeof item.id === 'string'
    && typeof item.date === 'string'
    && typeof item.distanceKm === 'number'
    && typeof item.durationSeconds === 'number'
    && typeof item.paceSecondsPerKm === 'number'
    && typeof item.speedKmh === 'number'
    && typeof item.createdAt === 'number'
    && (item.talkTest === 'not-checked' || item.talkTest === 'easy' || item.talkTest === 'moderate' || item.talkTest === 'vigorous');
}

function readHistory(): WalkingHistoryItem[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter(isHistoryItem) : [];
  } catch (_) {
    return [];
  }
}

function writeHistory(items: WalkingHistoryItem[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(-30)));
  } catch (_) {}
}

function formatDate(value: string): string {
  const parts = value.split('-');
  return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : value;
}

function createSvgElement<K extends keyof SVGElementTagNameMap>(name: K): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NS, name);
}

function renderChart(items: WalkingHistoryItem[]): void {
  if (!chart || !chartEmpty) return;
  chart.replaceChildren();
  const recent = [...items]
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
    .slice(-8);
  chart.toggleAttribute('hidden', recent.length === 0);
  chartEmpty.hidden = recent.length > 0;
  if (recent.length === 0) return;

  const title = createSvgElement('title');
  title.textContent = 'Tempo ostatnich zapisanych marszów. Im wyżej znajduje się punkt, tym krótszy czas na kilometr.';
  chart.appendChild(title);

  const left = 42;
  const right = 638;
  const top = 24;
  const bottom = 166;
  const paces = recent.map((item) => item.paceSecondsPerKm);
  const rawMin = Math.min(...paces);
  const rawMax = Math.max(...paces);
  const range = Math.max(rawMax - rawMin, 60);
  const min = rawMin - ((range - (rawMax - rawMin)) / 2);
  const max = rawMax + ((range - (rawMax - rawMin)) / 2);

  [top, (top + bottom) / 2, bottom].forEach((y) => {
    const line = createSvgElement('line');
    line.setAttribute('x1', String(left));
    line.setAttribute('x2', String(right));
    line.setAttribute('y1', String(y));
    line.setAttribute('y2', String(y));
    line.setAttribute('class', 'walk-chart__grid');
    chart.appendChild(line);
  });

  const points = recent.map((item, index) => {
    const x = recent.length === 1 ? (left + right) / 2 : left + ((right - left) * index / (recent.length - 1));
    const y = top + ((item.paceSecondsPerKm - min) / (max - min)) * (bottom - top);
    return { item, x, y };
  });

  if (points.length > 1) {
    const polyline = createSvgElement('polyline');
    polyline.setAttribute('points', points.map((point) => `${point.x},${point.y}`).join(' '));
    polyline.setAttribute('class', 'walk-chart__line');
    chart.appendChild(polyline);
  }

  points.forEach(({ item, x, y }) => {
    const circle = createSvgElement('circle');
    circle.setAttribute('cx', String(x));
    circle.setAttribute('cy', String(y));
    circle.setAttribute('r', '7');
    circle.setAttribute('class', 'walk-chart__dot');
    const pointTitle = createSvgElement('title');
    pointTitle.textContent = `${formatDate(item.date)}: ${formatPace(item.paceSecondsPerKm)} min/km`;
    circle.appendChild(pointTitle);
    chart.appendChild(circle);

    const label = createSvgElement('text');
    label.setAttribute('x', String(x));
    label.setAttribute('y', '202');
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('class', 'walk-chart__label');
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
    const chronologicalIndex = items.findIndex((candidate) => candidate.id === item.id);
    const previous = chronologicalIndex > 0 ? items[chronologicalIndex - 1] : null;
    const change = previous ? paceChangeSeconds(item.paceSecondsPerKm, previous.paceSecondsPerKm) : null;
    const row = document.createElement('tr');
    const dateCell = document.createElement('th');
    dateCell.scope = 'row';
    dateCell.textContent = formatDate(item.date);
    const distanceCell = document.createElement('td');
    distanceCell.textContent = `${item.distanceKm.toLocaleString('pl-PL', { maximumFractionDigits: 2 })} km`;
    const paceCell = document.createElement('td');
    paceCell.textContent = `${formatPace(item.paceSecondsPerKm)} min/km`;
    const changeCell = document.createElement('td');
    if (change === null || Math.abs(change) < 1) {
      changeCell.textContent = change === null ? '—' : 'bez zmiany';
    } else {
      const direction = change < 0 ? 'szybciej' : 'wolniej';
      changeCell.textContent = `${formatDuration(Math.abs(change))} ${direction}`;
    }
    row.append(dateCell, distanceCell, paceCell, changeCell);
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

if (form && distanceInput && distanceUnitInput && hoursInput && minutesInput && secondsInput && dateInput && errorNode && emptyNode && contentNode && paceNode && speedNode && oneKmNode && threeKmNode && fiveKmNode && intensityNode && intensityCopyNode && saveButton) {
  const safeForm = form;
  const safeDistanceInput = distanceInput;
  const safeDistanceUnitInput = distanceUnitInput;
  const safeHoursInput = hoursInput;
  const safeMinutesInput = minutesInput;
  const safeSecondsInput = secondsInput;
  const safeDateInput = dateInput;
  const safeErrorNode = errorNode;
  const safeEmptyNode = emptyNode;
  const safeContentNode = contentNode;
  const safeSaveButton = saveButton;

  safeDateInput.value = new Date().toISOString().slice(0, 10);

  safeForm.addEventListener('input', resetResult);
  safeForm.addEventListener('change', resetResult);

  safeForm.addEventListener('submit', (event) => {
    event.preventDefault();
    safeErrorNode.hidden = true;
    const distanceValue = parseFloatInput(safeDistanceInput);
    const hours = parseIntegerInput(safeHoursInput);
    const minutes = parseIntegerInput(safeMinutesInput);
    const seconds = parseIntegerInput(safeSecondsInput);

    if (distanceValue === null) {
      safeErrorNode.textContent = 'Podaj długość zmierzonej trasy.';
      safeErrorNode.hidden = false;
      return;
    }
    if (hours === null || minutes === null || seconds === null || minutes > 59 || seconds > 59) {
      safeErrorNode.textContent = 'Podaj czas poprawnie: minuty i sekundy od 0 do 59.';
      safeErrorNode.hidden = false;
      return;
    }

    try {
      const distanceKm = convertDistanceToKm(distanceValue, safeDistanceUnitInput.value as DistanceUnit);
      const durationSeconds = durationToSeconds(hours, minutes, seconds);
      if (distanceKm < 0.05 || distanceKm > 100) {
        throw new RangeError('distance');
      }
      if (durationSeconds < 30 || durationSeconds > 86400) {
        throw new RangeError('duration');
      }
      const result = calculateWalkingPace(distanceKm, durationSeconds);
      if (result.speedKmh > 25) {
        safeErrorNode.textContent = 'Wynik przekracza 25 km/h. Sprawdź dystans i czas.';
        safeErrorNode.hidden = false;
        return;
      }
      latestTalkTest = getTalkTest();
      const intensity = describeTalkTest(latestTalkTest);
      latestResult = result;
      paceNode.textContent = formatPace(result.paceSecondsPerKm);
      speedNode.textContent = result.speedKmh.toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
      oneKmNode.textContent = formatDuration(result.oneKmSeconds);
      threeKmNode.textContent = formatDuration(result.threeKmSeconds);
      fiveKmNode.textContent = formatDuration(result.fiveKmSeconds);
      intensityNode.textContent = intensity.label;
      intensityCopyNode.textContent = intensity.explanation;
      safeEmptyNode.hidden = true;
      safeContentNode.hidden = false;
    } catch (_) {
      safeErrorNode.textContent = 'Podaj dystans od 50 m do 100 km i czas od 30 sekund do 24 godzin.';
      safeErrorNode.hidden = false;
    }
  });

  safeSaveButton.addEventListener('click', () => {
    const result = latestResult;
    if (!result || !safeDateInput.value) return;
    const items = readHistory();
    items.push({
      id: `${safeDateInput.value}-${Date.now()}`,
      date: safeDateInput.value,
      distanceKm: result.distanceKm,
      durationSeconds: result.durationSeconds,
      paceSecondsPerKm: result.paceSecondsPerKm,
      speedKmh: result.speedKmh,
      talkTest: latestTalkTest,
      createdAt: Date.now()
    });
    writeHistory(items);
    renderHistory();
    safeSaveButton.textContent = 'Marsz zapisany ✓';
    window.setTimeout(() => { safeSaveButton.textContent = 'Zapisz marsz na tym urządzeniu'; }, 1800);
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
