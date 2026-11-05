import Phaser from 'phaser';
import { generateTextures, queueExternalSheets } from '../art/SpriteRegistry';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload(): void {
    queueExternalSheets(this.load);
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      console.warn(`No se pudo cargar ${file.key}; se usará la versión generada por código.`);
    });
  }

  create(): void {
    generateTextures(this);
    this.scene.start('Title');
  }
}
