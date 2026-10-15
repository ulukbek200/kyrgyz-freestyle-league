# Диагностика редакторов KFL — 13 октября 2026

## Точная причина

Браузер на `http://localhost:5173` обслуживался **другим проектом**: `C:\Users\user\Desktop\wl`. Vite-процесс PID 10176 имел в командной строке `C:\Users\user\Desktop\wl\node_modules\vite\bin\vite.js`. Изменяемый репозиторий находится в `C:\Users\user\Desktop\ligue`.

Дополнительная проверка: до переключения запрос `/src/pages/admin/components.tsx` на порту 5173 возвращал HTML другого приложения вместо JS-модуля и не содержал `AdminEditorLayout`. Команда прежнего процесса сохранена в `.local/previous-vite.json`. Это установленная причина, а не предположение о кеше или HMR.

В `ligue` редактор был подключён ещё до исправления:

| Участок | Файл и строка текущего исходника |
|---|---|
| HTML entry | `apps/web/index.html:1` → `/src/main.tsx` |
| Импорт Admin | `apps/web/src/main.tsx:1` |
| Маршрут `/admin/*` | `apps/web/src/main.tsx:23` |
| Маршрут `athletes` → AthletesAdmin | `apps/web/src/pages/admin/Admin.tsx:41` |
| Компонент AthletesAdmin | `apps/web/src/pages/admin/Management.tsx:19` |
| Форма спортсмена → FormDialog | `apps/web/src/pages/admin/Management.tsx:33` |
| FormDialog → AdminEditorLayout | `apps/web/src/pages/admin/components.tsx:287` |
| CSS редактора | `apps/web/src/pages/admin/AdminEditorLayout.tsx:5` |
| Общий редактор Drawer | `apps/web/src/pages/admin/AdminEditorLayout.tsx:32` |

FormDialog определён один раз. Management, MatchesAdmin, MediaAdmin и Operations импортируют его из `./components`. Параллельная система форм не создавалась. Уведомления подтверждения, предпросмотр публикации и существующий SimpleMatchWizard — отдельные функции; они не являются редактором спортсмена, сезона или турнира.

## Исправления

- Остановлен только идентифицированный Vite-процесс `wl`, занимавший 5173. На этот порт запущен frontend **ligue/apps/web**. Посторонний API на 4000 не изменялся: текущий frontend подключён к API этого проекта на **4401**, использующему проверенную отдельную локальную тестовую PostgreSQL.
- `apps/web/vite.config.ts:4`: корень явно привязан к директории конфигурации; `strictPort:true` запрещает незаметный переход с 5173 на другой порт при конфликте.
- `scripts/start-editor-dev.ps1`: воспроизводимый запуск из фактического корня проекта, проверка портов 5173/4401, проверка назначения локальной базы существующим защитным скриптом, скрытые фоновые процессы и отдельные логи. Существующий `.env` и секреты не меняются. PID и корень запуска сохраняются в `.local/editor-dev-processes.json`.
- `package.json`: команда `npm run dev:editor` для этого Windows-окружения. При занятых портах команда выдаёт ошибку, а не завершает неизвестные процессы.
- `apps/web/src/pages/admin/AdminEditorLayout.tsx`: `rootClassName` вместо `className` для корневой обёртки Drawer. В Ant Design 5 `className` относится к панели; селектор `.kfl-editor-drawer .ant-drawer-content` не мог применяться к самому элементу с обоими классами. Теперь существующие CSS-селекторы охватывают content, body и content-wrapper. Добавлены доступное имя диалога и защита закрытия при сохранении.
- `apps/web/src/pages/admin/components.tsx`: единая кнопка «Сохранить», прокрутка к первому невалидному полю; существующие API, контекст загрузки фотографий, блокировка закрытия и отправки сохранены.
- `apps/web/src/pages/admin/Management.tsx`: стабильная функция открытия и корректные зависимости эффекта React; поиск клуба в форме тренера.
- `apps/web/src/main.tsx`: удалены только 11 неиспользуемых импортов. Публичная разметка, Header, Footer и маршруты не менялись.
- `apps/web/playwright.editor.config.ts`, `apps/web/tests/editor.spec.ts`: проверка реального сервера на 5173 либо изолированного тестового frontend. Артефакты — `docs/editor-evidence/`.

`AdminEditorLayout.css` уже содержал нужный дизайн; переписывать его не потребовалось. Конфликтов с публичным style.css и admin.css в проверенных формах нет: проверены вычисленный тёмный фон, две колонки на desktop, одна на телефоне и ровно один прокручиваемый контейнер `.kfl-editor-content`.

Backend, Prisma, миграции, формулы рейтинга и обработчики результатов в этой задаче не изменялись. Новые библиотеки не устанавливались.

## Проверки

- `npm run db:local:check` — подтверждена тестовая БД `127.0.0.1:55432/kfl_stage2_test`.
- `npm run typecheck` — успешно.
- `npm --workspace apps/web exec -- tsc --noEmit --noUnusedLocals --noUnusedParameters -p tsconfig.json` — успешно после удаления неиспользуемых импортов.
- `npm --workspace apps/web run build` — успешно; существующее предупреждение о размере Ant Design chunk больше 500 kB.
- С переменной `EDITOR_LIVE_URL=http://localhost:5173`: `npm --workspace apps/web exec -- playwright test --config playwright.editor.config.ts` — **4/4** сценария с реальным API и отдельной тестовой PostgreSQL.
- Дополнительный регрессионный прогон существующих `admin-control.spec.ts` и `logout.spec.ts` — **7/7**: все 13 маршрутов, спортсмены, медиа, ошибки API, заявки, турниры/клубы и вход/выход. Использован фильтр `all 13|athlete form|media create|API error|application review|event form|administrator login`. Сценарий результатов матчей не перезапускался: их бизнес-логика в этой задаче не менялась.

Проверены создание/редактирование спортсмена и турнира, создание сезона, клуба и тренера, фотография, заполненные поля редактирования, обязательные поля и даты сезона, блокировка формы во время загрузки, сохранение значений при API 409, повторная успешная отправка, закрытие без сохранения и обновление списков. На ширинах **375, 390, 768, 1024, 1440 px** проверены отсутствие Modal/OK, положение панели, отсутствие горизонтального переполнения, неподвижность заголовка/кнопок при прокрутке и одна вертикальная прокрутка.

Визуально просмотрены снимки desktop и телефона. Встроенный браузер недоступен из-за ошибки среды `missing field sandboxPolicy`; фактическая автоматизация выполнена установленным Playwright с Microsoft Edge, а не заявлена без выполнения. Тесты создают только записи в отдельной локальной тестовой базе.

## Открыть и запустить повторно

Сейчас: **http://localhost:5173/admin/athletes**. Обновите старую вкладку браузера. Для входа используется учётная запись именно локального проекта ligue; тестовые реквизиты сохраняются только в `.local/browser-admin.json` и не публикуются в отчёте.

После остановки текущих dev-процессов:

```powershell
cd C:\Users\user\Desktop\ligue
npm run dev:editor
```

Запуск явно сообщает корень frontend. При занятом порте сначала проверьте владельца процесса; команда намеренно не останавливает чужие проекты автоматически. Для обычной конфигурации также сохранены `npm run dev:web` и `npm run dev`.
