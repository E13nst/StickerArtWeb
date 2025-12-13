import { useState, useEffect, useCallback, useRef } from 'react';

// Session-level память для fileId, где blob (preferredSrc) уже падал
// Применяется только к blob (preferredSrc), чтобы не блокировать обычный URL (fallbackSrc)
const brokenPreferred = new Set<string>();

interface UseNonFlashingVideoSrcOptions {
  fileId: string;
  preferredSrc: string | undefined; // blob URL
  fallbackSrc: string; // обычный URL (всегда video URL)
  waitForPreferredMs?: number; // по умолчанию 100ms (80-150ms)
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
  waitForPreferredMs = 100
}: UseNonFlashingVideoSrcOptions): UseNonFlashingVideoSrcResult {
  const [src, setSrc] = useState<string | undefined>(undefined);
  const [isReady, setIsReady] = useState(false);
  const currentFileIdRef = useRef<string>(fileId);
  const waitTimeoutRef = useRef<number | null>(null);
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

    // Если fileId в brokenPreferred → сразу fallbackSrc
    if (brokenPreferred.has(fileId)) {
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
  }, [fileId, preferredSrc, fallbackSrc, waitForPreferredMs, isDev]);

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
    const video = e.currentTarget;
    const currentSrc = currentSrcRef.current;

    if (isDev) {
      console.warn(`[useNonFlashingVideoSrc] ${fileId.slice(-8)} video error, current src: ${currentSrc === preferredSrc ? 'blob' : 'url'}`);
    }

    // Если текущий src === preferredSrc (blob) → один раз переключить на fallbackSrc
    if (currentSrc === preferredSrc) {
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
  }, [fileId, preferredSrc, fallbackSrc, isDev]);

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

