export function webOrigins(value=process.env.WEB_ORIGIN,production=process.env.NODE_ENV==='production'){
 const origins=(value??(production?'':'http://localhost:5173')).split(',').map(v=>v.trim()).filter(Boolean);
 if(!origins.length)throw new Error('WEB_ORIGIN is required');
 for(const origin of origins){
  let url:URL;try{url=new URL(origin);}catch{throw new Error('WEB_ORIGIN must contain exact origins');}
  if(url.origin!==origin||!['http:','https:'].includes(url.protocol)||(production&&url.protocol!=='https:'))throw new Error('WEB_ORIGIN must contain exact HTTPS origins in production');
 }
 return origins;
}
