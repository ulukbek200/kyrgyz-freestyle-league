# KFL — локальная подготовка команды

Дата проверки: 15 октября 2026 года.

## Результат

Этап 1 реализован локально. REGISTRAR создаёт спортсменов и загружает фотографии через ограниченный интерфейс `/admin`. Администратор создаёт такие аккаунты в разделе пользователей. Изменение спортсменов, результатов, рейтинга, турниров, сеток и пользователей регистратору запрещено на сервере (403). Существующая проверка актуальной роли и блокировки пользователя сохранена.

Доступ регистратора ограничен методом и маршрутом: GET session/lookups/age-reference/age-divisions и POST athletes/uploads внутри `/api/admin`. Остальные административные запросы запрещены по умолчанию. Справочники для регистратора не раскрывают полный реестр спортсменов. Клуб и тренер вводятся при регистрации, как в существующей архитектуре.

## Сохранность данных и миграция

Добавлена только enum-роль REGISTRAR, без удаления или преобразования записей. Миграция `202610150002_registrar` проверена на отдельной локальной базе `kfl_tournament_test`, затем применена к локальной рабочей `kfl_stage2_test` после проверки её назначения и резервного копирования.

Резервная копия: `.local/team-stage1/pre-registrar-2026-10-15T07-46-51.599Z.dump`. Каталог архива проверен через pg_restore; полное восстановление архива не выполнялось. Количество строк и контрольные суммы содержимого всех 24 прикладных таблиц до/после совпали. Результат: `.local/team-stage1/local-data-check.json`. Рабочие спортсмены, результаты, фотографии и остальные записи не удалялись. Тестовые записи создавались в отдельной тестовой базе.

Push, deploy, remote migrations и изменения production не выполнялись.

## Изменённые файлы

| Файлы | Изменение |
| --- | --- |
| `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/202610150002_registrar/migration.sql` | Добавочная роль REGISTRAR |
| `apps/api/src/auth.ts`, `apps/api/src/adminAccess.ts`, `apps/api/src/adminManagement.ts` | Авторизация, серверный allowlist, ограниченные справочники, создание аккаунтов и спортсменов |
| `apps/web/src/pages/admin/Registrar.tsx`, `Admin.tsx`, `Login.tsx`, `Management.tsx` в той же директории | Ограниченный интерфейс, вход, выбор роли администратором |
| `apps/api/src/bootstrapAdmin.ts`, `apps/api/scripts/bootstrap-admin.ts` | Безопасное создание первого администратора |
| `apps/api/src/storage.ts`, `runtimeConfig.ts`, `readiness.ts`, `shutdown.ts`, `server.ts`, `index.ts` в той же директории | Настраиваемые uploads, CORS, readiness, завершение сервера |
| `apps/api/package.json` | Команды bootstrap и проверок |
| `apps/api/scripts/test-database.ts`, `browser-fixture.ts`, `team-checks.ts` | Защита отдельной тестовой базы, воспроизводимый запуск проверок |
| `apps/api/tests/team.test.ts`, `api.integration.ts` в той же директории | Регрессии прав, bootstrap, readiness и shutdown |
| `apps/web/tests/registrar.spec.ts` | Браузерный сценарий регистратора |
| `render.yaml`, `vercel.json`, `.env.example`, `apps/web/.env.example`, `.gitignore`, `README.md`, этот отчёт | Конфигурации и инструкции |

Локальные журналы, снимки и вспомогательные скрипты находятся в игнорируемой `.local/team-stage1`. Новые зависимости не устанавливались.

## Проверки

| Проверка | Результат |
| --- | --- |
| `npm run typecheck` | Успешно |
| `npm --workspace apps/web exec -- tsc --noEmit -p tsconfig.test.json --noUnusedLocals --noUnusedParameters` | Успешно |
| `npm test` | 54/54 |
| `npm run build` | Backend и frontend успешно |
| `npm run db:validate` | Успешно |
| API, PostgreSQL и турнирные интеграции через `test:team -- api` | 30/30, отдельная PostgreSQL, без пропусков |
| Playwright через `test:team -- browser` | 39 существующих сценариев прошли; новый сначала остановился на неточном селекторе заголовка. После исправления новый сценарий повторно прошёл 1/1. Полный набор после этой правки повторно не запускался |
| Собранный API с NODE_ENV=production локально | Readiness, вход, upload, сохранение фотографии после перезапуска, разрешённый/запрещённый CORS origin прошли |
| `.gitignore` | 15 проверок в отдельном временном Git-репозитории прошли |

Браузер проверил создание REGISTRAR через ADMIN UI, настоящий вход, обновление страницы, мобильную форму 375 px, загрузку фото и создание спортсмена, прямые запрещённые API-запросы, страницу 403, выход и блокировку аккаунта. Снимок мобильной формы просмотрен: `.local/team-stage1/registrar-375.png`.

Штатный отдельный lint-скрипт отсутствует; ESLint-проверка не заявляется. Сохраняется предупреждение Vite о размере Ant Design chunk. Shutdown проверен модульно; реальное поведение сигналов Linux/Render ещё требует staging-проверки. Локальная среда Node 20, целевая конфигурация Render — Node 22.

### Повторение тестов

Передайте `TEST_DATABASE_URL` отдельно для `kfl_tournament_test` на `127.0.0.1:55432` с `schema=public`. База должна иметь проверяемую метку `KFL_TOURNAMENT_TEST_ONLY`. Проверяющий скрипт откажется использовать рабочую базу. Не копируйте рабочий DATABASE_URL в тестовый параметр.

```powershell
$env:NODE_OPTIONS='--preserve-symlinks --preserve-symlinks-main'
npm run typecheck
npm test
npm run build
npm --workspace apps/api run test:team -- api
npm --workspace apps/api run test:team -- browser
```

В текущем окружении использован локальный wrapper `.local/run-team-stage1.mjs api` / `browser`, который устанавливает адрес выделенной базы и вызывает тот же tracked runner. Runner применяет миграции только после проверки назначения тестовой БД. Тестовые uploads изолированы в `.local/team-test-uploads`. Старый `dev:editor`, использующий fixture, также подчиняется защите тестовой БД; для рабочего сайта используйте обычный `npm run dev`.

## Первый администратор

На существующей локальной базе bootstrap не запускался: администратор уже есть. Для новой подготовленной базы задайте через защищённое окружение:

- `BOOTSTRAP_ADMIN_EMAIL` — адрес администратора;
- `BOOTSTRAP_ADMIN_PASSWORD` — уникальный пароль, минимум 16 символов;
- `BOOTSTRAP_DATABASE` — точное ожидаемое имя базы;
- `BOOTSTRAP_CONFIRM=CREATE_FIRST_ADMIN`.

Команда: `npm --workspace apps/api run admin:bootstrap`. Скрипт проверяет имя БД, блокирует конкурентное создание, не заменяет пароль существующего администратора и не повышает роль существующего обычного пользователя. При наличии другого ADMIN отказывает. Создание и аудит атомарны. После выполнения уберите bootstrap-переменные. Не используйте seed для создания production-администратора.

## Что настроить вручную в Render после отдельного разрешения

1. Репозиторий monorepo, Root Directory — корень репозитория. `render.yaml` — подготовленная конфигурация, не развёрнутая услуга. Импорт Blueprint сам создаёт ресурсы и запускает первоначальный deploy даже при отключённом auto-deploy.
2. Создать облачную PostgreSQL и backend в одном регионе. Проверить назначение новой БД и условия TLS в выданной строке подключения. Указать DATABASE_URL только в backend environment.
3. Указать новый случайный JWT_SECRET (не менее 32 символов), NODE_ENV=production, WEB_ORIGIN с точными HTTPS origins frontend через запятую, UPLOAD_DIR=/var/data/uploads. Не использовать wildcard. Настроить TRUSTED_PROXIES по фактическим доверенным адресам/CIDR прокси; не включать безусловное доверие всем forwarded-заголовкам. После запуска проверить реальные client IP и rate limiting.
4. Подключить persistent disk `/var/data`; выбрать план, поддерживающий disk. Файлы хранятся в `/var/data/uploads`. Без абсолютного UPLOAD_DIR production API не стартует. Проверка пути сама по себе не гарантирует наличие persistent disk — его нужно подключить в Render.
5. Build: `npm ci --include=dev && npm --workspace apps/api run db:generate && npm --workspace apps/api run build`. Start: `npm --workspace apps/api start`. Readiness: `/api/ready` (200 при доступной PostgreSQL, иначе 503). Liveness: `/api/health`. PORT задаёт Render; API слушает 0.0.0.0. HTTPS завершается на платформе.
6. После резервного копирования и отдельного разрешения на целевую БД: `npm --workspace apps/api run db:deploy`. Для существующей БД сначала сверить migration history и schema. Не использовать migrate reset/db push/seed. `preDeployCommand` намеренно закомментирован до разрешения.
7. При переносе существующих фотографий отдельно скопировать файлы `.local/uploads` в persistent uploads, сохранив имена. Дамп PostgreSQL не содержит изображения. Проверить сохранённые абсолютные URL на localhost и согласовать их перенос отдельно, не заменять массово вслепую.
8. Если это совершенно новая база — выполнить bootstrap выше после разрешённой миграции. Затем через ADMIN UI создать отдельные аккаунты REGISTRAR с уникальными паролями.

Текущий storage — файловый persistent volume, не S3. Для одного экземпляра Render он пригоден; горизонтальное масштабирование потребует общего object storage и общего хранилища rate limiter. Организуйте отдельные резервные копии PostgreSQL и фотографий. Файлы uploads доступны публично, как и раньше.

## Что настроить вручную в Vercel

1. Сверить существующий Root Directory. Предложенный корневой `vercel.json` рассчитан на корень monorepo, build workspace web, output `apps/web/dist`. Если текущий проект использует `apps/web` как root, не смешивать эти настройки.
2. Указать `VITE_API_URL=https://<backend-domain>/api` для нужного окружения. Vite включает это значение при сборке; потребуется отдельно разрешённая повторная сборка/deploy.
3. Не передавать DATABASE_URL, JWT_SECRET или bootstrap-пароль в frontend/VITE-переменные.
4. Добавить фактический HTTPS домен frontend в backend WEB_ORIGIN. Для previews использовать отдельный staging backend/БД и явные разрешённые origins.
5. Проверить прямое открытие `/admin`, `/events` и внутренних страниц после deploy; подготовлен SPA rewrite.

Документация платформ: [Render Blueprint](https://render.com/docs/blueprint-spec), [Render Express](https://render.com/docs/deploy-node-express-app), [Vercel Vite](https://vercel.com/docs/frameworks/frontend/vite).

## Оставшиеся ограничения

Облачная PostgreSQL, Render persistent disk, HTTPS домены, реальные proxy IP и обновлённый Vercel frontend ещё не проверялись: deploy не разрешён. Root workspace не содержит `.git`; проверен механизм исключений, но фактический индекс будущего репозитория нужно проверить перед первым push. `.gitignore` не удаляет секреты, уже попавшие в историю Git.

Локальная подготовка завершена. Готовность облачного запуска зависит от ручной настройки и отдельной staging-проверки после разрешения.
