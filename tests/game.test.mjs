import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { boostTier, circlesOverlap, nearMissType, normalize } from "../dist/js/math.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("BOOSTの段階とOVERDRIVEを正しく返す", () => {
  assert.equal(boostTier(0).label, "BOOST LV1");
  assert.equal(boostTier(79).level, 4);
  assert.equal(boostTier(95).label, "OVERDRIVE");
  assert.ok(boostTier(100).fire > boostTier(40).fire);
});

test("弾の命中・ニアミス・ダッシュ回避を区別する", () => {
  const player = { x: 100, y: 100, r: 10 };
  assert.equal(nearMissType(player, { x: 110, y: 100, r: 5, grazed: false }), "hit");
  assert.equal(nearMissType(player, { x: 135, y: 100, r: 5, grazed: false }), "near");
  assert.equal(nearMissType(player, { x: 135, y: 100, r: 5, grazed: false }, true), "dash");
  assert.equal(nearMissType(player, { x: 180, y: 100, r: 5, grazed: false }), "none");
});

test("衝突とゼロベクトルの正規化が安定する", () => {
  assert.equal(circlesOverlap({ x: 0, y: 0, r: 4 }, { x: 7, y: 0, r: 3 }), true);
  assert.deepEqual(normalize(0, 0), { x: 0, y: -1 });
});

test("3キャラクターに正面・背面の5衣装があり表示切替UIを持つ", () => {
  const outfitIds = { ray: ["01", "04", "07", "08", "10"], mira: ["01", "02", "03", "04", "05"], lyn: ["01", "02", "03", "04", "05"] };
  for (const [character, ids] of Object.entries(outfitIds)) {
    for (const id of ids) {
      assert.ok(existsSync(resolve(root, `dist/assets/characters/${character}/front-${id}.png`)), `${character} front ${id}`);
      const rear = character === "ray" ? `dist/assets/ray-options/ray-${id}.png` : `dist/assets/characters/${character}/rear-${id}.png`;
      assert.ok(existsSync(resolve(root, rear)), `${character} rear ${id}`);
    }
  }
  const html = readFileSync(resolve(root, "dist/index.html"), "utf8");
  assert.match(html, /id="toggleCharacterView"/);
  assert.match(html, /id="toggleOutfitView"/);
});

test("トップ画像は衣装の正面・背面画像と分離されている", () => {
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(gameSource, /topArt:"\.\/assets\/ray-key-art\.png"/);
  assert.match(gameSource, /topArt:"\.\/assets\/characters\/mira-front\.png/);
  assert.match(gameSource, /topArt:"\.\/assets\/characters\/lyn-front\.png/);
  assert.match(gameSource, /ui\.keyartImage\.src=c\.topArt/);
  assert.doesNotMatch(gameSource, /ui\.keyartImage\.src=outfit\.front/);
});

test("3キャラクターの固有パッシブが戦闘処理へ接続されている", () => {
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(gameSource, /FLOW RECYCLE/);
  assert.match(gameSource, /KINETIC AEGIS/);
  assert.match(gameSource, /BLADE FEEDBACK/);
  assert.match(gameSource, /state\.characterId==="ray"/);
  assert.match(gameSource, /state\.characterId==="mira"/);
  assert.match(gameSource, /state\.characterId==="lyn"/);
});

test("ダッシュ斬り撃破後に次の敵へ連鎖できる", () => {
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(gameSource, /chainTime:0,chainCount:0,lockTarget:null/);
  assert.match(gameSource, /state\.chainTime=1\.15/);
  assert.match(gameSource, /state\.player\.dashCd=0/);
  assert.match(gameSource, /function drawDashLock\(\)/);
  assert.match(gameSource, /SPACE \/\/ CHAIN/);
});

test("スマートフォン用の移動・戦闘操作と自動照準を備える", () => {
  const html = readFileSync(resolve(root, "dist/index.html"), "utf8");
  const css = readFileSync(resolve(root, "dist/styles.css"), "utf8");
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(html, /id="touchStick"/);
  assert.match(html, /data-touch-hold="shoot"/);
  assert.match(html, /data-touch-key="Space"/);
  assert.match(html, /data-touch-key="KeyX"/);
  assert.match(css, /body\.touch-enabled\.touch-play \.touch-controls\{display:block\}/);
  assert.match(gameSource, /function setupTouchControls\(\)/);
  assert.match(gameSource, /classList\.add\("touch-enabled"\)/);
  assert.match(gameSource, /else if\(input\.touchShoot\)/);
  assert.match(gameSource, /state\.enemies/);
});

test("ウェーブ進行時に挑戦中限定のSYNC MODULEを選択できる", () => {
  const html = readFileSync(resolve(root, "dist/index.html"), "utf8");
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(html, /id="moduleDraft"/);
  assert.match(html, /id="moduleChoices"/);
  assert.match(gameSource, /const RUN_MODULES=/);
  assert.match(gameSource, /function openModuleDraft\(\)/);
  assert.match(gameSource, /function chooseRunModule\(id\)/);
  assert.match(gameSource, /next\.stageChanged\|\|\[2,4,6,8\]\.includes\(state\.wave\)/);
  assert.match(gameSource, /SYNC ×\$\{state\.modulePicks\}/);
});

test("標準ゲームパッドで移動と全戦闘アクションを操作できる", () => {
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(gameSource, /function pollGamepad\(\)/);
  assert.match(gameSource, /navigator\.getGamepads/);
  assert.match(gameSource, /input\.gamepadX/);
  assert.match(gameSource, /input\.gamepadShoot/);
  assert.match(gameSource, /rising\(4\)\|\|rising\(5\)/);
  assert.match(gameSource, /rising\(2\).*"KeyX"/);
  assert.match(gameSource, /rising\(1\).*"KeyC"/);
  assert.match(gameSource, /rising\(3\).*"KeyQ"/);
});

test("SYNC MODULEで選択中の武器を個別に多重射撃化できる", () => {
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(gameSource, /const WEAPON_MODULES=/);
  assert.match(gameSource, /AKIMBO LINK/);
  assert.match(gameSource, /BREACH LOAD/);
  assert.match(gameSource, /PRISM ARRAY/);
  assert.match(gameSource, /SWARM RACK/);
  assert.match(gameSource, /weaponBoosts:\{pistol:0,shotgun:0,laser:0,missile:0\}/);
  assert.match(gameSource, /\+weaponBoost;/);
  assert.match(gameSource, /damage:weapon\.damage\*character\.shotDamage\*\(1\+weaponBoost\*\.1\)/);
});

test("ボスの左右装甲を個別破壊して本体を露出できる", () => {
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(gameSource, /boss\.armorParts=\[/);
  assert.match(gameSource, /name:"LEFT POD"/);
  assert.match(gameSource, /name:"RIGHT POD"/);
  assert.match(gameSource, /function damageBossPart\(enemy,part,amount\)/);
  assert.match(gameSource, /amount\*=alive===2\?\.55:alive===1\?\.78:1/);
  assert.match(gameSource, /ARMOR \$\{armorAlive\}\/2/);
  assert.match(gameSource, /EXPOSED/);
});

test("挑戦ステージを選択し、クリアで次ステージとENDLESSを解放できる", () => {
  const html = readFileSync(resolve(root, "dist/index.html"), "utf8");
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(html, /id="stageSelect"/);
  assert.match(html, /id="stageGrid"/);
  assert.match(gameSource, /function renderStageSelect\(\)/);
  assert.match(gameSource, /index>profile\.unlockedStage/);
  assert.match(gameSource, /unlockAfterStageClear\(profile\.unlockedStage,cleared\)/);
  assert.match(gameSource, /profile\.endlessUnlocked=profile\.endlessUnlocked\|\|unlock\.endlessUnlocked/);
  assert.match(gameSource, /ENDLESS DRIVE/);
});

test("ステージ別の最高ランク・スコア・クリアタイムを保存してルート画面に表示する", () => {
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(gameSource, /function blankStageRecords\(\)/);
  assert.match(gameSource, /stageRecords:Object\.fromEntries/);
  assert.match(gameSource, /updateRunRecord\(profile\.stageRecords\[state\.stageIndex\]/);
  assert.match(gameSource, /STAGE SCORE/);
  assert.match(gameSource, /record\.rank/);
  assert.match(gameSource, /record\.clearTime/);
});

test("後半ステージに高速追尾HUNTERと全周弾BOMBERが出現する", () => {
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(gameSource, /hunter:\{hp:58/);
  assert.match(gameSource, /bomber:\{hp:76/);
  assert.match(gameSource, /enemy\.kind==="hunter"/);
  assert.match(gameSource, /enemy\.kind==="bomber"/);
  assert.match(gameSource, /for\(let i=0;i<8;i\+\+\)/);
  assert.match(gameSource, /settings\.eliteChance/);
});

test("10体のステージボスが固有の弾幕パターンを持つ", () => {
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(gameSource, /variant=\(enemy\.variant\?\?0\)%BOSS_VARIANTS\.length/);
  for(let variant=0;variant<10;variant++)assert.match(gameSource,new RegExp(`variant===${variant}`));
  assert.match(gameSource, /const phase=enemy\.volley%3/);
  assert.match(gameSource, /const openLane=enemy\.volley%5/);
});

test("装甲破壊後のボスは低HPでOVERLOADフェーズへ移行する", () => {
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(gameSource, /boss\.enraged=false/);
  assert.match(gameSource, /armorAlive===0&&e\.hp\/e\.maxHp<=\.42/);
  assert.match(gameSource, /PHASE SHIFT/);
  assert.match(gameSource, /boss\.enraged\?`\$\{Math\.ceil\(ratio\*100\)\}% · OVERLOAD`/);
  assert.match(gameSource, /enemy\.enraged\?1\.1:1/);
});

test("全15衣装が固有カラーの戦闘エフェクトを持つ", () => {
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(gameSource, /const OUTFIT_FX_COLORS=/);
  assert.match(gameSource, /const playerAccent=/);
  assert.equal((gameSource.match(/"[0-9]+":"#[0-9a-f]{6}"/gi)??[]).length,15);
  assert.match(gameSource, /color:tier\.level===5\?"#c8ff2e":accent/);
  assert.match(gameSource, /ctx\.strokeStyle=playerAccent\(\)/);
});

test("ステージ選択に脅威度・ギミック・ボス情報のブリーフィングがある", () => {
  const html = readFileSync(resolve(root, "dist/index.html"), "utf8");
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(html, /id="stageBriefing"/);
  assert.match(gameSource, /function renderStageBriefing\(\)/);
  assert.match(gameSource, /THREAT \$\{selectedStage\+1\}\/10/);
  assert.match(gameSource, /stage\.hazard/);
  assert.match(gameSource, /boss\.name/);
});

test("スマートフォンから一時停止して画面内ボタンで再開できる", () => {
  const html = readFileSync(resolve(root, "dist/index.html"), "utf8");
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(html, /id="touchPause"/);
  assert.match(html, /id="resumeButton"/);
  assert.match(gameSource, /function setPaused\(paused\)/);
  assert.match(gameSource, /ui\.touchPause\?\.addEventListener\("pointerdown"/);
  assert.match(gameSource, /ui\.resumeButton\.addEventListener\("click"/);
});
