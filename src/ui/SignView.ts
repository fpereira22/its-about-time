import Phaser from 'phaser';
import { playSfx } from '../audio/sfx';
import { BASE_WIDTH, FONT_HUD } from '../config/display';
import { EventSystem } from '../systems/EventSystem';
import { buildArtSign, type ArtSign } from './SignArt';
import { drawPanel, makeText, THEME } from './theme';

/** Encima del HUD (40) y debajo de la caja de diálogo (100). */
const DEPTH = 90;
const TOP = 8;
const CHALK = '#e8efe4';
const CHALK_DIM = '#a8c0ac';
const CHALK_HEX = 0xe8efe4;
const CHALK_YELLOW = '#f0e070';
/** Ms entre cada paso de la cinta de noticias. */
const TICKER_STEP_MS = 140;

type Arrow = 'left' | 'right' | 'down';

/** Tele con noticias: banda inferior, cinta que corre y un dibujo según la noticia. */
interface TvSign {
  kind: 'tv';
  tag: string;
  tagColor: number;
  /** Etiqueta roja de la esquina ("EN VIVO", "RESUMEN"). */
  live: string;
  headline: string;
  ticker: string;
  icon: 'frio' | 'sol' | 'pelota';
  /** Texto grande sobre el fondo (ej. "29°", "2 - 1"). */
  big?: string;
}

/** Letrero de paradero de micros (estilo Red Movilidad: negro, con grilla de recorridos). */
interface StopSign {
  kind: 'paradero';
  code: string;
  /** Número de "Parada N" del cuadrito blanco de arriba. */
  stop: number;
  /** Nombre de la parada en dos líneas. */
  name: [string, string];
  /** `scratched`: número tachado con plumón (vandalizado). */
  routes: { num: string; dest: string; scratched?: boolean }[];
}

/** Cartel de estación o edificio. `placa`: placa metálica atornillada (puertas, oficinas). */
interface StationSign {
  kind: 'station';
  style: 'efe' | 'metro' | 'uni' | 'placa';
  title: string;
  lines: string[];
  arrow?: Arrow;
  w?: number;
  /** Franja de peligro roja y blanca abajo (accesos cerrados). */
  warn?: boolean;
}

/**
 * Cartel o nota escrita a mano. `carton` (por defecto) es el de los choferes del aeropuerto: primera
 * línea grande y la segunda chica. Los demás papeles se ajustan al largo y la cantidad de líneas.
 */
interface HandSign {
  kind: 'mano';
  lines: string[];
  ink: string;
  heart?: boolean;
  /** Soporte: cartón, hoja blanca, post-it, espejo (escrito con lápiz labial) o tabla de madera pintada. */
  paper?: 'carton' | 'papel' | 'postit' | 'espejo' | 'madera';
  /** Imán que sujeta el papel (refri). Sin imán, la hoja va con cinta adhesiva. */
  magnet?: 'sandia' | 'redondo';
  /** Letra manuscrita (cursiva), ej. la de la mamá. */
  script?: boolean;
  /** Primera línea más grande (título del aviso). */
  big?: boolean;
  /** Subraya la última línea dos veces. */
  underline?: boolean;
  /** Post-it amarillento de viejo. */
  old?: boolean;
  /** Dibujito en la esquina. */
  deco?: 'sandia';
  /** Firma alineada a la derecha, bajo las líneas. */
  firma?: string;
}

type Sign =
  | TvSign
  | StopSign
  | StationSign
  | HandSign
  | ArtSign
  | { kind: 'pizarra' }
  | { kind: 'prueba' }
  | { kind: 'mural' }
  | { kind: 'mapa' };

/** Tinta y letra de la mamá (nota del refri en las misiones 2 y 3). */
const MAMA = { ink: '#2a48a0', script: true } as const;

/** Carteles de las misiones (ids de los efectos `sign`). */
const SIGNS: Record<string, Sign> = {
  tele_noticias: {
    kind: 'tv',
    tag: 'ÚLTIMA HORA',
    tagColor: 0xc8202c,
    live: 'EN VIVO',
    headline: 'LUNES HELADO EN LA ZONA CENTRAL',
    ticker: 'TRENES Y METRO OPERAN CON NORMALIDAD · MÍNIMA DE -2° EN SANTIAGO · ABRÍGUESE',
    icon: 'frio',
    big: '-2°',
  },
  tele_futbol: {
    kind: 'tv',
    tag: 'DEPORTES',
    tagColor: 0x2f8a4a,
    live: 'RESUMEN',
    headline: 'GOLAZO AL ÚLTIMO MINUTO Y PENAL POLÉMICO',
    ticker: 'EL ÁRBITRO NO VIO NADA · LOS HINCHAS PIDEN VAR · PRÓXIMA FECHA EL SÁBADO',
    icon: 'pelota',
    big: '2 - 1',
  },
  tele_clima_cali: {
    kind: 'tv',
    tag: 'EL TIEMPO',
    tagColor: 0xe0802c,
    live: 'EN VIVO',
    headline: 'MAÑANA EN CALI: 29° Y SOL',
    ticker: 'ÍNDICE UV MUY ALTO · USE BLOQUEADOR · SANTIAGO: 4° Y NUBLADO',
    icon: 'sol',
    big: '29°',
  },
  paradero_pa421: {
    kind: 'paradero',
    code: 'PA421',
    stop: 3,
    name: ['Av. Providencia', 'Metro Baquedano'],
    routes: [
      { num: '2_0', dest: 'a Mapocho', scratched: true },
      { num: '4_1', dest: 'a Vitacura', scratched: true },
    ],
  },
  paradero_providencia: {
    kind: 'paradero',
    code: 'PA433',
    stop: 1,
    name: ['Av. Providencia', 'esq. Seminario'],
    routes: [{ num: '411', dest: 'a Las Condes' }],
  },
  estacion_paine: { kind: 'station', style: 'efe', title: 'PAINE', lines: ['Trenes a Estación Central'], arrow: 'right' },
  anden_paine: { kind: 'station', style: 'efe', title: 'ANDÉN', lines: ['Trenes a Estación Central', 'Próximo tren: 07:30'], arrow: 'right' },
  metro_san_pablo: { kind: 'station', style: 'metro', title: 'DIRECCIÓN SAN PABLO', lines: ['Andén hacia el poniente'], arrow: 'left' },
  metro_los_dominicos: { kind: 'station', style: 'metro', title: 'DIRECCIÓN LOS DOMINICOS', lines: ['Andén hacia el oriente'], arrow: 'right' },
  metro_combinacion: { kind: 'station', style: 'metro', title: 'METRO LÍNEA 1', lines: ['Por el pasillo, bajando', 'Combinación con trenes al sur'], arrow: 'down' },
  uav: {
    kind: 'station',
    style: 'uni',
    title: 'UNIVERSIDAD ANTONIO VARAS',
    lines: ['Antonio Varas 880', '← Edificio A1 (poniente) · Edificio A2 (oriente) →'],
    w: 236,
  },
  cartel_chofer: { kind: 'mano', lines: ['FELI P.', 'INTERCAMBIO PUCC'], ink: '#2040a0', heart: true },
  // --- Misión 4 (Cali) ---
  pucc: {
    kind: 'station',
    style: 'uni',
    title: 'UNIVERSIDAD CRISTIANA-CALEÑA',
    lines: ['Calle 18 · Pance, Cali', 'Plaza Central de frente · Cancha al sur, junto al Cedro Rosado'],
    w: 250,
  },
  paradero_cali: {
    kind: 'station',
    style: 'uni',
    title: 'PARADERO · RUTA P27',
    lines: ['Pance → Calle 18 → Universidades (y de vuelta)', 'Pasa cada 15 minutos (más o menos)'],
    w: 210,
  },
  horario_m4: {
    kind: 'mano',
    paper: 'papel',
    ink: '#2a48a0',
    big: true,
    lines: ['LUNES · PRIMER DÍA', '9:00  Encuentro intercambio · Plaza Central', '2:00 p.m.  Modelación Logística · EC 203', '4:30 p.m.  Partido vs. Ingeniería · Cancha'],
  },
  menu_cafeteria: {
    kind: 'mano',
    paper: 'madera',
    ink: '#f4f0e0',
    big: true,
    lines: ['CAFETERÍA CENTRAL', 'Pandebono $2.500 · Buñuelo $2.500', 'Empanada $2.000 · Tinto $1.500', 'Lulada $6.000'],
  },
  receta_fideos: {
    kind: 'mano',
    paper: 'postit',
    ink: '#2a2433',
    script: true,
    lines: ['Mijo: en la nevera hay', 'fideos, tomate y cebolla.', 'Hacete un hogao. ¡No', 'me queme la olla! — Mery'],
  },
  rutas: { kind: 'rutas' },
  rutas_vecino: { kind: 'rutas', ruta: 'vecino' },
  rutas_mala: { kind: 'rutas', ruta: 'mala' },
  rutas_camiones: { kind: 'rutas', ruta: 'camiones' },
  carnet_pucc: { kind: 'carnet_pucc' },
  mural_pucc: { kind: 'mural_pucc' },
  cartel_gomez: { kind: 'mano', lines: ['FAMILIA GÓMEZ'], ink: '#2a2433' },
  acceso_cerrado: {
    kind: 'station',
    style: 'metro',
    title: 'ACCESO CERRADO POR MANTENCIÓN',
    lines: ['Use el acceso del frente,', 'al otro lado de Av. Providencia'],
    w: 236,
    warn: true,
  },
  solo_personal: { kind: 'station', style: 'placa', title: 'SOLO PERSONAL AUTORIZADO', lines: ['Galería Los Leones · Acceso de servicio'], w: 200 },
  placa_of604: {
    kind: 'station',
    style: 'uni',
    title: 'OF. 604 · PROF. R. CUERVO',
    lines: ['Investigación de Operaciones', 'Atención de alumnos: lunes 10:00 a 11:00'],
    w: 210,
  },
  silencio: { kind: 'station', style: 'uni', title: 'SILENCIO', lines: ['Biblioteca · Sala de lectura'], w: 150 },
  papel_maquina_mala: {
    kind: 'mano',
    paper: 'papel',
    lines: ['ESTÁ MALA', 'Use la otra, la del fondo', 'a la izquierda'],
    ink: '#1a1a20',
    big: true,
  },
  papel_cambio_sala: {
    kind: 'mano',
    paper: 'papel',
    lines: ['PRUEBA DE OPTIMIZACIÓN:', 'CAMBIO DE SALA', 'REVISAR CORREO'],
    ink: '#c8202c',
    big: true,
    underline: true,
  },
  nota_mama_prueba: {
    kind: 'mano',
    paper: 'papel',
    ...MAMA,
    magnet: 'sandia',
    heart: true,
    lines: ['Hijo:', 'salí temprano a la pega. Te dejé', 'una marraqueta con palta.', '¡Mucho éxito en la prueba!', 'Te quiero.'],
    firma: 'Mamá',
  },
  papel_vuelo: {
    kind: 'mano',
    paper: 'papel',
    ...MAMA,
    magnet: 'sandia',
    big: true,
    underline: true,
    lines: ['CA 742 · 01:50', '¡NO OLVIDAR EL CARNET!'],
  },
  postit_carnet: { kind: 'mano', paper: 'postit', ink: '#c8202c', underline: true, lines: ['¡¡CARNET!!'] },
  postit_vuelvo: { kind: 'mano', paper: 'postit', old: true, ink: '#2a2433', script: true, lines: ['Vuelvo en', '5 minutos'] },
  espejo_bano: { kind: 'mano', paper: 'espejo', ink: '#d02838', script: true, lines: ['lo más óptimo', 'no existe'] },
  capital_sandia: { kind: 'mano', paper: 'madera', ink: '#f4f0e0', big: true, deco: 'sandia', lines: ['PAINE', 'CAPITAL DE LA SANDÍA'] },
  servilleta: { kind: 'servilleta' },
  cuaderno: { kind: 'cuaderno' },
  convenio_cali: { kind: 'convenio' },
  rayosx: { kind: 'rayosx' },
  balanza: { kind: 'balanza', var: 'peso', max: 23 },
  afiche_cine: { kind: 'afiche_cine' },
  botonera_ascensor: { kind: 'botonera' },
  kiosco_huella: { kind: 'kiosco' },
  menu_confiteria: { kind: 'confiteria' },
  pizarra_mochila: { kind: 'pizarra' },
  prueba: { kind: 'prueba' },
  diario_mural: { kind: 'mural' },
  mapa_barrio: { kind: 'mapa' },
};

/** Objetos de la prueba de la mochila (los mismos números que dicta el profe). */
const MOCHILA: { name: string; kg: number; val: number; icon: 'carpa' | 'saco' | 'cocinilla' | 'linterna' }[] = [
  { name: 'CARPA', kg: 6, val: 30, icon: 'carpa' },
  { name: 'SACO DE DORMIR', kg: 5, val: 20, icon: 'saco' },
  { name: 'COCINILLA', kg: 5, val: 20, icon: 'cocinilla' },
  { name: 'LINTERNA', kg: 1, val: 6, icon: 'linterna' },
];
const QUESTIONS = 6;

const STOPS = ['Baquedano', 'Salvador', 'Manuel Montt', 'Pedro de Valdivia', 'Los Leones', 'Tobalaba'];

interface Ticker {
  text: Phaser.GameObjects.Text;
  source: string;
  maxW: number;
  offset: number;
  acc: number;
}

/**
 * Carteles dibujados durante un diálogo: tele, paraderos, pizarra de la prueba, diario mural,
 * letreros de estación y mapa del barrio. Los abre el efecto `sign` y se guardan al cerrarse el diálogo.
 */
export class SignView {
  private root: Phaser.GameObjects.Container | null = null;
  private currentId = '';
  private ticker: Ticker | null = null;
  /** Prueba: círculos de las preguntas y cuál va. */
  private dots: { g: Phaser.GameObjects.Graphics; x: number; y: number }[] = [];
  private step = 0;
  /** Animaciones del cartel actual que hay que cortar al cerrarlo (contadores, trazos). */
  private tracked: Phaser.Tweens.Tween[] = [];
  private readonly onUpdate = (_t: number, delta: number): void => this.tick(delta);

  constructor(private readonly scene: Phaser.Scene) {
    EventSystem.onScene(scene, 'sign', ({ id, step }) => {
      if (!id) this.hide();
      else if (id === this.currentId && this.root) {
        if (step !== undefined) this.setStep(step);
      } else {
        this.show(id);
        if (step !== undefined) this.setStep(step);
      }
    });
    EventSystem.onScene(scene, 'sign-mark', (mark) => this.mark(mark));
    EventSystem.onScene(scene, 'dialogue-close', () => this.hide());
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.onUpdate);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, this.onUpdate));
  }

  private show(id: string): void {
    const sign = SIGNS[id];
    if (!sign) {
      console.error(`Cartel "${id}" no existe (src/ui/SignView.ts)`);
      return;
    }
    this.hide(true);
    this.currentId = id;
    this.dots = [];
    this.step = 0;
    this.marks.length = 0;
    const root = this.scene.add.container(0, TOP).setDepth(DEPTH);
    this.root = root;
    switch (sign.kind) {
      case 'tv':
        this.buildTv(root, sign);
        playSfx('click');
        break;
      case 'paradero':
        this.buildStop(root, sign);
        break;
      case 'station':
        this.buildStation(root, sign);
        break;
      case 'mano':
        this.buildHand(root, sign);
        playSfx('page');
        break;
      case 'pizarra':
      case 'prueba':
        this.buildChalkboard(root, sign.kind === 'prueba');
        break;
      case 'mural':
        this.buildMural(root);
        playSfx('page');
        break;
      case 'mapa':
        this.buildMap(root);
        break;
      default:
        buildArtSign(
          { scene: this.scene, root, text: (x, y, t, style) => this.text(x, y, t, style), track: (tw) => this.tracked.push(tw) },
          sign,
        );
    }
    const y = root.y;
    root.setAlpha(0).setY(y - 6);
    this.scene.tweens.add({ targets: root, alpha: 1, y, duration: 160, ease: 'Cubic.Out' });
  }

  private text(
    x: number,
    y: number,
    text: string,
    style: Phaser.Types.GameObjects.Text.TextStyle = {},
  ): Phaser.GameObjects.Text {
    return makeText(this.scene, x, y, text, { color: THEME.ink, ...style });
  }

  // ---------------------------------------------------------------------------
  // Tele
  // ---------------------------------------------------------------------------

  private buildTv(root: Phaser.GameObjects.Container, s: TvSign): void {
    const w = 232;
    const h = 108;
    root.setPosition((BASE_WIDTH - w) / 2, 4);
    const g = this.scene.add.graphics();
    const bodyH = h - 8;
    // Pata y base.
    g.fillStyle(0x23232b, 1).fillRect(w / 2 - 8, bodyH, 16, 5).fillRoundedRect(w / 2 - 32, bodyH + 4, 64, 4, 2);
    drawPanel(g, 0, 0, w, bodyH, { radius: 5, fill: 0x23232b, edge: 0x0e0e12 });
    const sx = 7;
    const sy = 6;
    const sw = w - 14;
    const sh = bodyH - 14;
    // Fondo del estudio: degradado en franjas.
    for (let i = 0; i < sh; i += 4) {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(0x2c5aa0),
        Phaser.Display.Color.ValueToColor(0x142850),
        sh,
        i,
      );
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1).fillRect(sx, sy + i, sw, Math.min(4, sh - i));
    }
    g.lineStyle(1, 0xffffff, 0.06);
    for (let x = sx + 12; x < sx + sw; x += 16) g.lineBetween(x, sy, x, sy + sh - 34);
    // LED de encendido.
    g.fillStyle(0x58c878, 1).fillRect(w - 10, bodyH - 5, 2, 2);
    root.add(g);

    this.drawTvIcon(g, s.icon, sx + sw - 44, sy + 26);
    if (s.big) root.add(this.text(sx + 10, sy + 20, s.big, { fontFamily: FONT_HUD, fontSize: '16px', color: '#ffffff' }));

    // Logo del canal y etiqueta de la esquina.
    g.fillStyle(0xffffff, 0.9).fillRoundedRect(sx + 4, sy + 4, 34, 11, 2);
    root.add(this.text(sx + 21, sy + 5, 'CANAL 5', { fontSize: '7px', fontStyle: '600' }).setOrigin(0.5, 0));
    const live = this.text(0, sy + 5, s.live, { fontSize: '6px', fontStyle: '600', color: '#ffffff' });
    const liveW = live.width + 10;
    g.fillStyle(0xd02828, 1).fillRoundedRect(sx + sw - 4 - liveW, sy + 4, liveW, 10, 3);
    g.fillStyle(0xffffff, 1).fillCircle(sx + sw - liveW + 1, sy + 9, 1.5);
    live.setX(sx + sw - 4 - liveW + 7);
    root.add(live);
    this.scene.tweens.add({ targets: live, alpha: 0.4, duration: 600, yoyo: true, repeat: -1 });

    // Banda inferior: etiqueta, titular y cinta.
    const by = sy + sh - 34;
    const tag = this.text(sx + 4, by + 1, s.tag, { fontFamily: FONT_HUD, fontSize: '8px', color: '#ffffff' });
    g.fillStyle(s.tagColor, 1).fillRect(sx, by, tag.width + 8, 11);
    g.fillStyle(0xf8f6f0, 1).fillRect(sx, by + 11, sw, 13);
    root.add([tag, this.text(sx + 4, by + 12, s.headline, { fontSize: '9px', fontStyle: '600' })]);
    g.fillStyle(0x0c1020, 1).fillRect(sx, sy + sh - 10, sw, 10);
    g.fillStyle(s.tagColor, 1).fillRect(sx, sy + sh - 10, 3, 10);
    const t = this.text(sx + 6, sy + sh - 9, '', { fontSize: '7px', color: '#f0c030' });
    root.add(t);
    this.ticker = { text: t, source: `${s.ticker}  ·  `, maxW: sw - 10, offset: 0, acc: 0 };
    this.renderTicker();
  }

  private drawTvIcon(g: Phaser.GameObjects.Graphics, icon: TvSign['icon'], cx: number, cy: number): void {
    if (icon === 'sol') {
      g.fillStyle(0xf0c030, 0.35).fillCircle(cx, cy, 17);
      g.lineStyle(2, 0xf8d848, 1);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.lineBetween(cx + Math.cos(a) * 13, cy + Math.sin(a) * 13, cx + Math.cos(a) * 19, cy + Math.sin(a) * 19);
      }
      g.fillStyle(0xf8d848, 1).fillCircle(cx, cy, 10);
      g.fillStyle(0xfff0a0, 1).fillCircle(cx - 3, cy - 3, 4);
    } else if (icon === 'frio') {
      // Nube con copos.
      g.fillStyle(0xdce6f4, 1).fillCircle(cx - 8, cy - 2, 8).fillCircle(cx + 2, cy - 7, 10).fillCircle(cx + 11, cy - 1, 7);
      g.fillRect(cx - 8, cy - 2, 19, 8);
      g.lineStyle(1, 0xffffff, 1);
      for (const [fx, fy] of [[-8, 14], [3, 18], [13, 13]]) {
        g.lineBetween(cx + fx - 3, cy + fy, cx + fx + 3, cy + fy);
        g.lineBetween(cx + fx, cy + fy - 3, cx + fx, cy + fy + 3);
        g.lineBetween(cx + fx - 2, cy + fy - 2, cx + fx + 2, cy + fy + 2);
        g.lineBetween(cx + fx - 2, cy + fy + 2, cx + fx + 2, cy + fy - 2);
      }
    } else {
      // Pelota sobre el pasto.
      g.fillStyle(0x2f8a4a, 1).fillRect(cx - 24, cy + 10, 48, 4);
      g.fillStyle(0xffffff, 1).fillCircle(cx, cy, 11);
      g.fillStyle(0x2a2433, 1).fillCircle(cx, cy, 4);
      g.fillCircle(cx - 8, cy - 6, 2.5).fillCircle(cx + 8, cy - 6, 2.5).fillCircle(cx - 7, cy + 7, 2.5).fillCircle(cx + 7, cy + 7, 2.5);
      g.lineStyle(1, 0x2a2433, 1).strokeCircle(cx, cy, 11);
    }
  }

  /** La cinta avanza de a una letra, como un letrero LED. */
  private renderTicker(): void {
    const tk = this.ticker;
    if (!tk) return;
    const src = tk.source;
    let out = '';
    for (let i = 0; i < 90; i++) out += src[(tk.offset + i) % src.length];
    tk.text.setText(out);
    while (tk.text.width > tk.maxW && out.length > 1) {
      out = out.slice(0, -1);
      tk.text.setText(out);
    }
  }

  private tick(delta: number): void {
    const tk = this.ticker;
    if (!tk || !this.root) return;
    tk.acc += delta;
    if (tk.acc < TICKER_STEP_MS) return;
    tk.acc %= TICKER_STEP_MS;
    tk.offset = (tk.offset + 1) % tk.source.length;
    this.renderTicker();
  }

  // ---------------------------------------------------------------------------
  // Paradero y letreros
  // ---------------------------------------------------------------------------

  private buildStop(root: Phaser.GameObjects.Container, s: StopSign): void {
    const w = 92;
    const bodyH = 112;
    const red = 0xc8202c;
    const white = 0xffffff;
    // A la izquierda del centro: las opciones ("Esperar micro") salen a la derecha.
    root.setX(70);
    const g = this.scene.add.graphics();
    // Poste asomando bajo el letrero, con una calcomanía pegada.
    g.fillStyle(0x3a3a42, 1).fillRect(w / 2 - 3, bodyH - 2, 6, 10);
    g.fillStyle(0x5a5a64, 1).fillRect(w / 2 - 3, bodyH - 2, 1, 10);
    g.fillStyle(0xd8d0b8, 1).fillRect(w / 2 - 1, bodyH + 3, 3, 3);
    drawPanel(g, 0, 0, w, bodyH, { radius: 2, fill: 0x18181c, edge: 0x050507 });
    root.add(g);

    // Cuadrito "Parada N" y cuadrito con el ícono de bus.
    g.fillStyle(white, 1).fillRect(4, 4, 18, 16).fillRect(24, 4, 16, 16);
    root.add(this.text(13, 3, 'Parada', { fontSize: '5px', fontStyle: '600' }).setOrigin(0.5, 0));
    root.add(this.text(13, 9, String(s.stop), { fontFamily: FONT_HUD, fontSize: '8px' }).setOrigin(0.5, 0));
    const ink = 0x18181c;
    g.fillStyle(ink, 1).fillRect(27, 7, 10, 9); // carrocería
    g.fillStyle(white, 1).fillRect(28, 8, 8, 4); // parabrisas
    g.fillRect(28, 14, 2, 1).fillRect(34, 14, 2, 1); // focos
    g.fillStyle(ink, 1).fillRect(28, 16, 2, 2).fillRect(34, 16, 2, 2); // ruedas

    // Pestaña roja con el logo "Red" y el código del paradero.
    g.fillStyle(red, 1).fillRoundedRect(w - 30, 1, 29, 18, { tl: 0, tr: 1, bl: 6, br: 0 });
    root.add(this.text(w - 16, 1, 'Red', { fontSize: '9px', fontStyle: '700', color: '#ffffff' }).setOrigin(0.5, 0));
    root.add(this.text(w - 16, 12, s.code, { fontSize: '5px', fontStyle: '600', color: '#ffffff' }).setOrigin(0.5, 0));

    // Nombre de la parada.
    root.add(this.text(4, 21, s.name[0], { fontSize: '7px', fontStyle: '700', color: '#ffffff' }));
    root.add(this.text(4, 29, s.name[1], { fontSize: '7px', fontStyle: '700', color: '#ffffff' }));

    // Grilla de recorridos: 2 columnas × 3 filas, con líneas blancas finas.
    const gx = 2;
    const gy = 39;
    const gw = w - 4;
    const rowH = 15;
    const rows = 3;
    const colW = gw / 2;
    g.fillStyle(0xe8e8e8, 1);
    for (let r = 0; r <= rows; r++) g.fillRect(gx, gy + r * rowH, gw, 1);
    g.fillRect(gx + colW, gy, 1, rows * rowH);

    const marker = this.scene.add.graphics();
    s.routes.slice(0, rows * 2).forEach((r, i) => {
      const cx = gx + (i % 2) * colW + colW / 2;
      const cy = gy + Math.floor(i / 2) * rowH;
      root.add(this.text(cx, cy + 1, r.num, { fontFamily: FONT_HUD, fontSize: '8px', color: '#ffffff' }).setOrigin(0.5, 0));
      root.add(this.text(cx, cy + 8, r.dest, { fontSize: '5px', color: '#c8c8cc' }).setOrigin(0.5, 0));
      if (r.scratched) {
        // Tachado con plumón negro encima del número, y un brochazo plateado.
        marker.lineStyle(2, 0x060608, 0.95).beginPath();
        marker.moveTo(cx - 9, cy + 3);
        for (let k = 1; k <= 9; k++) marker.lineTo(cx - 9 + k * 2, cy + (k % 2 ? 9 : 3));
        marker.strokePath();
        marker.lineStyle(1, 0xa8a8b4, 0.85).lineBetween(cx - 11, cy + 8, cx + 10, cy + 4);
      }
    });
    // Tag de grafiti en una celda vacía.
    marker.lineStyle(1, 0xd040a0, 0.8).beginPath();
    marker.moveTo(gx + colW + 8, gy + rowH * 2 + 10);
    marker.lineTo(gx + colW + 13, gy + rowH * 2 + 4).lineTo(gx + colW + 16, gy + rowH * 2 + 11);
    marker.lineTo(gx + colW + 22, gy + rowH * 2 + 4).lineTo(gx + colW + 25, gy + rowH * 2 + 10).lineTo(gx + colW + 32, gy + rowH * 2 + 7);
    marker.strokePath();

    // Recuadro con el QR y "¿Cuándo llega tu bus?".
    const qy = gy + rows * rowH + 3;
    g.fillStyle(0x2a2a30, 1).fillRect(2, qy - 1, w - 4, 17);
    // QR pixelado de 15×15: margen blanco, tres cuadros de esquina y módulos pseudoaleatorios.
    const drawQr = (x: number, y: number): void => {
      const n = 15;
      g.fillStyle(0xffffff, 1).fillRect(x, y, n, n);
      g.fillStyle(0x18181c, 1);
      const finder = (fx: number, fy: number) => {
        g.fillRect(fx, fy, 5, 5);
        g.fillStyle(0xffffff, 1).fillRect(fx + 1, fy + 1, 3, 3);
        g.fillStyle(0x18181c, 1).fillRect(fx + 2, fy + 2, 1, 1);
      };
      finder(x + 1, y + 1);
      finder(x + n - 6, y + 1);
      finder(x + 1, y + n - 6);
      for (let r = 1; r < n - 1; r++) {
        for (let c = 1; c < n - 1; c++) {
          const inFinder = (r < 7 && c < 7) || (r < 7 && c > n - 8) || (r > n - 8 && c < 7);
          if (!inFinder && ((r * 7 + c * 13 + r * c) % 5) < 2) g.fillRect(x + c, y + r, 1, 1);
        }
      }
    };
    drawQr(4, qy + 1);
    root.add(this.text(22, qy - 1, '¿Cuándo llega', { fontSize: '7px', fontStyle: '600', color: '#ffffff' }));
    root.add(this.text(22, qy + 6, 'tu bus?', { fontSize: '7px', fontStyle: '600', color: '#ffffff' }));

    // Franja del pie: consultas y teléfonos.
    const fy = bodyH - 8;
    g.fillStyle(white, 1).fillRect(1, fy, w - 2, 7);
    g.fillStyle(red, 1).fillRect(1, fy, 7, 7).fillRect(w - 20, fy, 19, 7);
    g.fillStyle(white, 1).fillRect(4, fy + 1, 1, 1).fillRect(4, fy + 3, 1, 3);
    root.add(this.text(10, fy, 'Consultas: 600 730 0073', { fontSize: '5px', fontStyle: '600', color: '#c8202c' }));
    root.add(this.text(w - 10, fy, 'red.cl', { fontSize: '5px', fontStyle: '600', color: '#ffffff' }).setOrigin(0.5, 0));
    root.add(marker);
  }

  private buildStation(root: Phaser.GameObjects.Container, s: StationSign): void {
    const big = s.style === 'efe';
    const plate = s.style === 'placa';
    const tx = plate ? 10 : 34;
    // El ancho de cada cartel es el mínimo: se ensancha solo si el título no cabe.
    const probe = this.text(0, 0, s.title, { fontFamily: FONT_HUD, fontSize: big ? '16px' : '8px' });
    const w = Math.max(s.w ?? 220, Math.ceil(probe.width) + tx + (s.arrow ? 30 : 10));
    probe.destroy();
    const stripes = s.warn ? 8 : 0;
    const textH = (big ? 26 : 20) + s.lines.length * 9 + 4;
    const h = textH + stripes;
    root.setX((BASE_WIDTH - w) / 2);
    if (plate) root.setY(TOP + 10);
    const g = this.scene.add.graphics();
    const fill = s.style === 'efe' ? 0x1d4f91 : s.style === 'metro' ? 0xf4f4f4 : plate ? 0xd4d8dc : 0x1c2a48;
    drawPanel(g, 0, 0, w, h, { radius: plate ? 2 : 3, fill, edge: plate ? 0x6a707c : undefined });
    // Patas del letrero colgante (la placa va atornillada a la puerta).
    if (!plate) g.fillStyle(0x6a7488, 1).fillRect(24, -TOP, 2, TOP).fillRect(w - 26, -TOP, 2, TOP);
    root.add(g);
    if (s.warn) {
      // Franja de peligro: diagonales rojas sobre blanco.
      const y = h - stripes - 1;
      g.fillStyle(0xffffff, 1).fillRect(1, y, w - 2, stripes);
      g.fillStyle(0xc8202c, 1);
      for (let x = 1; x + 8 <= w - 1; x += 8) g.fillTriangle(x, y + stripes, x + 4, y, x + 8, y).fillTriangle(x, y + stripes, x + 8, y, x + 4, y + stripes);
    }

    let titleColor = '#ffffff';
    let lineColor = '#c8d8f0';
    if (plate) {
      // Tornillos en las esquinas y un brillo de metal cepillado.
      g.fillStyle(0xffffff, 0.35).fillRect(2, 2, w - 4, 2);
      g.fillStyle(0x8a909c, 1);
      for (const [px, py] of [[4, 4], [w - 5, 4], [4, h - 5], [w - 5, h - 5]]) g.fillCircle(px, py, 1.5);
      titleColor = THEME.ink;
      lineColor = '#4a4a58';
    } else if (s.style === 'efe') {
      // Logo: tren blanco en un círculo.
      g.fillStyle(0xffffff, 1).fillCircle(17, h / 2, 11);
      g.fillStyle(0x1d4f91, 1).fillRoundedRect(9, h / 2 - 5, 16, 8, 2);
      g.fillStyle(0xffffff, 1).fillRect(12, h / 2 - 3, 3, 3).fillRect(17, h / 2 - 3, 3, 3);
      g.fillStyle(0x1d4f91, 1).fillRect(8, h / 2 + 5, 18, 1);
      g.fillStyle(0xc8202c, 1).fillRect(1, h - 4, w - 2, 3);
    } else if (s.style === 'metro') {
      g.fillStyle(0xc8202c, 1).fillRoundedRect(6, textH / 2 - 10, 20, 20, 4);
      root.add(this.text(16, textH / 2 - 4, 'L1', { fontFamily: FONT_HUD, fontSize: '8px', color: '#ffffff' }).setOrigin(0.5, 0));
      titleColor = THEME.ink;
      lineColor = THEME.inkMuted;
    } else {
      // Escudo dorado.
      g.fillStyle(0xd8b048, 1).fillRect(9, h / 2 - 10, 16, 12).fillTriangle(9, h / 2 + 2, 25, h / 2 + 2, 17, h / 2 + 11);
      g.fillStyle(0x1c2a48, 1).fillRect(12, h / 2 - 7, 10, 2).fillRect(16, h / 2 - 7, 2, 10);
      g.fillStyle(0xd8b048, 1).fillRect(tx, 15, w - tx - 8, 1);
      titleColor = '#f0d890';
      lineColor = '#ffffff';
    }
    root.add(this.text(tx, big ? 4 : 5, s.title, { fontFamily: FONT_HUD, fontSize: big ? '16px' : '8px', color: titleColor }));
    s.lines.forEach((line, i) => {
      root.add(this.text(tx, (big ? 24 : 18) + i * 9, line, { fontSize: '7px', color: lineColor }));
    });
    if (s.arrow) this.drawArrow(g, w - 16, textH / 2, s.arrow, s.style === 'metro' ? 0xc8202c : 0xffffff);
  }

  private drawArrow(g: Phaser.GameObjects.Graphics, cx: number, cy: number, dir: Arrow, color: number): void {
    g.fillStyle(color, 1);
    if (dir === 'down') {
      g.fillRect(cx - 2, cy - 8, 4, 8).fillTriangle(cx - 7, cy, cx + 7, cy, cx, cy + 8);
    } else {
      const s = dir === 'right' ? 1 : -1;
      g.fillRect(Math.min(cx - 8 * s, cx), cy - 2, 8, 4).fillTriangle(cx, cy - 7, cx, cy + 7, cx + 8 * s, cy);
    }
  }

  private buildHand(root: Phaser.GameObjects.Container, s: HandSign): void {
    const paper = s.paper ?? 'carton';
    if (paper === 'carton') {
      this.buildCardboard(root, s);
      return;
    }
    // Tamaño de letra según el soporte, y márgenes.
    const size = { papel: 9, postit: 11, espejo: 15, madera: 10 }[paper];
    const padX = { papel: 10, postit: 8, espejo: 22, madera: 14 }[paper];
    const padTop = (s.magnet ? 10 : 7) + (paper === 'espejo' ? 9 : 0);
    const padBottom = paper === 'espejo' ? 14 : 7;
    const minW = { papel: 110, postit: 66, espejo: 170, madera: 140 }[paper];
    const style = (big: boolean): Phaser.Types.GameObjects.Text.TextStyle => ({
      fontSize: `${big ? Math.round(size * 1.5) : size}px`,
      fontStyle: s.script ? 'italic' : paper === 'madera' || big ? '700' : '600',
      color: s.ink,
    });
    // Texto a la izquierda en notas largas manuscritas; centrado en avisos.
    const left = paper === 'papel' && !!s.script && !s.big;

    const texts = s.lines.map((line, i) => this.text(0, 0, line, style(!!s.big && i === 0)));
    const firma = s.firma ? this.text(0, 0, s.firma, style(false)) : null;
    const contentW = Math.ceil(Math.max(...texts.map((t) => t.width), firma?.width ?? 0));
    const gap = paper === 'espejo' ? 1 : 2;
    let contentH = texts.reduce((acc, t) => acc + Math.ceil(t.height) + gap, 0);
    if (firma) contentH += Math.ceil(firma.height);
    if (s.underline) contentH += 3;
    const w = Math.max(minW, contentW + padX * 2 + (s.heart || s.deco ? 12 : 0));
    const h = Math.min(108, Math.max(paper === 'postit' ? w - 8 : 0, contentH + padTop + padBottom));
    root.setX(Math.round((BASE_WIDTH - w) / 2)).setY(paper === 'postit' ? TOP + 4 : h < 64 ? TOP + 14 : 4);

    const g = this.scene.add.graphics();
    if (paper === 'papel') {
      drawPanel(g, 0, 0, w, h, { radius: 1, fill: 0xfcfcf6, edge: 0xc8c4b4 });
      if (s.script) {
        // Hoja de block: renglones celestes.
        g.lineStyle(1, 0xc4d8ec, 0.7);
        for (let y = padTop + size + 3; y < h - 4; y += size + gap + 3) g.lineBetween(4, y, w - 4, y);
      }
      // Esquina doblada.
      g.fillStyle(0xe4e0d0, 1).fillTriangle(w - 9, h - 1, w - 1, h - 9, w - 9, h - 9);
      if (!s.magnet) g.fillStyle(0xe8e0b0, 0.8).fillRect(-3, 2, 14, 6).fillRect(w - 11, 2, 14, 6);
    } else if (paper === 'postit') {
      const fill = s.old ? 0xe8d48a : 0xf8e870;
      g.fillStyle(0x000000, 0.18).fillRect(1, 2, w, h);
      g.fillStyle(fill, 1).fillRect(0, 0, w, h);
      // Franja del pegamento y la esquina que se levanta.
      g.fillStyle(0xffffff, 0.18).fillRect(0, 0, w, 7);
      g.fillStyle(s.old ? 0xc8b06a : 0xe0cc50, 1).fillTriangle(w - 10, h, w, h - 10, w, h);
      if (s.old) g.fillStyle(0xb89a50, 0.35).fillCircle(10, h - 10, 5).fillCircle(w - 18, 14, 3);
    } else if (paper === 'espejo') {
      drawPanel(g, 0, 0, w, h, { radius: 6, fill: 0xb8bcc4, edge: 0x50586a });
      // Vidrio con un degradado frío y reflejos diagonales.
      for (let y = 4; y < h - 4; y += 3) {
        const c = Phaser.Display.Color.Interpolate.ColorWithColor(
          Phaser.Display.Color.ValueToColor(0xa8c4d4),
          Phaser.Display.Color.ValueToColor(0x6c8698),
          h,
          y,
        );
        g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1).fillRect(4, y, w - 8, Math.min(3, h - 4 - y));
      }
      g.lineStyle(3, 0xffffff, 0.18).lineBetween(14, h - 6, 40, 6).lineBetween(26, h - 6, 52, 6);
      g.lineStyle(1, 0xffffff, 0.25).lineBetween(w - 40, h - 6, w - 20, 6);
      // Una gotita del lápiz labial chorreada.
      g.fillStyle(0xd02838, 0.7).fillRect(Math.round(w / 2) + 18, h - 18, 1, 6);
    } else {
      // Tabla de madera pintada de verde sandía, con vetas.
      drawPanel(g, 0, 0, w, h, { radius: 2, fill: 0x2f7a3a, edge: 0x4a2c14 });
      g.lineStyle(2, 0x8a5a2b, 1).strokeRect(1, 1, w - 2, h - 2);
      g.lineStyle(1, 0x24642e, 0.8);
      for (let y = 8; y < h - 4; y += 7) g.lineBetween(4, y, w - 4, y + ((y / 7) % 2 ? 1 : -1));
      // Patas del letrero clavadas al mesón.
      g.fillStyle(0x6a4424, 1).fillRect(10, h, 4, 6).fillRect(w - 14, h, 4, 6);
    }
    const card = this.scene.add.container(0, 0, [g]);

    let y = padTop;
    texts.forEach((t) => {
      if (left) t.setPosition(padX, y);
      else t.setOrigin(0.5, 0).setPosition(Math.round(w / 2), y);
      y += Math.ceil(t.height) + gap;
      card.add(t);
    });
    if (s.underline) {
      const last = texts[texts.length - 1];
      const ux = left ? padX : Math.round(w / 2 - last.width / 2);
      const ink = Phaser.Display.Color.HexStringToColor(s.ink).color;
      g.lineStyle(1, ink, 0.9).lineBetween(ux, y - 1, ux + last.width, y - 2).lineBetween(ux + 4, y + 1, ux + last.width - 2, y + 1);
      y += 3;
    }
    if (firma) {
      firma.setOrigin(1, 0).setPosition(w - padX - (s.heart ? 12 : 0), y);
      card.add(firma);
    }
    if (s.heart) {
      const hx = w - 14;
      const hy = h - 13;
      g.fillStyle(0xd04848, 1).fillCircle(hx - 2.5, hy, 3).fillCircle(hx + 2.5, hy, 3).fillTriangle(hx - 5.5, hy + 1, hx + 5.5, hy + 1, hx, hy + 7);
    }
    if (s.deco === 'sandia') this.drawWatermelon(g, w - 16, 8, 8);
    if (paper === 'espejo') {
      // El mensaje aparece de a poco, como si alguien lo escribiera en el vidrio empañado.
      texts.forEach((t, i) => {
        t.setAlpha(0);
        this.tracked.push(this.scene.tweens.add({ targets: t, alpha: 0.92, delay: 250 + i * 450, duration: 600 }));
      });
    }

    if (s.magnet) {
      // El imán llega con un "clac" encima de la hoja.
      const mg = this.scene.add.graphics();
      if (s.magnet === 'sandia') this.drawWatermelon(mg, 0, -2, 8);
      else mg.fillStyle(0xd02828, 1).fillCircle(0, 0, 5).fillStyle(0xffffff, 0.5).fillCircle(-1.5, -1.5, 1.5);
      const magnet = this.scene.add.container(Math.round(w / 2), 2, [mg]).setScale(1.6);
      card.add(magnet);
      this.tracked.push(this.scene.tweens.add({ targets: magnet, scale: 1, duration: 180, delay: 120, ease: 'Back.Out' }));
    }
    card.setAngle(paper === 'espejo' ? 0 : paper === 'postit' ? 4 : paper === 'madera' ? -1 : -2);
    root.add(card);
  }

  /** Tajada de sandía: verde por fuera, blanco y rojo con pepitas (borde plano arriba). */
  private drawWatermelon(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number): void {
    g.fillStyle(0x2f8a3a, 1).slice(cx, cy, r, 0, Math.PI).fillPath();
    g.fillStyle(0xe8f0c8, 1).slice(cx, cy, r - 1.5, 0, Math.PI).fillPath();
    g.fillStyle(0xe03848, 1).slice(cx, cy, r - 2.5, 0, Math.PI).fillPath();
    g.fillStyle(0x201818, 1);
    for (const [dx, dy] of [[-3, 2], [0, 3], [3, 2], [-1, 5], [2, 5]]) g.fillRect(Math.round(cx + dx * (r / 9)), Math.round(cy + dy * (r / 9)), 1, 1);
  }

  /** Cartón con plumón de los choferes del aeropuerto (primera línea grande, segunda chica). */
  private buildCardboard(root: Phaser.GameObjects.Container, s: HandSign): void {
    const w = 156;
    const h = s.lines[1] ? 54 : 40;
    root.setX((BASE_WIDTH - w) / 2).setY(TOP + 14);
    const g = this.scene.add.graphics();
    drawPanel(g, 0, 0, w, h, { radius: 2, fill: 0xf6f2e8, edge: 0xb8a888 });
    // Cinta adhesiva en las esquinas.
    g.fillStyle(0xe8e0b0, 0.8).fillRect(-3, 2, 14, 6).fillRect(w - 11, 2, 14, 6);
    const card = this.scene.add.container(0, 0, [g]);
    card.add(this.text(w / 2, 6, s.lines[0], { fontSize: '20px', fontStyle: '700', color: s.ink }).setOrigin(0.5, 0));
    if (s.lines[1]) card.add(this.text(w / 2, 32, s.lines[1], { fontSize: '10px', fontStyle: '600', color: s.ink }).setOrigin(0.5, 0));
    if (s.heart) {
      g.fillStyle(0xd04848, 1).fillCircle(w - 18, h - 12, 3).fillCircle(w - 13, h - 12, 3).fillTriangle(w - 21, h - 11, w - 10, h - 11, w - 15.5, h - 5);
      // El apellido "corregido" a mano.
      g.lineStyle(1, 0x2040a0, 0.8).lineBetween(w / 2 + 10, 28, w / 2 + 26, 26);
    }
    card.setAngle(-3);
    root.add(card);
  }

  // ---------------------------------------------------------------------------
  // Pizarra de la prueba
  // ---------------------------------------------------------------------------

  /** Arriba y bajita: deja espacio a las opciones de la prueba (salen sobre la caja de diálogo). */
  private buildChalkboard(root: Phaser.GameObjects.Container, exam: boolean): void {
    const w = 304;
    const h = 56;
    root.setPosition(8, 4);
    const g = this.scene.add.graphics();
    drawPanel(g, 0, 0, w, h, { radius: 3, fill: 0x2f5a3c, edge: 0x4a2c14 });
    g.lineStyle(3, 0x8a5a2b, 1).strokeRect(1.5, 1.5, w - 3, h - 3);
    // Manchas de borrador.
    g.fillStyle(0x3c6c4a, 0.55).fillEllipse(70, 44, 60, 10).fillEllipse(220, 20, 50, 8).fillEllipse(260, 46, 40, 9);
    // Tiza en la repisa.
    g.fillStyle(0xffffff, 1).fillRect(w - 40, h - 3, 8, 2);
    root.add(g);

    root.add(this.text(8, 5, exam ? 'PRUEBA · MOCHILA 0/1' : 'PROBLEMA DE LA MOCHILA 0/1', { fontFamily: FONT_HUD, fontSize: '8px', color: CHALK }));
    root.add(this.text(w - 8, 5, 'CAPACIDAD: 10 KG', { fontFamily: FONT_HUD, fontSize: '8px', color: CHALK_YELLOW }).setOrigin(1, 0));
    g.lineStyle(1, CHALK_HEX, 0.6).lineBetween(8, 16, w - 8, 16);

    const cellW = (w - 16) / MOCHILA.length;
    MOCHILA.forEach((item, i) => {
      const x = 8 + i * cellW;
      this.drawChalkIcon(g, item.icon, x, 20);
      root.add(this.text(x + 17, 18, item.name, { fontSize: '7px', fontStyle: '600', color: CHALK }));
      root.add(this.text(x + 17, 27, `${item.kg} kg · vale ${item.val}`, { fontSize: '7px', color: CHALK_DIM }));
    });

    this.drawBat(g, w - 18, 45);
    if (!exam) {
      root.add(this.text(8, 40, 'x_i = 1 si llevo el objeto i;  0 si no', { fontSize: '8px', color: CHALK_DIM }));
      return;
    }
    root.add(this.text(8, 41, 'PREGUNTAS', { fontSize: '7px', color: CHALK_DIM }));
    for (let i = 0; i < QUESTIONS; i++) {
      const x = 62 + i * 22;
      const y = 46;
      const dot = this.scene.add.graphics();
      root.add(dot);
      root.add(this.text(x, y - 5, String(i + 1), { fontSize: '7px', color: CHALK }).setOrigin(0.5, 0));
      this.dots.push({ g: dot, x, y });
    }
    this.drawDots();
  }

  private drawChalkIcon(g: Phaser.GameObjects.Graphics, icon: (typeof MOCHILA)[number]['icon'], x: number, y: number): void {
    g.lineStyle(1, CHALK_HEX, 0.9);
    if (icon === 'carpa') {
      g.strokeTriangle(x + 1, y + 11, x + 7, y + 1, x + 13, y + 11);
      g.lineBetween(x + 7, y + 1, x + 7, y + 11);
    } else if (icon === 'saco') {
      g.strokeRoundedRect(x + 1, y + 3, 12, 8, 3);
      g.lineBetween(x + 4, y + 3, x + 4, y + 11);
    } else if (icon === 'cocinilla') {
      g.strokeRect(x + 2, y + 6, 10, 5);
      g.fillStyle(0xf0a050, 0.9).fillTriangle(x + 5, y + 5, x + 7, y, x + 9, y + 5);
    } else {
      g.strokeRect(x + 1, y + 5, 7, 4);
      g.lineBetween(x + 8, y + 5, x + 11, y + 3).lineBetween(x + 8, y + 9, x + 11, y + 11).lineBetween(x + 11, y + 3, x + 11, y + 11);
      g.lineStyle(1, 0xf0e070, 0.7).lineBetween(x + 12, y + 5, x + 15, y + 4).lineBetween(x + 12, y + 9, x + 15, y + 10);
    }
  }

  /** El murciélago que el profe dibuja en todas las pizarras. */
  private drawBat(g: Phaser.GameObjects.Graphics, cx: number, cy: number): void {
    g.fillStyle(CHALK_HEX, 0.85).fillCircle(cx, cy, 2.5);
    g.fillTriangle(cx - 2, cy - 1, cx - 11, cy - 4, cx - 7, cy + 3);
    g.fillTriangle(cx + 2, cy - 1, cx + 11, cy - 4, cx + 7, cy + 3);
    g.fillTriangle(cx - 2, cy - 2, cx - 1, cy - 5, cx, cy - 2).fillTriangle(cx, cy - 2, cx + 1, cy - 5, cx + 2, cy - 2);
  }

  private readonly marks: ('ok' | 'bad' | undefined)[] = [];

  private setStep(step: number): void {
    this.step = Phaser.Math.Clamp(step, 1, QUESTIONS);
    if (this.step === 1) this.marks.length = 0;
    this.drawDots();
  }

  private mark(mark: 'ok' | 'bad'): void {
    if (this.step < 1 || this.dots.length === 0) return;
    this.marks[this.step - 1] = mark;
    this.drawDots();
    const d = this.dots[this.step - 1];
    if (!d) return;
    d.g.setScale(1.6);
    d.g.setPosition(d.x * -0.6, d.y * -0.6);
    this.scene.tweens.add({ targets: d.g, scale: 1, x: 0, y: 0, duration: 220, ease: 'Back.Out' });
  }

  private drawDots(): void {
    this.dots.forEach((d, i) => {
      const { g, x, y } = d;
      const m = this.marks[i];
      g.clear();
      const current = i === this.step - 1 && !m;
      g.lineStyle(1, current ? 0xf0e070 : CHALK_HEX, current ? 1 : 0.6).strokeCircle(x, y, 6);
      if (current) g.lineStyle(1, 0xf0e070, 0.4).strokeCircle(x, y, 8);
      if (m === 'ok') {
        g.lineStyle(2, 0x78e088, 1).beginPath();
        g.moveTo(x - 4, y + 4);
        g.lineTo(x - 1, y + 7).lineTo(x + 7, y - 3);
        g.strokePath();
      } else if (m === 'bad') {
        g.lineStyle(2, 0xf07070, 1).lineBetween(x - 5, y - 1, x + 5, y + 9).lineBetween(x + 5, y - 1, x - 5, y + 9);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Diario mural
  // ---------------------------------------------------------------------------

  private buildMural(root: Phaser.GameObjects.Container): void {
    const w = 264;
    const h = 108;
    root.setPosition((BASE_WIDTH - w) / 2, 4);
    const g = this.scene.add.graphics();
    drawPanel(g, 0, 0, w, h, { radius: 3, fill: 0xc08a50, edge: 0x4a2c14 });
    g.lineStyle(3, 0x7a4c24, 1).strokeRect(1.5, 1.5, w - 3, h - 3);
    // Textura de corcho (pseudoaleatoria, siempre igual).
    for (let i = 0; i < 160; i++) {
      const px = 4 + ((i * 37) % (w - 8));
      const py = 4 + ((i * 53) % (h - 8));
      g.fillStyle(i % 3 ? 0xa87440 : 0xd8a468, 0.7).fillRect(px, py, 1, 1);
    }
    root.add(g);

    const note = (x: number, y: number, nw: number, nh: number, angle: number, fill: number, parts: Phaser.GameObjects.GameObject[], lined = false) => {
      const ng = this.scene.add.graphics();
      ng.fillStyle(0x000000, 0.18).fillRect(1, 2, nw, nh);
      ng.fillStyle(fill, 1).fillRect(0, 0, nw, nh);
      if (lined) {
        ng.lineStyle(1, 0xa8c0e0, 0.8);
        for (let ly = 14; ly < nh - 2; ly += 7) ng.lineBetween(2, ly, nw - 2, ly);
        ng.lineStyle(1, 0xe0a0a0, 0.8).lineBetween(6, 0, 6, nh);
      }
      ng.fillStyle(0xd02828, 1).fillCircle(nw / 2, 3, 2.5);
      ng.fillStyle(0xffffff, 0.7).fillCircle(nw / 2 - 1, 2, 0.8);
      const c = this.scene.add.container(x, y, [ng, ...parts]).setAngle(angle);
      root.add(c);
    };

    note(8, 8, 76, 42, -3, 0xffffff, [
      this.text(5, 6, 'SE VENDE', { fontFamily: FONT_HUD, fontSize: '8px' }),
      this.text(5, 16, 'Calculadora científica, poco uso (literal)', { fontSize: '7px', wordWrap: { width: 66 } }),
    ]);
    note(10, 56, 76, 46, 2, 0xffffff, [
      this.text(9, 5, 'SE BUSCA', { fontFamily: FONT_HUD, fontSize: '8px' }),
      this.text(9, 15, 'Compañero para el trabajo de Opti (no flojo)', { fontSize: '7px', wordWrap: { width: 62 } }),
    ], true);

    // Afiche de la charla de becas, con las banderas.
    const fg = this.scene.add.graphics();
    const flag = (fx: number, label: string, draw: (x: number, y: number) => void) => {
      draw(fx, 66);
      fg.lineStyle(1, 0x000000, 0.3).strokeRect(fx, 66, 24, 16);
      poster.push(this.text(fx + 12, 84, label, { fontSize: '6px', color: '#ffffff' }).setOrigin(0.5, 0));
    };
    const poster: Phaser.GameObjects.GameObject[] = [
      fg,
      this.text(54, 6, 'CHARLA', { fontFamily: FONT_HUD, fontSize: '8px', color: '#f0d048' }).setOrigin(0.5, 0),
      this.text(54, 18, 'BECAS DE INTERCAMBIO ESTUDIANTIL', {
        fontSize: '10px',
        fontStyle: '700',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: 96 },
      }).setOrigin(0.5, 0),
    ];
    flag(8, 'COLOMBIA', (x, y) => {
      fg.fillStyle(0xf0c818, 1).fillRect(x, y, 24, 8);
      fg.fillStyle(0x2048a0, 1).fillRect(x, y + 8, 24, 4);
      fg.fillStyle(0xc8202c, 1).fillRect(x, y + 12, 24, 4);
    });
    flag(42, 'MÉXICO', (x, y) => {
      fg.fillStyle(0x1c7a40, 1).fillRect(x, y, 8, 16);
      fg.fillStyle(0xffffff, 1).fillRect(x + 8, y, 8, 16);
      fg.fillStyle(0xc8202c, 1).fillRect(x + 16, y, 8, 16);
      fg.fillStyle(0x8a5a2b, 1).fillCircle(x + 12, y + 8, 2);
    });
    flag(76, 'ESPAÑA', (x, y) => {
      fg.fillStyle(0xc8202c, 1).fillRect(x, y, 24, 16);
      fg.fillStyle(0xf0c818, 1).fillRect(x, y + 4, 24, 8);
    });
    note(94, 6, 108, 96, 0, 0x24508e, poster);
    // Post-it del profe, con su murciélago.
    note(210, 12, 46, 50, 5, 0xf8e870, [
      this.text(4, 7, '¿Alguien ha visto un lápiz rojo? Es importante.', { fontSize: '7px', wordWrap: { width: 40 } }),
      this.text(42, 40, '—R. Cuervo', { fontSize: '6px', fontStyle: '600', color: '#c8202c' }).setOrigin(1, 0),
    ]);
  }

  // ---------------------------------------------------------------------------
  // Mapa del barrio
  // ---------------------------------------------------------------------------

  private buildMap(root: Phaser.GameObjects.Container): void {
    const w = 290;
    const h = 78;
    root.setX((BASE_WIDTH - w) / 2);
    const g = this.scene.add.graphics();
    drawPanel(g, 0, 0, w, h, { radius: 3, fill: 0xf4f1e6 });
    g.fillStyle(0x2f6a4a, 1).fillRoundedRect(1, 1, w - 2, 14, { tl: 2, tr: 2, bl: 0, br: 0 });
    root.add(g);
    root.add(this.text(6, 4, 'MAPA DEL BARRIO · AV. PROVIDENCIA', { fontFamily: FONT_HUD, fontSize: '8px', color: '#ffffff' }));
    root.add(this.text(w - 6, 17, 'ORIENTE →', { fontSize: '6px', color: THEME.inkMuted }).setOrigin(1, 0));

    const x0 = 24;
    const step = (w - 80 - x0) / (STOPS.length - 1);
    const ly = 46;
    g.fillStyle(0x2f6a4a, 1).fillRect(x0 - 6, ly - 1.5, step * (STOPS.length - 1) + 40, 3);
    STOPS.forEach((name, i) => {
      const x = x0 + i * step;
      g.fillStyle(0xffffff, 1).fillCircle(x, ly, 3.5);
      g.lineStyle(1, 0x2a2433, 1).strokeCircle(x, ly, 3.5);
      const below = i % 2 === 0;
      root.add(this.text(x, below ? ly + 6 : ly - 14, name, { fontSize: '7px' }).setOrigin(0.5, 0));
    });

    // Costanera Center al final, junto a Tobalaba.
    const tx = w - 26;
    g.fillStyle(0x7a8aa8, 1).fillRect(tx - 5, 24, 10, 32).fillTriangle(tx - 5, 24, tx + 5, 24, tx, 18);
    g.fillStyle(0xc8d8f0, 1);
    for (let y = 28; y < 54; y += 4) g.fillRect(tx - 3, y, 6, 1);
    root.add(this.text(w - 5, 60, 'COSTANERA\nCENTER', { fontSize: '6px', fontStyle: '600', align: 'right' }).setOrigin(1, 0));

    // "Usted está aquí" sobre Baquedano, con el monito que alguien dibujó.
    g.fillStyle(0xd02828, 1).fillCircle(x0, ly - 12, 4).fillTriangle(x0 - 3.5, ly - 10, x0 + 3.5, ly - 10, x0, ly - 4);
    g.fillStyle(0xffffff, 1).fillCircle(x0, ly - 12, 1.5);
    root.add(this.text(x0 + 7, 20, 'USTED ESTÁ AQUÍ', { fontSize: '6px', fontStyle: '600', color: '#d02828' }));
    const mx = x0 + 70;
    g.lineStyle(1, 0x505060, 0.9).strokeCircle(mx, 22, 2.5);
    g.lineBetween(mx, 24.5, mx, 30).lineBetween(mx - 3, 26, mx + 3, 26).lineBetween(mx, 30, mx - 2, 34).lineBetween(mx, 30, mx + 2, 34);
  }

  private hide(immediate = false): void {
    const root = this.root;
    if (!root) return;
    this.root = null;
    this.currentId = '';
    this.ticker = null;
    this.dots = [];
    for (const tw of this.tracked) tw.remove();
    this.tracked = [];
    this.scene.tweens.killTweensOf(root);
    root.each((child: Phaser.GameObjects.GameObject) => this.scene.tweens.killTweensOf(child));
    if (immediate) {
      root.destroy();
      return;
    }
    this.scene.tweens.add({ targets: root, alpha: 0, duration: 140, onComplete: () => root.destroy() });
  }
}
