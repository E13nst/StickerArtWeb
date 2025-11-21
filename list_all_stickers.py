#!/usr/bin/env python3
"""
Выводит полный список всех стикерсетов
"""

# Читаем новый файл снапшота
snapshot_file = r'C:\Users\Notebook\.cursor\browser-logs\snapshot-2025-11-21T10-51-12-154Z.log'

with open(snapshot_file, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Ищем все кнопки стикерсетов
sticker_buttons = []

i = 0
while i < len(lines):
    line = lines[i]
    if '- role: button' in line:
        # Проверяем следующие строки на наличие name
        if i + 1 < len(lines) and 'name:' in lines[i + 1]:
            name = lines[i + 1].split('name:')[1].strip().strip('"')
            # Ищем ref
            ref = None
            if i + 2 < len(lines) and 'ref:' in lines[i + 2]:
                ref = lines[i + 2].split('ref:')[1].strip()
            
            # Пропускаем системные кнопки
            if name and name not in ['Recently Used', 'Open Story List', 'Search', 'Back', 'Call', 'Close', 'Add', 'ADDED', 'Open', 'More actions', 'Search this chat']:
                # Проверяем что это не счетчик типа "+ 127"
                if not name.startswith('+ ') and not name.startswith('New '):
                    sticker_buttons.append({
                        'name': name,
                        'ref': ref
                    })
    i += 1

print(f'Всего найдено кнопок стикерсетов: {len(sticker_buttons)}\n')

# Сохраняем полный список в файл
with open('all_stickers_full_list.txt', 'w', encoding='utf-8') as f:
    f.write(f'Полный список всех стикерсетов ({len(sticker_buttons)} штук)\n')
    f.write('=' * 100 + '\n\n')
    for i, sticker in enumerate(sticker_buttons, 1):
        f.write(f'{i}. {sticker["name"]}\n')
        print(f'{i}. {sticker["name"]}')

print(f'\n✓ Полный список сохранен в: all_stickers_full_list.txt')

