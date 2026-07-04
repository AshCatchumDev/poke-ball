// Web Audio API Sound Synthesizer for Poke Ball (Procedural Retro Audio)
const SoundEffects = {
  ctx: null,
  masterGain: null,
  muted: false,

  // Lazy initialize AudioContext on user interaction
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : 1, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    } catch (e) {
      console.warn("Web Audio API not supported on this browser:", e);
    }
  },

  toggleMute() {
    this.muted = !this.muted;
    console.log("audio.js: toggleMute called. New muted state:", this.muted);
    if (this.ctx && this.masterGain) {
      try {
        this.masterGain.gain.value = this.muted ? 0 : 1;
        console.log("audio.js: Set masterGain.gain.value to:", this.masterGain.gain.value);
      } catch (err) {
        console.error("audio.js: Error setting masterGain.gain.value:", err);
      }
    }
    return this.muted;
  },

  playKick() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.masterGain || this.ctx.destination);

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.12);
  },

  playJump() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.masterGain || this.ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(100, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(320, this.ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  },

  playBounce() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.masterGain || this.ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  },

  playSpecial(type) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const duration = 0.5;

    switch (type) {
      case 'pikachu': // Thunderbolt (Electric buzz / oscillation)
        const oscP = this.ctx.createOscillator();
        const gainP = this.ctx.createGain();
        oscP.connect(gainP);
        gainP.connect(this.masterGain || this.ctx.destination);

        oscP.type = 'sawtooth';
        oscP.frequency.setValueAtTime(1200, now);
        for (let i = 0; i < 10; i++) {
          oscP.frequency.setValueAtTime(1200 - (i % 2) * 800, now + (i * 0.04));
        }
        
        gainP.gain.setValueAtTime(0.12, now);
        gainP.gain.linearRampToValueAtTime(0.01, now + duration);

        oscP.start();
        oscP.stop(now + duration);
        break;

      case 'charmander': // Fire Blast (White Noise / sweep)
        // Synthesizing fire sound using a bandpass filter sweep on white noise
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(200, now);
        filter.frequency.exponentialRampToValueAtTime(1500, now + 0.2);
        filter.frequency.exponentialRampToValueAtTime(100, now + duration);

        const gainC = this.ctx.createGain();
        gainC.gain.setValueAtTime(0.25, now);
        gainC.gain.exponentialRampToValueAtTime(0.01, now + duration);

        noise.connect(filter);
        filter.connect(gainC);
        gainC.connect(this.masterGain || this.ctx.destination);

        noise.start();
        noise.stop(now + duration);
        break;

      case 'squirtle': // Water Gun (Bubbling sweep)
        const oscS = this.ctx.createOscillator();
        const gainS = this.ctx.createGain();
        oscS.connect(gainS);
        gainS.connect(this.masterGain || this.ctx.destination);

        oscS.type = 'sine';
        oscS.frequency.setValueAtTime(300, now);
        oscS.frequency.linearRampToValueAtTime(900, now + duration);

        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(25, now);
        lfoGain.gain.setValueAtTime(50, now);

        lfo.connect(lfoGain);
        lfoGain.connect(oscS.frequency);

        gainS.gain.setValueAtTime(0.2, now);
        gainS.gain.exponentialRampToValueAtTime(0.01, now + duration);

        lfo.start();
        oscS.start();
        lfo.stop(now + duration);
        oscS.stop(now + duration);
        break;

      case 'bulbasaur': // Vine Whip (Whip swoosh / snap)
        const oscB = this.ctx.createOscillator();
        const gainB = this.ctx.createGain();
        oscB.connect(gainB);
        gainB.connect(this.masterGain || this.ctx.destination);

        oscB.type = 'triangle';
        oscB.frequency.setValueAtTime(800, now);
        oscB.frequency.exponentialRampToValueAtTime(150, now + 0.15);

        gainB.gain.setValueAtTime(0.25, now);
        gainB.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

        oscB.start();
        oscB.stop(now + 0.18);
        break;

      default: // Default generic magical swoop sound for new characters
        const oscDef = this.ctx.createOscillator();
        const gainDef = this.ctx.createGain();
        oscDef.connect(gainDef);
        gainDef.connect(this.masterGain || this.ctx.destination);

        oscDef.type = 'triangle';
        oscDef.frequency.setValueAtTime(400, now);
        oscDef.frequency.exponentialRampToValueAtTime(800, now + duration);

        gainDef.gain.setValueAtTime(0.15, now);
        gainDef.gain.exponentialRampToValueAtTime(0.01, now + duration);

        oscDef.start();
        oscDef.stop(now + duration);
        break;
    }
  },

  playGoal() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    
    // Play an 8-bit fanfare (a quick series of notes)
    const playNote = (freq, start, duration) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.masterGain || this.ctx.destination);

      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, start);
      
      gain.gain.setValueAtTime(0.12, start);
      gain.gain.exponentialRampToValueAtTime(0.01, start + duration - 0.02);

      osc.start(start);
      osc.stop(start + duration);
    };

    const notes = [261.63, 329.63, 392.00, 523.25, 392.00, 523.25]; // C E G C G C
    const durations = [0.15, 0.15, 0.15, 0.3, 0.15, 0.5];
    
    let time = now;
    for (let i = 0; i < notes.length; i++) {
      playNote(notes[i], time, durations[i]);
      time += durations[i] - 0.05;
    }
  },

  playGameOver() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    
    const playNote = (freq, start, duration) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.masterGain || this.ctx.destination);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      
      gain.gain.setValueAtTime(0.15, start);
      gain.gain.exponentialRampToValueAtTime(0.01, start + duration - 0.05);

      osc.start(start);
      osc.stop(start + duration);
    };

    const notes = [392.00, 349.23, 311.13, 246.94]; // G F Eb B
    const durations = [0.25, 0.25, 0.25, 0.7];
    
    let time = now;
    for (let i = 0; i < notes.length; i++) {
      playNote(notes[i], time, durations[i]);
      time += durations[i];
    }
  },

  playEvoChargingStart() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.masterGain || this.ctx.destination);
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 1.5);
    
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 1.5);
    
    osc.start();
    osc.stop(now + 1.5);
  },

  playEvoChargingLoop() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    
    const now = this.ctx.currentTime;
    for (let i = 0; i < 20; i++) {
      const t = now + i * 0.12;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.masterGain || this.ctx.destination);
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400 + i * 40, t);
      osc.frequency.linearRampToValueAtTime(800 + i * 40, t + 0.1);
      
      gain.gain.setValueAtTime(0.06, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      
      osc.start(t);
      osc.stop(t + 0.1);
    }
  },

  playEvoSuccessFanfare() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    
    const now = this.ctx.currentTime;
    
    const bufferSize = this.ctx.sampleRate * 0.8;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, now);
    filter.frequency.exponentialRampToValueAtTime(50, now + 0.8);
    
    const gainN = this.ctx.createGain();
    gainN.gain.setValueAtTime(0.4, now);
    gainN.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
    
    noise.connect(filter);
    filter.connect(gainN);
    gainN.connect(this.masterGain || this.ctx.destination);
    noise.start();
    noise.stop(now + 0.8);

    const playNote = (freq, start, duration) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.masterGain || this.ctx.destination);
      
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, start);
      
      gain.gain.setValueAtTime(0.12, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      
      osc.start(start);
      osc.stop(start + duration);
    };

    const notes = [523.25, 659.25, 783.99, 1046.50, 783.99, 1046.50, 1318.51];
    const durations = [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.6];
    
    let time = now + 0.1;
    for (let i = 0; i < notes.length; i++) {
      playNote(notes[i], time, durations[i]);
      time += durations[i] * 0.8;
    }
  }
};
