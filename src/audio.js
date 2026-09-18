// Original oscillator effects; no downloaded samples or external audio requests.
export class GameAudio {
  constructor(enabled = true) { this.enabled = enabled; this.context = null; }
  unlock() {
    if (!this.enabled) return;
    if (!this.context) this.context = new AudioContext();
    if (this.context.state === 'suspended') this.context.resume().catch(() => {});
  }
  setEnabled(value) { this.enabled = value; if (value) this.unlock(); }
  play(event, theme = 'meadow') {
    if (!this.enabled || !this.context || this.context.state !== 'running') return;
    const notes = {
      bounce: [420, 700, .085], satsuma: [530, 1250, .24],
      trap: [180, 90, .18], tap: [340, 410, .035],
      release: [450, 960, .17], slip: [210, 80, .2], over: [280, 70, .42],
    };
    const note = notes[event];
    if (!note) return;
    const [from, to, duration] = note;
    const context = this.context;
    const start = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = theme !== 'meadow' ? 'sawtooth' : 'triangle';
    const pitch = theme !== 'meadow' ? .55 : 1;
    oscillator.frequency.setValueAtTime(from * pitch, start);
    oscillator.frequency.exponentialRampToValueAtTime(to * pitch, start + duration);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(theme !== 'meadow' ? .027 : .065, start + .007);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + .015);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
}
