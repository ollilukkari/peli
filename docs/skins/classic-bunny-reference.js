// Archived classic bunny design for a future skin selector. Not loaded by the game.
// Reference only: requires the renderer helpers box, pixelOval and star.

/** Draw the original Ponppu character, anchored at the center of its feet. */
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

  // Tail, pear-shaped body, little shoulders and front paws.
  pixelOval(ctx, outline, -19 * facing - 3, -15, 10, 10, 2);
  pixelOval(ctx, white, -19 * facing - 1, -13, 6, 6, 1);
  pixelOval(ctx, outline, -13, -25, 27, 25, 3);
  pixelOval(ctx, shade, -11, -23, 23, 21, 3);
  pixelOval(ctx, white, -10, -23, 19, 19, 3);
  pixelOval(ctx, outline, -16, -36, 32, 24, 3);
  pixelOval(ctx, shade, -14, -34, 28, 20, 3);
  pixelOval(ctx, white, -14, -34, 27, 17, 3);
  box(ctx, white, -10, -18, 20, 3);

  const eyeX = facing < 0 ? -1 : 1;
  if (theme !== 'meadow') {
    box(ctx, '#48404e', -11 + eyeX, -32, 8, 10);
    box(ctx, '#48404e', 4 + eyeX, -32, 8, 10);
    box(ctx, '#48404e', -8 + eyeX, -23, 3, 4);
    box(ctx, '#48404e', 7 + eyeX, -23, 3, 4);
    box(ctx, white, -9 + eyeX, -30, 4, 5);
    box(ctx, white, 6 + eyeX, -30, 4, 5);
    box(ctx, '#48404e', -7 + eyeX, -28, 1, 2);
    box(ctx, '#48404e', 8 + eyeX, -28, 1, 2);
    box(ctx, '#48404e', -9, -15, 19, 4);
    for (let i = -6; i < 9; i += 5) box(ctx, '#bcb4c4', i, -15, 2, 2);
    box(ctx, '#c3a0b5', 0, -11, 3, 3);
  } else {
    if (trapped) {
      box(ctx, outline, -8, -28, 5, 2);
      box(ctx, outline, -6, -26, 3, 2);
      box(ctx, outline, 5, -28, 5, 2);
      box(ctx, outline, 5, -26, 3, 2);
    } else {
      pixelOval(ctx, '#493f4b', -9 + eyeX, -31, 5, 7, 1);
      pixelOval(ctx, '#493f4b', 4 + eyeX, -31, 5, 7, 1);
      box(ctx, white, -8 + eyeX, -30, 2, 2);
      box(ctx, white, 5 + eyeX, -30, 2, 2);
      box(ctx, '#cfb0a4', -6 + eyeX, -26, 1, 1);
      box(ctx, '#cfb0a4', 7 + eyeX, -26, 1, 1);
    }
    box(ctx, '#f4bac1', -12, -23, 5, 3);
    box(ctx, '#f4bac1', 8, -23, 5, 3);
  }
  box(ctx, pink, -1 + eyeX, -24, 3, 2);
  box(ctx, outline, eyeX, -21, 1, 2);
  box(ctx, outline, -2 + eyeX, -20, 2, 1);
  box(ctx, outline, 1 + eyeX, -20, 2, 1);

  const pawY = rising ? -11 : falling ? -13 : trapped || sliding ? -10 : -8;
  const pawSwing = Math.round(bounce * (trapped ? 2 : 1));
  const pawSpread = falling ? 2 : 0;
  box(ctx, shade, -11 - pawSpread, pawY + pawSwing, 5, 5);
  box(ctx, white, -11 - pawSpread, pawY + pawSwing, 4, 3);
  box(ctx, shade, 7 + pawSpread, pawY - pawSwing, 5, 5);
  box(ctx, white, 7 + pawSpread, pawY - pawSwing, 4, 3);
  const footKick = animated && (rising || falling) ? Math.round(bounce * 2) : 0;
  const leftFootY = -4 - Math.max(0, footKick);
  const rightFootY = -4 + (sliding ? -3 : 0) - Math.max(0, -footKick);
  pixelOval(ctx, outline, -13, leftFootY, 13, 6, 1);
  pixelOval(ctx, outline, 3, rightFootY, 13, 6, 1);
  box(ctx, pink, -11, leftFootY + 2, 9, 2);
  box(ctx, pink, 5, rightFootY + 2, 9, 2);
  box(ctx, white, -10, leftFootY, 8, 2);
  box(ctx, white, 5, rightFootY, 8, 2);
  if (trapped) {
    box(ctx, '#6e6472', -12, -2, 16, 4);
    box(ctx, '#c6b8c4', -10, -2, 12, 2);
    star(ctx, 24, -34, '#f5d49c', 2);
  }
  ctx.restore();
}
