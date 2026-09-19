import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const TRACKS = ['frozen-minor.mp3', 'summer-platformer.mp3', 'kalm-mjork.mp3', 'zab-petting.mp3'];
const AUDIO_BYTES = Uint8Array.from({ length: 16 }, (_, index) => index * 13);

function worker({ path = '/peli/', missing = null, audioBytes = AUDIO_BYTES } = {}) {
  const root = new URL(path, 'https://example.test');
  const handlers = new Map();
  const stores = new Map();
  const downloads = [];
  const deleted = [];
  let claims = 0;
  let skips = 0;
  let unexpectedFetches = 0;
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const entries = stores.get(name);
      return {
        async addAll(requests) {
          const pending = requests.map((request) => {
            downloads.push(request);
            assert.equal(request.cache, 'reload');
            if (missing && new URL(request.url).pathname.endsWith(missing)) {
              throw new TypeError('Precache resource unavailable');
            }
            const audio = request.url.endsWith('.mp3');
            return [request.url, new Response(audio ? audioBytes : `cached:${request.url}`, {
              headers: { 'Content-Type': audio ? 'audio/mpeg' : 'text/plain',
                'Content-Length': String(audio ? audioBytes.length : 1), 'X-Release-Fixture': 'cached' },
            })];
          });
          for (const [url, response] of pending) entries.set(url, response);
        },
        async match(key) { return entries.get(typeof key === 'string' ? key : key.url)?.clone(); },
      };
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { deleted.push(name); return stores.delete(name); },
  };
  const sandbox = vm.createContext({
    URL, Request, Response, Headers, caches,
    fetch() { unexpectedFetches++; throw new Error('Network must not be used for cached release files'); },
    self: {
      location: { href: new URL('sw.js', root).href },
      addEventListener(type, handler) { handlers.set(type, handler); },
      clients: { async claim() { claims++; } },
      async skipWaiting() { skips++; },
    },
  });
  vm.runInContext(source, sandbox, { filename: 'sw.js' });

  async function dispatch(type, properties = {}) {
    const promises = [];
    handlers.get(type)({ ...properties, waitUntil(promise) { promises.push(promise); } });
    await Promise.all(promises);
  }
  async function fetchFile(file, { range, method = 'GET', absolute = false } = {}) {
    const headers = range === undefined ? {} : { Range: range };
    const request = new Request(absolute ? file : new URL(file, root), { method, headers });
    let promise;
    handlers.get('fetch')({ request, respondWith(response) { promise = Promise.resolve(response); } });
    return promise ? await promise : null;
  }
  async function offlineStatus() {
    let status;
    await dispatch('message', { data: { type: 'GET_OFFLINE_STATUS' },
      ports: [{ postMessage(message) { status = message; } }] });
    return status;
  }
  return { root, stores, downloads, deleted, dispatch, fetchFile, offlineStatus,
    get claims() { return claims; }, get skips() { return skips; },
    get unexpectedFetches() { return unexpectedFetches; } };
}

async function installed(options) {
  const app = worker(options);
  await app.dispatch('install');
  return app;
}

test('a complete offline release precaches every MP3 under the project path', async () => {
  for (const path of ['/', '/peli/', '/games/ponppu/']) {
    const app = await installed({ path });
    const urls = app.downloads.map((request) => request.url);
    for (const track of TRACKS) assert.ok(urls.includes(new URL(`assets/audio/${track}`, app.root).href));
    assert.ok(urls.every((url) => url.startsWith(app.root.href)));
    assert.equal((await app.offlineStatus()).ready, true);
    assert.equal(app.skips, 0, 'installation must wait for the explicit update action');
    for (const track of TRACKS) {
      const response = await app.fetchFile(`assets/audio/${track}`);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('Content-Type'), 'audio/mpeg');
      assert.equal(response.headers.get('X-Release-Fixture'), 'cached');
      assert.equal(response.headers.get('Content-Range'), null);
      assert.deepEqual(new Uint8Array(await response.arrayBuffer()), AUDIO_BYTES);
    }
    assert.equal(app.unexpectedFetches, 0);
  }
});

test('combo webfont and its license are available offline under the deployed project path', async () => {
  const app = await installed({ path: '/peli/' });
  for (const file of ['assets/fonts/caprasimo-latin.woff2', 'assets/fonts/OFL.txt']) {
    assert.ok(app.downloads.some((request) => request.url === new URL(file, app.root).href));
    const response = await app.fetchFile(file);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('X-Release-Fixture'), 'cached');
  }
  assert.equal(app.unexpectedFetches, 0);
  const incomplete = worker({ missing: 'caprasimo-latin.woff2' });
  await assert.rejects(incomplete.dispatch('install'), /Precache resource unavailable/);
});

test('offline audio serves exact prefix, middle, open-ended and suffix bytes', async () => {
  const app = await installed();
  for (const [range, start, end] of [
    ['bytes=0-0', 0, 0], ['bytes=0-4', 0, 4], ['bytes=4-10', 4, 10],
    ['bytes=12-', 12, 15], ['bytes=-5', 11, 15], ['bytes=-99', 0, 15],
    ['bytes=13-999', 13, 15], ['bytes=0-', 0, 15],
  ]) {
    for (const track of TRACKS) {
      const response = await app.fetchFile(`assets/audio/${track}?version=ignored`, { range });
      assert.equal(response.status, 206, range);
      assert.equal(response.headers.get('Content-Range'), `bytes ${start}-${end}/${AUDIO_BYTES.length}`);
      assert.equal(response.headers.get('Content-Length'), String(end - start + 1));
      assert.equal(response.headers.get('Accept-Ranges'), 'bytes');
      assert.equal(response.headers.get('Content-Type'), 'audio/mpeg');
      assert.deepEqual(new Uint8Array(await response.arrayBuffer()), AUDIO_BYTES.slice(start, end + 1));
    }
  }
  // Reading ranges must not consume or replace the original complete response.
  const complete = await app.fetchFile(`assets/audio/${TRACKS[0]}`);
  assert.equal(complete.status, 200);
  assert.deepEqual(new Uint8Array(await complete.arrayBuffer()), AUDIO_BYTES);
  assert.equal(app.unexpectedFetches, 0);
});

test('invalid and unsatisfiable audio ranges return an empty 416 response', async () => {
  const app = await installed();
  for (const range of [
    '', 'bytes=', 'bytes=-', 'bytes=-0', 'bytes=16-', 'bytes=99-100', 'bytes=8-7',
    'bytes=0-1,4-5', 'bytes=one-two', 'items=0-2', 'bytes=1.5-3',
    'bytes=-1-4', 'bytes=9007199254740992-', 'bytes=0-9007199254740992',
  ]) {
    const response = await app.fetchFile(`assets/audio/${TRACKS[0]}`, { range });
    assert.equal(response.status, 416, range);
    assert.equal(response.headers.get('Content-Range'), `bytes */${AUDIO_BYTES.length}`);
    assert.equal(response.headers.get('Content-Length'), '0');
    assert.equal(response.headers.get('Accept-Ranges'), 'bytes');
    assert.equal(response.headers.get('Content-Type'), 'audio/mpeg');
    assert.equal((await response.arrayBuffer()).byteLength, 0);
  }
});

test('an empty cached audio file has no satisfiable range', async () => {
  const app = await installed({ audioBytes: new Uint8Array() });
  for (const range of ['bytes=0-', 'bytes=-1', 'bytes=0-0']) {
    const response = await app.fetchFile(`assets/audio/${TRACKS[0]}`, { range });
    assert.equal(response.status, 416);
    assert.equal(response.headers.get('Content-Range'), 'bytes */0');
  }
});

test('range handling preserves coherent documents and excludes unrelated requests', async () => {
  const app = await installed();
  for (const file of ['', 'index.html?fresh=1', 'src/main.js', 'style.css']) {
    const response = await app.fetchFile(file, { range: 'bytes=0-4' });
    assert.equal(response.status, 200, file);
    assert.equal(response.headers.get('Content-Range'), null);
    const expected = new URL(file.startsWith('index.html') || file === '' ? 'index.html' : file, app.root);
    assert.equal(await response.text(), `cached:${expected.href}`);
  }
  for (const request of [
    ['assets/audio/unknown.mp3', {}],
    ['assets/audio/frozen-minor.mp3', { method: 'POST' }],
    ['https://other.test/peli/assets/audio/frozen-minor.mp3', { absolute: true }],
    ['https://example.test/elsewhere/assets/audio/frozen-minor.mp3', { absolute: true }],
    ['https://example.test/peli-other/assets/audio/frozen-minor.mp3', { absolute: true }],
  ]) assert.equal(await app.fetchFile(...request), null);
  assert.equal(app.unexpectedFetches, 0);
});

test('missing cached music makes offline status false and never mixes in network files', async () => {
  const app = await installed();
  const store = [...app.stores.values()][0];
  store.delete(new URL(`assets/audio/${TRACKS[1]}`, app.root).href);
  assert.equal((await app.offlineStatus()).ready, false);
  for (const range of [undefined, 'bytes=0-4']) {
    const response = await app.fetchFile(`assets/audio/${TRACKS[1]}`, { range });
    assert.equal(response.status, 503);
    assert.match(await response.text(), /offline-tiedosto puuttuu/);
  }
  assert.equal(app.unexpectedFetches, 0);
});

test('an unavailable music file rejects the complete release installation', async () => {
  for (const missing of TRACKS) {
    const app = worker({ missing });
    await assert.rejects(app.dispatch('install'), /Precache resource unavailable/);
    assert.equal((await app.offlineStatus()).ready, false);
    assert.equal(app.skips, 0);
    assert.equal(app.claims, 0);
  }
});

test('activation removes only older releases for this project and update remains explicit', async () => {
  const app = await installed();
  const currentName = [...app.stores.keys()][0];
  const prefix = `ponppu:${encodeURIComponent(app.root.pathname)}:`;
  const oldName = `${prefix}older-release`;
  const otherProject = `ponppu:${encodeURIComponent('/another-game/')}:older-release`;
  app.stores.set(oldName, new Map());
  app.stores.set(otherProject, new Map());
  app.stores.set('unrelated-cache', new Map());
  await app.dispatch('activate');
  assert.deepEqual(app.deleted, [oldName]);
  assert.ok(app.stores.has(currentName));
  assert.ok(app.stores.has(otherProject));
  assert.ok(app.stores.has('unrelated-cache'));
  assert.equal(app.claims, 1);
  assert.equal(app.skips, 0);
  await app.dispatch('message', { data: { type: 'SKIP_WAITING' } });
  assert.equal(app.skips, 1);
});
