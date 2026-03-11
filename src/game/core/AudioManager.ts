type ToneConfig = {
  frequency: number;
  durationMs: number;
  type?: OscillatorType;
  gain?: number;
  attackMs?: number;
  releaseMs?: number;
  slideTo?: number;
};

export class AudioManager {
  private context?: AudioContext;
  private enabled = false;

  unlock(): void {
    if (this.context) {
      if (this.context.state === 'suspended') {
        void this.context.resume();
      }
      return;
    }

    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) {
      return;
    }

    this.context = new AudioContextCtor();
  }

  private playTone(config: ToneConfig): void {
    if (!this.context || !this.enabled) {
      return;
    }

    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();

    osc.type = config.type ?? 'square';
    osc.frequency.setValueAtTime(config.frequency, now);
    if (config.slideTo) {
      osc.frequency.linearRampToValueAtTime(config.slideTo, now + config.durationMs / 1000);
    }

    const maxGain = config.gain ?? 0.04;
    const attack = (config.attackMs ?? 10) / 1000;
    const release = (config.releaseMs ?? 80) / 1000;
    const endTime = now + config.durationMs / 1000;

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(maxGain, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, endTime + release);

    osc.connect(gain);
    gain.connect(this.context.destination);
    osc.start(now);
    osc.stop(endTime + release);
  }

  playEvent(eventName: string): void {
    if (!this.enabled) {
      return;
    }

    switch (eventName) {
      case 'key':
        this.playTone({ frequency: 660, durationMs: 140, slideTo: 920, gain: 0.05 });
        break;
      case 'apple':
        this.playTone({ frequency: 440, durationMs: 220, type: 'triangle', slideTo: 520, gain: 0.045 });
        break;
      case 'torch':
        this.playTone({ frequency: 540, durationMs: 180, type: 'sawtooth', slideTo: 720, gain: 0.035 });
        break;
      case 'sword':
        this.playTone({ frequency: 780, durationMs: 260, type: 'square', slideTo: 340, gain: 0.05 });
        break;
      case 'enemy':
        this.playTone({ frequency: 300, durationMs: 180, type: 'square', slideTo: 150, gain: 0.055 });
        break;
      case 'hurt':
        this.playTone({ frequency: 220, durationMs: 400, type: 'sawtooth', slideTo: 110, gain: 0.06 });
        break;
      case 'win':
        this.playTone({ frequency: 523, durationMs: 160, type: 'triangle', slideTo: 784, gain: 0.05 });
        window.setTimeout(() => this.playTone({ frequency: 784, durationMs: 240, type: 'triangle', slideTo: 1046, gain: 0.05 }), 120);
        break;
      case 'gameover':
        this.playTone({ frequency: 260, durationMs: 500, type: 'square', slideTo: 90, gain: 0.05 });
        break;
      default:
        break;
    }
  }

  tickMove(speedRatio: number): void {
    if (!this.context || !this.enabled || speedRatio <= 0) {
      return;
    }

    if (Math.random() > 0.15) {
      return;
    }

    this.playTone({
      frequency: 250 + speedRatio * 70,
      durationMs: 40,
      type: 'square',
      gain: 0.012,
      attackMs: 4,
      releaseMs: 18,
    });
  }
}
