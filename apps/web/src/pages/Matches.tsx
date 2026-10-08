
import { useState } from 'react';
import {
  Link,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Pagination, Segmented, Select } from 'antd';
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CalendarOutlined,
  CrownOutlined,
  FireOutlined,
  PlayCircleOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

import { get } from '../api/client';
import {
  fmt,
  fullName,
  Loading,
  Nothing,
  Portrait,
  useTitle,
} from '../components/ui';
import { QueryError } from '../components/feedback';

import './KFLMatches.css';

type Athlete = {
  id: string;
  slug?: string;
  firstName?: string;
  lastName?: string;
  [key: string]: any;
};

type KFLMatch = {
  id: string;
  status: string;
  type?: string;
  scheduledAt: string;
  athleteAId: string;
  athleteBId: string;
  athleteA: Athlete;
  athleteB: Athlete;
  winnerId?: string | null;
  scoreA?: number | null;
  scoreB?: number | null;
  weightClass?: { name: string };
  event?: {
    id: string;
    slug?: string;
    name: string;
  };
  method?: string;
  penaltiesA?: number;
  penaltiesB?: number;
  periods?: any[];
  referees?: string[];
  notes?: string;
  context?: Record<string, any>;
  impact?: Record<string, any>;
  championshipResult?: any;
  videoUrl?: string;
};

type MatchesResponse = {
  items: KFLMatch[];
  total: number;
};

function athleteUrl(athlete: Athlete) {
  return `/athletes/${athlete.slug || athlete.id}`;
}

function eventUrl(event: NonNullable<KFLMatch['event']>) {
  return `/events/${event.slug || event.id}`;
}

function matchStatus(status: string) {
  switch (status) {
    case 'LIVE':
      return 'LIVE NOW';
    case 'COMPLETED':
      return 'ЗАВЕРШЁН';
    case 'UPCOMING':
      return 'СКОРО';
    default:
      return status;
  }
}

function Fighter({
  athlete,
  winner,
  side,
  record,
}: {
  athlete: Athlete;
  winner?: boolean;
  side: 'a' | 'b';
  record?: string;
}) {
  return (
    <Link
      to={athleteUrl(athlete)}
      className={
        `kfl-fighter kfl-fighter--${side}` +
        (winner ? ' kfl-fighter--winner' : '')
      }
    >
      <div className="kfl-fighter__photo">
        <Portrait a={athlete} ratio="4/5" />
      </div>

      {winner && (
        <span className="kfl-fighter__winner">
          <TrophyOutlined />
          WINNER
        </span>
      )}

      <h3>{fullName(athlete)}</h3>

      {record && (
        <span className="kfl-fighter__record">
          {record} W–L
        </span>
      )}
    </Link>
  );
}

/* =========================================
   КАРТОЧКА ПРОТИВОСТОЯНИЯ
========================================= */

function KFLFightCard({
  match,
}: {
  match: KFLMatch;
}) {
  const done = match.status === 'COMPLETED';
  const live = match.status === 'LIVE';

  return (
    <article
      className={
        'kfl-fight-card' +
        (live ? ' kfl-fight-card--live' : '')
      }
    >
      <div className="kfl-fight-card__top">
        <span className="kfl-fight-card__weight">
          {match.weightClass?.name || 'KFL'}
        </span>

        <span
          className={
            'kfl-fight-card__status' +
            (live ? ' kfl-fight-card__status--live' : '')
          }
        >
          {live && <span className="kfl-live-dot" />}
          {matchStatus(match.status)}
        </span>
      </div>

      <div className="kfl-fight-card__versus">
        <Fighter
          athlete={match.athleteA}
          side="a"
          winner={
            done &&
            match.winnerId === match.athleteA.id
          }
        />

        <div className="kfl-fight-card__center">
          {done ? (
            <strong className="kfl-fight-card__score">
              {match.scoreA ?? '—'}
              <span>:</span>
              {match.scoreB ?? '—'}
            </strong>
          ) : (
            <strong className="kfl-fight-card__vs">
              VS
            </strong>
          )}

          {match.type &&
            match.type !== 'REGULAR' && (
              <span className="kfl-fight-card__type">
                <CrownOutlined />
                {match.type}
              </span>
            )}
        </div>

        <Fighter
          athlete={match.athleteB}
          side="b"
          winner={
            done &&
            match.winnerId === match.athleteB.id
          }
        />
      </div>

      <div className="kfl-fight-card__bottom">
        <div className="kfl-fight-card__event">
          <CalendarOutlined />

          <span>
            {fmt(match.scheduledAt)}
          </span>

          {match.event && (
            <Link to={eventUrl(match.event)}>
              {match.event.name}
            </Link>
          )}
        </div>

        <Link
          className="kfl-fight-card__details"
          to={`/matches/${match.id}`}
        >
          ДЕТАЛИ
          <ArrowRightOutlined />
        </Link>
      </div>
    </article>
  );
}

/* =========================================
   СТРАНИЦА ВСЕХ СХВАТОК
========================================= */

export function Matches() {
  const { t } = useTranslation();

  useTitle(t('nav.matches'));

  const [params] = useSearchParams();

  const [status, setStatus] = useState(
    params.get('status')?.toUpperCase() ?? ''
  );

  const [weightClassId, setWeightClassId] =
    useState<string>();

  const [page, setPage] = useState(1);

  const weightClassesQuery = useQuery({
    queryKey: ['wcs'],
    queryFn: () => get('/weight-classes'),
  });

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery<MatchesResponse>({
    queryKey: [
      'matches',
      status,
      weightClassId,
      page,
    ],
    queryFn: () =>
      get('/matches', {
        status,
        weightClassId,
        page,
        limit: 12,
      }),
  });

  return (
    <main className="kfl-matches-page">
      <header className="kfl-matches-hero">
        <div className="kfl-matches-container">
          <span className="kfl-matches-eyebrow">
            <FireOutlined />
            OFFICIAL KFL FIGHT CARD
          </span>

          <h1>
            FIGHT
            <br />
            <span>CARD.</span>
          </h1>

          <p>
            Каждая схватка имеет значение.
            Следи за противостояниями,
            результатами и историей борцов KFL.
          </p>
        </div>
      </header>

      <div className="kfl-matches-container">
        <div className="kfl-matches-toolbar">
          <div>
            <span className="kfl-matches-eyebrow">
              ALL MATCHES
            </span>

            <h2>ПОЕДИНКИ ЛИГИ</h2>
          </div>

          <div className="kfl-matches-filters">
            <Segmented
              value={status}
              onChange={(value) => {
                setStatus(String(value));
                setPage(1);
              }}
              options={[
                {
                  value: '',
                  label: t('common.all'),
                },
                {
                  value: 'UPCOMING',
                  label: t('status.UPCOMING'),
                },
                {
                  value: 'LIVE',
                  label: t('status.LIVE'),
                },
                {
                  value: 'COMPLETED',
                  label: t('status.COMPLETED'),
                },
              ]}
            />

            <Select
              aria-label="Весовая категория матчей"
              allowClear
              placeholder={t('common.weight')}
              value={weightClassId}
              onChange={(value) => {
                setWeightClassId(value);
                setPage(1);
              }}
              options={weightClassesQuery.data?.map(
                (weight: any) => ({
                  value: weight.id,
                  label: weight.name,
                })
              )}
            />
          </div>
        </div>

        {error ? (
          <QueryError
            error={error}
            retry={refetch}
          />
        ) : isLoading ? (
          <Loading />
        ) : data?.items?.length ? (
          <>
            <p className="kfl-matches-count">
              НАЙДЕНО СХВАТОК: {data.total}
            </p>

            <div className="kfl-matches-grid">
              {data.items.map((match) => (
                <KFLFightCard
                  key={match.id}
                  match={match}
                />
              ))}
            </div>

            <Pagination
              className="kfl-matches-pagination"
              current={page}
              pageSize={12}
              total={data.total}
              onChange={setPage}
              showSizeChanger={false}
            />
          </>
        ) : (
          <div className="kfl-matches-empty">
            <Nothing />
          </div>
        )}
      </div>
    </main>
  );
}

/* =========================================
   СТРАНИЦА ОДНОЙ СХВАТКИ
========================================= */

export function MatchPage() {
  const { id } = useParams();
  const { t } = useTranslation();

  const {
    data: match,
    isLoading,
    error,
    refetch,
  } = useQuery<KFLMatch>({
    queryKey: ['match', id],
    queryFn: () => get(`/matches/${id}`),
    enabled: Boolean(id),
  });

  useTitle(
    match
      ? `${fullName(match.athleteA)} vs ${fullName(match.athleteB)}`
      : 'Поединок KFL'
  );

  if (error) {
    return (
      <QueryError
        error={error}
        retry={refetch}
      />
    );
  }

  if (isLoading || !match) {
    return <Loading />;
  }

  const done = match.status === 'COMPLETED';
  const live = match.status === 'LIVE';

  const context = match.context ?? {};
  const impact = match.impact ?? {};

  const winner =
    done && match.winnerId
      ? [match.athleteA, match.athleteB].find(
          (athlete) =>
            athlete.id === match.winnerId
        )
      : undefined;

  return (
    <main className="kfl-match-detail">
      <div className="kfl-matches-container">
        <Link
          className="kfl-match-detail__back"
          to="/matches"
        >
          <ArrowLeftOutlined />
          ВСЕ ПОЕДИНКИ
        </Link>

        <div className="kfl-match-detail__heading">
          <span className="kfl-matches-eyebrow">
            KYRGYZ FREESTYLE LEAGUE
          </span>

          <h1>ПОЕДИНОК</h1>

          <div className="kfl-match-detail__tags">
            <span
              className={
                'kfl-fight-card__status' +
                (live
                  ? ' kfl-fight-card__status--live'
                  : '')
              }
            >
              {live && (
                <span className="kfl-live-dot" />
              )}

              {t(`status.${match.status}`)}
            </span>

            {match.type &&
              match.type !== 'REGULAR' && (
                <span className="kfl-match-detail__title-tag">
                  <CrownOutlined />
                  {t(`type.${match.type}`)}
                </span>
              )}
          </div>
        </div>

        <div className="kfl-match-detail__meta">
          <span>
            {match.weightClass?.name ?? 'KFL'}
          </span>

          {match.event && (
            <Link to={eventUrl(match.event)}>
              {match.event.name}
            </Link>
          )}

          <span>
            {fmt(match.scheduledAt)}
          </span>
        </div>

        <section className="kfl-match-detail__arena">
          <div className="kfl-match-detail__fighter">
            <Fighter
              athlete={match.athleteA}
              side="a"
              winner={
                done &&
                match.winnerId ===
                  match.athleteA.id
              }
              record={
                context[match.athleteA.id]
                  ?.stats?.record
              }
            />

            <span className="kfl-match-detail__ranking">
              РЕЙТИНГ ДО СОБЫТИЯ: #
              {context[match.athleteA.id]
                ?.rankingBefore ?? '—'}
            </span>
          </div>

          <div className="kfl-match-detail__center">
            {done ? (
              <strong>
                {match.scoreA ?? '—'}
                <span>:</span>
                {match.scoreB ?? '—'}
              </strong>
            ) : (
              <strong>VS</strong>
            )}

            <span>
              {done
                ? 'FINAL RESULT'
                : live
                  ? 'LIVE MATCH'
                  : 'UPCOMING MATCH'}
            </span>
          </div>

          <div className="kfl-match-detail__fighter">
            <Fighter
              athlete={match.athleteB}
              side="b"
              winner={
                done &&
                match.winnerId ===
                  match.athleteB.id
              }
              record={
                context[match.athleteB.id]
                  ?.stats?.record
              }
            />

            <span className="kfl-match-detail__ranking">
              РЕЙТИНГ ДО СОБЫТИЯ: #
              {context[match.athleteB.id]
                ?.rankingBefore ?? '—'}
            </span>
          </div>
        </section>

        {done && (
          <section className="kfl-match-detail__section">
            <div className="kfl-match-detail__section-head">
              <span className="kfl-matches-eyebrow">
                OFFICIAL RESULT
              </span>

              <h2>РЕЗУЛЬТАТ СХВАТКИ</h2>
            </div>

            {winner && (
              <div className="kfl-match-detail__winner-banner">
                <TrophyOutlined />

                <div>
                  <span>ПОБЕДИТЕЛЬ</span>
                  <strong>{fullName(winner)}</strong>
                </div>
              </div>
            )}

            <div className="kfl-match-detail__stats-grid">
              <div className="kfl-match-detail__stat">
                <span>МЕТОД ПОБЕДЫ</span>
                <strong>
                  {match.method
                    ? t(`method.${match.method}`)
                    : '—'}
                </strong>
              </div>

              <div className="kfl-match-detail__stat">
                <span>ШТРАФЫ</span>
                <strong>
                  {match.penaltiesA ?? 0}
                  {' / '}
                  {match.penaltiesB ?? 0}
                </strong>
              </div>

              {(match.periods ?? []).length > 0 && (
                <div className="kfl-match-detail__stat">
                  <span>ПЕРИОДЫ</span>

                  {(match.periods ?? []).map(
                    (period: any) => (
                      <strong key={period.id}>
                        P{period.period}:{' '}
                        {period.pointsA}
                        {' – '}
                        {period.pointsB}
                      </strong>
                    )
                  )}
                </div>
              )}

              {(match.referees ?? []).length > 0 && (
                <div className="kfl-match-detail__stat">
                  <span>СУДЬИ</span>
                  <strong>
                    {match.referees?.join(', ')}
                  </strong>
                </div>
              )}
            </div>

            {match.notes && (
              <div className="kfl-match-detail__notes">
                <h3>ОПИСАНИЕ СХВАТКИ</h3>
                <p>{match.notes}</p>
              </div>
            )}
          </section>
        )}

        {done && match.impact && (
          <section className="kfl-match-detail__section">
            <div className="kfl-match-detail__section-head">
              <span className="kfl-matches-eyebrow">
                RANKING IMPACT
              </span>

              <h2>ИЗМЕНЕНИЕ РЕЙТИНГА</h2>
            </div>

            <div className="kfl-match-detail__ranking-grid">
              {[
                match.athleteA,
                match.athleteB,
              ].map((athlete) => (
                <div
                  className="kfl-match-detail__ranking-card"
                  key={athlete.id}
                >
                  <h3>{fullName(athlete)}</h3>

                  <div>
                    <span>
                      #{impact[athlete.id]?.before ??
                        '—'}
                    </span>

                    <ArrowRightOutlined />

                    <strong>
                      #{impact[athlete.id]?.after ??
                        '—'}
                    </strong>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {match.championshipResult && (
          <section className="kfl-match-detail__championship">
            <CrownOutlined />

            <div>
              <span>KFL CHAMPIONSHIP</span>

              <h2>
                {match.championshipResult.isDefense
                  ? 'ТИТУЛ ЗАЩИЩЁН'
                  : 'НОВЫЙ ЧЕМПИОН'}
              </h2>

              <p>
                {fullName(
                  match.championshipResult.athleteId ===
                    match.athleteAId
                    ? match.athleteA
                    : match.athleteB
                )}
              </p>
            </div>
          </section>
        )}

        {match.videoUrl && (
          <div className="kfl-match-detail__video">
            <a
              href={match.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <PlayCircleOutlined />
              СМОТРЕТЬ ЗАПИСЬ СХВАТКИ
              <ArrowRightOutlined />
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
