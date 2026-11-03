-- Shadow store NEWS. Ten plik zawiera wyłącznie schemat, bez danych i operacji usuwających.
-- MariaDB 11.8: kolumny JSON mają walidację JSON, a dodatkowe CHECK pilnują kształtu danych.

CREATE TABLE news (
    id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    title VARCHAR(512) NOT NULL,
    content_html MEDIUMTEXT NOT NULL,
    status ENUM('draft', 'published') NOT NULL,
    sort_order SMALLINT UNSIGNED NOT NULL,
    image_base VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NULL,
    image_alt VARCHAR(512) NOT NULL DEFAULT '',
    image_sha1_jpg CHAR(40) CHARACTER SET ascii COLLATE ascii_bin NULL,
    image_sha1_webp CHAR(40) CHARACTER SET ascii COLLATE ascii_bin NULL,
    image_sha1_avif CHAR(40) CHARACTER SET ascii COLLATE ascii_bin NULL,
    sources_json JSON NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    published_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    KEY idx_news_status_sort (status, sort_order, published_at),
    KEY idx_news_updated_at (updated_at),
    CONSTRAINT chk_news_sort_order CHECK (sort_order BETWEEN 1 AND 9999),
    CONSTRAINT chk_news_sources_array CHECK (JSON_TYPE(sources_json) = 'ARRAY'),
    CONSTRAINT chk_news_image_hashes CHECK (
        (
            image_sha1_jpg IS NULL
            AND image_sha1_webp IS NULL
            AND image_sha1_avif IS NULL
        )
        OR
        (
            image_sha1_jpg REGEXP '^[0-9a-f]{40}$'
            AND image_sha1_webp REGEXP '^[0-9a-f]{40}$'
            AND image_sha1_avif REGEXP '^[0-9a-f]{40}$'
        )
    ),
    CONSTRAINT chk_news_published_fields CHECK (
        status <> 'published'
        OR (
            published_at IS NOT NULL
            AND image_base IS NOT NULL
            AND CHAR_LENGTH(image_alt) > 0
        )
    )
) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

CREATE TABLE news_journal (
    -- news_journal celowo nie ma klucza obcego, bo wpisy dziennika muszą przetrwać usunięcie newsa.
    journal_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    change_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    news_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
    operation ENUM(
        'import',
        'create',
        'update',
        'publish',
        'unpublish',
        'delete',
        'cache_rebuild'
    ) NOT NULL,
    before_item_json JSON NULL,
    after_item_json JSON NULL,
    import_envelope_json JSON NULL,
    snapshot_sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    store_updated_at DATETIME(6) NOT NULL,
    actor_type ENUM('panel', 'importer', 'system') NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (journal_id),
    UNIQUE KEY uq_news_journal_change_id (change_id),
    KEY idx_news_journal_news_created (news_id, created_at),
    KEY idx_news_journal_created (created_at),
    CONSTRAINT chk_news_journal_snapshot_sha256 CHECK (
        snapshot_sha256 REGEXP '^[0-9a-f]{64}$'
    ),
    CONSTRAINT chk_news_journal_import_envelope CHECK (
        (
            operation = 'import'
            AND import_envelope_json IS NOT NULL
            AND JSON_TYPE(import_envelope_json) = 'OBJECT'
            AND JSON_CONTAINS_PATH(
                import_envelope_json,
                'all',
                '$.version',
                '$.updatedAt',
                '$.items'
            ) = 1
            AND JSON_TYPE(JSON_EXTRACT(import_envelope_json, '$.items')) = 'ARRAY'
        )
        OR
        (
            operation <> 'import'
            AND import_envelope_json IS NULL
        )
    ),
    CONSTRAINT chk_news_journal_item_images CHECK (
        (before_item_json IS NULL OR JSON_TYPE(before_item_json) = 'OBJECT')
        AND (after_item_json IS NULL OR JSON_TYPE(after_item_json) = 'OBJECT')
    )
) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
