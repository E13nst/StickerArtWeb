/**
 * Поддержка форматов видео с альфа-каналом в браузерах.
 *
 * Safari (и Telegram WebView на iOS) не поддерживает прозрачность в WebM/VP9.
 * Прозрачность на iOS возможна только через HEVC (H.265) с альфа-каналом в mp4 (codecs="hvc1").
 * Поэтому для прозрачного видео используем два источника: HEVC+alpha для Safari/iOS,
 * WebM (VP9+alpha) для остальных. Выбор делается через canPlayHevcAlpha() и порядок <source>.
 *
 * Ограничения: при отсутствии HEVC-версии на бэкенде прозрачность на iOS недоступна.
 * Перекодирование: ProRes 4444 с альфой → HEVC+alpha (ffmpeg/After Effects);
 * путь к статическим файлам: public/assets/video/*-hevc-alpha.mp4;
 * бэкенд: .../stickers/{fileId}?format=hevc или отдельное поле hevc_alpha_url в API.
 */

let cachedHevcAlpha: boolean | null = null;
let cachedVp9: boolean | null = null;

/**
 * Проверяет, поддерживает ли браузер воспроизведение HEVC (H.265) с альфа-каналом (mp4; codecs="hvc1").
 * Safari на iOS/macOS поддерживает; Chrome/Firefox на десктопе — обычно нет.
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
 * Проверяет поддержку WebM VP9 (в т.ч. с альфа-каналом, где браузер это поддерживает).
 * Используется для документации и при необходимости явного выбора формата.
 * Результат кешируется.
 */
export function canPlayVp9Alpha(): boolean {
  if (cachedVp9 !== null) {
    return cachedVp9;
  }
  if (typeof document === 'undefined') {
    return false;
  }
  try {
    const video = document.createElement('video');
    const result = video.canPlayType('video/webm; codecs="vp9"');
    cachedVp9 = result === 'probably' || result === 'maybe';
    return cachedVp9;
  } catch {
    cachedVp9 = false;
    return false;
  }
}
