import { FormEvent, useMemo, useState } from 'react';

type View = 'login' | 'dashboard';

type ActivityItem = {
  id: string;
  title: string;
  details: string;
  createdAt: string;
};

const SESSION_KEY = 'dashboard-session';
const DATA_KEY = 'dashboard-activities';
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin';

function hasSession(): boolean {
  return sessionStorage.getItem(SESSION_KEY) === 'ok';
}

function loadActivities(): ActivityItem[] {
  const raw = localStorage.getItem(DATA_KEY);
  if (!raw) return [];

  try {
    return JSON.parse(raw) as ActivityItem[];
  } catch {
    return [];
  }
}

function saveActivities(items: ActivityItem[]): void {
  localStorage.setItem(DATA_KEY, JSON.stringify(items));
}

export default function App() {
  const [view, setView] = useState<View>(() => (hasSession() ? 'dashboard' : 'login'));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [activities, setActivities] = useState<ActivityItem[]>(() => loadActivities());

  const total = useMemo(() => activities.length, [activities]);

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, 'ok');
      setError('');
      setPassword('');
      setView('dashboard');
      return;
    }

    setError('Credenciais inválidas');
    setPassword('');
  }

  function handleLogout() {
    sessionStorage.removeItem(SESSION_KEY);
    setUsername('');
    setPassword('');
    setError('');
    setView('login');
  }

  function addActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;

    const next: ActivityItem = {
      id: crypto.randomUUID(),
      title: title.trim(),
      details: details.trim(),
      createdAt: new Date().toISOString(),
    };

    const updated = [next, ...activities];
    setActivities(updated);
    saveActivities(updated);
    setTitle('');
    setDetails('');
  }

  function removeActivity(id: string) {
    const updated = activities.filter((item) => item.id !== id);
    setActivities(updated);
    saveActivities(updated);
  }

  if (view === 'dashboard') {
    return (
      <div className="app">
        <header className="topbar">
          <h1>Dashboard</h1>
          <div className="top-actions">
            <span>Total: {total}</span>
            <button className="logout" onClick={handleLogout}>
              Sair
            </button>
          </div>
        </header>

        <main className="dashboard-wrap">
          <section className="panel">
            <h2>Nova atividade</h2>
            <form onSubmit={addActivity}>
              <label htmlFor="title">Título</label>
              <input
                id="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ex: Revisar relatório"
                required
              />

              <label htmlFor="details">Detalhes</label>
              <textarea
                id="details"
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                placeholder="Descreva a atividade"
                rows={4}
              />

              <button type="submit">Salvar atividade</button>
            </form>
          </section>

          <section className="panel">
            <h2>Atividades salvas</h2>
            {activities.length === 0 ? (
              <p>Nenhuma atividade cadastrada.</p>
            ) : (
              <ul className="activity-list">
                {activities.map((item: ActivityItem) => (
                  <li key={item.id}>
                    <div>
                      <strong>{item.title}</strong>
                      {item.details ? <p>{item.details}</p> : null}
                      <small>{new Date(item.createdAt).toLocaleString('pt-BR')}</small>
                    </div>
                    <button className="danger" onClick={() => removeActivity(item.id)}>
                      Excluir
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="app center">
      <form className="login-card" onSubmit={handleLogin}>
        <h1>Login do Dashboard</h1>
        <label htmlFor="username">Usuário</label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          required
        />

        <label htmlFor="password">Senha</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        <button type="submit">Entrar</button>
        {error ? <p className="error">{error}</p> : null}
      </form>
    </div>
  );
}
