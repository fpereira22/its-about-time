import Phaser from 'phaser';
import { playSfx } from '../audio/sfx';
import { BASE_WIDTH, FONT_HUD } from '../config/display';
import { EventSystem } from '../systems/EventSystem';
import { drawPanel, makeText } from './theme';

/** Encima del HUD (40) y debajo de la caja de diálogo (100). */
const DEPTH = 90;
const PANEL = { x: 10, y: 10, w: 300, h: 106 };
const ROW_H = 13;
const HEAD_H = 18;
/** Columnas de la tabla: hora, vuelo, destino/origen, puerta, estado. */
const COLS = [8, 40, 80, 160, 202];
const FLIP_MS = 320;
const ROW_DELAY_MS = 90;
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

const AMBER = '#f0c030';
const DIM = '#8a96b8';

type Status = 'ok' | 'boarding' | 'alert' | 'landed' | 'off';

const STATUS_COLOR: Record<Status, string> = {
  ok: '#58c878',
  boarding: '#f0c030',
  alert: '#f05050',
  landed: '#68b0f0',
  off: DIM,
};

interface Row {
  cells: [string, string, string, string, string];
  status: Status;
  /** Tu vuelo: fila resaltada. */
  mine?: boolean;
}

interface TableBoard {
  kind: 'table';
  title: string;
  heads: [string, string, string, string, string];
  rows: Row[];
}

/** Pantalla chica sobre una puerta de embarque: un solo vuelo. */
interface GateBoard {
  kind: 'gate';
  gate: string;
  flight: string;
  city: string;
  lines: [string, string][];
  status: [string, Status];
  mine?: boolean;
}

type Board = TableBoard | GateBoard;

const SALIDAS: [string, string, string, string, string] = ['HORA', 'VUELO', 'DESTINO', 'PUERTA', 'ESTADO'];

/** Pantallas de vuelos y trenes (ids de los efectos `board`). */
const BOARDS: Record<string, Board> = {
  salidas_paine: {
    kind: 'table',
    title: 'PRÓXIMAS SALIDAS · ESTACIÓN PAINE',
    heads: ['HORA', 'TREN', 'DESTINO', 'ANDÉN', 'ESTADO'],
    rows: [
      { cells: ['07:30', 'TS 301', 'EST. CENTRAL', '1', 'A TIEMPO'], status: 'ok', mine: true },
      { cells: ['08:00', 'TS 303', 'EST. CENTRAL', '1', 'A TIEMPO'], status: 'ok' },
      { cells: ['08:30', 'TS 305', 'EST. CENTRAL', '1', 'PROGRAMADO'], status: 'off' },
    ],
  },
  salidas_scl: {
    kind: 'table',
    title: 'SALIDAS INTERNACIONALES',
    heads: ['HORA', 'VUELO', 'DESTINO', 'CHECK-IN', 'ESTADO'],
    rows: [
      { cells: ['00:35', 'PX 204', 'LIMA', 'ISLA A', 'A TIEMPO'], status: 'ok' },
      { cells: ['01:15', 'TQ 518', 'PUNTA CANA', 'ISLA C', 'A TIEMPO'], status: 'ok' },
      { cells: ['01:50', 'CA 742', 'CALI', 'ISLA B', 'A TIEMPO'], status: 'ok', mine: true },
      { cells: ['02:30', 'MZ 090', 'MADRID', 'ISLA C', 'A TIEMPO'], status: 'ok' },
      { cells: ['05:40', 'RX 411', 'BUENOS AIRES', 'ISLA A', 'A TIEMPO'], status: 'ok' },
    ],
  },
  salidas_t2: {
    kind: 'table',
    title: 'SALIDAS · TERMINAL 2',
    heads: SALIDAS,
    rows: [
      { cells: ['00:35', 'PX 204', 'LIMA', 'E2', 'EMBARCANDO'], status: 'boarding' },
      { cells: ['01:15', 'TQ 518', 'PUNTA CANA', 'E4', 'A TIEMPO'], status: 'ok' },
      { cells: ['01:50', 'CA 742', 'CALI', 'D6', 'CAMBIO PUERTA'], status: 'alert', mine: true },
      { cells: ['02:30', 'MZ 090', 'MADRID', 'E6', 'A TIEMPO'], status: 'ok' },
      { cells: ['05:40', 'RX 411', 'BUENOS AIRES', 'D2', 'A TIEMPO'], status: 'ok' },
    ],
  },
  llegadas_clo: {
    kind: 'table',
    title: 'LLEGADAS · CALI',
    heads: ['HORA', 'VUELO', 'ORIGEN', 'CINTA', 'ESTADO'],
    rows: [
      { cells: ['05:10', 'KV 902', 'BOGOTÁ', '1', 'ATERRIZÓ'], status: 'landed' },
      { cells: ['05:35', 'CA 742', 'SANTIAGO', '2', 'ATERRIZÓ'], status: 'landed', mine: true },
      { cells: ['06:20', 'TQ 377', 'MIAMI', '-', 'EN VUELO'], status: 'ok' },
      { cells: ['06:45', 'PX 615', 'PANAMÁ', '-', 'EN VUELO'], status: 'ok' },
      { cells: ['07:30', 'KV 948', 'MEDELLÍN', '-', 'PROGRAMADO'], status: 'off' },
    ],
  },
  puerta_d6: {
    kind: 'gate',
    gate: 'D6',
    flight: 'CA 742',
    city: 'CALI',
    lines: [
      ['SALE', '01:50'],
      ['EMBARQUE', '01:10'],
      ['ASIENTO', '18A'],
    ],
    status: ['A TIEMPO', 'ok'],
    mine: true,
  },
  puerta_e4: {
    kind: 'gate',
    gate: 'E4',
    flight: 'TQ 518',
    city: 'PUNTA CANA',
    lines: [
      ['SALE', '01:15'],
      ['EMBARQUE', '00:35'],
    ],
    status: ['A TIEMPO', 'ok'],
  },
};

interface FlipCell {
  text: Phaser.GameObjects.Text;
  final: string;
  startAt: number;
}

/**
 * Pantallas de vuelos dibujadas (misión 3): tabla de salidas/llegadas o pantalla de puerta.
 * Las abre el efecto `board` de un diálogo y se guardan solas al cerrarse el diálogo.
 */
export class FlightBoard {
  private root: Phaser.GameObjects.Container | null = null;
  private flips: FlipCell[] = [];
  private elapsed = 0;
  private readonly onUpdate = (_t: number, delta: number): void => this.tick(delta);

  constructor(private readonly scene: Phaser.Scene) {
    EventSystem.onScene(scene, 'board', (id) => (id ? this.show(id) : this.hide()));
    EventSystem.onScene(scene, 'dialogue-close', () => this.hide());
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.onUpdate);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, this.onUpdate));
  }

  private show(id: string): void {
    const board = BOARDS[id];
    if (!board) {
      console.error(`Pantalla de vuelos "${id}" no existe`);
      return;
    }
    this.hide(true);
    this.flips = [];
    this.elapsed = 0;
    const root = this.scene.add.container(PANEL.x, PANEL.y).setDepth(DEPTH);
    this.root = root;
    if (board.kind === 'table') this.buildTable(root, board);
    else this.buildGate(root, board);
    playSfx('anuncio');
    root.setAlpha(0).setY(PANEL.y - 6);
    this.scene.tweens.add({ targets: root, alpha: 1, y: PANEL.y, duration: 160, ease: 'Cubic.Out' });
  }

  private frame(root: Phaser.GameObjects.Container, w: number, h: number): Phaser.GameObjects.Graphics {
    const g = this.scene.add.graphics();
    drawPanel(g, 0, 0, w, h, { radius: 4, fill: 0x0c1020, edge: 0x3a4460 });
    // Marco de la pantalla y patas.
    g.fillStyle(0x3a4460, 1).fillRect(w / 2 - 30, h, 4, 4).fillRect(w / 2 + 26, h, 4, 4);
    root.add(g);
    return g;
  }

  private buildTable(root: Phaser.GameObjects.Container, board: TableBoard): void {
    const { w } = PANEL;
    const h = HEAD_H + 12 + board.rows.length * ROW_H + 6;
    const g = this.frame(root, w, h);
    g.fillStyle(0x1c2440, 1).fillRect(3, 3, w - 6, HEAD_H - 4);
    root.add(makeText(this.scene, 8, 6, board.title, { fontFamily: FONT_HUD, fontSize: '8px', color: '#ffffff' }));

    const headY = HEAD_H + 1;
    board.heads.forEach((head, i) => {
      root.add(makeText(this.scene, COLS[i], headY, head, { fontSize: '7px', color: DIM }));
    });
    board.rows.forEach((row, r) => {
      const y = HEAD_H + 12 + r * ROW_H;
      if (r % 2 === 1) g.fillStyle(0x141a30, 1).fillRect(3, y - 1, w - 6, ROW_H);
      if (row.mine) {
        g.fillStyle(0x24508e, 0.55).fillRect(3, y - 1, w - 6, ROW_H);
        g.fillStyle(0xf0c030, 1).fillRect(3, y - 1, 2, ROW_H);
      }
      row.cells.forEach((cell, c) => {
        const color = c === 4 ? STATUS_COLOR[row.status] : row.mine ? '#ffffff' : AMBER;
        const text = makeText(this.scene, COLS[c], y + 1, '', { fontFamily: FONT_HUD, fontSize: '8px', color });
        root.add(text);
        this.flips.push({ text, final: cell, startAt: r * ROW_DELAY_MS + c * 30 });
        // Lo urgente parpadea (cambio de puerta).
        if (c === 4 && row.status === 'alert') {
          this.scene.tweens.add({ targets: text, alpha: 0.25, duration: 380, yoyo: true, repeat: -1, delay: FLIP_MS + 400 });
        }
      });
    });
  }

  private buildGate(root: Phaser.GameObjects.Container, board: GateBoard): void {
    const w = 190;
    const h = 92;
    root.setX((BASE_WIDTH - w) / 2);
    const g = this.frame(root, w, h);
    g.fillStyle(0x24508e, 1).fillRoundedRect(6, 6, 58, h - 12, 3);
    root.add(makeText(this.scene, 35, 12, 'PUERTA', { fontSize: '7px', color: '#c8d8f0' }).setOrigin(0.5, 0));
    root.add(makeText(this.scene, 35, 26, board.gate, { fontFamily: FONT_HUD, fontSize: '24px', color: '#ffffff' }).setOrigin(0.5, 0));
    if (board.mine) {
      root.add(makeText(this.scene, 35, h - 22, 'TU VUELO', { fontFamily: FONT_HUD, fontSize: '8px', color: AMBER }).setOrigin(0.5, 0));
    }

    const x = 72;
    const flight = makeText(this.scene, x, 8, '', { fontFamily: FONT_HUD, fontSize: '8px', color: DIM });
    const city = makeText(this.scene, x, 18, '', { fontFamily: FONT_HUD, fontSize: '16px', color: AMBER });
    root.add([flight, city]);
    this.flips.push({ text: flight, final: board.flight, startAt: 0 }, { text: city, final: board.city, startAt: 60 });
    board.lines.forEach(([label, value], i) => {
      const y = 40 + i * 11;
      root.add(makeText(this.scene, x, y, label, { fontSize: '7px', color: DIM }));
      const v = makeText(this.scene, x + 52, y - 1, '', { fontFamily: FONT_HUD, fontSize: '8px', color: '#ffffff' });
      root.add(v);
      this.flips.push({ text: v, final: value, startAt: 120 + i * ROW_DELAY_MS });
    });
    const [label, status] = board.status;
    const s = makeText(this.scene, x, h - 14, '', { fontFamily: FONT_HUD, fontSize: '8px', color: STATUS_COLOR[status] });
    root.add(s);
    this.flips.push({ text: s, final: label, startAt: 400 });
  }

  /** Efecto de paletas: cada celda muestra letras al azar hasta asentarse en su texto. */
  private tick(delta: number): void {
    if (!this.root || this.flips.length === 0) return;
    this.elapsed += delta;
    let settled = 0;
    for (const f of this.flips) {
      const t = this.elapsed - f.startAt;
      if (t < 0) continue;
      if (t >= FLIP_MS) {
        if (f.text.text !== f.final) f.text.setText(f.final);
        settled++;
        continue;
      }
      // Las letras se van fijando de izquierda a derecha.
      const fixed = Math.floor((t / FLIP_MS) * f.final.length);
      let out = f.final.slice(0, fixed);
      for (let i = fixed; i < f.final.length; i++) {
        out += f.final[i] === ' ' ? ' ' : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      }
      f.text.setText(out);
    }
    if (settled === this.flips.length) this.flips = [];
  }

  private hide(immediate = false): void {
    const root = this.root;
    if (!root) return;
    this.root = null;
    this.flips = [];
    this.scene.tweens.killTweensOf(root);
    root.each((child: Phaser.GameObjects.GameObject) => this.scene.tweens.killTweensOf(child));
    if (immediate) {
      root.destroy();
      return;
    }
    this.scene.tweens.add({ targets: root, alpha: 0, duration: 140, onComplete: () => root.destroy() });
  }
}
