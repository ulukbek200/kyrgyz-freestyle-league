
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Select } from 'antd';
import {
  BarChartOutlined,
  CalendarOutlined,
  InfoCircleOutlined,
  SafetyCertificateOutlined,
  TrophyOutlined,
} from '@ant-design/icons';

import { get } from '../api/client';
import { useTitle } from '../components/ui';
import { QueryState } from '../components/feedback';
import RankingRows from '../components/RankingRows';

import './KFLRankings.css';

type OptionItem = {
  id: string;
  name: string;
};

type RankingRules = {
  methodBonus?: Record<string, number>;
  tieBreakers?: string[];
  [key: string]: unknown;
};

type RankingsResponse = {
  seasonId?: string;
  weightClassId?: string;
  items?: any[];
  rules?: RankingRules;
};

const ruleLabels: Record<string, string> = {
  winPoints: 'Очки за победу',
  lossPoints: 'Очки за поражение',
  penaltyPoints: 'Вычет за штраф',
  technicalBonus: 'Бонус за техническую победу',
  pinBonus: 'Бонус за туше',
  headToHead: 'Личная встреча',
};

const methodLabels: Record<string, string> = {
  POINTS: 'Победа по очкам',
  TECHNICAL_SUPERIORITY: 'Техническая победа',
  PIN: 'Победа туше',
  FORFEIT: 'Неявка соперника',
  DISQUALIFICATION: 'Дисквалификация',
  INJURY: 'Травма',
};

const tieBreakerLabels: Record<string, string> = {
  points: 'очки',
  wins: 'победы',
  headToHead: 'личные встречи',
  techWins: 'технические победы',
  pins: 'туше',
  pointDiff: 'разница баллов',
};

function RankingRulesPanel({
  rules,
}: {
  rules: RankingRules;
}) {
  const numericRules = Object.entries(rules).filter(
    ([, value]) =>
      typeof value === 'number' ||
      typeof value === 'boolean'
  );

  const methodBonuses = Object.entries(
    rules.methodBonus ?? {}
  );

  return (
    <section className="kfl-rankings-rules">
      <div className="kfl-rankings-section-heading">
        <span className="kfl-rankings-kicker">
          <InfoCircleOutlined />
          RANKING SYSTEM
        </span>

        <h2>КАК РАБОТАЕТ РЕЙТИНГ</h2>

        <p>
          В расчёте учитываются завершённые схватки
          опубликованных турниров выбранного сезона
          и весовой категории. После подтверждения
          или исправления результата рейтинг
          пересчитывается.
        </p>
      </div>

      {numericRules.length > 0 && (
        <div className="kfl-rankings-rule-grid">
          {numericRules.map(([key, value]) => (
            <div
              className="kfl-rankings-rule-card"
              key={key}
            >
              <span>
                {ruleLabels[key] ?? key}
              </span>

              <strong>
                {typeof value === 'boolean'
                  ? value
                    ? 'Да'
                    : 'Нет'
                  : String(value)}
              </strong>
            </div>
          ))}
        </div>
      )}

      {methodBonuses.length > 0 && (
        <div className="kfl-rankings-bonuses">
          <h3>БОНУСЫ ЗА МЕТОД ПОБЕДЫ</h3>

          <div className="kfl-rankings-bonus-grid">
            {methodBonuses.map(([key, value]) => (
              <div
                className="kfl-rankings-bonus"
                key={key}
              >
                <span>
                  {methodLabels[key] ?? key}
                </span>

                <strong>
                  {value > 0 ? '+' : ''}
                  {value}
                </strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {Boolean(rules.tieBreakers?.length) && (
        <div className="kfl-rankings-tiebreakers">
          <h3>ПРИ РАВЕНСТВЕ ОЧКОВ</h3>

          <p>
            Порядок сравнения:
            {' '}
            {rules.tieBreakers
              ?.map(
                (key) =>
                  tieBreakerLabels[key] ?? key
              )
              .join(' → ')}
          </p>
        </div>
      )}

      <div className="kfl-rankings-note">
        <InfoCircleOutlined />

        <p>
          Изменение позиции рассчитывается
          относительно предыдущего события.
          Обозначение NEW означает отсутствие
          предыдущей позиции в рейтинге.
        </p>
      </div>
    </section>
  );
}

export default function Rankings() {
  useTitle('Официальный рейтинг KFL');

  const [seasonId, setSeasonId] =
    useState<string>();

  const [weightClassId, setWeightClassId] =
    useState<string>();

  const seasonsQuery = useQuery<OptionItem[]>({
    queryKey: ['seasons'],
    queryFn: () => get('/seasons'),
  });

  const weightClassesQuery = useQuery<OptionItem[]>({
    queryKey: ['wcs'],
    queryFn: () => get('/weight-classes'),
  });

  const rankingsQuery = useQuery<RankingsResponse>({
    queryKey: [
      'rankings',
      seasonId,
      weightClassId,
    ],
    queryFn: () =>
      get('/rankings', {
        seasonId,
        weightClassId,
      }),
  });

  const data = rankingsQuery.data;
  const rules = data?.rules;

  const selectedSeason =
    seasonsQuery.data?.find(
      (season) =>
        season.id === (seasonId ?? data?.seasonId)
    );

  const selectedWeight =
    weightClassesQuery.data?.find(
      (weight) =>
        weight.id ===
        (weightClassId ?? data?.weightClassId)
    );

  return (
    <main className="kfl-rankings-page">
      <header className="kfl-rankings-hero">
        <div className="kfl-rankings-container">
          <span className="kfl-rankings-kicker">
            <SafetyCertificateOutlined />
            OFFICIAL KFL RANKINGS
          </span>

          <h1>
            THE
            <br />
            <span>RANKINGS.</span>
          </h1>

          <p>
            Официальный рейтинг борцов
            Кыргызской лиги вольной борьбы.
            Каждая победа влияет на позицию.
          </p>

          <div className="kfl-rankings-hero-label">
            <TrophyOutlined />
            KYRGYZ FREESTYLE LEAGUE
          </div>
        </div>
      </header>

      <div className="kfl-rankings-container">
        <section className="kfl-rankings-main">
          <div className="kfl-rankings-toolbar">
            <div className="kfl-rankings-section-heading">
              <span className="kfl-rankings-kicker">
                <BarChartOutlined />
                OFFICIAL STANDINGS
              </span>

              <h2>РЕЙТИНГ БОРЦОВ</h2>

              <p>
                Выбери сезон и весовую категорию,
                чтобы посмотреть позиции участников.
              </p>
            </div>

            <div className="kfl-rankings-filters">
              <div className="kfl-rankings-filter">
                <label htmlFor="kfl-season-select">
                  <CalendarOutlined />
                  СЕЗОН
                </label>

                <Select
                  id="kfl-season-select"
                  aria-label="Сезон рейтинга"
                  placeholder="Выберите сезон"
                  value={
                    seasonId ?? data?.seasonId
                  }
                  onChange={setSeasonId}
                  loading={seasonsQuery.isLoading}
                  options={seasonsQuery.data?.map(
                    (season) => ({
                      value: season.id,
                      label: season.name,
                    })
                  )}
                />
              </div>

              <div className="kfl-rankings-filter">
                <label htmlFor="kfl-weight-select">
                  <TrophyOutlined />
                  ВЕСОВАЯ КАТЕГОРИЯ
                </label>

                <Select
                  id="kfl-weight-select"
                  aria-label="Весовая категория"
                  placeholder="Выберите вес"
                  value={
                    weightClassId ??
                    data?.weightClassId
                  }
                  onChange={setWeightClassId}
                  loading={
                    weightClassesQuery.isLoading
                  }
                  options={weightClassesQuery.data?.map(
                    (weight) => ({
                      value: weight.id,
                      label: weight.name,
                    })
                  )}
                />
              </div>
            </div>
          </div>

          <div className="kfl-rankings-board">
            <div className="kfl-rankings-board-header">
              <div>
                <span className="kfl-rankings-board-kicker">
                  KFL OFFICIAL RANKING
                </span>

                <h3>
                  {selectedWeight?.name ??
                    'РЕЙТИНГ ЛИГИ'}
                </h3>

                {selectedSeason && (
                  <p>{selectedSeason.name}</p>
                )}
              </div>

              <div className="kfl-rankings-board-count">
                <strong>
                  {data?.items?.length ?? '—'}
                </strong>

                <span>УЧАСТНИКОВ</span>
              </div>
            </div>

            <div className="kfl-rankings-board-body">
              <QueryState query={rankingsQuery}>
                <RankingRows
                  items={data?.items}
                />
              </QueryState>
            </div>
          </div>
        </section>

        {rules && (
          <RankingRulesPanel rules={rules} />
        )}
      </div>
    </main>
  );
}
