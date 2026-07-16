# CardQuest PWA

This folder contains the browser version of CardQuest.

## What it does

- Opens the smartphone camera
- Detects a blue object and changes the fishing spot
- Moves the rod when you tilt the phone up and down
- Starts a fishing mini-game
- Saves catches in `localStorage`
- Can be installed as a PWA

## Run locally

Serve the `web/` folder with any static file server.

Example:

```bash
python -m http.server 8000 -d web
```

Then open `http://localhost:8000`.

## Deploy to Render

Use a Render Static Site pointing at the `web/` directory as the publish directory.
