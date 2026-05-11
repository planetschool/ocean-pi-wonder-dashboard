# Ocean Pi Wonder Dashboard

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open the URL Vite prints, usually `http://localhost:5173`.

## Connect R2 camera images

Edit `.env.local`:

```bash
VITE_DECK_CAM_URL="https://pub-xxxxxxxx.r2.dev/latest/deck.jpg"
VITE_BOW_CAM_URL="https://pub-xxxxxxxx.r2.dev/latest/bow.jpg"
VITE_DECK_CAM_REFRESH_MS=5000
VITE_BOW_CAM_REFRESH_MS=30000
```

Restart Vite after editing environment variables:

```bash
npm run dev
```

## Deploy to Vercel

Add the same four `VITE_...` variables in Vercel:

Project Settings → Environment Variables

Then deploy.

## Notes

The dashboard refreshes the DeckCam still every 5 seconds and the BowCam still every 30 seconds using cache-busting query strings. The images are loaded directly from public Cloudflare R2 URLs.
