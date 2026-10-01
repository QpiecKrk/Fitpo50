'use strict';

const https = require('https');
const { STATUS, hashUrlList, redactSecrets } = require('./external-integration-status');

const ENDPOINT = 'https://api.indexnow.org/indexnow';

function baseEvidence(urlList) {
  const urls = (Array.isArray(urlList) ? urlList : []).map((url) => String(url || '').trim()).filter(Boolean);
  return {
    integration: 'INDEXNOW',
    attempted_at: new Date().toISOString(),
    operation: 'SUBMIT_URLS',
    endpoint: ENDPOINT,
    url_count: urls.length,
    url_list_sha256: hashUrlList(urls),
    http_status: null,
    response_valid: false,
  };
}

function submitIndexNow({ host, key, keyLocation, urlList, enabled = true, request = https.request }) {
  const evidence = baseEvidence(urlList);
  if (!enabled) return Promise.resolve({ ...evidence, status: STATUS.SKIPPED_EXPLICITLY, reason: 'DISABLED_BY_CALLER' });
  if (!String(key || '').trim()) return Promise.resolve({ ...evidence, status: STATUS.MISSING_CONFIG, reason: 'INDEXNOW_KEY_MISSING' });
  if (!String(host || '').trim() || evidence.url_count === 0) {
    return Promise.resolve({ ...evidence, status: STATUS.DATA_INVALID, reason: 'REQUEST_INPUT_INVALID' });
  }

  const payload = JSON.stringify({ host, key, keyLocation, urlList });
  return new Promise((resolve) => {
    const req = request(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      timeout: 5000,
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const httpStatus = Number(res.statusCode || 0) || null;
        const accepted = httpStatus === 200 || httpStatus === 202;
        resolve({
          ...evidence,
          status: accepted ? STATUS.OK_VERIFIED : STATUS.REQUEST_FAILED,
          reason: accepted ? 'INDEXNOW_ACCEPTED' : 'INDEXNOW_HTTP_REJECTED',
          http_status: httpStatus,
          response_valid: accepted,
        });
      });
    });
    req.on('error', (err) => resolve({
      ...evidence,
      status: STATUS.REQUEST_FAILED,
      reason: 'INDEXNOW_NETWORK_ERROR',
      error: redactSecrets(err.message || String(err), [key]),
    }));
    req.on('timeout', () => {
      req.destroy(new Error('timeout'));
      resolve({ ...evidence, status: STATUS.REQUEST_FAILED, reason: 'INDEXNOW_TIMEOUT' });
    });
    req.write(payload);
    req.end();
  });
}

module.exports = { ENDPOINT, baseEvidence, submitIndexNow };
