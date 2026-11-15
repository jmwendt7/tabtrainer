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
