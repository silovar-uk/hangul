const app = document.querySelector('#app');

const FINISH_STYLE_ID = 'hangul-quest-finish-style';

function ensureFinishStyles() {
  if (document.getElementById(FINISH_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = FINISH_STYLE_ID;
  style.textContent = `
    /* Finish 04 — visual rhythm: sections do not all breathe at one speed. */
    .home-shell.playable-home { --section-gap: 42px; }
    .home-shell .quest-map { margin-top: 46px; }
    .home-shell .discovery-notes { margin-top: 52px; }
    .home-shell .quiet-record { margin-top: 44px; }
    .home-shell .practice-surface { margin-top: 36px; }

    .home-shell .system-topbar {
      margin-bottom: 22px;
      border-bottom-color: rgba(23,26,43,.06);
    }

    .home-shell .quest-board,
    .home-shell .today-section.quest-board {
      min-height: 238px;
      border-color: rgba(23,26,43,.075) !important;
      box-shadow: 0 12px 30px rgba(31,31,45,.058) !important;
    }
    .home-shell .quest-board::before {
      width: 54px;
      height: 3px;
    }
    .home-shell .quest-board::after {
      content: "ㅇ";
      top: -42px;
      right: 16px;
      width: auto;
      height: auto;
      border: 0;
      border-radius: 0;
      color: var(--quest-stage-color);
      opacity: .055;
      font-size: 152px;
      font-weight: 780;
      line-height: 1;
    }
    .home-shell .quest-board .hero-copy-block::before {
      margin-bottom: 11px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: .055em;
    }
    .home-shell .quest-board .hero-copy-block h1 {
      max-width: 12.6em;
      font-size: clamp(35px, 4.65vw, 45px);
      font-weight: 760;
      letter-spacing: -.042em;
    }

    /* Finish 05 — one material language: surfaces, controls and information differ. */
    .home-shell .quest-board .quest-board-action {
      border-radius: 11px;
      box-shadow: 0 6px 15px rgba(217,74,67,.17);
    }
    .home-shell .quest-board .quest-board-action b,
    .home-shell .system-topbar .system-nav-symbol,
    .home-shell .quest-map .stage-icon,
    .home-shell .quest-map .stage-arrow,
    .home-shell .discovery-notes .field-note-row b {
      transition: transform .16s ease, box-shadow .16s ease;
    }
    .quest-board-dots { gap: 6px; margin-top: 12px; }
    .quest-board-dots i { height: 6px; }
    .quest-board-dots i.is-next {
      background: var(--quest-stage-color);
      box-shadow: 0 0 0 1px rgba(23,26,43,.04);
      transform: scaleY(1.16);
      transform-origin: center;
    }

    .quest-board-letters { gap: 6px; }
    .quest-board-letters span { border-color: rgba(23,26,43,.045); }
    .quest-board-letters span:nth-child(1) { background: #ffb7b1; }
    .quest-board-letters span:nth-child(2) {
      margin-top: 8px;
      background: #ffda73;
      transform: rotate(1deg);
    }
    .quest-board-letters span:nth-child(3) { background: #a6d4ff; }

    .home-shell .quest-map .stage-heading { margin-bottom: 15px; }
    .home-shell .quest-map .stage-heading h2 {
      font-size: 22px;
      font-weight: 750;
      letter-spacing: -.03em;
    }
    .home-shell .quest-map .stage-card,
    .home-shell .quest-map .stage-card:has(.status-open),
    .home-shell .quest-map .stage-card[data-map-state="current"] {
      border-bottom-color: rgba(23,26,43,.055) !important;
    }
    .home-shell .quest-map .stage-card[data-map-state="current"] {
      border-color: rgba(23,26,43,.09) !important;
      border-radius: 13px !important;
      box-shadow: 0 7px 18px rgba(31,31,45,.055) !important;
    }
    .home-shell .quest-map .stage-card[data-map-state="current"] .map-marker {
      border-color: var(--stage-color);
      background: var(--stage-color);
    }
    .home-shell .quest-map .stage-card[data-map-state="current"] h3::after {
      content: "• いまここ";
      margin-left: 8px;
      padding: 0;
      border-radius: 0;
      background: transparent;
      color: var(--accent-dark);
      font-size: 10px;
      font-weight: 700;
    }
    .home-shell .quest-map .stage-card[data-map-state="complete"] { opacity: .84; }
    .home-shell .quest-map .stage-card[data-map-state="locked"] { opacity: .31; }

    .home-shell .discovery-notes {
      padding-top: 27px;
      border-top-color: rgba(23,26,43,.10);
    }
    .home-shell .discovery-notes::before { width: 2px; }
    .home-shell .discovery-notes .field-note-row:nth-child(even) {
      width: calc(100% - 5px);
      margin-left: 5px;
    }

    .home-shell .quiet-record {
      border-top-color: rgba(23,26,43,.09);
    }
    .home-shell .quiet-record .mini-stat + .mini-stat {
      border-left-color: rgba(23,26,43,.075);
    }
    .home-shell .quiet-record .mini-stat strong { font-weight: 700; }

    .home-shell .practice-surface {
      border-color: rgba(23,26,43,.07);
      border-radius: 14px;
      background: rgba(255,253,248,.62);
    }
    .home-shell .practice-surface .segment-control {
      background: rgba(225,218,205,.68);
    }
    .home-shell .practice-surface .segment-button.is-active {
      box-shadow: 0 2px 6px rgba(31,31,45,.06);
    }

    /* Finish 06 — delight appears on interaction, not as permanent noise. */
    @media (hover: hover) {
      .home-shell .system-topbar .system-nav-button:hover .system-nav-symbol {
        transform: translateY(-1px);
      }
      .home-shell .quest-board .quest-board-action:hover b {
        transform: translateX(2px) rotate(-3deg);
      }
      .home-shell .quest-board:hover .quest-board-letters span:nth-child(1) {
        transform: translateY(-2px) rotate(-1deg);
      }
      .home-shell .quest-board:hover .quest-board-letters span:nth-child(2) {
        transform: translateY(1px) rotate(2deg);
      }
      .home-shell .quest-map .stage-card:hover:not(:disabled):not([data-map-state="current"]) {
        transform: translateX(2px);
        background: rgba(255,253,248,.48) !important;
      }
      .home-shell .quest-map .stage-card[data-map-state="current"]:hover .stage-icon {
        transform: translateY(-2px) scale(1.035);
        box-shadow: 0 6px 14px rgba(31,31,45,.08);
      }
      .home-shell .quest-map .stage-card[data-map-state="current"]:hover .stage-arrow {
        transform: translateX(3px);
      }
      .home-shell .discovery-notes .field-note-row:hover b {
        transform: translateX(3px);
      }
    }

    @media (max-width: 620px) {
      .home-shell.playable-home { --section-gap: 34px; }
      .home-shell .quest-map { margin-top: 38px; }
      .home-shell .discovery-notes { margin-top: 42px; }
      .home-shell .quiet-record { margin-top: 36px; }
      .home-shell .practice-surface { margin-top: 31px; }
      .home-shell .quest-board::after { top: -22px; right: 6px; font-size: 102px; opacity: .042; }
      .home-shell .quest-board .hero-copy-block h1 { padding-right: 52px; }
    }

    @media (prefers-reduced-motion: reduce) {
      .home-shell .quest-board .quest-board-action b,
      .home-shell .system-topbar .system-nav-symbol,
      .home-shell .quest-map .stage-icon,
      .home-shell .quest-map .stage-arrow,
      .home-shell .discovery-notes .field-note-row b { transition: none !important; }
    }
  `;
  document.head.append(style);
}

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

function syncCurrentStage(home) {
  const board = home.querySelector('.quest-board');
  const current = home.querySelector('.quest-map .stage-card[data-map-state="current"]');
  if (!board || !current) return;

  const stageColor = getComputedStyle(current).getPropertyValue('--stage-color').trim();
  if (stageColor) board.style.setProperty('--quest-stage-color', stageColor);
  current.setAttribute('aria-current', 'step');

  const currentGlyph = current.querySelector('.stage-icon')?.textContent?.trim();
  const leadGlyph = board.querySelector('.quest-board-letters span:first-child');
  if (leadGlyph && currentGlyph && currentGlyph.length <= 2 && leadGlyph.dataset.stageGlyph !== currentGlyph) {
    leadGlyph.dataset.stageGlyph = currentGlyph;
    leadGlyph.textContent = currentGlyph;
  }
}

function polishHome() {
  const home = app?.querySelector('.home-shell');
  if (!home) return;
  ensureFinishStyles();
  polishTopbar(home);
  reshapeQuestBoard(home);
  simplifySectionHeadings(home);
  markHierarchy(home);
  syncCurrentStage(home);
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
