"use strict";
(() => {
  // src/lab-results-core.ts
  function validateLabRange(range) {
    if (range.lower === null && range.upper === null) {
      return "Przepisz co najmniej jedn\u0105 granic\u0119 zakresu z wyniku laboratoryjnego.";
    }
    if (range.lower !== null && (!Number.isFinite(range.lower) || range.lower < 0)) {
      return "Dolna granica musi by\u0107 liczb\u0105 r\xF3wn\u0105 lub wi\u0119ksz\u0105 od zera.";
    }
    if (range.upper !== null && (!Number.isFinite(range.upper) || range.upper < 0)) {
      return "G\xF3rna granica musi by\u0107 liczb\u0105 r\xF3wn\u0105 lub wi\u0119ksz\u0105 od zera.";
    }
    if (range.lower !== null && range.upper !== null && range.lower >= range.upper) {
      return "G\xF3rna granica musi by\u0107 wi\u0119ksza od dolnej.";
    }
    return null;
  }
  function compareWithLabRange(value, range) {
    if (range.lower !== null && value < range.lower) return "below";
    if (range.upper !== null && value > range.upper) return "above";
    return "within";
  }
  function creatinineToMgDl(value, unit) {
    return unit === "umolL" ? value / 88.4 : value;
  }
  function calculateEgfr2021(creatinineMgDl, age, sex) {
    if (!Number.isFinite(creatinineMgDl) || creatinineMgDl <= 0 || !Number.isFinite(age) || age < 18) {
      return Number.NaN;
    }
    const kappa = sex === "female" ? 0.7 : 0.9;
    const alpha = sex === "female" ? -0.241 : -0.302;
    const sexFactor = sex === "female" ? 1.012 : 1;
    const ratio = creatinineMgDl / kappa;
    return 142 * Math.pow(Math.min(ratio, 1), alpha) * Math.pow(Math.max(ratio, 1), -1.2) * Math.pow(0.9938, age) * sexFactor;
  }

  // src/lab-results-interpreter.ts
  var TESTS = {
    glucose: {
      name: "Glukoza na czczo",
      shortName: "Glukoza",
      units: [{ value: "mmolL", label: "mmol/L" }, { value: "mgdL", label: "mg/dL" }],
      measures: "Pokazuje st\u0119\u017Cenie glukozy w chwili pobrania. Znaczenie wyniku zale\u017Cy mi\u0119dzy innymi od tego, czy badanie rzeczywi\u015Bcie wykonano na czczo.",
      below: "Ni\u017Cszy wynik mo\u017Ce mie\u0107 zwi\u0105zek z lekami obni\u017Caj\u0105cymi glukoz\u0119, d\u0142ugim postem, alkoholem albo inn\u0105 przyczyn\u0105. Objawy takie jak dr\u017Cenie, poty, spl\u0105tanie lub os\u0142abienie wymagaj\u0105 szybkiej oceny.",
      within: "Wynik mie\u015Bci si\u0119 w zakresie przepisanym z laboratorium. Pojedynczy pomiar nie pokazuje ca\u0142ego przebiegu glikemii i nie zast\u0119puje oceny HbA1c lub innych bada\u0144, gdy s\u0105 wskazane.",
      above: "Wy\u017Cszy wynik mo\u017Ce by\u0107 przej\u015Bciowy albo zwi\u0105zany z zaburzeniami gospodarki glukozowej. Do rozpoznania potrzebny jest w\u0142a\u015Bciwy kontekst i cz\u0119sto potwierdzenie kolejnym badaniem.",
      nextStep: "Sprawd\u017A, czy pobranie by\u0142o na czczo, oraz por\xF3wnaj wynik z wcze\u015Bniejszymi pomiarami. Je\u015Bli odchylenie jest nowe lub si\u0119 powtarza, om\xF3w je z lekarzem.",
      sourceLabel: "NIDDK \u2014 badania glukozy i HbA1c",
      sourceUrl: "https://www.niddk.nih.gov/health-information/professionals/clinical-tools-patient-management/diabetes/diabetes-prediabetes",
      articleLabel: "Badania krwi po 50-tce",
      articleUrl: "badania-krwi-po-50-jak-czesto.html"
    },
    hba1c: {
      name: "Hemoglobina glikowana HbA1c",
      shortName: "HbA1c",
      units: [{ value: "percent", label: "%" }, { value: "mmolMol", label: "mmol/mol" }],
      measures: "Odzwierciedla \u015Bredni poziom glukozy mniej wi\u0119cej z ostatnich trzech miesi\u0119cy. Nie pokazuje nag\u0142ych spadk\xF3w ani pojedynczych skok\xF3w glukozy.",
      below: "Wynik poni\u017Cej zakresu laboratorium sam nie wyja\u015Bnia przyczyny. Na HbA1c mog\u0105 wp\u0142ywa\u0107 stany zmieniaj\u0105ce czas \u017Cycia krwinek, utrata krwi, transfuzja oraz niekt\xF3re choroby.",
      within: "Wynik mie\u015Bci si\u0119 w zakresie wpisanym z laboratorium. Je\u015Bli leczysz cukrzyc\u0119, indywidualny cel HbA1c mo\u017Ce r\xF3\u017Cni\u0107 si\u0119 od zakresu referencyjnego.",
      above: "Wy\u017Csze HbA1c oznacza wy\u017Csz\u0105 \u015Bredni\u0105 glikemi\u0119, ale rozpoznanie i cel leczenia wymagaj\u0105 uwzgl\u0119dnienia historii zdrowia oraz jako\u015Bci oznaczenia.",
      nextStep: "Por\xF3wnaj wynik z wcze\u015Bniejszym HbA1c i glukoz\u0105. Nie zmieniaj lek\xF3w wy\u0142\u0105cznie na podstawie interpretatora.",
      sourceLabel: "NIDDK \u2014 test HbA1c",
      sourceUrl: "https://www.niddk.nih.gov/health-information/diagnostic-tests/a1c-test",
      articleLabel: "Badania krwi po 50-tce",
      articleUrl: "badania-krwi-po-50-jak-czesto.html"
    },
    ldl: {
      name: "Cholesterol LDL",
      shortName: "LDL-C",
      units: [{ value: "mgdL", label: "mg/dL" }, { value: "mmolL", label: "mmol/L" }],
      measures: "LDL-C opisuje ilo\u015B\u0107 cholesterolu przenoszonego przez lipoproteiny LDL. Cel zale\u017Cy od ca\u0142kowitego ryzyka sercowo-naczyniowego i mo\u017Ce by\u0107 ni\u017Cszy ni\u017C zakres wydrukowany przez laboratorium.",
      below: "Wynik poni\u017Cej zakresu laboratorium nie jest automatycznie niedoborem. Mo\u017Ce by\u0107 oczekiwanym skutkiem leczenia, zw\u0142aszcza przy wysokim ryzyku sercowo-naczyniowym.",
      within: "Wynik mie\u015Bci si\u0119 w zakresie laboratorium, ale nie przes\u0105dza, \u017Ce osi\u0105gni\u0119to indywidualny cel LDL-C. Ten cel zale\u017Cy od ryzyka i przebytych chor\xF3b.",
      above: "Wy\u017Cszy LDL-C mo\u017Ce zwi\u0119ksza\u0107 ryzyko odk\u0142adania cholesterolu w t\u0119tnicach. Znaczenie wyniku ocenia si\u0119 razem z ryzykiem, leczeniem i pozosta\u0142ymi lipidami.",
      nextStep: "Przygotuj ca\u0142y lipidogram, list\u0119 lek\xF3w i informacj\u0119 o chorobach serca, udarze lub cukrzycy. Wtedy lekarz mo\u017Ce ustali\u0107 w\u0142a\u015Bciwy cel LDL-C.",
      sourceLabel: "NHLBI \u2014 diagnostyka cholesterolu",
      sourceUrl: "https://www.nhlbi.nih.gov/health/blood-cholesterol/diagnosis",
      articleLabel: "Centrum Cholesterolu po 50-tce",
      articleUrl: "centrum-cholesterolu-po-50.html"
    },
    hdl: {
      name: "Cholesterol HDL",
      shortName: "HDL-C",
      units: [{ value: "mgdL", label: "mg/dL" }, { value: "mmolL", label: "mmol/L" }],
      measures: "HDL-C jest cz\u0119\u015Bci\u0105 lipidogramu. Jego wyniku nie interpretuje si\u0119 w oderwaniu od LDL-C, tr\xF3jgliceryd\xF3w i ca\u0142kowitego ryzyka sercowo-naczyniowego.",
      below: "Ni\u017Cszy HDL-C mo\u017Ce wsp\xF3\u0142wyst\u0119powa\u0107 z wi\u0119kszym ryzykiem metabolicznym, ale nie jest samodzielnym celem leczenia ani pe\u0142nym opisem ryzyka.",
      within: "Wynik mie\u015Bci si\u0119 w zakresie laboratorium. Nadal licz\u0105 si\u0119 LDL-C, tr\xF3jglicerydy, ci\u015Bnienie, palenie, cukrzyca i przebyte choroby.",
      above: "Wysoki HDL-C nie gwarantuje ochrony przed chorobami sercowo-naczyniowymi. Nie powinien r\xF3wnowa\u017Cy\u0107 podwy\u017Cszonego LDL-C lub innych czynnik\xF3w ryzyka.",
      nextStep: "Oceniaj HDL-C jako cz\u0119\u015B\u0107 ca\u0142ego lipidogramu, a nie pojedynczy wynik do samodzielnego podnoszenia.",
      sourceLabel: "NHLBI \u2014 panel lipidowy",
      sourceUrl: "https://www.nhlbi.nih.gov/health/blood-cholesterol/diagnosis",
      articleLabel: "Centrum Cholesterolu po 50-tce",
      articleUrl: "centrum-cholesterolu-po-50.html"
    },
    triglycerides: {
      name: "Tr\xF3jglicerydy",
      shortName: "TG",
      units: [{ value: "mgdL", label: "mg/dL" }, { value: "mmolL", label: "mmol/L" }],
      measures: "Tr\xF3jglicerydy s\u0105 t\u0142uszczami kr\u0105\u017C\u0105cymi we krwi. Na wynik mog\u0105 wp\u0142ywa\u0107 niedawny posi\u0142ek, alkohol, masa cia\u0142a, glikemia, leki i choroby.",
      below: "Ni\u017Cszy wynik zwykle nie jest g\u0142\xF3wnym problemem sam w sobie, ale powinien by\u0107 czytany razem ze stanem od\u017Cywienia i pozosta\u0142ymi badaniami.",
      within: "Wynik mie\u015Bci si\u0119 w zakresie laboratorium. Por\xF3wnuj\u0105c badania w czasie, sprawd\u017A, czy pobrania wykonywano w podobnych warunkach.",
      above: "Wy\u017Csze tr\xF3jglicerydy mog\u0105 mie\u0107 zwi\u0105zek z posi\u0142kiem, alkoholem, nieprawid\u0142ow\u0105 glikemi\u0105, lekami lub inn\u0105 przyczyn\u0105. Bardzo du\u017Ce odchylenie wymaga oceny lekarskiej.",
      nextStep: "Sprawd\u017A warunki pobrania i ca\u0142y lipidogram. Przy powtarzaj\u0105cym si\u0119 odchyleniu om\xF3w mo\u017Cliwe przyczyny oraz ryzyko z lekarzem.",
      sourceLabel: "NHLBI \u2014 panel lipidowy",
      sourceUrl: "https://www.nhlbi.nih.gov/health/blood-cholesterol/diagnosis",
      articleLabel: "ApoB, ApoA i badania cholesterolu",
      articleUrl: "apob-apoa-badania-cholesterol.html"
    },
    creatinine: {
      name: "Kreatynina w surowicy",
      shortName: "Kreatynina",
      units: [{ value: "umolL", label: "\xB5mol/L" }, { value: "mgdL", label: "mg/dL" }],
      measures: "Kreatynina jest produktem przemiany mi\u0119\u015Bni i pomaga ocenia\u0107 filtracj\u0119 nerek. Zale\u017Cy r\xF3wnie\u017C od masy mi\u0119\u015Bniowej, diety, nawodnienia i cz\u0119\u015Bci lek\xF3w.",
      below: "Ni\u017Csza kreatynina mo\u017Ce wyst\u0119powa\u0107 mi\u0119dzy innymi przy ma\u0142ej masie mi\u0119\u015Bniowej lub niedo\u017Cywieniu. Sama nie rozpoznaje choroby.",
      within: "Wynik mie\u015Bci si\u0119 w zakresie laboratorium, ale prawid\u0142owa kreatynina nie zawsze wyklucza wczesne zaburzenia nerek. Wi\u0119cej informacji daje eGFR i ocena albuminy w moczu.",
      above: "Wy\u017Csza kreatynina mo\u017Ce mie\u0107 zwi\u0105zek z gorsz\u0105 filtracj\u0105 nerek, odwodnieniem, wysi\u0142kiem, mi\u0119sem w diecie lub inn\u0105 przyczyn\u0105. Wa\u017Cny jest trend i eGFR.",
      nextStep: "Por\xF3wnaj wynik z eGFR, wcze\u015Bniejsz\u0105 kreatynin\u0105 i badaniem albuminy w moczu. Nag\u0142ej zmiany nie oceniaj wy\u0142\u0105cznie kalkulatorem.",
      sourceLabel: "NIDDK \u2014 r\xF3wnanie eGFR dla doros\u0142ych",
      sourceUrl: "https://www.niddk.nih.gov/research-funding/research-programs/kidney-clinical-research-epidemiology/laboratory/glomerular-filtration-rate-equations/adults",
      articleLabel: "Badania krwi po 50-tce",
      articleUrl: "badania-krwi-po-50-jak-czesto.html"
    },
    egfr: {
      name: "eGFR",
      shortName: "eGFR",
      units: [{ value: "mlMin", label: "mL/min/1,73 m\xB2" }],
      measures: "eGFR jest szacunkiem filtracji k\u0142\u0119buszkowej. Zwykle wylicza si\u0119 go z kreatyniny, wieku i p\u0142ci u\u017Cywanej przez r\xF3wnanie.",
      below: "Wynik poni\u017Cej zakresu laboratorium mo\u017Ce wskazywa\u0107 na mniejsz\u0105 filtracj\u0119, ale pojedynczy pomiar nie rozpoznaje przewlek\u0142ej choroby nerek. Licz\u0105 si\u0119 czas trwania, trend i albumina w moczu.",
      within: "Wynik mie\u015Bci si\u0119 w zakresie laboratorium. Szacunkowe r\xF3wnania s\u0105 mniej precyzyjne w niekt\xF3rych sytuacjach, mi\u0119dzy innymi przy skrajnej masie mi\u0119\u015Bniowej.",
      above: "Wysoki eGFR zwykle nie jest interpretowany tak samo jak wynik podwy\u017Cszonego enzymu. Dok\u0142adno\u015B\u0107 szacunku maleje przy wysokich warto\u015Bciach.",
      nextStep: "Zestaw eGFR z kreatynin\u0105, wcze\u015Bniejszymi wynikami i wska\u017Anikiem albumina/kreatynina w moczu, je\u015Bli by\u0142 oznaczony.",
      sourceLabel: "KDIGO \u2014 ocena przewlek\u0142ej choroby nerek",
      sourceUrl: "https://kdigo.org/guidelines/ckd-evaluation-and-management/",
      articleLabel: "Badania po 50-tce",
      articleUrl: "badania-po-50.html"
    },
    alt: {
      name: "ALT (aminotransferaza alaninowa)",
      shortName: "ALT",
      units: [{ value: "uL", label: "U/L" }],
      measures: "ALT jest enzymem u\u017Cywanym do oceny mo\u017Cliwego uszkodzenia kom\xF3rek w\u0105troby. Sam wynik nie pokazuje dok\u0142adnie, jak sprawnie dzia\u0142a w\u0105troba.",
      below: "Wynik poni\u017Cej zakresu zwykle nie ma takiego znaczenia jak podwy\u017Cszenie, ale ocena zale\u017Cy od ca\u0142ego obrazu klinicznego.",
      within: "Wynik mie\u015Bci si\u0119 w zakresie laboratorium. Prawid\u0142owe ALT nie wyklucza ka\u017Cdej choroby w\u0105troby.",
      above: "Podwy\u017Cszenie mo\u017Ce mie\u0107 wiele przyczyn, w tym choroby w\u0105troby, alkohol, leki lub suplementy. Skala i utrzymywanie si\u0119 odchylenia maj\u0105 znaczenie.",
      nextStep: "Zbierz AST, ALP, bilirubin\u0119, list\u0119 lek\xF3w i suplement\xF3w oraz wcze\u015Bniejsze wyniki przed rozmow\u0105 z lekarzem.",
      sourceLabel: "MedlinePlus \u2014 badania w\u0105troby",
      sourceUrl: "https://medlineplus.gov/lab-tests/liver-function-tests/",
      articleLabel: "Badania krwi po 50-tce",
      articleUrl: "badania-krwi-po-50-jak-czesto.html"
    },
    ast: {
      name: "AST (aminotransferaza asparaginianowa)",
      shortName: "AST",
      units: [{ value: "uL", label: "U/L" }],
      measures: "AST jest enzymem obecnym mi\u0119dzy innymi w w\u0105trobie i mi\u0119\u015Bniach. Dlatego podwy\u017Cszenie nie wskazuje automatycznie jednego narz\u0105du.",
      below: "Wynik poni\u017Cej zakresu zwykle nie ma takiego znaczenia jak podwy\u017Cszenie, ale interpretacja zale\u017Cy od pozosta\u0142ych bada\u0144.",
      within: "Wynik mie\u015Bci si\u0119 w zakresie laboratorium. Najwi\u0119cej informacji daje zestawienie go z ALT i innymi wynikami.",
      above: "AST mo\u017Ce wzrosn\u0105\u0107 przy problemach z w\u0105trob\u0105, po intensywnym wysi\u0142ku lub uszkodzeniu mi\u0119\u015Bni. Potrzebny jest kontekst i por\xF3wnanie z ALT.",
      nextStep: "Sprawd\u017A, czy przed pobraniem by\u0142 intensywny trening, oraz przygotuj ALT, ALP, bilirubin\u0119 i list\u0119 lek\xF3w do om\xF3wienia.",
      sourceLabel: "MedlinePlus \u2014 badania w\u0105troby",
      sourceUrl: "https://medlineplus.gov/lab-tests/liver-function-tests/",
      articleLabel: "Badania krwi po 50-tce",
      articleUrl: "badania-krwi-po-50-jak-czesto.html"
    },
    tsh: {
      name: "TSH",
      shortName: "TSH",
      units: [{ value: "miuL", label: "mIU/L" }, { value: "uiuMl", label: "\xB5IU/mL" }],
      measures: "TSH jest hormonem przysadki steruj\u0105cym tarczyc\u0105. Zbyt wysoki lub zbyt niski wynik mo\u017Ce wskazywa\u0107 na zaburzenie, ale nie podaje jego przyczyny.",
      below: "Ni\u017Csze TSH mo\u017Ce wyst\u0119powa\u0107 przy nadmiarze hormon\xF3w tarczycy, leczeniu lub z innych przyczyn. Do interpretacji cz\u0119sto potrzebne jest FT4, czasem FT3.",
      within: "Wynik mie\u015Bci si\u0119 w zakresie laboratorium. U os\xF3b leczonych indywidualny cel mo\u017Ce zale\u017Ce\u0107 od wieku, chor\xF3b i powodu terapii.",
      above: "Wy\u017Csze TSH mo\u017Ce wyst\u0119powa\u0107 przy niedoborze hormon\xF3w tarczycy, zmianie dawki leku lub z innych przyczyn. Samo TSH nie wyja\u015Bnia przyczyny.",
      nextStep: "Por\xF3wnaj TSH z FT4, objawami, dawk\u0105 leku i wcze\u015Bniejszymi wynikami. Nie zmieniaj dawki samodzielnie.",
      sourceLabel: "MedlinePlus \u2014 badanie TSH",
      sourceUrl: "https://medlineplus.gov/lab-tests/tsh-thyroid-stimulating-hormone-test/",
      articleLabel: "Badania po 50-tce",
      articleUrl: "badania-po-50.html"
    },
    crp: {
      name: "CRP standardowe",
      shortName: "CRP",
      units: [{ value: "mgL", label: "mg/L" }, { value: "mgdL", label: "mg/dL" }],
      measures: "CRP jest bia\u0142kiem wytwarzanym przez w\u0105trob\u0119 w odpowiedzi na stan zapalny. Pokazuje nasilenie reakcji, ale nie m\xF3wi, gdzie le\u017Cy przyczyna.",
      below: "Niskie CRP zwykle oznacza ma\u0142\u0105 aktywno\u015B\u0107 og\xF3lnej reakcji zapalnej w chwili pobrania. Nie wyklucza ka\u017Cdej choroby.",
      within: "Wynik mie\u015Bci si\u0119 w zakresie laboratorium. Standardowe CRP i hs-CRP to badania u\u017Cywane w innym kontek\u015Bcie \u2014 upewnij si\u0119, kt\xF3re wykonano.",
      above: "Podwy\u017Cszone CRP mo\u017Ce towarzyszy\u0107 infekcji, urazowi, chorobie zapalnej lub wielu innym stanom. Sam wynik nie ustala przyczyny.",
      nextStep: "Po\u0142\u0105cz wynik z objawami, temperatur\u0105, innymi badaniami i zaleceniami lekarza. Przy wyra\u017Anym pogorszeniu samopoczucia nie czekaj na interpretacj\u0119 internetow\u0105.",
      sourceLabel: "MedlinePlus \u2014 badanie CRP",
      sourceUrl: "https://medlineplus.gov/lab-tests/c-reactive-protein-crp-test/",
      articleLabel: "Badania krwi po 50-tce",
      articleUrl: "badania-krwi-po-50-jak-czesto.html"
    }
  };
  var form = document.querySelector("[data-lab-form]");
  var testSelect = document.querySelector("[data-lab-test]");
  var unitSelect = document.querySelector("[data-lab-unit]");
  var valueInput = document.querySelector("[data-lab-value]");
  var lowerInput = document.querySelector("[data-lab-lower]");
  var upperInput = document.querySelector("[data-lab-upper]");
  var unitLabels = Array.from(document.querySelectorAll("[data-lab-unit-label]"));
  var errorNode = document.querySelector("[data-lab-error]");
  var emptyNode = document.querySelector("[data-lab-empty]");
  var contentNode = document.querySelector("[data-lab-content]");
  var statusNode = document.querySelector("[data-lab-status]");
  var valueNode = document.querySelector("[data-lab-result-value]");
  var titleNode = document.querySelector("[data-lab-result-title]");
  var measureNode = document.querySelector("[data-lab-measure]");
  var meaningNode = document.querySelector("[data-lab-meaning]");
  var nextNode = document.querySelector("[data-lab-next]");
  var sourceNode = document.querySelector("[data-lab-source]");
  var articleNode = document.querySelector("[data-lab-article]");
  var egfrNode = document.querySelector("[data-lab-egfr]");
  var egfrValueNode = document.querySelector("[data-lab-egfr-value]");
  if (form && testSelect && unitSelect && valueInput && lowerInput && upperInput && errorNode && emptyNode && contentNode && statusNode && valueNode && titleNode && measureNode && meaningNode && nextNode && sourceNode && articleNode && egfrNode && egfrValueNode) {
    let parseOptional = function(input) {
      const raw = input.value.trim();
      return raw === "" ? null : Number(raw.replace(",", "."));
    }, currentDefinition = function() {
      const id = safeTestSelect.value;
      return Object.prototype.hasOwnProperty.call(TESTS, id) ? TESTS[id] : null;
    }, updateUnits = function() {
      const definition = currentDefinition();
      safeUnitSelect.replaceChildren();
      if (!definition) {
        safeUnitSelect.disabled = true;
        unitLabels.forEach((node) => {
          node.textContent = "jednostka";
        });
        return;
      }
      definition.units.forEach((unit) => {
        const option = document.createElement("option");
        option.value = unit.value;
        option.textContent = unit.label;
        safeUnitSelect.appendChild(option);
      });
      safeUnitSelect.disabled = definition.units.length === 1;
      unitLabels.forEach((node) => {
        node.textContent = definition.units[0].label;
      });
    }, syncUnitLabels = function() {
      var _a;
      const label = ((_a = safeUnitSelect.options[safeUnitSelect.selectedIndex]) == null ? void 0 : _a.textContent) || "jednostka";
      unitLabels.forEach((node) => {
        node.textContent = label;
      });
    }, resetResult = function() {
      safeEmptyNode.hidden = false;
      safeContentNode.hidden = true;
    };
    parseOptional2 = parseOptional, currentDefinition2 = currentDefinition, updateUnits2 = updateUnits, syncUnitLabels2 = syncUnitLabels, resetResult2 = resetResult;
    const safeTestSelect = testSelect;
    const safeUnitSelect = unitSelect;
    const safeEmptyNode = emptyNode;
    const safeContentNode = contentNode;
    safeTestSelect.addEventListener("change", () => {
      updateUnits();
      valueInput.value = "";
      lowerInput.value = "";
      upperInput.value = "";
    });
    safeUnitSelect.addEventListener("change", () => {
      syncUnitLabels();
      valueInput.value = "";
      lowerInput.value = "";
      upperInput.value = "";
    });
    form.addEventListener("input", resetResult);
    form.addEventListener("change", resetResult);
    updateUnits();
    form.addEventListener("submit", (event) => {
      var _a;
      event.preventDefault();
      errorNode.hidden = true;
      const definition = currentDefinition();
      const age = Number(new FormData(form).get("age"));
      const sex = String(new FormData(form).get("sex"));
      const value = parseOptional(valueInput);
      const range = { lower: parseOptional(lowerInput), upper: parseOptional(upperInput) };
      if (!definition) {
        errorNode.textContent = "Wybierz badanie.";
        errorNode.hidden = false;
        return;
      }
      if (safeTestSelect.value === "creatinine" && (!Number.isInteger(age) || age < 50 || age > 120)) {
        errorNode.textContent = "Podaj wiek od 50 do 120 lat.";
        errorNode.hidden = false;
        return;
      }
      if (safeTestSelect.value === "creatinine" && sex !== "female" && sex !== "male") {
        errorNode.textContent = "Wybierz p\u0142e\u0107 u\u017Cywan\u0105 we wzorze eGFR.";
        errorNode.hidden = false;
        return;
      }
      if (value === null || !Number.isFinite(value) || value < 0) {
        errorNode.textContent = "Przepisz poprawn\u0105 warto\u015B\u0107 wyniku.";
        errorNode.hidden = false;
        return;
      }
      const rangeError = validateLabRange(range);
      if (rangeError) {
        errorNode.textContent = rangeError;
        errorNode.hidden = false;
        return;
      }
      const status = compareWithLabRange(value, range);
      const statusCopy = {
        below: { badge: "Poni\u017Cej zakresu", title: "Wynik jest poni\u017Cej wpisanego zakresu laboratorium" },
        within: { badge: "W zakresie", title: "Wynik mie\u015Bci si\u0119 we wpisanym zakresie laboratorium" },
        above: { badge: "Powy\u017Cej zakresu", title: "Wynik jest powy\u017Cej wpisanego zakresu laboratorium" }
      };
      contentNode.dataset.status = status;
      statusNode.textContent = statusCopy[status].badge;
      titleNode.textContent = statusCopy[status].title;
      valueNode.textContent = `${valueInput.value.replace(".", ",")} ${((_a = safeUnitSelect.options[safeUnitSelect.selectedIndex]) == null ? void 0 : _a.textContent) || ""}`;
      measureNode.textContent = definition.measures;
      meaningNode.textContent = definition[status];
      nextNode.textContent = definition.nextStep;
      sourceNode.textContent = definition.sourceLabel;
      sourceNode.href = definition.sourceUrl;
      articleNode.textContent = definition.articleLabel;
      articleNode.href = definition.articleUrl;
      egfrNode.hidden = true;
      if (safeTestSelect.value === "creatinine") {
        const creatinineMgDl = creatinineToMgDl(value, safeUnitSelect.value);
        const egfr = calculateEgfr2021(creatinineMgDl, age, sex);
        if (Number.isFinite(egfr)) {
          egfrValueNode.textContent = `${Math.round(egfr)} mL/min/1,73 m\xB2`;
          egfrNode.hidden = false;
        }
      }
      emptyNode.hidden = true;
      contentNode.hidden = false;
    });
  }
  var parseOptional2;
  var currentDefinition2;
  var updateUnits2;
  var syncUnitLabels2;
  var resetResult2;
})();
