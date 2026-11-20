import { playSfx } from '../audio/sfx';
import { BAND_AT, MAX_HEARTS, POINTS, SANDBOX_BAG, type SandboxPerson, type SandboxTopic } from '../data/sandboxCast';
import {
  COMPLIMENTS,
  FLIRTS,
  HUG,
  JOKES,
  KISS,
  NUMBER_LINES,
  PLAN_LINES,
  STREET_GREET,
  STREET_TOPICS,
  STYLES,
  type Style,
} from '../data/sandboxTalk';
import type { DialogueChoice, DialogueNode } from '../types/story';
import { Dialogue } from './DialogueManager';
import { ITEMS, StoryState } from './StoryState';

/**
 * Cómo se conversa en el modo libre, al estilo «Miami Nights»: con el reparto fijo y con cualquier desconocido de la
 * calle se puede charlar por categorías, hacer cumplidos, coquetear (o bromear), regalar, pedir el número, hacer
 * planes y, si hay química, besar.
 *
 * - Todo suma "confianza" (corazones), una sola vez por cosa: flags `sbx_<quien>_<tipo>_<cosa>`.
 *   t = tema, c = cumplido, f = coqueteo, j = broma, k = abrazo o beso, g1-3 = regalo según cuánto gustó.
 * - La "química" es cuántos corazones pide cada persona (`needHearts`) para el beso: la de la calle sale del hash
 *   de quién es, así que es siempre la misma persona con el mismo carácter.
 * - Los menús se arman en código a cada vuelta (así reflejan la confianza de ese momento).
 */

export const NPC_PREFIX = 'sbx_';
const PICK = '_sbx_pick_';
const PER_PAGE = 6;
const MAX_ROWS = 8;

/** Con quién se habla y cómo es. */
export interface Subject {
  /** Clave de los flags: el id del reparto, o `s<hash>` para gente de la calle. */
  id: string;
  name: string;
  kind: 'cast' | 'street';
  style: Style;
  /** Se puede coquetear y besar (si no, bromas y abrazo). */
  romance: boolean;
  needHearts: number;
  greet: [string, string, string];
  topics: SandboxTopic[];
  deep: SandboxTopic[];
  loves: string[];
  likes: string[];
  reaction: { love: string; like: string; meh: string };
}

/** Por dónde se habla: en persona o por el celular. */
export type Via = 'persona' | 'llamada' | 'mensaje';

/** Lo que el mapa le presta a la conversación. */
export interface TalkContext {
  via: Via;
  /** Nombre del sitio, para «preguntar por el lugar». */
  place: string;
  /** Ítems que se ofrecen para regalar (los que hay en la mochila). */
  owned: () => string[];
  /** Hacer un plan: elegir adónde y cuándo. Devuelve lo que se dice y, si se van ya, el destino. */
  plan: (s: Subject) => Promise<{ lines: string[]; go?: string } | null>;
  /** Guardó su número: queda en el celular. */
  gotNumber: (s: Subject) => void;
  /** ¿Ya está en el celular? (el reparto siempre; la gente de la calle, si pediste su número). */
  inPhone: (s: Subject) => boolean;
}

export interface TalkOutcome {
  /** Sitio (id) al que se van juntos, si hicieron un plan «ahora». */
  go?: string;
}

// --------------------------------------------------------------------- confianza

const flagOf = (who: string, kind: string, thing: string): string => `${NPC_PREFIX}${who}_${kind}_${thing}`;

/** Cuánto gusta `item` a `s`: 3 le encanta, 2 le gusta, 1 cualquier otro. */
export function giftTierOf(s: Pick<Subject, 'loves' | 'likes'>, item: string): 1 | 2 | 3 {
  return s.loves.includes(item) ? 3 : s.likes.includes(item) ? 2 : 1;
}

/** Puntos de confianza con `who` (según las flags de la partida). */
export function trust(who: string): number {
  let total = 0;
  const prefix = `${NPC_PREFIX}${who}_`;
  for (const f of StoryState.allFlags()) {
    if (!f.startsWith(prefix)) continue;
    const rest = f.slice(prefix.length);
    if (rest.startsWith('t_')) total += POINTS.topic;
    else if (rest.startsWith('c_') || rest.startsWith('f_') || rest.startsWith('j_') || rest === 'k_cheek') total += POINTS.chat;
    else if (rest === 'k_lips') total += POINTS.lips;
    else if (rest.startsWith('g3_')) total += POINTS.love;
    else if (rest.startsWith('g2_')) total += POINTS.like;
    else if (rest.startsWith('g1_')) total += POINTS.meh;
  }
  return total;
}

/** 0 = recién conocidos, 1 = hay confianza, 2 = cercanos. */
export function band(points: number): 0 | 1 | 2 {
  return points >= BAND_AT[1] ? 2 : points >= BAND_AT[0] ? 1 : 0;
}

export function hearts(points: number): number {
  return Math.min(MAX_HEARTS, Math.floor(points / 2));
}

export const heartsText = (points: number): string => {
  const n = hearts(points);
  return '♥'.repeat(n) + '♡'.repeat(MAX_HEARTS - n);
};

/** Cómo va la química, según los corazones y los que pide esa persona. */
export function chemistryText(s: Pick<Subject, 'romance' | 'needHearts'>, points: number): string {
  if (!s.romance) return 'amistad';
  const left = s.needHearts - hearts(points);
  if (left <= 0) return '¡chispa!';
  if (left === 1) return 'se siente algo';
  if (left <= 3) return 'tibia, por ahora';
  return 'por descubrir';
}

/** ¿Hay química suficiente para besar en los labios? */
export const canKiss = (s: Subject): boolean => s.romance && hearts(trust(s.id)) >= s.needHearts;

/** Gente que de entrada está en el celular. */
export const inPhoneByDefault = (s: Subject): boolean => s.kind === 'cast';

// --------------------------------------------------------------------- personas

/** Una persona del reparto fijo como interlocutora. */
export function castSubject(p: SandboxPerson): Subject {
  return {
    id: p.id,
    name: p.name,
    kind: 'cast',
    style: p.style,
    romance: p.romance,
    needHearts: p.needHearts,
    greet: p.greet,
    topics: p.topics,
    deep: p.deep,
    loves: p.loves,
    likes: p.likes,
    reaction: p.reaction,
  };
}

/** Hash chico y estable (FNV-1a de 32 bits). */
export function hash32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

type Gender = 'f' | 'm' | 'x';
type Age = 'adult' | 'young' | 'kid' | 'elder';

/** Cómo se llama y qué edad aparenta cada figurante (sprites de crowd.json y de los peatones). Solo adultos coquetean. */
const SPRITE_INFO: Record<string, { gender: Gender; age: Age }> = {
  senora: { gender: 'f', age: 'elder' },
  turista: { gender: 'x', age: 'adult' },
  vendedor: { gender: 'm', age: 'adult' },
  oficinista: { gender: 'x', age: 'adult' },
  estudiante: { gender: 'x', age: 'young' },
  abuelo: { gender: 'm', age: 'elder' },
  pasajera: { gender: 'f', age: 'adult' },
  pasajero: { gender: 'm', age: 'adult' },
  nino: { gender: 'x', age: 'kid' },
  transeunte_joven: { gender: 'x', age: 'adult' },
  transeunte_runner: { gender: 'x', age: 'adult' },
  transeunte_ejecutiva: { gender: 'f', age: 'adult' },
  transeunte_abuelita: { gender: 'f', age: 'elder' },
  transeunte_skater: { gender: 'x', age: 'adult' },
  escolar: { gender: 'x', age: 'kid' },
  trabajador: { gender: 'm', age: 'adult' },
  universitaria: { gender: 'f', age: 'adult' },
  viajero: { gender: 'm', age: 'adult' },
  viajera: { gender: 'f', age: 'adult' },
};

const NAMES: Record<Gender, string[]> = {
  f: ['Camila', 'Valentina', 'Daniela', 'Isidora', 'Antonia', 'Fernanda', 'Catalina', 'Mariana', 'Juliana', 'Paula', 'Sofía', 'Gabriela', 'Andrea', 'Carolina', 'Manuela'],
  m: ['Matías', 'Sebastián', 'Andrés', 'Nicolás', 'Camilo', 'Diego', 'Tomás', 'Julián', 'Mateo', 'Esteban', 'Joaquín', 'Santiago', 'Iván', 'Gonzalo', 'Bruno'],
  x: ['Alex', 'Sami', 'Dani', 'Cris', 'Nico', 'Vale', 'Javi', 'Fran', 'Gabi', 'Emi', 'Rafa', 'Cami', 'Toni', 'Isa', 'Lalo'],
};

const STREET_REACTION: Record<Style, { love: string; like: string; meh: string }> = {
  timida: { love: '¿{item}? Qué... ay, justo lo que me gusta. Gracias.', like: '{item}... qué lindo gesto, gracias.', meh: '{item}. Eh... gracias, no hacía falta.' },
  directa: { love: '¿{item}? Buena elección. Me gusta.', like: '{item}. Bien. Gracias.', meh: '{item}. Bueno, algo es algo. Gracias.' },
  calida: { love: '¡{item}! Qué detalle tan lindo, de verdad. ¡Gracias!', like: 'Ay, {item}. Qué amable. Gracias.', meh: '{item}... qué amable, gracias por pensar en mí.' },
  bromista: { love: '¡{item}! ¿Me conoces o me espiaste?', like: '¡{item}! Esto es lo que se llama una buena inversión.', meh: '{item}... pues ahí, tiene su gracia. Gracias.' },
};

/**
 * Un desconocido de la calle, siempre el mismo para la misma `key` (mapa + figurante): nombre, carácter, gustos y
 * cuánta química puede haber. Los niños y los mayores solo charlan; con el resto depende de quién sea.
 */
export function streetSubject(key: string, sprite: string): Subject {
  const h = hash32(key);
  const info = SPRITE_INFO[sprite] ?? { gender: 'x' as Gender, age: 'adult' as Age };
  const names = NAMES[info.gender];
  const style = STYLES[h % STYLES.length];
  const interest = info.age === 'adult' ? (h >>> 4) % 5 : 0;
  const pool = [...SANDBOX_BAG];
  const picks: string[] = [];
  let seed = h >>> 8;
  while (picks.length < 5 && pool.length > 0) {
    seed = hash32(`${seed}`);
    picks.push(pool.splice(seed % pool.length, 1)[0]);
  }
  return {
    id: `s${h.toString(36)}`,
    name: names[(h >>> 12) % names.length],
    kind: 'street',
    style,
    romance: interest > 0,
    // La química se nota en lo que pide: los muy abiertos (interés 3–4) con menos corazones.
    needHearts: interest >= 3 ? 4 : 5,
    greet: STREET_GREET[style],
    topics: STREET_TOPICS.filter((t) => !t.deep).map((t) => ({ id: t.id, label: t.label, lines: t.lines[style] })),
    deep: STREET_TOPICS.filter((t) => t.deep).map((t) => ({ id: t.id, label: t.label, lines: t.lines[style] })),
    loves: picks.slice(0, 2),
    likes: picks.slice(2),
    reaction: STREET_REACTION[style],
  };
}

// --------------------------------------------------------------------- menús

/** Muestra `lines` y las páginas de opciones: devuelve el índice elegido, o -1 si volvió/no hubo diálogo. */
export async function ask(speaker: string, lines: string[], options: readonly string[], back?: string): Promise<number> {
  const nodes: Record<string, DialogueNode> = {};
  // Hasta 8 filas caben sin paginar; con más, se reparten de a 6 más «Más...» y «Volver».
  const perPage = options.length + (back ? 1 : 0) <= MAX_ROWS ? options.length : PER_PAGE;
  const pages = Math.max(1, Math.ceil(options.length / Math.max(1, perPage)));
  const prompt = lines[lines.length - 1] ?? '';
  for (let n = 0; n < pages; n++) {
    const choices: DialogueChoice[] = options
      .slice(n * perPage, (n + 1) * perPage)
      .map((label, i) => ({ label, effects: [{ setFlag: `${PICK}${n * perPage + i}` }] }));
    if (pages > 1) choices.push({ label: 'Más...', goto: n + 1 < pages ? `p${n + 1}` : 'inicio' });
    if (back) choices.push({ label: back });
    nodes[n === 0 ? 'inicio' : `p${n}`] = { speaker, text: n === 0 ? lines : prompt, choices };
  }
  await Dialogue.runTree({ start: 'inicio', nodes }, 'sandbox:menu');
  let picked = -1;
  for (let i = 0; i < options.length; i++) {
    if (StoryState.hasFlag(`${PICK}${i}`)) picked = i;
    StoryState.setFlag(`${PICK}${i}`, false);
  }
  return picked;
}

/** Dice unas líneas (una por página). */
export function say(speaker: string, lines: string[]): Promise<void> {
  return Dialogue.runTree({ start: 'inicio', nodes: { inicio: { speaker, text: lines } } }, 'sandbox:say');
}

// --------------------------------------------------------------------- la conversación

const giftable = (): string[] => Object.keys(ITEMS).filter((id) => id !== 'bip');

/** Marca `flag` si no estaba. Devuelve true si es la primera vez. */
function firstTime(flag: string): boolean {
  if (StoryState.hasFlag(flag)) return false;
  StoryState.setFlag(flag);
  return true;
}

/** Lo que se agrega al texto cuando algo suma: el aviso de corazón, y si cambió el nivel o los corazones. */
class Gain {
  private readonly before: number;
  constructor(private readonly s: Subject) {
    this.before = trust(s.id);
  }

  lines(): string[] {
    const now = trust(this.s.id);
    if (now === this.before) return [];
    const out = [`(+♥ ${this.s.name})`];
    if (hearts(now) !== hearts(this.before)) out.push(`${this.s.name}: ${heartsText(now)}`);
    if (band(now) > band(this.before)) out.push(`(Con ${this.s.name} ya hay más confianza.)`);
    if (this.s.romance && hearts(now) >= this.s.needHearts && hearts(this.before) < this.s.needHearts) out.push('(Hay química entre ustedes...)');
    return out;
  }
}

const withLugar = (lines: string[], place: string): string[] => lines.map((l) => l.replace(/\{lugar\}/g, place));

/**
 * Conversa con `s` hasta que uno se despide. Cada vuelta arma el menú según lo que haya pasado:
 * Charlar, Cumplido, Coquetear/Bromear, Regalar, Plan (o Pedir su número), Besar (o abrazar) y Ver confianza.
 */
export async function converse(s: Subject, ctx: TalkContext): Promise<TalkOutcome> {
  const who = ctx.via === 'mensaje' ? `${s.name} (mensaje)` : ctx.via === 'llamada' ? `${s.name} (llamada)` : s.name;
  const inPerson = ctx.via === 'persona';
  const points = (): number => trust(s.id);
  let preface: string[] = [s.greet[band(points())]];
  let guard = 200;

  while (guard-- > 0) {
    const options: Array<{ id: string; label: string }> = [{ id: 'charlar', label: 'Charlar' }, { id: 'cumplido', label: 'Hacer un cumplido' }];
    options.push({ id: 'coqueteo', label: s.romance ? 'Coquetear' : 'Bromear' });
    if (inPerson && ctx.owned().length > 0) options.push({ id: 'regalo', label: 'Regalar algo' });
    if (inPerson && !ctx.inPhone(s)) options.push({ id: 'numero', label: 'Pedir su número' });
    else if (ctx.inPhone(s)) options.push({ id: 'plan', label: 'Hacer un plan' });
    if (inPerson) options.push({ id: 'beso', label: s.romance ? 'Besar' : 'Dar un abrazo' });
    options.push({ id: 'confianza', label: 'Ver confianza y química' }, { id: 'chao', label: ctx.via === 'persona' ? 'Despedirme' : ctx.via === 'llamada' ? 'Colgar' : 'Cerrar el chat' });

    const pick = await ask(who, [...preface, '¿Qué hacemos?'], options.map((o) => o.label));
    preface = [];
    const action = options[pick]?.id ?? 'chao';
    if (action === 'chao') {
      await say(who, [farewell(s, ctx.via)]);
      return {};
    }
    const gain = new Gain(s);

    if (action === 'charlar') {
      preface = await chat(s, ctx, who, gain);
    } else if (action === 'cumplido') {
      preface = await compliment(s, who, gain);
    } else if (action === 'coqueteo') {
      preface = await (s.romance ? flirt(s, who, gain) : joke(s, who, gain));
    } else if (action === 'regalo') {
      preface = await gift(s, ctx, who, gain);
    } else if (action === 'numero') {
      preface = askNumber(s, ctx);
    } else if (action === 'plan') {
      if (trust(s.id) < 2) {
        preface = [PLAN_LINES.no[s.style]];
      } else {
        const plan = await ctx.plan(s);
        if (!plan) continue;
        if (plan.go) {
          await say(who, plan.lines);
          return { go: plan.go };
        }
        preface = plan.lines;
      }
    } else if (action === 'beso') {
      preface = await (s.romance ? kiss(s, who, gain) : hug(s, who, gain));
    } else if (action === 'confianza') {
      const pts = points();
      preface = [`Confianza con ${s.name}: ${heartsText(pts)}`, `Química: ${chemistryText(s, pts)}.`];
    }
  }
  return {};
}

function farewell(s: Subject, via: Via): string {
  const by: Record<Style, string> = {
    timida: via === 'persona' ? 'Eh... nos vemos. Cuídate.' : 'Ok... chao, cuídate.',
    directa: via === 'persona' ? 'Nos vemos.' : 'Chao.',
    calida: via === 'persona' ? '¡Cuídate mucho! Vuelve cuando quieras.' : '¡Cuídate mucho! Hablamos.',
    bromista: via === 'persona' ? '¡Adiós! No me extrañes mucho.' : '¡Chao, chao! No me extrañes mucho.',
  };
  return by[s.style];
}

// --- charlar

async function chat(s: Subject, ctx: TalkContext, who: string, gain: Gain): Promise<string[]> {
  const unlocked = band(trust(s.id)) >= 1;
  const topics = [...s.topics, ...(unlocked ? s.deep : [])];
  const labels = topics.map((t) => (StoryState.hasFlag(flagOf(s.id, 't', t.id)) ? `${t.label} ✓` : t.label));
  if (!unlocked && s.deep.length > 0) labels.push('Algo más personal...');
  const pick = await ask(who, ['¿De qué quieres hablar?'], labels, 'Volver');
  if (pick < 0) return [];
  const topic = topics[pick];
  if (!topic) return ['Todavía no hay tanta confianza para hablar de eso. Tal vez más adelante.'];
  const lines = withLugar(topic.lines, ctx.place);
  if (!firstTime(flagOf(s.id, 't', topic.id))) return ['Ya hablamos de eso, ¿te acuerdas?', lines[0]];
  playSfx('select');
  return [...lines, ...gain.lines()];
}

// --- cumplidos, coqueteo, bromas

async function compliment(s: Subject, who: string, gain: Gain): Promise<string[]> {
  const labels = COMPLIMENTS.map((c) => (!s.romance && c.friendLabel ? c.friendLabel : c.label));
  const pick = await ask(who, ['¿Qué le dices?'], labels, 'Volver');
  const c = COMPLIMENTS[pick];
  if (!c) return [];
  const fresh = firstTime(flagOf(s.id, 'c', c.id));
  if (fresh) playSfx('select');
  return fresh ? [c.reply[s.style], ...gain.lines()] : [c.reply[s.style], '(Ya se lo habías dicho: se lo agradece igual.)'];
}

async function flirt(s: Subject, who: string, gain: Gain): Promise<string[]> {
  const pick = await ask(who, ['¿Cómo lo haces?'], FLIRTS.map((f) => f.label), 'Volver');
  const f = FLIRTS[pick];
  if (!f) return [];
  if (hearts(trust(s.id)) < f.needHearts) return [f.early[s.style]];
  const fresh = firstTime(flagOf(s.id, 'f', f.id));
  if (fresh) playSfx('latido');
  return fresh ? [f.warm[s.style], ...gain.lines()] : [f.warm[s.style]];
}

async function joke(s: Subject, who: string, gain: Gain): Promise<string[]> {
  const pick = await ask(who, ['¿Qué haces?'], JOKES.map((j) => j.label), 'Volver');
  const j = JOKES[pick];
  if (!j) return [];
  const fresh = firstTime(flagOf(s.id, 'j', j.id));
  if (fresh) playSfx('risa');
  return fresh ? [j.reply[s.style], ...gain.lines()] : [j.reply[s.style]];
}

// --- regalos

/** Cada ítem cuenta una sola vez por persona; repetirlo no suma (pero se lo queda). */
async function gift(s: Subject, ctx: TalkContext, who: string, gain: Gain): Promise<string[]> {
  const owned = giftable().filter((id) => ctx.owned().includes(id) && StoryState.hasItem(id));
  if (owned.length === 0) return ['No tienes nada para regalar ahora.'];
  const pick = await ask(who, ['¿Qué le regalas?'], owned.map((id) => ITEMS[id].name), 'Volver');
  const id = owned[pick];
  if (!id) return [];
  const tier = giftTierOf(s, id);
  const flag = flagOf(s.id, `g${tier}`, id);
  const name = ITEMS[id].name;
  StoryState.removeItem(id, 1);
  if (!firstTime(flag)) return [`Gracias por otro: ${name}. Ya me habías dado uno, pero lo guardo.`];
  playSfx(tier === 3 ? 'latido' : 'select');
  const line = (tier === 3 ? s.reaction.love : tier === 2 ? s.reaction.like : s.reaction.meh).replace('{item}', name);
  return [line, ...gain.lines()];
}

// --- número

function askNumber(s: Subject, ctx: TalkContext): string[] {
  if (ctx.inPhone(s)) return ['Ya tienes su número.'];
  if (hearts(trust(s.id)) < 1) return [NUMBER_LINES.no[s.style]];
  ctx.gotNumber(s);
  playSfx('notify');
  return [NUMBER_LINES.yes[s.style], `(${s.name} quedó en tus contactos.)`];
}

// --- besos y abrazos

async function kiss(s: Subject, who: string, gain: Gain): Promise<string[]> {
  const pick = await ask(who, ['¿Cómo lo haces?'], ['Un beso en la mejilla', 'Un beso en los labios'], 'Mejor no');
  if (pick < 0) return [];
  const h = hearts(trust(s.id));
  if (pick === 0) {
    if (h < 2) return [KISS.cheekNo[s.style]];
    const fresh = firstTime(flagOf(s.id, 'k', 'cheek'));
    playSfx('beso');
    return fresh ? [KISS.cheekOk[s.style], ...gain.lines()] : [KISS.cheekOk[s.style]];
  }
  if (h < s.needHearts) return [KISS.lipsNo[s.style], `(Química: ${chemistryText(s, trust(s.id))}.)`];
  const fresh = firstTime(flagOf(s.id, 'k', 'lips'));
  playSfx('beso');
  return fresh ? [KISS.lipsOk[s.style], ...gain.lines()] : [KISS.lipsAgain[s.style]];
}

async function hug(s: Subject, _who: string, gain: Gain): Promise<string[]> {
  if (hearts(trust(s.id)) < 2) return [HUG.no[s.style]];
  const fresh = firstTime(flagOf(s.id, 'k', 'cheek'));
  playSfx('select');
  return fresh ? [HUG.ok[s.style], ...gain.lines()] : [HUG.ok[s.style]];
}
