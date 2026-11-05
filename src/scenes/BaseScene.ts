import Phaser from 'phaser';
import { getZoom, ZOOM_CHANGED } from '../config/display';
import { makeText } from '../ui/theme';

/**
 * Base de todas las escenas.
 *
 * El canvas mide 320×180 × zoom entero y cada cámara usa ese zoom: el pixel art escala con
 * vecino más cercano y los textos se rasterizan a la resolución real (nítidos).
 */
export abstract class BaseScene extends Phaser.Scene {
  /** Si es true, la cámara muestra el rango fijo (0,0)-(320,180): para UI y menús. */
  protected fixedCamera = false;

  protected setupZoom(): void {
    const handler = (z: number): void => this.applyZoom(z);
    this.applyZoom(getZoom());
    this.game.events.on(ZOOM_CHANGED, handler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off(ZOOM_CHANGED, handler));
  }

  protected applyZoom(z: number): void {
    const cam = this.cameras.main;
    if (this.fixedCamera) cam.setOrigin(0, 0);
    cam.setZoom(z);
    refreshTextResolution(this.children.list, z);
  }

  /** Crea un texto con la resolución correcta para el zoom actual. */
  protected addText(
    x: number,
    y: number,
    text: string,
    style: Phaser.Types.GameObjects.Text.TextStyle = {},
  ): Phaser.GameObjects.Text {
    return makeText(this, x, y, text, style);
  }
}

function refreshTextResolution(objects: Phaser.GameObjects.GameObject[], z: number): void {
  for (const obj of objects) {
    if (obj instanceof Phaser.GameObjects.Text) obj.setResolution(z);
    else if (obj instanceof Phaser.GameObjects.Container) refreshTextResolution(obj.list, z);
  }
}
