#!/usr/bin/env python3
"""
Скрипт для замены React.ReactNode, React.CSSProperties, React.FC
на правильные импорты из 'react' во всех компонентах
"""
import os
import re
import shutil
import glob

def backup_file(filepath):
    """Создать резервную копию файла"""
    backup_path = filepath + '.bak4'
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
    uses_mouse_event = 'React.MouseEvent' in content
    uses_change_event = 'React.ChangeEvent' in content
    uses_synth_event = 'React.SyntheticEvent' in content
    uses_form_event = 'React.FormEvent' in content
    uses_keyboard_event = 'React.KeyboardEvent' in content
    uses_touch_event = 'React.TouchEvent' in content
    
    if not (uses_react_node or uses_css_props or uses_react_fc or uses_mouse_event 
            or uses_change_event or uses_synth_event or uses_form_event 
            or uses_keyboard_event or uses_touch_event):
        return 0
    
    # Определяем, какие импорты нужны
    needed_imports = []
    if uses_react_node:
        needed_imports.append('ReactNode')
    if uses_css_props:
        needed_imports.append('CSSProperties')
    if uses_react_fc:
        needed_imports.append('FC')
    if uses_mouse_event:
        needed_imports.append('MouseEvent')
    if uses_change_event:
        needed_imports.append('ChangeEvent')
    if uses_synth_event:
        needed_imports.append('SyntheticEvent')
    if uses_form_event:
        needed_imports.append('FormEvent')
    if uses_keyboard_event:
        needed_imports.append('KeyboardEvent')
    if uses_touch_event:
        needed_imports.append('TouchEvent')
    
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
    
    # Заменяем React.* типы
    replacements = [
        ('React.ReactNode', 'ReactNode'),
        ('React.CSSProperties', 'CSSProperties'),
        ('React.FC', 'FC'),
        ('React.MouseEvent', 'MouseEvent'),
        ('React.ChangeEvent', 'ChangeEvent'),
        ('React.SyntheticEvent', 'SyntheticEvent'),
        ('React.FormEvent', 'FormEvent'),
        ('React.KeyboardEvent', 'KeyboardEvent'),
        ('React.TouchEvent', 'TouchEvent'),
    ]
    
    for old_type, new_type in replacements:
        if old_type in content:
            content = re.sub(r'\b' + re.escape(old_type) + r'\b', new_type, content)
            changes.append(f'{old_type} -> {new_type}')
    
    # Записываем изменения
    if content != original_content:
        backup_file(filepath)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return len(changes)
    
    return 0

def main():
    base_path = os.path.join('miniapp', 'src')
    
    # Найти все .tsx файлы в components
    pattern = os.path.join(base_path, 'components', '**', '*.tsx')
    all_files = glob.glob(pattern, recursive=True)
    
    total_files = 0
    total_changes = 0
    
    print('>> Fixing React types in all components...')
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
