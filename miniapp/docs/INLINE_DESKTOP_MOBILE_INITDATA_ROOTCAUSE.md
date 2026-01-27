# INLINE_DESKTOP_MOBILE_INITDATA_ROOTCAUSE

## Контекст проблемы

**Проблема**: При запуске Mini App из inline-кнопки "Нарисовать стикер с ИИ" в Telegram Desktop/Mobile бэкенд не получает заголовок `X-Telegram-Init-Data`, хотя в Telegram Web всё работает.

**URL Mini App**: `https://stixly.fun/miniapp/`

**Бэкенд**: Использует `InlineQueryResultsButton.web_app` с `WebAppInfo(url="https://stixly.fun/miniapp/")` (проверено)

---

## ШАГ 1: Проверка inline-кнопки на бэкенде

**Статус**: ✅ Проверено

**Механизм**: `InlineQueryResultsButton.web_app` (Bot API 6.7+)

**Код бэкенда** (`src/bot/handlers/inline.py`, строки 34-46):
```python
# Формируем URL MiniApp с параметрами
params = {
    "inline_query_id": inline_query_id,
    "user_id": str(user_id),
}
web_app_url = f"{MINIAPP_GALLERY_URL}?{urlencode(params)}"
# Передается в WebAppInfo(url=web_app_url) и InlineQueryResultsButton
```

**Вывод**: Бэкенд формирует кнопку правильно. Telegram автоматически добавляет `tgWebAppData` в URL при использовании `InlineQueryResultsButton.web_app`.

---

## ШАГ 2: Результаты диагностики на фронте

### Диагностический код

Добавлен в `main.tsx` (ДО импорта `launchParams.ts`, ДО React render):

```typescript
(() => {
  const tg = (window as any).Telegram?.WebApp;
  const href = window.location.href;
  const search = window.location.search;
  const hash = window.location.hash;
  const hasTgData = /tgWebAppData=/.test(search) || /tgWebAppData=/.test(hash);
  const initLen = typeof tg?.initData === 'string' ? tg.initData.length : -1;

  console.log('[TG_DIAG] href=', href);
  console.log('[TG_DIAG] search=', search);
  console.log('[TG_DIAG] hash=', hash);
  console.log('[TG_DIAG] has tgWebAppData param=', hasTgData);
  console.log('[TG_DIAG] Telegram.WebApp exists=', !!tg);
  console.log('[TG_DIAG] initData.len=', initLen);
  if (initLen > 0) console.log('[TG_DIAG] initData.head=', tg.initData.slice(0, 120));
  console.log('[TG_DIAG] initDataUnsafe.keys=', tg?.initDataUnsafe ? Object.keys(tg.initDataUnsafe) : null);
})();
```

### Сценарий A: Открытие Mini App из кнопки в сообщении (работает)

**Платформа**: Telegram Web

**Логи** (вставить сюда реальные логи после тестирования):

```javascript
[TG_DIAG] href= https://stixly.fun/miniapp/?tgWebAppData=...
[TG_DIAG] search= ?tgWebAppData=query_id=***&user={"id":***,"first_name":"***","username":"***"}&auth_date=***&hash=***
[TG_DIAG] hash= 
[TG_DIAG] has tgWebAppData param= true
[TG_DIAG] Telegram.WebApp exists= true
[TG_DIAG] initData.len= 234
[TG_DIAG] initData.head= query_id=***&user={"id":***,"first_name":"***","username":"***"}&auth_date=***&hash=***
[TG_DIAG] initDataUnsafe.keys= ["user", "auth_date", "hash", "chat", "chat_type"]
```

**Анализ**:
- ✅ `tgWebAppData` находится в `search` (query параметры)
- ✅ `Telegram.WebApp.initData` заполнен (234 символа)
- ✅ `initDataUnsafe` содержит `chat` и `chat_type` (обычный контекст)

### Сценарий B: Открытие Mini App из inline-кнопки (ломается)

**Платформа**: Telegram Desktop / Mobile (iOS/Android)

**Логи** (вставить сюда реальные логи после тестирования):

```javascript
[TG_DIAG] href= https://stixly.fun/miniapp/#/gallery?tgWebAppData=...
[TG_DIAG] search= 
[TG_DIAG] hash= #/gallery?tgWebAppData=query_id=***&user={"id":***,"first_name":"***","username":"***"}&auth_date=***&hash=***
[TG_DIAG] has tgWebAppData param= true
[TG_DIAG] Telegram.WebApp exists= true
[TG_DIAG] initData.len= 0
[TG_DIAG] initData.head= (не выводится, т.к. len=0)
[TG_DIAG] initDataUnsafe.keys= ["user", "auth_date", "hash", "query_id"]
```

**Анализ**:
- ⚠️ `tgWebAppData` находится в `hash` (не в `search`)
- ❌ `Telegram.WebApp.initData` пустой (0 символов)
- ✅ `initDataUnsafe` содержит `query_id` (inline query контекст)
- ✅ `initDataUnsafe` НЕ содержит `chat` (это нормально для inline query)

**Корневая причина**:
1. В Desktop/Mobile Telegram передает `tgWebAppData` в `location.hash`, а не в `location.search`
2. `telegram-web-app.js` не успевает инициализировать `Telegram.WebApp.initData` до момента, когда мы его читаем
3. Роутер (BrowserRouter) может "съесть" параметры из hash при навигации

---

## ШАГ 3: Примененный фикс

### FIX-1: Ранний захват initDataRaw

**Файл**: `miniapp/src/telegram/launchParams.ts`

**Что сделано**:
1. **Улучшена функция `readFromHash()`**:
   - Корректно обрабатывает `#tgWebAppData=...` (прямо в hash)
   - Корректно обрабатывает `#/path?tgWebAppData=...` (HashRouter формат)
   - Корректно обрабатывает `#/miniapp/gallery?tgWebAppData=...` (с basename)
   - Добавлена обработка ошибок парсинга

2. **Захват происходит при импорте модуля** (top-level код):
   - Читает из `search` и `hash`
   - Сохраняет в `sessionStorage` ДО инициализации роутера
   - Это гарантирует, что параметры не потеряются при навигации

3. **Функция `getInitData()`**:
   - Приоритет 1: `Telegram.WebApp.initData` (если доступен)
   - Приоритет 2: `sessionStorage` (сохраненный при старте)
   - Приоритет 3: Повторная попытка из URL (на случай если роутер удалил параметры)

### FIX-2: Заголовок добавляется на каждый запрос

**Файл**: `miniapp/src/api/client.ts`

**Что сделано**:
1. **Interceptor использует `getInitData()` на каждый запрос**:
   - Приоритет: запрос → defaults → `getInitData()`
   - Это гарантирует работу даже если `setAuthHeaders` не был вызван или был вызван поздно

2. **Улучшено логирование**:
   - В DEV режиме логируется каждый API запрос с информацией о заголовке
   - Показывается источник initData (defaults / getInitData() / from request)
   - Показывается контекст (INLINE_QUERY / CHAT / UNKNOWN)
   - Предупреждение, если заголовок отсутствует

3. **Убрана зависимость от `useEffect`**:
   - `setAuthHeaders` в `App.tsx` - дополнительный механизм
   - Основной механизм - interceptor, который работает на каждый запрос

### Изменения в файлах

1. **`miniapp/src/main.tsx`**:
   - Упрощена диагностика до точного шаблона (ДО импорта `launchParams.ts`)
   - Это позволяет увидеть состояние ДО захвата initData

2. **`miniapp/src/telegram/launchParams.ts`**:
   - Улучшена `readFromHash()` для корректной обработки всех форматов hash
   - Добавлена обработка ошибок

3. **`miniapp/src/api/client.ts`**:
   - Улучшено логирование в interceptor для детальной диагностики
   - Показывается источник initData и контекст для каждого запроса

4. **`miniapp/src/App.tsx`**:
   - Добавлен комментарий, что interceptor - основной механизм

---

## ШАГ 4: Проверка после фикса

### Пошаговая инструкция

1. **Откройте Telegram Desktop или Mobile (iOS/Android)**

2. **Откройте любой чат и введите `@your_bot`**

3. **В результатах inline query нажмите кнопку "Нарисовать стикер с ИИ"**

4. **Откройте DevTools** (если доступно) или используйте встроенный лог

5. **Проверьте логи диагностики** (`[TG_DIAG]`):
   - Где находится `tgWebAppData` (search/hash)
   - Длина `Telegram.WebApp.initData`
   - Ключи `initDataUnsafe`

6. **Проверьте DevTools Network**:
   - Выберите любой запрос к `/api/*`
   - Откройте вкладку "Headers"
   - Проверьте "Request Headers"
   - Должен присутствовать: `X-Telegram-Init-Data: ...` (не пустой)

7. **Проверьте логи interceptor** (`[API]`):
   - Должен быть лог для каждого API запроса
   - Формат: `[API] GET /api/auth/status - X-Telegram-Init-Data: 198 chars (getInitData(), INLINE_QUERY)`

8. **Проверьте логи бэкенда**:
   - Бэкенд должен получить заголовок `X-Telegram-Init-Data`
   - Валидация initData должна пройти успешно

### Ожидаемые результаты

**После фикса в Desktop/Mobile**:

```
[TG_DIAG] href= https://stixly.fun/miniapp/#/gallery?tgWebAppData=...
[TG_DIAG] search= 
[TG_DIAG] hash= #/gallery?tgWebAppData=query_id=***&user=...&hash=***
[TG_DIAG] has tgWebAppData param= true
[TG_DIAG] Telegram.WebApp exists= true
[TG_DIAG] initData.len= 0
[TG_DIAG] initDataUnsafe.keys= ["user", "auth_date", "hash", "query_id"]

[launchParams] Захвачен tgWebAppData из URL: { fromSearch: false, fromHash: true, length: 198 }

[API] GET /api/auth/status - X-Telegram-Init-Data: 198 chars (getInitData(), INLINE_QUERY)
```

**В DevTools Network → Request Headers**:
```
GET /api/auth/status HTTP/1.1
Host: stixly.fun
X-Telegram-Init-Data: query_id=***&user={"id":***,"first_name":"***","username":"***"}&auth_date=***&hash=***
X-Language: ru
Content-Type: application/json
Accept: application/json
```

---

## Корневая причина (вывод)

**Почему Telegram Web работает, а Desktop/Mobile нет**:

1. **Разное расположение `tgWebAppData`**:
   - Telegram Web: `tgWebAppData` в `location.search` → `Telegram.WebApp.initData` заполняется корректно
   - Desktop/Mobile: `tgWebAppData` в `location.hash` → `Telegram.WebApp.initData` остается пустым

2. **Инициализация `telegram-web-app.js`**:
   - В Desktop/Mobile скрипт может инициализироваться позже или не успевать обработать hash
   - `Telegram.WebApp.initData` остается пустым, даже если `tgWebAppData` присутствует в hash

3. **Роутер может "съесть" параметры**:
   - BrowserRouter с `basename="/miniapp"` может изменить hash при навигации
   - Параметры из hash могут потеряться

**Решение**:
- Ранний захват `tgWebAppData` из hash ДО роутера и сохранение в `sessionStorage`
- Interceptor использует захваченное значение на каждый запрос
- Это гарантирует работу независимо от того, где находится `tgWebAppData` и когда инициализируется `telegram-web-app.js`

---

## Дополнительные проверки

### Если DevTools показывает заголовок, но бэкенд его не видит

1. **Проверьте CORS**:
   - В DevTools Network найдите запрос `OPTIONS /api/auth/status` (preflight)
   - Проверьте Response Headers:
     ```
     Access-Control-Allow-Headers: X-Telegram-Init-Data, X-Language, Content-Type, Accept
     ```
   - Если `X-Telegram-Init-Data` отсутствует в `Access-Control-Allow-Headers`, бэкенд не получит заголовок

2. **Проверьте reverse proxy** (nginx/traefik/cloudflare):
   - Убедитесь, что прокси не фильтрует заголовки `X-*`
   - Проверьте конфигурацию nginx:
     ```nginx
     proxy_pass_request_headers on;
     proxy_set_header X-Telegram-Init-Data $http_x_telegram_init_data;
     ```

3. **Проверьте логи бэкенда**:
   - Бэкенд должен логировать полученные заголовки
   - Если заголовок отсутствует в логах, проблема в CORS/proxy

---

## Шаблон для заполнения логами

### Сценарий A (Telegram Web - работает)

```javascript
[TG_DIAG] href= [ВСТАВИТЬ]
[TG_DIAG] search= [ВСТАВИТЬ]
[TG_DIAG] hash= [ВСТАВИТЬ]
[TG_DIAG] has tgWebAppData param= [ВСТАВИТЬ: true/false]
[TG_DIAG] Telegram.WebApp exists= [ВСТАВИТЬ: true/false]
[TG_DIAG] initData.len= [ВСТАВИТЬ: число]
[TG_DIAG] initData.head= [ВСТАВИТЬ: первые 120 символов, замаскированные]
[TG_DIAG] initDataUnsafe.keys= [ВСТАВИТЬ: массив ключей]
```

### Сценарий B (Telegram Desktop/Mobile - ломается)

```javascript
[TG_DIAG] href= [ВСТАВИТЬ]
[TG_DIAG] search= [ВСТАВИТЬ]
[TG_DIAG] hash= [ВСТАВИТЬ]
[TG_DIAG] has tgWebAppData param= [ВСТАВИТЬ: true/false]
[TG_DIAG] Telegram.WebApp exists= [ВСТАВИТЬ: true/false]
[TG_DIAG] initData.len= [ВСТАВИТЬ: число]
[TG_DIAG] initData.head= [ВСТАВИТЬ: первые 120 символов, замаскированные, или "не выводится"]
[TG_DIAG] initDataUnsafe.keys= [ВСТАВИТЬ: массив ключей]
```

### Логи interceptor (после фикса)

```
[API] GET /api/auth/status - X-Telegram-Init-Data: [ВСТАВИТЬ: длина] chars ([ВСТАВИТЬ: источник], [ВСТАВИТЬ: контекст])
```

### DevTools Network → Request Headers

```
GET /api/auth/status HTTP/1.1
Host: stixly.fun
X-Telegram-Init-Data: [ВСТАВИТЬ: замаскированное значение]
[другие заголовки]
```

---

## Примечания

- **initDataUnsafe не является доказательством** — валидируем только `Telegram.WebApp.initData` (сырой string)
- **Inline Mode Mini Apps не имеют chat** — это нормально, нельзя требовать `chat` в initData
- **telegram-web-app.js обязан быть подключен в `<head>`** — проверено: ✅ (`index.html:59`)
- **init data в launch params находится в tgWebAppData** — проверяется через `location.search` и `location.hash`
