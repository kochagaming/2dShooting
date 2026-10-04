import { clamp, lerp, circlesOverlap, boostTier, nearMissType, normalize, distanceSq } from "./math.js";
import { UPGRADE_KEYS, UPGRADE_DEFS, WEAPON_UPGRADE_KEYS, WEAPON_UPGRADE_DEFS, STAGES, WEAPONS, BOSS_VARIANTS, upgradeCost, weaponUpgradeCost, weaponUpgradeStats, applyUpgrades, applyOutfitModifiers, waveSettings, chooseEnemyType, advanceWave, unlockAfterStageClear, applyEscapePenalty, updateRunRecord, stageMastery, runRank, styleAward, pickRunContract, scaleRunContract, contractProgress } from "./progression.js";

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d", { alpha: false });
ctx.imageSmoothingEnabled = false;
const W = canvas.width, H = canvas.height;
const $ = (id) => document.getElementById(id);

const ui = {
  score: $("score"), combo: $("combo"),comboTimer:$("comboTimer"),comboTimerBar:$("comboTimerBar"), hpBar: $("hpBar"), hpText: $("hpText"),coreCritical:$("coreCritical"),
  boostBar: $("boostBar"), boostValue: $("boostValue"), boostLevel: $("boostLevel"),grazeFlow:$("grazeFlow"),grazeChain:$("grazeChain"),grazeBar:$("grazeBar"),grazeTimer:$("grazeTimer"),grazeStatus:$("grazeStatus"),
  speed: $("speed"), announcer: $("announcer"),launchCountdown:$("launchCountdown"),launchCount:$("launchCount"),trainingHint:$("trainingHint"),trainingText:$("trainingText"),trainingProgress:$("trainingProgress"), debug: $("debug"),focusStatus:$("focusStatus"),dashReadyBar:$("dashReadyBar"),dashReadyText:$("dashReadyText"),slashReadyBar:$("slashReadyBar"),slashReadyText:$("slashReadyText"),slideReadyBar:$("slideReadyBar"),slideReadyText:$("slideReadyText"),
  start: $("startScreen"), gameOver: $("gameOver"), pause: $("pause"),pauseTitle:$("pauseTitle"),resumeButton:$("resumeButton"),audioToggle:$("audioToggle"),pauseHelp:$("pauseHelp"),pauseAbort:$("pauseAbort"),touchPause:$("touchPause"), moduleDraft:$("moduleDraft"),moduleChoices:$("moduleChoices"),stageSelect:$("stageSelect"),stageGrid:$("stageGrid"),selectedStageLabel:$("selectedStageLabel"),selectedRouteButton:$("selectedRouteButton"),
  finalScore: $("finalScore"), maxCombo: $("maxCombo"), resultEyebrow:$("resultEyebrow"),resultTitle:$("resultTitle"),restartLabel:$("restartLabel"),bestRecord:$("bestRecord"),resultRecord:$("resultRecord"),help: $("controlHelp"),keyConfigGrid:$("keyConfigGrid"),resetKeys:$("resetKeys"),settingFocus:$("settingFocus"),settingContrast:$("settingContrast"),settingShake:$("settingShake"),settingFlash:$("settingFlash"),settingHaptics:$("settingHaptics"), spriteSelect: $("spriteSelect"), selectedSpriteLabel: $("selectedSpriteLabel"),
  characterStage: $("characterSelectStage"), outfitStage: $("outfitSelectStage"), outfitGrid: $("outfitGrid"), parameterGrid:$("parameterGrid"), characterStep: $("characterStep"), outfitStep: $("outfitStep"),
  characterViewToggle:$("toggleCharacterView"),outfitViewToggle:$("toggleOutfitView"),characterViewLabel:$("characterViewLabel"),
  outfitName: $("outfitCharacterName"), outfitRole: $("outfitCharacterRole"), characterPassive:$("characterPassive"), keyartImage: $("selectedKeyartImage"), characterName: $("selectedCharacterName"), characterCode: $("selectedCharacterCode"), characterMeta: $("selectedCharacterMeta"), characterLead: $("selectedCharacterLead"),
  stageLabel:$("stageLabel"),waveLabel:$("waveLabel"),eventLabel:$("eventLabel"),waveProgressBar:$("waveProgressBar"),waveCountdown:$("waveCountdown"),weaponLabel:$("weaponLabel"),touchWeaponIcon:$("touchWeaponIcon"),bossHud:$("bossHud"),bossName:$("bossName"),bossBar:$("bossBar"),bossHp:$("bossHp"),bossIntent:$("bossIntent"),runCore:$("runCore"),bankCore:$("bankCore"),upgradeCore:$("upgradeCore"),upgradeGrid:$("upgradeGrid"),weaponUpgradeGrid:$("weaponUpgradeGrid"),contractHint:$("contractHint"),contractLabel:$("contractLabel"),contractBar:$("contractBar"),contractProgress:$("contractProgress"),contractReward:$("contractReward"),stageBriefing:$("stageBriefing"),
  stageReached:$("stageReached"),runReward:$("runReward"),resultCore:$("resultCore"),styleAward:$("styleAward"),resultChip:$("resultChip"),chipGrid:$("chipGrid"),runRank:$("runRank"),resultKills:$("resultKills"),resultNear:$("resultNear"),resultReversal:$("resultReversal"),resultStrong:$("resultStrong"),resultBreach:$("resultBreach"),resultBreaks:$("resultBreaks"),resultGraze:$("resultGraze"),resultDamage:$("resultDamage"),resultTime:$("resultTime"),footerStage:$("footerStage")
};
let helpWasPaused = false;
let selectorWasPaused = false;
let selectionRearView = false;
let selectedChipSlot = 0;
let abortArmedUntil = 0;
let combatFocus=(()=>{try{return localStorage.getItem("velocityBreakerCombatFocus")==="1"}catch{return false}})();
let soundEnabled=(()=>{try{return localStorage.getItem("velocityBreakerSound")!=="0"}catch{return true}})();
let shakeEnabled=(()=>{try{return localStorage.getItem("velocityBreakerShake")!=="0"}catch{return true}})(),flashEnabled=(()=>{try{return localStorage.getItem("velocityBreakerFlash")!=="0"}catch{return true}})(),hapticsEnabled=(()=>{try{return localStorage.getItem("velocityBreakerHaptics")!=="0"}catch{return true}})(),bulletContrast=(()=>{try{return localStorage.getItem("velocityBreakerContrast")!=="0"}catch{return true}})();
const DEFAULT_KEYS={shoot:"KeyZ",dash:"Space",slash:"KeyX",slide:"KeyC",weapon:"KeyQ"},ACTION_LABELS={shoot:"射撃",dash:"ダッシュ",slash:"斬撃",slide:"スライド",weapon:"武器切替"};
let actionKeys=(()=>{try{const saved=JSON.parse(localStorage.getItem("velocityBreakerKeys")||"null")??{};return Object.fromEntries(Object.keys(DEFAULT_KEYS).map(action=>[action,typeof saved[action]==="string"?saved[action]:DEFAULT_KEYS[action]]))}catch{return{...DEFAULT_KEYS}}})(),rebindingAction="";
const CHARACTERS = {
  ray: { name:"RAY", jp:"レイ", role:"BALANCED", code:"ESCAPED SUBJECT // 07", meta:"BALANCED BOOST FIGHTER", topArt:"./assets/ray-key-art.png", passive:{name:"FLOW RECYCLE",description:"NEAR MISSでダッシュ再装填"}, description:"都市警備組織から逃亡した元実験体。BOOST DRIVEで射撃と斬撃を自在につなぐ万能型。", hp:100, speed:1, fireRate:1, shotDamage:1, bulletSpeed:1, dashSpeed:1, dashDuration:1, dashCooldown:1, slashRange:1, slashDamage:1, slashCooldown:1, boostGain:1, pickupRange:1, comboWindow:1, accent:"#00f0ff", defaultOutfit:"7", outfits:[
    {id:"1",name:"SCOUT BOB",note:"丸いボブ＋軽装",perk:"MOVE +4% / HP -4%",mods:{speed:1.04,hp:.96},front:"./assets/characters/ray/front-01.png",rear:"./assets/ray-options/ray-01.png"},
    {id:"4",name:"SUBJECT ZERO",note:"ピクシー＋実験体",perk:"GUN +6% / DASH CD +5%",mods:{shotDamage:1.06,dashCooldown:1.05},front:"./assets/characters/ray/front-04.png",rear:"./assets/ray-options/ray-04.png"},
    {id:"7",name:"FLUFF JACKET",note:"ふわ髪＋大きめ上着",perk:"CORE HP +3%",mods:{hp:1.03},front:"./assets/characters/ray/front-07.png",rear:"./assets/ray-options/ray-07.png"},
    {id:"8",name:"LIGHT KNIGHT",note:"長髪＋騎士装甲",perk:"HP +8% / BLADE +6% / MOVE -5%",mods:{hp:1.08,slashDamage:1.06,speed:.95},front:"./assets/characters/ray/front-08.png",rear:"./assets/ray-options/ray-08.png"},
    {id:"10",name:"NEON COURIER",note:"ポニー＋スポーツ",perk:"MOVE +6% / DASH CD -6% / HP -5%",mods:{speed:1.06,dashCooldown:.94,hp:.95},front:"./assets/characters/ray/front-10.png",rear:"./assets/ray-options/ray-10.png"}
  ]},
  mira: { name:"MIRA", jp:"ミラ", role:"HEAVY GUNNER", code:"WARDEN DEFECTOR // 02", meta:"ARMORED MARKSMAN", topArt:"./assets/characters/mira-front.png?v=front2", passive:{name:"KINETIC AEGIS",description:"被ダメージ軽減＋射撃撃破でBOOST"}, description:"都市警備隊を離反した重装射手。機動力と斬撃を犠牲に、高耐久と高威力射撃で敵を粉砕する。", hp:135, speed:.84, fireRate:.78, shotDamage:1.58, bulletSpeed:1.08, dashSpeed:.86, dashDuration:.92, dashCooldown:1.12, slashRange:.78, slashDamage:.88, slashCooldown:1.1, boostGain:1, pickupRange:1, comboWindow:1, accent:"#ffb43f", defaultOutfit:"1", outfits:[
    {id:"1",name:"WARDEN BREAKER",note:"白橙の制圧装甲",perk:"GUN +3%",mods:{shotDamage:1.03},front:"./assets/characters/mira/front-01.png",rear:"./assets/characters/mira/rear-01.png"},
    {id:"2",name:"BASTION WHITE",note:"要塞型ホワイト装甲",perk:"HP +8% / MOVE -4%",mods:{hp:1.08,speed:.96},front:"./assets/characters/mira/front-02.png",rear:"./assets/characters/mira/rear-02.png"},
    {id:"3",name:"SIEGE BLACK",note:"黒金の攻城装甲",perk:"GUN +8% / FIRE -6%",mods:{shotDamage:1.08,fireRate:.94},front:"./assets/characters/mira/front-03.png",rear:"./assets/characters/mira/rear-03.png"},
    {id:"4",name:"DESERT AEGIS",note:"荒野用フィールド装甲",perk:"MOVE +5% / HP -4%",mods:{speed:1.05,hp:.96},front:"./assets/characters/mira/front-04.png",rear:"./assets/characters/mira/rear-04.png"},
    {id:"5",name:"ARCTIC BULWARK",note:"氷雪用シアン装甲",perk:"DASH CD -6% / BULLET +8%",mods:{dashCooldown:.94,bulletSpeed:1.08},front:"./assets/characters/mira/front-05.png",rear:"./assets/characters/mira/rear-05.png"}
  ]},
  lyn: { name:"LYN", jp:"リン", role:"INTERCEPTOR", code:"STREET UNIT // 13", meta:"CLOSE-RANGE INTERCEPTOR", topArt:"./assets/characters/lyn-front.png?v=front2", passive:{name:"BLADE FEEDBACK",description:"敵弾破壊でダッシュ再装填＋BOOST"}, description:"違法レース育ちの高速迎撃手。低耐久だが、最速のダッシュと巨大ブレードで弾幕の懐へ潜り込む。", hp:80, speed:1.17, fireRate:1.18, shotDamage:.78, bulletSpeed:.96, dashSpeed:1.2, dashDuration:1.13, dashCooldown:.82, slashRange:1.3, slashDamage:1.22, slashCooldown:.82, boostGain:1, pickupRange:1, comboWindow:1, accent:"#ff55a5", defaultOutfit:"1", outfits:[
    {id:"1",name:"STREET COMET",note:"ネオン街の軽量装備",perk:"MOVE +3%",mods:{speed:1.03},front:"./assets/characters/lyn/front-01.png",rear:"./assets/characters/lyn/rear-01.png"},
    {id:"2",name:"RAZOR PUNK",note:"マゼンタの反逆装備",perk:"BLADE +8% / HP -6%",mods:{slashDamage:1.08,hp:.94},front:"./assets/characters/lyn/front-02.png",rear:"./assets/characters/lyn/rear-02.png"},
    {id:"3",name:"NEON KUNOICHI",note:"忍装束型スピード装備",perk:"RANGE +8% / DASH CD -6%",mods:{slashRange:1.08,dashCooldown:.94},front:"./assets/characters/lyn/front-03.png",rear:"./assets/characters/lyn/rear-03.png"},
    {id:"4",name:"WASTELAND DASHER",note:"荒野用スカベンジャー",perk:"HP +8% / MOVE -4%",mods:{hp:1.08,speed:.96},front:"./assets/characters/lyn/front-04.png",rear:"./assets/characters/lyn/rear-04.png"},
    {id:"5",name:"FROST VANDAL",note:"白青の寒冷地装備",perk:"FIRE +8% / GUN -4%",mods:{fireRate:1.08,shotDamage:.96},front:"./assets/characters/lyn/front-05.png",rear:"./assets/characters/lyn/rear-05.png"}
  ]}
};
const OUTFIT_FX_COLORS={
  ray:{"1":"#52e8ff","4":"#ff5b86","7":"#8eeaff","8":"#ffd86b","10":"#b7ff45"},
  mira:{"1":"#ffb43f","2":"#e9fbff","3":"#ffc84f","4":"#ff8a45","5":"#69eaff"},
  lyn:{"1":"#ff55a5","2":"#ff386f","3":"#c879ff","4":"#ff9f4a","5":"#7de9ff"}
};
const STAGE_PALETTES=[
  {sky0:"#182b38",sky1:"#728e87",far:"#486552",land:"#263f2c",land2:"#345537",edge:"#a9b78a"},
  {sky0:"#302938",sky1:"#a17d69",far:"#6b5549",land:"#374531",land2:"#4f5c3c",edge:"#d0b276"},
  {sky0:"#33282a",sky1:"#99765c",far:"#654735",land:"#493126",land2:"#5a3c2b",edge:"#c0a078"},
  {sky0:"#251d24",sky1:"#805643",far:"#59362e",land:"#34231f",land2:"#493028",edge:"#ad765d"},
  {sky0:"#162331",sky1:"#71818a",far:"#4c5e69",land:"#35454d",land2:"#46575e",edge:"#b7c7c8"},
  {sky0:"#101f31",sky1:"#63869a",far:"#405d70",land:"#293e49",land2:"#385462",edge:"#9cdbea"},
  {sky0:"#111c27",sky1:"#4c6966",far:"#344d4b",land:"#243735",land2:"#304844",edge:"#9db89a"},
  {sky0:"#261d22",sky1:"#76524c",far:"#503a37",land:"#352824",land2:"#49332e",edge:"#b58b72"},
  {sky0:"#0c1629",sky1:"#4e5e78",far:"#313f5a",land:"#202d3d",land2:"#2a3b4d",edge:"#91a9c1"},
  {sky0:"#170f18",sky1:"#60474f",far:"#3f3039",land:"#282026",land2:"#392a31",edge:"#c09aa0"}
];
const DRIVE_CHIPS={
  overclock:{name:"OVERCLOCK",rarity:"COMMON",weight:5,duplicateCore:2,description:"MOVE +6% / HP -4%",mods:{speed:1.06,hp:.96}},
  aegis:{name:"AEGIS PLATE",rarity:"COMMON",weight:5,duplicateCore:2,description:"HP +12% / MOVE -4%",mods:{hp:1.12,speed:.96}},
  trigger:{name:"TRIGGER LOOP",rarity:"RARE",weight:3,duplicateCore:4,description:"FIRE +8% / GUN +3%",mods:{fireRate:1.08,shotDamage:1.03}},
  edge:{name:"EDGE RESONATOR",rarity:"RARE",weight:3,duplicateCore:4,description:"BLADE +10% / RANGE +6%",mods:{slashDamage:1.1,slashRange:1.06}},
  flash:{name:"FLASH CAPACITOR",rarity:"RARE",weight:3,duplicateCore:4,description:"DASH +8% / CD -8%",mods:{dashSpeed:1.08,dashCooldown:.92}},
  hybrid:{name:"DUAL SYNC",rarity:"LEGEND",weight:1,duplicateCore:8,description:"GUN +5% / BLADE +5%",mods:{shotDamage:1.05,slashDamage:1.05}},
  collector:{name:"SALVAGE MAGNET",rarity:"COMMON",weight:5,duplicateCore:2,description:"PICKUP RANGE +25%",mods:{pickupRange:1.25}},
  risk:{name:"RISK AMPLIFIER",rarity:"RARE",weight:3,duplicateCore:4,description:"NEAR BOOST +15% / HP -5%",mods:{boostGain:1.15,hp:.95}},
  tempo:{name:"TEMPO KERNEL",rarity:"LEGEND",weight:1,duplicateCore:8,description:"COMBO TIME +25% / FIRE +4%",mods:{comboWindow:1.25,fireRate:1.04}}
};
const CHIP_SYNERGIES={
  "aegis+overclock":{name:"BALANCED CIRCUIT",description:"HP +5% / MOVE +3%",mods:{hp:1.05,speed:1.03}},
  "aegis+edge":{name:"BULWARK CIRCUIT",description:"HP +6% / RANGE +5%",mods:{hp:1.06,slashRange:1.05}},
  "aegis+trigger":{name:"FORTRESS CIRCUIT",description:"HP +5% / FIRE +5%",mods:{hp:1.05,fireRate:1.05}},
  "flash+overclock":{name:"VELOCITY CIRCUIT",description:"DASH +6% / CD -6%",mods:{dashSpeed:1.06,dashCooldown:.94}},
  "edge+flash":{name:"FLASH CUTTER",description:"DASH +4% / BLADE +7%",mods:{dashSpeed:1.04,slashDamage:1.07}},
  "flash+trigger":{name:"CHASER CIRCUIT",description:"FIRE +5% / CD -4%",mods:{fireRate:1.05,dashCooldown:.96}},
  "hybrid+trigger":{name:"ARSENAL CIRCUIT",description:"GUN +5% / FIRE +5%",mods:{shotDamage:1.05,fireRate:1.05}},
  "edge+hybrid":{name:"RAZOR CIRCUIT",description:"BLADE +8% / RANGE +5%",mods:{slashDamage:1.08,slashRange:1.05}},
  "hybrid+overclock":{name:"BREAKER CIRCUIT",description:"MOVE +4% / GUN +3% / BLADE +3%",mods:{speed:1.04,shotDamage:1.03,slashDamage:1.03}}
  ,"collector+risk":{name:"HUNGER CIRCUIT",description:"PICKUP +10% / NEAR BOOST +8%",mods:{pickupRange:1.1,boostGain:1.08}}
  ,"flash+risk":{name:"REDLINE CIRCUIT",description:"DASH +4% / NEAR BOOST +8%",mods:{dashSpeed:1.04,boostGain:1.08}}
  ,"collector+hybrid":{name:"SCAVENGER CIRCUIT",description:"PICKUP +12% / GUN +3%",mods:{pickupRange:1.12,shotDamage:1.03}}
  ,"tempo+trigger":{name:"RAPID CIRCUIT",description:"COMBO TIME +10% / FIRE +6%",mods:{comboWindow:1.1,fireRate:1.06}}
};
const chipSynergy=(chipIds=[])=>CHIP_SYNERGIES[chipIds.filter(Boolean).sort().join("+")]??null;
const PROFILE_KEY="velocityBreakerProfileV1";
function blankUpgrades(){return Object.fromEntries(Object.keys(CHARACTERS).map(id=>[id,Object.fromEntries(UPGRADE_KEYS.map(key=>[key,0]))]));}
function blankWeaponUpgrades(){return Object.fromEntries(WEAPON_UPGRADE_KEYS.map(key=>[key,0]));}
function blankRecords(){return Object.fromEntries(Object.keys(CHARACTERS).map(id=>[id,updateRunRecord().record]));}
function blankStageRecords(){return Object.fromEntries(STAGES.map((_,index)=>[index,updateRunRecord().record]));}
function normalizeEquippedChips(saved,id){const raw=saved?.[id],list=Array.isArray(raw)?raw:[raw??""];return [0,1].map(slot=>DRIVE_CHIPS[list[slot]]?list[slot]:"").map((chip,index,array)=>chip&&array.indexOf(chip)!==index?"":chip)}
function loadProfile(){
  const fallback={cores:0,unlockedStage:0,endlessUnlocked:false,endlessRecord:{score:0,loop:0,stage:0,wave:0},stageClears:{},stageRecords:blankStageRecords(),upgrades:blankUpgrades(),weaponUpgrades:blankWeaponUpgrades(),chips:[],equippedChips:{ray:["",""],mira:["",""],lyn:["",""]},records:blankRecords()};
  try{const saved=JSON.parse(localStorage.getItem(PROFILE_KEY)||"null");if(!saved)return fallback;const chips=[...new Set((saved.chips??[]).filter(id=>DRIVE_CHIPS[id]))],endlessRecord={score:Math.max(0,Math.floor(Number(saved.endlessRecord?.score)||0)),loop:Math.max(0,Math.floor(Number(saved.endlessRecord?.loop)||0)),stage:clamp(Math.floor(Number(saved.endlessRecord?.stage)||0),0,STAGES.length-1),wave:Math.max(0,Math.floor(Number(saved.endlessRecord?.wave)||0))};return{cores:Math.max(0,Number(saved.cores)||0),unlockedStage:clamp(Math.floor(Number(saved.unlockedStage)||0),0,STAGES.length-1),endlessUnlocked:Boolean(saved.endlessUnlocked),endlessRecord,stageClears:Object.fromEntries(STAGES.map((_,index)=>[index,Math.max(0,Math.floor(Number(saved.stageClears?.[index])||0))])),stageRecords:Object.fromEntries(STAGES.map((_,index)=>[index,updateRunRecord(saved.stageRecords?.[index]).record])),upgrades:Object.fromEntries(Object.keys(CHARACTERS).map(id=>[id,Object.fromEntries(UPGRADE_KEYS.map(key=>[key,clamp(Number(saved.upgrades?.[id]?.[key])||0,0,5)]))])),weaponUpgrades:Object.fromEntries(WEAPON_UPGRADE_KEYS.map(key=>[key,clamp(Number(saved.weaponUpgrades?.[key])||0,0,5)])),chips,equippedChips:Object.fromEntries(Object.keys(CHARACTERS).map(id=>[id,normalizeEquippedChips(saved.equippedChips,id).map(chip=>chips.includes(chip)?chip:"")])),records:Object.fromEntries(Object.keys(CHARACTERS).map(id=>[id,updateRunRecord(saved.records?.[id]).record]))}}catch{return fallback}
}
let profile=loadProfile();
function saveProfile(){try{localStorage.setItem(PROFILE_KEY,JSON.stringify(profile))}catch{}}
let selectedStage=(()=>{try{return clamp(Math.floor(Number(localStorage.getItem("selectedStage"))||0),0,profile.unlockedStage)}catch{return 0}})();
let selectedEndless=(()=>{try{return profile.endlessUnlocked&&localStorage.getItem("selectedMode")==="endless"}catch{return false}})();
let selectedCharacter = (()=>{try{const id=localStorage.getItem("selectedCharacter");return CHARACTERS[id]?id:"ray"}catch{return "ray"}})();
const selectedOutfits = Object.fromEntries(Object.entries(CHARACTERS).map(([id,c])=>[id,(()=>{try{return c.outfits.some(o=>o.id===localStorage.getItem(`outfit:${id}`))?localStorage.getItem(`outfit:${id}`):c.defaultOutfit}catch{return c.defaultOutfit}})()]));
const outfitFor=(characterId,outfitId=selectedOutfits[characterId])=>CHARACTERS[characterId].outfits.find(outfit=>outfit.id===outfitId)??CHARACTERS[characterId].outfits[0];
const effectiveCharacter=(id)=>{const chipIds=profile.equippedChips[id],withChips=chipIds.reduce((stats,chipId)=>DRIVE_CHIPS[chipId]?applyOutfitModifiers(stats,DRIVE_CHIPS[chipId].mods):stats,applyOutfitModifiers(applyUpgrades(CHARACTERS[id],profile.upgrades[id]),outfitFor(id).mods)),synergy=chipSynergy(chipIds);return synergy?applyOutfitModifiers(withChips,synergy.mods):withChips};
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
for(const [characterId,c] of Object.entries(CHARACTERS))for(const outfit of c.outfits)loadSprite(`${characterId}:${outfit.id}`,outfit.rear);
const activeCharacter=()=>CHARACTERS[selectedCharacter];
const activeOutfit=()=>outfitFor(selectedCharacter);
const playerAccent=()=>OUTFIT_FX_COLORS[state?.characterId??selectedCharacter]?.[state?.outfitId??selectedOutfits[selectedCharacter]]??CHARACTERS[state?.characterId??selectedCharacter].accent;

function updateSpriteSelection() {
  const c=activeCharacter(),outfit=activeOutfit();
  document.querySelectorAll(".character-card").forEach(card=>{const cardCharacter=CHARACTERS[card.dataset.character],cardOutfit=cardCharacter.outfits.find(o=>o.id===selectedOutfits[card.dataset.character])??cardCharacter.outfits[0],image=card.querySelector("img");card.setAttribute("aria-checked",String(card.dataset.character===selectedCharacter));image.src=selectionRearView?cardOutfit.rear:cardOutfit.front;image.alt=`${cardCharacter.jp}の${selectionRearView?"ゲーム中の背面":"正面全身"}`});
  document.querySelectorAll(".sprite-card").forEach(card=>card.setAttribute("aria-checked",String(card.dataset.outfit===outfit.id)));
  ui.selectedSpriteLabel.textContent=`${c.name} // OUTFIT ${String(outfit.id).toUpperCase()} ${outfit.name} // ${outfit.perk}`;
  ui.keyartImage.src=c.topArt;ui.keyartImage.alt=`${c.jp}のトップページ専用キャラクターアート`;ui.characterName.textContent=c.name;ui.characterCode.textContent=c.code;ui.characterMeta.textContent=c.meta;
  ui.characterLead.innerHTML=`<strong>${c.jp}</strong> — ${c.description}<br><em>${c.passive.name}</em> // ${c.passive.description}`;
  ui.bankCore.textContent=profile.cores;ui.upgradeCore.textContent=profile.cores;
  const record=profile.records[selectedCharacter],bestTime=record.clearTime?`${String(Math.floor(record.clearTime/60)).padStart(2,"0")}:${String(Math.floor(record.clearTime%60)).padStart(2,"0")}`:"--:--",score=String(record.score).padStart(6,"0");ui.bestRecord.innerHTML=record.clears?`PERSONAL BEST // <b>${record.rank}</b>　${score}　CLEAR ${bestTime}　×${record.clears}`:record.score?`PERSONAL BEST // <b>${record.rank}</b>　${score}　NO CLEAR`:"PERSONAL BEST // NO DATA";
  ui.focusStatus.textContent=combatFocus?"ON":"OFF";
  updateRouteSummary();
}

function updateRouteSummary(){const stage=STAGES[selectedStage],label=selectedEndless?"ENDLESS // ∞ ROUTE":`STAGE ${selectedStage+1} // ${stage.name}`;ui.selectedStageLabel.textContent=label;ui.selectedRouteButton.textContent=selectedEndless?"SELECT ROUTE // ENDLESS":`SELECT ROUTE // STAGE ${selectedStage+1}`;ui.footerStage.textContent=selectedEndless?"ENDLESS ROUTE":stage.name;renderStageBriefing()}
function renderStageBriefing(){if(!ui.stageBriefing)return;if(selectedEndless){const best=profile.endlessRecord;ui.stageBriefing.innerHTML=`<div><small>THREAT</small><b class="threat-pips">■■■■■■■■■■+</b></div><div><small>HAZARD</small><b>ALL ROUTE HAZARDS</b></div><div><small>TARGET</small><b>10 BOSS ROTATION</b></div><p><strong>BEST // LOOP ${best.loop+1} · S${best.stage+1}-W${best.wave||1}</strong>周回ごとに敵耐久・弾速・出現密度が上昇。撤退地点はありません。<small>SCORE ${String(best.score).padStart(6,"0")} // CHIP REWARD RANDOM</small></p>`;return}const stage=STAGES[selectedStage],boss=BOSS_VARIANTS[selectedStage],pips="■".repeat(selectedStage+1)+"□".repeat(STAGES.length-selectedStage-1),record=profile.stageRecords?.[selectedStage],mastery=stageMastery(record),masteryList=mastery.medals.map(medal=>`<span class="${medal.earned?"earned":""}">${medal.earned?"◆":"◇"} ${medal.label}</span>`).join(""),clearCount=Math.max(record?.clears??0,profile.stageClears?.[selectedStage]??0),discovery=clearCount===0&&profile.chips.length<Object.keys(DRIVE_CHIPS).length;ui.stageBriefing.innerHTML=`<div><small>THREAT ${selectedStage+1}/10</small><b class="threat-pips">${pips}</b></div><div><small>HAZARD</small><b>${stage.hazard}</b></div><div><small>TARGET</small><b>${boss.name}</b></div><p><strong>MASTERY ${mastery.count}/${mastery.total}</strong>${masteryList}<small>各条件の初達成でCORE +2</small><small>CHIP REWARD // ${discovery?"UNDISCOVERED GUARANTEED":"RANDOM DROP"}</small></p>`}
function renderStageSelect(){
  const cards=STAGES.map((stage,index)=>{const locked=index>profile.unlockedStage,record=profile.stageRecords?.[index]??updateRunRecord().record,clears=Math.max(record.clears,profile.stageClears?.[index]??0),bestTime=record.clearTime?`${String(Math.floor(record.clearTime/60)).padStart(2,"0")}:${String(Math.floor(record.clearTime%60)).padStart(2,"0")}`:"--:--",mastery=stageMastery(record),medals=mastery.medals.map(medal=>`<b class="${medal.earned?"earned":""}" title="${medal.label}">${medal.earned?"◆":"◇"}</b>`).join(""),discovery=!clears&&profile.chips.length<Object.keys(DRIVE_CHIPS).length;return `<button class="stage-card${locked?" locked":""}" type="button" data-stage="${index}" ${locked?"disabled":""} aria-checked="${!selectedEndless&&selectedStage===index}"><i>${String(index+1).padStart(2,"0")}</i><b>${stage.name}</b><span>${stage.subtitle}</span><small>${stage.waveCount} WAVE${stage.waveCount>1?"S":""} <span class="mastery-medals" aria-label="MASTERY ${mastery.count}/${mastery.total}">${medals}</span></small><em>${clears?`${record.rank} · ${String(record.score).padStart(6,"0")} · ${bestTime}`:locked?`STAGE ${index} CLEARで解放`:discovery?"READY · NEW CHIP":"READY"}</em></button>`}).join("");
  const endlessBest=profile.endlessRecord,endless=`<button class="stage-card endless${profile.endlessUnlocked?"":" locked"}" type="button" data-endless="true" ${profile.endlessUnlocked?"":"disabled"} aria-checked="${selectedEndless}"><i>∞</i><b>ENDLESS DRIVE</b><span>10ステージを周回し続ける限界走行</span><small>NO FINAL WAVE</small><em>${profile.endlessUnlocked?endlessBest.score?`L${endlessBest.loop+1} · S${endlessBest.stage+1}-W${endlessBest.wave} · ${String(endlessBest.score).padStart(6,"0")}`:"READY":"STAGE 10 CLEARで解放"}</em></button>`;ui.stageGrid.innerHTML=cards+endless;
  ui.stageGrid.querySelectorAll("[data-stage]").forEach(card=>card.addEventListener("click",()=>selectRoute(Number(card.dataset.stage),false)));ui.stageGrid.querySelector("[data-endless]")?.addEventListener("click",()=>selectRoute(0,true));updateRouteSummary();
}
function selectRoute(stageIndex,endless){if(endless&&!profile.endlessUnlocked)return;if(!endless&&(stageIndex<0||stageIndex>profile.unlockedStage))return;selectedEndless=endless;selectedStage=endless?0:stageIndex;try{localStorage.setItem("selectedMode",endless?"endless":"campaign");localStorage.setItem("selectedStage",String(selectedStage))}catch{}renderStageSelect();audio.start();audio.near(false)}
function toggleStageSelect(force){const opening=force??ui.stageSelect.hidden;if(opening){ui.stageSelect.hidden=false;renderStageSelect()}else ui.stageSelect.hidden=true}

function renderUpgrades(){
  const levels=profile.upgrades[selectedCharacter];ui.upgradeCore.textContent=profile.cores;ui.bankCore.textContent=profile.cores;
  ui.upgradeGrid.innerHTML=UPGRADE_KEYS.map(key=>{const def=UPGRADE_DEFS[key],level=levels[key],cost=upgradeCost(level),disabled=cost===null||profile.cores<cost;return `<button class="upgrade-button${cost===null?" max":""}" type="button" data-upgrade="${key}" ${disabled?"disabled":""}><strong>${def.label} <small>LV${level}/5</small></strong><span>${def.jp} // ${def.description}</span><em>${cost===null?"MAX":`◆ ${cost}`}</em></button>`}).join("");
  ui.upgradeGrid.querySelectorAll(".upgrade-button").forEach(button=>button.addEventListener("click",()=>buyUpgrade(button.dataset.upgrade)));
  ui.weaponUpgradeGrid.innerHTML=WEAPON_UPGRADE_KEYS.map(key=>{const def=WEAPON_UPGRADE_DEFS[key],level=profile.weaponUpgrades[key],cost=weaponUpgradeCost(level),disabled=cost===null||profile.cores<cost;return `<button class="upgrade-button${cost===null?" max":""}" type="button" data-weapon-upgrade="${key}" ${disabled?"disabled":""}><strong>${def.label} <small>LV${level}/5</small></strong><span>${def.jp} // ${def.description}</span><em>${cost===null?"MAX":`◆ ${cost}`}</em></button>`}).join("");
  ui.weaponUpgradeGrid.querySelectorAll(".upgrade-button").forEach(button=>button.addEventListener("click",()=>buyWeaponUpgrade(button.dataset.weaponUpgrade)));
  const equipped=profile.equippedChips[selectedCharacter],synergy=chipSynergy(equipped),partnerChip=equipped[1-selectedChipSlot];ui.chipGrid.innerHTML=`<div class="chip-slots">${equipped.map((chipId,index)=>`<button type="button" data-chip-slot="${index}" class="${selectedChipSlot===index?"active":""}"><small>SLOT ${index+1}</small><b>${DRIVE_CHIPS[chipId]?.name??"EMPTY"}</b></button>`).join("")}<div class="chip-synergy${synergy?" active":""}"><small>CHIP ARCHIVE ${profile.chips.length}/${Object.keys(DRIVE_CHIPS).length} // LINK BONUS ${Object.keys(CHIP_SYNERGIES).length}</small><b>${synergy?.name??"NO CIRCUIT"}</b><span>${synergy?.description??"特定の2枚を組み合わせると発動"}</span></div></div><button class="chip-button${equipped[selectedChipSlot]?"":" selected"}" type="button" data-chip=""><b>NO CHIP</b><span>選択中スロットを空にする</span></button>`+Object.entries(DRIVE_CHIPS).map(([id,chip])=>{const unlocked=profile.chips.includes(id),slot=equipped.indexOf(id),candidateLink=partnerChip&&partnerChip!==id?chipSynergy([partnerChip,id]):null;return `<button class="chip-button${slot>=0?" selected":""}${candidateLink?" link-ready":""}${unlocked?"":" locked"}" type="button" data-chip="${id}" data-rarity="${chip.rarity}" ${unlocked?"":"disabled"}><b>${chip.name} <small>${slot>=0?`SLOT ${slot+1}`:chip.rarity}</small></b><span>${unlocked?`${chip.description}${candidateLink?` // LINK: ${candidateLink.name}`:""}`:"LOCKED // ボス撃破で回収"}</span></button>`}).join("");
  ui.chipGrid.querySelectorAll("[data-chip-slot]").forEach(button=>button.addEventListener("click",()=>{selectedChipSlot=Number(button.dataset.chipSlot);renderUpgrades()}));
  ui.chipGrid.querySelectorAll("[data-chip]:not(:disabled)").forEach(button=>button.addEventListener("click",()=>equipChip(button.dataset.chip)));
  renderParameters();
}

function renderParameters(){
  const c=effectiveCharacter(selectedCharacter),values=[
    ["CORE",Math.round(c.hp),`${Math.round(c.hp)} HP`,c.hp/140],
    ["MOVE",Math.round(430*c.speed),`${Math.round(430*c.speed)} px/s`,c.speed/1.25],
    ["GUN",(c.fireRate/.105).toFixed(1),`${(12*c.shotDamage).toFixed(1)} DMG`,c.shotDamage/1.75],
    ["DASH",Math.round(1180*c.dashSpeed),`${(.56*c.dashCooldown).toFixed(2)}s CD`,c.dashSpeed/1.3],
    ["BLADE",(62*c.slashDamage).toFixed(1),`${Math.round(108*c.slashRange)} px`,c.slashDamage/1.4],
    ["FLOW",`${Math.round(c.boostGain*100)}%`,"NEAR BOOST",c.boostGain/1.35],
    ["MAGNET",`${Math.round(c.pickupRange*100)}%`,"PICKUP RANGE",c.pickupRange/1.45],
    ["COMBO",`${(2.4*c.comboWindow).toFixed(1)}s`,"CHAIN WINDOW",c.comboWindow/1.4]
  ];
  ui.parameterGrid.innerHTML=values.map(([label,value,sub,ratio])=>`<div><small>${label}</small><strong>${value}</strong><span>${sub}</span><i><b style="width:${Math.min(100,Math.round(ratio*100))}%"></b></i></div>`).join("");
}

function buyUpgrade(key){
  if(!UPGRADE_KEYS.includes(key))return;const level=profile.upgrades[selectedCharacter][key],cost=upgradeCost(level);if(cost===null||profile.cores<cost)return;
  profile.cores-=cost;profile.upgrades[selectedCharacter][key]++;saveProfile();renderUpgrades();updateSpriteSelection();audio.start();audio.near(true);
}

function buyWeaponUpgrade(key){
  if(!WEAPON_UPGRADE_KEYS.includes(key))return;const level=profile.weaponUpgrades[key],cost=weaponUpgradeCost(level);if(cost===null||profile.cores<cost)return;
  profile.cores-=cost;profile.weaponUpgrades[key]++;saveProfile();renderUpgrades();audio.start();audio.near(true);
}

function equipChip(chipId){
  if(chipId&&!profile.chips.includes(chipId))return;const slots=profile.equippedChips[selectedCharacter],other=slots.indexOf(chipId);if(other>=0&&other!==selectedChipSlot)slots[other]="";slots[selectedChipSlot]=chipId;saveProfile();renderUpgrades();updateSpriteSelection();audio.start();audio.near(false);
}

function awardDriveChip(stageIndex){
  const allEntries=Object.entries(DRIVE_CHIPS),firstRouteClear=(profile.stageClears?.[stageIndex]??0)===1,undiscovered=allEntries.filter(([id])=>!profile.chips.includes(id)),discovery=firstRouteClear&&undiscovered.length>0,entries=discovery?undiscovered:allEntries,total=entries.reduce((sum,[,chip])=>sum+chip.weight,0);let roll=(Math.random()+stageIndex*.071)%1*total,chipId=entries[0][0];for(const [id,chip] of entries){roll-=chip.weight;if(roll<=0){chipId=id;break}}const chip=DRIVE_CHIPS[chipId];if(profile.chips.includes(chipId)){state.runCores+=chip.duplicateCore;state.chipReward=`DUPLICATE ${chip.rarity} // ${chip.name} // CORE +${chip.duplicateCore}`;return}profile.chips.push(chipId);state.chipReward=`${discovery?"ROUTE DISCOVERY // ":""}NEW ${chip.rarity} CHIP // ${chip.name}`;
}

function bankEndlessCheckpoint(x,y){
  if(!state.endless)return;const amount=state.runCores,heal=Math.min(state.player.maxHp-state.player.hp,Math.max(12,Math.round(state.player.maxHp*.18)));if(amount>0){profile.cores+=amount;state.bankedCores+=amount;state.runCores=0}state.player.hp+=heal;state.player.dashCd=0;state.player.slashCd=0;saveProfile();floating(`CHECKPOINT // BANK +${amount}${heal?` // REPAIR +${heal}`:""}`,x,y+108,"#ffffff",13);if(heal)burst(state.player.x,state.player.y,"#59ffb3",16,180);
}

function renderOutfits() {
  const c=activeCharacter();ui.outfitName.textContent=c.name;ui.outfitRole.textContent=c.role;ui.characterPassive.textContent=`${c.passive.name} // ${c.passive.description}`;
  ui.outfitGrid.innerHTML=c.outfits.map((outfit,index)=>`<button class="sprite-card" type="button" data-outfit="${outfit.id}" role="radio"><b>${String(outfit.id).padStart(2,"0").toUpperCase()}</b><img src="${selectionRearView?outfit.rear:outfit.front}" alt="${c.jp} ${outfit.name}の${selectionRearView?"ゲーム中の背面":"正面全身"}"><span>${outfit.name}</span><small>${outfit.note}</small><em>${outfit.perk}</em></button>`).join("");
  ui.outfitGrid.querySelectorAll(".sprite-card").forEach(card=>card.addEventListener("click",()=>chooseOutfit(card.dataset.outfit)));renderUpgrades();updateSpriteSelection();
}

function setSelectionView(rear){selectionRearView=rear;const text=rear?"正面を見る":"背後から見る";ui.characterViewToggle.textContent=text;ui.outfitViewToggle.textContent=text;ui.characterViewToggle.setAttribute("aria-pressed",String(rear));ui.outfitViewToggle.setAttribute("aria-pressed",String(rear));ui.characterViewLabel.textContent=rear?"GAME VIEW // プレイ時の背面":"FRONT VIEW // キャラクター全身";renderOutfits();}

function chooseCharacter(id){if(!CHARACTERS[id])return;selectedCharacter=id;try{localStorage.setItem("selectedCharacter",id)}catch{}renderOutfits();showOutfitStage();audio.start();audio.near(false)}
function chooseOutfit(id){if(!activeCharacter().outfits.some(o=>o.id===id))return;selectedOutfits[selectedCharacter]=id;try{localStorage.setItem(`outfit:${selectedCharacter}`,id)}catch{}renderParameters();updateSpriteSelection();audio.start();audio.near(false)}
function showCharacterStage(){ui.characterStage.hidden=false;ui.outfitStage.hidden=true;ui.characterStep.classList.add("active");ui.outfitStep.classList.remove("active");updateSpriteSelection()}
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
    rebindingAction="";renderKeyConfig();ui.help.hidden = true;
    if (state.mode === "play") state.paused = helpWasPaused;
    ui.pause.hidden = !(state.mode === "play" && state.paused);
  }
}

const input = { keys: new Set(), pressed: new Set(), mouse: false, mouseX: W / 2, mouseY: H / 3, touchX:0, touchY:0,touchShoot:false,gamepadX:0,gamepadY:0,gamepadAimX:0,gamepadAimY:0,gamepadShoot:false,gamepadUsed:false,gamepadButtons:[] };
let gamepadMenuRoot=null,gamepadMenuIndex=0,gamepadMenuAxisLatch=false;
let audio;

class Synth {
  constructor(enabled=true) { this.ctx = null;this.enabled=enabled;this.musicTimer=0;this.musicStep=0; }
  start() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); this.ctx.resume(); }
  tone(freq = 300, duration = .05, type = "square", volume = .025, slide = 0) {
    if (!this.ctx||!this.enabled) return;
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
  setEnabled(enabled){this.enabled=enabled;this.musicTimer=0}
  music(dt,boost,boss=false,enraged=false){if(!this.ctx||!this.enabled)return;this.musicTimer-=dt;if(this.musicTimer>0)return;const overdrive=boost>=95,interval=enraged?.085:overdrive?.105:boss?.145:.19,roots=boss?[55,65,73,82]:[49,55,62,65],root=roots[this.musicStep%roots.length],accent=this.musicStep%4===0;this.tone(root,interval*.68,"square",accent?.008:.004);if(accent)this.tone(root/2,interval*.82,"sawtooth",boss?.009:.006,8);if(overdrive||enraged)this.tone(root*4,interval*.46,"square",enraged?.008:.005,overdrive?85:35);this.musicStep++;this.musicTimer=interval}
}
audio = new Synth(soundEnabled);
function updateAudioToggle(){ui.audioToggle.querySelector("span").textContent=soundEnabled?"SOUND ON":"SOUND OFF";ui.audioToggle.setAttribute("aria-pressed",String(soundEnabled))}
function toggleSound(){soundEnabled=!soundEnabled;try{localStorage.setItem("velocityBreakerSound",soundEnabled?"1":"0")}catch{}audio.setEnabled(soundEnabled);if(soundEnabled){audio.start();audio.near(true)}updateAudioToggle();if(state.mode==="play")announce(soundEnabled?"SOUND // ON":"SOUND // OFF",true)}
updateAudioToggle();ui.audioToggle.addEventListener("click",toggleSound);

const ENEMY = {
  grunt: { hp: 34, r: 21, speed: 78, score: 120, color: "#ff527f", fire: 1.45 },
  spread: { hp: 48, r: 25, speed: 58, score: 200, color: "#ffaf35", fire: 2.05 },
  sniper: { hp: 42, r: 22, speed: 66, score: 240, color: "#b66cff", fire: 1.8 },
  hunter:{hp:58,r:23,speed:92,score:330,color:"#42d9ff",fire:1.55},
  bomber:{hp:76,r:28,speed:48,score:390,color:"#ff684d",fire:2.3},
  pursuer:{ hp:520,r:48,speed:72,score:2500,color:"#ff315f",fire:.82 }
};

const RUN_MODULES=[
  {id:"rapid",icon:"R",name:"RAPID LINK",effect:"連射速度 +12%",detail:"射撃間隔を短縮し、接近中も火力を維持する。"},
  {id:"power",icon:"P",name:"POWER CELL",effect:"射撃威力 +15%",detail:"全武器の一発あたりのダメージを強化する。"},
  {id:"drive",icon:"D",name:"DRIVE SYNC",effect:"移動・ダッシュ速度 +8%",detail:"通常走行とダッシュの最高速度を引き上げる。"},
  {id:"edge",icon:"E",name:"EDGE EXTENDER",effect:"斬撃威力 +18% / 範囲 +12%",detail:"危険な近距離戦と弾消し性能を強化する。"},
  {id:"repair",icon:"+",name:"CORE REPAIR",effect:"最大HP +18 / HP回復",detail:"最大耐久値を増やし、増加分を即時回復する。"}
];
const WEAPON_MODULES={
  pistol:{id:"weapon-pistol",icon:"HG",name:"AKIMBO LINK",effect:"HANDGUN 弾数+1 / 威力+10%",detail:"ハンドガンを同期し、同時射撃数と単発威力を強化する。",weapon:"pistol"},
  shotgun:{id:"weapon-shotgun",icon:"SG",name:"BREACH LOAD",effect:"SHOTGUN 弾数+1 / 威力+10%",detail:"高密度散弾で接近時の瞬間火力を引き上げる。",weapon:"shotgun"},
  laser:{id:"weapon-laser",icon:"LZ",name:"PRISM ARRAY",effect:"LASER 光条+1 / 威力+10%",detail:"並列光条を追加し、移動しながら面を制圧する。",weapon:"laser"},
  missile:{id:"weapon-missile",icon:"MS",name:"SWARM RACK",effect:"MISSILE 弾数+1 / 威力+10%",detail:"追尾弾を追加し、複数目標への圧力を高める。",weapon:"missile"}
};

let state;
function freshState() {
  const character=effectiveCharacter(selectedCharacter);
  return {
    mode: "menu", paused: false, launchTimer:2.25,launchStep:3,time: 0, realTime: 0, scroll: 0, visualSpeed:720, spawnTimer: .5,hazardTimer:2.8,
    characterId:selectedCharacter,outfitId:selectedOutfits[selectedCharacter],characterStats:character,chipLink:chipSynergy(profile.equippedChips[selectedCharacter]),
    stageIndex:selectedEndless?0:selectedStage,stageStart:selectedEndless?0:selectedStage,endless:selectedEndless,wave:1,waveTime:0,stageLoop:0,bossWaveKey:"",runCores:0,bankedCores:0,rewardCommitted:false,styleAwarded:false,chipReward:"",weaponIndex:0,weaponBoosts:{pistol:0,shotgun:0,laser:0,missile:0},lastTier:1,eventTimer:5.5,speedBurst:0,dashSerial:0,chainTime:0,chainCount:0,nearChain:0,nearChainTimer:0,reversalTime:0,pointBlankFxTime:-1,lockTarget:null,moduleLevels:{},modulePicks:0,contract:scaleRunContract(pickRunContract(),selectedStage,selectedEndless),contractAwarded:false,
    score: 0, combo: 0, maxCombo: 0, comboTimer: 0,comboSavePulse:0, boost: 8, shake: 0, flash: 0,
    hitstop: 0, lastAction: 0, announcementId: 0,damageMarker:null, stats: { near: 0, dashNear: 0, justDodge:0, reversals:0, maxGrazeChain:0, hazardDodges:0, bulletBreaks:0, kills: 0, spawned:0, strongKills:0, pointBlankKills:0, overdriveTime:0, escaped:0, damage:0 },training:{enabled:!selectedEndless&&selectedStage===0&&(profile.stageClears?.[0]??0)===0,move:false,shot:false,dash:false,slide:false,weapon:false,bladeBreak:false,dashGraze:false,reversal:false,done:false},
    player: { x: W / 2, y: H * .72, vx: 0, vy: 0, r: 12, hp: character.hp, maxHp:character.hp, fireCd: 0, dashCd: 0, dashTime: 0, dashAge:9, inv: 0, slashCd: 0, slashTime: 0, slideTime:0, slideCd:0, turnCd:0, airTime:0,airMax:.82, angle: -Math.PI / 2, lastDir: { x: 0, y: -1 } },
    shots: [], enemyShots: [], enemies: [], hazards:[],items:[], particles: [], ghosts: [], texts: [], streaks: [], rings:[], delayedBursts:[], camera:{x:0,y:0}
  };
}
function activeWaveDuration(stage=STAGES[state.stageIndex]){return state.training?.enabled&&state.stageIndex===0?stage.duration+18:stage.duration}
state = freshState();

function startGame() {
  audio.start(); state = freshState(); state.mode = "play"; ui.start.hidden = true; ui.gameOver.hidden = true; ui.help.hidden = true; ui.spriteSelect.hidden = true;ui.stageSelect.hidden=true;ui.moduleDraft.hidden=true;ui.pause.hidden=true;ui.launchCountdown.hidden=false;ui.launchCount.textContent="3";ui.touchPause?.setAttribute("aria-pressed","false");
  document.body.classList.add("touch-play");
  document.querySelector(".run-contract").classList.remove("complete");
  const debugParams=new URLSearchParams(location.search),debugStage=Number(debugParams.get("stage")),debugWave=Number(debugParams.get("wave"));if(Number.isFinite(debugStage)&&debugStage>=1){state.stageIndex=clamp(Math.floor(debugStage)-1,0,STAGES.length-1);state.stageStart=state.stageIndex}if(Number.isFinite(debugWave)&&debugWave>=1)state.wave=clamp(Math.floor(debugWave),1,STAGES[state.stageIndex].waveCount);if(debugParams.has("endless"))state.endless=true;
  announce(`STAGE ${state.stageIndex+1} // ${STAGES[state.stageIndex].name}`,true);
  const starterCount=Math.min(2,state.stageIndex);for (let i = 0; i < starterCount; i++) spawnEnemy(i ? "grunt" : "spread", 150 + i * 390, 210 - i * 80);
  const debugEnemy=debugParams.get("enemy");if(debugEnemy&&ENEMY[debugEnemy]&&debugEnemy!=="pursuer")spawnEnemy(debugEnemy,W/2,165);
  if(debugParams.has("boss")){state.wave=STAGES[state.stageIndex].waveCount;state.waveTime=activeWaveDuration();spawnBoss()}
  if(debugParams.has("overload")){const boss=state.enemies.find(enemy=>enemy.kind==="pursuer");if(boss){for(const part of boss.armorParts??[])part.dead=true;boss.hp=boss.maxHp*.4}}
  if(debugParams.has("module"))openModuleDraft();
}

function endGame(clear=false) {
  state.mode = "gameover";state.cleared=clear;input.touchShoot=false;ui.moduleDraft.hidden=true;ui.trainingHint.hidden=true;document.body.classList.remove("touch-play");state.shake = clear?26:18;burst(state.player.x,state.player.y,clear?"#c8ff2e":"#ff2e78",clear?65:40,clear?430:350);audio.boom();
  const style=styleAward(state.stats);if(!state.styleAwarded){state.styleAwarded=true;state.runCores+=style.bonus}
  const rank=runRank({...state.stats,score:state.score,maxCombo:state.maxCombo}),killRate=state.stats.spawned?Math.round(state.stats.kills/state.stats.spawned*100):0;const mins=Math.floor(state.realTime/60),secs=Math.floor(state.realTime%60);
  let stageRecordUpdate=null,endlessBest=false;if(clear&&!state.endless){const before=stageMastery(profile.stageRecords[state.stageIndex]);stageRecordUpdate=updateRunRecord(profile.stageRecords[state.stageIndex],{score:state.score,time:state.realTime,rank,clear:true,killRate,reversals:state.stats.reversals,damage:state.stats.damage});profile.stageRecords[state.stageIndex]=stageRecordUpdate.record;const after=stageMastery(stageRecordUpdate.record);state.masteryBonus=Math.max(0,after.count-before.count)*2;state.runCores+=state.masteryBonus}if(state.endless){const previous=profile.endlessRecord??{score:0,loop:0,stage:0,wave:0},distance=state.stageLoop*STAGES.length+state.stageIndex,previousDistance=previous.loop*STAGES.length+previous.stage,farther=distance>previousDistance||(distance===previousDistance&&state.wave>previous.wave);endlessBest=farther||state.score>previous.score;profile.endlessRecord={score:Math.max(previous.score,state.score),loop:farther?state.stageLoop:previous.loop,stage:farther?state.stageIndex:previous.stage,wave:farther?state.wave:previous.wave}}
  if(!state.rewardCommitted){profile.cores+=state.runCores;state.rewardCommitted=true}
  const recordUpdate=updateRunRecord(profile.records[state.characterId],{score:state.score,time:state.realTime,rank,clear});profile.records[state.characterId]=recordUpdate.record;saveProfile();const recordFlags=[recordUpdate.isBestScore&&"HIGH SCORE",recordUpdate.isBestTime&&"BEST TIME",recordUpdate.isBestRank&&"BEST RANK",stageRecordUpdate?.isBestScore&&"STAGE SCORE",stageRecordUpdate?.isBestTime&&"STAGE TIME",stageRecordUpdate?.isBestRank&&"STAGE RANK",endlessBest&&"ENDLESS BEST",state.masteryBonus&&`MASTERY CORE +${state.masteryBonus}`].filter(Boolean);ui.resultRecord.textContent=recordFlags.length?`NEW RECORD // ${recordFlags.join(" + ")}`:"PERSONAL BEST UNCHANGED";ui.resultRecord.classList.toggle("show",recordFlags.length>0);updateSpriteSelection();
  const campaignComplete=clear&&!state.endless&&state.stageIndex===STAGES.length-1;ui.gameOver.classList.toggle("clear",clear);ui.gameOver.classList.toggle("campaign-complete",campaignComplete);ui.resultEyebrow.textContent=campaignComplete?"CAMPAIGN COMPLETE // ENDLESS DRIVE UNLOCKED":clear?`STAGE ${state.stageIndex+1} COMPLETE // BONUS CORE +${(state.clearBonus??0)+(state.masteryBonus??0)}`:state.endless?"ENDLESS DRIVE TERMINATED":"RUN TERMINATED";ui.resultTitle.innerHTML=campaignComplete?"ENDLESS<br>UNLOCKED":clear?"ROUTE<br>CLEAR":"CORE<br>BREAK";ui.restartLabel.textContent=campaignComplete?"ENTER ∞ DRIVE":clear&&state.stageIndex<STAGES.length-1?"NEXT STAGE":state.endless?"RETRY ∞":"REBOOT";
  ui.finalScore.textContent = String(state.score).padStart(6, "0"); ui.maxCombo.textContent = state.maxCombo;ui.stageReached.textContent=state.endless?`∞ L${state.stageLoop+1} · S${state.stageIndex+1}-W${state.wave}`:clear?`STAGE ${state.stageIndex+1} CLEAR`:`S${state.stageIndex+1}-W${state.wave}`;ui.runReward.textContent=state.runCores+state.bankedCores;ui.resultCore.textContent=profile.cores;ui.styleAward.textContent=`STYLE // ${style.label}${style.bonus?` // CORE +${style.bonus}`:""} // ${style.description}`;ui.resultChip.textContent=state.chipReward||"CHIP // —";ui.bankCore.textContent=profile.cores;ui.runRank.textContent=rank;ui.resultKills.textContent=`${killRate}% (${state.stats.kills}/${state.stats.spawned})`;ui.resultNear.textContent=`${state.stats.near} / J${state.stats.justDodge}`;ui.resultReversal.textContent=state.stats.reversals;ui.resultStrong.textContent=state.stats.strongKills;ui.resultBreach.textContent=state.stats.pointBlankKills;ui.resultBreaks.textContent=state.stats.bulletBreaks;ui.resultGraze.textContent=`×${state.stats.maxGrazeChain}`;ui.resultDamage.textContent=state.stats.damage;ui.resultTime.textContent=`${String(mins).padStart(2,"0")}:${String(secs).padStart(2,"0")}`;ui.gameOver.hidden = false;renderStageSelect();
}

function keyName(e) { return e.code; }
function displayKey(code){return code.replace(/^Key/,"").replace(/^Digit/,"").replace("Space","SPACE").replace("ControlLeft","L-CTRL").replace("ShiftLeft","L-SHIFT")}
function renderKeyConfig(){ui.keyConfigGrid.innerHTML=Object.keys(DEFAULT_KEYS).map(action=>`<button class="key-bind${rebindingAction===action?" listening":""}" type="button" data-bind="${action}"><span>${ACTION_LABELS[action]}</span><b>${rebindingAction===action?"PRESS KEY":displayKey(actionKeys[action])}</b></button>`).join("");ui.keyConfigGrid.querySelectorAll("[data-bind]").forEach(button=>button.addEventListener("click",()=>{rebindingAction=button.dataset.bind;renderKeyConfig()}));document.querySelectorAll("[data-bind-label]").forEach(label=>label.textContent=displayKey(actionKeys[label.dataset.bindLabel]))}
function saveActionKeys(){try{localStorage.setItem("velocityBreakerKeys",JSON.stringify(actionKeys))}catch{}}
function haptic(pattern){
  if(!hapticsEnabled||typeof navigator==="undefined")return;
  if(typeof navigator.vibrate==="function")navigator.vibrate(pattern);
  const pulses=Array.isArray(pattern)?pattern:[pattern],duration=clamp(pulses.reduce((sum,value)=>sum+Number(value||0),0),35,180),strength=clamp(duration/120,.22,1),pad=Array.from(navigator.getGamepads?.()??[]).find(gamepad=>gamepad?.vibrationActuator?.playEffect);
  pad?.vibrationActuator?.playEffect("dual-rumble",{startDelay:0,duration,strongMagnitude:strength,weakMagnitude:Math.max(.18,strength*.62)})?.catch?.(()=>{});
}
function renderVisualSettings(){for(const [button,value] of [[ui.settingFocus,combatFocus],[ui.settingContrast,bulletContrast],[ui.settingShake,shakeEnabled],[ui.settingFlash,flashEnabled],[ui.settingHaptics,hapticsEnabled]]){button.setAttribute("aria-pressed",String(value));button.querySelector("b").textContent=value?"ON":"OFF"}ui.focusStatus.textContent=combatFocus?"ON":"OFF"}
function toggleVisualSetting(setting){if(setting==="focus"){combatFocus=!combatFocus;try{localStorage.setItem("velocityBreakerCombatFocus",combatFocus?"1":"0")}catch{}}if(setting==="contrast"){bulletContrast=!bulletContrast;try{localStorage.setItem("velocityBreakerContrast",bulletContrast?"1":"0")}catch{}}if(setting==="shake"){shakeEnabled=!shakeEnabled;try{localStorage.setItem("velocityBreakerShake",shakeEnabled?"1":"0")}catch{}}if(setting==="flash"){flashEnabled=!flashEnabled;try{localStorage.setItem("velocityBreakerFlash",flashEnabled?"1":"0")}catch{}}if(setting==="haptics"){hapticsEnabled=!hapticsEnabled;try{localStorage.setItem("velocityBreakerHaptics",hapticsEnabled?"1":"0")}catch{}}const enabled=setting==="focus"?combatFocus:setting==="contrast"?bulletContrast:setting==="shake"?shakeEnabled:setting==="flash"?flashEnabled:hapticsEnabled;renderVisualSettings();audio.start();audio.near(false);if(setting==="haptics"&&enabled)haptic(18);if(state.mode==="play")announce(`${setting.toUpperCase()} FX // ${enabled?"ON":"OFF"}`,true)}
function resetAbortButton(){abortArmedUntil=0;ui.pauseAbort.classList.remove("armed");ui.pauseAbort.querySelector("span").textContent="END RUN";ui.pauseAbort.querySelector("small").textContent="回収分を持って終了"}
function requestAbortRun(){const now=performance.now();if(now<abortArmedUntil){resetAbortButton();setPaused(false);endGame(false);return}abortArmedUntil=now+2500;ui.pauseAbort.classList.add("armed");ui.pauseAbort.querySelector("span").textContent="CONFIRM END RUN";ui.pauseAbort.querySelector("small").textContent="もう一度押して終了";haptic([12,35,12]);setTimeout(()=>{if(performance.now()>=abortArmedUntil)resetAbortButton()},2600)}
function setPaused(paused,reason=""){if(state.mode!=="play"||!ui.moduleDraft.hidden)return;state.paused=paused;ui.pause.hidden=!paused;ui.pauseTitle.textContent=paused&&reason?reason:"PAUSED";ui.touchPause?.setAttribute("aria-pressed",String(paused));if(!paused)resetAbortButton();if(paused){input.touchShoot=false;input.touchX=0;input.touchY=0;input.mouse=false;input.gamepadShoot=false;input.keys.clear();input.pressed.clear();$("touchStickKnob")?.style.setProperty("transform","translate(-50%, -50%)")}}
function autoPause(){if(state.mode==="play"&&!state.paused&&ui.moduleDraft.hidden)setPaused(true,"AUTO PAUSED // FOCUS LOST")}
document.addEventListener("visibilitychange",()=>{if(document.hidden)autoPause()});addEventListener("blur",autoPause);
addEventListener("keydown", (e) => {
  const key = keyName(e); if (["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(key)) e.preventDefault();
  if(rebindingAction&&!ui.help.hidden){if(key==="Escape"){rebindingAction="";renderKeyConfig();return}if(!["Enter","KeyH","KeyP","KeyM","KeyV","F3"].includes(key)){const duplicate=Object.keys(actionKeys).find(action=>action!==rebindingAction&&actionKeys[action]===key);if(duplicate)actionKeys[duplicate]=actionKeys[rebindingAction];actionKeys[rebindingAction]=key;saveActionKeys();rebindingAction="";renderKeyConfig();audio.near(true)}return}
  if (!input.keys.has(key)) input.pressed.add(key); input.keys.add(key);
  if (key === "Enter" && state.mode !== "play"&&ui.help.hidden&&ui.spriteSelect.hidden&&ui.stageSelect.hidden) startGame();
  if (key === "KeyR" && state.mode === "gameover"&&ui.help.hidden&&ui.spriteSelect.hidden&&ui.stageSelect.hidden) startGame();
  if(!ui.moduleDraft.hidden&&["Digit1","Digit2","Digit3"].includes(key)){e.preventDefault();ui.moduleChoices.querySelectorAll(".module-card")[Number(key.at(-1))-1]?.click();input.pressed.delete(key);return}
  if (key === "KeyH") toggleHelp();
  if (key === "Escape" && !ui.spriteSelect.hidden) { if(!ui.outfitStage.hidden)showCharacterStage();else toggleSpriteSelect(false); }
  else if (key === "Escape" && !ui.help.hidden) toggleHelp(false);
  else if (key === "Escape" && !ui.stageSelect.hidden) toggleStageSelect(false);
  else if (key === "Escape" && state.mode === "play") setPaused(!state.paused);
  if (key === "F3") { e.preventDefault(); ui.debug.hidden = !ui.debug.hidden; }
  if(key==="KeyV")toggleVisualSetting("focus");
  if(key==="KeyM")toggleSound();
  if (key === "KeyP" && state.mode === "play") setPaused(!state.paused);
});
addEventListener("keyup", (e) => input.keys.delete(keyName(e)));
ui.resetKeys.addEventListener("click",()=>{actionKeys={...DEFAULT_KEYS};rebindingAction="";saveActionKeys();renderKeyConfig();audio.start();audio.near(false)});ui.settingFocus.addEventListener("click",()=>toggleVisualSetting("focus"));ui.settingContrast.addEventListener("click",()=>toggleVisualSetting("contrast"));ui.settingShake.addEventListener("click",()=>toggleVisualSetting("shake"));ui.settingFlash.addEventListener("click",()=>toggleVisualSetting("flash"));ui.settingHaptics.addEventListener("click",()=>toggleVisualSetting("haptics"));renderKeyConfig();renderVisualSettings();
canvas.addEventListener("mousemove", (e) => { const r = canvas.getBoundingClientRect(); input.mouseX = (e.clientX - r.left) * W / r.width; input.mouseY = (e.clientY - r.top) * H / r.height; });
canvas.addEventListener("mousedown", (e) => { audio.start(); if (state.mode !== "play") return; if (e.button === 0) input.mouse = true; if (e.button === 2) input.pressed.add("MouseSlash"); });
canvas.addEventListener("wheel",event=>{if(state.mode!=="play"||state.paused||!ui.moduleDraft.hidden)return;event.preventDefault();audio.start();cycleWeapon(event.deltaY>0?1:-1)},{passive:false});
addEventListener("mouseup", (e) => { if (e.button === 0) input.mouse = false; });
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

function setupTouchControls(){
  const controls=$("touchControls"),stick=$("touchStick"),knob=$("touchStickKnob"),forceTouch=new URLSearchParams(location.search).has("touch"),touchCapable=forceTouch||navigator.maxTouchPoints>0||matchMedia("(pointer: coarse)").matches||innerWidth<=700;
  if(!touchCapable)return;document.body.classList.add("touch-enabled");controls.hidden=false;let stickPointer=null;
  const updateStick=(event)=>{const rect=stick.getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2,max=rect.width*.34,dx=event.clientX-cx,dy=event.clientY-cy,length=Math.hypot(dx,dy),scale=length>max?max/length:1,x=dx*scale,y=dy*scale;input.touchX=x/max;input.touchY=y/max;knob.style.transform=`translate(calc(-50% + ${x}px),calc(-50% + ${y}px))`};
  const releaseStick=(event)=>{if(stickPointer!==event.pointerId)return;stickPointer=null;input.touchX=0;input.touchY=0;knob.style.transform="translate(-50%,-50%)"};
  stick.addEventListener("pointerdown",event=>{event.preventDefault();audio.start();stickPointer=event.pointerId;stick.setPointerCapture(event.pointerId);updateStick(event)});
  stick.addEventListener("pointermove",event=>{if(stickPointer===event.pointerId){event.preventDefault();updateStick(event)}});
  stick.addEventListener("pointerup",releaseStick);stick.addEventListener("pointercancel",releaseStick);stick.addEventListener("lostpointercapture",releaseStick);
  controls.querySelectorAll("[data-touch-key]").forEach(button=>button.addEventListener("pointerdown",event=>{event.preventDefault();audio.start();const virtualKey={Space:"TouchDash",KeyX:"TouchSlash",KeyC:"TouchSlide",KeyQ:"TouchWeapon"}[button.dataset.touchKey]??button.dataset.touchKey;input.pressed.add(virtualKey);button.classList.add("pressed");if(navigator.vibrate)navigator.vibrate(7)}));
  controls.querySelectorAll("[data-touch-key]").forEach(button=>{const release=()=>button.classList.remove("pressed");button.addEventListener("pointerup",release);button.addEventListener("pointercancel",release);button.addEventListener("pointerleave",release)});
  const shoot=controls.querySelector('[data-touch-hold="shoot"]'),releaseShoot=()=>{input.touchShoot=false;shoot.classList.remove("pressed")};
  shoot.addEventListener("pointerdown",event=>{event.preventDefault();audio.start();input.touchShoot=true;shoot.classList.add("pressed");shoot.setPointerCapture(event.pointerId)});shoot.addEventListener("pointerup",releaseShoot);shoot.addEventListener("pointercancel",releaseShoot);shoot.addEventListener("lostpointercapture",releaseShoot);
}
setupTouchControls();
ui.touchPause?.addEventListener("pointerdown",event=>{event.preventDefault();audio.start();setPaused(!state.paused);haptic(8)});
ui.resumeButton.addEventListener("click",()=>setPaused(false));
ui.pauseHelp.addEventListener("click",()=>toggleHelp(true));
ui.pauseAbort.addEventListener("click",requestAbortRun);

function activeGamepadMenu(){
  return [ui.help,ui.spriteSelect,ui.stageSelect,ui.pause,ui.gameOver,ui.start].find(root=>root&&!root.hidden)??null;
}
function gamepadMenuButtons(root){
  return [...root.querySelectorAll("button:not(:disabled)")].filter(button=>!button.closest("[hidden]"));
}
function gamepadMenuStartIndex(root,buttons){const selected=root.querySelector('[aria-checked="true"]:not(:disabled)');return Math.max(0,buttons.indexOf(selected))}
function spatialMenuIndex(buttons,index,dx,dy){
  if(!dx&&!dy)return index;const current=buttons[clamp(index,0,buttons.length-1)],a=current?.getBoundingClientRect();if(!a||(!a.width&&!a.height))return clamp(index+(dx||dy),0,buttons.length-1);const ax=a.left+a.width/2,ay=a.top+a.height/2;let best=index,bestScore=Infinity;
  buttons.forEach((button,candidate)=>{if(candidate===index)return;const b=button.getBoundingClientRect(),vx=b.left+b.width/2-ax,vy=b.top+b.height/2-ay,forward=vx*dx+vy*dy;if(forward<=4)return;const offAxis=Math.abs(vx*dy-vy*dx),score=Math.hypot(vx,vy)+offAxis*2.4;if(score<bestScore){best=candidate;bestScore=score}});return best;
}
function navigateGamepadMenu(root,direction,activate=false,back=false){
  const buttons=gamepadMenuButtons(root);if(!buttons.length)return;
  if(root!==gamepadMenuRoot){gamepadMenuRoot=root;gamepadMenuIndex=gamepadMenuStartIndex(root,buttons)}
  if(back){
    if(root===ui.help)return $("closeHelp").click();
    if(root===ui.stageSelect)return $("closeStageSelect").click();
    if(root===ui.spriteSelect)return ui.outfitStage.hidden?$("closeSpriteSelect").click():$("backToCharacters").click();
    if(root===ui.pause)return ui.resumeButton.click();
  }
  gamepadMenuIndex=clamp(gamepadMenuIndex+direction,0,buttons.length-1);const target=buttons[gamepadMenuIndex];target.focus({preventScroll:true});target.scrollIntoView?.({block:"nearest",inline:"nearest"});
  if(activate){audio.start();target.click();haptic(10)}
}

function pollGamepad(){
  const pad=Array.from(navigator.getGamepads?.()??[]).find(Boolean);if(!pad){input.gamepadX=0;input.gamepadY=0;input.gamepadAimX=0;input.gamepadAimY=0;input.gamepadShoot=false;input.gamepadButtons=[];return}
  const deadzone=value=>Math.abs(value)<.18?0:Math.sign(value)*(Math.abs(value)-.18)/.82;input.gamepadX=deadzone(pad.axes[0]??0);input.gamepadY=deadzone(pad.axes[1]??0);input.gamepadAimX=deadzone(pad.axes[2]??0);input.gamepadAimY=deadzone(pad.axes[3]??0);const buttons=pad.buttons.map(button=>button.pressed||button.value>.55),rising=index=>buttons[index]&&!input.gamepadButtons[index];
  if(buttons.some(Boolean)||Math.hypot(input.gamepadX,input.gamepadY,input.gamepadAimX,input.gamepadAimY)>.12)input.gamepadUsed=true;
  if(!ui.moduleDraft.hidden){for(const [buttonIndex,choiceIndex] of [[0,0],[1,1],[2,2]])if(rising(buttonIndex)){ui.moduleChoices.querySelectorAll(".module-card")[choiceIndex]?.click();break}input.gamepadButtons=buttons;return}
  const menu=activeGamepadMenu();if(menu){const horizontal=Math.abs(input.gamepadX)>Math.abs(input.gamepadY),axis=horizontal?input.gamepadX:input.gamepadY;if(Math.abs(axis)<.3)gamepadMenuAxisLatch=false;const axisDirection=Math.abs(axis)>.65&&!gamepadMenuAxisLatch?Math.sign(axis):0;if(axisDirection)gamepadMenuAxisLatch=true;const dx=(rising(15)?1:0)-(rising(14)?1:0)||(horizontal?axisDirection:0),dy=(rising(13)?1:0)-(rising(12)?1:0)||(!horizontal?axisDirection:0),menuButtons=gamepadMenuButtons(menu),baseIndex=menu===gamepadMenuRoot?gamepadMenuIndex:gamepadMenuStartIndex(menu,menuButtons),nextIndex=spatialMenuIndex(menuButtons,baseIndex,dx,dy),direction=nextIndex-baseIndex;if(dx||dy||rising(0)||rising(1))navigateGamepadMenu(menu,direction,rising(0),rising(1));input.gamepadButtons=buttons;return}
  gamepadMenuRoot=null;gamepadMenuAxisLatch=false;
  if(Math.abs(input.gamepadX)<.01)input.gamepadX=(buttons[15]?1:0)-(buttons[14]?1:0);if(Math.abs(input.gamepadY)<.01)input.gamepadY=(buttons[13]?1:0)-(buttons[12]?1:0);
  input.gamepadShoot=Boolean(buttons[0]||buttons[7]);if(rising(4)||rising(5))input.pressed.add("PadDash");if(rising(2))input.pressed.add("PadSlash");if(rising(1))input.pressed.add("PadSlide");if(rising(3))input.pressed.add("PadWeapon");if(rising(9)&&state.mode==="play"&&ui.moduleDraft.hidden)setPaused(!state.paused);input.gamepadButtons=buttons;
}
addEventListener("gamepadconnected",()=>{if(state.mode==="play")announce("GAMEPAD // LINKED",true)});addEventListener("gamepaddisconnected",()=>{const wasUsed=input.gamepadUsed;input.gamepadX=0;input.gamepadY=0;input.gamepadAimX=0;input.gamepadAimY=0;input.gamepadShoot=false;input.gamepadUsed=false;input.gamepadButtons=[];if(wasUsed&&state.mode==="play"&&!state.paused)setPaused(true,"CONTROLLER DISCONNECTED")});

function openModuleDraft(){
  const weapon=WEAPONS[state.weaponIndex],weaponModule=WEAPON_MODULES[weapon.id],genericCount=(state.weaponBoosts[weapon.id]??0)<3?2:3,choices=[...RUN_MODULES].sort(()=>Math.random()-.5).slice(0,genericCount);if(genericCount===2)choices.push(weaponModule);choices.sort(()=>Math.random()-.5);state.paused=true;input.touchShoot=false;ui.moduleDraft.hidden=false;
  ui.moduleChoices.innerHTML=choices.map((module,index)=>`<button class="module-card" type="button" data-module="${module.id}"><small>0${index+1}</small><i>${module.icon}</i><strong>${module.name}</strong><span>${module.detail}</span><em>${module.effect}</em></button>`).join("");
  ui.moduleChoices.querySelectorAll(".module-card").forEach(button=>button.addEventListener("click",()=>chooseRunModule(button.dataset.module)));
}
function chooseRunModule(id){
  const module=[...RUN_MODULES,...Object.values(WEAPON_MODULES)].find(entry=>entry.id===id);if(!module||ui.moduleDraft.hidden)return;const c=state.characterStats,p=state.player;state.moduleLevels[id]=(state.moduleLevels[id]??0)+1;state.modulePicks++;if(module.weapon)state.weaponBoosts[module.weapon]=Math.min(3,(state.weaponBoosts[module.weapon]??0)+1);
  if(id==="rapid")c.fireRate*=1.12;if(id==="power")c.shotDamage*=1.15;if(id==="drive"){c.speed*=1.08;c.dashSpeed*=1.08}if(id==="edge"){c.slashDamage*=1.18;c.slashRange*=1.12}if(id==="repair"){p.maxHp+=18;p.hp=Math.min(p.maxHp,p.hp+30)}
  ui.moduleDraft.hidden=true;state.paused=false;p.inv=Math.max(p.inv,.75);state.boost=clamp(state.boost+8,0,100);state.speedBurst=Math.max(state.speedBurst,.35);state.shake=8;state.rings.push({x:p.x,y:p.y,r:16,life:.42,maxLife:.42,color:"#c8ff2e"});announce(`${module.name} // SYNC`,true);floating(`${module.effect} // SAFE .75s`,p.x,p.y-45,"#c8ff2e",13);audio.overdrive();
}
$("startButton").addEventListener("click", startGame); $("restartButton").addEventListener("click", startGame);$("openHelp").addEventListener("click",()=>toggleHelp(true)); $("closeHelp").addEventListener("click", () => toggleHelp(false));
$("openSpriteSelect").addEventListener("click",()=>toggleSpriteSelect(true));$("closeSpriteSelect").addEventListener("click",()=>toggleSpriteSelect(false));
$("openStageSelect").addEventListener("click",()=>toggleStageSelect(true));$("closeStageSelect").addEventListener("click",()=>toggleStageSelect(false));$("resultRoute").addEventListener("click",()=>toggleStageSelect(true));$("resultUpgrade").addEventListener("click",()=>toggleSpriteSelect(true));
$("backToCharacters").addEventListener("click",showCharacterStage);ui.characterViewToggle.addEventListener("click",()=>setSelectionView(!selectionRearView));ui.outfitViewToggle.addEventListener("click",()=>setSelectionView(!selectionRearView));document.querySelectorAll(".character-card").forEach(card=>card.addEventListener("click",()=>chooseCharacter(card.dataset.character)));setSelectionView(false);

const down = (...keys) => keys.some(k => input.keys.has(k));
const tapped = (...keys) => keys.some(k => input.pressed.has(k));
function movementInput(){
  const keyboardX=(down("KeyD","ArrowRight")?1:0)-(down("KeyA","ArrowLeft")?1:0),keyboardY=(down("KeyS","ArrowDown")?1:0)-(down("KeyW","ArrowUp")?1:0);
  if(keyboardX||keyboardY)return normalize(keyboardX,keyboardY,0,0);
  const touchMagnitude=Math.hypot(input.touchX,input.touchY);if(touchMagnitude>.01)return touchMagnitude>1?{x:input.touchX/touchMagnitude,y:input.touchY/touchMagnitude}:{x:input.touchX,y:input.touchY};
  const gamepadMagnitude=Math.hypot(input.gamepadX,input.gamepadY);return gamepadMagnitude>1?{x:input.gamepadX/gamepadMagnitude,y:input.gamepadY/gamepadMagnitude}:{x:input.gamepadX,y:input.gamepadY};
}

function spawnEnemy(kind, x = 70 + Math.random() * (W - 140), y = -50) {
  const cfg = ENEMY[kind],settings=waveSettings(state.stageIndex,state.wave,state.stageLoop),hp=Math.round(cfg.hp*settings.hpScale);
  const escapeTime={spread:9.2,sniper:8.1,hunter:8.5,bomber:10.5}[kind]??7.2;
  const enemy={ kind, x, y, vx: 0, vy: 0, r: cfg.r, hp, maxHp:hp, fireScale:settings.fireScale,moveScale:1+(settings.hpScale-1)*.12,fire: cfg.fire/settings.fireScale * (.75 + Math.random() * .45),telegraph:0,telegraphMax:0,aimX:x,aimY:H,phase: Math.random() * 6.28,age:0,escapeAt:escapeTime+Math.random()*2.2,escaping:false,escapeCounted:false,hit: 0, dead: false };state.enemies.push(enemy);state.stats.spawned++;return enemy;
}

function spawnBoss(){
  const key=`${state.stageLoop}:${state.stageIndex}`;if(state.bossWaveKey===key||state.wave!==STAGES[state.stageIndex].waveCount)return;state.bossWaveKey=key;const boss=spawnEnemy("pursuer",W/2,185),variant=BOSS_VARIANTS[state.stageIndex%BOSS_VARIANTS.length],partHp=Math.round(72*(1+state.stageIndex*.2+state.stageLoop*.18)),legHp=Math.round(54*(1+state.stageIndex*.18+state.stageLoop*.16));boss.variant=state.stageIndex%BOSS_VARIANTS.length;boss.fire=1.1;boss.volley=0;boss.enraged=false;boss.coreExposed=false;boss.armorParts=[{id:"L",name:"LEFT POD",ox:-55,oy:-5,r:19,hp:partHp,maxHp:partHp,dead:false},{id:"R",name:"RIGHT POD",ox:55,oy:-5,r:19,hp:partHp,maxHp:partHp,dead:false}];boss.legParts=[{id:"L",name:"LEFT DRIVE",ox:-34,oy:42,r:16,hp:legHp,maxHp:legHp,dead:false},{id:"R",name:"RIGHT DRIVE",ox:34,oy:42,r:16,hp:legHp,maxHp:legHp,dead:false}];state.enemyShots.length=0;state.shake=14;state.speedBurst=1;announce(`WARNING // ${variant.name.split(" // ")[0]}`,true);audio.overdrive();
}

function spawnWave() {
  const settings=waveSettings(state.stageIndex,state.wave,state.stageLoop),elite=Math.random()<settings.eliteChance,kind=elite?(STAGES[state.stageIndex].theme===2?"hunter":STAGES[state.stageIndex].theme===1?"bomber":Math.random()<.5?"hunter":"bomber"):chooseEnemyType(settings.weights,Math.random()),bossActive=state.enemies.some(enemy=>enemy.kind==="pursuer"&&!enemy.dead);
  spawnEnemy(kind);
  if(Math.random()<settings.groupChance*(bossActive ? .22 : 1))spawnEnemy(chooseEnemyType(settings.weights,Math.random()),80+Math.random()*(W-160),-110);
  const finalWave=state.wave===STAGES[state.stageIndex].waveCount;if(finalWave&&!bossActive&&Math.random()<settings.groupChance*.45)spawnEnemy(STAGES[state.stageIndex].theme===1?"spread":"sniper",80+Math.random()*(W-160),-175);
  state.spawnTimer=settings.spawnInterval*(bossActive?2.25:finalWave?1.35:1)*(.82+Math.random()*.38);
}

function spawnRoadHazard(){
  const lanes=[W*.32,W*.5,W*.68],x=lanes[Math.floor(Math.random()*lanes.length)],stage=STAGES[state.stageIndex],progress=state.wave/stage.waveCount;
  const routeHazard={6:{type:"stormGate",gap:48,speed:238,timer:3.25},7:{type:"emberGate",gap:44,speed:224,timer:3.45},9:{type:"lockdownGate",gap:54,speed:246,timer:3.05}}[state.stageIndex];
  if(routeHazard&&Math.random()<.46){state.hazards.push({type:routeHazard.type,x,y:-70,r:28,speed:routeHazard.speed,dead:false,grazed:false,phase:Math.random()*6.28,gap:routeHazard.gap,baseGap:routeHazard.gap});state.hazardTimer=routeHazard.timer+Math.random()*1.1;return}
  if(state.stageIndex>=5&&Math.random()<.28){const safeSide=Math.random()<.5?-1:1;state.hazards.push({type:"roadSplit",x:W/2,y:-95,r:32,speed:178+state.stageIndex*5,dead:false,grazed:false,phase:Math.random()*6.28,safeSide});state.hazardTimer=5.2+Math.random()*1.4;return}
  if(stage.theme===1){state.hazards.push({type:"floodGate",x,y:-70,r:26,speed:190+state.stageIndex*4,dead:false,grazed:false,phase:Math.random()*6.28,gap:Math.max(42,62-state.stageIndex*2)});state.hazardTimer=4.2+Math.random()*1.6;return}
  if(stage.theme===2){state.hazards.push({type:"gridGate",x,y:-70,r:26,speed:215+state.stageIndex*4,dead:false,grazed:false,phase:Math.random()*6.28,gap:Math.max(34,52-state.stageIndex)});state.hazardTimer=3.7+Math.random()*1.35;return}
  let type="car";if(progress>.45)type=Math.random()<.62?"barrier":"car";if(progress>.7)type=Math.random()<.48?"ramp":"barrier";if(progress>=1)type=Math.random()<.25?"ramp":"car";
  const cfg={car:{r:24,speed:210},barrier:{r:31,speed:165},ramp:{r:28,speed:185}}[type];state.hazards.push({type,x,y:-70,r:cfg.r,speed:cfg.speed,dead:false,grazed:false,phase:Math.random()*6.28});state.hazardTimer=(progress>=1?5.4:3.4+Math.random()*1.8);
}

function updateHazards(dt){
  const p=state.player;state.hazardTimer-=dt;if(state.hazardTimer<=0)spawnRoadHazard();
  for(const hazard of state.hazards){hazard.phase+=dt;if(hazard.type==="gridGate")hazard.x=clamp(hazard.x+Math.sin(hazard.phase*2.4)*42*dt,150,W-150);if(hazard.type==="stormGate")hazard.x=clamp(hazard.x+Math.sin(hazard.phase*8)*95*dt,145,W-145);if(hazard.type==="emberGate")hazard.x=clamp(hazard.x+Math.sin(hazard.phase*3.2)*32*dt,140,W-140);if(hazard.type==="lockdownGate")hazard.gap=Math.max(26,hazard.baseGap-clamp(hazard.y/H,0,1)*24);hazard.y+=(hazard.speed+state.visualSpeed*.43)*dt;const hitRadius=p.r+hazard.r;
    if(!hazard.dead&&hazard.type==="roadSplit"){
      const crossing=Math.abs(hazard.y-p.y)<16,safe=(p.x-W/2)*hazard.safeSide>18;
      if(crossing&&!hazard.grazed){hazard.grazed=true;if(safe){state.stats.hazardDodges++;state.boost=clamp(state.boost+8,0,100);state.score+=220;state.speedBurst=Math.max(state.speedBurst,.5);floating("ROUTE THREAD +8",p.x,p.y-38,"#c8ff2e",16);burst(p.x,p.y,"#c8ff2e",16,210);audio.near(true)}else if(p.inv<=0){hazard.dead=true;hurtPlayer(W/2-hazard.safeSide*120,hazard.y,"ROAD COLLAPSE");state.shake=Math.max(state.shake,22);burst(p.x,p.y,"#ff684d",30,330)}}
      continue;
    }
    if(!hazard.dead&&["floodGate","gridGate","stormGate","emberGate","lockdownGate"].includes(hazard.type)){
      const gateFx={floodGate:{reason:"CANYON GATE",label:"CANYON THREAD",color:"#00f0ff",gain:5},gridGate:{reason:"ICE GRID",label:"ICE BREAK",color:"#cb78ff",gain:7},stormGate:{reason:"LIGHTNING LANE",label:"STORM THREAD",color:"#f4ff64",gain:8},emberGate:{reason:"EMBER WALL",label:"HEAT THREAD",color:"#ff8a3d",gain:7},lockdownGate:{reason:"LOCKDOWN",label:"LOCK THREAD",color:"#ff315f",gain:9}}[hazard.type];
      const crossing=Math.abs(hazard.y-p.y)<13,insideGap=Math.abs(hazard.x-p.x)<hazard.gap-p.r;
      if(crossing&&!insideGap&&p.inv<=0){hazard.dead=true;hurtPlayer(hazard.x,hazard.y,gateFx.reason);state.shake=Math.max(state.shake,20);burst(p.x,p.y,gateFx.color,26,300)}
      if(!hazard.grazed&&hazard.y>p.y+24){hazard.grazed=true;if(insideGap){const precision=1-Math.min(1,Math.abs(hazard.x-p.x)/hazard.gap),gain=gateFx.gain;state.stats.hazardDodges++;state.boost=clamp(state.boost+gain,0,100);state.score+=Math.round(90+precision*90);state.speedBurst=Math.max(state.speedBurst,.38);floating(`${gateFx.label} +${gain}`,p.x,p.y-34,"#c8ff2e",15);burst(p.x,p.y,gateFx.color,12,180);audio.near(true)}}
      continue;
    }
    if(!hazard.dead&&distanceSq(p,hazard)<hitRadius*hitRadius){
      if(hazard.type==="ramp"){const laneDir=Math.abs(p.lastDir.x)>.25?Math.sign(p.lastDir.x):(p.x<W/2?1:-1);hazard.dead=true;p.airTime=p.airMax;p.inv=Math.max(p.inv,p.airMax);p.x=clamp(p.x+laneDir*W*.22,42,W-42);p.y=clamp(p.y-82,105,H-92);p.vx=laneDir*260;p.vy=-320;state.boost=clamp(state.boost+14,0,100);state.score+=180;state.stats.hazardDodges++;state.speedBurst=1;state.shake=9;state.rings.push({x:p.x,y:p.y,r:16,life:.34,maxLife:.34,color:"#c8ff2e"});floating("LANE JUMP +14",p.x,p.y-42,"#c8ff2e",17);audio.dash()}
      else if(p.inv<=0){hazard.dead=true;hurtPlayer(hazard.x,hazard.y,hazard.type==="barrier"?"ROADBLOCK":"TRAFFIC");state.shake=Math.max(state.shake,19);burst(hazard.x,hazard.y,"#ffb43f",24,280)}
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
  const p=state.player,tier=boostTier(state.boost),runnerSpeed=Math.hypot(p.vx,p.vy),magnetRange=(150+tier.level*28+(runnerSpeed>280?90:0)+(tier.level===5?110:0))*state.characterStats.pickupRange,pullPower=540+tier.level*80+Math.min(220,runnerSpeed*.35);
  for(const item of state.items){
    item.life-=dt;item.spin+=dt*5;const d=Math.sqrt(distanceSq(p,item));
    if(d<magnetRange){const pull=1-d/magnetRange,itemDir=normalize(p.x-item.x,p.y-item.y);item.vx+=itemDir.x*(pullPower*pull+110)*dt;item.vy+=itemDir.y*(pullPower*pull+110)*dt;if(!item.magnetized&&d>24){item.magnetized=true;for(let i=0;i<4;i++)addParticle(item.x,item.y,item.type==="core"?"#c8ff2e":"#59ffb3",(Math.random()-.5)*70,(Math.random()-.5)*70,.16,2)}}
    item.x+=item.vx*dt;item.y+=item.vy*dt;item.vx*=Math.pow(.18,dt);item.vy*=Math.pow(.7,dt);
    if(d<24){item.life=0;if(item.type==="core"){state.runCores+=item.amount;floating(`DRIVE CORE +${item.amount}`,p.x,p.y-38,"#c8ff2e",15);burst(item.x,item.y,"#c8ff2e",12,170);audio.near(true)}else{const repairPower=Math.max(18,Math.round(p.maxHp*.22)),heal=Math.min(p.maxHp-p.hp,repairPower),overflowBoost=Math.round((repairPower-heal)/repairPower*8);p.hp+=heal;state.boost=clamp(state.boost+overflowBoost,0,100);floating(heal?`REPAIR +${heal}${overflowBoost?` // BOOST +${overflowBoost}`:""}`:`REPAIR CONVERT // BOOST +${overflowBoost}`,p.x,p.y-38,"#59ffb3",15);burst(item.x,item.y,"#59ffb3",14,150);audio.near(false)}}
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
  const p = state.player, tier = boostTier(state.boost), character=state.characterStats, weapon=WEAPONS[state.weaponIndex],weaponBoost=state.weaponBoosts[weapon.id]??0,weaponMastery=weaponUpgradeStats(profile.weaponUpgrades[weapon.id]); let dir;
  if (input.mouse) dir = normalize(input.mouseX - p.x, input.mouseY - p.y);
  else if(Math.hypot(input.gamepadAimX,input.gamepadAimY)>.2)dir=normalize(input.gamepadAimX,input.gamepadAimY);
  else if(input.touchShoot){let target=null,best=Infinity;for(const enemy of state.enemies){if(enemy.dead)continue;const d=distanceSq(p,enemy);if(d<best){best=d;target=enemy}}dir=target?normalize(target.x-p.x,target.y-p.y):{x:0,y:-1}}
  else dir = { x: 0, y: -1 };
  p.angle = Math.atan2(dir.y, dir.x); p.fireCd = weapon.fireDelay / (tier.fire*character.fireRate*(1+weaponBoost*.04)*weaponMastery.fireRate); state.lastAction = 0;
  const overdrive=tier.level===5,base={pistol:overdrive?3:tier.level>=4?2:1,shotgun:overdrive?7:5,laser:overdrive?2:1,missile:overdrive?2:1}[weapon.id]+weaponBoost;
  for (let i = 0; i < base; i++) {
    const spread=weapon.id==="shotgun" ? .14 : weapon.id==="pistol" ? .04 : weapon.id==="missile" ? .1 : .018;
    const offset=(i-(base-1)/2)*spread,a=p.angle+offset,shotSpeed=weapon.speed*character.bulletSpeed;
    const shotX=p.x+Math.cos(a)*20,shotY=p.y+Math.sin(a)*20;state.shots.push({ x:shotX,y:shotY,originX:shotX,originY:shotY,vx:Math.cos(a)*shotSpeed,vy:Math.sin(a)*shotSpeed,r:weapon.id==="missile"?7:character.shotDamage>1.2?5:4,damage:weapon.damage*character.shotDamage*(1+weaponBoost*.1)*weaponMastery.damage,life:weapon.id==="shotgun" ? .62 : weapon.id==="missile" ? 2.2 : 1.3,type:weapon.id,trail:[],pierce:weapon.id==="laser"?2:0,hitCount:0,hitEnemies:new Set() });
  }
  state.training.shot=true;addParticle(p.x, p.y - 18, "#bffcff", (Math.random() - .5) * 45, 85, .12, 4); audio.shot();
}

function selectWeapon(index){
  const next=clamp(Math.floor(index),0,WEAPONS.length-1);if(next===state.weaponIndex)return;state.weaponIndex=next;const weapon=WEAPONS[state.weaponIndex];state.player.fireCd=Math.max(state.player.fireCd,.12);announce(`${weapon.label} // ONLINE`,true);floating(weapon.label,state.player.x,state.player.y-42,"#dffaff",15);audio.near(false);
  state.training.weapon=true;
}
function switchWeapon(){selectWeapon((state.weaponIndex+1)%WEAPONS.length)}
function cycleWeapon(direction=1){selectWeapon((state.weaponIndex+Math.sign(direction)+WEAPONS.length)%WEAPONS.length)}

function dash() {
  const p = state.player, tier = boostTier(state.boost), character=state.characterStats; if (p.dashCd > 0) return;
  state.dashSerial++;
  const movement=movementInput(),ix=movement.x,iy=movement.y;
  const d = normalize(ix, iy, p.lastDir.x, p.lastDir.y); const speed = 1180 * tier.dash*character.dashSpeed;
  p.vx = d.x * speed; p.vy = d.y * speed; p.lastDir = d; p.dashTime = .17 * tier.dash*character.dashDuration; p.dashAge=0;p.dashCd = .56*character.dashCooldown / tier.dash; p.inv = .28; p.slideTime=0;state.speedBurst=1;state.shake = 12; state.lastAction = 0;state.camera.x-=d.x*25;state.camera.y-=d.y*25;
  const accent=playerAccent();state.rings.push({x:p.x,y:p.y,r:18,life:.36,maxLife:.36,color:tier.level===5?"#c8ff2e":accent});
  for (let i = 0; i < 32; i++) addParticle(p.x, p.y, tier.level === 5 ? "#c8ff2e" : i%4===0?"#ffffff":accent, -d.x * (120 + Math.random() * 420) + (Math.random() - .5) * 150, -d.y * (120 + Math.random() * 420) + (Math.random() - .5) * 150, .16 + Math.random() * .32, 2 + Math.random() * 6);
  state.training.dash=true;haptic(12);audio.dash();
}

function slide(){
  const p=state.player,tier=boostTier(state.boost),character=state.characterStats;if(p.slideCd>0||p.dashTime>0)return;
  const movement=movementInput(),ix=movement.x,iy=movement.y,d=normalize(ix,iy,p.lastDir.x,p.lastDir.y);
  p.slideTime=.42;p.slideCd=.6;p.inv=Math.max(p.inv,.13);p.vx=d.x*(650+tier.level*28)*character.speed;p.vy=d.y*(650+tier.level*28)*character.speed;p.lastDir=d;state.speedBurst=Math.max(state.speedBurst,.48);state.lastAction=0;state.shake=5;state.rings.push({x:p.x,y:p.y,r:12,life:.24,maxLife:.24,color:"#ffb43f"});
  for(let i=0;i<14;i++)addParticle(p.x-d.x*12,p.y-d.y*12,i%3===0?"#ffb43f":"#78909b",-d.x*(60+Math.random()*150)+(Math.random()-.5)*100,-d.y*(60+Math.random()*150)+(Math.random()-.5)*100,.16+Math.random()*.2,2+Math.random()*4,40);
  state.training.slide=true;
  haptic(7);audio.dash();
}

function preserveCombo(seconds){const target=seconds*state.characterStats.comboWindow;if(state.combo>1&&state.comboTimer<target){state.comboTimer=target;state.comboSavePulse=.28}}

function dashTarget(maxDistance=230){
  const p=state.player;let best=null,bestScore=Infinity;
  for(const enemy of state.enemies){if(enemy.dead)continue;const dx=enemy.x-p.x,dy=enemy.y-p.y,d=Math.hypot(dx,dy),facing=(dx*p.lastDir.x+dy*p.lastDir.y)/Math.max(1,d);if(d<maxDistance&&facing>-.15&&d<bestScore){best=enemy;bestScore=d}}
  return best;
}

function slash() {
  const p = state.player, character=state.characterStats; if (p.slashCd > 0) return;
  const reversal=state.reversalTime>0,dashSlash = p.dashTime > 0;state.reversalTime=0;const target=dashSlash?dashTarget(state.chainTime>0?330:230):null;if(target){state.lockTarget=null;const d=normalize(target.x-p.x,target.y-p.y);p.x=clamp(target.x-d.x*(target.r+24),34,W-34);p.y=clamp(target.y-d.y*(target.r+24),105,H-92);p.vx=d.x*720;p.vy=d.y*720;p.lastDir=d;p.angle=Math.atan2(d.y,d.x);state.ghosts.push({x:p.x-d.x*70,y:p.y-d.y*70,angle:p.angle,life:.28,maxLife:.28,dash:true})}
  p.slashTime = dashSlash ? .22 : .16; p.slashCd = (dashSlash ? .34 : .28)*character.slashCooldown; p.inv = Math.max(p.inv, dashSlash ? .28 : .1); state.lastAction = 0;
  const radius = (dashSlash ? 108 : 72)*character.slashRange*(reversal?1.15:1), damage = (dashSlash ? 62 : 30)*character.slashDamage*(reversal?1.5:1);
  let bulletBreaks=0;
  for (const bullet of state.enemyShots) if (!bullet.dead && distanceSq(p, bullet) < (radius + bullet.r) ** 2) { bullet.dead = true;bulletBreaks++; burst(bullet.x, bullet.y, "#d7fbff", 8, 160); state.boost = clamp(state.boost + (dashSlash ? 2.5 : 1.2)+(state.characterId==="lyn"?.8:0), 0, 100); }
  if(bulletBreaks){const breakScore=bulletBreaks*(dashSlash?45:25);state.stats.bulletBreaks+=bulletBreaks;state.score+=breakScore;preserveCombo(.85);state.hitstop=Math.max(state.hitstop,Math.min(.055,.012+bulletBreaks*.006));state.shake=Math.max(state.shake,Math.min(9,2+bulletBreaks));floating(`BULLET BREAK ×${bulletBreaks} +${breakScore}`,p.x,p.y-34,dashSlash?"#c8ff2e":"#d7fbff",13);if(bulletBreaks>=5)announce(`BLADE CLEAR ×${bulletBreaks}`,true)}
  if(bulletBreaks&&state.characterId==="lyn"){p.dashCd=Math.max(0,p.dashCd-bulletBreaks*.08);floating(`BLADE FEEDBACK ×${bulletBreaks}`,p.x,p.y+34,"#ff6caa",12)}
  let hits = 0;
  for (const enemy of state.enemies) if (!enemy.dead) {if(enemy.kind==="pursuer"){for(const part of enemy.armorParts??[]){const worldPart={x:enemy.x+part.ox,y:enemy.y+part.oy,r:part.r};if(!part.dead&&distanceSq(p,worldPart)<(radius+part.r)**2)damageBossPart(enemy,part,damage*.82)}if((enemy.armorParts??[]).every(part=>part.dead))for(const leg of enemy.legParts??[]){const worldLeg={x:enemy.x+leg.ox,y:enemy.y+leg.oy,r:leg.r};if(!leg.dead&&distanceSq(p,worldLeg)<(radius+leg.r)**2)damageBossLeg(enemy,leg,damage*(dashSlash?1.25:.72))}}if(distanceSq(p, enemy) < (radius + enemy.r) ** 2) { damageEnemy(enemy, damage, dashSlash, normalize(enemy.x - p.x, enemy.y - p.y)); hits++; }}
  if (hits && dashSlash) { state.hitstop = .075; state.shake = 11; announce(target?"LOCK BREAK":"DASH BREAK", true);state.delayedBursts.push({x:target?.x??p.x,y:target?.y??p.y,time:.09,color:"#c8ff2e"}); }
  if(reversal){const connected=hits>0||bulletBreaks>0;if(connected){state.training.reversal=true;state.stats.reversals++;preserveCombo(1.25)}state.hitstop=Math.max(state.hitstop,connected?.1:.025);state.shake=Math.max(state.shake,connected?14:5);floating(connected?`REVERSAL ×1.5 // ${hits?`HIT ×${hits}`:`BREAK ×${bulletBreaks}`}`:"REVERSAL // WHIFF",p.x,p.y-52,connected?"#ffffff":"#8298a0",15);state.rings.push({x:p.x,y:p.y,r:radius*.7,life:.32,maxLife:.32,color:connected?"#ffffff":"#61737a"})}
  for (let i = 0; i < 20; i++) { const a = Math.random() * Math.PI * 2; addParticle(p.x + Math.cos(a) * radius, p.y + Math.sin(a) * radius, dashSlash ? "#c8ff2e" : "#d9fdff", Math.cos(a) * 90, Math.sin(a) * 90, .12 + Math.random() * .18, 2); }
  if(bulletBreaks)state.training.bladeBreak=true;haptic(dashSlash?16:8);audio.slash();
}

function updateTraining(moveSpeed=0){
  const training=state.training;if(!training?.enabled||state.stageIndex!==0){ui.trainingHint.hidden=true;return}
  if(moveSpeed>160)training.move=true;if(state.stats.bulletBreaks>0)training.bladeBreak=true;if(state.stats.dashNear>0)training.dashGraze=true;
  const steps=[
    {key:"move",text:"WASD / STICK // MOVE"},
    {key:"shot",text:`${displayKey(actionKeys.shoot)} / FIRE // SHOOT`},
    {key:"dash",text:`${displayKey(actionKeys.dash)} / DASH // BURST FORWARD`},
    {key:"slide",text:`${displayKey(actionKeys.slide)} / SLIDE // LOW PROFILE`},
    {key:"weapon",text:`${displayKey(actionKeys.weapon)} / WEAPON // SWITCH ROLE`},
    {key:"bladeBreak",text:`${displayKey(actionKeys.slash)} / SLASH // BREAK A BULLET`},
    {key:"dashGraze",text:`${displayKey(actionKeys.dash)} THROUGH FIRE // DASH DODGE`},
    {key:"reversal",text:`JUST DODGE → ${displayKey(actionKeys.slash)} // REVERSAL ×1.5`}
  ];
  const completed=steps.filter(step=>training[step.key]).length,next=steps.find(step=>!training[step.key]);ui.trainingProgress.textContent="■".repeat(completed)+"□".repeat(steps.length-completed);
  if(!next){if(!training.done){training.done=true;announce("DRIVE TRAINING // COMPLETE",true);state.boost=clamp(state.boost+12,0,100)}ui.trainingHint.hidden=true;return}
  ui.trainingText.textContent=next.text;ui.trainingHint.hidden=false;
}

function damageEnemy(enemy, amount, strong = false, dir = { x: 0, y: -1 }) {
  if(enemy.kind==="pursuer"){const alive=(enemy.armorParts??[]).filter(part=>!part.dead).length;amount*=alive===2?.55:alive===1?.78:enemy.coreExposed&&strong?2.4:1;if(enemy.coreExposed&&strong){state.boost=clamp(state.boost+9,0,100);state.hitstop=Math.max(state.hitstop,.13);state.shake=Math.max(state.shake,18);floating("CORE REND ×2.4",enemy.x,enemy.y+75,"#c8ff2e",18);announce("DASH SLASH // CORE REND",true)}}
  const knock=enemy.kind==="pursuer" ? .18 : 1;enemy.hp -= amount; enemy.hit = .1; enemy.x += dir.x * (strong ? 18 : 6)*knock; enemy.y += dir.y * (strong ? 18 : 6)*knock; burst(enemy.x, enemy.y, "#fff", strong ? 10 : 4, strong ? 220 : 100); audio.hit();
  if (enemy.hp <= 0) killEnemy(enemy, strong);
}

function damageBossPart(enemy,part,amount){
  if(part.dead)return;part.hp-=amount;enemy.hit=.08;const x=enemy.x+part.ox,y=enemy.y+part.oy;burst(x,y,"#ffb43f",5,150);audio.hit();
  if(part.hp<=0){part.dead=true;state.score+=650;state.runCores+=1;state.boost=clamp(state.boost+12,0,100);state.hitstop=.11;state.shake=18;state.enemyShots.length=0;announce(`${part.name} // ARMOR BREAK`,true);floating("CORE +1",x,y+28,"#c8ff2e",14);for(let i=0;i<3;i++)state.delayedBursts.push({x:x+(Math.random()-.5)*28,y:y+(Math.random()-.5)*28,time:i*.07,color:i%2?"#fff":"#ffb43f"});audio.boom()}
}

function damageBossLeg(enemy,leg,amount){
  if(leg.dead||(enemy.armorParts??[]).some(part=>!part.dead))return;leg.hp-=amount;enemy.hit=.09;const x=enemy.x+leg.ox,y=enemy.y+leg.oy;burst(x,y,"#00f0ff",6,170);audio.hit();
  if(leg.hp<=0){leg.dead=true;state.score+=800;state.runCores+=1;state.boost=clamp(state.boost+14,0,100);state.hitstop=.12;state.shake=19;state.enemyShots.length=0;announce(`${leg.name} // DRIVE BREAK`,true);floating("CORE +1",x,y+25,"#c8ff2e",14);for(let i=0;i<3;i++)state.delayedBursts.push({x:x+(Math.random()-.5)*24,y:y+(Math.random()-.5)*30,time:i*.065,color:i%2?"#ffffff":"#00f0ff"});audio.boom();if((enemy.legParts??[]).every(part=>part.dead)){enemy.coreExposed=true;enemy.fire=Math.max(enemy.fire,1.15);state.player.dashCd=0;state.chainTime=1.5;state.speedBurst=1;state.shake=24;announce("CORE OPEN // DASH SLASH NOW",true);floating("×2.4 DASH DAMAGE",enemy.x,enemy.y+78,"#c8ff2e",17);state.rings.push({x:enemy.x,y:enemy.y,r:28,life:.55,maxLife:.55,color:"#c8ff2e"});burst(enemy.x,enemy.y,"#ffffff",30,350);audio.overdrive()}}
}

function comboMilestone(value){
  if(value===10){state.boost=clamp(state.boost+6,0,100);announce("10 COMBO // BOOST +6",true)}
  else if(value===20){state.boost=clamp(state.boost+10,0,100);state.player.dashCd=0;announce("20 COMBO // DASH READY",true)}
  else if(value===50){state.boost=100;state.player.dashCd=0;state.player.slashCd=0;announce("50 COMBO // OVERDRIVE",true)}
  else return;state.speedBurst=1;state.shake=Math.max(state.shake,value===50?18:10);state.rings.push({x:state.player.x,y:state.player.y,r:18,life:.42,maxLife:.42,color:value===50?"#ffffff":"#c8ff2e"});burst(state.player.x,state.player.y,value===50?"#ffffff":"#c8ff2e",value===50?34:20,280);haptic(value===50?[12,24,18]:10);audio.overdrive();
}

function killEnemy(enemy, strong) {
  if (enemy.dead) return; enemy.dead = true; const cfg = ENEMY[enemy.kind];
  state.combo++; state.maxCombo = Math.max(state.maxCombo, state.combo); state.comboTimer = 2.4*state.characterStats.comboWindow; state.score += Math.round(cfg.score * (1 + Math.min(3, state.combo / 12))); state.boost = clamp(state.boost + 4 + Math.min(6, state.combo * .15) + (strong ? 3 : 0), 0, 100); state.stats.kills++;if(strong)state.stats.strongKills++;if(state.time-(enemy.pointBlankAt??-9)<.06)state.stats.pointBlankKills++;
  burst(enemy.x, enemy.y, cfg.color, strong ? 28 : 18, strong ? 330 : 240); burst(enemy.x, enemy.y, "#fff", 8, 220); state.hitstop = strong ? .085 : .042; state.shake = strong ? 13 : 7; audio.boom();
  floating(`+${cfg.score}`, enemy.x, enemy.y, cfg.color, 17);comboMilestone(state.combo);
  if(strong){state.player.dashCd=0;state.chainTime=1.15;state.chainCount++;floating(`CHAIN DASH ×${state.chainCount}`,state.player.x,state.player.y+35,"#c8ff2e",12)}
  if(state.characterId==="mira"&&!strong){state.boost=clamp(state.boost+2,0,100);floating("AEGIS CHARGE +2",enemy.x,enemy.y+24,"#ffb43f",11)}
  if(enemy.kind==="pursuer"){const variant=BOSS_VARIANTS[(enemy.variant??0)%BOSS_VARIANTS.length];state.boost=clamp(state.boost+25,0,100);state.score+=2500;state.enemyShots.length=0;state.runCores+=5;state.hitstop=.18;state.shake=24;state.speedBurst=1;announce(`${variant.name.split(" // ")[0]} BREAK // CORE +5`,true);for(let i=0;i<4;i++)state.delayedBursts.push({x:enemy.x+(Math.random()-.5)*90,y:enemy.y+(Math.random()-.5)*70,time:.06+i*.08,color:i%2?"#fff":variant.color});if(state.endless){awardDriveChip(state.stageIndex);floating("DRIVE CHIP RECOVERED",enemy.x,enemy.y+86,"#c8ff2e",14);bankEndlessCheckpoint(enemy.x,enemy.y)}else{const cleared=state.stageIndex,bonus=4+cleared,unlock=unlockAfterStageClear(profile.unlockedStage,cleared);state.clearBonus=bonus;state.runCores+=bonus;state.score+=3000+cleared*500;profile.stageClears[cleared]=(profile.stageClears[cleared]??0)+1;awardDriveChip(cleared);profile.unlockedStage=unlock.unlockedStage;profile.endlessUnlocked=profile.endlessUnlocked||unlock.endlessUnlocked;if(cleared<STAGES.length-1){selectedStage=cleared+1;selectedEndless=false}else{selectedStage=STAGES.length-1;selectedEndless=true}try{localStorage.setItem("selectedStage",String(selectedStage));localStorage.setItem("selectedMode",selectedEndless?"endless":"campaign")}catch{}saveProfile();endGame(true)}return}
  const coreChance=.28+(strong ? .1 : 0)+state.stageIndex*.035+Math.min(.1,state.combo*.004);
  if(Math.random()<coreChance)dropItem("core",enemy.x,enemy.y,Math.random()<.12+state.stageLoop*.03?2:1);
  const repairChance=state.player.hp<state.player.maxHp*.35?.24:.13;if(state.player.hp<state.player.maxHp*.82&&Math.random()<repairChance)dropItem("heal",enemy.x+12,enemy.y,1);
}

function enemyFire(enemy) {
  const p = state.player,speedScale=(1+(enemy.fireScale-1)*.28)*(enemy.enraged?1.1:1),targetX=enemy.aimX??p.x,targetY=enemy.aimY??p.y,armorAlive=(enemy.armorParts??[]).filter(part=>!part.dead).length,exposedScale=enemy.kind==="pursuer"&&armorAlive===0?.74:1,enrageScale=enemy.enraged?.72:1; enemy.fire = ENEMY[enemy.kind].fire/enemy.fireScale * (.75 + Math.random() * .4)*exposedScale*enrageScale;enemy.telegraph=0;
  if (enemy.kind === "grunt") addEnemyBullet(enemy.x, enemy.y + 14, 0, 235*speedScale, 7, "#ff4d75");
  if (enemy.kind === "spread") {
    for (let i = -2; i <= 2; i++) { const a = Math.PI / 2 + i * .23; addEnemyBullet(enemy.x, enemy.y, Math.cos(a) * 205*speedScale, Math.sin(a) * 205*speedScale, 8, "#ffbf35"); }
  }
  if (enemy.kind === "sniper") {
    const d = normalize(targetX - enemy.x, targetY - enemy.y); addEnemyBullet(enemy.x, enemy.y, d.x * 315*speedScale, d.y * 315*speedScale, 6, "#cb78ff");
  }
  if(enemy.kind==="hunter"){const d=normalize(targetX-enemy.x,targetY-enemy.y),base=Math.atan2(d.y,d.x);for(let i=-1;i<=1;i++){const a=base+i*.1;addEnemyBullet(enemy.x,enemy.y+10,Math.cos(a)*340*speedScale,Math.sin(a)*340*speedScale,6,"#42d9ff")}}
  if(enemy.kind==="bomber"){const shift=(enemy.volley??0)*.16;enemy.volley=(enemy.volley??0)+1;for(let i=0;i<8;i++){const a=i*Math.PI/4+shift;addEnemyBullet(enemy.x,enemy.y,Math.cos(a)*205*speedScale,Math.sin(a)*205*speedScale,8,"#ff684d")}}
  if(enemy.kind==="pursuer"){
    const d=normalize(targetX-enemy.x,targetY-enemy.y),base=Math.atan2(d.y,d.x),variant=(enemy.variant??0)%BOSS_VARIANTS.length,color=BOSS_VARIANTS[variant].color;enemy.volley=(enemy.volley??0)+1;
    if(variant===0){for(let i=-1;i<=1;i++){const a=base+i*.18;addEnemyBullet(enemy.x+Math.cos(a)*30,enemy.y+Math.sin(a)*30,Math.cos(a)*295*speedScale,Math.sin(a)*295*speedScale,8,"#ff315f")}for(let i=0;i<4;i++){const a=Math.PI/2+(i-1.5)*.42;addEnemyBullet(enemy.x,enemy.y+25,Math.cos(a)*205*speedScale,Math.sin(a)*205*speedScale,7,"#ffb43f")}}
    if(variant===1){const shift=(enemy.volley%2)*.18;for(let i=-4;i<=4;i++){const a=Math.PI/2+i*.22+shift;addEnemyBullet(enemy.x,enemy.y+20,Math.cos(a)*220*speedScale,Math.sin(a)*220*speedScale,8,i%2?"#ff9f3d":"#ffcf5a")}for(let i=-1;i<=1;i++){const a=base+i*.11;addEnemyBullet(enemy.x,enemy.y,Math.cos(a)*315*speedScale,Math.sin(a)*315*speedScale,6,"#ff684d")}}
    if(variant===2){for(let i=-2;i<=2;i++){const a=base+i*.095;addEnemyBullet(enemy.x+i*13,enemy.y+18,Math.cos(a)*355*speedScale,Math.sin(a)*355*speedScale,6,"#83d9ff")}const side=enemy.volley%2?1:-1;for(let i=0;i<5;i++){const x=side>0?95+i*46:W-95-i*46;addEnemyBullet(x,enemy.y+10,side*38,245*speedScale,7,"#b99cff")}}
    if(variant===3){const sweep=enemy.volley%2?1:-1;for(let i=0;i<7;i++){const a=Math.PI/2+sweep*(.12+i*.13);addEnemyBullet(enemy.x+(sweep>0?-48:48),enemy.y+8,Math.cos(a)*235*speedScale,Math.sin(a)*235*speedScale,8,color)}for(let i=-1;i<=1;i++){const a=base+i*.075;addEnemyBullet(enemy.x,enemy.y,Math.cos(a)*340*speedScale,Math.sin(a)*340*speedScale,6,"#ffe6dc")}}
    if(variant===4){const gap=enemy.volley%10;for(let i=0;i<10;i++){if(i===gap||i===(gap+1)%10)continue;const a=i*Math.PI/5+enemy.volley*.07;addEnemyBullet(enemy.x,enemy.y,Math.cos(a)*205*speedScale,Math.sin(a)*205*speedScale,8,color)}for(let i=-1;i<=1;i++){const a=base+i*.14;addEnemyBullet(enemy.x,enemy.y+12,Math.cos(a)*325*speedScale,Math.sin(a)*325*speedScale,6,"#e8fbff")}}
    if(variant===5){for(let ring=0;ring<2;ring++)for(let i=0;i<7;i++){const a=i*Math.PI*2/7+enemy.volley*(ring?.18:-.18);addEnemyBullet(enemy.x,enemy.y,Math.cos(a)*(175+ring*55)*speedScale,Math.sin(a)*(175+ring*55)*speedScale,ring?6:8,ring?"#83d9ff":color)}}
    if(variant===6){const openLane=enemy.volley%5;for(let i=0;i<5;i++){if(i===openLane)continue;const x=105+i*(W-210)/4;addEnemyBullet(x,enemy.y+12,Math.sin(enemy.volley*.8+i)*24,285*speedScale,8,color)}for(let i=-1;i<=1;i++){const a=base+i*.105;addEnemyBullet(enemy.x,enemy.y,Math.cos(a)*350*speedScale,Math.sin(a)*350*speedScale,6,"#f4ffd2")}}
    if(variant===7){const shift=enemy.volley%2?.1:-.1;for(let i=-5;i<=5;i++){const a=Math.PI/2+i*.145+shift;addEnemyBullet(enemy.x,enemy.y+15,Math.cos(a)*245*speedScale,Math.sin(a)*245*speedScale,7,i%2?color:"#ffb43f")}for(let i=0;i<6;i++){const a=i*Math.PI/3+enemy.volley*.13;addEnemyBullet(enemy.x,enemy.y,Math.cos(a)*150*speedScale,Math.sin(a)*150*speedScale,9,"#ff315f")}}
    if(variant===8){for(const originX of [85,W-85])for(let i=-1;i<=1;i++){const aim=normalize(targetX-originX,targetY-enemy.y),a=Math.atan2(aim.y,aim.x)+i*.09;addEnemyBullet(originX,enemy.y,Math.cos(a)*325*speedScale,Math.sin(a)*325*speedScale,6,color)}const a=base+(enemy.volley%2?-.28:.28);addEnemyBullet(enemy.x,enemy.y,Math.cos(a)*390*speedScale,Math.sin(a)*390*speedScale,7,"#ffffff")}
    if(variant===9){const phase=enemy.volley%3;if(phase===0){for(let i=0;i<12;i++){const a=i*Math.PI/6+enemy.volley*.08;addEnemyBullet(enemy.x,enemy.y,Math.cos(a)*220*speedScale,Math.sin(a)*220*speedScale,7,i%2?"#ffffff":"#ff315f")}}else if(phase===1){for(let i=-3;i<=3;i++){const a=base+i*.085;addEnemyBullet(enemy.x+i*10,enemy.y+16,Math.cos(a)*380*speedScale,Math.sin(a)*380*speedScale,6,"#ffffff")}}else{for(let i=0;i<6;i++){const x=90+i*(W-180)/5,playerLane=Math.round(clamp((targetX-90)/((W-180)/5),0,5));if(i!==playerLane)addEnemyBullet(x,enemy.y,0,310*speedScale,8,"#ff315f")}}}
    if(enemy.enraged){for(let i=-1;i<=1;i+=2){const a=base+i*.055;addEnemyBullet(enemy.x+i*24,enemy.y+18,Math.cos(a)*410*speedScale,Math.sin(a)*410*speedScale,5,"#ffffff")}}
  }
}
function addEnemyBullet(x, y, vx, vy, r, color) { state.enemyShots.push({ x, y, vx, vy, r, color, life: 6, grazed: false, dead: false, trail: [] }); }

function hurtPlayer(sourceX=state.player.x,sourceY=state.player.y-80,reason="ENEMY FIRE") {
  const p = state.player; if (p.inv > 0) return;
  const damage=state.characterId==="mira"?17:22;p.hp -= damage;state.stats.damage++; p.inv = 1.05; state.boost = Math.max(0, state.boost - 28); state.combo = 0; state.comboTimer = 0;state.nearChain=0;state.nearChainTimer=0; state.shake = 17; state.flash = .2; state.hitstop = .06;state.damageMarker={sourceX,sourceY,reason,life:.78,maxLife:.78};burst(p.x, p.y, "#ff2e78", 22, 280);floating(`-${damage} // ${reason}`,p.x,p.y-42,"#ff6f9f",14);haptic([35,20,45]); audio.hurt(); announce(state.characterId==="mira"?`KINETIC AEGIS // ${reason}`:`CORE HIT // ${reason}`);
  if (p.hp <= 0) endGame();
}

function update(dt) {
  if (state.mode !== "play" || state.paused) return;
  if(state.launchTimer>0){state.launchTimer=Math.max(0,state.launchTimer-dt);state.time+=dt;state.scroll+=state.visualSpeed*dt;state.player.inv=1;const step=Math.max(1,Math.ceil(state.launchTimer/.75));if(step!==state.launchStep){state.launchStep=step;ui.launchCount.textContent=String(step);state.rings.push({x:state.player.x,y:state.player.y,r:12,life:.22,maxLife:.22,color:playerAccent()})}state.visualSpeed=lerp(state.visualSpeed,860,1-Math.exp(-4*dt));updateDecorations(dt);updateHud(state.visualSpeed);if(state.launchTimer<=0){ui.launchCountdown.hidden=true;state.player.inv=.85;state.spawnTimer=Math.max(state.spawnTimer,.45);state.hazardTimer=Math.max(state.hazardTimer,2.4);state.speedBurst=.65;state.shake=8;announce(state.chipLink?`LINK // ${state.chipLink.name}`:"DRIVE!",true);audio.dash()}return}
  state.realTime += dt;
  if (state.hitstop > 0) { state.hitstop -= dt; updateParticles(dt * .2); return; }
  state.time += dt; state.lastAction += dt;state.waveTime+=dt;state.speedBurst=Math.max(0,state.speedBurst-dt*2.15);state.comboSavePulse=Math.max(0,state.comboSavePulse-dt);state.chainTime=Math.max(0,state.chainTime-dt);if(state.chainTime<=0)state.chainCount=0;state.nearChainTimer=Math.max(0,state.nearChainTimer-dt);if(state.nearChainTimer<=0)state.nearChain=0;state.reversalTime=Math.max(0,state.reversalTime-dt);if(state.damageMarker){state.damageMarker.life-=dt;if(state.damageMarker.life<=0)state.damageMarker=null} const p = state.player; const tier = boostTier(state.boost), character=state.characterStats;if(tier.level===5)state.stats.overdriveTime+=dt;
  const currentStage=STAGES[state.stageIndex];
  const activeBoss=state.enemies.find(enemy=>enemy.kind==="pursuer"&&!enemy.dead),bossAlive=Boolean(activeBoss);audio.music(dt,state.boost,bossAlive,activeBoss?.enraged);
  if(state.waveTime>=activeWaveDuration(currentStage)){
    const finalWave=state.wave===currentStage.waveCount,bossKey=`${state.stageLoop}:${state.stageIndex}`,bossAlreadySpawned=state.bossWaveKey===bossKey;
    if(finalWave&&!bossAlive&&!bossAlreadySpawned){spawnBoss()}
    else if(!finalWave||(!bossAlive&&bossAlreadySpawned&&state.endless)){const next=advanceWave(state.stageIndex,state.wave,state.stageLoop);state.stageIndex=next.stageIndex;state.wave=next.wave;state.stageLoop=next.loop;state.waveTime=0;state.eventTimer=5.5;state.spawnTimer=.08;announce(`${next.stageChanged?`STAGE ${state.stageIndex+1}`:`WAVE ${state.wave}`} // ${STAGES[state.stageIndex].events[state.wave-1]}`,true);if(next.stageChanged){state.boost=clamp(state.boost+12,0,100);state.enemyShots.length=0}if(next.stageChanged||[2,4,6,8].includes(state.wave))openModuleDraft()}
  }
  p.fireCd -= dt; p.dashCd -= dt; p.dashTime -= dt;p.dashAge+=dt; p.inv -= dt; p.slashCd -= dt; p.slashTime -= dt;p.slideTime-=dt;p.slideCd-=dt;p.turnCd-=dt;p.airTime-=dt;state.eventTimer-=dt; state.shake *= Math.pow(.001, dt); state.flash -= dt;
  if (state.comboTimer > 0) { state.comboTimer -= dt; if (state.comboTimer <= 0) state.combo = 0; }

  const movement=movementInput(),ix=movement.x,iy=movement.y,move=movement;const oldDir=p.lastDir,turnDot=(ix||iy)?move.x*oldDir.x+move.y*oldDir.y:1;
  if((ix||iy)&&turnDot<-.62&&Math.hypot(p.vx,p.vy)>265&&p.turnCd<=0&&p.dashTime<=0){const accent=playerAccent();p.turnCd=.32;p.vx=move.x*570*character.speed;p.vy=move.y*570*character.speed;p.lastDir=move;state.speedBurst=Math.max(state.speedBurst,.38);state.boost=clamp(state.boost+1.5,0,100);state.shake=5;state.camera.x-=move.x*28;state.camera.y-=move.y*28;state.rings.push({x:p.x,y:p.y,r:10,life:.2,maxLife:.2,color:accent});floating("QUICK TURN",p.x,p.y-34,accent,13);burst(p.x,p.y,accent,14,190)}else if(ix||iy)p.lastDir=move;
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
    addParticle(p.x+backX*24+(Math.random()-.5)*10,p.y+backY*24+(Math.random()-.5)*10,Math.random()<.35?"#ffffff":playerAccent(),backX*(45+Math.random()*85)+(Math.random()-.5)*30,backY*(45+Math.random()*85)+(Math.random()-.5)*30,.12+Math.random()*.18,1+Math.random()*3);
  }
  if ((moveSpeed>310||tier.level===5) && Math.random() < dt * (10+tier.level*5)) state.ghosts.push({ x: p.x-p.vx*.035, y: p.y-p.vy*.035, angle: p.angle, life: .14, maxLife: .14, dash: false });

  if (tapped(actionKeys.dash,"ShiftLeft","ShiftRight","TouchDash","PadDash")) dash();
  if (tapped(actionKeys.slide,"ControlLeft","ControlRight","TouchSlide","PadSlide")) slide();
  if (tapped(actionKeys.weapon,"TouchWeapon","PadWeapon")) switchWeapon();
  for(let i=0;i<WEAPONS.length;i++)if(tapped(`Digit${i+1}`,`PadWeapon${i}`)){selectWeapon(i);break}
  if (tapped(actionKeys.slash,"KeyK","MouseSlash","TouchSlash","PadSlash")) slash();
  if ((down(actionKeys.shoot,"KeyJ") || input.mouse || input.touchShoot||input.gamepadShoot) && p.fireCd <= 0) shootPlayer();

  state.lockTarget=((p.dashTime>0&&p.slashCd<=0)||(state.chainTime>0&&p.dashCd<=0))?dashTarget(state.chainTime>0?330:250):null;

  const forward = clamp((H * .72 - p.y) / 260, -.2, 1); const velocity = (850 + tier.level * 85 + Math.max(0, forward) * 760)*character.speed + (p.dashTime > 0 ? 900*character.dashSpeed : 0)+(p.slideTime>0?260:0)+(p.airTime>0?300:0);
  state.visualSpeed=lerp(state.visualSpeed,velocity,1-Math.exp(-(p.dashTime>0?18:6)*dt));state.scroll += state.visualSpeed * dt; if (forward > .18) state.boost = clamp(state.boost + forward * 1.65 * dt, 0, 100);
  const idleDecay = state.lastAction > 2.2 ? 3.8 : 1.05; const slowDecay = Math.hypot(p.vx,p.vy) < 70 ? 1.4 : 0; state.boost = clamp(state.boost - (idleDecay + slowDecay) * dt, 0, 100);
  const comboRush=Math.min(1,state.combo/50);if (Math.random() < dt * (24 + tier.level * 12+state.speedBurst*105+comboRush*28)) state.streaks.push({ x: Math.random() * W, y: -40, len: 90 + Math.random() * 250+state.speedBurst*190+comboRush*160, speed: 820 + Math.random() * 980+state.visualSpeed*.42+comboRush*220, life: .48 });

  const cameraTargetX=clamp(-p.vx*.045,-31,31),cameraTargetY=clamp(-p.vy*.038,-28,28);state.camera.x=lerp(state.camera.x,cameraTargetX,1-Math.exp(-3.2*dt));state.camera.y=lerp(state.camera.y,cameraTargetY,1-Math.exp(-3.2*dt));
  for(const delayed of state.delayedBursts){delayed.time-=dt;if(delayed.time<=0&&!delayed.done){delayed.done=true;burst(delayed.x,delayed.y,delayed.color,28,340);state.shake=Math.max(state.shake,10);audio.boom()}}state.delayedBursts=state.delayedBursts.filter(b=>!b.done);

  state.spawnTimer -= dt; if (state.spawnTimer <= 0) spawnWave();
  updateShots(dt); updateEnemies(dt); updateEnemyShots(dt);updateHazards(dt); updateItems(dt); updateParticles(dt); updateDecorations(dt);updateContract();updateTraining(moveSpeed); updateHud(state.visualSpeed);
}

function explodeMissile(shot,primary){
  const radius=72;burst(shot.x,shot.y,"#ffb43f",18,230);state.rings.push({x:shot.x,y:shot.y,r:12,life:.24,maxLife:.24,color:"#ffb43f"});state.shake=Math.max(state.shake,4);
  let linked=0;for(const enemy of state.enemies)if(enemy!==primary&&!enemy.dead&&distanceSq(shot,enemy)<(radius+enemy.r)**2){linked++;damageEnemy(enemy,shot.damage*.42,false,normalize(enemy.x-shot.x,enemy.y-shot.y))}
  if(linked>=2){const bonus=linked*50;state.score+=bonus;state.boost=clamp(state.boost+linked*1.5,0,100);preserveCombo(.7);floating(`BLAST LINK ×${linked+1} +${bonus}`,shot.x,shot.y+25,"#ffcf5a",13);state.shake=Math.max(state.shake,7)}
}

function updateShots(dt) {
  for (const s of state.shots) {
    if(s.type==="missile"){
      let target=null,best=Infinity;for(const enemy of state.enemies){if(enemy.dead)continue;const d=distanceSq(s,enemy);if(d<best){best=d;target=enemy}}
      if(target){const desired=normalize(target.x-s.x,target.y-s.y),speed=Math.hypot(s.vx,s.vy);s.vx=lerp(s.vx,desired.x*speed,1-Math.exp(-5.5*dt));s.vy=lerp(s.vy,desired.y*speed,1-Math.exp(-5.5*dt))}
      if(Math.random()<dt*35)addParticle(s.x,s.y,"#ffb43f",-s.vx*.12+(Math.random()-.5)*25,-s.vy*.12+(Math.random()-.5)*25,.12,3);
    }
    s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
    const travel=Math.hypot(s.x-s.originX,s.y-s.originY),impactDamage=s.type==="shotgun"?s.damage*(travel<190?1.3:travel>330?.72:1):s.damage;
    for (const e of state.enemies) if (!e.dead&&!s.hitEnemies.has(e)) {let partHit=false;if(e.kind==="pursuer"){for(const part of e.armorParts??[]){if(!part.dead&&circlesOverlap(s,{x:e.x+part.ox,y:e.y+part.oy,r:part.r})){s.life=0;damageBossPart(e,part,impactDamage);partHit=true;break}}if(!partHit&&(e.armorParts??[]).every(part=>part.dead))for(const leg of e.legParts??[]){if(!leg.dead&&circlesOverlap(s,{x:e.x+leg.ox,y:e.y+leg.oy,r:leg.r})){s.life=0;damageBossLeg(e,leg,impactDamage*.68);partHit=true;break}}}if(partHit){if(s.type==="missile")explodeMissile(s,e);break}if(circlesOverlap(s, e)) {s.hitEnemies.add(e);s.hitCount++;if(s.type==="shotgun"&&travel<190){e.pointBlankAt=state.time;if(state.time-state.pointBlankFxTime>.08){state.pointBlankFxTime=state.time;state.hitstop=Math.max(state.hitstop,.035);state.shake=Math.max(state.shake,5);floating("POINT BLANK ×1.3",e.x,e.y+e.r+14,"#ffcf5a",13);burst(e.x,e.y,"#ffcf5a",9,190)}}damageEnemy(e,impactDamage,false,normalize(s.vx,s.vy));if(s.type==="missile")explodeMissile(s,e);if(s.type==="laser"&&s.hitCount===3){state.score+=180;state.boost=clamp(state.boost+4,0,100);preserveCombo(.8);floating("PRISM PIERCE ×3 +180",s.x,s.y+18,"#8ff8ff",13);state.rings.push({x:s.x,y:s.y,r:10,life:.2,maxLife:.2,color:"#8ff8ff"})}if(s.pierce>0){s.pierce--;burst(s.x,s.y,"#8ff8ff",5,90)}else{s.life=0;break}}}
  }
  state.shots = state.shots.filter(s => s.life > 0 && s.x > -30 && s.x < W + 30 && s.y > -40 && s.y < H + 40);
}

function updateEnemies(dt) {
  const p = state.player;
  for (const e of state.enemies) {
    e.phase += dt;e.age+=dt;e.hit -= dt;const cfg = ENEMY[e.kind];if(e.kind!=="pursuer"&&!e.escaping&&e.age>=e.escapeAt){e.escaping=true;e.telegraph=0;e.fire=99;floating("TARGET ESCAPING",e.x,e.y-34,"#ffcf5a",12)}if(e.telegraph>0){e.telegraph-=dt;if(e.telegraph<=0)enemyFire(e)}else e.fire-=dt;
    if(e.kind==="pursuer"){
      const armorAlive=(e.armorParts??[]).filter(part=>!part.dead).length;if(!e.enraged&&armorAlive===0&&e.hp/e.maxHp<=.42){e.enraged=true;e.telegraph=0;e.fire=.3;state.enemyShots.length=0;state.shake=24;state.speedBurst=1;state.flash=.12;const bossName=BOSS_VARIANTS[e.variant??0].name.split(" // ")[0];announce(`${bossName} // OVERLOAD`,true);floating("PHASE SHIFT",e.x,e.y+72,"#ffffff",20);burst(e.x,e.y,BOSS_VARIANTS[e.variant??0].color,36,390);audio.overdrive()}
      const cripple=e.coreExposed?.58:1,targetY=(e.enraged?178:195)+Math.sin(e.phase*(e.enraged?1.15:.7))*(e.enraged?42:28)*cripple;e.y+=clamp((targetY-e.y)*(e.enraged?1.7:1.25),-cfg.speed*(e.enraged?1.45:1)*cripple,cfg.speed*(e.enraged?1.45:1)*cripple)*dt;const targetX=clamp(p.x+Math.sin(e.phase*(e.enraged?1.85:1.3))*(e.enraged?165:125)*cripple,95,W-95);e.x=lerp(e.x,targetX,1-Math.exp(-(e.enraged?1.8:1.15)*dt*cripple));
    }else if(e.escaping){
      e.y+=(250+state.visualSpeed*.18)*dt;e.x+=Math.sin(e.phase*3)*42*dt;
    }else{
      const targetY=e.kind==="bomber"?195:e.kind==="spread"?210:150+(e.phase*17%150);e.y+=Math.min(cfg.speed*e.moveScale,Math.max(18,(targetY-e.y)*.55))*dt;if(e.kind==="hunter")e.x=lerp(e.x,clamp(p.x+Math.sin(e.phase*2.4)*145,55,W-55),1-Math.exp(-2.2*dt));else e.x+=Math.sin(e.phase*(e.kind==="sniper"?1.7:1.05))*(e.kind==="grunt"?38:e.kind==="bomber"?12:22)*dt;
    }
    if (e.fire <= 0&&e.telegraph<=0&&e.y > 30 && e.y < H * .7){const duration=({grunt:.16,spread:.3,sniper:.48,hunter:.34,bomber:.52,pursuer:.56}[e.kind]??.25)*(e.enraged?.78:1);e.telegraph=duration;e.telegraphMax=duration;e.aimX=p.x;e.aimY=p.y;if(["sniper","hunter","bomber","pursuer"].includes(e.kind))audio.warning(e.kind==="pursuer")}
    if (!e.dead && circlesOverlap(p, e)) { if (p.dashTime > 0) {if(e.lastDashHit!==state.dashSerial){e.lastDashHit=state.dashSerial;damageEnemy(e,12,false,normalize(e.x-p.x,e.y-p.y));floating("DASH IMPACT",e.x,e.y+e.r+14,"#8defff",10)}} else hurtPlayer(e.x,e.y,`${e.kind.toUpperCase()} CONTACT`); }
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
    if (result === "hit" && p.inv <= 0) { b.dead = true; hurtPlayer(b.x-b.vx*.08,b.y-b.vy*.08,"ENEMY FIRE"); }
    else if ((result === "near" || result === "dash") && !b.grazed) {
      b.grazed = true; const dashNear = result === "dash",just=dashNear&&p.dashAge<.12,moveSpeed=Math.hypot(p.vx,p.vy),aggressive=dashNear||moveSpeed>=180,priorChain=state.nearChain,baseGain = (just ? 14 : dashNear ? 9 : 3.2)*(aggressive?1:.35);if(aggressive){state.nearChain=Math.min(8,state.nearChain+1);state.nearChainTimer=1.2}else{state.nearChain=0;state.nearChainTimer=0}state.stats.maxGrazeChain=Math.max(state.stats.maxGrazeChain,state.nearChain);if(aggressive)state.speedBurst=Math.max(state.speedBurst,.12+state.nearChain*.06);const chainScale=aggressive?1+(state.nearChain-1)*.12:1,gain=baseGain*chainScale*state.characterStats.boostGain; state.boost = clamp(state.boost + gain, 0, 100); state.score += Math.round((just?160:dashNear ? 90 : 35)*chainScale*(aggressive?1:.35)); state.stats.near++; if (dashNear) state.stats.dashNear++;if(just)state.stats.justDodge++;if(state.nearChain>priorChain&&(state.nearChain===4||state.nearChain===8)){state.rings.push({x:p.x,y:p.y,r:20,life:.3,maxLife:.3,color:state.nearChain===8?"#c8ff2e":"#00f0ff"});if(state.nearChain===8){p.dashCd=0;announce("GRAZE FLOW MAX // DASH READY",true);haptic([8,16,12])}}
      if(aggressive)preserveCombo(just?1.5:dashNear?1.2:.75);if(state.characterId==="ray")p.dashCd=Math.max(0,p.dashCd-(just?.28:dashNear?.18:.1));
      floating(aggressive?`${just?"JUST DODGE":dashNear?"DASH DODGE":"NEAR MISS"} ×${state.nearChain} +${Math.round(gain)}`:`SLOW GRAZE +${Math.round(gain)}`, p.x, p.y - 30, dashNear ? "#c8ff2e" : "#00f0ff", dashNear ? 18 : 14); burst(b.x, b.y, dashNear ? "#c8ff2e" : "#00f0ff", just?18:dashNear ? 12 : 6, just?210:130);if(dashNear)haptic(just?[10,18,16]:9); audio.near(dashNear); state.lastAction = 0;
      if (dashNear) { state.shake = just ? 8 : 5;state.hitstop=just ? .04 : state.hitstop;if(just){state.reversalTime=1.15;p.slashCd=0} announce(just?"JUST DODGE // REVERSAL READY":"DASH DODGE", true); }
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

function bossAttackIntent(boss){
  const variant=(boss.variant??0)%BOSS_VARIANTS.length,next=(boss.volley??0)+1;
  if(variant===0)return "TRIPLE HUNT + FAN";
  if(variant===1)return "WIDE FAN + LOCK";
  if(variant===2)return `RAIL BURST // ${next%2?"LEFT":"RIGHT"} WALL`;
  if(variant===3)return `ICE SWEEP // ${next%2?"RIGHT":"LEFT"}`;
  if(variant===4)return `RING GAP // LANE ${(next%10)+1}`;
  if(variant===5)return "TWIN ORBIT RINGS";
  if(variant===6)return `OPEN LANE // ${["FAR LEFT","LEFT","CENTER","RIGHT","FAR RIGHT"][next%5]}`;
  if(variant===7)return "EMBER FAN + ORBIT";
  if(variant===8)return "CROSSFIRE + LANCE";
  return ["ROYAL RING","SEVEN LANCES","LANE LOCK"][next%3];
}

function updateHud(velocity) {
  const p = state.player, tier = boostTier(state.boost);
  if(tier.level===5&&state.lastTier<5){announce("OVERDRIVE",true);audio.overdrive();state.shake=9}state.lastTier=tier.level;
  ui.score.textContent = String(state.score).padStart(6,"0"); ui.combo.textContent = state.combo > 1 ? `${state.combo} COMBO` : state.nearChain>1?`GRAZE ×${state.nearChain}`:"—";const comboActive=state.combo>1,comboMax=2.4*state.characterStats.comboWindow;ui.comboTimerBar.style.width=`${comboActive?clamp(state.comboTimer/comboMax,0,1)*100:0}%`;ui.comboTimer.classList.toggle("active",comboActive);ui.comboTimer.classList.toggle("critical",comboActive&&state.comboTimer<.65);ui.comboTimer.classList.toggle("saved",state.comboSavePulse>0);
  ui.hpBar.style.width = `${Math.max(0,p.hp/p.maxHp*100)}%`; ui.hpText.textContent = Math.max(0,p.hp); ui.boostBar.style.width = `${state.boost}%`; ui.boostValue.textContent = `${Math.floor(state.boost)}%`; ui.boostLevel.textContent = tier.label;
  const grazeActive=state.nearChain>0,grazeMax=state.nearChain>=8;ui.grazeChain.textContent=`×${state.nearChain}`;ui.grazeBar.style.width=`${state.nearChain/8*100}%`;ui.grazeTimer.style.width=`${clamp(state.nearChainTimer/1.2,0,1)*100}%`;ui.grazeStatus.textContent=grazeMax?"FLOW MAX // DASH READY":grazeActive?`${state.nearChainTimer.toFixed(1)}s // KEEP MOVING`:"MOVE FAST TO CHAIN";ui.grazeFlow.classList.toggle("active",grazeActive);ui.grazeFlow.classList.toggle("max",grazeMax);
  const actionReadiness=[{bar:ui.dashReadyBar,text:ui.dashReadyText,cd:p.dashCd,max:.56*state.characterStats.dashCooldown/tier.dash,touch:".touch-dash"},{bar:ui.slashReadyBar,text:ui.slashReadyText,cd:p.slashCd,max:.34*state.characterStats.slashCooldown,touch:".touch-slash"},{bar:ui.slideReadyBar,text:ui.slideReadyText,cd:p.slideCd,max:.6,touch:".touch-slide"}];for(const action of actionReadiness){const remaining=Math.max(0,action.cd),ready=remaining<=0,ratio=ready?1:clamp(1-remaining/action.max,0,1);action.bar.style.width=`${ratio*100}%`;action.text.textContent=ready?"READY":`${remaining.toFixed(2)}s`;action.bar.closest("div").classList.toggle("ready",ready);const touchButton=document.querySelector(action.touch);touchButton?.classList.toggle("cooling",!ready);touchButton?.setAttribute("aria-label",`${touchButton.querySelector("small")?.textContent??"ACTION"} ${ready?"使用可能":`再使用まで${remaining.toFixed(1)}秒`}`)}
  const reversalReady=state.reversalTime>0,slashRow=ui.slashReadyBar.closest("div"),touchSlash=document.querySelector(".touch-slash");slashRow.classList.toggle("reversal",reversalReady);touchSlash?.classList.toggle("reversal",reversalReady);if(reversalReady){ui.slashReadyBar.style.width=`${clamp(state.reversalTime/1.15,0,1)*100}%`;ui.slashReadyText.textContent=`REVERSAL ${state.reversalTime.toFixed(1)}s`;touchSlash?.setAttribute("aria-label",`REVERSAL斬撃 使用可能 残り${state.reversalTime.toFixed(1)}秒`)}
  const stage=STAGES[state.stageIndex],weapon=WEAPONS[state.weaponIndex],weaponBoost=state.weaponBoosts[weapon.id]??0,mastery=profile.weaponUpgrades[weapon.id]??0;ui.speed.textContent = String(Math.round(velocity * 1.02)).padStart(3,"0");ui.stageLabel.textContent=`${state.endless?"∞ ":""}STAGE ${state.stageIndex+1} // ${stage.name}`;ui.footerStage.textContent=state.endless?`∞ ${stage.name}`:stage.name;ui.waveLabel.textContent=`WAVE ${state.wave} / ${stage.waveCount}`;ui.eventLabel.textContent=stage.events[state.wave-1];ui.weaponLabel.textContent=`${weapon.short} // ${weapon.label} · ${weapon.trait}${mastery?` M${mastery}`:""}${weaponBoost?` +${weaponBoost}`:""}${state.modulePicks?` · SYNC ×${state.modulePicks}`:""}${state.chipLink?` · LINK ${state.chipLink.name.split(" ")[0]}`:""}`;if(ui.touchWeaponIcon){ui.touchWeaponIcon.textContent=weapon.short;ui.touchWeaponIcon.closest("button")?.setAttribute("aria-label",`武器切替 現在${weapon.label} ${weapon.trait}`)}ui.runCore.textContent=state.runCores;const shell=document.querySelector(".shell"),coreCritical=p.hp>0&&p.hp/p.maxHp<=.3;shell.classList.toggle("overdrive",tier.level===5);shell.classList.toggle("combo-rush",state.combo>=20);shell.classList.toggle("combo-max",state.combo>=50);shell.classList.toggle("core-critical",coreCritical);ui.coreCritical.hidden=!coreCritical;
  ui.runCore.textContent=state.runCores+state.bankedCores;
  const contract=state.contract,progress=contractProgress(contract,state.stats),shown=contract.stat==="overdriveTime"?progress.value.toFixed(1):Math.floor(progress.value);ui.contractHint.textContent=`RUN ORDER // ${contract.hint}`;ui.contractLabel.textContent=contract.label;ui.contractBar.style.width=`${progress.ratio*100}%`;ui.contractProgress.textContent=`${shown} / ${contract.target}${contract.stat==="overdriveTime"?"s":""}`;ui.contractReward.textContent=state.contractAwarded?"COMPLETE":`CORE +${contract.reward}`;
  const boss=state.enemies.find(enemy=>enemy.kind==="pursuer"&&!enemy.dead),waveDuration=activeWaveDuration(stage),waveRatio=clamp(state.waveTime/waveDuration,0,1),remaining=Math.max(0,waveDuration-state.waveTime),finalWave=state.wave===stage.waveCount;ui.waveProgressBar.style.width=`${waveRatio*100}%`;ui.waveCountdown.textContent=boss?"BOSS ENGAGED":`${finalWave?"BOSS":"NEXT WAVE"} IN ${remaining.toFixed(1)}s`;ui.waveCountdown.closest(".wave-progress").classList.toggle("engaged",Boolean(boss));ui.bossHud.hidden=!boss;if(boss){const ratio=clamp(boss.hp/boss.maxHp,0,1),variant=BOSS_VARIANTS[boss.variant??0],armorAlive=(boss.armorParts??[]).filter(part=>!part.dead).length,drivesAlive=(boss.legParts??[]).filter(part=>!part.dead).length,warning=boss.telegraph>0;ui.bossName.textContent=`${variant.name} // ${armorAlive?`ARMOR ${armorAlive}/2`:`DRIVE ${drivesAlive}/2`}${boss.enraged?" // OVERLOAD":""}`;ui.bossBar.style.width=`${ratio*100}%`;ui.bossBar.style.background=`linear-gradient(90deg,${variant.color},#ffffff)`;ui.bossHp.textContent=armorAlive?`${Math.ceil(ratio*100)}% · GUARD`:drivesAlive?`${Math.ceil(ratio*100)}% · BREAK LEGS`:boss.enraged?`${Math.ceil(ratio*100)}% · CORE OPEN / OVERLOAD`:`${Math.ceil(ratio*100)}% · CORE OPEN ×2.4`;ui.bossIntent.textContent=`${warning?"INCOMING":"NEXT"} // ${bossAttackIntent(boss)}${warning?` · ${boss.telegraph.toFixed(1)}s`:""}`;ui.bossIntent.classList.toggle("armed",warning)}
  if (!ui.debug.hidden) ui.debug.textContent = `FPS   ${fps.toFixed(0)}\nPLAYER ${Math.hypot(p.vx,p.vy).toFixed(0)} px/s\nENEMY  ${state.enemies.length}\nBULLET ${state.enemyShots.length + state.shots.length}\nHAZARD ${state.hazards.length}\nDROP   ${state.items.length}\nSTAGE  ${state.stageIndex+1}-${state.wave} LOOP ${state.stageLoop}\nNEAR   ${state.stats.near} (${state.stats.dashNear} DASH / ${state.stats.justDodge} JUST)\nREVERSAL ${state.stats.reversals}\nBREAK  ${state.stats.bulletBreaks}\nESCAPE ${state.stats.escaped}`;
}

function drawStageLandmark(stageIndex,horizon,palette){
  const base=horizon+17;ctx.save();ctx.globalAlpha=.32;ctx.fillStyle=palette.edge;ctx.strokeStyle=palette.edge;ctx.lineWidth=3;
  if(stageIndex===0){for(const x of [105,585]){ctx.fillRect(x-2,base-62,4,62);ctx.beginPath();ctx.arc(x,base-64,5,0,6.29);ctx.fill();for(let a=0;a<3;a++){ctx.beginPath();ctx.moveTo(x,base-64);ctx.lineTo(x+Math.cos(a*2.094)*34,base-64+Math.sin(a*2.094)*34);ctx.stroke()}}}
  else if(stageIndex===1){for(const x of [75,160,560,645]){ctx.save();ctx.translate(x,base-25);ctx.rotate(x<W/2?-.16:.16);ctx.fillRect(-24,-8,48,16);ctx.restore();ctx.fillRect(x-2,base-22,4,22)}}
  else if(stageIndex===2){for(const x of [36,610]){ctx.beginPath();ctx.moveTo(x,base);ctx.lineTo(x+18,base-58);ctx.lineTo(x+78,base-58);ctx.lineTo(x+95,base);ctx.fill()}}
  else if(stageIndex===3){for(const x of [60,598]){ctx.fillRect(x,base-82,22,82);ctx.fillRect(x+48,base-65,18,65);ctx.beginPath();ctx.arc(x+34,base-46,31,Math.PI,0);ctx.stroke()}}
  else if(stageIndex===4){for(let x=38;x<W;x+=92){ctx.beginPath();ctx.moveTo(x,base);ctx.lineTo(x+25,base-48-(x%3)*8);ctx.lineTo(x+54,base);ctx.fill()}}
  else if(stageIndex===5){ctx.lineWidth=6;ctx.globalAlpha=.2;for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(W/2,base+110+i*18,260-i*28,3.62,5.8);ctx.stroke()}}
  else if(stageIndex===6){for(const x of [82,638]){ctx.beginPath();ctx.moveTo(x-24,base);ctx.lineTo(x,base-76);ctx.lineTo(x+24,base);ctx.moveTo(x-16,base-28);ctx.lineTo(x+16,base-28);ctx.moveTo(x-11,base-49);ctx.lineTo(x+11,base-49);ctx.stroke()}}
  else if(stageIndex===7){for(const x of [70,125,585,640]){const h=40+(x%4)*9;ctx.fillRect(x-9,base-h,18,h);ctx.fillRect(x-13,base-h,26,6);ctx.globalAlpha=.12;ctx.beginPath();ctx.arc(x+(x<W/2?-8:8),base-h-14,12,0,6.29);ctx.fill();ctx.globalAlpha=.32}}
  else if(stageIndex===8){for(const x of [92,628]){ctx.beginPath();ctx.moveTo(x-22,base);ctx.lineTo(x,base-88);ctx.lineTo(x+22,base);ctx.stroke();ctx.beginPath();ctx.arc(x,base-71,17,-1.1,1.1);ctx.stroke()}}
  else{for(let x=20;x<W;x+=36){const h=22+(x*7%68);ctx.fillRect(x,base-h,27,h);if(x%72===20)ctx.fillRect(x+9,base-h-22,9,22)}}
  ctx.restore();
}

function drawBackground() {
  const tier=boostTier(state.boost),stageIndex=state.stageIndex,stage=STAGES[stageIndex].theme,wave=state.wave,waveProgress=wave/STAGES[stageIndex].waveCount,speedFx=clamp((state.visualSpeed-620)/1050,0,1)+state.speedBurst*.72,horizon=126,roadTopL=216,roadTopR=W-216;
  const palette=STAGE_PALETTES[stageIndex%STAGE_PALETTES.length];
  const sky=ctx.createLinearGradient(0,0,0,horizon+150);sky.addColorStop(0,palette.sky0);sky.addColorStop(1,palette.sky1);ctx.fillStyle=sky;ctx.fillRect(-40,-40,W+80,H+80);

  // Muted natural silhouettes keep the combat layer visually dominant.
  ctx.fillStyle=palette.far;ctx.beginPath();ctx.moveTo(-30,horizon+32);for(let x=-30;x<=W+40;x+=55){const n=Math.abs(Math.sin(x*.021+stage*1.7));const peak=stage===0?25+n*35:stage===1?40+n*75:55+n*95;ctx.lineTo(x,horizon-peak)}ctx.lineTo(W+40,horizon+70);ctx.closePath();ctx.fill();
  if(stage===0){ctx.fillStyle="#304b35";ctx.beginPath();ctx.moveTo(0,horizon+20);ctx.quadraticCurveTo(150,horizon-38,320,horizon+18);ctx.quadraticCurveTo(520,horizon-48,W,horizon+14);ctx.lineTo(W,horizon+90);ctx.lineTo(0,horizon+90);ctx.fill()}
  if(stage===1){ctx.fillStyle="#523728";for(let i=0;i<6;i++){const x=i*145-45,h=35+(i%3)*18;ctx.fillRect(x,horizon-h,80,h);ctx.fillRect(x+12,horizon-h-20,54,22)}}
  if(stage===2){ctx.fillStyle="#60717a";for(let i=0;i<7;i++){const x=i*115-55,h=52+(i%3)*31;ctx.beginPath();ctx.moveTo(x,horizon+16);ctx.lineTo(x+58,horizon-h);ctx.lineTo(x+120,horizon+16);ctx.fill()}}
  drawStageLandmark(stageIndex,horizon,palette);

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
  if(waveProgress>=.7){const weatherCount=(stage===0?34:stage===1?46:60)*(combatFocus?.45:1);ctx.globalAlpha=(stage===1?.13:.2)*(combatFocus?.55:1);ctx.strokeStyle=stage===1?"#c5aa82":"#e8f1ed";ctx.lineWidth=stage===2?2:1;for(let i=0;i<weatherCount;i++){const x=(i*97+state.time*(stage===1?90:stage===2?-75:125))%(W+100)-50,y=(i*53+state.scroll*(stage===1?.22:.48))%(H+80)-40;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+(stage===2?18:-8),y+18+speedFx*34);ctx.stroke()}ctx.globalAlpha=1}
  if(waveProgress>=1){ctx.fillStyle="rgba(24,25,28,.16)";ctx.fillRect(0,0,W,H);ctx.fillStyle="rgba(120,24,30,.12)";ctx.fillRect(0,0,W,horizon+35)}

  // Speed lines remain neutral and confined mostly to the outer edges.
  if(speedFx>.12){ctx.lineWidth=1+speedFx*2;for(let i=0;i<18;i++){const edgeX=i%2?W+32:-32,edgeY=150+(i%9)*102,endX=W/2+(edgeX-W/2)*.28;ctx.strokeStyle="#edf4ef";ctx.globalAlpha=(.018+speedFx*.075)*(1-(i%5)*.1);ctx.beginPath();ctx.moveTo(endX,horizon);ctx.lineTo(edgeX,edgeY+speedFx*135);ctx.stroke()}ctx.globalAlpha=1}
  if(state.speedBurst>.08){ctx.globalAlpha=state.speedBurst*.25;ctx.lineWidth=3;ctx.strokeStyle="#ffffff";ctx.beginPath();ctx.moveTo(roadTopL-8,horizon);ctx.lineTo(30,H);ctx.moveTo(roadTopR+8,horizon);ctx.lineTo(W-30,H);ctx.stroke();ctx.globalAlpha=1}
  if(combatFocus){ctx.fillStyle="rgba(0,4,7,.2)";ctx.fillRect(0,0,W,H)}for(const s of state.streaks){ctx.globalAlpha=clamp(s.life*2,0,combatFocus?.26:.52);ctx.fillStyle=tier.level===5?"#c8ff2e":"#e8efea";ctx.fillRect(s.x,s.y,2+(speedFx>.7?1:0),s.len)}ctx.globalAlpha=1;
}

function pixelPlayer(x,y,alpha=1,dash=false) {
  const p=state.player, character=CHARACTERS[state.characterId], moving=Math.hypot(p.vx,p.vy)>80;
  const step=moving&&!dash?(Math.sin(state.time*24)>0?2:-2):0;
  const overdrive=boostTier(state.boost).level===5;
  const energy=overdrive||dash?"#c8ff2e":playerAccent();
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
  if(e.telegraph<=0)return;const progress=1-e.telegraph/e.telegraphMax,pulse=.45+Math.sin(state.time*34)*.28,bossVariant=e.kind==="pursuer"?(e.variant??0)%BOSS_VARIANTS.length:-1,color=e.kind==="pursuer"?BOSS_VARIANTS[bossVariant].color:ENEMY[e.kind]?.color??"#ff527f";
  ctx.save();ctx.globalAlpha=clamp(pulse+progress*.25,.18,.9);ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=e.kind==="pursuer"?3:2;
  const nextVolley=(e.volley??0)+1,omegaPhase=nextVolley%3,laneWarning=bossVariant===6||(bossVariant===9&&omegaPhase===2),radialWarning=[4,5,7].includes(bossVariant)||(bossVariant===9&&omegaPhase===0);
  if(laneWarning){
    const laneCount=bossVariant===6?5:6,openLane=bossVariant===6?nextVolley%5:Math.round(clamp((e.aimX-90)/((W-180)/5),0,5));ctx.setLineDash([14,9]);for(let i=0;i<laneCount;i++){if(i===openLane)continue;const x=bossVariant===6?105+i*(W-210)/4:90+i*(W-180)/5;ctx.beginPath();ctx.moveTo(x,e.y);ctx.lineTo(x,H-70);ctx.stroke()}ctx.setLineDash([]);ctx.globalAlpha=.82;ctx.font="900 12px monospace";ctx.textAlign="center";ctx.fillText("OPEN",bossVariant===6?105+openLane*(W-210)/4:90+openLane*(W-180)/5,H-92);ctx.textAlign="left";
  }else if(radialWarning){
    ctx.beginPath();ctx.arc(e.x,e.y,42+progress*72,0,Math.PI*2);ctx.stroke();const spokes=bossVariant===4?10:bossVariant===5?7:bossVariant===7?6:12;for(let i=0;i<spokes;i++){const a=i*Math.PI*2/spokes+nextVolley*.08;ctx.beginPath();ctx.moveTo(e.x+Math.cos(a)*30,e.y+Math.sin(a)*30);ctx.lineTo(e.x+Math.cos(a)*105,e.y+Math.sin(a)*105);ctx.stroke()}
  }else if(bossVariant===8){
    ctx.setLineDash([10,8]);for(const originX of [85,W-85]){ctx.beginPath();ctx.moveTo(originX,e.y);ctx.lineTo(e.aimX,e.aimY);ctx.stroke()}ctx.setLineDash([]);ctx.beginPath();ctx.arc(e.aimX,e.aimY,12+progress*10,0,Math.PI*2);ctx.stroke();
  }else if(e.kind==="sniper"||e.kind==="hunter"||e.kind==="pursuer"){
    const d=normalize(e.aimX-e.x,e.aimY-e.y),length=1100,sideX=-d.y,sideY=d.x;ctx.setLineDash(e.kind==="pursuer"?[18,10]:[10,8]);
    const offsets=e.kind==="pursuer"?[-12,0,12]:[0];for(const offset of offsets){ctx.beginPath();ctx.moveTo(e.x+sideX*offset,e.y+sideY*offset);ctx.lineTo(e.x+d.x*length+sideX*offset,e.y+d.y*length+sideY*offset);ctx.stroke()}
    ctx.setLineDash([]);ctx.beginPath();ctx.arc(e.aimX,e.aimY,10+progress*12,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(e.aimX-18,e.aimY);ctx.lineTo(e.aimX+18,e.aimY);ctx.moveTo(e.aimX,e.aimY-18);ctx.lineTo(e.aimX,e.aimY+18);ctx.stroke();
  }else{
    ctx.beginPath();ctx.arc(e.x,e.y,e.r+8+progress*18,0,Math.PI*2);ctx.stroke();if(e.kind==="spread"){ctx.globalAlpha*=.45;ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.arc(e.x,e.y,150,Math.PI*.28,Math.PI*.72);ctx.closePath();ctx.fill()}
  }
  ctx.restore();
}

function drawDashLock(){
  const target=state.lockTarget;if(!target||target.dead)return;const p=state.player,pulse=.72+Math.sin(state.time*18)*.22,r=target.r+15;
  ctx.save();ctx.globalAlpha=pulse;ctx.strokeStyle="#c8ff2e";ctx.fillStyle="#eaffb4";ctx.lineWidth=2;ctx.setLineDash([7,6]);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(target.x,target.y);ctx.stroke();ctx.setLineDash([]);
  for(let i=0;i<4;i++){const a=i*Math.PI/2+.78,x=target.x+Math.cos(a)*r,y=target.y+Math.sin(a)*r;ctx.save();ctx.translate(x,y);ctx.rotate(a+Math.PI/2);ctx.beginPath();ctx.moveTo(-9,0);ctx.lineTo(0,0);ctx.lineTo(0,9);ctx.stroke();ctx.restore()}
  ctx.font="900 11px monospace";ctx.textAlign="center";ctx.fillText(state.chainTime>0?"SPACE // CHAIN":"X // DASH SLASH",target.x,target.y-r-10);ctx.textAlign="left";ctx.restore();
}

function drawBossVariantFrame(variant,color,stride){
  ctx.save();ctx.globalAlpha=.72;ctx.fillStyle=color;ctx.strokeStyle=color;ctx.lineWidth=4;
  if(variant===0){ctx.fillRect(-74,-20,26,8);ctx.fillRect(48,-20,26,8);ctx.fillRect(-68,18,20,7);ctx.fillRect(48,18,20,7)}
  else if(variant===1){ctx.beginPath();ctx.moveTo(-38,-18);ctx.lineTo(-88,-42);ctx.lineTo(-63,5);ctx.closePath();ctx.fill();ctx.beginPath();ctx.moveTo(38,-18);ctx.lineTo(88,-42);ctx.lineTo(63,5);ctx.closePath();ctx.fill()}
  else if(variant===2){ctx.fillRect(-76,-42,24,55);ctx.fillRect(52,-42,24,55);ctx.fillStyle="#eafcff";ctx.fillRect(-70,-56,12,20);ctx.fillRect(58,-56,12,20)}
  else if(variant===3){ctx.fillRect(-82,-31,36,48);ctx.fillRect(46,-31,36,48);ctx.fillRect(-66,24+stride,22,26);ctx.fillRect(44,24-stride,22,26)}
  else if(variant===4){for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(side*35,-22);ctx.lineTo(side*68,-58);ctx.lineTo(side*56,-10);ctx.closePath();ctx.fill()}}
  else if(variant===5){ctx.globalAlpha=.42;ctx.beginPath();ctx.ellipse(0,-5,79,46,0,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.ellipse(0,-5,62,62,0,0,Math.PI*2);ctx.stroke()}
  else if(variant===6){ctx.beginPath();ctx.moveTo(-40,-26);ctx.lineTo(-63,-55);ctx.lineTo(-50,-5);ctx.moveTo(40,-26);ctx.lineTo(63,-55);ctx.lineTo(50,-5);ctx.moveTo(0,-30);ctx.lineTo(0,-72);ctx.stroke();ctx.fillRect(-5,-78,10,12)}
  else if(variant===7){for(const x of [-59,59]){ctx.fillRect(x-10,-37,20,54);ctx.fillStyle="#fff";ctx.fillRect(x-5,-49,10,16);ctx.fillStyle=color}}
  else if(variant===8){for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(side*43,-16);ctx.lineTo(side*91,-2);ctx.lineTo(side*48,18);ctx.closePath();ctx.fill()}}
  else{ctx.fillRect(-78,-30,31,19);ctx.fillRect(47,-30,31,19);ctx.beginPath();ctx.moveTo(-35,-30);ctx.lineTo(-22,-59);ctx.lineTo(0,-42);ctx.lineTo(22,-59);ctx.lineTo(35,-30);ctx.closePath();ctx.fill()}
  ctx.restore();
}

function drawBossWeakPoints(e,armorAlive,stride){
  const parts=armorAlive?(e.armorParts??[]):(e.legParts??[]),color=armorAlive?"#ffb43f":"#00f0ff",pulse=.62+Math.sin(state.time*12)*.22;
  ctx.save();ctx.globalAlpha=pulse;ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=2;ctx.shadowColor=color;ctx.shadowBlur=8;
  for(const part of parts){if(part.dead)continue;const y=part.oy+(armorAlive?0:part.id==="L"?stride:-stride),x=part.ox,r=part.r+6,size=7;ctx.beginPath();ctx.moveTo(x-r+size,y-r);ctx.lineTo(x-r,y-r);ctx.lineTo(x-r,y-r+size);ctx.moveTo(x+r-size,y-r);ctx.lineTo(x+r,y-r);ctx.lineTo(x+r,y-r+size);ctx.moveTo(x-r,y+r-size);ctx.lineTo(x-r,y+r);ctx.lineTo(x-r+size,y+r);ctx.moveTo(x+r-size,y+r);ctx.lineTo(x+r,y+r);ctx.lineTo(x+r,y+r-size);ctx.stroke();ctx.globalAlpha=.28;ctx.fillRect(x-r,y+r+4,r*2,3);ctx.globalAlpha=pulse;ctx.fillRect(x-r,y+r+4,r*2*clamp(part.hp/part.maxHp,0,1),3)}
  if(e.coreExposed){ctx.translate(0,-5);ctx.rotate(state.time*1.8);ctx.strokeStyle="#c8ff2e";ctx.shadowColor="#c8ff2e";ctx.globalAlpha=.7;for(let i=0;i<4;i++){ctx.rotate(Math.PI/2);ctx.beginPath();ctx.moveTo(19,-25);ctx.lineTo(25,-25);ctx.lineTo(25,-19);ctx.stroke()}ctx.rotate(-state.time*1.8);ctx.font="900 8px monospace";ctx.textAlign="center";ctx.fillStyle="#eaffb4";ctx.fillText("DASH ×2.4",0,44)}
  ctx.restore();
}

function drawEnemy(e) {
  const c=e.kind==="pursuer"?BOSS_VARIANTS[e.variant??0].color:ENEMY[e.kind].color; ctx.save();ctx.translate(Math.round(e.x),Math.round(e.y)); if(e.hit>0)ctx.globalAlpha=.55;
  if(e.kind==="pursuer"){
    const stride=Math.sin(e.phase*7)*7,armorAlive=(e.armorParts??[]).filter(part=>!part.dead).length,overloadPulse=e.enraged?.62+Math.sin(state.time*18)*.38:1;ctx.shadowColor=e.enraged?"#ffffff":c;ctx.shadowBlur=e.enraged?32*overloadPulse:18;drawBossVariantFrame(e.variant??0,c,stride);ctx.fillStyle="#160a14";ctx.fillRect(-42,-31,84,62);ctx.fillStyle=c;ctx.fillRect(-35,-25,70,43);ctx.fillStyle="#070b12";ctx.fillRect(-24,-15,48,30);ctx.fillStyle=armorAlive?"#fff":e.coreExposed?"#c8ff2e":"#ff315f";ctx.fillRect(-14,-9,28,8);ctx.fillStyle=armorAlive?"#ffb43f":"#ffffff";ctx.fillRect(-10,-7,20,4);if(e.enraged){ctx.globalAlpha=overloadPulse;ctx.fillStyle="#ffffff";ctx.fillRect(-17,-12,34,3);ctx.fillRect(-3,-26,6,38);ctx.globalAlpha=1}for(const part of e.armorParts??[]){if(part.dead)continue;ctx.save();ctx.translate(part.ox,part.oy);ctx.fillStyle="#24131d";ctx.fillRect(-13,-20,26,40);ctx.strokeStyle=c;ctx.lineWidth=3;ctx.strokeRect(-13,-20,26,40);ctx.fillStyle="#fff";ctx.fillRect(-8,-4,16,8);ctx.fillStyle="#ffb43f";ctx.fillRect(-5,-2,10,4);ctx.restore()}ctx.shadowBlur=0;ctx.fillStyle="#251522";ctx.fillRect(-43,25+stride,17,30);ctx.fillRect(26,25-stride,17,30);ctx.fillRect(-62,-8-stride,16,38);ctx.fillRect(46,-8+stride,16,38);if(armorAlive===0)for(const leg of e.legParts??[]){if(leg.dead)continue;ctx.save();ctx.translate(leg.ox,leg.oy+(leg.id==="L"?stride:-stride));ctx.strokeStyle="#00f0ff";ctx.shadowColor="#00f0ff";ctx.shadowBlur=12;ctx.lineWidth=3;ctx.strokeRect(-10,-17,20,32);ctx.fillStyle="#ffffff";ctx.fillRect(-5,-4,10,8);ctx.restore()}ctx.shadowBlur=0;ctx.fillStyle=e.coreExposed?"#c8ff2e":"#d7faff";ctx.fillRect(-40,48+stride,12,6);ctx.fillRect(28,48-stride,12,6);drawBossWeakPoints(e,armorAlive,stride);ctx.restore();return;
  }
  ctx.fillStyle="#12101b";ctx.fillRect(-e.r,-e.r,e.r*2,e.r*2);ctx.fillStyle=c;
  if(e.kind==="grunt"){ctx.fillRect(-16,-13,32,22);ctx.fillRect(-22,-5,8,18);ctx.fillRect(14,-5,8,18)}
  else if(e.kind==="spread"){ctx.fillRect(-21,-14,42,27);ctx.fillRect(-13,-22,26,9);ctx.fillRect(-27,-3,8,17);ctx.fillRect(19,-3,8,17)}
  else if(e.kind==="hunter"){ctx.fillRect(-19,-17,38,30);ctx.fillRect(-31,-5,62,9);ctx.fillStyle="#dffcff";ctx.fillRect(-3,-20,6,24);ctx.fillStyle="#06131b";ctx.fillRect(-12,-8,24,12)}
  else if(e.kind==="bomber"){ctx.fillRect(-24,-18,48,36);ctx.fillRect(-31,-8,62,16);ctx.fillStyle="#ffe2d5";ctx.fillRect(-15,-4,30,8);ctx.fillStyle="#39110d";ctx.fillRect(-8,-12,16,24)}
  else{ctx.fillRect(-13,-20,26,38);ctx.fillRect(-24,-7,48,12);ctx.fillStyle="#fff";ctx.fillRect(-4,-12,8,13)}
  ctx.fillStyle="#330a18";ctx.fillRect(-8,-5,16,9);ctx.fillStyle="#fff";ctx.fillRect(-5,-3,10,3);ctx.restore();
  const ratio=e.hp/e.maxHp;if(ratio<1){ctx.fillStyle="#1d1621";ctx.fillRect(e.x-20,e.y-e.r-11,40,4);ctx.fillStyle=c;ctx.fillRect(e.x-20,e.y-e.r-11,40*ratio,4)}
}

function drawRoadHazard(h){
  ctx.save();ctx.translate(Math.round(h.x),Math.round(h.y));const pulse=.65+Math.sin(state.time*10+h.phase)*.25;
  if(h.type==="roadSplit"){
    const safeX=h.safeSide*(W*.24),dangerX=-safeX;ctx.globalAlpha=.68;ctx.fillStyle="#291016";ctx.fillRect(dangerX-W*.23,-30,W*.46,60);ctx.strokeStyle="#ff315f";ctx.lineWidth=4;ctx.strokeRect(dangerX-W*.23,-30,W*.46,60);ctx.fillStyle="#ff315f";for(let x=dangerX-W*.2;x<dangerX+W*.2;x+=34){ctx.save();ctx.translate(x,0);ctx.rotate(-.65);ctx.fillRect(-4,-25,8,50);ctx.restore()}ctx.globalAlpha=.78+pulse*.2;ctx.strokeStyle="#c8ff2e";ctx.lineWidth=5;ctx.strokeRect(safeX-W*.21,-25,W*.42,50);ctx.fillStyle="#eaffb4";ctx.beginPath();ctx.moveTo(safeX,-20);ctx.lineTo(safeX-15,5);ctx.lineTo(safeX-6,5);ctx.lineTo(safeX-6,22);ctx.lineTo(safeX+6,22);ctx.lineTo(safeX+6,5);ctx.lineTo(safeX+15,5);ctx.closePath();ctx.fill();ctx.font="900 12px monospace";ctx.textAlign="center";ctx.fillText("OPEN ROUTE",safeX,-38);ctx.textAlign="left";ctx.globalAlpha=1;
  }else if(["floodGate","gridGate","stormGate","emberGate","lockdownGate"].includes(h.type)){
    const gateDraw={floodGate:{color:"#00f0ff",width:4,label:"CANYON"},gridGate:{color:"#cb78ff",width:6,label:"ICE"},stormGate:{color:"#f4ff64",width:7,label:"STORM"},emberGate:{color:"#ff8a3d",width:7,label:"HEAT"},lockdownGate:{color:"#ff315f",width:8,label:"LOCK"}}[h.type],color=gateDraw.color,gap=h.gap,span=W*.48;ctx.shadowColor=color;ctx.shadowBlur=16;ctx.strokeStyle=color;ctx.lineWidth=gateDraw.width;ctx.globalAlpha=.55+pulse*.35;ctx.beginPath();ctx.moveTo(-span,0);ctx.lineTo(-gap,0);ctx.moveTo(gap,0);ctx.lineTo(span,0);ctx.stroke();ctx.globalAlpha=1;ctx.fillStyle="#eaffff";for(let x=-span;x<-gap;x+=34)ctx.fillRect(x,-4,18,8);for(let x=gap+16;x<span;x+=34)ctx.fillRect(x,-4,18,8);ctx.fillStyle=color;ctx.fillRect(-gap-5,-13,5,26);ctx.fillRect(gap,-13,5,26);ctx.globalAlpha=pulse;ctx.beginPath();ctx.moveTo(0,-18);ctx.lineTo(-11,-34);ctx.lineTo(11,-34);ctx.closePath();ctx.fill();ctx.globalAlpha=1;ctx.font="900 9px monospace";ctx.textAlign="center";ctx.fillText(gateDraw.label,0,25);ctx.textAlign="left";
  }else if(h.type==="car"){
    ctx.shadowColor="#ffb43f";ctx.shadowBlur=10;ctx.fillStyle="#17202a";ctx.fillRect(-22,-34,44,68);ctx.strokeStyle="#dffaff";ctx.lineWidth=3;ctx.strokeRect(-22,-34,44,68);ctx.fillStyle="#274858";ctx.fillRect(-15,-22,30,27);ctx.fillStyle="#ff315f";ctx.fillRect(-16,23,10,6);ctx.fillRect(6,23,10,6);ctx.fillStyle="#ffb43f";ctx.globalAlpha=pulse;ctx.fillRect(-18,-31,12,5);ctx.fillRect(6,-31,12,5);
  }else if(h.type==="barrier"){
    ctx.shadowColor="#ff315f";ctx.shadowBlur=12;ctx.fillStyle="#ffb43f";ctx.fillRect(-48,-14,96,28);ctx.fillStyle="#17131a";for(let x=-42;x<44;x+=24)ctx.fillRect(x,-14,11,28);ctx.strokeStyle="#fff";ctx.lineWidth=2;ctx.strokeRect(-48,-14,96,28);ctx.fillStyle="#ff315f";ctx.globalAlpha=pulse;ctx.fillRect(-43,-8,8,8);ctx.fillRect(35,-8,8,8);
  }else{
    ctx.shadowColor="#c8ff2e";ctx.shadowBlur=18;ctx.fillStyle="#182600";ctx.strokeStyle="#c8ff2e";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-34,28);ctx.lineTo(-22,-26);ctx.lineTo(22,-26);ctx.lineTo(34,28);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle="#eaffb4";ctx.globalAlpha=pulse;for(let y=-15;y<20;y+=13){ctx.beginPath();ctx.moveTo(-10,y+7);ctx.lineTo(0,y-2);ctx.lineTo(10,y+7);ctx.fill()}ctx.globalAlpha=1;ctx.shadowBlur=8;ctx.font="900 8px monospace";ctx.textAlign="center";ctx.fillText("← LANE JUMP →",0,43);ctx.textAlign="left";
  }
  ctx.restore();if(h.y<70){ctx.save();ctx.globalAlpha=.55+Math.sin(state.time*16)*.3;const warningColors={floodGate:"#00f0ff",gridGate:"#cb78ff",stormGate:"#f4ff64",emberGate:"#ff8a3d",lockdownGate:"#ff315f"};ctx.fillStyle=h.type==="ramp"||h.type==="roadSplit"?"#c8ff2e":warningColors[h.type]??"#ff315f";const warningX=h.type==="roadSplit"?W/2+h.safeSide*W*.24:h.x;ctx.beginPath();ctx.moveTo(warningX,88);ctx.lineTo(warningX-9,72);ctx.lineTo(warningX+9,72);ctx.closePath();ctx.fill();ctx.restore()}
}

function drawItem(item){
  ctx.save();ctx.translate(Math.round(item.x),Math.round(item.y));ctx.rotate(item.spin);const pulse=1+Math.sin(state.time*9+item.spin)*.1;ctx.scale(pulse,pulse);
  if(item.type==="core"){ctx.shadowColor="#c8ff2e";ctx.shadowBlur=16;ctx.fillStyle="#172300";ctx.strokeStyle="#c8ff2e";ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(0,-12);ctx.lineTo(10,0);ctx.lineTo(0,12);ctx.lineTo(-10,0);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle="#fff";ctx.fillRect(-2,-5,4,10)}
  else{ctx.shadowColor="#59ffb3";ctx.shadowBlur=16;ctx.fillStyle="#08251b";ctx.strokeStyle="#59ffb3";ctx.lineWidth=3;ctx.fillRect(-11,-11,22,22);ctx.strokeRect(-11,-11,22,22);ctx.fillStyle="#eafff7";ctx.fillRect(-3,-8,6,16);ctx.fillRect(-8,-3,16,6)}ctx.restore();
}

function drawDamageMarker(){
  const marker=state.damageMarker;if(!marker)return;const p=state.player,d=normalize(marker.sourceX-p.x,marker.sourceY-p.y),alpha=clamp(marker.life/marker.maxLife,0,1),x=p.x+d.x*66,y=p.y+d.y*66,a=Math.atan2(d.y,d.x);
  ctx.save();ctx.globalAlpha=alpha;ctx.translate(x,y);ctx.rotate(a);ctx.fillStyle="#ff315f";ctx.shadowColor="#ff315f";ctx.shadowBlur=14;ctx.beginPath();ctx.moveTo(14,0);ctx.lineTo(-8,-9);ctx.lineTo(-4,0);ctx.lineTo(-8,9);ctx.closePath();ctx.fill();ctx.shadowBlur=0;ctx.restore();
  ctx.save();ctx.globalAlpha=alpha;ctx.font="900 10px monospace";ctx.textAlign="center";ctx.fillStyle="#ffdbe5";ctx.strokeStyle="#21040d";ctx.lineWidth=4;ctx.strokeText(marker.reason,p.x,p.y+58);ctx.fillText(marker.reason,p.x,p.y+58);ctx.restore();
}

function drawRiskField(){
  const p=state.player,riskRadius=p.r+49;let nearest=Infinity;
  for(const bullet of state.enemyShots)if(!bullet.dead)nearest=Math.min(nearest,Math.sqrt(distanceSq(p,bullet)));
  const proximity=clamp((riskRadius+72-nearest)/72,0,1);if(proximity<=0)return;
  const dashing=p.dashTime>0,color=dashing?"#c8ff2e":"#00f0ff",pulse=.72+Math.sin(state.time*18)*.18;
  ctx.save();ctx.translate(p.x,p.y);ctx.rotate(state.time*(dashing?3.8:1.5));ctx.globalAlpha=(.1+proximity*.42)*pulse;ctx.strokeStyle=color;ctx.shadowColor=color;ctx.shadowBlur=8+proximity*13;ctx.lineWidth=1+proximity*2;ctx.setLineDash([5+proximity*5,8]);ctx.beginPath();ctx.arc(0,0,riskRadius,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
  for(let i=0;i<4;i++){const a=i*Math.PI/2,x=Math.cos(a)*riskRadius,y=Math.sin(a)*riskRadius;ctx.beginPath();ctx.moveTo(x*.82,y*.82);ctx.lineTo(x*1.12,y*1.12);ctx.stroke()}
  if(nearest<=riskRadius){ctx.globalAlpha=.05+proximity*.08;ctx.fillStyle=color;ctx.beginPath();ctx.arc(0,0,riskRadius,0,Math.PI*2);ctx.fill()}
  ctx.restore();
}

function drawBulletBreakCue(){
  const p=state.player;if(p.slashCd>0||state.enemyShots.length===0)return;const radius=(p.dashTime>0?108:72)*state.characterStats.slashRange;let target=null,nearest=Infinity;
  for(const bullet of state.enemyShots){if(bullet.dead)continue;const d=distanceSq(p,bullet);if(d<nearest&&d<(radius+bullet.r+18)**2){nearest=d;target=bullet}}
  if(!target)return;const color=p.dashTime>0?"#c8ff2e":"#d7fbff",r=target.r+10,pulse=.56+Math.sin(state.time*20)*.24;ctx.save();ctx.translate(target.x,target.y);ctx.rotate(state.time*2.8);ctx.globalAlpha=pulse;ctx.strokeStyle=color;ctx.shadowColor=color;ctx.shadowBlur=7;ctx.lineWidth=2;for(let i=0;i<4;i++){ctx.rotate(Math.PI/2);ctx.beginPath();ctx.moveTo(r-5,-r);ctx.lineTo(r,-r);ctx.lineTo(r,-r+5);ctx.stroke()}ctx.rotate(-state.time*2.8);ctx.font="900 7px monospace";ctx.textAlign="center";ctx.fillStyle=color;ctx.fillText("BREAK",0,-r-6);ctx.restore();
}

function drawAimReticle(){
  const p=state.player,stickMagnitude=Math.hypot(input.gamepadAimX,input.gamepadAimY);let x,y,gamepad=false;
  if(stickMagnitude>.2){const aim=normalize(input.gamepadAimX,input.gamepadAimY);x=p.x+aim.x*105;y=p.y+aim.y*105;gamepad=true}
  else if(input.mouse){x=input.mouseX;y=input.mouseY}else return;
  const color=playerAccent(),pulse=1+Math.sin(state.time*13)*.08,r=gamepad?13:11;ctx.save();ctx.translate(x,y);ctx.rotate(state.time*(gamepad?.8:.45));ctx.scale(pulse,pulse);ctx.globalAlpha=.82;ctx.strokeStyle=color;ctx.shadowColor=color;ctx.shadowBlur=8;ctx.lineWidth=2;
  for(let i=0;i<4;i++){ctx.rotate(Math.PI/2);ctx.beginPath();ctx.moveTo(r-5,-r);ctx.lineTo(r,-r);ctx.lineTo(r,-r+5);ctx.stroke()}
  ctx.rotate(-state.time*(gamepad?.8:.45));ctx.globalAlpha=.62;ctx.fillStyle="#ffffff";ctx.fillRect(-1,-1,2,2);ctx.font="900 7px monospace";ctx.textAlign="center";ctx.fillText(gamepad?"R-AIM":"AIM",0,r+10);ctx.restore();
}

function draw() {
  const focusScale=combatFocus?.42:1,shakeScale=shakeEnabled?focusScale:0,shakeX=(Math.random()-.5)*state.shake*shakeScale,shakeY=(Math.random()-.5)*state.shake*shakeScale,dashZoom=1+state.speedBurst*.048*focusScale;ctx.save();ctx.translate(shakeX+state.camera.x*focusScale,shakeY+state.camera.y*focusScale);ctx.translate(W/2,H*.55);ctx.scale(dashZoom,dashZoom);ctx.translate(-W/2,-H*.55);drawBackground();
  for(const ring of state.rings){ctx.globalAlpha=clamp(ring.life/ring.maxLife,0,1)*.7;ctx.strokeStyle=ring.color;ctx.lineWidth=2+ring.life*14;ctx.beginPath();ctx.ellipse(ring.x,ring.y,ring.r,ring.r*.55,0,0,Math.PI*2);ctx.stroke()}ctx.globalAlpha=1;
  for(const g of state.ghosts) pixelPlayer(g.x,g.y,(g.life/g.maxLife)*(g.dash?.46:.25),g.dash);
  const trailP=state.player,trailStrength=clamp(Math.hypot(trailP.vx,trailP.vy)/700,0,.42)+state.speedBurst*.72;if(trailStrength>.12){const backX=-trailP.lastDir.x,backY=-trailP.lastDir.y,trailLength=55+trailStrength*210;for(let i=-1;i<=1;i++){ctx.globalAlpha=trailStrength*(i===0 ? .36 : .18);ctx.strokeStyle=i===0?"#eaffff":playerAccent();ctx.lineWidth=i===0?3:2;ctx.beginPath();ctx.moveTo(trailP.x+backY*i*7,trailP.y-backX*i*7);ctx.lineTo(trailP.x+backX*trailLength+backY*i*14,trailP.y+backY*trailLength-backX*i*14);ctx.stroke()}ctx.globalAlpha=1}
  for(const e of state.enemies)drawTelegraph(e);drawDashLock();
  for(const hazard of state.hazards)drawRoadHazard(hazard);
  for(const s of state.shots){ctx.save();ctx.translate(s.x,s.y);ctx.rotate(Math.atan2(s.vy,s.vx)+Math.PI/2);const accent=playerAccent();if(s.type==="laser"){ctx.shadowColor=accent;ctx.shadowBlur=12;ctx.fillStyle="#fff";ctx.fillRect(-2,-34,4,68);ctx.fillStyle=accent;ctx.fillRect(-1,-42,2,84)}else if(s.type==="missile"){ctx.fillStyle="#f7f2dd";ctx.fillRect(-5,-12,10,20);ctx.fillStyle="#ffb43f";ctx.fillRect(-7,8,14,8);ctx.fillStyle=accent;ctx.fillRect(-3,16,6,9)}else{ctx.fillStyle="#dfffff";ctx.fillRect(-3,-10,6,20);ctx.fillStyle=s.type==="shotgun"?"#ffb43f":accent;ctx.fillRect(-1,9,2,12)}ctx.restore()}
  for(const b of state.enemyShots){for(const t of b.trail){ctx.globalAlpha=Math.max(0,t.life/.12)*.25;ctx.fillStyle=b.color;ctx.beginPath();ctx.arc(t.x,t.y,b.r*1.4,0,6.28);ctx.fill()}ctx.globalAlpha=1;ctx.shadowColor=b.color;ctx.shadowBlur=13;ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,6.28);ctx.fill();if(bulletContrast){ctx.strokeStyle="#02040a";ctx.lineWidth=8;ctx.stroke()}ctx.strokeStyle=b.color;ctx.lineWidth=4;ctx.stroke();ctx.shadowBlur=0}drawBulletBreakCue();
  for(const e of state.enemies)drawEnemy(e);
  for(const item of state.items)drawItem(item);
  const p=state.player,character=state.characterStats;drawRiskField();if(state.reversalTime>0){const ratio=state.reversalTime/1.15,pulse=22+Math.sin(state.time*22)*4;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(-state.time*4);ctx.globalAlpha=.32+.38*ratio;ctx.strokeStyle="#ffffff";ctx.shadowColor=playerAccent();ctx.shadowBlur=12;ctx.lineWidth=2;ctx.setLineDash([7,7]);ctx.beginPath();ctx.arc(0,0,pulse,0,Math.PI*2);ctx.stroke();ctx.restore()}if(p.slashTime>0){const dash=p.dashTime>0,r=(dash?108:72)*character.slashRange;ctx.globalAlpha=clamp(p.slashTime*6,0,.85);ctx.strokeStyle=dash?"#c8ff2e":"#e8ffff";ctx.lineWidth=dash?15:9;ctx.beginPath();ctx.arc(p.x,p.y,r,-2.7,.6);ctx.stroke();ctx.strokeStyle=playerAccent();ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,p.y,r-9,-2.8,.45);ctx.stroke();ctx.globalAlpha=1}
  const airRatio=clamp(p.airTime/p.airMax,0,1),airLift=Math.sin(airRatio*Math.PI)*38;if(airLift>1){ctx.save();ctx.globalAlpha=.2+airRatio*.12;ctx.fillStyle="#020508";ctx.beginPath();ctx.ellipse(p.x,p.y+17,19+airLift*.18,7+airLift*.04,0,0,Math.PI*2);ctx.fill();ctx.restore()}const invBlink=p.inv>0&&p.airTime<=0&&Math.floor(p.inv*14)%2;ctx.globalAlpha=invBlink?.34:1;pixelPlayer(p.x,p.y-airLift,1,p.dashTime>0||p.slideTime>0||state.speedBurst>.45);ctx.globalAlpha=1;
  for(const q of state.particles){ctx.globalAlpha=clamp(q.life/q.maxLife,0,1);ctx.fillStyle=q.color;ctx.fillRect(Math.round(q.x-q.size/2),Math.round(q.y-q.size/2),q.size,q.size)}ctx.globalAlpha=1;
  for(const t of state.texts){ctx.globalAlpha=clamp(t.life*2,0,1);ctx.fillStyle=t.color;ctx.font=`900 italic ${t.size}px monospace`;ctx.textAlign="center";ctx.fillText(t.text,t.x,t.y)}ctx.globalAlpha=1;ctx.textAlign="left";
  drawAimReticle();
  drawDamageMarker();
  if(flashEnabled&&state.flash>0){ctx.fillStyle=`rgba(255,46,120,${state.flash*(combatFocus?.7:1.7)})`;ctx.fillRect(0,0,W,H)}ctx.restore();
  const comboShade=Math.min(.12,state.combo*.0024),speedShade=clamp((state.visualSpeed-700)/1200,0,.34)+state.speedBurst*.2+comboShade;if(speedShade>0){const vignette=ctx.createRadialGradient(W/2,H*.52,W*.18,W/2,H*.52,W*.68);vignette.addColorStop(0,"rgba(0,0,0,0)");vignette.addColorStop(.7,`rgba(0,10,18,${speedShade*.18})`);vignette.addColorStop(1,`rgba(0,0,0,${speedShade})`);ctx.fillStyle=vignette;ctx.fillRect(0,0,W,H)}
}

let last=performance.now(),fps=60,frames=0,fpsTime=0;
function loop(now){let dt=Math.min(.033,(now-last)/1000);last=now;frames++;fpsTime+=dt;if(fpsTime>.5){fps=frames/fpsTime;frames=0;fpsTime=0}pollGamepad();update(dt);draw();input.pressed.clear();requestAnimationFrame(loop)}
updateHud(520);requestAnimationFrame(loop);
