/** Resolución lógica del juego (tipo GBA, 16:9). Todo el mundo se dibuja en este espacio. */
export const BASE_WIDTH = 320;
export const BASE_HEIGHT = 180;
export const TILE = 16;

/** Evento global (game.events) que se emite cuando cambia el zoom entero. */
export const ZOOM_CHANGED = 'zoom-changed';

export const FONT_TEXT = '"Pixelify Sans", monospace';
export const FONT_HUD = '"Silkscreen", monospace';

/** Zoom más alto que se usa con controles táctiles (más resolución no se nota y cuesta GPU). */
const MAX_TOUCH_ZOOM = 6;

/** Rectángulo (px CSS) donde debe caber el juego cuando hay controles táctiles; null = toda la ventana. */
let touchBox: { w: number; h: number } | null = null;

export function setTouchBox(box: { w: number; h: number } | null): void {
  touchBox = box;
}

/**
 * Cómo se muestra el canvas.
 * - `zoom`: entero con que se dibuja (cámaras y resolución de los textos).
 * - `cssScale`: tamaño en pantalla (px CSS por pixel lógico), o null si el canvas se ve a su tamaño
 *   real (escritorio: zoom entero que cabe en la ventana).
 *
 * Con controles táctiles el juego llena su caja: se dibuja a la resolución física de la pantalla
 * (devicePixelRatio) y, si un múltiplo entero de pixeles físicos queda casi del tamaño de la caja,
 * se usa ese para que el pixel art quede parejo.
 */
export function computeDisplay(): { zoom: number; cssScale: number | null } {
  if (!touchBox) {
    const z = Math.floor(Math.min(window.innerWidth / BASE_WIDTH, window.innerHeight / BASE_HEIGHT));
    return { zoom: Math.max(1, z), cssScale: null };
  }
  const dpr = window.devicePixelRatio || 1;
  const fit = Math.max(0.5, Math.min(touchBox.w / BASE_WIDTH, touchBox.h / BASE_HEIGHT));
  const zoom = Math.min(MAX_TOUCH_ZOOM, Math.max(1, Math.floor(fit * dpr)));
  const crisp = zoom / dpr;
  return { zoom, cssScale: crisp / fit >= 0.9 && crisp <= fit ? crisp : fit };
}

/** Zoom entero con que se dibuja el juego (ver computeDisplay). */
export function computeZoom(): number {
  return computeDisplay().zoom;
}

let currentZoom = computeZoom();

export function getZoom(): number {
  return currentZoom;
}

export function setZoom(z: number): void {
  currentZoom = z;
}
