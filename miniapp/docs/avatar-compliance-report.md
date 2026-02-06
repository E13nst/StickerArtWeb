# Отчёт о соответствии: загрузка и кэширование аватаров

Проверка реализации по пунктам лучших практик и минималистичной архитектуры.

---

## 1. Загрузка и обновление профиля пользователя

| Требование | Статус | Реализация |
|------------|--------|------------|
| При загрузке профиля (getMyProfile) аватар загружается сразу вместе с profilePhotoFileId и profilePhotos | ✅ | В `useProfileStore.initializeCurrentUser` после получения профиля вызывается `enrichUserInfoWithPhoto(profile)`: `getUserPhoto(profile.id)` и слияние полей в userInfo. Во всех ветках (успех getMyProfile, fallback, catch, «me без полного профиля») в стор кладётся профиль с полями фото. |
| Если аватар ещё не загружен — загрузка в процессе запроса профиля, данные в сторе | ✅ | `enrichUserInfoWithPhoto` вызывается синхронно в цепочке инициализации; результат сохраняется через `set({ userInfo: userInfoWithPhoto, ... })`. |
| При обновлении профиля setUserInfo не перезаписывает данные аватара, если они уже в сторе | ✅ | В `GeneratePage.refreshMyProfile` при обновлении без фото (getUserPhoto не вернул или ошибка) вызывается `preserveAvatarFromStore(me)`: читается текущий `userInfo` из стора, при том же пользователе (me.id === userInfo.id \|\| me.telegramId === userInfo.telegramId) и наличии в сторе profilePhotoFileId/profilePhotos они подмешиваются в новый объект перед `setUserInfo(nextUserInfo)`. |

**Файлы:** `store/useProfileStore.ts` (enrichUserInfoWithPhoto, все ветки initializeCurrentUser), `pages/GeneratePage.tsx` (preserveAvatarFromStore, refreshMyProfile).

---

## 2. Проверка «мой профиль»

| Требование | Статус | Реализация |
|------------|--------|------------|
| Универсальная логика по Telegram id или внутреннему id с учётом разных форматов (telegramId, userId) | ✅ | В `HeaderPanel` используется `getUserTelegramId(userInfo)` из `userUtils`: приоритет `telegramUserInfo?.user?.id` → `telegramId` → `id`. |
| Сопоставление user.id с userInfo.telegramId или currentUserId с учётом возможных различий | ✅ | Условие: `user.id === getUserTelegramId(userInfo) || (currentUserId != null && userInfo.id === currentUserId)`. Оба варианта id покрыты. |

**Файлы:** `components/ui/HeaderPanel.tsx` (isMyProfile), `utils/userUtils.ts` (getUserTelegramId).

---

## 3. Кэширование аватаров

| Требование | Статус | Реализация |
|------------|--------|------------|
| useUserAvatar эффективно кэширует; при первом запросе загрузка и сохранение в кэш | ✅ | Модульный `avatarCache = new Map<number, string>()` (userId → blob URL). Перед запросом проверка `avatarCache.get(userId)`; при попадании возврат из кэша. После успешной загрузки blob: `avatarCache.set(userId, url)`. |
| Уникальный ключ по userId; повторные запросы используют кэш (URL объекта) | ✅ | Ключ — `userId` (number). При повторном вызове `useUserAvatar(userId)` первый шаг — проверка кэша, запрос не выполняется. |
| Если аватар уже загружен — без повторных запросов, доступен на всех страницах | ✅ | MyProfilePage после загрузки blob вызывает `setCachedAvatar(userId, objectUrl)`; при переходе на другие страницы HeaderPanel вызывает `useUserAvatar(avatarUserId)` и получает URL из кэша. |

**Файлы:** `hooks/useUserAvatar.ts` (avatarCache, setCachedAvatar, проверка кэша до запроса), `pages/MyProfilePage.tsx` (setCachedAvatar после loadAvatarBlob).

---

## 4. Отображение аватара в хедере

| Требование | Статус | Реализация |
|------------|--------|------------|
| Кэшированное изображение, если доступно, иначе загрузка через useUserAvatar | ✅ | В `HeaderPanel` порядок: `user.photo_url` → при isMyProfile: `avatarBlobUrl` (useUserAvatar) → `userInfo.avatarUrl` → `getAvatarUrl(userInfo.id, profilePhotoFileId, profilePhotos)`. Кэш используется через `useUserAvatar(avatarUserId)`. |
| При отсутствии фото или ошибке — fallback (инициалы или цветной плейсхолдер) | ✅ | Если `avatarUrl` пустой: рендер `header-panel__avatar--placeholder` с `getInitials(user.first_name, user.last_name)` и `getAvatarColor(...)` для фона. |

**Файлы:** `components/ui/HeaderPanel.tsx` (avatarUrl useMemo, fallback блок).

---

## 5. Минимизация запросов

| Требование | Статус | Реализация |
|------------|--------|------------|
| Минимальное количество запросов; если аватар загружен на одной странице (например MyProfilePage), URL в кэше и переиспользуется на других | ✅ | MyProfilePage после `getUserPhotoBlob` вызывает `setCachedAvatar(userId, objectUrl)`. HeaderPanel и любой другой компонент с `useUserAvatar(userId)` получают тот же URL из кэша без повторного GET /users/{id}/photo и без повторной загрузки blob. |

**Файлы:** `hooks/useUserAvatar.ts`, `pages/MyProfilePage.tsx` (setCachedAvatar).

---

## 6. Обновление баланса и профиля

| Требование | Статус | Реализация |
|------------|--------|------------|
| При обновлении баланса/профиля данные аватара не теряются и остаются в сторе; хедер продолжает показывать правильный аватар | ✅ | В `refreshMyProfile` (GeneratePage) при установке `setUserInfo(me)` без полей фото используется `preserveAvatarFromStore(me)`, поэтому существующие profilePhotoFileId/profilePhotos в сторе сохраняются. В `initializeCurrentUser` профиль всегда обогащается фото через `enrichUserInfoWithPhoto`. Blob URL дополнительно хранится в avatarCache и не зависит от стора. |

**Файлы:** `pages/GeneratePage.tsx` (preserveAvatarFromStore, refreshMyProfile), `store/useProfileStore.ts` (enrichUserInfoWithPhoto).

---

## Дополнительные улучшения (в рамках проверки)

- **useUserAvatar и profilePhotos:** если API вернул только `profilePhotos` без `profilePhotoFileId`, для загрузки blob используется `getOptimalAvatarFileId(photoData.profilePhotos)` из `avatarUtils`, чтобы не терять аватар при таком формате ответа.

---

## Итог

- Данные профиля загружаются с полями фото при инициализации и при обновлении; при обновлении без фото данные аватара в сторе сохраняются.
- Проверка «мой профиль» универсальна за счёт `getUserTelegramId` и учёта `currentUserId`.
- Аватары кэшируются по userId; повторные запросы не выполняются при наличии записи в кэше; кэш пополняется и со стороны MyProfilePage.
- В хедере используется кэш или загрузка через useUserAvatar, при отсутствии фото — инициалы и цветной плейсхолдер.
- Запросы минимизированы за счёт общего кэша и setCachedAvatar при загрузке на страницах.
- Обновление баланса и профиля не затирает данные аватара в сторе (preserveAvatarFromStore) и опирается на кэш blob.

Реализация соответствует описанным стандартам и лучшим практикам.
