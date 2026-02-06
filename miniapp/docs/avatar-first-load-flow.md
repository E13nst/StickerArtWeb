# Как подтягивается аватар при первом запуске мини-аппа

Пошаговое описание от загрузки приложения до появления аватара в хедере на любой странице (в т.ч. отличия от GeneratePage).

---

## Исходные условия

- Мини-апп открыт **впервые** (холодный старт) или после полной перезагрузки.
- Открыта **любая страница**, где рендерится хедер: Dashboard, Gallery, Generate, Swipe и т.д.  
  (HeaderPanel **не** рендерится на `/profile` и `/author/:id` — там `hideHeaderPanel === true`.)

---

## Фаза 1: Загрузка приложения и Telegram

1. **Монтируется `App`**
   - Подключаются провайдеры (Router, TonConnect, и т.д.), рендерятся `Routes` и `MainLayout`.

2. **`useTelegram()`**
   - Внутри асинхронная инициализация: чтение `window.Telegram?.WebApp`, парсинг `initData`, установка `user`, вызов `ready()`, подписка на `viewportChanged` (iOS) и т.д.
   - Пока не выполнены условия, `isReady = isBaseReady && isViewportReady` остаётся `false`.

3. **`MainLayout`**
   - Читает `isReady` из `useTelegram()`.
   - Пока `!isReady`: рендерит только спиннер «Инициализация...», **HeaderPanel и контент страницы не монтируются**.

4. **Когда `isReady` становится `true`**
   - В `useTelegram()` уже установлены: `user`, `initData`, `tg`.
   - MainLayout переходит к рендеру контента: `HeaderPanel` + `children` (страница).

Итог фазы 1: пользователь видит интерфейс (в т.ч. хедер) только после того, как Telegram готов и есть `user` и `initData`. До этого аватар в принципе не показывается.

---

## Фаза 2: Запуск загрузки профиля «меня»

5. **`App` — `useEffect(initData, user?.id, hasMyProfileLoaded)`**
   - Срабатывает при первом рендере с `isReady === true` (т.к. от `App` зависят те же `initData`, `user`).
   - Условие: `if (!initData || hasMyProfileLoaded) return;`
   - Если `initData` есть и профиль ещё не загружали: вызывается  
     `initializeCurrentUser(user?.id ?? null)` (без `await`).

6. **`initializeCurrentUser` (store) — выполняется асинхронно**
   - Сразу: `set(isMyProfileLoading: true)`, проверка `hasMyProfileLoaded`/`isMyProfileLoading` (вход один раз).
   - Далее цепочка запросов:
     - `me = await apiClient.getMyProfile()`  // GET `/api/profiles/me`
     - При успехе: `nextUserId = resolveCandidateId(me.userId)`, `set(currentUserId, currentUserRole)`.
     - Затем либо `getProfile(me.userId)` + `enrichUserInfoWithPhoto(profile)`, либо только `enrichUserInfoWithPhoto(me)`.
     - `enrichUserInfoWithPhoto`: `await apiClient.getUserPhoto(profile.id)`  // GET `/api/users/{id}/photo`, добавление `profilePhotoFileId`, `profilePhotos` в объект профиля.
     - В конце: `set(userInfo: userInfoWithPhoto, currentUserId, currentUserRole)` (или fallback в `catch` с `getProfile(fallbackId)` и тем же `enrichUserInfoWithPhoto`).
   - В `finally`: `set(hasMyProfileLoaded: true, isMyProfileLoading: false)`.

Важно: между шагом 5 и завершением шага 6 проходит время (2–3 последовательных запроса к API). До завершения `initializeCurrentUser` в сторе **нет** актуального `userInfo` с полями фото.

---

## Фаза 3: Первый рендер HeaderPanel (до прихода профиля)

7. **Первый рендер `HeaderPanel` после `isReady`**
   - Уже есть: `user` из `useTelegram()` (и при необходимости `user.photo_url`).
   - Из стора: `userInfo = null`, `currentUserId = null` (или старые значения до первого успешного `initializeCurrentUser`).

8. **Вычисление «мой профиль» и источника аватара**
   - `isMyProfile = user && userInfo && (user.id === getUserTelegramId(userInfo) || userInfo.id === currentUserId)`  
     → при `userInfo === null` получается **false**.
   - `avatarUserId = isMyProfile ? (currentUserId ?? userInfo?.id) : undefined` → **undefined**.
   - `useUserAvatar(undefined)` ничего не грузит, возвращает `avatarBlobUrl = null`.

9. **Выбор `avatarUrl`**
   - `user.photo_url` — если Telegram отдал фото, оно показывается.
   - Иначе: при `!isMyProfile || !userInfo` ветка с API/blob не используется → **undefined**.
   - Итог: показывается либо `user.photo_url`, либо плейсхолдер (инициалы + цвет).

На этом этапе аватар из **нашего бэкенда** (profilePhotoFileId/profilePhotos) ещё не может отобразиться: профиль в сторе либо пустой, либо не считается «моим».

---

## Фаза 4: После завершения initializeCurrentUser

10. **Store обновлён**
    - `userInfo` = объект с `id`, `telegramId`, `profilePhotoFileId`, `profilePhotos` (если API их вернул), `artBalance` и т.д.
    - `currentUserId` = id текущего пользователя (из `me` или fallback).

11. **HeaderPanel перерисовывается**
    - `userInfo` и `currentUserId` уже есть.
    - Проверка «мой профиль»: `getUserTelegramId(userInfo)` и `userInfo.id === currentUserId` — при корректных данных **isMyProfile = true**.
    - `avatarUserId = currentUserId ?? userInfo?.id` — задаётся.

12. **Источники аватара по приоритету**
    - `user.photo_url` — если есть, им и пользуемся.
    - Иначе при `isMyProfile && userInfo`:
      - `avatarBlobUrl` из `useUserAvatar(avatarUserId)` — пока грузится, может быть ещё `null`.
      - `userInfo.avatarUrl` — если вдруг записан (например, с других страниц).
      - **`getAvatarUrl(userInfo.id, userInfo.profilePhotoFileId, userInfo.profilePhotos, 96)`** — даёт URL картинки по уже сохранённым в сторе полям (без дополнительного запроса за blob).

Если `enrichUserInfoWithPhoto` отработал и в `userInfo` есть `profilePhotoFileId` или `profilePhotos`, то **аватар может появиться сразу по URL из getAvatarUrl**, не дожидаясь blob из `useUserAvatar`.  
Параллельно `useUserAvatar(avatarUserId)` делает свой запрос (getUserPhoto + blob), кладёт результат в кэш и при следующем рендере может подставить `avatarBlobUrl` (если он будет выше в приоритете или единственным).

Итог: после успешного `initializeCurrentUser` и при совпадении «мой профиль» аватар на всех страницах с хедером должен подтягиваться либо из `user.photo_url`, либо из `getAvatarUrl(...)`, либо из blob-кэша.

---

## Фаза 5: Почему на GeneratePage аватар «есть», а на остальных — может не быть

13. **GeneratePage при монтировании**
    - В `useEffect` вызывается **`refreshMyProfile()`**:
      - `getMyProfile()` → `getUserPhoto(me.id)` → `setUserInfo(me + profilePhotoFileId/profilePhotos)` (или `preserveAvatarFromStore(me)`).
    - То есть **на этой странице профиль и фото принудительно обновляются** при каждом заходе.

14. **Остальные страницы (Dashboard, Gallery и т.д.)**
    - Ничего дополнительно не вызывают; полагаются только на **один раз** выполненный в `App` **`initializeCurrentUser`**.
    - Если при первом запуске:
      - `initializeCurrentUser` ещё не завершился → хедер рисуется с `userInfo = null` → только `user.photo_url` или плейсхолдер.
      - `getMyProfile()` или `getUserPhoto()` упали/вернули пустое → в сторе нет `profilePhotoFileId`/`profilePhotos` → `getAvatarUrl` не даёт URL → аватар только из blob или плейсхолдер.
      - Не совпали id (например, fallback с Telegram id вместо backend id) → `isMyProfile` может остаться false → аватар из API не показывается.

На GeneratePage за счёт своего `refreshMyProfile()` стор повторно заполняется актуальным «мной» и полями фото, поэтому аватар там часто уже есть даже если при первом запуске на другой странице что-то пошло не так.

---

## Сводная временная шкала (первый запуск, например Dashboard)

| Момент | useTelegram | Store (userInfo, currentUserId) | HeaderPanel |
|--------|-------------|----------------------------------|-------------|
| До isReady | user/initData могут быть ещё не готовы | Не используется (layout не смонтирован) | Не рендерится |
| isReady = true | user, initData есть | userInfo = null, currentUserId = null | Первый рендер: isMyProfile = false → только user.photo_url или плейсхолдер |
| App useEffect | — | Вызов initializeCurrentUser(user?.id) | Без изменений |
| Идёт getMyProfile / getProfile / getUserPhoto | — | userInfo всё ещё null | Без изменений |
| initializeCurrentUser завершён | — | userInfo + profilePhotoFileId/profilePhotos, currentUserId | Re-render: isMyProfile = true, avatarUrl = getAvatarUrl(...) или blob → аватар появляется |
| useUserAvatar(avatarUserId) получил blob | — | — | При следующем рендере можно показать blob (или уже показан URL из getAvatarUrl) |

---

## Где может «ломаться» отображение на всех страницах кроме GeneratePage

1. **Профиль в сторе не успел подгрузиться**  
   Пользователь успел увидеть первый кадр с плейсхолдером и решил, что «аватар не подтягивается». Решение: дождаться завершения `initializeCurrentUser` или показывать скелетон/состояние загрузки в хедере.

2. **getMyProfile() или getUserPhoto() падают / возвращают пустое**  
   В `userInfo` нет `profilePhotoFileId`/`profilePhotos` → `getAvatarUrl` не даёт URL. Остаётся только blob из `useUserAvatar` или плейсхолдер. Нужны логи/обработка ошибок и при необходимости повтор запроса или fallback.

3. **Не совпадают id («мой профиль» не определяется)**  
   Например, при fallback вызывается `getProfile(fallbackId)` с Telegram id, а бэкенд ожидает свой id; в сторе оказывается «чужой» профиль или несовпадение `userInfo.id` и `currentUserId` → `isMyProfile = false` → аватар из API не показывается. Нужна согласованность формата id (Telegram vs backend) и, при необходимости, маппинг в одном месте (как в `getUserTelegramId`).

4. **HeaderPanel скрыт на части маршрутов**  
   На `/profile` и `/author/:id` хедер не рендерится — там аватар в хедере по определению не показывается.

5. **На GeneratePage аватар есть, потому что там свой refresh**  
   `refreshMyProfile()` при монтировании заново ставит в стор «меня» с фото; на остальных страницах такого повторного обновления нет — они зависят только от одного вызова `initializeCurrentUser` при первом запуске.

---

## Рекомендации для стабильного аватара на всех страницах

- Убедиться, что **при первом запуске** `initializeCurrentUser` действительно вызывается (есть `initData` и `user?.id`) и что запросы `getMyProfile` и `getUserPhoto` не падают и возвращают поля фото там, где они есть.
- Рассмотреть **индикатор загрузки профиля** в хедере (например, по `isMyProfileLoading` или по отсутствию `userInfo` при наличии `user`), чтобы не воспринимать краткий плейсхолдер как «аватар не подтягивается».
- На страницах, где критично иметь актуальный профиль и аватар (не только GeneratePage), при необходимости вызывать **тот же refreshMyProfile (или аналог)** при монтировании, чтобы повторно подтянуть «меня» и фото в стор и синхронизировать с хедером.

Если нужно, можно отдельно расписать только цепочку для GeneratePage или только сценарии ошибок (getMyProfile/ getUserPhoto fail, id mismatch) с конкретными местами в коде и логами.
