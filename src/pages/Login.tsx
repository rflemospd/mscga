import { FormEvent, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getCooldownRemaining, login } from '../auth/auth';

export function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const id = window.setInterval(() => setCooldown(getCooldownRemaining()), 500);
    return () => clearInterval(id);
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = await login(username, password);
    setMessage(result.message);

    if (result.ok) {
      const from = (location.state as { from?: string })?.from ?? '/home';
      navigate(from, { replace: true });
    } else {
      setPassword('');
      setCooldown(getCooldownRemaining());
    }
  }

  return (
    <section className="card login-card">
      <h1>Login interno</h1>
      <p>Informe credenciais fornecidas pelo usuário mestre.</p>
      <form onSubmit={onSubmit}>
        <label htmlFor="username">Usuário</label>
        <input
          id="username"
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          required
        />

        <label htmlFor="password">Senha</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        <button type="submit" disabled={cooldown > 0}>
          {cooldown > 0 ? `Aguarde ${Math.ceil(cooldown / 1000)}s` : 'Entrar'}
        </button>
      </form>
      <p aria-live="polite">{message}</p>
    </section>
  );
}
