import Phaser from 'phaser';
import { AudioManager } from './audio/AudioManager';
import { BASE_HEIGHT, BASE_WIDTH, computeDisplay, getZoom, setZoom, ZOOM_CHANGED } from './config/display';
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
import { attachFullscreenKey } from './systems/Fullscreen';
import { Admin } from './systems/Admin';
import { Content } from './systems/Content';
import { DevSkip } from './systems/DevSkip';
import { Records } from './systems/Records';
import { Secrets } from './systems/Secrets';
import { Dialogue } from './systems/DialogueManager';
import { EventSystem } from './systems/EventSystem';
import { StoryState } from './systems/StoryState';
import { TouchControls } from './systems/TouchControls';

// Diálogos y viñetas vienen en chunks aparte: se piden ya, para que lleguen mientras carga el título.
// Si fallan (sin red), el título lo vuelve a intentar al elegir una opción.
Content.load().catch(() => undefined);

// Los controles táctiles (si corresponden) definen cuánto espacio le queda al juego: van antes del zoom.
TouchControls.mount();
const initial = computeDisplay();
setZoom(initial.zoom);
const zoom = initial.zoom;

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
    // El centrado lo hace el CSS (#game es flex en index.html). Si Phaser también centra, le suma un
    // margen al canvas y el juego queda corrido a la derecha y abajo.
    autoCenter: Phaser.Scale.NO_CENTER,
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
attachFullscreenKey();

if (import.meta.env.DEV) {
  // Acceso de depuración desde la consola del navegador: __dev.state.allFlags(), etc.
  Object.assign(window, { __dev: { game, state: StoryState, dialogue: Dialogue, events: EventSystem } });
}

/**
 * Recalcula el tamaño del juego: zoom entero en escritorio; con controles táctiles, el espacio que
 * dejan libre. Se llama al cambiar la ventana (o girar el celular) y al cambiar el modo táctil.
 */
function relayout(): void {
  TouchControls.layout();
  const { zoom: z, cssScale } = computeDisplay();
  if (z !== getZoom()) {
    setZoom(z);
    game.scale.resize(BASE_WIDTH * z, BASE_HEIGHT * z);
    game.events.emit(ZOOM_CHANGED, z);
  }
  TouchControls.sizeCanvas(cssScale);
}

TouchControls.attach(game, relayout);
TouchControls.sizeCanvas(initial.cssScale);

// App instalable y sin internet (solo el build: en desarrollo el caché estorbaría a la recarga de Vite).
// El service worker sale de pwa/service-worker.js (ver el plugin en vite.config.ts).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  });
}

let resizeTimer = 0;
window.addEventListener('resize', () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(relayout, 100);
});
