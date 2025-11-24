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
    window.Telegram.WebApp.initData
  );
}

/**
 * Безопасная настройка viewport для Telegram Mini App
 * 
 * Последовательность действий:
 * 1. Проверяет, что мы в Telegram Mini App
 * 2. Ждет полной инициализации Telegram WebApp
 * 3. Разворачивает Mini App в full size (expand) с проверкой состояния
 * 4. На мобильных устройствах обеспечивает полноэкранный режим через expand()
 * 
 * Важно: Telegram MiniApps не поддерживают стандартный браузерный fullscreen API.
 * Вместо этого используется метод expand(), который разворачивает приложение на весь экран.
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
      if (typeof webApp.expand === "function") {
        try {
          // Проверяем текущее состояние перед вызовом expand()
          const wasExpanded = webApp.isExpanded;
          
          if (!wasExpanded) {
            webApp.expand();
            console.log("[TMA Viewport] Mini App развернута в full size (@twa-dev/sdk)");
            
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
          }
        } catch (e) {
          console.warn("[TMA Viewport] Ошибка expand (@twa-dev/sdk):", e);
        }
      }

      // 4. Подписываемся на события изменения viewport для поддержания fullscreen
      if (typeof webApp.onEvent === "function") {
        webApp.onEvent("viewportChanged", () => {
          // Если приложение свернулось - разворачиваем обратно
          if (!webApp.isExpanded && isMobile()) {
            console.log("[TMA Viewport] Viewport изменился, разворачиваем обратно");
            setTimeout(() => {
              if (typeof webApp.expand === "function") {
                webApp.expand();
              }
            }, 50);
          }
        });
      }
    }
  } catch (e) {
    console.error("[TMA Viewport] Критическая ошибка setupTelegramViewportSafe:", e);
  }
}
