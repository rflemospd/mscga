import { Link, useParams } from 'react-router-dom';
import { farmaFeatures } from './Farma';

export function FarmaFeature() {
  const { feature } = useParams();
  const selected = farmaFeatures.find((item) => item.slug === feature);

  if (!selected) {
    return (
      <section className="card">
        <h1>Funcionalidade nao encontrada</h1>
        <p>O modulo solicitado nao existe para o perfil FARMA.</p>
        <Link to="/farma">Voltar para FARMA</Link>
      </section>
    );
  }

  return (
    <section className="card">
      <h1>{selected.title}</h1>
      <p>Pagina inicial da funcionalidade {selected.title}.</p>
      <p>Aqui vamos evoluir as regras e automacoes especificas do modulo.</p>
      <Link to="/farma">Voltar para FARMA</Link>
    </section>
  );
}
