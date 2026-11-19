import { playSfx } from '../audio/sfx';
import { BAND_AT, MAX_HEARTS, POINTS, SANDBOX_BAG, SANDBOX_CAST, SANDBOX_CITIES, SANDBOX_PLACES, type SandboxPerson, type SandboxPlace } from '../data/sandboxCast';
import type { DialogueChoice, DialogueNode, DialogueTree, NpcDef } from '../types/story';
import { Dialogue } from './DialogueManager';
import { EventSystem } from './EventSystem';
import { GameMap } from './GameMap';
import { ADMIN_STAGES } from './AdminStages';
import { parseClock, SANDBOX_ID } from './Mission';
import { ITEMS, StoryState } from './StoryState';

/**
 * Modo libre (sandbox), por ahora solo dev (F2 → Sandbox).
 *
 * Una "misión" sin objetivo ni historia (id `sandbox`, ver Mission.ts): el contenido de cada mapa se ve como
 * cuando no hay misión en curso, y en el sitio elegido aparece parte del reparto (src/data/sandboxCast.ts).
 * Con cada persona se puede charlar de temas y regalar cosas; todo suma "confianza", que se ve en corazones.
 *
 * - La confianza son flags `sbx_<quien>_t_<tema>` (tema), `sbx_<quien>_g<1|2|3>_<ítem>` (regalo según cuánto
 *   gustó): cada cosa cuenta una sola vez. No se guarda con la partida del jugador (StoryState.save lo ignora).
 * - Los diálogos se arman en código a partir de los datos y se abren con Dialogue.runTree.
 * - Viajar: Esc → Viajar lleva (en taxi o bus) a otro sitio del mismo país. Entre Chile y Colombia se vuela: en
 *   el mostrador del aeropuerto (SCL o CLO), con el agente de vuelos.
 */

export const isSandbox = (): boolean => StoryState.missionId === SANDBOX_ID;

export const NPC_PREFIX = 'sbx_';
/** Id de diálogo de los NPCs del sandbox: `sbx:<persona>`. */
export const TALK_PREFIX = 'sbx:';
/** "Persona" especial de los aeropuertos: el mostrador de vuelos. */
export const FLIGHT_DESK = '@vuelos';

const personById = new Map(SANDBOX_CAST.map((p) => [p.id, p]));
export const sandboxPerson = (id: string): SandboxPerson | undefined => personById.get(id);

const topicFlag = (who: string, topic: string): string => `${NPC_PREFIX}${who}_t_${topic}`;
const giftFlag = (who: string, tier: 1 | 2 | 3, item: string): string => `${NPC_PREFIX}${who}_g${tier}_${item}`;

/** Cuánto gusta `item` a `p`: 3 le encanta, 2 le gusta, 1 cualquier otro. */
export function giftTier(p: SandboxPerson, item: string): 1 | 2 | 3 {
  return p.loves.includes(item) ? 3 : p.likes.includes(item) ? 2 : 1;
}

/** Puntos de confianza con `who` (según las flags de la partida). */
export function trust(who: string): number {
  let total = 0;
  const prefix = `${NPC_PREFIX}${who}_`;
  for (const f of StoryState.allFlags()) {
    if (!f.startsWith(prefix)) continue;
    const rest = f.slice(prefix.length);
    if (rest.startsWith('t_')) total += POINTS.topic;
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

const heartsText = (points: number): string => {
  const n = hearts(points);
  return '♥'.repeat(n) + '♡'.repeat(MAX_HEARTS - n);
};

/** Ítems que se pueden regalar: todos los de items.json menos la tarjeta Bip!. */
const giftable = (): string[] => Object.keys(ITEMS).filter((id) => id !== 'bip');

/** Opciones por página de un menú largo: la caja de opciones no se desplaza, así que se reparten en páginas. */
export const CHOICES_PER_PAGE = 6;

/**
 * Un menú con muchas opciones, repartido en páginas `<id>`, `<id>_1`... Cada una trae "Más..." (si hay otra
 * página) y `back`. `choice` arma cada opción; `back.goto` vacío cierra la conversación.
 */
function pagedMenu<T>(
  nodes: Record<string, DialogueNode>,
  id: string,
  head: { speaker: string; text: string },
  entries: readonly T[],
  choice: (entry: T) => DialogueChoice,
  back: { label: string; goto?: string },
): void {
  const pages = Math.max(1, Math.ceil(entries.length / CHOICES_PER_PAGE));
  for (let n = 0; n < pages; n++) {
    const choices = entries.slice(n * CHOICES_PER_PAGE, (n + 1) * CHOICES_PER_PAGE).map(choice);
    if (pages > 1) choices.push({ label: 'Más...', goto: `${id}${n + 1 < pages ? `_${n + 1}` : ''}` });
    choices.push({ label: back.label, goto: back.goto });
    nodes[n === 0 ? id : `${id}_${n}`] = { ...head, choices };
  }
}

/**
 * El árbol de diálogo de `p`: menú principal, temas y regalos. `owned` son los ítems que se ofrecen para regalar
 * (los que hay en la mochila al empezar la conversación).
 */
export function buildTree(p: SandboxPerson, owned: readonly string[] = giftable()): DialogueTree {
  const nodes: Record<string, DialogueNode> = {};
  const gain = `(+♥ ${p.name})`;
  const items = giftable();

  nodes.inicio = { speaker: p.name, text: '{sbx_greet}', next: 'menu' };
  nodes.menu = {
    speaker: p.name,
    text: '¿Qué hacemos?',
    choices: [
      { label: 'Hablar de...', goto: 'temas' },
      { label: 'Regalar algo', goto: 'regalos', if: { any: items.map((id) => ({ hasItem: id })) } },
      { label: 'Ver confianza', goto: 'confianza' },
      { label: 'Despedirme' },
    ],
  };
  nodes.confianza = { speaker: p.name, text: '{sbx_hearts}', next: 'menu' };

  // Temas: la primera vez suma confianza; las siguientes, una respuesta corta.
  pagedMenu(nodes, 'temas', { speaker: p.name, text: '¿De qué quieres hablar?' }, p.topics, (t) => ({ label: t.label, goto: `t_${t.id}` }), { label: 'Volver', goto: 'menu' });
  for (const t of p.topics) {
    nodes[`t_${t.id}`] = { branches: [{ if: { flag: topicFlag(p.id, t.id) }, goto: `tr_${t.id}` }, { goto: `tf_${t.id}` }] };
    nodes[`tf_${t.id}`] = {
      speaker: p.name,
      text: [...t.lines, gain],
      effects: [{ setFlag: topicFlag(p.id, t.id) }, { sfx: 'latido' }],
      next: 'temas',
    };
    nodes[`tr_${t.id}`] = { speaker: p.name, text: ['Ya hablamos de eso, ¿te acuerdas?', t.lines[0]], next: 'temas' };
  }

  // Regalos: cada ítem cuenta una sola vez por persona; repetirlo no suma (pero se lo queda).
  const offered = items.filter((id) => owned.includes(id));
  pagedMenu(nodes, 'regalos', { speaker: p.name, text: '¿Qué me traes?' }, offered, (id) => ({ label: ITEMS[id].name, goto: `g_${id}`, if: { hasItem: id } }), { label: 'Volver', goto: 'menu' });
  for (const id of items) {
    const tier = giftTier(p, id);
    const flag = giftFlag(p.id, tier, id);
    const line = (tier === 3 ? p.reaction.love : tier === 2 ? p.reaction.like : p.reaction.meh).replace('{item}', ITEMS[id].name);
    nodes[`g_${id}`] = { branches: [{ if: { flag }, goto: `gr_${id}` }, { goto: `gf_${id}` }] };
    nodes[`gf_${id}`] = {
      speaker: p.name,
      text: [line, gain],
      effects: [{ takeItem: id }, { setFlag: flag }, { sfx: tier === 3 ? 'latido' : 'select' }],
      next: 'menu',
    };
    nodes[`gr_${id}`] = {
      speaker: p.name,
      text: `Gracias por otro: ${ITEMS[id].name}. Ya me habías dado uno, pero lo guardo.`,
      effects: [{ takeItem: id }],
      next: 'menu',
    };
  }
  return { start: 'inicio', nodes };
}

/** Abre la conversación con `who` (la llama el mapa al interactuar con un NPC del sandbox). */
export function talkTo(who: string): Promise<void> {
  if (who === FLIGHT_DESK) return openFlightDesk();
  const p = personById.get(who);
  if (!p) return Promise.resolve();
  const tree = buildTree(p, giftable().filter((id) => StoryState.hasItem(id)));
  const points = trust(who);
  Dialogue.vars.set('sbx_greet', p.greet[band(points)]);
  Dialogue.vars.set('sbx_hearts', `Confianza con ${p.name}: ${heartsText(points)}`);
  return Dialogue.runTree(tree, `sandbox:${who}`);
}

let currentPlace: SandboxPlace | null = null;

/** Empieza una partida de sandbox en `place`: plata, mochila con regalos y clima despejado. */
export function beginSandbox(place: SandboxPlace): void {
  currentPlace = place;
  airportRun = null;
  StoryState.newGame(SANDBOX_ID, { money: 500000, clock: parseClock('sáb 12:00', 0) });
  freeRunClock();
  for (const id of SANDBOX_BAG) if (ITEMS[id]) StoryState.addItem(id, 2);
  StoryState.setObjective('Modo libre: charla, regala y viaja (Esc → Viajar).');
  StoryState.location = { map: place.map, spawn: place.spawn };
}

export function placeById(id: string): SandboxPlace | undefined {
  return SANDBOX_PLACES.find((p) => p.id === id);
}

/** El sitio donde se está (el de la última partida o viaje), o null fuera del sandbox. */
export function currentSandboxPlace(): SandboxPlace | null {
  return isSandbox() ? currentPlace : null;
}

/**
 * Los NPCs del sandbox en el mapa `mapId`: el reparto del sitio, a unos pasos del punto de aparición, y en los
 * aeropuertos el agente del mostrador de vuelos. Solo hay reparto en el mapa del sitio actual.
 */
export function sandboxNpcs(mapId: string): NpcDef[] {
  if (!isSandbox()) return [];
  // Al entrar a un mapa que es un sitio del sandbox (por un vuelo, un viaje o una puerta), ese pasa a ser el sitio actual.
  const here = SANDBOX_PLACES.find((p) => p.map === mapId);
  if (here) currentPlace = here;
  if (!currentPlace || currentPlace.map !== mapId) return [];
  const map = GameMap.get(mapId);
  const spawn = map.spawn(currentPlace.spawn);
  // El mostrador primero: así queda en el sitio libre más cercano a donde aparece el jugador.
  const ids = currentPlace.flightTo ? [FLIGHT_DESK, ...currentPlace.cast] : currentPlace.cast;
  const free = freeTilesAround(map, spawn.x, spawn.y, ids.length);
  const out: NpcDef[] = [];
  ids.forEach((id, i) => {
    const at = free[i];
    if (!at) return;
    if (id === FLIGHT_DESK) {
      out.push({ id: `${NPC_PREFIX}vuelos`, map: mapId, x: at.x, y: at.y, sprite: 'agente_counter', dir: 'down', dialogue: `${TALK_PREFIX}${FLIGHT_DESK}` });
      return;
    }
    const p = personById.get(id);
    if (p) out.push({ id: `${NPC_PREFIX}${id}`, map: mapId, x: at.x, y: at.y, sprite: p.sprite, dir: 'down', dialogue: `${TALK_PREFIX}${id}`, wander: 1 });
  });
  return out;
}

/** Sprites que en el sandbox no salen como NPCs de la historia: la familia y el reparto (que ya viene del sandbox). */
const STORY_SPRITES = ['mama', 'papa', 'hermano', ...SANDBOX_CAST.map((p) => p.id)];

/**
 * En el sandbox, los personajes de la historia (con sus diálogos de misión) no aparecen: el reparto lo pone el
 * sandbox. El resto de la gente de cada mapa (vendedores, guardias, vecinos) sí.
 */
export function hidesStoryNpc(def: NpcDef): boolean {
  if (!isSandbox()) return false;
  // El chofer de la universidad lleva al furgón de la historia: en el sandbox los trámites terminan en el hall.
  if (def.dialogue === 'chofer_furgon') return true;
  if (!def.sprite) return false;
  return STORY_SPRITES.some((id) => def.sprite === id || def.sprite?.startsWith(`${id}_`));
}

// --------------------------------------------------------------------- viajar

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Pasa al sitio `place`: lo deja como sitio actual (para que aparezca su reparto) y cambia de mapa. */
function arriveAt(place: SandboxPlace): void {
  currentPlace = place;
  EventSystem.emit('warp', { map: place.map, spawn: place.spawn });
}

/** El reloj del sandbox corre solo, sin tope cercano (los trámites del aeropuerto lo fijan y después se suelta). */
function freeRunClock(): void {
  StoryState.setClock(StoryState.clock, parseClock('dom++ 23:59', 0));
}

/**
 * Esc → Viajar: primero la ciudad (las del mismo país), luego el lugar (taxi o bus). Entre países hay que volar
 * desde un aeropuerto. Con trámites del aeropuerto a medias, la primera opción es saltarlos (igual que la tecla F).
 */
export async function openTravel(): Promise<void> {
  const here = currentPlace;
  if (!here) return;
  const cities = SANDBOX_CITIES.filter((c) => c.country === here.country);
  const country = here.country === 'CO' ? 'Colombia' : 'Chile';
  const nodes: Record<string, DialogueNode> = {};
  for (const city of cities) {
    const places = SANDBOX_PLACES.filter((p) => p.city === city.id && p.id !== here.id);
    pagedMenu(
      nodes,
      `c_${city.id}`,
      { speaker: city.name, text: '¿A qué lugar vamos?' },
      places,
      (p) => ({ label: p.name, effects: [{ setFlag: `_sbx_go_${p.id}` }] }),
      { label: 'Volver', goto: 'inicio' },
    );
  }
  const entries: Array<{ label: string; city?: string }> = [
    ...(airportRun !== null ? [{ label: 'Saltar los trámites y volar a Cali' }] : []),
    ...cities.map((c) => ({ label: c.id === here.city ? `${c.name} (aquí)` : c.name, city: c.id })),
  ];
  pagedMenu(
    nodes,
    'inicio',
    { speaker: 'Viajar', text: `¿A dónde vamos? (en ${country}; para cruzar de país hay que ir a un aeropuerto)` },
    entries,
    (e) => (e.city ? { label: e.label, goto: `c_${e.city}` } : { label: e.label, effects: [{ setFlag: '_sbx_skip' }] }),
    { label: 'Quedarme aquí' },
  );
  await Dialogue.runTree({ start: 'inicio', nodes }, 'sandbox:viajar');
  const wantsSkip = StoryState.hasFlag('_sbx_skip');
  const chosen = SANDBOX_PLACES.find((p) => StoryState.hasFlag(`_sbx_go_${p.id}`));
  StoryState.setFlag('_sbx_skip', false);
  for (const p of SANDBOX_PLACES) StoryState.setFlag(`_sbx_go_${p.id}`, false);
  if (wantsSkip) return void (await skipAirportRun());
  if (!chosen) return;
  // Irse a otro lado deja los trámites a medias: se abandonan.
  endAirportRun();
  EventSystem.emit('banner', { title: chosen.name, subtitle: chosen.label.split(' · ')[0] });
  arriveAt(chosen);
}

/** Despegue, vuelo y aterrizaje (carteles y sonidos) hasta `dest`. */
async function flyTo(from: SandboxPlace, dest: SandboxPlace): Promise<void> {
  const city = (p: SandboxPlace): string => `${p.label.split(' · ')[0]} (${p.id.toUpperCase()})`;
  EventSystem.emit('banner', { title: 'Despegue', subtitle: `${city(from)} → ${city(dest)}` });
  playSfx('avion');
  await wait(3200);
  EventSystem.emit('banner', { title: 'En vuelo', subtitle: 'Altura de crucero · 11.000 metros' });
  playSfx('chime');
  await wait(2800);
  EventSystem.emit('banner', { title: 'Aterrizaje', subtitle: dest.label });
  playSfx('avion');
  await wait(1800);
  arriveAt(dest);
}

// --------------------------------------------------------------------- trámites del aeropuerto

/** Los trámites reales SCL → CLO (los de la misión del vuelo): check-in, PDI, SAG, embarque, migración, maleta, aduana. */
interface AirportRun {
  /** Flags que ya había antes de empezar: al terminar se borran las que se sumaron (menos la confianza del sandbox). */
  flagsBefore: Set<string>;
  /** Cuántos había de los ítems del viaje (carnet, maleta, pase...): al terminar vuelven a esa cantidad. */
  itemsBefore: Record<string, number>;
}

let airportRun: AirportRun | null = null;

/** Ítems que se usan en los trámites. */
const RUN_ITEMS = ['carnet', 'maleta', 'marraqueta', 'pase'];
/** Flags que se ponen para saltarse la despedida con la familia (en el sandbox no están). */
const SKIP_FAMILY = ['despedida', 'abrazo_papa', 'abrazo_hermano', 'enter_scl_salidas_llegada'];
/** Flag con que terminan los trámites en Cali: después solo queda el chofer de la historia. */
const RUN_DONE_FLAG = 'aduana_ok';
const ADMIN_FROM_LABEL = 'Aeropuerto: llegada y check-in';

/** ¿Hay trámites del aeropuerto en curso? (MapScene: deja correr las escenas de llegada y ofrece saltarlos con F.) */
export const airportRunActive = (): boolean => isSandbox() && airportRun !== null;

/**
 * Empieza los trámites reales en el aeropuerto de Santiago: parte como en la misión (con la maleta armada y el
 * carnet), sin la despedida con la familia. Hay que hacer el check-in, pasar PDI, SAG y seguridad, esperar el
 * embarque, volar, pasar migración, recoger la maleta y la aduana. F (o Esc → Viajar) los salta.
 */
function startAirportRun(): void {
  airportRun = { flagsBefore: new Set(StoryState.allFlags()), itemsBefore: Object.fromEntries(RUN_ITEMS.map((i) => [i, StoryState.itemCount(i)])) };
  const stages = ADMIN_STAGES.mission03 ?? [];
  const upTo = stages.findIndex((st) => st.label === ADMIN_FROM_LABEL);
  for (const st of stages.slice(0, upTo + 1)) {
    for (const f of st.flags ?? []) StoryState.setFlag(f);
    for (const item of st.items ?? []) if (!StoryState.hasItem(item)) StoryState.addItem(item);
  }
  for (const f of SKIP_FAMILY) StoryState.setFlag(f);
  const at = stages[upTo];
  if (at?.clock) StoryState.setClock(parseClock(at.clock, 0), at.max ? parseClock(at.max, 0) : undefined);
  StoryState.setObjective(at?.objective ?? 'Haz el check-in');
  EventSystem.emit('banner', { title: 'Trámites del aeropuerto', subtitle: 'Hazlos de verdad, o pulsa F para saltarlos' });
}

/** Deja el sandbox como antes de los trámites: sin sus flags ni ítems, con el reloj suelto y el objetivo del modo libre. */
function endAirportRun(): void {
  const run = airportRun;
  if (!run) return;
  airportRun = null;
  for (const f of StoryState.allFlags()) if (!run.flagsBefore.has(f) && !f.startsWith(NPC_PREFIX)) StoryState.setFlag(f, false);
  for (const item of RUN_ITEMS) {
    const extra = StoryState.itemCount(item) - (run.itemsBefore[item] ?? 0);
    if (extra > 0) StoryState.removeItem(item, extra);
  }
  freeRunClock();
  StoryState.setObjective('Modo libre: charla, regala y viaja (Esc → Viajar).');
}

/** Cada cuadro: si ya pasó la aduana en Cali, los trámites terminaron. */
export function checkAirportRun(): void {
  if (!airportRun || !StoryState.hasFlag(RUN_DONE_FLAG)) return;
  endAirportRun();
  EventSystem.emit('banner', { title: '¡Listo, estás en Cali!', subtitle: 'Esc → Viajar para salir del aeropuerto' });
}

/** Saltarse los trámites: se abandonan y se vuela directo a Cali. */
export async function skipAirportRun(): Promise<void> {
  const from = placeById('scl');
  const dest = placeById('clo');
  if (!airportRun || !from || !dest) return;
  endAirportRun();
  await flyTo(from, dest);
}

/** F durante los trámites: pregunta si de verdad se quieren saltar. */
export async function offerSkip(): Promise<void> {
  if (!airportRunActive()) return;
  const tree: DialogueTree = {
    start: 'inicio',
    nodes: {
      inicio: {
        speaker: 'Trámites',
        text: '¿Te saltas los trámites del aeropuerto y vuelas directo a Cali?',
        choices: [{ label: 'Sí, saltarlos', effects: [{ setFlag: '_sbx_skip' }] }, { label: 'No, sigo con los trámites' }],
      },
    },
  };
  await Dialogue.runTree(tree, 'sandbox:saltar');
  if (!StoryState.hasFlag('_sbx_skip')) return;
  StoryState.setFlag('_sbx_skip', false);
  await skipAirportRun();
}

/** Mostrador de vuelos de un aeropuerto: en Santiago, el vuelo con trámites o directo; en Cali, directo. */
async function openFlightDesk(): Promise<void> {
  const here = currentPlace;
  const dest = here?.flightTo ? placeById(here.flightTo) : undefined;
  if (!here || !dest) return;
  const city = dest.label.split(' · ')[0];
  // El vuelo con trámites reales solo existe de Santiago a Cali (son los lugares de la historia).
  const real = here.id === 'scl';
  const tree: DialogueTree = {
    start: 'inicio',
    nodes: {
      inicio: {
        speaker: 'Agente de vuelos',
        text: real ? `Buenas. Hay vuelo a ${city}. ¿Lo haces con todos los trámites, o directo?` : `Buenas. Hay vuelo a ${city} ahora mismo, sin escalas. ¿Te anoto?`,
        choices: [
          ...(real ? [{ label: `A ${city}, con trámites`, effects: [{ setFlag: '_sbx_real' }], goto: 'real' }] : []),
          { label: real ? `A ${city}, directo` : `Sí, a ${city}`, effects: [{ setFlag: '_sbx_fly' }], goto: 'ok' },
          { label: 'Solo miraba' },
        ],
      },
      ok: { speaker: 'Agente de vuelos', text: 'Listo, ya tienes tu pase de abordar. Buen viaje.' },
      real: {
        speaker: 'Agente de vuelos',
        text: ['Perfecto. Empieza por el check-in: Cordillera Air, Isla B.', 'Después PDI, SAG y seguridad, y a esperar el embarque. Si te cansas, pulsa F para saltar los trámites.'],
      },
    },
  };
  await Dialogue.runTree(tree, 'sandbox:vuelos');
  const wantsReal = StoryState.hasFlag('_sbx_real');
  const wantsFly = StoryState.hasFlag('_sbx_fly');
  StoryState.setFlag('_sbx_real', false);
  StoryState.setFlag('_sbx_fly', false);
  if (wantsReal) return startAirportRun();
  if (wantsFly) await flyTo(here, dest);
}

/** Tiles libres a 2–5 pasos de (x, y), sin pared ni puerta, con salida por varios lados y separados entre sí. */
function freeTilesAround(map: GameMap, x: number, y: number, count: number): Array<{ x: number; y: number }> {
  const found: Array<{ x: number; y: number; d: number }> = [];
  for (let dy = -5; dy <= 5; dy++) {
    for (let dx = -5; dx <= 5; dx++) {
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      if (d < 2) continue;
      const tx = x + dx;
      const ty = y + dy;
      if (map.isSolid(tx, ty) || map.warpAt(tx, ty)) continue;
      let open = 0;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!map.isSolid(tx + ox, ty + oy)) open++;
      if (open < 3) continue;
      found.push({ x: tx, y: ty, d });
    }
  }
  found.sort((a, b) => a.d - b.d || a.x - b.x || a.y - b.y);
  const chosen: Array<{ x: number; y: number }> = [];
  for (const f of found) {
    if (chosen.every((c) => Math.abs(c.x - f.x) + Math.abs(c.y - f.y) >= 3)) chosen.push(f);
    if (chosen.length >= count) break;
  }
  return chosen;
}
