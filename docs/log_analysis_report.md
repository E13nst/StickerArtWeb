# Отчёт по анализу логов Docker Build

**Источник:** `docs/front.log`  
**Дата анализа:** 2026-02-09  
**Инструмент:** `analyze_logs.py` (предобработка), ручной анализ (этап 2)

---

## 1. Сводка предобработки

### 1.1 Базовая статистика

| Метрика | Значение |
|--------|----------|
| Всего записей | **4 647** |
| Начало | 2026-02-09T08:40:22 |
| Конец | 2026-02-09T09:02:46 |
| Длительность | **~22,4 минуты** (1 343 сек) |
| stdout | 4 095 записей (88,1%) |
| stderr | 552 записи (11,9%) |
| Макс. длина сообщения | 873 символа (повторяющиеся длинные сообщения) |

### 1.2 Распределение по типам сообщений

| Категория | Записей | Доля |
|-----------|---------|------|
| ERROR | 3 151 | 67,8% |
| OTHER | 912 | 19,6% |
| INFO | 408 | 8,8% |
| WARN | 104 | 2,2% |
| NPM | 56 | 1,2% |
| DOCKER | 16 | 0,3% |

### 1.3 Временная шкала ключевых событий

1. **08:40:22** — Cloning into '/git'...
2. **08:40:23** — HEAD is now at b031472 (checkout)
3. **08:40:24–29** — Kaniko: Resolved base node:18-alpine, Retrieving image, Building stage
4. **08:40:34** — COPY package*.json ./
5. **08:40:34** — RUN npm ci --no-audit
6. **08:40:40** — npm install завершён (зависимости установлены)
7. **08:40:40–41** — COPY miniapp, COPY index.html, vite.config, tsconfig...
8. **08:40:41–42** — RUN echo "=== STARTING BUILD ===" && npx tsc && npx vite build
9. **08:40:43** — **error building image: failed to execute command: exit status 2** (падение сборки)
10. **08:40:57** — Container builder completed with exit code 2
11. **08:40:57** — Docker build watcher application completed
12. Далее в логе — повторные попытки сборки (08:44:25, 08:50:55, 09:02:04 — новые клоны и сборки)

**Аномально длинные паузы (>30 сек):**

- **~574 сек** (~9,5 мин) — между завершением watcher и следующим "Cloning" (ожидание следующего запуска пайплайна).
- **~363 сек** (~6 мин) — аналогично, пауза между попытками.
- **~208 сек** (~3,5 мин) — между завершением первой сборки и следующим клоном.

---

## 2. Ключевые проблемы

### 2.1 Критические (приводят к падению сборки)

#### 1. Падение Docker-сборки (exit status 2)

- **Частота:** 8 раз (несколько попыток сборки в одном логе).
- **Пример:** `error building image: error building stage: failed to execute command: waiting for process to exit: exit status 2`
- **Категория:** Сборка приложения (TypeScript/Vite).
- **Причина:** Команда `npx tsc && npx vite build` завершается с кодом 2 из-за ошибок TypeScript.

#### 2. Ошибки TypeScript в `usePageTransitions.ts`

- **Частота:** серия из ~20 ошибок в первом прогоне (08:40:43).
- **Примеры:**
  - `(182,7): error TS1005: '>' expected.`
  - `(183,18): error TS1136: Property assignment expected.`
  - `(184–202): error TS1005: ';' expected.` и др.
- **Вывод:** Синтаксическая ошибка или некорректный JSX/TS в районе строк 182–202 (вероятно, незакрытый фрагмент или неверный generic).

#### 3. Отсутствующий модуль `useHapticFeedback`

- **Файл:** `miniapp/src/components/AnimatedLikeButton.tsx` (строка 2).
- **Сообщение:** `Cannot find module '../hooks/useHapticFeedback' or its corresponding type declarations`
- **Частота:** 5 раз (каждая повторная сборка).
- **Категория:** Отсутствующий файл/модуль.

#### 4. Не найденные имена компонентов MUI в `AuthStatus.tsx`

- **Файл:** `miniapp/src/components/AuthStatus.tsx`
- **Ошибки:** `Cannot find name 'Card'`, `'CardContent'`, `'Typography'` (и повторения).
- **Частота:** по 5 раз на каждое имя.
- **Категория:** Импорты/зависимости (компоненты не импортированы или MUI удалён без замены).

---

### 2.2 Важные (не останавливают сборку сами по себе, но повторяются при каждой попытке)

#### 5. Неиспользуемые переменные/импорты (TS6133)

- **Файлы и сущности:**
  - `App.tsx`: `imageLoader`, `LoadPriority` — declared but never read.
  - `api/client.ts`: `mockAuthResponse`.
  - `AccountActivityBlocks.tsx`: `onTaskAction`.
  - `AnimatedLikeButton.tsx`: `useEffect`.
  - `AnimatedPackCard.tsx`: `isHighPriority`.
- **Частота:** по 5 раз на каждую (при 5 прогонах сборки).
- **Влияние:** Загрязнение кода, при строгом `tsconfig` могут превращаться в ошибки.

---

### 2.3 Средние (предупреждения)

#### 6. Устаревшие npm-зависимости (deprecated)

| Пакет | Рекомендация |
|-------|----------------|
| rimraf@3.0.2 | Использовать v4+ |
| inflight@1.0.6 | Модуль не поддерживается, утечки памяти; рассмотреть lru-cache |
| glob@7.2.3 | Использовать v9+ |
| @types/jszip@3.4.1 | Удалить, jszip поставляет свои типы |
| @telegram-apps/types, transformers, bridge | Заменить на @tma.js/types, @tma.js/transfomers, @tma.js/bridge |
| @humanwhocodes/config-array, object-schema | Заменить на @eslint/config-array, @eslint/object-schema |

**Частота:** по 8 раз на пакет (несколько `npm ci` в логе).

---

### 2.4 Информационные

- **Время сборки:** ~22 минуты на весь лог — учтены несколько полных циклов (clone → install → build → fail). Одна попытка сборки до первого падения — порядка 1–2 минут после `npm ci`.
- **NPM-ошибок установки:** 0 (npm install/ci проходят успешно).
- **Файловых ошибок (ENOENT/EACCES):** 0.
- **Таймаутов:** 0.

---

## 3. Анализ корневых причин

### 3.1 Цепочка событий до падения первой сборки

```
RUN npx tsc
    → TypeScript компиляция
    → Ошибки в usePageTransitions.ts (синтаксис/JSX ~стр. 182–202)
    → Дополнительно: отсутствует useHapticFeedback, в AuthStatus нет Card/Typography
    → tsc завершается с exit code 2
    → Docker stage "RUN ... npx tsc && npx vite build" падает
    → error building image: failed to execute command: exit status 2
```

**Триггер:** Запуск `npx tsc` в Docker при сборке.  
**Итог:** Образ не собирается, пайплайн не может выдать артефакт.

### 3.2 Повторные попытки в логе

В логе видно несколько полных циклов (новый clone → npm ci → build → fail). Длительные паузы (208–574 сек) — интервалы между такими попытками (ручной или CI перезапуск). Каждая попытка воспроизводит те же ошибки TypeScript.

### 3.3 Контекст

- Сборка идёт в Kaniko (Docker) на образе `node:18-alpine`.
- Используются `npm ci`, затем `npx tsc` и `npx vite build`.
- Код в `miniapp/`; часть ошибок связана с миграцией с MUI (AuthStatus) и с отсутствующим хуком (useHapticFeedback).

---

## 4. Метрики производительности

| Этап | Оценка по логу |
|------|-----------------|
| Git clone + checkout | ~2 сек |
| Получение образов Kaniko (node:18-alpine, nginx:alpine) | ~5 сек |
| COPY package*.json + RUN npm ci | ~6 сек |
| COPY исходников | ~1–2 сек |
| RUN npx tsc (до падения) | ~1–2 сек (затем exit 2) |

**Узкое место:** Не время, а **стабильность сборки** — сборка падает на этапе TypeScript, до Vite build дело не доходит.

---

## 5. Рекомендации

### Приоритет 1 (критический)

1. **Исправить `miniapp/src/hooks/usePageTransitions.ts` (около строк 182–202)**  
   - Причина: TS1005/TS1136 указывают на синтаксис (ожидаются `>`, `;`, property assignment).  
   - Действие: Проверить JSX/ generics, закрытие тегов и скобок, лишние/неверные символы.  
   - Проверка: локально выполнить `npx tsc` в корне проекта — ошибок по этому файлу быть не должно.

2. **Восстановить или добавить модуль `useHapticFeedback`**  
   - Причина: `AnimatedLikeButton.tsx` импортирует `../hooks/useHapticFeedback`, файл отсутствует.  
   - Действие: Создать `miniapp/src/hooks/useHapticFeedback.ts` (или перенести из другого пути) с корректной сигнатурой и экспортом.  
   - Проверка: `npx tsc` без ошибки TS2307 по этому модулю.

3. **Привести в порядок `miniapp/src/components/AuthStatus.tsx`**  
   - Причина: Используются `Card`, `CardContent`, `Typography` без объявления (вероятно, остатки MUI).  
   - Действие: Либо импортировать компоненты из используемой UI-библиотеки, либо заменить разметку на текущие компоненты проекта.  
   - Проверка: `npx tsc` без TS2304 по AuthStatus.

### Приоритет 2 (высокий)

4. **Удалить неиспользуемые импорты и переменные**  
   - Файлы: App.tsx, api/client.ts, AccountActivityBlocks.tsx, AnimatedLikeButton.tsx, AnimatedPackCard.tsx.  
   - Действие: Удалить или использовать `imageLoader`, `LoadPriority`, `mockAuthResponse`, `onTaskAction`, `useEffect`, `isHighPriority`.  
   - Проверка: отсутствие TS6133 при текущем уровне строгости.

### Приоритет 3 (средний)

5. **Обновить/заменить устаревшие зависимости**  
   - rimraf → v4+; glob → v9+; удалить @types/jszip; мигрировать @telegram-apps/* на @tma.js/*; заменить @humanwhocodes/* на @eslint/*.  
   - Действие: Пошаговая замена в package.json и проверка тестов и сборки после каждого изменения.

### Проверка после исправлений

- Локально: `cd miniapp && npm ci && npx tsc && npx vite build` — завершается с кодом 0.
- В CI/Docker: перезапустить сборку образа и убедиться, что этап с `npx tsc && npx vite build` проходит без exit status 2.

---

## 6. Итог

- **Сборка в логе падает из-за ошибок TypeScript**, а не из-за сети, прав доступа или npm install.
- **Критичные точки:** синтаксис/структура в `usePageTransitions.ts`, отсутствующий `useHapticFeedback`, использование MUI-компонентов в `AuthStatus.tsx` без импортов.
- После исправления этих трёх блоков сборка должна проходить; далее целесообразно очистить неиспользуемый код и обновить deprecated-зависимости.
