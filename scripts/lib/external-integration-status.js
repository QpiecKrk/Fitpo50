'use strict';

const crypto = require('crypto');

const STATUS = Object.freeze({
  OK_VERIFIED: 'OK_VERIFIED',
  MISSING_CONFIG: 'MISSING_CONFIG',
  AUTH_FAILED: 'AUTH_FAILED',
  REQUEST_FAILED: 'REQUEST_FAILED',
  DATA_INVALID: 'DATA_INVALID',
  SKIPPED_EXPLICITLY: 'SKIPPED_EXPLICITLY',
});

function redactSecrets(value, secrets = []) {
  let output = String(value || '');
  const candidates = [
    ...secrets,
    process.env.GSC_OAUTH_CLIENT_SECRET,
    process.env.GSC_OAUTH_REFRESH_TOKEN,
    process.env.INDEXNOW_KEY,
  ].map((item) => String(item || '').trim()).filter((item) => item.length >= 6);
  for (const secret of [...new Set(candidates)]) {
    output = output.split(secret).join('[REDACTED]');
  }
  output = output.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]');
  output = output.replace(/("?(?:access_token|refresh_token|client_secret|private_key|key)"?\s*[:=]\s*["']?)[^\s,"'}]+/gi, '$1[REDACTED]');
  return output;
}

function classifyExternalError(error, context = {}) {
  const message = redactSecrets(error && error.message ? error.message : error, context.secrets);
  const normalized = message.toLowerCase();
  let status = STATUS.REQUEST_FAILED;
  let reason = 'EXTERNAL_REQUEST_FAILED';

  if (/invalid_client|unauthorized_client|client secret|oauth.*credential/.test(normalized)) {
    status = STATUS.AUTH_FAILED;
    reason = 'OAUTH_CLIENT_INVALID';
  } else if (/invalid_grant|refresh token|token has been expired|token has been revoked/.test(normalized)) {
    status = STATUS.AUTH_FAILED;
    reason = 'OAUTH_REFRESH_TOKEN_INVALID';
  } else if (/private[_ ]key|client_email|service account json|pem routines|decoder routines/.test(normalized)) {
    status = STATUS.AUTH_FAILED;
    reason = 'SERVICE_ACCOUNT_KEY_INVALID';
  } else if (/permission|insufficient permission|forbidden|does not have access|not found in search console/.test(normalized)) {
    status = STATUS.AUTH_FAILED;
    reason = context.authMode === 'service_account'
      ? 'SERVICE_ACCOUNT_PROPERTY_ACCESS_DENIED'
      : 'PROPERTY_ACCESS_DENIED';
  } else if (/401|unauthenticated|invalid credential/.test(normalized)) {
    status = STATUS.AUTH_FAILED;
    reason = 'CREDENTIAL_REJECTED';
  } else if (/unexpected payload|invalid data|malformed|json parse|schema|contract/.test(normalized)) {
    status = STATUS.DATA_INVALID;
    reason = 'RESPONSE_DATA_INVALID';
  }

  return { status, reason, message };
}

function hashUrlList(urlList) {
  const canonical = (Array.isArray(urlList) ? urlList : [])
    .map((url) => String(url || '').trim())
    .filter(Boolean)
    .sort()
    .join('\n');
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

module.exports = { STATUS, classifyExternalError, hashUrlList, redactSecrets };
