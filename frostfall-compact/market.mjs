const stage = (reward, goods) => ({ goods, reward });
export const CONTRACTS = {
  builder: { name: "Builder’s pickup", stages: [stage(56, { boards: 12 }), stage(88, { lumber: 6 })] },
  supper: { name: "Camp supper", stages: [stage(48, { steaks: 8 }), stage(96, { trays: 4 })] },
  outfitter: { name: "Outfitter’s restock", stages: [
    stage(66, { boards: 8, steaks: 6 }), stage(108, { lumber: 4, trays: 2 }), stage(140, { lumber: 4, trays: 4 }),
  ] },
  lodge: { name: "Lodge expansion", stages: [
    stage(128, { boards: 24 }), stage(166, { lumber: 11 }), stage(110, { boards: 10, lumber: 4 }),
  ] },
  festival: { name: "Winter feast", stages: [
    stage(144, { steaks: 22 }), stage(210, { trays: 8 }), stage(126, { steaks: 8, trays: 3 }),
  ] },
  caravan: { name: "Caravan supply", stages: [
    stage(156, { boards: 18, steaks: 12 }), stage(236, { lumber: 8, trays: 5 }), stage(306, { lumber: 10, trays: 7 }),
  ] },
};
export const ACCOUNT_DAYS = 2;
export const DAY_SECONDS = 180;
export const ACCOUNTS = {
  carpenter: { name: "Village carpenter", goods: { boards: 6, lumber: 2 }, reward: 61 },
  inn: { name: "Roadside inn", goods: { steaks: 4, trays: 2 }, reward: 77 },
};
export const BAY = { cash: 215, lumber: 6 };

export function createMarket() {
  return { elapsed: 0, bay: false, completed: 0, shipments: 0, recurring: 0,
    stock: { boards: 0, steaks: 0 }, active: null, accounts: { carpenter: null, inn: null }, autoSale: true, nextOffer: 0, notice: null };
}

const smallOffers = ["builder", "supper", "outfitter"];
const largeOffers = ["lodge", "festival", "caravan"];
export const marketDay = s => 1 + Math.floor(s.market.elapsed / DAY_SECONDS);
export const accountUnlocked = s => s.market.completed > 0;
export function marketOffers(s) {
  if (!s.market.bay) return smallOffers;
  const offset = s.market.nextOffer % smallOffers.length;
  return [smallOffers[offset], largeOffers[offset], largeOffers[(offset + 1) % largeOffers.length]];
}

const currentStage = active => CONTRACTS[active.id].stages[active.part];
export function marketTargets(s) {
  const { active, accounts } = s.market;
  const targets = active ? [{
    id: "contract", name: CONTRACTS[active.id].name, packed: active.packed,
    ...currentStage(active), ready: true, part: active.part, total: CONTRACTS[active.id].stages.length,
  }] : [];
  for (const [id, account] of Object.entries(accounts)) {
    if (account) targets.push({ ...ACCOUNTS[id], id, packed: account.packed,
      ready: marketDay(s) >= account.due, due: account.due });
  }
  return targets;
}

export const neededFor = (target, good) => Math.max(0, (target.goods[good] ?? 0) - (target.packed[good] ?? 0));
export const marketNeed = (s, good) => marketTargets(s).reduce((n, t) => n + neededFor(t, good), 0);
export const canPack = (bag, target) => Object.keys(target.goods).some(k => bag[k] > 0 && neededFor(target, k) > 0);
export const marketAdvance = (s, dt) => { s.market.elapsed += dt; };

function paid(s, target) {
  s.cash += target.reward;
  s.sold += Object.values(target.goods).reduce((n, qty) => n + qty, 0);
  s.market.notice = { id: target.id === "contract" ? s.market.active.id : target.id, reward: target.reward, sale: false };
}
function shipIfReady(s, target) {
  if (!target.ready || Object.keys(target.goods).some(k => neededFor(target, k))) return;
  paid(s, target);
  const m = s.market;
  if (target.id === "contract") {
    if (++m.active.part === target.total) {
      if (largeOffers.includes(m.active.id)) m.shipments++;
      m.active = null;
      m.completed++;
      m.nextOffer++;
    } else m.active.packed = {};
  } else {
    m.recurring++;
    m.accounts[target.id] = { due: marketDay(s) + ACCOUNT_DAYS, packed: {} };
  }
}

export function shipAccounts(s) {
  // Only inspect accounts at a day boundary. Packing handles shipments already due.
  for (const t of marketTargets(s)) if (t.id !== "contract") shipIfReady(s, t);
}

export function packGoods(s, id, bag) {
  const target = marketTargets(s).find(t => t.id === id);
  if (!target || !canPack(bag, target)) return null;
  let lastGood = null;
  for (const k of Object.keys(target.goods)) {
    const n = Math.min(bag[k] ?? 0, neededFor(target, k));
    if (!n) continue;
    bag[k] -= n;
    target.packed[k] = (target.packed[k] ?? 0) + n;
    lastGood = k;
  }
  shipIfReady(s, target);
  return lastGood;
}

export function contractAction(s, id) {
  if (s.order || s.market.active || !marketOffers(s).includes(id)) return false;
  s.market.active = { id, part: 0, packed: {} };
  return true;
}

export function accountAction(s, id) {
  if (!accountUnlocked(s) || !Object.hasOwn(ACCOUNTS, id) || s.market.accounts[id]) return false;
  s.market.accounts[id] = { due: marketDay(s) + ACCOUNT_DAYS, packed: {} };
  return true;
}

export function closeMarketJob(s, id, prices) {
  const target = marketTargets(s).find(t => t.id === id);
  if (!target) return false;
  let proceeds = 0;
  for (const [good, quantity] of Object.entries(target.packed)) {
    proceeds += prices[good] * quantity;
    s.sold += quantity;
  }
  s.cash += proceeds;
  const m = s.market;
  m.notice = { id: id === "contract" ? m.active.id : id, reward: proceeds, sale: true };
  if (id === "contract") m.active = null;
  else m.accounts[id] = null;
  return true;
}

export function marketIsValid(m) {
  const uint = (n, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(n) && n >= 0 && n <= max;
  const validPack = (packed, goods) => packed && !Array.isArray(packed) &&
    typeof packed === "object" && Object.entries(packed).every(([k, n]) => Object.hasOwn(goods, k) && uint(n, goods[k]));
  if (!m || !Number.isFinite(m.elapsed) || m.elapsed < 0 || m.elapsed > Number.MAX_SAFE_INTEGER ||
      typeof m.bay !== "boolean" || typeof m.autoSale !== "boolean" || !uint(m.completed) ||
      !uint(m.stock?.boards, 16) || !uint(m.stock?.steaks, 16) || !uint(m.shipments, m.completed) || !uint(m.recurring) || !uint(m.nextOffer) || !m.accounts) return false;
  if (m.active !== null && (!m.active || !Object.hasOwn(CONTRACTS, m.active.id) ||
      !uint(m.active.part, CONTRACTS[m.active.id].stages.length - 1) ||
      !validPack(m.active.packed, currentStage(m.active).goods) ||
      (largeOffers.includes(m.active.id) && !m.bay))) return false;
  if (m.notice !== null && (!m.notice || !(Object.hasOwn(CONTRACTS, m.notice.id) || Object.hasOwn(ACCOUNTS, m.notice.id)) ||
      !uint(m.notice.reward) || typeof m.notice.sale !== "boolean")) return false;
  return Object.keys(m.accounts).length === Object.keys(ACCOUNTS).length &&
    Object.entries(ACCOUNTS).every(([id, info]) =>
      m.accounts[id] === null || (m.accounts[id] && uint(m.accounts[id].due) && validPack(m.accounts[id].packed, info.goods)));
}
