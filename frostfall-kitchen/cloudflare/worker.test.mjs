import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import worker from '../dist/worker.mjs';

const fetch = (path, options) => worker.fetch(new Request(`https://frostfall.test${path}`, options));
const file = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('root and direct works routes load the same settlement with valid asset URLs', async () => {
  const root = await fetch('/');
  assert.equal(root.status, 200);
  assert.match(root.headers.get('Content-Security-Policy'), /script-src 'self'; base-uri 'self'/);
  const rootPage = await root.text();
  assert.match(rootPage, /<base href="\/works\/">/);
  const direct = await fetch('/works/');
  assert.equal(direct.status, 200);
  assert.equal(await direct.text(), await file('works/index.html'));
  assert.equal(rootPage.replace('<base href="/works/">', ''), await file('works/index.html'));
});

test('classic keeps its browser save key and loads the same-origin Three.js library', async () => {
  const response = await fetch('/classic/');
  assert.equal(response.status, 200);
  const page = await response.text();
  assert.equal(page, (await file('index.html')).replace(
    'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
    '/works/vendor/three.min.js'
  ));
  assert.match(page, /frostfall-kitchen-mill-v1/);
  assert.match(response.headers.get('Content-Security-Policy'), /script-src 'self' 'unsafe-inline'/);
});

test('assets have the expected MIME type and match their source', async () => {
  for (const [path, mime] of [
    ['styles.css', 'text/css'],
    ['main.mjs', 'text/javascript'],
    ['engine.mjs', 'text/javascript'],
    ['save.mjs', 'text/javascript'],
    ['world.mjs', 'text/javascript'],
    ['vendor/three.min.js', 'text/javascript'],
    ['vendor/LICENSE', 'text/plain']
  ]) {
    const response = await fetch(`/works/${path}`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Type'), `${mime}; charset=utf-8`);
    assert.equal(await response.text(), await file(`works/${path}`));
    assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  }
});

test('redirects preserve query strings and unserved routes stay closed', async () => {
  const redirect = await fetch('/classic?mode=test');
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.get('Location'), '/classic/?mode=test');
  assert.equal((await fetch('/works/test.mjs')).status, 404);
  const unsupported = await fetch('/', { method: 'POST' });
  assert.equal(unsupported.status, 405);
  assert.equal(unsupported.headers.get('Allow'), 'GET, HEAD');
});

test('HEAD and conditional GET omit response bodies', async () => {
  const head = await fetch('/works/styles.css', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  const etag = head.headers.get('ETag');
  assert.ok(etag);
  const cached = await fetch('/works/styles.css', {
    headers: { 'If-None-Match': `"old", W/${etag}` }
  });
  assert.equal(cached.status, 304);
  assert.equal(await cached.text(), '');
});
