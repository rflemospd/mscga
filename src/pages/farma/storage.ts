import type { FarmaClient, FarmaNegotiation, FarmaTransfer } from './types';

const CLIENTS_KEY = 'mscga_farma_clients_v1';
const NEGOTIATIONS_KEY = 'mscga_farma_negotiations_v1';
const TRANSFERS_KEY = 'mscga_farma_transfers_v1';

function readArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch (_error) {
    return [];
  }
}

function writeArray<T>(key: string, items: T[]): void {
  localStorage.setItem(key, JSON.stringify(items));
}

export function loadClients(): FarmaClient[] {
  return readArray<FarmaClient>(CLIENTS_KEY);
}

export function saveClients(items: FarmaClient[]): void {
  writeArray(CLIENTS_KEY, items);
}

export function loadNegotiations(): FarmaNegotiation[] {
  return readArray<FarmaNegotiation>(NEGOTIATIONS_KEY);
}

export function saveNegotiations(items: FarmaNegotiation[]): void {
  writeArray(NEGOTIATIONS_KEY, items);
}

export function loadTransfers(): FarmaTransfer[] {
  return readArray<FarmaTransfer>(TRANSFERS_KEY);
}

export function saveTransfers(items: FarmaTransfer[]): void {
  writeArray(TRANSFERS_KEY, items);
}
