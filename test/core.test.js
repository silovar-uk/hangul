import test from 'node:test';
import assert from 'node:assert/strict';
import { STAGES } from '../data.js';
import {
  createDefaultProgress,
  safeLoadProgress,
  getLevel,
  getDailyGoalProgress,
  getItemMastery,
  makeChoices,
  buildSession,
  createQuestion,
  calculateAnswerScore,
  getSpeedTier,
  updateItemStat,
  applySessionResult,
  evaluateAchievements,
  calculateStreak
} from '../core.js';

test('default progress is safe to mutate', () => {
  const a = createDefaultProgress();
  const b = createDefaultProgress();
  a.stageBest.test = 90;
  a.settings.autoAdvance = true;
  assert.equal(b.stageBest.test, undefined);
  assert.equal(b.settings.autoAdvance, false);
});

test('old and broken storage are safely migrated', () => {
  assert.deepEqual(safeLoadProgress('{bad'), createDefaultProgress());
  const migrated = safeLoadProgress(JSON.stringify({ xp: 50, itemStats: {} }));
  assert.equal(migrated.version, 2);
  assert.equal(migrated.xp, 50);
  assert.deepEqual(migrated.dailyStats, {});
});

test('levels rise with experience', () => {
  assert.equal(getLevel(0), 1);
  assert.ok(getLevel(1000) > 1);
});

test('daily goal progress reports remaining questions', () => {
  const progress = createDefaultProgress();
  progress.dailyStats['2026-07-12'] = { answered: 3, correct: 2, score: 300, sessions: 1 };
  const daily = getDailyGoalProgress(progress, 5, '2026-07-12');
  assert.equal(daily.remaining, 2);
  assert.equal(daily.complete, false);
});

test('mastery combines repetition, accuracy and speed', () => {
  assert.equal(getItemMastery({ seen: 0 }), 0);
  assert.ok(getItemMastery({ seen: 5, correct: 5, avgMs: 1600, correctStreak: 5 }) >= 95);
  assert.ok(getItemMastery({ seen: 5, correct: 2, avgMs: 2000 }) < 50);
});

test('choices contain one correct answer and unique labels', () => {
  const items = STAGES[0].items;
  const choices = makeChoices(items[0], items, 'hangul-to-kana', 4, () => 0.42);
  assert.equal(choices.filter((choice) => choice.isCorrect).length, 1);
  assert.equal(new Set(choices.map((choice) => choice.label)).size, choices.length);
});

test('session and retry questions are valid', () => {
  const items = STAGES[2].items;
  const questions = buildSession({ items, count: 10, direction: 'mixed', random: () => 0.37 });
  const retry = createQuestion({ item: items[0], items, direction: 'mixed', isRetry: true, random: () => 0.2 });
  assert.equal(questions.length, 10);
  assert.ok(questions.every((question) => question.choices.some((choice) => choice.isCorrect)));
  assert.equal(retry.isRetry, true);
});

test('answer scoring rewards correct fast answers and combos', () => {
  const fast = calculateAnswerScore({ isCorrect: true, elapsedMs: 800, combo: 5 });
  const slow = calculateAnswerScore({ isCorrect: true, elapsedMs: 6000, combo: 1 });
  assert.ok(fast.score > slow.score);
  assert.equal(calculateAnswerScore({ isCorrect: false, elapsedMs: 100, combo: 10 }).score, 0);
  assert.equal(getSpeedTier(800, true).id, 'flash');
});

test('item stats preserve counts, streak and best time', () => {
  let stat = updateItemStat({}, true, 1000, '2026-07-12');
  stat = updateItemStat(stat, true, 800, '2026-07-12');
  stat = updateItemStat(stat, false, 3000, '2026-07-12');
  assert.equal(stat.seen, 3);
  assert.equal(stat.correct, 2);
  assert.equal(stat.wrong, 1);
  assert.equal(stat.bestMs, 800);
  assert.equal(stat.correctStreak, 0);
  assert.equal(stat.lastResult, 'wrong');
});

test('clearing a stage updates daily totals and unlocks next stage', () => {
  const progress = applySessionResult(createDefaultProgress(), {
    stageId: 'vowel-basic', stageNumber: 1, totalStages: 8, accuracy: 80,
    xp: 100, score: 1000, total: 6, correct: 5, maxCombo: 4,
    direction: 'mixed', baseCount: 5, dateKey: '2026-07-12'
  });
  assert.equal(progress.unlockedStage, 2);
  assert.equal(progress.stageBest['vowel-basic'], 80);
  assert.equal(progress.dailyStats['2026-07-12'].answered, 6);
  assert.equal(progress.sessionsPlayed, 1);
});

test('achievements are unlocked once', () => {
  const progress = createDefaultProgress();
  progress.sessionsPlayed = 1;
  progress.bestCombo = 5;
  const first = evaluateAchievements(progress);
  assert.deepEqual(first.newIds.sort(), ['combo-5', 'first-run']);
  const second = evaluateAchievements(first.progress);
  assert.deepEqual(second.newIds, []);
});

test('streak counts consecutive activity dates', () => {
  const now = new Date('2026-07-12T12:00:00');
  assert.equal(calculateStreak(['2026-07-10', '2026-07-11', '2026-07-12'], now), 3);
  assert.equal(calculateStreak(['2026-07-08'], now), 0);
});
