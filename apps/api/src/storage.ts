import {isAbsolute,resolve} from 'node:path';
import {workspaceRoot} from './env.js';

export function resolveUploadDirectory(value=process.env.UPLOAD_DIR,production=process.env.NODE_ENV==='production'){
 if(production&&(!value||!isAbsolute(value)))throw new Error('Production requires an absolute UPLOAD_DIR on persistent storage');
 return value?resolve(value):resolve(workspaceRoot,'.local','uploads');
}
export const uploadDirectory=resolveUploadDirectory();
