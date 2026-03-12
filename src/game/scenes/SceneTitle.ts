import Phaser from 'phaser';
import { buildAudioCueKey, registerAudioAssets } from '../audio/manifest';
import { GAME_HEIGHT, GAME_WIDTH } from '../constants';
import { getGameSettings } from '../settings';
import { fetchHighScores, type HighScoreEntry } from '../services/highScoreService';
import { clearHudSnapshot } from '../ui/hudState';
import { getActiveGamepad } from '../utils/getActiveGamepad';

type InstructionRow = {
  icon: string;
  text: string;
};

export class SceneTitle extends Phaser.Scene {
  private launchGame?: () => void;
  private confirmPressedLastFrame = false;
  private highScoreText?: Phaser.GameObjects.Text;
  private highScoreStatusText?: Phaser.GameObjects.Text;
  private highScoreBrokenIcon?: Phaser.GameObjects.Text;

  constructor() {
    super('title');
  }

  preload(): void {
    registerAudioAssets(this);
    this.load.image('title-hero', '/icons/hero.png');
    this.load.image('title-skull', '/icons/skull.png');
    this.load.image('title-sword', '/icons/sword.png');
    this.load.image('title-apple', '/icons/apple.png');
    this.load.image('title-torch', '/icons/torch.png');
    this.load.image('title-key', '/icons/key.png');
    this.load.image('title-boot', '/icons/boot.png');
  }

  create(): void {
    clearHudSnapshot();
    this.cameras.main.setBackgroundColor('#000000');
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000);

    this.drawTitle();
    this.drawHeroBand();
    this.drawInstructionPanel();
    this.drawHighScorePanel();
    this.drawStartPrompt();

    const launch = () => {
      const soundManager = this.sound as Phaser.Sound.BaseSoundManager & {
        unlock?: () => void;
        context?: AudioContext;
        locked?: boolean;
      };
      if (soundManager.locked && typeof soundManager.unlock === 'function') {
        soundManager.unlock();
      }
      if (soundManager.context && soundManager.context.state === 'suspended') {
        void soundManager.context.resume().catch(() => {
          // Ignore resume failures; the browser may require another gesture.
        });
      }

      const soundMode = getGameSettings().soundMode;
      const startCueKey = buildAudioCueKey(soundMode, 'start');
      if (this.cache.audio.exists(startCueKey)) {
        this.sound.play(startCueKey);
      }
      this.scene.start('world');
    };

    this.launchGame = launch;
    this.input.keyboard?.once('keydown-ENTER', launch);
    this.input.keyboard?.once('keydown-SPACE', launch);
    this.input.once('pointerdown', launch);

    void this.loadHighScores();
  }

  update(): void {
    if (!this.launchGame) {
      return;
    }

    const confirmPressed = this.isGamepadConfirmPressed();
    if (confirmPressed && !this.confirmPressedLastFrame) {
      this.launchGame();
    }

    this.confirmPressedLastFrame = confirmPressed;
  }

  private drawTitle(): void {
    this.add.text(GAME_WIDTH / 2, 112, 'LE FOU DU ROI', {
      fontFamily: 'Georgia',
      fontSize: '86px',
      color: '#6b1d00',
      stroke: '#2c0900',
      strokeThickness: 14,
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 100, 'LE FOU DU ROI', {
      fontFamily: 'Georgia',
      fontSize: '86px',
      color: '#ffc82e',
      stroke: '#d46b00',
      strokeThickness: 8,
      shadow: {
        color: '#fff0a8',
        blur: 0,
        fill: false,
        offsetX: 0,
        offsetY: 0,
      },
    }).setOrigin(0.5);
  }

  private drawHeroBand(): void {
    const leftSkull = this.add.image(310, 288, 'title-skull');
    leftSkull.setScale(Math.min(100 / leftSkull.width, 100 / leftSkull.height));

    const hero = this.add.image(GAME_WIDTH / 2, 300, 'title-hero');
    hero.setScale(Math.min(190 / hero.width, 190 / hero.height));

    const rightSkull = this.add.image(970, 288, 'title-skull');
    rightSkull.setScale(Math.min(100 / rightSkull.width, 100 / rightSkull.height));

    this.tweens.add({
      targets: hero,
      y: 308,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private drawInstructionPanel(): void {
    const headerY = 430;
    const startY = 516;
    const rowGap = 58;
    const iconX = 146;
    const textX = 215;

    this.add.text(350, headerY, 'INSTRUCTIONS', {
      fontFamily: 'Courier New',
      fontSize: '40px',
      color: '#ffc82e',
      stroke: '#704000',
      strokeThickness: 5,
    }).setOrigin(0.5);

    this.add.rectangle(350, headerY + 42, 410, 4, 0xffc82e).setOrigin(0.5);

    const rows: InstructionRow[] = [
      { icon: 'title-sword', text: 'Élimine les ennemis' },
      { icon: 'title-apple', text: 'Reste en vie' },
      { icon: 'title-torch', text: 'Manque pas de lumière' },
      { icon: 'title-key', text: 'Trouve les 9 clés' },
      { icon: 'title-boot', text: 'Cours plus vite' },
    ];

    rows.forEach((row, index) => {
      const y = startY + index * rowGap;
      const icon = this.add.image(iconX, y, row.icon);
      icon.setScale(Math.min(54 / icon.width, 54 / icon.height));

      this.add.text(textX, y, row.text, {
        fontFamily: 'Courier New',
        fontSize: '30px',
        color: '#fff7c5',
      }).setOrigin(0, 0.5);
    });
  }

  private drawHighScorePanel(): void {
    const headerY = 430;

    this.add.text(924, headerY, 'HIGH SCORES', {
      fontFamily: 'Courier New',
      fontSize: '40px',
      color: '#ffc82e',
      stroke: '#704000',
      strokeThickness: 5,
    }).setOrigin(0.5);

    this.highScoreBrokenIcon = this.add.text(1088, headerY + 2, '', {
      fontFamily: 'Courier New',
      fontSize: '24px',
      color: '#ff8a6b',
    }).setOrigin(0.5);

    this.add.rectangle(924, headerY + 42, 390, 4, 0xffc82e).setOrigin(0.5);

    this.highScoreStatusText = this.add.text(924, 482, 'CHARGEMENT...', {
      fontFamily: 'Courier New',
      fontSize: '20px',
      color: '#fff7c5',
    }).setOrigin(0.5);

    this.highScoreText = this.add.text(924, 508, '', {
      fontFamily: 'Courier New',
      fontSize: '32px',
      color: '#fff7c5',
      lineSpacing: 4,
    }).setOrigin(0.5, 0);
  }

  private drawStartPrompt(): void {
    const prompt = this.add.text(GAME_WIDTH / 2, 852, '> PÈSE SUR LE BOUTON POUR START', {
      fontFamily: 'Courier New',
      fontSize: '38px',
      color: '#ffc82e',
      stroke: '#704000',
      strokeThickness: 5,
    }).setOrigin(0.5);

    this.tweens.add({
      targets: prompt,
      alpha: 0.2,
      duration: 420,
      yoyo: true,
      repeat: -1,
    });
  }

  private isGamepadConfirmPressed(): boolean {
    const pad = getActiveGamepad(this.input);
    if (!pad) {
      return false;
    }

    return pad.A || pad.isButtonDown(9);
  }

  private async loadHighScores(): Promise<void> {
    try {
      const scores = await fetchHighScores(5);
      this.highScoreBrokenIcon?.setText('');
      this.renderHighScores(scores);
    } catch {
      this.highScoreStatusText?.setText('');
      this.highScoreBrokenIcon?.setText('📡');
      this.highScoreText?.setText('1. ------  000000\n2. ------  000000\n3. ------  000000\n4. ------  000000\n5. ------  000000');
    }
  }

  private renderHighScores(scores: HighScoreEntry[]): void {
    if (!this.highScoreStatusText || !this.highScoreText) {
      return;
    }

    this.highScoreStatusText.setText('');

    if (scores.length === 0) {
      this.highScoreText.setText('1. ------  000000\n2. ------  000000\n3. ------  000000\n4. ------  000000\n5. ------  000000');
      return;
    }

    const lines = Array.from({ length: 5 }, (_, index) => {
      const entry = scores[index];
      if (!entry) {
        return `${index + 1}. ------  000000`;
      }

      return `${index + 1}. ${entry.name.padEnd(6, ' ')}  ${String(entry.score).padStart(6, '0')}`;
    });

    this.highScoreText.setText(lines.join('\n\n'));
  }
}
