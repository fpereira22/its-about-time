import { loadVinetas } from '../ui/Vineta';
import { loadDialogues } from './DialogueManager';

let loading: Promise<void> | null = null;
let ready = false;

/**
 * Contenido de la historia que no viaja en el bundle principal: los diálogos (src/data/dialogues)
 * y las viñetas de cada lugar (src/art/vinetas_*.ts). main.ts lo pide apenas arranca, así se
 * descarga mientras aparece el título; el título (y el selector admin) lo esperan antes de
 * entrar a un mapa, que es lo primero que puede abrir un diálogo o una viñeta.
 */
export const Content = {
  get ready(): boolean {
    return ready;
  },

  load(): Promise<void> {
    loading ??= Promise.all([loadDialogues(), loadVinetas()]).then(
      () => {
        ready = true;
      },
      (err: unknown) => {
        loading = null;
        throw err;
      },
    );
    return loading;
  },
};
