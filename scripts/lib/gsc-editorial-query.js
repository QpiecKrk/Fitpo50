const MIN_CTR_REVIEW_IMPRESSIONS = 30;

function isEditorialQuery(query) {
  const value = String(query || '').trim();
  if (!value) return false;
  // Search operators change the result set. Their rankings cannot stand in for
  // the unqualified question a reader would normally ask.
  if (/(^|\s)-?site\s*:/i.test(value)) return false;
  if (/(^|\s)(?:inurl|intitle|allintitle|filetype|cache|related)\s*:/i.test(value)) return false;
  return true;
}

module.exports = { isEditorialQuery, MIN_CTR_REVIEW_IMPRESSIONS };
