import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createGame, PHYSICS } from '../src/game.js';

const renderSource = readFileSync(new URL('../src/render.js', import.meta.url), 'utf8')
  .replace(/^import \{ PHYSICS \} from '\.\/game\.js';\r?\n/m, '')
  .replaceAll('export ', '');

function renderer() {
  return vm.runInNewContext(`${renderSource}\n({
    drawGame, drawBackground, drawCachedPlatform, drawPlatformScenery,
    drawComboGlow, drawComboBurst, drawSpawnedFruit,
    platformHash, palettes, cacheFor: (ctx) => artworkCaches.get(ctx),
  });`, { PHYSICS }, { filename: 'src/render.js' });
}

// Record both the visible context and its offscreen canvases. Deliberately omit
// global document: an embedded canvas must use its own ownerDocument.
function recordingCanvas() {
  const contexts = [];
  const counters = { primitives: 0, offscreenPrimitives: 0 };
  const document = {
    createElement(tag) {
      assert.equal(tag, 'canvas');
      return makeCanvas(false);
    },
  };
  function makeCanvas(visible) {
    const calls = [];
    const canvas = { width: 360, height: 640, ownerDocument: document };
    const ctx = { canvas, calls, globalAlpha: 1, fillStyle: '#000' };
    const states = [];
    for (const name of ['fillRect', 'clearRect', 'beginPath', 'closePath', 'moveTo',
      'lineTo', 'fill', 'stroke', 'arc', 'translate', 'scale', 'transform', 'fillText', 'drawImage']) {
      ctx[name] = (...args) => {
        calls.push({ name, args, fillStyle: ctx.fillStyle, alpha: ctx.globalAlpha });
        if (['fillRect', 'fill', 'stroke', 'fillText'].includes(name)) {
          counters.primitives += 1;
          if (!visible) counters.offscreenPrimitives += 1;
        }
      };
    }
    ctx.save = () => states.push({ fillStyle: ctx.fillStyle, globalAlpha: ctx.globalAlpha });
    ctx.restore = () => Object.assign(ctx, states.pop());
    ctx.createLinearGradient = (...args) => ({
      args, stops: [], addColorStop(...stop) { this.stops.push(stop); },
    });
    ctx.measureText = (text) => ({ width: text.length * 8 });
    canvas.getContext = (kind) => {
      assert.equal(kind, '2d');
      return ctx;
    };
    contexts.push(ctx);
    return canvas;
  }
  const ctx = makeCanvas(true).getContext('2d');
  return { ctx, contexts, counters };
}

function imageCalls(ctx) {
  return ctx.calls.filter(({ name }) => name === 'drawImage');
}

function lastImage(ctx) {
  return imageCalls(ctx).at(-1).args[0];
}

test('a warmed platform reuses its artwork while its screen position changes', () => {
  const render = renderer();
  const { ctx, contexts, counters } = recordingCanvas();
  const platform = { id: 17, x: 42.2, width: 128.3 };
  const draw = (y) => render.drawCachedPlatform(ctx, platform, y, render.palettes.meadow, 'meadow', 42);
  draw(220.2);
  const image = lastImage(ctx);
  const firstPosition = imageCalls(ctx).at(-1).args.slice(1);
  const primitives = counters.primitives;
  const canvasCount = contexts.length;
  assert.ok(primitives > 10, 'the initial image must contain the platform artwork');

  platform.x += 13;
  draw(237.2);
  assert.equal(lastImage(ctx), image);
  assert.equal(contexts.length, canvasCount);
  assert.equal(counters.primitives, primitives, 'a cached platform needs only drawImage');
  const secondPosition = imageCalls(ctx).at(-1).args.slice(1);
  assert.equal(secondPosition[0] - firstPosition[0], 13);
  assert.equal(secondPosition[1] - firstPosition[1], 17);
});

test('platform artwork stays distinct across seasons, seeds, widths and platform identities', () => {
  const render = renderer();
  const { ctx } = recordingCanvas();
  const draw = (theme = 'meadow', seed = 42, width = 128, id = 17) => {
    render.drawCachedPlatform(ctx, { id, x: 40, width }, 200, render.palettes[theme], theme, seed);
    return lastImage(ctx);
  };
  const initial = draw();
  const images = [initial, draw('autumn'), draw('winter'), draw('kvlt'),
    draw('meadow', 43), draw('meadow', 42, 129), draw('meadow', 42, 128, 18)];
  assert.equal(new Set(images).size, images.length);
  assert.equal(draw(), initial, 'switching back must restore the matching artwork');

  const other = recordingCanvas();
  render.drawCachedPlatform(other.ctx, { id: 17, x: 40, width: 128 }, 200, render.palettes.meadow, 'meadow', 42);
  assert.notEqual(lastImage(other.ctx), initial, 'separate destination contexts own separate caches');
});

test('cached scenery still clears space for newly added or already eaten chain fruit', () => {
  const render = renderer();
  const { ctx } = recordingCanvas();
  const seed = 42;
  const platform = { id: 0, x: 80, width: 128, item: null };
  while (platform.id < 100) {
    render.drawPlatformScenery(ctx, platform, 240, 'meadow', seed);
    if (imageCalls(ctx).length) break;
    platform.id += 1;
  }
  assert.ok(imageCalls(ctx).length, 'fixture must have visible scenery');
  const image = lastImage(ctx);
  const detail = render.platformHash(seed, platform.id, 2);
  const x = platform.x + 22 + (platform.width - 44) * (.16 + ((detail >>> 8) % 69) / 100);
  for (const used of [false, true]) {
    platform.chainSatsuma = { x, used };
    ctx.calls.length = 0;
    render.drawPlatformScenery(ctx, platform, 240, 'meadow', seed);
    assert.equal(imageCalls(ctx).length, 0, `chain fruit with used=${used} must hide scenery`);
  }
  delete platform.chainSatsuma;
  render.drawPlatformScenery(ctx, platform, 240, 'meadow', seed);
  assert.equal(lastImage(ctx), image, 'unobstructed scenery can use the original cached image');
  platform.item = { x, type: 'trap', used: true };
  ctx.calls.length = 0;
  render.drawPlatformScenery(ctx, platform, 240, 'meadow', seed);
  assert.equal(imageCalls(ctx).length, 0, 'original items must keep their clearance too');
});

test('a long game keeps cached canvas pixels within the 8 MiB artwork budget', () => {
  const render = renderer();
  const { ctx } = recordingCanvas();
  const draw = (id) => {
    render.drawCachedPlatform(ctx, { id, x: 40, width: 128 }, 200, render.palettes.meadow, 'meadow', 42);
    const cache = render.cacheFor(ctx);
    const actualPixels = [...cache.entries.values()]
      .reduce((sum, { canvas }) => sum + canvas.width * canvas.height, 0);
    assert.equal(cache.pixels, actualPixels);
    assert.ok(actualPixels * 4 <= 8 * 1024 * 1024);
    const image = lastImage(ctx);
    ctx.calls.length = 0;
    return image;
  };
  const first = draw(0);
  for (let id = 1; id < 2500; id += 1) draw(id);
  const recent = draw(2499);
  assert.equal(draw(2499), recent, 'recent artwork must survive cache pressure');
  assert.notEqual(draw(0), first, 'old artwork must be regenerated after eviction');
});

test('cached scenery leaves snack and Zab body stretches live without changing physics', () => {
  for (const theme of ['meadow', 'autumn', 'winter', 'kvlt']) {
    for (const launch of ['snack', 'zab']) {
      const render = renderer();
      const { ctx, contexts, counters } = recordingCanvas();
      const game = createGame(42);
      game.phase = 'playing';
      game.time = 4.06;
      game.player.state = launch === 'zab' ? 'pet-boost' : 'air';
      game.player.vy = PHYSICS.jumpSpeed * PHYSICS.boostMultiplier - PHYSICS.gravity * 0.06;
      if (launch === 'zab') {
        game.petBoost = {
          elapsed: PHYSICS.petBoostChargeDuration + PHYSICS.petBoostLaunchDuration / 2,
          chargeDuration: PHYSICS.petBoostChargeDuration,
          launchDuration: PHYSICS.petBoostLaunchDuration,
        };
      } else {
        game.lastMealAt = 4;
        game.lastLanding = { type: 'satsuma', time: 4, x: game.player.x, y: game.player.y };
      }
      const draw = () => {
        ctx.calls.length = 0;
        const original = structuredClone(game);
        render.drawGame(ctx, game, { theme });
        assert.deepEqual(game, original, `${theme}/${launch}: rendering must leave physics unchanged`);
        // The final feet translation belongs to the bunny, after its optional halo.
        const feet = [Math.round(game.player.x), Math.round(640 - (game.player.y - game.camera))];
        const anchor = ctx.calls.findLastIndex(({ name, args }) => name === 'translate'
          && args[0] === feet[0] && args[1] === feet[1]);
        assert.ok(anchor >= 0, 'the live bunny must be anchored at its physics feet');
        return ctx.calls.slice(anchor + 1).find(({ name, args }) => name === 'scale' && args[0] !== args[1]).args;
      };
      draw();
      const canvasCount = contexts.length;
      const offscreenPrimitives = counters.offscreenPrimitives;
      const stretched = draw();
      assert.ok(stretched[0] < 0.9 && stretched[1] > 1.3,
        `${theme}/${launch}: an active launch must visibly narrow and lengthen the body`);

      game.time = 4.5;
      game.player.state = 'air';
      game.player.vy = PHYSICS.jumpSpeed;
      game.petBoost = null;
      const relaxed = draw();
      assert.ok(relaxed[0] > 0.95 && relaxed[1] < 1.15,
        `${theme}/${launch}: the body must relax after the launch`);
      assert.equal(contexts.length, canvasCount, 'live body animation must reuse static canvases');
      assert.equal(counters.offscreenPrimitives, offscreenPrimitives,
        'changing body stretch must not repaint cached scenery');
    }
  }
});

for (const theme of ['meadow', 'autumn', 'winter', 'kvlt']) {
  test(`${theme}: camera movement never allocates or repaints static background images`, () => {
    const render = renderer();
    const { ctx, contexts, counters } = recordingCanvas();
    const game = { camera: 0 };
    const options = { theme, time: 2, reducedMotion: false };
    render.drawBackground(ctx, game, options, render.palettes[theme]);
    const canvasesAfterWarmup = contexts.length;
    const offscreenAfterWarmup = counters.offscreenPrimitives;
    assert.ok(offscreenAfterWarmup > 0, 'the first background must build reusable artwork');

    for (const camera of [.49, 500, 1000, 2500, 4000, 6000, 9000]) {
      game.camera = camera;
      options.time += 3.7;
      render.drawBackground(ctx, game, options, render.palettes[theme]);
      assert.equal(contexts.length, canvasesAfterWarmup,
        `camera=${camera} must reuse existing background canvases`);
      assert.equal(counters.offscreenPrimitives, offscreenAfterWarmup,
        `camera=${camera} must not repaint static background artwork`);
    }
  });

  test(`${theme}: repeated game frames reuse static artwork and leave the game model unchanged`, () => {
    const render = renderer();
    const { ctx, counters } = recordingCanvas();
    const game = createGame(42);
    const original = structuredClone(game);
    const options = { theme, time: 2 };
    render.drawGame(ctx, game, options);
    const coldPrimitives = counters.primitives;
    const offscreenAfterWarmup = counters.offscreenPrimitives;
    assert.ok(offscreenAfterWarmup > 0, 'the first frame should build reusable artwork');

    render.drawGame(ctx, game, options);
    const warmPrimitives = counters.primitives - coldPrimitives;
    assert.equal(counters.offscreenPrimitives, offscreenAfterWarmup,
      'an identical frame must not repaint any cached artwork');
    assert.ok(warmPrimitives < coldPrimitives, 'a warmed frame must submit fewer drawing primitives');
    assert.deepEqual(game, original);

    ctx.calls.length = 0;
    render.drawGame(ctx, game, { ...options, time: 8 });
    const animated = ctx.calls.map(({ name, args, alpha }) => [name, args, alpha]);
    ctx.calls.length = 0;
    render.drawGame(ctx, game, options);
    const earlier = ctx.calls.map(({ name, args, alpha }) => [name, args, alpha]);
    assert.notDeepEqual(animated, earlier, 'static artwork caching must preserve time-based animation');
    assert.deepEqual(game, original);
  });
}

test('combo glow starts at three, rises evenly from 10 to 40 percent and caps at ten', () => {
  const render = renderer();
  const game = createGame(7);
  const paint = (streak, time, reduced = false) => {
    const { ctx } = recordingCanvas();
    game.satsumaStreak = streak;
    game.time = time;
    render.drawComboGlow(ctx, game, 300, reduced, 0);
    return ctx.calls.filter((call) => call.name === 'fillRect');
  };
  for (const streak of [0, 1, 2]) assert.equal(paint(streak, 0).length, 0);
  const strengths = Array.from({ length: 8 }, (_, index) => paint(index + 3, 0)[0].alpha);
  assert.equal(strengths[0], 0.1);
  assert.equal(strengths.at(-1), 0.4);
  for (let index = 1; index < strengths.length; index++) {
    assert.ok(Math.abs(strengths[index] - strengths[index - 1] - 0.3 / 7) < 1e-12);
  }
  assert.deepEqual(paint(10, 0), paint(25, 0));
  assert.notEqual(paint(10, 0)[0].fillStyle, paint(10, 1)[0].fillStyle);
  assert.deepEqual(paint(10, 1, true), paint(10, 2, true));
});

test('combo stars start at eight, brighten to ten, freeze with world time and respect reduced motion', () => {
  const render = renderer();
  const game = createGame(7);
  const stars = (level, time, reduced = false) => {
    const { ctx } = recordingCanvas();
    ctx.globalAlpha = 0.8;
    game.satsumaStreak = level;
    game.time = time;
    render.drawComboGlow(ctx, game, 300, reduced, 0);
    assert.equal(ctx.globalAlpha, 0.8, 'drawing restores the enclosing opacity');
    return ctx.calls.filter((call) => call.name === 'fillRect' && call.fillStyle.startsWith('#'));
  };
  for (const level of [0, 2, 3, 7]) assert.equal(stars(level, 1).length, 0);
  const low = stars(8, 1);
  const medium = stars(9, 1);
  const high = stars(10, 1);
  assert.equal(high.length, 16, 'eight two-stroke stars remain bounded');
  high.forEach((call, index) => {
    assert.ok(Math.abs(low[index].alpha * 3 - call.alpha) < 1e-12);
    assert.ok(Math.abs(medium[index].alpha * 1.5 - call.alpha) < 1e-12);
    assert.ok(call.alpha > 0 && call.alpha <= 0.8);
  });
  assert.deepEqual(high, stars(20, 1));
  assert.deepEqual(high, stars(10, 1), 'unchanged simulation time freezes the stars');
  assert.notDeepEqual(high, stars(10, 1.3));
  assert.deepEqual(stars(10, 1, true), stars(10, 2, true));
  assert.equal(stars(0, 2).length, 0, 'ending the combo removes every star');
});

test('combo splash starts at one and contains only the growing number', () => {
  const render = renderer();
  const game = createGame(7);
  game.lastLanding = { type: 'satsuma', time: 0 };
  for (const streak of [1, 2, 3, 10, 123]) {
    game.satsumaStreak = streak;
    const { ctx } = recordingCanvas();
    render.drawComboBurst(ctx, game, 'meadow', false);
    const labels = ctx.calls.filter((call) => call.name === 'fillText');
    assert.deepEqual(labels.map((call) => call.args[0]), [String(streak), String(streak)]);
    assert.equal(ctx.font, '64px "Cooper Black"');
    assert.equal(ctx.calls.filter((call) => call.name === 'fill').length, 0, 'no filled splash background');
    assert.ok(ctx.calls.filter((call) => call.name === 'translate').every((call) => call.args.every(Number.isFinite)));
  }
});

test('new visible fruit pops in, settles and uses only a fade with reduced motion', () => {
  const render = renderer();
  const item = { type: 'satsuma', x: 180, spawnedAt: 2 };
  const paint = (age, reduced = false) => {
    const { ctx } = recordingCanvas();
    render.drawSpawnedFruit(ctx, item, 300, 2 + age, 4, 'meadow', reduced);
    return ctx.calls;
  };
  const early = paint(0.03);
  assert.ok(early.some((call) => call.name === 'scale' && call.args[0] < 1));
  assert.ok(early.filter((call) => call.name === 'fillRect').every((call) => call.alpha < 0.5));
  assert.ok(!paint(0.4).some((call) => call.name === 'scale'));
  assert.ok(!paint(0.03, true).some((call) => call.name === 'scale'));
  delete item.spawnedAt;
  assert.ok(!paint(0).some((call) => call.name === 'scale'));
});
