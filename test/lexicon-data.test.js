import test from 'node:test';
import assert from 'node:assert/strict';
import { WORDS, PHRASES, ALL_LEXICON, getCategories, getLexiconItems } from '../lexicon-data.js';

test('lexicon entries have required unique identifiers', () => {
  const keys = ALL_LEXICON.map((item) => `${item.type}:${item.id}`);
  assert.equal(new Set(keys).size, keys.length);

  for (const item of ALL_LEXICON) {
    assert.ok(item.hangul);
    assert.ok(item.reading);
    assert.ok(item.meaning);
    assert.ok(item.category);
    assert.match(item.type, /^(word|phrase)$/);
  }
});

test('word and phrase pools are large enough for four-choice quizzes', () => {
  assert.ok(WORDS.length >= 4);
  assert.ok(PHRASES.length >= 4);
  assert.equal(getLexiconItems('word'), WORDS);
  assert.equal(getLexiconItems('phrase'), PHRASES);
});

test('every content type exposes categories', () => {
  assert.ok(getCategories('word').length >= 5);
  assert.ok(getCategories('phrase').length >= 4);
});
