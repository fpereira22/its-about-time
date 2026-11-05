/** Resolución lógica del juego (tipo GBA, 16:9). Todo el mundo se dibuja en este espacio. */
export const BASE_WIDTH = 320;
export const BASE_HEIGHT = 180;
export const TILE = 16;

/** Evento global (game.events) que se emite cuando cambia el zoom entero. */
export const ZOOM_CHANGED = 'zoom-changed';

export const FONT_TEXT = '"Pixelify Sans", monospace';
export const FONT_HUD = '"Silkscreen", monospace';

/** Mayor zoom entero que cabe en la ventana. */
export function computeZoom(): number {
  const z = Math.floor(Math.min(window.innerWidth / BASE_WIDTH, window.innerHeight / BASE_HEIGHT));
  return Math.max(1, z);
}

let currentZoom = computeZoom();

export function getZoom(): number {
  return currentZoom;
}

export function setZoom(z: number): void {
  currentZoom = z;
}
