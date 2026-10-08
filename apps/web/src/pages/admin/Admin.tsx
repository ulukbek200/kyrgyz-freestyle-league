import { FormSelect as Select } from '../../components/FormSelect';
import { lazy, Suspense, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App as AntApp, Button, Card, DatePicker, Form, Input, InputNumber, Layout, Menu, Modal, Drawer, Dropdown, Alert, Popconfirm, Space, Table, Tag, Upload, message } from 'antd';
import { api, errMsg, get } from '../../api/client';
import { useAuth } from '../../store/auth';
import { fmt, fullName } from '../../components/ui';
import { SeasonRoster, AthleteHistory } from './Management';
import dayjs from 'dayjs';
import { QueryState, QueryError } from '../../components/feedback';
import { useAdminSave as useSave } from './useAdminSave';
const MediaAdmin=lazy(()=>import('./MediaAdmin'));
const MatchesAdmin=lazy(()=>import('./MatchesAdmin'));
import { Loading } from '../../components/ui';
import { EventsAdmin, ApplicationsAdmin, Directory, Settings } from './Operations';
import KFLAdminDashboard from './KFLAdminDashboard';

const METHODS = ['POINTS', 'TECHNICAL_SUPERIORITY', 'PIN', 'FORFEIT', 'DISQUALIFICATION', 'INJURY'];
const opt = (a: string[]) => a.map((v) => ({ value: v, label: v }));

function ImageField({ value, onChange, id }: { value?: string; onChange?: (v: string) => void; id?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <Space>
      {value && <img src={value} alt="" style={{ width: 56, height: 70, objectFit: 'cover' }} />}
      <Upload showUploadList={false} accept="image/jpeg,image/png,image/webp" customRequest={async ({ file }: any) => {
        setBusy(true);
        try { const fd = new FormData(); fd.append('file', file); onChange?.((await api.post('/admin/upload', fd)).data.url); }
        catch (e) { message.error(errMsg(e)); }
        setBusy(false);
      }}><Button id={id} loading={busy}>Загрузить фото</Button></Upload>
      {value && <Button type="link" onClick={() => onChange?.('')}>убрать</Button>}
    </Space>
  );
}

function PhotoCell({ a, save }: { a: any; save: any }) {
  return <ImageField value={a.photoUrl} onChange={(url) => save.mutate({ method: 'patch', url: `/athletes/${a.id}`, data: { photoUrl: url } })} />;
}

function LegacyDashboard() {
  const q = useQuery({ queryKey: ['a-stats'], queryFn: () => get('/admin/stats') }); const data=q.data;
  if (!data) return <QueryState query={q}>{null}</QueryState>;
  const cards: [string, any][] = [['Спортсмены', data.athletes], ['Матчи', data.matches], ['Скоро', data.upcoming], ['Завершено', data.completed],
    ['Заявки (new)', data.applications], ['Чемпионы', data.champions], ['Материалы', data.media]];
  return (
    <>
      <div className="admin-toolbar"><Link className="btn" to="/admin/athletes?create=1">Добавить спортсмена</Link><Link className="btn ghost dark" to="/admin/events">Создать событие</Link><Link className="btn ghost dark" to="/admin/matches?create=1">Создать матч</Link><Link className="btn ghost dark" to="/admin/media">Создать материал</Link></div><div className="card" style={{marginBottom:24}}><span className="eyebrow">БЛИЖАЙШЕЕ СОБЫТИЕ</span><h3>{data.nextEvent?.name ?? 'Не запланировано'}</h3>{data.nextEvent && <p>{fmt(data.nextEvent.date)} · {data.nextEvent.isPublished ? 'Опубликовано' : 'Черновик'}</p>}</div><h2>Сезон: {data.season?.name ?? '—'}</h2>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))' }}>
        {cards.map(([l, v]) => <Card key={l}><div className="muted">{l}</div><b className="display" style={{ fontSize: 40 }}>{v}</b></Card>)}
      </div>
      <h3 style={{ margin: '24px 0 8px' }}>Последние действия</h3>
      {data.activity.map((a: any) => <div key={a.id} className="muted">{fmt(a.createdAt)} · {a.user?.name ?? 'system'} · {a.action}</div>)}
    </>
  );
}

const Dashboard = KFLAdminDashboard;

function AthletesAdmin() {
  const [params]=useSearchParams();
  const {modal}=AntApp.useApp();
  const [open, setOpen] = useState(params.get('create')==='1');
  const [filter, setFilter] = useState<any>({});
  const [page, setPage] = useState(1);
  const [historyId, setHistoryId] = useState<string>(params.get('athleteId') ?? undefined);
  const [editing, setEditing] = useState<any>();
  const query = useQuery({ queryKey: ['a-athletes', filter, page], queryFn: () => get('/admin/athletes', { ...filter, page, limit: 20 }) }); const data=query.data;
  const wcs = useQuery({ queryKey: ['wcs'], queryFn: () => get('/weight-classes') });
  const clubs = useQuery({ queryKey: ['clubs'], queryFn: () => get('/clubs') });
  const save = useSave(['a-athletes', 'a-stats', 'athletes']);
  const [form] = Form.useForm();
  return (
    <>
      <Space wrap style={{ marginBottom: 12 }}><Button type="primary" onClick={() => { setEditing(undefined); form.resetFields(); setOpen(true); }}>Добавить спортсмена</Button>
        <Input.Search aria-label="Поиск спортсмена" placeholder="Поиск спортсмена" allowClear onSearch={search => { setFilter({ ...filter, search }); setPage(1); }} />
        <Select aria-label="Статус спортсменов" placeholder="Все статусы" allowClear style={{ width: 160 }} options={opt(['ACTIVE', 'PENDING', 'INACTIVE', 'SUSPENDED', 'RETIRED', 'ARCHIVED'])} onChange={status => { setFilter({ ...filter, status }); setPage(1); }} />
        <Select aria-label="Категория спортсменов" placeholder="Все категории" allowClear style={{ width: 160 }} options={wcs.data?.map((w: any) => ({ value: w.id, label: w.name }))} onChange={weightClassId => { setFilter({ ...filter, weightClassId }); setPage(1); }} />
      </Space>
      <AthleteHistory id={historyId} onClose={() => setHistoryId(undefined)} />
      {query.isError&&<QueryError error={query.error} retry={query.refetch}/>}<Table loading={query.isLoading} rowKey="id" size="small" dataSource={data?.items} pagination={{ current: page, pageSize: 20, total: data?.total, showSizeChanger: false, onChange: setPage }} scroll={{ x: 640 }} columns={[
        { title: 'Имя', render: (_: any, a: any) => <Button type="link" onClick={() => setHistoryId(a.id)}>{fullName(a)}{a.isArchived ? ' (архив)' : ''}</Button> },
        { title: 'Вес', render: (_: any, a: any) => a.weightClass.name }, { title: 'Город', dataIndex: 'city' },
        { title: 'Клуб', render: (_: any, a: any) => a.club?.name }, { title: 'Статус', dataIndex: 'status', render: (s: string, a: any) => (
          <Select aria-label={"Статус: "+fullName(a)} size="small" value={s} style={{ width: 120 }} options={opt(['PENDING', 'ACTIVE', 'INACTIVE', 'SUSPENDED', 'RETIRED'])} onChange={(v) => save.mutate({ method: 'patch', url: `/athletes/${a.id}`, data: { status: v } })} />) },

        {title:'Действия',render:(_:any,a:any)=><Dropdown trigger={['click']} menu={{items:[{key:'edit',label:'Изменить'},{key:'history',label:'История'},{key:'archive',label:a.isArchived?'Восстановить':'Архивировать',danger:!a.isArchived}],onClick:({key})=>{if(key==='edit'){setEditing(a);form.resetFields();form.setFieldsValue(a);setOpen(true);}if(key==='history')setHistoryId(a.id);if(key==='archive')modal.confirm({title:a.isArchived?'Восстановить спортсмена?':'Архивировать спортсмена?',content:'История матчей будет сохранена.',onOk:()=>save.mutate({method:a.isArchived?'post':'delete',url:'/athletes/'+a.id+(a.isArchived?'/restore':'')})});}}}><Button aria-label={'Действия: '+fullName(a)}>•••</Button></Dropdown>},
      ]} />
      <Modal title={editing ? 'Изменить спортсмена' : 'Новый спортсмен'} open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} confirmLoading={save.isPending}>
        <Form disabled={save.isPending} form={form} layout="vertical" onFinish={(v) => save.mutate({ method: editing ? 'patch' : 'post', url: editing ? `/athletes/${editing.id}` : '/athletes', data: v }, { onSuccess: () => { setOpen(false); form.resetFields(); } })}>
          <Form.Item name="firstName" label="Имя" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="lastName" label="Фамилия" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="nickname" label="Никнейм"><Input /></Form.Item>
          <Form.Item name="country" label="Страна"><Input /></Form.Item><Form.Item name="city" label="Город"><Input /></Form.Item><Form.Item name="bio" label="Биография"><Input.TextArea rows={4}/></Form.Item>
          <Form.Item name="weightClassId" label="Вес" rules={[{ required: true }]}><Select options={wcs.data?.map((w: any) => ({ value: w.id, label: w.name }))} /></Form.Item>
          <Form.Item name="clubId" label="Клуб"><Select allowClear options={clubs.data?.map((c: any) => ({ value: c.id, label: c.name }))} /></Form.Item>
          <Form.Item name="photoUrl" label="Фото"><ImageField /></Form.Item>
        </Form>
      </Modal>
    </>
  );
}

function SeasonsAdmin() {
  const seasons = useQuery({ queryKey: ['a-seasons'], queryFn: () => get('/admin/seasons') });
  const events = useQuery({ queryKey: ['a-events'], queryFn: () => get('/admin/events') });
  const wcs = useQuery({ queryKey: ['wcs'], queryFn: () => get('/weight-classes') });
  const save = useSave(['seasons', 'a-events', 'wcs', 'a-stats']);
  const [sf] = Form.useForm(); const [ef] = Form.useForm(); const [wf] = Form.useForm();
  const ok = (f: any) => ({ onSuccess: () => f.resetFields() });
  return (
    <>{seasons.isError&&<QueryError error={seasons.error} retry={seasons.refetch}/ >}{wcs.isError&&<QueryError error={wcs.error} retry={wcs.refetch}/>}<div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', alignItems: 'start' }}>
      <Card title="Сезоны">
        {seasons.data?.map((s: any) => <div key={s.id} style={{ marginBottom: 6 }}>{s.name} <Tag>{s.status}</Tag>
          {s.status !== 'ACTIVE' && <Button size="small" onClick={() => save.mutate({ method: 'patch', url: `/seasons/${s.id}`, data: { status: 'ACTIVE' } })}>Активировать</Button>}</div>)}
        <Form name="season-create" form={sf} layout="vertical" onFinish={(v) => save.mutate({ method: 'post', url: '/seasons', data: { ...v, startDate: v.startDate.toISOString() } }, ok(sf))}>
          <Form.Item name="name" label="Название" rules={[{ required: true }]}><Input placeholder="Season 2" /></Form.Item>
          <Form.Item name="weightClassIds" label="Весовые категории"><Select mode="multiple" options={wcs.data?.map((w:any)=>({value:w.id,label:w.name}))}/></Form.Item><Form.Item name="startDate" label="Начало" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Button htmlType="submit" loading={save.isPending}>Создать сезон</Button>
        </Form>
      </Card>
      <Card title="Весовые категории">
        {wcs.data?.map((w: any) => <div key={w.id}>{w.name}</div>)}
        <Form name="weight-create" form={wf} layout="vertical" style={{ marginTop: 12 }} onFinish={(v) => save.mutate({ method: 'post', url: '/weight-classes', data: v }, ok(wf))}>
          <Form.Item name="name" label="Название" rules={[{ required: true }]}><Input placeholder="97 кг" /></Form.Item>
          <Form.Item name="maxKg" label="Макс. вес" rules={[{ required: true }]}><InputNumber min={30} style={{ width: '100%' }} /></Form.Item>
          <Button htmlType="submit" loading={save.isPending}>Добавить</Button>
        </Form>
      </Card>
    </div><SeasonRoster /></>
  );
}

function Recalc() {
  const seasons = useQuery({ queryKey: ['seasons'], queryFn: () => get('/seasons') });
  const save = useSave(['a-stats']);
  return (
    <Card title="Пересчёт рейтинга">
      <p className="muted">Рейтинг — производная от результатов матчей. Пересчитайте после смены формулы.</p>
      {seasons.data?.map((s: any) => <Button key={s.id} style={{ marginRight: 8 }} onClick={() => save.mutate({ method: 'post', url: '/rankings/recalculate', data: { seasonId: s.id } })}>{s.name}</Button>)}
    </Card>
  );
}



const ITEMS=[['/admin','Обзор'],['/admin/seasons','Сезоны'],['/admin/athletes','Спортсмены'],['/admin/applications','Заявки'],['/admin/events','События'],['/admin/matches','Матчи'],['/admin/rankings','Рейтинги'],['/admin/champions','Чемпионы'],['/admin/media','Медиа'],['/admin/clubs','Клубы'],['/admin/coaches','Тренеры'],['/admin/users','Пользователи'],['/admin/settings','Настройки']];
export default function Admin(){
 const {token,logout}=useAuth();const loc=useLocation();const nav=useNavigate();const [open,setOpen]=useState(false);
 const me=useQuery({queryKey:['admin-me',token],queryFn:()=>get('/auth/me'),enabled:!!token,staleTime:0});
 if(!token)return <Navigate to="/admin/login" replace/>;
 if(me.isLoading)return <QueryState query={me}>{null}</QueryState>;
 if(me.isError)return <QueryError error={me.error} retry={me.refetch}/>;
 if(me.data?.role!=='ADMIN')return <QueryError error={{response:{status:403}}}/>;
 const menu=<Menu theme="dark" mode="inline" selectedKeys={[loc.pathname]} items={[{key:'league',type:'group',label:'ЛИГА',children:ITEMS.slice(0,9).map(([key,label])=>({key,label}))},{key:'directory',type:'group',label:'УПРАВЛЕНИЕ',children:ITEMS.slice(9).map(([key,label])=>({key,label}))}]} onClick={({key})=>{nav(key);setOpen(false);}}/>;
 return <AntApp><div className="admin-shell"><aside className="admin-sidebar"><Link to="/" className="logo"><i/>KFL / ADMIN</Link>{menu}</aside><div className="admin-workspace"><header className="admin-header"><Button className="admin-mobile-menu" aria-label="Меню администрации" onClick={()=>setOpen(true)}>☰</Button><h1 className="admin-title">{ITEMS.find(([k])=>k===loc.pathname)?.[1] ?? 'Администрация'}</h1><Button onClick={()=>{logout();nav('/admin/login');}}>Выйти</Button></header><main className="admin-main"><Suspense fallback={<Loading/>}><Routes><Route index element={<Dashboard/>}/><Route path="matches" element={<MatchesAdmin/>}/><Route path="athletes" element={<AthletesAdmin/>}/><Route path="applications" element={<ApplicationsAdmin/>}/><Route path="seasons" element={<SeasonsAdmin/>}/><Route path="events" element={<EventsAdmin/>}/><Route path="rankings" element={<Recalc/>}/><Route path="media" element={<MediaAdmin/>}/><Route path="champions" element={<Directory kind="champions"/>}/><Route path="clubs" element={<Directory kind="clubs"/>}/><Route path="coaches" element={<Directory kind="coaches"/>}/><Route path="users" element={<Directory kind="users"/>}/><Route path="settings" element={<Settings/>}/><Route path="*" element={<QueryError error={{response:{status:404}}}/>}/></Routes></Suspense></main></div><Drawer title="KFL / ADMIN" open={open} onClose={()=>setOpen(false)} width="min(300px, 90vw)" styles={{body:{background:'var(--ink)',padding:0}}}>{menu}</Drawer></div></AntApp>;
}
