import rateLimit from 'express-rate-limit';
import {createHash} from 'node:crypto';
import type {Express} from 'express';

export function configureProxy(app:Express,value=process.env.TRUSTED_PROXIES){
 if(!value){app.set('trust proxy',false);return;}
 const proxies=value.split(',').map(s=>s.trim()).filter(Boolean);
 // Never trust every client or a hop count: deployments can have shorter paths.
 if(!proxies.length||proxies.some(p=>p==='true'||p==='false'||/^\d+$/.test(p)||p.endsWith('/0')))throw new Error('TRUSTED_PROXIES must contain explicit trusted proxy IPs/CIDRs');
 app.set('trust proxy',proxies);
}
export function loginLimiters(options:{ipLimit?:number;accountLimit?:number;windowMs?:number}={}){
 const common={windowMs:options.windowMs??15*60*1000,standardHeaders:'draft-7' as const,legacyHeaders:false,message:{error:'Too many login attempts. Try again later.'}};
 return [
  rateLimit({...common,limit:options.ipLimit??60}),
  rateLimit({...common,limit:options.accountLimit??10,skipSuccessfulRequests:true,keyGenerator:req=>{
   const email=typeof req.body?.email==='string'?req.body.email.trim().toLowerCase():'';
   return createHash('sha256').update(email||req.ip||'unknown').digest('hex');
  }}),
 ];
}
