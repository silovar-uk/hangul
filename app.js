import { STAGES, ALL_ITEMS, getStage } from './data.js';
import {
  STORAGE_KEY,
  safeLoadProgress,
  createDefaultProgress,
  getLevelProgress,
  calculateStreak,
  getItemMastery,
  getStageMastery,
  getWeakItems,
  buildSession,
  calculateAnswerScore,
  updateItemStat,
  applySessionResult,
  todayKey
} from './core.js';

const app = document.querySelector('#app');
let progress = safeLoadProgress(localStorage.getItem(STORAGE_KEY));
let view = 'home';
let selectedDirection = progress.lastDirection || 'mixed';
let session = null;
let toastTimer = null;

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function render() {
  if (view === 'game') renderGame();
  else if (view === 'result') renderResult();
  else if (view === 'stats') renderStats();
  else renderHome();
}

function renderHome() {
  const level = getLevelProgress(progress.xp);
  const streak = calculateStreak(progress.activityDates);
  const mastered = ALL_ITEMS.filter((item) => getItemMastery(progress.itemStats[item.id]) >= 75).length;
  const recommendedStage = STAGES.find((stage) => stage.number === progress.unlockedStage) ?? STAGES[0];
  const todayActive = progress.activityDates.includes(todayKey());

  app.innerHTML = `
    <main class="app-shell">
      ${topbar()}
      <section class="hero">
        <div>
          <p class="eyebrow">TODAY'S QUEST</p>
          <h1>${todayActive ? '今日も、もう一周だけ。' : '5問だけ。読める文字を増やそう。'}</h1>
          <p class="hero-copy">意味はまだ覚えなくてOK。ハングルの形とカタカナの読みを、短いゲームで結びつけます。</p>
          <div class="hero-actions">
            <button class="primary-button" data-action="quick-start" data-stage="${recommendedStage.id}">今日の5問</button>
            <button class="secondary-button" data-action="weak-start">苦手つぶし</button>
          </div>
        </div>
        <div class="hero-progress">
          <div>
            <span>PLAYER LEVEL</span>
            <strong>Lv.${level.level}</strong>
          </div>
          <div>
            <span>次のレベルまで ${Math.max(0, level.required - level.value)} XP</span>
            <div class="progress-track"><div class="progress-fill" style="width:${Math.round(level.ratio * 100)}%"></div></div>
          </div>
        </div>
      </section>

      <section class="stats-strip" aria-label="学習状況">
        ${statCard('今日', todayActive ? 'クリア' : '未挑戦')}
        ${statCard('連続学習', `${streak}日`)}
        ${statCard('累計スコア', progress.totalScore.toLocaleString())}
        ${statCard('マスター', `${mastered}/${ALL_ITEMS.length}`)}
      </section>

      <div class="section-heading">
        <div><h2>読み方を選ぶ</h2><p>出題方向はいつでも変えられます。</p></div>
      </div>
      <div class="direction-control" role="group" aria-label="出題方向">
        ${directionButton('mixed', 'ミックス')}
        ${directionButton('hangul-to-kana', 'ハングル → カタカナ')}
        ${directionButton('kana-to-hangul', 'カタカナ → ハングル')}
      </div>

      <div class="section-heading">
        <div><h2>ステージ</h2><p>70%以上で次のステージが開きます。</p></div>
        <button class="ghost-button" data-action="show-stats" style="padding:10px 14px;font-weight:800;">成績を見る</button>
      </div>
      <section class="stage-grid">
        ${STAGES.map(stageCard).join('')}
      </section>

      <div class="note-box">カタカナ表記は発音の目安です。この版では音声を使わず、まず「文字を見分けて読める」ことに集中します。</div>
    </main>
  `;
  bindCommonEvents();
}

function topbar(back = false) {
  return `
    <header class="topbar">
      <div class="brand">
        ${back ? '<button class="icon-button" data-action="home" aria-label="ホームに戻る">←</button>' : '<div class="brand-mark">한</div>'}
        <div class="brand-text">ハングル・クエスト<small>READ FIRST, MEANING LATER</small></div>
      </div>
      <button class="icon-button" data-action="settings" aria-label="設定">⚙</button>
    </header>
  `;
}

function statCard(label, value) {
  return `<div class="stat-card"><span>${label}</span><strong>${value}</strong></div>`;
}

function directionButton(value, label) {
  return `<button class="segment-button ${selectedDirection === value ? 'is-active' : ''}" data-action="direction" data-value="${value}">${label}</button>`;
}

function stageCard(stage) {
  const unlocked = stage.number <= progress.unlockedStage;
  const mastery = getStageMastery(stage, progress.itemStats);
  const best = progress.stageBest[stage.id] ?? 0;
  const dotClass = mastery >= 75 ? 'is-mastered' : mastery > 0 ? 'is-learning' : '';
  const colors = {
    coral: '#ffaaa4', amber: '#ffd77b', mint: '#bce5bd', sky: '#a9d8ff',
    violet: '#c7bbff', navy: '#b7c4e3', rose: '#f3b5cc', gold: '#f2cf63'
  };
  return `
    <button class="stage-card" data-action="stage-start" data-stage="${stage.id}" style="--stage-color:${colors[stage.color]}" ${unlocked ? '' : 'disabled'}>
      <div class="stage-icon">${unlocked ? stage.icon : '🔒'}</div>
      <div>
        <span class="stage-number">STAGE ${String(stage.number).padStart(2, '0')}</span>
        <h3>${stage.title}</h3>
        <p>${stage.subtitle}</p>
        <div class="stage-meta"><span class="mastery-dot ${dotClass}"></span><span>習熟 ${mastery}%</span><span>ベスト ${best}%</span></div>
      </div>
      <span class="stage-arrow">${unlocked ? '›' : ''}</span>
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
  if (action === 'stage-start') startSession(target.dataset.stage, 10, false);
  if (action === 'weak-start') startWeakSession();
  if (action === 'direction') {
    selectedDirection = target.dataset.value;
    progress.lastDirection = selectedDirection;
    saveProgress();
    renderHome();
  }
  if (action === 'show-stats') { view = 'stats'; render(); }
  if (action === 'home') { view = 'home'; session = null; render(); }
  if (action === 'settings') showSettings();
}

function startSession(stageId, count = 10, weakOnly = false) {
  const stage = getStage(stageId) ?? STAGES[0];
  const pool = weakOnly ? getWeakItems(stage.items, progress.itemStats, Math.max(4, stage.items.length)) : stage.items;
  beginSession({ stage, pool, count, weakOnly });
}

function startWeakSession() {
  const unlockedItems = STAGES
    .filter((stage) => stage.number <= progress.unlockedStage)
    .flatMap((stage) => stage.items.map((item) => ({ ...item, stageId: stage.id })));
  const pool = getWeakItems(unlockedItems, progress.itemStats, Math.min(12, unlockedItems.length));
  const fallbackStage = getStage(pool[0]?.stageId) ?? STAGES[0];
  beginSession({ stage: fallbackStage, pool: pool.length >= 4 ? pool : fallbackStage.items, count: 8, weakOnly: true });
}

function beginSession({ stage, pool, count, weakOnly }) {
  const questions = buildSession({ items: pool, itemStats: progress.itemStats, count, direction: selectedDirection });
  session = {
    stage,
    pool,
    questions,
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
    answerStartedAt: performance.now(),
    misses: [],
    weakOnly,
    recoveryRemaining: 0,
    resultApplied: false
  };
  view = 'game';
  render();
}

function renderGame() {
  const question = session.questions[session.index];
  const total = session.questions.length;
  const progressPercent = (session.index / total) * 100;
  const answer = session.answered ? question.item : null;
  const recoveryText = session.recoveryRemaining > 0 ? `復習モード：あと${session.recoveryRemaining}問` : '';

  app.innerHTML = `
    <main class="app-shell game-shell">
      <header class="game-topbar">
        <button class="close-button" data-action="quit-game" aria-label="ゲームをやめる">×</button>
        <div class="game-progress">
          <div class="game-progress-label"><span>${session.weakOnly ? '苦手つぶし' : session.stage.title}</span><span>${session.index + 1}/${total}</span></div>
          <div class="progress-track"><div class="progress-fill" style="width:${progressPercent}%"></div></div>
        </div>
        <div class="score-badge"><span>SCORE</span><strong>${session.score.toLocaleString()}</strong></div>
      </header>
      <div class="focus-row"><span>集中</span><div class="focus-track"><div class="focus-fill ${session.focus <= 35 ? 'is-low' : ''}" style="width:${session.focus}%"></div></div><span>${session.focus}%</span></div>
      ${recoveryText ? `<div class="recovery-banner">${recoveryText}</div>` : ''}

      <section class="question-card">
        ${session.combo >= 2 ? `<div class="combo-pill">🔥 ${session.combo} COMBO</div>` : ''}
        <p class="question-label">${question.promptLabel}</p>
        <div class="question-prompt ${question.direction === 'kana-to-hangul' ? 'is-kana' : ''}">${question.prompt}</div>
        <div class="choice-grid">
          ${question.choices.map((choice, index) => choiceButton(choice, index)).join('')}
        </div>
        ${session.answered ? feedbackPanel(answer) : ''}
      </section>
    </main>
  `;

  document.querySelector('[data-action="quit-game"]').addEventListener('click', quitGame);
  document.querySelectorAll('[data-choice-id]').forEach((button) => {
    button.addEventListener('click', () => answerQuestion(button.dataset.choiceId));
  });
  document.querySelector('[data-action="next-question"]')?.addEventListener('click', nextQuestion);
}

function choiceButton(choice, index) {
  let stateClass = '';
  if (session.answered) {
    if (choice.isCorrect) stateClass = 'is-correct';
    else if (choice.id === session.selectedChoiceId) stateClass = 'is-wrong';
  }
  return `<button class="choice-button ${stateClass}" data-choice-id="${choice.id}" data-key="${index + 1}" ${session.answered ? 'disabled' : ''}>${choice.label}</button>`;
}

function feedbackPanel(item) {
  const isCorrect = session.lastAnswerCorrect;
  const title = isCorrect ? '正解！' : `正解は「${item.reading}」`;
  const detail = item.meaning ? `${item.note}　意味：${item.meaning}` : item.note;
  return `
    <div class="feedback ${isCorrect ? 'is-correct' : 'is-wrong'}">
      <div class="feedback-mark">${isCorrect ? '○' : '×'}</div>
      <div>
        <strong>${title}</strong>
        <div class="feedback-parts">${item.hangul} ＝ ${item.parts.join(' ＋ ')}</div>
        <p>${detail}</p>
      </div>
      <button class="mini-button" data-action="next-question">${session.index === session.questions.length - 1 ? '結果へ' : '次へ'}</button>
    </div>
  `;
}

function answerQuestion(choiceId) {
  if (session.answered) return;
  const question = session.questions[session.index];
  const selected = question.choices.find((choice) => choice.id === choiceId);
  const isCorrect = Boolean(selected?.isCorrect);
  const elapsedMs = Math.max(250, performance.now() - session.answerStartedAt);

  session.answered = true;
  session.selectedChoiceId = choiceId;
  session.lastAnswerCorrect = isCorrect;

  if (isCorrect) {
    session.combo += 1;
    session.maxCombo = Math.max(session.maxCombo, session.combo);
    session.correct += 1;
    session.focus = Math.min(100, session.focus + 4);
    const points = calculateAnswerScore({ isCorrect, elapsedMs, combo: session.combo });
    session.score += points.score;
    if (session.recoveryRemaining > 0) session.recoveryRemaining -= 1;
  } else {
    session.combo = 0;
    session.wrong += 1;
    session.focus = Math.max(0, session.focus - 25);
    session.misses.push(question.item);
    if (session.focus === 0) {
      session.focus = 45;
      session.recoveryRemaining = 2;
      forceRecoveryQuestions(question.item);
    }
  }

  progress.itemStats[question.item.id] = updateItemStat(progress.itemStats[question.item.id], isCorrect, elapsedMs);
  saveProgress();
  renderGame();
}

function forceRecoveryQuestions(fallbackItem) {
  const weak = getWeakItems(session.pool, progress.itemStats, 2);
  for (let offset = 1; offset <= 2; offset += 1) {
    const index = session.index + offset;
    if (index >= session.questions.length) break;
    const item = weak[offset - 1] ?? fallbackItem;
    const replacement = buildSession({
      items: session.pool,
      itemStats: { ...progress.itemStats, [item.id]: { ...(progress.itemStats[item.id] ?? {}), wrong: 99 } },
      count: 1,
      direction: selectedDirection
    })[0];
    session.questions[index] = replacement;
  }
}

function nextQuestion() {
  if (!session.answered) return;
  if (session.index >= session.questions.length - 1) {
    finishSession();
    return;
  }
  session.index += 1;
  session.answered = false;
  session.selectedChoiceId = null;
  session.lastAnswerCorrect = null;
  session.answerStartedAt = performance.now();
  renderGame();
}

function finishSession() {
  const total = session.correct + session.wrong;
  const accuracy = total ? Math.round((session.correct / total) * 100) : 0;
  const xp = Math.max(10, Math.round(session.score / 10));
  if (!session.resultApplied) {
    progress = applySessionResult(progress, {
      stageId: session.stage.id,
      stageNumber: session.stage.number,
      totalStages: STAGES.length,
      accuracy,
      xp,
      score: session.score,
      direction: selectedDirection
    });
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
    onConfirm: () => { closeDialog(); view = 'home'; session = null; render(); }
  });
}

function renderResult() {
  const total = session.correct + session.wrong;
  const accuracy = total ? Math.round((session.correct / total) * 100) : 0;
  const rank = accuracy === 100 ? 'S' : accuracy >= 90 ? 'A' : accuracy >= 75 ? 'B' : accuracy >= 60 ? 'C' : 'D';
  const uniqueMisses = [...new Map(session.misses.map((item) => [item.id, item])).values()];
  const unlockedNext = accuracy >= 70 && session.stage.number < STAGES.length;

  app.innerHTML = `
    <main class="app-shell">
      ${topbar(true)}
      <section class="result-card">
        <div class="result-rank">${rank}</div>
        <h1>${accuracy >= 70 ? 'クエストクリア！' : 'もう一回で定着する。'}</h1>
        <p>${unlockedNext ? `STAGE ${session.stage.number + 1} が開きました。` : `${session.stage.title}の結果です。`}</p>
        <div class="result-stats">
          ${resultStat('スコア', session.score.toLocaleString())}
          ${resultStat('正答率', `${accuracy}%`)}
          ${resultStat('最大コンボ', session.maxCombo)}
          ${resultStat('獲得XP', Math.max(10, Math.round(session.score / 10)))}
        </div>
        ${uniqueMisses.length ? `
          <div class="weak-list"><h3>今回のライバル文字</h3><div class="weak-tags">${uniqueMisses.map((item) => `<span class="weak-tag">${item.hangul} ${item.reading}</span>`).join('')}</div></div>
        ` : '<div class="weak-list"><h3>ノーミス完走。かなりええ感じ。</h3></div>'}
        <div class="result-actions">
          <button class="secondary-button" data-action="retry">もう一度</button>
          ${unlockedNext ? `<button class="primary-button" data-action="next-stage">次のステージ</button>` : '<button class="primary-button" data-action="result-home">ホームへ</button>'}
        </div>
      </section>
    </main>
  `;
  bindCommonEvents();
  document.querySelector('[data-action="retry"]')?.addEventListener('click', () => startSession(session.stage.id, session.questions.length, session.weakOnly));
  document.querySelector('[data-action="next-stage"]')?.addEventListener('click', () => startSession(STAGES[session.stage.number].id, 10, false));
  document.querySelector('[data-action="result-home"]')?.addEventListener('click', () => { view = 'home'; session = null; render(); });
}

function resultStat(label, value) {
  return `<div class="result-stat"><span>${label}</span><strong>${value}</strong></div>`;
}

function renderStats() {
  const sorted = [...ALL_ITEMS]
    .map((item) => ({ item, mastery: getItemMastery(progress.itemStats[item.id]), stat: progress.itemStats[item.id] ?? {} }))
    .sort((a, b) => b.stat.seen - a.stat.seen || a.mastery - b.mastery);
  const attempted = sorted.filter((entry) => entry.stat.seen > 0);

  app.innerHTML = `
    <main class="app-shell stats-page">
      ${topbar(true)}
      <h1>読みの成績</h1>
      <p>正答率だけでなく、反復回数と回答速度を合わせて習熟度を出しています。</p>
      <div class="stats-table">
        ${attempted.length ? attempted.map(statsRow).join('') : '<div class="note-box">まだ記録がありません。まずは「今日の5問」から始めてみよう。</div>'}
      </div>
    </main>
  `;
  bindCommonEvents();
}

function statsRow({ item, mastery, stat }) {
  const accuracy = stat.seen ? Math.round((stat.correct / stat.seen) * 100) : 0;
  return `
    <div class="stats-row">
      <div class="stats-hangul">${item.hangul}</div>
      <div class="stats-info"><strong>${item.reading}</strong><span>${stat.seen}回挑戦・正答率${accuracy}%・平均${(stat.avgMs / 1000).toFixed(1)}秒</span></div>
      <div class="stats-meter"><div class="progress-track"><div class="progress-fill" style="width:${mastery}%"></div></div><small>習熟 ${mastery}%</small></div>
    </div>
  `;
}

function showSettings() {
  showDialog({
    title: '設定',
    message: 'このアプリの記録は、この端末のブラウザ内だけに保存されます。音声・ログイン・通信は使いません。',
    confirmLabel: '学習記録をリセット',
    confirmClass: 'danger-button',
    onConfirm: () => {
      progress = createDefaultProgress();
      selectedDirection = 'mixed';
      saveProgress();
      closeDialog();
      view = 'home';
      session = null;
      render();
      showToast('学習記録をリセットしました');
    }
  });
}

function showDialog({ title, message, confirmLabel, confirmClass = '', onConfirm }) {
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
