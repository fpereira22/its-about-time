import { describe, expect, it } from 'vitest';
import { SFX } from '../src/audio/sfxDefs';
import { applyGain, levelUpInfo, SKILLS, SkillStats, STAT_MAX } from '../src/systems/SkillStats';

describe('applyGain', () => {
  it('sube entero desde cero y cada vez menos mientras más alto vas', () => {
    expect(applyGain(0, 20)).toBe(20);
    expect(applyGain(70, 20) - 70).toBeLessThan(20);
    expect(applyGain(70, 20)).toBeGreaterThan(70);
  });

  it('nunca pasa del tope ni baja', () => {
    expect(applyGain(99, 50)).toBe(STAT_MAX);
    expect(applyGain(STAT_MAX, 50)).toBe(STAT_MAX);
    expect(applyGain(40, 0)).toBe(40);
  });
});

describe('SkillStats.record', () => {
  it('solo anota los minijuegos que se repiten', () => {
    expect(SkillStats.record('Pool', 'mission08', { won: true })).toBeNull();
    expect(SKILLS.map((s) => s.scene).sort()).toEqual(['Futbol', 'Natacion', 'Pinpon', 'Salsa']);
  });

  it('un buen partido sube las stats, los contadores y guarda la mejor partida de la misión', () => {
    const before = structuredClone(SkillStats.get('futbol'));
    const gain = SkillStats.record('Futbol', 'mission04', { us: 3, them: 1, myGoals: 2, ownGoals: 0 });
    expect(gain?.ups.map((u) => u.name)).toEqual(['Definición', 'Visión de juego', 'Garra']);
    const after = SkillStats.get('futbol');
    expect(after.plays).toBe(before.plays + 1);
    expect(after.counters.goles).toBe((before.counters.goles ?? 0) + 2);
    expect(after.stats.definicion).toBeGreaterThan(before.stats.definicion ?? 0);
    expect(after.missions.mission04.line).toBe('3-1 · 2 goles tuyos');

    // Una partida peor en la misma misión no reemplaza el mejor resultado.
    SkillStats.record('Futbol', 'mission04', { us: 0, them: 4, myGoals: 0, ownGoals: 1 });
    expect(SkillStats.get('futbol').missions.mission04.line).toBe('3-1 · 2 goles tuyos');
    expect(JSON.parse(window.localStorage.getItem('santiago-laberinto:skills') ?? '{}').futbol.plays).toBe(before.plays + 2);
  });

  it('levelUpInfo arma la pantalla de nivel con el rango y las barras antes/después', () => {
    const def = SKILLS[0];
    const info = levelUpInfo({
      skill: def,
      ups: [],
      rows: def.stats.map((st) => ({ name: st.name, before: 10, after: 25 })),
      levelBefore: 2,
      levelAfter: 3,
    });
    expect(info).toMatchObject({ skillId: def.id, name: def.name, color: def.color, level: 3, rank: def.ranks[2] });
    expect(info.rows).toHaveLength(def.stats.length);
  });

  it('cada minijuego tiene un rango por nivel y un sonido de subida de nivel', () => {
    for (const def of SKILLS) {
      expect(def.ranks, def.id).toHaveLength(10);
      expect(`nivel_${def.id}` in SFX, def.id).toBe(true);
    }
  });

  it('cada definición entrega un valor para todas sus stats', () => {
    const samples: Record<string, unknown> = {
      Futbol: { us: 1, them: 1, myGoals: 1, ownGoals: 0 },
      Natacion: { lessons: 5, perfect: true, wonRace: true, held: true },
      Salsa: { score: 4, total: 4, perfect: true, hits: 30, notes: 32 },
      Pinpon: { wins: 3, champion: true, beatRichi: true, smashes: 6 },
    };
    for (const def of SKILLS) {
      const play = def.play(samples[def.scene]);
      for (const st of def.stats) expect(play?.stats[st.id], `${def.id}.${st.id}`).toBeGreaterThan(0);
    }
  });
});
