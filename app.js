// --- Seedable Pseudo-Random Generator (Mulberry32) ---
function mulberry32(a) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

// --- Local Settings Service ---
const STORAGE_KEYS = {
  sound: 'sound',
  vibration: 'vibration',
  firstLaunch: 'first_launch',
  drawing: 'drawing_mode',
  volume: 'sound_volume',
  purification: 'purification_mode',
  lang: 'lang'
};

let soundEnabled = localStorage.getItem(STORAGE_KEYS.sound) === 'true';
let vibrationEnabled = localStorage.getItem(STORAGE_KEYS.vibration) !== 'false';
let isFirstLaunch = localStorage.getItem(STORAGE_KEYS.firstLaunch) !== 'false';
let drawingMode = localStorage.getItem(STORAGE_KEYS.drawing) === 'true';
let soundVolume = parseInt(localStorage.getItem(STORAGE_KEYS.volume) || '1'); // 0=low, 1=med, 2=high
let purificationMode = parseInt(localStorage.getItem(STORAGE_KEYS.purification) || '1'); // 0=burst, 1=purify, 2=big burst
let lang = localStorage.getItem(STORAGE_KEYS.lang) || 'ja';

function saveSetting(key, val) {
  localStorage.setItem(key, val);
}

// --- Procedural Sound Synthesis (Web Audio API) ---
let audioCtx = null;
const audioBuffers = {
  chapon: null,
  rolling: null,
  explosion: null,
  bigExplosion: null,
  divine: null,
  fizz: null
};

let rollingSource = null;

function getVolMultiplier() {
  switch (soundVolume) {
    case 0: return 0.25;
    case 2: return 1.00;
    default: return 0.50;
  }
}

function initAudio() {
  if (audioCtx) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  audioCtx = new AudioContextClass();
  preloadSounds();
}

function addTone(samples, sampleRate, { startMs, freq, durationMs, amplitude, decay = 8.0, attackMs = 0 }) {
  const start = Math.floor(sampleRate * startMs / 1000);
  const len = Math.floor(sampleRate * durationMs / 1000);
  const attackLen = Math.floor(sampleRate * attackMs / 1000);
  for (let i = 0; i < len && start + i < samples.length; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-t * decay);
    const atk = (attackLen > 0 && i < attackLen) ? (i / attackLen) : 1.0;
    samples[start + i] += Math.sin(2 * Math.PI * freq * t) * amplitude * env * atk;
  }
}

function addSweepTone(samples, sampleRate, { startMs, freqStart, freqEnd, durationMs, amplitude, decay = 8.0, attackMs = 0 }) {
  const start = Math.floor(sampleRate * startMs / 1000);
  const len = Math.floor(sampleRate * durationMs / 1000);
  const attackLen = Math.floor(sampleRate * attackMs / 1000);
  let phase = 0.0;
  for (let i = 0; i < len && start + i < samples.length; i++) {
    const tNorm = i / len;
    const t = i / sampleRate;
    const freq = freqStart + (freqEnd - freqStart) * tNorm;
    phase += 2 * Math.PI * freq / sampleRate;
    const env = Math.exp(-t * decay);
    const atk = (attackLen > 0 && i < attackLen) ? (i / attackLen) : 1.0;
    samples[start + i] += Math.sin(phase) * amplitude * env * atk;
  }
}

// Peak scaling function to normalize Float32 samples
function scaleAndCreateAudioBuffer(samples, sampleRate) {
  let peak = 0;
  for (let s of samples) {
    const abs = Math.abs(s);
    if (abs > peak) peak = abs;
  }
  const scale = (peak > 0.92 && !isNaN(peak) && isFinite(peak)) ? 0.92 / peak : 1.0;
  
  const buffer = audioCtx.createBuffer(1, samples.length, sampleRate);
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) {
    let s = samples[i];
    if (isNaN(s)) s = 0.0;
    if (!isFinite(s)) s = s < 0 ? -1.0 : 1.0;
    channelData[i] = s * scale;
  }
  return buffer;
}

function preloadSounds() {
  setTimeout(() => { if (!audioBuffers.chapon) audioBuffers.chapon = scaleAndCreateAudioBuffer(buildDobonWav(), 44100); }, 200);
  setTimeout(() => { if (!audioBuffers.rolling) audioBuffers.rolling = scaleAndCreateAudioBuffer(buildRollingWav(), 44100); }, 400);
  setTimeout(() => { if (!audioBuffers.explosion) audioBuffers.explosion = scaleAndCreateAudioBuffer(buildExplosionWav(), 44100); }, 600);
  setTimeout(() => { if (!audioBuffers.bigExplosion) audioBuffers.bigExplosion = scaleAndCreateAudioBuffer(buildBigExplosionWav(), 44100); }, 800);
  setTimeout(() => { if (!audioBuffers.divine) audioBuffers.divine = scaleAndCreateAudioBuffer(buildDivineWav(), 44100); }, 1000);
  setTimeout(() => { if (!audioBuffers.fizz) audioBuffers.fizz = scaleAndCreateAudioBuffer(buildFizzWav(), 44100); }, 1200);
}

function playSound(buffer, volumeMultiplier) {
  if (!soundEnabled || !audioCtx || !buffer) return null;
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  const gainNode = audioCtx.createGain();
  const vol = getVolMultiplier() * volumeMultiplier;
  gainNode.gain.setValueAtTime(Math.min(1.0, Math.max(0.0, vol)), audioCtx.currentTime);
  source.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  source.start(0);
  return source;
}

function playChapon() { playSound(audioBuffers.chapon, 0.15); }
function playRolling() {
  stopRolling();
  rollingSource = playSound(audioBuffers.rolling, 0.40);
}
function stopRolling() {
  if (rollingSource) {
    try { rollingSource.stop(); } catch(e) {}
    rollingSource = null;
  }
}
function playExplosion() { playSound(audioBuffers.explosion, 1.0); }
function playBigExplosion() { playSound(audioBuffers.bigExplosion, 1.0); }
function playDivine() { playSound(audioBuffers.divine, 0.72); }
function playCrownFizz() { playSound(audioBuffers.fizz, 0.65); }

// --- Sound Generators ---
function buildRollingWav() {
  const sampleRate = 44100;
  const durationMs = 5500;
  const totalSamples = Math.floor(sampleRate * durationMs / 1000);
  const totalDur = durationMs / 1000.0;
  const samples = new Float32Array(totalSamples);
  const rng = mulberry32(33);
  
  let bn1 = 0.0, bn2 = 0.0;
  let pn = 0.0;
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const fade = Math.min(1.0, Math.max(0.0, t / totalDur));
    const atk = Math.min(1.0, Math.max(0.0, t / 0.18));
    const vol = ((1.0 - fade) * (1.0 - fade) * 0.50 + 0.018) * atk;
    const alpha = 0.035 - 0.013 * fade;
    const raw = 2 * rng() - 1;
    bn1 = bn1 * (1.0 - alpha) + raw * alpha;
    bn2 = bn2 * (1.0 - alpha) + bn1 * alpha;
    
    const am = 0.55 + 0.45 * Math.sin(2 * Math.PI * 0.8 * t);
    samples[i] += bn2 * vol * am * 12.0;

    const alphaP = 0.085 - 0.060 * fade;
    pn = pn * (1.0 - alphaP) + raw * alphaP;
    const dirtVol = ((1.0 - fade) * (1.0 - fade) * 0.12) * atk;
    const dirtAm = Math.min(1.0, Math.max(0.0, 0.4 + 0.6 * Math.sin(2 * Math.PI * 1.3 * t)));
    samples[i] += pn * dirtVol * dirtAm;
  }

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const fade = Math.min(1.0, Math.max(0.0, t / totalDur));
    const atk = Math.min(1.0, Math.max(0.0, t / 0.18));
    const vol = ((1.0 - fade) * (1.0 - fade) * 0.40) * atk;
    
    const lfo = 0.70 + 0.30 * Math.sin(2 * Math.PI * 0.65 * t);
    const sub = Math.sin(2 * Math.PI * 28.0 * t) * 0.45 * lfo * vol;
    samples[i] += sub;
  }

  for (let k = 0; k < 25; k++) {
    const progress = k / 25.0;
    const tStart = 0.05 + 4.9 * Math.sin(progress * Math.PI / 2) + rng() * 0.12;
    if (tStart >= totalDur - 0.2) continue;

    const startMs = Math.floor(tStart * 1000);
    const amp = (0.35 + rng() * 0.35) * (1.0 - progress) * (1.0 - progress);
    
    addTone(samples, sampleRate, {
      startMs: startMs,
      freq: 42.0 + rng() * 12.0,
      durationMs: 150 + Math.floor(rng() * 150),
      amplitude: amp * 1.5,
      decay: 18.0,
      attackMs: 2,
    });
  }
  return samples;
}

function buildDobonWav() {
  const sampleRate = 44100;
  const durationMs = 4000;
  const totalSamples = Math.floor(sampleRate * durationMs / 1000);
  const samples = new Float32Array(totalSamples);
  const rng = mulberry32(12345);

  const whiteNoise = new Float32Array(totalSamples);
  for (let i = 0; i < totalSamples; i++) {
    whiteNoise[i] = rng() * 2 - 1;
  }

  const brownNoise = new Float32Array(totalSamples);
  let bn1 = 0.0, bn2 = 0.0;
  for (let i = 0; i < totalSamples; i++) {
    bn1 = bn1 * 0.992 + whiteNoise[i] * 0.008;
    bn2 = bn2 * 0.996 + bn1 * 0.004;
    brownNoise[i] = bn2 * 14.0;
  }

  const impactSamples = Math.floor(sampleRate * 30 / 1000);
  for (let i = 0; i < impactSamples; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-t * 40.0) * (t < 0.003 ? t / 0.003 : 1.0);
    samples[i] += Math.sin(2 * Math.PI * 55.0 * t) * env * 3.2;
    samples[i] += Math.sin(2 * Math.PI * 38.0 * t) * env * 2.5;
    samples[i] += Math.sin(2 * Math.PI * 75.0 * t) * env * 1.8;
  }

  const splashSamples = Math.floor(sampleRate * 80 / 1000);
  let bpY1 = 0.0, bpY2 = 0.0;
  for (let i = 0; i < splashSamples; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-t * 55.0);
    const r = Math.exp(-Math.PI * 120.0 / sampleRate);
    const theta = 2 * Math.PI * 90.0 / sampleRate;
    const bpY0 = whiteNoise[i] * env + 2 * r * Math.cos(theta) * bpY1 - r * r * bpY2;
    bpY2 = bpY1;
    bpY1 = bpY0;
    samples[i] += bpY0 * 4.5;
  }

  addTone(samples, sampleRate, { startMs: 0, freq: 28.0, durationMs: 600, amplitude: 2.8, decay: 3.5, attackMs: 3 });
  addTone(samples, sampleRate, { startMs: 0, freq: 42.0, durationMs: 500, amplitude: 2.2, decay: 4.5, attackMs: 2 });
  addTone(samples, sampleRate, { startMs: 0, freq: 58.0, durationMs: 400, amplitude: 1.6, decay: 6.0, attackMs: 1 });

  let cavY1 = 0.0, cavY2 = 0.0;
  let cav2Y1 = 0.0, cav2Y2 = 0.0;
  const cavDurMs = 1400;
  const cavSamples = Math.floor(sampleRate * cavDurMs / 1000);
  const startCav = Math.floor(sampleRate * 20 / 1000);
  for (let i = startCav; i < startCav + cavSamples; i++) {
    if (i >= totalSamples) break;
    const t = (i - startCav) / sampleRate;
    const progress = Math.min(1.0, Math.max(0.0, t / (cavDurMs / 1000.0)));
    const freq = 80.0 - 58.0 * Math.pow(progress, 0.45);
    const freq2 = freq * 1.85;
    const atk = Math.min(1.0, Math.max(0.0, t / 0.025));
    const env = atk * Math.exp(-t * 1.5);
    const bw1 = 5.0 + 4.0 * progress;
    const bw2 = 18.0 + 10.0 * progress;
    const r1 = Math.exp(-Math.PI * bw1 / sampleRate);
    const r2 = Math.exp(-Math.PI * bw2 / sampleRate);
    const theta1 = 2 * Math.PI * freq / sampleRate;
    const theta2 = 2 * Math.PI * freq2 / sampleRate;
    const src1 = Math.sin(2 * Math.PI * freq * t) * 0.88 + brownNoise[i] * 0.12;
    const src2 = Math.sin(2 * Math.PI * freq2 * t) * 0.80 + brownNoise[i] * 0.20;
    const cavY0 = src1 * env + 2 * r1 * Math.cos(theta1) * cavY1 - r1 * r1 * cavY2;
    cavY2 = cavY1; cavY1 = cavY0;
    const cav2Y0 = src2 * env * 0.5 + 2 * r2 * Math.cos(theta2) * cav2Y1 - r2 * r2 * cav2Y2;
    cav2Y2 = cav2Y1; cav2Y1 = cav2Y0;
    samples[i] += cavY0 * 7.0 + cav2Y0 * 2.5;
  }

  let colY1 = 0.0, colY2 = 0.0;
  const colDurMs = 700;
  const colSamples = Math.floor(sampleRate * colDurMs / 1000);
  const startCol = Math.floor(sampleRate * 60 / 1000);
  for (let i = startCol; i < startCol + colSamples; i++) {
    if (i >= totalSamples) break;
    const t = (i - startCol) / sampleRate;
    const progress = Math.min(1.0, Math.max(0.0, t / (colDurMs / 1000.0)));
    const arc = Math.sin(progress * Math.PI);
    const freq = 80.0 + 140.0 * arc;
    const env = arc * Math.exp(-t * 3.5) * 0.8;
    const bw = 45.0 + 30.0 * progress;
    const r = Math.exp(-Math.PI * bw / sampleRate);
    const theta = 2 * Math.PI * freq / sampleRate;
    const src = Math.sin(2 * Math.PI * freq * t) * 0.5 + whiteNoise[i] * 0.5;
    const colY0 = src * env + 2 * r * Math.cos(theta) * colY1 - r * r * colY2;
    colY2 = colY1; colY1 = colY0;
    samples[i] += colY0 * 2.0;
  }

  const startRumble = Math.floor(sampleRate * 200 / 1000);
  for (let i = startRumble; i < totalSamples; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-t * 0.9) * 1.2;
    const lfo = 0.7 + 0.3 * Math.sin(2 * Math.PI * 0.4 * t);
    samples[i] += brownNoise[i] * env * lfo;
  }

  addTone(samples, sampleRate, { startMs: 80, freq: 28.0, durationMs: 2500, amplitude: 0.9, decay: 0.7, attackMs: 50 });

  for (let k = 0; k < 15; k++) {
    const startMs = 400 + Math.floor(rng() * 2800);
    const freq = 30.0 + rng() * 50.0;
    const amp = 0.3 + rng() * 0.45;
    const durMs = 120 + Math.floor(rng() * 200);
    addTone(samples, sampleRate, { startMs: startMs, freq: freq, durationMs: durMs, amplitude: amp, decay: 5.0, attackMs: 40 });
  }

  let lpN = 0.0, hpN = 0.0;
  const startSpray = Math.floor(sampleRate * 30 / 1000);
  const endSpray = Math.floor(sampleRate * 500 / 1000);
  for (let i = startSpray; i < endSpray; i++) {
    if (i >= totalSamples) break;
    const t = (i - startSpray) / sampleRate;
    lpN = lpN * 0.93 + whiteNoise[i] * 0.07;
    hpN = hpN * 0.60 + whiteNoise[i] * 0.40;
    const spray = (hpN - lpN) * Math.exp(-t * 8.0) * 0.25;
    samples[i] += spray;
  }

  for (let i = 0; i < totalSamples; i++) {
    const x = samples[i] * 1.4;
    if (x > 1.0) {
      samples[i] = 0.94 + 0.06 * (1.0 - Math.exp(-(x - 1.0)));
    } else if (x < -1.0) {
      samples[i] = -0.94 - 0.06 * (1.0 - Math.exp(x + 1.0));
    } else {
      samples[i] = x;
    }
  }
  return samples;
}

function buildExplosionWav() {
  const sampleRate = 44100;
  const durationMs = 3500;
  const totalSamples = Math.floor(sampleRate * durationMs / 1000);
  const rng = mulberry32(55);
  const s = new Float32Array(totalSamples);

  addTone(s, sampleRate, { startMs: 0, freq: 80,  durationMs: 1800, amplitude: 3.0, decay: 2.0, attackMs: 5 });
  addTone(s, sampleRate, { startMs: 0, freq: 110, durationMs: 1500, amplitude: 2.8, decay: 2.6, attackMs: 4 });
  addTone(s, sampleRate, { startMs: 0, freq: 145, durationMs: 1200, amplitude: 2.5, decay: 3.3, attackMs: 3 });
  addTone(s, sampleRate, { startMs: 0, freq: 190, durationMs: 1000, amplitude: 2.2, decay: 4.2, attackMs: 3 });
  addTone(s, sampleRate, { startMs: 0, freq: 245, durationMs: 800,  amplitude: 1.8, decay: 5.8, attackMs: 2 });
  addTone(s, sampleRate, { startMs: 0, freq: 320, durationMs: 600,  amplitude: 1.5, decay: 7.8, attackMs: 2 });

  let lpN = 0.0, lpNRef = 0.0;
  const blastLen = Math.floor(sampleRate * 200 / 1000);
  for (let i = 0; i < blastLen; i++) {
    const t = i / sampleRate;
    const raw = 2 * rng() - 1;
    lpN    = lpN    * 0.920 + raw   * 0.080;
    lpNRef = lpNRef * 0.997 + lpN   * 0.003;
    s[i] += (lpN - lpNRef) * Math.exp(-t * 12.0) * 3.0;
  }

  let bn1 = 0.0, bn2 = 0.0;
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const raw = 2 * rng() - 1;
    bn1 = bn1 * 0.984 + raw * 0.016;
    bn2 = bn2 * 0.978 + bn1 * 0.022;
    s[i] += bn2 * Math.exp(-0.8 * t) * 8.0;
  }

  for (let i = 0; i < totalSamples; i++) {
    const x = s[i] * 2.5;
    if (x > 5.0) {
      s[i] = 1.0;
    } else if (x < -5.0) {
      s[i] = -1.0;
    } else {
      const e2x = Math.exp(2.0 * x);
      s[i] = (e2x - 1.0) / (e2x + 1.0);
    }
  }

  const wet = new Float32Array(s);
  const tapDelays = [60,   130,  220,  340,  510,  720 ];
  const tapGains  = [0.55, 0.38, 0.26, 0.17, 0.11, 0.07];
  const tapAlphas = [0.25, 0.20, 0.15, 0.12, 0.09, 0.07];
  for (let d = 0; d < tapDelays.length; d++) {
    const delayN = Math.floor(sampleRate * tapDelays[d] / 1000);
    const gain   = tapGains[d];
    const alpha  = tapAlphas[d];
    let lpEcho = 0.0;
    for (let i = delayN; i < totalSamples; i++) {
      lpEcho = lpEcho * (1.0 - alpha) + s[i - delayN] * alpha;
      wet[i] += lpEcho * gain;
    }
  }

  const fadeStart = totalSamples - Math.floor(sampleRate * 700 / 1000);
  for (let i = fadeStart; i < totalSamples; i++) {
    wet[i] *= 1.0 - (i - fadeStart) / (sampleRate * 700 / 1000);
  }
  return wet;
}

function buildBigExplosionWav() {
  const sampleRate = 44100;
  const durationMs = 5000;
  const totalSamples = Math.floor(sampleRate * durationMs / 1000);
  const rng = mulberry32(66);
  const s = new Float32Array(totalSamples);

  addTone(s, sampleRate, { startMs: 0,   freq: 80,  durationMs: 2000, amplitude: 4.5, decay: 1.8, attackMs: 5 });
  addTone(s, sampleRate, { startMs: 0,   freq: 110, durationMs: 1700, amplitude: 4.2, decay: 2.4, attackMs: 4 });
  addTone(s, sampleRate, { startMs: 0,   freq: 145, durationMs: 1400, amplitude: 3.8, decay: 3.0, attackMs: 3 });
  addTone(s, sampleRate, { startMs: 0,   freq: 190, durationMs: 1100, amplitude: 3.3, decay: 4.0, attackMs: 3 });
  addTone(s, sampleRate, { startMs: 0,   freq: 245, durationMs: 850,  amplitude: 2.7, decay: 5.5, attackMs: 2 });
  addTone(s, sampleRate, { startMs: 0,   freq: 320, durationMs: 650,  amplitude: 2.2, decay: 7.5, attackMs: 2 });

  addTone(s, sampleRate, { startMs: 400, freq: 80,  durationMs: 1800, amplitude: 3.6, decay: 1.8, attackMs: 4 });
  addTone(s, sampleRate, { startMs: 400, freq: 110, durationMs: 1500, amplitude: 3.3, decay: 2.4, attackMs: 3 });
  addTone(s, sampleRate, { startMs: 400, freq: 145, durationMs: 1200, amplitude: 3.0, decay: 3.0, attackMs: 3 });
  addTone(s, sampleRate, { startMs: 400, freq: 190, durationMs: 950,  amplitude: 2.6, decay: 4.0, attackMs: 2 });
  addTone(s, sampleRate, { startMs: 400, freq: 250, durationMs: 700,  amplitude: 2.1, decay: 5.5, attackMs: 2 });
  addTone(s, sampleRate, { startMs: 400, freq: 330, durationMs: 500,  amplitude: 1.7, decay: 7.5, attackMs: 2 });

  let lpN  = 0.0, lpNR  = 0.0;
  const blLen = Math.floor(sampleRate * 200 / 1000);
  for (let i = 0; i < blLen; i++) {
    const t   = i / sampleRate;
    const raw = 2 * rng() - 1;
    lpN  = lpN  * 0.920 + raw * 0.080;
    lpNR = lpNR * 0.997 + lpN * 0.003;
    s[i] += (lpN - lpNR) * Math.exp(-t * 12.0) * 4.0;
  }

  let lpN2 = 0.0, lpNR2 = 0.0;
  const bl2Off = Math.floor(sampleRate * 400 / 1000);
  for (let i = 0; i < blLen && bl2Off + i < totalSamples; i++) {
    const t   = i / sampleRate;
    const raw = 2 * rng() - 1;
    lpN2  = lpN2  * 0.920 + raw  * 0.080;
    lpNR2 = lpNR2 * 0.997 + lpN2 * 0.003;
    s[bl2Off + i] += (lpN2 - lpNR2) * Math.exp(-t * 12.0) * 3.2;
  }

  let bn1 = 0.0, bn2 = 0.0;
  for (let i = 0; i < totalSamples; i++) {
    const t   = i / sampleRate;
    const raw = 2 * rng() - 1;
    bn1 = bn1 * 0.984 + raw * 0.016;
    bn2 = bn2 * 0.978 + bn1 * 0.022;
    s[i] += bn2 * Math.exp(-0.65 * t) * 10.0;
  }

  for (let i = 0; i < totalSamples; i++) {
    const x = s[i] * 4.0;
    if (x > 5.0) {
      s[i] = 1.0;
    } else if (x < -5.0) {
      s[i] = -1.0;
    } else {
      const e2x = Math.exp(2.0 * x);
      s[i] = (e2x - 1.0) / (e2x + 1.0);
    }
  }

  const wet = new Float32Array(s);
  const tapDelays = [55,   120,  210,  330,  490,  680,  920,  1200 ];
  const tapGains  = [0.62, 0.46, 0.32, 0.22, 0.15, 0.10, 0.07, 0.04 ];
  const tapAlphas = [0.26, 0.20, 0.16, 0.12, 0.09, 0.07, 0.05, 0.04 ];
  for (let d = 0; d < tapDelays.length; d++) {
    const delayN = Math.floor(sampleRate * tapDelays[d] / 1000);
    const gain   = tapGains[d];
    const alpha  = tapAlphas[d];
    let lpE   = 0.0;
    for (let i = delayN; i < totalSamples; i++) {
      lpE = lpE * (1.0 - alpha) + s[i - delayN] * alpha;
      wet[i] += lpE * gain;
    }
  }

  const fadeStart = totalSamples - sampleRate;
  for (let i = fadeStart; i < totalSamples; i++) {
    wet[i] *= 1.0 - (i - fadeStart) / sampleRate;
  }
  return wet;
}

function buildDivineWav() {
  const sampleRate = 44100;
  const durationMs = 4000;
  const totalSamples = Math.floor(sampleRate * durationMs / 1000);
  const samples = new Float32Array(totalSamples);
  const rng = mulberry32(88);

  const toneData = [
    [132.0,  0.14, 0.90, 0.06],
    [264.0,  0.22, 0.70, 0.08],
    [330.0,  0.18, 0.55, 0.10],
    [396.0,  0.15, 0.45, 0.12],
    [528.0,  0.20, 0.62, 0.09],
    [660.0,  0.12, 0.34, 0.16],
    [792.0,  0.08, 0.25, 0.22],
    [1056.0, 0.06, 0.18, 0.28]
  ];
  for (const td of toneData) {
    const f = td[0], amp = td[1], atkS = td[2], dr = td[3];
    const lfoRate  = 0.20 + rng() * 0.20;
    const lfoDepth = 0.002 + rng() * 0.002;
    const lfoPhase = rng() * 2 * Math.PI;
    for (let n = 0; n < totalSamples; n++) {
      const t    = n / sampleRate;
      const atk  = (t < atkS) ? t / atkS : 1.0;
      const env  = atk * Math.exp(-dr * t);
      const freq = f * (1.0 + lfoDepth * Math.sin(2 * Math.PI * lfoRate * t + lfoPhase));
      samples[n] += Math.sin(2 * Math.PI * freq * t) * amp * env;
    }
  }

  const bellLen = Math.floor(sampleRate * 400 / 1000);
  for (let n = 0; n < bellLen; n++) {
    const t = n / sampleRate;
    const env = Math.exp(-18.0 * t);
    samples[n] += Math.sin(2 * Math.PI * 2640 * t) * 0.15 * env;
    samples[n] += Math.sin(2 * Math.PI * 3960 * t) * 0.08 * env;
    samples[n] += Math.sin(2 * Math.PI * 5280 * t) * 0.05 * env;
  }

  for (let k = 0; k < 20; k++) {
    const tStart = 0.2 + rng() * 3.2;
    const freq   = 1200.0 + rng() * 2400.0;
    const sparkAmp = 0.04 + rng() * 0.04;
    const durN   = Math.floor(sampleRate * (30 + Math.floor(rng() * 60)) / 1000);
    const nStart = Math.floor(tStart * sampleRate);
    for (let n = nStart; n < Math.min(nStart + durN, totalSamples); n++) {
      const env = Math.sin((n - nStart) / durN * Math.PI);
      samples[n] += Math.sin(2 * Math.PI * freq * n / sampleRate) * sparkAmp * env;
    }
  }

  const fadeStart = totalSamples - sampleRate;
  for (let n = fadeStart; n < totalSamples; n++) {
    samples[n] *= 1.0 - (n - fadeStart) / sampleRate;
  }
  return samples;
}

function buildFizzWav() {
  const sampleRate = 44100;
  const durationMs = 2000;
  const totalSamples = Math.floor(sampleRate * durationMs / 1000);
  const samples = new Float32Array(totalSamples);
  const rng = mulberry32(99);

  let lp = 0.0;
  for (let n = 0; n < totalSamples; n++) {
    const t   = n / sampleRate;
    const raw = 2 * rng() - 1;
    lp = lp + 0.03 * (raw - lp);
    const hp  = raw - lp;
    const env = Math.exp(-2.2 * t) * Math.min(t / 0.04, 1.0);
    samples[n] += hp * 0.38 * env;
  }

  for (let k = 0; k < 250; k++) {
    const tStart  = rng() * 1.7;
    const freq    = 1500.0 + rng() * 5500.0;
    const sparkAmp = 0.007 + rng() * 0.016;
    const durN    = Math.floor(sampleRate * (12 + Math.floor(rng() * 55)) / 1000);
    const nStart  = Math.floor(tStart * sampleRate);
    const baseEnv = Math.exp(-2.2 * tStart);
    for (let n = nStart; n < Math.min(nStart + durN, totalSamples); n++) {
      const env = Math.sin((n - nStart) / durN * Math.PI);
      samples[n] += Math.sin(2 * Math.PI * freq * n / sampleRate) * sparkAmp * env * baseEnv;
    }
  }

  addSweepTone(samples, sampleRate, {
    startMs: 0, freqStart: 800, freqEnd: 3500,
    durationMs: 350, amplitude: 0.10, decay: 4.0, attackMs: 30
  });

  const fadeStart = totalSamples - Math.floor(sampleRate * 500 / 1000);
  for (let n = fadeStart; n < totalSamples; n++) {
    samples[n] *= 1.0 - (n - fadeStart) / (sampleRate * 500 / 1000);
  }
  return samples;
}

// --- Browser Vibration Safe Wrapper ---
function vibrate(pattern) {
  if (!vibrationEnabled) return;
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch(e) {}
  }
}

function vibrateSplash() { vibrate([40, 120, 40]); }
function vibrateTap() { vibrate(60); }
function vibrateExplosion() { vibrate([180, 70, 100, 90, 60, 120, 35]); }
function vibrateBigExplosion() { vibrate([220, 40, 220, 55, 160, 65, 120, 80, 80, 110, 50]); }

// --- Game Variables & States ---
let phase = 'forming'; // 'forming', 'waiting', 'sliding', 'splashing', 'settling', 'popup'
let dropCount = 0;
const throwTimes = [];
let showFirstHint = false; // 初回起動セッションのみ true（ヒント表示レイヤーを保持）
let firstThrown = false;   // 初回の1投で true → ヒントをフェードアウト

let screenW = 0;
let screenH = 0;

function getSpringX() { return screenW / 2; }
function getSpringY() { return screenH * 0.13; }
function getSpringVisualY() { return screenH * 0.12; }
function getStoneBaseY() { return screenH * 0.82; }

// Animation state controls
let formProgress = 0.0; // 0->1 over 2.5s
let slideProgress = 0.0; // 0->1 over 5.0s
let sinkProgress = 0.0; // 0->1 over 0.3s
let splashTimer = 0.0;
let explosionActive = false;
let explosionTimer = 0.0;
let crownSoundPlayed = false;
let bigExplosionWave2 = false;
let rainbowEmitted = false;
let rippleT = -1.0;
let impactT = -1.0;
let caveLight = 0.0;
let lakeT = 0.0;
let pulseT = 0.0;
let settleTimer = 0.0;
const settleDelay = 6.0;

// Dynamic particles lists
const particles = [];
const waterParticles = [];

// Drawing mode strokes lists
const strokes = [];
let currentStroke = [];

// Base stone local mapper
function toStoneLocal(screenX, screenY) {
  const r = screenW * 0.364;
  return {
    x: (screenX - getSpringX()) / r,
    y: (screenY - getStoneBaseY()) / r
  };
}

// Projection function
function project(p, cx, cy, r, cosT, sinT) {
  const lx = p.x;
  const ly = p.y / 0.82;
  const radical = 1.0 - lx * lx - ly * ly;
  const lz = Math.sqrt(Math.max(0.0, radical));
  const newLy = ly * cosT + lz * sinT;
  const newLz = -ly * sinT + lz * cosT;
  if (newLz < -0.05) return null;
  return {
    x: cx + lx * r,
    y: cy + newLy * 0.82 * r
  };
}

// Particle factory
function createParticle(x, y, vx, vy, life, size, color, decay = 0.30) {
  return { x, y, vx, vy, life, size, color, decay };
}

// Colors list
const splashColors = [
  '#F8BBD0', '#CE93D8', '#90CAF9',
  '#A5D6A7', '#FFF59D', '#FFCC80',
  '#F48FB1'
];

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Stone geometry vertices definition
const stoneVerts = [
  {x: 0.0, y: -0.90}, {x: 0.30, y: -0.68}, {x: 0.55, y: -0.72},
  {x: 0.82, y: -0.38}, {x: 0.88, y: 0.05}, {x: 0.72, y: 0.42},
  {x: 0.50, y: 0.68}, {x: 0.12, y: 0.85}, {x: -0.30, y: 0.80},
  {x: -0.60, y: 0.58}, {x: -0.80, y: 0.22}, {x: -0.85, y: -0.18},
  {x: -0.65, y: -0.52}, {x: -0.35, y: -0.75}
];

function buildStonePath(cx, cy, r, context) {
  context.beginPath();
  let first = true;
  for (let v of stoneVerts) {
    let x = cx + v.x * r;
    let y = cy + v.y * r * 0.82;
    if (first) {
      context.moveTo(x, y);
      first = false;
    } else {
      context.lineTo(x, y);
    }
  }
  context.closePath();
}

// Curve mapping functions matching Flutter
function easeOutCubic(t) {
  return 1.0 - Math.pow(1.0 - t, 3);
}

function slideCurve(t) {
  const easeOut = 1.0 - Math.pow(1.0 - t, 3);
  return easeOut * 0.50 + t * 0.50;
}

// --- Trigger state actions ---
// 落書きを投げる（ダブルタップと「なげる」ボタンの共通処理）
function throwDrawing() {
  if (!drawingMode || phase !== 'waiting') return;
  vibrateTap();
  if (currentStroke.length > 1) {
    strokes.push([...currentStroke]);
  }
  currentStroke = [];
  startSliding();
}

function startSliding() {
  // 初回ヒントは最初の1投でフェードアウト（時間では消さない）
  if (showFirstHint && !firstThrown) {
    firstThrown = true;
    const hintEl = document.getElementById('first-hint');
    if (hintEl) hintEl.style.opacity = '0';
    saveSetting(STORAGE_KEYS.firstLaunch, 'false');
  }
  throwTimes.push(Date.now());
  if (throwTimes.length > 50) {
    throwTimes.shift();
  }
  slideProgress = 0;
  phase = 'sliding';
  playRolling();
}

function startForming() {
  slideProgress = 0;
  formProgress = 0;
  rippleT = -1.0;
  impactT = -1.0;
  waterParticles.length = 0;
  particles.length = 0;
  splashTimer = 0.0;
  rainbowEmitted = false;
  explosionActive = false;
  explosionTimer = 0.0;
  crownSoundPlayed = false;
  bigExplosionWave2 = false;
  strokes.length = 0;
  currentStroke = [];
  phase = 'forming';
}

function triggerSplash() {
  phase = 'splashing';
  caveLight = 0.0;
  rippleT = 0.0;
  impactT = 0.0;
  splashTimer = 0.0;
  sinkProgress = 0.0;
  rainbowEmitted = false;
  explosionActive = false;
  explosionTimer = 0.0;
  crownSoundPlayed = false;
  waterParticles.length = 0;
  bigExplosionWave2 = false;
  emitWaterParticles({ superIntense: purificationMode === 2, intense: purificationMode === 0 });
  vibrateSplash();
  stopRolling();
  playChapon();
}

// --- Splash Particle Emitters ---
function emitParticles({ intense = false, superIntense = false, additive = false } = {}) {
  if (!additive) particles.length = 0;
  const cx = getSpringX();
  const cy = getSpringY();
  
  const sm = superIntense ? 1.8 : (intense ? 1.35 : 1.0);
  const sz = superIntense ? 1.4 : (intense ? 1.1 : 1.0);
  const cn = superIntense ? 2.0 : (intense ? 1.3 : 1.0);
  
  // 1. Upwards ceiling sparks
  const count1 = Math.floor(130 * cn);
  for (let i = 0; i < count1; i++) {
    const angle = -5 * Math.PI / 6 + Math.random() * (Math.PI * 2 / 3);
    const speed = (Math.random() * 5 + 2) * sm;
    const color = splashColors[Math.floor(Math.random() * splashColors.length)];
    particles.push(createParticle(
      cx + Math.random() * 14 - 7,
      cy,
      Math.cos(angle) * speed,
      Math.sin(angle) * speed,
      1.0,
      (Math.random() * 14 + 6) * sz,
      color
    ));
  }
  
  // 2. Wide left/right
  const count2 = Math.floor(160 * cn);
  for (let i = 0; i < count2; i++) {
    const lr = Math.random() < 0.5 ? 1.0 : -1.0;
    const angle = lr * (Math.random() * Math.PI * 0.42 + 0.05);
    const speed = (Math.random() * 9 + 4) * sm;
    const color = splashColors[Math.floor(Math.random() * splashColors.length)];
    particles.push(createParticle(
      cx + Math.random() * 16 - 8,
      cy,
      Math.cos(angle) * speed,
      Math.sin(angle) * speed + 1,
      1.0,
      (Math.random() * 12 + 4) * sz,
      color
    ));
  }
  
  // 3. Downwards (fast decay)
  const count3 = Math.floor(120 * cn);
  for (let i = 0; i < count3; i++) {
    const angle = Math.PI / 6 + Math.random() * (Math.PI * 2 / 3);
    const speed = (Math.random() * 3.0 + 1.0) * sm;
    const color = splashColors[Math.floor(Math.random() * splashColors.length)];
    particles.push(createParticle(
      cx + Math.random() * 12 - 6,
      cy,
      Math.cos(angle) * speed,
      Math.sin(angle) * speed,
      1.0,
      (Math.random() * 12 + 5) * sz,
      color,
      1.0 // decay
    ));
  }
  
  // 4. All directions small burst
  const count4 = Math.floor(100 * cn);
  for (let i = 0; i < count4; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (Math.random() * 4 + 2) * sm;
    const color = splashColors[Math.floor(Math.random() * splashColors.length)];
    particles.push(createParticle(
      cx + Math.random() * 20 - 10,
      cy,
      Math.cos(angle) * speed,
      Math.sin(angle) * speed + 0.5,
      1.0,
      (Math.random() * 6 + 2) * sz,
      color
    ));
  }
}

function emitWaterParticles({ intense = false, superIntense = false } = {}) {
  const cx = getSpringX();
  const cy = getSpringY();
  const sm = superIntense ? 1.7 : (intense ? 1.3 : 1.0);
  const surfaceY = cy + screenH * 0.07;
  
  const cnt1 = superIntense ? 60 : (intense ? 36 : 22);
  const cnt2 = superIntense ? 28 : (intense ? 17 : 10);
  
  // 1. Dome fountain
  for (let i = 0; i < cnt1; i++) {
    const angle = Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.67;
    const speed = (Math.random() * 8 + 4) * sm;
    const opacity = 0.80 + Math.random() * 0.15;
    waterParticles.push(createParticle(
      cx + Math.random() * 8 - 4,
      surfaceY,
      Math.cos(angle) * speed,
      Math.sin(angle) * speed,
      1.0,
      Math.random() * 4.0 + 2.0,
      `rgba(255, 255, 255, ${opacity})`,
      0.75
    ));
  }
  
  // 2. Upward burst
  for (let i = 0; i < cnt2; i++) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.5;
    const speed = (Math.random() * 9 + 5) * sm;
    waterParticles.push(createParticle(
      cx + Math.random() * 6 - 3,
      cy,
      Math.cos(angle) * speed,
      Math.sin(angle) * speed,
      1.0,
      Math.random() * 2.5 + 1.0,
      'rgba(255, 255, 255, 0.80)',
      0.75
    ));
  }
}

function emitFountainRing(dt) {
  const cx = getSpringX();
  const cy = getSpringY();
  const shrink = explosionTimer > 3.25 ? (explosionTimer - 3.25) / 0.5 : 0.0;
  const halfW = screenW * 0.275 * (1.0 - Math.min(1.0, Math.max(0.0, shrink)) * 0.8);
  const visibleH = cy;
  
  const count = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    const y = cy - Math.random() * visibleH;
    
    if (Math.random() < 0.55) {
      const side = Math.random() < 0.5 ? 1.0 : -1.0;
      const x = cx + side * halfW * (0.75 + Math.random() * 0.5);
      const opacity = 0.78 + Math.random() * 0.18;
      waterParticles.push(createParticle(
        x, y,
        side * (Math.random() * 4 + 2),
        Math.random() * 5 + 3,
        1.0,
        Math.random() * 3.0 + 1.5,
        `rgba(255, 255, 255, ${opacity})`,
        0.75
      ));
    } else {
      const xOff = (Math.random() * 2 - 1) * halfW;
      const opacity = 0.72 + Math.random() * 0.23;
      waterParticles.push(createParticle(
        cx + xOff, y,
        (Math.random() - 0.5) * 2,
        Math.random() * 6 + 4,
        1.0,
        Math.random() * 2.5 + 1.0,
        `rgba(255, 255, 255, ${opacity})`,
        0.75
      ));
    }
  }
}

function emitColumnSpray(dt) {
  const colH = getSpringY() + 80.0;
  const shrink = explosionTimer > 3.25 ? (explosionTimer - 3.25) / 0.5 : 0.0;
  const halfW = screenW * 0.275 * (1.0 - Math.min(1.0, Math.max(0.0, shrink)) * 0.8);
  
  const count = 6 + Math.floor(Math.random() * 5);
  for (let i = 0; i < count; i++) {
    const frac = Math.random();
    const y = getSpringY() - colH * frac;
    const side = Math.random() < 0.5 ? 1.0 : -1.0;
    const x = getSpringX() + side * halfW * (0.8 + Math.random() * 0.4);
    
    const speed = 40.0 + Math.random() * 80.0;
    const vx = side * (0.6 + Math.random() * 0.4) * speed * dt;
    const vy = (-0.3 + Math.random() * 0.6) * speed * dt;
    
    const colors = [
      'rgba(255, 255, 255, 1)',
      'rgba(179, 229, 252, 1)',
      'rgba(128, 222, 234, 1)',
      'rgba(206, 147, 216, 1)',
      'rgba(165, 214, 167, 1)',
      'rgba(255, 245, 157, 1)'
    ];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const decay = 1.8 + Math.random() * 1.5;
    
    waterParticles.push(createParticle(
      x, y, vx, vy,
      1.0,
      1.5 + Math.random() * 3.0,
      color,
      decay
    ));
  }
}

// --- Canvas Rendering Helpers ---
function buildSpringPath(cx, cy, w, h, context) {
  const offsets = [
    {x: 1.0, y: 0.08}, {x: 0.90, y: -0.48}, {x: 0.62, y: -0.88},
    {x: 0.22, y: -1.0}, {x: -0.18, y: -0.94}, {x: -0.55, y: -1.0},
    {x: -0.88, y: -0.52}, {x: -1.0, y: 0.05}, {x: -0.88, y: 0.58},
    {x: -0.50, y: 0.90}, {x: 0.05, y: 1.0}, {x: 0.52, y: 0.85},
    {x: 0.88, y: 0.45}
  ];
  const pts = offsets.map(o => ({x: cx + o.x * w, y: cy + o.y * h}));
  const n = pts.length;
  
  context.beginPath();
  const startX = (pts[n - 1].x + pts[0].x) / 2;
  const startY = (pts[n - 1].y + pts[0].y) / 2;
  context.moveTo(startX, startY);
  
  for (let i = 0; i < n; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    context.quadraticCurveTo(p1.x, p1.y, midX, midY);
  }
  context.closePath();
}

function drawCaveBase(ctx) {
  ctx.fillStyle = '#2C251C';
  ctx.fillRect(0, 0, screenW, screenH);
  
  const topGrad = ctx.createLinearGradient(0, 0, 0, screenH * 0.5);
  topGrad.addColorStop(0, '#342C22');
  topGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, screenW, screenH * 0.5);
  
  const leftGrad = ctx.createLinearGradient(0, 0, screenW * 0.4, 0);
  leftGrad.addColorStop(0, '#201C16');
  leftGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = leftGrad;
  ctx.fillRect(0, 0, screenW * 0.4, screenH);
  
  const rightGrad = ctx.createLinearGradient(screenW, 0, screenW * 0.6, 0);
  rightGrad.addColorStop(0, '#201C16');
  rightGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = rightGrad;
  ctx.fillRect(screenW * 0.6, 0, screenW * 0.4, screenH);
  
  const floorGrad = ctx.createLinearGradient(0, screenH, 0, screenH * 0.6);
  floorGrad.addColorStop(0, '#1C1A14');
  floorGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, screenH * 0.6, screenW, screenH * 0.4);
}

function drawSpring(ctx) {
  const w = screenW * 0.96;
  const h = screenH * 0.16;
  const cx = getSpringX();
  const cy = getSpringVisualY();
  
  ctx.save();
  buildSpringPath(cx, cy, w, h, ctx);
  ctx.fillStyle = '#050302';
  ctx.fill();
  
  buildSpringPath(cx, cy, w, h, ctx);
  ctx.fillStyle = '#07101C';
  ctx.fill();
  
  const grad = ctx.createRadialGradient(cx, cy - h * 0.2, 0, cx, cy, h * 0.85);
  grad.addColorStop(0.0, '#1e3f60');
  grad.addColorStop(0.55, '#112035');
  grad.addColorStop(1.0, '#07101C');
  ctx.fillStyle = grad;
  ctx.fill();
  
  const innerW = w * 0.78;
  const innerH = h * 0.60;
  const innerCy = cy - h * 0.15;
  buildSpringPath(cx, innerCy, innerW, innerH, ctx);
  const innerGrad = ctx.createRadialGradient(cx, innerCy, 0, cx, innerCy, innerH * 0.7);
  innerGrad.addColorStop(0.0, 'rgba(36, 72, 104, 0.7)');
  innerGrad.addColorStop(1.0, 'rgba(18, 32, 48, 0.9)');
  ctx.fillStyle = innerGrad;
  ctx.fill();
  
  buildSpringPath(cx, innerCy, innerW, innerH, ctx);
  ctx.fillStyle = 'rgba(26, 80, 112, 0.22)';
  ctx.fill();
  
  // Shimmers
  const shimmerT = lakeT * 0.55;
  ctx.strokeStyle = '#ffffff';
  for (let i = 0; i < 5; i++) {
    const phase = shimmerT + i * 0.9;
    const lx = cx + Math.sin(phase * 1.2 + i * 0.5) * w * 0.28;
    const ly = cy - h * (0.06 + i * 0.045);
    const lw = w * Math.abs(0.04 + Math.sin(phase * 0.8 + i) * 0.025);
    
    ctx.beginPath();
    ctx.moveTo(lx - lw, ly);
    ctx.lineTo(lx + lw, ly);
    ctx.lineWidth = 0.8 + Math.abs(Math.sin(phase + i * 0.7)) * 0.6;
    ctx.globalAlpha = Math.max(0.02, Math.min(0.10, 0.05 + Math.sin(phase * 1.8 + i) * 0.03));
    ctx.stroke();
  }
  ctx.globalAlpha = 1.0;
  
  // Caustics
  for (let i = 0; i < 6; i++) {
    const phase = shimmerT * 0.7 + i * 1.1;
    const bx = cx + Math.sin(phase) * w * 0.32 + Math.cos(phase * 0.6 + i) * w * 0.1;
    const by = cy + h * 0.05 + Math.cos(phase * 1.2) * h * 0.05;
    const br = screenW * (0.007 + Math.abs(Math.sin(phase * 1.4 + i)) * 0.005);
    
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, 2 * Math.PI);
    ctx.fillStyle = '#3a80c8';
    ctx.globalAlpha = Math.max(0.04, Math.min(0.18, 0.10 + Math.sin(phase * 1.6) * 0.06));
    ctx.fill();
  }
  ctx.globalAlpha = 1.0;
  
  buildSpringPath(cx, cy, w, h, ctx);
  ctx.strokeStyle = 'rgba(26, 74, 106, 0.35)';
  ctx.lineWidth = 3.5;
  ctx.stroke();
  
  buildSpringPath(cx, cy, w, h, ctx);
  ctx.strokeStyle = '#26201a';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();
}

function drawRipples(ctx) {
  if (rippleT < 0) return;
  const cx = getSpringX();
  const cy = getSpringY();
  
  const baseW = screenW * 0.62;
  const baseH = screenH * 0.065;
  
  ctx.save();
  for (let ring = 0; ring < 3; ring++) {
    const delay = ring * 0.30;
    const t = Math.max(0.0, Math.min(1.8, rippleT - delay));
    if (t <= 0) continue;
    const progress = Math.min(1.0, Math.max(0.0, t / 1.1));
    const opacity = (1.0 - progress) * 0.45;
    if (opacity <= 0) continue;
    const scale = 1.0 + progress * 0.45;
    
    buildSpringPath(cx, cy, baseW * scale * 0.5, baseH * scale, ctx);
    ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
    ctx.lineWidth = Math.max(0.3, Math.min(1.4, 1.4 * (1.0 - progress * 0.6)));
    ctx.stroke();
  }
  ctx.restore();
}

function drawCaveLight(ctx) {
  if (caveLight <= 0) return;
  const ci = Math.floor(lakeT * 2) % 7;
  const glowHex = splashColors[ci];
  
  const cx = getSpringX();
  const cy = getSpringY();
  
  ctx.save();
  const radGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(screenW, screenH) * 1.2);
  radGrad.addColorStop(0.0, `rgba(255, 255, 255, ${0.25 * caveLight})`);
  radGrad.addColorStop(0.2, hexToRgba(glowHex, 0.20 * caveLight));
  radGrad.addColorStop(0.5, hexToRgba(glowHex, 0.08 * caveLight));
  radGrad.addColorStop(1.0, 'transparent');
  ctx.fillStyle = radGrad;
  ctx.fillRect(0, 0, screenW, screenH);
  
  ctx.fillStyle = hexToRgba(glowHex, 0.10 * caveLight);
  ctx.fillRect(0, 0, screenW, screenH);
  ctx.restore();
}

function drawExplosionColumn(ctx) {
  if (explosionTimer <= 0 || explosionTimer >= 3.75) return;
  const t = explosionTimer;
  const riseEnd = 0.25;
  const holdEnd = 3.25;
  const shrinkEnd = 3.75;
  
  const riseP = Math.min(1.0, Math.max(0.0, t / riseEnd));
  const riseEO = 1.0 - Math.pow(1.0 - riseP, 3);
  
  const shrinkP = t > holdEnd ? Math.min(1.0, Math.max(0.0, (t - holdEnd) / (shrinkEnd - holdEnd))) : 0.0;
  const shrinkEI = Math.pow(shrinkP, 3);
  
  const cy = getSpringY();
  const colH = cy + 80.0;
  const topFull = cy - colH;
  
  const drawTop = t < riseEnd ? cy - colH * riseEO : topFull + colH * shrinkEI;
  const drawBot = cy;
  
  if (drawBot - drawTop < 2.0) return;
  
  const cx = getSpringX();
  const halfW = screenW * 0.275;
  
  const opacity = Math.min(1.0, Math.max(0.0, t < 0.12 ? t / 0.12 : (t > 3.55 ? (3.75 - t) / 0.20 : 1.0)));
  
  const hueBase = (t * 60) % 360;
  const rColors = [];
  for (let i = 0; i < 7; i++) {
    const hue = (hueBase + i * 51.4) % 360;
    rColors.push(`hsla(${hue}, 100%, 58%, ${opacity * 0.90})`);
  }
  
  ctx.save();
  
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath();
    ctx.roundRect(cx - halfW * (1.0 + i * 0.15), drawTop, halfW * (2.0 + i * 0.3), drawBot - drawTop, halfW);
    const glowGrad = ctx.createLinearGradient(cx, drawBot, cx, drawTop);
    glowGrad.addColorStop(0, `hsla(${(hueBase) % 360}, 100%, 58%, ${opacity * 0.08 / i})`);
    glowGrad.addColorStop(0.5, `hsla(${(hueBase + 150) % 360}, 100%, 58%, ${opacity * 0.08 / i})`);
    glowGrad.addColorStop(1, `hsla(${(hueBase + 300) % 360}, 100%, 58%, ${opacity * 0.08 / i})`);
    ctx.fillStyle = glowGrad;
    ctx.fill();
  }
  
  ctx.beginPath();
  ctx.roundRect(cx - halfW, drawTop, halfW * 2, drawBot - drawTop, halfW * 0.9);
  const bodyGrad = ctx.createLinearGradient(cx - halfW, 0, cx + halfW, 0);
  bodyGrad.addColorStop(0.0, `rgba(0, 0, 0, ${opacity * 0.60})`);
  bodyGrad.addColorStop(0.15, rColors[1].replace('0.90)', `${opacity * 0.88})`));
  bodyGrad.addColorStop(0.50, `rgba(255, 255, 255, ${opacity * 0.85})`);
  bodyGrad.addColorStop(0.85, rColors[3].replace('0.90)', `${opacity * 0.88})`));
  bodyGrad.addColorStop(1.0, `rgba(0, 0, 0, ${opacity * 0.60})`);
  ctx.fillStyle = bodyGrad;
  ctx.fill();
  
  ctx.globalCompositeOperation = 'screen';
  ctx.beginPath();
  ctx.roundRect(cx - halfW, drawTop, halfW * 2, drawBot - drawTop, halfW * 0.9);
  const vertGrad = ctx.createLinearGradient(cx, drawBot, cx, drawTop);
  for (let i = 0; i < 7; i++) {
    vertGrad.addColorStop(i / 6, rColors[i]);
  }
  ctx.fillStyle = vertGrad;
  ctx.fill();
  
  ctx.globalCompositeOperation = 'source-over';
  
  ctx.beginPath();
  const colLen = drawBot - drawTop;
  const waveAmp = halfW * 0.07;
  const waveCount = 6.0;
  const pathSteps = 30;
  
  ctx.moveTo(cx - halfW, drawBot);
  for (let i = 0; i <= pathSteps; i++) {
    const frac = i / pathSteps;
    const y = drawBot - colLen * frac;
    const wave = Math.sin(frac * waveCount * Math.PI * 2 - t * 14.0) * waveAmp;
    ctx.lineTo(cx - halfW + wave, y);
  }
  for (let i = pathSteps; i >= 0; i--) {
    const frac = i / pathSteps;
    const y = drawBot - colLen * frac;
    const wave = Math.sin(frac * waveCount * Math.PI * 2 - t * 14.0 + Math.PI * 0.6) * waveAmp;
    ctx.lineTo(cx + halfW + wave, y);
  }
  ctx.closePath();
  ctx.clip();
  
  const bandCount = 12;
  const speed = 420.0;
  const spacing = colLen / bandCount;
  const bandOffset = (t * speed) % spacing;
  for (let i = 0; i < bandCount + 2; i++) {
    const bandY = drawBot - bandOffset - i * spacing;
    if (bandY < drawTop - spacing || bandY > drawBot + spacing) continue;
    const bandH = spacing * 0.38;
    const phaseV = Math.max(0.0, Math.min(1.0, (bandY - drawTop) / colLen));
    const bright = Math.sin(phaseV * Math.PI) * opacity * 0.55;
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0.0, Math.min(0.55, bright))})`;
    ctx.fillRect(cx - halfW, bandY - bandH, halfW * 2, bandH);
  }
  
  ctx.restore();
  
  ctx.beginPath();
  ctx.moveTo(cx, drawBot);
  ctx.lineTo(cx, drawTop);
  ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.85})`;
  ctx.lineWidth = halfW * 0.10;
  ctx.lineCap = 'round';
  ctx.stroke();
}

function drawCrown(ctx) {
  if (explosionTimer <= 3.75 || explosionTimer >= 5.25) return;
  const crownT = Math.max(0.0, Math.min(1.0, (explosionTimer - 3.75) / 1.5));
  
  const cx = getSpringX();
  const cy = getSpringY();
  
  const extP = Math.min(1.0, Math.max(0.0, crownT / 0.35));
  const extEO = 1.0 - Math.pow(1.0 - extP, 3);
  
  const opacity = Math.max(0.0, Math.min(1.0, crownT < 0.60 ? 1.0 : 1.0 - (crownT - 0.60) / 0.40));
  if (opacity <= 0) return;
  
  const jetLen = screenH * 0.22 * extEO;
  
  ctx.save();
  
  if (extEO > 0.05) {
    const ringA = screenW * 0.30 * extEO;
    const ringB = screenH * 0.038 * extEO;
    ctx.lineWidth = screenW * 0.009;
    for (let seg = 0; seg < 12; seg++) {
      const hue = (seg * 30.0 + explosionTimer * 90) % 360;
      ctx.strokeStyle = `hsla(${hue}, 100%, 62%, ${opacity * 0.85})`;
      ctx.beginPath();
      ctx.ellipse(cx, cy, ringA, ringB, 0, seg * Math.PI / 6, (seg + 1) * Math.PI / 6 + 0.05);
      ctx.stroke();
    }
  }
  
  if (jetLen >= 2) {
    const jetCount = 10;
    for (let i = 0; i < jetCount; i++) {
      const frac = i / (jetCount - 1);
      const spread = frac * 2.0 - 1.0;
      const angleDeg = spread * 72.0;
      const angle = -Math.PI / 2.0 + angleDeg * Math.PI / 180.0;
      
      const hue = (frac * 300.0 + explosionTimer * 55) % 360;
      const col = `hsla(${hue}, 100%, 60%, ${opacity})`;
      const colGlow = `hsla(${hue}, 100%, 60%, ${opacity * 0.40})`;
      
      const endX = cx + Math.cos(angle) * jetLen;
      const endY = cy + Math.sin(angle) * jetLen;
      
      const ctrlLen = jetLen * 0.55;
      const ctrlX = cx + Math.cos(angle) * ctrlLen + spread * screenW * 0.045;
      const ctrlY = cy + Math.sin(angle) * ctrlLen - screenH * 0.018;
      
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.quadraticCurveTo(ctrlX, ctrlY, endX, endY);
      
      ctx.strokeStyle = colGlow;
      ctx.lineWidth = screenW * 0.038;
      ctx.lineCap = 'round';
      ctx.stroke();
      
      ctx.strokeStyle = `hsla(${hue}, 100%, 60%, ${opacity * 0.90})`;
      ctx.lineWidth = screenW * 0.016;
      ctx.stroke();
      
      ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.55})`;
      ctx.lineWidth = screenW * 0.007;
      ctx.stroke();
      
      if (extP >= 0.70) {
        const dropFrac = Math.max(0.0, Math.min(1.0, (extP - 0.70) / 0.30));
        const dropR = screenW * 0.019 * dropFrac;
        
        ctx.beginPath();
        ctx.arc(endX, endY, dropR * 2.4, 0, 2 * Math.PI);
        ctx.fillStyle = `hsla(${hue}, 100%, 60%, ${opacity * 0.38})`;
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(endX, endY, dropR, 0, 2 * Math.PI);
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.80})`;
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(endX, endY, dropR * 0.45, 0, 2 * Math.PI);
        ctx.fillStyle = `hsla(${hue}, 100%, 60%, ${opacity})`;
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

function drawSpike(ctx, cx, h, w, fromTop, isBackground) {
  const baseY = fromTop ? 0 : screenH;
  const dir = fromTop ? 1 : -1;
  const tipY = baseY + h * dir;
  const alpha = isBackground ? 0.62 : 1.0;
  
  ctx.beginPath();
  ctx.moveTo(cx - w, baseY);
  ctx.quadraticCurveTo(cx - w * 0.72, baseY + h * dir * 0.65, cx, tipY);
  ctx.quadraticCurveTo(cx + w * 0.72, baseY + h * dir * 0.65, cx + w, baseY);
  ctx.closePath();
  ctx.fillStyle = `rgba(7, 5, 3, ${alpha})`;
  ctx.fill();
  
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.82, baseY);
  ctx.quadraticCurveTo(cx - w * 0.62, baseY + h * dir * 0.55, cx - w * 0.06, tipY - screenH * 0.008 * dir);
  ctx.lineTo(cx - w * 0.28, baseY + h * dir * 0.62);
  ctx.quadraticCurveTo(cx - w * 0.44, baseY + h * dir * 0.28, cx - w * 0.56, baseY);
  ctx.closePath();
  ctx.fillStyle = `rgba(28, 20, 8, ${0.55 * alpha})`;
  ctx.fill();
  
  if (!isBackground) {
    const bandY = baseY + h * dir * 0.38;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.62, bandY);
    ctx.quadraticCurveTo(cx, bandY + screenH * 0.004 * dir, cx + w * 0.62, bandY);
    ctx.quadraticCurveTo(cx, bandY + screenH * 0.010 * dir, cx - w * 0.62, bandY);
    ctx.closePath();
    ctx.fillStyle = `rgba(19, 15, 7, 0.38)`;
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(cx, tipY, screenW * 0.0045, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(46, 30, 12, 0.75)';
    ctx.fill();
  }
}

function drawStalactites(ctx) {
  const positions = [0.06, 0.20, 0.38, 0.54, 0.68, 0.82, 0.94];
  const heights   = [0.135, 0.090, 0.165, 0.060, 0.120, 0.078, 0.148];
  const widths    = [0.055, 0.038, 0.065, 0.028, 0.048, 0.038, 0.054];
  for (let i = 0; i < positions.length; i++) {
    drawSpike(ctx, screenW * positions[i], screenH * heights[i], screenW * widths[i], true, false);
  }
}

function drawStalactitesBg(ctx) {
  const positions = [0.13, 0.28, 0.46, 0.60, 0.75, 0.88];
  const heights   = [0.230, 0.155, 0.275, 0.108, 0.195, 0.180];
  const widths    = [0.072, 0.052, 0.088, 0.038, 0.062, 0.070];
  for (let i = 0; i < positions.length; i++) {
    drawSpike(ctx, screenW * positions[i], screenH * heights[i], screenW * widths[i], true, true);
  }
}

function drawStalagmites(ctx) {
  const positions = [0.05, 0.18, 0.32, 0.48, 0.62, 0.76, 0.90];
  const heights   = [0.090, 0.135, 0.075, 0.105, 0.120, 0.068, 0.098];
  const widths    = [0.038, 0.055, 0.028, 0.048, 0.055, 0.028, 0.048];
  for (let i = 0; i < positions.length; i++) {
    drawSpike(ctx, screenW * positions[i], screenH * heights[i], screenW * widths[i], false, false);
  }
}

function drawStalagmitesBg(ctx) {
  const positions = [0.10, 0.24, 0.40, 0.55, 0.70, 0.85];
  const heights   = [0.155, 0.215, 0.125, 0.178, 0.205, 0.118];
  const widths    = [0.050, 0.070, 0.038, 0.060, 0.070, 0.038];
  for (let i = 0; i < positions.length; i++) {
    drawSpike(ctx, screenW * positions[i], screenH * heights[i], screenW * widths[i], false, true);
  }
}

function drawParticles(ctx) {
  for (let p of particles) {
    const radius = p.size * p.life;
    if (radius < 0.5) continue;
    const opacity = Math.max(0.0, Math.min(1.0, p.life));
    
    if (p.size > 8) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius * 2.2, 0, 2 * Math.PI);
      ctx.fillStyle = hexToRgba(p.color, opacity * 0.35);
      ctx.fill();
      ctx.restore();
    }
    
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = hexToRgba(p.color, opacity);
    ctx.fill();
  }
}

function drawWaterParticles(ctx) {
  for (let p of waterParticles) {
    const radius = p.size * p.life;
    if (radius < 0.5) continue;
    const opacity = Math.max(0.0, Math.min(1.0, p.life));
    
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = p.color;
    ctx.fill();
    
    if (p.size > 5) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius * 1.8, 0, 2 * Math.PI);
      ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.25})`;
      ctx.fill();
      ctx.restore();
    }
  }
}

function drawStrokesOnStone(ctx, cx, cy, r, cosT, sinT) {
  ctx.save();
  buildStonePath(cx, cy, r, ctx);
  ctx.clip();
  
  const allStrokes = [...strokes];
  if (currentStroke.length > 1) {
    allStrokes.push(currentStroke);
  }
  
  for (let stroke of allStrokes) {
    if (stroke.length < 2) continue;
    
    let sumZ = 0;
    for (let p of stroke) {
      const ly = p.y / 0.82;
      const lx = p.x;
      const lz = Math.sqrt(Math.max(0.0, 1.0 - lx * lx - ly * ly));
      sumZ += ly * sinT + lz * cosT;
    }
    const avgLz = sumZ / stroke.length;
    if (avgLz < -0.05) continue;
    const strokeOpacity = Math.max(0.0, Math.min(1.0, avgLz * 1.4));
    
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.72 * strokeOpacity})`;
    ctx.lineWidth = Math.max(1.5, Math.min(4.0, r * 0.055));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    const pts = stroke.map(p => project(p, cx, cy, r, cosT, sinT));
    ctx.beginPath();
    
    if (pts.length === 2) {
      const p0 = pts[0];
      const p1 = pts[1];
      if (p0 && p1) {
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }
    } else {
      let started = false;
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i];
        const p1 = pts[i + 1];
        if (!p0 || !p1) {
          started = false;
          continue;
        }
        const midX = (p0.x + p1.x) / 2;
        const midY = (p0.y + p1.y) / 2;
        if (!started) {
          ctx.moveTo(p0.x, p0.y);
          started = true;
        }
        ctx.quadraticCurveTo(p0.x, p0.y, midX, midY);
      }
      const last = pts[pts.length - 1];
      if (started && last) {
        ctx.lineTo(last.x, last.y);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawRock(ctx, cx, cy, r, cosT, sinT) {
  const lLx = -0.46;
  const lLy = -0.64 * cosT + 0.46 * sinT;
  const lLz = 0.64 * sinT + 0.46 * cosT;
  
  const hLy = -0.398 * cosT + 0.872 * sinT;
  const hLz = 0.398 * sinT + 0.872 * cosT;
  
  function getV(i) {
    return {
      x: cx + stoneVerts[i].x * r,
      y: cy + stoneVerts[i].y * r * 0.82
    };
  }
  
  buildStonePath(cx, cy, r, ctx);
  ctx.fillStyle = '#050403';
  ctx.fill();
  
  const lpX = cx + Math.max(-0.78, Math.min(0.78, lLx)) * r;
  const lpY = cy + Math.max(-0.78, Math.min(0.78, lLy)) * r;
  const frontness = Math.max(0.0, Math.min(1.0, lLz));
  
  const litPeakR = Math.round(3 + (0x3a - 3) * frontness);
  const litPeakG = Math.round(2 + (0x24 - 2) * frontness);
  const litPeakB = Math.round(2 + (0x10 - 2) * frontness);
  const litPeak = `rgb(${litPeakR}, ${litPeakG}, ${litPeakB})`;
  
  const litMidR = Math.round(3 + (0x14 - 3) * frontness * 0.5);
  const litMidG = Math.round(2 + (0x0a - 2) * frontness * 0.5);
  const litMidB = Math.round(2 + (0x04 - 2) * frontness * 0.5);
  const litMid = `rgb(${litMidR}, ${litMidG}, ${litMidB})`;
  
  ctx.save();
  buildStonePath(cx, cy, r, ctx);
  ctx.clip();
  
  const lpGrad = ctx.createRadialGradient(lpX, lpY, 0, lpX, lpY, r * 1.5);
  lpGrad.addColorStop(0.0, litPeak);
  lpGrad.addColorStop(0.48, litMid);
  lpGrad.addColorStop(1.0, '#050403');
  ctx.fillStyle = lpGrad;
  ctx.fill();
  
  const dpX = cx - Math.max(-0.78, Math.min(0.78, lLx)) * r;
  const dpY = cy - Math.max(-0.78, Math.min(0.78, lLy)) * r;
  const dpGrad = ctx.createRadialGradient(dpX, dpY, 0, dpX, dpY, r * 1.4);
  dpGrad.addColorStop(0.0, 'rgba(0, 0, 0, 0.82)');
  dpGrad.addColorStop(0.46, 'rgba(0, 0, 0, 0.42)');
  dpGrad.addColorStop(1.0, 'transparent');
  ctx.fillStyle = dpGrad;
  ctx.fill();
  
  const lmbGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  lmbGrad.addColorStop(0.0, 'transparent');
  lmbGrad.addColorStop(0.48, 'transparent');
  lmbGrad.addColorStop(0.70, 'rgba(0, 0, 0, 0.18)');
  lmbGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0.78)');
  ctx.fillStyle = lmbGrad;
  ctx.fill();
  
  // Facet A
  const fa = Math.max(0.0, Math.min(1.0, -0.42 * lLx - 0.59 * lLy + 0.69 * lLz));
  if (fa > 0.04) {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    const v11 = getV(11); ctx.lineTo(v11.x, v11.y);
    const v12 = getV(12); ctx.lineTo(v12.x, v12.y);
    const v13 = getV(13); ctx.lineTo(v13.x, v13.y);
    const v0 = getV(0); ctx.lineTo(v0.x, v0.y);
    const v1 = getV(1); ctx.lineTo(v1.x, v1.y);
    ctx.closePath();
    ctx.fillStyle = `rgba(90, 64, 48, ${fa * 0.60})`;
    ctx.fill();
  }
  
  // Facet B
  const fb = Math.max(0.0, Math.min(1.0, -0.88 * lLy + 0.48 * lLz));
  if (fb > 0.04) {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    const v1 = getV(1); ctx.lineTo(v1.x, v1.y);
    const v2 = getV(2); ctx.lineTo(v2.x, v2.y);
    const v3 = getV(3); ctx.lineTo(v3.x, v3.y);
    ctx.closePath();
    ctx.fillStyle = `rgba(58, 40, 24, ${fb * 0.45})`;
    ctx.fill();
  }
  
  // Facet C
  const fc = Math.max(0.0, Math.min(1.0, 0.88 * lLx + 0.47 * lLz));
  const fcDark = Math.max(0.1, Math.min(1.0, 1.0 - fc * 0.85));
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  const v3 = getV(3); ctx.lineTo(v3.x, v3.y);
  const v4 = getV(4); ctx.lineTo(v4.x, v4.y);
  const v5 = getV(5); ctx.lineTo(v5.x, v5.y);
  const v6 = getV(6); ctx.lineTo(v6.x, v6.y);
  ctx.closePath();
  ctx.fillStyle = `rgba(0, 0, 0, ${fcDark * 0.58})`;
  ctx.fill();
  
  // Facet D
  const fd = Math.max(0.0, Math.min(1.0, 0.88 * lLy + 0.47 * lLz));
  if (fd > 0.04) {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    const v6 = getV(6); ctx.lineTo(v6.x, v6.y);
    const v7 = getV(7); ctx.lineTo(v7.x, v7.y);
    const v8 = getV(8); ctx.lineTo(v8.x, v8.y);
    const v9 = getV(9); ctx.lineTo(v9.x, v9.y);
    ctx.closePath();
    ctx.fillStyle = `rgba(42, 28, 16, ${fd * 0.52})`;
    ctx.fill();
  }
  
  // Ridges
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.82)';
  ctx.lineWidth = r * 0.015;
  const ridgeIndices = [1, 3, 6, 9, 11];
  for (let idx of ridgeIndices) {
    const pt = getV(idx);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
  }
  
  // Highlight ridges
  const hlEdgeAlpha = Math.max(0.0, Math.min(0.62, frontness * 0.55 + 0.08));
  ctx.strokeStyle = `rgba(160, 128, 96, ${hlEdgeAlpha})`;
  ctx.lineWidth = r * 0.026;
  ctx.lineCap = 'round';
  
  const v13 = getV(13);
  const v0 = getV(0);
  const v1 = getV(1);
  const v11 = getV(11);
  const v12 = getV(12);
  
  ctx.beginPath();
  ctx.moveTo(v13.x, v13.y); ctx.lineTo(v0.x, v0.y);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(v0.x, v0.y); ctx.lineTo(v1.x, v1.y);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(v11.x, v11.y); ctx.lineTo(v12.x, v12.y);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(v12.x, v12.y); ctx.lineTo(v13.x, v13.y);
  ctx.stroke();
  
  // Outer contour
  buildStonePath(cx, cy, r, ctx);
  ctx.strokeStyle = 'rgba(42, 28, 10, 0.45)';
  ctx.lineWidth = r * 0.028;
  ctx.stroke();
  
  // Speculars
  if (hLz > 0.04) {
    const specX = cx - 0.286 * r;
    const specY = cy + hLy * r * 0.85;
    const specStr = Math.max(0.0, Math.min(0.88, hLz * 0.88));
    const sR = r * 0.22;
    
    const specGrad = ctx.createRadialGradient(specX, specY, 0, specX, specY, sR * 1.3);
    specGrad.addColorStop(0.0, `rgba(255, 255, 255, ${specStr})`);
    specGrad.addColorStop(0.38, `rgba(255, 255, 255, ${specStr * 0.28})`);
    specGrad.addColorStop(1.0, 'transparent');
    
    ctx.beginPath();
    ctx.ellipse(specX, specY, sR * 1.3, sR * 1.3, 0, 0, 2 * Math.PI);
    ctx.fillStyle = specGrad;
    ctx.fill();
    
    if (hLz > 0.18) {
      ctx.beginPath();
      ctx.arc(specX + r * 0.07, specY - r * 0.04, r * 0.044, 0, 2 * Math.PI);
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0, Math.min(0.48, hLz * 0.48))})`;
      ctx.fill();
      
      ctx.beginPath();
      ctx.arc(specX - r * 0.13, specY + r * 0.09, r * 0.024, 0, 2 * Math.PI);
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0, Math.min(0.28, hLz * 0.28))})`;
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawStone(ctx) {
  if (stoneScale <= 0) return;
  const r = screenW * 0.364 * stoneScale;
  if (r < 1) return;
  
  const cosT = Math.cos(stoneAngle);
  const sinT = Math.sin(stoneAngle);
  
  // Shadows
  ctx.save();
  buildStonePath(stoneX + r * 0.14, stoneY + r * 0.22, r * 1.05, ctx);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.fill();
  
  buildStonePath(stoneX + r * 0.07, stoneY + r * 0.11, r, ctx);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fill();
  ctx.restore();
  
  // Rock
  drawRock(ctx, stoneX, stoneY, r, cosT, sinT);
  
  // Strokes
  if (strokes.length > 0 || currentStroke.length > 1) {
    drawStrokesOnStone(ctx, stoneX, stoneY, r, cosT, sinT);
  }
}

// Global drawing coordinates and scale getters for render state
let stoneX = 0;
let stoneY = 0;
let stoneScale = 0;
let stoneAngle = 0;

function updateDrawVariables() {
  stoneX = getSpringX();
  if (phase === 'waiting' || phase === 'forming') {
    stoneY = getStoneBaseY();
  } else if (phase === 'splashing') {
    stoneY = getSpringY() + screenH * 0.045 * easeOutCubic(sinkProgress);
  } else {
    stoneY = getStoneBaseY() + (getSpringY() - getStoneBaseY()) * slideCurve(slideProgress);
  }
  
  if (phase === 'waiting') {
    // 待機中はごく軽く脈動（±1.0%・既存の pulseT を流用）。無機物が呼吸して
    // 見えると不気味なので、振幅は 1% を超えないこと。
    stoneScale = formProgress * (1.0 + Math.sin(pulseT * 2.0) * 0.010);
  } else if (phase === 'forming') {
    stoneScale = formProgress;
  } else if (phase === 'splashing') {
    stoneScale = Math.max(0.0, Math.min(1.0, 0.08 * (1.0 - easeOutCubic(sinkProgress))));
  } else {
    stoneScale = Math.max(0.0, Math.min(1.0, 1.0 - slideCurve(slideProgress) * 0.92));
  }
  
  if (phase === 'sliding') {
    stoneAngle = -slideCurve(slideProgress) * Math.PI * 3.0;
  } else if (phase === 'splashing') {
    stoneAngle = -Math.PI * 3.0 - sinkProgress * Math.PI * 0.20;
  } else {
    stoneAngle = 0;
  }
}

// --- Impact Ring Flash (big explosion) ---
function drawImpactRing(ctx) {
  if (impactT < 0 || impactT > 1.0) return;
  const cx = getSpringX();
  const cy = getSpringY();
  const maxR = screenW * 0.65;
  const r = maxR * easeOutCubic(impactT);
  const opacity = Math.max(0.0, Math.min(1.0, (1.0 - impactT) * 1.4));
  if (opacity <= 0 || r <= 0) return;
  
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, 2 * Math.PI);
  const hue = (impactT * 120 + 30) % 360;
  ctx.strokeStyle = `hsla(${hue}, 100%, 72%, ${opacity})`;
  ctx.lineWidth = Math.max(1.0, (1.0 - impactT) * screenW * 0.06);
  ctx.stroke();
  ctx.restore();
}

// --- Main Canvas Painting Pipeline ---
function paint(ctx) {
  ctx.clearRect(0, 0, screenW, screenH);
  
  updateDrawVariables();
  
  drawCaveBase(ctx);
  drawSpring(ctx);
  drawRipples(ctx);
  drawCaveLight(ctx);
  
  drawExplosionColumn(ctx);
  drawCrown(ctx);
  
  drawStalactitesBg(ctx);
  drawStalagmitesBg(ctx);
  
  if (phase !== 'settling' && phase !== 'popup') {
    drawStone(ctx);
  }
  
  drawWaterParticles(ctx);
  drawParticles(ctx);
  drawImpactRing(ctx);
  
  drawStalactites(ctx);
  drawStalagmites(ctx);
}

// --- Game Logic Loop (Ticks) ---
let lastTime = 0;
function tick(timestamp) {
  if (!lastTime) lastTime = timestamp;
  let dt = (timestamp - lastTime) / 1000.0;
  lastTime = timestamp;
  
  if (dt <= 0) {
    requestAnimationFrame(tick);
    return;
  }
  if (dt > 0.1) dt = 0.1; // clamp dt spikes
  
  lakeT += dt;
  pulseT += dt;
  caveLight = Math.max(0.0, Math.min(1.0, caveLight - dt / 3.0));
  
  if (rippleT >= 0) {
    rippleT += dt;
    if (rippleT > 1.8) rippleT = -1.0;
  }
  
  switch (phase) {
    case 'forming':
      formProgress = Math.min(1.0, Math.max(0.0, formProgress + dt / 2.5));
      if (formProgress >= 1.0) phase = 'waiting';
      break;
      
    case 'waiting':
      break;
      
    case 'sliding':
      slideProgress = Math.min(1.0, Math.max(0.0, slideProgress + dt / 5.0));
      if (slideProgress >= 1.0) triggerSplash();
      break;
      
    case 'splashing':
      if (sinkProgress < 1.0) {
        sinkProgress = Math.min(1.0, Math.max(0.0, sinkProgress + dt / 0.3));
      }
      
      // Update water splash particles
      for (let i = waterParticles.length - 1; i >= 0; i--) {
        const p = waterParticles[i];
        p.x += p.vx * dt * 60;
        p.y += p.vy * dt * 60;
        p.vy += 9.0 * dt;
        p.life -= dt * p.decay;
        if (p.life <= 0) {
          waterParticles.splice(i, 1);
        }
      }
      
      splashTimer += dt;
      
      // Trigger color explosion overlay
      if (!rainbowEmitted && splashTimer >= 1.5) {
        rainbowEmitted = true;
        if (purificationMode === 1) {
          caveLight = 0.0;
          explosionActive = true;
          explosionTimer = 0.0;
          playDivine();
        } else if (purificationMode === 2) {
          caveLight = 1.0;
          impactT = 0.0;
          emitParticles({ superIntense: true });
          playBigExplosion();
          vibrateBigExplosion();
        } else {
          caveLight = 1.0;
          emitParticles({ intense: true });
          playExplosion();
          vibrateExplosion();
        }
      }
      
      // Big explosion second wave
      if (purificationMode === 2 && rainbowEmitted && !bigExplosionWave2 && splashTimer >= 2.1) {
        bigExplosionWave2 = true;
        emitParticles({ superIntense: true, additive: true });
        vibrateExplosion();
      }
      
      // Update columns
      if (explosionActive) {
        explosionTimer = Math.min(5.25, Math.max(0.0, explosionTimer + dt));
        if (explosionTimer < 3.75) {
          emitColumnSpray(dt);
          if (explosionTimer < 3.25) emitFountainRing(dt);
        }
        if (!crownSoundPlayed && explosionTimer >= 3.75) {
          crownSoundPlayed = true;
          playCrownFizz();
        }
        if (explosionTimer >= 5.25) explosionActive = false;
      }
      
      // Update standard rainbow particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt * 60;
        p.y += p.vy * dt * 60;
        p.vy += 3.5 * dt;
        p.vx *= 0.994;
        p.life -= dt * p.decay;
        if (p.life <= 0) {
          particles.splice(i, 1);
        }
      }
      
      if (impactT >= 0) {
        impactT = Math.min(1.0, Math.max(0.0, impactT + dt / 0.45));
        if (impactT >= 1.0) impactT = -1.0;
      }
      
      const purificationDone = purificationMode === 1 ? (!explosionActive && rainbowEmitted) : (particles.length === 0 && rainbowEmitted);
      const waterDone = purificationMode === 1 ? true : (waterParticles.length === 0);
      
      if (sinkProgress >= 1.0 && waterDone && caveLight <= 0 && purificationDone) {
        phase = 'settling';
        settleTimer = 0.0;
      }
      break;
      
    case 'settling':
      settleTimer += dt;
      if (settleTimer >= settleDelay) {
        dropCount++;
        let shouldShow = false;
        if (throwTimes.length >= 50) {
          const firstThrow = throwTimes[throwTimes.length - 50];
          const lastThrow = throwTimes[throwTimes.length - 1];
          if (lastThrow - firstThrow <= 30 * 60 * 1000) { // 30 minutes in ms
            shouldShow = true;
          }
        }
        
        if (shouldShow) {
          phase = 'popup';
          dropCount = 0;
          throwTimes.length = 0;
          showPopupView();
        } else {
          startForming();
        }
      }
      break;
      
    case 'popup':
      break;
  }
  
  paint(ctx);
  syncDrawingOverlays();
  requestAnimationFrame(tick);
}

// --- Gesture Handlers & Double Tap ---
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('app-container');

function resizeCanvas() {
  const rect = container.getBoundingClientRect();
  screenW = rect.width;
  screenH = rect.height;
  
  const dpr = window.devicePixelRatio || 1;
  canvas.width = screenW * dpr;
  canvas.height = screenH * dpr;
  ctx.resetTransform();
  ctx.scale(dpr, dpr);
  paint(ctx);
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function isOnStone(x, y) {
  if (phase !== 'waiting') return false;
  const dx = x - getSpringX();
  const dy = y - getStoneBaseY();
  const r = screenW * (drawingMode ? 0.38 : 0.22);
  return (dx * dx + dy * dy) < (r * r);
}

// Double tap detection state
let lastTap = 0;
let dragStart = null;
let dragCurrent = null;

function handleInteractionStart(x, y) {
  initAudio(); // triggers audio context unlock
  if (drawingMode) {
    if (phase === 'waiting') {
      currentStroke = [toStoneLocal(x, y)];
    }
  } else {
    if (isOnStone(x, y)) {
      dragStart = { x, y };
    }
  }
}

function handleInteractionMove(x, y) {
  if (drawingMode) {
    if (currentStroke.length > 0) {
      const pt = toStoneLocal(x, y);
      const last = currentStroke[currentStroke.length - 1];
      const dist = Math.hypot(pt.x - last.x, pt.y - last.y);
      if (dist > 0.015) {
        currentStroke.push(pt);
      }
    }
  } else {
    if (dragStart) {
      dragCurrent = { x, y };
    }
  }
}

function handleInteractionEnd() {
  if (drawingMode) {
    if (currentStroke.length > 1) {
      strokes.push([...currentStroke]);
    }
    currentStroke = [];
  } else {
    if (dragStart && dragCurrent) {
      const dy = dragStart.y - dragCurrent.y;
      if (dy > 15) {
        vibrateTap();
        startSliding();
      }
      dragStart = null;
      dragCurrent = null;
    }
  }
}

function handleInteractionTap(x, y) {
  const now = Date.now();
  const diff = now - lastTap;
  lastTap = now;
  
  if (diff < 250) {
    // Double tap triggers in drawing mode
    if (drawingMode && phase === 'waiting') {
      throwDrawing();
    }
  } else {
    // Single tap triggers slide in normal mode
    if (!drawingMode && isOnStone(x, y)) {
      vibrateTap();
      setTimeout(() => {
        if (phase === 'waiting') {
          startSliding();
        }
      }, 60);
    }
  }
}

// Setup canvas inputs listeners
canvas.addEventListener('mousedown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  handleInteractionStart(x, y);
});

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  handleInteractionMove(x, y);
});

canvas.addEventListener('mouseup', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  handleInteractionEnd();
  handleInteractionTap(x, y);
});

// Touch events listeners
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const touch = e.touches[0];
  const x = touch.clientX - rect.left;
  const y = touch.clientY - rect.top;
  handleInteractionStart(x, y);
});

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const touch = e.touches[0];
  const x = touch.clientX - rect.left;
  const y = touch.clientY - rect.top;
  handleInteractionMove(x, y);
});

canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  handleInteractionEnd();
  if (e.changedTouches.length > 0) {
    const rect = canvas.getBoundingClientRect();
    const touch = e.changedTouches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    handleInteractionTap(x, y);
  }
});

// --- UI Localizations（そよぎ標準14言語・Flutter版 i18n.dart から一字一句移植）---
// 言語メタ情報（コード・ネイティブ表記名・RTLフラグ）。ar のみ RTL。
const kLangs = [
  { code: 'ja', native: '日本語',            rtl: false },
  { code: 'en', native: 'English',           rtl: false },
  { code: 'ar', native: 'العربية',            rtl: true  },
  { code: 'bn', native: 'বাংলা',              rtl: false },
  { code: 'de', native: 'Deutsch',           rtl: false },
  { code: 'es', native: 'Español',           rtl: false },
  { code: 'fr', native: 'Français',          rtl: false },
  { code: 'hi', native: 'हिन्दी',              rtl: false },
  { code: 'id', native: 'Bahasa Indonesia',  rtl: false },
  { code: 'it', native: 'Italiano',          rtl: false },
  { code: 'ko', native: '한국어',             rtl: false },
  { code: 'pt', native: 'Português',         rtl: false },
  { code: 'ru', native: 'Русский',           rtl: false },
  { code: 'zh', native: '中文',               rtl: false }
];

function isRtlLang(code) {
  const l = kLangs.find(x => x.code === code);
  return l ? l.rtl : false;
}

// 翻訳テーブル（ja=シェルター誘導キーのみ／非ja=ホットラインキーのみ。tr() が en へフォールバック）
const kStrings = {
  ja: {
    'app.title': '黒い石',
    'stone.drawHint': '岩になぞって書いて　ダブルタップで投げる',
    'stone.throw': 'なげる',
    'stone.consult': '🌿 福祉の相談ができます → そよぎHP',
    'stone.firstHint': 'さわってみて',
    'settings.language': '言語',
    'settings.sound': '音',
    'settings.vibration': '振動',
    'settings.drawingMode': '落書きモード',
    'settings.drawingOn': '岩になぞって書いて、ダブルタップで投げる',
    'settings.drawingOff': '触れるとすぐに滑り出す',
    'settings.effectDesc': '岩が沈んだあとの浄化演出を選べます',
    'settings.aboutTitle': '🌿 そよぎについて',
    'settings.aboutSub': '介護と支援の相談どころ そよぎ',
    'settings.website': '🌐 そよぎ ホームページ',
    'settings.effect': '浄化演出',
    'settings.effectPurify': '浄化',
    'settings.effectBurst': '爆発',
    'settings.effectBigBurst': '大爆発',
    'settings.volume': '音量',
    'settings.volumeLow': '小さく',
    'settings.volumeMed': 'ふつう',
    'settings.volumeHigh': 'おおきく',
    'shelter.title': 'そんなに連続で投げてお疲れになりませんか？',
    'shelter.shelterBody': 'もしもあなたが辛くて辛くてどうしようもないという状況であれば、とても静かなメタバース空間デジタルシェルターそよぎにいらしてみませんか？',
    'shelter.gotoShelter': '🔥 シェルターに行ってみる',
    'shelter.notNow': '今はいかない'
  },
  en: {
    'app.title': 'Black Stone',
    'stone.drawHint': 'Trace on the stone to draw, then double-tap to throw',
    'stone.throw': 'Throw',
    'stone.consult': '🌿 Consultation for support & care -> Soyogi HP',
    'stone.firstHint': 'Try touching',
    'settings.language': 'Language',
    'settings.sound': 'Sound',
    'settings.vibration': 'Vibration',
    'settings.drawingMode': 'Drawing Mode',
    'settings.drawingOn': 'Draw on the stone and double-tap to throw',
    'settings.drawingOff': 'Touch to let it slide away',
    'settings.effectDesc': 'Choose the effect after the stone sinks',
    'settings.aboutTitle': '🌿 About Soyogi',
    'settings.aboutSub': 'Soyogi — Care & Support',
    'settings.website': '🌐 Soyogi Website (Japanese Only)',
    'settings.effect': 'Effect',
    'settings.effectPurify': 'Purify',
    'settings.effectBurst': 'Burst',
    'settings.effectBigBurst': 'Big Burst',
    'settings.volume': 'Volume',
    'settings.volumeLow': 'Low',
    'settings.volumeMed': 'Med',
    'settings.volumeHigh': 'High',
    'shelter.title': "You've been throwing a lot. Are you doing okay?",
    'shelter.hotlineIntro': "If you've been going through a very difficult time, why not try talking to a trusted friend, family member, or one of these hotlines?",
    'shelter.restNote': "And it's okay to set this down and rest for a while.",
    'shelter.moreCountries': 'More countries →',
    'shelter.imOkay': "I'm okay for now"
  },
  ar: {
    'app.title': 'الحجر الداكن',
    'stone.drawHint': 'ارسم على الحجر ثم انقر نقرًا مزدوجًا لرميه',
    'stone.throw': 'ارمِ',
    'stone.consult': '🌿 استشارات الرعاية والدعم ← موقع Soyogi',
    'stone.firstHint': 'جرّب أن تلمسه',
    'settings.language': 'اللغة',
    'settings.sound': 'الصوت',
    'settings.vibration': 'الاهتزاز',
    'settings.drawingMode': 'وضع الرسم',
    'settings.drawingOn': 'ارسم على الحجر وانقر نقرًا مزدوجًا لرميه',
    'settings.drawingOff': 'عند اللمس ينزلق فورًا',
    'settings.effectDesc': 'اختر التأثير بعد غرق الحجر',
    'settings.aboutTitle': '🌿 عن Soyogi',
    'settings.aboutSub': 'Soyogi للاستشارات في الرعاية والدعم',
    'settings.website': '🌐 موقع Soyogi (باليابانية فقط)',
    'settings.effect': 'التأثير',
    'settings.effectPurify': 'تطهير',
    'settings.effectBurst': 'انفجار',
    'settings.effectBigBurst': 'انفجار كبير',
    'settings.volume': 'مستوى الصوت',
    'settings.volumeLow': 'منخفض',
    'settings.volumeMed': 'متوسط',
    'settings.volumeHigh': 'مرتفع',
    'shelter.title': 'لقد رميتَ الكثير من الأحجار. هل أنت بخير؟',
    'shelter.hotlineIntro': 'إذا كنت تمر بوقت صعب جدًا، لمَ لا تتحدث مع شخص تثق به أو مع أحد خطوط المساعدة هذه؟',
    'shelter.restNote': 'ولا بأس أن تترك هذا جانبًا وترتاح قليلًا.',
    'shelter.moreCountries': 'دول أخرى ←',
    'shelter.imOkay': 'أنا بخير الآن'
  },
  bn: {
    'app.title': 'কালো পাথর',
    'stone.drawHint': 'পাথরের উপর আঙুলে লিখুন, তারপর ডাবল ট্যাপ করে ছুড়ে দিন',
    'stone.throw': 'ছুড়ে দিন',
    'stone.consult': '🌿 যত্ন ও সহায়তার পরামর্শ → Soyogi ওয়েবসাইট',
    'stone.firstHint': 'ছুঁয়ে দেখুন',
    'settings.language': 'ভাষা',
    'settings.sound': 'শব্দ',
    'settings.vibration': 'কম্পন',
    'settings.drawingMode': 'আঁকার মোড',
    'settings.drawingOn': 'পাথরে আঁকুন, ডাবল ট্যাপ করে ছুড়ে দিন',
    'settings.drawingOff': 'ছুঁলেই সাথে সাথে গড়িয়ে যায়',
    'settings.effectDesc': 'পাথর ডুবে যাওয়ার পরের এফেক্ট বেছে নিন',
    'settings.aboutTitle': '🌿 Soyogi সম্পর্কে',
    'settings.aboutSub': 'যত্ন ও সহায়তা পরামর্শ কেন্দ্র Soyogi',
    'settings.website': '🌐 Soyogi ওয়েবসাইট (শুধু জাপানি ভাষায়)',
    'settings.effect': 'এফেক্ট',
    'settings.effectPurify': 'শুদ্ধি',
    'settings.effectBurst': 'বিস্ফোরণ',
    'settings.effectBigBurst': 'বড় বিস্ফোরণ',
    'settings.volume': 'ভলিউম',
    'settings.volumeLow': 'কম',
    'settings.volumeMed': 'মাঝারি',
    'settings.volumeHigh': 'বেশি',
    'shelter.title': 'আপনি অনেক পাথর ছুড়েছেন। আপনি কি ঠিক আছেন?',
    'shelter.hotlineIntro': 'যদি খুব কঠিন সময়ের মধ্য দিয়ে যাচ্ছেন, তাহলে বিশ্বাসের কাউকে বা এই হেল্পলাইনগুলোর কোনোটিতে কথা বলে দেখুন না?',
    'shelter.restNote': 'আর এটা রেখে কিছুক্ষণ বিশ্রাম নিলেও কোনো ক্ষতি নেই।',
    'shelter.moreCountries': 'আরও দেশ →',
    'shelter.imOkay': 'এখন আমি ঠিক আছি'
  },
  de: {
    'app.title': 'Schwarzer Stein',
    'stone.drawHint': 'Zeichne auf den Stein und wirf ihn mit Doppeltipp',
    'stone.throw': 'Werfen',
    'stone.consult': '🌿 Beratung zu Pflege & Unterstützung → Soyogi',
    'stone.firstHint': 'Berühre den Stein',
    'settings.language': 'Sprache',
    'settings.sound': 'Ton',
    'settings.vibration': 'Vibration',
    'settings.drawingMode': 'Kritzelmodus',
    'settings.drawingOn': 'Auf den Stein zeichnen und mit Doppeltipp werfen',
    'settings.drawingOff': 'Beim Berühren gleitet er sofort davon',
    'settings.effectDesc': 'Wähle den Effekt, nachdem der Stein versinkt',
    'settings.aboutTitle': '🌿 Über Soyogi',
    'settings.aboutSub': 'Soyogi – Beratung für Pflege und Unterstützung',
    'settings.website': '🌐 Soyogi-Website (nur Japanisch)',
    'settings.effect': 'Effekt',
    'settings.effectPurify': 'Reinigung',
    'settings.effectBurst': 'Explosion',
    'settings.effectBigBurst': 'Große Explosion',
    'settings.volume': 'Lautstärke',
    'settings.volumeLow': 'Leise',
    'settings.volumeMed': 'Mittel',
    'settings.volumeHigh': 'Laut',
    'shelter.title': 'Du hast sehr viele Steine geworfen. Geht es dir gut?',
    'shelter.hotlineIntro': 'Wenn du gerade eine sehr schwere Zeit durchmachst, sprich doch mit einem vertrauten Menschen oder einer dieser Hotlines.',
    'shelter.restNote': 'Und es ist okay, jetzt eine Pause zu machen.',
    'shelter.moreCountries': 'Weitere Länder →',
    'shelter.imOkay': 'Mir geht es gerade okay'
  },
  es: {
    'app.title': 'Piedra Negra',
    'stone.drawHint': 'Dibuja sobre la piedra y lánzala con doble toque',
    'stone.throw': 'Lanzar',
    'stone.consult': '🌿 Consultas de cuidado y apoyo → Soyogi',
    'stone.firstHint': 'Prueba a tocarla',
    'settings.language': 'Idioma',
    'settings.sound': 'Sonido',
    'settings.vibration': 'Vibración',
    'settings.drawingMode': 'Modo dibujo',
    'settings.drawingOn': 'Dibuja sobre la piedra y lánzala con doble toque',
    'settings.drawingOff': 'Al tocarla, se desliza enseguida',
    'settings.effectDesc': 'Elige el efecto tras hundirse la piedra',
    'settings.aboutTitle': '🌿 Sobre Soyogi',
    'settings.aboutSub': 'Soyogi: consultas de cuidado y apoyo',
    'settings.website': '🌐 Sitio web de Soyogi (solo en japonés)',
    'settings.effect': 'Efecto',
    'settings.effectPurify': 'Purificación',
    'settings.effectBurst': 'Explosión',
    'settings.effectBigBurst': 'Gran explosión',
    'settings.volume': 'Volumen',
    'settings.volumeLow': 'Bajo',
    'settings.volumeMed': 'Medio',
    'settings.volumeHigh': 'Alto',
    'shelter.title': 'Has lanzado muchas piedras. ¿Estás bien?',
    'shelter.hotlineIntro': 'Si estás pasando por un momento muy difícil, ¿por qué no hablas con alguien de confianza o con una de estas líneas de ayuda?',
    'shelter.restNote': 'Y está bien dejar esto a un lado y descansar un rato.',
    'shelter.moreCountries': 'Más países →',
    'shelter.imOkay': 'Por ahora estoy bien'
  },
  fr: {
    'app.title': 'Pierre Noire',
    'stone.drawHint': "Dessine sur la pierre, puis lance-la d'un double tap",
    'stone.throw': 'Lancer',
    'stone.consult': '🌿 Conseils en soin et soutien → Soyogi',
    'stone.firstHint': 'Essaie de la toucher',
    'settings.language': 'Langue',
    'settings.sound': 'Son',
    'settings.vibration': 'Vibration',
    'settings.drawingMode': 'Mode dessin',
    'settings.drawingOn': "Dessine sur la pierre et lance-la d'un double tap",
    'settings.drawingOff': 'Au toucher, elle glisse aussitôt',
    'settings.effectDesc': "Choisis l'effet après que la pierre a coulé",
    'settings.aboutTitle': '🌿 À propos de Soyogi',
    'settings.aboutSub': 'Soyogi – Conseils en soin et soutien',
    'settings.website': '🌐 Site web de Soyogi (en japonais)',
    'settings.effect': 'Effet',
    'settings.effectPurify': 'Purification',
    'settings.effectBurst': 'Explosion',
    'settings.effectBigBurst': 'Grande explosion',
    'settings.volume': 'Volume',
    'settings.volumeLow': 'Faible',
    'settings.volumeMed': 'Moyen',
    'settings.volumeHigh': 'Fort',
    'shelter.title': 'Tu as lancé beaucoup de pierres. Ça va ?',
    'shelter.hotlineIntro': "Si tu traverses une période très difficile, pourquoi ne pas en parler à une personne de confiance ou à l'une de ces lignes d'écoute ?",
    'shelter.restNote': "Et c'est normal de poser tout ça et de te reposer un peu.",
    'shelter.moreCountries': 'Autres pays →',
    'shelter.imOkay': "Ça va pour l'instant"
  },
  hi: {
    'app.title': 'काला पत्थर',
    'stone.drawHint': 'पत्थर पर उँगली से लिखिए, फिर दो बार टैप करके फेंकिए',
    'stone.throw': 'फेंकें',
    'stone.consult': '🌿 देखभाल और सहायता की सलाह → Soyogi वेबसाइट',
    'stone.firstHint': 'छूकर देखिए',
    'settings.language': 'भाषा',
    'settings.sound': 'ध्वनि',
    'settings.vibration': 'कंपन',
    'settings.drawingMode': 'चित्र मोड',
    'settings.drawingOn': 'पत्थर पर लिखिए और दो बार टैप करके फेंकिए',
    'settings.drawingOff': 'छूते ही यह तुरंत फिसल जाता है',
    'settings.effectDesc': 'पत्थर डूबने के बाद का प्रभाव चुनिए',
    'settings.aboutTitle': '🌿 Soyogi के बारे में',
    'settings.aboutSub': 'देखभाल और सहायता परामर्श केंद्र Soyogi',
    'settings.website': '🌐 Soyogi वेबसाइट (केवल जापानी में)',
    'settings.effect': 'प्रभाव',
    'settings.effectPurify': 'शुद्धि',
    'settings.effectBurst': 'विस्फोट',
    'settings.effectBigBurst': 'महाविस्फोट',
    'settings.volume': 'आवाज़',
    'settings.volumeLow': 'धीमी',
    'settings.volumeMed': 'मध्यम',
    'settings.volumeHigh': 'तेज़',
    'shelter.title': 'आपने बहुत सारे पत्थर फेंके हैं। क्या आप ठीक हैं?',
    'shelter.hotlineIntro': 'अगर आप बहुत कठिन समय से गुज़र रहे हैं, तो किसी भरोसेमंद व्यक्ति से या इनमें से किसी हेल्पलाइन पर बात कर लीजिए।',
    'shelter.restNote': 'और इसे थोड़ी देर छोड़कर आराम करना भी ठीक है।',
    'shelter.moreCountries': 'और देश →',
    'shelter.imOkay': 'अभी मैं ठीक हूँ'
  },
  id: {
    'app.title': 'Batu Hitam',
    'stone.drawHint': 'Coret-coret di batu, lalu ketuk dua kali untuk melempar',
    'stone.throw': 'Lempar',
    'stone.consult': '🌿 Konsultasi perawatan & dukungan → Situs Soyogi',
    'stone.firstHint': 'Coba sentuh',
    'settings.language': 'Bahasa',
    'settings.sound': 'Suara',
    'settings.vibration': 'Getaran',
    'settings.drawingMode': 'Mode corat-coret',
    'settings.drawingOn': 'Gambar di batu, lalu ketuk dua kali untuk melempar',
    'settings.drawingOff': 'Saat disentuh, batu langsung meluncur',
    'settings.effectDesc': 'Pilih efek setelah batu tenggelam',
    'settings.aboutTitle': '🌿 Tentang Soyogi',
    'settings.aboutSub': 'Soyogi – Konsultasi perawatan dan dukungan',
    'settings.website': '🌐 Situs Soyogi (hanya bahasa Jepang)',
    'settings.effect': 'Efek',
    'settings.effectPurify': 'Pemurnian',
    'settings.effectBurst': 'Ledakan',
    'settings.effectBigBurst': 'Ledakan besar',
    'settings.volume': 'Volume',
    'settings.volumeLow': 'Pelan',
    'settings.volumeMed': 'Sedang',
    'settings.volumeHigh': 'Keras',
    'shelter.title': 'Kamu sudah melempar banyak batu. Kamu baik-baik saja?',
    'shelter.hotlineIntro': 'Kalau kamu sedang melewati masa yang sangat berat, coba bicara dengan orang yang kamu percaya atau salah satu hotline berikut ini.',
    'shelter.restNote': 'Dan tidak apa-apa meletakkan ini dulu dan beristirahat sejenak.',
    'shelter.moreCountries': 'Negara lain →',
    'shelter.imOkay': 'Untuk saat ini aku baik-baik saja'
  },
  it: {
    'app.title': 'Pietra Nera',
    'stone.drawHint': 'Disegna sulla pietra e lanciala con un doppio tocco',
    'stone.throw': 'Lancia',
    'stone.consult': '🌿 Consulenza su cura e sostegno → Soyogi',
    'stone.firstHint': 'Prova a toccarla',
    'settings.language': 'Lingua',
    'settings.sound': 'Suono',
    'settings.vibration': 'Vibrazione',
    'settings.drawingMode': 'Modalità disegno',
    'settings.drawingOn': 'Disegna sulla pietra e lanciala con un doppio tocco',
    'settings.drawingOff': 'Al tocco scivola subito via',
    'settings.effectDesc': "Scegli l'effetto dopo che la pietra affonda",
    'settings.aboutTitle': '🌿 Su Soyogi',
    'settings.aboutSub': 'Soyogi – Consulenza su cura e sostegno',
    'settings.website': '🌐 Sito web di Soyogi (solo in giapponese)',
    'settings.effect': 'Effetto',
    'settings.effectPurify': 'Purificazione',
    'settings.effectBurst': 'Esplosione',
    'settings.effectBigBurst': 'Grande esplosione',
    'settings.volume': 'Volume',
    'settings.volumeLow': 'Basso',
    'settings.volumeMed': 'Medio',
    'settings.volumeHigh': 'Alto',
    'shelter.title': 'Hai lanciato molte pietre. Stai bene?',
    'shelter.hotlineIntro': 'Se stai attraversando un momento molto difficile, perché non parlarne con una persona di fiducia o con una di queste linee di ascolto?',
    'shelter.restNote': "E va bene anche mettere giù tutto e riposarti un po'.",
    'shelter.moreCountries': 'Altri paesi →',
    'shelter.imOkay': 'Per ora sto bene'
  },
  ko: {
    'app.title': '검은 돌',
    'stone.drawHint': '돌에 손가락으로 그리고, 두 번 탭해서 던지세요',
    'stone.throw': '던지기',
    'stone.consult': '🌿 돌봄과 지원 상담 → Soyogi 홈페이지',
    'stone.firstHint': '살짝 만져 보세요',
    'settings.language': '언어',
    'settings.sound': '소리',
    'settings.vibration': '진동',
    'settings.drawingMode': '낙서 모드',
    'settings.drawingOn': '돌에 그림을 그리고 두 번 탭해서 던지기',
    'settings.drawingOff': '건드리면 바로 미끄러져 내려가요',
    'settings.effectDesc': '돌이 가라앉은 뒤의 정화 연출을 고를 수 있어요',
    'settings.aboutTitle': '🌿 Soyogi 소개',
    'settings.aboutSub': '돌봄과 지원 상담소 Soyogi',
    'settings.website': '🌐 Soyogi 홈페이지 (일본어)',
    'settings.effect': '정화 연출',
    'settings.effectPurify': '정화',
    'settings.effectBurst': '폭발',
    'settings.effectBigBurst': '대폭발',
    'settings.volume': '음량',
    'settings.volumeLow': '작게',
    'settings.volumeMed': '보통',
    'settings.volumeHigh': '크게',
    'shelter.title': '돌을 많이 던지고 있네요. 괜찮으신가요?',
    'shelter.hotlineIntro': '지금 너무 힘든 시간을 보내고 있다면, 믿을 수 있는 사람이나 이런 상담 전화에 이야기해 보는 건 어떨까요?',
    'shelter.restNote': '잠시 내려놓고 쉬어도 괜찮아요.',
    'shelter.moreCountries': '다른 나라 →',
    'shelter.imOkay': '지금은 괜찮아요'
  },
  pt: {
    'app.title': 'Pedra Negra',
    'stone.drawHint': 'Desenhe na pedra e lance com um toque duplo',
    'stone.throw': 'Lançar',
    'stone.consult': '🌿 Consultas de cuidado e apoio → Soyogi',
    'stone.firstHint': 'Experimente tocar',
    'settings.language': 'Idioma',
    'settings.sound': 'Som',
    'settings.vibration': 'Vibração',
    'settings.drawingMode': 'Modo desenho',
    'settings.drawingOn': 'Desenhe na pedra e lance com um toque duplo',
    'settings.drawingOff': 'Ao tocar, ela desliza logo',
    'settings.effectDesc': 'Escolha o efeito depois que a pedra afundar',
    'settings.aboutTitle': '🌿 Sobre a Soyogi',
    'settings.aboutSub': 'Soyogi – Consultas de cuidado e apoio',
    'settings.website': '🌐 Site da Soyogi (somente em japonês)',
    'settings.effect': 'Efeito',
    'settings.effectPurify': 'Purificação',
    'settings.effectBurst': 'Explosão',
    'settings.effectBigBurst': 'Grande explosão',
    'settings.volume': 'Volume',
    'settings.volumeLow': 'Baixo',
    'settings.volumeMed': 'Médio',
    'settings.volumeHigh': 'Alto',
    'shelter.title': 'Você lançou muitas pedras. Você está bem?',
    'shelter.hotlineIntro': 'Se você está passando por um momento muito difícil, que tal conversar com alguém de confiança ou com uma destas linhas de apoio?',
    'shelter.restNote': 'E tudo bem deixar isso de lado e descansar um pouco.',
    'shelter.moreCountries': 'Mais países →',
    'shelter.imOkay': 'Por enquanto estou bem'
  },
  ru: {
    'app.title': 'Чёрный камень',
    'stone.drawHint': 'Нарисуй на камне и брось его двойным касанием',
    'stone.throw': 'Бросить',
    'stone.consult': '🌿 Консультации по уходу и поддержке → Soyogi',
    'stone.firstHint': 'Попробуй прикоснуться',
    'settings.language': 'Язык',
    'settings.sound': 'Звук',
    'settings.vibration': 'Вибрация',
    'settings.drawingMode': 'Режим рисования',
    'settings.drawingOn': 'Нарисуй на камне и брось его двойным касанием',
    'settings.drawingOff': 'От прикосновения камень сразу катится',
    'settings.effectDesc': 'Выбери эффект после погружения камня',
    'settings.aboutTitle': '🌿 О Soyogi',
    'settings.aboutSub': 'Soyogi – консультации по уходу и поддержке',
    'settings.website': '🌐 Сайт Soyogi (только на японском)',
    'settings.effect': 'Эффект',
    'settings.effectPurify': 'Очищение',
    'settings.effectBurst': 'Взрыв',
    'settings.effectBigBurst': 'Большой взрыв',
    'settings.volume': 'Громкость',
    'settings.volumeLow': 'Тихо',
    'settings.volumeMed': 'Средне',
    'settings.volumeHigh': 'Громко',
    'shelter.title': 'Ты бросаешь камни один за другим. Всё в порядке?',
    'shelter.hotlineIntro': 'Если тебе сейчас очень тяжело, поговори с близким человеком или позвони на одну из этих линий помощи.',
    'shelter.restNote': 'И это нормально: отложить всё и немного отдохнуть.',
    'shelter.moreCountries': 'Другие страны →',
    'shelter.imOkay': 'Сейчас всё в порядке'
  },
  zh: {
    'app.title': '黑色石头',
    'stone.drawHint': '在石头上写写画画，双击把它扔出去',
    'stone.throw': '扔出去',
    'stone.consult': '🌿 可以咨询照护与支援 → Soyogi 主页',
    'stone.firstHint': '碰碰看',
    'settings.language': '语言',
    'settings.sound': '声音',
    'settings.vibration': '振动',
    'settings.drawingMode': '涂鸦模式',
    'settings.drawingOn': '在石头上写画，双击扔出去',
    'settings.drawingOff': '一碰就立刻滑走',
    'settings.effectDesc': '选择石头沉下去之后的净化效果',
    'settings.aboutTitle': '🌿 关于 Soyogi',
    'settings.aboutSub': '照护与支援咨询处 Soyogi',
    'settings.website': '🌐 Soyogi 主页（仅日语）',
    'settings.effect': '净化效果',
    'settings.effectPurify': '净化',
    'settings.effectBurst': '爆炸',
    'settings.effectBigBurst': '大爆炸',
    'settings.volume': '音量',
    'settings.volumeLow': '小声',
    'settings.volumeMed': '适中',
    'settings.volumeHigh': '大声',
    'shelter.title': '你扔了好多石头。还好吗？',
    'shelter.hotlineIntro': '如果你正经历特别难熬的时刻，要不要和信任的人聊聊，或拨打下面这些热线？',
    'shelter.restNote': '把它放下，休息一会儿也没关系。',
    'shelter.moreCountries': '更多国家 →',
    'shelter.imOkay': '我现在还好'
  }
};

// 現在言語でキーを引く。無ければ en → キー名の順にフォールバック。
function tr(key) {
  const cur = kStrings[lang];
  if (cur && cur[key] != null) return cur[key];
  const en = kStrings['en'][key];
  if (en != null) return en;
  return key;
}

// 言語チップ（14言語）を動的生成。既存の JP/EN 2択を置き換える。
const langChips = {};
(function buildLangChips() {
  const group = document.getElementById('lang-chip-group');
  if (!group) return;
  kLangs.forEach((l) => {
    const btn = document.createElement('button');
    btn.className = 'chip';
    btn.textContent = l.native;
    btn.addEventListener('click', () => {
      lang = l.code;
      saveSetting(STORAGE_KEYS.lang, lang);
      updateLocalization();
      updateSettingsUI();
    });
    langChips[l.code] = btn;
    group.appendChild(btn);
  });
})();

function updateLocalization() {
  const isJa = lang === 'ja';

  document.getElementById('lbl-lang').textContent = tr('settings.language');
  document.getElementById('lbl-sound').textContent = tr('settings.sound');
  document.getElementById('lbl-volume').textContent = tr('settings.volume');
  document.getElementById('lbl-vibration').textContent = tr('settings.vibration');
  document.getElementById('lbl-drawing').textContent = tr('settings.drawingMode');
  document.getElementById('lbl-effect').textContent = tr('settings.effect');
  document.getElementById('hint-drawing').textContent = drawingMode ? tr('settings.drawingOn') : tr('settings.drawingOff');
  document.getElementById('hint-effect').textContent = tr('settings.effectDesc');

  document.getElementById('btn-vol-0').textContent = tr('settings.volumeLow');
  document.getElementById('btn-vol-1').textContent = tr('settings.volumeMed');
  document.getElementById('btn-vol-2').textContent = tr('settings.volumeHigh');

  // 浄化演出チップ（Flutter版に合わせて絵文字＋訳語をローカライズ）
  document.getElementById('btn-purify-1').textContent = '✨ ' + tr('settings.effectPurify');
  document.getElementById('btn-purify-0').textContent = '💥 ' + tr('settings.effectBurst');
  document.getElementById('btn-purify-2').textContent = '🔥 ' + tr('settings.effectBigBurst');

  document.getElementById('lbl-soyogi-about').textContent = tr('settings.aboutTitle');
  document.getElementById('lbl-soyogi-desc').textContent = tr('settings.aboutSub');
  document.getElementById('btn-soyogi-url').textContent = tr('settings.website');

  document.getElementById('first-hint').textContent = tr('stone.firstHint');
  document.getElementById('drawing-hint').textContent = tr('stone.drawHint');
  document.getElementById('support-banner').textContent = tr('stone.consult');
  document.getElementById('throw-btn').textContent = tr('stone.throw');

  // 連投SOSポップアップ（日本語＝シェルター誘導／非日本語＝ホットライン一覧）
  document.getElementById('shelter-txt-1').textContent = tr('shelter.title');
  if (isJa) {
    document.getElementById('shelter-txt-2-ja').textContent = tr('shelter.shelterBody');
    document.getElementById('btn-shelter-yes').textContent = tr('shelter.gotoShelter');
    document.getElementById('btn-shelter-no').textContent = tr('shelter.notNow');
  } else {
    document.getElementById('hotline-desc').textContent = tr('shelter.hotlineIntro');
    document.getElementById('shelter-restnote').textContent = tr('shelter.restNote');
    document.getElementById('btn-shelter-yes').textContent = tr('shelter.moreCountries');
    document.getElementById('btn-shelter-no').textContent = tr('shelter.imOkay');
  }

  if (isJa) {
    document.getElementById('shelter-txt-2-ja').style.display = 'block';
    document.getElementById('shelter-hotline-en').style.display = 'none';
    document.getElementById('shelter-restnote').style.display = 'none';
  } else {
    document.getElementById('shelter-txt-2-ja').style.display = 'none';
    document.getElementById('shelter-hotline-en').style.display = 'flex';
    document.getElementById('shelter-restnote').style.display = 'block';
  }

  // HTML lang/dir 属性（ar のみ RTL）
  document.documentElement.lang = lang;
  document.documentElement.dir = isRtlLang(lang) ? 'rtl' : 'ltr';
}

// --- Sync state UI switches ---
function updateSettingsUI() {
  // Sync switches values
  document.getElementById('chk-sound').checked = soundEnabled;
  document.getElementById('chk-vibration').checked = vibrationEnabled;
  document.getElementById('chk-drawing').checked = drawingMode;
  
  // Conditionally show volume controls
  document.getElementById('volume-row').style.display = soundEnabled ? 'flex' : 'none';
  
  // Set chips active state（14言語チップ）
  Object.keys(langChips).forEach((code) => {
    langChips[code].classList.toggle('active', lang === code);
  });

  document.getElementById('btn-vol-0').classList.toggle('active', soundVolume === 0);
  document.getElementById('btn-vol-1').classList.toggle('active', soundVolume === 1);
  document.getElementById('btn-vol-2').classList.toggle('active', soundVolume === 2);

  document.getElementById('btn-purify-0').classList.toggle('active', purificationMode === 0);
  document.getElementById('btn-purify-1').classList.toggle('active', purificationMode === 1);
  document.getElementById('btn-purify-2').classList.toggle('active', purificationMode === 2);
}

// 落書きモードのオーバーレイ（ヒント／なげるボタン）を毎フレーム同期する。
// 岩の状態（phase）はtick内で変わるため、更新はtickから毎フレーム呼ぶ。
const throwBtnEl = document.getElementById('throw-btn');
const drawingHintEl = document.getElementById('drawing-hint');
function syncDrawingOverlays() {
  // ヒント：落書きモード＋待機中＋ストローク0本
  const showHint = drawingMode && phase === 'waiting' && strokes.length === 0 && currentStroke.length === 0;
  drawingHintEl.style.display = showHint ? 'block' : 'none';
  // なげるボタン：落書きモード＋待機中＋ストローク1本以上
  const showThrow = drawingMode && phase === 'waiting' && (strokes.length > 0 || currentStroke.length > 1);
  throwBtnEl.style.display = showThrow ? 'flex' : 'none';
}

// Add listeners to chips and options
// 言語チップ（14言語）は buildLangChips() で動的生成＆リスナー付与済み

document.getElementById('chk-sound').addEventListener('change', (e) => {
  soundEnabled = e.target.checked;
  saveSetting(STORAGE_KEYS.sound, soundEnabled);
  initAudio();
  updateSettingsUI();
});

document.getElementById('btn-vol-0').addEventListener('click', () => { soundVolume = 0; saveSetting(STORAGE_KEYS.volume, soundVolume); updateSettingsUI(); });
document.getElementById('btn-vol-1').addEventListener('click', () => { soundVolume = 1; saveSetting(STORAGE_KEYS.volume, soundVolume); updateSettingsUI(); });
document.getElementById('btn-vol-2').addEventListener('click', () => { soundVolume = 2; saveSetting(STORAGE_KEYS.volume, soundVolume); updateSettingsUI(); });

document.getElementById('chk-vibration').addEventListener('change', (e) => {
  vibrationEnabled = e.target.checked;
  saveSetting(STORAGE_KEYS.vibration, vibrationEnabled);
  updateSettingsUI();
});

document.getElementById('chk-drawing').addEventListener('change', (e) => {
  drawingMode = e.target.checked;
  saveSetting(STORAGE_KEYS.drawing, drawingMode);
  updateSettingsUI();
  updateLocalization();
});

document.getElementById('btn-purify-0').addEventListener('click', () => { purificationMode = 0; saveSetting(STORAGE_KEYS.purification, purificationMode); updateSettingsUI(); });
document.getElementById('btn-purify-1').addEventListener('click', () => { purificationMode = 1; saveSetting(STORAGE_KEYS.purification, purificationMode); updateSettingsUI(); });
document.getElementById('btn-purify-2').addEventListener('click', () => { purificationMode = 2; saveSetting(STORAGE_KEYS.purification, purificationMode); updateSettingsUI(); });

// Settings buttons action
const settingsOverlay = document.getElementById('settings-overlay');
document.getElementById('settings-trigger').addEventListener('click', () => {
  initAudio();
  updateSettingsUI();
  settingsOverlay.classList.add('active');
});
document.getElementById('settings-close').addEventListener('click', () => {
  settingsOverlay.classList.remove('active');
  updateSettingsUI();
});

// External consult link click
// btn-soyogi-url は <a target="_blank"> に変更したのでJSハンドラ不要
document.getElementById('support-banner').addEventListener('click', () => {
  window.open('https://soyogi.hp.peraichi.com/shelter', '_blank', 'noopener');
});

// --- Popup Manager ---
function showPopupView() {
  // 連投SOS方針（2026-07-15 代表判断）：
  //   日本語のみシェルター誘導。日本語以外の全言語はホットライン表示のみ。
  const isJa = lang === 'ja';
  const shelter = document.getElementById('shelter-overlay');
  shelter.classList.add('active');

  // Reset animation classes
  document.getElementById('shelter-txt-1').classList.remove('fade-in-up');
  document.getElementById('shelter-txt-2-ja').classList.remove('fade-in-up');
  document.getElementById('shelter-hotline-en').classList.remove('fade-in-up');
  document.getElementById('shelter-restnote').classList.remove('fade-in-up');
  document.getElementById('shelter-buttons').classList.remove('fade-in-up');

  setTimeout(() => {
    document.getElementById('shelter-txt-1').classList.add('fade-in-up');
  }, 200);
  setTimeout(() => {
    if (isJa) {
      // 日本語：シェルター誘導本文
      document.getElementById('shelter-txt-2-ja').classList.add('fade-in-up');
    } else {
      // 日本語以外：ホットライン一覧＋休んでいい旨（シェルターリンクは出さない）
      document.getElementById('shelter-hotline-en').classList.add('fade-in-up');
      document.getElementById('shelter-restnote').classList.add('fade-in-up');
    }
  }, 1200);
  setTimeout(() => {
    document.getElementById('shelter-buttons').classList.add('fade-in-up');
  }, 2200);
}

// Rest Buttons Listeners
document.getElementById('btn-rest-yes').addEventListener('click', () => {
  document.getElementById('rest-active-content').style.display = 'none';
  document.getElementById('rest-exit-content').style.display = 'flex';
  // Simulate exit after 2 seconds by keeping goodbye card visible
});

document.getElementById('btn-rest-no').addEventListener('click', () => {
  // Reset animations
  document.getElementById('rest-txt-1').classList.remove('fade-in-up');
  document.getElementById('rest-txt-2').classList.remove('fade-in-up');
  document.getElementById('rest-buttons').classList.remove('fade-in-up');
  
  document.getElementById('rest-overlay').classList.remove('active');
  startForming();
});

// Shelter Buttons Listeners
document.getElementById('btn-shelter-yes').addEventListener('click', () => {
  const url = lang === 'ja' ? 'https://soyogi.hp.peraichi.com/shelter' : 'https://findahelpline.com';
  window.open(url, '_blank');
  document.getElementById('shelter-overlay').classList.remove('active');
  startForming();
});

document.getElementById('btn-shelter-no').addEventListener('click', () => {
  document.getElementById('shelter-overlay').classList.remove('active');
  startForming();
});

// 落書きモードの「なげる」ボタン（ダブルタップの代替・共存）
document.getElementById('throw-btn').addEventListener('click', throwDrawing);

// --- Startup Initialization ---
updateLocalization();
updateSettingsUI();
syncDrawingOverlays();
startForming();

// 初回ヒント：最初の1投を投げるまで表示し、初投擲でフェードアウト（時間では消さない）
if (isFirstLaunch) {
  showFirstHint = true;
  const hintEl = document.getElementById('first-hint');
  hintEl.style.opacity = '1';
}

// Launch loops
requestAnimationFrame(tick);


// End of app.js
