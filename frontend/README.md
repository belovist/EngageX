# Frontend Dashboard

## Development

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:3000`.

By default the dev server proxies:

- `/api` -> `http://127.0.0.1:8000`
- `/video_feed` -> `http://127.0.0.1:8000`
- `/health` -> `http://127.0.0.1:8000`

## Production Build

```bash
npm run build
```

## Environment

Leave `VITE_API_URL` unset to use the local dev proxy.

Set it only if the backend is hosted elsewhere:

```bash
VITE_API_URL=http://127.0.0.1:8000
```
