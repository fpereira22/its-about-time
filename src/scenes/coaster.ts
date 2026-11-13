/**
 * Montañas rusas de la misión 8 (el Krater y el Yippe), vistas de lado. La pista es un camino paramétrico
 * remuestreado cada STEP px de largo: así puede tener loops (donde la x vuelve hacia atrás), subidas con cadena,
 * túneles y sacacorchos. Las zonas (`station`, `lift`, `loop`...) le dicen a la escena cómo moverse y qué dibujar.
 */

export type CoasterZone = 'station' | 'lift' | 'crest' | 'loop' | 'tunnel' | 'corkscrew' | 'helix' | 'low' | 'brake';

export interface Sample {
  x: number;
  y: number;
  /** Ángulo de la tangente (radianes, 0 = hacia la derecha; y crece hacia abajo). */
  a: number;
}

export interface ZoneSpan {
  kind: CoasterZone;
  from: number;
  to: number;
}

export const STEP = 2;

export class CoasterPath {
  constructor(
    readonly pts: Sample[],
    readonly zones: ZoneSpan[],
    readonly marks: Record<string, number>,
    /** y del suelo (mundo). */
    readonly ground: number,
  ) {}

  get length(): number {
    return (this.pts.length - 1) * STEP;
  }

  at(s: number): Sample {
    const f = Math.max(0, Math.min(this.pts.length - 1.001, s / STEP));
    const i = Math.floor(f);
    const t = f - i;
    const p = this.pts[i];
    const q = this.pts[i + 1];
    let da = q.a - p.a;
    if (da > Math.PI) da -= Math.PI * 2;
    if (da < -Math.PI) da += Math.PI * 2;
    return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t, a: p.a + da * t };
  }

  zone(s: number): ZoneSpan | undefined {
    return this.zones.find((z) => s >= z.from && s < z.to);
  }

  /** Curvatura (cambio de ángulo por px): positiva en los valles (te aplasta), negativa en las crestas (airtime). */
  curvature(s: number): number {
    const a0 = this.at(s - 6).a;
    const a1 = this.at(s + 6).a;
    let d = a1 - a0;
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d / 12;
  }

  mark(name: string): number {
    const s = this.marks[name];
    if (s === undefined) throw new Error(`coaster: no existe la marca "${name}"`);
    return s;
  }
}

/** Arma la pista con tramos y la remuestrea por largo de arco. */
export class PathBuilder {
  private readonly raw: Array<[number, number]> = [];
  private len = 0;
  private readonly marks: Record<string, number> = {};
  private readonly zones: ZoneSpan[] = [];
  private openZone: { kind: CoasterZone; from: number } | null = null;

  constructor(x: number, y: number, private readonly ground: number) {
    this.raw.push([x, y]);
  }

  get x(): number {
    return this.raw[this.raw.length - 1][0];
  }

  get y(): number {
    return this.raw[this.raw.length - 1][1];
  }

  private add(x: number, y: number): void {
    const [px, py] = this.raw[this.raw.length - 1];
    const d = Math.hypot(x - px, y - py);
    if (d < 0.01) return;
    this.len += d;
    this.raw.push([x, y]);
  }

  line(x: number, y: number): this {
    const x0 = this.x;
    const y0 = this.y;
    const n = Math.max(1, Math.ceil(Math.hypot(x - x0, y - y0)));
    for (let i = 1; i <= n; i++) this.add(x0 + ((x - x0) * i) / n, y0 + ((y - y0) * i) / n);
    return this;
  }

  /** Línea relativa. */
  by(dx: number, dy: number): this {
    return this.line(this.x + dx, this.y + dy);
  }

  /** Curva cuadrática con punto de control (cx, cy). */
  curve(cx: number, cy: number, x: number, y: number): this {
    const x0 = this.x;
    const y0 = this.y;
    const n = Math.max(4, Math.ceil(Math.hypot(cx - x0, cy - y0) + Math.hypot(x - cx, y - cy)));
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const u = 1 - t;
      this.add(u * u * x0 + 2 * u * t * cx + t * t * x, u * u * y0 + 2 * u * t * cy + t * t * y);
    }
    return this;
  }

  /** Loop vertical desde el punto actual (yendo a la derecha); sale `shift` px más adelante. */
  loop(r: number, shift: number): this {
    const x0 = this.x;
    const y0 = this.y;
    const n = Math.ceil(Math.PI * 2 * r);
    for (let i = 1; i <= n; i++) {
      const th = (i / n) * Math.PI * 2;
      this.add(x0 + r * Math.sin(th) + (shift * th) / (Math.PI * 2), y0 - r + r * Math.cos(th));
    }
    return this;
  }

  /** Lomas suaves (coseno alzado) desde la altura actual: [largo, alto] cada una. */
  hills(list: Array<[number, number]>): this {
    const base = this.y;
    for (const [len, amp] of list) {
      const x0 = this.x;
      const n = Math.ceil(len);
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        this.add(x0 + len * t, base - (amp * (1 - Math.cos(Math.PI * 2 * t))) / 2);
      }
    }
    return this;
  }

  /** Ondas chicas para arriba y para abajo (la hélice, vista de lado). */
  waves(count: number, len: number, amp: number): this {
    const base = this.y;
    const x0 = this.x;
    const n = Math.ceil(count * len);
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      this.add(x0 + count * len * t, base - amp * Math.sin(Math.PI * 2 * count * t));
    }
    return this;
  }

  begin(kind: CoasterZone): this {
    this.end();
    this.openZone = { kind, from: this.len };
    return this;
  }

  end(): this {
    if (this.openZone) this.zones.push({ ...this.openZone, to: this.len });
    this.openZone = null;
    return this;
  }

  mark(name: string): this {
    this.marks[name] = this.len;
    return this;
  }

  build(): CoasterPath {
    this.end();
    // Remuestreo por largo de arco.
    const out: Array<[number, number]> = [this.raw[0]];
    let need = STEP;
    let acc = 0;
    for (let i = 1; i < this.raw.length; i++) {
      const [ax, ay] = this.raw[i - 1];
      const [bx, by] = this.raw[i];
      const d = Math.hypot(bx - ax, by - ay);
      let used = 0;
      while (acc + (d - used) >= need) {
        const take = need - acc;
        used += take;
        const t = used / d;
        out.push([ax + (bx - ax) * t, ay + (by - ay) * t]);
        acc = 0;
        need = STEP;
      }
      acc += d - used;
    }
    const pts: Sample[] = out.map(([x, y], i) => {
      const [x0, y0] = out[Math.max(0, i - 2)];
      const [x1, y1] = out[Math.min(out.length - 1, i + 2)];
      return { x, y, a: Math.atan2(y1 - y0, x1 - x0) };
    });
    return new CoasterPath(pts, this.zones, this.marks, this.ground);
  }
}

const GROUND = 176;

/**
 * El Krater: estación, subida con cadena (la eterna), caída al valle con la cámara de la foto, loop, cuatro lomas de
 * airtime, la pasada rasante por el cafetal, la segunda cadena por la ladera del volcán, la caída al cráter (túnel
 * con lava), el doble loop, el sacacorchos, la hélice, dos saltitos y los frenos.
 */
export function buildKrater(): CoasterPath {
  const b = new PathBuilder(-60, 150, GROUND);
  b.begin('station').line(150, 150).end();
  b.curve(190, 150, 214, 138);
  b.begin('lift').line(520, -176).end();
  b.begin('crest').curve(546, -202, 578, -184).end();
  b.mark('drop');
  b.line(664, 70).curve(690, 170, 760, 170);
  b.mark('photo');
  b.line(860, 170);
  b.mark('loop1');
  b.begin('loop').loop(62, 34).end();
  b.line(960, 170);
  b.mark('hills');
  b.hills([[170, 116], [150, 92], [130, 70], [114, 48]]);
  b.line(1560, 170);
  b.mark('low');
  b.begin('low').curve(1600, 172, 1640, 166).hills([[120, 18], [110, 14], [100, 10]]).line(2010, 168).end();
  b.curve(2050, 170, 2074, 156);
  b.mark('lift2');
  b.begin('lift').line(2290, -48).end();
  b.begin('crest').curve(2310, -68, 2336, -54).end();
  b.mark('crater');
  b.line(2400, 70).curve(2420, 154, 2470, 160);
  b.begin('tunnel').line(2540, 160).curve(2580, 178, 2620, 160).line(2760, 158).end();
  b.mark('tunnelOut');
  b.line(2800, 166);
  b.mark('loop2');
  b.begin('loop').loop(54, 30).end();
  b.line(2880, 166);
  b.begin('loop').loop(46, 30).end();
  b.line(2960, 166).curve(3010, 166, 3040, 134);
  b.mark('cork');
  b.begin('corkscrew').line(3240, 118).end();
  b.curve(3280, 112, 3320, 140).line(3360, 156);
  b.mark('helix');
  b.begin('helix').waves(6, 64, 20).end();
  b.mark('hops');
  b.hills([[96, 34], [86, 24], [76, 14]]);
  b.line(4050, 150);
  b.begin('brake').line(4330, 150).end();
  b.begin('station').line(4510, 150).end();
  return b.build();
}

/** El Yippe: la montaña rusa de los niños (y de Renzo). Una subidita, una bajadita, saltitos y una curva. */
export function buildYippe(): CoasterPath {
  const b = new PathBuilder(-60, 150, GROUND);
  b.begin('station').line(130, 150).end();
  b.curve(160, 150, 180, 142);
  b.begin('lift').line(330, 40).end();
  b.begin('crest').curve(348, 26, 370, 36).end();
  b.mark('drop');
  b.line(430, 130).curve(450, 166, 500, 166);
  b.mark('hops');
  b.hills([[90, 40], [80, 30], [70, 22], [64, 16]]);
  b.line(880, 166);
  b.mark('helix');
  b.begin('helix').waves(4, 56, 14).end();
  b.mark('hops2');
  b.hills([[70, 20], [60, 12]]);
  b.line(1340, 150);
  b.begin('brake').line(1520, 150).end();
  b.begin('station').line(1650, 150).end();
  return b.build();
}
