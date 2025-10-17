# Telegram Mini App SDK

## Установка

SDK уже установлен в проекте: `@twa-dev/sdk`

## Использование

### Hook `useTelegram`

Основной хук для работы с Telegram Web App API:

```typescript
import { useTelegram } from '@/hooks/useTelegram';

function MyComponent() {
  const { tg, user, initData, isReady, isInTelegramApp, isMockMode } = useTelegram();
  
  // tg - экземпляр Telegram WebApp
  // user - данные пользователя Telegram
  // initData - строка инициализации для отправки на backend
  // isReady - готовность SDK
  // isInTelegramApp - запущено ли в Telegram
  // isMockMode - используется ли mock для разработки
}
```

### Режим разработки (Mock)

При запуске `npm run dev` вне Telegram автоматически активируется mock режим:

- **Mock пользователь**: Dev User (@devuser)
- **Mock initData**: Автоматически генерируется
- **Все методы API**: Логируются в консоль

**Преимущества mock режима:**
- ✅ Разработка без необходимости запускать в Telegram
- ✅ Быстрая итерация
- ✅ Тестирование UI/UX
- ✅ Полная эмуляция Telegram окружения

### Методы API

#### Основные методы

```typescript
// Уведомления
tg.showAlert('Сообщение');
tg.showConfirm('Подтвердить?');
tg.showPopup({ title: 'Заголовок', message: 'Текст' });

// Навигация
tg.close(); // Закрыть Mini App
tg.openLink('https://example.com'); // Открыть внешнюю ссылку
tg.openTelegramLink('https://t.me/...'); // Открыть Telegram ссылку

// MainButton (главная кнопка внизу)
tg.MainButton.setText('Продолжить');
tg.MainButton.show();
tg.MainButton.onClick(() => {
  console.log('Кнопка нажата');
});

// BackButton (кнопка назад)
tg.BackButton.show();
tg.BackButton.onClick(() => {
  // Обработка назад
});

// Haptic Feedback (вибрация)
tg.HapticFeedback.impactOccurred('medium');
tg.HapticFeedback.notificationOccurred('success');
```

#### Темизация

```typescript
// Темы применяются автоматически через CSS переменные
const { themeParams } = tg;

// Доступные CSS переменные:
// --tg-theme-bg-color
// --tg-theme-text-color
// --tg-theme-hint-color
// --tg-theme-button-color
// --tg-theme-button-text-color
// --tg-theme-secondary-bg-color
```

### Аутентификация

```typescript
const { initData } = useTelegram();

// Отправка initData на backend для аутентификации
const response = await fetch('/api/auth', {
  headers: {
    'X-Telegram-Init-Data': initData
  }
});
```

Backend должен валидировать `initData` используя bot token.

## Полезные ссылки

- [Документация Telegram Mini Apps](https://core.telegram.org/bots/webapps)
- [@twa-dev/sdk GitHub](https://github.com/twa-dev/sdk)
- [Примеры использования](https://github.com/twa-dev/sdk/tree/main/examples)

## Отладка

В dev режиме все взаимодействия с Telegram API логируются в консоль с эмодзи префиксами:
- 🔧 - Mock операции
- 🔍 - Информация о данных
- ⚠️ - Предупреждения
- ❌ - Ошибки
- ✅ - Успешные операции

