import { playSfx } from '../audio/sfx';
import { Controls } from '../systems/Controls';
import { COMMENT_MAX, NAME_MAX, Ranking } from '../systems/Ranking';

/**
 * Formularios HTML (sobre el canvas) del ranking: votar el juego (nombre, estrellas y comentario), el
 * saludo de la primera vez (pide el nombre) y "¿Estás disfrutando el juego?". Son HTML y no Phaser
 * para tener teclado de verdad (acentos, el teclado del celular, pegar texto).
 *
 * Mientras uno está abierto, las teclas no llegan al juego: los atajos globales (WASD, E, P, F2, el
 * código admin...) escuchan en window, y el formulario corta la propagación antes.
 */

const CSS = `
#vote { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center;
  background: rgba(10, 14, 24, 0.72); font-family: "Pixelify Sans", monospace; padding: 12px; box-sizing: border-box; }
#vote form, #vote .card { width: min(420px, 100%); max-height: 100%; overflow: auto; box-sizing: border-box; background: #fbf7ee;
  color: #2a2433; border: 3px solid #2a2433; border-radius: 10px; padding: 16px 18px; box-shadow: 0 6px 0 rgba(0,0,0,.35);
  animation: vote-in .22s ease-out; }
#vote .card { width: min(380px, 100%); text-align: center; }
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
#vote .row button[type=submit], #vote .row button.main { background: #2f6fd0; color: #fff; }
#vote .row button:disabled { opacity: .55; cursor: default; }
#vote .row.wide { flex-wrap: wrap; }
#vote .row.wide button { flex: 1 1 0; white-space: nowrap; }
#vote .link { display: block; margin: 12px auto 0; background: none; border: none; font: inherit; font-size: 13px;
  color: #7a7488; text-decoration: underline; cursor: pointer; }
@keyframes vote-in { from { opacity: 0; transform: translateY(8px) scale(.98); } to { opacity: 1; transform: none; } }

/* Salida: la tarjeta se encoge y la capa se desvanece. */
#vote.out { animation: vote-fade .22s ease-in forwards; }
#vote.out form, #vote.out .card { animation: vote-leave .22s ease-in forwards; }
@keyframes vote-fade { to { opacity: 0; } }
@keyframes vote-leave { to { opacity: 0; transform: translateY(6px) scale(.94); } }

/* Error: la tarjeta tiembla. */
#vote .shake { animation: vote-shake .36s steps(6); }
@keyframes vote-shake { 0%,100% { transform: none; } 20%,60% { transform: translateX(-5px); } 40%,80% { transform: translateX(5px); } }

/* Enviando: el botón muestra tres cuadritos que saltan, los campos se apagan y una barra a rayas corre abajo. */
#vote .row button.loading { position: relative; color: transparent !important; opacity: 1 !important; }
#vote .row button.loading::after { content: ''; position: absolute; left: 50%; top: 50%; width: 4px; height: 4px;
  margin: -2px 0 0 -10px; background: #fff; box-shadow: 8px 0 #fff, 16px 0 #fff; animation: vote-dots .9s steps(1) infinite; }
@keyframes vote-dots {
  0% { box-shadow: 8px 0 #fff, 16px 0 #fff; transform: translateY(-3px); }
  33% { box-shadow: 8px -3px #fff, 16px 3px #fff; transform: translateY(3px); }
  66% { box-shadow: 8px 3px #fff, 16px -3px #fff; transform: translateY(0); }
}
#vote .busy input, #vote .busy textarea, #vote .busy .stars, #vote .busy .cancel { opacity: .5; pointer-events: none;
  transition: opacity .2s; }
#vote .bar { height: 6px; margin-top: 10px; border: 2px solid #2a2433; border-radius: 4px; overflow: hidden; display: none;
  background: repeating-linear-gradient(-45deg, #2f6fd0 0 6px, #6c9be6 6px 12px); background-size: 17px 17px;
  animation: vote-bar .5s linear infinite; }
#vote .busy .bar { display: block; }
@keyframes vote-bar { to { background-position: 17px 0; } }

/* Listo: la tarjeta cambia por una celebración (estrellas que aparecen de a una, confeti de píxeles). */
#vote form, #vote .card { position: relative; }
#vote .done { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 6px; background: #fbf7ee; border-radius: 7px; text-align: center; padding: 12px; overflow: hidden;
  animation: vote-done .25s ease-out; }
@keyframes vote-done { from { opacity: 0; } }
#vote .done .icon { display: flex; gap: 4px; font-size: 38px; line-height: 1; color: #e0a020; min-height: 40px; }
#vote .done .icon span { display: inline-block; animation: vote-pop .45s cubic-bezier(.3,1.8,.5,1) both; }
@keyframes vote-pop { from { transform: scale(0) rotate(-40deg); opacity: 0; } to { transform: none; opacity: 1; } }
#vote .done h2 { font-size: 24px; }
#vote .done h2 span { display: inline-block; animation: vote-letter .4s cubic-bezier(.3,1.8,.5,1) both; white-space: pre; }
@keyframes vote-letter { from { transform: translateY(10px); opacity: 0; } to { transform: none; opacity: 1; } }
#vote .done p { margin: 0; font-size: 15px; color: #7a7488; animation: vote-in .3s ease-out both; }
#vote .done i { position: absolute; top: -8px; width: 5px; height: 5px; animation: vote-fall linear forwards; }
@keyframes vote-fall { to { transform: translate(var(--dx), 330px) rotate(var(--rot)); opacity: .2; } }
#vote .done .ring { position: absolute; left: 50%; top: 50%; width: 10px; height: 10px; margin: -5px; border: 3px solid #e0a020;
  border-radius: 50%; animation: vote-ring .7s ease-out forwards; }
@keyframes vote-ring { to { transform: scale(26); opacity: 0; } }

@media (prefers-reduced-motion: reduce) {
  #vote *, #vote, #vote *::after { animation-duration: 1ms !important; animation-iteration-count: 1 !important; }
}
`;

const CONFETTI = ['#e0a020', '#2f6fd0', '#d8483a', '#3a9a4a', '#f08a2c', '#8a5cc8'];

/** Cambia el botón por los cuadritos que saltan, apaga los campos y muestra la barra. */
function setBusy(form: HTMLElement, button: HTMLButtonElement, busy: boolean): void {
  form.classList.toggle('busy', busy);
  button.classList.toggle('loading', busy);
  button.disabled = busy;
}

/** Hace temblar la tarjeta (error). */
function shake(el: HTMLElement): void {
  el.classList.remove('shake');
  void el.offsetWidth; // reinicia la animación
  el.classList.add('shake');
}

/**
 * Tapa la tarjeta con la celebración: `icons` aparecen de a uno (estrellas), el título letra por
 * letra, un anillo se expande y cae confeti de píxeles.
 */
function celebrate(card: HTMLElement, icons: string[], title: string, sub: string): void {
  const done = document.createElement('div');
  done.className = 'done';
  const ring = document.createElement('div');
  ring.className = 'ring';
  done.appendChild(ring);
  const icon = document.createElement('div');
  icon.className = 'icon';
  icons.forEach((ch, i) => {
    const s = document.createElement('span');
    s.textContent = ch;
    s.style.animationDelay = `${120 + i * 110}ms`;
    icon.appendChild(s);
  });
  const h = document.createElement('h2');
  const letters = Array.from(title);
  const titleDelay = 200 + icons.length * 110;
  letters.forEach((ch, i) => {
    const s = document.createElement('span');
    s.textContent = ch;
    s.style.animationDelay = `${titleDelay + i * 28}ms`;
    h.appendChild(s);
  });
  const p = document.createElement('p');
  p.textContent = sub;
  p.style.animationDelay = `${titleDelay + letters.length * 28 + 80}ms`;
  done.append(icon, h, p);
  for (let i = 0; i < 34; i++) {
    const c = document.createElement('i');
    c.style.left = `${Math.random() * 100}%`;
    c.style.background = CONFETTI[i % CONFETTI.length];
    c.style.setProperty('--dx', `${Math.round((Math.random() - 0.5) * 80)}px`);
    c.style.setProperty('--rot', `${Math.round(180 + Math.random() * 540)}deg`);
    c.style.animationDuration = `${1100 + Math.random() * 900}ms`;
    c.style.animationDelay = `${Math.random() * 350}ms`;
    done.appendChild(c);
  }
  card.appendChild(done);
}

/** Lo que dura la celebración antes de cerrar sola. */
const CELEBRATE_MS = 2100;
/** Lo mínimo que se ve la carga. */
const MIN_LOADING_MS = 650;

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

let styled = false;

/**
 * Los avisos que salen solos (saludo, "¿Estás disfrutando?") no salen con el navegador automatizado
 * (Playwright: capturas de las promos), para no tapar la grabación.
 */
export function autoPromptsAllowed(): boolean {
  return typeof navigator === 'undefined' || !navigator.webdriver;
}

interface Overlay {
  root: HTMLDivElement;
  /**
   * Quita la capa sin avisar a nadie (quien llama decide qué hacer después). Con `instant` no anima la
   * salida (al cambiar de un formulario a otro).
   */
  close: (instant?: boolean) => void;
  readonly closed: boolean;
  /** Enviando o celebrando: Esc y tocar fuera no cierran. */
  busy: boolean;
}

/**
 * Capa oscura con `html` dentro. Mientras está, las teclas no llegan al juego: se cortan en window, en
 * la fase de captura, antes que cualquier otro listener (escribir igual funciona, no se cancela la
 * acción por defecto). Esc o tocar fuera llaman a `onDismiss`.
 */
function mountOverlay(html: string, onDismiss: () => void): Overlay {
  if (!styled) {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    styled = true;
  }
  Controls.reset();
  const root = document.createElement('div');
  root.id = 'vote';
  root.innerHTML = html;
  let closed = false;
  const guard = (e: KeyboardEvent): void => {
    e.stopImmediatePropagation();
    if (e.type === 'keydown' && e.key === 'Escape') {
      e.preventDefault();
      if (overlay.busy) return;
      playSfx('cancel');
      onDismiss();
    }
  };
  window.addEventListener('keydown', guard, true);
  window.addEventListener('keyup', guard, true);
  root.addEventListener('pointerdown', (e) => e.target === root && !overlay.busy && onDismiss());
  document.body.appendChild(root);
  const overlay: Overlay = {
    root,
    busy: false,
    get closed() {
      return closed;
    },
    close(instant = false) {
      if (closed) return;
      closed = true;
      window.removeEventListener('keydown', guard, true);
      window.removeEventListener('keyup', guard, true);
      Controls.reset();
      if (instant) return root.remove();
      // Ya no recibe toques mientras se va.
      root.style.pointerEvents = 'none';
      root.classList.add('out');
      setTimeout(() => root.remove(), 230);
    },
  };
  return overlay;
}

const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

const OPTIONAL = '<span style="text-transform:none;font-family:inherit;color:#7a7488">(opcional)</span>';

export interface VoteFormOptions {
  title?: string;
  /** Texto bajo el título (por defecto, el puntaje). */
  sub?: string;
  /** Estrellas ya marcadas al abrir. */
  stars?: number;
  placeholder?: string;
}

/** Abre el formulario de votos. `onClose(sent)` se llama al cerrarlo (sent: se envió algo). */
export function openVoteForm(onClose: (sent: boolean) => void, opts: VoteFormOptions = {}): () => void {
  const mine = Ranking.myScore();
  const sub = opts.sub
    ? escapeHtml(opts.sub)
    : `Tu puntaje: <b>${mine.score}</b> de ${mine.total} · ${mine.missions} misiones. Al enviar entras al ranking.`;
  let sent = false;
  const finish = (): void => {
    if (overlay.closed) return;
    overlay.close();
    onClose(sent);
  };
  const overlay = mountOverlay(
    `
    <form novalidate>
      <h2>${escapeHtml(opts.title ?? 'Vota el juego')}</h2>
      <p class="sub">${sub}</p>
      <label for="vote-name">Tu nombre de jugador</label>
      <input id="vote-name" type="text" maxlength="${NAME_MAX}" autocomplete="nickname" spellcheck="false" />
      <label>Estrellas ${OPTIONAL}</label>
      <div class="stars" role="radiogroup" aria-label="Estrellas">
        ${[1, 2, 3, 4, 5].map((n) => `<button type="button" role="radio" data-n="${n}" aria-label="${n} estrellas">★</button>`).join('')}
      </div>
      <label for="vote-comment">Comentario ${OPTIONAL}</label>
      <textarea id="vote-comment" maxlength="${COMMENT_MAX}" placeholder="${escapeHtml(opts.placeholder ?? '¿Qué te pareció?')}"></textarea>
      <div class="count"></div>
      <div class="bar"></div>
      <p class="status"></p>
      <div class="row">
        <button type="button" class="cancel">Cancelar</button>
        <button type="submit">Enviar</button>
      </div>
    </form>`,
    () => finish(),
  );
  const root = overlay.root;
  const form = root.querySelector('form') as HTMLFormElement;
  const name = root.querySelector('#vote-name') as HTMLInputElement;
  const comment = root.querySelector('#vote-comment') as HTMLTextAreaElement;
  const count = root.querySelector('.count') as HTMLDivElement;
  const status = root.querySelector('.status') as HTMLParagraphElement;
  const send = root.querySelector('button[type=submit]') as HTMLButtonElement;
  const starButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('.stars button'));

  let stars = Math.max(0, Math.min(5, opts.stars ?? 0));
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

  (root.querySelector('.cancel') as HTMLButtonElement).addEventListener('click', () => {
    playSfx('cancel');
    finish();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (overlay.busy) return;
    overlay.busy = true;
    setBusy(form, send, true);
    showStatus('Enviando...', '');
    // Un mínimo de espera para que la carga se alcance a ver aunque la red conteste al tiro.
    void Promise.all([Ranking.submit(name.value, stars, comment.value), wait(MIN_LOADING_MS)]).then(([r]) => {
      if (overlay.closed) return;
      if (!r.ok) {
        overlay.busy = false;
        setBusy(form, send, false);
        showStatus(r.error, 'err');
        shake(form);
        playSfx('error');
        return;
      }
      sent = true;
      playSfx('select');
      showStatus('', 'ok');
      const who = Ranking.suggestedName ?? '';
      if (stars > 0) celebrate(form, Array(stars).fill('★'), '¡Gracias por tu voto!', comment.value.trim() ? 'Tu reseña ya va camino al título.' : `${who}, ya estás en el ranking.`);
      else celebrate(form, ['★'], '¡Ya estás en el ranking!', `Suerte, ${who}. A subir puntos.`);
      setTimeout(finish, CELEBRATE_MS);
    });
  });

  if (!Ranking.canSubmit) {
    send.disabled = true;
    showStatus('El ranking todavía no está conectado.', 'err');
  }

  name.value = Ranking.suggestedName ?? '';
  paintStars();
  updateCount();
  (name.value ? comment : name).focus();
  return finish;
}

/** Saludo de la primera vez: pide el nombre. Solo se guarda en este navegador; rellena el voto. */
export function openNameForm(onClose: () => void): () => void {
  const finish = (): void => {
    if (overlay.closed) return;
    overlay.close();
    onClose();
  };
  const skip = (): void => {
    Ranking.setDraftName('');
    finish();
  };
  const overlay = mountOverlay(
    `
    <form novalidate>
      <h2>¡Hola!</h2>
      <p class="sub">¿Cómo te llamamos? Lo usaremos cuando quieras entrar al ranking o votar el juego.</p>
      <label for="vote-name">Tu nombre de jugador</label>
      <input id="vote-name" type="text" maxlength="${NAME_MAX}" autocomplete="nickname" spellcheck="false" />
      <div class="bar"></div>
      <p class="status"></p>
      <div class="row">
        <button type="button" class="cancel">Ahora no</button>
        <button type="submit">¡Listo!</button>
      </div>
    </form>`,
    skip,
  );
  const root = overlay.root;
  const name = root.querySelector('#vote-name') as HTMLInputElement;
  const status = root.querySelector('.status') as HTMLParagraphElement;
  const send = root.querySelector('button[type=submit]') as HTMLButtonElement;
  const form = root.querySelector('form') as HTMLFormElement;
  const error = (text: string): void => {
    status.textContent = text;
    status.className = 'status err';
    shake(form);
    playSfx('error');
  };
  (root.querySelector('.cancel') as HTMLButtonElement).addEventListener('click', () => {
    playSfx('cancel');
    skip();
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (overlay.busy) return;
    if (name.value.trim() === '') return error('Escribe tu nombre (o elige "Ahora no").');
    const r = Ranking.setDraftName(name.value);
    if (!r.ok) return error(r.error);
    status.textContent = '';
    overlay.busy = true;
    setBusy(form, send, true);
    void wait(MIN_LOADING_MS).then(() => {
      if (overlay.closed) return;
      playSfx('select');
      celebrate(form, ['★'], `¡Hola, ${Ranking.suggestedName}!`, 'Listo, ya te conocemos. ¡Que lo disfrutes!');
      setTimeout(finish, CELEBRATE_MS);
    });
  });
  name.focus();
  return finish;
}

/**
 * "¿Estás disfrutando el juego?". Sí abre el voto con 5 estrellas marcadas; Más o menos lo abre sin
 * estrellas, preguntando qué mejorar. Devuelve con qué cerrar lo que esté abierto (la pregunta o el voto).
 */
export function openEnjoyPrompt(onClose: () => void): () => void {
  Ranking.markEnjoyAsked();
  let closeVote: (() => void) | null = null;
  const finish = (): void => {
    if (overlay.closed) return;
    overlay.close();
    onClose();
  };
  const toVote = (opts: VoteFormOptions): void => {
    overlay.close(true);
    closeVote = openVoteForm(() => {
      closeVote = null;
      onClose();
    }, opts);
  };
  const overlay = mountOverlay(
    `
    <div class="card">
      <h2>¿Estás disfrutando el juego?</h2>
      <p class="sub">Tu opinión nos ayuda un montón.</p>
      <div class="row wide">
        <button type="button" class="yes main">¡Sí! ★</button>
        <button type="button" class="meh">Más o menos</button>
        <button type="button" class="later">Ahora no</button>
      </div>
      <button type="button" class="link never">No volver a preguntar</button>
    </div>`,
    finish,
  );
  const root = overlay.root;
  const on = (sel: string, fn: () => void): void =>
    (root.querySelector(sel) as HTMLButtonElement).addEventListener('click', fn);
  on('.yes', () => {
    playSfx('select');
    toVote({ title: '¡Qué bueno!', sub: 'Déjale tus estrellas y, si quieres, un comentario. Al enviar entras al ranking.', stars: 5 });
  });
  on('.meh', () => {
    playSfx('select');
    toVote({ title: 'Cuéntanos', sub: '¿Qué le falta o qué cambiarías? Lo leemos todo.', placeholder: '¿Qué podemos mejorar?' });
  });
  on('.later', () => {
    playSfx('cancel');
    finish();
  });
  on('.never', () => {
    playSfx('cancel');
    Ranking.neverAskEnjoy();
    finish();
  });
  (root.querySelector('.yes') as HTMLButtonElement).focus();
  return () => (closeVote ? closeVote() : finish());
}
