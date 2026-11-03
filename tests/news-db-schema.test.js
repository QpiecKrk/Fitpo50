const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const SCHEMA_PATH = path.join(ROOT, 'docs', 'news-db-schema.sql');
const HELPER_PATH = path.join(ROOT, 'admin', 'helpers', 'news-db.php');
const NEWS_PULL_PATH = path.join(ROOT, 'scripts', 'news-pull.js');

const FIELD_COLUMNS = Object.freeze({
  id: ['id'],
  title: ['title'],
  content_html: ['content_html'],
  status: ['status'],
  sort_order: ['sort_order'],
  image_base: ['image_base'],
  image_alt: ['image_alt'],
  image_hashes: ['image_sha1_jpg', 'image_sha1_webp', 'image_sha1_avif'],
  sources: ['sources_json'],
  created_at: ['created_at'],
  updated_at: ['updated_at'],
  published_at: ['published_at'],
});

function readRequiredLiveFields() {
  const source = fs.readFileSync(NEWS_PULL_PATH, 'utf8');
  const match = source.match(/const REQUIRED_LIVE_FIELDS\s*=\s*\[([\s\S]*?)\];/);
  assert.ok(match, 'Nie znaleziono REQUIRED_LIVE_FIELDS w scripts/news-pull.js');
  return [...match[1].matchAll(/['"]([a-z_]+)['"]/g)].map((entry) => entry[1]);
}

function readTarget(filePath) {
  assert.ok(fs.existsSync(filePath), `Brak wymaganego pliku: ${path.relative(ROOT, filePath)}`);
  return fs.readFileSync(filePath, 'utf8');
}

function tableDefinition(schema, tableName) {
  const expression = new RegExp(
    `CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?[\\x60]?${tableName}[\\x60]?\\s*\\(([\\s\\S]*?)\\)\\s*ENGINE\\s*=\\s*InnoDB[\\s\\S]*?;`,
    'i',
  );
  const match = schema.match(expression);
  assert.ok(match, `Brak tabeli ${tableName} z ENGINE=InnoDB`);
  return match[0];
}

function listPhpFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listPhpFiles(fullPath);
    return entry.isFile() && entry.name.endsWith('.php') ? [fullPath] : [];
  });
}

test('schemat NEWS jest bezpiecznym, pustym schematem InnoDB', () => {
  const schema = readTarget(SCHEMA_PATH);
  assert.doesNotMatch(schema, /\bprobe_/i);
  assert.doesNotMatch(schema, /\bDROP\b/i);
  assert.doesNotMatch(schema, /^\s*(?:INSERT\s+INTO|UPDATE\s+[`\w]|DELETE\s+FROM)\b/im);

  for (const tableName of ['news', 'news_journal']) {
    const definition = tableDefinition(schema, tableName);
    assert.match(definition, /ENGINE\s*=\s*InnoDB/i);
    assert.match(definition, /(?:DEFAULT\s+)?CHAR(?:ACTER)?\s+SET\s*=\s*utf8mb4/i);
    assert.match(definition, /COLLATE\s*=\s*utf8mb4_unicode_ci/i);
  }
});

test('tabela news mapuje wszystkie 12 pól REQUIRED_LIVE_FIELDS', () => {
  const requiredFields = readRequiredLiveFields();
  assert.equal(requiredFields.length, 12);
  assert.deepEqual(Object.keys(FIELD_COLUMNS), requiredFields);

  const newsTable = tableDefinition(readTarget(SCHEMA_PATH), 'news');
  for (const field of requiredFields) {
    for (const column of FIELD_COLUMNS[field]) {
      assert.match(newsTable, new RegExp(`(?:^|\\n)\\s*[\\x60]?${column}[\\x60]?\\s+`, 'i'), `${field} -> ${column}`);
    }
  }
});

test('journal przechowuje pełną kopertę wyłącznie dla importu', () => {
  const journal = tableDefinition(readTarget(SCHEMA_PATH), 'news_journal');
  assert.match(journal, /before_item_json\s+JSON\s+NULL/i);
  assert.match(journal, /after_item_json\s+JSON\s+NULL/i);
  assert.match(journal, /import_envelope_json\s+JSON\s+NULL/i);
  assert.doesNotMatch(journal, /FOREIGN\s+KEY/i);
  assert.doesNotMatch(journal, /\bREFERENCES\b/i);
  assert.match(journal, /KEY\s+idx_news_journal_news_created\s*\(\s*news_id\s*,\s*created_at\s*\)/i);
  assert.match(
    journal,
    /snapshot_sha256\s+CHAR\s*\(\s*64\s*\)(?:\s+CHARACTER\s+SET\s+ascii\s+COLLATE\s+ascii_bin)?\s+NOT\s+NULL/i,
  );
  assert.doesNotMatch(journal, /full_snapshot_json/i);

  const compact = journal.replace(/\s+/g, ' ');
  assert.match(compact, /CHECK\s*\([\s\S]*operation\s*=\s*'import'[\s\S]*import_envelope_json\s+IS\s+NOT\s+NULL[\s\S]*operation\s*<>\s*'import'[\s\S]*import_envelope_json\s+IS\s+NULL[\s\S]*\)/i);
  for (const jsonPath of ['$.version', '$.updatedAt', '$.items']) {
    assert.ok(compact.includes(jsonPath), `CHECK importu nie sprawdza ${jsonPath}`);
  }
});

test('getNewsDb jest odrębnym połączeniem fail-closed', () => {
  const helper = readTarget(HELPER_PATH);
  assert.match(helper, /function\s+getNewsDb\s*\(\s*\)\s*:\s*PDO/i);

  for (const constantName of ['NEWS_DB_HOST', 'NEWS_DB_NAME', 'NEWS_DB_USER', 'NEWS_DB_PASS']) {
    assert.match(helper, new RegExp(`['"]${constantName}['"]`));
  }
  for (const legacyName of ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASS']) {
    assert.doesNotMatch(helper, new RegExp(`(?<!NEWS_)${legacyName}`));
  }

  assert.match(helper, /charset=utf8mb4/i);
  assert.match(helper, /PDO::ATTR_ERRMODE\s*=>\s*PDO::ERRMODE_EXCEPTION/);
  assert.match(helper, /PDO::ATTR_DEFAULT_FETCH_MODE\s*=>\s*PDO::FETCH_ASSOC/);
  assert.match(helper, /PDO::ATTR_EMULATE_PREPARES\s*=>\s*false/);
  assert.match(helper, /STRICT_ALL_TABLES/);
  assert.match(helper, /SET\s+SESSION\s+sql_mode/i);
  assert.match(helper, /SET\s+(?:SESSION\s+)?time_zone\s*=\s*['"]\+00:00['"]/i);
  assert.match(helper, /error_log\s*\([^;]*get_class\s*\(/i);
  assert.doesNotMatch(helper, /getMessage\s*\(/);
});

test('news-db.php nie jest jeszcze dołączany przez kod panelu ani mirror', () => {
  const roots = [path.join(ROOT, 'admin'), path.join(ROOT, '_site', 'admin')];
  const consumers = roots
    .flatMap(listPhpFiles)
    .filter((filePath) => filePath !== HELPER_PATH)
    .filter((filePath) => !/^config.*\.php$/i.test(path.basename(filePath)))
    .filter((filePath) => /(?:require|include)(?:_once)?[\s\S]{0,160}news-db\.php/i.test(fs.readFileSync(filePath, 'utf8')))
    .map((filePath) => path.relative(ROOT, filePath));

  assert.deepEqual(consumers, []);
});
