const isKvlt = (theme) => theme === 'kvlt' || theme === 'winter';
const summerTrack = new URL('../assets/audio/summer-platformer.mp3', import.meta.url).href;
const autumnTrack = new URL('../assets/audio/kalm-mjork.mp3', import.meta.url).href;
const winterTrack = new URL('../assets/audio/frozen-minor.mp3', import.meta.url).href;
const musicTracks = { meadow: summerTrack, autumn: autumnTrack, winter: winterTrack, kvlt: winterTrack };

export class GameAudio {
  constructor(enabled = true, musicEnabled = true) {
    this.enabled = enabled;
    this.musicEnabled = musicEnabled;
    this.context = null;
    this.contextResume = null;
    this.master = null;
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
  }

  unlock() {
    if (!this.enabled) return;
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.connect(this.context.destination);
      // One streaming element avoids decoding several long songs into PCM buffers.
      this.musicElement = new Audio();
      this.musicElement.loop = true;
      this.musicElement.preload = 'none';
      this.musicSource = this.context.createMediaElementSource(this.musicElement);
      this.musicGain = this.context.createGain();
      this.musicSource.connect(this.musicGain).connect(this.master);
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
    if (this.master) this.master.gain.setValueAtTime(value ? 1 : 0, this.context.currentTime);
    if (value) this.unlock();
    else this.syncMusic();
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
    if (track !== this.musicTrack) {
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
    const wanted = this.wantsMusic();
    this.musicGain.gain.setValueAtTime(wanted ? .3 : 0, this.context.currentTime);
    if (!wanted) {
      this.musicElement.pause();
      if (this.musicRequest) this.musicGeneration++;
      this.musicRequest = null;
      return;
    }
    if (this.musicRequest || !this.musicElement.paused) return;
    const request = { generation: this.musicGeneration };
    this.musicRequest = request;
    this.musicElement.play().then(() => {
      if (this.musicRequest === request) this.musicRequest = null;
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

  wantsMusic() {
    const contextAvailable = this.context?.state === 'running'
      || (this.contextResume && ['suspended', 'interrupted'].includes(this.context?.state));
    return Boolean(this.musicTrack && this.enabled && this.musicEnabled && !this.musicFailed
      && ['ready', 'playing', 'over'].includes(this.phase) && contextAvailable);
  }

  play(event, theme = 'meadow') {
    if (!this.enabled || !this.context || this.context.state !== 'running') return;
    const notes = {
      bounce: [420, 700, .085], satsuma: [530, 1250, .24],
      trap: [180, 90, .18], tap: [340, 410, .035],
      release: [450, 960, .17], slip: [210, 80, .2], over: [280, 70, .42],
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
    oscillator.frequency.setValueAtTime(from * pitch, start);
    oscillator.frequency.exponentialRampToValueAtTime(to * pitch, start + duration);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(isKvlt(theme) ? .027 : .065, start + .007);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + duration + .015);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
}
