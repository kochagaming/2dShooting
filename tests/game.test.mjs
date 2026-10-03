import test from "node:test";
import assert from "node:assert/strict";
import { boostTier, circlesOverlap, nearMissType, normalize } from "../dist/js/math.js";

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
