import {
  createNote,
  deleteNote,
  getAllNotes,
  getNote,
  getNotesForTarget,
  updateNote
} from './notes-store.js';

let panel = null;
let backdrop = null;
let activeNote = null;
let draftMeta = null;
let saveTimer = null;
let listFilter = 'all';

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function ensurePanel() {
  if (panel) return;
  backdrop = document.createElement('div');
  backdrop.className = 'notes-backdrop';
  backdrop.hidden = true;
  backdrop.addEventListener('click', closePanel);

  panel = document.createElement('aside');
  panel.className = 'notes-panel';
  panel.setAttribute('aria-label', '学習メモ');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('role', 'dialog');
  panel.addEventListener('click', handlePanelClick);
  panel.addEventListener('input', handlePanelInput);

  document.body.append(backdrop, panel);
}

function openShell() {
  ensurePanel();
  backdrop.hidden = false;
  requestAnimationFrame(() => panel.classList.add('is-open'));
  document.body.classList.add('notes-open');
}

function closePanel() {
  clearTimeout(saveTimer);
  panel?.classList.remove('is-open');
  if (backdrop) backdrop.hidden = true;
  document.body.classList.remove('notes-open');
  activeNote = null;
  draftMeta = null;
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
      <div><span>FIELD NOTES</span><h2>自分の観察メモ</h2></div>
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
          <p>「違いが分かった」「ここで間違える」を、自分の言葉で残しておく。</p>
        </div>
      `}
    </div>
    <button type="button" class="notes-new-button" data-note-new>＋ 自由メモを書く</button>
  `;
}

function filterButton(value, label) {
  return `<button type="button" class="${listFilter === value ? 'is-active' : ''}" data-note-filter="${value}">${label}</button>`;
}

function noteListItem(note) {
  const label = note.targetLabel || noteTypeLabel(note.kind);
  return `
    <button type="button" class="notes-list-item" data-note-id="${escapeHtml(note.id)}">
      <span class="notes-list-label">${escapeHtml(label)}</span>
      <span class="notes-list-body">${escapeHtml(note.body)}</span>
      <time>${formatDate(note.updatedAt)}</time>
    </button>
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
    <div class="notes-panel-header">
      <button type="button" class="notes-back" data-notes-list aria-label="メモ一覧へ戻る">←</button>
      <div><span>FIELD NOTE</span><h2>${escapeHtml(title)}</h2></div>
      <button type="button" data-notes-close aria-label="メモを閉じる">×</button>
    </div>
    <div class="notes-editor-meta">
      <span>${escapeHtml(noteTypeLabel(meta.kind))}</span>
      <strong>${escapeHtml(meta.targetLabel || '思いついたことを残す')}</strong>
    </div>
    <textarea class="notes-editor" rows="10" maxlength="3000" placeholder="例：ㅗは唇を丸める。ㅓは丸めない。">${escapeHtml(note?.body || '')}</textarea>
    <div class="notes-editor-footer">
      <span class="notes-save-state" aria-live="polite">${note ? '保存済み' : '入力すると自動保存'}</span>
      ${note ? '<button type="button" class="notes-delete" data-note-delete>削除</button>' : ''}
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
    return;
  }
  const state = panel.querySelector('.notes-save-state');
  if (state) state.textContent = '保存済み';
}

function handlePanelClick(event) {
  const close = event.target.closest('[data-notes-close]');
  if (close) return closePanel();

  const back = event.target.closest('[data-notes-list]');
  if (back) return openList(listFilter);

  const filter = event.target.closest('[data-note-filter]');
  if (filter) return openList(filter.dataset.noteFilter);

  const item = event.target.closest('[data-note-id]');
  if (item) return openEditor({ id: item.dataset.noteId });

  if (event.target.closest('[data-note-new]')) return openEditor({ kind: 'general' });

  if (event.target.closest('[data-note-delete]') && activeNote) {
    if (window.confirm('このメモを削除しますか？')) {
      deleteNote(activeNote.id);
      activeNote = null;
      openList(listFilter);
    }
  }
}

document.addEventListener('click', (event) => {
  const opener = event.target.closest('[data-note-open]');
  if (opener) {
    event.preventDefault();
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
    openList('all');
    return;
  }

  const existing = event.target.closest('[data-note-id]');
  if (existing && !panel?.contains(existing)) {
    event.preventDefault();
    openEditor({ id: existing.dataset.noteId });
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && panel?.classList.contains('is-open')) closePanel();
});
