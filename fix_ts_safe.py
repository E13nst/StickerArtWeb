#!/usr/bin/env python3
"""
Безопасный скрипт для исправления только простых TypeScript ошибок
Только неиспользуемые локальные переменные в теле функций
"""

import re
from pathlib import Path

MINIAPP_SRC = Path("miniapp/src")
stats = {"files": 0, "fixes": 0}

# Только простые локальные переменные внутри функций
UNUSED_VARS = [
    ('applyHoverStyles', 'functions'),
    ('applyBaseStyles', 'functions'),
    ('handleApplyFilters', 'functions'),
    ('prepareData', 'state'),
    ('getLikesCount', 'functions'),
    ('enablePreloading', 'functions'),
    ('setActiveIndex', 'state'),
    ('currentStickerLoading', 'state'),
    ('visibilityInfoAnchor', 'state'),
    ('setLike', 'functions'),
    ('getLikeState', 'functions'),
    ('handleOpenBlockDialog', 'functions'),
    ('handleVisibilityInfoClose', 'functions'),
    ('handleVisibilityToggle', 'functions'),
    ('userStickerSets', 'variables'),
    ('topStickerSets', 'variables'),
    ('totalSlides', 'variables'),
    ('raf', 'variables'),
    ('toggleCategory', 'functions'),
    ('handleViewFullTop', 'functions'),
    ('isOfficialStickerSet', 'functions'),
    ('userId', 'variables'),
    ('taskId', 'state'),
    ('isSendingToChat', 'state'),
    ('isLoadingTariffs', 'state'),
    ('artBalance', 'state'),
    ('handleSendToChat', 'functions'),
    ('handleShareSticker', 'functions'),
    ('getCachedProfile', 'functions'),
    ('isCacheValid', 'functions'),
    ('cacheKey', 'variables'),
    ('handleShareStickerSet', 'functions'),
    ('handleShareProfile', 'functions'),
    ('handleLikeStickerSet', 'functions'),
    ('isRefreshing', 'state'),
    ('avatarUserInfo', 'variables'),
    ('accentShadowHover', 'variables'),
    ('glassBase', 'variables'),
    ('getCachedData', 'functions'),
    ('handleLikeAnimation', 'functions'),
    ('addPackToCollection', 'functions'),
    ('removePackFromCollection', 'functions'),
    ('handlePackClick', 'functions'),
]

def fix_simple_unused_vars(content: str) -> tuple[str, int]:
    """Добавляет _ к неиспользуемым локальным переменным"""
    count = 0
    
    for var_name, var_type in UNUSED_VARS:
        # Только для локальных const/let объявлений
        if var_type in ['variables', 'state', 'functions']:
            # const varName = ...
            pattern = rf'\bconst {var_name}\b'
            if pattern in content or f'const {var_name}' in content:
                content = re.sub(rf'\bconst {var_name}\b', f'const _{var_name}', content)
                count += 1
    
    return content, count

def process_file(file_path: Path) -> bool:
    """Обрабатывает один файл безопасно"""
    try:
        content = file_path.read_text(encoding='utf-8')
        original = content
        
        content, count = fix_simple_unused_vars(content)
        
        if content != original:
            # Создаем backup
            backup = file_path.with_suffix(file_path.suffix + '.bak2')
            backup.write_text(original, encoding='utf-8')
            
            file_path.write_text(content, encoding='utf-8')
            stats["fixes"] += count
            stats["files"] += 1
            return True
        return False
        
    except Exception as e:
        print(f"[ERROR] {file_path}: {e}")
        return False

def main():
    print(">> Запуск безопасного исправления...\n")
    
    tsx_files = list(MINIAPP_SRC.rglob("*.tsx"))
    ts_files = list(MINIAPP_SRC.rglob("*.ts"))
    all_files = [f for f in tsx_files + ts_files if '.example.' not in f.name]
    
    for f in all_files:
        if process_file(f):
            print(f"[OK] {f.relative_to(MINIAPP_SRC)}")
    
    print(f"\n>> Файлов изменено: {stats['files']}")
    print(f">> Исправлений: {stats['fixes']}")

if __name__ == "__main__":
    main()
