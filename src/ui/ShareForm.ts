import { playSfx } from '../audio/sfx';
import { buildShareStats, gameUrl, renderShareImage, shareText } from '../systems/ShareCard';
import { escapeHtml, mountOverlay } from './VoteForm';

/**
 * "Compartir" (resumen de misión y ranking): muestra la tarjeta del progreso y deja mandarla donde
 * quiera. En el celular usa el menú de compartir del sistema (con la imagen); en el computador
 * descarga el PNG y abre LinkedIn, X o WhatsApp con el texto. LinkedIn no acepta texto ni imagen
 * prellenados, así que ahí se copia el texto y se sube la imagen a mano.
 */
export function openShareForm(onClose: () => void, opts: { mission?: string } = {}): () => void {
  const stats = buildShareStats(opts.mission ?? null);
  const url = gameUrl();
  const text = shareText(stats);
  const finish = (): void => {
    if (overlay.closed) return;
    URL.revokeObjectURL(preview);
    overlay.close();
    onClose();
  };
  let preview = '';
  let blob: Blob | null = null;
  const overlay = mountOverlay(
    `
    <div class="card">
      <h2>Comparte tu progreso</h2>
      <p class="sub">La imagen se arma en tu dispositivo; no se sube a ningún lado.</p>
      <div class="sharebox"><img alt="Tarjeta de tu progreso" /><p class="loading">Armando la tarjeta...</p></div>
      <p class="status"></p>
      <div class="row wide share-row">
        <button type="button" class="native main">Compartir</button>
        <button type="button" class="dl">Descargar</button>
        <button type="button" class="copy">Copiar</button>
      </div>
      <div class="row wide share-row">
        <button type="button" class="li">LinkedIn</button>
        <button type="button" class="x">X</button>
        <button type="button" class="wa">WhatsApp</button>
      </div>
      <button type="button" class="link close">Cerrar</button>
    </div>`,
    () => finish(),
  );
  const root = overlay.root;
  const css = document.createElement('style');
  css.textContent = `
    #vote .sharebox { background:#14182a; border:2px solid #2a2433; border-radius:6px; min-height:120px; display:flex; align-items:center; justify-content:center; overflow:hidden; }
    #vote .sharebox img { width:100%; display:none; image-rendering:auto; }
    #vote .sharebox .loading { color:#b8c4e0; margin:0; font-size:15px; }
    #vote .share-row { margin-top:8px; }
    #vote .share-row button { padding:8px 6px; }`;
  root.appendChild(css);
  const img = root.querySelector('img') as HTMLImageElement;
  const loading = root.querySelector('.loading') as HTMLParagraphElement;
  const status = root.querySelector('.status') as HTMLParagraphElement;
  const show = (msg: string, kind: '' | 'err' | 'ok' = ''): void => {
    status.textContent = msg;
    status.className = `status ${kind}`;
  };
  const on = (sel: string, fn: () => void): void => root.querySelector(sel)?.addEventListener('click', fn);

  const file = (): File => new File([blob as Blob], 'its-about-time.png', { type: 'image/png' });
  const needImage = (): boolean => {
    if (blob) return true;
    show('Un momento: la tarjeta se está armando.', 'err');
    playSfx('error');
    return false;
  };
  const copyText = async (): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      return true;
    } catch {
      return false;
    }
  };
  const download = (): void => {
    const a = document.createElement('a');
    a.href = preview;
    a.download = 'its-about-time.png';
    a.click();
  };
  const popup = (href: string): void => void window.open(href, '_blank', 'noopener,noreferrer');

  on('.native', async () => {
    if (!needImage()) return;
    const data: ShareData = { title: "It's About Time", text, url, files: [file()] };
    if (navigator.canShare?.(data)) {
      try {
        await navigator.share(data);
        playSfx('select');
        show('¡Listo!', 'ok');
      } catch {
        // Cerró el menú de compartir: no es un error.
      }
    } else if (navigator.share) {
      try {
        await navigator.share({ title: "It's About Time", text, url });
        show('Compartido (sin imagen: tu navegador no deja adjuntarla). Descárgala aparte.', 'ok');
      } catch {
        // Cerrado.
      }
    } else {
      download();
      show('Tu navegador no tiene menú de compartir: bajó la imagen. Usa los botones de abajo.', 'ok');
    }
  });
  on('.dl', () => {
    if (!needImage()) return;
    download();
    playSfx('select');
    show('Imagen descargada.', 'ok');
  });
  on('.copy', async () => {
    const ok = await copyText();
    playSfx(ok ? 'select' : 'error');
    show(ok ? 'Texto copiado.' : 'No se pudo copiar desde aquí.', ok ? 'ok' : 'err');
  });
  on('.li', async () => {
    if (!needImage()) return;
    download();
    const ok = await copyText();
    popup(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`);
    playSfx('select');
    show(ok ? 'Bajó la imagen y copiamos el texto: en LinkedIn pégalo y sube la imagen.' : 'Bajó la imagen: súbela en tu publicación de LinkedIn.', 'ok');
  });
  on('.x', () => {
    popup(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`);
    show('Si quieres la imagen, descárgala y adjúntala.', 'ok');
  });
  on('.wa', () => popup(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`));
  on('.close', () => {
    playSfx('cancel');
    finish();
  });

  void renderShareImage(stats).then(
    (b) => {
      if (overlay.closed) return;
      blob = b;
      preview = URL.createObjectURL(b);
      img.src = preview;
      img.style.display = 'block';
      loading.remove();
    },
    () => {
      loading.textContent = escapeHtml('No se pudo armar la tarjeta en este navegador.');
    },
  );
  return finish;
}
