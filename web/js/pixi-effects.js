(function (global) {
  function createOceanOverlay(canvas, options) {
    if (!global.PIXI || !canvas) {
      return {
        start() {},
        resize() {},
        setSpot() {},
        setRodPosition() {},
        pulse() {},
      };
    }

    const PIXI = global.PIXI;
    const paletteMap = {
      pond: { bubble: 0xbef6ff, fish: 0x99dff4, beam: 0x8cf0ff, mist: 0x9be9ff },
      river: { bubble: 0xc7f2ff, fish: 0xb2e7ff, beam: 0x7fcbff, mist: 0x8ad8ff },
      sea: { bubble: 0xdaf2ff, fish: 0xa8dfff, beam: 0x64bfff, mist: 0x70c7ff },
    };

    const app = new PIXI.Application({
      view: canvas,
      transparent: true,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      backgroundAlpha: 0,
      width: canvas.clientWidth,
      height: canvas.clientHeight,
    });

    const root = new PIXI.Container();
    const beamLayer = new PIXI.Container();
    const fishLayer = new PIXI.Container();
    const bubbleLayer = new PIXI.Container();
    const mistLayer = new PIXI.Container();
    const flashLayer = new PIXI.Container();

    root.addChild(mistLayer, beamLayer, fishLayer, bubbleLayer, flashLayer);
    app.stage.addChild(root);

    const state = {
      spot: options.defaultSpot,
      rodPosition: 0.5,
      pulse: 0,
      flash: 0,
      time: 0,
      palette: paletteMap[options.defaultSpot.id] || paletteMap.sea,
      bubbles: [],
      fish: [],
      beams: [],
      specks: [],
    };

    function drawBubble(graphic, bubble) {
      const c = state.palette.bubble;
      graphic.clear();
      graphic.lineStyle(1.4, c, 0.28);
      graphic.beginFill(0xffffff, 0.03);
      graphic.drawCircle(0, 0, bubble.size);
      graphic.endFill();
      graphic.lineStyle(0);
      graphic.beginFill(0xffffff, 0.14);
      graphic.drawCircle(-bubble.size * 0.25, -bubble.size * 0.25, bubble.size * 0.22);
      graphic.endFill();
    }

    function drawFish(graphic, fish) {
      const c = state.palette.fish;
      graphic.clear();
      graphic.beginFill(c, 0.1 + fish.depth * 0.1);
      graphic.drawEllipse(0, 0, fish.size * (0.72 + fish.depth * 0.28), fish.size * (0.26 + fish.depth * 0.12));
      graphic.endFill();
      graphic.beginFill(c, 0.14 + fish.depth * 0.12);
      graphic.drawPolygon([
        -fish.size * 0.58, 0,
        -fish.size * 0.98, -fish.size * 0.16,
        -fish.size * 0.98, fish.size * 0.16,
      ]);
      graphic.endFill();
      graphic.beginFill(0xffffff, 0.45);
      graphic.drawCircle(fish.size * 0.32, -fish.size * 0.06, fish.size * 0.05);
      graphic.endFill();
    }

    function drawBeam(graphic, beam) {
      const c = state.palette.beam;
      graphic.clear();
      graphic.beginFill(c, beam.alpha);
      graphic.drawPolygon([
        beam.x - beam.width * 0.18, 0,
        beam.x + beam.width * 0.18, 0,
        beam.x + beam.width * 0.42, beam.height,
        beam.x - beam.width * 0.42, beam.height,
      ]);
      graphic.endFill();
    }

    function seedEntities() {
      beamLayer.removeChildren();
      fishLayer.removeChildren();
      bubbleLayer.removeChildren();
      mistLayer.removeChildren();
      flashLayer.removeChildren();

      const count = Math.max(28, Math.floor((canvas.clientWidth * canvas.clientHeight) / 2200));
      state.specks = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.clientWidth,
        y: Math.random() * canvas.clientHeight,
        vx: -0.08 + Math.random() * 0.16,
        vy: -0.02 + Math.random() * 0.04,
        size: 0.5 + Math.random() * 2,
        alpha: 0.05 + Math.random() * 0.16,
        phase: Math.random() * Math.PI * 2,
      }));

      state.beams = Array.from({ length: 5 }, (_, index) => {
        const graphic = new PIXI.Graphics();
        beamLayer.addChild(graphic);
        return {
          graphic,
          x: canvas.clientWidth * (0.12 + index * 0.18 + Math.random() * 0.05),
          width: canvas.clientWidth * (0.24 + Math.random() * 0.12),
          height: canvas.clientHeight,
          alpha: 0.03 + Math.random() * 0.08,
          sway: 0.0005 + Math.random() * 0.0015,
        };
      });

      state.bubbles = Array.from({ length: 34 }, () => {
        const graphic = new PIXI.Graphics();
        bubbleLayer.addChild(graphic);
        return {
          graphic,
          x: Math.random() * canvas.clientWidth,
          y: canvas.clientHeight + Math.random() * canvas.clientHeight * 0.6,
          size: 2 + Math.random() * 12,
          speed: 0.22 + Math.random() * 1,
          wobble: Math.random() * Math.PI * 2,
          alpha: 0.14 + Math.random() * 0.3,
        };
      });

      state.fish = Array.from({ length: 8 }, () => {
        const graphic = new PIXI.Graphics();
        fishLayer.addChild(graphic);
        return {
          graphic,
          x: canvas.clientWidth * (0.05 + Math.random() * 0.88),
          y: canvas.clientHeight * (0.12 + Math.random() * 0.66),
          size: 16 + Math.random() * 40,
          speed: 0.05 + Math.random() * 0.18,
          dir: Math.random() > 0.5 ? 1 : -1,
          depth: 0.15 + Math.random() * 0.85,
          wave: Math.random() * Math.PI * 2,
          drift: Math.random() * 0.3,
        };
      });

      for (let i = 0; i < 7; i += 1) {
        const mist = new PIXI.Graphics();
        mistLayer.addChild(mist);
      }

      state.flashGraphic = new PIXI.Graphics();
      flashLayer.addChild(state.flashGraphic);
    }

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
      app.renderer.resolution = dpr;
      app.renderer.resize(rect.width, rect.height);
      root.position.set(0, 0);
      seedEntities();
    }

    function setSpot(spot) {
      state.spot = spot;
      state.palette = paletteMap[spot.id] || paletteMap.sea;
      state.flash = Math.min(1, state.flash + 0.1);
      redrawAll();
    }

    function setRodPosition(value) {
      state.rodPosition = value;
    }

    function pulse(strength = 1) {
      state.pulse = Math.min(1, state.pulse + strength);
      state.flash = Math.min(1, state.flash + strength * 0.85);
    }

    function redrawAll() {
      for (const beam of state.beams) drawBeam(beam.graphic, beam);
      for (const bubble of state.bubbles) drawBubble(bubble.graphic, bubble);
      for (const fish of state.fish) drawFish(fish.graphic, fish);
      for (const mist of mistLayer.children) {
        const index = mistLayer.children.indexOf(mist);
        const amount = 0.4 + (index % 3) * 0.12;
        mist.clear();
        mist.beginFill(state.palette.mist, amount * 0.12);
        const x = canvas.clientWidth * (0.15 + (index * 0.12) % 0.7);
        const y = canvas.clientHeight * (0.12 + (index % 4) * 0.1);
        mist.drawEllipse(x, y, canvas.clientWidth * 0.14, canvas.clientHeight * 0.04);
        mist.endFill();
      }
    }

    function update(time) {
      state.time = time;
      state.pulse *= 0.94;
      state.flash *= 0.9;

      const w = canvas.clientWidth;
      const h = canvas.clientHeight;

      for (const beam of state.beams) {
        beam.x += Math.sin(time * beam.sway) * 0.2;
        drawBeam(beam.graphic, beam);
      }

      for (const bubble of state.bubbles) {
        bubble.y -= bubble.speed;
        bubble.x += Math.sin(time * 0.001 + bubble.wobble) * 0.16;
        if (bubble.y < -bubble.size) {
          bubble.y = h + Math.random() * h * 0.3;
          bubble.x = Math.random() * w;
        }
        drawBubble(bubble.graphic, bubble);
        bubble.graphic.x = bubble.x;
        bubble.graphic.y = bubble.y;
        bubble.graphic.alpha = bubble.alpha;
      }

      for (const fish of state.fish) {
        fish.x += fish.speed * fish.dir;
        fish.y += Math.sin(time * 0.0015 + fish.wave) * (0.16 + fish.depth * 0.24);
        if (fish.x < -fish.size * 2) fish.x = w + fish.size * 2;
        if (fish.x > w + fish.size * 2) fish.x = -fish.size * 2;
        drawFish(fish.graphic, fish);
        fish.graphic.x = fish.x;
        fish.graphic.y = fish.y;
        fish.graphic.scale.set(0.7 + fish.depth * 0.52);
        fish.graphic.rotation = fish.dir < 0 ? Math.PI : 0;
        fish.graphic.alpha = 0.12 + fish.depth * 0.16 + state.pulse * 0.04;
      }

      for (let i = 0; i < mistLayer.children.length; i += 1) {
        const mist = mistLayer.children[i];
        const wobble = Math.sin(time * 0.0008 + i) * 18;
        mist.x = w * (0.08 + (i * 0.13) % 0.82) + wobble;
        mist.y = h * (0.12 + (i % 4) * 0.12) + Math.cos(time * 0.0006 + i) * 12;
        mist.scale.set(1 + Math.sin(time * 0.0007 + i) * 0.06);
        mist.alpha = 0.06 + state.pulse * 0.06;
      }

      if (state.flashGraphic) {
        state.flashGraphic.clear();
        if (state.flash > 0.01) {
          state.flashGraphic.beginFill(0xffffff, state.flash * 0.14);
          state.flashGraphic.drawRect(0, 0, w, h);
          state.flashGraphic.endFill();
        }
      }
    }

    function start() {
      app.ticker.add(update);
      resize();
    }

    resize();
    window.addEventListener("resize", resize);

    return {
      start,
      resize,
      setSpot,
      setRodPosition,
      pulse,
    };
  }

  global.CardQuest = global.CardQuest || {};
  global.CardQuest.pixiEffects = { createOceanOverlay };
})(window);
