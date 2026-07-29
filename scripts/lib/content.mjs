import path from 'node:path';

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const parseScalar = (value) => {
  const text = value.trim();
  if (text.startsWith('[') && text.endsWith(']')) {
    return text.slice(1, -1).split(',').map((item) => item.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
  }
  if (text === 'true' || text === 'false') return text === 'true';
  if (/^\d+$/.test(text)) return Number(text);
  return text.replace(/^['"]|['"]$/g, '');
};

export function parseMarkdownDocument(source, filePath = '') {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) throw new Error(`${filePath || 'Markdown document'} is missing YAML frontmatter`);
  const metadata = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const separator = line.indexOf(':');
    if (separator < 1) throw new Error(`Invalid frontmatter line in ${filePath}: ${line}`);
    metadata[line.slice(0, separator).trim()] = parseScalar(line.slice(separator + 1));
  }
  // Normalize authoring-platform line endings so generated JSON is stable on
  // Windows and Linux builds.
  return { metadata, body: match[2].replace(/\r\n?/g, '\n').trim() };
}

function renderInline(source) {
  let text = escapeHtml(source);
  text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g, (_all, alt, url, title) => {
    const safeUrl = /^(?:https?:\/\/|\/)/.test(url) ? url : '#';
    return `<img src="${safeUrl}" alt="${alt}"${title ? ` title="${title}"` : ''} loading="lazy">`;
  });
  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_all, label, url) => {
    const safeUrl = /^(?:https?:\/\/|\/|#)/.test(url) ? url : '#';
    const external = /^https?:\/\//.test(safeUrl) ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `<a href="${safeUrl}"${external}>${label}</a>`;
  });
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return text;
}

function isTableDivider(line) {
  return /^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?\s*$/.test(line);
}

function cells(line) {
  return line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());
}

export function renderMarkdown(markdown) {
  const lines = markdown.replace(/\r/g, '').split('\n');
  const html = [];
  let paragraph = [];
  let list = null;

  const flushParagraph = () => {
    if (paragraph.length) html.push(`<p>${renderInline(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const closeList = () => {
    if (list) html.push(`</${list}>`);
    list = null;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed) { flushParagraph(); closeList(); continue; }
    if (/^---+$/.test(trimmed)) { flushParagraph(); closeList(); html.push('<hr>'); continue; }
    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading) { flushParagraph(); closeList(); const level = heading[1].length; html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`); continue; }
    if (trimmed.startsWith('> ')) { flushParagraph(); closeList(); html.push(`<blockquote><p>${renderInline(trimmed.slice(2))}</p></blockquote>`); continue; }
    if (trimmed.includes('|') && lines[index + 1] && isTableDivider(lines[index + 1])) {
      flushParagraph(); closeList();
      const headers = cells(trimmed);
      const rows = [];
      index += 2;
      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) { rows.push(cells(lines[index])); index += 1; }
      index -= 1;
      html.push(`<div class="article-table-wrap"><table><thead><tr>${headers.map((cell) => `<th>${renderInline(cell)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${renderInline(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    const unordered = trimmed.match(/^[-*]\s+(.+)$/);
    const ordered = trimmed.match(/^\d+\.\s+(.+)$/);
    if (unordered || ordered) {
      flushParagraph();
      const kind = ordered ? 'ol' : 'ul';
      if (list !== kind) { closeList(); html.push(`<${kind}>`); list = kind; }
      html.push(`<li>${renderInline((ordered || unordered)[1])}</li>`);
      continue;
    }
    closeList();
    paragraph.push(trimmed);
  }
  flushParagraph(); closeList();
  return html.join('\n');
}

export function validatePost(metadata, filePath) {
  const required = ['slug', 'title', 'excerpt', 'publishDate', 'status', 'author', 'tags'];
  for (const key of required) if (!metadata[key]) throw new Error(`${filePath}: missing ${key}`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(metadata.slug)) throw new Error(`${filePath}: invalid slug`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(metadata.publishDate)) throw new Error(`${filePath}: invalid publishDate`);
  if (metadata.updatedDate && !/^\d{4}-\d{2}-\d{2}$/.test(metadata.updatedDate)) throw new Error(`${filePath}: invalid updatedDate`);
  if (!['draft', 'published', 'archived'].includes(metadata.status)) throw new Error(`${filePath}: invalid status`);
  if (!Array.isArray(metadata.tags)) throw new Error(`${filePath}: tags must be an array`);
}

export function postFromDocument(document, filePath) {
  validatePost(document.metadata, filePath);
  const words = document.body.split(/\s+/).filter(Boolean).length;
  // The page template owns the single document-level heading. Authors may keep
  // a Markdown H1 for readability; it is removed from the rendered article body.
  const articleBody = document.body.replace(/(^|\n)#\s+[^\n]+(?:\n|$)/, '$1').trim();
  return {
    id: document.metadata.slug,
    ...document.metadata,
    imageUrl: document.metadata.imageUrl || undefined,
    readTimeMinutes: document.metadata.readTimeMinutes || Math.max(1, Math.ceil(words / 225)),
    content: articleBody,
    html: renderMarkdown(articleBody),
    sourceFile: path.basename(filePath),
  };
}

export { escapeHtml };
