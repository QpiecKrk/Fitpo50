> **BrainSync Context Pumper** 🧠
> Dynamically loaded for active file: `style.css` (Domain: **Generic Logic**)

### 📐 Generic Logic Conventions & Fixes
- **[problem-fix] problem-fix in style.css**: -   }
+     padding-bottom: 4px;
- }
+     margin-bottom: 4px;
- 
+   }
- /* ============================================================
+ }
-    MOJE SUKCESY - ARTKULARNE WPISY & CALLOUTS
+ 
-    ============================================================ */
+ /* ============================================================
- .entry-callout {
+    MOJE SUKCESY - ARTKULARNE WPISY & CALLOUTS
-   margin: var(--space-8) 0;
+    ============================================================ */
-   padding: var(--space-6) var(--space-8);
+ .entry-callout {
-   border-radius: var(--radius-lg);
+   margin: var(--space-8) 0;
-   border-left: 4px solid var(--color-primary);
+   padding: var(--space-6) var(--space-8);
-   background: var(--color-surface);
+   border-radius: var(--radius-lg);
-   font-size: 1.05rem;
+   border-left: 4px solid var(--color-primary);
-   line-height: 1.6;
+   background: var(--color-surface);
-   color: var(--color-text);
+   font-size: 1.05rem;
-   box-shadow: 0 4px 12px rgba(0,0,0,0.03);
+   line-height: 1.6;
- }
+   color: var(--color-text);
- 
+   box-shadow: 0 4px 12px rgba(0,0,0,0.03);
- .entry-callout--note {
+ }
-   border-left-color: var(--color-primary);
+ 
-   background: var(--color-surface);
+ .entry-callout--note {
- }
+   border-left-color: var(--color-primary);
- 
+   background: var(--color-surface);
- .entry-callout--tip {
+ }
-   border-left-color: var(--color-accent);
+ 
-   background: var(--color-accent-light);
+ .entry-callout--tip {
- }
+   border-left-color: var(--color-accent);
- [data-theme="dark"] .entry-callout--tip {
+   background: var(--color-accent-light);
-   background: rgba(240, 146, 58, 0.1);
+ }
- }
+ [data-theme="dark"] .entry-callout--tip {
- 
+   background: rgba(240, 146, 58, 0.1);
- .entry-callout--important {
+ }
-   border-left-color: var(--color-error);
+ 
-   background: rgba(192, 56, 72, 0.05); /* very light red */
+ .entry-callout--important {
- }
+   border-left-color: var(--color-error);
- [data-t
… [diff truncated]

📌 IDE AST Context: Modified symbols likely include [:root, :root, [data-theme="light"], [data-theme="dark"], @media (prefers-color-scheme: dark)]
- **[problem-fix] problem-fix in style.css**: -     padding-bottom: 4px;
+   }
-     margin-bottom: 4px;
+ }
-   }
+ 
-   }
+ /* ============================================================
- }
+    MOJE SUKCESY - ARTKULARNE WPISY & CALLOUTS
- 
+    ============================================================ */
- /* ============================================================
+ .entry-callout {
-    MOJE SUKCESY - ARTKULARNE WPISY & CALLOUTS
+   margin: var(--space-8) 0;
-    ============================================================ */
+   padding: var(--space-6) var(--space-8);
- .entry-callout {
+   border-radius: var(--radius-lg);
-   margin: var(--space-8) 0;
+   border-left: 4px solid var(--color-primary);
-   padding: var(--space-6) var(--space-8);
+   background: var(--color-surface);
-   border-radius: var(--radius-lg);
+   font-size: 1.05rem;
-   border-left: 4px solid var(--color-primary);
+   line-height: 1.6;
-   background: var(--color-surface);
+   color: var(--color-text);
-   font-size: 1.05rem;
+   box-shadow: 0 4px 12px rgba(0,0,0,0.03);
-   line-height: 1.6;
+ }
-   color: var(--color-text);
+ 
-   box-shadow: 0 4px 12px rgba(0,0,0,0.03);
+ .entry-callout--note {
- }
+   border-left-color: var(--color-primary);
- 
+   background: var(--color-surface);
- .entry-callout--note {
+ }
-   border-left-color: var(--color-primary);
+ 
-   background: var(--color-surface);
+ .entry-callout--tip {
- }
+   border-left-color: var(--color-accent);
- 
+   background: var(--color-accent-light);
- .entry-callout--tip {
+ }
-   border-left-color: var(--color-accent);
+ [data-theme="dark"] .entry-callout--tip {
-   background: var(--color-accent-light);
+   background: rgba(240, 146, 58, 0.1);
- [data-theme="dark"] .entry-callout--tip {
+ 
-   background: rgba(240, 146, 58, 0.1);
+ .entry-callout--important {
- }
+   border-left-color: var(--color-error);
- 
+   background: rgba(192, 56, 72, 0.05); /* very light red */
- .entry-callout--important {
+ }
-   border-left-color: var(--color-error);
+ [data-the
… [diff truncated]

📌 IDE AST Context: Modified symbols likely include [:root, :root, [data-theme="light"], [data-theme="dark"], @media (prefers-color-scheme: dark)]
- **[what-changed] what-changed in style.css**: File updated (external): style.css

Content summary (1924 lines):
/* ============================================================
   FitPo50 — Design Tokens & Component Styles
   Palette: Ocean cyan/teal + orange accent + gold highlights
   Typography: Zodiak (display) + Work Sans (body)
   ============================================================ */

/* --- Type Scale (fluid clamp) --- */
:root {
  --text-xs:   clamp(0.75rem,  0.7rem  + 0.25vw, 0.875rem);
  --text-sm:   clamp(0.875rem, 0.8rem  + 0.35vw, 1rem);
  --text-base: clamp(1rem,     0.95rem + 0.25v
- **[what-changed] Updated schema Date**: -   // ===========================================
+   // ENTRIES_START
-   // Wpisy zarządzane przez panel redakcyjny — nie edytuj ręcznie między markerami
+   const userEntries = [];
-   // <!--ENTRIES_START-->
+   // ENTRIES_END
-   const userEntries = [];
+ 
-   // <!--ENTRIES_END-->
+   const startDate = new Date(2025, 0, 1); // Generuj miesiące od Stycznia 2025
- 
+   const endDate = new Date(2028, 11, 31); // Do Grudnia 2028
-   const startDate = new Date(2025, 0, 1); // Generuj miesiące od Stycznia 2025
+   
-   const endDate = new Date(2028, 11, 31); // Do Grudnia 2028
+   const track = document.getElementById('calendar-track');
-   
+   const monthNames = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"];
-   const track = document.getElementById('calendar-track');
+   
-   const monthNames = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"];
+   let currentMonthIndex = 0;
-   
+   let today = new Date();
-   let currentMonthIndex = 0;
+   
-   let today = new Date();
+   let monthIter = new Date(startDate);
-   
+   let slides = [];
-   let monthIter = new Date(startDate);
+   
-   let slides = [];
+   while(monthIter <= endDate) {
-   
+     let year = monthIter.getFullYear();
-   while(monthIter <= endDate) {
+     let month = monthIter.getMonth();
-     let year = monthIter.getFullYear();
+     
-     let month = monthIter.getMonth();
+     // Sprawdzanie czy to obecny miesiąc w roku do początkowego centrowania karuzeli
-     
+     let isCurrentMonth = (year === today.getFullYear() && month === today.getMonth());
-     // Sprawdzanie czy to obecny miesiąc w roku do początkowego centrowania karuzeli
+     if (isCurrentMonth) {
-     let isCurrentMonth = (year === today.getFullYear() && month === today.getMonth());
+       currentMonthIndex = slides.length;
-     if (isCurrentMonth) {
+  
… [diff truncated]

📌 IDE AST Context: Modified symbols likely include [html]
- **[what-changed] what-changed in moje-sukcesy.html**: - <link href="https://api.fontshare.com/v2/css?f[]=zodiak@400,500,600,700&display=swap" rel="stylesheet">
+ <link href="https://api.fontshare.com/v2/css?f[]=zodiak@400,500,600,700&amp;display=swap" rel="stylesheet">
- <link href="https://fonts.googleapis.com/css2?family=Work+Sans:wght@300..700&display=swap" rel="stylesheet">
+ <link href="https://fonts.googleapis.com/css2?family=Work+Sans:wght@300..700&amp;display=swap" rel="stylesheet">

📌 IDE AST Context: Modified symbols likely include [html]
- **[what-changed] Updated schema CollectionPage**: - </body>
+ <script type="application/ld+json">
- </html>
+ {
- 
+   "@context": "https://schema.org",
+   "@type": "CollectionPage",
+   "name": "Moje Sukcesy",
+   "description": "Kalendarz moich wpisów i sukcesów na drodze do lepszej formy po 50-tce.",
+   "url": "https://fitpo50.pl/moje-sukcesy.html",
+   "isPartOf": {
+     "@type": "WebSite",
+     "name": "FitPo50",
+     "url": "https://fitpo50.pl/"
+   },
+   "publisher": {
+     "@type": "Organization",
+     "name": "FitPo50",
+     "logo": {
+       "@type": "ImageObject",
+       "url": "https://fitpo50.pl/assets/logo.jpg"
+     }
+   }
+ }
+ </script>
+ </body>
+ </html>
+ 

📌 IDE AST Context: Modified symbols likely include [html]
- **[what-changed] what-changed in moje-sukcesy.html**: -     { date: "2026-04-01", url: "testowy-wpis-url.html" },
+     // Jak dodasz wpis, odkomentuj poniższą linię i przypisz mu odpowiednią datę i link:
-     { date: "2026-04-12", url: "test-2-url.html" } // Przykładowy wpis
+     // { date: "2026-04-12", url: "test-2-url.html" }

📌 IDE AST Context: Modified symbols likely include [html]
- **[what-changed] what-changed in bledy-50.html**: File updated (external): bledy-50.html

Content summary (597 lines):
<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-S21SKTVM7K"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag("js", new Date());

  gtag("config", "G-S21SKTVM7K");
</script>
<title>5 największych błędów początkujących po 50-tce | FitPo50</title>
<meta 
- **[what-changed] what-changed in dyskopatia-po-50.html**: File updated (external): dyskopatia-po-50.html

Content summary (753 lines):
<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-S21SKTVM7K"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag("js", new Date());

  gtag("config", "G-S21SKTVM7K");
</script>
<title>Rezonans cię nastraszył? Nauka mówi coś innego | FitPo50</title>
<meta 
- **[convention] what-changed in motywacja-po-50.html — confirmed 3x**: File updated (external): motywacja-po-50.html

Content summary (767 lines):
<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-S21SKTVM7K"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag("js", new Date());

  gtag("config", "G-S21SKTVM7K");
</script>
<title>Jak utrzymać motywację do ćwiczeń po 50-tce? | FitPo50</title>
<meta na
- **[convention] what-changed in jedzenie.html — confirmed 3x**: File updated (external): jedzenie.html

Content summary (306 lines):
<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-S21SKTVM7K"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag("js", new Date());

  gtag("config", "G-S21SKTVM7K");
</script>
<title>Jedzenie po 50-tce: dieta, białko i nawodnienie | FitPo50</title>
<meta
- **[what-changed] what-changed in jedz-wiecej-po-50.html**: File updated (external): jedz-wiecej-po-50.html

Content summary (763 lines):
<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-S21SKTVM7K"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag("js", new Date());

  gtag("config", "G-S21SKTVM7K");
</script>
<title>Jedz więcej po 50-tce: dlaczego niedojadanie szkodzi | FitPo50</title>

- **[what-changed] what-changed in sen-po-50.html**: File updated (external): sen-po-50.html

Content summary (702 lines):
<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-S21SKTVM7K"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag("js", new Date());

  gtag("config", "G-S21SKTVM7K");
</script>
<title>Sen po 50-tce: regeneracja, mięśnie i energia | FitPo50</title>
<meta n
- **[what-changed] what-changed in motywacja-zniknela-po-50.html**: File updated (external): motywacja-zniknela-po-50.html

Content summary (724 lines):
<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-S21SKTVM7K"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag("js", new Date());

  gtag("config", "G-S21SKTVM7K");
</script>
<title>Motywacja zniknęła po 50-tce? Co robić dalej | FitPo50</title>
<meta na
- **[convention] what-changed in silownia-dla-ludzi.html — confirmed 3x**: File updated (external): silownia-dla-ludzi.html

Content summary (629 lines):
<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-S21SKTVM7K"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag("js", new Date());

  gtag("config", "G-S21SKTVM7K");
</script>
<title>Siłownia po 50-tce nie jest dla mięśni. Jest dla ludzi. | FitPo50</titl
