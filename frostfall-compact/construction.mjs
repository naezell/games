import { feature } from "./features.mjs";

const phase = (cash, goods, seconds, effect) => ({ cash, goods, seconds, effect });
export const BUILDINGS = {
  yard: { name: "Timber yard", area: "Forest edge", x: -4.8, z: -7.5, levels: [
    phase(12, { boards: 2 }, 4, "Hold 9 logs at the forest edge and refill in 6 seconds."),
    phase(68, { boards: 7, lumber: 2 }, 8, "Hold 12 logs at the forest edge and refill in 5 seconds."),
    phase(180, { boards: 12, lumber: 5 }, 12, "Hold 15 logs at the forest edge and refill in 4 seconds."),
  ] },
  cold: { name: "Cold store", area: "Boar meadow", x: 4.7, z: -8.2, levels: [
    phase(16, { steaks: 2 }, 4, "Hold 9 meat at the meadow and refill in 6 seconds."),
    phase(74, { boards: 6, steaks: 6 }, 8, "Hold 12 meat at the meadow and refill in 5 seconds."),
    phase(194, { boards: 10, steaks: 8, trays: 3 }, 12, "Hold 15 meat at the meadow and refill in 4 seconds."),
  ] },
  store: { name: "Camp storehouse", area: "Improvement pad", x: -5.5, z: 8.1, levels: [
    phase(42, { boards: 5 }, 7, "Expand the camp crate from 16 to 32 goods."),
    phase(92, { boards: 8, lumber: 3 }, 10, "Expand the camp crate to 48 goods."),
    phase(220, { boards: 14, lumber: 5 }, 14, "Expand the camp crate to 64 goods."),
  ] },
  mill: { name: "Sawmill extension", area: "Sawmill", x: -5.7, z: .1, after: "yard", levels: [
    phase(65, { boards: 6, lumber: 2 }, 9, "Mill 20% faster and hold 4 extra finished goods."),
    phase(142, { boards: 10, lumber: 4 }, 12, "Cut milling time by 35% and hold 7 extra finished goods."),
    phase(310, { boards: 16, lumber: 8 }, 18, "Halve milling time and hold 10 extra finished goods."),
  ] },
  kitchen: { name: "Cookhouse extension", area: "Grill", x: 5.9, z: .2, after: "cold", levels: [
    phase(72, { boards: 5, steaks: 3 }, 9, "Cook 20% faster and hold 4 extra finished goods."),
    phase(151, { boards: 8, steaks: 7, trays: 2 }, 12, "Cut cook time by 35% and hold 7 extra finished goods."),
    phase(320, { lumber: 4, steaks: 12, trays: 5 }, 18, "Halve cook time and hold 10 extra finished goods."),
  ] },
  cart: { name: "Cart garage", area: "Improvement pad", x: -8.8, z: 4.25, after: "store", levels: [
    phase(88, { boards: 6, lumber: 3 }, 10, "Add 3 slots to every handcart rack."),
    phase(175, { boards: 9, lumber: 5 }, 14, "Add 5 slots to every handcart rack."),
    phase(370, { boards: 12, lumber: 9 }, 18, "Add 7 slots to every handcart rack."),
  ] },
  dispatch: { name: "Dispatch cabin", area: "Camp center", x: -2.7, z: 4.2, after: "cart", levels: [
    phase(125, { boards: 8, lumber: 4 }, 12, "Open a third paid helper position."),
    phase(245, { boards: 12, lumber: 5, trays: 2 }, 16, "Helpers walk 30% faster."),
    phase(460, { boards: 16, lumber: 8, trays: 4 }, 22, "Raise each helper’s carrying capacity from 3 to 5."),
  ] },
  exchange: { name: "Market exchange", area: "Market", x: 5.6, z: 5.6, after: "store", levels: [
    phase(175, { boards: 10, lumber: 6, trays: 3 }, 15, "Spot sales earn 1 extra coin per basic good or 3 per premium good."),
    phase(310, { boards: 13, lumber: 8, trays: 5 }, 19, "Spot sales earn 2 extra coins per basic good or 5 per premium good."),
    phase(575, { boards: 18, lumber: 12, trays: 7 }, 24, "Spot sales earn 3 extra coins per basic good or 8 per premium good."),
  ] },
};

const newPhase = () => ({ delivered: {}, left: null });
export const newConstruction = () => Object.fromEntries(Object.keys(BUILDINGS).map(id => [id, {
  ...newPhase(), upgrades: [newPhase(), newPhase()],
}]));
export const built = (s, id) => s.construction?.[id]?.left === 0;
export const buildingEnabled = (s, id) => feature(s, "construction") && feature(s, "build" + id[0].toUpperCase() + id.slice(1));
export const sitePhase = (s, id, level) => level === 1 ? s.construction[id] : s.construction[id].upgrades[level - 2];
export function buildingLevel(s, id, owned = false) {
  if (!built(s, id) || (!owned && !buildingEnabled(s, id))) return 0;
  if (!owned && !feature(s, "buildingLevels")) return 1;
  const [second, third] = s.construction[id].upgrades;
  return third.left === 0 ? 3 : second.left === 0 ? 2 : 1;
}
export const nextLevel = (s, id) => {
  const level = buildingLevel(s, id, true);
  return level < (feature(s, "buildingLevels") ? 3 : 1) ? level + 1 : null;
};
const baseUnlocked = (s, id) => !BUILDINGS[id].after || built(s, BUILDINGS[id].after);
export const unlocked = (s, id, level = 1) => Object.hasOwn(BUILDINGS, id) &&
  (level === 1 ? baseUnlocked(s, id) : sitePhase(s, id, level - 1).left === 0);
export const phaseEnabled = (s, id, level) => buildingEnabled(s, id) && (level === 1 || feature(s, "buildingLevels"));
export function trackPlan(s, id) {
  if (id === null) {
    s.plan = null;
    s.planLevel = null;
    return true;
  }
  if (!feature(s, "construction") || !Object.hasOwn(BUILDINGS, id)) return false;
  const level = nextLevel(s, id);
  if (!level) return false;
  s.plan = id;
  s.planLevel = level;
  return true;
}
export function reservedForPlan(s, good) {
  const { plan: id, planLevel: level } = s;
  if (!id || !phaseEnabled(s, id, level) || !unlocked(s, id, level)) return 0;
  const site = sitePhase(s, id, level);
  if (site.left !== null) return 0;
  return Math.max(0, (BUILDINGS[id].levels[level - 1].goods[good] ?? 0) - (site.delivered[good] ?? 0) - s.stash[good]);
}

export const atPlot = (s, id) => Math.hypot(s.player.x - BUILDINGS[id].x, s.player.z - BUILDINGS[id].z) < 1.45;
export function plotInfo(s, id, level = 1) {
  const plan = BUILDINGS[id].levels[level - 1];
  const site = sitePhase(s, id, level);
  const needs = Object.fromEntries(Object.entries(plan.goods).map(([good, n]) => [good, n - (site.delivered[good] ?? 0)]));
  return { needs, funded: s.cash >= plan.cash, ready: Object.values(needs).every(n => !n) };
}

export function buildAtPlot(s, id, action, level = 1) {
  if (![1, 2, 3].includes(level) || !unlocked(s, id, level) || !phaseEnabled(s, id, level) || !atPlot(s, id)) return false;
  const site = sitePhase(s, id, level);
  if (site.left !== null) return false;
  const plan = BUILDINGS[id].levels[level - 1];
  const info = plotInfo(s, id, level);
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
  for (const [id, base] of Object.entries(s.construction)) {
    if (!buildingEnabled(s, id)) continue;
    const levels = feature(s, "buildingLevels") ? [base, ...base.upgrades] : [base];
    for (const site of levels) if (site.left > 0) site.left = site.left <= dt + 1e-9 ? 0 : site.left - dt;
  }
}
export function migrateConstructionLevels(s) {
  if (!s.construction) return false;
  for (const id of Object.keys(BUILDINGS)) {
    if (!s.construction[id]) return false;
    s.construction[id].upgrades = [newPhase(), newPhase()];
  }
  s.planLevel = s.plan ? 1 : null;
  return true;
}
export function constructionIsValid(s) {
  if (!s.construction || !(s.plan === null ? s.planLevel === null :
    Object.hasOwn(BUILDINGS, s.plan) && [1, 2, 3].includes(s.planLevel))) return false;
  for (const [id, plan] of Object.entries(BUILDINGS)) {
    const base = s.construction[id];
    if (!base || !Array.isArray(base.upgrades) || base.upgrades.length !== 2) return false;
    let allowed = baseUnlocked(s, id);
    for (const [index, site] of [base, ...base.upgrades].entries()) {
      const { goods, seconds } = plan.levels[index];
      if (!site || !site.delivered || typeof site.delivered !== "object" || Array.isArray(site.delivered) ||
          !Object.entries(site.delivered).every(([k, v]) => Object.hasOwn(goods, k) && Number.isSafeInteger(v) && v >= 0 && v <= goods[k])) return false;
      if (!allowed && (site.left !== null || Object.values(site.delivered).some(Boolean))) return false;
      if (site.left !== null && !(Number.isFinite(site.left) && site.left >= 0 && site.left <= seconds &&
          Object.entries(goods).every(([k, v]) => site.delivered[k] === v))) return false;
      allowed = site.left === 0;
    }
  }
  return true;
}
