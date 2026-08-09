export const NOTES_STORAGE_KEY = 'hangulQuest.notes.v1';

function defaultState() {
  return { version: 1, entries: [] };
}

function normalizeEntry(entry = {}) {
  return {
    id: String(entry.id || makeId()),
    kind: ['general', 'character', 'word', 'phrase'].includes(entry.kind) ? entry.kind : 'general',
    targetId: String(entry.targetId || ''),
    targetLabel: String(entry.targetLabel || ''),
    body: String(entry.body || ''),
    createdAt: entry.createdAt || new Date().toISOString(),
    updatedAt: entry.updatedAt || entry.createdAt || new Date().toISOString()
  };
}

function makeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function loadNotes() {
  try {
    const parsed = JSON.parse(localStorage.getItem(NOTES_STORAGE_KEY) || 'null');
    if (!parsed || !Array.isArray(parsed.entries)) return defaultState();
    return { version: 1, entries: parsed.entries.map(normalizeEntry) };
  } catch {
    return defaultState();
  }
}

function persist(state) {
  localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify({ version: 1, entries: state.entries }));
  window.dispatchEvent(new CustomEvent('hangul-notes-changed', { detail: { count: state.entries.length } }));
  return state;
}

export function getAllNotes() {
  return loadNotes().entries
    .filter((entry) => entry.body.trim())
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

export function getRecentNotes(limit = 3) {
  return getAllNotes().slice(0, limit);
}

export function getNote(id) {
  return loadNotes().entries.find((entry) => entry.id === id) ?? null;
}

export function getNotesForTarget(kind, targetId) {
  return getAllNotes().filter((entry) => entry.kind === kind && entry.targetId === targetId);
}

export function createNote({ kind = 'general', targetId = '', targetLabel = '', body = '' } = {}) {
  const state = loadNotes();
  const now = new Date().toISOString();
  const note = normalizeEntry({ id: makeId(), kind, targetId, targetLabel, body, createdAt: now, updatedAt: now });
  state.entries.unshift(note);
  persist(state);
  return note;
}

export function updateNote(id, patch = {}) {
  const state = loadNotes();
  const index = state.entries.findIndex((entry) => entry.id === id);
  if (index < 0) return null;
  state.entries[index] = normalizeEntry({
    ...state.entries[index],
    ...patch,
    id,
    createdAt: state.entries[index].createdAt,
    updatedAt: new Date().toISOString()
  });
  persist(state);
  return state.entries[index];
}

export function upsertTargetNote({ kind, targetId, targetLabel = '', body = '' }) {
  const existing = loadNotes().entries.find((entry) => entry.kind === kind && entry.targetId === targetId);
  return existing
    ? updateNote(existing.id, { targetLabel, body })
    : createNote({ kind, targetId, targetLabel, body });
}

export function deleteNote(id) {
  const state = loadNotes();
  const nextEntries = state.entries.filter((entry) => entry.id !== id);
  if (nextEntries.length === state.entries.length) return false;
  persist({ ...state, entries: nextEntries });
  return true;
}
