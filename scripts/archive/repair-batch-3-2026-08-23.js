#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const MODIFIED = '2026-08-23T19:36:00+02:00';

const articles = [
  {
    file: 'trening-silowy-starzenie-komorkowe-dna.html',
    title: 'Trening siłowy a DNA po 50-tce: fakty i granice',
    h1: 'Trening siłowy a DNA po 50-tce: telomery, epigenetyka i fakty',
    description: 'Trening siłowy po 50-tce poprawia siłę i sprawność. Sprawdź, co badania mówią o telomerach, metylacji DNA i chwycie, bez obietnic cofania wieku dziś.',
    quick: 'Najpewniejsze korzyści treningu siłowego po 50-tce dotyczą siły, funkcji i ochrony mięśni. Badania nad telomerami i metylacją DNA pokazują interesujące związki, lecz nie dowodzą, że dwie sesje tygodniowo cofają wiek biologiczny o konkretną liczbę lat. WHO zaleca wzmacnianie głównych grup mięśni co najmniej dwa razy w tygodniu.',
    takeaways: [
      'Długość telomerów i zegary metylacyjne są markerami badawczymi, a nie domowym licznikiem pozostałych lat życia.',
      'Związek między treningiem oporowym a dłuższymi telomerami nie oznacza automatycznie, że trening je wydłużył.',
      'Zmiany ekspresji genów po wysiłku są realne, ale nie są „przepisaniem DNA” ani resetem starzenia.',
      'Siła chwytu pomaga oceniać sprawność i ryzyko populacyjne, lecz nie zastępuje ciśnienia, badań i wywiadu.'
    ],
    sections: [
      ['Co naprawdę mierzą telomery i zegary epigenetyczne?', 'Telomery są fragmentami chroniącymi końce chromosomów, a ich długość różni się między tkankami i ludźmi. Zegary epigenetyczne wykorzystują wzory metylacji DNA do statystycznego szacowania wieku biologicznego. Oba narzędzia są przydatne w badaniach, ale pojedynczy wynik nie mówi, ile lat życia zostało konkretnej osobie.', 'Na pomiar wpływają metoda laboratoryjna, rodzaj komórek i zmienność biologiczna. Dlatego nie należy przeliczać różnicy markera na „cztery lata odmłodzenia”. Szersze ograniczenia takich testów opisuje artykuł o <a href="zegar-epigenetyczny-horvatha-wiek-biologiczny-metylacja-dna.html">zegarach epigenetycznych i metylacji DNA</a>.'],
      ['Czy 90 minut treningu odmładza komórki o cztery lata?', 'Badanie obserwacyjne może wykazać, że osoby deklarujące więcej treningu oporowego mają przeciętnie inny profil telomerów. Nie potwierdza jednak, że trening spowodował różnicę, ponieważ osoby aktywne mogą równocześnie lepiej spać, mniej palić, inaczej jeść i rzadziej chorować. To klasyczna granica wnioskowania z korelacji.', 'Aby udowodnić cofnięcie wieku biologicznego, potrzebne byłyby długie randomizowane badania z powtarzanymi pomiarami i wynikiem klinicznym. Obecnie uczciwy wniosek brzmi: ćwicz dla sprawności i zdrowia, a markery molekularne traktuj jako rozwijającą się naukę, nie obietnicę. Praktyczny plan znajdziesz w <a href="centrum-treningu-silowego-po-50.html">Centrum Treningu Siłowego</a>.'],
      ['Jak mięśnie wpływają na cały organizm?', 'Pracujące mięśnie uwalniają substancje sygnałowe nazywane miokinami i zmieniają wykorzystanie glukozy. To jeden z mechanizmów, przez które ruch oddziałuje poza samym mięśniem. Nie oznacza to jednak, że pojedyncza miokina zapobiega demencji albo że każde powtórzenie działa jak lek o ustalonej dawce.', 'Korzyści dla mózgu, metabolizmu i układu krążenia wynikają z wielu współdziałających mechanizmów oraz regularności. Warto oddzielać wyniki na zwierzętach i w komórkach od dowodów klinicznych u ludzi. O podstawowej dawce ruchu przeczytasz w <a href="trening-3x30-dla-50-plus.html">planie 3×30 po 50-tce</a>.'],
      ['Czy siła chwytu przewiduje długość życia?', 'Słabszy chwyt wiąże się w dużych badaniach z większym ryzykiem niesprawności i zgonu. Jest tani, szybki i użyteczny jako element oceny funkcjonalnej. To marker ogólnego stanu mięśni i zdrowia, a nie samodzielna przyczyna choroby ani wynik ważniejszy od wszystkich pozostałych.', 'Wzmocnienie chwytu może ułatwić codzienne czynności, ale nie ma podstaw, by obiecywać proporcjonalne wydłużenie życia. Interpretacja wymaga wieku, płci, rozmiaru ciała, techniki i urządzenia. Szczegóły znajdziesz w tekście <a href="sila-chwytu-po-50.html">o sile chwytu po 50-tce</a>.'],
      ['Jaka dawka treningu ma najlepsze oparcie w wytycznych?', 'WHO zaleca dorosłym wykonywanie ćwiczeń wzmacniających wszystkie główne grupy mięśni co najmniej dwa dni w tygodniu. Początkujący może zacząć od jednej lub dwóch serii kilku podstawowych ruchów, pozostawiając zapas powtórzeń i zwiększając obciążenie dopiero po opanowaniu techniki.', 'Nie trzeba trenować do upadku w każdej serii. Nowy ból w klatce, omdlenie, niewyjaśniona duszność lub gwałtowny spadek wydolności wymagają oceny medycznej. Zwykłe błędy progresji omawia poradnik <a href="bledy-50.html">o pięciu błędach treningowych po 50-tce</a>.']
    ],
    table: ['Co wiemy, a czego nie wolno obiecywać', ['Obszar', 'Najmocniejszy wniosek', 'Granica dowodu'], [
      ['Siła i funkcja', 'Trening oporowy zwiększa siłę i wspiera sprawność', 'Efekt zależy od programu i regularności'],
      ['Telomery', 'Aktywność bywa związana z korzystniejszym profilem', 'Korelacja nie dowodzi odmłodzenia komórek'],
      ['Metylacja DNA', 'Wysiłek może zmieniać wzory regulacji genów', 'Nie jest to reset wieku biologicznego'],
      ['Siła chwytu', 'Użyteczny marker funkcjonalny i prognostyczny', 'Nie zastępuje pełnej oceny zdrowia']
    ]],
    faqs: [
      ['Czy trening siłowy wydłuża telomery?', 'Badania pokazują związki między aktywnością a markerami telomerów, ale nie pozwalają obiecać, że konkretny plan wydłuży telomery konkretnej osoby.'],
      ['Czy ćwiczenia cofają wiek biologiczny?', 'Ruch poprawia zdrowie i funkcję, lecz zmiana laboratoryjnego zegara nie jest równoznaczna z cofnięciem wieku ani gwarancją dłuższego życia.'],
      ['Ile razy w tygodniu ćwiczyć siłowo?', 'WHO zaleca wzmacnianie głównych grup mięśni co najmniej dwa dni w tygodniu. Początkujący powinien zwiększać dawkę stopniowo.'],
      ['Czy siła chwytu zastępuje inne badania?', 'Nie. Jest użytecznym elementem oceny sprawności, ale nie zastępuje wywiadu, ciśnienia, badań laboratoryjnych ani diagnostyki objawów.']
    ],
    sources: [
      ['WHO — Guidelines on physical activity and sedentary behaviour', 'https://www.who.int/publications/i/item/9789240015128'],
      ['Resistance training prescription — systematic review and network meta-analysis', 'https://pubmed.ncbi.nlm.nih.gov/37414459/'],
      ['Resistance training and telomere length — analysis and limitations', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11591842/'],
      ['Grip strength and health outcomes — PURE study', 'https://pubmed.ncbi.nlm.nih.gov/25982160/']
    ]
  },
  {
    file: 'mobilnosc-vs-rozciaganie-program-dla-stawow-po-piecdziesiatce.html',
    title: 'Mobilność czy rozciąganie po 50-tce? Plan dla stawów',
    h1: 'Mobilność a rozciąganie po 50-tce: czym się różnią i jak ćwiczyć?',
    description: 'Mobilność i rozciąganie po 50-tce służą różnym celom. Poznaj różnice, dowody o treningu siłowym i prosty plan dla bioder, barków oraz kostek w domu.',
    quick: 'Rozciąganie zwiększa tolerancję i zakres w określonej pozycji, a mobilność oznacza zdolność aktywnego kontrolowania ruchu. Przeglądy badań pokazują, że trening siłowy wykonywany w odpowiednim zakresie także może zwiększać zakres ruchu. Najpraktyczniejszy program po 50-tce łączy krótką pracę nad ograniczonym ruchem z ćwiczeniem siły w odzyskanym zakresie.',
    takeaways: [
      'Nie trzeba rozciągać każdego stawu; ćwiczenie powinno odpowiadać rzeczywistemu ograniczeniu i celowi.',
      'Rozciąganie statyczne może zwiększać zakres, ale samo nie uczy kontroli tego zakresu pod obciążeniem.',
      'Trening siłowy w pełnym, tolerowanym zakresie poprawia siłę i może zwiększać ruchomość podobnie do rozciągania.',
      'Ból, obrzęk, blokowanie stawu albo świeży uraz wymagają oceny, a nie agresywnego „rozbijania” napięcia.'
    ],
    sections: [
      ['Czym różni się mobilność od elastyczności?', 'Elastyczność opisuje bierny zakres, do którego tkanki można doprowadzić, natomiast mobilność wymaga aktywnego ruchu i kontroli. Można więc bez trudu unieść nogę rękami, a jednocześnie nie potrafić utrzymać jej wysoko własnymi mięśniami. To nie są dwa konkurencyjne treningi, tylko różne cechy.', 'Najpierw określ czynność, która sprawia trudność: przysiad, sięganie nad głowę czy schodzenie po schodach. Następnie sprawdź, czy ogranicza ją zakres, siła, równowaga, ból czy technika. Praktyczny punkt startu daje <a href="powrot-do-formy-po-50-kompletny-przewodnik.html">plan powrotu do formy po 50-tce</a>.'],
      ['Czy rozciąganie jest konieczne przed każdym treningiem?', 'Nie ma obowiązku wykonywania długiego rozciągania statycznego przed każdą sesją. Rozgrzewka powinna przygotować do planowanych ruchów: kilka minut łatwej aktywności, stopniowo większy zakres oraz lekkie serie ćwiczenia. Krótkie rozciąganie nie przekreśla treningu, ale nie zastępuje takiego przygotowania.', 'Dłuższe utrzymywanie pozycji można wykonać po treningu albo osobno, jeśli konkretny zakres jest celem. Przed zadaniem wymagającym maksymalnej siły lepiej nie kończyć rozgrzewki długim, intensywnym rozciąganiem tej samej grupy mięśni. Zasady startu opisuje <a href="dlaczego-bieznia-to-za-malo.html">poradnik o ruchu aerobowym i sile</a>.'],
      ['Czy trening siłowy może poprawić zakres ruchu?', 'Metaanalizy badań z obciążeniem zewnętrznym wykazały poprawę zakresu ruchu po treningu siłowym oraz brak istotnej różnicy względem samego rozciągania. Nie oznacza to, że każdy półprzysiad automatycznie poprawi mobilność. Liczy się ćwiczenie w możliwie pełnym, kontrolowanym i tolerowanym zakresie.', 'Przykładem jest powolny przysiad do bezpiecznej głębokości albo wspięcie i opuszczenie pięty przy podparciu. Zakres można powiększać bez wymuszania bólu, a obciążenie dodawać dopiero przy dobrej kontroli. Program bazowy znajdziesz w <a href="centrum-treningu-silowego-po-50.html">Centrum Treningu Siłowego</a>.'],
      ['Jak ułożyć krótki program dla bioder, barków i kostek?', 'Wybierz po jednym ruchu dla obszaru, który realnie ogranicza codzienność. Dla kostki może to być przesuwanie kolana nad stopą przy pięcie na podłożu, dla biodra kontrolowany wykrok z podparciem, a dla barku unoszenie rąk przy ścianie. Wykonaj dwie spokojne serie bez ostrego bólu.', 'Po ruchu mobilizującym dodaj ćwiczenie siłowe w nowym zakresie, na przykład wspięcia na palce, wstawanie z krzesła lub lekkie wyciskanie. Dwa–trzy krótkie treningi tygodniowo pozwalają ocenić trend bez codziennego testowania granic. Całość można połączyć z <a href="trening-3x30-dla-50-plus.html">planem 3×30</a>.'],
      ['Kiedy sztywność wymaga diagnostyki?', 'Nagły obrzęk, zaczerwienienie, gorący staw, uraz, blokowanie, narastająca słabość albo ból nocny nie są wskazaniem do mocniejszego rozciągania. Podobnie ból promieniujący z drętwieniem lub zaburzeniem zwieraczy wymaga pilnej oceny medycznej.', 'Przy przewlekłym ograniczeniu fizjoterapeuta może odróżnić problem stawu, tkanek, nerwu i kontroli ruchu. W chorobie zwyrodnieniowej ruch zwykle pozostaje częścią leczenia, ale dawka musi uwzględniać zaostrzenia. Kontekst daje artykuł <a href="bieganie-niszczy-kolana.html">o ruchu i zdrowiu kolan</a>.']
    ],
    table: ['Które narzędzie pasuje do celu?', ['Cel', 'Najbardziej bezpośrednie narzędzie', 'Przykład'], [
      ['Zwiększyć bierny zakres', 'Rozciąganie określonej grupy', 'Spokojna pozycja 20–30 sekund'],
      ['Kontrolować nowy zakres', 'Aktywna mobilność', 'Powolny ruch bez pomocy ręki'],
      ['Użyć zakresu pod obciążeniem', 'Trening siłowy', 'Przysiad do kontrolowanej głębokości'],
      ['Przygotować się do sesji', 'Dynamiczna rozgrzewka', 'Lekkie wersje planowanych ruchów']
    ]],
    faqs: [
      ['Czy mobilność i rozciąganie to to samo?', 'Nie. Rozciąganie jest metodą wpływania na zakres, a mobilność obejmuje aktywny zakres i kontrolę ruchu.'],
      ['Czy po 50-tce trzeba rozciągać się codziennie?', 'Nie ma takiej konieczności. Częstotliwość zależy od celu, a krótkie regularne sesje powinny dotyczyć rzeczywistego ograniczenia.'],
      ['Czy trening siłowy usztywnia?', 'Prawidłowo prowadzony trening w pełnym tolerowanym zakresie może zwiększać zakres ruchu, a nie go zmniejszać.'],
      ['Czy ćwiczyć przez ból?', 'Łagodny dyskomfort rozciągania może być akceptowalny, ale ostry ból, obrzęk, blokowanie lub nasilające się objawy wymagają przerwania i oceny.']
    ],
    sources: [
      ['Alizadeh i wsp. — resistance training and range of motion, meta-analysis', 'https://pubmed.ncbi.nlm.nih.gov/36622555/'],
      ['Afonso i wsp. — strength training versus stretching for range of motion', 'https://pubmed.ncbi.nlm.nih.gov/33917036/'],
      ['WHO — Guidelines on physical activity and sedentary behaviour', 'https://www.who.int/publications/i/item/9789240015128'],
      ['WHO — Step safely: strategies for preventing and managing falls', 'https://www.who.int/publications/i/item/9789240064096']
    ]
  },
  {
    file: 'dieta-po-50.html',
    title: 'Dieta po 50-tce: zasady, które da się utrzymać',
    h1: 'Dieta po 50-tce: jak jeść dla mięśni, serca oraz sytości?',
    description: 'Dieta po 50-tce bez cudownego jadłospisu: białko, warzywa, błonnik i energia dopasowane do celu. Zobacz talerz, porcje i sygnały do konsultacji dziś.',
    quick: 'Dobra dieta po 50-tce nie ma jednej nazwy. Powinna pokrywać zapotrzebowanie na energię i składniki, dostarczać warzyw, owoców, produktów z błonnikiem oraz źródła białka w głównych posiłkach. WHO wskazuje co najmniej 400 g warzyw i owoców oraz 25 g naturalnie występującego błonnika dziennie dla dorosłych, jeśli stan zdrowia na to pozwala.',
    takeaways: [
      'Wiek nie wyłącza metabolizmu; zmianę masy nadal determinuje bilans energii, choć potrzeby i aktywność mogą się zmieniać.',
      'Regularne źródła białka wspierają mięśnie, zwłaszcza razem z treningiem oporowym.',
      'Warzywa, owoce, strączki i pełne ziarna pomagają osiągnąć błonnik oraz zwiększyć sytość.',
      'Choroba nerek, niezamierzony spadek masy i problemy z połykaniem wymagają indywidualnego planu.'
    ],
    sections: [
      ['Czy po 50-tce metabolizm nagle zwalnia?', 'Nie ma jednego dnia, w którym organizm przestaje prawidłowo zużywać energię. Z wiekiem może spadać spontaniczna aktywność i masa mięśniowa, a choroby, sen oraz leki mogą zmieniać apetyt. To może obniżać zapotrzebowanie, ale nie uzasadnia głodówki ani eliminowania całych grup produktów.', 'Przez dwa tygodnie obserwuj masę, obwód pasa, głód i zwykłą aktywność zamiast liczyć „wiek metaboliczny” z wagi. Jeśli cel to redukcja, zmniejsz porcje produktów o dużej gęstości energetycznej i zachowaj białko oraz warzywa. Mechanizm omawia <a href="centrum-metabolizmu-po-50.html">Centrum Metabolizmu</a>.'],
      ['Ile białka potrzebuje osoba po 50-tce?', 'Stanowisko grupy ekspertów ESPEN proponuje zdrowym starszym osobom zwykle 1,0–1,2 g białka na kilogram masy ciała dziennie, a w chorobie często więcej po indywidualnej ocenie. Nie jest to automatyczna recepta dla każdego pięćdziesięciolatka ani osób z chorobą nerek.', 'Najpierw policz białko ze zwykłych posiłków. Jaja, nabiał, ryby, mięso, tofu i strączki pozwalają rozłożyć je w ciągu dnia. Odżywka jest wygodnym jedzeniem, nie obowiązkiem. Obliczenia i ograniczenia opisuje <a href="kalkulator-bialka-po-50.html">kalkulator białka po 50-tce</a>.'],
      ['Jak zbudować sycący talerz bez ważenia wszystkiego?', 'Zacznij od warzyw lub owoców, dodaj wyraźne źródło białka, produkt skrobiowy dopasowany do aktywności i niewielką porcję tłuszczu. Taki schemat nie narzuca konkretnych produktów i pozwala zachować kuchnię, którą lubisz. Wielkość porcji koryguj według trendu masy i głodu.', 'WHO zaleca różnorodność i ograniczanie wolnych cukrów, soli oraz tłuszczów trans. Mrożonki i konserwowe strączki mogą być rozsądnym skrótem, jeśli sprawdzisz sól i dodatki. Praktykę czytania składu pokazuje <a href="jak-czytac-etykiety-sklad-produktow-e-numery-inci.html">przewodnik po etykietach</a>.'],
      ['Czy trzeba rezygnować z pieczywa, ziemniaków i kolacji?', 'Nie. Redukcja masy nie wymaga wykluczenia pieczywa ani ziemniaków, a godzina kolacji sama nie rozstrzyga o wyniku. Liczą się całkowita energia, jakość diety, sytość i możliwość utrzymania planu. Produkt może pasować lub nie w zależności od porcji i całego dnia.', 'Jeżeli wieczorem występuje niekontrolowane podjadanie, sprawdź, czy wcześniejsze posiłki zawierały białko, błonnik i wystarczającą energię. Przy refluksie późna duża kolacja może nasilać objawy, więc porę dobiera się także do zdrowia, nie do internetowej zasady.'],
      ['Kiedy plan żywienia powinien prowadzić specjalista?', 'Niezamierzony spadek masy, trudności z gryzieniem lub połykaniem, uporczywa biegunka, krew w stolcu i objawy niedożywienia wymagają diagnostyki. Indywidualnego prowadzenia potrzebują również osoby z przewlekłą chorobą nerek, cukrzycą leczoną lekami powodującymi niedocukrzenie i po operacjach przewodu pokarmowego.', 'Suplement nie naprawi nierozpoznanej przyczyny utraty apetytu. W razie choroby plan energii, białka, płynów i potasu może różnić się od zaleceń dla zdrowej osoby. O rozsądnym wyborze preparatów przeczytasz w <a href="suplementacja-po-50.html">poradniku suplementacji po 50-tce</a>.']
    ],
    table: ['Talerz po 50-tce — element, rola i przykłady', ['Element', 'Po co?', 'Przykłady'], [
      ['Źródło białka', 'Mięśnie i sytość', 'Ryba, jaja, skyr, tofu, strączki'],
      ['Warzywa lub owoce', 'Błonnik i mikroskładniki', 'Świeże, mrożone albo bez sosu'],
      ['Produkt skrobiowy', 'Energia do ruchu', 'Kasza, ziemniaki, płatki, pieczywo'],
      ['Tłuszcz', 'Smak i kwasy tłuszczowe', 'Oliwa, orzechy, nasiona']
    ]],
    faqs: [
      ['Czy po 50-tce trzeba jeść inaczej?', 'Warto zwrócić większą uwagę na białko, jakość produktów i energię, ale nie istnieje jedna obowiązkowa dieta dla wszystkich.'],
      ['Ile warzyw i owoców dziennie?', 'WHO wskazuje co najmniej 400 g łącznie dziennie dla osób powyżej 10. roku życia, jeśli stan zdrowia nie wymaga ograniczeń.'],
      ['Czy odżywka białkowa jest konieczna?', 'Nie. Może uzupełnić brak, lecz zwykłe pełnowartościowe produkty są równie prawidłowym źródłem białka.'],
      ['Czy można jeść węglowodany wieczorem?', 'Tak. O wyniku decyduje całodzienny plan i tolerancja; przy refluksie późny duży posiłek może wymagać zmiany.']
    ],
    sources: [
      ['WHO — Healthy diet', 'https://www.who.int/news-room/fact-sheets/detail/healthy-diet'],
      ['ESPEN Expert Group — protein intake and exercise for ageing muscle', 'https://pubmed.ncbi.nlm.nih.gov/24814383/'],
      ['WHO — Guidelines on physical activity and sedentary behaviour', 'https://www.who.int/publications/i/item/9789240015128'],
      ['Dietary Guidelines for Americans 2020–2025', 'https://www.dietaryguidelines.gov/']
    ]
  },
  {
    file: 'dieta-50-50-po-piecdziesiatce.html',
    title: 'Dieta 50/50 po 50-tce: post co drugi dzień bez mitów',
    h1: 'Dieta 50/50 po 50-tce: czy post co drugi dzień działa lepiej?',
    description: 'Dieta 50/50 to post co drugi dzień, nie magiczna proporcja. Sprawdź wyniki rocznego RCT, ryzyko rezygnacji, bezpieczeństwo i prostsze alternatywy.',
    quick: 'Dieta 50/50, rozumiana jako post naprzemienny, może zmniejszać masę, jeśli obniża średnią podaż energii. W rocznym badaniu 100 dorosłych nie dawała większego spadku masy niż codzienne ograniczenie kalorii, a grupa postu częściej rezygnowała. Po 50-tce najważniejsze są bezpieczeństwo leków, utrzymanie białka i wybór schematu, który można kontynuować.',
    takeaways: [
      'Post naprzemienny jest sposobem organizacji deficytu energii, nie osobnym mechanizmem spalania tłuszczu.',
      'Roczne RCT nie wykazało przewagi utraty masy nad codziennym ograniczeniem energii.',
      'Badani mieli średnio 44 lata, więc wyniku nie wolno przedstawiać jako próby wyłącznie u osób po 50-tce.',
      'Insulina, pochodne sulfonylomocznika, niedowaga i historia zaburzeń odżywiania wymagają szczególnej ostrożności.'
    ],
    sections: [
      ['Na czym polega dieta 50/50?', 'W tym artykule 50/50 oznacza alternate-day fasting: naprzemienne dni bardzo małej podaży energii i dni jedzenia bez wyznaczonego deficytu. Nazwa nie jest standardem klinicznym, dlatego zawsze trzeba doprecyzować harmonogram, kalorie w dni postne i zasady dni zwykłych.', 'Jeśli w dni jedzenia pojawia się kompensacyjne przejadanie, średni deficyt może zniknąć. Schemat nie zwalnia też z dbania o białko, warzywa i jakość produktów. Fundamenty omawia <a href="dieta-po-50.html">poradnik diety po 50-tce</a>.'],
      ['Co wykazało roczne badanie porównawcze?', 'Randomizowane badanie objęło 100 dorosłych z otyłością, ze średnim wiekiem około 44 lat. Po 12 miesiącach zmiana masy wynosiła około −6,0% w grupie postu naprzemiennego i −5,3% przy codziennym ograniczeniu energii. Różnica między strategiami nie była istotna statystycznie.', 'Z grupy postu zrezygnowało 38% uczestników, z codziennego ograniczenia 29%, a z kontroli 26%. To ważny wynik praktyczny: skuteczność planu obejmuje również możliwość jego utrzymania. Nie należy z tego badania obiecywać osobom po 50-tce konkretnej utraty kilogramów.'],
      ['Czy post daje dodatkową przewagę metaboliczną?', 'Duża metaanaliza sieciowa 99 badań wykazała niewielką przewagę postu naprzemiennego nad ciągłym ograniczeniem masy ciała, około 1,29 kg. Autorzy wskazali, że jest to poniżej przyjętego przez nich progu 2 kg dla istotności klinicznej, a w dłuższych badaniach przewaga nie była jasna.', 'Poprawa glikemii i lipidów zwykle współwystępuje ze zmianą masy i energii. Nie ma podstaw, by mówić o „resecie metabolizmu” albo detoksie. O realnych determinantach wyniku przeczytasz w <a href="jak-tluszcz-zamienia-sie-w-energie-biologia-spalania-tluszczu-po-50.html">artykule o spalaniu tłuszczu</a>.'],
      ['Jak chronić mięśnie podczas redukcji?', 'Dni bardzo małej podaży energii utrudniają rozłożenie białka w posiłkach. Po 50-tce trzeba równolegle zaplanować trening oporowy, wystarczającą ilość białka i umiarkowane tempo redukcji. Sam spadek masy nie mówi, jaka część pochodzi z tkanki tłuszczowej.', 'Jeśli post pogarsza trening, sen albo powoduje napady jedzenia, codzienny łagodny deficyt może być lepszym narzędziem. Cel białka można oszacować w <a href="kalkulator-bialka-po-50.html">kalkulatorze białka</a>, z korektą w chorobach wymagających indywidualizacji.'],
      ['Kto nie powinien zaczynać bez konsultacji?', 'Post może prowadzić do niedocukrzenia u osób przyjmujących insulinę lub niektóre leki przeciwcukrzycowe, jeśli dawki nie zostaną skorygowane. Ostrożność jest konieczna przy niedowadze, niedożywieniu, chorobie nerek, częstych omdleniach oraz historii zaburzeń odżywiania.', 'Nie odstawiaj i nie przesuwaj leków na własną rękę, aby dopasować je do internetowego jadłospisu. Zawroty głowy, splątanie, omdlenie i objawy hipoglikemii wymagają przerwania postu i działania zgodnie z planem medycznym. Bezpieczniejszy start opisuje <a href="powrot-do-formy-po-50-kompletny-przewodnik.html">plan powrotu do formy</a>.']
    ],
    table: ['Post 50/50 a codzienny deficyt — wynik rocznego RCT', ['Cecha', 'Post naprzemienny', 'Codzienne ograniczenie'], [
      ['Zmiana masy po 12 miesiącach', 'Około −6,0%', 'Około −5,3%'],
      ['Rezygnacja z grupy', '38%', '29%'],
      ['Przewaga jednej strategii', 'Brak istotnej różnicy masy', 'Brak istotnej różnicy masy'],
      ['Najważniejszy wybór', 'Czy harmonogram jest wykonalny', 'Czy codzienny limit jest wykonalny']
    ]],
    faqs: [
      ['Czy dieta 50/50 jest lepsza od zwykłego deficytu?', 'W rocznym RCT nie spowodowała istotnie większej utraty masy niż codzienne ograniczenie energii.'],
      ['Czy w dni niepostne można jeść bez ograniczeń?', 'Brak wyznaczonego limitu nie znosi bilansu energii; kompensacyjne przejadanie może zmniejszyć lub wyzerować deficyt.'],
      ['Czy post 50/50 jest przebadany po 50-tce?', 'Najważniejsze roczne RCT miało średni wiek około 44 lat, więc nie jest badaniem wyłącznie osób po 50-tce.'],
      ['Czy można pościć przy cukrzycy?', 'Przy insulinie lub lekach grożących niedocukrzeniem post wymaga uzgodnienia leczenia z lekarzem.']
    ],
    sources: [
      ['Trepanowski i wsp. — alternate-day fasting randomized trial', 'https://pubmed.ncbi.nlm.nih.gov/28459931/'],
      ['BMJ — intermittent fasting strategies, systematic review and network meta-analysis', 'https://www.bmj.com/content/389/bmj-2024-082007'],
      ['ESPEN Expert Group — protein intake and exercise for ageing muscle', 'https://pubmed.ncbi.nlm.nih.gov/24814383/'],
      ['WHO — Healthy diet', 'https://www.who.int/news-room/fact-sheets/detail/healthy-diet']
    ]
  },
  {
    file: 'jak-pozbyc-sie-oponki-brzusznej-po-50.html',
    title: 'Oponka brzuszna po 50-tce: co naprawdę działa?',
    h1: 'Jak zmniejszyć oponkę po 50-tce bez spalania miejscowego?',
    description: 'Oponka brzuszna po 50-tce nie znika od jednego ćwiczenia ani produktu. Zobacz dowody o ruchu, deficycie energii, obwodzie pasa i czerwonych flagach.',
    quick: 'Po 50-tce nie można wybrać miejsca, z którego organizm zużyje tłuszcz. Ćwiczenia brzucha wzmacniają mięśnie, ale redukcja obwodu pasa wymaga długotrwałej zmiany bilansu energii i aktywności. Metaanalizy randomizowanych badań pokazują, że trening aerobowy, siłowy, łączony i interwałowy mogą zmniejszać tłuszcz trzewny. Najlepszy wybór to forma możliwa do regularnego wykonywania.',
    takeaways: [
      'Miejscowe ćwiczenie mięśni brzucha nie powoduje selektywnego spalania tłuszczu nad nimi.',
      'Obwód pasa jest użytecznym trendem, ale nie odróżnia precyzyjnie tłuszczu trzewnego od podskórnego.',
      'Różne rodzaje treningu mogą zmniejszać tłuszcz trzewny; regularność i całkowita dawka są ważniejsze niż nazwa metody.',
      'Nagłe powiększenie brzucha, ból, wodobrzusze albo niezamierzona utrata masy wymagają diagnostyki.'
    ],
    sections: [
      ['Dlaczego nie da się spalać tłuszczu tylko z brzucha?', 'Mięsień wykorzystuje energię, ale nie pobiera jej wyłącznie z warstwy tłuszczu znajdującej się bezpośrednio nad nim. O miejscu utraty tkanki tłuszczowej współdecydują genetyka, płeć, hormony i całkowita zmiana masy. Brzuszki mogą zwiększyć siłę tułowia bez widocznej zmiany obwodu.', 'Warto ćwiczyć brzuch dla funkcji, nie jako „palnik oponki”. Łącz ruch całego ciała, trening oporowy i zmianę żywienia, którą można utrzymać. Fizjologię procesu wyjaśnia <a href="jak-tluszcz-zamienia-sie-w-energie-biologia-spalania-tluszczu-po-50.html">artykuł o spalaniu tłuszczu</a>.'],
      ['Który trening najlepiej zmniejsza tłuszcz trzewny?', 'Przegląd 84 randomizowanych badań wskazuje, że trening aerobowy, oporowy, ich połączenie oraz interwały mogą zmniejszać tłuszcz trzewny. Porównania między metodami nie tworzą jednej recepty dla każdego. Program musi pasować do wydolności, stawów, ryzyka i czasu.', 'WHO zaleca dorosłym 150–300 minut umiarkowanego ruchu aerobowego tygodniowo oraz wzmacnianie głównych grup mięśni co najmniej dwa dni. Osoba nieaktywna zaczyna od mniejszej dawki. Plan połączenia obu bodźców daje <a href="dlaczego-bieznia-to-za-malo.html">poradnik o bieżni i sile</a>.'],
      ['Czy istnieją produkty spalające tłuszcz z brzucha?', 'Ocet, cytryna, imbir, zielona herbata i „ujemne kalorie” nie kierują spalania do brzucha. Niektóre produkty mogą ułatwiać sytość albo zastąpić bardziej kaloryczną opcję, ale efekt wynika z całego jadłospisu. Suplementy pobudzające mogą natomiast podnosić tętno i ciśnienie.', 'Najpierw usuń płynne kalorie i powtarzalne przekąski, które nie sycą, a następnie dodaj białko i produkty z błonnikiem. To konkretna zmiana środowiska jedzenia, nie magiczny składnik. Schemat posiłku opisuje <a href="dieta-po-50.html">dieta po 50-tce</a>.'],
      ['Jak prawidłowo mierzyć obwód pasa?', 'Używaj tej samej taśmy, miejsca i pory, stojąc swobodnie po spokojnym wydechu. WHO podkreśla, że protokół pomiaru musi być spójny. Jednorazowa różnica może wynikać z ułożenia taśmy, posiłku, zaparcia i zatrzymania płynów.', 'Zapisuj pomiar co tydzień lub dwa, zamiast kilka razy dziennie. Interpretuj trend razem z masą, ubraniem i samopoczuciem. Progi ryzyka zależą od płci i populacji, dlatego nie zastępują oceny ciśnienia, glukozy, lipidów i wywiadu.'],
      ['Kiedy większy brzuch nie jest zwykłą oponką?', 'Szybkie powiększanie obwodu, twardy lub bolesny brzuch, wymioty, krew w stolcu, żółtaczka, duszność albo obrzęki nóg wymagają oceny medycznej. Także niezamierzona utrata masy przy rosnącym brzuchu nie jest celem redukcyjnym.', 'Wzdęcie i tłuszcz to różne zjawiska. Jeśli obwód gwałtownie zmienia się w ciągu dnia wraz z bólem lub zmianą wypróżnień, zacznij od diagnostyki objawów, a nie od coraz bardziej restrykcyjnej diety. Bezpieczny powrót do ruchu opisuje <a href="powrot-do-formy-po-50-kompletny-przewodnik.html">plan startu po 50-tce</a>.']
    ],
    table: ['Co zmienia obwód pasa, a co jest mitem?', ['Działanie', 'Realny efekt', 'Czego nie robi'], [
      ['Deficyt energii', 'Może zmniejszać całkowity tłuszcz', 'Nie wybiera wyłącznie brzucha'],
      ['Trening aerobowy', 'Zwiększa wydatek i może zmniejszać VAT', 'Nie gwarantuje identycznej reakcji każdej osoby'],
      ['Trening siłowy', 'Chroni siłę i może zmniejszać VAT', 'Nie zamienia tłuszczu w mięśnie'],
      ['Ćwiczenia brzucha', 'Wzmacniają mięśnie tułowia', 'Nie spalają miejscowo oponki']
    ]],
    faqs: [
      ['Czy brzuszki spalają oponkę?', 'Nie miejscowo. Wzmacniają mięśnie, natomiast utrata tłuszczu zależy od całego bilansu energii i aktywności.'],
      ['Czy spacer wystarczy?', 'Może być dobrym początkiem i częścią planu, ale warto stopniowo zwiększać dawkę oraz dodać trening siłowy.'],
      ['Jak często mierzyć pas?', 'Wystarczy co tydzień lub dwa w tych samych warunkach. Częstsze pomiary zwiększają wpływ przypadkowych wahań.'],
      ['Czy menopauza uniemożliwia redukcję brzucha?', 'Nie. Może zmieniać rozmieszczenie tłuszczu i wymagać dopasowania planu, lecz nie wyłącza reakcji na żywienie i ruch.']
    ],
    sources: [
      ['Khalafi i wsp. — exercise training and visceral adipose tissue, meta-analysis', 'https://pubmed.ncbi.nlm.nih.gov/38031812/'],
      ['WHO — Guidelines on physical activity and sedentary behaviour', 'https://www.who.int/publications/i/item/9789240015128'],
      ['WHO — Waist circumference and waist–hip ratio report', 'https://iris.who.int/bitstream/handle/10665/44583/9789241501491_eng.pdf'],
      ['Aerobic exercise and body weight — dose-response meta-analysis', 'https://pubmed.ncbi.nlm.nih.gov/39724371/']
    ]
  },
  {
    file: 'kreatyna-i-bialko-po-50-tce-jak-laczyc.html',
    imageBase: 'kreatyna-bialko-po-50-hero-v2',
    imageAlt: 'Mężczyzna po 50-tce odmierza kreatynę obok jogurtu, jaj, strączków i posiłku białkowego po treningu siłowym',
    title: 'Kreatyna i białko po 50-tce: dawki i łączenie',
    h1: 'Kreatyna i białko po 50-tce: jak je łączyć i komu służą?',
    description: 'Kreatyna i białko po 50-tce pełnią różne role. Sprawdź typowe dawki, porę przyjmowania, wyniki badań u starszych dorosłych i zasady bezpieczeństwa.',
    quick: 'Białko dostarcza aminokwasów potrzebnych do budowy i utrzymania tkanek, a kreatyna zwiększa zasoby fosfokreatyny wykorzystywane w krótkim intensywnym wysiłku. Można przyjmować je razem lub osobno. Najczęściej stosowana dawka monohydratu kreatyny to 3–5 g dziennie; suplement ma sens głównie jako dodatek do regularnego treningu oporowego i odpowiedniego żywienia.',
    takeaways: [
      'Białko i kreatyna nie dublują działania: jedno dostarcza aminokwasów, drugie wspiera szybkie odtwarzanie energii.',
      'Nie trzeba trafiać w kilkuminutowe „okno anaboliczne”; ważniejsze są dobowa ilość białka i regularność kreatyny.',
      'Monohydrat kreatyny jest najlepiej przebadaną formą; droższa nazwa nie dowodzi większej skuteczności.',
      'Choroba nerek, nieprawidłowa filtracja lub zalecone ograniczenie białka wymagają indywidualnej konsultacji.'
    ],
    sections: [
      ['Czym różni się działanie białka i kreatyny?', 'Białko z żywności lub odżywki dostarcza aminokwasów wykorzystywanych do syntezy białek mięśniowych i wielu innych tkanek. Kreatyna gromadzi się głównie w mięśniach jako wolna kreatyna i fosfokreatyna, pomagając szybko odtwarzać ATP podczas intensywnych serii.', 'Ani białko, ani kreatyna nie budują mięśni bez odpowiedniego bodźca. Największy praktyczny sens mają wraz z progresywnym treningiem. Podstawy programu znajdują się w <a href="centrum-treningu-silowego-po-50.html">Centrum Treningu Siłowego</a>.'],
      ['Ile białka potrzebuje osoba po 50-tce?', 'Eksperci ESPEN proponują zdrowym starszym osobom zwykle 1,0–1,2 g białka na kilogram masy ciała dziennie, a w części chorób 1,2–1,5 g po indywidualnej ocenie. Wartości nie należy automatycznie stosować przy przewlekłej chorobie nerek lub innym zaleconym ograniczeniu.', 'Najpierw policz zwykłe jedzenie. Odżywka uzupełnia różnicę, gdy trudno osiągnąć cel posiłkami. Nie jest lepsza od jaj, nabiału, ryb, mięsa, tofu czy strączków. Pomoc w liczeniu daje <a href="kalkulator-bialka-po-50.html">kalkulator białka</a>.'],
      ['Jak dawkować monohydrat kreatyny?', 'Typowa prosta strategia to 3–5 g monohydratu kreatyny codziennie. Faza ładowania, na przykład około 20 g podzielonych na porcje przez kilka dni, szybciej nasyca mięśnie, ale nie jest konieczna i częściej powoduje dolegliwości żołądkowe.', 'Porę można dopasować do rutyny, ponieważ najważniejsza jest regularność i stopniowe nasycenie. Rozpuszczenie w napoju lub dodanie do koktajlu białkowego jest wygodne, lecz nie daje potwierdzonej przewagi nad przyjęciem osobno. Szerszy kontekst daje <a href="kreatyna-po-50-tce-kompletny-przewodnik.html">poradnik kreatyny po 50-tce</a>.'],
      ['Co pokazują badania u starszych dorosłych?', 'Metaanalizy badań łączących kreatynę z treningiem oporowym wskazują na dodatkową poprawę części wyników siły i składu ciała względem samego treningu. Wielkość efektu zależy od badania, ćwiczenia, czasu i uczestników; nie każdy wynik poprawia się w takim samym stopniu.', 'Nie wolno zamieniać średniej z grupy na obietnicę kilogramów mięśni dla konkretnej osoby. Sen, energia, białko, program i choroby nadal mają znaczenie. Błędy w ocenie suplementów omawia <a href="suplementacja-po-50.html">przewodnik suplementacji</a>.'],
      ['Kiedy trzeba zachować ostrożność?', 'Przewlekła choroba nerek, nieprawidłowy eGFR, zalecone ograniczenie białka lub płynów oraz niewyjaśnione nieprawidłowości badań wymagają konsultacji. Kreatyna może podnosić stężenie kreatyniny, co nie musi oznaczać pogorszenia filtracji, ale może utrudniać interpretację.', 'Zgłoś lekarzowi stosowaną dawkę i czas przyjmowania przed oceną wyników. Wybieraj prosty monohydrat z wiarygodnego źródła zamiast mieszanek ukrywających porcje. O monitorowaniu parametrów przeczytasz w <a href="badania-krwi-po-50-jak-czesto.html">artykule o badaniach krwi</a>.']
    ],
    table: ['Białko i kreatyna — dwa różne zadania', ['Cecha', 'Białko', 'Kreatyna monohydrat'], [
      ['Co dostarcza?', 'Aminokwasy', 'Kreatynę do puli fosfokreatyny'],
      ['Typowy cel', 'Pokrycie dobowego zapotrzebowania', 'Wsparcie krótkiego intensywnego wysiłku'],
      ['Typowa ilość', 'Zależna od masy, diety i zdrowia', '3–5 g dziennie'],
      ['Czy pora jest kluczowa?', 'Ważniejsza jest suma i rozłożenie', 'Ważniejsza jest codzienna regularność']
    ]],
    faqs: [
      ['Czy można mieszać kreatynę z odżywką białkową?', 'Tak. Można przyjąć je w jednym koktajlu albo osobno; nie ma potrzeby specjalnego odstępu.'],
      ['Ile kreatyny po 50-tce?', 'W badaniach i praktyce często stosuje się 3–5 g monohydratu dziennie. Indywidualne przeciwwskazania trzeba omówić z lekarzem.'],
      ['Czy kreatynę bierze się tylko w dni treningowe?', 'Nie. Codzienne stosowanie ułatwia utrzymanie zasobów mięśniowych; pora dnia ma mniejsze znaczenie niż regularność.'],
      ['Czy kreatyna uszkadza nerki?', 'U zdrowych osób typowe dawki są dobrze przebadane, ale choroba nerek lub nieprawidłowe wyniki wymagają indywidualnej oceny.']
    ],
    sources: [
      ['ESPEN Expert Group — protein intake and exercise for ageing muscle', 'https://pubmed.ncbi.nlm.nih.gov/24814383/'],
      ['Creatine plus resistance training in older adults — meta-analysis', 'https://pubmed.ncbi.nlm.nih.gov/41388441/'],
      ['ISSN — safety and efficacy of creatine supplementation', 'https://pubmed.ncbi.nlm.nih.gov/28615996/'],
      ['Resistance training prescription — systematic review and network meta-analysis', 'https://pubmed.ncbi.nlm.nih.gov/37414459/']
    ]
  }
];

function esc(value) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderTable(table) {
  const [caption, headers, rows] = table;
  return `<div class="table-wrap"><table><caption>${caption}</caption><thead><tr>${headers.map((item) => `<th scope="col">${item}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((item, index) => index === 0 ? `<th scope="row">${item}</th>` : `<td>${item}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function renderBody(article, preservedHub, preservedShare) {
  const sections = article.sections.map(([heading, first, second]) => `<h2>${heading}</h2><p>${first}</p><p>${second}</p>`).join('');
  const faq = article.faqs.map(([q, a], index) => `<article class="faq-item" id="faq-${index + 1}"><h3>${q}</h3><p>${a}</p></article>`).join('');
  const sources = article.sources.map(([label, url]) => `<li><a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a></li>`).join('');
  return `<article class="article-content"><section class="quick-answer reveal" id="quick-answer" aria-label="Szybka odpowiedź"><h2>Szybka odpowiedź</h2><p>${article.quick}</p></section><section class="key-takeaways reveal" data-ai-summary="editorial" aria-label="Kluczowe wnioski"><h2>Kluczowe wnioski</h2><ul>${article.takeaways.map((item) => `<li>${item}</li>`).join('')}</ul></section>${sections}${renderTable(article.table)}<section class="faq-list reveal" aria-label="Najczęściej zadawane pytania"><h2>Najczęściej zadawane pytania</h2>${faq}</section>${preservedHub || ''}${preservedShare || ''}<h2 id="zrodla">Źródła</h2><ol class="sources-list">${sources}</ol><div class="medical-disclaimer"><p><strong>Uwaga:</strong> Artykuł ma charakter informacyjny i edukacyjny. Nie zastępuje konsultacji, diagnozy ani indywidualnego leczenia.</p></div></article>`;
}

function updateJsonLd(html, article) {
  return html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, (whole, raw) => {
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
      data.mainEntity = article.faqs.map(([name, answer]) => ({ '@type': 'Question', name, acceptedAnswer: { '@type': 'Answer', text: answer } }));
    }
    if (data['@type'] === 'BreadcrumbList' && Array.isArray(data.itemListElement)) {
      const last = data.itemListElement[data.itemListElement.length - 1];
      if (last) last.name = article.h1;
    }
    return `<script type="application/ld+json">\n${JSON.stringify(data, null, 2)}\n</script>`;
  });
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
  if (article.imageBase) {
    html = html.replace(/kreatyna-bialko-po-50-hero(?:-v2)*/g, article.imageBase);
    html = html.replace(/alt="Aktywny mężczyzna po pięćdziesiątce[^"]*"/, `alt="${esc(article.imageAlt)}"`);
  }
  return html;
}

for (const article of articles) {
  const filePath = path.join(ROOT, article.file);
  let html = fs.readFileSync(filePath, 'utf8');
  const hub = (html.match(/<p class="topic-hub-backlink">[\s\S]*?<\/p>/) || [''])[0];
  const share = (html.match(/<section class="share-article-section reveal"[\s\S]*?<\/section>/) || [''])[0];
  html = updateJsonLd(html, article);
  html = updateMeta(html, article);
  const replacement = `${renderBody(article, hub, share)}</div></main><section class="reading-room`;
  const bodyPattern = /<article class="article-content">[\s\S]*?<\/article>\s*<\/div>\s*<\/main>\s*<section class="reading-room/;
  if (!bodyPattern.test(html)) throw new Error(`Nie znaleziono treści artykułu: ${article.file}`);
  html = html.replace(bodyPattern, replacement);
  fs.writeFileSync(filePath, html);
  console.log(`[BATCH-3] repaired ${article.file}`);
}
const remainingArticles = [{
    file: 'dlaczego-bieznia-to-za-malo.html',
    title: 'Bieżnia po 50-tce: dlaczego warto dodać siłę?',
    h1: 'Bieżnia po 50-tce: dlaczego marsz nie rozwija całej sprawności?',
    description: 'Bieżnia po 50-tce poprawia wydolność, ale nie zastępuje treningu siłowego i równowagi. Zobacz prosty tydzień łączący marsz, siłę oraz regenerację.',
    quick: 'Marsz na bieżni jest wartościowym treningiem aerobowym i może poprawiać wydolność, ciśnienie oraz tolerancję wysiłku. Nie zapewnia jednak pełnego bodźca dla wszystkich głównych grup mięśni ani ćwiczeń równowagi. Po 50-tce najlepszy plan łączy ruch aerobowy z co najmniej dwoma dniami wzmacniania, zgodnie z zaleceniami WHO.',
    takeaways: [
      'Bieżnia nie jest stratą czasu; problemem jest wyłącznie plan oparty tylko na jednej formie ruchu.',
      'Marsz rozwija wydolność, ale nie zastępuje progresywnego obciążenia pleców, ramion i całych nóg.',
      'Trening siłowy i równowaga uzupełniają to, czego nie daje jednostajny marsz.',
      'Dawkę trzeba dopasować do punktu startu, chorób, bólu i możliwości regeneracji.'
    ],
    sections: [
      ['Co bieżnia rzeczywiście daje po 50-tce?', 'Marsz i bieg na bieżni zwiększają wydatek energetyczny oraz obciążają układ krążenia w sposób zależny od tempa i nachylenia. Regularny trening aerobowy może poprawiać wydolność i wspierać redukcję tłuszczu. Poręcze, przewidywalna nawierzchnia i kontrola prędkości bywają pomocne na początku.', 'Nie każdy musi biegać. Szybki marsz, przy którym oddech przyspiesza, może być pełnoprawnym wysiłkiem umiarkowanym. Jeżeli bieżnia jest jedyną formą, którą wykonujesz regularnie, zachowaj ją i dobuduj brakujące elementy. Łagodny start opisuje <a href="trening-3x30-dla-50-plus.html">plan treningu 3×30</a>.'],
      ['Czego sam marsz zwykle nie rozwija wystarczająco?', 'Chodzenie angażuje mięśnie nóg, lecz obciążenie jest powtarzalne i nie rośnie automatycznie wraz z adaptacją. Nie daje też znaczącego bodźca dla przyciągania, wypychania, chwytu i części ruchów biodra. Dlatego nie powinno być jedynym narzędziem ochrony siły całego ciała.', 'Wzmacnianie nie musi oznaczać sztangi. Maszyny, hantle, gumy i masa ciała mogą realizować podstawowe wzorce, jeśli opór jest stopniowo zwiększany. Plan dla początkujących znajduje się w <a href="centrum-treningu-silowego-po-50.html">Centrum Treningu Siłowego po 50-tce</a>.'],
      ['Dlaczego równowaga jest osobnym elementem?', 'Stabilny marsz przodem nie ćwiczy wszystkich sytuacji, w których traci się równowagę: zmiany kierunku, sięgania, nierównego podłoża i przenoszenia ciężaru na jedną nogę. WHO zaleca starszym osobom wieloskładnikową aktywność z naciskiem na równowagę i siłę co najmniej trzy dni w tygodniu.', 'Ćwiczenia równowagi powinny mieć bezpieczne otoczenie i podparcie w zasięgu ręki. Przy nawracających upadkach, zawrotach głowy albo zaburzeniach czucia potrzebna jest ocena przyczyny. Zakres ruchu i kontrolę stawów rozwija program <a href="mobilnosc-vs-rozciaganie-program-dla-stawow-po-piecdziesiatce.html">mobilności po 50-tce</a>.'],
      ['Jak połączyć cardio i siłę w jednym tygodniu?', 'Najprostszy układ to trzy marsze oraz dwa krótkie treningi całego ciała w niekolejne dni. Część sesji może być połączona: po dwudziestu minutach marszu wykonaj cztery ćwiczenia siłowe. Na początku ważniejsze jest wykonanie planu niż maksymalna liczba minut.', 'Zwiększaj tylko jeden parametr naraz: czas, nachylenie, prędkość albo liczbę serii. Gdy narasta ból stawu, spada sen lub zmęczenie utrzymuje się kilka dni, zmniejsz dawkę. Zasady bezpiecznej progresji opisuje <a href="powrot-do-formy-po-50-kompletny-przewodnik.html">przewodnik powrotu do formy</a>.'],
      ['Kiedy bieżnia nie jest dobrym miejscem na samodzielny start?', 'Nowy ból w klatce, omdlenie, duszność nieproporcjonalna do wysiłku, niestabilne ciśnienie albo świeży uraz wymagają konsultacji przed intensywnym treningiem. Zwykły brak kondycji nie oznacza automatycznie zakazu ruchu, lecz objawy alarmowe trzeba odróżnić od normalnego zmęczenia.', 'Nie trzymaj się poręczy przy prędkości, której bez nich nie kontrolujesz. Zmniejsz tempo i wybierz nachylenie pozwalające na naturalny krok. Jeśli chcesz uniknąć typowych błędów, zajrzyj do artykułu <a href="bledy-50.html">o błędach treningowych po 50-tce</a>.']
    ],
    table: ['Tydzień, który uzupełnia samą bieżnię', ['Dzień', 'Główny bodziec', 'Przykład'], [
      ['Poniedziałek', 'Siła całego ciała', 'Przysiad do ławki, przyciąganie, wypychanie, ruch biodra'],
      ['Wtorek', 'Cardio', 'Marsz w tempie rozmowy'],
      ['Czwartek', 'Siła i równowaga', 'Cztery ćwiczenia siłowe plus bezpieczne przenoszenie ciężaru'],
      ['Sobota', 'Cardio', 'Dłuższy marsz lub spacer w terenie']
    ]],
    faqs: [
      ['Czy bieżnia po 50-tce ma sens?', 'Tak. Jest wartościowym narzędziem cardio, ale warto uzupełnić ją ćwiczeniami siłowymi i równowagą.'],
      ['Czy chodzenie buduje mięśnie nóg?', 'Chodzenie angażuje nogi i może poprawić sprawność początkującego, lecz zwykle nie zastępuje progresywnego treningu siłowego.'],
      ['Ile razy w tygodniu dodać siłę?', 'WHO zaleca ćwiczenia wzmacniające główne grupy mięśni co najmniej dwa dni w tygodniu.'],
      ['Czy cardio i siłę można zrobić jednego dnia?', 'Tak. Początkujący może połączyć krótki marsz i kilka ćwiczeń siłowych, jeśli toleruje taki wysiłek i zachowuje technikę.']
    ],
    sources: [
      ['WHO — physical activity recommendations for older adults', 'https://www.who.int/publications/i/item/9789240064096'],
      ['WHO — Guidelines on physical activity and sedentary behaviour', 'https://www.who.int/publications/i/item/9789240015128'],
      ['Resistance training prescription — network meta-analysis', 'https://pubmed.ncbi.nlm.nih.gov/37414459/'],
      ['Aerobic exercise and weight loss — dose-response meta-analysis', 'https://pubmed.ncbi.nlm.nih.gov/39724371/']
    ]
  },
  {
    file: 'powrot-do-formy-po-50-kompletny-przewodnik.html',
    title: 'Powrót do formy po 50-tce: bezpieczny plan startu',
    h1: 'Powrót do formy po 50-tce: bezpieczny plan na sześć tygodni',
    description: 'Powrót do formy po 50-tce nie wymaga kompletu badań ani drogiego sprzętu. Zobacz plan sześciu tygodni, progresję i objawy wymagające konsultacji.',
    quick: 'Po 50-tce powrót do formy zacznij od dawki, po której możesz bez problemu funkcjonować następnego dnia. Dla większości osób oznacza to dwa krótkie treningi siłowe i kilka spokojnych marszów tygodniowo. Pełny pakiet badań nie jest obowiązkowy dla każdego, ale objawy alarmowe, niestabilna choroba lub długa przerwa po poważnym leczeniu wymagają konsultacji.',
    takeaways: [
      'Nie trzeba kupować suplementów, specjalnych butów i rocznego karnetu przed pierwszym treningiem.',
      'Badania i zgoda lekarza zależą od objawów oraz stanu zdrowia, a nie wyłącznie od ukończenia 50 lat.',
      'Pierwsze tygodnie służą budowaniu tolerancji i techniki, nie sprawdzaniu maksymalnych możliwości.',
      'Postęp mierzy się również regularnością, siłą i łatwością codziennych czynności, nie tylko wagą.'
    ],
    sections: [
      ['Czy przed startem każdy musi zrobić komplet badań?', 'Sam wiek powyżej 50 lat nie oznacza automatycznie konieczności wykonywania rozbudowanego pakietu laboratoryjnego, próby wysiłkowej i badania serca. Osoba bez objawów może zwykle rozpocząć lekką lub umiarkowaną aktywność stopniowo. Zakres profilaktyki powinien wynikać z historii zdrowia i krajowych zaleceń.', 'Konsultacji wymagają między innymi nowy ból w klatce, omdlenie, niewyjaśniona duszność, niekontrolowane ciśnienie i świeży poważny incydent medyczny. Przygotuj listę leków i objawów. Badania profilaktyczne opisuje <a href="badania-po-50.html">przewodnik badań po 50-tce</a>.'],
      ['Co jest naprawdę potrzebne do pierwszego treningu?', 'Wystarczy wygodny strój, stabilne obuwie odpowiednie do wybranej aktywności i plan kilku prostych ruchów. Zegarek, odżywka, pas treningowy i drogi karnet są opcjonalne. Jeśli ćwiczysz w domu, krzesło, ściana i guma mogą wystarczyć do rozpoczęcia pracy nad podstawową siłą.', 'Trener jest pomocny, gdy nie znasz techniki, boisz się ruchu po urazie albo potrzebujesz dopasowania ćwiczeń. Nie jest obowiązkowy na zawsze. Pierwszą wizytę na sali opisuje artykuł <a href="jak-zaczac-na-silowni-po-50.html">jak zacząć na siłowni po 50-tce</a>.'],
      ['Jak powinny wyglądać pierwsze dwa tygodnie?', 'Wybierz dwa niekolejne dni treningu całego ciała. Wykonaj po jednej serii pięciu lub sześciu ruchów w zakresie, który nie nasila bólu, kończąc serię z wyraźnym zapasem. W pozostałe dni dodaj marsz trwający od dziesięciu do trzydziestu minut zależnie od aktualnej wydolności.', 'Po sesji powinieneś czuć wykonany wysiłek, ale nie całkowite wyczerpanie. Lekka bolesność mięśni może się pojawić, natomiast ostry ból stawu, zawroty głowy lub objawy krążeniowe nie są celem adaptacji. Gotowy prosty rytm zawiera <a href="trening-3x30-dla-50-plus.html">plan 3×30 po 50-tce</a>.'],
      ['Jak zwiększać obciążenie od trzeciego do szóstego tygodnia?', 'Najpierw popraw powtarzalność i technikę. Gdy dwa kolejne treningi wykonujesz bez narastającego bólu i z zapasem, dodaj jedno lub dwa powtórzenia, a dopiero później niewielki opór lub dodatkową serię. Nie zwiększaj jednocześnie czasu marszu, ciężaru i liczby treningów.', 'Co tydzień zapisuj wykonane sesje, ćwiczenia oraz subiektywną trudność. Jeśli sen się pogarsza, ból narasta albo wynik spada na kilku treningach, wróć do poprzedniej dawki. Typowe pułapki omawia <a href="bledy-50.html">artykuł o błędach początkujących</a>.'],
      ['Jak mierzyć efekty bez obsesji na punkcie wagi?', 'Waga nie odróżnia tłuszczu, mięśni, glikogenu i wody. W pierwszych tygodniach zapisuj przede wszystkim regularność, liczbę poprawnych powtórzeń, tempo znanego spaceru oraz łatwość wstawania z krzesła i noszenia zakupów. Obwód pasa wystarczy mierzyć w powtarzalnych warunkach, nie codziennie.', 'Wybierz dwa wskaźniki odpowiadające Twojemu celowi i sprawdzaj je co cztery tygodnie. Brak szybkiej zmiany sylwetki nie oznacza braku poprawy wydolności lub siły. Szerszy plan kontynuacji znajdziesz w <a href="centrum-treningu-silowego-po-50.html">Centrum Treningu Siłowego</a>.']
    ],
    table: ['Plan pierwszych sześciu tygodni', ['Okres', 'Trening siłowy', 'Cardio i cel'], [
      ['Tydzień 1–2', '2 dni, po 1 serii podstawowych ruchów', 'Spokojne marsze; poznanie tolerancji'],
      ['Tydzień 3–4', '2 dni, więcej powtórzeń lub druga seria', 'Stopniowe wydłużenie jednego marszu'],
      ['Tydzień 5–6', '2–3 dni zależnie od regeneracji', 'Utrzymanie regularności i tempa'],
      ['Po 6 tygodniach', 'Ocena techniki, siły i bólu', 'Zmiana tylko jednego parametru naraz']
    ]],
    faqs: [
      ['Czy po 50-tce trzeba zrobić badania przed ćwiczeniami?', 'Nie każdy potrzebuje pełnego pakietu. Zakres zależy od objawów, chorób i planowanej intensywności; objawy alarmowe wymagają konsultacji.'],
      ['Czy trener personalny jest konieczny?', 'Nie. Może ułatwić naukę techniki i dopasowanie ćwiczeń, ale prosty bezpieczny plan można rozpocząć również bez stałej opieki.'],
      ['Jak często ćwiczyć na początku?', 'Dwa niekolejne dni treningu siłowego i kilka spokojnych marszów to rozsądny start dla wielu osób. Dawka musi pasować do obecnej sprawności.'],
      ['Kiedy zwiększyć ciężar?', 'Gdy dwa kolejne treningi wykonujesz technicznie, bez narastającego bólu i z zapasem powtórzeń. Zwiększaj tylko jeden parametr naraz.']
    ],
    sources: [
      ['WHO — Guidelines on physical activity and sedentary behaviour', 'https://www.who.int/publications/i/item/9789240015128'],
      ['NIA — How older adults can get started with exercise', 'https://www.nia.nih.gov/health/exercise-and-physical-activity/how-older-adults-can-get-started-exercise'],
      ['Resistance training prescription — network meta-analysis', 'https://pubmed.ncbi.nlm.nih.gov/37414459/'],
      ['WHO — physical activity and sedentary behaviour for older people', 'https://www.who.int/publications/i/item/9789240064096']
    ]
  },
  {
    file: 'suplementacja-po-50.html',
    title: 'Białko i kreatyna po 50-tce: kiedy mają sens?',
    h1: 'Białko i kreatyna po 50-tce: kiedy pomagają, a kiedy nie?',
    description: 'Białko w proszku i kreatyna po 50-tce mogą ułatwiać plan, ale nie są obowiązkowe. Sprawdź dawki, różnice, bezpieczeństwo i sygnały do konsultacji.',
    quick: 'Odżywka białkowa ma sens, gdy zwykłymi posiłkami trudno pokryć ustaloną ilość białka. Kreatyna monohydrat w dawce 3–5 g dziennie może zwiększać efekt treningu oporowego u części starszych osób. Oba produkty można łączyć, lecz nie zastępują treningu, energii i pełnej diety. Choroba nerek wymaga indywidualnego ustalenia planu.',
    takeaways: [
      'Odżywka białkowa jest wygodną żywnością, a nie koniecznym etapem treningu po 50-tce.',
      'Najlepiej przebadaną formą kreatyny pozostaje monohydrat stosowany regularnie.',
      'Białko dostarcza aminokwasów, a kreatyna wspiera szybkie odtwarzanie energii; nie są zamiennikami.',
      'Dawki i potrzeby trzeba odnosić do całej diety, zdrowia nerek, masy ciała i aktywności.'
    ],
    sections: [
      ['Kiedy odżywka białkowa rzeczywiście ułatwia dietę?', 'Proszek może pomóc osobie z małym apetytem, ograniczonym czasem lub dietą, w której brakuje wygodnego źródła białka. Nie działa lepiej od jaj, nabiału, ryb, mięsa, soi czy strączków, jeśli zwykłe posiłki pokrywają potrzeby i są dobrze tolerowane.', 'U zdrowych starszych osób często rozważa się 1,0–1,2 g białka na kilogram masy ciała dziennie, ale cel nie jest uniwersalny. Przy niedożywieniu, chorobie lub otyłości sposób liczenia wymaga oceny. Szczegóły opisuje <a href="ile-bialka-po-50-roku-zycia-zapotrzebowanie-odzywki.html">poradnik zapotrzebowania na białko</a>.'],
      ['Co wiadomo o kreatynie po 50-tce?', 'Metaanalizy wskazują, że kreatyna dodana do treningu oporowego może zwiększać przyrost siły i beztłuszczowej masy w porównaniu z samym treningiem. Efekt nie występuje jednak identycznie u wszystkich, a wzrost masy na początku może częściowo wynikać z większej ilości wody w mięśniach.', 'Najprostsza opcja to monohydrat 3–5 g codziennie bez obowiązkowej fazy ładowania. Droższe formy nie mają wiarygodnie wykazanej przewagi. Pełny przegląd znajduje się w artykule <a href="kreatyna-po-50-tce-kompletny-przewodnik.html">o kreatynie po 50-tce</a>.'],
      ['Czy białko i kreatynę trzeba brać po treningu?', 'Regularność całej diety ma większe znaczenie niż wąskie „okno anaboliczne”. Białko można spożyć w posiłku przed lub po treningu, zależnie od rozkładu dnia. Kreatynę przyjmuj o porze, która ułatwia codzienną pamięć; nie trzeba mieszać jej z cukrem, aby działała.', 'Jeśli odżywka powoduje dyskomfort, zmniejsz porcję, sprawdź skład i tolerancję laktozy albo wybierz inne źródło. Nie dodawaj suplementów kosztem normalnego posiłku potrzebnego do energii i mikroskładników. Praktyczne połączenie opisuje <a href="kreatyna-i-bialko-po-50-tce-jak-laczyc.html">plan kreatyny i białka</a>.'],
      ['Kiedy potrzebna jest konsultacja?', 'Przewlekła choroba nerek, nieprawidłowy eGFR, konieczność ograniczania białka lub płynów oraz leki nefrotoksyczne wymagają omówienia suplementacji z lekarzem lub dietetykiem klinicznym. Kreatyna może zwiększyć kreatyninę bez rzeczywistego uszkodzenia filtracji, co utrudnia interpretację wyniku.', 'Nie zakładaj, że napis „dla seniora” oznacza lepszy lub bezpieczniejszy produkt. Sprawdź prosty skład, porcję, wiarygodność producenta i całkowitą ilość przyjmowaną z innych preparatów. Kontrolę wyników omawia <a href="badania-krwi-po-50-jak-czesto.html">poradnik badań krwi</a>.'],
      ['Czego nie warto kupować w ciemno?', 'Mieszanki z wieloma składnikami utrudniają ocenę dawki i przyczyny działań niepożądanych. BCAA zwykle nie są potrzebne, gdy dieta dostarcza odpowiednią ilość pełnowartościowego białka. „Boostery testosteronu”, spalacze i preparaty obiecujące odbudowę mięśni bez ćwiczeń nie mają porównywalnego poziomu dowodów.', 'Zacznij od określenia problemu: za mało białka, brak regularnego treningu czy niewystarczająca energia. Dopiero potem wybierz produkt, który rozwiązuje konkretną lukę. Podstawy treningu znajdziesz w <a href="centrum-treningu-silowego-po-50.html">Centrum Treningu Siłowego</a>.']
    ],
    table: ['Białko i kreatyna rozwiązują różne problemy', ['Produkt', 'Główna rola', 'Kiedy rozważyć'], [
      ['Odżywka białkowa', 'Wygodne dostarczenie aminokwasów', 'Gdy posiłki nie pokrywają ustalonego celu'],
      ['Kreatyna monohydrat', 'Wsparcie krótkiego intensywnego wysiłku', 'Jako dodatek do regularnego treningu oporowego'],
      ['BCAA', 'Wybrane aminokwasy', 'Zwykle zbędne przy odpowiednim pełnym białku'],
      ['Mieszanka „senior”', 'Zależna od składu', 'Tylko po sprawdzeniu każdego składnika i dawki']
    ]],
    faqs: [
      ['Czy każdy po 50-tce potrzebuje odżywki białkowej?', 'Nie. Jest przydatna, gdy zwykłe posiłki nie pokrywają potrzeb, ale nie ma przewagi nad pełnowartościową żywnością.'],
      ['Ile kreatyny przyjmować?', 'Najczęściej stosuje się 3–5 g monohydratu kreatyny dziennie. Faza ładowania nie jest konieczna.'],
      ['Czy można łączyć białko z kreatyną?', 'Tak. Pełnią różne funkcje i można przyjmować je w tym samym posiłku lub osobno. Najważniejsza jest regularność.'],
      ['Czy suplementy są bezpieczne przy chorobie nerek?', 'Plan białka i kreatyny przy chorobie nerek trzeba ustalić indywidualnie z zespołem prowadzącym.']
    ],
    sources: [
      ['ESPEN — protein intake and exercise for optimal muscle function with aging', 'https://pubmed.ncbi.nlm.nih.gov/24814383/'],
      ['Creatine plus resistance training in older adults — meta-analysis', 'https://pubmed.ncbi.nlm.nih.gov/41388441/'],
      ['Creatine in health and clinical disease — ISSN position stand', 'https://pubmed.ncbi.nlm.nih.gov/28615996/'],
      ['WHO — Healthy diet', 'https://www.who.int/news-room/fact-sheets/detail/healthy-diet']
    ]
  },
  {
    file: 'upf-jedzenie-ultra-przetworzone-uzaleznienie.html',
    title: 'UPF po 50-tce: czy żywność może uzależniać?',
    h1: 'UPF po 50-tce: czy ultra-przetworzona żywność może uzależniać?',
    description: 'UPF może ułatwiać przejadanie, ale „uzależnienie od jedzenia” pozostaje dyskutowane. Poznaj NOVA, badanie NIH, skalę YFAS i praktyczne zamiany dziś.',
    quick: 'W kontrolowanym badaniu NIH dwadzieścia osób jadło na diecie ultra-przetworzonej średnio około 500 kcal dziennie więcej niż na diecie nieprzetworzonej. To dowodzi wpływu badanego jadłospisu na spożycie, ale nie oznacza, że każdy produkt UPF działa jak narkotyk. YFAS opisuje objawy uzależnieniowego jedzenia, jednak oficjalna diagnoza „uzależnienia od UPF” pozostaje przedmiotem debaty.',
    takeaways: [
      'NOVA klasyfikuje stopień przetworzenia, a nie automatycznie wartość każdego produktu.',
      'Randomizowane badanie NIH wykazało większe spożycie energii na konkretnym jadłospisie UPF.',
      'Podobieństwo aktywacji układu nagrody nie dowodzi identycznego działania chipsów i kokainy.',
      'U części osób występują utrata kontroli i cierpienie wymagające profesjonalnej pomocy, niezależnie od nazwy diagnozy.'
    ],
    sections: [
      ['Co oznacza UPF w klasyfikacji NOVA?', 'Ultra-przetworzona żywność to przemysłowe formulacje zwykle z wieloma składnikami, w tym substancjami rzadko używanymi w domowej kuchni. Kategoria obejmuje między innymi część słodyczy, słonych przekąsek, napojów, gotowych dań i przetworzonych produktów zastępujących posiłek.', 'NOVA jest użyteczna w badaniach populacyjnych, lecz bardzo szeroka. Nie każdy produkt z kategorii czwartej ma ten sam skład, gęstość energetyczną i wpływ na sytość. Etykietę konkretnego produktu pomoże ocenić <a href="jak-czytac-etykiety-sklad-produktow-e-numery-inci.html">przewodnik po składzie i tabeli wartości</a>.'],
      ['Co wykazało randomizowane badanie NIH?', 'W badaniu stacjonarnym dwadzieścia osób przez dwa tygodnie jadło dietę ultra-przetworzoną, a przez kolejne dwa dietę nieprzetworzoną, w losowej kolejności. Oferowane jadłospisy dopasowano pod względem przedstawionej energii i podstawowych składników. Na diecie UPF uczestnicy jedli średnio około 500 kcal więcej dziennie i przybrali około 0,9 kg.', 'Badanie było krótkie, małe i obejmowało młodszych dorosłych, dlatego nie daje osobnego wyniku dla osób po 50-tce. Pokazuje jednak, że cechy całego jadłospisu mogą wpływać na tempo jedzenia i ilość spożytej energii. O ukrytych źródłach cukru przeczytasz w <a href="ukryty-cukier-po-50-pulapki-zdrowego-jedzenia.html">artykule o ukrytym cukrze</a>.'],
      ['Czy reakcja mózgu oznacza uzależnienie jak od narkotyków?', 'Jedzenie i substancje psychoaktywne angażują część wspólnych obwodów nagrody, ale sam obraz aktywacji mózgu nie dowodzi identycznej siły, farmakologii ani ryzyka. Twierdzenie, że jądro półleżące reaguje na chipsy „tak samo jak na kokainę”, upraszcza złożone i różniące się reakcje.', 'BMJ opisuje argumenty za uznaniem niektórych wzorców jedzenia wysoko nagradzających UPF za uzależnieniowe, jednocześnie wskazując nierozstrzygnięte kryteria i potrzebę dalszych badań. To hipoteza kliniczna rozwijana na podstawie wielu danych, a nie zgoda, że każdy konsument UPF jest uzależniony.'],
      ['Co mierzy Yale Food Addiction Scale?', 'YFAS przenosi kryteria zaburzeń związanych z używaniem substancji na zachowania dotyczące jedzenia. Pyta między innymi o utratę kontroli, silne pragnienie, kontynuowanie mimo szkód oraz istotne cierpienie. Wynik skali nie jest tym samym co samodzielna diagnoza postawiona na podstawie jednego internetowego testu.', 'Jeśli jedzenie wiąże się z napadami, wymiotami, ukrywaniem, silnym wstydem albo poważnie zakłóca życie, potrzebna jest pomoc lekarza, psychologa lub specjalisty zaburzeń odżywiania. Problem zasługuje na leczenie również wtedy, gdy termin „uzależnienie od UPF” nie znajduje się w klasyfikacji.'],
      ['Jak ograniczyć UPF bez zasady wszystko albo nic?', 'Najpierw wybierz produkt jedzony najczęściej, a nie najbardziej „zakazany”. Zastąp go opcją, która zachowuje wygodę: słodzony napój wodą gazowaną, część gotowych śniadań płatkami owsianymi z jogurtem, a przekąskę owocem i źródłem białka. Porównuj efekt na sytość i regularność.', 'Nie każdy produkt musi być ugotowany od zera. Mrożone warzywa, konserwowe strączki i naturalny jogurt mogą skracać przygotowanie bez tworzenia restrykcyjnej diety. Szerszy plan nawyków znajduje się w <a href="dieta-po-50.html">poradniku diety po 50-tce</a>, a centrum tematu w <a href="centrum-metabolizmu-po-50.html">Centrum Metabolizmu</a>.']
    ],
    table: ['Jak ocenić produkt bez automatycznego straszenia', ['Pytanie', 'Co sprawdzić', 'Dlaczego'], [
      ['Jak często go jem?', 'Codziennie, czasem czy awaryjnie', 'Częstotliwość zmienia znaczenie produktu w całej diecie'],
      ['Czy syci?', 'Białko, błonnik, objętość i tempo jedzenia', 'Mała sytość może ułatwiać nadwyżkę energii'],
      ['Co zastępuje?', 'Pełny posiłek czy okazjonalną przekąskę', 'Ten sam produkt może mieć inną rolę'],
      ['Czy tracę kontrolę?', 'Napady, cierpienie i konsekwencje', 'To sygnał do profesjonalnej oceny']
    ]],
    faqs: [
      ['Czy każde UPF jest niezdrowe?', 'Nie. NOVA obejmuje szeroką grupę produktów. Liczy się konkretny skład, rola w diecie, częstotliwość i to, co produkt zastępuje.'],
      ['Czy chipsy uzależniają tak samo jak kokaina?', 'Nie ma podstaw do tak prostego zrównania. Mogą angażować układ nagrody i sprzyjać utracie kontroli, ale mechanizm oraz skala działania nie są identyczne.'],
      ['Co wykazało badanie NIH?', 'W kontrolowanych warunkach uczestnicy jedli na diecie UPF około 500 kcal więcej dziennie i przybrali około 0,9 kg w dwa tygodnie.'],
      ['Kiedy szukać pomocy?', 'Gdy występują napady jedzenia, utrata kontroli, ukrywanie, wymioty, silne cierpienie albo problem zakłóca zdrowie i codzienne życie.']
    ],
    sources: [
      ['Hall i wsp. — ultra-processed diets, randomized controlled trial', 'https://pubmed.ncbi.nlm.nih.gov/31105044/'],
      ['BMJ — social, clinical and policy implications of UPF addiction', 'https://www.bmj.com/content/383/bmj-2023-075354'],
      ['BMJ Open — UPF, eating disorders and food addiction, systematic review', 'https://bmjopen.bmj.com/content/14/12/e091223'],
      ['BMJ — exposure to ultra-processed food and health outcomes, umbrella review', 'https://www.bmj.com/content/384/bmj-2023-077310']
    ]
  }
];

for (const article of remainingArticles) {
  const filePath = path.join(ROOT, article.file);
  let html = fs.readFileSync(filePath, 'utf8');
  const hub = (html.match(/<p class="topic-hub-backlink">[\s\S]*?<\/p>/) || [''])[0];
  const share = (html.match(/<section class="share-article-section reveal"[\s\S]*?<\/section>/) || [''])[0];
  html = updateJsonLd(html, article);
  html = updateMeta(html, article);
  const replacement = `${renderBody(article, hub, share)}</div></main><section class="reading-room`;
  const bodyPattern = /<article class="article-content">[\s\S]*?<\/article>\s*<\/div>\s*<\/main>\s*<section class="reading-room/;
  if (!bodyPattern.test(html)) throw new Error(`Nie znaleziono treści artykułu: ${article.file}`);
  html = html.replace(bodyPattern, replacement);
  fs.writeFileSync(filePath, html);
  console.log(`[BATCH-3] repaired ${article.file}`);
}
