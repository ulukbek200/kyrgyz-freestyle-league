
import { Link } from 'react-router-dom';
import {
  CrownOutlined,
  TrophyOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';

import {
  fullName,
  Movement,
  Nothing,
  Photo,
} from './ui';

import './KFLRankingRows.css';

type RankingAthlete = {
  id?: string | number;
  slug?: string | null;
  [key: string]: any;
};

type RankingItem = {
  athleteId: string | number;
  athlete: RankingAthlete;
  rank: number;
  wins: number;
  losses: number;
  points: number;
  isChampion?: boolean;
  [key: string]: any;
};

type RankingRowsProps = {
  items?: RankingItem[];
};

function athleteLink(athlete: RankingAthlete) {
  return `/athletes/${encodeURIComponent(
    String(athlete.slug || athlete.id)
  )}`;
}

export default function RankingRows({
  items = [],
}: RankingRowsProps) {
  if (!items.length) {
    return <Nothing />;
  }

  return (
    <div className="kfl-ranking-list">
      <div className="kfl-ranking-list__header">
        <span>ПОЗИЦИЯ</span>
        <span>СПОРТСМЕН</span>
        <span>W–L</span>
        <span>ОЧКИ</span>
        <span>ИЗМЕНЕНИЕ</span>
      </div>

      <div className="kfl-ranking-list__body">
        {items.map((item) => {
          const topThree = item.rank <= 3;
          const leader = item.rank === 1;

          return (
            <div
              key={item.athleteId}
              className={[
                'kfl-ranking-entry',
                topThree
                  ? 'kfl-ranking-entry--top'
                  : '',
                leader
                  ? 'kfl-ranking-entry--leader'
                  : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className="kfl-ranking-entry__position">
                {leader && (
                  <CrownOutlined className="kfl-ranking-entry__crown" />
                )}

                <strong>
                  {String(item.rank).padStart(2, '0')}
                </strong>
              </div>

              <Link
                className="kfl-ranking-entry__athlete"
                to={athleteLink(item.athlete)}
              >
                <div className="kfl-ranking-entry__photo">
                  <Photo a={item.athlete} />
                </div>

                <div className="kfl-ranking-entry__identity">
                  <strong>
                    {fullName(item.athlete)}
                  </strong>

                  <div className="kfl-ranking-entry__badges">
                    {item.isChampion && (
                      <span className="kfl-ranking-entry__champion">
                        <TrophyOutlined />
                        CHAMPION
                      </span>
                    )}

                    {topThree && !item.isChampion && (
                      <span className="kfl-ranking-entry__top-label">
                        TOP {item.rank}
                      </span>
                    )}
                  </div>
                </div>

                <ArrowRightOutlined className="kfl-ranking-entry__arrow" />
              </Link>

              <div className="kfl-ranking-entry__record">
                <span className="kfl-ranking-entry__mobile-label">
                  ПОБЕДЫ / ПОРАЖЕНИЯ
                </span>

                <strong>
                  {item.wins}
                  <span>–</span>
                  {item.losses}
                </strong>
              </div>

              <div className="kfl-ranking-entry__points">
                <span className="kfl-ranking-entry__mobile-label">
                  ОЧКИ
                </span>

                <strong>{item.points}</strong>
                <small>PTS</small>
              </div>

              <div className="kfl-ranking-entry__movement">
                <span className="kfl-ranking-entry__mobile-label">
                  ИЗМЕНЕНИЕ
                </span>

                <Movement r={item} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
