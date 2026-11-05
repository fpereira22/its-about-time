import type { Condition } from '../types/story';
import { StoryState } from './StoryState';

const list = (v: string | string[] | undefined): string[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

/** Evalúa una condición contra el estado actual. Sin condición = verdadero. */
export function check(cond: Condition | undefined | null): boolean {
  if (!cond) return true;
  if (!list(cond.flag).every((f) => StoryState.hasFlag(f))) return false;
  if (list(cond.notFlag).some((f) => StoryState.hasFlag(f))) return false;
  if (!list(cond.hasItem).every((i) => StoryState.hasItem(i))) return false;
  if (list(cond.notItem).some((i) => StoryState.hasItem(i))) return false;
  if (cond.minMoney !== undefined && StoryState.money < cond.minMoney) return false;
  if (cond.minBip !== undefined && StoryState.bip < cond.minBip) return false;
  if (cond.mission !== undefined && !list(cond.mission).includes(StoryState.missionId)) return false;
  if (cond.map !== undefined && !list(cond.map).includes(StoryState.location?.map ?? '')) return false;
  if (cond.all && !cond.all.every(check)) return false;
  if (cond.any && !cond.any.some(check)) return false;
  if (cond.not && check(cond.not)) return false;
  return true;
}
