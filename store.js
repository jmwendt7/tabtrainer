// Tab library persisted in localStorage.
const KEY = 'tt.tabs';

function load() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}
const save = list => localStorage.setItem(KEY, JSON.stringify(list));

export const list = () => load();
export const get = id => load().find(t => t.id === id) || null;

export function add(name, text) {
  const tab = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: name.trim() || 'Untitled', text };
  save([...load(), tab]);
  return tab;
}

export function rename(id, name) {
  save(load().map(t => (t.id === id ? { ...t, name: name.trim() || t.name } : t)));
}

export function remove(id) {
  save(load().filter(t => t.id !== id));
}
