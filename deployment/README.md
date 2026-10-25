# Deploy SSMS for online use

This project has two parts:

- **Frontend:** React + Vite. Deploy this to Vercel.
- **Backend:** FastAPI + MongoDB. Deploy the API to a Python web-service host such as Render, and use MongoDB Atlas for the database.

Vercel will keep serving the frontend. It does not keep this project's current FastAPI/Uvicorn process running as a persistent server, so the backend needs its own host. The browser talks to that backend over HTTPS.

## 1. Prepare the GitHub repository

1. Create a GitHub account if needed, then create a **private** repository for this project.
2. From the project root, check that secrets and generated folders are ignored:

   ```cmd
   git status --short
   ```

   Do not upload `backend/.env`, `frontend/.env`, `.venv`, `node_modules`, or build output. The repository `.gitignore` excludes these. Keep the `.env.example` templates; they contain placeholders/defaults, not your live credentials.
3. In Command Prompt at the project root, stage and upload the source:

   ```cmd
   git add .
   git status
   git commit -m "Prepare SSMS for deployment"
   git branch -M main
   git remote add origin https://github.com/YOUR-GITHUB-NAME/YOUR-REPOSITORY.git
   git push -u origin main
   ```

   Replace the GitHub URL with your repository URL. If `origin` is already configured, skip `git remote add origin`.
4. Before pushing, inspect `git status` and make sure no real `.env` file, password, MongoDB URI, or JWT secret is staged. If a secret has ever been committed or shared, rotate it; deleting it from the latest version alone does not make the old value safe.

## 2. Confirm MongoDB Atlas is ready

The backend connects to Atlas during startup, so a bad URI or blocked network access prevents the API from starting.

1. In Atlas, create a database user with a strong password and allow network access from your backend host. Prefer the host's published outbound IP addresses or a static-egress option when available. Avoid allowing every IP (`0.0.0.0/0`) unless you understand and accept the exposure.
2. Copy the **full application connection URI** from Atlas **Connect → Drivers**. URL-encode special characters in the database username or password. The app uses `DB_NAME` to select `school_schedule_db`; collections are created by the app as it writes data.
3. Keep the URI private. It belongs only in the backend host's environment settings, never in Vercel or frontend source.

## 3. Deploy the backend API to Render

1. Create/sign in to a Render account and choose **New → Web Service**.
2. Connect the GitHub repository.
3. Set these service options:

   | Setting | Value |
   | --- | --- |
   | Root Directory | `backend` |
   | Runtime / Language | Python |
   | Build Command | `pip install -r requirements.txt` |
   | Start Command | `uvicorn server:app --host 0.0.0.0 --port $PORT` |

4. Add these environment variables in Render's service settings:

   | Name | Value |
   | --- | --- |
   | `MONGO_URL` | The full private Atlas connection URI |
   | `DB_NAME` | `school_schedule_db` |
   | `JWT_SECRET_KEY` | A new, long, random secret (do not reuse the example key) |
   | `CORS_ORIGINS` | `https://YOUR-VERCEL-DOMAIN` |

   Add a custom frontend domain as another comma-separated origin, for example `https://YOUR-VERCEL-DOMAIN,https://YOUR-CUSTOM-DOMAIN`. Do not include paths or a trailing slash. You can update this after Vercel gives you the real domain.
5. Create the service and wait for a successful deployment. Copy its HTTPS URL, such as `https://your-api-name.onrender.com`. Visit `https://your-api-name.onrender.com/docs`; FastAPI's API docs should load.

**Keeping it available:** Vercel serves the frontend; the Render API is the part that can sleep. Render Free web services spin down after 15 minutes without traffic and can take about a minute to start again. That can happen after any idle period, even if the app has been deployed for a long time; it is not a one-time Vercel startup delay. Free services are also subject to monthly usage limits and may be suspended if those limits are exhausted, so a free deployment is not a guarantee of uninterrupted availability for a year. For an API that stays running without the free-tier sleep behavior, select a paid always-on compute plan and review its current price before confirming. Plans, limits, and prices can change; check Render's billing page before deploying.

## 4. Deploy the frontend to Vercel

1. Sign in to Vercel and choose **Add New → Project**.
2. Import the GitHub repository.
3. Set **Root Directory** to `frontend`. Vercel should detect Vite. Confirm these build settings if it asks:

   | Setting | Value |
   | --- | --- |
   | Framework Preset | Vite |
   | Install Command | `npm ci` |
   | Build Command | `npm run build` |
   | Output Directory | `build` |

4. Before the first deployment, add this project environment variable:

   | Name | Value |
   | --- | --- |
   | `REACT_APP_BACKEND_URL` | Your Render HTTPS URL, for example `https://your-api-name.onrender.com` |

   Do not add `/api` to the end of the value. The frontend app adds `/api` itself. This is a public frontend setting, not a place for MongoDB credentials or the JWT signing secret.
5. Apply the variable to **Production** and **Preview** if you want preview deployments to use the same API. Deploy the project and copy the production `*.vercel.app` URL.
6. If you use a custom domain, add it in Vercel's project settings, wait for its HTTPS setup, then add that exact `https://` origin to Render's `CORS_ORIGINS` value and redeploy the backend.

The included `frontend/vercel.json` sends browser page routes such as `/admin` and `/dashboard` back to the Vite app, so reloading those routes works.

## 5. Verify the live app

1. Open the Vercel production URL and sign in.
2. Check that the browser can reach the Render API. The Render `/docs` URL should load; a login failure usually means the backend URL, MongoDB connection, or CORS origin needs attention.
3. Test a page reload after sign-in, then sign out and sign in again.
4. Check Render logs for MongoDB connection errors and Vercel deployment/build logs for frontend errors.
5. Do not treat the demo accounts as production credentials. Change seeded/demo passwords and replace the JWT secret before sharing the site with real users.

## 6. Publish later updates

After Vercel and Render are connected to the GitHub repository, pushing a commit to the configured production branch triggers new deployments:

```cmd
git add .
git commit -m "Describe your change"
git push
```

The frontend and backend deployments may finish at different times. If an environment variable changes, redeploy the service that uses it.

## Troubleshooting

- **Vercel loads, but login says it cannot reach the backend:** Check `REACT_APP_BACKEND_URL` in Vercel (HTTPS, no `/api` suffix), then redeploy the frontend.
- **Browser reports a CORS error:** Set Render `CORS_ORIGINS` to the exact Vercel/custom frontend origin, comma-separated if there is more than one, then redeploy the backend.
- **Render fails during startup:** Check that `MONGO_URL`, `DB_NAME`, and `JWT_SECRET_KEY` exist in Render and that Atlas allows the backend host's network traffic. Review Render logs.
- **Render responds slowly on the first request:** A Free service may have spun down. Upgrade to an always-on plan if that delay is not acceptable.
- **Reloading `/admin` or `/dashboard` returns 404:** Confirm Vercel's Root Directory is `frontend` and that `frontend/vercel.json` is included in the GitHub repository.

## Official platform references

- [Vercel: Vite](https://vercel.com/docs/frameworks/frontend/vite)
- [Vercel: Import a project](https://vercel.com/docs/getting-started-with-vercel)
- [Vercel: Environment variables](https://vercel.com/docs/environment-variables)
- [Vercel: Rewrites](https://vercel.com/docs/routing/rewrites)
- [Render: Deploy FastAPI](https://render.com/docs/deploy-fastapi)
- [Render: Free instance limitations](https://render.com/docs/free)
- [MongoDB Atlas: Connect to your cluster](https://www.mongodb.com/docs/atlas/connect-your-application/)
