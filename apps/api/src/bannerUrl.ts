import {z} from 'zod';
export const bannerUrlSchema=z.string().max(2048).refine(value=>{
 if(/^\/uploads\/[a-f0-9-]+\.(png|jpg|webp)$/.test(value))return true;
 if(!/^https?:\/\//i.test(value)||/[\s\\]/.test(value))return false;
 try{const url=new URL(value);return !!url.hostname&&!url.username&&!url.password&&['https:','http:'].includes(url.protocol);}catch{return false;}
},'Укажите корректную ссылку http(s) или загрузите баннер').nullable().optional();
