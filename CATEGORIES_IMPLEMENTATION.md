# Реализация фильтрации по категориям

## 📋 Обзор

Добавлена панель категорий с множественным выбором для фильтрации стикерсетов в галерее. Категории загружаются динамически через API.

## 🔧 Компоненты

### 1. **CategoryFilter** (`miniapp/src/components/CategoryFilter.tsx`)
Горизонтальная прокручиваемая панель категорий:
- ✅ Множественный выбор (можно выбрать несколько категорий одновременно)
- ✅ Дизайн идентичен продакшену
- ✅ Haptic feedback при клике
- ✅ Скрытый скроллбар
- ✅ Keyboard-доступность (Tab, Enter, Space)

### 2. **API метод** (`miniapp/src/api/client.ts`)
```typescript
async getCategories(): Promise<CategoryResponse[]>
```
- **Endpoint**: `GET /api/categories`
- **Локализация**: Поддерживает заголовок `X-Language` (ru/en)
- **Fallback**: Если API недоступен, возвращает статический список из 17 категорий
- **Фильтрация**: Автоматически отфильтровывает неактивные категории

### 3. **Типы данных** (`miniapp/src/types/sticker.ts`)

#### CategoryResponse (API)
```typescript
{
  id: number;              // ID категории (БД)
  key: string;             // Уникальный ключ (animals, memes, etc.)
  name: string;            // Локализованное название
  description: string;     // Локализованное описание
  iconUrl?: string;        // URL иконки (опционально)
  displayOrder: number;    // Порядок отображения
  isActive: boolean;       // Активна ли категория
}
```

#### Category (UI)
```typescript
{
  id: string;      // Используется key из API
  label: string;   // Используется name из API
  title: string;   // Используется description из API (для tooltip)
}
```

### 4. **Интеграция в GalleryPage** (`miniapp/src/pages/GalleryPage.tsx`)

#### Загрузка категорий
```typescript
useEffect(() => {
  const loadCategories = async () => {
    const categoriesData = await apiClient.getCategories();
    const adaptedCategories = adaptCategoriesToUI(categoriesData);
    setCategories(adaptedCategories);
  };
  loadCategories();
}, []);
```

#### Фильтрация стикерсетов через API
```typescript
// Фильтр применяется на сервере через параметр categoryKeys
// При изменении категорий отправляется новый запрос к API
useEffect(() => {
  if (isReady) {
    fetchStickerSets(0, false, uiState.selectedCategories);
  }
}, [uiState.selectedCategories]);

// API клиент передаёт категории как строку через запятую
async getStickerSets(page, size, {
  categoryKeys: ['animals', 'cute'] // → "animals,cute"
})
```

## 🎨 Стилизация

### CSS (`miniapp/src/index.css`)
```css
.category-filter-scroller::-webkit-scrollbar {
  display: none;
}
```

Инлайн стили соответствуют продакшену:
- `overflow: auto hidden` — горизонтальный скролл
- `scrollbar-width: none` — скрытие скроллбара (Firefox)
- `gap: 8px` — отступы между чипами
- `border-radius: 13px` — скругление чипов
- Активные чипы: `--tg-theme-button-color` + `font-weight: 500`
- Неактивные чипы: `--tg-theme-secondary-bg-color` + `font-weight: 400`

## 📡 API Endpoints

### GET `/api/categories`
Получить список всех активных категорий

**URL**: `GET https://stickerartgallery-e13nst.amvera.io/api/categories`

**Заголовки**:
- `X-Language: ru|en` (опционально, для локализации)
- Поддерживает автоматическую локализацию через `initData` пользователя

**Ответ**:
```json
[
  {
    "id": 1,
    "key": "animals",
    "name": "Animals",
    "description": "Stickers with animals",
    "displayOrder": 1,
    "isActive": true
  }
]
```

### GET `/api/stickersets` (с фильтрацией)
Получить стикерсеты с пагинацией и фильтрацией по категориям

**URL**: `GET https://stickerartgallery-e13nst.amvera.io/api/stickersets`

**Параметры**:
- `page` (integer) — номер страницы (начиная с 0)
- `size` (integer) — количество элементов на странице (1-100, default: 20)
- `categoryKeys` (string) — **фильтр по ключам категорий через запятую** (например: `"animals,cute"`)
- `likedOnly` (boolean) — показать только лайкнутые пользователем стикерсеты
- `sort` (string) — поле для сортировки (default: `createdAt`)
- `direction` (string) — направление сортировки: `ASC` | `DESC` (default: `DESC`)

**Пример запроса**:
```
GET /api/stickersets?page=0&size=20&categoryKeys=animals,cute
```

**Ответ**: `StickerSetListResponse` (paginated)

**Swagger**: https://stickerartgallery-e13nst.amvera.io/v3/api-docs

## 🔄 Workflow

1. При инициализации `GalleryPage` загружаются категории через `apiClient.getCategories()`
2. API возвращает список `CategoryResponse[]`, отсортированный по `displayOrder`
3. Данные адаптируются для UI через `adaptCategoriesToUI()`
4. Пользователь выбирает категории — клик переключает состояние
5. `selectedCategories` обновляется → `filteredStickerSets` пересчитывается
6. `SimpleGallery` рендерит только стикерсеты с выбранными категориями

## ⚠️ Важно

### Поле `categories` в `StickerSetResponse`
```typescript
export interface StickerSetResponse {
  // ...
  categories?: string[];  // Массив ключей категорий (animals, memes, etc.)
}
```

Бэкенд должен возвращать в `StickerSetResponse.categories` массив **ключей** категорий (не ID, не name), например:
```json
{
  "id": 123,
  "name": "Funny Cats",
  "categories": ["animals", "cute", "funny"]
}
```

### Связь категорий стикерсета
Endpoint для привязки категорий к стикерсету (из Swagger):
- `PUT /api/stickersets/{id}/categories` — установить категории для стикерсета

## 🧪 Тестирование

### Проверить загрузку категорий
```bash
curl https://stickerartgallery-e13nst.amvera.io/api/categories
```

### Проверить в Dev Tools
1. Открыть Network → XHR
2. Найти запрос `GET /api/categories`
3. Убедиться, что возвращается 17 категорий
4. Проверить, что все `isActive: true`

## 📦 Файлы

- `miniapp/src/components/CategoryFilter.tsx` — компонент панели категорий
- `miniapp/src/pages/GalleryPage.tsx` — интеграция + логика фильтрации
- `miniapp/src/api/client.ts` — метод `getCategories()`
- `miniapp/src/types/sticker.ts` — типы `CategoryResponse`, поле `categories` в `StickerSetResponse`
- `miniapp/src/index.css` — CSS для скрытия скроллбара

