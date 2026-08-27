import { ALL_ITEMS } from './data.js';

const HORIZONTAL_VOWELS = new Set(['ㅗ', 'ㅛ', 'ㅜ', 'ㅠ', 'ㅡ']);
const JAMO_PATTERN = /^[\u3130-\u318F\u1100-\u11FF]$/u;
const ROLE_LABELS = ['初声（子音）', '中声（母音）', '終声（パッチム）'];

export function getBuildModel(item) {
  if (!item?.hangul || !Array.isArray(item.parts)) return null;
  const resultGlyphs = [...item.hangul];
  const parts = item.parts.map((part) => String(part));
  const isSingleBlock = resultGlyphs.length === 1;
  const isJamoBuild = parts.length >= 2
    && parts.length <= 3
    && parts.every((part) => [...part].length === 1 && JAMO_PATTERN.test(part));

  if (!isSingleBlock || !isJamoBuild) return null;

  return {
    result: item.hangul,
    parts,
    layout: HORIZONTAL_VOWELS.has(parts[1]) ? 'horizontal' : 'vertical',
    hasBatchim: parts.length === 3,
    labels: parts.map((_, index) => ROLE_LABELS[index] ?? '文字')
  };
}

export function describePartDifference(correctItem, selectedItem) {
  if (!correctItem || !selectedItem) return '';

  const correctParts = Array.isArray(correctItem.parts) ? correctItem.parts.map(String) : [];
  const selectedParts = Array.isArray(selectedItem.parts) ? selectedItem.parts.map(String) : [];
  const canCompareParts = correctParts.length >= 2
    && selectedParts.length >= 2
    && correctParts.every((part) => [...part].length === 1)
    && selectedParts.every((part) => [...part].length === 1);

  if (!canCompareParts) {
    return `「${selectedItem.hangul}」ではなく「${correctItem.hangul}」。文字全体の形を見比べよう。`;
  }

  const maxLength = Math.max(correctParts.length, selectedParts.length);
  const differences = [];
  for (let index = 0; index < maxLength; index += 1) {
    if (correctParts[index] !== selectedParts[index]) differences.push(index);
  }

  if (differences.length === 1) {
    const index = differences[0];
    return `${ROLE_LABELS[index] ?? '文字'}が違う：${selectedParts[index] ?? 'なし'} → ${correctParts[index] ?? 'なし'}`;
  }

  if (differences.length > 1) {
    return `組み合わせが違う：${selectedParts.join(' + ')} → ${correctParts.join(' + ')}`;
  }

  return `形は同じ。読みの違いをもう一度確認しよう。`;
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function itemById(id) {
  return ALL_ITEMS.find((item) => item.id === id) ?? null;
}

function buildMarkup(model) {
  const partMarkup = model.parts.map((part, index) => `
    <span class="syllable-build-source-part">
      <b>${escapeHtml(part)}</b>
      <small>${escapeHtml(model.labels[index])}</small>
    </span>
  `).join('<i aria-hidden="true">＋</i>');

  const pieceMarkup = model.parts.map((part, index) => {
    const roles = ['initial', 'medial', 'final'];
    return `<span class="syllable-build-piece syllable-build-piece--${roles[index]}" style="--piece-index:${index}" aria-hidden="true">${escapeHtml(part)}</span>`;
  }).join('');

  return `
    <section class="syllable-build syllable-build--${model.layout} ${model.hasBatchim ? 'has-batchim' : ''} is-replaying" aria-label="${escapeHtml(model.parts.join(' と '))} を組み合わせると ${escapeHtml(model.result)}">
      <div class="syllable-build-heading">
        <div><span>BUILD THE BLOCK</span><strong>文字ができる流れ</strong></div>
        <button type="button" data-learning-feedback-action="replay" aria-label="文字の組み立てをもう一度見る">↻ もう一度</button>
      </div>
      <div class="syllable-build-source">${partMarkup}</div>
      <div class="syllable-build-stage" aria-hidden="true">
        ${pieceMarkup}
        <strong class="syllable-build-result">${escapeHtml(model.result)}</strong>
      </div>
      <p>${model.hasBatchim ? '初声＋中声＋パッチムが、1つの文字ブロックになる。' : '子音と母音が、上下または左右に組み合わさって1文字になる。'}</p>
    </section>
  `;
}

function comparisonMarkup({ selectedButton, correctButton }) {
  if (!selectedButton || !correctButton) return '';

  const selectedItem = itemById(selectedButton.dataset.choiceId);
  const correctItem = itemById(correctButton.dataset.choiceId);
  const selectedLabel = selectedButton.querySelector('span')?.textContent?.trim() || selectedButton.textContent.trim();
  const correctLabel = correctButton.querySelector('span')?.textContent?.trim() || correctButton.textContent.trim();
  const difference = describePartDifference(correctItem, selectedItem);

  return `
    <section class="answer-contrast" aria-label="間違えた答えと正解の比較">
      <div class="answer-contrast-heading"><span>COMPARE</span><strong>ここを見分ける</strong></div>
      <div class="answer-contrast-grid">
        <div class="answer-contrast-value is-selected">
          <small>あなたの回答</small>
          <strong>${escapeHtml(selectedLabel)}</strong>
          ${selectedItem?.hangul ? `<span>${escapeHtml(selectedItem.hangul)}</span>` : ''}
        </div>
        <div class="answer-contrast-arrow" aria-hidden="true">→</div>
        <div class="answer-contrast-value is-correct">
          <small>正解</small>
          <strong>${escapeHtml(correctLabel)}</strong>
          ${correctItem?.hangul ? `<span>${escapeHtml(correctItem.hangul)}</span>` : ''}
        </div>
      </div>
      ${difference ? `<p>${escapeHtml(difference)}</p>` : ''}
    </section>
  `;
}

function enhanceFeedback(feedback) {
  if (!feedback || feedback.dataset.learningFeedback === 'enhanced') return;
  feedback.dataset.learningFeedback = 'enhanced';
  feedback.classList.add('learning-feedback-enhanced');

  const learning = feedback.querySelector('.feedback-learning');
  const partsRow = feedback.querySelector('.feedback-parts');
  if (!learning || !partsRow) return;

  const result = partsRow.querySelector('b')?.textContent?.trim() || '';
  const parts = [...partsRow.querySelectorAll('i')].map((node) => node.textContent.trim()).filter(Boolean);
  const buildModel = getBuildModel({ hangul: result, parts });

  if (buildModel) {
    partsRow.classList.add('is-replaced-by-build');
    learning.insertAdjacentHTML('afterbegin', buildMarkup(buildModel));
  }

  if (feedback.classList.contains('is-wrong')) {
    const selectedButton = document.querySelector('.choice-button.is-wrong');
    const correctButton = document.querySelector('.choice-button.is-correct');
    const markup = comparisonMarkup({ selectedButton, correctButton });
    if (markup) learning.insertAdjacentHTML('beforeend', markup);
  }
}

function enhanceCurrentView() {
  document.querySelectorAll('.feedback').forEach(enhanceFeedback);
}

function replayBuild(button) {
  const builder = button.closest('.syllable-build');
  if (!builder) return;
  builder.classList.remove('is-replaying');
  requestAnimationFrame(() => {
    void builder.offsetWidth;
    builder.classList.add('is-replaying');
  });
}

function initLearningFeedback() {
  const app = document.querySelector('#app');
  if (!app) return;

  enhanceCurrentView();

  const observer = new MutationObserver(() => enhanceCurrentView());
  observer.observe(app, { childList: true, subtree: true });

  app.addEventListener('click', (event) => {
    const button = event.target.closest('[data-learning-feedback-action="replay"]');
    if (button) replayBuild(button);
  });
}

if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLearningFeedback, { once: true });
  } else {
    initLearningFeedback();
  }
}
