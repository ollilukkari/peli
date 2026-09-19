import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PHYSICS, createGame, startGame, stepGame, strokeDog, pauseGame, resumeGame,
} from '../src/game.js';

const DT = 1 / 120;
const LAUNCH_DURATION = 300 / (200 / 0.5 * 0.8);
const BOOST_DURATION = 0.25 + LAUNCH_DURATION;

function pettingGame(seed = 7, height = 0) {
  const game = createGame(seed, { creatureMode: 'test' });
  startGame(game);
  game.gulls = [];
  game.nextGullY = Infinity;
  if (height) {
    game.camera = height;
    Object.assign(game.player, { y: height + 250, state: 'trapped', vy: 0 });
    stepGame(game, DT);
  }
  const source = game.platforms.find((platform) => platform.y >= height + 100);
  source.item = null;
  source.chainSatsuma = undefined;
  source.dog = { kind: 'zab', x: source.x + 16, direction: 1, petted: false };
  Object.assign(game.player, { x: source.x + 16, y: source.y + 1, vy: -300, state: 'air' });
  stepGame(game, DT);
  assert.equal(game.player.state, 'petting');
  game.events = [];
  return { game, source };
}

function charge(game) {
  for (let stroke = 0; stroke < PHYSICS.dogStrokes; stroke++) assert.equal(strokeDog(game), true);
  assert.equal(game.player.state, 'pet-boost');
  return { ...game.petBoost };
}

test('ten hamster strokes launch exactly 300 m at 80% of the original ascent speed and clear the glow', () => {
  const { game, source } = pettingGame();
  const fromY = game.player.y;
  const boost = charge(game);
  assert.equal(source.dog.petted, true);
  assert.equal(strokeDog(game), false);
  assert.equal(boost.chargeDuration, 0.25);
  assert.equal(boost.launchDuration, LAUNCH_DURATION);
  assert.equal(boost.duration, BOOST_DURATION);
  assert.equal(boost.targetY - boost.fromY, 300 * PHYSICS.pixelsPerMeter);
  assert.equal((boost.targetY - boost.fromY) / PHYSICS.pixelsPerMeter / boost.launchDuration, 320);
  assert.deepEqual(game.events.map((event) => event.type), ['pet-boost']);
  for (let frame = 0; frame < Math.ceil(BOOST_DURATION / DT); frame++) stepGame(game, DT);
  assert.equal(game.petBoost, null);
  assert.equal(game.player.state, 'air');
  assert.equal(game.player.y, fromY + 300 * PHYSICS.pixelsPerMeter);
  assert.equal(game.player.x, boost.targetX);
  assert.equal(game.player.vy, PHYSICS.jumpSpeed);
  assert.equal(game.score, Math.floor((game.maxY - game.startY) / PHYSICS.pixelsPerMeter));
  assert.deepEqual(game.events.map((event) => event.type), ['pet-boost', 'pet-boost-release']);
  assert.ok(game.gullInvulnerableUntil > game.time);
  stepGame(game, DT, 1);
  assert.ok(game.player.y > boost.targetY);
  assert.ok(game.player.vx > 0);
});

test('charging holds the bunny and lethal camera still even at the bottom edge', () => {
  const { game } = pettingGame();
  const boost = charge(game);
  game.camera = game.player.y - 0.001;
  const camera = game.camera;
  const score = game.score;
  for (const dt of [0.05, 0.075, 0.125]) {
    stepGame(game, dt, -1);
    assert.equal(game.player.x, boost.fromX);
    assert.equal(game.player.y, boost.fromY);
    assert.equal(game.camera, camera);
    assert.equal(game.score, score);
    assert.equal(game.player.state, 'pet-boost');
    assert.equal(game.phase, 'playing');
  }
  for (const dt of [0.001, 0.001, 0.048]) {
    stepGame(game, dt, 1);
    assert.ok(game.player.y > boost.fromY);
    assert.ok(game.camera > camera);
    assert.ok(game.player.y > game.camera);
    assert.equal(game.phase, 'playing');
  }
});

test('a step crossing the charge boundary scrolls only for its launch portion', () => {
  const { game } = pettingGame();
  charge(game);
  const split = structuredClone(game);
  stepGame(game, 0.3);
  stepGame(split, 0.25);
  stepGame(split, 0.05);
  assert.deepEqual(game.player, split.player);
  assert.ok(Math.abs(game.camera - split.camera) < 1e-9);
  assert.equal(game.phase, 'playing');
});

test('boost arrival is exact for uneven and oversized simulation steps', () => {
  for (const steps of [[0.1, 0.2, BOOST_DURATION - 0.3],
    [0.249, 0.001, LAUNCH_DURATION - 0.001, 2], [BOOST_DURATION - 0.001, 2], [60]]) {
    const { game } = pettingGame();
    const boost = charge(game);
    const started = game.time;
    for (const dt of steps) stepGame(game, dt, -1);
    assert.equal(game.player.y, boost.targetY);
    assert.equal(game.player.y - boost.fromY, 300 * PHYSICS.pixelsPerMeter);
    assert.equal(game.player.x, boost.targetX);
    assert.equal(game.petBoost, null);
    assert.ok(Math.abs(game.time - started - BOOST_DURATION) < 1e-9);
    assert.equal(game.phase, 'playing');
  }
});

test('pause freezes both charging and launching and resumes the remaining animation', () => {
  for (const elapsed of [0.1, 0.5]) {
    const { game } = pettingGame();
    const boost = charge(game);
    stepGame(game, elapsed);
    pauseGame(game);
    const paused = structuredClone(game);
    stepGame(game, 60, 1);
    assert.deepEqual(game, paused);
    assert.equal(strokeDog(game), false);
    resumeGame(game);
    stepGame(game, boost.duration - elapsed);
    assert.equal(game.player.y, boost.targetY);
    assert.equal(game.player.state, 'air');
    assert.equal(game.petBoost, null);
  }
});

test('the boost ignores steering, platforms and crossing gulls while the camera follows', () => {
  const { game } = pettingGame();
  const boost = charge(game);
  const untouched = structuredClone(game);
  // A stationary gull occupies the exact midpoint of the launch path.
  game.gulls = [{ id: 999, baseY: (boost.fromY + boost.targetY) / 2 + PHYSICS.playerHeight / 2,
    flightOffset: (boost.fromX + boost.targetX) / 2 - 30, speed: 0,
    bobOffset: 14, bobSpeed: 0 }];
  for (let frame = 0; frame < Math.ceil(BOOST_DURATION / DT); frame++) {
    stepGame(game, DT, frame % 2 ? 1 : -1);
    stepGame(untouched, DT, 0);
    assert.deepEqual(game.player, untouched.player);
    assert.ok(game.player.y > game.camera);
    assert.ok(game.player.y - game.camera <= PHYSICS.followHeight + 1e-9);
    assert.equal(game.phase, 'playing');
  }
  assert.equal(game.player.y, boost.targetY);
  assert.equal(game.lastGullHit, null);
  assert.ok(!game.events.some((event) => ['gull', 'trap', 'over'].includes(event.type)));
});

test('safe arrival preserves the generated route and reaches the next real ledge across heights', () => {
  for (const height of [0, 12000, 60000]) {
    for (let seed = 0; seed < 24; seed++) {
      const { game, source } = pettingGame(seed, height);
      const existing = new Map(game.platforms.map((platform) => [platform.id, structuredClone(platform)]));
      const boost = charge(game);
      const destination = game.platforms.find((platform) => platform.id === boost.landingPlatformId);
      const next = game.platforms.find((platform) => platform.y > boost.targetY);
      assert.equal(destination.y, boost.fromY + 300 * PHYSICS.pixelsPerMeter);
      assert.equal(destination.item, null);
      assert.equal(destination.dog, undefined);
      assert.equal(destination.safeX, next.safeX);
      assert.ok(destination.x <= boost.targetX - PHYSICS.playerWidth / 2);
      assert.ok(destination.x + destination.width >= boost.targetX + PHYSICS.playerWidth / 2);
      assert.ok(next.y - destination.y <= 120);
      assert.equal(new Set(game.platforms.map((platform) => platform.id)).size, game.platforms.length);
      for (const platform of game.platforms) {
        if (existing.has(platform.id)) {
          const before = existing.get(platform.id);
          if (before.id === source.id) before.dog.petted = true;
          assert.deepEqual(platform, before);
        }
      }
      stepGame(game, boost.duration);
      assert.equal(game.player.y, destination.y);
      game.events = [];
      for (let frame = 0; frame < 120 && !game.events.length; frame++) stepGame(game, DT);
      assert.equal(game.phase, 'playing', `seed ${seed}, height ${height}`);
      assert.ok(game.lastLanding.y > destination.y, `upward continuation at seed ${seed}, height ${height}`);
      assert.ok(game.platforms.length < 40, 'the skipped route is pruned normally');
    }
  }
});

test('ordinary dogs keep the normal release jump and never receive the rare boost', () => {
  const { game, source } = pettingGame();
  delete source.dog.kind;
  for (let stroke = 0; stroke < 10; stroke++) strokeDog(game);
  assert.equal(game.player.state, 'air');
  assert.equal(game.player.vy, PHYSICS.jumpSpeed);
  assert.equal(game.petBoost, null);
  assert.deepEqual(game.events.map((event) => event.type), ['release']);
});
