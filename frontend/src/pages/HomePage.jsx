import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { Moon, Sun, Sparkles } from 'lucide-react';

const HomePage = ({ exhibitionMode, setExhibitionMode, darkMode, setDarkMode, isAuthenticated, user }) => {
  const navigate = useNavigate();

  const handleGetStarted = () => {
    if (isAuthenticated) {
      navigate(user?.role === 'admin' ? '/admin' : '/dashboard');
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="home-page flex flex-col items-center justify-center px-4 sm:px-6 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-blue-200 dark:bg-blue-900 rounded-full filter blur-3xl opacity-20 -translate-x-1/2 -translate-y-1/2"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-200 dark:bg-purple-900 rounded-full filter blur-3xl opacity-20 translate-x-1/2 translate-y-1/2"></div>

      {/* Top controls */}
      <div className="home-controls absolute flex items-center z-10">
        {/* Exhibition Mode Toggle */}
        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-4 py-2 rounded-full shadow-lg">
          <Sparkles className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Exhibition</span>
          <Switch
            checked={exhibitionMode}
            onCheckedChange={setExhibitionMode}
            data-testid="exhibition-mode-toggle"
          />
        </div>

        {/* Dark Mode Toggle */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="bg-white dark:bg-slate-800 p-3 rounded-full shadow-lg hover:shadow-xl"
          data-testid="dark-mode-toggle"
          aria-label="Toggle dark mode"
        >
          {darkMode ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5 text-slate-700" />}
        </button>
      </div>

      {/* Exhibition badge */}
      {exhibitionMode && (
        <div className="exhibition-badge" data-testid="exhibition-badge">
          Exhibition Mode Active
        </div>
      )}

      {/* Main content */}
      <div className="home-content relative z-10 text-center space-y-8">
        {/* Logo/Icon */}
        <div className="flex justify-center mb-8">
          <div className="relative">
            <div className="absolute inset-0 bg-blue-500 rounded-full blur-2xl opacity-30 animate-pulse"></div>
            <div className="relative bg-gradient-to-br from-blue-500 to-blue-600 p-5 sm:p-8 rounded-3xl shadow-2xl">
            <svg className="w-14 h-14 sm:w-20 sm:h-20 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="space-y-4">
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold text-gray-900 dark:text-white leading-tight">
            School Scheduling
            <br />
            <span className="bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent">
              Management System
            </span>
          </h1>

          <p className="text-base sm:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Streamline your school's timetable management with real-time updates,
            conflict detection, and seamless teacher coordination.
          </p>
        </div>

        {/* CTA Button */}
        <div className="pt-6">
          <Button
            onClick={handleGetStarted}
            size="lg"
            className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white px-9 sm:px-12 py-6 text-lg rounded-full shadow-xl hover:shadow-2xl"
            data-testid="login-button"
          >
            {isAuthenticated ? 'Go to Dashboard' : 'Login'}
          </Button>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 pt-8 sm:pt-12 text-left">
          <div className="glass p-6 rounded-2xl text-left space-y-2">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-xl flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Real-time Updates</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Teachers get instant notifications when schedules change</p>
          </div>

          <div className="glass p-6 rounded-2xl text-left space-y-2">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-xl flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Conflict Detection</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Automatically prevent double-booking and scheduling errors</p>
          </div>

          <div className="glass p-6 rounded-2xl text-left space-y-2">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-xl flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Easy Management</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Simple interface for admins to manage teachers and schedules</p>
          </div>
        </div>

        {/* Credits */}
        <div className="pt-8">
          <p className="text-sm text-gray-500 dark:text-gray-500 flex items-center justify-center gap-2">
            <span>Created by</span>
            <a
              href="https://bento.me/buffer"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Yuvraj
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
