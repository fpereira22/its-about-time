import { describe, expect, it } from 'vitest';
import { codeToKey, hashText, keyToCode, packText, partAction, parseUserAgent, trafficSource, unpackText } from '../src/systems/cloudCodec';

describe('código de jugador', () => {
  const key = '0f1e2d3c4b5a69788796a5b4c3d2e1f0';

  it('va y vuelve, en 26 letras agrupadas', () => {
    const code = keyToCode(key);
    expect(code).toMatch(/^[0-9A-Z]{5}-[0-9A-Z]{5}-[0-9A-Z]{5}-[0-9A-Z]{5}-[0-9A-Z]{6}$/);
    expect(codeToKey(code)).toBe(key);
  });

  it('funciona con cualquier llave', () => {
    for (const k of ['0'.repeat(32), 'f'.repeat(32), '0123456789abcdef0123456789abcdef']) expect(codeToKey(keyToCode(k))).toBe(k);
  });

  it('perdona minúsculas, espacios, guiones y letras que se confunden', () => {
    const code = keyToCode('1'.repeat(32));
    const messy = ` ${code.toLowerCase().replace(/-/g, ' ').replace(/1/g, 'l').replace(/0/g, 'o')} `;
    expect(codeToKey(messy)).toBe('1'.repeat(32));
  });

  it('rechaza lo que no es un código', () => {
    expect(codeToKey('')).toBeNull();
    expect(codeToKey('ABCDE-FGHJK')).toBeNull();
    expect(codeToKey('U'.repeat(26))).toBeNull(); // la U no existe en el alfabeto
    expect(codeToKey('Z'.repeat(26))).toBeNull(); // más de 128 bits
  });
});

describe('partAction', () => {
  it('iguales: nada', () => expect(partAction('a', 'a', 'x', false)).toBe('same'));
  it('acá no cambió y en la nube sí: bajar', () => expect(partAction('a', 'b', 'a', false)).toBe('pull'));
  it('acá vacío (dispositivo nuevo): bajar', () => expect(partAction('e', 'b', undefined, true)).toBe('pull'));
  it('acá cambió: subir, aunque la nube también haya cambiado', () => {
    expect(partAction('c', 'a', 'a', false)).toBe('push');
    expect(partAction('c', 'b', 'a', false)).toBe('push');
  });
  it('la nube no la tiene: subir', () => expect(partAction('a', undefined, undefined, false)).toBe('push'));
});

describe('hashText / packText', () => {
  it('hash estable de 8 hex que cambia con el texto', () => {
    expect(hashText('hola')).toMatch(/^[0-9a-f]{8}$/);
    expect(hashText('hola')).toBe(hashText('hola'));
    expect(hashText('hola')).not.toBe(hashText('holA'));
  });

  it('comprime y descomprime (y achica el progreso repetitivo)', async () => {
    const text = JSON.stringify({ flags: Array.from({ length: 400 }, (_, i) => `m10_flag_numero_${i}`) });
    const packed = await packText(text);
    expect(packed.startsWith('gz1:') || packed.startsWith('raw:')).toBe(true);
    if (packed.startsWith('gz1:')) expect(packed.length).toBeLessThan(text.length / 3);
    expect(await unpackText(packed)).toBe(text);
  });

  it('lee el formato sin comprimir', async () => {
    expect(await unpackText('raw:{"a":1}')).toBe('{"a":1}');
    await expect(unpackText('xyz')).rejects.toThrow();
  });
});

describe('parseUserAgent', () => {
  it('celular Android con Chrome', () => {
    const ua = 'Mozilla/5.0 (Linux; Android 14; SM-A146M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
    expect(parseUserAgent(ua)).toEqual({ kind: 'movil', os: 'Android', browser: 'Chrome' });
  });
  it('iPhone con Safari', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
    expect(parseUserAgent(ua)).toEqual({ kind: 'movil', os: 'iOS', browser: 'Safari' });
  });
  it('iPad que se presenta como Mac', () => {
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
    expect(parseUserAgent(ua, 5)).toEqual({ kind: 'tablet', os: 'iOS', browser: 'Safari' });
    expect(parseUserAgent(ua, 0)).toEqual({ kind: 'escritorio', os: 'macOS', browser: 'Safari' });
  });
  it('Windows con Edge', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0';
    expect(parseUserAgent(ua)).toEqual({ kind: 'escritorio', os: 'Windows', browser: 'Edge' });
  });
});

describe('trafficSource', () => {
  it('?ref= o ?utm_source= mandan', () => {
    expect(trafficSource('?ref=Instagram', 'https://google.com/', 'juego.cl')).toBe('instagram');
    expect(trafficSource('?utm_source=tiktok', '', 'juego.cl')).toBe('tiktok');
  });
  it('si no, el dominio que lo mandó (sin www)', () => {
    expect(trafficSource('', 'https://www.google.com/search?q=x', 'juego.cl')).toBe('google.com');
  });
  it('desde el mismo sitio o sin referrer: directo', () => {
    expect(trafficSource('', 'https://juego.cl/otra', 'juego.cl')).toBe('directo');
    expect(trafficSource('', '', 'juego.cl')).toBe('directo');
  });
});
