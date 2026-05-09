#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const FAQ_BY_FILE = {
  'trening-3x30-dla-50-plus.html': [
    {
      q: 'Ile razy w tygodniu ćwiczyć po 50-tce, żeby były efekty?',
      a: 'Dla większości osób po 50-tce dobry start to 3 treningi tygodniowo po około 30 minut. Kluczowa jest regularność i progres krok po kroku, a nie jednorazowe mocne zrywy.'
    },
    {
      q: 'Czy 3 treningi po 30 minut naprawdę wystarczą?',
      a: 'Tak, jeśli plan łączy siłę, mobilność i podstawową wydolność. Taki układ poprawia sprawność, samopoczucie i codzienne funkcjonowanie, zwłaszcza gdy utrzymasz go przez kilka tygodni.'
    },
    {
      q: 'Jak zacząć, gdy wracam do ruchu po długiej przerwie?',
      a: 'Zacznij od łatwej wersji ćwiczeń i zostaw zapas sił po każdym treningu. Pierwszym celem jest nawyk i brak przeciążenia, dopiero później zwiększanie trudności.'
    },
    {
      q: 'Po jakim czasie widać pierwsze efekty po 50-tce?',
      a: 'Najczęściej pierwsze efekty pojawiają się po 3–6 tygodniach regularnego treningu: więcej energii, lepszy sen i łatwiejsze wykonywanie codziennych czynności.'
    }
  ],
  'apob-apoa-badania-cholesterol.html': [
    {
      q: 'Co jest ważniejsze po 50-tce: lipidogram czy ApoB?',
      a: 'Lipidogram nadal jest potrzebny, ale ApoB często lepiej pokazuje rzeczywiste ryzyko sercowo-naczyniowe, bo odzwierciedla liczbę cząsteczek aterogennych, a nie tylko poziom cholesterolu.'
    },
    {
      q: 'Czy można mieć dobry LDL i jednocześnie podwyższone ryzyko?',
      a: 'Tak. Przy prawidłowym LDL ApoB może być podwyższone, co sugeruje większą liczbę cząsteczek uszkadzających naczynia. Dlatego warto patrzeć na oba wskaźniki łącznie.'
    },
    {
      q: 'Kiedy warto zbadać ApoB i ApoA-1?',
      a: 'Szczególnie po 40.–50. roku życia, przy historii chorób serca w rodzinie, nadciśnieniu, insulinooporności, nadwadze lub gdy wyniki klasycznego lipidogramu są niejednoznaczne.'
    },
    {
      q: 'Czy aktywność fizyczna zwalnia z kontroli badań serca?',
      a: 'Nie. Trening bardzo pomaga, ale nie zastępuje diagnostyki. Najbezpieczniej łączyć ruch z okresowymi badaniami i konsultacją wyników.'
    }
  ],
  'powrot-do-formy-po-50-kompletny-przewodnik.html': [
    {
      q: 'Od czego zacząć powrót do formy po 50-tce?',
      a: 'Najpierw od prostego planu i bazowych badań, potem od regularnych, krótkich treningów. Najważniejsze jest bezpieczne wejście w rytm, a nie szybkie tempo.'
    },
    {
      q: 'Czy po 50-tce trzeba od razu iść na siłownię?',
      a: 'Nie. Możesz zacząć od marszu, ćwiczeń z masą ciała i prostych ruchów w domu. Siłownia to opcja, nie warunek startu.'
    },
    {
      q: 'Jak uniknąć kontuzji na początku?',
      a: 'Wybieraj łatwiejsze warianty ćwiczeń, zwiększaj obciążenie stopniowo i zostawiaj dzień na regenerację. Ból ostry lub narastający to sygnał, żeby skonsultować plan.'
    },
    {
      q: 'Co jest ważniejsze: dieta czy trening?',
      a: 'Oba elementy są ważne, ale na starcie najlepiej uprościć dietę i utrzymać regularny ruch. Stabilne nawyki dają lepszy efekt niż perfekcja przez tydzień.'
    }
  ],
  'badania-po-50.html': [
    {
      q: 'Jakie badania warto robić regularnie po 50-tce?',
      a: 'Najczęściej warto zacząć od morfologii, glukozy, lipidogramu, ciśnienia, funkcji nerek i wątroby oraz badań zależnych od płci i historii rodzinnej.'
    },
    {
      q: 'Jak często powtarzać badania profilaktyczne po 50?',
      a: 'Podstawowe badania zwykle raz w roku, a częściej przy chorobach przewlekłych lub nieprawidłowych wynikach. Ostateczną częstotliwość ustala lekarz.'
    },
    {
      q: 'Czy przy dobrym samopoczuciu też trzeba się badać?',
      a: 'Tak. Wiele problemów rozwija się bez objawów, dlatego profilaktyka ma sens nawet wtedy, gdy czujesz się dobrze.'
    },
    {
      q: 'Które wyniki omówić z lekarzem w pierwszej kolejności?',
      a: 'Priorytet mają wyniki odbiegające od normy, zwłaszcza dotyczące glikemii, lipidów, ciśnienia oraz wskaźników stanu zapalnego i funkcji narządów.'
    }
  ],
  'dlaczego-bieznia-to-za-malo.html': [
    {
      q: 'Dlaczego sama bieżnia to za mało po 50-tce?',
      a: 'Marsz lub bieg poprawiają wydolność, ale nie zastępują treningu siłowego i ćwiczeń równowagi. Po 50-tce potrzebujesz bodźców dla mięśni, stawów i układu nerwowego.'
    },
    {
      q: 'Czy cardio bez siłowni daje efekty zdrowotne?',
      a: 'Daje, ale niepełne. Najlepsze rezultaty zwykle daje połączenie cardio z treningiem oporowym 2–3 razy w tygodniu.'
    },
    {
      q: 'Jak połączyć bieżnię z treningiem siłowym w praktyce?',
      a: 'Prosty model to 2 dni siłowe i 2 dni cardio tygodniowo, z jednym dniem lżejszym lub wolnym. Taki układ łatwo utrzymać i stopniowo rozwijać.'
    },
    {
      q: 'Co zrobić, gdy po cardio bolą kolana lub plecy?',
      a: 'Zmniejsz objętość i intensywność, popraw technikę, dołóż ćwiczenia wzmacniające i mobilizujące. Jeśli ból się utrzymuje, warto skonsultować się ze specjalistą.'
    }
  ]
};

function toFaqJson(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a
      }
    }))
  };
}

function replaceFaqSchema(html, faqItems) {
  const scripts = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
  for (const match of scripts) {
    const full = match[0];
    const content = match[1];
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      continue;
    }

    if (parsed && typeof parsed === 'object' && parsed['@type'] === 'FAQPage') {
      const faqJson = JSON.stringify(toFaqJson(faqItems), null, 2);
      return html.replace(full, `<script type="application/ld+json">\n${faqJson}\n</script>`);
    }
  }
  return html;
}

let updated = 0;
for (const [file, faqItems] of Object.entries(FAQ_BY_FILE)) {
  const filePath = path.join(ROOT, file);
  if (!fs.existsSync(filePath)) continue;
  const original = fs.readFileSync(filePath, 'utf8');
  const next = replaceFaqSchema(original, faqItems);
  if (next !== original) {
    fs.writeFileSync(filePath, next, 'utf8');
    updated += 1;
  }
}

console.log(`FAQ quality tuning complete. Updated files: ${updated}`);
