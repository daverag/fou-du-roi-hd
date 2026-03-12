import { subscribeToGameSettings, updateGameSettings, type SoundMode } from '../game/settings';
import type { GameLayoutState } from '../game/layout';
import type { HudSnapshot } from '../game/ui/hudState';
import { resolveAssetUrl } from '../game/utils/assetUrl';

type GaugeKey = keyof HudSnapshot['gauges'];

const GAUGE_META: { key: GaugeKey; alt: string }[] = [
  { key: 'sword', alt: 'Epee' },
  { key: 'life', alt: 'Vie' },
  { key: 'light', alt: 'Lumiere' },
];

const DEFAULT_GAUGE_ICONS: HudSnapshot['gaugeIcons'] = {
  sword: resolveAssetUrl('/icons/sword.png'),
  life: resolveAssetUrl('/icons/apple.png'),
  light: resolveAssetUrl('/icons/torch.png'),
};

export class AppShell {
  readonly root: HTMLDivElement;
  readonly hudHost: HTMLDivElement;
  readonly desktopSidebarHost: HTMLDivElement;
  readonly desktopFooterHost: HTMLDivElement;
  readonly viewport: HTMLDivElement;
  readonly gameHost: HTMLDivElement;
  readonly controlsHost: HTMLDivElement;
  readonly settingsButton: HTMLButtonElement;

  private readonly topRow: HTMLDivElement;
  private readonly worldValue: HTMLSpanElement;
  private readonly mobileVirtueIcon: HTMLImageElement;
  private readonly scoreValue: HTMLSpanElement;
  private readonly mapCells: HTMLSpanElement[];
  private readonly livesValue: HTMLDivElement;
  private readonly bootBadge: HTMLSpanElement;
  private readonly gaugeFills: Record<GaugeKey, HTMLSpanElement>;
  private readonly gaugeIcons: Record<GaugeKey, HTMLImageElement>;
  private readonly desktopWorldLabel: HTMLSpanElement;
  private readonly desktopWorldNumber: HTMLSpanElement;
  private readonly desktopVirtueName: HTMLSpanElement;
  private readonly desktopVirtueIcon: HTMLImageElement;
  private readonly desktopMapCells: HTMLSpanElement[];
  private readonly desktopGaugeFills: Record<GaugeKey, HTMLSpanElement>;
  private readonly desktopGaugeIcons: Record<GaugeKey, HTMLImageElement>;
  private readonly desktopScoreValue: HTMLSpanElement;
  private readonly desktopBootBadge: HTMLSpanElement;
  private readonly desktopLivesValue: HTMLDivElement;
  private readonly settingsModal: HTMLDivElement;
  private readonly modernSoundInput: HTMLInputElement;
  private readonly retroSoundInput: HTMLInputElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'app-shell';

    this.hudHost = document.createElement('div');
    this.hudHost.className = 'app-shell__hud';

    this.desktopSidebarHost = document.createElement('div');
    this.desktopSidebarHost.className = 'app-shell__desktop-sidebar';

    this.desktopFooterHost = document.createElement('div');
    this.desktopFooterHost.className = 'app-shell__desktop-footer';

    this.viewport = document.createElement('div');
    this.viewport.className = 'app-shell__viewport';

    this.gameHost = document.createElement('div');
    this.gameHost.className = 'app-shell__game';
    this.viewport.append(this.gameHost);

    this.controlsHost = document.createElement('div');
    this.controlsHost.className = 'app-shell__controls';

    const settingsButton = document.createElement('button');
    settingsButton.type = 'button';
    settingsButton.className = 'app-shell__settings-button';
    settingsButton.setAttribute('aria-label', 'Ouvrir les settings');
    settingsButton.textContent = '⚙';
    this.settingsButton = settingsButton;

    const topRow = document.createElement('div');
    topRow.className = 'mobile-hud__top-row';
    this.topRow = topRow;

    const scoreCard = document.createElement('div');
    scoreCard.className = 'mobile-hud__metric mobile-hud__metric--score';
    const mobileWorldHeader = document.createElement('div');
    mobileWorldHeader.className = 'mobile-hud__world-header';
    const mobileVirtueIcon = document.createElement('img');
    mobileVirtueIcon.className = 'mobile-hud__world-icon';
    mobileVirtueIcon.alt = '';
    const worldValue = document.createElement('span');
    worldValue.className = 'mobile-hud__world';
    mobileWorldHeader.append(mobileVirtueIcon, worldValue);
    const scoreValue = document.createElement('span');
    scoreValue.className = 'mobile-hud__value';
    scoreCard.append(mobileWorldHeader, scoreValue);
    this.worldValue = worldValue;
    this.mobileVirtueIcon = mobileVirtueIcon;
    this.scoreValue = scoreValue;
    const mapCard = document.createElement('div');
    mapCard.className = 'mobile-hud__metric mobile-hud__metric--map';
    const mapGrid = document.createElement('div');
    mapGrid.className = 'mobile-hud__map';
    this.mapCells = Array.from({ length: 9 }, () => {
      const cell = document.createElement('span');
      cell.className = 'mobile-hud__map-cell';
      mapGrid.append(cell);
      return cell;
    });
    mapCard.append(mapGrid);
    const livesCard = document.createElement('div');
    livesCard.className = 'mobile-hud__metric mobile-hud__metric--lives';

    const livesRow = document.createElement('div');
    livesRow.className = 'mobile-hud__lives';
    this.livesValue = livesRow;
    livesCard.append(livesRow);

    const gauges = document.createElement('div');
    gauges.className = 'mobile-hud__gauges';
    const mobileGaugeRows = Object.fromEntries(
      GAUGE_META.map(({ key, alt }) => [key, this.createGaugeRow(gauges, key, alt)]),
    ) as Record<GaugeKey, { fill: HTMLSpanElement; icon: HTMLImageElement }>;
    this.gaugeFills = Object.fromEntries(
      Object.entries(mobileGaugeRows).map(([key, value]) => [key, value.fill]),
    ) as Record<GaugeKey, HTMLSpanElement>;
    this.gaugeIcons = Object.fromEntries(
      Object.entries(mobileGaugeRows).map(([key, value]) => [key, value.icon]),
    ) as Record<GaugeKey, HTMLImageElement>;

    this.bootBadge = document.createElement('span');
    this.bootBadge.className = 'mobile-hud__badge';
    const bootIcon = document.createElement('img');
    bootIcon.className = 'mobile-hud__inline-icon';
    bootIcon.src = resolveAssetUrl('/icons/boot.png');
    bootIcon.alt = 'Bottes magiques';
    this.bootBadge.append(bootIcon);
    topRow.append(scoreCard, mapCard, livesCard, this.bootBadge);

    const desktopWorldCard = document.createElement('div');
    desktopWorldCard.className = 'desktop-hud__panel desktop-hud__panel--world';
    const desktopWorldHeader = document.createElement('div');
    desktopWorldHeader.className = 'desktop-hud__world-header';
    const desktopWorldNumberCard = document.createElement('div');
    desktopWorldNumberCard.className = 'desktop-hud__world-number-card';
    const desktopWorldLabel = document.createElement('span');
    desktopWorldLabel.className = 'desktop-hud__world-label';
    desktopWorldLabel.textContent = 'DONJON';
    const desktopWorldNumber = document.createElement('span');
    desktopWorldNumber.className = 'desktop-hud__world-number';
    const desktopVirtueIcon = document.createElement('img');
    desktopVirtueIcon.className = 'desktop-hud__virtue-icon';
    desktopVirtueIcon.alt = '';
    desktopWorldNumberCard.append(desktopWorldLabel, desktopWorldNumber);
    desktopWorldHeader.append(desktopWorldNumberCard, desktopVirtueIcon);
    const desktopVirtueName = document.createElement('span');
    desktopVirtueName.className = 'desktop-hud__virtue-name';
    desktopWorldCard.append(desktopWorldHeader, desktopVirtueName);
    this.desktopWorldLabel = desktopWorldLabel;
    this.desktopWorldNumber = desktopWorldNumber;
    this.desktopVirtueIcon = desktopVirtueIcon;
    this.desktopVirtueName = desktopVirtueName;

    const desktopMapCard = document.createElement('div');
    desktopMapCard.className = 'desktop-hud__panel desktop-hud__panel--map';
    const desktopMap = document.createElement('div');
    desktopMap.className = 'desktop-hud__map';
    this.desktopMapCells = Array.from({ length: 9 }, () => {
      const cell = document.createElement('span');
      cell.className = 'desktop-hud__map-cell';
      desktopMap.append(cell);
      return cell;
    });
    desktopMapCard.append(desktopMap);

    const desktopGaugesCard = document.createElement('div');
    desktopGaugesCard.className = 'desktop-hud__panel desktop-hud__panel--gauges';
    const desktopGaugeRows = Object.fromEntries(
      GAUGE_META.map(({ key, alt }) => {
        const gauge = document.createElement('div');
        gauge.className = 'desktop-hud__gauge';
        const track = document.createElement('div');
        track.className = 'desktop-hud__gauge-track';
        const fill = document.createElement('span');
        fill.className = `desktop-hud__gauge-fill desktop-hud__gauge-fill--${key}`;
        track.append(fill);
        const iconElement = document.createElement('img');
        iconElement.className = 'desktop-hud__gauge-icon';
        iconElement.alt = alt;
        gauge.append(track, iconElement);
        desktopGaugesCard.append(gauge);
        return [key, { fill, icon: iconElement }];
      }),
    ) as Record<GaugeKey, { fill: HTMLSpanElement; icon: HTMLImageElement }>;
    this.desktopGaugeFills = Object.fromEntries(
      Object.entries(desktopGaugeRows).map(([key, value]) => [key, value.fill]),
    ) as Record<GaugeKey, HTMLSpanElement>;
    this.desktopGaugeIcons = Object.fromEntries(
      Object.entries(desktopGaugeRows).map(([key, value]) => [key, value.icon]),
    ) as Record<GaugeKey, HTMLImageElement>;

    const desktopScoreCard = document.createElement('div');
    desktopScoreCard.className = 'desktop-hud__footer-card desktop-hud__footer-card--score';
    const desktopScoreLabel = document.createElement('span');
    desktopScoreLabel.className = 'desktop-hud__footer-label';
    desktopScoreLabel.textContent = 'SCORE';
    const desktopScoreValue = document.createElement('span');
    desktopScoreValue.className = 'desktop-hud__footer-score';
    desktopScoreCard.append(desktopScoreLabel, desktopScoreValue);
    this.desktopScoreValue = desktopScoreValue;

    const desktopBootCard = document.createElement('div');
    desktopBootCard.className = 'desktop-hud__footer-card desktop-hud__footer-card--boot';
    const desktopBootBadge = document.createElement('span');
    desktopBootBadge.className = 'desktop-hud__boot-badge';
    const desktopBootIcon = document.createElement('img');
    desktopBootIcon.className = 'desktop-hud__boot-icon';
    desktopBootIcon.src = resolveAssetUrl('/icons/boot.png');
    desktopBootIcon.alt = 'Bottes magiques';
    desktopBootBadge.append(desktopBootIcon);
    desktopBootCard.append(desktopBootBadge);
    this.desktopBootBadge = desktopBootBadge;

    const desktopLivesCard = document.createElement('div');
    desktopLivesCard.className = 'desktop-hud__footer-card desktop-hud__footer-card--lives';
    const desktopLivesLabel = document.createElement('span');
    desktopLivesLabel.className = 'desktop-hud__footer-label';
    desktopLivesLabel.textContent = 'VIES';
    const desktopLivesValue = document.createElement('div');
    desktopLivesValue.className = 'desktop-hud__footer-lives';
    desktopLivesCard.append(desktopLivesLabel, desktopLivesValue);
    this.desktopLivesValue = desktopLivesValue;

    const settingsModal = document.createElement('div');
    settingsModal.className = 'settings-modal';
    settingsModal.hidden = true;

    const settingsDialog = document.createElement('div');
    settingsDialog.className = 'settings-modal__dialog';
    const settingsTitle = document.createElement('div');
    settingsTitle.className = 'settings-modal__title';
    settingsTitle.textContent = 'SETTINGS';
    const settingsSection = document.createElement('div');
    settingsSection.className = 'settings-modal__section';
    const settingsLabel = document.createElement('div');
    settingsLabel.className = 'settings-modal__label';
    settingsLabel.textContent = 'Audio';
    const settingsOptions = document.createElement('div');
    settingsOptions.className = 'settings-modal__options';
    const modernOption = document.createElement('label');
    modernOption.className = 'settings-modal__option';
    const modernSoundInput = document.createElement('input');
    modernSoundInput.type = 'radio';
    modernSoundInput.name = 'sound-mode';
    modernSoundInput.value = 'modern';
    const modernText = document.createElement('span');
    modernText.textContent = 'Sons modernes';
    modernOption.append(modernSoundInput, modernText);
    const retroOption = document.createElement('label');
    retroOption.className = 'settings-modal__option';
    const retroSoundInput = document.createElement('input');
    retroSoundInput.type = 'radio';
    retroSoundInput.name = 'sound-mode';
    retroSoundInput.value = 'retro';
    const retroText = document.createElement('span');
    retroText.textContent = 'Sons rétro';
    retroOption.append(retroSoundInput, retroText);
    settingsOptions.append(modernOption, retroOption);
    settingsSection.append(settingsLabel, settingsOptions);
    settingsDialog.append(settingsTitle, settingsSection);
    settingsModal.append(settingsDialog);
    this.settingsModal = settingsModal;
    this.modernSoundInput = modernSoundInput;
    this.retroSoundInput = retroSoundInput;

    this.hudHost.append(topRow, gauges);
    this.desktopSidebarHost.append(desktopWorldCard, desktopMapCard, desktopGaugesCard);
    this.desktopFooterHost.append(desktopScoreCard, desktopLivesCard, desktopBootCard);
    this.root.append(this.viewport, this.hudHost, this.desktopSidebarHost, this.desktopFooterHost, this.controlsHost, settingsButton, settingsModal);
    parent.replaceChildren(this.root);

    this.worldValue.textContent = 'Donjon 1';
    this.mobileVirtueIcon.src = resolveAssetUrl('/icons/virtues/virtue-shield.png');
    this.scoreValue.textContent = '000000';
    this.desktopWorldLabel.textContent = 'DONJON';
    this.desktopWorldNumber.textContent = '1';
    this.desktopVirtueName.textContent = '';
    this.desktopScoreValue.textContent = '000000';
    this.renderLives(0);
    this.renderDesktopLives(0);
    this.renderMap({
      x: 0,
      y: 0,
    }, Array.from({ length: 9 }, () => false), Array.from({ length: 9 }, () => false));
    this.renderDesktopMap({
      x: 0,
      y: 0,
    }, Array.from({ length: 9 }, () => false), Array.from({ length: 9 }, () => false));
    GAUGE_META.forEach(({ key }) => {
      this.gaugeIcons[key].src = DEFAULT_GAUGE_ICONS[key];
      this.desktopGaugeIcons[key].src = DEFAULT_GAUGE_ICONS[key];
    });
    settingsButton.addEventListener('click', () => {
      this.settingsModal.hidden = !this.settingsModal.hidden;
      this.root.classList.toggle('app-shell--settings-open', !this.settingsModal.hidden);
    });
    settingsModal.addEventListener('click', (event) => {
      if (event.target === settingsModal) {
        this.closeSettings();
      }
    });
    modernSoundInput.addEventListener('change', () => {
      if (modernSoundInput.checked) {
        updateGameSettings({ soundMode: 'modern' });
      }
    });
    retroSoundInput.addEventListener('change', () => {
      if (retroSoundInput.checked) {
        updateGameSettings({ soundMode: 'retro' });
      }
    });
    subscribeToGameSettings((settings) => {
      this.syncSettings(settings.soundMode);
    });
    this.updateHud(null);
  }

  syncLayout(state: GameLayoutState): void {
    this.root.dataset.layoutMode = state.mode;
    this.root.classList.toggle('app-shell--touch', state.isTouchDevice);
  }

  updateHud(snapshot: HudSnapshot | null): void {
    const isVisible = snapshot !== null;
    this.hudHost.classList.toggle('is-visible', isVisible);
    this.root.classList.toggle('app-shell--in-game', isVisible);
    if (!snapshot) {
      GAUGE_META.forEach(({ key }) => {
        this.gaugeIcons[key].src = DEFAULT_GAUGE_ICONS[key];
        this.desktopGaugeIcons[key].src = DEFAULT_GAUGE_ICONS[key];
      });
      return;
    }

    this.scoreValue.textContent = String(snapshot.score).padStart(6, '0');
    this.worldValue.textContent = `Niveau ${snapshot.worldNumber} : ${snapshot.virtueName}`;
    this.mobileVirtueIcon.src = resolveAssetUrl(`/icons/virtues/${snapshot.virtueIconKey}.png`);
    this.mobileVirtueIcon.alt = snapshot.virtueName;
    this.desktopWorldNumber.textContent = String(snapshot.worldNumber);
    this.desktopVirtueName.textContent = snapshot.virtueName;
    this.desktopVirtueIcon.src = resolveAssetUrl(`/icons/virtues/${snapshot.virtueIconKey}.png`);
    this.desktopVirtueIcon.alt = snapshot.virtueName;
    this.desktopScoreValue.textContent = String(snapshot.score).padStart(6, '0');
    this.desktopBootBadge.classList.toggle('is-visible', snapshot.hasMagicBoot);
    this.renderLives(snapshot.lives);
    this.renderDesktopLives(snapshot.lives);
    this.renderMap(snapshot.currentRoom, snapshot.roomsWithGoal, snapshot.roomsUnlocked);
    this.renderDesktopMap(snapshot.currentRoom, snapshot.roomsWithGoal, snapshot.roomsUnlocked);
    this.bootBadge.classList.toggle('is-visible', snapshot.hasMagicBoot);
    this.topRow.classList.toggle('has-boot', snapshot.hasMagicBoot);

    GAUGE_META.forEach(({ key }) => {
      const ratio = Math.max(0, Math.min(1, snapshot.gauges[key] / 100));
      this.gaugeFills[key].style.width = `${Math.round(ratio * 100)}%`;
      this.gaugeFills[key].dataset.value = String(Math.round(snapshot.gauges[key]));
      this.gaugeIcons[key].src = snapshot.gaugeIcons[key];
      this.desktopGaugeFills[key].style.height = `${Math.round(ratio * 100)}%`;
      this.desktopGaugeIcons[key].src = snapshot.gaugeIcons[key];
    });
  }

  private syncSettings(soundMode: SoundMode): void {
    this.modernSoundInput.checked = soundMode === 'modern';
    this.retroSoundInput.checked = soundMode === 'retro';
  }

  private closeSettings(): void {
    this.settingsModal.hidden = true;
    this.root.classList.remove('app-shell--settings-open');
  }

  private createGaugeRow(parent: HTMLElement, key: GaugeKey, alt: string): { fill: HTMLSpanElement; icon: HTMLImageElement } {
    const row = document.createElement('div');
    row.className = `mobile-hud__gauge mobile-hud__gauge--${key}`;

    const icon = document.createElement('img');
    icon.className = 'mobile-hud__gauge-icon';
    icon.alt = alt;

    const track = document.createElement('div');
    track.className = 'mobile-hud__gauge-track';

    const fill = document.createElement('span');
    fill.className = 'mobile-hud__gauge-fill';
    track.append(fill);

    row.append(icon, track);
    parent.append(row);
    return { fill, icon };
  }

  private renderLives(lives: number): void {
    this.livesValue.replaceChildren();
    for (let index = 0; index < Math.max(lives, 0); index += 1) {
      const heart = document.createElement('span');
      heart.className = 'mobile-hud__heart';
      heart.setAttribute('role', 'img');
      heart.setAttribute('aria-label', 'Vie');
      this.livesValue.append(heart);
    }
  }

  private renderDesktopLives(lives: number): void {
    this.desktopLivesValue.replaceChildren();
    for (let index = 0; index < Math.max(lives, 0); index += 1) {
      const heart = document.createElement('span');
      heart.className = 'desktop-hud__heart';
      heart.setAttribute('role', 'img');
      heart.setAttribute('aria-label', 'Vie');
      this.desktopLivesValue.append(heart);
    }
  }

  private renderMap(currentRoom: HudSnapshot['currentRoom'], roomsWithGoal: boolean[], roomsUnlocked: boolean[]): void {
    this.mapCells.forEach((cell, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const isCurrent = col === currentRoom.x && row === currentRoom.y;
      const hasGoal = roomsWithGoal[index] ?? false;
      const isUnlocked = roomsUnlocked[index] ?? false;

      cell.className = 'mobile-hud__map-cell';
      if (isCurrent) {
        cell.classList.add('is-current');
      } else if (hasGoal) {
        cell.classList.add('has-goal');
      } else if (isUnlocked) {
        cell.classList.add('is-unlocked');
      }
    });
  }

  private renderDesktopMap(currentRoom: HudSnapshot['currentRoom'], roomsWithGoal: boolean[], roomsUnlocked: boolean[]): void {
    this.desktopMapCells.forEach((cell, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const isCurrent = col === currentRoom.x && row === currentRoom.y;
      const hasGoal = roomsWithGoal[index] ?? false;
      const isUnlocked = roomsUnlocked[index] ?? false;

      cell.className = 'desktop-hud__map-cell';
      if (isCurrent) {
        cell.classList.add('is-current');
      } else if (hasGoal) {
        cell.classList.add('has-goal');
      } else if (isUnlocked) {
        cell.classList.add('is-unlocked');
      }
    });
  }
}
