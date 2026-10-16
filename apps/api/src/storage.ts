import {isAbsolute,resolve} from 'node:path';
import {workspaceRoot} from './env.js';

export function resolveUploadDirectory(value=process.env.UPLOAD_DIR,production=process.env.NODE_ENV==='production',ephemeralFlag=process.env.ALLOW_EPHEMERAL_UPLOADS,warn:(message:string)=>void=console.warn){
 const ephemeral=ephemeralFlag==='true';
 const temporaryPath=resolve('/tmp/kfl-uploads');
 if(ephemeral){
  if(!value||!isAbsolute(value)||resolve(value)!==temporaryPath)throw new Error('ALLOW_EPHEMERAL_UPLOADS requires UPLOAD_DIR=/tmp/kfl-uploads for test deployments only');
  warn('WARNING: ALLOW_EPHEMERAL_UPLOADS=true enables temporary test storage. Uploaded photos may be permanently lost on restart, redeploy or instance replacement. Do not use for real athlete data.');
  return temporaryPath;
 }
 if(production&&(!value||!isAbsolute(value)))throw new Error('Production requires an absolute UPLOAD_DIR on persistent storage');
 if(production&&value&&resolve(value)===temporaryPath)throw new Error('Temporary test storage requires ALLOW_EPHEMERAL_UPLOADS=true');
 return value?resolve(value):resolve(workspaceRoot,'.local','uploads');
}
export const uploadDirectory=resolveUploadDirectory();
