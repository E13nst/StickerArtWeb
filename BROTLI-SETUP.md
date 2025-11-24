# Инструкция по включению Brotli сжатия в Nginx

## 📋 Что такое Brotli?

Brotli — алгоритм сжатия от Google, который сжимает данные на **15-25% лучше**, чем gzip. Особенно эффективен для текстовых файлов (HTML, CSS, JS, JSON).

## 🎯 Преимущества

- **Меньше трафика**: на 15-25% лучше сжатие чем gzip
- **Быстрая декомпрессия**: браузер распаковывает быстрее
- **Поддержка**: все современные браузеры (Chrome, Firefox, Safari, Edge)

## 🔧 Варианты установки

### Вариант 1: Использовать готовый образ с Brotli (Рекомендуется)

Используйте образ `nginx` с предустановленным модулем Brotli:

```dockerfile
# В Dockerfile замените:
FROM nginx:alpine

# На:
FROM fholzer/nginx-brotli:latest
# или
FROM nginx:alpine
RUN apk add --no-cache nginx-mod-http-brotli
```

### Вариант 2: Установить модуль в Alpine (Проще)

В `Dockerfile` добавьте установку модуля:

```dockerfile
# Stage 2: Nginx для раздачи статики
FROM nginx:alpine

# Устанавливаем модуль Brotli
RUN apk add --no-cache nginx-mod-http-brotli

# Остальной код остается без изменений
# ...
```

### Вариант 3: Компиляция nginx с модулем (Сложнее)

Если модуль недоступен через пакетный менеджер, нужно компилировать nginx:

```dockerfile
FROM alpine:latest AS nginx-builder

# Устанавливаем зависимости для компиляции
RUN apk add --no-cache \
    build-base \
    pcre-dev \
    zlib-dev \
    openssl-dev \
    git \
    linux-headers

# Клонируем nginx и модуль brotli
WORKDIR /tmp
RUN git clone https://github.com/google/ngx_brotli.git
RUN wget http://nginx.org/download/nginx-1.25.3.tar.gz && \
    tar -xzf nginx-1.25.3.tar.gz

# Компилируем nginx с модулем brotli
WORKDIR /tmp/nginx-1.25.3
RUN ./configure \
    --prefix=/etc/nginx \
    --sbin-path=/usr/sbin/nginx \
    --modules-path=/usr/lib/nginx/modules \
    --conf-path=/etc/nginx/nginx.conf \
    --error-log-path=/var/log/nginx/error.log \
    --http-log-path=/var/log/nginx/access.log \
    --pid-path=/var/run/nginx.pid \
    --lock-path=/var/run/nginx.lock \
    --http-client-body-temp-path=/var/cache/nginx/client_temp \
    --http-proxy-temp-path=/var/cache/nginx/proxy_temp \
    --http-fastcgi-temp-path=/var/cache/nginx/fastcgi_temp \
    --http-uwsgi-temp-path=/var/cache/nginx/uwsgi_temp \
    --http-scgi-temp-path=/var/cache/nginx/scgi_temp \
    --with-permissions=0777 \
    --user=nginx \
    --group=nginx \
    --with-compat \
    --with-file-aio \
    --with-threads \
    --with-http_addition_module \
    --with-http_auth_request_module \
    --with-http_dav_module \
    --with-http_flv_module \
    --with-http_gunzip_module \
    --with-http_gzip_static_module \
    --with-http_mp4_module \
    --with-http_random_index_module \
    --with-http_realip_module \
    --with-http_secure_link_module \
    --with-http_slice_module \
    --with-http_ssl_module \
    --with-http_stub_status_module \
    --with-http_sub_module \
    --with-http_v2_module \
    --with-mail \
    --with-mail_ssl_module \
    --with-stream \
    --with-stream_realip_module \
    --with-stream_ssl_module \
    --with-stream_ssl_preread_module \
    --add-module=/tmp/ngx_brotli \
    && make && make install

# Финальный образ
FROM alpine:latest
RUN apk add --no-cache pcre zlib openssl
COPY --from=nginx-builder /usr/sbin/nginx /usr/sbin/nginx
COPY --from=nginx-builder /etc/nginx /etc/nginx
# ... остальной код
```

## ✅ Активация Brotli в nginx.conf

После установки модуля, раскомментируйте настройки в `nginx.conf`:

```nginx
# Brotli compression (лучше чем gzip на 15-25%)
brotli on;
brotli_comp_level 6;  # 1-11, 6 - оптимальный баланс
brotli_types 
    text/plain 
    text/css 
    text/xml 
    text/javascript 
    application/javascript 
    application/json 
    application/xml 
    image/svg+xml;
brotli_min_length 256;  # Минимальный размер для сжатия
```

## 🔍 Проверка работы

### 1. Проверка в браузере (DevTools)

1. Откройте DevTools → Network
2. Найдите любой JS/CSS файл
3. Проверьте заголовок `Content-Encoding`:
   - Должно быть: `br` (Brotli) или `gzip` (fallback)

### 2. Проверка через curl

```bash
# Проверка поддержки Brotli
curl -H "Accept-Encoding: br" -I https://sticker-art-e13nst.amvera.io/miniapp/

# Должен вернуть: Content-Encoding: br
```

### 3. Проверка размера файлов

Сравните размеры до и после:
- **До**: файл передается с `Content-Encoding: gzip`
- **После**: файл передается с `Content-Encoding: br` (меньше размер)

## 📊 Ожидаемые результаты

Для типичного JavaScript файла (100 KB):
- **Без сжатия**: 100 KB
- **Gzip**: ~30 KB (70% сжатие)
- **Brotli**: ~25 KB (75% сжатие) — **экономия ~5 KB на файл**

Для JSON файлов (анимации стикеров):
- **Gzip**: ~40% сжатие
- **Brotli**: ~50% сжатие — **экономия ~10%**

## ⚠️ Важные замечания

1. **Fallback на gzip**: Браузеры, которые не поддерживают Brotli, автоматически получат gzip
2. **Приоритет**: Nginx сначала проверяет поддержку Brotli, затем gzip
3. **CPU нагрузка**: Brotli требует немного больше CPU для сжатия, но это компенсируется меньшим трафиком

## 🚀 Рекомендуемый порядок действий

1. **Выберите вариант установки** (рекомендуется Вариант 2)
2. **Обновите Dockerfile** с установкой модуля
3. **Раскомментируйте настройки** в `nginx.conf`
4. **Протестируйте локально** (если возможно)
5. **Задеплойте на продакшн**
6. **Проверьте работу** через DevTools или curl

## 📝 Текущий статус

- ✅ Gzip сжатие **включено** и работает
- ⏳ Brotli сжатие **подготовлено** (закомментировано в nginx.conf)
- 🔄 Ожидает установки модуля Brotli в Dockerfile

## 🔗 Полезные ссылки

- [Brotli на GitHub](https://github.com/google/brotli)
- [Nginx модуль Brotli](https://github.com/google/ngx_brotli)
- [Can I Use Brotli](https://caniuse.com/brotli)

