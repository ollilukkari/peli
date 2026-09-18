import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as core from '../src/game.js';

// Execute the application's actual event handlers with the real simulation.
// Only browser services (DOM, rendering, audio, storage and PWA) are replaced.
const mainSource = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
  .replace(/^import .+;\r?\n/gm, '');

function application({ autoStart = true, storedSettings = null } = {}) {
  class Element {
    constructor(isControl = false) {
      this.isControl = isControl;
      this.listeners = new Map();
      this.dataset = {};
      this.captures = new Set();
      this.attributes = new Map();
      this.children = [];
      this.open = false;
    }
    addEventListener(type, listener) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(listener);
    }
    dispatch(type, properties = {}) {
      const event = {
        target: this, repeat: false, defaultPrevented: false,
        preventDefault() { this.defaultPrevented = true; }, ...properties,
      };
      for (const listener of this.listeners.get(type) ?? []) listener(event);
      return event;
    }
    closest() { return this.isControl ? this : null; }
    setAttribute(name, value) { this.attributes.set(name, value); }
    append(...children) { this.children.push(...children); }
    cloneNode(deep) {
      assert.equal(deep, true, 'help needs the complete guide, including its content');
      const clone = new Element(this.isControl);
      clone.textContent = this.textContent;
      clone.copiedFrom = this;
      clone.append(...this.children.map((child) => child.cloneNode(true)));
      return clone;
    }
    showModal() { this.open = true; }
    close() { this.open = false; this.dispatch('close'); }
    focus() { document.activeElement = this; }
    getContext() { return {}; }
    getBoundingClientRect() { return { left: 10, top: 20, width: core.WIDTH, height: core.HEIGHT }; }
    setPointerCapture(id) { this.captures.add(id); }
    hasPointerCapture(id) { return this.captures.has(id); }
    releasePointerCapture(id) { this.captures.delete(id); }
  }
  const elements = new Map();
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, new Element(['#start', '#sound', '#music', '#resume', '#help-open', '#help-close'].includes(id)));
    return elements.get(id);
  };
  const themeButtons = new Map(['meadow', 'autumn', 'winter'].map((theme) => {
    const button = new Element(true);
    button.dataset.themeChoice = theme;
    return [theme, button];
  }));
  const document = Object.assign(new Element(), {
    hidden: false,
    body: new Element(),
    documentElement: { style: {} },
    querySelector: element,
    querySelectorAll: (selector) => selector === '[data-theme-choice]' ? [...themeButtons.values()] : [],
  });
  const window = new Element();
  element('.intro').textContent = 'Shared desktop movement instructions';
  element('.field-guide').textContent = 'Shared desktop item instructions';
  const storage = new Map();
  if (storedSettings) storage.set('ponppu.settings.v1', JSON.stringify(storedSettings));
  const audioScenes = [];
  const musicChanges = [];
  const effectChanges = [];
  const context = vm.createContext({
    ...core, Element, document, window,
    matchMedia: () => Object.assign(new Element(), { matches: false }),
    localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    crypto: { getRandomValues: (values) => { values[0] = 42; return values; } },
    GameAudio: class {
      unlock() {} play() {}
      setEnabled(value) { effectChanges.push(value); }
      setScene(theme, phase) { audioScenes.push({ theme, phase }); }
      setMusicEnabled(value) { musicChanges.push(value); }
    },
    setupPwa: () => ({ applyUpdate: async () => false }),
    drawGame() {}, requestAnimationFrame() {},
  });
  vm.runInContext(mainSource, context, { filename: 'src/main.js' });
  if (autoStart) element('#start').dispatch('click');
  const canvas = element('#game');
  const inspect = (expression) => vm.runInContext(expression, context);
  return {
    document, window, element, canvas, inspect, themeButtons, audioScenes, musicChanges, effectChanges,
    savedSettings: () => JSON.parse(storage.get('ponppu.settings.v1')),
    get game() { return inspect('game'); },
    axis: () => inspect('getAxis()'),
    trap() {
      const game = inspect('game');
      game.player.state = 'trapped';
      game.player.platformId = game.platforms[0].id;
      game.trapTaps = 0;
      game.events.push({ type: 'trap' });
      inspect('processEvents(); refreshUi()');
    },
    key(type, code, options = {}) {
      const event = window.dispatch(type, { code, target: document.activeElement, ...options });
      // Native dialogs dispatch cancel on an unconsumed Escape key.
      if (type === 'keydown' && code === 'Escape' && !event.defaultPrevented && element('#help-dialog').open) {
        element('#help-dialog').dispatch('cancel');
      }
      return event;
    },
    pointer(type, id, x = 120, y = 480, target = canvas) {
      return target.dispatch(type, { pointerId: id, pointerType: 'touch', clientX: x + 10, clientY: y + 20 });
    },
  };
}

test('four arrow presses free the bunny and the freeing key cannot steer until released', () => {
  const app = application();
  app.trap();
  for (const code of ['ArrowUp', 'ArrowLeft', 'ArrowDown']) {
    assert.equal(app.key('keydown', code).defaultPrevented, true);
    app.key('keyup', code);
  }
  assert.equal(app.game.trapTaps, 3);
  assert.equal(app.game.player.state, 'trapped');
  app.key('keydown', 'ArrowRight');
  assert.equal(app.game.trapTaps, 4);
  assert.equal(app.game.player.state, 'air');
  assert.ok(app.game.player.vy > 0);
  assert.equal(app.axis(), 0);
  app.key('keydown', 'ArrowRight', { repeat: true });
  assert.equal(app.axis(), 0, 'holding the freeing key must not start movement');
  app.key('keyup', 'ArrowRight');
  app.key('keydown', 'ArrowRight');
  assert.equal(app.axis(), 1);
});

test('holding a trap key counts once, including duplicate non-repeat keydown events', () => {
  const app = application();
  app.trap();
  app.key('keydown', 'Space');
  for (let index = 0; index < 8; index++) app.key('keydown', 'Space', { repeat: true });
  app.key('keydown', 'Space');
  assert.equal(app.game.trapTaps, 1);
  app.key('keyup', 'Space');
  app.key('keydown', 'Space');
  assert.equal(app.game.trapTaps, 2);
});

test('Space on a focused button keeps its native activation and does not consume a trap tap', () => {
  const app = application();
  app.trap();
  app.element('#sound').focus();
  const event = app.key('keydown', 'Space');
  assert.equal(event.defaultPrevented, false);
  assert.equal(app.game.trapTaps, 0);
  app.key('keyup', 'Space');
  app.canvas.focus();
  app.key('keydown', 'Space');
  assert.equal(app.game.trapTaps, 1);
});

test('a lower-half joystick continues above its start area and ends on pointerup outside the canvas', () => {
  const app = application();
  app.pointer('pointerdown', 1, 100, 480);
  assert.equal(app.canvas.hasPointerCapture(1), true);
  app.pointer('pointermove', 1, 220, 100);
  assert.equal(app.axis(), 1);
  assert.equal(app.inspect('joystick.y'), 480);
  app.pointer('pointerdown', 2, 240, 490);
  app.pointer('pointermove', 2, 10, 500);
  assert.equal(app.axis(), 1, 'a second finger must not hijack the joystick');
  app.pointer('pointerup', 1, 500, 100, app.window);
  assert.equal(app.axis(), 0);
  app.pointer('pointermove', 1, 240, 100);
  assert.equal(app.axis(), 0);
});

test('the fourth trap touch is consumed and only a fresh touch starts the next joystick', () => {
  const app = application();
  app.trap();
  for (let index = 1; index <= 3; index++) {
    app.pointer('pointerdown', index);
    app.pointer('pointerup', index, 120, 480, app.window);
  }
  app.pointer('pointerdown', 4);
  assert.equal(app.game.player.state, 'air');
  app.pointer('pointermove', 4, 260, 490);
  assert.equal(app.axis(), 0);
  assert.equal(app.inspect('joystick'), null);
  app.pointer('pointerdown', 4, 140, 490);
  assert.equal(app.inspect('joystick'), null, 'a duplicate event is not a new touch');
  app.pointer('pointerup', 4, 260, 490, app.window);
  app.pointer('pointerdown', 4, 120, 490);
  app.pointer('pointermove', 4, 230, 490);
  assert.equal(app.axis(), 1);
});

test('blur pauses the round and clears held keys, pointer identity and capture before resume', () => {
  const app = application();
  app.key('keydown', 'ArrowRight');
  app.pointer('pointerdown', 7);
  app.pointer('pointermove', 7, 250, 490);
  app.window.dispatch('blur');
  assert.equal(app.game.phase, 'paused');
  assert.equal(app.axis(), 0);
  assert.equal(app.canvas.hasPointerCapture(7), false);
  app.element('#resume').dispatch('click');
  assert.equal(app.game.phase, 'playing');
  assert.equal(app.axis(), 0);
  app.pointer('pointerdown', 7);
  app.pointer('pointermove', 7, 20, 490);
  assert.equal(app.axis(), -1, 'the pointer ID is usable again after focus was lost');
  app.pointer('pointercancel', 7, 20, 490, app.window);
  assert.equal(app.axis(), 0);
});

test('the HUD reveals a real satsuma chain on its third landing and hides it after an ordinary landing', () => {
  const app = application();
  const landOn = (type) => {
    const game = app.game;
    const y = game.player.y + 30;
    const platform = { id: ++game.generationIndex, x: 100, y, width: 140,
      safeX: 170, safeWidth: 40, item: type ? { type, x: 170, used: false } : null };
    game.platforms = [platform, ...Array.from({ length: 12 }, (_, index) => ({
      id: 10000 + index, x: 70, y: y + 100 + index * 100, width: 220,
      safeX: 180, safeWidth: 40, item: null,
    }))];
    game.generatedTopY = y + 1500;
    game.generatedCenterX = 170;
    Object.assign(game.player, { x: 170, y: y + 1, vx: 0, vy: -300, state: 'air' });
    core.stepGame(game, 1 / 120, 0);
    app.inspect('processEvents(); refreshUi()');
  };
  for (let count = 1; count <= 2; count++) {
    landOn('satsuma');
    assert.equal(app.element('#combo').hidden, true);
  }
  landOn('satsuma');
  assert.equal(app.element('#combo').hidden, false);
  assert.equal(app.element('#combo').textContent, '3× KOMBO');
  landOn('satsuma');
  assert.equal(app.element('#combo').textContent, '4× KOMBO');
  landOn(null);
  assert.equal(app.element('#combo').hidden, true);
  assert.equal(app.game.satsumaStreak, 0);
  assert.ok(app.game.score > 0, 'ending the combo must preserve earned distance');
});

test('a saved autumn theme restores its selection and audio scene before a round starts', () => {
  const app = application({ autoStart: false, storedSettings: { theme: 'autumn', sound: true } });
  assert.equal(app.game.phase, 'ready');
  assert.equal(app.element('#game-frame').dataset.theme, 'autumn');
  assert.equal(app.document.body.dataset.theme, 'autumn');
  assert.equal(app.themeButtons.get('autumn').attributes.get('aria-pressed'), 'true');
  assert.equal(app.themeButtons.get('meadow').attributes.get('aria-pressed'), 'false');
  assert.deepEqual(app.audioScenes.at(-1), { theme: 'autumn', phase: 'ready' });
  app.element('#start').dispatch('click');
  assert.deepEqual(app.audioScenes.at(-1), { theme: 'autumn', phase: 'playing' });
});

test('menu theme choices save the selected world and notify audio without a phase change', () => {
  const app = application({ autoStart: false });
  for (const theme of ['autumn', 'winter', 'meadow']) {
    const previousCalls = app.audioScenes.length;
    app.themeButtons.get(theme).dispatch('click');
    assert.equal(app.game.phase, 'ready');
    assert.equal(app.element('#game-frame').dataset.theme, theme);
    assert.equal(app.document.body.dataset.theme, theme);
    assert.equal(app.savedSettings().theme, theme);
    assert.equal(app.themeButtons.get(theme).attributes.get('aria-pressed'), 'true');
    assert.ok(app.audioScenes.length > previousCalls, 'theme changes must reach the audio engine');
    assert.deepEqual(app.audioScenes.at(-1), { theme, phase: 'ready' });
  }
});

test('a saved hidden Kvltist selection opens Talvi with the winter audio scene', () => {
  const app = application({ autoStart: false, storedSettings: { theme: 'kvlt', sound: true } });
  assert.equal(app.document.body.dataset.theme, 'winter');
  assert.equal(app.element('#mode-label').textContent, 'TALVI');
  assert.equal(app.themeButtons.get('winter').attributes.get('aria-pressed'), 'true');
  assert.deepEqual(app.audioScenes.at(-1), { theme: 'winter', phase: 'ready' });
  app.element('#start').dispatch('click');
  assert.deepEqual(app.audioScenes.at(-1), { theme: 'winter', phase: 'playing' });
});

test('music preference restores and toggles independently without pausing the game or muting effects', () => {
  const app = application({ storedSettings: { theme: 'autumn', sound: true, music: false } });
  const music = app.element('#music');
  assert.equal(music.attributes.get('aria-pressed'), 'false');
  assert.equal(music.attributes.get('aria-label'), 'Music on');
  assert.equal(app.inspect('settings.music'), false);
  music.focus();
  music.dispatch('click');
  assert.deepEqual(app.musicChanges, [true]);
  assert.equal(music.attributes.get('aria-pressed'), 'true');
  assert.equal(music.attributes.get('aria-label'), 'Music off');
  assert.equal(app.savedSettings().sound, true);
  assert.equal(app.savedSettings().music, true);
  assert.equal(app.game.phase, 'playing');
  assert.equal(app.document.activeElement, app.canvas);
  music.dispatch('click');
  assert.deepEqual(app.musicChanges, [true, false]);
  assert.equal(app.savedSettings().sound, true);
  assert.equal(app.savedSettings().music, false);
  assert.equal(app.element('#sound').attributes.get('aria-pressed'), 'true');
});

test('effect control announces only sound effects and leaves the music preference untouched', () => {
  const app = application({ storedSettings: { theme: 'winter', sound: false, music: true } });
  const sound = app.element('#sound');
  assert.equal(sound.attributes.get('aria-label'), 'Ota ääniefektit käyttöön');
  assert.equal(sound.attributes.get('title'), 'Ota ääniefektit käyttöön');
  sound.focus();
  sound.dispatch('click');
  assert.equal(sound.attributes.get('aria-label'), 'Mykistä ääniefektit');
  assert.equal(sound.attributes.get('title'), 'Mykistä ääniefektit');
  assert.equal(sound.attributes.get('aria-pressed'), 'true');
  assert.equal(app.document.activeElement, app.canvas);
  sound.dispatch('click');
  assert.equal(sound.attributes.get('aria-label'), 'Ota ääniefektit käyttöön');
  assert.equal(sound.attributes.get('aria-pressed'), 'false');
  assert.deepEqual(app.effectChanges, [true, false]);
  assert.deepEqual(app.musicChanges, []);
  assert.equal(app.savedSettings().sound, false);
  assert.equal(app.savedSettings().music, true);
  assert.equal(app.game.phase, 'playing');
});

test('menu help reuses both complete desktop guides and returns focus after close or Escape', () => {
  const app = application({ autoStart: false });
  const open = app.element('#help-open');
  const dialog = app.element('#help-dialog');
  const content = app.element('#help-content');
  const guides = [...content.children];
  assert.equal(guides.length, 2);
  for (const [index, selector] of ['.intro', '.field-guide'].entries()) {
    assert.equal(guides[index].copiedFrom, app.element(selector));
    assert.equal(guides[index].textContent, app.element(selector).textContent);
    assert.notEqual(guides[index], app.element(selector));
  }
  const gameBefore = JSON.stringify(app.game);
  open.focus();
  open.dispatch('click');
  assert.equal(dialog.open, true);
  assert.equal(app.document.activeElement, app.element('#help-close'));
  assert.equal(content.scrollTop, 0);
  app.element('#help-close').dispatch('click');
  assert.equal(dialog.open, false);
  assert.equal(app.document.activeElement, open);
  content.scrollTop = 250;
  open.dispatch('click');
  assert.equal(content.scrollTop, 0);
  assert.deepEqual(content.children, guides, 'reopening must not duplicate the guide content');
  assert.equal(app.key('keydown', 'Escape').defaultPrevented, false, 'Escape reaches the native dialog');
  assert.equal(dialog.open, false);
  assert.equal(app.document.activeElement, open);
  assert.equal(JSON.stringify(app.game), gameBefore, 'reading help must not start or pause a round');
  app.element('#start').dispatch('click');
  open.dispatch('click');
  assert.equal(dialog.open, false, 'the help action is available only in the start menu');
  assert.equal(app.game.phase, 'playing');
});

test('start, pause, resume, menu and a real falling loss update the audio scene once per transition', () => {
  const app = application({ autoStart: false, storedSettings: { theme: 'autumn', sound: true } });
  const initialCalls = app.audioScenes.length;
  app.element('#start').dispatch('click');
  app.element('#pause').dispatch('click');
  app.element('#resume').dispatch('click');
  app.element('#pause').dispatch('click');
  app.element('#back-menu').dispatch('click');
  app.element('#start').dispatch('click');
  Object.assign(app.game.player, { y: app.game.camera - 1, vy: -100 });
  core.stepGame(app.game, 1 / 120, 0);
  app.inspect('processEvents(); refreshUi()');
  assert.equal(app.game.phase, 'over');
  assert.deepEqual(app.audioScenes.slice(initialCalls),
    ['playing', 'paused', 'playing', 'paused', 'ready', 'playing', 'over']
      .map((phase) => ({ theme: 'autumn', phase })));
  const afterLoss = app.audioScenes.length;
  app.inspect('refreshUi(); refreshUi()');
  assert.equal(app.audioScenes.length, afterLoss, 'unchanged frames must not restart music');
  app.element('#change-world').dispatch('click');
  assert.deepEqual(app.audioScenes.at(-1), { theme: 'autumn', phase: 'ready' });
});

test('blur and hidden-page transitions pause the audio scene until the player explicitly resumes', () => {
  const app = application({ storedSettings: { theme: 'winter', sound: true } });
  app.window.dispatch('blur');
  assert.equal(app.game.phase, 'paused');
  assert.deepEqual(app.audioScenes.at(-1), { theme: 'winter', phase: 'paused' });
  app.element('#resume').dispatch('click');
  assert.deepEqual(app.audioScenes.at(-1), { theme: 'winter', phase: 'playing' });
  app.document.hidden = true;
  app.document.dispatch('visibilitychange');
  assert.equal(app.game.phase, 'paused');
  assert.deepEqual(app.audioScenes.at(-1), { theme: 'winter', phase: 'paused' });
  const pausedCalls = app.audioScenes.length;
  app.document.hidden = false;
  app.document.dispatch('visibilitychange');
  assert.equal(app.game.phase, 'paused');
  assert.equal(app.audioScenes.length, pausedCalls);
  app.element('#resume').dispatch('click');
  assert.deepEqual(app.audioScenes.at(-1), { theme: 'winter', phase: 'playing' });
});
