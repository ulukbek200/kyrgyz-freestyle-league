import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './About.css';

export type LeaguePerson = { name: string; role: string; photo: string };
export function LeaguePeople({ people }: { people: LeaguePerson[] }) {
  return people.length ? <div className="about-people">{people.map(p => <article key={p.name}><img src={p.photo} alt={p.name} loading="lazy" /><h3>{p.name}</h3><p>{p.role}</p></article>)}</div> : <p className="about-copy">За каждой схваткой стоит команда. Здесь появятся профили представителей KFL после подтверждения информации о составе лиги.</p>;
}
const values = [
  ['DISCIPLINE', 'Дисциплина', 'Ежедневная работа. Ответственность за свой путь. Уважение к правилам.'],
  ['RESPECT', 'Уважение', 'К сопернику, тренеру и каждому, кто выходит на ковёр.'],
  ['COURAGE', 'Смелость', 'Принимать вызов, учиться на поражениях и снова идти вперёд.'],
  ['LEGACY', 'Наследие', 'Передавать любовь к борьбе следующему поколению.'],
];
export default function About() {
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [videoPaused, setVideoPaused] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const previousTitle = document.title;
    const description = document.querySelector('meta[name="description"]');
    const previousDescription = description?.getAttribute('content');
    document.title = 'О нас — Kyrgyz Freestyle League';
    description?.setAttribute('content', 'Kyrgyz Freestyle League: наша миссия, ценности и будущее вольной борьбы Кыргызстана.');
    return () => {
      document.title = previousTitle;
      if (previousDescription != null) description?.setAttribute('content', previousDescription);
    };
  }, []);
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setVideoEnabled(!reduced.matches && window.innerWidth > 767);
    sync(); reduced.addEventListener('change', sync);
    const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); } }), { threshold: .08 });
    root.current?.querySelectorAll('[data-reveal]').forEach(el => observer.observe(el));
    return () => { observer.disconnect(); reduced.removeEventListener('change', sync); };
  }, []);
  return <div className="about-page" ref={root}>
    <section className="about-hero" aria-labelledby="about-title">
      <img className="about-hero-media" src="/media/kfl-hero-poster.webp" alt="Вольная борьба — атмосфера ковра KFL" />
      {videoEnabled && <video ref={video} className="about-hero-media" autoPlay muted loop playsInline aria-hidden="true" poster="/media/kfl-hero-poster.webp"><source src="/media/kfl-hero.mp4" type="video/mp4" /></video>}
      {videoEnabled && <button className="about-video-control" type="button" onClick={() => { if (videoPaused) { void video.current?.play().then(() => setVideoPaused(false)).catch(() => setVideoPaused(true)); } else { video.current?.pause(); setVideoPaused(true); } }} aria-pressed={videoPaused}>{videoPaused ? 'Включить видео' : 'Остановить видео'}</button>}
      <div className="about-container about-hero-content"><span className="about-kicker">KYRGYZ FREESTYLE LEAGUE / THE LEAGUE</span><h1 id="about-title"><span>НЕ ПРОСТО СПОРТ.</span><span>ЭТО <em>НАСЛЕДИЕ.</em></span></h1><p>Сила духа. Характер. Борьба за будущее.</p><a className="about-scroll" href="#about-who">BEYOND THE MAT <span aria-hidden="true">↓</span></a></div>
    </section>
    <section className="about-section about-container about-who" id="about-who" data-reveal><div><span className="about-kicker">01 / WHO WE ARE</span><h2>МЫ СОЗДАЁМ<br />БУДУЩЕЕ <em>БОРЬБЫ.</em></h2></div><div className="about-copy"><p>Kyrgyz Freestyle League — идея современной спортивной среды для вольной борьбы Кыргызстана.</p><p>Наша цель — создавать возможности для перспективных спортсменов, развивать честную конкуренцию и сделать борьбу ближе молодому поколению.</p><p>Мы стремимся соединить силу спортивной традиции с современным подходом к организации соревнований. Это направление нашей работы, а не перечень уже достигнутых результатов.</p></div></section>
    <section className="about-mission about-section"><div className="about-container"><span className="about-kicker">02 / OUR MISSION</span><h2 data-reveal>НАША МИССИЯ —<br /><em>РАСКРЫВАТЬ ПОТЕНЦИАЛ.</em></h2><div className="about-mission-grid">{[['РАЗВИТИЕ', 'Создание возможностей для роста спортсменов.'], ['КОНКУРЕНЦИЯ', 'Формирование сильной и справедливой спортивной среды.'], ['БУДУЩЕЕ', 'Поддержка нового поколения борцов.']].map(([title, text], i) => <article data-reveal key={title}><span className="about-number">0{i+1}</span><h3>{title}</h3><p>{text}</p></article>)}</div></div></section>
    <section className="about-section about-container"><span className="about-kicker">03 / THE SPIRIT OF WRESTLING</span><div className="about-gallery">{['Атмосфера вольной борьбы', 'Работа на ковре', 'Движение и концентрация', 'Характер спортсмена'].map((alt,i) => <figure key={alt} className={'about-frame about-frame-'+i} data-reveal><img src="/media/kfl-hero-poster.webp" alt={alt + ' — фрагмент общего кадра'} loading="lazy" /></figure>)}<div className="about-gallery-caption"><h2>СИЛА НЕ ТОЛЬКО<br />В МЫШЦАХ.<br /><em>СИЛА — В ХАРАКТЕРЕ.</em></h2></div></div><p className="about-image-note">Визуальная композиция из существующего кадра KFL.</p></section>
    <section className="about-values about-section"><div className="about-container"><span className="about-kicker">04 / OUR VALUES</span><h2 data-reveal>ТО, ЧТО <em>ВНУТРИ.</em></h2><div className="about-values-grid">{values.map(([english, title, text],i) => <button key={english} type="button" className={active===i?'is-active':''} onClick={()=>setActive(i)} aria-pressed={active===i}><span className="about-number">0{i+1}</span><small>{english}</small><h3>{title}</h3><p>{text}</p></button>)}</div></div></section>
    <section className="about-section about-container about-who" data-reveal><div><span className="about-kicker">05 / THE PEOPLE BEHIND KFL</span><h2>ЛЮДИ <em>KFL.</em></h2></div><LeaguePeople people={[]} /></section>
    <section className="about-vision about-section"><div className="about-container"><span className="about-kicker">06 / OUR VISION</span><h2 data-reveal>НАШЕ ВИДЕНИЕ<br /><em>БУДУЩЕГО.</em></h2><ol>{[['Открывать возможности', 'Стремимся создать понятный путь развития для перспективных борцов.'], ['Укреплять спортивную среду', 'Планируем развивать соревнования с прозрачными правилами и уважением к спортсменам.'], ['Вдохновлять новое поколение', 'Хотим рассказывать о борьбе и людях, которые выбирают этот путь.']].map(([title,text],i)=><li key={title} data-reveal><span>0{i+1}</span><div><h3>{title}</h3><p>{text}</p></div></li>)}</ol></div></section>
    <section className="about-section about-container about-who" data-reveal><div><span className="about-kicker">07 / PARTNERS</span><h2>ОБЩИЙ <em>ПУТЬ.</em></h2></div><p className="about-copy">Информация о партнёрах появится после подтверждения сотрудничества. Мы публикуем только проверенные сведения.</p></section>
    <section className="about-join"><img src="/media/kfl-hero-poster.webp" alt="Ковёр вольной борьбы KFL" loading="lazy" /><div className="about-container" data-reveal><span className="about-kicker">JOIN THE MOVEMENT</span><h2>БУДУЩЕЕ БОРЬБЫ<br /><em>НАЧИНАЕТСЯ ЗДЕСЬ.</em></h2><p>Стань частью нового поколения кыргызстанской борьбы.</p><div className="about-actions"><Link to="/events">Смотреть турниры <span aria-hidden="true">↗</span></Link><Link to="/athletes">Наши спортсмены <span aria-hidden="true">↗</span></Link></div></div></section>
  </div>;
}
