import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const ru = {
  nav: { home: 'Главная', matches: 'Матчи', rankings: 'Рейтинг', athletes: 'Спортсмены', champions: 'Чемпионы', events: 'События', media: 'Медиа', apply: 'Подать заявку' },
  hero: { title: 'Kyrgyz Freestyle League', slogan: 'Каждый бой меняет рейтинг. Каждая неделя — шаг к титулу.' },
  common: { wins: 'Победы', losses: 'Поражения', points: 'Очки', winRate: 'Win rate', champion: 'Чемпион', all: 'Все', loading: 'Загрузка', empty: 'Пока ничего нет', season: 'Сезон', weight: 'Вес', city: 'Город', club: 'Клуб', search: 'Поиск', more: 'Смотреть все', details: 'Подробнее' },
  status: { UPCOMING: 'Скоро', LIVE: 'В эфире', COMPLETED: 'Завершён', CANCELLED: 'Отменён' },
  method: { POINTS: 'По баллам', TECHNICAL_SUPERIORITY: 'Тех. превосходство', PIN: 'Туше', FORFEIT: 'Неявка', DISQUALIFICATION: 'Дисквалификация', INJURY: 'Травма' },
  type: { REGULAR: 'Регулярный матч', CHAMPIONSHIP: 'Титульный матч', TITLE_DEFENSE: 'Защита титула' },
};
const en = {
  nav: { home: 'Home', matches: 'Matches', rankings: 'Rankings', athletes: 'Athletes', champions: 'Champions', events: 'Events', media: 'Media', apply: 'Apply' },
  hero: { title: 'Kyrgyz Freestyle League', slogan: 'Every bout moves the ranking. Every week is a step to the title.' },
  common: { wins: 'Wins', losses: 'Losses', points: 'Points', winRate: 'Win rate', champion: 'Champion', all: 'All', loading: 'Loading', empty: 'Nothing here yet', season: 'Season', weight: 'Weight', city: 'City', club: 'Club', search: 'Search', more: 'View all', details: 'Details' },
  status: { UPCOMING: 'Upcoming', LIVE: 'Live', COMPLETED: 'Completed', CANCELLED: 'Cancelled' },
  method: { POINTS: 'Points', TECHNICAL_SUPERIORITY: 'Technical superiority', PIN: 'Pin', FORFEIT: 'Forfeit', DISQUALIFICATION: 'Disqualification', INJURY: 'Injury' },
  type: { REGULAR: 'Regular match', CHAMPIONSHIP: 'Championship', TITLE_DEFENSE: 'Title defense' },
};
const ky = {
  ...ru,
  nav: { home: 'Башкы бет', matches: 'Беттештер', rankings: 'Рейтинг', athletes: 'Спортчулар', champions: 'Чемпиондор', events: 'Иш-чаралар', media: 'Медиа', apply: 'Арыз берүү' },
  hero: { title: 'Kyrgyz Freestyle League', slogan: 'Ар бир беттеш рейтингди өзгөртөт.' },
};

i18n.use(initReactI18next).init({
  resources: { ru: { translation: ru }, en: { translation: en }, ky: { translation: ky } },
  lng: localStorage.getItem('lang') ?? 'ru', fallbackLng: 'ru', interpolation: { escapeValue: false },
});
export default i18n;
