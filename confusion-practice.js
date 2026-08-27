import { STORAGE_KEY, safeLoadProgress, todayKey, updateItemStat } from './core.js';
import {
  getConfusionPairItems,
  getConfusionInsight,
  getConfusionState,
  getConfusionScore,
  recordConfusionMistake,
  recordConfusionRecovery
} from './confusion-model.js';

const app = document.querySelector('#app');
let practice = null;

function loadProgress() {
  return safeLoadProgress(localStorage.getItem(STORAGE_KEY));
}

function saveProgress(progress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function currentPair(progress, key) {
  const pair = progress.confusionPairs?.[key];
  return pair ? { key, ...pair } : null;
}

function makeRounds(correct, selected) {
  return [correct, selected, correct].map((target, index) => ({
    target,
    other: target.id === correct.id ? selected : correct,
    flip: index % 2 === 1
  }));
}

function startPractice(key) {
  const progress = loadProgress();
  const pair = currentPair(progress, key);
  const items = getConfusionPairItems(pair);
  if (!pair || !items) return;

  practice = {
    key,
    originalPair: pair,
    items,
    rounds: makeRounds(items.correct, items.selected),
    index: 0,
    correct: 0,
    answered: false,
    selectedId: null,
    startedAt: performance.now()
  };
  renderPractice();
}

function pairHeader() {
  const { correct, selected } = practice.items;
  const insight = getConfusionInsight(correct, selected);
  return `
    <div class="confusion-practice-intro">
      <span>CONFUSION PRACTICE</span>
      <h1>${correct.hangul} <i>↔</i> ${selected.hangul}</h1>
      <p><b>${insight.dimension}</b>${insight.clue}</p>
    </div>
  `;
}

function renderPractice() {
  if (!practice || !app) return;
  const round = practice.rounds[practice.index];
  const progress = Math.round((practice.index / practice.rounds.length) * 100);
  const choices = round.flip ? [round.other, round.target] : [round.target, round.other];

  app.innerHTML = `
    <main class="app-shell confusion-practice-shell">
      <header class="confusion-practice-topbar">
        <button type="button" class="close-button" data-confusion-close aria-label="ホームに戻る">×</button>
        <div><span>${practice.index + 1}/${practice.rounds.length}</span><div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div></div>
      </header>
      ${pairHeader()}
      <section class="confusion-question" aria-live="polite">
        <span class="confusion-question-label">この読みになる文字は？</span>
        <strong class="confusion-question-prompt">${round.target.reading}</strong>
        <div class="confusion-choice-grid">
          ${choices.map((item) => `<button type="button" class="confusion-choice" data-confusion-choice="${item.id}">${item.hangul}<small>${item.reading}</small></button>`).join('')}
        </div>
      </section>
    </main>
  `;

  app.querySelector('[data-confusion-close]')?.addEventListener('click', () => location.reload());
  app.querySelectorAll('[data-confusion-choice]').forEach((button) => {
    button.addEventListener('click', () => answer(button.dataset.confusionChoice));
  });
}

function answer(selectedId) {
  if (!practice || practice.answered) return;
  practice.answered = true;
  practice.selectedId = selectedId;
  const round = practice.rounds[practice.index];
  const isCorrect = selectedId === round.target.id;
  const elapsedMs = Math.max(250, performance.now() - practice.startedAt);
  const dateKey = todayKey();
  let progress = loadProgress();

  progress.itemStats[round.target.id] = updateItemStat(
    progress.itemStats[round.target.id],
    isCorrect,
    elapsedMs,
    dateKey
  );

  if (isCorrect) {
    practice.correct += 1;
    progress = recordConfusionRecovery(progress, {
      correctId: round.target.id,
      choiceIds: [round.other.id],
      dateKey
    });
  } else {
    progress = recordConfusionMistake(progress, {
      correctId: round.target.id,
      selectedId,
      dateKey
    });
  }
  saveProgress(progress);
  renderAnswer(isCorrect, round, progress);
}

function renderAnswer(isCorrect, round, progress) {
  const card = app?.querySelector('.confusion-question');
  if (!card) return;
  const insight = getConfusionInsight(round.target, round.other);
  const pair = currentPair(progress, practice.key);
  const state = pair ? getConfusionState(pair, todayKey()) : 'resolved';

  card.innerHTML = `
    <div class="confusion-answer ${isCorrect ? 'is-correct' : 'is-wrong'}">
      <span>${isCorrect ? '見分けた' : 'ここを見る'}</span>
      <strong>${round.target.hangul} <i>↔</i> ${round.other.hangul}</strong>
      <p><b>${insight.dimension}</b>${insight.clue}</p>
      <small>${state === 'active' ? 'まだ混同しやすい組です。' : state === 'recovering' ? '見分け直し中です。' : '区別が安定してきました。'}</small>
    </div>
    <button type="button" class="primary-button confusion-next" data-confusion-next>${practice.index === practice.rounds.length - 1 ? '結果を見る' : '次の1問'} <span>→</span></button>
  `;
  card.querySelector('[data-confusion-next]')?.addEventListener('click', nextRound);
}

function nextRound() {
  if (!practice) return;
  if (practice.index >= practice.rounds.length - 1) {
    renderResult();
    return;
  }
  practice.index += 1;
  practice.answered = false;
  practice.selectedId = null;
  practice.startedAt = performance.now();
  renderPractice();
}

function renderResult() {
  const progress = loadProgress();
  const pair = currentPair(progress, practice.key);
  const state = pair ? getConfusionState(pair, todayKey()) : 'resolved';
  const score = pair ? getConfusionScore(pair, todayKey()) : 0;
  const { correct, selected } = practice.items;
  const title = state === 'resolved'
    ? 'この2文字、いったん卒業。'
    : state === 'recovering'
      ? '見分け方が戻ってきた。'
      : '違いをもう一度確認できた。';

  app.innerHTML = `
    <main class="app-shell confusion-practice-shell">
      <section class="confusion-practice-result" aria-live="polite">
        <span>WHAT CHANGED?</span>
        <h1>${title}</h1>
        <div class="confusion-result-pair">${correct.hangul} <i>↔</i> ${selected.hangul}</div>
        <p>3問中 <b>${practice.correct}問</b> 見分けました。</p>
        <small>混同スコア ${score}・${state === 'active' ? '要復習' : state === 'recovering' ? '回復中' : '安定'}</small>
        <button type="button" class="primary-button" data-confusion-home>ホームへ <span>→</span></button>
      </section>
    </main>
  `;
  app.querySelector('[data-confusion-home]')?.addEventListener('click', () => location.reload());
}

document.addEventListener('click', (event) => {
  const trigger = event.target.closest('[data-action="confusion-start"][data-pair]');
  if (!trigger) return;
  event.preventDefault();
  startPractice(trigger.dataset.pair);
});
