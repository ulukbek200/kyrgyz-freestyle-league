
import { Button, Empty, Tag } from 'antd';
import { Link } from 'react-router-dom';
import { Pencil, RotateCcw, Swords } from 'lucide-react';
import {
  fullName,
  formatDate,
  type Row,
} from './api';
import { Status } from './components';

type Props = {
  matches: Row[];
  onEdit: (match: Row) => void;
  onResult: (match: Row) => void;
  onCancelResult: (match: Row) => void;
  pending?: boolean;
};

export default function FightCardView({
  matches,
  onEdit,
  onResult,
  onCancelResult,
  pending = false,
}: Props) {
  if (!matches.length) {
    return (
      <Empty description="Схватки пока не найдены" />
    );
  }

  return (
    <div className="kfl-fight-grid">
      {matches.map((match) => {
        const completed = match.status === 'COMPLETED';
        const cancelled = match.status === 'CANCELLED';

        return (
          <article className="kfl-fight-card-v4" key={match.id}>
            <header className="kfl-fight-card-v4__header">
              <div>
                <span className="kfl-fight-card-v4__eyebrow">
                  KFL / FIGHT CARD
                </span>
                <h3>{match.event?.name || 'Турнир'}</h3>
                <span className="kfl-fight-card-v4__date">
                  {formatDate(match.scheduledAt)}
                </span>
              </div>

              <Status value={match.status} />
            </header>

            <div className="kfl-fight-card-v4__meta">
              <Tag color="default">
                {match.weightClass?.name || 'Категория'}
              </Tag>

              {match.isTitleFight && (
                <Tag color="gold">ТИТУЛЬНАЯ</Tag>
              )}
            </div>

            <div className="kfl-fight-card-v4__fighters">
              <div className="kfl-fight-card-v4__fighter">
                <div className="kfl-fight-card-v4__avatar red">
                  {match.athleteA?.photoUrl ? (
                    <img
                      src={match.athleteA.photoUrl}
                      alt={fullName(match.athleteA)}
                      loading="lazy"
                    />
                  ) : (
                    <span>
                      {match.athleteA?.firstName?.[0] || 'K'}
                    </span>
                  )}
                </div>

                <small>КРАСНЫЙ УГОЛ</small>
                <strong>{fullName(match.athleteA)}</strong>
              </div>

              <div className="kfl-fight-card-v4__center">
                {match.score ? (
                  <strong>
                    {match.score.athleteAPoints}
                    <span> : </span>
                    {match.score.athleteBPoints}
                  </strong>
                ) : (
                  <strong>VS</strong>
                )}

                <span>
                  {completed ? 'РЕЗУЛЬТАТ' : 'ПРОТИВОСТОЯНИЕ'}
                </span>
              </div>

              <div className="kfl-fight-card-v4__fighter">
                <div className="kfl-fight-card-v4__avatar blue">
                  {match.athleteB?.photoUrl ? (
                    <img
                      src={match.athleteB.photoUrl}
                      alt={fullName(match.athleteB)}
                      loading="lazy"
                    />
                  ) : (
                    <span>
                      {match.athleteB?.firstName?.[0] || 'K'}
                    </span>
                  )}
                </div>

                <small>СИНИЙ УГОЛ</small>
                <strong>{fullName(match.athleteB)}</strong>
              </div>
            </div>

            {match.winner && (
              <div className="kfl-fight-card-v4__winner">
                <span>ПОБЕДИТЕЛЬ</span>
                <strong>{fullName(match.winner)}</strong>
                {match.method && <Status value={match.method} />}
              </div>
            )}

            <footer className="kfl-fight-card-v4__actions">
              {!cancelled && (
                <Button
                  type="primary"
                  icon={<Swords size={15} />}
                  disabled={pending}
                  onClick={() => onResult(match)}
                >
                  {completed
                    ? 'Исправить результат'
                    : 'Ввести результат'}
                </Button>
              )}

              {!completed && (
                <Button
                  icon={<Pencil size={14} />}
                  disabled={pending}
                  onClick={() => onEdit(match)}
                >
                  Изменить пару
                </Button>
              )}

              {completed && (
                <Button
                  danger
                  icon={<RotateCcw size={14} />}
                  disabled={pending}
                  onClick={() => onCancelResult(match)}
                >
                  Отменить
                </Button>
              )}

              <Link
                to={`/matches/${match.id}`}
                target="_blank"
                rel="noreferrer"
              >
                На сайте ↗
              </Link>
            </footer>
          </article>
        );
      })}
    </div>
  );
}
