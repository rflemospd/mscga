import { FormEvent, useMemo, useState } from 'react';
import { exportFarmaBackup, importFarmaBackup, loadClients, saveClients } from './storage';
import type { FarmaClient } from './types';
import { createId, downloadBlob, maskCnpjValue, normalizeCnpj, normalizeCodigo } from './utils';

type ClientForm = {
  id: string;
  codigo: string;
  razao: string;
  cnpj: string;
  representante: string;
  contato: string;
  email: string;
};

const emptyForm: ClientForm = {
  id: '',
  codigo: '',
  razao: '',
  cnpj: '',
  representante: '',
  contato: '',
  email: '',
};

export function CadastroClientesPage() {
  const [clients, setClients] = useState<FarmaClient[]>(() => loadClients());
  const [form, setForm] = useState<ClientForm>(emptyForm);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return clients;
    return clients.filter((item) => {
      return (
        item.codigo.includes(term) ||
        item.razao.toLowerCase().includes(term) ||
        item.representante.toLowerCase().includes(term) ||
        item.contato.toLowerCase().includes(term) ||
        item.email.toLowerCase().includes(term) ||
        item.cnpj.includes(term)
      );
    });
  }, [clients, search]);

  const resetForm = () => setForm(emptyForm);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const codigo = normalizeCodigo(form.codigo);
    const cnpj = normalizeCnpj(form.cnpj);
    const razao = form.razao.trim();

    if (!codigo || !razao || cnpj.length !== 14) {
      setMessage('Preencha codigo, razao social e CNPJ valido (14 digitos).');
      return;
    }

    const duplicateCode = clients.find((item) => item.codigo === codigo && item.id !== form.id);
    if (duplicateCode) {
      setMessage('Ja existe cliente com este codigo.');
      return;
    }
    const duplicateCnpj = clients.find((item) => item.cnpj === cnpj && item.id !== form.id);
    if (duplicateCnpj) {
      setMessage('Ja existe cliente com este CNPJ.');
      return;
    }

    const now = new Date().toISOString();

    if (form.id) {
      const next = clients.map((item) =>
        item.id === form.id
          ? {
              ...item,
              codigo,
              razao,
              cnpj,
              representante: form.representante.trim(),
              contato: form.contato.trim(),
              email: form.email.trim().toLowerCase(),
              updatedAt: now,
            }
          : item,
      );
      setClients(next);
      saveClients(next);
      resetForm();
      setMessage('Cliente atualizado.');
      return;
    }

    const nextItem: FarmaClient = {
      id: createId('cli'),
      codigo,
      razao,
      cnpj,
      representante: form.representante.trim(),
      contato: form.contato.trim(),
      email: form.email.trim().toLowerCase(),
      createdAt: now,
      updatedAt: now,
    };
    const next = [nextItem, ...clients];
    setClients(next);
    saveClients(next);
    resetForm();
    setMessage('Cliente cadastrado.');
  };

  const onEdit = (item: FarmaClient) => {
    setForm({
      id: item.id,
      codigo: item.codigo,
      razao: item.razao,
      cnpj: maskCnpjValue(item.cnpj),
      representante: item.representante,
      contato: item.contato,
      email: item.email,
    });
    setMessage('');
  };

  const onDelete = (id: string) => {
    const next = clients.filter((item) => item.id !== id);
    setClients(next);
    saveClients(next);
    if (form.id === id) resetForm();
    setMessage('Cliente excluido.');
  };

  const onExport = () => {
    const backup = exportFarmaBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `mscga-farma-backup-${Date.now()}.json`);
  };

  const onImport = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const result = importFarmaBackup(parsed);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setClients(loadClients());
      setMessage(result.message);
      if (form.id) resetForm();
    } catch {
      setMessage('Nao foi possivel importar o arquivo.');
    }
  };

  return (
    <section>
      <h1>CADASTRO DE CLIENTES</h1>
      <p>Cadastro operacional com validacao de codigo/CNPJ e backup do modulo FARMA.</p>

      <form className="card farma-form" onSubmit={onSubmit}>
        <h2>{form.id ? 'Editar cliente' : 'Novo cliente'}</h2>
        <div className="farma-grid-2">
          <label>
            Codigo
            <input
              value={form.codigo}
              onChange={(e) => setForm((prev) => ({ ...prev, codigo: normalizeCodigo(e.target.value) }))}
              inputMode="numeric"
              maxLength={6}
            />
          </label>
          <label>
            CNPJ
            <input
              value={form.cnpj}
              onChange={(e) => setForm((prev) => ({ ...prev, cnpj: maskCnpjValue(e.target.value) }))}
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
          <label>
            Contato
            <input value={form.contato} onChange={(e) => setForm((prev) => ({ ...prev, contato: e.target.value }))} />
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
          <button type="button" className="farma-btn-secondary" onClick={onExport}>
            Exportar backup
          </button>
          <label className="farma-file-button">
            Importar backup
            <input
              type="file"
              accept="application/json"
              onChange={(e) => onImport(e.target.files?.[0] || null)}
            />
          </label>
        </div>
        {message ? <p>{message}</p> : null}
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
                <th>Contato</th>
                <th>E-mail</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td>{item.codigo}</td>
                  <td>{item.razao}</td>
                  <td>{maskCnpjValue(item.cnpj) || '-'}</td>
                  <td>{item.representante || '-'}</td>
                  <td>{item.contato || '-'}</td>
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
                  <td colSpan={7}>Nenhum cliente encontrado.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
