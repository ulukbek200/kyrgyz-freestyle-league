
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  PlayCircleOutlined,
  ReadOutlined,
} from '@ant-design/icons';

import { get } from '../api/client';
import {
  fmt,
  fullName,
  Nothing,
  useTitle,
} from '../components/ui';
import { QueryState } from '../components/feedback';

import './KFLMedia.css';

type MediaPost = {
  id: string | number;
  slug?: string | null;
  title: string;
  excerpt?: string | null;
  content?: string | null;
  category?: string | null;
  coverUrl?: string | null;
  publishedAt?: string | null;
  athlete?: {
    id: string | number;
    slug?: string | null;
    [key: string]: any;
  } | null;
};

export const mediaCategories = [
  ['', 'Все'],
  ['NEWS', 'Новости'],
  ['INTERVIEW', 'Интервью'],
  ['ATHLETE_STORY', 'Истории'],
  ['HIGHLIGHT', 'Хайлайты'],
  ['TRAINING', 'Тренировки'],
  ['BACKSTAGE', 'За кулисами'],
  ['FACE_OFF', 'Face off'],
  ['CHAMPIONSHIP', 'Чемпионство'],
] as const;

const categoryLabel = (value?: string | null) =>
  mediaCategories.find(
    ([key]) =>
      key ===
      (value === 'BEHIND_THE_SCENES'
        ? 'BACKSTAGE'
        : value)
  )?.[1] || value || 'Медиа';

const mediaPath = (post: MediaPost) =>
  `/media/${encodeURIComponent(
    String(post.slug || post.id)
  )}`;

const athletePath = (post: MediaPost) =>
  post.athlete
    ? `/athletes/${encodeURIComponent(
        String(post.athlete.slug || post.athlete.id)
      )}`
    : '/athletes';

function MediaImage({ post }: { post: MediaPost }) {
  return post.coverUrl ? (
    <img
      className="kfl-media-image"
      src={post.coverUrl}
      alt={post.title}
      loading="lazy"
    />
  ) : (
    <div
      className="kfl-media-image kfl-media-image--empty"
      aria-label="Нет обложки"
    >
      KFL
    </div>
  );
}

function MediaCard({
  post,
  featured = false,
}: {
  post: MediaPost;
  featured?: boolean;
}) {
  return (
    <Link
      to={mediaPath(post)}
      className={`kfl-media-card${
        featured ? ' kfl-media-card--featured' : ''
      }`}
    >
      <div className="kfl-media-card__visual">
        <MediaImage post={post} />

        <span className="kfl-media-card__category">
          {categoryLabel(post.category)}
        </span>
      </div>

      <div className="kfl-media-card__body">
        <span className="kfl-media-kicker">
          KFL / MEDIA
        </span>

        <h3>{post.title}</h3>

        {post.excerpt && <p>{post.excerpt}</p>}

        <div className="kfl-media-card__bottom">
          <span>
            {post.publishedAt
              ? fmt(post.publishedAt, 'D MMM YYYY')
              : 'KFL'}
          </span>

          <span>
            ЧИТАТЬ <ArrowRightOutlined />
          </span>
        </div>
      </div>
    </Link>
  );
}

/* =========================================
   KFL MEDIA CENTER
========================================= */

export function Media() {
  useTitle('Медиа KFL');

  const [category, setCategory] = useState('');

  const query = useQuery<MediaPost[]>({
    queryKey: ['media', category],
    queryFn: () =>
      get('/media', {
        category: category || undefined,
      }),
  });

  const posts = query.data ?? [];
  const featured = posts[0];

  return (
    <main className="kfl-media-page">
      <header className="kfl-media-hero">
        <div className="kfl-media-container">
          <span className="kfl-media-kicker">
            <PlayCircleOutlined />
            INSIDE THE LEAGUE
          </span>

          <h1>
            KFL <span>MEDIA.</span>
          </h1>

          <p>
            Новости, интервью, главные моменты схваток
            и истории спортсменов Кыргызской лиги
            вольной борьбы.
          </p>
        </div>
      </header>

      <div className="kfl-media-container">
        <div className="kfl-media-section-heading">
          <div>
            <span className="kfl-media-kicker">
              LATEST STORIES
            </span>

            <h2>МЕДИАЦЕНТР</h2>
          </div>

          <span className="kfl-media-section-heading__count">
            {posts.length} МАТЕРИАЛОВ
          </span>
        </div>

        <div
          className="kfl-media-filters"
          role="group"
          aria-label="Категории публикаций"
        >
          {mediaCategories.map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={
                category === value ? 'is-active' : ''
              }
              aria-pressed={category === value}
              onClick={() => setCategory(value)}
            >
              {label}
            </button>
          ))}
        </div>

        <QueryState query={query}>
          {featured ? (
            <div className="kfl-media-content">
              <MediaCard post={featured} featured />

              {posts.length > 1 && (
                <div className="kfl-media-grid">
                  {posts.slice(1).map((post) => (
                    <MediaCard
                      key={post.id}
                      post={post}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="kfl-media-empty">
              <Nothing />
            </div>
          )}
        </QueryState>
      </div>
    </main>
  );
}

/* =========================================
   KFL MEDIA ARTICLE
========================================= */

export function MediaPage() {
  const { id } = useParams();

  const query = useQuery<MediaPost>({
    queryKey: ['media-detail', id],
    queryFn: () =>
      get(
        '/media/' +
          encodeURIComponent(String(id))
      ),
    enabled: Boolean(id),
  });

  const post = query.data;

  useTitle(post?.title ?? 'Медиа KFL');

  return (
    <main className="kfl-media-page kfl-media-detail">
      <div className="kfl-media-container">
        <Link className="kfl-media-back" to="/media">
          <ArrowLeftOutlined />
          ВСЕ МАТЕРИАЛЫ
        </Link>

        <QueryState query={query}>
          {post && (
            <article>
              <div className="kfl-media-detail__header">
                <span className="kfl-media-kicker">
                  <ReadOutlined />
                  {categoryLabel(post.category)}
                </span>

                <h1>{post.title}</h1>

                <div className="kfl-media-detail__meta">
                  {post.publishedAt && (
                    <span>
                      {fmt(
                        post.publishedAt,
                        'D MMM YYYY'
                      )}
                    </span>
                  )}

                  {post.athlete && (
                    <Link to={athletePath(post)}>
                      {fullName(post.athlete)}
                      <ArrowRightOutlined />
                    </Link>
                  )}
                </div>
              </div>

              <div className="kfl-media-detail__cover">
                <MediaImage post={post} />
              </div>

              <div className="kfl-media-detail__content">
                {post.excerpt && (
                  <p className="kfl-media-detail__lead">
                    {post.excerpt}
                  </p>
                )}

                {post.content && (
                  <div className="kfl-media-detail__prose">
                    {post.content}
                  </div>
                )}

                {!post.content && !post.excerpt && (
                  <Nothing />
                )}

                <Link
                  className="kfl-media-detail__return"
                  to="/media"
                >
                  БОЛЬШЕ МАТЕРИАЛОВ
                  <ArrowRightOutlined />
                </Link>
              </div>
            </article>
          )}
        </QueryState>
      </div>
    </main>
  );
}
