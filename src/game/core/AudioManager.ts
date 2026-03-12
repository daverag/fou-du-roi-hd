import Phaser from 'phaser';
import { buildAudioCueKey, type AudioCueName } from '../audio/manifest';
import { getGameSettings } from '../settings';

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
  constructor(private readonly scene: Phaser.Scene) {}

  private context?: AudioContext;
  private enabled = false;

  unlock(): void {
    ensurePhaserSoundReady(this.scene);

    if (this.context) {
      if (this.context.state === 'suspended') {
        void this.context.resume();
      }
      this.enabled = true;
      return;
    }

    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) {
      return;
    }

    this.context = new AudioContextCtor();
    this.enabled = true;
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
    const soundMode = getGameSettings().soundMode;
    if (this.playAssetCue(soundMode, eventName as AudioCueName)) {
      return;
    }

    if (!this.enabled) {
      return;
    }

    if (soundMode === 'retro') {
      this.playRetroEvent(eventName);
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
    if (speedRatio <= 0) {
      return;
    }

    const soundMode = getGameSettings().soundMode;
    if (this.playAssetCue(soundMode, 'step')) {
      return;
    }

    if (!this.context || !this.enabled) {
      return;
    }

    if (soundMode === 'retro') {
      if (Math.random() > 0.12) {
        return;
      }

      this.playTone({
        frequency: 180 + speedRatio * 45,
        durationMs: 28,
        type: 'square',
        gain: 0.01,
        attackMs: 2,
        releaseMs: 12,
      });
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

  private playRetroEvent(eventName: string): void {
    switch (eventName) {
      case 'key':
        this.playTone({ frequency: 880, durationMs: 90, type: 'square', slideTo: 1320, gain: 0.045, attackMs: 2, releaseMs: 26 });
        break;
      case 'apple':
        this.playTone({ frequency: 520, durationMs: 110, type: 'square', slideTo: 650, gain: 0.038, attackMs: 2, releaseMs: 24 });
        break;
      case 'torch':
        this.playTone({ frequency: 420, durationMs: 100, type: 'square', slideTo: 560, gain: 0.034, attackMs: 2, releaseMs: 22 });
        break;
      case 'sword':
        this.playTone({ frequency: 980, durationMs: 120, type: 'square', slideTo: 360, gain: 0.046, attackMs: 1, releaseMs: 18 });
        break;
      case 'enemy':
        this.playTone({ frequency: 240, durationMs: 140, type: 'square', slideTo: 120, gain: 0.048, attackMs: 2, releaseMs: 24 });
        break;
      case 'hurt':
        this.playTone({ frequency: 210, durationMs: 180, type: 'square', slideTo: 90, gain: 0.052, attackMs: 2, releaseMs: 28 });
        break;
      case 'win':
        this.playTone({ frequency: 660, durationMs: 100, type: 'square', slideTo: 990, gain: 0.043, attackMs: 2, releaseMs: 20 });
        window.setTimeout(() => this.playTone({ frequency: 990, durationMs: 130, type: 'square', slideTo: 1320, gain: 0.043, attackMs: 2, releaseMs: 22 }), 90);
        break;
      case 'gameover':
        this.playTone({ frequency: 260, durationMs: 260, type: 'square', slideTo: 70, gain: 0.05, attackMs: 2, releaseMs: 34 });
        break;
      default:
        break;
    }
  }

  private playAssetCue(soundMode: ReturnType<typeof getGameSettings>['soundMode'], cueName: AudioCueName): boolean {
    const key = buildAudioCueKey(soundMode, cueName);
    if (!this.scene.cache.audio.exists(key)) {
      return false;
    }

    if (cueName === 'step' && Math.random() > 0.18) {
      return false;
    }

    ensurePhaserSoundReady(this.scene);
    return this.scene.sound.play(key);
  }
}

function ensurePhaserSoundReady(scene: Phaser.Scene): void {
  const soundManager = scene.sound as Phaser.Sound.BaseSoundManager & {
    unlock?: () => void;
    context?: AudioContext;
    locked?: boolean;
  };

  if (soundManager.locked && typeof soundManager.unlock === 'function') {
    soundManager.unlock();
  }

  if (soundManager.context && soundManager.context.state === 'suspended') {
    void soundManager.context.resume().catch(() => {
      // Ignore resume failures; caller may fall back or retry on next interaction.
    });
  }
}
