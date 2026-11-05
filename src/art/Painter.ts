/** Dibuja rectángulos de color sobre un canvas, desplazado a una celda de 16×16. */
export class Painter {
  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    private readonly ox = 0,
    private readonly oy = 0,
    readonly size = 16,
  ) {}

  rect(x: number, y: number, w: number, h: number, color: string): this {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(this.ox + x, this.oy + y, w, h);
    return this;
  }

  px(x: number, y: number, color: string): this {
    return this.rect(x, y, 1, 1, color);
  }

  fill(color: string): this {
    return this.rect(0, 0, this.size, this.size, color);
  }

  pixels(points: ReadonlyArray<readonly [number, number]>, color: string): this {
    for (const [x, y] of points) this.px(x, y, color);
    return this;
  }

  /** Puntos pseudoaleatorios deterministas (mismo seed = mismo dibujo). */
  speckle(seed: number, count: number, color: string): this {
    const rnd = mulberry32(seed);
    for (let i = 0; i < count; i++) {
      this.px(Math.floor(rnd() * this.size), Math.floor(rnd() * this.size), color);
    }
    return this;
  }
}

/**
 * Grilla de píxeles para sprites (personajes y objetos).
 * Permite dibujar con plantillas ASCII o rectángulos y luego agregar contorno automático.
 */
export class PixelGrid {
  private readonly cells: (string | null)[];

  constructor(
    readonly w = 16,
    readonly h = 16,
  ) {
    this.cells = new Array<string | null>(w * h).fill(null);
  }

  static fromTemplate(rows: readonly string[], colors: Record<string, string>): PixelGrid {
    const grid = new PixelGrid(rows[0]?.length ?? 16, rows.length);
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '.') continue;
        const color = colors[ch];
        if (color === undefined) throw new Error(`Color no definido para '${ch}' en plantilla`);
        grid.set(x, y, color);
      }
    });
    return grid;
  }

  get(x: number, y: number): string | null {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    return this.cells[y * this.w + x];
  }

  set(x: number, y: number, color: string | null): this {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
    this.cells[y * this.w + x] = color;
    return this;
  }

  rect(x: number, y: number, w: number, h: number, color: string): this {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, color);
    return this;
  }

  /** Círculo relleno con centro (cx, cy) en coordenadas de píxel. */
  circle(cx: number, cy: number, r: number, color: string): this {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r) this.set(x, y, color);
      }
    }
    return this;
  }

  /** Pinta de `color` cada celda vacía que toque (4 vecinos) una celda llena. */
  outline(color: string): this {
    const snapshot = [...this.cells];
    const filled = (x: number, y: number): boolean =>
      x >= 0 && y >= 0 && x < this.w && y < this.h && snapshot[y * this.w + x] !== null;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (snapshot[y * this.w + x] !== null) continue;
        if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) {
          this.set(x, y, color);
        }
      }
    }
    return this;
  }

  mirrored(): PixelGrid {
    const out = new PixelGrid(this.w, this.h);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) out.set(this.w - 1 - x, y, this.get(x, y));
    }
    return out;
  }

  draw(ctx: CanvasRenderingContext2D, ox: number, oy: number): void {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const c = this.cells[y * this.w + x];
        if (c === null) continue;
        ctx.fillStyle = c;
        ctx.fillRect(ox + x, oy + y, 1, 1);
      }
    }
  }
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash entero estable para elegir variantes por posición. */
export function hash2(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}
