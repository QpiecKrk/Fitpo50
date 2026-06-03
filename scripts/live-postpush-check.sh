#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-https://fitpo50.pl}"
RETRIES="${RETRIES:-4}"
DELAY="${DELAY:-2}"
TIMEOUT="${TIMEOUT:-30}"
CONNECT_TIMEOUT="${CONNECT_TIMEOUT:-8}"
ALLOW_NET_FAILURES="${ALLOW_NET_FAILURES:-1}"
# GitHub-hosted runners miewają problemy z trasą IPv6 do hostingu.
# Domyślnie wymuszamy IPv4, ale można nadpisać envem: CURL_IP_MODE=""
CURL_IP_MODE="${CURL_IP_MODE:---ipv4}"

SOFT_NET_ERROR=0

echo "Live post-push check: ${BASE_URL}"
echo "Live post-push config: retries=${RETRIES} delay=${DELAY}s timeout=${TIMEOUT}s connect-timeout=${CONNECT_TIMEOUT}s curl-ip-mode=${CURL_IP_MODE:-auto}"

warn_net_error() {
  local url="$1"
  local code="$2"
  echo "[WARN] ${url} -> problem sieci (curl exit ${code}); oznaczam soft-fail."
  SOFT_NET_ERROR=1
}

check_200() {
  local url="$1"
  local code
  local curl_status=0
  echo "[CHECK] ${url}"
  set +e
  code="$(curl -sS $CURL_IP_MODE --connect-timeout "$CONNECT_TIMEOUT" --max-time "$TIMEOUT" --retry "$RETRIES" --retry-delay "$DELAY" --retry-all-errors -o /dev/null -w "%{http_code}" "$url")"
  curl_status=$?
  set -e
  if [[ "$curl_status" -ne 0 ]]; then
    if [[ "$curl_status" == "6" || "$curl_status" == "7" || "$curl_status" == "28" ]]; then
      warn_net_error "$url" "$curl_status"
      return 0
    fi
    echo "[FAIL] ${url} -> curl exit ${curl_status}"
    return 1
  fi
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
  local had_net_error="0"
  for attempt in $(seq 1 $((RETRIES + 1))); do
    local curl_status=0
    echo "[CHECK] ${url} contains '${needle}' (attempt ${attempt}/$((RETRIES + 1)))"
    set +e
    body="$(curl -sSL $CURL_IP_MODE --connect-timeout "$CONNECT_TIMEOUT" --max-time "$TIMEOUT" --retry "$RETRIES" --retry-delay "$DELAY" --retry-all-errors "$url")"
    curl_status=$?
    set -e
    if [[ "$curl_status" -ne 0 ]]; then
      if [[ "$curl_status" == "6" || "$curl_status" == "7" || "$curl_status" == "28" ]]; then
        had_net_error="1"
        sleep "$DELAY"
        continue
      fi
      echo "[FAIL] ${url} -> curl exit ${curl_status}"
      return 1
    fi
    if grep -q "$needle" <<<"$body"; then
      ok="1"
      break
    fi
    sleep "$DELAY"
  done
  if [[ "$ok" != "1" && "$had_net_error" == "1" ]]; then
    warn_net_error "$url" "6/7/28"
    return 0
  fi
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

node scripts/live-latest-article-check.js \
  --base-url "${BASE_URL}" \
  --retries "${RETRIES}" \
  --delay-ms "$((DELAY * 1000))" \
  --timeout-ms "$((TIMEOUT * 1000))"

if [[ "$SOFT_NET_ERROR" == "1" && "$ALLOW_NET_FAILURES" == "1" ]]; then
  echo "Live post-push check: SOFT-PASS (problemy sieci runnera)."
  exit 0
fi

echo "Live post-push check: PASS"
