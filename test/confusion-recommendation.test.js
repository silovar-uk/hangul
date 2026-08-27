import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultProgress } from '../core.js';
import { getNextLearningAction } from '../learning-recommendation.js';
import { recordConfusionMistake, recordConfusionRecovery } from '../confusion-model.js';

const DATE = '2026-08-28';

test('active recent confusion becomes the next best action', () => {
  let progress = createDefaultProgress();
  progress.sessionsPlayed = 2;
  progress = recordConfusionMistake(progress, { correctId: 'eo', selectedId: 'o', dateKey: DATE });
  progress = recordConfusionMistake(progress, { correctId: 'eo', selectedId: 'o', dateKey: DATE });

  const action = getNextLearningAction(progress, { dateKey: DATE });
  assert.equal(action.type, 'confusion-review');
  assert.equal(action.action, 'confusion-start');
  assert.equal(action.count, 3);
  assert.match(action.title, /3問だけ/);
  assert.ok(action.pairKey);
});

test('resolved confusion stops owning the home recommendation', () => {
  let progress = createDefaultProgress();
  progress.sessionsPlayed = 2;
  progress = recordConfusionMistake(progress, { correctId: 'eo', selectedId: 'o', dateKey: DATE });
  progress = recordConfusionMistake(progress, { correctId: 'eo', selectedId: 'o', dateKey: DATE });
  progress = recordConfusionRecovery(progress, { correctId: 'eo', choiceIds: ['o'], dateKey: DATE });
  progress = recordConfusionRecovery(progress, { correctId: 'eo', choiceIds: ['o'], dateKey: DATE });

  const action = getNextLearningAction(progress, { dateKey: DATE });
  assert.notEqual(action.type, 'confusion-review');
});

test('daily completion makes confusion practice optional rather than mandatory', () => {
  let progress = createDefaultProgress();
  progress.sessionsPlayed = 2;
  progress.dailyStats[DATE] = { answered: 5, correct: 4, score: 400, sessions: 1 };
  progress = recordConfusionMistake(progress, { correctId: 'eo', selectedId: 'o', dateKey: DATE });
  progress = recordConfusionMistake(progress, { correctId: 'eo', selectedId: 'o', dateKey: DATE });

  const action = getNextLearningAction(progress, { dateKey: DATE });
  assert.equal(action.type, 'bonus-confusion');
  assert.equal(action.optional, true);
});
