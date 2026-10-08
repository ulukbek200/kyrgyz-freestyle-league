
import { lazy, Suspense, useState } from 'react';
import {
  Link,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import {
  Input,
  Pagination,
  Select,
  Switch,
  Table,
  Tabs,
} from 'antd';

import { get } from '../api/client';

import {
  AthleteCard,
  fmt,
  fullName,
  Loading,
  MatchCard,
  Nothing,
  useTitle,
} from '../components/ui';

import {
  Cover,
  QueryState,
  useDebounce,
} from '../components/feedback';

import KFLAthleteProfile from '../components/KFLAthleteProfile';

const RankingChart = lazy(
  () => import('../components/RankingChart')
);

/* =========================================
   СПИСОК СПОРТСМЕНОВ
========================================= */

export function Athletes() {
  useTitle('Спортсмены');

  const [searchParams] = useSearchParams();

  const [filtersState, setFiltersState] = useState<any>({
    clubId: searchParams.get('clubId') ?? undefined,
    sort: 'ranking',
  });

  const filters = useDebounce(filtersState);

  const [page, setPage] = useState(1);

  const weightClassesQuery = useQuery({
    queryKey: ['wcs'],
    queryFn: () => get('/weight-classes'),
  });

  const clubsQuery = useQuery({
    queryKey: ['clubs'],
    queryFn: () => get('/clubs'),
  });

  const seasonsQuery = useQuery({
    queryKey: ['seasons'],
    queryFn: () => get('/seasons'),
  });

  const athletesQuery = useQuery({
    queryKey: ['athletes', filters, page],
    queryFn: () =>
      get('/athletes', {
        ...filters,
        page,
        limit: 12,
      }),
  });

  const updateFilter = (key: string, value: any) => {
    setFiltersState((previous: any) => ({
      ...previous,
      [key]: value || undefined,
    }));

    setPage(1);
  };

  return (
    <div className="wrap">
      <span className="eyebrow page-kicker">
        ATHLETE DATABASE
      </span>

      <h1 className="page-title">
        Спортсмены
      </h1>

      <div className="filters">
        <Input
          aria-label="Поиск спортсмена"
          placeholder="Имя или фамилия"
          allowClear
          onChange={(event) =>
            updateFilter('search', event.target.value)
          }
        />

        <Select
          aria-label="Вес"
          placeholder="Вес"
          allowClear
          onChange={(value) =>
            updateFilter('weightClassId', value)
          }
          options={weightClassesQuery.data?.map(
            (weight: any) => ({
              value: weight.id,
              label: weight.name,
            })
          )}
        />

        <Input
          aria-label="Страна"
          placeholder="Страна"
          allowClear
          onChange={(event) =>
            updateFilter('country', event.target.value)
          }
        />

        <Input
          aria-label="Город"
          placeholder="Город"
          allowClear
          onChange={(event) =>
            updateFilter('city', event.target.value)
          }
        />

        <Select
          aria-label="Клуб"
          placeholder="Клуб"
          allowClear
          value={filtersState.clubId}
          onChange={(value) =>
            updateFilter('clubId', value)
          }
          options={clubsQuery.data?.map(
            (club: any) => ({
              value: club.id,
              label: club.name,
            })
          )}
        />

        <Select
          aria-label="Сезон"
          placeholder="Сезон"
          allowClear
          onChange={(value) =>
            updateFilter('seasonId', value)
          }
          options={seasonsQuery.data?.map(
            (season: any) => ({
              value: season.id,
              label: season.name,
            })
          )}
        />

        <Select
          aria-label="Сортировка"
          value={filtersState.sort}
          onChange={(value) =>
            updateFilter('sort', value)
          }
          options={[
            {
              value: 'ranking',
              label: 'По рейтингу',
            },
            {
              value: 'wins',
              label: 'По победам',
            },
            {
              value: 'name',
              label: 'По имени',
            },
          ]}
        />

        <label>
          <Switch
            aria-label="Только чемпионы"
            onChange={(checked) =>
              updateFilter(
                'champion',
                checked ? 'true' : undefined
              )
            }
          />

          {' '}Чемпионы
        </label>
      </div>

      <QueryState query={athletesQuery}>
        {athletesQuery.data?.items?.length ? (
          <>
            <p className="muted">
              Найдено: {athletesQuery.data.total}
            </p>

            <div className="grid athlete-grid">
              {athletesQuery.data.items.map(
                (athlete: any) => (
                  <AthleteCard
                    key={athlete.id}
                    a={athlete}
                  />
                )
              )}
            </div>

            <Pagination
              className="pagination"
              current={page}
              pageSize={12}
              total={athletesQuery.data.total}
              onChange={setPage}
              showSizeChanger={false}
            />
          </>
        ) : (
          <Nothing />
        )}
      </QueryState>
    </div>
  );
}

/* =========================================
   ПРОФИЛЬ СПОРТСМЕНА
========================================= */

export function AthleteProfile() {
  const { id } = useParams();

  const [tab, setTab] = useState('overview');

  const athleteQuery = useQuery({
    queryKey: ['athlete', id],
    queryFn: () => get('/athletes/' + id),
    enabled: Boolean(id),
  });

  const athlete = athleteQuery.data;

  useTitle(
    athlete
      ? fullName(athlete)
      : 'Спортсмен'
  );

  const ranking = athlete?.currentRanking;
  const stats = athlete?.stats;

  return (
    <QueryState query={athleteQuery}>
      {athlete && (
        <>
          {/* =================================
              НОВЫЙ PREMIUM PROFILE HERO
          ================================= */}

          <KFLAthleteProfile athlete={athlete} />

          {/* =================================
              ИНФОРМАЦИЯ И ВКЛАДКИ
          ================================= */}

          <div className="wrap section">
            <Tabs
              activeKey={tab}
              onChange={setTab}
              items={[
                {
                  key: 'overview',
                  label: 'Обзор',
                  children: (
                    <>
                      <div className="overview-grid">
                        <div className="card">
                          <span className="eyebrow">
                            ТЕКУЩИЙ СЕЗОН
                          </span>

                          <h3>
                            {athlete.currentSeason?.name ??
                              'Не объявлен'}
                          </h3>

                          <p>
                            Рейтинг:{' '}
                            {ranking
                              ? '#' + ranking.rank
                              : 'Нет позиции'}
                          </p>

                          <p>
                            {athlete.isChampion
                              ? 'Действующий чемпион'
                              : 'Претендент'}
                          </p>

                          <div className="recent-form">
                            {(stats?.recentForm ?? []).map(
                              (result: any) => (
                                <Link
                                  key={result.matchId}
                                  className={
                                    result.result === 'W'
                                      ? 'form-win'
                                      : 'form-loss'
                                  }
                                  to={
                                    '/matches/' +
                                    result.matchId
                                  }
                                  aria-label={
                                    result.result +
                                    ' · ' +
                                    fmt(result.date)
                                  }
                                >
                                  {result.result}
                                </Link>
                              )
                            )}
                          </div>
                        </div>

                        <div className="card">
                          <h3>
                            История спортсмена
                          </h3>

                          <p className="prose">
                            {athlete.bio ||
                              'Биография пока не опубликована.'}
                          </p>
                        </div>
                      </div>

                      <section className="section">
                        <h2>
                          Следующий матч
                        </h2>

                        {athlete.nextMatch ? (
                          <MatchCard
                            m={athlete.nextMatch}
                          />
                        ) : (
                          <Nothing />
                        )}
                      </section>

                      <section>
                        <h2>
                          Последний матч
                        </h2>

                        {athlete.latestMatch ? (
                          <MatchCard
                            m={athlete.latestMatch}
                          />
                        ) : (
                          <Nothing />
                        )}
                      </section>
                    </>
                  ),
                },

                /* =========================
                   МАТЧИ
                ========================= */

                {
                  key: 'matches',
                  label: 'Матчи',
                  children: (
                    <div className="table-scroll">
                      <Table
                        rowKey="id"
                        dataSource={athlete.matches ?? []}
                        scroll={{ x: 650 }}
                        columns={[
                          {
                            title: 'Дата',
                            render: (
                              _: any,
                              match: any
                            ) => (
                              <Link
                                to={
                                  '/matches/' +
                                  match.id
                                }
                              >
                                {fmt(
                                  match.scheduledAt,
                                  'D MMM YYYY'
                                )}
                              </Link>
                            ),
                          },
                          {
                            title: 'Соперник',
                            render: (
                              _: any,
                              match: any
                            ) => {
                              const opponent =
                                match.athleteAId ===
                                athlete.id
                                  ? match.athleteB
                                  : match.athleteA;

                              if (!opponent) {
                                return '—';
                              }

                              return (
                                <Link
                                  to={
                                    '/athletes/' +
                                    (opponent.slug ??
                                      opponent.id)
                                  }
                                >
                                  {fullName(opponent)}
                                </Link>
                              );
                            },
                          },
                          {
                            title: 'Результат',
                            render: (
                              _: any,
                              match: any
                            ) =>
                              match.status ===
                              'COMPLETED' ? (
                                <b
                                  className={
                                    match.winnerId ===
                                    athlete.id
                                      ? 'up'
                                      : 'down'
                                  }
                                >
                                  {match.winnerId ===
                                  athlete.id
                                    ? 'W'
                                    : 'L'}
                                </b>
                              ) : (
                                match.status
                              ),
                          },
                          {
                            title: 'Счёт',
                            render: (
                              _: any,
                              match: any
                            ) =>
                              match.status ===
                              'COMPLETED'
                                ? `${match.scoreA}:${match.scoreB}`
                                : '—',
                          },
                          {
                            title: 'Метод',
                            dataIndex: 'method',
                          },
                          {
                            title: 'Событие',
                            render: (
                              _: any,
                              match: any
                            ) =>
                              match.event ? (
                                <Link
                                  to={
                                    '/events/' +
                                    (match.event.slug ??
                                      match.event.id)
                                  }
                                >
                                  {match.event.name}
                                </Link>
                              ) : (
                                '—'
                              ),
                          },
                        ]}
                      />
                    </div>
                  ),
                },

                /* =========================
                   РЕЙТИНГ
                ========================= */

                {
                  key: 'ranking',
                  label: 'Рейтинг',
                  children:
                    tab === 'ranking' ? (
                      athlete.history?.length ? (
                        <Suspense
                          fallback={<Loading />}
                        >
                          <RankingChart
                            history={athlete.history}
                          />
                        </Suspense>
                      ) : (
                        <Nothing />
                      )
                    ) : null,
                },

                /* =========================
                   КАРЬЕРА
                ========================= */

                {
                  key: 'career',
                  label: 'Карьера',
                  children: (
                    <>
                      <h2>
                        Титулы и достижения
                      </h2>

                      {athlete.championships?.length ? (
                        athlete.championships.map(
                          (championship: any) => (
                            <div
                              className="card"
                              key={championship.id}
                            >
                              <span className="champ-label">
                                {championship.isCurrent
                                  ? 'CHAMPION'
                                  : 'TITLE HISTORY'}
                              </span>

                              <h3>
                                {championship.weightClass?.name ??
                                  'Весовая категория'}
                              </h3>

                              <p>
                                {championship.season?.name ??
                                  'Сезон'}
                                {' · '}
                                {fmt(
                                  championship.wonAt,
                                  'D MMM YYYY'
                                )}
                                {' · Защит: '}
                                {championship.defenses
                                  ?.length ?? 0}
                              </p>
                            </div>
                          )
                        )
                      ) : (
                        <Nothing />
                      )}

                      {athlete.achievements?.length >
                        0 && (
                        <ul>
                          {athlete.achievements.map(
                            (achievement: string) => (
                              <li key={achievement}>
                                {achievement}
                              </li>
                            )
                          )}
                        </ul>
                      )}
                    </>
                  ),
                },

                /* =========================
                   МЕДИА
                ========================= */

                {
                  key: 'media',
                  label: 'Медиа',
                  children: (
                    <>
                      {!athlete.mediaPosts?.length &&
                      !athlete.videos?.length &&
                      !athlete.photos?.length ? (
                        <Nothing />
                      ) : (
                        <div className="grid">
                          {(
                            athlete.mediaPosts ?? []
                          ).map((post: any) => (
                            <Link
                              className="card media-card"
                              key={post.id}
                              to={
                                '/media/' +
                                (post.slug ?? post.id)
                              }
                            >
                              <Cover
                                src={post.coverUrl}
                                alt={post.title}
                              />

                              <h3>
                                {post.title}
                              </h3>
                            </Link>
                          ))}

                          {(
                            athlete.photos ?? []
                          ).map((photo: any) => (
                            <Cover
                              key={photo.id}
                              src={photo.url}
                              alt={
                                photo.caption ??
                                fullName(athlete)
                              }
                            />
                          ))}

                          {(
                            athlete.videos ?? []
                          ).map((video: any) => (
                            <a
                              className="card"
                              key={video.id}
                              href={video.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {video.title ||
                                'Видео'}{' '}
                              ↗
                            </a>
                          ))}
                        </div>
                      )}
                    </>
                  ),
                },
              ]}
            />
          </div>
        </>
      )}
    </QueryState>
  );
}
