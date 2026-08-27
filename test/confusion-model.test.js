import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultProgress, safeLoadProgress } from '../core.js';
import {
  confusionKey,
  getConfusionScore,
  getConfusionState,
  getConfusionRecallInterval,
  getDueConfusions,
  getTopConfusions,
  recordConfusionMistake,
  recordConfusionRecovery
} from '../confusion-model.js';

const TODAY = '2026-08-28';

test('progress v3 migrates old storage with an empty confusion map', () => {
  const migrated = safeLoadProgress(JSON.stringify({ version: 2, xp: 20, itemStats: {} }));
  assert.equal(migrated.version, 3);
  assert.deepEqual(migrated.confusionPairs, {});
  assert.equal(migrated.xp, 20);
});

test('one mistake stays a candidate but repeated same-direction mistakes activate a pair', () => {
  let progress = createDefaultProgress();
  progress = recordConfusionMistake(progress, { correctId: 'eo', selectedId: 'o', dateKey: TODAY });
  const key = confusionKey('eo', 'o');
  assert.equal(getConfusionState(progress.confusionPairs[key], TODAY), 'candidate');

  progress = recordConfusionMistake(progress, { correctId: 'eo', selectedId: 'o', dateKey: TODAY });
  assert.equal(getConfusionState(progress.confusionPairs[key], TODAY), 'active');
  assert.equal(progress.confusionPairs[key].totalMistakes, 2);
});

test('opposite answer directions are stored as different confusions', () => {
  let progress = createDefaultProgress();
  progress = recordConfusionMistake(progress, { correctId: 'eo', selectedId: 'o', dateKey: TODAY });
  progress = recordConfusionMistake(progress, { correctId: 'o', selectedId: 'eo', dateKey: TODAY });
  assert.ok(progress.confusionPairs[confusionKey('eo', 'o')]);
  assert.ok(progress.confusionPairs[confusionKey('o', 'eo')]);
  assert.equal(Object.keys(progress.confusionPairs).length, 2);
});

test('successful discrimination reduces confusion strength', () => {
  let progress = createDefaultProgress();
  progress = recordConfusionMistake(progress, { correctId: 'eo', selectedId: 'o', dateKey: TODAY });
  progress = recordConfusionMistake(progress, { correctId: 'eo', selectedId: 'o', dateKey: TODAY });
  const key = confusionKey('eo', 'o');
  const before = getConfusionScore(progress.confusionPairs[key], TODAY);

  progress = recordConfusionRecovery(progress, { correctId: 'eo', choiceIds: ['o'], dateKey: TODAY });
  progress = recordConfusionRecovery(progress, { correctId: 'eo', choiceIds: ['o'], dateKey: TODAY });
  const after = getConfusionScore(progress.confusionPairs[key], TODAY);

  assert.ok(after < before);
  assert.ok(['recovering', 'resolved'].includes(getConfusionState(progress.confusionPairs[key], TODAY)));
});

test('old confusions decay below equally strong recent confusions', () => {
  const recent = { totalMistakes: 3, recentMistakes: 3, correctStreak: 0, lastMistakeAt: '2026-08-28' };
  const old = { ...recent, lastMistakeAt: '2026-08-01' };
  assert.ok(getConfusionScore(recent, TODAY) > getConfusionScore(old, TODAY));
});

test('ranking only returns unresolved pairs above the requested score', () => {
  let progress = createDefaultProgress();
  progress = recordConfusionMistake(progress, { correctId: 'eo', selectedId: 'o', dateKey: TODAY });
  progress = recordConfusionMistake(progress, { correctId: 'eo', selectedId: 'o', dateKey: TODAY });
  progress = recordConfusionMistake(progress, { correctId: 'u', selectedId: 'eu', dateKey: TODAY });
  const top = getTopConfusions(progress, { dateKey: TODAY, limit: 3, minScore: 20 });
  assert.equal(top[0].key, confusionKey('eo', 'o'));
  assert.ok(top.every((pair) => pair.state !== 'resolved'));
});

test('resolved pairs come back later for spaced verification', () => {
  let progress = createDefaultProgress();
  progress = recordConfusionMistake(progress, { correctId: 'eo', selectedId: 'o', dateKey: TODAY });
  progress = recordConfusionMistake(progress, { correctId: 'eo', selectedId: 'o', dateKey: TODAY });
  progress = recordConfusionRecovery(progress, { correctId: 'eo', choiceIds: ['o'], dateKey: TODAY });
  progress = recordConfusionRecovery(progress, { correctId: 'eo', choiceIds: ['o'], dateKey: TODAY });

  const key = confusionKey('eo', 'o');
  assert.equal(getConfusionState(progress.confusionPairs[key], TODAY), 'resolved');
  assert.equal(getConfusionRecallInterval(progress.confusionPairs[key]), 1);
  assert.equal(getDueConfusions(progress, { dateKey: TODAY }).length, 0);

  const due = getDueConfusions(progress, { dateKey: '2026-08-29' });
  assert.equal(due[0].key, key);
  assert.equal(due[0].daysSinceReview, 1);
});

test('successful delayed checks widen from one to three to seven days and then retire', () => {
  const pair = { totalMistakes: 2 };
  assert.equal(getConfusionRecallInterval({ ...pair, correctStreak: 2 }), 1);
  assert.equal(getConfusionRecallInterval({ ...pair, correctStreak: 4 }), 3);
  assert.equal(getConfusionRecallInterval({ ...pair, correctStreak: 6 }), 7);
  assert.equal(getConfusionRecallInterval({ ...pair, correctStreak: 8 }), null);
});
