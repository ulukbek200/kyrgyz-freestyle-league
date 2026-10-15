import type {PrismaClient} from '@prisma/client';
import bcrypt from 'bcryptjs';
import {z} from 'zod';

const input=z.object({email:z.string().trim().email().transform(v=>v.toLowerCase()),password:z.string().min(16).max(200),database:z.string().min(1),confirmation:z.literal('CREATE_FIRST_ADMIN')});
export async function bootstrapFirstAdmin(db:PrismaClient,raw:unknown){
 const values=input.parse(raw);
 return db.$transaction(async tx=>{
  const [identity]=await tx.$queryRaw<{name:string}[]>`SELECT current_database() AS name`;
  if(identity.name!==values.database)throw new Error('Database identity does not match BOOTSTRAP_DATABASE');
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(734621909)`;
  const existing=await tx.user.findUnique({where:{email:values.email}});
  if(existing){if(existing.role==='ADMIN')return {created:false};throw new Error('Existing account will not be promoted or overwritten');}
  if(await tx.user.count({where:{role:'ADMIN'}}))throw new Error('An administrator already exists; use user management');
  const user=await tx.user.create({data:{email:values.email,passwordHash:await bcrypt.hash(values.password,12),role:'ADMIN'}});
  await tx.auditLog.create({data:{userId:user.id,action:'BOOTSTRAP_ADMIN',entity:'User',entityId:user.id}});
  return {created:true};
 },{maxWait:5000,timeout:15000});
}
