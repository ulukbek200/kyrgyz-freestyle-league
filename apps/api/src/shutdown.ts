import type {Server} from 'node:http';
import {lifecycle} from './readiness.js';

export function shutdownHandler(server:Server,disconnect:()=>Promise<void>,exit:(code:number)=>void,timeoutMs=10000){
 let closing=false;
 return ()=>{
  if(closing)return;closing=true;lifecycle.draining=true;
  const deadline=setTimeout(()=>{server.closeAllConnections();exit(1);},timeoutMs);deadline.unref();
  server.close(()=>{void disconnect().then(()=>{clearTimeout(deadline);exit(0);},()=>{clearTimeout(deadline);exit(1);});});
  server.closeIdleConnections();
 };
}
