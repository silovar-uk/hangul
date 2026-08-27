import { STORAGE_KEY, safeLoadProgress, todayKey } from './core.js';
import {
  confusionKey,
  recordConfusionMistake,
  recordConfusionRecovery
} from './confusion-model.js';

const app = document.querySelector('#app');
const pendingByCorrect = new Map();
let lastChoiceIds = [];

function loadProgress() {
  return safeLoadProgress(localStorage.getItem(STORAGE_KEY));
}

function saveProgress(progress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function observeFeedback() {
  const feedback = app?.querySelector('.game-shell .feedback:not([data-confusion-observed])');
  if (!feedback) return;
  feedback.dataset.confusionObserved = 'true';

  const correctButton = app.querySelector('.game-shell .choice-button.is-correct');
  const correctId = correctButton?.dataset.choiceId;
  if (!correctId) return;

  const dateKey = todayKey();
  if (feedback.classList.contains('is-wrong')) {
    const wrongButton = app.querySelector('.game-shell .choice-button.is-wrong');
    const selectedId = wrongButton?.dataset.choiceId;
    if (!selectedId || selectedId === correctId) return;

    let progress = loadProgress();
    progress = recordConfusionMistake(progress, { correctId, selectedId, dateKey });
    saveProgress(progress);
    pendingByCorrect.set(correctId, { selectedId, choiceIds: lastChoiceIds });
    feedback.dataset.confusionPair = confusionKey(correctId, selectedId);
    return;
  }

  const pending = pendingByCorrect.get(correctId);
  if (!pending) return;
  if (lastChoiceIds.length && !lastChoiceIds.includes(pending.selectedId)) return;

  let progress = loadProgress();
  progress = recordConfusionRecovery(progress, {
    correctId,
    choiceIds: [pending.selectedId],
    dateKey
  });
  saveProgress(progress);
  pendingByCorrect.delete(correctId);
  feedback.dataset.confusionRecovered = confusionKey(correctId, pending.selectedId);
}

if (app) {
  app.addEventListener('click', (event) => {
    const choice = event.target.closest('.game-shell [data-choice-id]');
    if (!choice) return;
    lastChoiceIds = [...app.querySelectorAll('.game-shell [data-choice-id]')]
      .map((node) => node.dataset.choiceId)
      .filter(Boolean);
  }, true);

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      observeFeedback();
    });
  });
  observer.observe(app, { childList: true, subtree: true });
  requestAnimationFrame(observeFeedback);
}
