import {test} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {once} from 'node:events';
import type {AddressInfo} from 'node:net';
import {configureProxy,loginLimiters} from '../src/loginSecurity.js';
import {bannerUrlSchema} from '../src/bannerUrl.js';

test('banner URL accepts uploads and http(s), rejects malformed/unsafe URLs',()=>{
 for(const value of ['http://','https://','javascript:alert(1)','//example.com/a','https://user:pass@example.com/a','https://exa mple.com','http:\\example.com'])assert.equal(bannerUrlSchema.safeParse(value).success,false,value);
 for(const value of [null,undefined,'https://example.com/photo.jpg','http://localhost:4400/a','/uploads/abc-123.webp'])assert.equal(bannerUrlSchema.safeParse(value).success,true);
});

test('login limits normalized account across IPs, limits IP across accounts, respects trusted proxy only',async()=>{
 const app=express();configureProxy(app,'loopback');app.use(express.json());
 app.post('/login',...loginLimiters({ipLimit:4,accountLimit:2}),(_q,r)=>r.status(401).json({error:'Invalid request'}));
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');
 const send=(email:string,ip:string)=>fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/login`,{method:'POST',headers:{'Content-Type':'application/json','X-Forwarded-For':ip},body:JSON.stringify({email})});
 try{
  assert.equal((await send('A@example.invalid','192.0.2.1')).status,401);
  assert.equal((await send(' a@EXAMPLE.invalid ','192.0.2.2')).status,401);
  const account=await send('a@example.invalid','192.0.2.3');assert.equal(account.status,429);assert.ok(account.headers.get('retry-after'));
  for(let i=0;i<4;i++)assert.equal((await send(`other${i}@example.invalid`,'192.0.2.10')).status,401);
  assert.equal((await send('fresh@example.invalid','192.0.2.10')).status,429);
  assert.equal(app.get('trust proxy fn')('198.51.100.1'),false);
  configureProxy(app,'');assert.equal(app.get('trust proxy'),false);
  for(const value of ['true','1','0.0.0.0/0','::/0'])assert.throws(()=>configureProxy(app,value));
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
