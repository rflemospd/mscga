import { FormEvent, useMemo, useState } from 'react';
import { loadClients, saveClients } from './storage';
import type { FarmaClient } from './types';
import { createId, formatCnpj, onlyDigits } from './utils';

type ClientForm = {
  id: string;
  codigo: string;
  razao: string;
  cnpj: string;
  representante: string;
  email: string;
};

const emptyForm: ClientForm = {
  id: '',
  codigo: '',
  razao: '',
  cnpj: '',
  representante: '',
  email: '',
};

export function CadastroClientesPage() {
  const [clients, setClients] = useState<FarmaClient[]>(() => loadClients());
  const [form, setForm] = useState<ClientForm>(emptyForm);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return clients;
    return clients.filter((item) => {
      return (
        item.codigo.includes(term) ||
        item.razao.toLowerCase().includes(term) ||
        item.representante.toLowerCase().includes(term) ||
        item.email.toLowerCase().includes(term) ||
        item.cnpj.includes(term)
      );
    });
  }, [clients, search]);

  const resetForm = () => setForm(emptyForm);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const codigo = onlyDigits(form.codigo).slice(0, 6).padStart(6, '0');
    if (!codigo || !form.razao.trim()) return;
    const now = new Date().toISOString();

    if (form.id) {
      const next = clients.map((item) =>
        item.id === form.id
          ? {
              ...item,
              codigo,
              razao: form.razao.trim(),
              cnpj: formatCnpj(form.cnpj),
              representante: form.representante.trim(),
              email: form.email.trim().toLowerCase(),
              updatedAt: now,
            }
          : item,
      );
      setClients(next);
      saveClients(next);
      resetForm();
      return;
    }

    const nextItem: FarmaClient = {
      id: createId('cli'),
      codigo,
      razao: form.razao.trim(),
      cnpj: formatCnpj(form.cnpj),
      representante: form.representante.trim(),
      email: form.email.trim().toLowerCase(),
      createdAt: now,
      updatedAt: now,
    };
    const next = [nextItem, ...clients];
    setClients(next);
    saveClients(next);
    resetForm();
  };

  const onEdit = (item: FarmaClient) => {
    setForm({
      id: item.id,
      codigo: item.codigo,
      razao: item.razao,
      cnpj: item.cnpj,
      representante: item.representante,
      email: item.email,
    });
  };

  const onDelete = (id: string) => {
    const next = clients.filter((item) => item.id !== id);
    setClients(next);
    saveClients(next);
    if (form.id === id) resetForm();
  };

  return (
    <section>
      <h1>CADASTRO DE CLIENTES</h1>
      <p>Cadastro nativo no MSCGA, com persistencia local.</p>

      <form className="card farma-form" onSubmit={onSubmit}>
        <h2>{form.id ? 'Editar cliente' : 'Novo cliente'}</h2>
        <div className="farma-grid-2">
          <label>
            Codigo
            <input
              value={form.codigo}
              onChange={(e) => setForm((prev) => ({ ...prev, codigo: onlyDigits(e.target.value).slice(0, 6) }))}
              inputMode="numeric"
              maxLength={6}
            />
          </label>
          <label>
            CNPJ
            <input
              value={form.cnpj}
              onChange={(e) => setForm((prev) => ({ ...prev, cnpj: formatCnpj(e.target.value) }))}
            />
          </label>
          <label>
            Razao social
            <input value={form.razao} onChange={(e) => setForm((prev) => ({ ...prev, razao: e.target.value }))} />
          </label>
          <label>
            Representante
            <input
              value={form.representante}
              onChange={(e) => setForm((prev) => ({ ...prev, representante: e.target.value }))}
            />
          </label>
          <label className="farma-span-2">
            E-mail
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            />
          </label>
        </div>
        <div className="farma-actions">
          <button type="submit">{form.id ? 'Salvar alteracoes' : 'Cadastrar cliente'}</button>
          {form.id ? (
            <button type="button" className="farma-btn-secondary" onClick={resetForm}>
              Cancelar edicao
            </button>
          ) : null}
        </div>
      </form>

      <section className="card farma-list">
        <div className="farma-list-header">
          <h2>Clientes cadastrados ({clients.length})</h2>
          <input placeholder="Buscar cliente" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="farma-table-wrap">
          <table className="farma-table">
            <thead>
              <tr>
                <th>Codigo</th>
                <th>Razao social</th>
                <th>CNPJ</th>
                <th>Representante</th>
                <th>E-mail</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td>{item.codigo}</td>
                  <td>{item.razao}</td>
                  <td>{item.cnpj || '-'}</td>
                  <td>{item.representante || '-'}</td>
                  <td>{item.email || '-'}</td>
                  <td>
                    <div className="farma-inline-actions">
                      <button type="button" onClick={() => onEdit(item)}>
                        Editar
                      </button>
                      <button type="button" className="farma-btn-danger" onClick={() => onDelete(item.id)}>
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6}>Nenhum cliente encontrado.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
