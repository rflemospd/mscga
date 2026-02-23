import type {
  FarmaClient,
  FarmaNegotiation,
  FarmaNegotiationClientSnapshot,
  FarmaNegotiationInstallment,
  FarmaTransfer,
  NegotiationPeriodicity,
  NegotiationStatus,
  TransferStatus,
} from './types';
import {
  adjustWeekend,
  createId,
  getTodayISO,
  normalizeCnpj,
  normalizeCodigo,
  parseBR,
  parseDateBR,
  parseISODate,
  toISODate,
  transferStatusFromStage,
} from './utils';

const CLIENTS_KEY = 'mscga_farma_clients_v1';
const NEGOTIATIONS_KEY = 'mscga_farma_negotiations_v1';
const TRANSFERS_KEY = 'mscga_farma_transfers_v1';

function readArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeArray<T>(key: string, items: T[]): void {
  localStorage.setItem(key, JSON.stringify(items));
}

function asIso(raw: unknown): string {
  if (typeof raw === 'number' && Number.isFinite(raw)) return new Date(raw).toISOString();
  if (typeof raw === 'string' && raw.trim()) {
    const direct = new Date(raw);
    if (!Number.isNaN(direct.getTime())) return direct.toISOString();
    const br = parseDateBR(raw);
    if (br) return new Date(br.getFullYear(), br.getMonth(), br.getDate(), 12).toISOString();
  }
  return new Date().toISOString();
}

function parseDueDate(raw: unknown): string {
  if (typeof raw === 'string') {
    const iso = parseISODate(raw);
    if (iso) return toISODate(iso);
    const br = parseDateBR(raw);
    if (br) return toISODate(br);
  }
  return getTodayISO();
}

function sanitizeClient(raw: unknown): FarmaClient | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const createdAt = asIso(item.createdAt ?? item.criadoEm);
  const updatedAt = asIso(item.updatedAt ?? item.atualizadoEm ?? createdAt);
  return {
    id: String(item.id || createId('cli')),
    codigo: normalizeCodigo(String(item.codigo ?? item.codigoCliente ?? '')),
    razao: String(item.razao ?? item.razaoSocial ?? '').trim(),
    cnpj: normalizeCnpj(String(item.cnpj ?? '')),
    representante: String(item.representante ?? item.responsavel ?? '').trim(),
    contato: String(item.contato ?? '').trim(),
    email: String(item.email ?? '').trim().toLowerCase(),
    createdAt,
    updatedAt,
  };
}

function normalizePeriodicity(raw: unknown): NegotiationPeriodicity {
  if (raw === 'semanal' || raw === 'quinzenal' || raw === 'mensal') return raw;
  return 'mensal';
}

function normalizeStatus(raw: unknown): NegotiationStatus {
  if (raw === 'finalizada' || raw === 'cancelada' || raw === 'andamento') return raw;
  const legacy = String(raw || '').toLowerCase();
  if (legacy.includes('final')) return 'finalizada';
  if (legacy.includes('cancel')) return 'cancelada';
  return 'andamento';
}

function normalizeClientSnapshot(raw: unknown): FarmaNegotiationClientSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  return {
    codigo: normalizeCodigo(String(item.codigo ?? item.codigoCliente ?? '')),
    razao: String(item.razao ?? item.razaoSocial ?? '').trim(),
    cnpj: normalizeCnpj(String(item.cnpj ?? '')),
    representante: String(item.representante ?? item.responsavel ?? '').trim(),
    contato: String(item.contato ?? '').trim(),
  };
}

function parseInstallment(raw: unknown, index: number, defaultValue: number): FarmaNegotiationInstallment | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const paidAtRaw = String(item.paidAt ?? item.pagoEm ?? '');
  let paidAt = '';
  if (paidAtRaw) {
    const iso = parseISODate(paidAtRaw);
    if (iso) paidAt = toISODate(iso);
    const br = parseDateBR(paidAtRaw);
    if (br) paidAt = toISODate(br);
  }
  return {
    id: String(item.id || createId('par')),
    numero: Math.max(1, Number(item.numero || index + 1) || index + 1),
    dueDate: parseDueDate(item.dueDate ?? item.data ?? item.vencto),
    valor: Math.max(0, Number(item.valor ?? defaultValue) || 0),
    paid: Boolean(item.paid ?? item.paga),
    paidAt,
  };
}

function periodicityStep(periodicidade: NegotiationPeriodicity): number {
  if (periodicidade === 'semanal') return 7;
  if (periodicidade === 'quinzenal') return 15;
  return 30;
}

function createInstallments(raw: Record<string, unknown>, periodicidade: NegotiationPeriodicity): FarmaNegotiationInstallment[] {
  const parcelas = Math.max(1, Number(raw.parcelas ?? raw.numeroParcelas) || 1);
  const valorParcela = Math.max(
    0,
    Number(raw.valorParcela) ||
      Number(raw.valorNegociado ?? raw.valorTotalNegociado) / Math.max(1, parcelas) ||
      0,
  );

  const datesFromRaw = Array.isArray(raw.datasPrevistas)
    ? (raw.datasPrevistas as unknown[])
        .map((value) => parseDueDate(value))
        .filter(Boolean)
    : [];

  const firstDue = parseDueDate(raw.primeiroVencimento ?? raw.vencimento ?? datesFromRaw[0] ?? getTodayISO());
  const startDate = parseISODate(firstDue) ?? new Date();
  const step = periodicityStep(periodicidade);
  const installments: FarmaNegotiationInstallment[] = [];

  if (Boolean(raw.entradaAtiva) && (Number(raw.valorEntrada) || 0) > 0) {
    installments.push({
      id: createId('par'),
      numero: 1,
      dueDate: parseDueDate(raw.dataEntrada ?? getTodayISO()),
      valor: Number(raw.valorEntrada) || 0,
      paid: false,
      paidAt: '',
    });
  }

  for (let idx = 0; idx < parcelas; idx += 1) {
    const dueDate =
      datesFromRaw[idx] ||
      toISODate(adjustWeekend(new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + step * idx)));
    installments.push({
      id: createId('par'),
      numero: installments.length + 1,
      dueDate,
      valor: valorParcela,
      paid: false,
      paidAt: '',
    });
  }

  return installments;
}

function applyLegacyPaidState(
  installments: FarmaNegotiationInstallment[],
  raw: Record<string, unknown>,
): FarmaNegotiationInstallment[] {
  const legacy = Array.isArray(raw.parcelasPagas) ? (raw.parcelasPagas as unknown[]) : [];
  if (!legacy.length) return installments;
  return installments.map((item, index) => {
    const current = legacy[index];
    if (current && typeof current === 'object') {
      const entry = current as Record<string, unknown>;
      const paid = Boolean(entry.paga ?? entry.paid);
      const paidAtRaw = String(entry.pagoEm ?? entry.paidAt ?? '');
      let paidAt = '';
      if (paidAtRaw) {
        const iso = parseISODate(paidAtRaw);
        if (iso) paidAt = toISODate(iso);
        const br = parseDateBR(paidAtRaw);
        if (br) paidAt = toISODate(br);
      }
      return { ...item, paid, paidAt };
    }
    if (typeof current === 'boolean') return { ...item, paid: current };
    return item;
  });
}

function sanitizeNegotiation(raw: unknown): FarmaNegotiation | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const createdAt = asIso(item.createdAt ?? item.criadoEm);
  const updatedAt = asIso(item.updatedAt ?? item.atualizadoEm ?? createdAt);
  const periodicidade = normalizePeriodicity(item.periodicidade);
  const installmentsRaw = Array.isArray(item.installments) ? (item.installments as unknown[]) : [];
  let installments = installmentsRaw
    .map((entry, index) => parseInstallment(entry, index, 0))
    .filter((entry): entry is FarmaNegotiationInstallment => Boolean(entry));

  if (!installments.length) {
    installments = createInstallments(item, periodicidade);
    installments = applyLegacyPaidState(installments, item);
  }

  const valorNegociadoFallback = installments.reduce((sum, entry) => sum + (entry.valor || 0), 0);
  const status = normalizeStatus(item.status ?? item.situacao);
  const finalizadaAt = status === 'finalizada' ? asIso(item.finalizadaAt ?? item.finalizadaEm ?? updatedAt) : '';
  const canceladaAt = status === 'cancelada' ? asIso(item.canceladaAt ?? item.canceladaEm ?? updatedAt) : '';
  const valorOriginal = Number(item.valorOriginal ?? item.valorDevido) || 0;
  const valorNegociado = Number(item.valorNegociado ?? item.valorTotalNegociado) || valorNegociadoFallback;

  return {
    id: String(item.id || createId('neg')),
    numero: String(item.numero ?? item.numeroNegociacao ?? `NEG-${Date.now().toString().slice(-8)}`),
    clientId: String(item.clientId ?? item.clienteId ?? ''),
    clientSnapshot: normalizeClientSnapshot(item.clientSnapshot ?? item.clienteSnapshot),
    valorOriginal: Math.max(0, valorOriginal),
    multa: Math.max(0, Number(item.multa) || 0),
    juros: Math.max(0, Number(item.juros) || 0),
    valorNegociado: Math.max(0, valorNegociado),
    parcelas: Math.max(1, Number(item.parcelas ?? item.numeroParcelas) || installments.length || 1),
    periodicidade,
    primeiroVencimento:
      installments.find((entry) => entry.valor > 0)?.dueDate ||
      parseDueDate(item.primeiroVencimento ?? item.vencimento ?? getTodayISO()),
    entradaAtiva: Boolean(item.entradaAtiva),
    valorEntrada: Math.max(0, Number(item.valorEntrada) || 0),
    installments,
    status,
    observacoes: String(item.observacoes ?? '').trim(),
    createdAt,
    updatedAt,
    finalizadaAt,
    canceladaAt,
  };
}

function normalizeTransferStatus(raw: unknown): TransferStatus {
  if (raw && typeof raw === 'object') {
    const item = raw as Record<string, unknown>;
    return {
      email: Boolean(item.email),
      creditado: Boolean(item.creditado),
      compensacao: Boolean(item.compensacao),
      finalizado: Boolean(item.finalizado),
    };
  }
  const stage = String(raw || '').toLowerCase();
  if (stage === 'email' || stage === 'creditado' || stage === 'compensacao' || stage === 'finalizado' || stage === 'nenhum') {
    return transferStatusFromStage(stage);
  }
  return transferStatusFromStage('nenhum');
}

function sanitizeTransfer(raw: unknown): FarmaTransfer | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const createdAt = asIso(item.createdAt);
  const updatedAt = asIso(item.updatedAt ?? createdAt);
  return {
    id: String(item.id || createId('tr')),
    codigoCliente: normalizeCodigo(String(item.codigoCliente ?? item.codigo ?? '')),
    nomeCliente: String(item.nomeCliente ?? item.razaoSocial ?? '').trim(),
    cnpj: normalizeCnpj(String(item.cnpj ?? '')),
    valor: Math.max(0, Number(item.valor) || (parseBR(String(item.valorCentavos || '')) / 100) || 0),
    data: parseDueDate(item.data ?? createdAt.slice(0, 10)),
    emailDepositos: String(item.emailDepositos ?? 'depositos@pratidonaduzzi.com.br')
      .trim()
      .toLowerCase(),
    observacoes: String(item.observacoes ?? '').trim(),
    status: normalizeTransferStatus(item.status ?? item.stage),
    createdAt,
    updatedAt,
  };
}

export function loadClients(): FarmaClient[] {
  const next = readArray<unknown>(CLIENTS_KEY)
    .map((item) => sanitizeClient(item))
    .filter((item): item is FarmaClient => Boolean(item));
  writeArray(CLIENTS_KEY, next);
  return next;
}

export function saveClients(items: FarmaClient[]): void {
  const next = items
    .map((item) => sanitizeClient(item))
    .filter((item): item is FarmaClient => Boolean(item));
  writeArray(CLIENTS_KEY, next);
}

export function loadNegotiations(): FarmaNegotiation[] {
  const next = readArray<unknown>(NEGOTIATIONS_KEY)
    .map((item) => sanitizeNegotiation(item))
    .filter((item): item is FarmaNegotiation => Boolean(item));
  writeArray(NEGOTIATIONS_KEY, next);
  return next;
}

export function saveNegotiations(items: FarmaNegotiation[]): void {
  const next = items
    .map((item) => sanitizeNegotiation(item))
    .filter((item): item is FarmaNegotiation => Boolean(item));
  writeArray(NEGOTIATIONS_KEY, next);
}

export function loadTransfers(): FarmaTransfer[] {
  const next = readArray<unknown>(TRANSFERS_KEY)
    .map((item) => sanitizeTransfer(item))
    .filter((item): item is FarmaTransfer => Boolean(item));
  writeArray(TRANSFERS_KEY, next);
  return next;
}

export function saveTransfers(items: FarmaTransfer[]): void {
  const next = items
    .map((item) => sanitizeTransfer(item))
    .filter((item): item is FarmaTransfer => Boolean(item));
  writeArray(TRANSFERS_KEY, next);
}

export type FarmaBackup = {
  version: 'farma-backup-v1';
  exportedAt: string;
  clients: FarmaClient[];
  negotiations: FarmaNegotiation[];
  transfers: FarmaTransfer[];
};

export function exportFarmaBackup(): FarmaBackup {
  return {
    version: 'farma-backup-v1',
    exportedAt: new Date().toISOString(),
    clients: loadClients(),
    negotiations: loadNegotiations(),
    transfers: loadTransfers(),
  };
}

export function importFarmaBackup(payload: unknown): { ok: boolean; message: string } {
  if (!payload || typeof payload !== 'object') return { ok: false, message: 'Arquivo invalido.' };
  const item = payload as Record<string, unknown>;
  const clients = Array.isArray(item.clients) ? item.clients : [];
  const negotiations = Array.isArray(item.negotiations) ? item.negotiations : [];
  const transfers = Array.isArray(item.transfers) ? item.transfers : [];

  saveClients(clients as FarmaClient[]);
  saveNegotiations(negotiations as FarmaNegotiation[]);
  saveTransfers(transfers as FarmaTransfer[]);
  return {
    ok: true,
    message: `Backup importado (${clients.length} clientes, ${negotiations.length} negociacoes, ${transfers.length} transferencias).`,
  };
}
