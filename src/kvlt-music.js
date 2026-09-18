// Original eight-bar guitar composition, generated locally without samples.
// 48 BPM in 4/4: D minor, B-flat, G minor, then A resolving back to D.
const SAMPLE_RATE = 24000;
const BEAT = 60 / 48;
const LOOP_SECONDS = 32 * BEAT;
const FRAME_COUNT = Math.round(LOOP_SECONDS * SAMPLE_RATE);
const BATCH_SIZE = 16384;

function createRenderYield() {
  let batchStarted = performance.now();
  return async () => {
    // Bound each work slice without paying a timer delay for every short note.
    if (performance.now() - batchStarted >= 5) {
      await new Promise(resolve => setTimeout(resolve, 0));
      batchStarted = performance.now();
    }
  };
}
const frequency = midi => 440 * 2 ** ((midi - 69) / 12);

function randomGenerator(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2147483648 - 1;
  };
}

async function pluck(target, note, yieldControl) {
  const { midi, start, duration, level, detune = 0, seed, muted = false } = note;
  const hz = frequency(midi) * 2 ** (detune / 1200);
  // The averaging filter adds half a sample of delay; compensate for tuning.
  const delay = SAMPLE_RATE / hz - .5;
  const size = Math.ceil(delay) + 2;
  const string = new Float32Array(size);
  const random = randomGenerator(seed);
  let excitation = 0;
  for (let i = 0; i < size; i++) {
    excitation = excitation * .35 + random() * .65;
    string[i] = excitation;
  }
  let average = 0;
  for (const value of string) average += value / size;
  for (let i = 0; i < size; i++) string[i] -= average;

  const count = Math.round(duration * SAMPLE_RATE);
  const offset = Math.round(start * SAMPLE_RATE);
  const attack = SAMPLE_RATE * .003;
  const release = SAMPLE_RATE * Math.min(.22, duration * .2);
  const decay = Math.exp(-1 / (SAMPLE_RATE * (muted ? .30 : duration * .70)));
  const feedback = muted ? .975 : .9985;
  let position = 0;
  let previous = 0;
  let envelope = 1;
  for (let from = 0; from < count; from += BATCH_SIZE) {
    const to = Math.min(count, from + BATCH_SIZE);
    for (let i = from; i < to; i++) {
      let read = position - delay;
      if (read < 0) read += size;
      const index = Math.floor(read);
      const fraction = read - index;
      const next = index + 1 === size ? 0 : index + 1;
      const sample = string[index] * (1 - fraction) + string[next] * fraction;
      string[position] = (sample + previous) * .5 * feedback;
      previous = sample;
      position = position + 1 === size ? 0 : position + 1;
      const fade = Math.min(1, i / attack, (count - 1 - i) / release);
      target[(offset + i) % FRAME_COUNT] += sample * level * envelope * fade;
      envelope *= decay;
    }
    await yieldControl();
  }
}

async function cabinet(channel, drive, yieldControl) {
  // Warm the filters with the end of the loop, preserving the cyclic seam.
  let bass = 0;
  let treble = 0;
  let speaker = 0;
  const highPass = 1 - Math.exp(-2 * Math.PI * 65 / SAMPLE_RATE);
  const lowPass = 1 - Math.exp(-2 * Math.PI * 2800 / SAMPLE_RATE);
  const speakerPass = 1 - Math.exp(-2 * Math.PI * 3600 / SAMPLE_RATE);
  for (let from = -SAMPLE_RATE; from < FRAME_COUNT; from += BATCH_SIZE) {
    const to = Math.min(FRAME_COUNT, from + BATCH_SIZE);
    for (let i = from; i < to; i++) {
      const input = channel[i < 0 ? FRAME_COUNT + i : i];
      bass += highPass * (input - bass);
      const amplified = Math.tanh((input - bass) * drive);
      treble += lowPass * (amplified - treble);
      speaker += speakerPass * (treble - speaker);
      if (i >= 0) channel[i] = speaker;
    }
    await yieldControl();
  }
}

/** Render in small batches so starting the game remains responsive. */
export async function renderKvltMusic({ yieldControl = createRenderYield() } = {}) {
  const left = new Float32Array(FRAME_COUNT);
  const right = new Float32Array(FRAME_COUNT);
  const lead = new Float32Array(FRAME_COUNT);
  const roots = [38, 38, 34, 34, 31, 31, 33, 33];
  let seed = 7301;

  for (let bar = 0; bar < roots.length; bar++) {
    for (let side = 0; side < 2; side++) {
      const target = side === 0 ? left : right;
      for (let stroke = 0; stroke < 2; stroke++) {
        const muted = stroke === 1;
        for (const [stringIndex, interval] of [0, 7, 12].entries()) {
          await pluck(target, {
            midi: roots[bar] + interval,
            start: bar * 4 * BEAT + stroke * 2.5 * BEAT + side * .014 + stringIndex * .008,
            duration: muted ? 1.20 : 4.30,
            level: muted ? .58 : .75,
            detune: side === 0 ? -3 : 3,
            seed: seed++, muted,
          }, yieldControl);
        }
      }
    }
  }

  // A sparse original melody: long notes leave room for the game effects.
  const melody = [
    [0, 62, 2.8], [3, 69, 3.8], [7, 65, 1.8],
    [9, 65, 3.8], [13, 62, 2.8],
    [16, 67, 3.8], [20, 65, 1.8], [22, 62, 1.8],
    [24, 64, 3.8], [28, 61, 2.8], [31, 64, 1.8],
  ];
  for (const [beat, midi, beats] of melody) {
    await pluck(lead, {
      midi, start: beat * BEAT + .09,
      duration: beats * BEAT, level: .75, seed: seed++,
    }, yieldControl);
  }
  await cabinet(left, 8, yieldControl);
  await cabinet(right, 8, yieldControl);
  await cabinet(lead, 5, yieldControl);

  const result = [new Float32Array(FRAME_COUNT), new Float32Array(FRAME_COUNT)];
  const shortDelay = Math.round(.083 * SAMPLE_RATE);
  const echo = Math.round(BEAT * .75 * SAMPLE_RATE);
  const distantEcho = Math.round(BEAT * 1.5 * SAMPLE_RATE);
  let peak = 0;
  for (let from = 0; from < FRAME_COUNT; from += BATCH_SIZE) {
    const to = Math.min(FRAME_COUNT, from + BATCH_SIZE);
    for (let i = from; i < to; i++) {
      const roomIndex = (i - shortDelay + FRAME_COUNT) % FRAME_COUNT;
      const echoIndex = (i - echo + FRAME_COUNT) % FRAME_COUNT;
      const distantIndex = (i - distantEcho + FRAME_COUNT) % FRAME_COUNT;
      const centeredLead = lead[i] * .60;
      const l = left[i] * .62 + right[i] * .13 + right[roomIndex] * .10
        + centeredLead + lead[echoIndex] * .17 + lead[distantIndex] * .08;
      const r = right[i] * .62 + left[i] * .13 + left[roomIndex] * .10
        + centeredLead + lead[echoIndex] * .08 + lead[distantIndex] * .17;
      result[0][i] = l;
      result[1][i] = r;
      peak = Math.max(peak, Math.abs(l), Math.abs(r));
    }
    await yieldControl();
  }
  const gain = peak > 0 ? .28 / peak : 0;
  for (let from = 0; from < FRAME_COUNT; from += BATCH_SIZE) {
    const to = Math.min(FRAME_COUNT, from + BATCH_SIZE);
    for (let i = from; i < to; i++) {
      result[0][i] *= gain;
      result[1][i] *= gain;
    }
    await yieldControl();
  }
  return { channels: result, sampleRate: SAMPLE_RATE };
}

export async function createKvltMusicBuffer(context) {
  const { channels, sampleRate } = await renderKvltMusic();
  const buffer = context.createBuffer(2, channels[0].length, sampleRate);
  channels.forEach((channel, index) => buffer.copyToChannel(channel, index));
  return buffer;
}
