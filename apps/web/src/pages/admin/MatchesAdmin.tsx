
import { useState } from 'react';

import {
  Button,
  Collapse,
  Form,
  Input,
  InputNumber,
  Modal,
  Pagination,
  Select,
  Switch,
  Table,
  Tag,
} from 'antd';

import { Link } from 'react-router-dom';

import {
  LayoutGrid,
  List,
  Pencil,
  RotateCcw,
  Swords,
} from 'lucide-react';

import {
  dateInput,
  formatDate,
  fullName,
  toISO,
  useAdminQuery,
  type Row,
} from './api';

import {
  AddButton,
  DataState,
  FormDialog,
  PageTitle,
  Status,
  required,
  statusOptions,
} from './components';

import { useEditor } from './Management';
import { useAdminSave } from './useAdminSave';

import FightCardView from './FightCardView';
import SimpleMatchWizard from './SimpleMatchWizard';

export default function MatchesAdmin({eventId}:{eventId:string}) {

  const [status, setStatus] = useState<
    string | undefined
  >(undefined);

  const [page, setPage] = useState(1);

  const [view, setView] = useState<
    'table' | 'cards'
  >('table');

  const [wizardOpen, setWizardOpen] = useState(false);


  const query = useAdminQuery<{
    data: Row[];
    total: number;
  }>(
    'matches',
    `/admin/matches?page=${page}` +
      (eventId
        ? `&eventId=${encodeURIComponent(eventId)}`
        : '') +
      (status
        ? `&status=${encodeURIComponent(status)}`
        : '')
  );

  const eventQuery=useAdminQuery<Row>('event',`/admin/events/${eventId}`);
  const participantQuery=useAdminQuery('participants',`/admin/events/${eventId}/participants`);
  const event=eventQuery.data;

  const editor = useEditor({
    isTitleFight: false,
    status: 'UPCOMING',
    eventId: eventId || undefined,
  });

  const { save, pending } = useAdminSave();

  const [resultMatch, setResultMatch] =
    useState<Row | null>(null);

  const [resultForm] = Form.useForm();

  const chosenWeight = Form.useWatch(
    'weightClassId',
    editor.form
  );

  const red = Form.useWatch(
    'athleteAId',
    editor.form
  );

  const matches = query.data?.data ?? [];

  const total = query.data?.total ?? 0;

  const candidates=participantQuery.data?.filter(p=>p.weightClassId===chosenWeight&&p.status==='ACTIVE'&&p.athlete.status==='ACTIVE').map(p=>p.athlete)??[];

  // Открытие мастера создания схватки.
  const openWizard = () => {
    setWizardOpen(true);
  };

  // Редактирование существующей схватки.
  const openEdit = (match: Row) => {
    editor.show({
      ...match,
      scheduledAt: dateInput(match.scheduledAt),
    });
  };

  // Открытие формы результата.
  const openResult = (match: Row) => {
    resultForm.resetFields();

    resultForm.setFieldsValue({
      ...match.score,
      winnerId: match.winnerId || undefined,
      method: match.method || 'DECISION',
      summary: match.summary || '',
      athleteAPoints:
        match.score?.athleteAPoints ?? 0,
      athleteBPoints:
        match.score?.athleteBPoints ?? 0,
    });

    setResultMatch(match);
  };

  // Отмена результата с подтверждением.
  const cancelMatchResult = (match: Row) => {
    let reason='';
    Modal.confirm({
      title: 'Отменить результат?',
      content:<><p>Рейтинг и история чемпионства будут пересчитаны.</p><Input.TextArea aria-label="Причина отмены результата" placeholder="Причина отмены (обязательно для группового турнира)" onChange={e=>{reason=e.target.value;}}/></>,
      okText: 'Отменить результат',
      okType: 'danger',
      cancelText: 'Назад',

      onOk: async () => {
        const success = await save(
          `/admin/matches/${match.id}/result`,
          {reason},
          'DELETE',
          'Результат отменён'
        );

        if (!success) {
          return Promise.reject(
            new Error('Не удалось отменить результат')
          );
        }
      },
    });
  };

  // Сохранение изменений схватки.
  const saveMatch = async (
    values: Record<string, any>
  ) => {
    if (!editor.editing) return;

    const success = await save(
      `/admin/matches/${editor.editing.id}`,
      {
        ...values,eventId,ageDivision:event?.ageDivision,
        scheduledAt: toISO(values.scheduledAt),
      },
      'PATCH'
    );

    if (success) {
      editor.close();
    }
  };

  // Сохранение результата.
  const saveResult = async (
    values: Record<string, any>
  ) => {
    if (!resultMatch) return;

    const success = await save(
      `/admin/matches/${resultMatch.id}/result`,
      values,
      'POST',
      'Результат сохранён. Рейтинг обновлён.'
    );

    if (success) {
      setResultMatch(null);
    }
  };

  return (
    <>
      {/* ЗАГОЛОВОК И СОЗДАНИЕ СХВАТКИ */}

      <PageTitle
        title="Схватки"
        eyebrow="MATCH CONTROL CENTER"
        description="Создавайте пары спортсменов, управляйте соревнованиями и фиксируйте результаты."
        action={
          <AddButton onClick={openWizard}>
            Создать схватку
          </AddButton>
        }
      />

      {/* ФИЛЬТРЫ */}

      <div className="kfl-filters">
        <Select
          aria-label="Статус схватки"
          placeholder="Все статусы"
          allowClear
          value={status}
          onChange={value => {
            setStatus(value);
            setPage(1);
          }}
          options={statusOptions([
            'UPCOMING',
            'LIVE',
            'COMPLETED',
            'CANCELLED',
          ])}
        />

        <span className="kfl-filter-count">
          {total} схваток
        </span>
      </div>

      {/* ПЕРЕКЛЮЧЕНИЕ ТАБЛИЦА / FIGHT CARD */}

      <div className="kfl-view-switch">
        <Button
          type={
            view === 'table'
              ? 'primary'
              : 'default'
          }
          icon={<List size={16} />}
          onClick={() => setView('table')}
        >
          Таблица
        </Button>

        <Button
          type={
            view === 'cards'
              ? 'primary'
              : 'default'
          }
          icon={<LayoutGrid size={16} />}
          onClick={() => setView('cards')}
        >
          Fight Card
        </Button>
      </div>

      {/* СПИСОК СХВАТОК */}

      <DataState query={query}>
        {view === 'table' ? (
          <div className="kfl-table">
            <Table<Row>
              rowKey="id"
              dataSource={matches}
              scroll={{ x: 1150 }}
              pagination={{
                current: page,
                pageSize: 20,
                total,
                showSizeChanger: false,
                onChange: setPage,
              }}
              columns={[
                {
                  title: 'Турнир / дата',
                  width: 210,
                  render: (_, match) => (
                    <div>
                      <strong>
                        {match.event?.name ||
                          'Без соревнования'}
                      </strong>

                      <small className="kfl-cell-sub">
                        {formatDate(
                          match.scheduledAt
                        )}
                      </small>

                      {match.isTitleFight && (
                        <Tag color="gold">
                          ТИТУЛЬНАЯ
                        </Tag>
                      )}
                    </div>
                  ),
                },

                {
                  title: 'Категория',
                  width: 120,
                  render: (_, match) =>
                    match.weightClass?.name ||
                    '—',
                },

                {
                  title: 'Красный угол',
                  width: 180,
                  render: (_, match) => (
                    <span className="kfl-corner red">
                      {fullName(match.athleteA)}
                    </span>
                  ),
                },

                {
                  title: 'Счёт',
                  width: 80,
                  align: 'center',
                  render: (_, match) => (
                    <strong className="kfl-score">
                      {match.score
                        ? `${match.score.athleteAPoints} : ${match.score.athleteBPoints}`
                        : 'VS'}
                    </strong>
                  ),
                },

                {
                  title: 'Синий угол',
                  width: 180,
                  render: (_, match) => (
                    <span className="kfl-corner blue">
                      {fullName(match.athleteB)}
                    </span>
                  ),
                },

                {
                  title: 'Статус / результат',
                  width: 210,
                  render: (_, match) => (
                    <div>
                      <Status
                        value={match.status}
                      />

                      {match.winner && (
                        <small className="kfl-cell-sub">
                          Победа:{' '}
                          {fullName(
                            match.winner
                          )}
                          {match.method && (
                            <>
                              {' · '}
                              <Status
                                value={
                                  match.method
                                }
                              />
                            </>
                          )}
                        </small>
                      )}
                    </div>
                  ),
                },

                {
                  title: 'Управление',
                  width: 220,
                  fixed: 'right',
                  render: (_, match) => (
                    <div className="kfl-match-actions">
                      {match.status !==
                        'CANCELLED' && (
                        <Button
                          size="small"
                          type={
                            match.status ===
                            'COMPLETED'
                              ? 'default'
                              : 'primary'
                          }
                          icon={
                            <Swords
                              size={14}
                            />
                          }
                          disabled={pending}
                          onClick={() =>
                            openResult(match)
                          }
                        >
                          {match.status ===
                          'COMPLETED'
                            ? 'Исправить результат'
                            : 'Ввести результат'}
                        </Button>
                      )}

                      {match.status !==
                        'COMPLETED' && (
                        <Button
                          size="small"
                          icon={
                            <Pencil
                              size={13}
                            />
                          }
                          disabled={pending}
                          onClick={() =>
                            openEdit(match)
                          }
                        >
                          Редактировать пару
                        </Button>
                      )}

                      {match.status ===
                        'COMPLETED' && (
                        <Button
                          size="small"
                          danger
                          icon={
                            <RotateCcw
                              size={13}
                            />
                          }
                          disabled={pending}
                          onClick={() =>
                            cancelMatchResult(
                              match
                            )
                          }
                        >
                          Отменить результат
                        </Button>
                      )}

                      <Link
                        to={`/matches/${match.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        На сайте ↗
                      </Link>
                    </div>
                  ),
                },
              ]}
            />
          </div>
        ) : (
          <>
            <FightCardView
              matches={matches}
              onEdit={openEdit}
              onResult={openResult}
              onCancelResult={
                cancelMatchResult
              }
              pending={pending}
            />

            {total > 20 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  marginTop: 24,
                }}
              >
                <Pagination
                  current={page}
                  pageSize={20}
                  total={total}
                  showSizeChanger={false}
                  onChange={setPage}
                />
              </div>
            )}
          </>
        )}
      </DataState>

      {/* РЕДАКТИРОВАНИЕ СХВАТКИ */}

      <FormDialog
        {...editor}
        onClose={editor.close}
        pending={pending}
        title="Редактировать схватку"
        onFinish={saveMatch}
      >
        <DataState query={participantQuery}>
          <Form.Item
            name="weightClassId"
            label="Весовая категория"
            rules={required}
          >
            <Select
              showSearch
              optionFilterProp="label"
              onChange={() =>
                editor.form.setFieldsValue({
                  athleteAId: undefined,
                  athleteBId: undefined,
                })
              }
              options={event?.weightClasses.map((w:Row)=>({value:w.weightClassId,label:w.weightClass.name}))}
            />
          </Form.Item>

          <Form.Item
            name="scheduledAt"
            label="Дата и время"
            rules={required}
          >
            <Input type="datetime-local" />
          </Form.Item>

          <Form.Item
            name="athleteAId"
            label="Красный угол"
            rules={required}
          >
            <Select
              showSearch
              optionFilterProp="label"
              disabled={!chosenWeight}
              onChange={() =>
                editor.form.setFieldValue(
                  'athleteBId',
                  undefined
                )
              }
              options={candidates.map(
                athlete => ({
                  value: athlete.id,
                  label: fullName(athlete),
                })
              )}
            />
          </Form.Item>

          <Form.Item
            name="athleteBId"
            label="Синий угол"
            dependencies={['athleteAId']}
            rules={[
              ...required,
              ({ getFieldValue }) => ({
                validator: (_, value) =>
                  !value ||
                  value !==
                    getFieldValue(
                      'athleteAId'
                    )
                    ? Promise.resolve()
                    : Promise.reject(
                        new Error(
                          'Выберите другого спортсмена'
                        )
                      ),
              }),
            ]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              disabled={!chosenWeight}
              options={candidates
                .filter(
                  athlete =>
                    athlete.id !== red
                )
                .map(athlete => ({
                  value: athlete.id,
                  label: fullName(athlete),
                }))}
            />
          </Form.Item>

          <Form.Item
            name="isTitleFight"
            label="Схватка за чемпионский титул"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          {editor.editing && (
            <Form.Item
              name="status"
              label="Статус"
              rules={required}
            >
              <Select
                options={statusOptions([
                  'UPCOMING',
                  'LIVE',
                  'CANCELLED',
                ])}
              />
            </Form.Item>
          )}

          <p className="kfl-form-note wide">
            Выберите двух разных активных
            спортсменов одной весовой
            категории. Результаты
            завершённых схваток изменяются
            отдельно.
          </p>
        </DataState>
      </FormDialog>

      {/* ВВОД РЕЗУЛЬТАТА */}

      <FormDialog
        title={
          resultMatch?.status ===
          'COMPLETED'
            ? 'Исправить результат'
            : 'Результат схватки'
        }
        open={!!resultMatch}
        onClose={() =>
          setResultMatch(null)
        }
        pending={pending}
        form={resultForm}
        onFinish={saveResult}
      >
        {resultMatch && (
          <>
            <div className="kfl-result-pair wide">
              <div>
                <span>
                  КРАСНЫЙ УГОЛ
                </span>

                <strong>
                  {fullName(
                    resultMatch.athleteA
                  )}
                </strong>
              </div>

              <b>VS</b>

              <div>
                <span>
                  СИНИЙ УГОЛ
                </span>

                <strong>
                  {fullName(
                    resultMatch.athleteB
                  )}
                </strong>
              </div>
            </div>

            <Form.Item
              name="athleteAPoints"
              label="Баллы красного"
              rules={required}
            >
              <InputNumber
                min={0}
                precision={0}
              />
            </Form.Item>

            <Form.Item
              name="athleteBPoints"
              label="Баллы синего"
              rules={required}
            >
              <InputNumber
                min={0}
                precision={0}
              />
            </Form.Item>

            <Form.Item
              name="winnerId"
              label="Победитель"
              rules={required}
            >
              <Select
                showSearch
                optionFilterProp="label"
                options={[
                  resultMatch.athleteA,
                  resultMatch.athleteB,
                ].map(athlete => ({
                  value: athlete.id,
                  label: fullName(athlete),
                }))}
              />
            </Form.Item>

            <Form.Item
              name="method"
              label="Метод победы"
              rules={required}
            >
              <Select
                options={statusOptions([
                  'DECISION',
                  'TECHNICAL_FALL',
                  'PIN',
                  'FORFEIT',
                ])}
              />
            </Form.Item>

              <Form.Item name="correctionReason" label="Причина исправления" className="wide"><Input.TextArea placeholder="Обязательно при изменении результата группового турнира"/></Form.Item>
              <div className="wide">
                <Collapse
                ghost
                items={[
                  {
                    key: 'detail',
                    label:
                      'Периоды, штрафы и дополнительные баллы',
                    children: (
                      <div className="kfl-form-grid">
                        {[
                          [
                            'periodOneA',
                            'Первый период · красный',
                          ],
                          [
                            'periodOneB',
                            'Первый период · синий',
                          ],
                          [
                            'periodTwoA',
                            'Второй период · красный',
                          ],
                          [
                            'periodTwoB',
                            'Второй период · синий',
                          ],
                          [
                            'penaltiesA',
                            'Штрафы красного',
                          ],
                          [
                            'penaltiesB',
                            'Штрафы синего',
                          ],
                          [
                            'bonus',
                            'Дополнительные баллы победителю',
                          ],
                        ].map(
                          ([name, label]) => (
                            <Form.Item
                              key={name}
                              name={name}
                              label={label}
                              initialValue={0}
                            >
                              <InputNumber
                                min={0}
                                precision={0}
                              />
                            </Form.Item>
                          )
                        )}
                      </div>
                    ),
                  },
                ]}
              />
            </div>

            <Form.Item
              name="summary"
              label="Комментарий к результату"
              className="wide"
            >
              <Input.TextArea rows={2} />
            </Form.Item>

            <p className="kfl-form-note wide">
              Сохранение обновит рейтинг
              спортсменов и историю
              чемпионства для титульных
              схваток.
            </p>
          </>
        )}
      </FormDialog>

      {/* ПОШАГОВОЕ СОЗДАНИЕ СХВАТКИ */}

      <SimpleMatchWizard
        open={wizardOpen}
        onClose={() =>
          setWizardOpen(false)
        }
        eventId={eventId}
        onCreated={() => {
          setPage(1);
        }}
      />
    </>
  );
}
