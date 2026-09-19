// Original, hand-drawn pixel artwork. All coordinates use the 360 × 640 playfield.
const WIDTH = 360;
const HEIGHT = 640;

const palettes = {
  meadow: {
    sky: '#e9f1d5', skyBottom: '#bfdfbd', cloud: '#fffbed', cloudShade: '#e6dfd2',
    distant: '#bdcdb4', hill: '#95bea2', nearHill: '#7daa87', detail: '#edf2b1',
    grass: '#497b5b', grassLight: '#a0cf76', grassTop: '#d4e89a', dirt: '#97745e',
    dirtLight: '#b59270', dirtDark: '#6d5b50', flower: '#f4b19c', outline: '#4b4750',
    rock: '#888779', rockLight: '#aaa794', rockDark: '#60665d',
  },
  autumn: {
    sky: '#eee9dd', skyBottom: '#d8c8aa', cloud: '#fbf3e3', cloudShade: '#d9cdbb',
    distant: '#c1b198', hill: '#b39a77', nearHill: '#927e5c', detail: '#f0cf88',
    grass: '#9b693d', grassLight: '#dca44f', grassTop: '#f3d189', dirt: '#8e6850',
    dirtLight: '#b88c61', dirtDark: '#674f43', flower: '#bc6546', outline: '#5e4945',
    rock: '#8e7d6c', rockLight: '#b4a087', rockDark: '#675e54',
  },
  kvlt: {
    sky: '#252a43', skyBottom: '#666078', cloud: '#777089', cloudShade: '#5b546f',
    distant: '#464359', hill: '#3c3e50', nearHill: '#333849', detail: '#b0a8cc',
    grass: '#67677f', grassLight: '#92909f', grassTop: '#b1a7b9', dirt: '#575467',
    dirtLight: '#757083', dirtDark: '#343143', flower: '#c687b3', outline: '#242638',
    rock: '#615c72', rockLight: '#847c91', rockDark: '#393547',
  },
  winter: {
    sky: '#080f20', skyBottom: '#263e57', cloud: '#6f879b', cloudShade: '#435b72',
    distant: '#253e55', hill: '#1d3349', nearHill: '#13283b', detail: '#d8ebf2',
    grass: '#91b0c1', grassLight: '#e0eff4', grassTop: '#ffffff', dirt: '#3e576b',
    dirtLight: '#628196', dirtDark: '#172c3e', flower: '#e8f3f8', outline: '#091322',
    rock: '#557084', rockLight: '#7e9aac', rockDark: '#293f52',
  },
};

const isDarkTheme = (theme) => theme === 'kvlt' || theme === 'winter';

// Visual choices stay fixed as the camera moves and never consume gameplay randomness.
function platformHash(seed, id, channel = 0) {
  let value = seed ^ Math.imul(id + 1, 0x9e3779b9) ^ Math.imul(channel + 1, 0x85ebca6b);
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  return (value ^ (value >>> 16)) >>> 0;
}

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

function autumnLeaf(ctx, x, y, color, turn = 1) {
  const width = 2 + Math.round(Math.abs(turn) * 4);
  box(ctx, color, x - width / 2, y - 2, width, 4);
  box(ctx, color, x - width / 2 + 1, y - 3, Math.max(1, width - 2), 6);
  box(ctx, '#856047', x + 1, y + 2, 1, 2);
}

function autumnTree(ctx, x, bottom, height, colors) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(bottom));
  ctx.scale(height / 100, height / 100);
  box(ctx, colors.trunk, -4, -72, 8, 72);
  box(ctx, colors.trunk, -14, -48, 11, 5);
  box(ctx, colors.trunk, -18, -58, 5, 14);
  box(ctx, colors.trunk, 3, -59, 12, 5);
  box(ctx, colors.trunk, 12, -69, 5, 13);
  pixelOval(ctx, colors.shade, -34, -86, 69, 47, 5);
  pixelOval(ctx, colors.leaf, -28, -96, 40, 44, 4);
  pixelOval(ctx, colors.leaf, 0, -87, 37, 38, 4);
  pixelOval(ctx, colors.leaf, -40, -73, 35, 29, 4);
  pixelOval(ctx, colors.light, -17, -94, 27, 15, 3);
  for (const [dx, dy, width] of [[-30, -65, 8], [-15, -75, 7], [16, -78, 9], [7, -61, 6], [-4, -49, 6]]) {
    box(ctx, colors.light, dx, dy, width, 3);
  }
  ctx.restore();
}

function drawBackground(ctx, game, { theme, time, reducedMotion }, palette) {
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, palette.sky);
  gradient.addColorStop(1, palette.skyBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const drift = reducedMotion ? 0 : time;
  const camera = game.camera || 0;

  if (isDarkTheme(theme)) {
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
  if (theme === 'autumn') {
    const distantLeaves = { trunk: '#a08c70', shade: '#ad9270', leaf: '#bea17a', light: '#c8af88' };
    for (const [x, bottom, height] of [[16, 474, 108], [110, 468, 88], [246, 465, 101], [351, 474, 110]]) {
      autumnTree(ctx, x, bottom + offset * 1.2, height, distantLeaves);
    }
  }
  ridge(ctx, palette.hill, [[-20, 473], [39, 421], [104, 438], [155, 487], [224, 405], [295, 445], [380, 420]], offset * 1.4);
  if (theme === 'winter') {
    for (const [x, bottom, height] of [[17, 531, 112], [66, 520, 65], [101, 546, 92], [236, 540, 72], [288, 522, 121], [343, 532, 85]]) {
      winterPine(ctx, x, bottom + offset * 1.6, height, '#172c40', true);
    }
  }
  if (theme === 'autumn') {
    const goldLeaves = { trunk: '#7a624a', shade: '#ad764c', leaf: '#c8944f', light: '#dfb265' };
    const rustLeaves = { trunk: '#705847', shade: '#915e4b', leaf: '#b87550', light: '#ce9760' };
    autumnTree(ctx, 24, 544 + offset * 1.6, 122, goldLeaves);
    autumnTree(ctx, 280, 552 + offset * 1.6, 140, rustLeaves);
    autumnTree(ctx, 348, 534 + offset * 1.6, 94, goldLeaves);
  }
  ridge(ctx, palette.nearHill, [[-20, 559], [71, 489], [127, 506], [190, 569], [275, 505], [380, 491]], offset * 1.8);

  // Tiny background plants and fireflies give the quiet landscape its scale.
  for (let i = 0; i < 22; i += 1) {
    const x = (i * 67 + 19) % WIDTH;
    const y = 538 + (i * 31) % 104 + offset * 1.8;
    ctx.globalAlpha = 0.35;
    if (theme === 'winter') {
      box(ctx, '#65859b', x, y, 4 + i % 4, 1);
    } else if (theme === 'autumn') {
      box(ctx, i % 2 ? '#b7844d' : '#c69b58', x, y, 4 + i % 4, 2);
      box(ctx, '#745b42', x + 2, y + 2, 2, 1);
    } else {
      box(ctx, palette.grass, x, y, 2, 7);
      box(ctx, palette.grass, x - 2, y + 2, 6, 2);
      if (i % 3 === 0) box(ctx, palette.detail, x, y - 2, 2, 2);
    }
  }
  if (theme === 'autumn') {
    const leafColors = ['#c89843', '#b96a49', '#d5ae62'];
    for (let i = 0; i < 20; i += 1) {
      const x = (i * 79 + 33 + Math.sin(drift * 0.6 + i * 2) * 14) % WIDTH;
      const y = (i * 97 + 80 + drift * (9 + i % 5)) % (HEIGHT + 30) - 15;
      ctx.globalAlpha = 0.36 + (i % 3) * 0.11;
      autumnLeaf(ctx, x, y, leafColors[i % leafColors.length], Math.sin(drift * 2 + i));
    }
  } else {
    for (let i = 0; i < (theme === 'winter' ? 32 : 14); i += 1) {
      const x = (i * 79 + 33 + Math.sin(drift / 3 + i) * 5) % WIDTH;
      const y = (i * 113 + 90 + (theme === 'winter' ? drift * (7 + i % 5) : Math.sin(drift / 5 + i) * 8)) % 640;
      ctx.globalAlpha = 0.18 + (Math.sin(drift + i) + 1) * 0.1;
      box(ctx, palette.detail, x, y, 2, 2);
    }
  }
  ctx.globalAlpha = 1;
}

function drawFern(ctx, x, y) {
  box(ctx, '#749276', x - 1, y - 25, 2, 27);
  for (let row = 0; row < 5; row++) {
    const width = 3 + row * 2;
    const top = y - 23 + row * 4;
    box(ctx, '#7b9c7d', x - width, top, width - 1, 2);
    box(ctx, '#8caa85', x + 1, top - 1, width, 2);
    box(ctx, '#7b9c7d', x - width, top - 2, 2, 2);
    box(ctx, '#8caa85', x + width - 1, top - 3, 2, 2);
  }
  shape(ctx, '#829e7d', [[x, y], [x - 13, y - 12], [x - 17, y - 12], [x - 10, y - 9], [x - 8, y - 4]]);
  shape(ctx, '#94ae8a', [[x, y], [x + 11, y - 13], [x + 15, y - 15], [x + 13, y - 9], [x + 8, y - 5]]);
}

function drawAutumnBush(ctx, x, y) {
  box(ctx, '#917251', x - 1, y - 17, 3, 20);
  pixelOval(ctx, '#b08058', x - 16, y - 19, 31, 18, 3);
  pixelOval(ctx, '#c09162', x - 10, y - 27, 18, 18, 3);
  pixelOval(ctx, '#b27c60', x + 2, y - 21, 16, 15, 3);
  box(ctx, '#d0ab73', x - 9, y - 23, 7, 3);
  box(ctx, '#cf9a63', x + 5, y - 17, 5, 3);
  box(ctx, '#c69c69', x - 12, y - 12, 6, 3);
}

function drawPumpkin(ctx, x, y) {
  // A low, muted silhouette rooted in the scenery, unlike the bright satsumas.
  box(ctx, '#7c815d', x - 1, y - 20, 3, 7);
  box(ctx, '#879269', x + 1, y - 20, 5, 3);
  pixelOval(ctx, '#af794f', x - 12, y - 15, 25, 18, 3);
  pixelOval(ctx, '#c48e5d', x - 8, y - 16, 16, 19, 3);
  box(ctx, '#ac754f', x - 5, y - 12, 2, 14);
  box(ctx, '#b17b51', x + 4, y - 12, 2, 14);
  box(ctx, '#d0a373', x - 1, y - 12, 3, 6);
}

function drawSnowman(ctx, x, y) {
  box(ctx, '#7d93a1', x - 19, y - 14, 10, 2);
  box(ctx, '#7d93a1', x + 10, y - 17, 9, 2);
  box(ctx, '#7d93a1', x - 18, y - 18, 2, 5);
  box(ctx, '#7d93a1', x + 15, y - 21, 2, 5);
  pixelOval(ctx, '#8da5b5', x - 12, y - 16, 25, 20, 4);
  pixelOval(ctx, '#a9bfca', x - 9, y - 17, 19, 18, 3);
  pixelOval(ctx, '#a9bfca', x - 8, y - 31, 17, 16, 3);
  box(ctx, '#c0d0d7', x - 4, y - 29, 7, 3);
  box(ctx, '#607b91', x - 5, y - 25, 2, 2);
  box(ctx, '#607b91', x + 3, y - 25, 2, 2);
  box(ctx, '#bb9972', x, y - 22, 6, 2);
  box(ctx, '#8499b0', x - 8, y - 17, 17, 3);
  box(ctx, '#8499b0', x + 5, y - 14, 3, 6);
  box(ctx, '#738ca0', x - 1, y - 10, 2, 2);
  box(ctx, '#738ca0', x - 1, y - 4, 2, 2);
}

function drawSnowLantern(ctx, x, y) {
  const opacity = ctx.globalAlpha;
  for (const [size, alpha] of [[70, .055], [48, .09], [30, .15]]) {
    ctx.globalAlpha = opacity * alpha;
    pixelOval(ctx, '#ffda96', x - size / 2, y - 12 - size / 2, size, size, 5);
  }
  ctx.globalAlpha = opacity;
  pixelOval(ctx, '#a2b6bf', x - 13, y - 15, 26, 18, 3);
  pixelOval(ctx, '#b9c9cd', x - 9, y - 22, 18, 13, 3);
  pixelOval(ctx, '#c8d3d2', x - 5, y - 27, 10, 9, 2);
  pixelOval(ctx, '#c6b694', x - 6, y - 12, 12, 13, 2);
  box(ctx, '#edce93', x - 3, y - 9, 6, 10);
  box(ctx, '#ffe4a8', x - 1, y - 7, 2, 6);
  box(ctx, '#cfdbdc', x - 10, y - 11, 4, 3);
  box(ctx, '#cfdbdc', x + 6, y - 11, 4, 3);
}

function drawDaisies(ctx, x, y) {
  for (const [dx, height] of [[-9, 15], [0, 23], [9, 12]]) {
    box(ctx, '#829473', x + dx, y - height, 2, height + 1);
    box(ctx, '#91a77c', x + dx - 4, y - height / 2, 5, 2);
    box(ctx, '#d5d5b7', x + dx - 4, y - height - 2, 10, 4);
    box(ctx, '#e2ddc2', x + dx - 1, y - height - 5, 4, 10);
    box(ctx, '#bdac73', x + dx - 1, y - height - 2, 4, 4);
  }
}

function drawMushrooms(ctx, x, y, spotted = false) {
  for (const [dx, top, width] of [[-5, -19, 20], [10, -11, 12]]) {
    box(ctx, '#b1a58b', x + dx - 2, y + top + 5, 4, -top - 3);
    box(ctx, '#c7bea3', x + dx - 2, y + top + 5, 2, -top - 3);
    pixelOval(ctx, spotted ? '#a96f60' : '#a28a6d', x + dx - width / 2, y + top, width, 9, 2);
    box(ctx, spotted ? '#bd8770' : '#b69e7e', x + dx - width / 2 + 4, y + top, width - 8, 2);
    box(ctx, '#c9b99a', x + dx - width / 2 + 2, y + top + 7, width - 4, 2);
    if (spotted) {
      box(ctx, '#d8c7ad', x + dx - 5, y + top + 3, 3, 2);
      box(ctx, '#d8c7ad', x + dx + 2, y + top + 2, 2, 2);
    }
  }
}

function drawRock(ctx, x, y, snowy = false) {
  const shade = snowy ? '#607e92' : '#828977';
  const stone = snowy ? '#7f98a8' : '#a1a18a';
  shape(ctx, shade, [[x - 16, y + 2], [x - 16, y - 6], [x - 11, y - 6], [x - 11, y - 14], [x - 1, y - 18], [x + 9, y - 15], [x + 13, y - 7], [x + 15, y + 2]]);
  shape(ctx, stone, [[x - 12, y - 5], [x - 9, y - 13], [x - 1, y - 16], [x + 6, y - 13], [x + 9, y - 3], [x - 2, y - 1]]);
  box(ctx, snowy ? '#90aab8' : '#b2b29b', x - 6, y - 13, 7, 3);
  pixelOval(ctx, shade, x + 10, y - 4, 9, 7, 1);
  if (snowy) {
    box(ctx, '#c7d9df', x - 10, y - 16, 17, 5);
    box(ctx, '#d7e4e7', x - 6, y - 19, 9, 4);
    box(ctx, '#b8ced8', x + 5, y - 13, 5, 5);
    box(ctx, '#c7d9df', x + 12, y - 5, 5, 2);
  }
}

function drawStump(ctx, x, y, mossy = false) {
  shape(ctx, '#8c7861', [[x - 13, y + 2], [x - 11, y - 4], [x - 9, y - 19], [x + 8, y - 19], [x + 10, y - 4], [x + 15, y + 2]]);
  box(ctx, '#a18b6c', x - 7, y - 17, 6, 18);
  box(ctx, '#a99471', x + 4, y - 16, 3, 16);
  box(ctx, '#756b58', x - 3, y - 13, 2, 10);
  box(ctx, '#756b58', x + 8, y - 9, 2, 8);
  pixelOval(ctx, '#b5a181', x - 9, y - 22, 18, 7, 2);
  box(ctx, '#8f8168', x - 4, y - 20, 8, 3);
  box(ctx, '#c3af8c', x - 2, y - 20, 4, 2);
  if (mossy) {
    box(ctx, '#8b9667', x - 11, y - 5, 8, 7);
    box(ctx, '#a0a777', x - 10, y - 5, 5, 2);
    box(ctx, '#8b9667', x + 4, y - 18, 7, 4);
  }
}

function drawLeafPile(ctx, x, y) {
  pixelOval(ctx, '#a68b61', x - 18, y - 7, 36, 10, 3);
  pixelOval(ctx, '#bb9765', x - 12, y - 12, 24, 11, 2);
  for (const [dx, dy, color] of [[-13, -6, '#c3a676'], [-7, -10, '#c4a064'], [1, -8, '#ad7c58'], [8, -6, '#c7a977'], [-5, -3, '#a87957'], [3, -3, '#c8aa77']]) {
    box(ctx, color, x + dx, y + dy, 7, 3);
    box(ctx, '#927b59', x + dx + 4, y + dy + 2, 2, 1);
  }
}

function drawRowanBush(ctx, x, y) {
  // Fine stems and paired leaflets keep the silhouette soft and woodland-like.
  shape(ctx, '#887352', [[x - 2, y + 2], [x - 1, y - 20],
    [x - 5, y - 30], [x - 3, y - 30], [x + 2, y - 20], [x + 2, y + 2]]);
  for (const [dx, top, direction] of [[-3, -25, -1], [1, -20, 1], [-1, -13, -1]]) {
    for (let step = 0; step < 3; step += 1) {
      const leafX = x + dx + direction * step * 5;
      const leafY = y + top - step * 3;
      box(ctx, '#998055', leafX, leafY, direction * 5, 2);
      box(ctx, step === 1 ? '#c28a48' : '#be7845', leafX - 2, leafY - 4, 5, 3);
      box(ctx, '#d29a53', leafX - 2, leafY + 2, 5, 3);
    }
    box(ctx, '#d5a55e', x + dx + direction * 15 - 2, y + top - 10, 5, 3);
  }
  // Small attached berry bunches read as scenery rather than loose fruit.
  for (const [dx, dy] of [[-10, -23], [12, -17], [-6, -10]]) {
    box(ctx, '#87734e', x + dx, y + dy - 3, 1, 4);
    box(ctx, '#a94d3d', x + dx - 3, y + dy, 3, 3);
    box(ctx, '#bd5c40', x + dx + 1, y + dy, 3, 3);
    box(ctx, '#a44838', x + dx - 1, y + dy + 3, 3, 3);
    box(ctx, '#dc8a57', x + dx - 3, y + dy, 1, 1);
    box(ctx, '#d37b4c', x + dx + 1, y + dy, 1, 1);
  }
}

function drawSnowyFir(ctx, x, y) {
  box(ctx, '#728695', x - 2, y - 7, 4, 10);
  for (const [top, width, height] of [[-30, 10, 10], [-23, 20, 11], [-15, 30, 12]]) {
    box(ctx, '#64818a', x - width / 2 + 3, y + top, width - 6, height);
    box(ctx, '#64818a', x - width / 2, y + top + 5, width, height - 5);
    box(ctx, '#a8bdc5', x - width / 2 + 3, y + top + 1, width - 6, 3);
    box(ctx, '#c2d4d9', x - width / 2 + 5, y + top, width - 10, 2);
    box(ctx, '#93acb8', x - width / 2, y + top + 5, 6, 3);
  }
}

function drawIceCrystals(ctx, x, y) {
  for (const [dx, height, width] of [[-12, 13, 7], [-3, 23, 9], [7, 16, 8]]) {
    shape(ctx, '#7d9eae', [[x + dx, y + 2], [x + dx, y - height + 4], [x + dx + width / 2, y - height], [x + dx + width, y - height + 4], [x + dx + width, y + 2]]);
    box(ctx, '#a6bec9', x + dx + 2, y - height + 5, 2, height - 4);
    box(ctx, '#8daebb', x + dx + width - 2, y - height + 6, 2, height - 5);
  }
  box(ctx, '#b6cbd4', x - 15, y, 33, 3);
}

function drawLampPost(ctx, x, y) {
  box(ctx, '#637c8e', x - 2, y - 23, 4, 24);
  box(ctx, '#8197a3', x - 1, y - 21, 1, 22);
  box(ctx, '#637c8e', x - 6, y, 12, 3);
  box(ctx, '#6d8391', x - 7, y - 29, 14, 10);
  box(ctx, '#b4ae92', x - 5, y - 28, 10, 7);
  box(ctx, '#d4c59c', x - 3, y - 27, 6, 5);
  box(ctx, '#748893', x - 1, y - 28, 2, 8);
  box(ctx, '#728a9a', x - 8, y - 31, 16, 3);
  box(ctx, '#aec2cb', x - 6, y - 33, 12, 2);
  box(ctx, '#bdcfd5', x - 3, y - 34, 6, 2);
}

const platformScenery = {
  meadow: [drawFern, drawDaisies, drawMushrooms, drawRock, drawStump],
  autumn: [drawAutumnBush, drawPumpkin, drawLeafPile,
    (ctx, x, y) => drawMushrooms(ctx, x, y, true), drawRowanBush,
    (ctx, x, y) => drawStump(ctx, x, y, true)],
  winter: [drawSnowman, drawSnowLantern, drawSnowyFir,
    (ctx, x, y) => drawRock(ctx, x, y, true), drawIceCrystals, drawLampPost],
};
function drawPlatformScenery(ctx, platform, y, theme, seed) {
  if (theme === 'kvlt') return;
  const spacing = platformHash(seed, platform.id, 1);
  // Local minima give roughly one decorated platform in three, never adjacent ids.
  if (spacing >= platformHash(seed, platform.id - 1, 1)
    || spacing >= platformHash(seed, platform.id + 1, 1)) return;
  const detail = platformHash(seed, platform.id, 2);
  const scale = .8 + (detail % 4) * .1;
  const fraction = .16 + ((detail >>> 8) % 69) / 100;
  const x = platform.x + 22 + (platform.width - 44) * fraction;
  // Keep the silhouette clear of both original items and later chain fruit.
  if ([platform.item, platform.chainSatsuma].some((item) => item && Math.abs(item.x - x) < 40)) return;
  ctx.save();
  ctx.globalAlpha = theme === 'winter' ? .75 : .68;
  ctx.translate(Math.round(x), Math.round(y));
  ctx.scale(detail & 16 ? scale : -scale, scale);
  const choices = platformScenery[theme];
  choices[platformHash(seed, platform.id, 3) % choices.length](ctx, 0, 0);
  ctx.restore();
}

function drawPlatform(ctx, platform, screenY, palette, theme, gameSeed) {
  const x = Math.round(platform.x);
  const y = Math.round(screenY);
  const width = Math.round(platform.width);
  const seed = platformHash(gameSeed, platform.id);
  const variant = seed % 4;
  const detail = platformHash(gameSeed, platform.id, 4);
  const stone = variant === 1 || variant === 2;
  const fill = stone ? palette.rock : palette.dirt;
  const shade = stone ? palette.rockDark : palette.dirtDark;
  const light = stone ? palette.rockLight : palette.dirtLight;

  ctx.save();
  ctx.translate(x, y);
  // All undersides fit within 27 px: fruit headroom relies on this bound.
  if (variant === 0) {
    // Soft earth with an uneven, stepped lower edge.
    const shoulder = 16 + detail % 16;
    shape(ctx, shade, [[3, 5], [width - 3, 5], [width - 3, 19], [width - 11, 19],
      [width - 11, 24], [shoulder + 8, 24], [shoulder + 8, 27], [shoulder, 27], [shoulder, 23], [8, 23], [8, 18], [3, 18]]);
    box(ctx, fill, 4, 7, width - 8, 11);
    box(ctx, fill, 10, 18, width - 23, 4);
  } else if (variant === 1) {
    // Broad rock cap narrowing into a faceted base.
    shape(ctx, shade, [[2, 6], [width - 2, 6], [width - 2, 13], [width - 9, 13],
      [width - 9, 20], [width - 24, 20], [width - 24, 26], [21, 26], [21, 22], [10, 22], [10, 16], [2, 16]]);
    shape(ctx, fill, [[4, 7], [width - 5, 7], [width - 5, 12], [width - 12, 12],
      [width - 12, 18], [width - 27, 18], [width - 27, 22], [22, 22], [22, 18], [12, 18], [12, 14], [4, 14]]);
    box(ctx, light, 13, 10, Math.round(width * .31), 3);
    box(ctx, shade, Math.round(width * .57), 9, 3, 9);
    box(ctx, shade, Math.round(width * .57) - 6, 17, 9, 2);
  } else if (variant === 2) {
    // Thin layered ledge, broken strata and short offset shelves.
    box(ctx, shade, 3, 6, width - 6, 13);
    box(ctx, fill, 3, 7, width - 6, 8);
    box(ctx, light, 7, 11, width - 17, 2);
    box(ctx, fill, 13, 18, Math.round(width * .48), 4);
    box(ctx, shade, 17, 22, Math.round(width * .4), 2);
    box(ctx, shade, width - 31, 17, 18, 4);
    box(ctx, shade, 18 + detail % 26, 11, 9, 2);
  } else {
    // A mossy clump with short roots tucked beneath the landing surface.
    box(ctx, shade, 3, 6, width - 6, 12);
    box(ctx, fill, 4, 7, width - 8, 8);
    for (let j = 8; j < width - 14; j += 18) {
      const depth = 5 + ((detail >>> (j % 16)) % 5);
      box(ctx, shade, j, 16, 13, depth);
      box(ctx, fill, j, 14, 11, depth);
    }
    for (let j = 17 + detail % 13; j < width - 16; j += 37) {
      box(ctx, shade, j, 19, 3, 8);
      box(ctx, shade, j + 2, 24, 5, 2);
    }
  }
  for (let j = 10 + detail % 9; j < width - 10; j += 23 + detail % 7) {
    box(ctx, light, j, 10 + ((detail + j) % 4), 4 + j % 3, 2);
  }
  ctx.restore();

  // Every style keeps the exact same continuous, full-width landing strip.
  box(ctx, palette.grass, x, y + 2, width, 7);
  box(ctx, palette.grassLight, x, y, width, 5);
  box(ctx, palette.grassTop, x + 3, y, width - 6, 2);
  if (isDarkTheme(theme)) {
    if (theme === 'winter') {
      const snowX = x + 5 + detail % Math.max(1, width - 34);
      box(ctx, '#eef7fa', snowX, y - 2, 19 + detail % 9, 2);
      if (variant !== 2) box(ctx, '#eef7fa', x + width - 25, y - 3, 14, 3);
      for (let j = 9 + detail % 16; j < width - 8; j += 33 + detail % 17) {
        const length = 5 + (j + detail) % 9;
        box(ctx, '#bad5e1', x + j, y + 6, 3, length);
        box(ctx, '#e1f1f6', x + j, y + 6, 1, length - 2);
        box(ctx, '#c5dfe9', x + j + 1, y + 6 + length, 1, 2);
      }
    } else {
      box(ctx, '#777487', x + 6, y - 2, 8, 2);
      box(ctx, '#777487', x + width - 17, y - 3, 9, 3);
    }
  } else if (theme === 'autumn') {
    const leaves = ['#efc56a', '#b9653d', '#d68b42', '#dcac54'];
    for (let j = 5 + detail % 9; j < width - 9; j += 17 + detail % 11) {
      const leafY = y - 1 - ((j + seed) % 3);
      box(ctx, leaves[(Math.floor(j / 11) + seed) % leaves.length], x + j, leafY, 7, 3);
      box(ctx, palette.dirtDark, x + j + 4, leafY + 2, 2, 1);
      if (j % 3 === 0) box(ctx, '#bf7c3e', x + j + 2, y + 6, 4, 4);
    }
  } else {
    for (let j = 7 + detail % 7; j < width - 5; j += 17 + detail % 9) {
      box(ctx, palette.grass, x + j, y + 7, 4, 4 + ((j + seed) % 4));
      if (j < 24 || j > width - 23) {
        box(ctx, palette.grassLight, x + j, y - 3, 2, 3);
        box(ctx, palette.grassLight, x + j + 2, y - 5, 2, 3);
      }
    }
    if (width > 70 && detail % 7 === 0) {
      const flowerX = x + (seed % 2 ? width - 15 : 15);
      box(ctx, palette.grass, flowerX, y - 8, 2, 8);
      star(ctx, flowerX, y - 9, palette.flower, 2);
      box(ctx, '#fff4c0', flowerX, y - 9, 2, 2);
    }
  }
}

function drawStrawberry(ctx, x, y) {
  // Rounded shoulders, a tapered berry and a compact five-leaf calyx.
  ctx.save();
  ctx.translate(x, y);
  shape(ctx, '#793743', [[-15,-24],[-12,-28],[-7,-30],[-2,-29],[2,-29],[7,-30],
    [12,-28],[15,-24],[16,-18],[14,-12],[10,-7],[5,-2],[1,1],[-2,0],[-7,-4],[-12,-10],[-15,-16]]);
  shape(ctx, '#d84452', [[-13,-23],[-10,-26],[-6,-28],[-1,-27],[3,-27],[7,-28],
    [11,-26],[13,-23],[14,-18],[12,-12],[8,-7],[3,-2],[0,-1],[-6,-6],[-11,-12],[-13,-17]]);
  shape(ctx, '#ed6870', [[-11,-23],[-8,-26],[-4,-26],[-1,-24],[0,-19],[-3,-13],
    [-7,-12],[-10,-16],[-12,-19]]);
  shape(ctx, '#b83048', [[11,-22],[13,-19],[11,-12],[7,-7],[2,-3],[0,-3],
    [5,-9],[8,-15]]);
  box(ctx, '#ffaaa0', -8, -24, 4, 2);
  box(ctx, '#f68b88', -10, -22, 2, 3);
  for (const [sx,sy] of [[-8,-21],[0,-22],[8,-21],[-10,-16],[-3,-16],[5,-16],
    [-6,-10],[2,-10],[0,-5]]) {
    box(ctx, '#b53b48', sx + 1, sy, 1, 3);
    box(ctx, '#ffe1a0', sx, sy, 1, 2);
  }
  box(ctx, '#355e3e', 0, -36, 2, 7);
  box(ctx, '#658944', 1, -35, 2, 3);
  shape(ctx, '#355e3e', [[0,-31],[-7,-33],[-5,-29],[-13,-29],[-8,-25],[-3,-26],
    [0,-22],[3,-27],[10,-25],[8,-29],[13,-31],[5,-32],[3,-34]]);
  shape(ctx, '#5b8b4d', [[0,-30],[-6,-31],[-3,-28],[-9,-28],[-6,-26],[-1,-28],
    [0,-25],[2,-29],[7,-27],[5,-30],[9,-30],[3,-31]]);
  box(ctx, '#88ad63', -3, -30, 5, 1);
  ctx.restore();
}

function drawLingonberries(ctx, x, y) {
  box(ctx, '#566f41', x - 1, y - 33, 2, 17);
  pixelOval(ctx, '#3e6949', x - 14, y - 34, 13, 7, 2);
  box(ctx, '#7c9b5b', x - 11, y - 33, 7, 2);
  pixelOval(ctx, '#3e6949', x + 1, y - 36, 13, 8, 2);
  box(ctx, '#7c9b5b', x + 4, y - 35, 7, 2);
  for (const [dx,dy] of [[-7,-22],[6,-22],[-1,-10]]) {
    pixelOval(ctx, '#70333e', x + dx - 8, y + dy - 8, 16, 16, 3);
    pixelOval(ctx, '#b9374c', x + dx - 6, y + dy - 6, 12, 12, 2);
    pixelOval(ctx, '#df6372', x + dx - 5, y + dy - 5, 7, 6, 1);
    box(ctx, '#ffd3bc', x + dx - 4, y + dy - 4, 3, 2);
    box(ctx, '#722a3d', x + dx + 1, y + dy + 3, 3, 2);
  }
}

export function drawSeasonFruit(ctx, x, y, time, theme, reducedMotion) {
  const strawberry = theme === 'meadow';
  const lingonberry = theme === 'autumn';
  const outerGlow = strawberry ? '#ff8f91' : lingonberry ? '#d34c73' : '#ffc873';
  const innerGlow = strawberry ? '#ff797c' : lingonberry ? '#c94465'
    : isDarkTheme(theme) ? '#ffb45e' : '#ffed9a';
  const sparkle = strawberry ? '#ffd0c0' : lingonberry ? '#f8bdd7' : '#fff4bc';
  const pulse = reducedMotion ? 0.5 : (1 + Math.sin(time * Math.PI / 2.6 + x * 0.07)) / 2;
  const float = reducedMotion ? 0 : Math.sin(time * Math.PI / 2.6 + x * 0.07) * 0.8;
  y += float;
  ctx.save();
  ctx.globalAlpha = pulse * 0.036;
  pixelOval(ctx, outerGlow, x - 27, y - 41, 54, 51, 8);
  ctx.globalAlpha = pulse * 0.072;
  pixelOval(ctx, innerGlow, x - 23, y - 37, 46, 43, 6);
  ctx.restore();
  if (strawberry) drawStrawberry(ctx, x, y);
  else if (lingonberry) drawLingonberries(ctx, x, y);
  else {
    pixelOval(ctx, '#9b6243', x - 15, y - 27, 30, 27, 3);
    pixelOval(ctx, '#ee8b42', x - 15, y - 29, 30, 25, 3);
    pixelOval(ctx, '#ffb44e', x - 12, y - 29, 23, 20, 3);
    box(ctx, '#ffdc83', x - 7, y - 25, 7, 3);
    box(ctx, '#ffcb6d', x - 10, y - 22, 3, 5);
    box(ctx, '#d77539', x + 8, y - 16, 3, 6);
    box(ctx, '#87624a', x - 1, y - 34, 3, 7);
    box(ctx, '#4b8051', x + 2, y - 35, 9, 5);
    box(ctx, '#73a866', x + 3, y - 35, 8, 2);
  }
  if (!reducedMotion) {
    ctx.save();
    for (const [offset, dx, dy, size] of [[0, 23, -24, 2], [2.4, -21, -38, 1]]) {
      const phase = (time + x * 0.017 + offset) % 5.8;
      if (phase >= 1.3) continue;
      ctx.globalAlpha = Math.sin(phase / 1.3 * Math.PI) ** 2 * 0.85;
      star(ctx, x + dx, y + dy, sparkle, size);
    }
    ctx.restore();
  }
}

function drawTrap(ctx, x, y, theme, used, time, reducedMotion) {
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
  // A brief sword-tip glint anchored to the upper-right corner of the right tooth.
  const phase = (time + x * 0.017) % 6;
  if (!reducedMotion && phase < 0.8) {
    const strength = Math.sin(phase / 0.8 * Math.PI) ** 3;
    const tipX = x + 14;
    const tipY = y - 17;
    const reach = 2 + strength * 7;
    ctx.save();
    ctx.globalAlpha = strength * 0.92;
    shape(ctx, '#ecfaff', [[tipX, tipY - reach], [tipX + 1, tipY - 1],
      [tipX + reach * 0.7, tipY], [tipX + 1, tipY + 1],
      [tipX, tipY + reach], [tipX - 1, tipY + 1],
      [tipX - reach * 0.7, tipY], [tipX - 1, tipY - 1]]);
    box(ctx, '#ffffff', tipX - 1, tipY - 1, 2, 2);
    ctx.restore();
  }
}

function drawPoop(ctx, x, y, theme, used, time, reducedMotion) {
  const outline = theme === 'kvlt' ? '#5a4264' : '#73574e';
  const fill = theme === 'kvlt' ? '#aa799c' : '#ae8060';
  if (used) {
    pixelOval(ctx, outline, x - 15, y - 3, 30, 4, 1);
    return;
  }
  ctx.save();
  for (let strand = 0; strand < 2; strand++) {
    const phase = reducedMotion ? 0.45 : ((time / 5.5 + strand / 2 + x * 0.003) % 1);
    const rise = phase * 7;
    ctx.globalAlpha = (reducedMotion ? 0.3 : Math.sin(phase * Math.PI) * 0.38);
    const color = isDarkTheme(theme) ? '#bec496' : '#73865d';
    for (let segment = 0; segment < 2; segment++) {
      const sway = Math.sin(segment * 1.4 + (reducedMotion ? 0 : time * 0.8) + strand) * 2;
      box(ctx, color, x - 4 + strand * 8 + sway, y - 30 - rise - segment * 3, 1, 3);
    }
  }
  ctx.restore();
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
    pixelOval(ctx, black, x - 7, y - 11, 5, 5, 1);
    pixelOval(ctx, black, x + 3, y - 11, 5, 5, 1);
    box(ctx, black, x - 5, y - 6, 1, 2);
    box(ctx, black, x + 5, y - 6, 1, 2);
    box(ctx, paint, x - 6, y - 10, 2, 2);
    box(ctx, paint, x + 4, y - 10, 2, 2);
    box(ctx, paint, x - 3, y - 7, 1, 1);
    box(ctx, paint, x + 7, y - 7, 1, 1);
    box(ctx, black, x - 2, y - 4, 1, 1);
    box(ctx, black, x + 2, y - 4, 1, 1);
    box(ctx, black, x - 1, y - 3, 3, 1);
  } else {
    box(ctx, '#fff6e7', x - 6, y - 9, 4, 4);
    box(ctx, '#fff6e7', x + 3, y - 9, 4, 4);
    box(ctx, '#493e4c', x - 4, y - 8, 2, 3);
    box(ctx, '#493e4c', x + 3, y - 8, 2, 3);
    box(ctx, '#73574e', x, y - 3, 2, 1);
  }
}

function drawGull(ctx, gull, y, time, theme, reducedMotion) {
  const outline = theme === 'winter' ? '#25374a' : theme === 'kvlt' ? '#393340' : '#535d63';
  const white = '#fffdf0';
  const gray = '#b5bfc4';
  const flap = reducedMotion ? 0 : Math.sin(time * 9 + gull.id * 1.7);
  ctx.save();
  ctx.translate(Math.round(gull.x), Math.round(y));
  ctx.scale(gull.direction < 0 ? -1 : 1, 1);

  // The wings flap around the fixed 30 × 14 body; the model owns its flight path.
  box(ctx, '#819098', -17, -9, 12, 3);
  box(ctx, gray, -12, -6, 11, 4);
  if (flap > 0.25) {
    shape(ctx, outline, [[-9, 0], [-13, -5], [-13, -10], [-17, -10], [-17, -17], [-20, -17], [-20, -21], [-14, -21], [-14, -17], [-10, -17], [-10, -11], [-6, -11], [-6, -6], [-2, -2]]);
    shape(ctx, gray, [[-8, -2], [-11, -5], [-11, -11], [-15, -11], [-15, -17], [-13, -17], [-13, -14], [-9, -14], [-9, -9], [-5, -9], [-5, -4]]);
    box(ctx, '#e5ecee', -10, -9, 3, 5);
  } else if (flap < -0.25) {
    shape(ctx, outline, [[-8, -3], [-2, 0], [-2, 8], [-6, 8], [-6, 13], [-10, 13], [-10, 17], [-17, 17], [-17, 13], [-13, 13], [-13, 7], [-10, 7]]);
    shape(ctx, gray, [[-8, 0], [-4, 1], [-4, 6], [-8, 6], [-8, 11], [-12, 11], [-12, 14], [-14, 14], [-11, 9], [-8, 9]]);
    box(ctx, '#e5ecee', -7, 2, 3, 4);
  } else {
    shape(ctx, outline, [[-7, 0], [-13, -3], [-19, -3], [-19, -5], [-26, -5], [-26, -9], [-19, -9], [-19, -7], [-12, -7], [-12, -5], [-6, -5], [-1, -1]]);
    box(ctx, gray, -18, -5, 11, 3);
    box(ctx, '#e5ecee', -11, -4, 7, 3);
  }
  shape(ctx, outline, [[-11, -2], [-20, -1], [-17, 3], [-21, 5], [-10, 6]]);
  box(ctx, '#e5ecee', -16, 1, 7, 3);
  pixelOval(ctx, outline, -15, -6, 30, 13, 3);
  pixelOval(ctx, gray, -13, -4, 27, 10, 2);
  pixelOval(ctx, white, -12, -4, 26, 8, 2);
  box(ctx, '#e0e7e7', -9, 3, 17, 2);
  pixelOval(ctx, outline, 5, -8, 12, 12, 2);
  pixelOval(ctx, white, 7, -6, 8, 9, 1);
  box(ctx, '#303a42', 11, -4, 2, 2);
  box(ctx, white, 11, -4, 1, 1);
  box(ctx, '#94713b', 15, -3, 9, 4);
  box(ctx, '#f2bf50', 16, -3, 7, 2);
  box(ctx, '#ffd779', 16, -3, 4, 1);
  box(ctx, '#d8a044', 0, 6, 3, 2);
  box(ctx, '#d8a044', 6, 6, 3, 2);
  ctx.restore();
}

export function drawBird(ctx, bird, y, time, theme, reducedMotion = false) {
  if (theme !== 'autumn' && theme !== 'winter') {
    drawGull(ctx, bird, y, time, theme, reducedMotion);
    return;
  }
  const duck = theme === 'autumn';
  const ink = duck ? '#44372d' : '#15202b';
  const wing = duck ? '#8b7960' : '#264457';
  const pale = duck ? '#d5ccaf' : '#fff9ee';
  const flap = reducedMotion ? 0 : Math.sin(time * 9 + bird.id * 1.7);
  ctx.save();
  ctx.translate(Math.round(bird.x), Math.round(y));
  ctx.scale(bird.direction < 0 ? -1 : 1, 1);
  // Seasonal silhouettes are visual only: every bird keeps the same collision body.
  if (duck) {
    shape(ctx, ink, [[-10, -3], [-23, -5], [-19, 2], [-12, 5]]);
    box(ctx, '#bdab88', -20, -3, 9, 3);
  } else {
    shape(ctx, ink, [[-9, -4], [-36, 1], [-39, 5], [-32, 7], [-9, 3]]);
    shape(ctx, '#31566b', [[-15, -1], [-33, 2], [-35, 4], [-27, 3], [-12, 1]]);
  }
  pixelOval(ctx, ink, -16, -7, 31, 15, 3);
  pixelOval(ctx, pale, -13, -4, 25, 10, 2);
  pixelOval(ctx, duck ? '#765043' : ink, 0, -5, 13, 11, 2);
  if (flap > 0.25) {
    shape(ctx, ink, [[-10, 0], [-17, -11], [-20, -22], [-14, -20], [-7, -12], [0, -1]]);
    shape(ctx, wing, [[-11, -3], [-15, -12], [-16, -17], [-10, -11], [-4, -2]]);
    box(ctx, duck ? '#47658b' : pale, -14, -12, 5, 5);
  } else if (flap < -0.25) {
    shape(ctx, ink, [[-10, -3], [0, 0], [-5, 12], [-13, 20], [-19, 19], [-14, 10]]);
    shape(ctx, wing, [[-10, 0], [-4, 1], [-8, 12], [-14, 16], [-12, 9]]);
    box(ctx, duck ? '#47658b' : pale, -13, 8, 5, 5);
  } else {
    shape(ctx, ink, [[-12, -4], [-24, -10], [-29, -9], [-21, -3], [-6, 3], [0, -1]]);
    box(ctx, wing, -19, -5, 15, 4);
    box(ctx, duck ? '#47658b' : pale, -14, -4, 8, 3);
  }
  pixelOval(ctx, ink, 5, -11, 13, 14, 2);
  pixelOval(ctx, duck ? '#38745a' : '#172530', 7, -9, 9, 10, 2);
  if (duck) {
    box(ctx, '#6e9b68', 8, -9, 5, 2);
    box(ctx, '#fff7de', 6, 0, 8, 2);
    pixelOval(ctx, '#8b652c', 15, -5, 12, 5, 1);
    box(ctx, '#e6b347', 16, -5, 10, 3);
  } else {
    shape(ctx, ink, [[15, -6], [24, -3], [16, -1]]);
    box(ctx, '#52636c', 16, -5, 4, 1);
    box(ctx, pale, -9, 3, 8, 3);
  }
  box(ctx, '#100f15', 12, -7, 2, 2);
  box(ctx, '#fffdf5', 12, -7, 1, 1);
  box(ctx, duck ? '#d9913e' : ink, -2, 7, 5, 2);
  box(ctx, duck ? '#d9913e' : ink, 5, 6, 4, 2);
  ctx.restore();
}

function drawGullHit(ctx, hit, time, screenY, theme, reducedMotion) {
  if (!hit) return;
  const age = time - hit.time;
  if (age < 0 || age >= 0.2) return;
  const progress = age / 0.2;
  const spread = reducedMotion ? 0 : progress * 7;
  const y = screenY(hit.y);
  ctx.save();
  ctx.globalAlpha = reducedMotion ? 0.85 : 1 - progress;
  for (const [dx, dy, size] of [[-18, -12, 2], [18, -9, 2], [-14, 10, 1], [16, 13, 1]]) {
    star(ctx, hit.x + dx + Math.sign(dx) * spread, y + dy + Math.sign(dy) * spread,
      isDarkTheme(theme) ? '#ffe5a4' : '#e8b654', size);
  }
  box(ctx, isDarkTheme(theme) ? '#fff3d0' : '#fff7d8', hit.x - 25 - spread, y - 2, 5, 2);
  box(ctx, isDarkTheme(theme) ? '#fff3d0' : '#fff7d8', hit.x + 21 + spread, y + 2, 5, 2);
  ctx.restore();
}

export function getEatingExpression(game, theme) {
  let nearest = Infinity;
  if (game.phase === 'playing' && game.player.state === 'air') {
    for (const platform of game.platforms) {
      for (const item of [platform.item, platform.chainSatsuma]) {
        if (!item || item.used || item.type !== 'satsuma') continue;
        nearest = Math.min(nearest, Math.hypot(item.x - game.player.x, platform.y - game.player.y));
      }
    }
  }
  const proximity = Math.max(0, Math.min(1, (68 - nearest) / 44));
  const age = game.lastMealAt == null ? Infinity : game.time - game.lastMealAt;
  const stainAlpha = age >= 0 && age < 1 ? Math.min(1, (1 - age) / 0.25) : 0;
  return {
    mouthOpen: proximity * proximity * (3 - 2 * proximity),
    stainAlpha,
    stainColor: theme === 'meadow' ? '#df4b5b' : theme === 'autumn' ? '#9e294a' : '#ed963b',
  };
}

/** Draw the round Ponppu character, anchored at the unchanged physics feet. */
export function drawBunny(ctx, x, feetY, {
  theme = 'meadow', pose = 'idle', scale = 1, facing = 1, time = 0,
  mouthOpen = 0, stainAlpha = 0, stainColor = '#ed963b',
  impact = 0, vx = 0, vy = 0, reducedMotion = false, skin = theme === 'winter' ? 'winter' : theme === 'kvlt' ? 'corpse-paint' : 'classic',
} = {}) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(feetY));
  ctx.scale(scale, scale);
  const outline = theme === 'winter' ? '#142638' : theme === 'kvlt' ? '#373549' : '#62505a';
  const white = '#fffbee';
  const shade = '#dcd6d8';
  const pink = theme === 'kvlt' ? '#c6a2b4' : '#eea9b2';
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
  const earFlutter = Math.round(flutter * (rising || falling || trapped ? 2 : 1));
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

  if (theme === 'autumn') {
    // A short knitted beanie covers the ear bases, leaving the ears and lashes clear.
    pixelOval(ctx, '#6e3927', -17, -38, 34, 10, 2);
    pixelOval(ctx, '#b95720', -15, -36, 30, 7, 2);
    box(ctx, '#cc6d2e', -10, -36, 16, 2);
    box(ctx, '#a94c1d', 10, -33, 3, 3);
    pixelOval(ctx, '#6e3927', -20, -32, 40, 5, 1);
    box(ctx, '#9e481c', -18, -31, 36, 3);
    box(ctx, '#d17a39', -16, -31, 30, 1);
    for (let rib = -15; rib <= 15; rib += 5) box(ctx, '#bb6229', rib, -30, 1, 2);
    pixelOval(ctx, '#6e3927', -4, -46, 9, 9, 2);
    pixelOval(ctx, '#b95720', -3, -45, 7, 7, 2);
    box(ctx, '#dc8a48', -1, -44, 3, 2);
    box(ctx, '#cc6d2e', -2, -42, 2, 2);
  }

  if (skin === 'winter') {
    pixelOval(ctx, '#19191f', -18, -39, 36, 12, 3);
    pixelOval(ctx, '#303039', -15, -37, 30, 8, 2);
    box(ctx, '#41414b', -9, -37, 15, 2);
    pixelOval(ctx, '#17171d', -21, -33, 42, 7, 1);
    box(ctx, '#303039', -19, -32, 38, 4);
    for (let rib = -17; rib <= 17; rib += 4) box(ctx, '#494953', rib, -32, 1, 4);
  }

  const eyeX = facing < 0 ? -1 : 1;
  // Archived skin stays independently selectable in code for a future skin menu.
  if (skin === 'corpse-paint') {
    const paint = '#29252e';
    // Rounded eye paint and short cheek marks keep the little goth face gentle.
    pixelOval(ctx, paint, -12 + eyeX, -26, 10, 10, 2);
    pixelOval(ctx, paint, 3 + eyeX, -26, 10, 10, 2);
    box(ctx, paint, -9 + eyeX, -28, 2, 2);
    box(ctx, paint, 6 + eyeX, -28, 2, 2);
    box(ctx, paint, -9 + eyeX, -17, 2, 4);
    box(ctx, paint, 7 + eyeX, -17, 2, 4);
    pixelOval(ctx, white, -10 + eyeX, -25, 6, 7, 1);
    pixelOval(ctx, white, 5 + eyeX, -25, 6, 7, 1);
    box(ctx, paint, -8 + eyeX, -24, 2, 4);
    box(ctx, paint, 7 + eyeX, -24, 2, 4);
    box(ctx, white, -8 + eyeX, -24, 1, 1);
    box(ctx, white, 7 + eyeX, -24, 1, 1);
    box(ctx, '#d3ccd8', -6 + eyeX, -20, 1, 1);
    box(ctx, '#d3ccd8', 9 + eyeX, -20, 1, 1);
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
  // A worried open mouth replaces the gentle smile while the bunny struggles.
  const smileInk = '#59404a';
  if (trapped) {
    pixelOval(ctx, smileInk, eyeX - 3, -17, 7, 6, 1);
    box(ctx, '#ef9fa8', eyeX - 1, -13, 3, 1);
    box(ctx, white, eyeX - 1, -17, 2, 1);
  } else if (mouthOpen > 0.12) {
    const opening = Math.max(2, Math.round(4 * mouthOpen));
    pixelOval(ctx, smileInk, eyeX - 3, -17, 7, opening, 1);
    box(ctx, '#ef9fa8', eyeX - 1, -17 + opening - 1, 3, 1);
    box(ctx, white, eyeX - 1, -17, 2, 1);
  } else {
    box(ctx, smileInk, eyeX, -17, 1, 2);
    box(ctx, smileInk, -4 + eyeX, -16, 1, 2);
    box(ctx, smileInk, -3 + eyeX, -14, 3, 1);
    box(ctx, smileInk, eyeX, -15, 1, 1);
    box(ctx, smileInk, 1 + eyeX, -14, 3, 1);
    box(ctx, smileInk, 4 + eyeX, -16, 1, 2);
  }
  if (stainAlpha > 0) {
    ctx.save();
    ctx.globalAlpha = stainAlpha;
    const stainX = eyeX + (facing < 0 ? -8 : 5);
    pixelOval(ctx, stainColor, stainX, -16, 4, 3, 1);
    box(ctx, stainColor, stainX + (facing < 0 ? -1 : 4), -14, 1, 1);
    ctx.restore();
  }

  if (skin === 'winter') {
    pixelOval(ctx, '#17171d', -17, -13, 34, 7, 2);
    box(ctx, '#34343d', -14, -12, 28, 3);
    box(ctx, '#50505a', -12, -12, 22, 1);
    box(ctx, '#19191f', 8, -9, 8, 10);
    box(ctx, '#34343d', 9, -8, 5, 7);
    for (let fringe = 8; fringe < 16; fringe += 3) box(ctx, '#19191f', fringe, 0, 1, 3);
  }

  const pawY = trapped ? -16 : rising ? -11 : falling ? -13 : sliding ? -10 : -8;
  const pawSwing = Math.round(bounce * (trapped ? 3 : 1));
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
    const sweatDrop = animated ? Math.round((1 + flutter) * 2) : 0;
    for (const [dropX, dropY] of [[-27, -30], [25, -36]]) {
      box(ctx, '#d5f4ff', dropX + 1, dropY + sweatDrop, 1, 2);
      pixelOval(ctx, '#87cee9', dropX, dropY + sweatDrop + 2, 3, 4, 1);
    }
  }
  ctx.restore();
}

export function drawDog(ctx, dog, feetY, time, petting = false, showHeart = true) {
  ctx.save();
  ctx.translate(Math.round(dog.x), Math.round(feetY));
  ctx.scale(dog.direction, 1);
  const ink = '#24232a';
  const fur = '#fff2db';
  const shade = '#cabbab';
  const step = petting ? 0 : Math.round(Math.sin(time * 12) * 2);
  // White shaggy chest, black back and long floppy ears from the reference dog.
  pixelOval(ctx, ink, -14, -21, 27, 19, 3);
  pixelOval(ctx, fur, -11, -18, 22, 16, 3);
  pixelOval(ctx, ink, -12, -21, 14, 10, 2);
  for (const [x, offset] of [[-11, step], [5, -step]]) {
    pixelOval(ctx, ink, x - 1, -7 + offset, 9, 8 - offset, 1);
    box(ctx, fur, x, -6 + offset, 7, 6 - offset);
    box(ctx, shade, x + 1, -2, 5, 2);
  }
  pixelOval(ctx, ink, -11, -35, 27, 23, 3);
  pixelOval(ctx, '#3f3b40', -9, -34, 23, 18, 3);
  pixelOval(ctx, ink, -15, -31, 8, 21, 2);
  pixelOval(ctx, ink, 11, -31, 8, 21, 2);
  box(ctx, '#555058', -14, -29, 2, 13);
  box(ctx, '#555058', 15, -28, 2, 12);
  pixelOval(ctx, fur, -6, -24, 20, 13, 2);
  box(ctx, fur, 0, -32, 4, 11);
  box(ctx, shade, -5, -17, 4, 5);
  box(ctx, shade, 9, -17, 3, 5);
  for (const x of [-6, 8]) {
    pixelOval(ctx, '#100f14', x, -28, 5, 5, 1);
    box(ctx, '#ffffff', x + 1, -28, 2, 2);
  }
  pixelOval(ctx, '#131218', 0, -23, 8, 5, 1);
  box(ctx, '#72636a', 1, -23, 3, 1);
  box(ctx, ink, 3, -18, 2, 3);
  pixelOval(ctx, '#ed94ad', 2, -16, 6, 6, 1);
  box(ctx, '#f8bcc8', 3, -16, 2, 3);
  box(ctx, fur, -8, -13, 2, 4);
  box(ctx, fur, 11, -14, 2, 4);
  const wag = Math.round(Math.sin(time * (petting ? 18 : 15)) * 3);
  pixelOval(ctx, ink, -20, -17 + wag, 9, 6, 2);
  box(ctx, fur, -20, -17 + wag, 3, 3);
  if (petting && showHeart) {
    box(ctx, '#ed94ad', -3, -45, 4, 3);
    box(ctx, '#ed94ad', 3, -45, 4, 3);
    box(ctx, '#ed94ad', -2, -42, 8, 3);
    box(ctx, '#ed94ad', 0, -39, 4, 2);
  }
  ctx.restore();
}

function drawTrappedScene(ctx, game, theme, reducedMotion) {
  if (game.phase !== 'playing' || game.player.state !== 'trapped') return;
  ctx.save();
  box(ctx, 'rgba(10, 16, 27, 0.76)', 0, 0, WIDTH, HEIGHT);
  // Leave room for the ears below the HUD and the tap instructions at 60% height.
  drawBunny(ctx, WIDTH / 2, HEIGHT * 0.53, {
    theme,
    pose: 'trapped',
    scale: 4.5,
    time: game.time,
    reducedMotion,
  });
  ctx.restore();
}

export function drawPettingScene(ctx, game, effects, reducedMotion = false) {
  if (game.phase !== 'playing') return;
  const petting = game.player.state === 'petting';
  if (!petting && !effects?.hearts.length) return;
  const time = effects?.time ?? 0;
  ctx.save();
  if (petting) {
    box(ctx, 'rgba(10, 16, 27, 0.76)', 0, 0, WIDTH, HEIGHT);
    // The enlarged dog stays above the instruction panel at 60% of screen height.
    ctx.save();
    ctx.translate(WIDTH / 2, HEIGHT * 0.49);
    ctx.scale(4.5, 4.5);
    drawDog(ctx, { x: 0, direction: 1 }, 0, reducedMotion ? 0 : time, true, false);
    ctx.restore();
  }
  for (const heart of effects?.hearts ?? []) {
    const age = time - heart.born;
    if (age < 0 || age >= 1.4) continue;
    for (let index = 0; index < 3; index++) {
      const side = ((heart.stroke + index) % 2) ? -1 : 1;
      const drift = reducedMotion ? 0 : age * (60 + index * 14);
      const x = WIDTH / 2 + side * (45 + index * 19 + (reducedMotion ? 0 : age * 10));
      const y = HEIGHT * 0.35 - index * 15 - drift;
      const size = index === 1 ? 3 : 2;
      ctx.globalAlpha = Math.min(1, (1.4 - age) * 2.5);
      const color = index === 1 ? '#ffcadc' : '#f37ea6';
      box(ctx, color, x - 3 * size, y, 2 * size, size);
      box(ctx, color, x + size, y, 2 * size, size);
      box(ctx, color, x - 4 * size, y + size, 8 * size, 2 * size);
      box(ctx, color, x - 3 * size, y + 3 * size, 6 * size, size);
      box(ctx, color, x - 2 * size, y + 4 * size, 4 * size, size);
      box(ctx, color, x - size, y + 5 * size, 2 * size, size);
    }
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
  // Keep the whole celebration below the midpoint and clear of the bottom controls.
  const positions = [[180, 420], [132, 452], [228, 436], [150, 468], [222, 456]];
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
  ctx.fillStyle = isDarkTheme(theme) ? 'rgba(12,23,38,.3)' : theme === 'autumn' ? 'rgba(107,77,45,.16)' : 'rgba(62,95,72,.13)';
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
  const theme = options.theme === 'winter' || options.theme === 'kvlt' || options.theme === 'autumn' ? options.theme : 'meadow';
  const palette = palettes[theme];
  const time = game.phase === 'ready' ? options.time ?? game.time ?? 0 : game.time;
  const reducedMotion = Boolean(options.reducedMotion);
  const visualTime = reducedMotion ? 0 : time;
  const screenY = (worldY) => HEIGHT - (worldY - game.camera);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  drawBackground(ctx, game, { theme, time: visualTime, reducedMotion }, palette);

  // Scenery sits behind every landing surface and item and never changes the model.
  for (const platform of game.platforms) {
    const y = screenY(platform.y);
    if (y < -50 || y > HEIGHT + 70) continue;
    drawPlatformScenery(ctx, platform, y, theme, game.seed);
  }

  for (const platform of game.platforms) {
    const y = screenY(platform.y);
    if (y < -50 || y > HEIGHT + 30) continue;
    drawPlatform(ctx, platform, y, palette, theme, game.seed);
  }

  for (const gull of game.gulls ?? []) {
    const y = screenY(gull.y);
    if (y < -28 || y > HEIGHT + 28 || gull.x < -34 || gull.x > WIDTH + 34) continue;
    drawBird(ctx, gull, y, visualTime, theme, reducedMotion);
  }

  // Items sit in front of every platform, including nearby overlapping platforms.
  for (const platform of game.platforms) {
    if (!platform.item && !platform.chainSatsuma) continue;
    const y = screenY(platform.y);
    // A satsuma and its sparkle extend above a platform already below the screen.
    if (y < -10 || y > HEIGHT + 48) continue;
    const item = platform.item;
    if (item?.type === 'satsuma' && !item.used) drawSeasonFruit(ctx, item.x, y, visualTime, theme, reducedMotion);
    if (item?.type === 'trap') drawTrap(ctx, item.x, y, theme, item.used, visualTime, reducedMotion);
    if (item?.type === 'poop') drawPoop(ctx, item.x, y, theme, item.used, visualTime, reducedMotion);
    const chain = platform.chainSatsuma;
    if (chain && !chain.used) drawSeasonFruit(ctx, chain.x, y, visualTime, theme, reducedMotion);
  }

  for (const platform of game.platforms) {
    if (platform.dog && screenY(platform.y) >= -50 && screenY(platform.y) <= HEIGHT + 50) {
      drawDog(ctx, platform.dog, screenY(platform.y), visualTime,
        game.player.state === 'petting' && game.player.platformId === platform.id);
    }
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
    ...getEatingExpression(game, theme),
    theme,
    pose: game.phase === 'ready' || player.state === 'petting' ? 'idle' : player.state === 'trapped' || player.state === 'sliding' ? player.state : player.vy > 0 ? 'jump' : 'fall',
    facing: player.vx < -8 ? -1 : 1,
    time: visualTime,
    impact: landingAge >= 0 && landingAge < 0.18 ? (1 - landingAge / 0.18) ** 2 : 0,
    vx: player.vx,
    vy: player.vy,
    reducedMotion,
  });
  drawGullHit(ctx, game.lastGullHit, game.time, screenY, theme, reducedMotion);
  if (game.bubble && game.time < game.bubbleUntil) drawBubble(ctx, game.bubble, player.x, bunnyY, theme);
  drawComboBurst(ctx, game, theme, reducedMotion);

  // The lower edge is always lethal; a soft shaded lip makes it visible without clutter.
  const edge = ctx.createLinearGradient(0, HEIGHT - 48, 0, HEIGHT);
  edge.addColorStop(0, isDarkTheme(theme) ? 'rgba(7,15,28,0)' : theme === 'autumn' ? 'rgba(89,64,42,0)' : 'rgba(65,99,74,0)');
  edge.addColorStop(1, isDarkTheme(theme) ? 'rgba(7,15,28,.42)' : theme === 'autumn' ? 'rgba(89,64,42,.25)' : 'rgba(65,99,74,.22)');
  ctx.fillStyle = edge;
  ctx.fillRect(0, HEIGHT - 48, WIDTH, 48);
  drawJoystick(ctx, options.joystick, theme);
  drawPettingScene(ctx, game, options.petEffects, reducedMotion);
  drawTrappedScene(ctx, game, theme, reducedMotion);
  ctx.restore();
}
