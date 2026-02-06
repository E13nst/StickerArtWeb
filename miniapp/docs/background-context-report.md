# Контекст проблемы: фон страниц (Dashboard vs MyProfilePage)

## Цель
Сделать вид контейнера на Dashboard таким же, как на MyProfilePage: один и тот же фон (SVG other-account-bg), без «другого» фона у `stixly-page-container` / области скролла.

---

## Дерево DOM и кто что рендерит

```
MainLayout (layouts/MainLayout.tsx)
└── div.stixly-main-layout
    ├── [опционально] HeaderPanel
    ├── div.stixly-main-scroll   ← КЛАСС ЗАВИСИТ ОТ pathname: + stixly-main-scroll--account только при pathname === '/profile'
    │   │                         (на Dashboard pathname === '/dashboard' → класса --account НЕТ)
    │   │   Стили для .stixly-main-scroll: в stixly-header.css (background-color, background-image: var(--other-account-bg-image))
    │   │
    │   └── div { position: relative; zIndex: 1 }   ← обёртка без фона
    │       └── {children}  ← сюда попадает страница (DashboardPage / MyProfilePage / …)
    │
    └── BottomNav
```

**Dashboard** (pathname `/dashboard`):

```
children =
  div.page-container.account-page.page-container-full-height.telegram-app
  ├── OtherAccountBackground   (position: absolute, z-index: 0, background-image: var(--other-account-bg-image))
  └── StixlyPageContainer → div.stixly-page-container.telegram-mode.page-container-padding-y.dashboard-container
      └── контент (статистика, пирамида, кнопки и т.д.)
```

**MyProfilePage** (pathname `/profile`):

```
children =
  div.page-container.account-page.telegram-app
  ├── OtherAccountBackground
  ├── div.head-account …
  └── StixlyPageContainer → div.stixly-page-container.telegram-mode.page-container-no-padding-top
      └── контент (табы, галерея и т.д.)
```

На Dashboard у скролла класс только `stixly-main-scroll` (без `stixly-main-scroll--account`), на профиле — `stixly-main-scroll stixly-main-scroll--account`.

---

## Стили, которые задают фон

### 1. common.css (подключается через DashboardPage.css @import и через MyProfilePage)

- **:root**  
  `--other-account-bg-image: url('/assets/other-account-bg.svg');`

- **.page-container**  
  `background-color: var(--color-background);`

- **.page-container-full-height**  
  `background-color: var(--color-background);`

- **.page-container.account-page** и **.page-container.account-page .stixly-page-container**  
  `background-color: transparent !important;`  
  → чтобы был виден общий фон (SVG), а не «сплошная подложка».

### 2. stixly-header.css (стили скролла и хедера)

- **.stixly-main-scroll**  
  `background-color: var(--color-background);`  
  `background-image: var(--other-account-bg-image, none);`  
  `background-size: cover;`  
  `background-position: center;`  
  `background-repeat: no-repeat;`  
  + flex, height, overflow.

- **.stixly-main-scroll--account** (только при pathname === '/profile')  
  `background-color: #191818;`  
  (в MyProfilePage.css)

- В этом же файле: **html, body**  
  `background-color: #0E0F1A;`  
  (глобальная подложка).

### 3. MyProfilePage.css (только для страницы профиля)

- **.account-page**  
  переменные (--account-surface, --account-text, …),  
  `color: var(--account-text);`  
  (прозрачность фона вынесена в common.css).

- **.account-page .stixly-page-container**  
  прозрачность задаётся в common.css.

### 4. StixlyPageContainer.css

- **.stixly-page-container**  
  только ширина, отступы, margin; **фона нет**.

### 5. DashboardPage.css

- Фона у контейнеров не задаёт; есть фон у блоков вроде `.dashboard-stats-section`, `.dashboard-quick-actions-background` и т.д.

---

## Задействованные страницы и элементы

| Элемент | Где задаётся класс | Где задаётся фон |
|--------|--------------------|-------------------|
| Область скролла | MainLayout: `stixly-main-scroll` + при pathname === '/profile' ещё `stixly-main-scroll--account` | stixly-header.css: .stixly-main-scroll (и .stixly-main-scroll--account в MyProfilePage.css) |
| Внешняя обёртка страницы | Dashboard: `page-container account-page page-container-full-height telegram-app`; MyProfile: `page-container account-page telegram-app` | common.css: .page-container (цвет), .page-container.account-page (transparent) |
| Декоративный фон страницы | Внутри каждой страницы первым ребёнком | OtherAccountBackground: background-image от --other-account-bg-image (OtherAccountBackground.css) |
| Внутренний контейнер контента | StixlyPageContainer: `stixly-page-container telegram-mode` + page-container-padding-y / page-container-no-padding-top + dashboard-container и т.д. | common.css: .page-container.account-page .stixly-page-container → transparent; StixlyPageContainer.css фона не задаёт |

---

## Возможные корни проблемы

1. **stixly-header.css не подключается**  
   В проекте нет `import` или `@import` для `stixly-header.css` (ни в main.tsx, ни в App.tsx, ни в index.css).  
   Тогда для **.stixly-main-scroll** не применяются ни фон (background-color, background-image с SVG), ни часть layout-свойств из этого файла. Визуально область скролла может выглядеть «другой» (например, как body или вообще без нашего фона).

2. **Разный набор классов у скролла**  
   На Dashboard: только `stixly-main-scroll`.  
   На профиле: `stixly-main-scroll stixly-main-scroll--account` (плюс в MyProfilePage.css переопределён background-color на #191818).  
   Если когда-нибудь stixly-header.css начнёт подключаться, на Dashboard и на профиле фон скролла уже сейчас задаётся по-разному (общий SVG + цвет vs #191818).

3. **Специфичность и порядок правил**  
   У .page-container есть `background-color` в common.css; потом .page-container.account-page и .page-container.account-page .stixly-page-container делают фон transparent. Если где-то ещё (например, в Telegram UI или в другом глобальном CSS) задаётся фон для контейнеров или для body, он может «пробиваться» при прозрачности и давать другой оттенок/вид на Dashboard.

4. **Фон body**  
   В index.css: `body { background-color: var(--tg-theme-bg-color, #ffffff); }`.  
   В stixly-header.css: `html, body { background-color: #0E0F1A; }`.  
   Если stixly-header.css не загружается, везде под прозрачными блоками будет body из index.css (часто светлый). Если когда-нибудь stixly-header.css подключить, глобальный фон сменится на тёмный — вид «под скроллом» изменится.

---

## Что проверить в первую очередь

1. **Подключён ли stixly-header.css**  
   Найти все места, где импортируется CSS (main.tsx, index.css, App.tsx, точки входа страниц). Если stixly-header.css нигде не импортируется — добавить импорт (например, в index.css или в MainLayout), чтобы стили .stixly-main-scroll (и при необходимости общий фон body) реально применялись.

2. **Один ли и тот же фон у скролла на всех страницах**  
   После подключения stixly-header.css решить: нужен ли отдельный .stixly-main-scroll--account только для /profile (как сейчас) или один общий фон (например, только .stixly-main-scroll с var(--color-background) и var(--other-account-bg-image)) для и Dashboard, и профиля, чтобы вид контейнера и области скролла совпадал.

3. **Нет ли переопределения фона у .stixly-page-container**  
   Убедиться, что ни в DashboardPage.css, ни в других стилях для .dashboard-container / .stixly-page-container не задаётся background, чтобы оставалось правило из common.css: .page-container.account-page .stixly-page-container { background-color: transparent !important; }.

---

## Кратко по файлам

- **MainLayout.tsx** — рендерит `stixly-main-scroll` и условно `stixly-main-scroll--account`; обёртку с z-index: 1; не рендерит PageBackground.
- **common.css** — :root (--other-account-bg-image), .page-container, .page-container-full-height, .page-container.account-page и .stixly-page-container (transparent).
- **stixly-header.css** — .stixly-main-scroll (фон с SVG), html/body #0E0F1A; файл нигде не импортируется.
- **MyProfilePage.css** — .stixly-main-scroll--account (#191818), .account-page (цвета/переменные).
- **DashboardPage** — классы account-page и page-container-full-height на внешнем div, внутри OtherAccountBackground и StixlyPageContainer с page-container-padding-y dashboard-container.
- **MyProfilePage** — те же page-container account-page, OtherAccountBackground, StixlyPageContainer с page-container-no-padding-top.

Итог: контекст проблемы — это согласованность фона между областью скролла (.stixly-main-scroll), внешней обёрткой страницы (.page-container.account-page) и внутренним контейнером (.stixly-page-container). Главный подозреваемый — отсутствие подключения stixly-header.css, из-за чего у .stixly-main-scroll вообще нет заданного фона и вид отличается от ожидаемого «как на MyProfilePage».
