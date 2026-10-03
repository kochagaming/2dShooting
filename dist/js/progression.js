export const UPGRADE_KEYS = ["hp","speed","shoot","slash","dash"];

export const UPGRADE_DEFS = {
  hp: { label:"CORE ARMOR", jp:"最大HP", description:"最大HP +8%" },
  speed: { label:"DRIVE OUTPUT", jp:"移動速度", description:"移動速度 +3.5%" },
  shoot: { label:"GUN LINK", jp:"射撃性能", description:"威力 +5% / 連射 +4%" },
  slash: { label:"BLADE EDGE", jp:"斬撃性能", description:"威力 +6% / 範囲 +4%" },
  dash: { label:"BOOST SYNC", jp:"ダッシュ", description:"速度 +4% / 再使用短縮" }
};

export const STAGES = [
  { name:"VERDANT ROUTE", subtitle:"風走る草原街道", duration:18, weights:{grunt:.56,spread:.29,sniper:.15}, density:1, events:["OPEN MEADOW","WIND FARM","STONE CROSSING","RAIN FRONT","PURSUER APPROACH"] },
  { name:"RED WASTE", subtitle:"赤土の荒野回廊", duration:20, weights:{grunt:.24,spread:.58,sniper:.18}, density:1.14, events:["DRY FLATS","DUST TRAIL","CANYON GATE","SANDSTORM","PURSUER APPROACH"] },
  { name:"FROSTLINE", subtitle:"吹雪の凍結路", duration:22, weights:{grunt:.24,spread:.22,sniper:.54}, density:1.25, events:["SNOW FIELD","PINE PASS","ICE GRID","WHITEOUT","PURSUER APPROACH"] }
];

export const WEAPONS = [
  { id:"pistol", label:"HANDGUN", short:"HG", fireDelay:.105, damage:12, speed:850 },
  { id:"shotgun", label:"SHOTGUN", short:"SG", fireDelay:.34, damage:7, speed:760 },
  { id:"laser", label:"LASER", short:"LS", fireDelay:.058, damage:4.4, speed:1320 },
  { id:"missile", label:"MISSILE", short:"MS", fireDelay:.48, damage:30, speed:470 }
];

export const RUN_CONTRACTS = [
  { id:"grazer", label:"GRAZE ORDER", stat:"near", target:15, reward:3 },
  { id:"breaker", label:"DASH BREAK ORDER", stat:"strongKills", target:8, reward:4 },
  { id:"overdrive", label:"OVERDRIVE ORDER", stat:"overdriveTime", target:10, reward:4 }
];

export const BOSS_VARIANTS = [
  { id:"pursuer", name:"PURSUER // ROAD HUNTER", color:"#ff315f" },
  { id:"dreadnought", name:"DREADNOUGHT // DUST TYRANT", color:"#ff9f3d" },
  { id:"whitefang", name:"WHITE FANG // ICE STALKER", color:"#83d9ff" }
];

export function pickRunContract(roll=Math.random()){
  return RUN_CONTRACTS[Math.min(RUN_CONTRACTS.length-1,Math.floor(Math.max(0,roll)*RUN_CONTRACTS.length))];
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

export function waveSettings(stageIndex,wave,loop=0){
  const stage=STAGES[stageIndex%STAGES.length], w=Math.max(1,Math.min(5,wave));
  return {
    stage,
    hpScale:1+stageIndex*.16+(w-1)*.085+loop*.34,
    fireScale:1+stageIndex*.1+(w-1)*.055+loop*.18,
    spawnInterval:Math.max(.3,(1.12-(w-1)*.095-loop*.08)/stage.density),
    groupChance:Math.min(.72,.12+(w-1)*.1+stageIndex*.08+loop*.08),
    weights:stage.weights
  };
}

export function chooseEnemyType(weights,roll){
  if(roll<weights.grunt)return "grunt";
  if(roll<weights.grunt+weights.spread)return "spread";
  return "sniper";
}

export function advanceWave(stageIndex,wave,loop=0){
  if(wave<5)return {stageIndex,wave:wave+1,loop,stageChanged:false};
  const nextStage=(stageIndex+1)%STAGES.length;
  return {stageIndex:nextStage,wave:1,loop:nextStage===0?loop+1:loop,stageChanged:true};
}

export function isRunClear(stageIndex,wave,loop=0){
  return stageIndex===STAGES.length-1&&wave===5&&loop===0;
}

export function applyEscapePenalty(boost,count=1){
  return Math.max(0,boost-Math.max(0,count)*7);
}

export function updateRunRecord(record={},run={}){
  const previous={score:Math.max(0,Number(record.score)||0),clearTime:Math.max(0,Number(record.clearTime)||0),rank:["D","C","B","A","S"].includes(record.rank)?record.rank:"D",clears:Math.max(0,Number(record.clears)||0)};
  const rankOrder={D:0,C:1,B:2,A:3,S:4},score=Math.max(0,Number(run.score)||0),time=Math.max(0,Number(run.time)||0),rank=rankOrder[run.rank]===undefined?"D":run.rank;
  const isBestScore=score>previous.score,isBestTime=Boolean(run.clear&&time&&(previous.clearTime===0||time<previous.clearTime)),isBestRank=rankOrder[rank]>rankOrder[previous.rank];
  return {record:{score:isBestScore?score:previous.score,clearTime:isBestTime?time:previous.clearTime,rank:isBestRank?rank:previous.rank,clears:previous.clears+(run.clear?1:0)},isBestScore,isBestTime,isBestRank};
}

export function runRank({score=0,kills=0,near=0,dashNear=0,damage=0,maxCombo=0}={}){
  const performance=score+kills*90+near*45+dashNear*120+maxCombo*55-damage*750;
  if(performance>=18000&&damage<=1)return "S";
  if(performance>=10500)return "A";
  if(performance>=5500)return "B";
  if(performance>=2200)return "C";
  return "D";
}
