import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Request,Response} from 'express';
import type {Server} from 'node:http';
import {adminAccess} from '../src/adminAccess.js';
import {readiness,lifecycle} from '../src/readiness.js';
import {shutdownHandler} from '../src/shutdown.js';
import {resolveUploadDirectory} from '../src/storage.js';
import {webOrigins} from '../src/runtimeConfig.js';
import {resolve} from 'node:path';

test('registrar access is a method/path allowlist, never an expanded admin role',()=>{
 for(const [method,path,allowed] of [['POST','/athletes',true],['POST','/uploads',true],['GET','/session',true],['GET','/lookups',true],['PATCH','/athletes/x',false],['DELETE','/athletes/x',false],['GET','/users',false],['POST','/matches/x/result',false],['POST','/rankings/recalculate',false],['POST','/events',false],['POST','/events/x/competition/w/playoff',false],['POST','/users',false],['POST','/athletes/x',false],['GET','/dashboard',false]] as const){
  let status=200,next=false;adminAccess({method,path,user:{id:'r',role:'REGISTRAR'}} as Request,{status:(v:number)=>{status=v;return {json:()=>{}};}} as Response,()=>{next=true;});assert.equal(next,allowed,method+' '+path);assert.equal(status,allowed?200:403);
 }
});
test('readiness is bounded, hides database errors and rejects draining',async()=>{
 async function probe(check:()=>Promise<unknown>){let status=200,body:unknown;await readiness(check,10)({} as Request,{status(v:number){status=v;return this;},json(v:unknown){body=v;}} as Response,()=>{});return {status,body};}
 assert.deepEqual(await probe(async()=>1),{status:200,body:{status:'ready'}});
 assert.deepEqual(await probe(async()=>{throw new Error('private connection string');}),{status:503,body:{status:'unavailable'}});
 assert.equal((await probe(()=>new Promise(()=>{}))).status,503);
 lifecycle.draining=true;assert.equal((await probe(async()=>1)).status,503);lifecycle.draining=false;
});
test('shutdown drains HTTP before disconnecting Prisma and is idempotent',async()=>{
 const calls:string[]=[];let finish!:()=>void;let resolveExit!:()=>void;const done=new Promise<void>(r=>resolveExit=r);
 const server={close(cb:()=>void){calls.push('close');finish=cb;},closeIdleConnections(){calls.push('idle');},closeAllConnections(){calls.push('force');}} as unknown as Server;
 const stop=shutdownHandler(server,async()=>{calls.push('disconnect');},code=>{assert.equal(code,0);calls.push('exit');resolveExit();});
 stop();stop();assert.equal(lifecycle.draining,true);assert.deepEqual(calls,['close','idle']);finish();await done;assert.deepEqual(calls,['close','idle','disconnect','exit']);lifecycle.draining=false;
});
test('production requires persistent storage path and exact HTTPS origins',()=>{
 assert.throws(()=>resolveUploadDirectory('',true));assert.throws(()=>resolveUploadDirectory('relative',true));assert.equal(resolveUploadDirectory(resolve('.local/test-uploads'),true),resolve('.local/test-uploads'));
 assert.deepEqual(webOrigins('https://kfl.example, https://preview.example',true),['https://kfl.example','https://preview.example']);
 for(const value of ['', '*','http://localhost:5173','https://kfl.example/path'])assert.throws(()=>webOrigins(value,true));
});
