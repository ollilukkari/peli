export const WIDTH = 360;
export const HEIGHT = 640;

export const PHYSICS = Object.freeze({
  gravity: 1500,
  jumpSpeed: 670,
  maxSpeed: 230,
  acceleration: 1550,
  braking: 1800,
  playerWidth: 22,
  playerHeight: 32,
  itemHalfWidth: 14,
  boostMultiplier: Math.sqrt(3),
  scrollSpeed: 20,
  maxScrollSpeed: 36,
  followHeight: HEIGHT * 0.62,
  trapTaps: 4,
  slipMultiplier: 1.2,
  slipDeceleration: 400,
  zeroSlipDuration: 0.22,
  pixelsPerMeter: 12,
  safeWidth: 40,
});

const SAYINGS = ['Hyvää', 'Nam', 'Njömps', 'Njömpsis'];
const NORMAL_HEIGHT = PHYSICS.jumpSpeed ** 2 / (2 * PHYSICS.gravity);
const HALF_BUNNY = PHYSICS.playerWidth / 2;
const SATSUMA_CLEARANCE = 72; // 38 px fruit + 27 px platform underside + breathing room.
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

function random(game) {
  game.randomState = (game.randomState + 0x6d2b79f5) >>> 0;
  let value = game.randomState;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

function emit(game, type) {
  game.events.push({ type, x: game.player.x, y: game.player.y });
}

function approach(value, target, amount) {
  return value < target ? Math.min(value + amount, target) : Math.max(value - amount, target);
}

function insertPlatform(game, platform) {
  const index = game.platforms.findIndex((entry) => entry.y > platform.y);
  game.platforms.splice(index < 0 ? game.platforms.length : index, 0, platform);
}

function generatePlatforms(game) {
  // Enough headroom for the entire satsuma jump, including a fast camera follow.
  const targetY = game.camera + HEIGHT + NORMAL_HEIGHT * 3;
  while (game.generatedTopY < targetY) {
    const difficulty = clamp((game.generatedTopY - game.startY) / 12000, 0, 1);
    const id = ++game.generationIndex;
    const opening = id <= 3;
    const width = opening ? 148 + random(game) * 32 : 104 + random(game) * (92 - difficulty * 12);
    let rise = opening ? 64 + random(game) * 18 : 45 + random(game) * 75;
    const safeWidth = Math.min(PHYSICS.safeWidth, width - 88);

    // A low platform leaves more flight time for a wide lateral crossing.
    // Reserve a full reversal from the opposite maximum speed, then keep
    // another ten pixels inside the reachable landing interval.
    const left = width / 2 + 8;
    const right = WIDTH - left;
    // Visit each side for two steps, allowing the route to reach the outer
    // lanes instead of repeatedly snapping back to a central stack.
    const routeLane = [0, 0, 1, 2, 2, 1][(id + game.seed % 6) % 6];
    const laneCenter = [left, WIDTH / 2, right][routeLane];
    const desiredCenter = opening
      ? game.generatedCenterX + (random(game) * 2 - 1) * 40
      : laneCenter + (random(game) * 2 - 1) * 16;
    function reachableCenter() {
      const landingTime = (PHYSICS.jumpSpeed
        + Math.sqrt(PHYSICS.jumpSpeed ** 2 - 2 * PHYSICS.gravity * rise)) / PHYSICS.gravity;
      const reversalTime = PHYSICS.maxSpeed * 2 / PHYSICS.acceleration;
      const reach = PHYSICS.maxSpeed * (landingTime - reversalTime);
      const maxShift = reach - game.generatedSafeWidth / 2 + safeWidth / 2 - 10;
      return clamp(desiredCenter,
        Math.max(left, game.generatedCenterX - maxShift),
        Math.min(right, game.generatedCenterX + maxShift));
    }
    let center = reachableCenter();
    const reserveHalf = game.generatedSafeWidth / 2 + 22;
    const coversPatch = center + width / 2 > game.generatedCenterX - reserveHalf
      && center - width / 2 < game.generatedCenterX + reserveHalf;
    const coversFruit = game.generatedSatsumaX !== null
      && center + width / 2 > game.generatedSatsumaX - 22
      && center - width / 2 < game.generatedSatsumaX + 22;
    if (rise < SATSUMA_CLEARANCE && (coversPatch || coversFruit)) {
      rise = SATSUMA_CLEARANCE;
      center = reachableCenter();
    }
    const y = game.generatedTopY + rise;
    let item = null;

    if (id > 3 && random(game) < 0.38 + difficulty * 0.08) {
      const choice = random(game);
      const type = choice < 0.4 ? 'satsuma' : choice < 0.7 ? 'trap' : 'poop';
      const side = random(game) < 0.5 ? -1 : 1;
      // Narrow platforms retain a smaller but still explicit safe landing patch.
      item = { type, x: center + side * (width / 2 - 15), used: false };
    }

    insertPlatform(game, {
      id,
      x: center - width / 2,
      y,
      width,
      item,
      safeX: center,
      safeWidth,
    });
    game.generatedTopY = y;
    game.generatedCenterX = center;
    game.generatedSafeWidth = safeWidth;
    game.generatedSatsumaX = item?.type === 'satsuma' ? item.x : null;
  }
}

export function createGame(seed = Date.now()) {
  const initialY = 100;
  const game = {
    seed: seed >>> 0,
    randomState: seed >>> 0,
    phase: 'ready',
    time: 0,
    camera: 0,
    startY: initialY,
    maxY: initialY,
    score: 0,
    generationIndex: 0,
    generatedTopY: initialY,
    generatedCenterX: WIDTH / 2,
    generatedSafeWidth: PHYSICS.safeWidth,
    generatedSatsumaX: null,
    chainTargetId: null,
    satsumaStreak: 0,
    lastLanding: null,
    platforms: [{
      id: 0,
      x: 24,
      y: initialY,
      width: WIDTH - 48,
      item: null,
      safeX: WIDTH / 2,
      safeWidth: PHYSICS.safeWidth,
    }],
    player: {
      x: WIDTH / 2,
      y: initialY,
      vx: 0,
      vy: 0,
      state: 'air',
      platformId: null,
      slipRemaining: 0,
    },
    trapTaps: 0,
    bubble: null,
    bubbleUntil: 0,
    events: [],
  };
  generatePlatforms(game);
  return game;
}

function bounce(game, multiplier = 1, eventType = 'bounce') {
  game.player.state = 'air';
  game.player.platformId = null;
  game.player.slipRemaining = 0;
  game.player.vy = PHYSICS.jumpSpeed * multiplier;
  emit(game, eventType);
}

export function startGame(game) {
  if (game.phase !== 'ready') return;
  game.phase = 'playing';
  bounce(game);
}

export function pauseGame(game) {
  if (game.phase === 'playing') game.phase = 'paused';
}

export function resumeGame(game) {
  if (game.phase === 'paused') game.phase = 'playing';
}

export function tapTrap(game) {
  if (game.phase !== 'playing' || game.player.state !== 'trapped') return false;
  game.trapTaps += 1;
  emit(game, 'tap');
  if (game.trapTaps === PHYSICS.trapTaps) bounce(game, 1, 'release');
  return true;
}

function land(game, platform, dt) {
  const player = game.player;
  player.y = platform.y;
  const item = landingItem(platform, player.x);
  const hitItem = item !== null;
  game.lastLanding = {
    x: player.x, y: platform.y, time: game.time, type: hitItem ? item.type : 'normal',
  };
  const hitSatsuma = hitItem && item.type === 'satsuma';
  game.satsumaStreak = hitSatsuma ? game.satsumaStreak + 1 : 0;
  if (!hitSatsuma) game.chainTargetId = null;

  if (!hitItem) {
    bounce(game);
    return;
  }

  item.used = true;
  if (item.type === 'satsuma') {
    game.bubble = SAYINGS[Math.floor(random(game) * SAYINGS.length)];
    game.bubbleUntil = game.time + 1.8;
    bounce(game, PHYSICS.boostMultiplier, 'satsuma');
    ensureSatsumaTarget(game, dt);
  } else if (item.type === 'trap') {
    player.state = 'trapped';
    player.platformId = platform.id;
    player.vx = 0;
    player.vy = 0;
    game.trapTaps = 0;
    emit(game, 'trap');
  } else if (item.type === 'poop') {
    player.state = 'sliding';
    player.platformId = platform.id;
    player.vy = 0;
    player.vx *= PHYSICS.slipMultiplier;
    player.slipRemaining = player.vx === 0
      ? PHYSICS.zeroSlipDuration
      : Math.abs(player.vx) / PHYSICS.slipDeceleration;
    emit(game, 'slip');
  }
}

function clampToWalls(player) {
  const clampedX = clamp(player.x, HALF_BUNNY, WIDTH - HALF_BUNNY);
  if (clampedX !== player.x) {
    player.x = clampedX;
    player.vx = 0;
    return true;
  }
  return false;
}

function advanceAir(player, dt, axis) {
  const previousVx = player.vx;
  player.vx = approach(player.vx, axis * PHYSICS.maxSpeed,
    (axis === 0 ? PHYSICS.braking : PHYSICS.acceleration) * dt);
  player.x += (previousVx + player.vx) * dt / 2;
  clampToWalls(player);
  player.y += player.vy * dt - PHYSICS.gravity * dt * dt / 2;
  player.vy -= PHYSICS.gravity * dt;
}

function findLanding(platforms, previousX, previousY, player) {
  if (player.vy >= 0 || player.y >= previousY) return null;

  let landing = null;
  let landingX = player.x;
  for (const platform of platforms) {
    if (previousY < platform.y || player.y > platform.y) continue;
    const fraction = (previousY - platform.y) / (previousY - player.y);
    const crossingX = previousX + (player.x - previousX) * fraction;
    if (crossingX + HALF_BUNNY <= platform.x || crossingX - HALF_BUNNY >= platform.x + platform.width) continue;
    if (!landing || platform.y > landing.y) {
      landing = platform;
      landingX = crossingX;
    }
  }

  return landing ? { platform: landing, x: landingX } : null;
}

function previewLanding(game, dt, axis, platforms) {
  const player = { ...game.player };
  const steps = Math.ceil(2 * player.vy / PHYSICS.gravity / dt) + 2;
  for (let frame = 0; frame < steps; frame += 1) {
    const previousX = player.x;
    const previousY = player.y;
    advanceAir(player, dt, axis);
    const landing = findLanding(platforms, previousX, previousY, player);
    if (landing) return landing;
  }
  return null;
}

function isFreshSatsuma(landing) {
  return landing && landingItem(landing.platform, landing.x)?.type === 'satsuma';
}

function landingItem(platform, x) {
  let closest = null;
  for (const item of [platform.item, platform.chainSatsuma]) {
    if (!item || item.used || Math.abs(x - item.x) > HALF_BUNNY + PHYSICS.itemHalfWidth) continue;
    if (!closest || Math.abs(x - item.x) < Math.abs(x - closest.x)) closest = item;
  }
  return closest;
}

function directLandingAt(game, dt, platform, x) {
  const plane = [{ x: 0, width: WIDTH, y: platform.y }];
  const left = previewLanding(game, dt, -1, plane).x;
  const right = previewLanding(game, dt, 1, plane).x;
  if (x < left || x > right) return null;

  // Solve only a constant joystick position, not a multi-step route search.
  // The final check includes every other platform and its first collision.
  let low = -1;
  let high = 1;
  let axis = 0;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    axis = (low + high) / 2;
    const crossingX = previewLanding(game, dt, axis, plane).x;
    if (Math.abs(crossingX - x) < 0.5) break;
    if (crossingX < x) low = axis;
    else high = axis;
  }
  const landing = previewLanding(game, dt, axis, game.platforms);
  return landing?.platform.id === platform.id && Math.abs(landing.x - x) < 2 ? landing : null;
}

function hasFruitSpace(game, platform, x) {
  return !game.platforms.some((other) => other.id !== platform.id
    && other.y > platform.y && other.y - platform.y < SATSUMA_CLEARANCE - 1e-6
    && x + 22 > other.x && x - 22 < other.x + other.width);
}

function fruitPositions(game, platform) {
  let intervals = [[platform.x + 22, platform.x + platform.width - 22]];
  const blocked = game.platforms.filter((other) => other.id !== platform.id
    && other.y > platform.y && other.y - platform.y < SATSUMA_CLEARANCE - 1e-6)
    .map((other) => [other.x - 22, other.x + other.width + 22]);
  const item = platform.item;
  if (item && !(item.type === 'satsuma' && item.used)) blocked.push([item.x - 45, item.x + 45]);
  for (const [blockLeft, blockRight] of blocked) {
    const remaining = [];
    for (const [left, right] of intervals) {
      if (blockRight <= left || blockLeft >= right) remaining.push([left, right]);
      else {
        if (blockLeft > left) remaining.push([left, blockLeft]);
        if (blockRight < right) remaining.push([blockRight, right]);
      }
    }
    intervals = remaining;
  }
  return intervals.filter(([left, right]) => right - left >= 4)
    .flatMap(([left, right]) => [clamp(platform.safeX, left + 1, right - 1),
      clamp(game.player.x, left + 1, right - 1), (left + right) / 2, left + 1, right - 1]);
}

function ensureSatsumaTarget(game, dt) {
  // Only existing geometry is used: a chain fruit never creates or moves a ledge.
  let y = game.player.y;
  let vy = game.player.vy;
  let peakY = y;
  while (vy > 0) {
    y += vy * dt - PHYSICS.gravity * dt * dt / 2;
    vy -= PHYSICS.gravity * dt;
    peakY = Math.max(peakY, y);
  }

  const eligible = game.platforms.filter((platform) => platform.y > game.player.y
    && platform.y <= peakY).reverse();
  for (const platform of eligible) {
    for (const item of [platform.item, platform.chainSatsuma]) {
      if (item?.type !== 'satsuma' || item.used || !hasFruitSpace(game, platform, item.x)) continue;
      const landing = directLandingAt(game, dt, platform, item.x);
      if (isFreshSatsuma(landing)) {
        game.chainTargetId = platform.id;
        return;
      }
    }
  }

  // Prefer empty platforms, then preserve a hazard alongside the fruit. Use
  // clear intervals across the entire ledge, including reachable outer edges.
  const ordered = [...eligible.filter((platform) => !platform.item || platform.item.used),
    ...eligible.filter((platform) => platform.item && !platform.item.used)];
  for (const platform of ordered) {
    if (platform.chainSatsuma && !platform.chainSatsuma.used) continue;
    for (const x of fruitPositions(game, platform)) {
      if (!directLandingAt(game, dt, platform, x)) continue;
      platform.chainSatsuma = { type: 'satsuma', x, used: false };
      game.chainTargetId = platform.id;
      return;
    }
  }
  throw new Error('Generated route has no clear, reachable satsuma landing.');
}

function stepAir(game, dt, axis) {
  const player = game.player;
  const previousX = player.x;
  const previousY = player.y;
  advanceAir(player, dt, axis);
  const landing = findLanding(game.platforms, previousX, previousY, player);

  if (landing) {
    player.x = landing.x;
    land(game, landing.platform, dt);
  }
}

function stepSlide(game, dt) {
  const player = game.player;
  const platform = game.platforms.find((entry) => entry.id === player.platformId);
  const previousVx = player.vx;
  player.vx = approach(player.vx, 0, PHYSICS.slipDeceleration * dt);
  player.x += (previousVx + player.vx) * dt / 2;
  const wallHit = clampToWalls(player);
  player.slipRemaining = Math.max(0, player.slipRemaining - dt);

  if (!platform || player.x + HALF_BUNNY <= platform.x || player.x - HALF_BUNNY >= platform.x + platform.width) {
    player.state = 'air';
    player.platformId = null;
    player.slipRemaining = 0;
    return;
  }

  player.y = platform.y;
  if (player.slipRemaining === 0 || wallHit) bounce(game);
}

export function stepGame(game, dt, axis = 0) {
  if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Simulation time must be finite and nonnegative.');
  if (!Number.isFinite(axis)) throw new TypeError('Movement axis must be finite.');
  if (game.phase !== 'playing' || dt === 0) return;

  game.time += dt;
  axis = clamp(axis, -1, 1);
  if (game.player.state === 'air') stepAir(game, dt, axis);
  else if (game.player.state === 'sliding') stepSlide(game, dt);

  game.maxY = Math.max(game.maxY, game.player.y);
  game.score = Math.floor((game.maxY - game.startY) / PHYSICS.pixelsPerMeter);
  const difficulty = clamp((game.maxY - game.startY) / 12000, 0, 1);
  const speed = PHYSICS.scrollSpeed + (PHYSICS.maxScrollSpeed - PHYSICS.scrollSpeed) * difficulty;
  game.camera = Math.max(game.camera + speed * dt, game.player.y - PHYSICS.followHeight);
  if (game.bubble && game.time >= game.bubbleUntil) game.bubble = null;

  if (game.player.y <= game.camera) {
    game.phase = 'over';
    emit(game, 'over');
    return;
  }

  game.platforms = game.platforms.filter((platform) => platform.y >= game.camera - 80);
  generatePlatforms(game);
}
