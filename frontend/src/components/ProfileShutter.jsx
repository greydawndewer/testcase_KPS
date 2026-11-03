import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { ArrowDown, ArrowUp, Mail, Phone, UserRound, X, Megaphone } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';

const AnnouncementContent = lazy(() => import('./AnnouncementContent'));

const BACKEND_URL =
  import.meta.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000';
const API = `${BACKEND_URL.replace(/\/+$/, '')}/api`;

const formatSchoolDates = (profile) => {
  const start = profile.school_start_date
    ? new Date(`${profile.school_start_date}T00:00:00`).toLocaleDateString()
    : 'Start date not set';
  const end = profile.school_end_date
    ? new Date(`${profile.school_end_date}T00:00:00`).toLocaleDateString()
    : 'Present';
  return `${start} – ${end}`;
};

const ProfileShutter = ({ user, token, profileUser, announcements: sharedAnnouncements }) => {
  const [profile, setProfile] = useState(profileUser || user);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [announcements, setAnnouncements] = useState([]);
  const [announcementError, setAnnouncementError] = useState('');
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const dragRef = useRef(null);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    if (profileUser) {
      setProfile(profileUser);
      setError('');
      return undefined;
    }

    let active = true;
    axios.get(`${API}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(({ data }) => {
      if (active) {
        setProfile(data);
        setError('');
      }
    }).catch(() => {
      if (active) setError('Profile details could not be loaded.');
    });
    return () => {
      active = false;
    };
  }, [profileUser, token, user.id]);

  useEffect(() => {
    if (sharedAnnouncements) {
      setAnnouncements(sharedAnnouncements);
      setAnnouncementError('');
      return undefined;
    }

    let active = true;
    axios.get(`${API}/announcements`, {
      headers: { Authorization: ['Bearer', token].join(' ') },
    }).then(({ data }) => {
      if (active) {
        setAnnouncements(data);
        setAnnouncementError('');
      }
    }).catch(() => {
      if (active) setAnnouncementError('Announcements could not be loaded.');
    });
    return () => {
      active = false;
    };
  }, [sharedAnnouncements, token]);

  const handlePointerDown = (event) => {
    if (event.button !== 0) return;
    if (!event.target.closest('[data-shutter-grip]')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      moved: false,
    };
  };

  const handlePointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const distance = drag.startY - event.clientY;
    if (Math.abs(distance) < 8) return;
    drag.moved = true;
    if (distance > 48) setOpen(true);
    if (distance < -48) setOpen(false);
  };

  const handlePointerUp = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.moved) {
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }
    dragRef.current = null;
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  const handleClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    setOpen(current => !current);
  };

  const name = profile?.name || user.name;
  const initials = name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();

  return (
    <>
      {open && (
        <button
          type="button"
          className="profile-shutter-backdrop"
          aria-label="Close profile panel"
          onClick={() => setOpen(false)}
        />
      )}
      <section
        className={`profile-shutter${open ? ' is-open' : ''}`}
        id="profile-shutter-content"
        aria-label="Account profile"
        aria-hidden={!open}
        inert={!open}
        data-testid="profile-shutter"
      >
        <div className="profile-shutter-content">
          <div className="profile-shutter-header">
            <div className="profile-avatar">
              {profile?.photo_url ? (
                <img src={profile.photo_url} alt={`${name}'s profile`} />
              ) : (
                <span aria-hidden="true">{initials || <UserRound />}</span>
              )}
            </div>
            <div className="profile-shutter-title">
              <p className="profile-eyebrow">{profile?.role === 'admin' ? 'Administrator' : 'Teacher profile'}</p>
              <h2>{name}</h2>
              {profile?.designation && <p>{profile.designation}</p>}
            </div>
            <button
              type="button"
              className="profile-shutter-close"
              aria-label="Close profile panel"
              onClick={() => setOpen(false)}
            >
              <X aria-hidden="true" />
            </button>
          </div>

          {error ? (
            <p className="profile-shutter-message" role="status">{error}</p>
          ) : profile?.role === 'teacher' ? (
            <>
              <div className="profile-tenure">
                <span>School service</span>
                <strong>{formatSchoolDates(profile)}</strong>
              </div>
              <div className="profile-info-grid">
                {profile.email && (
                  <a href={`mailto:${profile.email}`}>
                    <Mail aria-hidden="true" />
                    <span>{profile.email}</span>
                  </a>
                )}
                {profile.phone && (
                  <a href={`tel:${profile.phone}`}>
                    <Phone aria-hidden="true" />
                    <span>{profile.phone}</span>
                  </a>
                )}
                {profile.bio && <p className="profile-bio">{profile.bio}</p>}
              </div>
            </>
          ) : (
            <p className="profile-shutter-message">
              Signed in as @{profile?.username || user.username}
            </p>
          )}

          <section className="profile-announcements" aria-labelledby="profile-announcements-heading">
            <div className="profile-announcements-heading">
              <div>
                <p className="profile-eyebrow">From the administration</p>
                <h3 id="profile-announcements-heading">Announcements</h3>
              </div>
              <Megaphone aria-hidden="true" />
            </div>
            {announcementError ? (
              <p className="profile-shutter-message" role="status">{announcementError}</p>
            ) : announcements.length ? (
              <div className="profile-announcement-list">
                {announcements.map(announcement => (
                  <button
                    type="button"
                    className="profile-announcement-card"
                    key={announcement.id}
                    onClick={() => setSelectedAnnouncement(announcement)}
                  >
                    <span>{announcement.title}</span>
                    <small>
                      {announcement.created_at
                        ? new Date(announcement.created_at).toLocaleDateString()
                        : ''}
                    </small>
                  </button>
                ))}
              </div>
            ) : (
              <p className="profile-shutter-message">No announcements yet.</p>
            )}
          </section>
        </div>
      </section>

      <Dialog
        open={Boolean(selectedAnnouncement)}
        onOpenChange={isOpen => {
          if (!isOpen) setSelectedAnnouncement(null);
        }}
      >
        <DialogContent
          className="announcement-dialog-content z-[101]"
          overlayClassName="z-[100]"
        >
          {selectedAnnouncement && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedAnnouncement.title}</DialogTitle>
                <DialogDescription>
                  By {selectedAnnouncement.created_by || 'Administration'}
                  {selectedAnnouncement.created_at
                    ? ` · ${new Date(selectedAnnouncement.created_at).toLocaleString()}`
                    : ''}
                </DialogDescription>
              </DialogHeader>
              <div className="announcement-dialog-body">
                <Suspense fallback={<p className="text-sm text-gray-500">Loading announcement…</p>}>
                  <AnnouncementContent>{selectedAnnouncement.body}</AnnouncementContent>
                </Suspense>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <button
        type="button"
        className={`profile-shutter-handle${open ? ' is-open' : ''}`}
        aria-label={open ? 'Close profile panel' : 'Drag up or activate to open profile'}
        aria-expanded={open}
        aria-controls="profile-shutter-content"
        data-testid="profile-shutter-handle"
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => { dragRef.current = null; }}
        onKeyDown={handleKeyDown}
      >
        <span className="profile-shutter-handle-label">
          {open ? 'Close profile' : 'Your profile'}
        </span>
        <span className="profile-shutter-handle-grip" data-shutter-grip aria-hidden="true">
          {open
            ? <ArrowDown />
            : <ArrowUp />}
        </span>
      </button>
    </>
  );
};

export default ProfileShutter;
