#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const MODIFIED = '2026-08-23T23:30:00+02:00';

const articles = [
  {
    file: 'badania-po-50.html',
    title: 'Badania przed treningiem po 50-tce: co sprawdzić?',
    h1: 'Badania przed treningiem po 50-tce: co naprawdę sprawdzić?',
    description: 'Badania przed treningiem po 50-tce dobiera się do objawów, chorób i intensywności wysiłku. Sprawdź, kiedy wystarczy wywiad, a kiedy potrzebna jest diagnostyka.',
    quick: 'Przed spokojnym startem bez objawów nie każdy potrzebuje morfologii, lipidogramu i EKG. Najpierw oceń choroby, leki, dotychczasową aktywność oraz objawy podczas wysiłku. Ból w klatce, omdlenie, kołatanie z osłabieniem albo nietypowa duszność wymagają konsultacji przed treningiem; dobór badań wynika wtedy z podejrzenia klinicznego, a nie z samego wieku 50 lat.',
    takeaways: ['Sam wiek powyżej 50 lat nie tworzy obowiązkowego pakietu badań przed ruchem.', 'Algorytm ACSM opiera decyzję na aktywności, rozpoznanych chorobach, objawach i planowanej intensywności.', 'USPSTF odradza przesiewowe EKG spoczynkowe lub wysiłkowe u bezobjawowych dorosłych z małym ryzykiem sercowo-naczyniowym.', 'Ból w klatce, omdlenie lub nieproporcjonalna duszność zmieniają sytuację z profilaktycznej na diagnostyczną.'],
    sections: [
      ['Czy każdy po 50-tce potrzebuje badań przed treningiem?', 'Nie. Aktualizowany algorytm ACSM ogranicza niepotrzebne skierowania i uwzględnia obecny poziom aktywności, znaną chorobę sercowo-naczyniową, metaboliczną lub nerkową, obecność objawów oraz intensywność planowanego wysiłku. Data urodzenia sama nie rozstrzyga o morfologii, lipidogramie, EKG ani próbie wysiłkowej.', 'Jeżeli wracasz bez objawów do lekkiego ruchu, zacznij stopniowo według <a href="powrot-do-formy-po-50-kompletny-przewodnik.html">planu powrotu do formy po 50-tce</a>.'],
      ['Kiedy przed wysiłkiem potrzebna jest konsultacja?', 'Konsultacji wymagają szczególnie objawy sugerujące problem sercowo-naczyniowy: ból lub ucisk w klatce, omdlenie, zawroty związane z wysiłkiem, kołatanie z osłabieniem oraz duszność nieproporcjonalna do obciążenia. Znana niestabilna choroba albo niedawna zmiana stanu również uzasadnia ocenę przed zwiększeniem intensywności.', 'Przy nadciśnieniu znaczenie ma kontrola wartości i leczenia, co opisuje <a href="centrum-nadcisnienia-po-50.html">Centrum Nadciśnienia po 50-tce</a>.'],
      ['Czy EKG i próba wysiłkowa są potrzebne bez objawów?', 'Nie rutynowo. USPSTF zaleca, aby nie wykonywać przesiewowego EKG spoczynkowego ani wysiłkowego w celu zapobiegania zdarzeniom sercowo-naczyniowym u bezobjawowych dorosłych z małym ryzykiem. Przy ryzyku pośrednim lub wysokim dowody są niewystarczające, więc decyzja zależy od całego obrazu klinicznego.', 'Wynik lipidów służy ocenie ryzyka, ale nie jest przepustką do pojedynczego treningu; interpretację ApoB znajdziesz w <a href="apob-norma-cena-jak-czytac-wynik.html">poradniku ApoB</a>.'],
      ['Jak rozpocząć ruch po prawidłowej ocenie?', 'Zacznij od intensywności pozwalającej mówić pełnymi zdaniami, zanotuj reakcję podczas wysiłku i przez następną dobę, a następnie zwiększaj jeden parametr. Prawidłowe badanie nie wyklucza każdej możliwej choroby, dlatego nowe objawy są ważniejsze niż wcześniejsza kartka z wynikiem.', 'Pierwsze ćwiczenia i progresję porządkuje <a href="trening-3x30-dla-50-plus.html">plan treningu 3x30 po 50-tce</a>.']
    ],
    callouts: ['Nie kupuj pakietu „dla sportowca” bez pytania, jaki wynik zmieni decyzję o treningu lub leczeniu.', 'Jeśli w trakcie ruchu pojawi się ból w klatce, omdlenie albo nagła nietypowa duszność, przerwij wysiłek i uzyskaj pomoc.'],
    quote: 'Dobre badanie przed treningiem odpowiada na konkretne ryzyko; nie jest rytuałem wykonywanym każdemu po pięćdziesiątce.',
    table: ['Ocena przed treningiem po 50-tce', ['Sytuacja', 'Rozsądny krok', 'Czego nie zakładać?'], [['Bez objawów, lekki start', 'Stopniowe rozpoczęcie i obserwacja', 'Że każdy potrzebuje EKG'], ['Znana stabilna choroba', 'Ustalenie bezpiecznej intensywności', 'Że prawidłowy wynik usuwa całe ryzyko'], ['Objawy przy wysiłku', 'Konsultacja i diagnostyka celowana', 'Że to tylko słaba kondycja'], ['Nagły ciężki objaw', 'Przerwanie wysiłku i pilna pomoc', 'Że trzeba dokończyć trening']]],
    faqs: [['Czy przed siłownią po 50-tce trzeba zrobić EKG?', 'Nie każdemu. U bezobjawowej osoby z małym ryzykiem przesiewowe EKG nie jest zalecane; objawy lub choroby zmieniają decyzję.'], ['Czy morfologia jest obowiązkowa przed treningiem?', 'Nie z powodu samego wieku. Może być wskazana przy objawach, chorobie, lekach albo konkretnym podejrzeniu.'], ['Czy próba wysiłkowa daje zgodę na każdy trening?', 'Nie. Ocenia określony problem i moment; plan nadal wymaga stopniowania, a nowe objawy wymagają ponownej oceny.'], ['Kiedy przerwać trening?', 'Przy bólu w klatce, omdleniu, nagłej nietypowej duszności, objawach neurologicznych lub gwałtownym pogorszeniu samopoczucia.']],
    sources: [['ACSM preparticipation screening update', 'https://pubmed.ncbi.nlm.nih.gov/26473759/'], ['USPSTF - screening with electrocardiography', 'https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/cardiovascular-disease-risk-screening-with-electrocardiography'], ['WHO guidelines on physical activity', 'https://www.who.int/publications/i/item/9789240015128'], ['Exercise preparticipation screening - implementation review', 'https://pubmed.ncbi.nlm.nih.gov/27860586/']]
  },
  {
    file: 'trening-3x30-dla-50-plus.html',
    title: 'Trening 3x30 po 50-tce: prosty plan tygodnia',
    h1: 'Trening 3x30 po 50-tce: trzy sesje siły, równowagi i sprawności',
    description: 'Trening 3x30 po 50-tce łączy dwie sesje siłowe i jedną sprawnościową. Zobacz ćwiczenia, progresję przez 4 tygodnie oraz objawy wymagające przerwy.',
    quick: 'Plan 3x30 to trzy sesje po około 30 minut: dwa treningi całego ciała i jeden trening marszu, równowagi oraz mobilności. To praktyczny punkt startu, nie oficjalna norma. Zacznij z zapasem 2-3 powtórzeń, a przez pierwsze 4 tygodnie zwiększaj tylko jeden parametr: powtórzenia, czas albo najmniejszy dostępny ciężar.',
    takeaways: ['WHO zaleca wzmacnianie głównych grup mięśni co najmniej dwa dni w tygodniu oraz ruch aerobowy i równowagę.', 'Plan 3x30 nie wyczerpuje całej tygodniowej dawki ruchu, lecz porządkuje trzy konkretne wejścia.', 'Pierwsze dwie sesje obejmują wzorce przysiadu, pchania, przyciągania, zawiasu biodrowego i noszenia.', 'Progresja dotyczy jednego parametru naraz i ustaje, jeśli technika lub objawy się pogarszają.'],
    sections: [
      ['Jak rozłożyć trzy treningi po 30 minut?', 'W poniedziałek wykonaj sesję siłową A, w środę marsz z blokiem równowagi, a w piątek sesję siłową B. Dni można przesunąć, zachowując przerwę między treningami siłowymi. Każde spotkanie obejmuje około 5 minut przygotowania, 20 minut pracy i 5 minut spokojnego zakończenia.', 'Jeśli zaczynasz na maszynach, użyj ustawień z <a href="trening-maszynowy-po-50.html">30-dniowego planu treningu maszynowego</a>.'],
      ['Co wykonać podczas sesji siłowej A i B?', 'W sesji A wybierz siad do krzesła lub wypychanie nogami, przyciąganie oraz wyciskanie. W sesji B zastosuj bezbolesny zawias biodrowy, przyciąganie w innym ustawieniu, podporowe pchanie i noszenie. Wykonaj po 2 serie 6-12 powtórzeń, kończąc z zapasem 2-3 poprawnych ruchów.', 'Technikę startową i ustawienie sprzętu opisuje <a href="jak-zaczac-na-silowni-po-50.html">przewodnik pierwszej wizyty na siłowni</a>.'],
      ['Jak zaplanować marsz, równowagę i mobilność?', 'Po 5 minutach spokojnego marszu przejdź do 10-15 minut tempa, przy którym możesz mówić zdaniami. Następnie wykonaj przy stabilnym podparciu trzy krótkie próby stania w węższej pozycji i ćwiczenie kroku. Ostatnie minuty przeznacz na ruchomość kostki, biodra i odcinka piersiowego.', 'Alternatywę dla marszu daje <a href="nordic-walking-jak-zaczac-technika-kije-zdrowie.html">bezpieczny start z nordic walking</a>.'],
      ['Jak progresować plan przez pierwsze 4 tygodnie?', 'W pierwszym tygodniu poznaj ustawienia i zanotuj obciążenia. W drugim dodaj po jednym powtórzeniu, jeśli wszystkie serie były kontrolowane. W trzecim utrzymaj wynik albo dodaj najmniejszy ciężar. W czwartym oceń regularność, objawy i regenerację; nie wykonuj testu maksimum tylko dlatego, że minął miesiąc.', 'Jeśli ból utrzymuje się lub narasta, cofnij konkretny ruch i skorzystaj z zasad opisanych w <a href="powrot-do-formy-po-50-kompletny-przewodnik.html">planie powrotu do formy</a>.']
    ],
    callouts: ['Zapisuj ciężar, powtórzenia i zapas. Bez dziennika „trochę więcej” szybko staje się przypadkową progresją.', 'Ból w klatce, omdlenie, nagła nietypowa duszność albo objaw neurologiczny kończą trening i wymagają oceny.'],
    quote: 'Trzy krótkie sesje mają stworzyć powtarzalny tydzień, a nie udowodnić formę w pierwszym miesiącu.',
    table: ['Tydzień treningu 3x30', ['Dzień', 'Główna praca', 'Kontrola'], [['Sesja A', '3 ćwiczenia całego ciała, po 2 serie', 'Zapas 2-3 powtórzeń'], ['Sesja ruchowa', 'Marsz, równowaga i mobilność', 'Możliwość mówienia zdaniami'], ['Sesja B', '4 wzorce, po 2 serie', 'Bez ostrego bólu'], ['Po 4 tygodniach', 'Ocena dziennika', 'Zmień jeden parametr']]],
    faqs: [['Czy trzy treningi po 30 minut wystarczą?', 'To dobry start, ale całotygodniowy ruch obejmuje też codzienną aktywność i docelowe zalecenia aerobowe WHO.'], ['Jak ciężko ćwiczyć na początku?', 'Zostaw 2-3 poprawne powtórzenia w zapasie i przerwij serię, gdy technika wyraźnie się psuje.'], ['Czy można trenować dzień po dniu?', 'Można przesuwać dni, lecz początkującemu zwykle pomaga przerwa między dwiema sesjami siłowymi całego ciała.'], ['Co zwiększyć po tygodniu?', 'Tylko jeden parametr: jedno powtórzenie, niewielki ciężar albo czas, jeśli poprzednia dawka była dobrze tolerowana.']],
    sources: [['WHO guidelines on physical activity', 'https://www.who.int/publications/i/item/9789240015128'], ['Resistance exercise in older adults - position statement', 'https://pubmed.ncbi.nlm.nih.gov/28991040/'], ['Resistance training prescription - network meta-analysis', 'https://pubmed.ncbi.nlm.nih.gov/37414459/'], ['Multicomponent exercise in older adults - umbrella review', 'https://pubmed.ncbi.nlm.nih.gov/29521871/']]
  },
  {
    file: 'dieta-keto-cholesterol-ldl-hdl-badania-naukowe.html',
    title: 'Keto a cholesterol po 50-tce: LDL, ApoB i kontrola',
    h1: 'Keto a cholesterol po 50-tce: kiedy sprawdzić LDL i ApoB?',
    description: 'Dieta keto może obniżyć trójglicerydy, ale u części osób podnosi LDL i ApoB. Sprawdź badania przed startem, kontrolę po 8-12 tygodniach i warunki przerwania.',
    quick: 'Dieta ketogeniczna nie poprawia każdego elementu lipidogramu. W badaniach średnio obniżała trójglicerydy i podnosiła HDL, ale jednocześnie zwiększała LDL; u szczupłych dorosłych wzrastało także ApoB. Zbadaj lipidogram przed zmianą i ponownie po 8-12 tygodniach. Wyraźny wzrost LDL lub ApoB omów z lekarzem zamiast tłumaczyć samym „dobrym HDL”.',
    takeaways: ['Spadek trójglicerydów nie unieważnia wzrostu LDL ani liczby cząstek aterogennych ocenianej przez ApoB.', 'Metaanaliza u dorosłych z BMI poniżej 25 wykazała wzrost LDL-C i ApoB na diecie bardzo niskowęglowodanowej.', 'Kontrola po 8-12 tygodniach jest praktycznym punktem oceny reakcji, a nie gwarantowanym terminem stabilizacji.', 'Rodzaj tłuszczu, błonnik, masa ciała, genetyka i leki mogą zmieniać odpowiedź lipidową.'],
    sections: [
      ['Jak dieta keto zmienia LDL, HDL i trójglicerydy?', 'Średnia z badań randomizowanych nie opisuje każdego uczestnika. Nowsze metaanalizy wykazują spadek trójglicerydów oraz niewielki wzrost HDL, ale także przeciętny wzrost LDL i cholesterolu całkowitego. U części osób odpowiedź LDL jest znacznie większa, dlatego obserwacja samej masy ciała nie wystarcza.', 'Znaczenie poszczególnych parametrów wyjaśnia <a href="centrum-cholesterolu-po-50.html">Centrum Cholesterolu po 50-tce</a>.'],
      ['Dlaczego ApoB jest ważne przy wzroście LDL?', 'ApoB przybliża liczbę cząstek aterogennych, ponieważ każda cząstka LDL i inne cząstki zawierające ApoB mają po jednej jego kopii. HDL nie „anuluje” mechanicznie ich obecności. Gdy LDL rośnie po zmianie diety, ApoB pomaga ocenić, czy wzrosła także liczba cząstek związanych z ryzykiem.', 'Sposób odczytania wyniku znajdziesz w <a href="apob-norma-cena-jak-czytac-wynik.html">poradniku norm i interpretacji ApoB</a>.'],
      ['Co zbadać przed keto i po 8-12 tygodniach?', 'Przed startem zapisz lipidogram, najlepiej ApoB, ciśnienie, masę oraz przyjmowane leki; przy cukrzycy i chorobach nerek plan wymaga konsultacji. Powtórz porównywalne oznaczenia po 8-12 tygodniach. Ten odstęp służy wczesnej kontroli reakcji, a nie samodzielnemu rozpoznaniu ryzyka na całe życie.', 'Częstotliwość dalszych kontroli dopasuj według <a href="badania-krwi-po-50-jak-czesto.html">zasad planowania badań krwi</a>.'],
      ['Co zrobić, gdy LDL lub ApoB wyraźnie wzrośnie?', 'Nie zakładaj, że wzrost jest nieszkodliwy, bo trójglicerydy spadły. Omów wynik z lekarzem, porównaj warunki pobrania i oceń całe ryzyko. Korekta może obejmować ograniczenie tłuszczów nasyconych, więcej nienasyconych źródeł tłuszczu i błonnika albo odejście od keto; leki zmienia się wyłącznie z prowadzącym.', 'Mniej restrykcyjną strukturę posiłków przedstawia <a href="dieta-po-50.html">poradnik diety po 50-tce</a>.']
    ],
    callouts: ['„HDL wzrosło” nie jest wystarczającą odpowiedzią na duży wzrost LDL lub ApoB.', 'Przy lekach przeciwcukrzycowych, ciąży, chorobie nerek, wątroby lub trzustki nie rozpoczynaj keto bez oceny klinicznej.'],
    quote: 'O tolerancji keto nie świadczy nazwa diety ani spadek masy, lecz konkretna reakcja organizmu i wyniki porównane z punktem wyjścia.',
    table: ['Kontrola lipidów przy diecie keto', ['Moment', 'Co sprawdzić?', 'Decyzja'], [['Przed startem', 'Lipidogram, ApoB, ryzyko i leki', 'Czy plan jest właściwy'], ['Po 8-12 tygodniach', 'Te same parametry w podobnych warunkach', 'Kontynuacja lub korekta'], ['Duży wzrost LDL/ApoB', 'Pełna ocena ryzyka', 'Zmiana diety lub leczenia z lekarzem'], ['Stabilne wyniki', 'Dalszy termin według ryzyka', 'Nie rezygnuj z kontroli']]],
    faqs: [['Czy keto zawsze podnosi LDL?', 'Nie u każdego, ale metaanalizy wykazują średni wzrost, a indywidualna odpowiedź może być znaczna.'], ['Czy wysokie HDL chroni przed wysokim ApoB?', 'Nie można tak wnioskować. HDL i ApoB opisują inne elementy profilu lipidowego i trzeba oceniać je osobno.'], ['Kiedy zbadać cholesterol po rozpoczęciu keto?', 'Praktycznym pierwszym punktem jest 8-12 tygodni, a dalszy termin zależy od wyniku, ryzyka i leczenia.'], ['Czy przy LDL 190 mg/dl wystarczy zmienić tłuszcze?', 'Taki wynik wymaga szybkiej oceny lekarskiej i przyczyn, a sama samodzielna korekta jadłospisu może być niewystarczająca.']],
    sources: [['Ketogenic diets and lipids in normal-weight adults - meta-analysis', 'https://pubmed.ncbi.nlm.nih.gov/36931263/'], ['Ketogenic diet and lipid profile - meta-analysis of RCTs', 'https://pubmed.ncbi.nlm.nih.gov/41621647/'], ['Ketogenic diet and multiple health outcomes - umbrella review', 'https://pubmed.ncbi.nlm.nih.gov/37836444/'], ['ESC guidelines on cardiovascular prevention', 'https://pubmed.ncbi.nlm.nih.gov/34458905/']]
  },
  {
    file: 'jak-obnizyc-kortyzol-po-50-stres-oponka-brzuszna.html',
    title: 'Kortyzol po 50-tce: stres, brzuch i diagnostyka',
    h1: 'Kortyzol po 50-tce: czy stres naprawdę powoduje oponkę?',
    description: 'Kortyzol zmienia się w ciągu doby, a pojedynczy wynik nie wyjaśnia oponki brzusznej. Poznaj rolę snu, stresu i objawy wymagające diagnostyki zespołu Cushinga.',
    quick: 'Przewlekły stres może utrudniać sen, apetyt i regularność ruchu, ale „oponka kortyzolowa” nie jest rozpoznaniem. Pojedynczy losowy kortyzol we krwi nie diagnozuje zespołu Cushinga ani przyczyny tkanki brzusznej. Jeśli rośnie obwód pasa, oceń sen, alkohol, aktywność, leki steroidowe i dietę; charakterystyczne postępujące objawy wymagają konsultacji endokrynologicznej.',
    takeaways: ['Kortyzol ma rytm dobowy i reaguje na pobranie krwi, wysiłek, sen oraz ostrą sytuację.', 'Endocrine Society nie zaleca losowego kortyzolu ani ACTH jako testu przesiewowego zespołu Cushinga.', 'Tkanka brzuszna zależy od bilansu energii, genetyki, menopauzy lub wieku, snu, ruchu i leków, a nie jednego hormonu.', 'Łatwe siniaczenie, szerokie purpurowe rozstępy i postępujące osłabienie mięśni wymagają oceny klinicznej.'],
    sections: [
      ['Czy wysoki kortyzol tworzy oponkę brzuszną?', 'Patologiczny nadmiar kortyzolu w zespole Cushinga może zmieniać rozmieszczenie tkanki tłuszczowej, lecz popularna „oponka kortyzolowa” nie pozwala rozpoznać tej choroby. U większości osób obwód pasa wynika z wielu nakładających się czynników, a sam wygląd brzucha nie wskazuje poziomu hormonu.', 'Zmiany masy i obwodu warto analizować razem z <a href="dieta-po-50.html">realnym bilansem diety po 50-tce</a>.'],
      ['Dlaczego pojedynczy kortyzol może wprowadzać w błąd?', 'Stężenie kortyzolu zmienia się w rytmie dobowym i zależy od snu, ostrego stresu, wysiłku, choroby oraz sposobu pobrania. Wytyczne nie zalecają losowego kortyzolu w surowicy ani ACTH do przesiewu Cushinga. Przy uzasadnionym podejrzeniu stosuje się określone testy, które interpretuje lekarz.', 'Jeśli głównym problemem jest nocne wybudzanie, zacznij od oceny opisanej w <a href="sen-po-50.html">poradniku snu po 50-tce</a>.'],
      ['Które działania rzeczywiście pomagają przy przewlekłym stresie?', 'Nie istnieje jeden „detoks kortyzolu”. Ustal stałą porę wstawania, ogranicz alkohol jako środek nasenny, zaplanuj regularny umiarkowany ruch i sprawdź, czy lista obowiązków zostawia czas na regenerację. Techniki relaksacyjne mogą zmniejszać odczuwany stres, ale nie zastępują leczenia depresji, bezdechu ani choroby endokrynologicznej.', 'Krótki i mierzalny start z ruchem daje <a href="trening-3x30-dla-50-plus.html">plan 3x30 po 50-tce</a>.'],
      ['Kiedy podejrzewać zespół Cushinga?', 'Podejrzenie rośnie przy kilku postępujących i względnie swoistych cechach, takich jak szerokie purpurowe rozstępy, łatwe siniaczenie, osłabienie mięśni ud i ramion, osteoporoza w nietypowym wieku albo charakterystyczne zmiany przy stosowaniu glikokortykosteroidów. Sam stres, zmęczenie lub wzrost masy są zbyt nieswoiste.', 'Zapisz wszystkie steroidy: tabletki, zastrzyki, inhalatory, kremy i aerozole; nie odstawiaj ich nagle bez lekarza. Ogólny plan kontroli opisują <a href="badania-po-50.html">badania po 50-tce</a>.']
    ],
    callouts: ['Nie kupuj „panelu kortyzolowego” tylko dlatego, że rośnie obwód pasa; zacznij od objawów, leków i oceny ryzyka.', 'Glikokortykosteroidów nie wolno odstawiać nagle po dłuższym stosowaniu. Dawkę zmienia prowadzący lekarz.'],
    quote: 'Kortyzol jest ważnym hormonem, lecz pojedyncza liczba nie jest etykietą przyklejoną do brzucha.',
    table: ['Stres a podejrzenie nadmiaru kortyzolu', ['Sytuacja', 'Co oznacza?', 'Następny krok'], [['Stres i gorszy sen', 'Częste, nieswoiste objawy', 'Praca nad snem i obciążeniem'], ['Sam wzrost obwodu pasa', 'Nie rozpoznaje Cushinga', 'Ocena wielu czynników'], ['Kilka postępujących typowych cech', 'Wyższe podejrzenie kliniczne', 'Konsultacja i właściwe testy'], ['Stosowanie steroidów', 'Możliwy wpływ na oś hormonalną', 'Przegląd wszystkich preparatów']]],
    faqs: [['Czy można zbadać kortyzol z krwi rano?', 'Można go oznaczyć w określonych wskazaniach, ale losowy wynik nie jest zalecanym przesiewem zespołu Cushinga.'], ['Czy oponka na brzuchu oznacza wysoki kortyzol?', 'Nie. Wygląd brzucha nie rozpoznaje poziomu hormonu ani choroby; znaczenie ma cały obraz i leki.'], ['Jakie testy stosuje się przy podejrzeniu Cushinga?', 'Wytyczne wymieniają między innymi wolny kortyzol w moczu, późnonocny kortyzol w ślinie i test hamowania deksametazonem.'], ['Czy adaptogen obniży kortyzol i brzuch?', 'Nie ma podstaw do takiej gwarancji. Suplement może też wchodzić w interakcje i nie leczy zespołu Cushinga.']],
    sources: [['Endocrine Society - diagnosis of Cushing syndrome', 'https://www.endocrine.org/clinical-practice-guidelines/diagnosis-of-cushing-syndrome'], ['Diagnosis of Cushing syndrome guideline', 'https://pubmed.ncbi.nlm.nih.gov/18334580/'], ['WHO guidelines on physical activity', 'https://www.who.int/publications/i/item/9789240015128'], ['Stress and obesity - systematic review', 'https://pubmed.ncbi.nlm.nih.gov/31135792/']]
  },
  {
    file: 'jak-producenci-ukrywaja-niezdrowe-skladniki-zywnosci.html',
    title: 'Ukryte składniki żywności: jak czytać etykiety?',
    h1: 'Ukryte składniki żywności: jak czytać etykietę bez marketingu?',
    description: 'Etykieta pokazuje składniki malejąco według masy i wartości na 100 g. Rozpoznaj cukry, sód, porcje marketingowe, alergeny i dodatki bez straszenia E-numerami.',
    quick: 'Producent nie może dowolnie „ukryć” obowiązkowych składników, ale opakowanie może kierować uwagę na hasła z przodu zamiast na skład i tabelę. W UE składniki podaje się zasadniczo malejąco według masy, a wartości odżywcze na 100 g lub 100 ml. Porównuj więc tę samą jednostkę, sprawdzaj realną porcję i nie oceniaj produktu po jednym E-numerze.',
    takeaways: ['Lista składników jest uporządkowana według masy użytej przy produkcji, z wyjątkami określonymi prawem.', 'Deklaracja na 100 g lub 100 ml pozwala porównywać produkty mimo różnych sugerowanych porcji.', 'Cukry mogą pochodzić z wielu składników, lecz pozycja pojedynczej nazwy nie podaje łącznego procentu wszystkich cukrów.', 'Numer E oznacza oceniony dodatek dopuszczony do określonych zastosowań, a nie automatycznie „truciznę”.'],
    sections: [
      ['Jak czytać kolejność składników?', 'W unijnym systemie składniki wymienia się zasadniczo w kolejności malejącej według masy w chwili użycia. Pierwsze pozycje mówią więc więcej o konstrukcji produktu niż grafika na przodzie. Nie można jednak obliczyć dokładnej receptury wyłącznie z kolejności, chyba że prawo wymaga podania procentu wybranego składnika.', 'Podstawowe zasady i przykłady rozwija <a href="jak-czytac-etykiety-sklad-produktow-e-numery-inci.html">przewodnik czytania etykiet</a>.'],
      ['Czy różne nazwy cukru wprowadzają w błąd?', 'Syrop glukozowy, sacharoza, miód i koncentrat soku są odrębnymi składnikami, choć wszystkie mogą wnosić cukry. Rozdzielenie nazw nie pozwala automatycznie stwierdzić naruszenia prawa, ale utrudnia szybkie oszacowanie. Dlatego sprawdź także w tabeli pozycję „w tym cukry” na 100 g.', 'Wpływ słodkiego śniadania na głód omawia <a href="sniadanie-bialkowo-tluszczowe-zachcianki-na-cukier.html">artykuł o białku i zachciankach</a>.'],
      ['Jak porównać sól, tłuszcz i wielkość porcji?', 'Najpierw zestaw wartości na 100 g lub 100 ml, ponieważ porcja sugerowana przez producenta może być mniejsza niż ilość faktycznie zjadana. Następnie przelicz na własną porcję. W tabeli „sól” nie jest tym samym zapisem co sód; w UE sól wylicza się z sodu według określonego przelicznika.', 'Przy nadciśnieniu znaczenie całodziennej podaży sodu opisuje <a href="centrum-nadcisnienia-po-50.html">Centrum Nadciśnienia</a>.'],
      ['Czy E-numery oznaczają niezdrowy produkt?', 'Nie. E-numer identyfikuje dodatek oceniony i dopuszczony w Unii Europejskiej wraz z warunkami użycia. Nie oznacza to, że każdy produkt z dodatkiem ma wysoką wartość żywieniową. O jakości lepiej wnioskować z całego składu, wartości odżywczej, częstotliwości jedzenia i realnej porcji.', 'Badanie kontrolowane NIH pokazało większe spontaniczne spożycie energii na diecie ultraprzetworzonej, lecz nie dowodzi szkodliwości każdego dodatku osobno. Kontekst daje <a href="dieta-po-50.html">dieta po 50-tce</a>.']
    ],
    callouts: ['Zrób zdjęcie etykiety i porównuj produkty na 100 g, nie według różnych „porcji” z przodu opakowania.', 'Alergen musi być wyróżniony w wykazie składników; osoba z alergią nie powinna polegać wyłącznie na haśle marketingowym.'],
    quote: 'Najbardziej użyteczna część opakowania zwykle nie krzyczy: to lista składników i tabela na 100 gramów.',
    table: ['Etykieta bez marketingowych skrótów', ['Element', 'Co sprawdzić?', 'Typowy błąd'], [['Lista składników', 'Pierwsze pozycje i wyróżnione alergeny', 'Ocena po grafice z przodu'], ['Tabela odżywcza', 'Wartości na 100 g lub 100 ml', 'Porównanie różnych porcji'], ['Cukry', 'Łączna wartość oraz źródła w składzie', 'Szukanie tylko słowa „cukier”'], ['Dodatki', 'Funkcja i kontekst produktu', 'Traktowanie każdego E jako trucizny']]],
    faqs: [['Czy producent może podzielić cukier na kilka nazw?', 'W składzie podaje się odrębne użyte składniki; dlatego łączną ilość cukrów trzeba sprawdzić także w tabeli odżywczej.'], ['Czy pierwszy składnik jest go najwięcej?', 'Zasadniczo tak według masy w chwili użycia, z wyjątkami i szczegółami określonymi w rozporządzeniu.'], ['Czy E-numery są szkodliwe?', 'Sam numer E nie dowodzi szkodliwości; oznacza identyfikowany dodatek dopuszczony do określonych zastosowań.'], ['Lepiej porównywać porcję czy 100 g?', 'Najpierw 100 g lub 100 ml, a potem przeliczyć wynik na ilość, którą rzeczywiście zjesz.']],
    sources: [['EU Regulation 1169/2011 on food information', 'https://eur-lex.europa.eu/eli/reg/2011/1169/oj'], ['European Commission Q&A on food information', 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:52018XC0608(01)'], ['EFSA - food additives', 'https://www.efsa.europa.eu/en/topics/topic/food-additives'], ['NIH controlled trial of ultra-processed diets', 'https://pubmed.ncbi.nlm.nih.gov/31105044/']]
  },
];

articles.push(
  {
    file: 'pilates-po-50-nie-dla-kobiet.html',
    title: 'Pilates po 50-tce: siła, równowaga i bezpieczny start',
    h1: 'Pilates po 50-tce: jak zacząć i bezpiecznie zwiększać trudność?',
    description: 'Pilates po 50-tce może poprawiać równowagę, siłę i mobilność, ale nie zastępuje całego planu ruchu. Zobacz ćwiczenia startowe, progresję i przeciwwskazania.',
    quick: 'Pilates nie jest treningiem „dla kobiet”, lecz metodą ćwiczeń opartą na kontroli ruchu, oddechu i stabilizacji. Przeglądy u osób starszych wskazują poprawę równowagi, siły i sprawności, ale pewność dowodów bywa niska lub umiarkowana. Zacznij od 2 sesji tygodniowo po 20-30 minut i wybierz warianty, które nie wywołują ostrego bólu ani zawrotów głowy.',
    takeaways: ['Płeć nie jest przeciwwskazaniem do Pilatesu ani wyznacznikiem skuteczności ćwiczeń.', 'Metaanaliza z 2024 roku wspiera poprawę równowagi, lecz nie potwierdziła zmniejszenia liczby upadków.', 'Pilates może uzupełniać, ale nie zastępuje ćwiczeń aerobowych, siłowych i równoważnych zalecanych przez WHO.', 'Przy osteoporozie, świeżym urazie albo nasilonych objawach warianty powinien dobrać fizjoterapeuta.'],
    sections: [
      ['Co Pilates może poprawić po 50-tce?', 'Badania u osób starszych wskazują możliwą poprawę równowagi, siły, elastyczności i funkcji, lecz wyniki zależą od programu i jakości badań. Najnowsza metaanaliza oceniła pewność dowodów jako bardzo niską do umiarkowanej i nie wykazała przewagi w liczbie upadków ani lęku przed upadkiem.', 'Dlatego Pilates warto łączyć z <a href="centrum-treningu-silowego-po-50.html">pełnym planem treningu siłowego</a>, a nie traktować jako jedyny rodzaj ruchu.'],
      ['Jak wygląda pierwsza sesja Pilatesu?', 'Zacznij od spokojnego oddechu, ustawienia żeber i miednicy, ślizgów pięt, naprzemiennego unoszenia stóp oraz mostu w bezbolesnym zakresie. Wybierz 4-5 ćwiczeń, wykonaj po 6-10 kontrolowanych powtórzeń i odpoczywaj, gdy tracisz rytm oddechu. Trudność wynika z kontroli, nie z teatralnego napięcia brzucha.', 'Jeśli wstawanie z podłogi jest problemem, rozpocznij na stabilnym krześle według <a href="trening-maszynowy-po-50.html">zasad bezpiecznej progresji</a>.'],
      ['Jak progresować bez przeciążania kręgosłupa?', 'Najpierw wydłuż dźwignię lub dodaj pojedyncze powtórzenia, zachowując neutralną kontrolę i swobodny oddech. Nie zwiększaj równocześnie zakresu, tempa i oporu. Przy osteoporozie nie kopiuj bez oceny głębokich zgięć i rotacji tułowia, szczególnie jeśli masz złamania kręgów w wywiadzie.', 'Ocena bólu i powrotu do obciążeń jest częścią <a href="powrot-do-formy-po-50-kompletny-przewodnik.html">przewodnika powrotu do formy</a>.'],
      ['Czy Pilates wystarczy dla zdrowia po 50-tce?', 'Nie musi. WHO zaleca dorosłym także aktywność aerobową oraz wzmacnianie głównych grup mięśni co najmniej dwa dni tygodniowo; starszym osobom z gorszą mobilnością potrzebny jest również ruch wieloskładnikowy z równowagą. Pilates może wypełniać część tych elementów, ale program zależy od realnej intensywności.', 'Dodatkową sesję marszu możesz zbudować z <a href="nordic-walking-jak-zaczac-technika-kije-zdrowie.html">przewodnikiem nordic walking</a>.']
    ],
    callouts: ['Instrukcja „wciągnij brzuch przez całą sesję” nie jest celem samym w sobie; oddychaj i utrzymuj napięcie adekwatne do ruchu.', 'Ból promieniujący, nowe drętwienie, utrata siły albo zaburzenia zwieraczy wymagają przerwania ćwiczeń i pilnej oceny.'],
    quote: 'Pilates nie ma płci; ma za to konkretne zadanie ruchowe, dawkę i poziom trudności.',
    table: ['Start Pilatesu po 50-tce', ['Element', 'Dawka początkowa', 'Kiedy uprościć?'], [['Częstotliwość', '2 razy w tygodniu', 'Przy bólu lub słabej regeneracji'], ['Ćwiczenia', '4-5 kontrolowanych ruchów', 'Gdy zanika swobodny oddech'], ['Powtórzenia', '6-10 bez pośpiechu', 'Przy utracie techniki'], ['Progresja', 'Jeden parametr naraz', 'Po nasileniu objawów']]],
    faqs: [['Czy Pilates jest tylko dla kobiet?', 'Nie. Metoda ćwiczeń nie jest przypisana do płci; dobór wariantu zależy od funkcji, celu i zdrowia.'], ['Czy Pilates zmniejsza liczbę upadków?', 'Nowsza metaanaliza potwierdziła poprawę równowagi, lecz nie wykazała zmniejszenia liczby upadków ani lęku przed nimi.'], ['Ile razy w tygodniu ćwiczyć?', 'Dwie sesje po 20-30 minut to rozsądny start, który trzeba uzupełnić innymi rodzajami aktywności.'], ['Czy można ćwiczyć Pilates przy osteoporozie?', 'Często można, ale warianty z głębokim zgięciem lub rotacją wymagają indywidualnej oceny, zwłaszcza po złamaniach.']],
    sources: [['Pilates and balance in older adults - 2024 meta-analysis', 'https://pubmed.ncbi.nlm.nih.gov/39068875/'], ['Pilates and physical performance - meta-analysis', 'https://pubmed.ncbi.nlm.nih.gov/34332493/'], ['Pilates balance and falls - systematic review', 'https://pubmed.ncbi.nlm.nih.gov/25511371/'], ['WHO guidelines on physical activity', 'https://www.who.int/publications/i/item/9789240015128']]
  },
  {
    file: 'markery-krwi-co-naprawde-mowia-o-twoim-zdrowiu.html',
    title: 'Markery krwi po 50-tce: wynik, trend i ograniczenia',
    h1: 'Markery krwi po 50-tce: co wynik naprawdę mówi o zdrowiu?',
    description: 'Markery krwi po 50-tce pomagają oceniać konkretne ryzyko, ale wynik nie jest diagnozą. Zobacz trend, zakres laboratorium i badania dobierane do wskazań.',
    quick: 'Marker krwi odpowiada na określone pytanie, a nie mierzy całego zdrowia. Wynik zależy od metody, pory, leków, chorób i warunków pobrania. Porównuj trend w tym samym laboratorium, jeśli to możliwe, oraz pytaj, czy odchylenie zmieni postępowanie. Nagły bardzo nieprawidłowy wynik lub objawy alarmowe wymagają oceny, lecz pojedyncza gwiazdka poza zakresem nie stanowi samodzielnej diagnozy.',
    takeaways: ['Zakres referencyjny opisuje rozkład wyników w określonej populacji i metodzie, a nie granicę pełnego zdrowia.', 'Wartość predykcyjna wyniku zależy od prawdopodobieństwa choroby przed badaniem.', 'Trend jest użyteczny tylko przy porównywalnych metodach i podobnych warunkach pobrania.', 'Szerokie panele bez wskazań zwiększają szansę przypadkowych odchyleń i kolejnych zbędnych testów.'],
    sections: [
      ['Czy wynik poza normą oznacza chorobę?', 'Nie zawsze. Zakres referencyjny jest zwykle wyznaczany statystycznie dla określonej populacji i metody, dlatego część zdrowych osób może znaleźć się poza nim. Znaczenie odchylenia zależy od skali, objawów, innych wyników, leków i celu badania; wartości krytyczne są osobną kategorią wymagającą pilnej reakcji.', 'Harmonogram kontroli porządkuje <a href="badania-krwi-po-50-jak-czesto.html">przewodnik badań krwi po 50-tce</a>.'],
      ['Dlaczego trend bywa ważniejszy niż jedna liczba?', 'Powtarzające się oznaczenia mogą pokazać kierunek zmiany, lecz tylko wtedy, gdy porównujesz tę samą analizę i uwzględniasz warunki. Nawodnienie, infekcja, intensywny trening, pora dnia i zmiana laboratorium mogą przesunąć wynik. Trend nie oznacza automatycznie przyczyny; pomaga zdecydować, czy potrzebne jest potwierdzenie.', 'Przykład markera używanego w ocenie ryzyka znajdziesz w <a href="apob-norma-cena-jak-czytac-wynik.html">poradniku ApoB</a>.'],
      ['Które markery odpowiadają na konkretne pytania?', 'HbA1c odzwierciedla średnią glikemię z poprzednich tygodni, ale mogą go zaburzać niektóre choroby krwi. Kreatynina wspiera szacowanie filtracji nerek, lecz zależy między innymi od mięśni. TSH pomaga oceniać oś tarczycową, lecz nie wyjaśnia każdego zmęczenia. CRP jest nieswoistym markerem zapalenia.', 'Zamiast kolekcjonować liczby, połącz pytanie kliniczne z <a href="badania-po-50.html">planem badań profilaktycznych</a>.'],
      ['Kiedy wynik wymaga szybkiego działania?', 'Laboratorium może oznaczyć wartość krytyczną i skontaktować się z pacjentem lub lekarzem; takiego komunikatu nie wolno odkładać. Pilność zależy też od objawów, na przykład bólu w klatce, duszności, splątania, krwawienia lub ciężkiego osłabienia. Internetowa interpretacja bez jednostek i zakresu nie zastępuje tej oceny.', 'Ryzyko sercowo-naczyniowe wymaga kilku danych, co wyjaśnia <a href="centrum-cholesterolu-po-50.html">Centrum Cholesterolu</a>.']
    ],
    callouts: ['Zapisuj jednostkę, zakres laboratorium, datę, godzinę oraz leki. Sama liczba skopiowana do wyszukiwarki traci kontekst.', 'Jeżeli laboratorium przekazało wynik krytyczny, zastosuj jego instrukcję kontaktu zamiast czekać na kolejny planowy termin.'],
    quote: 'Marker jest narzędziem do odpowiedzi na pytanie; bez pytania łatwo zamienić pomiar w źródło przypadkowych alarmów.',
    table: ['Jak interpretować marker krwi?', ['Warstwa', 'Pytanie', 'Przykład'], [['Cel badania', 'Co ma wykryć lub monitorować?', 'Ryzyko, choroba albo lek'], ['Warunki', 'Co mogło zmienić wynik?', 'Pora, wysiłek, infekcja'], ['Porównanie', 'Czy metoda i jednostka są zgodne?', 'To samo laboratorium'], ['Decyzja', 'Czy wynik zmienia postępowanie?', 'Powtórka, konsultacja lub leczenie']]],
    faqs: [['Czy wynik poza zakresem oznacza chorobę?', 'Nie zawsze. Znaczenie zależy od wielkości odchylenia, objawów, metody, leków i innych wyników.'], ['Czy warto badać wszystkie markery co rok?', 'Nie. Badania powinny odpowiadać ryzyku, objawom, chorobom lub monitorowaniu leczenia.'], ['Czy można porównywać wyniki z różnych laboratoriów?', 'Można ostrożnie, ale metody, jednostki i zakresy mogą się różnić; trend jest wiarygodniejszy w podobnych warunkach.'], ['Co oznacza wynik krytyczny?', 'To wartość wymagająca szybkiego przekazania i działania zgodnie z instrukcją laboratorium lub lekarza.']],
    sources: [['USPSTF - screening for prediabetes and diabetes', 'https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/screening-for-prediabetes-and-type-2-diabetes'], ['KDIGO guideline for chronic kidney disease evaluation', 'https://kdigo.org/guidelines/ckd-evaluation-and-management/'], ['Laboratory reference intervals - review', 'https://pubmed.ncbi.nlm.nih.gov/29125987/'], ['USPSTF - thyroid dysfunction screening', 'https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/thyroid-dysfunction-screening']]
  },
  {
    file: 'testosteron-po-50-naturalnie-bez-trt.html',
    title: 'Testosteron po 50-tce: objawy, 2 pomiary i TRT',
    h1: 'Testosteron po 50-tce: kiedy badać i kiedy rozważyć TRT?',
    description: 'Niski testosteron rozpoznaje się przy objawach i dwóch niskich porannych wynikach. Sprawdź rolę snu, masy ciała, leków oraz warunki i ryzyka terapii TRT.',
    quick: 'Spadek energii lub libido nie wystarcza do rozpoznania niedoboru testosteronu. Wytyczne wymagają zgodnych objawów oraz 2 jednoznacznie niskich stężeń; pierwsze oznaczenie całkowitego testosteronu wykonuje się rano na czczo i potwierdza drugim pomiarem. Sen, otyłość, ostra choroba i leki mogą wpływać na wynik, ale „naturalny booster” nie zastępuje diagnostyki ani leczenia przyczynowego.',
    takeaways: ['Rozpoznanie hipogonadyzmu wymaga objawów oraz co najmniej dwóch zgodnie niskich porannych pomiarów.', 'Wynik blisko dolnej granicy lub zaburzenia SHBG mogą wymagać prawidłowo oznaczonego albo obliczonego wolnego testosteronu.', 'Redukcja nadmiernej masy, leczenie bezdechu i przegląd leków mogą poprawić zdrowie, lecz nie gwarantują normalizacji testosteronu.', 'TRT ma wskazania, przeciwwskazania i plan monitorowania; nie jest automatyczną terapią „przeciw starzeniu”.'],
    sections: [
      ['Jak rozpoznaje się niedobór testosteronu?', 'Endocrine Society zaleca rozpoznanie tylko u mężczyzn z objawami zgodnymi z niedoborem oraz jednoznacznie i stale niskim stężeniem. Pierwszy test całkowitego testosteronu wykonuje się rano na czczo wiarygodną metodą, a niski wynik potwierdza w drugim porannym pomiarze. Jedna liczba po nieprzespanej nocy nie wystarcza.', 'Szerszy plan badań znajdziesz w <a href="badania-krwi-po-50-jak-czesto.html">przewodniku kontroli krwi po 50-tce</a>.'],
      ['Które objawy są ważne, a które nieswoiste?', 'Spadek libido, mniej spontanicznych erekcji i wybrane zaburzenia seksualne są bardziej ukierunkowane niż samo zmęczenie. Gorszy nastrój, sen, siła i koncentracja mają wiele możliwych przyczyn. Lekarz ocenia także płodność, jądra, przysadkę, leki opioidowe lub steroidowe oraz choroby przewlekłe.', 'Jeśli dominują chrapanie i senność, sprawdź najpierw <a href="sen-po-50.html">objawy zaburzeń snu po 50-tce</a>.'],
      ['Co można poprawić bez TRT?', 'Regularny trening oporowy, leczenie otyłości, odpowiednia ilość snu i ograniczenie nadmiaru alkoholu wspierają ogólne zdrowie oraz funkcje seksualne. Nie można jednak obiecać określonego wzrostu testosteronu każdemu. Suplementy reklamowane jako boostery często nie mają dowodów na leczenie potwierdzonego hipogonadyzmu i mogą zawierać nieujawnione składniki.', 'Bezpieczny plan siłowy opisuje <a href="centrum-treningu-silowego-po-50.html">Centrum Treningu Siłowego</a>.'],
      ['Kiedy TRT może być właściwe i czego wymaga?', 'TRT rozważa się przy potwierdzonym objawowym niedoborze po ustaleniu przyczyny, korzyści, ryzyka i preferencji pacjenta. Wytyczne wymieniają przeciwwskazania, między innymi planowaną płodność, podwyższony hematokryt i niektóre choroby. Leczenie wymaga monitorowania objawów, testosteronu, hematokrytu i ryzyka prostaty.', 'Nie kupuj testosteronu poza opieką medyczną ani nie koryguj dawki według samopoczucia. Profilaktykę porządkują <a href="badania-po-50.html">badania po 50-tce</a>.']
    ],
    callouts: ['Wynik testosteronu powinien zawierać godzinę pobrania i zakres laboratorium; niski wynik potwierdza się drugiego poranka.', 'TRT może hamować produkcję plemników. Planowana płodność musi być omówiona przed rozpoczęciem leczenia.'],
    quote: 'Najpierw objawy, dwa wiarygodne pomiary i przyczyna; dopiero potem rozmowa o terapii.',
    table: ['Droga od objawu do decyzji o TRT', ['Etap', 'Co zrobić?', 'Czego nie robić?'], [['Objawy', 'Ocenić ich charakter i inne przyczyny', 'Rozpoznawać po zmęczeniu'], ['Pierwszy wynik', 'Rano, na czczo, wiarygodną metodą', 'Badać przypadkowo po południu'], ['Potwierdzenie', 'Drugi poranny pomiar', 'Leczyć po jednej liczbie'], ['TRT', 'Ocena przeciwwskazań i monitoring', 'Kupować bez kontroli']]],
    faqs: [['Ile razy trzeba zbadać testosteron?', 'Co najmniej dwa poranne pomiary przy zgodnych objawach są podstawą potwierdzenia stale niskiego stężenia.'], ['Czy niski wynik po nieprzespanej nocy wystarczy?', 'Nie. Sen i ostra choroba mogą wpływać na wynik, dlatego potrzebne są porównywalne warunki i potwierdzenie.'], ['Czy trening podniesie testosteron do normy?', 'Może poprawić sprawność i zdrowie, ale nie gwarantuje leczenia hipogonadyzmu ani określonego wzrostu wyniku.'], ['Czy TRT jest bezpieczne dla każdego?', 'Nie. Ma przeciwwskazania i wymaga monitorowania testosteronu, hematokrytu, objawów oraz ryzyka prostaty.']],
    sources: [['Endocrine Society testosterone guideline', 'https://pubmed.ncbi.nlm.nih.gov/29562364/'], ['Endocrine Society guideline resources', 'https://www.endocrine.org/clinical-practice-guidelines/testosterone-therapy'], ['AUA testosterone deficiency guideline', 'https://www.auanet.org/guidelines-and-quality/guidelines/testosterone-deficiency-guideline'], ['TRAVERSE cardiovascular safety trial', 'https://pubmed.ncbi.nlm.nih.gov/37326322/']]
  },
  {
    file: 'zastrzyk-cofajacy-starzenie-komorek-er-100-zycie-biosciences.html',
    title: 'ER-100: faza 1 terapii oka, bez wyników skuteczności',
    h1: 'ER-100: co naprawdę bada pierwsza faza terapii genowej oka?',
    description: 'ER-100 to eksperymentalna terapia epigenetyczna podawana do jednego oka w badaniu fazy 1 do 18 osób. Nie ma wyników skuteczności ani terapii całego ciała.',
    quick: 'ER-100 nie jest dostępnym „zastrzykiem odmładzającym”. To eksperymentalna terapia AAV podawana do jednego oka w pierwszym badaniu na ludziach. Rejestr ClinicalTrials.gov podaje fazę 1, maksymalnie 18 uczestników z jaskrą otwartego kąta lub NAION i obserwację bezpieczeństwa do 5 lat. Na 23 sierpnia 2026 roku nie opublikowano wyników skuteczności tego badania.',
    takeaways: ['Badanie NCT07290244 jest rekrutującym badaniem fazy 1, którego głównym celem jest bezpieczeństwo i tolerancja.', 'ER-100 podaje się doszklistkowo do jednego oka, a ekspresję konstruktu aktywuje doustna doksycyklina według protokołu.', 'Plan obejmuje do 18 osób: 12 z jaskrą otwartego kąta i 6 z NAION.', 'Brak opublikowanych wyników klinicznych oznacza, że nie wiadomo jeszcze, czy terapia poprawia widzenie u ludzi.'],
    sections: [
      ['Czym dokładnie jest ER-100?', 'ER-100 to badany kandydat terapii epigenetycznej wykorzystujący wektor AAV i regulowaną ekspresję czynników OSK. W badaniu podaje się pojedynczą dawkę doszklistkowo do jednego oka. Określenie „cofanie wieku komórek” pochodzi z hipotez i danych przedklinicznych; nie jest zatwierdzonym wskazaniem ani wynikiem leczenia człowieka.', 'Kontekst biologii starzenia omawia <a href="regeneracja-ukladu-nerwowego-co-mowi-nauka.html">artykuł o regeneracji układu nerwowego</a>.'],
      ['Kogo obejmuje badanie fazy 1?', 'Rejestr planuje do 18 dorosłych: 12 z jaskrą otwartego kąta i 6 z niearterytyczną przednią niedokrwienną neuropatią nerwu wzrokowego, czyli NAION. To nie jest badanie zdrowych osób ani terapia całego organizmu. Kwalifikacja obejmuje szczegółowe kryteria okulistyczne i medyczne.', 'Objawów oka nie należy porównywać z kryteriami badania na własną rękę; profilaktykę wzroku uwzględnia <a href="badania-po-50.html">przegląd badań po 50-tce</a>.'],
      ['Co mierzy badanie i kiedy poznamy odpowiedź?', 'Pierwszorzędowe cele dotyczą bezpieczeństwa, tolerancji i toksyczności ograniczającej dawkę. Protokół zawiera także eksploracyjne pomiary widzenia oraz obrazowania, ale nie zamienia ich w dowód skuteczności przed publikacją wyników. Pierwotne zakończenie oszacowano na maj 2027 roku, a pełne badanie na marzec 2032 roku.', 'Wynik komunikatu prasowego należy oddzielać od danych w rejestrze, podobnie jak przy innych <a href="kriokomory-i-komory-hiperbaryczne-bezpieczenstwo-po-50.html">technologiach reklamowanych przed mocnymi dowodami</a>.'],
      ['Czy ER-100 odmładza całe ciało?', 'Nie ma na to danych klinicznych. Droga podania, populacja i cele badania dotyczą oka oraz dwóch neuropatii nerwu wzrokowego. Firma bada dodatkowe zastosowania przedklinicznie, lecz nie oznacza to wykazanej skuteczności w mięśniach, mózgu, skórze ani długości życia człowieka. Taki wniosek wykraczałby poza dostępne wyniki.', 'Twierdzenia o długowieczności warto oceniać według <a href="healthspan-nie-lifespan-po-50.html">różnicy między healthspan i lifespan</a>.']
    ],
    callouts: ['Stan na 23.08.2026: rekrutacja trwa, a w ClinicalTrials.gov nie ma opublikowanych wyników badania.', 'Nie kupuj preparatów podszywających się pod ER-100; udział w badaniu odbywa się przez oficjalne ośrodki i kryteria protokołu.'],
    quote: 'Pierwsza dawka u człowieka rozpoczyna sprawdzanie bezpieczeństwa; nie kończy sprawdzania skuteczności.',
    table: ['ER-100 - fakty z rejestru badania', ['Element', 'Stan', 'Czego nie dowodzi?'], [['Faza', 'Faza 1', 'Skuteczności klinicznej'], ['Liczba uczestników', 'Do 18 osób', 'Działania w całej populacji'], ['Podanie', 'Jedno oko, iniekcja doszklistkowa', 'Odmładzania całego ciała'], ['Wyniki', 'Brak opublikowanych wyników', 'Poprawy widzenia lub długowieczności']]],
    faqs: [['Czy ER-100 jest już dostępny jako lek?', 'Nie. To eksperymentalna interwencja w badaniu fazy 1, a nie zatwierdzona terapia do sprzedaży.'], ['Ile osób obejmuje badanie ER-100?', 'Rejestr przewiduje maksymalnie 18 uczestników: 12 z jaskrą otwartego kąta i 6 z NAION.'], ['Czy są już wyniki skuteczności?', 'Nie. Na 23 sierpnia 2026 roku rejestr nie zawierał opublikowanych wyników tego badania.'], ['Czy ER-100 odmładza całe ciało?', 'Nie ma takich danych klinicznych. Badanie dotyczy pojedynczego oka i określonych neuropatii nerwu wzrokowego.']],
    sources: [['ClinicalTrials.gov NCT07290244', 'https://clinicaltrials.gov/study/NCT07290244'], ['Life Biosciences - ER-100 pipeline', 'https://www.lifebiosciences.com/pipeline/'], ['Partial reprogramming restores vision in mice', 'https://pubmed.ncbi.nlm.nih.gov/33268865/'], ['FDA - phases of clinical trials', 'https://www.fda.gov/patients/drug-development-process/step-3-clinical-research']]
  },
  {
    file: 'mit-jedzenie-cie-truje-owoce-wegle-tluszcz-sol.html',
    title: 'Czy jedzenie truje? Owoce, węgle, tłuszcz i sól',
    h1: 'MIT: czy owoce, węglowodany, tłuszcz i sól zawsze trują?',
    description: 'Owoce, węglowodany, tłuszcz i sól nie są jedną kategorią ryzyka. Sprawdź jakość produktów, porcję, zalecenie poniżej 5 g soli i wyjątki kliniczne.',
    quick: 'Nie da się uczciwie uznać całej grupy „owoce”, „węglowodany” albo „tłuszcz” za truciznę. Ryzyko zależy od produktu, dawki, wzorca diety i chorób. WHO zaleca dorosłym co najmniej 400 g warzyw i owoców oraz mniej niż 5 g soli dziennie. Sok nie działa jak cały owoc, a tłuszcze nasycone i nienasycone mają inne znaczenie.',
    takeaways: ['Całe owoce dostarczają błonnika i nie są metabolicznie równoważne sokom ani napojom słodzonym.', 'Węglowodany obejmują zarówno pełne ziarna i strączki, jak i rafinowane słodycze; nazwa makroskładnika nie opisuje jakości.', 'WHO zaleca mniej niż 2 g sodu, czyli mniej niż 5 g soli dziennie u dorosłych, z wyjątkami klinicznymi.', 'Rodzaj tłuszczu ma znaczenie: zastępowanie tłuszczów nasyconych nienasyconymi różni się od dodawania dowolnego tłuszczu.'],
    sections: [
      ['Czy cukier w owocach działa jak cukier w napoju?', 'Cały owoc zawiera wodę, strukturę komórkową i błonnik, dlatego tempo jedzenia oraz sytość różnią się od soku. WHO zalicza cukry w sokach do wolnych cukrów, natomiast cukrów naturalnie obecnych w nienaruszonych owocach i warzywach nie obejmuje ta sama definicja. Porcja i indywidualna glikemia nadal mają znaczenie.', 'Praktyczną strukturę posiłków opisuje <a href="dieta-po-50.html">dieta po 50-tce bez zakazów całych grup</a>.'],
      ['Czy wszystkie węglowodany są problemem?', 'Nie. Pełne ziarna, warzywa, owoce i strączki różnią się od napojów słodzonych oraz produktów z oczyszczonej mąki pod względem błonnika, gęstości energetycznej i sposobu jedzenia. Wytyczne WHO kładą nacisk na jakość źródła węglowodanów, nie na wyeliminowanie całego makroskładnika.', 'Jeśli śniadanie nie syci, sprawdź jego skład z <a href="sniadanie-bialkowo-tluszczowe-zachcianki-na-cukier.html">poradnikiem białka i zachcianek</a>.'],
      ['Czy tłuszcz jest zdrowy bez ograniczeń?', 'Nie. Tłuszcze nienasycone z oliwy, orzechów lub ryb mają inny profil niż duża podaż tłuszczów nasyconych i przemysłowych trans. Jednocześnie każdy tłuszcz jest energetyczny. W ocenie ryzyka liczy się zamiana: czym zastępujesz dany produkt, a nie samo dodanie składnika oznaczonego jako „zdrowy”.', 'Reakcję lipidów na skrajną zmianę podaży tłuszczu pokazuje <a href="dieta-keto-cholesterol-ldl-hdl-badania-naukowe.html">analiza keto, LDL i ApoB</a>.'],
      ['Ile soli jest rozsądną granicą?', 'WHO zaleca dorosłym mniej niż 2 g sodu dziennie, co odpowiada mniej niż 5 g soli. Duża część podaży pochodzi z pieczywa, wędlin, serów, gotowych dań i sosów, nie tylko z solniczki. Osoby z chorobami lub lekami wpływającymi na sód i wodę potrzebują zaleceń klinicznych.', 'Kontrolę ciśnienia i sodu omawia <a href="centrum-nadcisnienia-po-50.html">Centrum Nadciśnienia po 50-tce</a>.']
    ],
    callouts: ['Nie oceniaj produktu słowem „węglowodany”. Sprawdź źródło, błonnik, stopień przetworzenia, porcję i całe menu.', 'Pięć gramów soli to limit całodziennej podaży ze wszystkich produktów, a nie pięć gramów dosypanych w kuchni.'],
    quote: 'Dobra odpowiedź żywieniowa rzadko mieści się w słowie „truje”; wymaga produktu, dawki, zamiany i sytuacji zdrowotnej.',
    table: ['Cztery hasła, cztery różne oceny', ['Hasło', 'Co rozróżnić?', 'Praktyczna miara'], [['Owoce', 'Cały owoc a sok', 'Porcja i forma'], ['Węglowodany', 'Pełne ziarna a rafinowane produkty', 'Błonnik i skład'], ['Tłuszcz', 'Nienasycony a nasycony i trans', 'Rodzaj oraz zamiana'], ['Sól', 'Sód z całej diety', 'Mniej niż 5 g soli dziennie']]],
    faqs: [['Czy owoce trzeba ograniczyć przez fruktozę?', 'U większości osób całe owoce są elementem zdrowej diety; indywidualne ograniczenia zależą od choroby i porcji.'], ['Czy węglowodany powodują tycie?', 'Wzrost masy zależy od długotrwałej nadwyżki energii; źródło węglowodanów wpływa na sytość i jakość diety.'], ['Czy tłuszcz nasycony jest taki sam jak oliwa?', 'Nie. Mają inny skład kwasów tłuszczowych i wpływ na lipidy; znaczenie ma także produkt, którym dokonujesz zamiany.'], ['Ile soli dziennie zaleca WHO?', 'Mniej niż 5 g soli, czyli mniej niż 2 g sodu dziennie dla dorosłych, z wyjątkami wymagającymi opieki klinicznej.']],
    sources: [['WHO - healthy diet', 'https://www.who.int/health-topics/healthy-diet'], ['WHO - sodium reduction', 'https://www.who.int/news-room/fact-sheets/detail/sodium-reduction'], ['WHO guideline on carbohydrate intake', 'https://www.who.int/publications/i/item/9789240073593'], ['WHO guideline on saturated and trans fats', 'https://www.who.int/publications/i/item/9789240073630']]
  }
);

function esc(value) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderTable([caption, headers, rows]) {
  return `<div class="article-table-wrap"><table class="article-table"><caption>${caption}</caption><thead><tr>${headers.map((item) => `<th scope="col">${item}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((item, index) => index === 0 ? `<th scope="row">${item}</th>` : `<td>${item}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function renderBody(article, hub, share) {
  const sections = article.sections.map(([heading, first, second], index) => {
    const callout = index === 1 || index === 3 ? `<aside class="highlight-box highlight-box--accent"><h3>${index === 1 ? 'Jak to zastosować?' : 'Warunek bezpieczeństwa'}</h3><p>${article.callouts[index === 1 ? 0 : 1]}</p></aside>` : '';
    return `<h2>${heading}</h2><p${index === 0 ? ' class="drop-cap"' : ''}>${first}</p><p>${second}</p>${callout}`;
  }).join('');
  const faq = article.faqs.map(([q, a], index) => `<article class="faq-item" id="faq-${index + 1}"><h3>${q}</h3><p>${a}</p></article>`).join('');
  const sources = article.sources.map(([label, url]) => `<li><a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a></li>`).join('');
  const shareBlock = share || '<section class="share-article-section reveal" aria-labelledby="share-article-title"><h3 id="share-article-title">Udostępnij artykuł</h3><p class="share-article-section__lead">Wyślij ten materiał osobie, której przyda się dokładnie ta informacja.</p><div class="share-article-section__actions" role="group" aria-label="Opcje udostępniania"><a class="share-pill share-pill--facebook" href="#" data-share-network="facebook" rel="noopener noreferrer" target="_blank">Facebook</a><a class="share-pill share-pill--linkedin" href="#" data-share-network="linkedin" rel="noopener noreferrer" target="_blank">LinkedIn</a><a class="share-pill share-pill--whatsapp" href="#" data-share-network="whatsapp" rel="noopener noreferrer" target="_blank">WhatsApp</a><a class="share-pill share-pill--mail" href="#" data-share-network="mail">Mail</a><button class="share-pill share-pill--copy" type="button" data-share-network="copy">Kopiuj link</button></div><p class="share-article-section__status" id="share-status" role="status" aria-live="polite"></p></section>';
  return `<article class="article-content"><section class="quick-answer reveal" id="quick-answer" aria-label="Szybka odpowiedź"><h2>Szybka odpowiedź</h2><p>${article.quick}</p></section><section class="key-takeaways reveal" data-ai-summary="editorial" aria-label="Kluczowe wnioski"><h2>Kluczowe wnioski</h2><ul>${article.takeaways.map((item) => `<li>${item}</li>`).join('')}</ul></section>${sections}${renderTable(article.table)}<blockquote class="article-quote"><p>${article.quote}</p></blockquote><section class="faq-list reveal" aria-label="Najczęściej zadawane pytania"><h2>Najczęściej zadawane pytania</h2>${faq}</section>${hub || ''}${shareBlock}<h2 id="zrodla">Źródła</h2><ol class="sources-list">${sources}</ol><div class="medical-disclaimer"><p><strong>Uwaga:</strong> Artykuł ma charakter informacyjny i edukacyjny. Nie zastępuje konsultacji, diagnozy ani indywidualnego leczenia.</p></div></article>`;
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
      data.speakable = { '@type': 'SpeakableSpecification', cssSelector: ['.article-header__title', '#quick-answer', '#quick-answer p', '.key-takeaways h2', '.key-takeaways li'] };
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
    if (data['@type'] === 'ClaimReview' && article.file === 'mit-jedzenie-cie-truje-owoce-wegle-tluszcz-sol.html') {
      data.claimReviewed = 'Owoce, węglowodany, tłuszcz i sól zawsze trują po 50-tce.';
      data.dateModified = MODIFIED;
      if (data.reviewRating) data.reviewRating.alternateName = 'Fałsz - ryzyko zależy od produktu, dawki i stanu zdrowia';
    }
    return `<script type="application/ld+json">\n${JSON.stringify(data, null, 2)}\n</script>`;
  });
  if (!sawFaq) {
    const data = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: article.faqs.map(([name, answer]) => ({ '@type': 'Question', name, acceptedAnswer: { '@type': 'Answer', text: answer } })) };
    html = html.replace('</head>', `<script type="application/ld+json">\n${JSON.stringify(data, null, 2)}\n</script>\n</head>`);
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
  if (article.file === 'pilates-po-50-nie-dla-kobiet.html') {
    html = html.replace(/(<meta property="og:image" content="[^"]*\/assets\/)pilates-strong-man-hero\.webp(">)/, '$1pilates-strong-man-hero.jpg$2');
    html = html.replace(/(<meta name="twitter:image" content="[^"]*\/assets\/)pilates-strong-man-hero\.webp(">)/, '$1pilates-strong-man-hero.jpg$2');
    html = html.replace('<img src="./assets/pilates-strong-man-hero.webp"', '<img src="./assets/pilates-strong-man-hero.jpg"');
  }
  return html;
}

function addImageDimensions(html) {
  return html.replace(/<img\b([^>]*?)>/g, (whole, attrs) => {
    const match = attrs.match(/src="([^"]+)"/);
    if (!match) return whole;
    const source = match[1].replace(/^\.\//, '');
    const full = path.join(ROOT, source);
    if (!fs.existsSync(full)) return whole;
    const buffer = fs.readFileSync(full);
    let width;
    let height;
    if (buffer.toString('ascii', 0, 2) === '\xff\xd8') {
      let offset = 2;
      while (offset < buffer.length) {
        if (buffer[offset] !== 0xff) { offset += 1; continue; }
        const marker = buffer[offset + 1];
        const length = buffer.readUInt16BE(offset + 2);
        if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
          height = buffer.readUInt16BE(offset + 5); width = buffer.readUInt16BE(offset + 7); break;
        }
        offset += 2 + length;
      }
    } else if (buffer.toString('ascii', 1, 4) === 'PNG') {
      width = buffer.readUInt32BE(16); height = buffer.readUInt32BE(20);
    }
    if (!width || !height) return whole;
    const next = attrs.replace(/\s+width="\d+"/g, '').replace(/\s+height="\d+"/g, '').replace(/\s*\/?$/, '');
    return `<img${next} width="${width}" height="${height}">`;
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
  console.log(`[BATCH-6] repaired ${article.file}`);
}
