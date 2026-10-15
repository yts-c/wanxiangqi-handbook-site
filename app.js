import { TYPES, parseRoute, routeHash, searchCatalog, escapeHtml, safeExternalUrl, markdownToHtml, imageMarkup } from './core.js';

const $ = selector => document.querySelector(selector);
let catalog = null, route = parseRoute(location.hash), visibleCount = 24, activeId = '', restoreFocus = null;
const typeInfo = type => TYPES.find(item => item.id === type) || TYPES[0];
const entryMap = new Map();
const counts = new Map();

function navigate(changes, replace = false) {
  if (changes.id && !$('#detail').open) restoreFocus = document.activeElement;
  route = { ...route, ...changes };
  if (route.type !== 'hero') { route.faction = ''; route.quality = ''; }
  const hash = routeHash(route);
  if (replace) history.replaceState(null, '', hash);
  else if (hash !== location.hash) history.pushState(null, '', hash);
  render();
}

function detailLink(id) { return routeHash({ ...route, id }); }

function paintNavigation() {
  $('#side-nav').innerHTML = TYPES.map(type => `<a class="nav-item${route.type === type.id ? ' active' : ''}" href="${escapeHtml(routeHash({ ...route, type: type.id, faction: '', quality: '', id: '' }))}" data-type="${type.id}" ${route.type === type.id ? 'aria-current="page"' : ''}><span class="nav-icon" aria-hidden="true">${type.icon}</span><span>${type.label}</span><span class="nav-count">${counts.get(type.id) || 0}</span></a>`).join('');
  $('#type-tabs').innerHTML = TYPES.map(type => `<button type="button" class="type-tab${route.type === type.id ? ' active' : ''}" data-type="${type.id}" aria-pressed="${route.type === type.id}">${type.short}<span class="tab-count">${counts.get(type.id) || 0}</span></button>`).join('');
  $('#breadcrumb-current').textContent = typeInfo(route.type).label;
}

function card(entry) {
  const info = typeInfo(entry.type);
  const glyph = entry.type === 'equipment' ? '器' : entry.type === 'combo' ? '联' : entry.type === 'playstyle' ? '阵' : entry.name.charAt(0);
  const subtitle = entry.subtitle || [entry.faction, entry.quality ? `${entry.quality}阶` : '', info.short].filter(Boolean).join(' · ');
  const visual = entry.image ? imageMarkup(entry) : ['combo','playstyle'].includes(entry.type) ? `<span class="entry-avatar" aria-hidden="true">${escapeHtml(glyph)}</span>` : imageMarkup(entry);
  const portraits = ['combo','playstyle'].includes(entry.type) ? (entry.related || []).map(id=>entryMap.get(id)).filter(other=>other?.type==='hero' && other.image).slice(0,5) : [];
  return `<article class="entry-card" data-type="${entry.type}"><div class="card-top">${visual}<div><h3 class="card-title"><a href="${escapeHtml(detailLink(entry.id))}" data-entry="${escapeHtml(entry.id)}">${escapeHtml(entry.name)}</a></h3><div class="card-subtitle">${escapeHtml(subtitle)}</div></div><span class="card-arrow" aria-hidden="true">↗</span></div><p class="card-summary">${escapeHtml(entry.summary || '查看完整规则、来源与使用条件。')}</p>${portraits.length?`<div class="portrait-strip" aria-label="相关棋子">${portraits.map(other=>imageMarkup(other,'strip-image')).join('')}</div>`:''}<div class="card-bottom">${(entry.tags || []).slice(0, 2).map(tag => `<span class="card-tag">${escapeHtml(tag)}</span>`).join('')}<span class="card-kind">${info.short} / 速查</span></div></article>`;
}

function resolveLocalLink(url) {
  if (url.includes('combos.md#')) {
    const title = decodeURIComponent(url.split('#')[1]);
    const match = catalog.entries.find(entry => entry.type === 'combo' && (entry.name === title || entry.name.replace(/\s/g, '') === title));
    if (match) return detailLink(match.id);
  }
  if (url.includes('playstyles-growth.md')) return routeHash({ type: 'playstyle', q: '', id: '' });
  if (url.includes('playstyles-combat.md') || url.includes('playstyles.md')) return routeHash({ type: 'playstyle', id: '' });
  if (url.includes('combos.md')) return routeHash({ type: 'combo', id: '' });
  if (url.includes('handbook.md')) return '#';
  return null;
}

function linkBodyText(text, entry) {
  const related = (entry.related || []).map(id => entryMap.get(id)).filter(other => other && other.name.length >= 2 && other.type !== 'combo' && other.type !== 'playstyle').sort((a, b) => b.name.length - a.name.length);
  const unique = [...new Map(related.map(item => [item.name, item])).values()];
  if (!unique.length) return escapeHtml(text);
  const pattern = new RegExp(unique.map(item => item.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
  let result = '', last = 0;
  for (const match of text.matchAll(pattern)) {
    const other = unique.find(item => item.name === match[0]);
    result += escapeHtml(text.slice(last, match.index));
    result += `<a href="${escapeHtml(detailLink(other.id))}" data-entry="${escapeHtml(other.id)}">${escapeHtml(match[0])}</a>`;
    last = match.index + match[0].length;
  }
  return result + escapeHtml(text.slice(last));
}

function renderDetail() {
  const dialog = $('#detail');
  if (!route.id) {
    activeId = '';
    if (dialog.open) dialog.close();
    document.body.style.overflow = '';
    return;
  }
  if (activeId === route.id && dialog.open) return;
  const entry = entryMap.get(route.id);
  activeId = route.id;
  if (!dialog.open) {
    dialog.showModal();
    document.body.style.overflow = 'hidden';
  }
  if (!entry) {
    $('#detail-article').innerHTML = '<div class="not-found"><h1 id="detail-title" class="detail-heading">未找到这个条目</h1><p>这条链接对应的资料可能已更新，可以返回目录按名称搜索。</p></div>';
    document.title = '未找到条目 · 万象棋手册';
    return;
  }
  const sources = (entry.sources || []).filter(source => safeExternalUrl(source.url));
  const related = (entry.related || []).map(id => entryMap.get(id)).filter(Boolean);
  $('#detail-article').innerHTML = `<div class="detail-category">${typeInfo(entry.type).label} / FIELD GUIDE</div><h1 id="detail-title" class="detail-heading">${escapeHtml(entry.name)}</h1><p class="detail-subtitle">${escapeHtml(entry.subtitle || typeInfo(entry.type).label)}</p><div class="detail-version"><span>规则参考 ${escapeHtml(catalog.meta.version)}</span><span>资料核对 ${escapeHtml(catalog.meta.updatedAt)}</span><span>待实战与独立试读</span></div><div class="reader">${markdownToHtml(entry.body, { resolveLink: resolveLocalLink, linkText: text => linkBodyText(text, entry) })}</div>${entry.gaps?.length ? `<section class="detail-supplement"><h3>使用前，留意这些待核条件</h3><div class="gap-list"><ul>${entry.gaps.map(gap => `<li>${escapeHtml(gap)}</li>`).join('')}</ul></div></section>` : ''}${related.length ? `<section class="detail-supplement"><h3>顺着这条关系继续查</h3><div class="related-list">${related.map(other => `<a class="related-link" href="${escapeHtml(detailLink(other.id))}" data-entry="${escapeHtml(other.id)}">${escapeHtml(other.name)} <span aria-hidden="true">↗</span></a>`).join('')}</div><p class="source-note">相关条目来自正文提及的名称，配队仍需满足各自条件。</p></section>` : ''}${sources.length ? `<section class="detail-supplement"><h3>规则与玩法来源</h3><ul class="source-list">${sources.map(source => `<li><a href="${escapeHtml(safeExternalUrl(source.url))}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.label || '查看原文')} ↗</a></li>`).join('')}</ul></section>` : ''}`;
  const heading = $('#detail-title');
  if (entry.image) {
    const media = document.createElement('div');
    media.className = 'detail-image-block';
    media.innerHTML = imageMarkup(entry,'detail-image');
    heading.before(media);
  }
  const visualRelated = related.filter(other => other.image).slice(0,16);
  if (visualRelated.length) {
    const gallery = document.createElement('section');
    gallery.className='detail-gallery';
    gallery.innerHTML=`<h2>图中找配合</h2><div class="visual-related">${visualRelated.map(other=>`<a href="${escapeHtml(detailLink(other.id))}" data-entry="${escapeHtml(other.id)}">${imageMarkup(other,'related-image')}<span>${escapeHtml(other.name)}</span><small>${typeInfo(other.type).short}</small></a>`).join('')}</div>`;
    $('#detail-article .reader').before(gallery);
  }
  if(entry.image?.source) {
    const url=safeExternalUrl(entry.image.source);
    if(url){const credit=document.createElement('p');credit.className='image-credit';credit.innerHTML=`图片来源：<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">查看素材出处 ↗</a> · 图片仅供识别，规则以文字与公告为准。`;$('#detail-article').append(credit);}
  }
  dialog.scrollTop = 0;
  $('#detail-close').focus({ preventScroll: true });
  document.title = `${entry.name} · 万象棋手册`;
}

function render() {
  if (!catalog) return;
  paintNavigation();
  if ($('#search').value !== route.q) $('#search').value = route.q;
  $('#faction').value = route.faction;
  $('#quality').value = route.quality;
  $('#hero-filters').hidden = route.type !== 'hero';
  $('#reset').hidden = !route.q && !route.faction && !route.quality;
  $('#intro').classList.toggle('compact', Boolean(route.q || route.type !== 'all' || route.faction || route.quality));
  const results = searchCatalog(catalog.entries, route);
  const shown = results.slice(0, visibleCount);
  $('#results').innerHTML = shown.map(card).join('');
  $('#result-status').textContent = `找到 ${results.length} 条内容${shown.length < results.length ? ` · 已展示 ${shown.length} 条` : ''}${route.q ? ` · “${route.q}”` : ''}`;
  $('#empty').hidden = Boolean(results.length);
  $('#load-more').hidden = shown.length >= results.length;
  if (!route.id) document.title = `${route.q ? route.q + ' · ' : ''}${route.type === 'all' ? '万象棋手册 · 每一手都有思路' : typeInfo(route.type).label + ' · 万象棋手册'}`;
  renderDetail();
}

async function loadCatalog() {
  $('#load-error').hidden = true;
  try {
    const response = await fetch('./catalog.json');
    if (!response.ok) throw new Error('无法加载资料');
    const data = await response.json();
    if (!Array.isArray(data.entries) || !data.meta?.version) throw new Error('资料格式错误');
    catalog = data;
    entryMap.clear(); counts.clear();
    catalog.entries.forEach(entry => entryMap.set(entry.id, entry));
    for (const type of TYPES) counts.set(type.id, type.id === 'all' ? catalog.entries.length : catalog.entries.filter(entry => entry.type === type.id).length);
    $('#catalog-total').textContent = `${catalog.entries.length} 条可查资料`;
    $('#faction').innerHTML = '<option value="">全部阵营</option>' + [...new Set(catalog.entries.filter(entry => entry.type === 'hero').map(entry => entry.faction).filter(Boolean))].map(faction => `<option value="${escapeHtml(faction)}">${escapeHtml(faction)}</option>`).join('');
    render();
  } catch {
    $('#load-error').hidden = false;
    $('#result-status').textContent = '加载未完成';
  }
}

document.addEventListener('click', event => {
  const entry = event.target.closest('a[data-entry]');
  if (entry && !event.metaKey && !event.ctrlKey && !event.shiftKey && event.button === 0) { event.preventDefault(); navigate({ id: entry.dataset.entry }); return; }
  const type = event.target.closest('[data-type]');
  if (type && (type.matches('a.nav-item') || type.matches('button.type-tab'))) {
    event.preventDefault(); visibleCount = 24; navigate({ type: type.dataset.type, faction: '', quality: '', id: '' }); return;
  }
  const query = event.target.closest('[data-query]');
  if (query) { visibleCount = 24; navigate({ q: query.dataset.query, id: '' }); }
  const local = event.target.closest('a[href^="#"]');
  if (local && $('#detail').contains(local) && !local.dataset.entry) {
    event.preventDefault(); route = parseRoute(local.getAttribute('href')); history.pushState(null, '', routeHash(route)); visibleCount = 24; render();
  }
});
$('#search-form').addEventListener('submit', event => event.preventDefault());
$('#search').addEventListener('input', event => { if (event.isComposing) return; visibleCount = 24; navigate({ q: event.target.value, id: '' }, true); });
$('#search').addEventListener('compositionend', event => { visibleCount = 24; navigate({ q: event.target.value, id: '' }, true); });
$('#faction').addEventListener('change', event => { visibleCount = 24; navigate({ faction: event.target.value, id: '' }); });
$('#quality').addEventListener('change', event => { visibleCount = 24; navigate({ quality: event.target.value, id: '' }); });
$('#reset').addEventListener('click', () => { visibleCount = 24; navigate({ q: '', faction: '', quality: '', id: '' }); });
$('#empty-reset').addEventListener('click', () => { visibleCount = 24; navigate({ type: 'all', q: '', faction: '', quality: '', id: '' }); });
$('#load-more').addEventListener('click', () => { visibleCount += 24; render(); });
function closeDetail() {
  const originalEntryId = restoreFocus?.dataset?.entry;
  navigate({ id: '' });
  const originalLink = [...$('#results').querySelectorAll('a[data-entry]')].find(link => link.dataset.entry === originalEntryId);
  (originalLink || $('#search')).focus({ preventScroll: true });
}
$('#detail-close').addEventListener('click', closeDetail);
$('#detail-back').addEventListener('click', closeDetail);
$('#detail').addEventListener('cancel', event => { event.preventDefault(); closeDetail(); });
$('#detail').addEventListener('click', event => { if (event.target === $('#detail')) { const rect = event.target.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDetail(); } });
$('#retry').addEventListener('click', loadCatalog);
document.addEventListener('keydown', event => { if (event.key === '/' && !$('#detail').open && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) { event.preventDefault(); $('#search').focus(); } });
function onLocationChange() {
  const previousFilters = routeHash({ ...route, id: '' });
  route = parseRoute(location.hash);
  if (previousFilters !== routeHash({ ...route, id: '' })) visibleCount = 24;
  render();
}
window.addEventListener('hashchange', onLocationChange);
window.addEventListener('popstate', onLocationChange);
loadCatalog();
document.addEventListener('error',event=>{const image=event.target;if(image instanceof HTMLImageElement && image.closest('.entry-media')) image.closest('.entry-media').classList.add('image-failed');},true);
