import {useState} from 'react';
import {Alert,Button,Descriptions,Form,Input,Popconfirm,Select,Table,Tabs,Tag} from 'antd';
import {Link,useParams,useSearchParams} from 'react-router-dom';
import {useAdminQuery,dateInput,toISO,fullName,type Row} from './api';
import {AddButton,DataState,FormDialog,PageTitle,Person,required} from './components';
import {EventEditorFields,eventStatusOptions,useEditor} from './Management';
import {useAdminSave} from './useAdminSave';
import MatchesAdmin from './MatchesAdmin';
import GroupCompetition from '../../GroupCompetition';

export default function TournamentDetails(){
 const {eventId=''}=useParams(),[params,setParams]=useSearchParams(),tab=params.get('tab')||'overview';
 const query=useAdminQuery<Row>('event',`/admin/events/${eventId}`),participants=useAdminQuery('participants',`/admin/events/${eventId}/participants`),results=useAdminQuery('event-results',`/admin/events/${eventId}/results`);
 const [search,setSearch]=useState(''),[weight,setWeight]=useState<string>(),[page,setPage]=useState(1),[adding,setAdding]=useState(false),[selected,setSelected]=useState<string>(),[participantForm]=Form.useForm();
 const registry=useAdminQuery<{data:Row[];total:number}>('participant-registry',`/admin/athletes?status=ACTIVE&page=${page}&search=${encodeURIComponent(search)}${weight?'&weightClassId='+weight:''}`);
 const editor=useEditor(),{save,pending}=useAdminSave(),event=query.data;
 const weights=event?.weightClasses?.map((x:Row)=>({value:x.weightClassId,label:x.weightClass.name}))||[];
 const registered=new Set(participants.data?.map(p=>p.athleteId));
 const closed=event?.status==='CANCELLED'||event?.status==='COMPLETED';
 const overview=event&&<div className="kfl-panel"><Descriptions column={{xs:1,md:2}} items={[
 {key:'date',label:'Дата',children:new Date(event.startsAt).toLocaleString('ru-RU')},{key:'location',label:'Место',children:[event.city,event.venue].filter(Boolean).join(' · ')},{key:'division',label:'Дивизион',children:event.ageDivision||'Исторический турнир'},{key:'status',label:'Статус',children:eventStatusOptions.find(s=>s.value===event.status)?.label},{key:'weights',label:'Категории',children:weights.map((w:{value:string;label:string})=><Tag key={w.value}>{w.label}</Tag>)},{key:'participants',label:'Участники',children:participants.data?.length??0},
 ]}/><p>{event.description}</p><Button onClick={()=>editor.show({...event,startsAt:dateInput(event.startsAt),weightClassIds:event.weightClasses.map((w:Row)=>w.weightClassId)})}>Редактировать турнир</Button></div>;
 const people=<><AddButton onClick={()=>{setAdding(true);setSelected(undefined);participantForm.resetFields();}}>Добавить участника</AddButton>{closed&&<Alert type="info" message="Регистрация закрыта. Существующие участники и результаты сохранены."/>}<DataState query={participants}><div className="kfl-table"><Table<Row> rowKey="id" dataSource={participants.data} scroll={{x:650}} columns={[
 {title:'Спортсмен',render:(_,p)=><Person athlete={p.athlete}/>},{title:'Клуб',render:(_,p)=>p.athlete.club?.name||'Без клуба'},{title:'Категория',render:(_,p)=>p.weightClass?.name||'Уточнить'},{title:'Допуск',render:(_,p)=>p.status==='NEEDS_REVIEW'?'Требуется сверка истории':'Зарегистрирован'},
 {title:'Действие',render:(_,p)=><Popconfirm title="Убрать из участников турнира?" description="Профиль в KFL останется." onConfirm={()=>save(`/admin/events/${eventId}/participants/${p.athleteId}`,undefined,'DELETE','Участник удалён из турнира')}><Button danger disabled={pending}>Убрать</Button></Popconfirm>},
 ]}/></div></DataState></>;
 return <><Link to="/admin/events">← Все турниры</Link><PageTitle title={event?.name||'Турнир'} description="Участники, схватки и результаты одного соревнования."/><DataState query={query}><Tabs activeKey={tab} onChange={key=>setParams({tab:key})} items={[
 {key:'competition',label:'Групповой турнир',children:event&&<GroupCompetition key={event.id} event={event} admin/>},{key:'overview',label:'Обзор',children:overview},{key:'participants',label:'Участники',children:people},{key:'matches',label:'Схватки',children:<MatchesAdmin eventId={eventId}/>},{key:'results',label:'Результаты',children:<DataState query={results}><p>Итоговые места в весовых категориях по действующей формуле рейтинга KFL. Отображаются только завершённые схватки.</p><div className="kfl-table"><Table<Row> rowKey="id" dataSource={results.data} scroll={{x:650}} columns={[{title:'Место',dataIndex:'rank'},{title:'Спортсмен',render:(_,r)=><Person athlete={r.athlete}/>},{title:'Категория',render:(_,r)=>r.weightClass?.name},{title:'Победы',dataIndex:'wins'},{title:'Поражения',dataIndex:'losses'},{title:'Очки',dataIndex:'points'}]}/></div></DataState>},
 ]}/></DataState>
 <FormDialog {...editor} onClose={editor.close} title="Редактировать турнир" pending={pending} onFinish={async v=>{if(await save(`/admin/events/${eventId}`,{...v,seasonId:v.seasonId??null,startsAt:toISO(v.startsAt)},'PATCH'))editor.close();}}><EventEditorFields form={editor.form}/></FormDialog>
 <FormDialog open={adding} form={participantForm} onClose={()=>setAdding(false)} pending={pending} title="Добавить участника турнира" onFinish={async v=>{if(closed)return;if(await save(`/admin/events/${eventId}/participants`,v,'POST','Спортсмен зарегистрирован в турнире'))setAdding(false);}}>
  {closed?<Alert className="wide" type="warning" message="Турнир завершён или отменён"/>:<>
  <div className="wide"><Link to={`/admin/athletes?new=1&returnTo=${encodeURIComponent('/admin/events/'+eventId+'?tab=participants')}`}>Нет спортсмена в KFL? Создать профиль →</Link></div>
  <div className="kfl-filters wide"><Input aria-label="Поиск участника" placeholder="Имя, фамилия или клуб" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}/><Select allowClear placeholder="Весовая категория" value={weight} options={weights} onChange={v=>{setWeight(v);setPage(1);}}/></div>
  <div className="wide"><DataState query={registry}><Table<Row> rowKey="id" dataSource={registry.data?.data} scroll={{x:460}} pagination={{current:page,total:registry.data?.total,pageSize:20,onChange:setPage}} rowSelection={{type:'radio',selectedRowKeys:selected?[selected]:[],getCheckboxProps:a=>({disabled:registered.has(a.id)}),onChange:keys=>{const id=String(keys[0]);setSelected(id);const athlete=registry.data?.data.find(a=>a.id===id);participantForm.setFieldsValue({athleteId:id,weightClassId:weights.some((w:{value:string})=>w.value===athlete?.weightClassId)?athlete?.weightClassId:undefined});}}} columns={[{title:'Спортсмен',render:(_,a)=>fullName(a)},{title:'Клуб',render:(_,a)=>a.club?.name||'—'},{title:'Категория профиля',render:(_,a)=>a.weightClass?.name||'—'}]}/></DataState></div>
  <Form.Item name="athleteId" hidden rules={required}><Input/></Form.Item><Form.Item name="weightClassId" label="Категория участия" rules={required}><Select options={weights}/></Form.Item><p className="wide kfl-form-note">Возраст проверяется по году проведения турнира. Профиль спортсмена и прежние участия сохраняются.</p>
  </>}
 </FormDialog></>;
}
