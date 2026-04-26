<?php

require_once __DIR__ . '/../config.php';

function gitAutoSyncEnabled(): bool {
    $raw = getenv('FITPO50_AUTO_GIT_SYNC');
    if ($raw === false || trim((string)$raw) === '') {
        return true;
    }

    $value = strtolower(trim((string)$raw));
    return !in_array($value, ['0', 'false', 'off', 'no'], true);
}

function gitAutoSyncRemote(): string {
    $raw = getenv('FITPO50_GIT_REMOTE');
    $value = trim((string)($raw === false ? '' : $raw));
    return $value !== '' ? $value : 'origin';
}

function gitAutoSyncFallbackBranch(): string {
    $raw = getenv('FITPO50_GIT_BRANCH');
    $value = trim((string)($raw === false ? '' : $raw));
    return $value !== '' ? $value : 'main';
}

/**
 * @param array<int,string> $groups
 * @return array{status:string,message:string,commit?:string,branch?:string}
 */
function runGitAutoSync(array $groups, string $actionLabel): array {
    if (!gitAutoSyncEnabled()) {
        return ['status' => 'disabled', 'message' => 'Auto-sync Git jest wyłączony (FITPO50_AUTO_GIT_SYNC=0).'];
    }

    $repoRoot = rtrim(SITE_ROOT, DIRECTORY_SEPARATOR);
    if (!is_dir($repoRoot . DIRECTORY_SEPARATOR . '.git')) {
        return ['status' => 'error', 'message' => 'Brak repozytorium Git w SITE_ROOT.'];
    }

    $lockDir = $repoRoot . DIRECTORY_SEPARATOR . 'data';
    if (!is_dir($lockDir) && !@mkdir($lockDir, 0755, true) && !is_dir($lockDir)) {
        return ['status' => 'error', 'message' => 'Nie udało się utworzyć katalogu locka auto-sync.'];
    }

    $lockPath = $lockDir . DIRECTORY_SEPARATOR . 'git-sync.lock';
    $lockHandle = @fopen($lockPath, 'c');
    if ($lockHandle === false) {
        return ['status' => 'error', 'message' => 'Nie udało się otworzyć locka auto-sync.'];
    }

    if (!@flock($lockHandle, LOCK_EX | LOCK_NB)) {
        fclose($lockHandle);
        return ['status' => 'error', 'message' => 'Trwa inna synchronizacja Git. Spróbuj ponownie za chwilę.'];
    }

    try {
        $probe = runGitCommand(['git', 'rev-parse', '--is-inside-work-tree'], $repoRoot);
        if ($probe['exit_code'] !== 0 || trim($probe['stdout']) !== 'true') {
            return ['status' => 'error', 'message' => 'Katalog nie jest poprawnym repozytorium Git.'];
        }

        $paths = resolveGitSyncPaths($repoRoot, $groups);
        if (empty($paths)) {
            return ['status' => 'noop', 'message' => 'Brak ścieżek do synchronizacji.'];
        }

        $addResult = runGitCommand(array_merge(['git', 'add', '-A', '--'], $paths), $repoRoot);
        if ($addResult['exit_code'] !== 0) {
            return ['status' => 'error', 'message' => 'Błąd git add: ' . shortenGitError($addResult['stderr'])];
        }

        $diffResult = runGitCommand(array_merge(['git', 'diff', '--cached', '--quiet', '--'], $paths), $repoRoot);
        if ($diffResult['exit_code'] === 0) {
            return ['status' => 'noop', 'message' => 'Brak zmian do commita.'];
        }
        if ($diffResult['exit_code'] > 1) {
            return ['status' => 'error', 'message' => 'Błąd git diff: ' . shortenGitError($diffResult['stderr'])];
        }

        $commitMessage = '[auto-sync] ' . $actionLabel . ' ' . date('Y-m-d H:i:s');
        $commitResult = runGitCommand(array_merge(['git', 'commit', '-m', $commitMessage, '--'], $paths), $repoRoot);
        if ($commitResult['exit_code'] !== 0) {
            $stderr = trim($commitResult['stderr'] . "\n" . $commitResult['stdout']);
            if (stripos($stderr, 'nothing to commit') !== false) {
                return ['status' => 'noop', 'message' => 'Brak zmian do commita.'];
            }
            return ['status' => 'error', 'message' => 'Błąd git commit: ' . shortenGitError($stderr)];
        }

        $branchResult = runGitCommand(['git', 'rev-parse', '--abbrev-ref', 'HEAD'], $repoRoot);
        $branch = trim($branchResult['stdout']);
        if ($branchResult['exit_code'] !== 0 || $branch === '' || $branch === 'HEAD') {
            $branch = gitAutoSyncFallbackBranch();
        }

        $remote = gitAutoSyncRemote();
        $pushResult = runGitCommand(['git', 'push', $remote, $branch], $repoRoot);
        if ($pushResult['exit_code'] !== 0) {
            $pushErrorRaw = trim($pushResult['stderr'] . "\n" . $pushResult['stdout']);
            if (isNonFastForwardPushError($pushErrorRaw)) {
                $draftProtection = null;
                if (in_array('news', $groups, true)) {
                    $draftProtection = captureLocalNewsDrafts($repoRoot);
                    if (($draftProtection['status'] ?? 'error') !== 'ok') {
                        return [
                            'status' => 'error',
                            'message' => 'Commit zapisany lokalnie, ale nie udało się zabezpieczyć draftów NEWS przed rebase: ' . ($draftProtection['message'] ?? 'nieznany błąd'),
                            'branch' => $branch,
                        ];
                    }
                }

                $pullResult = runGitCommand(['git', 'pull', '--rebase', $remote, $branch], $repoRoot);
                if ($pullResult['exit_code'] === 0) {
                    if ($draftProtection !== null) {
                        $restoreResult = restoreLocalNewsDrafts($repoRoot, $draftProtection);
                        if (($restoreResult['status'] ?? 'error') !== 'ok') {
                            return [
                                'status' => 'error',
                                'message' => 'Commit zapisany lokalnie, ale po rebase nie udało się przywrócić draftów NEWS: ' . ($restoreResult['message'] ?? 'nieznany błąd'),
                                'branch' => $branch,
                            ];
                        }
                    }

                    $pushRetry = runGitCommand(['git', 'push', $remote, $branch], $repoRoot);
                    if ($pushRetry['exit_code'] === 0) {
                        $hashResult = runGitCommand(['git', 'rev-parse', '--short', 'HEAD'], $repoRoot);
                        $commitHash = trim($hashResult['stdout']);

                        return [
                            'status' => 'ok',
                            'message' => 'Wysłano zmiany do Git (' . $branch . ') po automatycznej synchronizacji.',
                            'commit' => $commitHash !== '' ? $commitHash : null,
                            'branch' => $branch,
                        ];
                    }

                    return [
                        'status' => 'error',
                        'message' => 'Commit zapisany lokalnie, ale push po rebase się nie udał: ' . shortenGitError(trim($pushRetry['stderr'] . "\n" . $pushRetry['stdout'])),
                        'branch' => $branch,
                    ];
                }

                runGitCommand(['git', 'rebase', '--abort'], $repoRoot);
                return [
                    'status' => 'error',
                    'message' => 'Commit zapisany lokalnie, ale auto-rebase przed push się nie udał: ' . shortenGitError(trim($pullResult['stderr'] . "\n" . $pullResult['stdout'])),
                    'branch' => $branch,
                ];
            }

            return [
                'status' => 'error',
                'message' => 'Commit zapisany lokalnie, ale push się nie udał: ' . shortenGitError($pushErrorRaw),
                'branch' => $branch,
            ];
        }

        $hashResult = runGitCommand(['git', 'rev-parse', '--short', 'HEAD'], $repoRoot);
        $commitHash = trim($hashResult['stdout']);

        return [
            'status' => 'ok',
            'message' => 'Wysłano zmiany do Git (' . $branch . ').',
            'commit' => $commitHash !== '' ? $commitHash : null,
            'branch' => $branch,
        ];
    } finally {
        @flock($lockHandle, LOCK_UN);
        fclose($lockHandle);
        @unlink($lockPath);
    }
}

/**
 * @param array<int,string>|null $result
 */
function gitSyncResultNote(?array $result): string {
    if (!$result) {
        return '';
    }

    return match ($result['status'] ?? '') {
        'ok' => ' Auto-sync Git: OK.',
        'noop' => ' Auto-sync Git: brak zmian do wysłania.',
        'disabled' => ' Auto-sync Git: wyłączony.',
        default => '',
    };
}

/**
 * @param array<int,string>|null $result
 */
function gitSyncFlashError(?array $result): ?string {
    if (!$result) {
        return null;
    }
    if (($result['status'] ?? '') !== 'error') {
        return null;
    }
    return 'Auto-sync Git nie powiódł się: ' . ($result['message'] ?? 'nieznany błąd');
}

/**
 * @param array<int,string> $groups
 * @return array<int,string>
 */
function resolveGitSyncPaths(string $repoRoot, array $groups): array {
    $groupMap = [
        'news' => [
            'data/news-live.json',
            '_site/data/news-live.json',
            'assets/data/news-fallback.json',
            'assets/news',
            'data/news-backups/.gitkeep',
            '_site/assets/data/news-fallback.json',
            '_site/assets/news',
            '_site/data/news-backups/.gitkeep',
        ],
        'sukcesy' => [
            'calendar-entries.json',
            'dziennik.html',
            'moje-sukcesy.html',
            'sitemap.xml',
            'sukcesy',
            '_site/calendar-entries.json',
            '_site/dziennik.html',
            '_site/moje-sukcesy.html',
            '_site/sitemap.xml',
            '_site/sukcesy',
        ],
    ];

    $paths = [];
    foreach ($groups as $group) {
        foreach (($groupMap[$group] ?? []) as $path) {
            if (gitSyncPathRelevant($repoRoot, $path)) {
                $paths[] = $path;
            }
        }
    }

    $uniquePaths = array_values(array_unique($paths));

    if (!in_array('news', $groups, true)) {
        $uniquePaths = array_values(array_filter(
            $uniquePaths,
            static fn(string $path): bool => !isNewsSyncPath($path)
        ));
    }

    return $uniquePaths;
}

function isNewsSyncPath(string $path): bool {
    $normalized = ltrim(str_replace('\\', '/', $path), '/');

    $prefixes = [
        'data/news-live.json',
        '_site/data/news-live.json',
        'assets/data/news-fallback.json',
        '_site/assets/data/news-fallback.json',
        'assets/news',
        '_site/assets/news',
        'data/news-backups',
        '_site/data/news-backups',
    ];

    foreach ($prefixes as $prefix) {
        if ($normalized === $prefix || str_starts_with($normalized, $prefix . '/')) {
            return true;
        }
    }

    return false;
}

function gitSyncPathRelevant(string $repoRoot, string $path): bool {
    $absolute = $repoRoot . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $path);
    if (file_exists($absolute) || is_dir($absolute)) {
        return true;
    }

    $tracked = runGitCommand(['git', 'ls-files', '--error-unmatch', '--', $path], $repoRoot);
    return $tracked['exit_code'] === 0;
}

/**
 * @param array<int,string> $args
 * @return array{stdout:string,stderr:string,exit_code:int}
 */
function runGitCommand(array $args, string $cwd): array {
    $command = implode(' ', array_map(static fn(string $arg): string => escapeshellarg($arg), $args));

    $descriptors = [
        1 => ['pipe', 'w'],
        2 => ['pipe', 'w'],
    ];

    $process = @proc_open($command, $descriptors, $pipes, $cwd);
    if (!is_resource($process)) {
        return ['stdout' => '', 'stderr' => 'Nie udało się uruchomić polecenia.', 'exit_code' => 127];
    }

    $stdout = stream_get_contents($pipes[1]);
    $stderr = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);

    $exit = proc_close($process);
    return ['stdout' => (string)$stdout, 'stderr' => (string)$stderr, 'exit_code' => (int)$exit];
}

function shortenGitError(string $error): string {
    $line = trim(preg_replace('/\s+/u', ' ', $error) ?? '');
    if ($line === '') {
        return 'brak szczegółów';
    }
    if (mb_strlen($line) <= 220) {
        return $line;
    }
    return mb_substr($line, 0, 217) . '...';
}

function isNonFastForwardPushError(string $error): bool {
    $haystack = strtolower($error);
    return str_contains($haystack, '[rejected]')
        || str_contains($haystack, 'fetch first')
        || str_contains($haystack, 'non-fast-forward');
}

/**
 * @return array{status:string,message?:string,drafts?:array<int,array<string,mixed>>}
 */
function captureLocalNewsDrafts(string $repoRoot): array {
    $storePath = $repoRoot . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'news-live.json';
    if (!is_file($storePath)) {
        return ['status' => 'ok', 'drafts' => []];
    }

    $raw = file_get_contents($storePath);
    if ($raw === false || trim($raw) === '') {
        return ['status' => 'ok', 'drafts' => []];
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        return ['status' => 'error', 'message' => 'Lokalny news-live.json ma nieprawidłowy JSON.'];
    }

    $drafts = [];
    foreach (($decoded['items'] ?? []) as $item) {
        if (!is_array($item)) {
            continue;
        }
        if ((string)($item['status'] ?? '') !== 'draft') {
            continue;
        }

        $id = trim((string)($item['id'] ?? ''));
        if ($id === '') {
            continue;
        }

        $drafts[] = $item;
    }

    return ['status' => 'ok', 'drafts' => $drafts];
}

/**
 * @param array{status:string,drafts?:array<int,array<string,mixed>>} $snapshot
 * @return array{status:string,message?:string}
 */
function restoreLocalNewsDrafts(string $repoRoot, array $snapshot): array {
    $drafts = $snapshot['drafts'] ?? [];
    if (!is_array($drafts) || $drafts === []) {
        return ['status' => 'ok'];
    }

    $storePath = $repoRoot . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'news-live.json';
    $storeRaw = is_file($storePath) ? file_get_contents($storePath) : false;
    $store = [];
    if ($storeRaw !== false && trim((string)$storeRaw) !== '') {
        $decoded = json_decode((string)$storeRaw, true);
        if (!is_array($decoded)) {
            return ['status' => 'error', 'message' => 'Po rebase news-live.json ma nieprawidłowy JSON.'];
        }
        $store = $decoded;
    }

    $items = [];
    foreach (($store['items'] ?? []) as $item) {
        if (is_array($item)) {
            $items[] = $item;
        }
    }

    $indexById = [];
    foreach ($items as $idx => $item) {
        $id = trim((string)($item['id'] ?? ''));
        if ($id !== '') {
            $indexById[$id] = $idx;
        }
    }

    $changed = false;
    foreach ($drafts as $draft) {
        if (!is_array($draft)) {
            continue;
        }
        $id = trim((string)($draft['id'] ?? ''));
        if ($id === '') {
            continue;
        }

        if (!array_key_exists($id, $indexById)) {
            $items[] = $draft;
            $indexById[$id] = count($items) - 1;
            $changed = true;
            continue;
        }

        $existing = $items[$indexById[$id]] ?? null;
        if (!is_array($existing)) {
            $items[$indexById[$id]] = $draft;
            $changed = true;
            continue;
        }

        if ((string)($existing['status'] ?? '') === 'draft') {
            $merged = array_replace($existing, $draft);
            if ($merged !== $existing) {
                $items[$indexById[$id]] = $merged;
                $changed = true;
            }
        }
    }

    if (!$changed) {
        return ['status' => 'ok'];
    }

    $store['version'] = 1;
    $store['updatedAt'] = date('c');
    $store['items'] = $items;

    $writeResult = atomicWriteGitSyncJson($storePath, $store);
    if (($writeResult['status'] ?? 'error') !== 'ok') {
        return $writeResult;
    }

    $mirrorPath = $repoRoot . DIRECTORY_SEPARATOR . '_site' . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'news-live.json';
    if (is_dir(dirname($mirrorPath))) {
        $mirrorWrite = atomicWriteGitSyncJson($mirrorPath, $store);
        if (($mirrorWrite['status'] ?? 'error') !== 'ok') {
            return $mirrorWrite;
        }
    }

    $add = runGitCommand(['git', 'add', '-A', '--', 'data/news-live.json', '_site/data/news-live.json'], $repoRoot);
    if ($add['exit_code'] !== 0) {
        return ['status' => 'error', 'message' => 'Nie udało się dodać przywróconych draftów do indeksu Git: ' . shortenGitError($add['stderr'])];
    }

    return ['status' => 'ok'];
}

/**
 * @param array<string,mixed> $payload
 * @return array{status:string,message?:string}
 */
function atomicWriteGitSyncJson(string $path, array $payload): array {
    $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    if ($json === false) {
        return ['status' => 'error', 'message' => 'Nie udało się zakodować JSON podczas ochrony draftów NEWS.'];
    }

    $tmp = $path . '.tmp';
    if (file_put_contents($tmp, $json . "\n", LOCK_EX) === false) {
        return ['status' => 'error', 'message' => 'Nie udało się zapisać pliku tymczasowego: ' . basename($path)];
    }

    if (!@rename($tmp, $path)) {
        @unlink($tmp);
        return ['status' => 'error', 'message' => 'Nie udało się podmienić pliku: ' . basename($path)];
    }

    return ['status' => 'ok'];
}
