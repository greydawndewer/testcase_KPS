import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { LogIn, ArrowLeft } from 'lucide-react';

const BACKEND_URL = (
  import.meta.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:8000"
).replace(/\/+$/, "");
const API = `${BACKEND_URL}/api`;

const LoginPage = ({ onLogin, darkMode }) => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoTeachers, setDemoTeachers] = useState([]);
  const [demoTeachersError, setDemoTeachersError] = useState('');

  useEffect(() => {
    let active = true;

    axios.get(`${API}/auth/demo-teachers`)
      .then(({ data }) => {
        if (active) setDemoTeachers(data);
      })
      .catch(() => {
        if (active) {
          setDemoTeachersError('Demo account details are temporarily unavailable.');
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post(`${API}/auth/login`, {
        username,
        password
      });

      const { token, user } = response.data;
      onLogin(token, user);

      toast.success(`Welcome back, ${user.name}!`);

      if (user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
      if (axios.isAxiosError(error) && !error.response) {
        toast.error(
          `Can't reach the backend at ${BACKEND_URL}. Start the backend and check its MongoDB connection.`,
        );
      } else {
        toast.error(
          error.response?.data?.detail ||
            'Login failed. Please check your username and password.',
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page page-transition flex items-center justify-center relative overflow-hidden">
      <div className="absolute top-0 left-0 w-96 h-96 bg-blue-200 dark:bg-blue-900 rounded-full filter blur-3xl opacity-20 -translate-x-1/2 -translate-y-1/2"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-200 dark:bg-purple-900 rounded-full filter blur-3xl opacity-20 translate-x-1/2 translate-y-1/2"></div>

      
      <Button
        onClick={() => navigate('/')}
        variant="ghost"
        className="absolute top-4 left-4 sm:top-8 sm:left-8"
        data-testid="back-to-home-button"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back
      </Button>

      <div className="relative z-10 w-full max-w-md">
        <div className="login-card glass p-5 sm:p-8 rounded-3xl shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-4">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-4 rounded-2xl">
                <LogIn className="w-8 h-8 text-white" />
              </div>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Welcome Back</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">Sign in to access your dashboard</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-gray-700 dark:text-gray-300">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600"
                data-testid="username-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-700 dark:text-gray-300">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600"
                data-testid="password-input"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white py-6 rounded-xl shadow-lg hover:shadow-xl"
              data-testid="login-submit-button"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          <section className="demo-account-panel" aria-labelledby="demo-account-heading">
            <div className="mb-3 text-center">
              <h3 id="demo-account-heading" className="text-sm font-semibold text-gray-900 dark:text-white">
                Demo teacher accounts
              </h3>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Usernames are loaded from the database. Ask the administrator for a password.
              </p>
            </div>
            {demoTeachersError ? (
              <p className="demo-account-message" role="status">{demoTeachersError}</p>
            ) : demoTeachers.length > 0 ? (
              <div className="space-y-2">
                {demoTeachers.map((teacher) => (
                  <button
                    className="demo-account"
                    key={teacher.username}
                    onClick={() => setUsername(teacher.username)}
                    type="button"
                    aria-label={`Use username ${teacher.username}`}
                  >
                    <span className="demo-account-role">{teacher.name}</span>
                    <span>
                      <strong>Username</strong>
                      <code>{teacher.username}</code>
                    </span>
                    <span>
                      <strong>Password</strong>
                      <code>Not displayed</code>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="demo-account-message" role="status">
                Loading demo teacher accounts…
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
