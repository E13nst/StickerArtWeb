#!/usr/bin/env node

const fs = require('fs');

const filesToClean = [
  './miniapp/src/components/StixlyTopHeader.tsx',
  './miniapp/src/components/StylePresetDropdown.tsx',
  './miniapp/src/pages/GalleryNewPage.tsx',
  './miniapp/src/components/StickerSetDetail/StickerSetDetailEdit.tsx',
  './miniapp/src/components/StickerSetDetail/StickerSetActionsBar.tsx',
  './miniapp/src/components/UserInfoCard.tsx',
];

filesToClean.forEach(file => {
  try {
    let content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    const cleaned = lines.filter(line => !line.includes('@mui/icons-material'));
    const newContent = cleaned.join('\n');
    
    // Убираем двойные точки с запятой и пустые строки
    const final = newContent
      .replace(/;;/g, ';')
      .replace(/;\n;/g, ';\n')
      .replace(/\n\n\n+/g, '\n\n');
    
    fs.writeFileSync(file, final, 'utf-8');
    console.log(`✓ Cleaned: ${file}`);
  } catch (error) {
    console.error(`✗ Error cleaning ${file}:`, error.message);
  }
});

console.log('\n✓ All files cleaned!');
