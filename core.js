export const TYPES = [
  { id: 'all', label: '全部内容', short: '全部', icon: '◈' },
  { id: 'player', label: '棋手图鉴', short: '棋手', icon: '♔' },
  { id: 'hero', label: '棋子图鉴', short: '棋子', icon: '♟' },
  { id: 'equipment', label: '装备图鉴', short: '装备', icon: '⚒' },
  { id: 'talent', label: '天赋图鉴', short: '天赋', icon: '✦' },
  { id: 'playstyle', label: '流派运营', short: '流派', icon: '▧' },
  { id: 'combo', label: '小联动', short: '联动', icon: '⌘' },
];

export function normalize(value) {
  return String(value ?? '').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
}

export function parseRoute(hash = '') {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const type = TYPES.some(item => item.id === params.get('type')) ? params.get('type') : 'all';
  return { type, q: (params.get('q') || '').slice(0, 200), faction: type === 'hero' ? params.get('faction') || '' : '', quality: type === 'hero' && /^[1-5]$/.test(params.get('quality') || '') ? params.get('quality') : '', id: params.get('id') || '' };
}

export function routeHash(route = {}) {
  const params = new URLSearchParams();
  if (route.type && route.type !== 'all') params.set('type', route.type);
  if (route.q) params.set('q', route.q);
  if (route.type === 'hero' && route.faction) params.set('faction', route.faction);
  if (route.type === 'hero' && route.quality) params.set('quality', route.quality);
  if (route.id) params.set('id', route.id);
  return '#' + params.toString();
}

export function searchCatalog(entries, route) {
  const terms = normalize(route.q).split(' ').filter(Boolean);
  return entries.filter(entry => {
    if (route.type !== 'all' && entry.type !== route.type) return false;
    if (route.type === 'hero' && route.faction && entry.faction !== route.faction) return false;
    if (route.type === 'hero' && route.quality && Number(entry.quality) !== Number(route.quality)) return false;
    const haystack = normalize([entry.name, entry.subtitle, entry.summary, entry.body, entry.searchText, ...(entry.tags || [])].join(' '));
    return terms.every(term => haystack.includes(term));
  }).sort((a, b) => {
    if (!terms.length) return 0;
    const score = entry => terms.reduce((sum, term) => sum + (normalize(entry.name) === term ? 100 : normalize(entry.name).includes(term) ? 20 : 0), 0);
    return score(b) - score(a);
  });
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

export function safeExternalUrl(value) {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; } catch { return null; }
}

export function safeImageUrl(value) {
  const url = safeExternalUrl(value);
  return url?.startsWith('https://') ? url : null;
}

export function imageMarkup(entry, className = '') {
  const url = safeImageUrl(entry.image?.thumbnail);
  const glyph = entry.type === 'equipment' ? '器' : entry.type === 'talent' ? '赋' : entry.name.charAt(0);
  return `<span class="entry-media ${url ? 'has-image' : 'no-image'} ${escapeHtml(className)}"><span class="image-fallback" aria-hidden="true">${escapeHtml(glyph)}</span>${url ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(entry.name)}" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : ''}</span>`;
}

export function markdownToHtml(markdown, { resolveLink = () => null, linkText = text => escapeHtml(text) } = {}) {
  function inline(text) {
    const pattern = /\[([^\]]+)\]\(([^\s)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`/g;
    let out = '', last = 0;
    for (const match of text.matchAll(pattern)) {
      out += linkText(text.slice(last, match.index));
      if (match[1] !== undefined) {
        const internal = resolveLink(match[2]);
        const external = safeExternalUrl(match[2]);
        if (internal) out += `<a href="${escapeHtml(internal)}">${escapeHtml(match[1])}</a>`;
        else if (external) out += `<a href="${escapeHtml(external)}" target="_blank" rel="noopener noreferrer">${escapeHtml(match[1])} ↗</a>`;
        else out += escapeHtml(match[1]);
      } else if (match[3] !== undefined) out += `<strong>${linkText(match[3])}</strong>`;
      else out += `<code>${escapeHtml(match[4])}</code>`;
      last = match.index + match[0].length;
    }
    return out + linkText(text.slice(last));
  }
  const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n');
  const output = [];
  let paragraph = [], list = null, code = null;
  const flushParagraph = () => { if (paragraph.length) { output.push(`<p>${inline(paragraph.join(' '))}</p>`); paragraph = []; } };
  const closeList = () => { if (list) { output.push(`</${list}>`); list = null; } };
  const splitCells = line => line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(cell => cell.trim().replace(/\\\|/g, '|'));
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (/^```/.test(line)) {
      flushParagraph(); closeList();
      if (code === null) code = [];
      else { output.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`); code = null; }
      continue;
    }
    if (code !== null) { code.push(line); continue; }
    if (!line.trim()) { flushParagraph(); closeList(); continue; }
    if (/^\s*\|/.test(line) && /^\s*\|?[\s:|-]+\|/.test(lines[index + 1] || '')) {
      flushParagraph(); closeList();
      const headers = splitCells(line);
      const rows = [];
      index += 2;
      while (index < lines.length && /^\s*\|/.test(lines[index])) { rows.push(splitCells(lines[index])); index++; }
      index--;
      output.push(`<div class="table-scroll" tabindex="0" role="region" aria-label="${escapeHtml(headers.join('、'))}"><table><thead><tr>${headers.map(cell => `<th>${inline(cell)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${headers.map((_, cell) => `<td>${inline(row[cell] || '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) { flushParagraph(); closeList(); const level = Math.min(4, Math.max(2, heading[1].length)); output.push(`<h${level}>${inline(heading[2])}</h${level}>`); continue; }
    const item = line.match(/^\s*(?:([-*])\s+|(\d+)\.\s+)(.+)$/);
    if (item) { flushParagraph(); const kind = item[2] ? 'ol' : 'ul'; if (list !== kind) { closeList(); output.push(`<${kind}>`); list = kind; } output.push(`<li>${inline(item[3])}</li>`); continue; }
    if (/^>\s?/.test(line)) { flushParagraph(); closeList(); output.push(`<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>`); continue; }
    if (/^\s*---+\s*$/.test(line)) { flushParagraph(); closeList(); continue; }
    closeList(); paragraph.push(line.trim());
  }
  flushParagraph(); closeList();
  if (code !== null) output.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
  return output.join('\n');
}
