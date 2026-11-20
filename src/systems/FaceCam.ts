import type { FaceLandmarker } from '@mediapipe/tasks-vision';
import type { Shapes } from './faceChallenges';

/**
 * Cámara + detector de caras (MediaPipe Face Landmarker) para las pruebas de admin.
 *
 * Todo corre en el navegador del jugador: el video no sale del equipo y Vercel solo sirve los archivos.
 * La librería, el WASM (~14 MB) y el modelo (~4 MB) se piden recién al llamar a `start()`, así que
 * quien no abre la prueba no descarga nada. Archivos en `public/mediapipe/` (el WASM lo copia
 * el plugin «mediapipe-wasm» de vite.config.ts desde node_modules).
 */

export type FaceCamStatus = 'idle' | 'starting' | 'ready' | 'denied' | 'unsupported' | 'error';

/**
 * Fases de `start()` que la escena muestra mientras espera. 'download' solo ocurre si los archivos
 * (~18 MB) todavía no están guardados en este dispositivo; si ya están, se salta directo a 'model'.
 */
export type FaceCamStep = 'camera' | 'library' | 'download' | 'model';

/**
 * Avance de TODO el arranque de la cámara (fraction 0..1): permiso, archivos y puesta en marcha.
 * Es un solo porcentaje que nunca retrocede; la escena no necesita saber qué está pasando por dentro.
 */
export interface FaceCamProgress {
  fraction: number;
}

/**
 * Archivos que necesita el detector. Se descargan nosotros (para poder mostrar el avance) y se guardan
 * en Cache Storage: la próxima vez salen de ahí, también sin internet y aunque el juego se actualice
 * (el service worker no toca este caché). `size` es aproximado: solo sirve para calcular el porcentaje.
 */
const CAMERA_CACHE = 'its-about-time-camara-v1';
const ASSETS = [
  { path: 'mediapipe/wasm/vision_wasm_internal.js', size: 336_624, type: 'text/javascript' },
  { path: 'mediapipe/wasm/vision_wasm_internal.wasm', size: 14_665_716, type: 'application/wasm' },
  { path: 'mediapipe/face_landmarker.task', size: 3_758_596, type: 'application/octet-stream' },
] as const;
const ASSETS_TOTAL = ASSETS.reduce((n, a) => n + a.size, 0);

/** Cuántas lecturas por segundo como máximo (más no se nota y cansa a los celulares). */
const MAX_FPS = 24;
/** Tamaño pedido a la cámara: el detector no necesita más. */
const VIDEO_SIZE = { width: 320, height: 240 };

class FaceCamImpl {
  status: FaceCamStatus = 'idle';
  /** Detalle técnico del último fallo (para mostrar en pantalla). */
  detail = '';
  private video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private landmarker: FaceLandmarker | null = null;
  private lastDetect = 0;
  private lastVideoTime = -1;
  private shapes: Shapes | null = null;
  /** Dónde está la cabeza en el cuadro (0..1, ya espejado: como en un espejo), o null si no hay cara. Se actualiza con `read()`. */
  head: { x: number; y: number } | null = null;
  /** Se cuenta cada `start()` para que un `stop()` a mitad de la carga no deje la cámara prendida. */
  private session = 0;

  /** ¿Este navegador puede pedir la cámara? (HTTPS o localhost, y que exista la API). */
  get supported(): boolean {
    return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof WebAssembly !== 'undefined';
  }

  /** Prende la cámara y deja listo el detector. Siempre termina con `status` en 'ready' o un fallo. */
  async start(onStep?: (step: FaceCamStep) => void, onProgress?: (p: FaceCamProgress) => void): Promise<void> {
    if (this.status === 'ready' || this.status === 'starting') return;
    const session = ++this.session;
    this.detail = '';
    if (!this.supported) {
      this.status = 'unsupported';
      return;
    }
    this.status = 'starting';
    // Un solo porcentaje para todo: permiso 0-15 %, archivos 15-80 % (solo la primera vez), puesta en marcha hasta 100 %.
    let shown = 0;
    const emit = (fraction: number): void => {
      shown = Math.max(shown, Math.min(1, fraction));
      onProgress?.({ fraction: shown });
    };
    let creep: ReturnType<typeof setInterval> | null = null;
    try {
      onStep?.('camera');
      emit(0.02);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', ...idealSize() }, audio: false });
      if (session !== this.session) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      this.stream = stream;
      await this.attachVideo(stream);
      emit(0.1);

      onStep?.('library');
      const { FaceLandmarker } = await import('@mediapipe/tasks-vision');
      if (session !== this.session) return;
      emit(0.15);

      const cached = await faceCamCached();
      const blobs = await loadAssets(onStep, (d) => emit(0.15 + 0.65 * d), () => session !== this.session);
      if (!blobs || session !== this.session) return;
      onStep?.('model');
      // Armar el detector no avisa su avance: el porcentaje sube solo, cada vez más despacio, hasta que termina.
      const base = cached ? 0.15 : 0.8;
      const t0 = performance.now();
      creep = setInterval(() => emit(base + (0.98 - base) * (1 - Math.exp(-(performance.now() - t0) / 2500))), 100);
      const loaderUrl = URL.createObjectURL(blobs[0]);
      const binaryUrl = URL.createObjectURL(blobs[1]);
      try {
        const vision = { wasmLoaderPath: loaderUrl, wasmBinaryPath: binaryUrl };
        const options = {
          runningMode: 'VIDEO' as const,
          numFaces: 1,
          outputFaceBlendshapes: true,
        };
        const modelAssetBuffer = async (): Promise<Uint8Array> => new Uint8Array(await blobs[2].arrayBuffer());
        try {
          this.landmarker = await FaceLandmarker.createFromOptions(vision, { ...options, baseOptions: { modelAssetBuffer: await modelAssetBuffer(), delegate: 'GPU' } });
        } catch {
          // Sin WebGL (o un driver que no la soporta): el detector también va en CPU, solo más lento.
          this.landmarker = await FaceLandmarker.createFromOptions(vision, { ...options, baseOptions: { modelAssetBuffer: await modelAssetBuffer(), delegate: 'CPU' } });
        }
      } finally {
        URL.revokeObjectURL(loaderUrl);
        URL.revokeObjectURL(binaryUrl);
      }
      if (session !== this.session) {
        this.landmarker.close();
        this.landmarker = null;
        return;
      }
      this.status = 'ready';
      emit(1);
    } catch (err) {
      if (session !== this.session) return;
      this.release();
      const name = err instanceof DOMException ? err.name : '';
      this.status = name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'error';
      this.detail = err instanceof Error ? `${err.name !== 'Error' ? `${err.name}: ` : ''}${err.message}` : String(err);
    } finally {
      if (creep) clearInterval(creep);
    }
  }

  /** Apaga la cámara y libera el detector. Seguro de llamar siempre (también si nunca se prendió). */
  stop(): void {
    this.session++;
    this.release();
    this.status = 'idle';
  }

  /**
   * Última lectura de la cara: los blendshapes, o null si no hay cara (o la cámara no está lista).
   * Detecta como mucho `MAX_FPS` veces por segundo y solo si el video tiene un cuadro nuevo.
   */
  read(): Shapes | null {
    const video = this.video;
    const landmarker = this.landmarker;
    if (this.status !== 'ready' || !video || !landmarker || video.readyState < 2) return null;
    const now = performance.now();
    if (now - this.lastDetect < 1000 / MAX_FPS || video.currentTime === this.lastVideoTime) return this.shapes;
    this.lastDetect = now;
    this.lastVideoTime = video.currentTime;
    try {
      const result = landmarker.detectForVideo(video, now);
      const categories = result.faceBlendshapes[0]?.categories;
      // La punta de la nariz (landmark 1), espejada: x crece cuando mueves la cabeza hacia TU derecha.
      const nose = result.faceLandmarks[0]?.[1];
      this.head = nose ? { x: 1 - nose.x, y: nose.y } : null;
      if (!categories) {
        this.shapes = null;
      } else {
        const shapes: Record<string, number> = {};
        for (const c of categories) shapes[c.categoryName] = c.score;
        this.shapes = shapes;
      }
    } catch {
      this.shapes = null;
      this.head = null;
    }
    return this.shapes;
  }

  /** Dibuja el cuadro actual de la cámara en `ctx` (espejado, como un espejo de verdad). */
  drawMirrored(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
    const video = this.video;
    if (!video || video.readyState < 2 || !video.videoWidth) return false;
    // Recorte centrado al aspecto del destino, para no estirar la cara.
    const srcAspect = video.videoWidth / video.videoHeight;
    const dstAspect = w / h;
    let sw = video.videoWidth;
    let sh = video.videoHeight;
    if (srcAspect > dstAspect) sw = sh * dstAspect;
    else sh = sw / dstAspect;
    const sx = (video.videoWidth - sw) / 2;
    const sy = (video.videoHeight - sh) / 2;
    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);
    ctx.restore();
    return true;
  }

  private async attachVideo(stream: MediaStream): Promise<void> {
    const video = document.createElement('video');
    video.playsInline = true;
    video.muted = true;
    video.autoplay = true;
    video.srcObject = stream;
    // Fuera de pantalla pero en el documento: Safari de iPhone no reproduce un <video> suelto.
    video.style.cssText = 'position:fixed;left:-9999px;top:0;width:2px;height:2px;opacity:0;pointer-events:none';
    document.body.appendChild(video);
    this.video = video;
    await video.play();
  }

  private release(): void {
    this.landmarker?.close();
    this.landmarker = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.video) {
      this.video.srcObject = null;
      this.video.remove();
      this.video = null;
    }
    this.shapes = null;
    this.head = null;
    this.lastVideoTime = -1;
  }
}

function idealSize(): { width: { ideal: number }; height: { ideal: number } } {
  return { width: { ideal: VIDEO_SIZE.width }, height: { ideal: VIDEO_SIZE.height } };
}

/** «37%», para el pie de la barra. */
export function percentCaption(p: FaceCamProgress): string {
  return `${Math.floor(p.fraction * 100)}%`;
}

async function openCache(): Promise<Cache | null> {
  try {
    return typeof caches === 'undefined' ? null : await caches.open(CAMERA_CACHE);
  } catch {
    return null; // modo privado u otro bloqueo: se descarga cada vez, pero funciona
  }
}

/** ¿Ya están en este dispositivo el WASM y el modelo? (así la cámara no descarga nada) */
export async function faceCamCached(): Promise<boolean> {
  const cache = await openCache();
  if (!cache) return false;
  try {
    const hits = await Promise.all(ASSETS.map((a) => cache.match(assetUrl(a.path))));
    return hits.every(Boolean);
  } catch {
    return false;
  }
}

/**
 * Deja en memoria los tres archivos (del caché si ya están, o descargándolos con avance y guardándolos).
 * Devuelve null si `cancelled()` se vuelve verdadero a mitad de camino.
 */
async function loadAssets(
  onStep: ((step: FaceCamStep) => void) | undefined,
  onProgress: (downloaded: number) => void,
  cancelled: () => boolean,
): Promise<[Blob, Blob, Blob] | null> {
  const cache = await openCache();
  const hits = cache ? await Promise.all(ASSETS.map((a) => cache.match(assetUrl(a.path)).catch(() => undefined))) : [];
  const blobs: Blob[] = [];
  let doneBytes = 0;
  const report = (loaded: number, last = false): void => {
    onProgress(last ? 1 : Math.min(0.99, loaded / ASSETS_TOTAL)); // 0..1 de lo que hay que bajar
  };
  const allCached = hits.length === ASSETS.length && hits.every(Boolean);
  if (!allCached) {
    onStep?.('download');
    report(0);
  }
  for (let i = 0; i < ASSETS.length; i++) {
    const asset = ASSETS[i];
    const hit = hits[i];
    let blob: Blob;
    if (hit) {
      blob = await hit.blob();
    } else {
      const res = await fetch(assetUrl(asset.path));
      if (!res.ok) throw new Error(`No se pudo descargar ${asset.path} (${res.status})`);
      if (res.body) {
        const reader = res.body.getReader();
        const chunks: BlobPart[] = [];
        let got = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (cancelled()) {
            void reader.cancel();
            return null;
          }
          chunks.push(value);
          got += value.byteLength;
          report(doneBytes + got);
        }
        blob = new Blob(chunks, { type: asset.type });
      } else {
        blob = await res.blob();
      }
      if (cache) {
        try {
          await cache.put(assetUrl(asset.path), new Response(blob, { headers: { 'Content-Type': asset.type } }));
        } catch {
          // sin espacio o sin permiso: queda en memoria, se descargará de nuevo otro día
        }
      }
    }
    if (cancelled()) return null;
    doneBytes += blob.size;
    blobs.push(blob);
  }
  if (!allCached) report(doneBytes, true);
  return blobs as [Blob, Blob, Blob];
}

/** URL absoluta de un archivo de `public/` (el juego se publica con base './'). */
function assetUrl(path: string): string {
  return new URL(`${import.meta.env.BASE_URL}${path}`, window.location.href).href;
}

export const FaceCam = new FaceCamImpl();
