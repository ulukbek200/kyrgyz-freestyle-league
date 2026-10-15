import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';

test('environment resolves the same root from root and API cwd; process variables win', () => {
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const module = new URL('../src/env.ts', import.meta.url).href;
  const source = `import {workspaceRoot} from ${JSON.stringify(module)}; console.log(JSON.stringify({root:workspaceRoot,secret:process.env.JWT_SECRET}));`;
  for (const cwd of [root, join(root, 'apps/api')]) {
    const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', source], {
      cwd, encoding: 'utf8', env: {...process.env, JWT_SECRET: 'test-process-secret'},
    });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout.trim()), {root: root.replace(/[\\/]$/, ''), secret: 'test-process-secret'});
  }
});
