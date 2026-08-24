#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const MODIFIED = '2026-08-24T12:00:00+02:00';

const articles = [
  {
    file: 'chleb-na-zakwasie-weglowodany-indeks-glikemiczny.html',
    title: 'Chleb na zakwasie a indeks glikemiczny po 50-tce',
    h1: 'Chleb na zakwasie a indeks glikemiczny: co zmienia glikemię?',
    media: [['zakwas-ekosystem-sekcja1', 'Aktywny zakwas w słoiku z widocznymi pęcherzykami fermentacji'], ['indeks-glikemiczny-porownanie-sekcja2', 'Porównanie odpowiedzi glikemicznej po różnych rodzajach pieczywa'], ['insulina-odpowiedz-zakwas-sekcja3', 'Mężczyzna po 50-tce je śniadanie z pieczywem na zakwasie']],
    description: 'Chleb na zakwasie może łagodniej podnosić glikemię, ale liczą się mąka, porcja i wypiek. Sprawdź etykietę, skład posiłku i wynik własnego pomiaru.',
    quick: 'Chleb na zakwasie nie jest automatycznie pieczywem o niskim indeksie glikemicznym. Przegląd 18 badań wykazał mniejszy wzrost glukozy po 60 i 120 minutach niż po pieczywie kontrolnym, ale pewność dowodów oceniono jako niską lub bardzo niską. Najwięcej zmieniają rodzaj mąki, udział całego ziarna, porcja i dodatki do posiłku.',
    takeaways: ['Sama obecność zakwasu nie określa indeksu ani ładunku glikemicznego konkretnego bochenka.', 'W przeglądzie 18 prób efekt dotyczył glikemii poposiłkowej, a nie trwałej poprawy cukrzycy.', 'Pieczywo pełnoziarniste na zakwasie zwykle daje rozsądniejszy wybór niż jasny bochenek o tej samej nazwie.', 'Przy cukrzycy praktyczną odpowiedź daje porównywalna porcja i pomiar według zaleceń zespołu leczącego.'],
    sections: [
      ['Czy chleb na zakwasie ma zawsze niski indeks glikemiczny?', 'Nie. Zakwas opisuje sposób fermentacji, a nie gotową wartość indeksu glikemicznego. Na odpowiedź wpływają mąka, stopień rozdrobnienia, udział całych ziaren, czas fermentacji, wypiek oraz porcja. Jasny chleb pszenny na zakwasie może podnosić glukozę wyraźniej niż zwarty chleb pełnoziarnisty, mimo identycznego hasła na etykiecie.', 'Dlatego wybór zacznij od składu i porcji, a nie od samego słowa „zakwas”; szerszy kontekst daje <a href="dieta-po-50.html">poradnik diety po 50-tce</a>.'],
      ['Co naprawdę pokazały badania glikemii po zakwasie?', 'Przegląd systematyczny obejmujący 18 badań porównawczych wykazał mniejszy przyrost glukozy po 60 i 120 minutach po pieczywie na zakwasie. Autorzy ocenili jednak pewność dowodów jako niską do bardzo niskiej, a produkty i protokoły różniły się między próbami. To sygnał korzyści, nie gwarancja dla każdego bochenka.', 'Jeżeli monitorujesz glikemię, porównuj ten sam posiłek i tę samą ilość węglowodanów, zamiast wyciągać wniosek po przypadkowych kromkach. Skład produktu sprawdzaj według <a href="jak-czytac-etykiety-sklad-produktow-e-numery-inci.html">zasad czytania etykiet</a>.'],
      ['Jak wybrać pieczywo, gdy zależy Ci na glikemii?', 'Sprawdź, czy pierwszym składnikiem jest mąka pełnoziarnista lub razowa, ile pieczywo ma błonnika na 100 g i jaka jest masa jednej kromki. Krótki skład nie zastępuje tych informacji. Łącz pieczywo ze źródłem białka, warzywami i nienasyconym tłuszczem, bo oceniasz cały posiłek, nie samotną etykietę.', 'Jeżeli głód szybko wraca, zasady budowania sycącego posiłku znajdziesz w artykule <a href="sniadanie-bialkowo-tluszczowe-zachcianki-na-cukier.html">o śniadaniu, białku i zachciankach</a>.'],
      ['Kiedy własny pomiar jest ważniejszy niż tabela IG?', 'Przy cukrzycy, stanie przedcukrzycowym lub dużej zmienności glikemii tabela indeksu glikemicznego jest tylko orientacją. Ustal z zespołem leczącym moment pomiaru, zachowaj tę samą porcję i zanotuj skład posiłku, leki oraz ruch. Pojedynczy odczyt nie rozpoznaje problemu, lecz powtarzalny wzorzec może pomóc skorygować wybór.', 'Nie zmieniaj dawki insuliny ani leków na podstawie tego artykułu; ogólne zasady kontroli porządkuje <a href="badania-krwi-po-50-jak-czesto.html">plan badań krwi po 50-tce</a>.']
    ],
    callouts: ['Na etykiecie szukaj rodzaju mąki, błonnika i masy kromki. „Na zakwasie” nie jest wynikiem laboratoryjnym indeksu glikemicznego.', 'Jeżeli po pieczywie powtarzalnie występuje bardzo wysoka glikemia lub objawy niedocukrzenia po lekach, skontaktuj się z prowadzącym.'],
    quote: 'Zakwas może zmieniać odpowiedź po posiłku, ale o praktycznym wyborze nadal decydują bochenek, porcja i cały talerz.',
    table: ['Jak ocenić chleb na zakwasie?', ['Element', 'Co sprawdzić?', 'Czego nie zakładać?'], [['Mąka', 'Pełnoziarnista lub razowa wysoko w składzie', 'Że ciemny kolor oznacza pełne ziarno'], ['Porcja', 'Masa kromki i liczba kromek', 'Że każda kromka waży tyle samo'], ['Zakwas', 'Rzeczywista fermentacja i skład', 'Że nazwa gwarantuje niski IG'], ['Odpowiedź', 'Porównywalny pomiar, jeśli zalecony', 'Że jeden odczyt rozstrzyga wszystko']]],
    faqs: [['Czy chleb na zakwasie jest dobry przy cukrzycy?', 'Może pasować do planu, ale liczą się mąka, porcja, cały posiłek i indywidualna odpowiedź glikemiczna.'], ['Czy zakwas obniża indeks glikemiczny każdego chleba?', 'Nie. Badania pokazują średni efekt, lecz receptury i rodzaje mąki różnią się, więc nazwa nie gwarantuje wartości.'], ['Lepszy jest zakwas żytni czy pszenny?', 'Nie rozstrzyga tego sam typ zakwasu. Ważniejsze są pełne ziarno, struktura pieczywa, błonnik i porcja.'], ['Ile kromek można zjeść?', 'Nie ma jednej liczby dla wszystkich. Porcję dobiera się do zapotrzebowania, leczenia i reszty węglowodanów w posiłku.']],
    sources: [['Sourdough bread and glycemic control - systematic review', 'https://pubmed.ncbi.nlm.nih.gov/35943419/'], ['International tables of glycemic index 2021', 'https://pubmed.ncbi.nlm.nih.gov/34258626/'], ['WHO guideline on carbohydrate intake', 'https://www.who.int/publications/i/item/9789240073593'], ['ADA Standards of Care - nutrition', 'https://diabetesjournals.org/care/issue/49/Supplement_1']]
  },
  {
    file: 'apob-norma-cena-jak-czytac-wynik.html',
    title: 'ApoB po 50-tce: wynik mg/dl, cele i interpretacja',
    h1: 'ApoB po 50-tce: jak czytać wynik mg/dl, g/l i cele ryzyka?',
    media: [['apob-lipoproteiny-schemat', 'Schemat cząstki lipoproteiny z zaznaczonym białkiem ApoB'], ['pob-vs-ldl-porownanie', 'Porównanie ilości cholesterolu LDL z liczbą cząstek ocenianą przez ApoB'], ['apob-normy-infografika', 'Infografika celów ApoB zależnych od kategorii ryzyka sercowo-naczyniowego']],
    description: 'ApoB pokazuje liczbę cząstek aterogennych, lecz cel zależy od ryzyka. Przelicz mg/dl i g/l, porównaj LDL oraz sprawdź, kiedy wynik omówić z lekarzem.',
    quick: 'ApoB przybliża liczbę aterogennych cząstek lipoprotein, ale nie istnieje jedna „norma po 50-tce”. W wytycznych ESC/EAS cele wtórne wynoszą poniżej 100, 80 lub 65 mg/dl odpowiednio dla umiarkowanego, wysokiego i bardzo wysokiego ryzyka. Wynik 0,80 g/l to 80 mg/dl. Decyzja zależy też od LDL, chorób, leków i całkowitego ryzyka.',
    takeaways: ['Wiek 50 lat sam nie wyznacza celu ApoB; robi to kategoria ryzyka sercowo-naczyniowego.', 'Przeliczenie jest proste: 1 g/l odpowiada 100 mg/dl, więc 0,80 g/l to 80 mg/dl.', 'Cele ESC/EAS poniżej 100, 80 i 65 mg/dl są celami wtórnymi dla kolejnych kategorii ryzyka, nie zakresem referencyjnym dla wszystkich.', 'Cena badania zmienia się między laboratoriami, dlatego artykuł nie podaje jednej kwoty jako stałej cechy testu.'],
    sections: [
      ['Co dokładnie mierzy ApoB?', 'Każda aterogenna cząstka LDL, IDL, VLDL i lipoproteiny(a) zawiera jedną cząsteczkę ApoB100. Stężenie ApoB przybliża więc ich łączną liczbę, podczas gdy LDL-C opisuje ilość cholesterolu przewożonego w części z nich. Rozbieżność bywa ważna przy wysokich trójglicerydach, cukrzycy, otyłości lub bardzo niskim LDL-C.', 'Relację między parametrami porządkuje <a href="apob-apoa-badania-cholesterol.html">poradnik ApoB/ApoA1 i ryzyka serca</a>.'],
      ['Jak przeliczyć ApoB z g/l na mg/dl?', 'Wystarczy pomnożyć wynik w g/l przez 100. Przykładowo 0,65 g/l odpowiada 65 mg/dl, 0,80 g/l to 80 mg/dl, a 1,00 g/l to 100 mg/dl. Przed porównaniem zawsze sprawdź jednostkę na wydruku, ponieważ przepisanie samej liczby bez jednostki może całkowicie zmienić interpretację.', 'Zapisz także datę, leczenie i warunki pobrania; przydatny rytm kontroli opisuje <a href="badania-krwi-po-50-jak-czesto.html">plan badań krwi</a>.'],
      ['Czy wynik w zakresie laboratorium oznacza optymalny cel?', 'Niekoniecznie. Zakres referencyjny laboratorium opisuje rozkład lub przyjęte granice, a cel leczenia zależy od ryzyka. ESC/EAS podaje ApoB poniżej 100 mg/dl przy ryzyku umiarkowanym, poniżej 80 mg/dl przy wysokim i poniżej 65 mg/dl przy bardzo wysokim jako cele wtórne. Kategorię ryzyka ustala klinicysta.', 'LDL, nie-HDL i ApoB warto czytać wspólnie w <a href="centrum-cholesterolu-po-50.html">Centrum Cholesterolu i Badań</a>.'],
      ['Kiedy wynik ApoB wymaga rozmowy z lekarzem?', 'Omów go szczególnie wtedy, gdy masz rozpoznaną chorobę sercowo-naczyniową, cukrzycę, przewlekłą chorobę nerek, rodzinną hipercholesterolemię albo gdy ApoB pozostaje wysokie mimo niskiego LDL-C. Nie zmieniaj samodzielnie statyny ani innego leczenia. Powtórzenie wyniku powinno służyć konkretnej decyzji, a nie pogoni za pojedynczą liczbą.', 'Jeżeli zmieniłeś sposób żywienia, porównaj wyniki z zasadami opisanymi w <a href="dieta-keto-cholesterol-ldl-hdl-badania-naukowe.html">analizie keto, LDL i ApoB</a>.']
    ],
    callouts: ['Nie porównuj 0,8 g/l z 80 mg/l. Najpierw przepisz dokładną jednostkę; 0,80 g/l odpowiada 80 mg/dl.', 'Ból w klatce, nagła duszność lub objawy udaru nie są sytuacją do analizowania ApoB w domu — wymagają pilnej pomocy.'],
    quote: 'ApoB jest liczbą cząstek związaną z ryzykiem, ale sens tej liczby nadaje dopiero kategoria ryzyka i cały profil pacjenta.',
    table: ['Cele wtórne ApoB według ryzyka ESC/EAS', ['Kategoria ryzyka', 'Cel ApoB', 'Znaczenie'], [['Umiarkowane', 'poniżej 100 mg/dl', 'Cel wtórny po ocenie ryzyka'], ['Wysokie', 'poniżej 80 mg/dl', 'Niższy cel z powodu większego ryzyka'], ['Bardzo wysokie', 'poniżej 65 mg/dl', 'Najniższy z trzech celów wtórnych'], ['Jednostka g/l', 'mg/dl = g/l × 100', '0,80 g/l = 80 mg/dl']]],
    faqs: [['Jaka jest norma ApoB po 50-tce?', 'Nie ma osobnej normy wyłącznie z powodu wieku. Cel zależy przede wszystkim od całkowitego ryzyka sercowo-naczyniowego.'], ['Czy ApoB 100 mg/dl jest wysokie?', 'Dla ryzyka umiarkowanego to granica celu wtórnego ESC/EAS; przy wysokim lub bardzo wysokim ryzyku cel jest niższy.'], ['Jak przeliczyć ApoB z g/l na mg/dl?', 'Pomnóż g/l przez 100. Wynik 0,72 g/l odpowiada 72 mg/dl.'], ['Czy ApoB zastępuje LDL?', 'Nie zawsze. Parametry opisują inne cechy lipoprotein i najczęściej interpretuje się je razem z całym profilem ryzyka.']],
    sources: [['2019 ESC/EAS dyslipidaemia guideline', 'https://pubmed.ncbi.nlm.nih.gov/31504418/'], ['NLA consensus on ApoB', 'https://pubmed.ncbi.nlm.nih.gov/39256087/'], ['EAS/EFLM consensus on atherogenic lipoproteins', 'https://pubmed.ncbi.nlm.nih.gov/29760220/'], ['ApoB and clinical practice review', 'https://pubmed.ncbi.nlm.nih.gov/38950110/']]
  },
  {
    file: 'bieganie-niszczy-kolana.html',
    title: 'Czy bieganie niszczy kolana po 50-tce? Fakty',
    h1: 'Czy bieganie po 50-tce niszczy kolana? Co mówią badania?',
    media: [['kolano_optimized', 'Anatomiczne zbliżenie stawu kolanowego i otaczających tkanek'], ['biegaczka-park', 'Osoba po 50-tce biegnie rekreacyjnie po parkowej alejce'], ['nogi-biegacza', 'Nogi biegacza podczas spokojnego biegu rekreacyjnego']],
    description: 'Rekreacyjne bieganie nie musi zwiększać ryzyka choroby kolan. Sprawdź dziś rolę dawki, dawnych urazów, bólu i prosty plan powrotu do biegu po 50-tce.',
    quick: 'Dostępne przeglądy nie pokazują, aby rekreacyjne bieganie samo w sobie częściej powodowało chorobę zwyrodnieniową kolan. Metaanaliza 125 810 osób wykazała niższą częstość choroby u biegaczy rekreacyjnych niż u zawodowych i osób niebiegających, ale nie dowodzi przyczynowości. Ryzyko zmieniają wcześniejsze urazy, duża objętość, masa ciała, objawy i zbyt szybka progresja.',
    takeaways: ['Rekreacyjne bieganie i bieganie wyczynowe nie są tą samą ekspozycją dla stawu.', 'Niższa częstość choroby u amatorów jest obserwacją; może częściowo wynikać z różnic zdrowia i dawnych urazów.', 'Ból podczas biegu nie oznacza automatycznie „zużycia chrząstki”, ale wymaga oceny wzorca i reakcji po wysiłku.', 'Powrót powinien zwiększać jeden parametr naraz: czas, częstotliwość albo tempo.'],
    sections: [
      ['Co badania mówią o bieganiu i chorobie zwyrodnieniowej kolan?', 'Metaanaliza 25 badań obejmująca 125 810 osób wykazała chorobę biodra lub kolana u 3,5% biegaczy rekreacyjnych, 13,3% zawodowych i 10,2% osób kontrolnych. Autorzy podkreślili, że dane obserwacyjne nie pozwalają dowieść, iż bieganie było przyczyną różnic, a wcześniejsze urazy mogły zaburzać wynik.', 'To ważniejsze rozróżnienie niż hasło „bieganie niszczy”; bezpieczny powrót opisuje <a href="powrot-do-formy-po-50-kompletny-przewodnik.html">plan startu od zera</a>.'],
      ['Dlaczego kolano może boleć mimo braku uszkodzenia?', 'Ból zależy nie tylko od obrazu chrząstki, lecz także od obciążenia, tolerancji tkanek, siły, snu, stresu i wcześniejszych doświadczeń. Nowy ból po skoku objętości często oznacza, że dawka przekroczyła bieżącą tolerancję. Nie wolno jednak na odległość wykluczać urazu, zapalenia ani innej przyczyny.', 'Siłę biodra i nogi można budować według zasad z <a href="centrum-treningu-silowego-po-50.html">Centrum Treningu Siłowego</a>.'],
      ['Jak wrócić do biegania po 50-tce?', 'Zacznij od marszobiegu co drugi dzień: po rozgrzewce przeplataj 1 minutę spokojnego biegu z 2 minutami marszu przez 18-24 minuty. Utrzymaj tempo pozwalające mówić zdaniami. Jeśli reakcja w trakcie i następnego dnia jest stabilna, w kolejnym tygodniu wydłuż tylko odcinki biegu lub cały czas.', 'Gdy ciągły bieg jest za trudny, przygotowanie tlenowe daje <a href="nordic-walking-jak-zaczac-technika-kije-zdrowie.html">nordic walking po 50-tce</a>.'],
      ['Kiedy ból kolana wymaga badania zamiast kolejnego treningu?', 'Pilnej oceny wymaga uraz z deformacją, niemożność obciążenia nogi, gwałtowny duży obrzęk, gorący zaczerwieniony staw z gorączką albo zablokowanie kolana. Konsultacji wymaga też ból narastający mimo zmniejszenia dawki, nawracająca niestabilność lub obrzęk po każdym biegu. Nie testuj wtedy kolejnych kilometrów.', 'Jeśli chcesz pozostać aktywny bez prowokowania objawów, dobierz zastępczy ruch z <a href="dlaczego-bieznia-to-za-malo.html">poradnika o różnorodności treningu</a>.']
    ],
    callouts: ['Niższa częstość choroby zwyrodnieniowej u biegaczy rekreacyjnych nie oznacza, że każdy bieg chroni kolana ani że można ignorować uraz.', 'Gorący, czerwony i wyraźnie obrzęknięty staw, gorączka lub niemożność obciążenia nogi wymagają pilnej oceny.'],
    quote: 'Kolano nie liczy urodzin ani haseł o bieganiu — reaguje na dawkę, historię urazów i aktualną zdolność do obciążenia.',
    table: ['Decyzja przy bólu kolana po bieganiu', ['Sytuacja', 'Co zrobić?', 'Czego nie robić?'], [['Lekka sztywność bez narastania', 'Powtórzyć lub zmniejszyć dawkę', 'Dokładać tempa i czasu naraz'], ['Ból rośnie następnego dnia', 'Cofnąć ostatnią progresję', 'Biec „żeby rozchodzić”'], ['Nawracający obrzęk lub niestabilność', 'Umówić ocenę kliniczną', 'Testować długi bieg'], ['Deformacja, gorący staw, brak obciążenia', 'Pilna pomoc', 'Czekać na plan treningowy']]],
    faqs: [['Czy bieganie po asfalcie niszczy kolana?', 'Sama nawierzchnia nie przesądza o uszkodzeniu. Znaczenie mają dawka, prędkość, obuwie, urazy i tolerancja danej osoby.'], ['Czy można biegać z chorobą zwyrodnieniową?', 'Część osób może, ale plan zależy od objawów, funkcji i zaleceń prowadzącego; nie ma jednej odpowiedzi dla wszystkich.'], ['Ile razy w tygodniu biegać na początku?', 'Praktycznym startem są 2-3 marszobiegi z dniem przerwy, jeśli objawy podczas wysiłku i następnego dnia pozostają stabilne.'], ['Czy ból oznacza ścieranie chrząstki?', 'Nie automatycznie. Ból i zmiany strukturalne nie są tym samym, lecz nowy lub narastający objaw wymaga rozsądnej oceny.']],
    sources: [['Running and hip or knee osteoarthritis - meta-analysis', 'https://pubmed.ncbi.nlm.nih.gov/28504066/'], ['Running volume and knee osteoarthritis - meta-analysis', 'https://pubmed.ncbi.nlm.nih.gov/36809693/'], ['Running and knee osteoarthritis - updated review', 'https://pubmed.ncbi.nlm.nih.gov/36875337/'], ['Physical activity and knee osteoarthritis evidence overview', 'https://pubmed.ncbi.nlm.nih.gov/35943452/']]
  },
  {
    file: 'nordic-walking-jak-zaczac-technika-kije-zdrowie.html',
    title: 'Nordic walking po 50-tce: technika i dobór kijów',
    h1: 'Nordic walking po 50-tce: dobór kijów, technika i plan startu',
    media: [['nordic-walking-historia-os-czasu-infografika', 'Oś czasu rozwoju nordic walking jako formy aktywności'], ['nordic-walking-miesnie-porownanie-infografika', 'Ilustracja różnic pracy ciała podczas zwykłego marszu i nordic walking'], ['nordic-walking-technika-schemat-kroku-ilustracja', 'Schemat naprzemiennego kroku i ukośnego ustawienia kijów']],
    description: 'Nordic walking po 50-tce wymaga długości kijów i spokojnej progresji. Poznaj technikę kroku, ustawienie paska oraz bezpieczny plan pierwszych 4 tygodni.',
    quick: 'Nordic walking to marsz z aktywnym odepchnięciem kijem, a nie stawianie kijów pionowo przed sobą. Długość około 0,68 wzrostu jest punktem startu, który trzeba skorygować do techniki i ruchomości. Zacznij od 20-30 minut, 2-3 razy w tygodniu, w tempie rozmowy. Ból w klatce, omdlenie lub nagła nietypowa duszność kończą trening.',
    takeaways: ['Wzór wzrost × 0,68 pomaga dobrać pierwszy rozmiar, lecz nie jest kliniczną normą dla każdej osoby.', 'Kij trafia w podłoże ukośnie w okolicy przeciwnej stopy, a odepchnięcie kończy się za biodrem.', 'Badania u starszych dorosłych wskazują poprawę części parametrów wydolności i funkcji, ale efekty zależą od programu.', 'Najpierw zwiększ czas marszu, a dopiero później tempo lub podbiegi.'],
    sections: [
      ['Jak dobrać długość kijów do nordic walking?', 'Pomnóż wzrost w centymetrach przez około 0,68 i potraktuj wynik jako ustawienie próbne. Osoba o wzroście 170 cm otrzyma około 116 cm, więc przy stałych rozmiarach sprawdzi zwykle 115 lub 120 cm. Krótsze ustawienie może ułatwić naukę, ograniczona ruchomość barku lub specyficzna budowa wymagają korekty.', 'Jeśli wybierasz regulowane kije, sprawdź blokadę przed każdym wyjściem i nie oceniaj długości wyłącznie na podstawie tabeli sklepu.'],
      ['Jak wygląda poprawny krok i praca ramion?', 'Idź naturalnym krokiem: prawa ręka współpracuje z lewą nogą. Kij ustawiaj ukośnie, chwytaj rękojeść przy przenoszeniu ręki do przodu, następnie odepchnij podłoże i rozluźnij palce za linią biodra, wykorzystując pasek. Tułów pozostaje wysoki, a krok nie powinien być sztucznie wydłużany.', 'Koordynację łatwiej opanować na płaskim odcinku niż podczas szybkiego marszu; ogólną bazę ruchu rozwija <a href="powrot-do-formy-po-50-kompletny-przewodnik.html">plan powrotu do formy</a>.'],
      ['Jaki plan zastosować przez pierwsze 4 tygodnie?', 'W pierwszym tygodniu wykonaj dwa spokojne marsze po 20 minut. W drugim dodaj trzeci spacer albo 5 minut do jednego wyjścia. W trzecim utrzymaj czas i doskonal odepchnięcie. W czwartym wydłuż jedną sesję do 30-40 minut, jeśli możesz mówić zdaniami i następnego dnia nie narastają objawy.', 'Dwie sesje wzmacniające uzupełnią marsz zgodnie z <a href="trening-3x30-dla-50-plus.html">planem treningu 3x30</a>.'],
      ['Kiedy nordic walking wymaga ostrożności?', 'Dostosowania potrzebują świeży uraz, niestabilność, zawroty głowy, źle kontrolowana choroba lub ból nasilany przez ruch ramienia. Ból w klatce, omdlenie, objawy neurologiczne albo nagła duszność wymagają przerwania wysiłku. Kijki mogą poprawić rytm i zaangażowanie góry ciała, ale nie gwarantują ochrony przed upadkiem.', 'Przed mocniejszym startem przy objawach zastosuj kryteria z artykułu <a href="badania-po-50.html">o ocenie przed treningiem po 50-tce</a>. Jeżeli marsz jest jedyną aktywnością, sprawdź też <a href="dlaczego-bieznia-to-za-malo.html">dlaczego jeden bodziec nie wystarcza sprawności</a>.']
    ],
    callouts: ['Wzrost × 0,68 to ustawienie próbne. Jeżeli bark unosi się, łokieć blokuje albo kij przeszkadza w kroku, skoryguj długość.', 'Na mokrym kamieniu, lodzie i gładkiej posadzce dobierz właściwą końcówkę; kij nie usuwa ryzyka poślizgu.'],
    quote: 'Dobry nordic walking zaczyna się od naturalnego kroku; kij ma przedłużyć odepchnięcie, a nie sterować całym ciałem.',
    table: ['Plan pierwszych 4 tygodni nordic walking', ['Tydzień', 'Dawka', 'Główny cel'], [['1', '2 × 20 minut', 'Naturalny krok i rytm'], ['2', '2-3 × 20-25 minut', 'Ukośne wbicie kija'], ['3', '3 spokojne sesje', 'Odepchnięcie za biodro'], ['4', 'Jedna sesja 30-40 minut', 'Czas bez utraty techniki']]],
    faqs: [['Jak obliczyć długość kijów?', 'Pomnóż wzrost w centymetrach przez około 0,68, zaokrąglij do dostępnego rozmiaru i sprawdź ustawienie w ruchu.'], ['Czy nordic walking odciąża kolana?', 'Kijki zmieniają pracę całego ciała, ale nie gwarantują odciążenia każdej osobie; liczą się technika, tempo i objawy.'], ['Czy można chodzić codziennie?', 'Można zwiększać częstotliwość, jeśli dawka jest lekka i dobrze tolerowana, lecz początkujący nie musi zaczynać od codziennych sesji.'], ['Lepsze są kije stałe czy regulowane?', 'Stałe są prostsze i lekkie, regulowane łatwiej dopasować i przewozić; najważniejsze są pewna blokada i wygodny pasek.']],
    sources: [['Nordic walking in older adults - meta-analysis', 'https://pubmed.ncbi.nlm.nih.gov/28756746/'], ['Nordic walking and cardiovascular risk - meta-analysis', 'https://pubmed.ncbi.nlm.nih.gov/39476525/'], ['Nordic walking in the second half of life', 'https://pubmed.ncbi.nlm.nih.gov/26803510/'], ['WHO physical activity guidelines', 'https://www.who.int/publications/i/item/9789240015128']]
  },
  {
    file: 'okulary-do-czytania-trening-akomodacji-oka.html',
    title: 'Okulary do czytania po 50-tce: prezbiopia i ćwiczenia',
    h1: 'Okulary do czytania po 50-tce: czy ćwiczenia cofają prezbiopię?',
    media: [['prezbiopia-soczewka-schemat', 'Schemat oka z soczewką i mięśniem rzęskowym odpowiedzialnym za akomodację'], ['neuroplastycznosc-mozg-wzrok', 'Ilustracja połączeń między okiem a korą wzrokową mózgu'], ['gabor-patches-cwiczenia', 'Przykładowe wzory kontrastowe używane w badaniach percepcji wzrokowej']],
    description: 'Okulary do czytania nie osłabiają oczu, a ćwiczenia nie cofają prezbiopii. Sprawdź, skąd bierze się gorsze widzenie z bliska i kiedy potrzebne jest badanie.',
    quick: 'Okulary do czytania poprawiają ostrość z bliska i nie osłabiają oczu. Prezbiopia wynika głównie z wieku soczewki i jej malejącej zdolności do zmiany kształtu; ćwiczenia nie przywracają tej elastyczności. Reguła 20-20-20 może zmniejszać zmęczenie przy ekranie, ale nie leczy prezbiopii. Nagła utrata widzenia, błyski lub „zasłona” wymagają pilnej oceny okulistycznej.',
    takeaways: ['Noszenie właściwie dobranych okularów nie przyspiesza pogorszenia wzroku ani nie „rozleniwia” oka.', 'Ćwiczenia konwergencji mogą mieć zastosowanie w określonych zaburzeniach obuocznych, lecz nie cofają starzenia soczewki.', 'Gotowe okulary o tej samej mocy w obu szkłach nie korygują astygmatyzmu ani różnicy między oczami.', 'Nowe błyski, liczne męty, zasłona lub nagłe pogorszenie widzenia wymagają pilnej pomocy.'],
    sections: [
      ['Dlaczego po 50-tce tekst odsuwa się od oczu?', 'Prezbiopia rozwija się, gdy soczewka oka z wiekiem traci elastyczność i gorzej zwiększa moc optyczną do patrzenia z bliska. Litery stają się wyraźniejsze po odsunięciu, a przy słabym świetle szybciej pojawia się zmęczenie. To częsty proces związany z wiekiem, lecz badanie powinno wykluczyć inne przyczyny pogorszenia widzenia.', 'Kontrole wzroku warto umieścić w szerszym planie opisanym w <a href="badania-po-50.html">badaniach profilaktycznych po 50-tce</a>.'],
      ['Czy okulary do czytania osłabiają oczy?', 'Nie. Soczewki okularowe załamują światło tak, aby obraz ogniskował się prawidłowo na siatkówce. National Eye Institute podkreśla, że okulary nie zmieniają oka i nie powodują jego osłabienia. Wrażenie pogorszenia po zdjęciu szkieł wynika zwykle z porównania z wyraźnym obrazem albo postępu prezbiopii.', 'Jeżeli każde oko potrzebuje innej korekcji lub występuje astygmatyzm, gotowe okulary z drogerii nie zastąpią indywidualnej recepty.'],
      ['Co mogą dać ćwiczenia i przerwy od ekranu?', 'Przenoszenie wzroku w dal, częstsze mruganie i przerwy mogą ograniczać suchość oraz napięcie podczas długiej pracy z bliska. Reguła 20-20-20 oznacza spojrzenie co 20 minut przez około 20 sekund na obiekt oddalony o 20 stóp, czyli około 6 metrów. Nie ma jednak podstaw, by obiecywać cofnięcie prezbiopii.', 'Dla ogólnego zdrowia ważniejsze są regularny ruch i sen; ich praktyczny plan znajdziesz w <a href="sen-po-50.html">poradniku snu po 50-tce</a>. Mechanizmy szybkich ruchów oka wyjaśnia osobny artykuł o <a href="sakady-supresja-sakadyczna-mozg-ukrywa-slepe-chwile.html">sakadach i percepcji wzrokowej</a>.'],
      ['Kiedy okulary z półki nie wystarczą?', 'Badanie jest potrzebne, gdy obraz pozostaje nieostry mimo korekcji, jedno oko widzi wyraźnie gorzej, występuje ból, podwójne widzenie lub częste bóle głowy. Nagłe błyski, wysyp nowych mętów, ciemna zasłona albo nagła utrata widzenia wymagają pilnej oceny, bo nie są typowym objawem zwykłej prezbiopii.', 'Nie zwiększaj kolejnych mocy tylko po to, by zagłuszyć nowy objaw. Różnicę między korekcją a eksperymentalnym leczeniem oka pokazuje <a href="zastrzyk-cofajacy-starzenie-komorek-er-100-zycie-biosciences.html">analiza terapii ER-100</a>.']
    ],
    callouts: ['Reguła 20-20-20 pomaga robić przerwy podczas pracy z bliska, ale nie odbudowuje elastyczności soczewki.', 'Nagła zasłona, błyski, wysyp mętów lub utrata fragmentu pola widzenia wymagają pilnej oceny okulistycznej.'],
    quote: 'Okulary nie przegrywają walki z okiem — po prostu kompensują zmianę optyczną, której ćwiczenie nie potrafi cofnąć.',
    table: ['Prezbiopia, zmęczenie i objawy alarmowe', ['Sytuacja', 'Rozsądny krok', 'Czego nie obiecywać?'], [['Stopniowo gorsze czytanie', 'Badanie i właściwa korekcja', 'Że ćwiczenia cofną prezbiopię'], ['Suchość przy ekranie', 'Przerwy, mruganie, ocena powierzchni oka', 'Że mocniejsze szkła rozwiążą suchość'], ['Różnica między oczami', 'Indywidualna refrakcja', 'Że gotowe szkła będą wystarczające'], ['Błyski, zasłona, nagła utrata', 'Pilna ocena okulistyczna', 'Że to zwykłe starzenie']]],
    faqs: [['Czy okulary do czytania pogarszają wzrok?', 'Nie. Poprawiają ostrość podczas noszenia, ale nie zmieniają oka ani nie przyspieszają prezbiopii.'], ['Czy ćwiczenia oka mogą cofnąć prezbiopię?', 'Nie wykazano, aby przywracały elastyczność starzejącej się soczewki; mogą jedynie zmniejszać część dolegliwości pracy z bliska.'], ['Jak dobrać moc gotowych okularów?', 'Najbezpieczniej po badaniu, szczególnie gdy oczy różnią się, występuje astygmatyzm, ból głowy lub choroba oka.'], ['Kiedy potrzebna jest pilna pomoc?', 'Przy nagłej utracie widzenia, zasłonie, błyskach, wysypie nowych mętów, silnym bólu oka lub objawach neurologicznych.']],
    sources: [['National Eye Institute - eyeglasses', 'https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/refractive-errors/eyeglasses-refractive-errors'], ['National Eye Institute - presbyopia', 'https://www.nei.nih.gov/about/education-and-outreach/outreach-materials/presbyopia'], ['AAO EyeWiki - presbyopia', 'https://eyewiki.aao.org/Presbyopia'], ['Cochrane review - convergence insufficiency interventions', 'https://pubmed.ncbi.nlm.nih.gov/33263359/']]
  },
  {
    file: 'komorki-zombie-skora-starzenie-po-50-senoliza-abt-263.html',
    title: 'Komórki senescentne skóry i ABT-263: fakty',
    h1: 'Komórki senescentne skóry i ABT-263: co pokazują badania?',
    media: [['skora-starzenie-struktura', 'Schemat zmian struktury skóry związanych ze starzeniem'], ['komorka-senescencyjna-sasp', 'Schemat komórki senescentnej wydzielającej składniki SASP'], ['sasp-skladniki-kolaz', 'Ilustracja wybranych składników SASP i ich otoczenia tkankowego']],
    description: 'ABT-263 usuwał część komórek senescentnych w modelach skóry, ale nie jest kosmetykiem ani terapią anti-aging. Poznaj dane na myszach i ryzyko małopłytkowości.',
    quick: 'ABT-263, czyli navitoclax, usuwał część komórek senescentnych w hodowlach, skórze myszy i modelu ludzkiego przeszczepu skóry u myszy. To nie jest dowód odmładzania skóry człowieka ani preparat do samodzielnego użycia. W badaniu onkologicznym małopłytkowość stopnia 3-4 wystąpiła u 41% leczonych, dlatego droga od modelu przedklinicznego do bezpiecznej terapii skóry pozostaje długa.',
    takeaways: ['„Komórki zombie” to potoczne określenie komórek senescentnych, które przestały się dzielić i mogą wydzielać czynniki SASP.', 'Dane skórne dla ABT-263 pochodzą głównie z hodowli, myszy lub modelu przeszczepu ludzkiej skóry do myszy.', 'Navitoclax hamuje białka BCL-2/BCL-XL i może uszkadzać płytki krwi; nie jest kremem anti-aging.', 'Ochrona przed UV, niepalenie i leczenie chorób skóry mają dziś znacznie mocniejsze zastosowanie praktyczne.'],
    sections: [
      ['Czym są komórki senescentne i SASP?', 'Komórka senescentna trwale wychodzi z cyklu podziałowego w odpowiedzi na uszkodzenie lub stres, ale pozostaje metabolicznie aktywna. Część wydziela zestaw cytokin, proteaz i innych cząsteczek określany jako SASP. Senescencja pełni też role ochronne, między innymi ogranicza namnażanie uszkodzonych komórek, dlatego hasło „usunąć wszystkie” jest biologicznie błędne.', 'Starzenie skóry ma wiele mechanizmów, a ich opis nie powinien zastępować oceny konkretnej zmiany przez dermatologa.'],
      ['Co ABT-263 zrobił w badaniach skóry?', 'W badaniu z 2022 roku ABT-263 i ABT-737 usuwały senescentne fibroblasty w hodowli, a iniekcje do skóry starych myszy zmieniały markery i budowę tkanki. Praca z 2024 roku po 5 dniach miejscowego ABT-263 u myszy wykazała mniej markerów senescencji i szybsze późniejsze gojenie, ale także przejściowy stan zapalny.', 'Model przeszczepionej ludzkiej skóry nadal obejmował leczenie zwierzęcia, nie badanie kosmetyku u ludzi.'],
      ['Dlaczego navitoclax nie jest domowym senolitykiem?', 'Navitoclax blokuje białka z rodziny BCL-2, w tym BCL-XL potrzebne do przeżycia płytek krwi. W badaniu fazy 2 u chorych onkologicznych małopłytkowość stopnia 3-4 wystąpiła u 41% uczestników. Dawkowanie, droga podania i ryzyko nie pozwalają przenieść wyniku ze skóry myszy na samodzielny eksperyment człowieka.', 'Nie kupuj produktów powołujących się na ABT-263; podobne skróty marketingowe analizuje <a href="kriokomory-i-komory-hiperbaryczne-bezpieczenstwo-po-50.html">poradnik oceny eksperymentalnych terapii</a>. Inny mechanizm i poziom dowodów ma <a href="terapia-swiatlem-czerwonym-rlt-starzenie-komorek.html">terapia światłem czerwonym</a>.'],
      ['Co realnie można zrobić dla skóry po 50-tce?', 'Codzienna ochrona przed promieniowaniem UV, niepalenie, łagodne oczyszczanie i leczenie konkretnych chorób mają praktyczne uzasadnienie już dziś. Nowa, krwawiąca, szybko rosnąca lub zmieniająca się zmiana wymaga badania dermatologicznego. Sen, dieta i ruch wspierają zdrowie ogólne, ale nie są metodą selektywnego usuwania komórek senescentnych.', 'Rzetelne podstawy regeneracji porządkuje <a href="centrum-snu-po-50.html">Centrum Snu po 50-tce</a>, bez obietnicy „oczyszczania” skóry. Dane o peptydach kolagenowych oddziela <a href="kolagen-suplementacja-po-50.html">analiza suplementacji kolagenu</a>.']
    ],
    callouts: ['Wynik w skórze myszy lub ludzkim przeszczepie na myszy nie jest wynikiem leczenia skóry człowieka.', 'Navitoclax może powodować istotną małopłytkowość. Nie jest suplementem, kosmetykiem ani zatwierdzonym środkiem odmładzającym.'],
    quote: 'Senoliza jest kierunkiem badań, nie skrótem od ciekawego modelu zwierzęcego do bezpiecznego kremu dla człowieka.',
    table: ['Jak daleko są dowody dla ABT-263?', ['Poziom dowodu', 'Co zbadano?', 'Czego nie wiadomo?'], [['Hodowla komórek', 'Selektywna utrata części senescentnych fibroblastów', 'Bezpieczeństwo całego organizmu'], ['Skóra myszy', 'Markery, kolagen i gojenie', 'Efekt kosmetyczny u ludzi'], ['Przeszczep ludzkiej skóry u myszy', 'Zmiany w tkance przeszczepu', 'Wynik leczenia pacjenta'], ['Badania onkologiczne ludzi', 'Toksyczność systemowego navitoclaxu', 'Bezpieczna dawka anti-aging nie istnieje']]],
    faqs: [['Czy ABT-263 odmładza skórę człowieka?', 'Nie ma klinicznego dowodu takiej terapii. Opublikowane dane skórne dotyczą głównie komórek i modeli mysich.'], ['Czy komórki senescentne trzeba wszystkie usuwać?', 'Nie. Senescencja ma również funkcje ochronne i naprawcze, a jej celowanie wymaga selektywności oraz kontroli bezpieczeństwa.'], ['Czy navitoclax można kupić jako suplement?', 'Nie jest suplementem ani kosmetykiem anti-aging; to badany lek o istotnym ryzyku, między innymi małopłytkowości.'], ['Co oznacza SASP?', 'To zestaw cząsteczek wydzielanych przez część komórek senescentnych, mogący wpływać na sąsiednie komórki i środowisko tkanki.']],
    sources: [['ABT-263 in aged mouse skin', 'https://pubmed.ncbi.nlm.nih.gov/35274377/'], ['Topical ABT-263 and wound healing in mice', 'https://pubmed.ncbi.nlm.nih.gov/39630941/'], ['Human skin graft mouse model', 'https://pubmed.ncbi.nlm.nih.gov/36324221/'], ['Navitoclax phase 2 toxicity', 'https://pubmed.ncbi.nlm.nih.gov/22496272/']]
  },
  {
    file: 'optymalizacja-snu-po-50-jak-przestac-budzic-sie-o-3-w-nocy.html',
    title: 'Budzenie się o 3 w nocy po 50-tce: przyczyny i plan',
    h1: 'Budzenie się o 3 w nocy po 50-tce: przyczyny i plan działania',
    media: [['sen-po50-zmiany-biologiczne-sekcja1', 'Porównanie uproszczonej architektury snu młodszej i starszej osoby'], ['melatonina-suplementacja-sen-sekcja2', 'Infografika pokazująca, że dawka melatoniny wymaga indywidualnej oceny'], ['higiena-snu-cbti-metody-sekcja3', 'Najważniejsze elementy rutyny snu i terapii CBT-I']],
    description: 'Budzenie się o 3 w nocy nie wskazuje jednej przyczyny. Zrób w domu 14-dniowy dziennik, sprawdź alkohol, menopauzę i bezdech oraz poznaj podstawy CBT-I.',
    quick: 'Godzina 3:00 nie wskazuje jednej przyczyny ani „wyrzutu kortyzolu”. Przez 14 dni zapisuj porę snu, pobudki, alkohol, kofeinę, drzemki, uderzenia gorąca, oddawanie moczu i senność w dzień. Przy przewlekłej bezsenności leczeniem pierwszego wyboru jest CBT-I, nie sama higiena snu. Głośne chrapanie, bezdechy lub zasypianie za kierownicą wymagają oceny.',
    takeaways: ['Nocna pobudka staje się problemem klinicznym, gdy powtarza się, utrudnia ponowne zaśnięcie i pogarsza funkcjonowanie w dzień.', 'Stała godzina 3:00 nie rozpoznaje zaburzenia kortyzolu, wątroby ani innego narządu.', 'CBT-I łączy kontrolę bodźców, pracę z czasem w łóżku i przekonaniami; sama lista zasad higieny snu to mniej.', 'Chrapanie z przerwami oddechu, senność i poranne bóle głowy zwiększają podejrzenie bezdechu.'],
    sections: [
      ['Dlaczego możesz budzić się właśnie około 3 w nocy?', 'Pobudka może wypadać o podobnej porze, gdy rytm snu, pora położenia i bodźce są powtarzalne. Przyczyną bywa bezsenność, alkohol, menopauzalne uderzenia gorąca, ból, potrzeba oddania moczu, leki, depresja lub bezdech. Sama godzina nie pozwala wskazać hormonu ani narządu odpowiedzialnego za problem.', 'Pełny obraz zmian snu po 50-tce znajdziesz w <a href="centrum-snu-po-50.html">Centrum Snu po 50-tce</a>.'],
      ['Co zapisać przez pierwsze 14 dni?', 'Codziennie zanotuj godzinę położenia, szacowany czas zaśnięcia, liczbę i długość pobudek, pobudkę końcową, drzemki, kofeinę, alkohol, ruch i leki. Dodaj chrapanie, suchość w ustach, nocne oddawanie moczu, ból i uderzenia gorąca. Dziennik ujawnia wzorzec i daje lekarzowi więcej niż samo „budzę się o trzeciej”.', 'Nie oceniaj nocy zegarkiem co kilka minut; urządzenie konsumenckie szacuje sen i nie diagnozuje bezdechu.'],
      ['Co robić po nocnej pobudce?', 'Jeśli czujesz narastającą frustrację i nie zasypiasz, wyjdź z łóżka do spokojnego, przyciemnionego miejsca i wróć, gdy pojawi się senność. Utrzymuj stałą porę wstawania. To element kontroli bodźców stosowanej w CBT-I. Ograniczanie czasu w łóżku powinno być prowadzone ostrożnie przy padaczce, manii lub pracy wymagającej pełnej czujności.', 'Ogólne zasady regeneracji znajdziesz w <a href="sen-po-50.html">poradniku snu po 50-tce</a>, ale przewlekła bezsenność wymaga pełnego programu.'],
      ['Kiedy potrzebna jest diagnostyka lub leczenie CBT-I?', 'Pomocy szukaj, gdy problem występuje co najmniej 3 razy w tygodniu, trwa około 3 miesięcy lub wyraźnie zaburza dzień. Wcześniej reaguj przy głośnym chrapaniu z bezdechami, zasypianiu w niebezpiecznych sytuacjach, nasilonej depresji, bólu albo nowych objawach. CBT-I jest leczeniem pierwszego wyboru przewlekłej bezsenności u dorosłych.', 'Jeżeli dominuje stres i gonitwa myśli, nie sprowadzaj problemu do hormonu; pomocny kontekst daje <a href="jak-obnizyc-kortyzol-po-50-stres-oponka-brzuszna.html">artykuł o kortyzolu i stresie</a>. Objawy wymagające szerszej oceny porządkują <a href="badania-po-50.html">badania po 50-tce</a>.']
    ],
    callouts: ['Dziennik 14 dni ma obejmować także dni wolne. Bez tego łatwo przeoczyć wpływ nieregularnego wstawania, drzemek lub alkoholu.', 'Zasypianie za kierownicą, obserwowane bezdechy albo myśli samobójcze wymagają szybkiej profesjonalnej pomocy.'],
    quote: 'Godzina pobudki jest wskazówką w dzienniku, a nie diagnozą przypisaną do jednego hormonu lub narządu.',
    table: ['Co może podpowiedzieć dziennik nocnych pobudek?', ['Wzorzec', 'Możliwy trop', 'Następny krok'], [['Pobudka po alkoholu', 'Fragmentacja snu w drugiej części nocy', 'Porównać noce bez alkoholu'], ['Chrapanie i bezdechy', 'Podejrzenie obturacyjnego bezdechu', 'Ocena medyczna snu'], ['Uderzenia gorąca', 'Objawy menopauzalne', 'Rozmowa o leczeniu objawów'], ['Długi czas w łóżku, frustracja', 'Mechanizm utrwalający bezsenność', 'Pełne CBT-I']]],
    faqs: [['Czy budzenie się o 3 oznacza wysoki kortyzol?', 'Nie. Sama godzina nie rozpoznaje nadmiaru kortyzolu; potrzebne są objawy, historia i ewentualne celowane badania.'], ['Czy melatonina rozwiąże nocne pobudki?', 'Nie u każdego. Efekt zależy od przyczyny, preparatu i pory, a przewlekła bezsenność wymaga przede wszystkim oceny i CBT-I.'], ['Ile dni prowadzić dziennik snu?', 'Praktycznym minimum przed oceną są 14 kolejnych dni obejmujących dni robocze i wolne.'], ['Kiedy nocne wybudzenia są bezsennością przewlekłą?', 'Gdy trudność występuje co najmniej 3 razy tygodniowo przez około 3 miesiące, mimo warunków do snu, i pogarsza dzień.']],
    sources: [['ACP guideline - CBT-I first line', 'https://www.acponline.org/acp-newsroom/acp-recommends-cognitive-behavioral-therapy-as-initial-treatment-forchronic-insomnia'], ['CBT-I in older adults - meta-analysis', 'https://pubmed.ncbi.nlm.nih.gov/35968818/'], ['Behavioral insomnia therapy in older adults', 'https://pubmed.ncbi.nlm.nih.gov/36802110/'], ['National Institute on Aging - sleep', 'https://www.nia.nih.gov/health/sleep']]
  },
  {
    file: 'sen-po-50.html',
    title: 'Sen po 50-tce: ile godzin i jak poprawić jakość?',
    h1: 'Sen po 50-tce: ile godzin potrzeba i jak poprawić jakość?',
    media: [['sen-graf_optimized', 'Uproszczony wykres kolejnych faz snu w trakcie nocy'], ['sen_wieczor_ksiazka', 'Osoba czyta książkę przy spokojnym świetle przed snem'], ['bialko_przed_snem', 'Osoba przygotowuje niewielki wieczorny posiłek w kuchni']],
    description: 'Po 50-tce nadal zwykle potrzeba 7-9 godzin snu. Sprawdź plan stałej pory wstawania, rolę ruchu i światła oraz objawy bezdechu i przewlekłej bezsenności.',
    quick: 'Po 50-tce potrzeba snu nie spada automatycznie do 5-6 godzin. National Institute on Aging podaje dla starszych dorosłych około 7-9 godzin na noc. Zacznij od stałej pory wstawania, światła rano, regularnego ruchu i ograniczenia alkoholu wieczorem. Jeżeli bezsenność trwa około 3 miesięcy lub występują bezdechy, potrzebna jest ocena, a nie kolejny gadżet.',
    takeaways: ['Starszy wiek zmienia strukturę i porę snu, ale nie oznacza, że chroniczne 5 godzin jest wystarczające.', 'Najbardziej użytecznym punktem rytmu jest stała pora wstawania, także po gorszej nocy.', 'Alkohol może ułatwić zaśnięcie, a jednocześnie nasilać fragmentację w drugiej części nocy.', 'Przewlekłą bezsenność leczy się przede wszystkim CBT-I; higiena snu jest elementem, nie pełnym leczeniem.'],
    sections: [
      ['Ile godzin snu potrzeba po 50-tce?', 'National Institute on Aging wskazuje, że starsi dorośli, podobnie jak inni dorośli, potrzebują około 7-9 godzin snu. Indywidualna liczba różni się, dlatego oceniaj także funkcjonowanie w dzień. Regularna senność, problemy z koncentracją i odsypianie w dni wolne mogą wskazywać, że rzeczywista ilość lub jakość snu jest niewystarczająca.', 'Jeśli głównym problemem są pobudki, zastosuj <a href="optymalizacja-snu-po-50-jak-przestac-budzic-sie-o-3-w-nocy.html">14-dniowy dziennik nocnych wybudzeń</a>.'],
      ['Jak ustawić rytm dobowy bez obietnic „resetu hormonów”?', 'Wstawaj o zbliżonej porze każdego dnia i szukaj jasnego światła po przebudzeniu, najlepiej na zewnątrz. Wieczorem stopniowo zmniejszaj pobudzenie i jasność. Te sygnały pomagają synchronizować rytm, ale nie działają jak przycisk resetujący melatoninę, kortyzol, hormon wzrostu ani wszystkie procesy regeneracji.', 'Codzienny marsz może być prostym kotwiczeniem aktywności; plan daje <a href="nordic-walking-jak-zaczac-technika-kije-zdrowie.html">nordic walking po 50-tce</a>.'],
      ['Jak ruch, kofeina i alkohol wpływają na noc?', 'Regularny ruch sprzyja zdrowiu i może poprawiać sen, ale intensywny trening późnym wieczorem bywa pobudzający u części osób. Kofeina ma długi i zmienny okres działania, więc sprawdź indywidualnie wcześniejszą godzinę odcięcia. Alkohol nie jest lekiem nasennym: może skrócić zasypianie, lecz zwiększać wybudzenia i nasilać chrapanie.', 'Plan siłowy kończony z zapasem zamiast wyczerpania opisuje <a href="trening-3x30-dla-50-plus.html">trening 3x30 po 50-tce</a>.'],
      ['Kiedy problem ze snem wymaga diagnostyki?', 'Skonsultuj przewlekłą trudność zasypiania lub utrzymania snu, zwłaszcza gdy trwa około 3 miesięcy i pogarsza dzień. Głośne chrapanie, obserwowane bezdechy, poranne bóle głowy, częste nocne oddawanie moczu i senność zwiększają podejrzenie bezdechu. Nagłe zasypianie za kierownicą oznacza bezpośrednie zagrożenie.', 'Nie lecz podejrzenia bezdechu samą higieną snu; szerszą ścieżkę badań porządkuje <a href="badania-po-50.html">plan diagnostyczny po 50-tce</a>.']
    ],
    callouts: ['Siedem do dziewięciu godzin to zakres orientacyjny. Liczy się także ciągłość snu i funkcjonowanie w dzień.', 'Jeżeli przysypiasz za kierownicą, nie prowadź. Obserwowane bezdechy i nasilona senność wymagają szybkiej oceny.'],
    quote: 'Dobry sen nie polega na perfekcyjnym wyniku zegarka, lecz na wystarczającej nocy i bezpiecznym, sprawnym dniu.',
    table: ['Cztery dźwignie snu po 50-tce', ['Dźwignia', 'Działanie', 'Jak ocenić?'], [['Pora wstawania', 'Stała przez 7 dni', 'Mniejsza różnica między dniami'], ['Światło', 'Jasno rano, ciemniej wieczorem', 'Łatwiejsza regularność'], ['Ruch', 'Regularnie, bez późnego przeciążenia', 'Sen i reakcja następnego dnia'], ['Diagnostyka', 'Przy bezdechach lub przewlekłej bezsenności', 'Leczenie przyczyny, nie gadżetu']]],
    faqs: [['Czy po 50-tce wystarczy 6 godzin snu?', 'Nie można tego zakładać. Starsi dorośli zwykle nadal potrzebują około 7-9 godzin, choć indywidualna potrzeba się różni.'], ['Czy alkohol pomaga spać?', 'Może ułatwić zasypianie, ale często fragmentuje drugą część nocy i może nasilać chrapanie lub bezdech.'], ['Czy zegarek rozpoznaje bezdech senny?', 'Nie. Może wskazać sygnał do konsultacji, lecz rozpoznanie wymaga właściwej oceny medycznej i badania snu.'], ['Co jest leczeniem pierwszego wyboru bezsenności?', 'W przewlekłej bezsenności jest nim wieloskładnikowa terapia poznawczo-behawioralna CBT-I, nie sama lista zasad higieny snu.']],
    sources: [['National Institute on Aging - sleep', 'https://www.nia.nih.gov/health/sleep'], ['ACP guideline - CBT-I first line', 'https://www.acponline.org/acp-newsroom/acp-recommends-cognitive-behavioral-therapy-as-initial-treatment-forchronic-insomnia'], ['CBT-I in older adults - meta-analysis', 'https://pubmed.ncbi.nlm.nih.gov/35968818/'], ['WHO physical activity guidelines', 'https://www.who.int/publications/i/item/9789240015128']]
  },
  {
    file: 'ai-w-medycynie-czy-naprawde-pomaga-pacjentom-fakty-badania.html',
    title: 'AI w medycynie: kiedy naprawdę pomaga pacjentom?',
    h1: 'AI w medycynie: kiedy wynik algorytmu pomaga pacjentowi?',
    media: [['ai-medycyna-4-obszary-zastosowania-infografika', 'Cztery przykładowe zastosowania sztucznej inteligencji w opiece medycznej'], ['ai-lekarka-tablet-wyniki-analiza', 'Lekarka weryfikuje wynik analizy na ekranie tabletu'], ['ai-skryba-lekarz-pacjent-rozmowa', 'Lekarz rozmawia z pacjentką podczas wizyty w gabinecie']],
    description: 'AI bywa skuteczna w zadaniach medycznych, lecz większość badań nie mierzy wyników pacjentów. Sprawdź różnicę między benchmarkiem, badaniem i praktyką.',
    quick: 'AI może pomagać w wybranym zadaniu, ale dobry wynik na zbiorze danych nie dowodzi poprawy zdrowia pacjentów. Przegląd 4667 badań wykazał, że 88,2% było przedklinicznych, a tylko 2,4% stanowiły próby randomizowane. Pytaj o dokładne wskazanie, porównanie ze standardem, wyniki w podobnej populacji, nadzór człowieka oraz odpowiedzialność za decyzję.',
    takeaways: ['„AI w medycynie” obejmuje różne narzędzia: rekonstrukcję obrazu, triage, wykrywanie zmian, prognozę i generowanie tekstu.', 'Autoryzacja urządzenia dotyczy określonego zastosowania; nie zatwierdza każdej decyzji ani wszystkich przyszłych wersji.', 'W przeglądzie krajobrazu badań większość prac była przedkliniczna, a randomizowane próby stanowiły niewielki odsetek.', 'Pacjent powinien wiedzieć, do czego użyto narzędzia, kto zweryfikował wynik i co stanie się przy błędzie.'],
    sections: [
      ['Czym różni się trafność algorytmu od korzyści dla pacjenta?', 'Trafność mówi, jak model klasyfikuje dane względem punktu odniesienia. Korzyść kliniczna wymaga sprawdzenia, czy jego użycie zmienia decyzję, czas leczenia, powikłania lub inne ważne wyniki. Algorytm może osiągnąć wysoką czułość w laboratorium, a w praktyce tworzyć fałszywe alarmy, opóźnienia albo problemy w innej populacji.', 'Tak samo jak przy badaniu diagnostycznym, wynik musi być osadzony w objawach i całym procesie opisanym w <a href="badania-po-50.html">planie badań po 50-tce</a>. Różnice między danymi obrazowymi wyjaśnia <a href="rentgen-tomografia-ct-rezonans-mri-roznice-badania.html">poradnik RTG, CT i MRI</a>.'],
      ['Co pokazał przegląd 4667 badań medycznej AI?', 'Przegląd 218 przeglądów systematycznych zidentyfikował 4667 badań pierwotnych. Aż 4114, czyli 88,2%, sklasyfikowano jako przedkliniczne, a 113, czyli 2,4%, jako randomizowane próby. Wynik opisuje lukę między rozwojem modeli a oceną w realnej opiece; nie oznacza, że wszystkie narzędzia są nieskuteczne.', 'Sprawdź, czy cytowany artykuł dotyczy symulacji, retrospektywnego zbioru czy rzeczywistego wdrożenia z pacjentami.'],
      ['Czy urządzenie z AI po autoryzacji jest bezbłędne?', 'Nie. Lista FDA obejmuje urządzenia, które spełniły wymagania dla określonego zastosowania, lecz sama agencja zaznacza, że lista nie jest kompletna. Model może działać różnie po zmianie populacji, aparatu lub sposobu pracy. Potrzebne są monitoring, kontrola jakości, właściwe użycie i możliwość wychwycenia błędu przez człowieka.', 'Wyniku z aplikacji konsumenckiej nie traktuj jak rozpoznania ani podstawy do zmiany leczenia. Konkretny przykład oceny algorytmu omawia <a href="mira-ai-agent-sor-lepszy-od-lekarzy.html">analiza MIRA i SOR</a>.'],
      ['O co pacjent może zapytać lekarza lub placówkę?', 'Zapytaj, do jakiego zadania użyto AI, czy wynik wpłynął na decyzję, kto go zweryfikował i jakie są znane ograniczenia dla osób podobnych do Ciebie. Ustal, czy istnieje alternatywa bez narzędzia oraz kto odpowiada za dalszy krok. Nie wpisuj identyfikujących danych medycznych do ogólnego chatbota bez jasnych zasad prywatności.', 'Przy głośnych obietnicach stosuj te same kryteria dowodu co w <a href="zastrzyk-cofajacy-starzenie-komorek-er-100-zycie-biosciences.html">analizie eksperymentalnej terapii ER-100</a>.']
    ],
    callouts: ['Model może być świetny w benchmarku i nie poprawić opieki. Szukaj wyniku klinicznego, populacji i porównania ze standardem.', 'Ogólny chatbot może generować wiarygodnie brzmiący błąd. Nie zmieniaj leku ani nie opóźniaj pilnej pomocy na podstawie jego odpowiedzi.'],
    quote: 'W medycynie pytanie nie brzmi tylko „czy AI zgadła?”, lecz „czy jej użycie poprawiło właściwą decyzję dla właściwego pacjenta?”.',
    table: ['Cztery poziomy dowodu dla AI w medycynie', ['Poziom', 'Co sprawdza?', 'Ograniczenie'], [['Benchmark', 'Wynik na ustalonym zbiorze', 'Nie pokazuje przepływu pracy'], ['Walidacja zewnętrzna', 'Inna placówka lub populacja', 'Nadal może być retrospektywna'], ['Badanie prospektywne', 'Działanie w realnym procesie', 'Nie zawsze ma grupę porównawczą'], ['Próba randomizowana', 'Wpływ wdrożenia względem kontroli', 'Wynik dotyczy konkretnego zastosowania']]],
    faqs: [['Czy AI jest lepsza od lekarza?', 'Takie ogólne porównanie jest błędne. Wynik zależy od konkretnego zadania, danych, populacji, punktu odniesienia i współpracy człowieka.'], ['Czy urządzenie z listy FDA na pewno poprawia wyniki pacjentów?', 'Autoryzacja dotyczy bezpieczeństwa i skuteczności dla wskazanego użycia; nie musi oznaczać dowodu poprawy każdego wyniku klinicznego.'], ['Czy można wkleić wyniki badań do chatbota?', 'Nie podawaj danych identyfikujących bez jasnych zasad prywatności i nie traktuj odpowiedzi ogólnego modelu jako diagnozy.'], ['Jak rozpoznać mocne badanie AI?', 'Szukaj walidacji w podobnej populacji, prospektywnego projektu, porównania ze standardem oraz wyników ważnych dla pacjenta.']],
    sources: [['Clinical evaluation landscape of medical AI', 'https://www.nature.com/articles/s41746-026-02698-z'], ['FDA AI-enabled medical devices', 'https://www.fda.gov/medical-devices/software-medical-device-samd/artificial-intelligence-enabled-medical-devices'], ['WHO ethics and governance of AI for health', 'https://www.who.int/publications/i/item/9789240029200'], ['FDA lifecycle guidance for AI device software', 'https://www.fda.gov/media/184856/download']]
  },
  {
    file: 'regeneracja-ukladu-nerwowego-co-mowi-nauka.html',
    title: 'Regeneracja układu nerwowego po 50-tce: fakty',
    h1: 'Regeneracja układu nerwowego po 50-tce: co może się poprawić?',
    media: [['sekcja-1-neuroplastycznosc-vs-regeneracja', 'Porównanie neuroplastyczności mózgu z odrostem nerwu obwodowego'], ['sekcja-2-badania-neurony-mikroskop', 'Naukowiec analizuje tkankę nerwową pod mikroskopem'], ['sekcja-3-spokojny-sen-regeneracja', 'Starsza para śpi w spokojnej sypialni']],
    description: 'Nerwy obwodowe, mózg i rdzeń regenerują się inaczej. Poznaj różnicę między odrostem aksonu a neuroplastycznością oraz objawy wymagające pilnej diagnostyki.',
    quick: '„Regeneracja układu nerwowego” nie jest jednym procesem. Uszkodzony nerw obwodowy może odrastać, jeśli zachowane są odpowiednie warunki anatomiczne, natomiast mózg i rdzeń mają znacznie ograniczoną regenerację aksonów. Poprawa funkcji często wynika z neuroplastyczności i rehabilitacji, nie odtworzenia tkanki. Nagłe osłabienie jednej strony, opadnięcie twarzy lub zaburzenia mowy wymagają natychmiastowej pomocy.',
    takeaways: ['Nerwy obwodowe i ośrodkowy układ nerwowy różnią się zdolnością do odrostu po uszkodzeniu.', 'Neuroplastyczność oznacza zmianę działania i organizacji sieci, a nie automatyczne powstawanie nowych neuronów.', 'Tempo około 1 mm dziennie bywa orientacją po naprawie nerwu obwodowego, lecz nie przewiduje wyniku każdej osoby.', 'Rehabilitacja jest celowana do rozpoznania; suplement nie zastępuje diagnostyki ucisku, niedoboru, cukrzycy ani udaru.'],
    sections: [
      ['Czym różni się regeneracja nerwu od neuroplastyczności?', 'Regeneracja obwodowa może oznaczać odrost aksonu od miejsca uszkodzenia w kierunku mięśnia lub skóry. Neuroplastyczność to zmiana siły połączeń, strategii ruchu i organizacji sieci pod wpływem treningu lub uszkodzenia. Poprawa sprawności po udarze może więc wynikać z uczenia się układu, mimo że zniszczona tkanka nie została odtworzona.', 'Rehabilitację neurologiczną dobiera się do rozpoznania, co podkreśla <a href="badania-po-50.html">zasada diagnostyki przed planem</a>.'],
      ['Czy nerw obwodowy odrasta 1 mm dziennie?', 'Około 1 mm na dobę to często używana orientacja dla rosnącego aksonu po właściwej naprawie, a nie zegar gwarantujący czucie lub siłę. Wynik zależy od rodzaju i poziomu uszkodzenia, ciągłości osłonek, odległości do celu, wieku, czasu do leczenia oraz stanu mięśnia. Czasem konieczna jest operacja.', 'Narastające drętwienie lub osłabienie wymaga ustalenia przyczyny zamiast czekania według matematycznego terminu. Objawy korzeniowe i obrazowanie omawia <a href="dyskopatia-po-50.html">poradnik o dyskopatii po 50-tce</a>.'],
      ['Co ruch może zmienić w mózgu i układzie nerwowym?', 'Regularny trening może poprawiać funkcje poznawcze i sprawność oraz zmieniać część markerów związanych z plastycznością. Nie dowodzi to jednak „odrastania całego układu nerwowego”. Program powinien łączyć bezpieczny ruch tlenowy, siłę, równowagę i zadania specyficzne dla utraconej funkcji, szczególnie po chorobie neurologicznej.', 'Prosty start dla osoby bez ostrego deficytu daje <a href="trening-3x30-dla-50-plus.html">plan treningu 3x30</a>.'],
      ['Które objawy wymagają pilnej diagnostyki?', 'Dzwoń po pomoc przy nagłym opadnięciu twarzy, osłabieniu lub drętwieniu jednej strony, zaburzeniu mowy, widzenia, równowagi albo bardzo silnym nowym bólu głowy. Pilnej oceny wymaga też postępujące osłabienie kończyn, zaburzenie oddawania moczu z drętwieniem krocza lub osłabienie po urazie. Nie czekaj na „regenerację”.', 'Sen wspiera funkcjonowanie, ale nie leczy ostrego uszkodzenia; jego realną rolę opisuje <a href="sen-po-50.html">poradnik snu po 50-tce</a>.']
    ],
    callouts: ['„1 mm dziennie” jest orientacją biologiczną dla wybranych uszkodzeń nerwu obwodowego, nie terminem odzyskania pełnej funkcji.', 'Nagłe objawy FAST — twarz, ręka, mowa — oznaczają podejrzenie udaru i konieczność natychmiastowego wezwania pomocy.'],
    quote: 'Funkcja może wracać dzięki odrostowi, plastyczności, kompensacji i treningowi — tych mechanizmów nie wolno wrzucać do jednego hasła.',
    table: ['Regeneracja a neuroplastyczność', ['Sytuacja', 'Dominujący mechanizm', 'Co decyduje o planie?'], [['Uszkodzenie nerwu obwodowego', 'Możliwy odrost aksonu', 'Typ uszkodzenia i ciągłość nerwu'], ['Udar mózgu', 'Plastyczność i uczenie funkcji', 'Lokalizacja, czas i rehabilitacja'], ['Uraz rdzenia', 'Ograniczona regeneracja i kompensacja', 'Poziom oraz kompletność urazu'], ['Nieswoiste mrowienie', 'Nieznana przyczyna', 'Diagnostyka zamiast suplementu']]],
    faqs: [['Czy układ nerwowy regeneruje się po 50-tce?', 'Możliwa jest poprawa, ale mechanizm i zakres zależą od miejsca, rodzaju uszkodzenia, czasu leczenia i rehabilitacji.'], ['Czy nerwy zawsze rosną 1 mm dziennie?', 'Nie. To orientacyjna wartość dla wybranych nerwów obwodowych, a odzyskanie funkcji zależy od wielu dodatkowych warunków.'], ['Czy BDNF oznacza powstawanie nowych neuronów?', 'Nie. Zmiana stężenia markera nie jest równoznaczna z odtworzeniem uszkodzonej tkanki nerwowej u człowieka.'], ['Jaki suplement regeneruje nerwy?', 'Nie ma uniwersalnego suplementu. Leczy się konkretną przyczynę, np. niedobór, ucisk, cukrzycę lub uraz, po właściwej diagnostyce.']],
    sources: [['WHO rehabilitation interventions - neurological conditions', 'https://www.who.int/publications/i/item/9789240071131'], ['Exercise and neuroplasticity in neurological disease', 'https://pubmed.ncbi.nlm.nih.gov/39257645/'], ['Exercise dose and cognition in aging', 'https://pubmed.ncbi.nlm.nih.gov/30105166/'], ['Exercise and brain volume - meta-analysis', 'https://pubmed.ncbi.nlm.nih.gov/33640675/']]
  }
];

function esc(value) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderTable([caption, headers, rows]) {
  return `<div class="article-table-wrap"><table class="article-table"><caption>${caption}</caption><thead><tr>${headers.map((item) => `<th scope="col">${item}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((item, index) => index === 0 ? `<th scope="row">${item}</th>` : `<td>${item}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function renderMedia([basename, alt]) {
  return `<figure class="article-figure reveal"><picture><source srcset="./assets/${basename}.avif" type="image/avif"><source srcset="./assets/${basename}.webp" type="image/webp"><img src="./assets/${basename}.jpg" alt="${esc(alt)}" loading="lazy" decoding="async"></picture><figcaption>${alt}</figcaption></figure>`;
}

function renderBody(article, hub, share) {
  const sections = article.sections.map(([heading, first, second], index) => {
    const callout = index === 1 || index === 3 ? `<aside class="highlight-box highlight-box--accent"><h3>${index === 1 ? 'Jak to zastosować?' : 'Warunek bezpieczeństwa'}</h3><p>${article.callouts[index === 1 ? 0 : 1]}</p></aside>` : '';
    const media = article.media[index] ? renderMedia(article.media[index]) : '';
    return `<h2>${heading}</h2><p${index === 0 ? ' class="drop-cap"' : ''}>${first}</p><p>${second}</p>${callout}${media}`;
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
    if (data['@type'] === 'ClaimReview' && article.file === 'bieganie-niszczy-kolana.html') {
      data.claimReviewed = 'Rekreacyjne bieganie po 50-tce zawsze niszczy kolana.';
      data.dateModified = MODIFIED;
      if (data.reviewRating) data.reviewRating.alternateName = 'Fałsz - badania nie potwierdzają takiej reguły';
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
  html = html.replace(/(<meta (?:property="og:image"|name="twitter:image") content="https:\/\/fitpo50\.pl\/assets\/)([^"?]+)\.webp(">)/g, (whole, before, basename, after) => {
    return fs.existsSync(path.join(ROOT, 'assets', `${basename}.jpg`)) ? `${before}${basename}.jpg${after}` : whole;
  });
  return html;
}

function imageDimensions(file) {
  const buffer = fs.readFileSync(file);
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset < buffer.length - 9) {
      if (buffer[offset] !== 0xff) { offset += 1; continue; }
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) return [buffer.readUInt16BE(offset + 7), buffer.readUInt16BE(offset + 5)];
      offset += 2 + length;
    }
  }
  if (buffer.toString('ascii', 1, 4) === 'PNG') return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
  return [];
}

function addImageDimensions(html) {
  return html.replace(/<img\b([^>]*?)>/g, (whole, attrs) => {
    const match = attrs.match(/src="([^"]+)"/);
    if (!match) return whole;
    const full = path.join(ROOT, match[1].replace(/^\.\//, ''));
    if (!fs.existsSync(full)) return whole;
    const [width, height] = imageDimensions(full);
    if (!width || !height) return whole;
    const next = attrs.replace(/\s+width="\d+"/g, '').replace(/\s+height="\d+"/g, '').replace(/\s*\/?$/, '');
    return `<img${next} width="${width}" height="${height}">`;
  });
}

function useRasterFallbacks(html) {
  return html.replace(/(<img\b[^>]*?src=")([^"?]+)\.webp("[^>]*>)/g, (whole, before, source, after) => {
    const jpg = `${source}.jpg`;
    return fs.existsSync(path.join(ROOT, jpg.replace(/^\.\//, ''))) ? `${before}${jpg}${after}` : whole;
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
  html = useRasterFallbacks(html);
  html = addImageDimensions(html).replace(/‑/g, '-').replace(/₂/g, '2');
  fs.writeFileSync(filePath, html);
  console.log(`[BATCH-7] repaired ${article.file}`);
}
