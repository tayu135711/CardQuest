(function (global) {
  const { data, storage, blueDetector, oceanScene, audio, motion } = global.CardQuest;

  const els = {
    enableCameraBtn: document.getElementById("enableCameraBtn"),
    scanBtn: document.getElementById("scanBtn"),
    resetBtn: document.getElementById("resetBtn"),
    installBanner: document.getElementById("installBanner"),
    installBtn: document.getElementById("installBtn"),
    cameraVideo: document.getElementById("cameraVideo"),
    scanCanvas: document.getElementById("scanCanvas"),
    cameraStatus: document.getElementById("cameraStatus"),
    gameStatus: document.getElementById("gameStatus"),
    gamePrompt: document.getElementById("gamePrompt"),
    motionHint: document.getElementById("motionHint"),
    meterFill: document.getElementById("meterFill"),
    reelBtn: document.getElementById("reelBtn"),
    skipBtn: document.getElementById("skipBtn"),
    collectionSummary: document.getElementById("collectionSummary"),
    collectionList: document.getElementById("collectionList"),
    fishingStage: document.getElementById("fishingStage"),
    oceanCanvas: document.getElementById("oceanCanvas"),
    spotLabel: document.getElementById("spotLabel"),
  };

  const state = {
    stream: null,
    monitorTimer: null,
    deferredInstallPrompt: null,
    currentSpot: data.spots[0],
    rodTarget: 0.5,
    rodPosition: 0.5,
    game: { active: false, spotId: null, targetHits: 0, hits: 0 },
  };

  const ocean = oceanScene.createOceanScene(els.oceanCanvas, { defaultSpot: state.currentSpot });
  const ambient = audio.createOceanAudio();
  const motionController = motion.createMotionController({
    onChange(value) {
      state.rodTarget = value;
      els.motionHint.textContent = `竿の位置: ${Math.round(value * 100)}%`;
    },
    onFallbackMessage(message) {
      els.motionHint.textContent = message;
    },
  });

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function escapeHtml(text) {
    return String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function renderCollection() {
    const saved = storage.loadState();
    const catches = saved.catches ?? [];
    const uniqueSpots = new Set(catches.map((row) => row.spotId));
    const uniqueFish = new Set(catches.map((row) => row.fishId));

    els.collectionSummary.textContent = `${uniqueSpots.size}釣り場 / ${uniqueFish.size}魚`;

    if (catches.length === 0) {
      els.collectionList.innerHTML = '<div class="card">まだ何も釣れていません。</div>';
      return;
    }

    els.collectionList.innerHTML = catches
      .slice()
      .reverse()
      .slice(0, 20)
      .map((row) => {
        const spot = data.spots.find((item) => item.id === row.spotId);
        const caughtFish = data.fish.find((item) => item.id === row.fishId);
        return `
          <div class="card">
            <strong>${escapeHtml(spot?.name ?? row.spotId)}</strong> で
            <strong>${escapeHtml(caughtFish?.name ?? `Fish ${row.fishId}`)}</strong>
            を釣った
            <div>${new Date(row.caughtAt).toLocaleString("ja-JP")}</div>
          </div>
        `;
      })
      .join("");
  }

  function updateStageAppearance(spot) {
    state.currentSpot = spot;
    els.fishingStage.style.setProperty("--spot-color", spot.tint);
    els.fishingStage.style.setProperty("--stage-top", spot.stageTop);
    els.fishingStage.style.setProperty("--stage-bottom", spot.stageBottom);
    els.fishingStage.style.setProperty("--water-glow", spot.glow);
    els.spotLabel.textContent = `釣り場: ${spot.name}`;
    els.gameStatus.textContent = state.game.active ? `釣り中 - ${spot.mood}` : `待機中 - ${spot.mood}`;
    ocean.setSpot(spot);
    ambient.setSpot(spot);
  }

  function syncRod() {
    state.rodPosition += (state.rodTarget - state.rodPosition) * 0.12;
    ocean.setRodPosition(state.rodPosition);
    const offset = (state.rodPosition - 0.5) * 42;
    els.motionHint.textContent = `竿の位置: ${Math.round(state.rodPosition * 100)}%`;
    els.fishingStage.style.setProperty("--rod-offset", `${offset}%`);
  }

  function pulseScene(strength = 1) {
    ocean.pulse(strength);
    ambient.pulse(strength);
  }

  function updateMeter() {
    const percent = state.game.active && state.game.targetHits > 0
      ? Math.min(100, (state.game.hits / state.game.targetHits) * 100)
      : 0;
    els.meterFill.style.width = `${percent}%`;
  }

  function beginFishing(spot, bluePresence) {
    state.game.active = true;
    state.game.spotId = spot.id;
    state.game.targetHits = 2 + spot.targetBoost + Math.floor(Math.random() * 3);
    state.game.hits = 0;

    els.reelBtn.disabled = false;
    els.gamePrompt.textContent = `${spot.name} に移動した。竿を上下して、静かにタイミングを合わせよう。`;
    els.motionHint.textContent = `竿の位置: ${Math.round(state.rodPosition * 100)}%`;
    updateStageAppearance(spot);
    pulseScene(0.8 + spot.targetBoost * 0.2);
    updateMeter();
  }

  function shiftFishingSpot(spot) {
    if (state.game.spotId === spot.id) {
      updateStageAppearance(spot);
      return;
    }
    state.game.spotId = spot.id;
    updateStageAppearance(spot);
    els.gamePrompt.textContent = `${spot.name} に水の色が変わった。`;
    pulseScene(0.5);
  }

  function resetGame() {
    state.game = { active: false, spotId: null, targetHits: 0, hits: 0 };
    els.reelBtn.disabled = true;
    els.gameStatus.textContent = "待機中";
    els.gamePrompt.textContent = "青いものを映すと、やさしく釣り場が切り替わります。";
    els.motionHint.textContent = "竿の位置: 50%";
    updateStageAppearance(state.currentSpot);
    pulseScene(0.3);
    updateMeter();
  }

  function chooseFishForSpot(spot) {
    const weighted = [];
    for (const item of data.fish) {
      let weight = 1;
      if (spot.id === "pond") {
        weight = item.rarity === "common" ? 60 : item.rarity === "rare" ? 24 : 8;
      } else if (spot.id === "river") {
        weight = item.rarity === "common" ? 38 : item.rarity === "rare" ? 42 : 12;
      } else {
        weight = item.rarity === "common" ? 20 : item.rarity === "rare" ? 40 : 24;
      }
      for (let index = 0; index < weight; index += 1) {
        weighted.push(item);
      }
    }
    return weighted[Math.floor(Math.random() * weighted.length)];
  }

  function saveCatch(spot, caughtFish) {
    storage.appendCatch({
      spotId: spot.id,
      fishId: caughtFish.id,
      caughtAt: new Date().toISOString(),
    });
  }

  function reel() {
    if (!state.game.active) return;

    const spot = state.currentSpot;
    const alignment = 1 - Math.min(1, Math.abs(state.rodPosition - 0.5) * 2);
    const successChance = clamp(0.48 + alignment * 0.42 + spot.targetBoost * 0.05, 0.2, 0.95);
    const success = Math.random() < successChance;

    if (success) {
      state.game.hits += 1;
      els.gamePrompt.textContent = "ふわっと手応えが来た。";
      pulseScene(0.25);
    } else {
      els.gamePrompt.textContent = "少しだけ波に乗れなかった。";
    }

    updateMeter();

    if (state.game.hits >= state.game.targetHits) {
      const caughtFish = chooseFishForSpot(spot);
      saveCatch(spot, caughtFish);
      renderCollection();
      els.gamePrompt.textContent = `${spot.name} で ${caughtFish.name} をやさしく釣り上げた。`;
      pulseScene(1.15);
      state.game.active = false;
      els.reelBtn.disabled = true;
    }
  }

  function captureFrame() {
    const video = els.cameraVideo;
    if (!video.videoWidth || !video.videoHeight) return null;
    const canvas = els.scanCanvas;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(video, 0, 0);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  function analyzeCameraFrame(autoStart) {
    const imageData = captureFrame();
    const bluePresence = blueDetector.detectBluePresence(imageData);
    if (!bluePresence) {
      if (autoStart) {
        els.cameraStatus.textContent = "青いものを探しています";
        els.cameraStatus.style.color = "var(--muted)";
      }
      return;
    }

    const spot = blueDetector.pickSpot(bluePresence, data.spots);
    if (!state.game.active && autoStart) {
      beginFishing(spot, bluePresence);
    } else if (state.game.active) {
      shiftFishingSpot(spot);
    } else {
      updateStageAppearance(spot);
    }

    els.cameraStatus.textContent = `青色を検出: ${spot.name}`;
    els.cameraStatus.style.color = "var(--accent-strong)";
  }

  async function startCamera() {
    if (state.stream) return;
    try {
      state.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      els.cameraVideo.srcObject = state.stream;
      await els.cameraVideo.play().catch(() => {});
      els.cameraStatus.textContent = "カメラ起動中";
      els.cameraStatus.style.color = "var(--accent-strong)";
      ambient.start();
      ocean.start();
      startMonitoring();
      await motionController.start(els.fishingStage);
    } catch (error) {
      els.cameraStatus.textContent = "カメラを使えません";
      els.cameraStatus.style.color = "#ff8e97";
      console.error(error);
    }
  }

  function startMonitoring() {
    if (state.monitorTimer !== null) return;
    state.monitorTimer = window.setInterval(() => {
      analyzeCameraFrame(true);
    }, 450);
  }

  function stopMonitoring() {
    if (state.monitorTimer !== null) {
      window.clearInterval(state.monitorTimer);
      state.monitorTimer = null;
    }
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.warn("Service worker registration failed", error);
    });
  }

  function handleBeforeInstallPrompt(event) {
    event.preventDefault();
    state.deferredInstallPrompt = event;
    els.installBanner.classList.remove("hidden");
  }

  async function installApp() {
    if (!state.deferredInstallPrompt) return;
    state.deferredInstallPrompt.prompt();
    await state.deferredInstallPrompt.userChoice;
    state.deferredInstallPrompt = null;
    els.installBanner.classList.add("hidden");
  }

  function createBubbles() {
    const bubbleContainer = document.getElementById("bubbles");
    if (!bubbleContainer) return;
    bubbleContainer.innerHTML = "";
    for (let index = 0; index < 18; index += 1) {
      const bubble = document.createElement("span");
      bubble.className = "bubble";
      const size = 6 + Math.random() * 20;
      bubble.style.width = `${size}px`;
      bubble.style.height = `${size}px`;
      bubble.style.left = `${Math.random() * 100}%`;
      bubble.style.animationDuration = `${12 + Math.random() * 18}s`;
      bubble.style.animationDelay = `${Math.random() * -18}s`;
      bubble.style.opacity = (0.25 + Math.random() * 0.35).toFixed(2);
      bubbleContainer.appendChild(bubble);
    }
  }

  function bindEvents() {
    els.enableCameraBtn.addEventListener("click", startCamera);
    els.scanBtn.addEventListener("click", () => analyzeCameraFrame(false));
    els.resetBtn.addEventListener("click", () => {
      storage.clearState();
      renderCollection();
      resetGame();
    });
    els.reelBtn.addEventListener("click", reel);
    els.skipBtn.addEventListener("click", resetGame);
    els.installBtn.addEventListener("click", installApp);
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }

  function bootstrap() {
    bindEvents();
    registerServiceWorker();
    renderCollection();
    createBubbles();
    updateStageAppearance(state.currentSpot);
    updateMeter();
    requestAnimationFrame(function tick() {
      syncRod();
      requestAnimationFrame(tick);
    });
    els.cameraStatus.textContent = "未起動";
    els.motionHint.textContent = "竿の位置: 50%";
  }

  bootstrap();
})(window);
