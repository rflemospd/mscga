import { useEffect, useState } from 'react';
import { pbkdf2Hash, timingSafeEqual, type UserRecord } from './crypto';
import type { Role } from './permissions';

const SESSION_KEY = 'mscga-session';
const ATTEMPT_KEY = 'mscga-attempts';
const INACTIVITY_MS = 30 * 60 * 1000;
const HARD_EXP_MS = 8 * 60 * 60 * 1000;

type Session = {
  username: string;
  role: Role;
  loginAt: number;
  expiresAt: number;
  hardExpiresAt: number;
};

type AttemptState = {
  count: number;
  blockedUntil: number;
};

let usersCache: UserRecord[] | null = null;

async function loadUsers(): Promise<UserRecord[]> {
  if (usersCache) return usersCache;
  const res = await fetch('./users.json', { cache: 'no-store' });
  usersCache = (await res.json()) as UserRecord[];
  return usersCache;
}

export function getSession(): Session | null {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  const session = JSON.parse(raw) as Session;
  const now = Date.now();
  if (now > session.expiresAt || now > session.hardExpiresAt) {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
  return session;
}

function setSession(session: Session): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function touchSession(): void {
  const session = getSession();
  if (!session) return;
  const now = Date.now();
  session.expiresAt = Math.min(now + INACTIVITY_MS, session.hardExpiresAt);
  setSession(session);
}

export function logout(): void {
  sessionStorage.removeItem(SESSION_KEY);
  window.location.hash = '#/login';
}

function getAttempts(): AttemptState {
  const raw = sessionStorage.getItem(ATTEMPT_KEY);
  if (!raw) return { count: 0, blockedUntil: 0 };
  return JSON.parse(raw) as AttemptState;
}

function saveAttempts(state: AttemptState): void {
  sessionStorage.setItem(ATTEMPT_KEY, JSON.stringify(state));
}

export function getCooldownRemaining(): number {
  const { blockedUntil } = getAttempts();
  return Math.max(0, blockedUntil - Date.now());
}

function registerFailure(): void {
  const state = getAttempts();
  const nextCount = state.count + 1;
  let blockedUntil = state.blockedUntil;
  if (nextCount >= 3) {
    const backoffSeconds = Math.min(300, 2 ** (nextCount - 3) * 5);
    blockedUntil = Date.now() + backoffSeconds * 1000;
  }
  saveAttempts({ count: nextCount, blockedUntil });
}

function clearFailures(): void {
  saveAttempts({ count: 0, blockedUntil: 0 });
}

export async function login(username: string, password: string): Promise<{ ok: boolean; message: string }> {
  const remaining = getCooldownRemaining();
  if (remaining > 0) {
    return { ok: false, message: `Muitas tentativas. Aguarde ${Math.ceil(remaining / 1000)}s.` };
  }

  const users = await loadUsers();
  const record = users.find((user) => user.username === username.trim());
  if (!record) {
    registerFailure();
    return { ok: false, message: 'Credenciais inválidas.' };
  }

  const derived = await pbkdf2Hash(password, record);
  const valid = timingSafeEqual(derived, record.hash);

  if (!valid) {
    registerFailure();
    return { ok: false, message: 'Credenciais inválidas.' };
  }

  clearFailures();
  const now = Date.now();
  setSession({
    username: record.username,
    role: record.role,
    loginAt: now,
    expiresAt: now + INACTIVITY_MS,
    hardExpiresAt: now + HARD_EXP_MS,
  });

  return { ok: true, message: 'Login efetuado.' };
}

export function useSession(): Session | null {
  const [session, setCurrent] = useState<Session | null>(() => getSession());

  useEffect(() => {
    const id = window.setInterval(() => {
      setCurrent(getSession());
    }, 1000);

    return () => clearInterval(id);
  }, []);

  return session;
}
