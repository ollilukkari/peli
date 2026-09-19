import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, startGame, stepGame, PHYSICS } from '../src/game.js';

const DT = 1 / 120;
function setup() {
  const game = createGame(7);
  startGame(game);
  game.gulls = [];
  game.nextGullY = Infinity;
  const platform = game.platforms[0];
  platform.item = { type: 'trampoline', x: 220, used: false };
  Object.assign(game.player, { x: 220, y: platform.y + PHYSICS.trampolineHeight + .1, vy: -60, vx: 0 });
  game.events = [];
  return { game, platform };
}

test('trampoline launches 50 meters upward and allows steering during flight', () => {
  const { game, platform } = setup();
  stepGame(game, DT);
  assert.equal(game.events[0].type, 'trampoline');
  assert.ok(Math.abs(game.player.vy ** 2 / (2 * PHYSICS.gravity) / PHYSICS.pixelsPerMeter - 50) < 1e-10);
  const matY = platform.y + PHYSICS.trampolineHeight;
  assert.equal(game.player.y, matY);
  let peak = game.player.y;
  while (game.player.vy > 0) {
    stepGame(game, DT, .1);
    peak = Math.max(peak, game.player.y);
  }
  assert.ok(Math.abs((peak - matY) / PHYSICS.pixelsPerMeter - 50) < .002);
  assert.ok(game.player.x > 220);
  assert.equal(game.phase, 'playing');
  assert.ok(game.generatedTopY > peak);
});

test('trampoline stays reusable and a miss still makes an ordinary jump', () => {
  const { game, platform } = setup();
  for (let bounce = 0; bounce < 2; bounce++) {
    Object.assign(game.player, { x: 220, y: platform.y + PHYSICS.trampolineHeight + .1, vy: -60, vx: 0 });
    stepGame(game, DT);
    assert.equal(game.events.at(-1).type, 'trampoline');
    assert.equal(platform.item.used, false);
  }
  Object.assign(game.player, { x: 160, y: platform.y + .1, vy: -60, vx: 0 });
  stepGame(game, DT);
  assert.equal(game.events.at(-1).type, 'bounce');
  assert.equal(game.player.vy, PHYSICS.jumpSpeed);
});

test('crossing below the raised mat does not trigger a trampoline launch', () => {
  const { game, platform } = setup();
  game.player.y = platform.y + .1;
  stepGame(game, DT);
  assert.equal(game.events.at(-1).type, 'bounce');
  assert.equal(game.player.y, platform.y);
});

test('trampolines occur in generated routes across seeds without sharing a pet ledge', () => {
  let count = 0;
  for (let seed = 0; seed < 100; seed++) {
    for (const platform of createGame(seed).platforms) {
      if (platform.item?.type !== 'trampoline') continue;
      count++;
      assert.ok(!platform.dog);
      assert.ok(Math.abs(platform.safeX - platform.item.x) > PHYSICS.playerWidth / 2 + PHYSICS.itemHalfWidth);
    }
  }
  assert.ok(count >= 40);
});

test('trampolines grow the shared combo and defer Zab until the combo actually ends', () => {
  for (const streak of [0, 2, 9, 10]) {
    const { game, platform } = setup();
    game.satsumaStreak = streak;
    const rewards = () => game.platforms.filter((p) => p.dog?.enteredAt !== undefined).length;
    stepGame(game, DT);
    assert.equal(game.satsumaStreak, streak + 1);
    assert.equal(game.events.at(-1).combo, streak + 1);
    assert.equal(game.lastLanding.type, 'trampoline');
    assert.equal(rewards(), 0);
    const target = game.platforms.find((p) => p.id === game.chainTargetId);
    assert.ok(target.y > game.player.y);
    const fruit = [target.item, target.chainSatsuma].find((item) => item?.type === 'satsuma' && !item.used);
    assert.ok(fruit);
    Object.assign(game.player, { x: 160, y: platform.y + .1, vy: -60, vx: 0 });
    stepGame(game, DT);
    assert.equal(game.satsumaStreak, 0);
    assert.equal(rewards(), streak >= 9 ? 1 : 0);
  }
});

test('a real trampoline jump can land on its next combo fruit', () => {
  const { game } = setup();
  stepGame(game, DT);
  let continued = false;
  for (let control = 0; control <= 100 && !continued; control++) {
    const trial = structuredClone(game);
    trial.events = [];
    for (let frame = 0; frame < 260 && !trial.events.length; frame++) {
      stepGame(trial, DT, -1 + control / 50);
    }
    continued = trial.events[0]?.type === 'satsuma' && trial.satsumaStreak === 2;
  }
  assert.ok(continued, '50 m flight offers an actual reachable combo continuation');
});
