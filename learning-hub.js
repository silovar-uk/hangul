import { CONTENT_TYPES, getCategories, getLexiconItems } from './lexicon-data.js';

const STORAGE_KEY = 'hangulQuest.lexicon.v1';
const MODES = {
  kana: {
    label: 'カタカナ',
    step: 'STEP 1',
    copy: '意味とカタカナを往復。まず音の形を覚える。',
    directions: ['meaning-to-reading', 'reading-to-meaning']
  },
  hangul: {
    label: 'ハングル',
    step: 'STEP 2',
    copy: '意味とハングルを往復。文字と意味を直接つなぐ。',
    directions: ['meaning-to-hangul', 'hangul-to-meaning']
  },
  mixed: {
    label: 'ミックス',
    step: 'STEP 3',
    copy: 'カタカナ・ハングル・意味をまとめて確認。',
    directions: ['meaning-to-reading', 'reading-to-meaning', 'meaning-to-hangul', 'hangul-to-meaning']
  }
};

const defaultModeRecord = () => ({ sessions: 0, bestAccuracy: 0, lastAccuracy: 0 });

function defaultProgress() {
  return {
    version: 1,
    itemStats: {},
    bookmarks: [],
    known: [],
    modes: {
      word: { kana: defaultModeRecord(), hangul: defaultModeRecord(), mixed: defaultModeRecord() },
      phrase: { kana: defaultModeRecord(), hangul: defaultModeRecord(), mixed: defaultModeRecord() }
    },
    lastMode: { word: 'kana', phrase: 'kana' },
    lastCategory: { word: 'all', phrase: 'all' }
  };
}

function loadProgress() {
  const defaults = defaultProgress();
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!parsed) return defaults;
    return {
      ...defaults,
      ...parsed,
      itemStats: parsed.itemStats ?? {},
      bookmarks: Array.isArray(parsed.bookmarks) ? parsed.bookmarks : [],
      known: Array.isArray(parsed.known) ? parsed.known : [],
      lastMode: { ...defaults.lastMode, ...(parsed.lastMode ?? {}) },
      lastCategory: { ...defaults.lastCategory, ...(parsed.lastCategory ?? {}) },
      modes: {
        word: mergeModeRecords(defaults.modes.word, parsed.modes?.word),
        phrase: mergeModeRecords(defaults.modes.phrase, parsed.modes?.phrase)
      }
    };
  } catch {
    return defaults;
  }
}

function mergeModeRecords(defaults, incoming = {}) {
  return Object.fromEntries(
    Object.keys(defaults).map((key) => [key, { ...defaults[key], ...(incoming?.[key] ?? {}) }])
  );
}

let progress = loadProgress();
let panel = null;
let page = 'hub';
let contentType = 'word';
let quizMode = 'kana';
let quizLength = 10;
let quizCategory = 'all';
let quiz = null;
let listType = 'word';
let listCategory = 'all';
let listQuery = '';
let deckType = 'word';
let deckFilter = 'all';
let deckIndex = 0;
let deckRevealed = false;

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function itemKey(item) {
  return `${item.type}:${item.id}`;
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function shuffle(items) {
  const values = [...items];
  for (let index = values.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [values[index], values[target]] = [values[target], values[index]];
  }
  return values;
}

function mountLearningEntries() {
  const app = document.querySelector('#app');
  if (!app) return;

  const home = app.querySelector('.home-shell');
  if (home && !home.querySelector('.learning-expansion')) {
    const section = document.createElement('section');
    section.className = 'learning-expansion';
    section.innerHTML = `
      <div class="learning-expansion-copy">
        <span class="section-kicker">WORDS & PHRASES</span>
        <h2>読める、の次へ。</h2>
        <p>単語とフレーズを、カタカナからハングルへ段階的に覚える。</p>
      </div>
      <div class="learning-entry-grid">
        <button type="button" class="learning-entry-card learning-entry-card--word" data-learning-open="quiz-word">
          <span class="learning-entry-icon">단</span>
          <span><small>STEP UP</small><strong>単語クエスト</strong><em>意味 ↔ カタカナ → ハングル</em></span>
          <b>→</b>
        </button>
        <button type="button" class="learning-entry-card learning-entry-card--phrase" data-learning-open="quiz-phrase">
          <span class="learning-entry-icon">말</span>
          <span><small>USE IT</small><strong>フレーズクエスト</strong><em>あいさつ・買い物・応援</em></span>
          <b>→</b>
        </button>
      </div>
      <div class="learning-entry-links">
        <button type="button" data-learning-open="list">一覧表を見る</button>
        <button type="button" data-learning-open="deck">単語帳を開く</button>
      </div>
    `;
    const stageHeading = home.querySelector('.stage-heading');
    if (stageHeading) stageHeading.before(section);
    else home.append(section);
  }

  const topbarActions = app.querySelector('.home-shell .topbar-actions');
  if (topbarActions && !topbarActions.querySelector('[data-learning-open="hub"]')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'icon-button icon-button--label learning-top-button';
    button.dataset.learningOpen = 'hub';
    button.setAttribute('aria-label', '単語とフレーズの学習を開く');
    button.innerHTML = '<span>単語</span>';
    topbarActions.prepend(button);
  }
}

function ensurePanel() {
  if (panel) return;
  panel = document.createElement('section');
  panel.className = 'learning-panel';
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', '単語とフレーズの学習');
  panel.addEventListener('click', handlePanelClick);
  document.body.append(panel);
}

function openPanel(destination = 'hub') {
  ensurePanel();

  if (destination === 'quiz-word' || destination === 'quiz-phrase') {
    contentType = destination === 'quiz-word' ? 'word' : 'phrase';
    quizMode = recommendedMode(contentType);
    quizCategory = progress.lastCategory[contentType] || 'all';
    page = 'quiz-setup';
  } else if (destination === 'list') {
    page = 'list';
  } else if (destination === 'deck') {
    page = 'deck';
    deckIndex = 0;
    deckRevealed = false;
  } else {
    page = destination;
  }

  panel.classList.add('is-open');
  document.body.classList.add('learning-panel-open');
  renderPanel();
  requestAnimationFrame(() => panel.querySelector('.learning-close')?.focus());
}

function closePanel() {
  if (!panel) return;
  panel.classList.remove('is-open');
  document.body.classList.remove('learning-panel-open');
  quiz = null;
}

function renderPanel() {
  if (!panel) return;
  panel.innerHTML = `
    <div class="learning-panel-shell">
      ${learningHeader()}
      <div class="learning-panel-content">
        ${renderPage()}
      </div>
    </div>
  `;
  bindPanelInputs();
}

function learningHeader() {
  const hideNav = page === 'quiz-play' || page === 'quiz-result';
  return `
    <header class="learning-header">
      <button type="button" class="learning-brand" data-learning-action="hub" aria-label="学習メニューへ戻る">
        <span>한</span>
        <div><strong>ことばクエスト</strong><small>WORDS, PHRASES & REVIEW</small></div>
      </button>
      ${hideNav ? '' : `
        <nav class="learning-nav" aria-label="学習ページ">
          ${navButton('hub', 'メニュー')}
          ${navButton('list', '一覧表')}
          ${navButton('deck', '単語帳')}
        </nav>
      `}
      <button type="button" class="learning-close" data-learning-action="close" aria-label="閉じる">×</button>
    </header>
  `;
}

function navButton(target, label) {
  return `<button type="button" class="${page === target ? 'is-active' : ''}" data-learning-action="${target}">${label}</button>`;
}

function renderPage() {
  if (page === 'quiz-setup') return renderQuizSetup();
  if (page === 'quiz-play') return renderQuizPlay();
  if (page === 'quiz-result') return renderQuizResult();
  if (page === 'list') return renderListPage();
  if (page === 'deck') return renderDeckPage();
  return renderHub();
}

function renderHub() {
  const wordRecommendation = recommendedMode('word');
  const phraseRecommendation = recommendedMode('phrase');
  return `
    <main class="learning-hub">
      <section class="learning-hero">
        <div>
          <span class="learning-kicker">MEANING STARTS HERE</span>
          <h1>読める文字を、<br>使えることばへ。</h1>
          <p>まずカタカナで音と意味を結び、次にハングルを直接読む。最後は両方を混ぜて定着。</p>
        </div>
        <div class="learning-path">
          ${pathStep('1', 'カタカナ', '意味 ↔ 読み')}
          ${pathStep('2', 'ハングル', '意味 ↔ 文字')}
          ${pathStep('3', 'ミックス', '全部を往復')}
        </div>
      </section>

      <section class="learning-mode-grid">
        ${hubQuizCard('word', '단어', '単語クエスト', '食べ物・場所・動作・サッカーなど', wordRecommendation)}
        ${hubQuizCard('phrase', '문장', 'フレーズクエスト', 'あいさつ・買い物・食事・応援など', phraseRecommendation)}
      </section>

      <section class="learning-library-grid">
        <button type="button" data-learning-action="list">
          <span>一覧表</span><strong>${CONTENT_TYPES.word.items.length + CONTENT_TYPES.phrase.items.length}件を検索</strong><small>ハングル・カタカナ・意味をまとめて確認</small>
        </button>
        <button type="button" data-learning-action="deck">
          <span>単語帳</span><strong>${progress.bookmarks.length}件を保存中</strong><small>カードをめくり「覚えた／もう一度」で整理</small>
        </button>
      </section>
    </main>
  `;
}

function pathStep(number, title, copy) {
  return `<div><b>${number}</b><span><strong>${title}</strong><small>${copy}</small></span></div>`;
}

function hubQuizCard(type, korean, title, copy, recommendation) {
  const learned = getLexiconItems(type).filter((item) => progress.known.includes(itemKey(item))).length;
  return `
    <button type="button" class="learning-mode-card" data-learning-action="open-quiz" data-type="${type}">
      <div class="learning-mode-card-top"><span>${korean}</span><em>おすすめ：${MODES[recommendation].label}</em></div>
      <strong>${title}</strong>
      <p>${copy}</p>
      <div class="learning-mode-card-bottom"><small>覚えた ${learned}/${getLexiconItems(type).length}</small><b>始める →</b></div>
    </button>
  `;
}

function recommendedMode(type) {
  const records = progress.modes[type];
  if ((records.kana?.sessions ?? 0) === 0 || (records.kana?.bestAccuracy ?? 0) < 70) return 'kana';
  if ((records.hangul?.sessions ?? 0) === 0 || (records.hangul?.bestAccuracy ?? 0) < 70) return 'hangul';
  return 'mixed';
}

function renderQuizSetup() {
  const meta = CONTENT_TYPES[contentType];
  const recommended = recommendedMode(contentType);
  const categories = getCategories(contentType);
  const selectedPool = filterByCategory(getLexiconItems(contentType), quizCategory);
  return `
    <main class="learning-setup">
      <button type="button" class="learning-back" data-learning-action="hub">← 学習メニュー</button>
      <div class="learning-page-heading">
        <span>${contentType === 'word' ? 'WORD QUEST' : 'PHRASE QUEST'}</span>
        <h1>${meta.label}クエスト</h1>
        <p>日本語から答える問題と、カタカナ／ハングルから意味を答える問題を交互に出題。</p>
      </div>

      <section class="learning-setup-section">
        <div class="learning-setup-label"><b>1</b><span><strong>学習ステップ</strong><small>おすすめ順に進む。どこからでも練習可能。</small></span></div>
        <div class="learning-step-grid">
          ${Object.entries(MODES).map(([key, mode]) => modeCard(key, mode, recommended)).join('')}
        </div>
      </section>

      <section class="learning-setup-section">
        <div class="learning-setup-label"><b>2</b><span><strong>カテゴリ</strong><small>「すべて」または場面を選択。</small></span></div>
        <div class="learning-chip-row">
          ${categoryChip('all', 'すべて')}
          ${categories.map((category) => categoryChip(category, category)).join('')}
        </div>
      </section>

      <section class="learning-setup-section">
        <div class="learning-setup-label"><b>3</b><span><strong>問題数</strong><small>短く始めるなら5問。</small></span></div>
        <div class="learning-length-row">
          ${[5, 10, 20].map((length) => `<button type="button" class="${quizLength === length ? 'is-active' : ''}" data-learning-action="quiz-length" data-length="${length}">${length}問</button>`).join('')}
        </div>
      </section>

      <p class="learning-pronunciation-note">※ カタカナは発音の目安です。実際の音は語中・語末や音のつながりで変わることがあります。</p>
      <div class="learning-start-bar">
        <div><span>${MODES[quizMode].step}</span><strong>${MODES[quizMode].label}・${quizCategory === 'all' ? 'すべて' : quizCategory}</strong><small>${selectedPool.length}件から出題</small></div>
        <button type="button" data-learning-action="start-quiz">この内容で始める →</button>
      </div>
    </main>
  `;
}

function modeCard(key, mode, recommended) {
  const record = progress.modes[contentType][key] ?? defaultModeRecord();
  return `
    <button type="button" class="learning-step-card ${quizMode === key ? 'is-active' : ''}" data-learning-action="quiz-mode" data-mode="${key}">
      <span>${mode.step}${recommended === key ? '<em>おすすめ</em>' : ''}</span>
      <strong>${mode.label}</strong>
      <p>${mode.copy}</p>
      <small>${record.sessions ? `最高正答率 ${record.bestAccuracy}%` : '未挑戦'}</small>
    </button>
  `;
}

function categoryChip(value, label) {
  return `<button type="button" class="${quizCategory === value ? 'is-active' : ''}" data-learning-action="quiz-category" data-category="${escapeHtml(value)}">${escapeHtml(label)}</button>`;
}

function filterByCategory(items, category) {
  return category === 'all' ? items : items.filter((item) => item.category === category);
}

function startQuiz() {
  const pool = filterByCategory(getLexiconItems(contentType), quizCategory);
  const count = Math.min(quizLength, Math.max(5, pool.length));
  const questions = buildQuizQuestions(pool, count, quizMode);
  quiz = {
    questions,
    index: 0,
    correct: 0,
    wrong: 0,
    answered: false,
    selected: null,
    answerStartedAt: performance.now(),
    answers: []
  };
  progress.lastMode[contentType] = quizMode;
  progress.lastCategory[contentType] = quizCategory;
  saveProgress();
  page = 'quiz-play';
  renderPanel();
}

function buildQuizQuestions(pool, count, mode) {
  if (pool.length < 4) return [];
  const directions = MODES[mode].directions;
  const recentIds = [];
  const questions = [];
  for (let index = 0; index < count; index += 1) {
    const item = weightedItem(pool, recentIds);
    recentIds.push(item.id);
    const direction = directions[index % directions.length];
    questions.push(createLexiconQuestion(item, pool, direction));
  }
  return questions;
}

function weightedItem(pool, recentIds) {
  const candidates = pool.filter((item) => !recentIds.slice(-2).includes(item.id));
  const source = candidates.length ? candidates : pool;
  const weighted = source.map((item) => {
    const stat = progress.itemStats[itemKey(item)] ?? {};
    const seen = stat.seen ?? 0;
    const accuracy = seen ? (stat.correct ?? 0) / seen : 0.5;
    return { item, weight: 1 + (1 - accuracy) * 4 + (seen === 0 ? 3 : 0) + (stat.lastResult === 'wrong' ? 2 : 0) };
  });
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  let point = Math.random() * total;
  for (const entry of weighted) {
    point -= entry.weight;
    if (point <= 0) return entry.item;
  }
  return weighted.at(-1).item;
}

function createLexiconQuestion(item, pool, direction) {
  const prompt = questionPrompt(item, direction);
  const correct = answerLabel(item, direction);
  const choices = new Map([[correct, item]]);
  for (const candidate of shuffle(pool)) {
    const label = answerLabel(candidate, direction);
    if (!choices.has(label)) choices.set(label, candidate);
    if (choices.size >= 4) break;
  }
  return {
    item,
    direction,
    prompt,
    promptLabel: questionLabel(direction),
    choices: shuffle([...choices.entries()].map(([label, candidate]) => ({
      id: candidate.id,
      label,
      isCorrect: candidate.id === item.id
    })))
  };
}

function questionPrompt(item, direction) {
  if (direction === 'meaning-to-reading' || direction === 'meaning-to-hangul') return item.meaning;
  if (direction === 'reading-to-meaning') return item.reading;
  return item.hangul;
}

function answerLabel(item, direction) {
  if (direction === 'meaning-to-reading') return item.reading;
  if (direction === 'meaning-to-hangul') return item.hangul;
  return item.meaning;
}

function questionLabel(direction) {
  const labels = {
    'meaning-to-reading': 'この意味になるカタカナは？',
    'reading-to-meaning': 'このカタカナの意味は？',
    'meaning-to-hangul': 'この意味になるハングルは？',
    'hangul-to-meaning': 'このハングルの意味は？'
  };
  return labels[direction];
}

function renderQuizPlay() {
  if (!quiz?.questions.length) {
    return `<main class="learning-empty"><h1>問題を作れませんでした</h1><p>カテゴリを「すべて」に戻して、もう一度試してください。</p><button type="button" data-learning-action="quiz-setup">設定へ戻る</button></main>`;
  }
  const question = quiz.questions[quiz.index];
  const ratio = ((quiz.index + (quiz.answered ? 1 : 0)) / quiz.questions.length) * 100;
  return `
    <main class="learning-quiz">
      <header class="learning-quiz-top">
        <button type="button" data-learning-action="quit-quiz" aria-label="クイズを終了">×</button>
        <div><span>${CONTENT_TYPES[contentType].label}・${MODES[quizMode].label}</span><small>${quiz.index + 1}/${quiz.questions.length}</small><i><b style="width:${ratio}%"></b></i></div>
        <strong>${quiz.correct}正解</strong>
      </header>

      <section class="learning-question-card">
        <span class="learning-question-type">${question.promptLabel}</span>
        <div class="learning-question-prompt ${question.direction.includes('reading') ? 'is-kana' : ''}">${escapeHtml(question.prompt)}</div>
        <div class="learning-choice-grid">
          ${question.choices.map((choice, index) => quizChoice(choice, index)).join('')}
        </div>
        ${quiz.answered ? quizFeedback(question) : '<p class="learning-key-hint">PCでは数字キー 1〜4 でも回答できます</p>'}
      </section>
    </main>
  `;
}

function quizChoice(choice, index) {
  let className = '';
  if (quiz.answered) {
    if (choice.isCorrect) className = 'is-correct';
    else if (quiz.selected === choice.id) className = 'is-wrong';
  }
  return `<button type="button" class="${className}" data-learning-action="answer" data-choice="${choice.id}" ${quiz.answered ? 'disabled' : ''}><small>${index + 1}</small><span>${escapeHtml(choice.label)}</span></button>`;
}

function quizFeedback(question) {
  const last = quiz.answers.at(-1);
  const item = question.item;
  return `
    <div class="learning-feedback ${last.correct ? 'is-correct' : 'is-wrong'}">
      <div class="learning-feedback-title"><span>${last.correct ? '○' : '×'}</span><strong>${last.correct ? '正解！' : 'ここで覚える'}</strong><small>${last.elapsedMs < 2500 && last.correct ? 'いいテンポ' : 'ゆっくり定着'}</small></div>
      <div class="learning-answer-set">
        <b>${escapeHtml(item.hangul)}</b>
        <span>${escapeHtml(item.reading)}</span>
        <strong>${escapeHtml(item.meaning)}</strong>
      </div>
      ${item.note ? `<p>${escapeHtml(item.note)}</p>` : ''}
      <button type="button" data-learning-action="next-question">${quiz.index === quiz.questions.length - 1 ? '結果を見る' : '次の問題へ'} →</button>
    </div>
  `;
}

function answerQuiz(choiceId) {
  if (!quiz || quiz.answered) return;
  const question = quiz.questions[quiz.index];
  const choice = question.choices.find((entry) => entry.id === choiceId);
  const correct = Boolean(choice?.isCorrect);
  const elapsedMs = Math.max(200, performance.now() - quiz.answerStartedAt);
  quiz.answered = true;
  quiz.selected = choiceId;
  quiz.correct += correct ? 1 : 0;
  quiz.wrong += correct ? 0 : 1;
  quiz.answers.push({ itemId: question.item.id, direction: question.direction, correct, elapsedMs });
  updateLexiconStat(question.item, correct, elapsedMs);
  saveProgress();
  renderPanel();
}

function updateLexiconStat(item, correct, elapsedMs) {
  const key = itemKey(item);
  const current = progress.itemStats[key] ?? {};
  const seen = (current.seen ?? 0) + 1;
  const previousAverage = current.avgMs ?? elapsedMs;
  progress.itemStats[key] = {
    ...current,
    seen,
    correct: (current.correct ?? 0) + (correct ? 1 : 0),
    wrong: (current.wrong ?? 0) + (correct ? 0 : 1),
    avgMs: Math.round(previousAverage + (elapsedMs - previousAverage) / seen),
    lastResult: correct ? 'correct' : 'wrong'
  };
}

function nextQuestion() {
  if (!quiz?.answered) return;
  if (quiz.index >= quiz.questions.length - 1) {
    finishQuiz();
    return;
  }
  quiz.index += 1;
  quiz.answered = false;
  quiz.selected = null;
  quiz.answerStartedAt = performance.now();
  renderPanel();
}

function finishQuiz() {
  const total = quiz.correct + quiz.wrong;
  const accuracy = total ? Math.round((quiz.correct / total) * 100) : 0;
  const record = progress.modes[contentType][quizMode];
  progress.modes[contentType][quizMode] = {
    sessions: (record.sessions ?? 0) + 1,
    bestAccuracy: Math.max(record.bestAccuracy ?? 0, accuracy),
    lastAccuracy: accuracy
  };
  saveProgress();
  quiz.accuracy = accuracy;
  page = 'quiz-result';
  renderPanel();
}

function renderQuizResult() {
  const passed = quiz.accuracy >= 70;
  const nextMode = quizMode === 'kana' ? 'hangul' : quizMode === 'hangul' ? 'mixed' : 'mixed';
  return `
    <main class="learning-result">
      <div class="learning-result-mark">${quiz.accuracy === 100 ? '★' : passed ? '✓' : '↻'}</div>
      <span>${passed ? 'QUEST CLEAR' : 'ONE MORE ROUND'}</span>
      <h1>正答率 ${quiz.accuracy}%</h1>
      <p>${passed ? resultSuccessCopy() : '同じステップをもう一度。間違えた項目は次回も優先して出題されます。'}</p>
      <div class="learning-result-stats">
        <div><small>正解</small><strong>${quiz.correct}</strong></div>
        <div><small>不正解</small><strong>${quiz.wrong}</strong></div>
        <div><small>次のおすすめ</small><strong>${MODES[recommendedMode(contentType)].label}</strong></div>
      </div>
      <div class="learning-result-actions">
        <button type="button" data-learning-action="retry-quiz">同じ内容でもう一度</button>
        ${passed && quizMode !== 'mixed' ? `<button type="button" class="is-primary" data-learning-action="next-mode" data-mode="${nextMode}">次は${MODES[nextMode].label} →</button>` : '<button type="button" class="is-primary" data-learning-action="quiz-setup">設定へ戻る →</button>'}
      </div>
      <button type="button" class="learning-result-home" data-learning-action="hub">学習メニューへ</button>
    </main>
  `;
}

function resultSuccessCopy() {
  if (quizMode === 'kana') return '音と意味の往復はOK。次はハングルを見て、意味を直接思い出す段階へ。';
  if (quizMode === 'hangul') return '文字と意味がつながってきた。最後はカタカナも混ぜて、思い出す経路を増やそう。';
  return 'カタカナ・ハングル・意味を行き来できています。苦手項目を単語帳で仕上げよう。';
}

function renderListPage() {
  const categories = getCategories(listType);
  return `
    <main class="learning-list-page">
      <div class="learning-page-heading">
        <span>REFERENCE</span><h1>ことば一覧表</h1><p>ハングル・カタカナ・意味を一列で確認。検索とカテゴリ絞り込みに対応。</p>
      </div>
      <div class="learning-list-controls">
        <div class="learning-type-switch">
          ${typeSwitchButton('word', '単語')}
          ${typeSwitchButton('phrase', 'フレーズ')}
        </div>
        <label class="learning-search"><span>⌕</span><input type="search" data-learning-search placeholder="ハングル・読み・意味で検索" value="${escapeHtml(listQuery)}"></label>
        <select data-learning-category aria-label="カテゴリ">
          <option value="all">すべてのカテゴリ</option>
          ${categories.map((category) => `<option value="${escapeHtml(category)}" ${listCategory === category ? 'selected' : ''}>${escapeHtml(category)}</option>`).join('')}
        </select>
      </div>
      <div class="learning-list-summary"><strong data-learning-list-count></strong><span>☆で単語帳に保存</span></div>
      <p class="learning-pronunciation-note">※ カタカナは発音の目安です。ハングルと意味を結ぶための補助として表示しています。</p>
      <div class="learning-table-wrap">
        <div class="learning-table-head"><span>ハングル</span><span>カタカナ</span><span>意味</span><span>カテゴリ</span><span></span></div>
        <div data-learning-list-results></div>
      </div>
    </main>
  `;
}

function typeSwitchButton(type, label) {
  return `<button type="button" class="${listType === type ? 'is-active' : ''}" data-learning-action="list-type" data-type="${type}">${label}</button>`;
}

function bindPanelInputs() {
  const search = panel.querySelector('[data-learning-search]');
  search?.addEventListener('input', (event) => {
    listQuery = event.target.value;
    renderListResults();
  });
  const category = panel.querySelector('[data-learning-category]');
  category?.addEventListener('change', (event) => {
    listCategory = event.target.value;
    renderListResults();
  });
  if (page === 'list') renderListResults();
}

function getFilteredListItems() {
  const query = listQuery.trim().toLowerCase();
  return getLexiconItems(listType).filter((item) => {
    const matchesCategory = listCategory === 'all' || item.category === listCategory;
    const haystack = `${item.hangul} ${item.reading} ${item.meaning} ${item.category}`.toLowerCase();
    return matchesCategory && (!query || haystack.includes(query));
  });
}

function renderListResults() {
  const root = panel?.querySelector('[data-learning-list-results]');
  if (!root) return;
  const items = getFilteredListItems();
  root.innerHTML = items.length ? items.map(listRow).join('') : '<div class="learning-list-empty">条件に合う項目がありません。</div>';
  const count = panel.querySelector('[data-learning-list-count]');
  if (count) count.textContent = `${items.length}件`;
}

function listRow(item) {
  const bookmarked = progress.bookmarks.includes(itemKey(item));
  return `
    <article class="learning-table-row">
      <b>${escapeHtml(item.hangul)}</b>
      <span>${escapeHtml(item.reading)}</span>
      <strong>${escapeHtml(item.meaning)}</strong>
      <small>${escapeHtml(item.category)}</small>
      <button type="button" class="${bookmarked ? 'is-on' : ''}" data-learning-action="bookmark" data-key="${itemKey(item)}" aria-label="${bookmarked ? '単語帳から外す' : '単語帳に保存'}">${bookmarked ? '★' : '☆'}</button>
      ${item.note ? `<p>${escapeHtml(item.note)}</p>` : ''}
    </article>
  `;
}

function renderDeckPage() {
  const pool = getDeckItems();
  if (deckIndex >= pool.length) deckIndex = 0;
  const item = pool[deckIndex];
  return `
    <main class="learning-deck-page">
      <div class="learning-page-heading">
        <span>FLASHCARDS</span><h1>単語帳</h1><p>ハングルを見て考え、タップしてカタカナと意味を確認。</p>
      </div>
      <div class="learning-deck-controls">
        <div class="learning-type-switch">
          ${deckTypeButton('word', '単語')}
          ${deckTypeButton('phrase', 'フレーズ')}
        </div>
        <div class="learning-filter-row">
          ${deckFilterButton('all', 'すべて')}
          ${deckFilterButton('bookmark', `保存 ${progress.bookmarks.length}`)}
          ${deckFilterButton('weak', '苦手')}
          ${deckFilterButton('unseen', '未学習')}
        </div>
      </div>
      ${item ? renderDeckCard(item, pool.length) : renderEmptyDeck()}
    </main>
  `;
}

function deckTypeButton(type, label) {
  return `<button type="button" class="${deckType === type ? 'is-active' : ''}" data-learning-action="deck-type" data-type="${type}">${label}</button>`;
}

function deckFilterButton(filter, label) {
  return `<button type="button" class="${deckFilter === filter ? 'is-active' : ''}" data-learning-action="deck-filter" data-filter="${filter}">${label}</button>`;
}

function getDeckItems() {
  return getLexiconItems(deckType).filter((item) => {
    const key = itemKey(item);
    const stat = progress.itemStats[key] ?? {};
    if (deckFilter === 'bookmark') return progress.bookmarks.includes(key);
    if (deckFilter === 'weak') return (stat.wrong ?? 0) > 0 || (stat.seen ?? 0) > 0 && (stat.correct ?? 0) / stat.seen < 0.7;
    if (deckFilter === 'unseen') return (stat.seen ?? 0) === 0;
    return true;
  });
}

function renderDeckCard(item, total) {
  const key = itemKey(item);
  const known = progress.known.includes(key);
  const bookmarked = progress.bookmarks.includes(key);
  return `
    <div class="learning-deck-meta"><span>${deckIndex + 1}/${total}</span><small>${escapeHtml(item.category)}</small><button type="button" class="${bookmarked ? 'is-on' : ''}" data-learning-action="bookmark" data-key="${key}">${bookmarked ? '★ 保存済み' : '☆ 保存'}</button></div>
    <button type="button" class="learning-flashcard ${deckRevealed ? 'is-revealed' : ''}" data-learning-action="reveal-card">
      <span class="learning-flashcard-label">${deckRevealed ? 'ANSWER' : 'HANGUL'}</span>
      <b>${escapeHtml(item.hangul)}</b>
      ${deckRevealed ? `<strong>${escapeHtml(item.reading)}</strong><em>${escapeHtml(item.meaning)}</em>${item.note ? `<p>${escapeHtml(item.note)}</p>` : ''}` : '<small>タップして答えを見る</small>'}
    </button>
    <div class="learning-deck-actions">
      ${deckRevealed ? `
        <button type="button" data-learning-action="deck-again">↻ もう一度</button>
        <button type="button" class="is-primary ${known ? 'is-known' : ''}" data-learning-action="deck-known">✓ ${known ? '覚えた済み' : '覚えた'}</button>
      ` : '<button type="button" class="is-primary" data-learning-action="reveal-card">答えを見る</button>'}
    </div>
    <div class="learning-deck-nav">
      <button type="button" data-learning-action="deck-prev">← 前へ</button>
      <button type="button" data-learning-action="deck-next">次へ →</button>
    </div>
  `;
}

function renderEmptyDeck() {
  const copy = deckFilter === 'bookmark' ? '一覧表の☆を押すと、ここに保存されます。' : 'この条件に当てはまる項目はありません。';
  return `<div class="learning-empty-deck"><span>□</span><h2>カードがありません</h2><p>${copy}</p><button type="button" data-learning-action="deck-filter" data-filter="all">すべてを見る</button></div>`;
}

function toggleBookmark(key) {
  progress.bookmarks = progress.bookmarks.includes(key)
    ? progress.bookmarks.filter((entry) => entry !== key)
    : [...progress.bookmarks, key];
  saveProgress();
}

function moveDeck(step) {
  const pool = getDeckItems();
  if (!pool.length) return;
  deckIndex = (deckIndex + step + pool.length) % pool.length;
  deckRevealed = false;
  renderPanel();
}

function markDeckKnown() {
  const pool = getDeckItems();
  const item = pool[deckIndex];
  if (!item) return;
  const key = itemKey(item);
  if (!progress.known.includes(key)) progress.known.push(key);
  saveProgress();
  moveDeck(1);
}

function markDeckAgain() {
  const pool = getDeckItems();
  const item = pool[deckIndex];
  if (!item) return;
  const key = itemKey(item);
  progress.known = progress.known.filter((entry) => entry !== key);
  const current = progress.itemStats[key] ?? {};
  progress.itemStats[key] = { ...current, lastResult: 'wrong', wrong: (current.wrong ?? 0) + 1 };
  saveProgress();
  moveDeck(1);
}

function handlePanelClick(event) {
  const target = event.target.closest('[data-learning-action]');
  if (!target) return;
  const action = target.dataset.learningAction;

  if (action === 'close') closePanel();
  if (action === 'hub') { page = 'hub'; quiz = null; renderPanel(); }
  if (action === 'list') { page = 'list'; renderPanel(); }
  if (action === 'deck') { page = 'deck'; deckIndex = 0; deckRevealed = false; renderPanel(); }
  if (action === 'open-quiz') {
    contentType = target.dataset.type;
    quizMode = recommendedMode(contentType);
    quizCategory = progress.lastCategory[contentType] || 'all';
    page = 'quiz-setup';
    renderPanel();
  }
  if (action === 'quiz-setup') { page = 'quiz-setup'; renderPanel(); }
  if (action === 'quiz-mode') { quizMode = target.dataset.mode; renderPanel(); }
  if (action === 'quiz-category') { quizCategory = target.dataset.category; renderPanel(); }
  if (action === 'quiz-length') { quizLength = Number(target.dataset.length); renderPanel(); }
  if (action === 'start-quiz') startQuiz();
  if (action === 'answer') answerQuiz(target.dataset.choice);
  if (action === 'next-question') nextQuestion();
  if (action === 'quit-quiz') { page = 'quiz-setup'; quiz = null; renderPanel(); }
  if (action === 'retry-quiz') startQuiz();
  if (action === 'next-mode') { quizMode = target.dataset.mode; page = 'quiz-setup'; quiz = null; renderPanel(); }
  if (action === 'list-type') {
    listType = target.dataset.type;
    listCategory = 'all';
    listQuery = '';
    renderPanel();
  }
  if (action === 'bookmark') {
    toggleBookmark(target.dataset.key);
    if (page === 'list') renderListResults();
    else renderPanel();
  }
  if (action === 'deck-type') {
    deckType = target.dataset.type;
    deckIndex = 0;
    deckRevealed = false;
    renderPanel();
  }
  if (action === 'deck-filter') {
    deckFilter = target.dataset.filter;
    deckIndex = 0;
    deckRevealed = false;
    renderPanel();
  }
  if (action === 'reveal-card') { deckRevealed = true; renderPanel(); }
  if (action === 'deck-prev') moveDeck(-1);
  if (action === 'deck-next') moveDeck(1);
  if (action === 'deck-known') markDeckKnown();
  if (action === 'deck-again') markDeckAgain();
}

document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-learning-open]');
  if (!target) return;
  openPanel(target.dataset.learningOpen);
});

document.addEventListener('keydown', (event) => {
  if (!panel?.classList.contains('is-open')) return;
  if (event.key === 'Escape') {
    closePanel();
    return;
  }
  if (page === 'quiz-play' && !quiz?.answered && ['1', '2', '3', '4'].includes(event.key)) {
    const question = quiz.questions[quiz.index];
    const choice = question.choices[Number(event.key) - 1];
    if (choice) answerQuiz(choice.id);
  }
});

const app = document.querySelector('#app');
if (app) {
  new MutationObserver(mountLearningEntries).observe(app, { childList: true, subtree: true });
  mountLearningEntries();
}
