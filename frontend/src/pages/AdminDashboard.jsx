import { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { LogOut, Moon, Sun, Users, Calendar, Settings as SettingsIcon, Plus, Trash2, QrCode } from 'lucide-react';
import TimetableGrid from '../components/TimetableGrid';
import QRCodeModal from '../components/QRCodeModal';

const BACKEND_URL =
  import.meta.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:8000";
const API = `${BACKEND_URL}/api`;

const AdminDashboard = ({ user, token, onLogout, exhibitionMode, darkMode, setDarkMode }) => {
  const [teachers, setTeachers] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [breakAfter, setBreakAfter] = useState(3);
  const [loading, setLoading] = useState(true);
  const [showAddTeacher, setShowAddTeacher] = useState(false);
  const [showAddSchedule, setShowAddSchedule] = useState(false);
  const [showEditSchedule, setShowEditSchedule] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [newSchedule, setNewSchedule] = useState({
    teacherId: '',
    day: '',
    period: '',
    subject: '',
    className: ''
  });

  const [newTeacher, setNewTeacher] = useState({
    username: '',
    password: '',
    name: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [teachersRes, schedulesRes, settingsRes] = await Promise.all([
        axios.get(`${API}/users`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/schedules`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/settings/break-period`)
      ]);

      setTeachers(teachersRes.data.filter(u => u.role === 'teacher'));
      setSchedules(schedulesRes.data);
      setBreakAfter(settingsRes.data.break_after_period);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTeacher = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/users`, newTeacher, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Teacher added successfully');
      setShowAddTeacher(false);
      setNewTeacher({ username: '', password: '', name: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add teacher');
    }
  };

  const handleDeleteTeacher = async (teacherId) => {
    if (!window.confirm('Are you sure you want to delete this teacher?')) return;

    try {
      await axios.delete(`${API}/users/${teacherId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Teacher deleted successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete teacher');
    }
  };

  const handleUpdateBreak = async (value) => {
    try {
      await axios.put(`${API}/settings/break-period?break_after=${value}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBreakAfter(value);
      toast.success(`Break period updated to after Period ${value}`);
    } catch (error) {
      toast.error('Failed to update break period');
    }
  };

  const handleScheduleClick = (schedule) => {
    setSelectedSchedule(schedule);
    setShowEditSchedule(true);
  };

  const handleUpdateSchedule = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const updateData = {
      subject: formData.get('subject'),
      class_name: formData.get('class_name')
    };

    try {
      await axios.put(`${API}/schedules/${selectedSchedule.id}`, updateData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Schedule updated successfully');
      setShowEditSchedule(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update schedule');
    }
  };

  const handleAddScheduleEntry = (day, period) => {
    setNewSchedule({
      teacherId: selectedTeacher || '',
      day,
      period,
      subject: '',
      className: ''
    });
    setShowAddSchedule(true);
  };

  const handleCreateSchedule = async (e) => {
    e.preventDefault();
    const teacher = teachers.find(t => t.id === newSchedule.teacherId);
    if (!teacher) {
      toast.error('Please select a teacher');
      return;
    }
    if (!newSchedule.subject.trim() || !newSchedule.className.trim()) {
      toast.error('Enter both a subject and a class');
      return;
    }

    try {
      await axios.post(`${API}/schedules`, {
        teacher_id: teacher.id,
        teacher_name: teacher.name,
        day: newSchedule.day,
        period: newSchedule.period,
        subject: newSchedule.subject.trim(),
        class_name: newSchedule.className.trim()
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Schedule entry added');
      setShowAddSchedule(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add schedule');
    }
  };

  const handleDeleteSchedule = async (scheduleId) => {
    if (!window.confirm('Delete this schedule entry?')) return;

    try {
      await axios.delete(`${API}/schedules/${scheduleId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Schedule deleted');
      setShowEditSchedule(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to delete schedule');
    }
  };

  const handleLoadDemoSchedules = async () => {
    if (!window.confirm('This will replace all existing schedules with demo data. Continue?')) return;

    try {
      await axios.post(`${API}/demo/load-schedules`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Demo schedules loaded successfully!');
      fetchData();
    } catch (error) {
      toast.error('Failed to load demo schedules');
    }
  };

  const handleClearAllSchedules = async () => {
    if (!window.confirm('This will delete ALL schedules and changelogs. Are you sure?')) return;

    try {
      await axios.post(`${API}/demo/clear-schedules`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('All schedules cleared');
      fetchData();
    } catch (error) {
      toast.error('Failed to clear schedules');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      {exhibitionMode && (
        <div className="exhibition-badge">Exhibition Mode Active</div>
      )}

      {/* Header */}
      <div className="dashboard-shell mx-auto">
        <div className="dashboard-header flex justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
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

        {/* Tabs */}
        <Tabs defaultValue="schedules" className="space-y-6">
          <TabsList className="dashboard-tabs bg-white dark:bg-slate-800 shadow-sm">
            <TabsTrigger value="schedules" data-testid="schedules-tab">
              <Calendar className="w-4 h-4 mr-2" />
              Schedules
            </TabsTrigger>
            <TabsTrigger value="teachers" data-testid="teachers-tab">
              <Users className="w-4 h-4 mr-2" />
              Teachers
            </TabsTrigger>
            <TabsTrigger value="settings" data-testid="settings-tab">
              <SettingsIcon className="w-4 h-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Schedules Tab */}
          <TabsContent value="schedules" className="space-y-4">
            <div className="glass p-4 sm:p-6 rounded-2xl">
              <div className="admin-schedule-header mb-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Manage Timetable</h2>
                <div className="admin-teacher-selector">
                  <Label htmlFor="admin-teacher-select" className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                    Select a teacher to manage their timetable
                  </Label>
                  <Select
                    value={selectedTeacher || undefined}
                    onValueChange={setSelectedTeacher}
                  >
                    <SelectTrigger
                      id="admin-teacher-select"
                      className="admin-teacher-select-trigger"
                      data-testid="teacher-select"
                    >
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      {teachers.map(teacher => (
                        <SelectItem key={teacher.id} value={teacher.id}>
                          {teacher.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {selectedTeacher ? (
                <>
                  <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
                    Select an empty cell to add a lesson, or an existing lesson to edit it.
                  </p>
                  <TimetableGrid
                    schedules={schedules.filter(s => s.teacher_id === selectedTeacher)}
                    breakAfter={breakAfter}
                    onCellClick={handleScheduleClick}
                    onEmptyCellClick={handleAddScheduleEntry}
                    isAdmin={true}
                  />
                </>
              ) : (
                <div className="admin-no-teacher" data-testid="no-teacher-selected">
                  <Calendar className="h-10 w-10 text-blue-400" aria-hidden="true" />
                  <p className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                    No teacher selected
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Choose a teacher above to view and customize their timetable.
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Teachers Tab */}
          <TabsContent value="teachers" className="space-y-4">
            <div className="glass p-4 sm:p-6 rounded-2xl">
              <div className="admin-section-header flex justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Teacher Management</h2>
                <Button onClick={() => setShowAddTeacher(true)} data-testid="add-teacher-button">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Teacher
                </Button>
              </div>

              <div className="grid gap-4">
                {teachers.map(teacher => (
                  <div key={teacher.id} className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">{teacher.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">@{teacher.username}</p>
                    </div>
                    <Button
                      onClick={() => handleDeleteTeacher(teacher.id)}
                      variant="destructive"
                      size="sm"
                      data-testid={`delete-teacher-${teacher.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            <div className="glass p-4 sm:p-6 rounded-2xl">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">System Settings</h2>

              <div className="space-y-4">
                {/* Break Period Setting */}
                <div className="admin-settings-row flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
                  <div>
                    <Label className="text-base font-medium text-gray-900 dark:text-white">Break Period Position</Label>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Currently: After Period {breakAfter}
                    </p>
                  </div>
                  <div className="admin-settings-actions">
                    <Button
                      onClick={() => handleUpdateBreak(3)}
                      variant={breakAfter === 3 ? 'default' : 'outline'}
                      data-testid="break-after-3"
                    >
                      After Period 3
                    </Button>
                    <Button
                      onClick={() => handleUpdateBreak(4)}
                      variant={breakAfter === 4 ? 'default' : 'outline'}
                      data-testid="break-after-4"
                    >
                      After Period 4
                    </Button>
                  </div>
                </div>

                {/* Demo Data Management */}
                <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
                  <Label className="text-base font-medium text-gray-900 dark:text-white">Demo Timetable Management</Label>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4">
                    Load pre-configured demo schedules for all teachers or clear all existing data
                  </p>
                  <div className="admin-data-actions">
                    <Button
                      onClick={handleLoadDemoSchedules}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                      data-testid="load-demo-schedules-button"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Load Demo Schedules
                    </Button>
                    <Button
                      onClick={handleClearAllSchedules}
                      variant="outline"
                      className="border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      data-testid="clear-all-schedules-button"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Clear All Schedules
                    </Button>
                  </div>
                  <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <p className="text-xs text-blue-900 dark:text-blue-300">
                      <strong>Note:</strong> Demo schedules include realistic timetables for all 4 teachers (Alex, Amy, John, Sara)
                      with subjects like Mathematics, Physics, English, and History across all weekdays.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Schedule Dialog */}
      <Dialog open={showAddSchedule} onOpenChange={setShowAddSchedule}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Schedule Entry</DialogTitle>
            <DialogDescription>
              {newSchedule.day}, Period {newSchedule.period}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSchedule} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="schedule-teacher">Teacher</Label>
              <Select
                value={newSchedule.teacherId}
                onValueChange={(teacherId) => setNewSchedule(current => ({ ...current, teacherId }))}
              >
                <SelectTrigger id="schedule-teacher" data-testid="schedule-teacher-select">
                  <SelectValue placeholder="Choose teacher" />
                </SelectTrigger>
                <SelectContent>
                  {teachers.map(teacher => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="schedule-subject">Subject</Label>
              <Input
                id="schedule-subject"
                value={newSchedule.subject}
                onChange={(e) => setNewSchedule(current => ({ ...current, subject: e.target.value }))}
                required
                data-testid="schedule-subject-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="schedule-class">Class</Label>
              <Input
                id="schedule-class"
                value={newSchedule.className}
                onChange={(e) => setNewSchedule(current => ({ ...current, className: e.target.value }))}
                required
                data-testid="schedule-class-input"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowAddSchedule(false)}>
                Cancel
              </Button>
              <Button type="submit" data-testid="submit-add-schedule">
                Add Lesson
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Teacher Dialog */}
      <Dialog open={showAddTeacher} onOpenChange={setShowAddTeacher}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Teacher</DialogTitle>
            <DialogDescription>Create a new teacher account</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddTeacher} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={newTeacher.name}
                onChange={(e) => setNewTeacher({...newTeacher, name: e.target.value})}
                required
                data-testid="teacher-name-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={newTeacher.username}
                onChange={(e) => setNewTeacher({...newTeacher, username: e.target.value})}
                required
                data-testid="teacher-username-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={newTeacher.password}
                onChange={(e) => setNewTeacher({...newTeacher, password: e.target.value})}
                required
                data-testid="teacher-password-input"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowAddTeacher(false)}>
                Cancel
              </Button>
              <Button type="submit" data-testid="submit-add-teacher">
                Add Teacher
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Schedule Dialog */}
      <Dialog open={showEditSchedule} onOpenChange={setShowEditSchedule}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Schedule</DialogTitle>
            <DialogDescription>
              {selectedSchedule && `${selectedSchedule.day}, Period ${selectedSchedule.period}`}
            </DialogDescription>
          </DialogHeader>
          {selectedSchedule && (
            <form onSubmit={handleUpdateSchedule} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  name="subject"
                  defaultValue={selectedSchedule.subject}
                  required
                  data-testid="edit-subject-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="class_name">Class</Label>
                <Input
                  id="class_name"
                  name="class_name"
                  defaultValue={selectedSchedule.class_name}
                  required
                  data-testid="edit-class-input"
                />
              </div>
              <div className="flex justify-between">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => handleDeleteSchedule(selectedSchedule.id)}
                  data-testid="delete-schedule-button"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowEditSchedule(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" data-testid="save-schedule-button">
                    Save Changes
                  </Button>
                </div>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* QR Code Modal */}
      <QRCodeModal open={showQRModal} onClose={() => setShowQRModal(false)} />
    </div>
  );
};

export default AdminDashboard;
