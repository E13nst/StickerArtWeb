/**
 * Безопасная настройка viewport для Telegram Mini App
 * Использует @twa-dev/sdk (текущий SDK в проекте)
 * 
 * Примечание: Для использования официального SDK (@telegram-apps/sdk) 
 * необходимо установить зависимости: npm i @telegram-apps/sdk @telegram-apps/bridge
 */

/**
 * Определяет, является ли устройство мобильным
 */
export function isMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

/**
 * Проверяет, запущено ли приложение внутри Telegram Mini App
 */
async function isTMA(): Promise<boolean> {
  // Проверка через window.Telegram (работает для обоих SDK)
  return Boolean(
    typeof window !== "undefined" &&
    window.Telegram &&
    window.Telegram.WebApp &&
    window.Telegram.WebApp.initData &&
    window.Telegram.WebApp.version
  );
}

/**
 * Проверяет доступность метода requestFullscreen() в Telegram WebApp
 */
function isRequestFullscreenAvailable(webApp: any): boolean {
  return Boolean(
    (typeof webApp.requestFullscreen === "function") ||
    (typeof window.Telegram?.WebApp?.requestFullscreen === "function")
  );
}

/**
 * Безопасно вызывает requestFullscreen() на мобильных устройствах
 * 
 * @param webApp - Экземпляр Telegram WebApp
 * @returns true если вызов был успешным, false в противном случае
 */
async function requestFullscreenSafe(webApp: any): Promise<boolean> {
  try {
    // Проверяем, что мы на мобильном устройстве
    if (!isMobile()) {
      console.log("[TMA Viewport] requestFullscreen() пропущен - не мобильное устройство");
      return false;
    }

    // Проверяем доступность метода
    if (!isRequestFullscreenAvailable(webApp)) {
      console.log("[TMA Viewport] requestFullscreen() недоступен в текущей версии Telegram WebApp");
      return false;
    }

    // Проверяем, что приложение уже не в fullscreen (если есть свойство isFullscreen)
    if (webApp.isFullscreen === true) {
      console.log("[TMA Viewport] Приложение уже в fullscreen, пропускаем запрос");
      return true; // Уже в fullscreen, считаем успешным
    }

    // Получаем метод requestFullscreen (может быть на webApp или window.Telegram.WebApp)
    const requestFullscreenMethod = webApp.requestFullscreen || window.Telegram?.WebApp?.requestFullscreen;

    if (!requestFullscreenMethod) {
      console.warn("[TMA Viewport] requestFullscreen() метод не найден");
      return false;
    }

    // Вызываем requestFullscreen()
    requestFullscreenMethod.call(webApp);
    console.log("[TMA Viewport] requestFullscreen() успешно вызван");

    // Небольшая задержка для проверки результата
    await new Promise(resolve => setTimeout(resolve, 100));

    // Проверяем результат (если есть свойство isFullscreen)
    if (webApp.isFullscreen === true) {
      console.log("[TMA Viewport] Приложение перешло в fullscreen режим");
      return true;
    }

    // Если свойство isFullscreen недоступно, считаем вызов успешным
    // (метод был вызван без ошибок)
    return true;

  } catch (e) {
    // Обрабатываем ошибки gracefully - не прерываем работу приложения
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.warn("[TMA Viewport] Ошибка при вызове requestFullscreen():", errorMessage);
    
    // Если ошибка связана с тем, что уже в fullscreen - это не критично
    if (errorMessage.includes("already") || errorMessage.includes("fullscreen")) {
      console.log("[TMA Viewport] Приложение уже в fullscreen или запрос отклонен");
      return true; // Считаем успешным, если уже в fullscreen
    }
    
    return false;
  }
}

/**
 * Безопасная настройка viewport для Telegram Mini App
 * 
 * Последовательность действий:
 * 1. Проверяет, что мы в Telegram Mini App
 * 2. Ждет полной инициализации Telegram WebApp
 * 3. Разворачивает Mini App в full size (expand) с проверкой состояния
 * 4. На мобильных устройствах после успешного expand() вызывает requestFullscreen()
 * 5. Подписывается на события fullscreen для отслеживания изменений
 * 
 * Важно: После expand() (fullsize) на мобильных устройствах вызывается requestFullscreen()
 * для перехода в полноэкранный режим, если метод доступен.
 */
export async function setupTelegramViewportSafe(): Promise<void> {
  try {
    // 1. Проверяем, что мы вообще в Telegram Mini App
    const inTma = await isTMA();
    if (!inTma) {
      console.log("[TMA Viewport] Не в Telegram Mini App, пропускаем настройку viewport");
      return;
    }

    // 2. Используем @twa-dev/sdk (текущий SDK в проекте)
    if (typeof window !== "undefined" && window.Telegram?.WebApp) {
      const webApp = window.Telegram.WebApp;

      // Ждем немного, чтобы Telegram WebApp полностью инициализировался
      // Это критично для мобильных устройств, где expand() может не сработать сразу
      await new Promise(resolve => setTimeout(resolve, 100));

      // 3. Разворачиваем Mini App в full size только если она еще не развернута
      let expandSuccessful = false;
      if (typeof webApp.expand === "function") {
        try {
          // Проверяем текущее состояние перед вызовом expand()
          const wasExpanded = webApp.isExpanded;
          
          if (!wasExpanded) {
            webApp.expand();
            console.log("[TMA Viewport] Mini App развернута в full size (@twa-dev/sdk)");
            expandSuccessful = true;
            
            // На мобильных устройствах делаем дополнительную попытку через небольшую задержку
            // Это помогает, если первый вызов expand() не сработал из-за тайминга
            if (isMobile()) {
              setTimeout(() => {
                if (!webApp.isExpanded) {
                  console.log("[TMA Viewport] Повторная попытка expand() на мобильном устройстве");
                  webApp.expand();
                }
              }, 300);
            }
          } else {
            console.log("[TMA Viewport] Mini App уже развернута, пропускаем expand()");
            expandSuccessful = true; // Уже развернуто, считаем успешным
          }
        } catch (e) {
          console.warn("[TMA Viewport] Ошибка expand (@twa-dev/sdk):", e);
        }
      }

      // 4. После успешного expand() на мобильных вызываем requestFullscreen()
      if (expandSuccessful && isMobile()) {
        // Небольшая задержка для стабильности перед вызовом requestFullscreen()
        await new Promise(resolve => setTimeout(resolve, 100));
        
        try {
          await requestFullscreenSafe(webApp);
        } catch (e) {
          // Ошибка requestFullscreen не должна прерывать работу приложения
          console.warn("[TMA Viewport] Ошибка при вызове requestFullscreen() после expand():", e);
        }
      }

      // 5. Подписываемся на события fullscreen для отслеживания изменений
      // Убрано: viewportChanged handler с expand() - expand() вызывается только при инициализации
      if (typeof webApp.onEvent === "function") {
        // Подписываемся на события fullscreen для отслеживания изменений
        // Проверяем оба варианта названий событий (camelCase и snake_case)
        const fullscreenChangedEvents = ["fullscreenChanged", "fullscreen_changed"];
        const fullscreenFailedEvents = ["fullscreenFailed", "fullscreen_failed"];

        // Обработчик для fullscreenChanged
        const handleFullscreenChanged = (eventData?: any) => {
          const isDev = import.meta.env.DEV;
          if (isDev) {
            console.log("[TMA Viewport] fullscreenChanged событие:", eventData || "без payload");
          }
        };

        // Обработчик для fullscreenFailed
        const handleFullscreenFailed = (eventData?: any) => {
          const isDev = import.meta.env.DEV;
          if (isDev) {
            console.warn("[TMA Viewport] fullscreenFailed событие:", eventData || "без payload");
          } else {
            // В production логируем только краткое предупреждение
            console.warn("[TMA Viewport] Запрос fullscreen не удался");
          }
        };

        // Подписываемся на события fullscreenChanged (пробуем оба варианта)
        for (const eventName of fullscreenChangedEvents) {
          try {
            webApp.onEvent(eventName, handleFullscreenChanged);
            if (import.meta.env.DEV) {
              console.log(`[TMA Viewport] Подписка на событие ${eventName} установлена`);
            }
            break; // Если успешно подписались, не пробуем другие варианты
          } catch (e) {
            // Событие может быть недоступно, это нормально
            if (import.meta.env.DEV) {
              console.log(`[TMA Viewport] Событие ${eventName} недоступно`);
            }
          }
        }

        // Подписываемся на события fullscreenFailed (пробуем оба варианта)
        for (const eventName of fullscreenFailedEvents) {
          try {
            webApp.onEvent(eventName, handleFullscreenFailed);
            if (import.meta.env.DEV) {
              console.log(`[TMA Viewport] Подписка на событие ${eventName} установлена`);
            }
            break; // Если успешно подписались, не пробуем другие варианты
          } catch (e) {
            // Событие может быть недоступно, это нормально
            if (import.meta.env.DEV) {
              console.log(`[TMA Viewport] Событие ${eventName} недоступно`);
            }
          }
        }
      }
    }
  } catch (e) {
    console.error("[TMA Viewport] Критическая ошибка setupTelegramViewportSafe:", e);
  }
}
