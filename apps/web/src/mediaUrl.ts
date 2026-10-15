import {API} from './pages/admin/api';
export function mediaUrl(value?:string|null):string|undefined{
 if(!value)return undefined;
 try{
  const base=new URL(API,window.location.origin),url=new URL(value,base);
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password)return undefined;
  // Legacy local uploads must follow the current API, not the author's localhost.
  if(/^\/uploads\/[a-f0-9-]+\.(png|jpg|webp)$/.test(url.pathname)&&(['localhost','127.0.0.1','[::1]'].includes(url.hostname)||value.startsWith('/uploads/')))return new URL(url.pathname,base).href;
  return url.href;
 }catch{return undefined;}
}
