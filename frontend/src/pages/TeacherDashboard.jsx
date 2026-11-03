import { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';
import { LogOut, Moon, Sun, RefreshCw, QrCode } from 'lucide-react';
import TimetableGrid from '../components/TimetableGrid';
import ChangeLogPanel from '../components/ChangeLogPanel';
import QRCodeModal from '../components/QRCodeModal';
import ProfileShutter from '../components/ProfileShutter';

//import.meta.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:8000";
const BACKEND_URL = import.meta.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:8000";
const API = `${BACKEND_URL}/api`;
const mapBellSchedule = (data) => ({
  ...data,
  baselinePeriodTimes: data.baseline_period_times || data.period_times || [],
  periodTimes: data.period_times || [],
  dayPeriodTimes: data.day_period_times || {},
  breakAfterPeriod: data.break_after_period ?? 3,
  breakDurationMinutes: data.break_duration_minutes ?? 15,
});

const TeacherDashboard = ({ user, token, onLogout, exhibitionMode, darkMode, setDarkMode }) => {
  const [schedules, setSchedules] = useState([]);
  const [breakAfter, setBreakAfter] = useState(3);
  const [bellSchedule, setBellSchedule] = useState(null);
  const [changelogs, setChangelogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [teacherNoteDraft, setTeacherNoteDraft] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const authHeaders = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    const initialize = async () => {
      try {
        await axios.delete(`${API}/changelogs`, { headers: authHeaders });
        setChangelogs([]);
      } catch (error) {
        toast.error(error.response?.data?.detail || 'Could not clear previous schedule updates');
      }
      fetchData();
    };
    initialize();
    const handleVisible = () => {
      if (!document.hidden) fetchData();
    };
    window.addEventListener('focus', handleVisible);
    document.addEventListener('visibilitychange', handleVisible);
    return () => {
      window.removeEventListener('focus', handleVisible);
      document.removeEventListener('visibilitychange', handleVisible);
    };
  }, [user.id]);

  const fetchData = async () => {
    try {
      const [schedulesRes, settingsRes, changelogsRes] = await Promise.all([
        axios.get(`${API}/schedules`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/settings/bell-schedule`, { headers: authHeaders }),
        axios.get(`${API}/changelogs`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      setSchedules(schedulesRes.data);
      setBreakAfter(settingsRes.data.break_after_period);
      setChangelogs(changelogsRes.data);
      const bellScheduleResponse = await axios.get(`${API}/settings/bell-schedule`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBellSchedule(mapBellSchedule(bellScheduleResponse.data));
      setBreakAfter(bellScheduleResponse.data.break_after_period);
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
    let cleared = false;
    try {
      await axios.delete(`${API}/changelogs`, { headers: authHeaders });
      setChangelogs([]);
      cleared = true;
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not clear previous schedule updates');
    }
    if (await fetchData() && cleared) toast.success('Schedule checked for updates');
    setRefreshing(false);
  };

  const handleLogout = async () => {
    try {
      await axios.delete(`${API}/changelogs`, { headers: authHeaders });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not clear schedule updates before logout');
    } finally {
      onLogout();
    }
  };

  const handleDismissChange = async (log) => {
    try {
      await axios.delete(`${API}/changelogs/${log.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setChangelogs(current => current.filter(entry => entry.id !== log.id));
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not dismiss this update');
    }
  };

  const handleClearAllChanges = async () => {
    if (!window.confirm('Clear all schedule updates for your account?')) return;
    try {
      await axios.delete(`${API}/changelogs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setChangelogs([]);
      toast.success('All schedule updates cleared');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not clear schedule updates');
    }
  };

  const isRecentChange = (schedule) => changelogs.some(log => log.schedule_id === schedule.id);
  const handlePeriodClick = (schedule) => {
    setSelectedPeriod(schedule);
    setTeacherNoteDraft(schedule.teacher_note || '');
  };
  const handleSaveTeacherNote = async (event) => {
    event.preventDefault();
    if (!selectedPeriod) return;
    if (!window.confirm('Save your private note for this period?')) return;
    setSavingNote(true);
    try {
      const { data } = await axios.put(
        `${API}/schedules/${selectedPeriod.id}/note`,
        { teacher_note: teacherNoteDraft },
        { headers: authHeaders },
      );
      setSchedules(current => current.map(schedule => (
        schedule.id === data.id ? data : schedule
      )));
      setSelectedPeriod(data);
      toast.success('Period note saved');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not save your period note');
    } finally {
      setSavingNote(false);
    }
  };
  const latestScheduleUpdate = changelogs.reduce((latest, log) => {
    const timestamp = new Date(log.timestamp);
    if (Number.isNaN(timestamp.getTime())) return latest;
    return !latest || timestamp > latest ? timestamp : latest;
  }, null);
  const latestScheduleTimestamp = schedules.reduce((latest, schedule) => {
    const timestamp = new Date(schedule.updated_at);
    if (Number.isNaN(timestamp.getTime())) return latest;
    return !latest || timestamp > latest ? timestamp : latest;
  }, latestScheduleUpdate);

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
      <div className="dashboard-shell teacher-dashboard-shell mx-auto">
        <div className="dashboard-header flex justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Schedule</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Welcome, {user.name}</p>
            <p className="mt-1 text-sm font-semibold text-gray-700 dark:text-gray-300">
              It’s {bellSchedule?.today || '—'}
            </p>
          </div>
          <div className="dashboard-actions flex items-center">
            <div
              className="mr-2 rounded-lg border border-gray-200 bg-white/80 px-3 py-1.5 text-right dark:border-slate-700 dark:bg-slate-800/80"
              data-testid="today-date-panel"
            >
              <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Today
              </p>
              <p className="text-xs font-semibold text-gray-800 dark:text-gray-100">
                {new Intl.DateTimeFormat('en-IN', {
                  dateStyle: 'medium',
                  timeZone: bellSchedule?.school_timezone || 'Asia/Kolkata',
                }).format(new Date())}
              </p>
            </div>
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
            <Button onClick={handleLogout} variant="outline" data-testid="logout-button">
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
                  {latestScheduleTimestamp
                    ? latestScheduleTimestamp.toLocaleString()
                    : 'No updates yet'}
                </p>
              </div>

              <TimetableGrid
                schedules={schedules}
                breakAfter={breakAfter}
                periodTimes={bellSchedule?.periodTimes || []}
                baselinePeriodTimes={bellSchedule?.baselinePeriodTimes || []}
                dayPeriodTimes={bellSchedule?.dayPeriodTimes}
                holidays={bellSchedule?.holidays || []}
                changelogs={changelogs}
                breakDurationMinutes={bellSchedule?.breakDurationMinutes}
                isRecentChange={isRecentChange}
                onCellClick={handlePeriodClick}
                isAdmin={false}
              />

              {schedules.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-500 dark:text-gray-400">No schedule assigned yet</p>
                </div>
              )}
            </div>
          </div>

          <ChangeLogPanel
            changelogs={changelogs}
            onDismiss={handleDismissChange}
            onClearAll={handleClearAllChanges}
          />
        </div>
      </div>

      {/* QR Code Modal */}
      <QRCodeModal open={showQRModal} onClose={() => setShowQRModal(false)} />
      <Dialog open={Boolean(selectedPeriod)} onOpenChange={open => {
        if (!open) setSelectedPeriod(null);
      }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedPeriod?.subject}</DialogTitle>
            <DialogDescription>
              {selectedPeriod?.day}, Period {selectedPeriod?.period} · {selectedPeriod?.class_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="rounded-lg border border-gray-200 p-3 text-sm text-gray-700 dark:border-slate-700 dark:text-gray-200">
              Time: {bellSchedule?.dayPeriodTimes?.[selectedPeriod?.day]?.[selectedPeriod?.period - 1]?.start || 'Not configured'}
              {bellSchedule?.dayPeriodTimes?.[selectedPeriod?.day]?.[selectedPeriod?.period - 1]?.end
                ? `–${bellSchedule.dayPeriodTimes[selectedPeriod.day][selectedPeriod.period - 1].end}`
                : ''}
            </p>
            <form onSubmit={handleSaveTeacherNote} className="space-y-3">
              <label htmlFor="teacher-period-note" className="block text-sm font-medium text-gray-900 dark:text-white">
                Your note
              </label>
              <Textarea id="teacher-period-note" maxLength={1000} rows={4} value={teacherNoteDraft}
                onChange={event => setTeacherNoteDraft(event.target.value)}
                placeholder="Add a note for this period" />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setSelectedPeriod(null)}>Close</Button>
                <Button type="submit" disabled={savingNote}>
                  {savingNote ? 'Saving…' : 'Save note'}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>
      <ProfileShutter user={user} token={token} />
    </div>
  );
};

export default TeacherDashboard;
