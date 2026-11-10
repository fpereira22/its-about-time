import { beforeEach } from 'vitest';

/**
 * Entorno de los tests: jsdom no implementa canvas, y Phaser lo prueba apenas se importa
 * (detección de capacidades del dispositivo). Un contexto 2D falso que acepta todo basta para
 * importar los módulos del juego; los tests no dibujan nada.
 */
function fakeContext(): CanvasRenderingContext2D {
  const store: Record<string | symbol, unknown> = {
    getImageData: (_x: number, _y: number, w = 1, h = 1) => ({ data: new Uint8ClampedArray(4 * w * h), width: w, height: h }),
    createImageData: (w = 1, h = 1) => ({ data: new Uint8ClampedArray(4 * w * h), width: w, height: h }),
    measureText: (text: string) => ({ width: text.length * 6 }),
  };
  return new Proxy(store, {
    get: (target, key) => (key in target ? target[key] : () => undefined),
    set: (target, key, value) => {
      target[key] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  configurable: true,
  value(this: HTMLCanvasElement, type: string) {
    return type === '2d' ? fakeContext() : null;
  },
});

// Cada test parte con el almacenamiento vacío (partida, ajustes, registros).
beforeEach(() => window.localStorage.clear());
