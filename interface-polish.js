const app = document.querySelector('#app');

function setNavIcon(button, symbol, label) {
  if (!button) return;
  if (button.dataset.systemNavSymbol === symbol) return;
  button.dataset.systemNavSymbol = symbol;
  button.classList.add('system-nav-button');
  button.setAttribute('aria-label', label);
  button.setAttribute('title', label);
  button.innerHTML = `<span class="system-nav-symbol" aria-hidden="true">${symbol}</span>`;
}

function polishTopbar(home) {
  const topbar = home.querySelector('.topbar');
  if (!topbar) return;
  topbar.classList.add('system-topbar');

  home.querySelector('.brand-text small')?.remove();

  const title = home.querySelector('.brand-text strong');
  if (title && title.textContent !== 'ハングル・クエスト') {
    title.textContent = 'ハングル・クエスト';
  }

  setNavIcon(topbar.querySelector('[data-learning-open="hub"]'), '単', '単語');
  setNavIcon(topbar.querySelector('[data-action="show-stats"]'), '▥', '成績');
  setNavIcon(topbar.querySelector('[data-action="settings"]'), '⚙', '設定');
}

function progressDots(answered, total) {
  const safeTotal = Math.max(1, Math.min(10, total));
  return Array.from({ length: safeTotal }, (_, index) => {
    const state = index < answered ? 'is-done' : index === answered ? 'is-next' : '';
    return `<i class="${state}" aria-hidden="true"></i>`;
  }).join('');
}

function reshapeQuestBoard(home) {
  const hero = home.querySelector('.today-section, .hero');
  if (!hero || hero.dataset.questBoardReady === 'true') return;
  hero.dataset.questBoardReady = 'true';
  hero.classList.remove('opening-spread');
  hero.classList.add('quest-board');

  hero.querySelector('.hero-kicker')?.remove();
  hero.querySelector('.hero-copy')?.remove();
  hero.querySelector('.level-panel')?.remove();
  hero.querySelector('.secondary-button--dark')?.remove();

  const heading = hero.querySelector('h1');
  if (heading) {
    const complete = /ノルマ達成|クリア済み|達成|完了/.test(heading.textContent || '');
    heading.innerHTML = complete
      ? '<span class="hero-copy-lead">今日の5問は完了。</span> <span class="hero-copy-follow">もう少し遊ぶなら、ここから。</span>'
      : '<span class="hero-copy-lead">今日は5問だけ。</span> <span class="hero-copy-follow">読める文字を、少し増やす。</span>';
  }

  const quest = hero.querySelector('.quest-panel');
  if (quest) {
    const ring = quest.querySelector('.quest-ring');
    const answered = Number(ring?.querySelector('strong')?.textContent?.trim()) || 0;
    const totalText = ring?.querySelector('span')?.textContent || '/5問';
    const total = Number(totalText.match(/\d+/)?.[0]) || 5;
    const status = quest.querySelector('.quest-panel-copy strong')?.textContent?.trim()
      || (answered >= total ? 'クリア' : `あと${Math.max(0, total - answered)}問`);

    quest.className = 'quest-board-progress';
    quest.setAttribute('aria-label', `今日の進捗 ${answered}/${total}`);
    quest.innerHTML = `
      <div class="quest-board-progress-copy">
        <strong>${answered}<span> / ${total}</span></strong>
        <small>${status}</small>
      </div>
      <div class="quest-board-dots" aria-hidden="true">${progressDots(answered, total)}</div>
    `;
  }

  const actions = hero.querySelector('.hero-actions');
  const primary = hero.querySelector('.primary-button--hero');
  if (actions) actions.classList.add('quest-board-actions');
  if (primary) {
    primary.classList.remove('opening-action');
    primary.classList.add('quest-board-action');
    const text = primary.querySelector('span');
    if (text && !/続きから|ボーナス/.test(text.textContent || '')) text.textContent = '続きから5問';
  }

  if (!hero.querySelector('.quest-board-letters')) {
    const letters = document.createElement('div');
    letters.className = 'quest-board-letters';
    letters.setAttribute('aria-hidden', 'true');
    letters.innerHTML = '<span>ㅏ</span><span>ㅇ</span><span>ㅡ</span>';
    hero.append(letters);
  }
}

function simplifySectionHeadings(home) {
  const location = home.querySelector('.current-location-section');
  location?.querySelector('.section-kicker')?.remove();
  location?.querySelector('.stage-heading p')?.remove();
  const locationTitle = location?.querySelector('.stage-heading h2');
  if (locationTitle && locationTitle.textContent !== 'いまのステージ') {
    locationTitle.textContent = 'いまのステージ';
  }

  const record = home.querySelector('.record-section');
  record?.querySelector('.section-kicker')?.remove();

  const practice = home.querySelector('.practice-config');
  practice?.querySelector('.section-kicker')?.remove();

  const weakLabel = home.querySelector('.practice-weak-action .rival-copy span');
  if (weakLabel && weakLabel.textContent !== '苦手') weakLabel.textContent = '苦手';

  home.querySelector('.starter-title span')?.remove();
}

function markHierarchy(home) {
  if (home.classList.contains('editorial-home')) home.classList.remove('editorial-home');
  if (!home.classList.contains('playable-home')) home.classList.add('playable-home');

  const location = home.querySelector('.current-location-section');
  if (location?.classList.contains('editorial-map')) location.classList.remove('editorial-map');
  if (location && !location.classList.contains('quest-map')) location.classList.add('quest-map');

  const notes = home.querySelector('.field-notes-section');
  if (notes?.classList.contains('editorial-notes')) notes.classList.remove('editorial-notes');
  if (notes && !notes.classList.contains('discovery-notes')) notes.classList.add('discovery-notes');

  const record = home.querySelector('.record-section');
  if (record?.classList.contains('editorial-record')) record.classList.remove('editorial-record');
  if (record && !record.classList.contains('quiet-record')) record.classList.add('quiet-record');

  const practice = home.querySelector('.practice-config');
  if (practice?.classList.contains('editorial-practice')) practice.classList.remove('editorial-practice');
  if (practice && !practice.classList.contains('practice-surface')) practice.classList.add('practice-surface');
}

function polishHome() {
  const home = app?.querySelector('.home-shell');
  if (!home) return;
  polishTopbar(home);
  reshapeQuestBoard(home);
  simplifySectionHeadings(home);
  markHierarchy(home);
}

if (app) {
  let scheduled = false;
  let observer;

  const observe = () => {
    observer.observe(app, { childList: true, subtree: true });
  };

  const schedulePolish = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      observer.disconnect();
      polishHome();
      observe();
    });
  };

  observer = new MutationObserver(schedulePolish);
  observe();
  schedulePolish();
}
