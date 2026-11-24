export class AudioEngine {
  constructor(muted = false) {
    this.muted = muted;
    this.context = null;
    this.noiseBuffer = null;
  }

  unlock() {
    if (this.muted) return;
    this.ensure();
    if (this.context?.state === 'suspended') this.context.resume().catch(() => {});
  }

  ensure() {
    if (this.context || this.muted) return this.context;
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return null;
    this.context = new Context();
    const length = Math.floor(this.context.sampleRate * 0.12);
    this.noiseBuffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    return this.context;
  }

  setMuted(muted) {
    this.muted = muted;
    if (!muted) this.unlock();
  }

  tone(frequency, duration, volume, type = 'sine', endFrequency = frequency, delay = 0) {
    const ctx = this.ensure();
    if (!ctx || this.muted) return;
    const start = ctx.currentTime + delay;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.01);
  }

  bell(frequency = 1600, volume = 0.09, duration = 0.35, delay = 0) {
    this.tone(frequency, duration, volume, 'sine', frequency, delay);
    this.tone(frequency * 2.01, duration * 0.7, volume * 0.3, 'sine', frequency * 2.01, delay);
    this.tone(frequency * 2.76, duration * 0.45, volume * 0.12, 'sine', frequency * 2.76, delay);
  }

  bubblePop(frequency, volume = 0.06, duration = 0.085, delay = 0) {
    const ctx = this.ensure();
    if (!ctx || this.muted || !this.noiseBuffer) return;
    const start = ctx.currentTime + delay;
    const pitch = frequency * (0.94 + Math.random() * 0.12);
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(pitch, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(60, pitch * 0.32), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.01);

    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const noiseGain = ctx.createGain();
    source.buffer = this.noiseBuffer;
    filter.type = 'bandpass';
    filter.frequency.value = 1700 + Math.random() * 500;
    filter.Q.value = 0.8;
    noiseGain.gain.setValueAtTime(volume * 0.42, start);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.028);
    source.connect(filter).connect(noiseGain).connect(ctx.destination);
    source.start(start);
    source.stop(start + 0.03);
  }

  shoot(automatic = false) {
    this.bubblePop(automatic ? 560 : 440, automatic ? 0.034 : 0.055, automatic ? 0.065 : 0.085);
  }

  hit() {
    this.bubblePop(880, 0.075, 0.075);
    this.bubblePop(1320, 0.025, 0.05, 0.025);
  }

  miss() {
    this.bubblePop(220, 0.022, 0.06);
  }

  empty() {
    this.bubblePop(180, 0.02, 0.04);
  }

  countdown(number = 3) {
    if (number === 0) {
      this.bell(2093, 0.1, 0.28);
      return;
    }
    const frequency = { 3: 880, 2: 1175, 1: 1568 }[number] || 1040;
    this.bell(frequency, 0.065, 0.16);
    this.tone(frequency, 0.09, 0.035, 'sine', frequency * 1.5);
  }

  finish() {
    this.tone(420, 0.22, 0.055, 'sine', 520);
    this.tone(630, 0.24, 0.045, 'sine', 760, 0.12);
    this.tone(840, 0.26, 0.04, 'sine', 1020, 0.24);
  }
}
