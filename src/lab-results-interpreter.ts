import {
  calculateEgfr2021,
  compareWithLabRange,
  creatinineToMgDl,
  validateLabRange,
  type EquationSex,
  type LabRangeStatus
} from './lab-results-core';

type TestId = 'glucose' | 'hba1c' | 'ldl' | 'hdl' | 'triglycerides' | 'creatinine' | 'egfr' | 'alt' | 'ast' | 'tsh' | 'crp';

interface UnitOption {
  value: string;
  label: string;
}

interface TestDefinition {
  name: string;
  shortName: string;
  units: UnitOption[];
  measures: string;
  below: string;
  within: string;
  above: string;
  nextStep: string;
  sourceLabel: string;
  sourceUrl: string;
  articleLabel: string;
  articleUrl: string;
}

const TESTS: Record<TestId, TestDefinition> = {
  glucose: {
    name: 'Glukoza na czczo',
    shortName: 'Glukoza',
    units: [{ value: 'mmolL', label: 'mmol/L' }, { value: 'mgdL', label: 'mg/dL' }],
    measures: 'Pokazuje stężenie glukozy w chwili pobrania. Znaczenie wyniku zależy między innymi od tego, czy badanie rzeczywiście wykonano na czczo.',
    below: 'Niższy wynik może mieć związek z lekami obniżającymi glukozę, długim postem, alkoholem albo inną przyczyną. Objawy takie jak drżenie, poty, splątanie lub osłabienie wymagają szybkiej oceny.',
    within: 'Wynik mieści się w zakresie przepisanym z laboratorium. Pojedynczy pomiar nie pokazuje całego przebiegu glikemii i nie zastępuje oceny HbA1c lub innych badań, gdy są wskazane.',
    above: 'Wyższy wynik może być przejściowy albo związany z zaburzeniami gospodarki glukozowej. Do rozpoznania potrzebny jest właściwy kontekst i często potwierdzenie kolejnym badaniem.',
    nextStep: 'Sprawdź, czy pobranie było na czczo, oraz porównaj wynik z wcześniejszymi pomiarami. Jeśli odchylenie jest nowe lub się powtarza, omów je z lekarzem.',
    sourceLabel: 'NIDDK — badania glukozy i HbA1c',
    sourceUrl: 'https://www.niddk.nih.gov/health-information/professionals/clinical-tools-patient-management/diabetes/diabetes-prediabetes',
    articleLabel: 'Badania krwi po 50-tce',
    articleUrl: 'badania-krwi-po-50-jak-czesto.html'
  },
  hba1c: {
    name: 'Hemoglobina glikowana HbA1c',
    shortName: 'HbA1c',
    units: [{ value: 'percent', label: '%' }, { value: 'mmolMol', label: 'mmol/mol' }],
    measures: 'Odzwierciedla średni poziom glukozy mniej więcej z ostatnich trzech miesięcy. Nie pokazuje nagłych spadków ani pojedynczych skoków glukozy.',
    below: 'Wynik poniżej zakresu laboratorium sam nie wyjaśnia przyczyny. Na HbA1c mogą wpływać stany zmieniające czas życia krwinek, utrata krwi, transfuzja oraz niektóre choroby.',
    within: 'Wynik mieści się w zakresie wpisanym z laboratorium. Jeśli leczysz cukrzycę, indywidualny cel HbA1c może różnić się od zakresu referencyjnego.',
    above: 'Wyższe HbA1c oznacza wyższą średnią glikemię, ale rozpoznanie i cel leczenia wymagają uwzględnienia historii zdrowia oraz jakości oznaczenia.',
    nextStep: 'Porównaj wynik z wcześniejszym HbA1c i glukozą. Nie zmieniaj leków wyłącznie na podstawie interpretatora.',
    sourceLabel: 'NIDDK — test HbA1c',
    sourceUrl: 'https://www.niddk.nih.gov/health-information/diagnostic-tests/a1c-test',
    articleLabel: 'Badania krwi po 50-tce',
    articleUrl: 'badania-krwi-po-50-jak-czesto.html'
  },
  ldl: {
    name: 'Cholesterol LDL',
    shortName: 'LDL-C',
    units: [{ value: 'mgdL', label: 'mg/dL' }, { value: 'mmolL', label: 'mmol/L' }],
    measures: 'LDL-C opisuje ilość cholesterolu przenoszonego przez lipoproteiny LDL. Cel zależy od całkowitego ryzyka sercowo-naczyniowego i może być niższy niż zakres wydrukowany przez laboratorium.',
    below: 'Wynik poniżej zakresu laboratorium nie jest automatycznie niedoborem. Może być oczekiwanym skutkiem leczenia, zwłaszcza przy wysokim ryzyku sercowo-naczyniowym.',
    within: 'Wynik mieści się w zakresie laboratorium, ale nie przesądza, że osiągnięto indywidualny cel LDL-C. Ten cel zależy od ryzyka i przebytych chorób.',
    above: 'Wyższy LDL-C może zwiększać ryzyko odkładania cholesterolu w tętnicach. Znaczenie wyniku ocenia się razem z ryzykiem, leczeniem i pozostałymi lipidami.',
    nextStep: 'Przygotuj cały lipidogram, listę leków i informację o chorobach serca, udarze lub cukrzycy. Wtedy lekarz może ustalić właściwy cel LDL-C.',
    sourceLabel: 'NHLBI — diagnostyka cholesterolu',
    sourceUrl: 'https://www.nhlbi.nih.gov/health/blood-cholesterol/diagnosis',
    articleLabel: 'Centrum Cholesterolu po 50-tce',
    articleUrl: 'centrum-cholesterolu-po-50.html'
  },
  hdl: {
    name: 'Cholesterol HDL',
    shortName: 'HDL-C',
    units: [{ value: 'mgdL', label: 'mg/dL' }, { value: 'mmolL', label: 'mmol/L' }],
    measures: 'HDL-C jest częścią lipidogramu. Jego wyniku nie interpretuje się w oderwaniu od LDL-C, trójglicerydów i całkowitego ryzyka sercowo-naczyniowego.',
    below: 'Niższy HDL-C może współwystępować z większym ryzykiem metabolicznym, ale nie jest samodzielnym celem leczenia ani pełnym opisem ryzyka.',
    within: 'Wynik mieści się w zakresie laboratorium. Nadal liczą się LDL-C, trójglicerydy, ciśnienie, palenie, cukrzyca i przebyte choroby.',
    above: 'Wysoki HDL-C nie gwarantuje ochrony przed chorobami sercowo-naczyniowymi. Nie powinien równoważyć podwyższonego LDL-C lub innych czynników ryzyka.',
    nextStep: 'Oceniaj HDL-C jako część całego lipidogramu, a nie pojedynczy wynik do samodzielnego podnoszenia.',
    sourceLabel: 'NHLBI — panel lipidowy',
    sourceUrl: 'https://www.nhlbi.nih.gov/health/blood-cholesterol/diagnosis',
    articleLabel: 'Centrum Cholesterolu po 50-tce',
    articleUrl: 'centrum-cholesterolu-po-50.html'
  },
  triglycerides: {
    name: 'Trójglicerydy',
    shortName: 'TG',
    units: [{ value: 'mgdL', label: 'mg/dL' }, { value: 'mmolL', label: 'mmol/L' }],
    measures: 'Trójglicerydy są tłuszczami krążącymi we krwi. Na wynik mogą wpływać niedawny posiłek, alkohol, masa ciała, glikemia, leki i choroby.',
    below: 'Niższy wynik zwykle nie jest głównym problemem sam w sobie, ale powinien być czytany razem ze stanem odżywienia i pozostałymi badaniami.',
    within: 'Wynik mieści się w zakresie laboratorium. Porównując badania w czasie, sprawdź, czy pobrania wykonywano w podobnych warunkach.',
    above: 'Wyższe trójglicerydy mogą mieć związek z posiłkiem, alkoholem, nieprawidłową glikemią, lekami lub inną przyczyną. Bardzo duże odchylenie wymaga oceny lekarskiej.',
    nextStep: 'Sprawdź warunki pobrania i cały lipidogram. Przy powtarzającym się odchyleniu omów możliwe przyczyny oraz ryzyko z lekarzem.',
    sourceLabel: 'NHLBI — panel lipidowy',
    sourceUrl: 'https://www.nhlbi.nih.gov/health/blood-cholesterol/diagnosis',
    articleLabel: 'ApoB, ApoA i badania cholesterolu',
    articleUrl: 'apob-apoa-badania-cholesterol.html'
  },
  creatinine: {
    name: 'Kreatynina w surowicy',
    shortName: 'Kreatynina',
    units: [{ value: 'umolL', label: 'µmol/L' }, { value: 'mgdL', label: 'mg/dL' }],
    measures: 'Kreatynina jest produktem przemiany mięśni i pomaga oceniać filtrację nerek. Zależy również od masy mięśniowej, diety, nawodnienia i części leków.',
    below: 'Niższa kreatynina może występować między innymi przy małej masie mięśniowej lub niedożywieniu. Sama nie rozpoznaje choroby.',
    within: 'Wynik mieści się w zakresie laboratorium, ale prawidłowa kreatynina nie zawsze wyklucza wczesne zaburzenia nerek. Więcej informacji daje eGFR i ocena albuminy w moczu.',
    above: 'Wyższa kreatynina może mieć związek z gorszą filtracją nerek, odwodnieniem, wysiłkiem, mięsem w diecie lub inną przyczyną. Ważny jest trend i eGFR.',
    nextStep: 'Porównaj wynik z eGFR, wcześniejszą kreatyniną i badaniem albuminy w moczu. Nagłej zmiany nie oceniaj wyłącznie kalkulatorem.',
    sourceLabel: 'NIDDK — równanie eGFR dla dorosłych',
    sourceUrl: 'https://www.niddk.nih.gov/research-funding/research-programs/kidney-clinical-research-epidemiology/laboratory/glomerular-filtration-rate-equations/adults',
    articleLabel: 'Badania krwi po 50-tce',
    articleUrl: 'badania-krwi-po-50-jak-czesto.html'
  },
  egfr: {
    name: 'eGFR',
    shortName: 'eGFR',
    units: [{ value: 'mlMin', label: 'mL/min/1,73 m²' }],
    measures: 'eGFR jest szacunkiem filtracji kłębuszkowej. Zwykle wylicza się go z kreatyniny, wieku i płci używanej przez równanie.',
    below: 'Wynik poniżej zakresu laboratorium może wskazywać na mniejszą filtrację, ale pojedynczy pomiar nie rozpoznaje przewlekłej choroby nerek. Liczą się czas trwania, trend i albumina w moczu.',
    within: 'Wynik mieści się w zakresie laboratorium. Szacunkowe równania są mniej precyzyjne w niektórych sytuacjach, między innymi przy skrajnej masie mięśniowej.',
    above: 'Wysoki eGFR zwykle nie jest interpretowany tak samo jak wynik podwyższonego enzymu. Dokładność szacunku maleje przy wysokich wartościach.',
    nextStep: 'Zestaw eGFR z kreatyniną, wcześniejszymi wynikami i wskaźnikiem albumina/kreatynina w moczu, jeśli był oznaczony.',
    sourceLabel: 'KDIGO — ocena przewlekłej choroby nerek',
    sourceUrl: 'https://kdigo.org/guidelines/ckd-evaluation-and-management/',
    articleLabel: 'Badania po 50-tce',
    articleUrl: 'badania-po-50.html'
  },
  alt: {
    name: 'ALT (aminotransferaza alaninowa)',
    shortName: 'ALT',
    units: [{ value: 'uL', label: 'U/L' }],
    measures: 'ALT jest enzymem używanym do oceny możliwego uszkodzenia komórek wątroby. Sam wynik nie pokazuje dokładnie, jak sprawnie działa wątroba.',
    below: 'Wynik poniżej zakresu zwykle nie ma takiego znaczenia jak podwyższenie, ale ocena zależy od całego obrazu klinicznego.',
    within: 'Wynik mieści się w zakresie laboratorium. Prawidłowe ALT nie wyklucza każdej choroby wątroby.',
    above: 'Podwyższenie może mieć wiele przyczyn, w tym choroby wątroby, alkohol, leki lub suplementy. Skala i utrzymywanie się odchylenia mają znaczenie.',
    nextStep: 'Zbierz AST, ALP, bilirubinę, listę leków i suplementów oraz wcześniejsze wyniki przed rozmową z lekarzem.',
    sourceLabel: 'MedlinePlus — badania wątroby',
    sourceUrl: 'https://medlineplus.gov/lab-tests/liver-function-tests/',
    articleLabel: 'Badania krwi po 50-tce',
    articleUrl: 'badania-krwi-po-50-jak-czesto.html'
  },
  ast: {
    name: 'AST (aminotransferaza asparaginianowa)',
    shortName: 'AST',
    units: [{ value: 'uL', label: 'U/L' }],
    measures: 'AST jest enzymem obecnym między innymi w wątrobie i mięśniach. Dlatego podwyższenie nie wskazuje automatycznie jednego narządu.',
    below: 'Wynik poniżej zakresu zwykle nie ma takiego znaczenia jak podwyższenie, ale interpretacja zależy od pozostałych badań.',
    within: 'Wynik mieści się w zakresie laboratorium. Najwięcej informacji daje zestawienie go z ALT i innymi wynikami.',
    above: 'AST może wzrosnąć przy problemach z wątrobą, po intensywnym wysiłku lub uszkodzeniu mięśni. Potrzebny jest kontekst i porównanie z ALT.',
    nextStep: 'Sprawdź, czy przed pobraniem był intensywny trening, oraz przygotuj ALT, ALP, bilirubinę i listę leków do omówienia.',
    sourceLabel: 'MedlinePlus — badania wątroby',
    sourceUrl: 'https://medlineplus.gov/lab-tests/liver-function-tests/',
    articleLabel: 'Badania krwi po 50-tce',
    articleUrl: 'badania-krwi-po-50-jak-czesto.html'
  },
  tsh: {
    name: 'TSH',
    shortName: 'TSH',
    units: [{ value: 'miuL', label: 'mIU/L' }, { value: 'uiuMl', label: 'µIU/mL' }],
    measures: 'TSH jest hormonem przysadki sterującym tarczycą. Zbyt wysoki lub zbyt niski wynik może wskazywać na zaburzenie, ale nie podaje jego przyczyny.',
    below: 'Niższe TSH może występować przy nadmiarze hormonów tarczycy, leczeniu lub z innych przyczyn. Do interpretacji często potrzebne jest FT4, czasem FT3.',
    within: 'Wynik mieści się w zakresie laboratorium. U osób leczonych indywidualny cel może zależeć od wieku, chorób i powodu terapii.',
    above: 'Wyższe TSH może występować przy niedoborze hormonów tarczycy, zmianie dawki leku lub z innych przyczyn. Samo TSH nie wyjaśnia przyczyny.',
    nextStep: 'Porównaj TSH z FT4, objawami, dawką leku i wcześniejszymi wynikami. Nie zmieniaj dawki samodzielnie.',
    sourceLabel: 'MedlinePlus — badanie TSH',
    sourceUrl: 'https://medlineplus.gov/lab-tests/tsh-thyroid-stimulating-hormone-test/',
    articleLabel: 'Badania po 50-tce',
    articleUrl: 'badania-po-50.html'
  },
  crp: {
    name: 'CRP standardowe',
    shortName: 'CRP',
    units: [{ value: 'mgL', label: 'mg/L' }, { value: 'mgdL', label: 'mg/dL' }],
    measures: 'CRP jest białkiem wytwarzanym przez wątrobę w odpowiedzi na stan zapalny. Pokazuje nasilenie reakcji, ale nie mówi, gdzie leży przyczyna.',
    below: 'Niskie CRP zwykle oznacza małą aktywność ogólnej reakcji zapalnej w chwili pobrania. Nie wyklucza każdej choroby.',
    within: 'Wynik mieści się w zakresie laboratorium. Standardowe CRP i hs-CRP to badania używane w innym kontekście — upewnij się, które wykonano.',
    above: 'Podwyższone CRP może towarzyszyć infekcji, urazowi, chorobie zapalnej lub wielu innym stanom. Sam wynik nie ustala przyczyny.',
    nextStep: 'Połącz wynik z objawami, temperaturą, innymi badaniami i zaleceniami lekarza. Przy wyraźnym pogorszeniu samopoczucia nie czekaj na interpretację internetową.',
    sourceLabel: 'MedlinePlus — badanie CRP',
    sourceUrl: 'https://medlineplus.gov/lab-tests/c-reactive-protein-crp-test/',
    articleLabel: 'Badania krwi po 50-tce',
    articleUrl: 'badania-krwi-po-50-jak-czesto.html'
  }
};

const form = document.querySelector<HTMLFormElement>('[data-lab-form]');
const testSelect = document.querySelector<HTMLSelectElement>('[data-lab-test]');
const unitSelect = document.querySelector<HTMLSelectElement>('[data-lab-unit]');
const valueInput = document.querySelector<HTMLInputElement>('[data-lab-value]');
const lowerInput = document.querySelector<HTMLInputElement>('[data-lab-lower]');
const upperInput = document.querySelector<HTMLInputElement>('[data-lab-upper]');
const unitLabels = Array.from(document.querySelectorAll<HTMLElement>('[data-lab-unit-label]'));
const errorNode = document.querySelector<HTMLElement>('[data-lab-error]');
const emptyNode = document.querySelector<HTMLElement>('[data-lab-empty]');
const contentNode = document.querySelector<HTMLElement>('[data-lab-content]');
const statusNode = document.querySelector<HTMLElement>('[data-lab-status]');
const valueNode = document.querySelector<HTMLElement>('[data-lab-result-value]');
const titleNode = document.querySelector<HTMLElement>('[data-lab-result-title]');
const measureNode = document.querySelector<HTMLElement>('[data-lab-measure]');
const meaningNode = document.querySelector<HTMLElement>('[data-lab-meaning]');
const nextNode = document.querySelector<HTMLElement>('[data-lab-next]');
const sourceNode = document.querySelector<HTMLAnchorElement>('[data-lab-source]');
const articleNode = document.querySelector<HTMLAnchorElement>('[data-lab-article]');
const egfrNode = document.querySelector<HTMLElement>('[data-lab-egfr]');
const egfrValueNode = document.querySelector<HTMLElement>('[data-lab-egfr-value]');

if (form && testSelect && unitSelect && valueInput && lowerInput && upperInput && errorNode && emptyNode && contentNode && statusNode && valueNode && titleNode && measureNode && meaningNode && nextNode && sourceNode && articleNode && egfrNode && egfrValueNode) {
  const safeTestSelect = testSelect;
  const safeUnitSelect = unitSelect;
  const safeEmptyNode = emptyNode;
  const safeContentNode = contentNode;

  function parseOptional(input: HTMLInputElement): number | null {
    const raw = input.value.trim();
    return raw === '' ? null : Number(raw.replace(',', '.'));
  }

  function currentDefinition(): TestDefinition | null {
    const id = safeTestSelect.value as TestId;
    return Object.prototype.hasOwnProperty.call(TESTS, id) ? TESTS[id] : null;
  }

  function updateUnits(): void {
    const definition = currentDefinition();
    safeUnitSelect.replaceChildren();
    if (!definition) {
      safeUnitSelect.disabled = true;
      unitLabels.forEach((node) => { node.textContent = 'jednostka'; });
      return;
    }

    definition.units.forEach((unit) => {
      const option = document.createElement('option');
      option.value = unit.value;
      option.textContent = unit.label;
      safeUnitSelect.appendChild(option);
    });
    safeUnitSelect.disabled = definition.units.length === 1;
    unitLabels.forEach((node) => { node.textContent = definition.units[0].label; });
  }

  function syncUnitLabels(): void {
    const label = safeUnitSelect.options[safeUnitSelect.selectedIndex]?.textContent || 'jednostka';
    unitLabels.forEach((node) => { node.textContent = label; });
  }

  function resetResult(): void {
    safeEmptyNode.hidden = false;
    safeContentNode.hidden = true;
  }

  safeTestSelect.addEventListener('change', () => {
    updateUnits();
    valueInput.value = '';
    lowerInput.value = '';
    upperInput.value = '';
  });
  safeUnitSelect.addEventListener('change', () => {
    syncUnitLabels();
    valueInput.value = '';
    lowerInput.value = '';
    upperInput.value = '';
  });
  form.addEventListener('input', resetResult);
  form.addEventListener('change', resetResult);
  updateUnits();

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    errorNode.hidden = true;
    const definition = currentDefinition();
    const age = Number(new FormData(form).get('age'));
    const sex = String(new FormData(form).get('sex')) as EquationSex;
    const value = parseOptional(valueInput);
    const range = { lower: parseOptional(lowerInput), upper: parseOptional(upperInput) };

    if (!definition) {
      errorNode.textContent = 'Wybierz badanie.';
      errorNode.hidden = false;
      return;
    }

    if (safeTestSelect.value === 'creatinine' && (!Number.isInteger(age) || age < 50 || age > 120)) {
      errorNode.textContent = 'Podaj wiek od 50 do 120 lat.';
      errorNode.hidden = false;
      return;
    }

    if (safeTestSelect.value === 'creatinine' && sex !== 'female' && sex !== 'male') {
      errorNode.textContent = 'Wybierz płeć używaną we wzorze eGFR.';
      errorNode.hidden = false;
      return;
    }

    if (value === null || !Number.isFinite(value) || value < 0) {
      errorNode.textContent = 'Przepisz poprawną wartość wyniku.';
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
    const statusCopy: Record<LabRangeStatus, { badge: string; title: string }> = {
      below: { badge: 'Poniżej zakresu', title: 'Wynik jest poniżej wpisanego zakresu laboratorium' },
      within: { badge: 'W zakresie', title: 'Wynik mieści się we wpisanym zakresie laboratorium' },
      above: { badge: 'Powyżej zakresu', title: 'Wynik jest powyżej wpisanego zakresu laboratorium' }
    };

    contentNode.dataset.status = status;
    statusNode.textContent = statusCopy[status].badge;
    titleNode.textContent = statusCopy[status].title;
    valueNode.textContent = `${valueInput.value.replace('.', ',')} ${safeUnitSelect.options[safeUnitSelect.selectedIndex]?.textContent || ''}`;
    measureNode.textContent = definition.measures;
    meaningNode.textContent = definition[status];
    nextNode.textContent = definition.nextStep;
    sourceNode.textContent = definition.sourceLabel;
    sourceNode.href = definition.sourceUrl;
    articleNode.textContent = definition.articleLabel;
    articleNode.href = definition.articleUrl;

    egfrNode.hidden = true;
    if (safeTestSelect.value === 'creatinine') {
      const creatinineMgDl = creatinineToMgDl(value, safeUnitSelect.value as 'umolL' | 'mgdL');
      const egfr = calculateEgfr2021(creatinineMgDl, age, sex);
      if (Number.isFinite(egfr)) {
        egfrValueNode.textContent = `${Math.round(egfr)} mL/min/1,73 m²`;
        egfrNode.hidden = false;
      }
    }

    emptyNode.hidden = true;
    contentNode.hidden = false;
  });
}
