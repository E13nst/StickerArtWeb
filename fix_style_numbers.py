#!/usr/bin/env python3
"""
Скрипт для исправления числовых значений в style объектах
gap: 8 -> gap: '8px'
borderRadius: 8 -> borderRadius: '8px'
"""
import os
import re
import shutil
import glob

def backup_file(filepath):
    """Создать резервную копию файла"""
    backup_path = filepath + '.bak6'
    if not os.path.exists(backup_path):
        shutil.copy2(filepath, backup_path)

def fix_style_numbers(filepath):
    """Исправить числовые значения в style объектах"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except:
        return 0
    
    original_content = content
    changes = 0
    
    # Список свойств которые должны быть строками с 'px'
    px_properties = [
        'gap', 'marginBottom', 'marginTop', 'marginLeft', 'marginRight',
        'paddingBottom', 'paddingTop', 'paddingLeft', 'paddingRight',
        'borderRadius', 'width', 'height', 'maxWidth', 'maxHeight',
        'minWidth', 'minHeight', 'top', 'bottom', 'left', 'right',
        'fontSize', 'lineHeight', 'letterSpacing'
    ]
    
    # Заменяем gap: число на gap: 'числоpx'
    for prop in px_properties:
        # Паттерн: свойство: число (без кавычек и без px)
        # Negative lookbehind and lookahead to avoid already fixed values
        pattern = rf'\b{prop}:\s*(\d+(?:\.\d+)?)\s*([,\}}])'
        
        def replacement(match):
            number = match.group(1)
            delimiter = match.group(2)
            # Пропускаем 0 (можно оставить как есть)
            if number == '0' or number == '0.0':
                return match.group(0)
            return f"{prop}: '{number}px'{delimiter}"
        
        new_content = re.sub(pattern, replacement, content)
        if new_content != content:
            changes += 1
            content = new_content
    
    # Записываем изменения
    if content != original_content:
        backup_file(filepath)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return changes
    
    return 0

def main():
    base_path = os.path.join('miniapp', 'src')
    
    # Файлы для обработки
    files_to_process = [
        'components/UploadStickerPackModal.tsx',
        'components/TxLitTopHeader.tsx',
        'components/TopStickersCarousel.tsx',
        'components/TelegramAuthModal.tsx',
        'components/StickerSetActions.tsx',
        'components/ProfileHeader.tsx',
        'components/AuthorsLeaderboardModal.tsx',
    ]
    
    total_files = 0
    total_changes = 0
    
    print('>> Fixing style numbers...')
    print()
    
    for file_path in files_to_process:
        full_path = os.path.join(base_path, file_path)
        if not os.path.exists(full_path):
            print(f'[SKIP] {file_path} (not found)')
            continue
        
        changes = fix_style_numbers(full_path)
        if changes > 0:
            total_files += 1
            total_changes += changes
            print(f'[OK] {file_path}')
    
    print()
    print(f'>> Fixed files: {total_files}')
    print(f'>> Total changes: {total_changes}')

if __name__ == '__main__':
    main()
