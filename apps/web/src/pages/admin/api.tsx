import {createContext,useContext} from 'react';
import {useQuery} from '@tanstack/react-query';

export type Row={id:string;[key:string]:any};
export type Lookups={athletes:Row[];clubs:Row[];coaches:Row[];weights:Row[];events:Row[]};
export const API=import.meta.env.VITE_API_URL||'http://localhost:4000/api';
export const Session=createContext({token:'',logout:()=>{}});
export class ApiError extends Error {constructor(public status:number,message:string){super(message)}}
const explanations:Record<string,string>={
  'Authentication required':'Войдите в систему для продолжения.',
  'Insufficient permissions':'Недостаточно прав доступа.',
  'Invalid request':'Не удалось выполнить действие. Проверьте данные и повторите попытку.',
  'Session expired':'Сессия истекла. Войдите ещё раз.',
  'No suitable weight class for this athlete. Create a category at or above the actual weight.':'Нет категории для фактического веса спортсмена. Сначала добавьте подходящую категорию в настройках.',
  'Historical championships without a source match need reconciliation before changing title results.':'В истории чемпионства есть записи без связанного матча. Необходима сверка протоколов перед изменением результата.',
  'Winner must be a participant of this match':'Победитель должен быть участником этой схватки.',
};
export async function apiRequest<T=any>(path:string,token:string,options:{method?:string;body?:unknown;signal?:AbortSignal;file?:File}={}):Promise<T>{
  let response:Response;
  try{response=await fetch(API+path,{method:options.method||'GET',signal:options.signal,
    headers:{...(token?{Authorization:`Bearer ${token}`} :{}),...(options.file?{'Content-Type':options.file.type}:options.body!==undefined?{'Content-Type':'application/json'}:{})},
    body:options.file??(options.body===undefined?undefined:JSON.stringify(options.body))});}
  catch(e){if(e instanceof Error&&e.name==='AbortError')throw e;throw new ApiError(0,'Нет связи с сервером. Проверьте подключение и повторите попытку.');}
  const data=await response.json().catch(()=>({}));
  if(!response.ok){if(response.status===401&&token)window.dispatchEvent(new Event('kfl-session-expired'));
    throw new ApiError(response.status,explanations[data.error]||data.error||(response.status===403?'Недостаточно прав доступа.':'Не удалось выполнить запрос.'));}
  return data;
}
export function useAdminQuery<T=Row[]>(key:string,path:string){const{token}=useContext(Session);return useQuery<T>({queryKey:['admin-v3',key,path],queryFn:({signal})=>apiRequest<T>(path,token,{signal}),enabled:!!token,retry:1});}
export const useLookups=()=>useAdminQuery<Lookups>('lookups','/admin/lookups');
export const fullName=(a?:Row)=>a?`${a.firstName} ${a.lastName}`:'—';
export const formatDate=(value?:string)=>value?new Date(value).toLocaleDateString('ru-RU',{day:'2-digit',month:'short',year:'numeric'}):'—';
export const dateInput=(value?:string)=>{if(!value)return '';const d=new Date(value);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)};
export const toISO=(value:string)=>new Date(value).toISOString();
