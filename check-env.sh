#!/bin/bash

# Скрипт для проверки переменных окружения StickerArt
# Использование: ./check-env.sh

echo "🔍 Проверка переменных окружения StickerArt..."
echo "=============================================="

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Обязательные переменные
required_vars=(
  "BACKEND_URL"
  "GRAFANA_ADMIN_USER" 
  "GRAFANA_ADMIN_PASSWORD"
)

# Опциональные переменные
optional_vars=(
  "NODE_ENV"
  "PROMETHEUS_RETENTION_TIME"
  "LOG_LEVEL"
)

# Проверка обязательных переменных
echo -e "\n${YELLOW}📋 Обязательные переменные:${NC}"
all_required_set=true

for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo -e "❌ ${RED}$var${NC} - не установлена"
    all_required_set=false
  else
    # Скрываем пароль в выводе
    if [[ "$var" == *"PASSWORD"* ]]; then
      echo -e "✅ ${GREEN}$var${NC} - установлена (${#!var} символов)"
    else
      echo -e "✅ ${GREEN}$var${NC} - установлена"
    fi
  fi
done

# Проверка опциональных переменных
echo -e "\n${YELLOW}📝 Опциональные переменные:${NC}"
for var in "${optional_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo -e "⚪ $var - не установлена (будет использовано значение по умолчанию)"
  else
    echo -e "✅ ${GREEN}$var${NC} - установлена"
  fi
done

# Проверка безопасности пароля
echo -e "\n${YELLOW}🔒 Проверка безопасности пароля Grafana:${NC}"
if [ -n "$GRAFANA_ADMIN_PASSWORD" ]; then
  password_length=${#GRAFANA_ADMIN_PASSWORD}
  
  if [ $password_length -lt 8 ]; then
    echo -e "⚠️  ${RED}Пароль слишком короткий (минимум 8 символов)${NC}"
  elif [ $password_length -lt 12 ]; then
    echo -e "⚠️  ${YELLOW}Рекомендуется пароль длиннее 12 символов${NC}"
  else
    echo -e "✅ ${GREEN}Длина пароля: $password_length символов${NC}"
  fi
  
  # Проверка сложности пароля
  if [[ "$GRAFANA_ADMIN_PASSWORD" =~ [A-Z] ]] && [[ "$GRAFANA_ADMIN_PASSWORD" =~ [a-z] ]] && [[ "$GRAFANA_ADMIN_PASSWORD" =~ [0-9] ]]; then
    echo -e "✅ ${GREEN}Пароль содержит заглавные, строчные буквы и цифры${NC}"
  else
    echo -e "⚠️  ${YELLOW}Рекомендуется использовать заглавные, строчные буквы и цифры${NC}"
  fi
fi

# Итоговый результат
echo -e "\n${YELLOW}📊 Результат проверки:${NC}"
if [ "$all_required_set" = true ]; then
  echo -e "🎉 ${GREEN}Все обязательные переменные настроены!${NC}"
  echo -e "🚀 ${GREEN}Приложение готово к запуску${NC}"
  exit 0
else
  echo -e "❌ ${RED}Не все обязательные переменные настроены${NC}"
  echo -e "📖 ${YELLOW}См. документацию: HOSTING_ENV.md${NC}"
  exit 1
fi
