// Parses ASCII guitar tab text into systems of strings, each split into measures.
// Returns { systems: [{ names: [..], measures: [[line per string]...] }] } or null if nothing parseable.
const TAB_LINE = /^\s*([A-Ga-g][#b]?)?\s*[|:]?[-0-9hpbrsx/\\~^()<>.\s|*]*\|[-0-9hpbrsx/\\~^()<>.\s|*]*$/;

function isTabLine(line) {
  const t = line.trim();
  if (!t.includes('|') || !/-/.test(t)) return false;
  return TAB_LINE.test(t) && (t.match(/-/g) || []).length >= 3;
}

function splitLine(line) {
  const t = line.trim();
  const m = t.match(/^([A-Ga-g][#b]?)?\s*\|?(.*)$/);
  const name = m[1] || '';
  const body = m[2].replace(/\|\s*$/, '');
  return { name, measures: body.split('|') };
}

export function parseTab(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  const systems = [];
  let group = [];
  const flush = () => {
    if (group.length >= 4 && group.length <= 8) {
      const parsed = group.map(splitLine);
      const count = Math.max(...parsed.map(p => p.measures.length));
      const measures = [];
      for (let i = 0; i < count; i++) {
        measures.push(parsed.map(p => p.measures[i] || ''));
      }
      systems.push({ names: parsed.map(p => p.name), measures });
    }
    group = [];
  };
  for (const line of lines) {
    if (isTabLine(line)) group.push(line);
    else flush();
  }
  flush();
  return systems.length ? { systems } : null;
}

// Flatten measures across systems and wrap into rows fitting maxChars.
export function layoutRows(parsed, maxChars) {
  const rows = [];
  let measureIndex = 0;
  for (const sys of parsed.systems) {
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
