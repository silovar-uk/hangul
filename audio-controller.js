import {
  AUDIO_STORAGE_KEY,
  DEFAULT_AUDIO_SETTINGS,
  safeLoadAudioSettings,
  normalizeSpeakText,
  getKoreanVoices,
  pickKoreanVoice,
  formatVoiceLabel
} from './audio-core.js';

const synth = window.speechSynthesis;
const SpeechUtterance = window.SpeechSynthesisUtterance;
let settings = safeLoadAudioSettings(localStorage.getItem(AUDIO_STORAGE_KEY));
let voices = [];
let activeButton = null;
let toastTimer = null;
let scanQueued = false;

function isAvailable() {
  return Boolean(synth && SpeechUtterance);
}

function saveSettings() {
  localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(settings));
}

function refreshVoices() {
  if (!isAvailable()) return;
  voices = synth.getVoices?.() ?? [];
  refreshOpenVoiceSelect();
}

function stopSpeaking() {
  if (!isAvailable()) return;
  synth.cancel();
  setButtonState(activeButton, false);
  activeButton = null;
}

function setButtonState(button, speaking) {
  if (!button) return;
  button.classList.toggle('is-speaking', speaking);
  button.setAttribute('aria-pressed', String(speaking));
  const label = button.querySelector('[data-audio-label]');
  if (label) label.textContent = speaking ? '再生中' : button.dataset.defaultLabel || '音を聞く';
}

function showAudioToast(message) {
  document.querySelector('.audio-toast')?.remove();
  const toast = document.createElement('div');
  toast.className = 'audio-toast';
  toast.setAttribute('role', 'status');
  toast.textContent = message;
  document.body.append(toast);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.remove(), 2600);
}

function speak(text, button = null, { ignoreDisabled = false } = {}) {
  if (!ignoreDisabled && !settings.enabled) {
    showAudioToast('設定で音声機能をオンにしてください');
    return false;
  }
  if (!isAvailable()) {
    showAudioToast('このブラウザでは読み上げを利用できません');
    return false;
  }

  const normalized = normalizeSpeakText(text);
  if (!normalized) {
    showAudioToast('読み上げるハングルが見つかりません');
    return false;
  }

  stopSpeaking();
  const utterance = new SpeechUtterance(normalized);
  utterance.lang = 'ko-KR';
  utterance.rate = settings.rate;
  utterance.pitch = 1;
  utterance.volume = settings.volume;
  const voice = pickKoreanVoice(voices, settings.voiceURI);
  if (voice) utterance.voice = voice;

  activeButton = button;
  setButtonState(button, true);
  utterance.onend = () => {
    setButtonState(button, false);
    if (activeButton === button) activeButton = null;
  };
  utterance.onerror = (event) => {
    setButtonState(button, false);
    if (activeButton === button) activeButton = null;
    if (event.error !== 'canceled' && event.error !== 'interrupted') {
      showAudioToast('音声を再生できませんでした');
    }
  };

  synth.resume?.();
  synth.speak(utterance);
  return true;
}

function createAudioButton(text, { compact = false, label = '音を聞く' } = {}) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `audio-button${compact ? ' audio-button--compact' : ''}`;
  button.dataset.audioText = text;
  button.dataset.defaultLabel = label;
  button.setAttribute('aria-label', `${text}の${label}`);
  button.setAttribute('aria-pressed', 'false');
  button.innerHTML = `<span class="audio-button-icon" aria-hidden="true">🔊</span>${compact ? '' : `<span data-audio-label>${label}</span>`}`;
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    speak(button.dataset.audioText, button);
  });
  return button;
}

function enhanceFeedback() {
  document.querySelectorAll('.feedback:not([data-audio-ready])').forEach((feedback) => {
    const text = feedback.querySelector('.feedback-parts b')?.textContent?.trim();
    const learning = feedback.querySelector('.feedback-learning');
    if (!text || !learning) return;

    feedback.dataset.audioReady = 'true';
    const row = document.createElement('div');
    row.className = 'feedback-audio-row';
    row.append(createAudioButton(text, { label: '正しい音を聞く' }));
    learning.append(row);

    if (settings.enabled && settings.autoPlay) {
      const button = row.querySelector('.audio-button');
      requestAnimationFrame(() => speak(text, button));
    }
  });
}

function enhanceReferenceCards() {
  document.querySelectorAll('.reference-card:not([data-audio-ready])').forEach((card) => {
    const sample = card.querySelector('small')?.textContent?.trim();
    const hangul = card.querySelector('b')?.textContent?.trim();
    const text = normalizeSpeakText(sample) || normalizeSpeakText(hangul);
    if (!text) return;
    card.dataset.audioReady = 'true';
    card.append(createAudioButton(text, { compact: true }));
  });

  document.querySelectorAll('.combination-table tbody td:not([data-audio-ready])').forEach((cell) => {
    const text = cell.querySelector('b')?.textContent?.trim();
    if (!normalizeSpeakText(text)) return;
    cell.dataset.audioReady = 'true';
    cell.append(createAudioButton(text, { compact: true }));
  });
}

function enhanceStats() {
  document.querySelectorAll('.stats-row:not([data-audio-ready])').forEach((row) => {
    const hangul = row.querySelector('.stats-hangul');
    const text = hangul?.textContent?.trim();
    if (!hangul || !normalizeSpeakText(text)) return;
    row.dataset.audioReady = 'true';
    hangul.append(createAudioButton(text, { compact: true }));
  });
}

function enhanceSettings() {
  const dialog = document.querySelector('.dialog[aria-labelledby="settings-title"]');
  if (!dialog || dialog.dataset.audioReady) return;
  dialog.dataset.audioReady = 'true';

  const block = document.createElement('section');
  block.className = 'audio-settings';
  block.innerHTML = `
    <div class="audio-settings-heading"><span>AUDIO</span><h3>韓国語の音</h3></div>
    <label class="setting-row">
      <div><strong>音声機能</strong><span>回答後や文字一覧で韓国語の音を再生します。</span></div>
      <input type="checkbox" data-audio-enabled ${settings.enabled ? 'checked' : ''}>
    </label>
    <label class="setting-row">
      <div><strong>回答後に自動再生</strong><span>正誤を表示したあと、正しい音を自動で読み上げます。</span></div>
      <input type="checkbox" data-audio-autoplay ${settings.autoPlay ? 'checked' : ''}>
    </label>
    <label class="audio-select-row">
      <span>読み上げ速度</span>
      <select data-audio-rate>
        <option value="0.65">ゆっくり</option>
        <option value="0.78">学習向け</option>
        <option value="0.95">標準</option>
      </select>
    </label>
    <label class="audio-select-row">
      <span>韓国語の声</span>
      <select data-audio-voice></select>
    </label>
    <label class="audio-volume-row">
      <span>音量</span>
      <input type="range" min="0" max="1" step="0.1" data-audio-volume value="${settings.volume}">
      <output data-audio-volume-output>${Math.round(settings.volume * 100)}%</output>
    </label>
    <button type="button" class="audio-test-button" data-audio-test>아 を試聴</button>
    <p class="audio-settings-note">端末に入っている韓国語音声を使います。機種によって声質が異なります。</p>
  `;

  const storageNote = dialog.querySelector('.storage-note');
  dialog.insertBefore(block, storageNote ?? dialog.querySelector('.reset-link'));

  const enabled = block.querySelector('[data-audio-enabled]');
  const autoPlay = block.querySelector('[data-audio-autoplay]');
  const rate = block.querySelector('[data-audio-rate]');
  const voice = block.querySelector('[data-audio-voice]');
  const volume = block.querySelector('[data-audio-volume]');
  const volumeOutput = block.querySelector('[data-audio-volume-output]');
  const test = block.querySelector('[data-audio-test]');

  rate.value = String(settings.rate);
  fillVoiceSelect(voice);
  updateAudioSettingsDisabledState(block);

  enabled.addEventListener('change', () => {
    settings.enabled = enabled.checked;
    if (!settings.enabled) stopSpeaking();
    saveSettings();
    updateAudioSettingsDisabledState(block);
    showAudioToast(settings.enabled ? '音声機能をオンにしました' : '音声機能をオフにしました');
  });
  autoPlay.addEventListener('change', () => {
    settings.autoPlay = autoPlay.checked;
    saveSettings();
  });
  rate.addEventListener('change', () => {
    settings.rate = Number(rate.value) || DEFAULT_AUDIO_SETTINGS.rate;
    saveSettings();
  });
  voice.addEventListener('change', () => {
    settings.voiceURI = voice.value;
    saveSettings();
  });
  volume.addEventListener('input', () => {
    settings.volume = Number(volume.value);
    volumeOutput.textContent = `${Math.round(settings.volume * 100)}%`;
    saveSettings();
  });
  test.addEventListener('click', () => speak('아', test, { ignoreDisabled: false }));
}

function fillVoiceSelect(select) {
  if (!select) return;
  const korean = getKoreanVoices(voices);
  const options = ['<option value="">端末の自動選択</option>'];
  for (const voice of korean) {
    options.push(`<option value="${escapeAttribute(voice.voiceURI)}">${escapeHtml(formatVoiceLabel(voice))}</option>`);
  }
  select.innerHTML = options.join('');
  select.value = korean.some((voice) => voice.voiceURI === settings.voiceURI) ? settings.voiceURI : '';
  if (!korean.length) {
    select.innerHTML += '<option value="" disabled>韓国語音声を読み込み中</option>';
  }
}

function refreshOpenVoiceSelect() {
  document.querySelectorAll('[data-audio-voice]').forEach(fillVoiceSelect);
}

function updateAudioSettingsDisabledState(block) {
  block.querySelectorAll('[data-audio-autoplay], [data-audio-rate], [data-audio-voice], [data-audio-volume], [data-audio-test]')
    .forEach((element) => { element.disabled = !settings.enabled; });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[character]);
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function bindCancelActions() {
  document.querySelectorAll('[data-action="home"], [data-action="result-home"], [data-action="next-stage"], [data-action="retry"], [data-action="next-question"], [data-action="quit-game"]')
    .forEach((button) => {
      if (button.dataset.audioCancelReady) return;
      button.dataset.audioCancelReady = 'true';
      button.addEventListener('click', stopSpeaking, { capture: true });
    });
}

function scan() {
  scanQueued = false;
  enhanceFeedback();
  enhanceReferenceCards();
  enhanceStats();
  enhanceSettings();
  bindCancelActions();
}

function queueScan() {
  if (scanQueued) return;
  scanQueued = true;
  requestAnimationFrame(scan);
}

if (isAvailable()) {
  refreshVoices();
  synth.addEventListener?.('voiceschanged', refreshVoices);
  if ('onvoiceschanged' in synth && !synth.addEventListener) synth.onvoiceschanged = refreshVoices;
}

new MutationObserver(queueScan).observe(document.body, { childList: true, subtree: true });
document.addEventListener('visibilitychange', () => { if (document.hidden) stopSpeaking(); });
window.addEventListener('pagehide', stopSpeaking);
queueScan();
