import { expect, test } from 'bun:test';
import { interruptsGame } from '../src/ui';

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
