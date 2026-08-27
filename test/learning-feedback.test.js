import test from 'node:test';
import assert from 'node:assert/strict';
import { STAGES } from '../data.js';
import { getBuildModel, describePartDifference } from '../learning-feedback.js';

function findItem(id) {
  return STAGES.flatMap((stage) => stage.items).find((item) => item.id === id);
}

test('build model maps vertical vowel syllables into a block', () => {
  const model = getBuildModel(findItem('ga'));
  assert.deepEqual(model.parts, ['ㄱ', 'ㅏ']);
  assert.equal(model.result, '가');
  assert.equal(model.layout, 'vertical');
  assert.equal(model.hasBatchim, false);
});

test('build model maps horizontal vowel syllables into a block', () => {
  const model = getBuildModel(findItem('go'));
  assert.equal(model.layout, 'horizontal');
});

test('build model recognizes batchim', () => {
  const model = getBuildModel(findItem('gam'));
  assert.deepEqual(model.parts, ['ㄱ', 'ㅏ', 'ㅁ']);
  assert.equal(model.hasBatchim, true);
  assert.equal(model.labels[2], '終声（パッチム）');
});

test('multi-block words keep the existing non-builder feedback', () => {
  assert.equal(getBuildModel(findItem('gana')), null);
});

test('difference feedback identifies a changed medial vowel', () => {
  const correct = findItem('geo');
  const selected = findItem('go');
  assert.equal(describePartDifference(correct, selected), '中声（母音）が違う：ㅗ → ㅓ');
});

test('difference feedback identifies a changed final consonant', () => {
  const correct = findItem('gam');
  const selected = findItem('gan-n');
  assert.equal(describePartDifference(correct, selected), '終声（パッチム）が違う：ㄴ → ㅁ');
});
