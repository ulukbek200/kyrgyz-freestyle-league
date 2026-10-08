import { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { api, errMsg } from '../../api/client';
export function useAdminSave(_keys?: string[]) {
  const qc=useQueryClient(); const lock=useRef(false);
  const mutation=useMutation({mutationFn:({method,url,data}:{method:'post'|'patch'|'delete';url:string;data?:any})=>api.request({method,url:'/admin'+url,data}),
    onSuccess:r=>{qc.invalidateQueries();const u=r.data?.updates; message.success(u?.resultSaved ? 'Результат сохранён'+(u.rankingsUpdated?' · Рейтинг обновлён':'')+(u.championshipUpdated?' · Чемпионство обновлено':'') : 'Сохранено');},
    onError:e=>message.error(errMsg(e))});
  return {...mutation,mutate:(v:Parameters<typeof mutation.mutate>[0],options?:Parameters<typeof mutation.mutate>[1])=>{if(lock.current)return;lock.current=true;mutation.mutate(v,{...options,onSettled:(...args)=>{lock.current=false;options?.onSettled?.(...args);}});}};
}

