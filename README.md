# School Scheduling Management System

## Overview
A minimalistic yet impressive web-based scheduling management system designed for high school exhibitions. The application allows administrators to manage class timetables in real-time while teachers can view their personalized schedules with instant update notifications.

## 🎯 Core Features

### For Administrators
- **Complete Schedule Management**: Create, edit, and delete teacher schedules across 5 working days (Monday-Friday) and 8 periods per day
- **Teacher Account Management**: Add and manage teacher accounts with secure authentication
- **Schedule Catalog Management**: Manage MongoDB-backed subjects and grade sections, shared by new and existing schedule forms
- **Break Period Configuration**: Toggle break periods between Period 3 and Period 4 (simulating half-yearly changes)
- **Conflict Detection**: Automatically prevent double-booking and scheduling conflicts
- **Real-time Update Tracking**: All schedule changes are logged with timestamps and admin attribution

### For Teachers
- **Personalized Timetable View**: Clean, organized display of weekly schedule
- **Change Notifications**: Orange-highlighted cells indicate schedule modifications within the last 24 hours
- **Change Log Panel**: View detailed history of recent schedule updates
- **Manual Refresh**: Refresh button to check for latest updates (simulates real-time in exhibition demo)
- **Dark Mode Support**: Toggle between light and dark themes

### Exhibition Features
- **Exhibition Mode Toggle**: Special badge display for demonstration purposes
- **QR Code Quick Login**: Mock QR-based authentication demo (shows concept for production)
- **Clean, Professional UI**: Minimalistic design with smooth animations and transitions
- **Responsive Layout**: Works seamlessly on desktop and mobile devices

## 🏗️ System Architecture

### Tech Stack
**Frontend:**
- React 19.x - Modern UI framework
- React Router - Client-side routing
- Tailwind CSS - Utility-first styling
- Shadcn/UI - Pre-built component library
- Axios - HTTP client

**Backend:**
- FastAPI - High-performance Python web framework
- PyMongo Async API - Async MongoDB driver
- PyJWT - JWT token authentication
- bcrypt - Password hashing
- Pydantic - Data validation

**Database:**
- MongoDB - NoSQL document database

### Architecture Flow
```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   React     │  HTTP   │   FastAPI   │  Async  │   MongoDB   │
│  Frontend   ├────────>│   Backend   ├────────>│   Database  │
│  (Port 3000)│ <──────┤  (Port 8000)│ <──────┤ (Port 27017)│
└─────────────┘  JSON   └─────────────┘  PyMongo Async  └─────────────┘
       │
       │ JWT Authentication
       │ State Management
       │ Routing
       v
┌─────────────────────────────────────┐
│  User Roles:                         │
│  - Admin: Full CRUD operations       │
│  - Teacher: Read-only schedule view  │
└─────────────────────────────────────┘
```

## 📦 Installation & Setup

### Prerequisites
- Node.js 20.19+ or 22.12+ and npm 11+
- Python 3.11+
- uv (optional, to refresh pinned Python dependencies)
- A MongoDB database: MongoDB Atlas (cloud) or a local MongoDB server; Docker is optional

Python must be installed on your computer. The backend's `.venv` folder is a project-specific virtual environment that keeps this project's Python packages separate; it is not a Python compiler or a copy of Python that makes the project independent of a Python installation. On Windows, check that Python is available by running `py --version` in Command Prompt.

### Backend Setup

1. **Choose your MongoDB:**

   **MongoDB Atlas (no Docker):** Create a free cluster in MongoDB Atlas. In **Database Access**, create a database user and password. In **Network Access**, add your current IP address. Use **Connect → Drivers** to copy the connection string (URI)—the cluster ID alone is not enough.

   **Local MongoDB (optional):** Start a database with Docker:
```bash
docker run -d --name mongodb --restart unless-stopped -p 27017:27017 -e MONGO_INITDB_ROOT_USERNAME=admin -e MONGO_INITDB_ROOT_PASSWORD=ssms-local-only -v ssms-mongodb-data:/data/db mongo:8
```

2. **Navigate to backend directory:**
```bash
cd backend
```

3. **Install Python dependencies:**
```bash
pip install -r requirements.txt
```

To refresh the pinned Python dependencies, update `requirements.in` and run:
```bash
uv pip compile --upgrade --python-version 3.11 requirements.in --output-file requirements.txt
```

4. **Configure the backend environment:**
Edit `backend/.env` to set `MONGO_URL` (the MongoDB connection string) and `DB_NAME` (the database name, `school_schedule_db`). If `backend/.env` does not exist yet, copy `backend/.env.example` to create it. Its example settings match the optional Docker command above. In PowerShell, run `Copy-Item .env.example .env` from inside `backend` only when `.env` does not already exist.

For Atlas, replace the local `MONGO_URL` with the URI from **Connect → Drivers**, inserting the database user credentials you created and setting the database path to `school_schedule_db`, for example:
```text
MONGO_URL=mongodb+srv://<db-user>:<url-encoded-password>@<cluster-host>/school_schedule_db?retryWrites=true&w=majority
```
URL-encode special characters in the database username or password. Never put this connection string in the frontend environment. Replace the example JWT key before deployment.

You do **not** need to create a schema or collections in Atlas by hand. On its first successful connection, the backend creates the demo users and settings; MongoDB creates the database and collections when the backend writes those records. It creates demo schedules if the schedules collection is empty.

The first backend startup also seeds the subject and grade-section catalog in MongoDB from the demo timetable. Admins can add or remove subjects and grade/section combinations in the dashboard's **Settings** tab; those options are then shared by both schedule creation and editing.

5. MAINNN **Start the backend server:**
```bash
uvicorn server:app --host 127.0.0.1 --port 8000
```

The backend will be available at `http://127.0.0.1:8000`
API documentation: `http://127.0.0.1:8000/docs`

### Frontend Setup

1. **Navigate to frontend directory:**
```bash
cd frontend
```

2. **Install dependencies:**
```bash
npm ci
```

3. MAINNN **Start the frontend development server:**
```bash
npm start
```

The application will open at `http://localhost:3000`. It defaults to the local backend at `http://127.0.0.1:8000`. To override it, edit `frontend/.env`; if the file does not exist, copy `frontend/.env.example` to create it. Change `REACT_APP_BACKEND_URL` and restart Vite.

### Start from VS Code on Windows

Open this repository's root folder in VS Code. First make sure `backend/.env` contains your MongoDB Atlas connection URI. Then press **Ctrl+Shift+P**, choose **Tasks: Run Task**, and run **SSMS: Start Backend**. Wait for **Application startup complete** in its terminal. Run **SSMS: Start Frontend** the same way in a second terminal, then open `http://localhost:3000`.

These tasks use the existing `backend/.venv` Python environment and frontend npm install. If VS Code reports that `backend\.venv\Scripts\python.exe` is missing, create the backend environment and install its dependencies once from the VS Code terminal:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

If the backend task starts and then exits with a MongoDB error, verify `MONGO_URL` in `backend/.env` and your Atlas Network Access IP allowlist. Opening port 8000 in a browser does not start the backend; that port serves the API only while the backend task is running.

### Run from Windows Command Prompt (no VS Code)

You can run both parts of the app from ordinary **Command Prompt (cmd.exe)**. Keep each server running in its own Command Prompt window. Before starting, install Python 3.11+, Node.js, and npm, and make sure `backend\.env` contains a working MongoDB URI. For Atlas, use the full connection URI from **Connect → Drivers**; the cluster ID by itself is not enough. Do not share or commit your `.env` file.

**1. Prepare the backend (one time).** Open Command Prompt and run:

```cmd
cd /d "C:\path\to\SSMS-main\backend"
if not exist .venv\Scripts\python.exe py -3.11 -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
if not exist .env copy .env.example .env
notepad .env
```

Replace `C:\path\to\SSMS-main` with the folder where you saved the project. The `py -3.11` command creates the local `.venv` using the Python 3.11 installation on your computer; it does not install Python. If `py` is not recognized or Python 3.11 is not installed, install Python 3.11 first, then open a new Command Prompt. In Notepad, set `MONGO_URL` to your Atlas connection URI and confirm `DB_NAME=school_schedule_db`, then save and close the file. If you already have a `.venv`, you can skip its creation; install dependencies again only if needed.

**2. Start the backend.** In that same window, run:

```cmd
.venv\Scripts\python.exe -u -m uvicorn server:app --host 127.0.0.1 --port 8000 --lifespan on --log-level info
```

Leave this window open. Wait for `Application startup complete`, then check the API at `http://127.0.0.1:8000/docs`. If startup exits with a MongoDB error, check the saved URI, Atlas database credentials, and Atlas **Network Access** IP allowlist.

**3. Prepare and start the frontend.** Open a second Command Prompt window:

```cmd
cd /d "C:\path\to\SSMS-main\frontend"
npm ci
npm start -- --host 127.0.0.1
```

Replace the project path as above. `npm ci` installs the frontend packages and is normally needed only for initial setup or after dependency changes. Leave this window open and visit `http://localhost:3000`.

To stop either server, focus its Command Prompt window and press **Ctrl+C**. Opening either URL in a browser does not start its server; both command windows must remain running.

### Quick Start (All-in-One)

Run these commands in separate terminal windows:

**Terminal 1 - MongoDB:**
```bash
docker run -d --name mongodb --restart unless-stopped -p 27017:27017 -e MONGO_INITDB_ROOT_USERNAME=admin -e MONGO_INITDB_ROOT_PASSWORD=ssms-local-only -v ssms-mongodb-data:/data/db mongo:8
```

**Terminal 2 - Backend:**
```bash
cd backend
pip install -r requirements.txt
if [ ! -f .env ]; then cp .env.example .env; fi
uvicorn server:app --host 127.0.0.1 --port 8000
```

**Terminal 3 - Frontend:**
```bash
cd frontend
npm ci
if [ ! -f .env ]; then cp .env.example .env; fi
npm start
```

On Windows PowerShell, run `if (-not (Test-Path .env)) { Copy-Item .env.example .env }` in each backend and frontend directory if `.env` is missing.

### Verification

Run the automated checks from their respective directories:
```bash
cd backend
python -m pytest

cd ../frontend
npm test
npm run build
```

1. **Check MongoDB:** `docker ps | grep mongodb`
2. **Check Backend:** Visit `http://127.0.0.1:8000/docs`
3. **Check Frontend:** Visit `http://localhost:3000`

## 👥 Demo Accounts

The login page loads the public demo teacher names and usernames from MongoDB. Passwords are stored as one-way hashes and are not displayed or retrievable; ask the administrator for sign-in credentials. Seeded demo credentials are for local demonstration only and must be changed before production use.

## 🎭 Exhibition Mode

Toggle exhibition mode from the homepage to showcase the system with:
- Floating badge indicating demo mode
- QR code login demonstration
- Optimized for presentation on large screens

## 🚀 Usage Guide

### Admin Workflow
1. Login with admin credentials
2. Navigate to "Schedules" tab
3. Select a teacher from dropdown
4. Click empty cells to add schedule entries
5. Click existing entries to edit or delete
6. Switch to "Teachers" tab to manage accounts
7. Adjust break period in "Settings" tab

### Teacher Workflow
1. Login with teacher credentials
2. View personalized timetable automatically
3. Orange highlights show recent changes
4. Check change log panel for details
5. Use refresh button to get latest updates

## 🎯 Exhibition Presentation Strategy

### Demo Script
1. Show homepage with Exhibition Mode toggle
2. Login as admin, add a schedule entry
3. In another window, login as teacher
4. Refresh teacher view to show the change
5. Demonstrate orange highlight and change log
6. Show break period configuration
7. Display QR code demo modal

## 📝 Key Features Explained

### Break Period System
- Can be positioned after Period 3 or Period 4
- Admin can toggle this in Settings tab
- Simulates half-yearly schedule adjustments
- Automatically displayed in timetable grid

### Change Tracking
- Every schedule edit creates a changelog entry
- Teachers see orange highlights for 24 hours
- Detailed change log shows old vs new values
- Tracks which admin made the change

### Conflict Detection
- Prevents double-booking of classrooms
- Checks if class already has a lesson at that time
- Shows clear error message when conflict detected

## 🔒 Security Features

- JWT Authentication with 7-day token expiration
- Bcrypt password hashing
- Role-based access control
- Protected API endpoints
- CORS configuration

## 🎨 Design Philosophy

**Minimalistic & Professional:**
- Clean light theme with soft gradients
- Academic color palette (blue, gray, orange)
- Space Grotesk for headings, Inter for body text
- Glass-morphism effects for depth
- Smooth transitions and animations

## 🔧 Troubleshooting

**Backend won't start:**
- Check if MongoDB Docker container is running: `docker ps | grep mongodb`
- Verify port 8000 is available
- Check MongoDB connection string in `.env` file
- Ensure Docker is installed and running

**MongoDB connection issues:**
- Restart MongoDB container: `docker restart mongodb`
- Check container logs: `docker logs mongodb`
- Verify authentication credentials in connection string

**Frontend won't connect:**
- Ensure backend is running on port 8000
- Check browser console for CORS errors
- Verify backend API endpoints are accessible
- The frontend defaults to `http://127.0.0.1:8000`; if overridden, check `frontend/.env` has the correct `REACT_APP_BACKEND_URL`
- Restart frontend after changing `.env` file

**Login fails:**
- Verify MongoDB is running and accessible
- Check backend logs for initialization messages
- Ensure demo users were created during startup
- Try restarting the backend server

**Port conflicts:**
- Backend uses port 8000 (not 8001)
- Frontend uses port 3000
- MongoDB uses port 27017

**Port already in use error:**
- Kill existing uvicorn processes: `pkill -f uvicorn`
- Or find and kill specific process: `ps aux | grep uvicorn` then `kill [PID]`
- Check if port is free: `ss -tlnp | grep 8000`

## 📄 API Endpoints

### Authentication
- `POST /api/auth/login` - Login and get JWT token
- `GET /api/auth/verify` - Verify token

### Users (Admin only)
- `GET /api/users` - List all users
- `POST /api/users` - Create new user
- `DELETE /api/users/{user_id}` - Delete user

### Schedules
- `GET /api/schedules` - Get schedules
- `POST /api/schedules` - Create schedule (Admin)
- `PUT /api/schedules/{schedule_id}` - Update schedule (Admin)
- `DELETE /api/schedules/{schedule_id}` - Delete schedule (Admin)

### Schedule Catalog (Admin only)
- `GET /api/catalog` - List saved subjects and grade/section combinations
- `POST /api/catalog/subjects` and `DELETE /api/catalog/subjects/{option_id}` - Manage subjects
- `POST /api/catalog/grades` and `DELETE /api/catalog/grades/{option_id}` - Manage grade sections

### Settings
- `GET /api/settings/break-period` - Get break config
- `PUT /api/settings/break-period` - Update break position (Admin)

### Changelogs
- `GET /api/changelogs` - Get change history

## 🙏 Credits

**Created by Us**

This project showcases modern full-stack web development, user experience design, and practical problem-solving for educational institutions.

---

**Status:** Exhibition Demo Ready
