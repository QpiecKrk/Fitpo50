#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-https://fitpo50.pl}"
RETRIES="${RETRIES:-4}"
DELAY="${DELAY:-2}"
TIMEOUT="${TIMEOUT:-30}"
# GitHub-hosted runners miewają problemy z trasą IPv6 do hostingu.
# Domyślnie wymuszamy IPv4, ale można nadpisać envem: CURL_IP_MODE=""
CURL_IP_MODE="${CURL_IP_MODE:---ipv4}"

echo "Live post-push check: ${BASE_URL}"

check_200() {
  local url="$1"
  local code
  code="$(curl -sS $CURL_IP_MODE --max-time "$TIMEOUT" --retry "$RETRIES" --retry-delay "$DELAY" --retry-all-errors -o /dev/null -w "%{http_code}" "$url")"
  if [[ "$code" != "200" ]]; then
    echo "[FAIL] ${url} -> HTTP ${code}"
    return 1
  fi
  echo "[PASS] ${url} -> 200"
}

check_contains() {
  local url="$1"
  local needle="$2"
  local ok="0"
  local attempt
  local body
  for attempt in $(seq 1 $((RETRIES + 1))); do
    body="$(curl -sSL $CURL_IP_MODE --max-time "$TIMEOUT" --retry "$RETRIES" --retry-delay "$DELAY" --retry-all-errors "$url" || true)"
    if grep -q "$needle" <<<"$body"; then
      ok="1"
      break
    fi
    sleep "$DELAY"
  done
  if [[ "$ok" != "1" ]]; then
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
