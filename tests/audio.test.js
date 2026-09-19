import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Exercise the production controller with controllable browser media promises.
const audioSource = readFileSync(new URL('../src/audio.js', import.meta.url), 'utf8')
  .replace('export class GameAudio', 'class GameAudio')
  .replaceAll('import.meta.url', 'moduleUrl');
const moduleUrl = 'https://example.test/game/src/audio.js';
const summer = 'https://example.test/game/assets/audio/summer-platformer.mp3';
const autumn = 'https://example.test/game/assets/audio/kalm-mjork.mp3';
const winter = 'https://example.test/game/assets/audio/frozen-minor.mp3';
const zab = 'https://example.test/game/assets/audio/zab-petting.mp3';

test('combo pickup bell rises gently through levels 3–10, caps and respects mute', async () => {
  const app = application({ musicEnabled: false });
  await app.start('meadow', 'playing');
  const volumes = [];
  const pitches = [];
  for (let level = 3; level <= 11; level++) {
    app.audio.play('satsuma', 'meadow', level);
    const voice = app.context.oscillators.at(-1);
    assert.equal(voice.type, 'sine');
    const gain = voice.connections[0];
    volumes.push(gain.gain.events.find(([type]) => type === 'linear')[1]);
    pitches.push(voice.frequency.events[0][1]);
    assert.equal(gain.connections[0], app.audio.effectsGain);
    voice.onended();
    assert.equal(gain.disconnected, true);
  }
  for (let index = 1; index < 8; index++) {
    assert.ok(volumes[index] > volumes[index - 1]);
    assert.ok(volumes[index] - volumes[index - 1] < .004);
    assert.ok(pitches[index] > pitches[index - 1]);
  }
  assert.ok(volumes.at(-1) <= .066);
  assert.equal(volumes[7], volumes[8]);
  assert.equal(pitches[7], pitches[8]);
  app.audio.setEnabled(false);
  app.audio.play('satsuma', 'meadow', 10);
  assert.equal(app.context.oscillators.length, 9);
});

test('trampolines use the same combo bell as fruit at each combo level', async () => {
  const app = application({ musicEnabled: false });
  await app.start('meadow', 'playing');
  for (const level of [3, 7, 10, 11]) {
    app.audio.play('satsuma', 'meadow', level);
    const fruit = app.context.oscillators.at(-1);
    app.audio.play('trampoline', 'meadow', level);
    const trampoline = app.context.oscillators.at(-1);
    assert.equal(trampoline.type, fruit.type);
    assert.deepEqual(trampoline.frequency.events, fruit.frequency.events);
    assert.deepEqual(trampoline.connections[0].gain.events, fruit.connections[0].gain.events);
  }
});

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function flush() {
  for (let count = 0; count < 12; count++) await Promise.resolve();
}

function application({ enabled = true, musicEnabled = true, initialState = 'running', delayedPlay = false,
  delayedPettingFetch = false, delayedPettingDecode = false } = {}) {
  const errors = [];
  const contexts = [];
  const elements = [];
  const fetches = [];
  const timers = new Map();
  let timerTime = 0;
  let nextTimer = 1;
  const advance = (seconds) => {
    const target = timerTime + seconds * 1000;
    const moveClock = (time) => {
      if (contexts[0]?.state === 'running') contexts[0].currentTime += (time - timerTime) / 1000;
      timerTime = time;
    };
    while (true) {
      const next = [...timers].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      moveClock(next[1].at);
      timers.delete(next[0]);
      next[1].callback();
    }
    moveClock(target);
  };

  class Events {
    constructor() { this.listeners = new Map(); }
    addEventListener(name, listener) {
      if (!this.listeners.has(name)) this.listeners.set(name, []);
      this.listeners.get(name).push(listener);
    }
    dispatch(name) {
      for (const listener of this.listeners.get(name) ?? []) listener();
    }
  }

  class Media extends Events {
    constructor() {
      super();
      this.src = '';
      this.currentTime = 0;
      this.paused = true;
      this.error = null;
      this.plays = [];
      this.loads = [];
      this.pauseCalls = 0;
      elements.push(this);
    }
    play() {
      const pending = deferred();
      this.plays.push({ ...pending, src: this.src, time: this.currentTime });
      this.paused = false;
      if (!delayedPlay) pending.resolve();
      return pending.promise;
    }
    pause() { this.paused = true; this.pauseCalls++; }
    load() {
      this.loads.push(this.src);
      this.currentTime = 0;
      this.paused = true;
      this.error = null;
    }
    removeAttribute(name) { if (name === 'src') this.src = ''; }
    finishPlay(index = this.plays.length - 1) { this.plays[index].resolve(); }
    failPlay(name, index = this.plays.length - 1) {
      this.paused = true;
      this.plays[index].reject(Object.assign(new Error(name), { name }));
    }
    failLoad() { this.error = { code: 4 }; this.dispatch('error'); }
  }

  class Parameter {
    constructor(value = 1) { this.initial = value; this.events = []; this.automation = []; }
    get value() {
      const now = contexts[0]?.currentTime ?? 0;
      let previous = { value: this.initial, time: 0 };
      for (const event of this.automation) {
        if (event.time > now) {
          if (event.type === 'linear') return previous.value
            + (event.value - previous.value) * (now - previous.time) / (event.time - previous.time);
          return previous.value;
        }
        previous = event;
      }
      return previous.value;
    }
    record(type, value, time) {
      this.events.push([type, value, time]);
      this.automation.push({ type, value, time });
    }
    setValueAtTime(value, time) { this.record('set', value, time); }
    linearRampToValueAtTime(value, time) { this.record('linear', value, time); }
    exponentialRampToValueAtTime(value, time) { this.record('exponential', value, time); }
    cancelScheduledValues(time) {
      this.events.push(['cancel', time]);
      this.automation = this.automation.filter((event) => event.time < time);
    }
  }

  class Node {
    constructor() { this.connections = []; this.disconnected = false; }
    connect(destination) { this.connections.push(destination); return destination; }
    disconnect() { this.disconnected = true; this.connections = []; }
  }

  class Oscillator extends Node {
    constructor() { super(); this.starts = []; this.stops = []; this.frequency = new Parameter(); }
    start(time) { this.starts.push(time); }
    stop(time) { this.stops.push(time); }
  }

  class BufferSource extends Node {
    constructor() { super(); this.starts = []; this.stops = []; }
    start(time = 0) { this.starts.push(time); }
    stop(time = 0) { this.stops.push(time); }
  }

  class Context extends Events {
    constructor() {
      super();
      this.state = initialState;
      this.currentTime = 0;
      this.sampleRate = 24000;
      this.destination = new Node();
      this.gains = [];
      this.mediaSources = [];
      this.oscillators = [];
      this.bufferSources = [];
      this.buffers = [];
      this.filters = [];
      this.decodes = [];
      this.resumes = [];
      contexts.push(this);
    }
    createGain() {
      const gain = new Node();
      gain.gain = new Parameter();
      this.gains.push(gain);
      return gain;
    }
    createMediaElementSource(element) {
      assert.ok(!this.mediaSources.some((node) => node.element === element), 'an element can be routed only once');
      const node = new Node();
      node.element = element;
      this.mediaSources.push(node);
      return node;
    }
    createOscillator() {
      const oscillator = new Oscillator();
      this.oscillators.push(oscillator);
      return oscillator;
    }
    createBufferSource() {
      const source = new BufferSource();
      this.bufferSources.push(source);
      return source;
    }
    createBuffer(channels, length, sampleRate) {
      const samples = Array.from({ length: channels }, () => new Float32Array(length));
      const buffer = { duration: length / sampleRate, getChannelData: (channel) => samples[channel] };
      this.buffers.push(buffer);
      return buffer;
    }
    createBiquadFilter() {
      const filter = new Node();
      filter.frequency = new Parameter();
      filter.Q = new Parameter();
      this.filters.push(filter);
      return filter;
    }
    decodeAudioData(bytes) {
      const pending = deferred();
      const buffer = { duration: 2.5 };
      this.decodes.push({ ...pending, bytes, buffer });
      if (!delayedPettingDecode) pending.resolve(buffer);
      return pending.promise;
    }
    changeState(state) { this.state = state; this.dispatch('statechange'); }
    resume() {
      const pending = deferred();
      this.resumes.push(pending);
      return pending.promise;
    }
    finishResume() {
      this.changeState('running');
      for (const pending of this.resumes) pending.resolve();
    }
  }

  const sandbox = vm.createContext({
    AudioContext: Context, Audio: Media, URL, moduleUrl,
    fetch(url) {
      const pending = deferred();
      const response = { ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(16) };
      fetches.push({ ...pending, url, response });
      if (!delayedPettingFetch) pending.resolve(response);
      return pending.promise;
    },
    console: { error: (...args) => errors.push(args) },
    setTimeout(callback, delay) {
      const id = nextTimer++;
      timers.set(id, { at: timerTime + delay, callback });
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
  });
  vm.runInContext(audioSource, sandbox, { filename: 'src/audio.js' });
  const GameAudio = vm.runInContext('GameAudio', sandbox);
  const audio = new GameAudio(enabled, musicEnabled);
  return {
    audio, contexts, elements, errors, advance, fetches,
    get pendingTimers() { return timers.size; },
    get context() { return contexts[0]; },
    get media() { return elements[0]; },
    async start(theme = 'meadow', phase = 'ready') {
      audio.setScene(theme, phase);
      audio.unlock();
      await flush();
      if (!delayedPlay) advance(.2);
    },
  };
}

test('the first gesture starts default menu music with one streaming element and no prior request', async () => {
  const app = application();
  app.audio.setScene('meadow', 'ready');
  assert.equal(app.contexts.length, 0);
  assert.equal(app.elements.length, 0);
  app.audio.unlock();
  await flush();
  assert.equal(app.media.src, summer);
  assert.equal(app.media.loop, true);
  assert.equal(app.media.preload, 'none');
  assert.equal(app.media.plays.length, 1);
  assert.equal(app.context.mediaSources[0].element, app.media);
  assert.equal(app.context.mediaSources[0].connections[0], app.audio.musicGain);
  assert.equal(app.audio.musicGain.connections[0], app.context.destination);
  assert.equal(app.audio.effectsGain.connections[0], app.context.destination);
  app.advance(.18);
  assert.equal(app.audio.musicGain.gain.value, 0.3);
});

test('a suspended context calls media play during the gesture while resume is still pending', async () => {
  const app = application({ initialState: 'suspended', delayedPlay: true });
  await app.start();
  assert.equal(app.context.state, 'suspended');
  assert.equal(app.context.resumes.length, 1);
  assert.equal(app.media.plays.length, 1);
  app.media.finishPlay();
  await flush();
  assert.equal(app.media.paused, false);
  app.context.finishResume();
  await flush();
  assert.equal(app.media.plays.length, 1);
});

test('ready to playing and repeated notifications preserve position without duplicate play requests', async () => {
  const app = application({ delayedPlay: true });
  await app.start();
  app.media.currentTime = 17.5;
  for (let index = 0; index < 10; index++) {
    app.audio.setScene('meadow', 'playing');
    app.audio.unlock();
  }
  assert.equal(app.media.plays.length, 1);
  assert.equal(app.media.currentTime, 17.5);
  app.media.finishPlay();
  await flush();
  app.audio.setScene('meadow', 'ready');
  assert.equal(app.media.currentTime, 17.5);
  assert.equal(app.media.plays.length, 1);
  assert.equal(app.elements.length, 1);
  assert.equal(app.context.mediaSources.length, 1);
});

test('menu theme changes fade to each own track and reset its position', async () => {
  const app = application();
  await app.start();
  for (const [theme, track] of [['winter', winter], ['autumn', autumn], ['meadow', summer]]) {
    app.media.currentTime = 22;
    app.audio.setScene(theme, 'ready');
    app.advance(.12);
    assert.equal(app.media.src, track);
    assert.equal(app.media.currentTime, 0);
    assert.equal(app.media.plays.at(-1).src, track);
    await flush();
    app.advance(.18);
  }
  assert.deepEqual(app.media.loads, [summer, winter, autumn, summer]);
  assert.equal(app.elements.length, 1);
  assert.equal(app.context.mediaSources.length, 1);
});

test('Kvlt shares the Winter track without restarting it and unknown themes have no substitute', async () => {
  const app = application();
  await app.start('winter');
  app.media.currentTime = 8;
  app.audio.setScene('kvlt', 'playing');
  assert.equal(app.media.src, winter);
  assert.equal(app.media.currentTime, 8);
  assert.equal(app.media.plays.length, 1);
  app.audio.setScene('unknown', 'ready');
  app.advance(.12);
  assert.equal(app.media.src, '');
  assert.equal(app.media.currentTime, 0);
  assert.equal(app.media.paused, true);
  assert.equal(app.media.plays.length, 1);
});

test('explicit pause preserves playback time and resume continues from that position', async () => {
  const app = application();
  await app.start('winter', 'playing');
  app.media.currentTime = 37.25;
  app.audio.setScene('winter', 'paused');
  assert.equal(app.media.paused, true);
  assert.equal(app.media.currentTime, 37.25);
  assert.equal(app.audio.musicGain.gain.value, 0);
  app.audio.setScene('winter', 'playing');
  assert.equal(app.media.plays.at(-1).time, 37.25);
  await flush();
  assert.equal(app.media.paused, false);
  assert.equal(app.media.currentTime, 37.25);
  app.audio.setScene('winter', 'ready');
  assert.equal(app.media.plays.at(-1).time, 37.25);
  assert.equal(app.media.plays.length, 2);
  assert.equal(app.media.loads.length, 1);
});

test('each season keeps playing through game over, restart and menu without pause or reload', async () => {
  for (const [theme, track] of [['meadow', summer], ['autumn', autumn], ['winter', winter]]) {
    const app = application();
    await app.start(theme, 'playing');
    app.media.currentTime = 37.25;
    const pauses = app.media.pauseCalls;
    for (const phase of ['over', 'playing', 'over', 'ready', 'playing']) {
      app.audio.setScene(theme, phase);
      app.audio.unlock();
      assert.equal(app.media.paused, false, `${theme}/${phase}`);
      assert.equal(app.media.currentTime, 37.25, `${theme}/${phase}`);
      assert.equal(app.media.src, track);
      assert.equal(app.audio.musicGain.gain.value, theme === 'autumn' ? 0.33 : 0.3);
    }
    assert.equal(app.media.pauseCalls, pauses);
    assert.equal(app.media.plays.length, 1);
    assert.equal(app.media.loads.length, 1);
  }
});

test('pending play and context resume survive game over and restart without extra players', async () => {
  for (const initialState of ['running', 'suspended']) {
    const app = application({ initialState, delayedPlay: true });
    await app.start('winter', 'playing');
    app.media.currentTime = 16;
    app.audio.setScene('winter', 'over');
    app.media.finishPlay();
    await flush();
    assert.equal(app.media.paused, false);
    assert.equal(app.media.currentTime, 16);
    app.audio.setScene('winter', 'playing');
    app.audio.setScene('winter', 'over');
    if (initialState === 'suspended') app.context.finishResume();
    await flush();
    app.audio.setScene('winter', 'ready');
    app.audio.setScene('winter', 'playing');
    assert.equal(app.media.paused, false);
    assert.equal(app.media.currentTime, 16);
    assert.equal(app.media.plays.length, 1);
    assert.equal(app.media.loads.length, 1);
    assert.equal(app.elements.length, 1);
    assert.equal(app.context.mediaSources.length, 1);
  }
});

test('music mute at game over preserves position even when an earlier play completes later', async () => {
  for (const control of ['setMusicEnabled']) {
    const app = application({ delayedPlay: true });
    await app.start('autumn', 'playing');
    app.media.currentTime = 24.5;
    app.audio[control](false);
    app.audio.setScene('autumn', 'over');
    app.media.finishPlay();
    await flush();
    assert.equal(app.media.paused, true);
    assert.equal(app.media.currentTime, 24.5);
    assert.equal(app.audio.musicGain.gain.value, 0);
    app.audio[control](true);
    assert.equal(app.media.plays.at(-1).time, 24.5);
    app.media.finishPlay();
    await flush();
    app.audio.setScene('autumn', 'playing');
    assert.equal(app.media.currentTime, 24.5);
    assert.equal(app.media.plays.length, 2);
    assert.equal(app.media.loads.length, 1);
  }
});

const stopTransitions = [
  ['music mute', (audio) => audio.setMusicEnabled(false)],
  ['pause', (audio) => audio.setScene('meadow', 'paused')],
  ['unknown theme', (audio) => audio.setScene('unknown', 'ready')],
];

for (const [label, transition] of stopTransitions) {
  test(`a pending play cannot restart music after ${label}`, async () => {
    const app = application({ delayedPlay: true });
    await app.start();
    transition(app.audio);
    app.media.finishPlay(0);
    await flush();
    assert.equal(app.media.paused, true);
    assert.equal(app.audio.musicGain.gain.value, 0);
    assert.equal(app.media.plays.length, 1);
  });

  test(`a pending context resume cannot restart music after ${label}`, async () => {
    const app = application({ initialState: 'suspended', delayedPlay: true });
    await app.start();
    app.audio.unlock();
    assert.equal(app.context.resumes.length, 1, 'resume calls are shared');
    transition(app.audio);
    app.context.finishResume();
    app.media.finishPlay(0);
    await flush();
    assert.equal(app.media.paused, true);
    assert.equal(app.media.plays.length, 1);
    assert.equal(app.audio.musicGain.gain.value, 0);
  });
}

test('several stale play promises cannot pause or replace the latest selected song', async () => {
  const app = application({ delayedPlay: true });
  await app.start();
  app.audio.setScene('winter', 'ready');
  app.audio.setScene('winter', 'paused');
  app.audio.setScene('winter', 'playing');
  assert.equal(app.media.plays.length, 3);
  app.media.finishPlay(0);
  app.media.plays[1].reject(Object.assign(new Error('Previous request'), { name: 'AbortError' }));
  await flush();
  assert.equal(app.media.src, winter);
  assert.equal(app.media.paused, false);
  app.audio.setScene('winter', 'playing');
  assert.equal(app.media.plays.length, 3);
  app.media.finishPlay(2);
  await flush();
  assert.equal(app.errors.length, 0);
  assert.equal(app.elements.length, 1);
});

test('effects mute gates existing SFX independently while music mute preserves enabled SFX', async () => {
  const app = application();
  await app.start();
  app.audio.play('over', 'meadow');
  const oscillator = app.context.oscillators[0];
  const sfxGain = oscillator.connections[0];
  assert.equal(sfxGain.connections[0], app.audio.effectsGain);
  assert.equal(app.audio.effectsGain.connections[0], app.context.destination);
  assert.equal(app.audio.musicGain.connections[0], app.context.destination);
  app.media.currentTime = 12.5;
  const musicEvents = app.audio.musicGain.gain.events.length;
  app.audio.setEnabled(false);
  assert.equal(app.audio.effectsGain.gain.value, 0);
  assert.equal(app.media.paused, false);
  assert.equal(app.media.currentTime, 12.5);
  assert.equal(app.media.plays.length, 1);
  assert.equal(app.audio.musicGain.gain.events.length, musicEvents);
  app.audio.play('bounce');
  assert.equal(app.context.oscillators.length, 1);
  app.audio.setEnabled(true);
  app.audio.setMusicEnabled(false);
  assert.equal(app.media.paused, true);
  assert.equal(app.media.currentTime, 12.5);
  assert.equal(app.audio.musicGain.gain.value, 0);
  assert.equal(app.audio.effectsGain.gain.value, 1);
  app.audio.play('bounce');
  assert.equal(app.context.oscillators.length, 2);
  app.audio.setEnabled(false);
  assert.equal(app.audio.effectsGain.gain.value, 0);
  app.audio.play('bounce');
  assert.equal(app.context.oscillators.length, 2);
  app.audio.setEnabled(true);
  assert.equal(app.audio.effectsGain.gain.value, 1);
  assert.equal(app.media.paused, true, 'effects unmute respects the separate music preference');
  app.audio.setEnabled(false);
  app.audio.setMusicEnabled(true);
  assert.equal(app.media.plays.at(-1).time, 12.5);
  assert.equal(app.audio.effectsGain.gain.value, 0, 'music unmute leaves effects muted');
  oscillator.onended();
  assert.equal(oscillator.disconnected, true);
  assert.equal(sfxGain.disconnected, true);
});

test('both disabled creates no audio, and either category can start independently', async () => {
  const silent = application({ enabled: false, musicEnabled: false });
  await silent.start();
  assert.equal(silent.contexts.length, 0);
  assert.equal(silent.elements.length, 0);
  const sfxOnly = application({ musicEnabled: false });
  await sfxOnly.start();
  assert.equal(sfxOnly.media.plays.length, 0);
  sfxOnly.audio.play('gull');
  assert.equal(sfxOnly.context.oscillators.length, 1);
  const musicOnly = application({ enabled: false });
  await musicOnly.start();
  assert.equal(musicOnly.media.plays.length, 1);
  assert.equal(musicOnly.media.paused, false);
  assert.equal(musicOnly.audio.effectsGain.gain.value, 0);
  musicOnly.audio.play('gull');
  assert.equal(musicOnly.context.oscillators.length, 0);
  silent.audio.setMusicEnabled(true);
  assert.equal(silent.media.plays.length, 1);
  assert.equal(silent.audio.effectsGain.gain.value, 0);
});

test('effects mute does not cancel a pending music play or context resume', async () => {
  for (const initialState of ['running', 'suspended']) {
    const app = application({ initialState, delayedPlay: true });
    await app.start();
    app.audio.setEnabled(false);
    app.media.finishPlay();
    if (initialState === 'suspended') app.context.finishResume();
    await flush();
    app.advance(.18);
    assert.equal(app.media.paused, false);
    assert.equal(app.media.plays.length, 1);
    assert.equal(app.audio.musicGain.gain.value, .3);
    assert.equal(app.audio.effectsGain.gain.value, 0);
  }
});

test('suspension and interruption pause streaming and preserve the next unlock position', async () => {
  for (const state of ['suspended', 'interrupted']) {
    const app = application();
    await app.start('winter', 'playing');
    app.media.currentTime = 9;
    app.context.changeState(state);
    assert.equal(app.media.paused, true);
    assert.equal(app.media.currentTime, 9);
    app.audio.unlock();
    assert.equal(app.context.resumes.length, 1);
    assert.equal(app.media.plays.at(-1).time, 9);
    app.context.finishResume();
    await flush();
    assert.equal(app.media.plays.length, 2);
  }
});

test('Autumn and Meadow SFX match, Winter remains darker and gull has its own note', () => {
  const app = application();
  app.audio.unlock();
  const sound = (event, theme) => {
    app.audio.play(event, theme);
    const oscillator = app.context.oscillators.at(-1);
    return { type: oscillator.type, frequency: oscillator.frequency.events,
      envelope: oscillator.connections[0].gain.events, starts: oscillator.starts, stops: oscillator.stops };
  };
  for (const event of ['bounce', 'satsuma', 'trap', 'tap', 'release', 'slip', 'over', 'gull']) {
    const meadow = sound(event, 'meadow');
    assert.deepEqual(sound(event, 'autumn'), meadow, event);
    assert.equal(meadow.type, 'triangle');
    const kvlt = sound(event, 'kvlt');
    assert.deepEqual(sound(event, 'winter'), kvlt, event);
    assert.equal(kvlt.type, 'sawtooth');
    assert.equal(kvlt.frequency[0][1], meadow.frequency[0][1] * 0.55);
  }
  assert.deepEqual(sound('gull', 'meadow').frequency, [['set', 700, 0], ['exponential', 400, 0.1]]);
  const count = app.context.oscillators.length;
  app.audio.play('unknown');
  assert.equal(app.context.oscillators.length, count);
});

test('a load or unsupported-play error stops without retry loops or replacement music', async () => {
  for (const failure of ['load', 'play']) {
    const app = application({ delayedPlay: true });
    await app.start('winter');
    if (failure === 'load') app.media.failLoad();
    else app.media.failPlay('NotSupportedError');
    await flush();
    for (let index = 0; index < 3; index++) {
      app.audio.setScene('winter', 'playing');
      app.audio.unlock();
    }
    assert.equal(app.errors.length, 1);
    assert.equal(app.media.src, winter);
    assert.equal(app.media.paused, true);
    assert.equal(app.media.plays.length, 1);
    assert.equal(app.context.oscillators.length, 0);
    app.audio.setScene('meadow', 'ready');
    assert.equal(app.media.src, summer);
    assert.equal(app.media.plays.length, 2, 'a different selected song can still play');
  }
});

test('autoplay rejection waits for another gesture instead of retrying on scene updates', async () => {
  const app = application({ delayedPlay: true });
  await app.start();
  app.media.failPlay('NotAllowedError');
  await flush();
  app.audio.setScene('meadow', 'playing');
  assert.equal(app.media.plays.length, 1);
  app.audio.unlock();
  assert.equal(app.media.plays.length, 2);
  app.media.finishPlay(1);
  await flush();
  assert.equal(app.media.paused, false);
});

test('a season change fades out before swapping source and fades in after playback starts', async () => {
  const app = application();
  await app.start();
  app.media.currentTime = 15;
  app.audio.setScene('winter', 'ready');
  assert.equal(app.media.src, summer, 'the old song remains loaded during its release');
  app.advance(.06);
  assert.ok(Math.abs(app.audio.musicGain.gain.value - .15) < 1e-9);
  const events = app.audio.musicGain.gain.events.length;
  app.audio.setScene('winter', 'playing');
  app.audio.unlock();
  assert.equal(app.audio.musicGain.gain.events.length, events, 'notifications must not replace the release envelope');
  assert.equal(app.pendingTimers, 1);
  app.advance(.06);
  assert.equal(app.media.src, winter);
  assert.equal(app.media.currentTime, 0);
  assert.equal(app.audio.musicGain.gain.value, 0);
  await flush();
  app.advance(.09);
  assert.ok(Math.abs(app.audio.musicGain.gain.value - .15) < 1e-9);
  const attackEvents = app.audio.musicGain.gain.events.length;
  app.audio.setScene('winter', 'over');
  app.audio.unlock();
  app.audio.setEnabled(false);
  app.audio.setEnabled(true);
  assert.equal(app.audio.musicGain.gain.events.length, attackEvents, 'notifications must not restart the attack envelope');
  app.advance(.09);
  assert.equal(app.audio.musicGain.gain.value, .3);
  assert.equal(app.media.plays.length, 2);
});

test('rapid season choices load only the final song after one release', async () => {
  const app = application();
  await app.start();
  app.audio.setScene('winter', 'ready');
  app.advance(.06);
  app.audio.setScene('autumn', 'ready');
  assert.equal(app.pendingTimers, 1);
  app.advance(.06);
  await flush();
  app.advance(.18);
  assert.equal(app.media.src, autumn);
  assert.deepEqual(app.media.loads, [summer, autumn]);
  assert.equal(app.media.plays.length, 2);
  assert.equal(app.elements.length, 1);
  assert.equal(app.context.mediaSources.length, 1);
  assert.equal(app.pendingTimers, 0);
});

test('returning to the current season during release cancels the swap without restarting music', async () => {
  const app = application();
  await app.start();
  app.media.currentTime = 11;
  app.audio.setScene('winter', 'ready');
  app.advance(.06);
  app.audio.setScene('meadow', 'ready');
  assert.equal(app.pendingTimers, 0);
  assert.ok(Math.abs(app.audio.musicGain.gain.value - .15) < 1e-9, 'the new attack starts at the actual release level');
  app.advance(.2);
  assert.equal(app.audio.musicGain.gain.value, .3);
  assert.equal(app.media.src, summer);
  assert.equal(app.media.currentTime, 11);
  assert.equal(app.media.plays.length, 1);
  assert.deepEqual(app.media.loads, [summer]);
});

test('pause or music mute during release cancels the timer and cannot start a queued track', async () => {
  for (const action of ['pause', 'mute', 'suspend']) {
    const app = application();
    await app.start();
    app.audio.setScene('winter', 'ready');
    app.advance(.06);
    if (action === 'pause') app.audio.setScene('winter', 'paused');
    if (action === 'mute') app.audio.setMusicEnabled(false);
    if (action === 'suspend') app.context.changeState('suspended');
    assert.equal(app.pendingTimers, 0);
    assert.equal(app.media.paused, true);
    assert.equal(app.audio.musicGain.gain.value, 0);
    app.advance(.5);
    await flush();
    assert.equal(app.media.plays.length, 1);
    assert.equal(app.media.src, winter, 'the next selected source is ready but remains silent');
    if (action === 'pause') app.audio.setScene('winter', 'playing');
    if (action === 'mute') app.audio.setMusicEnabled(true);
    if (action === 'suspend') {
      app.audio.unlock();
      app.context.finishResume();
    }
    await flush();
    app.advance(.18);
    assert.equal(app.media.plays.length, 2);
    assert.equal(app.media.plays.at(-1).src, winter);
    assert.equal(app.audio.musicGain.gain.value, .3);
  }
});

test('delayed new-track playback waits silently, and stale play results cannot fade in the wrong song', async () => {
  const app = application({ delayedPlay: true });
  await app.start();
  app.media.finishPlay(0);
  await flush();
  app.advance(.18);
  app.audio.setScene('winter', 'ready');
  app.advance(.12);
  assert.equal(app.media.src, winter);
  assert.equal(app.media.plays.length, 2);
  app.advance(.5);
  app.audio.unlock();
  assert.equal(app.audio.musicGain.gain.value, 0, 'loading cannot consume the attack envelope');
  app.audio.setScene('autumn', 'ready');
  assert.equal(app.media.src, autumn);
  assert.equal(app.media.plays.length, 3);
  const events = app.audio.musicGain.gain.events.length;
  app.media.finishPlay(1);
  await flush();
  assert.equal(app.audio.musicGain.gain.events.length, events);
  assert.equal(app.audio.musicGain.gain.value, 0);
  app.media.finishPlay(2);
  await flush();
  app.advance(.09);
  assert.ok(Math.abs(app.audio.musicGain.gain.value - .165) < 1e-9);
  app.audio.setMusicEnabled(false);
  assert.equal(app.audio.musicGain.gain.value, 0, 'mute immediately cancels a partially completed attack');
  app.advance(.5);
  assert.equal(app.media.paused, true);
  assert.equal(app.audio.musicGain.gain.value, 0);
});

test('Zab petting loops one decoded sample without restarting on frame updates or creating another media player', async () => {
  const app = application();
  await app.start('meadow', 'playing');
  app.audio.setPetting('dog');
  app.audio.setPetting(null);
  assert.equal(app.fetches.length, 0);
  app.audio.setPetting('zab');
  for (let frame = 0; frame < 20; frame++) app.audio.setPetting('zab');
  await flush();
  const source = app.context.bufferSources[0];
  assert.equal(app.fetches.length, 1);
  assert.equal(app.fetches[0].url, zab);
  assert.equal(app.context.decodes.length, 1);
  assert.equal(source.buffer, app.context.decodes[0].buffer);
  assert.equal(source.loop, true);
  assert.equal(source.connections[0], app.audio.effectsGain);
  assert.deepEqual(source.starts, [0]);
  for (let frame = 0; frame < 20; frame++) {
    app.audio.setScene('meadow', 'playing');
    app.audio.setPetting('zab');
  }
  assert.equal(app.context.bufferSources.length, 1);
  assert.equal(app.elements.length, 1, 'automatic petting uses the gesture-unlocked context');
  app.audio.setPetting(null);
  assert.deepEqual(source.stops, [0]);
  assert.equal(source.disconnected, true);
  app.audio.setPetting('zab');
  assert.equal(app.context.bufferSources.length, 2);
  assert.equal(app.context.bufferSources[1].buffer, source.buffer);
  assert.equal(app.fetches.length, 1, 'later encounters reuse the decoded sample');
});

test('Zab follows the effects setting independently of background music', async () => {
  const app = application({ musicEnabled: false });
  await app.start('winter', 'playing');
  app.audio.setPetting('zab');
  await flush();
  const first = app.context.bufferSources[0];
  assert.equal(first.stops.length, 0);
  app.audio.setMusicEnabled(true);
  app.audio.setMusicEnabled(false);
  assert.equal(first.stops.length, 0);
  assert.equal(app.context.bufferSources.length, 1);
  app.audio.setEnabled(false);
  assert.equal(first.stops.length, 1);
  assert.equal(first.disconnected, true);
  app.audio.setPetting('zab');
  assert.equal(app.context.bufferSources.length, 1);
  app.audio.setEnabled(true);
  assert.equal(app.context.bufferSources.length, 2);
  assert.equal(app.media.paused, true);
  assert.equal(app.fetches.length, 1);
});

const stopPettingTransitions = [
  ['release', (audio) => audio.setPetting(null)],
  ['dog', (audio) => audio.setPetting('dog')],
  ['pause or focus loss', (audio) => audio.setScene('meadow', 'paused')],
  ['menu', (audio) => audio.setScene('meadow', 'ready')],
  ['game over', (audio) => audio.setScene('meadow', 'over')],
  ['effects mute', (audio) => audio.setEnabled(false)],
];

for (const [label, transition] of stopPettingTransitions) {
  test(`Zab stops immediately after ${label}, including when fetch or decode finishes later`, async () => {
    for (const stage of ['playing', 'fetch', 'decode']) {
      const app = application({ delayedPettingFetch: stage === 'fetch', delayedPettingDecode: stage === 'decode' });
      await app.start('meadow', 'playing');
      app.audio.setPetting('zab');
      await flush();
      transition(app.audio);
      if (stage === 'fetch') app.fetches[0].resolve(app.fetches[0].response);
      if (stage === 'decode') app.context.decodes[0].resolve(app.context.decodes[0].buffer);
      await flush();
      if (stage === 'playing') {
        const source = app.context.bufferSources[0];
        assert.equal(source.stops.length, 1);
        assert.equal(source.disconnected, true);
      } else assert.equal(app.context.bufferSources.length, 0, stage);
      assert.equal(app.audio.pettingSource, null);
      assert.equal(app.fetches.length, 1);
    }
  });
}

test('unfinished Zab petting resumes after pause and audio interruption with only one active loop', async () => {
  const app = application();
  await app.start('meadow', 'playing');
  app.audio.setPetting('zab');
  await flush();
  app.audio.setScene('meadow', 'paused');
  app.audio.setScene('meadow', 'playing');
  assert.equal(app.context.bufferSources.length, 2);
  for (const state of ['suspended', 'interrupted']) {
    const previous = app.context.bufferSources.at(-1);
    app.context.changeState(state);
    assert.equal(previous.stops.length, 1);
    assert.equal(app.audio.pettingSource, null);
    app.audio.unlock();
    assert.equal(app.audio.pettingSource, null, 'resume must finish before starting a buffer');
    app.context.finishResume();
    await flush();
    assert.notEqual(app.audio.pettingSource, previous);
    assert.equal(app.audio.pettingSource.stops.length, 0);
  }
  assert.equal(app.context.bufferSources.length, 4);
  assert.equal(app.fetches.length, 1);
});

test('an initial context resume or a late load cannot revive cancelled petting', async () => {
  const app = application({ initialState: 'suspended' });
  await app.start('meadow', 'playing');
  app.audio.setPetting('zab');
  assert.equal(app.fetches.length, 0);
  app.audio.setPetting(null);
  app.context.finishResume();
  await flush();
  assert.equal(app.fetches.length, 0);
  assert.equal(app.context.bufferSources.length, 0);
  app.audio.setPetting('zab');
  await flush();
  assert.equal(app.context.bufferSources.length, 1, 'a later encounter uses the already unlocked context');
});

test('petting fetch, HTTP and decode failures report once without retrying on subsequent frames or gestures', async () => {
  for (const failure of ['network', 'http', 'decode']) {
    const app = application({ delayedPettingFetch: true, delayedPettingDecode: true });
    await app.start('meadow', 'playing');
    app.audio.setPetting('zab');
    if (failure === 'network') app.fetches[0].reject(new Error('Network unavailable'));
    else {
      app.fetches[0].resolve(failure === 'http' ? { ok: false, status: 404 } : app.fetches[0].response);
      await flush();
      if (failure === 'decode') app.context.decodes[0].reject(new Error('Invalid audio'));
    }
    await flush();
    for (let frame = 0; frame < 20; frame++) {
      app.audio.setScene('meadow', 'playing');
      app.audio.setPetting('zab');
      app.audio.unlock();
    }
    assert.equal(app.context.bufferSources.length, 0, failure);
    assert.equal(app.fetches.length, 1, failure);
    assert.equal(app.errors.length, 1, failure);
    assert.equal(app.media.paused, false, 'a failed effect leaves the music running');
  }
});

test('the boost layers one rising swoosh over uninterrupted Zab without restarting on frame updates', async () => {
  const app = application({ musicEnabled: false });
  await app.start('meadow', 'playing');
  app.audio.setPetting('zab');
  await flush();
  const petting = app.audio.pettingSource;
  app.audio.setBoost(null);
  assert.equal(app.context.oscillators.length, 0, 'charging has no launch sound');
  const start = app.context.currentTime;
  app.audio.setBoost(0, .9375);
  const tone = app.context.oscillators[0];
  const noise = app.context.bufferSources[1];
  const filter = noise.connections[0];
  const gain = filter.connections[0];
  assert.equal(tone.type, 'triangle');
  assert.equal(filter.type, 'bandpass');
  assert.equal(noise.loop, true);
  assert.equal(gain.connections[0], app.audio.effectsGain);
  assert.deepEqual(tone.frequency.events, [['set', 180, start], ['exponential', 1800, start + .9375]]);
  assert.deepEqual(filter.frequency.events, [['set', 550, start], ['exponential', 3300, start + .9375]]);
  assert.deepEqual(tone.stops, [start + .9375]);
  assert.deepEqual(noise.stops, tone.stops);
  for (let frame = 0; frame < 30; frame++) {
    app.audio.setScene('meadow', 'playing');
    app.audio.setPetting('zab');
    app.audio.setBoost(frame / 30, .9375);
    app.audio.unlock();
  }
  assert.equal(app.context.oscillators.length, 1);
  assert.equal(app.context.bufferSources.length, 2);
  assert.equal(app.audio.pettingSource, petting);
  assert.deepEqual(petting.stops, []);
  assert.equal(app.fetches.length, 1, 'the swoosh is synthesized without another asset request');
  app.audio.setBoost(null);
  app.audio.setPetting(null);
  assert.equal(tone.stops.length, 2, 'the endpoint stops an unfinished audio envelope immediately');
  assert.equal(noise.stops.length, 2);
  assert.equal(gain.disconnected, true);
  assert.equal(petting.disconnected, true);
});

test('a naturally ended boost stays finished until the next launch and releases all audio nodes', async () => {
  const app = application();
  await app.start('meadow', 'playing');
  app.audio.setBoost(.2, 1.2);
  const voice = app.audio.boostVoice;
  const tone = app.context.oscillators[0];
  tone.onended();
  assert.ok(voice.nodes.every((node) => node.disconnected));
  for (const progress of [.6, .8, .999]) {
    app.audio.setBoost(progress, 1.2);
    app.audio.setScene('meadow', 'playing');
    app.audio.unlock();
  }
  assert.equal(app.context.oscillators.length, 1, 'an audio clock running ahead cannot repeat the launch');
  app.audio.setBoost(1, 1.2);
  app.audio.setBoost(null);
  app.audio.setBoost(0, 1.2);
  assert.equal(app.context.oscillators.length, 2);
  assert.equal(app.context.buffers.length, 1, 'later launches reuse their small noise buffer');
  tone.onended();
  assert.equal(app.audio.boostVoice.ended, false, 'an old completion cannot close the current voice');
});

test('boost pause, effect mute and audio interruptions resume only the remaining sweep', async () => {
  for (const action of ['pause', 'mute', 'suspended', 'interrupted']) {
    const app = application();
    await app.start('winter', 'playing');
    app.audio.setBoost(0, 1.2);
    app.audio.setBoost(.4, 1.2);
    const first = app.audio.boostVoice;
    if (action === 'pause') app.audio.setScene('winter', 'paused');
    else if (action === 'mute') app.audio.setEnabled(false);
    else app.context.changeState(action);
    assert.equal(app.audio.boostVoice, null, action);
    assert.ok(first.sources.every((source) => source.stops.length === 2), action);
    assert.ok(first.nodes.every((node) => node.disconnected), action);
    app.audio.setBoost(.6, 1.2);
    assert.equal(app.context.oscillators.length, 1, action);
    if (action === 'pause') app.audio.setScene('winter', 'playing');
    else if (action === 'mute') app.audio.setEnabled(true);
    else {
      app.audio.unlock();
      assert.equal(app.context.oscillators.length, 1, 'the effect waits for context resume');
      app.context.finishResume();
      await flush();
    }
    const resumed = app.context.oscillators[1];
    const now = app.context.currentTime;
    assert.equal(resumed.frequency.events[0][1], 180 * 10 ** .6, action);
    assert.deepEqual(resumed.stops, [now + 1.2 * .4], action);
    app.audio.setBoost(.7, 1.2);
    app.audio.unlock();
    assert.equal(app.context.oscillators.length, 2, action);
  }
});

test('boost belongs to effects and ignores the separate music preference', async () => {
  const app = application({ musicEnabled: false });
  await app.start('meadow', 'playing');
  app.audio.setBoost(.2, 1);
  const voice = app.audio.boostVoice;
  app.audio.setMusicEnabled(true);
  app.audio.setMusicEnabled(false);
  assert.equal(app.audio.boostVoice, voice);
  assert.equal(app.context.oscillators.length, 1);
  assert.equal(voice.ended, false);
  app.audio.setEnabled(false);
  app.audio.setBoost(1, 1);
  app.audio.setEnabled(true);
  assert.equal(app.audio.boostVoice, null, 'unmuting after the endpoint cannot replay the launch');
});

test('menu, game over and a cancelled suspended launch cannot revive boost audio later', async () => {
  for (const phase of ['ready', 'over']) {
    const app = application();
    await app.start('meadow', 'playing');
    app.audio.setBoost(.3, 1);
    const voice = app.audio.boostVoice;
    app.audio.setScene('meadow', phase);
    app.audio.setBoost(null);
    assert.ok(voice.nodes.every((node) => node.disconnected));
    app.audio.unlock();
    app.audio.setScene('meadow', 'playing');
    assert.equal(app.context.oscillators.length, 1);
  }
  const app = application({ initialState: 'suspended' });
  await app.start('meadow', 'playing');
  app.audio.setBoost(.2, 1);
  app.audio.setBoost(null);
  app.context.finishResume();
  await flush();
  assert.equal(app.context.oscillators.length, 0);
});
