import { useState } from 'react';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { AlfaOperator } from './types';
import { formatCnpj } from './utils';

type OperatorMeta = { label: string; file: string };

const operators: Record<AlfaOperator, OperatorMeta> = {
  carlyle: { label: 'Carlyle', file: 'carlyle.pdf' },
  karoline: { label: 'Karoline', file: 'karoline.pdf' },
  lucia: { label: 'Lucia', file: 'lucia.pdf' },
  pedro: { label: 'Pedro', file: 'pedro.pdf' },
  rafael: { label: 'Rafael', file: 'rafael.pdf' },
  renan: { label: 'Renan', file: 'renan.pdf' },
  vanderleia: { label: 'Vanderleia', file: 'vanderleia.pdf' },
};

function getBasePath(): string {
  const pathname = window.location.pathname || '/';
  return pathname.endsWith('/') ? pathname : `${pathname}/`;
}

export function AlfaPage() {
  const [operator, setOperator] = useState<AlfaOperator>('carlyle');
  const [razao, setRazao] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [valor, setValor] = useState('');
  const [detalhes, setDetalhes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const generate = async () => {
    if (!razao.trim()) return;
    setProcessing(true);
    setError('');
    try {
      const base = getBasePath();
      const file = operators[operator].file;
      const templateUrl = `${base}farma/templates/alfa/${file}`;
      const bytes = await fetch(templateUrl).then((res) => {
        if (!res.ok) throw new Error(`Falha ao carregar carta (${res.status}).`);
        return res.arrayBuffer();
      });

      const doc = await PDFDocument.load(bytes);
      const page = doc.getPages()[0];
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const bold = await doc.embedFont(StandardFonts.HelveticaBold);
      const width = page.getWidth();
      const height = page.getHeight();
      const date = new Date().toLocaleDateString('pt-BR');

      page.drawText(`CLIENTE: ${razao.toUpperCase()}`, {
        x: 52,
        y: height - 198,
        size: 11,
        font: bold,
        color: rgb(0, 0, 0),
      });
      page.drawText(`CNPJ: ${formatCnpj(cnpj) || '-'}`, {
        x: 52,
        y: height - 216,
        size: 11,
        font,
        color: rgb(0, 0, 0),
      });
      page.drawText(`VALOR: ${valor || '-'}`, {
        x: 52,
        y: height - 234,
        size: 11,
        font,
        color: rgb(0, 0, 0),
      });
      page.drawText(`OPERADOR: ${operators[operator].label.toUpperCase()}`, {
        x: 52,
        y: height - 252,
        size: 11,
        font,
        color: rgb(0, 0, 0),
      });
      page.drawText(`DATA: ${date}`, {
        x: width - 166,
        y: height - 146,
        size: 11,
        font,
        color: rgb(0, 0, 0),
      });

      const lines = detalhes
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      lines.slice(0, 8).forEach((line, idx) => {
        page.drawText(line.toUpperCase(), {
          x: 52,
          y: height - 300 - idx * 15,
          size: 10,
          font,
          color: rgb(0, 0, 0),
        });
      });

      const out = await doc.save();
      const blobBytes = new Uint8Array(out.byteLength);
      blobBytes.set(out);
      const blob = new Blob([blobBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `alfa-${operator}-${Date.now()}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao gerar carta ALFA.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <section>
      <h1>ALFA</h1>
      <p>Geracao de carta ALFA com template por operador.</p>

      <section className="card farma-form">
        <h2>Dados da carta</h2>
        <div className="farma-grid-2">
          <label>
            Operador
            <select value={operator} onChange={(e) => setOperator(e.target.value as AlfaOperator)}>
              {Object.entries(operators).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            CNPJ
            <input value={cnpj} onChange={(e) => setCnpj(formatCnpj(e.target.value))} />
          </label>
          <label className="farma-span-2">
            Razao social
            <input value={razao} onChange={(e) => setRazao(e.target.value)} />
          </label>
          <label>
            Valor
            <input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="R$ 0,00" />
          </label>
          <label className="farma-span-2">
            Detalhes
            <textarea value={detalhes} onChange={(e) => setDetalhes(e.target.value)} />
          </label>
        </div>
        <div className="farma-actions">
          <button type="button" disabled={processing} onClick={generate}>
            {processing ? 'Gerando...' : 'Gerar carta ALFA'}
          </button>
        </div>
        {error ? <p className="farma-error">{error}</p> : null}
      </section>
    </section>
  );
}
