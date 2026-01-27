# VERIFY_INLINE_QUERY_INITDATA

## ✅ Реализованные улучшения

**Захватчик initData (`telegram/launchParams.ts`):**
- Читает `tgWebAppData` из `search` и `hash` (включая HashRouter `#/path?tgWebAppData=...`)
- Сохраняет в `sessionStorage` ДО инициализации роутера, чтобы параметры не потерялись
- Экспортирует `getInitData()` для получения initData из всех источников (Telegram.WebApp → sessionStorage → URL)

**Interceptor обновлен (`client.ts:108-137`):**
- Добавляет заголовок `X-Telegram-Init-Data` на **КАЖДЫЙ запрос** в момент отправки
- Приоритет: 1) уже установлен в запросе, 2) из `defaults` (через `setAuthHeaders`), 3) из `getInitData()` (захватчик)
- Гарантирует работу даже если `setAuthHeaders` не был вызван или был вызван поздно (race condition)

**Диагностика улучшена (`main.tsx`):**
- Smoke test для определения источника параметров (search/hash)
- Логирование источника initData (Telegram.WebApp / search / hash / sessionStorage)
- Предупреждение, если `tgWebAppData` в hash (Desktop/Mobile специфика)

---

## 1. Окружение

**ВАЖНО:** Для полной диагностики необходимо протестировать в реальном Telegram клиенте.

- **Telegram клиент:** [УКАЖИТЕ: iOS/Android/Desktop/Web] + версия
- **Платформа WebApp:** `Telegram.WebApp.platform` + `Telegram.WebApp.version`

### Текущая конфигурация кода:
- `telegram-web-app.js` подключен в `<head>` до других скриптов: ✅ **ДА** (`index.html:59`)
- Entrypoint: `main.tsx` (диагностический код + захватчик initData добавлен)
- Захватчик initData: `telegram/launchParams.ts` (читает из search, hash, sessionStorage)
- Инициализация заголовков: `App.tsx:74` → `apiClient.setAuthHeaders(initData)`
- Interceptor: `client.ts:108-137` (добавляет заголовок на КАЖДЫЙ запрос из `defaults` или `getInitData()`)

---

## 2. Repro steps

### Сценарий A: Открытие Mini App из кнопки в сообщении (работает)
1. Откройте бота в Telegram
2. Отправьте команду или нажмите кнопку, которая открывает Mini App
3. Mini App открывается в обычном контексте (с `chat` в initData)
4. Проверьте консоль браузера на наличие `[TG_DIAG]` логов

### Сценарий B: Открытие Mini App из inline query кнопки (ломается)
1. Откройте любой чат в Telegram
2. Введите `@bot` (имя вашего бота)
3. В результатах inline query нажмите кнопку "Switch to Mini App" (или аналогичную)
4. Mini App открывается в inline query контексте (с `query_id`, но без `chat`)
5. Проверьте консоль браузера на наличие `[TG_DIAG]` логов

---

## 3. Самый ранний лог старта (до React render)

Диагностический код добавлен в `main.tsx` (до импорта App и рендера React).

**ВАЖНО:** Захватчик initData (`telegram/launchParams.ts`) выполняется при импорте модуля и сохраняет `tgWebAppData` из URL в `sessionStorage` ДО инициализации роутера, чтобы параметры не потерялись.

### Сценарий A (работает):

```javascript
[TG_DIAG] href= https://your-domain.com/miniapp/?tgWebAppData=...
[TG_DIAG] search= ?tgWebAppData=query_id=***&user={"id":12345,"first_name":"***","username":"***"}&auth_date=1234567890&hash=***
[TG_DIAG] hash= 
[TG_DIAG] has tgWebAppData in search= true
[TG_DIAG] has tgWebAppData in hash= false
[TG_DIAG] Telegram.WebApp exists= true
[TG_DIAG] Telegram.WebApp.initData.len= 234
[TG_DIAG] captured initData.len= 234
[TG_DIAG] initData source= Telegram.WebApp
[TG_DIAG] initData.head= query_id=***&user={"id":12345,"first_name":"***","username":"***"}&auth_date=1234567890&hash=***
[TG_DIAG] initDataUnsafe.keys= ["user", "auth_date", "hash", "chat", "chat_type"]
[TG_DIAG] platform= ios
[TG_DIAG] version= 7.0
```

**Примечание:** В сценарии A `initData` содержит `chat` и `chat_type` в `initDataUnsafe`, но в строке `initData` они могут быть закодированы.

### Сценарий B (ломается):

```javascript
[TG_DIAG] href= https://your-domain.com/miniapp/#/gallery?tgWebAppData=...
[TG_DIAG] search= 
[TG_DIAG] hash= #/gallery?tgWebAppData=query_id=***&user={"id":12345,"first_name":"***","username":"***"}&auth_date=1234567890&hash=***
[TG_DIAG] has tgWebAppData in search= false
[TG_DIAG] has tgWebAppData in hash= true
[TG_DIAG] Telegram.WebApp exists= true
[TG_DIAG] Telegram.WebApp.initData.len= 0
[TG_DIAG] captured initData.len= 198
[TG_DIAG] initData source= hash
[TG_DIAG] initData.head= query_id=***&user={"id":12345,"first_name":"***","username":"***"}&auth_date=1234567890&hash=***
[TG_DIAG] initDataUnsafe.keys= ["user", "auth_date", "hash", "query_id"]
[TG_DIAG] platform= ios
[TG_DIAG] version= 7.0
[TG_DIAG] ⚠️ tgWebAppData находится в hash (не в search) - это может быть причиной проблем в Desktop/Mobile
```

**Ключевые отличия в сценарии B:**
1. `initDataUnsafe.keys` НЕ содержит `chat` и `chat_type`, но содержит `query_id` — это нормально для inline query
2. **КРИТИЧНО:** `tgWebAppData` может быть в `hash` (не в `search`) — особенно в Desktop/Mobile клиентах
3. `Telegram.WebApp.initData.len= 0` — если пустая, но `captured initData.len= 198` — значит захватчик сработал из hash/sessionStorage

**ВАЖНО:** 
- Если `Telegram.WebApp.initData.len= -1` или `0`, но `captured initData.len > 0` — захватчик работает корректно
- Если `has tgWebAppData in hash= true` — это причина проблем в Desktop/Mobile (параметры в hash, а не в search)

---

## 4. Доказательство отправки заголовка

### Сценарий A (работает):

**DevTools Network → Request Headers:**
```
GET /api/auth/status HTTP/1.1
Host: your-domain.com
X-Telegram-Init-Data: query_id=***&user={"id":12345,"first_name":"***","username":"***"}&auth_date=1234567890&hash=***
X-Language: ru
Content-Type: application/json
Accept: application/json
```

**Copy as cURL (замаскировано):**
```bash
curl 'https://your-domain.com/api/auth/status' \
  -H 'X-Telegram-Init-Data: query_id=***&user={"id":12345,"first_name":"***","username":"***"}&auth_date=1234567890&hash=***' \
  -H 'X-Language: ru' \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json'
```

### Сценарий B (ломается):

**DevTools Network → Request Headers:**
```
GET /api/auth/status HTTP/1.1
Host: your-domain.com
X-Telegram-Init-Data: query_id=***&user={"id":12345,"first_name":"***","username":"***"}&auth_date=1234567890&hash=***
X-Language: ru
Content-Type: application/json
Accept: application/json
```

**Copy as cURL (замаскировано):**
```bash
curl 'https://your-domain.com/api/auth/status' \
  -H 'X-Telegram-Init-Data: query_id=***&user={"id":12345,"first_name":"***","username":"***"}&auth_date=1234567890&hash=***' \
  -H 'X-Language: ru' \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json'
```

**ВАЖНО:** Если заголовок `X-Telegram-Init-Data` отсутствует в Request Headers, значит проблема в клиенте (interceptor не сработал или `setAuthHeaders` не был вызван).

---

## 5. Трассировка на фронте: где реально добавляется заголовок

### Место добавления заголовка:

**Файл:** `miniapp/src/api/client.ts`

**Interceptor (строки 108-137):**
```typescript
this.client.interceptors.request.use(
  (config) => {
    const headers = config.headers ?? {};

    // ✅ FIX: Добавляем заголовок X-Telegram-Init-Data на КАЖДЫЙ запрос в момент отправки
    // Приоритет: 1) уже установлен в запросе, 2) из defaults, 3) из getInitData() (захватчик)
    if (!headers['X-Telegram-Init-Data']) {
      // Сначала проверяем defaults (установленные через setAuthHeaders)
      let initData = this.client.defaults.headers.common['X-Telegram-Init-Data'] as string | undefined;
      
      // Если в defaults нет, используем захватчик (читает из Telegram.WebApp, sessionStorage, URL)
      if (!initData) {
        initData = getInitData() || undefined;
      }
      
      if (initData) {
        headers['X-Telegram-Init-Data'] = initData;
        // ... логирование ...
      }
    }
    // ...
    return config;
  }
);
```

**Захватчик initData (`telegram/launchParams.ts`):**
```typescript
// Захватывает tgWebAppData из URL ДО инициализации роутера
const fromUrl = readFromSearch() || readFromHash();
if (fromUrl) writeToSession(fromUrl);

export function getInitData(): string | null {
  // 1. Приоритет: Telegram.WebApp.initData
  // 2. Из sessionStorage (сохраненный при старте)
  // 3. Повторная попытка из URL (на случай если роутер удалил параметры)
  // ...
}
```

**Установка заголовка в defaults:**
```typescript
// Файл: miniapp/src/api/client.ts:232
setAuthHeaders(initData: string, language?: string) {
  this.client.defaults.headers.common['X-Telegram-Init-Data'] = initData;
  this.setLanguage(language);
}
```

**Вызов setAuthHeaders:**
```typescript
// Файл: miniapp/src/App.tsx:74
useEffect(() => {
  if (!initData || initData.trim() === '') {
    return;
  }
  apiClient.setAuthHeaders(initData, user?.language_code);
}, [initData, user?.language_code]);
```

### Доказательство, что ВСЕ запросы идут через этот путь:

**Все API запросы используют `apiClient` (axios instance):**

1. **`/api/auth/status`** → `apiClient.checkAuthStatus()` → `client.ts:732`
2. **`/api/profiles/me`** → `apiClient.getMyProfile()` → `client.ts:912`
3. **`/api/stickersets`** → `apiClient.getStickerSets()` → `client.ts:372`
4. **`/api/stickersets/{id}`** → `apiClient.getStickerSet(id)` → `client.ts:547`
5. **`/api/likes/stickersets/{id}`** → `apiClient.likeStickerSet(id)` → `client.ts:781`
6. **`/api/categories`** → `apiClient.getCategories()` → `client.ts:333`
7. **`/api/generation/generate`** → `apiClient.generateSticker()` → `client.ts:1438`
8. **`/api/generation/status/{taskId}`** → `apiClient.getGenerationStatus()` → `client.ts:1469`
9. **`/api/wallets/my`** → `apiClient.getMyWallet()` → `client.ts:1337`
10. **`/api/transactions/prepare`** → `apiClient.prepareDonation()` → `client.ts:1372`

**Проверка прямых fetch/axios вызовов:**

✅ **НЕТ прямых fetch/axios вызовов для API запросов** — все идут через `apiClient`.

⚠️ **Исключение:** `imageLoader.ts` использует `fetch` для загрузки стикеров (blob URLs), но это НЕ API запросы и не требуют заголовка `X-Telegram-Init-Data`.

**Файлы, использующие apiClient:**
- `miniapp/src/pages/GalleryPage2.tsx`
- `miniapp/src/pages/MyProfilePage.tsx`
- `miniapp/src/pages/ProfilePage.tsx`
- `miniapp/src/pages/DashboardPage.tsx`
- `miniapp/src/pages/GeneratePage.tsx`
- `miniapp/src/components/StickerSetDetail.tsx`
- `miniapp/src/store/useProfileStore.ts`
- `miniapp/src/hooks/useLikedSets.ts`
- `miniapp/src/hooks/useDashboardStats.ts`
- ... и другие (22 файла найдено через grep)

---

## 6. Если DevTools показывает заголовок, но бэкенд его не видит

### Проверка CORS:

**Домен API и origin miniapp:**
- **API домен:** `https://your-domain.com` (или `/api` — same-origin)
- **MiniApp origin:** `https://your-domain.com/miniapp`
- **Same-origin или cross-origin?** [УКАЖИТЕ]

**CORS preflight (OPTIONS):**
- Проверьте в DevTools Network, есть ли запрос `OPTIONS /api/auth/status` перед `GET /api/auth/status`
- Если есть, проверьте Response Headers:
  ```
  Access-Control-Allow-Headers: X-Telegram-Init-Data, X-Language, Content-Type, Accept
  Access-Control-Allow-Origin: https://your-domain.com
  Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
  ```

**Если `X-Telegram-Init-Data` отсутствует в `Access-Control-Allow-Headers`, бэкенд не получит заголовок.**

### Проверка reverse proxy:

**Есть ли reverse proxy (nginx/traefik/cloudflare)?**

Если есть, проверьте конфигурацию:

**nginx.conf:**
```nginx
# Проверьте, что proxy_pass передает все заголовки:
proxy_pass_request_headers on;
proxy_set_header X-Telegram-Init-Data $http_x_telegram_init_data;
```

**Важно:** Некоторые прокси режут заголовки, начинающиеся с `X-`. Убедитесь, что прокси не фильтрует `X-Telegram-Init-Data`.

### Лог сервера (где видно "нет заголовка"):

**Пример лога бэкенда (Spring Boot / Node.js):**
```
[ERROR] 2026-01-27 10:30:45 - Missing X-Telegram-Init-Data header in request
[ERROR] 2026-01-27 10:30:45 - Request headers: { "content-type": "application/json", "accept": "application/json" }
```

**Или:**
```
[WARN] 2026-01-27 10:30:45 - Authorization failed: X-Telegram-Init-Data header is empty
```

**Приложите 1-2 строки лога сервера, где видно, что заголовок отсутствует.**

---

## 7. Вывод

**Выберите одно из трех заключений:**

### 1) initData реально пустая в inline-контексте

**Признаки:**
- `[TG_DIAG] initData.len= -1` или `0`
- `Telegram.WebApp.initData` пустая строка
- `initDataUnsafe` может быть заполнен, но `initData` (строка) пустая

**Возможные причины:**
- Telegram WebApp не инициализирован до рендера React
- `telegram-web-app.js` не подключен в `<head>` до других скриптов
- `tgWebAppData` потерялся при роутинге (SPA роутер удалил query параметры)
- Telegram клиент не передает initData в inline query контексте (баг Telegram)
- **В Desktop/Mobile `tgWebAppData` может быть в `hash`, а не в `search`** — проверьте `has tgWebAppData in hash`

**Решение:**
- ✅ **УЖЕ РЕАЛИЗОВАНО:** Захватчик `launchParams.ts` читает из search, hash и сохраняет в sessionStorage
- Проверить порядок подключения скриптов в `index.html`
- Проверить, что роутер не удаляет query параметры
- Если `has tgWebAppData in hash= true` — это нормально, захватчик должен сработать

### 2) initData есть, но заголовок не добавляется

**Признаки:**
- `[TG_DIAG] initData.len= 198` (не пустая)
- `Telegram.WebApp.initData` содержит данные
- В DevTools Network Request Headers **НЕТ** `X-Telegram-Init-Data`

**Возможные причины:**
- `setAuthHeaders` не вызывается (проверить `App.tsx:74`)
- `useEffect` в `App.tsx` не срабатывает (зависимости не меняются)
- Interceptor не срабатывает (проверить `client.ts:108`)
- Запросы идут до установки заголовка (race condition)

**Решение:**
- ✅ **УЖЕ РЕАЛИЗОВАНО:** Interceptor использует `getInitData()` на каждый запрос, даже если `setAuthHeaders` не был вызван
- Добавить логирование в `setAuthHeaders` и interceptor
- Проверить порядок инициализации: `useTelegram` → `App.tsx` → `apiClient.setAuthHeaders`
- Убедиться, что нет ранних запросов до установки заголовка (теперь не критично, т.к. interceptor использует `getInitData()`)

### 3) Заголовок добавляется и виден в DevTools, но не доходит до сервера

**Признаки:**
- `[TG_DIAG] initData.len= 198` (не пустая)
- В DevTools Network Request Headers **ЕСТЬ** `X-Telegram-Init-Data`
- Бэкенд логирует "заголовок отсутствует"

**Возможные причины:**
- CORS: `X-Telegram-Init-Data` не в `Access-Control-Allow-Headers`
- Reverse proxy (nginx/traefik/cloudflare) режет заголовки `X-*`
- Бэкенд читает заголовок с неправильным именем (case-sensitive: `X-Telegram-Init-Data` vs `x-telegram-init-data`)

**Решение:**
- Проверить CORS конфигурацию на бэкенде
- Проверить конфигурацию reverse proxy
- Проверить, как бэкенд читает заголовок (case-sensitive)

---

## Дополнительная диагностика

### Код диагностики добавлен в `main.tsx`:

```typescript
// ✅ FIX: Импортируем захватчик initData ДО всего остального
import { getInitData, smokeTestInitDataLocation } from './telegram/launchParams';

// ✅ TEMP DIAG: Диагностика initData ДО React render
(() => {
  const tg = (window as any).Telegram?.WebApp;
  const smokeTest = smokeTestInitDataLocation();
  const capturedInitData = getInitData();
  const initLen = typeof tg?.initData === 'string' ? tg.initData.length : -1;
  const capturedLen = capturedInitData ? capturedInitData.length : 0;

  console.log('[TG_DIAG] href=', smokeTest.href);
  console.log('[TG_DIAG] search=', smokeTest.search);
  console.log('[TG_DIAG] hash=', smokeTest.hash);
  console.log('[TG_DIAG] has tgWebAppData in search=', smokeTest.hasInSearch);
  console.log('[TG_DIAG] has tgWebAppData in hash=', smokeTest.hasInHash);
  console.log('[TG_DIAG] Telegram.WebApp exists=', !!tg);
  console.log('[TG_DIAG] Telegram.WebApp.initData.len=', initLen);
  console.log('[TG_DIAG] captured initData.len=', capturedLen);
  console.log('[TG_DIAG] initData source=', source); // Telegram.WebApp / search / hash / sessionStorage
  
  // ⚠️ КРИТИЧНО: Если в Desktop/Mobile tgWebAppData в hash - причина найдена
  if (smokeTest.hasInHash && !smokeTest.hasInSearch) {
    console.warn('[TG_DIAG] ⚠️ tgWebAppData находится в hash (не в search) - это может быть причиной проблем в Desktop/Mobile');
  }
  // ...
})();
```

### Захватчик initData (`telegram/launchParams.ts`):

```typescript
// Захватывает tgWebAppData из URL ДО инициализации роутера
const fromUrl = readFromSearch() || readFromHash();
if (fromUrl) writeToSession(fromUrl);

export function getInitData(): string | null {
  // 1. Приоритет: Telegram.WebApp.initData
  // 2. Из sessionStorage (сохраненный при старте)
  // 3. Повторная попытка из URL (на случай если роутер удалил параметры)
}
```

### Быстрый "smoke test" прямо в Desktop/Mobile:

Откройте Mini App из inline-кнопки и сразу посмотрите (встроенным логом) где параметры:

```javascript
console.log("href", location.href);
console.log("search", location.search);
console.log("hash", location.hash);
console.log("has tgWebAppData", /tgWebAppData=/.test(location.search) || /tgWebAppData=/.test(location.hash));
console.log("webapp initData len", (window as any).Telegram?.WebApp?.initData?.length);
```

**Если в Desktop/Mobile `tgWebAppData` в hash — причина найдена.** Захватчик должен это обработать.

### Следующие шаги:

1. **Запустить приложение в реальном Telegram клиенте**
2. **Протестировать оба сценария (A и B)**
3. **Выполнить smoke test (см. выше)**
4. **Скопировать вывод `[TG_DIAG]` логов из консоли**
5. **Скопировать Request Headers из DevTools Network**
6. **Скопировать cURL команду из DevTools**
7. **Проверить логи бэкенда**
8. **Заполнить разделы 1, 3, 4, 6 с реальными данными**
9. **Выбрать заключение в разделе 7**

---

## Примечания

- **initDataUnsafe не является доказательством** — валидируем только `Telegram.WebApp.initData` (сырой string)
- **Inline Mode Mini Apps не имеют chat** — это нормально, нельзя требовать `chat` в initData
- **telegram-web-app.js обязан быть подключен в `<head>`** — проверено: ✅ (`index.html:59`)
- **init data в launch params находится в tgWebAppData** — проверяется через `location.search` и `location.hash`
