import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, Empty, Skeleton } from 'antd';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';

export const fmt = (d: any, f = 'D MMM YYYY, HH:mm') => dayjs(d).format(f);
export const fullName = (a: any) => (a ? `${a.firstName} ${a.lastName}` : '—');

export function useTitle(title: string, description?: string) {
  useEffect(() => {
    document.title = `${title} · KFL`;
    if (description) document.querySelector('meta[name=description]')?.setAttribute('content', description);
  }, [title, description]);
}

export const Loading = () => <div className="loading-state" role="status" aria-label="Загрузка"><Skeleton active paragraph={{ rows: 5 }} /></div>;
export const Nothing = () => { const { t } = useTranslation(); return <Empty description={t('common.empty')} />; };

export function Photo({ a, size = 40 }: { a: any; size?: number }) {
  return <Avatar size={size} src={a?.photoUrl} style={{ background: '#1b2438', flex: 'none' }}>{a?.firstName?.[0]}</Avatar>;
}

export function MatchCard({ m }: { m: any }) {
  const { t } = useTranslation();
  const done = m.status === 'COMPLETED';
  const side = (a: any, cls: string, b = '') => (
    <Link to={`/athletes/${a.slug}`} className={`side ${b}`} onClick={(e) => e.stopPropagation()}>
      <Photo a={a} />
      <div className={cls} style={{ minWidth: 0 }}>
        <div className={`name ${done && m.winnerId === a.id ? 'winner' : ''}`}>{fullName(a)}{done && m.winnerId === a.id && ' ✓'}</div>
      </div>
    </Link>
  );
  return (
    <article className="card match-card">
      <div style={{ marginBottom: 10 }}>
        <span className={`tag ${m.status === 'LIVE' ? 'red' : ''}`}>{t(`status.${m.status}`)}</span>
        {m.type !== 'REGULAR' && <span className="tag red">{t(`type.${m.type}`)}</span>}
        <span className="muted" style={{ fontSize: 13 }}>{m.weightClass?.name} · {m.event?.name}</span>
      </div>
      <div className="match">
        {side(m.athleteA, 'corner-a')}
        <div className="vs">{done ? `${m.scoreA}:${m.scoreB}` : 'VS'}</div>
        {side(m.athleteB, 'corner-b', 'b')}
      </div>
      <div className="match-footer"><span className="muted">{fmt(m.scheduledAt)}{done && m.method ? ` · ${t(`method.${m.method}`)}` : ''}</span><Link to={`/matches/${m.id}`} aria-label={`Матч: ${fullName(m.athleteA)} — ${fullName(m.athleteB)}`}>Подробнее →</Link></div>
    </article>
  );
}

export function Movement({ r }: { r: any }) {
  if (r.isNew) return <span className="up">new</span>;
  if (r.movement > 0) return <span className="up">▲ {r.movement}</span>;
  if (r.movement < 0) return <span className="down">▼ {-r.movement}</span>;
  return <span className="muted">–</span>;
}

export const SectionHead = ({ title, to }: { title: string; to?: string }) => {
  const { t } = useTranslation();
  return <div className="section-head"><h2>{title}</h2>{to && <Link to={to} className="muted">{t('common.more')}</Link>}</div>;
};

const CORNER = { red: '#d4261c', blue: '#1d4fd7', neutral: '#5d6779' } as const;

function Silhouette({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 200 250" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <rect width="200" height="250" fill="#1b2438" />
      <circle cx="100" cy="86" r="36" fill={color} opacity=".85" />
      <path d="M18 250c0-62 38-96 82-96s82 34 82 96z" fill={color} opacity=".85" />
      <path d="M62 150c10 14 24 20 38 20s28-6 38-20" stroke="#1b2438" strokeWidth="6" fill="none" />
    </svg>
  );
}

/** Портрет спортсмена: фото (обрезка по верху) или силуэт в цвете угла. */
export function Portrait({ a, corner = 'neutral', ratio, className = '' }: { a: any; corner?: keyof typeof CORNER; ratio?: string; className?: string }) {
  const color = CORNER[corner];
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [a?.photoUrl]);
  return (
    <div className={`portrait ${className}`} style={{ aspectRatio: ratio, borderBottom: `4px solid ${color}` }}>
      {a?.photoUrl && !failed ? <img src={a.photoUrl} alt={fullName(a)} loading="lazy" onError={() => setFailed(true)} /> : <Silhouette color={color} />}
    </div>
  );
}

export function AthleteCard({ a }: { a: any }) {
  const { t } = useTranslation();
  const r = a.ranking;
  return (
    <Link to={`/athletes/${a.slug}`} className="ac">
      {a.isChampion && <span className="badge-champ">{t('common.champion')}</span>}
      <Portrait a={a} corner={a.isChampion ? 'red' : 'neutral'} ratio="3/4" />
      <div className="ac-info">
        <div className="ac-rank display">#{r?.rank ?? '–'}</div>
        <h3>{a.firstName}<br />{a.lastName}</h3>
        <div className="ac-meta">{a.country} · {a.weightClass?.name} · {a.club?.name ?? a.city}</div>
        <div className="ac-meta">{a.stats?.record ?? '—'} W–L · {r?.points ?? 0} {t('common.points').toLowerCase()}</div>
      </div>
    </Link>
  );
}

function useCountdown(date?: string) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);
  if (!date) return null;
  const s = Math.max(0, Math.floor((+new Date(date) - now) / 1000));
  return { over: s === 0, d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

/** Hero события: главный бой, портреты, обратный отсчёт, билеты / трансляция. */
export function EventHero({ ev, page = false }: { ev: any; page?: boolean }) {
  const { t } = useTranslation();
  const cd = useCountdown(ev?.date);
  if (!ev) return <section className="hero2"><div className="wrap"><h1 className="display hero2-title">{t('hero.title')}</h1><p>{t('hero.slogan')}</p></div></section>;
  const m = ev.mainMatch;
  const done = cd?.over;
  const Side = ({ a, corner }: { a: any; corner: 'red' | 'blue' }) => (
    <Link to={`/athletes/${a.slug}`} className={`hero2-side ${corner}`}>
      <Portrait a={a} corner={corner} ratio="3/4" />
      <div className="hero2-name display"><small>{a.firstName}</small>{a.lastName}</div>
    </Link>
  );
  return (
    <section className="hero2" style={ev.coverUrl ? { backgroundImage: `linear-gradient(rgba(13,20,36,.82),rgba(13,20,36,.92)), url(${ev.coverUrl})` } : undefined}>
      <div className="wrap">
        <div className="hero2-meta">
          <span className="tag red">{ev.season?.name}</span>
          <span>{fmt(ev.date)}</span><span>{[ev.venue, ev.city].filter(Boolean).join(', ')}</span>
        </div>
        <h1 className="display hero2-title">{ev.name}</h1>
        {m ? (
          <div className="hero2-fight">
            <Side a={m.athleteA} corner="red" />
            <div className="hero2-mid">
              <div className="display hero2-vs">VS</div>
              <div>{m.weightClass?.name}</div>
              {m.type !== 'REGULAR' && <span className="tag red">{t(`type.${m.type}`)}</span>}
            </div>
            <Side a={m.athleteB} corner="blue" />
          </div>
        ) : null}
        {cd && !done && (
          <div className="countdown">
            {[[cd.d, 'дн'], [cd.h, 'ч'], [cd.m, 'мин'], [cd.s, 'сек']].map(([v, l]) => <div key={l as string}><b className="display">{String(v).padStart(2, '0')}</b><span>{l}</span></div>)}
          </div>
        )}
        <div className="cta">
          {ev.ticketUrl && !done && <a className="btn" href={ev.ticketUrl} target="_blank" rel="noreferrer">Купить билеты</a>}
          {ev.streamUrl && <a className="btn ghost" href={ev.streamUrl} target="_blank" rel="noreferrer">{done ? 'Запись' : 'Смотреть онлайн'}</a>}
          {!page && <Link className="btn ghost" to={`/events/${ev.slug}`}>{done ? 'Результаты' : 'Бойцовская карта'}</Link>}
          {!page && <Link className="btn ghost" to="/rankings">{t('nav.rankings')}</Link>}
        </div>
      </div>
    </section>
  );
}
