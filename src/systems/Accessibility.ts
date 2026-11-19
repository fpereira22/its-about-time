import Phaser from 'phaser';
import { Settings } from './Settings';

/**
 * Ajustes de accesibilidad que tocan a todo el juego (Ajustes → Accesibilidad).
 *
 * "Reducir efectos": en vez de editar cada sacudida y cada destello, se frena en la cámara de Phaser:
 * mientras esté activo, `shake` y `flash` no hacen nada. Los relámpagos de la tormenta y la cantidad de
 * lluvia consultan `reduceEffects()` aparte (no son cámara).
 */

let patched = false;

export const reduceEffects = (): boolean => Settings.get('reduceEffects');

/** Cuánto de la lluvia se dibuja: toda, o la tercera parte con "Reducir efectos". */
export const rainScale = (): number => (reduceEffects() ? 0.35 : 1);

/** Engancha el freno a las cámaras (una sola vez al arrancar). */
export function attachAccessibility(): void {
  if (patched) return;
  patched = true;
  const cam = Phaser.Cameras.Scene2D.Camera.prototype;
  const shake = cam.shake;
  const flash = cam.flash;
  cam.shake = function (this: Phaser.Cameras.Scene2D.Camera, ...args: Parameters<typeof shake>) {
    return reduceEffects() ? this : shake.apply(this, args);
  };
  cam.flash = function (this: Phaser.Cameras.Scene2D.Camera, ...args: Parameters<typeof flash>) {
    return reduceEffects() ? this : flash.apply(this, args);
  };
}
