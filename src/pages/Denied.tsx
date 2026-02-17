import { Link } from 'react-router-dom';

export function Denied() {
  return (
    <section className="card">
      <h1>Acesso negado</h1>
      <p>Seu perfil não possui permissão para esta rota.</p>
      <Link to="/home">Voltar para home</Link>
    </section>
  );
}
