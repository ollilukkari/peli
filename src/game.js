export const WIDTH = 360;
export const HEIGHT = 640;

export const CREATURE_INTERVALS = Object.freeze({
  test: Object.freeze([200, 300]),
  release: Object.freeze([2000, 3000]),
});

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
  scrollSpeed: 33.8,
  maxScrollSpeed: 60.84,
  followHeight: HEIGHT * 0.62,
  trapTaps: 10,
  dogTaps: 10,
  dogNearDistance: 38,
  petBoostChargeDuration: 0.25,
  petBoostLaunchDuration: 0.9375,
  petBoostRiseMeters: 300,
  dogBoostRiseMeters: 100,
  slipMultiplier: 1.2,
  slipDeceleration: 400 / 1.5,
  zeroSlipDuration: 0.22,
  pixelsPerMeter: 12,
  trampolineRiseMeters: 50,
  trampolineHeight: 17,
  comboCreatureEntryDuration: 0.55,
  safeWidth: 40,
  gullWidth: 30,
  gullHeight: 14,
  gullSideSpeed: 320,
  gullJumpSpeed: 600,
  gullCooldown: 0.65,
});

const SAYINGS = ['Hyvää!', 'Nam!', 'Njömps!'];
const POOP_SAYINGS = ['Hyi!', 'Kääk!', 'Oivoi!'];
const NORMAL_HEIGHT = PHYSICS.jumpSpeed ** 2 / (2 * PHYSICS.gravity);
const PLATFORM_WIDTH_SCALE = 0.9;
const PLATFORM_NARROWING_METERS = 250;
const MIN_PLATFORM_WIDTH = 70;
const MIN_SAFE_WIDTH = 5.6;
const HALF_BUNNY = PHYSICS.playerWidth / 2;
const SATSUMA_CLEARANCE = 72; // 38 px fruit + 27 px platform underside + breathing room.
const GULL_MARGIN = 30;
const GULL_BOB = 14;
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

function random(game) {
  game.randomState = (game.randomState + 0x6d2b79f5) >>> 0;
  let value = game.randomState;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

function emit(game, type) {
  game.events.push({ type, x: game.player.x, y: game.player.y, combo: game.satsumaStreak });
}

function approach(value, target, amount) {
  return value < target ? Math.min(value + amount, target) : Math.max(value - amount, target);
}

function insertPlatform(game, platform) {
  const index = game.platforms.findIndex((entry) => entry.y > platform.y);
  game.platforms.splice(index < 0 ? game.platforms.length : index, 0, platform);
}

function generatePlatforms(game, targetY = game.camera + HEIGHT + NORMAL_HEIGHT * 3) {
  // Enough headroom for the entire satsuma jump, including a fast camera follow.
  while (game.generatedTopY < targetY) {
    const difficulty = clamp((game.generatedTopY - game.startY) / 12000, 0, 1);
    const id = ++game.generationIndex;
    const opening = id <= 3;
    const baseWidth = (opening ? 148 + random(game) * 32 : 104 + random(game) * 92) * PLATFORM_WIDTH_SCALE;
    let rise = opening ? 64 + random(game) * 18 : 45 + random(game) * 75;
    const laneJitter = (random(game) * 2 - 1) * (opening ? 40 : 16);
    let itemType = null;
    let itemSide = 0;
    if (id > 3 && random(game) < 0.38 + difficulty * 0.08) {
      const choice = random(game);
      itemType = choice < 0.4 ? 'satsuma' : choice < 0.7 ? 'trap' : choice < 0.85 ? 'poop' : null;
      // Even a skipped poop consumes its side draw, preserving the random stream.
      itemSide = random(game) < 0.5 ? -1 : 1;
    }
    // Share the existing edge-item footprint so every normal safe patch and
    // guaranteed fruit continuation stays available, including narrow ledges.
    if (!itemType && id % 9 === 5) {
      itemType = 'trampoline';
      itemSide = id % 2 ? 1 : -1;
    }

    // Visit each side for two steps, allowing the route to reach the outer
    // lanes instead of repeatedly snapping back to a central stack.
    const routeLane = [0, 0, 1, 2, 2, 1][(id + game.seed % 6) % 6];
    function geometryAtHeight() {
      const meters = (game.generatedTopY + rise - game.startY) / PHYSICS.pixelsPerMeter;
      const narrowingSteps = Math.floor(meters / PLATFORM_NARROWING_METERS);
      const width = Math.max(MIN_PLATFORM_WIDTH, baseWidth * 0.9 ** narrowingSteps);
      const safeWidth = Math.min(PHYSICS.safeWidth, Math.max(MIN_SAFE_WIDTH, width - 88));
      // On a narrow ledge, move the safe patch away from its item while keeping
      // four pixels between the patch and the bunny/item collision boundary.
      const safeOffset = itemType ? itemSide * Math.min(0,
        width / 2 - 15 - HALF_BUNNY - PHYSICS.itemHalfWidth - safeWidth / 2 - 4) : 0;
      const left = width / 2 + 8;
      const right = WIDTH - left;
      const desiredCenter = (opening ? game.generatedCenterX : [left, WIDTH / 2, right][routeLane]) + laneJitter;

      // Reserve a full reversal from opposite maximum speed, then another
      // ten pixels of reach. Distances use safe patches, not visual centers.
      const landingTime = (PHYSICS.jumpSpeed
        + Math.sqrt(PHYSICS.jumpSpeed ** 2 - 2 * PHYSICS.gravity * rise)) / PHYSICS.gravity;
      const reversalTime = PHYSICS.maxSpeed * 2 / PHYSICS.acceleration;
      const reach = PHYSICS.maxSpeed * (landingTime - reversalTime);
      const maxShift = reach - game.generatedSafeWidth / 2 + safeWidth / 2 - 10;
      const center = clamp(desiredCenter,
        Math.max(left, game.generatedCenterX - maxShift - safeOffset),
        Math.min(right, game.generatedCenterX + maxShift - safeOffset));
      return { x: center - width / 2, width, safeX: center + safeOffset, safeWidth };
    }
    let geometry = geometryAtHeight();
    const reserveHalf = game.generatedSafeWidth / 2 + 22;
    const coversPatch = geometry.x + geometry.width > game.generatedCenterX - reserveHalf
      && geometry.x < game.generatedCenterX + reserveHalf;
    const coversFruit = game.generatedSatsumaX !== null
      && geometry.x + geometry.width > game.generatedSatsumaX - 22
      && geometry.x < game.generatedSatsumaX + 22;
    if (rise < SATSUMA_CLEARANCE && (coversPatch || coversFruit)) {
      rise = SATSUMA_CLEARANCE;
      // Clearance can cross a 250 m boundary; size from the final altitude.
      geometry = geometryAtHeight();
    }
    const y = game.generatedTopY + rise;
    const item = itemType ? { type: itemType,
      x: geometry.x + geometry.width / 2 + itemSide * (geometry.width / 2 - 15), used: false } : null;

    const dogDue = y >= game.nextDogY;
    const creatureDue = y >= game.nextCreatureY;
    // One shared petting encounter per ledge. A due creature replaces a due dog.
    const dog = dogDue || creatureDue
      ? { x: geometry.x + geometry.width / 2, direction: 1, petted: false,
        ...(creatureDue ? { kind: 'zab' } : {}) } : null;
    if (dogDue) {
      game.dogGenerationIndex += 1;
      game.nextDogY = y + dogInterval(game);
    }
    if (creatureDue) {
      game.creatureGenerationIndex += 1;
      game.nextCreatureY = y + creatureInterval(game);
    }
    if (!dog) markFruitSpawn(game, { y }, item);
    insertPlatform(game, {
      dog,
      id,
      y,
      item: dog ? null : item,
      ...geometry,
    });
    game.generatedTopY = y;
    game.generatedCenterX = geometry.safeX;
    game.generatedSafeWidth = geometry.safeWidth;
    game.generatedSatsumaX = item?.type === 'satsuma' ? item.x : null;
  }
}

function spawnComboCreature(game) {
  // Reveal the reward on the next free ledge above the bunny, without waiting
  // for an offscreen encounter to scroll all the way into view.
  const minimumY = game.player.y + 60;
  const available = () => game.platforms.find((entry) => entry.y >= minimumY && !entry.dog
    && (!entry.item || entry.item.used) && (!entry.chainSatsuma || entry.chainSatsuma.used));
  let platform = available();
  while (!platform) {
    generatePlatforms(game, Math.max(minimumY + NORMAL_HEIGHT * 3, game.generatedTopY + 120));
    platform = available();
  }
  const fromX = platform.safeX < WIDTH / 2 ? -44 : WIDTH + 44;
  platform.dog = { kind: 'zab', x: fromX, direction: 1, petted: false,
    enteredAt: game.time, entryFromX: fromX };
}

function markFruitSpawn(game, platform, item) {
  // Fruit art extends 48 px above its ledge. Only newly created, visible fruit pops in.
  if (item?.type === 'satsuma' && platform.y >= game.camera - 48
      && platform.y <= game.camera + HEIGHT) item.spawnedAt = game.time;
}

function dogInterval(game) {
  // Separate deterministic stream: adding a dog does not redraw the route.
  let value = game.seed ^ Math.imul(game.dogGenerationIndex + 1, 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  const fraction = ((value ^ (value >>> 16)) >>> 0) / 4294967296;
  // Up to 10 m to the next generated ledge still fits the 2,000 m limit.
  return (1000 + fraction * 990) * PHYSICS.pixelsPerMeter;
}

function creatureInterval(game) {
  // Its own indexed stream preserves both the platform RNG and dog schedule.
  let value = game.seed ^ Math.imul(game.creatureGenerationIndex + 1, 0x7feb352d) ^ 0x61c88647;
  value = Math.imul(value ^ (value >>> 16), 0x846ca68b);
  const fraction = ((value ^ (value >>> 16)) >>> 0) / 4294967296;
  const [minimum, maximum] = CREATURE_INTERVALS[game.creatureMode];
  // Reserve 10 m for the next generated ledge so the actual gap stays in range.
  return (minimum + fraction * (maximum - minimum - 10)) * PHYSICS.pixelsPerMeter;
}

function moveDogs(game) {
  for (const platform of game.platforms) {
    if (!platform.dog) continue;
    const margin = 16;
    const walk = reflectedPosition(game.time * 18, platform.width - margin * 2);
    const targetX = platform.x + margin + walk.position;
    const entry = platform.dog.enteredAt === undefined ? 1
      : clamp((game.time - platform.dog.enteredAt) / PHYSICS.comboCreatureEntryDuration, 0, 1);
    const ease = 1 - (1 - entry) ** 3;
    platform.dog.x = entry === 1 ? targetX
      : platform.dog.entryFromX + (targetX - platform.dog.entryFromX) * ease;
    platform.dog.direction = walk.direction;
  }
}

export function tapDog(game) {
  if (game.phase !== 'playing' || game.player.state !== 'petting') return false;
  game.dogTaps += 1;
  if (game.dogTaps === PHYSICS.dogTaps) {
    const platform = game.platforms.find((entry) => entry.id === game.player.platformId);
    platform.dog.petted = true;
    startPetBoost(game, platform);
  }
  return true;
}

function startPetBoost(game, source) {
  const player = game.player;
  const riseMeters = source.dog.kind === 'zab' ? PHYSICS.petBoostRiseMeters : PHYSICS.dogBoostRiseMeters;
  const targetY = player.y + riseMeters * PHYSICS.pixelsPerMeter;
  generatePlatforms(game, targetY + HEIGHT + NORMAL_HEIGHT * 3);
  // Match the next route ledge's safe patch so a normal jump can continue upward.
  const targetX = game.platforms.find((platform) => platform.y > targetY).safeX;
  const landingPlatformId = -(source.id + 1);
  const landingX = clamp(targetX - 50, 8, WIDTH - 108);
  insertPlatform(game, {
    id: landingPlatformId, y: targetY, x: landingX, width: 100, safeX: targetX,
    safeWidth: Math.min(PHYSICS.safeWidth, 2 * Math.min(targetX - landingX, landingX + 100 - targetX)),
    item: null,
  });
  game.petBoost = {
    elapsed: 0, riseMeters,
    chargeDuration: PHYSICS.petBoostChargeDuration,
    launchDuration: PHYSICS.petBoostLaunchDuration,
    duration: PHYSICS.petBoostChargeDuration + PHYSICS.petBoostLaunchDuration,
    fromX: player.x, fromY: player.y, targetX, targetY, landingPlatformId,
  };
  player.state = 'pet-boost';
  player.platformId = null;
  player.vx = 0;
  player.vy = 0;
  player.slipRemaining = 0;
  emit(game, 'pet-boost');
}

function stepPetBoost(game, dt) {
  const boost = game.petBoost;
  boost.elapsed = Math.min(boost.duration, boost.elapsed + dt);
  if (boost.duration - boost.elapsed < 1e-9) boost.elapsed = boost.duration;
  const progress = clamp((boost.elapsed - boost.chargeDuration) / boost.launchDuration, 0, 1);
  const lift = progress * progress * (3 - 2 * progress);
  game.player.x = boost.fromX + (boost.targetX - boost.fromX) * lift;
  game.player.y = boost.fromY + (boost.targetY - boost.fromY) * lift;
  if (boost.elapsed === boost.duration) {
    game.player.x = boost.targetX;
    game.player.y = boost.targetY;
    game.gullInvulnerableUntil = game.time + PHYSICS.gullCooldown;
    game.petBoost = null;
    bounce(game, 1, 'pet-boost-release');
  }
}

function gullRandom(game, slot) {
  // An independent, indexed stream leaves every platform and fruit unchanged.
  let value = game.seed ^ Math.imul(game.gullGenerationIndex + 1, 0x9e3779b9)
    ^ Math.imul(slot + 1, 0x85ebca6b);
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

function reflectedPosition(distance, span) {
  const phase = ((distance % (span * 2)) + span * 2) % (span * 2);
  return { position: phase <= span ? phase : span * 2 - phase, direction: phase < span ? 1 : -1 };
}

function gullPosition(gull, time) {
  const horizontal = reflectedPosition(gull.flightOffset + time * gull.speed, WIDTH - GULL_MARGIN * 2);
  const vertical = reflectedPosition(gull.bobOffset + time * gull.bobSpeed, GULL_BOB * 2);
  return { x: GULL_MARGIN + horizontal.position,
    y: gull.baseY + vertical.position - GULL_BOB, direction: horizontal.direction };
}

function generateGulls(game) {
  game.gulls = game.gulls.filter((gull) => gull.baseY + GULL_BOB >= game.camera - 60);
  while (game.nextGullY <= game.camera + HEIGHT + 450 && game.gulls.length < 3) {
    const baseY = game.nextGullY;
    if (baseY + GULL_BOB >= game.camera - 60) {
      const gull = { id: game.gullGenerationIndex, baseY,
        flightOffset: gullRandom(game, 1) * (WIDTH - GULL_MARGIN * 2) * 2,
        speed: 72 + gullRandom(game, 2) * 28,
        bobOffset: gullRandom(game, 3) * GULL_BOB * 4, bobSpeed: 22 };
      Object.assign(gull, gullPosition(gull, game.time));
      game.gulls.push(gull);
    }
    game.nextGullY += 450 + gullRandom(game, 4) * 60;
    game.gullGenerationIndex += 1;
  }
}

function moveGulls(game, previousTime) {
  return game.gulls.map((gull) => {
    // Split at both kinds of turn so a bird cannot pass through the bunny and
    // return to the same side unnoticed during a long simulation step.
    const times = [previousTime, game.time];
    for (const [offset, speed, span] of [
      [gull.flightOffset, gull.speed, WIDTH - GULL_MARGIN * 2],
      [gull.bobOffset, gull.bobSpeed, GULL_BOB * 2],
    ]) {
      if (speed === 0) continue;
      const firstTurn = Math.floor((offset + previousTime * speed) / span) + 1;
      const lastTurn = Math.ceil((offset + game.time * speed) / span) - 1;
      for (let turn = firstTurn; turn <= lastTurn; turn += 1) times.push((turn * span - offset) / speed);
    }
    times.sort((a, b) => a - b);
    const points = times.map((time) => ({ ...gullPosition(gull, time),
      fraction: (time - previousTime) / (game.time - previousTime) }));
    Object.assign(gull, gullPosition(gull, game.time));
    return { gull, points };
  });
}

export function createGame(seed = Date.now(), { creatureMode = 'release' } = {}) {
  if (!Object.hasOwn(CREATURE_INTERVALS, creatureMode)) {
    throw new RangeError('Unknown creature mode');
  }
  const initialY = 100;
  const initialWidth = (WIDTH - 48) * PLATFORM_WIDTH_SCALE;
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
    lastMealAt: null,
    gulls: [],
    gullGenerationIndex: 0,
    nextGullY: 700,
    gullInvulnerableUntil: 0,
    lastGullHit: null,
    platforms: [{
      id: 0,
      x: (WIDTH - initialWidth) / 2,
      y: initialY,
      width: initialWidth,
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
    dogGenerationIndex: 0,
    nextDogY: 0,
    creatureMode,
    creatureGenerationIndex: 0,
    nextCreatureY: 0,
    dogTaps: 0,
    petBoost: null,
    trapTaps: 0,
    bubble: null,
    bubbleUntil: 0,
    events: [],
  };
  game.nextDogY = initialY + dogInterval(game);
  game.nextCreatureY = initialY + creatureInterval(game);
  generatePlatforms(game);
  game.nextGullY += gullRandom(game, 0) * 50;
  generateGulls(game);
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

function land(game, platform, dt, landingY) {
  const player = game.player;
  player.y = landingY;
  let item = landingItem(platform, player.x);
  // A side entry below the mat reaches the ground, not the jumping surface.
  if (item?.type === 'trampoline' && landingY === platform.y) item = null;
  const hitItem = item !== null;
  game.lastLanding = {
    x: player.x, y: landingY, time: game.time, type: hitItem ? item.type : 'normal',
  };
  const continuesCombo = hitItem && (item.type === 'satsuma' || item.type === 'trampoline');
  if (!continuesCombo && game.satsumaStreak >= 10) spawnComboCreature(game);
  game.satsumaStreak = continuesCombo ? game.satsumaStreak + 1 : 0;
  if (!continuesCombo) game.chainTargetId = null;

  if (platform.dog && !platform.dog.petted
      && Math.abs(player.x - platform.dog.x) <= PHYSICS.dogNearDistance) {
    player.state = 'petting';
    player.platformId = platform.id;
    player.vx = 0;
    player.vy = 0;
    game.dogTaps = 0;
    game.bubble = null;
    emit(game, 'dog');
    return;
  }

  if (!hitItem) {
    bounce(game);
    return;
  }

  item.used = item.type !== 'trampoline';
  if (item.type === 'satsuma') {
    game.lastMealAt = game.time;
    game.bubble = SAYINGS[Math.floor(random(game) * SAYINGS.length)];
    game.bubbleUntil = game.time + 1.8;
    bounce(game, PHYSICS.boostMultiplier, 'satsuma');
    ensureSatsumaTarget(game, dt);
  } else if (item.type === 'trampoline') {
    item.bouncedAt = game.time;
    const speed = Math.sqrt(2 * PHYSICS.gravity * PHYSICS.trampolineRiseMeters * PHYSICS.pixelsPerMeter);
    bounce(game, speed / PHYSICS.jumpSpeed, 'trampoline');
    generatePlatforms(game, player.y + PHYSICS.trampolineRiseMeters * PHYSICS.pixelsPerMeter + HEIGHT);
    ensureSatsumaTarget(game, dt);
  } else if (item.type === 'trap') {
    player.state = 'trapped';
    player.platformId = platform.id;
    player.vx = 0;
    player.vy = 0;
    game.trapTaps = 0;
    emit(game, 'trap');
  } else if (item.type === 'poop') {
    game.bubble = POOP_SAYINGS[Math.floor(random(game) * POOP_SAYINGS.length)];
    game.bubbleUntil = game.time + 1.8;
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
  let landingY = -Infinity;
  function consider(platform, y, left, right, trampoline = null) {
    if (previousY < y || player.y > y || y <= landingY) return;
    const fraction = (previousY - y) / (previousY - player.y);
    const crossingX = previousX + (player.x - previousX) * fraction;
    if (crossingX + HALF_BUNNY <= left || crossingX - HALF_BUNNY >= right) return;
    if (trampoline && landingItem(platform, crossingX) !== trampoline) return;
    landing = platform;
    landingX = crossingX;
    landingY = y;
  }
  for (const platform of platforms) {
    const item = platform.item;
    if (item?.type === 'trampoline') {
      consider(platform, platform.y + PHYSICS.trampolineHeight,
        item.x - PHYSICS.itemHalfWidth, item.x + PHYSICS.itemHalfWidth, item);
    }
    consider(platform, platform.y, platform.x, platform.x + platform.width);
  }

  return landing ? { platform: landing, x: landingX, y: landingY,
    fraction: (previousY - landingY) / (previousY - player.y) } : null;
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
    if (!item || item.used) continue;
    if (Math.abs(x - item.x) > HALF_BUNNY + PHYSICS.itemHalfWidth) continue;
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
  // Compact ledges still fit a fruit beside a hazard: their main bodies stay
  // separate and their centers remain farther apart than the hit radius.
  const narrow = platform.width < 94;
  const inset = narrow ? 15 : 22;
  const itemSpacing = narrow ? 34 : 45;
  let intervals = [[platform.x + inset, platform.x + platform.width - inset]];
  const blocked = game.platforms.filter((other) => other.id !== platform.id
    && other.y > platform.y && other.y - platform.y < SATSUMA_CLEARANCE - 1e-6)
    .map((other) => [other.x - 22, other.x + other.width + 22]);
  const item = platform.item;
  if (item && !(item.type === 'satsuma' && item.used)) blocked.push([item.x - itemSpacing, item.x + itemSpacing]);
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
    && platform.y <= peakY && !platform.dog).reverse();
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
      markFruitSpawn(game, platform, platform.chainSatsuma);
      game.chainTargetId = platform.id;
      return;
    }
  }
  throw new Error('Generated route has no clear, reachable satsuma landing.');
}

function sweptGullFraction(startX, startY, endX, endY) {
  let enter = 0;
  let exit = 1;
  for (const [start, end, extent] of [
    [startX, endX, (PHYSICS.playerWidth + PHYSICS.gullWidth) / 2],
    [startY, endY, (PHYSICS.playerHeight + PHYSICS.gullHeight) / 2],
  ]) {
    const delta = end - start;
    if (delta === 0) {
      if (Math.abs(start) > extent) return null;
      continue;
    }
    const first = (-extent - start) / delta;
    const last = (extent - start) / delta;
    enter = Math.max(enter, Math.min(first, last));
    exit = Math.min(exit, Math.max(first, last));
    if (enter > exit) return null;
  }
  return enter;
}

function findGullHit(game, paths, previousX, previousY) {
  if (game.time < game.gullInvulnerableUntil) return null;
  const player = game.player;
  const xAt = (fraction) => previousX + (player.x - previousX) * fraction;
  const yAt = (fraction) => previousY + (player.y - previousY) * fraction + PHYSICS.playerHeight / 2;
  let hit = null;
  for (const { points } of paths) {
    for (let index = 1; index < points.length; index += 1) {
      const from = points[index - 1];
      const to = points[index];
      const segmentFraction = sweptGullFraction(xAt(from.fraction) - from.x, yAt(from.fraction) - from.y,
        xAt(to.fraction) - to.x, yAt(to.fraction) - to.y);
      if (segmentFraction === null) continue;
      const fraction = from.fraction + (to.fraction - from.fraction) * segmentFraction;
      if (!hit || fraction < hit.fraction) hit = { fraction, direction: from.direction,
        x: from.x + (to.x - from.x) * segmentFraction };
    }
  }
  return hit;
}

function stepAir(game, dt, axis, gullPaths) {
  const player = game.player;
  const previousX = player.x;
  const previousY = player.y;
  const previousVy = player.vy;
  advanceAir(player, dt, axis);
  const landing = findLanding(game.platforms, previousX, previousY, player);
  const gullHit = findGullHit(game, gullPaths, previousX, previousY);

  if (gullHit && (!landing || gullHit.fraction < landing.fraction)) {
    player.x = previousX + (player.x - previousX) * gullHit.fraction;
    player.y = previousY + (player.y - previousY) * gullHit.fraction;
    let direction = Math.sign(player.x - gullHit.x) || -gullHit.direction;
    if (player.x <= HALF_BUNNY + 1) direction = 1;
    else if (player.x >= WIDTH - HALF_BUNNY - 1) direction = -1;
    player.vx = direction * PHYSICS.gullSideSpeed;
    player.vy = Math.max(PHYSICS.gullJumpSpeed, previousVy - PHYSICS.gravity * dt * gullHit.fraction);
    game.gullInvulnerableUntil = game.time + PHYSICS.gullCooldown;
    game.lastGullHit = { x: player.x, y: player.y + PHYSICS.playerHeight / 2, time: game.time };
    emit(game, 'gull');
  } else if (landing) {
    player.x = landing.x;
    land(game, landing.platform, dt, landing.y);
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

  // The mandatory petting encounter freezes the world, including the lethal camera.
  if (game.player.state === 'petting') return;
  // Stop at the exact endpoint and freeze lethal scrolling while the glow charges.
  let scrollDt = dt;
  let previousBoostY = null;
  if (game.player.state === 'pet-boost') {
    const boost = game.petBoost;
    previousBoostY = game.player.y;
    dt = Math.min(dt, boost.duration - boost.elapsed);
    const previousLaunchTime = Math.max(0, boost.elapsed - boost.chargeDuration);
    const nextLaunchTime = Math.max(0, boost.elapsed + dt - boost.chargeDuration);
    scrollDt = nextLaunchTime - previousLaunchTime;
  }
  const previousTime = game.time;
  game.time += dt;
  moveDogs(game);
  const gullPaths = moveGulls(game, previousTime);
  axis = clamp(axis, -1, 1);
  if (game.player.state === 'air') stepAir(game, dt, axis, gullPaths);
  else if (game.player.state === 'sliding') stepSlide(game, dt);
  else if (game.player.state === 'pet-boost') stepPetBoost(game, dt);

  game.maxY = Math.max(game.maxY, game.player.y);
  game.score = Math.floor((game.maxY - game.startY) / PHYSICS.pixelsPerMeter);
  const difficulty = clamp((game.maxY - game.startY) / 12000, 0, 1);
  const speed = PHYSICS.scrollSpeed + (PHYSICS.maxScrollSpeed - PHYSICS.scrollSpeed) * difficulty;
  if (game.player.state !== 'petting' && scrollDt > 0) {
    // The launch eases in from rest; its protected bunny must never be overtaken.
    const scrollDistance = previousBoostY === null ? speed * scrollDt
      : Math.min(speed * scrollDt, Math.max(0, game.player.y - previousBoostY));
    game.camera = Math.max(game.camera + scrollDistance, game.player.y - PHYSICS.followHeight);
  }
  if (game.bubble && game.time >= game.bubbleUntil) game.bubble = null;

  if (game.player.y <= game.camera) {
    game.phase = 'over';
    emit(game, 'over');
    return;
  }

  game.platforms = game.platforms.filter((platform) => platform.y >= game.camera - 80);
  generatePlatforms(game);
  generateGulls(game);
}
