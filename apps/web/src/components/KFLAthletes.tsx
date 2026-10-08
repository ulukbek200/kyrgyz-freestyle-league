
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import {
  ArrowRightOutlined,
  ThunderboltFilled,
  TrophyOutlined,
  UserOutlined,
} from '@ant-design/icons';

import { get } from '../api/client';
import { fullName } from './ui';

import './KFLAthletes.css';

type Athlete = {
  id: string | number;
  slug?: string | null;
  firstName?: string;
  lastName?: string;
  name?: string;
  nickname?: string | null;
  photoUrl?: string | null;
  imageUrl?: string | null;
  country?: string | null;
  city?: string | null;
  isChampion?: boolean;
  weightClass?: {
    name?: string;
  } | null;
  currentRanking?: {
    rank?: number;
    points?: number;
  } | null;
  stats?: {
    wins?: number;
    losses?: number;
  } | null;
};

type AthletesResponse = {
  items: Athlete[];
  total: number;
};

function AthleteCard({
  athlete,
  index,
}: {
  athlete: Athlete;
  index: number;
}) {
  const name =
    athlete.name ||
    [athlete.firstName, athlete.lastName]
      .filter(Boolean)
      .join(' ') ||
    'Спортсмен KFL';

  const image = athlete.photoUrl || athlete.imageUrl;

  const profilePath = `/athletes/${encodeURIComponent(
    String(athlete.slug || athlete.id)
  )}`;

  const rank = athlete.currentRanking?.rank;
  const weight = athlete.weightClass?.name;

  return (
    <Link
      to={profilePath}
      className="kfl-athletes__card"
    >
      <div className="kfl-athletes__card-media">
        {image ? (
          <img
            src={image}
            alt={name}
            loading="lazy"
          />
        ) : (
          <div className="kfl-athletes__placeholder">
            <UserOutlined />
          </div>
        )}

        <div className="kfl-athletes__card-shade" />

        <span className="kfl-athletes__card-number">
          {String(index + 1).padStart(2, '0')}
        </span>

        <span className="kfl-athletes__card-tag">
          {athlete.isChampion
            ? 'KFL CHAMPION'
            : 'KFL ATHLETE'}
        </span>
      </div>

      <div className="kfl-athletes__card-info">
        <span className="kfl-athletes__card-category">
          {weight || 'ВОЛЬНАЯ БОРЬБА'}
        </span>

        <h3>{name}</h3>

        {athlete.nickname && (
          <span className="kfl-athletes__nickname">
            «{athlete.nickname}»
          </span>
        )}

        <p>
          {[athlete.country, athlete.city]
            .filter(Boolean)
            .join(' · ') || 'KYRGYZ FREESTYLE LEAGUE'}
        </p>

        <div className="kfl-athletes__card-bottom">
          <span>
            <TrophyOutlined />
            {rank ? `РЕЙТИНГ #${rank}` : 'ПРОФИЛЬ'}
          </span>

          <ArrowRightOutlined />
        </div>
      </div>
    </Link>
  );
}

export default function KFLAthletes() {
  const query = useQuery<AthletesResponse>({
    queryKey: ['athletes', { sort: 'ranking' }, 1, 4],
    queryFn: () =>
      get('/athletes', {
        sort: 'ranking',
        page: 1,
        limit: 4,
      }),
    staleTime: 60_000,
    retry: 1,
  });

  const athletes = query.data?.items ?? [];

  return (
    <section
      className="kfl-athletes"
      id="athletes"
    >
      <div className="kfl-athletes__container">
        <header className="kfl-athletes__header">
          <div>
            <div className="kfl-athletes__eyebrow">
              <ThunderboltFilled />
              THE FACES OF KFL
            </div>

            <h2>
              ЛИЦА
              <br />
              <span>ЛИГИ.</span>
            </h2>
          </div>

          <div className="kfl-athletes__header-right">
            <p>
              За каждым спортсменом стоит история
              дисциплины, тренировок и стремления
              к победе.
            </p>

            <Link to="/athletes">
              ВСЕ СПОРТСМЕНЫ
              <ArrowRightOutlined />
            </Link>
          </div>
        </header>

        {query.isPending ? (
          <div
            className="kfl-athletes__empty"
            role="status"
          >
            ЗАГРУЖАЕМ СПОРТСМЕНОВ...
          </div>
        ) : query.isError ? (
          <div className="kfl-athletes__empty">
            <h3>НЕ УДАЛОСЬ ЗАГРУЗИТЬ ДАННЫЕ.</h3>

            <p>
              Проверь подключение к серверу
              и попробуй ещё раз.
            </p>

            <button
              type="button"
              onClick={() => query.refetch()}
            >
              ПОВТОРИТЬ
            </button>
          </div>
        ) : athletes.length > 0 ? (
          <div className="kfl-athletes__grid">
            {athletes.map((athlete, index) => (
              <AthleteCard
                key={athlete.id}
                athlete={athlete}
                index={index}
              />
            ))}
          </div>
        ) : (
          <div className="kfl-athletes__empty">
            <div className="kfl-athletes__empty-icon">
              <TrophyOutlined />
            </div>

            <h3>
              НОВЫЕ ИМЕНА. НОВАЯ ИСТОРИЯ.
            </h3>

            <p>
              Здесь появятся спортсмены KFL
              после публикации их профилей.
            </p>

            <Link to="/apply">
              СТАТЬ УЧАСТНИКОМ
              <ArrowRightOutlined />
            </Link>
          </div>
        )}

        <div className="kfl-athletes__footer">
          <span>KYRGYZ FREESTYLE LEAGUE</span>

          <Link to="/athletes">
            ОТКРЫТЬ СПИСОК СПОРТСМЕНОВ
            <ArrowRightOutlined />
          </Link>
        </div>
      </div>
    </section>
  );
}
