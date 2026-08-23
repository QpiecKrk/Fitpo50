#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const MODIFIED = '2026-08-23T22:15:00+02:00';

const articles = [
  {
    file: 'motywacja-zniknela-po-50.html',
    title: 'Brak motywacji po 50-tce: jak wrócić do ruchu',
    h1: 'Brak motywacji po 50-tce: jak skutecznie wrócić do ruchu?',
    description: 'Brak motywacji po 50-tce nie przekreśla aktywności. Zobacz, jak ustawić mały próg wejścia, plan jeśli–to i środowisko, które ułatwia powrót do ruchu.',
    quick: 'Motywacja może zmieniać się z dnia na dzień, dlatego nie powinna być jedynym warunkiem treningu. Ustal minimalną wersję ruchu na 10 minut, konkretną porę i plan „jeśli–to”. Jeżeli spadkowi napędu przez co najmniej dwa tygodnie towarzyszą obniżony nastrój, utrata przyjemności lub problemy ze snem, skontaktuj się z lekarzem albo psychologiem.',
    takeaways: ['Plan „jeśli–to” łączy sytuację z konkretnym zachowaniem, lecz jego skuteczność różni się między osobami.', 'Nawyk nie powstaje zawsze w 21 dni; w badaniach czas był bardzo zróżnicowany.', 'Minimalna sesja ma utrzymać kontakt z ruchem, a nie udawać pełnego treningu.', 'Utrzymujący się brak napędu z innymi objawami może wymagać oceny zdrowia, snu lub leków.'],
    sections: [
      ['Dlaczego zapał znika po pierwszych treningach?', 'Nowość i szybka nagroda pomagają zacząć, ale nie tworzą automatycznie trwałego zachowania. Gdy pojawia się zmęczenie, obowiązki albo brak widocznego wyniku, koszt działania staje się bardziej odczuwalny. To nie dowodzi lenistwa; pokazuje, że plan zależał od chwilowego stanu.', 'Zamiast oceniać charakter, sprawdź tarcie: dojazd, porę, zbyt długi zestaw i brak przygotowanych rzeczy. Prosty start opisuje <a href="powrot-do-formy-po-50-kompletny-przewodnik.html">plan powrotu do formy po 50-tce</a>.'],
      ['Jak zbudować plan „jeśli–to”?', 'Zapisz jedną rozpoznawalną sytuację i jedną czynność: „Jeśli we wtorek o 18:00 wracam z pracy, zakładam buty i idę na 10 minut”. Przegląd badań nad intencjami implementacyjnymi wskazuje korzyść dla części osób, ale wyniki zależą między innymi od wcześniejszej intencji i poczucia sprawczości.', 'Plan powinien mieć wersję normalną oraz minimalną. Jeśli 30 minut jest dziś nierealne, wykonaj 10 minut spaceru albo pierwsze dwa ćwiczenia. Dalszą progresję znajdziesz w <a href="trening-3x30-dla-50-plus.html">planie 3×30</a>.'],
      ['Ile czasu naprawdę trwa budowa nawyku?', 'Nie istnieje jeden termin obowiązujący każdego. Metaanaliza badań nad nawykami zdrowotnymi wykazała duże różnice: mediany wynosiły około 59–66 dni, średnie 106–154 dni, a obserwowany zakres od 4 do 335 dni. Te wartości opisują grupy, a nie termin zaliczenia.', 'Oceniaj powtarzalność przez tygodnie, nie „idealną serię” bez przerwy. Po opuszczonym dniu wróć przy następnym zaplanowanym sygnale zamiast czekać na poniedziałek. Pomaga też <a href="jak-zaczac-na-silowni-po-50.html">przewodnik pierwszej wizyty na siłowni</a>.'],
      ['Kiedy brak motywacji może być objawem zdrowotnym?', 'Nagła lub utrzymująca się zmiana napędu może towarzyszyć depresji, zaburzeniom snu, niedokrwistości, chorobom tarczycy, bólowi albo działaniu leków. Sam artykuł nie rozstrzyga przyczyny. Znaczenie ma czas trwania, inne objawy oraz wpływ na pracę, relacje i codzienną samoobsługę.', 'Pilnej pomocy wymaga zagrożenie samobójcze lub brak bezpieczeństwa. W mniej nagłej sytuacji zanotuj objawy i omów je z lekarzem. Sen jako możliwy element układanki opisuje <a href="sen-po-50.html">poradnik snu po 50-tce</a>.']
    ],
    callouts: ['Przygotuj buty i wpisz dokładny start do kalendarza; „poćwiczę kiedyś” nie tworzy rozpoznawalnego sygnału.', 'Jeśli obniżony nastrój lub utrata zainteresowań trwają co najmniej dwa tygodnie, nie sprowadzaj problemu do dyscypliny.'],
    quote: 'Celem minimalnej wersji nie jest imponujący trening, lecz zmniejszenie kosztu rozpoczęcia w konkretnym momencie.',
    table: ['Plan powrotu do ruchu bez czekania na motywację', ['Element', 'Konkretny zapis', 'Warunek korekty'], [['Sygnał', 'Wtorek i piątek, 18:00', 'Zmień porę po dwóch realnych kolizjach'], ['Wersja normalna', '30 minut ustalonego treningu', 'Nie zwiększaj kilku parametrów naraz'], ['Wersja minimalna', '10 minut lub dwa ćwiczenia', 'Nie traktuj jej jako kary'], ['Kontrola', 'Liczba wykonanych wejść w 4 tygodnie', 'Sprawdź środowisko, nie tylko wagę']]],
    faqs: [['Czy trzeba mieć motywację, żeby ćwiczyć?', 'Nie. Konkretny sygnał, mały próg wejścia i przygotowane środowisko mogą uruchomić działanie mimo słabszego zapału.'], ['Czy nawyk powstaje w 21 dni?', 'Nie ma uniwersalnej liczby. Badania pokazują szeroki zakres, zależny od zachowania, osoby i warunków.'], ['Co zrobić po opuszczonym treningu?', 'Wróć przy kolejnym zaplanowanym terminie i sprawdź przyczynę kolizji zamiast czekać na nowy miesiąc.'], ['Kiedy iść do lekarza?', 'Gdy spadek napędu jest trwały, nagły albo łączy się z obniżonym nastrojem, bezsennością, dusznością, bólem lub innymi objawami.']],
    sources: [['Implementation intentions and physical activity — systematic review', 'https://pubmed.ncbi.nlm.nih.gov/31923898/'], ['Habit formation interventions — systematic review and meta-analysis', 'https://pubmed.ncbi.nlm.nih.gov/37700303/'], ['Time to form health-related habits — systematic review and meta-analysis', 'https://pubmed.ncbi.nlm.nih.gov/39685110/'], ['Self-determination and exercise — systematic review', 'https://pubmed.ncbi.nlm.nih.gov/22726453/']]
  },
  {
    file: 'sakady-supresja-sakadyczna-mozg-ukrywa-slepe-chwile.html',
    title: 'Sakady i supresja sakadyczna: jak widzi mózg',
    h1: 'Sakady i supresja sakadyczna: dlaczego obraz jest stabilny?',
    description: 'Sakady szybko przenoszą wzrok, a supresja sakadyczna ogranicza część informacji podczas ruchu oczu. Poznaj mechanizm oraz objawy wymagające pilnej kontroli.',
    quick: 'Sakady to szybkie ruchy oczu przenoszące punkt spojrzenia. W ich pobliżu czułość wzrokowa na część bodźców spada, co nazywa się supresją sakadyczną. Nie oznacza to całkowitej „ślepoty” ani wyłączania oczu. Jeśli wystąpią nagłe błyski, lawina nowych mętów, cień jak kurtyna, silny ból oka lub nagła utrata widzenia, potrzebna jest pilna ocena okulistyczna.',
    takeaways: ['Supresja jest selektywnym spadkiem wrażliwości, a nie całkowitym wyłączeniem wzroku.', 'Mózg łączy informacje przed, w trakcie i po sakadzie, aby utrzymać użyteczny obraz świata.', 'Czytanie obejmuje fiksacje, sakady i czasem regresje; ich obecność sama nie oznacza choroby.', 'Nagłe błyski, męty, kurtyna lub utrata widzenia nie są zwykłym efektem sakad.'],
    sections: [
      ['Czym są sakady i fiksacje?', 'Podczas fiksacji wzrok pobiera szczegółową informację z wybranego miejsca, a sakada szybko przesuwa oczy do kolejnego punktu. Ruchy występują między innymi podczas czytania i oglądania sceny. Parametry zależą od zadania, dlatego jedna liczba „sakad dziennie” nie jest wiarygodną normą kliniczną.', 'Trudność czytania może wynikać także z nieprawidłowej korekcji lub choroby oka. Miejsce kontroli wzroku w profilaktyce omawia <a href="badania-po-50.html">przewodnik badań po 50-tce</a>.'],
      ['Na czym polega supresja sakadyczna?', 'Wokół czasu sakady spada wykrywalność części zmian wzrokowych, szczególnie bodźców o określonych właściwościach. Zjawisko powstaje z udziałem mechanizmów siatkówkowych, maskowania przez obraz po ruchu oraz sygnałów związanych z planem ruchu oka. Nie jest prostą migawką zamykającą cały obraz.', 'Dlatego nie zauważamy ciągłego rozmazania przy każdym przesunięciu spojrzenia, choć eksperyment może ujawnić ograniczenia percepcji. O ostrości i soczewce przeczytasz w <a href="okulary-do-czytania-trening-akomodacji-oka.html">artykule o okularach do czytania</a>.'],
      ['Czy mózg uzupełnia brakujące chwile?', 'Układ wzrokowy wykorzystuje stabilne elementy sceny i porównuje informacje po kolejnych fiksacjach. Badania opisują integrację transsakadyczną oraz aktualizowanie położenia obiektów. Określenie „mózg dopowiada film” jest tylko metaforą i nie oznacza tworzenia dowolnego obrazu bez danych z oczu.', 'Złudzenia i przeoczenia zmian pokazują ograniczenia uwagi, ale nie są testem neurologicznym do samodiagnozy. Szerzej o regeneracji układu nerwowego piszemy w <a href="regeneracja-ukladu-nerwowego-co-mowi-nauka.html">poradniku opartym na badaniach</a>.'],
      ['Które objawy nie pasują do zwykłych sakad?', 'Nagły wysyp mętów, błyski i cień przypominający kurtynę mogą wskazywać na odwarstwienie siatkówki. Silny ból oka, zaczerwienienie, zamglenie oraz nudności mogą wystąpić w ostrym zamknięciu kąta. Nagła utrata widzenia, podwójne widzenie lub objawy neurologiczne również wymagają pilnej pomocy.', 'Nie czekaj, aż organizm „przyzwyczai się” do nagłej zmiany. Przy stopniowym pogorszeniu umów kontrolę, a przy objawach alarmowych zgłoś się pilnie. Czynniki naczyniowe omawia <a href="centrum-nadcisnienia-po-50.html">Centrum Nadciśnienia</a>.']
    ],
    callouts: ['Supresja sakadyczna ogranicza wykrywanie części bodźców, ale nie daje podstaw do twierdzenia, że przez określony procent dnia jesteśmy ślepi.', 'Błyski z nowymi mętami lub cieniem w polu widzenia traktuj jako objaw okulistyczny, nie ciekawostkę percepcyjną.'],
    quote: 'Stabilny obraz nie powstaje z nieruchomych oczu, lecz ze współpracy ruchu, uwagi i informacji z kolejnych fiksacji.',
    table: ['Sakady a objawy wymagające oceny', ['Zjawisko', 'Typowy kontekst', 'Co zrobić?'], [['Szybki skok spojrzenia', 'Czytanie i oglądanie sceny', 'To fizjologiczna sakada'], ['Krótka utrata szczegółu w ruchu', 'Wykrywalna eksperymentalnie', 'Nie oznacza choroby sama w sobie'], ['Nowe błyski, męty lub kurtyna', 'Możliwy problem siatkówki', 'Pilna ocena okulistyczna'], ['Ból, czerwone oko i nudności', 'Możliwe ostre zamknięcie kąta', 'Natychmiastowa pomoc']]],
    faqs: [['Czy podczas sakady jesteśmy całkiem ślepi?', 'Nie. Czułość na część bodźców spada, ale supresja nie jest całkowitym wyłączeniem całego widzenia.'], ['Ile sakad wykonujemy dziennie?', 'Nie ma jednej klinicznej normy dziennej; liczba zależy od zadania, sposobu pomiaru i aktywności.'], ['Czy regresje w czytaniu oznaczają chorobę?', 'Nie same w sobie. Powroty spojrzenia mogą zależeć od trudności tekstu, uwagi i strategii czytania.'], ['Kiedy błyski w oku są pilne?', 'Gdy pojawiają się nagle, zwłaszcza z nowymi mętami, cieniem lub ubytkiem widzenia, potrzebna jest pilna ocena.']],
    sources: [['Saccadic suppression — review and analysis', 'https://pubmed.ncbi.nlm.nih.gov/4612577/'], ['Active vision and saccadic suppression — review', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5205523/'], ['NEI — retinal detachment', 'https://www.nei.nih.gov/learn-about-eye-health/eye-conditions-and-diseases/retinal-detachment'], ['NEI — angle-closure glaucoma', 'https://www.nei.nih.gov/learn-about-eye-health/eye-conditions-and-diseases/glaucoma/types-glaucoma']]
  },
  {
    file: 'sila-chwytu-po-50.html',
    title: 'Siła chwytu po 50-tce: pomiar i progi EWGSOP2',
    h1: 'Siła chwytu po 50-tce: jak zmierzyć wynik i co naprawdę oznacza?',
    description: 'Siła chwytu jest szybkim wskaźnikiem funkcji mięśni. Sprawdź pomiar dynamometrem, progi EWGSOP2, ograniczenia domowych testów i ćwiczenia po 50-tce.',
    quick: 'Siłę chwytu najlepiej mierzyć dynamometrem według powtarzalnego protokołu. EWGSOP2 stosuje progi poniżej 27 kg u mężczyzn i poniżej 16 kg u kobiet jako sygnał niskiej siły mięśniowej w ocenie sarkopenii. Wynik nie jest diagnozą ani „licznikiem lat życia”; trzeba uwzględnić technikę, ból ręki, płeć, budowę ciała i sprawność całego ciała.',
    takeaways: ['Dynamometr daje wynik porównywalny tylko przy tej samej pozycji, urządzeniu i sposobie próby.', 'Progi 27 kg i 16 kg służą do przesiewowej oceny niskiej siły w EWGSOP2.', 'Ściskanie piłeczki nie zastępuje ruchów nóg, przyciągania, wypychania i noszenia.', 'Nagły jednostronny spadek siły z objawami neurologicznymi wymaga pilnej pomocy.'],
    sections: [
      ['Jak prawidłowo zmierzyć siłę chwytu?', 'Usiądź lub stań zgodnie z protokołem urządzenia, ustaw bark neutralnie, łokieć według instrukcji i zaciśnij dłoń maksymalnie przez kilka sekund. Wykonaj próby po obu stronach z odpoczynkiem. Do śledzenia trendu używaj tego samego dynamometru i tej samej pozycji.', 'Test bez dynamometru może oceniać funkcję, ale nie daje wyniku w kilogramach. Szerszy punkt startowy zawiera <a href="powrot-do-formy-po-50-kompletny-przewodnik.html">plan oceny i powrotu do formy</a>.'],
      ['Jak rozumieć progi 27 kg i 16 kg?', 'EWGSOP2 wskazuje poniżej 27 kg u mężczyzn i poniżej 16 kg u kobiet jako niską siłę chwytu w algorytmie sarkopenii. To europejskie progi kliniczne, a nie średnia dla każdego wieku. Rozpoznanie obejmuje także ilość lub jakość mięśni oraz sprawność fizyczną.', 'Wynik blisko granicy warto powtórzyć poprawną techniką i omówić w kontekście chodu, wstawania i odżywienia. O białku przeczytasz w <a href="ile-bialka-po-50-roku-zycia-zapotrzebowanie-odzywki.html">poradniku zapotrzebowania po 50-tce</a>.'],
      ['Czy słaby chwyt przewiduje choroby i długość życia?', 'W dużych badaniach obserwacyjnych słabszy chwyt wiązał się z większym ryzykiem niesprawności, chorób i zgonu. Związek nie dowodzi, że samo ściskanie ekspandera usuwa te ryzyka. Chwyt jest użytecznym markerem ogólnej siły i stanu zdrowia, a nie samodzielną przyczyną wszystkich wyników.', 'Śledź równolegle wstawanie z krzesła, marsz i obciążenia w ćwiczeniach. Pełny program opisuje <a href="centrum-treningu-silowego-po-50.html">Centrum Treningu Siłowego</a>.'],
      ['Jak trenować chwyt bez przeciążenia dłoni?', 'Zacznij od noszenia lekkich hantli, wiosłowania i kontrolowanego ściskania, jeśli nie wywołują bólu. Dwie krótkie ekspozycje tygodniowo można dołączyć do treningu całego ciała. Zwiększaj czas albo ciężar osobno i przerwij przy narastającym drętwieniu, obrzęku lub ostrym bólu.', 'Ból kciuka, nadgarstka albo łokcia wymaga zmiany ćwiczenia, nie mocniejszego zaciskania. Zasady progresji znajdziesz w <a href="trening-maszynowy-po-50.html">planie treningu po 50-tce</a>.']
    ],
    callouts: ['Zapisuj stronę, najlepszy wynik, urządzenie i pozycję. Sama liczba bez protokołu nie nadaje się do porównania.', 'Nagłe jednostronne osłabienie ręki z opadaniem twarzy lub zaburzeniem mowy wymaga natychmiastowej pomocy.'],
    quote: 'Siła chwytu jest dobrym termometrem funkcji mięśni, ale termometr nie jest całym badaniem pacjenta.',
    table: ['Interpretacja pomiaru siły chwytu', ['Wynik lub sytuacja', 'Znaczenie', 'Następny krok'], [['Mężczyzna poniżej 27 kg', 'Niska siła według EWGSOP2', 'Pełniejsza ocena sarkopenii'], ['Kobieta poniżej 16 kg', 'Niska siła według EWGSOP2', 'Pełniejsza ocena sarkopenii'], ['Trend spada w kilku pomiarach', 'Możliwa zmiana funkcji lub protokołu', 'Sprawdź technikę i stan zdrowia'], ['Ból lub drętwienie', 'Wynik może być zaniżony', 'Przerwij i oceń przyczynę']]],
    faqs: [['Jaka siła chwytu jest niska?', 'EWGSOP2 stosuje progi poniżej 27 kg dla mężczyzn i poniżej 16 kg dla kobiet w ocenie sarkopenii.'], ['Czy można zmierzyć chwyt bez dynamometru?', 'Można ocenić funkcję dłoni, ale bez skalibrowanego urządzenia nie otrzymasz porównywalnego wyniku w kilogramach.'], ['Czy ekspander wydłuża życie?', 'Nie ma podstaw do takiej obietnicy. Ćwiczy lokalny chwyt, a ogólne zdrowie zależy od znacznie szerszego zestawu czynników.'], ['Jak często powtarzać pomiar?', 'Do treningowego trendu wystarczy pomiar w podobnych warunkach co kilka tygodni, bez codziennego testowania maksimum.']],
    sources: [['EWGSOP2 consensus on sarcopenia', 'https://pubmed.ncbi.nlm.nih.gov/30312372/'], ['Grip strength reference values — German cohort', 'https://pubmed.ncbi.nlm.nih.gov/36702514/'], ['Grip strength and health outcomes — PURE study', 'https://pubmed.ncbi.nlm.nih.gov/25982160/'], ['Grip strength measurement protocols — review', 'https://pubmed.ncbi.nlm.nih.gov/27325336/']]
  },
  {
    file: 'sniadanie-bialkowo-tluszczowe-zachcianki-na-cukier.html',
    title: 'Śniadanie białkowe a zachcianki na cukier',
    h1: 'Śniadanie białkowe a zachcianki na cukier: co działa po 50-tce?',
    description: 'Śniadanie z białkiem może zwiększać sytość, ale nie wyłącza zachcianek na cukier. Zobacz porcję białka, rolę błonnika i test dopasowany do leków po 50-tce.',
    quick: 'Śniadanie zawierające wyraźne źródło białka może u części osób zwiększać krótkotrwałą sytość, lecz samo dodanie tłuszczu nie gwarantuje zniknięcia zachcianek ani spadku masy. Przez 7 dni porównaj głód po 3–4 godzinach po dwóch podobnie kalorycznych śniadaniach. Przy insulinie lub lekach mogących powodować hipoglikemię nie zmieniaj ilości węglowodanów bez planu z lekarzem.',
    takeaways: ['Badania wspierają krótkotrwały wpływ białka na sytość, ale wyniki długoterminowe są mniej jednoznaczne.', 'Tłuszcz zwiększa kaloryczność, więc „więcej masła” nie jest automatycznym sposobem na kontrolę apetytu.', 'Owies, pełne ziarna i owoce nie muszą znikać; błonnik oraz cała kompozycja posiłku mają znaczenie.', 'Zachcianki zależą też od snu, dostępności jedzenia, stresu, nawyku i całodziennej podaży energii.'],
    sections: [
      ['Co białko zmienia w odczuwaniu głodu?', 'Metaanaliza krótkich badań u dorosłych wykazała przeciętnie mniejszy głód i większą pełność po większej podaży białka, ale długoterminowe wyniki były niejednoznaczne. Reakcja na pojedynczy posiłek nie dowodzi trwałej redukcji masy ani wyłączenia apetytu na słodki smak.', 'Dzienny cel i źródła białka obliczysz z <a href="ile-bialka-po-50-roku-zycia-zapotrzebowanie-odzywki.html">poradnikiem białka po 50-tce</a>.'],
      ['Czy śniadanie musi być bardzo tłuste i bez węglowodanów?', 'Nie. Tłuszcz może spowalniać opróżnianie żołądka i poprawiać smak, ale jest energetyczny. Produkty węglowodanowe różnią się strukturą, błonnikiem i porcją; owsianka z jogurtem i owocem nie jest metabolicznie tym samym co słodki napój oraz drożdżówka.', 'Zamiast zakazu zbuduj talerz: źródło białka, produkt z błonnikiem, warzywo lub owoc oraz ilość tłuszczu dopasowaną do celu. Szerszy kontekst daje <a href="dieta-po-50.html">dieta po 50-tce</a>.'],
      ['Jak przeprowadzić uczciwy test przez 7 dni?', 'Wybierz dwa śniadania o zbliżonej kaloryczności, ale różniące się udziałem białka. Zanotuj porcje oraz głód w skali 0–10 po 3 i 4 godzinach, podjadanie do obiadu oraz sen poprzedniej nocy. Jeden wyjątkowo stresujący dzień nie powinien przesądzać wyniku.', 'Nie zmieniaj równocześnie kawy, godzin snu i całej diety. Przykładowe produkty z ukrytymi cukrami nauczysz się porównywać z <a href="jak-czytac-etykiety-sklad-produktow-e-numery-inci.html">poradnikiem etykiet</a>.'],
      ['Kiedy zachcianki wymagają innego podejścia?', 'Nawracające objadanie z utratą kontroli, silne poczucie winy lub kompensowanie jedzenia wymagają rozmowy ze specjalistą, a nie kolejnych zakazów. Drżenie, poty, splątanie i osłabienie u osoby leczonej z powodu cukrzycy mogą oznaczać hipoglikemię i wymagają działania według planu medycznego.', 'Przy insulinie lub pochodnych sulfonylomocznika zmiana węglowodanów może zmienić glikemię. Wyniki i leczenie omawiaj z zespołem prowadzącym; podstawy monitorowania zawiera <a href="badania-krwi-po-50-jak-czesto.html">przewodnik badań krwi</a>.']
    ],
    callouts: ['Porównuj posiłki o podobnej energii. Inaczej nie wiadomo, czy sytość wynika z białka, czy po prostu z większej liczby kalorii.', 'Przy lekach wywołujących hipoglikemię nie usuwaj gwałtownie węglowodanów na podstawie internetowego jadłospisu.'],
    quote: 'Dobre śniadanie ma ułatwiać przewidywalny apetyt, a nie tworzyć kolejną listę zakazanych produktów.',
    table: ['Dwa śniadania do porównania przez 7 dni', ['Element', 'Wariant mniej sycący', 'Wariant testowy'], [['Białko', 'Mała lub przypadkowa ilość', 'Policzona porcja z nabiału, jaj, tofu lub ryby'], ['Błonnik', 'Produkt oczyszczony bez dodatków', 'Pełne ziarno, warzywo lub owoc'], ['Tłuszcz', 'Nieznana ilość', 'Odmierzona porcja'], ['Ocena po 3–4 h', 'Głód 0–10 i podjadanie', 'Ta sama skala i podobna pora']]],
    faqs: [['Czy śniadanie białkowe usuwa zachcianki na cukier?', 'Może poprawić krótkotrwałą sytość u części osób, ale nie gwarantuje zniknięcia zachcianek ani utraty masy.'], ['Ile białka zjeść rano?', 'Dopasuj porcję do dziennego celu i reszty posiłków; jedna uniwersalna liczba nie pasuje do każdego stanu zdrowia.'], ['Czy trzeba usunąć owsiankę i owoce?', 'Nie. Węglowodany różnią się jakością, błonnikiem i porcją; można je łączyć ze źródłem białka.'], ['Czy tłuste śniadanie jest lepsze?', 'Nie automatycznie. Tłuszcz zwiększa energię posiłku, a wpływ na sytość i całodzienne jedzenie trzeba ocenić indywidualnie.']],
    sources: [['Protein and appetite — systematic review', 'https://pubmed.ncbi.nlm.nih.gov/32648023/'], ['Protein intake and appetite hormones — meta-analysis', 'https://pubmed.ncbi.nlm.nih.gov/32768415/'], ['Breakfast macronutrients and appetite — controlled trial', 'https://pubmed.ncbi.nlm.nih.gov/8862476/'], ['Egg, protein, fiber and appetite — randomized crossover trial', 'https://pubmed.ncbi.nlm.nih.gov/27306734/']]
  },
  {
    file: 'syndrom-pierwszego-poniedzialku.html',
    title: 'Ciągłe zaczynanie od poniedziałku: jak przerwać cykl',
    h1: 'Ciągłe zaczynanie od poniedziałku: jak przerwać ten cykl?',
    description: 'Ciągle zaczynasz dietę lub trening od poniedziałku? Sprawdź efekt świeżego startu, plan jeśli–to, minimalną wersję działania i sposób powrotu po przerwie.',
    quick: '„Nowy poniedziałek” może chwilowo ułatwiać rozpoczęcie, lecz szeroki plan bez wersji minimalnej często przegrywa z pierwszą kolizją. Wybierz jedno zachowanie na 14 dni, przypisz mu dokładny sygnał i zapisz powrót po przerwie. Sukcesem jest wykonanie zaplanowanego minimum w większości okazji, a nie seria bez jednego opuszczonego dnia.',
    takeaways: ['Efekt świeżego startu może zwiększać gotowość do działania, ale nie zastępuje projektu zachowania.', 'Jedna zmiana przez 14 dni daje czytelniejszą informację niż równoczesna rewolucja treningu, diety i snu.', 'Plan powrotu jest częścią systemu, bo pojedyncza przerwa nie przekreśla wcześniejszych wykonań.', 'Ocena ma obejmować zachowanie pod kontrolą, nie tylko masę ciała lub wygląd.'],
    sections: [
      ['Dlaczego poniedziałek wydaje się dobrym momentem?', 'Daty oddzielające jeden okres od drugiego mogą tworzyć psychologiczne poczucie nowego początku. To pomaga uruchomić intencję, ale nie usuwa przeszkód we wtorek i środę. Problemem nie jest sam poniedziałek, lecz oczekiwanie, że symboliczna data wykona pracę za plan.', 'Możesz zacząć dziś od najmniejszej wersji i dopiero potem rozbudować obciążenie. Bezpieczny punkt wejścia znajdziesz w <a href="powrot-do-formy-po-50-kompletny-przewodnik.html">planie powrotu do formy</a>.'],
      ['Jak wybrać jedno zachowanie na 14 dni?', 'Wybierz czynność mierzalną i możliwą do wykonania przy zwykłym tygodniu: dwa dziesięciominutowe spacery po kolacji albo dwa krótkie treningi. Nie dodawaj jednocześnie zakazu cukru, codziennego ważenia i pobudki godzinę wcześniej, bo nie rozpoznasz przyczyny niepowodzenia.', 'Po 14 dniach oceń liczbę wykonanych okazji oraz przeszkody. Jeśli ruch jest celem, skorzystaj z <a href="trening-3x30-dla-50-plus.html">planu 3×30</a>, dopasowując pierwszą dawkę.'],
      ['Co zrobić, gdy plan przerwie wyjazd lub choroba?', 'Zapisz z góry regułę powrotu: „po przerwie wracam w pierwszym zwykłym terminie i wykonuję wersję minimalną”. Nie nadrabiaj podwójnym treningiem ani głodówką. Obciążenie po infekcji powinno zależeć od objawów i tolerancji, a nie od poczucia winy.', 'Przerwa jest informacją o elastyczności systemu. Zasady regeneracji i stopniowego zwiększania obciążenia omawia <a href="regeneracja-ukladu-nerwowego-co-mowi-nauka.html">poradnik regeneracji</a>.'],
      ['Jak mierzyć postęp bez pułapki „wszystko albo nic”?', 'Policz zaplanowane okazje i wykonane minima, na przykład 6 z 8 w cztery tygodnie. Zapisz także ból, sen oraz powód pominięcia. Masa ciała zmienia się pod wpływem wody i nie jest codziennym raportem z jakości zachowania.', 'Jeśli realizacja jest stale zerowa, zmniejsz próg lub zmień sygnał. Jeśli działanie jest łatwe i bez objawów, dodaj jeden parametr. Podobną logikę progresji zawiera <a href="jak-zaczac-na-silowni-po-50.html">przewodnik startu na siłowni</a>.']
    ],
    callouts: ['Na 14 dni wybierz jeden wynik zachowania: liczbę spacerów, treningów albo przygotowanych posiłków — nie wszystkie naraz.', 'Po przerwie wracaj wersją minimalną w zwykłym terminie; nie płać za opuszczenie podwójną dawką.'],
    quote: 'Plan jest trwały dopiero wtedy, gdy opisuje nie tylko start, lecz także zwykły powrót po przerwie.',
    table: ['Plan przerwania cyklu „od poniedziałku”', ['Etap', 'Zapis', 'Miara'], [['Wybór', 'Jedno zachowanie na 14 dni', 'Liczba planowanych okazji'], ['Sygnał', 'Dokładna pora i sytuacja', 'Czy sygnał wystąpił?'], ['Minimum', 'Najmniejsza sensowna wersja', 'Czy wykonano minimum?'], ['Powrót', 'Pierwszy zwykły termin po przerwie', 'Bez nadrabiania']]],
    faqs: [['Czy poniedziałek naprawdę pomaga zacząć?', 'Może dawać poczucie świeżego startu, lecz utrzymanie działania zależy od sygnałów, przeszkód i wykonalnego minimum.'], ['Ile zmian wprowadzać naraz?', 'Na początek wybierz jedno mierzalne zachowanie na 14 dni, aby móc ocenić wykonanie i przeszkody.'], ['Czy opuszczony dzień niszczy nawyk?', 'Nie. Ważniejszy jest zaplanowany powrót przy następnej okazji niż próba utrzymania idealnej serii.'], ['Co mierzyć zamiast samej wagi?', 'Liczbę wykonanych okazji, czas lub obciążenie, a także ból, sen i zdolność powrotu po przerwie.']],
    sources: [['Fresh start effect and aspirational behavior', 'https://pubmed.ncbi.nlm.nih.gov/26192820/'], ['Implementation intentions and physical activity — systematic review', 'https://pubmed.ncbi.nlm.nih.gov/31923898/'], ['Habit formation interventions — meta-analysis', 'https://pubmed.ncbi.nlm.nih.gov/37700303/'], ['Time to form health-related habits — meta-analysis', 'https://pubmed.ncbi.nlm.nih.gov/39685110/']]
  },
  {
    file: 'dzieci-patrza-na-ciebie.html',
    title: 'Jak wspierać zdrowe nawyki dzieci własnym przykładem',
    h1: 'Jak wspierać zdrowe nawyki dzieci własnym dobrym przykładem?',
    description: 'Dzieci nie kopiują dorosłych automatycznie. Sprawdź, jak przykład, dostępność jedzenia, wspólny ruch i wsparcie bez zawstydzania pomagają budować nawyki.',
    quick: 'Zachowanie rodzica jest jednym z wielu wpływów na dietę i ruch dziecka, ale nie działa jak automatyczna kopia. Najbardziej praktyczne są powtarzalne warunki: dostępne produkty, wspólna aktywność, transport na zajęcia i spokojna rozmowa bez komentarzy o wadze. Wybierz jeden rodzinny rytuał 2 razy w tygodniu i oceniaj uczestnictwo, nie wygląd dziecka.',
    takeaways: ['Wpływ rodziny obejmuje przykład, dostępność, zasady, wsparcie logistyczne i wspólne okazje.', 'Badania nie uzasadniają obarczania jednego rodzica winą za masę lub zachowanie dziecka.', 'Komentarze o wadze i jedzeniu jako karze mogą szkodzić relacji z jedzeniem.', 'Wspólny spacer, przygotowanie posiłku lub aktywny dojazd powinny być konkretne i możliwe do powtarzania.'],
    sections: [
      ['Czy dzieci po prostu kopiują zachowania rodziców?', 'Nie. Metaanalizy pokazują związki między praktykami rodziców a jedzeniem dzieci, ale podobieństwo całej diety rodzica i dziecka bywa niejednoznaczne. Na zachowanie wpływają również rówieśnicy, szkoła, reklama, dostępność produktów, temperament oraz wiek. Przykład jest ważnym elementem, nie jedyną przyczyną.', 'Dlatego celem nie jest perfekcyjny dorosły, lecz lepsze warunki w domu. Własny powrót do ruchu można oprzeć na <a href="powrot-do-formy-po-50-kompletny-przewodnik.html">planie po 50-tce</a>.'],
      ['Co działa poza samym dawaniem przykładu?', 'Przeglądy dotyczące aktywności wskazują częstszy związek ze wsparciem logistycznym i zachętą niż z samym modelowaniem w części badań ilościowych. Zapewnienie czasu, bezpiecznego miejsca, transportu i wspólnego uczestnictwa usuwa realne bariery, których nie rozwiąże obserwowanie rodzica z kanapy.', 'Ustal rodzinny spacer po kolacji dwa razy w tygodniu albo aktywny fragment weekendu. Dorosły może przygotować się z <a href="nordic-walking-jak-zaczac-technika-kije-zdrowie.html">poradnikiem nordic walking</a>.'],
      ['Jak rozmawiać o jedzeniu bez zawstydzania?', 'Mów o smaku, energii, sytości i różnorodności, a nie o „dobrym” i „złym” ciele. Dorosły decyduje, co i kiedy jest dostępne, a dziecko w granicach wieku uczy się rozpoznawać głód oraz sytość. Jedzenie nie powinno stale pełnić roli nagrody lub kary.', 'Zmiana domowego otoczenia może oznaczać wodę pod ręką i owoce widoczne na blacie, bez zakazywania wszystkich słodyczy. Etykiety produktów pomaga porównywać <a href="jak-czytac-etykiety-sklad-produktow-e-numery-inci.html">przewodnik składu</a>.'],
      ['Jaki jeden rytuał wybrać na początek?', 'Dobierz zachowanie do wieku, zdrowia i planu dnia: wspólne przygotowanie jednego posiłku, spacer po kolacji albo wyjście rowerowe w bezpiecznym miejscu. Zapisz dwie okazje tygodniowo przez cztery tygodnie. Nie oceniaj sukcesu wagą ani sportowym wynikiem dziecka.', 'Jeśli dziecko ma chorobę, ból, zaburzenia odżywiania lub znaczną zmianę masy, plan wymaga pediatry albo odpowiedniego specjalisty. Dorośli mogą budować własną regularność z <a href="motywacja-zniknela-po-50.html">poradnikiem o motywacji i nawyku</a>.']
    ],
    callouts: ['Zapytaj dziecko, którą z dwóch realnych aktywności wybiera; wybór w bezpiecznych granicach zwiększa udział bez presji.', 'Nie używaj wyglądu dziecka jako miernika rodzinnego planu. Mierz liczbę wspólnych okazji i atmosferę działania.'],
    quote: 'Rodzinny przykład działa najlepiej jako dostępna okazja i wsparcie, a nie jako pokaz perfekcji.',
    table: ['Rodzinny rytuał zdrowia bez presji', ['Obszar', 'Konkretna zmiana', 'Czego unikać?'], [['Ruch', 'Dwie wspólne okazje tygodniowo', 'Kary za słabszy wynik'], ['Jedzenie', 'Wspólne przygotowanie jednego posiłku', 'Komentarze o wadze'], ['Otoczenie', 'Woda i różne produkty w zasięgu', 'Całkowite zakazy bez rozmowy'], ['Ocena', 'Uczestnictwo i samopoczucie', 'Porównywanie rodzeństwa']]],
    faqs: [['Czy dzieci zawsze kopiują rodziców?', 'Nie. Rodzina ma wpływ, ale zachowanie zależy też od wieku, rówieśników, szkoły, otoczenia i indywidualnych cech.'], ['Jak zachęcić dziecko do ruchu?', 'Zapewnij realną okazję, wybór między dwiema aktywnościami, wspólne uczestnictwo i wsparcie logistyczne bez oceniania wyniku.'], ['Czy mówić dziecku o odchudzaniu?', 'Komentarze o wadze mogą szkodzić. Skup rozmowę na zdrowiu, samopoczuciu i zachowaniach, a wątpliwości omów z pediatrą.'], ['Jaki rytuał zacząć jako pierwszy?', 'Wybierz jedno łatwe działanie dwa razy w tygodniu, na przykład spacer po kolacji lub wspólne przygotowanie posiłku.']],
    sources: [['Parent practices and child food consumption — meta-analysis', 'https://pubmed.ncbi.nlm.nih.gov/28399881/'], ['Parenting practices and children’s physical activity — review', 'https://pubmed.ncbi.nlm.nih.gov/28631518/'], ['Caregiver involvement in diet and activity interventions — Cochrane review', 'https://pubmed.ncbi.nlm.nih.gov/31902132/'], ['Parent–child resemblance in dietary intake — meta-analysis', 'https://pubmed.ncbi.nlm.nih.gov/37304499/']]
  },
  {
    file: 'siedem-bledow-silownia-po-50.html',
    title: '7 błędów na siłowni po 50-tce i konkretne korekty',
    h1: '7 błędów na siłowni po 50-tce: jak je rozpoznać i poprawić?',
    description: 'Poznaj 7 częstych błędów na siłowni po 50-tce: zbyt szybki start, brak progresji, wstrzymywanie oddechu, kopiowanie planu oraz ignorowanie objawów.',
    quick: 'Największym błędem po 50-tce nie jest konkretny przyrząd, lecz niedopasowanie dawki: za dużo na starcie albo brak progresji przez miesiące. Zacznij od dwóch niekolejnych sesji całego ciała, zostaw 2–3 powtórzenia w zapasie i zmieniaj tylko jeden parametr naraz. Ból w klatce, omdlenie lub nietypowa duszność wymagają przerwania wysiłku i oceny.',
    takeaways: ['WHO zaleca wzmacnianie głównych grup mięśni co najmniej dwa dni tygodniowo, ale indywidualny start może być mniejszy.', 'Skuteczność programu zależy od regularności i progresji, nie od kopiowania najbardziej złożonego planu.', 'Rozgrzewka ma przygotować konkretne ruchy; sama długa bieżnia nie uczy techniki ćwiczeń siłowych.', 'Objawów alarmowych nie wolno tłumaczyć wiekiem ani słabą kondycją.'],
    sections: [
      ['Które błędy dotyczą dawki i progresji?', 'Pierwsze trzy to zbyt duża objętość na starcie, trenowanie każdej serii do upadku oraz brak zapisu obciążenia. Razem utrudniają ocenę reakcji i progresji. Początkujący może rozwijać siłę bez ciągłego maksymalnego wysiłku, jeśli regularnie obejmuje główne ruchy i stopniowo zwiększa bodziec.', 'Zapisuj ćwiczenie, ciężar, powtórzenia i zapas. Gotowy szkielet daje <a href="trening-maszynowy-po-50.html">30-dniowy plan treningu na maszynach</a>.'],
      ['Jakie błędy techniczne zdarzają się najczęściej?', 'Czwarty błąd to kopiowanie zakresu ruchu bez dopasowania do własnej budowy i bólu, a piąty — wstrzymywanie oddechu bez potrzeby. Nie istnieje jedna idealna pozycja dla każdego ćwiczenia i ciała. Technika ma umożliwiać kontrolowany ruch bez ostrego bólu oraz zawrotów głowy.', 'Wykonaj serię przygotowawczą z małym ciężarem i ustaw sprzęt przed serią roboczą. Podstawy pierwszej wizyty opisuje <a href="jak-zaczac-na-silowni-po-50.html">przewodnik startu na siłowni</a>.'],
      ['Dlaczego sama rozgrzewka na bieżni nie wystarcza?', 'Szósty błąd to traktowanie podniesionego tętna jako pełnego przygotowania do każdego ruchu. Kilka minut marszu może ogrzać ciało, ale cięższe przysiady, przyciąganie lub wyciskanie wymagają także serii przygotowawczych danego ćwiczenia, z rosnącym obciążeniem i kontrolą zakresu.', 'Rozgrzewka nie musi męczyć przed właściwą pracą. Różnicę między cardio i siłą wyjaśnia artykuł <a href="dlaczego-bieznia-to-za-malo.html">dlaczego sama bieżnia to za mało</a>.'],
      ['Kiedy ambicję trzeba zastąpić oceną objawów?', 'Siódmy błąd to ignorowanie nowego bólu w klatce, omdlenia, kołatania z osłabieniem lub duszności nieproporcjonalnej do wysiłku. Takie objawy nie są zwykłą ceną postępu. Narastający ból stawu, drętwienie lub utrata siły także wymagają przerwania konkretnego ruchu i oceny.', 'Po chorobie lub dłuższej przerwie wróć mniejszą dawką. Jeśli masz niestabilną chorobę albo objawy, najpierw potrzebna jest ocena medyczna. O kontroli ciśnienia przeczytasz w <a href="centrum-nadcisnienia-po-50.html">Centrum Nadciśnienia</a>.']
    ],
    callouts: ['Progresuj jeden parametr: najpierw powtórzenia w ustalonym zakresie, potem najmniejszy dostępny wzrost ciężaru.', 'Ból w klatce, omdlenie lub nagła nietypowa duszność kończą trening — nie są testem charakteru.'],
    quote: 'Dobry trening nie udowadnia, ile potrafisz znieść dziś; pokazuje, czy możesz bezpiecznie wrócić i wykonać więcej za kilka tygodni.',
    table: ['Siedem błędów i ich korekty', ['Błąd', 'Korekta', 'Co zapisać?'], [['1. Za duży start', 'Dwie krótsze sesje', 'Reakcja przez 48 godzin'], ['2. Każda seria do upadku', 'Zapas 2–3 powtórzeń', 'Szacowany zapas'], ['3. Brak zapisu', 'Stały dziennik', 'Ciężar i powtórzenia'], ['4. Kopiowanie zakresu', 'Zakres bez ostrego bólu', 'Ustawienie sprzętu'], ['5. Wstrzymywanie oddechu', 'Kontrolowany oddech', 'Objawy'], ['6. Tylko bieżnia', 'Serie przygotowawcze ruchu', 'Ciężary rozgrzewkowe'], ['7. Ignorowanie alarmów', 'Przerwij i oceń', 'Czas oraz charakter objawu']]],
    faqs: [['Ile razy w tygodniu ćwiczyć siłowo po 50-tce?', 'Dwa niekolejne dni obejmujące główne grupy mięśni to rozsądny cel zgodny z minimum WHO, po dopasowaniu startu.'], ['Czy trzeba ćwiczyć do upadku?', 'Nie. Trening z zapasem powtórzeń może rozwijać siłę i ułatwiać technikę oraz regenerację początkującego.'], ['Czy bieżnia wystarczy jako rozgrzewka?', 'Może być częścią rozgrzewki, ale przed cięższym ćwiczeniem warto wykonać także jego lżejsze serie przygotowawcze.'], ['Które objawy kończą trening?', 'Ból w klatce, omdlenie, nagła nietypowa duszność, objawy neurologiczne lub ostry narastający ból wymagają przerwania.']],
    sources: [['WHO guidelines on physical activity', 'https://www.who.int/publications/i/item/9789240015128'], ['Resistance training prescription — network meta-analysis', 'https://pubmed.ncbi.nlm.nih.gov/37414459/'], ['ACSM preparticipation screening update', 'https://pubmed.ncbi.nlm.nih.gov/26473759/'], ['Resistance exercise in older adults — position statement', 'https://pubmed.ncbi.nlm.nih.gov/28991040/']]
  },
  {
    file: 'lektyny-szczawiany-fityniany-czy-sa-grozne-po-50.html',
    title: 'Lektyny, szczawiany i fityniany: kto ma uważać',
    h1: 'Lektyny, szczawiany i fityniany: czy usuwać je z diety?',
    description: 'Lektyny, szczawiany i fityniany nie wymagają eliminacji u każdego. Sprawdź gotowanie strączków, ryzyko kamieni, wchłanianie minerałów i wyjątki kliniczne.',
    quick: 'Lektyny, szczawiany i fityniany to różne związki, więc wspólna etykieta „antyodżywcze” niewiele wyjaśnia. Prawidłowe moczenie i gotowanie fasoli ogranicza aktywne lektyny; szczawiany mają szczególne znaczenie przy części kamieni nerkowych, a fityniany mogą zmniejszać wchłanianie niektórych minerałów w danym posiłku. Jeśli nie ma konkretnego wskazania, eliminacja całych grup nie jest potrzebna.',
    takeaways: ['Surowa lub niedogotowana fasola nerkowa może wywołać ostre objawy; wolnowar nie zawsze osiąga temperaturę wystarczającą do unieszkodliwienia lektyn.', 'Przy kamieniach szczawianowo-wapniowych zalecenia zależą od wyniku kamienia i dobowej zbiórki moczu.', 'Prawidłowa ilość wapnia z jedzeniem może wiązać szczawiany w jelicie; samodzielne ograniczenie wapnia może być błędem.', 'Fityniany nie czynią strączków i pełnych ziaren bezwartościowymi, a ich wpływ zależy od całej diety.'],
    sections: [
      ['Czy lektyny z fasoli są toksyczne?', 'Niektóre surowe strączki, szczególnie fasola nerkowa, zawierają fitohemaglutyninę zdolną wywołać nudności, wymioty i biegunkę. Ryzyko dotyczy złego przygotowania, nie zwykłej porcji prawidłowo ugotowanych lub konserwowych strączków. Moczenie, wylanie wody i energiczne gotowanie istotnie zmniejszają aktywność lektyn.', 'Nie próbuj surowej fasoli i nie polegaj wyłącznie na niskiej temperaturze wolnowaru. Zasady oceny kuchennych twierdzeń znajdziesz w <a href="mity.html">dziale mitów żywieniowych</a>.'],
      ['Kiedy szczawiany mają znaczenie dla nerek?', 'Szczawiany mogą uczestniczyć w powstawaniu najczęstszych kamieni szczawianowo-wapniowych, ale ryzyko zależy też od objętości moczu, sodu, wapnia, cytrynianów i innych czynników. Nie każda osoba z kamieniem potrzebuje identycznej listy zakazów, a rozpoznanie rodzaju kamienia ma znaczenie.', 'NIDDK zaleca dostosowanie diety do rodzaju kamienia. Przy chorobie nerek lub nawrotach omów plan z lekarzem lub dietetykiem klinicznym oraz sprawdź <a href="badania-krwi-po-50-jak-czesto.html">zasady kontroli wyników</a>.'],
      ['Czy wapń trzeba ograniczać przy szczawianach?', 'Zwykle nie należy automatycznie ograniczać wapnia z żywności, ponieważ wapń spożyty w posiłku może związać część szczawianów w jelicie. Suplementy wapnia, dawka i pora wymagają indywidualnej oceny. Wysoka podaż sodu może zwiększać wydalanie wapnia z moczem.', 'Nie układaj diety na podstawie jednej tabeli zawartości szczawianów, bo wartości zależą od produktu i przygotowania. Podstawy pełnego jadłospisu opisuje <a href="dieta-po-50.html">dieta po 50-tce</a>.'],
      ['Czy fityniany powodują niedobory minerałów?', 'Fityniany wiążą część żelaza, cynku i innych minerałów w przewodzie pokarmowym, lecz efekt pojedynczego posiłku nie jest równy niedoborowi klinicznemu. Znaczenie rośnie przy bardzo jednostronnej diecie i dużym zapotrzebowaniu. Moczenie, kiełkowanie, fermentacja i różnorodność zmieniają biodostępność.', 'Przy potwierdzonej niedokrwistości potrzebna jest diagnoza przyczyny, nie tylko usunięcie pieczywa lub strączków. O wynikach i trendach przeczytasz w <a href="badania-po-50.html">przewodniku badań po 50-tce</a>.']
    ],
    callouts: ['Suchej fasoli nerkowej nie gotuj wyłącznie w wolnowarze; po moczeniu potrzebuje energicznego wrzenia zgodnie z bezpieczną instrukcją.', 'Przy nawracających kamieniach decyzję opieraj na rodzaju kamienia i ocenie moczu, nie na ogólnej liście „antyodżywczych” produktów.'],
    quote: 'Ryzyko zależy od konkretnego związku, dawki, przygotowania i osoby — wspólna etykieta nie zastępuje tej oceny.',
    table: ['Lektyny, szczawiany i fityniany — różne problemy', ['Związek', 'Kiedy uważać?', 'Praktyczna korekta'], [['Lektyny', 'Surowa lub niedogotowana fasola', 'Moczenie i energiczne gotowanie'], ['Szczawiany', 'Wybrane kamienie nerkowe', 'Plan według typu kamienia i moczu'], ['Fityniany', 'Jednostronna dieta lub niedobór', 'Różnorodność, fermentacja, kiełkowanie'], ['Wspólny błąd', 'Eliminacja całych grup bez rozpoznania', 'Najpierw ustal konkretny problem']]],
    faqs: [['Czy lektyny niszczą jelita każdemu?', 'Nie. Problemem są głównie źle przygotowane strączki; prawidłowe gotowanie znacząco zmniejsza aktywność lektyn.'], ['Czy przy kamieniach trzeba odstawić szpinak?', 'Nie zawsze. Zalecenia zależą od rodzaju kamienia, wyników moczu, całej diety i nawodnienia.'], ['Czy wapń nasila kamienie szczawianowe?', 'Wapń z posiłku może wiązać szczawiany w jelicie, dlatego automatyczne ograniczanie wapnia bywa niewłaściwe.'], ['Czy fityniany powodują niedobór żelaza?', 'Mogą ograniczać wchłanianie w posiłku, ale niedobór zależy od całej diety, zapotrzebowania i innych przyczyn.']],
    sources: [['Antinutrients — friend or foe? review', 'https://pubmed.ncbi.nlm.nih.gov/33244551/'], ['FDA Bad Bug Book — natural toxins including phytohaemagglutinin', 'https://www.fda.gov/media/83271/download'], ['NIDDK — eating, diet and nutrition for kidney stones', 'https://www.niddk.nih.gov/health-information/urologic-diseases/kidney-stones/eating-diet-nutrition'], ['Dietary oxalate and kidney stone formation — review', 'https://pubmed.ncbi.nlm.nih.gov/33215340/']]
  },
  {
    file: 'badania-krwi-po-50-jak-czesto.html',
    title: 'Badania krwi po 50-tce: które i jak często',
    h1: 'Badania krwi po 50-tce: które warto i jak często wykonywać?',
    description: 'Nie ma jednego pakietu badań krwi co 3 miesiące dla każdej osoby po 50-tce. Zobacz, jak ryzyko, leki, objawy i wcześniejsze wyniki wyznaczają terminy.',
    quick: 'Po 50-tce nie istnieje jeden obowiązkowy pakiet krwi co 3 miesiące ani raz w roku dla wszystkich. Częstotliwość zależy od wcześniejszych wyników, ciśnienia, masy ciała, chorób, leków, objawów i programu profilaktyki. Zacznij od przeglądu ryzyka z lekarzem; po nowym rozpoznaniu lub zmianie leczenia kontrola może być częstsza niż u zdrowej osoby ze stabilnymi wynikami.',
    takeaways: ['Wiek 50 lat sam nie ustala częstotliwości morfologii, lipidogramu, TSH, witaminy D ani markerów nowotworowych.', 'USPSTF zaleca badanie stanu przedcukrzycowego i cukrzycy u dorosłych 35–70 lat z nadwagą lub otyłością; termin powtórki zależy od wyniku i ryzyka.', 'PSA wymaga wspólnej decyzji, a markery nowotworowe nie są uniwersalnym pakietem przesiewowym.', 'Kontrole po rozpoczęciu leku służą innemu celowi niż badania przesiewowe bez objawów.'],
    sections: [
      ['Od czego zacząć plan badań po 50-tce?', 'Zbierz wcześniejsze wyniki, listę leków, choroby rodzinne, ciśnienie, masę ciała, palenie i nowe objawy. Lekarz dobiera badania do prawdopodobieństwa problemu oraz tego, czy wynik zmieni postępowanie. Powtarzanie szerokiego panelu bez wskazania zwiększa ryzyko przypadkowych odchyleń i kolejnych niepotrzebnych testów.', 'Podstawowy przegląd profilaktyki znajdziesz w <a href="badania-po-50.html">liście badań po 50-tce</a>, ale indywidualny harmonogram wymaga kontekstu.'],
      ['Jak często kontrolować glukozę i lipidy?', 'USPSTF zaleca przesiew w kierunku stanu przedcukrzycowego i cukrzycy u dorosłych 35–70 lat z nadwagą lub otyłością. Przy prawidłowym wyniku podaje trzy lata jako rozsądny odstęp, choć ryzyko może uzasadniać inny termin. Lipidy kontroluje się według ryzyka i leczenia, nie jednej daty urodzin.', 'Po rozpoznaniu cukrzycy lub zmianie leku harmonogram jest osobny. ApoB i lipidogram wyjaśnia <a href="apob-norma-cena-jak-czytac-wynik.html">poradnik interpretacji ApoB</a>.'],
      ['Czy morfologia, TSH i witamina D są obowiązkowe co rok?', 'Nie ma uniwersalnego zalecenia, aby każda bezobjawowa osoba wykonywała wszystkie te oznaczenia corocznie. Morfologia może być uzasadniona przy objawach, chorobach lub lekach; TSH zależy od objawów i ryzyka, a rutynowy przesiew witaminy D u bezobjawowych dorosłych nie ma wystarczających dowodów według USPSTF.', 'Zmęczenie ma wiele przyczyn i nie powinno automatycznie uruchamiać przypadkowego pakietu. Wyniki trzeba interpretować razem z objawami oraz zakresem laboratorium. Jedną z częstych zmiennych omawia <a href="sen-po-50.html">poradnik snu po 50-tce</a>.'],
      ['Które badania wymagają wspólnej decyzji lub konkretnego wskazania?', 'PSA u mężczyzn 55–69 lat według USPSTF wymaga indywidualnej decyzji po rozmowie o korzyściach i szkodach; po 70 roku życia rutynowy przesiew nie jest zalecany. Markery takie jak CA-125 lub CEA nie tworzą ogólnego pakietu dla zdrowych osób bez konkretnego wskazania.', 'Objawy alarmowe nie powinny czekać na termin profilaktyki. Zmiana rytmu wypróżnień, krwawienie, niewyjaśniona utrata masy lub guz wymagają oceny niezależnie od „rocznych badań”. Cholesterol szerzej omawia <a href="centrum-cholesterolu-po-50.html">Centrum Cholesterolu</a>.']
    ],
    callouts: ['Oddziel przesiew osoby bez objawów od monitorowania choroby lub leku — to dwa różne harmonogramy.', 'Nie zamawiaj markerów nowotworowych jako ogólnego „sprawdzenia raka”; mogą dawać wyniki fałszywie dodatnie i fałszywie ujemne.'],
    quote: 'Dobry harmonogram badań odpowiada na konkretne ryzyko lub decyzję, a nie na samą liczbę lat.',
    table: ['Jak ustalić częstotliwość badań krwi?', ['Sytuacja', 'Co wyznacza termin?', 'Przykład'], [['Bez objawów i bez rozpoznania', 'Wiek, ryzyko i zalecenia przesiewowe', 'Glukoza przy określonym ryzyku'], ['Nowe odchylenie', 'Wielkość wyniku i możliwa przyczyna', 'Powtórka po ustalonym czasie'], ['Nowy lek', 'Profil bezpieczeństwa i efekt leczenia', 'Termin zlecony przez lekarza'], ['Nowy objaw', 'Pilność i możliwe rozpoznania', 'Diagnostyka, nie kalendarz roczny']]],
    faqs: [['Czy po 50-tce trzeba robić krew co 3 miesiące?', 'Nie. Taki odstęp może dotyczyć wybranej choroby lub leczenia, ale nie jest zasadą dla każdej zdrowej osoby.'], ['Jak często badać cukier?', 'Przy prawidłowym wyniku trzy lata może być rozsądnym odstępem w grupie przesiewowej USPSTF, lecz ryzyko zmienia termin.'], ['Czy witaminę D trzeba badać co rok?', 'Nie ma wystarczających dowodów na rutynowy przesiew wszystkich bezobjawowych dorosłych; wskazania kliniczne są osobną sprawą.'], ['Czy markery nowotworowe wykrywają każdy nowotwór?', 'Nie. Nie są uniwersalnym pakietem przesiewowym i mogą dawać wyniki dodatnie bez raka lub prawidłowe mimo choroby.']],
    sources: [['USPSTF — screening for prediabetes and type 2 diabetes', 'https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/screening-for-prediabetes-and-type-2-diabetes'], ['USPSTF — vitamin D deficiency screening', 'https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/vitamin-d-deficiency-screening'], ['USPSTF — prostate cancer screening', 'https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/prostate-cancer-screening'], ['USPSTF — hypertension screening', 'https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/hypertension-in-adults-screening']]
  },
  {
    file: 'nawodnienie-na-treningu-po-50.html',
    title: 'Nawodnienie na treningu po 50-tce bez nadmiaru',
    h1: 'Nawodnienie na treningu po 50-tce: ile płynu naprawdę pić?',
    description: 'Nawodnienie na treningu po 50-tce zależy od pragnienia, potu, pogody i leków. Sprawdź prosty plan, rolę sodu oraz objawy odwodnienia i hiponatremii.',
    quick: 'Na typowym krótkim treningu pij zgodnie z pragnieniem i miej wodę pod ręką zamiast realizować sztywny plan litrów. Zapotrzebowanie rośnie przy upale, długim wysiłku i dużej potliwości, ale nadmierne picie może wywołać hiponatremię. Jeśli po długim wysiłku masa ciała wzrosła, to sygnał, że ilość płynu mogła przekroczyć straty.',
    takeaways: ['Stała liczba mililitrów na godzinę nie pasuje do każdej pogody, osoby i rodzaju treningu.', 'Pragnienie jest praktycznym przewodnikiem dla większości aktywności, ale choroby i leki mogą wymagać indywidualnego planu.', 'Sód w napoju nie zabezpiecza przed hiponatremią, jeśli ktoś pije znacznie więcej niż traci.', 'Ból głowy, nudności i splątanie po długim wysiłku mogą oznaczać zarówno problemy z płynami, jak i inne stany wymagające oceny.'],
    sections: [
      ['Ile pić podczas zwykłego treningu?', 'Straty potu zmieniają się wraz z temperaturą, ubraniem, intensywnością, masą ciała i indywidualną potliwością, dlatego jedna dawka na godzinę może być zbyt mała albo zbyt duża. Dla większości rekreacyjnych treningów praktycznym punktem wyjścia jest picie zgodnie z pragnieniem i dostęp do wody.', 'Nie zmuszaj się do opróżnienia dużej butelki w określonym czasie. Plan treningowy dopasujesz z <a href="trening-3x30-dla-50-plus.html">programem 3×30 po 50-tce</a>.'],
      ['Jak oszacować własne straty potu?', 'Przy dłuższej sesji możesz porównać masę przed i po treningu w podobnym ubraniu, uwzględniając wypity płyn oraz oddany mocz. Wynik z jednej sesji dotyczy tylko zbliżonych warunków. Wzrost masy podczas wysiłku oznacza, że wypito więcej niż wyniosły straty netto.', 'Nie potrzebujesz codziennego ważenia dla krótkiego treningu. Test ma sens przy powtarzalnym długim wysiłku lub przygotowaniu do startu, podobnie jak zapis parametrów w <a href="waty-apple-watch-moc-zdrowie-po-50.html">poradniku mocy treningowej</a>.'],
      ['Kiedy potrzebne są elektrolity?', 'Woda zwykle wystarcza przy krótszym rekreacyjnym treningu. Sód może być przydatny podczas długiego wysiłku, dużej potliwości lub gdy potrzebę wskazuje plan żywieniowy i warunki. Nie zapobiega jednak hiponatremii, jeśli całkowita ilość hipotonicznego płynu przekracza zdolność wydalania oraz straty.', 'Osoby z nadciśnieniem, niewydolnością serca, chorobą nerek lub zaleconym limitem płynów i sodu potrzebują indywidualnych zaleceń. Ciśnienie i trening omawia <a href="centrum-nadcisnienia-po-50.html">Centrum Nadciśnienia</a>.'],
      ['Jak rozpoznać odwodnienie i hiponatremię?', 'Pragnienie, suchość w ustach i spadek wydolności mogą towarzyszyć niedoborowi płynu, ale nie są swoiste. Hiponatremia po długim wysiłku może powodować ból głowy, nudności, wymioty, obrzęk, splątanie, drgawki lub utratę przytomności. Ciężkie objawy wymagają natychmiastowej pomocy medycznej.', 'Nie lecz splątania po zawodach kolejnymi litrami czystej wody bez oceny. Informację o lekach moczopędnych i chorobach przekaż personelowi. Codzienne żywienie opisuje <a href="dieta-po-50.html">poradnik diety po 50-tce</a>.']
    ],
    callouts: ['Wzrost masy ciała podczas długiego wysiłku wskazuje na nadmiar wypitego płynu względem strat netto.', 'Splątanie, drgawki lub utrata przytomności po wysiłku wymagają pilnej pomocy — nie podawaj automatycznie kolejnej wody.'],
    quote: 'Dobry plan nawodnienia zastępuje sztywny litr obserwacją pragnienia, warunków, potu i ograniczeń zdrowotnych.',
    table: ['Nawodnienie zależne od sytuacji', ['Sytuacja', 'Punkt wyjścia', 'Kiedy zmienić plan?'], [['Krótki trening rekreacyjny', 'Woda według pragnienia', 'Upał lub duża potliwość'], ['Długi wysiłek', 'Indywidualny plan płynów', 'Na podstawie prób i warunków'], ['Duże straty potu', 'Rozważ sód z jedzeniem lub napojem', 'Bez przekraczania strat płynu'], ['Choroba nerek lub serca', 'Zalecenie kliniczne', 'Nie stosuj planu ogólnego']]],
    faqs: [['Ile wody pić na godzinę treningu?', 'Nie ma jednej dawki dla wszystkich. Zacznij od pragnienia, a przy długim wysiłku oszacuj straty w podobnych warunkach.'], ['Czy izotonik jest potrzebny na siłowni?', 'Zwykle nie przy krótkiej sesji. Może mieć rolę przy długim wysiłku lub dużych stratach, zależnie od całej diety.'], ['Czy elektrolity chronią przed przewodnieniem?', 'Nie, jeśli pijesz więcej niż tracisz. Nadmiar płynu pozostaje głównym czynnikiem ryzyka hiponatremii wysiłkowej.'], ['Czy kolor moczu wystarczy do oceny?', 'Może dać orientację, ale wpływają na niego dieta, suplementy, leki i pora; nie jest samodzielnym testem klinicznym.']],
    sources: [['Exercise-associated hyponatremia — 2017 update', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5334560/'], ['Third International EAH Consensus Statement', 'https://pubmed.ncbi.nlm.nih.gov/26160393/'], ['NATA fluid replacement position statement', 'https://pubmed.ncbi.nlm.nih.gov/28985128/'], ['ACSM exercise and fluid replacement position stand', 'https://pubmed.ncbi.nlm.nih.gov/17277604/']]
  }
];

function esc(value) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderTable([caption, headers, rows]) {
  return `<div class="article-table-wrap"><table class="article-table"><caption>${caption}</caption><thead><tr>${headers.map((item) => `<th scope="col">${item}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((item, index) => index === 0 ? `<th scope="row">${item}</th>` : `<td>${item}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function renderBody(article, hub, share) {
  const sections = article.sections.map(([heading, first, second], index) => {
    const callout = index === 1 || index === 3 ? `<aside class="highlight-box highlight-box--accent"><h3>W praktyce</h3><p>${article.callouts[index === 1 ? 0 : 1]}</p></aside>` : '';
    return `<h2>${heading}</h2><p>${first}</p><p>${second}</p>${callout}`;
  }).join('');
  const faq = article.faqs.map(([q, a], index) => `<article class="faq-item" id="faq-${index + 1}"><h3>${q}</h3><p>${a}</p></article>`).join('');
  const sources = article.sources.map(([label, url]) => `<li><a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a></li>`).join('');
  return `<article class="article-content"><section class="quick-answer reveal" id="quick-answer" aria-label="Szybka odpowiedź"><h2>Szybka odpowiedź</h2><p>${article.quick}</p></section><section class="key-takeaways reveal" data-ai-summary="editorial" aria-label="Kluczowe wnioski"><h2>Kluczowe wnioski</h2><ul>${article.takeaways.map((item) => `<li>${item}</li>`).join('')}</ul></section>${sections}${renderTable(article.table)}<blockquote class="article-quote"><p>${article.quote}</p></blockquote><section class="faq-list reveal" aria-label="Najczęściej zadawane pytania"><h2>Najczęściej zadawane pytania</h2>${faq}</section>${hub || ''}${share || ''}<h2 id="zrodla">Źródła</h2><ol class="sources-list">${sources}</ol><div class="medical-disclaimer"><p><strong>Uwaga:</strong> Artykuł ma charakter informacyjny i edukacyjny. Nie zastępuje konsultacji, diagnozy ani indywidualnego leczenia.</p></div></article>`;
}

function updateJsonLd(html, article) {
  let sawFaq = false;
  html = html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, (whole, raw) => {
    let data;
    try { data = JSON.parse(raw); } catch (_) { return whole; }
    if (data['@type'] === 'BlogPosting') {
      data.headline = article.h1;
      data.description = article.description;
      data.dateModified = MODIFIED;
      data.citation = article.sources.map((source) => source[1]);
      data.speakable = { '@type': 'SpeakableSpecification', cssSelector: ['#quick-answer p'] };
      if (data.encoding) data.encoding.name = `${article.h1} (PDF)`;
    }
    if (data['@type'] === 'FAQPage') {
      sawFaq = true;
      data.mainEntity = article.faqs.map(([name, answer]) => ({ '@type': 'Question', name, acceptedAnswer: { '@type': 'Answer', text: answer } }));
    }
    if (data['@type'] === 'BreadcrumbList' && Array.isArray(data.itemListElement)) {
      const last = data.itemListElement[data.itemListElement.length - 1];
      if (last) last.name = article.h1;
    }
    return `<script type="application/ld+json">\n${JSON.stringify(data, null, 2)}\n</script>`;
  });
  if (!sawFaq) {
    const faqData = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: article.faqs.map(([name, answer]) => ({ '@type': 'Question', name, acceptedAnswer: { '@type': 'Answer', text: answer } })) };
    html = html.replace('</head>', `<script type="application/ld+json">\n${JSON.stringify(faqData, null, 2)}\n</script>\n</head>`);
  }
  return html;
}

function updateMeta(html, article) {
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${article.title} | FitPo50</title>`);
  html = html.replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(article.description)}">`);
  html = html.replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(article.title)}">`);
  html = html.replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(article.description)}">`);
  html = html.replace(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${esc(article.title)}">`);
  html = html.replace(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${esc(article.description)}">`);
  html = html.replace(/<meta property="article:modified_time" content="[^"]*">/, `<meta property="article:modified_time" content="${MODIFIED}">`);
  html = html.replace(/<h1 class="article-header__title">[\s\S]*?<\/h1>/, `<h1 class="article-header__title">${article.h1}</h1>`);
  html = html.replace(/<span class="article-kicker-card__date">[\s\S]*?<\/span>/, '');
  if (article.file === 'syndrom-pierwszego-poniedzialku.html') {
    html = html.replace(/(<meta property="og:image" content="[^"]*\/assets\/)ponedzialek_hero\.webp(">)/, '$1ponedzialek_hero.jpg$2');
    html = html.replace(/(<meta name="twitter:image" content="[^"]*\/assets\/)ponedzialek_hero\.webp(">)/, '$1ponedzialek_hero.jpg$2');
    html = html.replace('<img src="./assets/ponedzialek_hero.webp"', '<img src="./assets/ponedzialek_hero.jpg"');
  }
  if (article.file === 'lektyny-szczawiany-fityniany-czy-sa-grozne-po-50.html') {
    html = html.replace(/(<meta property="og:image" content="[^"]*\/assets\/)antyodzywcze-skladniki-warzywa-straczki\.webp(">)/, '$1antyodzywcze-skladniki-warzywa-straczki.jpg$2');
    html = html.replace(/(<meta name="twitter:image" content="[^"]*\/assets\/)antyodzywcze-skladniki-warzywa-straczki\.webp(">)/, '$1antyodzywcze-skladniki-warzywa-straczki.jpg$2');
  }
  return html;
}

const dimensions = {
  'logo-fitpo50.png': [256, 249], 'brak-motyw.webp': [1200, 669], 'sakady-mozg-oko-sciezki-sakad-hero.jpg': [1080, 603],
  'Hero_piesc.webp': [1300, 726], 'sniadanie-bialkowo-tluszczowe-hero.jpg': [1080, 589], 'ponedzialek_hero.webp': [1080, 603], 'ponedzialek_hero.jpg': [1080, 603],
  'dzieci-patrza-na-ciebie-hero.jpg': [2200, 1642], 'siedem-bledow-silownia-po-50-hero.jpg': [1080, 603],
  'antyodzywcze-skladniki-warzywa-straczki.jpg': [2816, 1536], 'badania-krwi-po-50-hero.jpg': [1080, 589], 'woda-na-silowni.jpg': [1024, 1024],
  'healthspan_zegar_hero.webp': [1080, 603], 'hrt-prawda-hero.webp': [2752, 1536], 'media_hero_v2.webp': [1024, 571],
  'apob-apoa-hero.jpg': [2200, 1200], 'badania-przed-50-hero.jpg': [1600, 893], 'kolana-hero.jpg': [1600, 893],
  'post-36h-hero.jpg': [1080, 589], 'kreatyna-bialko-po-50-hero.jpg': [1080, 589], 'bledy-hero.jpg': [1600, 893],
  'bieznia-za-malo-hero.jpg': [2200, 1200], 'poczatek-hero.jpg': [1600, 893], 'biohacking-kriokomory-hiperbaryczne-hero.jpg': [1080, 589],
  'rtg-mri-ct-badania-obrazowe-porownanie-hero.jpg': [1080, 589], 'trening-silowy-hormony-50-hero.jpg': [1080, 589],
  'silownia-serce-ochrona-hero.jpg': [1080, 589], 'okulary-do-czytania-hero.jpg': [1080, 589], 'keto-cholesterol-hero.jpg': [1080, 589],
  'dieta-hero.jpg': [1600, 893], 'jedz-wiecej-hero.jpg': [1600, 893]
};

function addImageDimensions(html) {
  return html.replace(/<img\b([^>]*?)>/g, (whole, attrs) => {
    const src = (attrs.match(/src="[^"]+\/([^/"]+)"/) || [])[1];
    const size = dimensions[src];
    if (!size) return whole;
    let next = attrs.replace(/\s+width="\d+"/g, '').replace(/\s+height="\d+"/g, '').replace(/\s*\/?$/, '');
    return `<img${next} width="${size[0]}" height="${size[1]}">`;
  });
}

for (const article of articles) {
  const filePath = path.join(ROOT, article.file);
  let html = fs.readFileSync(filePath, 'utf8');
  const hub = (html.match(/<p class="topic-hub-backlink">[\s\S]*?<\/p>/) || [''])[0];
  const share = (html.match(/<section class="share-article-section reveal"[\s\S]*?<\/section>/) || [''])[0];
  html = updateJsonLd(html, article);
  html = updateMeta(html, article);
  const bodyPattern = /<article class="article-content">[\s\S]*?<\/article>\s*<\/div>\s*<\/main>\s*<section class="reading-room/;
  if (!bodyPattern.test(html)) throw new Error(`Nie znaleziono treści artykułu: ${article.file}`);
  html = html.replace(bodyPattern, `${renderBody(article, hub, share)}</div></main><section class="reading-room`);
  html = addImageDimensions(html).replace(/‑/g, '-').replace(/₂/g, '2');
  fs.writeFileSync(filePath, html);
  console.log(`[BATCH-5] repaired ${article.file}`);
}
