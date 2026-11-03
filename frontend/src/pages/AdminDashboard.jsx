import { lazy, Suspense, useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { LogOut, Moon, Sun, Users, Calendar, Settings as SettingsIcon, Plus, Trash2, QrCode, Megaphone } from 'lucide-react';
import TimetableGrid from '../components/TimetableGrid';
import QRCodeModal from '../components/QRCodeModal';
import EditableChoiceField from '../components/EditableChoiceField';
import BellScheduleConfigFields from '../components/BellScheduleConfigFields';
import ProfileShutter from '../components/ProfileShutter';
import { periodDurationForFixedBreak } from '../lib/bellScheduleTiming';

//import.meta.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:8000";
const BACKEND_URL = import.meta.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:8000";
const API = `${BACKEND_URL}/api`;
const AnnouncementContent = lazy(() => import('../components/AnnouncementContent'));
const mapBellSchedule = (data) => ({
  startTime: data.start_time || '',
  dismissalTime: data.dismissal_time || '',
  periodDurationMinutes: data.period_duration_minutes ?? 35,
  schoolTimezone: data.school_timezone || 'Asia/Kolkata',
  breakAfterPeriod: data.break_after_period ?? 3,
  breakDurationMinutes: data.break_duration_minutes ?? 15,
  baselinePeriodTimes: data.baseline_period_times || data.period_times || [],
  periodTimes: data.period_times || [],
  dayPeriodTimes: data.day_period_times || {},
  holidays: data.holidays || [],
  today: data.today || '',
  configured: Boolean(data.configured),
  isCustom: Boolean(data.is_custom),
});

const AdminDashboard = ({ user, token, onLogout, exhibitionMode, darkMode, setDarkMode }) => {
  const authHeaders = { Authorization: ['Bearer', token].join(' ') };
  const [teachers, setTeachers] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [breakAfter, setBreakAfter] = useState(3);
  const [loading, setLoading] = useState(true);
  const [showAddTeacher, setShowAddTeacher] = useState(false);
  const [showSubjectCatalog, setShowSubjectCatalog] = useState(false);
  const [showGradeCatalog, setShowGradeCatalog] = useState(false);
  const [showAddSchedule, setShowAddSchedule] = useState(false);
  const [showEditSchedule, setShowEditSchedule] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showBellSchedule, setShowBellSchedule] = useState(false);
  const [showTeacherProfile, setShowTeacherProfile] = useState(false);
  const [showTeacherBellSchedule, setShowTeacherBellSchedule] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [profileTeacher, setProfileTeacher] = useState(null);
  const [bellTeacher, setBellTeacher] = useState(null);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [subjectCatalog, setSubjectCatalog] = useState([]);
  const [gradeCatalog, setGradeCatalog] = useState([]);
  const [subjectDraft, setSubjectDraft] = useState('');
  const [gradeDraft, setGradeDraft] = useState({ standard: '', section: '' });
  const [bellSchedule, setBellSchedule] = useState({
    startTime: '',
    dismissalTime: '',
    periodDurationMinutes: 35,
    schoolTimezone: 'Asia/Kolkata',
    breakAfterPeriod: 3,
    breakDurationMinutes: 15,
    baselinePeriodTimes: [],
    periodTimes: [],
    dayPeriodTimes: {},
    holidays: [],
    today: '',
    configured: false,
  });
  const [selectedBellSchedule, setSelectedBellSchedule] = useState(null);
  const [selectedTeacherChangelogs, setSelectedTeacherChangelogs] = useState([]);
  const [bellScheduleDraft, setBellScheduleDraft] = useState(bellSchedule);
  const [bellScheduleError, setBellScheduleError] = useState('');
  const [teacherBellDraft, setTeacherBellDraft] = useState({});
  const [teacherBellError, setTeacherBellError] = useState('');
  const [teacherBellIsCustom, setTeacherBellIsCustom] = useState(false);
  const [holidays, setHolidays] = useState([]);
  const [holidayDraft, setHolidayDraft] = useState({ day: '', name: '', note: '' });
  const [editingHolidayId, setEditingHolidayId] = useState(null);
  const [showHolidayManager, setShowHolidayManager] = useState(false);
  const [profileDraft, setProfileDraft] = useState({});
  const [announcements, setAnnouncements] = useState([]);
  const [showAnnouncementEditor, setShowAnnouncementEditor] = useState(false);
  const [showDeleteAnnouncementsDialog, setShowDeleteAnnouncementsDialog] = useState(false);
  const [announcementDraft, setAnnouncementDraft] = useState({ title: '', body: '' });
  const [announcementPreview, setAnnouncementPreview] = useState(false);
  const [announcementDeleteCount, setAnnouncementDeleteCount] = useState('');
  const [editScheduleValues, setEditScheduleValues] = useState({
    subject: '',
    className: '',
    teacherId: ''
  });
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
  const gradesByStandard = gradeCatalog.reduce((groups, option) => {
    if (!groups[option.standard]) groups[option.standard] = [];
    groups[option.standard].push(option);
    return groups;
  }, {});
  const subjectOptions = useMemo(
    () => subjectCatalog.map(option => option.name),
    [subjectCatalog],
  );
  const gradeOptions = useMemo(
    () => gradeCatalog.map(option => option.name),
    [gradeCatalog],
  );

  const fetchAnnouncements = async () => {
    try {
      const { data } = await axios.get(`${API}/announcements`, { headers: authHeaders });
      setAnnouncements(data);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to load announcements');
    }
  };

  const handleCreateAnnouncement = async (event) => {
    event.preventDefault();
    try {
      const { data } = await axios.post(
        `${API}/announcements`,
        announcementDraft,
        { headers: authHeaders },
      );
      setAnnouncements(current => [data, ...current]);
      setAnnouncementDraft({ title: '', body: '' });
      setAnnouncementPreview(false);
      setShowAnnouncementEditor(false);
      toast.success('Announcement published to all teachers');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not publish announcement');
    }
  };

  const handleDeleteAnnouncement = async (announcement) => {
    if (!window.confirm(`Remove "${announcement.title}" for all teachers?`)) return;
    try {
      await axios.delete(`${API}/announcements/${announcement.id}`, { headers: authHeaders });
      setAnnouncements(current => current.filter(item => item.id !== announcement.id));
      toast.success('Announcement removed');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not remove announcement');
    }
  };

  const handleDeleteLatestAnnouncements = async (event) => {
    event.preventDefault();
    const count = Number(announcementDeleteCount);
    if (!Number.isInteger(count) || count < 1 || count > 500) {
      toast.error('Enter a number from 1 to 500');
      return;
    }
    if (!window.confirm(`Permanently remove up to the latest ${count} announcements?`)) return;
    try {
      const { data } = await axios.delete(`${API}/announcements`, {
        params: { count },
        headers: authHeaders,
      });
      setAnnouncements(current => current.slice(data.deleted_count));
      setAnnouncementDeleteCount('');
      setShowDeleteAnnouncementsDialog(false);
      toast.success(`${data.deleted_count} announcement${data.deleted_count === 1 ? '' : 's'} removed`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not remove recent announcements');
    }
  };

  useEffect(() => {
    fetchData();
    fetchAnnouncements();
  }, []);

  useEffect(() => {
    if (!selectedTeacher) {
      setSelectedBellSchedule(null);
      setSelectedTeacherChangelogs([]);
      return;
    }
    let active = true;
    Promise.all([
      axios.get(`${API}/settings/bell-schedule`, {
        params: { teacher_id: selectedTeacher },
        headers: authHeaders,
      }),
      axios.get(`${API}/changelogs`, {
        params: { teacher_id: selectedTeacher },
        headers: authHeaders,
      }),
    ]).then(([scheduleResponse, logResponse]) => {
      if (active) {
        setSelectedBellSchedule(mapBellSchedule(scheduleResponse.data));
        setSelectedTeacherChangelogs(logResponse.data);
      }
    }).catch(error => {
      if (active) toast.error(error.response?.data?.detail || 'Failed to load selected teacher schedule data');
    });
    return () => { active = false; };
  }, [selectedTeacher, token]);

  const fetchData = async () => {
    try {
      const [teachersResult, schedulesResult, settingsResult, holidaysResult, catalogResult] = await Promise.allSettled([
        axios.get(`${API}/users`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/schedules`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/settings/bell-schedule`, { headers: authHeaders }),
        axios.get(`${API}/holidays`, { headers: authHeaders }),
        axios.get(`${API}/catalog`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (teachersResult.status === 'fulfilled') {
        setTeachers(teachersResult.value.data.filter(u => u.role === 'teacher'));
      } else {
        toast.error('Failed to load teachers');
      }
      if (schedulesResult.status === 'fulfilled') {
        setSchedules(schedulesResult.value.data);
      } else {
        toast.error('Failed to load schedules');
      }
      if (settingsResult.status === 'fulfilled') {
        const nextBellSchedule = mapBellSchedule(settingsResult.value.data);
        setBreakAfter(nextBellSchedule.breakAfterPeriod);
        setBellSchedule(nextBellSchedule);
      } else {
        toast.error('Failed to load bell schedule settings');
      }
      if (holidaysResult.status === 'fulfilled') {
        setHolidays(holidaysResult.value.data);
      } else {
        toast.error('Failed to load holidays');
      }
      if (catalogResult.status === 'fulfilled') {
        setSubjectCatalog(catalogResult.value.data.subjects);
        setGradeCatalog(catalogResult.value.data.grades);
      } else {
        toast.error(
          catalogResult.reason?.response?.data?.detail
            || 'Failed to load the subject and grade catalog',
        );
      }
      if (selectedTeacher) {
        const [teacherBellResult, teacherLogsResult] = await Promise.allSettled([
            axios.get(`${API}/settings/bell-schedule`, {
              params: { teacher_id: selectedTeacher },
              headers: authHeaders,
            }),
            axios.get(`${API}/changelogs`, {
              params: { teacher_id: selectedTeacher },
              headers: authHeaders,
            }),
        ]);
        if (teacherBellResult.status === 'fulfilled') {
            setSelectedBellSchedule(mapBellSchedule(teacherBellResult.value.data));
        }
        if (teacherLogsResult.status === 'fulfilled') {
            setSelectedTeacherChangelogs(teacherLogsResult.value.data);
        }
      }
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCatalogSubject = async (event) => {
    event.preventDefault();
    try {
      const response = await axios.post(
        `${API}/catalog/subjects`,
        { name: subjectDraft },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSubjectCatalog(current => [
        ...current.filter(option => option.id !== response.data.id),
        response.data
      ].sort((first, second) => first.name.localeCompare(second.name)));
      setSubjectDraft('');
      toast.success('Subject added to the catalog');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add subject');
    }
  };

  const handleDeleteCatalogSubject = async (option) => {
    try {
      await axios.delete(`${API}/catalog/subjects/${option.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSubjectCatalog(current => current.filter(item => item.id !== option.id));
      toast.success('Subject removed from the catalog');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to remove subject');
    }
  };

  const handleAddCatalogGrade = async (event) => {
    event.preventDefault();
    try {
      const response = await axios.post(
        `${API}/catalog/grades`,
        gradeDraft,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setGradeCatalog(current => [
        ...current.filter(option => option.id !== response.data.id),
        response.data
      ].sort((first, second) => (
        first.standard.localeCompare(second.standard)
        || first.section.localeCompare(second.section)
      )));
      setGradeDraft({ standard: '', section: '' });
      toast.success('Grade and section added to the catalog');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add grade');
    }
  };

  const handleDeleteCatalogGrade = async (option) => {
    try {
      await axios.delete(`${API}/catalog/grades/${option.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGradeCatalog(current => current.filter(item => item.id !== option.id));
      toast.success('Grade removed from the catalog');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to remove grade');
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

  const openTeacherProfile = (teacher) => {
    setProfileTeacher(teacher);
    setProfileDraft({
      name: teacher.name || '',
      photo_url: teacher.photo_url || '',
      designation: teacher.designation || '',
      school_start_date: teacher.school_start_date || '',
      school_end_date: teacher.school_end_date || '',
      email: teacher.email || '',
      phone: teacher.phone || '',
      bio: teacher.bio || '',
    });
    setShowTeacherProfile(true);
  };

  const handleSaveTeacherProfile = async (event) => {
    event.preventDefault();
    try {
      const { data } = await axios.put(
        `${API}/users/${profileTeacher.id}/profile`,
        profileDraft,
        { headers: authHeaders },
      );
      setTeachers(current => current.map(teacher => (
        teacher.id === data.id ? { ...teacher, ...data } : teacher
      )));
      setShowTeacherProfile(false);
      toast.success('Teacher profile saved');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save teacher profile');
    }
  };

  const openDefaultBellSchedule = () => {
    setBellScheduleDraft({ ...bellSchedule });
    setBellScheduleError('');
    setShowBellSchedule(true);
  };

  const updateBellField = (field, value) => {
    const updated = {
      ...bellScheduleDraft,
      [field]: value,
    };
    setBellScheduleDraft(updated);
    if (!updated.startTime || !updated.dismissalTime) {
      setBellScheduleError('');
      return;
    }
    const duration = periodDurationForFixedBreak(
      updated.startTime,
      updated.dismissalTime,
      updated.breakDurationMinutes,
    );
    setBellScheduleError(duration
      ? ''
      : 'These settings do not fit eight equal 20–60 minute periods and the selected break. Adjust start, dismissal, or break; the break will not change automatically.');
  };

  const handleSaveDefaultBellSchedule = async (event) => {
    event.preventDefault();
    const duration = periodDurationForFixedBreak(
      bellScheduleDraft.startTime,
      bellScheduleDraft.dismissalTime,
      bellScheduleDraft.breakDurationMinutes,
    );
    if (!duration) {
      const message = 'Choose a start, dismissal, and break that fit eight equal 20–60 minute periods.';
      setBellScheduleError(message);
      toast.error(message);
      return;
    }
    if (!window.confirm('Save this school-wide schedule? Teachers using the default will see the new sequence.')) return;

    try {
      const { data } = await axios.put(
        `${API}/settings/bell-schedule`,
        {
          start_time: bellScheduleDraft.startTime,
          dismissal_time: bellScheduleDraft.dismissalTime,
          break_after_period: Number(bellScheduleDraft.breakAfterPeriod),
          break_duration_minutes: Number(bellScheduleDraft.breakDurationMinutes),
          school_timezone: bellScheduleDraft.schoolTimezone,
        },
        { headers: authHeaders },
      );
      const saved = mapBellSchedule(data);
      setBellSchedule(saved);
      setBreakAfter(saved.breakAfterPeriod);
      setShowBellSchedule(false);
      await fetchData();
      toast.success('Default bell schedule saved');
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to save bell schedule';
      setBellScheduleError(message);
      toast.error(message);
    }
  };

  const openTeacherBellSchedule = async (teacher) => {
    try {
      const { data } = await axios.get(`${API}/settings/bell-schedule`, {
        params: { teacher_id: teacher.id },
        headers: authHeaders,
      });
      const effective = mapBellSchedule(data);
      setBellTeacher(teacher);
      setTeacherBellDraft({
        startTime: effective.startTime,
        dismissalTime: effective.dismissalTime,
      });
      setTeacherBellIsCustom(data.is_custom);
      setTeacherBellError('');
      setShowTeacherBellSchedule(true);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to load teacher bell schedule');
    }
  };

  const handleSaveTeacherBellSchedule = async (event) => {
    event.preventDefault();
    const duration = periodDurationForFixedBreak(
      teacherBellDraft.startTime,
      teacherBellDraft.dismissalTime,
      bellSchedule.breakDurationMinutes,
    );
    if (!duration) {
      const message = 'This start and dismissal do not fit eight equal periods with the school break.';
      setTeacherBellError(message);
      toast.error(message);
      return;
    }
    if (!window.confirm(`Save custom period times for ${bellTeacher.name}?`)) return;

    try {
      const { data } = await axios.put(
        `${API}/users/${bellTeacher.id}/bell-schedule`,
        {
          start_time: teacherBellDraft.startTime,
          dismissal_time: teacherBellDraft.dismissalTime,
        },
        { headers: authHeaders },
      );
      const effective = mapBellSchedule(data);
      setTeachers(current => current.map(teacher => (
        teacher.id === bellTeacher.id
          ? { ...teacher, bell_schedule: {
            start_time: effective.startTime,
            dismissal_time: effective.dismissalTime,
            period_duration_minutes: effective.periodDurationMinutes,
          } }
          : teacher
      )));
      setTeacherBellIsCustom(true);
      setShowTeacherBellSchedule(false);
      await fetchData();
      toast.success('Custom teacher bell schedule saved');
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to save teacher bell schedule';
      setTeacherBellError(message);
      toast.error(message);
    }
  };

  const updateTeacherBellField = (field, value) => {
    const updated = { ...teacherBellDraft, [field]: value };
    setTeacherBellDraft(updated);
    if (!updated.startTime || !updated.dismissalTime) {
      setTeacherBellError('');
      return;
    }
    const duration = periodDurationForFixedBreak(
      updated.startTime,
      updated.dismissalTime,
      bellSchedule.breakDurationMinutes,
    );
    setTeacherBellError(duration
      ? ''
      : `This timing does not fit eight equal 20–60 minute periods with the school's ${bellSchedule.breakDurationMinutes}-minute break.`);
  };

  const handleResetTeacherBellSchedule = async () => {
    if (!window.confirm(`${bellTeacher.name} will use the default bell schedule. Continue?`)) return;
    try {
      await axios.delete(`${API}/users/${bellTeacher.id}/bell-schedule`, {
        headers: authHeaders,
      });
      setTeachers(current => current.map(teacher => {
        if (teacher.id !== bellTeacher.id) return teacher;
        const defaultTeacher = { ...teacher };
        delete defaultTeacher.period_times;
        delete defaultTeacher.bell_schedule;
        return defaultTeacher;
      }));
      setShowTeacherBellSchedule(false);
      await fetchData();
      toast.success('Teacher now uses the default bell schedule');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reset teacher bell schedule');
    }
  };

  const handleLegacyUpdateBreak = async (value) => {
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

  const handleUpdateBreak = async (value) => {
    if (!window.confirm(`Move the break to after Period ${value} for all teachers?`)) return;
    try {
      const { data } = await axios.put(`${API}/settings/bell-schedule`, {
        start_time: bellSchedule.startTime,
        dismissal_time: bellSchedule.dismissalTime,
        break_after_period: Number(value),
        break_duration_minutes: bellSchedule.breakDurationMinutes,
        school_timezone: bellSchedule.schoolTimezone,
      }, { headers: authHeaders });
      const saved = mapBellSchedule(data);
      setBellSchedule(saved);
      setBreakAfter(saved.breakAfterPeriod);
      await fetchData();
      toast.success(`Break moved after Period ${saved.breakAfterPeriod}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not change break position');
    }
  };

  const saveHoliday = async (event) => {
    event.preventDefault();
    try {
      const { data } = editingHolidayId
        ? await axios.put(`${API}/holidays/${editingHolidayId}`, holidayDraft, { headers: authHeaders })
        : await axios.post(`${API}/holidays`, holidayDraft, { headers: authHeaders });
      setHolidays(current => editingHolidayId
        ? current.map(item => item.id === editingHolidayId ? data : item)
        : [...current, data].sort((a, b) => a.day.localeCompare(b.day)));
      setHolidayDraft({ day: '', name: '', note: '' });
      setEditingHolidayId(null);
      await fetchData();
      toast.success('Holiday saved');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not save holiday');
    }
  };

  const editHoliday = (holiday) => {
    setEditingHolidayId(holiday.id);
    setHolidayDraft({ day: holiday.day, name: holiday.name, note: holiday.note || '' });
    setShowHolidayManager(false);
  };

  const deleteHoliday = async (holiday) => {
    if (!window.confirm(`Remove ${holiday.name} from the holiday schedule?`)) return;
    try {
      await axios.delete(`${API}/holidays/${holiday.id}`, { headers: authHeaders });
      setHolidays(current => current.filter(item => item.id !== holiday.id));
      if (editingHolidayId === holiday.id) {
        setEditingHolidayId(null);
        setHolidayDraft({ day: '', name: '', note: '' });
      }
      await fetchData();
      toast.success('Holiday removed');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not remove holiday');
    }
  };

  const handleScheduleClick = (schedule) => {
    setSelectedSchedule(schedule);
    const assignedTeacher = teachers.find(teacher => teacher.id === schedule.teacher_id);
    setBellTeacher(assignedTeacher || null);
    setEditScheduleValues({
      subject: schedule.subject,
      className: schedule.class_name,
      teacherId: schedule.teacher_id
    });
    setShowEditSchedule(true);
  };

  const handleUpdateSchedule = async (e) => {
    e.preventDefault();
    const updateData = {
      subject: editScheduleValues.subject.trim(),
      class_name: editScheduleValues.className.trim(),
      teacher_id: editScheduleValues.teacherId
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
    <div className="dashboard-page page-transition">
      {exhibitionMode && (
        <div className="exhibition-badge">Exhibition Mode Active</div>
      )}

      {/* Header */}
      <div className="dashboard-shell mx-auto">
        <div className="dashboard-header flex justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Welcome, {user.name}</p>
            <p className="mt-1 text-sm font-semibold text-gray-700 dark:text-gray-300">
              It’s {selectedBellSchedule?.today || bellSchedule.today || '—'}
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
                  timeZone: selectedBellSchedule?.schoolTimezone
                    || bellSchedule.schoolTimezone
                    || 'Asia/Kolkata',
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
                  <p className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    It’s {selectedBellSchedule?.today || bellSchedule.today || '—'}
                  </p>
                  <TimetableGrid
                    key={selectedTeacher}
                    schedules={schedules.filter(s => s.teacher_id === selectedTeacher)}
                    breakAfter={selectedBellSchedule?.breakAfterPeriod ?? breakAfter}
                    periodTimes={selectedBellSchedule?.periodTimes || bellSchedule.periodTimes}
                    baselinePeriodTimes={selectedBellSchedule?.baselinePeriodTimes || bellSchedule.baselinePeriodTimes}
                    dayPeriodTimes={selectedBellSchedule?.dayPeriodTimes}
                    holidays={selectedBellSchedule?.holidays || []}
                    changelogs={selectedTeacherChangelogs}
                    breakDurationMinutes={selectedBellSchedule?.breakDurationMinutes ?? bellSchedule.breakDurationMinutes}
                    isRecentChange={schedule => selectedTeacherChangelogs.some(log => log.schedule_id === schedule.id)}
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
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowAnnouncementEditor(true)} data-testid="new-announcement-button">
                    <Megaphone className="w-4 h-4 mr-2" />
                    New announcement
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowDeleteAnnouncementsDialog(true)}
                    disabled={!announcements.length}
                    data-testid="delete-announcements-button"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete announcements
                  </Button>
                  <Button onClick={() => setShowAddTeacher(true)} data-testid="add-teacher-button">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Teacher
                  </Button>
                </div>
              </div>

              <div className="grid gap-4">
                {teachers.map(teacher => (
                  <div key={teacher.id} className="teacher-admin-card">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white">{teacher.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">@{teacher.username}</p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {teacher.bell_schedule || teacher.period_times ? 'Custom period times' : 'Using default period times'}
                        {teacher.designation ? ` · ${teacher.designation}` : ''}
                      </p>
                    </div>
                    <div className="teacher-admin-actions">
                      <Button variant="outline" size="sm" onClick={() => openTeacherProfile(teacher)}>
                        Edit profile
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openTeacherBellSchedule(teacher)}>
                        Period times
                      </Button>
                      <Button
                        onClick={() => handleDeleteTeacher(teacher.id)}
                        variant="destructive"
                        size="sm"
                        aria-label={`Delete ${teacher.name}`}
                        data-testid={`delete-teacher-${teacher.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <section className="mt-8 border-t border-gray-200 pt-5 dark:border-slate-700">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">Published announcements</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      Announcements expire automatically after seven days.
                    </p>
                  </div>
                </div>
                {announcements.length ? (
                  <ul className="mt-3 grid gap-2">
                    {announcements.map(announcement => (
                      <li key={announcement.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-3 dark:border-slate-700">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-gray-900 dark:text-white">{announcement.title}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {announcement.created_at ? new Date(announcement.created_at).toLocaleString() : ''}
                          </p>
                        </div>
                        <Button type="button" size="sm" variant="destructive" onClick={() => handleDeleteAnnouncement(announcement)}>
                          Remove
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">No announcements have been published.</p>
                )}
              </section>
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            <div className="glass p-4 sm:p-6 rounded-2xl">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">System Settings</h2>

              <div className="space-y-4">
                {/* Bell Schedule Setting */}
                <div className="admin-settings-row flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
                  <div>
                    <Label className="text-base font-medium text-gray-900 dark:text-white">Default Bell Schedule</Label>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {bellSchedule.configured
                        ? `${bellSchedule.startTime}–${bellSchedule.dismissalTime}, ${bellSchedule.periodDurationMinutes}-minute periods`
                        : 'Configure a start and dismissal time to display the timetable.'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-800 dark:border-slate-600 dark:text-gray-200">
                      Calculated baseline: {bellSchedule.configured ? `${bellSchedule.periodDurationMinutes} min` : '—'}
                    </span>
                    <Label htmlFor="break-after-setting">Break after</Label>
                    <select
                      id="break-after-setting"
                      className="period-config-select"
                      value={bellSchedule.breakAfterPeriod}
                      onChange={event => handleUpdateBreak(event.target.value)}
                    >
                      <option value={3}>Period 3</option>
                      <option value={4}>Period 4</option>
                    </select>
                    <Button variant="outline" onClick={openDefaultBellSchedule} data-testid="configure-bell-schedule">
                      Configure day
                    </Button>
                  </div>
                </div>

                <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                  <h3 className="font-semibold text-gray-900 dark:text-white">One-time holidays</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Add a weekday in the current school week. Holidays expire automatically after their date.
                  </p>
                  <form onSubmit={saveHoliday} className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="holiday-day">Date</Label>
                      <Input id="holiday-day" type="date" value={holidayDraft.day} required
                        onChange={event => setHolidayDraft(current => ({ ...current, day: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="holiday-name">Holiday name</Label>
                      <Input id="holiday-name" value={holidayDraft.name} required maxLength={100}
                        onChange={event => setHolidayDraft(current => ({ ...current, name: event.target.value }))} />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="holiday-note">Note (optional)</Label>
                      <Input id="holiday-note" value={holidayDraft.note} maxLength={300}
                        onChange={event => setHolidayDraft(current => ({ ...current, note: event.target.value }))} />
                    </div>
                    <div className="flex gap-2 sm:col-span-2">
                      <Button type="submit">{editingHolidayId ? 'Update holiday' : 'Add holiday'}</Button>
                      {editingHolidayId && (
                        <Button type="button" variant="outline" onClick={() => {
                          setEditingHolidayId(null);
                          setHolidayDraft({ day: '', name: '', note: '' });
                        }}>Cancel edit</Button>
                      )}
                    </div>
                  </form>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {holidays.length} upcoming {holidays.length === 1 ? 'holiday' : 'holidays'}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowHolidayManager(true)}
                    >
                      Manage holidays
                    </Button>
                  </div>
                </section>

                <div className="admin-settings-row flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
                  <div className="flex items-start gap-3">
                    <Users className="mt-1 h-5 w-5 shrink-0 text-gray-600 dark:text-gray-300" />
                    <div>
                      <Label className="text-base font-medium text-gray-900 dark:text-white">Teacher Accounts</Label>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Register a teacher who can sign in and receive a schedule. The account is stored in MongoDB.
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => setShowAddTeacher(true)}
                    data-testid="settings-add-teacher-button"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Register Teacher
                  </Button>
                </div>

                <div className="admin-settings-row flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
                  <div>
                    <Label className="text-base font-medium text-gray-900 dark:text-white">Subjects</Label>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {subjectCatalog.length} available subjects, saved in MongoDB.
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => setShowSubjectCatalog(true)}>
                    Manage Subjects
                  </Button>
                </div>

                <div className="admin-settings-row flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
                  <div>
                    <Label className="text-base font-medium text-gray-900 dark:text-white">Grades &amp; Sections</Label>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {gradeCatalog.length} available grade and section combinations.
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => setShowGradeCatalog(true)}>
                    Manage Grades
                  </Button>
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

      <Dialog open={showSubjectCatalog} onOpenChange={setShowSubjectCatalog}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Subjects</DialogTitle>
            <DialogDescription>
              Add or remove subjects used by the schedule editor. Changes are saved to MongoDB.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddCatalogSubject} className="flex gap-2">
            <Input
              value={subjectDraft}
              onChange={event => setSubjectDraft(event.target.value)}
              placeholder="Subject name"
              aria-label="New subject name"
              required
            />
            <Button type="submit" disabled={!subjectDraft.trim()}>
              <Plus className="mr-2 h-4 w-4" />
              Add
            </Button>
          </form>
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {subjectCatalog.map(option => (
              <div key={option.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <span className="min-w-0 break-words">
                  {option.name}{option.name.toUpperCase() === 'SUBSTITUTION' ? ' · Permanent' : ''}
                </span>
                {option.name.toUpperCase() !== 'SUBSTITUTION' && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    aria-label={`Remove ${option.name}`}
                    onClick={() => handleDeleteCatalogSubject(option)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            {subjectCatalog.length === 0 && (
              <p className="py-4 text-center text-sm text-gray-500">No subjects in the catalog.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showGradeCatalog} onOpenChange={setShowGradeCatalog}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Grades &amp; Sections</DialogTitle>
            <DialogDescription>
              Add each section under a standard, for example standard XI with section A.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddCatalogGrade} className="grid gap-3 sm:grid-cols-[1fr_8rem_auto]">
            <Input
              value={gradeDraft.standard}
              onChange={event => setGradeDraft(current => ({ ...current, standard: event.target.value }))}
              placeholder="Standard (e.g. XI)"
              aria-label="Standard"
              required
            />
            <Input
              value={gradeDraft.section}
              onChange={event => setGradeDraft(current => ({ ...current, section: event.target.value }))}
              placeholder="Section"
              aria-label="Section"
              required
            />
            <Button type="submit" disabled={!gradeDraft.standard.trim() || !gradeDraft.section.trim()}>
              <Plus className="mr-2 h-4 w-4" />
              Add
            </Button>
          </form>
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {Object.entries(gradesByStandard).sort(([first], [second]) => first.localeCompare(second)).map(([standard, options]) => (
              <div key={standard} className="rounded-lg border p-3">
                <p className="mb-2 font-medium">{standard}</p>
                <div className="flex flex-wrap gap-2">
                  {options.map(option => (
                    <div key={option.id} className="flex items-center gap-2 rounded-md bg-gray-100 px-3 py-2 dark:bg-slate-800">
                      <span className="text-sm">Section {option.section}</span>
                      <button
                        type="button"
                        className="rounded p-1 text-gray-500 hover:bg-gray-200 hover:text-red-600 dark:hover:bg-slate-700"
                        aria-label={`Remove ${option.name}`}
                        onClick={() => handleDeleteCatalogGrade(option)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {gradeCatalog.length === 0 && (
              <p className="py-4 text-center text-sm text-gray-500">No grades in the catalog.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Schedule Dialog */}
      <Dialog open={showAddSchedule} onOpenChange={setShowAddSchedule}>
        <DialogContent className="schedule-dialog">
          <DialogHeader>
            <DialogTitle>Add Schedule Entry</DialogTitle>
            <DialogDescription>
              {newSchedule.day}, Period {newSchedule.period}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSchedule} className="schedule-dialog-form">
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
              <EditableChoiceField
                id="schedule-subject"
                label="Subject"
                value={newSchedule.subject}
                onChange={(subject) => setNewSchedule(current => ({ ...current, subject }))}
                options={subjectOptions}
                placeholder="Type or choose a subject"
                testId="schedule-subject-input"
              />
            </div>
            <div className="space-y-2">
              <EditableChoiceField
                id="schedule-class"
                label="Class / Grade"
                value={newSchedule.className}
                onChange={(className) => setNewSchedule(current => ({ ...current, className }))}
                options={gradeOptions}
                placeholder="Type or choose a class or grade"
                testId="schedule-class-input"
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
        <DialogContent className="schedule-dialog">
          <DialogHeader>
            <DialogTitle>Edit Schedule</DialogTitle>
            <DialogDescription>
              {selectedSchedule && `${selectedSchedule.day}, Period ${selectedSchedule.period}`}
            </DialogDescription>
          </DialogHeader>
          {selectedSchedule && (
            <form onSubmit={handleUpdateSchedule} className="schedule-dialog-form">
              <div className="space-y-2">
                <Label htmlFor="edit-schedule-teacher">Teacher</Label>
                <Select
                  value={editScheduleValues.teacherId}
                  onValueChange={(teacherId) => setEditScheduleValues(current => ({ ...current, teacherId }))}
                >
                  <SelectTrigger id="edit-schedule-teacher" data-testid="edit-schedule-teacher-select">
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
                <EditableChoiceField
                  id="subject"
                  label="Subject"
                  value={editScheduleValues.subject}
                  onChange={(subject) => setEditScheduleValues(current => ({ ...current, subject }))}
                  options={subjectOptions}
                  placeholder="Type or choose a subject"
                  testId="edit-subject-input"
                />
              </div>
              <div className="space-y-2">
                <EditableChoiceField
                  id="class_name"
                  label="Class / Grade"
                  value={editScheduleValues.className}
                  onChange={(className) => setEditScheduleValues(current => ({ ...current, className }))}
                  options={gradeOptions}
                  placeholder="Type or choose a class or grade"
                  testId="edit-class-input"
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

      <Dialog open={showTeacherProfile} onOpenChange={setShowTeacherProfile}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit {profileTeacher?.name || 'teacher'} profile</DialogTitle>
            <DialogDescription>
              These saved details appear in that teacher’s profile shutter.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveTeacherProfile} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="profile-name">Display name</Label>
              <Input
                id="profile-name"
                value={profileDraft.name || ''}
                onChange={event => setProfileDraft(current => ({ ...current, name: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-designation">Designation</Label>
              <Input
                id="profile-designation"
                value={profileDraft.designation || ''}
                onChange={event => setProfileDraft(current => ({ ...current, designation: event.target.value }))}
                placeholder="e.g. Mathematics Teacher"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="profile-photo">Profile photo URL</Label>
              <Input
                id="profile-photo"
                type="url"
                value={profileDraft.photo_url || ''}
                onChange={event => setProfileDraft(current => ({ ...current, photo_url: event.target.value }))}
                placeholder="https://..."
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Use a public HTTPS image URL. Leave empty to show initials.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-start-date">School start date</Label>
              <Input
                id="profile-start-date"
                type="date"
                value={profileDraft.school_start_date || ''}
                onChange={event => setProfileDraft(current => ({ ...current, school_start_date: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-end-date">School end date (optional)</Label>
              <Input
                id="profile-end-date"
                type="date"
                value={profileDraft.school_end_date || ''}
                onChange={event => setProfileDraft(current => ({ ...current, school_end_date: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-email">Email</Label>
              <Input
                id="profile-email"
                type="email"
                value={profileDraft.email || ''}
                onChange={event => setProfileDraft(current => ({ ...current, email: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-phone">Phone</Label>
              <Input
                id="profile-phone"
                type="tel"
                value={profileDraft.phone || ''}
                onChange={event => setProfileDraft(current => ({ ...current, phone: event.target.value }))}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="profile-bio">Profile information</Label>
              <textarea
                id="profile-bio"
                className="profile-bio-input"
                rows={4}
                maxLength={1000}
                value={profileDraft.bio || ''}
                onChange={event => setProfileDraft(current => ({ ...current, bio: event.target.value }))}
                placeholder="Short introduction or other school profile details"
              />
            </div>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setShowTeacherProfile(false)}>
                Cancel
              </Button>
              <Button type="submit">Save Profile</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showBellSchedule} onOpenChange={setShowBellSchedule}>
        <DialogContent className="bell-schedule-dialog max-h-[92dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Default Bell Schedule</DialogTitle>
            <DialogDescription>
              Set the school start, dismissal, break duration and break position. The equal period length is calculated and read-only; invalid combinations are blocked.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveDefaultBellSchedule} className="space-y-5">
            <BellScheduleConfigFields
              value={bellScheduleDraft}
              onChange={updateBellField}
              prefix="default-bell"
              periodDurationMinutes={periodDurationForFixedBreak(
                bellScheduleDraft.startTime,
                bellScheduleDraft.dismissalTime,
                bellScheduleDraft.breakDurationMinutes,
              )}
              includeBreak
            />
            {bellScheduleError && <p className="bell-schedule-error" role="alert">{bellScheduleError}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowBellSchedule(false)}>
                Cancel
              </Button>
              <Button type="submit" data-testid="save-default-bell-schedule">
                Save all timings
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showTeacherBellSchedule} onOpenChange={setShowTeacherBellSchedule}>
        <DialogContent className="bell-schedule-dialog max-h-[92dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{bellTeacher?.name} — Period Times</DialogTitle>
            <DialogDescription>
              {teacherBellIsCustom
                ? 'This teacher has a custom start and dismissal. Period duration is calculated using the school break.'
                : 'This teacher currently follows the school defaults. Saving creates a custom timing baseline.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <form onSubmit={handleSaveTeacherBellSchedule} className="space-y-5">
            <BellScheduleConfigFields
              value={teacherBellDraft}
              onChange={updateTeacherBellField}
              prefix="teacher-bell"
              periodDurationMinutes={periodDurationForFixedBreak(
                teacherBellDraft.startTime,
                teacherBellDraft.dismissalTime,
                bellSchedule.breakDurationMinutes,
              )}
              includeBreak={false}
            />
            {teacherBellError && <p className="bell-schedule-error" role="alert">{teacherBellError}</p>}
              <div className="flex flex-wrap justify-between gap-2">
                {teacherBellIsCustom && (
                  <Button type="button" variant="destructive" onClick={handleResetTeacherBellSchedule}>
                    Use default times
                  </Button>
                )}
                <div className="ml-auto flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowTeacherBellSchedule(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Save custom times</Button>
                </div>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAnnouncementEditor} onOpenChange={setShowAnnouncementEditor}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Publish an announcement</DialogTitle>
            <DialogDescription>
              Every teacher can read this from the announcements section in their profile shutter.
              Markdown and LaTeX math are supported.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateAnnouncement} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="announcement-title">Headline</Label>
              <Input
                id="announcement-title"
                value={announcementDraft.title}
                maxLength={120}
                onChange={event => setAnnouncementDraft(current => ({ ...current, title: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="announcement-body">Announcement</Label>
              {announcementPreview ? (
                <div className="min-h-72 max-h-[50dvh] overflow-y-auto rounded-lg border border-gray-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                  <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                    {announcementDraft.title || 'Announcement preview'}
                  </h3>
                  {announcementDraft.body ? (
                    <Suspense fallback={<p className="text-sm text-gray-500">Loading preview...</p>}>
                      <AnnouncementContent>{announcementDraft.body}</AnnouncementContent>
                    </Suspense>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">Start writing to preview the announcement.</p>
                  )}
                </div>
              ) : (
                <Textarea
                  id="announcement-body"
                  value={announcementDraft.body}
                  maxLength={20000}
                  rows={14}
                  placeholder={'Write Markdown here. Math: $E = mc^2$ or a block formula:\n\n$$\\int_0^1 x^2\\,dx = \\frac{1}{3}$$'}
                  onChange={event => setAnnouncementDraft(current => ({ ...current, body: event.target.value }))}
                  required
                />
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Supports headings, lists, emphasis, links, inline math ($...$), and display math ($$...$$).
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAnnouncementPreview(value => !value)}>
                {announcementPreview ? 'Edit' : 'Preview'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowAnnouncementEditor(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!announcementDraft.title.trim() || !announcementDraft.body.trim()}>
                Publish
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showDeleteAnnouncementsDialog}
        onOpenChange={setShowDeleteAnnouncementsDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete recent announcements</DialogTitle>
            <DialogDescription>
              Enter how many of the newest announcements to delete. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleDeleteLatestAnnouncements} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="announcement-delete-count">Number of announcements</Label>
              <Input
                id="announcement-delete-count"
                type="number"
                min="1"
                max="500"
                step="1"
                value={announcementDeleteCount}
                onChange={event => setAnnouncementDeleteCount(event.target.value)}
                placeholder="e.g. 3"
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDeleteAnnouncementsDialog(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="destructive">
                Delete announcements
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showHolidayManager} onOpenChange={setShowHolidayManager}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage holidays</DialogTitle>
            <DialogDescription>
              Edit or remove holidays scheduled for the current school week.
            </DialogDescription>
          </DialogHeader>
          <ul className="grid gap-3">
            {[...holidays].sort((a, b) => a.day.localeCompare(b.day)).map(holiday => (
              <li
                key={holiday.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 p-3 dark:border-slate-700"
              >
                <div className="min-w-0">
                  <strong className="text-gray-900 dark:text-white">{holiday.name}</strong>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{holiday.day}</p>
                  {holiday.note && (
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {holiday.note}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => editHoliday(holiday)}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteHoliday(holiday)}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            ))}
            {holidays.length === 0 && (
              <li className="text-sm text-gray-500 dark:text-gray-400">
                No upcoming holidays this week.
              </li>
            )}
          </ul>
        </DialogContent>
      </Dialog>

      {/* QR Code Modal */}
      <QRCodeModal open={showQRModal} onClose={() => setShowQRModal(false)} />
      <ProfileShutter
        user={user}
        token={token}
        announcements={announcements}
        profileUser={teachers.find(teacher => teacher.id === selectedTeacher)}
      />
    </div>
  );
};

export default AdminDashboard;
