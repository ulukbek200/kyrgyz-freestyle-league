# Naryn U17 — audit and implementation plan

Дата задания: 2026-10-08. Реализация внутри существующего Wrestling League; без сброса БД и фиктивных официальных результатов.

## Аудит

Express + Prisma/PostgreSQL, React/Ant Design, React Query. Существуют Season, SeasonAthlete, SeasonWeightClass, Athlete, WeightClass, Event, Match/MatchScore, Ranking/RankingSnapshot, Championship/TitleDefense, AuditLog. Спортивные записи изменяются через writeTransaction с advisory lock. submitResult валидирует участников/счёт/периоды и пересчитывает рейтинг и титулы. Публичные проекции учитывают публикацию событий.

Нет территорий, возрастных категорий, турнирной конфигурации, групп, жеребьёвки, Round Robin, отдельных групповых таблиц, правил квалификации, графа плей-офф, классификации и live-управления. Имеющийся рейтинг лиги нельзя использовать как таблицу группы. Любой текущий завершённый матч попадает в rankingProjection — необходим явный opt-out для турнирных матчей.

## Переиспользование и расширение моделей

- Season, Athlete, Event, Match остаются источниками исходных спортивных данных; MatchScore хранит периоды.
- Match: признак участия в официальном рейтинге (старые записи сохраняют true); необязательная связь с турнирным слотом.
- Season: необязательная конфигурация Competition. Athlete/WeightClass/User получают обратные связи.
- Новые сущности: Territory, CompetitionAgeCategory, Competition, CompetitionTerritory, CompetitionParticipant, CompetitionDivision, CompetitionGroup, CompetitionGroupMember, CompetitionRuleset, CompetitionFixture, CompetitionApproval, CompetitionPlacement.
- Standings вычисляются из официальных Match, не из отдельного источника счёта. Подписанные утверждения содержат версию/снимок и автора.
- CompetitionFixture представляет также будущий слот без известных соперников; обычный Match создаётся только после определения обоих участников.
- Call Time, Mat Number, week/stage, источник победителя/проигравшего и подтверждение результата принадлежат Fixture.

## API

Публичный namespace /api/competitions: список; детализация; groups/standings; schedule/results с фильтрами; bracket; live. Дополнение профиля спортсмена турнирными данными.
Административный namespace /api/admin/competitions: конфигурация, territories, age-categories, participants, divisions, draw preview/save/approve/amend, rules draft/approve, schedule generate/edit, results confirm/correct, standings, ties resolution, qualification approve, bracket generate, classification configuration/matches, placements approve, live, approval/audit history.
Каждая операция ограничена текущей ADMIN-ролью; утверждения фиксируют конкретного пользователя. Все записи проверяют принадлежность competition/division/season. Критические изменения транзакционны.

## Этапы

1. Database & Competition Engine: additive migration; CRUD конфигурации; проверка квот и территорий; seed-based preview draw; draft/approval; circle-method Round Robin; явный неутверждённый Ruleset; детерминированные групповые таблицы. Unit/integration tests.
2. Playoff Engine: блокирующие проверки результатов, правил и равенств; подписанная квалификация; редактируемые пары посева; граф зависимостей; продвижение; явное решение об аннулировании зависимых результатов с причиной вместо молчаливой замены. Классификация и места 1–5 только по утверждённой схеме. Tests.
3. Public UI: competition overview/groups/schedule/results/playoffs/athletes/live; мобильные карточки/таблицы; отдельные данные соревнования в профиле. Не смешивать групповые позиции с рейтингом лиги.
4. Admin UI: Competition Management с конфигурацией, составом, жеребьёвкой, правилами, календарём, результатами, утверждениями, классификацией и эфиром. Предпросмотр и подтверждения критических действий.
5. QA: 15 сценариев нового ТЗ, старые 27 тестов, UI-путь, 10 ширин, доступность, публикация и изоляция сезонов, сборки, проверка сохранности рабочих данных.

## Риски и ограничения

Риски: пересчёт лиги из турнирных матчей; обход ограничений через старые match endpoints; публикация скрытого соревнования; изменение состава/правил после сыгранных матчей; изменение участника уже сыгранного следующего раунда; устаревшее утверждение после исправления. Для каждого нужны серверные запреты и регрессионные тесты.

Справочники/параметры хранятся в БД. Пилотный шаблон 6 территорий × 7 весов × 4 участника не создаёт вымышленных спортсменов. Очки, tie-break, возрастной cutoff и классификационная схема требуют явного решения спортивного директора. Пока необходимые правила не утверждены, интерфейс показывает предварительный статус; спортивную готовность не заявлять.

Предшествующий FINAL QA ещё закрывается: чистая сборка и 27 backend tests прошли; расширенный UI-путь с исправлением титула прошёл; найдены и исправляются проблемы доступности/320px состава. Отдельные отчёты не подменяются новым этапом.
