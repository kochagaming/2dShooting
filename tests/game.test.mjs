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

test("トップ画面のキャラクターと説明文が重なりすぎないレイアウトにする", () => {
  const css = readFileSync(resolve(root, "dist/styles.css"), "utf8");
  assert.match(css, /\.start-content\{[^}]*width:410px/);
  assert.match(css, /\.start-content \.lead\{[^}]*background:linear-gradient/);
  assert.match(css, /\.ray-keyart\{[^}]*left:-78px[^}]*width:370px/);
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
  assert.match(gameSource, /chainTime:0,chainCount:0,nearChain:0,nearChainTimer:0,reversalTime:0,pointBlankFxTime:-1,lockTarget:null/);
  assert.match(gameSource, /state\.chainTime=1\.15/);
  assert.match(gameSource, /state\.player\.dashCd=0/);
  assert.match(gameSource, /function drawDashLock\(\)/);
  assert.match(gameSource, /SPACE \/\/ CHAIN/);
});

test("1回のダッシュ接触が同じ敵へ毎フレーム多段ヒットしない", () => {
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(gameSource, /dashSerial:0/);
  assert.match(gameSource, /state\.dashSerial\+\+/);
  assert.match(gameSource, /e\.lastDashHit!==state\.dashSerial/);
  assert.match(gameSource, /e\.lastDashHit=state\.dashSerial/);
  assert.match(gameSource, /damageEnemy\(e,12,false/);
  assert.match(gameSource, /DASH IMPACT/);
});

test("ダッシュ・斬撃・スライドの再使用状況をHUDとタッチボタンへ表示する", () => {
  const html = readFileSync(resolve(root, "dist/index.html"), "utf8");
  const css = readFileSync(resolve(root, "dist/styles.css"), "utf8");
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(html, /class="action-ready"/);
  assert.match(html, /id="dashReadyBar"/);
  assert.match(html, /id="slashReadyBar"/);
  assert.match(html, /id="slideReadyBar"/);
  assert.match(gameSource, /const actionReadiness=/);
  assert.match(gameSource, /remaining\.toFixed\(2\)/);
  assert.match(gameSource, /classList\.toggle\("cooling",!ready\)/);
  assert.match(css, /\.action-ready\{[^}]*bottom:105px/);
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

test("小型スマホでもRUN ORDERを非表示にせず確認できる", () => {
  const css = readFileSync(resolve(root, "dist/styles.css"), "utf8");
  assert.doesNotMatch(css, /touch-play \.run-contract\{display:none/);
  assert.match(css, /touch-play \.run-contract\{display:grid;top:109px/);
});

test("RUN ORDERに達成方法の短いヒントを表示する", () => {
  const html = readFileSync(resolve(root, "dist/index.html"), "utf8");
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(html, /id="contractHint"/);
  assert.match(gameSource, /ui\.contractHint\.textContent=`RUN ORDER \/\/ \$\{contract\.hint\}`/);
});

test("スマホの武器切替ボタンに現在の武器を表示する", () => {
  const html = readFileSync(resolve(root, "dist/index.html"), "utf8");
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(html, /id="touchWeaponIcon">HG</);
  assert.match(gameSource, /ui\.touchWeaponIcon\.textContent=weapon\.short/);
  assert.match(gameSource, /`武器切替 現在\$\{weapon\.label\} \$\{weapon\.trait\}`/);
});

test("射撃・ダッシュ・斬撃・スライド・武器切替をキー設定できる", () => {
  const html = readFileSync(resolve(root, "dist/index.html"), "utf8");
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(html, /id="keyConfigGrid"/);
  assert.match(html, /id="resetKeys"/);
  assert.match(gameSource, /const DEFAULT_KEYS=\{shoot:"KeyZ",dash:"Space",slash:"KeyX",slide:"KeyC",weapon:"KeyQ"\}/);
  assert.match(gameSource, /localStorage\.setItem\("velocityBreakerKeys"/);
  assert.match(gameSource, /actionKeys\.dash/);
  assert.match(gameSource, /actionKeys\.shoot/);
  assert.match(gameSource, /TouchDash/);
  assert.match(gameSource, /PadDash/);
});

test("マウスホイールで前後の武器へ素早く切り替えられる", () => {
  const html = readFileSync(resolve(root, "dist/index.html"), "utf8");
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(gameSource, /canvas\.addEventListener\("wheel"/);
  assert.match(gameSource, /cycleWeapon\(event\.deltaY>0\?1:-1\)/);
  assert.match(gameSource, /function cycleWeapon\(direction=1\)/);
  assert.match(gameSource, /state\.paused\|\|!ui\.moduleDraft\.hidden/);
  assert.match(html, /1～4 \/ マウスホイールも使用可/);
});

test("背景抑制・弾コントラスト・画面揺れ・被弾フラッシュ・振動を個別設定できる", () => {
  const html = readFileSync(resolve(root, "dist/index.html"), "utf8");
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(html, /id="settingFocus"/);
  assert.match(html, /id="settingContrast"/);
  assert.match(html, /id="settingShake"/);
  assert.match(html, /id="settingFlash"/);
  assert.match(html, /id="settingHaptics"/);
  assert.match(gameSource, /velocityBreakerShake/);
  assert.match(gameSource, /velocityBreakerFlash/);
  assert.match(gameSource, /velocityBreakerHaptics/);
  assert.match(gameSource, /velocityBreakerContrast/);
  assert.match(gameSource, /if\(bulletContrast\)\{ctx\.strokeStyle="#02040a"/);
  assert.match(gameSource, /function haptic\(pattern\)/);
  assert.match(gameSource, /vibrationActuator/);
  assert.match(gameSource, /playEffect\("dual-rumble"/);
  assert.match(gameSource, /haptic\(\[35,20,45\]\)/);
  assert.match(gameSource, /function toggleVisualSetting\(setting\)/);
  assert.match(gameSource, /shakeScale=shakeEnabled\?focusScale:0/);
  assert.match(gameSource, /if\(flashEnabled&&state\.flash>0\)/);
});

test("ウェーブ進行時に挑戦中限定のSYNC MODULEを選択できる", () => {
  const html = readFileSync(resolve(root, "dist/index.html"), "utf8");
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(html, /id="moduleDraft"/);
  assert.match(html, /id="moduleChoices"/);
  assert.match(gameSource, /const RUN_MODULES=/);
  assert.match(gameSource, /function openModuleDraft\(\)/);
  assert.match(gameSource, /function chooseRunModule\(id\)/);
  assert.match(gameSource, /!ui\.moduleDraft\.hidden.*\[\[0,0\],\[1,1\],\[2,2\]\]/);
  assert.match(html, /ゲームパッド A・B・Xで選択/);
  assert.match(gameSource, /next\.stageChanged\|\|\[2,4,6,8\]\.includes\(state\.wave\)/);
  assert.match(gameSource, /SYNC ×\$\{state\.modulePicks\}/);
  assert.match(gameSource, /p\.inv=Math\.max\(p\.inv,\.75\)/);
  assert.match(gameSource, /SAFE \.75s/);
});

test("標準ゲームパッドで移動と全戦闘アクションを操作できる", () => {
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(gameSource, /function pollGamepad\(\)/);
  assert.match(gameSource, /navigator\.getGamepads/);
  assert.match(gameSource, /input\.gamepadX/);
  assert.match(gameSource, /input\.gamepadAimX/);
  assert.match(gameSource, /pad\.axes\[2\]/);
  assert.match(gameSource, /pad\.axes\[3\]/);
  assert.match(gameSource, /Math\.hypot\(input\.gamepadAimX,input\.gamepadAimY\)/);
  assert.match(gameSource, /function drawAimReticle\(\)/);
  assert.match(gameSource, /"R-AIM"/);
  assert.match(gameSource, /input\.gamepadShoot/);
  assert.match(gameSource, /input\.gamepadUsed=true/);
  assert.match(gameSource, /input\.gamepadX=\(buttons\[15\]\?1:0\)-\(buttons\[14\]\?1:0\)/);
  assert.match(gameSource, /input\.gamepadY=\(buttons\[13\]\?1:0\)-\(buttons\[12\]\?1:0\)/);
  assert.match(gameSource, /CONTROLLER DISCONNECTED/);
  assert.match(gameSource, /activeGamepadMenu\(\).*navigateGamepadMenu/);
  assert.match(gameSource, /rising\(4\)\|\|rising\(5\)/);
  assert.match(gameSource, /rising\(2\).*"PadSlash"/);
  assert.match(gameSource, /rising\(1\).*"PadSlide"/);
  assert.match(gameSource, /rising\(3\).*"PadWeapon"/);
  assert.doesNotMatch(gameSource, /rising\(12\+i\).*`PadWeapon\$\{i\}`/);
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

test("4武器をキャラクター共通の恒久マスタリーで強化できる", () => {
  const html = readFileSync(resolve(root, "dist/index.html"), "utf8");
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(html, /id="weaponUpgradeGrid"/);
  assert.match(gameSource, /weaponUpgrades:blankWeaponUpgrades\(\)/);
  assert.match(gameSource, /function buyWeaponUpgrade\(key\)/);
  assert.match(gameSource, /weaponMastery=weaponUpgradeStats/);
  assert.match(gameSource, /\*weaponMastery\.damage/);
  assert.match(gameSource, /\*weaponMastery\.fireRate/);
  assert.match(gameSource, /function selectWeapon\(index\)/);
  assert.match(gameSource, /tapped\(`Digit\$\{i\+1\}`,`PadWeapon\$\{i\}`\)/);
  assert.match(html, /WEAPON MASTERY/);
});

test("レーザーは同じ敵へ多段ヒットせず最大3体を貫通する", () => {
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(gameSource, /pierce:weapon\.id==="laser"\?2:0/);
  assert.match(gameSource, /hitEnemies:new Set\(\)/);
  assert.match(gameSource, /!s\.hitEnemies\.has\(e\)/);
  assert.match(gameSource, /s\.hitEnemies\.add\(e\)/);
  assert.match(gameSource, /if\(s\.pierce>0\)\{s\.pierce--/);
  assert.match(gameSource, /s\.type==="laser"&&s\.hitCount===3/);
  assert.match(gameSource, /PRISM PIERCE ×3 \+180/);
});

test("ミサイルは着弾時に周囲の敵へ範囲ダメージを与える", () => {
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  const blast = gameSource.match(/function explodeMissile[\s\S]*?function updateShots/)?.[0] ?? "";
  assert.match(blast, /const radius=72/);
  assert.match(blast, /enemy!==primary/);
  assert.match(blast, /shot\.damage\*\.42/);
  assert.match(blast, /if\(linked>=2\)/);
  assert.match(blast, /BLAST LINK ×\$\{linked\+1\}/);
  assert.match(gameSource, /if\(s\.type==="missile"\)explodeMissile\(s,e\)/);
});

test("ショットガンは接近するほど高威力になり遠距離では減衰する", () => {
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(gameSource, /originX:shotX,originY:shotY/);
  assert.match(gameSource, /travel=Math\.hypot\(s\.x-s\.originX,s\.y-s\.originY\)/);
  assert.match(gameSource, /s\.type==="shotgun"\?s\.damage\*\(travel<190\?1\.3:travel>330\?\.72:1\)/);
  assert.match(gameSource, /damageEnemy\(e,impactDamage/);
  assert.match(gameSource, /pointBlankFxTime:-1/);
  assert.match(gameSource, /POINT BLANK ×1\.3/);
  assert.match(gameSource, /state\.hitstop=Math\.max\(state\.hitstop,\.035\)/);
  assert.match(gameSource, /e\.pointBlankAt=state\.time/);
  assert.match(gameSource, /state\.stats\.pointBlankKills\+\+/);
});

test("ボス撃破でDRIVE CHIPを回収しキャラクター選択画面で装備できる", () => {
  const html = readFileSync(resolve(root, "dist/index.html"), "utf8");
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(html, /id="chipGrid"/);
  assert.match(html, /id="resultChip"/);
  assert.match(gameSource, /const DRIVE_CHIPS=/);
  assert.match(gameSource, /chips:\[\],equippedChips:/);
  assert.match(gameSource, /function awardDriveChip\(stageIndex\)/);
  assert.match(gameSource, /awardDriveChip\(cleared\)/);
  assert.match(gameSource, /function equipChip\(chipId\)/);
  assert.match(gameSource, /chipIds\.reduce/);
  assert.match(gameSource, /DUPLICATE \$\{chip\.rarity\} .* CORE \+\$\{chip\.duplicateCore\}/);
  assert.match(gameSource, /firstRouteClear=.*stageClears/);
  assert.match(gameSource, /undiscovered=allEntries\.filter/);
  assert.match(gameSource, /ROUTE DISCOVERY/);
  assert.match(gameSource, /CHIP ARCHIVE \$\{profile\.chips\.length\}/);
  assert.match(gameSource, /UNDISCOVERED GUARANTEED/);
  assert.match(gameSource, /READY · NEW CHIP/);
});

test("DRIVE CHIPはレアリティ別の抽選率と重複変換量を持つ", () => {
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(gameSource, /rarity:"COMMON",weight:5,duplicateCore:2/);
  assert.match(gameSource, /rarity:"RARE",weight:3,duplicateCore:4/);
  assert.match(gameSource, /rarity:"LEGEND",weight:1,duplicateCore:8/);
  assert.match(gameSource, /data-rarity="\$\{chip\.rarity\}"/);
  assert.match(gameSource, /state\.runCores\+=chip\.duplicateCore/);
  assert.match(gameSource, /name:"SALVAGE MAGNET"/);
  assert.match(gameSource, /name:"RISK AMPLIFIER"/);
  assert.match(gameSource, /name:"TEMPO KERNEL"/);
});

test("キャラクターごとに異なるDRIVE CHIPを2個装備できる", () => {
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(gameSource, /selectedChipSlot = 0/);
  assert.match(gameSource, /normalizeEquippedChips/);
  assert.match(gameSource, /data-chip-slot=/);
  assert.match(gameSource, /slots\[selectedChipSlot\]=chipId/);
  assert.match(gameSource, /other>=0&&other!==selectedChipSlot/);
});

test("特定のDRIVE CHIPの組み合わせでLINK BONUSが発動する", () => {
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(gameSource, /const CHIP_SYNERGIES=/);
  assert.match(gameSource, /"flash\+overclock":\{name:"VELOCITY CIRCUIT"/);
  assert.match(gameSource, /"hybrid\+trigger":\{name:"ARSENAL CIRCUIT"/);
  assert.match(gameSource, /"edge\+flash":\{name:"FLASH CUTTER"/);
  assert.match(gameSource, /"aegis\+trigger":\{name:"FORTRESS CIRCUIT"/);
  assert.match(gameSource, /"hybrid\+overclock":\{name:"BREAKER CIRCUIT"/);
  assert.match(gameSource, /const chipSynergy=/);
  assert.match(gameSource, /synergy\?applyOutfitModifiers\(withChips,synergy\.mods\)/);
  assert.match(gameSource, /LINK BONUS/);
  assert.match(gameSource, /chipLink:chipSynergy/);
  assert.match(gameSource, /`LINK \/\/ \$\{state\.chipLink\.name\}`/);
  assert.match(gameSource, /· LINK \$\{state\.chipLink\.name\.split/);
  assert.match(gameSource, /candidateLink=partnerChip/);
  assert.match(gameSource, /LINK: \$\{candidateLink\.name\}/);
});

test("攻撃的な走りをSTYLE AWARDとしてリザルト報酬へ反映する", () => {
  const html = readFileSync(resolve(root, "dist/index.html"), "utf8");
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(html, /id="styleAward"/);
  assert.match(gameSource, /styleAwarded:false/);
  assert.match(gameSource, /const style=styleAward\(state\.stats\)/);
  assert.match(gameSource, /state\.runCores\+=style\.bonus/);
  assert.match(gameSource, /STYLE \/\/ \$\{style\.label\}/);
});

test("斬撃で壊した敵弾をスコア・RUN ORDER・STYLEへ反映する", () => {
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  const progressionSource = readFileSync(resolve(root, "dist/js/progression.js"), "utf8");
  assert.match(gameSource, /bulletBreaks:0/);
  assert.match(gameSource, /state\.stats\.bulletBreaks\+=bulletBreaks/);
  assert.match(gameSource, /BULLET BREAK ×\$\{bulletBreaks\}/);
  assert.match(gameSource, /BLADE CLEAR ×\$\{bulletBreaks\}/);
  assert.match(progressionSource, /label:"BULLET BREAK ORDER"/);
  assert.match(progressionSource, /label:"BLADE DANCER"/);
});

test("RUN ORDER目標は挑戦ステージの長さに合わせて調整する", () => {
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  const progressionSource = readFileSync(resolve(root, "dist/js/progression.js"), "utf8");
  assert.match(gameSource, /scaleRunContract\(pickRunContract\(\),selectedStage,selectedEndless\)/);
  assert.match(progressionSource, /label:"REVERSAL ORDER"[\s\S]*?stat:"reversals"/);
});

test("ボスの左右装甲を個別破壊して本体を露出できる", () => {
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(gameSource, /boss\.armorParts=\[/);
  assert.match(gameSource, /name:"LEFT POD"/);
  assert.match(gameSource, /name:"RIGHT POD"/);
  assert.match(gameSource, /function damageBossPart\(enemy,part,amount\)/);
  assert.match(gameSource, /amount\*=alive===2\?\.55:alive===1\?\.78:/);
  assert.match(gameSource, /ARMOR \$\{armorAlive\}\/2/);
  assert.match(gameSource, /CORE OPEN/);
});

test("ボスの脚部破壊からダッシュ斬り弱点攻撃へつなげられる", () => {
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(gameSource, /boss\.legParts=\[/);
  assert.match(gameSource, /name:"LEFT DRIVE"/);
  assert.match(gameSource, /name:"RIGHT DRIVE"/);
  assert.match(gameSource, /function damageBossLeg\(enemy,leg,amount\)/);
  assert.match(gameSource, /enemy\.coreExposed=true/);
  assert.match(gameSource, /CORE OPEN \/\/ DASH SLASH NOW/);
  assert.match(gameSource, /enemy\.coreExposed&&strong\?2\.4:1/);
  assert.match(gameSource, /CORE REND ×2\.4/);
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
  assert.match(gameSource, /selectedEndless=true/);
  assert.match(gameSource, /selectedMode",selectedEndless\?"endless":"campaign"/);
  assert.match(gameSource, /CAMPAIGN COMPLETE \/\/ ENDLESS DRIVE UNLOCKED/);
  assert.match(gameSource, /ENTER ∞ DRIVE/);
  assert.match(gameSource, /ENDLESS DRIVE/);
});

test("ENDLESSの最高到達地点とスコアを保存してルート画面へ表示する", () => {
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(gameSource, /endlessRecord:\{score:0,loop:0,stage:0,wave:0\}/);
  assert.match(gameSource, /previousDistance=previous\.loop\*STAGES\.length\+previous\.stage/);
  assert.match(gameSource, /profile\.endlessRecord=\{score:Math\.max/);
  assert.match(gameSource, /ENDLESS BEST/);
  assert.match(gameSource, /BEST \/\/ LOOP/);
  assert.match(gameSource, /∞ L\$\{state\.stageLoop\+1\}/);
});

test("ENDLESSでも各ボス撃破ごとにDRIVE CHIPを回収できる", () => {
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(gameSource, /if\(state\.endless\)\{awardDriveChip\(state\.stageIndex\)/);
  assert.match(gameSource, /DRIVE CHIP RECOVERED/);
  assert.match(gameSource, /CHIP REWARD RANDOM/);
});

test("ENDLESSのボス撃破時に回収済み報酬をチェックポイント保存する", () => {
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(gameSource, /bankedCores:0/);
  assert.match(gameSource, /function bankEndlessCheckpoint\(x,y\)/);
  assert.match(gameSource, /profile\.cores\+=amount/);
  assert.match(gameSource, /state\.bankedCores\+=amount/);
  assert.match(gameSource, /state\.runCores=0/);
  assert.match(gameSource, /state\.player\.maxHp\*\.18/);
  assert.match(gameSource, /state\.player\.dashCd=0/);
  assert.match(gameSource, /state\.player\.slashCd=0/);
  assert.match(gameSource, /REPAIR \+\$\{heal\}/);
  assert.match(gameSource, /bankEndlessCheckpoint\(enemy\.x,enemy\.y\)/);
  assert.match(gameSource, /state\.runCores\+state\.bankedCores/);
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

test("10体のステージボスが固有シルエットを持つ", () => {
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  const frameBlock = gameSource.match(/function drawBossVariantFrame[\s\S]*?function drawEnemy/)?.[0] ?? "";
  assert.match(gameSource, /drawBossVariantFrame\(e\.variant\?\?0,c,stride\)/);
  assert.equal((frameBlock.match(/variant===/g) ?? []).length, 9);
});

test("ボスHUDが次の固有攻撃と発射直前の警告を表示する", () => {
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  const html = readFileSync(resolve(root, "dist/index.html"), "utf8");
  assert.match(html, /id="bossIntent"/);
  assert.match(gameSource, /function bossAttackIntent\(boss\)/);
  assert.match(gameSource, /OPEN LANE/);
  assert.match(gameSource, /CROSSFIRE \+ LANCE/);
  assert.match(gameSource, /warning\?"INCOMING":"NEXT"/);
  assert.match(gameSource, /bossIntent\.classList\.toggle\("armed",warning\)/);
});

test("ボスの破壊可能部位と露出コアを画面上で識別できる", () => {
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  const weakPointBlock = gameSource.match(/function drawBossWeakPoints[\s\S]*?function drawEnemy/)?.[0] ?? "";
  assert.match(weakPointBlock, /e\.armorParts/);
  assert.match(weakPointBlock, /e\.legParts/);
  assert.match(weakPointBlock, /part\.hp\/part\.maxHp/);
  assert.match(weakPointBlock, /DASH ×2\.4/);
  assert.match(gameSource, /drawBossWeakPoints\(e,armorAlive,stride\)/);
});

test("装甲破壊後のボスは低HPでOVERLOADフェーズへ移行する", () => {
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(gameSource, /boss\.enraged=false/);
  assert.match(gameSource, /armorAlive===0&&e\.hp\/e\.maxHp<=\.42/);
  assert.match(gameSource, /PHASE SHIFT/);
  assert.match(gameSource, /CORE OPEN \/ OVERLOAD/);
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
  assert.match(gameSource, /function setPaused\(paused,reason=""\)/);
  assert.match(gameSource, /ui\.touchPause\?\.addEventListener\("pointerdown"/);
  assert.match(gameSource, /ui\.resumeButton\.addEventListener\("click"/);
});

test("Escapeキーでプレイ中のポーズと再開を切り替えられる", () => {
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(gameSource, /key === "Escape" && state\.mode === "play"\) setPaused\(!state\.paused\)/);
});

test("リザルト画面からRキーですぐ再挑戦できる", () => {
  const html = readFileSync(resolve(root, "dist/index.html"), "utf8");
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(html, /ENTER \/ R \/ PAD A/);
  assert.match(gameSource, /key === "KeyR" && state\.mode === "gameover"/);
  assert.match(gameSource, /ui\.help\.hidden&&ui\.spriteSelect\.hidden&&ui\.stageSelect\.hidden\) startGame\(\)/);
});

test("ゲームパッドだけでタイトル・選択画面・ポーズを操作できる", () => {
  const html = readFileSync(resolve(root, "dist/index.html"), "utf8");
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(gameSource, /function activeGamepadMenu\(\)/);
  assert.match(gameSource, /function navigateGamepadMenu\(root,direction,activate=false,back=false\)/);
  assert.match(gameSource, /rising\(13\)/);
  assert.match(gameSource, /rising\(15\)/);
  assert.match(gameSource, /navigateGamepadMenu\(menu,direction,rising\(0\),rising\(1\)\)/);
  assert.match(gameSource, /root===ui\.spriteSelect.*ui\.outfitStage\.hidden/);
  assert.match(gameSource, /gamepadMenuAxisLatch=false/);
  assert.match(gameSource, /Math\.abs\(axis\)>\.65&&!gamepadMenuAxisLatch/);
  assert.match(gameSource, /function spatialMenuIndex\(buttons,index,dx,dy\)/);
  assert.match(gameSource, /offAxis\*2\.4/);
  assert.match(gameSource, /function gamepadMenuStartIndex\(root,buttons\)/);
  assert.match(gameSource, /\[aria-checked="true"\]:not\(:disabled\)/);
  assert.match(html, /メニューでは十字キー／左スティックで選択、Aで決定、Bで戻る/);
});

test("選択画面でEnterを押しても意図せず出撃しない", () => {
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(gameSource, /key === "Enter" && state\.mode !== "play"&&ui\.help\.hidden&&ui\.spriteSelect\.hidden&&ui\.stageSelect\.hidden/);
});

test("ポーズ画面から操作ガイドと設定を開いてポーズへ戻れる", () => {
  const html = readFileSync(resolve(root, "dist/index.html"), "utf8");
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(html, /id="pauseHelp"/);
  assert.match(html, /CONTROLS \/ SETTINGS/);
  assert.match(gameSource, /ui\.pauseHelp\.addEventListener\("click",\(\)=>toggleHelp\(true\)\)/);
  assert.match(gameSource, /helpWasPaused\s*=\s*state\.paused/);
});

test("画面から離れたとき自動停止して入力状態を安全に解除する", () => {
  const html = readFileSync(resolve(root, "dist/index.html"), "utf8");
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(html, /id="pauseTitle"/);
  assert.match(gameSource, /function autoPause\(\)/);
  assert.match(gameSource, /visibilitychange/);
  assert.match(gameSource, /AUTO PAUSED \/\/ FOCUS LOST/);
  assert.match(gameSource, /input\.keys\.clear\(\)/);
  assert.match(gameSource, /input\.touchX=0;input\.touchY=0/);
});

test("ポーズ画面から二段階確認で回収品を持って挑戦を終了できる", () => {
  const html = readFileSync(resolve(root, "dist/index.html"), "utf8");
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(html, /id="pauseAbort"/);
  assert.match(html, /回収分を持って終了/);
  assert.match(gameSource, /function requestAbortRun\(\)/);
  assert.match(gameSource, /abortArmedUntil=now\+2500/);
  assert.match(gameSource, /CONFIRM END RUN/);
  assert.match(gameSource, /endGame\(false\)/);
});

test("初回ステージで攻撃的な基本操作を順番に案内する", () => {
  const html = readFileSync(resolve(root, "dist/index.html"), "utf8");
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(html, /id="trainingHint"/);
  assert.match(gameSource, /function updateTraining\(moveSpeed=0\)/);
  assert.match(gameSource, /WASD \/ STICK \/\/ MOVE/);
  assert.match(gameSource, /SLASH \/\/ BREAK A BULLET/);
  assert.match(gameSource, /THROUGH FIRE \/\/ DASH DODGE/);
  assert.match(gameSource, /SLIDE \/\/ LOW PROFILE/);
  assert.match(gameSource, /WEAPON \/\/ SWITCH ROLE/);
  assert.match(gameSource, /state\.training\.slide=true/);
  assert.match(gameSource, /state\.training\.weapon=true/);
  assert.match(gameSource, /state\.stats\.bulletBreaks>0/);
  assert.match(gameSource, /state\.stats\.dashNear>0/);
  assert.match(gameSource, /profile\.stageClears\?\.\[0\]/);
  assert.match(gameSource, /DRIVE TRAINING \/\/ COMPLETE/);
});

test("操作ガイドで攻撃的な戦闘ループとSLOW GRAZEを説明する", () => {
  const html = readFileSync(resolve(root, "dist/index.html"), "utf8");
  const css = readFileSync(resolve(root, "dist/styles.css"), "utf8");
  assert.match(html, /class="combat-loop"/);
  assert.match(html, /APPROACH[\s\S]*GRAZE[\s\S]*BOOST[\s\S]*REVERSAL[\s\S]*BREAK/);
  assert.match(html, /SLOW GRAZE/);
  assert.match(css, /\.control-help\{justify-content:flex-start;overflow-y:auto/);
});

test("操作ガイドで4武器の役割と切替番号を比較できる", () => {
  const html = readFileSync(resolve(root, "dist/index.html"), "utf8");
  const css = readFileSync(resolve(root, "dist/styles.css"), "utf8");
  assert.match(html, /class="weapon-guide"/);
  assert.match(html, /1 \/ HG[\s\S]*2 \/ SG[\s\S]*3 \/ LS[\s\S]*4 \/ MS/);
  assert.match(html, /190px以内で威力1\.3倍/);
  assert.match(html, /最大3体貫通/);
  assert.match(css, /\.weapon-guide>div/);
});

test("敵弾との距離をNEAR MISS圏のRISK FIELDとして可視化する", () => {
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(gameSource, /function drawRiskField\(\)/);
  assert.match(gameSource, /riskRadius=p\.r\+49/);
  assert.match(gameSource, /state\.enemyShots/);
  assert.match(gameSource, /dashing\?"#c8ff2e":"#00f0ff"/);
  assert.match(gameSource, /drawRiskField\(\);[\s\S]*?if\(p\.slashTime/);
});

test("斬撃可能な最寄り敵弾へBREAK照準を表示する", () => {
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  const cueBlock = gameSource.match(/function drawBulletBreakCue[\s\S]*?function draw\(\)/)?.[0] ?? "";
  assert.match(cueBlock, /p\.slashCd>0/);
  assert.match(cueBlock, /state\.characterStats\.slashRange/);
  assert.match(cueBlock, /p\.dashTime>0\?108:72/);
  assert.match(cueBlock, /fillText\("BREAK"/);
  assert.match(gameSource, /drawBulletBreakCue\(\)/);
});

test("連続NEAR MISSでGRAZE CHAINが伸びBOOST報酬が増える", () => {
  const html = readFileSync(resolve(root, "dist/index.html"), "utf8");
  const css = readFileSync(resolve(root, "dist/styles.css"), "utf8");
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(html, /id="grazeFlow"/);
  assert.match(html, /id="grazeTimer"/);
  assert.match(css, /\.graze-flow\.max/);
  assert.match(gameSource, /nearChain:0,nearChainTimer:0/);
  assert.match(gameSource, /state\.nearChain=Math\.min\(8,state\.nearChain\+1\)/);
  assert.match(gameSource, /aggressive=dashNear\|\|moveSpeed>=180/);
  assert.match(gameSource, /SLOW GRAZE/);
  assert.match(gameSource, /state\.stats\.maxGrazeChain=Math\.max/);
  assert.match(gameSource, /chainScale=aggressive\?1\+\(state\.nearChain-1\)\*\.12:1/);
  assert.match(gameSource, /GRAZE ×\$\{state\.nearChain\}/);
  assert.match(gameSource, /state\.nearChain=0;state\.nearChainTimer=0/);
  assert.match(gameSource, /state\.speedBurst=Math\.max\(state\.speedBurst,\.12\+state\.nearChain\*\.06\)/);
  assert.match(gameSource, /state\.nearChain>priorChain/);
  assert.match(gameSource, /p\.dashCd=0;announce\("GRAZE FLOW MAX \/\/ DASH READY"/);
  assert.match(gameSource, /state\.nearChainTimer\/1\.2/);
  assert.match(gameSource, /FLOW MAX \/\/ DASH READY/);
});

test("JUST DODGE直後の斬撃がREVERSALとして強化される", () => {
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(gameSource, /reversalTime:0/);
  assert.match(gameSource, /state\.reversalTime=1\.15;p\.slashCd=0/);
  assert.match(gameSource, /JUST DODGE \/\/ REVERSAL READY/);
  assert.match(gameSource, /character\.slashRange\*\(reversal\?1\.15:1\)/);
  assert.match(gameSource, /character\.slashDamage\*\(reversal\?1\.5:1\)/);
  assert.match(gameSource, /REVERSAL ×1\.5/);
  assert.match(gameSource, /REVERSAL \$\{state\.reversalTime\.toFixed\(1\)\}s/);
  assert.match(gameSource, /slashRow\.classList\.toggle\("reversal",reversalReady\)/);
  assert.match(gameSource, /connected=hits>0\|\|bulletBreaks>0/);
  assert.match(gameSource, /if\(connected\)\{state\.training\.reversal=true;state\.stats\.reversals\+\+;preserveCombo\(1\.25\)\}/);
  assert.match(gameSource, /REVERSAL \/\/ WHIFF/);
  assert.match(gameSource, /ui\.resultReversal\.textContent=state\.stats\.reversals/);
  assert.match(gameSource, /key:"reversal",text:`JUST DODGE →/);
});

test("コンボ残り時間をゲージで表示し切れる直前に警告する", () => {
  const html = readFileSync(resolve(root, "dist/index.html"), "utf8");
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  const css = readFileSync(resolve(root, "dist/styles.css"), "utf8");
  assert.match(html, /id="comboTimerBar"/);
  assert.match(gameSource, /state\.comboTimer\/comboMax/);
  assert.match(gameSource, /comboTimer\.classList\.toggle\("critical"/);
  assert.match(css, /\.combo-timer\.critical/);
});

test("10・20・50コンボ到達時に段階的な戦闘報酬を得る", () => {
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  const milestoneBlock = gameSource.match(/function comboMilestone[\s\S]*?function killEnemy/)?.[0] ?? "";
  assert.match(milestoneBlock, /value===10/);
  assert.match(milestoneBlock, /BOOST \+6/);
  assert.match(milestoneBlock, /value===20/);
  assert.match(milestoneBlock, /DASH READY/);
  assert.match(milestoneBlock, /value===50/);
  assert.match(milestoneBlock, /state\.boost=100/);
  assert.match(milestoneBlock, /state\.player\.slashCd=0/);
  assert.match(gameSource, /comboMilestone\(state\.combo\)/);
});

test("高コンボほどスピードラインと画面フレーム演出が強化される", () => {
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  const css = readFileSync(resolve(root, "dist/styles.css"), "utf8");
  assert.match(gameSource, /const comboRush=Math\.min\(1,state\.combo\/50\)/);
  assert.match(gameSource, /comboRush\*160/);
  assert.match(gameSource, /classList\.toggle\("combo-rush",state\.combo>=20\)/);
  assert.match(gameSource, /classList\.toggle\("combo-max",state\.combo>=50\)/);
  assert.match(gameSource, /const comboShade=Math\.min\(\.12,state\.combo\*\.0024\)/);
  assert.match(css, /\.combo-max \.game-frame/);
});

test("高速NEAR MISSと敵弾破壊で撃破コンボを短時間維持できる", () => {
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  const css = readFileSync(resolve(root, "dist/styles.css"), "utf8");
  assert.match(gameSource, /function preserveCombo\(seconds\)/);
  assert.match(gameSource, /preserveCombo\(\.85\)/);
  assert.match(gameSource, /preserveCombo\(just\?1\.5:dashNear\?1\.2:\.75\)/);
  assert.match(gameSource, /comboTimer\.classList\.toggle\("saved"/);
  assert.match(css, /\.combo-timer\.saved/);
});

test("高速走行とBOOSTでドロップ吸引範囲が広がる", () => {
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(gameSource, /magnetRange=\(150\+tier\.level\*28/);
  assert.match(gameSource, /runnerSpeed>280\?90:0/);
  assert.match(gameSource, /tier\.level===5\?110:0/);
  assert.match(gameSource, /pullPower=540\+tier\.level\*80/);
  assert.match(gameSource, /item\.magnetized=true/);
  assert.match(gameSource, /\*state\.characterStats\.pickupRange/);
});

test("瀕死時は明確な警告を出しREPAIRドロップ率が上がる", () => {
  const html = readFileSync(resolve(root, "dist/index.html"), "utf8");
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  const css = readFileSync(resolve(root, "dist/styles.css"), "utf8");
  assert.match(gameSource, /repairChance=state\.player\.hp<state\.player\.maxHp\*\.35\?\.24:\.13/);
  assert.match(gameSource, /coreCritical=p\.hp>0&&p\.hp\/p\.maxHp<=\.3/);
  assert.match(gameSource, /ui\.coreCritical\.hidden=!coreCritical/);
  assert.match(html, /id="coreCritical"[\s\S]*CORE CRITICAL/);
  assert.match(css, /\.core-critical \.hp-track/);
  assert.match(css, /\.core-critical-alert/);
});

test("余ったREPAIR回復量をBOOSTへ変換して無駄をなくす", () => {
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(gameSource, /overflowBoost=Math\.round\(\(repairPower-heal\)\/repairPower\*8\)/);
  assert.match(gameSource, /state\.boost=clamp\(state\.boost\+overflowBoost,0,100\)/);
  assert.match(gameSource, /REPAIR CONVERT \/\/ BOOST/);
});

test("特殊DRIVE CHIPがNEAR BOOST・回収範囲・コンボ時間を変更する", () => {
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(gameSource, /boostGain:1, pickupRange:1, comboWindow:1/);
  assert.match(gameSource, /gain=baseGain\*chainScale\*state\.characterStats\.boostGain/);
  assert.match(gameSource, /state\.comboTimer = 2\.4\*state\.characterStats\.comboWindow/);
  assert.match(gameSource, /\["FLOW",`\$\{Math\.round\(c\.boostGain\*100\)\}%`/);
  assert.match(gameSource, /Object\.keys\(CHIP_SYNERGIES\)\.length/);
});

test("出撃直後は3カウント中に敵とステージ時間が停止する", () => {
  const html = readFileSync(resolve(root, "dist/index.html"), "utf8");
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(html, /id="launchCountdown"/);
  assert.match(gameSource, /launchTimer:2\.25/);
  assert.match(gameSource, /if\(state\.launchTimer>0\)/);
  assert.match(gameSource, /ui\.launchCountdown\.hidden=true/);
  assert.match(gameSource, /announce\(state\.chipLink\?.*:"DRIVE!",true\)/);
});

test("最終ウェーブを走り切ってからボスが出現する", () => {
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.doesNotMatch(gameSource, /else if\(state\.wave===STAGES\[state\.stageIndex\]\.waveCount\)spawnBoss\(\)/);
  assert.match(gameSource, /if\(state\.waveTime>=activeWaveDuration\(currentStage\)\)/);
  assert.match(gameSource, /finalWave&&!bossAlive&&!bossAlreadySpawned/);
  assert.match(gameSource, /spawnBoss\(\)/);
  assert.match(gameSource, /!bossAlive&&bossAlreadySpawned&&state\.endless/);
});

test("次ウェーブまたはボス出現までの残り時間をHUDへ表示する", () => {
  const html = readFileSync(resolve(root, "dist/index.html"), "utf8");
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(html, /id="waveProgressBar"/);
  assert.match(html, /id="waveCountdown"/);
  assert.match(gameSource, /waveDuration=activeWaveDuration\(stage\)/);
  assert.match(gameSource, /waveRatio=clamp\(state\.waveTime\/waveDuration,0,1\)/);
  assert.match(gameSource, /remaining=Math\.max\(0,waveDuration-state\.waveTime\)/);
  assert.match(gameSource, /boss\?"BOSS ENGAGED"/);
  assert.match(gameSource, /finalWave\?"BOSS":"NEXT WAVE"/);
});

test("初回トレーニングでは最初のウェーブを延長する", () => {
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(gameSource, /function activeWaveDuration\(stage=STAGES\[state\.stageIndex\]\)/);
  assert.match(gameSource, /state\.training\?\.enabled&&state\.stageIndex===0\?stage\.duration\+18/);
  assert.match(gameSource, /waveTime=activeWaveDuration\(\)/);
});

test("被弾原因と飛来方向を短時間表示する", () => {
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(gameSource, /function hurtPlayer\(sourceX=/);
  assert.match(gameSource, /damageMarker=\{sourceX,sourceY,reason/);
  assert.match(gameSource, /function drawDamageMarker\(\)/);
  assert.match(gameSource, /gridGate:\{reason:"ICE GRID"/);
  assert.match(gameSource, /floodGate:\{reason:"CANYON GATE"/);
  assert.match(gameSource, /`\$\{e\.kind\.toUpperCase\(\)\} CONTACT`/);
  assert.match(gameSource, /"ENEMY FIRE"/);
});

test("無敵点滅中もプレイヤーを完全には消さない", () => {
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(gameSource, /const invBlink=p\.inv>0/);
  assert.match(gameSource, /ctx\.globalAlpha=invBlink\?\.34:1;pixelPlayer/);
  assert.doesNotMatch(gameSource, /if\(!\(p\.inv>0&&p\.airTime<=0/);
});

test("後半ステージに左右の進路を選ぶ崩落道路が出現する", () => {
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  const progressionSource = readFileSync(resolve(root, "dist/js/progression.js"), "utf8");
  assert.match(gameSource, /state\.stageIndex>=5/);
  assert.match(gameSource, /type:"roadSplit"/);
  assert.match(gameSource, /safeSide/);
  assert.match(gameSource, /ROAD COLLAPSE/);
  assert.match(gameSource, /ROUTE THREAD \+8/);
  assert.match(gameSource, /OPEN ROUTE/);
  assert.match(progressionSource, /COLLAPSE FORK/);
});

test("後半ルートごとに挙動の異なる固有ゲートが出現する", () => {
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(gameSource, /6:\{type:"stormGate"/);
  assert.match(gameSource, /7:\{type:"emberGate"/);
  assert.match(gameSource, /9:\{type:"lockdownGate"/);
  assert.match(gameSource, /LIGHTNING LANE/);
  assert.match(gameSource, /EMBER WALL/);
  assert.match(gameSource, /hazard\.baseGap-clamp\(hazard\.y\/H/);
  assert.match(gameSource, /state\.stats\.hazardDodges\+\+/);
});

test("BOOST RAMPで左右レーンへジャンプし、滞空中の速度感を強める", () => {
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(gameSource, /airTime:0,airMax:\.82/);
  assert.match(gameSource, /laneDir\*W\*\.22/);
  assert.match(gameSource, /floating\("LANE JUMP \+14"/);
  assert.match(gameSource, /p\.airTime>0\?300:0/);
  assert.match(gameSource, /airLift=Math\.sin/);
  assert.match(gameSource, /← LANE JUMP →/);
});

test("画面下部にも挑戦中のルート名を同期表示する", () => {
  const html = readFileSync(resolve(root, "dist/index.html"), "utf8");
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(html, /id="footerStage"/);
  assert.match(gameSource, /ui\.footerStage\.textContent=state\.endless/);
});

test("プレイHUDのルート情報をブランドとスコアの下へ分離する", () => {
  const css = readFileSync(resolve(root, "dist/styles.css"), "utf8");
  assert.match(css, /\.run-status\{[^}]*top:62px/);
  assert.match(css, /\.hp-wrap\{[^}]*top:98px/);
  assert.match(css, /\.run-contract\{[^}]*top:136px/);
  assert.match(css, /\.graze-flow\{[^}]*top:136px/);
});

test("10ステージが個別の背景カラーパレットを持つ", () => {
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  const paletteBlock = gameSource.match(/const STAGE_PALETTES=\[(.*?)\];/s)?.[1] ?? "";
  assert.equal((paletteBlock.match(/sky0:/g) ?? []).length, 10);
  assert.match(gameSource, /palette=STAGE_PALETTES\[stageIndex%STAGE_PALETTES\.length\]/);
  assert.match(gameSource, /stage=STAGES\[stageIndex\]\.theme/);
  assert.match(gameSource, /function drawStageLandmark\(stageIndex,horizon,palette\)/);
  const landmarkBlock = gameSource.match(/function drawStageLandmark[\s\S]*?function drawBackground/)?.[0] ?? "";
  assert.equal((landmarkBlock.match(/stageIndex===/g) ?? []).length, 9);
  assert.match(gameSource, /drawStageLandmark\(stageIndex,horizon,palette\)/);
});

test("リザルトに出現数を基準とした撃破率を表示する", () => {
  const html = readFileSync(resolve(root, "dist/index.html"), "utf8");
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(html, /KILL RATE/);
  assert.match(gameSource, /state\.stats\.spawned\+\+/);
  assert.match(gameSource, /Math\.round\(state\.stats\.kills\/state\.stats\.spawned\*100\)/);
  assert.match(gameSource, /`\$\{killRate\}% \(\$\{state\.stats\.kills\}\/\$\{state\.stats\.spawned\}\)`/);
});

test("リザルトに最大GRAZE CHAINを表示する", () => {
  const html = readFileSync(resolve(root, "dist/index.html"), "utf8");
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(html, /MAX GRAZE <b id="resultGraze">/);
  assert.match(html, /BULLET BREAK <b id="resultBreaks">/);
  assert.match(gameSource, /ui\.resultGraze\.textContent=`×\$\{state\.stats\.maxGrazeChain\}`/);
  assert.match(gameSource, /ui\.resultBreaks\.textContent=state\.stats\.bulletBreaks/);
  assert.match(gameSource, /ui\.resultNear\.textContent=`\$\{state\.stats\.near\} \/ J\$\{state\.stats\.justDodge\}`/);
});

test("リザルトでダッシュ斬り撃破と至近距離撃破を確認できる", () => {
  const html = readFileSync(resolve(root, "dist/index.html"), "utf8");
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(html, /DASH BREAK <b id="resultStrong">/);
  assert.match(html, /POINT BLANK <b id="resultBreach">/);
  assert.match(gameSource, /ui\.resultStrong\.textContent=state\.stats\.strongKills/);
  assert.match(gameSource, /ui\.resultBreach\.textContent=state\.stats\.pointBlankKills/);
});

test("ステージ再挑戦用のMASTERY条件と初達成報酬を表示する", () => {
  const html = readFileSync(resolve(root, "dist/index.html"), "utf8");
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  const progressionSource = readFileSync(resolve(root, "dist/js/progression.js"), "utf8");
  assert.match(gameSource, /stageMastery\(profile\.stageRecords/);
  assert.match(gameSource, /MASTERY \$\{mastery\.count\}\/\$\{mastery\.total\}/);
  assert.match(gameSource, /mastery\.medals\.map/);
  assert.match(gameSource, /medal\.label/);
  assert.match(gameSource, /state\.masteryBonus=Math\.max\(0,after\.count-before\.count\)\*2/);
  assert.match(progressionSource, /label:"90% KILL"/);
  assert.match(progressionSource, /label:"NO DAMAGE"/);
  assert.match(html, /id="stageGrid"/);
});

test("未クリアの自己ベストをクリア記録と誤表示しない", () => {
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(gameSource, /record\.clears\?`PERSONAL BEST/);
  assert.match(gameSource, /record\.score\?`PERSONAL BEST[\s\S]*NO CLEAR`/);
  assert.match(gameSource, /PERSONAL BEST \/\/ NO DATA/);
});

test("BOOSTとボス状態でテンポが変わるプロシージャルBGMをミュートできる", () => {
  const html = readFileSync(resolve(root, "dist/index.html"), "utf8");
  const gameSource = readFileSync(resolve(root, "dist/js/game.js"), "utf8");
  assert.match(html, /id="audioToggle"/);
  assert.match(gameSource, /music\(dt,boost,boss=false,enraged=false\)/);
  assert.match(gameSource, /overdrive=boost>=95/);
  assert.match(gameSource, /enraged\?\.085:overdrive\?\.105:boss\?\.145:\.19/);
  assert.match(gameSource, /localStorage\.setItem\("velocityBreakerSound"/);
  assert.match(gameSource, /key==="KeyM"/);
});
