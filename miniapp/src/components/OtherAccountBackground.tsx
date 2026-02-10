import './OtherAccountBackground.css';

/**
 * Фон страниц: отображает динамический градиент из CSS-переменной --page-dynamic-gradient
 * поверх базового цвета (--page-bg-base). Переменная задаётся в CSS-модуле каждой страницы.
 */
export function OtherAccountBackground() {
  return <div className="other-account-background" aria-hidden />;
}
