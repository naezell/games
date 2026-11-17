export const FEATURES = {
  Work: {
    autoGather: ["Automatic gathering", "Gather by standing nearby. When off, use Gather at the source."],
    autoHandling: ["Automatic station handling", "Load or collect by standing at a station. Manual buttons always work."],
    autoSell: ["Automatic spot sales", "Sell surplus at the Market. The manual sale button always works."],
    premium: ["Premium recipes", "Produce finished lumber and steak trays. Existing goods remain usable."],
    demandRecipes: ["Demand-based recipes", "Let stations make whichever goods a pinned plan or current order still needs."],
    stockTargets: ["Stock targets", "Make basics first and keep spare stock at the counter."],
    sorting: ["Timber sorting", "Sort logs for faster finishing. Existing selected logs can still be recovered."],
    fuel: ["Offcut fuel", "Collect sawmill offcuts and use them to cook double trays."],
    staging: ["Material staging", "Set aside a batch at the station. Existing staged materials remain retrievable."],
  },
  Camp: {
    upgrades: ["Shop upgrades", "Buy larger backpacks, faster machines, and larger station buffers."],
    gangSaw: ["Gang saw", "Use the sawmill attachment that cuts three boards from two logs."],
    finishingJig: ["Finishing jig", "Use the attachment that speeds up finished lumber."],
    grillPress: ["Grill press", "Use the attachment that cooks two steaks in one cycle."],
    warmingRack: ["Warming rack", "Use the attachment that speeds up steak trays."],
    equipment: ["Station equipment", "Use a second machine, loading rack, or packing bench."],
    stationProjects: ["Station projects", "Use drop-off bins and specialized workshop rebuilds."],
    construction: ["Camp construction", "Build permanent structures. Pauses unfinished work."],
    helpers: ["Helpers", "Keep hired helpers working around camp."],
    projectHelpers: ["Construction helpers", "Assign hired helpers to deliver finished goods to your pinned plot."],
    routes: ["Custom helper routes", "Set supply routes, pickup priorities, and order packing."],
    cart: ["Handcart", "Use the handcart and its extra carrying slots."],
    cartRacks: ["Specialized cart racks", "Use the timber or food rack. When off, use the mixed bed."],
  },
  Buildings: {
    buildingLevels: ["Building upgrades", "Use and expand the second and third levels of each structure."],
    buildYard: ["Timber yard", "Use the larger timber source and faster forest restock."],
    buildCold: ["Cold store", "Use the larger meat source and faster meadow restock."],
    buildStore: ["Camp storehouse", "Use the extra camp crate space."],
    buildMill: ["Sawmill extension", "Use its speed and finished-goods capacity."],
    buildKitchen: ["Cookhouse extension", "Use its speed and finished-goods capacity."],
    buildCart: ["Cart garage", "Use its additional cart capacity."],
    buildDispatch: ["Dispatch cabin", "Let the third helper work."],
    buildExchange: ["Market exchange", "Collect its bonus on spot sales."],
  },
  Market: {
    supplyMerchant: ["Supply merchant", "Buy limited shipments of raw materials or finished goods at the Market."],
    marketSpecials: ["Featured market goods", "Earn a limited rotating bonus on spot sales."],
    quickJobs: ["Odd jobs", "Take small untimed orders at the Market. Switching off saves the order and packed goods."],
    contracts: ["Market contracts", "Take multi-stage jobs and ship installments."],
    bulk: ["Quick bulk order", "Take or deliver the original board-and-steak order."],
    accounts: ["Standing accounts", "Trade with the carpenter and inn. Their pickup clock pauses when off."],
    loadingBay: ["Loading bay", "Build and use the Market’s larger shipments."],
  },
  Display: {
    campBoard: ["Camp board", "See inventory, bottlenecks, and missing goods for plans and orders in one view."],
    markers: ["Station markers", "Show tappable labels and status at stations. Build plans can still guide you."],
    jobHud: ["Order reminder", "Show the current contract above the map."],
    animation: ["Work animations", "Show tool swings, carrying motions, and other character animations."],
    battery: ["Battery saver", "Lower rendering resolution and frame rate."],
  },
};
const names = Object.values(FEATURES).flatMap(Object.keys);
const defaultSetting = id => id !== "battery" && id !== "marketSpecials";
export const feature = (s, id) => s.features?.[id] ?? defaultSetting(id);
export const featureDefaults = () => Object.fromEntries(names.map(id => [id, defaultSetting(id)]));
export const featuresValid = value => !!value && Object.keys(value).length === names.length &&
  names.every(id => typeof value[id] === "boolean");
export function setFeature(s, id, enabled) {
  if (!names.includes(id) || typeof enabled !== "boolean") return false;
  s.features[id] = enabled;
  if (id === "autoSell") s.market.autoSale = enabled;
  return true;
}
export function featurePreset(s, preset) {
  if (!["all", "simple"].includes(preset)) return false;
  const simple = ["autoGather", "autoHandling", "autoSell", "markers"];
  for (const id of names) setFeature(s, id, preset === "all" ? id !== "battery" : simple.includes(id) || id === "battery");
  return true;
}
