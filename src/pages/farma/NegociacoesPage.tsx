import { FormEvent, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadClients, loadNegotiations, saveNegotiations } from './storage';
import type {
  FarmaNegotiation,
  FarmaNegotiationClientSnapshot,
  FarmaNegotiationInstallment,
  NegotiationPeriodicity,
  NegotiationStatus,
} from './types';
import {
  addDays,
  adjustWeekend,
  copyToClipboard,
  createId,
  diffDaysFromToday,
  formatBR,
  formatDateBRFromISO,
  getTodayISO,
  maskCnpjValue,
  normalizeCnpj,
  normalizeCodigo,
  parseBR,
  parseISODate,
  toISODate,
} from './utils';

const PREFILL_KEY = 'mscga_farma_compensacao_prefill_v1';

type NegotiationForm = {
  noIdentificar: boolean;
  clientId: string;
  manualCodigo: string;
  manualCnpj: string;
  manualRazao: string;
  manualRepresentante: string;
  manualContato: string;
  valorOriginal: string;
  multa: string;
  juros: string;
  parcelas: string;
  periodicidade: NegotiationPeriodicity;
  primeiroVencimento: string;
  entradaAtiva: boolean;
  valorEntrada: string;
  numero: string;
  observacoes: string;
};

const emptyForm: NegotiationForm = {
  noIdentificar: false,
  clientId: '',
  manualCodigo: '',
  manualCnpj: '',
  manualRazao: '',
  manualRepresentante: '',
  manualContato: '',
  valorOriginal: '',
  multa: '',
  juros: '',
  parcelas: '1',
  periodicidade: 'semanal',
  primeiroVencimento: getTodayISO(),
  entradaAtiva: false,
  valorEntrada: '',
  numero: '',
  observacoes: '',
};

function periodicityStep(periodicidade: NegotiationPeriodicity): number {
  if (periodicidade === 'quinzenal') return 15;
  if (periodicidade === 'mensal') return 30;
  return 7;
}

function nextStatusFromInstallments(item: FarmaNegotiation): NegotiationStatus {
  const total = item.installments.length;
  const paid = item.installments.filter((entry) => entry.paid).length;
  if (total > 0 && paid === total) return 'finalizada';
  if (item.status === 'cancelada') return 'cancelada';
  return 'andamento';
}

function buildNegotiationText(item: FarmaNegotiation): string {
  const lines = item.installments.map((entry) => {
    const value = formatBR(entry.valor);
    const isDate = /^\d{4}-\d{2}-\d{2}$/.test(entry.paidAt);
    const paidAt = isDate ? formatDateBRFromISO(entry.paidAt) : 'X';
    const padVal = Math.max(0, 11 - Math.max(0, value.length - 6));
    const padPaid = Math.max(0, 18 - (isDate ? 7 : 0));
    return `${String(entry.numero).padStart(2, '0')}${' '.repeat(19)}${formatDateBRFromISO(entry.dueDate)}${' '.repeat(padVal)}${value}${' '.repeat(
      padPaid,
    )}${paidAt}`;
  });
  const total = item.installments.reduce((sum, entry) => sum + (entry.valor || 0), 0);
  return [
    '~~~~~~~~~~~~~~~~ NEGOCIACAO ~~~~~~~~~~~~~~~~',
    'Nº PARCELA    DATA VENCTO.     VLR. BASE       DATA PAGTO.  ',
    ...lines,
    '------------------------------',
    `**************** VALOR TOTAL: ${formatBR(total)}  `,
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
  ].join('\n');
}

function buildCobrancaText(item: FarmaNegotiation): string {
  const parcelas = item.installments.filter((entry) => !entry.paid);
  const vencidasOuHoje = parcelas.filter((entry) => diffDaysFromToday(entry.dueDate) >= 0);
  const total = item.installments.length;
  const paidCount = item.installments.filter((entry) => entry.paid).length;
  const parcelaAtual = total === 0 ? 0 : paidCount >= total ? total : paidCount + 1;
  const saudacao = new Date().getHours() < 12 ? '*Bom dia*' : '*Boa tarde*';

  if (vencidasOuHoje.length > 1) {
    const bullets = vencidasOuHoje
      .sort((a, b) => a.numero - b.numero)
      .map((entry) => {
        const atraso = diffDaysFromToday(entry.dueDate);
        const idx = `\`${entry.numero}\`/\`${total}\``;
        if (atraso > 0) return `- Parcela ${idx} com o valor de \`R$ ${formatBR(entry.valor)}\` esta em atraso ha \`${atraso}\` dia(s);`;
        return `- Parcela ${idx} com valor de \`R$ ${formatBR(entry.valor)}\` vence *hoje*;`;
      })
      .join('\n');
    return `${saudacao}, as seguintes parcelas estao em atraso:\n${bullets}\nPara evitar o *cancelamento da negociacao*, por gentileza, efetue a transferencia *ainda hoje*!`;
  }

  const target = vencidasOuHoje[0] || parcelas[0];
  if (!target) return `${saudacao}, negociacao sem parcelas pendentes.`;
  const atraso = Math.max(0, diffDaysFromToday(target.dueDate));
  const parcelaLabel = `\`${parcelaAtual}\`/\`${total}\``;
  if (atraso === 0) {
    return `${saudacao}, a parcela ${parcelaLabel} com valor de \`R$ ${formatBR(target.valor)}\` vence *hoje*, posso contar com a transferencia *ate o fim do dia*?`;
  }
  return `${saudacao}, a parcela ${parcelaLabel} com o valor de \`R$ ${formatBR(target.valor)}\` esta em atraso ha \`${atraso}\` dia(s), para evitar o *cancelamento da negociacao*, por gentileza, efetue a transferencia *ainda hoje*!`;
}

function negotiationDays(item: FarmaNegotiation): number {
  if (item.status === 'finalizada' && item.finalizadaAt) return diffDaysFromToday(item.finalizadaAt.slice(0, 10));
  if (item.status === 'cancelada' && item.canceladaAt) return diffDaysFromToday(item.canceladaAt.slice(0, 10));
  const open = item.installments.find((entry) => !entry.paid);
  if (!open) return 0;
  return diffDaysFromToday(open.dueDate);
}

export function NegociacoesPage() {
  const navigate = useNavigate();
  const [clients] = useState(() => loadClients());
  const [items, setItems] = useState<FarmaNegotiation[]>(() => loadNegotiations());
  const [statusFilter, setStatusFilter] = useState<NegotiationStatus | 'todos'>('todos');
  const [form, setForm] = useState<NegotiationForm>(emptyForm);
  const [expandedId, setExpandedId] = useState('');
  const [message, setMessage] = useState('');

  const clientMap = useMemo(() => {
    const map = new Map<string, { razao: string; codigo: string; cnpj: string; representante: string; contato: string }>();
    clients.forEach((client) => {
      map.set(client.id, {
        razao: client.razao,
        codigo: client.codigo,
        cnpj: client.cnpj,
        representante: client.representante,
        contato: client.contato,
      });
    });
    return map;
  }, [clients]);

  const filtered = useMemo(() => {
    if (statusFilter === 'todos') return items;
    return items.filter((item) => item.status === statusFilter);
  }, [items, statusFilter]);

  const save = (next: FarmaNegotiation[]) => {
    setItems(next);
    saveNegotiations(next);
  };

  const clearForm = () => {
    setForm({ ...emptyForm, primeiroVencimento: getTodayISO() });
  };

  const createClientSnapshot = (): { clientId: string; snapshot: FarmaNegotiationClientSnapshot } | null => {
    if (form.noIdentificar) {
      const codigo = normalizeCodigo(form.manualCodigo);
      const cnpj = normalizeCnpj(form.manualCnpj);
      if (!codigo || cnpj.length !== 14) {
        setMessage('No modo "nao identificar", informe codigo e CNPJ validos.');
        return null;
      }
      return {
        clientId: `manual:${codigo}:${cnpj}`,
        snapshot: {
          codigo,
          cnpj,
          razao: form.manualRazao.trim(),
          representante: form.manualRepresentante.trim(),
          contato: form.manualContato.trim(),
        },
      };
    }
    const selected = clients.find((client) => client.id === form.clientId);
    if (!selected) {
      setMessage('Selecione um cliente.');
      return null;
    }
    return {
      clientId: selected.id,
      snapshot: {
        codigo: selected.codigo,
        cnpj: selected.cnpj,
        razao: selected.razao,
        representante: selected.representante,
        contato: selected.contato,
      },
    };
  };

  const generateInstallments = (
    parcelas: number,
    periodicidade: NegotiationPeriodicity,
    primeiroVencimento: string,
    valorParcela: number,
    entradaAtiva: boolean,
    valorEntrada: number,
  ): FarmaNegotiationInstallment[] => {
    const list: FarmaNegotiationInstallment[] = [];
    if (entradaAtiva && valorEntrada > 0) {
      list.push({
        id: createId('par'),
        numero: 1,
        dueDate: getTodayISO(),
        valor: valorEntrada,
        paid: false,
        paidAt: '',
      });
    }
    const start = parseISODate(primeiroVencimento) ?? new Date();
    const step = periodicityStep(periodicidade);
    for (let index = 0; index < parcelas; index += 1) {
      const shifted = adjustWeekend(addDays(start, step * index));
      list.push({
        id: createId('par'),
        numero: list.length + 1,
        dueDate: toISODate(shifted),
        valor: valorParcela,
        paid: false,
        paidAt: '',
      });
    }
    return list;
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setMessage('');
    const clientData = createClientSnapshot();
    if (!clientData) return;

    const valorOriginal = parseBR(form.valorOriginal);
    const multa = parseBR(form.multa);
    const juros = parseBR(form.juros);
    const parcelas = Math.max(1, Number(form.parcelas) || 1);
    const valorEntrada = form.entradaAtiva ? parseBR(form.valorEntrada) : 0;
    const primeiroVencimento = form.primeiroVencimento;
    if (!parseISODate(primeiroVencimento)) {
      setMessage('Informe a data do primeiro pagamento.');
      return;
    }
    if (valorOriginal <= 0) {
      setMessage('Valor devido precisa ser maior que zero.');
      return;
    }

    const totalBase = Math.max(0, valorOriginal + multa + juros - valorEntrada);
    const valorParcela = Math.ceil(totalBase / parcelas);
    const installments = generateInstallments(
      parcelas,
      form.periodicidade,
      primeiroVencimento,
      valorParcela,
      form.entradaAtiva,
      valorEntrada,
    );
    const valorNegociado = installments.reduce((sum, entry) => sum + (entry.valor || 0), 0);

    const now = new Date().toISOString();
    const nextItem: FarmaNegotiation = {
      id: createId('neg'),
      numero: form.numero.trim() || `NEG-${Date.now().toString().slice(-8)}`,
      clientId: clientData.clientId,
      clientSnapshot: clientData.snapshot,
      valorOriginal,
      multa,
      juros,
      valorNegociado,
      parcelas,
      periodicidade: form.periodicidade,
      primeiroVencimento,
      entradaAtiva: form.entradaAtiva,
      valorEntrada,
      installments,
      status: 'andamento',
      observacoes: form.observacoes.trim(),
      createdAt: now,
      updatedAt: now,
      finalizadaAt: '',
      canceladaAt: '',
    };

    const next = [nextItem, ...items];
    save(next);
    clearForm();
    setExpandedId(nextItem.id);
    setMessage('Negociacao registrada.');
  };

  const updateItem = (id: string, mutator: (item: FarmaNegotiation) => FarmaNegotiation) => {
    const now = new Date().toISOString();
    const next = items.map((item) => {
      if (item.id !== id) return item;
      const updated = mutator({ ...item, installments: item.installments.map((entry) => ({ ...entry })) });
      updated.updatedAt = now;
      return updated;
    });
    save(next);
  };

  const changeStatus = (id: string, status: NegotiationStatus) => {
    updateItem(id, (item) => {
      item.status = status;
      if (status === 'finalizada') item.finalizadaAt = new Date().toISOString();
      if (status === 'cancelada') item.canceladaAt = new Date().toISOString();
      if (status === 'andamento') {
        item.finalizadaAt = '';
        item.canceladaAt = '';
      }
      return item;
    });
  };

  const toggleInstallment = (id: string, installmentId: string, paid: boolean) => {
    updateItem(id, (item) => {
      item.installments = item.installments.map((entry) =>
        entry.id === installmentId ? { ...entry, paid, paidAt: paid ? getTodayISO() : '' } : entry,
      );
      item.status = nextStatusFromInstallments(item);
      if (item.status === 'finalizada' && !item.finalizadaAt) item.finalizadaAt = new Date().toISOString();
      if (item.status !== 'finalizada') item.finalizadaAt = '';
      return item;
    });
  };

  const changeInstallmentDate = (id: string, installmentId: string, paidAt: string) => {
    updateItem(id, (item) => {
      item.installments = item.installments.map((entry) =>
        entry.id === installmentId ? { ...entry, paid: Boolean(paidAt), paidAt } : entry,
      );
      item.status = nextStatusFromInstallments(item);
      if (item.status === 'finalizada' && !item.finalizadaAt) item.finalizadaAt = new Date().toISOString();
      if (item.status !== 'finalizada') item.finalizadaAt = '';
      return item;
    });
  };

  const removeItem = (id: string) => {
    const next = items.filter((item) => item.id !== id);
    save(next);
    if (expandedId === id) setExpandedId('');
  };

  const openCompensacoes = (item: FarmaNegotiation) => {
    sessionStorage.setItem(
      PREFILL_KEY,
      JSON.stringify({
        mode: 'negociacao',
        negociacao: buildNegotiationText(item),
        multa: item.multa,
        juros: item.juros,
        parcelas: item.parcelas,
      }),
    );
    navigate('/farma/compensacoes');
  };

  return (
    <section>
      <h1>NEGOCIACOES</h1>
      <p>Controle operacional de negociacoes com parcelas, status, cobranca e integracao com compensacoes.</p>

      <form className="card farma-form" onSubmit={onSubmit}>
        <h2>Nova negociacao</h2>
        <div className="farma-grid-2">
          <label className="farma-span-2">
            <input
              type="checkbox"
              checked={form.noIdentificar}
              onChange={(event) => setForm((prev) => ({ ...prev, noIdentificar: event.target.checked }))}
            />{' '}
            Nao identificar (salvar sem cliente cadastrado)
          </label>

          {form.noIdentificar ? (
            <>
              <label>
                Codigo cliente
                <input
                  value={form.manualCodigo}
                  onChange={(event) => setForm((prev) => ({ ...prev, manualCodigo: normalizeCodigo(event.target.value) }))}
                />
              </label>
              <label>
                CNPJ
                <input
                  value={maskCnpjValue(form.manualCnpj)}
                  onChange={(event) => setForm((prev) => ({ ...prev, manualCnpj: normalizeCnpj(event.target.value) }))}
                />
              </label>
              <label>
                Razao social
                <input value={form.manualRazao} onChange={(event) => setForm((prev) => ({ ...prev, manualRazao: event.target.value }))} />
              </label>
              <label>
                Representante
                <input
                  value={form.manualRepresentante}
                  onChange={(event) => setForm((prev) => ({ ...prev, manualRepresentante: event.target.value }))}
                />
              </label>
              <label className="farma-span-2">
                Contato
                <input
                  value={form.manualContato}
                  onChange={(event) => setForm((prev) => ({ ...prev, manualContato: event.target.value }))}
                />
              </label>
            </>
          ) : (
            <label className="farma-span-2">
              Cliente
              <select value={form.clientId} onChange={(event) => setForm((prev) => ({ ...prev, clientId: event.target.value }))}>
                <option value="">Selecione</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.codigo} - {client.razao}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label>
            Valor devido
            <input value={form.valorOriginal} onChange={(event) => setForm((prev) => ({ ...prev, valorOriginal: event.target.value }))} />
          </label>
          <label>
            Numero negociacao
            <input value={form.numero} onChange={(event) => setForm((prev) => ({ ...prev, numero: event.target.value }))} />
          </label>
          <label>
            Multa
            <input value={form.multa} onChange={(event) => setForm((prev) => ({ ...prev, multa: event.target.value }))} />
          </label>
          <label>
            Juros
            <input value={form.juros} onChange={(event) => setForm((prev) => ({ ...prev, juros: event.target.value }))} />
          </label>
          <label>
            Parcelas
            <input
              type="number"
              min={1}
              value={form.parcelas}
              onChange={(event) => setForm((prev) => ({ ...prev, parcelas: event.target.value }))}
            />
          </label>
          <label>
            Periodicidade
            <select
              value={form.periodicidade}
              onChange={(event) => setForm((prev) => ({ ...prev, periodicidade: event.target.value as NegotiationPeriodicity }))}
            >
              <option value="semanal">Semanal</option>
              <option value="quinzenal">Quinzenal</option>
              <option value="mensal">Mensal</option>
            </select>
          </label>
          <label>
            Primeiro pagamento
            <input
              type="date"
              value={form.primeiroVencimento}
              onChange={(event) => setForm((prev) => ({ ...prev, primeiroVencimento: event.target.value }))}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={form.entradaAtiva}
              onChange={(event) => setForm((prev) => ({ ...prev, entradaAtiva: event.target.checked }))}
            />{' '}
            Com entrada
          </label>
          {form.entradaAtiva ? (
            <label>
              Valor entrada
              <input value={form.valorEntrada} onChange={(event) => setForm((prev) => ({ ...prev, valorEntrada: event.target.value }))} />
            </label>
          ) : null}
          <label className="farma-span-2">
            Observacoes
            <textarea value={form.observacoes} onChange={(event) => setForm((prev) => ({ ...prev, observacoes: event.target.value }))} />
          </label>
        </div>
        <div className="farma-actions">
          <button type="submit">Salvar negociacao</button>
          <button type="button" className="farma-btn-secondary" onClick={clearForm}>
            Limpar
          </button>
        </div>
        {message ? <p>{message}</p> : null}
      </form>

      <section className="card farma-list">
        <div className="farma-list-header">
          <h2>Negociacoes ({items.length})</h2>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as NegotiationStatus | 'todos')}>
            <option value="todos">Todos</option>
            <option value="andamento">Andamento</option>
            <option value="finalizada">Finalizada</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </div>

        <div className="farma-table-wrap">
          <table className="farma-table">
            <thead>
              <tr>
                <th>Numero</th>
                <th>Cliente</th>
                <th>Parcelas</th>
                <th>Dias</th>
                <th>Valor total</th>
                <th>Status</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const snapshot = item.clientSnapshot || clientMap.get(item.clientId) || null;
                const paid = item.installments.filter((entry) => entry.paid).length;
                const total = item.installments.length || 1;
                const percent = Math.round((paid / total) * 100);
                const days = negotiationDays(item);
                const isExpanded = expandedId === item.id;
                return (
                  <tr key={item.id}>
                    <td>{item.numero}</td>
                    <td>
                      <strong>{snapshot?.razao || '-'}</strong>
                      <br />
                      <small>
                        {(snapshot?.codigo || '-') + ' | ' + (snapshot?.cnpj ? maskCnpjValue(snapshot.cnpj) : '-')}
                      </small>
                    </td>
                    <td>{`${paid}/${total}`}</td>
                    <td>{days}</td>
                    <td>{`R$ ${formatBR(item.valorNegociado)}`}</td>
                    <td>
                      <select value={item.status} onChange={(event) => changeStatus(item.id, event.target.value as NegotiationStatus)}>
                        <option value="andamento">andamento</option>
                        <option value="finalizada">finalizada</option>
                        <option value="cancelada">cancelada</option>
                      </select>
                    </td>
                    <td>
                      <div className="farma-inline-actions">
                        <button type="button" onClick={() => setExpandedId(isExpanded ? '' : item.id)}>
                          {isExpanded ? 'Fechar' : 'Detalhes'}
                        </button>
                        <button type="button" onClick={() => copyToClipboard(buildNegotiationText(item))}>
                          Texto
                        </button>
                        <button type="button" onClick={() => copyToClipboard(buildCobrancaText(item))}>
                          Cobranca
                        </button>
                        <button type="button" onClick={() => openCompensacoes(item)}>
                          Compensacoes
                        </button>
                        <button type="button" className="farma-btn-danger" onClick={() => removeItem(item.id)}>
                          Excluir
                        </button>
                      </div>
                      <div className="farma-progress" title={`${percent}%`}>
                        <div className="farma-progress-fill" style={{ width: `${percent}%` }} />
                        <span>{`${percent}%`}</span>
                      </div>

                      {isExpanded ? (
                        <section className="farma-neg-details">
                          <p>{item.observacoes || '-'}</p>
                          <div className="farma-table-wrap">
                            <table className="farma-table farma-table-compact">
                              <thead>
                                <tr>
                                  <th>Parcela</th>
                                  <th>Vencimento</th>
                                  <th>Valor</th>
                                  <th>Paga</th>
                                  <th>Pago em</th>
                                </tr>
                              </thead>
                              <tbody>
                                {item.installments.map((entry) => (
                                  <tr key={entry.id}>
                                    <td>{entry.numero}</td>
                                    <td>{formatDateBRFromISO(entry.dueDate)}</td>
                                    <td>{`R$ ${formatBR(entry.valor)}`}</td>
                                    <td>
                                      <input
                                        type="checkbox"
                                        checked={entry.paid}
                                        disabled={item.status !== 'andamento'}
                                        onChange={(event) => toggleInstallment(item.id, entry.id, event.target.checked)}
                                      />
                                    </td>
                                    <td>
                                      <input
                                        type="date"
                                        value={entry.paidAt}
                                        disabled={item.status !== 'andamento'}
                                        onChange={(event) => changeInstallmentDate(item.id, entry.id, event.target.value)}
                                      />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </section>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
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

