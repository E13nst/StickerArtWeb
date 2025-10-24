# Переменные окружения для хостинга

## 🔧 Обязательные переменные для продакшена

### Основные настройки приложения
```bash
# URL бэкенда API
BACKEND_URL=https://stickerartgallery-e13nst.amvera.io

# Режим работы (production/development)
NODE_ENV=production
```

### Настройки Grafana (для мониторинга)
```bash
# Логин администратора Grafana
GRAFANA_ADMIN_USER=your_admin_username

# Пароль администратора Grafana (обязательно сложный!)
GRAFANA_ADMIN_PASSWORD=your_very_secure_password_here

# Время хранения метрик Prometheus
PROMETHEUS_RETENTION_TIME=720h  # 30 дней
```

## 🔒 Безопасность

### Обязательные требования к паролю Grafana:
- Минимум 12 символов
- Содержит заглавные и строчные буквы
- Содержит цифры и специальные символы
- Не используйте простые пароли типа "admin123" или "password"

### Примеры безопасных паролей:
```bash
GRAFANA_ADMIN_PASSWORD=St1ck3r@rt#2024!
GRAFANA_ADMIN_PASSWORD=Graf@na_M0n1t0r!ng
GRAFANA_ADMIN_PASSWORD=M3tr1cs_D@shb0ard#2024
```

## 🌐 Настройка на разных хостингах

### Amvera (рекомендуемый)
В панели управления Amvera добавьте переменные окружения:
1. Перейдите в раздел "Переменные окружения"
2. Добавьте все переменные из списка выше
3. Перезапустите приложение

### Docker Compose (локальная разработка)
```bash
# Создайте файл .env
cp monitoring.env.example .env

# Отредактируйте .env
nano .env

# Запустите
docker-compose up -d
```

### Kubernetes
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: grafana-secret
type: Opaque
stringData:
  GRAFANA_ADMIN_USER: "your_username"
  GRAFANA_ADMIN_PASSWORD: "your_secure_password"
```

## 📊 Дополнительные переменные (опционально)

### Настройки мониторинга
```bash
# Включить детальное логирование
LOG_LEVEL=info

# Настройки кэширования
CACHE_TTL=3600

# Настройки безопасности
ENABLE_CORS=true
CORS_ORIGINS=https://yourdomain.com,https://web.telegram.org
```

### Настройки производительности
```bash
# Максимальное количество соединений
MAX_CONNECTIONS=1000

# Таймауты
REQUEST_TIMEOUT=30s
KEEP_ALIVE_TIMEOUT=65s
```

## 🚀 Проверка настроек

После настройки переменных окружения проверьте:

1. **Доступность приложения:**
```bash
curl https://yourdomain.com/health
```

2. **Доступность Grafana:**
```bash
curl https://yourdomain.com/grafana/api/health
```

3. **Доступность метрик:**
```bash
curl https://yourdomain.com/metrics
```

## ⚠️ Важные замечания

1. **Никогда не коммитьте файлы с паролями** в git
2. **Используйте разные пароли** для разных окружений
3. **Регулярно меняйте пароли** (каждые 3-6 месяцев)
4. **Включите HTTPS** для всех внешних подключений
5. **Настройте брандмауэр** для ограничения доступа к портам мониторинга

## 🔧 Скрипт для проверки переменных

```bash
#!/bin/bash
# Проверка обязательных переменных окружения

required_vars=(
  "BACKEND_URL"
  "GRAFANA_ADMIN_USER" 
  "GRAFANA_ADMIN_PASSWORD"
)

for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "❌ Переменная $var не установлена"
    exit 1
  else
    echo "✅ $var установлена"
  fi
done

echo "🎉 Все обязательные переменные настроены!"
```
