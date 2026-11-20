import { playSfx } from '../audio/sfx';
import { buildShareStats, gameUrl, renderShareImage, shareText } from '../systems/ShareCard';
import { escapeHtml, mountOverlay } from './VoteForm';

/**
 * "Compartir" (resumen de misión y ranking): muestra la tarjeta del progreso y deja mandarla donde
 * quiera. En el celular usa el menú de compartir del sistema (con la imagen); en el computador
 * descarga el PNG y abre LinkedIn, X, Facebook, WhatsApp o Instagram con el texto. Ninguna red (salvo
 * el menú del celular) acepta una imagen prellenada desde un enlace, y Instagram ni siquiera texto: ahí se
 * baja la imagen, se copia el texto y se sube a mano, y el recuadro "Cómo publicarlo" lo explica paso a paso.
 * Con `finale` celebra el final del juego (créditos).
 */
export function openShareForm(onClose: () => void, opts: { mission?: string; finale?: boolean } = {}): () => void {
  const finale = opts.finale === true;
  const stats = buildShareStats(opts.mission ?? null, finale);
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
      <h2>${finale ? '¡Comparte tu final!' : 'Comparte tu progreso'}</h2>
      <p class="sub">La imagen se arma en tu dispositivo; no se sube a ningún lado.</p>
      <div class="sharebox"><img alt="Tarjeta de tu progreso" /><p class="loading">Armando la tarjeta...</p></div>
      <p class="status"></p>
      <div class="row wide share-row">
        <button type="button" class="native main">Compartir</button>
        <button type="button" class="dl">Descargar</button>
        <button type="button" class="copy">Copiar</button>
      </div>
      <div class="row wide share-row">
        <button type="button" class="wa">WhatsApp</button>
        <button type="button" class="ig">Instagram</button>
        <button type="button" class="fb">Facebook</button>
      </div>
      <div class="row wide share-row">
        <button type="button" class="li">LinkedIn</button>
        <button type="button" class="x">X</button>
      </div>
      <details class="howto"${finale ? ' open' : ''}>
        <summary>Cómo publicarlo</summary>
        <p><b>En el celular:</b> toca <b>Compartir</b> y elige la app (Instagram, WhatsApp, lo que uses). La imagen y el texto van incluidos.</p>
        <p><b>En el computador:</b></p>
        <ol>
          <li>Toca el botón de la red: baja la imagen y copia el texto solo (o usa <b>Descargar</b> y <b>Copiar</b>).</li>
          <li>En la red, crea una publicación nueva (en WhatsApp, el clip 📎).</li>
          <li>Sube la imagen y pega el texto con Ctrl+V.</li>
        </ol>
        <p class="why">Las redes no dejan adjuntar la imagen desde un enlace ni, en Instagram, escribir el texto; por eso la subes tú. Es un paso.</p>
      </details>
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
    #vote .share-row button { padding:8px 6px; }
    #vote .howto { margin:10px 0 0; text-align:left; font-size:14px; color:#4a4560; background:#f1ebdc; border-radius:6px; padding:6px 10px; }
    #vote .howto summary { cursor:pointer; font-weight:600; color:#14182a; }
    #vote .howto p { margin:6px 0 0; }
    #vote .howto ol { margin:4px 0 0; padding-left:20px; }
    #vote .howto .why { color:#7a7488; font-size:13px; }`;
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
  /** Menú de compartir del sistema con la imagen (celulares). false si el navegador no puede adjuntarla. */
  const nativeWithImage = async (): Promise<boolean> => {
    const data: ShareData = { title: "It's About Time", text, url, files: [file()] };
    if (!navigator.canShare?.(data)) return false;
    try {
      await navigator.share(data);
      playSfx('select');
      show('¡Listo!', 'ok');
    } catch {
      // Cerró el menú de compartir: no es un error.
    }
    return true;
  };
  /** Para las redes que no reciben la imagen por enlace: la baja y copia el texto para pegarlo. Devuelve si se copió. */
  const prepare = async (): Promise<boolean> => {
    download();
    return copyText();
  };
  on('.li', async () => {
    if (!needImage()) return;
    const ok = await prepare();
    popup(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`);
    playSfx('select');
    show(ok ? 'Bajó la imagen y copiamos el texto: en LinkedIn pégalo y sube la imagen.' : 'Bajó la imagen: súbela en tu publicación de LinkedIn.', 'ok');
  });
  on('.x', () => {
    popup(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`);
    show('Si quieres la imagen, descárgala y adjúntala.', 'ok');
  });
  on('.fb', async () => {
    if (!needImage()) return;
    const ok = await prepare();
    popup(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`);
    playSfx('select');
    show(ok ? 'Bajó la imagen y copiamos el texto: en Facebook sube la imagen y pega el texto.' : 'Bajó la imagen: súbela en tu publicación de Facebook.', 'ok');
  });
  on('.wa', async () => {
    if (!needImage()) return;
    if (await nativeWithImage()) return;
    // WhatsApp Web recibe el texto por enlace, pero no la imagen: se baja para adjuntarla con el clip.
    download();
    popup(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`);
    playSfx('select');
    show('Abrimos WhatsApp con el texto. Adjunta con el clip 📎 la imagen que acaba de bajar.', 'ok');
  });
  on('.ig', async () => {
    if (!needImage()) return;
    if (await nativeWithImage()) return;
    // Instagram no tiene enlace para publicar: solo se puede abrir y subir la imagen a mano.
    const ok = await prepare();
    popup('https://www.instagram.com/');
    playSfx('select');
    show(
      ok
        ? 'Bajó la imagen y copiamos el texto: en Instagram toca + → Publicación, elige la imagen y pega el texto.'
        : 'Bajó la imagen: en Instagram toca + → Publicación y súbela.',
      'ok',
    );
  });
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
