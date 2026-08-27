const app = document.querySelector('#app');

const HOME_SNAPSHOT_KEY = 'hangulQuest.homeSnapshot.v1';
const MASTERY_THRESHOLD = 75;

function numberFrom(value = '') {
  const match = String(value).replaceAll(',', '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function numbersFrom(value = '') {
  return [...String(value).replaceAll(',', '').matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
}

function loadHomeSnapshot() {
  try {
    const raw = sessionStorage.getItem(HOME_SNAPSHOT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function buildNode(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function microRewardCopy(game, feedback) {
  const glyph = feedback.querySelector('.feedback-parts b')?.textContent?.trim() || 'この文字';
  const coordinate = feedback.querySelector('.insight-coordinate > span')?.textContent?.trim() || '';
  const compareLabel = feedback.querySelector('.insight-compare b')?.textContent?.trim() || '';
  const compareDetail = feedback.querySelector('.insight-compare span')?.textContent?.trim() || '';
  const isRetry = Boolean(game.querySelector('.retry-pill'));

  if (isRetry) {
    return {
      title: `「${glyph}」を見分け直せた。`,
      detail: coordinate ? `${coordinate}を手掛かりに、さっきの迷いを取り返した。` : '同じ文字をもう一度選び直して、区別を一段確かにした。'
    };
  }

  if (coordinate) {
    return {
      title: `${glyph}：${coordinate}`,
      detail: compareLabel && compareDetail ? `${compareLabel}　${compareDetail}` : '音の名前だけでなく、違いの軸でも見分ける。'
    };
  }

  if (compareLabel && compareDetail) {
    return {
      title: `${compareLabel} の違いを確認。`,
      detail: compareDetail
    };
  }

  return {
    title: `「${glyph}」を1回見分けた。`,
    detail: '形と読みの結びつきを、もう一度確かめた。'
  };
}

function enhanceFeedback() {
  const game = app?.querySelector('.game-shell');
  const feedback = game?.querySelector('.feedback.is-correct');
  const learning = feedback?.querySelector('.feedback-learning');
  if (!game || !feedback || !learning) return;

  const copy = microRewardCopy(game, feedback);
  const signature = `${copy.title}|${copy.detail}`;
  let reward = feedback.querySelector('.learning-reward--micro');

  if (!reward) {
    reward = buildNode('div', 'learning-reward learning-reward--micro');
    reward.setAttribute('role', 'status');
    reward.setAttribute('aria-live', 'polite');
  }

  if (reward.dataset.signature !== signature) {
    const label = buildNode('span', 'learning-reward-label', '見分け方');
    const body = buildNode('div', 'learning-reward-body');
    body.append(
      buildNode('strong', '', copy.title),
      buildNode('small', '', copy.detail)
    );
    reward.replaceChildren(label, body);
    reward.dataset.signature = signature;
  }

  // experience-layer may add the formal comparison after the first pass.
  // Move the reward only when needed so MutationObserver does not loop on itself.
  if (learning.lastElementChild !== reward) learning.append(reward);
}

function readGrowthItems(result) {
  return [...result.querySelectorAll('.growth-list > div')].map((row) => {
    const glyph = row.querySelector('b')?.textContent?.trim() || '';
    const reading = row.querySelector('span')?.textContent?.trim() || '';
    const gainNode = row.querySelector('em');
    const masteryNode = row.querySelector('small');
    const gainText = gainNode?.textContent ?? '0';
    const after = numberFrom(masteryNode?.textContent ?? '0');
    const deltaNumbers = numbersFrom(gainText);
    const hasBeforeAfter = gainText.includes('→') && deltaNumbers.length >= 2;
    const before = hasBeforeAfter ? deltaNumbers[0] : Math.max(0, after - numberFrom(gainText));
    const gain = hasBeforeAfter ? Math.max(0, deltaNumbers[1] - deltaNumbers[0]) : numberFrom(gainText);
    const newlyMastered = before < MASTERY_THRESHOLD && after >= MASTERY_THRESHOLD;
    return { row, glyph, reading, gainNode, masteryNode, gain, after, before, newlyMastered };
  });
}

function resultRewardCopy(result, growthItems) {
  const snapshot = loadHomeSnapshot();
  const resultLead = result.querySelector('.result-card > p')?.textContent?.trim() || '';
  const stageUnlocked = /STAGE\s*\d+.*開きました/.test(resultLead);
  const dailyComplete = Boolean(result.querySelector('.daily-result.is-complete'));
  const dailyJustCompleted = Boolean(snapshot && !snapshot.dailyComplete && dailyComplete);
  const newlyMastered = growthItems.filter((item) => item.newlyMastered);

  if (stageUnlocked) {
    return {
      level: 'strong',
      label: '進んだこと',
      title: '次の場所が開いた。',
      detail: 'ここまで積み重ねた見分け方が、そのまま次のステージにつながった。'
    };
  }

  if (dailyJustCompleted) {
    return {
      level: 'medium',
      label: '今日の区切り',
      title: '今日の5問、完了。',
      detail: '一気に覚えるより、短く終えて、明日もう一度見分ける。'
    };
  }

  if (newlyMastered.length) {
    const glyphs = newlyMastered.map((item) => item.glyph).filter(Boolean).join('・');
    return {
      level: 'quiet',
      label: '見えるようになったこと',
      title: `${glyphs} の見分け方が定着。`,
      detail: 'このプレイで習熟75%を越えた文字。点数ではなく、区別できる状態が残った。'
    };
  }

  if (growthItems.length) {
    const glyphs = growthItems.slice(0, 3).map((item) => item.glyph).filter(Boolean).join('・');
    return {
      level: 'quiet',
      label: '今回の変化',
      title: glyphs ? `${glyphs} の見分け方が前進。` : '見分け方が少し前進。',
      detail: '正解数だけでなく、文字ごとの区別しやすさが少しずつ残っていく。'
    };
  }

  return null;
}

function enhanceGrowthPanel(result, growthItems) {
  const heading = result.querySelector('.growth-panel h3');
  if (heading) heading.textContent = '今回、見え方が変わった文字';

  growthItems.forEach((item) => {
    item.row.classList.toggle('is-newly-mastered', item.newlyMastered);
    item.row.dataset.rewardState = item.newlyMastered ? 'mastered' : 'advanced';
    if (item.gainNode) {
      item.gainNode.textContent = item.newlyMastered ? '見分け方が定着' : '見分け方が前進';
    }
    if (item.masteryNode) {
      item.masteryNode.textContent = `習熟 ${item.before}% → ${item.after}%`;
      item.masteryNode.setAttribute('aria-label', `習熟度が${item.before}パーセントから${item.after}パーセントへ`);
    }
  });
}

function enhanceResult() {
  const result = app?.querySelector('.result-shell');
  const card = result?.querySelector('.result-card');
  if (!result || !card || card.dataset.learningRewardReady === 'true') return;

  const growthItems = readGrowthItems(result);
  enhanceGrowthPanel(result, growthItems);

  // Confusion practice already has one dedicated WHAT CHANGED reflection.
  // Do not stack a second generic reward summary on the same result.
  if (result.querySelector('.confusion-result')) {
    card.dataset.learningRewardReady = 'true';
    return;
  }

  const copy = resultRewardCopy(result, growthItems);
  if (copy) {
    const summary = buildNode('section', 'learning-reward learning-reward--summary');
    summary.dataset.rewardLevel = copy.level;
    summary.setAttribute('aria-label', '学習の変化');

    const label = buildNode('span', 'learning-reward-label', copy.label);
    const body = buildNode('div', 'learning-reward-body');
    body.append(
      buildNode('strong', '', copy.title),
      buildNode('small', '', copy.detail)
    );
    summary.append(label, body);

    const lead = card.querySelector(':scope > p');
    if (lead) lead.after(summary);
    else card.prepend(summary);

    card.dataset.rewardLevel = copy.level;
    if (copy.level === 'strong') card.classList.add('has-stage-reward');
    if (copy.level === 'medium') card.classList.add('has-daily-reward');
  }

  card.dataset.learningRewardReady = 'true';
}

function enhance() {
  enhanceFeedback();
  enhanceResult();
}

if (app) {
  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      enhance();
    });
  });

  observer.observe(app, { childList: true, subtree: true });
  requestAnimationFrame(enhance);
}
