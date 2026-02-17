import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <section className="card">
      <h1>Página não encontrada</h1>
      <Link to="/home">Ir para home</Link>
    </section>
  );
}
