#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const MODIFIED = '2026-08-23T20:45:00+02:00';

const articles = [
  {
    file: 'trening-maszynowy-po-50.html',
    title: 'Trening na maszynach po 50-tce: plan na 30 dni',
    h1: 'Trening na maszynach po 50-tce: bezpieczny plan na 30 dni',
    description: 'Trening na maszynach po 50-tce może być dobrym startem. Poznaj plan na 30 dni, dobór ciężaru, progresję oraz moment przejścia do wolnych ciężarów.',
    quick: 'Maszyny są dobrym narzędziem startowym, bo prowadzą tor ruchu i ułatwiają zmianę obciążenia, ale nie są automatycznie bezpieczne dla każdego stawu. Przez pierwsze 30 dni wykonuj dwa treningi całego ciała tygodniowo, zostawiaj 2–3 powtórzenia w zapasie i zwiększaj ciężar dopiero po dwóch technicznie równych sesjach.',
    takeaways: ['Maszyna musi być ustawiona do budowy ciała; fabryczny tor ruchu nie pasuje każdemu.', 'Dwa treningi tygodniowo spełniają minimalne zalecenie WHO dotyczące wzmacniania mięśni.', 'Ciężar rośnie dopiero wtedy, gdy zakres i tempo pozostają kontrolowane.', 'Wolne ciężary nie są obowiązkowym kolejnym etapem, lecz mogą uzupełniać koordynację.'],
    sections: [
      ['Czy maszyny są bezpieczniejsze od wolnych ciężarów?', 'Maszyna stabilizuje część ruchu i ułatwia naukę dozowania wysiłku, dlatego początkujący może skupić się na ustawieniu, oddechu i tempie. Nie usuwa jednak ryzyka: źle ustawione siedzisko, zbyt duży zakres albo ciężar mogą prowokować ból tak samo jak hantel.', 'Jeżeli zaczynasz po długiej przerwie, przeczytaj najpierw <a href="jak-zaczac-na-silowni-po-50.html">jak zacząć na siłowni po 50-tce</a>. Przy bólu zmniejsz zakres lub wybierz inną maszynę zamiast dopasowywać ciało siłą do urządzenia.'],
      ['Jak ustawić pierwsze dwa tygodnie?', 'Wybierz pięć lub sześć ruchów obejmujących nogi, przyciąganie, wypychanie i biodra. Wykonaj jedną albo dwie serie po 8–12 spokojnych powtórzeń, kończąc z wyraźnym zapasem. Dwa niekolejne dni dają czas na ocenę reakcji mięśni i stawów.', 'Gotowy szkielet ruchów znajdziesz w <a href="centrum-treningu-silowego-po-50.html">Centrum Treningu Siłowego</a>. Zapisz ustawienie siedziska i ciężar; dzięki temu kolejna sesja jest porównywalna, a progresja nie zależy od pamięci.'],
      ['Kiedy zwiększyć ciężar od trzeciego tygodnia?', 'Jeśli w dwóch kolejnych treningach wykonujesz górny zakres powtórzeń z równym tempem, bez skracania ruchu i z zapasem, podnieś obciążenie o najmniejszy dostępny stopień. Po zmianie wróć do dolnej granicy powtórzeń i ponownie obserwuj technikę.', 'Nie zwiększaj równocześnie liczby serii, ciężaru i częstotliwości. Zasady progresji oraz objawy przeciążenia opisuje artykuł o <a href="bledy-50.html">błędach treningowych po 50-tce</a>.'],
      ['Czy po 30 dniach trzeba przejść na wolne ciężary?', 'Nie. Maszyny mogą pozostać podstawą programu, jeśli pozwalają trenować bez bólu i stopniowo zwiększać wysiłek. Hantle, gumy i ćwiczenia z masą ciała warto dodawać dla kontroli ruchu, chwytu i zadań, których dana maszyna nie odwzorowuje.', 'Najlepszy program jest wystarczająco prosty, aby go utrzymać, i wystarczająco pełny, aby objąć główne grupy mięśni. Przykład połączenia metod zawiera <a href="powrot-do-formy-po-50-kompletny-przewodnik.html">plan powrotu do formy</a>.']
    ],
    callouts: ['Ustaw oś maszyny możliwie blisko osi pracującego stawu i zanotuj pozycję siedziska.', 'Przerwij serię przy ostrym bólu, zawrotach głowy, bólu w klatce lub nietypowej duszności.'],
    quote: 'Maszyna jest narzędziem do progresji, nie testem odwagi ani obowiązkowym etapem przed hantlami.',
    table: ['Plan treningu maszynowego na pierwsze 30 dni', ['Okres', 'Objętość', 'Główny cel'], [['Dni 1–14', '2 sesje; 1–2 serie po 8–12 powtórzeń', 'Ustawienia, zakres i zapas'], ['Dni 15–21', '2 sesje; ten sam zestaw ruchów', 'Powtarzalna technika'], ['Dni 22–30', 'Najmniejszy wzrost ciężaru po spełnieniu warunku', 'Pierwsza kontrolowana progresja'], ['Po 30 dniach', 'Ocena bólu, techniki i regularności', 'Decyzja o dalszym planie']]],
    faqs: [['Czy maszyny są dobre po 50-tce?', 'Tak, szczególnie na początku, jeśli są prawidłowo ustawione i pozwalają ćwiczyć bez bólu.'], ['Ile razy w tygodniu ćwiczyć?', 'Dwa niekolejne treningi całego ciała to rozsądny start i minimalna częstotliwość wzmacniania z zaleceń WHO.'], ['Jak dobrać pierwszy ciężar?', 'Wybierz taki, przy którym kończysz serię z zapasem 2–3 poprawnych powtórzeń bez skracania ruchu.'], ['Czy trzeba ćwiczyć do upadku?', 'Nie. Początkujący może skutecznie trenować z zapasem, co ułatwia utrzymanie techniki i regenerację.']],
    sources: [['WHO — zalecenia aktywności dla starszych osób', 'https://www.who.int/publications/i/item/9789240064096'], ['WHO — Guidelines on physical activity and sedentary behaviour', 'https://www.who.int/publications/i/item/9789240015128'], ['Resistance training prescription — network meta-analysis', 'https://pubmed.ncbi.nlm.nih.gov/37414459/'], ['Free weights versus machines — systematic review and meta-analysis', 'https://pubmed.ncbi.nlm.nih.gov/37582807/']]
  },
  {
    file: 'lpa-lipoproteina-a-po-50-norma-cena-badania.html',
    title: 'Lp(a) po 50-tce: wynik, progi i co dalej',
    h1: 'Lipoproteina(a) po 50-tce: jak czytać wynik badania Lp(a)?',
    description: 'Lp(a) jest głównie uwarunkowana genetycznie i uzupełnia ocenę ryzyka serca. Sprawdź progi mg/dl i nmol/l, pomiar raz w życiu oraz dalsze kroki u lekarza.',
    quick: 'Lp(a) jest cząstką lipoproteinową, której stężenie zależy głównie od genów i zwykle niewiele zmienia się przez styl życia. NLA zaleca oznaczenie co najmniej raz u każdego dorosłego; poniżej 75 nmol/l lub 30 mg/dl ryzyko uznaje się za niskie, a od 125 nmol/l lub 50 mg/dl za wysokie. Jednostek nie należy przeliczać stałym mnożnikiem.',
    takeaways: ['Lp(a) uzupełnia, a nie zastępuje LDL‑C, ApoB, ciśnienia, glukozy i wywiadu rodzinnego.', 'Pomiar raz w dorosłym życiu często wystarcza, lecz lekarz może zalecić powtórzenie w określonej sytuacji.', 'mg/dl i nmol/l opisują inne wielkości; stały przelicznik może dać błędny wynik.', 'Przy wysokiej Lp(a) najważniejsze jest intensywne ograniczanie całkowitego ryzyka sercowo‑naczyniowego.'],
    sections: [
      ['Czym Lp(a) różni się od LDL i ApoB?', 'Lp(a) przypomina cząstkę LDL, ale zawiera dodatkową apolipoproteinę(a). ApoB liczy liczbę aterogennych cząstek, LDL‑C opisuje cholesterol w ich części, a Lp(a) jest osobnym czynnikiem ryzyka. Jeden prawidłowy wynik nie unieważnia pozostałych.', 'Relację między cząstkami wyjaśnia artykuł <a href="apob-apoa-badania-cholesterol.html">o ApoB i ApoA1</a>.'],
      ['Jak interpretować progi w nmol/l i mg/dl?', 'Aktualizacja NLA określa poniżej 75 nmol/l lub 30 mg/dl jako niski poziom ryzyka, 75–125 nmol/l lub 30–50 mg/dl jako zakres pośredni, a co najmniej 125 nmol/l lub 50 mg/dl jako wysoki. To progi ryzyka, nie diagnoza zawału.', 'Nie przeliczaj wyniku z jednej jednostki do drugiej stałym mnożnikiem, ponieważ wielkość izoform apo(a) jest zmienna. Wynik omawiaj razem z <a href="apob-norma-cena-jak-czytac-wynik.html">ApoB i całym lipidogramem</a>.'],
      ['Czy Lp(a) wystarczy zbadać raz?', 'Ponieważ poziom jest głównie genetyczny i względnie stabilny, NLA zaleca co najmniej jeden pomiar u każdego dorosłego. Powtórzenie może być uzasadnione przy niepewnym wyniku, szczególnym stanie klinicznym lub leczeniu kierowanym na Lp(a), jeśli stanie się dostępne.', 'Rodzinny przedwczesny zawał lub bardzo wysoki wynik powinny skłonić do rozmowy o badaniu krewnych. Przygotuj dane zgodnie z <a href="badania-po-50.html">listą badań po 50-tce</a>.'],
      ['Co można zrobić przy wysokiej Lp(a)?', 'Styl życia zwykle nie obniża znacznie samej Lp(a), ale nadal ogranicza pozostałe składniki ryzyka. Lekarz ocenia LDL‑C lub ApoB, ciśnienie, palenie, cukrzycę i historię chorób, a następnie ustala intensywność leczenia. Nie ma jednego suplementu neutralizującego wynik.', 'Nie odstawiaj statyny dlatego, że nie obniża Lp(a); jej celem jest zmniejszenie ryzyka przez inne lipoproteiny. Fundamenty profilaktyki zawiera <a href="centrum-cholesterolu-po-50.html">Centrum Cholesterolu po 50-tce</a>.']
    ],
    callouts: ['Zapisz wynik dokładnie z jednostką; 120 mg/dl i 120 nmol/l nie oznaczają tego samego.', 'Wysoka Lp(a) jest sygnałem do pełniejszej kontroli ryzyka, a nie powodem do samodzielnego kupowania niacyny.'],
    quote: 'Lp(a) mówi o odziedziczonej części ryzyka; decyzje podejmuje się na podstawie całego profilu, nie jednej liczby.',
    table: ['Progi Lp(a) według aktualizacji NLA 2024', ['Kategoria', 'nmol/l', 'mg/dl'], [['Niskie ryzyko', 'Poniżej 75', 'Poniżej 30'], ['Pośrednie ryzyko', '75–124', '30–49'], ['Wysokie ryzyko', 'Co najmniej 125', 'Co najmniej 50'], ['Przeliczanie', 'Nie używaj stałego mnożnika', 'Zachowaj jednostkę laboratorium']]],
    faqs: [['Czy Lp(a) trzeba badać na czczo?', 'Samo Lp(a) zwykle nie wymaga bycia na czczo, ale inne zlecane jednocześnie badania mogą mieć własne zasady.'], ['Czy wysoka Lp(a) jest dziedziczna?', 'W dużej mierze tak, dlatego wysoki wynik lub przedwczesne choroby w rodzinie mogą uzasadniać badanie krewnych.'], ['Czy można przeliczyć mg/dl na nmol/l?', 'Nieprecyzyjnie. Ze względu na różne izoformy apo(a) nie zaleca się jednego stałego przelicznika.'], ['Czy dieta obniży Lp(a)?', 'Zwykle wpływ jest mały, ale dieta, ruch i niepalenie nadal zmniejszają pozostałe elementy całkowitego ryzyka.']],
    sources: [['NLA 2024 — focused update on Lp(a)', 'https://pubmed.ncbi.nlm.nih.gov/38565461/'], ['EAS consensus statement on lipoprotein(a)', 'https://pubmed.ncbi.nlm.nih.gov/36036785/'], ['ESC/EAS guidelines for dyslipidaemias', 'https://academic.oup.com/eurheartj/article/41/1/111/5556353'], ['AHA — Lipoprotein(a) scientific statement', 'https://pubmed.ncbi.nlm.nih.gov/34647487/']]
  },
  {
    file: 'ile-bialka-po-50-roku-zycia-zapotrzebowanie-odzywki.html',
    title: 'Ile białka po 50-tce? Dawki i przykłady',
    h1: 'Ile białka po 50-tce: zapotrzebowanie, posiłki i odżywka',
    description: 'Zdrowe starsze osoby często potrzebują 1,0–1,2 g białka/kg dziennie. Zobacz obliczenia, porcje w posiłkach, rolę WPC oraz wyjątki przy chorobach nerek.',
    quick: 'Eksperci ESPEN zalecają zdrowym starszym osobom zwykle co najmniej 1,0–1,2 g białka na kilogram masy ciała dziennie, razem z regularnym ruchem. Przy chorobie lub niedożywieniu cel bywa wyższy, ale przy przewlekłej chorobie nerek może wymagać innego ustalenia. Odżywka WPC jest wygodnym źródłem, a nie obowiązkowym suplementem.',
    takeaways: ['Zakres 1,0–1,2 g/kg dotyczy zdrowych starszych osób i nie jest automatyczną receptą dla każdego pięćdziesięciolatka.', 'Białko najlepiej rozłożyć między główne posiłki zamiast zostawiać większość na kolację.', 'WPC, WPI i zwykłe jedzenie dostarczają aminokwasów; wybór zależy od tolerancji i wygody.', 'Choroba nerek, niedożywienie lub znaczna otyłość wymagają indywidualnego sposobu liczenia.'],
    sections: [
      ['Jak obliczyć dzienną ilość białka?', 'Pomnóż odpowiednią masę ciała przez ustalony cel w gramach na kilogram. Dla osoby ważącej 70 kg zakres 1,0–1,2 g/kg daje 70–84 g dziennie. Przy dużej otyłości, obrzękach lub chorobie cel i masa odniesienia wymagają profesjonalnej korekty.', 'Wstępne obliczenie ułatwia <a href="kalkulator-bialka-po-50.html">kalkulator białka po 50-tce</a>, ale wynik nie zastępuje zaleceń klinicznych.'],
      ['Jak rozłożyć białko między posiłki?', 'Mięśnie reagują na porcję aminokwasów oraz trening, dlatego praktycznie warto umieścić wyraźne źródło białka w każdym głównym posiłku. Nie trzeba ważyć jedzenia zawsze; kilka dni zapisu pokazuje, czy śniadanie i obiad nie są prawie bezbiałkowe.', 'Jaja, nabiał, ryby, mięso, tofu i strączki można mieszać według preferencji. Przykładowy talerz zawiera artykuł <a href="dieta-po-50.html">o diecie po 50-tce</a>.'],
      ['Czy WPC lub WPI jest konieczne?', 'Nie. Koncentrat WPC jest zwykle tańszy i zawiera więcej laktozy, a izolat WPI ma wyższy udział białka oraz mniej laktozy i tłuszczu. Różnica nie czyni izolatu automatycznie skuteczniejszym, jeśli oba produkty pomagają pokryć ten sam dobowy cel.', 'Przy nietolerancji można wybrać WPI albo źródło roślinne; przy alergii na białka mleka samo zmniejszenie laktozy nie wystarcza. Łączenie suplementów omawia <a href="kreatyna-i-bialko-po-50-tce-jak-laczyc.html">poradnik kreatyny i białka</a>.'],
      ['Kiedy większa ilość białka wymaga konsultacji?', 'Przewlekła choroba nerek, zalecone ograniczenie białka, nieprawidłowy eGFR, choroba wątroby lub znaczne niedożywienie wymagają indywidualnego planu. Nie należy samodzielnie podwajać podaży po jednym materiale internetowym ani odstawiać białka ze strachu przed zdrowymi nerkami.', 'Zbierz wyniki, leki i typowy jadłospis przed konsultacją. Parametry do omówienia opisuje <a href="badania-krwi-po-50-jak-czesto.html">artykuł o badaniach krwi</a>.']
    ],
    callouts: ['70 kg × 1,0–1,2 g/kg to 70–84 g białka dziennie — przed korektą wyników o stan zdrowia.', 'Alergia na białka mleka i nietolerancja laktozy to różne problemy; WPI nie rozwiązuje automatycznie alergii.'],
    quote: 'Odżywka ma uzupełnić policzoną lukę, a nie zastąpić cały posiłek i decyzję o indywidualnym celu.',
    table: ['Przykładowe źródła około 20–30 g białka', ['Produkt', 'Przykładowa porcja', 'Uwaga'], [['Skyr lub gęsty jogurt', 'Sprawdź etykietę; zwykle duże opakowanie', 'Zawartość różni się między markami'], ['Jaja plus nabiał', 'Zestaw produktów w jednym posiłku', 'Liczy się suma składników'], ['Ryba, mięso lub tofu', 'Porcja obiadowa zależna od produktu', 'Masa po obróbce zmienia się'], ['WPC lub WPI', 'Porcja z etykiety dająca 20–25 g białka', 'Nie zawsze jedna miarka']]],
    faqs: [['Ile białka dziennie po 50-tce?', 'Zdrowym starszym osobom ESPEN zaleca zwykle co najmniej 1,0–1,2 g/kg dziennie; cel zależy od zdrowia i aktywności.'], ['Czy odżywka białkowa niszczy nerki?', 'Typowa ilość nie jest automatycznie szkodliwa dla zdrowych nerek, ale choroba nerek wymaga indywidualnego planu.'], ['WPC czy WPI po 50-tce?', 'WPC zwykle wystarcza; WPI może pomóc przy gorszej tolerancji laktozy lub gdy liczy się wyższy udział białka.'], ['Czy całe białko można zjeść wieczorem?', 'Lepiej rozłożyć źródła między główne posiłki, zwłaszcza gdy celem jest wspieranie mięśni i sytości.']],
    sources: [['ESPEN Expert Group — protein and exercise with aging', 'https://pubmed.ncbi.nlm.nih.gov/24814383/'], ['PROT-AGE Study Group — protein needs in older people', 'https://pubmed.ncbi.nlm.nih.gov/23867520/'], ['ESPEN guideline on clinical nutrition and hydration in geriatrics', 'https://pubmed.ncbi.nlm.nih.gov/30005900/'], ['WHO — healthy diet', 'https://www.who.int/news-room/fact-sheets/detail/healthy-diet']]
  },
  {
    file: 'terapia-swiatlem-czerwonym-rlt-starzenie-komorek.html',
    title: 'Światło czerwone RLT po 50-tce: dowody i ryzyko',
    h1: 'Terapia światłem czerwonym po 50-tce: co potwierdzają badania?',
    description: 'Terapia czerwonym światłem nie cofa wieku komórek. Sprawdź dowody dla skóry i bólu, znaczenie dawki, ochronę oczu oraz ograniczenia domowych lamp RLT.',
    quick: 'Po 50-tce fotobiomodulacja wykorzystuje czerwone lub bliskie podczerwieni światło o określonej długości fali i dawce. Ma wiarygodniejsze dane dla wybranych wskazań niż dla ogólnego „odmładzania”, a protokoły bardzo się różnią. Małe badania sugerują poprawę części parametrów skóry, lecz domowa lampa nie ma potwierdzenia cofania wieku biologicznego ani leczenia wielu chorób naraz.',
    takeaways: ['Nazwa RLT nie określa dawki; liczą się długość fali, irradiancja, czas, odległość i obszar.', 'Wynik dla jednej choroby lub urządzenia nie przechodzi automatycznie na każdą lampę domową.', 'Dowody dla wielu zastosowań są niskiej lub bardzo niskiej pewności z powodu małych badań.', 'Oczy, leki fotouczulające, choroby skóry i podejrzane zmiany wymagają szczególnej ostrożności.'],
    sections: [
      ['Jak działa fotobiomodulacja i co oznacza dawka?', 'Światło pada na tkankę i może zmieniać aktywność cząsteczek pochłaniających fotony, lecz efekt zależy od parametrów oraz tkanki. Sama moc urządzenia nie wystarcza do porównania: potrzebne są długość fali, irradiancja, czas, odległość i energia na powierzchnię.', 'Marketingową obietnicę warto oceniać tak samo jak inne preparaty w <a href="suplementacja-po-50.html">poradniku o dowodach i suplementacji</a>.'],
      ['Czy czerwone światło odmładza skórę?', 'Niewielkie randomizowane badania wykazały poprawę wybranych pomiarów zmarszczek po określonych protokołach LED. Nie dowodzi to cofnięcia wieku komórek, trwałego efektu ani skuteczności dowolnej maski. Wynik subiektywny i pomiar repliki skóry również nie są tym samym.', 'Podstawą ochrony przed fotostarzeniem pozostaje ograniczanie nadmiernego UV. Skład i obietnice produktów można analizować z <a href="jak-czytac-etykiety-sklad-produktow-e-numery-inci.html">przewodnikiem po etykietach</a>.'],
      ['Co wiadomo o bólu, regeneracji i innych chorobach?', 'Przegląd parasolowy wykazał umiarkowaną pewność dla części wyników, między innymi niepełnosprawności w chorobie zwyrodnieniowej kolana, lecz dla wielu innych zastosowań pewność była niska. Nie można więc oferować jednej lampy jako terapii mózgu, stawów, mięśni i skóry.', 'Ból stawu nadal wymaga rozpoznania i właściwego ruchu. Bezpieczny kontekst daje artykuł <a href="mobilnosc-vs-rozciaganie-program-dla-stawow-po-piecdziesiatce.html">o mobilności i rozciąganiu</a>.'],
      ['Jak bezpiecznie ocenić urządzenie domowe?', 'Sprawdź instrukcję, parametry, ostrzeżenia, status regulacyjny i ochronę oczu właściwą dla urządzenia. Nie patrz bezpośrednio w źródło. Leki fotouczulające, choroby siatkówki, aktywne choroby skóry lub podejrzana zmiana wymagają konsultacji przed naświetlaniem.', 'Zacznij od protokołu producenta zamiast samodzielnie zwielokrotniać czas. Jeśli celem jest regeneracja po wysiłku, najpierw uporządkuj <a href="sen-po-50.html">sen i podstawy regeneracji</a>.']
    ],
    callouts: ['Bez długości fali, irradiancji i odległości hasło „moc 300 W” nie pozwala odtworzyć dawki dla skóry.', 'Nie naświetlaj podejrzanej zmiany skórnej zamiast pokazać jej dermatologowi.'],
    quote: 'RLT może być narzędziem dla konkretnego celu, ale nie jest uniwersalnym resetem mitochondriów ani wieku.',
    table: ['Jak ocenić obietnicę RLT?', ['Pytanie', 'Dobra informacja', 'Sygnał ostrzegawczy'], [['Jaki cel?', 'Konkretny wynik kliniczny', '„Odmładza całe ciało”'], ['Jaka dawka?', 'Fala, irradiancja, czas i odległość', 'Tylko waty urządzenia'], ['Jakie badanie?', 'Porównanie z sham dla podobnej lampy', 'Wynik na komórkach lub zwierzętach'], ['Jakie bezpieczeństwo?', 'Instrukcja, oczy i przeciwwskazania', '„Brak ryzyka dla każdego”']]],
    faqs: [['Czy RLT cofa starzenie komórek?', 'Nie ma klinicznego dowodu, że domowa terapia cofa wiek biologiczny lub odmładza cały organizm.'], ['Czy czerwone światło poprawia zmarszczki?', 'Małe badania określonych protokołów pokazują poprawę części pomiarów, ale nie potwierdzają każdej lampy i trwałego efektu.'], ['Czy trzeba chronić oczy?', 'Należy przestrzegać instrukcji konkretnego urządzenia i nie patrzeć bezpośrednio w źródło; przy chorobach oczu potrzebna jest konsultacja.'], ['Czy dłuższa sesja działa lepiej?', 'Nie można tego założyć. W fotobiomodulacji dawka ma znaczenie, a więcej nie musi oznaczać lepiej.']],
    sources: [['Umbrella review of photobiomodulation RCTs', 'https://pubmed.ncbi.nlm.nih.gov/40770824/'], ['Photobiomodulation in older adults — systematic review', 'https://pubmed.ncbi.nlm.nih.gov/39061982/'], ['660 nm LED for facial wrinkles — randomized trial', 'https://pubmed.ncbi.nlm.nih.gov/28195844/'], ['Home-use photobiomodulation devices — systematic review', 'https://pubmed.ncbi.nlm.nih.gov/30418078/']]
  },
  {
    file: 'kawa-jako-preworkout-po-50.html',
    title: 'Kawa przed treningiem po 50-tce: dawka i ryzyko',
    h1: 'Kawa przed treningiem po 50-tce: kiedy pomaga, a kiedy szkodzi?',
    description: 'Kofeina może poprawić część wyników treningowych, ale kawa ma zmienną dawkę. Sprawdź porę, ilość, wpływ na sen, ciśnienie oraz przeciwwskazania po 50-tce.',
    quick: 'Kofeina może poprawić czujność i część wyników wytrzymałościowych lub siłowych, ale reakcja jest indywidualna. W badaniach sportowych często działa 3–6 mg/kg, jednak przed pierwszym testem rozsądniej użyć znanej małej dawki. EFSA uznaje do 200 mg jednorazowo i 400 mg dziennie za bezpieczne dla zdrowych dorosłych, nie dla każdego pacjenta.',
    takeaways: ['Zawartość kofeiny w filiżance zależy od ziaren, objętości i sposobu parzenia.', 'Najmniejsza skuteczna dawka jest lepszym startem niż kopiowanie 6 mg/kg z badań sportowców.', 'Nawet 100 mg blisko wieczora może pogarszać sen u części osób.', 'Kołatanie, niekontrolowane ciśnienie, refluks i interakcje z lekami wymagają ostrożności.'],
    sections: [
      ['Czy kawa rzeczywiście poprawia trening?', 'Stanowisko ISSN wskazuje, że kofeina może poprawiać wiele aspektów wydolności, najspójniej wytrzymałość tlenową, a u części osób także siłę, szybkość i czujność. Efekt różni się między ludźmi, więc brak poprawy po kawie nie jest oznaką źle wykonanego treningu.', 'Kofeina nie zastępuje programu ani rozgrzewki. Podstawy sesji zawiera <a href="trening-maszynowy-po-50.html">plan treningu na maszynach po 50-tce</a>.'],
      ['Ile kofeiny wypić przed wysiłkiem?', 'W badaniach często stosuje się 3–6 mg/kg około 60 minut przed wysiłkiem, ale kawa nie ma laboratoryjnie stałej zawartości. Osoba początkująca powinna zacząć od znanej mniejszej ilości i ocenić tętno, żołądek, niepokój oraz sen.', 'Nie łącz kilku przedtreningówek, kawy i napojów energetycznych bez zsumowania kofeiny. Krytyczne czytanie składu opisuje <a href="jak-czytac-etykiety-sklad-produktow-e-numery-inci.html">przewodnik po etykietach</a>.'],
      ['Dlaczego pora kawy ma znaczenie?', 'Kofeina działa przez wiele godzin, a EFSA wskazuje, że nawet 100 mg blisko pory snu może wpływać na jego długość i przebieg. Poprawa jednego wieczornego treningu nie rekompensuje regularnego pogarszania regeneracji, apetytu i ciśnienia przez niedosypianie.', 'Jeżeli ćwiczysz późno, porównaj trening z kawą i bez niej oraz obserwuj zasypianie. Znaczenie regeneracji wyjaśnia <a href="sen-po-50.html">poradnik snu po 50-tce</a>.'],
      ['Kto powinien zachować szczególną ostrożność?', 'Kofeina może nasilać kołatanie, lęk, drżenie, refluks i przejściowo podnosić ciśnienie. Indywidualnej oceny wymagają arytmie, niekontrolowane nadciśnienie, ciąża, częste napady paniki oraz leki wpływające na metabolizm kofeiny lub układ krążenia.', 'Przerwij wysiłek przy bólu w klatce, omdleniu lub nietypowej duszności. Kontrolę ciśnienia po 50-tce omawia <a href="centrum-nadcisnienia-po-50.html">Centrum Nadciśnienia</a>.']
    ],
    callouts: ['Najpierw sprawdź łączną kofeinę z kawy, herbaty, coli, energetyka i przedtreningówki.', 'Jeśli wieczorna kawa skraca sen, bilans dla formy może być ujemny mimo lepszego pojedynczego treningu.'],
    quote: 'Kawa jest opcjonalnym narzędziem, nie warunkiem dobrego treningu ani sposobem na ukrycie niewyspania.',
    table: ['Kofeina przed treningiem — liczby i ich granice', ['Wartość', 'Co oznacza?', 'Zastrzeżenie'], [['Do 200 mg jednorazowo', 'Poziom bez obaw EFSA dla zdrowych dorosłych', 'Nie obejmuje każdej choroby i nadwrażliwości'], ['Do 400 mg dziennie', 'Suma bez obaw dla zdrowych dorosłych', 'Trzeba zliczyć wszystkie źródła'], ['3–6 mg/kg', 'Częsty zakres badań sportowych', 'Nie jest obowiązkową dawką startową'], ['100 mg wieczorem', 'Może wpływać na sen', 'Reakcja i pora są indywidualne']]],
    faqs: [['Ile przed treningiem wypić kawy?', 'Zawartość filiżanki jest zmienna. Zacznij od małej znanej dawki zamiast automatycznie stosować górny zakres z badań.'], ['Kiedy wypić kawę przed treningiem?', 'Badania często podają około 60 minut, ale napój może działać wcześniej lub później zależnie od osoby i posiłku.'], ['Czy kawa spala tłuszcz?', 'Może zwiększać chwilowy wydatek lub wykorzystanie paliwa, lecz nie powoduje trwałej redukcji bez całego bilansu energii.'], ['Czy kawa jest bezpieczna przy nadciśnieniu?', 'Reakcja ciśnienia jest indywidualna; przy niekontrolowanym nadciśnieniu lub objawach dawkę należy omówić z lekarzem.']],
    sources: [['ISSN — caffeine and exercise performance', 'https://pubmed.ncbi.nlm.nih.gov/33388079/'], ['EFSA — caffeine safety', 'https://www.efsa.europa.eu/en/topics/topic/caffeine'], ['EFSA Scientific Opinion on caffeine safety', 'https://www.efsa.europa.eu/sites/default/files/consultation/150115.pdf'], ['FDA — caffeine information for adults', 'https://www.fda.gov/consumers/consumer-updates/spilling-beans-how-much-caffeine-too-much']]
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
    if (data['@type'] === 'FAQPage') data.mainEntity = article.faqs.map(([name, answer]) => ({ '@type': 'Question', name, acceptedAnswer: { '@type': 'Answer', text: answer } }));
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
  html = html.replace(/(<meta property="og:image" content="[^"]+)\.webp(">)/, '$1.jpg$2');
  html = html.replace(/(<meta name="twitter:image" content="[^"]+)\.webp(">)/, '$1.jpg$2');
  if (article.file === 'kawa-jako-preworkout-po-50.html') {
    html = html.replace('<img src="./assets/kawa_preworkout_hero.webp"', '<img src="./assets/kawa_preworkout_hero.jpg"');
  }
  return html;
}

function addImageDimensions(html) {
  const exact = {
    'logo-fitpo50.png': [256, 249],
    'maszyny_1_chest_press_1774368225570.webp': [640, 640],
    'bieznia-za-malo-hero.jpg': [2200, 1200],
    'peptydy-lancuch-aminokwasow-molekularny-hero.jpg': [1080, 589],
    'waty-trening-apple-watch-hero.jpg': [1080, 589],
    'etykiety-sklad-produktow-lupa-hero.jpg': [1080, 589],
    'rtg-mri-ct-badania-obrazowe-porownanie-hero.jpg': [1080, 589],
    'trening-silowy-hormony-50-hero.jpg': [1080, 589],
    'interleukina-6-hero.jpg': [1080, 589],
    'regeneracja-ukladu-nerwowego-hero.jpg': [1080, 589],
    'brzuch-to-nie-woda-hero.jpg': [1080, 589],
    'hero-szczepionki-covid-fakty-mity.jpg': [1080, 589],
    'tluszcz-energia-metabolizm-hero.jpg': [1080, 589],
    'lpa-para-50-plus-poranne-swiatlo.jpg': [1080, 589],
    'hero-bialko-po-50-fitpo50.jpg': [1080, 589],
    'zakwas-chleb-hero.jpg': [1080, 589],
    'dieta-przeciwzapalna-hero.jpg': [1080, 589],
    'oponka-brzuszna-hero.jpg': [1080, 589],
    'rlt-hero-swiatlo-czerwone-kobieta.jpg': [1080, 589],
    'badania-krwi-po-50-hero.jpg': [1080, 589],
    'silownia-serce-ochrona-hero.jpg': [1080, 589],
    'keto-cholesterol-hero.jpg': [1080, 589]
    ,'bledy-hero.jpg': [1600, 893]
    ,'poczatek-hero.jpg': [1600, 893]
    ,'dieta-hero.jpg': [1600, 893]
    ,'jedz-wiecej-hero.jpg': [1600, 893]
  };
  return html.replace(/<img\b([^>]*?)>/g, (whole, attrs) => {
    const src = (attrs.match(/src="[^"]+\/([^/"]+)"/) || [])[1];
    const [width, height] = exact[src] || [1080, 603];
    let next = attrs.replace(/\s+width="\d+"/g, '').replace(/\s+height="\d+"/g, '').replace(/\s*\/?$/, '');
    return `<img${next} width="${width}" height="${height}">`;
  });
}

function normalizePdfSafeGlyphs(html) {
  return html.replace(/‑/g, '-').replace(/₂/g, '2');
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
  html = addImageDimensions(html);
  html = normalizePdfSafeGlyphs(html);
  fs.writeFileSync(filePath, html);
  console.log(`[BATCH-4] repaired ${article.file}`);
}
const moreArticles = [
  {
    file: 'rentgen-tomografia-ct-rezonans-mri-roznice-badania.html',
    title: 'RTG, CT czy MRI po 50-tce: różnice i ryzyko',
    h1: 'RTG, tomografia czy rezonans po 50-tce: co pokazują badania?',
    description: 'RTG i tomografia używają promieniowania, a rezonans pola magnetycznego. Porównaj zastosowania, kontrast, ryzyko oraz przygotowanie do RTG, CT i MRI.',
    quick: 'Po 50-tce RTG tworzy pojedynczy obraz z użyciem promieniowania rentgenowskiego, CT składa wiele projekcji w przekroje, a MRI wykorzystuje silne pole magnetyczne i fale radiowe, bez promieniowania jonizującego. Nie istnieje jedno „najlepsze” badanie obrazowe: lekarz dobiera metodę do narządu, pytania klinicznego, czasu, implantów, nerek oraz potrzeby kontrastu.',
    takeaways: ['RTG i CT używają promieniowania jonizującego; MRI go nie używa.', 'CT zwykle daje większą dawkę niż zwykłe zdjęcie RTG, ale zakres zależy od badania.', 'Kontrast jodowy i gadolinowy to różne środki o różnych przeciwwskazaniach.', 'MRI wymaga dokładnego zgłoszenia implantów, odłamków metalu i urządzeń elektronicznych.'],
    sections: [
      ['Jak powstaje obraz RTG, CT i MRI?', 'W radiografii wiązka promieniowania przechodzi przez ciało i tworzy pojedynczy obraz. Tomografia również używa promieni X, lecz rejestruje wiele projekcji i rekonstruuje przekroje. Rezonans wykorzystuje pole magnetyczne oraz fale radiowe do oceny sygnału tkanek.', 'Wybór nie jest konkursem rozdzielczości. Kontekst podstawowych badań opisuje <a href="badania-po-50.html">przewodnik badań po 50-tce</a>, a granice nowych narzędzi diagnostycznych artykuł <a href="ai-w-medycynie-czy-naprawde-pomaga-pacjentom-fakty-badania.html">o AI w medycynie</a>.'],
      ['Kiedy częściej wybiera się RTG lub CT?', 'RTG dobrze odpowiada na część pytań dotyczących kości i klatki piersiowej. CT jest szybkie i szczegółowe, dlatego często służy do oceny urazów, płuc, krwawienia lub narządów jamy brzusznej. Konkretne wskazanie określa lekarz i protokół pracowni.', 'Dawki nie należy porównywać bez nazwy badania i obszaru. Jeśli diagnostyka dotyczy stawów po wysiłku, zobacz także <a href="bieganie-niszczy-kolana.html">co naprawdę wiadomo o bólu kolan</a>.'],
      ['Kiedy MRI ma przewagę i jakie ma ograniczenia?', 'MRI szczególnie dobrze różnicuje wiele tkanek miękkich, mózg, rdzeń, więzadła i część narządów. Badanie trwa dłużej, jest głośne i wymaga pozostania bez ruchu. Nie każdy implant wyklucza MRI, ale jego model oraz warunki bezpieczeństwa muszą być sprawdzone.', 'Klaustrofobię i trudność leżenia warto zgłosić przed terminem. Nie wolno ukrywać metalu ani urządzeń wszczepionych; podobną zasadę przygotowania omawia <a href="badania-krwi-po-50-jak-czesto.html">poradnik badań kontrolnych</a>.'],
      ['Co trzeba wiedzieć o kontraście?', 'W CT stosuje się zwykle kontrast jodowy, a w MRI środki zawierające gadolin. Przed podaniem zespół pyta między innymi o wcześniejsze reakcje, choroby nerek i inne czynniki ryzyka. Brak kontrastu może ograniczyć odpowiedź, ale nie każde badanie go wymaga.', 'Nie odstawiaj leków ani nie rezygnuj z nawodnienia na podstawie internetowej listy. Instrukcję pracowni i skierowanie traktuj jako źródło dla konkretnego protokołu; pełną historię zdrowia przygotuj zgodnie z <a href="badania-po-50.html">listą badań po 50-tce</a>.']
    ],
    callouts: ['Zapytaj nie „które badanie jest najlepsze?”, lecz „na jakie pytanie ma odpowiedzieć obraz?”.', 'Przed MRI podaj dokładny model implantu lub urządzenia; sama pamięć, że jest „metalowe”, nie wystarcza.'],
    quote: 'Najbezpieczniejsze badanie to takie, które odpowiada na właściwe pytanie przy najmniejszym rozsądnym ryzyku.',
    table: ['RTG, CT i MRI — najważniejsze różnice', ['Cecha', 'RTG', 'CT', 'MRI'], [['Technologia', 'Promieniowanie X', 'Promieniowanie X i rekonstrukcja', 'Pole magnetyczne i fale radiowe'], ['Typ obrazu', 'Zwykle projekcja 2D', 'Przekroje', 'Przekroje o wysokim kontraście tkanek'], ['Czas', 'Krótki', 'Zwykle krótki', 'Zwykle dłuższy'], ['Główna kontrola', 'Ciąża i zakres', 'Dawka, nerki, kontrast', 'Implanty, metal, kontrast']]],
    faqs: [['Czy rezonans promieniuje?', 'Nie używa promieniowania jonizującego; wykorzystuje silne pole magnetyczne i fale radiowe.'], ['Czy CT ma większą dawkę niż RTG?', 'Zwykle tak, ponieważ wykorzystuje wiele projekcji, ale rzeczywista dawka zależy od obszaru i protokołu.'], ['Czy każdy implant wyklucza MRI?', 'Nie. Trzeba sprawdzić dokładny model i warunki producenta z pracownią MRI.'], ['Czy kontrast jest zawsze potrzebny?', 'Nie. Decyzja zależy od pytania klinicznego i protokołu; kontrast może ujawnić informacje niewidoczne bez niego.']],
    sources: [['FDA — Medical X-ray Imaging', 'https://www.fda.gov/radiation-emitting-products/medical-imaging/medical-x-ray-imaging'], ['FDA — MRI safety', 'https://www.fda.gov/radiation-emitting-products/mri-magnetic-resonance-imaging/benefits-and-risks'], ['RadiologyInfo — contrast materials', 'https://www.radiologyinfo.org/en/info/safety-contrast'], ['RadiologyInfo — radiation dose in X-ray and CT', 'https://www.radiologyinfo.org/en/info/safety-xray']]
  },
  {
    file: 'interleukina-6-il-6-badanie-normy-cena.html',
    title: 'IL-6: badanie, wynik i zakres referencyjny',
    h1: 'Interleukina 6 (IL‑6): kiedy badać i jak rozumieć wynik?',
    description: 'Badanie IL-6 nie jest samodzielnym testem na wszystkie stany zapalne. Sprawdź wskazania, zakres laboratorium, wpływ wysiłku i sposób interpretacji wyniku.',
    quick: 'IL‑6 jest cytokiną uczestniczącą w odpowiedzi odpornościowej i metabolizmie. Jej stężenie może wzrastać w infekcji, urazie, chorobach zapalnych i po długim intensywnym wysiłku, dlatego pojedynczy wynik nie wskazuje jednej przyczyny. Nie istnieje uniwersalna norma dla wszystkich metod; wynik trzeba odnieść do zakresu laboratorium, objawów i innych badań.',
    takeaways: ['IL‑6 nie jest przesiewowym testem „wieku zapalnego” ani diagnozą konkretnej choroby.', 'Zakres referencyjny zależy od metody, materiału i laboratorium.', 'Przejściowy wzrost po wysiłku różni się kontekstem od przewlekle podwyższonego stężenia.', 'Cena i dostępność zmieniają się, dlatego należy sprawdzać aktualny cennik konkretnego laboratorium.'],
    sections: [
      ['Czym jest IL‑6 i dlaczego nie jest tylko „zła”?', 'Interleukina 6 działa w wielu szlakach odpornościowych i metabolicznych. Jej efekt zależy od miejsca, czasu, stężenia i sposobu sygnalizacji. Przewlekłe podwyższenie może towarzyszyć chorobie, a krótkotrwały wzrost podczas wysiłku jest elementem fizjologicznej odpowiedzi mięśni.', 'Nie należy zatem sprowadzać wyniku do jednego hasła „stan zapalny”. Podstawowy kontekst dają artykuły <a href="badania-krwi-po-50-jak-czesto.html">jak często robić badania krwi</a> oraz <a href="centrum-metabolizmu-po-50.html">Centrum Metabolizmu</a>.'],
      ['Kiedy lekarz może zlecić badanie IL‑6?', 'Badanie bywa używane w wybranych sytuacjach klinicznych i specjalistycznych, gdy wynik może uzupełnić ocenę odpowiedzi zapalnej. Nie zastępuje wywiadu, badania fizykalnego ani częściej stosowanych markerów. Wskazanie powinno wyjaśniać, jaka decyzja zależy od wyniku.', 'Kupowanie testu bez pytania klinicznego zwiększa ryzyko nadinterpretacji. Przygotowanie listy objawów i leków ułatwia <a href="badania-po-50.html">przewodnik badań po 50-tce</a>.'],
      ['Jak czytać wynik i zakres referencyjny?', 'Najpierw sprawdź jednostkę, metodę i zakres podany przez laboratorium. Wynik z innej placówki może nie być bezpośrednio porównywalny. Interpretacja obejmuje czas pobrania, infekcję, leki, choroby przewlekłe oraz niedawny wysiłek, a nie tylko pozycję przy strzałce.', 'Nie przeliczaj wartości na „procent zapalenia” ani ryzyko jednej choroby. Szerszą ocenę metaboliczną omawia <a href="badania-po-50.html">lista badań po 50-tce</a>.'],
      ['Czy ruch obniża czy podnosi IL‑6?', 'Długi lub intensywny wysiłek może przejściowo zwiększyć IL‑6 uwalnianą między innymi przez pracujące mięśnie. Regularny trening może z kolei obniżać część markerów przewlekłego zapalenia. Te dwa zjawiska nie są sprzeczne, ponieważ różnią się czasem i kontekstem.', 'Przed badaniem wykonaj instrukcje laboratorium i poinformuj lekarza o dużym wysiłku. Bezpieczny sposób zwiększania aktywności opisuje <a href="trening-3x30-dla-50-plus.html">plan 3×30 po 50-tce</a>.']
    ],
    callouts: ['Zakres z wydruku laboratorium ma pierwszeństwo przed „normą” znalezioną w przypadkowej tabeli.', 'Pojedynczy wynik IL‑6 bez objawów i kontekstu nie wyznacza leczenia ani diety przeciwzapalnej.'],
    quote: 'Wartość IL‑6 jest informacją w kontekście klinicznym, a nie samodzielną nazwą choroby.',
    table: ['Co może zmieniać wynik IL‑6?', ['Czynnik', 'Możliwy wpływ', 'Co przekazać lekarzowi?'], [['Ostra infekcja lub uraz', 'Wzrost odpowiedzi zapalnej', 'Objawy i czas ich początku'], ['Intensywny wysiłek', 'Przejściowy wzrost', 'Rodzaj i czas treningu'], ['Leki i leczenie', 'Zmiana odpowiedzi immunologicznej', 'Pełna lista preparatów'], ['Metoda laboratorium', 'Inny zakres i granica oznaczalności', 'Jednostka oraz zakres z wyniku']]],
    faqs: [['Jaka jest norma IL‑6?', 'Nie ma jednej wartości dla wszystkich metod. Należy użyć zakresu referencyjnego podanego przez wykonujące badanie laboratorium.'], ['Czy wysoka IL‑6 oznacza nowotwór?', 'Nie. Wzrost ma wiele możliwych przyczyn i sam nie rozpoznaje nowotworu ani innej konkretnej choroby.'], ['Czy trening podnosi IL‑6?', 'Intensywny lub długi wysiłek może przejściowo zwiększyć IL‑6, co nie jest tym samym co przewlekłe zapalenie.'], ['Ile kosztuje badanie IL‑6?', 'Cena zależy od laboratorium i miasta; trzeba sprawdzić aktualny cennik oraz zasadność badania z lekarzem.']],
    sources: [['IL‑6 in acute exercise and training — review', 'https://pubmed.ncbi.nlm.nih.gov/17201070/'], ['Biological roles of IL‑6 during exercise — review', 'https://pubmed.ncbi.nlm.nih.gov/24655147/'], ['IL‑6 signaling in acute exercise and chronic training', 'https://pubmed.ncbi.nlm.nih.gov/36168944/'], ['Exercise intensity and chronic inflammation — meta-analysis', 'https://pubmed.ncbi.nlm.nih.gov/33153926/']]
  },
  {
    file: 'jak-tluszcz-zamienia-sie-w-energie-biologia-spalania-tluszczu-po-50.html',
    title: 'Jak organizm spala tłuszcz po 50-tce?',
    h1: 'Jak organizm spala tłuszcz po 50-tce: od zapasu do energii?',
    description: 'Spalanie tłuszczu wymaga uwolnienia kwasów tłuszczowych i ich utlenienia. Zobacz rolę deficytu energii, ruchu, mitochondriów oraz wydychanego CO2.',
    quick: 'Tkanka tłuszczowa przechowuje energię głównie jako trójglicerydy. Gdy organizm potrzebuje paliwa, uwalnia kwasy tłuszczowe, transportuje je do komórek i utlenia w mitochondriach. Większość atomów węgla z wykorzystanego tłuszczu opuszcza ciało jako wydychany dwutlenek węgla, ale szybsze oddychanie bez większego wydatku energii nie powoduje redukcji masy.',
    takeaways: ['Tłuszcz nie zamienia się bezpośrednio w mięśnie ani nie „wypaca się” w całości.', 'Lipoliza uwalnia paliwo, ale utrata zapasu wymaga jego rzeczywistego utlenienia.', 'Strefa większego procentowego użycia tłuszczu nie musi oznaczać największej redukcji w skali dnia.', 'Po 50-tce proces nadal działa; liczą się energia, aktywność, mięśnie, sen i zdrowie.'],
    sections: [
      ['Jak tłuszcz opuszcza komórkę tłuszczową?', 'Trójglicerydy są rozkładane do kwasów tłuszczowych i glicerolu, które mogą zostać wykorzystane przez tkanki. Samo uwolnienie nie gwarantuje utraty tłuszczu, ponieważ niewykorzystane kwasy mogą zostać ponownie zmagazynowane. O wyniku decyduje bilans w dłuższym czasie.', 'Podstawy praktycznego deficytu bez skrajności opisuje <a href="dieta-po-50.html">dieta po 50-tce</a>.'],
      ['Co dzieje się w mitochondriach?', 'Kwasy tłuszczowe są rozkładane w kolejnych reakcjach, a powstające nośniki elektronów zasilają produkcję ATP. Proces wymaga tlenu w końcowym etapie łańcucha oddechowego, lecz nie jest prostym „wrzuceniem tłuszczu do pieca”. Tempo zależy od zapotrzebowania komórki.', 'Ruch zwiększa zużycie energii, a trening siłowy pomaga chronić mięśnie podczas redukcji. Oba elementy łączy <a href="centrum-metabolizmu-po-50.html">Centrum Metabolizmu</a>.'],
      ['Czy tłuszcz naprawdę wydychamy?', 'Podczas pełnego utlenienia atomy węgla z trójglicerydów trafiają głównie do dwutlenku węgla, a wodór do wody. To opis losu masy, nie metoda odchudzania przez hiperwentylację. Oddychanie przyspiesza skutecznie dlatego, że pracujące mięśnie potrzebują więcej energii.', 'Regularny marsz jest dobrym początkiem, lecz dla pełnej sprawności warto dodać siłę. Przykład znajdziesz w tekście <a href="dlaczego-bieznia-to-za-malo.html">dlaczego sama bieżnia to za mało</a>.'],
      ['Czy po 50-tce metabolizm przestaje spalać tłuszcz?', 'Nie. Z wiekiem może zmieniać się masa mięśniowa, aktywność, sen, leki i stan zdrowia, co wpływa na zapotrzebowanie oraz zachowanie. Nie oznacza to biologicznej blokady spalania tłuszczu. Skrajny deficyt może natomiast pogarszać trening i ochronę mięśni.', 'Śledź trend masy, pasa, siły i samopoczucia przez kilka tygodni. Bezpieczny początek aktywności daje <a href="powrot-do-formy-po-50-kompletny-przewodnik.html">plan powrotu do formy</a>.']
    ],
    callouts: ['Wydychany CO₂ jest produktem utleniania; samo głębokie oddychanie bez pracy nie „spala” zapasu.', 'Waga może stać przez wodę i glikogen mimo prawidłowego procesu, dlatego oceniaj kilkutygodniowy trend.'],
    quote: 'Spalanie tłuszczu jest zwykłą fizjologią, a nie przełącznikiem uruchamianym jednym produktem lub zakresem tętna.',
    table: ['Od zapasu tłuszczu do produktów końcowych', ['Etap', 'Co się dzieje?', 'Czego nie oznacza?'], [['Lipoliza', 'Uwolnienie kwasów tłuszczowych', 'Jeszcze nie trwała utrata zapasu'], ['Transport', 'Dostarczenie paliwa do tkanek', 'Nie wybiera miejsca redukcji'], ['Utlenianie', 'Produkcja energii w komórce', 'Nie wymaga suplementu-spalacza'], ['Wydalenie', 'CO₂ przez płuca i woda', 'Nie działa przez samą hiperwentylację']]],
    faqs: [['Czy tłuszcz zamienia się w energię?', 'Jego wiązania chemiczne są utleniane, energia służy do produkcji ATP, a masa opuszcza ciało głównie jako CO₂ i woda.'], ['Czy pot usuwa tłuszcz?', 'Pot usuwa głównie wodę i elektrolity; spadek masy po poceniu zwykle wraca po nawodnieniu.'], ['Czy cardio na czczo spala więcej tłuszczu?', 'Może zmieniać chwilowy dobór paliwa, ale nie gwarantuje większej utraty tłuszczu w dłuższym okresie.'], ['Czy po 50-tce da się redukować tłuszcz?', 'Tak. Trzeba dopasować energię, ruch, białko i regenerację do zdrowia oraz punktu startu.']],
    sources: [['BMJ — where does fat go during weight loss?', 'https://www.bmj.com/content/349/bmj.g7257'], ['Exercise and visceral fat — network meta-analysis', 'https://pubmed.ncbi.nlm.nih.gov/38031812/'], ['Aerobic exercise and body weight — dose-response meta-analysis', 'https://pubmed.ncbi.nlm.nih.gov/39724371/'], ['WHO — physical activity guidelines', 'https://www.who.int/publications/i/item/9789240015128']]
  },
  {
    file: 'peptydy-co-to-jest-rodzaje-bezpieczenstwo-po-50.html',
    title: 'Peptydy po 50-tce: leki, kosmetyki i ryzyko',
    h1: 'Peptydy po 50-tce: czym różnią się leki od internetowej mody?',
    description: 'Peptydy obejmują zatwierdzone leki, kosmetyki i eksperymentalne zastrzyki. Sprawdź różnice, dowody oraz ryzyko BPC-157, TB-500 i preparatów z sieci.',
    quick: 'Peptyd to krótki łańcuch aminokwasów, ale sama nazwa nie mówi nic o skuteczności ani bezpieczeństwie produktu. Zatwierdzony lek peptydowy ma określone wskazanie, dawkę i kontrolę jakości; BPC‑157 oraz TB‑500 nie mają porównywalnych danych klinicznych. FDA wskazuje ograniczone dane o bezpieczeństwie i ryzyko zanieczyszczeń oraz reakcji immunologicznych.',
    takeaways: ['Nie wolno wrzucać zatwierdzonych leków, suplementów kolagenowych i BPC‑157 do jednej kategorii terapeutycznej.', 'Wynik na komórkach lub zwierzętach nie potwierdza skuteczności ani bezpiecznej dawki u ludzi.', 'Preparat opisany jako „research use only” nie jest lekiem przeznaczonym do samodzielnego wstrzykiwania.', 'Semaglutyd jest lekiem na receptę, a nie argumentem za bezpieczeństwem innych peptydów.'],
    sections: [
      ['Co oznacza słowo „peptyd”?', 'Peptydy są zbudowane z aminokwasów i pełnią w organizmie różne funkcje sygnałowe. Do tej szerokiej grupy należą naturalne cząsteczki, zatwierdzone leki, składniki kosmetyków i eksperymentalne substancje. Wspólna budowa nie daje im wspólnego profilu działania ani ryzyka.', 'Dlatego oceniaj konkretną nazwę, wskazanie, drogę podania i status regulacyjny. Ogólne zasady sprawdzania preparatów opisuje <a href="suplementacja-po-50.html">poradnik suplementacji po 50-tce</a>.'],
      ['Czym zatwierdzony lek różni się od produktu z internetu?', 'Lek przechodzi badania jakości, dawkowania, skuteczności i działań niepożądanych dla określonego wskazania. Produkt sprzedawany bez legalnego łańcucha dystrybucji może mieć inną zawartość niż etykieta, zanieczyszczenia lub nieznaną stabilność. Nie da się tego naprawić samym certyfikatem przesłanym przez sprzedawcę.', 'Jeżeli terapia dotyczy otyłości lub cukrzycy, decyzja wymaga rozpoznania i monitorowania. Podstawowe parametry kontrolne omawia artykuł <a href="badania-krwi-po-50-jak-czesto.html">o badaniach krwi po 50-tce</a>.'],
      ['Co wiadomo o BPC‑157 i TB‑500?', 'FDA opisuje BPC‑157 oraz fragment tymozyny beta‑4 znany jako TB‑500 jako substancje z niewystarczającymi danymi o ekspozycji i bezpieczeństwie u ludzi. Agencja wskazuje również na możliwą immunogenność, agregację peptydów i trudność kontroli zanieczyszczeń w preparatach złożonych.', 'Nie oznacza to dowodu, że każda ekspozycja wywoła szkodę; oznacza brak podstaw do deklarowania bezpiecznej dawki i korzyści. Urazu ścięgna nie należy leczyć internetowym zastrzykiem zamiast diagnostyki i <a href="mobilnosc-vs-rozciaganie-program-dla-stawow-po-piecdziesiatce.html">stopniowego powrotu do ruchu</a>.'],
      ['Czy peptydy w kosmetyku działają jak zastrzyk?', 'Nie. Preparat miejscowy, suplement doustny i lek w iniekcji mają inne wchłanianie, dawkę oraz wymagania dowodowe. Małe badanie kosmetyczne nie potwierdza leczenia całego organizmu, a obietnica „regeneracji komórek” bez podania mierzonego wyniku jest marketingiem.', 'W pielęgnacji większą podstawę ma ochrona przed promieniowaniem UV niż niejasna obietnica odmłodzenia. Krytyczne czytanie etykiet ćwicz z przewodnikiem <a href="jak-czytac-etykiety-sklad-produktow-e-numery-inci.html">po składach produktów</a>.']
    ],
    callouts: ['Najpierw ustal pełną nazwę substancji i status leku; samo słowo „peptyd” niczego nie rozstrzyga.', 'Brak badań u ludzi nie jest dowodem nieskuteczności, ale blokuje uczciwą obietnicę korzyści i bezpiecznej dawki.'],
    quote: 'Zatwierdzony lek peptydowy nie potwierdza skuteczności preparatu, który tylko dzieli z nim nazwę klasy chemicznej.',
    table: ['Peptydy — cztery różne kategorie', ['Kategoria', 'Co wiadomo?', 'Najważniejsze pytanie'], [['Zatwierdzony lek', 'Wskazanie, dawka i kontrola jakości', 'Czy jest wskazany dla tej osoby?'], ['Preparat recepturowy', 'Jakość zależy od prawa i wykonania', 'Dlaczego nie ma produktu zatwierdzonego?'], ['Kosmetyk lub suplement', 'Inne wymagania niż dla leku', 'Jaki wynik potwierdzono u ludzi?'], ['„Research use only”', 'Brak przeznaczenia do samoleczenia', 'Czy w ogóle istnieją dane kliniczne?']]],
    faqs: [['Czy BPC‑157 jest zatwierdzonym lekiem?', 'Nie. FDA wskazuje niewystarczające dane o bezpieczeństwie oraz ryzyka jakościowe dla preparatów złożonych z BPC‑157.'], ['Czy TB‑500 leczy urazy?', 'Brakuje wiarygodnych badań klinicznych pozwalających ustalić skuteczność i bezpieczne dawkowanie u ludzi.'], ['Czy semaglutyd jest peptydem?', 'Tak, ale jest konkretnym lekiem na receptę z określonymi wskazaniami; nie potwierdza działania innych peptydów.'], ['Czy peptyd w kremie działa w całym organizmie?', 'Nie należy tego zakładać. Działanie miejscowe i ogólnoustrojowe wymagają osobnych badań ekspozycji i skuteczności.']],
    sources: [['FDA — substancje do receptury mogące stwarzać ryzyko', 'https://www.fda.gov/drugs/human-drug-compounding/certain-bulk-drug-substances-use-compounding-may-present-significant-safety-risks'], ['FDA — clinical pharmacology considerations for peptide drugs', 'https://www.fda.gov/regulatory-information/search-fda-guidance-documents/clinical-pharmacology-considerations-peptide-drug-products'], ['FDA — briefing document on BPC‑157', 'https://www.fda.gov/media/193343/download'], ['FDA — 2026 Pharmacy Compounding Advisory Committee', 'https://www.fda.gov/advisory-committees/advisory-committee-calendar/july-23-24-2026-meeting-pharmacy-compounding-advisory-committee-07232026']]
  },
  {
    file: 'tluszcz-trzewny-choroby-jak-walczyc.html',
    title: 'Tłuszcz trzewny po 50-tce: pomiar i redukcja',
    h1: 'Tłuszcz trzewny po 50-tce: jak ocenić ryzyko i go zmniejszyć?',
    description: 'Tłuszcz trzewny wiąże się z ryzykiem metabolicznym, lecz nie widać go dokładnie w lustrze. Sprawdź pomiar pasa, ruch, dietę oraz objawy alarmowe po 50-tce.',
    quick: 'Po 50-tce tłuszcz trzewny otacza narządy jamy brzusznej i jest silniej związany z ryzykiem metabolicznym niż tłuszcz podskórny, ale domowy pomiar pasa nie pokazuje jego dokładnej ilości. Najlepiej udokumentowane działania obejmują regularny ruch, trening siłowy, żywienie tworzące możliwy do utrzymania deficyt energii, sen i ograniczenie alkoholu.',
    takeaways: ['Obwód pasa jest wskaźnikiem przesiewowym i trendem, nie obrazem tkanki z CT lub MRI.', 'Różne rodzaje treningu mogą zmniejszać tłuszcz trzewny; nie istnieje ćwiczenie spalające go miejscowo.', 'Menopauza może zmieniać rozmieszczenie tłuszczu, ale nie unieważnia reakcji na ruch i bilans energii.', 'Nagłe powiększanie brzucha z bólem, dusznością lub obrzękami wymaga diagnostyki.'],
    sections: [
      ['Czym tłuszcz trzewny różni się od podskórnego?', 'Tkanka podskórna leży pod skórą, a trzewna w jamie brzusznej wokół narządów. Ilość tłuszczu trzewnego ocenia się najdokładniej metodami obrazowymi używanymi w badaniach, natomiast w domu można śledzić obwód pasa w tych samych warunkach.', 'Sam wygląd nie rozstrzyga ryzyka. Wynik warto łączyć z ciśnieniem, glukozą i lipidami, które omawia <a href="badania-po-50.html">przewodnik badań po 50-tce</a>.'],
      ['Jak prawidłowo mierzyć obwód pasa?', 'Używaj tej samej nieelastycznej taśmy, stań swobodnie i mierz po spokojnym wydechu w miejscu zgodnym z wybranym protokołem. Najważniejsza jest powtarzalność. Posiłek, zaparcie, zatrzymanie płynów i ułożenie taśmy mogą zmienić pojedynczy wynik.', 'Zapis raz na tydzień lub dwa wystarcza do oceny trendu. Szerszy plan redukcji bez spalania miejscowego zawiera artykuł <a href="jak-pozbyc-sie-oponki-brzusznej-po-50.html">o oponce brzusznej po 50-tce</a>.'],
      ['Który rodzaj ruchu działa najlepiej?', 'Metaanalizy randomizowanych badań wskazują, że trening aerobowy, oporowy, łączony i interwałowy mogą zmniejszać tłuszcz trzewny u osób z nadwagą lub otyłością. Rankingi metod nie oznaczają, że najintensywniejsza opcja jest bezpieczna i najlepsza dla każdego początkującego.', 'Zacznij od dawki możliwej do powtarzania i dobuduj dwa dni wzmacniania. Praktyczne połączenie cardio i siły opisuje <a href="dlaczego-bieznia-to-za-malo.html">poradnik o bieżni i treningu siłowym</a>.'],
      ['Co poza treningiem pomaga zmniejszyć pas?', 'Zmiana diety działa przez całkowity bilans energii i możliwość utrzymania planu, nie przez pojedynczy produkt. Białko i produkty z błonnikiem mogą ułatwiać sytość, a ograniczenie alkoholu usuwa kalorie, które często nie są kompensowane mniejszym jedzeniem.', 'Sen i leczenie chorób wpływających na apetyt również mają znaczenie, ale nie są „resetem kortyzolu”. Podstawy posiłków znajdziesz w artykule <a href="dieta-po-50.html">dieta po 50-tce</a>.']
    ],
    callouts: ['Porównuj trend obwodu pasa, a nie pojedyncze centymetry po różnym posiłku lub o innej porze.', 'Ból, twardy brzuch, wodobrzusze, żółtaczka lub nagła duszność nie są zwykłą „oponką”.'],
    quote: 'Najlepszym celem nie jest idealny brzuch, lecz malejący trend ryzyka i plan, który można kontynuować.',
    table: ['Jak oceniać brzuch bez zgadywania?', ['Narzędzie', 'Co pokazuje?', 'Ograniczenie'], [['Obwód pasa', 'Zmianę obwodu w czasie', 'Nie rozdziela VAT i tłuszczu podskórnego'], ['Masa ciała', 'Całkowitą zmianę masy', 'Nie pokazuje składu ani rozmieszczenia'], ['CT lub MRI', 'Obraz tkanki trzewnej', 'Nie jest rutynowym testem do domowego monitoringu'], ['Badania metaboliczne', 'Glukozę, lipidy i ciśnienie', 'Nie mierzą bezpośrednio ilości VAT']]],
    faqs: [['Czy szczupła osoba może mieć dużo tłuszczu trzewnego?', 'Tak. BMI i wygląd nie pokazują dokładnego rozmieszczenia tłuszczu, dlatego liczy się również pas i profil metaboliczny.'], ['Czy brzuszki spalają tłuszcz trzewny?', 'Nie miejscowo. Wzmacniają mięśnie brzucha, ale redukcja tłuszczu zależy od całego planu ruchu i energii.'], ['Czy HIIT jest konieczny?', 'Nie. Różne metody ruchu mogą działać; intensywność trzeba dopasować do zdrowia i doświadczenia.'], ['Jak często mierzyć pas?', 'Raz na tydzień lub dwa w tych samych warunkach zwykle wystarcza do oceny trendu.']],
    sources: [['Exercise types and visceral adipose tissue — network meta-analysis', 'https://pubmed.ncbi.nlm.nih.gov/38031812/'], ['Exercise dose and visceral fat — meta-analysis of RCTs', 'https://pubmed.ncbi.nlm.nih.gov/36669870/'], ['WHO — waist circumference and waist–hip ratio', 'https://iris.who.int/bitstream/handle/10665/44583/9789241501491_eng.pdf'], ['WHO — physical activity guidelines', 'https://www.who.int/publications/i/item/9789240015128']]
  }
];

for (const article of moreArticles) {
  const filePath = path.join(ROOT, article.file);
  let html = fs.readFileSync(filePath, 'utf8');
  const hub = (html.match(/<p class="topic-hub-backlink">[\s\S]*?<\/p>/) || [''])[0];
  const share = (html.match(/<section class="share-article-section reveal"[\s\S]*?<\/section>/) || [''])[0];
  html = updateJsonLd(html, article);
  html = updateMeta(html, article);
  const bodyPattern = /<article class="article-content">[\s\S]*?<\/article>\s*<\/div>\s*<\/main>\s*<section class="reading-room/;
  if (!bodyPattern.test(html)) throw new Error(`Nie znaleziono treści artykułu: ${article.file}`);
  html = html.replace(bodyPattern, `${renderBody(article, hub, share)}</div></main><section class="reading-room`);
  html = addImageDimensions(html);
  html = normalizePdfSafeGlyphs(html);
  fs.writeFileSync(filePath, html);
  console.log(`[BATCH-4] repaired ${article.file}`);
}
