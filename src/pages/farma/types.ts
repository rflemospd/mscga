export type FarmaFeatureSlug =
  | 'negociacoes'
  | 'compensacoes'
  | 'transferencias'
  | 'cadastro-clientes'
  | 'notificacao-extrajudicial'
  | 'alfa';

export type FarmaClient = {
  id: string;
  codigo: string;
  razao: string;
  cnpj: string;
  representante: string;
  contato: string;
  email: string;
  createdAt: string;
  updatedAt: string;
};

export type NegotiationStatus = 'andamento' | 'finalizada' | 'cancelada';
export type NegotiationPeriodicity = 'semanal' | 'quinzenal' | 'mensal';

export type FarmaNegotiationClientSnapshot = {
  codigo: string;
  razao: string;
  cnpj: string;
  representante: string;
  contato: string;
};

export type FarmaNegotiationInstallment = {
  id: string;
  numero: number;
  dueDate: string;
  valor: number;
  paid: boolean;
  paidAt: string;
};

export type FarmaNegotiation = {
  id: string;
  numero: string;
  clientId: string;
  clientSnapshot: FarmaNegotiationClientSnapshot | null;
  valorOriginal: number;
  multa: number;
  juros: number;
  valorNegociado: number;
  parcelas: number;
  periodicidade: NegotiationPeriodicity;
  primeiroVencimento: string;
  entradaAtiva: boolean;
  valorEntrada: number;
  installments: FarmaNegotiationInstallment[];
  status: NegotiationStatus;
  observacoes: string;
  createdAt: string;
  updatedAt: string;
  finalizadaAt: string;
  canceladaAt: string;
};

export type TransferStage = 'nenhum' | 'email' | 'creditado' | 'compensacao' | 'finalizado';
export type TransferStatus = {
  email: boolean;
  creditado: boolean;
  compensacao: boolean;
  finalizado: boolean;
};

export type FarmaTransfer = {
  id: string;
  codigoCliente: string;
  nomeCliente: string;
  cnpj: string;
  valor: number;
  data: string;
  emailDepositos: string;
  observacoes: string;
  status: TransferStatus;
  createdAt: string;
  updatedAt: string;
};

export type ExtrajudicialTemplate = 'nds' | 'prati' | 'blankpage';

export type AlfaOperator = 'carlyle' | 'karoline' | 'lucia' | 'pedro' | 'rafael' | 'renan' | 'vanderleia';
