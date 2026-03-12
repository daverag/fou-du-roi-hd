import Phaser from 'phaser';
import type { SoundMode } from '../settings';
import { resolveAssetUrl } from '../utils/assetUrl';

export type AudioCueName =
  | 'key'
  | 'apple'
  | 'torch'
  | 'sword'
  | 'enemy'
  | 'hurt'
  | 'win'
  | 'gameover'
  | 'start'
  | 'step';

export type AudioManifest = Record<SoundMode, Partial<Record<AudioCueName, string[]>>>;

// Drop real files in /public/audio/... and register them here.
export const AUDIO_MANIFEST: AudioManifest = {
  modern: {
    key: ['/sfx/key.mp3'],
    apple: ['/sfx/eat.mp3'],
    torch: ['/sfx/powerup.mp3'],
    sword: ['/sfx/powerup.mp3'],
    enemy: ['/sfx/eat.mp3'],
    win: ['/sfx/powerup.mp3'],
    hurt: ['/sfx/die.mp3'],
    gameover: ['/sfx/die.mp3'],
    start: ['/sfx/start.mp3'],
  },
  retro: {
    key: ['/sfx/retro/key.wav'],
    apple: ['/sfx/retro/pickup.wav'],
    torch: ['/sfx/retro/powerup.wav'],
    sword: ['/sfx/retro/powerup.wav'],
    win: ['/sfx/retro/powerup.wav'],
    enemy: ['/sfx/retro/eat.wav'],
    hurt: ['/sfx/retro/die.wav'],
    gameover: ['/sfx/retro/die.wav'],
  },
};

export function buildAudioCueKey(mode: SoundMode, cueName: AudioCueName): string {
  return `audio-${mode}-${cueName}`;
}

export function registerAudioAssets(scene: Phaser.Scene): void {
  (Object.entries(AUDIO_MANIFEST) as Array<[SoundMode, Partial<Record<AudioCueName, string[]>>]>).forEach(([mode, cues]) => {
    (Object.entries(cues) as Array<[AudioCueName, string[] | undefined]>).forEach(([cueName, sources]) => {
      if (!sources || sources.length === 0) {
        return;
      }

      scene.load.audio(buildAudioCueKey(mode, cueName), sources.map((source) => resolveAssetUrl(source)));
    });
  });
}
