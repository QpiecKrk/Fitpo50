<?php
declare(strict_types=1);

final class NewsDbImportException extends RuntimeException
{
    public function __construct(public readonly string $category)
    {
        parent::__construct($category);
    }
}

const NEWS_DB_IMPORT_FIELDS = [
    'id', 'title', 'content_html', 'status', 'sort_order', 'image_base',
    'image_alt', 'image_hashes', 'sources', 'created_at', 'updated_at',
    'published_at',
];

function newsDbImportFail(string $category): never
{
    throw new NewsDbImportException($category);
}

function newsDbImportCanonicalJson(mixed $value): string
{
    try {
        return json_encode(
            $value,
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR
        );
    } catch (JsonException) {
        newsDbImportFail('JSON_ENCODING_ERROR');
    }
}

function newsDbImportUtc(string $value, bool $nullable, string $field): ?array
{
    if ($value === '') {
        if ($nullable) {
            return null;
        }
        newsDbImportFail('DATE_REQUIRED_' . strtoupper($field));
    }

    try {
        $date = new DateTimeImmutable($value);
    } catch (Throwable) {
        newsDbImportFail('DATE_INVALID_' . strtoupper($field));
    }

    $utc = $date->setTimezone(new DateTimeZone('UTC'));
    return [
        'json' => $utc->format('Y-m-d\TH:i:s.u\Z'),
        'database' => $utc->format('Y-m-d H:i:s.u'),
    ];
}

function newsDbImportImageHashes(mixed $value): array
{
    if (!is_array($value)) {
        newsDbImportFail('IMAGE_HASHES_INVALID');
    }

    $normalized = [];
    $present = 0;
    foreach (['jpg', 'webp', 'avif'] as $format) {
        $hash = strtolower(trim((string) ($value[$format] ?? '')));
        if ($hash !== '') {
            $present++;
            if (!preg_match('/^[0-9a-f]{40}$/', $hash)) {
                newsDbImportFail('IMAGE_HASH_INVALID_' . strtoupper($format));
            }
            $normalized[$format] = $hash;
        } else {
            $normalized[$format] = null;
        }
    }

    if ($present !== 0 && $present !== 3) {
        newsDbImportFail('IMAGE_HASHES_PARTIAL');
    }

    return $normalized;
}

function newsDbImportSources(mixed $value): array
{
    if (!is_array($value) || !array_is_list($value)) {
        newsDbImportFail('SOURCES_INVALID');
    }

    $sources = [];
    foreach ($value as $source) {
        if (!is_array($source)) {
            newsDbImportFail('SOURCE_INVALID');
        }
        $label = trim((string) ($source['label'] ?? ''));
        $url = trim((string) ($source['url'] ?? ''));
        if ($label === '' || !preg_match('#^https?://#i', $url)) {
            newsDbImportFail('SOURCE_INVALID');
        }
        $sources[] = ['label' => $label, 'url' => $url];
    }

    return $sources;
}

function newsDbImportMapItem(mixed $item): array
{
    if (!is_array($item)) {
        newsDbImportFail('ITEM_INVALID');
    }
    foreach (NEWS_DB_IMPORT_FIELDS as $field) {
        if (!array_key_exists($field, $item)) {
            newsDbImportFail('FIELD_MISSING_' . strtoupper($field));
        }
    }

    $id = trim((string) $item['id']);
    $title = trim((string) $item['title']);
    $content = (string) $item['content_html'];
    $status = (string) $item['status'];
    $sortOrder = filter_var($item['sort_order'], FILTER_VALIDATE_INT);
    $imageBase = trim((string) $item['image_base']);
    $imageAlt = trim((string) $item['image_alt']);
    if ($id === '' || strlen($id) > 128 || !preg_match('/^[A-Za-z0-9_-]+$/', $id)) {
        newsDbImportFail('ID_INVALID');
    }
    if ($title === '' || mb_strlen($title) > 512 || $content === '') {
        newsDbImportFail('TEXT_FIELD_INVALID');
    }
    if (!in_array($status, ['draft', 'published'], true)) {
        newsDbImportFail('STATUS_INVALID');
    }
    if ($sortOrder === false || $sortOrder < 1 || $sortOrder > 9999) {
        newsDbImportFail('SORT_ORDER_INVALID');
    }
    if ($imageBase !== '' && (strlen($imageBase) > 191 || !preg_match('/^[A-Za-z0-9_-]+$/', $imageBase))) {
        newsDbImportFail('IMAGE_BASE_INVALID');
    }

    $hashes = newsDbImportImageHashes($item['image_hashes']);
    $sources = newsDbImportSources($item['sources']);
    $created = newsDbImportUtc((string) $item['created_at'], false, 'created_at');
    $updated = newsDbImportUtc((string) $item['updated_at'], false, 'updated_at');
    $published = newsDbImportUtc((string) $item['published_at'], true, 'published_at');
    if ($status === 'published' && ($published === null || $imageBase === '' || $imageAlt === '')) {
        newsDbImportFail('PUBLISHED_FIELDS_REQUIRED');
    }

    $canonical = [
        'id' => $id,
        'title' => $title,
        'content_html' => $content,
        'status' => $status,
        'sort_order' => (int) $sortOrder,
        'image_base' => $imageBase,
        'image_alt' => $imageAlt,
        'image_hashes' => [
            'jpg' => $hashes['jpg'] ?? '',
            'webp' => $hashes['webp'] ?? '',
            'avif' => $hashes['avif'] ?? '',
        ],
        'sources' => $sources,
        'created_at' => $created['json'],
        'updated_at' => $updated['json'],
        'published_at' => $published['json'] ?? '',
    ];

    $row = [
        'id' => $id,
        'title' => $title,
        'content_html' => $content,
        'status' => $status,
        'sort_order' => (int) $sortOrder,
        'image_base' => $imageBase === '' ? null : $imageBase,
        'image_alt' => $imageAlt,
        'image_hashes' => $hashes,
        'image_sha1_jpg' => $hashes['jpg'],
        'image_sha1_webp' => $hashes['webp'],
        'image_sha1_avif' => $hashes['avif'],
        'sources_json' => newsDbImportCanonicalJson($sources),
        'created_at' => $created['database'],
        'updated_at' => $updated['database'],
        'published_at' => $published['database'] ?? null,
    ];

    return ['item' => $canonical, 'row' => $row];
}

function newsDbImportCanonicalItemFromDatabaseRow(array $row): array
{
    $sources = $row['sources_json'] ?? [];
    if (is_string($sources)) {
        try {
            $sources = json_decode($sources, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            newsDbImportFail('DATABASE_SOURCE_JSON_INVALID');
        }
    }
    $hashes = is_array($row['image_hashes'] ?? null) ? $row['image_hashes'] : [
        'jpg' => $row['image_sha1_jpg'] ?? null,
        'webp' => $row['image_sha1_webp'] ?? null,
        'avif' => $row['image_sha1_avif'] ?? null,
    ];
    return newsDbImportMapItem([
        'id' => $row['id'],
        'title' => $row['title'],
        'content_html' => $row['content_html'],
        'status' => $row['status'],
        'sort_order' => (int) $row['sort_order'],
        'image_base' => $row['image_base'] ?? '',
        'image_alt' => $row['image_alt'] ?? '',
        'image_hashes' => [
            'jpg' => $hashes['jpg'] ?? '',
            'webp' => $hashes['webp'] ?? '',
            'avif' => $hashes['avif'] ?? '',
        ],
        'sources' => $sources,
        'created_at' => str_replace(' ', 'T', (string) $row['created_at']) . 'Z',
        'updated_at' => str_replace(' ', 'T', (string) $row['updated_at']) . 'Z',
        'published_at' => empty($row['published_at']) ? '' : str_replace(' ', 'T', (string) $row['published_at']) . 'Z',
    ])['item'];
}

function newsDbImportItemSha256(array $item): string
{
    return hash('sha256', newsDbImportCanonicalJson($item));
}

function newsDbImportSnapshotFromRows(array $rows, string $updatedAt): string
{
    $items = array_map('newsDbImportCanonicalItemFromDatabaseRow', $rows);
    usort($items, static fn(array $a, array $b): int => strcmp($a['id'], $b['id']));
    $updated = newsDbImportUtc(str_replace(' ', 'T', $updatedAt) . 'Z', false, 'store_updated_at');
    return hash('sha256', newsDbImportCanonicalJson([
        'version' => 1, 'updatedAt' => $updated['json'], 'items' => $items,
    ]));
}

function newsDbCanonicalItemFromDatabaseRow(array $row): array
{
    return newsDbImportCanonicalItemFromDatabaseRow($row);
}

function newsDbSnapshotFromRows(array $rows, string $updatedAt): string
{
    return newsDbImportSnapshotFromRows($rows, $updatedAt);
}
