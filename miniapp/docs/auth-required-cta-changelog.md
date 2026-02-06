# Отчёт: призыв авторизации через бота (401 → CTA)

## Цель
Заменить сообщения об ошибке при неавторизованном пользователе (401) на призыв открыть бота и кнопку в чат с @stixlybot. Стиль — в рамках дизайн-системы.

---

## 1. Новые файлы

| Файл | Назначение |
|------|------------|
| `miniapp/src/components/AuthRequiredCTA.tsx` | Компонент: заголовок, описание, кнопка «Открыть @stixlybot» → `tg.openTelegramLink('https://t.me/stixlybot')` или `window.open`. |
| `miniapp/src/components/AuthRequiredCTA.css` | Стили блока (flex, отступы, иконка, кнопка). |

---

## 2. Изменённые файлы (минимально)

### API и типы
- **`miniapp/src/types/sticker.ts`** — в `LeaderboardResponse` и `AuthorsLeaderboardResponse` добавлено опциональное поле `authRequired?: boolean`.
- **`miniapp/src/api/client.ts`** — в `getUsersLeaderboard` / `getAuthorsLeaderboard` при `error?.response?.status === 401` возвращается fallback с `authRequired: true` (без reject).

### Хук свайпов
- **`miniapp/src/hooks/useSwipeStickerFeed.ts`** — добавлены состояние `errorStatus` и сброс в `reset`; в `catch` задаётся `setErrorStatus(error?.response?.status ?? null)`; в возвращаемом объекте добавлено поле `errorStatus`.

### Страница Swipe
- **`miniapp/src/pages/SwipePage.tsx`** — импорт `AuthRequiredCTA`; из хука берётся `errorStatus`; при `error && !stickerSets.length` если `errorStatus === 401` рендерится `<AuthRequiredCTA ... />`, иначе прежний блок с «Попробовать снова». Текст заголовка CTA: **«Авторизуйтесь через бота»**.

### Модалки лидербордов
- **`miniapp/src/components/LeaderboardModal.tsx`** — импорт `AuthRequiredCTA`; состояние `authRequired`; в `getUsersLeaderboard().then` выставляются `authRequired = !!response.authRequired`, `setUsers(response.content ?? [])`; в разметке при `authRequired` рендер `<AuthRequiredCTA />` внутри `.leaderboard-modal__empty--cta`.
- **`miniapp/src/components/AuthorsLeaderboardModal.tsx`** — то же для `getAuthorsLeaderboard` и `response.authRequired`.

### Профиль и store
- **`miniapp/src/store/useProfileStore.ts`** — в состояние добавлены `authRequired: boolean` и `setAuthRequired`; в `clearErrors` и `reset` сброс `authRequired: false`.
- **`miniapp/src/pages/MyProfilePage.tsx`** — импорт `AuthRequiredCTA`; из store берутся `authRequired`, `setAuthRequired`; в `loadUserInfo` и в `loadUserStickerSets` при `error?.response?.status === 401` вызывается `setAuthRequired(true)`; блок «ошибка страницы» показывается при `(error || (userError && authRequired)) && isInTelegramApp`; внутри при `authRequired` рендер `<AuthRequiredCTA />` в `.error-container__cta`, иначе прежний EmptyState.

### Стили
- **`miniapp/src/components/LeaderboardModal.css`** — классы `.leaderboard-modal__empty--cta` и вложенный `.auth-required-cta`.
- **`miniapp/src/styles/common.css`** — класс `.error-container__cta` (flex, min-height, padding).

---

## 3. Конфликты
- Изменения точечные: новые файлы, добавление полей в типы/store, ветвление по 401/`authRequired` в UI. Пересечений с другими фичами не вносилось.

## 4. Тексты CTA (актуальные)
- Заголовок везде по умолчанию: **«Авторизуйтесь через бота»** (дефолт в `AuthRequiredCTA`; на Swipe и в модалках при необходимости переопределяется через проп `title`).
