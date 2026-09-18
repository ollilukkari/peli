// Original, hand-drawn pixel artwork. All coordinates use the 360 × 640 playfield.
const WIDTH = 360;
const HEIGHT = 640;

const palettes = {
  meadow: {
    sky: '#e9f1d5', skyBottom: '#bfdfbd', cloud: '#fffbed', cloudShade: '#e6dfd2',
    distant: '#bdcdb4', hill: '#95bea2', nearHill: '#7daa87', detail: '#edf2b1',
    grass: '#497b5b', grassLight: '#a0cf76', grassTop: '#d4e89a', dirt: '#97745e',
    dirtLight: '#b59270', dirtDark: '#6d5b50', flower: '#f4b19c', outline: '#4b4750',
  },
  kvlt: {
    sky: '#252a43', skyBottom: '#666078', cloud: '#777089', cloudShade: '#5b546f',
    distant: '#464359', hill: '#3c3e50', nearHill: '#333849', detail: '#b0a8cc',
    grass: '#67677f', grassLight: '#92909f', grassTop: '#b1a7b9', dirt: '#575467',
    dirtLight: '#757083', dirtDark: '#343143', flower: '#c687b3', outline: '#242638',
  },
  winter: {
    sky: '#080f20', skyBottom: '#263e57', cloud: '#6f879b', cloudShade: '#435b72',
    distant: '#253e55', hill: '#1d3349', nearHill: '#13283b', detail: '#d8ebf2',
    grass: '#91b0c1', grassLight: '#e0eff4', grassTop: '#ffffff', dirt: '#3e576b',
    dirtLight: '#628196', dirtDark: '#172c3e', flower: '#e8f3f8', outline: '#091322',
  },
};

function box(ctx, color, x, y, width, height) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
}

function shape(ctx, color, points) {
  ctx.fillStyle = color;
  ctx.beginPath();
  points.forEach(([x, y], i) => i ? ctx.lineTo(Math.round(x), Math.round(y)) : ctx.moveTo(Math.round(x), Math.round(y)));
  ctx.closePath();
  ctx.fill();
}

function pixelOval(ctx, color, x, y, width, height, pixel = 3) {
  const inset = Math.min(pixel * 2, width / 4, height / 4);
  box(ctx, color, x + inset, y, width - inset * 2, height);
  box(ctx, color, x + pixel, y + pixel, width - pixel * 2, height - pixel * 2);
  box(ctx, color, x, y + inset, width, height - inset * 2);
}

function star(ctx, x, y, color, size = 2) {
  box(ctx, color, x - size, y, size * 3, size);
  box(ctx, color, x, y - size, size, size * 3);
}

function cloud(ctx, x, y, size, palette) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.scale(size, size);
  box(ctx, palette.cloudShade, 8, 20, 63, 9);
  box(ctx, palette.cloudShade, 15, 29, 49, 3);
  box(ctx, palette.cloud, 0, 18, 76, 8);
  box(ctx, palette.cloud, 6, 12, 66, 11);
  box(ctx, palette.cloud, 17, 6, 42, 14);
  box(ctx, palette.cloud, 23, 0, 24, 18);
  box(ctx, palette.cloud, 49, 8, 15, 12);
  ctx.restore();
}

function ridge(ctx, color, points, offset) {
  // Horizontal stair steps keep the silhouette crisp at every display size.
  const stepped = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    const steps = Math.ceil((x2 - x1) / 12);
    for (let step = 0; step < steps; step += 1) {
      const x = x1 + ((x2 - x1) * step) / steps;
      const nextX = x1 + ((x2 - x1) * (step + 1)) / steps;
      const y = y1 + ((y2 - y1) * step) / steps + offset;
      stepped.push([x, y], [nextX, y]);
    }
  }
  stepped.push([WIDTH + 20, HEIGHT], [-20, HEIGHT]);
  shape(ctx, color, stepped);
}

function castle(ctx, x, y, size) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.scale(size, size);
  const dark = '#35354b';
  box(ctx, dark, 0, 18, 22, 95);
  box(ctx, dark, 37, 0, 22, 120);
  box(ctx, dark, 72, 31, 20, 86);
  box(ctx, dark, 20, 58, 54, 62);
  shape(ctx, dark, [[-5, 18], [11, -8], [27, 18]]);
  shape(ctx, dark, [[30, 0], [48, -31], [66, 0]]);
  shape(ctx, dark, [[66, 31], [82, 7], [98, 31]]);
  for (const [wx, wy] of [[9, 39], [45, 23], [45, 52], [79, 50], [32, 81], [59, 81]]) {
    box(ctx, '#a892a3', wx, wy, 4, 9);
    box(ctx, '#a892a3', wx + 1, wy - 2, 2, 2);
  }
  box(ctx, '#464359', 42, 94, 12, 26);
  box(ctx, '#464359', 45, 91, 6, 3);
  ctx.restore();
}

function winterPine(ctx, x, bottom, height, color, snowy = false) {
  const unit = height / 30;
  box(ctx, color, x - unit, bottom - height, unit * 2, height);
  for (let tier = 0; tier < 3; tier += 1) {
    const top = bottom - height + tier * height * 0.23;
    for (let row = 0; row < 5; row += 1) {
      const width = (row + 1) * unit * (2.5 + tier * 0.7);
      box(ctx, color, x - width / 2, top + row * unit * 2, width, unit * 2);
      if (snowy && row === 2) box(ctx, '#4e6b80', x - width / 2, top + row * unit * 2, width / 2, unit);
    }
  }
}

function drawBackground(ctx, game, { theme, time, reducedMotion }, palette) {
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, palette.sky);
  gradient.addColorStop(1, palette.skyBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const drift = reducedMotion ? 0 : time;
  const camera = game.camera || 0;

  if (theme !== 'meadow') {
    const winter = theme === 'winter';
    for (let i = 0; i < 36; i += 1) {
      const x = (i * 83 + 29) % WIDTH;
      const y = (i * 137 + 21) % 370;
      ctx.globalAlpha = 0.42 + Math.sin(drift * 0.7 + i * 3) * 0.16;
      if (i % 7 === 0) star(ctx, x, y, winter ? '#d7eafa' : '#ede5d5', 1);
      else box(ctx, winter ? '#d7eafa' : '#ede5d5', x, y, 2, 2);
    }
    ctx.globalAlpha = 1;
    if (winter) {
      ctx.globalAlpha = 0.07;
      pixelOval(ctx, '#c4e6ff', 249, 73, 91, 91, 8);
      ctx.globalAlpha = 1;
    }
    pixelOval(ctx, winter ? '#85a7be' : '#aaa1b8', 268, 94, 52, 52, 5);
    pixelOval(ctx, winter ? '#f0faff' : '#eee4d9', 270, 92, 46, 46, 4);
    box(ctx, winter ? '#c4dce9' : '#c8bed0', 282, 103, 8, 7);
    box(ctx, winter ? '#d9e9f1' : '#d6ccda', 298, 115, 8, 9);
    box(ctx, winter ? '#d9e9f1' : '#d6ccda', 277, 122, 5, 5);
    ctx.globalAlpha = winter ? 0.16 : 0.3;
    cloud(ctx, 232 + Math.sin(drift / 45) * 5, 129, 1, palette);
    cloud(ctx, -16, 201, 1.2, palette);
    ctx.globalAlpha = 1;
  } else {
    ctx.globalAlpha = 0.24;
    pixelOval(ctx, '#fffce8', 252, 74, 92, 92, 8);
    ctx.globalAlpha = 1;
    pixelOval(ctx, '#ffefad', 275, 96, 44, 44, 5);
    box(ctx, '#fff4c1', 287, 100, 17, 4);
    cloud(ctx, 21 + Math.sin(drift / 40) * 7, 142, 0.9, palette);
    cloud(ctx, 233 + Math.sin(drift / 45 + 2) * 6, 222, 0.76, palette);
    cloud(ctx, -29 + Math.sin(drift / 52) * 4, 296, 0.6, palette);
  }

  // Parallax moves gently, while the actual platforms retain exact world positions.
  const offset = Math.sin(camera / 1800) * 18;
  ridge(ctx, palette.distant, [[-20, 460], [66, 310], [130, 394], [200, 285], [273, 403], [380, 336]], offset);
  if (theme === 'winter') {
    shape(ctx, '#607c92', [[41, 352 + offset], [41, 336 + offset], [54, 336 + offset], [54, 310 + offset], [66, 310 + offset], [66, 326 + offset], [78, 326 + offset], [78, 341 + offset], [89, 341 + offset], [89, 358 + offset], [76, 358 + offset], [76, 348 + offset], [64, 348 + offset], [64, 356 + offset], [53, 356 + offset], [53, 347 + offset]]);
    shape(ctx, '#7b93a6', [[173, 329 + offset], [173, 313 + offset], [185, 313 + offset], [185, 285 + offset], [200, 285 + offset], [200, 304 + offset], [213, 304 + offset], [213, 324 + offset], [225, 324 + offset], [225, 340 + offset], [210, 340 + offset], [210, 333 + offset], [198, 333 + offset], [198, 320 + offset], [187, 320 + offset], [187, 335 + offset]]);
  }
  if (theme === 'kvlt') castle(ctx, 231, 373 + offset, 0.8);
  ridge(ctx, palette.hill, [[-20, 473], [39, 421], [104, 438], [155, 487], [224, 405], [295, 445], [380, 420]], offset * 1.4);
  if (theme === 'winter') {
    for (const [x, bottom, height] of [[17, 531, 112], [66, 520, 65], [101, 546, 92], [236, 540, 72], [288, 522, 121], [343, 532, 85]]) {
      winterPine(ctx, x, bottom + offset * 1.6, height, '#172c40', true);
    }
  }
  ridge(ctx, palette.nearHill, [[-20, 559], [71, 489], [127, 506], [190, 569], [275, 505], [380, 491]], offset * 1.8);

  // Tiny background plants and fireflies give the quiet landscape its scale.
  for (let i = 0; i < 22; i += 1) {
    const x = (i * 67 + 19) % WIDTH;
    const y = 538 + (i * 31) % 104 + offset * 1.8;
    ctx.globalAlpha = 0.35;
    if (theme === 'winter') {
      box(ctx, '#65859b', x, y, 4 + i % 4, 1);
    } else {
      box(ctx, palette.grass, x, y, 2, 7);
      box(ctx, palette.grass, x - 2, y + 2, 6, 2);
      if (i % 3 === 0) box(ctx, palette.detail, x, y - 2, 2, 2);
    }
  }
  for (let i = 0; i < (theme === 'winter' ? 32 : 14); i += 1) {
    const x = (i * 79 + 33 + Math.sin(drift / 3 + i) * 5) % WIDTH;
    const y = (i * 113 + 90 + (theme === 'winter' ? drift * (7 + i % 5) : Math.sin(drift / 5 + i) * 8)) % 640;
    ctx.globalAlpha = 0.18 + (Math.sin(drift + i) + 1) * 0.1;
    box(ctx, palette.detail, x, y, 2, 2);
  }
  ctx.globalAlpha = 1;
}

function drawPlatform(ctx, platform, screenY, palette, theme) {
  const x = Math.round(platform.x);
  const y = Math.round(screenY);
  const width = Math.round(platform.width);
  const seed = Math.abs(Number(platform.id) || x + platform.y);

  // A dark underside and the thin bright top make the landing surface unambiguous.
  box(ctx, 'rgba(37,43,46,.13)', x + 5, y + 20, width - 10, 5);
  box(ctx, palette.dirtDark, x + 3, y + 5, width - 6, 19);
  box(ctx, palette.dirtDark, x + 9, y + 24, width - 18, 3);
  box(ctx, palette.dirt, x + 3, y + 6, width - 6, 15);
  box(ctx, palette.dirt, x + 9, y + 21, width - 18, 3);
  for (let j = 0; j < width - 14; j += 17) {
    const depth = ((j + seed * 3) % 11) + 10;
    box(ctx, palette.dirtLight, x + 8 + j, y + depth, 5, 3);
    if (theme === 'meadow' && j % 2 === 0) box(ctx, palette.dirtDark, x + 10 + j, y + 21, 2, 4);
  }
  box(ctx, palette.grass, x, y + 2, width, 7);
  box(ctx, palette.grassLight, x, y, width, 5);
  box(ctx, palette.grassTop, x + 3, y, width - 6, 2);
  if (theme !== 'meadow') {
    for (let j = 18; j < width - 5; j += 24) {
      box(ctx, palette.dirtDark, x + j, y + 10, 2, 9);
      box(ctx, palette.dirtDark, x + j - 3, y + 17, 5, 2);
    }
    if (theme === 'winter') {
      box(ctx, '#eef7fa', x + 3, y - 3, 13, 3);
      box(ctx, '#eef7fa', x + width - 23, y - 2, 18, 2);
      box(ctx, '#bad5e1', x + 7, y + 6, 3, 7);
      box(ctx, '#bad5e1', x + width - 14, y + 6, 3, 10);
      box(ctx, '#e1f1f6', x + width - 14, y + 6, 1, 6);
      box(ctx, '#c5dfe9', x + width - 13, y + 16, 1, 3);
    } else {
      box(ctx, '#777487', x + 6, y - 2, 8, 2);
      box(ctx, '#777487', x + width - 17, y - 3, 9, 3);
    }
  } else {
    for (let j = 7; j < width - 3; j += 13) {
      box(ctx, palette.grass, x + j, y + 7, 4, 4 + ((j + seed) % 4));
      if (j < 24 || j > width - 23) {
        box(ctx, palette.grassLight, x + j, y - 3, 2, 3);
        box(ctx, palette.grassLight, x + j + 2, y - 5, 2, 3);
      }
    }
    if (width > 70 && seed % 3 !== 1) {
      const flowerX = x + (seed % 2 ? width - 15 : 15);
      box(ctx, palette.grass, flowerX, y - 8, 2, 8);
      star(ctx, flowerX, y - 9, palette.flower, 2);
      box(ctx, '#fff4c0', flowerX, y - 9, 2, 2);
    }
  }
}

function drawSatsuma(ctx, x, y, time, theme, reducedMotion) {
  const float = reducedMotion ? 0 : Math.sin(time * 3 + x) * 1.4;
  y += float;
  ctx.globalAlpha = 0.14;
  pixelOval(ctx, theme !== 'meadow' ? '#ffb45e' : '#fffbcd', x - 23, y - 37, 46, 43, 6);
  ctx.globalAlpha = 1;
  pixelOval(ctx, '#9b6243', x - 15, y - 27, 30, 27, 3);
  pixelOval(ctx, '#ee8b42', x - 15, y - 29, 30, 25, 3);
  pixelOval(ctx, '#ffb44e', x - 12, y - 29, 23, 20, 3);
  box(ctx, '#ffdc83', x - 7, y - 25, 7, 3);
  box(ctx, '#ffcb6d', x - 10, y - 22, 3, 5);
  box(ctx, '#d77539', x + 8, y - 16, 3, 6);
  box(ctx, '#87624a', x - 1, y - 34, 3, 7);
  box(ctx, '#4b8051', x + 2, y - 35, 9, 5);
  box(ctx, '#73a866', x + 3, y - 35, 8, 2);
  star(ctx, x + 23, y - 24, '#fff4bc', 2);
  if (Math.sin(time * 4 + x) > 0.2) star(ctx, x - 21, y - 38, '#fff4bc', 1);
}

function drawTrap(ctx, x, y, theme, used) {
  const metal = theme === 'winter' ? '#b8cfda' : theme === 'kvlt' ? '#a7a0b6' : '#b2ada0';
  const shadow = theme === 'winter' ? '#1a2c3f' : theme === 'kvlt' ? '#302d44' : '#68636a';
  if (used) {
    box(ctx, shadow, x - 12, y - 4, 24, 4);
    box(ctx, metal, x - 10, y - 5, 20, 2);
    return;
  }
  box(ctx, shadow, x - 17, y - 5, 34, 5);
  box(ctx, metal, x - 15, y - 7, 30, 4);
  box(ctx, '#e0d6c3', x - 7, y - 8, 14, 4);
  box(ctx, '#be8d86', x - 4, y - 7, 8, 3);
  for (const direction of [-1, 1]) {
    box(ctx, shadow, x + direction * 16 - 2, y - 15, 4, 12);
    box(ctx, metal, x + direction * 15 - 1, y - 14, 2, 10);
    box(ctx, shadow, x + direction * 13 - 2, y - 17, 4, 5);
    box(ctx, '#e1dad0', x + direction * 12 - 2, y - 16, 3, 3);
    box(ctx, '#e1dad0', x + direction * 14 - 2, y - 9, 4, 2);
  }
  box(ctx, shadow, x + 18, y - 1, 7, 2);
  box(ctx, metal, x + 22, y, 5, 2);
}

function drawPoop(ctx, x, y, theme, used) {
  const outline = theme === 'kvlt' ? '#5a4264' : '#73574e';
  const fill = theme === 'kvlt' ? '#aa799c' : '#ae8060';
  if (used) {
    pixelOval(ctx, outline, x - 15, y - 3, 30, 4, 1);
    return;
  }
  pixelOval(ctx, outline, x - 14, y - 10, 28, 10, 2);
  pixelOval(ctx, fill, x - 12, y - 10, 24, 7, 2);
  pixelOval(ctx, outline, x - 10, y - 18, 20, 10, 2);
  pixelOval(ctx, fill, x - 8, y - 18, 16, 8, 2);
  pixelOval(ctx, outline, x - 5, y - 25, 12, 9, 2);
  box(ctx, fill, x - 3, y - 25, 8, 8);
  box(ctx, fill, x + 1, y - 29, 4, 5);
  box(ctx, theme === 'kvlt' ? '#d3a3c0' : '#d7ad81', x - 7, y - 16, 5, 2);
  if (theme === 'kvlt' || theme === 'winter') {
    const paint = theme === 'winter' ? '#e4f0f4' : '#f4eee8';
    const black = theme === 'winter' ? '#142638' : '#342e3f';
    pixelOval(ctx, paint, x - 10, y - 13, 21, 12, 2);
    box(ctx, black, x - 7, y - 11, 5, 5);
    box(ctx, black, x + 3, y - 11, 5, 5);
    box(ctx, black, x - 7, y - 14, 2, 4);
    box(ctx, black, x + 6, y - 14, 2, 4);
    box(ctx, black, x - 5, y - 7, 2, 4);
    box(ctx, black, x + 5, y - 7, 2, 4);
    box(ctx, paint, x - 5, y - 10, 1, 2);
    box(ctx, paint, x + 5, y - 10, 1, 2);
    box(ctx, black, x - 1, y - 3, 4, 1);
  } else {
    box(ctx, '#fff6e7', x - 6, y - 9, 4, 4);
    box(ctx, '#fff6e7', x + 3, y - 9, 4, 4);
    box(ctx, '#493e4c', x - 4, y - 8, 2, 3);
    box(ctx, '#493e4c', x + 3, y - 8, 2, 3);
    box(ctx, '#73574e', x, y - 3, 2, 1);
  }
}

/** Draw the round Ponppu character, anchored at the unchanged physics feet. */
export function drawBunny(ctx, x, feetY, {
  theme = 'meadow', pose = 'idle', scale = 1, facing = 1, time = 0,
  impact = 0, vx = 0, vy = 0, reducedMotion = false,
} = {}) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(feetY));
  ctx.scale(scale, scale);
  const outline = theme === 'winter' ? '#142638' : theme === 'kvlt' ? '#373549' : '#62505a';
  const white = '#fffbee';
  const shade = '#dcd6d8';
  const pink = theme === 'winter' ? '#c1b6c3' : theme === 'kvlt' ? '#c6a2b4' : '#eea9b2';
  const rising = pose === 'jump';
  const falling = pose === 'fall';
  const trapped = pose === 'trapped';
  const sliding = pose === 'sliding';
  const earShift = rising ? 3 : sliding ? -3 : 0;
  const animated = !reducedMotion;
  const flutter = animated ? Math.sin(time * (trapped ? 23 : rising ? 16 : falling ? 12 : 3)) : 0;
  const bounce = animated ? Math.sin(time * (trapped ? 19 : sliding ? 17 : 10)) : 0;
  const wiggle = trapped && animated ? Math.round(bounce) : 0;
  ctx.translate(wiggle, 0);

  // The transform pivots at the feet: animation never moves the physics anchor.
  if (animated) {
    const squash = Math.max(0, Math.min(1, impact));
    const stretch = rising ? 0.045 + Math.min(Math.max(vy, 0) / 1000, 1) * 0.035 : falling ? 0.025 : 0;
    const breath = pose === 'idle' ? Math.sin(time * 3) * 0.012 : 0;
    ctx.scale(1 - stretch * 0.45 + squash * 0.12, 1 + stretch + breath - squash * 0.22);
    const lean = sliding ? facing * 0.14 : Math.max(-1, Math.min(1, vx / 240)) * 0.07;
    ctx.transform(1, 0, -lean, 1, 0, 0);
  }

  // Ears are individually outlined instead of using an enlarged emoji or font glyph.
  const earFlutter = Math.round(flutter * (rising || falling ? 2 : 1));
  const leftEarDrop = animated ? Math.round((1 + flutter) * (falling ? 2 : 1)) : 0;
  const rightEarDrop = animated ? Math.round((1 - flutter) * (rising ? 2 : 1)) : 0;
  pixelOval(ctx, outline, -11 - earShift + earFlutter, -50 + leftEarDrop, 9, 29 - leftEarDrop, 2);
  pixelOval(ctx, white, -9 - earShift + earFlutter, -48 + leftEarDrop, 5, 27 - leftEarDrop, 1);
  box(ctx, pink, -8 - earShift + earFlutter, -43 + leftEarDrop, 3, 17 - leftEarDrop);
  pixelOval(ctx, outline, 3 - earShift - earFlutter, -53 + rightEarDrop, 9, 31 - rightEarDrop, 2);
  pixelOval(ctx, white, 5 - earShift - earFlutter, -51 + rightEarDrop, 5, 28 - rightEarDrop, 1);
  box(ctx, pink, 6 - earShift - earFlutter, -46 + rightEarDrop, 3, 19 - rightEarDrop);

  // A broad head flows into a short, round body. The physics size is unchanged.
  pixelOval(ctx, outline, -21 * facing - 3, -13, 10, 10, 2);
  pixelOval(ctx, white, -21 * facing - 1, -11, 6, 6, 1);
  pixelOval(ctx, outline, -16, -21, 33, 21, 3);
  pixelOval(ctx, shade, -14, -19, 29, 17, 3);
  pixelOval(ctx, white, -14, -19, 27, 17, 3);
  pixelOval(ctx, outline, -20, -33, 40, 28, 4);
  pixelOval(ctx, shade, -18, -31, 36, 25, 3);
  pixelOval(ctx, white, -18, -31, 35, 22, 3);
  box(ctx, white, -12, -13, 24, 10);

  const eyeX = facing < 0 ? -1 : 1;
  if (theme !== 'meadow') {
    const paint = '#29252e';
    // Corpse paint frames the eyes with tapered points; there is no collar.
    pixelOval(ctx, paint, -13 + eyeX, -27, 11, 12, 2);
    pixelOval(ctx, paint, 3 + eyeX, -27, 11, 12, 2);
    box(ctx, paint, -9 + eyeX, -31, 1, 4);
    box(ctx, paint, -10 + eyeX, -29, 3, 4);
    box(ctx, paint, 8 + eyeX, -31, 1, 4);
    box(ctx, paint, 7 + eyeX, -29, 3, 4);
    box(ctx, paint, -10 + eyeX, -17, 3, 6);
    box(ctx, paint, -9 + eyeX, -11, 1, 3);
    box(ctx, paint, 8 + eyeX, -17, 3, 6);
    box(ctx, paint, 9 + eyeX, -11, 1, 3);
    box(ctx, paint, -14 + eyeX, -27, 2, 1);
    box(ctx, paint, -15 + eyeX, -28, 1, 1);
    box(ctx, paint, 13 + eyeX, -27, 2, 1);
    box(ctx, paint, 15 + eyeX, -28, 1, 1);
    pixelOval(ctx, white, -10 + eyeX, -24, 5, 6, 1);
    pixelOval(ctx, white, 6 + eyeX, -24, 5, 6, 1);
    box(ctx, paint, -8 + eyeX, -24, 1, 3);
    box(ctx, paint, 8 + eyeX, -24, 1, 3);
  } else {
    if (trapped) {
      box(ctx, outline, -10, -24, 6, 2);
      box(ctx, outline, -7, -22, 3, 2);
      box(ctx, outline, 5, -24, 6, 2);
      box(ctx, outline, 5, -22, 3, 2);
    } else {
      const eyeInk = '#493f4b';
      pixelOval(ctx, eyeInk, -11 + eyeX, -26, 7, 8, 1);
      pixelOval(ctx, eyeInk, 4 + eyeX, -26, 7, 8, 1);
      box(ctx, white, -10 + eyeX, -25, 2, 2);
      box(ctx, white, 5 + eyeX, -25, 2, 2);
      box(ctx, '#cfb0a4', -6 + eyeX, -20, 1, 1);
      box(ctx, '#cfb0a4', 9 + eyeX, -20, 1, 1);
      // Two light pixel strokes at each outer upper corner.
      box(ctx, eyeInk, -12 + eyeX, -27, 2, 1);
      box(ctx, eyeInk, -13 + eyeX, -28, 1, 1);
      box(ctx, eyeInk, -10 + eyeX, -28, 1, 2);
      box(ctx, eyeInk, 11 + eyeX, -27, 2, 1);
      box(ctx, eyeInk, 13 + eyeX, -28, 1, 1);
      box(ctx, eyeInk, 10 + eyeX, -28, 1, 2);
    }
    box(ctx, '#f4bac1', -15, -19, 5, 3);
    box(ctx, '#f4bac1', 11, -19, 5, 3);
  }
  box(ctx, pink, -1 + eyeX, -19, 3, 2);
  box(ctx, outline, eyeX, -16, 1, 2);
  box(ctx, outline, -2 + eyeX, -15, 2, 1);
  box(ctx, outline, 1 + eyeX, -15, 2, 1);

  const pawY = rising ? -11 : falling ? -13 : trapped || sliding ? -10 : -8;
  const pawSwing = Math.round(bounce * (trapped ? 2 : 1));
  const pawSpread = falling ? 2 : 0;
  pixelOval(ctx, outline, -23 - pawSpread, pawY + pawSwing - 1, 8, 8, 1);
  box(ctx, shade, -21 - pawSpread, pawY + pawSwing + 1, 5, 5);
  box(ctx, white, -21 - pawSpread, pawY + pawSwing, 4, 4);
  pixelOval(ctx, outline, 16 + pawSpread, pawY - pawSwing - 1, 8, 8, 1);
  box(ctx, shade, 18 + pawSpread, pawY - pawSwing + 1, 5, 5);
  box(ctx, white, 18 + pawSpread, pawY - pawSwing, 4, 4);
  const footKick = animated && (rising || falling) ? Math.round(bounce * 2) : 0;
  const leftFootY = -4 - Math.max(0, footKick);
  const rightFootY = -4 + (sliding ? -3 : 0) - Math.max(0, -footKick);
  pixelOval(ctx, outline, -16, leftFootY, 14, 6, 1);
  pixelOval(ctx, outline, 3, rightFootY, 14, 6, 1);
  box(ctx, pink, -14, leftFootY + 2, 10, 2);
  box(ctx, pink, 5, rightFootY + 2, 10, 2);
  box(ctx, white, -13, leftFootY, 9, 2);
  box(ctx, white, 5, rightFootY, 9, 2);
  if (trapped) {
    box(ctx, '#6e6472', -12, -2, 16, 4);
    box(ctx, '#c6b8c4', -10, -2, 12, 2);
    star(ctx, 24, -34, '#f5d49c', 2);
  }
  ctx.restore();
}

function drawLandingEffect(ctx, landing, age, screenY, theme) {
  const duration = 0.32;
  if (!landing || age < 0 || age >= duration) return;
  const progress = age / duration;
  const spread = 1 - (1 - progress) ** 2;
  const colors = theme === 'winter' ? ['#f1fbff', '#b1d5e6']
    : theme === 'kvlt' ? ['#958ca2', '#554d65'] : ['#e6cd9e', '#ba9b79'];
  const y = screenY(landing.y);
  ctx.save();
  for (let i = 0; i < 8; i += 1) {
    const direction = i % 2 ? 1 : -1;
    const x = landing.x + direction * (7 + spread * (13 + (i % 4) * 5));
    const particleY = y - 3 - Math.sin(progress * Math.PI) * (7 + (i % 3) * 4) - (i % 2) * 2;
    const size = Math.max(2, Math.round((6 + i % 3) * (1 - progress * 0.5)));
    ctx.globalAlpha = (1 - progress) * (i % 2 ? 0.85 : 0.65);
    if (theme === 'winter' && i % 3 === 0) star(ctx, x, particleY, colors[0], 1);
    else pixelOval(ctx, colors[i % 2], x - size / 2, particleY - size / 2, size, Math.max(3, size - 2), 1);
  }
  if (landing.type === 'satsuma') {
    ctx.globalAlpha = 1 - progress;
    star(ctx, landing.x - 12 - spread * 18, y - 10 - spread * 17, '#ffe1a1', 2);
    star(ctx, landing.x + 12 + spread * 18, y - 10 - spread * 17, '#ffe1a1', 2);
  }
  ctx.restore();
}

function drawComboBurst(ctx, game, theme, reducedMotion) {
  if (!(game.satsumaStreak >= 3) || game.lastLanding?.type !== 'satsuma') return;
  const age = game.time - game.lastLanding.time;
  const duration = reducedMotion ? 0.55 : 0.85;
  if (age < 0 || age >= duration) return;

  const colors = theme === 'winter'
    ? { fill: '#a8dff4', ink: '#102b45', border: '#f1fcff', spark: '#c6f3ff' }
    : theme === 'kvlt'
      ? { fill: '#d3b5e9', ink: '#38233f', border: '#ffe8ad', spark: '#f8d483' }
      : { fill: '#ffd378', ink: '#65404b', border: '#fff9d7', spark: '#ffbd65' };
  const label = `${game.satsumaStreak}× KOMBO!`;
  ctx.save();
  ctx.font = 'bold 24px monospace';
  const fontSize = Math.min(24, Math.floor(24 * 228 / ctx.measureText(label).width));
  ctx.font = `bold ${fontSize}px monospace`;
  const halfWidth = (Math.ceil(ctx.measureText(label).width) + 28) / 2;
  const positions = [[180, 158], [132, 210], [228, 246], [150, 258], [222, 183]];
  const [requestedX, y] = positions[(game.satsumaStreak - 3) % positions.length];
  const extent = (halfWidth + 18) * 1.12;
  const x = Math.max(16 + extent, Math.min(WIDTH - 16 - extent, requestedX));
  const pop = reducedMotion ? 1
    : age < 0.12 ? 0.72 + 0.4 * Math.sin(age / 0.12 * Math.PI / 2)
      : age < 0.24 ? 1.12 - (age - 0.12) : 1;
  ctx.globalAlpha = reducedMotion || age < 0.58 ? 1 : (duration - age) / (duration - 0.58);
  ctx.translate(Math.round(x), y);
  ctx.scale(pop, pop);

  const burst = [
    [-halfWidth - 10, -24], [-halfWidth + 12, -21], [-halfWidth + 8, -34], [-halfWidth + 40, -26],
    [-18, -31], [0, -39], [15, -30], [halfWidth - 37, -26], [halfWidth - 10, -35],
    [halfWidth - 12, -19], [halfWidth + 11, -23], [halfWidth + 3, -3], [halfWidth + 13, 13],
    [halfWidth - 8, 16], [halfWidth - 4, 31], [halfWidth - 35, 24], [17, 29], [2, 37],
    [-15, 28], [-halfWidth + 35, 24], [-halfWidth + 9, 32], [-halfWidth + 11, 17],
    [-halfWidth - 12, 20], [-halfWidth - 4, 0],
  ];
  ctx.save();
  ctx.translate(3, 4);
  shape(ctx, colors.ink, burst);
  ctx.restore();
  shape(ctx, colors.fill, burst);
  ctx.lineWidth = 3;
  ctx.strokeStyle = colors.border;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = colors.border;
  ctx.fillText(label, 0, 2);
  ctx.fillStyle = colors.ink;
  ctx.fillText(label, 0, 0);

  // A few local sparks celebrate the pickup without flashing the whole playfield.
  const travel = reducedMotion ? 0 : Math.min(1, age / 0.45) * 12;
  star(ctx, -halfWidth - 4, -38 - travel, colors.spark, 2);
  star(ctx, halfWidth - 7, 39 + travel * 0.5, colors.border, 2);
  star(ctx, halfWidth + 4, -36 - travel * 0.5, colors.border, 1);
  ctx.restore();
}

function drawBubble(ctx, text, x, feetY, theme) {
  ctx.save();
  ctx.font = 'bold 12px monospace';
  const width = Math.ceil(ctx.measureText(text).width) + 20;
  const left = Math.round(Math.max(8, Math.min(WIDTH - width - 8, x - width / 2)));
  const top = Math.round(Math.max(9, feetY - 91));
  const tail = Math.max(left + 8, Math.min(left + width - 12, x));
  const outline = theme === 'winter' ? '#15273b' : theme === 'kvlt' ? '#373549' : '#796770';
  pixelOval(ctx, outline, left, top, width, 28, 3);
  pixelOval(ctx, '#fffbed', left + 2, top + 2, width - 4, 24, 2);
  box(ctx, outline, tail, top + 27, 7, 5);
  box(ctx, '#fffbed', tail + 2, top + 25, 3, 5);
  box(ctx, outline, tail, top + 31, 3, 2);
  ctx.fillStyle = '#5b485a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, left + width / 2, top + 14);
  ctx.restore();
}

function drawJoystick(ctx, joystick, theme) {
  if (!joystick) return;
  const x = joystick.x;
  const y = joystick.y;
  const dx = Math.max(-42, Math.min(42, joystick.dx));
  const dy = Math.max(-42, Math.min(42, joystick.dy));
  ctx.save();
  ctx.strokeStyle = theme === 'winter' ? '#e1f1fa' : theme === 'kvlt' ? '#eee0e9' : '#fffbed';
  ctx.fillStyle = theme !== 'meadow' ? 'rgba(12,23,38,.3)' : 'rgba(62,95,72,.13)';
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.arc(x, y, 43, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 53, y);
  ctx.lineTo(x - 48, y - 4);
  ctx.lineTo(x - 48, y + 4);
  ctx.closePath();
  ctx.moveTo(x + 53, y);
  ctx.lineTo(x + 48, y - 4);
  ctx.lineTo(x + 48, y + 4);
  ctx.closePath();
  ctx.fillStyle = '#fffbed';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + dx, y + dy * 0.45, 18, 0, Math.PI * 2);
  ctx.fillStyle = theme === 'winter' ? 'rgba(183,214,235,.62)' : theme === 'kvlt' ? 'rgba(214,191,219,.62)' : 'rgba(255,251,237,.66)';
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** Render only: world coordinates and physics are owned by the game model. */
export function drawGame(ctx, game, options = {}) {
  const theme = options.theme === 'winter' || options.theme === 'kvlt' ? options.theme : 'meadow';
  const palette = palettes[theme];
  const time = game.phase === 'ready' ? options.time ?? game.time ?? 0 : game.time;
  const reducedMotion = Boolean(options.reducedMotion);
  const visualTime = reducedMotion ? 0 : time;
  const screenY = (worldY) => HEIGHT - (worldY - game.camera);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  drawBackground(ctx, game, { theme, time: visualTime, reducedMotion }, palette);

  for (const platform of game.platforms) {
    const y = screenY(platform.y);
    if (y < -50 || y > HEIGHT + 30) continue;
    drawPlatform(ctx, platform, y, palette, theme);
  }

  // Items sit in front of every platform, including nearby overlapping platforms.
  for (const platform of game.platforms) {
    if (!platform.item && !platform.chainSatsuma) continue;
    const y = screenY(platform.y);
    // A satsuma and its sparkle extend above a platform already below the screen.
    if (y < -10 || y > HEIGHT + 48) continue;
    const item = platform.item;
    if (item?.type === 'satsuma' && !item.used) drawSatsuma(ctx, item.x, y, visualTime, theme, reducedMotion);
    if (item?.type === 'trap') drawTrap(ctx, item.x, y, theme, item.used);
    if (item?.type === 'poop') drawPoop(ctx, item.x, y, theme, item.used);
    const chain = platform.chainSatsuma;
    if (chain && !chain.used) drawSatsuma(ctx, chain.x, y, visualTime, theme, reducedMotion);
  }

  const player = game.player;
  const bunnyY = screenY(player.y);
  const landingAge = game.lastLanding ? game.time - game.lastLanding.time : Infinity;
  if (!reducedMotion) drawLandingEffect(ctx, game.lastLanding, landingAge, screenY, theme);
  if (player.vy > 760 && !reducedMotion) {
    for (let i = 0; i < 8; i += 1) {
      const sway = Math.sin(visualTime * 10 + i * 4);
      ctx.globalAlpha = (1 - i / 8) * 0.7;
      star(ctx, player.x + sway * (9 + i * 2), bunnyY + 12 + i * 10, i % 2 ? '#fff7b3' : '#ffc16b', i % 3 ? 2 : 3);
    }
    ctx.globalAlpha = 1;
  }
  if (player.state === 'sliding') {
    const direction = player.vx < 0 ? 1 : -1;
    for (let i = 0; i < 3; i += 1) box(ctx, palette.cloud, player.x + direction * (21 + i * 7), bunnyY - 6 - i * 5, 5, 2);
  }
  drawBunny(ctx, player.x, bunnyY, {
    theme,
    pose: game.phase === 'ready' ? 'idle' : player.state === 'trapped' || player.state === 'sliding' ? player.state : player.vy > 0 ? 'jump' : 'fall',
    facing: player.vx < -8 ? -1 : 1,
    time: visualTime,
    impact: landingAge >= 0 && landingAge < 0.18 ? (1 - landingAge / 0.18) ** 2 : 0,
    vx: player.vx,
    vy: player.vy,
    reducedMotion,
  });
  if (game.bubble && game.time < game.bubbleUntil) drawBubble(ctx, game.bubble, player.x, bunnyY, theme);
  drawComboBurst(ctx, game, theme, reducedMotion);

  // The lower edge is always lethal; a soft shaded lip makes it visible without clutter.
  const edge = ctx.createLinearGradient(0, HEIGHT - 48, 0, HEIGHT);
  edge.addColorStop(0, theme !== 'meadow' ? 'rgba(7,15,28,0)' : 'rgba(65,99,74,0)');
  edge.addColorStop(1, theme !== 'meadow' ? 'rgba(7,15,28,.42)' : 'rgba(65,99,74,.22)');
  ctx.fillStyle = edge;
  ctx.fillRect(0, HEIGHT - 48, WIDTH, 48);
  drawJoystick(ctx, options.joystick, theme);
  ctx.restore();
}
