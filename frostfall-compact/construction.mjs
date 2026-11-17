import { feature } from "./features.mjs";

export const BUILDINGS = {
  yard: { name: "Timber yard", area: "Forest edge", x: -4.8, z: -7.5, cash: 12, goods: { boards: 2 }, seconds: 4,
    effect: "Gather up to 9 logs before the forest rests. Restock in 6 seconds." },
  cold: { name: "Cold store", area: "Boar meadow", x: 4.7, z: -8.2, cash: 16, goods: { steaks: 2 }, seconds: 4,
    effect: "Gather up to 9 meat before the meadow rests. Restock in 6 seconds." },
  store: { name: "Camp storehouse", area: "Improvement pad", x: -5.5, z: 8.1, cash: 42, goods: { boards: 5 }, seconds: 7,
    effect: "Expand the camp crate from 16 to 32 goods." },
  mill: { name: "Sawmill extension", area: "Sawmill", x: -5.7, z: .1, cash: 65, goods: { boards: 6, lumber: 2 }, seconds: 9,
    after: "yard", effect: "Mill 20% faster and hold 4 extra finished goods." },
  kitchen: { name: "Cookhouse extension", area: "Grill", x: 5.9, z: .2, cash: 72, goods: { boards: 5, steaks: 3 }, seconds: 9,
    after: "cold", effect: "Cook 20% faster and hold 4 extra finished goods." },
  cart: { name: "Cart garage", area: "Improvement pad", x: -8.8, z: 4.25, cash: 88, goods: { boards: 6, lumber: 3 }, seconds: 10,
    after: "store", effect: "Add 3 slots to every handcart rack." },
  dispatch: { name: "Dispatch cabin", area: "Camp center", x: -2.7, z: 4.2, cash: 125, goods: { boards: 8, lumber: 4 }, seconds: 12,
    after: "cart", effect: "Open a third paid helper position." },
  exchange: { name: "Market exchange", area: "Market", x: 5.6, z: 5.6, cash: 175, goods: { boards: 10, lumber: 6, trays: 3 }, seconds: 15,
    after: "store", effect: "Spot sales pay +1 coin per board or steak and +3 per finished lumber or tray." },
};

export const newConstruction = () => Object.fromEntries(Object.keys(BUILDINGS).map(id => [id, { delivered: {}, left: null }]));
export const built = (s, id) => s.construction?.[id]?.left === 0;
export const buildingEnabled = (s, id) => feature(s, "construction") && feature(s, "build" + id[0].toUpperCase() + id.slice(1));
export const workingBuilding = (s, id, owned = false) => built(s, id) && (owned || buildingEnabled(s, id));
export const unlocked = (s, id) => Object.hasOwn(BUILDINGS, id) && (!BUILDINGS[id].after || built(s, BUILDINGS[id].after));
export function trackPlan(s, id) {
  if (id !== null && (!feature(s, "construction") || !Object.hasOwn(BUILDINGS, id) || built(s, id))) return false;
  s.plan = id;
  return true;
}

export function reservedForPlan(s, good) {
  if (!s.plan || !buildingEnabled(s, s.plan) || !unlocked(s, s.plan) || s.construction[s.plan].left !== null) return 0;
  return Math.max(0, (BUILDINGS[s.plan].goods[good] ?? 0) - (s.construction[s.plan].delivered[good] ?? 0) - s.stash[good]);
}

export const atPlot = (s, id) => Math.hypot(s.player.x - BUILDINGS[id].x, s.player.z - BUILDINGS[id].z) < 1.45;

export function plotInfo(s, id) {
  const plan = BUILDINGS[id];
  const site = s.construction[id];
  const needs = Object.fromEntries(Object.entries(plan.goods).map(([good, n]) => [good, n - (site.delivered[good] ?? 0)]));
  return { needs, funded: s.cash >= plan.cash, ready: Object.values(needs).every(n => !n) };
}

export function buildAtPlot(s, id, action) {
  if (!unlocked(s, id) || !buildingEnabled(s, id) || !atPlot(s, id) || s.construction[id].left !== null) return false;
  const site = s.construction[id];
  const plan = BUILDINGS[id];
  const info = plotInfo(s, id);
  if (action === "supply") {
    let moved = false;
    for (const [good, needed] of Object.entries(info.needs)) {
      const carried = Math.min(needed, s.player.bag[good]);
      const held = Math.min(needed - carried, s.stash[good]);
      if (!carried && !held) continue;
      s.player.bag[good] -= carried;
      s.stash[good] -= held;
      site.delivered[good] = (site.delivered[good] ?? 0) + carried + held;
      moved = true;
    }
    return moved;
  }
  if (action !== "build" || !info.ready || !info.funded) return false;
  s.cash -= plan.cash;
  site.left = plan.seconds;
  return true;
}

export function advanceConstruction(s, dt) {
  if (!feature(s, "construction")) return;
  for (const [id, site] of Object.entries(s.construction)) {
    if (site.left > 0 && buildingEnabled(s, id)) site.left = site.left <= dt + 1e-9 ? 0 : site.left - dt;
  }
}
export function constructionIsValid(s) {
  return !!s.construction && (s.plan === null || Object.hasOwn(BUILDINGS, s.plan)) && Object.entries(BUILDINGS).every(([id, plan]) => {
    const site = s.construction[id];
    if (!site || !site.delivered || typeof site.delivered !== "object" || Array.isArray(site.delivered) ||
        !Object.entries(site.delivered).every(([k, v]) => Object.hasOwn(plan.goods, k) && Number.isSafeInteger(v) && v >= 0 && v <= plan.goods[k])) return false;
    if (!unlocked(s, id) && (site.left !== null || Object.values(site.delivered).some(Boolean))) return false;
    return site.left === null || (Number.isFinite(site.left) && site.left >= 0 && site.left <= plan.seconds &&
      Object.entries(plan.goods).every(([k, v]) => site.delivered[k] === v));
  });
}
