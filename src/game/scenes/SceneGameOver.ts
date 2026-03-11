import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../constants';

export class SceneGameOver extends Phaser.Scene {
  private returnToTitle?: () => void;
  private confirmPressedLastFrame = false;

  constructor() {
    super('gameover');
  }

  create(data: { victory?: boolean; score?: number }): void {
    const victory = data.victory ?? false;
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, victory ? 0x1b1b0a : 0x12070d);

    this.add.text(GAME_WIDTH / 2, 270, victory ? 'MONDE COMPLETE' : 'GAME OVER', {
      fontFamily: 'Trebuchet MS',
      fontSize: '84px',
      color: victory ? '#fff0aa' : '#ffb3aa',
      stroke: '#2a1116',
      strokeThickness: 12,
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 420, `Score ${String(data.score ?? 0).padStart(6, '0')}`, {
      fontFamily: 'Trebuchet MS',
      fontSize: '46px',
      color: '#f0ebff',
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 520, victory ? 'Les 9 cages sont ouvertes.' : 'Le royaume a perdu son fou.', {
      fontFamily: 'Trebuchet MS',
      fontSize: '30px',
      color: '#dbcff0',
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 700, 'Appuie sur ESPACE, ENTREE ou A/START pour retourner au titre', {
      fontFamily: 'Trebuchet MS',
      fontSize: '32px',
      color: '#ffe7a4',
    }).setOrigin(0.5);

    this.returnToTitle = () => this.scene.start('title');
    this.input.keyboard?.once('keydown-SPACE', this.returnToTitle);
    this.input.keyboard?.once('keydown-ENTER', this.returnToTitle);
  }

  update(): void {
    if (!this.returnToTitle) {
      return;
    }

    const confirmPressed = this.isGamepadConfirmPressed();

    if (confirmPressed && !this.confirmPressedLastFrame) {
      this.returnToTitle();
    }

    this.confirmPressedLastFrame = confirmPressed;
  }

  private isGamepadConfirmPressed(): boolean {
    const pad = this.input.gamepad?.getPad(0);

    if (!pad?.connected) {
      return false;
    }

    return pad.A || pad.isButtonDown(9);
  }
}
