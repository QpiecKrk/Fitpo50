"use strict";
(() => {
  // src/walking-pace-core.ts
  function twoDigits(value) {
    return value < 10 ? `0${value}` : String(value);
  }
  function convertDistanceToKm(value, unit) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new RangeError("Distance must be greater than zero.");
    }
    return unit === "m" ? value / 1e3 : value;
  }
  function durationToSeconds(hours, minutes, seconds) {
    const values = [hours, minutes, seconds];
    if (values.some((value) => !Number.isInteger(value) || value < 0)) {
      throw new RangeError("Duration parts must be non-negative integers.");
    }
    if (minutes > 59 || seconds > 59) {
      throw new RangeError("Minutes and seconds must be between 0 and 59.");
    }
    return hours * 3600 + minutes * 60 + seconds;
  }
  function calculateWalkingPace(distanceKm, durationSeconds) {
    if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
      throw new RangeError("Distance must be greater than zero.");
    }
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      throw new RangeError("Duration must be greater than zero.");
    }
    const paceSecondsPerKm = durationSeconds / distanceKm;
    const speedKmh = distanceKm / (durationSeconds / 3600);
    return {
      distanceKm,
      durationSeconds,
      paceSecondsPerKm,
      speedKmh,
      oneKmSeconds: paceSecondsPerKm,
      threeKmSeconds: paceSecondsPerKm * 3,
      fiveKmSeconds: paceSecondsPerKm * 5
    };
  }
  function formatPace(secondsPerKm) {
    if (!Number.isFinite(secondsPerKm) || secondsPerKm < 0) return "\u2014";
    const rounded = Math.round(secondsPerKm);
    const minutes = Math.floor(rounded / 60);
    const seconds = rounded % 60;
    return `${minutes}:${twoDigits(seconds)}`;
  }
  function formatDuration(totalSeconds) {
    if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "\u2014";
    const rounded = Math.round(totalSeconds);
    const hours = Math.floor(rounded / 3600);
    const minutes = Math.floor(rounded % 3600 / 60);
    const seconds = rounded % 60;
    if (hours > 0) {
      return `${hours}:${twoDigits(minutes)}:${twoDigits(seconds)}`;
    }
    return `${minutes}:${twoDigits(seconds)}`;
  }
  function describeTalkTest(value) {
    const descriptions = {
      "not-checked": {
        label: "Intensywno\u015B\u0107 nieoceniona",
        explanation: "Sama pr\u0119dko\u015B\u0107 nie m\xF3wi, jak mocno pracowa\u0142 Tw\xF3j organizm. Przy nast\u0119pnym marszu sprawd\u017A, czy mo\u017Cesz m\xF3wi\u0107 lub \u015Bpiewa\u0107."
      },
      easy: {
        label: "Lekka intensywno\u015B\u0107 wzgl\u0119dna",
        explanation: "Swobodna rozmowa i mo\u017Cliwo\u015B\u0107 \u015Bpiewania zwykle oznaczaj\u0105 lekki wysi\u0142ek wzgl\u0119dem Twojej aktualnej kondycji."
      },
      moderate: {
        label: "Umiarkowana intensywno\u015B\u0107 wzgl\u0119dna",
        explanation: "Mo\u017Cesz m\xF3wi\u0107, ale nie \u015Bpiewa\u0107. CDC opisuje tak prosty test umiarkowanej intensywno\u015Bci."
      },
      vigorous: {
        label: "Wysoka intensywno\u015B\u0107 wzgl\u0119dna",
        explanation: "Tylko kilka s\u0142\xF3w bez przerwy na oddech wskazuje na wysoki wysi\u0142ek. Zwolnij, je\u015Bli taka intensywno\u015B\u0107 nie by\u0142a zamierzona."
      }
    };
    return descriptions[value];
  }
  function paceChangeSeconds(current, previous) {
    if (!Number.isFinite(current) || !Number.isFinite(previous)) return 0;
    return current - previous;
  }

  // src/walking-pace-calculator.ts
  var STORAGE_KEY = "fitpo50.walking-pace.v1";
  var SVG_NS = "http://www.w3.org/2000/svg";
  var form = document.querySelector("[data-walk-form]");
  var distanceInput = document.querySelector("[data-walk-distance]");
  var distanceUnitInput = document.querySelector("[data-walk-distance-unit]");
  var hoursInput = document.querySelector("[data-walk-hours]");
  var minutesInput = document.querySelector("[data-walk-minutes]");
  var secondsInput = document.querySelector("[data-walk-seconds]");
  var dateInput = document.querySelector("[data-walk-date]");
  var errorNode = document.querySelector("[data-walk-error]");
  var emptyNode = document.querySelector("[data-walk-empty]");
  var contentNode = document.querySelector("[data-walk-content]");
  var paceNode = document.querySelector("[data-walk-pace]");
  var speedNode = document.querySelector("[data-walk-speed]");
  var oneKmNode = document.querySelector("[data-walk-one-km]");
  var threeKmNode = document.querySelector("[data-walk-three-km]");
  var fiveKmNode = document.querySelector("[data-walk-five-km]");
  var intensityNode = document.querySelector("[data-walk-intensity]");
  var intensityCopyNode = document.querySelector("[data-walk-intensity-copy]");
  var saveButton = document.querySelector("[data-walk-save]");
  var clearButton = document.querySelector("[data-walk-clear]");
  var historyEmptyNode = document.querySelector("[data-walk-history-empty]");
  var historyTable = document.querySelector("[data-walk-history-table]");
  var historyBody = document.querySelector("[data-walk-history-body]");
  var chart = document.querySelector("[data-walk-chart]");
  var chartEmpty = document.querySelector("[data-walk-chart-empty]");
  var latestResult = null;
  var latestTalkTest = "not-checked";
  function parseFloatInput(input) {
    const normalized = input.value.trim().replace(",", ".");
    if (!normalized) return null;
    const value = Number(normalized);
    return Number.isFinite(value) ? value : null;
  }
  function parseIntegerInput(input) {
    const normalized = input.value.trim();
    if (!normalized) return 0;
    const value = Number(normalized);
    return Number.isInteger(value) ? value : null;
  }
  function getTalkTest() {
    const selected = document.querySelector('input[name="walk-talk-test"]:checked');
    const value = selected == null ? void 0 : selected.value;
    if (value === "easy" || value === "moderate" || value === "vigorous") return value;
    return "not-checked";
  }
  function isHistoryItem(value) {
    if (typeof value !== "object" || value === null) return false;
    const item = value;
    return typeof item.id === "string" && typeof item.date === "string" && typeof item.distanceKm === "number" && typeof item.durationSeconds === "number" && typeof item.paceSecondsPerKm === "number" && typeof item.speedKmh === "number" && typeof item.createdAt === "number" && (item.talkTest === "not-checked" || item.talkTest === "easy" || item.talkTest === "moderate" || item.talkTest === "vigorous");
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
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(-30)));
    } catch (_) {
    }
  }
  function formatDate(value) {
    const parts = value.split("-");
    return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : value;
  }
  function createSvgElement(name) {
    return document.createElementNS(SVG_NS, name);
  }
  function renderChart(items) {
    if (!chart || !chartEmpty) return;
    chart.replaceChildren();
    const recent = [...items].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt).slice(-8);
    chart.toggleAttribute("hidden", recent.length === 0);
    chartEmpty.hidden = recent.length > 0;
    if (recent.length === 0) return;
    const title = createSvgElement("title");
    title.textContent = "Tempo ostatnich zapisanych marsz\xF3w. Im wy\u017Cej znajduje si\u0119 punkt, tym kr\xF3tszy czas na kilometr.";
    chart.appendChild(title);
    const left = 42;
    const right = 638;
    const top = 24;
    const bottom = 166;
    const paces = recent.map((item) => item.paceSecondsPerKm);
    const rawMin = Math.min(...paces);
    const rawMax = Math.max(...paces);
    const range = Math.max(rawMax - rawMin, 60);
    const min = rawMin - (range - (rawMax - rawMin)) / 2;
    const max = rawMax + (range - (rawMax - rawMin)) / 2;
    [top, (top + bottom) / 2, bottom].forEach((y) => {
      const line = createSvgElement("line");
      line.setAttribute("x1", String(left));
      line.setAttribute("x2", String(right));
      line.setAttribute("y1", String(y));
      line.setAttribute("y2", String(y));
      line.setAttribute("class", "walk-chart__grid");
      chart.appendChild(line);
    });
    const points = recent.map((item, index) => {
      const x = recent.length === 1 ? (left + right) / 2 : left + (right - left) * index / (recent.length - 1);
      const y = top + (item.paceSecondsPerKm - min) / (max - min) * (bottom - top);
      return { item, x, y };
    });
    if (points.length > 1) {
      const polyline = createSvgElement("polyline");
      polyline.setAttribute("points", points.map((point) => `${point.x},${point.y}`).join(" "));
      polyline.setAttribute("class", "walk-chart__line");
      chart.appendChild(polyline);
    }
    points.forEach(({ item, x, y }) => {
      const circle = createSvgElement("circle");
      circle.setAttribute("cx", String(x));
      circle.setAttribute("cy", String(y));
      circle.setAttribute("r", "7");
      circle.setAttribute("class", "walk-chart__dot");
      const pointTitle = createSvgElement("title");
      pointTitle.textContent = `${formatDate(item.date)}: ${formatPace(item.paceSecondsPerKm)} min/km`;
      circle.appendChild(pointTitle);
      chart.appendChild(circle);
      const label = createSvgElement("text");
      label.setAttribute("x", String(x));
      label.setAttribute("y", "202");
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("class", "walk-chart__label");
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
      const chronologicalIndex = items.findIndex((candidate) => candidate.id === item.id);
      const previous = chronologicalIndex > 0 ? items[chronologicalIndex - 1] : null;
      const change = previous ? paceChangeSeconds(item.paceSecondsPerKm, previous.paceSecondsPerKm) : null;
      const row = document.createElement("tr");
      const dateCell = document.createElement("th");
      dateCell.scope = "row";
      dateCell.textContent = formatDate(item.date);
      const distanceCell = document.createElement("td");
      distanceCell.textContent = `${item.distanceKm.toLocaleString("pl-PL", { maximumFractionDigits: 2 })} km`;
      const paceCell = document.createElement("td");
      paceCell.textContent = `${formatPace(item.paceSecondsPerKm)} min/km`;
      const changeCell = document.createElement("td");
      if (change === null || Math.abs(change) < 1) {
        changeCell.textContent = change === null ? "\u2014" : "bez zmiany";
      } else {
        const direction = change < 0 ? "szybciej" : "wolniej";
        changeCell.textContent = `${formatDuration(Math.abs(change))} ${direction}`;
      }
      row.append(dateCell, distanceCell, paceCell, changeCell);
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
    safeDateInput.value = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    safeForm.addEventListener("input", resetResult);
    safeForm.addEventListener("change", resetResult);
    safeForm.addEventListener("submit", (event) => {
      event.preventDefault();
      safeErrorNode.hidden = true;
      const distanceValue = parseFloatInput(safeDistanceInput);
      const hours = parseIntegerInput(safeHoursInput);
      const minutes = parseIntegerInput(safeMinutesInput);
      const seconds = parseIntegerInput(safeSecondsInput);
      if (distanceValue === null) {
        safeErrorNode.textContent = "Podaj d\u0142ugo\u015B\u0107 zmierzonej trasy.";
        safeErrorNode.hidden = false;
        return;
      }
      if (hours === null || minutes === null || seconds === null || minutes > 59 || seconds > 59) {
        safeErrorNode.textContent = "Podaj czas poprawnie: minuty i sekundy od 0 do 59.";
        safeErrorNode.hidden = false;
        return;
      }
      try {
        const distanceKm = convertDistanceToKm(distanceValue, safeDistanceUnitInput.value);
        const durationSeconds = durationToSeconds(hours, minutes, seconds);
        if (distanceKm < 0.05 || distanceKm > 100) {
          throw new RangeError("distance");
        }
        if (durationSeconds < 30 || durationSeconds > 86400) {
          throw new RangeError("duration");
        }
        const result = calculateWalkingPace(distanceKm, durationSeconds);
        if (result.speedKmh > 25) {
          safeErrorNode.textContent = "Wynik przekracza 25 km/h. Sprawd\u017A dystans i czas.";
          safeErrorNode.hidden = false;
          return;
        }
        latestTalkTest = getTalkTest();
        const intensity = describeTalkTest(latestTalkTest);
        latestResult = result;
        paceNode.textContent = formatPace(result.paceSecondsPerKm);
        speedNode.textContent = result.speedKmh.toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
        oneKmNode.textContent = formatDuration(result.oneKmSeconds);
        threeKmNode.textContent = formatDuration(result.threeKmSeconds);
        fiveKmNode.textContent = formatDuration(result.fiveKmSeconds);
        intensityNode.textContent = intensity.label;
        intensityCopyNode.textContent = intensity.explanation;
        safeEmptyNode.hidden = true;
        safeContentNode.hidden = false;
      } catch (_) {
        safeErrorNode.textContent = "Podaj dystans od 50 m do 100 km i czas od 30 sekund do 24 godzin.";
        safeErrorNode.hidden = false;
      }
    });
    safeSaveButton.addEventListener("click", () => {
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
      safeSaveButton.textContent = "Marsz zapisany \u2713";
      window.setTimeout(() => {
        safeSaveButton.textContent = "Zapisz marsz na tym urz\u0105dzeniu";
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
  renderHistory();
})();
