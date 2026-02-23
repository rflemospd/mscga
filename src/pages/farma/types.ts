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
  email: string;
  createdAt: string;
  updatedAt: string;
};

export type NegotiationStatus = 'andamento' | 'finalizada' | 'cancelada';

export type FarmaNegotiation = {
  id: string;
  numero: string;
  clientId: string;
  valorOriginal: number;
  valorNegociado: number;
  parcelas: number;
  vencimento: string;
  status: NegotiationStatus;
  observacoes: string;
  createdAt: string;
  updatedAt: string;
};

export type TransferStage = 'nenhum' | 'email' | 'creditado' | 'compensacao' | 'finalizado';

export type FarmaTransfer = {
  id: string;
  codigoCliente: string;
  nomeCliente: string;
  valor: number;
  data: string;
  emailDepositos: string;
  observacoes: string;
  stage: TransferStage;
  createdAt: string;
  updatedAt: string;
};

export type ExtrajudicialTemplate = 'nds' | 'prati' | 'blankpage';

export type AlfaOperator = 'carlyle' | 'karoline' | 'lucia' | 'pedro' | 'rafael' | 'renan' | 'vanderleia';
