import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, startGame, stepGame, HEIGHT } from '../src/game.js';

const DT = 1 / 120;
function landing(game, platform) {
  Object.assign(game.player, { state: 'air', x: platform.safeX, y: platform.y + 0.1, vx: 0, vy: -60 });
  stepGame(game, DT);
}
function setup(seed = 7) {
  const game = createGame(seed);
  startGame(game);
  game.gulls = [];
  game.nextGullY = Infinity;
  return game;
}

test('each ended combo of 10 or more grants exactly one extra offscreen Zab, preserving existing encounters and items', () => {
  for (const streak of [9, 10, 11, 30]) {
    for (let seed = 0; seed < 40; seed++) {
      const game = setup(seed);
      const before = new Map(game.platforms.map((p) => [p.id, structuredClone(p)]));
      const source = game.platforms[0];
      const camera = game.camera;
      const schedules = [game.nextDogY, game.nextCreatureY];
      game.satsumaStreak = streak;
      landing(game, source);
      const rewards = game.platforms.filter((p) => p.dog?.kind === 'zab' && !before.get(p.id)?.dog);
      assert.equal(rewards.length, streak >= 10 ? 1 : 0);
      assert.equal(game.satsumaStreak, 0);
      if (rewards.length) {
        assert.ok(rewards[0].y >= camera + HEIGHT + 60);
        assert.equal(rewards[0].dog.petted, false);
        assert.ok(!rewards[0].item || rewards[0].item.used);
      }
      assert.deepEqual([game.nextDogY, game.nextCreatureY], schedules);
      for (const p of game.platforms) {
        const old = before.get(p.id);
        if (!old) continue;
        assert.deepEqual(p.item, old.item);
        assert.deepEqual([p.x, p.y, p.width], [old.x, old.y, old.width]);
        if (old.dog) assert.equal(p.dog.kind, old.dog.kind);
      }
      const count = game.platforms.filter((p) => p.dog?.kind === 'zab').length;
      landing(game, source);
      assert.equal(game.platforms.filter((p) => p.dog?.kind === 'zab').length, count);
      if (streak >= 10) {
        game.satsumaStreak = 10;
        landing(game, source);
        assert.equal(game.platforms.filter((p) => p.dog?.kind === 'zab').length, count + 1);
      }
    }
  }
});

test('the tenth collected fruit keeps the combo running and only its later end awards Zab', () => {
  const game = setup();
  const source = game.platforms[0];
  source.item = { type: 'satsuma', x: source.safeX, used: false };
  game.satsumaStreak = 9;
  const count = game.platforms.filter((p) => p.dog?.kind === 'zab').length;
  landing(game, source);
  assert.equal(game.satsumaStreak, 10);
  assert.equal(game.platforms.filter((p) => p.dog?.kind === 'zab').length, count);
  landing(game, source);
  assert.equal(game.platforms.filter((p) => p.dog?.kind === 'zab').length, count + 1);
});

test('chain fruit records spawn time only when its art overlaps the viewport at creation', () => {
  for (const camera of [0, -1000]) {
    const game = setup();
    const source = game.platforms[0];
    source.item = { type: 'satsuma', x: source.safeX, used: false };
    for (const p of game.platforms.slice(1)) p.item = null;
    game.camera = camera;
    game.time = 2;
    landing(game, source);
    const target = game.platforms.find((p) => p.id === game.chainTargetId);
    assert.ok(target.chainSatsuma);
    assert.equal(target.chainSatsuma.spawnedAt, camera === 0 ? game.time : undefined);
  }
});
