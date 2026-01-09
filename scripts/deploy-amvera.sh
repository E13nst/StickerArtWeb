#!/bin/bash

# Скрипт для деплоя на Amvera
# При выполнении потребуется ввести логин и пароль от Amvera

echo "🚀 Деплой на Amvera"
echo "===================="
echo ""
echo "При запросе введите логин и пароль от вашей учетной записи Amvera"
echo ""

cd "$(dirname "$0")/.." || exit 1

# Проверяем, что remote amvera существует
if ! git remote | grep -q "^amvera$"; then
    echo "⚠️  Remote 'amvera' не найден. Добавляю..."
    git remote add amvera https://git.msk0.amvera.ru/e13nst/sticker-art
    echo "✅ Remote 'amvera' добавлен"
fi

echo ""
echo "Текущая ветка:"
git branch --show-current
echo ""
echo "Последний коммит:"
git log -1 --oneline
echo ""
read -p "Продолжить деплой? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "📤 Отправка кода на Amvera..."
    git push --force amvera main:master
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Деплой успешно завершен!"
        echo "🌐 Проверьте статус сборки на https://amvera.ru"
    else
        echo ""
        echo "❌ Ошибка при деплое"
        exit 1
    fi
else
    echo "Деплой отменен"
    exit 0
fi
