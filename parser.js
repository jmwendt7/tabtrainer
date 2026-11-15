// Parses ASCII tab text into ordered blocks so nothing in the paste is dropped:
//   { type: 'text', lines } for headers/chords/lyrics
//   { type: 'tab', names, measures: [[line per string]...] } for string groups
// Returns null when no tab block is found.
// A tab line: short string-name prefix (may include markup like [tab]), a bar, then mostly dashes/fret numbers.
function isTabLine(line) {
  const i = line.search(/[|:]/);
  if (i < 0 || i > 12) return false;
  const body = line.slice(i);
  const dashes = (body.match(/-/g) || []).length;
  return dashes >= 3 && (body.match(/[-0-9|]/g) || []).length >= body.trim().length * 0.5;
}

function splitLine(line) {
  const i = line.search(/[|:]/);
  const name = (line.slice(0, i).replace(/\[[^\]]*\]/g, '').trim().match(/[A-Ga-g][#b]?/) || [''])[0];
  const body = line.slice(i).replace(/^[|:]+/, '').replace(/[|\s]+$/, '');
  return { name, measures: body.split(/\|+/) };
}

export function parseTab(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
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

// Flatten measures across systems and wrap into rows fitting maxChars.
export function layoutRows(parsed, maxChars) {
  const rows = [];
  let measureIndex = 0;
  for (const sys of parsed.blocks) {
    if (sys.type === 'text') { rows.push({ text: sys.lines.join('\n') }); continue; }
    let row = null;
    for (const m of sys.measures) {
      const w = Math.max(...m.map(s => s.length)) + 1;
      if (!row || row.width + w > maxChars) {
        row = { names: sys.names, measures: [], width: 2 };
        rows.push(row);
      }
      row.measures.push({ index: measureIndex++, lines: m, width: w });
      row.width += w;
    }
  }
  return rows;
}
