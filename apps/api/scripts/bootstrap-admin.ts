import '../src/env.js';
import {prisma} from '../src/db.js';
import {bootstrapFirstAdmin} from '../src/bootstrapAdmin.js';

try{
 const result=await bootstrapFirstAdmin(prisma,{email:process.env.BOOTSTRAP_ADMIN_EMAIL,password:process.env.BOOTSTRAP_ADMIN_PASSWORD,database:process.env.BOOTSTRAP_DATABASE,confirmation:process.env.BOOTSTRAP_CONFIRM});
 console.log(result.created?'First administrator created.':'Administrator already exists; nothing changed.');
}catch(error){console.error(error instanceof Error&&error.name!=='ZodError'&&!error.name.startsWith('Prisma')?error.message:'Bootstrap failed. Check inputs and database connection; no credentials are logged.');process.exitCode=1;}
finally{delete process.env.BOOTSTRAP_ADMIN_PASSWORD;await prisma.$disconnect();}
