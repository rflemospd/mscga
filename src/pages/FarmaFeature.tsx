import { Link, useParams } from 'react-router-dom';
import { farmaFeatures } from './Farma';
import { useEffect } from 'react';

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

  const pathname = window.location.pathname || '/';
  const base = pathname.endsWith('/') ? pathname : `${pathname}/`;
  const toolUrl = `${base}farma-cobtool/index.html?page=${encodeURIComponent(selected.cobtoolPage)}`;

  useEffect(() => {
    window.location.assign(toolUrl);
  }, [toolUrl]);

  return (
    <section className="card">
      <h1>{selected.title}</h1>
      <p>Abrindo funcionalidade...</p>
      <p>
        Se o redirecionamento nao acontecer automaticamente, clique em{' '}
        <a href={toolUrl}>abrir modulo</a>.
      </p>
      <Link to="/farma">Voltar para FARMA</Link>
    </section>
  );
}
