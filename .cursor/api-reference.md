# Справочник домена — StickerArt Web (Telegram Mini App)

Источник для деталей API и окружения. Краткие guardrails: `.cursor/rules/stickerart-frontend.mdc`, `stickerart-testing-and-pr.mdc`. Ожидания к merge: `AGENTS.md`.

Локальные дополнения без коммита: см. `.cursor/api-reference.local.md` (в `.gitignore`).

---

## API Integration

- **Base URL**: `https://stickerartgallery-e13nst.amvera.io`
- **Аутентификация**: заголовок `X-Telegram-Init-Data` с `window.Telegram.WebApp.initData`
- **Локализация**: `ru` / `en` через `X-Language` или auto из initData
- **Кэширование**: Redis (стикеры) — ~7 дней, Nginx для `GET` — ~10 минут

**Swagger**: https://stickerartgallery-e13nst.amvera.io/swagger-ui/index.html  
**OpenAPI JSON**: https://stickerartgallery-e13nst.amvera.io/v3/api-docs

### Categories

- `GET /api/categories` — активные категории (локализация, сортировка по `displayOrder`)
- `POST /api/categories` — создать (`key`, `nameRu`, `nameEn`, описания, `displayOrder`, `iconUrl`)
- `GET /api/categories/{key}` — категория по ключу
- `PUT /api/categories/{key}` — обновить
- `DELETE /api/categories/{key}` — деактивировать (`204`)
- `GET /api/categories/counts` — категории + счётчики; фильтры: `officialOnly`, `authorId`, `hasAuthorOnly`
- `GET /api/categories/{key}/count` — число стикерсетов в категории
- `GET /api/categories/ai/suggest` — AI по `title` (кеш ~1 ч)
- `GET|POST /api/categories/ai/test-chatgpt` — админские проверки ChatGPT

### StickerSets

- `GET /api/stickersets` — список; `page`, `size`, `sort`, `direction`, `categoryKeys`, `likedOnly`, `officialOnly`, `authorId`, `hasAuthorOnly`
- **Важно**: при `likedOnly=true` поле `response.number` может быть `undefined` — fallback на переданный `page`
- `POST /api/stickersets` — регистрация (`name` обяз., `title`, `categoryKeys[]`, `isPublic`)
- `GET /api/stickersets/{id}` — детали
- `DELETE /api/stickersets/{id}` — удалить (владелец/админ)
- `PUT /api/stickersets/{id}/categories` — заменить категории (`string[]`)
- `PUT /api/stickersets/{id}/author` / `DELETE .../author` — `authorId` (админ)
- `PUT .../block` | `.../unblock`, `.../official` | `.../unofficial` — админ
- `POST .../publish` | `.../unpublish` — владелец/админ
- `POST .../ai/suggest-categories` — AI (`apply`, `minConfidence`)
- `GET /api/stickersets/search` — поиск по `name`
- `GET /api/stickersets/top-bylikes` — топ по лайкам
- `GET /api/stickersets/user/{userId}` — стикерсеты пользователя

### Auth

- `GET /api/auth/status`, `POST /api/auth/validate`, `POST /api/auth/user`, `POST /api/auth/register`

### Likes

- `PUT /api/likes/stickersets/{stickerSetId}/toggle` — toggle; ответ `{ totalLikes, liked | isLiked }`
- `POST` / `DELETE` — поставить / убрать лайк
- `GET /api/likes/stickersets`, `GET /api/likes` — списки с пагинацией
- `GET /api/likes/top-stickersets` — топ
- `GET /api/likes/test-system` — диагностика

### Profiles

- `GET /api/profiles/me` — текущий пользователь (`MyProfilePage`, `/profile`)
- `GET /api/users/{userId}/profile` — по Telegram ID (`ProfilePage`, `/profile/:userId`)
- `GET /api/profiles/{profileId}` — по ID профиля
- `PUT .../balance`, `POST .../balance/add` — админ
- **401 без initData**: показывать `ErrorDisplay`, не пустую страницу

### Users

- `GET /api/users/{id}`, `GET /api/users/{id}/photo`

### Proxy

- `GET /api/proxy/stickers/{fileId}` — прокси файла (`file`, `size`)
- `GET .../cache/stats`, `.../external-stats`

### Config

- `GET /api/config` — `botName`, `miniAppUrl`

---

## Likes (критично для фронта)

- **Store**: `useLikesStore` (Zustand), optimistic updates, debounce 500 ms, rollback
- **Основной API**: `PUT .../toggle`; `POST`/`DELETE` — только при необходимости
- **Маппинг полей** (nullish coalescing):
  - список стикерсетов: `likesCount`, `isLikedByCurrentUser`
  - toggle: `totalLikes`, `liked ?? isLiked`
  - сводка: `likesCount ?? totalLikes`, `isLikedByCurrentUser ?? liked ?? isLiked`
- **Race / `initializeLikes`**: не перетирать локальные правки: при `syncing: true` — не брать API; если локальное изменение менее 3 с назад и API расходится — старый кэш; иначе — API
- **Нагрузка**: ~1 req/s на стикер, debounce 500 ms, очередь offline, до 3 retries

---

## React / производительность (доменные напоминания)

- Функциональные компоненты; Zustand для глобального состояния; lazy-картинки (intersection), для стикеров — `useProgressiveLoading`
- Первые паки: `isHighPriority: true` где принято; `rootMargin: '800px'` для preload; `loading="lazy"` для не-priority; debounce для поиска

## Telegram Web App

- После загрузки: `WebApp.ready()`
- Темы: `var(--tg-theme-*)`
- Учитывать mobile / desktop

## Тесты

- E2E: Playwright — см. `tests/` в корне репозитория и конфиги `miniapp/playwright.config*.ts`
- `data-testid` для стабильных селекторов; ARIA и клавиатура по смыслу фичи

## TypeScript

- Типы для props и ответов API; избегать `any`; `unknown` на границе + сужение

## Git

- Ветка по умолчанию: `main`; push: `git push` (без лишнего `origin main`, если не нужно)
- В коммиты не добавлять trailer'ы (`Co-authored-by` и т.д.)
- Не коммитить: `dist/`, `node_modules/`, артефакты тестов/репортов Playwright, сгенерированные ассеты из ignore-списка
- Тесты в репозитории **версионируются** (они в исходниках)

## Local Development

- Node 18+, `npm ci`
- `miniapp/.env.local` (не в git):

  ```
  VITE_BACKEND_URL=https://stickerartgallery-e13nst.amvera.io
  ```

- Dev: из `miniapp` с `VITE_BACKEND_URL`; `npm run dev -- --host --port 3000`
- URL: `http://localhost:3000/miniapp/`; API проксируется на `VITE_BACKEND_URL` (см. корневой `vite.config.ts`)
