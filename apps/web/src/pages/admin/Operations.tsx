import {divisionOptions,useDivisions,useAgeReference} from './DivisionFields';
import {useEffect,useState} from 'react';
import {Alert,Button,Descriptions,Drawer,Form,Input,InputNumber,Popconfirm,Select,Table,Tag} from 'antd';
import {Link} from 'react-router-dom';
import {RotateCcw,Search,Shield} from 'lucide-react';
import {formatDate,fullName,useAdminQuery,useLookups,type Row} from './api';
import {AddButton,DataState,FormDialog,PageTitle,Person,Status,TextField,required,statusOptions} from './components';
import {useEditor} from './Management';
import {useAdminSave} from './useAdminSave';

export function ApplicationsAdmin(){
 const [division,setDivision]=useState<string>(),reference=useAgeReference();
  const query=useAdminQuery('applications','/admin/applications'),[status,setStatus]=useState<string>(),[search,setSearch]=useState(''),[selectedId,setSelectedId]=useState<string>(),[notes,setNotes]=useState(''),{save,pending}=useAdminSave();
  const selected=query.data?.find(a=>a.id===selectedId),rows=query.data?.filter(a=>(!division||a.ageDivision===division)&&(!status||a.status===status)&&`${a.firstName} ${a.lastName} ${a.email}`.toLowerCase().includes(search.toLowerCase()));
  const update=(a:Row,next:string)=>save(`/admin/applications/${a.id}`,{status:next,adminNotes:notes},'PATCH',next==='APPROVED'?'Заявка одобрена. Спортсмен добавлен в состав.':'Заявка обновлена');
  return <><PageTitle title="Заявки" eyebrow="НОВЫЕ ИМЕНА ЛИГИ" description="Рассмотрите анкету и откройте спортсмену путь на ковёр."/>
    <div className="kfl-filters"><Input prefix={<Search size={16}/>} aria-label="Поиск заявки" placeholder="Имя или email" value={search} onChange={e=>setSearch(e.target.value)}/><Select aria-label="Дивизион заявки" placeholder="Все дивизионы" allowClear value={division} onChange={setDivision} options={divisionOptions}/><Select aria-label="Статус заявки" placeholder="Все статусы" allowClear value={status} onChange={setStatus} options={statusOptions(['PENDING','REVIEW','APPROVED','REJECTED'])}/></div>
    <DataState query={query}><div className="kfl-table"><Table<Row> rowKey="id" dataSource={rows} scroll={{x:850}} columns={[
      {title:'Спортсмен',render:(_,a)=><Person athlete={a}/>},{title:'Контакты',render:(_,a)=><div>{a.email}<small className="kfl-cell-sub">{a.phone}</small></div>},{title:'Дивизион / возраст',render:(_,a)=><span><Tag>{a.ageDivision||'Уточнить'}</Tag>{reference.data?reference.data.year-new Date(a.birthDate).getUTCFullYear():'—'} лет</span>},{title:'Вес',render:(_,a)=>a.weightClass?.name||`${a.weightKg} кг`},
      {title:'Дата',dataIndex:'createdAt',render:formatDate},{title:'Статус',render:(_,a)=><Status value={a.status}/>},{title:'Действие',render:(_,a)=><Button onClick={()=>{setSelectedId(a.id);setNotes(a.adminNotes||'');}}>Рассмотреть</Button>},
    ]}/></div></DataState>
    <Drawer rootClassName="kfl-drawer" width={640} title="Анкета спортсмена" open={!!selectedId} onClose={()=>!pending&&setSelectedId(undefined)}>{selected&&<>
      <div className="kfl-application-heading"><h2>{fullName(selected)}</h2><Status value={selected.status}/></div><Descriptions column={1} size="small" items={[
        ['division','Дивизион',selected.ageDivision],['category','Категория',selected.weightClass?.name],['birthDate','Дата рождения',formatDate(selected.birthDate)],['city','Город',selected.city],['country','Страна',selected.country],['weight','Вес',`${selected.weightKg} кг`],['phone','Телефон',selected.phone],['email','Email',selected.email],['club','Клуб',selected.clubName],['coach','Тренер',selected.coachName],['experience','Опыт',selected.experience],['achievements','Достижения',selected.achievements],['medical','Медицинская информация',selected.medicalInfo],
      ].map(([key,label,value])=>({key,label,children:value||'Не указано'}))}/>
      <div className="kfl-application-links">{/^https?:\/\//i.test(selected.videoUrl||'')&&<a href={selected.videoUrl} target="_blank" rel="noreferrer">Видео спортсмена ↗</a>}{/^https?:\/\//i.test(selected.photoUrl||'')&&<a href={selected.photoUrl} target="_blank" rel="noreferrer">Фотография ↗</a>}{selected.athleteId&&<Link to={`/athletes/${selected.athleteId}`} target="_blank">Профиль спортсмена ↗</Link>}</div>
      <label className="kfl-notes-label" htmlFor="application-notes">Заметки администратора</label><Input.TextArea id="application-notes" value={notes} onChange={e=>setNotes(e.target.value)} rows={4}/>
      <div className="kfl-drawer-actions"><Button loading={pending} onClick={()=>update(selected,selected.status)}>Сохранить заметки</Button>{selected.status!=='APPROVED'&&<><Popconfirm title="Одобрить заявку?" description="Спортсмен появится в составе лиги." onConfirm={()=>update(selected,'APPROVED')} okButtonProps={{loading:pending}}><Button type="primary" disabled={pending}>Одобрить</Button></Popconfirm><Popconfirm title="Отклонить заявку?" onConfirm={()=>update(selected,'REJECTED')} okButtonProps={{danger:true,loading:pending}}><Button danger disabled={pending}>Отклонить</Button></Popconfirm>{selected.status==='PENDING'&&<Button disabled={pending} onClick={()=>update(selected,'REVIEW')}>На рассмотрение</Button>}</>}</div>
    </>}</Drawer></>;
}

export function RankingsAdmin(){
 const [division,setDivision]=useState('U17');
  const lookups=useLookups(),[weight,setWeight]=useState(''),{save,pending}=useAdminSave();
  const weightId=weight||lookups.data?.weights.find(w=>w.ageDivision===division)?.id||'';
  const query=useAdminQuery('rankings',`/rankings?weightClassId=${weightId}&ageDivision=${division}`);
  return <><PageTitle title="Рейтинги" description="Каждая позиция подтверждена результатами схваток." action={<Popconfirm title="Пересчитать рейтинг категории?" description="Будут использованы сохранённые результаты и текущие правила лиги." onConfirm={()=>save('/admin/rankings/recalculate',{weightClassId:weightId},'POST','Рейтинг пересчитан')} okButtonProps={{loading:pending}}><Button icon={<RotateCcw size={15}/>} disabled={!weightId||pending}>Пересчитать рейтинг</Button></Popconfirm>}/>
    <div className="kfl-filters"><Select aria-label="Дивизион рейтинга" value={division} onChange={v=>{setDivision(v);setWeight('');}} options={divisionOptions}/><Select aria-label="Категория рейтинга" value={weightId||undefined} placeholder="Выберите категорию" onChange={setWeight} options={lookups.data?.weights.filter(w=>w.ageDivision===division).map(w=>({value:w.id,label:w.name}))}/></div>
    <DataState query={lookups}><DataState query={query}><div className="kfl-table"><Table<Row> rowKey="id" dataSource={query.data} scroll={{x:650}} pagination={false} columns={[
      {title:'Место',dataIndex:'rank',width:80,render:v=><b className="kfl-rank-number">{String(v).padStart(2,'0')}</b>},{title:'Спортсмен',render:(_,r)=><Person athlete={r.athlete}/>},
      {title:'Победы',dataIndex:'wins'},{title:'Поражения',dataIndex:'losses'},{title:'Очки',dataIndex:'points',render:v=><strong className="kfl-points">{v}</strong>},
      {title:'Профиль',render:(_,r)=><Link to={`/athletes/${r.athleteId}`} target="_blank">Открыть ↗</Link>},
    ]}/></div></DataState></DataState></>;
}

export function ChampionsAdmin(){
  const[weight,setWeight]=useState<string>(),[page,setPage]=useState(1),lookups=useLookups(),query=useAdminQuery('championships',`/admin/championships${weight?'?weightClassId='+weight:''}`);
  const fights=useAdminQuery<{data:Row[];total:number}>('title-matches',`/admin/matches?titleOnly=true&status=COMPLETED&page=${page}${weight?'&weightClassId='+weight:''}`);
  const current=query.data?.filter(c=>c.isCurrent)||[];
  return <><PageTitle title="Чемпионы" description="Пояс принадлежит сильнейшему. История остаётся в лиге."/>
    <div className="kfl-filters"><Select aria-label="Категория чемпионов" allowClear placeholder="Все категории" value={weight} onChange={v=>{setWeight(v);setPage(1);}} options={lookups.data?.weights.map(w=>({value:w.id,label:w.name}))}/></div>
    <DataState query={query} empty={!current.length}><div className="kfl-champion-grid">{current.map(c=><article className="kfl-panel kfl-champion" key={c.id}><div><Shield size={28}/><Tag color="gold">{c.weightClass.name}</Tag></div><span className="kfl-eyebrow">ДЕЙСТВУЮЩИЙ ЧЕМПИОН</span><h2>{fullName(c.athlete)}</h2><p>{formatDate(c.wonAt)}</p><footer><strong>{c.defenses}<small>защит титула</small></strong><Link to={`/athletes/${c.athleteId}`} target="_blank">Профиль ↗</Link></footer></article>)}</div></DataState>
    <h2 className="kfl-section-heading">История чемпионства</h2><DataState query={query}><div className="kfl-table"><Table<Row> rowKey="id" scroll={{x:760}} dataSource={query.data} columns={[
      {title:'Чемпион',render:(_,c)=>fullName(c.athlete)},{title:'Категория',render:(_,c)=>c.weightClass.name},{title:'Завоевание',dataIndex:'wonAt',render:formatDate},{title:'Защиты',dataIndex:'defenses'},
      {title:'Титул',render:(_,c)=><Tag color={c.isCurrent?'gold':'default'}>{c.isCurrent?'Действующий':'История'}</Tag>},
    ]}/></div></DataState>
    <h2 className="kfl-section-heading">Титульные схватки</h2><DataState query={fights}><div className="kfl-table"><Table<Row> rowKey="id" scroll={{x:720}} dataSource={fights.data?.data} pagination={{current:page,total:fights.data?.total,pageSize:20,showSizeChanger:false,onChange:setPage}} columns={[
      {title:'Турнир',render:(_,m)=>m.event.name},{title:'Схватка',render:(_,m)=>`${fullName(m.athleteA)} — ${fullName(m.athleteB)}`},{title:'Победитель',render:(_,m)=>fullName(m.winner)},{title:'Протокол',render:(_,m)=><Link target="_blank" to={`/matches/${m.id}`}>Открыть ↗</Link>},
    ]}/></div></DataState></>;
}

export function SettingsAdmin(){
 const rules=useDivisions();
  const query=useAdminQuery<Row|null>('ranking-rule','/admin/ranking-rule'),lookups=useLookups(),[form]=Form.useForm(),editor=useEditor({order:0}),{save,pending}=useAdminSave();
  const selectedDivision=Form.useWatch('ageDivision',editor.form);
  useEffect(()=>{if(query.data)form.setFieldsValue(query.data);},[query.data,form]);
  return <><PageTitle title="Настройки" eyebrow="ПРАВИЛА ЛИГИ" description="Весовые категории и система начисления очков."/>
    <div className="kfl-settings-grid"><div className="kfl-panel"><h2>Правила рейтинга</h2><DataState query={query}>
      {!query.data&&<Alert type="info" showIcon message="Индивидуальное правило ещё не сохранено" description="До сохранения действуют стандартные правила лиги. Укажите значения, чтобы создать настройку."/>}
      <Form form={form} layout="vertical" onFinish={v=>save('/admin/ranking-rule',v,'PATCH','Правила сохранены. Для существующих результатов выполните пересчёт рейтинга.')}>
        <div className="kfl-form-grid">{[['winPoints','Очки за победу'],['earlyWinBonus','Бонус за досрочную победу'],['lossPoints','Очки за поражение'],['penaltyPoints','Вычет за штраф']].map(([name,label])=><Form.Item key={name} name={name} label={label} rules={required}><InputNumber min={0} precision={0}/></Form.Item>)}<Form.Item name="tieBreakRule" label="При равенстве очков" className="wide" rules={required}><Select options={[{value:'WINS_THEN_FEWER_LOSSES',label:'Больше побед, затем меньше поражений'},{value:'FEWER_LOSSES_THEN_WINS',label:'Меньше поражений, затем больше побед'},{value:'HEAD_TO_HEAD',label:'Личная встреча'}]}/></Form.Item></div>
        <Button type="primary" htmlType="submit" loading={pending}>Сохранить правила</Button><p className="kfl-form-note">После изменения правил пересчитайте нужные категории в разделе «Рейтинги».</p>
      </Form></DataState></div><div className="kfl-panel"><div className="kfl-panel-header"><h2>Весовые категории</h2><AddButton onClick={()=>editor.show()}>Добавить</AddButton></div><DataState query={lookups}><Table<Row> rowKey="id" dataSource={lookups.data?.weights} pagination={false} columns={[{title:'Категория',dataIndex:'name'},{title:'До, кг',dataIndex:'kilograms'},{title:'Порядок',dataIndex:'order'}]}/></DataState></div></div>
    <FormDialog {...editor} onClose={editor.close} title="Добавить весовую категорию" pending={pending} onFinish={async v=>{if(await save('/admin/weight-classes',v))editor.close();}}><TextField name="name" label="Название" wide/><Form.Item name="ageDivision" label="Дивизион" rules={required}><Select options={divisionOptions} onChange={()=>editor.form.setFieldValue('kilograms',undefined)}/></Form.Item><Form.Item name="kilograms" label="Верхний предел, кг" rules={required}><Select options={rules.data?.find(d=>d.id===selectedDivision)?.weights.map(w=>({value:w,label:`${w} кг`}))}/></Form.Item><Form.Item name="order" label="Порядок отображения"><InputNumber min={0} precision={0}/></Form.Item></FormDialog>
    </>;
}
