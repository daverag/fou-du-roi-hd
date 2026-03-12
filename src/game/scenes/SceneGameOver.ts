import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../constants';
import { fetchHighScores, submitHighScore, type HighScoreEntry } from '../services/highScoreService';
import { clearHudSnapshot } from '../ui/hudState';
import { getActiveGamepad } from '../utils/getActiveGamepad';

type GameOverPalette = {
  background: string;
  outerFrame: number;
  innerFrame: number;
  panelFill: number;
  panelGlow: number;
  title: string;
  titleShadow: string;
  accent: string;
  primaryText: string;
  inputText: string;
};

const GAME_OVER_PALETTES: Record<'victory' | 'defeat', GameOverPalette> = {
  victory: {
    background: '#0c1008',
    outerFrame: 0x151b0d,
    innerFrame: 0x32401c,
    panelFill: 0x111708,
    panelGlow: 0xf6da7a,
    title: '#ffe082',
    titleShadow: '#6e4d00',
    accent: '#f6da7a',
    primaryText: '#fff5cf',
    inputText: '#fff0a8',
  },
  defeat: {
    background: '#12060a',
    outerFrame: 0x1a0a0f,
    innerFrame: 0x4a1722,
    panelFill: 0x12070b,
    panelGlow: 0xffc82e,
    title: '#ffb36b',
    titleShadow: '#6b1d00',
    accent: '#ffc82e',
    primaryText: '#fff1d1',
    inputText: '#ffd78a',
  },
};

const PLAYER_NAME_STORAGE_KEY = 'fou-du-roi-player-name';
const MAX_PLAYER_NAME_LENGTH = 12;

export class SceneGameOver extends Phaser.Scene {
  private static readonly DEFAULT_NAME = 'PLAYER';
  private static readonly MAX_NAME_LENGTH = MAX_PLAYER_NAME_LENGTH;

  private returnToTitle?: () => void;
  private confirmPressedLastFrame = false;
  private namePromptText?: Phaser.GameObjects.Text;
  private returnPromptText?: Phaser.GameObjects.Text;
  private saveStatusText?: Phaser.GameObjects.Text;
  private leaderboardText?: Phaser.GameObjects.Text;
  private nameText?: Phaser.GameObjects.Text;
  private cursorText?: Phaser.GameObjects.Text;
  private playerName = loadStoredPlayerName();
  private hasSubmittedScore = false;
  private saveFinished = false;
  private highScoreServiceAvailable = true;
  private onKeyboardInput?: (event: KeyboardEvent) => void;

  constructor() {
    super('gameover');
  }

  create(data: { victory?: boolean; score?: number; worldReached?: number }): void {
    clearHudSnapshot();
    const victory = data.victory ?? false;
    const score = data.score ?? 0;
    const worldReached = data.worldReached ?? 1;
    const palette = victory ? GAME_OVER_PALETTES.victory : GAME_OVER_PALETTES.defeat;

    this.cameras.main.setBackgroundColor(palette.background);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, palette.outerFrame);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 1100, 820, palette.innerFrame);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 1064, 784, palette.panelFill);
    this.add.rectangle(GAME_WIDTH / 2, 120, 440, 6, palette.panelGlow, 0.95).setOrigin(0.5);
    this.add.rectangle(GAME_WIDTH / 2, 200, 440, 2, palette.panelGlow, 0.65).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 160, victory ? 'WORLD COMPLETE' : 'GAME OVER', {
      fontFamily: 'Courier New',
      fontSize: '72px',
      color: palette.title,
      stroke: palette.titleShadow,
      strokeThickness: 8,
      align: 'center',
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 250, `SCORE ${String(score).padStart(6, '0')}`, {
      fontFamily: 'Courier New',
      fontSize: '42px',
      color: palette.primaryText,
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 316, `WORLD ${String(worldReached).padStart(2, '0')}`, {
      fontFamily: 'Courier New',
      fontSize: '28px',
      color: palette.accent,
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 408, 'ENTER YOUR NAME', {
      fontFamily: 'Courier New',
      fontSize: '30px',
      color: palette.accent,
    }).setOrigin(0.5);

    this.add.rectangle(GAME_WIDTH / 2, 486, 360, 60, palette.innerFrame, 0.92);
    this.add.rectangle(GAME_WIDTH / 2, 486, 344, 44, 0xffffff, 0.08);
    this.add.rectangle(GAME_WIDTH / 2, 486, 360, 60).setStrokeStyle(2, palette.panelGlow, 0.55);
    this.nameText = this.add.text(GAME_WIDTH / 2, 486, '', {
      fontFamily: 'Courier New',
      fontSize: '34px',
      color: palette.inputText,
      align: 'center',
    }).setOrigin(0.5);
    this.cursorText = this.add.text(GAME_WIDTH / 2 + 8, 486, '_', {
      fontFamily: 'Courier New',
      fontSize: '34px',
      color: palette.inputText,
    }).setOrigin(0, 0.5);

    this.tweens.add({
      targets: this.cursorText,
      alpha: 0,
      duration: 320,
      yoyo: true,
      repeat: -1,
    });

    this.namePromptText = this.add.text(GAME_WIDTH / 2, 548, 'TYPE LETTERS / DIGITS THEN PRESS ENTER', {
      fontFamily: 'Courier New',
      fontSize: '22px',
      color: palette.primaryText,
    }).setOrigin(0.5);

    this.saveStatusText = this.add.text(GAME_WIDTH / 2, 616, 'WAITING FOR NAME', {
      fontFamily: 'Courier New',
      fontSize: '24px',
      color: palette.accent,
      align: 'center',
    }).setOrigin(0.5);

    this.leaderboardText = this.add.text(GAME_WIDTH / 2, 694, '', {
      fontFamily: 'Courier New',
      fontSize: '24px',
      color: palette.primaryText,
      align: 'center',
      lineSpacing: 8,
    }).setOrigin(0.5, 0);

    this.returnPromptText = this.add.text(GAME_WIDTH / 2, 914, 'PRESS ENTER AGAIN TO RETURN TO TITLE', {
      fontFamily: 'Courier New',
      fontSize: '28px',
      color: palette.accent,
      stroke: palette.titleShadow,
      strokeThickness: 4,
    }).setOrigin(0.5);

    this.returnToTitle = () => this.scene.start('title');
    this.input.keyboard?.on('keydown-ENTER', () => {
      if (!this.highScoreServiceAvailable) {
        this.returnToTitle?.();
        return;
      }

      if (!this.hasSubmittedScore) {
        void this.persistScore({
          name: this.playerName || SceneGameOver.DEFAULT_NAME,
          score,
          victory,
          worldReached,
        });
        return;
      }

      if (this.saveFinished) {
        this.returnToTitle?.();
      }
    });

    this.onKeyboardInput = (event: KeyboardEvent) => this.handleKeyboardInput(event);
    this.input.keyboard?.on('keydown', this.onKeyboardInput);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.onKeyboardInput) {
        this.input.keyboard?.off('keydown', this.onKeyboardInput);
      }
    });
    this.refreshNameDisplay();
    void this.detectHighScoreAvailability();
  }

  update(): void {
    if (!this.returnToTitle) {
      return;
    }

    const confirmPressed = this.isGamepadConfirmPressed();
    if (confirmPressed && !this.confirmPressedLastFrame) {
      if (!this.highScoreServiceAvailable) {
        this.returnToTitle();
      } else if (this.hasSubmittedScore && this.saveFinished) {
        this.returnToTitle();
      }
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

  private handleKeyboardInput(event: KeyboardEvent): void {
    if (this.hasSubmittedScore || !this.highScoreServiceAvailable) {
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      return;
    }

    if (event.key === 'Backspace') {
      this.playerName = this.playerName.slice(0, -1);
      persistPlayerName(this.playerName);
      this.refreshNameDisplay();
      return;
    }

    if (!/^[a-zA-Z0-9]$/.test(event.key)) {
      return;
    }

    this.playerName = (this.playerName + event.key.toUpperCase()).slice(0, SceneGameOver.MAX_NAME_LENGTH);
    persistPlayerName(this.playerName);
    this.refreshNameDisplay();
  }

  private refreshNameDisplay(): void {
    this.nameText?.setText(this.playerName || SceneGameOver.DEFAULT_NAME);
  }

  private async detectHighScoreAvailability(): Promise<void> {
    try {
      await fetchHighScores(1);
    } catch {
      this.highScoreServiceAvailable = false;
      this.hasSubmittedScore = true;
      this.saveFinished = true;
      this.saveStatusText?.setText('SCORE SERVER OFFLINE  PRESS ENTER');
      this.leaderboardText?.setText('NO CONNECTION TO SCORE SERVER');
      this.namePromptText?.setText('SERVER OFFLINE');
      this.returnPromptText?.setText('PRESS ENTER TO RETURN TO TITLE');
      this.cursorText?.setVisible(false);
    }
  }

  private async persistScore(payload: { name: string; score: number; victory: boolean; worldReached: number }): Promise<void> {
    if (this.hasSubmittedScore || !this.saveStatusText || !this.leaderboardText) {
      return;
    }

    this.hasSubmittedScore = true;
    persistPlayerName(payload.name);
    this.saveStatusText.setText('SAVING SCORE...');

    try {
      const result = await submitHighScore(payload);
      this.saveFinished = true;
      this.saveStatusText.setText(result.insertedRank ? `RANK ${String(result.insertedRank).padStart(2, '0')}  PRESS ENTER` : 'SCORE SAVED  PRESS ENTER');
      this.leaderboardText.setText(this.formatLeaderboard(result.scores));
    } catch {
      this.saveFinished = true;
      this.saveStatusText.setText('SAVE FAILED  PRESS ENTER');
      this.leaderboardText.setText('NO CONNECTION TO SCORE SERVER');
    }
  }

  private formatLeaderboard(scores: HighScoreEntry[]): string {
    if (scores.length === 0) {
      return 'NO SCORES';
    }

    return scores
      .slice(0, 5)
      .map((entry, index) => `${String(index + 1).padStart(2, '0')}  ${entry.name.padEnd(12, ' ')}  ${String(entry.score).padStart(6, '0')}`)
      .join('\n');
  }
}

function loadStoredPlayerName(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    const raw = window.localStorage.getItem(PLAYER_NAME_STORAGE_KEY) ?? '';
    return raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, MAX_PLAYER_NAME_LENGTH);
  } catch {
    return '';
  }
}

function persistPlayerName(name: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const sanitizedName = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, MAX_PLAYER_NAME_LENGTH);
    if (sanitizedName) {
      window.localStorage.setItem(PLAYER_NAME_STORAGE_KEY, sanitizedName);
    }
  } catch {
    // Ignore storage failures and keep the in-memory value.
  }
}
