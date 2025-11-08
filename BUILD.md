# 🏗️ Build Documentation

## Структура проекта после сборки

```
dist/
├── index.html                 # Корневой редирект на /miniapp/
└── miniapp/
    ├── index.html            # Главная страница приложения
    ├── assets/               # JS, CSS, изображения
    │   ├── index-*.js
    │   ├── react-vendor-*.js
    │   ├── index-*.css
    │   └── *.webp
    └── ...
```

## 📦 Процесс сборки

### 1. TypeScript Compilation
```bash
npx tsc
```
- Проверяет типы TypeScript
- Не генерирует выходные файлы (только проверка)

### 2. Vite Build
```bash
npx vite build
```
- **Root**: `miniapp/` (согласно `vite.config.ts`)
- **Output**: `dist/miniapp/` (согласно `build.outDir: '../dist/miniapp'`)
- **Base URL**: `/miniapp/` (согласно `base: '/miniapp/'`)
- Минификация, tree-shaking, code splitting
- Генерирует `dist/miniapp/index.html` и assets

### 3. Copy Root Redirect
```bash
mkdir -p dist && cp index.html dist/
```
- Копирует корневой `index.html` с редиректом в `dist/`
- Обеспечивает работу `https://domain.com/` → `https://domain.com/miniapp/`

## 🐳 Docker Build

### Stage 1: Builder
```dockerfile
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit
COPY miniapp ./miniapp
COPY index.html vite.config.ts tsconfig.json tsconfig.node.json ./
RUN npx tsc && npx vite build && mkdir -p dist && cp index.html dist/
```

**Результат**: 
- `dist/miniapp/` - полное приложение
- `dist/index.html` - корневой редирект

### Stage 2: Nginx
```dockerfile
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/app.conf.tpl
```

**Nginx структура**:
```
/usr/share/nginx/html/
├── index.html           → Редирект на /miniapp/
└── miniapp/
    ├── index.html       → React приложение
    └── assets/          → Статика
```

## 🔧 Локальная сборка

### Linux/macOS
```bash
npm run build
```

### Windows (PowerShell)
```bash
npm run build:win
```

## ✅ Проверка сборки

После сборки проверьте:

1. **Файлы созданы**:
   ```bash
   ls -la dist/
   ls -la dist/miniapp/
   ```

2. **Корректное содержимое**:
   - `dist/index.html` - должен содержать редирект
   - `dist/miniapp/index.html` - должен содержать `<div id="root">`
   - `dist/miniapp/assets/` - должны быть JS/CSS с хешами

3. **Локальный preview**:
   ```bash
   npm run preview
   # Откройте http://localhost:4173/
   ```

## 🚀 Deployment

### Amvera (Docker)

1. **Push код в Git**:
   ```bash
   git add .
   git commit -m "fix: update build process"
   git push
   ```

2. **Amvera автоматически**:
   - Подтягивает изменения из Git
   - Запускает `docker build`
   - Деплоит новый контейнер
   - Доступно на `https://sticker-art-e13nst.amvera.io`

### Ручной Docker Build

```bash
docker build -t sticker-gallery .
docker run -p 80:80 -e BACKEND_URL=https://stickerartgallery-e13nst.amvera.io sticker-gallery
```

## 🐛 Troubleshooting

### Проблема: "ReferenceError: storedInitData is not defined"
**Причина**: Старая версия кода на production  
**Решение**: Пересобрать и задеплоить через Git push

### Проблема: 404 на /miniapp/
**Причина**: Неправильная структура dist/  
**Решение**: Убедитесь что `dist/miniapp/index.html` существует

### Проблема: Не работает редирект с корня
**Причина**: Отсутствует `dist/index.html`  
**Решение**: Проверьте что скрипт сборки копирует корневой index.html

## 📊 Vite Config Справка

```typescript
{
  base: '/miniapp/',           // Базовый URL для всех assets
  root: 'miniapp',             // Корень исходников
  build: {
    outDir: '../dist/miniapp', // Выход относительно root
    emptyOutDir: true,         // Очистка перед сборкой
  }
}
```

**Важно**: `outDir` относителен к `root`, поэтому:
- `root: 'miniapp'` + `outDir: '../dist/miniapp'` = `${projectRoot}/dist/miniapp`
























