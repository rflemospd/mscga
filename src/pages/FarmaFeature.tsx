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

  const pathname = window.location.pathname || '/';
  const base = pathname.endsWith('/') ? pathname : `${pathname}/`;
  const iframeSrc = `${base}farma-cobtool/index.html?page=${encodeURIComponent(selected.cobtoolPage)}`;

  return (
    <section className="farma-module">
      <div className="card">
        <h1>{selected.title}</h1>
        <p>Modulo legado migrado do Cobtool para o MSCGA.</p>
        <div className="farma-module-actions">
          <Link to="/farma">Voltar para FARMA</Link>
          <a href={iframeSrc} target="_blank" rel="noreferrer">
            Abrir em nova aba
          </a>
        </div>
      </div>
      <iframe className="farma-module-frame" key={selected.slug} src={iframeSrc} title={`Modulo ${selected.title}`} />
    </section>
  );
}
