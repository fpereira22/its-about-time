import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

/**
 * El build sale en varios archivos en vez de uno de ~3 MB:
 * - `phaser`: el motor. Casi nunca cambia, así que el navegador lo guarda entre versiones del juego.
 * - `dialogues` y `vinetas_index`: el contenido de la historia. Rollup los separa solo porque se
 *   importan de forma dinámica (ver src/systems/Content.ts); se piden apenas arranca el juego y
 *   llegan mientras se ve el título.
 * - el resto: el código del juego, mapas, escenas y UI.
 *
 * Solo Phaser va en `manualChunks`: un chunk manual se lleva también los módulos que usa, y si
 * fueran las viñetas arrastrarían StoryState, theme, etc., y el juego tendría que cargarlas de entrada.
 */
function chunkFor(id: string): string | undefined {
  return id.replace(/\\/g, '/').includes('/node_modules/phaser/') ? 'phaser' : undefined;
}

/**
 * Escribe dist/sw.js desde pwa/service-worker.js con la lista de archivos de este build (los chunks,
 * index.html y lo de public/) y una versión que cambia cuando cambia cualquiera de ellos. Así el
 * service worker descarga el juego completo al instalarse y borra el caché de la versión anterior.
 */
function serviceWorker(): Plugin {
  return {
    name: 'service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const publicFiles = listFiles('public');
      const files = ['./', ...[...Object.keys(bundle), ...publicFiles].filter((f) => f !== 'sw.js').sort()];
      const hash = createHash('sha256');
      for (const name of Object.keys(bundle).sort()) {
        const out = bundle[name];
        hash.update(name).update(out.type === 'chunk' ? out.code : out.source);
      }
      for (const f of publicFiles) hash.update(f).update(readFileSync(join('public', f)));
      const source = readFileSync('pwa/service-worker.js', 'utf8')
        .replace("const VERSION = '__VERSION__';", `const VERSION = '${hash.digest('hex').slice(0, 12)}';`)
        .replace('const PRECACHE = __PRECACHE__;', `const PRECACHE = ${JSON.stringify(files.map((f) => (f === './' ? f : `./${f}`)))};`);
      if (source.includes('__VERSION__') || source.includes('__PRECACHE__')) this.error('pwa/service-worker.js: no se encontraron VERSION o PRECACHE');
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

/** Archivos de `dir` (recursivo), relativos a él y con "/". */
function listFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => relative(dir, join(e.parentPath, e.name)).replace(/\\/g, '/'));
}

export default defineConfig({
  base: './',
  plugins: [serviceWorker()],
  server: {
    open: true,
  },
  build: {
    target: 'es2022',
    // Phaser solo pesa ~1,2 MB minificado; el aviso por defecto (500 KB) saltaría siempre.
    chunkSizeWarningLimit: 1300,
    rollupOptions: {
      output: { manualChunks: chunkFor },
    },
  },
});
