Da# 🔍 Debug Build Logs - Инструкция

## Что добавлено

### 1. Build-time Debug (Dockerfile)

Добавлено детальное логирование в процесс Docker сборки:

```dockerfile
# Информация о сборке
echo "=== BUILD INFO ==="
echo "CACHEBUST: ${CACHEBUST}"
echo "NODE_VERSION: $(node --version)"
echo "BUILD_TIME: $(date)"
echo "BUILD_TIMESTAMP: $(date +%s)"

# Файлы ДО сборки
echo "=== FILES BEFORE BUILD ==="
ls -la miniapp/src/pages/
head -80 miniapp/src/pages/GalleryPage.tsx
grep -n "storedInitData" miniapp/src/pages/GalleryPage.tsx

# Процесс сборки
echo "=== STARTING BUILD ==="
rm -rf dist
echo "dist/ removed"
npx tsc
echo "TypeScript checked"
npx vite build
echo "Vite build completed"

# Файлы ПОСЛЕ сборки
echo "=== FILES AFTER BUILD ==="
ls -la dist/miniapp/assets/*.js
grep -r "storedInitData" dist/miniapp/
```

### 2. Runtime Debug (GalleryPage.tsx)

Добавлены console.log в код:

```typescript
useEffect(() => {
  console.log('🔍 DEBUG: GalleryPage useEffect - BUILD_TIMESTAMP: 2025-10-28T14:30:00Z');
  const urlParams = new URLSearchParams(window.location.search);
  const urlInitData = urlParams.get('initData');
  const storedInitData = localStorage.getItem('telegram_init_data');
  const extensionInitData = apiClient.checkExtensionHeaders();
  
  console.log('🔍 DEBUG: urlInitData:', urlInitData ? 'EXISTS' : 'NULL');
  console.log('🔍 DEBUG: storedInitData:', storedInitData ? 'EXISTS' : 'NULL');
  console.log('🔍 DEBUG: extensionInitData:', extensionInitData ? 'EXISTS' : 'NULL');
  // ...
}, []);
```

## Как читать логи

### 1. Логи сборки (Build logs)

```bash
# Получить все логи сборки
amvera logs build sticker-art-e13nst > build.log

# Или в реальном времени
amvera logs build sticker-art-e13nst --follow
```

### Что искать в build.log:

#### A. Информация о сборке
```
=== BUILD INFO ===
CACHEBUST: 1
NODE_VERSION: v18.x.x
BUILD_TIME: Mon Oct 28 11:30:00 UTC 2025
BUILD_TIMESTAMP: 1730116200
```

**Проверка**: BUILD_TIMESTAMP должен быть новым (больше чем у предыдущей сборки)

#### B. Исходный код ДО сборки
```
=== FILES BEFORE BUILD ===
-rw-r--r-- 1 root root 12345 Oct 28 11:30 GalleryPage.tsx

=== GalleryPage.tsx FIRST 80 LINES ===
import React, { useEffect, useState, useCallback, useMemo } from 'react';
...
// BUILD_DEBUG: Force rebuild - timestamp 2025-10-28T14:30:00Z
useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const urlInitData = urlParams.get('initData');
  const storedInitData = localStorage.getItem('telegram_init_data');
  ...
```

**Проверка**: 
- ✅ Должен быть комментарий `BUILD_DEBUG: Force rebuild - timestamp 2025-10-28T14:30:00Z`
- ✅ Должна быть строка `const storedInitData = localStorage.getItem(...)`

#### C. Поиск storedInitData в исходниках
```
=== SEARCHING FOR storedInitData ===
57:    const storedInitData = localStorage.getItem('telegram_init_data');
63:    } else if (storedInitData) {
64:      setUiState(prev => ({ ...prev, manualInitData: storedInitData }));
```

**Проверка**: Должно найти 3 строки с `storedInitData`

#### D. Процесс сборки
```
=== STARTING BUILD ===
dist/ removed
TypeScript checked
Vite build completed
index.html copied
```

**Проверка**: Все шаги должны пройти без ошибок

#### E. Результат сборки
```
=== FILES AFTER BUILD ===
total 12K
-rw-r--r-- 1 root root  456 Oct 28 11:30 index.html
drwxr-xr-x 2 root root 4.0K Oct 28 11:30 miniapp

=== BUILT JS FILES ===
-rw-r--r-- 1 root root 123K Oct 28 11:30 index-ABC123XY.js
-rw-r--r-- 1 root root 456K Oct 28 11:30 react-vendor-ABC123XY.js

=== CHECKING FOR storedInitData IN BUILT FILES ===
NOT FOUND IN BUILT FILES
```

**Проверка**: 
- ✅ Hash в именах файлов должен быть НОВЫМ
- ✅ `storedInitData` НЕ должен быть в собранных файлах (минифицировано)

### 2. Runtime логи (Browser console)

Открой браузер (режим инкогнито) и проверь консоль:

```
https://sticker-art-e13nst.amvera.io/miniapp/
```

#### Что должно быть:

```
✅ 🔍 DEBUG: GalleryPage useEffect - BUILD_TIMESTAMP: 2025-10-28T14:30:00Z
✅ 🔍 DEBUG: urlInitData: NULL
✅ 🔍 DEBUG: storedInitData: NULL
✅ 🔍 DEBUG: extensionInitData: NULL
✅ 🔧 PRODUCTION MODE: initData не найден, используем пустую строку
```

#### Чего НЕ должно быть:

```
❌ ReferenceError: storedInitData is not defined
```

### 3. Runtime логи (Amvera)

```bash
# Получить runtime логи
amvera logs run sticker-art-e13nst

# Или в реальном времени
amvera logs run sticker-art-e13nst --follow
```

**Проверка**: Nginx должен стартовать без ошибок

## Диагностика проблем

### Проблема 1: BUILD_TIMESTAMP старый

**Симптом**: BUILD_TIMESTAMP в build.log совпадает с предыдущей сборкой

**Причина**: Docker использует кэшированный слой

**Решение**:
```bash
# Принудительный ребилд через UI
# ИЛИ
git commit --allow-empty -m "chore: force rebuild $(date +%s)"
git push
```

### Проблема 2: В исходниках нет BUILD_DEBUG комментария

**Симптом**: В логах сборки отсутствует строка `BUILD_DEBUG: Force rebuild`

**Причина**: Старая версия файла в Git или Docker кэш

**Решение**:
```bash
# Проверь Git
git log --oneline -1
git diff HEAD miniapp/src/pages/GalleryPage.tsx

# Если изменения есть локально, но не в Git
git add miniapp/src/pages/GalleryPage.tsx
git commit -m "fix: add debug logging"
git push
```

### Проблема 3: Hash файлов не изменился

**Симптом**: `index-ABC123XY.js` - тот же hash что и раньше

**Причина**: Vite кэширование или контент файлов не изменился

**Решение**:
- Проверь что `rm -rf dist` выполнился
- Проверь что в исходниках есть изменения (BUILD_DEBUG комментарий)
- Проверь что Vite build завершился успешно

### Проблема 4: storedInitData найден в собранных файлах

**Симптом**: В логах `grep -r "storedInitData" dist/miniapp/` находит совпадения

**Причина**: Минификация не сработала или старые файлы

**Решение**:
- Проверь что `dist/ removed` выполнился перед сборкой
- Проверь версию Vite в package.json
- Проверь конфиг Vite (должна быть минификация включена)

### Проблема 5: В браузере старый BUILD_TIMESTAMP

**Симптом**: Консоль браузера показывает старый timestamp или его нет

**Причина**: Браузер кэширует JS файлы

**Решение**:
1. **Hard refresh**: Ctrl+Shift+R (Windows) / Cmd+Shift+R (Mac)
2. **Режим инкогнито**: Ctrl+Shift+N / Cmd+Shift+N
3. **Очистить кэш**: Открыть DevTools → Network → Disable cache + обновить страницу
4. **Service Worker**: Открыть DevTools → Application → Service Workers → Unregister

### Проблема 6: В браузере ошибка storedInitData

**Симптом**: `ReferenceError: storedInitData is not defined` в консоли

**Причина**: Браузер загрузил старый JS файл из кэша

**Решение**:
```bash
# 1. Проверь hash в HTML
curl -s https://sticker-art-e13nst.amvera.io/miniapp/ | grep -o 'index-[^"]*\.js'

# 2. Проверь что файл на сервере новый
curl -s https://sticker-art-e13nst.amvera.io/miniapp/assets/index-HASH.js | head -20

# 3. Если hash новый, но ошибка есть - очисти кэш браузера полностью
```

## Полная проверка (Checklist)

```bash
# 1. Проверь что изменения в Git
git log --oneline -1
git show HEAD:miniapp/src/pages/GalleryPage.tsx | grep "BUILD_DEBUG"

# 2. Проверь build логи
amvera logs build sticker-art-e13nst | grep -A 5 "BUILD INFO"
amvera logs build sticker-art-e13nst | grep -A 3 "BUILD_DEBUG"
amvera logs build sticker-art-e13nst | grep "BUILT JS FILES"

# 3. Проверь runtime логи
amvera logs run sticker-art-e13nst | tail -20

# 4. Проверь hash файлов
curl -s https://sticker-art-e13nst.amvera.io/miniapp/ | grep -o 'index-[^"]*\.js'

# 5. Проверь браузер (инкогнито)
# Открыть https://sticker-art-e13nst.amvera.io/miniapp/
# F12 → Console → искать "🔍 DEBUG: GalleryPage useEffect"
```

## Ожидаемый результат

После успешного деплоя с debug логами:

**Build logs:**
- ✅ BUILD_TIMESTAMP новый
- ✅ В исходниках есть `BUILD_DEBUG: Force rebuild - timestamp 2025-10-28T14:30:00Z`
- ✅ Найдено 3 строки с `storedInitData` в исходниках
- ✅ `dist/ removed`, `TypeScript checked`, `Vite build completed`
- ✅ Новый hash в именах файлов
- ✅ `storedInitData` НЕ найден в собранных файлах

**Browser console:**
- ✅ `🔍 DEBUG: GalleryPage useEffect - BUILD_TIMESTAMP: 2025-10-28T14:30:00Z`
- ✅ `🔍 DEBUG: urlInitData: NULL`
- ✅ `🔍 DEBUG: storedInitData: NULL`
- ✅ Нет ошибки `ReferenceError: storedInitData is not defined`
- ✅ Стикеры загружаются

**Amvera runtime logs:**
- ✅ Nginx стартовал без ошибок
- ✅ Нет `mkdir() failed` ошибок

---

**Следующий коммит**: `fix: add comprehensive build and runtime debug logging`





