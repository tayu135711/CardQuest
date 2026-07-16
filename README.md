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

### Current Structure

- `web/index.html` - main shell
- `web/styles.css` - underwater UI and layout
- `web/js/data.js` - spots and fish data
- `web/js/ocean-scene.js` - animated ocean canvas
- `web/js/pixi-effects.js` - PixiJS overlay effects
- `web/js/audio.js` - Tone.js soundscape
- `web/js/motion.js` - tilt and pointer rod control
- `web/js/blue-detector.js` - blue-object detection
- `web/js/storage.js` - local save handling
- `web/js/main.js` - game wiring

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
