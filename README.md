# CardQuest

CardQuest is being rebuilt as a PWA so it can run on a smartphone browser and be deployed on Render as a static site.

## Current Direction

- Smartphone camera in the browser
- Fishing mini-game first
- Marker/card recognition can be strengthened later
- Local persistence in `localStorage`
- Installable as a PWA

## Web Version

The browser app lives in [`web/`](./web/).

## Run Locally

Serve the `web/` folder with any static server:

```bash
python -m http.server 8000 -d web
```

Then open `http://localhost:8000`.

## Deploy

For Render, create a **Static Site** and point the publish directory at `web/`.

## Legacy Prototype

The earlier Kivy prototype is still in the repository as a reference while we transition to the web version.
