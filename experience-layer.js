import { getRecentNotes } from './notes-store.js';

const app = document.querySelector('#app');

const VOWEL_INSIGHTS = {
  'ㅏ': {
    short: ['低', '後', '非円唇'],
    formal: ['低母音', '後舌母音', '非円唇母音'],
    compare: 'ㅓ',
    difference: 'どちらも唇は丸めない。ㅏの方が舌を低くして発音する。',
    trap: '日本語の「ア」だけで覚えず、舌の高さも手掛かりにする。'
  },
  'ㅓ': {
    short: ['中〜中低', '後', '非円唇'],
    formal: ['中〜中低母音', '後舌母音', '非円唇母音'],
    compare: 'ㅗ',
    difference: 'どちらも後ろ寄り。ㅗは円唇、ㅓは非円唇。',
    trap: '「オとアの中間」と丸暗記しない。ㅗとの違いは、まず唇を見る。'
  },
  'ㅗ': {
    short: ['中', '後', '円唇'],
    formal: ['中母音', '後舌母音', '円唇母音'],
    compare: 'ㅜ',
    difference: 'どちらも後舌・円唇。主な違いは舌の高さ。',
    trap: '日本語の「オ」という名前より、唇を丸めることを手掛かりにする。'
  },
  'ㅜ': {
    short: ['高', '後', '円唇'],
    formal: ['高母音', '後舌母音', '円唇母音'],
    compare: 'ㅡ',
    difference: 'どちらも高い母音。ㅜは円唇、ㅡは非円唇。',
    trap: '日本語の「ウ」より、唇をはっきり丸める。'
  },
  'ㅡ': {
    short: ['高', '中央〜後', '非円唇'],
    formal: ['高母音', '中舌〜後舌母音', '非円唇母音'],
    compare: 'ㅜ',
    difference: 'どちらも高い母音。ㅡでは唇を丸めない。',
    trap: '日本語の「ウ」に引っ張られて、唇を丸めない。'
  },
  'ㅣ': {
    short: ['高', '前', '非円唇'],
    formal: ['高母音', '前舌母音', '非円唇母音'],
    compare: 'ㅡ',
    difference: 'どちらも高・非円唇。違いは舌の前後。',
    trap: '「イ」というカタカナだけでなく、舌が前にあることを見る。'
  },
  'ㅐ': {
    short: ['前', '非円唇', 'ㅔと近い'],
    formal: ['前舌母音', '非円唇母音'],
    compare: 'ㅔ',
    difference: '現代ソウル語では、ㅐとㅔの発音差が小さい話者が多い。',
    trap: '口の開きだけで無理に差を作らず、まず文字として区別する。'
  },
  'ㅔ': {
    short: ['前', '非円唇', 'ㅐと近い'],
    formal: ['前舌母音', '非円唇母音'],
    compare: 'ㅐ',
    difference: '現代ソウル語では、ㅔとㅐの発音差が小さい話者が多い。',
    trap: '発音を誇張して覚えるより、綴りとしての違いを先に定着させる。'
  }
};

function upgradeHome(home) {
  if (home.dataset.experienceReady === 'true') {
    refreshFieldNotes(home);
    normalizeHomeOrder(home);
    return;
  }
  home.dataset.experienceReady = 'true';

  const brandSub = home.querySelector('.brand-text small');
  if (brandSub) brandSub.textContent = 'SEE THE DIFFERENCE';

  const hero = home.querySelector('.hero');
  if (hero) {
    hero.classList.add('today-section');
    const kicker = hero.querySelector('.hero-kicker');
    if (kicker) kicker.innerHTML = '<span class="live-dot"></span> TODAY';
    const primary = hero.querySelector('.primary-button--hero span');
    if (primary && primary.textContent.includes('今日の5問')) primary.textContent = '続きから5問';
    hero.querySelector('.level-panel')?.remove();
  }

  const stageHeading = home.querySelector('.stage-heading');
  const stageGrid = home.querySelector('.stage-grid');
  if (stageHeading && stageGrid) {
    const location = document.createElement('section');
    location.className = 'current-location-section';
    const kicker = stageHeading.querySelector('.section-kicker');
    if (kicker) kicker.textContent = 'CURRENT LOCATION';
    const h2 = stageHeading.querySelector('h2');
    if (h2) h2.textContent = 'いまの場所';
    const p = stageHeading.querySelector('p');
    if (p) p.textContent = '終わった場所と、次に進む場所だけを見る。';
    stageHeading.before(location);
    location.append(stageHeading, stageGrid);
    buildRoute(stageGrid);
  }

  const dashboard = home.querySelector('.dashboard-grid');
  const practice = home.querySelector('.practice-config');
  if (dashboard) {
    const rival = dashboard.querySelector('.rival-card');
    const stats = dashboard.querySelector('.mini-stats');

    if (stats) {
      const record = document.createElement('section');
      record.className = 'record-section';
      record.innerHTML = '<div class="section-heading"><div><span class="section-kicker">YOUR RECORD</span><h2>学習の記録</h2></div></div>';
      const existingStatsButton = practice?.querySelector('[data-action="show-stats"]');
      if (existingStatsButton) {
        existingStatsButton.textContent = '詳しく見る →';
        record.querySelector('.section-heading')?.append(existingStatsButton);
      }
      stats.classList.add('record-values');
      record.append(stats);
      if (practice) practice.before(record);
      else dashboard.after(record);
    }

    if (rival && practice) {
      rival.classList.add('practice-weak-action');
      const copy = rival.querySelector('.rival-copy strong');
      if (copy) copy.textContent = '苦手だけ練習する';
      const label = rival.querySelector('.rival-copy span');
      if (label) label.textContent = 'WEAK POINTS';
      practice.append(rival);
    }

    dashboard.remove();
  }

  if (practice) {
    const kicker = practice.querySelector('.section-kicker');
    if (kicker) kicker.textContent = 'PRACTICE';
    const heading = practice.querySelector('h2');
    if (heading) heading.textContent = '練習を選ぶ';
  }

  const location = home.querySelector('.current-location-section');
  const notes = createFieldNotesSection();
  if (location) location.after(notes);
  else if (practice) practice.before(notes);
  else home.append(notes);

  refreshFieldNotes(home);
  normalizeHomeOrder(home);
}

function normalizeHomeOrder(home) {
  const hero = home.querySelector('.today-section');
  if (!hero) return;
  const desired = [
    home.querySelector('.current-location-section'),
    home.querySelector('.field-notes-section'),
    home.querySelector('.record-section'),
    home.querySelector('.practice-config'),
    home.querySelector('.learning-expansion')
  ].filter(Boolean);

  let cursor = hero;
  for (const node of desired) {
    if (cursor.nextElementSibling !== node) cursor.after(node);
    cursor = node;
  }
}

function buildRoute(stageGrid) {
  if (!stageGrid.querySelector('.route-rail')) {
    const rail = document.createElement('div');
    rail.className = 'route-rail';
    rail.setAttribute('aria-hidden', 'true');
    stageGrid.prepend(rail);
  }

  const cards = [...stageGrid.querySelectorAll('.stage-card')];
  let currentAssigned = false;
  let currentIndex = -1;
  cards.forEach((card, index) => {
    const status = card.querySelector('.stage-status');
    let state = 'available';
    if (card.disabled || status?.classList.contains('status-locked')) state = 'locked';
    else if (status?.classList.contains('status-master') || status?.classList.contains('status-cleared')) state = 'complete';
    else if (!currentAssigned && status?.classList.contains('status-open')) {
      state = 'current';
      currentAssigned = true;
      currentIndex = index;
    }

    card.dataset.mapState = state;
    const rail = card.querySelector('.stage-rail');
    if (rail && !rail.querySelector('.map-marker')) {
      const marker = document.createElement('span');
      marker.className = 'map-marker';
      marker.setAttribute('aria-hidden', 'true');
      rail.prepend(marker);
    }
  });

  const routeProgress = currentIndex < 0
    ? 100
    : cards.length <= 1 ? 100 : Math.round((currentIndex / (cards.length - 1)) * 100);
  stageGrid.style.setProperty('--route-progress', `${routeProgress}%`);
}

function createFieldNotesSection() {
  const section = document.createElement('section');
  section.className = 'field-notes-section';
  section.innerHTML = `
    <div class="section-heading field-notes-heading">
      <div><span class="section-kicker">FIELD NOTES</span><h2>気づいたこと</h2><p>自分で見つけた違いを、短く残す。</p></div>
      <div class="field-notes-actions"><button type="button" class="text-button" data-note-open="general">＋ メモ</button><button type="button" class="text-button" data-notes-list>すべて見る →</button></div>
    </div>
    <div class="field-notes-preview"></div>
  `;
  return section;
}

function refreshFieldNotes(home = document.querySelector('.home-shell')) {
  const preview = home?.querySelector('.field-notes-preview');
  if (!preview) return;
  const notes = getRecentNotes(3);
  const signature = JSON.stringify(notes.map((note) => [note.id, note.updatedAt, note.body]));
  if (preview.dataset.notesSignature === signature) return;
  preview.dataset.notesSignature = signature;
  preview.innerHTML = notes.length
    ? notes.map((note) => `
      <button type="button" class="field-note-row" data-note-id="${escapeHtml(note.id)}">
        <strong>${escapeHtml(note.targetLabel || 'MEMO')}</strong>
        <span>${escapeHtml(note.body)}</span>
        <b>→</b>
      </button>
    `).join('')
    : `
      <div class="field-notes-empty">
        <span>まだメモはありません。</span>
        <button type="button" data-note-open="general">＋ メモを書く</button>
      </div>
    `;
}

function contextualTrap(parts, stageLabel, vowel) {
  const first = parts[0];
  const last = parts.at(-1);
  if (stageLabel.includes('似た音')) {
    const strong = {
      'ㅋ': '日本語の「カ」だけで覚えず、息を強く出す激音として聞く。',
      'ㄲ': '小さい「ッ」を足すだけでなく、息を抑えて強く詰める濃音として区別する。',
      'ㅌ': '日本語の「タ」より、息の強さを手掛かりにする。',
      'ㄸ': '小さい「ッ」だけに頼らず、息を抑えた濃音として覚える。',
      'ㅍ': '日本語の「パ」より、強い呼気を意識する。',
      'ㅃ': '「ッパ」という表記より、息を抑えた緊張の強さを見る。',
      'ㅊ': '「チャ」だけでなく、強い呼気を伴う激音として区別する。',
      'ㅉ': '「ッチャ」だけでなく、息を抑えた濃音として区別する。'
    };
    if (strong[first]) return strong[first];
  }
  if (stageLabel.includes('パッチム') || stageLabel.includes('下につく文字')) {
    const batchim = {
      'ㄴ': '日本語の「ン」一種類で済ませず、舌先を上の歯ぐきにつける。',
      'ㅇ': '日本語の「ン」一種類で済ませず、舌先をつけず鼻の奥で響かせる。',
      'ㅁ': '日本語の「ン」一種類で済ませず、最後に唇を閉じる。',
      'ㄹ': '日本語の「ル」を足さず、舌先を当てた位置で止める。',
      'ㅂ': '語末に「プ」をはっきり足さず、唇を閉じて止める。'
    };
    if (batchim[last]) return batchim[last];
  }
  return VOWEL_INSIGHTS[vowel]?.trap || '';
}

function upgradeGame(game) {
  const feedback = game.querySelector('.feedback');
  if (!feedback || feedback.dataset.insightReady === 'true') return;
  feedback.dataset.insightReady = 'true';

  const learning = feedback.querySelector('.feedback-learning');
  const parts = [...feedback.querySelectorAll('.feedback-parts i')].map((item) => item.textContent.trim());
  const vowel = parts.find((part) => VOWEL_INSIGHTS[part]);
  const hangul = feedback.querySelector('.feedback-parts b')?.textContent.trim() || '';
  const stageLabel = game.querySelector('.game-progress-label span')?.textContent.trim() || '';

  if (learning && vowel) {
    const insight = VOWEL_INSIGHTS[vowel];
    const block = document.createElement('section');
    block.className = 'learning-insight';
    block.innerHTML = `
      <div class="insight-coordinate">
        <span>${insight.short.map(escapeHtml).join(' ・ ')}</span>
        <small>${insight.formal.map(escapeHtml).join(' ／ ')}</small>
      </div>
      <div class="insight-compare"><b>${escapeHtml(vowel)} ↔ ${escapeHtml(insight.compare)}</b><span>${escapeHtml(insight.difference)}</span></div>
      <div class="japanese-trap"><strong>JAPANESE TRAP</strong><p>${escapeHtml(contextualTrap(parts, stageLabel, vowel))}</p></div>
    `;
    learning.append(block);
  }

  const next = feedback.querySelector('[data-action="next-question"]');
  if (next && !feedback.querySelector('[data-note-open]')) {
    const note = document.createElement('button');
    note.type = 'button';
    note.className = 'feedback-note-button';
    note.dataset.noteOpen = 'character';
    const noteTarget = vowel || hangul;
    note.dataset.noteTargetId = `${vowel ? 'vowel' : 'hangul'}:${noteTarget}`;
    note.dataset.noteTargetLabel = noteTarget;
    note.textContent = `＋ ${noteTarget || 'この文字'}にメモ`;
    next.before(note);
  }
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function enhance() {
  const home = app?.querySelector('.home-shell');
  if (home) upgradeHome(home);
  const game = app?.querySelector('.game-shell');
  if (game) upgradeGame(game);
}

if (app) {
  new MutationObserver(enhance).observe(app, { childList: true, subtree: true });
  enhance();
}

window.addEventListener('hangul-notes-changed', () => refreshFieldNotes());
