import { FormEvent, useMemo, useState } from 'react';
import { loadClients, loadNegotiations, saveNegotiations } from './storage';
import type { FarmaNegotiation, NegotiationStatus } from './types';
import { copyToClipboard, createId, formatDateTimeBR, formatMoney, parseMoneyInput } from './utils';

type NegotiationForm = {
  clientId: string;
  valorOriginal: string;
  valorNegociado: string;
  parcelas: string;
  vencimento: string;
  observacoes: string;
};

const emptyForm: NegotiationForm = {
  clientId: '',
  valorOriginal: '',
  valorNegociado: '',
  parcelas: '1',
  vencimento: '',
  observacoes: '',
};

const statusOptions: NegotiationStatus[] = ['andamento', 'finalizada', 'cancelada'];

export function NegociacoesPage() {
  const [clients] = useState(() => loadClients());
  const [items, setItems] = useState<FarmaNegotiation[]>(() => loadNegotiations());
  const [statusFilter, setStatusFilter] = useState<NegotiationStatus | 'todos'>('todos');
  const [form, setForm] = useState<NegotiationForm>(emptyForm);
  const [draftText, setDraftText] = useState('');

  const filtered = useMemo(() => {
    if (statusFilter === 'todos') return items;
    return items.filter((item) => item.status === statusFilter);
  }, [items, statusFilter]);

  const clientMap = useMemo(() => {
    const map = new Map<string, string>();
    clients.forEach((client) => map.set(client.id, client.razao));
    return map;
  }, [clients]);

  const buildText = (item: FarmaNegotiation): string => {
    const clientName = clientMap.get(item.clientId) || 'CLIENTE';
    const linhas = [
      '~~~~~~~~~~~~~~~~ NEGOCIACAO ~~~~~~~~~~~~~~~~',
      `CLIENTE: ${clientName}`,
      `NUMERO: ${item.numero}`,
      `VALOR ORIGINAL: ${formatMoney(item.valorOriginal)}`,
      `VALOR NEGOCIADO: ${formatMoney(item.valorNegociado)}`,
      `PARCELAS: ${item.parcelas}`,
      `VENCIMENTO: ${item.vencimento || '-'}`,
      `STATUS: ${item.status.toUpperCase()}`,
      `OBSERVACOES: ${item.observacoes || '-'}`,
    ];
    return linhas.join('\n');
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.clientId) return;
    const valorOriginal = parseMoneyInput(form.valorOriginal);
    const valorNegociado = parseMoneyInput(form.valorNegociado);
    const parcelas = Math.max(1, Number(form.parcelas) || 1);
    if (valorOriginal <= 0 || valorNegociado <= 0) return;
    const now = new Date().toISOString();
    const numero = `NEG-${new Date().getTime().toString().slice(-8)}`;
    const nextItem: FarmaNegotiation = {
      id: createId('neg'),
      numero,
      clientId: form.clientId,
      valorOriginal,
      valorNegociado,
      parcelas,
      vencimento: form.vencimento,
      status: 'andamento',
      observacoes: form.observacoes.trim(),
      createdAt: now,
      updatedAt: now,
    };
    const next = [nextItem, ...items];
    setItems(next);
    saveNegotiations(next);
    setDraftText(buildText(nextItem));
    setForm(emptyForm);
  };

  const updateStatus = (id: string, status: NegotiationStatus) => {
    const now = new Date().toISOString();
    const next = items.map((item) => (item.id === id ? { ...item, status, updatedAt: now } : item));
    setItems(next);
    saveNegotiations(next);
  };

  return (
    <section>
      <h1>NEGOCIACOES</h1>
      <p>Cadastro e acompanhamento de negociacoes com persistencia no MSCGA.</p>

      <form className="card farma-form" onSubmit={onSubmit}>
        <h2>Nova negociacao</h2>
        <div className="farma-grid-2">
          <label className="farma-span-2">
            Cliente
            <select
              value={form.clientId}
              onChange={(e) => setForm((prev) => ({ ...prev, clientId: e.target.value }))}
              required
            >
              <option value="">Selecione</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.codigo} - {client.razao}
                </option>
              ))}
            </select>
          </label>
          <label>
            Valor original
            <input
              placeholder="0,00"
              value={form.valorOriginal}
              onChange={(e) => setForm((prev) => ({ ...prev, valorOriginal: e.target.value }))}
            />
          </label>
          <label>
            Valor negociado
            <input
              placeholder="0,00"
              value={form.valorNegociado}
              onChange={(e) => setForm((prev) => ({ ...prev, valorNegociado: e.target.value }))}
            />
          </label>
          <label>
            Parcelas
            <input
              type="number"
              min={1}
              value={form.parcelas}
              onChange={(e) => setForm((prev) => ({ ...prev, parcelas: e.target.value }))}
            />
          </label>
          <label>
            Vencimento
            <input
              type="date"
              value={form.vencimento}
              onChange={(e) => setForm((prev) => ({ ...prev, vencimento: e.target.value }))}
            />
          </label>
          <label className="farma-span-2">
            Observacoes
            <textarea
              value={form.observacoes}
              onChange={(e) => setForm((prev) => ({ ...prev, observacoes: e.target.value }))}
            />
          </label>
        </div>
        <div className="farma-actions">
          <button type="submit">Salvar negociacao</button>
        </div>
      </form>

      <section className="card farma-form">
        <h2>Texto da negociacao</h2>
        <textarea value={draftText} readOnly />
        <div className="farma-actions">
          <button type="button" onClick={() => copyToClipboard(draftText)}>
            Copiar texto
          </button>
        </div>
      </section>

      <section className="card farma-list">
        <div className="farma-list-header">
          <h2>Negociacoes</h2>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as NegotiationStatus | 'todos')}
          >
            <option value="todos">Todos</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
        <div className="farma-table-wrap">
          <table className="farma-table">
            <thead>
              <tr>
                <th>Numero</th>
                <th>Cliente</th>
                <th>Negociado</th>
                <th>Parcelas</th>
                <th>Status</th>
                <th>Atualizado</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td>{item.numero}</td>
                  <td>{clientMap.get(item.clientId) || '-'}</td>
                  <td>{formatMoney(item.valorNegociado)}</td>
                  <td>{item.parcelas}</td>
                  <td>{item.status}</td>
                  <td>{formatDateTimeBR(item.updatedAt)}</td>
                  <td>
                    <div className="farma-inline-actions">
                      {statusOptions.map((status) => (
                        <button key={status} type="button" onClick={() => updateStatus(item.id, status)}>
                          {status}
                        </button>
                      ))}
                      <button type="button" onClick={() => setDraftText(buildText(item))}>
                        Gerar texto
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7}>Nenhuma negociacao para o filtro selecionado.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
