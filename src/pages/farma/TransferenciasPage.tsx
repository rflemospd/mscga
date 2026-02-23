import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadTransfers, saveTransfers } from './storage';
import type { FarmaTransfer, TransferStage } from './types';
import { copyToClipboard, createId, formatDateTimeBR, formatMoney, parseMoneyInput } from './utils';

type TransferForm = {
  codigoCliente: string;
  nomeCliente: string;
  valor: string;
  data: string;
  emailDepositos: string;
  observacoes: string;
};

const emptyForm: TransferForm = {
  codigoCliente: '',
  nomeCliente: '',
  valor: '',
  data: '',
  emailDepositos: '',
  observacoes: '',
};

const stages: TransferStage[] = ['nenhum', 'email', 'creditado', 'compensacao', 'finalizado'];

export function TransferenciasPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<FarmaTransfer[]>(() => loadTransfers());
  const [form, setForm] = useState<TransferForm>(emptyForm);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const valor = parseMoneyInput(form.valor);
    if (!form.codigoCliente.trim() || !form.nomeCliente.trim() || valor <= 0) return;
    const now = new Date().toISOString();
    const nextItem: FarmaTransfer = {
      id: createId('tr'),
      codigoCliente: form.codigoCliente.trim(),
      nomeCliente: form.nomeCliente.trim(),
      valor,
      data: form.data || now.slice(0, 10),
      emailDepositos: form.emailDepositos.trim().toLowerCase(),
      observacoes: form.observacoes.trim(),
      stage: 'nenhum',
      createdAt: now,
      updatedAt: now,
    };
    const next = [nextItem, ...items];
    setItems(next);
    saveTransfers(next);
    setForm(emptyForm);
  };

  const changeStage = (id: string, stage: TransferStage) => {
    const now = new Date().toISOString();
    const next = items.map((item) => (item.id === id ? { ...item, stage, updatedAt: now } : item));
    setItems(next);
    saveTransfers(next);
  };

  const removeItem = (id: string) => {
    const next = items.filter((item) => item.id !== id);
    setItems(next);
    saveTransfers(next);
  };

  const emailText = (item: FarmaTransfer) =>
    `CLIENTE ENVIOU O COMPROVANTE DE TRANSFERENCIA NO VALOR DE ${formatMoney(item.valor)}. ` +
    `COMPROVANTE ENVIADO PARA EQUIPE DE DEPOSITOS (${item.emailDepositos || 'sem-email'}).`;

  const esferaText = (item: FarmaTransfer) =>
    `TRANSFERENCIA REGISTRADA\nCLIENTE: ${item.nomeCliente}\nCODIGO: ${item.codigoCliente}\n` +
    `VALOR: ${formatMoney(item.valor)}\nSTATUS: ${item.stage.toUpperCase()}`;

  return (
    <section>
      <h1>TRANSFERENCIAS</h1>
      <p>Controle de transferencias com textos de e-mail e esfera.</p>

      <form className="card farma-form" onSubmit={onSubmit}>
        <h2>Nova transferencia</h2>
        <div className="farma-grid-2">
          <label>
            Codigo cliente
            <input value={form.codigoCliente} onChange={(e) => setForm((prev) => ({ ...prev, codigoCliente: e.target.value }))} />
          </label>
          <label>
            Nome cliente
            <input value={form.nomeCliente} onChange={(e) => setForm((prev) => ({ ...prev, nomeCliente: e.target.value }))} />
          </label>
          <label>
            Valor
            <input value={form.valor} onChange={(e) => setForm((prev) => ({ ...prev, valor: e.target.value }))} placeholder="0,00" />
          </label>
          <label>
            Data
            <input type="date" value={form.data} onChange={(e) => setForm((prev) => ({ ...prev, data: e.target.value }))} />
          </label>
          <label className="farma-span-2">
            E-mail depositos
            <input
              type="email"
              value={form.emailDepositos}
              onChange={(e) => setForm((prev) => ({ ...prev, emailDepositos: e.target.value }))}
            />
          </label>
          <label className="farma-span-2">
            Observacoes
            <textarea value={form.observacoes} onChange={(e) => setForm((prev) => ({ ...prev, observacoes: e.target.value }))} />
          </label>
        </div>
        <div className="farma-actions">
          <button type="submit">Salvar transferencia</button>
        </div>
      </form>

      <section className="card farma-list">
        <h2>Transferencias ({items.length})</h2>
        <div className="farma-table-wrap">
          <table className="farma-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Valor</th>
                <th>Data</th>
                <th>Status</th>
                <th>Atualizado</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.nomeCliente}</strong>
                    <br />
                    <small>{item.codigoCliente}</small>
                  </td>
                  <td>{formatMoney(item.valor)}</td>
                  <td>{item.data}</td>
                  <td>
                    <select value={item.stage} onChange={(e) => changeStage(item.id, e.target.value as TransferStage)}>
                      {stages.map((stage) => (
                        <option key={stage} value={stage}>
                          {stage}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{formatDateTimeBR(item.updatedAt)}</td>
                  <td>
                    <div className="farma-inline-actions">
                      <button type="button" onClick={() => copyToClipboard(emailText(item))}>
                        Texto e-mail
                      </button>
                      <button type="button" onClick={() => copyToClipboard(esferaText(item))}>
                        Texto esfera
                      </button>
                      <button type="button" onClick={() => navigate('/farma/compensacoes')}>
                        Compensacoes
                      </button>
                      <button type="button" className="farma-btn-danger" onClick={() => removeItem(item.id)}>
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6}>Nenhuma transferencia cadastrada.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
