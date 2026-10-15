import {Button,Form,Input,Select,Table} from 'antd';
import {Link} from 'react-router-dom';
import {useAdminQuery,dateInput,toISO,type Row} from './api';
import {AddButton,DataState,FormDialog,PageTitle,TextField,required} from './components';
import {useEditor,eventStatusOptions} from './Management';
import {useAdminSave} from './useAdminSave';
export default function SeasonsAdmin(){
 const query=useAdminQuery('cycles','/competition/seasons'),editor=useEditor({status:'PLANNED'}),{save,pending}=useAdminSave();
 return <><PageTitle title="Сезоны KFL" description="Соревновательные циклы. Спортсмены и глобальный рейтинг остаются независимыми." action={<AddButton onClick={()=>editor.show()}>Создать сезон</AddButton>}/><DataState query={query}><div className="kfl-table"><Table<Row> rowKey="id" dataSource={query.data} scroll={{x:700}} columns={[
  {title:'Сезон',dataIndex:'name'},{title:'Начало',render:(_,s)=>new Date(s.startsAt).toLocaleDateString('ru-RU')},{title:'Статус',render:(_,s)=>eventStatusOptions.find(o=>o.value===(s.cycle?.status||(s.isActive?'LIVE':'PLANNED')))?.label},
  {title:'Турниры',render:(_,s)=><div>{s.events.map((e:Row)=><p key={e.id}><Link to={'/admin/events/'+e.id}>{e.name}</Link></p>)}{!s.events.length&&'Нет связанных турниров'}</div>},
  {title:'Итоги',render:(_,s)=>s.cycle?.summary||'Пока не подведены'},
  {title:'Действия',render:(_,s)=><Button onClick={()=>editor.show({...s,status:s.cycle?.status||(s.isActive?'LIVE':'PLANNED'),summary:s.cycle?.summary,startsAt:dateInput(s.startsAt),endsAt:s.endsAt?dateInput(s.endsAt):undefined})}>Редактировать</Button>}
 ]}/></div></DataState><FormDialog {...editor} onClose={editor.close} pending={pending} title={editor.editing?'Редактировать сезон':'Создать сезон'} onFinish={async v=>{if(await save('/admin/competition/seasons'+(editor.editing?'/'+editor.editing.id:''),{...v,startsAt:toISO(v.startsAt),endsAt:v.endsAt?toISO(v.endsAt):null},editor.editing?'PATCH':'POST'))editor.close();}}>
 <TextField name="name" label="Название сезона" wide/><TextField name="startsAt" label="Начало сезона" type="datetime-local"/><TextField name="endsAt" label="Окончание сезона" type="datetime-local" required={false}/><Form.Item name="status" label="Статус сезона" rules={required}><Select options={eventStatusOptions}/></Form.Item><Form.Item name="description" label="Описание" className="wide"><Input.TextArea/></Form.Item><Form.Item name="summary" label="Итоги сезона" className="wide"><Input.TextArea/></Form.Item>
 </FormDialog></>;
}
