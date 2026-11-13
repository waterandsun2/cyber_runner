/**
 * Web Audio API synthesizer for sci-fi runner game.
 * Completely procedural: zero external asset 404 dependencies, runs anywhere.
 */

class SoundSystem {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private musicInterval: number | null = null;
  private musicStep: number = 0;
  private isMusicPlaying: boolean = false;

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  // Coin collect sound: crystal sci-fi chime
  public playCoin() {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';

      // Arpeggio chime notes
      osc1.frequency.setValueAtTime(987.77, now); // B5
      osc1.frequency.exponentialRampToValueAtTime(1318.51, now + 0.08); // E6
      osc1.frequency.exponentialRampToValueAtTime(1975.53, now + 0.16); // B6

      osc2.frequency.setValueAtTime(1318.51, now);
      osc2.frequency.exponentialRampToValueAtTime(2637.02, now + 0.16); // E7

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.28);
      osc2.stop(now + 0.28);
    } catch {
      // AudioContext policy fallback
    }
  }

  // Jump sound: futuristic upward thruster swoosh
  public playJump() {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(580, now + 0.22);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(600, now);
      filter.frequency.exponentialRampToValueAtTime(2400, now + 0.22);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    } catch {
      // Ignore
    }
  }

  // Obstacle hit sound: laser impact + low rumble explosion
  public playHit() {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;

      // Noise buffer for explosion
      const bufferSize = this.ctx.sampleRate * 0.35;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(800, now);
      filter.frequency.exponentialRampToValueAtTime(120, now + 0.35);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.35, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

      // Low bass sub thump
      const subOsc = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      subOsc.type = 'sawtooth';
      subOsc.frequency.setValueAtTime(160, now);
      subOsc.frequency.exponentialRampToValueAtTime(35, now + 0.3);
      subGain.gain.setValueAtTime(0.3, now);
      subGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

      whiteNoise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);

      subOsc.connect(subGain);
      subGain.connect(this.ctx.destination);

      whiteNoise.start(now);
      subOsc.start(now);
      whiteNoise.stop(now + 0.35);
      subOsc.stop(now + 0.35);
    } catch {
      // Ignore
    }
  }

  // Game over sound: dramatic descending digital powering-down sweep
  public playGameOver() {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(65, now + 0.8);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.85);
    } catch {
      // Ignore
    }
  }

  // Lane switch whoosh
  public playSwitch() {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(620, now + 0.08);

      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.09);
    } catch {
      // Ignore
    }
  }

  // Continuous background sci-fi synthwave beat generator
  public startMusic() {
    if (this.isMusicPlaying) return;
    this.initContext();
    this.isMusicPlaying = true;
    this.musicStep = 0;

    const tempo = 126; // BPM
    const stepInterval = (60 / tempo / 4) * 1000; // 16th notes ~ 119ms

    // Cyber bass pattern: Root frequencies (F2, G#2, D#2, C2)
    const bassScale = [
      87.31, 87.31, 103.83, 87.31,
      116.54, 87.31, 103.83, 130.81,
      77.78, 77.78, 92.50, 77.78,
      103.83, 77.78, 92.50, 116.54
    ];

    const chordPads = [
      [349.23, 440.0, 523.25], // F minor
      [311.13, 392.0, 466.16], // Eb major
    ];

    this.musicInterval = window.setInterval(() => {
      if (this.isMuted || !this.ctx || this.ctx.state !== 'running') {
        this.musicStep = (this.musicStep + 1) % 16;
        return;
      }

      const now = this.ctx.currentTime;
      const step = this.musicStep;

      // 1. Synthwave Kick on beat 1, 5, 9, 13
      if (step % 4 === 0) {
        const kickOsc = this.ctx.createOscillator();
        const kickGain = this.ctx.createGain();
        kickOsc.frequency.setValueAtTime(130, now);
        kickOsc.frequency.exponentialRampToValueAtTime(38, now + 0.1);
        kickGain.gain.setValueAtTime(0.22, now);
        kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        kickOsc.connect(kickGain);
        kickGain.connect(this.ctx.destination);
        kickOsc.start(now);
        kickOsc.stop(now + 0.12);
      }

      // 2. Snare / Clap on beat 4, 12
      if (step === 4 || step === 12) {
        const noiseLen = 0.1;
        const bSize = this.ctx.sampleRate * noiseLen;
        const nBuffer = this.ctx.createBuffer(1, bSize, this.ctx.sampleRate);
        const data = nBuffer.getChannelData(0);
        for (let i = 0; i < bSize; i++) data[i] = (Math.random() * 2 - 1) * 0.5;

        const src = this.ctx.createBufferSource();
        src.buffer = nBuffer;
        const sFilter = this.ctx.createBiquadFilter();
        sFilter.type = 'highpass';
        sFilter.frequency.setValueAtTime(1200, now);
        const sGain = this.ctx.createGain();
        sGain.gain.setValueAtTime(0.12, now);
        sGain.gain.exponentialRampToValueAtTime(0.001, now + noiseLen);
        src.connect(sFilter);
        sFilter.connect(sGain);
        sGain.connect(this.ctx.destination);
        src.start(now);
        src.stop(now + noiseLen);
      }

      // 3. Hi-hat on offbeats
      if (step % 2 === 1) {
        const hSize = this.ctx.sampleRate * 0.04;
        const hBuffer = this.ctx.createBuffer(1, hSize, this.ctx.sampleRate);
        const hData = hBuffer.getChannelData(0);
        for (let i = 0; i < hSize; i++) hData[i] = (Math.random() * 2 - 1) * 0.2;

        const hSrc = this.ctx.createBufferSource();
        hSrc.buffer = hBuffer;
        const hFilter = this.ctx.createBiquadFilter();
        hFilter.type = 'highpass';
        hFilter.frequency.setValueAtTime(6000, now);
        const hGain = this.ctx.createGain();
        hGain.gain.setValueAtTime(0.04, now);
        hGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        hSrc.connect(hFilter);
        hFilter.connect(hGain);
        hGain.connect(this.ctx.destination);
        hSrc.start(now);
        hSrc.stop(now + 0.04);
      }

      // 4. Arpeggiated Cyber Bassline
      const freq = bassScale[step];
      const bassOsc = this.ctx.createOscillator();
      const bassFilter = this.ctx.createBiquadFilter();
      const bassGain = this.ctx.createGain();

      bassOsc.type = 'sawtooth';
      bassOsc.frequency.setValueAtTime(freq, now);

      bassFilter.type = 'lowpass';
      bassFilter.frequency.setValueAtTime(650, now);
      bassFilter.frequency.exponentialRampToValueAtTime(220, now + 0.1);

      bassGain.gain.setValueAtTime(0.12, now);
      bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      bassOsc.connect(bassFilter);
      bassFilter.connect(bassGain);
      bassGain.connect(this.ctx.destination);

      bassOsc.start(now);
      bassOsc.stop(now + 0.1);

      // 5. Ambient Cyber Synth Pad chords every 8 steps
      if (step === 0 || step === 8) {
        const chord = chordPads[step === 0 ? 0 : 1];
        chord.forEach((f) => {
          if (!this.ctx) return;
          const padOsc = this.ctx.createOscillator();
          const padGain = this.ctx.createGain();
          padOsc.type = 'sine';
          padOsc.frequency.setValueAtTime(f, now);
          padGain.gain.setValueAtTime(0.025, now);
          padGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
          padOsc.connect(padGain);
          padGain.connect(this.ctx.destination);
          padOsc.start(now);
          padOsc.stop(now + 0.8);
        });
      }

      this.musicStep = (this.musicStep + 1) % 16;
    }, stepInterval);
  }

  public stopMusic() {
    if (this.musicInterval !== null) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
    this.isMusicPlaying = false;
  }
}

export const soundSystem = new SoundSystem();
