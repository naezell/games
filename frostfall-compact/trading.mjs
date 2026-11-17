import { feature } from "./features.mjs";

export const TRADER = {
  logs: { price: 3, supply: 10 }, meat: { price: 4, supply: 8 },
  boards: { price: 11, supply: 6 }, steaks: { price: 12, supply: 5 },
  lumber: { price: 26, supply: 4, premium: true }, trays: { price: 34, supply: 3, premium: true },
};
const ROTATION = ["boards", "steaks", "lumber", "trays"];
const INTERVAL = 180;
const SPECIAL_LIMIT = 6;
export const SPECIAL_BONUS = 3;
export const createTrading = () => ({ elapsed: 0, bought: {}, specials: 0, hold: false });
export const tradingDay = s => Math.floor(s.trading.elapsed / INTERVAL);

export function advanceTrading(s, dt) {
  if (!feature(s, "supplyMerchant") && !feature(s, "marketSpecials")) return;
  const day = tradingDay(s);
  s.trading.elapsed += dt;
  if (tradingDay(s) === day) return;
  s.trading.bought = {};
  s.trading.specials = 0;
}
export function merchantStock(s, good) {
  if (!feature(s, "supplyMerchant") || !Object.hasOwn(TRADER, good)) return 0;
  return TRADER[good].supply - (s.trading.bought[good] ?? 0);
}
export function specialInfo(s) {
  if (!feature(s, "marketSpecials")) return null;
  const good = ROTATION[tradingDay(s) % ROTATION.length];
  return { good, left: SPECIAL_LIMIT - s.trading.specials };
}
export const hasSpotBonus = (s, good) => {
  const plan = specialInfo(s);
  return !!plan && plan.good === good && plan.left > 0;
};
export function spendSpotBonus(s, good) {
  if (!hasSpotBonus(s, good)) return 0;
  s.trading.specials++;
  return SPECIAL_BONUS;
}
export function tradingValid(stock) {
  return stock && Number.isFinite(stock.elapsed) && stock.elapsed >= 0 && stock.elapsed < Number.MAX_SAFE_INTEGER &&
    typeof stock.hold === "boolean" && Number.isInteger(stock.specials) && stock.specials >= 0 && stock.specials <= SPECIAL_LIMIT &&
    stock.bought && typeof stock.bought === "object" && !Array.isArray(stock.bought) &&
    Object.entries(stock.bought).every(([k, n]) => Object.hasOwn(TRADER, k) &&
      Number.isInteger(n) && n >= 0 && n <= TRADER[k].supply);
}
