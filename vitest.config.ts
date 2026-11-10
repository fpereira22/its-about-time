import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // El "main" de Phaser es su código fuente CommonJS (pide dependencias opcionales de desarrollo); el build compilado no.
    alias: { phaser: fileURLToPath(new URL('./node_modules/phaser/dist/phaser.js', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
  },
});
