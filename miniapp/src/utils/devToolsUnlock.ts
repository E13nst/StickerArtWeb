/** Разблокировка нижнего меню + debug-панели до закрытия вкладки/миниаппа (sessionStorage). */
export const DEV_TOOLS_UNLOCK_STORAGE_KEY = 'stixly_dev_tools_unlocked';

export function isDevToolsUnlocked(): boolean {
  try {
    return sessionStorage.getItem(DEV_TOOLS_UNLOCK_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function persistDevToolsUnlocked(): void {
  try {
    sessionStorage.setItem(DEV_TOOLS_UNLOCK_STORAGE_KEY, '1');
  } catch {
    /* ignore */
  }
}
