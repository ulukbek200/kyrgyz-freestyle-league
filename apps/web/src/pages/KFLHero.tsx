
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  ArrowRightOutlined,
  PlayCircleOutlined,
  ThunderboltFilled,
} from '@ant-design/icons';

import './KFLHero.css';

const VIDEO_URL = '/media/kfl-hero.mp4';
const POSTER_URL = '/media/kfl-hero-poster.webp';

export default function KFLHero() {
  const [videoReady, setVideoReady] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    );

    const updateMotion = () => {
      setReduceMotion(mediaQuery.matches);
    };

    updateMotion();

    mediaQuery.addEventListener('change', updateMotion);

    return () => {
      mediaQuery.removeEventListener(
        'change',
        updateMotion
      );
    };
  }, []);

  return (
    <section
      className="kfl-home-hero"
      aria-labelledby="kfl-hero-title"
    >
      {/* =====================================
          КИНЕМАТОГРАФИЧНЫЙ ФОН
      ===================================== */}

      <div className="kfl-home-hero__media">
        <div className="kfl-home-hero__poster" />

        {!videoFailed && !reduceMotion && (
          <video
            className={
              'kfl-home-hero__video' +
              (videoReady ? ' is-ready' : '')
            }
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster={POSTER_URL}
            aria-hidden="true"
            onCanPlay={() => setVideoReady(true)}
            onError={() => setVideoFailed(true)}
          >
            <source
              src={VIDEO_URL}
              type="video/mp4"
            />
          </video>
        )}

        <div className="kfl-home-hero__shade" />
        <div className="kfl-home-hero__grid" />
        <div className="kfl-home-hero__glow" />
      </div>

      {/* =====================================
          ОСНОВНОЙ КОНТЕНТ
      ===================================== */}

      <div className="kfl-home-hero__container">
        <div className="kfl-home-hero__content">
          {/* Название лиги */}

          <div className="kfl-home-hero__eyebrow">
            <span className="kfl-home-hero__live-dot" />

            <span>KYRGYZ FREESTYLE LEAGUE</span>

            <span className="kfl-home-hero__eyebrow-line" />

            <span>THE NEXT GENERATION</span>
          </div>

          {/* Главный заголовок */}

          <div className="kfl-home-hero__heading-wrap">
            <span className="kfl-home-hero__outline">
              НЕ ПРОСТО СПОРТ.
            </span>

            <h1 id="kfl-hero-title">
              ЗДЕСЬ
              <br />
              РОЖДАЮТСЯ
              <br />
              <span>ЧЕМПИОНЫ.</span>
            </h1>
          </div>

          {/* Описание */}

          <div className="kfl-home-hero__description">
            <div className="kfl-home-hero__description-line" />

            <p>
              Твой характер. Твоя борьба. Твоя история.
              <br />
              Выходи на ковёр, заяви о себе и стань
              частью нового поколения кыргызской борьбы.
            </p>
          </div>

          {/* Кнопки */}

          <div className="kfl-home-hero__actions">
            <Link
              to="/apply"
              className="kfl-home-hero__primary"
            >
              <ThunderboltFilled />

              <span>СТАТЬ УЧАСТНИКОМ</span>

              <ArrowRightOutlined />
            </Link>

            <a
              href="#tournaments"
              className="kfl-home-hero__secondary"
            >
              <PlayCircleOutlined />

              <span>СМОТРЕТЬ ТУРНИРЫ</span>
            </a>
          </div>

          {/* Нижняя подпись */}

          <div className="kfl-home-hero__footnote">
            <span className="kfl-home-hero__footnote-mark">
              KFL
            </span>

            <div>
              <strong>
                СИЛА. ХАРАКТЕР. ПОБЕДА.
              </strong>

              <small>
                Кыргызская лига вольной борьбы
              </small>
            </div>
          </div>
        </div>

        {/* Вертикальная подпись справа */}

        <div
          className="kfl-home-hero__side-label"
          aria-hidden="true"
        >
          THE FUTURE OF WRESTLING / KYRGYZSTAN
        </div>
      </div>

      {/* =====================================
          УКАЗАТЕЛЬ ПРОКРУТКИ
      ===================================== */}

      <a
        href="#tournaments"
        className="kfl-home-hero__scroll"
        aria-label="Перейти к турнирам"
      >
        <span>ЛИСТАЙ ВНИЗ</span>

        <span className="kfl-home-hero__scroll-line" />
      </a>

      {/* =====================================
          НИЖНЯЯ ПОЛОСА
      ===================================== */}

      <div className="kfl-home-hero__bottom-bar">
        <span>
          KYRGYZ FREESTYLE LEAGUE
        </span>

        <span>
          DISCIPLINE / RESPECT / VICTORY
        </span>
      </div>
    </section>
  );
}
