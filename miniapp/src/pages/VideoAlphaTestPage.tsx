/**
 * Тест-экран для проверки прозрачного видео (альфа-канал).
 *
 * Где прозрачность работает:
 * - Safari iOS/macOS: HEVC+alpha (mp4; codecs="hvc1")
 * - Chrome, Firefox: WebM VP9
 *
 * Где не работает / ограничения:
 * - Telegram in-app WebView на iOS: зависит от версии WebView, может не поддерживать HEVC-alpha
 * - Без HEVC на бэкенде прозрачность на iOS недоступна (только WebM, который Safari не поддерживает)
 *
 * Пути к тестовым файлам: public/assets/video/
 * TODO: Добавить реальные файлы test-hevc-alpha.mp4 и test-alpha.webm
 * Экспорт: ProRes 4444 с альфой → ffmpeg (HEVC) / (WebM VP9)
 */

import { FC } from 'react';
import { canPlayHevcAlpha, canPlayVp9Alpha } from '@/utils/videoFormatSupport';

const BASE = import.meta.env.BASE_URL || '/miniapp/';
const HEVC_TEST_URL = `${BASE}assets/video/test-hevc-alpha.mp4`;
const WEBM_TEST_URL = `${BASE}assets/video/test-alpha.webm`;

export const VideoAlphaTestPage: FC = () => {
  const supportsHevc = canPlayHevcAlpha();
  const supportsVp9 = canPlayVp9Alpha();

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
      }}
    >
      <h1
        style={{
          color: '#fff',
          fontSize: 24,
          margin: 0,
          textAlign: 'center',
        }}
      >
        Video Alpha Test
      </h1>

      <div
        style={{
          color: 'rgba(255,255,255,0.8)',
          fontSize: 14,
          textAlign: 'center',
          maxWidth: 320,
        }}
      >
        <p>HEVC+alpha: {supportsHevc ? '✅' : '❌'}</p>
        <p>WebM VP9: {supportsVp9 ? '✅' : '❌'}</p>
      </div>

      <div
        style={{
          width: 200,
          height: 200,
          background: 'repeating-conic-gradient(#333 0% 25%, #555 0% 50%) 50% / 20px 20px',
          borderRadius: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <video
          autoPlay
          loop
          muted
          playsInline
          style={{
            width: '80%',
            height: '80%',
            objectFit: 'contain',
            backgroundColor: 'transparent',
          }}
        >
          <source src={HEVC_TEST_URL} type='video/mp4; codecs="hvc1"' />
          <source src={WEBM_TEST_URL} type="video/webm; codecs=vp9" />
        </video>
      </div>

      <p
        style={{
          color: 'rgba(255,255,255,0.6)',
          fontSize: 12,
          textAlign: 'center',
          maxWidth: 280,
        }}
      >
        Шахматный фон — для проверки прозрачности. Если видео с альфой загружено, фон будет виден
        сквозь прозрачные области.
      </p>
    </div>
  );
};

export default VideoAlphaTestPage;
