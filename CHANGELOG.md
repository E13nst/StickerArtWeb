# Changelog - 31.10.2025

## Кэширование профилей
- **Файлы:** `useProfileStore.ts`, `ProfilePage.tsx`, `MyProfilePage.tsx`
- **Суть:** Добавлен in-memory кэш профилей (TTL 5 мин) для избежания повторных API запросов
- **Эффект:** Загрузка профиля после первого раза - мгновенная (10-50ms вместо 500-1000ms)

## Унификация галереи
- **Файлы:** `ProfilePage.tsx`, `MyProfilePage.tsx`
- **Суть:** Заменён `GalleryGrid` на `SimpleGallery` во всех профилях
- **Эффект:** Единый стиль + виртуализация + infinite scroll

## Timeout в галерее
- **Файлы:** `api/client.ts`, `GalleryPage.tsx`
- **Суть:** Увеличен timeout (10→30s), авторизация неблокирующая (фон)
- **Эффект:** Нет timeout ошибок в галерее

## Прозрачное меню навигации
- **Файлы:** `BottomNav.tsx`, `index.css`
- **Суть:** Полупрозрачный фон (70%) + backdrop-filter (blur 20px). Исключён из глобальных стилей MUI
- **Эффект:** Стеклянный эффект, контент виден через меню

## Скрипты запуска
- **Файлы:** `scripts/simple-start.ps1`, `simple-stop.ps1`, `simple-restart.ps1`
- **Суть:** Правильный запуск в miniapp/ с переменными окружения
- **Команды:** `npm start`, `npm stop`, `npm restart`

