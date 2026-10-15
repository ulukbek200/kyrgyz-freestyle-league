import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Request, Response} from 'express';
import jwt from 'jsonwebtoken';
import {createAuthenticate, type AuthUser, allow, signToken, jwtSecret} from '../src/auth.js';

process.env.JWT_SECRET = 'test-only-secret-with-at-least-thirty-two-characters';
const user:AuthUser={id:'admin',role:'ADMIN',passwordHash:'hash',sessionVersion:0,isBlocked:false};
async function check(header?: string,current:AuthUser|null=user) {
  const req = {headers: {authorization: header}} as Request;
  const result = {status: 200, next: false, body: undefined as unknown};
  const res = {status(code: number) {result.status = code; return this;}, json(body: unknown) {result.body = body; return this;}} as Response;
  await createAuthenticate(async()=>current)(req, res, async () => {result.next = true;});
  return {req, res, result};
}
test('valid Bearer token authenticates and ADMIN is authorized', async () => {
  const {req, res, result} = await check(`Bearer ${signToken(user)}`);
  assert.equal(result.next, true);
  assert.deepEqual(req.user, {id: 'admin', role: 'ADMIN'});
  let allowed = false;
  allow('ADMIN')(req, res, async () => {allowed = true;});
  assert.equal(allowed, true);
});
test('scheme is case insensitive and whitespace is accepted', async () => {
  assert.equal((await check(`bearer\t${signToken(user)} `)).result.next, true);
});
for (const [name, header] of [['missing', undefined], ['empty', 'Bearer '], ['invalid', 'Bearer invalid'], ['wrong scheme', 'Basic abc'], ['extra text', 'Bearer abc def']]) {
  test(`${name} token returns 401`, async () => {
    const {result} = await check(header);
    assert.equal(result.status, 401); assert.equal(result.next, false);
  });
}
test('expired, wrong-signature, wrong-issuer and wrong-algorithm tokens are rejected', async () => {
  const payload = {id: 'admin', role: 'ADMIN',session:(jwt.decode(signToken(user)) as jwt.JwtPayload).session};
  const tokens = [
    jwt.sign(payload, jwtSecret(), {expiresIn: -1, issuer: 'nomad-league'}),
    jwt.sign(payload, 'another-secret', {expiresIn: '8h', issuer: 'nomad-league'}),
    jwt.sign(payload, jwtSecret(), {expiresIn: '8h', issuer: 'other'}),
    jwt.sign(payload, jwtSecret(), {expiresIn: '8h', issuer: 'nomad-league', algorithm: 'HS384'}),
    jwt.sign(payload, jwtSecret(), {issuer: 'nomad-league'}),
    jwt.sign({id: 'a', role: 'ROOT'}, jwtSecret(), {expiresIn: '8h', issuer: 'nomad-league'}),
  ];
  for (const token of tokens) assert.equal((await check(`Bearer ${token}`)).result.status, 401);
});
test('insufficient permissions return 403', async () => {
  for (const role of ['ATHLETE', 'MODERATOR'] as const) {
    const {req, res, result} = await check(`Bearer ${signToken({...user,role})}`,{...user,role});
    let allowed = false;
    allow('ADMIN')(req, res, async () => {allowed = true;});
    assert.equal(result.status, 403); assert.equal(allowed, false);
  }
});
test('there is no fallback JWT secret', async () => {
  const old = process.env.JWT_SECRET;
  try {delete process.env.JWT_SECRET; assert.throws(jwtSecret);} finally {process.env.JWT_SECRET = old;}
});

test('current role replaces signed ADMIN role; missing, blocked and revoked users fail closed',async()=>{
 const token=`Bearer ${signToken(user)}`;
 const {req,res,result}=await check(token,{...user,role:'ATHLETE'});
 allow('ADMIN')(req,res,()=>assert.fail('Former administrator authorized'));
 assert.equal(result.status,403);
 for(const current of [null,{...user,isBlocked:true},{...user,passwordHash:'new hash'},{...user,sessionVersion:1}])assert.equal((await check(token,current)).result.status,401);
 const legacy=jwt.sign({id:user.id,role:user.role},jwtSecret(),{issuer:'nomad-league',expiresIn:'8h'});
 assert.equal((await check(`Bearer ${legacy}`)).result.status,401);
});

test('authentication forwards database failures to Express error handler',async()=>{
 const failure=new Error('Database unavailable');let error:unknown;
 await createAuthenticate(async()=>{throw failure;})({headers:{authorization:`Bearer ${signToken(user)}`}} as Request,{} as Response,e=>{error=e;});
 assert.equal(error,failure);
});
