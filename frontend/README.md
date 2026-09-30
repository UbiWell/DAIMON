# DAIMON Frontend

The research dashboard frontend of **DAIMON**, an AI-augmented research dashboard for longitudinal sensing studies. Built with Vite, React, TypeScript, shadcn-ui and Tailwind CSS.

* Backend (Flask API + GLOSS): [`../backend`](../backend). Set it up first by following its README.
* GLOSS, the sensemaking system behind the dashboard's natural-language queries: [UbiWell/GLOSS](https://github.com/UbiWell/GLOSS)

## Getting started

Requirements: Node.js 18+ and npm.

```sh
npm install
cp .env.example .env   # then edit VITE_API_URL to point at your backend
npx vite               # start the frontend dev server
```

The app expects the [DAIMON backend](../backend) to be running and reachable at `VITE_API_URL`
(default `http://localhost:5050`). Requests to `/api` are proxied there in development.

Log in with the example account `TestUser` / `daimon123` (see the backend README to add users).

## Build

```sh
npm run build
```

The app is served under the `/gloss-dashboard/` base path (see `vite.config.ts`).

## Configuration before deploying

Replace these placeholders with your own values:

| Where | Placeholder | Set it to |
| --- | --- | --- |
| `.env` | `VITE_API_URL` | The URL of your DAIMON backend, e.g. `https://api.example.com` |
| `index.html` (`og:url` meta tag) | `<your-deployment-url>` | The public URL where you host this dashboard, e.g. `https://dashboard.example.com` |

If the frontend and backend are served from the same HTTPS origin, you can leave
`VITE_API_URL` unset and the app will call the API with relative `/api/...` URLs.
