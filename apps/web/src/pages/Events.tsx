
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Segmented, Tabs } from 'antd';
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CalendarOutlined,
  EnvironmentOutlined,
  PlayCircleOutlined,
  TrophyOutlined,
} from '@ant-design/icons';

import { get } from '../api/client';

import {
  EventHero,
  fmt,
  fullName,
  MatchCard,
  Nothing,
  useTitle,
} from '../components/ui';

import { Cover, QueryState } from '../components/feedback';

import './KFLEvents.css';

type EventData = {
  id: string | number;
  slug?: string;
  name: string;
  date: string;
  coverUrl?: string | null;
  description?: string | null;
  venue?: string | null;
  city?: string | null;
  matchCount?: number;
  season?: {
    name?: string;
  } | null;
  matches?: any[];
  sponsors?: any[];
  streamUrl?: string | null;
  ticketUrl?: string | null;
};

const eventPath = (event: EventData) =>
  `/events/${encodeURIComponent(
    String(event.slug || event.id)
  )}`;

const isUpcoming = (event: EventData) =>
  new Date(event.date).getTime() >= Date.now();

function EventTile({
  event,
  featured = false,
}: {
  event: EventData;
  featured?: boolean;
}) {
  const upcoming = isUpcoming(event);

  return (
    <article
      className={
        'kfl-event-tile' +
        (featured ? ' kfl-event-tile--featured' : '')
      }
    >
      <div className="kfl-event-tile__media">
        {event.coverUrl ? (
          <img
            src={event.coverUrl}
            alt={event.name}
            loading={featured ? 'eager' : 'lazy'}
          />
        ) : (
          <div className="kfl-event-tile__placeholder">
            KFL
          </div>
        )}

        <div className="kfl-event-tile__overlay" />

        <span className="kfl-event-tile__status">
          {upcoming ? 'UPCOMING EVENT' : 'EVENT RESULTS'}
        </span>
      </div>

      <div className="kfl-event-tile__content">
        <span className="kfl-event-tile__eyebrow">
          {event.season?.name || 'KYRGYZ FREESTYLE LEAGUE'}
        </span>

        <h3>{event.name}</h3>

        <div className="kfl-event-tile__details">
          <span>
            <CalendarOutlined />
            {fmt(event.date)}
          </span>

          {(event.venue || event.city) && (
            <span>
              <EnvironmentOutlined />
              {[event.venue, event.city]
                .filter(Boolean)
                .join(', ')}
            </span>
          )}
        </div>

        <div className="kfl-event-tile__footer">
          <span>
            <TrophyOutlined />
            {event.matchCount ?? event.matches?.length ?? 0}
            {' '}СХВАТОК
          </span>

          <Link to={eventPath(event)}>
            {upcoming ? 'ПОДРОБНЕЕ' : 'РЕЗУЛЬТАТЫ'}
            <ArrowRightOutlined />
          </Link>
        </div>
      </div>
    </article>
  );
}

/* =========================================
   ВСЕ ТУРНИРЫ
========================================= */

export function Events() {
  useTitle('Турниры KFL');

  const [period, setPeriod] = useState('upcoming');

  const query = useQuery<EventData[]>({
    queryKey: ['events'],
    queryFn: () => get('/events'),
  });

  const events = (query.data ?? [])
    .filter(
      (event) =>
        isUpcoming(event) === (period === 'upcoming')
    )
    .sort((a, b) =>
      period === 'upcoming'
        ? +new Date(a.date) - +new Date(b.date)
        : +new Date(b.date) - +new Date(a.date)
    );

  const featured = events[0];
  const remaining = events.slice(1);

  return (
    <main className="kfl-events-page">
      <div className="kfl-events-page__intro">
        <div className="kfl-events-page__container">
          <span className="kfl-events-page__eyebrow">
            <span className="kfl-events-page__dot" />
            KYRGYZ FREESTYLE LEAGUE
          </span>

          <h1>
            НАШИ
            <br />
            <span>ТУРНИРЫ.</span>
          </h1>

          <p>
            Главные противостояния, новые чемпионы
            и история кыргызской вольной борьбы.
          </p>
        </div>
      </div>

      <div className="kfl-events-page__container">
        <div className="kfl-events-page__toolbar">
          <div>
            <span className="kfl-events-page__section-kicker">
              OFFICIAL KFL EVENTS
            </span>

            <h2>
              {period === 'upcoming'
                ? 'ПРЕДСТОЯЩИЕ СОБЫТИЯ'
                : 'АРХИВ ТУРНИРОВ'}
            </h2>
          </div>

          <Segmented
            aria-label="Период событий"
            value={period}
            onChange={(value) => setPeriod(String(value))}
            options={[
              {
                value: 'upcoming',
                label: 'Предстоящие',
              },
              {
                value: 'past',
                label: 'Прошедшие',
              },
            ]}
          />
        </div>

        <QueryState query={query}>
          {events.length ? (
            <>
              {featured && (
                <div className="kfl-events-page__featured">
                  <EventTile event={featured} featured />
                </div>
              )}

              {remaining.length > 0 && (
                <div className="kfl-events-page__grid">
                  {remaining.map((event) => (
                    <EventTile
                      key={event.id}
                      event={event}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="kfl-events-page__empty">
              <TrophyOutlined />

              <h3>
                {period === 'upcoming'
                  ? 'НОВЫЕ ТУРНИРЫ СКОРО'
                  : 'АРХИВ ПОКА ПУСТ'}
              </h3>

              <p>
                Информация появится после публикации
                событий организаторами KFL.
              </p>
            </div>
          )}
        </QueryState>
      </div>
    </main>
  );
}

/* =========================================
   СТРАНИЦА ТУРНИРА
========================================= */

export function EventPage() {
  const { id } = useParams();

  const query = useQuery<EventData>({
    queryKey: ['event', id],
    queryFn: () => get('/events/' + id),
    enabled: Boolean(id),
  });

  const event = query.data;

  useTitle(event?.name ?? 'Турнир KFL');

  const matches = event?.matches ?? [];

  const completed = matches.filter(
    (match: any) => match.status === 'COMPLETED'
  );

  return (
    <QueryState query={query}>
      {event && (
        <main className="kfl-event-detail">
          <div className="kfl-event-detail__back-wrap">
            <Link to="/events">
              <ArrowLeftOutlined />
              ВСЕ ТУРНИРЫ
            </Link>
          </div>

          <EventHero ev={event} page />

          <div className="kfl-event-detail__container">
            <div className="kfl-event-detail__summary">
              <div>
                <span className="kfl-event-detail__eyebrow">
                  OFFICIAL KFL EVENT
                </span>

                <h2>{event.name}</h2>

                <div className="kfl-event-detail__meta">
                  <span>
                    <CalendarOutlined />
                    {fmt(event.date)}
                  </span>

                  {(event.venue || event.city) && (
                    <span>
                      <EnvironmentOutlined />
                      {[event.venue, event.city]
                        .filter(Boolean)
                        .join(', ')}
                    </span>
                  )}
                </div>
              </div>

              <div className="kfl-event-detail__numbers">
                <div>
                  <strong>
                    {event.matchCount ?? matches.length}
                  </strong>
                  <span>СХВАТОК</span>
                </div>

                <div>
                  <strong>{completed.length}</strong>
                  <span>ЗАВЕРШЕНО</span>
                </div>
              </div>
            </div>

            <div className="kfl-event-detail__tabs">
              <Tabs
                defaultActiveKey="card"
                items={[
                  {
                    key: 'card',
                    label: 'Карта поединков',
                    children: matches.length ? (
                      <div className="kfl-event-detail__matches">
                        {matches.map((match: any) => (
                          <MatchCard
                            key={match.id}
                            m={match}
                          />
                        ))}
                      </div>
                    ) : (
                      <Nothing />
                    ),
                  },
                  {
                    key: 'results',
                    label: 'Результаты',
                    children: completed.length ? (
                      <div className="kfl-event-detail__matches">
                        {completed.map((match: any) => (
                          <MatchCard
                            key={match.id}
                            m={match}
                          />
                        ))}
                      </div>
                    ) : (
                      <Nothing />
                    ),
                  },
                  {
                    key: 'media',
                    label: 'Медиа',
                    children: (
                      <div className="kfl-event-detail__panel">
                        {event.streamUrl && (
                          <p>
                            <a
                              className="kfl-event-detail__action"
                              href={event.streamUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <PlayCircleOutlined />
                              ТРАНСЛЯЦИЯ / ЗАПИСЬ
                              <ArrowRightOutlined />
                            </a>
                          </p>
                        )}

                        {matches
                          .filter(
                            (match: any) => match.videoUrl
                          )
                          .map((match: any) => (
                            <p key={match.id}>
                              <a
                                href={match.videoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {match.athleteA
                                  ? fullName(match.athleteA)
                                  : 'Участник'}
                                {' — '}
                                {match.athleteB
                                  ? fullName(match.athleteB)
                                  : 'Участник'}
                                {' ↗'}
                              </a>
                            </p>
                          ))}

                        {!event.streamUrl &&
                          !matches.some(
                            (match: any) => match.videoUrl
                          ) && <Nothing />}
                      </div>
                    ),
                  },
                  {
                    key: 'info',
                    label: 'О событии',
                    children: (
                      <div className="kfl-event-detail__panel">
                        <h3>{event.name}</h3>

                        <p>{fmt(event.date)}</p>

                        <p>
                          {[event.venue, event.city]
                            .filter(Boolean)
                            .join(', ')}
                        </p>

                        <p>
                          {event.description ||
                            'Дополнительная информация пока не опубликована.'}
                        </p>

                        {event.ticketUrl && (
                          <a
                            className="kfl-event-detail__action"
                            href={event.ticketUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            БИЛЕТЫ
                            <ArrowRightOutlined />
                          </a>
                        )}
                      </div>
                    ),
                  },
                  {
                    key: 'partners',
                    label: 'Партнёры',
                    children: event.sponsors?.length ? (
                      <div className="kfl-event-detail__partners">
                        {event.sponsors.map(
                          (sponsor: any) => (
                            <div
                              className="kfl-event-detail__partner"
                              key={sponsor.id}
                            >
                              <Cover
                                src={sponsor.logoUrl}
                                alt={sponsor.name}
                              />

                              <h3>{sponsor.name}</h3>

                              {sponsor.url && (
                                <a
                                  href={sponsor.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  Сайт партнёра ↗
                                </a>
                              )}
                            </div>
                          )
                        )}
                      </div>
                    ) : (
                      <Nothing />
                    ),
                  },
                ]}
              />
            </div>
          </div>
        </main>
      )}
    </QueryState>
  );
}

/* =========================================
   ЧЕМПИОНЫ — KFL CHAMPIONS 2.0
========================================= */

export { default as Champions } from './KFLChampions';

/* Media Center lives in KFLMedia.tsx and is mounted directly by App.tsx. */
/* =========================================
   КАТЕГОРИИ МЕДИА
========================================= */

export const categories = [
  ['', 'Все'],
  ['NEWS', 'Новости'],
  ['INTERVIEW', 'Интервью'],
  ['ATHLETE_STORY', 'Истории'],
  ['HIGHLIGHT', 'Хайлайты'],
  ['TRAINING', 'Тренировки'],
  ['BACKSTAGE', 'За кулисами'],
  ['FACE_OFF', 'Face off'],
  ['CHAMPIONSHIP', 'Чемпионство'],
];

/* =========================================
   МЕДИА
========================================= */

export function Media() {
  useTitle('Медиа');

  const [category, setCategory] = useState('');

  const query = useQuery({
    queryKey: ['media', category],
    queryFn: () =>
      get('/media', {
        category: category || undefined,
      }),
  });

  return (
    <div className="wrap">
      <span className="eyebrow page-kicker">
        INSIDE THE LEAGUE
      </span>

      <h1 className="page-title">
        Медиа
      </h1>

      <Tabs
        activeKey={category}
        onChange={setCategory}
        items={categories.map(([key, label]) => ({
          key,
          label,
        }))}
      />

      <QueryState query={query}>
        {query.data?.length ? (
          <div className="media-grid">
            {query.data.map(
              (post: any, index: number) => (
                <Link
                  key={post.id}
                  className={
                    'card media-card ' +
                    (index === 0
                      ? 'media-featured'
                      : '')
                  }
                  to={
                    '/media/' +
                    (post.slug ?? post.id)
                  }
                >
                  <Cover
                    src={post.coverUrl}
                    alt={post.title}
                  />

                  <div className="card-content">
                    <span className="eyebrow">
                      {
                        categories.find(
                          ([key]) =>
                            key ===
                            (post.category ===
                            'BEHIND_THE_SCENES'
                              ? 'BACKSTAGE'
                              : post.category)
                        )?.[1]
                      }
                    </span>

                    <h3>{post.title}</h3>

                    <p>{post.excerpt}</p>

                    <small className="muted">
                      {fmt(
                        post.publishedAt,
                        'D MMM YYYY'
                      )}

                      {post.athlete
                        ? ' · ' +
                          fullName(post.athlete)
                        : ''}
                    </small>
                  </div>
                </Link>
              )
            )}
          </div>
        ) : (
          <Nothing />
        )}
      </QueryState>
    </div>
  );
}

/* =========================================
   СТРАНИЦА МЕДИА
========================================= */

export function MediaPage() {
  const { id } = useParams();

  const query = useQuery({
    queryKey: ['media-detail', id],
    queryFn: () => get('/media/' + id),
    enabled: Boolean(id),
  });
  const post = query.data;

  useTitle(post?.title ?? 'Медиа');

  return (
    <div className="wrap section">
      <QueryState query={query}>
        {post && (
          <article className="article">
            <Link to="/media">
              ← Все материалы
            </Link>

            <h1 className="page-title">
              {post.title}
            </h1>

            <p className="muted">
              {fmt(
                post.publishedAt,
                'D MMM YYYY'
              )}
              {' · '}
              {post.category}
            </p>

            <Cover
              src={post.coverUrl}
              alt={post.title}
            />

            {post.excerpt && (
              <p className="article-lead">
                {post.excerpt}
              </p>
            )}

            <div className="prose">
              {post.content}
            </div>

            {post.athlete && (
              <p>
                <Link
                  to={
                    '/athletes/' +
                    (post.athlete.slug ??
                      post.athlete.id)
                  }
                >
                  Профиль:{' '}
                  {fullName(post.athlete)}
                  {' →'}
                </Link>
              </p>
            )}
          </article>
        )}
      </QueryState>
    </div>
  );
}
