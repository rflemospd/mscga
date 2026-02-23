import { FormEvent, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadClients, loadTransfers, saveTransfers } from './storage';
import type { FarmaTransfer, TransferStatus } from './types';
import {
  copyToClipboard,
  createId,
  diffDaysFromToday,
  formatBR,
  formatDateBRFromISO,
  getTodayISO,
  getTransferPercent,
  getTransferProgressColor,
  getTransferStage,
  getTransferStageLabel,
  maskCnpjValue,
  normalizeCnpj,
  normalizeCodigo,
  parseBR,
} from './utils';

type TransferForm = {
  noIdentificar: boolean;
  codigoCliente: string;
  cnpj: string;
  nomeCliente: string;
  valor: string;
  data: string;
  emailDepositos: string;
  observacoes: string;
};

const emptyForm: TransferForm = {
  noIdentificar: false,
  codigoCliente: '',
  cnpj: '',
  nomeCliente: '',
  valor: '',
  data: getTodayISO(),
  emailDepositos: 'depositos@pratidonaduzzi.com.br',
  observacoes: '',
};

const emptyStatus: TransferStatus = {
  email: false,
  creditado: false,
  compensacao: false,
  finalizado: false,
};

function normalizeStatus(status: TransferStatus): TransferStatus {
  if (status.finalizado) return { email: true, creditado: true, compensacao: true, finalizado: true };
  if (status.compensacao) return { email: true, creditado: true, compensacao: true, finalizado: false };
  if (status.creditado) return { email: true, creditado: true, compensacao: false, finalizado: false };
  if (status.email) return { email: true, creditado: false, compensacao: false, finalizado: false };
  return { ...emptyStatus };
}

export function TransferenciasPage() {
  const navigate = useNavigate();
  const [clients] = useState(() => loadClients());
  const [items, setItems] = useState<FarmaTransfer[]>(() => loadTransfers());
  const [form, setForm] = useState<TransferForm>(emptyForm);
  const [selectedId, setSelectedId] = useState('');
  const [showKpi, setShowKpi] = useState(false);
  const [message, setMessage] = useState('');

  const save = (next: FarmaTransfer[]) => {
    setItems(next);
    saveTransfers(next);
  };

  const findClient = () => {
    if (form.noIdentificar) return;
    const code = normalizeCodigo(form.codigoCliente);
    const cnpj = normalizeCnpj(form.cnpj);
    const match = clients.find((client) => client.codigo === code || client.cnpj === cnpj);
    if (!match) {
      setMessage('Cliente nao encontrado no cadastro.');
      return;
    }
    setForm((prev) => ({
      ...prev,
      codigoCliente: match.codigo,
      cnpj: match.cnpj,
      nomeCliente: match.razao,
    }));
    setMessage(`Cliente localizado: ${match.razao}.`);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setMessage('');

    const codigoCliente = normalizeCodigo(form.codigoCliente);
    const cnpj = normalizeCnpj(form.cnpj);
    const nomeCliente = form.nomeCliente.trim();
    const valor = parseBR(form.valor);
    const data = form.data || getTodayISO();

    if (!form.noIdentificar && (!codigoCliente || cnpj.length !== 14 || !nomeCliente)) {
      setMessage('Informe codigo, CNPJ e nome do cliente.');
      return;
    }
    if (form.noIdentificar && (!codigoCliente || cnpj.length !== 14)) {
      setMessage('No modo "nao identificar", informe codigo e CNPJ validos.');
      return;
    }
    if (valor <= 0) {
      setMessage('Valor invalido.');
      return;
    }

    const now = new Date().toISOString();
    const nextItem: FarmaTransfer = {
      id: createId('tr'),
      codigoCliente,
      nomeCliente: nomeCliente || '-',
      cnpj,
      valor,
      data,
      emailDepositos: form.emailDepositos.trim().toLowerCase() || 'depositos@pratidonaduzzi.com.br',
      observacoes: form.observacoes.trim(),
      status: { ...emptyStatus },
      createdAt: now,
      updatedAt: now,
    };
    const next = [nextItem, ...items];
    save(next);
    setForm({ ...emptyForm, emailDepositos: form.emailDepositos.trim().toLowerCase() || emptyForm.emailDepositos });
    setSelectedId(nextItem.id);
    setMessage('Transferencia cadastrada.');
  };

  const updateItem = (id: string, mutator: (item: FarmaTransfer) => FarmaTransfer) => {
    const now = new Date().toISOString();
    const next = items.map((item) => (item.id === id ? { ...mutator({ ...item }), updatedAt: now } : item));
    save(next);
  };

  const updateStatus = (id: string, status: TransferStatus) => {
    updateItem(id, (item) => ({ ...item, status: normalizeStatus(status) }));
  };

  const removeItem = (id: string) => {
    const next = items.filter((item) => item.id !== id);
    save(next);
    if (selectedId === id) setSelectedId('');
  };

  const emailText = (item: FarmaTransfer): string => {
    const codigo = item.codigoCliente || '-';
    const cnpj = maskCnpjValue(item.cnpj) || '-';
    const valor = `R$ ${formatBR(item.valor)}`;
    const razao = item.nomeCliente || '-';
    return [
      'Prezados(as),',
      '',
      'Segue em anexo o comprovante de transferencia:',
      '',
      `Razao Social: ${razao}`,
      `Codigo: ${codigo}`,
      `CNPJ: ${cnpj}`,
      `Valor: ${valor}`,
      '',
      'Atenciosamente,',
    ].join('\n');
  };

  const esferaText = (item: FarmaTransfer): string => {
    const valor = `R$ ${formatBR(item.valor)}`;
    return `CLIENTE ENVIOU O COMPROVANTE DE TRANSFERENCIA NO VALOR DE ${valor} VIA WHATSAPP, O COMPROVANTE FOI DEVIDAMENTE ENVIADO POR E-MAIL PARA A EQUIPE DE DEPOSITOS (${item.emailDepositos});`;
  };

  const exportTsv = async () => {
    const header = ['CODIGO', 'CNPJ', 'VALOR', 'DATA', 'STATUS'].join('\t');
    const rows = items.map((item) =>
      [
        item.codigoCliente || '-',
        maskCnpjValue(item.cnpj) || '-',
        `R$ ${formatBR(item.valor)}`,
        formatDateBRFromISO(item.data),
        getTransferStageLabel(getTransferStage(item.status)),
      ].join('\t'),
    );
    await copyToClipboard([header, ...rows].join('\r\n'));
    setMessage('Tabela copiada para a area de transferencia.');
  };

  const kpi = useMemo(() => {
    const count = items.length;
    const total = items.reduce((sum, item) => sum + item.valor, 0);
    const values = items.map((item) => item.valor).sort((a, b) => a - b);
    const median = values.length
      ? values.length % 2 === 1
        ? values[Math.floor(values.length / 2)]
        : (values[values.length / 2 - 1] + values[values.length / 2]) / 2
      : 0;
    const pending = items.filter((item) => !item.status.finalizado).reduce((sum, item) => sum + item.valor, 0);
    const stage = {
      nenhum: 0,
      email: 0,
      creditado: 0,
      compensacao: 0,
      finalizado: 0,
    };
    items.forEach((item) => {
      const current = getTransferStage(item.status);
      stage[current] += 1;
    });
    const distinctDays = new Set(items.map((item) => item.data)).size || 1;
    return {
      count,
      total,
      avgTicket: count ? total / count : 0,
      avgPerDay: count / distinctDays,
      pending,
      median,
      max: values.length ? values[values.length - 1] : 0,
      min: values.length ? values[0] : 0,
      stage,
    };
  }, [items]);

  return (
    <section>
      <h1>TRANSFERENCIAS</h1>
      <p>Fluxo operacional com progresso por status, textos, exportacao e KPIs.</p>

      <form className="card farma-form" onSubmit={onSubmit}>
        <h2>Nova transferencia</h2>
        <div className="farma-grid-2">
          <label className="farma-span-2">
            <input
              type="checkbox"
              checked={form.noIdentificar}
              onChange={(event) => setForm((prev) => ({ ...prev, noIdentificar: event.target.checked }))}
            />{' '}
            Nao identificar
          </label>
          <label>
            Codigo cliente
            <input
              value={form.codigoCliente}
              onChange={(event) => setForm((prev) => ({ ...prev, codigoCliente: normalizeCodigo(event.target.value) }))}
            />
          </label>
          <label>
            CNPJ
            <input value={maskCnpjValue(form.cnpj)} onChange={(event) => setForm((prev) => ({ ...prev, cnpj: normalizeCnpj(event.target.value) }))} />
          </label>
          <label className="farma-span-2">
            Nome cliente
            <input
              value={form.nomeCliente}
              disabled={form.noIdentificar}
              onChange={(event) => setForm((prev) => ({ ...prev, nomeCliente: event.target.value }))}
            />
          </label>
          <label>
            Valor
            <input value={form.valor} onChange={(event) => setForm((prev) => ({ ...prev, valor: event.target.value }))} placeholder="0,00" />
          </label>
          <label>
            Data
            <input type="date" value={form.data} onChange={(event) => setForm((prev) => ({ ...prev, data: event.target.value }))} />
          </label>
          <label className="farma-span-2">
            E-mail depositos
            <input
              type="email"
              value={form.emailDepositos}
              onChange={(event) => setForm((prev) => ({ ...prev, emailDepositos: event.target.value }))}
            />
          </label>
          <label className="farma-span-2">
            Observacoes
            <textarea value={form.observacoes} onChange={(event) => setForm((prev) => ({ ...prev, observacoes: event.target.value }))} />
          </label>
        </div>
        <div className="farma-actions">
          <button type="button" className="farma-btn-secondary" onClick={findClient}>
            Buscar cliente
          </button>
          <button type="submit">Salvar transferencia</button>
          <button type="button" className="farma-btn-secondary" onClick={exportTsv}>
            Exportar tabela
          </button>
          <button type="button" className="farma-btn-secondary" onClick={() => setShowKpi((prev) => !prev)}>
            {showKpi ? 'Ocultar KPIs' : 'Mostrar KPIs'}
          </button>
        </div>
        {message ? <p>{message}</p> : null}
      </form>

      {showKpi ? (
        <section className="card farma-kpi-grid">
          <div className="farma-kpi-card">
            <strong>N. transferencias</strong>
            <span>{kpi.count}</span>
          </div>
          <div className="farma-kpi-card">
            <strong>Soma total</strong>
            <span>{`R$ ${formatBR(kpi.total)}`}</span>
          </div>
          <div className="farma-kpi-card">
            <strong>Ticket medio</strong>
            <span>{`R$ ${formatBR(kpi.avgTicket)}`}</span>
          </div>
          <div className="farma-kpi-card">
            <strong>Media por dia</strong>
            <span>{kpi.avgPerDay.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</span>
          </div>
          <div className="farma-kpi-card">
            <strong>Pendente</strong>
            <span>{`R$ ${formatBR(kpi.pending)}`}</span>
          </div>
          <div className="farma-kpi-card">
            <strong>Mediana</strong>
            <span>{`R$ ${formatBR(kpi.median)}`}</span>
          </div>
          <div className="farma-kpi-card">
            <strong>Max / Min</strong>
            <span>{`R$ ${formatBR(kpi.max)} / R$ ${formatBR(kpi.min)}`}</span>
          </div>
          <div className="farma-kpi-card">
            <strong>Estagios</strong>
            <span>{`${kpi.stage.nenhum}/${kpi.stage.email}/${kpi.stage.creditado}/${kpi.stage.compensacao}/${kpi.stage.finalizado}`}</span>
          </div>
        </section>
      ) : null}

      <section className="card farma-list">
        <h2>Transferencias ({items.length})</h2>
        <div className="farma-table-wrap">
          <table className="farma-table">
            <thead>
              <tr>
                <th>Codigo</th>
                <th>CNPJ</th>
                <th>Valor</th>
                <th>Data</th>
                <th>Dias</th>
                <th>Progresso</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const stage = getTransferStage(item.status);
                const percent = getTransferPercent(item.status);
                const color = getTransferProgressColor(percent);
                const isSelected = selectedId === item.id;
                return (
                  <tr key={item.id}>
                    <td>{item.codigoCliente || '-'}</td>
                    <td>{maskCnpjValue(item.cnpj) || '-'}</td>
                    <td>{`R$ ${formatBR(item.valor)}`}</td>
                    <td>{formatDateBRFromISO(item.data)}</td>
                    <td>{diffDaysFromToday(item.data)}</td>
                    <td>
                      <div className="farma-progress" title={getTransferStageLabel(stage)}>
                        <div className="farma-progress-fill" style={{ width: `${percent}%`, backgroundColor: color }} />
                        <span>{`${percent}%`}</span>
                      </div>
                    </td>
                    <td>
                      <div className="farma-inline-actions">
                        <button type="button" onClick={() => setSelectedId(isSelected ? '' : item.id)}>
                          {isSelected ? 'Fechar' : 'Detalhes'}
                        </button>
                        <button type="button" onClick={() => removeItem(item.id)} className="farma-btn-danger">
                          Excluir
                        </button>
                      </div>

                      {isSelected ? (
                        <section className="farma-transfer-details">
                          <p>
                            <strong>{item.nomeCliente || '-'}</strong>
                            <br />
                            {item.observacoes || '-'}
                          </p>
                          <div className="farma-grid-2">
                            <label>
                              <input
                                type="checkbox"
                                checked={item.status.email}
                                onChange={(event) =>
                                  updateStatus(item.id, {
                                    ...item.status,
                                    email: event.target.checked,
                                    creditado: event.target.checked ? item.status.creditado : false,
                                    compensacao: event.target.checked ? item.status.compensacao : false,
                                    finalizado: event.target.checked ? item.status.finalizado : false,
                                  })
                                }
                              />{' '}
                              E-mail
                            </label>
                            <label>
                              <input
                                type="checkbox"
                                checked={item.status.creditado}
                                onChange={(event) =>
                                  updateStatus(item.id, {
                                    ...item.status,
                                    email: event.target.checked || item.status.email,
                                    creditado: event.target.checked,
                                    compensacao: event.target.checked ? item.status.compensacao : false,
                                    finalizado: event.target.checked ? item.status.finalizado : false,
                                  })
                                }
                              />{' '}
                              Creditado
                            </label>
                            <label>
                              <input
                                type="checkbox"
                                checked={item.status.compensacao}
                                onChange={(event) =>
                                  updateStatus(item.id, {
                                    ...item.status,
                                    email: event.target.checked || item.status.email,
                                    creditado: event.target.checked || item.status.creditado,
                                    compensacao: event.target.checked,
                                    finalizado: event.target.checked ? item.status.finalizado : false,
                                  })
                                }
                              />{' '}
                              Compensacao
                            </label>
                            <label>
                              <input
                                type="checkbox"
                                checked={item.status.finalizado}
                                onChange={(event) =>
                                  updateStatus(item.id, {
                                    ...item.status,
                                    email: event.target.checked || item.status.email,
                                    creditado: event.target.checked || item.status.creditado,
                                    compensacao: event.target.checked || item.status.compensacao,
                                    finalizado: event.target.checked,
                                  })
                                }
                              />{' '}
                              Finalizado
                            </label>
                          </div>
                          <div className="farma-inline-actions">
                            <button type="button" onClick={() => copyToClipboard(emailText(item))}>
                              Texto e-mail
                            </button>
                            <button type="button" onClick={() => copyToClipboard(esferaText(item))}>
                              Texto esfera
                            </button>
                            <button type="button" onClick={() => navigate('/farma/compensacoes')}>
                              Ir para compensacoes
                            </button>
                          </div>
                        </section>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7}>Nenhuma transferencia cadastrada.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
