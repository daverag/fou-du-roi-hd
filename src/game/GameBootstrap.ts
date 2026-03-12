import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './constants';
import { SceneGameOver } from './scenes/SceneGameOver';
import { SceneTitle } from './scenes/SceneTitle';
import { SceneWorld } from './scenes/SceneWorld';

export class GameBootstrap {
  readonly game: Phaser.Game;

  constructor(parent: string | HTMLElement) {
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      backgroundColor: '#000000',
      input: {
        gamepad: true,
      },
      scene: [SceneTitle, SceneWorld, SceneGameOver],
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      render: {
        pixelArt: false,
        antialias: true,
      },
    });
  }

  refreshScale(): void {
    this.game.scale.refresh();
  }
}
