// Parses ASCII tab text into ordered blocks so nothing in the paste is dropped:
//   { type: 'text', lines } for headers/chords/lyrics
//   { type: 'tab', names, measures: [[line per string]...] } for string groups
// Returns null when no tab block is found.
// Bar-less line like "e-----0---3---": a string name followed by mostly tab characters.
const BARLESS = /^\s*(?:\[[^\]]*\])?\s*[A-Ga-g][#b]?\s*-[-0-9hpbrsx/\\~^()<>.*\s]*$/;

function isBarless(line) {
  return BARLESS.test(line) && (line.match(/-/g) || []).length >= 8;
}

// A tab line: short string-name prefix (may include markup like [tab]), a bar, then mostly dashes/fret numbers.
function isTabLine(line) {
  const i = line.search(/[|:]/);
  if (i < 0 || i > 12) return isBarless(line);
  const body = line.slice(i);
  const dashes = (body.match(/-/g) || []).length;
  return dashes >= 3 && (body.match(/[-0-9|]/g) || []).length >= body.trim().length * 0.5;
}

function splitLine(line) {
  const i = line.search(/[|:]/);
  if (i < 0 || i > 12) {
    const m = line.replace(/\[[^\]]*\]/g, '').match(/^\s*([A-Ga-g][#b]?)\s*(.*)$/);
    return { name: m[1], measures: [m[2].trimEnd()] };
  }
  const name = (line.slice(0, i).replace(/\[[^\]]*\]/g, '').trim().match(/[A-Ga-g][#b]?/) || [''])[0];
  const body = line.slice(i).replace(/^[|:]+/, '').replace(/[|\s]+$/, '');
  return { name, measures: body.split(/\|+/) };
}

// Numbered strings ("1---0---", 1 = high e, 6 = low E): rewrite to "e|---0---|".
// Blank lines inside a string group are allowed; trailing notes become text lines.
const NUMBERED = /^\s*([1-6])\s*(-[-0-9hpbrsx/\\~^()<>.*]*)(?:\s{2,}(\S.*))?\s*$/;
const STRING_NAMES = ['e', 'B', 'G', 'D', 'A', 'E'];

function normalizeNumbered(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const m = NUMBERED.exec(lines[i]);
    if (!m) { out.push(lines[i]); continue; }
    const group = [];
    const notes = [];
    let prev = 0;
    let j = i;
    while (j < lines.length) {
      let k = j;
      while (k < lines.length && !lines[k].trim()) k++;
      const mm = k < lines.length && NUMBERED.exec(lines[k]);
      if (!mm || +mm[1] <= prev || (k > j && prev === 0)) break;
      prev = +mm[1];
      group.push(`${STRING_NAMES[prev - 1]}|${mm[2].trimEnd()}|`);
      if (mm[3]) notes.push(mm[3].trim());
      j = k + 1;
      if (prev === 6) break;
    }
    out.push(...group, ...notes);
    i = j - 1;
  }
  return out;
}

export function parseTab(text) {
  const lines = normalizeNumbered(String(text || '').replace(/\r/g, '').split('\n'));
  const blocks = [];
  let group = [];
  let plain = [];
  const flushText = () => {
    while (plain.length && !plain[plain.length - 1].trim()) plain.pop();
    while (plain.length && !plain[0].trim()) plain.shift();
    if (plain.length) blocks.push({ type: 'text', lines: plain });
    plain = [];
  };
  const flushTab = () => {
    if (group.length >= 2 && group.length <= 12) {
      flushText();
      const parsed = group.map(splitLine);
      const count = Math.max(...parsed.map(p => p.measures.length));
      const measures = [];
      for (let i = 0; i < count; i++) measures.push(parsed.map(p => p.measures[i] || ''));
      blocks.push({ type: 'tab', names: parsed.map(p => p.name), measures });
    } else {
      plain.push(...group);
    }
    group = [];
  };
  for (const line of lines) {
    if (isTabLine(line)) group.push(line);
    else { flushTab(); plain.push(line); }
  }
  flushTab();
  flushText();
  return blocks.some(b => b.type === 'tab') ? { blocks } : null;
}

// Split a measure wider than limit at a column where every string is a dash/space.
function chunkMeasure(lines, limit) {
  const width = Math.max(...lines.map(l => l.length));
  if (width <= limit) return [lines];
  const chunks = [];
  let start = 0;
  while (width - start > limit) {
    let cut = start + limit;
    while (cut > start + 1 && !lines.every(l => (l[cut] || '-') === '-' || l[cut] === ' ')) cut--;
    if (cut <= start + 1) cut = start + limit;
    chunks.push(lines.map(l => l.slice(start, cut)));
    start = cut;
  }
  chunks.push(lines.map(l => l.slice(start)));
  return chunks;
}

// Flatten measures across systems and wrap into rows fitting maxChars.
export function layoutRows(parsed, maxChars) {
  const rows = [];
  let measureIndex = 0;
  for (const sys of parsed.blocks) {
    if (sys.type === 'text') { rows.push({ text: sys.lines.join('\n') }); continue; }
    let row = null;
    for (const whole of sys.measures) {
      const index = measureIndex++; // logical measure; chunks of an over-wide one share it
      for (const m of chunkMeasure(whole, maxChars - 3)) {
        const w = Math.max(...m.map(s => s.length)) + 1;
        if (!row || row.width + w > maxChars) {
          row = { names: sys.names, measures: [], width: 2 };
          rows.push(row);
        }
        row.measures.push({ index, lines: m, width: w });
        row.width += w;
      }
    }
  }
  return rows;
}
