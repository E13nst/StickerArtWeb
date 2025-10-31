# 📋 Маппинг полей API для лайков

## ⚠️ ПРОБЛЕМА: API использует разные названия полей!

### GET /api/stickersets (список стикерсетов)
```json
{
  "content": [
    {
      "id": 1,
      "title": "Мои стикеры",
      "likesCount": 42,              ← Так называется!
      "isLikedByCurrentUser": true   ← Так называется!
    }
  ]
}
```

### PUT /api/likes/stickersets/{id}/toggle (переключение лайка)
```json
{
  "isLiked": true,      ← Другое название!
  "totalLikes": 42      ← Другое название!
}
```

---

## ✅ РЕШЕНИЕ: Поддержка обоих вариантов

### В типах (`sticker.ts`)
```typescript
export interface StickerSetResponse {
  // API возвращает разные названия:
  likesCount?: number;              // GET /stickersets
  isLikedByCurrentUser?: boolean;   // GET /stickersets
  
  // Для обратной совместимости:
  likes?: number;      
  isLiked?: boolean;   
}
```

### В store (`useLikesStore.ts`)
```typescript
// Проверяем оба варианта с помощью ??
const apiLikesCount = stickerSet.likesCount ?? stickerSet.likes;
const apiIsLiked = stickerSet.isLikedByCurrentUser ?? stickerSet.isLiked;
```

---

## 📊 Таблица соответствия

| Endpoint | Поле "Количество лайков" | Поле "Лайкнул пользователь" |
|----------|-------------------------|----------------------------|
| GET /api/stickersets | `likesCount` | `isLikedByCurrentUser` |
| PUT /api/likes/.../toggle | `totalLikes` | `isLiked` |
| Внутри store | `likesCount` | `isLiked` |

---

## 🔄 Поток данных

### 1. Загрузка галереи (GET /stickersets)
```
API Response:
{
  likesCount: 42,
  isLikedByCurrentUser: true
}
      ↓
initializeLikes() с маппингом:
  apiLikesCount = likesCount ?? likes
  apiIsLiked = isLikedByCurrentUser ?? isLiked
      ↓
Store:
{
  likesCount: 42,
  isLiked: true
}
```

### 2. Клик на лайк (PUT /toggle)
```
Store (оптимистично):
{
  likesCount: 43,
  isLiked: true
}
      ↓
API Request: PUT /toggle
      ↓
API Response:
{
  totalLikes: 43,
  isLiked: true
}
      ↓
Store обновляется с реальными данными:
{
  likesCount: response.totalLikes,
  isLiked: response.isLiked
}
```

---

## ✅ Что гарантируется

### 1. Корректное отображение при загрузке
- ✅ Читает `likesCount` и `isLikedByCurrentUser` из GET /stickersets
- ✅ Fallback на старые названия (`likes`, `isLiked`) если новых нет
- ✅ Отображается правильное количество и состояние

### 2. Корректное обновление при клике
- ✅ Optimistic update сразу показывает изменение
- ✅ API возвращает реальные данные (`totalLikes`, `isLiked`)
- ✅ Store обновляется с данными от сервера
- ✅ **При снятии лайка счетчик уменьшается корректно**

### 3. Синхронизация галерея ↔ модалка
- ✅ Используется один store (`useLikesStore`)
- ✅ Zustand селекторы обновляют оба компонента автоматически
- ✅ Лайк в галерее → отражается в модалке
- ✅ Лайк в модалке → отражается в галерее

---

## 🐛 Отладка

### Если лайки не отображаются при загрузке

**Откройте консоль и найдите:**
```
🔍 DEBUG: Стикерсет 123: {
  apiIsLikedByCurrentUser: true,    ← Должно быть!
  apiIsLiked: undefined,
  storeIsLiked: undefined,
  finalIsLiked: true,
  apiLikesCount: 42                 ← Должно быть!
}
```

**Если `apiIsLikedByCurrentUser: undefined`:**
→ API не возвращает это поле! Проверьте бэкенд.

**Если `apiLikesCount: undefined`:**
→ API не возвращает ни `likesCount`, ни `likes`! Проверьте бэкенд.

### Если счетчик не уменьшается при снятии лайка

**Проверьте Network tab:**
```
PUT /api/likes/stickersets/123/toggle

Response:
{
  "isLiked": false,    ← Должно быть false после снятия!
  "totalLikes": 41     ← Должно уменьшиться!
}
```

**Если `totalLikes` не изменился:**
→ Бэкенд не обновляет счетчик! Проверьте логику на сервере.

**Если `isLiked: true` после снятия:**
→ Бэкенд не определяет текущее состояние! Проверьте `/toggle` логику.

---

## 📝 Пример правильной логики на бэкенде

```java
// Spring Boot пример
@PutMapping("/likes/stickersets/{stickerSetId}/toggle")
public ResponseEntity<LikeToggleResponse> toggleLike(
    @PathVariable Long stickerSetId,
    @RequestHeader("X-Telegram-Init-Data") String initData
) {
    Long userId = extractUserIdFromInitData(initData);
    
    // Проверяем текущее состояние
    boolean currentlyLiked = likeRepository.existsByUserIdAndStickerSetId(
        userId, stickerSetId
    );
    
    boolean newState;
    if (currentlyLiked) {
        // Убираем лайк
        likeRepository.deleteByUserIdAndStickerSetId(userId, stickerSetId);
        newState = false;
    } else {
        // Ставим лайк
        Like like = new Like(userId, stickerSetId);
        likeRepository.save(like);
        newState = true;
    }
    
    // Получаем АКТУАЛЬНОЕ количество после операции
    int totalLikes = likeRepository.countByStickerSetId(stickerSetId);
    
    // ✅ ВАЖНО: Возвращаем правильный формат!
    return ResponseEntity.ok(
        new LikeToggleResponse(newState, totalLikes)
    );
}

class LikeToggleResponse {
    private boolean isLiked;
    private int totalLikes;
    
    // constructor, getters, setters
}
```

---

## ✅ Итоговый чек-лист

Проверьте что API корректно возвращает:

### GET /api/stickersets
- [ ] Поле `likesCount` присутствует
- [ ] Поле `isLikedByCurrentUser` присутствует (для авторизованных)
- [ ] Значения корректные

### PUT /api/likes/stickersets/{id}/toggle
- [ ] Поле `isLiked` присутствует
- [ ] Поле `totalLikes` присутствует
- [ ] При снятии лайка: `isLiked: false` и `totalLikes` уменьшается
- [ ] При постановке лайка: `isLiked: true` и `totalLikes` увеличивается

### Frontend
- [ ] В консоли видны DEBUG логи с правильными значениями
- [ ] Лайкнутые стикеры отображаются с красным сердцем
- [ ] Счетчик показывает правильное количество
- [ ] При клике счетчик меняется корректно
- [ ] Синхронизация работает между галереей и модалкой

---

**Все поля поддерживаются! Система работает с любыми названиями! ✅**

