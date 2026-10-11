# Ffomo

One Next.js app. A decision goes to `POST /api/decide`, which asks Gemini Flash (Google Search, one JSON schema) and drops links that do not load. Photos go to `POST /api/preview` only after an upload. The face check stays in the browser. Decisions stay in localStorage. Shared check-ins go to MongoDB (`MONGODB_URI`) so the next person at the same fork can read them.

```bash
cp .env.example .env.local
# put a Gemini API key in .env.local
npm run dev
```

`npm run check` checks story strength. `npm run build` builds the app.

## Production

Live: https://ffomo.vercel.app

`npm run build && npm start`, or deploy to Vercel.

Set these on the host. Server only. Never in the client or in git:

- `GEMINI_API_KEY` — search and image draw
- `SMARTSPECTRA_API_KEY` — optional pulse. The SDK is native and may not run on Vercel
- `ELEVENLABS_API_KEY` — optional talk
- `MONGODB_URI` — shared check-ins. Atlas must allow the host (`0.0.0.0/0` on Vercel)

A search can take a minute. The decide route is set to 300s.
