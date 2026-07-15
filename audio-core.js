export const AUDIO_STORAGE_KEY = 'hangulQuest.audio.v1';

export const DEFAULT_AUDIO_SETTINGS = Object.freeze({
  enabled: true,
  autoPlay: false,
  rate: 0.78,
  volume: 0.9,
  voiceURI: ''
});

export function safeLoadAudioSettings(raw) {
  if (!raw) return { ...DEFAULT_AUDIO_SETTINGS };
  try {
    const parsed = JSON.parse(raw);
    const rate = Number(parsed.rate);
    const volume = Number(parsed.volume);
    return {
      enabled: parsed.enabled !== false,
      autoPlay: parsed.autoPlay === true,
      rate: Number.isFinite(rate) ? Math.min(1.2, Math.max(0.5, rate)) : DEFAULT_AUDIO_SETTINGS.rate,
      volume: Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : DEFAULT_AUDIO_SETTINGS.volume,
      voiceURI: typeof parsed.voiceURI === 'string' ? parsed.voiceURI : ''
    };
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
}

export function normalizeSpeakText(value) {
  if (typeof value !== 'string') return '';
  return value
    .trim()
    .split(/[・／/]/)[0]
    .replace(/[〈《（(].*?[〉》）)]/g, '')
    .replace(/[^\u1100-\u11ff\u3130-\u318f\uac00-\ud7af\s]/g, '')
    .trim();
}

export function getKoreanVoices(voices = []) {
  return [...voices]
    .filter((voice) => /^ko(?:-|_)?/i.test(voice.lang || ''))
    .sort((a, b) => {
      const aKr = /ko-KR/i.test(a.lang || '') ? 0 : 1;
      const bKr = /ko-KR/i.test(b.lang || '') ? 0 : 1;
      return aKr - bKr || String(a.name).localeCompare(String(b.name), 'ko');
    });
}

export function pickKoreanVoice(voices = [], preferredURI = '') {
  const korean = getKoreanVoices(voices);
  if (!korean.length) return null;
  return korean.find((voice) => voice.voiceURI === preferredURI)
    ?? korean.find((voice) => voice.default)
    ?? korean[0];
}

export function formatVoiceLabel(voice) {
  if (!voice) return '';
  return `${voice.name}（${voice.lang || 'ko-KR'}）`;
}
