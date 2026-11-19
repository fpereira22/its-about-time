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

/** Fases de `start()` que la escena muestra mientras espera. */
export type FaceCamStep = 'camera' | 'library' | 'model';

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
  async start(onStep?: (step: FaceCamStep) => void): Promise<void> {
    if (this.status === 'ready' || this.status === 'starting') return;
    const session = ++this.session;
    this.detail = '';
    if (!this.supported) {
      this.status = 'unsupported';
      return;
    }
    this.status = 'starting';
    try {
      onStep?.('camera');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', ...idealSize() }, audio: false });
      if (session !== this.session) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      this.stream = stream;
      await this.attachVideo(stream);

      onStep?.('library');
      const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
      onStep?.('model');
      const vision = await FilesetResolver.forVisionTasks(assetUrl('mediapipe/wasm'));
      const options = {
        runningMode: 'VIDEO' as const,
        numFaces: 1,
        outputFaceBlendshapes: true,
      };
      const modelAssetPath = assetUrl('mediapipe/face_landmarker.task');
      try {
        this.landmarker = await FaceLandmarker.createFromOptions(vision, { ...options, baseOptions: { modelAssetPath, delegate: 'GPU' } });
      } catch {
        // Sin WebGL (o un driver que no la soporta): el detector también va en CPU, solo más lento.
        this.landmarker = await FaceLandmarker.createFromOptions(vision, { ...options, baseOptions: { modelAssetPath, delegate: 'CPU' } });
      }
      if (session !== this.session) {
        this.landmarker.close();
        this.landmarker = null;
        return;
      }
      this.status = 'ready';
    } catch (err) {
      if (session !== this.session) return;
      this.release();
      const name = err instanceof DOMException ? err.name : '';
      this.status = name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'error';
      this.detail = err instanceof Error ? `${err.name !== 'Error' ? `${err.name}: ` : ''}${err.message}` : String(err);
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

/** URL absoluta de un archivo de `public/` (el juego se publica con base './'). */
function assetUrl(path: string): string {
  return new URL(`${import.meta.env.BASE_URL}${path}`, window.location.href).href;
}

export const FaceCam = new FaceCamImpl();
