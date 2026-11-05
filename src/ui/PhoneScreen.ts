import Phaser from 'phaser';
import { playSfx } from '../audio/sfx';
import { charKey, objKey } from '../art/SpriteRegistry';
import { FONT_HUD } from '../config/display';
import type { MapScene } from '../scenes/MapScene';
import { Controls } from '../systems/Controls';
import { check } from '../systems/Conditions';
import { Dialogue } from '../systems/DialogueManager';
import { EventSystem } from '../systems/EventSystem';
import { missionSummary } from '../systems/Mission';
import { PHONE, Phone } from '../systems/Phone';
import { playerTexture } from '../systems/PlayerLook';
import { formatMoney, StoryState } from '../systems/StoryState';
import { fitText, makeText, THEME } from './theme';

type View = 'home' | 'messages' | 'thread' | 'bip' | 'mission' | 'camera' | 'snake' | 'call' | 'contacts' | 'mail' | 'mailRead';

const FRAME = { x: 104, y: 6, w: 112, h: 168 };
const SCREEN = { x: FRAME.x + 6, y: FRAME.y + 16, w: FRAME.w - 12, h: FRAME.h - 32 };
const STATUS_H = 10;
const SLIDE_MS = 180;

const APPS = [
  { id: 'messages', label: 'Mensajes', color: 0x48b860 },
  { id: 'bip', label: 'Bip!', color: 0x2aa8bc },
  { id: 'map', label: 'Mapa', color: 0x3f7fd8 },
  { id: 'metro', label: 'Metro', color: 0xd8232a },
  { id: 'mission', label: 'Misión', color: 0xe8a030 },
  { id: 'camera', label: 'Cámara', color: 0x5a5c6c },
  { id: 'snake', label: 'Culebrita', color: 0x7aa838 },
  { id: 'phone', label: 'Teléfono', color: 0x3cb85a },
  { id: 'mail', label: 'Mi U', color: 0x7a4cc8 },
] as const;
type AppId = (typeof APPS)[number]['id'];

const BIP_OPTIONS = [1000, 2000];

// Culebrita (pantalla LCD verde)
const SNAKE = { cols: 14, rows: 16, cell: 6 };
const SNAKE_BEST_KEY = 'santiago-laberinto:culebrita';
const SNAKE_SECRET_SCORE = 10;
const LCD_BG = 0x9bbc0f;
const LCD_INK = 0x0f380f;

const hex = (c: string): number => Phaser.Display.Color.HexStringToColor(c).color;

interface SnakeState {
  body: Array<{ x: number; y: number }>;
  dir: { x: number; y: number };
  next: { x: number; y: number };
  food: { x: number; y: number };
  score: number;
  alive: boolean;
  acc: number;
}

/**
 * Celular (tecla Q): apps de mensajes, Bip!, mapa, metro, misión, cámara, culebrita, teléfono
 * y el correo de la universidad (Mi U),
 * más la pantalla de llamada entrante. Pausa el mapa mientras está abierto.
 * La app Mapa no es una pantalla: guarda el celular y lo deja en la mano, al costado (SideMap).
 */
export class PhoneScreen {
  private readonly root: Phaser.GameObjects.Container;
  private readonly screen: Phaser.GameObjects.Container;
  private map: MapScene | null = null;
  private view: View | null = null;
  private appIndex = 0;
  private listIndex = 0;
  private threadFrom = '';
  private threadScroll = 0;
  private threadMax = 0;
  private bipNote = '';
  private callId = '';
  private callChoice = 0;
  private ringTimer = 0;
  private location = '';
  private snake: SnakeState | null = null;
  private snakeGfx: Phaser.GameObjects.Graphics | null = null;
  private snakeText: Phaser.GameObjects.Text | null = null;
  private mailId = '';
  private dialNote = '';

  constructor(private readonly scene: Phaser.Scene) {
    this.root = scene.add.container(0, 0).setDepth(220).setVisible(false);
    this.screen = scene.add.container(0, 0);
    // Clip: nada dibujado en la pantalla puede salirse del área visible.
    const screenMask = scene.make.graphics({}, false);
    screenMask.fillRect(SCREEN.x, SCREEN.y, SCREEN.w, SCREEN.h);
    this.screen.setMask(screenMask.createGeometryMask());
    this.root.add(this.buildFrame());
    this.root.add(this.screen);
    EventSystem.onScene(scene, 'location-changed', ({ name }) => (this.location = name));
  }

  get isOpen(): boolean {
    return this.view !== null;
  }

  open(map: MapScene): void {
    this.show(map, 'home');
    playSfx('open');
  }

  openCall(map: MapScene, callId: string): void {
    this.callId = callId;
    this.callChoice = 0;
    this.ringTimer = 0;
    this.show(map, 'call');
    playSfx('ring');
  }

  /** Cierra el celular. `resume: false` deja el mapa en pausa (otro panel lo toma). */
  close(resume = true): void {
    if (!this.view) return;
    this.view = null;
    this.snake = null;
    const map = this.map;
    this.map = null;
    this.scene.tweens.killTweensOf(this.root);
    this.scene.tweens.add({
      targets: this.root,
      y: 190,
      duration: SLIDE_MS,
      ease: 'Cubic.In',
      onComplete: () => this.root.setVisible(false),
    });
    if (resume && map) this.scene.scene.resume(map.scene.key);
  }

  update(delta: number): void {
    if (!this.view) return;
    const up = Controls.consume('up');
    const down = Controls.consume('down');
    const left = Controls.consume('left');
    const right = Controls.consume('right');
    const ok = Controls.consume('interact');
    const back = Controls.consume('phone') || Controls.consume('menu');
    const input = { up, down, left, right, ok, back };

    switch (this.view) {
      case 'home':
        return this.updateHome(input);
      case 'messages':
        return this.updateMessages(input);
      case 'thread':
        return this.updateThread(input);
      case 'bip':
        return this.updateBip(input);
      case 'mission':
        if (back || ok) this.go('home', 'cancel');
        return;
      case 'camera':
        return this.updateCamera(input);
      case 'snake':
        return this.updateSnake(input, delta);
      case 'call':
        return this.updateCall(input, delta);
      case 'contacts':
        return this.updateContacts(input);
      case 'mail':
        return this.updateMail(input);
      case 'mailRead':
        return this.updateMailRead(input);
    }
  }

  // ---------------------------------------------------------------------------
  // Navegación
  // ---------------------------------------------------------------------------

  private show(map: MapScene, view: View): void {
    this.map = map;
    // Siempre pausar: un resume() de otro panel puede venir en cola.
    this.scene.scene.pause(map.scene.key);
    this.view = view;
    this.render();
    this.scene.tweens.killTweensOf(this.root);
    this.root.setVisible(true).setY(190);
    this.scene.tweens.add({ targets: this.root, y: 0, duration: SLIDE_MS, ease: 'Back.Out' });
  }

  private go(view: View, sfx: 'select' | 'cancel' = 'select'): void {
    playSfx(sfx);
    this.view = view;
    this.render();
  }

  private updateHome(i: Input): void {
    if (i.back) {
      playSfx('close');
      this.close();
      return;
    }
    const col = this.appIndex % 3;
    let next = this.appIndex;
    if (i.left && col > 0) next--;
    if (i.right && col < 2 && next + 1 < APPS.length) next++;
    if (i.up && this.appIndex >= 3) next -= 3;
    if (i.down && this.appIndex + 3 - col < APPS.length) next = Math.min(this.appIndex + 3, APPS.length - 1);
    if (next !== this.appIndex) {
      this.appIndex = next;
      playSfx('cursor');
      this.render();
    }
    if (i.ok) this.openApp(APPS[this.appIndex].id);
  }

  private openApp(id: AppId): void {
    switch (id) {
      case 'messages':
        this.listIndex = 0;
        return this.go('messages');
      case 'bip':
        this.bipNote = '';
        this.listIndex = 0;
        return this.go('bip');
      case 'map':
        playSfx('select');
        this.close();
        EventSystem.emit('side-map', { show: true });
        return;
      case 'metro':
        playSfx('select');
        // El mapa sigue en pausa: el mapa de la línea lo toma y lo reanuda al cerrarse.
        this.close(false);
        EventSystem.emit('open-line-map');
        return;
      case 'mission':
        return this.go('mission');
      case 'camera':
        return this.go('camera');
      case 'snake':
        this.snake = null;
        return this.go('snake');
      case 'phone':
        this.listIndex = 0;
        this.dialNote = '';
        return this.go('contacts');
      case 'mail':
        this.listIndex = 0;
        return this.go('mail');
    }
  }

  // ---------------------------------------------------------------------------
  // Teléfono (llamar) y correo de la universidad
  // ---------------------------------------------------------------------------

  private callableContacts(): string[] {
    return Object.keys(PHONE.contacts).filter((id) => PHONE.contacts[id].callable && check(PHONE.contacts[id].if));
  }

  private updateContacts(i: Input): void {
    if (i.back) return this.go('home', 'cancel');
    const list = this.callableContacts();
    if (list.length === 0) return;
    if (i.up || i.down) {
      this.listIndex = Phaser.Math.Clamp(this.listIndex + (i.down ? 1 : -1), 0, list.length - 1);
      this.dialNote = '';
      playSfx('cursor');
      this.render();
    }
    if (!i.ok) return;
    const contact = list[this.listIndex];
    const dialogue = Phone.dial(contact);
    if (!dialogue) {
      playSfx('error');
      this.dialNote = `${PHONE.contacts[contact].name} no contesta.`;
      this.render();
      return;
    }
    playSfx('phone');
    this.close();
    void Dialogue.run(dialogue);
  }

  /** Correos visibles, el más nuevo primero. */
  private visibleMail(): string[] {
    return Object.keys(PHONE.mail)
      .filter((id) => check(PHONE.mail[id].if))
      .reverse();
  }

  private updateMail(i: Input): void {
    if (i.back) return this.go('home', 'cancel');
    const list = this.visibleMail();
    if (list.length === 0) return;
    if (i.up || i.down) {
      this.listIndex = Phaser.Math.Clamp(this.listIndex + (i.down ? 1 : -1), 0, list.length - 1);
      playSfx('cursor');
      this.render();
    }
    if (i.ok) {
      this.mailId = list[this.listIndex];
      this.threadScroll = 0;
      StoryState.setFlag(`correo_${this.mailId}`);
      this.go('mailRead');
    }
  }

  private updateMailRead(i: Input): void {
    if (i.back || i.ok) return this.go('mail', 'cancel');
    if (i.up || i.down) {
      this.threadScroll = Phaser.Math.Clamp(this.threadScroll + (i.down ? 12 : -12), 0, this.threadMax);
      this.render();
    }
  }

  // ---------------------------------------------------------------------------
  // Mensajes
  // ---------------------------------------------------------------------------

  /** Conversaciones: un contacto por fila, la más reciente primero. */
  private conversations(): Array<{ from: string; last: string; unread: number }> {
    const byFrom = new Map<string, { from: string; last: string; unread: number; at: number }>();
    for (const entry of StoryState.phone) {
      const msg = PHONE.messages[entry.id];
      if (!msg) continue;
      const c = byFrom.get(msg.from) ?? { from: msg.from, last: '', unread: 0, at: 0 };
      c.last = msg.mine ? `Tú: ${msg.text}` : msg.text;
      c.at = entry.at;
      if (!entry.read) c.unread++;
      byFrom.set(msg.from, c);
    }
    return [...byFrom.values()].sort((a, b) => b.at - a.at);
  }

  private updateMessages(i: Input): void {
    if (i.back) return this.go('home', 'cancel');
    const convs = this.conversations();
    if (convs.length === 0) return;
    if (i.up || i.down) {
      this.listIndex = Phaser.Math.Clamp(this.listIndex + (i.down ? 1 : -1), 0, convs.length - 1);
      playSfx('cursor');
      this.render();
    }
    if (i.ok) {
      this.threadFrom = convs[this.listIndex].from;
      this.threadScroll = Number.MAX_SAFE_INTEGER;
      const ids = StoryState.phone.filter((e) => PHONE.messages[e.id]?.from === this.threadFrom).map((e) => e.id);
      StoryState.markRead(ids);
      this.go('thread');
    }
  }

  private updateThread(i: Input): void {
    if (i.back) return this.go('messages', 'cancel');
    if (i.up || i.down) {
      this.threadScroll = Phaser.Math.Clamp(this.threadScroll + (i.down ? 12 : -12), 0, this.threadMax);
      this.render();
    }
  }

  // ---------------------------------------------------------------------------
  // Bip!, cámara
  // ---------------------------------------------------------------------------

  private updateBip(i: Input): void {
    if (i.back) return this.go('home', 'cancel');
    const n = BIP_OPTIONS.length + 1;
    if (i.up || i.down) {
      this.listIndex = (this.listIndex + (i.down ? 1 : -1) + n) % n;
      playSfx('cursor');
      this.render();
    }
    if (!i.ok) return;
    if (this.listIndex === BIP_OPTIONS.length) return this.go('home', 'cancel');
    const amount = BIP_OPTIONS[this.listIndex];
    if (!StoryState.spend(amount)) {
      playSfx('error');
      this.bipNote = 'Saldo insuficiente en tu cuenta';
    } else {
      StoryState.chargeBip(amount);
      StoryState.setFlag('bip_cargada');
      StoryState.setFlag('cargo_con_app');
      playSfx('bip');
      this.bipNote = `+${formatMoney(amount)} cargados`;
    }
    this.render();
  }

  private updateCamera(i: Input): void {
    if (i.back) return this.go('home', 'cancel');
    if (!i.ok) return;
    playSfx('camera');
    const flash = this.scene.add.rectangle(SCREEN.x, SCREEN.y, SCREEN.w, SCREEN.h, 0xffffff).setOrigin(0, 0);
    this.screen.add(flash);
    this.scene.tweens.add({ targets: flash, alpha: 0, duration: 350, onComplete: () => flash.destroy() });
    if (StoryState.hasFlag('quiltro_sigue')) StoryState.setFlag('secreto_selfie_quiltro');
    StoryState.setFlag('saco_selfie');
  }

  // ---------------------------------------------------------------------------
  // Llamada entrante
  // ---------------------------------------------------------------------------

  private updateCall(i: Input, delta: number): void {
    this.ringTimer += delta;
    if (this.ringTimer > 1600) {
      this.ringTimer = 0;
      playSfx('ring');
    }
    if (i.left || i.right || i.up || i.down) {
      this.callChoice = 1 - this.callChoice;
      playSfx('cursor');
      this.render();
    }
    const id = this.callId;
    const call = PHONE.calls[id];
    if (i.back || (i.ok && this.callChoice === 1)) {
      playSfx('cancel');
      this.close();
      Phone.endCall(id, false);
      return;
    }
    if (i.ok && call) {
      playSfx('select');
      this.close();
      void Dialogue.run(call.dialogue).then(() => Phone.endCall(id, true));
    }
  }

  // ---------------------------------------------------------------------------
  // Culebrita
  // ---------------------------------------------------------------------------

  private newSnake(): SnakeState {
    const s: SnakeState = {
      body: [
        { x: 5, y: 8 },
        { x: 4, y: 8 },
        { x: 3, y: 8 },
      ],
      dir: { x: 1, y: 0 },
      next: { x: 1, y: 0 },
      food: { x: 0, y: 0 },
      score: 0,
      alive: true,
      acc: 0,
    };
    s.food = this.freeCell(s);
    return s;
  }

  private freeCell(s: SnakeState): { x: number; y: number } {
    for (;;) {
      const c = { x: Phaser.Math.Between(0, SNAKE.cols - 1), y: Phaser.Math.Between(0, SNAKE.rows - 1) };
      if (!s.body.some((b) => b.x === c.x && b.y === c.y)) return c;
    }
  }

  private updateSnake(i: Input, delta: number): void {
    if (i.back) {
      this.snake = null;
      return this.go('home', 'cancel');
    }
    const s = this.snake;
    if (!s || !s.alive) {
      if (i.ok) {
        playSfx('select');
        this.snake = this.newSnake();
        this.drawSnake();
      }
      return;
    }
    const turn = i.up ? { x: 0, y: -1 } : i.down ? { x: 0, y: 1 } : i.left ? { x: -1, y: 0 } : i.right ? { x: 1, y: 0 } : null;
    if (turn && (turn.x !== -s.dir.x || turn.y !== -s.dir.y)) s.next = turn;

    s.acc += delta;
    const stepMs = Math.max(75, 170 - s.score * 6);
    if (s.acc < stepMs) return;
    s.acc = 0;
    s.dir = s.next;
    const head = { x: s.body[0].x + s.dir.x, y: s.body[0].y + s.dir.y };
    const hitWall = head.x < 0 || head.y < 0 || head.x >= SNAKE.cols || head.y >= SNAKE.rows;
    if (hitWall || s.body.some((b) => b.x === head.x && b.y === head.y)) {
      s.alive = false;
      playSfx('snake-die');
      if (s.score > snakeBest()) saveSnakeBest(s.score);
      this.drawSnake();
      return;
    }
    s.body.unshift(head);
    if (head.x === s.food.x && head.y === s.food.y) {
      s.score++;
      playSfx('snake-eat');
      if (s.score >= SNAKE_SECRET_SCORE) StoryState.setFlag('secreto_culebrita');
      s.food = this.freeCell(s);
    } else {
      s.body.pop();
    }
    this.drawSnake();
  }

  private drawSnake(): void {
    const g = this.snakeGfx;
    if (!g) return;
    const ox = SCREEN.x + Math.floor((SCREEN.w - SNAKE.cols * SNAKE.cell) / 2);
    const oy = SCREEN.y + STATUS_H + 16;
    const c = SNAKE.cell;
    g.clear();
    g.fillStyle(LCD_BG, 1).fillRect(ox - 2, oy - 2, SNAKE.cols * c + 4, SNAKE.rows * c + 4);
    g.lineStyle(1, LCD_INK, 1).strokeRect(ox - 1.5, oy - 1.5, SNAKE.cols * c + 3, SNAKE.rows * c + 3);
    const s = this.snake;
    if (s) {
      g.fillStyle(LCD_INK, 1);
      for (const b of s.body) g.fillRect(ox + b.x * c, oy + b.y * c, c - 1, c - 1);
      g.fillRect(ox + s.food.x * c + 1, oy + s.food.y * c, c - 3, c - 1);
      g.fillRect(ox + s.food.x * c, oy + s.food.y * c + 1, c - 1, c - 3);
    }
    const best = snakeBest();
    let label = `PTS: ${s?.score ?? 0}  RÉCORD: ${best}`;
    if (!s) label = 'E: JUGAR';
    else if (!s.alive) label = `FIN: ${s.score} PTS · E: OTRA`;
    this.snakeText?.setText(label);
  }

  // ---------------------------------------------------------------------------
  // Dibujo
  // ---------------------------------------------------------------------------

  private buildFrame(): Phaser.GameObjects.GameObject[] {
    const g = this.scene.add.graphics();
    const { x, y, w, h } = FRAME;
    g.fillStyle(0x000000, 0.25).fillRoundedRect(x + 2, y + 3, w, h, 12);
    g.fillStyle(0x3a3f4f, 1).fillRoundedRect(x, y, w, h, 12);
    g.fillStyle(0x15171f, 1).fillRoundedRect(x + 2, y + 2, w - 4, h - 4, 10);
    g.fillStyle(0x3a3f4f, 1).fillRoundedRect(x + w / 2 - 12, y + 7, 24, 3, 1.5);
    g.fillStyle(0x2a2e3a, 1).fillCircle(x + w / 2 + 18, y + 8.5, 1.5);
    g.lineStyle(1, 0x3a3f4f, 1).strokeCircle(x + w / 2, y + h - 8, 4);
    return [g];
  }

  private render(): void {
    this.screen.removeAll(true);
    this.snakeGfx = null;
    this.snakeText = null;
    const bg = this.scene.add.graphics();
    const wallpaper = this.view === 'snake' ? 0x2d3a1a : this.view === 'call' ? 0x22304e : 0x1c2a48;
    bg.fillStyle(wallpaper, 1).fillRect(SCREEN.x, SCREEN.y, SCREEN.w, SCREEN.h);
    if (this.view === 'home') {
      bg.fillStyle(0xd8232a, 0.45).fillRect(SCREEN.x, SCREEN.y + SCREEN.h - 26, SCREEN.w, 2);
      bg.fillStyle(0x2aa8bc, 0.35).fillRect(SCREEN.x, SCREEN.y + SCREEN.h - 23, SCREEN.w, 1);
    }
    this.screen.add(bg);
    this.statusBar();

    switch (this.view) {
      case 'home':
        this.renderHome();
        break;
      case 'messages':
        this.renderMessages();
        break;
      case 'thread':
        this.renderThread();
        break;
      case 'bip':
        this.renderBip();
        break;
      case 'mission':
        this.renderMission();
        break;
      case 'camera':
        this.renderCamera();
        break;
      case 'snake':
        this.renderSnake();
        break;
      case 'call':
        this.renderCall();
        break;
      case 'contacts':
        this.renderContacts();
        break;
      case 'mail':
        this.renderMail();
        break;
      case 'mailRead':
        this.renderMailRead();
        break;
    }
  }

  private statusBar(): void {
    const g = this.scene.add.graphics();
    g.fillStyle(0x000000, 0.35).fillRect(SCREEN.x, SCREEN.y, SCREEN.w, STATUS_H);
    const bx = SCREEN.x + SCREEN.w - 14;
    g.lineStyle(1, 0xffffff, 0.9).strokeRect(bx + 0.5, SCREEN.y + 2.5, 10, 5);
    g.fillStyle(0xffffff, 0.9).fillRect(bx + 2, SCREEN.y + 4, 6, 2).fillRect(bx + 11, SCREEN.y + 4, 1, 2);
    for (let i = 0; i < 4; i++) g.fillRect(bx - 12 + i * 2, SCREEN.y + 7 - i, 1, 1 + i);
    this.screen.add(g);
    this.screen.add(this.text(SCREEN.x + 3, SCREEN.y + 1, Phone.clock(), { fontFamily: FONT_HUD, fontSize: '8px' }));
  }

  private renderHome(): void {
    const unread = StoryState.unreadCount();
    APPS.forEach((app, i) => {
      const cx = SCREEN.x + 18 + (i % 3) * 32;
      const cy = SCREEN.y + STATUS_H + 17 + Math.floor(i / 3) * 34;
      const g = this.scene.add.graphics();
      if (i === this.appIndex) g.fillStyle(0xffffff, 0.9).fillRoundedRect(cx - 13, cy - 13, 26, 26, 7);
      g.fillStyle(app.color, 1).fillRoundedRect(cx - 11, cy - 11, 22, 22, 6);
      this.drawGlyph(g, app.id, cx, cy);
      this.screen.add(g);
      if (app.id === 'bip') this.screen.add(this.scene.add.image(cx, cy, objKey('bip')));
      if (app.id === 'mission') this.screen.add(this.scene.add.image(cx, cy, objKey('mapa')));
      if (app.id === 'messages' && unread > 0) {
        const b = this.scene.add.graphics().fillStyle(0xe83838, 1).fillCircle(cx + 10, cy - 10, 5);
        this.screen.add(b);
        this.screen.add(this.text(cx + 10, cy - 10, String(unread), { fontSize: '8px', fontStyle: '600' }).setOrigin(0.5));
      }
      const label = this.text(cx, cy + 14, app.label, { fontSize: '7px', color: i === this.appIndex ? '#ffffff' : '#c8d0e8' });
      fitText(label, app.label, 32);
      const halfW = label.width / 2;
      const clampedX = Phaser.Math.Clamp(cx, SCREEN.x + halfW + 1, SCREEN.x + SCREEN.w - halfW - 1);
      label.setX(clampedX).setOrigin(0.5, 0);
      this.screen.add(label);
    });
    this.footer('E: abrir · Q: guardar');
  }

  private drawGlyph(g: Phaser.GameObjects.Graphics, id: AppId, cx: number, cy: number): void {
    g.fillStyle(0xffffff, 1);
    switch (id) {
      case 'messages':
        g.fillRoundedRect(cx - 7, cy - 6, 14, 10, 3).fillTriangle(cx - 4, cy + 3, cx - 1, cy + 3, cx - 5, cy + 7);
        g.fillStyle(0x48b860, 1).fillRect(cx - 4, cy - 2, 2, 2).fillRect(cx - 1, cy - 2, 2, 2).fillRect(cx + 2, cy - 2, 2, 2);
        break;
      case 'map':
        // Plano doblado en tres con un pin.
        g.fillRect(cx - 8, cy - 6, 16, 12);
        g.fillStyle(0xc8daf4, 1).fillRect(cx - 3, cy - 6, 5, 12);
        g.fillStyle(0x7fb070, 1).fillRect(cx - 8, cy + 1, 5, 5).fillRect(cx + 2, cy - 6, 6, 4);
        g.fillStyle(0xe03838, 1).fillCircle(cx + 1, cy - 2, 3).fillTriangle(cx - 1.5, cy - 1, cx + 3.5, cy - 1, cx + 1, cy + 3);
        g.fillStyle(0xffffff, 1).fillCircle(cx + 1, cy - 2, 1);
        break;
      case 'metro':
        g.fillRect(cx - 8, cy - 1, 16, 2);
        for (const dx of [-6, 0, 6]) g.fillCircle(cx + dx, cy, 2.5);
        g.fillStyle(0xd8232a, 1);
        for (const dx of [-6, 0, 6]) g.fillCircle(cx + dx, cy, 1.2);
        break;
      case 'camera':
        g.fillRoundedRect(cx - 8, cy - 5, 16, 11, 2).fillRect(cx - 3, cy - 7, 6, 2);
        g.fillStyle(0x5a5c6c, 1).fillCircle(cx, cy, 3.5);
        g.fillStyle(0xffffff, 1).fillCircle(cx, cy, 1.5);
        break;
      case 'phone':
        // Auricular.
        g.fillRoundedRect(cx - 7, cy - 7, 5, 6, 2).fillRoundedRect(cx + 2, cy + 1, 6, 5, 2);
        g.lineStyle(3, 0xffffff, 1).beginPath().arc(cx + 1, cy - 2, 6, Math.PI * 0.6, Math.PI * 1.15).strokePath();
        break;
      case 'mail':
        // Sobre con birrete.
        g.fillRect(cx - 8, cy - 3, 16, 10);
        g.fillStyle(0x7a4cc8, 1).fillTriangle(cx - 8, cy - 3, cx + 8, cy - 3, cx, cy + 3);
        g.fillStyle(0xffffff, 1).fillTriangle(cx - 6, cy - 8, cx + 6, cy - 8, cx, cy - 5).fillRect(cx + 4, cy - 8, 1, 4);
        break;
      case 'snake':
        g.fillStyle(LCD_BG, 1).fillRect(cx - 8, cy - 7, 16, 14);
        g.fillStyle(LCD_INK, 1).fillRect(cx - 6, cy - 4, 8, 2).fillRect(cx, cy - 4, 2, 7).fillRect(cx, cy + 1, 5, 2).fillRect(cx + 4, cy - 5, 2, 2);
        break;
      default:
        break;
    }
  }

  private renderMessages(): void {
    this.header('Mensajes');
    const convs = this.conversations();
    if (convs.length === 0) {
      this.screen.add(this.text(SCREEN.x + 6, SCREEN.y + 34, 'No tienes mensajes.', { fontSize: '8px', color: '#c8d0e8' }));
    }
    convs.slice(0, 5).forEach((c, i) => {
      const y = SCREEN.y + STATUS_H + 16 + i * 22;
      const contact = PHONE.contacts[c.from];
      const g = this.scene.add.graphics();
      if (i === this.listIndex) g.fillStyle(0xffffff, 0.12).fillRect(SCREEN.x + 1, y - 1, SCREEN.w - 2, 21);
      g.fillStyle(hex(contact?.color ?? '#888888'), 1).fillCircle(SCREEN.x + 10, y + 9, 7);
      if (c.unread > 0) g.fillStyle(0x48b860, 1).fillCircle(SCREEN.x + SCREEN.w - 6, y + 4, 2.5);
      this.screen.add(g);
      this.screen.add(this.text(SCREEN.x + 10, y + 9, (contact?.name ?? '?').charAt(0), { fontSize: '9px', fontStyle: '600' }).setOrigin(0.5));
      this.screen.add(this.text(SCREEN.x + 21, y, contact?.name ?? c.from, { fontSize: '8px', fontStyle: '600' }));
      const preview = this.text(SCREEN.x + 21, y + 9, '', { fontSize: '8px', color: '#a8b4d0' });
      fitText(preview, c.last, SCREEN.w - 30);
      this.screen.add(preview);
    });
    this.footer('E: leer · Q: volver');
  }

  private renderThread(): void {
    const contact = PHONE.contacts[this.threadFrom];
    this.header(contact?.name ?? this.threadFrom);
    const top = SCREEN.y + STATUS_H + 14;
    const bottom = SCREEN.y + SCREEN.h - 12;
    const content = this.scene.add.container(0, 0);
    let y = 0;
    for (const entry of StoryState.phone) {
      const msg = PHONE.messages[entry.id];
      if (msg?.from !== this.threadFrom) continue;
      // Tus mensajes van a la derecha, en verde; los del contacto, a la izquierda con su color.
      const mine = msg.mine === true;
      const bx = mine ? SCREEN.x + 14 : SCREEN.x + 4;
      const t = this.text(bx + 4, 0, msg.text, { fontSize: '8px', wordWrap: { width: SCREEN.w - 26, useAdvancedWrap: true }, lineSpacing: 1 });
      const bh = t.height + 6;
      const g = this.scene.add.graphics();
      g.fillStyle(mine ? 0x3c9c6c : hex(contact?.color ?? '#888888'), 0.9).fillRoundedRect(bx, y, SCREEN.w - 18, bh, 5);
      t.setY(y + 3);
      const time = this.text(mine ? SCREEN.x + SCREEN.w - 6 : SCREEN.x + SCREEN.w - 16, y + bh + 1, mine ? `${Phone.clock(entry)} ✓✓` : Phone.clock(entry), { fontSize: '7px', color: '#8a96b8' }).setOrigin(1, 0);
      content.add([g, t, time]);
      y += bh + 12;
    }
    this.threadMax = Math.max(0, y - (bottom - top));
    this.threadScroll = Phaser.Math.Clamp(this.threadScroll, 0, this.threadMax);
    content.setY(top - this.threadScroll);
    const maskShape = this.scene.make.graphics({}, false).fillRect(SCREEN.x, top, SCREEN.w, bottom - top);
    content.setMask(maskShape.createGeometryMask());
    this.screen.add(content);
    this.footer(this.threadMax > 0 ? 'W/S: desplazar · Q: volver' : 'Q: volver');
  }

  private renderBip(): void {
    this.header('Bip!');
    const g = this.scene.add.graphics();
    const cardY = SCREEN.y + STATUS_H + 16;
    g.fillStyle(0x2aa8bc, 1).fillRoundedRect(SCREEN.x + 6, cardY, SCREEN.w - 12, 34, 5);
    g.fillStyle(0xf0c030, 1).fillRect(SCREEN.x + 12, cardY + 18, 10, 7);
    this.screen.add(g);
    this.screen.add(this.text(SCREEN.x + 12, cardY + 4, 'Saldo', { fontSize: '8px', color: '#dff6fa' }));
    this.screen.add(this.text(SCREEN.x + SCREEN.w - 10, cardY + 14, formatMoney(StoryState.bip), { fontSize: '12px', fontStyle: '600' }).setOrigin(1, 0));
    this.screen.add(this.text(SCREEN.x + 6, cardY + 38, `Tu cuenta: ${formatMoney(StoryState.money)}`, { fontSize: '8px', color: '#c8d0e8' }));
    const labels = [...BIP_OPTIONS.map((a) => `Cargar ${formatMoney(a)}`), 'Volver'];
    labels.forEach((label, i) => {
      const y = cardY + 52 + i * 14;
      if (i === this.listIndex) {
        this.screen.add(this.scene.add.graphics().fillStyle(0xffffff, 0.14).fillRoundedRect(SCREEN.x + 4, y - 1, SCREEN.w - 8, 12, 3));
      }
      this.screen.add(this.text(SCREEN.x + 10, y, label, { fontSize: '8px', color: i === this.listIndex ? '#ffffff' : '#c8d0e8' }));
    });
    if (this.bipNote) {
      const ok = this.bipNote.startsWith('+');
      this.screen.add(this.text(SCREEN.x + SCREEN.w / 2, cardY + 96, this.bipNote, { fontSize: '8px', color: ok ? '#78e08a' : '#ff7a7a', align: 'center', wordWrap: { width: SCREEN.w - 8 } }).setOrigin(0.5, 0));
    }
    this.footer('E: cargar · Q: volver');
  }

  private renderMission(): void {
    this.header('Misión');
    const s = missionSummary();
    const found = s.collectibles.filter((c) => c.found).length;
    const lines = [
      StoryState.objective || '...',
      '',
      `Tiempo: ${s.time}`,
      `Ruta: ${s.route}`,
      `Coleccionables: ${found}/${s.collectibles.length}`,
      `Secretos: ${s.secrets.found}/${s.secrets.total}`,
    ];
    this.screen.add(
      this.text(SCREEN.x + 6, SCREEN.y + STATUS_H + 16, lines.join('\n'), {
        fontSize: '8px',
        color: '#e0e6f8',
        wordWrap: { width: SCREEN.w - 12, useAdvancedWrap: true },
        lineSpacing: 2,
      }),
    );
    this.footer('Q: volver');
  }

  private renderCamera(): void {
    const top = SCREEN.y + STATUS_H;
    const g = this.scene.add.graphics();
    g.fillStyle(0x9cd0f0, 1).fillRect(SCREEN.x, top, SCREEN.w, SCREEN.h - STATUS_H - 12);
    g.fillStyle(0xb8a898, 1).fillRect(SCREEN.x, top + 54, 30, 40).fillRect(SCREEN.x + 60, top + 40, 32, 54);
    g.fillStyle(0x5c94cc, 1).fillRect(SCREEN.x + 34, top + 10, 22, 84);
    g.fillStyle(0xd8cfc0, 1).fillRect(SCREEN.x, top + 94, SCREEN.w, SCREEN.h - STATUS_H - 106);
    g.lineStyle(1, 0xffffff, 0.8);
    for (const [cx, cy, sx, sy] of [
      [SCREEN.x + 4, top + 4, 1, 1],
      [SCREEN.x + SCREEN.w - 4, top + 4, -1, 1],
      [SCREEN.x + 4, top + 116, 1, -1],
      [SCREEN.x + SCREEN.w - 4, top + 116, -1, -1],
    ]) {
      g.lineBetween(cx, cy, cx + 6 * sx, cy).lineBetween(cx, cy, cx, cy + 6 * sy);
    }
    this.screen.add(g);
    const withDog = StoryState.hasFlag('quiltro_sigue');
    const px = SCREEN.x + SCREEN.w / 2 - (withDog ? 12 : 0);
    this.screen.add(this.scene.add.image(px, top + 104, playerTexture(this.scene), 0).setOrigin(0.5, 1).setScale(3));
    if (withDog) this.screen.add(this.scene.add.image(px + 30, top + 106, charKey('quiltro'), 0).setOrigin(0.5, 1).setScale(2));
    const caption = this.text(SCREEN.x + SCREEN.w / 2, top + 108, '', { fontSize: '8px', color: '#2a2433', fontStyle: '600' }).setOrigin(0.5, 0);
    fitText(caption, `Selfie en ${this.location || 'Santiago'}`, SCREEN.w - 6);
    this.screen.add(caption);
    this.footer('E: foto · Q: volver');
  }

  private renderSnake(): void {
    this.header('Culebrita');
    this.snakeGfx = this.scene.add.graphics();
    this.screen.add(this.snakeGfx);
    this.snakeText = this.text(SCREEN.x + SCREEN.w / 2, SCREEN.y + SCREEN.h - 20, '', { fontFamily: FONT_HUD, fontSize: '7px', color: '#c8e070' }).setOrigin(0.5, 0);
    this.screen.add(this.snakeText);
    this.drawSnake();
    this.footer('WASD: mover · Q: salir');
  }

  private renderCall(): void {
    const call = PHONE.calls[this.callId];
    const contact = call ? PHONE.contacts[call.from] : undefined;
    const cx = SCREEN.x + SCREEN.w / 2;
    const g = this.scene.add.graphics();
    g.fillStyle(hex(contact?.color ?? '#888888'), 1).fillCircle(cx, SCREEN.y + 46, 18);
    this.screen.add(g);
    this.screen.add(this.text(cx, SCREEN.y + 46, (contact?.name ?? '?').charAt(0), { fontSize: '18px', fontStyle: '600' }).setOrigin(0.5));
    this.screen.add(this.text(cx, SCREEN.y + 70, contact?.name ?? 'Desconocido', { fontSize: '11px', fontStyle: '600' }).setOrigin(0.5, 0));
    const calling = this.text(cx, SCREEN.y + 84, 'llamando...', { fontSize: '8px', color: '#c8d0e8' }).setOrigin(0.5, 0);
    this.scene.tweens.add({ targets: calling, alpha: 0.3, duration: 500, yoyo: true, repeat: -1 });
    this.screen.add(calling);
    [
      ['Contestar', 0x3cb85a],
      ['Rechazar', 0xe04848],
    ].forEach(([label, color], i) => {
      const bx = cx + (i === 0 ? -22 : 22);
      const by = SCREEN.y + 112;
      const b = this.scene.add.graphics();
      if (i === this.callChoice) b.fillStyle(0xffffff, 1).fillCircle(bx, by, 11);
      b.fillStyle(color as number, 1).fillCircle(bx, by, 9);
      b.fillStyle(0xffffff, 1).fillRoundedRect(bx - 5, by - 1.5, 10, 3, 1.5);
      this.screen.add(b);
      this.screen.add(this.text(bx, by + 12, label as string, { fontSize: '7px', color: '#e0e6f8' }).setOrigin(0.5, 0));
    });
    // El celular vibra mientras suena.
    this.scene.tweens.add({ targets: this.root, x: 1, duration: 50, yoyo: true, repeat: 5, onComplete: () => this.root.setX(0) });
  }

  private renderContacts(): void {
    this.header('Teléfono');
    const list = this.callableContacts();
    list.slice(0, 5).forEach((id, i) => {
      const contact = PHONE.contacts[id];
      const y = SCREEN.y + STATUS_H + 16 + i * 18;
      const g = this.scene.add.graphics();
      if (i === this.listIndex) g.fillStyle(0xffffff, 0.12).fillRect(SCREEN.x + 1, y - 1, SCREEN.w - 2, 17);
      g.fillStyle(hex(contact.color), 1).fillCircle(SCREEN.x + 10, y + 7, 6);
      this.screen.add(g);
      this.screen.add(this.text(SCREEN.x + 10, y + 7, contact.name.charAt(0), { fontSize: '8px', fontStyle: '600' }).setOrigin(0.5));
      this.screen.add(this.text(SCREEN.x + 21, y + 2, contact.name, { fontSize: '8px', fontStyle: '600' }));
    });
    if (this.dialNote) {
      this.screen.add(
        this.text(SCREEN.x + SCREEN.w / 2, SCREEN.y + SCREEN.h - 30, this.dialNote, {
          fontSize: '8px',
          color: '#ff9a7a',
          align: 'center',
          wordWrap: { width: SCREEN.w - 8 },
        }).setOrigin(0.5, 0),
      );
    }
    this.footer('E: llamar · Q: volver');
  }

  private renderMail(): void {
    this.header('Mi U · Correo');
    const list = this.visibleMail();
    if (list.length === 0) {
      this.screen.add(this.text(SCREEN.x + 6, SCREEN.y + 34, 'No tienes correos.', { fontSize: '8px', color: '#c8d0e8' }));
    }
    list.slice(0, 5).forEach((id, i) => {
      const mail = PHONE.mail[id];
      const y = SCREEN.y + STATUS_H + 16 + i * 22;
      const g = this.scene.add.graphics();
      if (i === this.listIndex) g.fillStyle(0xffffff, 0.12).fillRect(SCREEN.x + 1, y - 1, SCREEN.w - 2, 21);
      if (!StoryState.hasFlag(`correo_${id}`)) g.fillStyle(0x9a6cf0, 1).fillCircle(SCREEN.x + 5, y + 4, 2.5);
      this.screen.add(g);
      const from = this.text(SCREEN.x + 10, y, '', { fontSize: '8px', fontStyle: '600' });
      fitText(from, mail.from, SCREEN.w - 14);
      const subject = this.text(SCREEN.x + 10, y + 9, '', { fontSize: '8px', color: '#a8b4d0' });
      fitText(subject, mail.subject, SCREEN.w - 14);
      this.screen.add([from, subject]);
    });
    this.footer('E: leer · Q: volver');
  }

  private renderMailRead(): void {
    const mail = PHONE.mail[this.mailId];
    this.header('Mi U · Correo');
    if (!mail) return;
    const top = SCREEN.y + STATUS_H + 14;
    const bottom = SCREEN.y + SCREEN.h - 12;
    const content = this.scene.add.container(0, 0);
    const wrap = { width: SCREEN.w - 10, useAdvancedWrap: true };
    const subject = this.text(SCREEN.x + 5, 0, mail.subject, { fontSize: '8px', fontStyle: '600', wordWrap: wrap });
    const from = this.text(SCREEN.x + 5, subject.height + 2, `De: ${mail.from}`, { fontSize: '7px', color: '#a8b4d0', wordWrap: wrap });
    const lineY = from.y + from.height + 3;
    const line = this.scene.add.graphics().fillStyle(0xffffff, 0.2).fillRect(SCREEN.x + 5, lineY, SCREEN.w - 10, 1);
    const body = this.text(SCREEN.x + 5, lineY + 4, mail.text, { fontSize: '8px', color: '#e0e6f8', wordWrap: wrap, lineSpacing: 1 });
    content.add([subject, from, line, body]);
    this.threadMax = Math.max(0, body.y + body.height + 4 - (bottom - top));
    this.threadScroll = Phaser.Math.Clamp(this.threadScroll, 0, this.threadMax);
    content.setY(top - this.threadScroll);
    const maskShape = this.scene.make.graphics({}, false).fillRect(SCREEN.x, top, SCREEN.w, bottom - top);
    content.setMask(maskShape.createGeometryMask());
    this.screen.add(content);
    this.footer(this.threadMax > 0 ? 'W/S: desplazar · Q: volver' : 'Q: volver');
  }

  private header(title: string): void {
    const g = this.scene.add.graphics().fillStyle(0x000000, 0.25).fillRect(SCREEN.x, SCREEN.y + STATUS_H, SCREEN.w, 12);
    this.screen.add(g);
    this.screen.add(this.text(SCREEN.x + SCREEN.w / 2, SCREEN.y + STATUS_H + 1, title, { fontSize: '9px', fontStyle: '600' }).setOrigin(0.5, 0));
  }

  private footer(hint: string): void {
    const g = this.scene.add.graphics().fillStyle(0x000000, 0.35).fillRect(SCREEN.x, SCREEN.y + SCREEN.h - 11, SCREEN.w, 11);
    this.screen.add(g);
    this.screen.add(this.text(SCREEN.x + SCREEN.w / 2, SCREEN.y + SCREEN.h - 10, hint, { fontSize: '7px', color: '#a8b4d0' }).setOrigin(0.5, 0));
  }

  private text(
    x: number,
    y: number,
    value: string,
    style: Phaser.Types.GameObjects.Text.TextStyle = {},
  ): Phaser.GameObjects.Text {
    return makeText(this.scene, x, y, value, { color: THEME.white, ...style });
  }
}

interface Input {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  ok: boolean;
  back: boolean;
}

function snakeBest(): number {
  try {
    return Number(window.localStorage.getItem(SNAKE_BEST_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

function saveSnakeBest(score: number): void {
  try {
    window.localStorage.setItem(SNAKE_BEST_KEY, String(score));
  } catch {
    // Sin almacenamiento: el récord dura solo esta sesión.
  }
}
