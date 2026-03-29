<script>
/**
 * Obsługa karuzeli zdjęć (scroll-snap) dla sukcesów i listy dni.
 * Synchronizuje kropki, strzałki i nawigację klawiaturą.
 */
document.addEventListener('DOMContentLoaded', () => {
    const carousels = document.querySelectorAll('.entry-carousel');
    carousels.forEach(carousel => {
        const track = carousel.querySelector('.entry-carousel__track');
        const slides = Array.from(track.children);
        const dotsContainer = carousel.querySelector('.entry-carousel__dots');
        const prevBtn = carousel.querySelector('.entry-carousel__btn--prev');
        const nextBtn = carousel.querySelector('.entry-carousel__btn--next');
        
        if (slides.length < 2) return;

        // Create dots
        slides.forEach((_, i) => {
            const dot = document.createElement('button');
            dot.classList.add('entry-carousel__dot');
            if (i === 0) dot.classList.add('entry-carousel__dot--active');
            dot.setAttribute('aria-label', `Idź do zdjęcia ${i + 1}`);
            dot.addEventListener('click', (e) => {
                e.preventDefault();
                track.scrollTo({ left: track.offsetWidth * i, behavior: 'smooth' });
            });
            dotsContainer.appendChild(dot);
        });

        const dots = Array.from(dotsContainer.children);

        const updateActiveDot = () => {
            const index = Math.round(track.scrollLeft / track.offsetWidth);
            dots.forEach((dot, i) => {
                dot.classList.toggle('entry-carousel__dot--active', i === index);
            });
        };

        track.addEventListener('scroll', updateActiveDot, { passive: true });

        prevBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const index = Math.round(track.scrollLeft / track.offsetWidth);
            track.scrollTo({ left: track.offsetWidth * (index - 1), behavior: 'smooth' });
        });

        nextBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const index = Math.round(track.scrollLeft / track.offsetWidth);
            track.scrollTo({ left: track.offsetWidth * (index + 1), behavior: 'smooth' });
        });

        // Keyboard navigation
        carousel.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') prevBtn.click();
            if (e.key === 'ArrowRight') nextBtn.click();
        });
    });
});
</script>
