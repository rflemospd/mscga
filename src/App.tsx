import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { logout, useSession } from './auth/auth';
import { RouteGuard } from './auth/guards';
import { hasAccessToRoute } from './auth/permissions';
import { Admin } from './pages/Admin';
import { Denied } from './pages/Denied';
import { Home } from './pages/Home';
import { Info } from './pages/Info';
import { Login } from './pages/Login';
import { NotFound } from './pages/NotFound';
import { Restricted } from './pages/Restricted';

function Header() {
  const session = useSession();
  const location = useLocation();

  if (!session || location.pathname === '/login') return null;

  return (
    <header className="topbar">
      <nav>
        <Link to="/home">Home</Link>
        <Link to="/info">Info</Link>
        {hasAccessToRoute(session.role, '/restricted') && <Link to="/restricted">Restricted</Link>}
        {hasAccessToRoute(session.role, '/admin') && <Link to="/admin">Admin</Link>}
      </nav>
      <div className="session-info">
        <span>
          {session.username} ({session.role})
        </span>
        <span>Último login: {new Date(session.loginAt).toLocaleString('pt-BR')}</span>
        <button onClick={logout}>Sair</button>
      </div>
    </header>
  );
}

export default function App() {
  return (
    <div className="app-shell">
      <Header />
      <main>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route element={<RouteGuard />}>
            <Route path="/home" element={<Home />} />
            <Route path="/info" element={<Info />} />
            <Route path="/restricted" element={<RouteGuard requiredRole="farma" element={<Restricted />} />} />
            <Route path="/admin" element={<RouteGuard requiredRole="admin" element={<Admin />} />} />
            <Route path="/denied" element={<Denied />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}
