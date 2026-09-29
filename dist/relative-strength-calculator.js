"use strict";
(() => {
  // src/relative-strength-core.ts
  function calculateEstimatedOneRepMax(loadKg, repetitions) {
    if (!Number.isFinite(loadKg) || loadKg <= 0) {
      throw new RangeError("Load must be greater than zero.");
    }
    if (!Number.isInteger(repetitions) || repetitions < 2 || repetitions > 10) {
      throw new RangeError("Repetitions must be an integer from 2 to 10.");
    }
    return loadKg * (1 + repetitions / 30);
  }
  function calculateRelativeStrength(bodyWeightKg, loadKg, repetitions) {
    if (!Number.isFinite(bodyWeightKg) || bodyWeightKg <= 0) {
      throw new RangeError("Body weight must be greater than zero.");
    }
    const estimatedOneRepMaxKg = calculateEstimatedOneRepMax(loadKg, repetitions);
    return {
      estimatedOneRepMaxKg,
      relativeStrength: estimatedOneRepMaxKg / bodyWeightKg,
      bodyweightPercent: estimatedOneRepMaxKg / bodyWeightKg * 100,
      workingLoadPercent: loadKg / estimatedOneRepMaxKg * 100
    };
  }
  function describeEstimateQuality(effort, equipment) {
    if (equipment === "machine") {
      return {
        label: effort === "near-limit" ? "Dobry do \u015Bledzenia tej maszyny" : "Bardzo orientacyjny",
        explanation: effort === "near-limit" ? "Stosy i prze\u0142o\u017Cenia r\xF3\u017Cni\u0105 si\u0119 mi\u0119dzy maszynami. Por\xF3wnuj wynik tylko na tym samym urz\u0105dzeniu i przy tym samym ustawieniu." : "Seria nie by\u0142a blisko ko\u0144ca, a warto\u015Bci na maszynach nie s\u0105 por\xF3wnywalne mi\u0119dzy urz\u0105dzeniami. Traktuj wynik wy\u0142\u0105cznie jako punkt startowy."
      };
    }
    if (effort === "not-near") {
      return {
        label: "Bardzo orientacyjny",
        explanation: "Je\u015Bli zosta\u0142y co najmniej trzy mo\u017Cliwe powt\xF3rzenia albo nie wiesz, wynik mo\u017Ce zani\u017Ca\u0107 aktualn\u0105 si\u0142\u0119."
      };
    }
    return {
      label: "U\u017Cyteczny do w\u0142asnego trendu",
      explanation: "Kr\xF3tka seria wykonana blisko ko\u0144ca daje praktyczny punkt odniesienia. To nadal szacunek, a nie zmierzone maksimum."
    };
  }
  function strengthChangePercent(current, previous) {
    if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) return 0;
    return (current - previous) / previous * 100;
  }

  // src/relative-strength-calculator.ts
  var STORAGE_KEY = "fitpo50.relative-strength.v1";
  var SVG_NS = "http://www.w3.org/2000/svg";
  var form = document.querySelector("[data-strength-form]");
  var exerciseInput = document.querySelector("[data-strength-exercise]");
  var equipmentInput = document.querySelector("[data-strength-equipment]");
  var bodyWeightInput = document.querySelector("[data-strength-body-weight]");
  var loadInput = document.querySelector("[data-strength-load]");
  var repetitionsInput = document.querySelector("[data-strength-repetitions]");
  var dateInput = document.querySelector("[data-strength-date]");
  var equipmentHint = document.querySelector("[data-strength-equipment-hint]");
  var errorNode = document.querySelector("[data-strength-error]");
  var emptyNode = document.querySelector("[data-strength-empty]");
  var contentNode = document.querySelector("[data-strength-content]");
  var oneRepMaxNode = document.querySelector("[data-strength-one-rep-max]");
  var ratioNode = document.querySelector("[data-strength-ratio]");
  var bodyPercentNode = document.querySelector("[data-strength-body-percent]");
  var workingPercentNode = document.querySelector("[data-strength-working-percent]");
  var seriesNode = document.querySelector("[data-strength-series]");
  var estimateCopyNode = document.querySelector("[data-strength-estimate-copy]");
  var qualityNode = document.querySelector("[data-strength-quality]");
  var qualityCopyNode = document.querySelector("[data-strength-quality-copy]");
  var resultExerciseNode = document.querySelector("[data-strength-result-exercise]");
  var saveButton = document.querySelector("[data-strength-save]");
  var clearButton = document.querySelector("[data-strength-clear]");
  var historyEmptyNode = document.querySelector("[data-strength-history-empty]");
  var historyTable = document.querySelector("[data-strength-history-table]");
  var historyBody = document.querySelector("[data-strength-history-body]");
  var chart = document.querySelector("[data-strength-chart]");
  var chartEmpty = document.querySelector("[data-strength-chart-empty]");
  var chartTitle = document.querySelector("[data-strength-chart-title]");
  var latestResult = null;
  function parseNumber(input) {
    const normalized = input.value.trim().replace(",", ".");
    if (!normalized) return null;
    const value = Number(normalized);
    return Number.isFinite(value) ? value : null;
  }
  function getEquipment() {
    const value = equipmentInput == null ? void 0 : equipmentInput.value;
    if (value === "dumbbells" || value === "machine" || value === "other") return value;
    return "barbell";
  }
  function getEffort() {
    const checked = document.querySelector('input[name="strength-effort"]:checked');
    return (checked == null ? void 0 : checked.value) === "near-limit" ? "near-limit" : "not-near";
  }
  function getExerciseLabel() {
    var _a;
    const selected = exerciseInput == null ? void 0 : exerciseInput.selectedOptions.item(0);
    return ((_a = selected == null ? void 0 : selected.textContent) == null ? void 0 : _a.trim()) || "Inne \u0107wiczenie";
  }
  function isHistoryItem(value) {
    if (typeof value !== "object" || value === null) return false;
    const item = value;
    return typeof item.id === "string" && typeof item.date === "string" && typeof item.exercise === "string" && typeof item.exerciseLabel === "string" && typeof item.bodyWeightKg === "number" && typeof item.loadKg === "number" && typeof item.repetitions === "number" && typeof item.estimatedOneRepMaxKg === "number" && typeof item.relativeStrength === "number" && typeof item.createdAt === "number" && (item.equipment === "barbell" || item.equipment === "dumbbells" || item.equipment === "machine" || item.equipment === "other");
  }
  function readHistory() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed.filter(isHistoryItem) : [];
    } catch (_) {
      return [];
    }
  }
  function writeHistory(items) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(-40)));
    } catch (_) {
    }
  }
  function formatDate(value) {
    const parts = value.split("-");
    return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : value;
  }
  function formatKg(value) {
    return `${value.toLocaleString("pl-PL", { maximumFractionDigits: 1 })} kg`;
  }
  function updateEquipmentHint() {
    if (!equipmentHint) return;
    const copy = {
      barbell: "Wpisz \u0142\u0105czn\u0105 mas\u0119 gryfu i wszystkich talerzy.",
      dumbbells: "Wpisz sum\u0119 obu hantli, np. 2 \xD7 12 kg = 24 kg.",
      machine: "Wpisz warto\u015B\u0107 ustawion\u0105 na stosie. Por\xF3wnuj tylko t\u0119 sam\u0105 maszyn\u0119.",
      other: "Wpisuj ci\u0119\u017Car zawsze w ten sam spos\xF3b przy kolejnych pomiarach."
    };
    equipmentHint.textContent = copy[getEquipment()];
  }
  function createSvgElement(name) {
    return document.createElementNS(SVG_NS, name);
  }
  function renderChart(items) {
    if (!chart || !chartEmpty || !chartTitle || !exerciseInput) return;
    const exercise = exerciseInput.value;
    const exerciseLabel = getExerciseLabel();
    const recent = items.filter((item) => item.exercise === exercise).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt).slice(-8);
    chart.replaceChildren();
    chart.toggleAttribute("hidden", recent.length === 0);
    chartEmpty.hidden = recent.length > 0;
    chartTitle.textContent = recent.length > 0 ? `Trend: ${exerciseLabel}` : "Trend wybranego \u0107wiczenia";
    if (recent.length === 0) return;
    const title = createSvgElement("title");
    title.textContent = `Szacowane maksimum dla \u0107wiczenia ${exerciseLabel}. Im wy\u017Cej znajduje si\u0119 punkt, tym wi\u0119kszy wynik.`;
    chart.appendChild(title);
    const left = 42;
    const right = 638;
    const top = 24;
    const bottom = 166;
    const values = recent.map((item) => item.estimatedOneRepMaxKg);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const range = Math.max(rawMax - rawMin, Math.max(rawMax * 0.1, 5));
    const min = rawMin - (range - (rawMax - rawMin)) / 2;
    const max = rawMax + (range - (rawMax - rawMin)) / 2;
    [top, (top + bottom) / 2, bottom].forEach((y) => {
      const line = createSvgElement("line");
      line.setAttribute("x1", String(left));
      line.setAttribute("x2", String(right));
      line.setAttribute("y1", String(y));
      line.setAttribute("y2", String(y));
      line.setAttribute("class", "strength-chart__grid");
      chart.appendChild(line);
    });
    const points = recent.map((item, index) => {
      const x = recent.length === 1 ? (left + right) / 2 : left + (right - left) * index / (recent.length - 1);
      const y = bottom - (item.estimatedOneRepMaxKg - min) / (max - min) * (bottom - top);
      return { item, x, y };
    });
    if (points.length > 1) {
      const polyline = createSvgElement("polyline");
      polyline.setAttribute("points", points.map((point) => `${point.x},${point.y}`).join(" "));
      polyline.setAttribute("class", "strength-chart__line");
      chart.appendChild(polyline);
    }
    points.forEach(({ item, x, y }) => {
      const circle = createSvgElement("circle");
      circle.setAttribute("cx", String(x));
      circle.setAttribute("cy", String(y));
      circle.setAttribute("r", "7");
      circle.setAttribute("class", "strength-chart__dot");
      const pointTitle = createSvgElement("title");
      pointTitle.textContent = `${formatDate(item.date)}: ${formatKg(item.estimatedOneRepMaxKg)}`;
      circle.appendChild(pointTitle);
      chart.appendChild(circle);
      const label = createSvgElement("text");
      label.setAttribute("x", String(x));
      label.setAttribute("y", "202");
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("class", "strength-chart__label");
      label.textContent = formatDate(item.date).slice(0, 5);
      chart.appendChild(label);
    });
  }
  function renderHistory() {
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
      const row = document.createElement("tr");
      const dateCell = document.createElement("th");
      dateCell.scope = "row";
      dateCell.textContent = formatDate(item.date);
      const exerciseCell = document.createElement("td");
      exerciseCell.textContent = item.exerciseLabel;
      const setCell = document.createElement("td");
      setCell.textContent = `${formatKg(item.loadKg)} \xD7 ${item.repetitions}`;
      const resultCell = document.createElement("td");
      resultCell.textContent = formatKg(item.estimatedOneRepMaxKg);
      const changeCell = document.createElement("td");
      changeCell.textContent = change === null || Math.abs(change) < 0.05 ? change === null ? "\u2014" : "bez zmiany" : `${change > 0 ? "+" : ""}${change.toLocaleString("pl-PL", { maximumFractionDigits: 1 })}%`;
      row.append(dateCell, exerciseCell, setCell, resultCell, changeCell);
      historyBody.appendChild(row);
    });
    renderChart(items);
  }
  function resetResult() {
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
    safeDateInput.value = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    safeEquipmentInput.addEventListener("change", updateEquipmentHint);
    safeExerciseInput.addEventListener("change", () => renderChart(readHistory()));
    safeForm.addEventListener("input", resetResult);
    safeForm.addEventListener("change", resetResult);
    safeForm.addEventListener("submit", (event) => {
      event.preventDefault();
      safeErrorNode.hidden = true;
      const bodyWeightKg = parseNumber(safeBodyWeightInput);
      const loadKg = parseNumber(safeLoadInput);
      const repetitions = parseNumber(safeRepetitionsInput);
      if (bodyWeightKg === null || bodyWeightKg < 35 || bodyWeightKg > 300) {
        safeErrorNode.textContent = "Podaj mas\u0119 cia\u0142a od 35 do 300 kg.";
        safeErrorNode.hidden = false;
        return;
      }
      if (loadKg === null || loadKg < 1 || loadKg > 1e3) {
        safeErrorNode.textContent = "Podaj \u0142\u0105czny ci\u0119\u017Car od 1 do 1000 kg.";
        safeErrorNode.hidden = false;
        return;
      }
      if (repetitions === null || !Number.isInteger(repetitions) || repetitions < 2 || repetitions > 10) {
        safeErrorNode.textContent = "Podaj od 2 do 10 pe\u0142nych powt\xF3rze\u0144.";
        safeErrorNode.hidden = false;
        return;
      }
      try {
        const result = calculateRelativeStrength(bodyWeightKg, loadKg, repetitions);
        const quality = describeEstimateQuality(getEffort(), getEquipment());
        latestResult = result;
        oneRepMaxNode.textContent = result.estimatedOneRepMaxKg.toLocaleString("pl-PL", { maximumFractionDigits: 1 });
        ratioNode.textContent = result.relativeStrength.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        bodyPercentNode.textContent = `${Math.round(result.bodyweightPercent)}% masy cia\u0142a`;
        workingPercentNode.textContent = `${Math.round(result.workingLoadPercent)}% szacowanego 1RM`;
        seriesNode.textContent = `${loadKg.toLocaleString("pl-PL", { maximumFractionDigits: 1 })} kg \xD7 ${repetitions}`;
        estimateCopyNode.textContent = formatKg(result.estimatedOneRepMaxKg);
        qualityNode.textContent = quality.label;
        qualityCopyNode.textContent = quality.explanation;
        resultExerciseNode.textContent = getExerciseLabel();
        safeEmptyNode.hidden = true;
        safeContentNode.hidden = false;
      } catch (_) {
        safeErrorNode.textContent = "Nie uda\u0142o si\u0119 policzy\u0107 wyniku. Sprawd\u017A wszystkie warto\u015Bci.";
        safeErrorNode.hidden = false;
      }
    });
    safeSaveButton.addEventListener("click", () => {
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
      safeSaveButton.textContent = "Wynik zapisany \u2713";
      window.setTimeout(() => {
        safeSaveButton.textContent = "Zapisz wynik na tym urz\u0105dzeniu";
      }, 1800);
    });
  }
  if (clearButton) {
    clearButton.addEventListener("click", () => {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch (_) {
      }
      renderHistory();
    });
  }
  updateEquipmentHint();
  renderHistory();
})();
