import { describe, expect, it } from 'vitest';
import { formatPlayTime, shareText, type ShareStats } from '../src/systems/ShareCard';

const stats: ShareStats = { name: 'Ana', score: 42, total: 120, missions: 3, missionTotal: 10, rank: 7, hours: '2 h', mission: null, finale: false };

describe('ShareCard', () => {
  it('formatea el tiempo de juego', () => {
    expect(formatPlayTime(0)).toBe('0 min');
    expect(formatPlayTime(45 * 60_000)).toBe('45 min');
    expect(formatPlayTime(60 * 60_000)).toBe('1 h');
    expect(formatPlayTime(200 * 60_000)).toBe('3 h 20 min');
  });

  it('el texto trae las cifras y el puesto solo si lo hay', () => {
    expect(shareText(stats)).toContain('42/120');
    expect(shareText(stats)).toContain('#7');
    expect(shareText({ ...stats, rank: null })).not.toContain('puesto');
  });

  it('con una misión recién completada la nombra', () => {
    expect(shareText({ ...stats, mission: 'La prueba' })).toContain('«La prueba»');
  });

  it('en el final celebra que terminó el juego y trae el puesto solo si lo hay', () => {
    const t = shareText({ ...stats, finale: true });
    expect(t).toContain('Terminé');
    expect(t).toContain('3 de 10 misiones');
    expect(t).toContain('#7');
    expect(shareText({ ...stats, finale: true, rank: null })).not.toContain('puesto');
  });
});
