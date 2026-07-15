import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_AUDIO_SETTINGS,
  safeLoadAudioSettings,
  normalizeSpeakText,
  getKoreanVoices,
  pickKoreanVoice,
  formatVoiceLabel
} from '../audio-core.js';

test('audio settings safely fall back to defaults', () => {
  assert.deepEqual(safeLoadAudioSettings('{bad'), DEFAULT_AUDIO_SETTINGS);
});

test('audio settings clamp rate and volume', () => {
  const loaded = safeLoadAudioSettings(JSON.stringify({ rate: 9, volume: -3, autoPlay: true }));
  assert.equal(loaded.rate, 1.2);
  assert.equal(loaded.volume, 0);
  assert.equal(loaded.autoPlay, true);
});

test('speak text keeps Hangul and removes annotations', () => {
  assert.equal(normalizeSpeakText('어（口を広めに）'), '어');
  assert.equal(normalizeSpeakText('아・앙'), '아');
  assert.equal(normalizeSpeakText('ガ'), '');
});

test('Korean voices are filtered and ko-KR is preferred', () => {
  const voices = [
    { name: 'English', lang: 'en-US', voiceURI: 'en' },
    { name: 'Korean generic', lang: 'ko', voiceURI: 'ko' },
    { name: 'Korean KR', lang: 'ko-KR', voiceURI: 'ko-kr', default: true }
  ];
  assert.deepEqual(getKoreanVoices(voices).map((voice) => voice.voiceURI), ['ko-kr', 'ko']);
  assert.equal(pickKoreanVoice(voices, '').voiceURI, 'ko-kr');
  assert.equal(pickKoreanVoice(voices, 'ko').voiceURI, 'ko');
});

test('voice labels include the language', () => {
  assert.equal(formatVoiceLabel({ name: 'Yuna', lang: 'ko-KR' }), 'Yuna（ko-KR）');
});
