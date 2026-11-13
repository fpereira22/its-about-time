import { playSfx } from '../audio/sfx';
import { Controls } from '../systems/Controls';
import { COMMENT_MAX, NAME_MAX, Ranking } from '../systems/Ranking';

/**
 * Formulario HTML (sobre el canvas) para votar el juego: nombre, estrellas y comentario. Es HTML y no
 * Phaser para tener teclado de verdad (acentos, el teclado del celular, pegar texto).
 *
 * Mientras está abierto, las teclas no llegan al juego: los atajos globales (WASD, E, P, F2, el código
 * admin...) escuchan en window, y el formulario corta la propagación antes.
 */

const CSS = `
#vote { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center;
  background: rgba(10, 14, 24, 0.72); font-family: "Pixelify Sans", monospace; padding: 12px; box-sizing: border-box; }
#vote form { width: min(420px, 100%); max-height: 100%; overflow: auto; box-sizing: border-box; background: #fbf7ee;
  color: #2a2433; border: 3px solid #2a2433; border-radius: 10px; padding: 16px 18px; box-shadow: 0 6px 0 rgba(0,0,0,.35); }
#vote h2 { margin: 0 0 2px; font-size: 22px; font-weight: 600; }
#vote .sub { margin: 0 0 14px; font-size: 15px; color: #7a7488; }
#vote label { display: block; font-family: "Silkscreen", monospace; font-size: 12px; letter-spacing: .5px; margin: 10px 0 4px; }
#vote input[type=text], #vote textarea { width: 100%; box-sizing: border-box; font: inherit; font-size: 17px; color: #2a2433;
  background: #fff; border: 2px solid #2a2433; border-radius: 6px; padding: 6px 8px; outline: none; }
#vote input[type=text]:focus, #vote textarea:focus { border-color: #2f6fd0; }
#vote textarea { resize: none; height: 78px; }
#vote .stars { display: flex; gap: 4px; }
#vote .stars button { font-size: 30px; line-height: 1; padding: 0 2px; background: none; border: none; cursor: pointer;
  color: #d8d0bc; font-family: inherit; }
#vote .stars button.on { color: #e0a020; }
#vote .stars button:focus-visible { outline: 2px solid #2f6fd0; border-radius: 4px; }
#vote .count { text-align: right; font-size: 12px; color: #7a7488; margin-top: 2px; }
#vote .status { min-height: 18px; font-size: 14px; margin: 8px 0 0; }
#vote .status.err { color: #c03a2b; }
#vote .status.ok { color: #2f8a3a; }
#vote .row { display: flex; gap: 10px; justify-content: flex-end; margin-top: 10px; }
#vote .row button { font-family: "Silkscreen", monospace; font-size: 13px; padding: 8px 14px; border-radius: 6px;
  border: 2px solid #2a2433; cursor: pointer; background: #e9e2d2; color: #2a2433; }
#vote .row button[type=submit] { background: #2f6fd0; color: #fff; }
#vote .row button:disabled { opacity: .55; cursor: default; }
`;

let styled = false;

/** Abre el formulario. `onClose(sent)` se llama al cerrarlo (sent: se envió algo). */
export function openVoteForm(onClose: (sent: boolean) => void): () => void {
  if (!styled) {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    styled = true;
  }
  Controls.reset();

  const mine = Ranking.myScore();
  const root = document.createElement('div');
  root.id = 'vote';
  root.innerHTML = `
    <form novalidate>
      <h2>Vota el juego</h2>
      <p class="sub">Tu puntaje: <b>${mine.score}</b> de ${mine.total} · ${mine.missions} misiones. Al enviar entras al ranking.</p>
      <label for="vote-name">Tu nombre de jugador</label>
      <input id="vote-name" type="text" maxlength="${NAME_MAX}" autocomplete="nickname" spellcheck="false" />
      <label>Estrellas <span style="text-transform:none;font-family:inherit;color:#7a7488">(opcional)</span></label>
      <div class="stars" role="radiogroup" aria-label="Estrellas">
        ${[1, 2, 3, 4, 5].map((n) => `<button type="button" role="radio" data-n="${n}" aria-label="${n} estrellas">★</button>`).join('')}
      </div>
      <label for="vote-comment">Comentario <span style="text-transform:none;font-family:inherit;color:#7a7488">(opcional)</span></label>
      <textarea id="vote-comment" maxlength="${COMMENT_MAX}" placeholder="¿Qué te pareció?"></textarea>
      <div class="count"></div>
      <p class="status"></p>
      <div class="row">
        <button type="button" class="cancel">Cancelar</button>
        <button type="submit">Enviar</button>
      </div>
    </form>`;

  const form = root.querySelector('form') as HTMLFormElement;
  const name = root.querySelector('#vote-name') as HTMLInputElement;
  const comment = root.querySelector('#vote-comment') as HTMLTextAreaElement;
  const count = root.querySelector('.count') as HTMLDivElement;
  const status = root.querySelector('.status') as HTMLParagraphElement;
  const send = root.querySelector('button[type=submit]') as HTMLButtonElement;
  const starButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('.stars button'));

  let stars = 0;
  let sent = false;
  let closed = false;
  const paintStars = (): void =>
    starButtons.forEach((b, i) => {
      b.classList.toggle('on', i < stars);
      b.setAttribute('aria-checked', String(i + 1 === stars));
    });
  starButtons.forEach((b) =>
    b.addEventListener('click', () => {
      const n = Number(b.dataset.n);
      stars = stars === n ? 0 : n; // tocar la misma estrella la quita
      paintStars();
      playSfx('cursor');
    }),
  );
  const updateCount = (): void => void (count.textContent = `${comment.value.length}/${COMMENT_MAX}`);
  comment.addEventListener('input', updateCount);

  const showStatus = (text: string, kind: '' | 'err' | 'ok'): void => {
    status.textContent = text;
    status.className = `status ${kind}`;
  };

  // Las teclas no llegan al juego (ver comentario de arriba): se cortan en window, en la fase de
  // captura, antes que cualquier otro listener. Escribir igual funciona (no se cancela la acción por defecto).
  const guard = (e: KeyboardEvent): void => {
    e.stopImmediatePropagation();
    if (e.type === 'keydown' && e.key === 'Escape') {
      e.preventDefault();
      playSfx('cancel');
      close();
    }
  };
  window.addEventListener('keydown', guard, true);
  window.addEventListener('keyup', guard, true);

  const close = (): void => {
    if (closed) return;
    closed = true;
    window.removeEventListener('keydown', guard, true);
    window.removeEventListener('keyup', guard, true);
    root.remove();
    Controls.reset();
    onClose(sent);
  };

  root.addEventListener('pointerdown', (e) => e.target === root && close());
  (root.querySelector('.cancel') as HTMLButtonElement).addEventListener('click', () => {
    playSfx('cancel');
    close();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    send.disabled = true;
    showStatus('Enviando...', '');
    void Ranking.submit(name.value, stars, comment.value).then((r) => {
      if (closed) return;
      if (!r.ok) {
        send.disabled = false;
        showStatus(r.error, 'err');
        playSfx('error');
        return;
      }
      sent = true;
      playSfx('select');
      showStatus(stars > 0 ? '¡Gracias por tu voto!' : '¡Listo! Ya estás en el ranking.', 'ok');
      setTimeout(close, 1100);
    });
  });

  if (!Ranking.canSubmit) {
    send.disabled = true;
    showStatus('El ranking todavía no está conectado.', 'err');
  }

  name.value = Ranking.playerName ?? '';
  paintStars();
  updateCount();
  document.body.appendChild(root);
  (name.value ? comment : name).focus();
  return close;
}
