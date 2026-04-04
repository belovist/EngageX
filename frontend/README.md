# Frontend Dashboard

## Development

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:3000`.

By default the dev server proxies:

- `/api` -> `http://127.0.0.1:8010`
- `/video_feed` -> `http://127.0.0.1:8010`
- `/health` -> `http://127.0.0.1:8010`

## Desktop App (Electron)

Run as a desktop app during development:

```bash
npm install
npm run dev:desktop
```

Build a Windows desktop installer:

```bash
npm run build:desktop
```

Build unpacked desktop app files (no installer):

```bash
npm run pack:desktop
```

Outputs are generated under `release/`.

If packaging fails on Windows with a symbolic-link privilege error, enable Windows Developer Mode or run the terminal as Administrator, then re-run `npm run build:desktop`.

## Production Build

```bash
npm run build
```

## Environment

Leave `VITE_API_URL` unset to use the local dev proxy.

Set it only if the backend is hosted elsewhere:

```bash
VITE_API_URL=http://127.0.0.1:8010
```
