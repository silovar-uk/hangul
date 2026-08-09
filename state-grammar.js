const app = document.querySelector('#app');

const HOME_SNAPSHOT_KEY = 'hangulQuest.homeSnapshot.v1';
const TEMPORAL_TTL = 1900;
const STATE_CLASSES = ['ui-state-current', 'ui-state-complete', 'ui-state-available', 'ui-state-locked'];
let temporalCleanupTimer = null;

function firstNumber(value = '') {
  const match = String(value).replaceAll(',', '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function miniStat(home, label) {
  return [...home.querySelectorAll('.mini-stat')].find((stat) =>
    stat.querySelector('small')?.textContent?.includes(label)
  ) ?? null;
}

function miniStatValue(home, label) {
  return firstNumber(miniStat(home, label)?.querySelector('strong')?.textContent ?? '0');
}

function stageIds(home, state) {
  return [...home.querySelectorAll(`.quest-map .stage-card[data-map-state="${state}"]`)]
    .map((card) => card.dataset.stage)
    .filter(Boolean);
}

function readSnapshot(home) {
  const progressCopy = home.querySelector('.quest-board-progress-copy');
  const current = home.querySelector('.quest-map .stage-card[data-map-state="current"]');
  const unlocked = [...home.querySelectorAll('.quest-map .stage-card[data-map-state]')]
    .filter((card) => card.dataset.mapState !== 'locked')
    .map((card) => card.dataset.stage)
    .filter(Boolean);

  return {
    dailyAnswered: firstNumber(progressCopy?.querySelector('strong')?.textContent ?? '0'),
    dailyComplete: /クリア|完了/.test(progressCopy?.querySelector('small')?.textContent ?? ''),
    currentStage: current?.dataset.stage ?? '',
    unlockedStages: unlocked,
    completeStages: stageIds(home, 'complete'),
    sessionsPlayed: miniStatValue(home, '完走'),
    mastered: miniStatValue(home, 'マスター')
  };
}

function loadSnapshot() {
  try {
    const raw = sessionStorage.getItem(HOME_SNAPSHOT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSnapshot(snapshot) {
  try {
    sessionStorage.setItem(HOME_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    // State feedback is optional. The app remains fully usable without sessionStorage.
  }
}

function applyStateGrammar(home) {
  home.dataset.uiGrammar = 'state-v1';

  const board = home.querySelector('.quest-board');
  if (board) board.dataset.uiRole = 'quest';

  const primary = home.querySelector('.quest-board-action');
  if (primary) primary.dataset.uiPriority = 'primary';

  home.querySelectorAll('.system-nav-button').forEach((button) => {
    button.dataset.uiPriority = 'quiet';
  });
  home.querySelectorAll('.text-button').forEach((button) => {
    button.dataset.uiPriority = 'quiet';
  });

  const roles = [
    ['.quest-map', 'route'],
    ['.discovery-notes', 'discovery'],
    ['.quiet-record', 'record'],
    ['.practice-surface', 'practice']
  ];
  roles.forEach(([selector, role]) => {
    const section = home.querySelector(selector);
    if (section) section.dataset.uiRole = role;
  });

  home.querySelectorAll('.quest-map .stage-card[data-map-state]').forEach((card) => {
    const state = card.dataset.mapState || 'available';
    card.classList.remove(...STATE_CLASSES);
    card.classList.add(`ui-state-${state}`);
    card.dataset.uiState = state;

    if (state === 'current') {
      card.setAttribute('aria-current', 'step');
      card.dataset.uiPriority = 'secondary';
    } else {
      card.removeAttribute('aria-current');
      card.dataset.uiPriority = state === 'locked' ? 'quiet' : 'normal';
    }

    if (state === 'locked') card.setAttribute('aria-disabled', 'true');
    else card.removeAttribute('aria-disabled');

    const glyph = card.querySelector('.stage-icon');
    if (glyph) glyph.dataset.uiEmphasis = state === 'current' ? 'strong' : state === 'complete' ? 'quiet' : 'normal';
  });
}

function announce(message) {
  if (!message) return;
  let announcer = document.querySelector('.temporal-announcer');
  if (!announcer) {
    announcer = document.createElement('div');
    announcer.className = 'temporal-announcer';
    announcer.setAttribute('role', 'status');
    announcer.setAttribute('aria-live', 'polite');
    announcer.setAttribute('aria-atomic', 'true');
    document.body.append(announcer);
  }
  announcer.textContent = '';
  requestAnimationFrame(() => { announcer.textContent = message; });
}

function returnMessage(previous, current, newlyUnlocked, newlyComplete) {
  if (newlyUnlocked.length) return '次のステージが開きました。';
  if (previous.currentStage && current.currentStage && previous.currentStage !== current.currentStage) return '現在地が進みました。';
  if (!previous.dailyComplete && current.dailyComplete) return '今日の5問、クリア。';
  const dailyDelta = current.dailyAnswered - previous.dailyAnswered;
  if (dailyDelta > 0) return `今日の進捗が${dailyDelta}問進みました。`;
  const masteredDelta = current.mastered - previous.mastered;
  if (masteredDelta > 0) return `マスターが${masteredDelta}増えました。`;
  if (current.sessionsPlayed > previous.sessionsPlayed) return '学習記録を更新しました。';
  if (newlyComplete.length) return 'ステージの記録を更新しました。';
  return '';
}

function clearTemporalClasses(home) {
  home.classList.remove('has-temporal-return');
  home.querySelector('.quest-board')?.classList.remove('is-temporal-updated');
  home.querySelector('.route-rail')?.classList.remove('is-temporal-updated');
  home.querySelectorAll('.is-newly-done, .is-newly-unlocked, .is-newly-complete, .is-new-current, .is-temporal-updated')
    .forEach((element) => {
      element.classList.remove('is-newly-done', 'is-newly-unlocked', 'is-newly-complete', 'is-new-current', 'is-temporal-updated');
      element.style.removeProperty('--temporal-index');
    });
}

function applyTemporalFeedback(home) {
  const current = readSnapshot(home);
  const previous = loadSnapshot();
  saveSnapshot(current);
  if (!previous) return;

  const newlyUnlocked = current.unlockedStages.filter((id) => !previous.unlockedStages?.includes(id));
  const newlyComplete = current.completeStages.filter((id) => !previous.completeStages?.includes(id));
  const dailyDelta = current.dailyAnswered - (previous.dailyAnswered ?? 0);
  const sessionDelta = current.sessionsPlayed - (previous.sessionsPlayed ?? 0);
  const masteredDelta = current.mastered - (previous.mastered ?? 0);
  const currentChanged = Boolean(previous.currentStage && current.currentStage && previous.currentStage !== current.currentStage);

  const hasPositiveChange = dailyDelta > 0
    || sessionDelta > 0
    || masteredDelta > 0
    || newlyUnlocked.length > 0
    || newlyComplete.length > 0
    || currentChanged
    || (!previous.dailyComplete && current.dailyComplete);

  if (!hasPositiveChange) return;

  clearTimeout(temporalCleanupTimer);
  clearTemporalClasses(home);
  home.classList.add('has-temporal-return');

  const board = home.querySelector('.quest-board');
  if (dailyDelta > 0 || newlyUnlocked.length || currentChanged) board?.classList.add('is-temporal-updated');

  if (dailyDelta > 0) {
    const dots = [...home.querySelectorAll('.quest-board-dots i')];
    const start = Math.max(0, previous.dailyAnswered ?? 0);
    const end = Math.min(current.dailyAnswered, dots.length);
    dots.slice(start, end).forEach((dot, index) => {
      dot.classList.add('is-newly-done');
      dot.style.setProperty('--temporal-index', index);
    });
  }

  newlyUnlocked.forEach((stageId) => {
    home.querySelector(`.stage-card[data-stage="${CSS.escape(stageId)}"]`)?.classList.add('is-newly-unlocked');
  });
  newlyComplete.forEach((stageId) => {
    home.querySelector(`.stage-card[data-stage="${CSS.escape(stageId)}"]`)?.classList.add('is-newly-complete');
  });

  if (currentChanged) {
    home.querySelector('.stage-card[data-map-state="current"]')?.classList.add('is-new-current');
  }
  if (newlyUnlocked.length || newlyComplete.length || currentChanged) {
    home.querySelector('.route-rail')?.classList.add('is-temporal-updated');
  }

  if (sessionDelta > 0) miniStat(home, '完走')?.classList.add('is-temporal-updated');
  if (masteredDelta > 0) miniStat(home, 'マスター')?.classList.add('is-temporal-updated');

  announce(returnMessage(previous, current, newlyUnlocked, newlyComplete));

  temporalCleanupTimer = setTimeout(() => {
    const latestHome = app?.querySelector('.home-shell');
    if (latestHome === home) clearTemporalClasses(home);
  }, TEMPORAL_TTL);
}

function enhanceHome() {
  const home = app?.querySelector('.home-shell.playable-home');
  if (!home) return;
  if (!home.querySelector('.quest-board') || !home.querySelector('.quest-map .stage-card[data-map-state]')) return;

  applyStateGrammar(home);
  applyTemporalFeedback(home);
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
