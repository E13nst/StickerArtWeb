#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Список иконок, которые у нас есть
const availableIcons = [
  'Close', 'Search', 'Tune', 'KeyboardArrowDown', 'CheckCircle', 'ArrowBack',
  'MoreVert', 'Share', 'Favorite', 'Delete', 'Edit', 'Block', 'Visibility',
  'Telegram', 'Person', 'AccountBalanceWallet', 'DeveloperMode', 'Download',
  'StarBorder', 'Collections', 'EmojiEvents', 'Restore', 'DragIndicator',
  'Add', 'Check'
];

// Файлы с иконками
const filesToProcess = [
  './miniapp/src/components/TelegramAuthButton.tsx',
  './miniapp/src/components/UserInfoCard.tsx',
  './miniapp/src/components/ProfileHeader.tsx',
  './miniapp/src/components/TelegramAuthModal.tsx',
  './miniapp/src/components/StickerSetTypeFilter.tsx',
  './miniapp/src/components/StickerSetDetail/StickerSetActionsBar.tsx',
  './miniapp/src/components/ProfileTabs.tsx',
  './miniapp/src/components/StickerSetDetail/StickerSetDetailEdit.tsx',
  './miniapp/src/pages/GalleryNewPage.tsx',
  './miniapp/src/components/StickerSetDetail.tsx',
  './miniapp/src/components/StylePresetDropdown.tsx',
  './miniapp/src/components/StixlyTopHeader.tsx',
];

const changedFiles = [];

function processFile(filePath) {
  console.log(`Processing: ${filePath}`);
  
  try {
    let content = fs.readFileSync(filePath, 'utf-8');
    let originalContent = content;
    let importedIcons = [];

    // Находим все импорты иконок из @mui/icons-material
    const iconImportRegex = /import\s+(\w+)\s+from\s+['"]@mui\/icons-material\/(\w+)['"]/g;
    let match;
    
    while ((match = iconImportRegex.exec(content)) !== null) {
      const iconName = match[1];
      const iconFile = match[2];
      console.log(`  Found icon: ${iconName} from ${iconFile}`);
      
      // Проверяем, есть ли эта иконка в нашем списке
      if (availableIcons.includes(iconName.replace(/Icon$/, '')) || availableIcons.includes(iconFile)) {
        importedIcons.push(iconName);
      }
    }

    if (importedIcons.length > 0) {
      // Удаляем все импорты @mui/icons-material
      content = content.replace(
        /import\s+(\w+)\s+from\s+['"]@mui\/icons-material\/\w+['"];?\n/g,
        ''
      );

      // Добавляем импорт из наших иконок, если его ещё нет
      if (!content.includes("from '@/components/ui/Icons'")) {
        // Находим последний импорт
        const lastImportMatch = content.match(/import[^;]+;(?=\n(?!import))/);
        if (lastImportMatch) {
          const insertPos = lastImportMatch.index + lastImportMatch[0].length;
          const iconsImport = `\nimport { ${importedIcons.join(', ')} } from '@/components/ui/Icons';`;
          content = content.slice(0, insertPos) + iconsImport + content.slice(insertPos);
        } else {
          // Если не нашли импорты, добавляем в начало
          content = `import { ${importedIcons.join(', ')} } from '@/components/ui/Icons';\n` + content;
        }
      } else {
        // Уже есть импорт, добавляем к нему
        content = content.replace(
          /(import\s+{[^}]+})\s+from\s+['"]@\/components\/ui\/Icons['"]/,
          (match, imports) => {
            const existingIcons = imports.match(/{\s*([^}]+)\s*}/)[1].split(',').map(s => s.trim());
            const allIcons = [...new Set([...existingIcons, ...importedIcons])];
            return `import { ${allIcons.join(', ')} } from '@/components/ui/Icons'`;
          }
        );
      }

      // Удаляем двойные пустые строки
      content = content.replace(/\n\n\n+/g, '\n\n');
    }

    // Удаляем импорт type SvgIconProps
    content = content.replace(/import\s+type\s+{\s*SvgIconProps\s*}\s+from\s+['"]@mui\/material\/SvgIcon['"];?\n/g, '');

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

console.log('Starting MUI icons removal...\n');

filesToProcess.forEach(file => {
  processFile(file);
});

console.log(`\n✓ Processed ${filesToProcess.length} files`);
console.log(`✓ Changed ${changedFiles.length} files\n`);

if (changedFiles.length > 0) {
  console.log('Changed files:');
  changedFiles.forEach(file => console.log(`  - ${file}`));
}
