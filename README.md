# ✿ Sparkle Snap ✿

A whimsical, Y2K-style photobooth that runs in the browser.

Guests pick 2, 4 or 6 photos, a 3, 5 or 10 second timer, and a look (a filter or a vintage camera style), then strike their poses. After shooting they try their real photos in different frame styles, hit **print it!**, and scan a QR code to get the photo strip on their phone, on any network.

**Live booth:** https://sparkle-snap-cce3db.netlify.app

## Features

- **Looks:** 6 filters (natural, vintage, b&w, dreamy, y2k glow, cool film) or 6 vintage camera styles (instant cam, 70s instant, disposable, lomo, toy cam, 35mm b&w) with grain, vignettes, light leaks and date stamps
- **Frames:** sparkle, classic white, classic black, instant prints, film strip, gingham, holo. Chosen *after* shooting, with a live preview
- **QR download:** each print gets a random, unguessable link. There's no gallery or listing
- **Privacy:** photos auto-delete after 24 hours, and the booth screen wipes itself after each guest
- **Booth key:** only booths holding the secret key can upload

## Project layout

```
public/index.html             the booth (camera, looks, frames, QR)
netlify/functions/upload.mjs  POST /api/upload (needs the booth key)
netlify/functions/photo-page.mjs  GET /p/:id, the guest download page
netlify/functions/photo.mjs   GET /photos/:id, the image itself
netlify/functions/cleanup.mjs hourly job that deletes photos older than 24h
netlify/lib/shared.mjs        shared helpers
photobooth.html, server.py    the first local-only prototype (not used live)
```

Photos are stored in [Netlify Blobs](https://docs.netlify.com/blobs/overview/).

## Run locally

```bash
npm install
```

Create a `.env` file (never commit it):

```
BOOTH_KEY=any-local-test-key
# optional: lets phones on the same Wi-Fi open QR links
PUBLIC_BASE_URL=http://<your-computer-ip>:8888
```

```bash
npx netlify dev
```

Open `http://localhost:8888/?key=any-local-test-key` once and the key is remembered on that device.

## Deploy

```bash
npx netlify env:set BOOTH_KEY "<a long random secret>" --secret
npx netlify deploy --prod
```

On each booth device, open `https://<your-site>/?key=<the secret>` once.

> **Keep the booth key secret.** It's stored in Netlify's environment settings, never in this repository.
