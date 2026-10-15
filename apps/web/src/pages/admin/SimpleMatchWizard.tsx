import {useEffect} from 'react';
import {Alert,Form,Input,Select,Switch} from 'antd';
import {Link} from 'react-router-dom';
import {useAdminQuery,fullName,dateInput,toISO,type Row} from './api';
import {DataState,FormDialog,required} from './components';
import {useAdminSave} from './useAdminSave';

export default function SimpleMatchWizard({open,onClose,onCreated,eventId}:{open:boolean;onClose:()=>void;onCreated?:()=>void;eventId:string}){
 const [form]=Form.useForm(),{save,pending}=useAdminSave();
 const eventQuery=useAdminQuery<Row>('event',`/admin/events/${eventId}`),participants=useAdminQuery('participants',`/admin/events/${eventId}/participants`),event=eventQuery.data;
 const weightId=Form.useWatch('weightClassId',form),red=Form.useWatch('athleteAId',form);
 const candidates=participants.data?.filter(p=>p.status==='ACTIVE'&&p.athlete.status==='ACTIVE'&&p.weightClassId===weightId)||[];
 const closed=event?.status==='COMPLETED'||event?.status==='CANCELLED';
 useEffect(()=>{if(open){form.resetFields();form.setFieldsValue({scheduledAt:dateInput(event?.startsAt),isTitleFight:false});}},[open,event?.startsAt,form]);
 return <FormDialog open={open} onClose={onClose} form={form} pending={pending} title="Создать схватку турнира" onFinish={async values=>{
  if(closed||!event)return;
  if(await save('/admin/matches',{...values,eventId,ageDivision:event.ageDivision,scheduledAt:toISO(values.scheduledAt)},'POST','Схватка создана')){onClose();onCreated?.();}
 }}><DataState query={eventQuery}><DataState query={participants}>
  <p className="wide kfl-form-note">{event?.name} · {event?.ageDivision}. Для пары доступны только зарегистрированные участники.</p>
  {closed&&<Alert className="wide" type="warning" message="Турнир завершён или отменён. Создание схваток закрыто."/>}
  <Form.Item name="weightClassId" label="Весовая категория" rules={required}><Select disabled={closed} options={event?.weightClasses.map((w:Row)=>({value:w.weightClassId,label:w.weightClass.name}))} onChange={()=>form.setFieldsValue({athleteAId:undefined,athleteBId:undefined})}/></Form.Item>
  <Form.Item name="scheduledAt" label="Дата и время" rules={required}><Input type="datetime-local" disabled={closed}/></Form.Item>
  <Form.Item name="athleteAId" label="Красный угол" rules={required}><Select disabled={closed||!weightId} showSearch optionFilterProp="label" options={candidates.map(p=>({value:p.athleteId,label:fullName(p.athlete)}))} onChange={()=>form.setFieldValue('athleteBId',undefined)}/></Form.Item>
  <Form.Item name="athleteBId" label="Синий угол" rules={required}><Select disabled={closed||!red} showSearch optionFilterProp="label" options={candidates.filter(p=>p.athleteId!==red).map(p=>({value:p.athleteId,label:fullName(p.athlete)}))}/></Form.Item>
  <Form.Item name="isTitleFight" label="Титульная схватка" valuePropName="checked"><Switch disabled={closed}/></Form.Item>
  {weightId&&candidates.length<2&&<Alert className="wide" type="info" message="Для пары нужны минимум два участника одной категории" description={<Link to={`/admin/events/${eventId}?tab=participants`} onClick={onClose}>Открыть участников турнира</Link>}/>}
 </DataState></DataState></FormDialog>;
}
