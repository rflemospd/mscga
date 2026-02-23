import { useEffect, useMemo, useState } from 'react';
import { copyToClipboard, formatBR, formatDateBRFromISO, getTodayISO, parseBR, parseDateBR, parseISODate, toISODate } from './utils';

type Mode = 'creditos' | 'pos' | 'negociacao';

type ParsedLine = {
  nome: string;
  item: string;
  emissao: string;
  vencto: string;
  valor: number;
};

type NegotiationRow = {
  parcela: number;
  vencto: string;
  valor: number;
  pagto: string;
};

const PREFILL_KEY = 'mscga_farma_compensacao_prefill_v1';
const HEADER = 'NOTA FISCAL    ITEM    DATA EMISSAO    DATA VENCTO.                R$ VALOR';
const BANNER_CREDITOS = '------------------------------------------------ CREDITO(S) --------------------------------------------------';
const BANNER_TITULOS = '------------------------------------------------- TITULO(S) ---------------------------------------------------';
const BANNER_FINAL = '----------------------------------------------------------------------------------------------------------------';
const NEG_TOP = '~~~~~~~~~~~~~~~~ NEGOCIACAO ~~~~~~~~~~~~~~~~';
const NEG_HEADER = 'Nº PARCELA    DATA VENCTO.     VLR. BASE       DATA PAGTO.  ';
const NEG_LINE = '------------------------------';
const NEG_TOTAL = '**************** VALOR TOTAL: ';
const NEG_BOTTOM = '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~';

function parseLine(rawLine: string): ParsedLine | null {
  const raw = rawLine.replace(/\s+/g, ' ').trim();
  if (!raw) return null;
  const parts = raw.split(' ');
  if (parts.length < 5) return null;
  const valor = parseBR(parts[parts.length - 1] || '');
  if (valor <= 0) return null;
  return {
    nome: parts.slice(0, -4).join(' '),
    item: parts[parts.length - 4] || '',
    emissao: parts[parts.length - 3] || '',
    vencto: parts[parts.length - 2] || '',
    valor,
  };
}

function parseNegotiation(raw: string): NegotiationRow[] {
  const lines = String(raw || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const rows: NegotiationRow[] = [];
  const regex = /^0?(\d{1,2})\s+(\d{2}\/\d{2}\/\d{4})\s+([\d.,]+)(?:\s+(\d{2}\/\d{2}\/\d{4}|X))?$/;

  lines.forEach((line) => {
    if (/^[\-*~]+/.test(line)) return;
    if (/^N[ºo]\s*PARCELA/i.test(line)) return;
    const match = line.replace(/\s{2,}/g, ' ').match(regex);
    if (!match) return;
    rows.push({
      parcela: Number(match[1]),
      vencto: match[2],
      valor: parseBR(match[3]),
      pagto: match[4] && match[4] !== 'X' ? match[4] : 'X',
    });
  });

  return rows.sort((a, b) => a.parcela - b.parcela);
}

function buildNegotiationBlock(raw: string, parcelaPaga: string, dataPagtoIso: string): string {
  const rows = parseNegotiation(raw);
  if (!rows.length) return '';
  const parcela = Number(parcelaPaga || 0);
  const payDate = formatDateBRFromISO(dataPagtoIso);
  if (Number.isInteger(parcela) && parcela > 0 && payDate) {
    const target = rows.find((entry) => entry.parcela === parcela);
    if (target) target.pagto = payDate;
  }
  const total = rows.reduce((sum, entry) => sum + (entry.valor || 0), 0);
  const formattedRows = rows.map((entry) => {
    const value = formatBR(entry.valor);
    const baseLen = 6;
    const extra = Math.max(0, value.length - baseLen);
    const padVal = Math.max(0, 11 - extra);
    const isDate = /^\d{2}\/\d{2}\/\d{4}$/.test(entry.pagto);
    const padPg = Math.max(0, 18 - (isDate ? 7 : 0));
    return `${String(entry.parcela).padStart(2, '0')}${' '.repeat(19)}${entry.vencto}${' '.repeat(padVal)}${value}${' '.repeat(padPg)}${
      isDate ? entry.pagto : 'X'
    }`;
  });

  return [NEG_TOP, NEG_HEADER, ...formattedRows, NEG_LINE, `${NEG_TOTAL}${formatBR(total)}  `, NEG_BOTTOM].join('\n');
}

function fmtCredito(entry: ParsedLine, suffix = ''): string {
  const out = `${entry.nome}${' '.repeat(15)}${entry.item}${' '.repeat(8)}${entry.emissao}${' '.repeat(9)}${
    entry.vencto
  }${' '.repeat(19)}${formatBR(entry.valor)}`;
  return suffix ? `${out} ${suffix}` : out;
}

function fmtTitulo(entry: ParsedLine, suffix = ''): string {
  const out = `${entry.nome}${' '.repeat(5)}${entry.item}${' '.repeat(8)}${entry.emissao}${' '.repeat(9)}${entry.vencto}${' '.repeat(
    19,
  )}${formatBR(entry.valor)}`;
  return suffix ? `${out} ${suffix}` : out;
}

export function CompensacoesPage() {
  const [mode, setMode] = useState<Mode>('creditos');
  const [titulos, setTitulos] = useState('');
  const [creditos, setCreditos] = useState('');
  const [multa, setMulta] = useState('');
  const [juros, setJuros] = useState('');
  const [parcelas, setParcelas] = useState('1');
  const [chkTaxaBoletos, setChkTaxaBoletos] = useState(false);
  const [qtdBoletos, setQtdBoletos] = useState('');
  const [chkNoParcial, setChkNoParcial] = useState(false);
  const [chkSobraJuro, setChkSobraJuro] = useState(false);
  const [negociacaoRaw, setNegociacaoRaw] = useState('');
  const [parcelaPaga, setParcelaPaga] = useState('');
  const [dataPagto, setDataPagto] = useState(getTodayISO());
  const [output, setOutput] = useState('');

  useEffect(() => {
    const raw = sessionStorage.getItem(PREFILL_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as {
        mode?: Mode;
        negociacao?: string;
        multa?: number;
        juros?: number;
        parcelas?: number;
      };
      setMode(parsed.mode === 'negociacao' ? 'negociacao' : 'creditos');
      if (parsed.negociacao) setNegociacaoRaw(parsed.negociacao);
      if (typeof parsed.multa === 'number' && parsed.multa > 0) setMulta(formatBR(parsed.multa));
      if (typeof parsed.juros === 'number' && parsed.juros > 0) setJuros(formatBR(parsed.juros));
      if (typeof parsed.parcelas === 'number' && parsed.parcelas > 0) setParcelas(String(parsed.parcelas));
    } catch {
      // no-op
    } finally {
      sessionStorage.removeItem(PREFILL_KEY);
    }
  }, []);

  const preview = useMemo(() => {
    if (!output.trim()) return 'Clique em "Calcular" para gerar o texto.';
    return output;
  }, [output]);

  const calculate = () => {
    const titulosList = titulos
      .split(/\r?\n/)
      .map((line) => parseLine(line))
      .filter((line): line is ParsedLine => Boolean(line));
    const creditosList = creditos
      .split(/\r?\n/)
      .map((line) => parseLine(line))
      .filter((line): line is ParsedLine => Boolean(line));

    const valorMulta = parseBR(multa);
    const valorJuros = parseBR(juros);
    const qtdTaxa = chkTaxaBoletos ? Math.max(0, Number(qtdBoletos) || 0) : 0;
    const taxaBoletos = qtdTaxa * 5;

    let encargos = 0;
    let qtdParcelas = 1;
    if (mode === 'creditos') {
      encargos = valorMulta + valorJuros + taxaBoletos;
    } else if (mode === 'negociacao') {
      qtdParcelas = Math.max(1, Number(parcelas) || 1);
      encargos = (valorMulta + valorJuros + taxaBoletos) / qtdParcelas;
    }

    const totalCreditos = creditosList.reduce((sum, entry) => sum + entry.valor, 0);
    let creditoLiquido = Math.max(0, totalCreditos - encargos);

    const pre: string[] = [];
    if (mode === 'creditos') {
      const parts = [`MULTA [${formatBR(valorMulta)}]`, `JUROS [${formatBR(valorJuros)}]`];
      if (taxaBoletos > 0) {
        parts.push(qtdTaxa > 1 ? `TAXA ADM. BOLETO [${formatBR(5)} * ${qtdTaxa}]` : `TAXA ADM. BOLETO [${formatBR(taxaBoletos)}]`);
      }
      pre.push('COMPENSACAO DE CREDITO + ENCARGOS', `ENCARGOS: ${parts.join(' + ')} = ${formatBR(encargos)}`, '');
    } else if (mode === 'pos') {
      pre.push('COMPENSACAO DE CREDITO POS-VENDAS', '');
    } else {
      const parts = [`MULTA [${formatBR(valorMulta)}]`, `JUROS [${formatBR(valorJuros)}]`];
      if (taxaBoletos > 0) {
        parts.push(qtdTaxa > 1 ? `TAXA ADM. BOLETO [${formatBR(5)} * ${qtdTaxa}]` : `TAXA ADM. BOLETO [${formatBR(taxaBoletos)}]`);
      }
      pre.push(
        'COMPENSACAO DE CREDITO + ENCARGOS REF. NEGOCIACAO',
        `ENCARGOS: (${parts.join(' + ')}) / PARCELAS [${qtdParcelas}] = ${formatBR(encargos)}`,
        '',
      );
    }

    const blocCred = [BANNER_CREDITOS, '', HEADER];
    creditosList.forEach((entry, index) => {
      if ((mode === 'creditos' || mode === 'negociacao') && index === 0 && encargos > 0) {
        const liquido = Math.max(0, entry.valor - Math.min(encargos, entry.valor));
        blocCred.push(fmtCredito(entry, `- ${formatBR(encargos)} = ${formatBR(liquido)}`));
      } else {
        blocCred.push(fmtCredito(entry));
      }
    });

    const blocTit = [BANNER_TITULOS, '', HEADER];
    let restante = creditoLiquido;
    let divergencia = 0;
    const noParcial = mode !== 'pos' && chkNoParcial;

    titulosList.forEach((entry) => {
      if (noParcial) {
        const falta = Math.max(0, entry.valor - restante);
        divergencia += falta;
        restante = Math.max(0, restante - entry.valor);
        blocTit.push(fmtTitulo(entry, '(BAIXA TOTAL)'));
        return;
      }
      if (restante <= 0) {
        blocTit.push(fmtTitulo(entry));
        return;
      }
      if (restante >= entry.valor - 1e-9) {
        restante -= entry.valor;
        blocTit.push(fmtTitulo(entry, '(BAIXA TOTAL)'));
      } else {
        const atualizado = entry.valor - restante;
        blocTit.push(fmtTitulo(entry, `(BAIXA PARCIAL) [VALOR ATUALIZADO: ${formatBR(atualizado)}]`));
        restante = 0;
      }
    });

    const lines = [...pre, ...blocCred, '', ...blocTit, '', BANNER_FINAL];
    if (noParcial && divergencia > 0.005) {
      lines.push(`*** POR GENTILEZA, DESCONSIDERAR A DIVERGENCIA DE VALORES (${formatBR(divergencia)}) ***`);
    } else if (restante > 0.005) {
      lines.push(
        chkSobraJuro && mode !== 'pos'
          ? `*** POR GENTILEZA, CONSIDERAR CREDITO REMANESCENTE (${formatBR(restante)}) COMO ENCARGO ***`
          : `CREDITO REMANESCENTE: ${formatBR(restante)}`,
      );
    }

    if (mode === 'negociacao') {
      const block = buildNegotiationBlock(negociacaoRaw, parcelaPaga, dataPagto);
      if (block) lines.push('', '', block);
    }

    setOutput(lines.join('\n'));
  };

  const clear = () => {
    setTitulos('');
    setCreditos('');
    setMulta('');
    setJuros('');
    setParcelas('1');
    setChkTaxaBoletos(false);
    setQtdBoletos('');
    setChkNoParcial(false);
    setChkSobraJuro(false);
    setNegociacaoRaw('');
    setParcelaPaga('');
    setDataPagto(getTodayISO());
    setOutput('');
  };

  const prevDate = () => {
    const current = parseISODate(dataPagto) ?? new Date();
    current.setDate(current.getDate() - 1);
    setDataPagto(toISODate(current));
  };

  const nextDate = () => {
    const current = parseISODate(dataPagto) ?? new Date();
    current.setDate(current.getDate() + 1);
    setDataPagto(toISODate(current));
  };

  const dataPagtoBr = formatDateBRFromISO(dataPagto);
  const dataPagtoValid = parseDateBR(dataPagtoBr);

  return (
    <section>
      <h1>COMPENSACOES</h1>
      <p>Compensacao de credito no mesmo fluxo operacional do Cobtool.</p>

      <section className="card farma-form">
        <h2>Modo</h2>
        <div className="farma-inline-actions">
          <button type="button" className={mode === 'creditos' ? 'farma-btn-secondary' : ''} onClick={() => setMode('creditos')}>
            Creditos
          </button>
          <button type="button" className={mode === 'pos' ? 'farma-btn-secondary' : ''} onClick={() => setMode('pos')}>
            Pos-vendas
          </button>
          <button
            type="button"
            className={mode === 'negociacao' ? 'farma-btn-secondary' : ''}
            onClick={() => setMode('negociacao')}
          >
            Negociacao
          </button>
        </div>

        <div className="farma-grid-2">
          <label className="farma-span-2">
            Titulos
            <textarea
              value={titulos}
              onChange={(event) => setTitulos(event.target.value)}
              placeholder="NF 000123 001 01/01/2026 10/01/2026 1.250,00"
            />
          </label>
          <label className="farma-span-2">
            Creditos
            <textarea
              value={creditos}
              onChange={(event) => setCreditos(event.target.value)}
              placeholder="NF 000321 001 02/01/2026 12/01/2026 900,00"
            />
          </label>
          {mode !== 'pos' ? (
            <>
              <label>
                Multa
                <input value={multa} onChange={(event) => setMulta(event.target.value)} placeholder="0,00" />
              </label>
              <label>
                Juros
                <input value={juros} onChange={(event) => setJuros(event.target.value)} placeholder="0,00" />
              </label>
              <label>
                <input type="checkbox" checked={chkTaxaBoletos} onChange={(event) => setChkTaxaBoletos(event.target.checked)} /> Taxa
                adm. boleto
              </label>
              {chkTaxaBoletos ? (
                <label>
                  Qtd. boletos
                  <input
                    type="number"
                    min={0}
                    value={qtdBoletos}
                    onChange={(event) => setQtdBoletos(event.target.value)}
                    placeholder="0"
                  />
                </label>
              ) : null}
              <label>
                <input type="checkbox" checked={chkNoParcial} onChange={(event) => setChkNoParcial(event.target.checked)} /> Nao
                considerar baixa parcial
              </label>
              <label>
                <input type="checkbox" checked={chkSobraJuro} onChange={(event) => setChkSobraJuro(event.target.checked)} /> Credito
                remanescente como encargo
              </label>
            </>
          ) : null}

          {mode === 'negociacao' ? (
            <>
              <label>
                Parcelas
                <input type="number" min={1} value={parcelas} onChange={(event) => setParcelas(event.target.value)} />
              </label>
              <label>
                Parcela paga
                <input type="number" min={1} value={parcelaPaga} onChange={(event) => setParcelaPaga(event.target.value)} />
              </label>
              <label>
                Data pagamento
                <input type="date" value={dataPagto} onChange={(event) => setDataPagto(event.target.value)} />
                <small>{dataPagtoValid ? dataPagtoBr : 'Data invalida'}</small>
              </label>
              <div className="farma-inline-actions">
                <button type="button" onClick={prevDate}>
                  -1 dia
                </button>
                <button type="button" onClick={nextDate}>
                  +1 dia
                </button>
              </div>
              <label className="farma-span-2">
                Bloco de negociacao
                <textarea
                  value={negociacaoRaw}
                  onChange={(event) => setNegociacaoRaw(event.target.value)}
                  placeholder="Cole aqui o bloco da negociacao"
                />
              </label>
            </>
          ) : null}
        </div>

        <div className="farma-actions">
          <button type="button" onClick={calculate}>
            Calcular
          </button>
          <button type="button" className="farma-btn-secondary" onClick={clear}>
            Limpar
          </button>
        </div>
      </section>

      <section className="card farma-form">
        <h2>Saida</h2>
        <textarea readOnly value={preview} />
        <div className="farma-actions">
          <button type="button" onClick={() => copyToClipboard(output)}>
            Copiar texto
          </button>
        </div>
      </section>
    </section>
  );
}
