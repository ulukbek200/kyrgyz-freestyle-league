# KFL — подготовка ветки онлайн-запуска

Дата: 15 октября 2026 года. Репозиторий: `C:\Users\user\Desktop\kfl-github`, ветка `kfl-online-launch`. Источник актуального приложения: `C:\Users\user\Desktop\ligue`.

## Синхронизация и история

Ветка создана от `main` (`603fc94`). Исходная main и история сохранены; git init/reset/force push не применялись. Начальное состояние было чистым и совпадало с локальной ссылкой origin/main. Обращения к GitHub для проверки свежести remote не выполнялись.

Перенесены текущие API, frontend, Prisma schema и восемь миграций, тесты, npm manifests/lockfile, конфигурации Render/Vercel и документация. Точный список изменений находится в [docs/GITHUB-SYNC-FILES.md](docs/GITHUB-SYNC-FILES.md).

GitHub-копия содержала другую архитектуру: `src/app.ts`, `modules/*`, `routes/*`, другой React App и начальные миграции. После проверки импорта текущим приложением 78 устаревших файлов удалены из новой ветки, а не оставлены рядом с несовместимыми моделями. Их версии остаются в исходном коммите main. В том числе удалены три прежние миграции из активной цепочки; пустые папки удалены после диагностической ошибки Prisma P3015. Документы HARDENING.md, NARYN_IMPLEMENTATION_PLAN.md, PHASE2_REPORT.md и существующие инструкции оставлены как исторические материалы, а не актуальные инструкции запуска.

**Это подготовка актуального приложения для новой пустой БД. Это НЕ автоматический путь обновления базы, созданной прежними миграциями GitHub-копии.** Такую базу сначала нужно отдельно исследовать и подготовить перенос данных. Ни одна существующая рабочая БД в этом этапе не изменялась.

## Безопасность

- `seed.ts`: пароль только из SEED_ADMIN_PASSWORD (минимум 16 символов). Production запрещён; требуется ALLOW_DESTRUCTIVE_SEED=yes, совпадение DATABASE_URL с TEST_DATABASE_URL и проверка отдельной локальной тестовой базы. Seed не запускался. Для первого реального администратора предназначен `admin:bootstrap`, не seed.
- `manual-server.ts`: использует существующий безопасный browser fixture и проверенную тестовую БД; пароль генерируется случайно и остаётся в игнорируемой `.local`. Пароль не печатается.
- `docker-compose.yml`: POSTGRES_PASSWORD обязателен через окружение. Имя существующего Docker volume сохранено из актуального проекта. Изменение переменной не меняет пароль уже инициализированной PostgreSQL — Docker здесь не запускался и пароли баз не менялись.
- `.env.example`: только пустые значения/явные placeholders. API использует корневой .env; вложенный example объясняет это.
- `.gitignore`: секреты, uploads, node_modules, дампы, локальные БД, логи, скриншоты evidence и результаты тестов исключены. Данные аудита групп и фотографии спортсменов не входят в commit. Старые evidence-скриншоты исключены из подготовленной копии; ссылки на них в исторических отчётах могут вести только к локальным материалам.
- Тестовые пароли API/browser создаются случайно. Заведомо неверные строки в негативных тестах являются тестовыми входами, не действующими учётными данными.
- Встроенные пароли прежнего коммита считаются потенциально скомпрометированными. Они остаются в истории, которую по заданию не переписывали. Если где-либо использовались — заменить там вручную. Новых похожих на действующие ключей/токенов при сканировании не обнаружено; это проверка по шаблонам и коду, а не гарантия полного отсутствия любых секретов.

## Проверки из kfl-github

Команды запускались с тестовыми переменными, без копирования рабочего .env. В Windows использован NODE_OPTIONS=--preserve-symlinks --preserve-symlinks-main. Зависимости установлены заново через `npm ci --include=dev --no-audit --no-fund` (335 packages).

- `npm run db:generate`: Prisma Client 6.19.3.
- `npm run typecheck`: успешно.
- `npm test`: 54/54, без пропусков.
- `npm run build`: backend и frontend успешно; остаётся предупреждение о крупном Ant Design chunk.
- `npm run db:validate`: успешно.
- `npm --workspace apps/api run test:team -- api`: 30/30, без пропусков. Полная цепочка миграций применена в новых изолированных схемах локальной тестовой базы. Проверены роли, bootstrap, транзакции, результаты и турнирный цикл.
- Дополнительно проверены 10 вариантов production/development URL и отсутствие локальных API endpoints в собранном frontend.

- `npm --workspace apps/web exec -- tsc --noEmit -p tsconfig.test.json --noUnusedLocals --noUnusedParameters`: успешно.
- `npm --workspace apps/api run test:team -- browser`: **40/40 за один полный прогон**, включая ADMIN, REGISTRAR, upload, блокировку аккаунта, мобильную адаптивность и групповой турнир/плей-офф.

Журналы находятся только локально в `ligue/.local/sync`; browser artifacts — в `kfl-github/.local`. Все интеграционные проверки выполнялись на `kfl_tournament_test` с проверкой маркера назначения; рабочая локальная база и Neon не использовались. Отдельного lint-скрипта в проекте нет; проверка неиспользуемых импортов выполнена TypeScript. Полный аудит уязвимостей зависимостей не проводился.

## Влияние на Vercel

Ветка меняет актуальную реализацию публичных страниц и админки относительно старой main. Frontend должен развёртываться с соответствующим новым backend. Совместимость со старым API не заявляется.

`vercel.json` рассчитан на Root Directory **корень monorepo**, build `npm --workspace apps/web run build`, output `apps/web/dist`, SPA rewrite. Не менять Root Directory существующего production-проекта до отдельного согласования.

Production-сборка теперь требует VITE_API_URL вида `https://<backend>/api`, без пароля/query/hash. При отсутствии значения или localhost сборка намеренно завершается ошибкой. Проверочная сборка использовала фиктивный HTTPS-домен `.invalid`, не реальный backend и не Neon. Этот dist нельзя публиковать как готовый production artifact; Vercel должен пересобрать с реальным значением.

Для `kfl-online-launch` добавлено `git.deploymentEnabled=false` в конфигурацию. Vercel обычно запускает deployment при push; перед разрешением push проверить Root Directory и обработку этого конфига в существующем проекте, либо отключить auto-deploy в его настройках. Удалённые настройки не менялись. [Документация Vercel](https://vercel.com/docs/project-configuration/git-configuration).

## Neon и Render — только после отдельного разрешения

1. Neon: проверить именно новую пустую БД проекта kfl_production в Frankfurt и её фактическое имя (имя проекта не равно автоматически имени PostgreSQL database). Установить новый уникальный пароль. Получить TLS connection string через защищённое окружение; не присылать его в отчёт/commit.
2. Текущий код использует Prisma 6.19.3, не требует миграции на Prisma 7/нового adapter. Для первого одиночного backend допустима прямая TLS-ссылка DATABASE_URL. Для миграций использовать direct connection; при будущем использовании pooled runtime URL передавать direct URL в окружении команды миграции. Не переносить инструкции Prisma 7 в этот проект механически. [Neon connection guidance](https://neon.com/docs/guides/prisma).
3. Render: root monorepo; build `npm ci --include=dev && npm --workspace apps/api run db:generate && npm --workspace apps/api run build`; start `npm --workspace apps/api start`. NODE_VERSION=22, NODE_ENV=production; PORT выдаёт платформа. Локальные проверки выполнены на Windows Node 20.11.1 — Linux/Node 22 требуют staging smoke test.
4. Переменные backend: DATABASE_URL, новый JWT_SECRET, WEB_ORIGIN с точными HTTPS-доменами Vercel, корректные TRUSTED_PROXIES, UPLOAD_DIR=/var/data/uploads. Не задавать безусловное trust proxy. Проверить реальный client IP и limiter после настройки платформы.
5. Persistent disk `/var/data`, подходящий план, один экземпляр backend. Файловое хранилище и rate limiter пока не рассчитаны на несколько экземпляров. Диск доступен только runtime, не build/pre-deploy. Резервировать отдельно PostgreSQL и фото. [Render disks](https://render.com/docs/disks).
6. После проверки назначения БД и отдельного разрешения: `npm --workspace apps/api run db:deploy`. Reset/db push/seed не использовать. `preDeployCommand` остаётся выключенным. Импорт Render Blueprint сам запускает создание ресурсов/deploy — сейчас не выполнять.
7. Первый ADMIN: BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD (16+), BOOTSTRAP_DATABASE (точное имя), BOOTSTRAP_CONFIRM=CREATE_FIRST_ADMIN; команда `npm --workspace apps/api run admin:bootstrap`. После создания убрать bootstrap-переменные. ADMIN затем создаёт REGISTRAR в интерфейсе.
8. `/api/health` — liveness, `/api/ready` — PostgreSQL readiness. Перед публичным запуском проверить оба по HTTPS, создание аккаунта/спортсмена, upload после рестарта и 403 запрещённых действий регистратора.
9. Vercel: реальный VITE_API_URL в нужном окружении, согласованный CORS origin; секреты backend никогда не помещать в VITE_*. Preview должен использовать отдельную staging БД.

## Разрешения для следующих действий

Итог перед commit: TypeScript, сборки, Prisma validation, 54 модульных, 30 API и 40 браузерных тестов прошли. `git diff --cached --check` чистый. Проверка индекса не выявила секретных файлов/дампов, известных старых паролей, признаков приватных ключей и токенов; восемь проверок ignore прошли. Исторический коммит main сохранён. Подготовлен локальный commit с названием `Prepare KFL online launch and registrar access`.

**Код готов к согласованному push ветки. Backend подготовлен к Render, но облачный запуск не проверен и не выполнен.** Остаточные риски: старые пароли в истории; несовместимость с прежней схемой GitHub-базы; необходимость реальных настроек окружения и persistent disk; Node 22/Linux и HTTPS smoke test; возможный автодеплой при неверном Root Directory Vercel; крупный frontend chunk. Ротация действующих учётных данных, если использовались старые значения, остаётся отдельным действием владельца.

Отдельно подтвердить: push подготовленной ветки (после проверки запрета auto-deploy); затем создание/настройку Render и применение миграций к конкретной пустой Neon DB; bootstrap администратора; согласованный preview/staging deploy; после проверки — merge и production deploy. Сейчас ни одно из этих удалённых действий не выполнено.

Подготовленная команда, **не выполненная**: `git push -u origin kfl-online-launch`.
