import { clamp, lerp, circlesOverlap, boostTier, nearMissType, normalize, distanceSq } from "./math.js";
import { UPGRADE_KEYS, UPGRADE_DEFS, STAGES, WEAPONS, BOSS_VARIANTS, upgradeCost, applyUpgrades, waveSettings, chooseEnemyType, advanceWave, isRunClear, applyEscapePenalty, runRank, pickRunContract, contractProgress } from "./progression.js";

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d", { alpha: false });
ctx.imageSmoothingEnabled = false;
const W = canvas.width, H = canvas.height;
const $ = (id) => document.getElementById(id);

const ui = {
  score: $("score"), combo: $("combo"), hpBar: $("hpBar"), hpText: $("hpText"),
  boostBar: $("boostBar"), boostValue: $("boostValue"), boostLevel: $("boostLevel"),
  speed: $("speed"), announcer: $("announcer"), debug: $("debug"),
  start: $("startScreen"), gameOver: $("gameOver"), pause: $("pause"),
  finalScore: $("finalScore"), maxCombo: $("maxCombo"), resultEyebrow:$("resultEyebrow"),resultTitle:$("resultTitle"),restartLabel:$("restartLabel"),help: $("controlHelp"), spriteSelect: $("spriteSelect"), selectedSpriteLabel: $("selectedSpriteLabel"),
  characterStage: $("characterSelectStage"), outfitStage: $("outfitSelectStage"), outfitGrid: $("outfitGrid"), parameterGrid:$("parameterGrid"), characterStep: $("characterStep"), outfitStep: $("outfitStep"),
  outfitName: $("outfitCharacterName"), outfitRole: $("outfitCharacterRole"), keyartImage: $("selectedKeyartImage"), characterName: $("selectedCharacterName"), characterCode: $("selectedCharacterCode"), characterMeta: $("selectedCharacterMeta"), characterLead: $("selectedCharacterLead"),
  stageLabel:$("stageLabel"),waveLabel:$("waveLabel"),eventLabel:$("eventLabel"),weaponLabel:$("weaponLabel"),bossHud:$("bossHud"),bossName:$("bossName"),bossBar:$("bossBar"),bossHp:$("bossHp"),runCore:$("runCore"),bankCore:$("bankCore"),upgradeCore:$("upgradeCore"),upgradeGrid:$("upgradeGrid"),contractLabel:$("contractLabel"),contractBar:$("contractBar"),contractProgress:$("contractProgress"),contractReward:$("contractReward"),
  stageReached:$("stageReached"),runReward:$("runReward"),resultCore:$("resultCore"),runRank:$("runRank"),resultKills:$("resultKills"),resultNear:$("resultNear"),resultDamage:$("resultDamage"),resultTime:$("resultTime")
};
let helpWasPaused = false;
let selectorWasPaused = false;
const CHARACTERS = {
  ray: { name:"RAY", jp:"レイ", role:"BALANCED", code:"ESCAPED SUBJECT // 07", meta:"BALANCED BOOST FIGHTER", portrait:"./assets/ray-key-art.png", description:"都市警備組織から逃亡した元実験体。BOOST DRIVEで射撃と斬撃を自在につなぐ万能型。", hp:100, speed:1, fireRate:1, shotDamage:1, bulletSpeed:1, dashSpeed:1, dashDuration:1, dashCooldown:1, slashRange:1, slashDamage:1, slashCooldown:1, accent:"#00f0ff", defaultOutfit:"7", outfits:[
    {id:"1",name:"SCOUT BOB",note:"丸いボブ＋軽装",src:"./assets/ray-options/ray-01.png"},
    {id:"4",name:"SUBJECT ZERO",note:"ピクシー＋実験体",src:"./assets/ray-options/ray-04.png"},
    {id:"7",name:"FLUFF JACKET",note:"ふわ髪＋大きめ上着",src:"./assets/ray-options/ray-07.png"},
    {id:"8",name:"LIGHT KNIGHT",note:"長髪＋騎士装甲",src:"./assets/ray-options/ray-08.png"},
    {id:"10",name:"NEON COURIER",note:"フード＋スポーツ",src:"./assets/ray-options/ray-10.png"}
  ]},
  mira: { name:"MIRA", jp:"ミラ", role:"HEAVY GUNNER", code:"WARDEN DEFECTOR // 02", meta:"ARMORED MARKSMAN", portrait:"./assets/characters/mira-front.png?v=front2", description:"都市警備隊を離反した重装射手。機動力と斬撃を犠牲に、高耐久と高威力射撃で敵を粉砕する。", hp:135, speed:.84, fireRate:.78, shotDamage:1.58, bulletSpeed:1.08, dashSpeed:.86, dashDuration:.92, dashCooldown:1.12, slashRange:.78, slashDamage:.88, slashCooldown:1.1, accent:"#ffb43f", defaultOutfit:"base", outfits:[{id:"base",name:"WARDEN BREAKER",note:"完全背面・重装射撃装備",src:"./assets/characters/mira.png?v=rear2"}]},
  lyn: { name:"LYN", jp:"リン", role:"INTERCEPTOR", code:"STREET UNIT // 13", meta:"CLOSE-RANGE INTERCEPTOR", portrait:"./assets/characters/lyn-front.png?v=front2", description:"違法レース育ちの高速迎撃手。低耐久だが、最速のダッシュと巨大ブレードで弾幕の懐へ潜り込む。", hp:80, speed:1.17, fireRate:1.18, shotDamage:.78, bulletSpeed:.96, dashSpeed:1.2, dashDuration:1.13, dashCooldown:.82, slashRange:1.3, slashDamage:1.22, slashCooldown:.82, accent:"#ff55a5", defaultOutfit:"base", outfits:[{id:"base",name:"STREET COMET",note:"完全背面・軽量近接装備",src:"./assets/characters/lyn.png?v=rear2"}]}
};
const PROFILE_KEY="velocityBreakerProfileV1";
function blankUpgrades(){return Object.fromEntries(Object.keys(CHARACTERS).map(id=>[id,Object.fromEntries(UPGRADE_KEYS.map(key=>[key,0]))]));}
function loadProfile(){
  const fallback={cores:0,upgrades:blankUpgrades()};
  try{const saved=JSON.parse(localStorage.getItem(PROFILE_KEY)||"null");if(!saved)return fallback;return{cores:Math.max(0,Number(saved.cores)||0),upgrades:Object.fromEntries(Object.keys(CHARACTERS).map(id=>[id,Object.fromEntries(UPGRADE_KEYS.map(key=>[key,clamp(Number(saved.upgrades?.[id]?.[key])||0,0,5)]))]))}}catch{return fallback}
}
let profile=loadProfile();
function saveProfile(){try{localStorage.setItem(PROFILE_KEY,JSON.stringify(profile))}catch{}}
const effectiveCharacter=(id)=>applyUpgrades(CHARACTERS[id],profile.upgrades[id]);
let selectedCharacter = (()=>{try{const id=localStorage.getItem("selectedCharacter");return CHARACTERS[id]?id:"ray"}catch{return "ray"}})();
const selectedOutfits = Object.fromEntries(Object.entries(CHARACTERS).map(([id,c])=>[id,(()=>{try{return c.outfits.some(o=>o.id===localStorage.getItem(`outfit:${id}`))?localStorage.getItem(`outfit:${id}`):c.defaultOutfit}catch{return c.defaultOutfit}})()]));
const spriteImages = new Map(), spriteCrops = new Map();
function loadSprite(key,src){
  const img=new Image();
  img.onload=()=>{
    const scan=document.createElement("canvas"), scanCtx=scan.getContext("2d",{willReadFrequently:true});
    scan.width=img.naturalWidth;scan.height=img.naturalHeight;scanCtx.drawImage(img,0,0);
    const pixels=scanCtx.getImageData(0,0,scan.width,scan.height).data;
    let left=scan.width,top=scan.height,right=0,bottom=0;
    for(let y=0;y<scan.height;y++)for(let x=0;x<scan.width;x++)if(pixels[(y*scan.width+x)*4+3]>12){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y)}
    const pad=Math.round(Math.max(right-left,bottom-top)*.035);
    spriteCrops.set(key,{x:Math.max(0,left-pad),y:Math.max(0,top-pad),w:Math.min(scan.width-1,right+pad)-Math.max(0,left-pad)+1,h:Math.min(scan.height-1,bottom+pad)-Math.max(0,top-pad)+1});
  };
  img.src=src;spriteImages.set(key,img);
}
for(const [characterId,c] of Object.entries(CHARACTERS))for(const outfit of c.outfits)loadSprite(`${characterId}:${outfit.id}`,outfit.src);
const activeCharacter=()=>CHARACTERS[selectedCharacter];
const activeOutfit=()=>activeCharacter().outfits.find(o=>o.id===selectedOutfits[selectedCharacter])??activeCharacter().outfits[0];

function updateSpriteSelection() {
  const c=activeCharacter(),outfit=activeOutfit();
  document.querySelectorAll(".character-card").forEach(card=>card.setAttribute("aria-checked",String(card.dataset.character===selectedCharacter)));
  document.querySelectorAll(".sprite-card").forEach(card=>card.setAttribute("aria-checked",String(card.dataset.outfit===outfit.id)));
  ui.selectedSpriteLabel.textContent=`${c.name} // OUTFIT ${String(outfit.id).toUpperCase()} ${outfit.name}`;
  ui.keyartImage.src=c.portrait;ui.keyartImage.alt=`${c.jp}の正面キャラクターアート`;ui.characterName.textContent=c.name;ui.characterCode.textContent=c.code;ui.characterMeta.textContent=c.meta;
  ui.characterLead.innerHTML=`<strong>${c.jp}</strong> — ${c.description}`;
  ui.bankCore.textContent=profile.cores;ui.upgradeCore.textContent=profile.cores;
}

function renderUpgrades(){
  const levels=profile.upgrades[selectedCharacter];ui.upgradeCore.textContent=profile.cores;ui.bankCore.textContent=profile.cores;
  ui.upgradeGrid.innerHTML=UPGRADE_KEYS.map(key=>{const def=UPGRADE_DEFS[key],level=levels[key],cost=upgradeCost(level),disabled=cost===null||profile.cores<cost;return `<button class="upgrade-button${cost===null?" max":""}" type="button" data-upgrade="${key}" ${disabled?"disabled":""}><strong>${def.label} <small>LV${level}/5</small></strong><span>${def.jp} // ${def.description}</span><em>${cost===null?"MAX":`◆ ${cost}`}</em></button>`}).join("");
  ui.upgradeGrid.querySelectorAll(".upgrade-button").forEach(button=>button.addEventListener("click",()=>buyUpgrade(button.dataset.upgrade)));
  renderParameters();
}

function renderParameters(){
  const c=effectiveCharacter(selectedCharacter),values=[
    ["CORE",Math.round(c.hp),`${Math.round(c.hp)} HP`,c.hp/140],
    ["MOVE",Math.round(430*c.speed),`${Math.round(430*c.speed)} px/s`,c.speed/1.25],
    ["GUN",(c.fireRate/.105).toFixed(1),`${(12*c.shotDamage).toFixed(1)} DMG`,c.shotDamage/1.75],
    ["DASH",Math.round(1180*c.dashSpeed),`${(.56*c.dashCooldown).toFixed(2)}s CD`,c.dashSpeed/1.3],
    ["BLADE",(62*c.slashDamage).toFixed(1),`${Math.round(108*c.slashRange)} px`,c.slashDamage/1.4]
  ];
  ui.parameterGrid.innerHTML=values.map(([label,value,sub,ratio])=>`<div><small>${label}</small><strong>${value}</strong><span>${sub}</span><i><b style="width:${Math.min(100,Math.round(ratio*100))}%"></b></i></div>`).join("");
}

function buyUpgrade(key){
  if(!UPGRADE_KEYS.includes(key))return;const level=profile.upgrades[selectedCharacter][key],cost=upgradeCost(level);if(cost===null||profile.cores<cost)return;
  profile.cores-=cost;profile.upgrades[selectedCharacter][key]++;saveProfile();renderUpgrades();updateSpriteSelection();audio.start();audio.near(true);
}

function renderOutfits() {
  const c=activeCharacter();ui.outfitName.textContent=c.name;ui.outfitRole.textContent=c.role;ui.outfitGrid.classList.toggle("is-single",c.outfits.length===1);
  ui.outfitGrid.innerHTML=c.outfits.map((outfit,index)=>`<button class="sprite-card" type="button" data-outfit="${outfit.id}" role="radio"><b>${String(outfit.id).padStart(2,"0").toUpperCase()}</b><img src="${outfit.src}" alt="${c.jp} ${outfit.name}"><span>${outfit.name}</span><small>${outfit.note}</small></button>`).join("");
  ui.outfitGrid.querySelectorAll(".sprite-card").forEach(card=>card.addEventListener("click",()=>chooseOutfit(card.dataset.outfit)));renderUpgrades();updateSpriteSelection();
}

function chooseCharacter(id){if(!CHARACTERS[id])return;selectedCharacter=id;try{localStorage.setItem("selectedCharacter",id)}catch{}renderOutfits();showOutfitStage();audio.start();audio.near(false)}
function chooseOutfit(id){if(!activeCharacter().outfits.some(o=>o.id===id))return;selectedOutfits[selectedCharacter]=id;try{localStorage.setItem(`outfit:${selectedCharacter}`,id)}catch{}updateSpriteSelection();audio.start();audio.near(false)}
function showCharacterStage(){ui.characterStage.hidden=false;ui.outfitStage.hidden=true;ui.characterStep.classList.add("active");ui.outfitStep.classList.remove("active")}
function showOutfitStage(){ui.characterStage.hidden=true;ui.outfitStage.hidden=false;ui.characterStep.classList.remove("active");ui.outfitStep.classList.add("active");renderUpgrades()}

function toggleSpriteSelect(force) {
  const opening=force??ui.spriteSelect.hidden;
  if(opening){selectorWasPaused=state.paused;if(state.mode==="play")state.paused=true;ui.pause.hidden=true;ui.spriteSelect.hidden=false;showCharacterStage();updateSpriteSelection()}
  else{ui.spriteSelect.hidden=true;if(state.mode==="play")state.paused=selectorWasPaused;ui.pause.hidden=!(state.mode==="play"&&state.paused)}
}

function toggleHelp(force) {
  const opening = force ?? ui.help.hidden;
  if (opening) {
    helpWasPaused = state.paused;
    if (state.mode === "play") state.paused = true;
    ui.pause.hidden = true;
    ui.help.hidden = false;
  } else {
    ui.help.hidden = true;
    if (state.mode === "play") state.paused = helpWasPaused;
    ui.pause.hidden = !(state.mode === "play" && state.paused);
  }
}

const input = { keys: new Set(), pressed: new Set(), mouse: false, mouseX: W / 2, mouseY: H / 3 };
let audio;

class Synth {
  constructor() { this.ctx = null; }
  start() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); this.ctx.resume(); }
  tone(freq = 300, duration = .05, type = "square", volume = .025, slide = 0) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime, osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, now); osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), now + duration);
    gain.gain.setValueAtTime(volume, now); gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    osc.connect(gain).connect(this.ctx.destination); osc.start(now); osc.stop(now + duration);
  }
  shot() { this.tone(260, .035, "square", .018, 110); }
  dash() { this.tone(82, .17, "sawtooth", .07, 1050);this.tone(44,.1,"square",.045,180); }
  slash() { this.tone(680, .09, "sawtooth", .035, -500); }
  hit() { this.tone(95, .045, "square", .03, -35); }
  near(dash) { this.tone(dash ? 940 : 720, .09, "sine", .045, dash ? 420 : 180); }
  warning(strong=false){this.tone(strong?310:420,strong ? .18 : .1,"square",strong ? .035 : .018,strong?260:100);}
  overdrive() { this.tone(180, .34, "sawtooth", .05, 920);this.tone(360,.28,"square",.025,760); }
  boom() { this.tone(85, .16, "sawtooth", .055, -45); }
  hurt() { this.tone(120, .22, "square", .065, -80); }
}
audio = new Synth();

const ENEMY = {
  grunt: { hp: 34, r: 21, speed: 78, score: 120, color: "#ff527f", fire: 1.45 },
  spread: { hp: 48, r: 25, speed: 58, score: 200, color: "#ffaf35", fire: 2.05 },
  sniper: { hp: 42, r: 22, speed: 66, score: 240, color: "#b66cff", fire: 1.8 },
  pursuer:{ hp:520,r:48,speed:72,score:2500,color:"#ff315f",fire:.82 }
};

let state;
function freshState() {
  const character=effectiveCharacter(selectedCharacter);
  return {
    mode: "menu", paused: false, time: 0, realTime: 0, scroll: 0, visualSpeed:720, spawnTimer: .5,hazardTimer:2.8,
    characterId:selectedCharacter,outfitId:selectedOutfits[selectedCharacter],characterStats:character,
    stageIndex:0,wave:1,waveTime:0,stageLoop:0,bossWaveKey:"",runCores:0,rewardCommitted:false,weaponIndex:0,lastTier:1,eventTimer:5.5,speedBurst:0,contract:pickRunContract(),contractAwarded:false,
    score: 0, combo: 0, maxCombo: 0, comboTimer: 0, boost: 8, shake: 0, flash: 0,
    hitstop: 0, lastAction: 0, announcementId: 0, stats: { near: 0, dashNear: 0, justDodge:0, hazardDodges:0, kills: 0, strongKills:0, overdriveTime:0, escaped:0, damage:0 },
    player: { x: W / 2, y: H * .72, vx: 0, vy: 0, r: 12, hp: character.hp, maxHp:character.hp, fireCd: 0, dashCd: 0, dashTime: 0, dashAge:9, inv: 0, slashCd: 0, slashTime: 0, slideTime:0, slideCd:0, turnCd:0, angle: -Math.PI / 2, lastDir: { x: 0, y: -1 } },
    shots: [], enemyShots: [], enemies: [], hazards:[],items:[], particles: [], ghosts: [], texts: [], streaks: [], rings:[], delayedBursts:[], camera:{x:0,y:0}
  };
}
state = freshState();

function startGame() {
  audio.start(); state = freshState(); state.mode = "play"; ui.start.hidden = true; ui.gameOver.hidden = true; ui.help.hidden = true; ui.spriteSelect.hidden = true;
  document.querySelector(".run-contract").classList.remove("complete");
  const debugParams=new URLSearchParams(location.search),debugStage=Number(debugParams.get("stage")),debugWave=Number(debugParams.get("wave"));if(Number.isFinite(debugStage)&&debugStage>=1)state.stageIndex=clamp(Math.floor(debugStage)-1,0,STAGES.length-1);if(Number.isFinite(debugWave)&&debugWave>=1)state.wave=clamp(Math.floor(debugWave),1,5);
  announce(`STAGE ${state.stageIndex+1} // ${STAGES[state.stageIndex].name}`,true);
  for (let i = 0; i < 2; i++) spawnEnemy(i ? "grunt" : "spread", 150 + i * 390, 210 - i * 80);
  if(debugParams.has("boss")){state.wave=5;state.waveTime=STAGES[state.stageIndex].duration;spawnBoss()}
}

function endGame(clear=false) {
  state.mode = "gameover";state.cleared=clear;state.shake = clear?26:18;burst(state.player.x,state.player.y,clear?"#c8ff2e":"#ff2e78",clear?65:40,clear?430:350);audio.boom();
  if(!state.rewardCommitted){profile.cores+=state.runCores;state.rewardCommitted=true;saveProfile()}
  const rank=runRank({...state.stats,score:state.score,maxCombo:state.maxCombo});const mins=Math.floor(state.realTime/60),secs=Math.floor(state.realTime%60);
  ui.gameOver.classList.toggle("clear",clear);ui.resultEyebrow.textContent=clear?"ROUTE COMPLETE // BONUS CORE +8":"RUN TERMINATED";ui.resultTitle.innerHTML=clear?"MISSION<br>CLEAR":"CORE<br>BREAK";ui.restartLabel.textContent=clear?"NEXT RUN":"REBOOT";
  ui.finalScore.textContent = String(state.score).padStart(6, "0"); ui.maxCombo.textContent = state.maxCombo;ui.stageReached.textContent=clear?"ALL CLEAR":`S${state.stageIndex+1}-W${state.wave}`;ui.runReward.textContent=state.runCores;ui.resultCore.textContent=profile.cores;ui.bankCore.textContent=profile.cores;ui.runRank.textContent=rank;ui.resultKills.textContent=state.stats.kills;ui.resultNear.textContent=state.stats.near;ui.resultDamage.textContent=state.stats.damage;ui.resultTime.textContent=`${String(mins).padStart(2,"0")}:${String(secs).padStart(2,"0")}`;ui.gameOver.hidden = false;
}

function keyName(e) { return e.code; }
addEventListener("keydown", (e) => {
  const key = keyName(e); if (["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(key)) e.preventDefault();
  if (!input.keys.has(key)) input.pressed.add(key); input.keys.add(key);
  if (key === "Enter" && state.mode !== "play") startGame();
  if (key === "KeyH") toggleHelp();
  if (key === "Escape" && !ui.spriteSelect.hidden) { if(!ui.outfitStage.hidden)showCharacterStage();else toggleSpriteSelect(false); }
  else if (key === "Escape" && !ui.help.hidden) toggleHelp(false);
  if (key === "F3") { e.preventDefault(); ui.debug.hidden = !ui.debug.hidden; }
  if (key === "KeyP" && state.mode === "play") { state.paused = !state.paused; ui.pause.hidden = !state.paused; }
});
addEventListener("keyup", (e) => input.keys.delete(keyName(e)));
canvas.addEventListener("mousemove", (e) => { const r = canvas.getBoundingClientRect(); input.mouseX = (e.clientX - r.left) * W / r.width; input.mouseY = (e.clientY - r.top) * H / r.height; });
canvas.addEventListener("mousedown", (e) => { audio.start(); if (state.mode !== "play") return; if (e.button === 0) input.mouse = true; if (e.button === 2) input.pressed.add("MouseSlash"); });
addEventListener("mouseup", (e) => { if (e.button === 0) input.mouse = false; });
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
$("startButton").addEventListener("click", startGame); $("restartButton").addEventListener("click", startGame); $("closeHelp").addEventListener("click", () => toggleHelp(false));
$("openSpriteSelect").addEventListener("click",()=>toggleSpriteSelect(true));$("closeSpriteSelect").addEventListener("click",()=>toggleSpriteSelect(false));
$("resultUpgrade").addEventListener("click",()=>toggleSpriteSelect(true));
$("backToCharacters").addEventListener("click",showCharacterStage);document.querySelectorAll(".character-card").forEach(card=>card.addEventListener("click",()=>chooseCharacter(card.dataset.character)));renderOutfits();updateSpriteSelection();

const down = (...keys) => keys.some(k => input.keys.has(k));
const tapped = (...keys) => keys.some(k => input.pressed.has(k));

function spawnEnemy(kind, x = 70 + Math.random() * (W - 140), y = -50) {
  const cfg = ENEMY[kind],settings=waveSettings(state.stageIndex,state.wave,state.stageLoop),hp=Math.round(cfg.hp*settings.hpScale);
  const enemy={ kind, x, y, vx: 0, vy: 0, r: cfg.r, hp, maxHp:hp, fireScale:settings.fireScale,moveScale:1+(settings.hpScale-1)*.12,fire: cfg.fire/settings.fireScale * (.75 + Math.random() * .45),telegraph:0,telegraphMax:0,aimX:x,aimY:H,phase: Math.random() * 6.28,age:0,escapeAt:(kind==="spread"?9.2:kind==="sniper"?8.1:7.2)+Math.random()*2.2,escaping:false,escapeCounted:false,hit: 0, dead: false };state.enemies.push(enemy);return enemy;
}

function spawnBoss(){
  const key=`${state.stageLoop}:${state.stageIndex}`;if(state.bossWaveKey===key||state.wave!==5)return;state.bossWaveKey=key;const boss=spawnEnemy("pursuer",W/2,185),variant=BOSS_VARIANTS[state.stageIndex];boss.variant=state.stageIndex;boss.fire=1.1;boss.volley=0;state.enemyShots.length=0;state.shake=14;state.speedBurst=1;announce(`WARNING // ${variant.name.split(" // ")[0]}`,true);audio.overdrive();
}

function spawnWave() {
  const settings=waveSettings(state.stageIndex,state.wave,state.stageLoop),kind=chooseEnemyType(settings.weights,Math.random()),bossActive=state.enemies.some(enemy=>enemy.kind==="pursuer"&&!enemy.dead);
  spawnEnemy(kind);
  if(Math.random()<settings.groupChance*(bossActive ? .22 : 1))spawnEnemy(chooseEnemyType(settings.weights,Math.random()),80+Math.random()*(W-160),-110);
  if(state.wave===5&&!bossActive&&Math.random()<settings.groupChance*.45)spawnEnemy(state.stageIndex===1?"spread":"sniper",80+Math.random()*(W-160),-175);
  state.spawnTimer=settings.spawnInterval*(bossActive?2.25:state.wave===5?1.35:1)*(.82+Math.random()*.38);
}

function spawnRoadHazard(){
  const lanes=[W*.32,W*.5,W*.68],x=lanes[Math.floor(Math.random()*lanes.length)];
  if(state.stageIndex===1){state.hazards.push({type:"floodGate",x,y:-70,r:26,speed:190,dead:false,grazed:false,phase:Math.random()*6.28,gap:58});state.hazardTimer=4.2+Math.random()*1.6;return}
  if(state.stageIndex===2){state.hazards.push({type:"gridGate",x,y:-70,r:26,speed:225,dead:false,grazed:false,phase:Math.random()*6.28,gap:43});state.hazardTimer=3.7+Math.random()*1.35;return}
  let type="car";
  if(state.wave===3)type=Math.random()<.62?"barrier":"car";else if(state.wave===4)type=Math.random()<.48?"ramp":"barrier";else if(state.wave===5)type=Math.random()<.25?"ramp":"car";
  const cfg={car:{r:24,speed:210},barrier:{r:31,speed:165},ramp:{r:28,speed:185}}[type];state.hazards.push({type,x,y:-70,r:cfg.r,speed:cfg.speed,dead:false,grazed:false,phase:Math.random()*6.28});state.hazardTimer=(state.wave===5?5.4:3.4+Math.random()*1.8);
}

function updateHazards(dt){
  const p=state.player;state.hazardTimer-=dt;if(state.hazardTimer<=0)spawnRoadHazard();
  for(const hazard of state.hazards){hazard.phase+=dt;if(hazard.type==="gridGate")hazard.x=clamp(hazard.x+Math.sin(hazard.phase*2.4)*42*dt,150,W-150);hazard.y+=(hazard.speed+state.visualSpeed*.43)*dt;const hitRadius=p.r+hazard.r;
    if(!hazard.dead&&(hazard.type==="floodGate"||hazard.type==="gridGate")){
      const crossing=Math.abs(hazard.y-p.y)<13,insideGap=Math.abs(hazard.x-p.x)<hazard.gap-p.r;
      if(crossing&&!insideGap&&p.inv<=0){hazard.dead=true;hurtPlayer();state.shake=Math.max(state.shake,20);burst(p.x,p.y,hazard.type==="gridGate"?"#cb78ff":"#00f0ff",26,300);announce(hazard.type==="gridGate"?"ICE GRID HIT":"CANYON GATE HIT")}
      if(!hazard.grazed&&hazard.y>p.y+24){hazard.grazed=true;if(insideGap){const precision=1-Math.min(1,Math.abs(hazard.x-p.x)/hazard.gap),gain=hazard.type==="gridGate"?7:5;state.boost=clamp(state.boost+gain,0,100);state.score+=Math.round(90+precision*90);state.speedBurst=Math.max(state.speedBurst,.38);floating(`${hazard.type==="gridGate"?"ICE BREAK":"CANYON THREAD"} +${gain}`,p.x,p.y-34,"#c8ff2e",15);burst(p.x,p.y,"#c8ff2e",12,180);audio.near(true)}}
      continue;
    }
    if(!hazard.dead&&distanceSq(p,hazard)<hitRadius*hitRadius){
      if(hazard.type==="ramp"){hazard.dead=true;p.inv=Math.max(p.inv,.62);p.y=clamp(p.y-82,105,H-92);state.boost=clamp(state.boost+14,0,100);state.score+=180;state.speedBurst=1;state.shake=9;state.rings.push({x:p.x,y:p.y,r:16,life:.34,maxLife:.34,color:"#c8ff2e"});floating("RAMP LAUNCH +14",p.x,p.y-42,"#c8ff2e",17);audio.dash()}
      else if(p.inv<=0){hazard.dead=true;hurtPlayer();state.shake=Math.max(state.shake,19);burst(hazard.x,hazard.y,"#ffb43f",24,280);announce(hazard.type==="barrier"?"ROADBLOCK HIT":"TRAFFIC HIT")}
    }
    if(!hazard.grazed&&hazard.y>p.y+34){hazard.grazed=true;const gap=Math.abs(hazard.x-p.x);if(gap<hazard.r+p.r+38&&gap>hazard.r+p.r){state.stats.hazardDodges++;state.boost=clamp(state.boost+2.5,0,100);state.score+=55;floating("TRAFFIC DODGE +2",p.x,p.y-32,"#ffb43f",13);audio.near(false)}}
  }
  state.hazards=state.hazards.filter(hazard=>!hazard.dead&&hazard.y<H+100);
}

function addParticle(x, y, color, vx, vy, life, size = 4, gravity = 0) { state.particles.push({ x, y, color, vx, vy, life, maxLife: life, size, gravity }); }
function dropItem(type,x,y,amount=1){state.items.push({type,x,y,vx:(Math.random()-.5)*90,vy:35+Math.random()*35,life:9,spin:Math.random()*6.28,amount});}
function burst(x, y, color, count = 10, speed = 180) {
  for (let i = 0; i < count; i++) { const a = Math.random() * Math.PI * 2, s = speed * (.25 + Math.random()); addParticle(x, y, color, Math.cos(a) * s, Math.sin(a) * s, .18 + Math.random() * .4, 2 + Math.random() * 5, 80); }
}
function updateItems(dt){
  const p=state.player;
  for(const item of state.items){
    item.life-=dt;item.spin+=dt*5;const d=Math.sqrt(distanceSq(p,item));
    if(d<150){const pull=1-d/150,itemDir=normalize(p.x-item.x,p.y-item.y);item.vx+=itemDir.x*(520*pull+80)*dt;item.vy+=itemDir.y*(520*pull+80)*dt}
    item.x+=item.vx*dt;item.y+=item.vy*dt;item.vx*=Math.pow(.18,dt);item.vy*=Math.pow(.7,dt);
    if(d<24){item.life=0;if(item.type==="core"){state.runCores+=item.amount;floating(`DRIVE CORE +${item.amount}`,p.x,p.y-38,"#c8ff2e",15);burst(item.x,item.y,"#c8ff2e",12,170);audio.near(true)}else{const heal=Math.min(p.maxHp-p.hp,Math.max(18,Math.round(p.maxHp*.22)));p.hp+=heal;floating(`REPAIR +${heal}`,p.x,p.y-38,"#59ffb3",15);burst(item.x,item.y,"#59ffb3",14,150);audio.near(false)}}
  }
  state.items=state.items.filter(item=>item.life>0&&item.y<H+80);
}
function floating(text, x, y, color = "#fff", size = 18) { state.texts.push({ text, x, y, vy: -55, life: .7, color, size }); }
function announce(text, accent = false) {
  ui.announcer.textContent = text; ui.announcer.style.color = accent ? "#c8ff2e" : "#fff"; ui.announcer.classList.remove("pop"); void ui.announcer.offsetWidth; ui.announcer.classList.add("pop");
}

function updateContract(){
  const progress=contractProgress(state.contract,state.stats);
  if(progress.complete&&!state.contractAwarded){state.contractAwarded=true;state.runCores+=state.contract.reward;state.score+=750;state.boost=clamp(state.boost+18,0,100);state.speedBurst=1;state.shake=10;document.querySelector(".run-contract").classList.add("complete");announce(`RUN ORDER COMPLETE // CORE +${state.contract.reward}`,true);burst(state.player.x,state.player.y,"#c8ff2e",24,260);audio.overdrive()}
  return progress;
}

function shootPlayer() {
  const p = state.player, tier = boostTier(state.boost), character=state.characterStats, weapon=WEAPONS[state.weaponIndex]; let dir;
  if (input.mouse) dir = normalize(input.mouseX - p.x, input.mouseY - p.y); else dir = { x: 0, y: -1 };
  p.angle = Math.atan2(dir.y, dir.x); p.fireCd = weapon.fireDelay / (tier.fire*character.fireRate); state.lastAction = 0;
  const overdrive=tier.level===5,base={pistol:overdrive?3:tier.level>=4?2:1,shotgun:overdrive?7:5,laser:overdrive?2:1,missile:overdrive?2:1}[weapon.id];
  for (let i = 0; i < base; i++) {
    const spread=weapon.id==="shotgun" ? .14 : weapon.id==="pistol" ? .04 : weapon.id==="missile" ? .1 : .018;
    const offset=(i-(base-1)/2)*spread,a=p.angle+offset,shotSpeed=weapon.speed*character.bulletSpeed;
    state.shots.push({ x:p.x+Math.cos(a)*20,y:p.y+Math.sin(a)*20,vx:Math.cos(a)*shotSpeed,vy:Math.sin(a)*shotSpeed,r:weapon.id==="missile"?7:character.shotDamage>1.2?5:4,damage:weapon.damage*character.shotDamage,life:weapon.id==="shotgun" ? .62 : weapon.id==="missile" ? 2.2 : 1.3,type:weapon.id,trail:[] });
  }
  addParticle(p.x, p.y - 18, "#bffcff", (Math.random() - .5) * 45, 85, .12, 4); audio.shot();
}

function switchWeapon(){
  state.weaponIndex=(state.weaponIndex+1)%WEAPONS.length;const weapon=WEAPONS[state.weaponIndex];state.player.fireCd=Math.max(state.player.fireCd,.12);announce(`${weapon.label} // ONLINE`,true);floating(weapon.label,state.player.x,state.player.y-42,"#dffaff",15);audio.near(false);
}

function dash() {
  const p = state.player, tier = boostTier(state.boost), character=state.characterStats; if (p.dashCd > 0) return;
  const ix = (down("KeyD","ArrowRight") ? 1 : 0) - (down("KeyA","ArrowLeft") ? 1 : 0);
  const iy = (down("KeyS","ArrowDown") ? 1 : 0) - (down("KeyW","ArrowUp") ? 1 : 0);
  const d = normalize(ix, iy, p.lastDir.x, p.lastDir.y); const speed = 1180 * tier.dash*character.dashSpeed;
  p.vx = d.x * speed; p.vy = d.y * speed; p.lastDir = d; p.dashTime = .17 * tier.dash*character.dashDuration; p.dashAge=0;p.dashCd = .56*character.dashCooldown / tier.dash; p.inv = .28; p.slideTime=0;state.speedBurst=1;state.shake = 12; state.lastAction = 0;state.camera.x-=d.x*25;state.camera.y-=d.y*25;
  state.rings.push({x:p.x,y:p.y,r:18,life:.36,maxLife:.36,color:tier.level===5?"#c8ff2e":"#00f0ff"});
  for (let i = 0; i < 32; i++) addParticle(p.x, p.y, tier.level === 5 ? "#c8ff2e" : i%4===0?"#ffffff":"#00f0ff", -d.x * (120 + Math.random() * 420) + (Math.random() - .5) * 150, -d.y * (120 + Math.random() * 420) + (Math.random() - .5) * 150, .16 + Math.random() * .32, 2 + Math.random() * 6);
  audio.dash();
}

function slide(){
  const p=state.player,tier=boostTier(state.boost),character=state.characterStats;if(p.slideCd>0||p.dashTime>0)return;
  const ix=(down("KeyD","ArrowRight")?1:0)-(down("KeyA","ArrowLeft")?1:0),iy=(down("KeyS","ArrowDown")?1:0)-(down("KeyW","ArrowUp")?1:0),d=normalize(ix,iy,p.lastDir.x,p.lastDir.y);
  p.slideTime=.42;p.slideCd=.6;p.inv=Math.max(p.inv,.13);p.vx=d.x*(650+tier.level*28)*character.speed;p.vy=d.y*(650+tier.level*28)*character.speed;p.lastDir=d;state.speedBurst=Math.max(state.speedBurst,.48);state.lastAction=0;state.shake=5;state.rings.push({x:p.x,y:p.y,r:12,life:.24,maxLife:.24,color:"#ffb43f"});
  for(let i=0;i<14;i++)addParticle(p.x-d.x*12,p.y-d.y*12,i%3===0?"#ffb43f":"#78909b",-d.x*(60+Math.random()*150)+(Math.random()-.5)*100,-d.y*(60+Math.random()*150)+(Math.random()-.5)*100,.16+Math.random()*.2,2+Math.random()*4,40);
  audio.dash();
}

function dashTarget(maxDistance=230){
  const p=state.player;let best=null,bestScore=Infinity;
  for(const enemy of state.enemies){if(enemy.dead)continue;const dx=enemy.x-p.x,dy=enemy.y-p.y,d=Math.hypot(dx,dy),facing=(dx*p.lastDir.x+dy*p.lastDir.y)/Math.max(1,d);if(d<maxDistance&&facing>-.15&&d<bestScore){best=enemy;bestScore=d}}
  return best;
}

function slash() {
  const p = state.player, character=state.characterStats; if (p.slashCd > 0) return;
  const dashSlash = p.dashTime > 0;const target=dashSlash?dashTarget():null;if(target){const d=normalize(target.x-p.x,target.y-p.y);p.x=clamp(target.x-d.x*(target.r+24),34,W-34);p.y=clamp(target.y-d.y*(target.r+24),105,H-92);p.vx=d.x*720;p.vy=d.y*720;p.lastDir=d;p.angle=Math.atan2(d.y,d.x);state.ghosts.push({x:p.x-d.x*70,y:p.y-d.y*70,angle:p.angle,life:.28,maxLife:.28,dash:true})}
  p.slashTime = dashSlash ? .22 : .16; p.slashCd = (dashSlash ? .34 : .28)*character.slashCooldown; p.inv = Math.max(p.inv, dashSlash ? .28 : .1); state.lastAction = 0;
  const radius = (dashSlash ? 108 : 72)*character.slashRange, damage = (dashSlash ? 62 : 30)*character.slashDamage;
  for (const bullet of state.enemyShots) if (!bullet.dead && distanceSq(p, bullet) < (radius + bullet.r) ** 2) { bullet.dead = true; burst(bullet.x, bullet.y, "#d7fbff", 8, 160); state.boost = clamp(state.boost + (dashSlash ? 2.5 : 1.2), 0, 100); }
  let hits = 0;
  for (const enemy of state.enemies) if (!enemy.dead && distanceSq(p, enemy) < (radius + enemy.r) ** 2) { damageEnemy(enemy, damage, dashSlash, normalize(enemy.x - p.x, enemy.y - p.y)); hits++; }
  if (hits && dashSlash) { state.hitstop = .075; state.shake = 11; announce(target?"LOCK BREAK":"DASH BREAK", true);state.delayedBursts.push({x:target?.x??p.x,y:target?.y??p.y,time:.09,color:"#c8ff2e"}); }
  for (let i = 0; i < 20; i++) { const a = Math.random() * Math.PI * 2; addParticle(p.x + Math.cos(a) * radius, p.y + Math.sin(a) * radius, dashSlash ? "#c8ff2e" : "#d9fdff", Math.cos(a) * 90, Math.sin(a) * 90, .12 + Math.random() * .18, 2); }
  audio.slash();
}

function damageEnemy(enemy, amount, strong = false, dir = { x: 0, y: -1 }) {
  const knock=enemy.kind==="pursuer" ? .18 : 1;enemy.hp -= amount; enemy.hit = .1; enemy.x += dir.x * (strong ? 18 : 6)*knock; enemy.y += dir.y * (strong ? 18 : 6)*knock; burst(enemy.x, enemy.y, "#fff", strong ? 10 : 4, strong ? 220 : 100); audio.hit();
  if (enemy.hp <= 0) killEnemy(enemy, strong);
}

function killEnemy(enemy, strong) {
  if (enemy.dead) return; enemy.dead = true; const cfg = ENEMY[enemy.kind];
  state.combo++; state.maxCombo = Math.max(state.maxCombo, state.combo); state.comboTimer = 2.4; state.score += Math.round(cfg.score * (1 + Math.min(3, state.combo / 12))); state.boost = clamp(state.boost + 4 + Math.min(6, state.combo * .15) + (strong ? 3 : 0), 0, 100); state.stats.kills++;if(strong)state.stats.strongKills++;
  burst(enemy.x, enemy.y, cfg.color, strong ? 28 : 18, strong ? 330 : 240); burst(enemy.x, enemy.y, "#fff", 8, 220); state.hitstop = strong ? .085 : .042; state.shake = strong ? 13 : 7; audio.boom();
  floating(`+${cfg.score}`, enemy.x, enemy.y, cfg.color, 17); if ([10,20,50].includes(state.combo)) announce(`${state.combo} COMBO`, true);
  if(strong){state.player.dashCd=Math.min(state.player.dashCd,.12);floating("DASH READY",state.player.x,state.player.y+35,"#c8ff2e",12)}
  if(enemy.kind==="pursuer"){const variant=BOSS_VARIANTS[enemy.variant??0];state.boost=clamp(state.boost+25,0,100);state.score+=2500;state.enemyShots.length=0;state.runCores+=5;state.hitstop=.18;state.shake=24;state.speedBurst=1;announce(`${variant.name.split(" // ")[0]} BREAK // CORE +5`,true);for(let i=0;i<4;i++)state.delayedBursts.push({x:enemy.x+(Math.random()-.5)*90,y:enemy.y+(Math.random()-.5)*70,time:.06+i*.08,color:i%2?"#fff":variant.color});if(isRunClear(state.stageIndex,state.wave,state.stageLoop)){state.runCores+=8;state.score+=5000;endGame(true)}return}
  const coreChance=.28+(strong ? .1 : 0)+state.stageIndex*.035+Math.min(.1,state.combo*.004);
  if(Math.random()<coreChance)dropItem("core",enemy.x,enemy.y,Math.random()<.12+state.stageLoop*.03?2:1);
  if(state.player.hp<state.player.maxHp*.82&&Math.random()<.13)dropItem("heal",enemy.x+12,enemy.y,1);
}

function enemyFire(enemy) {
  const p = state.player,speedScale=1+(enemy.fireScale-1)*.28,targetX=enemy.aimX??p.x,targetY=enemy.aimY??p.y; enemy.fire = ENEMY[enemy.kind].fire/enemy.fireScale * (.75 + Math.random() * .4);enemy.telegraph=0;
  if (enemy.kind === "grunt") addEnemyBullet(enemy.x, enemy.y + 14, 0, 235*speedScale, 7, "#ff4d75");
  if (enemy.kind === "spread") {
    for (let i = -2; i <= 2; i++) { const a = Math.PI / 2 + i * .23; addEnemyBullet(enemy.x, enemy.y, Math.cos(a) * 205*speedScale, Math.sin(a) * 205*speedScale, 8, "#ffbf35"); }
  }
  if (enemy.kind === "sniper") {
    const d = normalize(targetX - enemy.x, targetY - enemy.y); addEnemyBullet(enemy.x, enemy.y, d.x * 315*speedScale, d.y * 315*speedScale, 6, "#cb78ff");
  }
  if(enemy.kind==="pursuer"){
    const d=normalize(targetX-enemy.x,targetY-enemy.y),base=Math.atan2(d.y,d.x),variant=enemy.variant??0;enemy.volley=(enemy.volley??0)+1;
    if(variant===0){for(let i=-1;i<=1;i++){const a=base+i*.18;addEnemyBullet(enemy.x+Math.cos(a)*30,enemy.y+Math.sin(a)*30,Math.cos(a)*295*speedScale,Math.sin(a)*295*speedScale,8,"#ff315f")}for(let i=0;i<4;i++){const a=Math.PI/2+(i-1.5)*.42;addEnemyBullet(enemy.x,enemy.y+25,Math.cos(a)*205*speedScale,Math.sin(a)*205*speedScale,7,"#ffb43f")}}
    if(variant===1){const shift=(enemy.volley%2)*.18;for(let i=-4;i<=4;i++){const a=Math.PI/2+i*.22+shift;addEnemyBullet(enemy.x,enemy.y+20,Math.cos(a)*220*speedScale,Math.sin(a)*220*speedScale,8,i%2?"#ff9f3d":"#ffcf5a")}for(let i=-1;i<=1;i++){const a=base+i*.11;addEnemyBullet(enemy.x,enemy.y,Math.cos(a)*315*speedScale,Math.sin(a)*315*speedScale,6,"#ff684d")}}
    if(variant===2){for(let i=-2;i<=2;i++){const a=base+i*.095;addEnemyBullet(enemy.x+i*13,enemy.y+18,Math.cos(a)*355*speedScale,Math.sin(a)*355*speedScale,6,"#83d9ff")}const side=enemy.volley%2?1:-1;for(let i=0;i<5;i++){const x=side>0?95+i*46:W-95-i*46;addEnemyBullet(x,enemy.y+10,side*38,245*speedScale,7,"#b99cff")}}
  }
}
function addEnemyBullet(x, y, vx, vy, r, color) { state.enemyShots.push({ x, y, vx, vy, r, color, life: 6, grazed: false, dead: false, trail: [] }); }

function hurtPlayer() {
  const p = state.player; if (p.inv > 0) return;
  p.hp -= 22;state.stats.damage++; p.inv = 1.05; state.boost = Math.max(0, state.boost - 28); state.combo = 0; state.comboTimer = 0; state.shake = 17; state.flash = .2; state.hitstop = .06; burst(p.x, p.y, "#ff2e78", 22, 280); audio.hurt(); announce("CORE HIT");
  if (p.hp <= 0) endGame();
}

function update(dt) {
  if (state.mode !== "play" || state.paused) return;
  state.realTime += dt;
  if (state.hitstop > 0) { state.hitstop -= dt; updateParticles(dt * .2); return; }
  state.time += dt; state.lastAction += dt;state.waveTime+=dt;state.speedBurst=Math.max(0,state.speedBurst-dt*2.15); const p = state.player; const tier = boostTier(state.boost), character=state.characterStats;if(tier.level===5)state.stats.overdriveTime+=dt;
  const currentStage=STAGES[state.stageIndex];
  const bossAlive=state.enemies.some(enemy=>enemy.kind==="pursuer"&&!enemy.dead);
  if(state.waveTime>=currentStage.duration&&!(state.wave===5&&bossAlive)){const next=advanceWave(state.stageIndex,state.wave,state.stageLoop);state.stageIndex=next.stageIndex;state.wave=next.wave;state.stageLoop=next.loop;state.waveTime=0;state.eventTimer=5.5;state.spawnTimer=.08;announce(`${next.stageChanged?`STAGE ${state.stageIndex+1}`:`WAVE ${state.wave}`} // ${STAGES[state.stageIndex].events[state.wave-1]}`,true);if(state.wave===5)spawnBoss();if(next.stageChanged){state.boost=clamp(state.boost+12,0,100);state.enemyShots.length=0}}
  p.fireCd -= dt; p.dashCd -= dt; p.dashTime -= dt;p.dashAge+=dt; p.inv -= dt; p.slashCd -= dt; p.slashTime -= dt;p.slideTime-=dt;p.slideCd-=dt;p.turnCd-=dt;state.eventTimer-=dt; state.shake *= Math.pow(.001, dt); state.flash -= dt;
  if (state.comboTimer > 0) { state.comboTimer -= dt; if (state.comboTimer <= 0) state.combo = 0; }

  const ix = (down("KeyD","ArrowRight") ? 1 : 0) - (down("KeyA","ArrowLeft") ? 1 : 0);
  const iy = (down("KeyS","ArrowDown") ? 1 : 0) - (down("KeyW","ArrowUp") ? 1 : 0);
  const move = normalize(ix, iy, 0, 0);const oldDir=p.lastDir,turnDot=(ix||iy)?move.x*oldDir.x+move.y*oldDir.y:1;
  if((ix||iy)&&turnDot<-.62&&Math.hypot(p.vx,p.vy)>265&&p.turnCd<=0&&p.dashTime<=0){p.turnCd=.32;p.vx=move.x*570*character.speed;p.vy=move.y*570*character.speed;p.lastDir=move;state.speedBurst=Math.max(state.speedBurst,.38);state.boost=clamp(state.boost+1.5,0,100);state.shake=5;state.camera.x-=move.x*28;state.camera.y-=move.y*28;state.rings.push({x:p.x,y:p.y,r:10,life:.2,maxLife:.2,color:"#7eeeff"});floating("QUICK TURN",p.x,p.y-34,"#7eeeff",13);burst(p.x,p.y,"#7eeeff",14,190)}else if(ix||iy)p.lastDir=move;
  if (p.dashTime <= 0&&p.slideTime<=0) {
    const targetSpeed = 430 * tier.speed*character.speed; const responsiveness = ix || iy ? 19 : 11;
    p.vx = lerp(p.vx, move.x * targetSpeed, 1 - Math.exp(-responsiveness * dt)); p.vy = lerp(p.vy, move.y * targetSpeed, 1 - Math.exp(-responsiveness * dt));
  } else if(p.dashTime>0) {
    p.vx *= Math.pow(.48, dt); p.vy *= Math.pow(.48, dt); if (Math.random() < dt * 92) state.ghosts.push({ x: p.x, y: p.y, angle: p.angle, life: .26, maxLife: .26, dash: true });
  }else{
    p.vx*=Math.pow(.12,dt);p.vy*=Math.pow(.12,dt);if(Math.random()<dt*28)state.ghosts.push({x:p.x,y:p.y,angle:p.angle,life:.13,maxLife:.13,dash:false});
  }
  p.x = clamp(p.x + p.vx * dt, 34, W - 34); p.y = clamp(p.y + p.vy * dt, 105, H - 92);p.r=p.slideTime>0?8:12;
  const moveSpeed=Math.hypot(p.vx,p.vy);
  if(moveSpeed>70&&Math.random()<dt*(18+moveSpeed/22)){
    const backX=-Math.cos(p.angle),backY=-Math.sin(p.angle);
    addParticle(p.x+backX*24+(Math.random()-.5)*10,p.y+backY*24+(Math.random()-.5)*10,Math.random()<.35?"#ffffff":"#7eeeff",backX*(45+Math.random()*85)+(Math.random()-.5)*30,backY*(45+Math.random()*85)+(Math.random()-.5)*30,.12+Math.random()*.18,1+Math.random()*3);
  }
  if ((moveSpeed>310||tier.level===5) && Math.random() < dt * (10+tier.level*5)) state.ghosts.push({ x: p.x-p.vx*.035, y: p.y-p.vy*.035, angle: p.angle, life: .14, maxLife: .14, dash: false });

  if (tapped("Space","ShiftLeft","ShiftRight")) dash();
  if (tapped("KeyC","ControlLeft","ControlRight")) slide();
  if (tapped("KeyQ")) switchWeapon();
  if (tapped("KeyX","KeyK","MouseSlash")) slash();
  if ((down("KeyZ","KeyJ") || input.mouse) && p.fireCd <= 0) shootPlayer();

  const forward = clamp((H * .72 - p.y) / 260, -.2, 1); const velocity = (850 + tier.level * 85 + Math.max(0, forward) * 760)*character.speed + (p.dashTime > 0 ? 900*character.dashSpeed : 0)+(p.slideTime>0?260:0);
  state.visualSpeed=lerp(state.visualSpeed,velocity,1-Math.exp(-(p.dashTime>0?18:6)*dt));state.scroll += state.visualSpeed * dt; if (forward > .18) state.boost = clamp(state.boost + forward * 1.65 * dt, 0, 100);
  const idleDecay = state.lastAction > 2.2 ? 3.8 : 1.05; const slowDecay = Math.hypot(p.vx,p.vy) < 70 ? 1.4 : 0; state.boost = clamp(state.boost - (idleDecay + slowDecay) * dt, 0, 100);
  if (Math.random() < dt * (24 + tier.level * 12+state.speedBurst*105)) state.streaks.push({ x: Math.random() * W, y: -40, len: 90 + Math.random() * 250+state.speedBurst*190, speed: 820 + Math.random() * 980+state.visualSpeed*.42, life: .48 });

  const cameraTargetX=clamp(-p.vx*.045,-31,31),cameraTargetY=clamp(-p.vy*.038,-28,28);state.camera.x=lerp(state.camera.x,cameraTargetX,1-Math.exp(-3.2*dt));state.camera.y=lerp(state.camera.y,cameraTargetY,1-Math.exp(-3.2*dt));
  for(const delayed of state.delayedBursts){delayed.time-=dt;if(delayed.time<=0&&!delayed.done){delayed.done=true;burst(delayed.x,delayed.y,delayed.color,28,340);state.shake=Math.max(state.shake,10);audio.boom()}}state.delayedBursts=state.delayedBursts.filter(b=>!b.done);

  state.spawnTimer -= dt; if (state.spawnTimer <= 0) spawnWave();
  updateShots(dt); updateEnemies(dt); updateEnemyShots(dt);updateHazards(dt); updateItems(dt); updateParticles(dt); updateDecorations(dt);updateContract(); updateHud(state.visualSpeed);
}

function updateShots(dt) {
  for (const s of state.shots) {
    if(s.type==="missile"){
      let target=null,best=Infinity;for(const enemy of state.enemies){if(enemy.dead)continue;const d=distanceSq(s,enemy);if(d<best){best=d;target=enemy}}
      if(target){const desired=normalize(target.x-s.x,target.y-s.y),speed=Math.hypot(s.vx,s.vy);s.vx=lerp(s.vx,desired.x*speed,1-Math.exp(-5.5*dt));s.vy=lerp(s.vy,desired.y*speed,1-Math.exp(-5.5*dt))}
      if(Math.random()<dt*35)addParticle(s.x,s.y,"#ffb43f",-s.vx*.12+(Math.random()-.5)*25,-s.vy*.12+(Math.random()-.5)*25,.12,3);
    }
    s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
    for (const e of state.enemies) if (!e.dead && circlesOverlap(s, e)) { s.life = 0; damageEnemy(e, s.damage, false, normalize(s.vx, s.vy)); break; }
  }
  state.shots = state.shots.filter(s => s.life > 0 && s.x > -30 && s.x < W + 30 && s.y > -40 && s.y < H + 40);
}

function updateEnemies(dt) {
  const p = state.player;
  for (const e of state.enemies) {
    e.phase += dt;e.age+=dt;e.hit -= dt;const cfg = ENEMY[e.kind];if(e.kind!=="pursuer"&&!e.escaping&&e.age>=e.escapeAt){e.escaping=true;e.telegraph=0;e.fire=99;floating("TARGET ESCAPING",e.x,e.y-34,"#ffcf5a",12)}if(e.telegraph>0){e.telegraph-=dt;if(e.telegraph<=0)enemyFire(e)}else e.fire-=dt;
    if(e.kind==="pursuer"){
      const targetY=195+Math.sin(e.phase*.7)*28;e.y+=clamp((targetY-e.y)*1.25,-cfg.speed,cfg.speed)*dt;const targetX=clamp(p.x+Math.sin(e.phase*1.3)*125,95,W-95);e.x=lerp(e.x,targetX,1-Math.exp(-1.15*dt));
    }else if(e.escaping){
      e.y+=(250+state.visualSpeed*.18)*dt;e.x+=Math.sin(e.phase*3)*42*dt;
    }else{
      const targetY = e.kind === "spread" ? 210 : 150 + (e.phase * 17 % 150); e.y += Math.min(cfg.speed*e.moveScale, Math.max(18, (targetY - e.y) * .55)) * dt;e.x += Math.sin(e.phase * (e.kind === "sniper" ? 1.7 : 1.05)) * (e.kind === "grunt" ? 38 : 22) * dt;
    }
    if (e.fire <= 0&&e.telegraph<=0&&e.y > 30 && e.y < H * .7){const duration={grunt:.16,spread:.3,sniper:.48,pursuer:.56}[e.kind]??.25;e.telegraph=duration;e.telegraphMax=duration;e.aimX=p.x;e.aimY=p.y;if(e.kind==="sniper"||e.kind==="pursuer")audio.warning(e.kind==="pursuer")}
    if (!e.dead && circlesOverlap(p, e)) { if (p.dashTime > 0) damageEnemy(e, 22, true, normalize(e.x-p.x,e.y-p.y)); else hurtPlayer(); }
    if(!e.dead&&e.kind!=="pursuer"&&e.y>=H+88&&!e.escapeCounted){e.escapeCounted=true;state.stats.escaped++;state.boost=applyEscapePenalty(state.boost);state.combo=0;state.comboTimer=0;announce("TARGET ESCAPED // BOOST -7");audio.warning(false)}
  }
  state.enemies = state.enemies.filter(e => !e.dead && e.y < H + 90);
}

function updateEnemyShots(dt) {
  const p = state.player;
  for (const b of state.enemyShots) {
    b.trail.push({ x: b.x, y: b.y, life: .12 }); if (b.trail.length > 4) b.trail.shift();
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; for (const t of b.trail) t.life -= dt;
    const result = nearMissType(p, b, p.dashTime > 0);
    if (result === "hit" && p.inv <= 0) { b.dead = true; hurtPlayer(); }
    else if ((result === "near" || result === "dash") && !b.grazed) {
      b.grazed = true; const dashNear = result === "dash",just=dashNear&&p.dashAge<.12; const gain = just ? 14 : dashNear ? 9 : 3.2; state.boost = clamp(state.boost + gain, 0, 100); state.score += just?160:dashNear ? 90 : 35; state.stats.near++; if (dashNear) state.stats.dashNear++;if(just)state.stats.justDodge++;
      floating(just?"JUST DODGE +14":dashNear ? "DASH DODGE +9" : "NEAR MISS +3", p.x, p.y - 30, dashNear ? "#c8ff2e" : "#00f0ff", dashNear ? 18 : 14); burst(b.x, b.y, dashNear ? "#c8ff2e" : "#00f0ff", just?18:dashNear ? 12 : 6, just?210:130); audio.near(dashNear); state.lastAction = 0;
      if (dashNear) { state.shake = just ? 8 : 5;state.hitstop=just ? .04 : state.hitstop; announce(just?"JUST DODGE":"DASH DODGE", true); }
    }
  }
  state.enemyShots = state.enemyShots.filter(b => !b.dead && b.life > 0 && b.x > -80 && b.x < W + 80 && b.y > -80 && b.y < H + 80);
}

function updateParticles(dt) {
  for (const q of state.particles) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += q.gravity * dt; q.vx *= Math.pow(.18, dt); q.life -= dt; }
  state.particles = state.particles.filter(q => q.life > 0);
}
function updateDecorations(dt) {
  for (const g of state.ghosts) g.life -= dt; state.ghosts = state.ghosts.filter(g => g.life > 0);
  for (const t of state.texts) { t.y += t.vy * dt; t.life -= dt; } state.texts = state.texts.filter(t => t.life > 0);
  for (const s of state.streaks) { s.y += s.speed * dt; s.life -= dt; } state.streaks = state.streaks.filter(s => s.life > 0 && s.y < H + 200);
  for(const ring of state.rings){ring.life-=dt;ring.r+=dt*520}state.rings=state.rings.filter(ring=>ring.life>0);
}

function updateHud(velocity) {
  const p = state.player, tier = boostTier(state.boost);
  if(tier.level===5&&state.lastTier<5){announce("OVERDRIVE",true);audio.overdrive();state.shake=9}state.lastTier=tier.level;
  ui.score.textContent = String(state.score).padStart(6,"0"); ui.combo.textContent = state.combo > 1 ? `${state.combo} COMBO` : "—";
  ui.hpBar.style.width = `${Math.max(0,p.hp/p.maxHp*100)}%`; ui.hpText.textContent = Math.max(0,p.hp); ui.boostBar.style.width = `${state.boost}%`; ui.boostValue.textContent = `${Math.floor(state.boost)}%`; ui.boostLevel.textContent = tier.label;
  const weapon=WEAPONS[state.weaponIndex];ui.speed.textContent = String(Math.round(velocity * 1.02)).padStart(3,"0");ui.stageLabel.textContent=`STAGE ${state.stageIndex+1} // ${STAGES[state.stageIndex].name}`;ui.waveLabel.textContent=`WAVE ${state.wave} / 5`;ui.eventLabel.textContent=STAGES[state.stageIndex].events[state.wave-1];ui.weaponLabel.textContent=`${weapon.short} // ${weapon.label}`;ui.runCore.textContent=state.runCores; document.querySelector(".shell").classList.toggle("overdrive", tier.level === 5);
  const contract=state.contract,progress=contractProgress(contract,state.stats),shown=contract.stat==="overdriveTime"?progress.value.toFixed(1):Math.floor(progress.value);ui.contractLabel.textContent=contract.label;ui.contractBar.style.width=`${progress.ratio*100}%`;ui.contractProgress.textContent=`${shown} / ${contract.target}${contract.stat==="overdriveTime"?"s":""}`;ui.contractReward.textContent=state.contractAwarded?"COMPLETE":`CORE +${contract.reward}`;
  const boss=state.enemies.find(enemy=>enemy.kind==="pursuer"&&!enemy.dead);ui.bossHud.hidden=!boss;if(boss){const ratio=clamp(boss.hp/boss.maxHp,0,1),variant=BOSS_VARIANTS[boss.variant??0];ui.bossName.textContent=variant.name;ui.bossBar.style.width=`${ratio*100}%`;ui.bossBar.style.background=`linear-gradient(90deg,${variant.color},#ffffff)`;ui.bossHp.textContent=`${Math.ceil(ratio*100)}%`}
  if (!ui.debug.hidden) ui.debug.textContent = `FPS   ${fps.toFixed(0)}\nPLAYER ${Math.hypot(p.vx,p.vy).toFixed(0)} px/s\nENEMY  ${state.enemies.length}\nBULLET ${state.enemyShots.length + state.shots.length}\nHAZARD ${state.hazards.length}\nDROP   ${state.items.length}\nSTAGE  ${state.stageIndex+1}-${state.wave} LOOP ${state.stageLoop}\nNEAR   ${state.stats.near} (${state.stats.dashNear} DASH / ${state.stats.justDodge} JUST)\nESCAPE ${state.stats.escaped}`;
}

function drawBackground() {
  const tier=boostTier(state.boost),stage=state.stageIndex,wave=state.wave,speedFx=clamp((state.visualSpeed-620)/1050,0,1)+state.speedBurst*.72,horizon=126,roadTopL=216,roadTopR=W-216;
  const palette=[
    {sky0:"#182b38",sky1:"#728e87",far:"#486552",land:"#263f2c",land2:"#345537",edge:"#a9b78a"},
    {sky0:"#33282a",sky1:"#99765c",far:"#654735",land:"#493126",land2:"#5a3c2b",edge:"#c0a078"},
    {sky0:"#162331",sky1:"#71818a",far:"#4c5e69",land:"#35454d",land2:"#46575e",edge:"#b7c7c8"}
  ][stage];
  const sky=ctx.createLinearGradient(0,0,0,horizon+150);sky.addColorStop(0,palette.sky0);sky.addColorStop(1,palette.sky1);ctx.fillStyle=sky;ctx.fillRect(-40,-40,W+80,H+80);

  // Muted natural silhouettes keep the combat layer visually dominant.
  ctx.fillStyle=palette.far;ctx.beginPath();ctx.moveTo(-30,horizon+32);for(let x=-30;x<=W+40;x+=55){const n=Math.abs(Math.sin(x*.021+stage*1.7));const peak=stage===0?25+n*35:stage===1?40+n*75:55+n*95;ctx.lineTo(x,horizon-peak)}ctx.lineTo(W+40,horizon+70);ctx.closePath();ctx.fill();
  if(stage===0){ctx.fillStyle="#304b35";ctx.beginPath();ctx.moveTo(0,horizon+20);ctx.quadraticCurveTo(150,horizon-38,320,horizon+18);ctx.quadraticCurveTo(520,horizon-48,W,horizon+14);ctx.lineTo(W,horizon+90);ctx.lineTo(0,horizon+90);ctx.fill()}
  if(stage===1){ctx.fillStyle="#523728";for(let i=0;i<6;i++){const x=i*145-45,h=35+(i%3)*18;ctx.fillRect(x,horizon-h,80,h);ctx.fillRect(x+12,horizon-h-20,54,22)}}
  if(stage===2){ctx.fillStyle="#60717a";for(let i=0;i<7;i++){const x=i*115-55,h=52+(i%3)*31;ctx.beginPath();ctx.moveTo(x,horizon+16);ctx.lineTo(x+58,horizon-h);ctx.lineTo(x+120,horizon+16);ctx.fill()}}

  // Wide, low-detail terrain shoulders frame a nearly black road.
  const terrain=ctx.createLinearGradient(0,horizon,0,H);terrain.addColorStop(0,palette.land2);terrain.addColorStop(1,palette.land);ctx.fillStyle=terrain;ctx.fillRect(0,horizon,W,H-horizon);
  const road=ctx.createLinearGradient(0,horizon,0,H);road.addColorStop(0,"#202427");road.addColorStop(.45,"#12171a");road.addColorStop(1,"#080c0f");ctx.fillStyle=road;ctx.beginPath();ctx.moveTo(roadTopL,horizon);ctx.lineTo(roadTopR,horizon);ctx.lineTo(W-42,H);ctx.lineTo(42,H);ctx.closePath();ctx.fill();

  // Asphalt seams and lane markings are neutral gray so colored bullets never merge into them.
  ctx.lineWidth=1;for(let lane=-2;lane<=2;lane++){ctx.strokeStyle=lane===0?"rgba(225,233,226,.14)":"rgba(180,190,188,.06)";ctx.beginPath();ctx.moveTo(W/2+lane*32,horizon);ctx.lineTo(W/2+lane*126,H);ctx.stroke()}
  for(let i=0;i<18;i++){const phase=(state.scroll*.00145+i/18)%1,t=phase*phase,y=horizon+t*(H-horizon),half=lerp(72,W*.44,t);ctx.strokeStyle=`rgba(220,228,220,${.025+t*.055})`;ctx.beginPath();ctx.moveTo(W/2-half,y);ctx.lineTo(W/2+half,y);ctx.stroke()}
  ctx.strokeStyle=palette.edge;ctx.globalAlpha=.58;ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(roadTopL,horizon);ctx.lineTo(42,H);ctx.moveTo(roadTopR,horizon);ctx.lineTo(W-42,H);ctx.stroke();ctx.globalAlpha=1;
  const offset=state.scroll%160;for(let y=-160+offset;y<H+180;y+=160){const t=clamp((y-horizon)/(H-horizon),0,1),dashW=3+t*9,dashH=17+t*(58+speedFx*35);ctx.fillStyle=`rgba(232,237,226,${.18+t*.48})`;ctx.fillRect(W/2-dashW/2,y,dashW,dashH)}

  // Stage-specific roadside scenery scrolls at different speeds for clear biome changes.
  for(let i=0;i<18;i++){const side=i%2?1:-1,y=((i*113+state.scroll*(1.08+(i%3)*.14))%(H+220))-110,t=clamp((y-horizon)/(H-horizon),0,1),edge=W/2+side*lerp(110,W*.46,t),x=edge+side*(26+(i%4)*19),s=8+t*34;ctx.save();ctx.translate(x,y);
    if(stage===0){ctx.fillStyle="#1c3021";ctx.fillRect(-3,-s*.9,6,s);ctx.fillStyle=i%3?"#3d6840":"#526f46";ctx.beginPath();ctx.arc(0,-s,s*.55,0,6.29);ctx.fill();if(wave>=2&&i%4===0){ctx.strokeStyle="#778572";ctx.lineWidth=2+t*2;ctx.beginPath();ctx.moveTo(0,-s*.5);ctx.lineTo(0,-s*2.1);ctx.moveTo(0,-s*1.7);ctx.lineTo(-s*.65,-s*2.15);ctx.moveTo(0,-s*1.7);ctx.lineTo(s*.65,-s*2.15);ctx.stroke()}}
    else if(stage===1){ctx.fillStyle=i%3?"#3a2923":"#675044";ctx.beginPath();ctx.moveTo(-s*.7,0);ctx.lineTo(-s*.35,-s*.72);ctx.lineTo(s*.25,-s*.9);ctx.lineTo(s*.75,0);ctx.fill();if(wave>=3&&i%4===1){ctx.fillStyle="#28221e";ctx.fillRect(-2,-s*1.8,4,s*1.8);ctx.fillRect(-s*.28,-s*1.45,s*.56,4)}}
    else{ctx.fillStyle=i%3?"#708087":"#89979a";ctx.beginPath();ctx.moveTo(-s,0);ctx.lineTo(-s*.25,-s*.4);ctx.lineTo(s*.35,-s*.28);ctx.lineTo(s,0);ctx.fill();if(wave>=2&&i%3===0){ctx.fillStyle="#23373a";ctx.fillRect(-2,-s*1.4,4,s*1.4);ctx.fillStyle="#36504d";for(let k=0;k<3;k++){ctx.beginPath();ctx.moveTo(0,-s*(.55+k*.3));ctx.lineTo(-s*(.55-k*.08),-s*(.25+k*.3));ctx.lineTo(s*(.55-k*.08),-s*(.25+k*.3));ctx.fill()}}}
    ctx.restore()}

  // Weather grows stronger by wave but stays translucent and away from enemy-bullet colors.
  if(wave>=4){const weatherCount=stage===0?34:stage===1?46:60;ctx.globalAlpha=stage===1?.13:.2;ctx.strokeStyle=stage===1?"#c5aa82":"#e8f1ed";ctx.lineWidth=stage===2?2:1;for(let i=0;i<weatherCount;i++){const x=(i*97+state.time*(stage===1?90:stage===2?-75:125))%(W+100)-50,y=(i*53+state.scroll*(stage===1?.22:.48))%(H+80)-40;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+(stage===2?18:-8),y+18+speedFx*34);ctx.stroke()}ctx.globalAlpha=1}
  if(wave===5){ctx.fillStyle="rgba(24,25,28,.16)";ctx.fillRect(0,0,W,H);ctx.fillStyle="rgba(120,24,30,.12)";ctx.fillRect(0,0,W,horizon+35)}

  // Speed lines remain neutral and confined mostly to the outer edges.
  if(speedFx>.12){ctx.lineWidth=1+speedFx*2;for(let i=0;i<18;i++){const edgeX=i%2?W+32:-32,edgeY=150+(i%9)*102,endX=W/2+(edgeX-W/2)*.28;ctx.strokeStyle="#edf4ef";ctx.globalAlpha=(.018+speedFx*.075)*(1-(i%5)*.1);ctx.beginPath();ctx.moveTo(endX,horizon);ctx.lineTo(edgeX,edgeY+speedFx*135);ctx.stroke()}ctx.globalAlpha=1}
  if(state.speedBurst>.08){ctx.globalAlpha=state.speedBurst*.25;ctx.lineWidth=3;ctx.strokeStyle="#ffffff";ctx.beginPath();ctx.moveTo(roadTopL-8,horizon);ctx.lineTo(30,H);ctx.moveTo(roadTopR+8,horizon);ctx.lineTo(W-30,H);ctx.stroke();ctx.globalAlpha=1}
  for(const s of state.streaks){ctx.globalAlpha=clamp(s.life*2,0,.52);ctx.fillStyle=tier.level===5?"#c8ff2e":"#e8efea";ctx.fillRect(s.x,s.y,2+(speedFx>.7?1:0),s.len)}ctx.globalAlpha=1;
}

function pixelPlayer(x,y,alpha=1,dash=false) {
  const p=state.player, character=CHARACTERS[state.characterId], moving=Math.hypot(p.vx,p.vy)>80;
  const step=moving&&!dash?(Math.sin(state.time*24)>0?2:-2):0;
  const overdrive=boostTier(state.boost).level===5;
  const energy=overdrive||dash?"#c8ff2e":character.accent;
  const spriteKey=`${state.characterId}:${state.outfitId}`, selectedImage=spriteImages.get(spriteKey);
  if(selectedImage?.complete&&selectedImage.naturalWidth){
    const crop=spriteCrops.get(spriteKey)??{x:0,y:0,w:selectedImage.naturalWidth,h:selectedImage.naturalHeight};
    const height=dash?82:72,width=height*(crop.w/crop.h);
    ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.rotate(p.angle+Math.PI/2);ctx.globalAlpha=alpha;if(dash){ctx.translate(0,-3);ctx.scale(.9,1.22)}ctx.drawImage(selectedImage,crop.x,crop.y,crop.w,crop.h,-width/2,-height*.54,width,height);ctx.restore();return;
  }
  ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.rotate(p.angle+Math.PI/2);ctx.globalAlpha=alpha;
  if(dash){ctx.translate(0,-3);ctx.scale(.92,1.28)}

  // rear thrusters and animated legs
  ctx.fillStyle="#050b12";ctx.fillRect(-10,8+step,8,17);ctx.fillRect(2,8-step,8,17);
  ctx.fillStyle="#174252";ctx.fillRect(-8,11+step,5,10);ctx.fillRect(3,11-step,5,10);
  ctx.fillStyle="#d8faff";ctx.fillRect(-9,21+step,7,4);ctx.fillRect(2,21-step,7,4);
  ctx.fillStyle=energy;ctx.fillRect(-7,25+step,3,dash?12:6);ctx.fillRect(4,25-step,3,dash?12:6);
  if(dash){ctx.globalAlpha*=.55;ctx.fillStyle=energy;ctx.fillRect(-6,37,2,13);ctx.fillRect(4,37,2,13);ctx.globalAlpha=alpha}

  // asymmetrical coat tails give the runner a readable silhouette
  ctx.fillStyle="#0a1b27";ctx.fillRect(-14,5,6,15);ctx.fillRect(8,5,6,12);
  ctx.fillStyle="#16718a";ctx.fillRect(-13,8,2,10);ctx.fillRect(11,8,2,7);

  // torso armour, waist and shoulder plates
  ctx.fillStyle="#03080e";ctx.fillRect(-12,-10,24,22);ctx.fillRect(-17,-8,6,12);ctx.fillRect(11,-8,6,12);
  ctx.fillStyle="#123443";ctx.fillRect(-10,-8,20,18);ctx.fillRect(-15,-7,5,9);ctx.fillRect(10,-7,5,9);
  ctx.fillStyle="#d9f9ff";ctx.fillRect(-9,-10,18,5);ctx.fillRect(-14,-9,5,4);ctx.fillRect(9,-9,5,4);
  ctx.fillStyle=energy;ctx.fillRect(-9,-5,4,11);ctx.fillRect(5,-5,4,11);
  ctx.fillStyle="#06131d";ctx.fillRect(-4,-5,8,13);
  ctx.fillStyle="#ff2e78";ctx.fillRect(-3,-2,6,6);
  ctx.fillStyle="#ffd7e4";ctx.fillRect(-1,-1,2,2);
  ctx.fillStyle="#07121b";ctx.fillRect(-7,8,14,6);
  ctx.fillStyle=energy;ctx.fillRect(-4,10,8,2);

  // left arm carries a folded photon blade
  ctx.fillStyle="#061019";ctx.fillRect(-20,-7,6,18);ctx.fillRect(-18,8,5,8);
  ctx.fillStyle="#2c5f70";ctx.fillRect(-18,-5,4,11);
  ctx.fillStyle="#e5fbff";ctx.fillRect(-17,7,3,4);
  ctx.fillStyle=energy;ctx.fillRect(-22,-15,3,27);
  ctx.fillStyle="#ffffff";ctx.fillRect(-21,-18,1,26);

  // right arm and forward-facing pulse pistol
  ctx.fillStyle="#061019";ctx.fillRect(14,-8,6,17);ctx.fillRect(16,-17,7,12);
  ctx.fillStyle="#2c5f70";ctx.fillRect(15,-6,4,10);
  ctx.fillStyle="#e5fbff";ctx.fillRect(17,-15,5,8);
  ctx.fillStyle=energy;ctx.fillRect(19,-25,4,11);ctx.fillRect(18,-27,6,3);
  ctx.fillStyle="#062431";ctx.fillRect(20,-23,2,7);

  // Ray's face, cyan hair and neural headset stay visible from the top-down camera
  ctx.fillStyle="#07131d";ctx.fillRect(-9,-26,18,16);
  ctx.fillStyle="#b9f5ff";ctx.fillRect(-8,-28,16,8);ctx.fillRect(-10,-25,5,12);ctx.fillRect(6,-24,5,10);
  ctx.fillStyle="#4ac9e7";ctx.fillRect(-6,-30,12,5);ctx.fillRect(-9,-27,7,5);ctx.fillRect(2,-27,7,4);
  ctx.fillStyle="#ffd8c7";ctx.fillRect(-5,-23,11,10);
  ctx.fillStyle="#fff1e9";ctx.fillRect(-3,-22,7,3);
  ctx.fillStyle="#102839";ctx.fillRect(-3,-19,2,2);ctx.fillRect(3,-19,2,2);
  ctx.fillStyle="#ff6f9f";ctx.fillRect(0,-16,3,1);ctx.fillRect(4,-29,3,5);
  ctx.fillStyle=energy;ctx.fillRect(-11,-23,3,7);ctx.fillRect(8,-22,3,5);

  // small high-contrast pixels keep the sprite legible at speed
  ctx.fillStyle="#ffffff";ctx.fillRect(-13,-7,3,3);ctx.fillRect(10,-7,3,3);
  ctx.fillStyle=energy;ctx.fillRect(-17,1,2,4);ctx.fillRect(15,1,2,4);
  ctx.restore();
}

function drawTelegraph(e){
  if(e.telegraph<=0)return;const progress=1-e.telegraph/e.telegraphMax,pulse=.45+Math.sin(state.time*34)*.28,color=e.kind==="pursuer"?"#ff315f":e.kind==="sniper"?"#cb78ff":e.kind==="spread"?"#ffbf35":"#ff527f";
  ctx.save();ctx.globalAlpha=clamp(pulse+progress*.25,.18,.9);ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=e.kind==="pursuer"?3:2;
  if(e.kind==="sniper"||e.kind==="pursuer"){
    const d=normalize(e.aimX-e.x,e.aimY-e.y),length=1100,sideX=-d.y,sideY=d.x;ctx.setLineDash(e.kind==="pursuer"?[18,10]:[10,8]);
    const offsets=e.kind==="pursuer"?[-12,0,12]:[0];for(const offset of offsets){ctx.beginPath();ctx.moveTo(e.x+sideX*offset,e.y+sideY*offset);ctx.lineTo(e.x+d.x*length+sideX*offset,e.y+d.y*length+sideY*offset);ctx.stroke()}
    ctx.setLineDash([]);ctx.beginPath();ctx.arc(e.aimX,e.aimY,10+progress*12,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(e.aimX-18,e.aimY);ctx.lineTo(e.aimX+18,e.aimY);ctx.moveTo(e.aimX,e.aimY-18);ctx.lineTo(e.aimX,e.aimY+18);ctx.stroke();
  }else{
    ctx.beginPath();ctx.arc(e.x,e.y,e.r+8+progress*18,0,Math.PI*2);ctx.stroke();if(e.kind==="spread"){ctx.globalAlpha*=.45;ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.arc(e.x,e.y,150,Math.PI*.28,Math.PI*.72);ctx.closePath();ctx.fill()}
  }
  ctx.restore();
}

function drawEnemy(e) {
  const c=e.kind==="pursuer"?BOSS_VARIANTS[e.variant??0].color:ENEMY[e.kind].color; ctx.save();ctx.translate(Math.round(e.x),Math.round(e.y)); if(e.hit>0)ctx.globalAlpha=.55;
  if(e.kind==="pursuer"){
    const stride=Math.sin(e.phase*7)*7;ctx.shadowColor=c;ctx.shadowBlur=18;ctx.fillStyle="#160a14";ctx.fillRect(-42,-31,84,62);ctx.fillStyle=c;ctx.fillRect(-35,-25,70,43);ctx.fillRect(-52,-18,17,25);ctx.fillRect(35,-18,17,25);ctx.fillStyle="#070b12";ctx.fillRect(-24,-15,48,30);ctx.fillStyle="#fff";ctx.fillRect(-14,-9,28,8);ctx.fillStyle="#ffb43f";ctx.fillRect(-10,-7,20,4);ctx.shadowBlur=0;ctx.fillStyle="#251522";ctx.fillRect(-43,25+stride,17,30);ctx.fillRect(26,25-stride,17,30);ctx.fillRect(-62,-8-stride,16,38);ctx.fillRect(46,-8+stride,16,38);ctx.fillStyle="#d7faff";ctx.fillRect(-40,48+stride,12,6);ctx.fillRect(28,48-stride,12,6);ctx.restore();return;
  }
  ctx.fillStyle="#12101b";ctx.fillRect(-e.r,-e.r,e.r*2,e.r*2);ctx.fillStyle=c;
  if(e.kind==="grunt"){ctx.fillRect(-16,-13,32,22);ctx.fillRect(-22,-5,8,18);ctx.fillRect(14,-5,8,18)}
  else if(e.kind==="spread"){ctx.fillRect(-21,-14,42,27);ctx.fillRect(-13,-22,26,9);ctx.fillRect(-27,-3,8,17);ctx.fillRect(19,-3,8,17)}
  else{ctx.fillRect(-13,-20,26,38);ctx.fillRect(-24,-7,48,12);ctx.fillStyle="#fff";ctx.fillRect(-4,-12,8,13)}
  ctx.fillStyle="#330a18";ctx.fillRect(-8,-5,16,9);ctx.fillStyle="#fff";ctx.fillRect(-5,-3,10,3);ctx.restore();
  const ratio=e.hp/e.maxHp;if(ratio<1){ctx.fillStyle="#1d1621";ctx.fillRect(e.x-20,e.y-e.r-11,40,4);ctx.fillStyle=c;ctx.fillRect(e.x-20,e.y-e.r-11,40*ratio,4)}
}

function drawRoadHazard(h){
  ctx.save();ctx.translate(Math.round(h.x),Math.round(h.y));const pulse=.65+Math.sin(state.time*10+h.phase)*.25;
  if(h.type==="floodGate"||h.type==="gridGate"){
    const grid=h.type==="gridGate",color=grid?"#cb78ff":"#00f0ff",gap=h.gap,span=W*.48;ctx.shadowColor=color;ctx.shadowBlur=16;ctx.strokeStyle=color;ctx.lineWidth=grid?6:4;ctx.globalAlpha=.55+pulse*.35;ctx.beginPath();ctx.moveTo(-span,0);ctx.lineTo(-gap,0);ctx.moveTo(gap,0);ctx.lineTo(span,0);ctx.stroke();ctx.globalAlpha=1;ctx.fillStyle="#eaffff";for(let x=-span;x<-gap;x+=34)ctx.fillRect(x,-4,18,8);for(let x=gap+16;x<span;x+=34)ctx.fillRect(x,-4,18,8);ctx.fillStyle=color;ctx.fillRect(-gap-5,-13,5,26);ctx.fillRect(gap,-13,5,26);ctx.globalAlpha=pulse;ctx.beginPath();ctx.moveTo(0,-18);ctx.lineTo(-11,-34);ctx.lineTo(11,-34);ctx.closePath();ctx.fill();ctx.globalAlpha=1;
  }else if(h.type==="car"){
    ctx.shadowColor="#ffb43f";ctx.shadowBlur=10;ctx.fillStyle="#17202a";ctx.fillRect(-22,-34,44,68);ctx.strokeStyle="#dffaff";ctx.lineWidth=3;ctx.strokeRect(-22,-34,44,68);ctx.fillStyle="#274858";ctx.fillRect(-15,-22,30,27);ctx.fillStyle="#ff315f";ctx.fillRect(-16,23,10,6);ctx.fillRect(6,23,10,6);ctx.fillStyle="#ffb43f";ctx.globalAlpha=pulse;ctx.fillRect(-18,-31,12,5);ctx.fillRect(6,-31,12,5);
  }else if(h.type==="barrier"){
    ctx.shadowColor="#ff315f";ctx.shadowBlur=12;ctx.fillStyle="#ffb43f";ctx.fillRect(-48,-14,96,28);ctx.fillStyle="#17131a";for(let x=-42;x<44;x+=24)ctx.fillRect(x,-14,11,28);ctx.strokeStyle="#fff";ctx.lineWidth=2;ctx.strokeRect(-48,-14,96,28);ctx.fillStyle="#ff315f";ctx.globalAlpha=pulse;ctx.fillRect(-43,-8,8,8);ctx.fillRect(35,-8,8,8);
  }else{
    ctx.shadowColor="#c8ff2e";ctx.shadowBlur=18;ctx.fillStyle="#182600";ctx.strokeStyle="#c8ff2e";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-34,28);ctx.lineTo(-22,-26);ctx.lineTo(22,-26);ctx.lineTo(34,28);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle="#eaffb4";ctx.globalAlpha=pulse;for(let y=-15;y<20;y+=13){ctx.beginPath();ctx.moveTo(-10,y+7);ctx.lineTo(0,y-2);ctx.lineTo(10,y+7);ctx.fill()}
  }
  ctx.restore();if(h.y<70){ctx.save();ctx.globalAlpha=.55+Math.sin(state.time*16)*.3;ctx.fillStyle=h.type==="ramp"?"#c8ff2e":h.type==="floodGate"?"#00f0ff":h.type==="gridGate"?"#cb78ff":"#ff315f";ctx.beginPath();ctx.moveTo(h.x,88);ctx.lineTo(h.x-9,72);ctx.lineTo(h.x+9,72);ctx.closePath();ctx.fill();ctx.restore()}
}

function drawItem(item){
  ctx.save();ctx.translate(Math.round(item.x),Math.round(item.y));ctx.rotate(item.spin);const pulse=1+Math.sin(state.time*9+item.spin)*.1;ctx.scale(pulse,pulse);
  if(item.type==="core"){ctx.shadowColor="#c8ff2e";ctx.shadowBlur=16;ctx.fillStyle="#172300";ctx.strokeStyle="#c8ff2e";ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(0,-12);ctx.lineTo(10,0);ctx.lineTo(0,12);ctx.lineTo(-10,0);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle="#fff";ctx.fillRect(-2,-5,4,10)}
  else{ctx.shadowColor="#59ffb3";ctx.shadowBlur=16;ctx.fillStyle="#08251b";ctx.strokeStyle="#59ffb3";ctx.lineWidth=3;ctx.fillRect(-11,-11,22,22);ctx.strokeRect(-11,-11,22,22);ctx.fillStyle="#eafff7";ctx.fillRect(-3,-8,6,16);ctx.fillRect(-8,-3,16,6)}ctx.restore();
}

function draw() {
  const shakeX=(Math.random()-.5)*state.shake,shakeY=(Math.random()-.5)*state.shake,dashZoom=1+state.speedBurst*.048;ctx.save();ctx.translate(shakeX+state.camera.x,shakeY+state.camera.y);ctx.translate(W/2,H*.55);ctx.scale(dashZoom,dashZoom);ctx.translate(-W/2,-H*.55);drawBackground();
  for(const ring of state.rings){ctx.globalAlpha=clamp(ring.life/ring.maxLife,0,1)*.7;ctx.strokeStyle=ring.color;ctx.lineWidth=2+ring.life*14;ctx.beginPath();ctx.ellipse(ring.x,ring.y,ring.r,ring.r*.55,0,0,Math.PI*2);ctx.stroke()}ctx.globalAlpha=1;
  for(const g of state.ghosts) pixelPlayer(g.x,g.y,(g.life/g.maxLife)*(g.dash?.46:.25),g.dash);
  const trailP=state.player,trailStrength=clamp(Math.hypot(trailP.vx,trailP.vy)/700,0,.42)+state.speedBurst*.72;if(trailStrength>.12){const backX=-trailP.lastDir.x,backY=-trailP.lastDir.y,trailLength=55+trailStrength*210;for(let i=-1;i<=1;i++){ctx.globalAlpha=trailStrength*(i===0 ? .36 : .18);ctx.strokeStyle=i===0?"#eaffff":CHARACTERS[state.characterId].accent;ctx.lineWidth=i===0?3:2;ctx.beginPath();ctx.moveTo(trailP.x+backY*i*7,trailP.y-backX*i*7);ctx.lineTo(trailP.x+backX*trailLength+backY*i*14,trailP.y+backY*trailLength-backX*i*14);ctx.stroke()}ctx.globalAlpha=1}
  for(const e of state.enemies)drawTelegraph(e);
  for(const hazard of state.hazards)drawRoadHazard(hazard);
  for(const s of state.shots){ctx.save();ctx.translate(s.x,s.y);ctx.rotate(Math.atan2(s.vy,s.vx)+Math.PI/2);if(s.type==="laser"){ctx.shadowColor="#00f0ff";ctx.shadowBlur=12;ctx.fillStyle="#fff";ctx.fillRect(-2,-34,4,68);ctx.fillStyle="#00f0ff";ctx.fillRect(-1,-42,2,84)}else if(s.type==="missile"){ctx.fillStyle="#f7f2dd";ctx.fillRect(-5,-12,10,20);ctx.fillStyle="#ffb43f";ctx.fillRect(-7,8,14,8);ctx.fillStyle="#ff2e78";ctx.fillRect(-3,16,6,9)}else{ctx.fillStyle="#dfffff";ctx.fillRect(-3,-10,6,20);ctx.fillStyle=s.type==="shotgun"?"#ffb43f":"#00eaff";ctx.fillRect(-1,9,2,12)}ctx.restore()}
  for(const b of state.enemyShots){for(const t of b.trail){ctx.globalAlpha=Math.max(0,t.life/.12)*.25;ctx.fillStyle=b.color;ctx.beginPath();ctx.arc(t.x,t.y,b.r*1.4,0,6.28);ctx.fill()}ctx.globalAlpha=1;ctx.shadowColor=b.color;ctx.shadowBlur=13;ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,6.28);ctx.fill();ctx.strokeStyle=b.color;ctx.lineWidth=4;ctx.stroke();ctx.shadowBlur=0}
  for(const e of state.enemies)drawEnemy(e);
  for(const item of state.items)drawItem(item);
  const p=state.player,character=state.characterStats,visual=CHARACTERS[state.characterId];if(p.slashTime>0){const dash=p.dashTime>0,r=(dash?108:72)*character.slashRange;ctx.globalAlpha=clamp(p.slashTime*6,0,.85);ctx.strokeStyle=dash?"#c8ff2e":"#e8ffff";ctx.lineWidth=dash?15:9;ctx.beginPath();ctx.arc(p.x,p.y,r,-2.7,.6);ctx.stroke();ctx.strokeStyle=visual.accent;ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,p.y,r-9,-2.8,.45);ctx.stroke();ctx.globalAlpha=1}
  if(!(p.inv>0&&Math.floor(p.inv*14)%2))pixelPlayer(p.x,p.y,1,p.dashTime>0||p.slideTime>0||state.speedBurst>.45);
  for(const q of state.particles){ctx.globalAlpha=clamp(q.life/q.maxLife,0,1);ctx.fillStyle=q.color;ctx.fillRect(Math.round(q.x-q.size/2),Math.round(q.y-q.size/2),q.size,q.size)}ctx.globalAlpha=1;
  for(const t of state.texts){ctx.globalAlpha=clamp(t.life*2,0,1);ctx.fillStyle=t.color;ctx.font=`900 italic ${t.size}px monospace`;ctx.textAlign="center";ctx.fillText(t.text,t.x,t.y)}ctx.globalAlpha=1;ctx.textAlign="left";
  if(state.flash>0){ctx.fillStyle=`rgba(255,46,120,${state.flash*1.7})`;ctx.fillRect(0,0,W,H)}ctx.restore();
  const speedShade=clamp((state.visualSpeed-700)/1200,0,.34)+state.speedBurst*.2;if(speedShade>0){const vignette=ctx.createRadialGradient(W/2,H*.52,W*.18,W/2,H*.52,W*.68);vignette.addColorStop(0,"rgba(0,0,0,0)");vignette.addColorStop(.7,`rgba(0,10,18,${speedShade*.18})`);vignette.addColorStop(1,`rgba(0,0,0,${speedShade})`);ctx.fillStyle=vignette;ctx.fillRect(0,0,W,H)}
}

let last=performance.now(),fps=60,frames=0,fpsTime=0;
function loop(now){let dt=Math.min(.033,(now-last)/1000);last=now;frames++;fpsTime+=dt;if(fpsTime>.5){fps=frames/fpsTime;frames=0;fpsTime=0}update(dt);draw();input.pressed.clear();requestAnimationFrame(loop)}
updateHud(520);requestAnimationFrame(loop);
