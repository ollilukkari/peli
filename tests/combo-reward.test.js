import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, startGame, stepGame, tapDog, HEIGHT, PHYSICS } from '../src/game.js';

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

test('each ended combo of 10 or more reserves one top-edge Zab, preserving existing encounters and items', () => {
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
        const minimumY = camera + HEIGHT - PHYSICS.comboCreatureTopInset;
        assert.ok(rewards[0].y >= minimumY);
        const firstFree = [...before.values()].find((p) => p.y >= minimumY && !p.dog
          && (!p.item || p.item.used) && (!p.chainSatsuma || p.chainSatsuma.used));
        if (firstFree) assert.equal(rewards[0].id, firstFree.id);
        assert.equal(rewards[0].dog.enteredAt, null);
        assert.ok(rewards[0].dog.x < 0 || rewards[0].dog.x > 360);
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

test('combo reward slides continuously from the edge and reaches its ledge within 0.55 seconds', () => {
  const game = setup();
  game.satsumaStreak = 10;
  landing(game, game.platforms[0]);
  const platform = game.platforms.find((p) => p.dog?.enteredAt !== undefined);
  game.camera = platform.y - HEIGHT + PHYSICS.comboCreatureTopInset;
  game.player.y = game.camera + 200;
  game.player.state = 'trapped';
  stepGame(game, DT);
  assert.equal(platform.dog.enteredAt, game.time);
  const feetY = HEIGHT - (platform.y - game.camera);
  assert.ok(feetY >= PHYSICS.comboCreatureTopInset && feetY < PHYSICS.comboCreatureTopInset + 1);
  const from = platform.dog.x;
  stepGame(game, .1);
  assert.ok(Math.abs(platform.dog.x - platform.safeX) < Math.abs(from - platform.safeX));
  assert.notEqual(platform.dog.x, from);
  for (let time = .1; time < PHYSICS.comboCreatureEntryDuration + DT; time += DT) stepGame(game, DT);
  assert.ok(platform.dog.x >= platform.x + 16 && platform.dog.x <= platform.x + platform.width - 16);
});

test('offscreen rewards wait at the edge without consuming their slide animation', () => {
  const game = setup();
  game.satsumaStreak = 10;
  landing(game, game.platforms[0]);
  const platform = game.platforms.find((p) => p.dog?.enteredAt !== undefined);
  game.camera = platform.y - HEIGHT - 100;
  game.player.y = game.camera + 200;
  game.player.state = 'trapped';
  const from = platform.dog.x;
  for (let frame = 0; frame < 120; frame++) stepGame(game, DT);
  assert.equal(platform.dog.enteredAt, null);
  assert.equal(platform.dog.x, from);
  game.camera = platform.y - HEIGHT + PHYSICS.comboCreatureTopInset;
  game.player.y = game.camera + 200;
  stepGame(game, DT);
  assert.equal(platform.dog.enteredAt, game.time);
  assert.equal(platform.dog.x, from);
  stepGame(game, .1);
  assert.notEqual(platform.dog.x, from);
});

test('top-edge placement follows the camera at different heights rather than the bunny', () => {
  for (const camera of [0, 350, 1200]) {
    const game = setup();
    game.camera = camera;
    const source = { id: -999, x: 50, width: 260, safeX: 180, y: camera + 100, item: null };
    game.platforms = [source];
    game.satsumaStreak = 10;
    landing(game, source);
    const platform = game.platforms.find((p) => p.dog?.enteredAt !== undefined);
    assert.ok(platform.y >= camera + HEIGHT - PHYSICS.comboCreatureTopInset);
    assert.ok(platform.y - source.y > 400);
    assert.equal(platform.dog.enteredAt, null);
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

function missReward(game, platform) {
  game.camera = platform.y + PHYSICS.comboCreatureTopInset + 1;
  Object.assign(game.player, { y: game.camera + 200, state: 'trapped', vy: 0 });
  stepGame(game, DT);
  return game.platforms.find((p) => p.dog?.comboReward && !p.dog.petted);
}

test('a missed combo Zab returns once on the nearest free upper ledge without changing the route', () => {
  for (let seed = 0; seed < 40; seed++) {
    const game = setup(seed);
    game.satsumaStreak = 10;
    landing(game, game.platforms[0]);
    const source = game.platforms.find((p) => p.dog?.comboReward);
    const before = structuredClone(game.platforms);
    const reward = missReward(game, source);
    assert.equal(source.dog, null);
    assert.ok(reward.dog.returning);
    assert.equal(game.platforms.filter((p) => p.dog?.comboReward).length, 1);
    const freeVisible = before.filter((p) => !p.dog && (!p.item || p.item.used)
      && (!p.chainSatsuma || p.chainSatsuma.used)
      && p.y >= game.camera + HEIGHT * .65 && p.y <= game.camera + HEIGHT - PHYSICS.comboCreatureTopInset);
    if (freeVisible.length) assert.equal(reward.id, freeVisible.at(-1).id);
    for (const p of game.platforms) {
      const old = before.find((entry) => entry.id === p.id);
      if (!old) continue;
      assert.deepEqual([p.x, p.y, p.width, p.item, p.chainSatsuma], [old.x, old.y, old.width, old.item, old.chainSatsuma]);
      if (old.dog && p.id !== source.id) assert.deepEqual(p.dog, old.dog);
    }
  }
});

test('the returning Zab drops from above the screen, settles in 0.75 seconds and freezes on pause', () => {
  const game = setup();
  game.satsumaStreak = 10;
  landing(game, game.platforms[0]);
  const reward = missReward(game, game.platforms.find((p) => p.dog?.comboReward));
  game.camera = Math.max(game.camera, reward.y - HEIGHT + PHYSICS.comboCreatureTopInset);
  game.player.y = game.camera + 200;
  stepGame(game, DT);
  const dog = reward.dog;
  assert.ok(HEIGHT - (reward.y + dog.entryLift - game.camera) < 0);
  const lift = dog.entryLift;
  stepGame(game, .15);
  assert.ok(dog.entryLift > 0 && dog.entryLift < lift);
  assert.ok(dog.entryProgress > 0 && dog.entryProgress < 1);
  game.phase = 'paused';
  const paused = structuredClone(game);
  stepGame(game, .5);
  assert.deepEqual(game, paused);
  game.phase = 'playing';
  for (let frame = 0; frame < 100; frame++) stepGame(game, DT);
  assert.equal(dog.entryLift, 0);
  assert.equal(dog.entryProgress, 1);
  assert.ok(dog.x >= reward.x + 16 && dog.x <= reward.x + reward.width - 16);
});

test('missed rewards can return repeatedly, but completed petting and ordinary Zabs never respawn', () => {
  const game = setup();
  game.satsumaStreak = 10;
  landing(game, game.platforms[0]);
  let reward = game.platforms.find((p) => p.dog?.comboReward);
  for (let miss = 0; miss < 3; miss++) {
    reward = missReward(game, reward);
    assert.ok(reward.dog.returning);
    assert.equal(game.platforms.filter((p) => p.dog?.comboReward).length, 1);
  }
  Object.assign(game.player, { state: 'petting', platformId: reward.id, y: reward.y });
  for (let tap = 0; tap < PHYSICS.dogTaps; tap++) assert.equal(tapDog(game), true);
  assert.equal(reward.dog.petted, true);
  assert.equal(missReward(game, reward), undefined);

  const ordinary = setup();
  const source = ordinary.platforms[0];
  source.dog = { kind: 'zab', x: source.safeX, direction: 1, petted: false };
  assert.equal(missReward(ordinary, source), undefined);
  assert.equal(ordinary.platforms.filter((p) => p.dog?.returning).length, 0);
});
