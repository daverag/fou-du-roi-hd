import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../constants';
import { getActiveGamepad } from '../utils/getActiveGamepad';

export class SceneTitle extends Phaser.Scene {
  private launchGame?: () => void;
  private confirmPressedLastFrame = false;

  constructor() {
    super('title');
  }

  create(): void {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x090512);
    this.add.circle(GAME_WIDTH / 2, 180, 220, 0x4c2f75, 0.3);
    this.add.text(GAME_WIDTH / 2, 210, 'LE FOU DU ROI', {
      fontFamily: 'Trebuchet MS',
      fontSize: '74px',
      color: '#ffe7a4',
      stroke: '#2c1620',
      strokeThickness: 10,
    }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 300, 'Vertical slice HD', {
      fontFamily: 'Trebuchet MS',
      fontSize: '30px',
      color: '#f1c0a2',
    }).setOrigin(0.5);

    const body = [
      '9 salles dans une grille 3x3',
      'Trouve les 9 clés pour ouvrir les cages centrales',
      'Pomme = vie, Torche = vision, Epee = masques vulnérables',
      'Les masques deviennent invisibles quand ta lumière tombe à zéro',
      'Les flèches bufferisent les virages comme dans Pac-Man',
    ];

    body.forEach((line, index) => {
      this.add.text(GAME_WIDTH / 2, 410 + index * 42, line, {
        fontFamily: 'Trebuchet MS',
        fontSize: '28px',
        color: '#ddd8ff',
      }).setOrigin(0.5);
    });

    const start = this.add.text(GAME_WIDTH / 2, 760, 'Appuie sur ENTREE, ESPACE ou A/START pour jouer', {
      fontFamily: 'Trebuchet MS',
      fontSize: '34px',
      color: '#ffe7a4',
      stroke: '#20101d',
      strokeThickness: 6,
    }).setOrigin(0.5);

    this.tweens.add({
      targets: start,
      alpha: 0.35,
      duration: 720,
      yoyo: true,
      repeat: -1,
    });

    const launch = () => {
      this.scene.start('world');
    };

    this.launchGame = launch;
    this.input.keyboard?.once('keydown-ENTER', launch);
    this.input.keyboard?.once('keydown-SPACE', launch);
    this.input.once('pointerdown', launch);
  }

  update(): void {
    if (!this.launchGame) {
      return;
    }

    const confirmPressed = this.isGamepadConfirmPressed();

    if (confirmPressed && !this.confirmPressedLastFrame) {
      console.info('[gamepad][title] confirm pressed');
      this.launchGame();
    }

    this.confirmPressedLastFrame = confirmPressed;
  }

  private isGamepadConfirmPressed(): boolean {
    const pad = getActiveGamepad(this.input);

    if (!pad) {
      return false;
    }

    return pad.A || pad.isButtonDown(9);
  }
}
