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

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function flush() {
  for (let count = 0; count < 4; count++) await Promise.resolve();
}

function application({ enabled = true, musicEnabled = true, initialState = 'running', delayedPlay = false } = {}) {
  const errors = [];
  const contexts = [];
  const elements = [];

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
    constructor(value = 1) { this.value = value; this.events = []; }
    setValueAtTime(value, time) { this.value = value; this.events.push(['set', value, time]); }
    linearRampToValueAtTime(value, time) { this.events.push(['linear', value, time]); }
    exponentialRampToValueAtTime(value, time) { this.events.push(['exponential', value, time]); }
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

  class Context extends Events {
    constructor() {
      super();
      this.state = initialState;
      this.currentTime = 0;
      this.destination = new Node();
      this.gains = [];
      this.mediaSources = [];
      this.oscillators = [];
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
    console: { error: (...args) => errors.push(args) },
  });
  vm.runInContext(audioSource, sandbox, { filename: 'src/audio.js' });
  const GameAudio = vm.runInContext('GameAudio', sandbox);
  const audio = new GameAudio(enabled, musicEnabled);
  return {
    audio, contexts, elements, errors,
    get context() { return contexts[0]; },
    get media() { return elements[0]; },
    async start(theme = 'meadow', phase = 'ready') {
      audio.setScene(theme, phase);
      audio.unlock();
      await flush();
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
  assert.equal(app.audio.musicGain.connections[0], app.audio.master);
  assert.equal(app.audio.master.connections[0], app.context.destination);
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

test('menu theme changes immediately select each own track and reset its position', async () => {
  const app = application();
  await app.start();
  for (const [theme, track] of [['winter', winter], ['autumn', autumn], ['meadow', summer]]) {
    app.media.currentTime = 22;
    app.audio.setScene(theme, 'ready');
    assert.equal(app.media.src, track);
    assert.equal(app.media.currentTime, 0);
    assert.equal(app.media.plays.at(-1).src, track);
    await flush();
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
      assert.equal(app.audio.musicGain.gain.value, 0.3);
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

test('muting at game over preserves the position even when an earlier play completes later', async () => {
  for (const control of ['setEnabled', 'setMusicEnabled']) {
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
  ['master mute', (audio) => audio.setEnabled(false)],
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

test('master mute gates existing SFX and music; music mute preserves SFX and its own setting', async () => {
  const app = application();
  await app.start();
  app.audio.play('over', 'meadow');
  const oscillator = app.context.oscillators[0];
  const sfxGain = oscillator.connections[0];
  assert.equal(sfxGain.connections[0], app.audio.master);
  app.media.currentTime = 12.5;
  app.audio.setMusicEnabled(false);
  assert.equal(app.media.paused, true);
  assert.equal(app.media.currentTime, 12.5);
  assert.equal(app.audio.musicGain.gain.value, 0);
  assert.equal(app.audio.master.gain.value, 1);
  app.audio.play('bounce');
  assert.equal(app.context.oscillators.length, 2);
  app.audio.setEnabled(false);
  assert.equal(app.audio.master.gain.value, 0);
  app.audio.play('bounce');
  assert.equal(app.context.oscillators.length, 2);
  app.audio.setEnabled(true);
  assert.equal(app.audio.master.gain.value, 1);
  assert.equal(app.media.paused, true, 'master unmute respects the separate music preference');
  app.audio.setMusicEnabled(true);
  assert.equal(app.media.plays.at(-1).time, 12.5);
  oscillator.onended();
  assert.equal(oscillator.disconnected, true);
  assert.equal(sfxGain.disconnected, true);
});

test('initially disabled sound performs no work, while initially disabled music still allows SFX', async () => {
  const silent = application({ enabled: false });
  await silent.start();
  assert.equal(silent.contexts.length, 0);
  assert.equal(silent.elements.length, 0);
  const sfxOnly = application({ musicEnabled: false });
  await sfxOnly.start();
  assert.equal(sfxOnly.media.plays.length, 0);
  sfxOnly.audio.play('gull');
  assert.equal(sfxOnly.context.oscillators.length, 1);
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
