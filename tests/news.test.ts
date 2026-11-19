import { beforeEach, describe, expect, it } from 'vitest';
import { CHANGELOG, NEWS_MAX_ITEM_CHARS, NEWS_MAX_ITEMS, type NewsEntry } from '../src/data/changelog';
import { buildNews, News, unseenEntries } from '../src/systems/News';
import { STORAGE_KEYS } from '../src/systems/storageKeys';

const entry = (id: string, ...items: string[]): NewsEntry => ({ id, date: '2026-01-01', items });
const LIST = [entry('c', 'c1', 'c2'), entry('b', 'b1'), entry('a', 'a1')];

beforeEach(() => News.reset());

describe('unseenEntries', () => {
  it('sin registro, o con uno que ya no existe, solo cuenta la última', () => {
    expect(unseenEntries(LIST, null).map((e) => e.id)).toEqual(['c']);
    expect(unseenEntries(LIST, 'zzz').map((e) => e.id)).toEqual(['c']);
  });

  it('entrega lo posterior a lo último visto, de nuevo a viejo', () => {
    expect(unseenEntries(LIST, 'a').map((e) => e.id)).toEqual(['c', 'b']);
    expect(unseenEntries(LIST, 'b').map((e) => e.id)).toEqual(['c']);
  });

  it('al día: nada', () => {
    expect(unseenEntries(LIST, 'c')).toEqual([]);
    expect(unseenEntries([], null)).toEqual([]);
  });
});

describe('buildNews', () => {
  it('junta las líneas de lo pendiente con la fecha de lo más nuevo, hasta el tope', () => {
    const view = buildNews(LIST, 'a');
    expect(view?.id).toBe('c');
    expect(view?.items).toEqual(['c1', 'c2', 'b1']);
    const many = [entry('y', '1', '2', '3'), entry('x', '4', '5', '6')];
    expect(buildNews(many, null)?.items).toHaveLength(3);
    expect(buildNews([entry('z', '1', '2', '3', '4', '5', '6')], null)?.items).toHaveLength(NEWS_MAX_ITEMS);
  });

  it('al día: null', () => {
    expect(buildNews(LIST, 'c')).toBeNull();
  });
});

describe('News.take', () => {
  it('a quien juega por primera vez no le muestra nada, pero lo deja al día', () => {
    expect(News.take(false, LIST)).toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEYS.news)).toBe('c');
    // Y cuando salga una actualización, esa persona sí la ve.
    expect(News.take(true, [entry('d', 'd1'), ...LIST])?.id).toBe('d');
  });

  it('a quien ya tenía progreso le muestra la última, una sola vez', () => {
    expect(News.take(true, LIST)?.id).toBe('c');
    expect(window.localStorage.getItem(STORAGE_KEYS.news)).toBe('c');
    expect(News.take(true, LIST)).toBeNull();
  });

  it('preview (admin) la muestra aunque ya esté vista, sin registrar nada y solo una vez', () => {
    News.take(true, LIST);
    News.preview();
    expect(News.take(true, LIST)?.id).toBe('c');
    expect(News.take(true, LIST)).toBeNull();
    window.localStorage.clear();
    News.reset();
    News.preview();
    expect(News.take(false, LIST)?.id).toBe('c');
    expect(window.localStorage.getItem(STORAGE_KEYS.news)).toBeNull();
  });

  it('no se repite entre sesiones', () => {
    News.take(true, LIST);
    News.reset();
    expect(News.take(true, LIST)).toBeNull();
  });

  it('sin almacenamiento tampoco se repite dentro de la sesión', () => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('sin espacio');
    };
    try {
      expect(News.take(true, LIST)?.id).toBe('c');
      expect(News.take(true, LIST)).toBeNull();
    } finally {
      Storage.prototype.setItem = orig;
    }
  });
});

describe('CHANGELOG', () => {
  it('ids únicos, fechas válidas y de nuevo a viejo', () => {
    expect(new Set(CHANGELOG.map((e) => e.id)).size).toBe(CHANGELOG.length);
    for (const e of CHANGELOG) expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const dates = CHANGELOG.map((e) => e.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it('líneas cortas y pocas, para que la tarjeta quepa', () => {
    for (const e of CHANGELOG) {
      expect(e.items.length, e.id).toBeGreaterThan(0);
      expect(e.items.length, e.id).toBeLessThanOrEqual(NEWS_MAX_ITEMS);
      for (const item of e.items) expect(item.length, item).toBeLessThanOrEqual(NEWS_MAX_ITEM_CHARS);
    }
  });
});
