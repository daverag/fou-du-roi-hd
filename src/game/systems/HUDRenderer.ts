import Phaser from 'phaser';
import { MAX_GAUGE, WORLD_GRID_SIZE } from '../constants';
import type { GaugeValues, RoomCoord, WorldProgress } from '../types';

type GridCellVisual = {
  frame: Phaser.GameObjects.Rectangle;
  fill: Phaser.GameObjects.Rectangle;
};

type GaugeBarVisual = {
  fill: Phaser.GameObjects.Rectangle;
  top: number;
  maxHeight: number;
};

export class HUDRenderer {
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly scoreText: Phaser.GameObjects.Text;
  private readonly roomText: Phaser.GameObjects.Text;
  private readonly virtueIcon: Phaser.GameObjects.Image;
  private readonly magicBootIcon: Phaser.GameObjects.Image;
  private readonly gaugeBars: Record<keyof GaugeValues, GaugeBarVisual>;
  private readonly roomGrid: GridCellVisual[] = [];
  private readonly lifeIcons: Phaser.GameObjects.Image[] = [];

  constructor(private readonly scene: Phaser.Scene) {
    const sidebarX = 1120;
    const panelWidth = 138;
    const worldPanelY = 94;
    const scorePanelX = 446;
    const scorePanelY = 846;
    const scorePanelWidth = 352;
    const scorePanelHeight = 96;
    const gaugeStartX = sidebarX - 38;
    const gaugeY = 330;
    const gaugeSpacing = 38;

    this.track(this.scene.add.rectangle(sidebarX, 328, panelWidth, 572, 0x09040d, 0.84));
    this.track(this.scene.add.rectangle(sidebarX, 150, panelWidth - 10, 2, 0xffffff, 0.08));
    this.track(this.scene.add.rectangle(sidebarX, 272, panelWidth - 10, 2, 0xffffff, 0.08));
    this.track(this.scene.add.rectangle(scorePanelX, scorePanelY, scorePanelWidth, scorePanelHeight, 0x140508, 0.96));
    this.track(this.scene.add.rectangle(scorePanelX, scorePanelY, scorePanelWidth - 18, scorePanelHeight - 18, 0xffffff, 0.03));
    this.track(this.scene.add.rectangle(sidebarX - 22, worldPanelY, 42, 40, 0xffffff, 0.04));

    this.track(this.scene.add.text(scorePanelX - 112, scorePanelY - 25, 'SCORE', {
      fontFamily: 'Courier New',
      fontSize: '18px',
      color: '#ffe7a4',
      stroke: '#3a180b',
      strokeThickness: 4,
    }).setOrigin(0.5));

    this.track(this.scene.add.text(scorePanelX + 104, scorePanelY - 25, 'VIES', {
      fontFamily: 'Courier New',
      fontSize: '18px',
      color: '#ffe7a4',
      stroke: '#3a180b',
      strokeThickness: 4,
    }).setOrigin(0.5));

    this.track(this.scene.add.rectangle(scorePanelX + 28, scorePanelY, 2, scorePanelHeight - 26, 0xffffff, 0.08));

    this.scoreText = this.track(this.scene.add.text(scorePanelX - 95, scorePanelY + 8, '000000', {
      fontFamily: 'Courier New',
      fontSize: '46px',
      color: '#ffe3c4',
      stroke: '#4a0c08',
      strokeThickness: 8,
    }).setOrigin(0.5));

    this.roomText = this.track(this.scene.add.text(sidebarX - 22, worldPanelY, '1', {
      fontFamily: 'Courier New',
      fontSize: '28px',
      color: '#ffe7a4',
      stroke: '#4a0c08',
      strokeThickness: 6,
    }).setOrigin(0.5));

    this.virtueIcon = this.track(this.scene.add.image(sidebarX + 24, worldPanelY, 'virtue-shield'));
    this.virtueIcon.setScale(Math.min(42 / this.virtueIcon.width, 42 / this.virtueIcon.height));

    this.magicBootIcon = this.track(this.scene.add.image(72, 888, 'icon-magic-boot'));
    this.magicBootIcon.setScale(Math.min(46 / this.magicBootIcon.width, 46 / this.magicBootIcon.height));
    this.magicBootIcon.setVisible(false);

    this.gaugeBars = {
      sword: this.createGaugeBar(gaugeStartX, gaugeY, 0xe8e8ef),
      life: this.createGaugeBar(gaugeStartX + gaugeSpacing, gaugeY, 0x84f05d),
      light: this.createGaugeBar(gaugeStartX + gaugeSpacing * 2, gaugeY, 0xf2e65c),
    };
    this.createGaugeIcons(gaugeStartX, gaugeY, gaugeSpacing);

    for (let index = 0; index < 9; index += 1) {
      const col = index % WORLD_GRID_SIZE;
      const row = Math.floor(index / WORLD_GRID_SIZE);
      const x = 1088 + col * 22;
      const y = 194 + row * 22;
      const frame = this.track(this.scene.add.rectangle(x, y, 18, 18, 0xffffff, 0.07).setOrigin(0, 0));
      const fill = this.track(this.scene.add.rectangle(x + 3, y + 3, 12, 12, 0x702219).setOrigin(0, 0));
      this.roomGrid.push({ frame, fill });
    }

    for (let index = 0; index < 6; index += 1) {
      const row = Math.floor(index / 3);
      const col = index % 3;
      const icon = this.track(this.scene.add.image(scorePanelX + 84 + col * 30, scorePanelY - 6 + row * 26, 'icon-heart'));
      icon.setScale(Math.min(28 / icon.width, 28 / icon.height));
      icon.setVisible(false);
      this.lifeIcons.push(icon);
    }
  }

  render(
    progress: WorldProgress,
    gauges: GaugeValues,
    roomNumber: number,
    virtueIconKey: string,
    currentRoom: RoomCoord,
    roomsWithGoal: boolean[],
    roomsUnlocked: boolean[],
  ): void {
    this.scoreText.setText(progress.score.toString().padStart(6, '0'));
    this.lifeIcons.forEach((icon, index) => {
      icon.setVisible(index < progress.lives);
    });
    this.magicBootIcon.setVisible(progress.hasMagicBoot);
    this.roomText.setText(String(roomNumber));
    this.virtueIcon.setTexture(virtueIconKey);
    this.virtueIcon.setScale(Math.min(42 / this.virtueIcon.width, 42 / this.virtueIcon.height));
    this.renderGauges(gauges);
    this.renderRoomGrid(currentRoom, roomsWithGoal, roomsUnlocked);
  }

  private createGaugeBar(x: number, y: number, color: number): GaugeBarVisual {
    this.track(this.scene.add.rectangle(x, y, 26, 214, 0x6f1b15).setOrigin(0, 0));
    const top = y + 6;
    const maxHeight = 200;
    const fill = this.track(this.scene.add.rectangle(x + 5, top, 16, maxHeight, color).setOrigin(0, 0));
    return { fill, top, maxHeight };
  }

  private createGaugeIcons(gaugeStartX: number, gaugeY: number, gaugeSpacing: number): void {
    const iconY = gaugeY + 234;
    this.createGaugeIcon('icon-sword', gaugeStartX + 13, iconY, 24);
    this.createGaugeIcon('icon-apple', gaugeStartX + gaugeSpacing + 13, iconY, 24);
    this.createGaugeIcon('icon-torch', gaugeStartX + gaugeSpacing * 2 + 13, iconY, 24);
  }

  private createGaugeIcon(key: string, x: number, y: number, size: number): void {
    const icon = this.track(this.scene.add.image(x, y, key));
    icon.setScale(Math.min(size / icon.width, size / icon.height));
  }

  destroy(): void {
    this.objects.forEach((object) => object.destroy());
    this.objects.length = 0;
  }

  private track<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.objects.push(object);
    return object;
  }

  private renderGauges(gauges: GaugeValues): void {
    for (const [key, value] of Object.entries(gauges) as [keyof GaugeValues, number][]) {
      const ratio = Phaser.Math.Clamp(value / MAX_GAUGE, 0, 1);
      const height = this.gaugeBars[key].maxHeight * ratio;
      this.gaugeBars[key].fill.height = height;
      this.gaugeBars[key].fill.y = this.gaugeBars[key].top + (this.gaugeBars[key].maxHeight - height);
    }
  }

  private renderRoomGrid(currentRoom: RoomCoord, roomsWithGoal: boolean[], roomsUnlocked: boolean[]): void {
    this.roomGrid.forEach((cell, index) => {
      const col = index % WORLD_GRID_SIZE;
      const row = Math.floor(index / WORLD_GRID_SIZE);
      const isCurrent = col === currentRoom.x && row === currentRoom.y;
      const hasGoal = roomsWithGoal[index] ?? false;
      const isUnlocked = roomsUnlocked[index] ?? false;

      cell.fill.setFillStyle(
        isCurrent ? 0x84f05d : hasGoal ? 0xffd36b : isUnlocked ? 0x6bb7ff : 0x702219,
        1,
      );
      cell.frame.setFillStyle(
        isCurrent ? 0xffffff : hasGoal ? 0xffffff : isUnlocked ? 0xffffff : 0xffffff,
        isCurrent ? 0.18 : hasGoal ? 0.12 : isUnlocked ? 0.1 : 0.05,
      );
    });
  }
}
