
import { Link } from 'react-router-dom';
import {
  ArrowRightOutlined,
  CalendarOutlined,
  EnvironmentOutlined,
  FireFilled,
  TrophyOutlined,
} from '@ant-design/icons';
import './KFLTournaments.css';

export type KFLTournament = {
  id: string | number;
  title: string;
  date?: string | null;
  location?: string | null;
  imageUrl?: string | null;
  status?: string | null;
};

type Props = {
  tournaments?: KFLTournament[];
};

function formatDate(value?: string | null) {
  if (!value) return 'Дата уточняется';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export default function KFLTournaments({
  tournaments = [],
}: Props) {
  const featured = tournaments[0];
  const other = tournaments.slice(1, 4);

  return (
    <section
      className="kfl-tournaments"
      id="tournaments"
    >
      <div className="kfl-tournaments__container">
        <div className="kfl-tournaments__intro">
          <div>
            <span className="kfl-tournaments__eyebrow">
              <span />
              THE ROAD TO VICTORY
            </span>

            <h2>
              АРЕНА
              <br />
              <em>СИЛЬНЕЙШИХ.</em>
            </h2>
          </div>

          <p>
            Здесь начинается путь к большим победам.
            Следи за соревнованиями Кыргызской лиги
            вольной борьбы и заяви о себе.
          </p>
        </div>

        <div className="kfl-tournaments__featured">
          <div className="kfl-tournaments__featured-media">
            {featured?.imageUrl ? (
              <img
                src={featured.imageUrl}
                alt={featured.title}
                loading="lazy"
              />
            ) : (
              <div className="kfl-tournaments__placeholder">
                <TrophyOutlined />
                <span>KFL</span>
              </div>
            )}
          </div>

          <div className="kfl-tournaments__featured-overlay" />

          <div className="kfl-tournaments__featured-content">
            <div className="kfl-tournaments__featured-top">
              <span className="kfl-tournaments__event-label">
                <FireFilled /> NEXT EVENT
              </span>

              <span className="kfl-tournaments__event-brand">
                KYRGYZ FREESTYLE LEAGUE
              </span>
            </div>

            <div className="kfl-tournaments__featured-bottom">
              <div>
                <span className="kfl-tournaments__overline">
                  БЛИЖАЙШЕЕ СОБЫТИЕ
                </span>

                <h3>
                  {featured
                    ? featured.title
                    : 'СЛЕДУЮЩИЙ ВЫЗОВ.'}
                </h3>

                <div className="kfl-tournaments__details">
                  <span>
                    <CalendarOutlined />
                    {featured
                      ? formatDate(featured.date)
                      : 'Дата будет объявлена'}
                  </span>

                  <span>
                    <EnvironmentOutlined />
                    {featured?.location ||
                      'Место проведения уточняется'}
                  </span>
                </div>
              </div>

              <Link
                to="/apply"
                className="kfl-tournaments__cta"
              >
                ПОДАТЬ ЗАЯВКУ
                <ArrowRightOutlined />
              </Link>
            </div>
          </div>
        </div>

        <div className="kfl-tournaments__subheading">
          <div>
            <span>01 / COMPETITIONS</span>
            <h3>ТУРНИРЫ KFL</h3>
          </div>

          <span className="kfl-tournaments__subheading-note">
            БОРЬБА / ХАРАКТЕР / РЕЗУЛЬТАТ
          </span>
        </div>

        {other.length > 0 ? (
          <div className="kfl-tournaments__grid">
            {other.map((event) => (
              <article
                className="kfl-tournaments__card"
                key={event.id}
              >
                <div className="kfl-tournaments__card-image">
                  {event.imageUrl ? (
                    <img
                      src={event.imageUrl}
                      alt={event.title}
                      loading="lazy"
                    />
                  ) : (
                    <div className="kfl-tournaments__card-placeholder">
                      <TrophyOutlined />
                    </div>
                  )}

                  <span className="kfl-tournaments__card-badge">
                    KFL EVENT
                  </span>
                </div>

                <div className="kfl-tournaments__card-body">
                  <span className="kfl-tournaments__card-date">
                    {formatDate(event.date)}
                  </span>

                  <h4>{event.title}</h4>

                  <p>
                    <EnvironmentOutlined />
                    {event.location ||
                      'Место уточняется'}
                  </p>

                  <Link to="/apply">
                    СТАТЬ УЧАСТНИКОМ
                    <ArrowRightOutlined />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="kfl-tournaments__empty">
            <div>
              <TrophyOutlined />
              <span>COMING SOON</span>
            </div>

            <h3>НОВЫЕ ТУРНИРЫ ВПЕРЕДИ.</h3>

            <p>
              Информация о предстоящих соревнованиях
              появится здесь после публикации.
            </p>
          </div>
        )}

        <div className="kfl-tournaments__bottom">
          <div>
            <strong>ГОТОВ ВЫЙТИ НА КОВЁР?</strong>
            <p>
              Сделай первый шаг и отправь заявку
              на участие в KFL.
            </p>
          </div>

          <Link to="/apply">
            ЗАРЕГИСТРИРОВАТЬСЯ
            <ArrowRightOutlined />
          </Link>
        </div>
      </div>
    </section>
  );
}
