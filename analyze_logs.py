#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Скрипт для анализа логов Docker Build
Автоматизированный анализ JSON логов с выявлением проблем и метрик
"""

import json
import re
from collections import Counter, defaultdict
from datetime import datetime
from typing import List, Dict, Tuple

def load_logs(filepath: str) -> List[Dict]:
    """Загрузка логов из JSON файла"""
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)

def parse_timestamp(ts: str) -> datetime:
    """Парсинг timestamp в datetime объект"""
    return datetime.fromisoformat(ts.replace('Z', '+00:00'))

def analyze_basic_stats(data: List[Dict]) -> Dict:
    """Базовая статистика по логам"""
    stats = {
        'total_records': len(data),
        'first_timestamp': data[0]['timestamp'],
        'last_timestamp': data[-1]['timestamp'],
        'streams': Counter([d['stream'] for d in data]),
        'content_lengths': sorted([len(d['content']) for d in data], reverse=True)[:10]
    }
    
    # Вычисление длительности
    start = parse_timestamp(data[0]['timestamp'])
    end = parse_timestamp(data[-1]['timestamp'])
    duration = (end - start).total_seconds()
    stats['duration_seconds'] = duration
    stats['duration_minutes'] = duration / 60
    
    return stats

def categorize_by_level(data: List[Dict]) -> Dict[str, List[Dict]]:
    """Категоризация по уровням логирования"""
    categories = defaultdict(list)
    
    for record in data:
        content = record['content']
        content_upper = content.upper()
        
        # Определение категории по содержимому
        if '\x1b[31m' in content or 'ERROR' in content_upper or 'FATAL' in content_upper:
            categories['ERROR'].append(record)
        elif '\x1b[33m' in content or 'WARN' in content_upper:
            categories['WARN'].append(record)
        elif '\x1b[36m' in content or 'INFO' in content_upper:
            categories['INFO'].append(record)
        elif 'npm' in content[:30].lower():
            categories['NPM'].append(record)
        elif any(kw in content[:50].lower() for kw in ['docker', 'kaniko', 'building', 'copying']):
            categories['DOCKER'].append(record)
        else:
            categories['OTHER'].append(record)
    
    return dict(categories)

def find_problems(data: List[Dict]) -> Dict[str, List[Tuple[Dict, str]]]:
    """Поиск проблемных паттернов"""
    problems = {
        'errors': [],
        'warnings': [],
        'npm_errors': [],
        'deprecated': [],
        'file_errors': [],
        'timeouts': []
    }
    
    error_keywords = ['ERROR', 'FATAL', 'EXCEPTION', 'FAILED', 'FAIL', 'PANIC']
    warning_keywords = ['WARN', 'WARNING']
    
    for record in data:
        content = record['content']
        content_upper = content.upper()
        
        # Ошибки
        for keyword in error_keywords:
            if keyword in content_upper:
                problems['errors'].append((record, keyword))
                break
        
        # Предупреждения
        for keyword in warning_keywords:
            if keyword in content_upper:
                problems['warnings'].append((record, keyword))
                break
        
        # npm/yarn ошибки
        if 'npm ERR!' in content or 'yarn ERR!' in content or 'gyp ERR!' in content:
            problems['npm_errors'].append((record, 'NPM_ERROR'))
        
        # Deprecated зависимости
        if 'DEPRECATED' in content_upper or 'deprecated' in content:
            problems['deprecated'].append((record, 'DEPRECATED'))
        
        # Файловые ошибки
        if any(code in content_upper for code in ['ENOENT', 'EACCES', 'EPERM']):
            problems['file_errors'].append((record, 'FILE_ERROR'))
        
        # Таймауты
        if 'ETIMEDOUT' in content_upper or 'timeout' in content.lower():
            problems['timeouts'].append((record, 'TIMEOUT'))
    
    return problems

def analyze_timeline(data: List[Dict]) -> List[Dict]:
    """Анализ временной шкалы и ключевых событий"""
    key_events = []
    
    # Паттерны для ключевых событий
    patterns = {
        'git_clone': r'Cloning into',
        'git_checkout': r'HEAD is now at',
        'npm_install_start': r'npm (install|ci)',
        'npm_build_start': r'npm run build',
        'docker_stage': r'(Resolved base name|Retrieving image|Building stage)',
        'copying': r'(Copying|COPY)',
        'completed': r'completed|finished|done'
    }
    
    for record in data:
        content = record['content']
        
        for event_type, pattern in patterns.items():
            if re.search(pattern, content, re.IGNORECASE):
                key_events.append({
                    'timestamp': record['timestamp'],
                    'type': event_type,
                    'content': content[:200]
                })
                break
    
    return key_events

def find_time_gaps(data: List[Dict], threshold_seconds: int = 30) -> List[Dict]:
    """Поиск аномально длинных пауз между событиями"""
    gaps = []
    
    for i in range(1, len(data)):
        prev_time = parse_timestamp(data[i-1]['timestamp'])
        curr_time = parse_timestamp(data[i]['timestamp'])
        gap = (curr_time - prev_time).total_seconds()
        
        if gap > threshold_seconds:
            gaps.append({
                'gap_seconds': gap,
                'before': {
                    'timestamp': data[i-1]['timestamp'],
                    'content': data[i-1]['content'][:150]
                },
                'after': {
                    'timestamp': data[i]['timestamp'],
                    'content': data[i]['content'][:150]
                }
            })
    
    return sorted(gaps, key=lambda x: x['gap_seconds'], reverse=True)

def aggregate_duplicates(problems: List[Tuple[Dict, str]], sample_length: int = 100) -> List[Dict]:
    """Агрегация дубликатов ошибок"""
    error_groups = defaultdict(list)
    
    for record, keyword in problems:
        content = record['content']
        # Очистка от ANSI кодов
        clean_content = re.sub(r'\x1b\[[0-9;]*m', '', content)
        # Группировка по первым N символам
        key = clean_content[:sample_length].strip()
        error_groups[key].append({
            'timestamp': record['timestamp'],
            'full_content': clean_content,
            'keyword': keyword
        })
    
    # Сортировка по частоте
    aggregated = []
    for key, occurrences in error_groups.items():
        aggregated.append({
            'sample': key,
            'count': len(occurrences),
            'first_occurrence': occurrences[0]['timestamp'],
            'last_occurrence': occurrences[-1]['timestamp'],
            'example': occurrences[0]['full_content'][:300]
        })
    
    return sorted(aggregated, key=lambda x: x['count'], reverse=True)

def main(silent=False):
    if silent:
        import sys
        import os
        sys.stdout = open(os.devnull, 'w', encoding='utf-8')
    print("="*80)
    print("АНАЛИЗ ЛОГОВ DOCKER BUILD")
    print("="*80)
    
    # Загрузка данных
    filepath = r'c:\Users\Notebook\StickerArtWeb-1\docs\front.log'
    print(f"\nЗагрузка файла: {filepath}")
    data = load_logs(filepath)
    print(f"[OK] Загружено {len(data)} записей")
    
    # 1. БАЗОВАЯ СТАТИСТИКА
    print("\n" + "="*80)
    print("1. БАЗОВАЯ СТАТИСТИКА")
    print("="*80)
    stats = analyze_basic_stats(data)
    print(f"\nОбщее количество записей: {stats['total_records']}")
    print(f"Временной диапазон:")
    print(f"  Начало: {stats['first_timestamp']}")
    print(f"  Конец:  {stats['last_timestamp']}")
    print(f"  Длительность: {stats['duration_minutes']:.2f} минут ({stats['duration_seconds']:.0f} секунд)")
    print(f"\nРаспределение по потокам:")
    for stream, count in stats['streams'].items():
        print(f"  {stream}: {count} записей ({count/stats['total_records']*100:.1f}%)")
    print(f"\nТоп-10 самых длинных сообщений (символов): {stats['content_lengths'][:5]}")
    
    # 2. КАТЕГОРИЗАЦИЯ
    print("\n" + "="*80)
    print("2. КАТЕГОРИЗАЦИЯ ПО УРОВНЯМ")
    print("="*80)
    categories = categorize_by_level(data)
    print("\nРаспределение по категориям:")
    for cat, records in sorted(categories.items(), key=lambda x: len(x[1]), reverse=True):
        print(f"  {cat}: {len(records)} записей ({len(records)/len(data)*100:.1f}%)")
    
    # 3. ПОИСК ПРОБЛЕМ
    print("\n" + "="*80)
    print("3. ПОИСК ПРОБЛЕМНЫХ ПАТТЕРНОВ")
    print("="*80)
    problems = find_problems(data)
    
    print(f"\n[ERRORS] Ошибки (ERROR/FATAL/EXCEPTION): {len(problems['errors'])}")
    if problems['errors']:
        print("\nПримеры первых 5 ошибок:")
        for i, (record, keyword) in enumerate(problems['errors'][:5], 1):
            content = re.sub(r'\x1b\[[0-9;]*m', '', record['content'])
            print(f"\n  {i}. [{record['timestamp']}] Тип: {keyword}")
            print(f"     {content[:200]}")
    
    print(f"\n[WARN] Предупреждения (WARN): {len(problems['warnings'])}")
    if problems['warnings']:
        print("\nПримеры первых 3 предупреждений:")
        for i, (record, keyword) in enumerate(problems['warnings'][:3], 1):
            content = re.sub(r'\x1b\[[0-9;]*m', '', record['content'])
            print(f"\n  {i}. [{record['timestamp']}]")
            print(f"     {content[:200]}")
    
    print(f"\n[NPM] NPM ошибки: {len(problems['npm_errors'])}")
    print(f"[DEPRECATED] Deprecated зависимости: {len(problems['deprecated'])}")
    print(f"[FILE] Файловые ошибки (ENOENT/EACCES): {len(problems['file_errors'])}")
    print(f"[TIMEOUT] Таймауты: {len(problems['timeouts'])}")
    
    # 4. ВРЕМЕННОЙ АНАЛИЗ
    print("\n" + "="*80)
    print("4. ВРЕМЕННОЙ АНАЛИЗ")
    print("="*80)
    
    timeline = analyze_timeline(data)
    print(f"\nКлючевые события: {len(timeline)}")
    print("\nПервые 15 ключевых событий:")
    for i, event in enumerate(timeline[:15], 1):
        print(f"{i:2d}. [{event['timestamp']}] {event['type']}")
        print(f"    {event['content'][:150]}")
    
    gaps = find_time_gaps(data, threshold_seconds=30)
    print(f"\n\nАномально длинные паузы (>30 сек): {len(gaps)}")
    if gaps:
        print("\nТоп-5 самых длинных пауз:")
        for i, gap in enumerate(gaps[:5], 1):
            print(f"\n{i}. Пауза: {gap['gap_seconds']:.1f} секунд")
            print(f"   До:    [{gap['before']['timestamp']}] {gap['before']['content'][:100]}")
            print(f"   После: [{gap['after']['timestamp']}] {gap['after']['content'][:100]}")
    
    # 5. АГРЕГАЦИЯ ДУБЛИКАТОВ
    print("\n" + "="*80)
    print("5. АГРЕГАЦИЯ ДУБЛИКАТОВ")
    print("="*80)
    
    error_aggregated = []
    deprecated_aggregated = []
    if problems['errors']:
        error_aggregated = aggregate_duplicates(problems['errors'])
        print(f"\nУникальных типов ошибок: {len(error_aggregated)}")
        print("\nТоп-10 самых частых ошибок:")
        for i, err in enumerate(error_aggregated[:10], 1):
            print(f"\n{i}. Встречается: {err['count']} раз")
            print(f"   Первое: {err['first_occurrence']}")
            print(f"   Последнее: {err['last_occurrence']}")
            print(f"   Пример: {err['sample'][:120]}")
    
    if problems['deprecated']:
        deprecated_aggregated = aggregate_duplicates(problems['deprecated'])
        print(f"\n\nУстаревшие зависимости: {len(deprecated_aggregated)} уникальных")
        print("\nТоп-5 deprecated предупреждений:")
        for i, dep in enumerate(deprecated_aggregated[:5], 1):
            print(f"\n{i}. Встречается: {dep['count']} раз")
            print(f"   {dep['sample'][:150]}")
    
    # Сохранение результатов для этапа 2
    print("\n" + "="*80)
    print("СОХРАНЕНИЕ РЕЗУЛЬТАТОВ")
    print("="*80)
    
    results = {
        'stats': stats,
        'categories': {k: len(v) for k, v in categories.items()},
        'problems': {
            'errors_count': len(problems['errors']),
            'errors_examples': [(r['timestamp'], re.sub(r'\x1b\[[0-9;]*m', '', r['content'])[:300], kw) 
                                for r, kw in problems['errors'][:20]],
            'warnings_count': len(problems['warnings']),
            'warnings_examples': [(r['timestamp'], re.sub(r'\x1b\[[0-9;]*m', '', r['content'])[:300], kw) 
                                  for r, kw in problems['warnings'][:10]],
            'npm_errors': len(problems['npm_errors']),
            'deprecated': len(problems['deprecated']),
            'file_errors': len(problems['file_errors']),
            'timeouts': len(problems['timeouts'])
        },
        'timeline': timeline[:30],
        'time_gaps': gaps[:10],
        'error_aggregated': error_aggregated[:15] if problems['errors'] else [],
        'deprecated_aggregated': deprecated_aggregated[:10] if problems['deprecated'] else []
    }
    
    output_file = r'c:\Users\Notebook\StickerArtWeb-1\docs\analysis_results.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    
    print(f"\n[OK] Результаты сохранены в: {output_file}")
    print("\n" + "="*80)
    print("ПРЕДОБРАБОТКА ЗАВЕРШЕНА")
    print("="*80)

if __name__ == '__main__':
    import sys
    silent = '--silent' in sys.argv or '-s' in sys.argv
    main(silent=silent)
