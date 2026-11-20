import { beforeEach, describe, expect, it } from 'vitest';
import { Dialogue, type DialogueStep } from '../src/systems/DialogueManager';
import { allNpcs } from '../src/scenes/MapScene';
import { Content } from '../src/systems/Content';
import { STYLES } from '../src/data/sandboxTalk';
import { SANDBOX_BAG, SANDBOX_CAST, SANDBOX_CITIES, SANDBOX_PLACES } from '../src/data/sandboxCast';
import spritesData from '../src/data/sprites.json';
import { GameMap } from '../src/systems/GameMap';
import { currentMission, MISSIONS, SANDBOX_ID } from '../src/systems/Mission';
import { EventSystem } from '../src/systems/EventSystem';
import { airportRunActive, checkAirportRun, skipAirportRun, talkTo, openTravel, FLIGHT_DESK, currentSandboxPlace, placeById, band, beginSandbox, giftTier, hearts, isSandbox, sandboxNpcs, enterSandboxMap, sandboxContacts, phoneContact, talkToStranger, trust } from '../src/systems/Sandbox';
import { streetSubject } from '../src/systems/SandboxSocial';
import { ITEMS, StoryState } from '../src/systems/StoryState';
import { check } from '../src/systems/Conditions';

/** Cede el turno para que arranque el siguiente diálogo encadenado; dice si hay uno abierto. */
const settle = async (): Promise<boolean> => {
  await new Promise((r) => setTimeout(r, 0));
  return Dialogue.active;
};

const characters = (spritesData as { characters: Record<string, unknown> }).characters;

describe('datos del sandbox', () => {
  it('cada persona usa un personaje y ítems que existen', () => {
    for (const p of SANDBOX_CAST) {
      expect(characters[p.sprite], `${p.id}: personaje ${p.sprite}`).toBeDefined();
      for (const id of [...p.loves, ...p.likes]) expect(ITEMS[id], `${p.id}: ítem ${id}`).toBeDefined();
      expect(p.loves.filter((i) => p.likes.includes(i)), `${p.id}: ítem en loves y likes`).toEqual([]);
      expect(p.topics.length).toBeGreaterThan(0);
      expect(new Set(p.topics.map((t) => t.id)).size).toBe(p.topics.length);
    }
  });

  it('la mochila inicial y los sitios apuntan a cosas que existen', () => {
    for (const id of SANDBOX_BAG) expect(ITEMS[id], `ítem ${id}`).toBeDefined();
    const ids = new Set(SANDBOX_CAST.map((p) => p.id));
    for (const place of SANDBOX_PLACES) {
      expect(GameMap.ids(), place.id).toContain(place.map);
      expect(place.spawn in GameMap.get(place.map).data.spawns, `${place.id}: spawn ${place.spawn}`).toBe(true);
      for (const who of place.cast) expect(ids.has(who), `${place.id}: ${who}`).toBe(true);
    }
  });

  it('cada persona tiene estilo, temas personales y química razonables', () => {
    for (const p of SANDBOX_CAST) {
      expect(STYLES, p.id).toContain(p.style);
      expect(p.deep.length, p.id).toBeGreaterThan(0);
      expect(p.needHearts).toBeGreaterThanOrEqual(3);
      expect(p.needHearts).toBeLessThanOrEqual(5);
      expect(new Set([...p.topics, ...p.deep].map((t) => t.id)).size, `${p.id}: temas repetidos`).toBe(p.topics.length + p.deep.length);
    }
  });
});

describe('Sandbox', () => {
  beforeEach(() => beginSandbox(SANDBOX_PLACES[0]));

  it('arranca como una misión aparte que no está en la lista del título', () => {
    expect(isSandbox()).toBe(true);
    expect(currentMission().id).toBe(SANDBOX_ID);
    expect(MISSIONS.some((m) => m.id === SANDBOX_ID)).toBe(false);
    expect(StoryState.itemCount(SANDBOX_BAG[0])).toBe(2);
  });

  it('el contenido de cada misión no se ve en el sandbox, y el que no es de misión sí', () => {
    expect(check({ mission: 'mission08' })).toBe(false);
    expect(check({ not: { mission: 'mission08' } })).toBe(true);
  });

  it('la confianza suma una vez por tema o regalo y sube de nivel', () => {
    const sira = SANDBOX_CAST[0];
    expect(trust('sira')).toBe(0);
    expect(band(0)).toBe(0);
    StoryState.setFlag(`sbx_sira_t_${sira.topics[0].id}`);
    StoryState.setFlag(`sbx_sira_t_${sira.topics[0].id}`);
    expect(trust('sira')).toBe(1);
    StoryState.setFlag(`sbx_sira_g3_${sira.loves[0]}`);
    expect(trust('sira')).toBe(4);
    expect(band(4)).toBe(1);
    expect(band(10)).toBe(2);
    expect(hearts(99)).toBe(5);
  });

  it('el regalo que más le gusta depende de la persona', () => {
    const sira = SANDBOX_CAST[0];
    expect(giftTier(sira, sira.loves[0])).toBe(3);
    expect(giftTier(sira, sira.likes[0])).toBe(2);
    expect(giftTier(sira, 'hueso')).toBe(1);
  });

  it('pone al reparto en tiles libres cerca de donde aparece el jugador', () => {
    for (const place of SANDBOX_PLACES) {
      beginSandbox(place);
      const npcs = sandboxNpcs(place.map);
      const map = GameMap.get(place.map);
      expect(npcs.length, place.id).toBeGreaterThan(0);
      for (const n of npcs) expect(map.isSolid(n.x, n.y), `${place.id}: ${n.id} en pared`).toBe(false);
    }
  });

  it('no hay reparto fuera del sandbox ni en mapas que no son un sitio', () => {
    expect(sandboxNpcs('costanera_2')).toEqual([]);
    StoryState.newGame('mission02');
    expect(sandboxNpcs(SANDBOX_PLACES[0].map)).toEqual([]);
  });
});

/** Conversación de punta a punta con una caja de diálogo falsa: avanza páginas y elige opciones por su texto. */
async function converse(who: string, picks: string[]): Promise<DialogueStep[]> {
  const shown: DialogueStep[] = [];
  Dialogue.setPresenter({ show: (step) => void shown.push(step), close: () => undefined });
  const done = talkTo(who);
  let guard = 60;
  while ((await settle()) && guard-- > 0) {
    const last = shown[shown.length - 1];
    if (last.choices) {
      const want = picks.shift();
      // Los menús largos vienen en páginas: si la opción no está, pasa a la siguiente con "Más...".
      let choice = last.choices.find((c) => c.label === want);
      if (!choice) {
        picks.unshift(want as string);
        choice = last.choices.find((c) => c.label === 'Más...');
      }
      expect(choice, `opción "${want}" entre ${last.choices.map((c) => c.label).join(' | ')}`).toBeDefined();
      Dialogue.choose((choice as { index: number }).index);
    } else Dialogue.advance();
  }
  await done;
  return shown;
}

describe('conversaciones del sandbox', () => {
  beforeEach(() => {
    Dialogue.abort();
    beginSandbox(SANDBOX_PLACES[0]);
  });

  it('un tema suma confianza la primera vez y no la segunda', async () => {
    const topic = SANDBOX_CAST[0].topics[0].label;
    await converse('sira', ['Charlar', topic, 'Despedirme']);
    expect(trust('sira')).toBe(1);
    const again = await converse('sira', ['Charlar', `${topic} ✓`, 'Despedirme']);
    expect(trust('sira')).toBe(1);
    expect(again.some((s) => s.text.includes('Ya hablamos'))).toBe(true);
  });

  it('los temas personales se abren con confianza', async () => {
    const deep = SANDBOX_CAST[0].deep[0].label;
    const shown = await converse('sira', ['Charlar', 'Algo más personal...', 'Despedirme']);
    expect(shown.some((s) => s.text.includes('Todavía no hay tanta confianza'))).toBe(true);
    for (const t of SANDBOX_CAST[0].topics) StoryState.setFlag(`sbx_sira_t_${t.id}`);
    await converse('sira', ['Charlar', deep, 'Despedirme']);
    expect(StoryState.hasFlag(`sbx_sira_t_${SANDBOX_CAST[0].deep[0].id}`)).toBe(true);
  });

  it('un regalo que le encanta suma 3, se gasta, y repetirlo no suma', async () => {
    const sira = SANDBOX_CAST[0];
    const item = sira.loves[0];
    const name = ITEMS[item].name;
    const before = StoryState.itemCount(item);
    const first = await converse('sira', ['Regalar algo', name, 'Despedirme']);
    expect(trust('sira')).toBe(3);
    expect(StoryState.itemCount(item)).toBe(before - 1);
    expect(first.some((s) => s.text.includes('+♥'))).toBe(true);
    await converse('sira', ['Regalar algo', name, 'Despedirme']);
    expect(trust('sira')).toBe(3);
    expect(StoryState.itemCount(item)).toBe(before - 2);
  });

  it('sin nada en la mochila no ofrece regalar', async () => {
    for (const id of Object.keys(ITEMS)) StoryState.removeItem(id, StoryState.itemCount(id));
    const shown = await converse('sira', ['Despedirme']);
    const menu = shown.find((s) => s.choices?.some((c) => c.label === 'Despedirme'));
    expect(menu?.choices?.some((c) => c.label === 'Regalar algo')).toBe(false);
  });

  it('los cumplidos y el coqueteo suman una vez, y el coqueteo pide confianza', async () => {
    await converse('sira', ['Hacer un cumplido', 'Me gusta tu estilo', 'Despedirme']);
    expect(trust('sira')).toBe(1);
    await converse('sira', ['Hacer un cumplido', 'Me gusta tu estilo', 'Despedirme']);
    expect(trust('sira')).toBe(1);
    // «Tomar su mano» pide 3 corazones: con menos se rechaza con cariño y no suma.
    await converse('sira', ['Coquetear', 'Tomar su mano', 'Despedirme']);
    expect(trust('sira')).toBe(1);
    await converse('sira', ['Coquetear', 'Mirar un rato, sin decir nada', 'Despedirme']);
    expect(trust('sira')).toBe(2);
  });

  it('el beso en los labios depende de la química: pronto lo rechaza y con 4 corazones sí', async () => {
    const early = await converse('sira', ['Besar', 'Un beso en los labios', 'Despedirme']);
    expect(StoryState.hasFlag('sbx_sira_k_lips')).toBe(false);
    expect(early.some((s) => s.text.includes('Química'))).toBe(true);
    // 8 puntos = 4 corazones
    StoryState.setFlag('sbx_sira_g3_helado_carrito');
    StoryState.setFlag('sbx_sira_g3_cholado');
    StoryState.setFlag('sbx_sira_t_agua');
    StoryState.setFlag('sbx_sira_t_cali');
    expect(hearts(trust('sira'))).toBe(4);
    await converse('sira', ['Besar', 'Un beso en los labios', 'Despedirme']);
    expect(StoryState.hasFlag('sbx_sira_k_lips')).toBe(true);
    expect(trust('sira')).toBe(10);
  });

  it('con quien es solo amistad no hay coqueteo ni beso: hay bromas y abrazos', async () => {
    const shown = await converse('danilo', ['Despedirme']);
    const labels = shown.find((s) => s.choices)?.choices?.map((c) => c.label) ?? [];
    expect(labels).toContain('Bromear');
    expect(labels).toContain('Dar un abrazo');
    expect(labels).not.toContain('Coquetear');
    expect(labels).not.toContain('Besar');
  });
});

describe('gente de la calle', () => {
  beforeEach(() => beginSandbox(SANDBOX_PLACES[0]));
  const KEY = 'providencia:transeunte_joven:0';

  it('es siempre la misma persona para la misma clave', () => {
    const a = streetSubject(KEY, 'transeunte_joven');
    const b = streetSubject(KEY, 'transeunte_joven');
    expect(a).toEqual(b);
    expect(a.loves.length).toBe(2);
    expect(a.likes.length).toBe(3);
    expect(a.loves.filter((i) => a.likes.includes(i))).toEqual([]);
  });

  it('los niños y los mayores no coquetean', () => {
    for (const sprite of ['nino', 'escolar', 'abuelo', 'transeunte_abuelita', 'senora', 'estudiante']) {
      for (let n = 0; n < 10; n++) expect(streetSubject(`x:${sprite}:${n}`, sprite).romance, sprite).toBe(false);
    }
  });

  it('entre los adultos hay quien se interesa y quien no', () => {
    const rom = Array.from({ length: 40 }, (_, n) => streetSubject(`m:turista:${n}`, 'turista').romance);
    expect(rom.some(Boolean)).toBe(true);
    expect(rom.some((r) => !r)).toBe(true);
  });

  it('se puede charlar, y con algo de confianza pedirle el número', async () => {
    const s = streetSubject(KEY, 'transeunte_joven');
    const shown: DialogueStep[] = [];
    Dialogue.setPresenter({ show: (step) => void shown.push(step), close: () => undefined });
    const run = talkToStranger(KEY, 'transeunte_joven');
    const picks = ['Pedir su número', 'Hacer un cumplido', 'Me gusta tu estilo', 'Hacer un cumplido', 'Qué buena onda eres', 'Pedir su número', 'Despedirme'];
    let guard = 60;
    while ((await settle()) && guard-- > 0) {
      const last = shown[shown.length - 1];
      if (last.choices) {
        const c = last.choices.find((x) => x.label === picks[0]) ?? last.choices[last.choices.length - 1];
        if (c.label === picks[0]) picks.shift();
        Dialogue.choose(c.index);
      } else Dialogue.advance();
    }
    await run;
    expect(sandboxContacts().some((c) => c.name === s.name)).toBe(true);
  });
});

describe('planes y celular', () => {
  beforeEach(() => {
    beginSandbox(placeById('cali')!);
    StoryState.setFlag('sbx_sira_t_agua');
    StoryState.setFlag('sbx_sira_t_cali');
  });

  it('el celular lista al reparto como contactos', () => {
    expect(sandboxContacts().map((c) => c.id)).toEqual(SANDBOX_CAST.map((p) => p.id));
  });

  it('quedar en un sitio por el celular hace que esa persona esté ahí', async () => {
    expect(sandboxNpcs('pance_casa').some((n) => n.id === 'sbx_sira')).toBe(false);
    // sandboxNpcs cambió el sitio actual a pance_casa: volvemos a Cali para hacer el plan desde allá.
    beginSandbox(placeById('cali')!);
    StoryState.setFlag('sbx_sira_t_agua');
    StoryState.setFlag('sbx_sira_t_cali');
    const shown: DialogueStep[] = [];
    Dialogue.setPresenter({ show: (step) => void shown.push(step), close: () => undefined });
    const run = phoneContact('sira');
    const picks = ['Llamar', 'Hacer un plan', 'Pance', 'Casa de doña Mery', 'Voy después', 'Colgar'];
    let guard = 60;
    while ((await settle()) && guard-- > 0) {
      const last = shown[shown.length - 1];
      if (last.choices) {
        const want = picks[0];
        const c = last.choices.find((x) => x.label === want) ?? last.choices.find((x) => x.label === 'Más...');
        if (c?.label === want) picks.shift();
        Dialogue.choose((c as { index: number }).index);
      } else Dialogue.advance();
    }
    await run;
    expect(picks).toEqual([]);
    expect(sandboxNpcs('pance_casa').some((n) => n.id === 'sbx_sira')).toBe(true);
    expect(currentSandboxPlace()?.id).toBe('pance_casa');
  });

  it('sin confianza no acepta el plan', async () => {
    StoryState.setFlag('sbx_sira_t_agua', false);
    StoryState.setFlag('sbx_sira_t_cali', false);
    const shown = await converse('sira', ['Hacer un plan', 'Despedirme']);
    expect(shown.some((s) => /Hoy no puedo|No tengo espacio|imposible|agenda|Hoy me/.test(s.text))).toBe(true);
  });
});

describe('viajar y aeropuertos', () => {
  it('los halls de salidas vuelan al hall de llegadas del otro país', () => {
    const airports = SANDBOX_PLACES.filter((p) => p.flightTo);
    expect(airports.map((p) => p.id).sort()).toEqual(['clo_salidas', 'scl']);
    for (const a of airports) {
      const dest = placeById(a.flightTo as string);
      expect(dest, a.id).toBeDefined();
      expect(dest?.flightTo, `${a.id}: el destino es un hall de llegadas`).toBeUndefined();
      expect(dest?.country).not.toBe(a.country);
    }
  });

  it('cada aeropuerto tiene su agente de vuelos y los demás sitios no', () => {
    for (const place of SANDBOX_PLACES) {
      beginSandbox(place);
      const desk = sandboxNpcs(place.map).filter((n) => n.dialogue === `sbx:${FLIGHT_DESK}`);
      expect(desk.length, place.id).toBe(place.flightTo ? 1 : 0);
    }
  });

  it('Viajar ofrece primero las ciudades del mismo país y luego sus lugares, y lleva al elegido', async () => {
    beginSandbox(placeById('cali')!);
    const warps: Array<{ map: string; spawn: string }> = [];
    const off = EventSystem.on('warp', (w) => void warps.push(w));
    const shown: DialogueStep[] = [];
    Dialogue.setPresenter({ show: (step) => void shown.push(step), close: () => undefined });
    const run = openTravel();
    const picks = ['Pance', 'Casa de doña Mery'];
    const seen: string[][] = [];
    let guard = 30;
    while ((await settle()) && guard-- > 0) {
      const last = shown[shown.length - 1];
      if (!last.choices) {
        Dialogue.advance();
        continue;
      }
      seen.push(last.choices.map((c) => c.label));
      const want = picks[0];
      const pick = last.choices.find((c) => c.label === want) ?? last.choices.find((c) => c.label === 'Más...');
      if (pick?.label === want) picks.shift();
      Dialogue.choose((pick as { index: number }).index);
    }
    await run;
    off();
    expect(seen[0]).toContain('Cali (aquí)');
    expect(seen[0]).toContain('Salento');
    expect(seen[0].some((l) => l.includes('Santiago') || l.includes('Paine')), 'no debería ofrecer Chile').toBe(false);
    expect(warps).toEqual([{ map: 'pance_casa', spawn: 'puerta' }]);
    expect(currentSandboxPlace()?.id).toBe('pance_casa');
  });

  it('todos los lugares de la historia están en alguna ciudad y ningún mapa se repite', () => {
    const maps = SANDBOX_PLACES.map((p) => p.map);
    expect(new Set(maps).size).toBe(maps.length);
    expect(SANDBOX_PLACES.some((p) => p.map === 'paine')).toBe(true);
    expect(SANDBOX_PLACES.some((p) => p.map === 'pance_rio')).toBe(true);
    for (const p of SANDBOX_PLACES) expect(SANDBOX_CITIES.some((c) => c.id === p.city && c.country === p.country), p.id).toBe(true);
  });

  it('el vuelo del mostrador cambia de país y de sitio', async () => {
    beginSandbox(placeById('scl')!);
    const warps: Array<{ map: string; spawn: string }> = [];
    const off = EventSystem.on('warp', (w) => void warps.push(w));
    const shown: DialogueStep[] = [];
    Dialogue.setPresenter({ show: (s) => void shown.push(s), close: () => undefined });
    const run = talkTo(FLIGHT_DESK);
    let guard = 10;
    while ((await settle()) && guard-- > 0) {
      const last = shown[shown.length - 1];
      if (last.choices) Dialogue.choose(last.choices.find((c) => c.label.endsWith('directo'))!.index);
      else Dialogue.advance();
    }
    await run;
    off();
    expect(warps).toEqual([{ map: 'clo_llegadas', spawn: 'avion' }]);
    expect(currentSandboxPlace()?.id).toBe('clo');
  }, 15_000);
});

/** Habla con el mostrador de vuelos y elige la opción cuyo texto cumple `want`. */
async function atDesk(want: (label: string) => boolean): Promise<void> {
  const shown: DialogueStep[] = [];
  Dialogue.setPresenter({ show: (s) => void shown.push(s), close: () => undefined });
  const run = talkTo(FLIGHT_DESK);
  let guard = 12;
  while ((await settle()) && guard-- > 0) {
    const last = shown[shown.length - 1];
    if (last.choices) Dialogue.choose(last.choices.find((c) => want(c.label))!.index);
    else Dialogue.advance();
  }
  await run;
}

describe('trámites reales del aeropuerto', () => {
  beforeEach(() => beginSandbox(placeById('scl')!));

  it('el sandbox tiene reloj de la historia y corre solo', () => {
    expect(currentMission().clock).toBeDefined();
    expect(StoryState.clockMax).toBeGreaterThan(StoryState.clock + 1440);
  });

  it('elegir "con trámites" deja la maleta y el carnet, el check-in por hacer y el reloj de la noche del vuelo', async () => {
    await atDesk((l) => l.endsWith('con trámites'));
    expect(airportRunActive()).toBe(true);
    expect(StoryState.hasItem('carnet')).toBe(true);
    expect(StoryState.hasItem('maleta')).toBe(true);
    expect(StoryState.hasFlag('maleta_optima')).toBe(true);
    expect(StoryState.hasFlag('checkin')).toBe(false);
    expect(StoryState.hasFlag('despedida')).toBe(true);
    expect(StoryState.objective).toContain('check-in');
    expect(StoryState.clock).toBeLessThan(6 * 1440);
  });

  it('al terminar la aduana se limpian los flags y ítems del viaje y el reloj queda suelto', async () => {
    StoryState.setFlag('sbx_sira_t_agua');
    await atDesk((l) => l.endsWith('con trámites'));
    StoryState.setFlag('migracion_ok');
    StoryState.setFlag('aduana_ok');
    checkAirportRun();
    expect(airportRunActive()).toBe(false);
    // El hall de Cali queda libre (sin controles pendientes) hasta que te vas de ahí.
    expect(StoryState.hasFlag('aduana_ok')).toBe(true);
    expect(StoryState.hasFlag('maleta_optima')).toBe(false);
    expect(StoryState.hasItem('maleta')).toBe(false);
    expect(StoryState.hasFlag('sbx_sira_t_agua'), 'la confianza se queda').toBe(true);
    expect(StoryState.clockMax).toBeGreaterThan(StoryState.clock + 1440);
  });

  it('saltarlos limpia todo y vuela a Cali', async () => {
    const warps: Array<{ map: string; spawn: string }> = [];
    const off = EventSystem.on('warp', (w) => void warps.push(w));
    await atDesk((l) => l.endsWith('con trámites'));
    await skipAirportRun();
    off();
    expect(airportRunActive()).toBe(false);
    expect(StoryState.hasItem('maleta')).toBe(false);
    expect(warps).toEqual([{ map: 'clo_llegadas', spawn: 'avion' }]);
  }, 15_000);

  it('entrar al hall de check-in por cualquier camino deja la maleta, el carnet y los trámites armados', () => {
    expect(airportRunActive()).toBe(false);
    enterSandboxMap('scl_salidas');
    expect(airportRunActive()).toBe(true);
    expect(StoryState.hasItem('maleta')).toBe(true);
    expect(StoryState.hasItem('carnet')).toBe(true);
    expect(StoryState.hasFlag('despedida')).toBe(true);
  });

  it('llegar al hall de Cali sin trámites lo deja libre, y al irse se limpia', () => {
    enterSandboxMap('clo_llegadas');
    expect(StoryState.hasFlag('migracion_ok')).toBe(true);
    expect(StoryState.hasFlag('aduana_ok')).toBe(true);
    expect(StoryState.hasItem('carnet')).toBe(true);
    enterSandboxMap('pucc_campus');
    expect(StoryState.hasFlag('aduana_ok')).toBe(false);
    // Y un viaje con trámites después arranca de cero (no termina de golpe por el aduana_ok anterior).
    enterSandboxMap('scl_salidas');
    expect(airportRunActive()).toBe(true);
    checkAirportRun();
    expect(airportRunActive()).toBe(true);
  });

  it('en Cali los trámites se arman al entrar a las salidas y al abordar la llegada a Santiago también es de verdad', async () => {
    beginSandbox(placeById('clo_salidas')!);
    enterSandboxMap('clo_salidas');
    expect(airportRunActive()).toBe(true);
    expect(StoryState.hasItem('maleta')).toBe(true);
    expect(StoryState.hasItem('carnet')).toBe(true);
    StoryState.setFlag('co_checkin');
    StoryState.addItem('pase');
    StoryState.setFlag('_sbx_board');
    const warps: Array<{ map: string; spawn: string }> = [];
    const off = EventSystem.on('warp', (w) => void warps.push(w));
    checkAirportRun();
    await new Promise((r) => setTimeout(r, 8500));
    off();
    expect(warps).toEqual([{ map: 'scl_llegadas', spawn: 'avion' }]);
    expect(airportRunActive()).toBe(false);
    enterSandboxMap('scl_llegadas');
    expect(airportRunActive()).toBe(true);
    expect(StoryState.hasItem('maleta')).toBe(false);
    expect(StoryState.hasFlag('migracion_ok')).toBe(false);
    StoryState.setFlag('aduana_ok');
    checkAirportRun();
    expect(airportRunActive()).toBe(false);
  }, 20_000);

  it('llegar a Santiago sin trámites deja el hall libre', () => {
    enterSandboxMap('scl_llegadas');
    expect(airportRunActive()).toBe(false);
    expect(StoryState.hasFlag('migracion_ok')).toBe(true);
    expect(StoryState.hasFlag('aduana_ok')).toBe(true);
  });

  it('en Cali solo hay vuelo directo, y los trámites no se ofrecen', async () => {
    beginSandbox(placeById('clo_salidas')!);
    const labels: string[] = [];
    const shown: DialogueStep[] = [];
    Dialogue.setPresenter({ show: (s) => void shown.push(s), close: () => undefined });
    const run = talkTo(FLIGHT_DESK);
    let guard = 6;
    while ((await settle()) && guard-- > 0) {
      const last = shown[shown.length - 1];
      if (last.choices) {
        labels.push(...last.choices.map((c) => c.label));
        Dialogue.choose(last.choices.find((c) => c.label === 'Solo miraba')!.index);
      } else Dialogue.advance();
    }
    await run;
    expect(labels.some((l) => l.includes('trámites'))).toBe(false);
    expect(airportRunActive()).toBe(false);
  });
});

describe('halls de aeropuerto con trámites de verdad (Cali salidas, Santiago llegadas)', () => {
  beforeEach(() => {
    Dialogue.abort();
    beginSandbox(placeById('clo_salidas')!);
  });

  /** Corre un diálogo de los JSON y, si trae opciones, elige la primera cuyo texto empieza por `want`. */
  async function play(id: string, want: string[] = []): Promise<void> {
    await Content.load();
    const shown: DialogueStep[] = [];
    Dialogue.setPresenter({ show: (s) => void shown.push(s), close: () => undefined });
    const run = Dialogue.run(id);
    let guard = 40;
    while ((await settle()) && guard-- > 0) {
      const last = shown[shown.length - 1];
      if (last.choices) {
        const c = last.choices.find((x) => want.some((w) => x.label.startsWith(w))) ?? last.choices[0];
        Dialogue.choose(c.index);
      } else Dialogue.advance();
    }
    await run;
  }

  it('salir de Cali: check-in, migración, seguridad y la puerta, en ese orden', async () => {
    enterSandboxMap('clo_salidas');
    await play('sbxa_migra');
    expect(StoryState.hasFlag('co_migra'), 'sin check-in no pasa migración').toBe(false);
    await play('sbxa_checkin', ['Santiago', 'Pasarle']);
    expect(StoryState.hasFlag('co_checkin')).toBe(true);
    expect(StoryState.hasItem('pase')).toBe(true);
    expect(StoryState.hasItem('maleta')).toBe(false);
    await play('sbxa_seg');
    expect(StoryState.hasFlag('co_seg'), 'sin migración no pasa seguridad').toBe(false);
    await play('sbxa_migra', ['Vuelvo']);
    expect(StoryState.hasFlag('co_migra')).toBe(true);
    await play('sbxa_puerta', ['Abordar']);
    expect(StoryState.hasFlag('_sbx_board'), 'sin seguridad no abordas').toBe(false);
    await play('sbxa_seg');
    expect(StoryState.hasFlag('co_seg')).toBe(true);
    await play('sbxa_puerta', ['Abordar']);
    expect(StoryState.hasFlag('_sbx_board')).toBe(true);
  });

  it('llegar a Santiago: PDI, cinta y SAG terminan los trámites', async () => {
    beginSandbox(placeById('scl_llegadas')!);
    // Con trámites de verdad (después de abordar en Cali)
    StoryState.setFlag('co_checkin');
    enterSandboxMap('clo_salidas');
    StoryState.setFlag('_sbx_board');
    checkAirportRun();
    await new Promise((r) => setTimeout(r, 8500));
    enterSandboxMap('scl_llegadas');
    expect(airportRunActive()).toBe(true);
    await play('sbxa_sag');
    expect(StoryState.hasFlag('aduana_ok'), 'sin equipaje no pasa el SAG').toBe(false);
    await play('sbxa_pdi', ['Unos meses']);
    expect(StoryState.hasFlag('migracion_ok')).toBe(true);
    StoryState.addItem('maleta');
    StoryState.setFlag('maleta_recogida');
    await play('sbxa_sag');
    expect(StoryState.hasFlag('aduana_ok')).toBe(true);
    checkAirportRun();
    expect(airportRunActive()).toBe(false);
  }, 25_000);
});

describe('transporte jugable en el sandbox', () => {
  it('la estación Universidades (T31) abre su taquilla, recarga, torniquetes y puertas en el modo libre', () => {
    beginSandbox(placeById('universidades')!);
    const station = allNpcs().filter((n) => n.map === 'universidades' && /^m6_(taquilla|rec|tablero|torniquete_|puerta_)/.test(n.id));
    expect(station.length).toBeGreaterThanOrEqual(12);
    for (const n of station) expect(check(n.if), n.id).toBe(true);
    // y fuera del sandbox solo en la misión 6
    StoryState.newGame('mission02');
    for (const n of station) expect(check(n.if), `${n.id} en la misión 2`).toBe(false);
  });

  it('el metro de Santiago no depende de la misión', () => {
    beginSandbox(placeById('baquedano')!);
    const station = allNpcs().filter((n) => n.map === 'metro_baquedano');
    expect(station.length).toBeGreaterThan(0);
    for (const n of station) expect(check(n.if), n.id).toBe(true);
  });
});
