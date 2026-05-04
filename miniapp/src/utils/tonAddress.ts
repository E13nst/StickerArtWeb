import { Address } from '@ton/core';

/** Одинаковый ли ключ кошелька при разных строковых форматах (EQ/UQ/url-safe и т.д.). */
export function tonWalletPubkeyEquals(a: string, b: string): boolean {
  try {
    return Address.parse(a.trim()).equals(Address.parse(b.trim()));
  } catch {
    return false;
  }
}

/**
 * Адрес для `senderAddress` в Ton Pay:
 * если на бэке уже есть привязка и ключ совпадает с активной сессией TonConnect —
 * отправляем **ту же строку**, что вернул профиль (`/wallets/my`), чтобы не получить 409
 * из‑за строго сравнения `EQ…` ↔ `UQ…`.
 */
export function tonSenderFriendlyForPayments(
  tonConnectFriendly: string,
  backendLinkedFriendly?: string | null
): string {
  const trimmed = tonConnectFriendly.trim();
  const parsedTc = Address.parse(trimmed);

  const linked = backendLinkedFriendly?.trim();
  if (linked) {
    try {
      if (Address.parse(linked).equals(parsedTc)) {
        return linked;
      }
    } catch {
      /* linked невалиден — отправляем только из TonConnect */
    }
  }

  return parsedTc.toString({ bounceable: false, urlSafe: true });
}

/** Нормализованное user-friendly после привязки (единообразно для новых связок на бэке). */
export function tonCanonicalFriendlyForLink(walletFriendly: string): string {
  const a = Address.parse(walletFriendly.trim());
  return a.toString({ bounceable: false, urlSafe: true });
}
