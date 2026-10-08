import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRightOutlined, CalendarOutlined, FileTextOutlined, PlusOutlined, TrophyOutlined, UserOutlined } from '@ant-design/icons';
import { get } from '../../api/client';
import { fmt } from '../../components/ui';
import { QueryError, QueryState } from '../../components/feedback';
import './KFLAdminDashboard.css';

type Stats = { athletes?: number; matches?: number; upcoming?: number; completed?: number; applications?: number; champions?: number; media?: number; nextEvent?: { id: string | number; name: string; date: string; isPublished?: boolean } | null; season?: { name?: string } | null; activity?: Array<{ id: string | number; createdAt: string; action: string; user?: { name?: string } | null }> };
const actions = [{ href: '/admin/athletes?create=1', label: 'Добавить спортсмена', icon: UserOutlined }, { href: '/admin/events', label: 'Создать событие', icon: CalendarOutlined }, { href: '/admin/matches?create=1', label: 'Создать матч', icon: TrophyOutlined }, { href: '/admin/media', label: 'Создать материал', icon: FileTextOutlined }];

export default function KFLAdminDashboard() {
  const query = useQuery<Stats>({ queryKey: ['a-stats'], queryFn: () => get('/admin/stats') });
  const data = query.data;
  const cards = [['Спортсмены', data?.athletes, 'admin-kpi--red'], ['Всего матчей', data?.matches, ''], ['Предстоящие', data?.upcoming, ''], ['Завершено', data?.completed, ''], ['Новые заявки', data?.applications, ''], ['Чемпионы', data?.champions, ''], ['Медиа', data?.media, '']] as const;
  return <div className="kfl-admin-dashboard">
    <div className="kfl-admin-dashboard__intro"><div><span className="kfl-admin-dashboard__eyebrow">KFL / CONTROL ROOM</span><h2>Лига в фокусе</h2><p>Операционный обзор Kyrgyz Freestyle League</p></div>{data?.season?.name && <span className="kfl-admin-dashboard__season">{data.season.name}</span>}</div>
    <QueryState query={query}>{query.isError ? <QueryError error={query.error} retry={query.refetch} /> : data ? <>
      <section className="kfl-admin-kpis" aria-label="Ключевые показатели">{cards.map(([label, value, tone]) => <article className={`kfl-admin-kpi ${tone}`} key={label}><span>{label}</span><strong>{value ?? '—'}</strong></article>)}</section>
      <section className="kfl-admin-dashboard__grid"><article className="kfl-admin-next"><span className="kfl-admin-dashboard__eyebrow">БЛИЖАЙШЕЕ СОБЫТИЕ</span>{data.nextEvent ? <><h3>{data.nextEvent.name}</h3><p><CalendarOutlined /> {fmt(data.nextEvent.date)} <span className={`kfl-admin-status ${data.nextEvent.isPublished ? 'is-live' : ''}`}>{data.nextEvent.isPublished ? 'Опубликовано' : 'Черновик'}</span></p><Link to="/admin/events">Управлять событиями <ArrowRightOutlined /></Link></> : <p className="kfl-admin-muted">События ещё не запланированы.</p>}</article><article className="kfl-admin-actions"><span className="kfl-admin-dashboard__eyebrow">БЫСТРЫЕ ДЕЙСТВИЯ</span><div>{actions.map(({ href, label, icon: Icon }) => <Link key={href} to={href}><Icon />{label}<PlusOutlined /></Link>)}</div></article></section>
      <section className="kfl-admin-activity"><div className="kfl-admin-activity__head"><div><span className="kfl-admin-dashboard__eyebrow">AUDIT TRAIL</span><h3>Последние действия</h3></div><span className="kfl-admin-muted">{data.activity?.length ?? 0} записей</span></div>{data.activity?.length ? <div className="kfl-admin-activity__list">{data.activity.map((item) => <div key={item.id}><time>{fmt(item.createdAt)}</time><span>{item.user?.name ?? 'system'}</span><strong>{item.action}</strong></div>)}</div> : <p className="kfl-admin-empty">Действий пока нет.</p>}</section>
    </> : null}</QueryState>
  </div>;
}
