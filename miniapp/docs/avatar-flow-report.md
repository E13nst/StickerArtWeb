# Как подтягивается аватарка пользователя (хедер и страницы)

Один блок — полная цепочка от первого запуска до отображения. По этому отчёту можно искать причину, почему показывается «DU» или не обновляется фото.

---

## 1. Первый запуск приложения

```
App.tsx (mount)
  → useEffect(initData, user?.id, hasMyProfileLoaded)
  → если initData есть и !hasMyProfileLoaded:
      initializeCurrentUser(user?.id ?? null)

useProfileStore.initializeCurrentUser(fallbackUserId)
  → если isMyProfileLoading || hasMyProfileLoaded → return (один раз)
  → set(isMyProfileLoading: true)
  → me = apiClient.getMyProfile()  // GET /api/profiles/me
  → при успехе:
      nextUserId = resolveCandidateId(me.userId)  // me.userId из ответа API
      set(currentUserId: nextUserId, currentUserRole)
      needsFullProfile = !userInfo || userInfo.id !== me.userId
      если needsFullProfile: profile = apiClient.getProfile(me.userId)
                             set(userInfo: profile, currentUserId, currentUserRole)
  → при ошибке:
      fallbackId = resolveCandidateId(fallbackUserId)  // user?.id (Telegram id, в dev может быть 777000)
      profile = apiClient.getProfile(fallbackId)
      set(userInfo: profile, currentUserId: profile.telegramId ?? profile.id ?? fallbackId, ...)
  → finally: set(hasMyProfileLoaded: true, isMyProfileLoading: false)

apiClient.mapProfileToUserInfo(data)
  → id: data.userId, telegramId: data.userId  // оба из API userId (может быть внутренний id!)
  → avatarUrl: undefined
  → profilePhotoFileId, profilePhotos не задаются (только в getMyProfile + getUserPhoto на MyProfilePage)
```

Итог первого запуска: в сторе есть `userInfo` (полный профиль «меня» или fallback 777000) и `currentUserId`. Поля аватара в `userInfo`: `avatarUrl` всегда `undefined` из маппера, `profilePhotoFileId` / `profilePhotos` не заполняются в `initializeCurrentUser` — только на MyProfilePage.

---

## 2. HeaderPanel — откуда берётся аватар

```
HeaderPanel
  user = useTelegram().user                    // user.id = Telegram id, user.photo_url опционально
  userInfo, currentUserId = useProfileStore()

  isMyProfile = user && userInfo && (
    userInfo.telegramId === user.id ||         // совпадение по Telegram id
    (currentUserId != null && userInfo.id === currentUserId)  // или «я» по id из стора
  )
  avatarUserId = isMyProfile ? (currentUserId ?? userInfo?.id) : undefined
  avatarBlobUrl = useUserAvatar(avatarUserId)  // запрос только если avatarUserId задан

  avatarUrl (приоритет):
    1) user.photo_url                          // Telegram WebApp
    2) если !isMyProfile || !userInfo → undefined
    3) avatarBlobUrl                           // blob из useUserAvatar
    4) userInfo.avatarUrl ?? getAvatarUrl(userInfo.id, userInfo.profilePhotoFileId, userInfo.profilePhotos, 96)

  Если avatarUrl пустой → плейсхолдер: инициалы + getAvatarColor (класс header-panel__avatar--placeholder).
```

Важно: аватар из API (blob или URL) показывается только когда `isMyProfile === true`. Если бэкенд отдаёт внутренний `userId`, а не Telegram id, то `userInfo.telegramId === user.id` может быть false; тогда решает вторая часть: `userInfo.id === currentUserId`.

---

## 3. useUserAvatar(userId) — загрузка blob для хедера

```
useUserAvatar(userId)
  → если !userId: avatarBlobUrl = null, return
  → если avatarCache.get(userId) есть: setAvatarBlobUrl(cached), return
  → photoData = apiClient.getUserPhoto(userId)   // GET /api/users/{userId}/photo
  → если !photoData?.profilePhotoFileId: setAvatarBlobUrl(null), return
  → blob = apiClient.getUserPhotoBlob(userId, photoData.profilePhotoFileId)
  → url = URL.createObjectURL(blob), avatarCache.set(userId, url), setAvatarBlobUrl(url)
```

Кэш общий (avatarCache — модульная переменная). `userId` здесь — тот, что передаёт HeaderPanel: `currentUserId ?? userInfo?.id` при `isMyProfile`. Должен совпадать с тем, что ожидает API `/users/{userId}/photo` (обычно внутренний id пользователя).

---

## 4. MyProfilePage — профиль «меня» и аватар

```
MyProfilePage (mount / инициализация)
  → loadUserInfo()
    → userProfile = apiClient.getMyProfile()    // GET /api/profiles/me
    → photo = apiClient.getUserPhoto(userProfile.id)  // GET /api/users/{id}/photo
    → combined = { ...userProfile, profilePhotoFileId: photo?...., profilePhotos: photo?...., avatarUrl: ... }
    → setUserInfo(combined)                     // в сторе появляются profilePhotoFileId, profilePhotos
    → если есть fileId/profilePhotos: loadAvatarBlob(userProfile.id, ...)
       loadAvatarBlob → apiClient.getUserPhotoBlob → setAvatarBlobUrl (локальный state MyProfilePage!)
```

На MyProfilePage свой `avatarBlobUrl` в локальном state; в сторе лежит только `userInfo` с `profilePhotoFileId` и `profilePhotos`. Хедер не использует локальный blob MyProfilePage — он опирается на свой `useUserAvatar(avatarUserId)` и на `userInfo.avatarUrl` / `getAvatarUrl(userInfo.id, profilePhotoFileId, profilePhotos)`.

После loadUserInfo в сторе: `userInfo` с `id`, `telegramId`, `profilePhotoFileId`, `profilePhotos`. Тогда в HeaderPanel: `isMyProfile` может стать true (если совпадает по telegramId или по userInfo.id === currentUserId), `avatarUserId` задаётся, useUserAvatar подгружает blob и/или getAvatarUrl даёт URL.

---

## 5. GeneratePage — обновление профиля «меня»

```
GeneratePage (mount)
  → refreshMyProfile()
    → me = apiClient.getMyProfile()
    → setArtBalance(me.artBalance)
    → setUserInfo(me)                          // полная замена userInfo на «меня»

После успешной генерации (COMPLETED):
  → refreshMyProfile()                        // снова getMyProfile + setUserInfo(me)
```

Важно: `getMyProfile()` возвращает объект из `mapProfileToUserInfo` — без `profilePhotoFileId` и `profilePhotos`. Поэтому после refreshMyProfile в сторе только «базовый» профиль; если до этого на MyProfilePage в userInfo были photo-поля, они перезатираются объектом без фото. Хедер тогда может снова не иметь данных для аватара из API (только user.photo_url или плейсхолдер), если не успел/не смог взять blob через useUserAvatar.

---

## 6. Точки отказа (почему «DU» или нет фото)

| Условие | Результат |
|--------|------------|
| `user` null | HeaderPanel return null, аватар не рендерится. |
| `user.photo_url` нет (mock/ограничения Telegram) | Переходим к API/blob. |
| `initializeCurrentUser` ещё не выполнился или упал | userInfo/currentUserId пустые или fallback 777000 → isMyProfile может быть false → avatarUserId undefined → useUserAvatar не вызывается с «собственным» id → нет blob. |
| Бэкенд отдаёт внутренний id в `userId`, а не Telegram id | userInfo.telegramId !== user.id; если при этом currentUserId и userInfo.id не совпали (например, не вызывался setUserInfo(me)), isMyProfile остаётся false → аватар из API не показывается. |
| getMyProfile() возвращает объект без profilePhotoFileId/profilePhotos | В сторе userInfo без полей для getAvatarUrl; аватар только из useUserAvatar(avatarUserId). Если avatarUserId при этом не задан (isMyProfile false) — только плейсхолдер. |
| useUserAvatar(avatarUserId): getUserPhoto(userId) 404 или без profilePhotoFileId | avatarBlobUrl остаётся null; в хедере сработает только getAvatarUrl(userInfo.id, ...), если в userInfo уже есть profilePhotoFileId/profilePhotos (например, после MyProfilePage). |
| GeneratePage вызывает setUserInfo(me) с объектом из getMyProfile | userInfo перезаписывается без profilePhotoFileId/profilePhotos → getAvatarUrl в хедере нечем пользоваться; остаётся надежда на useUserAvatar и кэш blob по userId. |
| MyProfilePage не открывали | В сторе ни разу не было userInfo с profilePhotoFileId/profilePhotos из loadUserInfo; единственный источник аватара в хедере — useUserAvatar(avatarUserId), и только если isMyProfile и avatarUserId заданы. |

---

## 7. Краткая схема по приоритету аватара в хедере

```
1. user.photo_url (Telegram)
2. isMyProfile? → avatarBlobUrl (useUserAvatar) или userInfo.avatarUrl / getAvatarUrl(...)
3. Иначе → плейсхолдер (инициалы + цвет)
```

«Мой» профиль: `userInfo.telegramId === user.id` ИЛИ `userInfo.id === currentUserId`. Для отображения фото из API нужны либо успешный useUserAvatar(avatarUserId), либо в userInfo заполнены profilePhotoFileId/profilePhotos (сейчас это делается только на MyProfilePage в loadUserInfo).
