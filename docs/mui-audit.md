# Анализ использования Material-UI в проекте

## Статистика
- **Всего файлов с MUI-импортами**: 47+
- **Компоненты из `@mui/material`**: 35+
- **Иконки из `@mui/icons-material`**: 30+

## Top-10 самых используемых компонентов

| Компонент | Количество файлов | Основные файлы |
|-----------|-------------------|----------------|
| **Box** | 47 | GeneratePage.tsx, ProfilePage.tsx, MyProfilePage.tsx, DashboardPage.tsx, и др. |
| **Typography** | 31 | GeneratePage.tsx, ProfilePage.tsx, MyProfilePage.tsx, DashboardPage.tsx, и др. |
| **Button** | 19 | GeneratePage.tsx, MyProfilePage.tsx, DashboardPage.tsx, и др. |
| **Card** | 11 | ProfilePage.tsx, MyProfilePage.tsx, DashboardPage.tsx, и др. |
| **Chip** | 12 | MyProfilePage.tsx, TopUsers.tsx, TopAuthors.tsx, и др. |
| **IconButton** | 12 | StickerSetDetail.tsx, UploadStickerPackModal.tsx, и др. |
| **TextField** | 8 | GeneratePage.tsx, UploadStickerPackModal.tsx, SearchBar.tsx, и др. |
| **Dialog** | 5 | StickerSetActions.tsx, DonateModal.tsx, CategoriesDialog.tsx, и др. |
| **CircularProgress** | 11 | GeneratePage.tsx, StickerSetDetail.tsx, UploadStickerPackModal.tsx, и др. |
| **Alert** | 8 | ProfilePage.tsx, MyProfilePage.tsx, AuthorPage.tsx, и др. |

## Дополнительные компоненты

| Компонент | Количество файлов |
|-----------|-------------------|
| Avatar | 7 |
| CardContent | 11 |
| Grid | 1 |
| Paper | 1 |
| Checkbox | 1 |
| FormControlLabel | 1 |
| Skeleton | 1 |
| Tooltip | 3 |
| Popover | 1 |
| Drawer | 1 |
| Divider | 1 |
| Tabs | 2 |
| Tab | 2 |
| Container | 1 |
| List | 1 |
| ListItem | 1 |
| Snackbar | 1 |
| InputAdornment | 1 |
| BottomNavigation | 1 |
| BottomNavigationAction | 1 |
| Menu | 1 |
| MenuItem | 1 |
| useTheme | 3 |
| useMediaQuery | 3 |

## Иконки из @mui/icons-material (Top-10)

| Иконка | Количество файлов |
|--------|-------------------|
| CloseIcon | 9 |
| AddIcon | 3 |
| SearchIcon | 3 |
| CollectionsIcon | 3 |
| AccountBalanceWalletIcon | 3 |
| KeyboardArrowDownIcon | 3 |
| CheckIcon | 2 |
| FavoriteIcon | 2 |
| AutoAwesomeIcon | 2 |
| TelegramIcon | 2 |

## Полный список файлов с MUI-импортами

1. `miniapp/src/pages/GeneratePage.tsx`
2. `miniapp/src/pages/ProfilePage.tsx`
3. `miniapp/src/pages/MyProfilePage.tsx`
4. `miniapp/src/pages/DashboardPage.tsx`
5. `miniapp/src/pages/AuthorPage.tsx`
6. `miniapp/src/pages/GalleryNewPage.tsx`
7. `miniapp/src/components/TopUsers.tsx`
8. `miniapp/src/components/TopAuthors.tsx`
9. `miniapp/src/components/BottomNav.tsx`
10. `miniapp/src/components/Frame76Default.tsx`
11. `miniapp/src/components/StylePresetDropdown.tsx`
12. `miniapp/src/components/StickerSetDetail.tsx`
13. `miniapp/src/components/UploadStickerPackModal.tsx`
14. `miniapp/src/components/StickerSetActions.tsx`
15. `miniapp/src/components/AuthorsLeaderboardModal.tsx`
16. `miniapp/src/components/DonateModal.tsx`
17. `miniapp/src/components/StickerSetDetail/StickerPreview.tsx`
18. `miniapp/src/components/StickerSetDetail/StickerSetDetailEdit.tsx`
19. `miniapp/src/components/StickerSetDetail/StickerSetActionsBar.tsx`
20. `miniapp/src/components/StickerSetDetail/CategoriesDialog.tsx`
21. `miniapp/src/components/StickerSetDetail/BlockDialog.tsx`
22. `miniapp/src/components/DateFilterDropdown.tsx`
23. `miniapp/src/components/GalleryControlsBar.tsx`
24. `miniapp/src/components/LeaderboardModal.tsx`
25. `miniapp/src/components/SortDropdown.tsx`
26. `miniapp/src/components/StickerTypeDropdown.tsx`
27. `miniapp/src/components/CompactControlsBar.tsx`
28. `miniapp/src/components/ModalBackdrop.tsx`
29. `miniapp/src/components/AnimatedSticker.tsx`
30. `miniapp/src/components/StickerSetsTabs.tsx`
31. `miniapp/src/components/layout/StixlyPageContainer.tsx`
32. `miniapp/src/components/ProfileTabs.tsx`
33. `miniapp/src/components/StickerTypeFilter.tsx`
34. `miniapp/src/components/FilterModal.tsx`
35. `miniapp/src/components/AddStickerPackButton.tsx`
36. `miniapp/src/components/SearchBar.tsx`
37. `miniapp/src/components/TelegramAuthModal.tsx`
38. `miniapp/src/components/TopStickersCarousel.tsx`
39. `miniapp/src/components/UserInfo.tsx`
40. `miniapp/src/components/UserInfoCardModern.tsx`
41. `miniapp/src/components/ProfileHeader.tsx`
42. `miniapp/src/components/UserInfoCard.tsx`
43. `miniapp/src/components/TxLitTopHeader.tsx`
44. `miniapp/src/components/FloatingAvatar.tsx`
45. `miniapp/src/components/TopCategories.tsx`
46. `miniapp/src/components/MetricCard.tsx`
47. `miniapp/src/components/AuthStatus.tsx`
48. `miniapp/src/components/TelegramAuthButton.tsx`
49. `miniapp/src/components/LazyImage.tsx`
50. `miniapp/src/components/StixlyTopHeader.tsx`
51. `miniapp/src/hooks/useStickerFeed.tsx`

## Рекомендации по замене компонентов

### Сложные для замены (высокий приоритет)

#### 1. Box — используется в 47 файлах
- **Замена**: нативный `<div>` с CSS-in-JS или styled-components
- **Сложность**: средняя (нужна миграция стилей)
- **Приоритет**: 🔴 Высокий

#### 2. Typography — используется в 31 файле
- **Замена**: нативные `<h1>`, `<h2>`, `<p>`, `<span>` с CSS + кастомный компонент `<Text />`
- **Сложность**: средняя (нужна миграция стилей)
- **Приоритет**: 🔴 Высокий

#### 3. Dialog — используется в 5 файлах
- **Замена**: кастомные модальные компоненты или библиотеки (Radix UI, Headless UI)
- **Сложность**: высокая (нужна реализация accessibility)
- **Приоритет**: 🟡 Средний

#### 4. BottomNavigation — используется в 1 файле
- **Замена**: кастомный компонент `<Navbar />`
- **Сложность**: низкая
- **Приоритет**: 🟢 Низкий

### Средние по сложности

#### 5. Button — используется в 19 файлах
- **Замена**: кастомный компонент `<Button />` или библиотека (Radix UI)
- **Сложность**: средняя
- **Приоритет**: 🔴 Высокий

#### 6. TextField — используется в 8 файлах
- **Замена**: нативный `<input>` с оберткой или библиотека (Radix UI)
- **Сложность**: средняя
- **Приоритет**: 🟡 Средний

#### 7. CircularProgress — используется в 11 файлах
- **Замена**: кастомный спиннер или библиотека (react-spinners)
- **Сложность**: низкая
- **Приоритет**: 🟢 Низкий

### Простые для замены

#### 8. Card/CardContent — используется в 11 файлах
- **Замена**: кастомный компонент `<StickerCard />` с CSS
- **Сложность**: низкая
- **Приоритет**: 🟡 Средний

#### 9. Chip — используется в 12 файлах
- **Замена**: кастомный компонент с CSS
- **Сложность**: низкая
- **Приоритет**: 🟢 Низкий

#### 10. Avatar — используется в 7 файлах
- **Замена**: нативный `<img>` с CSS или кастомный компонент
- **Сложность**: низкая
- **Приоритет**: 🟢 Низкий

## Итоговые выводы

1. **MUI используется широко**: 47+ файлов с импортами
2. **Наиболее зависимые компоненты**: Box (47), Typography (31), Button (19)
3. **Иконки**: 30+ уникальных иконок из `@mui/icons-material`
4. **Рекомендация**: миграция потребует значительных усилий, особенно для Box и Typography

## План замены (по приоритетам)

### Фаза 1: Базовые компоненты
1. Создать `<Button />` - заменит 19 использований
2. Создать `<Text />` (Typography) - заменит 31 использование
3. Создать `<StickerCard />` (Card) - заменит 11 использований

### Фаза 2: Навигация и модалки
4. Создать `<Navbar />` (BottomNavigation) - заменит 1 использование
5. Создать `<Dialog />` / `<BottomSheet />` - заменит 5 использований

### Фаза 3: Утилитарные компоненты
6. Создать `<Spinner />` (CircularProgress) - заменит 11 использований
7. Создать `<Input />` (TextField) - заменит 8 использований
8. Заменить Box на `<div>` с CSS - заменит 47 использований

### Фаза 4: Дополнительные компоненты
9. Chip, Avatar, Alert и остальные - по мере необходимости

---

**Создано**: 2026-01-30  
**Агент**: dependency-auditor
