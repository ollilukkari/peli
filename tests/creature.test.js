import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CREATURE_INTERVALS, PHYSICS, createGame, startGame, stepGame, tapDog, pauseGame, resumeGame,
} from '../src/game.js';

const DT = 1 / 120;

function isolatedGame(seed, creatureMode) {
  const game = createGame(seed, { creatureMode });
  game.gulls = [];
  game.nextGullY = Infinity;
  startGame(game);
  return game;
}

function generateAt(game, height) {
  game.camera = height;
  Object.assign(game.player, { y: height + 250, state: 'trapped', vy: 0 });
  stepGame(game, DT);
}

test('creature profiles are explicit and the default uses the release interval', () => {
  assert.deepEqual(CREATURE_INTERVALS.test, [200, 300]);
  assert.deepEqual(CREATURE_INTERVALS.release, [2000, 3000]);
  assert.equal(createGame(7).creatureMode, 'release');
  assert.deepEqual(createGame(7), createGame(7, { creatureMode: 'release' }));
  assert.throws(() => createGame(7, { creatureMode: 'unknown' }), RangeError);
});

for (const mode of ['test', 'release']) {
  test(`${mode} creatures recur within the requested range while dogs remain present`, () => {
    const [minimum, maximum] = CREATURE_INTERVALS[mode];
    for (let seed = 0; seed < 24; seed++) {
      const game = isolatedGame(seed, mode);
      const seen = new Set();
      let lastCreatureY = game.startY;
      let lastDogY = game.startY;
      let creatures = 0;
      let dogs = 0;
      for (let height = 500; height < 180000; height += 400) {
        generateAt(game, height);
        for (const platform of game.platforms) {
          const pet = platform.dog;
          if (!pet || seen.has(platform.id)) continue;
          seen.add(platform.id);
          assert.equal(platform.item, null);
          assert.equal(platform.chainSatsuma, undefined);
          assert.ok(pet.x >= platform.x + 16 && pet.x <= platform.x + platform.width - 16);
          if (pet.kind === 'zab') {
            const gap = (platform.y - lastCreatureY) / PHYSICS.pixelsPerMeter;
            assert.ok(gap >= minimum && gap <= maximum, `${mode}, seed ${seed}, gap ${gap}`);
            lastCreatureY = platform.y;
            creatures++;
          } else {
            // A creature can replace a coincident dog, making that dog gap longer.
            assert.ok((platform.y - lastDogY) / PHYSICS.pixelsPerMeter >= 1000);
            lastDogY = platform.y;
            dogs++;
          }
        }
      }
      assert.ok(creatures >= (mode === 'test' ? 45 : 4));
      assert.ok(dogs >= 5, `dogs remain present for seed ${seed}`);
    }
  });
}

test('creature timing is deterministic and does not redraw the route or consume platform randomness', () => {
  const geometry = (game) => game.platforms.map(({ id, x, y, width, safeX, safeWidth }) =>
    ({ id, x, y, width, safeX, safeWidth }));
  for (let seed = 0; seed < 12; seed++) {
    const testGame = isolatedGame(seed, 'test');
    const repeat = isolatedGame(seed, 'test');
    const release = isolatedGame(seed, 'release');
    const noCreatures = isolatedGame(seed, 'release');
    noCreatures.nextCreatureY = Infinity;
    for (let height = 500; height < 48000; height += 400) {
      for (const game of [testGame, repeat, release, noCreatures]) generateAt(game, height);
      assert.deepEqual(testGame, repeat);
      for (const game of [release, noCreatures]) {
        assert.deepEqual(geometry(testGame), geometry(game));
        assert.equal(testGame.randomState, game.randomState);
        assert.equal(testGame.generatedSatsumaX, game.generatedSatsumaX);
      }
    }
  }
});

test('a coincident creature replaces the dog and advances each due schedule once', () => {
  const game = isolatedGame(8, 'test');
  const oldTop = game.generatedTopY;
  game.nextCreatureY = oldTop + 1;
  game.nextDogY = oldTop + 1;
  generateAt(game, oldTop);
  const platform = game.platforms.find((entry) => entry.y > oldTop);
  assert.equal(platform.dog.kind, 'zab');
  assert.equal(platform.item, null);
  assert.equal(game.creatureGenerationIndex, 1);
  assert.equal(game.dogGenerationIndex, 1);
  assert.ok(game.nextDogY >= platform.y + 1000 * PHYSICS.pixelsPerMeter);
  assert.ok(game.nextCreatureY >= platform.y + 200 * PHYSICS.pixelsPerMeter);
});

test('a creature that arrives before the dog leaves the dog schedule untouched', () => {
  const game = isolatedGame(8, 'test');
  const nextDogY = game.nextDogY;
  const oldTop = game.generatedTopY;
  game.nextCreatureY = oldTop + 1;
  generateAt(game, oldTop);
  assert.ok(game.platforms.some((platform) => platform.dog?.kind === 'zab'));
  assert.equal(game.nextDogY, nextDogY);
  assert.equal(game.dogGenerationIndex, 0);
});

test('hamster petting freezes the world, pauses safely and grants a green boost after ten strokes', () => {
  const game = isolatedGame(4, 'test');
  const platform = { id: 99, x: 80, width: 100, y: 300, item: null,
    dog: { kind: 'zab', x: 96, direction: 1, petted: false } };
  game.platforms = [platform,
    { id: 100, x: 80, width: 100, safeX: 110, safeWidth: 40, y: 4000, item: null }];
  game.generatedTopY = 1e9;
  game.events = [];
  Object.assign(game.player, { x: 110, y: 301, vy: -300, state: 'air' });
  stepGame(game, DT);
  assert.equal(game.player.state, 'petting');
  assert.equal(game.events[0].type, 'dog');
  const frozen = structuredClone(game);
  stepGame(game, 60, 1);
  assert.deepEqual(game, frozen);
  pauseGame(game);
  assert.equal(tapDog(game), false);
  resumeGame(game);
  for (let stroke = 0; stroke < 9; stroke++) assert.equal(tapDog(game), true);
  assert.equal(game.player.state, 'petting');
  assert.equal(tapDog(game), true);
  assert.equal(game.player.state, 'pet-boost');
  assert.equal(platform.dog.petted, true);
  assert.equal(platform.dog.kind, 'zab');
  assert.equal(game.player.vy, 0);
  assert.equal(tapDog(game), false);
  stepGame(game, PHYSICS.petBoostChargeDuration + PHYSICS.petBoostLaunchDuration);
  assert.equal(game.player.state, 'air');
  assert.equal(game.player.y, 3900);
  assert.equal(game.player.vy, PHYSICS.jumpSpeed);
  game.camera = 0;
  game.platforms = [platform];
  Object.assign(game.player, { x: 110, y: 301, vy: -300 });
  stepGame(game, DT);
  assert.equal(game.player.state, 'air', 'the same creature cannot stop the bunny twice');
});

test('the small hamster turns both ways and stays fully on a minimum-width platform', () => {
  const game = isolatedGame(4, 'test');
  const platform = { id: 99, x: 100, width: 70, y: 300, item: null,
    dog: { kind: 'zab', x: 135, direction: 1, petted: false } };
  game.platforms = [platform];
  game.generatedTopY = 1e9;
  Object.assign(game.player, { y: 500, state: 'trapped' });
  const directions = new Set();
  const positions = new Set();
  for (let frame = 0; frame < 600; frame++) {
    stepGame(game, DT);
    assert.ok(platform.dog.x >= platform.x + 16);
    assert.ok(platform.dog.x <= platform.x + platform.width - 16);
    directions.add(platform.dog.direction);
    positions.add(Math.round(platform.dog.x));
  }
  assert.equal(directions.size, 2);
  assert.ok(positions.size > 10, 'the creature patrols instead of sticking at one edge');
  assert.equal(game.phase, 'playing');
});

test('a creature platform cannot become a satsuma chain target', () => {
  const game = isolatedGame(4, 'test');
  const creature = { id: 99, x: 80, width: 200, safeX: 180, safeWidth: 40, y: 400, item: null,
    dog: { kind: 'zab', x: 180, direction: 1, petted: false } };
  game.platforms = [
    { id: 98, x: 80, width: 200, safeX: 180, safeWidth: 40, y: 300,
      item: { type: 'satsuma', x: 180, used: false } },
    creature,
    { id: 100, x: 80, width: 200, safeX: 180, safeWidth: 40, y: 650, item: null },
  ];
  game.generatedTopY = 1e9;
  Object.assign(game.player, { x: 180, y: 301, vy: -300, state: 'air' });
  stepGame(game, DT);
  assert.equal(game.satsumaStreak, 1);
  assert.notEqual(game.chainTargetId, creature.id);
  assert.equal(creature.item, null);
  assert.equal(creature.chainSatsuma, undefined);
});
