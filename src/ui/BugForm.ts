import { playSfx } from '../audio/sfx';
import { BUG_TEXT_MAX, canSendReports, reportAsText, sendBugReport } from '../systems/BugReport';
import { CELEBRATE_MS, celebrate, escapeHtml, MIN_LOADING_MS, mountOverlay, setBusy, shake, wait } from './VoteForm';

/**
 * "Reportar un problema" (Ajustes): una caja de texto, una casilla para adjuntar la partida y, si no hay
 * conexión, un botón para copiar el reporte con todo el contexto. Mismo estilo que los votos.
 */
export function openBugForm(onClose: () => void): () => void {
  const finish = (): void => {
    if (overlay.closed) return;
    overlay.close();
    onClose();
  };
  const online = canSendReports();
  const overlay = mountOverlay(
    `
    <form novalidate>
      <h2>Reportar un problema</h2>
      <p class="sub">Cuéntanos qué pasó y dónde. Con tu permiso adjuntamos el equipo, la misión y los últimos errores.</p>
      <label for="bug-text">¿Qué pasó?</label>
      <textarea id="bug-text" maxlength="${BUG_TEXT_MAX}" placeholder="Ej.: al entrar a la farmacia el juego se quedó congelado."></textarea>
      <div class="count"></div>
      <label class="check"><input id="bug-save" type="checkbox" checked /> Adjuntar mi partida (para abrirla igual)</label>
      <div class="bar"></div>
      <p class="status">${online ? '' : escapeHtml('Sin conexión con el servidor: puedes copiar el reporte y mandarlo a mano.')}</p>
      <div class="row wide">
        <button type="button" class="cancel">Cancelar</button>
        <button type="button" class="copy">Copiar</button>
        <button type="submit"${online ? '' : ' disabled'}>Enviar</button>
      </div>
    </form>`,
    () => finish(),
  );
  const root = overlay.root;
  const form = root.querySelector('form') as HTMLFormElement;
  const text = root.querySelector('#bug-text') as HTMLTextAreaElement;
  const withSave = root.querySelector('#bug-save') as HTMLInputElement;
  const count = root.querySelector('.count') as HTMLDivElement;
  const status = root.querySelector('.status') as HTMLParagraphElement;
  const send = root.querySelector('button[type=submit]') as HTMLButtonElement;
  const show = (msg: string, kind: '' | 'err' | 'ok'): void => {
    status.textContent = msg;
    status.className = `status ${kind}`;
  };
  const updateCount = (): void => void (count.textContent = `${text.value.length}/${BUG_TEXT_MAX}`);
  text.addEventListener('input', updateCount);
  updateCount();

  // La casilla del formulario de votos tiene su propio estilo: acá una línea simple.
  const label = root.querySelector('label.check') as HTMLLabelElement;
  label.style.cssText = 'display:flex;gap:8px;align-items:center;font-family:inherit;font-size:14px;margin:10px 0 0;cursor:pointer';

  (root.querySelector('.cancel') as HTMLButtonElement).addEventListener('click', () => {
    playSfx('cancel');
    finish();
  });
  (root.querySelector('.copy') as HTMLButtonElement).addEventListener('click', () => {
    if (text.value.trim() === '') {
      show('Escribe primero qué pasó.', 'err');
      shake(form);
      playSfx('error');
      return;
    }
    const report = reportAsText(text.value);
    const done = (): void => {
      playSfx('select');
      show('Reporte copiado: pégalo donde nos lo quieras mandar.', 'ok');
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(report).then(done, () => show('No se pudo copiar.', 'err'));
    else show('Tu navegador no deja copiar desde aquí.', 'err');
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (overlay.busy) return;
    overlay.busy = true;
    setBusy(form, send, true);
    show('Enviando...', '');
    void Promise.all([sendBugReport(text.value, withSave.checked), wait(MIN_LOADING_MS)]).then(([r]) => {
      if (overlay.closed) return;
      overlay.busy = false;
      setBusy(form, send, false);
      if (!r.ok) {
        show(r.error, 'err');
        shake(form);
        playSfx('error');
        return;
      }
      playSfx('select');
      celebrate(form, ['✔'], '¡Gracias!', 'Lo vamos a revisar.');
      setTimeout(finish, CELEBRATE_MS);
    });
  });

  text.focus();
  return finish;
}
