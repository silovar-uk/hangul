import { STAGES, ALL_ITEMS, getStage } from './data.js';
import {
  STORAGE_KEY,
  DAILY_GOAL,
  safeLoadProgress,
  createDefaultProgress,
  getLevelProgress,
  calculateStreak,
  getDailyGoalProgress,
  getItemMastery,
  getStageMastery,
  getWeakItems,
  buildSession,
  createQuestion,
  calculateAnswerScore,
  getSpeedTier,
  updateItemStat,
  applySessionResult,
  evaluateAchievements,
  todayKey
} from './core.js';
import {
  recordConfusionMistake,
  recordConfusionRecovery,
  getConfusionPairItems,
  getConfusionScore,
  getConfusionState,
  getConfusionInsight
} from './confusion-model.js';

const app = document.querySelector('#app');
const ACHIEVEMENTS = {
  'first-run': { icon: '🚩', title: '最初の一歩', copy: 'はじめてのクエストを完走' },
  'combo-5': { icon: '🔥', title: 'ノッてきた', copy: '5コンボを達成' },
  'perfect-run': { icon: '💯', title: 'ノーミス', copy: '正答率100%で完走' },
  'score-5000': { icon: '⚡', title: '読みの冒険者', copy: '累計5,000スコア' },
  'master-10': { icon: '🏅', title: '文字ハンター', copy: '10文字をマスター' }
};

let progress = safeLoadProgress(localStorage.getItem(STORAGE_KEY));
let view = 'home';
let selectedDirection = progress.lastDirection || 'mixed';
let selectedLength = [5, 10, 20].includes(progress.lastLength) ? progress.lastLength : 10;
let statsFilter = 'all';
let session = null;
let toastTimer = null;
let autoAdvanceTimer = null;

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function render() {
  clearTimeout(autoAdvanceTimer);
  if (view === 'game') renderGame();
  else if (view === 'result') renderResult();
  else if (view === 'stats') renderStats();
  else renderHome();
}

function renderHome() {
  const level = getLevelProgress(progress.xp);
  const streak = calculateStreak(progress.activityDates);
  const mastered = ALL_ITEMS.filter((item) => getItemMastery(progress.itemStats[item.id]) >= 75).length;
  const recommendedStage = findRecommendedStage();
  const daily = getDailyGoalProgress(progress);
  const unlockedItems = getUnlockedItems();
  const attemptedItems = unlockedItems.filter((item) => (progress.itemStats[item.id]?.seen ?? 0) > 0);
  const rival = getWeakItems(attemptedItems.length ? attemptedItems : recommendedStage.items, progress.itemStats, 1)[0];
  const rivalStat = rival ? progress.itemStats[rival.id] ?? {} : {};
  const rivalMastery = rival ? getItemMastery(rivalStat) : 0;

  app.innerHTML = `
    <main class="app-shell home-shell">
      ${topbar()}

      ${progress.sessionsPlayed === 0 ? starterGuide() : ''}

      <section class="hero">
        <div class="hero-copy-block">
          <div class="hero-kicker"><span class="live-dot"></span> TODAY'S QUEST</div>
          <h1>${daily.complete ? '今日のノルマ達成。<br>もう一周はボーナス。' : '5問だけ。<br>読める文字を増やそう。'}</h1>
          <p class="hero-copy">意味はあと回し。まずは、文字の形とカタカナの読みを迷わず結びつける。</p>
          <div class="hero-actions">
            <button class="primary-button primary-button--hero" data-action="quick-start" data-stage="${recommendedStage.id}">
              <span>${daily.complete ? 'ボーナス5問' : '今日の5問'}</span><b>→</b>
            </button>
            <button class="secondary-button secondary-button--dark" data-action="weak-start">苦手つぶし</button>
          </div>
        </div>

        <div class="quest-panel" aria-label="今日の学習目標">
          <div class="quest-ring" style="--quest-progress:${Math.round(daily.ratio * 360)}deg">
            <div><strong>${Math.min(daily.answered, DAILY_GOAL)}</strong><span>/${DAILY_GOAL}問</span></div>
          </div>
          <div class="quest-panel-copy">
            <span>DAILY MISSION</span>
            <strong>${daily.complete ? 'クリア済み' : `あと${daily.remaining}問`}</strong>
            <p>${daily.complete ? '今日の記録は保存済み。' : '短く終わらせて、明日また触る。'}</p>
          </div>
        </div>

        <div class="level-panel">
          <div><span>PLAYER LEVEL</span><strong>Lv.${level.level}</strong></div>
          <div class="level-progress-copy"><span>次まで ${Math.max(0, level.required - level.value)} XP</span><b>${Math.round(level.ratio * 100)}%</b></div>
          <div class="progress-track"><div class="progress-fill" style="width:${Math.round(level.ratio * 100)}%"></div></div>
        </div>
      </section>

      <section class="dashboard-grid">
        <button class="rival-card" data-action="weak-start" ${rival ? '' : 'disabled'}>
          <div class="rival-copy"><span>${attemptedItems.length ? 'TODAY’S RIVAL' : 'NEXT TARGET'}</span><strong>${attemptedItems.length ? '今日のライバル文字' : '次に覚える文字'}</strong></div>
          <div class="rival-letter">${rival?.hangul ?? '아'}</div>
          <div class="rival-reading">${rival?.reading ?? 'ア'}</div>
          <div class="rival-meter"><div style="width:${rivalMastery}%"></div></div>
          <small>習熟 ${rivalMastery}%　タップして再戦</small>
        </button>

        <div class="mini-stats">
          ${miniStat('🔥', '連続学習', `${streak}日`)}
          ${miniStat('⚡', '累計スコア', progress.totalScore.toLocaleString())}
          ${miniStat('🏅', 'マスター', `${mastered}/${ALL_ITEMS.length}`)}
          ${miniStat('🎮', '完走', `${progress.sessionsPlayed ?? 0}回`)}
        </div>
      </section>

      <section class="practice-config">
        <div class="section-heading compact-heading">
          <div><span class="section-kicker">PLAY STYLE</span><h2>出題のしかた</h2></div>
          <button class="text-button" data-action="show-stats">成績を見る →</button>
        </div>
        <div class="config-row">
          <div>
            <span class="config-label">出題方向</span>
            <div class="segment-control" role="group" aria-label="出題方向">
              ${directionButton('mixed', 'ミックス')}
              ${directionButton('hangul-to-kana', '文字 → 読み')}
              ${directionButton('kana-to-hangul', '読み → 文字')}
            </div>
          </div>
          <div>
            <span class="config-label">問題数</span>
            <div class="segment-control segment-control--length" role="group" aria-label="問題数">
              ${lengthButton(5, '5問')}
              ${lengthButton(10, '10問')}
              ${lengthButton(20, '20問')}
            </div>
          </div>
        </div>
      </section>

      <div class="section-heading stage-heading">
        <div><span class="section-kicker">STAGE MAP</span><h2>読みのステージ</h2><p>正答率70%以上で次のステージが開く。</p></div>
      </div>
      <section class="stage-grid">
        ${STAGES.map(stageCard).join('')}
      </section>

      <div class="note-box"><b>カタカナは発音の目安。</b> このアプリでは音声を使わず、まず「形を見て読める」ことに集中します。</div>
    </main>
  `;
  bindCommonEvents();
}

function starterGuide() {
  return `
    <section class="starter-guide">
      <div class="starter-title"><span>START HERE</span><strong>このアプリの遊び方</strong></div>
      <div class="starter-steps">
        <div><b>1</b><span>中央の文字を見る</span></div>
        <div><b>2</b><span>読みを4択で選ぶ</span></div>
        <div><b>3</b><span>間違えた文字は再登場</span></div>
      </div>
    </section>
  `;
}

function topbar(back = false) {
  return `
    <header class="topbar">
      <div class="brand">
        ${back ? '<button class="icon-button" data-action="home" aria-label="ホームに戻る">←</button>' : '<div class="brand-mark">한</div>'}
        <div class="brand-text"><strong>ハングル・クエスト</strong><small>READ FIRST, MEANING LATER</small></div>
      </div>
      <div class="topbar-actions">
        ${!back ? '<button class="icon-button icon-button--label" data-action="show-stats" aria-label="成績を見る"><span>成績</span></button>' : ''}
        <button class="icon-button" data-action="settings" aria-label="設定">⚙</button>
      </div>
    </header>
  `;
}

function miniStat(icon, label, value) {
  return `<div class="mini-stat"><span class="mini-stat-icon">${icon}</span><div><small>${label}</small><strong>${value}</strong></div></div>`;
}

function directionButton(value, label) {
  return `<button class="segment-button ${selectedDirection === value ? 'is-active' : ''}" data-action="direction" data-value="${value}">${label}</button>`;
}

function lengthButton(value, label) {
  return `<button class="segment-button ${selectedLength === value ? 'is-active' : ''}" data-action="length" data-value="${value}">${label}</button>`;
}

function findRecommendedStage() {
  const unlocked = STAGES.filter((stage) => stage.number <= progress.unlockedStage);
  return unlocked.find((stage) => getStageMastery(stage, progress.itemStats) < 75)
    ?? unlocked.find((stage) => stage.id === progress.lastStageId)
    ?? unlocked.at(-1)
    ?? STAGES[0];
}

function getUnlockedItems() {
  return STAGES
    .filter((stage) => stage.number <= progress.unlockedStage)
    .flatMap((stage) => stage.items.map((item) => ({ ...item, stageId: stage.id, stageNumber: stage.number })));
}

function stageCard(stage) {
  const unlocked = stage.number <= progress.unlockedStage;
  const mastery = getStageMastery(stage, progress.itemStats);
  const best = progress.stageBest[stage.id] ?? 0;
  const status = mastery >= 75 ? 'MASTER' : best >= 70 ? 'CLEARED' : unlocked ? 'OPEN' : 'LOCKED';
  const stars = best === 100 ? 3 : best >= 85 ? 2 : best >= 70 ? 1 : 0;
  const colors = {
    coral: '#ff9c94', amber: '#ffd36a', mint: '#a9dda9', sky: '#96ceff',
    violet: '#b9a8ff', navy: '#a8badf', rose: '#ecaac3', gold: '#ebc84f'
  };
  return `
    <button class="stage-card ${unlocked ? '' : 'is-locked'}" data-action="stage-start" data-stage="${stage.id}" style="--stage-color:${colors[stage.color]}" ${unlocked ? '' : 'disabled'}>
      <div class="stage-rail"><span>${String(stage.number).padStart(2, '0')}</span><i></i></div>
      <div class="stage-icon">${unlocked ? stage.icon : '🔒'}</div>
      <div class="stage-body">
        <div class="stage-topline"><span class="stage-status status-${status.toLowerCase()}">${status}</span><span class="stage-stars" aria-label="${stars}つ星">${[1,2,3].map((star) => `<i class="${star <= stars ? 'is-on' : ''}">★</i>`).join('')}</span></div>
        <h3>${stage.title}</h3>
        <p>${stage.subtitle}</p>
        <div class="stage-progress-line"><div><span style="width:${mastery}%"></span></div><small>習熟 ${mastery}%</small></div>
      </div>
      <span class="stage-arrow">${unlocked ? '→' : ''}</span>
    </button>
  `;
}

function bindCommonEvents() {
  document.querySelectorAll('[data-action]').forEach((element) => {
    element.addEventListener('click', handleAction);
  });
}

function handleAction(event) {
  const target = event.currentTarget;
  const action = target.dataset.action;
  if (action === 'quick-start') startSession(target.dataset.stage, 5, false);
  if (action === 'stage-start') startSession(target.dataset.stage, selectedLength, false);
  if (action === 'weak-start') startWeakSession();
  if (action === 'confusion-start') startConfusionSession(target.dataset.pair);
  if (action === 'direction') {
    selectedDirection = target.dataset.value;
    progress.lastDirection = selectedDirection;
    saveProgress();
    renderHome();
  }
  if (action === 'length') {
    selectedLength = Number(target.dataset.value);
    progress.lastLength = selectedLength;
    saveProgress();
    renderHome();
  }
  if (action === 'show-stats') { view = 'stats'; render(); }
  if (action === 'home') { view = 'home'; session = null; render(); }
  if (action === 'settings') showSettings();
}

function startSession(stageId, count = 10, weakOnly = false) {
  const stage = getStage(stageId) ?? STAGES[0];
  beginSession({ stage, pool: stage.items, count, weakOnly });
}

function startWeakSession() {
  const unlockedItems = getUnlockedItems();
  const weakItems = getWeakItems(unlockedItems, progress.itemStats, Math.min(8, unlockedItems.length));
  const stage = getStage(weakItems[0]?.stageId) ?? findRecommendedStage();
  const choicePool = [...new Map([...weakItems, ...stage.items].map((item) => [item.id, item])).values()];
  beginSession({ stage, pool: choicePool, forcedItems: weakItems, count: 8, weakOnly: true });
}

function startRivalRematch(items) {
  const stage = getStage(items[0]?.stageId) ?? session?.stage ?? findRecommendedStage();
  const choicePool = [...new Map([...items, ...stage.items].map((item) => [item.id, item])).values()];
  beginSession({ stage, pool: choicePool, forcedItems: items, count: Math.max(5, items.length * 2), weakOnly: true, modeLabel: 'ライバル再戦' });
}

function startConfusionSession(pairKey) {
  const pair = progress.confusionPairs?.[pairKey];
  const items = getConfusionPairItems(pair);
  if (!pair || !items) {
    startWeakSession();
    return;
  }

  const stage = getStage(items.correct.stageId) ?? findRecommendedStage();
  const forcedItems = [items.correct, items.selected, items.correct];
  beginSession({
    stage,
    pool: [items.correct, items.selected],
    forcedItems,
    count: 3,
    weakOnly: true,
    modeLabel: `見分ける：${items.correct.hangul} ↔ ${items.selected.hangul}`,
    directionOverride: 'kana-to-hangul',
    confusionPair: {
      key: pairKey,
      correctId: pair.correctId,
      selectedId: pair.selectedId,
      beforeScore: getConfusionScore(pair, todayKey())
    }
  });
}

function beginSession({ stage, pool, count, weakOnly, forcedItems = null, modeLabel = '', directionOverride = null, confusionPair = null }) {
  const safePool = pool.length >= 2 ? pool : stage.items;
  const sessionDirection = directionOverride ?? selectedDirection;
  const questions = forcedItems?.length
    ? Array.from({ length: count }, (_, index) => createQuestion({
        item: forcedItems[index % forcedItems.length],
        items: safePool,
        direction: sessionDirection,
        index
      }))
    : buildSession({ items: safePool, itemStats: progress.itemStats, count, direction: sessionDirection });
  const initialMastery = Object.fromEntries(safePool.map((item) => [item.id, getItemMastery(progress.itemStats[item.id])]));

  session = {
    stage,
    pool: safePool,
    questions,
    baseCount: count,
    direction: sessionDirection,
    index: 0,
    score: 0,
    combo: 0,
    maxCombo: 0,
    correct: 0,
    wrong: 0,
    focus: 100,
    answered: false,
    selectedChoiceId: null,
    lastAnswerCorrect: null,
    lastPoints: null,
    lastElapsedMs: null,
    lastSpeedTier: null,
    answerStartedAt: performance.now(),
    answerTimes: [],
    misses: [],
    answeredItemIds: new Set(),
    retryScheduled: {},
    retryAdded: 0,
    weakOnly,
    modeLabel,
    confusionPair,
    recoveryRemaining: 0,
    resultApplied: false,
    unlockedBefore: progress.unlockedStage,
    initialMastery,
    newAchievements: [],
    autoAdvanceScheduled: false
  };
  view = 'game';
  render();
}

function renderGame() {
  const question = session.questions[session.index];
  const total = session.questions.length;
  const completed = session.index + (session.answered ? 1 : 0);
  const progressPercent = (completed / total) * 100;
  const recoveryText = session.recoveryRemaining > 0 ? `リカバリー中・あと${session.recoveryRemaining}問` : '';
  const focusState = session.focus <= 35 ? '注意' : session.focus <= 65 ? 'キープ' : '好調';

  app.innerHTML = `
    <main class="app-shell game-shell">
      <header class="game-topbar">
        <button class="close-button" data-action="quit-game" aria-label="ゲームをやめる">×</button>
        <div class="game-progress">
          <div class="game-progress-label"><span>${session.modeLabel || (session.weakOnly ? '苦手つぶし' : session.stage.title)}</span><span>${session.index + 1}/${total}</span></div>
          <div class="progress-track"><div class="progress-fill" style="width:${progressPercent}%"></div></div>
        </div>
        <div class="score-badge"><span>SCORE</span><strong>${session.score.toLocaleString()}</strong></div>
      </header>

      <div class="focus-row">
        <span>FOCUS <b>${focusState}</b></span>
        <div class="focus-track"><div class="focus-fill ${session.focus <= 35 ? 'is-low' : ''}" style="width:${session.focus}%"></div></div>
        <span>${session.focus}</span>
      </div>
      ${recoveryText ? `<div class="recovery-banner">↻ ${recoveryText}</div>` : ''}

      <section class="question-card">
        <div class="question-status-line">
          ${question.isRetry ? '<span class="retry-pill">↻ リベンジ問題</span>' : '<span></span>'}
          ${session.combo >= 2 ? `<span class="combo-pill">🔥 ${session.combo} COMBO</span>` : ''}
        </div>
        <p class="question-label">${question.promptLabel}</p>
        <div class="question-prompt ${question.direction === 'kana-to-hangul' ? 'is-kana' : ''}">${question.prompt}</div>
        <div class="choice-grid">
          ${question.choices.map((choice, index) => choiceButton(choice, index)).join('')}
        </div>
        ${session.answered ? feedbackPanel(question) : '<p class="key-hint">PCでは数字キー 1〜4 でも回答できます</p>'}
      </section>
    </main>
  `;

  document.querySelector('[data-action="quit-game"]').addEventListener('click', quitGame);
  document.querySelectorAll('[data-choice-id]').forEach((button) => {
    button.addEventListener('click', () => answerQuestion(button.dataset.choiceId));
  });
  document.querySelector('[data-action="next-question"]')?.addEventListener('click', nextQuestion);

  if (session.answered) {
    requestAnimationFrame(() => document.querySelector('.feedback')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
    if (progress.settings.autoAdvance && session.lastAnswerCorrect && !session.autoAdvanceScheduled) {
      session.autoAdvanceScheduled = true;
      autoAdvanceTimer = setTimeout(nextQuestion, 950);
    }
  }
}

function choiceButton(choice, index) {
  let stateClass = '';
  if (session.answered) {
    if (choice.isCorrect) stateClass = 'is-correct';
    else if (choice.id === session.selectedChoiceId) stateClass = 'is-wrong';
  }
  return `<button class="choice-button ${stateClass}" data-choice-id="${choice.id}" data-key="${index + 1}" ${session.answered ? 'disabled' : ''}><span>${choice.label}</span></button>`;
}

function feedbackPanel(question) {
  const item = question.item;
  const isCorrect = session.lastAnswerCorrect;
  const correctLabel = question.direction === 'hangul-to-kana' ? item.reading : item.hangul;
  const title = isCorrect ? '正解！' : `正解は「${correctLabel}」`;
  const detail = item.meaning ? `${item.note}　意味：${item.meaning}` : item.note;
  return `
    <div class="feedback ${isCorrect ? 'is-correct' : 'is-wrong'}" aria-live="polite">
      <div class="feedback-result">
        <div class="feedback-mark">${isCorrect ? session.lastSpeedTier.icon : '×'}</div>
        <div>
          <span class="feedback-speed">${session.lastSpeedTier.label}</span>
          <strong>${title}</strong>
        </div>
        <div class="point-pop ${isCorrect ? '' : 'is-zero'}">${isCorrect ? `+${session.lastPoints.score}` : '+0'}<small>pt</small></div>
      </div>
      <div class="feedback-learning">
        <div class="feedback-parts"><b>${item.hangul}</b><span>＝</span>${item.parts.map((part) => `<i>${part}</i>`).join('<span>＋</span>')}</div>
        <p>${detail}</p>
      </div>
      <button class="mini-button" data-action="next-question">${session.index === session.questions.length - 1 ? '結果を見る' : '次の問題へ'} <span>→</span></button>
    </div>
  `;
}

function answerQuestion(choiceId) {
  if (session.answered) return;
  const question = session.questions[session.index];
  const selected = question.choices.find((choice) => choice.id === choiceId);
  const isCorrect = Boolean(selected?.isCorrect);
  const elapsedMs = Math.max(250, performance.now() - session.answerStartedAt);
  const nextCombo = isCorrect ? session.combo + 1 : 0;
  const points = calculateAnswerScore({ isCorrect, elapsedMs, combo: nextCombo });
  const dateKey = todayKey();

  session.answered = true;
  session.selectedChoiceId = choiceId;
  session.lastAnswerCorrect = isCorrect;
  session.lastElapsedMs = elapsedMs;
  session.lastPoints = points;
  session.lastSpeedTier = getSpeedTier(elapsedMs, isCorrect);
  session.answerTimes.push(elapsedMs);
  session.answeredItemIds.add(question.item.id);
  session.autoAdvanceScheduled = false;

  if (isCorrect) {
    session.combo = nextCombo;
    session.maxCombo = Math.max(session.maxCombo, session.combo);
    session.correct += 1;
    session.focus = Math.min(100, session.focus + (session.recoveryRemaining > 0 ? 10 : 5));
    session.score += points.score;
    if (session.recoveryRemaining > 0) session.recoveryRemaining -= 1;
    progress = recordConfusionRecovery(progress, {
      correctId: question.item.id,
      choiceIds: question.choices.map((choice) => choice.id),
      dateKey
    });
  } else {
    session.combo = 0;
    session.wrong += 1;
    session.focus = Math.max(0, session.focus - 24);
    session.misses.push({ ...question.item, stageId: question.item.stageId ?? session.stage.id });
    progress = recordConfusionMistake(progress, {
      correctId: question.item.id,
      selectedId: choiceId,
      dateKey
    });
    if (!question.isRetry && !session.confusionPair) scheduleRetry(question.item);
    if (session.focus === 0) {
      session.focus = 48;
      session.recoveryRemaining = 2;
    }
  }

  progress.itemStats[question.item.id] = updateItemStat(progress.itemStats[question.item.id], isCorrect, elapsedMs, dateKey);
  saveProgress();
  renderGame();
}

function scheduleRetry(item) {
  if (session.retryAdded >= 2 || session.retryScheduled[item.id]) return;
  const insertAt = Math.min(session.index + 3, session.questions.length);
  const retryQuestion = createQuestion({
    item,
    items: session.pool,
    direction: session.direction,
    index: insertAt,
    isRetry: true
  });
  session.questions.splice(insertAt, 0, retryQuestion);
  session.retryScheduled[item.id] = true;
  session.retryAdded += 1;
}

function nextQuestion() {
  clearTimeout(autoAdvanceTimer);
  if (!session?.answered) return;
  if (session.index >= session.questions.length - 1) {
    finishSession();
    return;
  }
  session.index += 1;
  session.answered = false;
  session.selectedChoiceId = null;
  session.lastAnswerCorrect = null;
  session.lastPoints = null;
  session.lastSpeedTier = null;
  session.answerStartedAt = performance.now();
  session.autoAdvanceScheduled = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  renderGame();
}

function finishSession() {
  const total = session.correct + session.wrong;
  const accuracy = total ? Math.round((session.correct / total) * 100) : 0;
  const avgMs = session.answerTimes.length
    ? Math.round(session.answerTimes.reduce((sum, value) => sum + value, 0) / session.answerTimes.length)
    : 0;
  const clearBonus = accuracy === 100 ? 120 : accuracy >= 80 ? 60 : 0;
  session.score += clearBonus;
  const xp = Math.max(10, Math.round(session.score / 10));

  if (!session.resultApplied) {
    if (!session.confusionPair) {
      progress = applySessionResult(progress, {
        stageId: session.stage.id,
        stageNumber: session.stage.number,
        totalStages: STAGES.length,
        accuracy,
        xp,
        score: session.score,
        total,
        correct: session.correct,
        maxCombo: session.maxCombo,
        avgMs,
        direction: session.direction,
        baseCount: session.baseCount
      });
      const evaluated = evaluateAchievements(progress);
      progress = evaluated.progress;
      session.newAchievements = evaluated.newIds;
    }
    session.resultApplied = true;
    saveProgress();
  }
  view = 'result';
  render();
}

function quitGame() {
  if (session.index === 0 && !session.answered) {
    view = 'home'; session = null; render(); return;
  }
  showDialog({
    title: 'ここで終わる？',
    message: 'このプレイのスコアは保存されません。文字ごとの正誤記録はすでに保存されています。',
    confirmLabel: '終了する',
    confirmClass: 'danger-button',
    onConfirm: () => { closeDialog(); view = 'home'; session = null; render(); }
  });
}

function confusionResultSummary() {
  if (!session.confusionPair) return '';
  const pair = progress.confusionPairs?.[session.confusionPair.key];
  const items = getConfusionPairItems(pair ?? session.confusionPair);
  if (!pair || !items) return '';
  const after = getConfusionScore(pair, todayKey());
  const before = session.confusionPair.beforeScore ?? after;
  const state = getConfusionState(pair, todayKey());
  const insight = getConfusionInsight(items.correct, items.selected);
  const stateCopy = state === 'resolved'
    ? 'いったん見分けられる状態になりました。'
    : state === 'recovering'
      ? '混同は弱まりつつあります。次回もう一度確認。'
      : 'まだ混同が残っています。少し時間を空けて再確認。';
  return `
    <section class="confusion-result" aria-label="混同の変化">
      <span>WHAT CHANGED</span>
      <div class="confusion-result-pair"><b>${items.correct.hangul}</b><i>↔</i><b>${items.selected.hangul}</b></div>
      <strong>${insight.dimension}を3問で確認。</strong>
      <p>${insight.clue}</p>
      <div class="confusion-result-delta"><small>混同スコア</small><b>${before} → ${after}</b></div>
      <em>${stateCopy}</em>
    </section>
  `;
}

function renderResult() {
  const total = session.correct + session.wrong;
  const accuracy = total ? Math.round((session.correct / total) * 100) : 0;
  const avgMs = session.answerTimes.length
    ? Math.round(session.answerTimes.reduce((sum, value) => sum + value, 0) / session.answerTimes.length)
    : 0;
  const rank = accuracy === 100 ? 'S' : accuracy >= 90 ? 'A' : accuracy >= 75 ? 'B' : accuracy >= 60 ? 'C' : 'D';
  const uniqueMisses = [...new Map(session.misses.map((item) => [item.id, item])).values()];
  const unlockedNext = !session.confusionPair && progress.unlockedStage > session.unlockedBefore;
  const gains = [...session.answeredItemIds]
    .map((id) => {
      const item = ALL_ITEMS.find((entry) => entry.id === id) ?? session.pool.find((entry) => entry.id === id);
      const before = session.initialMastery[id] ?? 0;
      const after = getItemMastery(progress.itemStats[id]);
      return { item, before, after, gain: after - before };
    })
    .filter((entry) => entry.item && entry.gain > 0)
    .sort((a, b) => b.gain - a.gain)
    .slice(0, 3);
  const daily = getDailyGoalProgress(progress);

  app.innerHTML = `
    <main class="app-shell result-shell">
      ${topbar(true)}
      ${accuracy === 100 && !session.confusionPair ? confetti() : ''}
      <section class="result-card rank-${rank.toLowerCase()}">
        <div class="result-rank"><small>RANK</small><strong>${rank}</strong></div>
        <span class="result-eyebrow">${session.confusionPair ? 'COMPARE COMPLETE' : 'QUEST COMPLETE'}</span>
        <h1>${session.confusionPair ? '違いを見分け直した。' : accuracy === 100 ? 'ノーミス。完全攻略！' : accuracy >= 70 ? 'クエストクリア！' : 'ライバルが見つかった。'}</h1>
        <p>${session.confusionPair ? '点数より、取り違えが弱まったかを見る。' : unlockedNext ? `STAGE ${session.stage.number + 1} が開きました。` : `${session.stage.title}の結果です。`}</p>

        ${confusionResultSummary()}

        <div class="result-stats">
          ${resultStat('スコア', session.score.toLocaleString(), '⚡')}
          ${resultStat('正答率', `${accuracy}%`, '◎')}
          ${resultStat('最大コンボ', session.maxCombo, '🔥')}
          ${resultStat('平均回答', `${(avgMs / 1000).toFixed(1)}秒`, '⏱')}
        </div>

        ${session.confusionPair ? '' : `
          <div class="daily-result ${daily.complete ? 'is-complete' : ''}">
            <div><span>今日のミッション</span><strong>${daily.complete ? 'クリア！' : `あと${daily.remaining}問`}</strong></div>
            <div class="daily-result-track"><span style="width:${daily.ratio * 100}%"></span></div>
            <b>${Math.min(daily.answered, DAILY_GOAL)}/${DAILY_GOAL}</b>
          </div>
        `}

        ${gains.length ? `
          <div class="growth-panel"><h3>伸びた文字</h3><div class="growth-list">
            ${gains.map(({ item, before, after }) => `<div><b>${item.hangul}</b><span>${item.reading}</span><em>${before}% → ${after}%</em><small>習熟 ${after}%</small></div>`).join('')}
          </div></div>
        ` : ''}

        ${uniqueMisses.length ? `
          <div class="weak-list"><div><h3>今回のライバル</h3><p>間違えた文字だけ、すぐ再戦できます。</p></div><div class="weak-tags">${uniqueMisses.map((item) => `<span class="weak-tag"><b>${item.hangul}</b>${item.reading}</span>`).join('')}</div></div>
        ` : '<div class="perfect-panel">🏆 ライバル文字なし。きれいな完走。</div>'}

        ${session.newAchievements.length ? `<div class="achievement-unlocks"><h3>称号を獲得</h3>${session.newAchievements.map(achievementCard).join('')}</div>` : ''}

        <div class="result-actions">
          ${session.confusionPair
            ? '<button class="secondary-button" data-action="retry">もう3問</button>'
            : uniqueMisses.length
              ? '<button class="secondary-button" data-action="rival-rematch">ライバル再戦</button>'
              : '<button class="secondary-button" data-action="retry">もう一度</button>'}
          ${unlockedNext ? '<button class="primary-button" data-action="next-stage">次のステージ <span>→</span></button>' : '<button class="primary-button" data-action="result-home">ホームへ <span>→</span></button>'}
        </div>
      </section>
    </main>
  `;
  bindCommonEvents();
  document.querySelector('[data-action="retry"]')?.addEventListener('click', () => {
    if (session.confusionPair) startConfusionSession(session.confusionPair.key);
    else startSession(session.stage.id, session.baseCount, session.weakOnly);
  });
  document.querySelector('[data-action="rival-rematch"]')?.addEventListener('click', () => startRivalRematch(uniqueMisses));
  document.querySelector('[data-action="next-stage"]')?.addEventListener('click', () => startSession(STAGES[session.stage.number].id, selectedLength, false));
  document.querySelector('[data-action="result-home"]')?.addEventListener('click', () => { view = 'home'; session = null; render(); });
}

function resultStat(label, value, icon) {
  return `<div class="result-stat"><span>${icon} ${label}</span><strong>${value}</strong></div>`;
}

function achievementCard(id) {
  const item = ACHIEVEMENTS[id];
  if (!item) return '';
  return `<div class="achievement-card"><span>${item.icon}</span><div><strong>${item.title}</strong><small>${item.copy}</small></div></div>`;
}

function confetti() {
  return `<div class="confetti" aria-hidden="true">${Array.from({ length: 18 }, (_, index) => `<i style="--i:${index}"></i>`).join('')}</div>`;
}

function renderStats() {
  const entries = ALL_ITEMS
    .map((item) => ({ item, mastery: getItemMastery(progress.itemStats[item.id]), stat: progress.itemStats[item.id] ?? {} }))
    .filter((entry) => (entry.stat.seen ?? 0) > 0);
  const mastered = entries.filter((entry) => entry.mastery >= 75);
  const weak = entries.filter((entry) => entry.mastery < 60);
  const filtered = statsFilter === 'weak' ? weak : statsFilter === 'mastered' ? mastered : entries;
  filtered.sort((a, b) => a.mastery - b.mastery || b.stat.seen - a.stat.seen);
  const totalSeen = entries.reduce((sum, entry) => sum + (entry.stat.seen ?? 0), 0);
  const totalCorrect = entries.reduce((sum, entry) => sum + (entry.stat.correct ?? 0), 0);
  const avgMs = totalSeen
    ? entries.reduce((sum, entry) => sum + (entry.stat.avgMs ?? 0) * (entry.stat.seen ?? 0), 0) / totalSeen
    : 0;

  app.innerHTML = `
    <main class="app-shell stats-page">
      ${topbar(true)}
      <div class="stats-hero"><span class="section-kicker">YOUR RECORD</span><h1>読みの成績</h1><p>回数・正答率・回答速度を合わせて習熟度を計算。</p></div>
      <section class="stats-summary">
        ${resultStat('挑戦した文字', entries.length, '字')}
        ${resultStat('全体正答率', `${totalSeen ? Math.round(totalCorrect / totalSeen * 100) : 0}%`, '◎')}
        ${resultStat('平均回答', `${avgMs ? (avgMs / 1000).toFixed(1) : '0.0'}秒`, '⏱')}
        ${resultStat('マスター', mastered.length, '🏅')}
      </section>
      <div class="stats-toolbar">
        <div class="segment-control">
          ${statsFilterButton('all', `すべて ${entries.length}`)}
          ${statsFilterButton('weak', `苦手 ${weak.length}`)}
          ${statsFilterButton('mastered', `マスター ${mastered.length}`)}
        </div>
      </div>
      <div class="stats-table">
        ${filtered.length ? filtered.map(statsRow).join('') : '<div class="empty-state"><b>まだ該当する文字がありません。</b><span>ホームから5問だけ始めてみよう。</span></div>'}
      </div>
      ${progress.achievements.length ? `<section class="achievement-gallery"><h2>獲得した称号</h2><div>${progress.achievements.map(achievementCard).join('')}</div></section>` : ''}
    </main>
  `;
  bindCommonEvents();
  document.querySelectorAll('[data-stats-filter]').forEach((button) => {
    button.addEventListener('click', () => { statsFilter = button.dataset.statsFilter; renderStats(); });
  });
}

function statsFilterButton(value, label) {
  return `<button class="segment-button ${statsFilter === value ? 'is-active' : ''}" data-stats-filter="${value}">${label}</button>`;
}

function statsRow({ item, mastery, stat }) {
  const accuracy = stat.seen ? Math.round((stat.correct / stat.seen) * 100) : 0;
  const status = mastery >= 75 ? 'マスター' : mastery >= 45 ? '練習中' : 'ライバル';
  return `
    <div class="stats-row">
      <div class="stats-hangul">${item.hangul}</div>
      <div class="stats-info"><div><strong>${item.reading}</strong><span class="stats-status status-${status === 'マスター' ? 'master' : status === '練習中' ? 'learning' : 'rival'}">${status}</span></div><span>${stat.seen}回・正答率${accuracy}%・平均${(stat.avgMs / 1000).toFixed(1)}秒</span></div>
      <div class="stats-meter"><div class="progress-track"><div class="progress-fill" style="width:${mastery}%"></div></div><small>習熟 ${mastery}%</small></div>
    </div>
  `;
}

function showSettings() {
  closeDialog();
  const wrapper = document.createElement('div');
  wrapper.className = 'dialog-backdrop';
  wrapper.dataset.dialog = 'true';
  wrapper.innerHTML = `
    <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <div class="dialog-heading"><div><span>SETTINGS</span><h2 id="settings-title">設定</h2></div><button class="dialog-close" data-dialog-cancel aria-label="閉じる">×</button></div>
      <label class="setting-row">
        <div><strong>正解時に自動で次へ</strong><span>正解の約1秒後に次の問題へ進みます。</span></div>
        <input type="checkbox" data-setting-auto ${progress.settings.autoAdvance ? 'checked' : ''}>
      </label>
      <div class="storage-note"><b>この端末だけに保存</b><span>音声・ログイン・外部通信は使いません。</span></div>
      <button class="reset-link" data-reset-progress>学習記録をリセット</button>
    </div>
  `;
  document.body.append(wrapper);
  wrapper.querySelector('[data-dialog-cancel]').addEventListener('click', closeDialog);
  wrapper.querySelector('[data-setting-auto]').addEventListener('change', (event) => {
    progress.settings.autoAdvance = event.target.checked;
    saveProgress();
    showToast(event.target.checked ? '自動送りをオンにしました' : '自動送りをオフにしました');
  });
  wrapper.querySelector('[data-reset-progress]').addEventListener('click', () => {
    closeDialog();
    showDialog({
      title: '学習記録をリセット？',
      message: 'スコア、ステージ、文字ごとの成績がすべて最初の状態に戻ります。',
      confirmLabel: 'リセットする',
      confirmClass: 'danger-button',
      onConfirm: () => {
        progress = createDefaultProgress();
        selectedDirection = 'mixed';
        selectedLength = 10;
        saveProgress();
        closeDialog();
        view = 'home';
        session = null;
        render();
        showToast('学習記録をリセットしました');
      }
    });
  });
  wrapper.addEventListener('click', (event) => { if (event.target === wrapper) closeDialog(); });
}

function showDialog({ title, message, confirmLabel, confirmClass = '', onConfirm }) {
  closeDialog();
  const wrapper = document.createElement('div');
  wrapper.className = 'dialog-backdrop';
  wrapper.dataset.dialog = 'true';
  wrapper.innerHTML = `
    <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
      <h2 id="dialog-title">${title}</h2>
      <p>${message}</p>
      <div class="dialog-actions">
        <button class="secondary-button" data-dialog-cancel>キャンセル</button>
        <button class="secondary-button ${confirmClass}" data-dialog-confirm>${confirmLabel}</button>
      </div>
    </div>
  `;
  document.body.append(wrapper);
  wrapper.querySelector('[data-dialog-cancel]').addEventListener('click', closeDialog);
  wrapper.querySelector('[data-dialog-confirm]').addEventListener('click', onConfirm);
  wrapper.addEventListener('click', (event) => { if (event.target === wrapper) closeDialog(); });
}

function closeDialog() {
  document.querySelector('[data-dialog="true"]')?.remove();
}

function showToast(message) {
  document.querySelector('.toast')?.remove();
  const element = document.createElement('div');
  element.className = 'toast';
  element.textContent = message;
  document.body.append(element);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.remove(), 2200);
}

window.addEventListener('keydown', (event) => {
  if (document.querySelector('[data-dialog="true"]')) {
    if (event.key === 'Escape') closeDialog();
    return;
  }
  if (view !== 'game' || !session) return;
  if (!session.answered && ['1', '2', '3', '4'].includes(event.key)) {
    const question = session.questions[session.index];
    const choice = question.choices[Number(event.key) - 1];
    if (choice) answerQuestion(choice.id);
  } else if (session.answered && event.key === 'Enter') {
    nextQuestion();
  } else if (event.key === 'Escape') {
    quitGame();
  }
});

render();