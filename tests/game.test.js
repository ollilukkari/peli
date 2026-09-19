import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WIDTH, HEIGHT, PHYSICS, createGame, startGame, stepGame, tapTrap, strokeDog, pauseGame, resumeGame,
} from '../src/game.js';

const DT = 1 / 120;

function withoutGulls(game) {
  // Isolate platform geometry and fruit guarantees from optional airborne hits.
  game.gulls = [];
  game.nextGullY = Infinity;
  return game;
}

function addGull(game, { x = 180, y = 300, speed = 0, direction = 1, bobSpeed = 0 } = {}) {
  const flightOffset = direction > 0 ? x - 30 : (WIDTH - 60) * 2 - (x - 30);
  const gull = { id: game.gulls.length, x, y, direction, baseY: y,
    flightOffset: flightOffset - game.time * speed, speed,
    bobOffset: 14 - game.time * bobSpeed, bobSpeed };
  game.gulls.push(gull);
  return gull;
}

function addFuturePlatforms(game, startY) {
  for (let index = 0; index < 20; index += 1) {
    game.platforms.push({ id: 10000 + index, x: 0, y: startY + index * 100,
      width: WIDTH, safeX: 180, safeWidth: 40, item: null });
  }
}

function emptyGame() {
  const game = withoutGulls(createGame(1));
  startGame(game);
  game.platforms = [];
  game.generatedTopY = 1e9;
  game.events = [];
  return game;
}

function landingGame(type = null, vx = 0, width = 340) {
  const game = emptyGame();
  game.platforms = [{
    id: 90, x: (WIDTH - width) / 2, y: 150, width,
    item: type ? { type, x: 180, used: false } : null,
  }];
  Object.assign(game.player, { x: 180, y: 150.1, vy: -60, vx });
  if (type === 'satsuma') addFuturePlatforms(game, 400);
  return game;
}

function advance(game, duration, axis = 0) {
  for (let elapsed = 0; elapsed < duration - DT / 2; elapsed += DT) {
    stepGame(game, DT, axis);
  }
}

test('start, pause and resume preserve the simulation clock', () => {
  const game = createGame(8);
  stepGame(game, DT, 1);
  assert.equal(game.time, 0);
  startGame(game);
  assert.equal(game.phase, 'playing');
  assert.equal(game.player.vy, PHYSICS.jumpSpeed);
  stepGame(game, DT, 1);
  pauseGame(game);
  const snapshot = structuredClone(game);
  stepGame(game, DT, -1);
  assert.deepEqual(game, snapshot);
  resumeGame(game);
  stepGame(game, DT, 1);
  assert.equal(game.time, DT * 2);
});

test('satsuma launch gives three times normal jump height', () => {
  function peak(type) {
    const game = landingGame(type);
    stepGame(game, DT);
    const launchY = game.player.y;
    while (game.player.vy > 0) stepGame(game, DT);
    return { height: game.maxY - launchY, game };
  }
  const normal = peak(null);
  const satsuma = peak('satsuma');
  assert.ok(Math.abs(satsuma.height / normal.height - 3) < 0.002);
  assert.ok(['Hyvää!', 'Nam!', 'Njömps!', 'Njömpsis!'].includes(satsuma.game.bubble));
  assert.equal(satsuma.game.platforms[0].item.used, true);
});

test('platform and item collisions require a descending landing from above', () => {
  const game = landingGame('trap');
  Object.assign(game.player, { y: 149, vy: 150 });
  stepGame(game, DT);
  assert.equal(game.player.state, 'air');
  assert.equal(game.platforms[0].item.used, false);

  Object.assign(game.player, { x: 240, y: 150.1, vy: -60 });
  stepGame(game, DT);
  assert.equal(game.player.vy, PHYSICS.jumpSpeed);
  assert.equal(game.platforms[0].item.used, false);

  Object.assign(game.player, { x: 180, y: 150.1, vy: -60 });
  stepGame(game, DT);
  assert.equal(game.player.state, 'trapped');
  assert.equal(game.platforms[0].item.used, true);
});

test('swept collisions land on the highest crossed platform regardless of array order', () => {
  const game = emptyGame();
  game.platforms = [
    { id: 1, x: 100, y: 145, width: 160, item: null },
    { id: 2, x: 100, y: 150, width: 160, item: null },
  ];
  Object.assign(game.player, { y: 153, vy: -1500 });
  stepGame(game, DT);
  assert.equal(game.player.y, 150);
  assert.equal(game.player.vy, PHYSICS.jumpSpeed);
});

test('an exact apex step cannot divide a zero vertical displacement', () => {
  const game = landingGame();
  Object.assign(game.player, { y: 150, vy: PHYSICS.gravity * DT / 2 });
  stepGame(game, DT);
  assert.ok(Number.isFinite(game.player.x));
  assert.ok(Number.isFinite(game.player.y));
  stepGame(game, DT);
  assert.equal(game.player.vy, PHYSICS.jumpSpeed);
});

test('eight trap taps release immediately and used traps do not catch twice', () => {
  const game = landingGame('trap');
  stepGame(game, DT);
  const trappedY = game.player.y;
  const camera = game.camera;
  const score = game.score;
  advance(game, 0.5, 1);
  assert.equal(game.player.y, trappedY);
  assert.equal(game.player.x, 180);
  assert.equal(game.score, score);
  assert.ok(game.camera > camera);

  for (let count = 1; count < 8; count += 1) {
    assert.equal(tapTrap(game), true);
    assert.equal(game.trapTaps, count);
    assert.equal(game.player.state, 'trapped');
  }
  assert.equal(tapTrap(game), true);
  assert.equal(game.player.state, 'air');
  assert.equal(game.player.vy, PHYSICS.jumpSpeed);
  assert.equal(game.trapTaps, 8);
  assert.equal(tapTrap(game), false);
  Object.assign(game.player, { y: 150.1, vy: -60 });
  stepGame(game, DT);
  assert.equal(game.player.state, 'air');
  assert.equal(game.events.filter((event) => event.type === 'trap').length, 1);
});

test('poop preserves direction and faster arrivals slide faster and farther', () => {
  function slide(vx) {
    const game = landingGame('poop', vx);
    stepGame(game, DT, vx / PHYSICS.maxSpeed);
    const initialSpeed = Math.abs(game.player.vx);
    const startX = game.player.x;
    while (game.player.state === 'sliding') stepGame(game, DT, -Math.sign(vx));
    return { distance: Math.abs(game.player.x - startX), initialSpeed, x: game.player.x, game };
  }
  const slow = slide(45);
  const fast = slide(140);
  const left = slide(-140);
  assert.ok(fast.initialSpeed > slow.initialSpeed);
  assert.ok(fast.distance > slow.distance);
  assert.ok(fast.x > 180);
  assert.ok(left.x < 180);
  assert.equal(fast.game.player.vy, PHYSICS.jumpSpeed);
  for (const result of [slow, fast, left]) {
    const previousDistance = result.initialSpeed ** 2 / (2 * 400);
    assert.ok(Math.abs(result.distance - previousDistance * 1.5) < 0.02,
      'the same arrival speed now slides 1.5 times farther before bouncing');
  }
});

test('zero-speed poop causes a stationary wobble followed by a bounce', () => {
  const game = landingGame('poop');
  stepGame(game, DT);
  assert.equal(game.player.state, 'sliding');
  advance(game, 0.1, 1);
  assert.equal(game.player.x, 180);
  assert.equal(game.player.state, 'sliding');
  advance(game, 0.14, 1);
  assert.equal(game.player.state, 'air');
  assert.ok(game.player.vy > 0);
});

test('generated poop is about half as common as traps without increasing other item rates', () => {
  const counts = { satsuma: 0, trap: 0, poop: 0 };
  let platforms = 0;
  for (let seed = 0; seed < 2000; seed += 1) {
    for (const platform of createGame(seed).platforms) {
      if (platform.id <= 3) continue;
      platforms += 1;
      if (platform.item) counts[platform.item.type] += 1;
    }
  }
  assert.ok(counts.poop / counts.trap > 0.44 && counts.poop / counts.trap < 0.56);
  assert.ok(counts.satsuma / platforms > 0.14 && counts.satsuma / platforms < 0.17);
  assert.ok(counts.trap / platforms > 0.10 && counts.trap / platforms < 0.13);
});

test('sliding off a ledge falls, while hitting a wall stops and bounces', () => {
  const edge = landingGame('poop', 220, 40);
  stepGame(edge, DT, 1);
  while (edge.player.state === 'sliding') stepGame(edge, DT);
  assert.equal(edge.player.vy, 0);
  stepGame(edge, DT);
  assert.ok(edge.player.vy < 0);
  assert.ok(edge.player.y < 150);

  const wall = landingGame();
  wall.platforms[0].x = 0;
  wall.platforms[0].width = WIDTH;
  Object.assign(wall.player, {
    x: WIDTH - PHYSICS.playerWidth / 2 - 0.1,
    y: 150, state: 'sliding', vx: 200, vy: 0, platformId: 90, slipRemaining: 0.5,
  });
  stepGame(wall, DT, 1);
  assert.equal(wall.player.x, WIDTH - PHYSICS.playerWidth / 2);
  assert.equal(wall.player.vx, 0);
  assert.equal(wall.player.vy, PHYSICS.jumpSpeed);
});

test('side walls contain the full collision body', () => {
  const game = emptyGame();
  Object.assign(game.player, { x: 11.1, y: 300, vx: -230, vy: 0 });
  stepGame(game, DT, -1);
  assert.equal(game.player.x, PHYSICS.playerWidth / 2);
  assert.equal(game.player.vx, 0);
});

test('camera always advances, follows a boost and ends the game at the bottom', () => {
  const game = landingGame('satsuma');
  stepGame(game, DT);
  let previousCamera = game.camera;
  while (game.player.vy > 0) {
    stepGame(game, DT);
    assert.ok(game.camera > previousCamera);
    assert.ok(HEIGHT - (game.player.y - game.camera) >= HEIGHT * 0.38 - 0.001);
    previousCamera = game.camera;
  }
  const peakScore = game.score;
  game.platforms = [];
  advance(game, 2);
  assert.equal(game.phase, 'over');
  assert.equal(game.score, peakScore);
  assert.equal(game.events.filter((event) => event.type === 'over').length, 1);
  const snapshot = structuredClone(game);
  stepGame(game, DT, 1);
  assert.deepEqual(game, snapshot);
});

test('seed and input history reproduce the same game exactly', () => {
  const first = createGame(5412);
  const second = createGame(5412);
  startGame(first);
  startGame(second);
  for (let frame = 0; frame < 1800; frame += 1) {
    const axis = Math.sin(frame / 43);
    stepGame(first, DT, axis);
    stepGame(second, DT, axis);
    if (frame % 11 === 0) {
      tapTrap(first);
      tapTrap(second);
    }
  }
  assert.deepEqual(first, second);
  assert.notDeepEqual(createGame(0).platforms, createGame(1).platforms);
});

test('the starting ledge stays centered and generated widths use the ten-percent narrower bounds', () => {
  for (let seed = 0; seed < 200; seed++) {
    const game = createGame(seed);
    const initial = game.platforms[0];
    assert.ok(Math.abs(initial.width - 280.8) < 1e-9);
    assert.equal(initial.x + initial.width / 2, WIDTH / 2);
    for (const platform of game.platforms.slice(1)) {
      const opening = platform.id <= 3;
      assert.ok(platform.width >= (opening ? 133.2 : 93.6) - 1e-9);
      assert.ok(platform.width <= (opening ? 162 : 176.4));
      assert.ok(platform.safeWidth > 0);
      assert.ok(platform.safeX - platform.safeWidth / 2 >= platform.x);
      assert.ok(platform.safeX + platform.safeWidth / 2 <= platform.x + platform.width);
    }
  }
});

test('new ledges narrow by ten percent at each actual 250 m boundary and stop at 70 px', () => {
  const baseWidth = createGame(0).platforms[1].width;
  function firstLedgeAt(meters) {
    const game = emptyGame();
    // The first opening gap of seed zero requires the 72 px fruit clearance.
    // Its final height must decide the width even when that correction crosses a boundary.
    game.randomState = 0;
    game.generationIndex = 0;
    game.generatedTopY = game.startY + meters * PHYSICS.pixelsPerMeter - 72;
    game.generatedCenterX = WIDTH / 2;
    game.generatedSafeWidth = PHYSICS.safeWidth;
    game.generatedSatsumaX = null;
    game.camera = game.generatedTopY - 100;
    Object.assign(game.player, { y: game.generatedTopY + 250, vy: 0, state: 'trapped' });
    stepGame(game, DT);
    return { game, ledge: game.platforms[0] };
  }
  for (const [meters, factor] of [[249.99, 1], [250, .9], [250.01, .9],
    [499.99, .9], [500, .81], [500.01, .81], [750, .729]]) {
    const { game, ledge } = firstLedgeAt(meters);
    assert.ok(Math.abs((ledge.y - game.startY) / PHYSICS.pixelsPerMeter - meters) < 1e-9);
    assert.ok(Math.abs(ledge.width - baseWidth * factor) < 1e-9, `${meters} m`);
  }
  for (const meters of [2000, 2500, 10000]) assert.equal(firstLedgeAt(meters).ledge.width, 70);
});

test('many generated routes have reachable gaps and an unobstructed landing patch', () => {
  const jumpHeight = PHYSICS.jumpSpeed ** 2 / (2 * PHYSICS.gravity);
  for (let seed = 0; seed < 1500; seed += 1) {
    const game = createGame(seed);
    for (let index = 1; index < game.platforms.length; index += 1) {
      const previous = game.platforms[index - 1];
      const next = game.platforms[index];
      const rise = next.y - previous.y;
      assert.ok(rise >= 45 && rise <= 120);
      assert.ok(rise < jumpHeight * 0.81);
      const landingTime = (PHYSICS.jumpSpeed
        + Math.sqrt(PHYSICS.jumpSpeed ** 2 - 2 * PHYSICS.gravity * rise)) / PHYSICS.gravity;
      // Both edges of the previous landing patch must reach the next patch,
      // even when the bunny initially moves at full speed the wrong way.
      const turnTime = PHYSICS.maxSpeed * 2 / PHYSICS.acceleration;
      const conservativeDistance = PHYSICS.maxSpeed * (landingTime - turnTime);
      const requiredDistance = Math.abs(next.safeX - previous.safeX)
        + previous.safeWidth / 2 - next.safeWidth / 2;
      assert.ok(requiredDistance <= conservativeDistance - 9.999);
      assert.ok(next.x >= 0 && next.x + next.width <= WIDTH);
      assert.ok(next.safeWidth >= 5.6 - 1e-9);
      if (next.item) {
        const distance = Math.abs(next.item.x - next.safeX);
        assert.ok(distance > next.safeWidth / 2 + PHYSICS.playerWidth / 2 + PHYSICS.itemHalfWidth);
      }
    }
  }
});

test('generation remains bounded and reachable late in a run', () => {
  const game = createGame(791);
  startGame(game);
  for (let rise = 500; rise <= 25000; rise += 500) {
    const existing = new Map(game.platforms.map(({ id, x, y, width }) => [id, { x, y, width }]));
    game.camera = rise;
    Object.assign(game.player, { y: rise + 250, vy: 0, state: 'trapped' });
    stepGame(game, DT);
    assert.ok(game.platforms.length < 30);
    for (const platform of game.platforms) {
      assert.ok(platform.width >= 70);
      assert.ok(platform.safeWidth >= 5.6 - 1e-9);
      assert.ok(platform.safeX - platform.safeWidth / 2 - PHYSICS.playerWidth / 2 >= platform.x);
      assert.ok(platform.safeX + platform.safeWidth / 2 + PHYSICS.playerWidth / 2 <= platform.x + platform.width);
      if (existing.has(platform.id)) {
        assert.deepEqual({ x: platform.x, y: platform.y, width: platform.width }, existing.get(platform.id),
          'existing ledges keep their geometry as the score increases');
      }
    }
    for (let index = 1; index < game.platforms.length; index += 1) {
      const previous = game.platforms[index - 1];
      const next = game.platforms[index];
      const landingTime = (PHYSICS.jumpSpeed + Math.sqrt(PHYSICS.jumpSpeed ** 2
        - 2 * PHYSICS.gravity * (next.y - previous.y))) / PHYSICS.gravity;
      const reach = PHYSICS.maxSpeed * (landingTime - PHYSICS.maxSpeed * 2 / PHYSICS.acceleration);
      assert.ok(next.y - previous.y >= 45 && next.y - previous.y <= 120);
      assert.ok(Math.abs(next.safeX - previous.safeX)
        + previous.safeWidth / 2 - next.safeWidth / 2 <= reach - 9.999);
      if (next.item) {
        assert.ok(Math.abs(next.item.x - next.safeX)
          > next.safeWidth / 2 + PHYSICS.playerWidth / 2 + PHYSICS.itemHalfWidth);
      }
    }
  }
});

test('routes visibly vary their heights, widths and left-to-right positions', () => {
  const rises = [];
  const widths = [];
  const shifts = [];
  const centers = [];
  for (let seed = 0; seed < 500; seed += 1) {
    const game = createGame(seed);
    for (let index = 4; index < game.platforms.length; index += 1) {
      const previous = game.platforms[index - 1];
      const next = game.platforms[index];
      rises.push(next.y - previous.y);
      widths.push(next.width);
      shifts.push(Math.abs(next.safeX - previous.safeX));
      centers.push(next.safeX);
    }
  }
  const fraction = (values, predicate) => values.filter(predicate).length / values.length;
  assert.ok(fraction(rises, (rise) => rise <= 72.001) > 0.2);
  assert.ok(fraction(rises, (rise) => rise > 105) > 0.15);
  assert.ok(fraction(widths, (width) => width < 108) > 0.12);
  assert.ok(fraction(widths, (width) => width > 162) > 0.12);
  assert.ok(fraction(shifts, (shift) => shift > 80) > 0.35);
  assert.ok(fraction(centers, (center) => center < 105) > 0.15);
  assert.ok(fraction(centers, (center) => center > 255) > 0.15);
  assert.ok(fraction(centers, (center) => center >= 135 && center <= 225) > 0.2);
});

test('real physics can land safely after sampled jumps from either patch edge and incoming direction', () => {
  function tryJump(previous, next, startX, startVx, axis) {
    const game = emptyGame();
    game.camera = previous.y - 150;
    game.maxY = previous.y;
    game.startY = previous.y;
    game.platforms = [structuredClone(next)];
    addFuturePlatforms(game, next.y + 250);
    Object.assign(game.player, {
      x: startX, y: previous.y, vx: startVx, vy: PHYSICS.jumpSpeed,
    });
    for (let frame = 0; frame < 120; frame += 1) {
      stepGame(game, DT, axis);
      if (game.events.length || game.player.y < next.y && game.player.vy < 0) break;
    }
    return game;
  }

  for (let seed = 0; seed < 80; seed += 1) {
    const route = createGame(seed);
    if (seed % 2 === 1) {
      startGame(route);
      for (let height = 500; height <= 18000; height += 500) {
        route.camera = height;
        Object.assign(route.player, { y: height + 250, vy: 0, state: 'trapped' });
        stepGame(route, DT);
      }
    }
    for (let index = 1; index < route.platforms.length; index += 3) {
      const previous = route.platforms[index - 1];
      const next = route.platforms[index];
      for (const side of [-1, 1]) {
        for (const startVx of [-PHYSICS.maxSpeed, 0, PHYSICS.maxSpeed]) {
          const startX = previous.safeX + side * previous.safeWidth / 2;
          let leftAxis = -1;
          let rightAxis = 1;
          const leftX = tryJump(previous, next, startX, startVx, leftAxis).player.x;
          const rightX = tryJump(previous, next, startX, startVx, rightAxis).player.x;
          const targetX = Math.max(leftX + 2, Math.min(rightX - 2, next.safeX));
          let result;
          for (let attempt = 0; attempt < 15; attempt += 1) {
            const axis = (leftAxis + rightAxis) / 2;
            result = tryJump(previous, next, startX, startVx, axis);
            if (result.player.x < targetX) leftAxis = axis;
            else rightAxis = axis;
          }
          const context = `seed ${seed}, platform ${next.id}, side ${side}, velocity ${startVx}`;
          assert.ok(['bounce', 'dog'].includes(result.events[0]?.type), context);
          assert.ok(Math.abs(result.player.x - next.safeX) <= next.safeWidth / 2, context);
          assert.equal(result.player.y, next.y, context);
          if (result.platforms[0].item) assert.equal(result.platforms[0].item.used, false, context);
        }
      }
    }
  }
});

test('complete generated scenes support continuous routes without using satsumas', () => {
  for (let seed = 0; seed < 80; seed += 1) {
    let game = withoutGulls(createGame(seed));
    startGame(game);
    game.events = [];
    for (let hop = 0; hop < 24; hop += 1) {
      let best = null;
      function tryControls(firstAxis, secondAxis = firstAxis, switchFrame = 0) {
        const trial = structuredClone(game);
        trial.events = [];
        for (let frame = 0; frame < 125; frame += 1) {
          stepGame(trial, DT, frame < switchFrame ? firstAxis : secondAxis);
          if (trial.events.length) break;
        }
        if (trial.events[0]?.type !== 'bounce' || trial.player.y <= game.player.y) return;
        const platform = trial.platforms.find((entry) => entry.y === trial.player.y);
        // The central patch guarantees an adjacent jump in isolation. A real
        // run can also safely skip to an upper platform outside that patch.
        if (!platform || trial.player.x - PHYSICS.playerWidth / 2 < platform.x
          || trial.player.x + PHYSICS.playerWidth / 2 > platform.x + platform.width) return;
        if (!best || trial.player.y > best.player.y
          || trial.player.y === best.player.y && Math.abs(trial.player.vx) < Math.abs(best.player.vx)) best = trial;
      }

      for (let position = 0; position <= 40; position += 1) tryControls(-1 + position / 20);
      if (!best) {
        // Nearby platforms can require a midair turn to pass an upper ledge
        // before landing. Test real controls with all intervening hazards.
        for (const switchFrame of [12, 24, 30, 36, 42, 48, 60]) {
          for (const firstAxis of [-1, -0.5, 0, 0.5, 1]) {
            for (const secondAxis of [-1, -0.5, 0, 0.5, 1]) {
              tryControls(firstAxis, secondAxis, switchFrame);
            }
          }
        }
      }
      assert.ok(best, `seed ${seed}, jump ${hop}: no safe normal-jump continuation`);
      assert.equal(best.phase, 'playing');
      game = best;
      game.events = [];
    }
  }
});

function collectInitialSatsuma({ seed = 42, x = 180, vx = 0, dt = DT, extraPlatforms } = {}) {
  const game = withoutGulls(createGame(seed));
  startGame(game);
  const source = game.platforms[0];
  source.x = 0;
  source.width = WIDTH;
  source.item = { type: 'satsuma', x, used: false };
  if (extraPlatforms) {
    source.y = 150;
    game.generatedTopY = 1e9;
    game.platforms = [source, ...structuredClone(extraPlatforms)];
    addFuturePlatforms(game, 650);
    game.platforms.sort((a, b) => a.y - b.y);
  }
  Object.assign(game.player, { x, y: source.y + 0.1, vx, vy: -60 });
  stepGame(game, dt, vx / PHYSICS.maxSpeed);
  game.events = [];
  return game;
}

function takeChainJump(game, dt = DT) {
  const target = game.platforms.find((platform) => platform.id === game.chainTargetId);
  const fruit = [target?.item, target?.chainSatsuma].find((item) => item?.type === 'satsuma' && !item.used);
  assert.ok(target && target.y > game.player.y && fruit);
  // These are real, constant joystick inputs; no state teleportation during
  // the jump. All platforms, collision ordering and camera motion remain active.
  for (let control = 0; control <= 100; control += 1) {
    const trial = structuredClone(game);
    trial.events = [];
    for (let frame = 0; frame < Math.ceil(2 / dt); frame += 1) {
      stepGame(trial, dt, -1 + control / 50);
      if (trial.events.length) break;
    }
    if (trial.events[0]?.type === 'satsuma'
      && trial.player.y === target.y
      && [trial.platforms.find((platform) => platform.id === target.id)?.item,
        trial.platforms.find((platform) => platform.id === target.id)?.chainSatsuma]
        .some((item) => item?.type === 'satsuma' && item.used && item.x === fruit.x)) return trial;
  }
  assert.fail(`No direct joystick input reaches chain target ${target.id} from x=${game.player.x}, vx=${game.player.vx}`);
}

test('each collected satsuma provides reachable fruit on existing geometry, including both walls', () => {
  for (const dt of [DT, 1 / 60]) {
    for (const x of [11, 44, 180, 316, 349]) {
      for (const vx of [-PHYSICS.maxSpeed, 0, PHYSICS.maxSpeed]) {
        const game = collectInitialSatsuma({ x, vx, dt });
        assert.equal(game.satsumaStreak, 1);
        const target = game.platforms.find((platform) => platform.id === game.chainTargetId);
        const expectedHeight = (PHYSICS.jumpSpeed * PHYSICS.boostMultiplier) ** 2 / (2 * PHYSICS.gravity);
        assert.ok(!target.chain);
        assert.ok(target.y > game.player.y && target.y - game.player.y <= expectedHeight);
        assert.ok(target.x >= 0 && target.x + target.width <= WIDTH);
        const landed = takeChainJump(game, dt);
        assert.equal(landed.satsumaStreak, 2);
        assert.equal(landed.phase, 'playing');
        const following = landed.platforms.find((platform) => platform.id === landed.chainTargetId);
        assert.ok(following.y > target.y
          && [following.item, following.chainSatsuma].some((item) => item?.type === 'satsuma' && !item.used));
      }
    }
  }
});

test('an occupied target receives a separate fruit and retains its original hazard', () => {
  for (const type of ['trap', 'poop']) {
    const obstacle = { id: 999, x: 40, y: 450, width: 280,
      safeX: 180, safeWidth: 40, item: { type, x: 60, used: false } };
    const game = collectInitialSatsuma({ extraPlatforms: [obstacle] });
    const target = game.platforms.find((platform) => platform.id === 999);
    assert.equal(game.chainTargetId, 999);
    assert.deepEqual(target.item, obstacle.item);
    assert.equal(target.chainSatsuma.type, 'satsuma');
    const result = takeChainJump(game);
    assert.equal(result.events[0].type, 'satsuma');
    assert.deepEqual(result.platforms.find((platform) => platform.id === 999).item, obstacle.item);
  }
});

test('existing lower fruit is reused when its direct landing path is clear', () => {
  for (const fruitX of [180, 225]) {
    const existing = {
      id: 500, x: fruitX - 45, y: 150 + 220, width: 90, safeX: fruitX, safeWidth: 40,
      item: { type: 'satsuma', x: fruitX, used: false },
    };
    const game = collectInitialSatsuma({ vx: -140, extraPlatforms: [existing] });
    assert.equal(game.chainTargetId, 500);
    assert.equal(game.platforms.find((platform) => platform.id === 500).chainSatsuma, undefined);
    assert.equal(game.platforms.filter((platform) => platform.chain).length, 0);
    assert.equal(takeChainJump(game).satsumaStreak, 2);
  }
});

test('a shadowed or horizontally unreachable existing satsuma is not a chain guarantee', () => {
  const shadowed = collectInitialSatsuma({ extraPlatforms: [
    { id: 501, x: 0, y: 340, width: WIDTH, safeX: 180, safeWidth: 40, item: { type: 'satsuma', x: 180, used: false } },
    { id: 502, x: 0, y: 430, width: WIDTH, safeX: 180, safeWidth: 40, item: { type: 'poop', x: 330, used: false } },
  ] });
  assert.notEqual(shadowed.chainTargetId, 501);
  assert.equal(takeChainJump(shadowed).satsumaStreak, 2);
  const unreachable = collectInitialSatsuma({ x: 11, vx: -230, extraPlatforms: [
    { id: 503, x: 300, y: 590, width: 60, safeX: 330, safeWidth: 20, item: { type: 'satsuma', x: 330, used: false } },
    { id: 504, x: 0, y: 430, width: 240, safeX: 120, safeWidth: 40, item: null },
  ] });
  assert.notEqual(unreachable.chainTargetId, 503);
  assert.equal(takeChainJump(unreachable).satsumaStreak, 2);
});

test('combos count consecutive satsumas and reset on every other kind of landing', () => {
  assert.equal(createGame().satsumaStreak, 0);
  let game = collectInitialSatsuma();
  for (let streak = 2; streak <= 4; streak += 1) {
    game = takeChainJump(game);
    assert.equal(game.satsumaStreak, streak);
    assert.equal(game.events[0].type, 'satsuma');
    assert.equal(game.score, Math.floor((game.maxY - game.startY) / PHYSICS.pixelsPerMeter));
  }
  for (const type of [null, 'satsuma', 'trap', 'poop']) {
    const next = structuredClone(game);
    const platformY = next.player.y - 20;
    next.generatedTopY = 1e9;
    next.platforms = [{
      id: 600, x: 0, y: platformY, width: WIDTH,
      item: type ? { type, x: next.player.x, used: type === 'satsuma' } : null,
    }];
    Object.assign(next.player, { y: platformY + 0.1, vx: 0, vy: -60 });
    stepGame(next, DT);
    assert.equal(next.satsumaStreak, 0, `landing on ${type}`);
    assert.equal(next.chainTargetId, null);
  }
});

test('chain fruit leaves all platform geometry and normal route state intact', () => {
  for (let seed = 0; seed < 40; seed += 1) {
    let game = withoutGulls(createGame(seed));
    startGame(game);
    const initialRoute = [game.generatedTopY, game.generatedCenterX, game.generatedSafeWidth, game.generationIndex];
    const geometry = game.platforms.map(({ id, x, y, width }) => ({ id, x, y, width }));
    const initialPlatform = game.platforms[0];
    initialPlatform.item = { type: 'satsuma', x: 180, used: false };
    Object.assign(game.player, { y: initialPlatform.y + 0.1, vy: -60 });
    stepGame(game, DT);
    assert.deepEqual([game.generatedTopY, game.generatedCenterX, game.generatedSafeWidth, game.generationIndex], initialRoute);
    assert.deepEqual(game.platforms.map(({ id, x, y, width }) => ({ id, x, y, width })), geometry);
    for (let jump = 0; jump < 4; jump += 1) {
      game = takeChainJump(game);
      for (let index = 1; index < game.platforms.length; index += 1) {
        assert.ok(game.platforms[index].y >= game.platforms[index - 1].y);
      }
      const normal = game.platforms.filter((platform) => !platform.chain);
      assert.equal(normal.length, game.platforms.length);
      const lastNormal = normal.at(-1);
      assert.equal(game.generatedTopY, lastNormal.y);
      assert.equal(game.generatedCenterX, lastNormal.safeX);
      assert.equal(game.generatedSafeWidth, lastNormal.safeWidth);
      for (let index = 1; index < normal.length; index += 1) {
        const rise = normal[index].y - normal[index - 1].y;
        assert.ok(rise >= 45 && rise <= 120);
      }
    }
  }
});

test('landing feedback records the real impact location, simulation time and fresh item type', () => {
  const fresh = createGame(4);
  assert.equal(fresh.lastLanding, null);
  startGame(fresh);
  assert.equal(fresh.lastLanding, null);
  for (const type of [null, 'satsuma', 'trap', 'poop']) {
    const game = landingGame(type, 30);
    game.time = 2;
    stepGame(game, DT, 30 / PHYSICS.maxSpeed);
    assert.deepEqual(game.lastLanding, {
      x: game.player.x, y: 150, time: 2 + DT, type: type ?? 'normal',
    });
    assert.ok(game.lastLanding.x > 180);
  }
  for (const state of ['used', 'missed']) {
    const game = landingGame('satsuma');
    if (state === 'used') game.platforms[0].item.used = true;
    else game.platforms[0].item.x = 250;
    stepGame(game, DT);
    assert.equal(game.lastLanding.type, 'normal');
    const impact = structuredClone(game.lastLanding);
    stepGame(game, DT);
    assert.deepEqual(game.lastLanding, impact);
  }
});

test('many seeds and incoming directions preserve geometry and leave chain fruit unobstructed', () => {
  for (let seed = 0; seed < 250; seed += 1) {
    for (const x of [11, 180, 349]) {
      for (const vx of [-PHYSICS.maxSpeed, 0, PHYSICS.maxSpeed]) {
        const game = collectInitialSatsuma({ seed, x, vx });
        const target = game.platforms.find((platform) => platform.id === game.chainTargetId);
        const fruit = [target.item, target.chainSatsuma].find((item) => item?.type === 'satsuma' && !item.used);
        assert.ok(target.y > game.player.y && fruit, `seed ${seed}, x ${x}, vx ${vx}`);
        assert.ok(game.platforms.every((platform) => !platform.chain && platform.id >= 0));
        for (const other of game.platforms) {
          if (other.id === target.id || other.y <= target.y) continue;
          const overlapsX = fruit.x + 22 > other.x && fruit.x - 22 < other.x + other.width;
          if (overlapsX) assert.ok(other.y - target.y >= 72 - 1e-6);
        }
        if (target.chainSatsuma && target.item && !target.item.used) {
          assert.ok(Math.abs(target.chainSatsuma.x - target.item.x) >= 45);
        }
        if (seed % 50 === 0) assert.equal(takeChainJump(game).satsumaStreak, 2);
      }
    }
  }
});

test('late narrow routes retain hazards and offer real satsuma continuations in every incoming direction', () => {
  let narrowTargets = 0;
  let sharedTargets = 0;
  const itemTypes = new Set();
  for (let seed = 0; seed < 100; seed++) {
    const route = withoutGulls(createGame(seed));
    startGame(route);
    for (const altitude of [8500, 18000, 30000]) {
      for (let height = route.camera + 500; height <= altitude + 500; height += 500) {
        route.camera = height;
        Object.assign(route.player, { y: height + 250, vy: 0, state: 'trapped' });
        stepGame(route, DT);
      }
      for (const platform of route.platforms) {
        if (platform.width === 70 && platform.item) itemTypes.add(platform.item.type);
      }
      const sources = route.platforms.filter((platform) => platform.item?.type === 'satsuma'
        && platform.y < route.camera + HEIGHT);
      for (const source of sources) {
        for (const vx of [-PHYSICS.maxSpeed, 0, PHYSICS.maxSpeed]) {
          for (const offset of [-20, 0, 20]) {
            const game = structuredClone(route);
            const geometry = game.platforms.map(({ id, x, y, width }) => ({ id, x, y, width }));
            const hazards = game.platforms.filter((platform) => ['trap', 'poop'].includes(platform.item?.type))
              .map((platform) => ({ id: platform.id, item: structuredClone(platform.item) }));
            game.camera = source.y - 180;
            Object.assign(game.player, { x: Math.max(11, Math.min(WIDTH - 11, source.item.x + offset)),
              y: source.y + .1, vy: -60, vx, state: 'air' });
            stepGame(game, DT, vx / PHYSICS.maxSpeed);
            assert.equal(game.satsumaStreak, 1);
            const target = game.platforms.find((platform) => platform.id === game.chainTargetId);
            const fruit = [target.item, target.chainSatsuma].find((item) => item?.type === 'satsuma' && !item.used);
            assert.ok(target.y > source.y && fruit);
            if (target.width < 94) narrowTargets++;
            if (target.chainSatsuma && target.item && !target.item.used) {
              assert.ok(Math.abs(target.chainSatsuma.x - target.item.x) >= (target.width < 94 ? 34 : 45));
              sharedTargets++;
            }
            for (const platform of game.platforms) {
              const before = geometry.find((entry) => entry.id === platform.id);
              if (before) assert.deepEqual({ id: platform.id, x: platform.x, y: platform.y, width: platform.width }, before);
            }
            for (const hazard of hazards) {
              const retained = game.platforms.find((platform) => platform.id === hazard.id);
              if (retained) assert.deepEqual(retained.item, hazard.item);
            }
            if (seed % 25 === 0 && vx === 0 && offset === 0) assert.equal(takeChainJump(game).satsumaStreak, 2);
          }
        }
      }
    }
  }
  assert.ok(narrowTargets > 0 && sharedTargets > 0);
  assert.deepEqual([...itemTypes].sort(), ['poop', 'satsuma', 'trap'], 'all generated item types remain on 70 px ledges');
});

test('normal generation reserves fruit headroom before platforms become visible', () => {
  let shortClearGaps = 0;
  for (let seed = 0; seed < 500; seed += 1) {
    const game = createGame(seed);
    for (let index = 1; index < game.platforms.length; index += 1) {
      const lower = game.platforms[index - 1];
      const upper = game.platforms[index];
      const overlapsReserve = upper.x + upper.width > lower.safeX - lower.safeWidth / 2 - 22
        && upper.x < lower.safeX + lower.safeWidth / 2 + 22;
      if (overlapsReserve) assert.ok(upper.y - lower.y >= 72 - 1e-6);
      else if (upper.y - lower.y < 70) shortClearGaps += 1;
      if (lower.item?.type === 'satsuma'
        && lower.item.x + 22 > upper.x && lower.item.x - 22 < upper.x + upper.width) {
        assert.ok(upper.y - lower.y >= 72 - 1e-6);
      }
    }
  }
  assert.ok(shortClearGaps > 0, 'short height variation remains when the side lane leaves headroom');
});

test('seed 44 can chain from the right wall onto a clear outer landing area', () => {
  const game = collectInitialSatsuma({ seed: 44, x: 349, vx: 0 });
  const target = game.platforms.find((platform) => platform.id === game.chainTargetId);
  assert.ok(Math.abs(target.chainSatsuma.x - target.safeX) > target.safeWidth / 2);
  assert.equal(takeChainJump(game).satsumaStreak, 2);
  assert.ok(game.platforms.every((platform) => platform.id >= 0 && !platform.chain));
});

test('seed 35 reserves headroom for a naturally generated fruit outside the center patch', () => {
  const game = createGame(35);
  const lower = game.platforms.find((platform) => platform.id === 8);
  const upper = game.platforms.find((platform) => platform.id === 9);
  assert.equal(lower.item.type, 'satsuma');
  assert.ok(lower.item.x > lower.safeX + lower.safeWidth / 2);
  assert.ok(lower.item.x + 22 > upper.x && lower.item.x - 22 < upper.x + upper.width);
  assert.ok(upper.y - lower.y >= 72 - 1e-6);
});

test('gulls kick airborne bunnies diagonally up and away on either side', () => {
  for (const side of [-1, 1]) {
    const game = emptyGame();
    addGull(game);
    Object.assign(game.player, { x: 180 + side * 20, y: 284, vy: -100 });
    game.satsumaStreak = 3;
    game.chainTargetId = 55;
    stepGame(game, DT);
    assert.equal(game.player.vx, side * PHYSICS.gullSideSpeed);
    assert.equal(game.player.vy, PHYSICS.gullJumpSpeed);
    assert.equal(game.player.state, 'air');
    assert.equal(game.satsumaStreak, 3);
    assert.equal(game.chainTargetId, 55);
    assert.equal(game.events.filter((event) => event.type === 'gull').length, 1);
    assert.deepEqual(game.lastGullHit, { x: game.player.x,
      y: game.player.y + PHYSICS.playerHeight / 2, time: game.time });
    const kickedVx = Math.abs(game.player.vx);
    stepGame(game, DT, -side);
    assert.ok(Math.abs(game.player.vx) < kickedVx, 'normal input recovers after the impulse');
  }
});

test('swept gull hits catch fast boosted crossings and preserve remaining upward speed', () => {
  const game = emptyGame();
  addGull(game);
  Object.assign(game.player, { x: 160, y: 220, vy: 1600 });
  stepGame(game, 0.1);
  assert.equal(game.events[0]?.type, 'gull');
  assert.ok(game.player.y < 300);
  assert.ok(game.player.vy > PHYSICS.gullJumpSpeed);
  assert.ok(game.player.vy <= 1600);
  assert.equal(game.player.vx, -PHYSICS.gullSideSpeed);
});

test('moving gull sweeps include both passes through a horizontal turn', () => {
  const game = emptyGame();
  addGull(game, { x: 230, speed: 1000 });
  Object.assign(game.player, { x: 300, y: 280, vy: 150 });
  stepGame(game, 0.2);
  assert.equal(game.events[0]?.type, 'gull');
  assert.equal(game.player.vx, PHYSICS.gullSideSpeed);
  assert.equal(game.gulls[0].x, 230);
  assert.equal(game.gulls[0].direction, -1);
  assert.ok(Number.isFinite(game.player.x) && Number.isFinite(game.player.y));
});

test('gull body edges collide while nearby nonoverlapping paths miss', () => {
  for (const gap of [0, 0.1]) {
    const game = emptyGame();
    addGull(game);
    Object.assign(game.player, { x: 180 + (PHYSICS.playerWidth + PHYSICS.gullWidth) / 2 + gap,
      y: 284, vy: 0 });
    stepGame(game, DT);
    assert.equal(game.events.some((event) => event.type === 'gull'), gap === 0);
    assert.ok(Number.isFinite(game.player.x) && Number.isFinite(game.player.y));
  }
});

test('the first crossed obstacle decides between platform landing and gull impact', () => {
  for (const gullY of [150, 210]) {
    const game = emptyGame();
    addGull(game, { y: gullY });
    game.platforms = [{ id: 10, x: 100, y: 185, width: 160, item: { type: 'trap', x: 180, used: false } }];
    Object.assign(game.player, { x: 180, y: 220, vy: -1000 });
    stepGame(game, 0.1);
    if (gullY === 150) {
      assert.equal(game.events[0]?.type, 'trap');
      assert.equal(game.player.state, 'trapped');
      assert.equal(game.lastGullHit, null);
    } else {
      assert.equal(game.events[0]?.type, 'gull');
      assert.equal(game.platforms[0].item.used, false);
    }
  }
});

test('gull hits have one shared cooldown and can hit again after it expires', () => {
  const game = emptyGame();
  addGull(game);
  addGull(game, { x: 190 });
  Object.assign(game.player, { x: 180, y: 284, vy: 0 });
  stepGame(game, DT);
  assert.equal(game.events.filter((event) => event.type === 'gull').length, 1);
  Object.assign(game.player, { x: 180, y: 284, vy: 0, vx: 0 });
  stepGame(game, 0.3);
  assert.equal(game.events.filter((event) => event.type === 'gull').length, 1);
  game.time = game.gullInvulnerableUntil;
  Object.assign(game.player, { x: 180, y: 284, vy: 0, vx: 0 });
  stepGame(game, DT);
  assert.equal(game.events.filter((event) => event.type === 'gull').length, 2);
});

test('gulls push away from walls and never free a trap or interrupt a slide', () => {
  for (const side of [-1, 1]) {
    const game = emptyGame();
    addGull(game, { x: side < 0 ? 30 : 330 });
    Object.assign(game.player, { x: side < 0 ? 11 : 349, y: 284, vy: 0 });
    stepGame(game, DT);
    assert.equal(game.player.vx, -side * PHYSICS.gullSideSpeed);
    assert.ok(game.player.x >= 11 && game.player.x <= 349);
  }
  for (const state of ['trapped', 'sliding']) {
    const game = emptyGame();
    addGull(game);
    game.platforms = [{ id: 10, x: 0, y: 284, width: WIDTH, item: null }];
    Object.assign(game.player, { x: 180, y: 284, vy: 0, vx: 80,
      state, platformId: 10, slipRemaining: 1 });
    stepGame(game, DT);
    assert.equal(game.player.state, state);
    assert.equal(game.events.some((event) => event.type === 'gull'), false);
    assert.equal(game.lastGullHit, null);
  }
});

test('gull flight is frozen in every inactive phase', () => {
  for (const phase of ['ready', 'paused', 'over']) {
    const game = createGame(9);
    game.phase = phase;
    const snapshot = structuredClone(game);
    stepGame(game, 0.5, 1);
    assert.deepEqual(game, snapshot);
  }
});

test('gull flights are deterministic, sparse, bounded and independent of platform randomness', () => {
  const first = createGame(456);
  const second = createGame(456);
  const noGulls = withoutGulls(createGame(456));
  assert.ok(first.gulls.every((gull) => gull.y > HEIGHT));
  assert.notDeepEqual(first.gulls, createGame(457).gulls);
  for (const game of [first, second, noGulls]) startGame(game);
  let sawLeft = false;
  let sawRight = false;
  for (let frame = 0; frame < 800; frame += 1) {
    const camera = frame * 30;
    for (const game of [first, second, noGulls]) {
      game.camera = camera;
      Object.assign(game.player, { y: camera + 250, state: 'trapped', vy: 0 });
      stepGame(game, 0.05);
    }
    assert.deepEqual(first, second);
    assert.deepEqual(first.platforms, noGulls.platforms);
    assert.equal(first.randomState, noGulls.randomState);
    assert.ok(first.gulls.length <= 3);
    assert.ok(first.gulls.filter((gull) => gull.y >= first.camera && gull.y <= first.camera + HEIGHT).length <= 2);
    for (const gull of first.gulls) {
      assert.ok(gull.x >= 30 && gull.x <= WIDTH - 30);
      assert.ok(Math.abs(gull.y - gull.baseY) <= 14);
      assert.ok(gull.baseY + 14 >= first.camera - 60);
      sawLeft ||= gull.direction === -1;
      sawRight ||= gull.direction === 1;
    }
  }
  assert.ok(sawLeft && sawRight);
});


test('dogs recur at 1000–2000 m intervals and patrol inside their platforms', () => {
  for (let seed = 0; seed < 20; seed++) {
    const game = withoutGulls(createGame(seed));
    startGame(game);
    let lastDogY = game.startY;
    const seen = new Set();
    for (let height = 500; height < 150000; height += 400) {
      game.camera = height;
      Object.assign(game.player, { y: height + 250, state: 'trapped' });
      stepGame(game, DT);
      for (const platform of game.platforms) {
        if (!platform.dog || seen.has(platform.id)) continue;
        const gap = (platform.y - lastDogY) / PHYSICS.pixelsPerMeter;
        assert.ok(gap >= 1000 && gap <= 2000, `gap ${gap}, seed ${seed}`);
        assert.equal(platform.item, null);
        assert.ok(platform.dog.x >= platform.x + 16);
        assert.ok(platform.dog.x <= platform.x + platform.width - 16);
        seen.add(platform.id);
        lastDogY = platform.y;
      }
    }
    assert.ok(seen.size >= 5);
  }
});

test('nearby dog landing freezes the world until ten strokes and cannot trap twice', () => {
  const game = emptyGame();
  const platform = { id: 9, x: 80, width: 100, y: 300, item: null,
    dog: { x: 96, direction: 1, petted: false } };
  game.platforms = [platform];
  Object.assign(game.player, { x: 110, y: 301, vy: -300 });
  stepGame(game, DT);
  assert.equal(game.player.state, 'petting');
  const snapshot = JSON.stringify(game);
  stepGame(game, 60, 1);
  assert.equal(JSON.stringify(game), snapshot, 'mandatory petting must never cause a scrolling loss');
  assert.equal(tapTrap(game), false);
  pauseGame(game);
  assert.equal(strokeDog(game), false);
  resumeGame(game);
  for (let i = 0; i < 9; i++) assert.equal(strokeDog(game), true);
  assert.equal(game.player.state, 'petting');
  strokeDog(game);
  assert.equal(game.player.state, 'air');
  assert.equal(platform.dog.petted, true);
  assert.equal(game.player.vy, PHYSICS.jumpSpeed);
  assert.equal(strokeDog(game), false);
  Object.assign(game.player, { x: 110, y: 301, vy: -300 });
  stepGame(game, DT);
  assert.equal(game.player.state, 'air');
});

test('a distant landing and an upward pass do not trigger dog petting', () => {
  for (const [x, vy] of [[240, -300], [110, 300]]) {
    const game = emptyGame();
    game.platforms = [{ id: 9, x: 80, width: 200, y: 300, item: null,
      dog: { x: 96, direction: 1, petted: false } }];
    Object.assign(game.player, { x, y: vy > 0 ? 299 : 301, vy });
    stepGame(game, DT);
    assert.equal(game.player.state, 'air');
  }
});


test('a dog walks both ways and never steps off its platform', () => {
  const game = emptyGame();
  const platform = { id: 8, x: 100, width: 70, y: 300, item: null,
    dog: { x: 116, direction: 1, petted: false } };
  game.platforms = [platform];
  Object.assign(game.player, { y: 500, state: 'trapped' });
  const directions = new Set();
  const positions = new Set();
  for (let i = 0; i < 600; i++) {
    stepGame(game, DT);
    assert.ok(platform.dog.x >= 116 && platform.dog.x <= 154);
    directions.add(platform.dog.direction);
    positions.add(Math.round(platform.dog.x));
  }
  assert.equal(directions.size, 2);
  assert.ok(positions.size > 30);
});
