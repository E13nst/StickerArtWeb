#!/usr/bin/env python3
"""
Скрипт для замены React.ReactNode, React.CSSProperties, React.FC
на правильные импорты из 'react'
"""
import os
import re
import shutil

def backup_file(filepath):
    """Создать резервную копию файла"""
    backup_path = filepath + '.bak3'
    if not os.path.exists(backup_path):
        shutil.copy2(filepath, backup_path)

def fix_react_types(filepath):
    """Исправить типы React в файле"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    changes = []
    
    # Проверяем, используются ли типы React
    uses_react_node = 'React.ReactNode' in content
    uses_css_props = 'React.CSSProperties' in content
    uses_react_fc = 'React.FC' in content
    
    if not (uses_react_node or uses_css_props or uses_react_fc):
        return 0
    
    # Определяем, какие импорты нужны
    needed_imports = []
    if uses_react_node:
        needed_imports.append('ReactNode')
    if uses_css_props:
        needed_imports.append('CSSProperties')
    if uses_react_fc:
        needed_imports.append('FC')
    
    # Проверяем, есть ли уже импорт из react
    react_import_match = re.search(r"import\s+({[^}]+})\s+from\s+['\"]react['\"];?", content)
    
    if react_import_match:
        # Есть импорт, добавляем нужные типы
        existing_imports = react_import_match.group(1)
        # Извлекаем список импортов
        imports_list = [imp.strip() for imp in existing_imports.strip('{}').split(',')]
        
        # Добавляем недостающие импорты
        for imp in needed_imports:
            if imp not in imports_list:
                imports_list.append(imp)
        
        # Формируем новый импорт
        new_imports = '{ ' + ', '.join(imports_list) + ' }'
        new_import_line = f"import {new_imports} from 'react';"
        
        content = content.replace(react_import_match.group(0), new_import_line)
        changes.append('Updated react import')
    else:
        # Нет импорта, добавляем в начало
        new_imports = '{ ' + ', '.join(needed_imports) + ' }'
        new_import_line = f"import {new_imports} from 'react';\n"
        
        # Находим первый импорт
        first_import_match = re.search(r'^import\s+', content, re.MULTILINE)
        if first_import_match:
            insert_pos = first_import_match.start()
            content = content[:insert_pos] + new_import_line + content[insert_pos:]
        else:
            # Если нет импортов, добавляем в начало
            content = new_import_line + content
        changes.append('Added react import')
    
    # Заменяем React.ReactNode на ReactNode
    if uses_react_node:
        content = re.sub(r'\bReact\.ReactNode\b', 'ReactNode', content)
        changes.append('React.ReactNode -> ReactNode')
    
    # Заменяем React.CSSProperties на CSSProperties
    if uses_css_props:
        content = re.sub(r'\bReact\.CSSProperties\b', 'CSSProperties', content)
        changes.append('React.CSSProperties -> CSSProperties')
    
    # Заменяем React.FC на FC
    if uses_react_fc:
        content = re.sub(r'\bReact\.FC\b', 'FC', content)
        changes.append('React.FC -> FC')
    
    # Записываем изменения
    if content != original_content:
        backup_file(filepath)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return len(changes)
    
    return 0

def main():
    base_path = os.path.join('miniapp', 'src')
    
    files_to_process = [
        'components/ui/UploadModal.tsx',
        'components/ui/Tooltip.tsx',
        'components/ui/Toast.tsx',
        'components/ui/Text.tsx',
        'components/ui/SwipeCardStack.tsx',
        'components/ui/StickerCard.tsx',
        'components/ui/Spinner.tsx',
        'components/ui/Navbar.tsx',
        'components/ui/Input.tsx',
        'components/ui/Icons.tsx',
        'components/ui/IconButton.tsx',
        'components/ui/HeaderPanel.tsx',
        'components/ui/Chip.tsx',
        'components/ui/Button.tsx',
        'components/ui/BottomSheet.tsx',
        'components/ui/Avatar.tsx',
        'components/ui/Alert.tsx',
        'components/ui/SwipeCardStack.example.tsx',
        'components/ui/BottomSheet.example.tsx',
        'components/ui/UploadModal.example.tsx',
        'components/ui/HeaderPanel.example.tsx',
    ]
    
    total_files = 0
    total_changes = 0
    
    print('>> Fixing React types...')
    print()
    
    for file_path in files_to_process:
        full_path = os.path.join(base_path, file_path)
        if not os.path.exists(full_path):
            print(f'[SKIP] {file_path} (not found)')
            continue
        
        changes = fix_react_types(full_path)
        if changes > 0:
            total_files += 1
            total_changes += changes
            print(f'[OK] {file_path}')
    
    print()
    print(f'>> Fixed files: {total_files}')
    print(f'>> Total changes: {total_changes}')

if __name__ == '__main__':
    main()
