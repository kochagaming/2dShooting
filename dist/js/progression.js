export const UPGRADE_KEYS = ["hp","speed","shoot","slash","dash"];

export const UPGRADE_DEFS = {
  hp: { label:"CORE ARMOR", jp:"最大HP", description:"最大HP +8%" },
  speed: { label:"DRIVE OUTPUT", jp:"移動速度", description:"移動速度 +3.5%" },
  shoot: { label:"GUN LINK", jp:"射撃性能", description:"威力 +5% / 連射 +4%" },
  slash: { label:"BLADE EDGE", jp:"斬撃性能", description:"威力 +6% / 範囲 +4%" },
  dash: { label:"BOOST SYNC", jp:"ダッシュ", description:"速度 +4% / 再使用短縮" }
};

export const STAGES = [
  { name:"VERDANT ROUTE",subtitle:"風走る草原街道",hazard:"TRAFFIC / BOOST RAMP",theme:0,duration:12,waveCount:1,weights:{grunt:.72,spread:.2,sniper:.08},density:.78,events:["PURSUER APPROACH"]},
  { name:"SUNSET BYWAY",subtitle:"夕映えの高架道",hazard:"TRAFFIC / ROADBLOCK",theme:0,duration:12.5,waveCount:2,weights:{grunt:.6,spread:.28,sniper:.12},density:.86,events:["GOLDEN FIELD","RAPTOR APPROACH"]},
  { name:"RED WASTE",subtitle:"赤土の荒野回廊",hazard:"CANYON GATE",theme:1,duration:13,waveCount:3,weights:{grunt:.46,spread:.42,sniper:.12},density:.94,events:["DRY FLATS","DUST TRAIL","DREADNOUGHT APPROACH"]},
  { name:"CANYON VEIN",subtitle:"峡谷を裂く輸送路",hazard:"NARROW CANYON GATE",theme:1,duration:13.5,waveCount:4,weights:{grunt:.38,spread:.45,sniper:.17},density:1.02,events:["RAVINE ENTRY","ROCKFALL","NARROW PASS","GOLIATH APPROACH"]},
  { name:"FROSTLINE",subtitle:"吹雪の凍結路",hazard:"MOVING ICE GRID",theme:2,duration:14,waveCount:5,weights:{grunt:.4,spread:.25,sniper:.35},density:1.08,events:["SNOW FIELD","PINE PASS","FROZEN LAKE","ICE GRID","WHITE FANG APPROACH"]},
  { name:"GLACIER SPAN",subtitle:"氷河上の崩壊橋",hazard:"COLLAPSE FORK / ICE GRID",theme:2,duration:14,waveCount:6,weights:{grunt:.32,spread:.25,sniper:.43},density:1.14,events:["ICE SHELF","CREVASSE","FROST BRIDGE","AURORA LINE","SHARD FIELD","BOREALIS APPROACH"]},
  { name:"STORM BELT",subtitle:"雷雲を貫く外環",hazard:"COLLAPSE FORK / BLACK RAIN",theme:0,duration:14.5,waveCount:7,weights:{grunt:.42,spread:.34,sniper:.24},density:1.2,events:["DARK MEADOW","POWER LINE","THUNDER ROAD","FLASH FLOOD","WIND SHEAR","BLACK RAIN","TEMPEST APPROACH"]},
  { name:"ASH CIRCUIT",subtitle:"灰都の灼熱環状線",hazard:"COLLAPSE FORK / FURNACE GATE",theme:1,duration:15,waveCount:8,weights:{grunt:.28,spread:.5,sniper:.22},density:1.27,events:["ASH PLAIN","SMELTER WAY","EMBER RAIN","MOLTEN CUT","BLACK FACTORY","HEAT HAZE","FURNACE GATE","INFERNO APPROACH"]},
  { name:"ZERO HORIZON",subtitle:"極夜の最終防衛線",hazard:"COLLAPSE FORK / ICE GRID",theme:2,duration:15.5,waveCount:9,weights:{grunt:.28,spread:.27,sniper:.45},density:1.34,events:["POLAR NIGHT","SILENT GRID","GHOST CONVOY","DARK ICE","SIGNAL LOST","VOID BRIDGE","ABSOLUTE ZERO","BLACKOUT","NEMESIS APPROACH"]},
  { name:"LAST ARTERY",subtitle:"中央都市への最終動脈",hazard:"COLLAPSE FORK / LOCKDOWN",theme:1,duration:16,waveCount:10,weights:{grunt:.34,spread:.36,sniper:.3},density:1.42,events:["OUTER WALL","DEFENSE GRID","WARDEN LINE","KILL ZONE","CENTRAL RAMP","LOCKDOWN","INNER RING","CORE HIGHWAY","FINAL GATE","OMEGA APPROACH"]}
];

export const WEAPONS = [
  { id:"pistol", label:"HANDGUN", short:"HG", trait:"BALANCED", fireDelay:.105, damage:12, speed:850 },
  { id:"shotgun", label:"SHOTGUN", short:"SG", trait:"CLOSE BURST", fireDelay:.34, damage:7, speed:760 },
  { id:"laser", label:"LASER", short:"LS", trait:"PIERCE ×3", fireDelay:.058, damage:4.4, speed:1320 },
  { id:"missile", label:"MISSILE", short:"MS", trait:"HOMING BLAST", fireDelay:.48, damage:30, speed:470 }
];

export const WEAPON_UPGRADE_KEYS = WEAPONS.map(weapon=>weapon.id);

export const WEAPON_UPGRADE_DEFS = {
  pistol:{label:"HANDGUN LINK",jp:"ハンドガン",description:"威力 +6% / 連射 +3%"},
  shotgun:{label:"BREACH CHAMBER",jp:"ショットガン",description:"威力 +6% / 連射 +3%"},
  laser:{label:"PRISM CORE",jp:"レーザー",description:"威力 +6% / 連射 +3%"},
  missile:{label:"SWARM GUIDANCE",jp:"ミサイル",description:"威力 +6% / 連射 +3%"}
};

export function weaponUpgradeCost(level){return level>=5?null:6+level*5;}

export function weaponUpgradeStats(level=0){
  const lv=Math.max(0,Math.min(5,Number(level)||0));
  return {damage:1+lv*.06,fireRate:1+lv*.03};
}

export const RUN_CONTRACTS = [
  { id:"grazer", label:"GRAZE ORDER", hint:"MOVE FAST NEAR BULLETS", stat:"near", target:15, reward:3 },
  { id:"breaker", label:"DASH BREAK ORDER", hint:"DASH → SLASH KILLS", stat:"strongKills", target:8, reward:4 },
  { id:"blade", label:"BULLET BREAK ORDER", hint:"SLASH ENEMY BULLETS", stat:"bulletBreaks", target:24, reward:4 },
  { id:"overdrive", label:"OVERDRIVE ORDER", hint:"KEEP BOOST AT MAX", stat:"overdriveTime", target:10, reward:4 },
  { id:"reversal", label:"REVERSAL ORDER", hint:"JUST DODGE → SLASH", stat:"reversals", target:4, reward:5 },
  { id:"breach", label:"POINT BLANK ORDER", hint:"SHOTGUN UNDER 190px", stat:"pointBlankKills", target:6, reward:4 }
];

export const BOSS_VARIANTS = [
  { id:"pursuer", name:"PURSUER // ROAD HUNTER", color:"#ff315f" },
  { id:"raptor", name:"RAPTOR // SUNSET CLAW", color:"#ffcf5a" },
  { id:"dreadnought", name:"DREADNOUGHT // DUST TYRANT", color:"#ff9f3d" },
  { id:"goliath", name:"GOLIATH // CANYON CRUSHER", color:"#ff684d" },
  { id:"whitefang", name:"WHITE FANG // ICE STALKER", color:"#83d9ff" },
  { id:"borealis", name:"BOREALIS // GLACIER EYE", color:"#b99cff" },
  { id:"tempest", name:"TEMPEST // STORM LANCER", color:"#c8ff2e" },
  { id:"inferno", name:"INFERNO // ASH DEVOURER", color:"#ff4d75" },
  { id:"nemesis", name:"NEMESIS // ZERO PHANTOM", color:"#79d7ff" },
  { id:"omega", name:"OMEGA WARDEN // LAST WALL", color:"#ffffff" }
];

export function pickRunContract(roll=Math.random()){
  return RUN_CONTRACTS[Math.min(RUN_CONTRACTS.length-1,Math.floor(Math.max(0,roll)*RUN_CONTRACTS.length))];
}

export function scaleRunContract(contract,stageIndex=0,endless=false){
  const stage=Math.max(0,Math.min(STAGES.length-1,Math.floor(Number(stageIndex)||0))),scale=endless?1.5:.45+stage*.061;
  return {...contract,target:contract.stat==="overdriveTime"?Math.max(2,Math.round(contract.target*scale*10)/10):Math.max(1,Math.ceil(contract.target*scale)),reward:contract.reward+(endless?2:stage>=6?1:0)};
}

export function contractProgress(contract,stats={}){
  const value=Math.max(0,Number(stats[contract.stat])||0);
  return { value, ratio:Math.min(1,value/contract.target), complete:value>=contract.target };
}

export function upgradeCost(level){ return level>=5?null:4+level*4; }

export function applyUpgrades(base,levels={}){
  const lv=Object.fromEntries(UPGRADE_KEYS.map(key=>[key,Math.max(0,Math.min(5,Number(levels[key])||0))]));
  return {
    ...base,
    hp:Math.round(base.hp*(1+lv.hp*.08)),
    speed:base.speed*(1+lv.speed*.035),
    fireRate:base.fireRate*(1+lv.shoot*.04),
    shotDamage:base.shotDamage*(1+lv.shoot*.05),
    slashRange:base.slashRange*(1+lv.slash*.04),
    slashDamage:base.slashDamage*(1+lv.slash*.06),
    dashSpeed:base.dashSpeed*(1+lv.dash*.04),
    dashCooldown:base.dashCooldown*(1-lv.dash*.035)
  };
}

export function applyOutfitModifiers(stats,modifiers={}){
  const tuned={...stats};
  for(const [key,multiplier] of Object.entries(modifiers))if(Number.isFinite(tuned[key])&&Number.isFinite(multiplier))tuned[key]*=multiplier;
  tuned.hp=Math.round(tuned.hp);
  return tuned;
}

export function waveSettings(stageIndex,wave,loop=0){
  const stage=STAGES[stageIndex%STAGES.length], w=Math.max(1,Math.min(stage.waveCount,wave));
  return {
    stage,
    hpScale:.78+stageIndex*.13+(w-1)*.055+loop*.32,
    fireScale:.72+stageIndex*.085+(w-1)*.04+loop*.18,
    spawnInterval:Math.max(.3,(1.32-(w-1)*.06-loop*.07)/stage.density),
    groupChance:Math.min(.78,.05+(w-1)*.065+stageIndex*.045+loop*.08),
    eliteChance:stageIndex<2?0:Math.min(.38,.04+(stageIndex-2)*.035+(w-1)*.012+loop*.04),
    weights:stage.weights
  };
}

export function chooseEnemyType(weights,roll){
  if(roll<weights.grunt)return "grunt";
  if(roll<weights.grunt+weights.spread)return "spread";
  return "sniper";
}

export function advanceWave(stageIndex,wave,loop=0){
  const waveCount=STAGES[stageIndex%STAGES.length].waveCount;
  if(wave<waveCount)return {stageIndex,wave:wave+1,loop,stageChanged:false};
  const nextStage=(stageIndex+1)%STAGES.length;
  return {stageIndex:nextStage,wave:1,loop:nextStage===0?loop+1:loop,stageChanged:true};
}

export function isRunClear(stageIndex,wave,loop=0){
  return stageIndex===STAGES.length-1&&wave===STAGES.at(-1).waveCount&&loop===0;
}

export function unlockAfterStageClear(unlockedStage,clearedStage){
  const cleared=Math.max(0,Math.min(STAGES.length-1,Math.floor(Number(clearedStage)||0)));
  return {unlockedStage:Math.max(Math.max(0,Math.floor(Number(unlockedStage)||0)),Math.min(STAGES.length-1,cleared+1)),endlessUnlocked:cleared===STAGES.length-1};
}

export function applyEscapePenalty(boost,count=1){
  return Math.max(0,boost-Math.max(0,count)*7);
}

export function updateRunRecord(record={},run={}){
  const previous={score:Math.max(0,Number(record.score)||0),clearTime:Math.max(0,Number(record.clearTime)||0),rank:["D","C","B","A","S"].includes(record.rank)?record.rank:"D",clears:Math.max(0,Number(record.clears)||0),bestKillRate:Math.max(0,Math.min(100,Number(record.bestKillRate)||0)),bestReversals:Math.max(0,Math.floor(Number(record.bestReversals)||0)),noDamageClear:Boolean(record.noDamageClear)};
  const rankOrder={D:0,C:1,B:2,A:3,S:4},score=Math.max(0,Number(run.score)||0),time=Math.max(0,Number(run.time)||0),rank=rankOrder[run.rank]===undefined?"D":run.rank,killRate=Math.max(0,Math.min(100,Number(run.killRate)||0)),reversals=Math.max(0,Math.floor(Number(run.reversals)||0)),damage=Math.max(0,Number(run.damage)||0);
  const isBestScore=score>previous.score,isBestTime=Boolean(run.clear&&time&&(previous.clearTime===0||time<previous.clearTime)),isBestRank=rankOrder[rank]>rankOrder[previous.rank];
  return {record:{score:isBestScore?score:previous.score,clearTime:isBestTime?time:previous.clearTime,rank:isBestRank?rank:previous.rank,clears:previous.clears+(run.clear?1:0),bestKillRate:Math.max(previous.bestKillRate,run.clear&&Object.hasOwn(run,"killRate")?killRate:0),bestReversals:Math.max(previous.bestReversals,run.clear&&Object.hasOwn(run,"reversals")?reversals:0),noDamageClear:previous.noDamageClear||Boolean(run.clear&&Object.hasOwn(run,"damage")&&damage===0)},isBestScore,isBestTime,isBestRank};
}

export function stageMastery(record={}){
  const rankOrder={D:0,C:1,B:2,A:3,S:4},rank=rankOrder[record.rank]===undefined?"D":record.rank;
  const medals=[
    {id:"clear",label:"CLEAR",earned:(Number(record.clears)||0)>0},
    {id:"rank",label:"A-RANK",earned:rankOrder[rank]>=rankOrder.A},
    {id:"hunter",label:"90% KILL",earned:(Number(record.bestKillRate)||0)>=90},
    {id:"reversal",label:"REVERSAL ×3",earned:(Number(record.bestReversals)||0)>=3},
    {id:"clean",label:"NO DAMAGE",earned:Boolean(record.noDamageClear)}
  ];
  return {medals,count:medals.filter(medal=>medal.earned).length,total:medals.length};
}

export function runRank({score=0,kills=0,near=0,dashNear=0,justDodge=0,strongKills=0,pointBlankKills=0,bulletBreaks=0,damage=0,maxCombo=0,escaped=0}={}){
  const performance=score+kills*90+near*45+dashNear*120+justDodge*100+strongKills*180+pointBlankKills*90+bulletBreaks*20+maxCombo*55-damage*750-escaped*500;
  if(performance>=18000&&damage<=1&&escaped<=1)return "S";
  if(performance>=10500)return "A";
  if(performance>=5500)return "B";
  if(performance>=2200)return "C";
  return "D";
}

export function styleAward(stats={}){
  const near=Math.max(0,Number(stats.near)||0),damage=Math.max(0,Number(stats.damage)||0),justDodge=Math.max(0,Number(stats.justDodge)||0),reversals=Math.max(0,Number(stats.reversals)||0),maxGrazeChain=Math.max(0,Number(stats.maxGrazeChain)||0),strongKills=Math.max(0,Number(stats.strongKills)||0),pointBlankKills=Math.max(0,Number(stats.pointBlankKills)||0),bulletBreaks=Math.max(0,Number(stats.bulletBreaks)||0),overdriveTime=Math.max(0,Number(stats.overdriveTime)||0),hazardDodges=Math.max(0,Number(stats.hazardDodges)||0);
  if(damage===0&&near>=12)return{id:"no-fear",label:"NO FEAR",description:"ノーダメージで弾幕へ接近",bonus:3};
  if(maxGrazeChain>=8)return{id:"graze-flow",label:"GRAZE FLOW",description:`GRAZE CHAIN ×${Math.floor(maxGrazeChain)}`,bonus:3};
  if(reversals>=3)return{id:"riposte-engine",label:"RIPOSTE ENGINE",description:`REVERSAL ×${Math.floor(reversals)}`,bonus:3};
  if(justDodge>=4)return{id:"razor-edge",label:"RAZOR EDGE",description:`JUST DODGE ×${Math.floor(justDodge)}`,bonus:2};
  if(pointBlankKills>=5)return{id:"breacher",label:"BREACHER",description:`至近距離撃破 ×${Math.floor(pointBlankKills)}`,bonus:2};
  if(bulletBreaks>=18)return{id:"blade-dancer",label:"BLADE DANCER",description:`敵弾破壊 ×${Math.floor(bulletBreaks)}`,bonus:2};
  if(strongKills>=6)return{id:"blade-storm",label:"BLADE STORM",description:`ダッシュ斬り撃破 ×${Math.floor(strongKills)}`,bonus:2};
  if(overdriveTime>=8)return{id:"redline",label:"REDLINE",description:`OVERDRIVE ${overdriveTime.toFixed(1)}秒`,bonus:2};
  if(hazardDodges>=3)return{id:"road-thread",label:"ROAD THREAD",description:`危険地帯突破 ×${Math.floor(hazardDodges)}`,bonus:1};
  return{id:"keep-pushing",label:"KEEP PUSHING",description:"危険へ踏み込んでSTYLE獲得",bonus:0};
}
