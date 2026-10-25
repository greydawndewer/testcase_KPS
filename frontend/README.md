# Frontend

The frontend uses React, Vite, and Tailwind CSS.

## Requirements

- Node.js 20.19+ or 22.12+
- npm 11+

## Commands

```bash
npm ci
npm start
npm test
npm run build
npm run preview
```

The development server runs at `http://localhost:3000` and defaults to the API
at `http://127.0.0.1:8000`. To override it, copy `.env.example` to `.env`,
change `REACT_APP_BACKEND_URL`, and restart the development server. Do not put
MongoDB credentials in frontend environment files.
