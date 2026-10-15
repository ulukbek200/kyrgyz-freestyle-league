import {useState} from 'react';
import {Alert,Button,Form,Input} from 'antd';
import {Link,useLocation} from 'react-router-dom';
import {DivisionFields} from './DivisionFields';
import {DataState,FormDialog,ImageField,PageTitle,TextField} from './components';
import {useLookups,type Row} from './api';
import {useAdminSave} from './useAdminSave';

export default function Registrar({email,logout}:{email:string;logout:()=>void}){
 const[form]=Form.useForm(),[open,setOpen]=useState(false),[created,setCreated]=useState<Row|null>(null),lookups=useLookups(),{save,pending}=useAdminSave(),location=useLocation();
 const permitted=['/admin','/admin/','/admin/athletes'].includes(location.pathname);
 return <div className="kfl-workspace"><main className="kfl-page" style={{width:'100%',maxWidth:1000,margin:'0 auto',minWidth:0}}><div className="kfl-actions" style={{flexWrap:'wrap'}}><Link to="/">KFL · На сайт</Link><span style={{overflowWrap:'anywhere',maxWidth:'100%'}}>{email} · Регистратор</span><Button onClick={logout}>Выйти</Button></div>
 {permitted?<><PageTitle title="Регистрация спортсменов" description="Добавьте профиль и фотографию нового участника." action={<Button type="primary" onClick={()=>{form.resetFields();form.setFieldsValue({country:'Kyrgyzstan',nationality:'KG'});setOpen(true);}}>Добавить спортсмена</Button>}/>
 {created&&<Alert type="success" showIcon message={`Спортсмен ${created.firstName} ${created.lastName} зарегистрирован`}/>}
 <FormDialog form={form} open={open} title="Добавить спортсмена" pending={pending} onClose={()=>setOpen(false)} onFinish={async values=>{if(await save('/admin/athletes',{...values,status:'ACTIVE'},'POST','Спортсмен зарегистрирован',setCreated))setOpen(false);}}>
 <DataState query={lookups}><TextField name="firstName" label="Имя"/><TextField name="lastName" label="Фамилия"/><TextField name="city" label="Город"/><TextField name="country" label="Страна"/><TextField name="nationality" label="Код страны"/><DivisionFields form={form}/><Form.Item name="clubName" label="Клуб"><Input maxLength={250}/></Form.Item><Form.Item name="coachName" label="Тренер"><Input maxLength={250}/></Form.Item><Form.Item name="imageUrl" label="Фотография" className="wide"><ImageField/></Form.Item></DataState>
 </FormDialog></>:<><Alert type="error" message="403 — Доступ к этому разделу запрещён"/><Link to="/admin">К регистрации спортсменов</Link></>}
 </main></div>;
}
