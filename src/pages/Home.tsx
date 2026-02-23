import { getSession } from '../auth/auth';
import { cardPermissions } from '../auth/permissions';

const cards: Record<string, { title: string; body: string }> = {
  status: { title: 'Status', body: 'Visão geral de disponibilidade e saúde dos serviços.' },
  news: { title: 'Comunicados', body: 'Notícias internas e mudanças recentes.' },
  operations: { title: 'Operações', body: 'Checklist operacional diário para time de farma.' },
  adminGuide: { title: 'Administração', body: 'Procedimentos de revisão de usuários e papéis.' },
};

export function Home() {
  const session = getSession();
  if (!session) return null;

  return (
    <section>
      <h1>Home</h1>
      <p>Conteúdo filtrado por perfil.</p>
      <div className="grid">
        {cardPermissions[session.role].map((card) => (
          <article className="card" key={card}>
            <h2>{cards[card].title}</h2>
            <p>{cards[card].body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
