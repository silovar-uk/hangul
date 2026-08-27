import { STORAGE_KEY, safeLoadProgress, getItemMastery } from './core.js';
import { getNextLearningAction, getWeakPreview } from './learning-recommendation.js';

const app = document.querySelector('#app');

function loadProgress() {
  return safeLoadProgress(localStorage.getItem(STORAGE_KEY));
}

function setHeading(copyBlock, recommendation) {
  const heading = copyBlock?.querySelector('h1');
  if (!heading) return;

  heading.replaceChildren();
  const lead = document.createElement('span');
  lead.className = 'hero-copy-lead';
  lead.textContent = recommendation.title;
  const follow = document.createElement('span');
  follow.className = 'hero-copy-follow';
  follow.textContent = recommendation.support;
  heading.append(lead, follow);
}

function setReason(copyBlock, recommendation) {
  if (!copyBlock) return;
  let reason = copyBlock.querySelector('.adaptive-recommendation-reason');
  if (!reason) {
    reason = document.createElement('p');
    reason.className = 'adaptive-recommendation-reason';
    const actions = copyBlock.parentElement?.querySelector('.quest-board-actions, .hero-actions');
    if (actions && actions.parentElement === copyBlock.parentElement) actions.before(reason);
    else copyBlock.append(reason);
  }
  reason.textContent = recommendation.reason;
}

function setPrimaryAction(board, recommendation) {
  const primary = board.querySelector('.quest-board-action, .primary-button--hero');
  if (!primary) return;

  primary.dataset.action = recommendation.action;
  if (recommendation.stageId) primary.dataset.stage = recommendation.stageId;
  else delete primary.dataset.stage;

  const label = primary.querySelector('span');
  if (label) {
    label.textContent = recommendation.action === 'weak-start'
      ? '苦手を復習'
      : recommendation.optional ? 'もう5問' : 'この5問を始める';
  }
  primary.setAttribute('aria-label', `${recommendation.title} ${recommendation.reason}`);
}

function weakStrip(progress, weak) {
  const section = document.createElement('section');
  section.className = 'adaptive-weak-strip';
  section.setAttribute('aria-label', '今日の苦手文字');

  const copy = document.createElement('div');
  copy.className = 'adaptive-weak-copy';
  const label = document.createElement('span');
  label.textContent = 'TODAY’S WEAK SPOTS';
  const title = document.createElement('strong');
  title.textContent = '今日の苦手';
  copy.append(label, title);

  const glyphs = document.createElement('div');
  glyphs.className = 'adaptive-weak-glyphs';
  weak.forEach((item) => {
    const stat = progress.itemStats?.[item.id] ?? {};
    const chip = document.createElement('div');
    chip.className = 'adaptive-weak-glyph';
    const glyph = document.createElement('b');
    glyph.textContent = item.hangul;
    const detail = document.createElement('small');
    detail.textContent = `${item.reading}・習熟 ${getItemMastery(stat)}%`;
    chip.append(glyph, detail);
    glyphs.append(chip);
  });

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'adaptive-weak-action';
  button.textContent = '苦手から復習 →';
  button.addEventListener('click', () => {
    const weakStart = [...document.querySelectorAll('[data-action="weak-start"]')]
      .find((node) => !node.closest('.adaptive-weak-strip'));
    weakStart?.click();
  });

  section.append(copy, glyphs, button);
  return section;
}

function syncWeakStrip(home, board, progress, weak) {
  const existing = home.querySelector('.adaptive-weak-strip');
  if (!weak.length) {
    existing?.remove();
    return;
  }

  const signature = weak.map((item) => `${item.id}:${getItemMastery(progress.itemStats?.[item.id] ?? {})}`).join('|');
  if (existing?.dataset.signature === signature) return;

  const next = weakStrip(progress, weak);
  next.dataset.signature = signature;
  if (existing) existing.replaceWith(next);
  else board.after(next);
}

function enhanceHome() {
  const home = app?.querySelector('.home-shell');
  if (!home) return;

  const board = home.querySelector('.quest-board, .today-section, .hero');
  const copyBlock = board?.querySelector('.hero-copy-block');
  if (!board || !copyBlock) return;

  const progress = loadProgress();
  const recommendation = getNextLearningAction(progress);
  const weak = getWeakPreview(progress, 3);
  const signature = `${recommendation.type}|${recommendation.stageId}|${recommendation.reason}`;

  if (board.dataset.adaptiveSignature !== signature) {
    board.dataset.adaptiveSignature = signature;
    board.dataset.adaptiveAction = recommendation.type;
    copyBlock.dataset.adaptiveLabel = 'NEXT BEST ACTION';
    setHeading(copyBlock, recommendation);
    setReason(copyBlock, recommendation);
    setPrimaryAction(board, recommendation);
  }

  syncWeakStrip(home, board, progress, weak);
}

if (app) {
  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      enhanceHome();
    });
  });
  observer.observe(app, { childList: true, subtree: true });
  requestAnimationFrame(enhanceHome);
}
