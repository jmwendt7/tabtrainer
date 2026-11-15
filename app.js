import { Metronome } from './metronome.js';
import { parseTab, layoutRows } from './parser.js';

const $ = id => document.getElementById(id);
const met = new Metronome();
let currentText = '';

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

// ---- Text size ----
let fs = +localStorage.getItem('tt.fs') || 13;
function setFs(v) {
  fs = Math.max(9, Math.min(24, v));
  localStorage.setItem('tt.fs', fs);
  document.documentElement.style.setProperty('--fs', fs + 'px');
  if (currentText) render(currentText);
}
$('fs-down').onclick = () => setFs(fs - 1);
$('fs-up').onclick = () => setFs(fs + 1);
document.documentElement.style.setProperty('--fs', fs + 'px');

// ---- Paste ----
$('paste').addEventListener('click', async () => {
  met.unlock();
  try {
    const t = await navigator.clipboard.readText();
    if (t && t.trim()) return render(t);
  } catch { /* fall back to dialog */ }
  $('paste-text').value = '';
  $('paste-dlg').showModal();
});
$('paste-dlg').addEventListener('close', () => {
  if ($('paste-dlg').returnValue === 'ok' && $('paste-text').value.trim()) render($('paste-text').value);
});

// ---- Bookmarklet import (#t=<encoded text>) ----
function showBanner(msg, canSave) {
  $('banner-msg').textContent = msg;
  $('banner-save').hidden = !canSave;
  $('banner').hidden = false;
}
$('banner-x').onclick = () => { $('banner').hidden = true; };
$('banner-save').onclick = () => {
  const name = prompt('Name this tab', 'Untitled');
  if (name === null) return;
  const tabs = JSON.parse(localStorage.getItem('tt.tabs') || '[]');
  tabs.push({ id: Date.now().toString(36), name: name.trim() || 'Untitled', text: currentText });
  localStorage.setItem('tt.tabs', JSON.stringify(tabs));
  showBanner('Saved.', false);
};

function importFromHash() {
  if (!location.hash.startsWith('#t=')) return;
  let text = '';
  try { text = decodeURIComponent(location.hash.slice(3)); } catch { /* malformed */ }
  history.replaceState(null, '', location.pathname + location.search);
  if (!text.trim()) {
    $('tab').innerHTML = '<p class="warn">No tab found on that page. Select the tab text and tap the bookmarklet again.</p>';
    return showBanner('Nothing found on the page.', false);
  }
  render(text);
  showBanner('Tab loaded. Save it?', true);
}
importFromHash();
