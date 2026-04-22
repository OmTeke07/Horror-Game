const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const startButton = document.getElementById("startButton");
const overlayMessage = document.getElementById("overlayMessage");
const sanityBar = document.getElementById("sanityBar");
const batteryBar = document.getElementById("batteryBar");
const sanityValue = document.getElementById("sanityValue");
const batteryValue = document.getElementById("batteryValue");
const shardValue = document.getElementById("shardValue");
const noiseValue = document.getElementById("noiseValue");
const aiMoodValue = document.getElementById("aiMoodValue");
const statusValue = document.getElementById("statusValue");
const eventLog = document.getElementById("eventLog");
const threatValue = document.getElementById("threatValue");
const echoValue = document.getElementById("echoValue");
const objectiveText = document.getElementById("objectiveText");
const threatFeed = document.getElementById("threatFeed");
const briefText = document.getElementById("briefText");

const WORLD = {
  width: 960,
  height: 560,
};

const walls = [
  { x: 110, y: 70, w: 30, h: 310 },
  { x: 280, y: 0, w: 30, h: 190 },
  { x: 280, y: 255, w: 30, h: 285 },
  { x: 470, y: 70, w: 30, h: 390 },
  { x: 670, y: 0, w: 30, h: 240 },
  { x: 670, y: 310, w: 30, h: 230 },
  { x: 140, y: 350, w: 220, h: 24 },
  { x: 520, y: 220, w: 250, h: 24 },
  { x: 730, y: 100, w: 140, h: 24 },
];

const hidingSpots = [
  { x: 60, y: 420, w: 36, h: 60 },
  { x: 370, y: 38, w: 36, h: 60 },
  { x: 565, y: 445, w: 36, h: 60 },
  { x: 855, y: 350, w: 36, h: 60 },
];

const shardSpawns = [
  { x: 205, y: 128 },
  { x: 390, y: 480 },
  { x: 615, y: 95 },
  { x: 790, y: 250 },
  { x: 885, y: 470 },
];

const exitDoor = { x: 905, y: 20, w: 28, h: 80 };

const state = {
  running: false,
  gameOver: false,
  win: false,
  lastTime: 0,
  animationFrameId: null,
  keys: new Set(),
  player: null,
  enemy: null,
  shards: [],
  audioContext: null,
  logEntries: [],
  threatEntries: [],
  screenPulse: 0,
  ambientPhase: 0,
  decoy: null,
};

function resetState() {
  state.running = true;
  state.gameOver = false;
  state.win = false;
  state.lastTime = 0;
  state.keys.clear();
  state.player = {
    x: 42,
    y: 50,
    radius: 14,
    speed: 170,
    sanity: 100,
    battery: 100,
    flashlightOn: true,
    shards: 0,
    hidden: false,
    interactionLock: false,
    noise: 0.2,
    velocityX: 0,
    velocityY: 0,
    facingX: 1,
    facingY: 0,
  };
  state.enemy = {
    x: 860,
    y: 470,
    radius: 17,
    speed: 64,
    detection: 120,
    mode: "studying",
    huntTimer: 0,
    repathTimer: 0,
    driftAngle: Math.random() * Math.PI * 2,
    aiProfile: {
      chaseBias: 0,
      stealthBias: 0,
      flashlightBias: 0,
    },
  };
  state.shards = pickShards(3).map((shard) => ({ ...shard, found: false, pulse: Math.random() * Math.PI * 2 }));
  state.logEntries = [];
  state.threatEntries = [];
  state.screenPulse = 0;
  state.ambientPhase = Math.random() * Math.PI * 2;
  state.decoy = null;
  updateOverlay("Containment breach reported.", "Collect the memory shards and escape.");
  logEvent("Facility AI online. Movement signatures are being analyzed.");
  pushThreat("Sentinel is dormant. Avoid teaching it a pattern.");
  briefText.textContent = "Sentinel AI has fused with a predatory signal. It mirrors careless movement and punishes routine.";
  updateHud();
}

function pickShards(count) {
  const shuffled = [...shardSpawns].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function logEvent(message) {
  state.logEntries.unshift(message);
  state.logEntries = state.logEntries.slice(0, 8);
  eventLog.innerHTML = state.logEntries.map((entry) => `<p>${entry}</p>`).join("");
}

function pushThreat(message) {
  state.threatEntries.unshift(message);
  state.threatEntries = state.threatEntries.slice(0, 4);
  threatFeed.innerHTML = state.threatEntries.map((entry) => `<p>${entry}</p>`).join("");
}

function updateOverlay(title, text, visible = true) {
  overlayMessage.innerHTML = `<h2>${title}</h2><p>${text}</p>`;
  overlayMessage.classList.toggle("visible", visible);
}

function updateHud() {
  sanityBar.style.width = `${state.player.sanity}%`;
  batteryBar.style.width = `${state.player.battery}%`;
  sanityValue.textContent = `${Math.max(0, Math.round(state.player.sanity))}%`;
  batteryValue.textContent = `${Math.max(0, Math.round(state.player.battery))}%`;
  shardValue.textContent = `${state.player.shards} / 3`;
  noiseValue.textContent =
    state.player.noise > 0.66 ? "High" : state.player.noise > 0.36 ? "Medium" : "Low";
  aiMoodValue.textContent = state.enemy.mode[0].toUpperCase() + state.enemy.mode.slice(1);
  statusValue.textContent = state.player.hidden ? "Hidden" : state.gameOver ? "Lost" : state.win ? "Escaped" : "Active";
  threatValue.textContent = describeThreat();
  echoValue.textContent = state.decoy ? "Active" : "None";

  if (state.player.shards === 0) {
    objectiveText.textContent = "Sweep the lower wings and recover the first shard without creating a pattern.";
  } else if (state.player.shards < 3) {
    objectiveText.textContent = `Recover ${3 - state.player.shards} more shard${state.player.shards === 2 ? "" : "s"} while the Sentinel tracks your habits.`;
  } else if (!state.win) {
    objectiveText.textContent = "All shards secured. Run to the northern airlock before the Sentinel closes in.";
  } else {
    objectiveText.textContent = "Escape complete. The facility sealed behind you.";
  }
}

function describeThreat() {
  const alertness = state.enemy.aiProfile.chaseBias * 0.9 + state.enemy.aiProfile.flashlightBias * 0.65 - state.enemy.aiProfile.stealthBias * 0.5;
  if (state.enemy.mode === "hunting") {
    return "Critical";
  }
  if (alertness > 1.15) {
    return "High";
  }
  if (alertness > 0.55) {
    return "Rising";
  }
  return "Dormant";
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function circleHitsRect(circle, rect) {
  const nearestX = clamp(circle.x, rect.x, rect.x + rect.w);
  const nearestY = clamp(circle.y, rect.y, rect.y + rect.h);
  const dx = circle.x - nearestX;
  const dy = circle.y - nearestY;
  return dx * dx + dy * dy < circle.radius * circle.radius;
}

function canMoveTo(entity, x, y) {
  const testCircle = { x, y, radius: entity.radius };
  if (x - entity.radius < 0 || x + entity.radius > WORLD.width || y - entity.radius < 0 || y + entity.radius > WORLD.height) {
    return false;
  }
  return !walls.some((wall) => circleHitsRect(testCircle, wall));
}

function nearestHidingSpot() {
  return hidingSpots.find((spot) => {
    const cx = spot.x + spot.w / 2;
    const cy = spot.y + spot.h / 2;
    return Math.hypot(state.player.x - cx, state.player.y - cy) < 46;
  });
}

function beginGame() {
  resetState();
  primeAudio();
  if (state.animationFrameId === null) {
    state.animationFrameId = requestAnimationFrame(loop);
  }
}

function primeAudio() {
  if (!state.audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      state.audioContext = new AudioContextClass();
    }
  }
  if (state.audioContext && state.audioContext.state === "suspended") {
    state.audioContext.resume();
  }
}

function playPulse(frequency, duration, volume, type = "sine") {
  if (!state.audioContext) {
    return;
  }
  const context = state.audioContext;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.value = volume;
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
  oscillator.stop(context.currentTime + duration);
}

function triggerScare() {
  playPulse(52, 0.45, 0.06, "sawtooth");
  setTimeout(() => playPulse(130, 0.18, 0.04, "triangle"), 120);
}

function handleMovement(dt) {
  const moveX = (state.keys.has("d") || state.keys.has("arrowright") ? 1 : 0) - (state.keys.has("a") || state.keys.has("arrowleft") ? 1 : 0);
  const moveY = (state.keys.has("s") || state.keys.has("arrowdown") ? 1 : 0) - (state.keys.has("w") || state.keys.has("arrowup") ? 1 : 0);
  const magnitude = Math.hypot(moveX, moveY) || 1;
  const vx = (moveX / magnitude) * state.player.speed * dt;
  const vy = (moveY / magnitude) * state.player.speed * dt;

  state.player.velocityX = vx;
  state.player.velocityY = vy;
  if (Math.abs(vx) > 0.001 || Math.abs(vy) > 0.001) {
    state.player.facingX = vx;
    state.player.facingY = vy;
  }
  state.player.noise = clamp(Math.hypot(vx, vy) / (state.player.speed * dt || 1), 0.16, 1);

  const hiddenPenalty = state.player.hidden ? 0.2 : 1;
  const newX = state.player.x + vx * hiddenPenalty;
  const newY = state.player.y + vy * hiddenPenalty;

  if (canMoveTo(state.player, newX, state.player.y)) {
    state.player.x = newX;
  }
  if (canMoveTo(state.player, state.player.x, newY)) {
    state.player.y = newY;
  }

  if (state.player.flashlightOn) {
    state.player.battery = Math.max(0, state.player.battery - dt * (state.player.hidden ? 2 : 4));
    if (state.player.battery <= 0) {
      state.player.flashlightOn = false;
      logEvent("Flashlight battery depleted. Darkness deepens.");
      playPulse(95, 0.22, 0.04);
    }
  } else {
    state.player.battery = Math.min(100, state.player.battery + dt * 1.5);
  }
}

function updateShards(dt) {
  state.shards.forEach((shard) => {
    shard.pulse += dt * 2.2;
    if (!shard.found && Math.hypot(state.player.x - shard.x, state.player.y - shard.y) < 22) {
      shard.found = true;
      state.player.shards += 1;
      state.player.sanity = clamp(state.player.sanity + 8, 0, 100);
      logEvent(`Memory shard secured. ${3 - state.player.shards} fragments remain.`);
      playPulse(420, 0.2, 0.03, "triangle");
      state.screenPulse = Math.min(1, state.screenPulse + 0.18);
      if (state.player.shards === 3) {
        logEvent("Exit unlocked. Reach the northern airlock.");
        pushThreat("Airlock has unlocked. Sentinel aggression spike detected.");
        briefText.textContent = "Escape route available. Sentinel is no longer studying. It is selecting a kill path.";
      }
    }
  });
}

function updateDecoy(dt) {
  if (!state.decoy && Math.random() < dt * 0.12 && state.running) {
    state.decoy = {
      x: 100 + Math.random() * 760,
      y: 80 + Math.random() * 380,
      life: 3.2,
      pulse: Math.random() * Math.PI * 2,
    };
    pushThreat("Phantom echo detected. Audio map corrupted.");
  }

  if (state.decoy) {
    state.decoy.life -= dt;
    state.decoy.pulse += dt * 5;
    if (state.decoy.life <= 0) {
      state.decoy = null;
    }
  }
}

function updateEnemy(dt) {
  const enemy = state.enemy;
  const player = state.player;
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const distance = Math.hypot(dx, dy);
  const noiseFactor = player.hidden ? 0.2 : player.noise;
  const lightFactor = player.flashlightOn ? 1 : 0.2;

  enemy.aiProfile.chaseBias = clamp(enemy.aiProfile.chaseBias + noiseFactor * dt * 0.9, 0, 1.4);
  enemy.aiProfile.stealthBias = clamp(enemy.aiProfile.stealthBias + (player.hidden ? 1 : 0) * dt * 0.7, 0, 1.1);
  enemy.aiProfile.flashlightBias = clamp(enemy.aiProfile.flashlightBias + lightFactor * dt * 0.55, 0, 1.2);

  const alertness = enemy.aiProfile.chaseBias * 0.9 + enemy.aiProfile.flashlightBias * 0.65 - enemy.aiProfile.stealthBias * 0.5;

  if (distance < enemy.detection + noiseFactor * 110 + lightFactor * 55 && !player.hidden) {
    enemy.mode = "hunting";
    enemy.huntTimer = 4.8 + alertness;
  } else if (enemy.huntTimer > 0) {
    enemy.mode = "hunting";
  } else if (alertness > 1.15) {
    enemy.mode = "stalking";
  } else {
    enemy.mode = "studying";
  }

  enemy.huntTimer = Math.max(0, enemy.huntTimer - dt);
  enemy.speed = enemy.mode === "hunting" ? 92 + alertness * 16 : enemy.mode === "stalking" ? 74 : 58;
  enemy.detection = 108 + alertness * 16;

  if (state.decoy && enemy.mode !== "hunting") {
    const decoyDistance = Math.hypot(state.decoy.x - enemy.x, state.decoy.y - enemy.y);
    if (decoyDistance < 180) {
      pushThreat("Sentinel is sampling a phantom echo.");
    }
  }

  let targetX = enemy.x;
  let targetY = enemy.y;

  if (enemy.mode === "hunting") {
    targetX = player.x;
    targetY = player.y;
  } else if (enemy.mode === "stalking") {
    targetX = player.x - Math.cos(performance.now() / 700) * 50;
    targetY = player.y - Math.sin(performance.now() / 850) * 50;
  } else if (state.decoy) {
    targetX = state.decoy.x;
    targetY = state.decoy.y;
  } else {
    enemy.driftAngle += dt * 0.7;
    targetX = 480 + Math.cos(enemy.driftAngle) * 260;
    targetY = 260 + Math.sin(enemy.driftAngle * 1.4) * 170;
  }

  const tx = targetX - enemy.x;
  const ty = targetY - enemy.y;
  const len = Math.hypot(tx, ty) || 1;
  const stepX = (tx / len) * enemy.speed * dt;
  const stepY = (ty / len) * enemy.speed * dt;

  if (canMoveTo(enemy, enemy.x + stepX, enemy.y)) {
    enemy.x += stepX;
  } else {
    enemy.driftAngle += Math.PI / 2;
  }
  if (canMoveTo(enemy, enemy.x, enemy.y + stepY)) {
    enemy.y += stepY;
  }

  const dangerRadius = player.hidden ? 20 : enemy.radius + player.radius + 4;
  if (distance < dangerRadius) {
    loseGame("The entity learned your route.", "It reached you before the airlock opened.");
  }

  if (distance < 160) {
    state.player.sanity = clamp(state.player.sanity - dt * (enemy.mode === "hunting" ? 9 : 4), 0, 100);
    state.screenPulse = Math.min(1, state.screenPulse + dt * 0.9);
  } else if (state.player.hidden) {
    state.player.sanity = clamp(state.player.sanity + dt * 5, 0, 100);
  }

  if (distance < 150 && Math.random() < dt * 0.8) {
    triggerScare();
  }

  if (enemy.mode === "hunting" && Math.random() < dt * 0.7) {
    briefText.textContent = "Sentinel has switched to active pursuit. Break line of sight or hide.";
  } else if (enemy.mode === "stalking" && Math.random() < dt * 0.4) {
    briefText.textContent = "Sentinel is circling. It has not committed, but it has recognized your behavior.";
  }
}

function checkInteractions() {
  if (state.player.sanity <= 0) {
    loseGame("Your mind fractured.", "The facility became louder than reality.");
  }

  if (state.player.shards === 3 && rectsOverlap(
    { x: state.player.x - state.player.radius, y: state.player.y - state.player.radius, w: state.player.radius * 2, h: state.player.radius * 2 },
    exitDoor
  )) {
    state.running = false;
    state.win = true;
    updateOverlay("You Escaped", "The adaptive presence remains inside, still learning.", true);
    logEvent("Airlock sealed. Survived with all memory shards.");
    pushThreat("Exterior quarantine active. Sentinel contained.");
    playPulse(240, 0.5, 0.05, "triangle");
  }
}

function loseGame(title, subtitle) {
  if (state.gameOver || state.win) {
    return;
  }
  state.running = false;
  state.gameOver = true;
  updateOverlay(title, `${subtitle} Press "Enter The Facility" to try again.`, true);
  logEvent("Containment failure. Subject lost.");
  pushThreat("Fatal encounter recorded. Sentinel adaptation complete.");
  triggerScare();
}

function drawEnvironment() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  state.ambientPhase += 0.01;
  const pulse = (Math.sin(state.ambientPhase) + 1) * 0.5;

  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#0b1118");
  gradient.addColorStop(1, "#020306");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const glow = ctx.createRadialGradient(760, 120, 10, 760, 120, 300);
  glow.addColorStop(0, `rgba(255, 107, 125, ${0.06 + pulse * 0.08})`);
  glow.addColorStop(1, "rgba(255, 107, 125, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawGrid();

  ctx.fillStyle = "#15202f";
  walls.forEach((wall) => {
    ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
    ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
    ctx.fillRect(wall.x, wall.y, wall.w, 3);
    ctx.fillStyle = "#15202f";
  });

  hidingSpots.forEach((spot) => {
    ctx.fillStyle = "#2d4252";
    ctx.fillRect(spot.x, spot.y, spot.w, spot.h);
    ctx.fillStyle = "rgba(141, 215, 255, 0.16)";
    ctx.fillRect(spot.x + 6, spot.y + 10, spot.w - 12, 10);
  });

  ctx.fillStyle = state.player.shards === 3 ? "#86f1b0" : "#6c92bf";
  ctx.fillRect(exitDoor.x, exitDoor.y, exitDoor.w, exitDoor.h);
  if (state.player.shards === 3) {
    ctx.fillStyle = "rgba(146, 240, 179, 0.18)";
    ctx.fillRect(exitDoor.x - 20, exitDoor.y - 20, exitDoor.w + 40, exitDoor.h + 40);
  }
}

function drawGrid() {
  ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
  ctx.lineWidth = 1;
  for (let x = 0; x < WORLD.width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, WORLD.height);
    ctx.stroke();
  }
  for (let y = 0; y < WORLD.height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WORLD.width, y);
    ctx.stroke();
  }
}

function drawShards() {
  state.shards.forEach((shard) => {
    if (shard.found) {
      return;
    }
    const pulse = 0.65 + Math.sin(shard.pulse) * 0.18;
    ctx.beginPath();
    ctx.fillStyle = `rgba(135, 223, 255, ${0.12 + pulse * 0.12})`;
    ctx.arc(shard.x, shard.y, 20 + Math.sin(shard.pulse) * 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = `rgba(135, 223, 255, ${pulse})`;
    ctx.arc(shard.x, shard.y, 8 + Math.sin(shard.pulse) * 2, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawDecoy() {
  if (!state.decoy) {
    return;
  }
  ctx.beginPath();
  ctx.fillStyle = `rgba(255, 153, 170, ${0.18 + Math.sin(state.decoy.pulse) * 0.12})`;
  ctx.arc(state.decoy.x, state.decoy.y, 14 + Math.sin(state.decoy.pulse) * 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawEntity(x, y, radius, fill, glow) {
  ctx.beginPath();
  ctx.shadowBlur = glow;
  ctx.shadowColor = fill;
  ctx.fillStyle = fill;
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawPlayer() {
  const player = state.player;
  drawEntity(player.x, player.y, player.radius, player.hidden ? "#7aa0aa" : "#d5edf8", player.flashlightOn ? 16 : 5);

  if (player.flashlightOn) {
    const beamLength = 170;
    const directionX = player.velocityX === 0 && player.velocityY === 0 ? player.facingX : player.velocityX;
    const directionY = player.velocityX === 0 && player.velocityY === 0 ? player.facingY : player.velocityY;
    const angle = Math.atan2(directionY, directionX);
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.arc(player.x, player.y, beamLength, angle - 0.48, angle + 0.48);
    ctx.closePath();
    const beam = ctx.createRadialGradient(player.x, player.y, 10, player.x, player.y, beamLength);
    beam.addColorStop(0, "rgba(215, 242, 255, 0.28)");
    beam.addColorStop(1, "rgba(215, 242, 255, 0.01)");
    ctx.fillStyle = beam;
    ctx.fill();
  }
}

function drawEnemy() {
  const hue = state.enemy.mode === "hunting" ? "#ff7d8e" : state.enemy.mode === "stalking" ? "#f1ab76" : "#8f96bf";
  drawEntity(state.enemy.x, state.enemy.y, state.enemy.radius, hue, 24);

  if (state.enemy.mode !== "studying") {
    ctx.beginPath();
    ctx.strokeStyle = state.enemy.mode === "hunting" ? "rgba(255, 125, 142, 0.26)" : "rgba(241, 171, 118, 0.18)";
    ctx.lineWidth = 2;
    ctx.arc(state.enemy.x, state.enemy.y, state.enemy.detection, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawDarkness() {
  ctx.fillStyle = "rgba(1, 2, 4, 0.72)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const lightStrength = state.player.flashlightOn ? 155 : 55;
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  const fog = ctx.createRadialGradient(state.player.x, state.player.y, 10, state.player.x, state.player.y, lightStrength);
  fog.addColorStop(0, "rgba(0,0,0,0.92)");
  fog.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = fog;
  ctx.beginPath();
  ctx.arc(state.player.x, state.player.y, lightStrength, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const sanityVignette = (100 - state.player.sanity) / 100;
  if (sanityVignette > 0) {
    ctx.fillStyle = `rgba(120, 0, 18, ${sanityVignette * 0.28})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  state.screenPulse = Math.max(0, state.screenPulse - 0.015);
  if (state.screenPulse > 0) {
    ctx.fillStyle = `rgba(255, 107, 125, ${state.screenPulse * 0.18})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function drawPrompt() {
  const spot = nearestHidingSpot();
  if (!spot || state.gameOver || state.win) {
    return;
  }
  ctx.fillStyle = "rgba(7, 12, 19, 0.85)";
  ctx.fillRect(state.player.x - 58, state.player.y - 44, 116, 28);
  ctx.fillStyle = "#eef7ff";
  ctx.font = '14px "Space Grotesk"';
  ctx.textAlign = "center";
  ctx.fillText(state.player.hidden ? "Press E to leave locker" : "Press E to hide", state.player.x, state.player.y - 25);
}

function loop(timestamp) {
  if (!state.player || !state.enemy) {
    return;
  }

  const dt = Math.min((timestamp - state.lastTime) / 1000 || 0.016, 0.032);
  state.lastTime = timestamp;

  if (state.running) {
    overlayMessage.classList.remove("visible");
    handleMovement(dt);
    updateShards(dt);
    updateDecoy(dt);
    updateEnemy(dt);
    checkInteractions();
  }

  drawEnvironment();
  drawShards();
  drawDecoy();
  drawEnemy();
  drawPlayer();
  drawDarkness();
  drawPrompt();
  updateHud();

  state.animationFrameId = requestAnimationFrame(loop);
}

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) {
    event.preventDefault();
  }
  state.keys.add(key);

  if (key === "f" && state.player && !state.gameOver && !state.win) {
    state.player.flashlightOn = !state.player.flashlightOn && state.player.battery > 1;
    logEvent(state.player.flashlightOn ? "Flashlight engaged." : "Flashlight disengaged.");
    playPulse(state.player.flashlightOn ? 250 : 140, 0.08, 0.02, "square");
  }

  if (key === "e" && state.player && !state.player.interactionLock) {
    const spot = nearestHidingSpot();
    if (spot) {
      state.player.hidden = !state.player.hidden;
      state.player.interactionLock = true;
      logEvent(state.player.hidden ? "Locker sealed. Noise signature reduced." : "You leave the locker and expose yourself.");
      setTimeout(() => {
        state.player.interactionLock = false;
      }, 180);
    }
  }
});

window.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) {
    event.preventDefault();
  }
  state.keys.delete(key);
});

startButton.addEventListener("click", beginGame);

drawEnvironment();
