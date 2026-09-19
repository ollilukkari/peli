import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { setupInstall } from '../src/pwa.js';

const source = setupInstall.toString();

function installation({ search = '?install=1', standalone = false } = {}) {
  function surface(properties = {}) {
    const listeners = new Map();
    return {
      hidden: false, disabled: false, textContent: '', ...properties,
      addEventListener(type, handler) { listeners.set(type, handler); },
      dispatch(type, event = {}) { return listeners.get(type)?.(event); },
    };
  }
  const window = surface({
    location: { search, href: `https://example.test/peli/${search}#game` },
    matchMedia: () => ({ matches: standalone }),
    history: { state: null, replaceState(_state, _title, url) { window.replacedUrl = String(url); } },
  });
  const ui = {
    menuButton: surface({ hidden: true }),
    screen: surface({ hidden: true }),
    installButton: surface({ disabled: true }), status: surface(), help: surface(),
    onPrompt() { ui.pauses = (ui.pauses ?? 0) + 1; },
  };
  vm.runInNewContext(`${source}\nsetupInstall(ui);`, { window, URL, URLSearchParams, ui });
  function offer({ outcome = 'accepted', error = false, choice } = {}) {
    const event = {
      calls: 0, prevented: false,
      preventDefault() { this.prevented = true; },
      async prompt() { this.calls++; if (error) throw new Error('Browser refused'); },
      userChoice: choice ?? Promise.resolve({ outcome }),
    };
    window.dispatch('beforeinstallprompt', event);
    return event;
  }
  return { window, ...ui, ui, offer };
}

test('install link opens its screen and waits for a real browser offer; normal link stays in game', () => {
  const app = installation();
  assert.equal(app.screen.hidden, false);
  assert.equal(app.installButton.disabled, true);
  assert.equal(app.help.hidden, false);
  assert.equal(installation({ search: '' }).screen.hidden, true);
});

test('installation needs a click and consumes each prompt only once', async () => {
  const app = installation();
  const offer = app.offer();
  assert.equal(offer.prevented, true);
  assert.equal(offer.calls, 0);
  assert.equal(app.installButton.disabled, false);
  assert.equal(app.menuButton.hidden, false);
  const first = app.installButton.dispatch('click');
  await app.installButton.dispatch('click');
  await first;
  assert.equal(offer.calls, 1);
  assert.equal(app.ui.pauses, 1);
  assert.match(app.status.textContent, /Asennus hyväksytty/);
  assert.equal(app.installButton.disabled, true);
  app.window.dispatch('appinstalled');
  assert.match(app.status.textContent, /Peli on asennettu/);
  assert.equal(app.installButton.hidden, true);
});

test('cancelled installation does not reuse an expired prompt and supports a new offer', async () => {
  const app = installation();
  const cancelled = app.offer({ outcome: 'dismissed' });
  await app.installButton.dispatch('click');
  assert.match(app.status.textContent, /peruttiin/);
  await app.installButton.dispatch('click');
  assert.equal(cancelled.calls, 1);
  const retry = app.offer();
  await app.installButton.dispatch('click');
  assert.equal(retry.calls, 1);
});

test('prompt errors show actionable help without an unhandled rejection', async () => {
  const app = installation();
  app.offer({ error: true });
  await app.installButton.dispatch('click');
  assert.match(app.status.textContent, /ei voitu avata/);
  assert.equal(app.help.hidden, false);
  assert.equal(app.installButton.disabled, true);
});

test('appinstalled before userChoice is not overwritten by the late result', async () => {
  const app = installation();
  let resolveChoice;
  app.offer({ choice: new Promise((resolve) => { resolveChoice = resolve; }) });
  const click = app.installButton.dispatch('click');
  app.window.dispatch('appinstalled');
  resolveChoice({ outcome: 'accepted' });
  await click;
  assert.match(app.status.textContent, /Peli on asennettu/);
});

test('installed standalone game skips install screen and ignores late install offers', () => {
  const app = installation({ standalone: true });
  assert.equal(app.screen.hidden, true);
  assert.equal(app.installButton.hidden, true);
  app.offer();
  assert.equal(app.menuButton.hidden, true);
});

test('other query parameters do not dismiss the install screen or rewrite the link', () => {
  const app = installation({ search: '?install=1&creature=test' });
  assert.equal(app.screen.hidden, false);
  assert.equal(app.window.replacedUrl, undefined);
});

test('existing game menu install button still uses the same native flow', async () => {
  const app = installation({ search: '' });
  const offer = app.offer();
  await app.menuButton.dispatch('click');
  assert.equal(offer.calls, 1);
  assert.equal(app.screen.hidden, true);
});
