import { beforeEach, describe, expect, it } from 'vitest';
import { Dialogue, type DialogueStep } from '../src/systems/DialogueManager';
import { SANDBOX_BAG, SANDBOX_CAST, SANDBOX_CITIES, SANDBOX_PLACES } from '../src/data/sandboxCast';
import spritesData from '../src/data/sprites.json';
import { GameMap } from '../src/systems/GameMap';
import { currentMission, MISSIONS, SANDBOX_ID } from '../src/systems/Mission';
import { EventSystem } from '../src/systems/EventSystem';
import { airportRunActive, checkAirportRun, skipAirportRun, talkTo, openTravel, FLIGHT_DESK, currentSandboxPlace, placeById, band, beginSandbox, buildTree, giftTier, hearts, isSandbox, sandboxNpcs, trust } from '../src/systems/Sandbox';
import { ITEMS, StoryState } from '../src/systems/StoryState';
import { check } from '../src/systems/Conditions';

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

  it('los árboles de diálogo no tienen saltos a nodos que no existen', () => {
    for (const p of SANDBOX_CAST) {
      const tree = buildTree(p);
      expect(tree.nodes[tree.start]).toBeDefined();
      for (const [id, node] of Object.entries(tree.nodes)) {
        const targets = [node.next, ...(node.branches ?? []).map((b) => b.goto), ...(node.choices ?? []).map((c) => c.goto)];
        for (const t of targets) if (t) expect(tree.nodes[t], `${p.id}/${id} → ${t}`).toBeDefined();
      }
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
  while (Dialogue.active && guard-- > 0) {
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
  beforeEach(() => beginSandbox(SANDBOX_PLACES[0]));

  it('un tema suma confianza la primera vez y no la segunda', async () => {
    const topic = SANDBOX_CAST[0].topics[0].label;
    await converse('sira', ['Hablar de...', topic, 'Volver', 'Despedirme']);
    expect(trust('sira')).toBe(1);
    const again = await converse('sira', ['Hablar de...', topic, 'Volver', 'Despedirme']);
    expect(trust('sira')).toBe(1);
    expect(again.some((s) => s.text.includes('Ya hablamos'))).toBe(true);
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
});

describe('viajar y aeropuertos', () => {
  it('los aeropuertos se apuntan entre sí, uno por país', () => {
    const airports = SANDBOX_PLACES.filter((p) => p.flightTo);
    expect(airports.map((p) => p.id).sort()).toEqual(['clo', 'scl']);
    for (const a of airports) {
      const dest = placeById(a.flightTo as string);
      expect(dest?.flightTo, `${a.id}: el destino no vuelve`).toBe(a.id);
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
    while (Dialogue.active && guard-- > 0) {
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
    while (Dialogue.active && guard-- > 0) {
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
  while (Dialogue.active && guard-- > 0) {
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
    expect(StoryState.hasFlag('aduana_ok')).toBe(false);
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

  it('en Cali solo hay vuelo directo, y los trámites no se ofrecen', async () => {
    beginSandbox(placeById('clo')!);
    const labels: string[] = [];
    const shown: DialogueStep[] = [];
    Dialogue.setPresenter({ show: (s) => void shown.push(s), close: () => undefined });
    const run = talkTo(FLIGHT_DESK);
    let guard = 6;
    while (Dialogue.active && guard-- > 0) {
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
