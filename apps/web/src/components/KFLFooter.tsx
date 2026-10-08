import { ArrowUpOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './KFLFooter.css';

export default function KFLFooter() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();
  const toTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  return <footer className="kfl-footer">
    <section className="kfl-footer-brand" aria-label="KFL branding"><div className="kfl-footer-container"><span className="kfl-footer-watermark" aria-hidden="true">KFL</span><span className="kfl-footer-kicker">THE FUTURE OF FREESTYLE WRESTLING</span><h2>KYRGYZ<br /><span>FREESTYLE LEAGUE</span></h2><p>Сила. Характер. Борьба.</p><div className="kfl-footer-rule" /></div></section>
    <div className="kfl-footer-container kfl-footer-grid">
      <section className="kfl-footer-column kfl-footer-about"><strong className="kfl-footer-logo"><i />KFL</strong><p>Кыргызская лига вольной борьбы. Сцена для спортсменов, чемпионов и нового поколения борьбы.</p></section>
      <nav className="kfl-footer-column" aria-label="Навигация по лиге"><h3>ЛИГА</h3><Link to="/">{t('nav.home')}</Link><Link to="/events">{t('nav.events')}</Link><Link to="/athletes">{t('nav.athletes')}</Link><Link to="/rankings">{t('nav.rankings')}</Link><Link to="/champions">{t('nav.champions')}</Link></nav>
      <nav className="kfl-footer-column" aria-label="Медиа"><h3>МЕДИА</h3><Link to="/media">Новости и материалы <ArrowRightOutlined /></Link><Link to="/media">Интервью <ArrowRightOutlined /></Link><Link to="/media">Хайлайты <ArrowRightOutlined /></Link><Link to="/media">Истории спортсменов <ArrowRightOutlined /></Link></nav>
      <section className="kfl-footer-column"><h3>КОНТАКТЫ</h3><p className="kfl-footer-muted">Следите за новостями лиги на официальном сайте.</p><Link className="kfl-footer-cta" to="/apply">Подать заявку <ArrowRightOutlined /></Link></section>
    </div>
    <div className="kfl-footer-bottom kfl-footer-container"><span>© KFL — Kyrgyz Freestyle League · {year}</span><span>ALL RIGHTS RESERVED</span><button type="button" className="kfl-footer-top" onClick={toTop}>НАВЕРХ <ArrowUpOutlined /></button></div>
  </footer>;
}
