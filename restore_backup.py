#!/usr/bin/env python3
"""Восстанавливает файлы из backup"""

from pathlib import Path

MINIAPP_SRC = Path("miniapp/src")
BACKUP_SUFFIX = ".backup"

restored = 0
for backup_file in MINIAPP_SRC.rglob(f"*{BACKUP_SUFFIX}"):
    original = backup_file.with_suffix("")
    if original.suffix in ['.tsx', '.ts']:
        original.write_text(backup_file.read_text(encoding='utf-8'), encoding='utf-8')
        backup_file.unlink()
        restored += 1
        print(f"[RESTORED] {original.relative_to(MINIAPP_SRC)}")

print(f"\n>> Восстановлено файлов: {restored}")
