import test from 'node:test';
import assert from 'node:assert/strict';
import { STAGES } from '../data.js';
import { createDefaultProgress } from '../core.js';
import { getNextLearningAction, getWeakPreview } from '../learning-recommendation.js';

const DATE = '2026-08-28';

test('first-time learner gets one simple five-question start', () => {
  const progress = createDefaultProgress();
  const action = getNextLearningAction(progress, { dateKey: DATE });
  assert.equal(action.type, 'first-five');
  assert.equal(action.action, 'quick-start');
  assert.equal(action.count, 5);
  assert.equal(action.stageId, STAGES[0].id);
});

test('multiple recent mistakes push weak review to the front', () => {
  const progress = createDefaultProgress();
  progress.sessionsPlayed = 2;
  progress.itemStats[STAGES[0].items[0].id] = { seen: 3, correct: 1, wrong: 2, avgMs: 3000, lastResult: 'wrong' };
  progress.itemStats[STAGES[0].items[1].id] = { seen: 4, correct: 1, wrong: 3, avgMs: 3200, lastResult: 'wrong' };

  const action = getNextLearningAction(progress, { dateKey: DATE });
  assert.equal(action.type, 'weak-review');
  assert.equal(action.action, 'weak-start');
});

test('learner resumes the previous stage when there is no stronger signal', () => {
  const progress = createDefaultProgress();
  progress.sessionsPlayed = 1;
  progress.lastStageId = STAGES[0].id;

  const action = getNextLearningAction(progress, { dateKey: DATE });
  assert.equal(action.type, 'continue-stage');
  assert.equal(action.stageId, STAGES[0].id);
});

test('near-mastered stage becomes the next best action', () => {
  const progress = createDefaultProgress();
  progress.sessionsPlayed = 3;
  for (const item of STAGES[0].items) {
    progress.itemStats[item.id] = { seen: 5, correct: 3, wrong: 2, avgMs: 2200, lastResult: 'correct' };
  }

  const action = getNextLearningAction(progress, { dateKey: DATE });
  assert.equal(action.type, 'finish-stage');
  assert.match(action.reason, /習熟/);
});

test('daily completion makes further practice explicitly optional', () => {
  const progress = createDefaultProgress();
  progress.sessionsPlayed = 2;
  progress.dailyStats[DATE] = { answered: 5, correct: 5, score: 500, sessions: 1 };

  const action = getNextLearningAction(progress, { dateKey: DATE });
  assert.equal(action.type, 'bonus-five');
  assert.equal(action.optional, true);
});

test('weak preview only contains attempted items and caps at three', () => {
  const progress = createDefaultProgress();
  progress.sessionsPlayed = 2;
  STAGES[0].items.slice(0, 4).forEach((item, index) => {
    progress.itemStats[item.id] = {
      seen: 2 + index,
      correct: index === 0 ? 0 : 1,
      wrong: 2,
      avgMs: 3000 + index * 100,
      lastResult: 'wrong'
    };
  });

  const weak = getWeakPreview(progress, 3);
  assert.equal(weak.length, 3);
  assert.ok(weak.every((item) => (progress.itemStats[item.id]?.seen ?? 0) > 0));
});
