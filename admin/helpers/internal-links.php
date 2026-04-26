<?php

require_once __DIR__ . '/../config.php';

function getInternalArticleOptions(): array {
    $files = glob(SITE_ROOT . '*.html') ?: [];
    $excluded = [
        'index.html',
        'porady.html',
        'rusz-sie.html',
        'jedzenie.html',
        'zdrowie.html',
        'ciekawe.html',
        'dziennik.html',
        'moje-sukcesy.html',
        'google4a31b58b207723ed.html',
    ];

    $options = [];

    foreach ($files as $path) {
        $basename = basename($path);
        if (in_array($basename, $excluded, true)) {
            continue;
        }

        $title = extractTitleFromHtmlFile($path);
        $options[] = [
            'href' => $basename,
            'label' => $title ?: $basename,
        ];
    }

    usort($options, static fn(array $a, array $b): int => strcasecmp($a['label'], $b['label']));

    return $options;
}

function extractTitleFromHtmlFile(string $path): string {
    $content = file_get_contents($path, false, null, 0, 6000);
    if ($content === false) {
        return '';
    }

    if (preg_match('/<title>(.*?)<\/title>/is', $content, $m)) {
        return trim(html_entity_decode(strip_tags($m[1]), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'));
    }

    if (preg_match('/<h1[^>]*>(.*?)<\/h1>/is', $content, $m)) {
        return trim(html_entity_decode(strip_tags($m[1]), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'));
    }

    return '';
}

/**
 * @param array{min_words?:int,min_links?:int,max_links?:int,exclude_hrefs?:array<int|string,string>,current_href?:string} $options
 * @return array{html:string,added:int,skipped_short:bool}
 */
function autoLinkInternalArticlesInHtml(string $html, array $options = []): array {
    $minWords = max(1, (int)($options['min_words'] ?? 80));
    $minLinks = max(0, (int)($options['min_links'] ?? 2));
    $maxLinks = max(0, (int)($options['max_links'] ?? 2));
    if ($maxLinks < $minLinks) {
        $maxLinks = $minLinks;
    }

    $hasHtml = (stripos($html, '<html') !== false);

    $prev = libxml_use_internal_errors(true);
    $dom = new DOMDocument();
    if ($hasHtml) {
        $loaded = @$dom->loadHTML(
            '<?xml encoding="UTF-8">' . $html,
            LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD
        );
    } else {
        $loaded = @$dom->loadHTML(
            '<?xml encoding="UTF-8"><body>' . $html . '</body>',
            LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD
        );
    }

    if (!$loaded) {
        libxml_clear_errors();
        libxml_use_internal_errors($prev);
        return ['html' => $html, 'added' => 0, 'skipped_short' => false];
    }

    if ($hasHtml) {
        $body = $dom->getElementsByTagName('body')->item(0);
    } else {
        $body = $dom->getElementsByTagName('body')->item(0);
    }

    if (!$body instanceof DOMElement) {
        libxml_clear_errors();
        libxml_use_internal_errors($prev);
        return ['html' => $html, 'added' => 0, 'skipped_short' => false];
    }

    $plain = trim(preg_replace('/\s+/u', ' ', (string)$body->textContent) ?? '');
    $wordCount = countWordsUtf8($plain);
    if ($wordCount < $minWords) {
        libxml_clear_errors();
        libxml_use_internal_errors($prev);
        return ['html' => $hasHtml ? $dom->saveHTML() : normalizeBodyHtml($dom, $body), 'added' => 0, 'skipped_short' => true];
    }

    $excludeHrefSet = [];
    foreach ((array)($options['exclude_hrefs'] ?? []) as $excludedHref) {
        $normalizedExcluded = normalizeInternalHref((string)$excludedHref);
        if ($normalizedExcluded !== '') {
            $excludeHrefSet[$normalizedExcluded] = true;
        }
    }
    $currentHref = normalizeInternalHref((string)($options['current_href'] ?? ''));
    if ($currentHref !== '') {
        $excludeHrefSet[$currentHref] = true;
    }

    $articleOptions = array_values(array_filter(
        getInternalArticleOptions(),
        static function (array $article) use ($excludeHrefSet): bool {
            $href = normalizeInternalHref((string)($article['href'] ?? ''));
            if ($href === '') {
                return false;
            }
            return !isset($excludeHrefSet[$href]);
        }
    ));
    if ($articleOptions === []) {
        libxml_clear_errors();
        libxml_use_internal_errors($prev);
        return ['html' => $hasHtml ? $dom->saveHTML() : normalizeBodyHtml($dom, $body), 'added' => 0, 'skipped_short' => false];
    }

    $internalHrefSet = [];
    foreach ($articleOptions as $article) {
        $href = normalizeInternalHref((string)($article['href'] ?? ''));
        if ($href !== '') {
            $internalHrefSet[$href] = true;
        }
    }

    $existingInternal = [];
    $anchors = $body->getElementsByTagName('a');
    foreach ($anchors as $anchor) {
        $href = normalizeInternalHref((string)$anchor->getAttribute('href'));
        if ($href !== '' && isset($internalHrefSet[$href])) {
            $existingInternal[$href] = true;
        }
    }

    $needed = max($minLinks - count($existingInternal), 0);
    if ($needed === 0) {
        libxml_clear_errors();
        libxml_use_internal_errors($prev);
        return ['html' => $hasHtml ? $dom->saveHTML() : normalizeBodyHtml($dom, $body), 'added' => 0, 'skipped_short' => false];
    }

    $toAdd = min($needed, $maxLinks);
    $linkableContentLower = buildLinkableContentLower($dom, $body);
    $candidates = buildInternalLinkCandidates($articleOptions, $linkableContentLower);
    if ($candidates === []) {
        libxml_clear_errors();
        libxml_use_internal_errors($prev);
        return ['html' => $hasHtml ? $dom->saveHTML() : normalizeBodyHtml($dom, $body), 'added' => 0, 'skipped_short' => false];
    }

    $added = 0;
    foreach ($candidates as $candidate) {
        if ($added >= $toAdd) {
            break;
        }

        $href = normalizeInternalHref((string)$candidate['href']);
        if ($href === '' || isset($existingInternal[$href])) {
            continue;
        }

        $linked = insertKeywordLinkIntoDom(
            $dom,
            $body,
            (string)$candidate['keyword'],
            $href
        );

        if ($linked) {
            $existingInternal[$href] = true;
            $added++;
        }
    }

    libxml_clear_errors();
    libxml_use_internal_errors($prev);

    return [
        'html' => $hasHtml ? $dom->saveHTML() : normalizeBodyHtml($dom, $body),
        'added' => $added,
        'skipped_short' => false,
    ];
}

function normalizeBodyHtml(DOMDocument $dom, DOMElement $body): string {
    $out = '';
    foreach ($body->childNodes as $child) {
        $out .= $dom->saveHTML($child);
    }
    return trim(decodeStorageLetterEntities($out));
}

function normalizeInternalHref(string $href): string {
    $clean = trim($href);
    if ($clean === '') {
        return '';
    }

    $clean = preg_replace('#^https?://[^/]+/#i', '', $clean) ?? $clean;
    $clean = preg_replace('#^\.?/+#', '', $clean) ?? $clean;
    $clean = preg_replace('/#.*/', '', $clean) ?? $clean;
    return strtolower($clean);
}

function countWordsUtf8(string $text): int {
    if ($text === '') {
        return 0;
    }

    preg_match_all('/[\p{L}\p{N}]+/u', $text, $matches);
    return count($matches[0] ?? []);
}

function buildLinkableContentLower(DOMDocument $dom, DOMElement $body): string {
    $xpath = new DOMXPath($dom);
    $nodes = $xpath->query('.//text()[normalize-space(.) != "" and not(ancestor::a) and not(ancestor::script) and not(ancestor::style)]', $body);
    if (!$nodes) {
        return '';
    }

    $parts = [];
    foreach ($nodes as $node) {
        if (!$node instanceof DOMText) {
            continue;
        }
        $value = trim((string)$node->nodeValue);
        if ($value !== '') {
            $parts[] = $value;
        }
    }

    return mb_strtolower(implode(' ', $parts), 'UTF-8');
}

/**
 * @param array<int,array{href:string,label:string}> $options
 * @return array<int,array{href:string,keyword:string,score:int}>
 */
function buildInternalLinkCandidates(array $options, string $contentLower): array {
    $stopWords = [
        'oraz', 'ktory', 'ktora', 'ktore', 'ktorych', 'jak', 'dla', 'czy', 'po', 'na', 'do',
        'z', 'w', 'i', 'a', 'to', 'ten', 'ta', 'te', 'jest', 'fitpo50', 'roku', 'plus',
        'albo', 'ale', 'ani', 'bez', 'byc', 'byla', 'byli', 'bylo', 'byly', 'co', 'go', 'ich',
        'im', 'ja', 'jako', 'je', 'jego', 'jej', 'jesli', 'juz', 'kazdy', 'kiedy', 'kto', 'ktos',
        'lub', 'mam', 'masz', 'miec', 'mnie', 'moja', 'moze', 'mozna', 'my', 'nad', 'nam', 'nas',
        'nasz', 'nawet', 'nich', 'nie', 'nim', 'niz', 'od', 'ona', 'one', 'oni', 'ono', 'oraz',
        'pod', 'przed', 'przez', 'sie', 'swoj', 'tak', 'takze', 'tego', 'tej', 'temat', 'teraz',
        'twoj', 'tych', 'tylko', 'was', 'wasz', 'wiec', 'wiecej', 'wlasnie', 'wszystko', 'ze',
        'zeby',
    ];
    $stopWordSet = array_fill_keys($stopWords, true);
    $candidates = [];

    foreach ($options as $article) {
        $href = trim((string)($article['href'] ?? ''));
        if ($href === '') {
            continue;
        }

        $label = (string)($article['label'] ?? '');
        $slug = preg_replace('/\.html$/i', '', basename($href)) ?? '';
        $tokens = array_merge(
            preg_split('/[^\p{L}\p{N}]+/u', mb_strtolower($label, 'UTF-8')) ?: [],
            preg_split('/[^\p{L}\p{N}]+/u', mb_strtolower(str_replace('-', ' ', $slug), 'UTF-8')) ?: []
        );

        $tokens = array_values(array_unique(array_filter($tokens, static function (string $token) use ($stopWordSet): bool {
            if ($token === '' || mb_strlen($token, 'UTF-8') < 4) {
                return false;
            }
            if (isset($stopWordSet[$token])) {
                return false;
            }
            return !preg_match('/^\d+$/', $token);
        })));

        usort($tokens, static fn(string $a, string $b): int => mb_strlen($b, 'UTF-8') <=> mb_strlen($a, 'UTF-8'));

        foreach ($tokens as $token) {
            $pattern = buildKeywordRegexPattern($token);
            if (!preg_match($pattern, $contentLower)) {
                continue;
            }

            $candidates[] = [
                'href' => $href,
                'keyword' => $token,
                'score' => mb_strlen($token, 'UTF-8'),
            ];
        }
    }

    usort($candidates, static fn(array $a, array $b): int => ($b['score'] <=> $a['score']));
    return $candidates;
}

function insertKeywordLinkIntoDom(DOMDocument $dom, DOMElement $body, string $keyword, string $href): bool {
    $xpath = new DOMXPath($dom);
    $nodes = $xpath->query('.//text()[normalize-space(.) != "" and not(ancestor::a) and not(ancestor::script) and not(ancestor::style)]', $body);
    if (!$nodes) {
        return false;
    }

    $pattern = buildKeywordRegexPattern($keyword);
    foreach ($nodes as $node) {
        if (!$node instanceof DOMText) {
            continue;
        }

        $text = $node->nodeValue;
        if ($text === null || $text === '') {
            continue;
        }

        if (!preg_match($pattern, $text, $match, PREG_OFFSET_CAPTURE)) {
            continue;
        }

        $matchedText = (string)$match[1][0];
        $byteOffset = (int)$match[1][1];
        $safePrefix = mb_strcut($text, 0, $byteOffset, 'UTF-8');
        $start = mb_strlen($safePrefix, 'UTF-8');
        $length = mb_strlen($matchedText, 'UTF-8');

        $before = mb_substr($text, 0, $start, 'UTF-8');
        $after = mb_substr($text, $start + $length, null, 'UTF-8');

        $parent = $node->parentNode;
        if (!$parent instanceof DOMNode) {
            return false;
        }

        if ($before !== '') {
            $parent->insertBefore($dom->createTextNode($before), $node);
        }

        $anchor = $dom->createElement('a');
        $anchor->setAttribute('href', $href);
        $anchor->appendChild($dom->createTextNode($matchedText));
        $parent->insertBefore($anchor, $node);

        if ($after !== '') {
            $parent->insertBefore($dom->createTextNode($after), $node);
        }

        $parent->removeChild($node);
        return true;
    }

    return false;
}

function buildKeywordRegexPattern(string $keyword): string {
    $token = mb_strtolower(trim($keyword), 'UTF-8');
    if ($token === '') {
        return '/(?!x)x/';
    }

    $exact = preg_quote($token, '/');
    $stem = derivePolishKeywordStem($token);
    $alternatives = [$exact];

    if ($stem !== $token && mb_strlen($stem, 'UTF-8') >= 4) {
        $suffixes = [
            'a', 'ą', 'e', 'ę', 'i', 'ie', 'y', 'u', 'em', 'om',
            'ami', 'ach', 'owie', 'owa', 'owe', 'owy', 'owi',
            'ego', 'emu', 'owej', 'owych', 'owym',
        ];
        $suffixPattern = '(?:' . implode('|', array_map(static fn(string $s): string => preg_quote($s, '/'), $suffixes)) . ')?';
        $alternatives[] = preg_quote($stem, '/') . $suffixPattern;
    }

    $core = '(?:' . implode('|', array_unique($alternatives)) . ')';
    return '/(?<![\p{L}\p{N}])(' . $core . ')(?![\p{L}\p{N}])/ui';
}

function derivePolishKeywordStem(string $token): string {
    $lower = mb_strtolower(trim($token), 'UTF-8');
    if ($lower === '' || mb_strlen($lower, 'UTF-8') < 6) {
        return $lower;
    }

    $endings = [
        'owych', 'owym', 'owego', 'owej',
        'owie', 'ami', 'ach',
        'owy', 'owa', 'owe', 'owi',
        'ego', 'emu',
        'ie', 'om', 'em',
        'a', 'ą', 'e', 'ę', 'i', 'y', 'u',
    ];

    foreach ($endings as $ending) {
        if (!str_ends_with($lower, $ending)) {
            continue;
        }
        $stem = mb_substr($lower, 0, mb_strlen($lower, 'UTF-8') - mb_strlen($ending, 'UTF-8'), 'UTF-8');
        if (mb_strlen($stem, 'UTF-8') >= 4) {
            return $stem;
        }
    }

    return $lower;
}

function formatAutoInternalLinksMessage(int $added, bool $skippedShort, int $minWords): string {
    if ($skippedShort) {
        return ' Auto-linking: dodano 0 linków (treść krótsza niż ' . $minWords . ' słów).';
    }

    if ($added === 1) {
        return ' Auto-linking: dodano 1 link wewnętrzny.';
    }

    if ($added % 10 >= 2 && $added % 10 <= 4 && !($added % 100 >= 12 && $added % 100 <= 14)) {
        return ' Auto-linking: dodano ' . $added . ' linki wewnętrzne.';
    }

    return ' Auto-linking: dodano ' . $added . ' linków wewnętrznych.';
}

/**
 * @return array{min_links:int,max_links:int}
 */
function deriveAutoLinkLimitsForWordCount(int $wordCount, string $profile = 'default'): array {
    $words = max(0, $wordCount);
    $mode = strtolower(trim($profile));

    if ($mode === 'news') {
        if ($words < 180) {
            return ['min_links' => 1, 'max_links' => 1];
        }
        if ($words < 360) {
            return ['min_links' => 2, 'max_links' => 2];
        }
        return ['min_links' => 3, 'max_links' => 3];
    }

    if ($words < 180) {
        return ['min_links' => 1, 'max_links' => 1];
    }
    if ($words < 420) {
        return ['min_links' => 2, 'max_links' => 2];
    }
    return ['min_links' => 3, 'max_links' => 3];
}

/**
 * @return array<int,string>
 */
function validateArticleOnlyLinksInHtml(string $html): array {
    $errors = [];
    $allowedHrefSet = [];
    foreach (getInternalArticleOptions() as $article) {
        $href = normalizeInternalHref((string)($article['href'] ?? ''));
        if ($href !== '') {
            $allowedHrefSet[$href] = true;
        }
    }

    if ($allowedHrefSet === []) {
        return $errors;
    }

    $prev = libxml_use_internal_errors(true);
    $dom = new DOMDocument();
    $encoded = mb_convert_encoding($html, 'HTML-ENTITIES', 'UTF-8');
    $loaded = @$dom->loadHTML('<body>' . $encoded . '</body>', LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);

    if (!$loaded) {
        libxml_use_internal_errors($prev);
        return $errors;
    }

    $anchors = $dom->getElementsByTagName('a');
    foreach ($anchors as $anchor) {
        $hrefRaw = trim((string)$anchor->getAttribute('href'));
        if ($hrefRaw === '') {
            continue;
        }
        $href = normalizeInternalHref($hrefRaw);
        if ($href === '' || !isset($allowedHrefSet[$href])) {
            $errors[] = 'W treści wykryto niedozwolony link. Dozwolone są tylko linki do artykułów HTML: ' . $hrefRaw;
        }
    }

    libxml_clear_errors();
    libxml_use_internal_errors($prev);

    return $errors;
}

function decodeStorageLetterEntities(string $html): string {
    return preg_replace_callback(
        '/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]+);/',
        static function (array $match): string {
            $entity = $match[0];
            $name = strtolower((string)$match[1]);
            $reserved = ['amp', 'lt', 'gt', 'quot', 'apos', 'nbsp'];
            if (in_array($name, $reserved, true)) {
                return $entity;
            }

            $decoded = html_entity_decode($entity, ENT_QUOTES | ENT_HTML5, 'UTF-8');
            if ($decoded === $entity || $decoded === '') {
                return $entity;
            }

            return preg_match('/[\p{L}\p{M}]/u', $decoded) ? $decoded : $entity;
        },
        $html
    ) ?? $html;
}
