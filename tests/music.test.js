import test from 'node:test';
import assert from 'node:assert/strict';
import { renderKvltMusic } from '../src/kvlt-music.js';

test('guitar loop renders finite, audible stereo with headroom and a smooth seam', async () => {
  const { channels, sampleRate } = await renderKvltMusic({ yieldControl: async () => {} });
  assert.equal(sampleRate, 24000);
  assert.equal(channels.length, 2);
  const frames = sampleRate * 40;
  let stereoEnergy = 0;

  for (const channel of channels) {
    assert.equal(channel.length, frames);
    let finite = true;
    let peak = 0;
    let energy = 0;
    for (const sample of channel) {
      finite &&= Number.isFinite(sample);
      peak = Math.max(peak, Math.abs(sample));
      energy += sample * sample;
    }
    assert.ok(finite, 'every sample must be finite');
    assert.ok(peak <= .30, 'leave headroom for game sound effects');
    assert.ok(Math.sqrt(energy / frames) > .01, 'the loop must be audible');
    assert.ok(Math.abs(channel[0] - channel[frames - 1]) < .005,
      'wrapping must not introduce a large sample discontinuity');
  }
  for (let i = 0; i < frames; i++) {
    stereoEnergy += (channels[0][i] - channels[1][i]) ** 2;
  }
  assert.ok(Math.sqrt(stereoEnergy / frames) > .002,
    'the two guitar channels must create an audible stereo difference');
});
