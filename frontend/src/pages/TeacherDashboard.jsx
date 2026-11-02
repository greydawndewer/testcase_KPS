import { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { LogOut, Moon, Sun, RefreshCw, QrCode } from 'lucide-react';
import TimetableGrid from '../components/TimetableGrid';
import ChangeLogPanel from '../components/ChangeLogPanel';
import QRCodeModal from '../components/QRCodeModal';

const BACKEND_URL =
  import.meta.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:8000";
const API = `${BACKEND_URL}/api`;

const TeacherDashboard = ({ user, token, onLogout, exhibitionMode, darkMode, setDarkMode }) => {
  const [schedules, setSchedules] = useState([]);
  const [breakAfter, setBreakAfter] = useState(3);
  const [changelogs, setChangelogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, [user.id]);

  const fetchData = async () => {
    try {
      const [schedulesRes, settingsRes, changelogsRes] = await Promise.all([
        axios.get(`${API}/schedules`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/settings/break-period`),
        axios.get(`${API}/changelogs`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      setSchedules(schedulesRes.data);
      setBreakAfter(settingsRes.data.break_after_period);
      setChangelogs(changelogsRes.data);
      return true;
    } catch (error) {
      toast.error('Failed to load schedule');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    if (await fetchData()) {
      toast.success('Schedule checked for updates');
    }
    setRefreshing(false);
  };

  const isRecentChange = (updatedAt) => {
    const now = new Date();
    const updated = new Date(updatedAt);
    const hoursDiff = (now - updated) / (1000 * 60 * 60);
    return hoursDiff >= 0 && hoursDiff < 24;
  };
  const latestScheduleUpdate = changelogs.reduce((latest, log) => {
    const timestamp = new Date(log.timestamp);
    if (Number.isNaN(timestamp.getTime())) return latest;
    return !latest || timestamp > latest ? timestamp : latest;
  }, null);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="dashboard-page page-transition">
      {exhibitionMode && (
        <div className="exhibition-badge">Exhibition Mode Active</div>
      )}

      {/* Header */}
      <div className="dashboard-shell mx-auto">
        <div className="dashboard-header flex justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Schedule</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Welcome, {user.name}</p>
          </div>
          <div className="dashboard-actions flex items-center">
            <Button
              onClick={() => setShowQRModal(true)}
              variant="outline"
              size="sm"
              data-testid="qr-code-button"
            >
              <QrCode className="w-4 h-4 mr-2" />
              QR Login
            </Button>
            <Button
              onClick={handleRefresh}
              variant="outline"
              size="sm"
              disabled={refreshing}
              data-testid="refresh-button"
            >
              <RefreshCw className={`w-4 h-4 mr-2${refreshing ? ' animate-spin' : ''}`} />
              {refreshing ? 'Checking…' : 'Check for updates'}
            </Button>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="bg-white dark:bg-slate-800 p-2 rounded-lg shadow hover:shadow-lg"
              data-testid="dark-mode-toggle"
            >
              {darkMode ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5 text-slate-700" />}
            </button>
            <Button onClick={onLogout} variant="outline" data-testid="logout-button">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        {/* Main content grid */}
        <div className="teacher-dashboard-content grid gap-6">
          {/* Timetable */}
          <div>
            <div className="glass p-4 sm:p-6 rounded-2xl">
              <div className="admin-section-header flex justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Weekly Timetable</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Last schedule update:{' '}
                  {latestScheduleUpdate
                    ? latestScheduleUpdate.toLocaleString()
                    : 'No updates yet'}
                </p>
              </div>

              <TimetableGrid
                schedules={schedules}
                breakAfter={breakAfter}
                isRecentChange={isRecentChange}
                isAdmin={false}
              />

              {schedules.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-500 dark:text-gray-400">No schedule assigned yet</p>
                </div>
              )}
            </div>
          </div>

          <ChangeLogPanel changelogs={changelogs} />
        </div>
      </div>

      {/* QR Code Modal */}
      <QRCodeModal open={showQRModal} onClose={() => setShowQRModal(false)} />
    </div>
  );
};

export default TeacherDashboard;
