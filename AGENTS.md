# AGENTS — StickerArt Web (Telegram Mini App)

Критерии merge и процесс для людей. Агент подхватывает то же на **каждом промпте** через `.cursor/rules/stickerart-agent-harness.mdc` (`alwaysApply: true`) — при изменении этого файла **обнови и harness**, чтобы не расходилось.

Детальные guardrails: `.cursor/rules/*.mdc`. Доменный справочник (API, лайки, dev): `.cursor/api-reference.md`. Локальные непубликуемые заметки: `.cursor/api-reference.local.md`, `AGENTS.local.md` (см. `.gitignore`).

## Что значит хороший merge

- **Сборка и статика**: `npm run lint` без предупреждений (`--max-warnings 0`), TypeScript как в `npm run build` (`tsc` + `vite build`), тесты по затронутому scope (Vitest / Playwright — см. `stickerart-testing-and-pr.mdc`).
- **Один стиль в репозитории**: не плодить альтернативные слои для HTTP, состояния и валидации; расширять существующие точки входа (`miniapp/src/api/client`, Zustand-сторы).
- **Граница данных**: сужать `unknown`/ответ API до типов на границе; внутри фич — предсказуемые типы.
- **Ревью-долг**: повторяющиеся замечания переводить в ESLint, правило или тест — цель убрать *класс* ошибок, а не бесконечный чеклист в голове.

## Контекст репозитория

- **Стек**: Vite, React 18, TypeScript, Zustand, axios через `miniapp/src/api/client.ts`, Vitest, Playwright.
- **Структура**: `miniapp/src/` — `components/`, `pages/`, `hooks/`, `store/`, `api/`, `utils/`, `types/`. Не pnpm-workspace — однородность через один ESLint и npm-скрипты.
- **Бэкенд**: https://stickerartgallery-e13nst.amvera.io/swagger-ui/index.html

## Операционный цикл

- **«Сборка мусора»** (по необходимости): замечания из PR → правило `.mdc`, ESLint или тест; планы/ADR в репо — править осмысленно, не как шум.
- **PR**: для UI — короткий QA и при необходимости скрин/видео; критичные сценарии — в правилах тестов.

## Чего не делать

- Не требовать формального исполнения каждого прошлого комментария ревью вне контекста задачи.
- Не раздувать лишние skills/правила: лучше несколько сильных файлов.
