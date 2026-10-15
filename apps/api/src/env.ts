import {config} from 'dotenv';
import {existsSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

// Locate the workspace root from source OR dist/src, independently of process.cwd().
let directory = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(directory, 'package-lock.json'))) {
  const parent = dirname(directory);
  if (parent === directory) throw new Error('Cannot locate workspace root for .env');
  directory = parent;
}
export const workspaceRoot = directory;
config({path: join(workspaceRoot, '.env')}); // Deployment environment always wins.
