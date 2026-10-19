import {DivisionFields,divisionOptions,useDivisions,useAgeReference} from './DivisionFields';
import AdminEditorLayout from './AdminEditorLayout';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Button,Form,Input,Popconfirm,Select,Table,Tag} from 'antd';
import {Link,useSearchParams,useNavigate} from 'react-router-dom';
import {ExternalLink,Pencil,Search} from 'lucide-react';
import {useAdminQuery,useLookups,formatDate,dateInput,toISO,type Row} from './api';
import {AddButton,DataState,FormDialog,ImageField,PageTitle,Person,Status,TextField,required,statusOptions} from './components';
import {useAdminSave} from './useAdminSave';

export function useEditor(initial:Record<string,unknown>={}){
  const[form]=Form.useForm(),[open,setOpen]=useState(false),[editing,setEditing]=useState<Row|null>(null),[params,setParams]=useSearchParams();
  const defaults=useRef(initial);defaults.current=initial;
  const show=useCallback((row?:Row)=>{setEditing(row||null);form.resetFields();form.setFieldsValue(row||defaults.current);setOpen(true);},[form]);
  useEffect(()=>{if(params.get('new')==='1'){show();const next=new URLSearchParams(params);next.delete('new');setParams(next,{replace:true});}},[params,setParams,show]);
  const close=useCallback(()=>setOpen(false),[]);
  return{form,open,editing,show,close};
}
const options=(rows?:Row[])=>rows?.map(x=>({value:x.id,label:x.name}));
const editButton=(label:string,onClick:()=>void)=><Button type="text" icon={<Pencil size={15}/>} aria-label={label} onClick={onClick}/>;

export function AthletesAdmin(){
  const [division,setDivision]=useState<string>(),[choosing,setChoosing]=useState(false),rules=useDivisions();
  const[page,setPage]=useState(1),[search,setSearch]=useState(''),[status,setStatus]=useState<string>(),[weight,setWeight]=useState<string>(),[club,setClub]=useState<string>();
  const query=useAdminQuery<{data:Row[];total:number}>('athletes',`/admin/athletes?page=${page}&search=${encodeURIComponent(search)}${status?`&status=${status}`:''}${weight?`&weightClassId=${weight}`:''}${division?`&ageDivision=${division}`:''}${club?`&clubId=${club}`:''}`),lookups=useLookups();
  const editor=useEditor({country:'Kyrgyzstan',nationality:'KG',status:'ACTIVE'}),{save,pending}=useAdminSave();
  const preview=Form.useWatch([],editor.form);
  const reference=useAgeReference(),navigate=useNavigate(),[params]=useSearchParams();
  const returnTo=params.get('returnTo');
  useEffect(()=>{if(editor.open&&!editor.editing&&!editor.form.getFieldValue('ageDivision')){editor.close();setChoosing(true);}},[editor.open,editor.editing,editor.form,editor.close]);
  return <><PageTitle title="Спортсмены" description="Состав лиги, профили и путь каждого спортсмена." action={<AddButton onClick={()=>setChoosing(true)}>Добавить спортсмена</AddButton>}/>
    <div className="kfl-filters"><Input prefix={<Search size={16}/>} aria-label="Поиск спортсмена" placeholder="Поиск по имени или фамилии" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} allowClear/>
      <Select aria-label="Статус спортсмена" placeholder="Все статусы" allowClear value={status} onChange={v=>{setStatus(v);setPage(1);}} options={statusOptions(['ACTIVE','INACTIVE','PENDING','SUSPENDED','RETIRED'])}/>
      <Select aria-label="Дивизион спортсмена" placeholder="Все дивизионы" allowClear value={division} onChange={v=>{setDivision(v);setWeight(undefined);setPage(1);}} options={divisionOptions}/><Select aria-label="Категория спортсмена" placeholder="Все категории" allowClear value={weight} onChange={v=>{setWeight(v);setPage(1);}} options={options(lookups.data?.weights.filter(w=>!division||w.ageDivision===division))}/><Select aria-label="Клуб спортсмена" placeholder="Все клубы" allowClear value={club} onChange={v=>{setClub(v);setPage(1);}} options={options(lookups.data?.clubs)}/></div>
    <DataState query={query}><div className="kfl-table"><Table<Row> rowKey="id" dataSource={query.data?.data} scroll={{x:950}} pagination={{current:page,total:query.data?.total,pageSize:20,showSizeChanger:false,onChange:setPage}} columns={[
      {title:'Спортсмен',width:270,render:(_,a)=><Person athlete={a}/>},{title:'Возраст',render:(_,a)=>a.dateOfBirth&&reference.data?reference.data.year-new Date(a.dateOfBirth).getUTCFullYear():'—'},{title:'Дивизион',render:(_,a)=><Tag color="blue">{a.weightClass?.ageDivision||'Требуется уточнение'}</Tag>},{title:'Категория',render:(_,a)=>a.weightClass?.name||'—'},{title:'Турниры',render:(_,a)=>a._count?.tournamentParticipants??0},
      {title:'Клуб',render:(_,a)=>a.club?.name||'Без клуба'},{title:'Статус',render:(_,a)=><Status value={a.status}/>},
      {title:'П / П',render:(_,a)=>`${a._count?.wonMatches??0} / ${Math.max(0,(a._count?.matchesAsA??0)+(a._count?.matchesAsB??0)-(a._count?.wonMatches??0))}`},
      {title:'Действия',width:220,render:(_,a)=><div className="kfl-actions">{editButton(`Редактировать ${a.firstName} ${a.lastName}`,()=>editor.show({...a,dateOfBirth:a.dateOfBirth?.slice(0,10),ageDivision:a.weightClass?.ageDivision,weightClassId:a.weightClassId,clubName:a.club?.name||'',coachName:a.coach?.name||''}))}<Link aria-label={`Профиль ${a.firstName}`} to={`/athletes/${a.id}`} target="_blank" rel="noreferrer"><ExternalLink size={15}/></Link><Popconfirm title={a.status==='INACTIVE'?'Вернуть спортсмена в состав?':'Архивировать спортсмена?'} description="История выступлений сохранится." okText={a.status==='INACTIVE'?'Вернуть в состав':'Архивировать'} onConfirm={()=>save(`/admin/athletes/${a.id}`,{status:a.status==='INACTIVE'?'ACTIVE':'INACTIVE'},'PATCH')} okButtonProps={{loading:pending}}><Button type="text" size="small">{a.status==='INACTIVE'?'В состав':'В архив'}</Button></Popconfirm></div>},
    ]}/></div></DataState>
    <AdminEditorLayout open={choosing} title="В какой дивизион добавить спортсмена?" onClose={()=>setChoosing(false)} onSave={()=>setChoosing(false)} saveText="Закрыть"><div className="kfl-division-cards">{rules.data?.map(d=><article key={d.id}><strong>{d.id}</strong><h3>{d.name}</h3><p>{d.minAge}–{d.maxAge} лет</p><p>{d.weights.join(' · ')} кг</p><Button type="primary" onClick={()=>{setChoosing(false);editor.show();editor.form.setFieldsValue({ageDivision:d.id});}}>Выбрать {d.id}</Button></article>)}</div>{rules.isError&&<p>Не удалось загрузить дивизионы. Обновите страницу.</p>}</AdminEditorLayout>
    <FormDialog {...editor} onClose={editor.close} title={editor.editing?'Редактировать спортсмена':'Добавить спортсмена'} pending={pending} onFinish={async v=>{
      if(await save(`/admin/athletes${editor.editing?'/'+editor.editing.id:''}`,{...v,clubName:v.clubName?.trim()||'',coachName:v.coachName?.trim()||''},editor.editing?'PATCH':'POST')){editor.close();if(returnTo?.startsWith('/admin/events/'))navigate(returnTo);}
    }}><DataState query={lookups}><div className="kfl-form-section wide">Личные данные</div><TextField name="firstName" label="Имя"/><TextField name="lastName" label="Фамилия"/>
      <TextField name="nickname" label="Прозвище" required={false}/><TextField name="city" label="Город"/><TextField name="country" label="Страна"/><TextField name="nationality" label="Код страны"/>
      <div className="kfl-form-section wide">Спортивный профиль</div><DivisionFields form={editor.form} originalBirth={editor.editing?.dateOfBirth?.slice(0,10)}/>
      <Form.Item name="status" label="Статус" rules={required}><Select options={statusOptions(['ACTIVE','INACTIVE','PENDING','SUSPENDED','RETIRED'])}/></Form.Item>
      <Form.Item name="clubName" label="Клуб"><Input maxLength={250} placeholder="Введите название клуба"/></Form.Item><Form.Item name="coachName" label="Тренер"><Input maxLength={250} placeholder="Введите имя и фамилию тренера"/></Form.Item>
      <div className="kfl-profile-preview wide"><Person athlete={{id:editor.editing?.id||'preview',...preview}}/><p>{preview?.ageDivision||'Выберите дивизион'} · {lookups.data?.weights.find(w=>w.id===preview?.weightClassId)?.name||'Выберите вес'}</p><small>{preview?.city} · {preview?.clubName?.trim()||'Без клуба'}</small></div><Form.Item name="imageUrl" label="Фотография" className="wide"><ImageField/></Form.Item><Form.Item name="story" label="История спортсмена" className="wide"><Input.TextArea rows={3}/></Form.Item></DataState>
    </FormDialog></>;
}

export const eventStatusOptions=[{value:'PLANNED',label:'Запланирован'},{value:'LIVE',label:'Проводится'},{value:'COMPLETED',label:'Завершён'},{value:'CANCELLED',label:'Отменён'}];
export function EventEditorFields({form}:{form:any}){
 const lookups=useLookups(),seasons=useAdminQuery('seasons-options','/seasons'),division=Form.useWatch('ageDivision',form);
 return <><TextField name="name" label="Название турнира" wide/><Form.Item name="seasonId" label="Сезон KFL"><Select allowClear placeholder="Самостоятельный турнир" options={seasons.data?.map(s=>({value:s.id,label:s.name}))} onClear={()=>form.setFieldValue('seasonId',null)}/></Form.Item><TextField name="startsAt" label="Дата и время" type="datetime-local"/><Form.Item name="ageDivision" label="Дивизион" rules={required}><Select options={divisionOptions} onChange={()=>form.setFieldValue('weightClassIds',[])}/></Form.Item><TextField name="city" label="Город"/><TextField name="venue" label="Место проведения"/><Form.Item name="weightClassIds" label="Весовые категории" className="wide" rules={required}><Select mode="multiple" options={lookups.data?.weights.filter(w=>w.ageDivision===division).map(w=>({value:w.id,label:w.name}))}/></Form.Item><Form.Item name="status" label="Статус турнира" rules={required}><Select options={eventStatusOptions}/></Form.Item><Form.Item name="description" label="Описание" className="wide"><Input.TextArea rows={3}/></Form.Item><Form.Item name="bannerUrl" label="Баннер турнира" className="wide"><ImageField/></Form.Item><p className="wide kfl-form-note">После сохранения турнир сразу виден в разделе «События». Баннер необязателен: он отображается в карточке, на странице турнира и на главной, когда турнир станет ближайшим. Рекомендуется горизонтальное изображение. Правила допуска и даты этапов укажите в описании.</p></>;
}
export function EventsAdmin(){
 const query=useAdminQuery('events','/events'),editor=useEditor({status:'PLANNED'}),{save,pending}=useAdminSave(),navigate=useNavigate();
 return <><PageTitle title="Турниры" description="Создайте соревнование, зарегистрируйте участников и сформируйте пары." action={<AddButton onClick={()=>editor.show()}>Создать турнир</AddButton>}/><DataState query={query}><div className="kfl-table"><Table<Row> rowKey="id" dataSource={query.data} scroll={{x:950}} columns={[
 {title:'Турнир',render:(_,e)=><Link to={'/admin/events/'+e.id}>{e.name}</Link>},{title:'Дата',dataIndex:'startsAt',render:formatDate},{title:'Место',render:(_,e)=>[e.city,e.venue].filter(Boolean).join(' · ')},{title:'Дивизион',dataIndex:'ageDivision'},{title:'Статус',render:(_,e)=>eventStatusOptions.find(s=>s.value===e.status)?.label},{title:'Участники',render:(_,e)=>e._count?.participants??0},{title:'Действия',render:(_,e)=><div className="kfl-actions"><Link to={'/admin/events/'+e.id}>Открыть</Link>{editButton('Редактировать '+e.name,()=>editor.show({...e,startsAt:dateInput(e.startsAt),weightClassIds:e.weightClasses?.map((w:Row)=>w.weightClassId)}))}{e.status!=='CANCELLED'&&<Popconfirm title="Отменить турнир?" description="Результаты и история сохранятся." onConfirm={()=>save('/admin/events/'+e.id+'/cancel',{})}><Button danger type="text">Отменить</Button></Popconfirm>}</div>},
 ]}/></div></DataState><FormDialog {...editor} title={editor.editing?'Редактировать турнир':'Создать турнир'} onClose={editor.close} pending={pending} onFinish={async v=>{if(await save('/admin/events'+(editor.editing?'/'+editor.editing.id:''),{...v,seasonId:v.seasonId??null,startsAt:toISO(v.startsAt)},editor.editing?'PATCH':'POST','Турнир сохранён',record=>{if(!editor.editing)navigate('/admin/events/'+record.id);}))editor.close();}}><EventEditorFields form={editor.form}/></FormDialog></>;
}

export function DirectoryAdmin({kind}:{kind:'clubs'|'coaches'|'users'}){
  const title={clubs:'Клубы',coaches:'Тренеры',users:'Пользователи'}[kind],action={clubs:'Добавить клуб',coaches:'Добавить тренера',users:'Добавить пользователя'}[kind];
  const query=useAdminQuery(kind,`/admin/${kind}`),lookups=useLookups(),editor=useEditor({country:'Kyrgyzstan',role:'MODERATOR'}),{save,pending}=useAdminSave();
  const[search,setSearch]=useState('');
  return <><PageTitle title={title} eyebrow="СИСТЕМА" description={kind==='users'?'Учётные записи и уровни доступа к лиге.':'Люди и команды, которые стоят за спортсменами.'} action={<AddButton onClick={()=>editor.show()}>{action}</AddButton>}/>
    <div className="kfl-filters"><Input aria-label="Поиск в справочнике" prefix={<Search size={16}/>} placeholder="Поиск" value={search} onChange={e=>setSearch(e.target.value)}/></div>
    <DataState query={query}><div className="kfl-table"><Table<Row> rowKey="id" scroll={{x:600}} dataSource={query.data?.filter(r=>String(r.name||r.email).toLowerCase().includes(search.toLowerCase()))} columns={kind==='users'?[
      {title:'Email',dataIndex:'email'},{title:'Роль',render:(_,r)=><Status value={r.role}/>},{title:'Дата создания',dataIndex:'createdAt',render:formatDate},
    ]:[{title:'Название / имя',dataIndex:'name'},{title:kind==='clubs'?'Город':'Клуб',render:(_,r)=>kind==='clubs'?r.city:r.club?.name||'Не указан'},
      {title:'Спортсмены',render:(_,r)=>r._count?.athletes||0},{title:'Действия',render:(_,r)=>editButton(`Редактировать ${r.name}`,()=>editor.show(r))}]}/></div></DataState>
    <FormDialog {...editor} onClose={editor.close} title={editor.editing?'Редактировать запись':action} pending={pending} onFinish={async v=>{if(await save(`/admin/${kind}${editor.editing?'/'+editor.editing.id:''}`,{...v,...(kind==='coaches'?{clubId:v.clubId||null}:{})},editor.editing?'PATCH':'POST'))editor.close();}}>
      {kind==='users'?<><Form.Item name="email" label="Email" rules={[...required,{type:'email',message:'Проверьте адрес почты'}]}><Input/></Form.Item><Form.Item name="role" label="Роль" rules={required}><Select options={statusOptions(['ADMIN','REGISTRAR','MODERATOR','ATHLETE'])}/></Form.Item><Form.Item name="password" label="Пароль" className="wide" rules={[...required,{min:12,message:'Минимум 12 символов'}]}><Input.Password autoComplete="new-password"/></Form.Item><p className="kfl-form-note wide">REGISTRAR может только добавлять спортсменов и загружать фотографии. Передайте пароль пользователю безопасным способом.</p></>:<><TextField name="name" label={kind==='clubs'?'Название клуба':'Имя и фамилия'} wide/>{kind==='clubs'?<><TextField name="city" label="Город"/><TextField name="country" label="Страна"/></>:<Form.Item name="clubId" label="Клуб" className="wide"><Select allowClear showSearch optionFilterProp="label" options={options(lookups.data?.clubs)}/></Form.Item>}</>}
    </FormDialog></>;
}
