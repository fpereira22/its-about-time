import { playSfx } from '../audio/sfx';
import { SANDBOX_BAG, SANDBOX_CAST, SANDBOX_CITIES, SANDBOX_PLACES, type SandboxPerson, type SandboxPlace } from '../data/sandboxCast';
import { PLAN_LINES } from '../data/sandboxTalk';
import type { DialogueChoice, DialogueNode, DialogueTree, NpcDef } from '../types/story';
import { Dialogue } from './DialogueManager';
import { EventSystem } from './EventSystem';
import { GameMap } from './GameMap';
import { ADMIN_STAGES } from './AdminStages';
import { parseClock, SANDBOX_ID } from './Mission';
import {
  ask,
  band,
  castSubject,
  converse,
  giftTierOf,
  hearts,
  NPC_PREFIX,
  streetSubject,
  trust,
  type Subject,
  type TalkContext,
  type Via,
} from './SandboxSocial';
import { ITEMS, StoryState } from './StoryState';

export { band, hearts, NPC_PREFIX, trust };

/**
 * Modo libre (sandbox), por ahora solo dev (F2 → Sandbox).
 *
 * Una "misión" sin objetivo ni historia (id `sandbox`, ver Mission.ts): el contenido de cada mapa se ve como
 * cuando no hay misión en curso, y en el sitio elegido aparece parte del reparto (src/data/sandboxCast.ts).
 * Con cada persona (y con cualquier desconocido de la calle) se conversa por categorías, se regala, se hacen
 * planes y, si hay química, se besa; todo suma "confianza", que se ve en corazones. El motor de la conversación
 * está en SandboxSocial.ts; aquí viven los sitios, los viajes, el celular y los aeropuertos.
 *
 * - La confianza son flags `sbx_<quien>_<tipo>_<cosa>`: cada cosa cuenta una sola vez. No se guarda con la
 *   partida del jugador (StoryState.save lo ignora).
 * - Viajar: Esc → Viajar lleva (en taxi o bus) a otro sitio del mismo país. Entre Chile y Colombia se vuela: en
 *   el mostrador del aeropuerto (SCL o CLO), con el agente de vuelos.
 * - Celular (app Teléfono): llamar o escribir a quien tengas en contactos y quedar en un sitio; ahí te espera.
 */

export const isSandbox = (): boolean => StoryState.missionId === SANDBOX_ID;

/** Id de diálogo de los NPCs del sandbox: `sbx:<persona>` (o `sbx:s:<desconocido>` si ya tienes su número). */
export const TALK_PREFIX = 'sbx:';
/** "Persona" especial de los aeropuertos: el mostrador de vuelos. */
export const FLIGHT_DESK = '@vuelos';
const STREET_PREFIX = 's:';

const personById = new Map(SANDBOX_CAST.map((p) => [p.id, p]));
export const sandboxPerson = (id: string): SandboxPerson | undefined => personById.get(id);

/** Cuánto gusta `item` a `p`: 3 le encanta, 2 le gusta, 1 cualquier otro. */
export const giftTier = (p: SandboxPerson, item: string): 1 | 2 | 3 => giftTierOf(p, item);

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

// --------------------------------------------------------------------- conversar

/** Gente de la calle cuyo número tienes: id → cómo reconstruirla (mismo mapa + figurante = misma persona). */
const streetContacts = new Map<string, { key: string; sprite: string }>();
/** Planes: id del sitio → quiénes (ids de `Subject`) esperan ahí al jugador. */
const meetups = new Map<string, string[]>();
/** Planes que ya se cumplieron (la persona apareció): se borran al irse del sitio. */
const metUp = new Set<string>();

function resetSocial(): void {
  streetContacts.clear();
  meetups.clear();
  metUp.clear();
}

/** Quién es `id`: alguien del reparto o un desconocido del que tienes el número. */
function subjectById(id: string): Subject | undefined {
  const cast = personById.get(id);
  if (cast) return castSubject(cast);
  const street = streetContacts.get(id);
  return street ? streetSubject(street.key, street.sprite) : undefined;
}

/** Lo que cada conversación necesita del sitio y del celular. */
function talkContext(via: Via, street?: { key: string; sprite: string }): TalkContext {
  return {
    via,
    place: currentPlace?.name ?? 'este lugar',
    owned: () => giftable().filter((id) => StoryState.hasItem(id)),
    plan: (s) => planWith(s, via),
    gotNumber: (s) => {
      if (street && s.kind === 'street') streetContacts.set(s.id, street);
    },
    inPhone: (s) => s.kind === 'cast' || streetContacts.has(s.id),
  };
}

async function talkWith(s: Subject, via: Via, street?: { key: string; sprite: string }): Promise<void> {
  const out = await converse(s, talkContext(via, street));
  const place = out.go ? placeById(out.go) : undefined;
  if (place) goTo(place);
}

/** Abre la conversación con `who` (la llama el mapa al interactuar con un NPC del sandbox). */
export function talkTo(who: string): Promise<void> {
  if (who === FLIGHT_DESK) return openFlightDesk();
  const id = who.startsWith(STREET_PREFIX) ? who.slice(STREET_PREFIX.length) : who;
  const s = subjectById(id);
  if (!s) return Promise.resolve();
  return talkWith(s, 'persona', streetContacts.get(id));
}

/** Conversa con un desconocido de la calle (`key` = mapa + figurante: misma clave, misma persona). */
export function talkToStranger(key: string, sprite: string): Promise<void> {
  return talkWith(streetSubject(key, sprite), 'persona', { key, sprite });
}

/**
 * Hacer un plan: se elige ciudad y lugar (del mismo país; los aeropuertos se toman con el mostrador) y la persona
 * queda esperando ahí. En persona se puede ir juntos de una vez; por el celular, se va cuando uno quiera.
 */
async function planWith(s: Subject, via: Via): Promise<{ lines: string[]; go?: string } | null> {
  const here = currentPlace;
  if (!here) return null;
  const cities = SANDBOX_CITIES.filter((c) => c.country === here.country);
  const ci = await ask('Plan', [`¿En qué ciudad quedan con ${s.name}?`], cities.map((c) => (c.id === here.city ? `${c.name} (aquí)` : c.name)), 'Volver');
  const city = cities[ci];
  if (!city) return null;
  const places = SANDBOX_PLACES.filter((p) => p.city === city.id && !p.flightTo);
  const pi = await ask(city.name, ['¿Y en qué lugar?'], places.map((p) => p.name), 'Volver');
  const place = places[pi];
  if (!place) return null;
  meetups.set(place.id, [...(meetups.get(place.id) ?? []).filter((x) => x !== s.id), s.id]);
  metUp.delete(place.id);
  const lines = [PLAN_LINES.yes[s.style], `(Quedaron en: ${place.label}.)`];
  const go = await ask('Plan', [`¿Van ya a ${place.name}?`], [via === 'persona' ? 'Sí, vamos juntos' : 'Sí, voy ahora'], 'Voy después');
  return go === 0 ? { lines, go: place.id } : { lines };
}

// --------------------------------------------------------------------- celular

/** Contactos del celular en el modo libre: el reparto y los desconocidos cuyo número conseguiste. */
export function sandboxContacts(): Array<{ id: string; name: string }> {
  return [
    ...SANDBOX_CAST.map((p) => ({ id: p.id, name: p.name })),
    ...[...streetContacts.entries()].map(([id, c]) => ({ id, name: streetSubject(c.key, c.sprite).name })),
  ];
}

/** App Teléfono: llamar o escribir a un contacto (la conversación es la misma, con las opciones del celular). */
export async function phoneContact(id: string): Promise<void> {
  const s = subjectById(id);
  if (!s) return;
  const pick = await ask(s.name, [`¿Cómo hablas con ${s.name}?`], ['Llamar', 'Escribir un mensaje'], 'Cancelar');
  if (pick < 0) return;
  if (pick === 0) playSfx('phone');
  await talkWith(s, pick === 0 ? 'llamada' : 'mensaje');
}

let currentPlace: SandboxPlace | null = null;

/** Empieza una partida de sandbox en `place`: plata, mochila con regalos y clima despejado. */
export function beginSandbox(place: SandboxPlace): void {
  currentPlace = place;
  airportRun = null;
  freeHall = false;
  realArrival = false;
  resetSocial();
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
  if (here) setCurrentPlace(here);
  const place = currentPlace;
  if (!place || place.map !== mapId) return [];
  const map = GameMap.get(mapId);
  const spawn = map.spawn(place.spawn);
  // El mostrador primero: así queda en el sitio libre más cercano a donde aparece el jugador. Luego quienes
  // quedaron en verse aquí, y después el reparto del sitio (sin repetir).
  const waiting = meetups.get(place.id) ?? [];
  const ids = [...new Set([...(place.flightTo ? [FLIGHT_DESK] : []), ...waiting, ...place.cast])];
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
    if (p) {
      out.push({ id: `${NPC_PREFIX}${id}`, map: mapId, x: at.x, y: at.y, sprite: p.sprite, dir: 'down', dialogue: `${TALK_PREFIX}${id}`, wander: 1 });
      if (waiting.includes(id)) metUp.add(place.id);
      return;
    }
    const street = streetContacts.get(id);
    if (!street) return;
    out.push({ id: `${NPC_PREFIX}${id}`, map: mapId, x: at.x, y: at.y, sprite: street.sprite, dir: 'down', dialogue: `${TALK_PREFIX}${STREET_PREFIX}${id}`, wander: 1 });
    if (waiting.includes(id)) metUp.add(place.id);
  });
  return out;
}

/** Cambia el sitio actual. Al irse de uno donde ya los esperaban, ese plan se da por cumplido. */
function setCurrentPlace(place: SandboxPlace): void {
  const left = currentPlace;
  if (left && left.id !== place.id && metUp.has(left.id)) {
    meetups.delete(left.id);
    metUp.delete(left.id);
  }
  currentPlace = place;
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
  setCurrentPlace(place);
  // La estación Universidades (T31) funciona por dentro y por fuera de los torniquetes: se llega por afuera.
  if (place.id === 'universidades') StoryState.setFlag('m6_afuera');
  EventSystem.emit('warp', { map: place.map, spawn: place.spawn });
}

/** Viaja (en taxi o bus) a `place`: abandona los trámites a medias, anuncia el lugar y aparece ahí. */
function goTo(place: SandboxPlace): void {
  endAirportRun();
  EventSystem.emit('banner', { title: place.name, subtitle: place.label.split(' · ')[0] });
  arriveAt(place);
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
    ...(airportRun !== null ? [{ label: here.flightTo ? 'Saltar los trámites y volar directo' : 'Saltar los trámites' }] : []),
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
  if (chosen) goTo(chosen);
}

/** Despegue, vuelo y aterrizaje (carteles y sonidos) hasta `dest`. */
async function flyTo(from: SandboxPlace, dest: SandboxPlace): Promise<void> {
  const city = (p: SandboxPlace): string => `${cityOf(p)} (${p.country === 'CL' ? 'SCL' : 'CLO'})`;
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

/**
 * Los trámites del aeropuerto. Hay cuatro halls jugables:
 * - Santiago, salidas (scl_salidas → controles → espigones → avión): los de la misión del vuelo.
 * - Cali, llegadas (clo_llegadas): migración, cinta y aduana de la misión; se llega por ese avión.
 * - Cali, salidas (clo_salidas): check-in, migración, seguridad y puerta de embarque (flags `co_*`).
 * - Santiago, llegadas (scl_llegadas): PDI, cinta y aduana del SAG; se llega tras embarcar en Cali.
 * Entrar a un hall de salidas arma lo que hace falta (maleta, carnet); las llegadas con trámites terminan con la
 * flag `aduana_ok`, y las llegadas sin trámites (vuelo directo o taxi) dejan el hall libre.
 */
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
/** Flag con que terminan los trámites de una llegada. */
const RUN_DONE_FLAG = 'aduana_ok';
const ADMIN_FROM_LABEL = 'Aeropuerto: llegada y check-in';
/** Halls de llegadas (migración, cinta, aduana). */
const ARRIVAL_MAPS = ['clo_llegadas', 'scl_llegadas'];
/** Flag que ponen las puertas de embarque de Cali al abordar (se temporal: empieza con "_"). */
const BOARD_FLAG = '_sbx_board';
/** Lo que deja un hall de llegadas sin trámites: ya pasaste migración, tienes tu maleta y la aduana. */
const FREE_HALL_FLAGS = ['en_vuelo', 'aterrizo', 'migracion_ok', 'maleta_recogida', 'aduana_ok', 'enter_clo_llegadas_llegada'];
let freeHall = false;
/** Se embarcó en un hall de salidas con trámites: al llegar, los de llegada también son de verdad. */
let realArrival = false;

/** ¿Hay trámites del aeropuerto en curso? (MapScene: deja correr las escenas de llegada y ofrece saltarlos con F.) */
export const airportRunActive = (): boolean => isSandbox() && airportRun !== null;

const takeSnapshot = (): AirportRun => ({
  flagsBefore: new Set(StoryState.allFlags()),
  itemsBefore: Object.fromEntries(RUN_ITEMS.map((i) => [i, StoryState.itemCount(i)])),
});

/** Ciudad de un sitio sin el nombre del lugar ("Santiago · Aeropuerto" → "Santiago"). */
const cityOf = (p: SandboxPlace): string => p.label.split(' · ')[0];

/**
 * La llama el mapa al aparecer. En un hall de salidas el jugador tiene que poder pasar el mostrador, migración y
 * seguridad: si no vino por el mostrador de vuelos, se le arman la maleta y el carnet. Los halls de llegadas
 * quedan con trámites o libres, según cómo se llegó.
 */
export function enterSandboxMap(mapId: string): void {
  if (!isSandbox()) return;
  if (!ARRIVAL_MAPS.includes(mapId)) endFreeHall();
  if (airportRun) return;
  if (mapId === 'scl_salidas') startAirportRun();
  else if (mapId === 'clo_salidas') startDepartureRun();
  else if (ARRIVAL_MAPS.includes(mapId)) {
    if (realArrival && mapId === 'scl_llegadas') startArrivalRun();
    else openFreeHall();
    realArrival = false;
  }
}

/** Sin trámites, los controles del hall de llegadas ya están hechos: se camina por todo el hall sin que pidan nada. */
function openFreeHall(): void {
  if (freeHall) return;
  freeHall = true;
  for (const f of FREE_HALL_FLAGS) StoryState.setFlag(f);
  if (!StoryState.hasItem('carnet')) StoryState.addItem('carnet');
}

function endFreeHall(): void {
  if (!freeHall) return;
  freeHall = false;
  for (const f of FREE_HALL_FLAGS) StoryState.setFlag(f, false);
}

/**
 * Empieza los trámites reales en el aeropuerto de Santiago: parte como en la misión (con la maleta armada y el
 * carnet), sin la despedida con la familia. Hay que hacer el check-in, pasar PDI, SAG y seguridad, esperar el
 * embarque, volar, pasar migración, recoger la maleta y la aduana. F (o Esc → Viajar) los salta.
 */
function startAirportRun(): void {
  if (airportRun) return;
  endFreeHall();
  airportRun = takeSnapshot();
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

/** Salidas de Cali: llevas el carnet y la maleta; hay que hacer el check-in, migración, seguridad y abordar. */
function startDepartureRun(): void {
  if (airportRun) return;
  endFreeHall();
  airportRun = takeSnapshot();
  for (const item of ['carnet', 'maleta']) if (!StoryState.hasItem(item)) StoryState.addItem(item);
  StoryState.setObjective('Haz el check-in: Cordillera Air');
  EventSystem.emit('banner', { title: 'Trámites del aeropuerto', subtitle: 'Hazlos de verdad, o pulsa F para saltarlos' });
}

/** Llegada a Santiago tras embarcar con trámites: PDI, cinta de equipaje y SAG. */
function startArrivalRun(): void {
  if (airportRun) return;
  endFreeHall();
  airportRun = takeSnapshot();
  if (!StoryState.hasItem('carnet')) StoryState.addItem('carnet');
  // La maleta viajó en la bodega: se recoge en la cinta.
  StoryState.removeItem('maleta', StoryState.itemCount('maleta'));
  StoryState.setObjective('Pasa el control de la PDI');
  EventSystem.emit('banner', { title: 'Trámites del aeropuerto', subtitle: 'PDI, cinta de equipaje y SAG (F los salta)' });
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

/**
 * Cada cuadro: si ya pasó la aduana de una llegada, los trámites terminaron; y si se abordó en Cali, el vuelo parte.
 */
export function checkAirportRun(): void {
  if (StoryState.hasFlag(BOARD_FLAG)) {
    StoryState.setFlag(BOARD_FLAG, false);
    void boardFlight();
    return;
  }
  if (!airportRun || !StoryState.hasFlag(RUN_DONE_FLAG)) return;
  endAirportRun();
  openFreeHall();
  const city = currentPlace ? cityOf(currentPlace) : 'tu destino';
  EventSystem.emit('banner', { title: `¡Listo, estás en ${city}!`, subtitle: 'Esc → Viajar para salir del aeropuerto' });
}

/** La puerta de embarque (Cali): si los trámites fueron de verdad, la llegada también lo será. */
async function boardFlight(): Promise<void> {
  const from = currentPlace;
  const dest = from?.flightTo ? placeById(from.flightTo) : undefined;
  if (!from || !dest) return;
  const real = airportRun !== null;
  endAirportRun();
  realArrival = real;
  await flyTo(from, dest);
}

/**
 * Saltarse los trámites: se abandonan. En un hall de salidas se vuela directo; en uno de llegadas, el hall queda
 * libre.
 */
export async function skipAirportRun(): Promise<void> {
  const from = currentPlace;
  if (!airportRun || !from) return;
  const dest = from.flightTo ? placeById(from.flightTo) : undefined;
  endAirportRun();
  if (!dest) {
    openFreeHall();
    return;
  }
  realArrival = false;
  await flyTo(from, dest);
}

/** F durante los trámites: pregunta si de verdad se quieren saltar. */
export async function offerSkip(): Promise<void> {
  if (!airportRunActive()) return;
  const dest = currentPlace?.flightTo ? placeById(currentPlace.flightTo) : undefined;
  const tree: DialogueTree = {
    start: 'inicio',
    nodes: {
      inicio: {
        speaker: 'Trámites',
        text: dest ? `¿Te saltas los trámites del aeropuerto y vuelas directo a ${cityOf(dest)}?` : '¿Te saltas los trámites que quedan?',
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
  const city = cityOf(dest);
  // El vuelo con trámites reales de la misión (maleta, familia, aviones) solo existe de Santiago a Cali.
  const real = here.id === 'scl';
  const tree: DialogueTree = {
    start: 'inicio',
    nodes: {
      inicio: {
        speaker: 'Agente de vuelos',
        text: real ? `Buenas. Hay vuelo a ${city}. ¿Lo haces con todos los trámites, o directo?` : `Buenas. Hay vuelo a ${city} ahora mismo, sin escalas. ¿Te anoto? (Los trámites los haces caminando por el hall.)`,
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
  if (wantsFly) {
    endAirportRun();
    realArrival = false;
    await flyTo(here, dest);
  }
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
