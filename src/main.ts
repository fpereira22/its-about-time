import Phaser from 'phaser';
import { AudioManager } from './audio/AudioManager';
import { BASE_HEIGHT, BASE_WIDTH, computeZoom, getZoom, setZoom, ZOOM_CHANGED } from './config/display';
import { AdminWarpScene } from './scenes/AdminWarpScene';
import { BootScene } from './scenes/BootScene';
import { CreditsScene } from './scenes/CreditsScene';
import { FutbolScene } from './scenes/FutbolScene';
import { PiscinaScene } from './scenes/PiscinaScene';
import { CincoScene } from './scenes/CincoScene';
import { NatacionScene } from './scenes/NatacionScene';
import { PersecucionScene } from './scenes/PersecucionScene';
import { CocinaScene } from './scenes/CocinaScene';
import { SalsaScene } from './scenes/SalsaScene';
import { InteriorScene } from './scenes/InteriorScene';
import { MissionCompleteScene } from './scenes/MissionCompleteScene';
import { OverworldScene } from './scenes/OverworldScene';
import { PreloadScene } from './scenes/PreloadScene';
import { ProgressScene } from './scenes/ProgressScene';
import { TitleScene } from './scenes/TitleScene';
import { UIScene } from './scenes/UIScene';
import { Controls } from './systems/Controls';
import { Admin } from './systems/Admin';
import { DevSkip } from './systems/DevSkip';
import { Records } from './systems/Records';
import { Secrets } from './systems/Secrets';
import { Dialogue } from './systems/DialogueManager';
import { EventSystem } from './systems/EventSystem';
import { StoryState } from './systems/StoryState';

const zoom = getZoom();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: BASE_WIDTH * zoom,
  height: BASE_HEIGHT * zoom,
  backgroundColor: '#0d0d14',
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.NONE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: { keyboard: false, gamepad: false },
  scene: [BootScene, PreloadScene, TitleScene, OverworldScene, InteriorScene, UIScene, FutbolScene, PiscinaScene, CincoScene, NatacionScene, PersecucionScene, CocinaScene, SalsaScene, MissionCompleteScene, ProgressScene, CreditsScene, AdminWarpScene],
});

Controls.attach(game);
AudioManager.attach(game);
Secrets.attach();
Records.attach();
Admin.attach(game);
DevSkip.attach(game);

if (import.meta.env.DEV) {
  // Acceso de depuración desde la consola del navegador: __dev.state.allFlags(), etc.
  Object.assign(window, { __dev: { game, state: StoryState, dialogue: Dialogue, events: EventSystem } });
}

// Escalado entero: al cambiar el tamaño de la ventana se recalcula el mayor zoom que cabe.
let resizeTimer = 0;
window.addEventListener('resize', () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    const z = computeZoom();
    if (z === getZoom()) return;
    setZoom(z);
    game.scale.resize(BASE_WIDTH * z, BASE_HEIGHT * z);
    game.events.emit(ZOOM_CHANGED, z);
  }, 100);
});
