/**
 * Funciones puras del respaldo en la nube y de los datos de uso (con tests): el código de jugador,
 * el hash de cada parte, la compresión y la lectura del navegador/dispositivo.
 */

// ---------------------------------------------------------------- código de jugador

/** Base32 de Crockford: sin I, L, O ni U (no se confunden al copiarlo a mano). */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
/** 128 bits de la llave + 2 bits en cero al comienzo = 26 letras de 5 bits. */
const CODE_LENGTH = 26;
const GROUPS = [5, 5, 5, 5, 6];

/** Llave secreta (32 hex) → código de jugador "XXXXX-XXXXX-XXXXX-XXXXX-XXXXXX". */
export function keyToCode(key: string): string {
  if (!/^[0-9a-f]{32}$/.test(key)) throw new Error('llave inválida');
  let bits = '00';
  for (const ch of key) bits += parseInt(ch, 16).toString(2).padStart(4, '0');
  let code = '';
  for (let i = 0; i < bits.length; i += 5) code += ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  let out = '';
  let at = 0;
  for (const g of GROUPS) {
    out += (out ? '-' : '') + code.slice(at, at + g);
    at += g;
  }
  return out;
}

/**
 * Lo que escribió el jugador → llave (32 hex), o null si no es un código. Acepta minúsculas,
 * espacios y guiones donde sea, y las letras que se confunden (I/L → 1, O → 0).
 */
export function codeToKey(raw: string): string | null {
  const code = raw
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/[IL]/g, '1')
    .replace(/O/g, '0');
  if (code.length !== CODE_LENGTH) return null;
  let bits = '';
  for (const ch of code) {
    const v = ALPHABET.indexOf(ch);
    if (v < 0) return null;
    bits += v.toString(2).padStart(5, '0');
  }
  if (!bits.startsWith('00')) return null;
  bits = bits.slice(2);
  let key = '';
  for (let i = 0; i < bits.length; i += 4) key += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return key;
}

// ---------------------------------------------------------------- partes

/** FNV-1a de 32 bits en hex: barato, solo para saber si una parte cambió. */
export function hashText(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export type Hashes = Record<string, string>;

export type PartAction = 'pull' | 'push' | 'same';

/**
 * Qué hacer con una parte, comparando lo de este navegador, lo de la nube y lo último que se
 * sincronizó desde acá:
 * - iguales → nada;
 * - acá no cambió desde la última vez (o está vacío) y en la nube sí → bajarla (otro dispositivo jugó);
 * - si no → subirla (acá manda: también cuando cambió en ambos lados).
 */
export function partAction(local: string, remote: string | undefined, synced: string | undefined, localEmpty: boolean): PartAction {
  if (remote === local) return 'same';
  if (remote !== undefined && (local === synced || localEmpty)) return 'pull';
  return 'push';
}

/** Mayor que esto no entra en una celda de Google Sheets (el límite es 50.000). */
export const MAX_CELL = 48_000;

/** Texto → "gz1:<base64 del gzip>" (o "raw:<texto>" si el navegador no sabe comprimir). */
export async function packText(text: string): Promise<string> {
  if (typeof CompressionStream === 'undefined') return 'raw:' + text;
  const stream = (new Response(text).body as ReadableStream<BufferSource>).pipeThrough(new CompressionStream('gzip'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return 'gz1:' + btoa(bin);
}

/** Lo inverso de packText. */
export async function unpackText(packed: string): Promise<string> {
  if (packed.startsWith('raw:')) return packed.slice(4);
  if (!packed.startsWith('gz1:')) throw new Error('formato desconocido');
  if (typeof DecompressionStream === 'undefined') throw new Error('este navegador no puede leer el respaldo');
  const bin = atob(packed.slice(4));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  const stream = (new Response(bytes).body as ReadableStream<BufferSource>).pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

// ---------------------------------------------------------------- dispositivo

export interface DeviceInfo {
  kind: 'movil' | 'tablet' | 'escritorio';
  os: string;
  browser: string;
}

/** Tipo de equipo, sistema y navegador a partir del user agent (lo justo para las estadísticas). */
export function parseUserAgent(ua: string, touchPoints = 0): DeviceInfo {
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /iPhone|iPad|iPod/.test(ua)
      ? 'iOS'
      : /Android/.test(ua)
        ? 'Android'
        : /CrOS/.test(ua)
          ? 'ChromeOS'
          : /Mac OS X|Macintosh/.test(ua)
            ? touchPoints > 1
              ? 'iOS' // iPad que se presenta como Mac
              : 'macOS'
            : /Linux/.test(ua)
              ? 'Linux'
              : 'Otro';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\/|Opera/.test(ua)
      ? 'Opera'
      : /SamsungBrowser/.test(ua)
        ? 'Samsung'
        : /Firefox\/|FxiOS/.test(ua)
          ? 'Firefox'
          : /Chrome\/|CriOS/.test(ua)
            ? 'Chrome'
            : /Safari\//.test(ua)
              ? 'Safari'
              : 'Otro';
  const tablet = /iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua)) || (os === 'iOS' && /Macintosh/.test(ua));
  const kind = tablet ? 'tablet' : /Mobi|iPhone|iPod|Android/.test(ua) ? 'movil' : 'escritorio';
  return { kind, os, browser };
}

/**
 * De dónde llegó: `?ref=` o `?utm_source=` en la URL (para los links de las promos), si no el
 * dominio que lo mandó, si no "directo".
 */
export function trafficSource(search: string, referrer: string, ownHost: string): string {
  const params = new URLSearchParams(search);
  const tag = params.get('ref') ?? params.get('utm_source');
  if (tag) return tag.trim().toLowerCase().slice(0, 40);
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '');
    if (host && host !== ownHost.replace(/^www\./, '')) return host;
  } catch {
    // Sin referrer.
  }
  return 'directo';
}
