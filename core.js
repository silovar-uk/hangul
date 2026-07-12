export const STORAGE_KEY = 'hangulQuest.v1';
export const DAILY_GOAL = 5;

export function createDefaultProgress() {
  return {
    version: 2,
    xp: 0,
    totalScore: 0,
    unlockedStage: 1,
    stageBest: {},
    itemStats: {},
    activityDates: [],
    dailyStats: {},
    achievements: [],
    sessionsPlayed: 0,
    bestCombo: 0,
    perfectRuns: 0,
    lastDirection: 'mixed',
    lastLength: 10,
    lastStageId: 'vowel-basic',
    settings: { autoAdvance: false }
  };
}

export function safeLoadProgress(raw) {
  if (!raw) return createDefaultProgress();
  try {
    const parsed = JSON.parse(raw);
    const defaults = createDefaultProgress();
    return {
      ...defaults,
      ...parsed,
      version: 2,
      stageBest: parsed.stageBest ?? {},
      itemStats: parsed.itemStats ?? {},
      activityDates: Array.isArray(parsed.activityDates) ? parsed.activityDates : [],
      dailyStats: parsed.dailyStats ?? {},
      achievements: Array.isArray(parsed.achievements) ? parsed.achievements : [],
      sessionsPlayed: parsed.sessionsPlayed ?? (Array.isArray(parsed.activityDates) && parsed.activityDates.length ? 1 : 0),
      settings: { ...defaults.settings, ...(parsed.settings ?? {}) }
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

export function getDailyGoalProgress(progress, goal = DAILY_GOAL, dateKey = todayKey()) {
  const record = progress.dailyStats?.[dateKey] ?? {};
  const answered = record.answered ?? 0;
  return {
    answered,
    correct: record.correct ?? 0,
    score: record.score ?? 0,
    sessions: record.sessions ?? 0,
    goal,
    remaining: Math.max(0, goal - answered),
    ratio: Math.min(1, answered / goal),
    complete: answered >= goal
  };
}

export function getItemMastery(stat = {}) {
  const seen = stat.seen ?? 0;
  const correct = stat.correct ?? 0;
  if (!seen) return 0;
  const accuracy = correct / seen;
  const repetition = Math.min(1, seen / 5);
  const speed = stat.avgMs ? Math.max(0.62, Math.min(1, 5000 / stat.avgMs)) : 0.62;
  const streakBoost = Math.min(0.08, (stat.correctStreak ?? 0) * 0.015);
  return Math.min(100, Math.round((accuracy * repetition * speed + streakBoost) * 100));
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
      const accuracy = seen ? correct / seen : 0.5;
      const mastery = getItemMastery(stat);
      const slowPenalty = stat.avgMs ? Math.min(12, Math.max(0, (stat.avgMs - 3000) / 300)) : 4;
      const priority = (seen === 0 ? 58 : 0)
        + (1 - accuracy) * 72
        + (100 - mastery) * 0.32
        + slowPenalty
        + (stat.lastResult === 'wrong' ? 18 : 0);
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
  const available = items.length > 2 ? items.filter((item) => !usedIds.slice(-2).includes(item.id)) : items;
  const candidates = available.length ? available : items;
  const weighted = candidates.map((item) => {
    const stat = itemStats[item.id] ?? {};
    const seen = stat.seen ?? 0;
    const correct = stat.correct ?? 0;
    const accuracyPenalty = seen ? 1 - correct / seen : 0.72;
    const weight = 1
      + accuracyPenalty * 4.5
      + (stat.lastResult === 'wrong' ? 2.4 : 0)
      + (seen === 0 ? 2.6 : 0)
      + Math.min(1.5, Math.max(0, ((stat.avgMs ?? 2500) - 3000) / 2000));
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
  for (const item of shuffle([...pool], random)) {
    const label = labelOf(item);
    if (!unique.has(label)) unique.set(label, item);
    if (unique.size >= size) break;
  }
  return shuffle([...unique.values()], random).map((item) => ({
    id: item.id,
    label: labelOf(item),
    isCorrect: item.id === correctItem.id
  }));
}

export function createQuestion({ item, items, direction = 'mixed', index = 0, random = Math.random, isRetry = false }) {
  const questionDirection = chooseDirection(direction, index, random);
  return {
    item,
    direction: questionDirection,
    prompt: questionDirection === 'hangul-to-kana' ? item.hangul : item.reversePrompt,
    promptLabel: questionDirection === 'hangul-to-kana' ? 'この文字の読みは？' : 'この読みになる文字は？',
    choices: makeChoices(item, items, questionDirection, Math.min(4, items.length), random),
    isRetry
  };
}

export function buildSession({ items, itemStats = {}, count = 10, direction = 'mixed', random = Math.random }) {
  if (!Array.isArray(items) || items.length < 2) throw new Error('A session needs at least two items.');
  const questions = [];
  const usedIds = [];
  for (let index = 0; index < count; index += 1) {
    const item = weightedPick(items, itemStats, usedIds, random);
    usedIds.push(item.id);
    questions.push(createQuestion({ item, items, direction, index, random }));
  }
  return questions;
}

export function getSpeedTier(elapsedMs, isCorrect = true) {
  if (!isCorrect) return { id: 'retry', label: '次で取り返す', icon: '↻' };
  if (elapsedMs < 1200) return { id: 'flash', label: '瞬読！', icon: '⚡' };
  if (elapsedMs < 2500) return { id: 'quick', label: 'いいテンポ', icon: '◎' };
  if (elapsedMs < 4500) return { id: 'steady', label: 'しっかり正解', icon: '○' };
  return { id: 'careful', label: 'じっくり正解', icon: '✓' };
}

export function calculateAnswerScore({ isCorrect, elapsedMs, combo }) {
  if (!isCorrect) return { score: 0, speedBonus: 0, comboBonus: 0 };
  const speedBonus = Math.max(0, Math.round(35 * (1 - Math.min(elapsedMs, 6500) / 6500)));
  const comboBonus = Math.min(60, Math.max(0, combo - 1) * 6);
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
    bestMs: isCorrect ? Math.min(current.bestMs ?? elapsedMs, elapsedMs) : current.bestMs,
    correctStreak: isCorrect ? (current.correctStreak ?? 0) + 1 : 0,
    lastResult: isCorrect ? 'correct' : 'wrong',
    lastSeen: dateKey
  };
}

export function applySessionResult(progress, result) {
  const date = result.dateKey ?? todayKey();
  const stageBest = { ...progress.stageBest };
  stageBest[result.stageId] = Math.max(stageBest[result.stageId] ?? 0, result.accuracy);
  const nextUnlocked = result.accuracy >= 70
    ? Math.max(progress.unlockedStage, result.stageNumber + 1)
    : progress.unlockedStage;
  const currentDaily = progress.dailyStats?.[date] ?? {};
  const dailyStats = {
    ...progress.dailyStats,
    [date]: {
      answered: (currentDaily.answered ?? 0) + result.total,
      correct: (currentDaily.correct ?? 0) + result.correct,
      score: (currentDaily.score ?? 0) + result.score,
      sessions: (currentDaily.sessions ?? 0) + 1
    }
  };
  return {
    ...progress,
    xp: progress.xp + result.xp,
    totalScore: progress.totalScore + result.score,
    unlockedStage: Math.min(result.totalStages, nextUnlocked),
    stageBest,
    activityDates: [...new Set([...progress.activityDates, date])],
    dailyStats,
    sessionsPlayed: (progress.sessionsPlayed ?? 0) + 1,
    bestCombo: Math.max(progress.bestCombo ?? 0, result.maxCombo ?? 0),
    perfectRuns: (progress.perfectRuns ?? 0) + (result.accuracy === 100 ? 1 : 0),
    lastDirection: result.direction,
    lastLength: result.baseCount ?? progress.lastLength ?? 10,
    lastStageId: result.stageId
  };
}

export function evaluateAchievements(progress) {
  const earned = new Set(progress.achievements ?? []);
  const checks = [
    ['first-run', (progress.sessionsPlayed ?? 0) >= 1],
    ['combo-5', (progress.bestCombo ?? 0) >= 5],
    ['perfect-run', (progress.perfectRuns ?? 0) >= 1],
    ['score-5000', (progress.totalScore ?? 0) >= 5000],
    ['master-10', Object.values(progress.itemStats ?? {}).filter((stat) => getItemMastery(stat) >= 75).length >= 10]
  ];
  const newIds = [];
  for (const [id, passed] of checks) {
    if (passed && !earned.has(id)) {
      earned.add(id);
      newIds.push(id);
    }
  }
  return { progress: { ...progress, achievements: [...earned] }, newIds };
}

export function shuffle(items, random = Math.random) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}
