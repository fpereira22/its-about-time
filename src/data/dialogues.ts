import type { DialogueFile } from '../types/story';

/**
 * Todos los archivos de src/data/dialogues/ juntos. Este módulo solo se importa de forma dinámica
 * (loadDialogues en src/systems/DialogueManager.ts), así que el build lo deja en un chunk aparte.
 */
export const DIALOGUE_FILES = import.meta.glob<DialogueFile>('./dialogues/*.json', { eager: true, import: 'default' });
