export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const lerp = (a, b, t) => a + (b - a) * t;
export const distanceSq = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
export const circlesOverlap = (a, b) => distanceSq(a, b) <= (a.r + b.r) ** 2;

export function boostTier(boost) {
  if (boost >= 95) return { level: 5, label: "OVERDRIVE", speed: 1.24, fire: 1.38, dash: 1.2 };
  const level = Math.min(4, Math.floor(clamp(boost, 0, 94.99) / 20) + 1);
  return { level, label: `BOOST LV${level}`, speed: 1 + (level - 1) * 0.045, fire: 1 + (level - 1) * 0.07, dash: 1 + (level - 1) * 0.04 };
}

export function nearMissType(player, bullet, wasDashing = false) {
  const d2 = distanceSq(player, bullet);
  const hit = player.r + bullet.r;
  const near = player.r + bullet.r + 42;
  if (d2 <= hit * hit) return "hit";
  if (d2 <= near * near && !bullet.grazed) return wasDashing ? "dash" : "near";
  return "none";
}

export function normalize(x, y, fallbackX = 0, fallbackY = -1) {
  const length = Math.hypot(x, y);
  return length > 0.001 ? { x: x / length, y: y / length } : { x: fallbackX, y: fallbackY };
}
