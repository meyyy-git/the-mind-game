import { expect, test } from 'bun:test';
import { io, type Socket } from 'socket.io-client';
import { randomBytes, randomUUID } from 'node:crypto';
import { createApp } from '../server/app';
import type { Reply, RoomView } from '../shared/types';

test('real sockets: create, join, private views, replacement and return to lobby', async () => {
  const app=createApp({database:':memory:'}); const port=await app.listen(0,'127.0.0.1');
  const clients: Socket[]=[];
  async function client(token=randomBytes(32).toString('hex')) {
    const s=io(`http://127.0.0.1:${port}`,{auth:{token},forceNew:true,reconnection:false}); clients.push(s);
    await new Promise<void>((resolve,reject)=>{s.on('connect',()=>resolve());s.on('connect_error',reject);}); return {s,token};
  }
  function emit<T>(s:Socket,name:string,payload:unknown):Promise<Reply<T>> { return new Promise((resolve,reject)=>s.timeout(3000).emit(name,payload,(e:unknown,r:Reply<T>)=>e?reject(e):resolve(r))); }
  const states=new Map<Socket,RoomView>();
  try {
    const a=await client(), b=await client(); for(const c of [a,b]) c.s.on('state',(v:RoomView)=>states.set(c.s,v));
    const created=await emit<{code:string}>(a.s,'enter',{create:true,name:'Alpha'}); expect(created.ok).toBe(true); if(!created.ok) return;
    const code=created.data.code;
    expect((await emit(b.s,'enter',{code,name:'Bravo'})).ok).toBe(true);
    async function command(s:Socket,type:string,rest={}) {
      const r=app.store.rooms.get(code)!;
      return emit(s,'action',{type,id:randomUUID(),epoch:r.epoch,gameId:r.gameId,...rest});
    }
    for(const c of [a,b]) expect((await command(c.s,'ready')).ok).toBe(true);
    expect((await command(a.s,'start')).ok).toBe(true);
    for(const c of [a,b]) expect((await command(c.s,'ready')).ok).toBe(true);
    const watcher=await client(); watcher.s.on('state',(v:RoomView)=>states.set(watcher.s,v));
    expect((await emit(watcher.s,'enter',{code,name:'Watcher'})).ok).toBe(true);
    await new Promise(r=>setTimeout(r,20));
    expect(states.get(watcher.s)?.hand).toEqual([]); expect(JSON.stringify(states.get(watcher.s))).not.toContain('secret');
    expect((await command(watcher.s,'propose')).ok).toBe(false);
    const oldState=states.get(a.s)!; const replaced=new Promise<string>(resolve=>a.s.once('fatal',resolve));
    const newer=await client(a.token); expect((await emit(newer.s,'enter',{code,name:'Alpha'})).ok).toBe(true);
    expect(await replaced).toBe('replaced'); expect(a.s.connected).toBe(false);
    expect(app.store.rooms.get(code)!.members.find(m=>m.id===oldState.self)!.online).toBe(true);
    expect((await fetch(`http://127.0.0.1:${port}/health`)).status).toBe(200);
    expect((await command(newer.s,'cancel')).ok).toBe(true); expect(app.store.rooms.get(code)!.phase).toBe('lobby');
  } finally { for(const s of clients) s.disconnect(); await app.close(); }
},10000);
