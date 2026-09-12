import { describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { act, connect, DAY, disconnect, newRoom, players, recover, tick, view } from '../server/game';
import { Store } from '../server/store';
import type { Action, Room } from '../shared/types';

function send(r: Room, id: string, data: Partial<Action> & Pick<Action, 'type'>) {
  const a = { id: randomUUID(), epoch: r.epoch, gameId: r.gameId, ...data } as Action;
  act(r, id, a); return a;
}
function table(n = 2) {
  const r = newRoom('ABCDEF');
  for (let i = 0; i < n; i++) connect(r, `secret${i}`, `Player ${i}`, Date.now() + i);
  send(r, r.host, { type: 'start' });
  for (const p of players(r)) send(r, p.id, { type: 'ready' });
  return r;
}
function ready(r: Room) { for (const p of players(r).filter(m => m.online)) send(r, p.id, { type: 'ready' }); }

describe('original rules and online state', () => {
  test('host deals without lobby ready; ready can be cancelled only before activation', () => {
    const r = newRoom('ABCDEF'); const a = connect(r, 'a', 'Alpha');
    expect(() => send(r, a, { type: 'start' })).toThrow('notReady');
    const b = connect(r, 'b', 'Bravo');
    expect(() => send(r, b, { type: 'start' })).toThrow('hostOnly');
    expect(() => send(r, a, { type: 'ready' })).toThrow('phase');
    send(r, a, { type: 'start' }); expect(r.phase).toBe('ready'); expect(r.result).toBeNull();
    send(r, a, { type: 'ready' }); expect(players(r)[0].ready).toBe(true);
    send(r, a, { type: 'unready' }); expect(players(r)[0].ready).toBe(false);
    send(r, b, { type: 'ready' }); expect(r.phase).toBe('ready');
    send(r, a, { type: 'ready' }); expect(r.phase).toBe('active');
    expect(() => send(r, a, { type: 'unready' })).toThrow('phase');
  });
  test('level result retains completed level and actual reward through readiness and restart', () => {
    const r = table(); const [a,b] = players(r); r.level = 2; r.stars = 1; a.hand=[10]; b.hand=[20];
    send(r,a.id,{type:'play',card:10}); const packet=send(r,b.id,{type:'play',card:20});
    expect(r.level).toBe(3); expect(r.phase).toBe('ready');
    expect(r.result).toMatchObject({kind:'level',level:2,lives:2,stars:2,reward:{lives:0,stars:1}});
    expect(r.result?.mistakes).toBe(0); expect(r.result?.shurikensUsed).toBe(0);
    const result=structuredClone(r.result); act(r,b.id,packet); expect(r.result).toEqual(result);
    send(r,a.id,{type:'ready'}); expect(r.result).toEqual(result); expect(players(r)[1].ready).toBe(false);
    recover(r); expect(r.result).toEqual(result); expect(view(r,a.id).result).toEqual(result);
  });
  test('nonfatal mistakes create one persistent popup result; capped rewards report zero', () => {
    const r=table(); const [a,b]=players(r); a.hand=[20,80]; b.hand=[10,90];
    const packet=send(r,a.id,{type:'play',card:20}); expect(r.reason).toBe('mistake');
    expect(r.result).toMatchObject({kind:'mistake',lives:1,missedCards:[10]});
    const result=structuredClone(r.result); act(r,a.id,packet); expect(r.result).toEqual(result); expect(r.lives).toBe(1);
    ready(r); r.level=2; r.stars=3; a.hand=[30]; b.hand=[40];
    send(r,a.id,{type:'play',card:30}); send(r,b.id,{type:'play',card:40});
    expect(r.result?.reward.stars).toBe(0); expect(r.result?.stars).toBe(3);
    expect(r.result?.shurikensUsed).toBe(0);
  });
  for (const [n, target] of [[2, 12], [3, 10], [4, 8]]) test(`${n} players can complete all ${target} levels and rematch`, () => {
    const r = table(n); expect(r.lives).toBe(n); expect(r.stars).toBe(1); expect(r.target).toBe(target);
    let moves = 0;
    while (r.phase !== 'finished' && moves++ < 1000) {
      if (r.phase === 'ready') ready(r);
      const all = players(r).flatMap(p => p.hand);
      expect(new Set(all).size).toBe(all.length);
      const next = players(r).filter(p => p.hand.length).sort((a, b) => a.hand[0] - b.hand[0])[0];
      if (next) send(r, next.id, { type: 'play', card: next.hand[0] });
    }
    expect(r.reason).toBe('won'); expect(r.lives).toBe(5); expect(r.stars).toBe(3);
    expect(r.result).toMatchObject({kind:'won',level:target});
    send(r, r.host, { type: 'lobby' }); expect(r.phase).toBe('lobby'); expect(players(r).length).toBe(n);
    expect(r.result).toBeNull();
  });
  test('one mistake discards every lower hand card including offline players, costs one life', () => {
    const r = table(3); const [a, b, c] = players(r); a.hand = [34, 80]; b.hand = [26, 30, 90]; c.hand = [12, 35]; c.online = false;
    send(r, a.id, { type: 'play', card: 34 });
    expect(r.lives).toBe(2); expect(r.top).toBe(34); expect(r.revealed.sort((a,b)=>a-b)).toEqual([12,26,30]);
    expect(view(r,b.id).result).toMatchObject({kind:'mistake',missedCards:[12,26,30],lives:2});
    expect(b.hand).toEqual([90]); expect(c.hand).toEqual([35]); expect(r.phase).toBe('ready');
    ready(r); expect(r.phase).toBe('active'); expect(r.revealed).toEqual([]);
  });
  test('last life lost takes priority over clearing the final hand', () => {
    const r = table(); const [a, b] = players(r); a.hand = [50]; b.hand = [10]; r.lives = 1;
    send(r, a.id, { type: 'play', card: 50 }); expect(r.phase).toBe('finished'); expect(r.reason).toBe('lost'); expect(r.level).toBe(1);
    expect(r.result).toMatchObject({kind:'lost',level:1,lives:0,reward:{lives:0,stars:0}});
  });
  test('mistake and shuriken reveal remain visible before moving to the next level', () => {
    const r = table(); const [a,b] = players(r); a.hand=[20]; b.hand=[10];
    send(r,a.id,{type:'play',card:20}); expect(r.phase).toBe('ready'); expect(r.level).toBe(1);
    ready(r); expect(r.level).toBe(2); expect(r.phase).toBe('ready'); expect(a.hand.length).toBe(2);
    ready(r); send(r,a.id,{type:'propose'}); send(r,b.id,{type:'vote',yes:true});
    expect(r.stars).toBe(0); expect(a.hand.length).toBe(1); expect(r.revealed.length).toBe(2);
  });
  test('vote rejects without spending, waits for offline approval, cannot be bypassed by host', () => {
    const r = table(); const [a,b] = players(r);
    send(r,a.id,{type:'propose'}); send(r,b.id,{type:'vote',yes:false}); expect(r.stars).toBe(1); expect(r.reason).toBe('rejected');
    ready(r); send(r,a.id,{type:'propose'}); disconnect(r,b.id);
    expect(r.phase).toBe('vote'); expect(() => send(r,a.id,{type:'resume'})).toThrow();
    expect(() => send(r,b.id,{type:'vote',yes:true})).toThrow();
    connect(r,b.secret,b.name); send(r,b.id,{type:'vote',yes:true}); expect(r.stars).toBe(0);
  });
  test('spectator receives no hands and cannot play or vote', () => {
    const r=table(); const id=connect(r,'viewer','Watcher'); const v=view(r,id);
    expect(v.hand).toEqual([]); expect(JSON.stringify(v)).not.toContain('secret');
    for (const m of v.members) expect('hand' in m).toBe(false);
    expect(view(r,r.host).hand).toEqual(players(r)[0].hand);
    expect(() => send(r,id,{type:'play',card:1})).toThrow('playerOnly');
  });
  test('duplicate packets apply once; old phase and non-lowest cards are rejected', () => {
    const r=table(); const [a,b]=players(r); a.hand=[10,20]; b.hand=[90];
    const action=send(r,a.id,{type:'play',card:10}); act(r,a.id,action); expect(a.hand).toEqual([20]);
    expect(() => send(r,a.id,{type:'play',card:90})).toThrow('card');
    const epoch=r.epoch; send(r,b.id,{type:'propose'});
    expect(() => send(r,a.id,{type:'play',card:20,epoch})).toThrow('stale');
  });
  test('disconnect policy, host transfer, manual resume and reconnect readiness', () => {
    const r=table(3); const [a,b,c]=players(r); const now=Date.now();
    r.settings={disconnect:'continue',timeout:30}; disconnect(r,a.id,now);
    expect(r.host).toBe(b.id); expect(r.phase).toBe('active'); tick(r,now+29_999); expect(r.phase).toBe('active');
    tick(r,now+30_000); expect(r.phase).toBe('paused'); send(r,b.id,{type:'resume'}); ready(r);
    tick(r,now+120_000); expect(r.phase).toBe('active');
    connect(r,a.secret,a.name); expect(r.host).toBe(b.id); expect(r.phase).toBe('ready');
    ready(r); r.settings.disconnect='pause'; disconnect(r,c.id); expect(r.phase).toBe('paused');
  });
  test('all offline pauses, spectators never host or extend expiry', () => {
    const r=table(); connect(r,'watcher','Watcher'); const now=Date.now();
    for(const m of players(r)) disconnect(r,m.id,now);
    expect(r.phase).toBe('paused'); expect(r.host).toBe(''); expect(r.expiresAt).toBe(now+DAY);
    connect(r,'watcher','Watcher',now+1000); expect(r.expiresAt).toBe(now+DAY); expect(r.host).toBe('');
    connect(r,'secret1','Player 1',now+2000); expect(r.expiresAt).toBeNull(); expect(r.host).toBe(players(r)[1].id);
  });
  test('kick or permanent player departure cancels, spectator departure does not', () => {
    const r=table(); const spectator=connect(r,'watcher','Watcher');
    send(r,r.host,{type:'kick',target:spectator}); expect(r.phase).toBe('active');
    send(r,r.host,{type:'kick',target:players(r)[1].id}); expect(r.phase).toBe('lobby'); expect(r.reason).toBe('cancelled');
  });
  test('username case-insensitive validation and expiry', () => {
    const r=newRoom('ABCDEF'); connect(r,'a','Budi');
    expect(() => connect(r,'b','bUdI')).toThrow('nameTaken'); expect(() => connect(r,'c','<script>')).toThrow('name');
    r.expiresAt=1; expect(()=>connect(r,'a','Budi')).toThrow('expired');
  });
  test('restart keeps cards, resets presence and pauses; vote remains a vote', () => {
    const r=table(); const hands=players(r).map(m=>[...m.hand]);
    recover(r); expect(players(r).map(m=>m.hand)).toEqual(hands); expect(r.phase).toBe('paused'); expect(r.host).toBe('');
    const v=table(); send(v,v.host,{type:'propose'}); recover(v); expect(v.phase).toBe('vote'); expect(v.votes).toEqual([]);
  });
  test('storage failure cannot update the in-memory committed snapshot', () => {
    const store=new Store(':memory:'); const r=table(); store.save(r); const before=structuredClone(store.rooms.get(r.code));
    store.db.run('PRAGMA query_only=ON');
    expect(()=>store.change(r.code,d=>{d.lives=0;})).toThrow(); expect(store.rooms.get(r.code)).toEqual(before); store.close();
  });
  test('SQLite reopen restores committed hands and receipts, expires old rooms', () => {
    const directory=mkdtempSync(join(tmpdir(),'the-minds-test-'));
    const path=join(directory,'state.sqlite');
    try {
      const before=new Store(path); const r=table(); const [a,b]=players(r); a.hand=[10,20]; b.hand=[90];
      const packet=send(r,a.id,{type:'play',card:10}); before.save(r);
      const expired=newRoom('OLDOLD',1); before.save(expired); before.close();
      const after=new Store(path);
      const restored=after.rooms.get(r.code)!; expect(restored.phase).toBe('paused'); expect(restored.top).toBe(10);
      expect(players(restored)[0].hand).toEqual([20]); expect(after.rooms.has('OLDOLD')).toBe(false);
      connect(restored,a.secret,a.name); connect(restored,b.secret,b.name);
      act(restored,a.id,packet); expect(players(restored)[0].hand).toEqual([20]);
      expect(restored.phase).toBe('ready'); after.close();
    } finally {
      if (directory.startsWith(join(tmpdir(),'the-minds-test-'))) rmSync(directory,{recursive:true,force:true});
    }
  });
});
