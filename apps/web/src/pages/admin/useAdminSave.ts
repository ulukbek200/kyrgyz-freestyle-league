import {useContext,useRef,useState} from 'react';
import {App} from 'antd';
import {useMutation,useQueryClient} from '@tanstack/react-query';
import {apiRequest,Session,ApiError} from './api';

export function useAdminSave(){
  const{token}=useContext(Session),{message}=App.useApp(),client=useQueryClient(),busy=useRef(false),[pending,setPending]=useState(false);
  const mutation=useMutation({mutationFn:({path,method,body}:{path:string;method:string;body?:unknown})=>apiRequest(path,token,{method,body})});
  async function save(path:string,body?:unknown,method='POST',success='Изменения сохранены',onSaved?:(record:any)=>void){
    if(busy.current)return false;busy.current=true;setPending(true);
    try{const record=await mutation.mutateAsync({path,method,body});await client.invalidateQueries();message.success(success);onSaved?.(record);return true;}
    catch(error){message.error({content:(error instanceof ApiError&&error.status===409?'Конфликт: ':'')+(error instanceof Error?error.message:'Не удалось сохранить данные'),duration:7});return false;}
    finally{busy.current=false;setPending(false);}
  }
  return{save,pending};
}
