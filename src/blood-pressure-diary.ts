import {
  BloodPressurePeriod,
  BloodPressureReading,
  hasSevereReading,
  summarizeReadings,
  validateReading
} from './blood-pressure-core';

(function () {
  'use strict';

  interface StoredDiary {
    values: Record<string, string>;
    notes: Record<string, string>;
  }

  const STORAGE_KEY = 'fitpo50-blood-pressure-diary-v1';
  const form = document.querySelector<HTMLFormElement>('[data-bp-form]');
  const daysRoot = document.querySelector<HTMLElement>('[data-bp-days]');
  const errorNode = document.querySelector<HTMLElement>('[data-bp-error]');
  const resultEmpty = document.querySelector<HTMLElement>('[data-bp-empty]');
  const resultContent = document.querySelector<HTMLElement>('[data-bp-content]');
  const safetyNode = document.querySelector<HTMLElement>('[data-bp-safety]');
  const averageNode = document.querySelector<HTMLElement>('[data-bp-average]');
  const pulseNode = document.querySelector<HTMLElement>('[data-bp-pulse]');
  const morningNode = document.querySelector<HTMLElement>('[data-bp-morning]');
  const eveningNode = document.querySelector<HTMLElement>('[data-bp-evening]');
  const countNode = document.querySelector<HTMLElement>('[data-bp-count]');
  const completenessNode = document.querySelector<HTMLElement>('[data-bp-completeness]');
  const savedNode = document.querySelector<HTMLElement>('[data-bp-saved]');
  const clearButton = document.querySelector<HTMLButtonElement>('[data-bp-clear]');

  if (!form || !daysRoot || !errorNode || !resultEmpty || !resultContent || !safetyNode || !averageNode || !pulseNode || !morningNode || !eveningNode || !countNode || !completenessNode || !savedNode || !clearButton) {
    return;
  }

  const diaryForm = form;
  const diaryDaysRoot = daysRoot;
  const diaryErrorNode = errorNode;
  const diaryResultEmpty = resultEmpty;
  const diaryResultContent = resultContent;
  const diarySafetyNode = safetyNode;
  const diaryAverageNode = averageNode;
  const diaryPulseNode = pulseNode;
  const diaryMorningNode = morningNode;
  const diaryEveningNode = eveningNode;
  const diaryCountNode = countNode;
  const diaryCompletenessNode = completenessNode;
  const diarySavedNode = savedNode;

  function fieldName(day: number, period: BloodPressurePeriod, sequence: number, metric: 'sys' | 'dia' | 'pulse'): string {
    return `d${day}-${period}-${sequence}-${metric}`;
  }

  function createNumberField(label: string, accessibleLabel: string, name: string, min: number, max: number): string {
    return `<label class="bp-reading__field"><span>${label}</span><input type="number" inputmode="numeric" name="${name}" aria-label="${accessibleLabel}" min="${min}" max="${max}" step="1" autocomplete="off"></label>`;
  }

  function createReading(day: number, period: BloodPressurePeriod, sequence: number): string {
    const title = `${period === 'morning' ? 'Rano' : 'Wieczór'} ${sequence}`;
    return `<div class="bp-reading" data-reading="d${day}-${period}-${sequence}">
      <strong>${title}</strong>
      ${createNumberField('Skurczowe', `Dzień ${day}, ${title}, ciśnienie skurczowe`, fieldName(day, period, sequence, 'sys'), 50, 280)}
      ${createNumberField('Rozkurczowe', `Dzień ${day}, ${title}, ciśnienie rozkurczowe`, fieldName(day, period, sequence, 'dia'), 30, 180)}
      ${createNumberField('Puls', `Dzień ${day}, ${title}, puls`, fieldName(day, period, sequence, 'pulse'), 25, 250)}
    </div>`;
  }

  function buildDays(): void {
    const fragments: string[] = [];
    for (let day = 1; day <= 7; day += 1) {
      const summary = day === 1 ? 'Dzień 1 - rozruch, pomijany w średniej głównej' : `Dzień ${day}`;
      fragments.push(`<details class="bp-day" ${day === 1 ? 'open' : ''} data-day="${day}">
        <summary><span>${summary}</span><small data-day-status="${day}">0 z 4 odczytów</small></summary>
        <div class="bp-day__body">
          <div class="bp-period"><h3>Rano</h3><p>Przed lekami i śniadaniem, jeśli taki harmonogram ustaliłeś ze specjalistą.</p>${createReading(day, 'morning', 1)}${createReading(day, 'morning', 2)}</div>
          <div class="bp-period"><h3>Wieczór</h3><p>W podobnej porze i spokojnych warunkach.</p>${createReading(day, 'evening', 1)}${createReading(day, 'evening', 2)}</div>
          <label class="bp-note"><span>Notatka do dnia ${day}</span><textarea name="d${day}-note" rows="2" maxlength="180" placeholder="Np. ból głowy, zmiana leku, gorszy sen"></textarea></label>
        </div>
      </details>`);
    }
    diaryDaysRoot.innerHTML = fragments.join('');
  }

  function numericValue(data: FormData, name: string): number | null {
    const raw = String(data.get(name) || '').trim().replace(',', '.');
    if (raw === '') return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  }

  function collectReadings(): { readings: BloodPressureReading[]; errors: string[] } {
    const data = new FormData(diaryForm);
    const readings: BloodPressureReading[] = [];
    const errors: string[] = [];

    for (let day = 1; day <= 7; day += 1) {
      for (const period of ['morning', 'evening'] as BloodPressurePeriod[]) {
        for (let sequence = 1; sequence <= 2; sequence += 1) {
          const systolic = numericValue(data, fieldName(day, period, sequence, 'sys'));
          const diastolic = numericValue(data, fieldName(day, period, sequence, 'dia'));
          const pulse = numericValue(data, fieldName(day, period, sequence, 'pulse'));
          const label = `Dzień ${day}, ${period === 'morning' ? 'rano' : 'wieczór'}, pomiar ${sequence}`;

          const validationError = validateReading(systolic, diastolic, pulse);
          if (validationError) {
            errors.push(`${label}: ${validationError.charAt(0).toLocaleLowerCase('pl-PL')}${validationError.slice(1)}`);
            continue;
          }
          if (systolic === null || diastolic === null) continue;
          readings.push({ day, period, sequence, systolic, diastolic, pulse });
        }
      }
    }
    return { readings, errors };
  }

  function updateDayStatuses(readings: BloodPressureReading[]): void {
    for (let day = 1; day <= 7; day += 1) {
      const count = readings.filter((reading) => reading.day === day).length;
      const status = diaryForm.querySelector<HTMLElement>(`[data-day-status="${day}"]`);
      if (status) status.textContent = `${count} z 4 odczytów`;
    }
  }

  function saveDiary(): void {
    const values: Record<string, string> = {};
    const notes: Record<string, string> = {};
    diaryForm.querySelectorAll<HTMLInputElement>('input[type="number"]').forEach((input) => {
      if (input.value !== '') values[input.name] = input.value;
    });
    diaryForm.querySelectorAll<HTMLTextAreaElement>('textarea').forEach((textarea) => {
      if (textarea.value.trim() !== '') notes[textarea.name] = textarea.value;
    });
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ values, notes } satisfies StoredDiary));
      diarySavedNode.textContent = Object.keys(values).length || Object.keys(notes).length ? 'Zapisano w tej przeglądarce.' : '';
    } catch (_) {
      diarySavedNode.textContent = 'Nie udało się zapisać danych lokalnie.';
    }
  }

  function loadDiary(): void {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as StoredDiary;
      Object.keys(parsed.values || {}).forEach((name) => {
        const value = parsed.values[name];
        const input = diaryForm.elements.namedItem(name);
        if (input instanceof HTMLInputElement) input.value = value;
      });
      Object.keys(parsed.notes || {}).forEach((name) => {
        const value = parsed.notes[name];
        const textarea = diaryForm.elements.namedItem(name);
        if (textarea instanceof HTMLTextAreaElement) textarea.value = value;
      });
    } catch (_) {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }

  function updateResults(): void {
    const { readings, errors } = collectReadings();
    updateDayStatuses(readings);
    saveDiary();

    diaryErrorNode.hidden = errors.length === 0;
    diaryErrorNode.textContent = errors.length ? errors[0] : '';

    const assessmentReadings = readings.filter((reading) => reading.day >= 2);
    if (!assessmentReadings.length) {
      diaryResultEmpty.hidden = false;
      diaryResultContent.hidden = true;
    } else {
      const summary = summarizeReadings(readings);
      diaryAverageNode.textContent = summary.pressure;
      diaryPulseNode.textContent = summary.pulse === null ? 'brak danych' : `${summary.pulse}/min`;
      diaryMorningNode.textContent = summary.morning;
      diaryEveningNode.textContent = summary.evening;
      diaryCountNode.textContent = `${summary.count} z 24`;
      diaryCompletenessNode.textContent = summary.count === 24
        ? 'Komplet pomiarów z dni 2-7. Dzień 1 został pominięty zgodnie z opisanym protokołem.'
        : 'To średnia robocza. Uzupełnij 24 odczyty z dni 2-7, aby uzyskać pełny zapis według tego protokołu.';
      diaryResultEmpty.hidden = true;
      diaryResultContent.hidden = false;
    }

    diarySafetyNode.hidden = !hasSevereReading(readings);
  }

  function clearDiary(): void {
    const confirmed = window.confirm('Usunąć wszystkie zapisane pomiary z tego urządzenia?');
    if (!confirmed) return;
    diaryForm.reset();
    window.localStorage.removeItem(STORAGE_KEY);
    diarySavedNode.textContent = '';
    updateResults();
  }

  buildDays();
  loadDiary();
  updateResults();
  diaryForm.addEventListener('input', updateResults);
  diaryForm.addEventListener('change', updateResults);
  clearButton.addEventListener('click', clearDiary);
})();
