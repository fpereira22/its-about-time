import { beforeEach, describe, expect, it } from 'vitest';
import { ChatLog, parseChatLog } from '../src/systems/ChatLog';
import { StoryState } from '../src/systems/StoryState';

const ORDER = ['mission01', 'mission02', 'mission03'];
const ORDER_FB = ['mission07', 'mission08', 'mission09', 'mission10'];

describe('ChatLog', () => {
  beforeEach(() => {
    window.localStorage.clear();
    ChatLog.reload();
  });

  it('cada mensaje que llega queda anotado en su misión y sobrevive a una partida nueva', () => {
    StoryState.newGame('mission01');
    StoryState.receiveMessage('hola', 600);
    StoryState.newGame('mission02');
    expect(StoryState.phone).toHaveLength(0);
    const before = ChatLog.before('mission02', ORDER);
    expect(before).toHaveLength(1);
    expect(before[0].mission).toBe('mission01');
    expect(before[0].entries[0]).toMatchObject({ id: 'hola', min: 600, read: true });
  });

  it('solo trae lo de misiones anteriores a la actual, en orden', () => {
    ChatLog.record('mission03', { id: 'c', read: false, at: 1 });
    ChatLog.record('mission01', { id: 'a', read: false, at: 1 });
    expect(ChatLog.before('mission03', ORDER).map((p) => p.mission)).toEqual(['mission01']);
    expect(ChatLog.before('mission01', ORDER)).toEqual([]);
  });

  it('no repite un mensaje al volver a jugar la misión', () => {
    ChatLog.record('mission01', { id: 'a', read: false, at: 1 });
    ChatLog.record('mission01', { id: 'a', read: false, at: 99 });
    expect(ChatLog.before('mission02', ORDER)[0].entries).toHaveLength(1);
  });

  it('cargar una partida anota sus mensajes (guardadas antes del historial)', () => {
    ChatLog.recordAll('mission01', [{ id: 'x', read: true, at: 3 }]);
    ChatLog.reload();
    expect(ChatLog.before('mission02', ORDER)[0].entries[0].id).toBe('x');
  });

  it('descarta lo roto', () => {
    expect(parseChatLog({ mission01: [{ id: 'a', at: 1 }, { id: 'a', at: 2 }, { id: 5 }, null], otra: [], mission02: 'x' })).toEqual({
      mission01: [{ id: 'a', read: true, at: 1 }],
    });
  });

  it('los recuerdos (misiones 8 y 9) no ven el chat de las demás ni lo aportan', () => {
    ChatLog.record('mission07', { id: 'a', read: false, at: 1 });
    ChatLog.record('mission08', { id: 'b', read: false, at: 1 });
    expect(ChatLog.before('mission08', ORDER_FB)).toEqual([]);
    expect(ChatLog.before('mission09', ORDER_FB)).toEqual([]);
    expect(ChatLog.before('mission10', ORDER_FB).map((p) => p.mission)).toEqual(['mission07']);
  });
});
