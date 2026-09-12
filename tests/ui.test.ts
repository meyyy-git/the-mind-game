import { expect, test } from 'bun:test';
import { interruptsGame, ResultDialog, InviteCode } from '../src/ui';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { GameResult } from '../shared/types';

test('hidden invite code is replaced rather than exposed in accessible markup', () => {
  const render = (hidden: boolean) => renderToStaticMarkup(createElement(InviteCode, { code: 'ABC123', hidden, onToggle: () => {}, t: (id) => id }));
  expect(render(true)).not.toContain('ABC123');
  expect(render(true)).toContain('Tampilkan kode undangan');
  expect(render(true)).toContain('aria-pressed="true"');
  expect(render(false)).toContain('ABC123');
  expect(render(false)).toContain('Sembunyikan kode undangan');
});

test('exit confirmation distinguishes spectators, players and completed games', () => {
  expect(interruptsGame('leave', 'spectator', 'active')).toBe(false);
  expect(interruptsGame('kick', 'spectator', 'vote')).toBe(false);
  expect(interruptsGame('leave', 'player', 'active')).toBe(true);
  expect(interruptsGame('kick', 'player', 'paused')).toBe(true);
  expect(interruptsGame('cancel', 'player', 'ready')).toBe(true);
  expect(interruptsGame('leave', 'player', 'lobby')).toBe(false);
  expect(interruptsGame('cancel', 'player', 'finished')).toBe(false);
  expect(interruptsGame('resume', 'player', 'paused')).toBe(false);
});

test('result dialog shows earned rewards, failed level and localized personal close action', () => {
  const base: GameResult = { id: 'result', kind: 'level', level: 2, lives: 2, stars: 2, reward: { lives: 0, stars: 1 }, mistakes: 1, shurikensUsed: 0 };
  const render = (result: GameResult, english=false) => renderToStaticMarkup(createElement(ResultDialog, { result, t: (id,en)=>english?en:id, isHost: false, onLobby: ()=>{}, onClose: ()=>{throw new Error('Rendering cannot dismiss a result');} }));
  expect(render(base)).toContain('Level 2 selesai!'); expect(render(base)).toContain('+1 shuriken');
  expect(render(base)).toContain('Lanjut'); expect(render(base)).toContain('Pemain lain tetap melihat hasilnya');
  const loss=render({...base,kind:'lost',lives:0,reward:{lives:0,stars:0}});
  expect(loss).toContain('Nyawa habis'); expect(loss).toContain('level 2'); expect(loss).not.toContain('+1 shuriken');
  expect(render({...base,kind:'won'},true)).toContain('You win!');
  expect(render({...base,kind:'won'},true)).toContain('Close result');
  expect(render({...base,kind:'won'},true)).toContain('Mistakes');
  expect(render({...base,kind:'won'},true)).toContain('Shuriken used');
  expect(render({...base,kind:'won',mistakes:3,shurikensUsed:2},true)).toContain('3');
  const mistake={...base,kind:'mistake' as const,reward:{lives:0,stars:0},missedCards:[12,26]};
  expect(render(mistake)).toContain('Urutan kartu salah');
  expect(render(mistake)).toContain('satu nyawa');
  expect(render(mistake)).toContain('Kartu yang terlewat');
  expect(render(mistake)).not.toContain('selesai!');
  expect(render(mistake,true)).toContain('Card out of order');
});
