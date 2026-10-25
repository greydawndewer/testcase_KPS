import { lazy, Suspense, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from './components/ui/sonner';
import BackendStatusNotice from './components/BackendStatusNotice';
import CursorGlow from './components/CursorGlow';
import './lib/backendRequestMonitor';
import '@/App.css';

const HomePage = lazy(() => import('./pages/HomePage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const TeacherDashboard = lazy(() => import('./pages/TeacherDashboard'));

const readStoredSession = () => {
  const token = localStorage.getItem('token');
  const storedUser = localStorage.getItem('user');

  if (!token || !storedUser) {
    return { token: null, user: null };
  }

  try {
    const user = JSON.parse(storedUser);
    if (user && ['admin', 'teacher'].includes(user.role)) {
      return { token, user };
    }
  } catch {
    // Discard invalid saved session data and require a fresh login.
  }

  localStorage.removeItem('token');
  localStorage.removeItem('user');
  return { token: null, user: null };
};

function App() {
  const [session, setSession] = useState(readStoredSession);
  const { token, user } = session;
  const [exhibitionMode, setExhibitionMode] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const handleLogin = (newToken, userData) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setSession({ token: newToken, user: userData });
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setSession({ token: null, user: null });
  };

  const ProtectedRoute = ({ children, requiredRole }) => {
    if (!token || !user) {
      return <Navigate to="/login" replace />;
    }
    if (requiredRole && user.role !== requiredRole) {
      return <Navigate to="/" replace />;
    }
    return children;
  };

  return (
    <div className="App">
      <BrowserRouter>
        <main className="app-main">
          <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="spinner" /></div>}>
            <Routes>
              <Route
                path="/"
                element={
                  <HomePage
                    exhibitionMode={exhibitionMode}
                    setExhibitionMode={setExhibitionMode}
                    darkMode={darkMode}
                    setDarkMode={setDarkMode}
                    isAuthenticated={!!token}
                    user={user}
                  />
                }
              />
              <Route
                path="/login"
                element={
                  token ? <Navigate to={user?.role === 'admin' ? '/admin' : '/dashboard'} replace /> :
                  <LoginPage onLogin={handleLogin} darkMode={darkMode} />
                }
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <AdminDashboard
                      user={user}
                      token={token}
                      onLogout={handleLogout}
                      exhibitionMode={exhibitionMode}
                      darkMode={darkMode}
                      setDarkMode={setDarkMode}
                    />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute requiredRole="teacher">
                    <TeacherDashboard
                      user={user}
                      token={token}
                      onLogout={handleLogout}
                      exhibitionMode={exhibitionMode}
                      darkMode={darkMode}
                      setDarkMode={setDarkMode}
                    />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </Suspense>
        </main>
      </BrowserRouter>
      <footer className="app-footer">@KPSKADMA</footer>
      <Toaster position="top-right" richColors />
      <BackendStatusNotice />
      <CursorGlow />
    </div>
  );
}

export default App;
