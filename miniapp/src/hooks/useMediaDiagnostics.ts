import { useState, useEffect, useRef, useCallback } from 'react';
import { videoBlobCache } from '../utils/videoBlobCache';

export interface DiagnosticsEvent {
  name: string;
  atMs: number;
  detail?: string;
}

export interface DiagnosticsContext {
  componentName?: string;
  inView?: boolean;
  stickerIndex?: number;
  preferredSrcPresent?: boolean;
  srcStrategy?: string;
}

export interface DiagnosticsResult {
  codecSupport: { vp8: string; vp9: string; h264: string };
  network: {
    srcUrl: string;
    isBlobUrl: boolean;
    actualSrc?: string;
    httpStatus?: number;
    fetchMs?: number;
    error?: string;
    contentType?: string;
    acceptRanges?: string;
    contentLength?: string;
  };
  dom: { width: number; height: number; isVisible: boolean };
  playback: {
    readyState: number;
    networkState: number;
    errorCode?: number;
    errorMessage?: string;
    duration?: number;
    blobCacheHit: boolean;
    currentTime?: number;
    paused?: boolean;
    ended?: boolean;
    seeking?: boolean;
    videoWidth?: number;
    videoHeight?: number;
    preload?: string | null;
    autoplay?: boolean;
    muted?: boolean;
    playsInline?: boolean;
  };
  context?: DiagnosticsContext;
  events: DiagnosticsEvent[];
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

interface UseMediaDiagnosticsOptions {
  context?: DiagnosticsContext;
}

interface UseMediaDiagnosticsResult {
  diagnostics: DiagnosticsResult | null;
  reportEvent: (name: string, detail?: string) => void;
}

const DIAG_TIMEOUT_MS = 3000;
const MAX_EVENTS = 20;

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

function pushEvent(
  events: DiagnosticsEvent[],
  startedAt: number,
  name: string,
  detail?: string
): DiagnosticsEvent[] {
  const atMs = Math.max(0, Math.round(Date.now() - startedAt));
  return [...events, { name, atMs, detail }].slice(-MAX_EVENTS);
}

function getDomSnapshot(el: HTMLVideoElement) {
  const rect = el.getBoundingClientRect();
  const width = Math.round(rect.width);
  const height = Math.round(rect.height);
  return {
    width,
    height,
    isVisible: width > 0 && height > 0,
  };
}

function getPlaybackSnapshot(el: HTMLVideoElement, fileId: string): DiagnosticsResult['playback'] {
  return {
    readyState: el.readyState,
    networkState: el.networkState,
    errorCode: el.error?.code,
    errorMessage: el.error?.message,
    duration: el.duration,
    blobCacheHit: videoBlobCache.get(fileId) !== null,
    currentTime: el.currentTime,
    paused: el.paused,
    ended: el.ended,
    seeking: el.seeking,
    videoWidth: el.videoWidth,
    videoHeight: el.videoHeight,
    preload: el.getAttribute('preload'),
    autoplay: el.autoplay,
    muted: el.muted,
    playsInline: (el as HTMLVideoElement & { playsInline?: boolean }).playsInline,
  };
}

export function useMediaDiagnostics(
  sticker: StickerLike | null | undefined,
  videoRef: React.RefObject<HTMLVideoElement | null>,
  inView: boolean,
  enabled: boolean,
  options?: UseMediaDiagnosticsOptions
): UseMediaDiagnosticsResult {
  const [result, setResult] = useState<DiagnosticsResult | null>(null);
  const startedAtRef = useRef<number>(0);
  const attachedForFileIdRef = useRef<string | null>(null);

  const isVideo =
    sticker && (sticker.isVideo === true || (sticker as any).is_video === true);

  const buildFailureReasons = useCallback(
    (
      codec: { vp8: string; vp9: string },
      playback: DiagnosticsResult['playback'],
      dom: DiagnosticsResult['dom']
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

  const reportEvent = useCallback((name: string, detail?: string) => {
    setResult((prev) =>
      prev
        ? {
            ...prev,
            events: pushEvent(prev.events, startedAtRef.current, name, detail),
          }
        : prev
    );
  }, []);

  useEffect(() => {
    if (!enabled || !sticker || !isVideo) {
      setResult(null);
      return;
    }

    startedAtRef.current = Date.now();
    const codecSupport = getCodecSupport();
    const meta = getMeta(sticker.fileId, startedAtRef.current);
    const blobCacheHit = videoBlobCache.get(sticker.fileId) !== null;
    const dom = { width: 0, height: 0, isVisible: false };
    const playback = {
      readyState: 0,
      networkState: 0,
      blobCacheHit,
      currentTime: 0,
      paused: true,
      ended: false,
      seeking: false,
      videoWidth: 0,
      videoHeight: 0,
      preload: null,
      autoplay: false,
      muted: true,
      playsInline: false,
    };
    const failureReasons =
      codecSupport.vp8 === '' && codecSupport.vp9 === ''
        ? ['WebM codec not supported (iOS/Safari)']
        : [];

    setResult({
      codecSupport,
      network: {
        srcUrl: sticker.url || '',
        isBlobUrl: (sticker.url || '').startsWith('blob:'),
      },
      dom,
      playback,
      context: options?.context,
      events: [{ name: 'diag-init', atMs: 0 }],
      meta,
      hasFailed: failureReasons.length > 0,
      failureReasons,
    });

    attachedForFileIdRef.current = null;
  }, [enabled, sticker?.fileId, sticker?.url, isVideo, buildFailureReasons, options?.context]);

  useEffect(() => {
    if (!enabled || !isVideo) return;
    setResult((prev) =>
      prev
        ? {
            ...prev,
            context: options?.context,
          }
        : prev
    );
  }, [enabled, inView, isVideo, options?.context]);

  useEffect(() => {
    if (!enabled || !isVideo || !videoRef.current || !sticker?.fileId) return;
    if (attachedForFileIdRef.current === sticker.fileId) return;

    const el = videoRef.current;
    attachedForFileIdRef.current = sticker.fileId;

    const track = (eventName: string) => {
      setResult((prev) => {
        if (!prev) return prev;
        const playback = getPlaybackSnapshot(el, prev.meta.fileId);
        const dom = getDomSnapshot(el);
        const actualSrc = el.currentSrc || el.src || undefined;
        const failureReasons = buildFailureReasons(prev.codecSupport, playback, dom);
        return {
          ...prev,
          network: { ...prev.network, actualSrc },
          dom,
          playback,
          meta: getMeta(prev.meta.fileId, startedAtRef.current),
          events: pushEvent(prev.events, startedAtRef.current, eventName),
          hasFailed: failureReasons.length > 0,
          failureReasons,
        };
      });
    };

    const eventNames = [
      'loadstart',
      'loadedmetadata',
      'loadeddata',
      'canplay',
      'canplaythrough',
      'play',
      'playing',
      'pause',
      'waiting',
      'stalled',
      'suspend',
      'emptied',
      'durationchange',
      'error',
    ] as const;

    const handlers = eventNames.map((eventName) => {
      const handler = () => track(eventName);
      el.addEventListener(eventName, handler);
      return { eventName, handler };
    });

    return () => {
      handlers.forEach(({ eventName, handler }) => {
        el.removeEventListener(eventName, handler);
      });
      if (attachedForFileIdRef.current === sticker.fileId) {
        attachedForFileIdRef.current = null;
      }
    };
  }, [enabled, isVideo, sticker?.fileId, buildFailureReasons, videoRef]);

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
        const contentType = res.headers.get('content-type') ?? undefined;
        const acceptRanges = res.headers.get('accept-ranges') ?? undefined;
        const contentLength = res.headers.get('content-length') ?? undefined;
        setResult((prev) =>
          prev
            ? {
                ...prev,
                network: {
                  ...prev.network,
                  httpStatus: res.status,
                  fetchMs,
                  contentType,
                  acceptRanges,
                  contentLength,
                },
                events: pushEvent(prev.events, startedAtRef.current, 'head-ok', String(res.status)),
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
                events: pushEvent(prev.events, startedAtRef.current, 'head-fail', err?.message || 'network'),
              }
            : null
        );
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, sticker?.url, result?.meta.fileId]);

  useEffect(() => {
    if (!enabled || !isVideo || !inView || !result) return;

    const timer = setTimeout(() => {
      const el = videoRef.current;
      if (!el) return;

      setResult((prev) => {
        if (!prev) return null;
        const playback = getPlaybackSnapshot(el, prev.meta.fileId);
        const dom = getDomSnapshot(el);
        const actualSrc = el.currentSrc || el.src || undefined;
        const failureReasons = buildFailureReasons(prev.codecSupport, playback, dom);
        return {
          ...prev,
          network: { ...prev.network, actualSrc },
          dom,
          playback,
          meta: getMeta(prev.meta.fileId, startedAtRef.current),
          events: pushEvent(prev.events, startedAtRef.current, 'timeout-snapshot', `${playback.readyState}/${playback.networkState}`),
          hasFailed: failureReasons.length > 0,
          failureReasons,
        };
      });
    }, DIAG_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [enabled, isVideo, inView, result?.meta.fileId, buildFailureReasons, videoRef]);

  return {
    diagnostics: result,
    reportEvent,
  };
}
