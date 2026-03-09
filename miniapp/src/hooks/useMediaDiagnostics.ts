import { useState, useEffect, useRef, useCallback } from 'react';

export interface DiagnosticsResult {
  codecSupport: { vp8: string; vp9: string; h264: string };
  network: { srcUrl: string; isBlobUrl: boolean; httpStatus?: number; fetchMs?: number; error?: string };
  dom: { width: number; height: number; isVisible: boolean };
  playback: {
    readyState: number;
    networkState: number;
    errorCode?: number;
    errorMessage?: string;
  };
  meta: { ua: string; isTelegramWebView: boolean; fileId: string; diagMs: number };
  hasFailed: boolean;
  failureReasons: string[];
}

interface StickerLike {
  fileId: string;
  url: string;
  isVideo?: boolean;
  is_video?: boolean;
}

const DIAG_TIMEOUT_MS = 3000;

function getCodecSupport(): { vp8: string; vp9: string; h264: string } {
  if (typeof document === 'undefined') return { vp8: '', vp9: '', h264: '' };
  const video = document.createElement('video');
  return {
    vp8: video.canPlayType('video/webm; codecs="vp8"'),
    vp9: video.canPlayType('video/webm; codecs="vp9"'),
    h264: video.canPlayType('video/mp4; codecs="avc1.42E01E"'),
  };
}

function getMeta(fileId: string, startedAt: number): DiagnosticsResult['meta'] {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const shortUa = ua.length > 60 ? ua.slice(0, 57) + '...' : ua;
  const isTelegramWebView =
    typeof window !== 'undefined' && !!(window as any).Telegram?.WebApp;
  return {
    ua: shortUa,
    isTelegramWebView,
    fileId,
    diagMs: Math.round(Date.now() - startedAt),
  };
}

export function useMediaDiagnostics(
  sticker: StickerLike | null | undefined,
  videoRef: React.RefObject<HTMLVideoElement | null>,
  inView: boolean,
  enabled: boolean
): DiagnosticsResult | null {
  const [result, setResult] = useState<DiagnosticsResult | null>(null);
  const startedAtRef = useRef<number>(0);
  const attachedForFileIdRef = useRef<string | null>(null);

  const isVideo =
    sticker && (sticker.isVideo === true || (sticker as any).is_video === true);

  const buildFailureReasons = useCallback(
    (
      codec: { vp8: string; vp9: string },
      playback: { readyState: number; networkState: number; errorCode?: number; errorMessage?: string },
      dom: { width: number; height: number }
    ): string[] => {
      const reasons: string[] = [];
      if (codec.vp8 === '' && codec.vp9 === '') {
        reasons.push('WebM codec not supported (iOS/Safari)');
      }
      if (playback.readyState === 0) {
        reasons.push('Video readyState=0 (HAVE_NOTHING)');
      }
      if (playback.networkState === 3) {
        reasons.push('Video networkState=3 (NETWORK_NO_SOURCE)');
      }
      if (playback.errorCode !== undefined && playback.errorCode !== 0) {
        reasons.push(
          playback.errorMessage
            ? `MediaError: ${playback.errorMessage} (code ${playback.errorCode})`
            : `MediaError code ${playback.errorCode}`
        );
      }
      if (dom.width === 0 && dom.height === 0) {
        reasons.push('DOM dimensions 0x0');
      }
      return reasons;
    },
    []
  );

  // Codec check and initial result (only for video, when enabled)
  useEffect(() => {
    if (!enabled || !sticker || !isVideo) {
      setResult(null);
      return;
    }
    startedAtRef.current = Date.now();
    const codecSupport = getCodecSupport();
    const meta = getMeta(sticker.fileId, startedAtRef.current);
    setResult({
      codecSupport,
      network: {
        srcUrl: sticker.url || '',
        isBlobUrl: (sticker.url || '').startsWith('blob:'),
      },
      dom: { width: 0, height: 0, isVisible: false },
      playback: { readyState: 0, networkState: 0 },
      meta,
      hasFailed: codecSupport.vp8 === '' && codecSupport.vp9 === '',
      failureReasons:
        codecSupport.vp8 === '' && codecSupport.vp9 === ''
          ? ['WebM codec not supported (iOS/Safari)']
          : [],
    });
    attachedForFileIdRef.current = null;
  }, [enabled, sticker?.fileId, sticker?.url, isVideo]);

  // Video event listeners (error, stalled, emptied) — attach once per fileId
  useEffect(() => {
    if (!enabled || !isVideo || !videoRef.current || !sticker?.fileId) return;
    if (attachedForFileIdRef.current === sticker.fileId) return;

    const el = videoRef.current;
    attachedForFileIdRef.current = sticker.fileId;

    const onError = () => {
      setResult((prev) => {
        if (!prev || !el) return prev;
        const errorCode = el.error?.code;
        const errorMessage = el.error?.message;
        const playback = {
          ...prev.playback,
          readyState: el.readyState,
          networkState: el.networkState,
          errorCode,
          errorMessage,
        };
        const reasons = buildFailureReasons(
          prev.codecSupport,
          playback,
          prev.dom
        );
        return {
          ...prev,
          playback,
          hasFailed: reasons.length > 0,
          failureReasons: reasons,
        };
      });
    };

    const onStalled = () => onError();
    const onEmptied = () => onError();

    el.addEventListener('error', onError);
    el.addEventListener('stalled', onStalled);
    el.addEventListener('emptied', onEmptied);

    return () => {
      el.removeEventListener('error', onError);
      el.removeEventListener('stalled', onStalled);
      el.removeEventListener('emptied', onEmptied);
      if (attachedForFileIdRef.current === sticker.fileId) {
        attachedForFileIdRef.current = null;
      }
    };
  }, [enabled, isVideo, sticker?.fileId, buildFailureReasons]);

  // HEAD request for non-blob URL (async, non-blocking)
  useEffect(() => {
    if (!enabled || !sticker?.url || !result) return;
    const url = sticker.url;
    if (url.startsWith('blob:')) return;

    let cancelled = false;
    const start = Date.now();
    fetch(url, { method: 'HEAD', mode: 'cors' })
      .then((res) => {
        if (cancelled) return;
        const fetchMs = Date.now() - start;
        setResult((prev) =>
          prev
            ? {
                ...prev,
                network: {
                  ...prev.network,
                  httpStatus: res.status,
                  fetchMs,
                },
              }
            : null
        );
      })
      .catch((err) => {
        if (cancelled) return;
        setResult((prev) =>
          prev
            ? {
                ...prev,
                network: {
                  ...prev.network,
                  error: err?.message || 'CORS or network error',
                },
              }
            : null
        );
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, sticker?.url, result?.meta.fileId]);

  // Timeout check (3s after inView): readyState, networkState, getBoundingClientRect
  useEffect(() => {
    if (!enabled || !isVideo || !inView || !result) return;

    const timer = setTimeout(() => {
      const el = videoRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);
      const isVisible = width > 0 && height > 0;

      setResult((prev) => {
        if (!prev) return null;
        const playback = {
          readyState: el.readyState,
          networkState: el.networkState,
          errorCode: el.error?.code,
          errorMessage: el.error?.message,
        };
        const dom = { width, height, isVisible };
        const reasons = buildFailureReasons(
          prev.codecSupport,
          playback,
          dom
        );
        const meta = getMeta(prev.meta.fileId, startedAtRef.current);
        return {
          ...prev,
          dom,
          playback,
          meta,
          hasFailed: reasons.length > 0,
          failureReasons: reasons,
        };
      });
    }, DIAG_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [enabled, isVideo, inView, result?.meta.fileId, buildFailureReasons]);

  return result;
}
