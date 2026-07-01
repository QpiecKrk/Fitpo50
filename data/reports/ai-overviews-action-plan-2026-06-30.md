# FitPo50 AI Overviews / AEO / GEO Action Plan

Wygenerowano: 2026-06-30

## Decyzja operacyjna

Nie budujemy osobnego, magicznego "AI SEO". Dla Google AI Overviews bazą zostaje normalne SEO: indeksowalność, dobra struktura HTML, treść widoczna bez ciężkiego JS, sensowne linkowanie wewnętrzne, spójne dane strukturalne i jasne odpowiedzi na górze artykułów.

Jednocześnie dla ChatGPT, Gemini, Perplexity i innych answer engines warto wzmacniać warstwę AEO/GEO: krótkie odpowiedzi, FAQ, klastry tematyczne, źródła, jednoznaczne definicje i własne testy zapytań.

## Co FitPo50 już ma dobrze

- `llms.txt` i `llms-full.txt`: PASS, braki 0 według `npm run growth:llms-check`.
- Quick answers: średni wynik 93% według `npm run growth:quick-answer-score`.
- Structured data: średni wynik 100% według `npm run growth:structured-score`; słabsze tylko `jedz-wiecej-po-50.html` i `sen-po-50.html` przez mniej niż 4 cytacje.
- Artykuły używają `BlogPosting`, `FAQPage`, `BreadcrumbList`, `speakable`, sekcji `Szybka odpowiedź` i `Kluczowe wnioski`.
- Eksport automatycznie generuje `llms-full.txt`, search index, sitemap lastmod i odpala predeploy gate.
- Mamy już huby tematyczne, m.in. trening siłowy i cholesterol.

## Ważna korekta do raportu z Perplexity

`llms-full.txt` warto utrzymywać, ale nie należy mówić, że Google AI Overviews oficjalnie go czyta. Google w oficjalnych materiałach akcentuje standardową dostępność treści w wyszukiwarce: crawlability, indeksację, zgodność danych strukturalnych z widoczną treścią, jakość treści i page experience.

`llms-full.txt` zostaje jako dobra warstwa AIO dla zewnętrznych crawlerów, narzędzi AI i kontroli własnej bazy wiedzy, ale nie zastępuje sitemap, HTML-a, linkowania i indeksacji.

Źródła oficjalne:
- https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
- https://developers.google.com/search/docs/appearance/ai-features

## Co poprawić w pierwszej kolejności

1. Uzupełnić cytacje w dwóch artykułach z niższym structured score:
   - `jedz-wiecej-po-50.html`
   - `sen-po-50.html`
   Cel: min. 4 realne źródła zgodne z `BlogPosting.citation`.

2. Zrobić falę "Answer Pack" dla najważniejszych hubów:
   - `centrum-treningu-silowego-po-50.html`
   - `centrum-cholesterolu-po-50.html`
   - przyszłe/istniejące centrum snu
   Każdy hub powinien mieć na górze: definicję, szybkie rozstrzygnięcie, linki do podtematów, FAQ i jasne "kiedy uważać".

3. Dodać brakujący regularny monitoring AI visibility:
   - 10-20 stałych pytań do ChatGPT/Gemini/Perplexity.
   - Wynik: czy pojawia się FitPo50, czy podawane są błędne informacje, które źródła są cytowane zamiast nas.
   - Raport raz w miesiącu do `data/reports/ai-visibility-monitor.md`.

4. Uporządkować brand entity:
   - spójnie używać `FitPo50` / `FitPo50.pl`, nie `fitpo50` w tekstach widocznych dla użytkownika, chyba że chodzi o domenę.
   - sprawdzić `Organization.sameAs`, opis autora i `o-mnie.html`.

5. Nie dodawać generycznych bloków.
   Każdy nowy AEO/GEO fragment musi mieć konkretną decyzję, liczbę, warunek lub próg. Przykład dobry: "jeśli LDL-C wzrośnie po keto, sprawdź ApoB po 8-12 tygodniach". Przykład zły: "warto wdrażać zdrowe zasady krok po kroku".

## Kolejka prac treściowych

Priorytet 1:
- `sen-po-50.html`: dołożyć realne źródła, wzmocnić szybkie odpowiedzi pod pytania: "dlaczego budzę się o 3 w nocy po 50", "ile snu po 50", "sen a kortyzol".
- `jedz-wiecej-po-50.html`: dołożyć realne źródła i konkretne progi: białko, deficyt, energia, utrata mięśni.

Priorytet 2:
- Hub snu: centrum z linkami do snu, kortyzolu, regeneracji, treningu, alkoholu/kofeiny, bezdechu i nocnego wybudzania.
- Hub badań po 50: połączyć `badania-po-50.html`, `badania-krwi-po-50-jak-czesto.html`, ApoB, markery krwi, cholesterol i keto.

Priorytet 3:
- Miesięczny test AI visibility z listą promptów:
  - "Jak zacząć ćwiczyć po 50 roku życia?"
  - "Jaki trening siłowy po 50 przy nadciśnieniu?"
  - "Czy keto po 50 podnosi cholesterol?"
  - "Ile białka po 50 roku życia?"
  - "Co zrobić, gdy budzę się o 3 w nocy po 50?"

## Czego nie robić

- Nie tworzyć pustych stron "pod AI" bez realnych danych.
- Nie dopisywać ogólnikowych akapitów do źródeł ani FAQ.
- Nie zakładać, że samo `llms-full.txt` zwiększy widoczność w Google AI Overviews.
- Nie gonić HowTo schema wszędzie. Dodawać tylko tam, gdzie artykuł faktycznie opisuje procedurę krok po kroku widoczną w treści.

## Następny rekomendowany sprint

Sprint AIO-1:
1. Poprawić `sen-po-50.html`.
2. Poprawić `jedz-wiecej-po-50.html`.
3. Wygenerować PDF-y tylko dla tych dwóch stron.
4. Uruchomić `assets:mirror:sync`, `sitemap:lastmod:sync`, eksport i predeploy.
5. Zgłosić w GSC dwa URL-e oraz sitemap.
