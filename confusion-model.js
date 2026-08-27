import { ALL_ITEMS } from './data.js';

const ACTIVE_SCORE = 55;
const RECOVERING_SCORE = 20;

const VOWEL_HINTS = {
  'ㅏ|ㅓ': { dimension: '舌の高さ', clue: 'ㅏの方が舌を低くし、ㅓは少し高い位置で出す。' },
  'ㅓ|ㅗ': { dimension: '唇', clue: 'ㅓは唇を丸めず、ㅗは丸める。' },
  'ㅗ|ㅜ': { dimension: '舌の高さ', clue: 'どちらも唇を丸める。ㅗよりㅜの方が舌が高い。' },
  'ㅜ|ㅡ': { dimension: '唇', clue: 'ㅜは唇を丸め、ㅡは唇を横に保つ。' },
  'ㅡ|ㅣ': { dimension: '舌の前後', clue: 'どちらも唇を丸めない。ㅣの方が舌を前に置く。' },
  'ㅐ|ㅔ': { dimension: '文字の形', clue: '発音差が小さいので、まず綴りとして形を見分ける。' }
};

const CONSONANT_HINTS = {
  'ㄱ|ㅋ': { dimension: '息の強さ', clue: 'ㅋはㄱより強く息を出す。' },
  'ㄱ|ㄲ': { dimension: '息と緊張', clue: 'ㄲは息を抑え、詰めるように強く出す。' },
  'ㄷ|ㅌ': { dimension: '息の強さ', clue: 'ㅌはㄷより強く息を出す。' },
  'ㄷ|ㄸ': { dimension: '息と緊張', clue: 'ㄸは息を抑え、詰めるように強く出す。' },
  'ㅂ|ㅍ': { dimension: '息の強さ', clue: 'ㅍはㅂより強く息を出す。' },
  'ㅂ|ㅃ': { dimension: '息と緊張', clue: 'ㅃは息を抑え、詰めるように強く出す。' },
  'ㅈ|ㅊ': { dimension: '息の強さ', clue: 'ㅊはㅈより強く息を出す。' },
  'ㅈ|ㅉ': { dimension: '息と緊張', clue: 'ㅉは息を抑え、詰めるように強く出す。' }
};

export function confusionKey(correctId, selectedId) {
  return `${correctId}>${selectedId}`;
}

function parseDay(key) {
  if (!key) return null;
  const date = new Date(`${key}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function ageDays(lastKey, nowKey) {
  const last = parseDay(lastKey);
  const now = parseDay(nowKey);
  if (!last || !now) return 0;
  return Math.max(0, Math.floor((now - last) / 86400000));
}

function ageMultiplier(days) {
  if (days <= 1) return 1;
  if (days <= 3) return 0.8;
  if (days <= 7) return 0.55;
  if (days <= 14) return 0.3;
  return 0.1;
}

export function getConfusionScore(pair = {}, dateKey) {
  const total = pair.totalMistakes ?? 0;
  if (!total) return 0;
  const recent = pair.recentMistakes ?? Math.min(total, 3);
  const days = ageDays(pair.lastMistakeAt, dateKey ?? pair.lastMistakeAt);
  const recencyBonus = days <= 1 ? 10 : days <= 3 ? 6 : days <= 7 ? 3 : 0;
  const recentWeight = recent * 25 * ageMultiplier(days);
  const historyWeight = Math.min(total, 5) * 5;
  const recoveryPenalty = Math.min(pair.correctStreak ?? 0, 3) * 12;
  return Math.max(0, Math.round(recentWeight + historyWeight + recencyBonus - recoveryPenalty));
}

export function getConfusionState(pair = {}, dateKey) {
  const score = getConfusionScore(pair, dateKey);
  const total = pair.totalMistakes ?? 0;
  if (!total || score < RECOVERING_SCORE) return 'resolved';
  if (total >= 2 && score >= ACTIVE_SCORE) return 'active';
  if ((pair.recoveries ?? 0) > 0) return 'recovering';
  return 'candidate';
}

export function recordConfusionMistake(progress, { correctId, selectedId, dateKey }) {
  if (!correctId || !selectedId || correctId === selectedId) return progress;
  const key = confusionKey(correctId, selectedId);
  const pairs = { ...(progress.confusionPairs ?? {}) };
  const current = pairs[key] ?? {
    correctId,
    selectedId,
    totalMistakes: 0,
    recentMistakes: 0,
    recoveries: 0,
    correctStreak: 0
  };

  pairs[key] = {
    ...current,
    correctId,
    selectedId,
    totalMistakes: (current.totalMistakes ?? 0) + 1,
    recentMistakes: Math.min(4, (current.recentMistakes ?? 0) + 1),
    correctStreak: 0,
    lastMistakeAt: dateKey,
    lastSeenAt: dateKey
  };

  return { ...progress, confusionPairs: pairs };
}

export function recordConfusionRecovery(progress, { correctId, choiceIds = [], dateKey }) {
  if (!correctId || !choiceIds.length) return progress;
  const pairs = { ...(progress.confusionPairs ?? {}) };
  let changed = false;

  for (const [key, pair] of Object.entries(pairs)) {
    if (pair.correctId !== correctId || !choiceIds.includes(pair.selectedId)) continue;
    pairs[key] = {
      ...pair,
      recentMistakes: Math.max(0, (pair.recentMistakes ?? 0) - 1),
      recoveries: (pair.recoveries ?? 0) + 1,
      correctStreak: (pair.correctStreak ?? 0) + 1,
      lastCorrectAt: dateKey,
      lastSeenAt: dateKey
    };
    changed = true;
  }

  return changed ? { ...progress, confusionPairs: pairs } : progress;
}

export function getTopConfusions(progress, { dateKey, limit = 3, minScore = RECOVERING_SCORE } = {}) {
  return Object.entries(progress?.confusionPairs ?? {})
    .map(([key, pair]) => ({
      key,
      ...pair,
      score: getConfusionScore(pair, dateKey),
      state: getConfusionState(pair, dateKey)
    }))
    .filter((pair) => pair.score >= minScore && pair.state !== 'resolved')
    .sort((a, b) => b.score - a.score || (b.totalMistakes ?? 0) - (a.totalMistakes ?? 0))
    .slice(0, limit);
}

export function getConfusionPairItems(pair) {
  if (!pair) return null;
  const correct = ALL_ITEMS.find((item) => item.id === pair.correctId);
  const selected = ALL_ITEMS.find((item) => item.id === pair.selectedId);
  return correct && selected ? { correct, selected } : null;
}

function unorderedKey(a, b) {
  return [a, b].sort().join('|');
}

export function getConfusionInsight(correctItem, selectedItem) {
  const correctParts = Array.isArray(correctItem?.parts) ? correctItem.parts.map(String) : [];
  const selectedParts = Array.isArray(selectedItem?.parts) ? selectedItem.parts.map(String) : [];
  const max = Math.max(correctParts.length, selectedParts.length);
  const differences = [];
  for (let index = 0; index < max; index += 1) {
    if (correctParts[index] !== selectedParts[index]) differences.push(index);
  }

  if (differences.length === 1) {
    const index = differences[0];
    const a = correctParts[index];
    const b = selectedParts[index];
    if (index === 1 && VOWEL_HINTS[unorderedKey(a, b)]) return VOWEL_HINTS[unorderedKey(a, b)];
    if (index === 0 && CONSONANT_HINTS[unorderedKey(a, b)]) return CONSONANT_HINTS[unorderedKey(a, b)];
    if (index === 2) {
      return { dimension: 'パッチム', clue: `最後の音を確認：${b ?? 'なし'}ではなく${a ?? 'なし'}。` };
    }
    return {
      dimension: index === 0 ? '最初の子音' : index === 1 ? '母音' : '文字の組み合わせ',
      clue: `${b ?? 'なし'}ではなく${a ?? 'なし'}を手掛かりにする。`
    };
  }

  return {
    dimension: '文字全体',
    clue: `「${selectedItem?.hangul ?? ''}」と「${correctItem?.hangul ?? ''}」の形を並べて見分ける。`
  };
}

export const CONFUSION_ACTIVE_SCORE = ACTIVE_SCORE;
