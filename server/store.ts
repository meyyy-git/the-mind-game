import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Room } from '../shared/types';
import { recover } from './game';

export class Store {
  db: Database;
  rooms = new Map<string, Room>();
  constructor(path: string, now = Date.now()) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path, { create: true, strict: true });
    this.db.run('PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;');
    this.db.run('CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY, state TEXT NOT NULL)');
    for (const row of this.db.query<{ state: string }, []>('SELECT state FROM rooms').all()) {
      const room = JSON.parse(row.state) as Room;
      if (recover(room, now)) this.save(room); else this.delete(room.code);
    }
  }
  save(room: Room) {
    this.db.query('INSERT INTO rooms(code,state) VALUES(?,?) ON CONFLICT(code) DO UPDATE SET state=excluded.state').run(room.code, JSON.stringify(room));
    this.rooms.set(room.code, room);
  }
  change<T>(code: string, fn: (draft: Room) => T): T {
    const current = this.rooms.get(code);
    if (!current) throw new Error('missing');
    const draft = structuredClone(current);
    const result = fn(draft);
    draft.revision++;
    this.save(draft);
    return result;
  }
  delete(code: string) { this.db.query('DELETE FROM rooms WHERE code=?').run(code); this.rooms.delete(code); }
  close() { this.db.close(); }
}
