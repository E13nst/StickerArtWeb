# Правила размещения шапки (Header) на страницах

## Единый header приложения

**Header Panel** (`@/components/ui/HeaderPanel`) — единственная шапка приложения:
- аватар пользователя (Telegram),
- баланс ART,
- кнопка пополнения (+),
- кнопка TON Connect.

Компонент **Stixly Top Header** удалён; везде используется только Header Panel.

---

## Правило 1: кто рендерит header

- **MainLayout** рендерит **Header Panel** один раз вверху (перед областью прокрутки).
- На страницах **не** рендерить свой Header Panel — он уже есть в layout.

---

## Правило 2: расположение и стили

- **Ширина**: на всю ширину устройства (`width: 100%`).
- **Центрирование**: контент (аватар, баланс, кошелёк) в центре; внутренний блок с `max-width: 402px` по центру.
- **Высота**: задаётся токеном `--component-header-panel-height` (80px — одна строка + отступы).
- Нижние скругления: `border-radius: 0 0 16px 16px`.

---

## Правило 3: панель контролов под header

Если на странице есть **фиксированная панель контролов** (например `CompactControlsBar` с `variant="fixed"`), отступ сверху задаётся переменной `--compact-controls-bar-top`. По умолчанию используется `--stixly-header-height`, который равен `--component-header-panel-height`. При необходимости переопределить в CSS страницы, например: `.gallery-page .compact-controls-bar--fixed { --compact-controls-bar-top: var(--component-header-panel-height); }`.

---

## Переменные и токены

- `--component-header-panel-height` — высота Header Panel (80px).
- `--stixly-header-height` — для совместимости равен `--component-header-panel-height` (отступ под панели контролов).
- `--compact-controls-bar-top` — отступ сверху для фиксированной Compact Controls Bar (по умолчанию `--stixly-header-height`).
