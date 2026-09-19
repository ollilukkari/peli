const isKvlt = (theme) => theme === 'kvlt' || theme === 'winter';
const summerTrack = new URL('../assets/audio/summer-platformer.mp3', import.meta.url).href;
const autumnTrack = new URL('../assets/audio/kalm-mjork.mp3', import.meta.url).href;
const winterTrack = new URL('../assets/audio/frozen-minor.mp3', import.meta.url).href;
const musicTracks = { meadow: summerTrack, autumn: autumnTrack, winter: winterTrack, kvlt: winterTrack };
const MUSIC_VOLUME = .3;
const AUTUMN_MUSIC_VOLUME = MUSIC_VOLUME * 1.1;
const FADE_OUT = .12;
const FADE_IN = .18;

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
      this.context.addEventListener('statechange', () => this.syncMusic());
    }
    if (this.musicAutoplayBlocked) {
      this.musicFailed = false;
      this.musicAutoplayBlocked = false;
    }
    if (['suspended', 'interrupted'].includes(this.context.state) && !this.contextResume) {
      const resumed = () => { this.contextResume = null; this.syncMusic(); };
      this.contextResume = this.context.resume().then(resumed, resumed);
    }
    // Call media.play() inside the gesture too, while AudioContext resumes.
    this.syncMusic();
  }

  setEnabled(value) {
    this.enabled = value;
    if (this.effectsGain) this.effectsGain.gain.setValueAtTime(value ? 1 : 0, this.context.currentTime);
    if (value) this.unlock();
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

  play(event, theme = 'meadow') {
    if (!this.enabled || !this.context || this.context.state !== 'running') return;
    const notes = {
      bounce: [420, 700, .085], satsuma: [530, 1250, .24],
      trap: [180, 90, .18], tap: [340, 410, .035],
      release: [450, 960, .17], slip: [210, 80, .2], over: [330, 220, 1.08],
      gull: [700, 400, .1],
    };
    const note = notes[event];
    if (!note) return;
    const [from, to, duration] = note;
    const context = this.context;
    const start = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = isKvlt(theme) ? 'sawtooth' : 'triangle';
    const pitch = isKvlt(theme) ? .55 : 1;
    const volume = isKvlt(theme) ? .027 : .065;
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
