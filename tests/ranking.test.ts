import { describe, expect, it } from 'vitest';
import {
  averageRating,
  checkName,
  latestComments,
  parseComments,
  parseCsv,
  parsePlayers,
  starsText,
  topPlayers,
  type PlayerRow,
} from '../src/systems/Ranking';

describe('parseCsv', () => {
  it('respeta comillas, comillas escapadas, comas y saltos de línea dentro de una celda', () => {
    const csv = 'a,b,c\r\n1,"hola, ""mundo""","línea 1\nlínea 2"\r\n';
    expect(parseCsv(csv)).toEqual([
      ['a', 'b', 'c'],
      ['1', 'hola, "mundo"', 'línea 1\nlínea 2'],
    ]);
  });

  it('una hoja vacía no da filas', () => {
    expect(parseCsv('')).toEqual([]);
    expect(parseCsv('\r\n,,\r\n')).toEqual([]);
  });
});

describe('parsePlayers / parseComments', () => {
  it('lee por nombre de columna, en cualquier orden, y quita el escape de fórmulas', () => {
    const csv = 'nombre,id,total,puntaje,misiones,actualizado\n"\'=Pepe",abc,120,34,3,2026-11-13T10:00:00Z\n,sinNombre,1,1,1,x';
    expect(parsePlayers(csv)).toEqual([
      { id: 'abc', name: '=Pepe', score: 34, missions: 3, total: 120, updated: '2026-11-13T10:00:00Z' },
    ]);
  });

  it('descarta votos sin estrellas y recorta a 5', () => {
    const csv = 'fecha,id,nombre,estrellas,comentario\nf1,a,Ana,9,wow\nf2,b,Beto,0,nada';
    expect(parseComments(csv)).toEqual([{ date: 'f1', id: 'a', name: 'Ana', stars: 5, comment: 'wow' }]);
  });

  it('con solo el encabezado (o nada) no hay filas', () => {
    expect(parsePlayers('id,nombre,puntaje')).toEqual([]);
    expect(parseComments('')).toEqual([]);
  });
});

describe('topPlayers', () => {
  const p = (id: string, score: number, missions: number, updated: string): PlayerRow => ({
    id,
    name: id,
    score,
    missions,
    total: 100,
    updated,
  });

  it('ordena por puntaje, después misiones, después quien llegó antes; y corta en 10', () => {
    const players = [
      p('tarde', 50, 3, '2026-11-13T12:00'),
      p('temprano', 50, 3, '2026-11-13T09:00'),
      p('masMisiones', 50, 4, '2026-11-13T15:00'),
      p('lider', 80, 1, '2026-11-13T20:00'),
      ...Array.from({ length: 10 }, (_, i) => p(`relleno${i}`, i, 0, '2026')),
    ];
    const top = topPlayers(players);
    expect(top).toHaveLength(10);
    expect(top.slice(0, 4).map((x) => x.id)).toEqual(['lider', 'masMisiones', 'temprano', 'tarde']);
  });
});

describe('averageRating / latestComments', () => {
  const comments = [
    { date: '2026-11-01T00:00:00Z', id: 'a', name: 'Ana', stars: 1, comment: 'primero' },
    { date: '2026-11-05T00:00:00Z', id: 'a', name: 'Ana', stars: 5, comment: '' },
    { date: '2026-11-03T00:00:00Z', id: 'b', name: 'Beto', stars: 4, comment: 'bueno' },
  ];

  it('cuenta solo el último voto de cada jugador', () => {
    expect(averageRating(comments)).toEqual({ avg: 4.5, votes: 2 });
    expect(averageRating([])).toEqual({ avg: 0, votes: 0 });
  });

  it('comentarios con texto, del más nuevo al más viejo', () => {
    expect(latestComments(comments).map((c) => c.comment)).toEqual(['bueno', 'primero']);
  });
});

describe('checkName', () => {
  it('acepta acentos y colapsa espacios', () => {
    expect(checkName('  José   Ñandú ')).toEqual({ name: 'José Ñandú' });
  });

  it('rechaza nombres muy cortos, muy largos o con símbolos', () => {
    expect(checkName('a')).toHaveProperty('error');
    expect(checkName('x'.repeat(17))).toHaveProperty('error');
    expect(checkName('=HYPERLINK()')).toHaveProperty('error');
  });
});

describe('starsText', () => {
  it('redondea y llena con estrellas vacías', () => {
    expect(starsText(4.4)).toBe('★★★★☆');
    expect(starsText(9)).toBe('★★★★★');
  });
});
