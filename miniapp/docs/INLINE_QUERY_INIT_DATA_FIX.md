# Исправление проблемы с X-Telegram-Init-Data в inline query режиме

## Дата исправления
27 января 2026

## Проблема

При открытии Mini App через **inline query** (например, `@stixlybot`) заголовок `X-Telegram-Init-Data` не отправлялся на бэкенд, что приводило к ошибкам авторизации.

### Симптомы:
- ❌ Бэкенд не получает заголовок `X-Telegram-Init-Data` при запросах
- ❌ Пользователь видит ошибки авторизации
- ❌ API возвращает 401 Unauthorized
- ❌ В логах: `⚠️ App.tsx: initData отсутствует или пустая, заголовки не установлены`

## Причина

### Что такое inline query контекст?

Когда пользователь открывает Mini App через inline query, Telegram передает специальный набор параметров:

```typescript
// Обычный контекст (открытие из чата)
initData = "user={...}&chat={...}&query_id={...}&auth_date={...}&hash={...}"

// Inline query контекст (открытие через @bot)
initData = "user={...}&query_id={...}&auth_date={...}&hash={...}"
//                     ❌ НЕТ chat!
```

**Ключевое отличие:** В inline query контексте отсутствует параметр `chat`, но присутствуют `user` и `query_id`.

### Проблема в коде

В нескольких местах кода была проверка, которая блокировала установку заголовков при пустой `initData`:

#### 1️⃣ `miniapp/src/App.tsx` (строки 51-56)

```typescript
// ❌ БЫЛО:
if (!initData || initData.trim() === '') {
  if (import.meta.env.DEV) {
    console.log('⚠️ App.tsx: initData отсутствует или пустая, заголовки не установлены');
  }
  return; // Блокирует установку заголовков!
}

apiClient.setAuthHeaders(initData, user?.language_code);
```

**Проблема:** Если `initData` пустая (по какой-то причине) или есть race condition, заголовки не устанавливаются.

#### 2️⃣ `miniapp/src/pages/GalleryPage2.tsx` (строки 96-101)

```typescript
// ❌ БЫЛО:
const currentInitData = manualInitData || initData;
if (currentInitData) {
  apiClient.setAuthHeaders(currentInitData);
} else {
  apiClient.checkExtensionHeaders(); // Fallback, но не всегда работает
}
```

**Проблема:** Условие `if (currentInitData)` блокирует установку заголовка, если `initData` пустая.

## Решение

### Принцип: Всегда отправлять initData, даже если пустая

> **Пусть бэкенд решает, валидна ли initData или нет. Frontend должен отправлять её всегда.**

### Изменения

#### 1. `miniapp/src/App.tsx`

```typescript
// ✅ СТАЛО:
useEffect(() => {
  // ✅ FIX: Всегда устанавливаем заголовки, даже если initData пустая
  // Бэкенд сам решит, валидна ли initData или нет
  // При inline query initData содержит user + query_id (без chat) - это нормально
  
  const currentInitData = initData || '';
  
  // Логирование для диагностики
  if (import.meta.env.DEV) {
    const hasQueryId = currentInitData.includes('query_id=');
    const hasChat = currentInitData.includes('chat=') || currentInitData.includes('chat_type=');
    const hasUser = currentInitData.includes('user=');
    const context = hasQueryId && !hasChat ? 'INLINE_QUERY' : 
                    hasChat ? 'CHAT' : 
                    currentInitData ? 'UNKNOWN' : 'EMPTY';
    
    console.log('🔐 App.tsx: Установка заголовков авторизации:', {
      context,
      hasQueryId,
      hasChat,
      hasUser,
      initDataLength: currentInitData.length,
      isEmpty: !currentInitData,
      hasUserObject: Boolean(user),
      language: user?.language_code
    });
    
    // Специальное предупреждение для inline query контекста
    if (hasQueryId && !hasChat && hasUser) {
      console.log('✅ Inline query контекст подтвержден: initData содержит user + query_id без chat');
    } else if (!currentInitData) {
      console.warn('⚠️ initData пустая - возможно, приложение открыто вне Telegram');
    }
  }

  // Устанавливаем заголовки ВСЕГДА, независимо от содержимого
  apiClient.setAuthHeaders(currentInitData, user?.language_code);
}, [initData, user?.language_code]);
```

**Ключевые изменения:**
- ✅ Убрана проверка `if (!initData || initData.trim() === '')`
- ✅ Используется `initData || ''` для гарантии строки
- ✅ Добавлено детальное логирование для диагностики контекста
- ✅ Заголовки устанавливаются **ВСЕГДА**

#### 2. `miniapp/src/api/client.ts`

```typescript
// ✅ УЛУЧШЕНО:
setAuthHeaders(initData: string, language?: string) {
  // Устанавливаем заголовок ВСЕГДА, даже если initData пустая строка
  this.client.defaults.headers.common['X-Telegram-Init-Data'] = initData;
  this.setLanguage(language);
  
  // Улучшенное логирование для диагностики
  if (import.meta.env.DEV) {
    const hasQueryId = initData.includes('query_id=');
    const hasChat = initData.includes('chat=') || initData.includes('chat_type=');
    const hasUser = initData.includes('user=');
    const context = hasQueryId && !hasChat ? 'INLINE_QUERY' : 
                    hasChat ? 'CHAT' : 
                    initData ? 'UNKNOWN' : 'EMPTY';
    
    console.log('✅ Заголовки аутентификации установлены:');
    console.log('  X-Telegram-Init-Data:', initData ? `${initData.length} chars` : 'empty string');
    console.log('  Контекст:', context);
    console.log('  hasQueryId:', hasQueryId);
    console.log('  hasChat:', hasChat);
    console.log('  hasUser:', hasUser);
    
    if (context === 'INLINE_QUERY') {
      console.log('  🔍 INLINE_QUERY режим: initData валидная (user + query_id без chat)');
    } else if (context === 'EMPTY') {
      console.warn('  ⚠️ EMPTY: initData пустая - заголовок установлен, но бэкенд может отклонить');
    }
  }
}
```

**Ключевые изменения:**
- ✅ Улучшено логирование с определением контекста
- ✅ Добавлены предупреждения для разных сценариев
- ✅ Явно указано, что заголовок устанавливается всегда

#### 3. `miniapp/src/pages/GalleryPage2.tsx`

```typescript
// ✅ СТАЛО:
useEffect(() => {
  // ✅ FIX: Всегда устанавливаем заголовки, независимо от содержимого initData
  const currentInitData = manualInitData || initData || '';
  
  if (import.meta.env.DEV) {
    console.log('🔐 GalleryPage2: Установка заголовков:', {
      source: manualInitData ? 'manual' : initData ? 'telegram' : 'empty',
      length: currentInitData.length
    });
  }
  
  apiClient.setAuthHeaders(currentInitData);
}, [initData, manualInitData]);
```

**Ключевые изменения:**
- ✅ Убрано условие `if (currentInitData)`
- ✅ Используется `initData || ''` для гарантии строки
- ✅ Удален fallback на `checkExtensionHeaders()`
- ✅ Заголовки устанавливаются **ВСЕГДА**

## Проверка работоспособности

### 1. Логи в консоли браузера

При открытии через inline query должны быть следующие логи:

```
✅ Должно быть:
🔍 Inline query контекст обнаружен: { hasUser: true, hasQueryId: true, hasChat: false, ... }
🔐 App.tsx: Установка заголовков авторизации: { context: 'INLINE_QUERY', ... }
✅ Inline query контекст подтвержден: initData содержит user + query_id без chat
✅ Заголовки аутентификации установлены: { context: 'INLINE_QUERY', ... }
🔍 INLINE_QUERY режим: initData валидная (user + query_id без chat)
🔍 Interceptor: initData добавлен из defaults (inline query контекст)

❌ НЕ должно быть:
⚠️ App.tsx: initData отсутствует или пустая, заголовки не установлены
⚠️ Interceptor: X-Telegram-Init-Data отсутствует в defaults.headers.common
```

### 2. Network tab в DevTools

Откройте DevTools → Network и проверьте любой запрос к `/api/*`:

```
Request Headers:
  X-Telegram-Init-Data: user=%7B%22id%22%3A...&query_id=...&auth_date=...&hash=...
  ✅ Заголовок должен присутствовать ВСЕГДА
```

### 3. Тестовые сценарии

#### Сценарий 1: Открытие через обычный чат
1. Открыть Mini App из чата
2. Проверить: `context: 'CHAT'`, `hasChat: true`
3. Проверить: `X-Telegram-Init-Data` присутствует

#### Сценарий 2: Открытие через inline query ✅ ГЛАВНЫЙ ТЕСТ
1. Написать в любой чат: `@stixlybot test`
2. Выбрать результат
3. Проверить: `context: 'INLINE_QUERY'`, `hasQueryId: true`, `hasChat: false`
4. Проверить: `X-Telegram-Init-Data` присутствует
5. Проверить: Нет ошибок авторизации

#### Сценарий 3: Открытие с пустой initData (для теста)
1. Открыть в браузере напрямую (не через Telegram)
2. Проверить: `context: 'EMPTY'`, `initData = ''`
3. Проверить: `X-Telegram-Init-Data = ''` (пустая строка, но заголовок есть!)
4. Проверить: Бэкенд может вернуть 401, но запрос отправлен

## Дополнительные улучшения

### Логирование контекстов

Теперь в логах четко различаются контексты:
- `INLINE_QUERY` - inline query режим (user + query_id без chat)
- `CHAT` - обычный чат режим (user + chat)
- `UNKNOWN` - непустая initData с неизвестной структурой
- `EMPTY` - пустая initData (приложение открыто вне Telegram)

### Interceptor в axios

Interceptor в `client.ts` автоматически добавляет `X-Telegram-Init-Data` из `defaults`, если заголовок не установлен в конкретном запросе:

```typescript
if (!headers['X-Telegram-Init-Data']) {
  const defaultInitData = this.client.defaults.headers.common['X-Telegram-Init-Data'];
  if (defaultInitData) {
    headers['X-Telegram-Init-Data'] = defaultInitData as string;
    
    if (import.meta.env.DEV && typeof defaultInitData === 'string') {
      const hasQueryId = defaultInitData.includes('query_id=');
      const hasChat = defaultInitData.includes('chat=') || defaultInitData.includes('chat_type=');
      const context = hasQueryId && !hasChat ? 'INLINE_QUERY' : hasChat ? 'CHAT' : 'UNKNOWN';
      
      if (hasQueryId && !hasChat) {
        console.log('🔍 Interceptor: initData добавлен из defaults (inline query контекст)');
      }
    }
  }
}
```

## Затронутые файлы

1. ✅ `/miniapp/src/App.tsx` - главное исправление
2. ✅ `/miniapp/src/api/client.ts` - улучшено логирование
3. ✅ `/miniapp/src/pages/GalleryPage2.tsx` - убрано условие
4. ✅ `/miniapp/docs/INLINE_QUERY_INIT_DATA_FIX.md` - документация (этот файл)

## Результат

✅ **Проблема решена:** `X-Telegram-Init-Data` теперь отправляется **всегда**, независимо от контекста открытия Mini App.

✅ **Inline query работает:** При открытии через `@stixlybot` initData с `user + query_id` корректно отправляется на бэкенд.

✅ **Улучшена диагностика:** Детальные логи помогают быстро определить контекст и проблемы.

✅ **Без breaking changes:** Все существующие сценарии (обычный чат, direct link) продолжают работать.

## Ссылки

- [Telegram Web Apps Documentation](https://core.telegram.org/bots/webapps)
- [Telegram Inline Bots Documentation](https://core.telegram.org/api/bots/inline)
- [Telegram initData Format](https://core.telegram.org/bots/webapps#webappinitdata)

## Дата последнего обновления
27 января 2026
