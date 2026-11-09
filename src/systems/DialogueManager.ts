import { PUCC_DIALOGUES } from '../data/campus_cali';
import type { DialogueChoice, DialogueFile, DialogueNode, DialogueTree, Effect } from '../types/story';
import { check } from './Conditions';
import { applyEffects, runDeferred } from './Effects';
import { EventSystem } from './EventSystem';
import { clockMinutes, formatClock } from './Mission';
import { formatMoney, formatTime, StoryState } from './StoryState';

const files = import.meta.glob<DialogueFile>('../data/dialogues/*.json', { eager: true, import: 'default' });

const trees = new Map<string, DialogueTree>();
// Las botoneras de los ascensores de la PUCC se generan con sus edificios (src/data/campus_cali.ts).
for (const [path, file] of [...Object.entries(files), ['campus_cali.ts', PUCC_DIALOGUES] as const]) {
  for (const [id, tree] of Object.entries(file)) {
    if (trees.has(id)) console.error(`Diálogo "${id}" duplicado (${path})`);
    trees.set(id, tree);
  }
}

export interface ChoiceView {
  label: string;
  index: number;
}

/** Lo que la caja de diálogo debe mostrar en un momento dado. */
export interface DialogueStep {
  speaker?: string;
  text: string;
  /** Si viene, se muestran las opciones al terminar de escribir el texto. */
  choices?: ChoiceView[];
}

/** La caja de diálogo (en la escena UI) implementa esto. */
export interface DialoguePresenter {
  show(step: DialogueStep): void;
  close(): void;
}

const MAX_ROUTING_HOPS = 64;

/**
 * Recorre árboles de diálogo: evalúa condiciones, aplica efectos y entrega pasos a la caja.
 * No dibuja nada; la UI llama a `advance()` y `choose()` según la entrada del jugador.
 */
class DialogueManagerImpl {
  private presenter: DialoguePresenter | null = null;
  private tree: DialogueTree | null = null;
  private treeId = '';
  private steps: DialogueStep[] = [];
  private stepIndex = 0;
  private after: (() => void) | null = null;
  private choices: DialogueChoice[] = [];
  private deferred: Effect[] = [];
  private resolve: (() => void) | null = null;
  private hops = 0;

  /** Variables de texto para {nombre} en los diálogos (ej. {estacion}). */
  readonly vars = new Map<string, string>();

  get active(): boolean {
    return this.tree !== null;
  }

  setPresenter(p: DialoguePresenter): void {
    this.presenter = p;
  }

  exists(id: string): boolean {
    return trees.has(id);
  }

  /** Abre un diálogo. La promesa se resuelve al cerrarse. */
  run(id: string): Promise<void> {
    const tree = trees.get(id);
    if (!tree) {
      console.error(`Diálogo "${id}" no existe`);
      return Promise.resolve();
    }
    if (this.active || !this.presenter) return Promise.resolve();
    this.tree = tree;
    this.treeId = id;
    this.deferred = [];
    EventSystem.emit('dialogue-open');
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.hops = 0;
      this.enterNode(tree.start);
    });
  }

  /** Muestra un texto arbitrario en la caja de diálogo sin requerir un id en los JSON. */
  sayText(text: string, speaker?: string): Promise<void> {
    const tree: DialogueTree = {
      start: 'inicio',
      nodes: {
        inicio: { speaker, text },
      },
    };
    if (this.active || !this.presenter) return Promise.resolve();
    this.tree = tree;
    this.treeId = '__sayText__';
    this.deferred = [];
    EventSystem.emit('dialogue-open');
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.hops = 0;
      this.enterNode('inicio');
    });
  }

  /** Selector de etapas: abandona el diálogo sin aplicar efectos pendientes ni despertar al script que lo esperaba. */
  abort(): void {
    if (!this.active) return;
    this.tree = null;
    this.steps = [];
    this.choices = [];
    this.after = null;
    this.deferred = [];
    this.resolve = null;
    this.presenter?.close();
    EventSystem.emit('dialogue-close');
  }

  /** La UI terminó de mostrar el paso actual (sin opciones). */
  advance(): void {
    if (!this.active) return;
    this.stepIndex++;
    if (this.stepIndex < this.steps.length) {
      this.presenter?.show(this.steps[this.stepIndex]);
      return;
    }
    const next = this.after;
    this.after = null;
    this.hops = 0;
    if (next) next();
    else this.end();
  }

  /** El jugador eligió la opción `index` (índice dentro de las opciones visibles). */
  choose(index: number): void {
    const choice = this.choices[index];
    if (!this.active || !choice) return;
    this.choices = [];
    const outcome = applyEffects(choice.effects);
    this.deferred.push(...outcome.deferred);
    this.hops = 0;
    const go = (): void => (choice.goto ? this.enterNode(choice.goto) : this.end());
    this.play(
      outcome.announcements.map((text) => ({ text })),
      go,
    );
  }

  private enterNode(id: string): void {
    const tree = this.tree;
    if (!tree) return;
    if (++this.hops > MAX_ROUTING_HOPS) {
      console.error(`Diálogo "${this.treeId}": demasiados saltos seguidos (¿ciclo en branches/next?)`);
      this.end();
      return;
    }
    const node = tree.nodes[id];
    if (!node) {
      console.error(`Diálogo "${this.treeId}": nodo "${id}" no existe`);
      this.end();
      return;
    }

    const outcome = applyEffects(node.effects);
    this.deferred.push(...outcome.deferred);

    const pages = node.text === undefined ? [] : Array.isArray(node.text) ? node.text : [node.text];
    const steps: DialogueStep[] = [
      ...pages.map((p) => ({ speaker: node.speaker, text: interpolate(p) })),
      ...outcome.announcements.map((text) => ({ text })),
    ];

    this.choices = (node.choices ?? []).filter((c) => check(c.if));
    if (this.choices.length > 0) {
      if (steps.length === 0) steps.push({ speaker: node.speaker, text: '' });
      steps[steps.length - 1] = {
        ...steps[steps.length - 1],
        choices: this.choices.map((c, index) => ({ label: interpolate(c.label), index })),
      };
      this.play(steps, null);
      return;
    }
    this.play(steps, () => this.continueAfter(node));
  }

  private continueAfter(node: DialogueNode): void {
    if (node.branches) {
      const branch = node.branches.find((b) => check(b.if));
      if (branch) return this.enterNode(branch.goto);
      return this.end();
    }
    if (node.next) return this.enterNode(node.next);
    this.end();
  }

  /** Muestra una secuencia de pasos y luego ejecuta `after` (null = esperar una elección). */
  private play(steps: DialogueStep[], after: (() => void) | null): void {
    if (steps.length === 0) {
      if (after) after();
      return;
    }
    this.steps = steps;
    this.stepIndex = 0;
    this.after = after;
    this.presenter?.show(steps[0]);
  }

  private end(): void {
    if (!this.active) return;
    const deferred = this.deferred;
    const resolve = this.resolve;
    this.tree = null;
    this.steps = [];
    this.choices = [];
    this.after = null;
    this.deferred = [];
    this.resolve = null;
    this.presenter?.close();
    EventSystem.emit('dialogue-close');
    runDeferred(deferred);
    resolve?.();
  }
}

/** Reemplaza {plata}, {bip}, {tiempo}, {hora} y las variables de Dialogue.vars. */
function interpolate(text: string): string {
  return text
    .replace(/\{plata\}/g, formatMoney(StoryState.money))
    .replace(/\{bip\}/g, formatMoney(StoryState.bip))
    .replace(/\{tiempo\}/g, formatTime(StoryState.playTimeMs))
    .replace(/\{hora\}/g, formatClock(clockMinutes()))
    .replace(/\{(\w+)\}/g, (match, name: string) => Dialogue.vars.get(name) ?? match);
}

export const Dialogue = new DialogueManagerImpl();
