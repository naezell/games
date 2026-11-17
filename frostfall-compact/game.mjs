import { TRADER, merchantStock, specialInfo, SPECIAL_BONUS } from "./trading.mjs";
import { FEATURES, feature, setFeature, featurePreset } from "./features.mjs";
import {
  createState,
  deserialize,
  serialize,
  tick,
  purchase,
  assign,
  stashAll,
  retrieve,
  returnRaw,
  count,
  capacity,
  storage,
  UPGRADES,
  GOODS,
  JOBS,
  SPOTS,
  NAMES,
  PRICES,
  LINES,
  EQUIPMENT,
  CART_PRICE,
  BULK,
  near,
  activity,
  inputCapacity,
  outputCapacity,
  outputCount,
  stationStatus,
  selectRecipe,
  install,
  acceptBulk,
  bulkRemaining,
  deliverBulk,
  cancelBulk, CART_RACKS, BIN_COST, REBUILDS, TARGETS, ROUTE_PRIORITIES, FUEL_CAP,
  cartRack, cartLoad, projectReady, buildProject, setWorkerRoute, setStation, sortTimber,
  handleLoad, marketAction, stageCapacity, inputCount, roomFor, onHand, recipeSeconds, rackFits, nextBatchNeeds,
  rackSlots, stashCapacity, helperLimit, helperPrice, sourceCapacity, spotPrice, gatherNow, cartActive, activeRack, workerActive, workerCapacity, nextGood, buySupplies, merchantAvailable,
} from "./sim.mjs";
import { BUILDINGS, built, trackPlan, plotInfo, unlocked, atPlot, buildAtPlot, buildingEnabled, buildingLevel, nextLevel, sitePhase, phaseEnabled, pinnedProject } from "./construction.mjs";
import { CONTRACTS, ACCOUNTS, BAY, marketDay, marketOffers, marketTargets, accountUnlocked, canPack, neededFor } from "./market.mjs";
const THREE = globalThis.THREE;
const KEY = "frostfall-compact-v1",
  $ = (id) => document.getElementById(id);
let state,
  saveError = false;
try {
  state = deserialize(localStorage.getItem(KEY)) || createState();
} catch {
  state = createState();
  saveError = true;
}
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb9e0e8);
const camera = new THREE.OrthographicCamera(-16, 16, 16, -16, 0.1, 100);
camera.position.set(0, 30, 24);
camera.lookAt(0, 0, 0);
let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas: $("canvas"),
    antialias: true,
    powerPreference: "low-power",
  });
} catch (e) {
  $("world").innerHTML =
    '<div class="webgl-error"><strong>Frostfall needs WebGL</strong><p>Your browser could not start the 3D scene. Enable hardware acceleration or try another browser, then reload.</p><button onclick="location.reload()">Try again</button></div>';
  $("panelTitle").textContent = "Unable to start the clearing";
  $("panelContent").textContent = "Your saved camp has not been changed.";
}
if (renderer) {
  const enabled = id => feature(state, id);
  function setGraphicsQuality() {
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, enabled("battery") ? .8 : 1.25));
  }
  setGraphicsQuality();
  renderer.outputEncoding = THREE.sRGBEncoding;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x94b6b5, 1));
  const light = new THREE.DirectionalLight(0xfff8e8, 0.65);
  light.position.set(-8, 20, 10);
  scene.add(light);
  const mats = {};
  const goodsColors = { logs: 0xb88b5f, boards: 0xe4be83, lumber: 0xa66a35,
    meat: 0xcd7772, steaks: 0xa95540, trays: 0x8b5653 };
  function mat(c) {
    return mats[c] || (mats[c] = new THREE.MeshLambertMaterial({ color: c }));
  }
  function box(w, h, d, c, x, y, z, parent = scene) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }
  function cyl(rt, rb, h, c, x, y, z, parent = scene, seg = 8) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(c));
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }
  function ball(r, c, x, y, z, parent = scene) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 7), mat(c));
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }
  function group(x, z) {
    let g = new THREE.Group();
    g.position.set(x, 0, z);
    scene.add(g);
    return g;
  }
  box(24, 0.7, 24, 0x93c6ce, 0, -0.55, 0);
  box(24, 0.22, 24, 0xf0faf4, 0, -0.08, 0);
  for (let i = 0; i < 14; i++) {
    let x = ((i * 37) % 220) / 10 - 11,
      z = ((i * 71) % 220) / 10 - 11;
    cyl(0.35, 0.5, 0.12, 0xd3eeed, x, 0.08, z);
  }
  function tree(x, z, s = 1) {
    let g = group(x, z);
    g.scale.setScalar(s);
    cyl(0.19, 0.25, 1, 0x856047, 0, 0.5, 0, g);
    cyl(0, 1.05, 1.5, 0x3e8587, 0, 1.45, 0, g);
    cyl(0, 0.85, 1.35, 0x59a4a1, 0, 2.05, 0, g);
    cyl(0, 0.58, 1, 0x79bdb5, 0, 2.6, 0, g);
    cyl(0, 0.3, 0.5, 0xf8fffa, 0, 2.94, 0, g);
    return g;
  }
  const forestTrees = [];
  [
    [-10, -10],
    [-7, -10.5],
    [-10, -7],
    [-5.7, -9.5],
    [-10.5, -4.7],
    [10, -10],
    [10.5, -6],
    [10.5, 1],
    [-10.5, 2],
    [-10.5, 9],
    [10.5, 9],
  ].forEach((p, i) => {
    const t = tree(...p, 0.75 + (i % 3) * 0.12);
    if (i < 4) forestTrees.push(t);
  });
  function person(color, x, z, scale = 1) {
    let g = group(x, z);
    g.scale.setScalar(scale);
    let l = box(0.2, 0.45, 0.22, 0x34485a, -0.14, 0.23, 0, g),
      r = box(0.2, 0.45, 0.22, 0x34485a, 0.14, 0.23, 0, g);
    cyl(0.31, 0.4, 0.75, color, 0, 0.82, 0, g, 10);
    ball(0.34, color, 0, 1.47, -0.06, g);
    ball(0.265, 0xf2c9a9, 0, 1.46, 0.12, g);
    ball(0.035, 0x243542, -0.09, 1.5, 0.36, g);
    ball(0.035, 0x243542, 0.09, 1.5, 0.36, g);
    const arms = [-.39, .39].map(x => {
      const arm = new THREE.Group();
      arm.position.set(x, 1.25, 0);
      g.add(arm);
      box(.18, .48, .2, color, 0, -.23, 0, arm);
      box(.16, .13, .17, 0xf2c9a9, 0, -.46, 0, arm);
      return arm;
    });
    const axe = new THREE.Group();
    axe.position.set(0, -.45, .08);
    arms[1].add(axe);
    box(.07, .68, .08, 0x80513c, 0, -.22, 0, axe);
    box(.2, .22, .3, 0xc9dce1, 0, -.48, .10, axe);
    const carried = box(.44, .21, .35, goodsColors.logs, 0, .85, .57, g);
    axe.visible = carried.visible = false;
    box(0.52, 0.55, 0.27, 0x996a43, 0, 0.88, -0.35, g);
    const load = [];
    for (let i = 0; i < 4; i++) {
      let m = box(0.34, 0.14, 0.2, 0xe4be83, 0, 1.15 + i * 0.15, -0.43, g);
      m.visible = false;
      load.push(m);
    }
    return { g, l, r, load, arms, axe, carried };
  }
  function boar(x, z) {
    let g = group(x, z);
    ball(0.68, 0x926247, 0, 0.55, 0, g).scale.set(1.35, 0.75, 0.7);
    ball(0.42, 0xa37452, 0.85, 0.65, 0, g);
    ball(0.22, 0xd3aa8b, 1.15, 0.55, 0, g);
    for (let a of [-0.55, 0.55])
      for (let b of [-0.35, 0.35]) box(0.15, 0.35, 0.15, 0x57443c, a, 0.17, b, g);
    return g;
  }
  const boarModels = [boar(7, -9), boar(9, -7.5)];
  // Station structures, deliberately low enough to leave the whole clearing readable.
  let saw = group(-5.5, -2);
  box(2.3, 0.85, 1.35, 0x986642, 0, 0.43, 0, saw);
  box(2.5, 0.12, 1.5, 0x6d4933, 0, 0.9, 0, saw);
  let blade = cyl(0.48, 0.48, 0.08, 0xcbdce0, 0, 1.1, 0, saw, 16);
  blade.rotation.x = Math.PI / 2;
  for (let x of [-1, 1]) box(0.13, 1.5, 0.13, 0x795238, x, 1.55, -0.55, saw);
  box(2.5, 0.14, 1, 0x5f9ba2, 0, 2.25, -0.35, saw);
  box(2.5, 0.07, 0.85, 0xf8fffa, 0, 2.35, -0.35, saw);
  let grill = group(5.5, -2);
  cyl(1.02, 1.1, 0.7, 0x7e8e91, 0, 0.35, 0, grill, 12);
  cyl(0.88, 0.88, 0.1, 0x364a4d, 0, 0.75, 0, grill, 12);
  const fire = cyl(0, 0.5, 0.65, 0xf5a24c, 0, 0.95, 0, grill);
  for (let x of [-0.8, 0.8])
    for (let z of [-0.65, 0.65]) box(0.09, 1.5, 0.09, 0x596968, x, 1.35, z, grill);
  let roof = cyl(0, 1.28, 0.65, 0xb97151, 0, 2.25, 0, grill, 4);
  roof.rotation.y = Math.PI / 4;
  cyl(0, 0.7, 0.28, 0xfafff6, 0, 2.57, 0, grill, 4).rotation.y = Math.PI / 4;
  let counter = group(1, 6);
  box(3, 0.85, 0.85, 0xa66f47, 0, 0.43, 0, counter);
  box(3.2, 0.12, 1.05, 0x795039, 0, 0.9, 0, counter);
  for (let x of [-1.4, 1.4]) box(0.12, 1.7, 0.12, 0x795039, x, 1.7, 0, counter);
  box(3.3, 0.17, 1.2, 0xdd7862, 0, 2.5, 0, counter);
  box(3.3, 0.08, 0.85, 0xfffcf2, 0, 2.62, -0.08, counter);
  const bay = group(3.25, 6.85);
  box(2.15, .2, 1.95, 0xb58154, 0, .13, 0, bay);
  for (const z of [-.74, .7]) box(.13, .65, .13, 0x815140, .94, .34, z, bay);
  box(.14, .13, 1.58, 0x815140, .94, .65, 0, bay);
  const packedCrates = Array.from({ length: 5 }, (_, i) =>
    box(.48, .43, .42, 0xd3a565, (i % 3) * .54 - .59, .42, Math.floor(i / 3) * .55 - .4, bay));
  // Equipment fits behind the existing machines and their loading pads.
  const fixtures = {};
  for (const [key, x] of [["saw", -5.5], ["grill", 5.5]]) {
    const kit = fixtures[key] = { machine: group(x, -4), rack: group(SPOTS[key + "In"].x, -3.4),
      bench: group(SPOTS[key + "Out"].x, -3.35), supply: group(SPOTS[key + "In"].x - 1.35, -2.85),
      rebuild: group(x, -.82) };
    box(.83, .17, .85, 0x98745a, 0, .16, 0, kit.supply);
    for (const edge of [-.4, .4]) box(.11, .49, .86, 0x68867c, edge, .36, 0, kit.supply);
    kit.staged = Array.from({ length: 4 }, (_, i) =>
      box(.34, .14, .47, goodsColors[LINES[key].raw], i % 2 ? .19 : -.19, .29 + .15 * Math.floor(i / 2), 0, kit.supply));
    kit.beam = box(1.65, .23, .27, 0x5e8e88, 0, .89, 0, kit.rebuild);
    for (const edge of [-.69, .69]) box(.13, .95, .16, 0x795238, edge, .46, 0, kit.rebuild);
    if (key === "saw") {
      box(1.5, .75, .9, 0x986642, 0, .38, 0, kit.machine);
      kit.blade = cyl(.36, .36, .09, 0xcbdce0, 0, .86, 0, kit.machine, 16);
      kit.blade.rotation.x = Math.PI / 2;
    } else {
      cyl(.62, .76, .63, 0x7e8e91, 0, .32, 0, kit.machine, 12);
      cyl(.6, .6, .1, 0x364a4d, 0, .68, 0, kit.machine, 12);
      kit.flame = cyl(0, .35, .45, 0xf5a24c, 0, .83, 0, kit.machine);
    }
    for (const part of ["rack", "bench"]) {
      const fixture = kit[part];
      for (const edge of [-.6, .6]) box(.13, .68, .13, 0x7f644b, edge, .34, 0, fixture);
      box(1.5, .13, .65, part === "rack" ? 0xb38a65 : 0x5e8e88, 0, .64, 0, fixture);
      if (part === "rack") box(1.4, .12, .61, 0xb38a65, 0, .23, 0, fixture);
    }
  }
  function makeBuilding(id, plan) {
    const site = group(plan.x, plan.z);
    const paint = { yard: 0x657d60, cold: 0x5b8195, store: 0x7c966f, mill: 0x577e83,
      kitchen: 0xb96d51, cart: 0xb38a51, dispatch: 0x656d96, exchange: 0xb7616a }[id];
    const base = box(1.9, .18, 1.5, 0xbca487, 0, .13, 0, site);
    const shell = new THREE.Group();
    site.add(shell);
    const open = id === "yard" || id === "exchange" || id === "cart";
    const height = id === "dispatch" ? 1.67 : 1.4;
    for (const x of [-.76, .76]) {
      for (const z of [-.59, .59]) box(.13, height, .13, 0x875d43, x, height / 2 + .13, z, shell);
      if (!open || id === "cart") box(.12, .93, 1.1, paint, x, .65, 0, shell);
    }
    box(1.4, .88, .12, paint, 0, .69, -.58, shell);
    for (const x of [-.47, .47]) {
      const roof = box(.99, .13, 1.64, paint, x * .96, height + .31, 0, shell);
      roof.rotation.z = x > 0 ? -.34 : .34;
      const snow = box(.96, .055, 1.58, 0xf2fbf8, x * .93, height + .4, -.02, shell);
      snow.rotation.z = roof.rotation.z;
    }
    if (open) {
      if (id === "yard") {
        for (const x of [-.4, 0, .4]) cyl(.12, .12, .83, 0x936541, x, .36, .12, shell).rotation.x = Math.PI / 2;
      } else if (id === "cart") {
        cyl(.34, .34, .11, 0x574941, .46, .5, .49, shell).rotation.x = Math.PI / 2;
      } else {
        box(1.4, .17, .5, 0xa26a49, 0, .78, .62, shell);
        for (const x of [-.45, 0, .45]) box(.29, .25, .31, 0xe4b57d, x, .96, .65, shell);
      }
    } else {
      box(1.42, 1.05, .09, paint, 0, .73, .58, shell);
      box(.42, .82, .11, 0x765039, -.35, .58, .64, shell);
      box(.41, .34, .1, id === "cold" ? 0xc4e6ee : 0xf4dca0, .34, .94, .64, shell);
      if (id === "kitchen") box(.29, .56, .29, 0x836255, .46, 1.85, -.32, shell);
    }
    const stakes = new THREE.Group();
    site.add(stakes);
    for (const x of [-.86, .86]) for (const z of [-.66, .66])
      box(.08, .42, .08, 0x987453, x, .24, z, stakes);
    const addOns = [new THREE.Group(), new THREE.Group()];
    for (const attachment of addOns) site.add(attachment);
    box(.44, .52, .85, 0x9b704d, .91, .4, -.09, addOns[0]);
    box(.51, .09, .92, paint, .92, .71, -.09, addOns[0]);
    box(.44, .52, .85, 0x9b704d, -.91, .4, -.09, addOns[1]);
    box(.51, .09, .92, paint, -.92, .71, -.09, addOns[1]);
    box(.12, .65, .12, 0x805846, .73, height + .5, -.58, addOns[1]);
    box(.27, .18, .09, 0xf0c68b, .73, height + .75, -.58, addOns[1]);
    return { site, base, shell, stakes, addOns };
  }
  const structures = Object.fromEntries(Object.entries(BUILDINGS).map(([id, plan]) => [id, makeBuilding(id, plan)]));
  const cart = group(0, 0);
  cart.visible = false;
  box(1, .19, 1.28, 0x77523b, 0, .43, 0, cart);
  box(.09, .1, .79, 0x815942, 0, .47, .92, cart);
  for (const x of [-.55, .55]) {
    box(.1, .37, 1.25, 0xa97950, x * .85, .65, 0, cart);
    const wheel = cyl(.27, .27, .13, 0x4b575b, x, .27, -.17, cart, 12);
    wheel.rotation.z = Math.PI / 2;
  }
  const rackRails = [-.47, .47].map(x => box(.1, .35, 1.27, 0x39766e, x, .96, 0, cart));
  const cartGoods = Array.from({ length: 15 }, (_, i) =>
    box(.35, .17, .35, goodsColors.logs, (i % 2 ? 1 : -1) * .2, .62 + Math.floor(i / 4) * .18, i % 4 < 2 ? -.25 : .21, cart));
  const customers = [person(0xdca34e, 1, 8, 0.78), person(0xb57d9c, 2.5, 9, 0.72)];
  customers.forEach((c) => (c.g.rotation.y = Math.PI));
  let build = group(-8, 7);
  cyl(1.35, 1.45, 0.15, 0x7db4a5, 0, 0.08, 0, build, 12);
  box(0.16, 1.4, 0.16, 0x8b6748, 0, 0.75, 0, build);
  box(1.25, 0.68, 0.14, 0xf5dfae, 0, 1.35, 0, build);
  box(0.7, 0.08, 0.05, 0x9a7653, 0, 1.4, 0.1, build);
  box(0.08, 0.45, 0.05, 0x9a7653, 0, 1.4, 0.1, build);
  const player = person(0xd85f50, state.player.x, state.player.z);
  let workerModels = [];
  function syncWorkers() {
    while (workerModels.length < state.workers.length)
      workerModels.push(person([0x4ca69e, 0x9775b5, 0x558eb7][workerModels.length], 0, 0, 0.88));
  }
  syncWorkers();
  const piles = Object.entries(LINES).flatMap(([key, line]) => ["In", "Out"].map(end => {
    const { x, z } = SPOTS[key + end];
    const g = group(x, z);
    cyl(.78, .8, .09, 0xd6e8d9, 0, .06, 0, g, 12);
    const items = Array.from({ length: 12 }, (_, i) =>
      box(.52, .15, .4, goodsColors[line.raw], ((i % 3) - 1) * .39, .17 + Math.floor(i / 3) * .16, 0, g));
    return { key, input: end === "In", line, items };
  }));
  const labels = [
    ["forest", "FOREST", "Gather logs"],
    ["boars", "BOARS", "Gather meat"],
    ["sawIn", "SAWMILL IN", "Waiting for logs"],
    ["sawOut", "SAWMILL OUT", "0 ready"],
    ["grillIn", "GRILL IN", "Waiting for meat"],
    ["grillOut", "GRILL OUT", "0 ready"],
    ["sell", "MARKET", "Sell goods"],
    ["build", "IMPROVE", "Upgrades & helpers"],
  ];
  let destination = null;
  let buildMenu = false;
  let settingsMenu = false;
  let ledgerMenu = false;
  let catalog = false;
  let inspectedBuild = null;
  const tmp = new THREE.Vector3();
  for (const [key, title, sub] of labels) {
    const el = document.createElement("button");
    el.className = "place";
    el.innerHTML = `${title}<span>${sub}</span>`;
    el.addEventListener("pointerdown", (e) => e.stopPropagation());
    el.onclick = () => {
      buildMenu = false;
      settingsMenu = false;
      ledgerMenu = false;
      destination = { ...SPOTS[key] };
      updateUI();
    };
    $("labels").appendChild(el);
    SPOTS[key].el = el;
  }
  const plotMarker = document.createElement("button");
  plotMarker.className = "place plot-marker";
  plotMarker.type = "button";
  plotMarker.hidden = true;
  plotMarker.addEventListener("pointerdown", e => e.stopPropagation());
  plotMarker.onclick = () => {
    if (!state.plan) return;
    buildMenu = true;
    settingsMenu = false;
    ledgerMenu = false;
    catalog = false;
    inspectedBuild = null;
    destination = BUILDINGS[state.plan];
    updateUI();
  };
  $("labels").appendChild(plotMarker);
  function positionPlotMarker() {
    const plan = state.plan && BUILDINGS[state.plan];
    if (!plan || !unlocked(state, state.plan)) return;
    tmp.set(plan.x, 1.15, plan.z).project(camera);
    plotMarker.style.left = `${(tmp.x + 1) * 50}%`;
    plotMarker.style.top = `${(1 - tmp.y) * 50}%`;
  }
  function resize() {
    let w = $("world").clientWidth,
      h = $("world").clientHeight;
    renderer.setSize(w, h, false);
    const aspect = w / h;
    let vertical = Math.max(31, 25 / aspect);
    camera.left = (-vertical * aspect) / 2;
    camera.right = (vertical * aspect) / 2;
    camera.top = vertical / 2;
    camera.bottom = -vertical / 2;
    camera.updateProjectionMatrix();
    // Project labels correctly before the renderer's first camera update.
    camera.updateMatrixWorld(true);
    for (const [k] of labels) {
      let p = SPOTS[k];
      tmp.set(p.x, 0, p.z).project(camera);
      p.el.style.left = `${(tmp.x + 1) * 50}%`;
      p.el.style.top = `${(1 - tmp.y) * 50}%`;
    }
    positionPlotMarker();
  }
  window.addEventListener("resize", resize);
  // Opening the improvement panel changes the available world height too.
  new ResizeObserver(resize).observe($("world"));
  resize();
  let paused = false,
    keys = {},
    joy = { x: 0, z: 0 },
    drag = null;
  window.addEventListener("keydown", (e) => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d"].includes(e.key)) {
      keys[e.key] = true;
      destination = null;
      e.preventDefault();
    }
  });
  window.addEventListener("keyup", (e) => (keys[e.key] = false));
  window.addEventListener("blur", () => {
    keys = {};
    joy.x = joy.z = 0;
  });
  $("pause").onclick = () => {
    paused = !paused;
    $("pause").textContent = paused ? "▶" : "Ⅱ";
    $("paused").hidden = !paused;
    if (paused) stopLoop();
    else startLoop();
  };
  function stickUpdate(e) {
    let rect = $("stick").getBoundingClientRect(),
      x = e.clientX - (rect.left + rect.width / 2),
      y = e.clientY - (rect.top + rect.height / 2),
      d = Math.hypot(x, y),
      n = Math.min(d, 25) / (d || 1);
    joy.x = (x * n) / 25;
    joy.z = (y * n) / 25;
    $("knob").style.transform = `translate(${x * n}px,${y * n}px)`;
    destination = null;
  }
  $("stick").addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    $("stick").setPointerCapture(e.pointerId);
    stickUpdate(e);
  });
  $("stick").addEventListener("pointermove", (e) => {
    if ($("stick").hasPointerCapture(e.pointerId)) stickUpdate(e);
  });
  function resetStick() {
    joy.x = joy.z = 0;
    $("knob").style.transform = "";
  }
  $("stick").addEventListener("pointerup", resetStick);
  $("stick").addEventListener("pointercancel", resetStick);
  $("world").addEventListener("pointerdown", (e) => {
    if (e.target !== $("canvas")) return;
    drag = { x: e.clientX, y: e.clientY };
    $("world").setPointerCapture(e.pointerId);
  });
  $("world").addEventListener("pointermove", (e) => {
    if (!drag) return;
    let dx = e.clientX - drag.x,
      dy = e.clientY - drag.y;
    if (Math.hypot(dx, dy) > 8) {
      let d = Math.max(35, Math.hypot(dx, dy));
      joy.x = dx / d;
      joy.z = dy / d;
      destination = null;
    }
  });
  function endDrag() {
    drag = null;
    joy.x = joy.z = 0;
  }
  $("world").addEventListener("pointerup", endDrag);
  $("world").addEventListener("pointercancel", endDrag);
  function save() {
    try {
      localStorage.setItem(KEY, serialize(state));
      saveError = false;
    } catch {
      saveError = true;
    }
  }
  let lastPanel = "";
  const unavailable = yes => yes ? "disabled" : "";
  const action = (label, data, disabled = false) => `<button class="action" ${data} ${unavailable(disabled)}>${label}</button>`;
  const details = (id, name, content) => `<details data-section="${id}"><summary>${name}</summary>${content}</details>`;
  const choices = (value, options) => Object.entries(options).map(([k, label]) =>
    `<option value="${k}"${String(value) === k ? " selected" : ""}>${label}</option>`).join("");
  const select = (label, data, value, options) => `<label class="field">${label}<select ${data}>${choices(value, options)}</select></label>`;
  const projectLabel = cost => `${cost.cash} coins + ${cost.lumber} finished lumber`;
  const recipeButtons = (key, st) => Object.entries(LINES[key].recipes).map(([good, recipe]) =>
    `<button class="action choice" data-recipe="${good}" data-station="${key}" aria-pressed="${st.recipe === good}">${recipe.name} · ${PRICES[good]} coins<br><small>${recipe.input} ${LINES[key].raw} · ${recipeSeconds(state, key, good).toFixed(2).replace(/\.?0+$/, "")}s</small></button>`).join("");
  function equipmentControls(key, st) {
    if (st.equipment) return `<p class="station-details">${EQUIPMENT[st.equipment].name} installed</p>`;
    return `<details data-section="equipment"><summary>Choose this station’s one equipment upgrade</summary><div class="actions">${Object.entries(EQUIPMENT).map(([part, e]) =>
      `<button class="action" data-install="${part}" data-station="${key}" ${unavailable(state.cash < e.price)}>${e.name} · ${e.price} coins<br><small>${e.effect}</small></button>`).join("")}</div></details>`;
  }
  function cartControls() {
    if (!cartActive(state) || !enabled("cartRacks")) return "";
    return details("cart", `Cart · ${CART_RACKS[state.cartRack].name}`, `<div class="actions">${Object.entries(CART_RACKS).map(([id, r]) =>
      action(`${r.name} · +${rackSlots(state, id)} slots${r.cash && !state.ownedRacks[id] ? ` · ${r.cash} coins` : ""}`,
        `data-cart-rack="${id}"`, state.cartRack === id || !rackFits(state, id) || id !== "mixed" && !state.ownedRacks[id] && state.cash < r.cash)
    ).join("")}</div><p class="station-details">Timber and food racks leave the backpack free for other goods. Unload before switching if your load is too large.</p>`);
  }
  function helperControls(w, i) {
    const route = w.route;
    const routeSelect = (label, field, options) => select(label, `data-route="${field}" data-worker="${i}"`, route[field], options);
    const jobs = Object.entries(JOBS).filter(([job]) => (job !== "route" || enabled("routes")) &&
      (job !== "builder" || enabled("projectHelpers") && enabled("construction"))).map(([job, name]) =>
      `<button data-worker="${i}" data-job="${job}" aria-pressed="${w.job === job}" class="${w.job === job ? "active" : ""}">${name}</button>`).join("");
    const settings = w.job === "route" && enabled("routes") ?
      `<div class="fields">${routeSelect("Route", "line", { saw: "Forest → Sawmill → Counter", grill: "Boars → Grill → Counter" })}
      ${routeSelect("Preferred load", "min", Object.fromEntries(Array.from({ length: workerCapacity(state) },
        (_, i) => [i + 1, `${i + 1} item${i ? "s" : ""}`])))}
      ${routeSelect("Priority", "priority", ROUTE_PRIORITIES)}</div>` : "";
    const project = w.job === "builder" && enabled("projectHelpers") && enabled("construction") ? pinnedProject(state) : null;
    const buildNote = w.job === "builder" ? `<p>${project ? `Delivering to ${BUILDINGS[project.id].name} level ${project.level}.` :
      "Waiting for an enabled build plan. Carried goods stay with this helper until you reassign it or pin a suitable plan."}</p>` : "";
    return details(`worker-${i}`, `Helper ${i + 1} · ${w.job === "route" ? (route.line === "saw" ? "Timber route" : "Food route") : JOBS[w.job]}`,
      `<div class="helper">${jobs}</div>${settings}${buildNote}
      ${enabled("routes") && w.job !== "builder" ? `<div class="fields">${routeSelect("At the counter", "reserve", { false: "Sell goods", true: "Pack jobs first · sell surplus" })}</div>` : ""}`);
  }
  function stationControls(key, st, atInput) {
    const { raw, goods } = LINES[key], load = state.player.bag[raw];
    const stage = `data-station="${key}"`;
    const setting = (label, field, value, options) => select(label, `data-station-field="${field}" ${stage}`, value, options);
    const mode = enabled("autoHandling") ? setting("Handling", "manual", st.manual, { false: "Automatic", true: "Manual" }) : "";
    const target = enabled("stockTargets") ? setting(`Keep ${goods[0]}`, "target", st.target,
      Object.fromEntries(TARGETS.map(n => [n, n || "Off"]))) : "";
    const demand = enabled("demandRecipes") && enabled("premium") ? setting("Recipe choice", "followDemand", st.followDemand,
      { false: "Use selected recipe", true: "Fill orders and pinned build first" }) : "";
    const handling = mode || target || demand ? `<div class="fields">${mode}${target}${demand}</div>${demand && st.followDemand ?
      `<p class="station-details">Next product · ${NAMES[nextGood(state, key)]}</p>` : ""}${target ?
      `<p class="station-details">${onHand(state, goods[0])} ${goods[0]} on hand. A stock target holds surplus at the counter.</p>` : ""}` : "";
    const timber = key === "saw" && (enabled("sorting") || state.timberSorted)
      ? `<p class="station-details">${state.timberSorted} selected logs. Selected timber speeds up finished lumber.</p><div class="actions">
         ${enabled("sorting") ? action("Sort 2 logs", 'data-sort="2"', !st.input) : ""}
         ${action("Return selected to general stock", 'data-sort="-30"', !state.timberSorted)}</div>`
      : key === "grill" && enabled("fuel") && enabled("premium") ?
        `<p class="station-details">Shared offcuts ${state.fuel}/${FUEL_CAP}. One offcut and five meat make two trays when there’s room.</p>
         <div class="fields">${setting("Tray batches", "doubles", state.doubles, { false: "Single batch", true: "Double with offcuts" })}</div>` : "";
    const loading = atInput
      ? `${enabled("staging") || st.staging ? `<p class="station-details">Staged ${st.staging}/${stageCapacity(state, key)} ${raw}${st.bin && enabled("stationProjects") ? " · bin feeds automatically" : ""}</p>` : ""}<div class="actions">
          ${action("Unload matching goods", `data-load="unload" ${stage}`, !load || inputCount(state, key) >= inputCapacity(state, key))}
          ${enabled("staging") ? action(st.bin && enabled("stationProjects") ? "Drop load into bin" : "Stage goods", `data-load="stage" ${stage}`, !load || st.staging >= stageCapacity(state, key)) : ""}
          ${enabled("staging") || st.staging ? action("Load next batch", `data-load="queue" ${stage}`, !st.staging || !nextBatchNeeds(state, key) || inputCount(state, key) >= inputCapacity(state, key)) : ""}</div>`
      : `<div class="actions">${action(cartActive(state) ? "Fill cart from output" : "Pick up goods", `data-load="pickup" ${stage}`,
          !goods.some((g, i) => roomFor(state, state.player, g) > 0 && (i ? st.premium : st.output)))}</div>`;
    const projects = `<p class="station-details">Projects use lumber from your load or the camp crate.</p><div class="actions">
      ${action(st.bin ? "Drop-off bin installed" : `Build drop-off bin<br><small>${projectLabel(BIN_COST)} · 12 staged goods</small>`,
        `data-project="bin" ${stage}`, st.bin || !projectReady(state, BIN_COST))}
      ${st.layout ? `<p class="station-details">${REBUILDS[st.layout].name} rebuild · ${REBUILDS[st.layout].effect}</p>` :
        Object.entries(REBUILDS).map(([id, layout]) => action(`${layout.name}<br><small>${projectLabel(layout)} · ${layout.effect}</small>`,
          `data-project="${id}" ${stage}`, !projectReady(state, layout))).join("")}</div>`;
    return loading + (handling || timber ? details("production", "Stock targets, handling & batches", handling + timber) : "") +
      (enabled("equipment") ? equipmentControls(key, st) : "") +
      (enabled("stationProjects") ? details("projects", "Drop-off bin & permanent rebuild", projects) : "");
  }
  const listedGoods = goods => Object.entries(goods).map(([good, qty]) => `${qty} ${NAMES[good]}`).join(" + ");
  function merchantControls() {
    if (!enabled("supplyMerchant")) return "";
    const goods = Object.entries(TRADER).map(([good, stock]) => {
      const ready = merchantAvailable(state, good);
      const available = merchantStock(state, good);
      const canBuy = ready && state.cash >= stock.price && roomFor(state, state.player, good) > 0;
      const note = stock.premium && !ready && available ? "Unlock with Market Exchange or two completed contracts" : `${available} available · ${stock.price} coins each`;
      const data = `data-merchant="${good}"`;
      return `<article class="operation-card"><h3>${NAMES[good]}</h3><p>${note}</p><div class="actions">
        ${action("Buy 1", data, !canBuy)}${action("Buy a load", data + ' data-fill="true"', !canBuy)}</div></article>`;
    }).join("");
    return details("merchant", "Buy supplies", `<p>Stock refills every three active minutes. After buying finished goods, automatic sales resume on your next visit.</p><div class="offer-list">${goods}</div>`);
  }
  function marketControls(b) {
    const m = state.market;
    const spot = Object.keys(PRICES).map(k => `${NAMES[k]} ${spotPrice(state, k)}`).join(" · ");
    const stock = m.stock;
    const available = Object.fromEntries(Object.keys(PRICES).map(k => [k, b[k] + (stock[k] ?? 0)]));
    const targets = marketTargets(state);
    const showTarget = t => {
      const progress = Object.entries(t.goods).map(([k, qty]) => `${t.packed[k] ?? 0}/${qty} ${NAMES[k]} · ${onHand(state, k)} on hand`).join("<br>");
      const pausedRecipe = !enabled("premium") && ["lumber", "trays"].some(k => neededFor(t, k) > onHand(state, k));
      const timing = t.id === "contract" ? `Installment ${t.part + 1}/${t.total}` : t.ready ? "Pickup ready" : `Pickup on day ${t.due}`;
      return `<article class="operation-card"><h3>${t.name}</h3><p>${timing} · ${t.reward} coins</p><p>${progress}</p>${pausedRecipe ? '<p>Enable premium recipes in Settings to make the remaining goods.</p>' : ""}<div class="actions">
        ${action("Pack available goods", `data-market="pack" data-id="${t.id}"`, !canPack(available, t))}
        ${action("Close at regular prices", `data-market="close" data-id="${t.id}"`)}</div></article>`;
    };
    const offers = !enabled("contracts") || m.active ? "" : `<div class="offer-list">${marketOffers(state).map(id => {
      const c = CONTRACTS[id];
      const total = c.stages.reduce((sum, part) => sum + part.reward, 0);
      return `<article class="operation-card"><h3>${c.name}</h3><p>${c.stages.length} installments · ${total} coins</p>
        <p>First pickup · ${listedGoods(c.stages[0].goods)}</p>
        ${action("Take job", `data-market="accept" data-id="${id}"`)}</article>`;
    }).join("")}</div>`;
    const active = targets.find(t => t.id === "contract");
    const legacy = enabled("bulk") && state.order ? `<article class="operation-card"><h3>Bulk order</h3>
      <p>Boards ${state.order.boards}/${BULK.boards} · Steaks ${state.order.steaks}/${BULK.steaks} · ${BULK.reward} coins</p><div class="actions">
      ${action("Deliver to order", 'data-bulk="deliver"', !["boards", "steaks"].some(k => b[k] && bulkRemaining(state, k)))}
      ${action("Close at regular prices", 'data-bulk="cancel"')}</div></article>` : "";
    const accounts = accountUnlocked(state) ? Object.entries(ACCOUNTS).map(([id, a]) => {
      const t = targets.find(entry => entry.id === id);
      return t ? showTarget(t) : `<article class="operation-card"><h3>${a.name}</h3>
        <p>${listedGoods(a.goods)} · ${a.reward} coins per pickup</p>${action("Open standing account", `data-market="account" data-id="${id}"`)}</article>`;
    }).join("") : "<p>Complete a market job to open standing accounts.</p>";
    const notice = m.notice ? `<p class="payment">${(CONTRACTS[m.notice.id] ?? ACCOUNTS[m.notice.id]).name} · ${m.notice.sale ? "Closed" : "Paid"} · ${m.notice.reward} coins</p>` : "";
    const warehouse = `<p>Held at the counter · ${stock.boards} boards · ${stock.steaks} steaks</p><div class="actions">
      ${Object.keys(stock).map(k => action(`Take ${NAMES[k]}`, `data-market="withdraw" data-id="${k}"`, !stock[k] || roomFor(state, state.player, k) <= 0)).join("")}</div>`;
    const sales = `<p>Spot prices per item · ${spot}</p>${state.trading.hold ? "<p>Automatic sales are paused for this visit.</p>" : ""}<div class="actions">
      ${action(`Automatic sales ${enabled("autoSell") ? "on" : "off"}`, 'data-market="autosale"')}
      ${action("Sell one at spot price", 'data-market="sell"', !Object.keys(PRICES).some(k => b[k]))}
      ${enabled("bulk") && !state.order ? action("Take quick bulk order · 92 coins", 'data-bulk="accept"') : ""}</div>` + warehouse;
    const loadingBay = m.bay ? `<p>Loading bay open · ${m.shipments} large shipments completed.</p>` :
      action(`Build loading bay · ${projectLabel(BAY)}`, 'data-project="bay"', !projectReady(state, BAY));
    const status = [enabled("accounts") ? `Day ${marketDay(state)} · ${m.recurring} account pickups` : "",
      enabled("contracts") ? `${m.completed} jobs finished` : ""].filter(Boolean).join(" · ");
    const anyOrders = enabled("accounts") || enabled("contracts") || enabled("bulk");
    const special = specialInfo(state);
    const currentSpecial = special ? `<p class="payment">Featured spot sale · ${NAMES[special.good]} +${SPECIAL_BONUS} coins · ${special.left ? `${special.left} bonus sales left` : "bonus used"}</p>` : "";
    return `${currentSpecial}${status ? `<p class="station-details">${status}</p>` : ""}${notice && anyOrders ? notice : ""}
      ${active ? showTarget(active) : offers}${legacy}
      ${enabled("accounts") ? details("accounts", "Standing accounts", "<p>Pack ahead. Pickups recur every two play days.</p>" + accounts) : ""}
      ${anyOrders ? details("sales", "Spot sales & reserved stock", sales) : sales}
      ${merchantControls()}
      ${enabled("contracts") && enabled("loadingBay") ? details("bay", "Loading bay & large shipments", loadingBay) : ""}`;
  }
  function materialLine(goods) {
    return Object.entries(goods).filter(([, n]) => n > 0)
      .map(([good, n]) => `${n} ${NAMES[good]}`).join(" + ");
  }
  function constructionControls() {
    const id = catalog ? null : inspectedBuild ?? state.plan;
    const selected = id && BUILDINGS[id];
    const buildingCount = Object.keys(BUILDINGS).length;
    const finished = Object.keys(BUILDINGS).filter(key => built(state, key)).length;
    if (selected) {
      const level = inspectedBuild ? (buildingLevel(state, id, true) || 1) : state.planLevel;
      const site = sitePhase(state, id, level);
      const plan = selected.levels[level - 1];
      const { needs, funded, ready } = plotInfo(state, id, level);
      const remaining = materialLine(needs), packed = materialLine(site.delivered), onsite = atPlot(state, id);
      const canDeliver = Object.entries(needs).some(([k, n]) => n && (state.player.bag[k] || state.stash[k]));
      const needsPremium = !enabled("premium") && ["lumber", "trays"].some(k => (needs[k] ?? 0) > onHand(state, k));
      const upgrade = site.left === 0 && nextLevel(state, id) ? action("Open next upgrade", `data-build-plan="${id}"`) : "";
      const control = !phaseEnabled(state, id, level) ? "<p>Paused in Settings.</p>" :
        site.left === 0 ? `<p class="payment">Level ${level} complete</p>${upgrade}` :
        site.left !== null ? `<p class="payment">Building · ${Math.ceil(site.left)}s left</p>
          <progress value="${plan.seconds - site.left}" max="${plan.seconds}" aria-label="Construction progress"></progress>` :
          !unlocked(state, id, level) ? `<p>Build the ${BUILDINGS[selected.after].name} first.</p>` :
          `<p>${remaining ? `Still needed · ${remaining}` : "All materials delivered"} ·
            ${plan.cash} coins${funded ? " available" : ` · need ${plan.cash - state.cash} more`}</p>
            ${packed ? `<p>At the site · ${packed}</p>` : ""}
            ${needsPremium ? "<p>Enable premium recipes in Settings to make the remaining goods.</p>" : ""}
            <div class="actions">${onsite ? action("Deliver materials", 'data-construction="supply"', !canDeliver) +
                action(level > 1 ? "Pay & upgrade" : "Pay & build", 'data-construction="build"', !ready || !funded) :
                action(`Walk to ${selected.area} site`, 'data-construction="walk"')}</div>`;
      return `<article class="operation-card blueprint-card"><h3>${selected.name} · Level ${level}</h3>
        <p>${selected.area} · ${plan.effect}</p>${control}</article>
        ${action("Show all plans", 'data-construction="list"')}
        ${site.left === null ? action("Unpin plan", 'data-construction="unpin"') : ""}
        ${site.left === 0 && onsite ? action("Back to camp", 'data-construction="exit"') : ""}`;
    }
    const improvements = Object.keys(BUILDINGS).reduce((sum, k) => sum + Math.max(0, buildingLevel(state, k, true) - 1), 0);
    return `<p class="station-details">${finished}/${buildingCount} structures built${enabled("buildingLevels") ? ` · ${improvements}/${buildingCount * 2} upgrades` : ""}.
      Pin a plot to set aside what the plan still needs from automatic sales.</p>
      ${action("Buy equipment & hire helpers", 'data-construction="shop"')}${ledgerButton()}
      <div class="offer-list build-list">${Object.entries(BUILDINGS).map(([key, definition]) => {
        const owned = buildingLevel(state, key, true);
        const level = nextLevel(state, key);
        const plan = definition.levels[(level ?? owned) - 1];
        const left = level ? sitePhase(state, key, level).left : null;
        const status = !buildingEnabled(state, key) ? "Paused in Settings" : !level ? `Level ${owned} complete` :
          left !== null ? `Building level ${level}` : !unlocked(state, key, level) ?
          `After ${BUILDINGS[definition.after].name}` : `${plan.cash} coins + ${materialLine(plan.goods)}`;
        const buttonLabel = !level ? "View structure" : level > 1 ? `Level ${level} plan` : "Open plan";
        return `<article class="operation-card"><h3>${definition.name}</h3><p>${status}</p>
          <p>${plan.effect}</p>${action(buttonLabel, `data-build-plan="${key}"`)}</article>`;
      }).join("")}</div>`;
  }
  const ledgerButton = () => enabled("campBoard") ? action("Open camp board", 'data-ledger="open"') : "";
  function campBoard() {
    const plot = pinnedProject(state);
    const orders = marketTargets(state);
    const rows = Object.entries(PRICES).map(([good]) => {
      const needed = (plot?.needs[good] ?? 0) + bulkRemaining(state, good) + orders.reduce((n, target) => n + neededFor(target, good), 0);
      const stock = onHand(state, good);
      return `<tr><th scope="row">${NAMES[good]}</th><td>${stock}</td><td>${needed}</td><td>${Math.max(0, needed - stock)}</td></tr>`;
    }).join("");
    const station = (key, name) => action(`${name} · ${stationStatus(state, key)}`, `data-visit="${key}In"`);
    return `<p class="station-details">${state.cash} coins · ${state.sold} goods sold or shipped · ${state.market.completed} contracts finished</p>
      <table class="camp-stock"><thead><tr><th scope="col">Goods</th><th scope="col">On hand</th><th scope="col">Needed</th><th scope="col">To make</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="station-details">Needed includes enabled orders and the pinned construction phase. Goods on hand may still need hauling.</p>
      <div class="actions">${station("saw", "Sawmill")}${station("grill", "Grill")}${action("Walk to Market", 'data-visit="sell"')}
      ${plot ? action("Open pinned plan", 'data-ledger="plan"') : ""}${action("Close", 'data-ledger="close"')}</div>`;
  }
  function settingsControls() {
    return `<p class="station-details">Choose what you want in this save. Turning features off preserves purchases, materials, and unfinished work.</p>
      <div class="actions">${action("Simple camp", 'data-preset="simple"')}${action("Full camp", 'data-preset="all"')}${ledgerButton()}</div>
      <div class="feature-list">${Object.entries(FEATURES).map(([group, flags]) =>
        details("features-" + group, group, Object.entries(flags).map(([id, [label, description]]) =>
          `<label class="feature-choice"><span><strong>${label}</strong><small>${description}</small></span>
            <input type="checkbox" data-feature="${id}" ${enabled(id) ? "checked" : ""}></label>`).join(""))
      ).join("")}</div>`;
  }
  function updateUI() {
    const p = state.player,
      b = p.bag;
    $("cash").textContent = state.cash;
    $("buildMenu").setAttribute("aria-pressed", String(buildMenu));
    $("buildMenu").hidden = !enabled("construction");
    $("settingsMenu").setAttribute("aria-pressed", String(settingsMenu));
    for (const [key] of labels) SPOTS[key].el.hidden = !enabled("markers");
    plotMarker.hidden = !state.plan || !phaseEnabled(state, state.plan, state.planLevel) ||
      !unlocked(state, state.plan, state.planLevel) || sitePhase(state, state.plan, state.planLevel).left === 0;
    if (!plotMarker.hidden) {
      const planName = BUILDINGS[state.plan].name;
      const markerText = `${planName}<span>${sitePhase(state, state.plan, state.planLevel).left > 0 ? "Building" :
        state.planLevel === 1 ? "BUILD SITE" : `LEVEL ${state.planLevel} SITE`}</span>`;
      if (plotMarker.innerHTML !== markerText) plotMarker.innerHTML = markerText;
      positionPlotMarker();
    }
    $("bag").textContent = `${count(b)}/${capacity(state)}` +
      GOODS.filter(k => b[k]).map(k => ` · ${NAMES[k]} ${b[k]}`).join("");
    $("bagLabel").textContent = cartActive(state) ? "PACK + CART" : "BACKPACK";
    for (const key of Object.keys(LINES)) {
      const st = state.stations[key];
      SPOTS[key + "In"].el.lastElementChild.textContent = stationStatus(state, key);
      SPOTS[key + "Out"].el.lastElementChild.textContent =
        outputCount(st) === outputCapacity(state, key) ? "Output full" : `${outputCount(st)} ready`;
    }
    const current = marketTargets(state).find(t => t.id === "contract");
    SPOTS.sell.el.lastElementChild.textContent = current ? `Job ${current.part + 1}/${current.total}` :
      enabled("bulk") && state.order ? "Bulk order" : "Jobs & sales";
    const focus = $("jobStatus");
    focus.hidden = !current || !enabled("jobHud");
    if (current) {
      const remaining = Object.keys(current.goods).flatMap(k => neededFor(current, k) ? [[k, neededFor(current, k)]] : []);
      focus.textContent = `${current.name} · Need ${listedGoods(Object.fromEntries(remaining))}`;
    }
    $("saveStatus").textContent = saveError ? " · Save unavailable" : "";
    let title = "Choose a destination",
      content = "Gather logs and meat, process them, then sell the finished goods at the counter.",
      hint = "Walk to the forest or boars to gather.",
      icon = "✳";
    let station = Object.entries(SPOTS).find(([k, v]) => near(p, v));
    if (station) {
      let k = station[0];
      if (k === "forest" || k === "boars") {
        title = k === "forest" ? "Forest edge" : "Boar meadow";
        const raw = k === "forest" ? "logs" : "meat";
        const { remaining, regrow } = state.sources[k];
        const room = roomFor(state, p, raw);
        content = `<p>${remaining ? `${remaining}/${Math.max(remaining, sourceCapacity(state, k))} ready` : `Restocking in ${Math.ceil(regrow)}s`}</p>
          <div class="actions">${!enabled("autoGather") ? action(`Gather 1 ${raw === "logs" ? "log" : "meat"}`, `data-gather="${k}"`, !remaining || !room) : ""}
          ${action(`Return ${raw}`, `data-return="${raw}"`, !b[raw])}</div>`;
        hint = !room ? "Load full. Deliver goods or set them down at the improvement pad." : enabled("autoGather") ?
          "Stay nearby to gather." : "Gather by tapping the button.";
      } else if (k === "build") {
        title = "Camp improvements";
        icon = "⌂";
        hint = "Choose an improvement or set down your load.";
        content =
          '<div class="actions">' +
          (enabled("upgrades") ? Object.entries(UPGRADES) : [])
            .map(([key, u]) => {
              let l = state.levels[key];
              return `<button class="action" data-buy="${key}" ${l === 3 || state.cash < u.prices[l] ? "disabled" : ""}>${u.name} ${l === 3 ? "· MAX" : `<strong>· ${u.prices[l]} coins</strong><br>${u.values[l]} → ${u.values[l + 1]} ${u.unit}`}</button>`;
            })
            .join("") +
          (enabled("helpers") ? action(state.workers.length >= helperLimit(state) ? "Helpers · full roster" : `Hire helper · ${helperPrice(state)} coins`,
            'data-buy="helper"', state.workers.length >= helperLimit(state) || state.cash < helperPrice(state)) : "") +
          action(`Set down load (crate ${count(state.stash)}/${stashCapacity(state)})`, "data-stash", !count(b)) +
          (enabled("cart") ? action(state.cart ? "Handcart installed" : `Handcart · ${CART_PRICE} coins<br>Carry ${rackSlots(state, "mixed")} more goods`,
            'data-buy="cart"', state.cart || state.cash < CART_PRICE) : "") +
          GOODS.filter((g) => state.stash[g])
            .map(
              (g) =>
                `<button class="action" data-get="${g}" ${unavailable(roomFor(state, state.player, g) <= 0)}>Take ${NAMES[g]} (${state.stash[g]})</button>`,
            )
            .join("") +
          "</div>" +
          ledgerButton() + cartControls() + state.workers.map((w, i) => workerActive(state, i) ? helperControls(w, i) : "").join("");
      } else if (k === "sell") {
        title = "Market counter";
        content = marketControls(b);
        hint = "Take a job, pack an order, or sell your goods.";
      } else {
        const key = k.startsWith("saw") ? "saw" : "grill", st = state.stations[key];
        const [basic, premium] = LINES[key].goods;
        title = key === "saw" ? "Sawmill" : "Grill";
        content = `<p class="station-details"><strong>${stationStatus(state, key)}</strong> ·
          Input ${inputCount(state, key)}/${inputCapacity(state, key)} · Output ${outputCount(st)}/${outputCapacity(state, key)}
          ${st.output || st.premium ? `· ${st.output} ${NAMES[basic]}, ${st.premium} ${NAMES[premium]}` : ""}
          ${st.jobs.length ? `· ${st.jobs.map(job => NAMES[job.good]).join(" + ")} underway` : ""}</p>
          ${enabled("premium") ? `<div class="actions" aria-label="Next jobs">${recipeButtons(key, st)}</div>` : ""}
          ${stationControls(key, st, k.endsWith("In"))}`;
        hint = st.manual || !enabled("autoHandling") ? "Manual handling. Use the load controls." : k.endsWith("In")
          ? "Matching raw goods unload automatically."
          : "Finished goods fill your available load.";
      }
    }
    if (buildMenu && enabled("construction")) {
      title = "Camp construction";
      icon = "⌂";
      content = constructionControls();
      hint = "Deliver finished goods and fund a structure at its marked plot.";
    }
    if (settingsMenu) {
      title = "Settings";
      icon = "⚙";
      content = settingsControls();
      hint = "Your choices are saved with this camp.";
    }
    if (ledgerMenu && enabled("campBoard")) {
      title = "Camp board";
      icon = "▦";
      content = campBoard();
      hint = "Check what is on hand and what still needs making.";
    }
    $("hint").textContent = hint;
    $("panelTitle").textContent = title;
    $("panelIcon").textContent = icon;
    if (content !== lastPanel) {
      const panel = $("panelContent");
      const samePlace = panel.dataset.title === title;
      const opened = samePlace ? [...panel.querySelectorAll("details[open]")].map(el => el.dataset.section) : [];
      const focused = samePlace && panel.contains(document.activeElement) ? document.activeElement : null;
      const panelScroll = $("panel");
      const scrollTop = samePlace ? panelScroll.scrollTop : 0;
      panel.innerHTML = content;
      panel.dataset.title = title;
      for (const section of panel.querySelectorAll("details")) section.open = opened.includes(section.dataset.section);
      if (focused) {
        const original = JSON.stringify({ ...focused.dataset });
        const replacement = [...panel.querySelectorAll(focused.tagName)].find(el =>
          JSON.stringify({ ...el.dataset }) === original && el.parentElement?.dataset.section === focused.parentElement?.dataset.section && !el.disabled);
        replacement?.focus({ preventScroll: true });
      }
      panelScroll.scrollTop = scrollTop;
      lastPanel = content;
    }
  }
  $("jobStatus").onclick = () => { buildMenu = false; settingsMenu = false; ledgerMenu = false; destination = { ...SPOTS.sell }; updateUI(); };
  $("settingsMenu").onclick = () => { settingsMenu = !settingsMenu; buildMenu = false; ledgerMenu = false; updateUI(); };
  $("buildMenu").onclick = () => { settingsMenu = false; ledgerMenu = false; buildMenu = !buildMenu; catalog = false; inspectedBuild = null; updateUI(); };
  $("panelContent").addEventListener("click", (e) => {
    let t = e.target.closest("button");
    if (!t) return;
    if (t.dataset.ledger === "open") { ledgerMenu = true; settingsMenu = false; buildMenu = false; }
    if (t.dataset.ledger === "close") ledgerMenu = false;
    if (t.dataset.ledger === "plan") { ledgerMenu = false; buildMenu = true; catalog = false; inspectedBuild = null; }
    if (Object.hasOwn(SPOTS, t.dataset.visit)) { ledgerMenu = false; destination = SPOTS[t.dataset.visit]; }
    if (t.dataset.preset && featurePreset(state, t.dataset.preset)) {
      setGraphicsQuality();
      resize();
    }
    if (t.dataset.gather) gatherNow(state, t.dataset.gather);
    if (t.dataset.buildPlan) {
      inspectedBuild = trackPlan(state, t.dataset.buildPlan) ? null : t.dataset.buildPlan;
      catalog = false;
    }
    if (t.dataset.construction === "list") { catalog = true; inspectedBuild = null; }
    if (t.dataset.construction === "unpin") { trackPlan(state, null); catalog = true; }
    if (t.dataset.construction === "walk" && state.plan) destination = BUILDINGS[state.plan];
    if (t.dataset.construction === "exit") buildMenu = false;
    if (t.dataset.construction === "shop") { buildMenu = false; destination = SPOTS.build; }
    if (t.dataset.construction === "supply" || t.dataset.construction === "build")
      buildAtPlot(state, state.plan, t.dataset.construction, state.planLevel);
    if (t.dataset.buildPlan || t.dataset.construction === "list" || t.dataset.construction === "unpin") $("panel").scrollTop = 0;
    if (t.dataset.buy) purchase(state, t.dataset.buy);
    if (t.hasAttribute("data-stash")) stashAll(state);
    if (t.dataset.get) retrieve(state, t.dataset.get);
    if (t.dataset.return) returnRaw(state, t.dataset.return);
    if (t.dataset.job) assign(state, +t.dataset.worker, t.dataset.job);
    if (t.dataset.recipe) selectRecipe(state, t.dataset.station, t.dataset.recipe);
    if (t.dataset.install) install(state, t.dataset.station, t.dataset.install);
    if (t.dataset.merchant) buySupplies(state, t.dataset.merchant, t.dataset.fill === "true");
    if (t.dataset.market) marketAction(state, t.dataset.market, t.dataset.id);
    if (t.dataset.cartRack) cartRack(state, t.dataset.cartRack);
    if (t.dataset.project) buildProject(state, t.dataset.project, t.dataset.station);
    if (t.dataset.load) handleLoad(state, t.dataset.station, t.dataset.load);
    if (t.dataset.sort) sortTimber(state, Number(t.dataset.sort));
    if (t.dataset.bulk === "accept") acceptBulk(state);
    if (t.dataset.bulk === "deliver") deliverBulk(state);
    if (t.dataset.bulk === "cancel") cancelBulk(state);
    lastPanel = "";
    updateUI();
    save();
  });
  $("panelContent").addEventListener("change", e => {
    const { dataset: d, value } = e.target;
    const converted = value === "true" || value === "false" ? value === "true" : /^\d+$/.test(value) ? Number(value) : value;
    if (d.feature) {
      setFeature(state, d.feature, e.target.checked);
      if (d.feature === "battery") { setGraphicsQuality(); resize(); }
    }
    else if (d.route) setWorkerRoute(state, Number(d.worker), d.route, converted);
    else if (d.stationField) setStation(state, d.station, d.stationField, converted);
    else return;
    lastPanel = "";
    updateUI();
    save();
  });
  let last = performance.now(),
    acc = 0,
    ui = 0,
    saveTimer = 0,
    raf = 0,
    lastSold = state.sold,
    customerReaction = 0;
  function pose(model, person, now) {
    const dx = person.x - model.g.position.x, dz = person.z - model.g.position.z;
    const walking = Math.hypot(dx, dz) > .001;
    const work = enabled("animation") ? activity(person) : null;
    // The fixed simulation advances every 100ms; keep the stride between those frames.
    if (walking) {
      model.g.rotation.y = Math.atan2(dx, dz);
      model.lastStep = now;
    }
    const stride = enabled("animation") && now - model.lastStep < 135 ? Math.sin(now / 78) * .43 : 0;
    model.l.rotation.x = stride;
    model.r.rotation.x = -stride;
    model.g.position.set(person.x, 0, person.z);
    model.axe.visible = work?.kind === "chop";
    model.carried.visible = !!work && ["load", "stack", "gather"].includes(work.kind);
    let reach = 0;
    if (work) {
      if (work.kind === "chop" || work.kind === "gather") {
        const source = work.kind === "chop" ? SPOTS.forest : SPOTS.boars;
        model.g.rotation.y = Math.atan2(source.x - person.x, source.z - person.z);
      }
      const phase = 1 - work.left / work.duration;
      reach = Math.sin(phase * Math.PI);
      model.carried.material = mat(goodsColors[work.good]);
      model.carried.position.y = .62 + reach * .56;
    }
    model.arms[0].rotation.x = -reach * .9 - stride * .6;
    model.arms[1].rotation.x = -reach * (model.axe.visible ? 2.9 : 1.4) + stride * .6;
    const firstGood = GOODS.find(k => person.bag[k]);
    const amount = count(person.bag);
    for (const [i, item] of model.load.entries()) {
      item.visible = i < amount;
      if (firstGood) item.material = mat(goodsColors[firstGood]);
    }
  }
  function drawCamp(now) {
    pose(player, state.player, now);
    workerModels.forEach((model, i) => {
      model.g.visible = workerActive(state, i);
      if (model.g.visible) pose(model, state.workers[i], now);
    });
    if (cartActive(state)) {
      const heading = player.g.rotation.y;
      const p = state.player;
      cart.position.set(p.x - 1.7 * Math.sin(heading), 0, p.z - 1.7 * Math.cos(heading));
      cart.rotation.y = heading;
      const load = cartLoad(state);
      for (const rail of rackRails) {
        rail.visible = activeRack(state) !== "mixed";
        rail.material = mat(activeRack(state) === "timber" ? 0xa26d47 : 0x39766e);
      }
      cartGoods.forEach((item, i) => {
        item.visible = i < load.length;
        if (item.visible) item.material = mat(goodsColors[load[i]]);
      });
    }
    cart.visible = cartActive(state);
    for (const [id, model] of Object.entries(structures)) {
      const { left, delivered } = state.construction[id];
      model.site.visible = buildingEnabled(state, id) && (left !== null || state.plan === id && unlocked(state, id) || Object.values(delivered).some(Boolean));
      model.base.visible = left !== null || Object.values(delivered).some(Boolean);
      const next = nextLevel(state, id);
      const upgrading = next && next > 1 && sitePhase(state, id, next).left > 0;
      model.stakes.visible = left !== 0 || !!upgrading;
      model.shell.visible = left !== null;
      model.shell.scale.y = left === null ? 1 : .38 + .62 * (1 - left / BUILDINGS[id].levels[0].seconds);
      const finished = buildingLevel(state, id);
      for (const [i, addition] of model.addOns.entries()) addition.visible = finished >= i + 2;
    }
    bay.visible = enabled("loadingBay") && state.market.bay;
    const active = marketTargets(state).find(t => t.id === "contract");
    const packed = active ? Object.values(active.packed).reduce((sum, n) => sum + n, 0) : 0;
    packedCrates.forEach((crate, i) => { crate.visible = i < Math.ceil(packed / 3); });
    for (const [key, kit] of Object.entries(fixtures)) {
      const st = state.stations[key];
      for (const part of Object.keys(EQUIPMENT)) kit[part].visible = enabled("equipment") && st.equipment === part;
      kit.supply.visible = enabled("stationProjects") && st.bin || st.staging > 0;
      kit.staged.forEach((item, i) => { item.visible = i < st.staging; });
      kit.rebuild.visible = enabled("stationProjects") && !!st.layout;
      if (st.layout) kit.beam.material = mat({ fast: 0xbe8c37, finish: 0x567da0, freight: 0x508e77 }[st.layout]);
      if (enabled("animation") && kit.blade && st.jobs.length > 1) kit.blade.rotateY(.13);
      if (kit.flame) kit.flame.visible = st.jobs.length > 1;
    }
    if (enabled("animation") && state.stations.saw.jobs.length) blade.rotateY(.13);
    fire.visible = state.stations.grill.jobs.length > 0;
    for (const { key, input, line, items } of piles) {
      const st = state.stations[key];
      for (const [i, item] of items.entries()) {
        item.visible = i < (input ? st.input : outputCount(st));
        if (item.visible) item.material = mat(goodsColors[input ? line.raw : line.goods[Number(i >= st.output)]]);
      }
    }
  }
  function stopLoop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }
  function startLoop() {
    last = performance.now();
    if (!raf && !paused && !document.hidden) raf = requestAnimationFrame(loop);
  }
  function loop(now) {
    raf = 0;
    if (document.hidden || paused) return;
    raf = requestAnimationFrame(loop);
    let dt = Math.min(0.1, (now - last) / 1000);
    if (now - last < 1000 / (enabled("battery") ? 20 : 30)) return;
    last = now;
    acc += dt;
    while (acc >= 0.1) {
      let dx = joy.x + (keys.d || keys.ArrowRight ? 1 : 0) - (keys.a || keys.ArrowLeft ? 1 : 0),
        dz = joy.z + (keys.s || keys.ArrowDown ? 1 : 0) - (keys.w || keys.ArrowUp ? 1 : 0);
      if (!dx && !dz && destination) {
        dx = destination.x - state.player.x;
        dz = destination.z - state.player.z;
        if (Math.hypot(dx, dz) < 0.25) {
          destination = null;
          dx = dz = 0;
        }
      }
      let d = Math.hypot(dx, dz);
      if (d) {
        let step = Math.min(0.38, d);
        state.player.x = Math.max(-10.7, Math.min(10.7, state.player.x + (dx / d) * step));
        state.player.z = Math.max(-10.7, Math.min(10.7, state.player.z + (dz / d) * step));
      }
      tick(state, 0.1);
      acc -= 0.1;
    }
    syncWorkers();
    drawCamp(now);
    if (state.sold !== lastSold) {
      lastSold = state.sold;
      customerReaction = 1;
    }
    customerReaction = Math.max(0, customerReaction - dt);
    customers[0].g.position.y = enabled("animation") ? Math.sin(customerReaction * Math.PI) * 0.35 : 0;
    boarModels.forEach((m, i) => {
      m.visible = state.sources.boars.remaining > i * 3;
    });
    forestTrees.forEach((m, i) => {
      m.visible = state.sources.forest.remaining > i * 1.5;
    });
    renderer.render(scene, camera);
    ui += dt;
    saveTimer += dt;
    if (ui > 0.25) {
      updateUI();
      ui = 0;
    }
    if (saveTimer > 3) {
      save();
      saveTimer = 0;
    }
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      save();
      stopLoop();
    } else startLoop();
  });
  window.addEventListener("pagehide", () => {
    save();
    stopLoop();
  });
  updateUI();
  startLoop();
}
