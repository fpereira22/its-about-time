import Phaser from 'phaser';
import { BASE_WIDTH } from '../config/display';
import { EventSystem } from '../systems/EventSystem';
import { PHONE, phoneUi } from '../systems/Phone';
import { fitText, makeText, THEME } from './theme';

const W = 132;
const H = 30;
const Y = 92;
const SHOW_MS = 3600;

/** Notificación que entra desde la derecha cuando llega un mensaje al celular. */
export class PhoneToast {
  private current: Phaser.GameObjects.Container | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    // Un frame después: si el mensaje abrió el chat como viñeta, ahí ya se ve (la notificación lo taparía).
    EventSystem.onScene(scene, 'phone-message', ({ id }) => scene.time.delayedCall(30, () => !phoneUi.chatOpen && this.show(id)));
  }

  private show(id: string): void {
    const msg = PHONE.messages[id];
    if (!msg) return;
    this.current?.destroy();
    const contact = PHONE.contacts[msg.from];
    const color = Phaser.Display.Color.HexStringToColor(contact?.color ?? '#888888').color;

    const g = this.scene.add.graphics();
    g.fillStyle(0x000000, 0.2).fillRoundedRect(1, 2, W, H, 6);
    g.fillStyle(THEME.dark, 0.95).fillRoundedRect(0, 0, W, H, 6);
    g.fillStyle(color, 1).fillRoundedRect(0, 0, 4, H, { tl: 6, bl: 6, tr: 0, br: 0 });
    g.fillStyle(color, 1).fillCircle(14, 15, 7);
    const initial = makeText(this.scene, 14, 15, (contact?.name ?? '?').charAt(0), { fontSize: '9px', fontStyle: '600' }).setOrigin(0.5);
    const name = makeText(this.scene, 25, 3, contact?.name ?? msg.from, { fontSize: '8px', fontStyle: '600' });
    const hint = makeText(this.scene, W - 5, 3, 'Q: ver', { fontSize: '7px', color: '#8a96b8' }).setOrigin(1, 0);
    const body = makeText(this.scene, 25, 15, '', { fontSize: '8px', color: '#c8d0e8' });
    fitText(body, msg.text, W - 30);

    const box = this.scene.add.container(BASE_WIDTH + 4, Y, [g, initial, name, hint, body]).setDepth(300);
    this.current = box;
    this.scene.tweens.add({ targets: box, x: BASE_WIDTH - W - 4, duration: 260, ease: 'Back.Out' });
    this.scene.time.delayedCall(SHOW_MS, () => {
      if (this.current !== box) return;
      this.scene.tweens.add({
        targets: box,
        x: BASE_WIDTH + 4,
        duration: 220,
        ease: 'Cubic.In',
        onComplete: () => {
          box.destroy();
          if (this.current === box) this.current = null;
        },
      });
    });
  }
}
