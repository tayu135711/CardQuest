(function (global) {
  function createOceanScene(canvas, options) {
    const ctx = canvas.getContext("2d", { alpha: true });
    const state = {
      width: 0,
      height: 0,
      spot: options.defaultSpot,
      rodPosition: 0.5,
      pulse: 0,
      ripple: 0,
      time: 0,
      running: false,
      particles: [],
      bubbles: [],
      fish: [],
    };

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
      state.width = Math.floor(rect.width * dpr);
      state.height = Math.floor(rect.height * dpr);
      canvas.width = state.width;
      canvas.height = state.height;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seedEntities();
    }

    function seedEntities() {
      const count = Math.max(16, Math.floor((canvas.clientWidth * canvas.clientHeight) / 3500));
      state.particles = Array.from({ length: count }, (_, index) => ({
        x: Math.random() * canvas.clientWidth,
        y: Math.random() * canvas.clientHeight,
        vx: -0.15 + Math.random() * 0.3,
        vy: -0.04 + Math.random() * 0.08,
        size: 0.8 + Math.random() * 2.4,
        alpha: 0.1 + Math.random() * 0.28,
        phase: Math.random() * Math.PI * 2,
      }));
      state.bubbles = Array.from({ length: 14 }, (_, index) => ({
        x: Math.random() * canvas.clientWidth,
        y: canvas.clientHeight + Math.random() * canvas.clientHeight * 0.6,
        size: 4 + Math.random() * 16,
        speed: 0.3 + Math.random() * 0.8,
        wobble: Math.random() * Math.PI * 2,
        alpha: 0.14 + Math.random() * 0.28,
      }));
      state.fish = Array.from({ length: 4 }, (_, index) => ({
        x: canvas.clientWidth * (0.15 + Math.random() * 0.7),
        y: canvas.clientHeight * (0.22 + Math.random() * 0.45),
        size: 26 + Math.random() * 42,
        speed: 0.08 + Math.random() * 0.28,
        dir: Math.random() > 0.5 ? 1 : -1,
        hue: index,
      }));
    }

    function setSpot(spot) {
      state.spot = spot;
    }

    function setRodPosition(value) {
      state.rodPosition = value;
    }

    function pulse(strength = 1) {
      state.pulse = Math.min(1, state.pulse + strength);
      state.ripple = Math.min(1, state.ripple + strength * 0.8);
    }

    function drawBackground() {
      const { clientWidth: w, clientHeight: h } = canvas;
      const gradient = ctx.createLinearGradient(0, 0, 0, h);
      gradient.addColorStop(0, state.spot.stageTop);
      gradient.addColorStop(0.7, state.spot.stageBottom);
      gradient.addColorStop(1, "#010407");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);

      const glow = ctx.createRadialGradient(w * 0.5, h * 0.12, 10, w * 0.5, h * 0.12, Math.max(w, h) * 0.7);
      glow.addColorStop(0, "rgba(255,255,255,0.08)");
      glow.addColorStop(0.3, state.spot.glow);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
    }

    function drawCaustics() {
      const { clientWidth: w, clientHeight: h } = canvas;
      ctx.save();
      ctx.globalAlpha = 0.16 + state.pulse * 0.1;
      ctx.strokeStyle = "rgba(255,255,255,0.22)";
      for (let row = 0; row < 7; row += 1) {
        ctx.beginPath();
        const y = h * 0.16 + row * h * 0.11;
        for (let x = 0; x <= w; x += 32) {
          const wobble = Math.sin((x * 0.012) + state.time * 0.0018 + row) * 8
            + Math.cos((x * 0.008) + state.time * 0.0014 + row * 0.4) * 4;
          if (x === 0) ctx.moveTo(x, y + wobble);
          else ctx.lineTo(x, y + wobble);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawParticles() {
      const { clientWidth: w, clientHeight: h } = canvas;
      for (const particle of state.particles) {
        particle.x += particle.vx;
        particle.y += particle.vy + Math.sin(state.time * 0.001 + particle.phase) * 0.03;
        if (particle.x < -10) particle.x = w + 10;
        if (particle.x > w + 10) particle.x = -10;
        if (particle.y < -10) particle.y = h + 10;
        if (particle.y > h + 10) particle.y = -10;

        ctx.beginPath();
        ctx.fillStyle = `rgba(220, 248, 255, ${particle.alpha})`;
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function drawBubbles() {
      const { clientWidth: w, clientHeight: h } = canvas;
      ctx.save();
      ctx.strokeStyle = "rgba(220, 248, 255, 0.26)";
      for (const bubble of state.bubbles) {
        bubble.y -= bubble.speed;
        bubble.x += Math.sin(state.time * 0.001 + bubble.wobble) * 0.18;
        if (bubble.y < -bubble.size) {
          bubble.y = h + Math.random() * h * 0.3;
          bubble.x = Math.random() * w;
        }
        ctx.beginPath();
        ctx.globalAlpha = bubble.alpha;
        ctx.arc(bubble.x, bubble.y, bubble.size, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawFish() {
      const { clientWidth: w, clientHeight: h } = canvas;
      ctx.save();
      ctx.globalAlpha = 0.28 + state.pulse * 0.1;
      for (const fish of state.fish) {
        fish.x += fish.speed * fish.dir;
        fish.y += Math.sin(state.time * 0.0015 + fish.hue) * 0.08;
        if (fish.x < -fish.size * 2) fish.x = w + fish.size * 2;
        if (fish.x > w + fish.size * 2) fish.x = -fish.size * 2;

        ctx.fillStyle = "rgba(255,255,255,0.18)";
        ctx.beginPath();
        ctx.ellipse(fish.x, fish.y, fish.size * 0.8, fish.size * 0.34, fish.dir * 0.18, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(fish.x - fish.size * 0.8 * fish.dir, fish.y);
        ctx.lineTo(fish.x - fish.size * 1.3 * fish.dir, fish.y - fish.size * 0.18);
        ctx.lineTo(fish.x - fish.size * 1.3 * fish.dir, fish.y + fish.size * 0.18);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    function drawRodAndLine() {
      const { clientWidth: w, clientHeight: h } = canvas;
      const rodX = w * 0.17;
      const rodY = h * 0.12 + (state.rodPosition - 0.5) * h * 0.26;
      const tipX = w * 0.64;
      const tipY = h * 0.42 + (state.rodPosition - 0.5) * h * 0.24;
      const lureX = w * 0.55 + Math.sin(state.time * 0.0022) * 10;
      const lureY = h * 0.64 + Math.cos(state.time * 0.002) * 8 + (state.rodPosition - 0.5) * h * 0.08;

      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "rgba(228, 253, 218, 0.95)";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(rodX, rodY);
      ctx.quadraticCurveTo(w * 0.42, h * 0.04, tipX, tipY);
      ctx.stroke();

      ctx.strokeStyle = "rgba(100, 200, 82, 0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(lureX, lureY);
      ctx.stroke();

      ctx.fillStyle = "rgba(255, 214, 124, 0.98)";
      ctx.beginPath();
      ctx.arc(rodX, rodY, 11, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(255, 179, 67, 0.98)";
      ctx.beginPath();
      ctx.arc(lureX, lureY, 6.5 + state.pulse * 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    function drawRipple() {
      if (state.ripple <= 0.01) return;
      const { clientWidth: w, clientHeight: h } = canvas;
      ctx.save();
      ctx.globalAlpha = state.ripple * 0.5;
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(w * 0.5, h * 0.78, 30 + state.ripple * 120, 8 + state.ripple * 28, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    function drawFog() {
      const { clientWidth: w, clientHeight: h } = canvas;
      const fog = ctx.createLinearGradient(0, h * 0.55, 0, h);
      fog.addColorStop(0, "rgba(255,255,255,0)");
      fog.addColorStop(1, "rgba(255,255,255,0.06)");
      ctx.fillStyle = fog;
      ctx.fillRect(0, 0, w, h);
    }

    function frame(now) {
      if (!state.running) return;
      state.time = now;
      state.pulse *= 0.94;
      state.ripple *= 0.92;

      drawBackground();
      drawCaustics();
      drawParticles();
      drawFish();
      drawRodAndLine();
      drawRipple();
      drawBubbles();
      drawFog();

      requestAnimationFrame(frame);
    }

    function start() {
      if (state.running) return;
      state.running = true;
      requestAnimationFrame(frame);
    }

    seedEntities();
    resize();
    window.addEventListener("resize", resize);

    return {
      start,
      resize,
      setSpot,
      setRodPosition,
      pulse,
      getState: () => state,
    };
  }

  global.CardQuest = global.CardQuest || {};
  global.CardQuest.oceanScene = { createOceanScene };
})(window);
