import { GameBootstrap } from './game/GameBootstrap';
import { recalculateGameLayout, subscribeToGameLayout } from './game/layout';
import { mountTouchControls } from './game/input/touchControls';
import { patchPhaserGamepadShutdown } from './game/patchPhaserGamepad';
import { subscribeToHudSnapshot } from './game/ui/hudState';
import { AppShell } from './ui/appShell';
import './styles.css';

patchPhaserGamepadShutdown();

const app = document.getElementById('app');

if (app) {
  const shell = new AppShell(app);
  mountTouchControls(shell.controlsHost);
  const bootstrap = new GameBootstrap(shell.gameHost);

  subscribeToGameLayout((layoutState) => {
    shell.syncLayout(layoutState);
    bootstrap.refreshScale();
  });

  subscribeToHudSnapshot((snapshot) => {
    shell.updateHud(snapshot);
  });

  const refreshLayout = () => {
    recalculateGameLayout();
    bootstrap.refreshScale();
  };

  const resizeObserver = new ResizeObserver(refreshLayout);
  resizeObserver.observe(shell.viewport);
  window.addEventListener('resize', refreshLayout);
  refreshLayout();
}
