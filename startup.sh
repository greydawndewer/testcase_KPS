#!/bin/bash

# --- STEP 1: Launch Backend (uvicorn) ---
# Opens a new standalone Git Bash window in the background
"C:\Program Files\Git\git-bash.exe" --cd="./backend" -c "uvicorn server:app --host 127.0.0.1 --port 8000; bash" &

# --- STEP 2: Launch Frontend (npm) ---
# Opens a second standalone Git Bash window in the background
"C:\Program Files\Git\git-bash.exe" --cd="./frontend" -c "npm run start; bash" &

# Keep the main root terminal alive so background tasks don't get orphaned
exit
