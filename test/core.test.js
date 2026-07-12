import test from 'node:test';
import assert from 'node:assert/strict';
import { STAGES } from '../data.js';
import {
  createDefaultProgress,
  safeLoadProgress,
  getLevel,
  getItemMastery,
  makeChoices,
  buildSession,
  calculateAnswerScore,
  updateItemStat,
  applySessionResult,
  calculateStreak
} from '../core.js';

test('default progress is safe to mutate', () => {
  const a = createDefaultProgress();
  const b = createDefaultProgress();
  a.stageBest.test = 90;
  assert.equal(b.stageBest.test, undefined);
});

test('broken storage falls back to defaults', () => {
  assert.deepEqual(safeLoadProgress('{bad'), createDefaultProgress());
});

test('levels rise with experience', () => {
  assert.equal(getLevel(0), 1);
  assert.ok(getLevel(1000) > 1);
});

test('mastery combines repetition and accuracy', () => {
  assert.equal(getItemMastery({ seen: 0 }), 0);
  assert.ok(getItemMastery({ seen: 5, correct: 5, avgMs: 2000 }) >= 90);
  assert.ok(getItemMastery({ seen: 5, correct: 2, avgMs: 2000 }) < 50);
});

test('choices contain one correct answer and unique labels', () => {
  const items = STAGES[0].items;
  const choices = makeChoices(items[0], items, 'hangul-to-kana', 4, () => 0.42);
  assert.equal(choices.filter((choice) => choice.isCorrect).length, 1);
  assert.equal(new Set(choices.map((choice) => choice.label)).size, choices.length);
});

test('session creates requested number of questions', () => {
  const questions = buildSession({ items: STAGES[2].items, count: 10, direction: 'mixed', random: () => 0.37 });
  assert.equal(questions.length, 10);
  assert.ok(questions.every((question) => question.choices.some((choice) => choice.isCorrect)));
});

test('answer scoring rewards correct fast answers and combos', () => {
  const fast = calculateAnswerScore({ isCorrect: true, elapsedMs: 800, combo: 5 });
  const slow = calculateAnswerScore({ isCorrect: true, elapsedMs: 6000, combo: 0 });
  assert.ok(fast.score > slow.score);
  assert.equal(calculateAnswerScore({ isCorrect: false, elapsedMs: 100, combo: 10 }).score, 0);
});

test('item stats preserve counts and average time', () => {
  let stat = updateItemStat({}, true, 1000, '2026-07-12');
  stat = updateItemStat(stat, false, 3000, '2026-07-12');
  assert.equal(stat.seen, 2);
  assert.equal(stat.correct, 1);
  assert.equal(stat.wrong, 1);
  assert.equal(stat.avgMs, 2000);
});

test('clearing a stage unlocks the next stage', () => {
  const progress = applySessionResult(createDefaultProgress(), {
    stageId: 'vowel-basic', stageNumber: 1, totalStages: 8, accuracy: 80, xp: 100, score: 1000, direction: 'mixed', dateKey: '2026-07-12'
  });
  assert.equal(progress.unlockedStage, 2);
  assert.equal(progress.stageBest['vowel-basic'], 80);
});

test('streak counts consecutive activity dates', () => {
  const now = new Date('2026-07-12T12:00:00');
  assert.equal(calculateStreak(['2026-07-10', '2026-07-11', '2026-07-12'], now), 3);
  assert.equal(calculateStreak(['2026-07-08'], now), 0);
});
