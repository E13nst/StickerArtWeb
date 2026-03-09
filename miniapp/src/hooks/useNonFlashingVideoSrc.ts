import { useState, useEffect, useCallback, useRef } from 'react';

// Session-level память для fileId, где blob (preferredSrc) уже падал
// Применяется только к blob (preferredSrc), чтобы не блокировать обычный URL (fallbackSrc)
const brokenPreferred = new Set<string>();

interface UseNonFlashingVideoSrcOptions {
  fileId: string;
  preferredSrc: string | undefined; // blob URL
  fallbackSrc: string; // обычный URL (всегда video URL)
  waitForPreferredMs?: number; // по умолчанию 100ms (80-150ms)
  resolvePreferredSrc?: () => string | null | undefined;
  preferPreferredOnly?: boolean;
  preferredPollMs?: number;
  preferredMaxWaitMs?: number;
  fallbackOnPreferredError?: boolean;
}

interface UseNonFlashingVideoSrcResult {
  src: string | undefined;
  isReady: boolean;
  onError: (e: React.SyntheticEvent<HTMLVideoElement>) => void;
  onLoadedData: () => void;
}

export function useNonFlashingVideoSrc({
  fileId,
  preferredSrc,
  fallbackSrc,
  waitForPreferredMs = 100,
  resolvePreferredSrc,
  preferPreferredOnly = false,
  preferredPollMs = 100,
  preferredMaxWaitMs = 2500,
  fallbackOnPreferredError = true
}: UseNonFlashingVideoSrcOptions): UseNonFlashingVideoSrcResult {
  const [src, setSrc] = useState<string | undefined>(undefined);
  const [isReady, setIsReady] = useState(false);
  const currentFileIdRef = useRef<string>(fileId);
  const waitTimeoutRef = useRef<number | null>(null);
  const preferredPollRef = useRef<number | null>(null);
  const preferredWaitStartedAtRef = useRef<number | null>(null);
  const currentSrcRef = useRef<string | undefined>(undefined);
  const isReadyRef = useRef<boolean>(false); // Ref для проверки в таймере

  // DEV-логирование
  const isDev = (import.meta as any).env?.DEV;

  // Синхронизируем ref с state
  useEffect(() => {
    isReadyRef.current = isReady;
  }, [isReady]);

  // Выбор src при смене fileId
  useEffect(() => {
    // Сброс isReady при смене fileId
    if (currentFileIdRef.current !== fileId) {
      setIsReady(false);
      isReadyRef.current = false;
      currentFileIdRef.current = fileId;
      
      if (isDev) {
        console.log(`[useNonFlashingVideoSrc] fileId changed to ${fileId.slice(-8)}`);
      }
    }

    // Очистка предыдущего таймера
    if (waitTimeoutRef.current !== null) {
      clearTimeout(waitTimeoutRef.current);
      waitTimeoutRef.current = null;
    }
    if (preferredPollRef.current !== null) {
      clearInterval(preferredPollRef.current);
      preferredPollRef.current = null;
    }
    preferredWaitStartedAtRef.current = null;

    // Если fileId в brokenPreferred → сразу fallbackSrc
    // Но в preferred-only режиме не даем session-level флагу отравлять другие компоненты.
    if (!preferPreferredOnly && brokenPreferred.has(fileId)) {
      if (isDev) {
        console.log(`[useNonFlashingVideoSrc] ${fileId.slice(-8)} in brokenPreferred, using fallback immediately`);
      }
      setSrc(fallbackSrc);
      currentSrcRef.current = fallbackSrc;
      return;
    }

    // Если preferredSrc (blob) уже есть СЕЙЧАС → используем его
    if (preferredSrc) {
      if (isDev) {
        console.log(`[useNonFlashingVideoSrc] ${fileId.slice(-8)} preferredSrc available immediately, using blob`);
      }
      setSrc(preferredSrc);
      currentSrcRef.current = preferredSrc;
      return;
    }

    if (preferPreferredOnly) {
      if (isDev) {
        console.log(`[useNonFlashingVideoSrc] ${fileId.slice(-8)} preferred-only mode, waiting for blob`);
      }

      setSrc(undefined);
      currentSrcRef.current = undefined;
      preferredWaitStartedAtRef.current = Date.now();

      preferredPollRef.current = window.setInterval(() => {
        if (isReadyRef.current) {
          if (preferredPollRef.current !== null) {
            clearInterval(preferredPollRef.current);
            preferredPollRef.current = null;
          }
          return;
        }

        const nextPreferred = resolvePreferredSrc?.() ?? preferredSrc;
        if (nextPreferred) {
          if (isDev) {
            console.log(`[useNonFlashingVideoSrc] ${fileId.slice(-8)} preferredSrc appeared during polling, using blob`);
          }
          setSrc(nextPreferred);
          currentSrcRef.current = nextPreferred;
          if (preferredPollRef.current !== null) {
            clearInterval(preferredPollRef.current);
            preferredPollRef.current = null;
          }
          return;
        }

        const waitedMs = Date.now() - (preferredWaitStartedAtRef.current ?? Date.now());
        if (waitedMs >= preferredMaxWaitMs) {
          if (isDev) {
            console.log(`[useNonFlashingVideoSrc] ${fileId.slice(-8)} preferred-only wait timed out after ${waitedMs}ms, using fallback`);
          }
          setSrc(fallbackSrc);
          currentSrcRef.current = fallbackSrc;
          if (preferredPollRef.current !== null) {
            clearInterval(preferredPollRef.current);
            preferredPollRef.current = null;
          }
        }
      }, preferredPollMs);

      return () => {
        if (preferredPollRef.current !== null) {
          clearInterval(preferredPollRef.current);
          preferredPollRef.current = null;
        }
      };
    }

    // Иначе → запускаем короткое окно ожидания
    // ВАЖНО: micro-wait выполняется только если видео еще НЕ показано (opacity: 0 / isReady = false)
    if (isDev) {
      console.log(`[useNonFlashingVideoSrc] ${fileId.slice(-8)} preferredSrc not available, waiting ${waitForPreferredMs}ms`);
    }

    // Сначала устанавливаем fallback, чтобы видео могло начать загрузку
    setSrc(fallbackSrc);
    currentSrcRef.current = fallbackSrc;

    // Запускаем таймер ожидания
    waitTimeoutRef.current = window.setTimeout(() => {
      // Проверяем, появился ли preferredSrc за это время
      // Но НЕ переключаемся, если видео уже готово (HARD RULE)
      // Используем ref для проверки isReady, чтобы избежать замыкания
      if (!isReadyRef.current && preferredSrc) {
        if (isDev) {
          console.log(`[useNonFlashingVideoSrc] ${fileId.slice(-8)} preferredSrc appeared during wait, switching to blob`);
        }
        setSrc(preferredSrc);
        currentSrcRef.current = preferredSrc;
      } else {
        if (isDev) {
          console.log(`[useNonFlashingVideoSrc] ${fileId.slice(-8)} preferredSrc did not appear or video already ready, staying with fallback`);
        }
      }
      waitTimeoutRef.current = null;
    }, waitForPreferredMs);

    return () => {
      if (waitTimeoutRef.current !== null) {
        clearTimeout(waitTimeoutRef.current);
        waitTimeoutRef.current = null;
      }
    };
  }, [
    fileId,
    preferredSrc,
    fallbackSrc,
    waitForPreferredMs,
    isDev,
    preferPreferredOnly,
    preferredPollMs,
    preferredMaxWaitMs,
    resolvePreferredSrc,
  ]);

  // Отдельный эффект для отслеживания появления preferredSrc после начала ожидания
  useEffect(() => {
    // Если preferredSrc появился, но мы еще ждем (таймер активен) и видео не готово
    if (preferredSrc && waitTimeoutRef.current !== null && !isReadyRef.current && currentSrcRef.current === fallbackSrc) {
      // Проверяем, не истек ли таймер
      // Если таймер еще активен, переключаемся на preferredSrc
      if (isDev) {
        console.log(`[useNonFlashingVideoSrc] ${fileId.slice(-8)} preferredSrc appeared, switching to blob`);
      }
      if (waitTimeoutRef.current !== null) {
        clearTimeout(waitTimeoutRef.current);
        waitTimeoutRef.current = null;
      }
      setSrc(preferredSrc);
      currentSrcRef.current = preferredSrc;
    }
  }, [preferredSrc, fileId, isDev]);

  // Обработка ошибок
  const onError = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    void e;
    const currentSrc = currentSrcRef.current;

    if (isDev) {
      console.warn(`[useNonFlashingVideoSrc] ${fileId.slice(-8)} video error, current src: ${currentSrc === preferredSrc ? 'blob' : 'url'}`);
    }

    // Если текущий src === preferredSrc (blob) → один раз переключить на fallbackSrc
    if (currentSrc === preferredSrc) {
      if (!fallbackOnPreferredError) {
        if (isDev) {
          console.warn(`[useNonFlashingVideoSrc] ${fileId.slice(-8)} preferred failed, fallback disabled`);
        }
        setIsReady(false);
        return;
      }
      if (isDev) {
        console.log(`[useNonFlashingVideoSrc] ${fileId.slice(-8)} blob failed, switching to fallback`);
      }
      // Добавляем fileId в brokenPreferred
      brokenPreferred.add(fileId);
      // Переключаемся на fallback
      setSrc(fallbackSrc);
      currentSrcRef.current = fallbackSrc;
      // Сброс isReady до loadeddata
      setIsReady(false);
    } else {
      // Если уже fallback → ничего не делаем (только DEV-log)
      if (isDev) {
        console.warn(`[useNonFlashingVideoSrc] ${fileId.slice(-8)} fallback also failed, no further action`);
      }
    }
  }, [fileId, preferredSrc, fallbackSrc, fallbackOnPreferredError, isDev]);

  // Готовность видео
  const onLoadedData = useCallback(() => {
    if (isDev) {
      console.log(`[useNonFlashingVideoSrc] ${fileId.slice(-8)} video loaded, setting isReady=true`);
    }
    setIsReady(true);
  }, [fileId, isDev]);

  return {
    src,
    isReady,
    onError,
    onLoadedData
  };
}
