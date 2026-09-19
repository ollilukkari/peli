const isKvlt = (theme) => theme === 'kvlt' || theme === 'winter';
const summerTrack = new URL('../assets/audio/summer-platformer.mp3', import.meta.url).href;
const autumnTrack = new URL('../assets/audio/kalm-mjork.mp3', import.meta.url).href;
const winterTrack = new URL('../assets/audio/frozen-minor.mp3', import.meta.url).href;
const zabPettingTrack = new URL('../assets/audio/zab-petting.mp3', import.meta.url).href;
const musicTracks = { meadow: summerTrack, autumn: autumnTrack, winter: winterTrack, kvlt: winterTrack };
const MUSIC_VOLUME = .3;
const AUTUMN_MUSIC_VOLUME = MUSIC_VOLUME * 1.1;
const FADE_OUT = .12;
const FADE_IN = .18;
const WINTER_COMBO_DISTORTION = Float32Array.from({ length: 129 }, (_, index) =>
  Math.tanh((index / 64 - 1) * 3) / Math.tanh(3));

export class GameAudio {
  constructor(enabled = true, musicEnabled = true) {
    this.enabled = enabled;
    this.musicEnabled = musicEnabled;
    this.context = null;
    this.contextResume = null;
    this.effectsGain = null;
    this.theme = 'meadow';
    this.phase = 'ready';
    this.musicElement = null;
    this.musicSource = null;
    this.musicGain = null;
    this.musicTrack = null;
    this.musicRequest = null;
    this.musicGeneration = 0;
    this.musicFailed = false;
    this.musicAutoplayBlocked = false;
    this.musicTransition = null;
    this.musicEnvelope = null;
    this.pettingKind = null;
    this.pettingBuffer = null;
    this.pettingLoad = null;
    this.pettingFailed = false;
    this.pettingSource = null;
    this.boostProgress = null;
    this.boostDuration = .9375;
    this.boostNoiseBuffer = null;
    this.boostVoice = null;
  }

  unlock() {
    if (!this.enabled && !this.musicEnabled) return;
    if (!this.context) {
      this.context = new AudioContext();
      this.effectsGain = this.context.createGain();
      this.effectsGain.gain.setValueAtTime(this.enabled ? 1 : 0, this.context.currentTime);
      this.effectsGain.connect(this.context.destination);
      // One streaming element avoids decoding several long songs into PCM buffers.
      this.musicElement = new Audio();
      this.musicElement.loop = true;
      this.musicElement.preload = 'none';
      this.musicSource = this.context.createMediaElementSource(this.musicElement);
      this.musicGain = this.context.createGain();
      this.musicSource.connect(this.musicGain).connect(this.context.destination);
      this.setMusicLevel(0);
      this.musicElement.addEventListener('error', () => {
        if (!this.musicElement.error || this.musicFailed) return;
        this.musicFailed = true;
        this.syncMusic();
        console.error('Taustamusiikin lataaminen epäonnistui.', this.musicElement.error);
      });
      this.context.addEventListener('statechange', () => { this.syncMusic(); this.syncPetting(); this.syncBoost(); });
    }
    if (this.musicAutoplayBlocked) {
      this.musicFailed = false;
      this.musicAutoplayBlocked = false;
    }
    if (['suspended', 'interrupted'].includes(this.context.state) && !this.contextResume) {
      const resumed = () => { this.contextResume = null; this.syncMusic(); this.syncPetting(); this.syncBoost(); };
      this.contextResume = this.context.resume().then(resumed, resumed);
    }
    // Call media.play() inside the gesture too, while AudioContext resumes.
    this.syncMusic();
    this.syncPetting();
    this.syncBoost();
  }

  setEnabled(value) {
    this.enabled = value;
    if (this.effectsGain) this.effectsGain.gain.setValueAtTime(value ? 1 : 0, this.context.currentTime);
    if (value) this.unlock();
    else { this.syncPetting(); this.syncBoost(); }
  }

  setMusicEnabled(value) {
    this.musicEnabled = value;
    if (value) this.unlock();
    else this.syncMusic();
  }

  setScene(theme, phase) {
    this.theme = theme;
    this.phase = phase;
    this.syncMusic();
    this.syncPetting();
    this.syncBoost();
  }

  setPetting(kind) {
    this.pettingKind = kind;
    this.syncPetting();
  }

  setBoost(progress, duration = .9375) {
    this.boostProgress = progress;
    this.boostDuration = duration;
    this.syncBoost();
  }

  stopBoost() {
    const voice = this.boostVoice;
    if (!voice) return;
    if (!voice.ended) {
      for (const source of voice.sources) source.stop();
      for (const node of voice.nodes) node.disconnect();
      voice.ended = true;
    }
    this.boostVoice = null;
  }

  syncBoost() {
    const progress = this.boostProgress;
    const wanted = this.enabled && this.phase === 'playing' && this.context?.state === 'running'
      && progress !== null && progress >= 0 && progress < 1;
    if (!wanted) { this.stopBoost(); return; }
    // Frame updates cannot stack voices or restart an already finished sweep.
    if (this.boostVoice) return;
    const context = this.context;
    const start = context.currentTime;
    const remaining = this.boostDuration * (1 - progress);
    const end = start + remaining;
    if (!this.boostNoiseBuffer) {
      this.boostNoiseBuffer = context.createBuffer(1, Math.ceil(context.sampleRate * .25), context.sampleRate);
      const samples = this.boostNoiseBuffer.getChannelData(0);
      for (let index = 0; index < samples.length; index++) samples[index] = Math.random() * 2 - 1;
    }
    const noise = context.createBufferSource();
    noise.buffer = this.boostNoiseBuffer;
    noise.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(.7, start);
    filter.frequency.setValueAtTime(550 * 6 ** progress, start);
    filter.frequency.exponentialRampToValueAtTime(3300, end);
    const tone = context.createOscillator();
    tone.type = 'triangle';
    tone.frequency.setValueAtTime(180 * 10 ** progress, start);
    tone.frequency.exponentialRampToValueAtTime(1800, end);
    const toneGain = context.createGain();
    toneGain.gain.setValueAtTime(.2, start);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(.18 * (1 - progress), start + Math.min(.015, remaining / 2));
    gain.gain.linearRampToValueAtTime(0, end);
    noise.connect(filter).connect(gain);
    tone.connect(toneGain).connect(gain);
    gain.connect(this.effectsGain);
    const voice = { sources: [noise, tone], nodes: [noise, tone, filter, toneGain, gain], ended: false };
    this.boostVoice = voice;
    tone.onended = () => {
      if (voice.ended) return;
      for (const node of voice.nodes) node.disconnect();
      voice.ended = true;
    };
    for (const source of voice.sources) {
      source.start(start);
      source.stop(end);
    }
  }

  syncPetting() {
    const wanted = this.enabled && this.pettingKind === 'zab' && this.phase === 'playing'
      && this.context?.state === 'running';
    if (!wanted) {
      if (this.pettingSource) {
        this.pettingSource.stop();
        this.pettingSource.disconnect();
        this.pettingSource = null;
      }
      return;
    }
    if (this.pettingSource || this.pettingFailed) return;
    if (!this.pettingBuffer) {
      if (this.pettingLoad) return;
      // A short decoded loop uses the context unlocked by the initial game gesture.
      // Late fetch/decode results check the current petting state before starting.
      this.pettingLoad = fetch(zabPettingTrack).then((response) => {
        if (!response.ok) throw new Error(`Paijausäänen lataus: HTTP ${response.status}`);
        return response.arrayBuffer();
      }).then((bytes) => this.context.decodeAudioData(bytes)).then((buffer) => {
        this.pettingBuffer = buffer;
        this.pettingLoad = null;
        this.syncPetting();
      }).catch((error) => {
        this.pettingLoad = null;
        this.pettingFailed = true;
        console.error('Paijausäänen lataaminen epäonnistui.', error);
      });
      return;
    }
    const source = this.context.createBufferSource();
    source.buffer = this.pettingBuffer;
    source.loop = true;
    source.connect(this.effectsGain);
    source.start();
    this.pettingSource = source;
  }

  syncMusic() {
    if (!this.musicElement) return;
    const track = musicTracks[this.theme] ?? null;
    if (track === this.musicTrack) this.cancelMusicTransition();
    if (track !== this.musicTrack) {
      if (this.wantsMusic() && !this.musicElement.paused && !this.musicRequest && this.musicLevel() > 0) {
        if (!this.musicTransition) {
          this.setMusicLevel(0, FADE_OUT);
          const transition = { timer: null };
          this.musicTransition = transition;
          transition.timer = setTimeout(() => {
            if (this.musicTransition !== transition) return;
            this.musicTransition = null;
            // Rapid choices replace only the destination, never queue extra songs.
            this.replaceMusicTrack(musicTracks[this.theme] ?? null);
            this.syncMusic();
          }, FADE_OUT * 1000);
        }
        return;
      }
      this.cancelMusicTransition();
      this.replaceMusicTrack(track);
    }
    const wanted = this.wantsMusic();
    if (!wanted) {
      this.setMusicLevel(0);
      this.musicElement.pause();
      if (this.musicRequest) this.musicGeneration++;
      this.musicRequest = null;
      return;
    }
    if (this.musicRequest) return;
    if (!this.musicElement.paused) {
      this.setMusicLevel(this.musicVolume(), FADE_IN);
      return;
    }
    this.setMusicLevel(0);
    const request = { generation: this.musicGeneration };
    this.musicRequest = request;
    this.musicElement.play().then(() => {
      if (this.musicRequest === request) {
        this.musicRequest = null;
        if (this.wantsMusic() && !this.musicTransition) this.setMusicLevel(this.musicVolume(), FADE_IN);
      }
      // A delayed play result never changes the scene or issues another play.
      if (!this.wantsMusic()) this.musicElement.pause();
    }, (error) => {
      if (request.generation !== this.musicGeneration) return;
      if (this.musicRequest === request) this.musicRequest = null;
      if (error.name === 'AbortError') return;
      this.musicFailed = true;
      this.musicAutoplayBlocked = error.name === 'NotAllowedError';
      this.syncMusic();
      console.error('Taustamusiikin käynnistäminen epäonnistui.', error);
    });
  }

  replaceMusicTrack(track) {
    this.setMusicLevel(0);
    this.musicElement.pause();
    this.musicGeneration++;
    this.musicRequest = null;
    this.musicTrack = track;
    this.musicFailed = false;
    this.musicAutoplayBlocked = false;
    if (track) this.musicElement.src = track;
    else this.musicElement.removeAttribute('src');
    // load() cancels pending requests for the previous source and resets time.
    this.musicElement.load();
  }

  cancelMusicTransition() {
    if (!this.musicTransition) return;
    clearTimeout(this.musicTransition.timer);
    this.musicTransition = null;
  }

  musicLevel() {
    if (!this.musicEnvelope) return 0;
    const { from, to, start, end } = this.musicEnvelope;
    const time = this.context.currentTime;
    if (time >= end) return to;
    return from + (to - from) * Math.max(0, (time - start) / (end - start));
  }

  musicVolume() {
    return this.theme === 'autumn' ? AUTUMN_MUSIC_VOLUME : MUSIC_VOLUME;
  }

  setMusicLevel(to, duration = 0) {
    const now = this.context.currentTime;
    // Scene refreshes and unlock gestures must not restart an existing envelope.
    if (this.musicEnvelope?.to === to && (duration > 0 || this.musicEnvelope.end <= now)) return;
    const from = this.musicLevel();
    const gain = this.musicGain.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(duration > 0 ? from : to, now);
    if (duration > 0) gain.linearRampToValueAtTime(to, now + duration);
    this.musicEnvelope = { from: duration > 0 ? from : to, to, start: now, end: now + duration };
  }

  wantsMusic() {
    const contextAvailable = this.context?.state === 'running'
      || (this.contextResume && ['suspended', 'interrupted'].includes(this.context?.state));
    return Boolean(this.musicTrack && this.musicEnabled && !this.musicFailed
      && ['ready', 'playing', 'over'].includes(this.phase) && contextAvailable);
  }

  playWinterCombo(level) {
    const context = this.context;
    const start = context.currentTime;
    const root = 110 * 2 ** (level / 12);
    const distortion = context.createWaveShaper();
    distortion.curve = WINTER_COMBO_DISTORTION;
    distortion.oversample = '2x';
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900 + level * 50, start);
    filter.Q.setValueAtTime(.6, start);
    const gain = context.createGain();
    const volume = .034 + level * .002;
    // Two palm-muted power-chord hits: fixed low notes, no bright upward sweep.
    for (const [offset, length, strength] of [[0, .07, 1], [.10, .18, .9]]) {
      const hit = start + offset;
      gain.gain.setValueAtTime(0, hit);
      gain.gain.linearRampToValueAtTime(volume * strength, hit + .003);
      gain.gain.exponentialRampToValueAtTime(volume * strength * .2, hit + length * .4);
      gain.gain.exponentialRampToValueAtTime(.0001, hit + length);
    }
    distortion.connect(filter).connect(gain).connect(this.effectsGain);
    const voices = [1, 1.5].map((ratio) => {
      const voice = context.createOscillator();
      voice.type = 'sawtooth';
      voice.frequency.setValueAtTime(root * ratio, start);
      voice.connect(distortion);
      voice.start(start);
      voice.stop(start + .295);
      return voice;
    });
    let ended = 0;
    for (const voice of voices) voice.onended = () => {
      voice.disconnect();
      if (++ended === voices.length) {
        distortion.disconnect(); filter.disconnect(); gain.disconnect();
      }
    };
  }

  play(event, theme = 'meadow', combo = 0) {
    if (!this.enabled || !this.context || this.context.state !== 'running') return;
    const notes = {
      bounce: [420, 700, .085], satsuma: [530, 1250, .24],
      trap: [180, 90, .18], tap: [340, 410, .035],
      release: [450, 960, .17], slip: [210, 80, .2], over: [330, 220, 1.08],
      gull: [700, 400, .1], trampoline: [180, 1150, .32],
    };
    const note = notes[event];
    if (!note) return;
    let [from, to, duration] = note;
    const comboLevel = (event === 'satsuma' || event === 'trampoline') && combo >= 3 ? Math.min(10, combo) - 3 : null;
    if (theme === 'winter' && comboLevel !== null) {
      this.playWinterCombo(comboLevel);
      return;
    }
    if (comboLevel !== null) {
      // One voice per pickup: a rising, softer bell replaces the ordinary bite.
      from = 660 * 2 ** (comboLevel / 12);
      to = from * 1.5;
      duration = .28;
    }
    const context = this.context;
    const start = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = comboLevel !== null ? 'sine' : isKvlt(theme) ? 'sawtooth' : 'triangle';
    const pitch = isKvlt(theme) ? .55 : 1;
    const volume = comboLevel !== null ? .045 + comboLevel * .003 : isKvlt(theme) ? .027 : .065;
    if (event === 'over') {
      // Three separated descending notes: short "di-dy", then a sustained "dyy".
      for (const [frequency, offset, length] of [[from, 0, .18], [277, .23, .18], [to, .46, .62]]) {
        const noteStart = start + offset;
        oscillator.frequency.setValueAtTime(frequency * pitch, noteStart);
        gain.gain.setValueAtTime(0, noteStart);
        gain.gain.linearRampToValueAtTime(volume, noteStart + .007);
        gain.gain.exponentialRampToValueAtTime(volume * .72, noteStart + length * .55);
        gain.gain.exponentialRampToValueAtTime(.0001, noteStart + length);
      }
    } else {
      oscillator.frequency.setValueAtTime(from * pitch, start);
      oscillator.frequency.exponentialRampToValueAtTime(to * pitch, start + duration);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(volume, start + .007);
      gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    }
    oscillator.connect(gain).connect(this.effectsGain);
    oscillator.start(start);
    oscillator.stop(start + duration + .015);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
}
