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
 * 2. Разворачивает Mini App в full size (expand)
 * 3. На мобильных устройствах запрашивает fullscreen
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

      // Разворачиваем Mini App в full size
      if (typeof webApp.expand === "function") {
        try {
          webApp.expand();
          console.log("[TMA Viewport] Mini App развернута в full size (@twa-dev/sdk)");
        } catch (e) {
          console.warn("[TMA Viewport] Ошибка expand (@twa-dev/sdk):", e);
        }
      }

      // 3. На мобильных устройствах пытаемся запросить fullscreen
      if (isMobile()) {
        // @twa-dev/sdk не имеет прямого метода requestFullscreen
        // Используем DOM API для запроса fullscreen (если доступно)
        if (typeof document !== "undefined" && document.documentElement.requestFullscreen) {
          try {
            await document.documentElement.requestFullscreen();
            console.log("[TMA Viewport] Fullscreen запрошен через DOM API");
          } catch (e) {
            console.warn("[TMA Viewport] Ошибка requestFullscreen через DOM API:", e);
          }
        }
      } else {
        console.log("[TMA Viewport] Десктоп устройство, пропускаем fullscreen");
      }
    }
  } catch (e) {
    console.error("[TMA Viewport] Критическая ошибка setupTelegramViewportSafe:", e);
  }
}
