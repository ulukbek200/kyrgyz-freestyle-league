import type {Request,Response,NextFunction} from 'express';
import jwt from 'jsonwebtoken';
import {createHmac,timingSafeEqual} from 'node:crypto';
import {prisma} from './db.js';
export type SessionUser={id:string;role:'ADMIN'|'REGISTRAR'|'MODERATOR'|'ATHLETE'};
export type AuthUser=SessionUser & {passwordHash:string;sessionVersion:number;isBlocked:boolean};
declare global {namespace Express {interface Request {user?:SessionUser}}}
export function jwtSecret(): string {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32 || value.startsWith('replace-')) {
    throw new Error('JWT_SECRET must be a random secret of at least 32 characters');
  }
  return value;
}
// A keyed digest revokes sessions on password change without exposing its hash.
function sessionKey(user:AuthUser){return createHmac('sha256',jwtSecret()).update(JSON.stringify([user.id,user.passwordHash,user.sessionVersion])).digest('hex');}
export const signToken = (user: AuthUser) => jwt.sign({id:user.id,role:user.role,session:sessionKey(user)}, jwtSecret(), {
  algorithm: 'HS256', expiresIn: '8h', issuer: 'nomad-league',
});
export function createAuthenticate(findUser:(id:string)=>Promise<AuthUser|null>){
 return async function(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.match(/^Bearer\s+(\S+)\s*$/i)?.[1];
  if (!token) return res.status(401).json({error: 'Authentication required'});
  let payload:jwt.JwtPayload;
  try {
    const decoded = jwt.verify(token, jwtSecret(), {algorithms: ['HS256'], issuer: 'nomad-league'});
    if (typeof decoded === 'string' || typeof decoded.id !== 'string' || !decoded.id ||
        !['ADMIN', 'REGISTRAR', 'MODERATOR', 'ATHLETE'].includes(decoded.role) || typeof decoded.exp !== 'number'||typeof decoded.session!=='string'||!/^[a-f0-9]{64}$/.test(decoded.session)) {
      return res.status(401).json({error: 'Session expired'});
    }
    payload=decoded;
  } catch {
    return res.status(401).json({error: 'Session expired'});
  }
  try{
    const user=await findUser(payload.id);
    if(!user||user.isBlocked||!timingSafeEqual(Buffer.from(payload.session,'hex'),Buffer.from(sessionKey(user),'hex')))return res.status(401).json({error:'Session expired'});
    req.user={id:user.id,role:user.role};
    next();
  }catch(error){next(error);}
 };
}
export const authenticate=createAuthenticate(id=>prisma.user.findUnique({where:{id}}));
export function allow(...roles:SessionUser['role'][]){return(req:Request,res:Response,next:NextFunction)=>{if(!req.user||!roles.includes(req.user.role))return res.status(403).json({error:'Insufficient permissions'});next()}}
