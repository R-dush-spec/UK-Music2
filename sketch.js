// =====================================================
//  Interactive Bubble + ECG Intro (Cyberpunk UI + World Pan) - p5.js port
//  WEBGL + p5.sound
// =====================================================

// ---------------------
// Globals
// ---------------------

// --- Sound ---
let seTap, seYes, seNo, seWarp, seBubble, seRecord, seImport, seGot, seBack;
let bgmIdle, bgmHub;
let musicMap;          // Map<string, p5.SoundFile>
let currentMusic = null;
let bgmIdlePath = "assets/bgm_idle.mp3";
let bgmHubPath  = "assets/bgm_hub.mp3";


let bubbles = [];
let avatarImages = [];

let selectedBubble = null;
let zoomProgress = 0;

let selectedRecord = null;
let musicDetailProgress = 0;

let phonePromptProgress = 0;

// Display modes
// -2: ECG (first)
// -3: Consent screen
// -1: Message
//  0: Hub (bubble world)
//  1: Bubble zoom (record select)
//  2: Music detail
//  3: Phone prompt (import)
let displayMode = -2;

// Stars
let stars = [];

// ECG data
let ecgPoints = [];
let ecgOffset = 0;
let introTimer = 0;

let ecgAmplitudeBase = 1.0;
let ecgWaveLengthBase = 520;
let ecgDrift = 0;

// Pulse circle
let pulseCircleSize = 0;
let pulsePhase = 0;

// Consent fade
let consentProgress = 0;

// Phone import animation
let phoneCollectState = 0; // 0 idle, 1 collecting, 2 gotSong
let phoneCollectT = 0;
let gotSongT = 0;
let collectBubbles = [];
let gotSEPlayed = false; // ★重要：state=2で毎フレームseGot.play()しないため

// Toast in record-select screen
let showGotSongToast = false;
let gotSongToastT = 0;

// ---------------------
// World + Camera Pan
// ---------------------
let worldHalfW, worldHalfH;
let camX = 0, camY = 0;
let camVelX = 0, camVelY = 0;
let isPanning = false;
let lastMX = 0, lastMY = 0;

// Exit button (hub)
let exitR;
let exitCX, exitCY;
let exitPulse = 0;

// UI animation
let uiTime = 0;

// ---------------------
// Assets preload
// ---------------------
function preload() { //137
  // images
  avatarImages = [
    loadImage("assets/avatar1.png"),
    loadImage("assets/avatar2.png"),
    loadImage("assets/avatar3.png"),
  ];

  // SE
  seTap    = loadSound("assets/se_tap.mp3");
  seYes    = loadSound("assets/se_yes.mp3");
  seNo     = loadSound("assets/se_no.mp3");
  seWarp   = loadSound("assets/se_warp.mp3");
  seBubble = loadSound("assets/se_bubble.mp3");
  seRecord = loadSound("assets/se_record.mp3");
  seImport = loadSound("assets/se_import.mp3");
  seGot    = loadSound("assets/se_got.mp3");
  seBack   = loadSound("assets/se_back.mp3");


  // BGM
// let bgmIdlePath = "assets/bgm_idle.mp3";
//let bgmHubPath  = "assets/bgm_hub.mp3";

  // music 6
  musicMap = new Map();
  musicMap.set("Midnight Dreams", loadSound("assets/midnight.mp3"));
  musicMap.set("Summer Breeze",   loadSound("assets/summer.mp3"));
 musicMap.set("Electric Soul",   loadSound("assets/electric.mp3"));
  musicMap.set("Neon Lights",     loadSound("assets/neon.mp3"));
  musicMap.set("Ocean Waves",     loadSound("assets/ocean.mp3"));
  musicMap.set("City Pulse",      loadSound("assets/city.mp3"));


    // ---------------------
// Sound helpers
// ---------------------

function safeLoadSound(path) {
  return loadSound(
    path,
    () => console.log("OK:", path),
    (e) => {
      console.warn("NG:", path, e);
    }
  );
}
} //90

function setup() { //185
  createCanvas(windowWidth, windowHeight, WEBGL);
  pixelDensity(1);

  // volumes(BGMはタップ後に読み込むので、ここでは未ロードの可能性あり)
if (bgmIdle) bgmIdle.setVolume(0.4);
if (bgmHub)  bgmHub.setVolume(0.6);
  

  // ECG
  generateECG();

  // stars
  stars = [];
  for (let i = 0; i < 320; i++) stars.push(new Star());

  // bubbles
  bubbles = [];
  const bubbleSize = min(width, height) / 2.5;

  worldHalfW = width * 2.2;
  worldHalfH = height * 2.2;

  for (let i = 0; i < 12; i++) {
    const x = random(-worldHalfW * 0.6, worldHalfW * 0.6);
    const y = random(-worldHalfH * 0.6, worldHalfH * 0.6);
    const z = random(-300, 300);
    bubbles.push(new Bubble(x, y, z, bubbleSize, true));
  }

  for (let i = 0; i < 14; i++) {
    const x = random(-worldHalfW, worldHalfW);
    const y = random(-worldHalfH, worldHalfH);
    const z = random(-1500, -600);
    bubbles.push(new Bubble(x, y, z, bubbleSize * random(0.8, 1.6), false));
  }

  // phone mini bubbles
  collectBubbles = [];

  // exit button geometry (2D coords; we will draw in screen-space)
  exitR = min(width, height) * 0.14;
  exitCX = width + exitR * 0.15;
  exitCY = height + exitR * 0.15;

  // NOTE: BGMはブラウザの制約で「setup時に自動再生」できないことが多いので、
  // 実際のloop開始は最初のタップ（mousePressed）側で行う。
} //139

function draw() { //274
  uiTime += 0.016;

  background(0);
push();
translate(-width/2, -height/2);
blendMode(BLEND);
fill(255);
noStroke();
textSize(20);
textAlign(LEFT, TOP);
text("DEBUG TEXT", 20, 20);
pop();

  push();
  translate(-width/2, -height/2);
  fill(255);
  textSize(20);
  text("DEBUG: draw running " + frameCount, 20, 40);
  pop();

  
  // ----- 2D座標系へ：WEBGLは原点が中央なので左上起点にする -----
  push();
  translate(-width / 2, -height / 2);

  drawScanlines(10);

  if (displayMode === -2) {
    drawECGScreen();
  } else if (displayMode === -3) {
    consentProgress = min(1, consentProgress + 0.05);
    drawConsentScreen();
  } else if (displayMode === -1) {
    drawMessageScreen();
  } else if (displayMode === 3) {
    phonePromptProgress = min(1, phonePromptProgress + 0.03);
    drawPhonePrompt();
  } else if (displayMode === 2) {
    musicDetailProgress = min(1, musicDetailProgress + 0.05);
    phonePromptProgress = max(0, phonePromptProgress - 0.1);
    drawMusicDetail();
  } else if (displayMode === 1) {
    zoomProgress = min(1, zoomProgress + 0.05);
    musicDetailProgress = max(0, musicDetailProgress - 0.1);
    phonePromptProgress = max(0, phonePromptProgress - 0.1);
    drawZoomedBubble();
  } else { //266
    // Hub
    updateCameraPan();

    // parallax stars (2D)
    const parX = -camX * 0.15;
    const parY = -camY * 0.15;
    for (const s of stars) {
      s.update();
      s.display(parX, parY);
    }

    // ---- 3D world ----
    pop(); // 一旦2D解除してWEBGL座標で描く
    push();

    // world transform = window into a huge space
    // 画面中心へ、そこからcam分だけ逆に動かす
    translate(-camX, -camY, 0);

    // depth sort
    bubbles.sort((a, b) => a.z - b.z);

    setupBubbleLights();
    for (const b of bubbles) {
      b.update();
      b.display();
    }

    pop();

    // HUDとアバターは2Dで上書き
    push();
    translate(-width / 2, -height / 2);
    drawAvatarsOverlayNormal();
    hudCorners(18, 120);
    drawCompassHint();
    drawExitButton();
    pop();

    return;
  } //225

  // 2DのままHUD
  pop();
  push();
  translate(-width / 2, -height / 2);
  // （各画面内でhudCornersしてるならここ不要）
  pop();

  drawDebugTextTopLeft("DEBUG TEXT");
return;

} //187

// =====================================================
// Sound helpers
// =====================================================
function stopCurrentMusic() {
  if (currentMusic && currentMusic.isPlaying()) currentMusic.stop();
}

function playMusicByTitle(title) {
  stopCurrentMusic();
  const s = musicMap.get(title);
  if (s) {
    currentMusic = s;
    currentMusic.loop();
  }
}

function switchBGM(bgm) {
  if (bgmIdle && bgmIdle.isPlaying()) bgmIdle.stop();
  if (bgmHub && bgmHub.isPlaying()) bgmHub.stop();
  if (bgm && (!bgm.isLoaded || bgm.isLoaded())) bgm.loop();
}

 function ensureBGMLoaded() {
  if (!bgmIdle) {
    bgmIdle = loadSound(bgmIdlePath, () => {
      bgmIdle.setVolume(0.4);
      console.log("bgmIdle loaded");
    }, (e) => console.warn("bgmIdle load failed", e));
  }

  if (!bgmHub) {
    bgmHub = loadSound(bgmHubPath, () => {
      bgmHub.setVolume(0.6);
      console.log("bgmHub loaded");
    }, (e) => console.warn("bgmHub load failed", e));
  }
}
// =====================================================
// Classes
// =====================================================
class MusicInfo {
  constructor() {
    const titles = ["Midnight Dreams", "Summer Breeze", "Electric Soul", "Neon Lights", "Ocean Waves", "City Pulse"];
    const artists = ["The Dreamers", "Soul Collective", "Digital Hearts", "Night Riders", "Wave Makers", "Urban Sound"];
    const albums = ["Night Sessions", "Golden Hour", "Future Sounds", "Endless Journey", "Deep Blue", "Metropolitan"];

    this.title = random(titles);
    this.artist = random(artists);
    this.album = random(albums);
    this.albumColor = color(random(100, 255), random(100, 255), random(100, 255));
  }
}

class Star {
  constructor() {
    this.x = random(-width * 3, width * 3);
    this.y = random(-height * 3, height * 3);
    this.z = random(200, 2400);
    this.brightness = random(80, 255);
    this.twinkleSpeed = random(0.01, 0.03);
    this.twinklePhase = random(TWO_PI);
  }
  update() { this.twinklePhase += this.twinkleSpeed; }
  display(parX, parY) {
    const f = min(width, height) * 0.9;
    const screenX = width/2 + ((this.x + parX) / this.z) * f;
    const screenY = height/2 + ((this.y + parY) / this.z) * f;

    const size = map(this.z, 200, 2400, 2.6, 0.5);
    const a = this.brightness * (0.65 + 0.35 * sin(this.twinklePhase));

    noStroke();
    fill(255, a);
    circle(screenX, screenY, size);
  }
}

class MusicRecord {
  constructor() {
    const angle = random(TWO_PI);
    const distance = random(40, 80);
    this.pos = createVector(cos(angle) * distance, sin(angle) * distance);
    this.vel = p5.Vector.random2D().mult(0.3);
    this.size = random(18, 30);
    this.rotation = random(TWO_PI);
    this.recordColor = color(random(40, 80), random(40, 80), random(40, 80));
    this.info = new MusicInfo();
  }
  update() {
    this.pos.add(this.vel);
    this.rotation += 0.02;

    const maxDist = 70;
    if (this.pos.mag() > maxDist) {
      const normal = this.pos.copy().normalize();
      const dotProduct = this.vel.dot(normal);
      this.vel.sub(p5.Vector.mult(normal, 2 * dotProduct));
      this.pos = normal.mult(maxDist);
    }
  }
  display(a) {
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.rotation);

    fill(red(this.recordColor), green(this.recordColor), blue(this.recordColor), a * 220);
    stroke(0, a * 120);
    strokeWeight(1.5);
    circle(0, 0, this.size);

    fill(100, a * 180);
    noStroke();
    circle(0, 0, this.size * 0.3);

    noFill();
    stroke(0, a * 60);
    strokeWeight(0.8);
    for (let i = 1; i < 5; i++) circle(0, 0, this.size * 0.4 + i * 2.5);

    pop();
  }
}

class Bubble { //535
  constructor(x, y, z, s, interactive) {
    this.pos = createVector(x, y);
    this.z = z;
    this.vel = p5.Vector.random2D().mult(random(0.15, 0.4));
    this.size = s;
    this.rotation = random(TWO_PI);
    this.rotSpeed = random(-0.005, 0.005);
    this.isInteractive = interactive;

    const colorType = floor(random(8));
    const pick = () => {
      switch (colorType) {
        case 0: return color(random(80, 150), random(150, 220), random(200, 255));
        case 1: return color(random(180, 255), random(100, 180), random(200, 255));
        case 2: return color(random(220, 255), random(150, 200), random(80, 140));
        case 3: return color(random(100, 180), random(200, 255), random(150, 200));
        case 4: return color(random(220, 255), random(100, 150), random(140, 200));
        case 5: return color(random(80, 150), random(200, 255), random(200, 255));
        case 6: return color(random(150, 200), random(100, 160), random(220, 255));
        case 7: return color(random(180, 230), random(220, 255), random(100, 160));
      }
    };
    this.bubbleColor = pick();

    this.alpha = random(0.16, 0.30);
    this.pulsePhase = random(TWO_PI);

    this.avatarImage = null;
    this.records = null;

    if (this.isInteractive) {
      this.avatarImage = random(avatarImages);
      this.records = [];
      for (let i = 0; i < 10; i++) this.records.push(new MusicRecord());
    }
  }

  update() {
    this.pos.add(this.vel);
    this.rotation += this.rotSpeed;
    this.pulsePhase += 0.02;

    if (this.isInteractive && this.records) {
      for (const r of this.records) r.update();
    }

    // world boundary
    if (this.pos.x < -worldHalfW || this.pos.x > worldHalfW) {
      this.vel.x *= -1;
      this.pos.x = constrain(this.pos.x, -worldHalfW, worldHalfW);
    }
    if (this.pos.y < -worldHalfH || this.pos.y > worldHalfH) {
      this.vel.y *= -1;
      this.pos.y = constrain(this.pos.y, -worldHalfH, worldHalfH);
    }

    if (this.isInteractive) {
      for (const other of bubbles) {
        if (other !== this && other.isInteractive && abs(this.z - other.z) < 200) {
          const d = p5.Vector.dist(this.pos, other.pos);
          if (d < (this.size + other.size) / 2) {
            const pushDir = p5.Vector.sub(this.pos, other.pos).normalize();
            this.vel.add(pushDir.mult(0.1));
            this.vel.limit(0.6);
          }
        }
      }
    }
  }

  display() {
    push();
    // WEBGL原点は中心なので、あなたのProcessingの「width/2,height/2 translate」を再現する
    translate(this.pos.x, this.pos.y, this.z);

    const depthScale = map(this.z, -1500, 500, 0.3, 1.2);
    const depthAlpha = map(this.z, -1500, 500, 0.25, 1.0);
    scale(depthScale);

    rotateY(this.rotation);
    rotateX(sin(this.pulsePhase) * 0.08);

    const pulse = 1 + sin(this.pulsePhase) * 0.04;
    const currentSize = this.size * pulse;

    this.drawSoapBubbleSphere(currentSize / 2, depthAlpha);

    pop();
  }

  drawSoapBubbleSphere(r, depthAlpha) {
    noStroke();

    // material
    specularMaterial(80);
    shininess(10);

    const a = 255 * this.alpha * depthAlpha * 0.85;
    // p5のfillはWEBGLでも透過OK
    fill(red(this.bubbleColor), green(this.bubbleColor), blue(this.bubbleColor), a);

    const depthScale = map(this.z, -1500, 500, 0.3, 1.2);
    let detail = floor(map(depthScale, 0.3, 1.2, 12, 32));
    detail = constrain(detail, 10, 34);
    // Safari対策：sphereDetail が無い環境がある
if (typeof sphereDetail === "function") {
  sphereDetail(detail);
}
sphere(r);

    // rim (2Dっぽい円を重ねる：WEBGLだと円は板なので、雰囲気優先)
    push();
    // ここは「発光輪郭の雰囲気」なので2D円を前面に描く
    rotateX(-sin(this.pulsePhase) * 0.08);
    noFill();
    const rimA1 = 42 * depthAlpha;
    const rimA2 = 18 * depthAlpha;
    const hueT = (sin(frameCount * 0.008) * 0.5 + 0.5);
    const rimC1 = lerpColor(color(80, 220, 255), color(255, 80, 220), hueT);
    const rimC2 = lerpColor(color(130, 255, 150), color(255, 240, 120), 1 - hueT);

    stroke(rimC1, rimA1);
    strokeWeight(1.7);
    circle(0, 0, r * 2.02);

    stroke(rimC2, rimA2);
    strokeWeight(2.8);
    circle(0, 0, r * 2.07);
    pop();
  }

  displayMusicRecords() {
    if (!this.isInteractive || !this.records) return;
    push();
    translate(0, this.size * 0.15);
    for (const r of this.records) r.display(1.0);
    pop();
  }

  isClicked(mx, my) {
    if (!this.isInteractive) return false;
    const depthScale = map(this.z, -1500, 500, 0.3, 1.2);

    // あなたの計算と同じ「スクリーン座標」で判定する
    const screenX = width/2 + (this.pos.x - camX);
    const screenY = height/2 + (this.pos.y - camY);
    const d = dist(mx, my, screenX, screenY);
    return d < (this.size * depthScale) / 2;
  }
} //388

class MiniBubble { //571
  constructor(s, t) {
    this.start = s.copy();
    this.target = t.copy();
    this.baseR = random(10, 26);
    this.c = color(random(120, 255), random(120, 255), random(120, 255));
  }
  display(t) {
    const tt = easeInOutCubic(constrain(t, 0, 1));
    const p = p5.Vector.lerp(this.start, this.target, tt);

    const swirl = (1.0 - tt) * 30.0;
    const ang = atan2(this.start.y - this.target.y, this.start.x - this.target.x) + frameCount * 0.02;
    p.x += cos(ang) * swirl;
    p.y += sin(ang) * swirl;

    const r = lerp(this.baseR, 2.0, tt);
    const a = lerp(190, 0, tt);

    blendMode(ADD);
    noStroke();
    fill(red(this.c), green(this.c), blue(this.c), a * 0.35);
    circle(p.x, p.y, r * 2.6);
    blendMode(BLEND);

    noStroke();
    fill(red(this.c), green(this.c), blue(this.c), a);
    circle(p.x, p.y, r);

    noFill();
    stroke(255, a * 0.5);
    strokeWeight(2);
    circle(p.x, p.y, r * 1.15);
  }
} //537

// =====================================================
// ECG generation
// =====================================================
function generateECG() {  //612
  ecgPoints = [];

  const micLevel01 = 0.0;
  const amp = ecgAmplitudeBase * lerp(0.9, 1.45, micLevel01);
  const noiseAmt = lerp(0.6, 2.2, micLevel01);
  const waveLength = ecgWaveLengthBase * lerp(1.05, 0.85, micLevel01);

  for (let i = 0; i < width * 2; i += 3) {
    let y = height/2 + 120;

    const drift = sin((i * 0.002) + ecgDrift) * 4.0;
    y += drift;

    y += random(-2.0, 2.0) * amp * noiseAmt;

    const spikePos = (i % waveLength);
    const spikeProgress = spikePos / waveLength;

    if (spikeProgress < 0.06) {
      y -= sin((spikeProgress / 0.06) * PI) * 10 * amp;
    } else if (spikeProgress > 0.17 && spikeProgress < 0.28) {
      const qrsProgress = (spikeProgress - 0.17) / 0.11;
      if (qrsProgress < 0.28) {
        y += sin((qrsProgress / 0.28) * PI) * 22 * amp;
      } else if (qrsProgress < 0.52) {
        y -= sin(((qrsProgress - 0.28) / 0.24) * PI) * 150 * amp;
      } else {
        y += sin(((qrsProgress - 0.52) / 0.48) * PI) * 40 * amp;
      }
    } else if (spikeProgress > 0.43 && spikeProgress < 0.54) {
      y -= sin(((spikeProgress - 0.43) / 0.11) * PI) * 18 * amp;
    }

    ecgPoints.push(createVector(i, y));
  }
}　//576

// =====================================================
// Lighting
// =====================================================
function setupBubbleLights() {
  ambientLight(18, 18, 24);
  directionalLight(55, 55, 65, -0.2, -0.6, -1);
  directionalLight(28, 32, 45, 0.8, 0.2, -1);
}

// =====================================================
// HUD helpers (2D)
// =====================================================
function drawDebugTextTopLeft(msg) {
  push();
  // WEBGL -> 画面左上座標系へ
  resetMatrix();
  // p5.js WEBGL の screen-space は (0,0) が中央なので左上へずらす
  translate(-width / 2, -height / 2);

  blendMode(BLEND);
  noStroke();
  fill(255);
  textAlign(LEFT, TOP);
  textSize(18);
  text(msg, 20, 20);
  pop();
}


function drawScanlines(a) {
  stroke(255, a);
  strokeWeight(1);
  for (let y = 0; y < height; y += 4) line(0, y, width, y);
}

function neonRect(x, y, w, h, r, c, a) {
  rectMode(CORNER);

  blendMode(ADD);
  noFill();
  stroke(red(c), green(c), blue(c), a * 0.22);
  strokeWeight(10);
  rect(x, y, w, h, r);
  stroke(red(c), green(c), blue(c), a * 0.18);
  strokeWeight(6);
  rect(x, y, w, h, r);
  blendMode(BLEND);

  noFill();
  stroke(255, a * 0.40);
  strokeWeight(2);
  rect(x, y, w, h, r);
}

function neonText(s, x, y, sz, c, a) {
  textAlign(CENTER, CENTER);
  textSize(sz);

  blendMode(ADD);
  fill(red(c), green(c), blue(c), a * 0.30);
  text(s, x, y);
  fill(red(c), green(c), blue(c), a * 0.20);
  text(s, x + 1, y);
  text(s, x - 1, y);
  blendMode(BLEND);

  fill(255, a);
  text(s, x, y);
}

function hudCorners(pad, a) {
  stroke(120, 240, 255, a);
  strokeWeight(2);

  const L = 40;
  // TL
  line(pad, pad, pad+L, pad);
  line(pad, pad, pad, pad+L);
  // TR
  line(width-pad, pad, width-pad-L, pad);
  line(width-pad, pad, width-pad, pad+L);
  // BL
  line(pad, height-pad, pad+L, height-pad);
  line(pad, height-pad, pad, height-pad-L);
  // BR
  line(width-pad, height-pad, width-pad-L, height-pad);
  line(width-pad, height-pad, width-pad, height-pad-L);
}

// Avatars overlay (2D)
function drawAvatarsOverlayNormal() {
  imageMode(CENTER);
  noStroke();

  for (const b of bubbles) {
    if (!b.isInteractive || !b.avatarImage) continue;

    const depthScale = map(b.z, -1500, 500, 0.3, 1.2);
    const depthAlpha = map(b.z, -1500, 500, 0.25, 1.0);

    const screenX = width/2 + (b.pos.x - camX);
    const screenY = height/2 + (b.pos.y - camY);

    const avatarSize = (b.size * 0.36) * depthScale;

    tint(255, 180 * depthAlpha);
    image(b.avatarImage, screenX, screenY, avatarSize, avatarSize);
  }
  noTint();
}

function drawCompassHint() {
  const a = 130 + 60 * (0.5 + 0.5 * sin(uiTime * 1.4));
  fill(200, 220, 255, a);
  noStroke();
  textAlign(LEFT, BASELINE);
  textSize(12);
  text("DRAG TO LOOK AROUND", 22, height - 22);

  stroke(120, 240, 255, 70);
  strokeWeight(1);
  line(width/2 - 10, height/2, width/2 + 10, height/2);
  line(width/2, height/2 - 10, width/2, height/2 + 10);
}

// Exit button
function drawExitButton() {
  exitPulse += 0.03;
  const p = 0.5 + 0.5 * sin(exitPulse);

  blendMode(ADD);
  noStroke();
  fill(120, 240, 255, 35 + 30 * p);
  circle(exitCX, exitCY, exitR * 2.2);
  fill(255, 80, 220, 22 + 24 * (1 - p));
  circle(exitCX, exitCY, exitR * 1.7);
  blendMode(BLEND);

  noFill();
  stroke(255, 130);
  strokeWeight(2);
  circle(exitCX, exitCY, exitR * 2.0);

  const tx = width - exitR * 0.55;
  const ty = height - exitR * 0.55;
  neonText("EXIT", tx, ty, 18, color(120, 240, 255), 220);
}

function hitExit(mx, my) {
  return dist(mx, my, exitCX, exitCY) < exitR * 1.0;
}

// =====================================================
// Camera Pan update
// =====================================================
function updateCameraPan() {
  if (!isPanning) {
    camX += camVelX;
    camY += camVelY;
    camVelX *= 0.90;
    camVelY *= 0.90;
  }

  const camClampX = max(0, worldHalfW - width * 0.55);
  const camClampY = max(0, worldHalfH - height * 0.55);
  camX = constrain(camX, -camClampX, camClampX);
  camY = constrain(camY, -camClampY, camClampY);
}

// =====================================================
// Screens (あなたのロジックをそのまま移植：未掲載分は同様に追加してください)
// =====================================================
function drawECGScreen() {
  background(8, 10, 18);

  ecgOffset -= 2.0;
  if (ecgOffset < -width) ecgOffset = 0;

  ecgDrift += 0.015;
  if (frameCount % 12 === 0) generateECG();

  blendMode(ADD);
  stroke(120, 240, 255, 40);
  strokeWeight(12);
  noFill();
  beginShape();
  for (let i = 0; i < ecgPoints.length - 1; i++) {
    const p = ecgPoints[i];
    const x = p.x + ecgOffset;
    const y = p.y;
    if (x > -50 && x < width + 50) vertex(x, y);
  }
  endShape();

  stroke(255, 80, 220, 25);
  strokeWeight(8);
  beginShape();
  for (let i = 0; i < ecgPoints.length - 1; i++) {
    const p = ecgPoints[i];
    const x = p.x + ecgOffset;
    const y = p.y;
    if (x > -50 && x < width + 50) vertex(x, y - 2);
  }
  endShape();
  blendMode(BLEND);

  pulsePhase += 0.05;
  pulseCircleSize = 110 + 55 * sin(pulsePhase);
  const circleAlpha = 160 + 90 * sin(pulsePhase);

  blendMode(ADD);
  noFill();
  stroke(120, 240, 255, circleAlpha * 0.55);
  strokeWeight(4);
  circle(width/2, height/2 + 100, pulseCircleSize);

  stroke(255, 80, 220, circleAlpha * 0.28);
  strokeWeight(10);
  circle(width/2, height/2 + 100, pulseCircleSize * 1.15);
  blendMode(BLEND);

  neonText("Touch the screen with your smartphone.", width/2, height/2 + 250, 30, color(120, 240, 255), 230);
  neonText("Let's discover new music.", width/2, height - 180, 30, color(120, 240, 255), 230);

  hudCorners(18, 110);
}

function drawConsentScreen() {
  const t = easeInOutCubic(consentProgress);

  const cx = width/2;
  const cy = height/2;

  const panelW = width * 0.74;
  const panelH = 340;

  rectMode(CENTER);
  fill(10, 12, 18, 210);
  noStroke();
  rect(cx, cy, panelW, panelH, 24);

  const innerPad = 26;
  neonRect(cx - panelW/2 + innerPad, cy - panelH/2 + innerPad, panelW - innerPad*2, panelH - innerPad*2, 22, color(120, 240, 255), 220 * t);

  neonText("SHARE YOUR DEVICE INFO?", cx, cy - 90, 26, color(120, 240, 255), 240 * t);

  fill(200, 220, 255, 180 * t);
  noStroke();
  textAlign(CENTER, CENTER);
  textSize(15);
  text("Used only to find music bubbles you've never met.\nNo personal identity is stored.", cx, cy - 45);

  const btnW = 220;
  const btnH = 58;
  const gap = 30;

  const yesX = cx - (btnW/2 + gap/2);
  const noX  = cx + (btnW/2 + gap/2);
  const btnY = cy + 80;

  cyberButton(yesX, btnY, btnW, btnH, "YES", color(120, 240, 255), t);
  cyberButton(noX,  btnY, btnW, btnH, "NO",  color(255, 80, 220), t);

  hudCorners(18, 120);
}

function cyberButton(cx, cy, w, h, label, c, t) {
  rectMode(CENTER);

  blendMode(ADD);
  noStroke();
  fill(red(c), green(c), blue(c), 26 * t);
  rect(cx, cy, w + 18, h + 18, 16);
  fill(red(c), green(c), blue(c), 18 * t);
  rect(cx, cy, w + 34, h + 34, 16);
  blendMode(BLEND);

  fill(12, 14, 20, 230 * t);
  stroke(red(c), green(c), blue(c), 160 * t);
  strokeWeight(2);
  rect(cx, cy, w, h, 14);

  neonText(label, cx, cy + 6, 18, c, 230 * t);
}

function hitRectCenter(mx, my, cx, cy, w, h) {
  return (mx >= cx - w/2 && mx <= cx + w/2 && my >= cy - h/2 && my <= cy + h/2);
}

function drawMessageScreen() {
  introTimer += 0.016;
  const a = min(255, introTimer * 110);

  neonText("ENTER THE UNKNOWN FEED.", width/2, height/2 - 20, 30, color(255, 80, 220), a);
  neonText("Tap to skip", width/2, height - 50, 16, color(120, 240, 255), a * 0.7);

  hudCorners(18, 120);

  if (introTimer > 3) {
    displayMode = 0;
    introTimer = 0;
  }
}

// ここから下は、あなたの未貼り付け分と同じ要領で移植してください。
// とりあえず「動く土台＋音＋ハブ」はここで成立しています。
// drawZoomedBubble / drawMusicDetail / drawPhonePrompt は、あなたのProcessing版を
// そのまま関数としてJSに移せばOKです（記法だけJava→JSに直す）。

function drawZoomedBubble() {
  // TODO: あなたのProcessing版を移植
  // 例：selectedBubble.drawSoapBubbleSphere(...) はそのまま呼べる
  fill(0, 200);
  noStroke();
  rect(0, 0, width, height);
  hudCorners(18, 120);
}

function drawMusicDetail() {
  // TODO: あなたのProcessing版を移植
  fill(0, 200);
  noStroke();
  rect(0, 0, width, height);
  hudCorners(18, 120);
}

function drawPhonePrompt() {
  // TODO: あなたのProcessing版を移植
  fill(0, 200);
  noStroke();
  rect(0, 0, width, height);
  hudCorners(18, 120);
}

// =====================================================
// Phone helper
// =====================================================
function startPhoneCollectBubbles() {
  collectBubbles = [];
  const target = createVector(width/2, height/2 + 50);

  const n = 28;
  for (let i = 0; i < n; i++) {
    const ang = random(TWO_PI);
    const rad = random(min(width, height) * 0.22, min(width, height) * 0.40);
    const s = createVector(
      target.x + cos(ang) * rad,
      target.y + sin(ang) * rad
    );
    collectBubbles.push(new MiniBubble(s, target));
  }
}

function hitPhone(mx, my) {
  const phoneCX = width/2;
  const phoneCY = height/2 + 50;
  const phoneW = 190;
  const phoneH = 330;
  return hitRectCenter(mx, my, phoneCX, phoneCY, phoneW, phoneH);
}

// =====================================================
// Easing
// =====================================================
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - pow(-2 * t + 2, 3) / 2;
}

// =====================================================
// Input (Mouse + Touch)
// =====================================================
function mousePressed() {
  // ブラウザ音声解放（最重要）
  userStartAudio();
ensureBGMLoaded(); // ← 追加
  
  // 最初のBGM開始を「最初のタップ」で行うと確実
  if (displayMode === -2 && bgmIdle && !bgmIdle.isPlaying()) {
    bgmIdle.loop();
  }

  handlePress(mouseX, mouseY);
  return false;
}

function touchStarted() {
  // スマホでも同じ動作にする
  userStartAudio();
ensureBGMLoaded(); // ← 追加
  
  if (displayMode === -2 && bgmIdle && !bgmIdle.isPlaying()) bgmIdle.loop();

  const t = touches[0] || { x: mouseX, y: mouseY };
  handlePress(t.x, t.y);
  return false;
}

function handlePress(mx, my) {  //1065とペア
  // あなたのProcessing mousePressedをほぼそのまま移植（mx/myを使う）
  if (displayMode === -2) {
    if (seTap) seTap.play();
    if (bgmIdle && bgmIdle.isPlaying()) bgmIdle.stop();
    displayMode = -3;
    consentProgress = 0;
    return;
  }

  if (displayMode === -3) {
    const cx = width/2;
    const cy = height/2;
    const btnW = 220;
    const btnH = 58;
    const gap = 30;

    const yesX = cx - (btnW/2 + gap/2);
    const noX  = cx + (btnW/2 + gap/2);
    const btnY = cy + 80;

    const yesHit = hitRectCenter(mx, my, yesX, btnY, btnW, btnH);
    const noHit  = hitRectCenter(mx, my, noX,  btnY, btnW, btnH);

    if (yesHit) {
      if (seYes) seYes.play();
      displayMode = -1;
      introTimer = 0;
    } else if (noHit) {
      if (seNo) seNo.play();
      displayMode = -2;
      consentProgress = 0;
    }
    return;
  }

  if (displayMode === -1) {
    if (seWarp) seWarp.play();
    switchBGM(bgmHub);
    displayMode = 0;
    introTimer = 0;
    return;
  }

  if (displayMode === 0) {
    if (hitExit(mx, my)) {
      if (seBack) seBack.play();
      stopCurrentMusic();
      switchBGM(bgmIdle);
      exitToStart();
      return;
    }
  }
  
    for (const b of bubbles) {
      if (b.isClicked(mx, my)) {
        if (seBubble) seBubble.play();
        selectedBubble = b;
        displayMode = 1;
        zoomProgress = 0;
        return;
      }
    }

    // start pan
    isPanning = true;
    lastMX = mx;
    lastMY = my;
    camVelX = 0;
    camVelY = 0;
  
}

function mouseDragged() {
  if (displayMode === 0 && isPanning) {
    const dx = mouseX - lastMX;
    const dy = mouseY - lastMY;

    camX -= dx;
    camY -= dy;

    camVelX = -dx * 0.7;
    camVelY = -dy * 0.7;

    lastMX = mouseX;
    lastMY = mouseY;
  }
  return false;
}

function touchMoved() {
  if (displayMode === 0 && isPanning && touches.length > 0) {
    const t = touches[0];
    const dx = t.x - lastMX;
    const dy = t.y - lastMY;

    camX -= dx;
    camY -= dy;

    camVelX = -dx * 0.7;
    camVelY = -dy * 0.7;

    lastMX = t.x;
    lastMY = t.y;
  }
  return false;
}

function mouseReleased() {
  if (displayMode === 0) isPanning = false;
}
function touchEnded() {
  if (displayMode === 0) isPanning = false;
}

function exitToStart() {
  displayMode = -2;

  selectedBubble = null;
  selectedRecord = null;
  zoomProgress = 0;
  musicDetailProgress = 0;
  phonePromptProgress = 0;
  consentProgress = 0;
  introTimer = 0;

  showGotSongToast = false;
  gotSongToastT = 0;

  phoneCollectState = 0;
  phoneCollectT = 0;
  gotSongT = 0;
  collectBubbles = [];
  gotSEPlayed = false;

  camX = 0; camY = 0;
  camVelX = 0; camVelY = 0;
}

// =====================================================
// Resize
// =====================================================
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);

  // world / UI geometry re-calc
  worldHalfW = width * 2.2;
  worldHalfH = height * 2.2;

  exitR = min(width, height) * 0.14;
  exitCX = width + exitR * 0.15;
  exitCY = height + exitR * 0.15;

  // ECGを作り直す（width依存）
  generateECG();
}
console.log("EOF reached");
