#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-https://fitpo50.pl}"

echo "Live post-push check: ${BASE_URL}"

check_200() {
  local url="$1"
  local code
  code="$(curl -s -o /dev/null -w "%{http_code}" "$url")"
  if [[ "$code" != "200" ]]; then
    echo "[FAIL] ${url} -> HTTP ${code}"
    return 1
  fi
  echo "[PASS] ${url} -> 200"
}

check_contains() {
  local url="$1"
  local needle="$2"
  if ! curl -sL "$url" | grep -q "$needle"; then
    echo "[FAIL] ${url} -> brak wzorca: ${needle}"
    return 1
  fi
  echo "[PASS] ${url} -> znaleziono: ${needle}"
}

check_200 "${BASE_URL}/"
check_200 "${BASE_URL}/porady.html"
check_200 "${BASE_URL}/sitemap.xml"
check_200 "${BASE_URL}/llms.txt"
check_200 "${BASE_URL}/ads.txt"

check_contains "${BASE_URL}/ads.txt" "google.com, pub-4993821807276758, DIRECT"
check_contains "${BASE_URL}/sitemap.xml" "https://fitpo50.pl/"
check_contains "${BASE_URL}/porady.html" "data-article-item"

echo "Live post-push check: PASS"

