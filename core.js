export const STORAGE_KEY = 'hangulQuest.v1';

export function createDefaultProgress() {
  return {
    version: 1,
    xp: 0,
    totalScore: 0,
    unlockedStage: 1,
    stageBest: {},
    itemStats: {},
    activityDates: [],
    lastDirection: 'mixed',
    lastStageId: 'vowel-basic'
  };
}

export function safeLoadProgress(raw) {
  if (!raw) return createDefaultProgress();
  try {
    const parsed = JSON.parse(raw);
    return {
      ...createDefaultProgress(),
      ...parsed,
      stageBest: parsed.stageBest ?? {},
      itemStats: parsed.itemStats ?? {},
      activityDates: Array.isArray(parsed.activityDates) ? parsed.activityDates : []
    };
  } catch {
    return createDefaultProgress();
  }
}

export function getLevel(xp) {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 120)) + 1;
}

export function getLevelProgress(xp) {
  const level = getLevel(xp);
  const currentFloor = 120 * Math.pow(level - 1, 2);
  const nextFloor = 120 * Math.pow(level, 2);
  const value = xp - currentFloor;
  const required = nextFloor - currentFloor;
  return { level, value, required, ratio: required ? value / required : 0 };
}

export function todayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function calculateStreak(activityDates, now = new Date()) {
  const unique = [...new Set(activityDates)].sort().reverse();
  if (!unique.length) return 0;

  const today = todayKey(now);
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = todayKey(yesterdayDate);

  if (unique[0] !== today && unique[0] !== yesterday) return 0;

  let streak = 0;
  const cursor = new Date(`${unique[0]}T12:00:00`);
  for (const key of unique) {
    if (key !== todayKey(cursor)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function getItemMastery(stat = {}) {
  const seen = stat.seen ?? 0;
  const correct = stat.correct ?? 0;
  if (!seen) return 0;
  const accuracy = correct / seen;
  const repetition = Math.min(1, seen / 5);
  const speed = stat.avgMs ? Math.max(0.65, Math.min(1, 5000 / stat.avgMs)) : 0.65;
  return Math.round(accuracy * repetition * speed * 100);
}

export function getStageMastery(stage, itemStats) {
  if (!stage?.items?.length) return 0;
  const total = stage.items.reduce((sum, item) => sum + getItemMastery(itemStats[item.id]), 0);
  return Math.round(total / stage.items.length);
}

export function getWeakItems(items, itemStats, limit = 8) {
  return [...items]
    .map((item) => {
      const stat = itemStats[item.id] ?? {};
      const seen = stat.seen ?? 0;
      const correct = stat.correct ?? 0;
      const accuracy = seen ? correct / seen : 0.55;
      const mastery = getItemMastery(stat);
      const priority = (1 - accuracy) * 60 + (100 - mastery) * 0.4 + Math.min(20, seen * 2);
      return { item, priority, seen };
    })
    .sort((a, b) => b.priority - a.priority || a.seen - b.seen)
    .slice(0, limit)
    .map((entry) => entry.item);
}

export function chooseDirection(mode, index, random = Math.random) {
  if (mode === 'hangul-to-kana' || mode === 'kana-to-hangul') return mode;
  if (index === 0) return random() < 0.5 ? 'hangul-to-kana' : 'kana-to-hangul';
  return index % 2 === 0 ? 'hangul-to-kana' : 'kana-to-hangul';
}

export function weightedPick(items, itemStats, usedIds = [], random = Math.random) {
  const candidates = items.length > 1 ? items.filter((item) => !usedIds.slice(-2).includes(item.id)) : items;
  const weighted = candidates.map((item) => {
    const stat = itemStats[item.id] ?? {};
    const seen = stat.seen ?? 0;
    const correct = stat.correct ?? 0;
    const wrong = stat.wrong ?? 0;
    const accuracyPenalty = seen ? 1 - correct / seen : 0.7;
    const weight = 1 + accuracyPenalty * 4 + wrong * 0.7 + (seen === 0 ? 2.2 : 0);
    return { item, weight };
  });
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  let point = random() * total;
  for (const entry of weighted) {
    point -= entry.weight;
    if (point <= 0) return entry.item;
  }
  return weighted.at(-1)?.item ?? items[0];
}

export function makeChoices(correctItem, pool, direction, size = 4, random = Math.random) {
  const labelOf = direction === 'hangul-to-kana'
    ? (item) => item.reading
    : (item) => item.hangul;

  const correctLabel = labelOf(correctItem);
  const unique = new Map([[correctLabel, correctItem]]);
  const shuffled = shuffle([...pool], random);
  for (const item of shuffled) {
    const label = labelOf(item);
    if (!unique.has(label)) unique.set(label, item);
    if (unique.size >= size) break;
  }

  if (unique.size < size) {
    for (const item of shuffle([...pool], random)) {
      const label = labelOf(item);
      if (!unique.has(label)) unique.set(label, item);
      if (unique.size >= size) break;
    }
  }

  return shuffle([...unique.values()], random).map((item) => ({
    id: item.id,
    label: labelOf(item),
    isCorrect: item.id === correctItem.id
  }));
}

export function buildSession({ items, itemStats = {}, count = 10, direction = 'mixed', random = Math.random }) {
  if (!Array.isArray(items) || items.length < 2) throw new Error('A session needs at least two items.');
  const questions = [];
  const usedIds = [];
  for (let index = 0; index < count; index += 1) {
    const item = weightedPick(items, itemStats, usedIds, random);
    usedIds.push(item.id);
    const questionDirection = chooseDirection(direction, index, random);
    questions.push({
      item,
      direction: questionDirection,
      prompt: questionDirection === 'hangul-to-kana' ? item.hangul : item.reversePrompt,
      promptLabel: questionDirection === 'hangul-to-kana' ? 'この文字の読みは？' : 'この読みになる文字は？',
      choices: makeChoices(item, items, questionDirection, Math.min(4, items.length), random)
    });
  }
  return questions;
}

export function calculateAnswerScore({ isCorrect, elapsedMs, combo }) {
  if (!isCorrect) return { score: 0, speedBonus: 0, comboBonus: 0 };
  const speedBonus = Math.max(0, Math.round(30 * (1 - Math.min(elapsedMs, 6000) / 6000)));
  const comboBonus = Math.min(50, combo * 5);
  return { score: 100 + speedBonus + comboBonus, speedBonus, comboBonus };
}

export function updateItemStat(current = {}, isCorrect, elapsedMs, dateKey = todayKey()) {
  const seen = (current.seen ?? 0) + 1;
  const previousAverage = current.avgMs ?? elapsedMs;
  const avgMs = Math.round(previousAverage + (elapsedMs - previousAverage) / seen);
  return {
    ...current,
    seen,
    correct: (current.correct ?? 0) + (isCorrect ? 1 : 0),
    wrong: (current.wrong ?? 0) + (isCorrect ? 0 : 1),
    avgMs,
    lastSeen: dateKey
  };
}

export function applySessionResult(progress, result) {
  const date = result.dateKey ?? todayKey();
  const stageBest = { ...progress.stageBest };
  const previousBest = stageBest[result.stageId] ?? 0;
  stageBest[result.stageId] = Math.max(previousBest, result.accuracy);

  const nextUnlocked = result.accuracy >= 70
    ? Math.max(progress.unlockedStage, result.stageNumber + 1)
    : progress.unlockedStage;

  return {
    ...progress,
    xp: progress.xp + result.xp,
    totalScore: progress.totalScore + result.score,
    unlockedStage: Math.min(result.totalStages, nextUnlocked),
    stageBest,
    activityDates: [...new Set([...progress.activityDates, date])],
    lastDirection: result.direction,
    lastStageId: result.stageId
  };
}

export function shuffle(items, random = Math.random) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}
