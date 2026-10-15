import '../src/env.js';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const require = createRequire(import.meta.url);
const command = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), ...process.argv.slice(2)], {
  cwd: fileURLToPath(new URL('../', import.meta.url)), env: process.env, stdio: 'inherit',
});
if (command.error) throw command.error;
process.exitCode = command.status ?? 1;
