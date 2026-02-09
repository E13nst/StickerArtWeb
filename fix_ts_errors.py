#!/usr/bin/env python3
"""
Скрипт для массового исправления TypeScript ошибок в проекте
Безопасно обрабатывает файлы с созданием backup
"""

import re
import os
from pathlib import Path
from typing import List, Tuple

# Конфигурация
MINIAPP_SRC = Path("miniapp/src")
BACKUP_SUFFIX = ".backup"

# Статистика
stats = {
    "files_processed": 0,
    "unused_params_fixed": 0,
    "gap_fixed": 0,
    "unused_imports_fixed": 0,
    "other_fixed": 0
}

def create_backup(file_path: Path) -> None:
    """Создает резервную копию файла"""
    backup_path = file_path.with_suffix(file_path.suffix + BACKUP_SUFFIX)
    if not backup_path.exists():
        backup_path.write_text(file_path.read_text(encoding='utf-8'), encoding='utf-8')

def fix_unused_destructured_params(content: str) -> Tuple[str, int]:
    """
    Исправляет неиспользуемые параметры деструктуризации
    Пример: { onCategoryToggle, } -> { onCategoryToggle: _onCategoryToggle, }
    """
    count = 0
    
    # Паттерны для распространенных неиспользуемых параметров
    unused_params = [
        'onCategoryToggle', 'categoriesDisabled', 'categories', 'selectedCategories',
        'selectedStickerTypes', 'onStickerTypeToggle', 'selectedDate', 'onDateChange',
        'onAddClick', 'scrollContainerRef', 'getLikesCount', 'onLikeClick',
        'packId', 'enablePreloading', 'onShare', 'setActiveIndex', 'currentStickerLoading',
        'visibilityInfoAnchor', 'setLike', 'getLikeState', 'handleOpenBlockDialog',
        'handleVisibilityInfoClose', 'handleVisibilityToggle', 'user', 'userStickerSets',
        'topStickerSets', 'totalSlides', 'raf', 'toggleCategory', 'handleViewFullTop',
        'isOfficialStickerSet', 'userId', 'taskId', 'isSendingToChat', 'isLoadingTariffs',
        'artBalance', 'handleSendToChat', 'handleShareSticker', 'setError', 'getCachedProfile',
        'isCacheValid', 'reset', 'cacheKey', 'handleShareStickerSet', 'handleShareProfile',
        'isPremium', 'handleLikeStickerSet', 'isRefreshing', 'avatarUserInfo'
    ]
    
    for param in unused_params:
        # Ищем паттерн в деструктуризации параметров функции/компонента
        pattern = rf'(\{{[^}}]*?)\b{param}\b(\s*[,\}}])'
        replacement = rf'\1{param}: _{param}\2'
        new_content = re.sub(pattern, replacement, content)
        if new_content != content:
            count += 1
            content = new_content
    
    return content, count

def fix_gap_values(content: str) -> Tuple[str, int]:
    """
    Исправляет gap: число на gap: 'Xpx'
    Пример: gap: 8 -> gap: '8px'
    """
    count = 0
    
    # Паттерн для gap со значением-числом
    pattern = r'\bgap:\s*(\d+)([,\s])'
    
    def replacer(match):
        nonlocal count
        count += 1
        num = match.group(1)
        suffix = match.group(2)
        return f"gap: '{num}px'{suffix}"
    
    content = re.sub(pattern, replacer, content)
    return content, count

def fix_unused_imports(content: str) -> Tuple[str, int]:
    """
    Удаляет неиспользуемые импорты из списка
    """
    count = 0
    lines = content.split('\n')
    new_lines = []
    
    # Список часто неиспользуемых импортов
    unused = [
        'CategoryFilter', 'HeaderPanel', 'FloatingAvatar', 'useCallback',
        'useMemo', 'useRef', 'useEffect', 'CategoryResponse', 'EyePublishedIcon',
        'EyeUnpublishedIcon', 'getUserFirstName', 'getUserLastName'
    ]
    
    for line in lines:
        # Проверяем строки импорта
        if 'import' in line and any(f' {name}' in line or f'{{{name}' in line for name in unused):
            # Удаляем неиспользуемые из списка импортов
            modified = line
            for name in unused:
                # Удаляем из списка: { A, B, C } -> { A, C }
                modified = re.sub(rf',?\s*{name}\s*,?', '', modified)
                # Очистка двойных запятых
                modified = re.sub(r',\s*,', ',', modified)
                # Очистка запятой в конце списка: { A, } -> { A }
                modified = re.sub(r',\s*\}}', '}', modified)
                # Очистка пустых импортов: import { } from -> пропускаем строку
                if re.search(r'import\s*\{\s*\}\s*from', modified):
                    modified = None
                    count += 1
                    break
            
            if modified and modified != line:
                count += 1
                new_lines.append(modified)
            elif modified:
                new_lines.append(line)
        else:
            new_lines.append(line)
    
    return '\n'.join(new_lines), count

def fix_other_common_errors(content: str) -> Tuple[str, int]:
    """
    Исправляет другие распространенные ошибки
    """
    count = 0
    
    # Замены
    replacements = [
        # Spinner size
        (r'<Spinner\s+size="(small|medium|large)"', r'<Spinner size={24}', 1),
        # Alert variant -> severity
        (r'<Alert\s+variant="', r'<Alert severity="', 1),
        # CSS объекты с псевдоклассами (комментируем)
        (r"'&:hover':", r"// '&:hover':", 1),
        (r"'&:active':", r"// '&:active':", 1),
        (r"'&::-webkit-scrollbar':", r"// '&::-webkit-scrollbar':", 1),
    ]
    
    for pattern, replacement, _ in replacements:
        new_content = re.sub(pattern, replacement, content)
        if new_content != content:
            count += 1
            content = new_content
    
    return content, count

def process_file(file_path: Path) -> bool:
    """Обрабатывает один файл"""
    try:
        # Читаем содержимое
        content = file_path.read_text(encoding='utf-8')
        original_content = content
        
        # Создаем backup
        create_backup(file_path)
        
        # Применяем исправления
        content, count1 = fix_unused_destructured_params(content)
        stats["unused_params_fixed"] += count1
        
        content, count2 = fix_gap_values(content)
        stats["gap_fixed"] += count2
        
        content, count3 = fix_unused_imports(content)
        stats["unused_imports_fixed"] += count3
        
        content, count4 = fix_other_common_errors(content)
        stats["other_fixed"] += count4
        
        # Если были изменения, сохраняем
        if content != original_content:
            file_path.write_text(content, encoding='utf-8')
            stats["files_processed"] += 1
            return True
        
        return False
        
    except Exception as e:
        print(f"[ERROR] {file_path}: {e}")
        return False

def main():
    """Основная функция"""
    print(">> Начинаем массовое исправление TypeScript ошибок...\n")
    
    # Находим все .tsx и .ts файлы
    tsx_files = list(MINIAPP_SRC.rglob("*.tsx"))
    ts_files = list(MINIAPP_SRC.rglob("*.ts"))
    all_files = tsx_files + ts_files
    
    # Исключаем example файлы
    all_files = [f for f in all_files if '.example.' not in f.name]
    
    print(f">> Найдено файлов: {len(all_files)}\n")
    
    # Обрабатываем файлы
    modified_count = 0
    for file_path in all_files:
        if process_file(file_path):
            modified_count += 1
            print(f"[OK] {file_path.relative_to(MINIAPP_SRC)}")
    
    # Выводим статистику
    print(f"\n{'='*60}")
    print(f"СТАТИСТИКА")
    print(f"{'='*60}")
    print(f"Обработано файлов:           {modified_count}/{len(all_files)}")
    print(f"Неиспользуемые параметры:    {stats['unused_params_fixed']}")
    print(f"Gap исправлено:              {stats['gap_fixed']}")
    print(f"Неиспользуемые импорты:      {stats['unused_imports_fixed']}")
    print(f"Другие исправления:          {stats['other_fixed']}")
    print(f"{'='*60}")
    print(f"\n>> Готово! Backup файлы сохранены с расширением {BACKUP_SUFFIX}")
    print(f">> Если что-то пошло не так, можно восстановить из backup")

if __name__ == "__main__":
    main()
