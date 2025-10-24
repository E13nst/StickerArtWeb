# StickerArt Monitoring Setup

Этот проект теперь включает полную настройку мониторинга с Grafana и Prometheus.

## Компоненты мониторинга

- **Grafana** (порт 3000) - веб-интерфейс для визуализации метрик
- **Prometheus** (порт 9090) - сбор и хранение метрик
- **Node Exporter** (порт 9100) - системные метрики сервера
- **Nginx Exporter** (порт 9113) - метрики веб-сервера

## Быстрый запуск

### Локальная разработка с мониторингом

```bash
# Запуск всех сервисов включая мониторинг
docker-compose up -d

# Проверка статуса
docker-compose ps
```

### Доступ к интерфейсам

- **Основное приложение**: http://localhost:80
- **Grafana**: http://localhost:3000 (admin/admin123)
- **Prometheus**: http://localhost:9090
- **Метрики приложения**: http://localhost/metrics

### Через основной домен (если настроен прокси)

- **Grafana**: http://yourdomain.com/grafana/
- **Prometheus**: http://yourdomain.com/prometheus/
- **Метрики**: http://yourdomain.com/metrics

## Настройка Grafana

### Настройка учетных данных

1. Отредактируйте файл `monitoring.env`:
```bash
# Измените эти значения на свои
GRAFANA_ADMIN_USER=your_username
GRAFANA_ADMIN_PASSWORD=your_secure_password
```

2. Перезапустите Grafana:
```bash
docker-compose restart grafana
```

### Первый вход

1. Откройте http://localhost:3000
2. Войдите с учетными данными из `monitoring.env`
3. Дашборд "StickerArt Monitoring Dashboard" будет автоматически загружен

## Кастомные метрики

Файл `monitoring/metrics.txt` содержит базовые метрики приложения:
- HTTP запросы по эндпоинтам
- Количество активных пользователей
- Общее количество стикеров
- Время отклика
- Время работы приложения

## Расширение мониторинга

### Добавление новых метрик

1. Обновите `monitoring/metrics.txt`
2. Перезапустите контейнеры: `docker-compose restart nginx`

### Создание новых дашбордов

1. Создайте JSON файл в `monitoring/grafana/dashboards/`
2. Перезапустите Grafana: `docker-compose restart grafana`

### Настройка алертов

1. Создайте файл правил в `monitoring/prometheus/rules/`
2. Обновите `monitoring/prometheus.yml`
3. Перезапустите Prometheus: `docker-compose restart prometheus`

## Остановка мониторинга

```bash
# Остановка всех сервисов
docker-compose down

# Остановка с удалением данных
docker-compose down -v
```

## Полезные команды

```bash
# Просмотр логов
docker-compose logs -f grafana
docker-compose logs -f prometheus

# Перезапуск конкретного сервиса
docker-compose restart grafana

# Обновление образов
docker-compose pull
docker-compose up -d
```
