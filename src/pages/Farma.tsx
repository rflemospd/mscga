import { Link } from 'react-router-dom';

export type FarmaFeature = {
  slug: string;
  title: string;
  description: string;
};

export const farmaFeatures: FarmaFeature[] = [
  {
    slug: 'negociacoes',
    title: 'NEGOCIACOES',
    description: 'Fluxo para controle de propostas e acordos com clientes.',
  },
  {
    slug: 'compensacoes',
    title: 'COMPENSACOES',
    description: 'Conferencia e acompanhamento de compensacoes financeiras.',
  },
  {
    slug: 'transferencias',
    title: 'TRANSFERENCIAS',
    description: 'Gestao de transferencias e validacao operacional.',
  },
  {
    slug: 'cadastro-clientes',
    title: 'CADASTRO DE CLIENTES',
    description: 'Cadastro e atualizacao de dados de clientes.',
  },
  {
    slug: 'notificacao-extrajudicial',
    title: 'NOTIFICACAO EXTRAJUDICIAL',
    description: 'Emissao e acompanhamento de notificacoes extrajudiciais.',
  },
  {
    slug: 'alfa',
    title: 'ALFA',
    description: 'Operacoes e rotinas especificas do modulo ALFA.',
  },
];

export function Farma() {
  return (
    <section>
      <h1>FARMA</h1>
      <p>Selecione uma funcionalidade para acessar o modulo.</p>
      <div className="grid">
        {farmaFeatures.map((feature) => (
          <article className="card feature-card" key={feature.slug}>
            <h2>{feature.title}</h2>
            <p>{feature.description}</p>
            <Link className="feature-link" to={`/farma/${feature.slug}`}>
              Abrir
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
