#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Файлы с MUI импортами (из grep)
const filesToProcess = [
  './miniapp/src/components/StixlyTopHeader.tsx',
  './miniapp/src/components/StylePresetDropdown.tsx',
  './miniapp/src/components/StickerSetDetail.tsx',
  './miniapp/src/hooks/useStickerFeed.tsx',
  './miniapp/src/components/UploadStickerPackModal.tsx',
  './miniapp/src/components/StickerSetActions.tsx',
  './miniapp/src/pages/GalleryNewPage.tsx',
  './miniapp/src/components/AuthorsLeaderboardModal.tsx',
  './miniapp/src/pages/AuthorPage.tsx',
  './miniapp/src/components/DonateModal.tsx',
  './miniapp/src/components/StickerSetDetail/StickerPreview.tsx',
  './miniapp/src/components/StickerSetDetail/StickerSetDetailEdit.tsx',
  './miniapp/src/components/DateFilterDropdown.tsx',
  './miniapp/src/components/LeaderboardModal.tsx',
  './miniapp/src/components/GalleryControlsBar.tsx',
  './miniapp/src/components/StickerTypeDropdown.tsx',
  './miniapp/src/components/SortDropdown.tsx',
  './miniapp/src/components/StickerSetsTabs.tsx',
  './miniapp/src/components/layout/StixlyPageContainer.tsx',
  './miniapp/src/components/ProfileTabs.tsx',
  './miniapp/src/components/StickerSetDetail/StickerSetActionsBar.tsx',
  './miniapp/src/components/StickerSetDetail/CategoriesDialog.tsx',
  './miniapp/src/components/StickerSetDetail/BlockDialog.tsx',
  './miniapp/src/components/StickerSetTypeFilter.tsx',
  './miniapp/src/components/AddStickerPackButton.tsx',
  './miniapp/src/components/SearchBar.tsx',
  './miniapp/src/components/TelegramAuthModal.tsx',
  './miniapp/src/components/TopStickersCarousel.tsx',
  './miniapp/src/components/UserInfo.tsx',
  './miniapp/src/components/UserInfoCardModern.tsx',
  './miniapp/src/components/ProfileHeader.tsx',
  './miniapp/src/components/UserInfoCard.tsx',
  './miniapp/src/components/TxLitTopHeader.tsx',
  './miniapp/src/components/FloatingAvatar.tsx',
  './miniapp/src/components/TopCategories.tsx',
  './miniapp/src/components/MetricCard.tsx',
  './miniapp/src/components/AuthStatus.tsx',
  './miniapp/src/components/TelegramAuthButton.tsx',
  './miniapp/src/components/TelegramThemeToggle.tsx',
  './miniapp/src/components/LazyImage.tsx',
];

// Маппинг MUI компонентов на кастомные или HTML
const componentReplacements = {
  'Box': 'div',
  'Typography': 'Text',
  'CircularProgress': 'LoadingSpinner',
  'Button': 'Button',
  'IconButton': 'button',
  'Card': 'Card',
  'CardContent': 'CardContent',
  'Avatar': 'Avatar',
  'Chip': 'Chip',
  'Dialog': 'BottomSheet',
  'DialogTitle': 'div',
  'DialogContent': 'div',
  'DialogActions': 'div',
  'TextField': 'input',
  'Alert': 'div',
  'Drawer': 'div',
  'Divider': 'hr',
  'Container': 'div',
  'Tooltip': 'div',
  'Popover': 'div',
  'Tabs': 'div',
  'Tab': 'button',
};

// Список иконок из @mui/icons-material, которые у нас уже есть
const availableIcons = [
  'Close',
  'Search',
  'Tune',
  'KeyboardArrowDown',
  'CheckCircle',
  'ArrowBack',
  'MoreVert',
  'Share',
  'Favorite',
  'Delete',
  'Edit',
  'Block',
  'Visibility',
];

const changedFiles = [];

function processFile(filePath) {
  console.log(`Processing: ${filePath}`);
  
  try {
    let content = fs.readFileSync(filePath, 'utf-8');
    let originalContent = content;
    let hasChanges = false;

    // 1. Заменяем импорты @mui/material
    content = content.replace(
      /import\s+{([^}]+)}\s+from\s+['"]@mui\/material['"]/g,
      (match, imports) => {
        hasChanges = true;
        // Удаляем импорт, так как мы будем заменять компоненты
        return '';
      }
    );

    // 2. Заменяем импорты @mui/icons-material
    content = content.replace(
      /import\s+(\w+)\s+from\s+['"]@mui\/icons-material\/(\w+)['"]/g,
      (match, iconName) => {
        if (availableIcons.includes(iconName.replace(/Icon$/, ''))) {
          hasChanges = true;
          return `import { ${iconName} } from '@/components/ui/Icons';`;
        }
        // Если иконки нет, оставляем как есть (временно)
        return match;
      }
    );

    // 3. Заменяем <Box> на <div>
    content = content.replace(/<Box(\s|>)/g, '<div$1');
    content = content.replace(/<\/Box>/g, '</div>');

    // 4. Удаляем sx prop (заменяем на style или className)
    // Это сложно сделать автоматически, оставим как есть

    // 5. Убираем двойные пустые строки после удаления импортов
    content = content.replace(/\n\n\n+/g, '\n\n');

    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf-8');
      changedFiles.push(filePath);
      console.log(`✓ Updated: ${filePath}`);
      return true;
    } else {
      console.log(`⊘ No changes: ${filePath}`);
      return false;
    }
  } catch (error) {
    console.error(`✗ Error processing ${filePath}:`, error.message);
    return false;
  }
}

// Обработка всех файлов
console.log('Starting MUI removal...\n');

filesToProcess.forEach(file => {
  processFile(file);
});

console.log(`\n✓ Processed ${filesToProcess.length} files`);
console.log(`✓ Changed ${changedFiles.length} files\n`);

if (changedFiles.length > 0) {
  console.log('Changed files:');
  changedFiles.forEach(file => console.log(`  - ${file}`));
}

console.log('\nNext steps:');
console.log('1. Remove MUI dependencies from package.json');
console.log('2. Replace sx props with style or className manually');
console.log('3. Test the application');
console.log('4. Run linter to find remaining issues');
