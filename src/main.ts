import { GameBootstrap } from './game/GameBootstrap';
import { patchPhaserGamepadShutdown } from './game/patchPhaserGamepad';
import './styles.css';

patchPhaserGamepadShutdown();

void new GameBootstrap('app');
