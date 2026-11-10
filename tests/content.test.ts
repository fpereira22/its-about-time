/**
 * Integridad del contenido: que todo lo que un diálogo, mapa, NPC, ítem o misión nombra exista.
 * Son los errores que antes solo aparecían en la consola al jugar justo esa parte (un nodo con
 * un typo, un warp a un spawn que se renombró, una viñeta que no se sumó al registro...).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { SFX } from '../src/audio/sfxDefs';
import { allNpcs } from '../src/scenes/MapScene';
import { Content } from '../src/systems/Content';
import { dialogueIds, dialogueTree } from '../src/systems/DialogueManager';
import { GameMap } from '../src/systems/GameMap';
import { MISSIONS } from '../src/systems/Mission';
import { PHONE } from '../src/systems/Phone';
import { ITEMS } from '../src/systems/StoryState';
import type { Effect } from '../src/types/story';
import { vinetaIds } from '../src/ui/Vineta';

beforeAll(async () => {
  await Content.load();
});

/** Lista de problemas encontrados: el test falla mostrando todos juntos. */
function problems(collect: (report: (msg: string) => void) => void): string[] {
  const out: string[] = [];
  collect((msg) => out.push(msg));
  return out;
}

function hasSpawn(map: string, spawn: string): boolean {
  return GameMap.ids().includes(map) && spawn in GameMap.get(map).data.spawns;
}

/** Todos los efectos de un diálogo (de sus nodos y de sus opciones). */
function dialogueEffects(id: string): Array<{ where: string; effect: Effect }> {
  const tree = dialogueTree(id);
  if (!tree) return [];
  return Object.entries(tree.nodes).flatMap(([nodeId, node]) => [
    ...(node.effects ?? []).map((effect) => ({ where: `${id}/${nodeId}`, effect })),
    ...(node.choices ?? []).flatMap((c) => (c.effects ?? []).map((effect) => ({ where: `${id}/${nodeId} [${c.label}]`, effect }))),
  ]);
}

describe('diálogos', () => {
  it('se cargaron', () => {
    expect(dialogueIds().length).toBeGreaterThan(100);
  });

  it('cada salto (start, next, goto, branches) apunta a un nodo del mismo diálogo', () => {
    const found = problems((report) => {
      for (const id of dialogueIds()) {
        const tree = dialogueTree(id);
        if (!tree) continue;
        const has = (node: string): boolean => node in tree.nodes;
        if (!has(tree.start)) report(`${id}: el nodo inicial "${tree.start}" no existe`);
        for (const [nodeId, node] of Object.entries(tree.nodes)) {
          if (node.next && !has(node.next)) report(`${id}/${nodeId}: next → "${node.next}" no existe`);
          for (const c of node.choices ?? []) if (c.goto && !has(c.goto)) report(`${id}/${nodeId}: opción "${c.label}" → "${c.goto}" no existe`);
          for (const b of node.branches ?? []) if (!has(b.goto)) report(`${id}/${nodeId}: branch → "${b.goto}" no existe`);
        }
      }
    });
    expect(found).toEqual([]);
  });

  it('los efectos nombran viñetas, ítems, mapas, mensajes, llamadas y sonidos que existen', () => {
    const vinetas = new Set(vinetaIds());
    const found = problems((report) => {
      for (const id of dialogueIds()) {
        for (const { where, effect: e } of dialogueEffects(id)) {
          if ('vineta' in e && e.vineta && !vinetas.has(e.vineta)) report(`${where}: viñeta "${e.vineta}" no existe`);
          if ('giveItem' in e && !ITEMS[e.giveItem]) report(`${where}: ítem "${e.giveItem}" no existe`);
          if ('takeItem' in e && !ITEMS[e.takeItem]) report(`${where}: ítem "${e.takeItem}" no existe`);
          if ('warp' in e && !hasSpawn(e.warp.map, e.warp.spawn)) report(`${where}: warp a ${e.warp.map}/${e.warp.spawn} no existe`);
          if ('message' in e && !PHONE.messages[e.message]) report(`${where}: mensaje "${e.message}" no existe en phone.json`);
          if ('call' in e && !PHONE.calls[e.call]) report(`${where}: llamada "${e.call}" no existe en phone.json`);
          if ('sfx' in e && !(e.sfx in SFX)) report(`${where}: sonido "${e.sfx}" no existe`);
        }
      }
    });
    expect(found).toEqual([]);
  });
});

describe('mapas', () => {
  it('los warps llevan a mapas y spawns que existen, y sus diálogos existen', () => {
    const found = problems((report) => {
      for (const id of GameMap.ids()) {
        const data = GameMap.get(id).data;
        for (const w of data.warps ?? []) {
          if (!hasSpawn(w.to, w.spawn)) report(`${id}: warp en (${w.x},${w.y}) → ${w.to}/${w.spawn} no existe`);
          if (w.blockedDialogue && !dialogueTree(w.blockedDialogue)) report(`${id}: warp en (${w.x},${w.y}) usa el diálogo "${w.blockedDialogue}"`);
        }
        for (const e of data.enter ?? []) if (!dialogueTree(e.dialogue)) report(`${id}: enter "${e.id}" usa el diálogo "${e.dialogue}"`);
        for (const f of data.fauna ?? []) if (!dialogueTree(f.dialogue)) report(`${id}: fauna "${f.sprite}" usa el diálogo "${f.dialogue}"`);
      }
    });
    expect(found).toEqual([]);
  });

  it('las filas del mapa tienen el ancho y alto declarados y solo usan tiles de la leyenda', () => {
    const found = problems((report) => {
      for (const id of GameMap.ids()) {
        const d = GameMap.get(id).data;
        if (d.rows.length !== d.height) report(`${id}: ${d.rows.length} filas, declara height ${d.height}`);
        d.rows.forEach((row, y) => {
          const cells = Array.from(row);
          if (cells.length !== d.width) report(`${id}: la fila ${y} mide ${cells.length}, declara width ${d.width}`);
          const unknown = [...new Set(cells.filter((c) => !(c in d.legend)))];
          if (unknown.length) report(`${id}: la fila ${y} usa "${unknown.join('')}" que no está en la leyenda`);
        });
        for (const [name, s] of Object.entries(d.spawns)) {
          if (!GameMap.get(id).inBounds(s.x, s.y)) report(`${id}: el spawn "${name}" queda fuera del mapa`);
        }
      }
    });
    expect(found).toEqual([]);
  });
});

describe('NPCs, ítems y misiones', () => {
  it('cada NPC está en un mapa que existe y usa un diálogo que existe', () => {
    const found = problems((report) => {
      for (const npc of allNpcs()) {
        if (!GameMap.ids().includes(npc.map)) report(`NPC "${npc.id}": el mapa "${npc.map}" no existe`);
        if (!dialogueTree(npc.dialogue)) report(`NPC "${npc.id}": el diálogo "${npc.dialogue}" no existe`);
      }
    });
    expect(found).toEqual([]);
  });

  it('los ítems que se pueden usar abren un diálogo que existe', () => {
    const found = problems((report) => {
      for (const [id, item] of Object.entries(ITEMS)) {
        if (item.use && !dialogueTree(item.use)) report(`Ítem "${id}": el diálogo "${item.use}" no existe`);
      }
    });
    expect(found).toEqual([]);
  });

  it('cada misión parte en un spawn que existe, con su diálogo y coleccionables', () => {
    const found = problems((report) => {
      for (const m of MISSIONS) {
        if (!hasSpawn(m.start.map, m.start.spawn)) report(`${m.id}: el inicio ${m.start.map}/${m.start.spawn} no existe`);
        if (m.introDialogue && !dialogueTree(m.introDialogue)) report(`${m.id}: el diálogo de inicio "${m.introDialogue}" no existe`);
        for (const c of m.collectibles) if (!ITEMS[c]) report(`${m.id}: el coleccionable "${c}" no existe en items.json`);
      }
    });
    expect(found).toEqual([]);
  });

  it('los ids de misión son únicos y los números van seguidos', () => {
    const ids = MISSIONS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(MISSIONS.map((m) => m.number)).toEqual(MISSIONS.map((_, i) => i + 1));
  });
});
