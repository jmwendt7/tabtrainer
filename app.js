import { Metronome } from './metronome.js';
import { parseTab, layoutRows } from './parser.js';
import * as store from './store.js';

const $ = id => document.getElementById(id);
const met = new Metronome();
let currentText = '';
let currentId = null;

// ---- Metronome UI ----
function renderBeats() {
  $('beats').innerHTML = Array.from({ length: met.beats }, (_, i) => `<i class="${i ? '' : 'first'}"></i>`).join('');
}
function setBpm(v) {
  met.bpm = Math.max(30, Math.min(300, v));
  $('bpm').textContent = met.bpm;
}
$('play').addEventListener('click', () => {
  if (met.running) {
    met.stop();
    $('play').classList.remove('on');
    $('play').textContent = '▶';
    renderBeats();
  } else {
    met.start();
    $('play').classList.add('on');
    $('play').textContent = '■';
  }
});
$('bpm-down').onclick = () => setBpm(met.bpm - 1);
$('bpm-up').onclick = () => setBpm(met.bpm + 1);
$('sig').onchange = e => { met.beats = +e.target.value; renderBeats(); };
$('countin').onchange = e => { met.countIn = e.target.checked; };
met.onBeat = ({ beat }) => {
  [...$('beats').children].forEach((el, i) => el.classList.toggle('on', i === beat));
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
    const lines = row.names.map((n, s) =>
      esc(n.padEnd(1)) + '|' +
      row.measures.map(m => esc((m.lines[s] || '').padEnd(m.width - 1, '-')) + '|').join(''));
    return `<pre class="tabrow">${lines.join('\n')}</pre>`;
  }).join('');
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

// ---- Library ----
function loadNew(text) {
  currentId = null;
  render(text);
}
function openTab(tab) {
  currentId = tab.id;
  localStorage.setItem('tt.last', tab.id);
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
