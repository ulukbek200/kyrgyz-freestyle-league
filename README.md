# Kyrgyz Freestyle League — платформа лиги вольной борьбы

Монорепозиторий: `apps/api` (Node + Express + Prisma + PostgreSQL) и `apps/web` (React + Vite + Ant Design).

## Запуск

```bash
npm install
docker compose up -d                  # PostgreSQL
cp apps/api/.env.example apps/api/.env   # уже скопирован; поменяйте JWT_SECRET
npm run db:migrate                    # создать таблицы
npm run db:deploy                     # применить сохранённые миграции
# db:seed очищает данные; только для одноразовой БД с ALLOW_DESTRUCTIVE_SEED=yes
npm run dev:api                       # http://localhost:4000
npm run dev:web                       # http://localhost:5173
```

Админка: `/admin`, логин `admin@league.kg`, пароль `admin12345` (смените после первого входа).

## Как это работает

- Рейтинг не хранится вручную: `modules/rankings` пересчитывает его из завершённых матчей (`recalculate`) и пишет snapshots после каждого события.
- Формула — `modules/rankings/rankingRules.ts` (дефолты) + `Season.rankingRules` (JSON-переопределение). Правка результата матча → полный пересчёт.
- Титулы: матч типа `CHAMPIONSHIP`/`TITLE_DEFENSE` автоматически меняет чемпиона или фиксирует защиту (`modules/champions`).
- Права проверяются только на backend: `/api/admin/*` за JWT + `requireRole('ADMIN')`, rate limit на логин и заявки, zod-валидация, audit log.
- i18n: RU/KY/EN (`apps/web/src/i18n`), основной язык — RU.

## Дальше (Phase 2–3)

Cloudinary, пользователи/модераторы, Telegram-уведомления, live scoring, SSR/prerender для SEO и sitemap, деплой (`DATABASE_URL`, `JWT_SECRET`, `WEB_URL`; для веба — прокси `/api` и `/uploads` на API).

## Стабилизация и проверки

```bash
npm run db:check -w @league/api        # read-only проверка целостности существующих записей
npm run db:deploy                     # миграции без reset/seed
npm run db:rebuild -w @league/api      # рейтинг, snapshots, титулы из результатов матчей
npm run typecheck
npm run build
npm test                             # unit + PostgreSQL integration
```

Интеграционные тесты создают временную схему `hardening_test_<random>` в PostgreSQL,
применяют обе миграции и удаляют только эту схему после выполнения. Используется
`TEST_DATABASE_URL`, если задан, иначе `DATABASE_URL` из `apps/api/.env`.
Роль БД должна иметь право создавать схемы. Основные данные тесты не очищают.

Для отдельного ручного HTTP-прогона: из `apps/api` выполните
`node tests/run-integration.cjs --manual`. Будет создана отдельная схема и API на
`127.0.0.1:4101`. Тестовая учётная запись выводится в терминал. Завершение:
`POST http://127.0.0.1:4101/__qa/finish` — сервер завершится, временная схема удалится.
Этот служебный endpoint отсутствует в основном API.

Порядок работы администратора: создать спортсменов → создать сезон → выбрать
категории в блоке «Состав сезона» → добавить спортсменов → создать событие и матч.
Создание/одобрение спортсмена больше не добавляет его неявно в произвольный сезон.
Архив доступен через фильтр ARCHIVED; история открывается по имени спортсмена.
Редактор результата загружает сохранённые периоды; сумма периодов должна совпадать
с итоговым счётом. Исправление победителя пересчитывает титулы и рейтинг.

Правила пересчёта и полный отчёт: [HARDENING.md](HARDENING.md).

## Phase 2: браузерная проверка

Запустите изолированный API из apps/api: `node tests/run-integration.cjs --manual`. В отдельном PowerShell из корня задайте `$env:API_PROXY_TARGET='http://127.0.0.1:4101'` и запустите `npm run dev -w @league/web -- --host 127.0.0.1 --port 5175 --strictPort`. Затем из корня: `npx playwright test --config apps/web/playwright.config.ts`. Требуется установленный Microsoft Edge. Тесты отказываются работать без признака изолированной QA-схемы. После прогона выполните POST на `http://127.0.0.1:4101/__qa/finish` и остановите QA Vite.

Обычная разработка требует одновременно `npm run dev:api` (порт 4000) и `npm run dev:web`. Ошибки Vite /api с кодом 500 при недоступном API проверяйте запросом к `http://localhost:4000/api/health`.

Подробный отчёт: [PHASE2_REPORT.md](PHASE2_REPORT.md).
