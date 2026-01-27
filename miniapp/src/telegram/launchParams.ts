// ✅ FIX: Захватчик initData для работы с search и hash (включая HashRouter)
// Работает ДО инициализации роутера/React, чтобы параметры не потерялись

const KEY = "tg_init_data_raw";

function readFromSearch(): string | null {
  const sp = new URLSearchParams(window.location.search);
  const v = sp.get("tgWebAppData");
  return v ? decodeURIComponent(v) : null;
}

function readFromHash(): string | null {
  const raw = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
  if (!raw) return null;

  // HashRouter: "#/path?tgWebAppData=..."
  const queryPart = raw.includes("?") ? raw.split("?").pop()! : raw; // "#tgWebAppData=..." тоже ок
  const sp = new URLSearchParams(queryPart);
  const v = sp.get("tgWebAppData");
  return v ? decodeURIComponent(v) : null;
}

function readFromSession(): string | null {
  try { 
    return sessionStorage.getItem(KEY); 
  } catch { 
    return null; 
  }
}

function writeToSession(v: string) {
  try { 
    sessionStorage.setItem(KEY, v); 
  } catch {}
}

// ✅ Захват на старте (выполняется при импорте модуля, ДО React render)
const fromUrl = readFromSearch() || readFromHash();
if (fromUrl) {
  writeToSession(fromUrl);
  if (import.meta.env.DEV) {
    console.log('[launchParams] Захвачен tgWebAppData из URL:', {
      fromSearch: !!readFromSearch(),
      fromHash: !!readFromHash(),
      length: fromUrl.length
    });
  }
}

/**
 * Получить initData из всех возможных источников:
 * 1. Telegram.WebApp.initData (приоритет)
 * 2. sessionStorage (сохраненный из URL)
 * 3. URL (search или hash) - повторная попытка
 */
export function getInitData(): string | null {
  // 1. Приоритет: Telegram.WebApp.initData (если доступен)
  const tg = (window as any).Telegram?.WebApp;
  const w = typeof tg?.initData === "string" && tg.initData.trim() !== "" ? tg.initData : "";
  if (w) return w;

  // 2. Из sessionStorage (сохраненный при старте)
  const s = readFromSession();
  if (s) return s;

  // 3. Повторная попытка из URL (на случай если роутер удалил параметры)
  const again = readFromSearch() || readFromHash();
  if (again) { 
    writeToSession(again); 
    return again; 
  }

  return null;
}

/**
 * Smoke test: проверить где находятся параметры tgWebAppData
 * Вызывается в диагностике для определения источника параметров
 */
export function smokeTestInitDataLocation(): {
  href: string;
  search: string;
  hash: string;
  hasInSearch: boolean;
  hasInHash: boolean;
  webappInitDataLen: number;
  sessionStorageLen: number | null;
} {
  const tg = (window as any).Telegram?.WebApp;
  const webappInitData = typeof tg?.initData === "string" ? tg.initData : "";
  
  return {
    href: window.location.href,
    search: window.location.search,
    hash: window.location.hash,
    hasInSearch: /tgWebAppData=/.test(window.location.search),
    hasInHash: /tgWebAppData=/.test(window.location.hash),
    webappInitDataLen: webappInitData.length,
    sessionStorageLen: readFromSession()?.length ?? null
  };
}
