import { useState } from 'react';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { ExtrajudicialTemplate } from './types';
import { downloadBlob, formatCnpj, formatDateBRFromISO, getTodayISO, parseDateBR, parseISODate, toISODate } from './utils';

function getBasePath(): string {
  const pathname = window.location.pathname || '/';
  return pathname.endsWith('/') ? pathname : `${pathname}/`;
}

export function NotificacaoExtrajudicialPage() {
  const [template, setTemplate] = useState<ExtrajudicialTemplate>('nds');
  const [razao, setRazao] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [data, setData] = useState(getTodayISO());
  const [titulos, setTitulos] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const parseRows = () => {
    return titulos
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.includes('\t')
          ? line.split('\t')
          : line
              .replace(/\s{2,}/g, '|')
              .split('|')
              .map((part) => part.trim());
        if (parts.length >= 5) return [parts[0], parts[1], parts[3], parts[4]];
        if (parts.length >= 4) return [parts[0], parts[1], parts[2], parts[3]];
        return [line, '', '', ''];
      });
  };

  const generate = async () => {
    if (!razao.trim() && !cnpj.trim() && !titulos.trim()) {
      setError('Preencha ao menos razao social, CNPJ ou titulos.');
      return;
    }
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

      const parsedIso = parseISODate(data);
      const parsedBr = parseDateBR(data);
      const dateIso = parsedIso ? toISODate(parsedIso) : parsedBr ? toISODate(parsedBr) : getTodayISO();
      const dateBr = formatDateBRFromISO(dateIso);
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
      page.drawText(`DATA: ${dateBr}`, {
        x: width - 170,
        y: height - 145,
        size: 11,
        font,
        color: rgb(0, 0, 0),
      });

      const rows = parseRows();
      const colX = [58, 200, 305, 410];
      const headers = ['NOTA FISCAL', 'PARCELA', 'VENCIMENTO', 'R$ VALOR'];
      const startY = height - 330;
      headers.forEach((header, index) => {
        page.drawText(header, {
          x: colX[index],
          y: startY,
          size: 10,
          font: bold,
          color: rgb(0, 0, 0),
        });
      });
      rows.slice(0, 18).forEach((row, rowIndex) => {
        const y = startY - 18 - rowIndex * 14;
        row.forEach((cell, index) => {
          page.drawText(String(cell || '').toUpperCase(), {
            x: colX[index],
            y,
            size: 9,
            font,
            color: rgb(0, 0, 0),
          });
        });
      });

      const out = await doc.save();
      const fileName = `notificacao-extrajudicial-${template}-${Date.now()}.pdf`;
      const blobBytes = new Uint8Array(out.byteLength);
      blobBytes.set(out);
      downloadBlob(new Blob([blobBytes], { type: 'application/pdf' }), fileName);
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
          <label>
            Data
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
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
              placeholder="000155148-1    001    21/11/2025    05/12/2025    864,00"
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
