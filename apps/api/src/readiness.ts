import type {RequestHandler} from 'express';
import {prisma} from './db.js';

export const lifecycle={draining:false};
export function readiness(check:()=>Promise<unknown>,timeoutMs=2000):RequestHandler{
 return async(_req,res)=>{
  if(lifecycle.draining){res.status(503).json({status:'unavailable'});return;}
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{
   await Promise.race([check(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('timeout')),timeoutMs);})]);
   res.status(lifecycle.draining?503:200).json({status:lifecycle.draining?'unavailable':'ready'});
  }catch{res.status(503).json({status:'unavailable'});}finally{clearTimeout(timer);}
 };
}
export const databaseReady=readiness(()=>prisma.$transaction(async tx=>{
 await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '1000ms'");
 await tx.$queryRaw`SELECT 1`;
},{maxWait:1000,timeout:1500}));
