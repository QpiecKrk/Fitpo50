"use strict";
(() => {
  // src/blood-pressure-core.ts
  function validateReading(systolic, diastolic, pulse) {
    if (systolic === null && diastolic === null && pulse === null) return null;
    if (systolic === null || diastolic === null) return "Wpisz obie warto\u015Bci ci\u015Bnienia.";
    if (systolic < 50 || systolic > 280 || diastolic < 30 || diastolic > 180) return "Sprawd\u017A wpisane warto\u015Bci.";
    if (systolic <= diastolic) return "Ci\u015Bnienie skurczowe powinno by\u0107 wy\u017Csze od rozkurczowego.";
    if (pulse !== null && (pulse < 25 || pulse > 250)) return "Sprawd\u017A wpisany puls.";
    return null;
  }
  function roundedAverage(values) {
    if (!values.length) return null;
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  }
  function pressureAverage(readings) {
    const systolic = roundedAverage(readings.map((reading) => reading.systolic));
    const diastolic = roundedAverage(readings.map((reading) => reading.diastolic));
    return systolic === null || diastolic === null ? "-/-" : `${systolic}/${diastolic}`;
  }
  function summarizeReadings(readings) {
    const assessment = readings.filter((reading) => reading.day >= 2);
    const morning = assessment.filter((reading) => reading.period === "morning");
    const evening = assessment.filter((reading) => reading.period === "evening");
    const pulseValues = [];
    assessment.forEach((reading) => {
      if (reading.pulse !== null) pulseValues.push(reading.pulse);
    });
    return {
      pressure: pressureAverage(assessment),
      morning: pressureAverage(morning),
      evening: pressureAverage(evening),
      pulse: roundedAverage(pulseValues),
      count: assessment.length
    };
  }
  function hasSevereReading(readings) {
    return readings.some((reading) => reading.systolic > 180 || reading.diastolic > 120);
  }

  // src/blood-pressure-diary.ts
  (function() {
    "use strict";
    const STORAGE_KEY = "fitpo50-blood-pressure-diary-v1";
    const form = document.querySelector("[data-bp-form]");
    const daysRoot = document.querySelector("[data-bp-days]");
    const errorNode = document.querySelector("[data-bp-error]");
    const resultEmpty = document.querySelector("[data-bp-empty]");
    const resultContent = document.querySelector("[data-bp-content]");
    const safetyNode = document.querySelector("[data-bp-safety]");
    const averageNode = document.querySelector("[data-bp-average]");
    const pulseNode = document.querySelector("[data-bp-pulse]");
    const morningNode = document.querySelector("[data-bp-morning]");
    const eveningNode = document.querySelector("[data-bp-evening]");
    const countNode = document.querySelector("[data-bp-count]");
    const completenessNode = document.querySelector("[data-bp-completeness]");
    const savedNode = document.querySelector("[data-bp-saved]");
    const clearButton = document.querySelector("[data-bp-clear]");
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
    function fieldName(day, period, sequence, metric) {
      return `d${day}-${period}-${sequence}-${metric}`;
    }
    function createNumberField(label, accessibleLabel, name, min, max) {
      return `<label class="bp-reading__field"><span>${label}</span><input type="number" inputmode="numeric" name="${name}" aria-label="${accessibleLabel}" min="${min}" max="${max}" step="1" autocomplete="off"></label>`;
    }
    function createReading(day, period, sequence) {
      const title = `${period === "morning" ? "Rano" : "Wiecz\xF3r"} ${sequence}`;
      return `<div class="bp-reading" data-reading="d${day}-${period}-${sequence}">
      <strong>${title}</strong>
      ${createNumberField("Skurczowe", `Dzie\u0144 ${day}, ${title}, ci\u015Bnienie skurczowe`, fieldName(day, period, sequence, "sys"), 50, 280)}
      ${createNumberField("Rozkurczowe", `Dzie\u0144 ${day}, ${title}, ci\u015Bnienie rozkurczowe`, fieldName(day, period, sequence, "dia"), 30, 180)}
      ${createNumberField("Puls", `Dzie\u0144 ${day}, ${title}, puls`, fieldName(day, period, sequence, "pulse"), 25, 250)}
    </div>`;
    }
    function buildDays() {
      const fragments = [];
      for (let day = 1; day <= 7; day += 1) {
        const summary = day === 1 ? "Dzie\u0144 1 - rozruch, pomijany w \u015Bredniej g\u0142\xF3wnej" : `Dzie\u0144 ${day}`;
        fragments.push(`<details class="bp-day" ${day === 1 ? "open" : ""} data-day="${day}">
        <summary><span>${summary}</span><small data-day-status="${day}">0 z 4 odczyt\xF3w</small></summary>
        <div class="bp-day__body">
          <div class="bp-period"><h3>Rano</h3><p>Przed lekami i \u015Bniadaniem, je\u015Bli taki harmonogram ustali\u0142e\u015B ze specjalist\u0105.</p>${createReading(day, "morning", 1)}${createReading(day, "morning", 2)}</div>
          <div class="bp-period"><h3>Wiecz\xF3r</h3><p>W podobnej porze i spokojnych warunkach.</p>${createReading(day, "evening", 1)}${createReading(day, "evening", 2)}</div>
          <label class="bp-note"><span>Notatka do dnia ${day}</span><textarea name="d${day}-note" rows="2" maxlength="180" placeholder="Np. b\xF3l g\u0142owy, zmiana leku, gorszy sen"></textarea></label>
        </div>
      </details>`);
      }
      diaryDaysRoot.innerHTML = fragments.join("");
    }
    function numericValue(data, name) {
      const raw = String(data.get(name) || "").trim().replace(",", ".");
      if (raw === "") return null;
      const value = Number(raw);
      return Number.isFinite(value) ? value : null;
    }
    function collectReadings() {
      const data = new FormData(diaryForm);
      const readings = [];
      const errors = [];
      for (let day = 1; day <= 7; day += 1) {
        for (const period of ["morning", "evening"]) {
          for (let sequence = 1; sequence <= 2; sequence += 1) {
            const systolic = numericValue(data, fieldName(day, period, sequence, "sys"));
            const diastolic = numericValue(data, fieldName(day, period, sequence, "dia"));
            const pulse = numericValue(data, fieldName(day, period, sequence, "pulse"));
            const label = `Dzie\u0144 ${day}, ${period === "morning" ? "rano" : "wiecz\xF3r"}, pomiar ${sequence}`;
            const validationError = validateReading(systolic, diastolic, pulse);
            if (validationError) {
              errors.push(`${label}: ${validationError.charAt(0).toLocaleLowerCase("pl-PL")}${validationError.slice(1)}`);
              continue;
            }
            if (systolic === null || diastolic === null) continue;
            readings.push({ day, period, sequence, systolic, diastolic, pulse });
          }
        }
      }
      return { readings, errors };
    }
    function updateDayStatuses(readings) {
      for (let day = 1; day <= 7; day += 1) {
        const count = readings.filter((reading) => reading.day === day).length;
        const status = diaryForm.querySelector(`[data-day-status="${day}"]`);
        if (status) status.textContent = `${count} z 4 odczyt\xF3w`;
      }
    }
    function saveDiary() {
      const values = {};
      const notes = {};
      diaryForm.querySelectorAll('input[type="number"]').forEach((input) => {
        if (input.value !== "") values[input.name] = input.value;
      });
      diaryForm.querySelectorAll("textarea").forEach((textarea) => {
        if (textarea.value.trim() !== "") notes[textarea.name] = textarea.value;
      });
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ values, notes }));
        diarySavedNode.textContent = Object.keys(values).length || Object.keys(notes).length ? "Zapisano w tej przegl\u0105darce." : "";
      } catch (_) {
        diarySavedNode.textContent = "Nie uda\u0142o si\u0119 zapisa\u0107 danych lokalnie.";
      }
    }
    function loadDiary() {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
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
    function updateResults() {
      const { readings, errors } = collectReadings();
      updateDayStatuses(readings);
      saveDiary();
      diaryErrorNode.hidden = errors.length === 0;
      diaryErrorNode.textContent = errors.length ? errors[0] : "";
      const assessmentReadings = readings.filter((reading) => reading.day >= 2);
      if (!assessmentReadings.length) {
        diaryResultEmpty.hidden = false;
        diaryResultContent.hidden = true;
      } else {
        const summary = summarizeReadings(readings);
        diaryAverageNode.textContent = summary.pressure;
        diaryPulseNode.textContent = summary.pulse === null ? "brak danych" : `${summary.pulse}/min`;
        diaryMorningNode.textContent = summary.morning;
        diaryEveningNode.textContent = summary.evening;
        diaryCountNode.textContent = `${summary.count} z 24`;
        diaryCompletenessNode.textContent = summary.count === 24 ? "Komplet pomiar\xF3w z dni 2-7. Dzie\u0144 1 zosta\u0142 pomini\u0119ty zgodnie z opisanym protoko\u0142em." : "To \u015Brednia robocza. Uzupe\u0142nij 24 odczyty z dni 2-7, aby uzyska\u0107 pe\u0142ny zapis wed\u0142ug tego protoko\u0142u.";
        diaryResultEmpty.hidden = true;
        diaryResultContent.hidden = false;
      }
      diarySafetyNode.hidden = !hasSevereReading(readings);
    }
    function clearDiary() {
      const confirmed = window.confirm("Usun\u0105\u0107 wszystkie zapisane pomiary z tego urz\u0105dzenia?");
      if (!confirmed) return;
      diaryForm.reset();
      window.localStorage.removeItem(STORAGE_KEY);
      diarySavedNode.textContent = "";
      updateResults();
    }
    buildDays();
    loadDiary();
    updateResults();
    diaryForm.addEventListener("input", updateResults);
    diaryForm.addEventListener("change", updateResults);
    clearButton.addEventListener("click", clearDiary);
  })();
})();
