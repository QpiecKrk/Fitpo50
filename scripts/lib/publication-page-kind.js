function hasClass(html, tag, name) {
  return [...String(html).matchAll(new RegExp(`<${tag}\\b[^>]*\\bclass=["']([^"']*)["'][^>]*>`, 'gi'))]
    .some((match) => match[1].split(/\s+/).includes(name));
}

function pageKind(html) {
  if (hasClass(html, 'article', 'article-content')) return 'article';
  if (hasClass(html, 'div', 'hub-shell') && /<main\b/i.test(html) && /<h1\b[^>]*\bid=["']hub-title["']/i.test(html)) return 'topic_center';
  return 'unsupported';
}

module.exports = { pageKind };
