import {test} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {once} from 'node:events';
import type {AddressInfo} from 'node:net';
import {asyncHandler, errorHandler, HttpError} from '../src/http.js';

test('Express 4 forwards rejected promises and hides internal errors over HTTP', async () => {
  const app = express();
  app.get('/failure', asyncHandler(async () => {await Promise.resolve(); throw new Error('private database password');}));
  app.get('/expected', asyncHandler(async () => {throw new HttpError(400, 'No suitable weight class');}));
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const response = await fetch(url + '/failure');
    assert.equal(response.status, 500); assert.deepEqual(await response.json(), {error: 'Invalid request'});
    const expected = await fetch(url + '/expected');
    assert.equal(expected.status, 400); assert.deepEqual(await expected.json(), {error: 'No suitable weight class'});
  } finally {server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve()));}
});
