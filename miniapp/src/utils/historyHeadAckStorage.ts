/** Единоразовое подтверждение «увидел результат головы истории» в sessionStorage (на сессию). */

export type HistoryHeadAck = {
  localId: string;
  updatedAt: number;
};

const key = (userScopeId: string) => `stixly:history-head-ack:${userScopeId}`;

export const readHistoryHeadAck = (userScopeId: string | null): HistoryHeadAck | null => {
  if (!userScopeId || typeof window === 'undefined' || !window.sessionStorage) return null;
  try {
    const raw = window.sessionStorage.getItem(key(userScopeId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const o = parsed as Record<string, unknown>;
    if (typeof o.localId !== 'string' || typeof o.updatedAt !== 'number') return null;
    return { localId: o.localId, updatedAt: o.updatedAt };
  } catch {
    return null;
  }
};

export const writeHistoryHeadAck = (userScopeId: string | null, ack: HistoryHeadAck): void => {
  if (!userScopeId || typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    window.sessionStorage.setItem(key(userScopeId), JSON.stringify(ack));
  } catch {
    // ignore quota
  }
};
