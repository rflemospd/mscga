import { useState } from 'react';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { ExtrajudicialTemplate } from './types';
import { formatCnpj } from './utils';

function getBasePath(): string {
  const pathname = window.location.pathname || '/';
  return pathname.endsWith('/') ? pathname : `${pathname}/`;
}

export function NotificacaoExtrajudicialPage() {
  const [template, setTemplate] = useState<ExtrajudicialTemplate>('nds');
  const [razao, setRazao] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [titulos, setTitulos] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const generate = async () => {
    if (!razao.trim()) return;
    setProcessing(true);
    setError('');
    try {
      const base = getBasePath();
      const templateUrl = `${base}farma/templates/extrajudicial/${template}.pdf`;
      const bytes = await fetch(templateUrl).then((res) => {
        if (!res.ok) throw new Error(`Falha ao carregar template (${res.status}).`);
        return res.arrayBuffer();
      });
      const doc = await PDFDocument.load(bytes);
      const page = doc.getPages()[0];
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const bold = await doc.embedFont(StandardFonts.HelveticaBold);
      const width = page.getWidth();
      const height = page.getHeight();

      const date = new Date().toLocaleDateString('pt-BR');
      page.drawText(`RAZAO SOCIAL: ${razao.toUpperCase()}`, {
        x: 54,
        y: height - 205,
        size: 11,
        font: bold,
        color: rgb(0, 0, 0),
      });
      page.drawText(`CNPJ: ${formatCnpj(cnpj) || '-'}`, {
        x: 54,
        y: height - 225,
        size: 11,
        font,
        color: rgb(0, 0, 0),
      });
      page.drawText(`DATA: ${date}`, {
        x: width - 170,
        y: height - 145,
        size: 11,
        font,
        color: rgb(0, 0, 0),
      });

      const rows = titulos
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      const startY = height - 330;
      rows.slice(0, 14).forEach((line, index) => {
        page.drawText(line.toUpperCase(), {
          x: 58,
          y: startY - index * 16,
          size: 10,
          font,
          color: rgb(0, 0, 0),
        });
      });

      const out = await doc.save();
      const blobBytes = new Uint8Array(out.byteLength);
      blobBytes.set(out);
      const blob = new Blob([blobBytes], { type: 'application/pdf' });
      const fileName = `notificacao-extrajudicial-${template}-${Date.now()}.pdf`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao gerar PDF.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <section>
      <h1>NOTIFICACAO EXTRAJUDICIAL</h1>
      <p>Geracao de PDF no MSCGA com os templates operacionais.</p>

      <section className="card farma-form">
        <h2>Dados da notificacao</h2>
        <div className="farma-grid-2">
          <label>
            Template
            <select value={template} onChange={(e) => setTemplate(e.target.value as ExtrajudicialTemplate)}>
              <option value="nds">NDS</option>
              <option value="prati">PRATI</option>
              <option value="blankpage">BLANKPAGE</option>
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
          <label className="farma-span-2">
            Titulos (uma linha por titulo)
            <textarea
              value={titulos}
              onChange={(e) => setTitulos(e.target.value)}
              placeholder="NF 1234 - R$ 1.200,00"
            />
          </label>
        </div>
        <div className="farma-actions">
          <button type="button" disabled={processing} onClick={generate}>
            {processing ? 'Gerando...' : 'Gerar PDF'}
          </button>
        </div>
        {error ? <p className="farma-error">{error}</p> : null}
      </section>
    </section>
  );
}
