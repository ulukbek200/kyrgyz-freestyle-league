
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRightOutlined,
  CrownOutlined,
  HistoryOutlined,
  SafetyCertificateOutlined,
  TrophyOutlined,
} from '@ant-design/icons';

import { get } from '../api/client';
import {
  fmt,
  fullName,
  Nothing,
  Portrait,
  useTitle,
} from '../components/ui';
import { QueryState } from '../components/feedback';

import './KFLChampions.css';

type Champion = {
  id: string | number;
  isCurrent: boolean;
  athlete: {
    id: string | number;
    slug?: string | null;
    [key: string]: any;
  };
  weightClass: {
    name: string;
  };
  wonAt: string;
  lostAt?: string | null;
  stats?: {
    record?: string | null;
  } | null;
  defenses?: unknown[] | null;
};

function athletePath(champion: Champion) {
  return `/athletes/${encodeURIComponent(
    String(champion.athlete.slug || champion.athlete.id)
  )}`;
}

function ChampionCard({
  champion,
  featured = false,
}: {
  champion: Champion;
  featured?: boolean;
}) {
  return (
    <article
      className={
        'kfl-champion-card' +
        (featured ? ' kfl-champion-card--featured' : '')
      }
    >
      <div className="kfl-champion-card__image">
        <Portrait a={champion.athlete} ratio="4/5" />

        <div className="kfl-champion-card__gradient" />

        <span className="kfl-champion-card__category">
          {champion.weightClass.name}
        </span>

        <div className="kfl-champion-card__identity">
          <span>
            <CrownOutlined />
            CURRENT CHAMPION
          </span>

          <h3>{fullName(champion.athlete)}</h3>
        </div>
      </div>

      <div className="kfl-champion-card__information">
        <div className="kfl-champion-card__statistics">
          <div>
            <span>РЕКОРД W–L</span>
            <strong>{champion.stats?.record ?? '—'}</strong>
          </div>

          <div>
            <span>ЗАЩИТ ТИТУЛА</span>
            <strong>{champion.defenses?.length ?? 0}</strong>
          </div>
        </div>

        <div className="kfl-champion-card__footer">
          <span>
            ЧЕМПИОН С
            <strong>{fmt(champion.wonAt, 'D MMM YYYY')}</strong>
          </span>

          <Link to={athletePath(champion)}>
            ПРОФИЛЬ
            <ArrowRightOutlined />
          </Link>
        </div>
      </div>
    </article>
  );
}

export default function KFLChampions() {
  useTitle('Чемпионы KFL');

  const query = useQuery<Champion[]>({
    queryKey: ['champions'],
    queryFn: () => get('/champions'),
  });

  const current = (query.data ?? []).filter(
    (champion) => champion.isCurrent
  );

  const history = (query.data ?? []).filter(
    (champion) => !champion.isCurrent
  );

  const featured = current[0];
  const otherChampions = current.slice(1);

  return (
    <main className="kfl-champions-page">
      <header className="kfl-champions-hero">
        <div className="kfl-champions-container">
          <span className="kfl-champions-eyebrow">
            <TrophyOutlined />
            KYRGYZ FREESTYLE LEAGUE
          </span>

          <h1>
            THE
            <br />
            <span>CHAMPIONS.</span>
          </h1>

          <p>
            Чемпионами не рождаются.
            Ими становятся на ковре.
            Познакомься с обладателями титулов KFL.
          </p>

          <div className="kfl-champions-hero__footer">
            <span>
              <SafetyCertificateOutlined />
              OFFICIAL TITLE HOLDERS
            </span>
          </div>
        </div>
      </header>

      <div className="kfl-champions-container">
        <QueryState query={query}>
          <section className="kfl-champions-current">
            <div className="kfl-champions-heading">
              <div>
                <span className="kfl-champions-eyebrow">
                  <CrownOutlined />
                  TITLE HOLDERS
                </span>

                <h2>ДЕЙСТВУЮЩИЕ ЧЕМПИОНЫ</h2>

                <p>
                  Спортсмены, которые в настоящее время
                  владеют чемпионскими титулами лиги.
                </p>
              </div>

              <div className="kfl-champions-heading__count">
                <strong>{current.length}</strong>
                <span>ЧЕМПИОНОВ</span>
              </div>
            </div>

            {featured ? (
              <>
                <ChampionCard champion={featured} featured />

                {otherChampions.length > 0 && (
                  <div className="kfl-champions-grid">
                    {otherChampions.map((champion) => (
                      <ChampionCard
                        key={champion.id}
                        champion={champion}
                      />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="kfl-champions-empty">
                <Nothing />
              </div>
            )}
          </section>

          <section className="kfl-champions-history">
            <div className="kfl-champions-heading">
              <div>
                <span className="kfl-champions-eyebrow">
                  <HistoryOutlined />
                  HALL OF CHAMPIONS
                </span>

                <h2>ИСТОРИЯ ТИТУЛОВ</h2>

                <p>
                  История спортсменов, ранее владевших
                  чемпионскими титулами KFL.
                </p>
              </div>
            </div>

            {history.length ? (
              <div className="kfl-champions-history__list">
                {history.map((champion) => (
                  <article
                    className="kfl-champions-history__row"
                    key={champion.id}
                  >
                    <div className="kfl-champions-history__athlete">
                      <div className="kfl-champions-history__portrait">
                        <Portrait
                          a={champion.athlete}
                          ratio="4/5"
                        />
                      </div>

                      <div>
                        <span>FORMER CHAMPION</span>
                        <h3>{fullName(champion.athlete)}</h3>
                      </div>
                    </div>

                    <div className="kfl-champions-history__detail">
                      <span>ВЕСОВАЯ КАТЕГОРИЯ</span>
                      <strong>{champion.weightClass.name}</strong>
                    </div>

                    <div className="kfl-champions-history__detail">
                      <span>ПЕРИОД ВЛАДЕНИЯ</span>
                      <strong>
                        {fmt(champion.wonAt, 'D MMM YYYY')}
                        {' — '}
                        {champion.lostAt
                          ? fmt(champion.lostAt, 'D MMM YYYY')
                          : '—'}
                      </strong>
                    </div>

                    <div className="kfl-champions-history__detail">
                      <span>ЗАЩИТ</span>
                      <strong>
                        {champion.defenses?.length ?? 0}
                      </strong>
                    </div>

                    <Link
                      className="kfl-champions-history__link"
                      to={athletePath(champion)}
                      aria-label={`Профиль ${fullName(champion.athlete)}`}
                    >
                      <ArrowRightOutlined />
                    </Link>
                  </article>
                ))}
              </div>
            ) : (
              <div className="kfl-champions-empty">
                <Nothing />
              </div>
            )}
          </section>
        </QueryState>
      </div>
    </main>
  );
}
