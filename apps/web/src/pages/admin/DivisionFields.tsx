import {useEffect} from 'react';
import {Alert,Form,Input,Select,Tag,type FormInstance} from 'antd';
import {useQuery} from '@tanstack/react-query';
import {apiRequest,useLookups,type Row} from './api';
import {required} from './components';
export type Division={id:'U17'|'U23';name:string;minAge:number;maxAge:number;weights:number[]};
export function useDivisions(){return useQuery<Division[]>({queryKey:['age-divisions'],queryFn:()=>apiRequest('/age-divisions','')});}
export function useAgeReference(){return useQuery<{year:number}>({queryKey:['age-reference'],queryFn:()=>apiRequest('/age-reference','')});}
export const divisionOptions=[{value:'U17',label:'U17'},{value:'U23',label:'U23'}];
export function ageDivisionForYear(birth:string|undefined,year:number|undefined,divisions:Division[]|undefined){
 if(!birth||!year)return null;const age=year-new Date(birth).getUTCFullYear();return {age,division:divisions?.find(d=>age>=d.minAge&&age<=d.maxAge)?.id};
}
export function DivisionFields({form,publicApplication=false,originalBirth}:{form:FormInstance;publicApplication?:boolean;originalBirth?:string}){
 const lookups=useLookups(),rules=useDivisions(),reference=useAgeReference();
 const weights=useQuery<Row[]>({queryKey:['division-weights'],queryFn:()=>apiRequest('/weight-classes',''),enabled:publicApplication});
 const classes=publicApplication?weights.data:lookups.data?.weights;
 const birth=Form.useWatch(publicApplication?'birthDate':'dateOfBirth',form),division=Form.useWatch('ageDivision',form),weightId=Form.useWatch('weightClassId',form);
 const computed=ageDivisionForYear(birth,reference.data?.year,rules.data),unchanged=!!originalBirth&&birth===originalBirth;
 useEffect(()=>{if(unchanged)return;if(computed?.division)form.setFieldValue('ageDivision',computed.division);else if(publicApplication)form.setFieldValue('ageDivision',undefined);},[publicApplication,computed?.division,unchanged,form]);
 useEffect(()=>{if(weightId&&classes&&!classes.some(w=>w.id===weightId&&w.ageDivision===division))form.setFieldValue('weightClassId',undefined);},[division,weightId,classes,form]);
 return <>
  {!publicApplication&&<Form.Item name="dateOfBirth" label="Дата рождения" rules={required}><Input type="date"/></Form.Item>}
  <Form.Item name="ageDivision" label="Дивизион" dependencies={[publicApplication?'birthDate':'dateOfBirth']} rules={[...required,()=>({validator:(_,v)=>unchanged||computed?.division===v?Promise.resolve():Promise.reject(new Error(computed?'Возраст не допускается в U17/U23 в текущем году':'Укажите дату рождения и дождитесь загрузки правил'))})]}><Select disabled options={divisionOptions}/></Form.Item>
  <Form.Item name="weightClassId" label="Весовая категория" rules={required}><Select options={classes?.filter(w=>w.ageDivision===division).map(w=>({value:w.id,label:w.name}))}/></Form.Item>
  {computed&&<div className="wide"><Tag>{computed.age} лет в {reference.data?.year} году</Tag>{computed.division?<Tag color="blue">{computed.division}</Tag>:<Alert type={unchanged?'info':'error'} message={unchanged?'Исторический профиль сохранён. Допуск проверяется при регистрации в турнир.':'По году рождения участие в U17/U23 в текущем году недоступно'}/>}</div>}
  {(rules.isError||reference.isError)&&<Alert className="wide" type="error" message="Не удалось загрузить правила возраста. Обновите страницу."/>}
 </>;
}
