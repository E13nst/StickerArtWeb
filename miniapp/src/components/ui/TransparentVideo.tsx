import { forwardRef } from 'react';
import { canPlayHevcAlpha } from '@/utils/videoFormatSupport';

/**
 * Video с поддержкой двух источников для прозрачности на iOS.
 *
 * Выбор формата: при canPlayHevcAlpha() и наличии hevcUrl — рендерим два <source>
 * (HEVC первым для Safari/iOS, WebM вторым как fallback). Иначе — один источник webm.
 *
 * Ограничение: при отсутствии HEVC на бэкенде прозрачность на iOS недоступна.
 */

export interface TransparentVideoProps
  extends Omit<React.VideoHTMLAttributes<HTMLVideoElement>, 'src'> {
  /** WebM (blob или URL) — основной источник для Android/desktop */
  webmSrc: string;
  /** Опциональный URL HEVC+alpha для Safari/iOS. Пока бэкенд не отдаёт — прозрачность на iOS недоступна. */
  hevcUrl?: string;
  /** Дочерние элементы (игнорируются при использовании source) */
  children?: React.ReactNode;
}

export const TransparentVideo = forwardRef<
  HTMLVideoElement,
  TransparentVideoProps
>(({ webmSrc, hevcUrl, children, ...videoProps }, ref) => {
  const useDualSource =
    hevcUrl &&
    hevcUrl.length > 0 &&
    canPlayHevcAlpha() &&
    typeof webmSrc === 'string' &&
    webmSrc.length > 0;

  if (useDualSource) {
    return (
      <video
        ref={ref}
        autoPlay
        loop
        muted
        playsInline
        {...videoProps}
        style={{
          backgroundColor: 'transparent',
          ...videoProps.style,
        }}
      >
        <source src={hevcUrl} type='video/mp4; codecs="hvc1"' />
        <source src={webmSrc} type='video/webm; codecs=vp9' />
        {children}
      </video>
    );
  }

  return (
    <video
      ref={ref}
      src={webmSrc}
      autoPlay
      loop
      muted
      playsInline
      {...videoProps}
      style={{
        backgroundColor: 'transparent',
        ...videoProps.style,
      }}
    >
      {children}
    </video>
  );
});

TransparentVideo.displayName = 'TransparentVideo';
