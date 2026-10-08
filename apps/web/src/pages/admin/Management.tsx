import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Alert, Button, Card, Dropdown, App, Form, Input, Modal, Popconfirm, Select, Space, Switch, Table, message } from 'antd';
import { api, get, errMsg } from '../../api/client';
import { fullName, fmt } from '../../components/ui';

import { Cover, QueryState, useDebounce } from '../../components/feedback';
import { useAdminSave } from './useAdminSave';
export function SeasonRoster() {
  const [seasonId, setSeasonId] = useState<string>();
  const [athleteId, setAthleteId] = useState<string>();
  const [search, setSearch] = useState('');
  const seasons = useQuery({ queryKey: ['a-seasons'], queryFn: () => get('/admin/seasons') });
  const wcs = useQuery({ queryKey: ['wcs'], queryFn: () => get('/weight-classes') });
  const roster = useQuery({ queryKey: ['roster', seasonId], queryFn: () => get(`/admin/seasons/${seasonId}/athletes`), enabled: !!seasonId });
  const athletes = useQuery({ queryKey: ['roster-search', search], queryFn: () => get('/admin/athletes', { status: 'ACTIVE', search, limit: 50 }) });
  const save = useAdminSave();
  const season = seasons.data?.find((s: any) => s.id === seasonId);
  return <Card className="season-roster" title="Состав сезона" style={{ marginTop: 20 }}>
    <Select aria-label="Состав сезона" placeholder="Выберите сезон" style={{ minWidth: 240 }} value={seasonId} onChange={v => { setSeasonId(v); setAthleteId(undefined); }}
      options={seasons.data?.map((s: any) => ({ value: s.id, label: s.name }))} />
    {season && <>
      <p>Весовые категории сезона</p>
      <Select mode="multiple" aria-label="Категории сезона" style={{ width: '100%' }} value={season.weightClasses.map((w: any) => w.weightClassId)}
        options={wcs.data?.map((w: any) => ({ value: w.id, label: w.name }))} disabled={save.isPending}
        onChange={ids => save.mutate({ method: 'patch', url: `/seasons/${seasonId}`, data: { weightClassIds: ids } })} />
      <Space wrap style={{ margin: '16px 0' }}>
        <Select aria-label="Спортсмен в состав" showSearch filterOption={false} onSearch={setSearch} placeholder="Найти спортсмена" style={{ width: 300 }} value={athleteId} onChange={setAthleteId}
          options={athletes.data?.items.filter((a: any) => !roster.data?.some((r: any) => r.athleteId === a.id)).map((a: any) => ({ value: a.id, label: `${fullName(a)} · ${a.weightClass.name}` }))} />
        <Button disabled={!athleteId} loading={save.isPending} onClick={() => save.mutate({ method: 'post', url: `/seasons/${seasonId}/athletes`, data: { athleteId } }, { onSuccess: () => setAthleteId(undefined) })}>Добавить в состав</Button>
      </Space>
      {roster.isError && <Alert type="error" message={errMsg(roster.error)} />}
      <Table scroll={{x:550}} rowKey="athleteId" dataSource={roster.data} columns={[
        { title: 'Спортсмен', render: (_: any, r: any) => fullName(r.athlete) },
        { title: 'Категория', render: (_: any, r: any) => r.athlete.weightClass.name },
        { title: 'Статус', render: (_: any, r: any) => r.athlete.isArchived ? 'ARCHIVED' : r.athlete.status },
        { title: '', render: (_: any, r: any) => <Popconfirm title="Убрать из состава? История результатов сохранится." onConfirm={() => save.mutate({ method: 'delete', url: `/seasons/${seasonId}/athletes/${r.athleteId}` })}><Button danger>Убрать</Button></Popconfirm> },
      ]} />
    </>}
  </Card>;
}

export function AthleteHistory({ id, onClose }: { id?: string; onClose: () => void }) {
  const q = useQuery({ queryKey: ['a-athlete-history', id], queryFn: () => get(`/admin/athletes/${id}`), enabled: !!id });
  return <Modal title={q.data ? fullName(q.data) : 'История спортсмена'} open={!!id} onCancel={onClose} footer={null} width={850}>
    {q.isError && <Alert type="error" message={errMsg(q.error)} />}
    <Table scroll={{x:650}} rowKey="id" loading={q.isLoading} dataSource={q.data?.matches} columns={[
      { title: 'Дата', render: (_: any, m: any) => fmt(m.scheduledAt) },
      { title: 'Матч', render: (_: any, m: any) => `${fullName(m.athleteA)} / ${fullName(m.athleteB)}` },
      { title: 'Категория', render: (_: any, m: any) => m.weightClass.name },
      { title: 'Статус', dataIndex: 'status' },
      { title: 'Результат', render: (_: any, m: any) => m.status === 'COMPLETED' ? `${m.winnerId === id ? 'W' : 'L'} ${m.scoreA}:${m.scoreB}` : '—' },
    ]} />
  </Modal>;
}

