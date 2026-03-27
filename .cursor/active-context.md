> **BrainSync Context Pumper** 🧠
> Dynamically loaded for active file: `index.html` (Domain: **Generic Logic**)

### 📐 Generic Logic Conventions & Fixes
- **[convention] Strengthened types Nawigacja**: -     <nav class="nav" id="main-nav" aria-label="Nawigacja główna">
+     
-       <a href="#o-nas" class="nav__link">O mnie</a>
+   </div>
-       <a href="#baza-wiedzy" class="nav__link">Baza wiedzy</a>
+ </header>
-       <a href="#trendy" class="nav__link">Obecne Trendy</a>
+ 
-       <a href="porady.html" class="nav__link" style="color: var(--color-primary); font-weight: 600;">Porady</a>
+ <nav class="nav" id="main-nav" aria-label="Nawigacja główna">
-       <a href="https://www.instagram.com/fitpo50" class="nav__link" target="_blank" rel="noopener noreferrer">Instagram</a>
+       <a href="#o-nas" class="nav__link">O mnie</a>
- 
+       <a href="#baza-wiedzy" class="nav__link">Baza wiedzy</a>
-       <button class="theme-toggle" data-theme-toggle aria-label="Przełącz na tryb ciemny">
+       <a href="#trendy" class="nav__link">Obecne Trendy</a>
-         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
+       <a href="porady.html" class="nav__link" style="color: var(--color-primary); font-weight: 600;">Porady</a>
-       </button>
+       <a href="https://www.instagram.com/fitpo50" class="nav__link" target="_blank" rel="noopener noreferrer">Instagram</a>
-     </nav>
+ 
-   </div>
+       <button class="theme-toggle" data-theme-toggle aria-label="Przełącz na tryb ciemny">
- </header>
+         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
- 
+       </button>
- <!-- ============================================================
+     </nav>
-      HERO
+ 
-      ============================================================ -->
+ <!-- ============================================================
- <section class="hero" id="hero">
+      HERO
-   <div class="hero__bg">
+      ===========================================================
… [diff truncated]

📌 IDE AST Context: Modified symbols likely include [html]
- **[convention] convention in .gitignore**: File updated (external): .gitignore

Content summary (8 lines):

AGENT.md
CLAUDE.md
.agent-mem/

# Auto-generated agent rules (personalized per developer)
.brainsync/agent-rules.md

- **[convention] Strengthened types Zmie**: -   .header {
+   .nav-toggle { display: flex; }
-     /* Stop backdrop-filter from being a "Containing Block" trap on mobile */
+   .nav {
-     backdrop-filter: none;
+     position: fixed;
-     -webkit-backdrop-filter: none;
+     top: 64px;
-     background: var(--color-bg);
+     left: 0;
-   }
+     right: 0;
-   .nav-toggle { display: flex; }
+     bottom: 0;
-   .nav {
+     flex-direction: column;
-     position: fixed;
+     align-items: flex-start;
-     top: 64px;
+     justify-content: flex-start;
-     left: 0;
+     padding: var(--space-8) var(--space-6);
-     right: 0;
+     gap: var(--space-3);
-     bottom: 0;
+     background: color-mix(in srgb, var(--color-bg), transparent 10%);
-     flex-direction: column;
+     backdrop-filter: blur(20px);
-     align-items: flex-start;
+     -webkit-backdrop-filter: blur(20px);
-     justify-content: flex-start;
+     border-top: 1px solid var(--color-border);
-     padding: var(--space-8) var(--space-6);
+     transform: translateY(-12px);
-     gap: var(--space-3);
+     opacity: 0;
-     background: color-mix(in srgb, var(--color-bg), transparent 10%);
+     visibility: hidden;
-     backdrop-filter: blur(20px);
+     pointer-events: none;
-     -webkit-backdrop-filter: blur(20px);
+     overflow-y: auto;
-     border-top: 1px solid var(--color-border);
+     transition:
-     transform: translateY(-12px);
+       transform 0.3s var(--ease-out),
-     opacity: 0;
+       opacity 0.24s ease,
-     visibility: hidden;
+       visibility 0.24s ease;
-     pointer-events: none;
+     z-index: 51;
-     overflow-y: auto;
+   }
-     transition:
+   .nav.is-open {
-       transform 0.3s var(--ease-out),
+     transform: translateY(0);
-       opacity 0.24s ease,
+     opacity: 1;
-       visibility 0.24s ease;
+     visibility: visible;
-     z-index: 51;
+     pointer-events: auto;
-   .nav.is-open {
+   .nav__link {
-     transform: translateY(0);
+     font-size: var(--text-lg);
-     opacity: 1;
+     padd
… [diff truncated]

📌 IDE AST Context: Modified symbols likely include [:root, :root, [data-theme="light"], [data-theme="dark"], @media (prefers-color-scheme: dark)]
- **[convention] Strengthened types Nawigacja**: -     <nav class="nav" id="main-nav" aria-label="Nawigacja główna">
+     
-       <a href="index.html" class="nav__link">Strona Główna</a>
+   </div>
-       <a href="index.html#o-nas" class="nav__link">O mnie</a>
+ </header>
-       <a href="index.html#baza-wiedzy" class="nav__link">Baza wiedzy</a>
+ 
-       <a href="porady.html" class="nav__link" style="color: var(--color-primary); font-weight: 600;">Porady</a>
+ <nav class="nav" id="main-nav" aria-label="Nawigacja główna">
-       <a href="https://www.instagram.com/fitpo50" class="nav__link" target="_blank" rel="noopener noreferrer">Instagram</a>
+       <a href="index.html" class="nav__link">Strona Główna</a>
- 
+       <a href="index.html#o-nas" class="nav__link">O mnie</a>
-       <button class="theme-toggle" data-theme-toggle aria-label="Przełącz na tryb ciemny">
+       <a href="index.html#baza-wiedzy" class="nav__link">Baza wiedzy</a>
-         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
+       <a href="porady.html" class="nav__link" style="color: var(--color-primary); font-weight: 600;">Porady</a>
-       </button>
+       <a href="https://www.instagram.com/fitpo50" class="nav__link" target="_blank" rel="noopener noreferrer">Instagram</a>
-     </nav>
+ 
-   </div>
+       <button class="theme-toggle" data-theme-toggle aria-label="Przełącz na tryb ciemny">
- </header>
+         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
- 
+       </button>
- <main class="article-page">
+     </nav>
-   <div class="container">
+ 
-     <div class="article-header reveal">
+ <main class="article-page">
-       <div class="article-header__meta">
+   <div class="container">
-         <span style="color: var(--color-accent); font-weight: 700;">Ruch</span>
+     <div class="article-heade
… [diff truncated]

📌 IDE AST Context: Modified symbols likely include [html]
- **[convention] Strengthened types Nawigacja**: -     <nav class="nav" id="main-nav" aria-label="Nawigacja główna">
+     
-       <a href="index.html" class="nav__link">Strona Główna</a>
+   </div>
-       <a href="index.html#o-nas" class="nav__link">O mnie</a>
+ </header>
-       <a href="index.html#baza-wiedzy" class="nav__link">Baza wiedzy</a>
+ 
-       <a href="porady.html" class="nav__link" style="color: var(--color-primary); font-weight: 600;">Porady</a>
+ <nav class="nav" id="main-nav" aria-label="Nawigacja główna">
-       <a href="https://www.instagram.com/fitpo50" class="nav__link" target="_blank" rel="noopener noreferrer">Instagram</a>
+       <a href="index.html" class="nav__link">Strona Główna</a>
- 
+       <a href="index.html#o-nas" class="nav__link">O mnie</a>
-       <button class="theme-toggle" data-theme-toggle aria-label="Przełącz na tryb ciemny">
+       <a href="index.html#baza-wiedzy" class="nav__link">Baza wiedzy</a>
-         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
+       <a href="porady.html" class="nav__link" style="color: var(--color-primary); font-weight: 600;">Porady</a>
-       </button>
+       <a href="https://www.instagram.com/fitpo50" class="nav__link" target="_blank" rel="noopener noreferrer">Instagram</a>
-     </nav>
+ 
-   </div>
+       <button class="theme-toggle" data-theme-toggle aria-label="Przełącz na tryb ciemny">
- </header>
+         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
- 
+       </button>
- <main class="article-page">
+     </nav>
-   <div class="container">
+ 
-     <div class="article-header reveal">
+ <main class="article-page">
-       <div class="article-header__meta">
+   <div class="container">
-         <span style="color: var(--color-accent); font-weight: 700;">Zdrowie</span>
+     <div class="article-he
… [diff truncated]

📌 IDE AST Context: Modified symbols likely include [html]
- **[convention] Strengthened types Nawigacja**: -     <nav class="nav" id="main-nav" aria-label="Nawigacja główna">
+     
-       <a href="index.html" class="nav__link">Strona Główna</a>
+   </div>
-       <a href="index.html#o-nas" class="nav__link">O mnie</a>
+ </header>
-       <a href="index.html#baza-wiedzy" class="nav__link">Baza wiedzy</a>
+ 
-       <a href="porady.html" class="nav__link">Porady</a>
+ <nav class="nav" id="main-nav" aria-label="Nawigacja główna">
-       <a href="https://www.instagram.com/fitpo50" class="nav__link" target="_blank" rel="noopener noreferrer">Instagram</a>
+       <a href="index.html" class="nav__link">Strona Główna</a>
-       <button class="theme-toggle" data-theme-toggle aria-label="Przełącz na tryb ciemny">
+       <a href="index.html#o-nas" class="nav__link">O mnie</a>
-         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
+       <a href="index.html#baza-wiedzy" class="nav__link">Baza wiedzy</a>
-       </button>
+       <a href="porady.html" class="nav__link">Porady</a>
-     </nav>
+       <a href="https://www.instagram.com/fitpo50" class="nav__link" target="_blank" rel="noopener noreferrer">Instagram</a>
-   </div>
+       <button class="theme-toggle" data-theme-toggle aria-label="Przełącz na tryb ciemny">
- </header>
+         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
- 
+       </button>
- <main>
+     </nav>
-   <section class="subpage-hero">
+ 
-     <div class="subpage-hero__bg">
+ <main>
-       <picture>
+   <section class="subpage-hero">
-         <source srcset="./assets/Hero_Spraw.avif" type="image/avif">
+     <div class="subpage-hero__bg">
-         <source srcset="./assets/Hero_Spraw.webp" type="image/webp">
+       <picture>
-         <img src="./assets/Hero_Spraw.png" alt="Sprawdź zdrowie po 50-tce" loading="eage
… [diff truncated]

📌 IDE AST Context: Modified symbols likely include [html]
- **[convention] Strengthened types Nawigacja**: -     <nav class="nav" id="main-nav" aria-label="Nawigacja główna">
+     
-       <a href="index.html" class="nav__link">Strona Główna</a>
+   </div>
-       <a href="index.html#o-nas" class="nav__link">O mnie</a>
+ </header>
-       <a href="index.html#baza-wiedzy" class="nav__link">Baza wiedzy</a>
+ 
-       <a href="porady.html" class="nav__link" style="color: var(--color-primary); font-weight: 600;">Porady</a>
+ <nav class="nav" id="main-nav" aria-label="Nawigacja główna">
-       <a href="https://www.instagram.com/fitpo50" class="nav__link" target="_blank" rel="noopener noreferrer">Instagram</a>
+       <a href="index.html" class="nav__link">Strona Główna</a>
- 
+       <a href="index.html#o-nas" class="nav__link">O mnie</a>
-       <button class="theme-toggle" data-theme-toggle aria-label="Przełącz na tryb ciemny">
+       <a href="index.html#baza-wiedzy" class="nav__link">Baza wiedzy</a>
-         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
+       <a href="porady.html" class="nav__link" style="color: var(--color-primary); font-weight: 600;">Porady</a>
-       </button>
+       <a href="https://www.instagram.com/fitpo50" class="nav__link" target="_blank" rel="noopener noreferrer">Instagram</a>
-     </nav>
+ 
-   </div>
+       <button class="theme-toggle" data-theme-toggle aria-label="Przełącz na tryb ciemny">
- </header>
+         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
- 
+       </button>
- <main class="article-page">
+     </nav>
-   <div class="container">
+ 
-     <div class="article-header reveal">
+ <main class="article-page">
-       <div class="article-header__meta">
+   <div class="container">
-         <span style="color: var(--color-accent); font-weight: 700;">Ruch</span>
+     <div class="article-heade
… [diff truncated]

📌 IDE AST Context: Modified symbols likely include [html]
- **[convention] Strengthened types Nawigacja**: -     <nav class="nav" id="main-nav" aria-label="Nawigacja główna">
+     
-       <a href="index.html" class="nav__link">Strona Główna</a>
+   </div>
-       <a href="index.html#o-nas" class="nav__link">O mnie</a>
+ </header>
-       <a href="index.html#baza-wiedzy" class="nav__link">Baza wiedzy</a>
+ 
-       <a href="porady.html" class="nav__link" style="color: var(--color-primary); font-weight: 600;">Porady</a>
+ <nav class="nav" id="main-nav" aria-label="Nawigacja główna">
-       <a href="https://www.instagram.com/fitpo50" class="nav__link" target="_blank" rel="noopener noreferrer">Instagram</a>
+       <a href="index.html" class="nav__link">Strona Główna</a>
-       <button class="theme-toggle" data-theme-toggle aria-label="Przełącz motyw">
+       <a href="index.html#o-nas" class="nav__link">O mnie</a>
-         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
+       <a href="index.html#baza-wiedzy" class="nav__link">Baza wiedzy</a>
-       </button>
+       <a href="porady.html" class="nav__link" style="color: var(--color-primary); font-weight: 600;">Porady</a>
-     </nav>
+       <a href="https://www.instagram.com/fitpo50" class="nav__link" target="_blank" rel="noopener noreferrer">Instagram</a>
-   </div>
+       <button class="theme-toggle" data-theme-toggle aria-label="Przełącz motyw">
- </header>
+         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
- 
+       </button>
- <main class="article-page">
+     </nav>
-   <div class="container">
+ 
-     <div class="article-header reveal">
+ <main class="article-page">
-       <div class="article-header__meta">
+   <div class="container">
-         <span style="color: var(--color-accent); font-weight: 700;">Zdrowie</span>
+     <div class="article-header reveal">
-         
… [diff truncated]

📌 IDE AST Context: Modified symbols likely include [html]
- **[convention] Strengthened types Nawigacja**: -     <nav class="nav" id="main-nav" aria-label="Nawigacja główna">
+     
-       <a href="index.html" class="nav__link">Strona Główna</a>
+   </div>
-       <a href="index.html#o-nas" class="nav__link">O mnie</a>
+ </header>
-       <a href="index.html#baza-wiedzy" class="nav__link">Baza wiedzy</a>
+ 
-       <a href="porady.html" class="nav__link" style="color: var(--color-primary); font-weight: 600;">Porady</a>
+ <nav class="nav" id="main-nav" aria-label="Nawigacja główna">
-       <a href="https://www.instagram.com/fitpo50" class="nav__link" target="_blank" rel="noopener noreferrer">Instagram</a>
+       <a href="index.html" class="nav__link">Strona Główna</a>
- 
+       <a href="index.html#o-nas" class="nav__link">O mnie</a>
-       <button class="theme-toggle" data-theme-toggle aria-label="Przełącz na tryb ciemny">
+       <a href="index.html#baza-wiedzy" class="nav__link">Baza wiedzy</a>
-         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
+       <a href="porady.html" class="nav__link" style="color: var(--color-primary); font-weight: 600;">Porady</a>
-       </button>
+       <a href="https://www.instagram.com/fitpo50" class="nav__link" target="_blank" rel="noopener noreferrer">Instagram</a>
-     </nav>
+ 
-   </div>
+       <button class="theme-toggle" data-theme-toggle aria-label="Przełącz na tryb ciemny">
- </header>
+         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
- 
+       </button>
- <main class="article-page">
+     </nav>
-   <div class="container">
+ 
-   <div class="article-header reveal">
+ <main class="article-page">
-       <div class="article-header__meta">
+   <div class="container">
-         <span style="color: var(--color-accent); font-weight: 700;">Jedzenie</span>
+   <div class="article-heade
… [diff truncated]

📌 IDE AST Context: Modified symbols likely include [html]
- **[convention] Strengthened types Nawigacja — ensures atomic multi-step database operations**: -     <nav class="nav" id="main-nav" aria-label="Nawigacja główna">
+     
-       <a href="index.html" class="nav__link">Strona Główna</a>
+   </div>
-       <a href="index.html#o-nas" class="nav__link">O mnie</a>
+ </header>
-       <a href="index.html#baza-wiedzy" class="nav__link">Baza wiedzy</a>
+ 
-       <a href="porady.html" class="nav__link" style="color: var(--color-primary); font-weight: 600;">Porady</a>
+ <nav class="nav" id="main-nav" aria-label="Nawigacja główna">
-       <a href="https://www.instagram.com/fitpo50" class="nav__link" target="_blank" rel="noopener noreferrer">Instagram</a>
+       <a href="index.html" class="nav__link">Strona Główna</a>
- 
+       <a href="index.html#o-nas" class="nav__link">O mnie</a>
-       <button class="theme-toggle" data-theme-toggle aria-label="Przełącz na tryb ciemny">
+       <a href="index.html#baza-wiedzy" class="nav__link">Baza wiedzy</a>
-         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
+       <a href="porady.html" class="nav__link" style="color: var(--color-primary); font-weight: 600;">Porady</a>
-       </button>
+       <a href="https://www.instagram.com/fitpo50" class="nav__link" target="_blank" rel="noopener noreferrer">Instagram</a>
-     </nav>
+ 
-   </div>
+       <button class="theme-toggle" data-theme-toggle aria-label="Przełącz na tryb ciemny">
- </header>
+         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
- 
+       </button>
- <main class="article-page">
+     </nav>
-   <div class="container">
+ 
-     <div class="article-header reveal">
+ <main class="article-page">
-       <div class="article-header__meta">
+   <div class="container">
-         <span style="color: var(--color-accent); font-weight: 700;">Zdrowie</span>
+     <div class="article-he
… [diff truncated]

📌 IDE AST Context: Modified symbols likely include [html]
- **[convention] Strengthened types Nawigacja**: -     <nav class="nav" id="main-nav" aria-label="Nawigacja główna">
+     
-       <a href="index.html" class="nav__link">Strona Główna</a>
+   </div>
-       <a href="index.html#o-nas" class="nav__link">O mnie</a>
+ </header>
-       <a href="index.html#baza-wiedzy" class="nav__link">Baza wiedzy</a>
+ 
-       <a href="porady.html" class="nav__link">Porady</a>
+ <nav class="nav" id="main-nav" aria-label="Nawigacja główna">
-       <a href="https://www.instagram.com/fitpo50" class="nav__link" target="_blank" rel="noopener noreferrer">Instagram</a>
+       <a href="index.html" class="nav__link">Strona Główna</a>
-       <button class="theme-toggle" data-theme-toggle aria-label="Przełącz na tryb ciemny">
+       <a href="index.html#o-nas" class="nav__link">O mnie</a>
-         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
+       <a href="index.html#baza-wiedzy" class="nav__link">Baza wiedzy</a>
-       </button>
+       <a href="porady.html" class="nav__link">Porady</a>
-     </nav>
+       <a href="https://www.instagram.com/fitpo50" class="nav__link" target="_blank" rel="noopener noreferrer">Instagram</a>
-   </div>
+       <button class="theme-toggle" data-theme-toggle aria-label="Przełącz na tryb ciemny">
- </header>
+         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
- 
+       </button>
- <main>
+     </nav>
-   <section class="subpage-hero">
+ 
-     <div class="subpage-hero__bg">
+ <main>
-       <picture>
+   <section class="subpage-hero">
-         <source srcset="./assets/Hero_Upo.avif" type="image/avif">
+     <div class="subpage-hero__bg">
-         <source srcset="./assets/Hero_Upo.webp" type="image/webp">
+       <picture>
-         <img src="./assets/Hero_Upo.png" alt="Uporządkuj jedzenie po 50-tce" loading="eager"
… [diff truncated]

📌 IDE AST Context: Modified symbols likely include [html]
- **[convention] Strengthened types Nawigacja**: -       <img src="./assets/logo.jpg" alt="FitPo50" class="logo__img">
+       <img src="./assets/logo.jpg" alt="FitPo50" class="logo__img" width="48" height="48">
-     <nav class="nav" id="main-nav" aria-label="Nawigacja główna">
+     
-       <a href="index.html" class="nav__link">Strona Główna</a>
+   </div>
-       <a href="index.html#o-nas" class="nav__link">O mnie</a>
+ </header>
-       <a href="index.html#baza-wiedzy" class="nav__link">Baza wiedzy</a>
+ 
-       <a href="porady.html" class="nav__link" style="color: var(--color-primary); font-weight: 600;">Porady</a>
+ <nav class="nav" id="main-nav" aria-label="Nawigacja główna">
-       <a href="https://www.instagram.com/fitpo50" class="nav__link" target="_blank" rel="noopener noreferrer">Instagram</a>
+       <a href="index.html" class="nav__link">Strona Główna</a>
- 
+       <a href="index.html#o-nas" class="nav__link">O mnie</a>
-       <button class="theme-toggle" data-theme-toggle aria-label="Przełącz na tryb ciemny">
+       <a href="index.html#baza-wiedzy" class="nav__link">Baza wiedzy</a>
-         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
+       <a href="porady.html" class="nav__link" style="color: var(--color-primary); font-weight: 600;">Porady</a>
-       </button>
+       <a href="https://www.instagram.com/fitpo50" class="nav__link" target="_blank" rel="noopener noreferrer">Instagram</a>
-     </nav>
+ 
-   </div>
+       <button class="theme-toggle" data-theme-toggle aria-label="Przełącz na tryb ciemny">
- </header>
+         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
- 
+       </button>
- <main class="article-page">
+     </nav>
-   <div class="container">
+ 
-     <div class="article-header reveal">
+ <main class="article-page">
-       <div class="a
… [diff truncated]

📌 IDE AST Context: Modified symbols likely include [html]
- **[convention] Strengthened types Nawigacja**: -     <nav class="nav" id="main-nav" aria-label="Nawigacja główna">
+     
-       <a href="index.html" class="nav__link">Strona Główna</a>
+   </div>
-       <a href="index.html#o-nas" class="nav__link">O mnie</a>
+ </header>
-       <a href="index.html#baza-wiedzy" class="nav__link">Baza wiedzy</a>
+ 
-       <a href="porady.html" class="nav__link" style="color: var(--color-primary); font-weight: 600;">Porady</a>
+ <nav class="nav" id="main-nav" aria-label="Nawigacja główna">
-       <a href="https://www.instagram.com/fitpo50" class="nav__link" target="_blank" rel="noopener noreferrer">Instagram</a>
+       <a href="index.html" class="nav__link">Strona Główna</a>
- 
+       <a href="index.html#o-nas" class="nav__link">O mnie</a>
-       <button class="theme-toggle" data-theme-toggle aria-label="Przełącz na tryb ciemny">
+       <a href="index.html#baza-wiedzy" class="nav__link">Baza wiedzy</a>
-         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
+       <a href="porady.html" class="nav__link" style="color: var(--color-primary); font-weight: 600;">Porady</a>
-       </button>
+       <a href="https://www.instagram.com/fitpo50" class="nav__link" target="_blank" rel="noopener noreferrer">Instagram</a>
-     </nav>
+ 
-   </div>
+       <button class="theme-toggle" data-theme-toggle aria-label="Przełącz na tryb ciemny">
- </header>
+         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
- 
+       </button>
- <main class="article-page" id="main-article">
+     </nav>
-   <div class="container">
+ 
-     <div class="article-header reveal">
+ <main class="article-page" id="main-article">
-       <div class="article-header__meta">
+   <div class="container">
-         <span style="color: var(--color-accent); font-weight: 700;">Ruch</s
… [diff truncated]

📌 IDE AST Context: Modified symbols likely include [html]
- **[convention] Strengthened types Nawigacja**: -     <nav class="nav" id="main-nav" aria-label="Nawigacja główna">
+     
-       <a href="index.html" class="nav__link">Strona Główna</a>
+   </div>
-       <a href="index.html#o-nas" class="nav__link">O mnie</a>
+ </header>
-       <a href="index.html#baza-wiedzy" class="nav__link">Baza wiedzy</a>
+ 
-       <a href="porady.html" class="nav__link">Porady</a>
+ <nav class="nav" id="main-nav" aria-label="Nawigacja główna">
-       <a href="https://www.instagram.com/fitpo50" class="nav__link" target="_blank" rel="noopener noreferrer">Instagram</a>
+       <a href="index.html" class="nav__link">Strona Główna</a>
-       <button class="theme-toggle" data-theme-toggle aria-label="Przełącz na tryb ciemny">
+       <a href="index.html#o-nas" class="nav__link">O mnie</a>
-         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
+       <a href="index.html#baza-wiedzy" class="nav__link">Baza wiedzy</a>
-       </button>
+       <a href="porady.html" class="nav__link">Porady</a>
-     </nav>
+       <a href="https://www.instagram.com/fitpo50" class="nav__link" target="_blank" rel="noopener noreferrer">Instagram</a>
-   </div>
+       <button class="theme-toggle" data-theme-toggle aria-label="Przełącz na tryb ciemny">
- </header>
+         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
- 
+       </button>
- <main>
+     </nav>
-   <section class="subpage-hero">
+ 
-     <div class="subpage-hero__bg">
+ <main>
-       <picture>
+   <section class="subpage-hero">
-         <source srcset="./assets/Hero_Rusz.avif" type="image/avif">
+     <div class="subpage-hero__bg">
-         <source srcset="./assets/Hero_Rusz.webp" type="image/webp">
+       <picture>
-         <img src="./assets/Hero_Rusz.png" alt="Ruch po 50-tce" loading="eager" width="1200
… [diff truncated]

📌 IDE AST Context: Modified symbols likely include [html]
- **[convention] Strengthened types Nawigacja**: -     <nav class="nav" id="main-nav" aria-label="Nawigacja główna">
+     
-       <a href="index.html" class="nav__link">Strona Główna</a>
+   </div>
-       <a href="index.html#o-nas" class="nav__link">O mnie</a>
+ </header>
-       <a href="index.html#baza-wiedzy" class="nav__link">Baza wiedzy</a>
+ 
-       <a href="porady.html" class="nav__link" style="color: var(--color-primary); font-weight: 600;">Porady</a>
+ <nav class="nav" id="main-nav" aria-label="Nawigacja główna">
-       <a href="https://www.instagram.com/fitpo50" class="nav__link" target="_blank" rel="noopener noreferrer">Instagram</a>
+       <a href="index.html" class="nav__link">Strona Główna</a>
- 
+       <a href="index.html#o-nas" class="nav__link">O mnie</a>
-       <button class="theme-toggle" data-theme-toggle aria-label="Przełącz na tryb ciemny">
+       <a href="index.html#baza-wiedzy" class="nav__link">Baza wiedzy</a>
-         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
+       <a href="porady.html" class="nav__link" style="color: var(--color-primary); font-weight: 600;">Porady</a>
-       </button>
+       <a href="https://www.instagram.com/fitpo50" class="nav__link" target="_blank" rel="noopener noreferrer">Instagram</a>
-     </nav>
+ 
-   </div>
+       <button class="theme-toggle" data-theme-toggle aria-label="Przełącz na tryb ciemny">
- </header>
+         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
- 
+       </button>
- <main>
+     </nav>
-   <section class="porady-hero">
+ 
-     <div class="porady-hero__bg">
+ <main>
-       <picture>
+   <section class="porady-hero">
-         <source srcset="./assets/Hero_Porady1.avif" type="image/avif">
+     <div class="porady-hero__bg">
-         <source srcset="./assets/Hero_Porady1.webp" type="image
… [diff truncated]

📌 IDE AST Context: Modified symbols likely include [html]
