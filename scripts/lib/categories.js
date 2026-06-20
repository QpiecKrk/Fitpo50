const CATEGORY_DEFINITIONS = {
  ruch: {
    key: 'ruch',
    label: 'Ruch',
    file: 'rusz-sie.html',
    aliases: ['ruch', 'rusz-sie', 'rusz_sie'],
  },
  jedzenie: {
    key: 'jedzenie',
    label: 'Jedzenie',
    file: 'jedzenie.html',
    aliases: ['jedzenie', 'dieta'],
  },
  zdrowie: {
    key: 'zdrowie',
    label: 'Zdrowie',
    file: 'zdrowie.html',
    aliases: ['zdrowie', 'zdrowie-po-50'],
  },
  ciekawe: {
    key: 'ciekawe',
    label: 'Ciekawe',
    file: 'ciekawe.html',
    aliases: ['ciekawe', 'lifestyle'],
  },
  mity: {
    key: 'mity',
    label: 'Mity',
    file: 'mity.html',
    aliases: ['mity', 'mit', 'obnazamy-mity', 'obnażamy-mity', 'sciema-czy-fakt', 'ściema-czy-fakt'],
  },
};

const CATEGORY_ALIAS_TO_KEY = new Map();
for (const definition of Object.values(CATEGORY_DEFINITIONS)) {
  for (const alias of definition.aliases) {
    CATEGORY_ALIAS_TO_KEY.set(alias, definition.key);
  }
}

const CATEGORY_LANDING_PAGES = new Set([
  'index.html',
  'porady.html',
  'rusz-sie.html',
  'jedzenie.html',
  'zdrowie.html',
  'ciekawe.html',
  'mity.html',
  'dziennik.html',
  'o-mnie.html',
]);

function normalizeCategoryInput(input) {
  return String(input || '')
    .toLowerCase()
    .trim()
    .normalize('NFKC')
    .replace(/\s+/g, '-');
}

function normalizeCategory(input, fallbackKey = 'ciekawe') {
  const normalized = normalizeCategoryInput(input);
  const key = CATEGORY_ALIAS_TO_KEY.get(normalized) || fallbackKey;
  const definition = CATEGORY_DEFINITIONS[key] || CATEGORY_DEFINITIONS.ciekawe;
  return {
    ...definition,
    inputMatched: CATEGORY_ALIAS_TO_KEY.has(normalized),
  };
}

function isSupportedCategory(input) {
  return CATEGORY_ALIAS_TO_KEY.has(normalizeCategoryInput(input));
}

function categoryFileFromKey(categoryKey) {
  return normalizeCategory(categoryKey).file;
}

function categoryLabelFromKey(categoryKey) {
  return normalizeCategory(categoryKey).label;
}

function categoryPageFromImportCategory(category) {
  if (!isSupportedCategory(category)) return '';
  return normalizeCategory(category).file;
}

module.exports = {
  CATEGORY_DEFINITIONS,
  CATEGORY_KEYS: new Set(Object.keys(CATEGORY_DEFINITIONS)),
  CATEGORY_LANDING_PAGES,
  CATEGORY_LANDING_URLS: CATEGORY_LANDING_PAGES,
  SUPPORTED_CATEGORY_KEYS: new Set([...CATEGORY_ALIAS_TO_KEY.keys()]),
  categoryFileFromKey,
  categoryLabelFromKey,
  categoryPageFromImportCategory,
  isSupportedCategory,
  normalizeCategory,
};
