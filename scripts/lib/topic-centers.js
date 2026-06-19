const TOPIC_CENTERS = [
  {
    className: 'strength',
    url: 'centrum-treningu-silowego-po-50.html',
    mark: '🏋️',
    icon: '🏋️',
    label: 'ścieżka treningowa',
    title: 'Trening siłowy po 50',
    description: 'Bezpieczny start, progresja, maszyny, siła chwytu, błędy i regeneracja.',
    tags: ['plan startowy', 'technika', 'siła'],
    aria: 'Centrum treningu siłowego po 50: start, technika, progresja i regeneracja'
  },
  {
    className: 'protein',
    url: 'centrum-bialka-po-50.html',
    mark: '🥚',
    icon: '🥚',
    label: 'przewodnik żywieniowy',
    title: 'Białko po 50',
    description: 'Ile białka, kiedy jeść, WPC/WPI, kreatyna, mięśnie i praktyczne porcje.',
    tags: ['dawkowanie', 'porcje', 'mięśnie'],
    aria: 'Centrum białka po 50: dawka, porcje, WPC, WPI, kreatyna i mięśnie'
  },
  {
    className: 'sleep',
    url: 'centrum-snu-po-50.html',
    mark: '🌙',
    icon: '🌙',
    label: 'centrum regeneracji',
    title: 'Sen po 50',
    description: 'Pobudki o 3 w nocy, melatonina, bezdech, temperatura i regeneracja.',
    tags: ['pobudki', 'bezdech', 'regeneracja'],
    aria: 'Centrum snu po 50: pobudki nocne, melatonina, bezdech, stres i regeneracja'
  },
  {
    className: 'pressure',
    url: 'centrum-nadcisnienia-po-50.html',
    mark: '🫀',
    icon: '🫀',
    label: 'centrum serca',
    title: 'Nadciśnienie po 50',
    description: 'Pomiar domowy, trening, dieta, elastyczność naczyń i czerwone flagi.',
    tags: ['pomiar', 'DASH', 'serce'],
    aria: 'Centrum nadciśnienia po 50: pomiar domowy, dieta DASH, ruch i elastyczność naczyń'
  },
  {
    className: 'cholesterol',
    url: 'centrum-cholesterolu-po-50.html',
    mark: '🧪',
    icon: '🧪',
    label: 'centrum badań',
    title: 'Cholesterol i badania',
    description: 'ApoB, ApoA1, lipidogram, markery krwi i pytania, które warto zadać lekarzowi.',
    tags: ['ApoB', 'LDL', 'badania'],
    aria: 'Centrum cholesterolu i badań po 50: ApoB, ApoA1, lipidogram i markery krwi'
  },
  {
    className: 'metabolism',
    url: 'centrum-metabolizmu-po-50.html',
    mark: '🔥',
    icon: '🔥',
    label: 'centrum nawyków',
    title: 'Metabolizm i brzuch po 50',
    description: 'Oponka, kortyzol, tłuszcz trzewny, etykiety, cukier i realne nawyki.',
    tags: ['kortyzol', 'cukier', 'nawyki'],
    aria: 'Centrum metabolizmu i brzucha po 50: oponka, kortyzol, cukier, tłuszcz trzewny i nawyki'
  }
];

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderTopicCentersStyles() {
  return `/* topic-centers:start */
    .topic-centers {
      margin: 18px 0;
      padding: clamp(18px, 3vw, 28px);
      border: 1px solid rgba(110, 183, 173, 0.45);
      border-radius: 24px;
      background:
        radial-gradient(circle at top left, rgba(239, 141, 61, 0.16), transparent 34%),
        linear-gradient(135deg, #f8fcfb 0%, #eef8f6 100%);
      box-shadow: 0 14px 30px rgba(31, 90, 117, 0.12);
    }
    .topic-centers__head {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 18px;
      align-items: end;
      margin-bottom: 18px;
    }
    .topic-centers__eyebrow {
      display: inline-flex;
      width: fit-content;
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(239, 141, 61, 0.13);
      color: var(--terracotta-deep);
      font-size: 0.78rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .topic-centers h3 {
      margin: 10px 0 8px;
      font-family: Georgia, "Times New Roman", serif;
      font-size: clamp(2rem, 4vw, 3.6rem);
      line-height: 0.95;
      color: var(--ink);
    }
    .topic-centers__lead {
      max-width: 760px;
      margin: 0;
      color: var(--ink-soft);
      font-size: 1.03rem;
      line-height: 1.55;
    }
    .topic-centers__badge {
      align-self: start;
      padding: 10px 12px;
      border: 1px dashed rgba(31, 90, 117, 0.28);
      border-radius: 14px;
      color: var(--ink-soft);
      background: rgba(255, 255, 255, 0.66);
      font-size: 0.82rem;
      font-weight: 700;
      white-space: nowrap;
    }
    .topic-centers__grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
    }
    .topic-center-card {
      position: relative;
      --center-accent: #ef8d3d;
      --center-soft: #fff1e6;
      min-height: 210px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 18px;
      padding: 18px 18px 16px;
      overflow: hidden;
      border-radius: 20px;
      border: 1px solid color-mix(in srgb, var(--center-accent) 26%, rgba(197, 225, 222, 0.9));
      color: var(--ink);
      text-decoration: none;
      background:
        radial-gradient(circle at 86% 14%, color-mix(in srgb, var(--center-accent) 18%, transparent), transparent 36%),
        linear-gradient(145deg, rgba(255, 255, 255, 0.92), color-mix(in srgb, var(--center-soft) 52%, white));
      box-shadow: 0 8px 20px rgba(31, 90, 117, 0.08);
      transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
    }
    .topic-center-card--strength { --center-accent: #ef8d3d; --center-soft: #fff1e6; }
    .topic-center-card--protein { --center-accent: #d98934; --center-soft: #fff3df; }
    .topic-center-card--sleep { --center-accent: #5577d8; --center-soft: #edf1ff; }
    .topic-center-card--pressure { --center-accent: #d85d5d; --center-soft: #fff0f0; }
    .topic-center-card--cholesterol { --center-accent: #6b9f58; --center-soft: #eff8ea; }
    .topic-center-card--metabolism { --center-accent: #c96c3f; --center-soft: #fff0e8; }
    .topic-center-card::before {
      content: '';
      position: absolute;
      inset: auto -30px -40px auto;
      width: 138px;
      height: 138px;
      border-radius: 50%;
      background: color-mix(in srgb, var(--center-accent) 16%, transparent);
      pointer-events: none;
    }
    .topic-center-card::after {
      content: attr(data-mark);
      position: absolute;
      right: 16px;
      bottom: 4px;
      color: color-mix(in srgb, var(--center-accent) 14%, transparent);
      font-size: 6.8rem;
      line-height: 1;
      pointer-events: none;
      transform: rotate(-8deg);
    }
    .topic-center-card:hover {
      transform: translateY(-3px);
      border-color: color-mix(in srgb, var(--center-accent) 58%, rgba(197, 225, 222, 0.9));
      box-shadow: 0 16px 30px color-mix(in srgb, var(--center-accent) 18%, rgba(31, 90, 117, 0.15));
    }
    .topic-center-card__top {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }
    .topic-center-card__icon {
      display: grid;
      place-items: center;
      width: 46px;
      height: 46px;
      border-radius: 16px;
      background: color-mix(in srgb, var(--center-accent) 18%, #ffffff);
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--center-accent) 18%, transparent);
      font-size: 1.55rem;
    }
    .topic-center-card__count {
      padding: 6px 9px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--center-accent) 12%, white);
      color: color-mix(in srgb, var(--center-accent) 72%, var(--ink));
      font-size: 0.78rem;
      font-weight: 800;
    }
    .topic-center-card__content {
      position: relative;
      z-index: 1;
      display: grid;
      gap: 10px;
    }
    .topic-center-card h4 {
      position: relative;
      z-index: 1;
      margin: 0 0 8px;
      font-size: 1.22rem;
      line-height: 1.12;
      color: var(--ink);
    }
    .topic-center-card p {
      position: relative;
      z-index: 1;
      margin: 0;
      color: var(--ink-soft);
      line-height: 1.45;
      font-size: 0.95rem;
    }
    .topic-center-card__tags {
      position: relative;
      z-index: 1;
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      margin-top: 2px;
    }
    .topic-center-card__tags span {
      padding: 5px 8px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.64);
      color: color-mix(in srgb, var(--center-accent) 68%, var(--ink));
      font-size: 0.75rem;
      font-weight: 850;
      line-height: 1;
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--center-accent) 16%, transparent);
    }
    .topic-center-card__cta {
      position: relative;
      z-index: 1;
      display: inline-flex;
      width: fit-content;
      align-items: center;
      gap: 6px;
      padding: 9px 12px;
      border-radius: 999px;
      background: var(--ink);
      color: #ffffff;
      font-weight: 800;
      font-size: 0.9rem;
      box-shadow: 0 8px 18px rgba(31, 79, 111, 0.12);
    }
    @media (max-width: 980px) {
      .topic-centers__head { grid-template-columns: 1fr; }
      .topic-centers__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .topic-centers__badge { width: fit-content; white-space: normal; }
    }
    @media (max-width: 640px) {
      .topic-centers__grid { grid-template-columns: 1fr; }
      .topic-center-card { min-height: 180px; }
      .topic-center-card::after { font-size: 5.2rem; opacity: 0.82; }
    }
/* topic-centers:end */`;
}

function renderTopicCenterCard(center) {
  const tags = center.tags
    .map((tag) => `<span>${escapeHtml(tag)}</span>`)
    .join('');

  return `        <a class="topic-center-card topic-center-card--${escapeHtml(center.className)}" href="${escapeHtml(center.url)}" data-mark="${escapeHtml(center.mark)}" aria-label="${escapeHtml(center.aria)}">
          <span class="topic-center-card__top"><span class="topic-center-card__icon" aria-hidden="true">${escapeHtml(center.icon)}</span><span class="topic-center-card__count">${escapeHtml(center.label)}</span></span>
          <div class="topic-center-card__content"><h4>${escapeHtml(center.title)}</h4><p>${escapeHtml(center.description)}</p><span class="topic-center-card__tags">${tags}</span></div>
          <span class="topic-center-card__cta">Wejdź do centrum →</span>
        </a>`;
}

function renderTopicCentersSection() {
  const cards = TOPIC_CENTERS.map(renderTopicCenterCard).join('\n');
  return `    <!-- topic-centers-section:start -->
    <section id="centra-tematyczne" class="topic-centers" data-title="centra tematyczne huby przewodniki">
      <div class="topic-centers__head">
        <div>
          <span class="topic-centers__eyebrow">Mapa tematów FitPo50</span>
          <h3>Centra tematyczne</h3>
          <p class="topic-centers__lead">Sześć uporządkowanych wejść do najważniejszych tematów: trening, białko, sen, nadciśnienie, cholesterol i metabolizm. Każde centrum prowadzi od szybkiego startu do konkretnych artykułów i praktycznych narzędzi.</p>
        </div>
        <span class="topic-centers__badge">Wybierz temat i zacznij od ścieżki</span>
      </div>
      <div class="topic-centers__grid" aria-label="Centra tematyczne FitPo50">
${cards}
      </div>
    </section>
    <!-- topic-centers-section:end -->`;
}

module.exports = {
  TOPIC_CENTERS,
  renderTopicCentersSection,
  renderTopicCentersStyles
};
