export type Phase = 'lobby' | 'ready' | 'active' | 'vote' | 'paused' | 'finished';
export type Reason = 'welcome' | 'level' | 'mistake' | 'shuriken' | 'rejected' | 'disconnect' | 'reconnect' | 'restart' | 'won' | 'lost' | 'cancelled';
export type Settings = { disconnect: 'pause' | 'continue'; timeout: 30 | 60 | 120 };
export type GameResult = { id: string; kind: 'level' | 'won' | 'lost' | 'mistake'; level: number; lives: number; stars: number; reward: { lives: number; stars: number }; mistakes: number; shurikensUsed: number; missedCards?: number[] };
export type Member = { id: string; name: string; secret: string; role: 'player' | 'spectator'; online: boolean; ready: boolean; joined: number; hand: number[]; deadline: number | null };
export type Room = {
  code: string; host: string; members: Member[]; settings: Settings; phase: Phase; reason: Reason;
  epoch: number; revision: number; gameId: string; level: number; target: number; lives: number; stars: number;
  top: number | null; votes: string[]; revealed: number[]; expiresAt: number | null; lastSeen: number;
  receipts: string[]; event: { id: string; kind: string };
  result: GameResult | null; mistakes: number; shurikensUsed: number;
};
export type PublicMember = Omit<Member, 'secret' | 'hand' | 'deadline'> & { count: number };
export type RoomView = Omit<Room, 'members' | 'receipts' | 'lastSeen'> & { members: PublicMember[]; self: string; hand: number[]; reconnectAt: number | null };
export type Action = { id: string; epoch: number; gameId: string; type: 'ready' | 'unready' | 'start' | 'play' | 'propose' | 'vote' | 'resume' | 'lobby' | 'cancel' | 'kick' | 'leave' | 'seat' | 'settings'; card?: number; yes?: boolean; target?: string; settings?: Settings };
export type Reply<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
