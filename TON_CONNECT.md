# Ton Connect

## Установка

```json
"@tonconnect/ui-react": "^2.0.0"
```

## Настройка

### 1. Манифест

Файл: `miniapp/public/tonconnect-manifest.json`

```json
{
  "url": "https://sticker-art-e13nst.amvera.io/miniapp",
  "name": "Stixly",
  "iconUrl": "https://sticker-art-e13nst.amvera.io/miniapp/stixly-icon.png",
  "termsOfUseUrl": "...",
  "privacyPolicyUrl": "..."
}
```

### 2. Провайдер

В `App.tsx` оборачиваем приложение:

```tsx
import { TonConnectUIProvider } from '@tonconnect/ui-react';

const manifestUrl = 'https://sticker-art-e13nst.amvera.io/miniapp/tonconnect-manifest.json';

<TonConnectUIProvider manifestUrl={manifestUrl}>
  {/* приложение */}
</TonConnectUIProvider>
```

## Использование

### Кнопка подключения

```tsx
import { TonConnectButton } from '@tonconnect/ui-react';

<TonConnectButton />
```

### Получение адреса кошелька

```tsx
import { useTonAddress } from '@tonconnect/ui-react';

const tonAddress = useTonAddress();

// tonAddress: string | null
```

## Текущая реализация

- Кнопка подключения в `MyProfilePage`
- Отображение адреса кошелька (первые 6 и последние 4 символа)
- TODO: Сохранение адреса в профиле и отправка на бэкенд

