import type { TransferStage, TransferStatus } from './types';

export function formatMoney(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatBR(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return safe.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function parseMoneyInput(raw: string): number {
  const normalized = String(raw || '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseBR(raw: string): number {
  return parseMoneyInput(raw);
}

export function formatDateTimeBR(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '-';
  return dt.toLocaleString('pt-BR');
}

export function onlyDigits(raw: string): string {
  return String(raw || '').replace(/\D+/g, '');
}

export function formatCnpj(raw: string): string {
  const d = onlyDigits(raw).slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function normalizeCodigo(raw: string): string {
  const digits = onlyDigits(raw).slice(0, 6);
  return digits ? digits.padStart(6, '0') : '';
}

export function normalizeCnpj(raw: string): string {
  return onlyDigits(raw).slice(0, 14);
}

export function maskCnpjValue(raw: string): string {
  const digits = normalizeCnpj(raw);
  if (!digits) return '';
  return formatCnpj(digits);
}

export function createId(prefix: string): string {
  try {
    return `${prefix}-${crypto.randomUUID()}`;
  } catch (_error) {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  }
}

export function parseDateBR(raw: string): Date | null {
  const match = String(raw || '')
    .trim()
    .match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const dt = new Date(year, month - 1, day);
  if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) return null;
  return dt;
}

export function parseISODate(raw: string): Date | null {
  const match = String(raw || '')
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const dt = new Date(year, month - 1, day);
  if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) return null;
  return dt;
}

export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function formatDateBR(date: Date): string {
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

export function formatDateBRFromISO(iso: string): string {
  const dt = parseISODate(iso);
  return dt ? formatDateBR(dt) : '';
}

export function getTodayISO(): string {
  return toISODate(new Date());
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

export function adjustWeekend(date: Date): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = next.getDay();
  if (day === 6) next.setDate(next.getDate() + 2);
  if (day === 0) next.setDate(next.getDate() + 1);
  return next;
}

export function diffDaysFromToday(isoDate: string): number {
  const target = parseISODate(isoDate);
  if (!target) return 0;
  const now = new Date();
  const baseToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const baseTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((baseToday.getTime() - baseTarget.getTime()) / 86_400_000);
}

export function getTransferStage(status: TransferStatus): TransferStage {
  if (status.finalizado) return 'finalizado';
  if (status.compensacao) return 'compensacao';
  if (status.creditado) return 'creditado';
  if (status.email) return 'email';
  return 'nenhum';
}

export function transferStatusFromStage(stage: TransferStage): TransferStatus {
  if (stage === 'finalizado') return { email: true, creditado: true, compensacao: true, finalizado: true };
  if (stage === 'compensacao') return { email: true, creditado: true, compensacao: true, finalizado: false };
  if (stage === 'creditado') return { email: true, creditado: true, compensacao: false, finalizado: false };
  if (stage === 'email') return { email: true, creditado: false, compensacao: false, finalizado: false };
  return { email: false, creditado: false, compensacao: false, finalizado: false };
}

export function getTransferPercent(status: TransferStatus): number {
  const stage = getTransferStage(status);
  if (stage === 'finalizado') return 100;
  if (stage === 'compensacao') return 75;
  if (stage === 'creditado') return 50;
  if (stage === 'email') return 25;
  return 0;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = String(hex || '').replace('#', '');
  if (clean.length !== 6) return null;
  const value = Number.parseInt(clean, 16);
  if (!Number.isFinite(value)) return null;
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

function rgbToHex(rgb: { r: number; g: number; b: number }): string {
  const toHex = (value: number) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

function mixHex(from: string, to: string, ratio: number): string {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  if (!a || !b) return from;
  return rgbToHex({
    r: a.r + (b.r - a.r) * ratio,
    g: a.g + (b.g - a.g) * ratio,
    b: a.b + (b.b - a.b) * ratio,
  });
}

export function getTransferProgressColor(percent: number): string {
  const gray = '#8f9499';
  const green = '#34b36a';
  if (percent >= 100) return mixHex(gray, green, 0.9);
  if (percent >= 75) return mixHex(gray, green, 0.75);
  if (percent >= 50) return mixHex(gray, green, 0.55);
  if (percent >= 25) return mixHex(gray, green, 0.35);
  return gray;
}

export function getTransferStageLabel(stage: TransferStage): string {
  if (stage === 'email') return 'E-mail enviado';
  if (stage === 'creditado') return 'Creditado';
  if (stage === 'compensacao') return 'Compensacao enviada';
  if (stage === 'finalizado') return 'Finalizado';
  return 'Nenhum';
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  }
}
