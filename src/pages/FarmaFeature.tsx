import { Link, useParams } from 'react-router-dom';
import { AlfaPage } from './farma/AlfaPage';
import { CadastroClientesPage } from './farma/CadastroClientesPage';
import { CompensacoesPage } from './farma/CompensacoesPage';
import { NegociacoesPage } from './farma/NegociacoesPage';
import { NotificacaoExtrajudicialPage } from './farma/NotificacaoExtrajudicialPage';
import { TransferenciasPage } from './farma/TransferenciasPage';
import type { FarmaFeatureSlug } from './farma/types';

const components: Record<FarmaFeatureSlug, () => JSX.Element> = {
  negociacoes: NegociacoesPage,
  compensacoes: CompensacoesPage,
  transferencias: TransferenciasPage,
  'cadastro-clientes': CadastroClientesPage,
  'notificacao-extrajudicial': NotificacaoExtrajudicialPage,
  alfa: AlfaPage,
};

export function FarmaFeature() {
  const { feature } = useParams();
  const key = feature as FarmaFeatureSlug | undefined;
  const FeatureComponent = key ? components[key] : undefined;

  if (!FeatureComponent) {
    return (
      <section className="card">
        <h1>Funcionalidade nao encontrada</h1>
        <p>O modulo solicitado nao existe para o perfil FARMA.</p>
        <Link to="/farma">Voltar para FARMA</Link>
      </section>
    );
  }

  return <FeatureComponent />;
}
