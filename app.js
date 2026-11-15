import { Metronome } from './metronome.js';
import { parseTab, layoutRows } from './parser.js';
import * as store from './store.js';

const $ = id => document.getElementById(id);
const met = new Metronome();
let currentText = '';
let currentId = null;
// Per-tab practice state, persisted with the tab: selected bars, named sections, loop flag.
let st = { sel: null, sections: [], loop: false, activeSection: null };
let picking = false;

// ---- Metronome UI ----
function renderBeats() {
  $('beats').innerHTML = Array.from({ length: met.beats }, (_, i) => `<i class="${i ? '' : 'first'}"></i>`).join('');
}
function setBpm(v) {
  met.bpm = Math.max(30, Math.min(300, Math.round(v)));
  $('bpm').textContent = met.bpm;
  $('tempo').value = met.bpm;
}
$('tempo').oninput = e => setBpm(+e.target.value);
let ph = null; // bar the playhead is on
function paintPh() {
  document.querySelectorAll('#tab .m.ph').forEach(el => el.classList.remove('ph'));
  if (ph === null) return;
  const els = document.querySelectorAll(`#tab .m[data-i="${ph}"]`);
  els.forEach(el => el.classList.add('ph'));
  if (els[0]) els[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
}
function stopPlay() {
  met.stop();
  ph = null;
  paintPh();
  $('play').classList.remove('on');
  $('play').textContent = '▶';
  renderBeats();
}
$('play').addEventListener('click', () => {
  if (met.running) return stopPlay();
  ph = null;
  met.start();
  $('play').classList.add('on');
  $('play').textContent = '■';
});
$('bpm-down').onclick = () => setBpm(met.bpm - 1);
$('bpm-up').onclick = () => setBpm(met.bpm + 1);
$('sig').onchange = e => { met.beats = +e.target.value; renderBeats(); };
$('countin').onchange = e => { met.countIn = e.target.checked; };
met.onBeat = ({ beat, countIn }) => {
  [...$('beats').children].forEach((el, i) => el.classList.toggle('on', i === beat));
  if (countIn || beat !== 0) return;
  let lo, hi;
  if (st.sel) { lo = st.sel.a; hi = st.sel.b; }
  else {
    const idx = [...document.querySelectorAll('#tab .m')].map(el => +el.dataset.i);
    if (!idx.length) return;
    lo = 0; hi = Math.max(...idx);
  }
  if (ph === null || ph < lo || ph > hi) ph = lo;
  else if (ph === hi) {
    if (!st.loop && st.sel) return stopPlay();
    ph = lo;
  } else ph++;
  paintPh();
};
renderBeats();

// ---- Tab rendering ----
function esc(s) { return s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

function charsPerRow() {
  const probe = document.createElement('span');
  probe.className = 'tabrow';
  probe.style.cssText = 'position:absolute;visibility:hidden;margin:0';
  probe.textContent = 'M'.repeat(100);
  document.body.appendChild(probe);
  const cw = probe.getBoundingClientRect().width / 100;
  probe.remove();
  return Math.max(10, Math.floor(($('tab').clientWidth - 12) / cw));
}

function render(text) {
  currentText = text;
  const el = $('tab');
  const parsed = parseTab(text);
  if (!parsed) {
    el.innerHTML = `<p class="warn">Couldn't recognise a tab. Showing raw text.</p><pre class="raw">${esc(text)}</pre>`;
    return;
  }
  const rows = layoutRows(parsed, charsPerRow());
  el.innerHTML = rows.map(row => {
    if (row.text !== undefined) return `<pre class="tabrow text">${esc(row.text)}</pre>`;
    const names = row.names.map(n => esc(n.padEnd(1)) + '|').join('\n');
    const ms = row.measures.map(m =>
      `<span class="m" data-i="${m.index}">${row.names.map((_, s) => esc((m.lines[s] || '').padEnd(m.width - 1, '-')) + '|').join('\n')}</span>`).join('');
    return `<div class="tabrow"><span class="nm">${names}</span>${ms}</div>`;
  }).join('');
  paintSel();
  paintPh();
}

let resizeTimer;
addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => currentText && render(currentText), 150);
});

// ---- Text size (buttons + pinch) ----
const FS_MIN = 8, FS_MAX = 28;
const clampFs = v => Math.round(Math.max(FS_MIN, Math.min(FS_MAX, v)) * 2) / 2;
let fs = clampFs(+localStorage.getItem('tt.fs') || 13);
function applyFs() { document.documentElement.style.setProperty('--fs', fs + 'px'); }
function setFs(v) {
  fs = clampFs(v);
  localStorage.setItem('tt.fs', fs);
  applyFs();
  if (currentText) render(currentText);
}
$('fs-down').onclick = () => setFs(fs - 1);
$('fs-up').onclick = () => setFs(fs + 1);
applyFs();

let pinch = null;
const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
$('tab').addEventListener('touchstart', e => {
  if (e.touches.length === 2) pinch = { d0: dist(e.touches), fs0: fs };
}, { passive: true });
$('tab').addEventListener('touchmove', e => {
  if (!pinch || e.touches.length !== 2) return;
  e.preventDefault();
  fs = clampFs(pinch.fs0 * dist(e.touches) / pinch.d0);
  applyFs();
}, { passive: false });
$('tab').addEventListener('touchend', e => {
  if (pinch && e.touches.length < 2) { pinch = null; setFs(fs); }
});

// ---- Sections and loop ----
const persist = () => {
  if (currentId && store.get(currentId)) store.update(currentId, { sel: st.sel, sections: st.sections, loop: st.loop });
};
function paintSel() {
  document.querySelectorAll('#tab .m').forEach(el => {
    const i = +el.dataset.i;
    el.classList.toggle('sel', !!st.sel && i >= st.sel.a && i <= st.sel.b);
    el.classList.toggle('pending', picking && !!st.sel && i === st.sel.a);
  });
  const has = !!st.sel;
  $('sec-bar').hidden = !has && !st.sections.length;
  $('sec-info').textContent = has
    ? (picking ? `Bar ${st.sel.a + 1} – tap last bar` : st.sel.a === st.sel.b ? `Bar ${st.sel.a + 1}` : `Bars ${st.sel.a + 1}–${st.sel.b + 1}`)
    : 'Tap a bar to start a section';
  $('sec-save').hidden = !has || picking;
  $('sec-clear').hidden = !has;
  $('sec-del').hidden = st.activeSection === null;
  $('loop').hidden = !has;
  $('loop').classList.toggle('on', st.loop);
  $('loop').setAttribute('aria-pressed', st.loop);
  $('sec-pick').hidden = !st.sections.length;
  $('sec-pick').innerHTML = '<option value="">Sections</option>' +
    st.sections.map((s, k) => `<option value="${k}"${st.activeSection === k ? ' selected' : ''}>${esc(s.name)}</option>`).join('');
}
function resetState(saved) {
  st = { sel: saved?.sel || null, sections: saved?.sections || [], loop: !!saved?.loop, activeSection: null };
  picking = false;
}
$('tab').addEventListener('click', e => {
  const m = e.target.closest('.m');
  if (!m) return;
  const i = +m.dataset.i;
  if (picking) {
    st.sel = { a: Math.min(st.sel.a, i), b: Math.max(st.sel.a, i) };
    picking = false;
  } else {
    st.sel = { a: i, b: i };
    picking = true;
  }
  st.activeSection = null;
  persist();
  paintSel();
});
$('sec-clear').onclick = () => { st.sel = null; picking = false; st.activeSection = null; persist(); paintSel(); };
$('loop').onclick = () => { st.loop = !st.loop; persist(); paintSel(); };
$('sec-save').onclick = () => {
  const name = prompt('Name this section', `Bars ${st.sel.a + 1}–${st.sel.b + 1}`);
  if (name === null) return;
  st.sections.push({ name: name.trim() || 'Section', a: st.sel.a, b: st.sel.b });
  st.activeSection = st.sections.length - 1;
  persist();
  paintSel();
};
$('sec-pick').onchange = e => {
  const s = st.sections[+e.target.value];
  if (!s) { st.activeSection = null; return paintSel(); }
  st.sel = { a: s.a, b: s.b };
  st.activeSection = +e.target.value;
  picking = false;
  persist();
  paintSel();
};
$('sec-del').onclick = () => {
  const s = st.sections[st.activeSection];
  if (s && confirm(`Delete section "${s.name}"?`)) {
    st.sections.splice(st.activeSection, 1);
    st.activeSection = null;
    persist();
    paintSel();
  }
};
new ResizeObserver(() => document.documentElement.style.setProperty('--barh', $('bar').offsetHeight + 'px')).observe($('bar'));

// ---- Library ----
function loadNew(text) {
  currentId = null;
  resetState(null);
  render(text);
}
function openTab(tab) {
  currentId = tab.id;
  localStorage.setItem('tt.last', tab.id);
  resetState(tab);
  render(tab.text);
  $('banner').hidden = true;
}
function saveCurrent() {
  if (!currentText) return showBanner('Nothing to save yet.', false);
  if (currentId && store.get(currentId)) return showBanner('Already saved.', false);
  const name = prompt('Name this tab', 'Untitled');
  if (name === null) return;
  const tab = store.add(name, currentText);
  currentId = tab.id;
  persist();
  localStorage.setItem('tt.last', tab.id);
  showBanner('Saved.', false);
}
function renderLibrary() {
  const tabs = store.list();
  $('lib-list').innerHTML = tabs.length
    ? tabs.map(t => `<li data-id="${t.id}"><button class="open">${esc(t.name)}</button><button class="ren" aria-label="Rename">✎</button><button class="del" aria-label="Delete">🗑</button></li>`).join('')
    : '<li class="empty">No saved tabs yet.</li>';
}
$('library').onclick = () => { renderLibrary(); $('lib-dlg').showModal(); };
$('save').onclick = saveCurrent;
$('lib-close').onclick = () => $('lib-dlg').close();
$('lib-list').addEventListener('click', e => {
  const li = e.target.closest('li[data-id]');
  if (!li) return;
  const tab = store.get(li.dataset.id);
  if (!tab) return;
  if (e.target.closest('.open')) { openTab(tab); $('lib-dlg').close(); }
  else if (e.target.closest('.ren')) {
    const n = prompt('Rename tab', tab.name);
    if (n !== null) { store.rename(tab.id, n); renderLibrary(); }
  } else if (e.target.closest('.del') && confirm(`Delete "${tab.name}"?`)) {
    store.remove(tab.id);
    if (currentId === tab.id) { currentId = null; localStorage.removeItem('tt.last'); }
    renderLibrary();
  }
});

// ---- Find tabs ----
$('find').addEventListener('submit', e => {
  e.preventDefault();
  const q = $('find-q').value.trim();
  if (!q) return;
  const url = 'https://www.google.com/search?q=' + encodeURIComponent(`site:guitaretab.com ${q}`);
  window.open(url, '_blank', 'noopener');
});

// ---- Paste ----
$('paste').addEventListener('click', async () => {
  met.unlock();
  try {
    const t = await navigator.clipboard.readText();
    if (t && t.trim()) return loadNew(t);
  } catch { /* fall back to dialog */ }
  $('paste-text').value = '';
  $('paste-dlg').showModal();
});
$('paste-dlg').addEventListener('close', () => {
  if ($('paste-dlg').returnValue === 'ok' && $('paste-text').value.trim()) loadNew($('paste-text').value);
});

// ---- Bookmarklet import (#t=<encoded text>) ----
function showBanner(msg, canSave) {
  $('banner-msg').textContent = msg;
  $('banner-save').hidden = !canSave;
  $('banner').hidden = false;
}
$('banner-x').onclick = () => { $('banner').hidden = true; };
$('banner-save').onclick = saveCurrent;

function importFromHash() {
  if (!location.hash.startsWith('#t=')) return;
  let text = '';
  try { text = decodeURIComponent(location.hash.slice(3)); } catch { /* malformed */ }
  history.replaceState(null, '', location.pathname + location.search);
  if (!text.trim()) {
    $('tab').innerHTML = '<p class="warn">No tab found on that page. Select the tab text and tap the bookmarklet again.</p>';
    return showBanner('Nothing found on the page.', false);
  }
  loadNew(text);
  showBanner('Tab loaded. Save it?', true);
}
importFromHash();
if (!currentText) {
  const last = store.get(localStorage.getItem('tt.last'));
  if (last) openTab(last);
}
