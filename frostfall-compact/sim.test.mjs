import { feature, setFeature, featurePreset } from "./features.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import {
  createState,
  tick,
  interact,
  SPOTS,
  count,
  capacity,
  storage,
  purchase,
  assign,
  stashAll,
  retrieve,
  returnRaw,
  serialize,
  deserialize,
  selectRecipe,
  stationStatus,
  inputCapacity,
  outputCapacity,
  install,
  acceptBulk,
  deliverBulk,
  cancelBulk,
  activity,
  BULK,
  buildProject, marketAction, handleLoad, setStation, setWorkerRoute, sortTimber,
  cartRack, cartLoad, inputCount, stageCapacity, roomFor, onHand, gatherNow, stashCapacity, helperLimit, spotPrice, sourceCapacity, recipeSeconds,
} from "./sim.mjs";
import { marketTargets, marketOffers, DAY_SECONDS, CONTRACTS } from "./market.mjs";
import { BUILDINGS, built, trackPlan, buildAtPlot, plotInfo } from "./construction.mjs";
const at = (p, k) => Object.assign(p, { x: SPOTS[k].x, z: SPOTS[k].z });
const advance = (s, seconds) => {
  for (let i = 0; i < seconds * 10; i++) tick(s, 0.1);
};
test("manual loops gather, process and sell both products", () => {
  let s = createState();
  for (const [source, input, output, raw, finished] of [
    ["forest", "sawIn", "sawOut", "logs", "boards"],
    ["boars", "grillIn", "grillOut", "meat", "steaks"],
  ]) {
    at(s.player, source);
    advance(s, 3.2);
    assert.ok(s.player.bag[raw] > 0);
    at(s.player, input);
    tick(s);
    assert.equal(s.player.bag[raw], 0);
    advance(s, 13);
    at(s.player, output);
    tick(s);
    assert.ok(s.player.bag[finished] > 0);
    at(s.player, "sell");
    advance(s, 3);
    assert.equal(s.player.bag[finished], 0);
  }
  assert.ok(s.cash > 0);
  assert.ok(s.sold >= 4);
});
test("buffers and bag stay bounded and progress waits for output space", () => {
  let s = createState();
  let st = s.stations.saw;
  st.input = storage(s);
  st.output = storage(s);
  advance(s, 10);
  assert.equal(st.input, 5);
  assert.equal(st.output, 5);
  at(s.player, "sawOut");
  tick(s);
  assert.equal(count(s.player.bag), 5);
  at(s.player, "build");
  advance(s, 5);
  assert.ok(st.output > 0);
  assert.ok(count(s.player.bag) <= capacity(s));
});
test("upgrades cost money, cap at three and raise capacities", () => {
  let s = createState();
  assert.equal(purchase(s, "pack"), false);
  s.cash = 1000;
  for (let i = 0; i < 3; i++) assert.equal(purchase(s, "pack"), true);
  assert.equal(purchase(s, "pack"), false);
  assert.equal(capacity(s), 16);
  for (let i = 0; i < 3; i++) assert.equal(purchase(s, "storage"), true);
  assert.equal(storage(s), 18);
});
test("helpers batch raw goods, deliver and preserve load on reassignment", () => {
  let s = createState();
  s.cash = 500;
  purchase(s, "helper");
  let w = s.workers[0];
  at(w, "forest");
  advance(s, 3.3);
  assert.equal(w.bag.logs, 3);
  assign(s, 0, "meat");
  advance(s, 5);
  assert.equal(w.bag.logs, 0);
  assert.ok(s.stations.saw.input + s.stations.saw.output > 0);
  advance(s, 12);
  assert.ok(s.stations.grill.input + s.stations.grill.output + w.bag.meat > 0);
});
test("lumber helper does not haul finished boards when input is full", () => {
  let s = createState();
  s.cash = 50;
  purchase(s, "helper");
  s.stations.saw.input = 5;
  s.stations.saw.output = 5;
  at(s.workers[0], "sawIn");
  advance(s, 10);
  assert.equal(s.workers[0].bag.boards, 0);
  assert.equal(s.stations.saw.output, 5);
});
test("full bag recovery crate is bounded and raw goods can be returned", () => {
  let s = createState();
  s.player.bag.logs = 6;
  stashAll(s);
  assert.equal(s.stash.logs, 6);
  retrieve(s, "logs");
  assert.equal(s.player.bag.logs, 6);
  at(s.player, "forest");
  returnRaw(s, "logs");
  assert.equal(count(s.player.bag), 0);
  s.stash.boards = 16;
  s.player.bag.logs = 6;
  stashAll(s);
  assert.equal(count(s.stash), 16);
  assert.equal(s.player.bag.logs, 6);
});
test("sources regenerate and saved partial state round trips with validation", () => {
  let s = createState();
  at(s.player, "forest");
  advance(s, 6.5);
  assert.equal(s.sources.forest.remaining, 0);
  s.stations.saw.input = 2;
  tick(s);
  s.cash = 50;
  purchase(s, "helper");
  assign(s, 0, "haul");
  let restored = deserialize(serialize(s));
  assert.deepEqual(restored, s);
  advance(restored, 9);
  assert.ok(restored.sources.forest.remaining > 0);
  let bad = JSON.parse(serialize(s));
  bad.stations.saw.input = 999;
  assert.equal(deserialize(JSON.stringify(bad)), null);
  assert.equal(deserialize("{"), null);
});

test("recipes preserve work already underway and pay the premium price", () => {
  const s = createState();
  at(s.player, "sawIn");
  s.player.bag.logs = 3;
  tick(s);
  assert.equal(activity(s.player).kind, "load");
  tick(s);
  assert.equal(stationStatus(s, "saw"), "Processing");
  assert.ok(selectRecipe(s, "saw", "lumber"));
  advance(s, 4);
  assert.equal(s.stations.saw.output, 1);
  assert.equal(s.stations.saw.jobs[0].good, "lumber");
  advance(s, 11);
  at(s.player, "sawOut");
  tick(s);
  assert.equal(activity(s.player).kind, "stack");
  assert.equal(s.player.bag.lumber, 1);
  at(s.player, "grillIn");
  assert.ok(selectRecipe(s, "grill", "trays"));
  s.player.bag.meat = 3;
  advance(s, 14.5);
  at(s.player, "grillOut");
  tick(s);
  at(s.player, "sell");
  advance(s, 2);
  assert.equal(s.cash, 36);
});

test("the two station slots enforce equipment limits and reserve parallel output", () => {
  const s = createState();
  s.cash = 250;
  assert.equal(install(s, "saw", "machine"), false);
  at(s.player, "sawIn");
  assert.ok(install(s, "saw", "machine"));
  assert.equal(install(s, "saw", "rack"), false);
  s.stations.saw.input = 5;
  s.stations.saw.output = 4;
  tick(s);
  assert.equal(s.stations.saw.jobs.length, 1);
  advance(s, 4);
  assert.equal(stationStatus(s, "saw"), "Output full");
  at(s.player, "sawOut");
  advance(s, .3);
  assert.equal(s.stations.saw.jobs.length, 2);
  at(s.player, "grillIn");
  assert.ok(install(s, "grill", "rack"));
  assert.equal(inputCapacity(s, "grill"), 9);
  assert.equal(outputCapacity(s, "grill"), 5);
  const other = createState();
  other.cash = 45;
  at(other.player, "grillOut");
  assert.ok(install(other, "grill", "bench"));
  assert.equal(outputCapacity(other, "grill"), 9);
  assert.equal(inputCapacity(other, "grill"), 5);
});

test("cart extends the player's capacity and untimed orders survive reloads", () => {
  let s = createState();
  s.cash = 55;
  assert.ok(purchase(s, "cart"));
  assert.equal(purchase(s, "cart"), false);
  assert.equal(capacity(s), 11);
  assert.equal(acceptBulk(s), true);
  s.player.bag.boards = 8;
  s.player.bag.steaks = 3;
  advance(s, 5);
  assert.equal(s.cash, 0);
  assert.ok(deliverBulk(s));
  assert.equal(s.order.boards, 8);
  s = deserialize(serialize(s));
  at(s.player, "build");
  advance(s, 800);
  assert.equal(s.order.steaks, 3);
  s.player.bag.steaks = 6;
  at(s.player, "sell");
  advance(s, 2);
  assert.equal(s.cash, 5);
  assert.ok(deliverBulk(s));
  assert.equal(s.order, null);
  assert.equal(s.cash, 5 + BULK.reward);
  assert.equal(deliverBulk(s), false);
  assert.ok(acceptBulk(s));
  s.player.bag.boards = 2;
  assert.ok(deliverBulk(s));
  assert.ok(cancelBulk(s));
  assert.equal(s.cash, 5 + BULK.reward + 8);
});

test("a split helper supplies both lines and a clearing helper restarts a blocked line", () => {
  const s = createState();
  s.cash = 150;
  purchase(s, "helper");
  assign(s, 0, "split");
  advance(s, 30);
  assert.ok(s.stations.saw.output);
  assert.ok(s.stations.grill.output);
  assert.ok(purchase(s, "helper"));
  assign(s, 1, "clear");
  s.stations.saw.output = 5 - s.stations.saw.jobs.length;
  at(s.workers[1], "sawOut");
  advance(s, 1);
  assert.ok(s.workers[1].bag.boards);
  advance(s, 10);
  assert.ok(s.sold > 0);
});

test("a published v1 save carries over inventory, workers and partially processed goods", () => {
  const old = createState();
  old.version = 1;
  old.cash = 111;
  old.player.bag.boards = 2;
  purchase(old, "helper");
  old.stations.saw = { input: 2, output: 1, progress: 2.1 };
  old.stations.grill = { input: 0, output: 0, progress: 0 };
  for (const bag of [old.player.bag, old.stash, old.workers[0].bag]) {
    delete bag.trays;
    delete bag.lumber;
  }
  delete old.workers[0].nextLine;
  delete old.cart;
  delete old.order;
  const s = deserialize(serialize(old));
  assert.equal(s.version, 5);
  assert.equal(s.cash, old.cash);
  assert.equal(s.workers[0].job, "lumber");
  assert.equal(s.player.bag.boards, 2);
  assert.equal(s.stations.saw.input, 1);
  assert.equal(s.stations.saw.output, 1);
  advance(s, 2);
  assert.equal(s.stations.saw.output, 2);
  s.stations.saw.premium = 999;
  assert.equal(deserialize(serialize(s)), null);
});

test("jobs pay per installment and accounts ship again after their next pickup", () => {
  let s = createState();
  at(s.player, "sell");
  assert.deepEqual(marketOffers(s), ["builder", "supper", "outfitter"]);
  assert.equal(marketAction(s, "account", "carpenter"), false);
  assert.equal(marketAction(s, "accept", "caravan"), false);
  assert.ok(marketAction(s, "accept", "builder"));
  for (let i = 0; i < 2; i++) {
    s.player.bag.boards = 6;
    assert.ok(marketAction(s, "pack", "contract"));
    assert.equal(s.player.bag.boards, 0);
  }
  assert.equal(s.cash, 56);
  assert.equal(marketTargets(s)[0].part, 1);
  s.player.bag.lumber = 6;
  tick(s);
  assert.equal(s.player.bag.lumber, 6);
  assert.ok(marketAction(s, "pack", "contract"));
  assert.equal(s.market.completed, 1);
  assert.equal(s.cash, 144);
  assert.ok(marketAction(s, "account", "carpenter"));
  s.stations.saw.target = 8; // Reserve held at the counter comes from earlier sales.
  s.market.stock.boards = 6;
  s.player.bag.lumber = 2;
  assert.ok(marketAction(s, "pack", "carpenter"));
  assert.equal(s.market.stock.boards, 0);
  assert.equal(s.cash, 144);
  s = deserialize(serialize(s));
  tick(s, DAY_SECONDS * 2);
  assert.equal(s.market.recurring, 1);
  assert.equal(s.cash, 205);
  s.player.bag.boards = 6;
  marketAction(s, "pack", "carpenter");
  s.player.bag.lumber = 2;
  marketAction(s, "pack", "carpenter");
  tick(s, DAY_SECONDS * 2);
  assert.equal(s.market.recurring, 2);
});

test("loading bay opens large jobs and closing a partially packed job pays spot prices", () => {
  const s = createState();
  at(s.player, "sell");
  s.cash = 250;
  s.stash.lumber = 4;
  s.player.bag.lumber = 2;
  assert.ok(buildProject(s, "bay"));
  assert.equal(s.cash, 35);
  assert.equal(s.stash.lumber, 0);
  assert.equal(s.player.bag.lumber, 0);
  assert.ok(marketOffers(s).includes("lodge"));
  assert.ok(marketAction(s, "accept", "lodge"));
  s.player.bag.boards = 4;
  assert.ok(marketAction(s, "pack", "contract"));
  assert.ok(marketAction(s, "close", "contract"));
  assert.equal(s.cash, 51);
  assert.equal(s.market.completed, 0);
  assert.ok(marketAction(s, "accept", "lodge"));
  for (const { goods, reward } of CONTRACTS.lodge.stages) {
    const before = s.cash;
    for (const [good, units] of Object.entries(goods)) {
      for (let left = units; left > 0; left -= 6) {
        s.player.bag[good] = Math.min(6, left);
        assert.ok(marketAction(s, "pack", "contract"));
      }
    }
    assert.equal(s.cash, before + reward);
  }
  assert.equal(s.market.shipments, 1);
  assert.ok(marketOffers(s).includes("caravan"));
});

test("timber grading preserves mass and offcuts fuel double batches without overflowing output", () => {
  const s = createState();
  at(s.player, "sawIn");
  s.stations.saw.input = 4;
  assert.ok(sortTimber(s, 2));
  assert.equal(inputCount(s, "saw"), 4);
  assert.ok(selectRecipe(s, "saw", "lumber"));
  tick(s);
  assert.equal(s.stations.saw.jobs[0].left, 6.6);
  assert.equal(inputCount(s, "saw"), 2);
  assert.equal(s.timberSorted, 0);
  advance(s, 6.6);
  assert.equal(s.fuel, 1);
  assert.equal(s.stations.saw.premium, 1);
  at(s.player, "grillIn");
  assert.ok(setStation(s, "grill", "doubles", true));
  assert.ok(selectRecipe(s, "grill", "trays"));
  s.stations.grill.input = 3;
  tick(s);
  assert.equal(s.stations.grill.jobs.length, 0);
  s.stations.grill.input += 2;
  tick(s);
  assert.equal(s.stations.grill.jobs[0].units, 2);
  assert.equal(s.fuel, 0);
  assert.ok(deserialize(serialize(s)));
  advance(s, 17.5);
  assert.equal(s.stations.grill.premium, 2);
});

test("manual staging, a drop-off bin and an easy-loading rebuild all move real inventory", () => {
  const s = createState();
  at(s.player, "sawIn");
  assert.ok(setStation(s, "saw", "manual", true));
  s.player.bag.logs = 6;
  tick(s);
  assert.equal(s.player.bag.logs, 6);
  assert.ok(handleLoad(s, "saw", "stage"));
  assert.equal(s.stations.saw.staging, 4);
  assert.ok(handleLoad(s, "saw", "queue"));
  assert.equal(s.stations.saw.input, 1);
  assert.ok(handleLoad(s, "saw", "unload"));
  assert.equal(s.stations.saw.input, 3);
  s.cash = 230;
  s.stash.lumber = 7;
  assert.ok(buildProject(s, "bin", "saw"));
  assert.ok(buildProject(s, "freight", "saw"));
  assert.equal(stageCapacity(s, "saw"), 16);
  assert.equal(inputCapacity(s, "saw"), 13);
  assert.equal(outputCapacity(s, "saw"), 13);
  assert.equal(s.stash.lumber, 0);
  assert.equal(buildProject(s, "fast", "saw"), false);
  tick(s);
  assert.equal(s.stations.saw.staging, 0);
  assert.equal(s.stations.saw.input, 5);
  advance(s, 4);
  at(s.player, "sawOut");
  tick(s);
  assert.equal(s.player.bag.boards, 0);
  assert.ok(handleLoad(s, "saw", "pickup"));
  assert.equal(s.player.bag.boards, 1);
});

test("cart rack specialization never accepts incompatible overflow or loses any load", () => {
  const s = createState();
  at(s.player, "build");
  s.cash = 200;
  purchase(s, "cart");
  assert.ok(cartRack(s, "timber"));
  assert.equal(capacity(s), 14);
  s.player.bag.meat = 6;
  s.player.bag.logs = 8;
  assert.equal(roomFor(s, s.player, "meat"), 0);
  assert.deepEqual(cartLoad(s), Array(8).fill("logs"));
  assert.equal(cartRack(s, "food"), false);
  assert.equal(cartRack(s, "mixed"), false);
  assert.ok(deserialize(serialize(s)));
  s.player.bag.logs = 0;
  assert.ok(cartRack(s, "food"));
  const cash = s.cash;
  assert.ok(cartRack(s, "timber"));
  assert.equal(s.cash, cash);
});

test("stock targets switch output to premium and route helpers pack jobs and sell surplus", () => {
  const s = createState();
  s.cash = 145;
  at(s.player, "sawIn");
  assert.ok(selectRecipe(s, "saw", "lumber"));
  assert.ok(setStation(s, "saw", "target", 4));
  s.stations.saw.input = 5;
  tick(s);
  assert.equal(s.stations.saw.jobs[0].good, "boards");
  s.market.stock.boards = 4;
  assert.equal(onHand(s, "boards"), 4);
  advance(s, 4);
  assert.equal(s.stations.saw.jobs[0].good, "lumber");
  at(s.player, "sell");
  assert.ok(marketAction(s, "accept", "builder"));
  assert.ok(marketAction(s, "pack", "contract"));
  at(s.player, "build");
  assert.ok(purchase(s, "helper"));
  assert.ok(assign(s, 0, "route"));
  assert.ok(setWorkerRoute(s, 0, "min", 1));
  assert.ok(setWorkerRoute(s, 0, "priority", "pickup"));
  assert.ok(setWorkerRoute(s, 0, "reserve", true));
  advance(s, 330);
  assert.ok(s.market.completed > 0);
  assert.ok(s.sold > 18);
  assert.ok(deserialize(serialize(s)));
});

test("version 2 active bulk orders, stock and in-flight jobs survive migration", () => {
  const old = createState();
  old.version = 2;
  old.order = { boards: 4, steaks: 2 };
  old.stations.saw.jobs.push({ good: "boards", left: 2.8 });
  old.player.bag.lumber = 4;
  delete old.market;
  const s = deserialize(serialize(old));
  assert.equal(s.version, 5);
  assert.deepEqual(s.order, { boards: 4, steaks: 2 });
  assert.equal(s.player.bag.lumber, 4);
  assert.equal(s.stations.saw.jobs[0].units, 1);
});

test("a fresh camp can earn and build the timber yard from its first five boards", () => {
  let s = createState();
  assert.ok(trackPlan(s, "yard"));
  assert.equal(buildAtPlot(s, "yard", "build"), false);
  at(s.player, "forest");
  advance(s, 5);
  at(s.player, "sawIn");
  advance(s, 21);
  at(s.player, "sawOut");
  advance(s, .1);
  assert.equal(s.player.bag.boards, 5);
  at(s.player, "sell");
  advance(s, 5);
  assert.equal(s.cash, 12);
  assert.equal(s.player.bag.boards, 2);
  Object.assign(s.player, { x: BUILDINGS.yard.x, z: BUILDINGS.yard.z });
  assert.ok(buildAtPlot(s, "yard", "supply"));
  assert.equal(s.player.bag.boards, 0);
  assert.ok(buildAtPlot(s, "yard", "build"));
  assert.equal(s.cash, 0);
  assert.equal(built(s, "yard"), false);
  advance(s, 2);
  s = deserialize(serialize(s));
  assert.ok(s);
  advance(s, 2);
  assert.equal(built(s, "yard"), true);
  assert.equal(sourceCapacity(s, "forest"), 9);
  assert.equal(buildAtPlot(s, "yard", "build"), false);
});

test("dependencies and construction costs hold for each new building", () => {
  let s = createState();
  s.cash = 3000;
  for (const [key, plan] of Object.entries(BUILDINGS)) {
    Object.assign(s.player, { x: plan.x, z: plan.z });
    if (plan.after) assert.ok(built(s, plan.after));
    const first = Object.keys(plan.goods)[0];
    s.player.bag[first] = 1;
    assert.ok(buildAtPlot(s, key, "supply"));
    assert.equal(buildAtPlot(s, key, "build"), false);
    for (const [good, n] of Object.entries(plotInfo(s, key).needs)) s.stash[good] = n;
    assert.ok(buildAtPlot(s, key, "supply"));
    const before = s.cash;
    assert.ok(buildAtPlot(s, key, "build"));
    assert.equal(s.cash, before - plan.cash);
    advance(s, plan.seconds);
    assert.ok(built(s, key));
    assert.ok(deserialize(serialize(s)));
  }
  assert.equal(stashCapacity(s), 32);
  assert.equal(sourceCapacity(s, "boars"), 9);
  assert.equal(recipeSeconds(s, "saw", "boards"), 3.2);
  assert.equal(outputCapacity(s, "grill"), 9);
  assert.ok(purchase(s, "cart"));
  assert.equal(capacity(s), 14);
  assert.equal(helperLimit(s), 3);
  for (let i = 0; i < 3; i++) assert.ok(purchase(s, "helper"));
  assert.equal(purchase(s, "helper"), false);
  assert.equal(spotPrice(s, "trays"), 23);
  at(s.player, "sell");
  s.player.bag.trays = 1;
  const before = s.cash;
  assert.ok(marketAction(s, "sell"));
  assert.equal(s.cash, before + 23);
  assert.ok(deserialize(serialize(s)));
});

test("new construction is initialized in existing saves and locked plots cannot take supplies", () => {
  const previous = createState();
  previous.version = 3;
  previous.cash = 400;
  previous.player.bag.boards = 4;
  delete previous.construction;
  delete previous.plan;
  const s = deserialize(serialize(previous));
  assert.ok(s);
  assert.equal(s.cash, 400);
  assert.equal(s.player.bag.boards, 4);
  Object.assign(s.player, { x: BUILDINGS.mill.x, z: BUILDINGS.mill.z });
  assert.equal(buildAtPlot(s, "mill", "supply"), false);
  assert.equal(s.plan, null);
  s.construction.mill.left = 0;
  assert.equal(deserialize(serialize(s)), null);
});

test("simple mode can gather, load, collect and sell with every automatic action off", () => {
  const s = createState();
  assert.ok(featurePreset(s, "simple"));
  assert.equal(feature(s, "premium"), false);
  assert.equal(feature(s, "construction"), false);
  assert.equal(feature(s, "battery"), true);
  for (const id of ["autoGather", "autoHandling", "autoSell"]) setFeature(s, id, false);
  at(s.player, "forest");
  advance(s, 2);
  assert.equal(s.player.bag.logs, 0);
  assert.ok(gatherNow(s, "forest"));
  at(s.player, "sawIn");
  tick(s);
  assert.equal(s.player.bag.logs, 1);
  assert.ok(handleLoad(s, "saw", "unload"));
  advance(s, 5);
  at(s.player, "sawOut");
  assert.ok(handleLoad(s, "saw", "pickup"));
  at(s.player, "sell");
  advance(s, 2);
  assert.equal(s.cash, 0);
  assert.ok(marketAction(s, "sell"));
  assert.equal(s.cash, 4);
  assert.ok(deserialize(serialize(s)));
});

test("disabled cart, station equipment and larger bags never destroy excess inventory", () => {
  let s = createState();
  s.cash = 500;
  purchase(s, "cart");
  purchase(s, "pack");
  purchase(s, "storage");
  s.player.bag.logs = 14;
  s.stations.saw.input = 8;
  s.stations.saw.output = 8;
  for (const id of ["cart", "upgrades", "equipment"]) setFeature(s, id, false);
  assert.equal(capacity(s), 6);
  assert.equal(roomFor(s, s.player, "logs"), 0);
  at(s.player, "sawIn");
  advance(s, 2);
  assert.equal(s.stations.saw.input, 8);
  assert.equal(s.player.bag.logs, 14);
  s = deserialize(serialize(s));
  assert.ok(s);
  setFeature(s, "cart", true);
  setFeature(s, "upgrades", true);
  assert.equal(capacity(s), 14);
  assert.equal(s.stations.saw.output, 8);
});

test("switches pause individual buildings, helpers, contracts and account pickups", () => {
  let s = createState();
  s.cash = 300;
  purchase(s, "helper");
  const worker = s.workers[0];
  setFeature(s, "helpers", false);
  assert.ok(trackPlan(s, "yard"));
  Object.assign(s.player, { x: BUILDINGS.yard.x, z: BUILDINGS.yard.z });
  s.player.bag.boards = 2;
  buildAtPlot(s, "yard", "supply");
  buildAtPlot(s, "yard", "build");
  setFeature(s, "buildYard", false);
  at(s.player, "sell");
  assert.ok(marketAction(s, "accept", "supper"));
  setFeature(s, "contracts", false);
  assert.ok(marketAction(s, "account", "carpenter"));
  setFeature(s, "accounts", false);
  advance(s, 8);
  assert.equal(s.construction.yard.left, 4);
  assert.equal(worker.x, -8);
  assert.equal(s.market.elapsed, 0);
  assert.deepEqual(marketTargets(s), []);
  s = deserialize(serialize(s));
  assert.ok(s);
  for (const id of ["helpers", "contracts", "accounts", "buildYard"]) setFeature(s, id, true);
  advance(s, 4);
  assert.ok(built(s, "yard"));
  assert.notEqual(s.workers[0].z, 7);
  assert.equal(marketTargets(s).length, 2);
});
