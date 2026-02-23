import { useMemo, useState } from 'react';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { AlfaOperator } from './types';
import {
  copyToClipboard,
  downloadBlob,
  formatBR,
  formatCnpj,
  formatDateBRFromISO,
  getTodayISO,
  normalizeCnpj,
  parseBR,
  parseDateBR,
  parseISODate,
  toISODate,
} from './utils';

type OperatorMeta = { label: string; phone: string; file: string };

const operators: Record<AlfaOperator, OperatorMeta> = {
  carlyle: { label: 'Carlyle', phone: '(45) 99958-0258', file: 'carlyle.pdf' },
  karoline: { label: 'Karoline', phone: '(45) 99913-2289', file: 'karoline.pdf' },
  lucia: { label: 'Lucia', phone: '(45) 99113-7325', file: 'lucia.pdf' },
  pedro: { label: 'Pedro', phone: '(45) 99905-3383', file: 'pedro.pdf' },
  rafael: { label: 'Rafael', phone: '(45) 99903-1265', file: 'rafael.pdf' },
  renan: { label: 'Renan', phone: '(45) 99903-1652', file: 'renan.pdf' },
  vanderleia: { label: 'Vanderleia', phone: '(45) 99114-2947', file: 'vanderleia.pdf' },
};

type AlfaKind = 'fria' | 'previsao-serasa' | 'risco-bloqueio' | 'regularizacao-urgente';

type AlfaContext = {
  qtd: number;
  notasShortFmt: string;
  notaPrep: string;
  notaTerm: string;
  valorFmt: string;
};

function getBasePath(): string {
  const pathname = window.location.pathname || '/';
  return pathname.endsWith('/') ? pathname : `${pathname}/`;
}

function parseEsferaData(raw: string): AlfaContext {
  const normalized = String(raw || '');
  const rows = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const notes = new Set<string>();
  let total = 0;
  const rowRegex = /^([0-9.\-]+)\s+(\d{1,3})\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+([\d.,]+)$/;
  rows.forEach((row) => {
    const compact = row.replace(/\s{2,}/g, ' ');
    const match = compact.match(rowRegex);
    if (!match) return;
    const note = String(match[1] || '').replace(/\D+/g, '').replace(/^0+(?=\d)/, '');
    if (note) notes.add(note);
    total += parseBR(match[5] || '0');
  });

  const list = [...notes];
  const notasShortFmt =
    list.length === 0
      ? '`000000`'
      : list.length === 1
        ? `\`${list[0]}\``
        : `${list
            .slice(0, -1)
            .map((n) => `\`${n}\``)
            .join(', ')} e \`${list[list.length - 1]}\``;
  const notaPrep = list.length === 1 ? 'a' : 'as';
  const notaTerm = list.length === 1 ? 'nota fiscal' : 'notas fiscais';

  return {
    qtd: rows.length,
    notasShortFmt,
    notaPrep,
    notaTerm,
    valorFmt: `R$ ${formatBR(total)}`,
  };
}

function greeting(): string {
  return new Date().getHours() < 12 ? '*Bom dia*, tudo bem?' : '*Boa tarde*, tudo bem?';
}

function compose(kind: AlfaKind, operatorLabel: string, cnpj: string, context: AlfaContext): string {
  const id = `Meu nome e *${operatorLabel}*, falo do *setor financeiro* da *Prati-Donaduzzi*.`;
  if (kind === 'fria') {
    const cnpjLabel = cnpj ? `\`${formatCnpj(cnpj)}\`` : '`00.000.000/0000-00`';
    return `${greeting()} ${id} Falo com o(a) responsavel pelo CNPJ ${cnpjLabel}?`;
  }
  if (kind === 'previsao-serasa') {
    return `${greeting()} Consta(m) \`${context.qtd}\` boleto(s) em atraso referente ${context.notaPrep} ${context.notaTerm} ${context.notasShortFmt}, no valor total de \`${context.valorFmt}\` *+ encargos*. Preciso da *previsao de pagamento* para evitar registro junto ao *Serasa*. Posso contar com a regularizacao *ainda nesta semana*?`;
  }
  if (kind === 'risco-bloqueio') {
    return `${greeting()} Ha risco de *bloqueio integral de credito* no cadastro por conta de \`${context.qtd}\` boleto(s) em atraso referente ${context.notaPrep} ${context.notaTerm} ${context.notasShortFmt}, no valor total de \`${context.valorFmt}\` *+ encargos*. Preciso da regularizacao *ainda nesta semana*.`;
  }
  return `${greeting()} Seu cadastro esta com *registro no Serasa* e com *bloqueio integral de credito* por conta de \`${context.qtd}\` boleto(s) em atraso referente ${context.notaPrep} ${context.notaTerm} ${context.notasShortFmt}, no valor total de \`${context.valorFmt}\` *+ encargos*. Preciso da confirmacao de regularizacao *ainda hoje* para evitar direcionamento ao *setor juridico*.`;
}

function buildRegistro(kind: AlfaKind, qtd: number): string {
  const date = formatDateBRFromISO(getTodayISO());
  const lines = [date, 'Whatsapp: [INSERIR NUMERO DO CLIENTE]'];
  if (kind === 'fria') {
    lines.push('- Solicitei contato com o responsavel pelo CNPJ;');
    lines.push('- Aguardando retorno;');
  } else if (kind === 'previsao-serasa') {
    lines.push(`- Informei o cliente sobre ${qtd} boleto(s) em atraso e seu devido registro no Serasa;`);
    lines.push('- Solicitei previsao para pagamento;');
  } else if (kind === 'risco-bloqueio') {
    lines.push(`- Informei o cliente sobre risco de bloqueio de credito por ${qtd} boleto(s) em atraso;`);
    lines.push('- Solicitei pagamento ainda nesta semana;');
  } else {
    lines.push(`- Informei o cliente sobre registros no Serasa e bloqueio de credito por ${qtd} boleto(s) em atraso;`);
    lines.push('- Solicitei pagamento imediato para evitar direcionamento ao juridico;');
  }
  lines.push('– – – – –');
  return lines.join('\n');
}

export function AlfaPage() {
  const [operator, setOperator] = useState<AlfaOperator>('carlyle');
  const [cnpj, setCnpj] = useState('');
  const [esfera, setEsfera] = useState('');
  const [output, setOutput] = useState('');
  const [registro, setRegistro] = useState('');
  const [lastKind, setLastKind] = useState<AlfaKind>('previsao-serasa');
  const [razao, setRazao] = useState('');
  const [valor, setValor] = useState('');
  const [detalhes, setDetalhes] = useState('');
  const [date, setDate] = useState(getTodayISO());
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const context = useMemo(() => parseEsferaData(esfera), [esfera]);
  const operatorMeta = operators[operator];

  const generateMessage = (kind: AlfaKind) => {
    if (!esfera.trim() && kind !== 'fria') {
      setError('Cole o texto do esfera para gerar a mensagem.');
      return;
    }
    setError('');
    setLastKind(kind);
    const text = compose(kind, operatorMeta.label, normalizeCnpj(cnpj), context);
    setOutput(text);
    setRegistro(buildRegistro(kind, context.qtd));
  };

  const copyMessage = async () => {
    if (!output.trim()) return;
    await copyToClipboard(output);
  };

  const copyRegistro = async () => {
    if (!registro.trim()) return;
    await copyToClipboard(registro);
  };

  const clearAll = () => {
    setCnpj('');
    setEsfera('');
    setOutput('');
    setRegistro('');
    setLastKind('previsao-serasa');
    setError('');
  };

  const generateCarta = async () => {
    if (!razao.trim()) {
      setError('Informe a razao social para gerar a carta.');
      return;
    }
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

      const dateIso =
        parseISODate(date) && toISODate(parseISODate(date) as Date)
          ? toISODate(parseISODate(date) as Date)
          : parseDateBR(date)
            ? toISODate(parseDateBR(date) as Date)
            : getTodayISO();
      const dateBr = formatDateBRFromISO(dateIso);

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
      page.drawText(`OPERADOR: ${operatorMeta.label.toUpperCase()} - ${operatorMeta.phone}`, {
        x: 52,
        y: height - 252,
        size: 11,
        font,
        color: rgb(0, 0, 0),
      });
      page.drawText(`DATA: ${dateBr}`, {
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
      lines.slice(0, 8).forEach((line, index) => {
        page.drawText(line.toUpperCase(), {
          x: 52,
          y: height - 300 - index * 15,
          size: 10,
          font,
          color: rgb(0, 0, 0),
        });
      });

      const out = await doc.save();
      const blobBytes = new Uint8Array(out.byteLength);
      blobBytes.set(out);
      downloadBlob(new Blob([blobBytes], { type: 'application/pdf' }), `alfa-${operator}-${Date.now()}.pdf`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao gerar carta ALFA.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <section>
      <h1>ALFA</h1>
      <p>Mensagens operacionais e geracao de carta ALFA com template por operador.</p>

      <section className="card farma-form">
        <h2>Mensageria</h2>
        <div className="farma-grid-2">
          <label>
            Operador
            <select value={operator} onChange={(event) => setOperator(event.target.value as AlfaOperator)}>
              {Object.entries(operators).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.label} - {meta.phone}
                </option>
              ))}
            </select>
          </label>
          <label>
            CNPJ cliente
            <input value={formatCnpj(cnpj)} onChange={(event) => setCnpj(normalizeCnpj(event.target.value))} />
          </label>
          <label className="farma-span-2">
            Texto do esfera
            <textarea value={esfera} onChange={(event) => setEsfera(event.target.value)} />
          </label>
        </div>
        <div className="farma-actions">
          <button type="button" onClick={() => generateMessage('fria')}>
            Mensagem fria
          </button>
          <button type="button" onClick={() => generateMessage('previsao-serasa')}>
            Previsao + Serasa
          </button>
          <button type="button" onClick={() => generateMessage('risco-bloqueio')}>
            Risco de bloqueio
          </button>
          <button type="button" onClick={() => generateMessage('regularizacao-urgente')}>
            Regularizacao urgente
          </button>
          <button type="button" className="farma-btn-secondary" onClick={clearAll}>
            Limpar
          </button>
        </div>
      </section>

      <section className="card farma-form">
        <h2>Saida da mensagem ({lastKind})</h2>
        <textarea readOnly value={output || 'Gere uma mensagem para visualizar o texto.'} />
        <div className="farma-actions">
          <button type="button" onClick={copyMessage}>
            Copiar mensagem
          </button>
        </div>
      </section>

      <section className="card farma-form">
        <h2>Registro para esfera</h2>
        <textarea readOnly value={registro || 'O registro aparece apos gerar uma mensagem.'} />
        <div className="farma-actions">
          <button type="button" onClick={copyRegistro}>
            Copiar registro
          </button>
        </div>
      </section>

      <section className="card farma-form">
        <h2>Carta de cobranca</h2>
        <div className="farma-grid-2">
          <label className="farma-span-2">
            Razao social
            <input value={razao} onChange={(event) => setRazao(event.target.value)} />
          </label>
          <label>
            CNPJ
            <input value={formatCnpj(cnpj)} onChange={(event) => setCnpj(normalizeCnpj(event.target.value))} />
          </label>
          <label>
            Data
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <label>
            Valor
            <input value={valor} onChange={(event) => setValor(event.target.value)} placeholder="R$ 0,00" />
          </label>
          <label className="farma-span-2">
            Detalhes
            <textarea value={detalhes} onChange={(event) => setDetalhes(event.target.value)} />
          </label>
        </div>
        <div className="farma-actions">
          <button type="button" disabled={processing} onClick={generateCarta}>
            {processing ? 'Gerando...' : 'Gerar carta ALFA'}
          </button>
        </div>
      </section>
      {error ? <p className="farma-error">{error}</p> : null}
    </section>
  );
}
