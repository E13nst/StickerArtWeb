# Отчёт об изменениях: аватарки и устранение «DU»

Внесены правки по трём направлениям: загрузка данных профиля и фото, проверка «мой профиль», кэширование аватаров. Цель — избежать пустых аватаров и плейсхолдера «DU» в хедере.

---

## 1. Загрузка данных: profilePhotoFileId и profilePhotos на всех этапах

### Проблема

- `getMyProfile()` возвращает объект из `mapProfileToUserInfo`: в нём не заполняются `profilePhotoFileId` и `profilePhotos`.
- В `initializeCurrentUser` после `getProfile()` в стор попадал профиль без полей фото.
- В `GeneratePage.refreshMyProfile()` вызывался только `setUserInfo(me)` — без фото, из‑за чего после генерации в сторе терялись уже загруженные данные фото.

### Изменения

**`miniapp/src/store/useProfileStore.ts`**

- Добавлена вспомогательная функция **`enrichUserInfoWithPhoto(profile)`**:
  - вызывает `apiClient.getUserPhoto(profile.id)` (GET `/api/users/{id}/photo`);
  - при успехе дополняет профиль полями `profilePhotoFileId` и `profilePhotos`;
  - при ошибке возвращает исходный `profile`.
- Во всех ветках `initializeCurrentUser`, где в стор кладётся профиль, перед `set()` вызывается `enrichUserInfoWithPhoto`:
  - ветка «нет me» → `getProfile(fallbackId)` → `enrichUserInfoWithPhoto(profile)` → `set(userInfo: userInfoWithPhoto, ...)`;
  - ветка «есть me», нужен полный профиль → `getProfile(me.userId)` → `enrichUserInfoWithPhoto(profile)` → `set(userInfo: userInfoWithPhoto, ...)`;
  - ветка «есть me», полный профиль не нужен» → `enrichUserInfoWithPhoto(me)` → `set(userInfo: userInfoWithPhoto)` (чтобы в сторе всегда был «я» с метаданными фото);
  - ветка `catch` (ошибка getMyProfile) → `getProfile(fallbackId)` → `enrichUserInfoWithPhoto(profile)` → `set(userInfo: userInfoWithPhoto, ...)`.

В результате при первом запуске и при любом fallback в сторе оказывается профиль с `profilePhotoFileId`/`profilePhotos`, если API их отдаёт.

**`miniapp/src/pages/GeneratePage.tsx`**

- В **`refreshMyProfile()`** после `getMyProfile()` добавлен вызов `apiClient.getUserPhoto(me.id)`:
  - при успехе и наличии фото: `setUserInfo({ ...me, profilePhotoFileId, profilePhotos })`;
  - иначе или при ошибке: `setUserInfo(me)`.

После генерации и обновления баланса в сторе не теряются поля фото; хедер может продолжать показывать аватар по `userInfo` или по blob из кэша.

---

## 2. Проверка isMyProfile: сопоставление Telegram id и currentUserId

### Проблема

- «Мой» профиль определялся как `userInfo.telegramId === user.id` или `userInfo.id === currentUserId`.
- В API `mapProfileToUserInfo` и `id`, и `telegramId` берутся из `data.userId`; при внутреннем id в бэкенде `userInfo.telegramId` мог не совпадать с `user.id` (Telegram id).
- В `userUtils` уже есть единый способ получить Telegram id пользователя: `getUserTelegramId(userInfo)` (приоритет: `telegramUserInfo?.user?.id` → `telegramId` → `id`).

### Изменения

**`miniapp/src/components/ui/HeaderPanel.tsx`**

- Импорт: `import { getUserTelegramId } from '@/utils/userUtils';`
- Условие «мой профиль» переписано с использованием **`getUserTelegramId`**:
  - было: `userInfo.telegramId === user.id || (currentUserId != null && userInfo.id === currentUserId)`;
  - стало: `user.id === getUserTelegramId(userInfo) || (currentUserId != null && userInfo.id === currentUserId)`.

Так хедер одинаково обрабатывает случаи, когда бэкенд отдаёт Telegram id в `userId` или отдельно в `telegramUserInfo.user.id`, и не зависит от того, что именно попало в `userInfo.telegramId`.

---

## 3. Кэширование аватаров

### Проблема

- В `useUserAvatar` уже есть модульный кэш `avatarCache = new Map<number, string>()` (userId → blob URL).
- MyProfilePage загружает blob своим `loadAvatarBlob` и кладёт URL только в локальный state; в общий кэш ничего не пишется.
- При переходе на другую страницу HeaderPanel вызывает `useUserAvatar(avatarUserId)` и заново запрашивает фото, хотя blob уже был получен на MyProfilePage.

### Изменения

**`miniapp/src/hooks/useUserAvatar.ts`**

- Экспортирована функция **`setCachedAvatar(userId: number, blobUrl: string)`**: кладёт `blobUrl` в `avatarCache` по `userId`.
- В JSDoc указано: вызывать после загрузки blob на страницах (например MyProfilePage), чтобы хедер и другие вызовы `useUserAvatar` не делали повторный запрос.

**`miniapp/src/pages/MyProfilePage.tsx`**

- Импорт: `import { setCachedAvatar } from '@/hooks/useUserAvatar';`
- В **`loadAvatarBlob`** сразу после `setAvatarBlobUrl(objectUrl)` добавлен вызов **`setCachedAvatar(userId, objectUrl)`**.

В результате после открытия MyProfilePage и загрузки аватара тот же blob URL доступен из кэша в HeaderPanel (и везде, где используется `useUserAvatar` для этого userId), повторных запросов на получение blob нет.

---

## Итог по файлам

| Файл | Изменение |
|------|-----------|
| `store/useProfileStore.ts` | `enrichUserInfoWithPhoto`; во всех ветках `initializeCurrentUser` профиль в стор кладётся с полями фото; добавлена ветка «me без полного профиля» с обогащением `me` фото. |
| `pages/GeneratePage.tsx` | В `refreshMyProfile()` после `getMyProfile()` вызывается `getUserPhoto(me.id)` и в стор передаётся объект с `profilePhotoFileId`/`profilePhotos` при наличии. |
| `components/ui/HeaderPanel.tsx` | Импорт `getUserTelegramId`; условие `isMyProfile` использует `user.id === getUserTelegramId(userInfo)`. |
| `hooks/useUserAvatar.ts` | Экспорт `setCachedAvatar(userId, blobUrl)` для записи в общий кэш. |
| `pages/MyProfilePage.tsx` | Импорт `setCachedAvatar`; в `loadAvatarBlob` после создания blob URL вызывается `setCachedAvatar(userId, objectUrl)`. |

---

## Ожидаемый эффект

1. **Пустые аватары / «DU»**: при первом запуске и после генерации в сторе есть `profilePhotoFileId`/`profilePhotos` (если API их отдаёт); проверка «мой профиль» в хедере стала устойчивее к разным форматам id; хедер может показать аватар по `getAvatarUrl(...)` или по blob из `useUserAvatar`.
2. **Повторные запросы blob**: после загрузки аватара на MyProfilePage URL попадает в общий кэш; при переходе на другие страницы HeaderPanel использует кэш и не запрашивает blob повторно.

Для полной картины потока загрузки аватара см. `docs/avatar-flow-report.md`.
