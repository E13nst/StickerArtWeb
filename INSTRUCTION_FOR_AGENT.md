# Инструкция по извлечению ссылок на стикеры Telegram

## КРИТИЧЕСКИЕ МОМЕНТЫ (учёт ошибок)

### ❌ ЧАСТЫЕ ОШИБКИ:
1. **НЕ смотреть в левую панель** - там Recently Used и уже добавленные стикеры
2. **НЕ искать по всему снапшоту** - только в конкретном элементе
3. **НЕ брать стикеры из других окон** - только из StickerSearch

### ✅ ПРАВИЛЬНЫЙ ПОДХОД:

## 1. ЦЕЛЕВОЙ ЭЛЕМЕНТ
```
class="StickerSearch custom-scroll Transition_slide Transition_slide-active with-notch"
```
**ТОЛЬКО в этом элементе** находятся нужные стикеры!

## 2. СТРУКТУРА ЭЛЕМЕНТА

Внутри StickerSearch:
```
StickerSearch
  └─ [список generic элементов]
       └─ [для каждого стикерпака]
            ├─ name: "Название стикерпака"
            └─ button: "ADD" или "ADDED"
```

## 3. ГРАНИЦЫ СПИСКА

**НАЧАЛО:** 
- "Duck Emoji" или 
- "Hot cherry" (Cherry Emoji)

**КОНЕЦ:**
- "Yeti on Holidays"

**ОЖИДАЕМОЕ КОЛИЧЕСТВО:** 230-260 уникальных паков

## 4. КАК ОПРЕДЕЛИТЬ НУЖНЫЕ СТИКЕРЫ

### Признаки НУЖНЫХ стикеров:
- Находятся внутри элемента с классом `StickerSearch`
- Имеют кнопку "ADD" или "ADDED" рядом с названием
- Расположены в правой части экрана (в модальном окне поиска)
- Идут в определенной последовательности от Duck до Yeti

### Признаки НЕНУЖНЫХ стикеров:
- Находятся в левой панели (Recently Used, Vector Icons и т.д.)
- Это уже добавленные стикеры в основной список
- Находятся вне элемента StickerSearch

## 5. АЛГОРИТМ ИЗВЛЕЧЕНИЯ

### Шаг 1: Найти элемент StickerSearch в снапшоте
```python
# В снапшоте ищем строку с классом StickerSearch
# Запоминаем начало этого блока
```

### Шаг 2: Извлечь только дочерние элементы
```python
# Парсим ТОЛЬКО элементы внутри StickerSearch
# Игнорируем всё, что вне этого блока
```

### Шаг 3: Найти границы
```python
# Ищем первое вхождение "Duck" или "Cherry" - это начало
# Ищем "Yeti" - это конец
# Всё между ними - нужные стикеры
```

### Шаг 4: Прокрутка до конца
```python
# Использовать End или PageDown для прокрутки
# После каждой прокрутки делать snapshot
# Продолжать пока не найдем "Yeti on Holidays"
```

### Шаг 5: Извлечение ссылок
Для каждого стикерпака:
1. Кликнуть на превью стикера (НЕ на кнопку ADD!)
2. Откроется модальное окно с превью
3. Найти кнопку "..." (кебаб-меню)
4. Кликнуть на кебаб-меню
5. Выбрать "Copy Link" / "Скопировать ссылку"
6. Сохранить ссылку в файл

## 6. СТРУКТУРА ФАЙЛА РЕЗУЛЬТАТА

```
Sticker №1: Duck Emoji
Link: https://t.me/addstickers/...
Status: collected

Sticker №2: Cherry Emoji  
Link: https://t.me/addstickers/...
Status: collected

...

Total: 230-260 links
```

## 7. КОД ДЛЯ ПАРСИНГА (правильный)

```python
import re

# Читаем снапшот
with open('snapshot.log', 'r', encoding='utf-8') as f:
    content = f.read()

# Ищем блок StickerSearch
sticker_search_start = content.find('StickerSearch custom-scroll')
if sticker_search_start == -1:
    print("ERROR: StickerSearch element not found!")
    exit()

# Берем только содержимое этого блока
# (нужно найти конец блока - следующий элемент того же уровня)
sticker_search_content = content[sticker_search_start:sticker_search_start + 100000]

# Парсим ТОЛЬКО внутри этого блока
stickers = []
found_duck = False

lines = sticker_search_content.split('\n')
for line in lines:
    # Ищем Duck как начало
    if 'Duck' in line or 'Cherry' in line:
        found_duck = True
    
    if found_duck:
        # Извлекаем названия с кнопками ADD/ADDED
        if 'name:' in line and 'button' in lines[lines.index(line) + 1]:
            name = extract_name(line)
            stickers.append(name)
            
    # Yeti - конец списка
    if 'Yeti' in line:
        break

print(f"Found {len(stickers)} sticker packs")
```

## 8. ПРОВЕРКА РЕЗУЛЬТАТА

- [ ] Первый стикер: Duck Emoji или Cherry Emoji
- [ ] Последний стикер: Yeti on Holidays
- [ ] Количество: 230-260
- [ ] Нет дубликатов
- [ ] Нет стикеров из левой панели (Recently Used и т.д.)

## 9. ВАЖНО!

**Элемент StickerSearch - это МОДАЛЬНОЕ ОКНО**, которое появляется при поиске стикеров. Не путать с основным списком стикеров слева!

**Все стикеры в этом окне имеют кнопку ADD или ADDED справа от названия.**

**ref элементов** можно использовать для клика на превью стикера.

