<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<!-- Google tag (gtag.js) -->
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag("js", new Date());

  gtag("config", "G-S21SKTVM7K");
<title>Moje Sukcesy | FitPo50</title>
<meta name="description" content="Kalendarz moich wpisów i sukcesów na drodze do lepszej formy po 50-tce.">
<meta name="robots" content="index,follow">
<meta property="og:title" content="Moje Sukcesy | FitPo50">
<meta property="og:description" content="Kalendarz moich wpisów i sukcesów na drodze do lepszej formy po 50-tce.">
<meta property="og:type" content="website">
<meta property="og:url" content="https://fitpo50.pl/moje-sukcesy.html">
<meta property="og:image" content="https://fitpo50.pl/assets/Hero_Porady1.png">
<meta property="og:locale" content="pl_PL">
<link rel="canonical" href="https://fitpo50.pl/moje-sukcesy.html">

<link href="https://api.fontshare.com/v2/css?f[]=zodiak@400,500,600,700&display=swap" rel="stylesheet">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Work+Sans:wght@300..700&display=swap" rel="stylesheet">

<link rel="stylesheet" href="./base.css">
<link rel="stylesheet" href="./style.css?v=1.1">

<style>
.sukcesy-hero {
  position: relative;
  min-height: 45vh;
  display: flex;
  align-items: center;
  overflow: hidden;
  padding-top: var(--space-20);
  background: linear-gradient(135deg, rgba(14, 143, 170, 0.95) 0%, rgba(19, 72, 93, 0.98) 100%);
  color: white;
  text-align: center;
}

.sukcesy-hero__content {
  position: relative;
  z-index: 1;
  width: 100%;
  padding: var(--space-10) 0;
}

.sukcesy-hero__title {
  font-family: var(--font-display);
  font-size: clamp(2.35rem, 5vw, 4.5rem);
  line-height: 1;
  letter-spacing: -0.04em;
  margin-bottom: var(--space-4);
}

.sukcesy-hero__subtitle {
  font-size: 1.1rem;
  line-height: 1.65;
  max-width: 58ch;
  margin: 0 auto;
  color: rgba(255, 255, 255, 0.86);
}

@media (max-width: 640px) {
  .sukcesy-hero {
    min-height: auto;
    padding-top: var(--space-14);
  }
}

.calendar-nav-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  margin-top: var(--space-6);
}

.calendar-nav-controls .btn[disabled] {
  opacity: 0.5;
  cursor: not-allowed;
  background: var(--color-surface-2);
  color: var(--color-text-muted);
  border-color: var(--color-border);
}
</style>
</head>
<body>

<header class="header" id="top">
  <div class="container header__inner">
    <a href="index.html#top" class="logo" aria-label="FitPo50 — strona główna">
      <img src="./assets/logo.jpg" alt="FitPo50" class="logo__img" width="48" height="48">
    </a>
    <nav class="header__desktop-nav" aria-label="Nawigacja pulpit">
      <a href="index.html#o-nas" class="nav__link">O mnie</a>
      <a href="index.html#baza-wiedzy" class="nav__link">Baza wiedzy</a>
      <a href="porady.html" class="nav__link">Porady</a>
      <a href="moje-sukcesy.html" class="nav__link">Moje Sukcesy</a>
      <a href="https://www.instagram.com/fitpo50" class="nav__link" target="_blank" rel="noopener noreferrer">Instagram</a>
    </nav>
  </div>
  <nav class="header__scroll" aria-label="Kategorie mobilne">
    <div class="header__scroll-inner">
      <a href="index.html" class="header__scroll-link">Główna</a>
      <a href="index.html#baza-wiedzy" class="header__scroll-link">Wiedza</a>
      <a href="index.html#trendy" class="header__scroll-link">Trendy</a>
      <a href="porady.html" class="header__scroll-link">Porady</a>
      <a href="moje-sukcesy.html" class="header__scroll-link header__scroll-link--active">Moje Sukcesy</a>
      <a href="https://www.instagram.com/fitpo50" target="_blank" rel="noopener noreferrer" class="header__scroll-link">Instagram</a>
    </div>
  </nav>
</header>

<main>
  <section class="sukcesy-hero">
    <div class="container sukcesy-hero__content reveal">
      <h1 class="sukcesy-hero__title">Moje Sukcesy</h1>
      <p class="sukcesy-hero__subtitle">Śledź moje postępy, nowe wpisy i przemyślenia dzień po dniu. Wybierz miesiąc i kliknij fistaszek, aby przeczytać wpis z tego dnia.</p>
    </div>
  </section>

  <section class="section-padding">
    <div class="container">
      
      <!-- Kontener Kalendarza -->
      <div class="calendar-viewport reveal">
        <div class="calendar-track" id="calendar-track">
          <!-- Wygenerowane miesiące wejdą tutaj -->
        </div>
      </div>

      <!-- Kontrolki nawigacji pod kalendarzem -->
      <div class="calendar-nav-controls reveal">
        <button type="button" class="btn btn--outline" id="cal-prev" aria-label="Poprzedni miesiąc" style="min-width: 140px; justify-content: center;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"></path></svg> Wstecz
        </button>
        <button type="button" class="btn btn--outline" id="cal-next" aria-label="Następny miesiąc" style="min-width: 140px; justify-content: center;">
          Dalej <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"></path></svg>
        </button>
      </div>

    </div>
  </section>
</main>

<footer class="footer" id="footer">
  <div class="container">
    <div class="footer__inner">
      <div class="footer__brand">
        <a href="index.html#top" class="logo" aria-label="FitPo50 — strona główna">
          <img src="./assets/logo.jpg" alt="FitPo50" class="logo__img logo__img--footer" width="72" height="72">
        </a>
        <p class="footer__brand-desc">Praktyczna wiedza o treningu, diecie i regeneracji dla osób po 50‑tce. Od Grześka — nie trenera, nie lekarza, po prostu kogoś, kto też ćwiczy.</p>
      </div>

      <div>
        <h4 class="footer__heading">Nawigacja</h4>
        <ul class="footer__links" role="list">
          <li><a href="index.html">Strona Główna</a></li>
          <li><a href="index.html#o-nas">O mnie</a></li>
          <li><a href="index.html#baza-wiedzy">Baza wiedzy</a></li>
          <li><a href="porady.html">Porady</a></li>
          <li><a href="moje-sukcesy.html" style="color: var(--color-primary);">Moje Sukcesy</a></li>
        </ul>
      </div>

      <div>
        <h4 class="footer__heading">Czytelnia</h4>
        <ul class="footer__links" role="list">
          <li><a href="jak-zaczac-na-silowni-po-50.html">Jak zacząć na siłowni po 50-tce</a></li>
          <li><a href="suplementacja-po-50.html">Białko i kreatyna po 50-tce</a></li>
          <li><a href="dieta-po-50.html">Dieta po 50-tce kontra nawyki</a></li>
        </ul>
      </div>
    </div>

    <div class="footer__bottom">
      <p class="footer__disclaimer">⚠️ Uwaga: Autor nie jest lekarzem, trenerem personalnym ani dietetykiem. Treści mają charakter informacyjny i edukacyjny. Przed rozpoczęciem treningów skonsultuj się ze specjalistą — szczególnie jeśli masz schorzenia przewlekłe lub urazy.</p>
    </div>
  </div>
</footer>


<!-- Skrypt obsługi modułu Kalendarza -->
document.addEventListener("DOMContentLoaded", () => {
  
  // ===========================================
  // TUTAJ DODAJESZ SWOJE NOWE WPISY (YYY-MM-DD)
  // ===========================================
  const userEntries = [
    { date: "2026-04-01", url: "testowy-wpis-url.html" },
    { date: "2026-04-12", url: "test-2-url.html" } // Przykładowy wpis
  ];

  const startDate = new Date(2025, 0, 1); // Generuj miesiące od Stycznia 2025
  const endDate = new Date(2028, 11, 31); // Do Grudnia 2028
  
  const track = document.getElementById('calendar-track');
  const monthNames = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"];
  
  let currentMonthIndex = 0;
  let today = new Date();
  
  let monthIter = new Date(startDate);
  let slides = [];
  
  while(monthIter <= endDate) {
    let year = monthIter.getFullYear();
    let month = monthIter.getMonth();
    
    // Sprawdzanie czy to obecny miesiąc w roku do początkowego centrowania karuzeli
    let isCurrentMonth = (year === today.getFullYear() && month === today.getMonth());
    if (isCurrentMonth) {
      currentMonthIndex = slides.length;
    }

    let slide = document.createElement('div');
    slide.className = 'calendar-month';
    slide.innerHTML = `
      <div class="calendar-month__header">
        <h2 class="calendar-month__title">${monthNames[month]} ${year}</h2>
      </div>
      <div class="calendar-grid">
        <div class="calendar-day-header">Pon</div>
        <div class="calendar-day-header">Wto</div>
        <div class="calendar-day-header">Śro</div>
        <div class="calendar-day-header">Czw</div>
        <div class="calendar-day-header">Pią</div>
        <div class="calendar-day-header">Sob</div>
        <div class="calendar-day-header">Nie</div>
      </div>
    `;
    
    const grid = slide.querySelector('.calendar-grid');
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    let firstDayIndex = firstDay.getDay() - 1;
    if (firstDayIndex === -1) firstDayIndex = 6;
    
    for (let i = 0; i < firstDayIndex; i++) {
        let empty = document.createElement('div');
        empty.className = 'calendar-day calendar-day--empty';
        grid.appendChild(empty);
    }
    
    for (let d = 1; d <= lastDay.getDate(); d++) {
        let dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        
        // Czy w danym dniu był wpis?
        let entry = userEntries.find(e => e.date === dateStr);
        // Czy to dzisiaj?
        let isToday = (dateStr === `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`);
        
        let dayEl;
        
        if (entry) {
            dayEl = document.createElement('a');
            dayEl.href = entry.url;
            dayEl.className = 'calendar-day calendar-day--entry';
            if (isToday) dayEl.classList.add('calendar-day--today');
            dayEl.innerHTML = `
              <span class="calendar-day__number">${d}</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="calendar-day__icon"><path d="M20 6L9 17l-5-5"/></svg>
            `;
        } else {
            dayEl = document.createElement('div');
            dayEl.className = 'calendar-day';
            if (isToday) dayEl.classList.add('calendar-day--today');
            dayEl.innerHTML = `
               <span class="calendar-day__number">${d}</span>
            `;
        }
        grid.appendChild(dayEl);
    }
    
    slides.push(slide);
    track.appendChild(slide);
    
    monthIter.setMonth(month + 1);
  }

  // Obsługa karuzeli kalendarza
  const prevBtn = document.getElementById('cal-prev');
  const nextBtn = document.getElementById('cal-next');
  
  function updateCarousel() {
    track.style.transform = `translateX(-${currentMonthIndex * 100}%)`;
    prevBtn.disabled = currentMonthIndex === 0;
    nextBtn.disabled = currentMonthIndex === slides.length - 1;
  }
  
  prevBtn.addEventListener('click', () => {
     if(currentMonthIndex > 0) {
        currentMonthIndex--;
        updateCarousel();
     }
  });

  nextBtn.addEventListener('click', () => {
    if(currentMonthIndex < slides.length - 1) {
       currentMonthIndex++;
       updateCarousel();
    }
  });
  
  // Na starcie przesuń się do obecnego miesiąca
  setTimeout(() => updateCarousel(), 100);
});

<nav class="bottom-nav" aria-label="Nawigacja dolna">
  <a href="index.html" class="bottom-nav__item">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
    <span>Dom</span>
  </a>
  <a href="porady.html" class="bottom-nav__item">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
    <span>Porady</span>
  </a>
  <a href="index.html#baza-wiedzy" class="bottom-nav__item">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    <span>Wiedza</span>
  </a>
  <a href="moje-sukcesy.html" class="bottom-nav__item bottom-nav__item--active">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="m9 16 2 2 4-4"/></svg>
    <span>Sukcesy</span>
  </a>
  <a href="https://www.instagram.com/fitpo50" target="_blank" rel="noopener noreferrer" class="bottom-nav__item">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
    <span>Instagram</span>
  </a>
</nav>

</body>
</html>
