# AI Agent Context

## Архитектура проекта
- **Frontend:** React + TypeScript + Vite (miniapp/)
- **Backend API:** https://stickerartgallery-e13nst.amvera.io
- **Dev server:** Port 3000, запуск из miniapp/

## Ключевые решения

### Кэширование (useProfileStore)
```typescript
profileCache: Map<userId, { userInfo, stickerSets, pagination, timestamp }>
cacheTTL: 5 * 60 * 1000 // 5 минут
```
См. `PROFILE_CACHE_IMPLEMENTATION.md`

### Галерея
- `SimpleGallery` везде (виртуализация + infinite scroll)
- `GalleryGrid` не используется активно

### Стили
- `index.css` - глобальные стили MUI
- Исключения через `:not(.class)` для специальных компонентов
- Telegram CSS переменные: `--tg-theme-*-color`

## Команды
```bash
npm start    # Запуск (miniapp/ + env)
npm restart  # Перезапуск
npm stop     # Остановка
```

## Изменения за сессию
См. `CHANGELOG.md`




















