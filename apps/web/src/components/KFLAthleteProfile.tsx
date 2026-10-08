
import { Link } from 'react-router-dom';
import {
  ArrowLeftOutlined,
  CrownFilled,
  EnvironmentOutlined,
  FireFilled,
  TrophyOutlined,
  UserOutlined,
} from '@ant-design/icons';

import { fullName, Portrait } from './ui';
import './KFLAthleteProfile.css';

type Athlete = {
  id: string | number;
  firstName?: string;
  lastName?: string;
  nickname?: string | null;
  country?: string | null;
  city?: string | null;
  isChampion?: boolean;
  club?: {
    name?: string;
  } | null;
  weightClass?: {
    name?: string;
  } | null;
  currentRanking?: {
    rank?: number | null;
    points?: number | null;
  } | null;
  stats?: {
    record?: string;
    wins?: number;
    losses?: number;
    winRate?: number;
    techWins?: number;
    highestRank?: number | null;
  } | null;
};

type Props = {
  athlete: Athlete;
};

export default function KFLAthleteProfile({
  athlete,
}: Props) {
  const name = fullName(athlete);
  const stats = athlete.stats;
  const ranking = athlete.currentRanking;

  const details = [
    {
      label: 'РЕКОРД',
      value:
        stats?.record ??
        `${stats?.wins ?? 0}–${stats?.losses ?? 0}`,
    },
    {
      label: 'ПОБЕДЫ',
      value: stats?.wins ?? '—',
    },
    {
      label: 'ПОРАЖЕНИЯ',
      value: stats?.losses ?? '—',
    },
    {
      label: 'ПРОЦЕНТ ПОБЕД',
      value:
        stats?.winRate != null
          ? `${stats.winRate}%`
          : '—',
    },
    {
      label: 'ОЧКИ РЕЙТИНГА',
      value: ranking?.points ?? '—',
    },
    {
      label: 'ТЕХ. ПОБЕДЫ',
      value: stats?.techWins ?? '—',
    },
  ];

  return (
    <section className="kfl-profile">
      <div className="kfl-profile__background" />

      <div className="kfl-profile__container">
        <Link
          to="/athletes"
          className="kfl-profile__back"
        >
          <ArrowLeftOutlined />
          ВСЕ СПОРТСМЕНЫ
        </Link>

        <div className="kfl-profile__main">
          <div className="kfl-profile__visual">
            <div className="kfl-profile__visual-glow" />

            <div className="kfl-profile__portrait">
              <Portrait a={athlete} ratio="4/5" />
            </div>

            <div className="kfl-profile__visual-mark">
              KFL
            </div>
          </div>

          <div className="kfl-profile__content">
            <div className="kfl-profile__eyebrow">
              <FireFilled />
              KYRGYZ FREESTYLE LEAGUE
            </div>

            {athlete.isChampion && (
              <div className="kfl-profile__champion">
                <CrownFilled />
                ДЕЙСТВУЮЩИЙ ЧЕМПИОН
              </div>
            )}

            <h1>{name}</h1>

            {athlete.nickname && (
              <p className="kfl-profile__nickname">
                «{athlete.nickname}»
              </p>
            )}

            <div className="kfl-profile__meta">
              <span>
                <EnvironmentOutlined />
                {[athlete.country, athlete.city]
                  .filter(Boolean)
                  .join(', ') || 'Кыргызстан'}
              </span>

              {athlete.weightClass?.name && (
                <span>
                  <UserOutlined />
                  {athlete.weightClass.name}
                </span>
              )}

              {athlete.club?.name && (
                <span>
                  <TrophyOutlined />
                  {athlete.club.name}
                </span>
              )}
            </div>

            <div className="kfl-profile__rank">
              <div>
                <span>ПОЗИЦИЯ В РЕЙТИНГЕ</span>
                <strong>
                  {ranking?.rank != null
                    ? `#${ranking.rank}`
                    : '—'}
                </strong>
              </div>

              <div className="kfl-profile__rank-label">
                KFL OFFICIAL RANKING
              </div>
            </div>
          </div>
        </div>

        <div className="kfl-profile__stats">
          {details.map((item) => (
            <div
              className="kfl-profile__stat"
              key={item.label}
            >
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
