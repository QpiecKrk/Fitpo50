"use strict";
(() => {
  // src/waist-height-core.ts
  function classifyWaistHeightRatio(ratio) {
    if (ratio < 0.4) return "below-range";
    if (ratio < 0.5) return "healthy";
    if (ratio < 0.6) return "increased";
    return "high";
  }
  function calculateWaistHeight(heightCm, waistCm) {
    const ratio = Math.round(waistCm / heightCm * 100) / 100;
    const halfHeightCm = heightCm / 2;
    return {
      ratio,
      halfHeightCm,
      differenceFromHalfCm: waistCm - halfHeightCm,
      level: classifyWaistHeightRatio(ratio)
    };
  }
  function calculateBmi(heightCm, weightKg) {
    const heightM = heightCm / 100;
    return weightKg / (heightM * heightM);
  }

  // src/waist-height-calculator.ts
  var STORAGE_KEY = "fitpo50-waist-height-history-v1";
  var form = document.querySelector("[data-whtr-form]");
  var heightInput = document.querySelector("[data-whtr-height]");
  var waistInput = document.querySelector("[data-whtr-waist]");
  var weightInput = document.querySelector("[data-whtr-weight]");
  var dateInput = document.querySelector("[data-whtr-date]");
  var errorNode = document.querySelector("[data-whtr-error]");
  var emptyNode = document.querySelector("[data-whtr-empty]");
  var contentNode = document.querySelector("[data-whtr-content]");
  var ratioNode = document.querySelector("[data-whtr-ratio]");
  var levelNode = document.querySelector("[data-whtr-level]");
  var headlineNode = document.querySelector("[data-whtr-headline]");
  var explanationNode = document.querySelector("[data-whtr-explanation]");
  var halfNode = document.querySelector("[data-whtr-half]");
  var differenceNode = document.querySelector("[data-whtr-difference]");
  var applicabilityNode = document.querySelector("[data-whtr-applicability]");
  var saveButton = document.querySelector("[data-whtr-save]");
  var clearButton = document.querySelector("[data-whtr-clear]");
  var historyEmptyNode = document.querySelector("[data-whtr-history-empty]");
  var historyTable = document.querySelector("[data-whtr-history-table]");
  var historyBody = document.querySelector("[data-whtr-history-body]");
  var latestResult = null;
  function parseNumber(input) {
    const raw = input.value.trim();
    if (raw === "") return null;
    const value = Number(raw.replace(",", "."));
    return Number.isFinite(value) ? value : null;
  }
  function readHistory() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item) => {
        if (typeof item !== "object" || item === null) return false;
        const candidate = item;
        return typeof candidate.id === "string" && typeof candidate.date === "string" && typeof candidate.heightCm === "number" && typeof candidate.waistCm === "number" && typeof candidate.ratio === "number";
      }).slice(-12);
    } catch (_) {
      return [];
    }
  }
  function writeHistory(items) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(-12)));
    } catch (_) {
      if (errorNode) {
        errorNode.textContent = "Przegl\u0105darka nie pozwoli\u0142a zapisa\u0107 historii na tym urz\u0105dzeniu.";
        errorNode.hidden = false;
      }
    }
  }
  function formatDate(date) {
    const parts = date.split("-");
    return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : date;
  }
  function renderHistory() {
    if (!historyEmptyNode || !historyTable || !historyBody || !clearButton) return;
    const items = readHistory().sort((a, b) => a.date.localeCompare(b.date));
    historyBody.replaceChildren();
    historyEmptyNode.hidden = items.length > 0;
    historyTable.hidden = items.length === 0;
    clearButton.hidden = items.length === 0;
    items.forEach((item, index) => {
      const previous = index > 0 ? items[index - 1] : null;
      const change = previous ? item.waistCm - previous.waistCm : null;
      const row = document.createElement("tr");
      const dateCell = document.createElement("th");
      dateCell.scope = "row";
      dateCell.textContent = formatDate(item.date);
      const waistCell = document.createElement("td");
      waistCell.textContent = `${item.waistCm.toLocaleString("pl-PL", { maximumFractionDigits: 1 })} cm`;
      const ratioCell = document.createElement("td");
      ratioCell.textContent = item.ratio.toFixed(2).replace(".", ",");
      const changeCell = document.createElement("td");
      changeCell.textContent = change === null ? "\u2014" : `${change > 0 ? "+" : ""}${change.toLocaleString("pl-PL", { maximumFractionDigits: 1 })} cm`;
      row.append(dateCell, waistCell, ratioCell, changeCell);
      historyBody.appendChild(row);
    });
  }
  function getLevelCopy(level) {
    const copy = {
      "below-range": {
        label: "Poni\u017Cej zakresu klasyfikacji",
        headline: "Wynik jest ni\u017Cszy ni\u017C zakres opisany przez NICE",
        explanation: "NICE rozpoczyna klasyfikacj\u0119 centralnego ot\u0142uszczenia od wyniku 0,40. Niska warto\u015B\u0107 sama nie rozpoznaje problemu, ale niezamierzony spadek masy lub obwodu warto om\xF3wi\u0107 ze specjalist\u0105."
      },
      healthy: {
        label: "Poni\u017Cej po\u0142owy wzrostu",
        headline: "Wynik nie wskazuje na zwi\u0119kszone ryzyko zwi\u0105zane z centralnym ot\u0142uszczeniem",
        explanation: "Zakres 0,40\u20130,49 NICE opisuje jako zdrowy poziom centralnego ot\u0142uszczenia. Nie oznacza to braku wszystkich innych czynnik\xF3w ryzyka."
      },
      increased: {
        label: "Podwy\u017Cszony",
        headline: "Obw\xF3d talii przekracza po\u0142ow\u0119 wzrostu",
        explanation: "Zakres 0,50\u20130,59 wskazuje na zwi\u0119kszone ryzyko zdrowotne zwi\u0105zane z centralnym ot\u0142uszczeniem. To sygna\u0142 do oceny tak\u017Ce ci\u015Bnienia, glikemii i lipid\xF3w."
      },
      high: {
        label: "Wysoki",
        headline: "Wynik wskazuje na wysoki poziom centralnego ot\u0142uszczenia",
        explanation: "Warto\u015B\u0107 0,60 lub wy\u017Csza oznacza wed\u0142ug NICE dalszy wzrost ryzyka. Wynik przesiewowy warto om\xF3wi\u0107 z lekarzem i zestawi\u0107 z pozosta\u0142ymi czynnikami ryzyka."
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
    safeDateInput.value = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    safeForm.addEventListener("input", () => {
      safeEmptyNode.hidden = false;
      safeContentNode.hidden = true;
      latestResult = null;
    });
    safeForm.addEventListener("submit", (event) => {
      event.preventDefault();
      safeErrorNode.hidden = true;
      const heightCm = parseNumber(safeHeightInput);
      const waistCm = parseNumber(safeWaistInput);
      const weightKg = parseNumber(safeWeightInput);
      if (heightCm === null || heightCm < 120 || heightCm > 230) {
        safeErrorNode.textContent = "Podaj wzrost od 120 do 230 cm.";
        safeErrorNode.hidden = false;
        return;
      }
      if (waistCm === null || waistCm < 40 || waistCm > 250) {
        safeErrorNode.textContent = "Podaj obw\xF3d talii od 40 do 250 cm.";
        safeErrorNode.hidden = false;
        return;
      }
      if (weightKg !== null && (weightKg < 30 || weightKg > 350)) {
        safeErrorNode.textContent = "Opcjonalna masa cia\u0142a powinna mie\u015Bci\u0107 si\u0119 od 30 do 350 kg.";
        safeErrorNode.hidden = false;
        return;
      }
      const result = calculateWaistHeight(heightCm, waistCm);
      const copy = getLevelCopy(result.level);
      latestResult = result;
      ratioNode.textContent = result.ratio.toFixed(2).replace(".", ",");
      levelNode.textContent = copy.label;
      headlineNode.textContent = copy.headline;
      explanationNode.textContent = copy.explanation;
      halfNode.textContent = `${result.halfHeightCm.toLocaleString("pl-PL", { maximumFractionDigits: 1 })} cm`;
      const differenceAbs = Math.abs(result.differenceFromHalfCm).toLocaleString("pl-PL", { maximumFractionDigits: 1 });
      differenceNode.textContent = result.differenceFromHalfCm > 0 ? `${differenceAbs} cm powy\u017Cej po\u0142owy wzrostu` : result.differenceFromHalfCm < 0 ? `${differenceAbs} cm poni\u017Cej po\u0142owy wzrostu` : "dok\u0142adnie po\u0142owa wzrostu";
      if (weightKg === null) {
        applicabilityNode.textContent = "Klasyfikacj\u0119 NICE stosuje si\u0119 przede wszystkim u doros\u0142ych z BMI poni\u017Cej 35. Bez masy cia\u0142a nie mo\u017Cemy sprawdzi\u0107 tego warunku.";
      } else {
        const bmi = calculateBmi(heightCm, weightKg);
        applicabilityNode.textContent = bmi < 35 ? `Podana masa cia\u0142a daje BMI ${bmi.toFixed(1).replace(".", ",")}. Klasyfikacja WHtR NICE obejmuje doros\u0142ych z BMI poni\u017Cej 35.` : `Podana masa cia\u0142a daje BMI ${bmi.toFixed(1).replace(".", ",")}. Przy BMI 35 lub wy\u017Cszym NICE nie opiera oceny centralnego ot\u0142uszczenia na samym WHtR.`;
      }
      safeEmptyNode.hidden = true;
      safeContentNode.hidden = false;
    });
    saveButton.addEventListener("click", () => {
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
      saveButton.textContent = "Pomiar zapisany \u2713";
      window.setTimeout(() => {
        saveButton.textContent = "Zapisz pomiar na tym urz\u0105dzeniu";
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
