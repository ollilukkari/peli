import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as core from '../src/game.js';

// Execute the application's actual event handlers with the real simulation.
// Only browser services (DOM, rendering, audio, storage and PWA) are replaced.
const mainSource = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
  .replace(/^import .+;\r?\n/gm, '');

function application() {
  class Element {
    constructor(isControl = false) {
      this.isControl = isControl;
      this.listeners = new Map();
      this.dataset = {};
      this.captures = new Set();
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
    setAttribute() {}
    focus() { document.activeElement = this; }
    getContext() { return {}; }
    getBoundingClientRect() { return { left: 10, top: 20, width: core.WIDTH, height: core.HEIGHT }; }
    setPointerCapture(id) { this.captures.add(id); }
    hasPointerCapture(id) { return this.captures.has(id); }
    releasePointerCapture(id) { this.captures.delete(id); }
  }
  const elements = new Map();
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, new Element(['#start', '#sound', '#resume'].includes(id)));
    return elements.get(id);
  };
  const document = Object.assign(new Element(), {
    hidden: false,
    querySelector: element,
    querySelectorAll: () => [],
  });
  const window = new Element();
  const context = vm.createContext({
    ...core, Element, document, window,
    matchMedia: () => Object.assign(new Element(), { matches: false }),
    localStorage: { getItem: () => null, setItem() {} },
    crypto: { getRandomValues: (values) => { values[0] = 42; return values; } },
    GameAudio: class { unlock() {} play() {} setEnabled() {} },
    setupPwa: () => ({ applyUpdate: async () => false }),
    drawGame() {}, requestAnimationFrame() {},
  });
  vm.runInContext(mainSource, context, { filename: 'src/main.js' });
  element('#start').dispatch('click');
  const canvas = element('#game');
  const inspect = (expression) => vm.runInContext(expression, context);
  return {
    document, window, element, canvas, inspect,
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
      return window.dispatch(type, { code, target: document.activeElement, ...options });
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
