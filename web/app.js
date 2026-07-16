const stateKey = "cardquest:web-state:v2";

const spots = [
  {
    id: "pond",
    name: "ため池",
    tint: "rgba(120, 228, 255, 0.16)",
    stageTop: "rgba(85, 196, 228, 0.26)",
    stageBottom: "rgba(12, 38, 60, 0.96)",
    glow: "rgba(129, 237, 255, 0.2)",
    mood: "静かな水面",
    targetBoost: 0,
  },
  {
    id: "river",
    name: "川",
    tint: "rgba(93, 190, 255, 0.2)",
    stageTop: "rgba(83, 186, 255, 0.3)",
    stageBottom: "rgba(9, 32, 56, 0.97)",
    glow: "rgba(110, 210, 255, 0.22)",
    mood: "ゆるやかな流れ",
    targetBoost: 1,
  },
  {
    id: "sea",
    name: "海",
    tint: "rgba(58, 150, 255, 0.24)",
    stageTop: "rgba(53, 150, 255, 0.32)",
    stageBottom: "rgba(5, 21, 42, 0.98)",
    glow: "rgba(87, 170, 255, 0.28)",
    mood: "深い海の気配",
    targetBoost: 2,
  },
];

const fish = [
  { id: 0, name: "Minnow", rarity: "common" },
  { id: 1, name: "Carp", rarity: "common" },
  { id: 2, name: "Trout", rarity: "rare" },
  { id: 3, name: "King Salmon", rarity: "epic" },
];

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
  rodSystem: document.getElementById("rodSystem"),
  spotLabel: document.getElementById("spotLabel"),
  bubbles: document.getElementById("bubbles"),
};

let deferredInstallPrompt = null;
let stream = null;
let monitorTimer = null;
let motionFrame = null;
let motionPermissionAsked = false;
let orientationActive = false;

let currentSpot = spots[0];
let rodTarget = 0.5;
let rodPosition = 0.5;
let bubbleSeed = 0;

let gameState = {
  active: false,
  spotId: null,
  targetHits: 0,
  hits: 0,
  blueScore: 0,
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function loadState() {
  const raw = localStorage.getItem(stateKey);
  if (!raw) {
    return { catches: [] };
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return { catches: [] };
    }
    return {
      catches: Array.isArray(parsed.catches) ? parsed.catches : [],
    };
  } catch {
    return { catches: [] };
  }
}

function saveState(state) {
  localStorage.setItem(stateKey, JSON.stringify(state));
}

function getCurrentState() {
  return loadState();
}

function resetState() {
  saveState({ catches: [] });
  renderCollection();
  resetGame();
}

function renderCollection() {
  const state = getCurrentState();
  const catches = state.catches ?? [];
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
      const spot = spots.find((item) => item.id === row.spotId);
      const caughtFish = fish.find((item) => item.id === row.fishId);
      return `
        <div class="card">
          <strong>${escapeHtml(spot?.name ?? row.spotId)}</strong>
          で
          <strong>${escapeHtml(caughtFish?.name ?? `Fish ${row.fishId}`)}</strong>
          を釣った
          <div>${new Date(row.caughtAt).toLocaleString("ja-JP")}</div>
        </div>
      `;
    })
    .join("");
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function startCamera() {
  if (stream) {
    return;
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
      },
      audio: false,
    });

    els.cameraVideo.srcObject = stream;
    await els.cameraVideo.play().catch(() => {});
    els.cameraStatus.textContent = "カメラ起動中";
    els.cameraStatus.style.color = "var(--accent-2)";
    startMonitoring();
    startMotionTracking();
  } catch (error) {
    els.cameraStatus.textContent = "カメラを使えません";
    els.cameraStatus.style.color = "var(--danger)";
    console.error(error);
  }
}

function stopMonitoring() {
  if (monitorTimer !== null) {
    window.clearInterval(monitorTimer);
    monitorTimer = null;
  }
}

function startMonitoring() {
  if (monitorTimer !== null) {
    return;
  }

  monitorTimer = window.setInterval(() => {
    analyzeCameraFrame(true);
  }, 550);
}

function captureFrame() {
  const video = els.cameraVideo;
  if (!video.videoWidth || !video.videoHeight) {
    return null;
  }

  const canvas = els.scanCanvas;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(video, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function detectBluePresence(imageData) {
  if (!imageData) {
    return null;
  }

  const { data, width, height } = imageData;
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);
  const sampleHalf = Math.max(36, Math.floor(Math.min(width, height) * 0.2));
  let bluePixels = 0;
  let totalPixels = 0;
  let blueScoreSum = 0;

  for (let y = centerY - sampleHalf; y <= centerY + sampleHalf; y += 4) {
    if (y < 0 || y >= height) {
      continue;
    }

    for (let x = centerX - sampleHalf; x <= centerX + sampleHalf; x += 4) {
      if (x < 0 || x >= width) {
        continue;
      }

      const index = (y * width + x) * 4;
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];
      const blueScore = blue - Math.max(red, green);

      totalPixels += 1;
      blueScoreSum += blueScore;
      if (blue > 110 && blueScore > 35) {
        bluePixels += 1;
      }
    }
  }

  if (!totalPixels) {
    return null;
  }

  const blueRatio = bluePixels / totalPixels;
  const averageBlueScore = blueScoreSum / totalPixels;

  if (blueRatio < 0.12 || averageBlueScore < 18) {
    return null;
  }

  const intensity = clamp(blueRatio * 5, 0, 1);

  return {
    blueRatio,
    averageBlueScore,
    intensity,
  };
}

function pickSpot(bluePresence) {
  const index = clamp(Math.floor(bluePresence.intensity * spots.length), 0, spots.length - 1);
  return spots[index];
}

function updateStageAppearance(spot) {
  currentSpot = spot;
  els.fishingStage.style.setProperty("--spot-color", spot.tint);
  els.fishingStage.style.setProperty("--stage-top", spot.stageTop);
  els.fishingStage.style.setProperty("--stage-bottom", spot.stageBottom);
  els.fishingStage.style.setProperty("--water-glow", spot.glow);
  els.spotLabel.textContent = `釣り場: ${spot.name}`;
  els.gameStatus.textContent = gameState.active ? `釣り中 - ${spot.mood}` : `準備中 - ${spot.mood}`;
  if (els.fishingStage) {
    els.fishingStage.dataset.spot = spot.id;
  }
}

function beginFishing(spot, bluePresence) {
  gameState.active = true;
  gameState.spotId = spot.id;
  gameState.targetHits = 2 + spot.targetBoost + Math.floor(Math.random() * 3);
  gameState.hits = 0;
  gameState.blueScore = bluePresence?.averageBlueScore ?? 0;
  els.reelBtn.disabled = false;
  els.gamePrompt.textContent = `${spot.name} に移動した。竿を上下して、静かにタイミングを合わせよう。`;
  els.motionHint.textContent = `竿の位置: ${Math.round(rodPosition * 100)}%`;
  updateStageAppearance(spot);
  updateMeter();
}

function shiftFishingSpot(spot, bluePresence) {
  if (gameState.spotId === spot.id) {
    updateStageAppearance(spot);
    return;
  }

  gameState.spotId = spot.id;
  gameState.blueScore = bluePresence?.averageBlueScore ?? 0;
  updateStageAppearance(spot);
  els.gamePrompt.textContent = `${spot.name} に水の色が変わった。`;
}

function resetGame() {
  gameState = {
    active: false,
    spotId: null,
    targetHits: 0,
    hits: 0,
    blueScore: 0,
  };
  els.reelBtn.disabled = true;
  els.gameStatus.textContent = "待機中";
  els.gamePrompt.textContent = "青いものを映すと、やさしく釣り場が切り替わります。";
  els.motionHint.textContent = "竿の位置: 50%";
  updateStageAppearance(currentSpot);
  updateMeter();
}

function chooseFishForSpot(spot) {
  const weighted = [];

  for (const item of fish) {
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
  const state = getCurrentState();
  state.catches = [
    ...(state.catches ?? []),
    {
      spotId: spot.id,
      fishId: caughtFish.id,
      caughtAt: new Date().toISOString(),
    },
  ];
  saveState(state);
}

function reel() {
  if (!gameState.active) {
    return;
  }

  const spot = currentSpot;
  const alignment = 1 - Math.min(1, Math.abs(rodPosition - 0.5) * 2);
  const successChance = clamp(0.48 + alignment * 0.42 + spot.targetBoost * 0.05, 0.2, 0.95);
  const success = Math.random() < successChance;

  if (success) {
    gameState.hits += 1;
    els.gamePrompt.textContent = "ふわっと手応えが来た。";
  } else {
    els.gamePrompt.textContent = "少しだけ波に乗れなかった。";
  }

  updateMeter();

  if (gameState.hits >= gameState.targetHits) {
    const caughtFish = chooseFishForSpot(spot);
    saveCatch(spot, caughtFish);
    renderCollection();
    els.gamePrompt.textContent = `${spot.name} で ${caughtFish.name} をやさしく釣り上げた。`;
    gameState.active = false;
    els.reelBtn.disabled = true;
  }
}

function skipFishing() {
  resetGame();
}

function updateMeter() {
  const percent = gameState.active && gameState.targetHits > 0
    ? Math.min(100, (gameState.hits / gameState.targetHits) * 100)
    : 0;
  els.meterFill.style.width = `${percent}%`;
}

function setRodTarget(value) {
  rodTarget = clamp(value, 0, 1);
  els.motionHint.textContent = `竿の位置: ${Math.round(rodTarget * 100)}%`;
}

function updateRodVisual() {
  rodPosition += (rodTarget - rodPosition) * 0.12;
  const offset = (rodPosition - 0.5) * 42;
  els.rodSystem.style.setProperty("--rod-offset", `${offset}%`);
  els.rodSystem.style.setProperty("transform", `translateY(${offset}%) rotate(${(rodPosition - 0.5) * 10}deg)`);
  if (gameState.active) {
    els.motionHint.textContent = `竿の位置: ${Math.round(rodPosition * 100)}%`;
  }
}

function animateRod() {
  updateRodVisual();
  motionFrame = window.requestAnimationFrame(animateRod);
}

function handleDeviceOrientation(event) {
  if (typeof event.beta !== "number") {
    return;
  }

  orientationActive = true;
  const normalized = clamp((event.beta + 45) / 90, 0, 1);
  setRodTarget(normalized);
}

async function startMotionTracking() {
  if (motionPermissionAsked) {
    return;
  }
  motionPermissionAsked = true;

  if (!("DeviceOrientationEvent" in window)) {
    els.motionHint.textContent = "端末の傾きが使えません。画面を上下にドラッグしてください。";
    addPointerMotionFallback();
    return;
  }

  if (typeof DeviceOrientationEvent.requestPermission === "function") {
    try {
      const permission = await DeviceOrientationEvent.requestPermission();
      if (permission !== "granted") {
        els.motionHint.textContent = "傾きの権限が必要です。画面を上下にドラッグしてください。";
        addPointerMotionFallback();
        return;
      }
    } catch {
      els.motionHint.textContent = "傾きの権限が使えません。画面を上下にドラッグしてください。";
      addPointerMotionFallback();
      return;
    }
  }

  window.addEventListener("deviceorientation", handleDeviceOrientation, true);
}

function addPointerMotionFallback() {
  if (!els.fishingStage) {
    return;
  }

  const updateFromPointer = (event) => {
    const rect = els.fishingStage.getBoundingClientRect();
    const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    setRodTarget(y);
  };

  els.fishingStage.addEventListener("pointerdown", (event) => {
    els.fishingStage.setPointerCapture(event.pointerId);
    updateFromPointer(event);
  });
  els.fishingStage.addEventListener("pointermove", (event) => {
    if (event.buttons) {
      updateFromPointer(event);
    }
  });
}

function analyzeCameraFrame(allowAutoStart) {
  const imageData = captureFrame();
  const bluePresence = detectBluePresence(imageData);

  if (!bluePresence) {
    if (allowAutoStart) {
      els.cameraStatus.textContent = "青いものを探しています";
      els.cameraStatus.style.color = "var(--muted)";
    }
    return;
  }

  const spot = pickSpot(bluePresence);
  if (!gameState.active && allowAutoStart) {
    beginFishing(spot, bluePresence);
  } else if (gameState.active) {
    shiftFishingSpot(spot, bluePresence);
  } else {
    updateStageAppearance(spot);
  }

  els.cameraStatus.textContent = `青色を検出: ${spot.name}`;
  els.cameraStatus.style.color = "var(--accent-2)";
}

function scanNow() {
  const imageData = captureFrame();
  const bluePresence = detectBluePresence(imageData);

  if (!bluePresence) {
    els.cameraStatus.textContent = "青いものが見つかりませんでした";
    els.cameraStatus.style.color = "var(--danger)";
    return;
  }

  const spot = pickSpot(bluePresence);
  if (!gameState.active) {
    beginFishing(spot, bluePresence);
  } else {
    shiftFishingSpot(spot, bluePresence);
  }
  els.cameraStatus.textContent = `青色を検出: ${spot.name}`;
  els.cameraStatus.style.color = "var(--accent-2)";
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  navigator.serviceWorker.register("./sw.js").catch((error) => {
    console.warn("Service worker registration failed", error);
  });
}

function handleBeforeInstallPrompt(event) {
  event.preventDefault();
  deferredInstallPrompt = event;
  els.installBanner.classList.remove("hidden");
}

async function installApp() {
  if (!deferredInstallPrompt) {
    return;
  }

  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  els.installBanner.classList.add("hidden");
}

function bindEvents() {
  els.enableCameraBtn.addEventListener("click", startCamera);
  els.scanBtn.addEventListener("click", scanNow);
  els.resetBtn.addEventListener("click", resetState);
  els.reelBtn.addEventListener("click", reel);
  els.skipBtn.addEventListener("click", skipFishing);
  els.installBtn.addEventListener("click", installApp);
  window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
}

function bootstrap() {
  bindEvents();
  registerServiceWorker();
  renderCollection();
  updateStageAppearance(currentSpot);
  updateMeter();
  createBubbles();
  animateRod();
  els.cameraStatus.textContent = "未起動";
  els.motionHint.textContent = "竿の位置: 50%";
}

function createBubbles() {
  if (!els.bubbles) {
    return;
  }

  els.bubbles.innerHTML = "";
  const count = 18;

  for (let index = 0; index < count; index += 1) {
    const bubble = document.createElement("span");
    bubble.className = "bubble";

    const size = 6 + Math.random() * 20;
    const left = Math.random() * 100;
    const delay = Math.random() * -18;
    const duration = 12 + Math.random() * 18;
    const opacity = 0.25 + Math.random() * 0.35;

    bubble.style.width = `${size}px`;
    bubble.style.height = `${size}px`;
    bubble.style.left = `${left}%`;
    bubble.style.animationDuration = `${duration}s`;
    bubble.style.animationDelay = `${delay}s`;
    bubble.style.opacity = opacity.toFixed(2);
    bubble.style.setProperty("--bubble-seed", `${bubbleSeed++}`);

    els.bubbles.appendChild(bubble);
  }
}

bootstrap();
