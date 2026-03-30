  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag("js", new Date());

  gtag("config", "G-S21SKTVM7K");
</script>
<script>
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
