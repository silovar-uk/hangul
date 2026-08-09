import {
  createNote,
  deleteNote,
  getAllNotes,
  getNote,
  getNotesForTarget,
  updateNote
} from './notes-store.js';

let panel = null;
let launcher = null;
let activeNote = null;
let draftMeta = null;
let saveTimer = null;
let toastTimer = null;
let listFilter = 'all';
let returnFocus = null;

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function noteCount() {
  return getAllNotes().length;
}

function updateLauncher() {
  if (!launcher) return;
  const count = noteCount();
  launcher.classList.toggle('has-notes', count > 0);
  launcher.setAttribute('aria-label', count ? `メモを開く。${count}件あります` : 'メモを開く');
  const dot = launcher.querySelector('.notes-launcher-dot');
  if (dot) dot.hidden = count === 0;
}

function ensureLauncher() {
  if (launcher) return;
  launcher = document.createElement('button');
  launcher.type = 'button';
  launcher.className = 'notes-launcher';
  launcher.setAttribute('aria-controls', 'globalNotesPanel');
  launcher.setAttribute('aria-expanded', 'false');
  launcher.innerHTML = `
    <span class="notes-launcher-icon" aria-hidden="true">✎</span>
    <span class="notes-launcher-label">メモ</span>
    <span class="notes-launcher-dot" aria-hidden="true" hidden></span>
  `;
  launcher.addEventListener('click', () => {
    if (panel?.classList.contains('is-open')) closePanel();
    else {
      returnFocus = launcher;
      openList('all');
    }
  });
  document.body.append(launcher);
  updateLauncher();
}

function ensurePanel() {
  ensureLauncher();
  if (panel) return;

  panel = document.createElement('aside');
  panel.id = 'globalNotesPanel';
  panel.className = 'notes-panel';
  panel.setAttribute('aria-label', '学習メモ');
  panel.setAttribute('aria-hidden', 'true');
  panel.addEventListener('click', handlePanelClick);
  panel.addEventListener('input', handlePanelInput);

  document.body.append(panel);
}

function openShell() {
  ensurePanel();
  panel.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => panel.classList.add('is-open'));
  document.body.classList.add('notes-panel-open');
  launcher?.setAttribute('aria-expanded', 'true');
}

function flushEditor() {
  clearTimeout(saveTimer);
  const textarea = panel?.querySelector('.notes-editor');
  if (!textarea) return;
  const body = textarea.value;
  if (activeNote) activeNote = updateNote(activeNote.id, { body }) || activeNote;
  else if (body.trim()) {
    activeNote = createNote({ ...draftMeta, body });
    draftMeta = null;
  }
}

function closePanel({ restoreFocus = true } = {}) {
  flushEditor();
  panel?.classList.remove('is-open');
  panel?.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('notes-panel-open');
  launcher?.setAttribute('aria-expanded', 'false');
  activeNote = null;
  draftMeta = null;
  updateLauncher();

  if (restoreFocus && returnFocus?.isConnected) {
    requestAnimationFrame(() => returnFocus.focus());
  }
  returnFocus = null;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric' }).format(date);
}

function noteTypeLabel(kind) {
  return { general: '自由メモ', character: '文字', word: '単語', phrase: 'フレーズ' }[kind] || 'メモ';
}

function openList(filter = 'all') {
  if (panel?.querySelector('.notes-editor')) flushEditor();
  listFilter = filter;
  activeNote = null;
  draftMeta = null;
  openShell();
  renderList();
}

function renderList() {
  const notes = getAllNotes().filter((note) => listFilter === 'all' || note.kind === listFilter);
  panel.innerHTML = `
    <div class="notes-panel-header">
      <div><span>MEMO</span><h2>学習メモ</h2><p>${notes.length ? `${notes.length}件` : 'この端末に保存'}</p></div>
      <button type="button" data-notes-close aria-label="メモを閉じる">×</button>
    </div>
    <div class="notes-filter" role="tablist" aria-label="メモの種類">
      ${filterButton('all', 'すべて')}
      ${filterButton('character', '文字')}
      ${filterButton('general', '自由')}
    </div>
    <div class="notes-list">
      ${notes.length ? notes.map(noteListItem).join('') : `
        <div class="notes-empty">
          <strong>まだメモはありません。</strong>
          <p>気づいた違いや、あとで見直したいことを短く残せます。</p>
        </div>
      `}
    </div>
    <button type="button" class="notes-new-button" data-note-new>＋ メモを書く</button>
  `;
}

function filterButton(value, label) {
  return `<button type="button" class="${listFilter === value ? 'is-active' : ''}" data-note-filter="${value}">${label}</button>`;
}

function noteListItem(note) {
  const label = note.targetLabel || noteTypeLabel(note.kind);
  return `
    <div class="notes-list-item" data-note-id="${escapeHtml(note.id)}">
      <button type="button" class="notes-list-main" data-note-edit="${escapeHtml(note.id)}">
        <span class="notes-list-label">${escapeHtml(label)}</span>
        <span class="notes-list-body">${escapeHtml(note.body)}</span>
        <time>${formatDate(note.updatedAt)}</time>
      </button>
      <div class="notes-list-actions" aria-label="メモ操作">
        <button type="button" data-note-copy="${escapeHtml(note.id)}">コピー</button>
        <button type="button" class="is-danger" data-note-remove="${escapeHtml(note.id)}">削除</button>
      </div>
    </div>
  `;
}

function openEditor({ id = '', kind = 'general', targetId = '', targetLabel = '' } = {}) {
  const existing = id
    ? getNote(id)
    : (kind !== 'general' && targetId ? getNotesForTarget(kind, targetId)[0] : null);

  activeNote = existing;
  draftMeta = existing ? null : { kind, targetId, targetLabel };
  openShell();
  renderEditor();
  requestAnimationFrame(() => panel.querySelector('textarea')?.focus());
}

function renderEditor() {
  const note = activeNote;
  const meta = note || draftMeta || { kind: 'general', targetId: '', targetLabel: '' };
  const title = meta.targetLabel || (meta.kind === 'general' ? '自由メモ' : noteTypeLabel(meta.kind));
  panel.innerHTML = `
    <div class="notes-panel-header notes-editor-header">
      <button type="button" class="notes-back" data-notes-list aria-label="メモ一覧へ戻る">←</button>
      <div><span>MEMO</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(noteTypeLabel(meta.kind))}</p></div>
      <button type="button" data-notes-close aria-label="メモを閉じる">×</button>
    </div>
    <textarea class="notes-editor" rows="10" maxlength="3000" placeholder="気づいた違い、間違えやすい点、あとで見たいこと…">${escapeHtml(note?.body || '')}</textarea>
    <div class="notes-editor-footer">
      <span class="notes-save-state" aria-live="polite">${note ? '保存済み' : '入力すると自動保存'}</span>
      <div class="notes-editor-actions">
        <button type="button" data-note-copy-active>コピー</button>
        ${note ? '<button type="button" class="is-danger" data-note-delete>削除</button>' : ''}
      </div>
    </div>
  `;
}

function handlePanelInput(event) {
  if (!event.target.matches('.notes-editor')) return;
  clearTimeout(saveTimer);
  const state = panel.querySelector('.notes-save-state');
  if (state) state.textContent = '保存中…';
  const body = event.target.value;
  saveTimer = setTimeout(() => saveBody(body), 500);
}

function saveBody(body) {
  if (activeNote) {
    activeNote = updateNote(activeNote.id, { body }) || activeNote;
  } else if (body.trim()) {
    activeNote = createNote({ ...draftMeta, body });
    draftMeta = null;
    renderEditor();
    requestAnimationFrame(() => {
      const textarea = panel.querySelector('.notes-editor');
      if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      }
    });
    updateLauncher();
    return;
  }
  const state = panel.querySelector('.notes-save-state');
  if (state) state.textContent = '保存済み';
  updateLauncher();
}

async function copyText(text) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const helper = document.createElement('textarea');
  helper.value = text;
  helper.setAttribute('readonly', '');
  helper.style.position = 'fixed';
  helper.style.opacity = '0';
  document.body.append(helper);
  helper.select();
  document.execCommand('copy');
  helper.remove();
}

function showOperation(message) {
  if (!panel) return;
  clearTimeout(toastTimer);
  panel.querySelector('.notes-operation-toast')?.remove();
  const toast = document.createElement('div');
  toast.className = 'notes-operation-toast';
  toast.setAttribute('role', 'status');
  toast.textContent = message;
  panel.append(toast);
  toastTimer = setTimeout(() => toast.remove(), 1400);
}

async function copyNote(id) {
  const note = getNote(id);
  if (!note?.body.trim()) return showOperation('メモは空です');
  try {
    await copyText(note.body);
    showOperation('コピーしました');
  } catch {
    showOperation('コピーできませんでした');
  }
}

function removeNote(id) {
  const note = getNote(id);
  if (!note) return;
  if (!window.confirm('このメモを削除しますか？')) return;
  deleteNote(id);
  if (activeNote?.id === id) activeNote = null;
  updateLauncher();
  renderList();
  showOperation('削除しました');
}

async function copyActiveEditor() {
  const textarea = panel?.querySelector('.notes-editor');
  const text = textarea?.value || '';
  if (!text.trim()) return showOperation('メモは空です');
  try {
    await copyText(text);
    showOperation('コピーしました');
  } catch {
    showOperation('コピーできませんでした');
  }
}

function handlePanelClick(event) {
  if (event.target.closest('[data-notes-close]')) return closePanel();

  if (event.target.closest('[data-notes-list]')) return openList(listFilter);

  const filter = event.target.closest('[data-note-filter]');
  if (filter) return openList(filter.dataset.noteFilter);

  const copy = event.target.closest('[data-note-copy]');
  if (copy) return copyNote(copy.dataset.noteCopy);

  const remove = event.target.closest('[data-note-remove]');
  if (remove) return removeNote(remove.dataset.noteRemove);

  const edit = event.target.closest('[data-note-edit]');
  if (edit) return openEditor({ id: edit.dataset.noteEdit });

  if (event.target.closest('[data-note-new]')) return openEditor({ kind: 'general' });

  if (event.target.closest('[data-note-copy-active]')) return copyActiveEditor();

  if (event.target.closest('[data-note-delete]') && activeNote) return removeNote(activeNote.id);
}

document.addEventListener('click', (event) => {
  const opener = event.target.closest('[data-note-open]');
  if (opener) {
    event.preventDefault();
    returnFocus = opener;
    openEditor({
      kind: opener.dataset.noteOpen || 'general',
      targetId: opener.dataset.noteTargetId || '',
      targetLabel: opener.dataset.noteTargetLabel || ''
    });
    return;
  }

  const list = event.target.closest('[data-notes-list]');
  if (list && !panel?.contains(list)) {
    event.preventDefault();
    returnFocus = list;
    openList('all');
    return;
  }

  const existing = event.target.closest('[data-note-id]');
  if (existing && !panel?.contains(existing)) {
    event.preventDefault();
    returnFocus = existing;
    openEditor({ id: existing.dataset.noteId });
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && panel?.classList.contains('is-open')) closePanel();
});

window.addEventListener('hangul-notes-changed', updateLauncher);

ensureLauncher();
