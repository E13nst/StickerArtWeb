#!/usr/bin/env python3
"""
Скрипт для замены React.* типов во всех .tsx файлах проекта
"""
import os
import re
import shutil
import glob

def backup_file(filepath):
    """Создать резервную копию файла"""
    backup_path = filepath + '.bak5'
    if not os.path.exists(backup_path):
        shutil.copy2(filepath, backup_path)

def fix_react_types(filepath):
    """Исправить типы React в файле"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except:
        return 0
    
    original_content = content
    changes = []
    
    # Список всех возможных React.* типов
    react_types = [
        'ReactNode', 'CSSProperties', 'FC', 'MouseEvent', 'ChangeEvent',
        'SyntheticEvent', 'FormEvent', 'KeyboardEvent', 'TouchEvent',
        'FocusEvent', 'WheelEvent', 'AnimationEvent', 'TransitionEvent',
        'PointerEvent', 'UIEvent', 'ClipboardEvent', 'DragEvent',
        'ReactElement', 'ComponentType', 'RefObject', 'MutableRefObject',
        'HTMLAttributes', 'CSSProperties', 'PropsWithChildren'
    ]
    
    # Проверяем, какие типы используются
    used_types = [t for t in react_types if f'React.{t}' in content]
    
    if not used_types:
        return 0
    
    # Проверяем, есть ли уже импорт из react
    react_import_match = re.search(r"import\s+({[^}]+})\s+from\s+['\"]react['\"];?", content)
    
    if react_import_match:
        # Есть импорт, добавляем нужные типы
        existing_imports = react_import_match.group(1)
        # Извлекаем список импортов
        imports_list = [imp.strip() for imp in existing_imports.strip('{}').split(',') if imp.strip()]
        
        # Добавляем недостающие импорты
        for imp in used_types:
            if imp not in imports_list:
                imports_list.append(imp)
        
        # Формируем новый импорт
        new_imports = '{ ' + ', '.join(imports_list) + ' }'
        new_import_line = f"import {new_imports} from 'react';"
        
        content = content.replace(react_import_match.group(0), new_import_line)
        changes.append('Updated react import')
    else:
        # Нет импорта, добавляем в начало
        if used_types:
            new_imports = '{ ' + ', '.join(used_types) + ' }'
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
    
    # Заменяем все React.* типы
    for react_type in used_types:
        old_pattern = f'React.{react_type}'
        if old_pattern in content:
            content = re.sub(r'\bReact\.' + react_type + r'\b', react_type, content)
            changes.append(f'{old_pattern} -> {react_type}')
    
    # Записываем изменения
    if content != original_content:
        backup_file(filepath)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return len(changes)
    
    return 0

def main():
    base_path = os.path.join('miniapp', 'src')
    
    # Найти все .tsx файлы
    patterns = [
        os.path.join(base_path, 'pages', '**', '*.tsx'),
        os.path.join(base_path, 'layouts', '**', '*.tsx'),
        os.path.join(base_path, 'hooks', '**', '*.tsx'),
        os.path.join(base_path, 'contexts', '**', '*.tsx'),
    ]
    
    all_files = []
    for pattern in patterns:
        all_files.extend(glob.glob(pattern, recursive=True))
    
    total_files = 0
    total_changes = 0
    
    print('>> Fixing React types in pages, layouts, hooks, contexts...')
    print()
    
    for full_path in all_files:
        changes = fix_react_types(full_path)
        if changes > 0:
            total_files += 1
            total_changes += changes
            relative_path = os.path.relpath(full_path, base_path)
            print(f'[OK] {relative_path}')
    
    print()
    print(f'>> Fixed files: {total_files}')
    print(f'>> Total changes: {total_changes}')

if __name__ == '__main__':
    main()
