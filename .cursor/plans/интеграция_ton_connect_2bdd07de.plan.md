---
name: Интеграция TON Connect
overview: "Добавление минимальной и надёжной интеграции TON Connect в Telegram MiniApp Stixly: установка библиотеки, создание manifest, обёртка провайдера, кнопка подключения в профиле и доступ к адресу кошелька."
todos:
  - id: install-package
    content: Установить @tonconnect/ui-react в package.json
    status: pending
  - id: create-manifest
    content: Создать tonconnect-manifest.json в miniapp/public/ с метаданными dApp
    status: pending
  - id: wrap-provider
    content: Обернуть приложение в TonConnectUIProvider в App.tsx
    status: pending
  - id: add-button
    content: Добавить TonConnectButton в MyProfilePage
    status: pending
  - id: add-wallet-access
    content: Добавить хуки useTonAddress/useTonWallet для доступа к адресу кошелька в MyProfilePage
    status: pending
---

# План интеграции TON Connect в Stixly MiniApp

## Анализ проекта

**Стек**: Vite + React (не Next.js)

**Entry point**: `miniapp/src/main.tsx` → монтирует `<App />`

**Главный компонент**: `miniapp/src/App.tsx` → использует Router и MainLayout

**Base path**: `/miniapp/` (из `vite.config.ts`)

**Public директория**: `miniapp/public/`

**TON Connect**: отсутствует в проекте

## Задачи

### 1. Установка библиотеки

**Файл**: `package.json`

- Добавить `@tonconnect/ui-react` в `dependencies` (версия `^2.0.0` или последняя стабильная)
- Это официальная React-обёртка для TON Connect UI

### 2. Создание manifest файла

**Файл**: `miniapp/public/tonconnect-manifest.json`

- Создать JSON-файл с метаданными dApp
- Включить поля: `url`, `name`, `iconUrl`, `termsOfUseUrl`, `privacyPolicyUrl`
- **Важно**: JSON файл статический, поэтому в поле `url` нужно указать конкретный продакшен URL: `https://sticker-art-e13nst.amvera.io/miniapp`
- Пример структуры:
```json
{
  "url": "https://sticker-art-e13nst.amvera.io/miniapp",
  "name": "Stixly",
  "iconUrl": "https://sticker-art-e13nst.amvera.io/miniapp/stixly-icon.png",
  "termsOfUseUrl": "https://sticker-art-e13nst.amvera.io/miniapp/terms-of-use.txt",
  "privacyPolicyUrl": "https://sticker-art-e13nst.amvera.io/miniapp/privacy-policy.txt"
}
```

- Файл будет доступен по пути: `https://sticker-art-e13nst.amvera.io/miniapp/tonconnect-manifest.json`
- Убедиться, что файл попадает в билд (находится в `miniapp/public/`)

### 3. Обёртка провайдера TON Connect

**Файл**: `miniapp/src/App.tsx`

- Импортировать `TonConnectUIProvider` из `@tonconnect/ui-react`
- Обернуть корневой компонент `<App />` в `<TonConnectUIProvider>` (до `<Router>`)
- Использовать статический URL: `const manifestUrl = 'https://sticker-art-e13nst.amvera.io/miniapp/tonconnect-manifest.json';`
- Важно: все страницы с `TonConnectButton` или хуками `useTonAddress`/`useTonWallet` должны быть внутри провайдера

**Структура**:

```tsx
const manifestUrl = 'https://sticker-art-e13nst.amvera.io/miniapp/tonconnect-manifest.json';

export function App() {
  return (
    <TonConnectUIProvider manifestUrl={manifestUrl}>
      <Router basename="/miniapp">
        <MainLayout>
          {/* существующие routes */}
        </MainLayout>
      </Router>
    </TonConnectUIProvider>
  );
}
```

### 4. Кнопка подключения в профиле

**Файл**: `miniapp/src/pages/MyProfilePage.tsx`

- Импортировать `TonConnectButton` из `@tonconnect/ui-react`
- Добавить кнопку в логичное место на странице профиля
- Убедиться, что кнопка видна и доступна

### 5. Доступ к адресу кошелька

**Файл**: `miniapp/src/pages/MyProfilePage.tsx`

- Импортировать хук `useTonAddress` из `@tonconnect/ui-react`
- Использовать `useTonAddress()` для получения адреса кошелька
- Добавить минимальное отображение адреса (или статуса подключения) в профиле
- Добавить `console.log` для отладки в dev режиме (только для первого шага)
- **Не усложнять**: не интегрировать в глобальный стейт/бэкенд на первом этапе (оставить TODO-комментарий)

### 6. Проверка совместимости с Telegram MiniApp

- Проверить, что модалки TON Connect UI не конфликтуют с существующими оверлеями (хедеры, модалки)
- При необходимости поднять z-index модалок TON Connect выше существующих UI элементов
- Убедиться, что TON Connect UI корректно работает внутри Telegram WebApp

### 7. Комментарии и TODO

Добавить комментарии в код с указанием:

- Места, где можно расширить функционал (сохранение адреса в профиле, отправка на бэкенд и т.п.)
- Особенностей работы в Telegram MiniApp (модалки TON Connect должны работать корректно)

## Файлы для изменения

1. `package.json` - добавление зависимости
2. `miniapp/public/tonconnect-manifest.json` - создание нового файла
3. `miniapp/src/App.tsx` - обёртка провайдера
4. `miniapp/src/pages/MyProfilePage.tsx` - кнопка подключения и доступ к адресу

## Важные замечания

- **Статический manifestUrl**: Manifest URL захардкожен как `'https://sticker-art-e13nst.amvera.io/miniapp/tonconnect-manifest.json'`, так как MiniApp живёт на стабильном домене. Это упрощает отладку и интеграцию с TON-кошельками, обеспечивая предсказуемое поведение.
- Manifest файл должен быть доступен по HTTPS в продакшене
- TON Connect UI автоматически обрабатывает модалки и взаимодействие с кошельками
- Интеграция минимальна и не требует изменений в существующей архитектуре