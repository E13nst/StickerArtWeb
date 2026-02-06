# Действия пользователя в проекте (полный список)

```ts
// === НАВИГАЦИЯ ===
// Нижняя панель (Navbar)
NAV_HOME        → /dashboard
NAV_GALLERY     → /gallery
NAV_SWIPE       → /nft-soon
NAV_GENERATE    → /generate
NAV_ACCOUNT     → /profile

// Маршруты (Routes)
/ → redirect /gallery
/dashboard, /gallery, /profile, /profile/:userId, /author/:id, /nft-soon, /generate, /design-system-demo
* → DashboardPage

// Переходы по клику
navigate('/')                    // Вернуться на главную (ошибка, EmptyState)
navigate('/gallery')             // из корня
navigate('/gallery?sort=likes')   // Dashboard «Смотреть весь топ»
navigate(`/author/${authorId}`)  // TopAuthors, AuthorsLeaderboardModal, StickerSetDetail (ссылка на автора)
navigate(`/profile/${userId}`)   // (если есть)

// Telegram BackButton (AuthorPage, MyProfilePage, ProfilePage)
BackButton.onClick → history.back() или закрыть модал (MyProfilePage)

// === ШАПКА (HeaderPanel, только не на /profile и не на /author/:id) ===
HEADER_PLUS_CLICK    → пополнение баланса (TODO)
HEADER_WALLET_CLICK  → TON Connect (TODO)

// === DASHBOARD ===
toggleCategory()           // Официальные ↔ Пользовательские
handlePackClick(packId)    // открыть StickerPackModal
handleViewFullTop()        // navigate('/gallery?sort=likes')
StickerPackModal onClose
StickerPackModal onLike(id)
StickerPackModal onStickerSetUpdated(updated)

// === GALLERY (GalleryPage2) ===
handleViewStickerSet(id)   // открыть StickerPackModal
handleBackToList()         // закрыть модал
handleSearch(term)
handleCategoryToggle(categoryId)
handleSortToggle()
handleStickerSetTypeToggle(type)
handleStickerTypeToggle(typeId)
handleDateChange(dateId)
handleApplyFilters()       // FilterModal
CompactControlsBar: onSearch, onCategoryToggle, onSortToggle, onStickerTypeToggle, onStickerSetTypeToggle, onDateChange, onApplyFilters
OptimizedGallery: onPackClick, onLoadMore
StickerPackModal: onClose, onLike(id, title)

// === PROFILE (MyProfilePage) ===
// Вкладки верхнего уровня
setMainTab(0)   // Stickers
setMainTab(1)   // Likes
// Вкладки Create / Likes / Upload (StickerSetsTabs)
handleCreateSticker()           // setIsUploadModalOpen(true) или открыть UploadModal
handleSearchChange(term)
handleSearch(term)
handleSortToggle()
handleLoadMorePublished()
handleLoadMoreLiked()
handleViewStickerSet(packId)   // открыть StickerPackModal
handleCloseModal()
onLike(id)                     // toggle like в store
AddStickerPackButton onClick    // setIsUploadModalOpen(true)
PackCard onPackClick
OptimizedGallery onLoadMore (Published / Liked)
StickerPackModal: onClose, onStickerSetUpdated, onCategoriesUpdated
UploadStickerPackModal: onClose, onComplete
// Кошелёк
Connect wallet button click    → tonConnectUI.openModal()
Wallet menu: Disconnect         → unlinkWallet(tonConnectUI)
// BackButton
BackButton → закрыть модал или history.back()

// === PROFILE (ProfilePage — чужой профиль /profile/:userId) ===
handleBack()               // BackButton → history.back()
handleViewStickerSet(packId)
handleCloseModal()
handleShareStickerSet(name, title)
handleLikeStickerSet(id, title)
handleCreateSticker()      // EmptyState onAction
handleSearch(query)
handleSortChange(sortByLikes)
loadMoreStickerSets
StickerPackModal: onClose, onStickerSetUpdated
EmptyState onAction(() => navigate('/'))

// === AUTHOR (AuthorPage) ===
handleBack()               // BackButton → history.back()
handlePackClick(packId)
handleStickerSetUpdated(updated)
handleSearchChange(value)
handleSearch(value)
handleSortToggle()
handleLoadMore()
SearchBar: onChange, onSearch
SortButton: onToggle
OptimizedGallery: onPackClick, onLoadMore
StickerPackModal: onClose, onStickerSetUpdated

// === STICKER PACK MODAL / STICKER SET DETAIL ===
onClose()
onLike(id?, title?)
onShare(name, title)
onStickerSetUpdated(updated)
onCategoriesUpdated(updated)
onBlock(updated)
// Действия внутри модала (StickerSetDetail)
StickerSetActionsBar: Stars (donate) → открыть DonateModal
StickerSetActionsBar: Like → handleLikeClick
StickerSetActionsBar: Share → handleShareClick
Categories button    → CategoriesDialog open
Block button         → BlockDialog open
Donate (Stars)       → DonateModal open
Edit categories      → CategoriesDialog: выбор категорий, Save
Block dialog         → ввод причины, подтверждение Block → onBlock(updated)
DonateModal: ввод суммы, пресеты, подтверждение доната TON → onClose
CategoriesDialog: выбор категорий, Save → onSave(updated), onClose
BlockDialog: причина, Block → onBlock(updated), onClose

// === UPLOAD / CREATE ===
UploadStickerPackModal: ввод ссылки t.me/addstickers/…, выбор категорий, загрузка → onComplete(stickerSet), onClose
AddStickerPackButton click  → открыть UploadStickerPackModal или UploadModal

// === GENERATE (GeneratePage) ===
handleGenerate()             // генерация стикера
handleReset()                // сброс формы
handleGenerateAnother()     // reset + фокус на генерацию
handleSaveToStickerSet()     // сохранить в стикерсет
handleSendToChat()           // отправить в чат (если fileId + inlineQueryId)
handleShareSticker()         // шаринг
Кнопки: Save to Sticker Set, Send to Chat / Share, Generate another, Reset, Generate

// === SWIPE (SwipePage) ===
handleCloseHello()          // закрыть приветственный экран
handleSwipeLeft(card)
handleSwipeRight(card)      // лайк
handleEnd()                 // конец стека
reset                       // перезапуск (кнопки на экранах конца)
Button onClick={reset}

// === FILTER MODAL (Gallery) ===
open/close
handleToggleStickerType(typeId)
handleSelectDifficulty(difficultyId)
handleSelectDateRange(dateId)
handleApply()               // onApply(filters), onClose

// === DONATE MODAL ===
open/close
setAmount, setSelectedPreset
confirm donate (TON)        // подготовка + отправка
resetAndClose after success

// === ОБЩИЕ UI ===
EmptyState: onAction (retry / navigate / create)
ErrorDisplay: onRetry
ModalBackdrop: onClick → onClose
BottomSheet: onClose
Toast: onClose
Dropdowns (Sort, Date, StickerType, StylePreset): open/close, select option
SearchBar: onChange, onSearch
```
