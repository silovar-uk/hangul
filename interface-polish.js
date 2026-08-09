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

function polishHero(home) {
  const hero = home.querySelector('.today-section, .hero');
  if (!hero) return;

  hero.querySelector('.hero-kicker')?.remove();

  const heading = hero.querySelector('h1');
  if (heading && heading.dataset.copyPolished !== 'true') {
    const complete = /ノルマ達成|クリア済み|達成/.test(heading.textContent || '');
    heading.innerHTML = complete
      ? '<span class="hero-copy-lead">今日の5問は完了。</span> <span class="hero-copy-follow">もう少しやるなら、ここから。</span>'
      : '<span class="hero-copy-lead">今日は5問だけ。</span> <span class="hero-copy-follow">読める文字を、少し増やす。</span>';
    heading.dataset.copyPolished = 'true';
  }

  hero.querySelector('.quest-panel-copy > span')?.remove();
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

function polishHome() {
  const home = app?.querySelector('.home-shell');
  if (!home) return;
  polishTopbar(home);
  polishHero(home);
  simplifySectionHeadings(home);
}

if (app) {
  const observer = new MutationObserver(polishHome);
  observer.observe(app, { childList: true, subtree: true });
  polishHome();
}
