import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/game.js';
import { getEatingExpression } from '../src/render.js';

function scene(distance, item = { type: 'satsuma', used: false }) {
  const game = createGame(42);
  game.phase = 'playing';
  game.player.x = 180;
  game.player.y = 300;
  game.platforms = [{ y: 300 + distance, item: { x: 180, ...item } }];
  return game;
}

test('mouth opens progressively near fresh food, including chain fruit, and ignores hazards', () => {
  assert.equal(getEatingExpression(scene(80), 'meadow').mouthOpen, 0);
  const middle = getEatingExpression(scene(46), 'meadow').mouthOpen;
  assert.ok(middle > 0 && middle < 1);
  assert.equal(getEatingExpression(scene(20), 'meadow').mouthOpen, 1);
  for (const item of [{ type: 'trap' }, { type: 'poop' }, { used: true }]) {
    assert.equal(getEatingExpression(scene(10, { type: 'satsuma', used: false, ...item }), 'meadow').mouthOpen, 0);
  }
  const game = scene(20);
  game.platforms[0].chainSatsuma = game.platforms[0].item;
  game.platforms[0].item = null;
  assert.equal(getEatingExpression(game, 'winter').mouthOpen, 1);
  game.player.state = 'trapped';
  assert.equal(getEatingExpression(game, 'winter').mouthOpen, 0);
});

test('fruit stain lasts one second independently of subsequent landings and matches the season', () => {
  const game = scene(100);
  game.lastMealAt = 4;
  game.time = 4.5;
  game.lastLanding = { type: 'normal', time: 4.4 };
  const colors = new Set();
  for (const theme of ['meadow', 'autumn', 'winter']) {
    const face = getEatingExpression(game, theme);
    assert.equal(face.stainAlpha, 1);
    colors.add(face.stainColor);
  }
  assert.equal(colors.size, 3);
  game.time = 4.9;
  assert.ok(getEatingExpression(game, 'winter').stainAlpha > 0);
  game.time = 5;
  assert.equal(getEatingExpression(game, 'winter').stainAlpha, 0);
});
