export const TYPES = [
  { id: 'all', label: '全部内容', short: '全部', icon: '◈' },
  { id: 'playstyle', label: '流派一图流', short: '流派', icon: '▧' },
  { id: 'combo', label: '联动图解', short: '联动', icon: '⌘' },
  { id: 'artifact', label: '神器怎么选', short: '神器', icon: '◆' },
  { id: 'player', label: '棋手图鉴', short: '棋手', icon: '♔' },
  { id: 'hero', label: '棋子图鉴', short: '棋子', icon: '♟' },
  { id: 'equipment', label: '装备图鉴', short: '装备', icon: '⚒' },
  { id: 'talent', label: '天赋图鉴', short: '天赋', icon: '✦' },
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
    if (route.type === 'artifact' ? !entry.fit : route.type !== 'all' && entry.type !== route.type) return false;
    if (route.type === 'hero' && route.faction && entry.faction !== route.faction) return false;
    if (route.type === 'hero' && route.quality && Number(entry.quality) !== Number(route.quality)) return false;
    const haystack = normalize([entry.name, entry.subtitle, entry.summary, entry.body, entry.searchText, ...(entry.tags || [])].join(' '));
    return terms.every(term => haystack.includes(term));
  }).sort((a, b) => {
    if (route.type === 'artifact' && terms.length) {
      const rank = entry => Math.min(9, ...(entry.fit?.playstyles || []).filter(style => terms.every(term => normalize(style.name).includes(term))).map(style => ({'先补':0,'成型后选':1,'配套再选':2}[style.priority] ?? 9)));
      const difference = rank(a) - rank(b);
      if (difference) return difference;
    }
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

export function quickGuideMarkup(entry, { lookup, href }) {
  const guide = entry.quick;
  if (!guide) return '';
  const tile = (item, index) => {
    const target = lookup(item.entryId);
    if (!target) return '';
    return `<a class="quick-person${index === 0 ? ' is-core' : ''}" href="${escapeHtml(href(target.id))}" data-entry="${escapeHtml(target.id)}">${imageMarkup(target)}<strong>${escapeHtml(target.name)}</strong><span>${escapeHtml(item.role || item.why)}</span></a>`;
  };
  const choices = (title, items) => items.length ? `<section class="quick-choice"><h2>${title}<small>按来牌选择</small></h2><div class="quick-items">${items.map((item) => tile(item, -1)).join('')}</div></section>` : '';
  const plan = guide.roundPlan;
  const steps = guide.stages || guide.steps || [];
  const lordCards = plan ? `<section class="quick-lords"><h2>推荐棋手<small>主线与替代分开看</small></h2><div class="lord-options">${plan.lords.map((lord, index) => `<div class="lord-option">${tile({...lord, role: lord.reason}, index)}<p>${escapeHtml(lord.route_note)}</p></div>`).join('')}</div></section>` : '';
  const timeline = plan ? `<div class="round-route"><strong>${escapeHtml(plan.route_name.includes(plan.route_lord) ? plan.route_name : plan.route_lord + ' · ' + plan.route_name)}</strong><p>${escapeHtml(guide.guideStatus || "社区推演参考")} · ${escapeHtml(plan.source_date)}。缺钱或血量吃紧先保战力。</p></div><ol class="round-timeline">${plan.stages.map((stage, index) => `<li><span class="round-range"><small class="round-phase">${escapeHtml(stage.phase || ["前期","过渡","中期","中后期","后期"][index])}</small>${escapeHtml(stage.rounds)}</span><div class="round-content"><h3>${escapeHtml(stage.goal)}</h3><p>${escapeHtml(stage.action)}</p><p class="round-economy"><strong>经济 / 升级</strong>${escapeHtml(stage.economy)}</p><div class="round-picks">${stage.picks.map(pick => { const target = lookup(pick.entryId); return `<a href="${escapeHtml(href(target.id))}" data-entry="${escapeHtml(target.id)}">${imageMarkup(target)}<span>${escapeHtml(target.name)}</span></a>`; }).join('')}</div>${stage.fallback ? `<details class="round-fallback"><summary>缺牌时怎么办</summary><p>${escapeHtml(stage.fallback)}</p></details>` : ''}</div></li>`).join('')}</ol><p class="round-warning">${escapeHtml(plan.warning)}</p><details class="round-sources"><summary>查看回合路线来源与日期</summary><p>${escapeHtml(plan.source_note || "来源标注日期："+plan.source_date+"；旧攻略已按已知规则修正，回合节奏尚待实战。")}</p>${plan.sources.map(source => `<a href="${escapeHtml(safeExternalUrl(source.url) || '#')}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.label)} ↗</a>`).join('')}</details>` : '';

  const construction = guide.lineup ? `<details class="round-sources"><summary>完整七人构筑与分工</summary><div class="quick-lineup">${guide.lineup.map((item) => tile(item,-1)).join('')}</div></details><section class="quick-operations"><h2>效果牌怎么打</h2><div class="quick-decisions">${guide.actions.map(item => `<p><strong>${escapeHtml(item.name)}</strong>${escapeHtml(item.why)}</p>`).join('')}</div><p class="round-warning">觉醒参考：${guide.awakening.map(escapeHtml).join(' → ')}</p></section>` : '';
  return `<section class="quick-guide" aria-label="${escapeHtml(guide.title)}一图流">${lordCards}<section class="quick-cores"><h2><span>01</span> 核心看这里<small>点头像查规则</small></h2><div class="quick-lineup">${guide.core.map(tile).join('')}</div></section><div class="quick-engine" aria-label="配合关系">${guide.engine.map((text, index) => `${index ? '<b aria-hidden="true">→</b>' : ''}<span>${escapeHtml(text)}</span>`).join('')}</div><section class="quick-operations"><h2><span>02</span> ${plan ? '按回合做什么' : guide.stages ? '分阶段运营' : '照这个顺序打'}</h2>${timeline}${plan ? '' : `<ol class="quick-stages">${steps.map((step, index) => `<li><div class="step-number">${index + 1}</div><div><span class="step-phase">${escapeHtml(step.phase || '操作 ' + (index + 1))}</span><h3>${escapeHtml(step.title)}</h3><p>${escapeHtml(step.action)}</p></div></li>`).join('')}</ol>`}</section>${construction}${guide.equipment.length || guide.talents.length ? `<div class="quick-loadout">${choices('装备方向',guide.equipment)}${choices('天赋可选',guide.talents)}</div>` : ''}<div class="quick-decisions"><p><strong>站位</strong>${escapeHtml(guide.positioning)}</p>${guide.pivot ? `<p><strong>缺牌 / 转型</strong>${escapeHtml(guide.pivot)}</p>` : ''}</div><aside class="quick-caution"><span aria-hidden="true">!</span><p><strong>记住这个坑</strong>${escapeHtml(guide.caution)}</p></aside><footer class="quick-footnote">规则参考 v1.6.1 · 核对至 2026.10.15 · 玩法待实战</footer></section>`;
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
