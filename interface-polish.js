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
  if (title && title.textContent !== 'ハングル・クエスト') title.textContent = 'ハングル・クエスト';

  setNavIcon(topbar.querySelector('[data-learning-open="hub"]'), '単', '単語');
  setNavIcon(topbar.querySelector('[data-action="show-stats"]'), '▥', '成績');
  setNavIcon(topbar.querySelector('[data-action="settings"]'), '⚙', '設定');
}

function reshapeOpening(home) {
  const hero = home.querySelector('.today-section, .hero');
  if (!hero || hero.dataset.openingReady === 'true') return;
  hero.dataset.openingReady = 'true';
  hero.classList.add('opening-spread');

  hero.querySelector('.hero-kicker')?.remove();
  hero.querySelector('.hero-copy')?.remove();
  hero.querySelector('.level-panel')?.remove();

  const heading = hero.querySelector('h1');
  if (heading) {
    const complete = /ノルマ達成|クリア済み|達成/.test(heading.textContent || '');
    heading.innerHTML = complete
      ? '<span class="hero-copy-lead">今日の5問は完了。</span> <span class="hero-copy-follow">もう少しやるなら、ここから。</span>'
      : '<span class="hero-copy-lead">今日は5問だけ。</span> <span class="hero-copy-follow">読める文字を、少し増やす。</span>';
  }

  const quest = hero.querySelector('.quest-panel');
  if (quest) {
    const ring = quest.querySelector('.quest-ring');
    const degrees = Number.parseFloat(ring?.style.getPropertyValue('--quest-progress')) || 0;
    const ratio = Math.max(0, Math.min(100, Math.round((degrees / 360) * 100)));
    const answered = ring?.querySelector('strong')?.textContent?.trim() || '0';
    const totalText = ring?.querySelector('span')?.textContent || '/5問';
    const total = totalText.match(/\d+/)?.[0] || '5';
    const status = quest.querySelector('.quest-panel-copy strong')?.textContent?.trim() || '';

    quest.classList.add('opening-progress');
    quest.setAttribute('aria-label', `今日の進捗 ${answered}/${total}`);
    quest.innerHTML = `
      <div class="opening-progress-count"><strong>${answered}</strong><span>/ ${total}</span></div>
      <div class="opening-progress-track" aria-hidden="true"><i style="width:${ratio}%"></i></div>
      <small>${status}</small>
    `;
  }

  const primary = hero.querySelector('.primary-button--hero');
  if (primary) {
    primary.classList.add('opening-action');
    hero.append(primary);
  }
  hero.querySelector('.hero-actions')?.remove();
}

function simplifySectionHeadings(home) {
  const location = home.querySelector('.current-location-section');
  location?.querySelector('.section-kicker')?.remove();
  location?.querySelector('.stage-heading p')?.remove();

  const record = home.querySelector('.record-section');
  record?.querySelector('.section-kicker')?.remove();

  const practice = home.querySelector('.practice-config');
  practice?.querySelector('.section-kicker')?.remove();

  const weakLabel = home.querySelector('.practice-weak-action .rival-copy span');
  if (weakLabel && weakLabel.textContent !== '苦手') weakLabel.textContent = '苦手';

  home.querySelector('.starter-title span')?.remove();
}

function markEditorialLayout(home) {
  home.classList.add('editorial-home');
  home.querySelector('.current-location-section')?.classList.add('editorial-map');
  home.querySelector('.field-notes-section')?.classList.add('editorial-notes');
  home.querySelector('.record-section')?.classList.add('editorial-record');
  home.querySelector('.practice-config')?.classList.add('editorial-practice');
}

function polishHome() {
  const home = app?.querySelector('.home-shell');
  if (!home) return;
  polishTopbar(home);
  reshapeOpening(home);
  simplifySectionHeadings(home);
  markEditorialLayout(home);
}

if (app) {
  const observer = new MutationObserver(polishHome);
  observer.observe(app, { childList: true, subtree: true });
  polishHome();
}
