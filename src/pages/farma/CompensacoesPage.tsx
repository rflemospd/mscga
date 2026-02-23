import { useMemo, useState } from 'react';
import { copyToClipboard, formatMoney, parseMoneyInput } from './utils';

type Mode = 'padrao' | 'negociacao';

export function CompensacoesPage() {
  const [mode, setMode] = useState<Mode>('padrao');
  const [titulos, setTitulos] = useState('');
  const [creditos, setCreditos] = useState('');
  const [encargos, setEncargos] = useState('');
  const [valorNegociacao, setValorNegociacao] = useState('');
  const [parcelas, setParcelas] = useState('1');

  const calc = useMemo(() => {
    const vTitulos = parseMoneyInput(titulos);
    const vCreditos = parseMoneyInput(creditos);
    const vEncargos = parseMoneyInput(encargos);
    const vNeg = parseMoneyInput(valorNegociacao);
    const saldoBase = vTitulos - vCreditos + vEncargos;
    const saldoFinal = mode === 'negociacao' ? vNeg : saldoBase;
    const qtdParcelas = Math.max(1, Number(parcelas) || 1);
    const valorParcela = saldoFinal / qtdParcelas;
    return { vTitulos, vCreditos, vEncargos, vNeg, saldoBase, saldoFinal, qtdParcelas, valorParcela };
  }, [titulos, creditos, encargos, valorNegociacao, parcelas, mode]);

  const output = useMemo(() => {
    const lines = [
      '~~~~~~~~~~~~~~~~ COMPENSACAO ~~~~~~~~~~~~~~~~',
      `MODO: ${mode === 'padrao' ? 'COMPENSACAO PADRAO' : 'COMPENSACAO POR NEGOCIACAO'}`,
      `VALOR TITULOS: ${formatMoney(calc.vTitulos)}`,
      `CREDITOS: ${formatMoney(calc.vCreditos)}`,
      `ENCARGOS: ${formatMoney(calc.vEncargos)}`,
      `SALDO BASE: ${formatMoney(calc.saldoBase)}`,
    ];
    if (mode === 'negociacao') {
      lines.push(`VALOR NEGOCIACAO: ${formatMoney(calc.vNeg)}`);
    }
    lines.push(`SALDO FINAL: ${formatMoney(calc.saldoFinal)}`);
    lines.push(`PARCELAS: ${calc.qtdParcelas}`);
    lines.push(`VALOR POR PARCELA: ${formatMoney(calc.valorParcela)}`);
    return lines.join('\n');
  }, [calc, mode]);

  return (
    <section>
      <h1>COMPENSACOES</h1>
      <p>Calculo operacional de compensacoes com geracao de texto padrao.</p>

      <section className="card farma-form">
        <h2>Parametros</h2>
        <div className="farma-inline-actions">
          <button
            type="button"
            className={mode === 'padrao' ? 'farma-btn-secondary' : ''}
            onClick={() => setMode('padrao')}
          >
            Compensacao
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
          <label>
            Valor dos titulos
            <input value={titulos} onChange={(e) => setTitulos(e.target.value)} placeholder="0,00" />
          </label>
          <label>
            Creditos
            <input value={creditos} onChange={(e) => setCreditos(e.target.value)} placeholder="0,00" />
          </label>
          <label>
            Encargos
            <input value={encargos} onChange={(e) => setEncargos(e.target.value)} placeholder="0,00" />
          </label>
          {mode === 'negociacao' ? (
            <label>
              Valor da negociacao
              <input value={valorNegociacao} onChange={(e) => setValorNegociacao(e.target.value)} placeholder="0,00" />
            </label>
          ) : null}
          <label>
            Parcelas
            <input type="number" min={1} value={parcelas} onChange={(e) => setParcelas(e.target.value)} />
          </label>
        </div>
      </section>

      <section className="card farma-form">
        <h2>Saida</h2>
        <textarea readOnly value={output} />
        <div className="farma-actions">
          <button type="button" onClick={() => copyToClipboard(output)}>
            Copiar texto
          </button>
        </div>
      </section>
    </section>
  );
}
