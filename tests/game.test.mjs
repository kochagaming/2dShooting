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
  assert.match(gameSource, /next\.stageChanged\|\|state\.wave===2\|\|state\.wave===4/);
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
