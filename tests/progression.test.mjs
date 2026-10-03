import test from "node:test";
import assert from "node:assert/strict";
import { applyUpgrades, upgradeCost, waveSettings, chooseEnemyType, advanceWave, isRunClear, applyEscapePenalty, updateRunRecord, runRank, STAGES, WEAPONS, BOSS_VARIANTS, pickRunContract, contractProgress } from "../dist/js/progression.js";

test("恒久強化がキャラクター性能へ反映される",()=>{
  const base={hp:100,speed:1,fireRate:1,shotDamage:1,slashRange:1,slashDamage:1,dashSpeed:1,dashCooldown:1};
  const tuned=applyUpgrades(base,{hp:2,speed:1,shoot:3,slash:4,dash:5});
  assert.equal(tuned.hp,116);assert.ok(tuned.shotDamage>1.14);assert.ok(tuned.slashRange>1.15);assert.ok(tuned.dashCooldown<.83);
});

test("強化コストと最大レベルを正しく返す",()=>{
  assert.equal(upgradeCost(0),4);assert.equal(upgradeCost(3),16);assert.equal(upgradeCost(5),null);
});

test("ステージとウェーブ進行で敵が強化される",()=>{
  const first=waveSettings(0,1,0),late=waveSettings(2,5,1);
  assert.ok(late.hpScale>first.hpScale);assert.ok(late.fireScale>first.fireScale);assert.ok(late.spawnInterval<first.spawnInterval);
  assert.equal(chooseEnemyType({grunt:.2,spread:.3,sniper:.5},.1),"grunt");assert.equal(chooseEnemyType({grunt:.2,spread:.3,sniper:.5},.35),"spread");assert.equal(chooseEnemyType({grunt:.2,spread:.3,sniper:.5},.9),"sniper");
});

test("5ウェーブ後に次ステージへ進み、3ステージ後に周回する",()=>{
  assert.deepEqual(advanceWave(0,2,0),{stageIndex:0,wave:3,loop:0,stageChanged:false});
  assert.deepEqual(advanceWave(2,5,0),{stageIndex:0,wave:1,loop:1,stageChanged:true});
  assert.equal(isRunClear(2,5,0),true);assert.equal(isRunClear(2,5,1),false);
});

test("各ステージに5つの道路イベントがあり、4武器を切り替えられる",()=>{
  assert.equal(STAGES.length,3);assert.ok(STAGES.every(stage=>stage.events.length===5));
  assert.deepEqual(WEAPONS.map(weapon=>weapon.id),["pistol","shotgun","laser","missile"]);
  assert.deepEqual(BOSS_VARIANTS.map(boss=>boss.id),["pursuer","dreadnought","whitefang"]);
});

test("攻撃的でノーダメージな走行ほど高ランクになる",()=>{
  assert.equal(runRank({score:15000,kills:30,near:24,dashNear:12,damage:0,maxCombo:25}),"S");
  assert.equal(runRank({score:300,kills:1,near:0,dashNear:0,damage:5,maxCombo:1}),"D");
});

test("RUN ORDERを選び、進捗と達成を判定できる",()=>{
  const first=pickRunContract(0),last=pickRunContract(.999);
  assert.equal(first.id,"grazer");assert.equal(last.id,"overdrive");
  assert.deepEqual(contractProgress(first,{near:7}),{value:7,ratio:7/15,complete:false});
  assert.equal(contractProgress(first,{near:15}).complete,true);
});

test("敵を逃すとBOOSTが減り、0未満にはならない",()=>{
  assert.equal(applyEscapePenalty(40),33);assert.equal(applyEscapePenalty(10,2),0);
});

test("キャラクター別記録はスコア・ランク・最速クリアを個別更新する",()=>{
  const first=updateRunRecord({}, {score:5000,time:180,rank:"B",clear:true});
  assert.deepEqual(first.record,{score:5000,clearTime:180,rank:"B",clears:1});
  const second=updateRunRecord(first.record,{score:4200,time:150,rank:"A",clear:true});
  assert.equal(second.record.score,5000);assert.equal(second.record.clearTime,150);assert.equal(second.record.rank,"A");assert.equal(second.record.clears,2);
});
