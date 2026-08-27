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

test('resolved confusion leaves home today but returns as delayed recall tomorrow', () => {
  let progress = createDefaultProgress();
  progress.sessionsPlayed = 2;
  progress = recordConfusionMistake(progress, { correctId: 'eo', selectedId: 'o', dateKey: DATE });
  progress = recordConfusionMistake(progress, { correctId: 'eo', selectedId: 'o', dateKey: DATE });
  progress = recordConfusionRecovery(progress, { correctId: 'eo', choiceIds: ['o'], dateKey: DATE });
  progress = recordConfusionRecovery(progress, { correctId: 'eo', choiceIds: ['o'], dateKey: DATE });

  const sameDay = getNextLearningAction(progress, { dateKey: DATE });
  assert.notEqual(sameDay.type, 'confusion-review');
  assert.notEqual(sameDay.type, 'delayed-confusion');

  const tomorrow = getNextLearningAction(progress, { dateKey: '2026-08-29' });
  assert.equal(tomorrow.type, 'delayed-confusion');
  assert.equal(tomorrow.action, 'confusion-start');
  assert.match(tomorrow.title, /まだ見分けられる/);
  assert.match(tomorrow.reason, /1日/);
});

test('daily completion makes active confusion practice optional rather than mandatory', () => {
  let progress = createDefaultProgress();
  progress.sessionsPlayed = 2;
  progress.dailyStats[DATE] = { answered: 5, correct: 4, score: 400, sessions: 1 };
  progress = recordConfusionMistake(progress, { correctId: 'eo', selectedId: 'o', dateKey: DATE });
  progress = recordConfusionMistake(progress, { correctId: 'eo', selectedId: 'o', dateKey: DATE });

  const action = getNextLearningAction(progress, { dateKey: DATE });
  assert.equal(action.type, 'bonus-confusion');
  assert.equal(action.optional, true);
});

test('daily completion also keeps a due delayed check optional', () => {
  let progress = createDefaultProgress();
  progress.sessionsPlayed = 2;
  progress = recordConfusionMistake(progress, { correctId: 'eo', selectedId: 'o', dateKey: DATE });
  progress = recordConfusionMistake(progress, { correctId: 'eo', selectedId: 'o', dateKey: DATE });
  progress = recordConfusionRecovery(progress, { correctId: 'eo', choiceIds: ['o'], dateKey: DATE });
  progress = recordConfusionRecovery(progress, { correctId: 'eo', choiceIds: ['o'], dateKey: DATE });
  progress.dailyStats['2026-08-29'] = { answered: 5, correct: 5, score: 500, sessions: 1 };

  const action = getNextLearningAction(progress, { dateKey: '2026-08-29' });
  assert.equal(action.type, 'bonus-delayed-confusion');
  assert.equal(action.optional, true);
  assert.equal(action.action, 'confusion-start');
});
