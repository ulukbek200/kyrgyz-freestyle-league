import './env.js';
import {app} from './index.js';
import {jwtSecret} from './auth.js';
import {prisma} from './db.js';
import {shutdownHandler} from './shutdown.js';
import {mkdir,access} from 'node:fs/promises';
import {constants} from 'node:fs';
import {uploadDirectory} from './storage.js';

jwtSecret();
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const port = Number(process.env.PORT) || 4000;
await mkdir(uploadDirectory,{recursive:true});
await access(uploadDirectory,constants.R_OK|constants.W_OK);
const server=app.listen(port,'0.0.0.0', () => console.log(`KFL API listening on ${port}`));
const shutdown=shutdownHandler(server,()=>prisma.$disconnect(),code=>process.exit(code));
process.once('SIGTERM',shutdown);
process.once('SIGINT',shutdown);
