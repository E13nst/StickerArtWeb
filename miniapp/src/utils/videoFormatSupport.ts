/**
 * Поддержка форматов видео с прозрачностью (альфа-канал).
 *
 * Safari (и Telegram WebView на iOS) не поддерживают прозрачность в WebM (VP9).
 * Прозрачность через HEVC (H.265) с альфа-каналом уже поддерживается на iOS.
 * Поэтому используем:
 * - WebM VP9 для Android/desktop (Chrome, Firefox и др.)
 * - HEVC+alpha (mp4) для Safari/iOS.
 *
 * @see https://caniuse.com/hevc
 * @see https://developer.apple.com/documentation/avfoundation/media_reading_and_writing/creating_video_with_an_alpha_channel
 */

let cachedHevcAlpha: boolean | null = null;
let cachedVp9Alpha: boolean | null = null;

/**
 * Проверяет поддержку HEVC с альфа-каналом (video/mp4; codecs="hvc1").
 * Safari и iOS поддерживают прозрачное видео через этот формат.
 * Результат кешируется на время сессии.
 */
export function canPlayHevcAlpha(): boolean {
  if (cachedHevcAlpha !== null) {
    return cachedHevcAlpha;
  }
  if (typeof document === 'undefined') {
    return false;
  }
  try {
    const video = document.createElement('video');
    const result = video.canPlayType('video/mp4; codecs="hvc1"');
    cachedHevcAlpha = result === 'probably' || result === 'maybe';
    return cachedHevcAlpha;
  } catch {
    cachedHevcAlpha = false;
    return false;
  }
}

/**
 * Проверяет поддержку VP9 (video/webm; codecs="vp9").
 * Chrome, Firefox и др. поддерживают прозрачность в WebM VP9.
 * Safari/iOS — нет.
 */
export function canPlayVp9Alpha(): boolean {
  if (cachedVp9Alpha !== null) {
    return cachedVp9Alpha;
  }
  if (typeof document === 'undefined') {
    return false;
  }
  try {
    const video = document.createElement('video');
    const result = video.canPlayType('video/webm; codecs="vp9"');
    cachedVp9Alpha = result === 'probably' || result === 'maybe';
    return cachedVp9Alpha;
  } catch {
    cachedVp9Alpha = false;
    return false;
  }
}
