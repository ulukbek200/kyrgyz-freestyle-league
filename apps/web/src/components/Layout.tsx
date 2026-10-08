import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Button, Drawer, Input, Modal, Select, Spin } from 'antd';
import { MenuOutlined, SearchOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { get } from '../api/client';
import { QueryError, useDebounce } from './feedback';
import './PublicHeader.css';
import KFLFooter from './KFLFooter';
import './PublicLayout.css';
const LINKS = [['/', 'nav.home'], ['/events', 'nav.events'], ['/athletes', 'nav.athletes'], ['/rankings', 'nav.rankings'], ['/champions', 'nav.champions'], ['/media', 'nav.media']];
function GlobalSearch({ open, close }: { open: boolean; close: () => void }) {
  const [text, setText] = useState(''); const q = useDebounce(text.trim()); const [selected, setSelected] = useState(0); const navigate = useNavigate(); const ref = useRef<any>();
  const query = useQuery({ queryKey: ['search', q], queryFn: () => get('/search', { q }), enabled: open && q.length >= 2 });
  useEffect(() => setSelected(0), [q]);
  const go = (url: string) => { close(); setText(''); navigate(url); };
  return <Modal className="search-modal" title="Поиск по лиге" open={open} onCancel={close} footer={null} afterOpenChange={v => v && ref.current?.focus()}>
    <Input ref={ref} aria-label="Поиск спортсменов, событий, матчей и медиа" placeholder="Спортсмен, событие, матч или материал" value={text} allowClear onChange={e => setText(e.target.value)}
      role="combobox" aria-expanded={!!query.data?.length} aria-controls="search-results" aria-activedescendant={query.data?.[selected] ? 'search-option-' + selected : undefined}
      onKeyDown={e => { const items = query.data ?? []; if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setSelected(i => Math.max(0, Math.min(items.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))); } if (e.key === 'Enter' && items[selected]) go(items[selected].url); }} />
    <div aria-live="polite" className="search-status">{q.length < 2 ? 'Введите минимум два символа' : query.isFetching || text.trim() !== q ? <Spin size="small" /> : query.isError ? <QueryError error={query.error} retry={query.refetch} /> : !query.data?.length ? 'Ничего не найдено. Попробуйте другое имя.' : query.data.length + ' результатов'}</div>
    <div id="search-results" role="listbox">{q.length >= 2 && text.trim() === q && query.data?.map((r: any, i: number) => <button id={'search-option-' + i} type="button" role="option" aria-selected={selected === i} className={'search-option ' + (selected === i ? 'selected' : '')} key={r.url} onMouseEnter={() => setSelected(i)} onClick={() => go(r.url)}><small>{({ athlete: 'Спортсмен', event: 'Событие', match: 'Матч', media: 'Медиа', club: 'Клуб' } as any)[r.type]}</small>{r.label}</button>)}</div>
  </Modal>;
}
export default function Layout() {
  const { t, i18n } = useTranslation(); const [open, setOpen] = useState(false); const [search, setSearch] = useState(false); const [compact, setCompact] = useState(false); const location = useLocation();
  useEffect(() => { const scroll = () => setCompact(window.scrollY > 40); scroll(); window.addEventListener('scroll', scroll, { passive: true }); return () => window.removeEventListener('scroll', scroll); }, []);
  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [location.pathname]);
  useEffect(() => { document.body.style.overflow = open ? 'hidden' : ''; return () => { document.body.style.overflow = ''; }; }, [open]);
  const language = <Select aria-label="Язык" value={i18n.language} onChange={l => { i18n.changeLanguage(l); localStorage.setItem('lang', l); }} options={['ru','ky','en'].map(value => ({ value, label: value.toUpperCase() }))} />;
  return <div className="public-layout"><a className="skip-link" href="#main-content">К содержимому</a><header className={'header ' + (compact ? 'compact' : '')}><div className="wrap">
    <Link to="/" className="logo" aria-label="KFL — главная"><i />KFL</Link><nav className="nav" aria-label="Основная навигация">{LINKS.map(([to, k]) => <NavLink key={to} to={to} end={to === '/'}>{t(k)}</NavLink>)}</nav>
    <div className="header-tools"><Link className="header-cta" to="/matches">Матчи</Link><Button type="text" aria-label="Открыть поиск" icon={<SearchOutlined />} onClick={() => setSearch(true)} /><span className="desktop-language">{language}</span><Button className="burger" type="text" aria-label="Открыть меню" aria-expanded={open} aria-controls="public-mobile-menu" icon={<MenuOutlined />} onClick={() => setOpen(true)} /></div>
  </div></header><Drawer id="public-mobile-menu" open={open} onClose={() => setOpen(false)} width="min(360px, 90vw)" title="KFL / MENU"><nav className="drawer-nav">{[...LINKS, ['/matches', 'nav.matches'], ['/apply', 'nav.apply']].map(([to, k]) => <Link key={to} to={to} onClick={() => setOpen(false)}>{t(k)}</Link>)}</nav><div className="section">{language}</div></Drawer>
    <GlobalSearch open={search} close={() => setSearch(false)} /><main id="main-content" tabIndex={-1}><Outlet /></main><KFLFooter /></div>;
}

