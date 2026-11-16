import {
  LOCATIONS, TICKS_PER_SECOND, DAY, ROLES, RESOURCES, SHIFTS, PROJECTS, ORDERS,
  tick, dayNumber, condition, describeSite, setRole, setShift, setPolicy, projectAvailable,
  queueProject, buyServiceParts, requestRepair, acceptOrder,
} from './engine.mjs';
import { createWorld } from './world.mjs';
import { SAVE_KEY, exportSave, parseSave, loadGame, writeSave, previousSave, hasClassicSave, importClassic } from './save.mjs';

const $ = id => document.getElementById(id);
const panel = $('panel');
const canvas = $('settlement');
const storage = {
  getItem: key => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
};
const preference = key => {
  try { return storage.getItem('frostfall-works-' + key); } catch { return null; }
};
const setPreference = (key, value) => {
  try { storage.setItem('frostfall-works-' + key, value); } catch { /* gameplay continues with the current preference */ }
};
const first = loadGame(storage);
let state = first.state;
let message = first.message;
let blocked = first.blocked ?? false;
let saveWarning = blocked;
let saveRevision = 0;
let writtenRevision = 0;
let lastSaveAt = performance.now();
let view = 'operations';
let selected = null;
let confirmAction = '';
let currentMarkup = '';
const firstClassic = state.tick === 0 && hasClassicSave(storage);
let speed = blocked || firstClassic ? 0 : 1;
const phone = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
const lowPower = preference('graphics') === 'battery' || (phone && preference('graphics') !== 'smooth');
let world = null;
let simulationTimer = null;
let renderTimer = null;
let renderFrame = null;
let nextTickAt = 0;
let nextRenderAt = 0;
let lastTickAt = 0;
let lastRenderAt = 0;
let lastHudAt = 0;

const disabled = b => b ? ' disabled' : '';
const pressed = b => String(b);
const cash = n => '$' + n;
const metric = (label, value) => `<div><dt>${label}</dt><dd>${value}</dd></div>`;
const options = (entries, chosen) => Object.entries(entries).map(([value, label]) =>
  `<option value="${value}"${String(chosen) === value ? ' selected' : ''}>${label}</option>`).join('');
const control = (label, type, id, entries, chosen) =>
  `<label class="setting"><span>${label}</span><select data-${type}="${id}">${options(entries, chosen)}</select></label>`;
const button = (action, label, id = '', locked = false, secondary = false) =>
  `<button type="button" class="action${secondary ? ' secondary' : ''}" data-action="${action}" data-id="${id}"${disabled(locked)}>${label}</button>`;

function taskLabel(w) {
  const t = w.task;
  if (!t) return 'Available';
  const location = LOCATIONS[t.to].name;
  if (t.kind === 'haul') {
    const resource = RESOURCES[t.resource].toLowerCase();
    return t.stage === 'pickup' ? `Picking up ${t.amount} ${resource} at ${LOCATIONS[t.from].name}` :
      `Carrying ${t.amount} ${resource} to ${location}`;
  }
  if (t.kind === 'repair') return t.stage === 'pickup' ? `Collecting a repair plank for ${location}` : `Servicing ${location}`;
  if (t.kind === 'project') return `Building ${PROJECTS[t.project].name.toLowerCase()}`;
  if (t.kind === 'harvest') return t.to === 'farm' ? 'Harvesting crops' : 'Felling timber';
  return t.to === 'kitchen' ? 'Cooking a batch of meals' : 'Milling a batch of planks';
}

function siteInspector(id) {
  const detail = describeSite(state, id);
  const { level, wear, ready, shift, repair } = state.sites[id];
  const equipment = id === 'kitchen' || id === 'mill';
  const workers = state.workers.filter(w => w.task?.to === id || w.task?.from === id && w.task.stage === 'pickup');
  return `<article class="box" id="site-inspector">
    <div class="inline"><h3>${LOCATIONS[id].name}</h3>${button('close-inspect', 'Close', '', false, true)}</div>
    <p class="note${wear >= 100 ? ' alert-text' : ''}">${detail.reason}</p>
    <dl class="stock-list">${Object.entries(detail.stock).map(([r, v]) =>
      metric(RESOURCES[r], `${v.amount}/${v.capacity}${v.incoming ? ` <small>+${v.incoming} incoming</small>` : ''}${v.allocated ? ` <small>· ${v.allocated} reserved</small>` : ''}`)).join('')}
      ${id === 'farm' ? metric('Crops ready', ready) : id === 'forest' ? metric('Timber regrowth', ready + '/24') : ''}
      ${equipment ? metric('Workstations', level) + metric('Equipment wear', Math.round(wear) + '%') : ''}</dl>
    ${id === 'kitchen' ? '<p class="note">Each batch turns two crops and one fuel log into five meals.</p>' :
      id === 'mill' ? '<p class="note">Each batch turns two logs into three planks.</p>' : ''}
    ${equipment ? `<div class="stack">${control('Production schedule', 'shift', id, SHIFTS, shift)}
      <div class="buttons">${button('repair', repair ? 'Service requested' : 'Request service', id, repair || wear < 25, true)}</div></div>` : ''}
    ${id === 'depot' ? `<p class="note">Each service job uses one warehouse plank.</p>
      ${button('parts', 'Buy 2 repair planks · $12', '', state.cash < 12 || state.sites.depot.stock.planks > 1, true)}` : ''}
    ${workers.length ? `<p class="note">Assigned here · ${workers.map(w => w.name).join(', ')}</p>` : ''}
  </article>`;
}

function topIssue() {
  if (saveWarning) return ['Save needs attention', message, '', 'saves'];
  if (firstClassic && state.tick === 0) return ['Classic supplies available', 'Import starter stock from Saves or start with 1×.', '', 'saves'];
  const hall = state.sites.hall.stock.meals;
  const demand = condition(state).demand;
  if (hall < demand) return ['Dining hall is short', 'Check meal deliveries, kitchen fuel, and hauling assignments.', 'hall'];
  for (const id of ['kitchen', 'mill']) {
    const { wear, stock } = state.sites[id];
    if (wear >= 100) return [LOCATIONS[id].name + ' is stopped', 'Assign service staff and keep a plank in the warehouse.', id];
    if (Object.entries(describeSite(state, id).stock).some(([r, v]) => (r === 'meals' || r === 'planks') && stock[r] >= v.capacity - 2)) {
      return [LOCATIONS[id].name + ' output is backing up', 'Check warehouse room and haul capacity.', id];
    }
  }
  if (state.sites.depot.stock.planks >= describeSite(state, 'depot').stock.planks.capacity - 3) {
    return ['Warehouse plank rack is filling', 'Allocate planks to a project or take a timber order.', 'depot'];
  }
  return [condition(state).label, condition(state).note, ''];
}
function runMetrics(data, caption) {
  if (!data) return '';
  return `<article class="box"><h3>${caption}</h3><dl class="metric-list">
    ${metric('Meals served', `${data.served} / ${data.demand}`)}
    ${metric('Meals cooked / planks milled', `${data.meals} / ${data.planks}`)}
    ${metric('Units hauled', data.hauled)}
    ${metric('Crops or meals spoiled', data.spoiled)}
    ${metric('Maintenance jobs', data.repairs)}
  </dl></article>`;
}
function operations() {
  const last = state.history.at(-1);
  return `<h2>Production</h2><p class="note">Select a site on the map or below to inspect stock and work.</p>
    ${selected?.type === 'site' ? siteInspector(selected.id) : ''}
    <div class="grid">${Object.entries(LOCATIONS).map(([id, site]) => `<button type="button" class="tile" data-site="${id}"
      aria-pressed="${pressed(selected?.id === id && selected.type === 'site')}"><strong>${site.name}</strong>
      <small>${describeSite(state, id).reason}</small></button>`).join('')}</div>
    <article class="box"><h3>Dispatch and production</h3><div class="stack">
      ${control('Haul priority', 'policy', 'priority', { balanced: 'Balanced', food: 'Food first', timber: 'Timber first' }, state.policy.priority)}
      ${control('Cart dispatch', 'policy', 'loads', { responsive: 'Send partial loads', full: 'Prefer full loads' }, state.policy.loads)}
      ${control('Kitchen meal target', 'policy', 'kitchenReserve', { 12: '12 in the pipeline', 20: '20 in the pipeline', 30: '30 in the pipeline' }, state.policy.kitchenReserve)}
      ${control('Kitchen fuel reserve', 'policy', 'fuelReserve', { 0: 'None', 2: '2 warehouse logs', 4: '4 warehouse logs' }, state.policy.fuelReserve)}
      ${control('Service at wear', 'policy', 'maintenance', { early: '35% · Early', normal: '58% · Normal', late: '80% · Late' }, state.policy.maintenance)}
    </div></article>
    ${runMetrics(state.day, 'Today')}
    ${runMetrics(last, 'Previous day')}
    <article class="box"><h3>Resource flow</h3><p class="note">The farm supplies the kitchen. The forest supplies the warehouse, which sends logs to both the kitchen and sawmill. Meals leave the kitchen through the warehouse for the dining hall. The mill returns planks to the warehouse for repairs, projects and orders.</p></article>`;
}
function crew() {
  const w = selected?.type === 'worker' ? state.workers.find(worker => worker.id === selected.id) : null;
  return `<h2>Crew</h2><p class="note">Crew members finish their current task before following a new assignment.</p>
    ${w ? `<article class="box" id="worker-inspector"><div class="inline"><h3>${w.name}</h3>${button('close-inspect', 'Close', '', false, true)}</div>
      <p class="note">${taskLabel(w)}</p><dl class="metric-list">${metric('Specialty', ROLES[w.skill])}</dl>
      ${control('Assignment', 'role', w.id, ROLES, w.role)}</article>` : ''}
    <div class="grid">${state.workers.map(worker => `<button type="button" class="tile" data-worker="${worker.id}"
      aria-pressed="${pressed(w?.id === worker.id)}"><strong>${worker.name} · ${ROLES[worker.role]}</strong>
      <small>${taskLabel(worker)}</small></button>`).join('')}</div>`;
}
function projects() {
  const list = Object.entries(PROJECTS).map(([id, p]) => {
    const status = state.projects[id];
    return `<article class="box"><h3>${p.name}</h3><p class="note">${p.effect}</p>
      ${status.complete ? '<span class="cost">In use</span>' : status.queued ?
        `<progress value="${status.progress}" max="${p.work}" aria-label="${p.name} construction"></progress>
          <span class="cost">${status.progress ? 'Under construction' : 'Waiting for service crew'}</span>` :
        `<div class="inline"><span class="cost">${p.planks} planks · ${cash(p.cash)}</span>
          ${button('project', 'Start project', id, !projectAvailable(state, id))}</div>`}</article>`;
  }).join('');
  const orderInfo = state.order ? ORDERS[state.order.id] : null;
  const orders = orderInfo ? `<article class="box"><h3>${orderInfo.name}</h3><p class="note">
    ${orderInfo.amount} ${RESOURCES[orderInfo.resource].toLowerCase()} · ${cash(orderInfo.reward)} ·
    ${Math.ceil((state.order.due - state.tick) / TICKS_PER_SECOND)}s left. Ships automatically when reserves are met.</p>
    <p class="note">Warehouse stock ${state.sites.depot.stock[orderInfo.resource]} / ${orderInfo.amount + orderInfo.reserve} including reserve.</p></article>`
    : Object.entries(ORDERS).map(([id, o]) => `<article class="box"><h3>${o.name}</h3>
      <div class="inline"><span class="cost">${o.amount} ${RESOURCES[o.resource].toLowerCase()} · ${cash(o.reward)} · ${o.days} days</span>
      ${button('order', 'Accept order', id, false, true)}</div></article>`).join('');
  return `<h2>Camp projects</h2><p class="note">Projects use cash, planks, and service crew time. Two warehouse planks are set aside for repairs when you start a build.</p>
    ${list}<h2 class="subheading">Export orders</h2>
    <p class="note">Exports draw from the warehouse after local reserves. One order at a time.</p>
    ${state.lastOrder ? `<p class="note">Previous order · ${ORDERS[state.lastOrder.id].name} · ${state.lastOrder.delivered ? 'Shipped' : 'Expired'}</p>` : ''}
    ${orders}`;
}
const canImportClassic = () => hasClassicSave(storage) &&
  (blocked || state.tick < DAY && !state.order && !state.lastOrder && Object.values(state.projects).every(p => !p.queued && !p.complete));

function saves() {
  let previous = null;
  try { previous = previousSave(storage); } catch { /* storage status is reported on save */ }
  const restore = confirmAction === 'restore';
  const classic = confirmAction === 'classic';
  return `<h2>Save &amp; display</h2>
    <p class="note">Progress saves to this browser every 15 seconds while playing. Export a copy to move it between browsers.</p>
    <p id="save-status" class="note${blocked ? ' alert-text' : ''}" role="status">${message}</p>
    <div class="buttons">
      ${button('save', 'Save now', '', blocked)}
      ${button('restore', restore ? 'Confirm checkpoint restore' : 'Restore checkpoint', '', !previous, true)}
    </div>
    ${restore && previous ? `<p class="note">Restore Day ${dayNumber(previous)} at ${clock(previous)}?</p>` : ''}
    <article class="box"><h3>Backup file</h3>
      <label for="backup" class="note">Paste an exported operations save to import it.</label>
      <textarea id="backup" rows="3" spellcheck="false"></textarea>
      <div class="buttons">
        ${button('export', 'Export save', '', false, true)}
        ${button('import', 'Import pasted save', '', false, true)}
      </div></article>
    <article class="box"><h3>Graphics</h3>
      <p class="note">Battery saver caps the map at 24 FPS and lowers render resolution. Standard caps it at 36 FPS.</p>
      ${button('graphics', lowPower ? 'Battery saver is on · Switch to standard' : 'Standard is on · Switch to battery saver', '', false, true)}
    </article>
    <article class="box"><h3>Classic Kitchen &amp; Mill</h3>
      <p class="note">Open the original camp and its save on this browser.</p>
      <a href="/classic/">Open classic game</a>
      ${canImportClassic() ?
        `<p class="note">Use your classic treasury (up to $250), mill logs, fuel and planks as starter supplies for a new operations camp.</p>
        ${button('classic', classic ? 'Confirm classic import' : 'Import classic supplies', '', false, true)}` : ''}
    </article>`;
}
const panels = { operations, crew, projects, saves };

function clock(s) {
  const minutes = Math.floor((s.tick % DAY) / DAY * 24 * 60);
  return String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');
}
function setText(id, text) {
  const e = $(id);
  if (e.textContent !== text) e.textContent = text;
}
function renderPanel(force = false) {
  if (!force && (view === 'saves' || panel.contains(document.activeElement) && document.activeElement.tagName === 'SELECT')) return;
  const markup = panels[view]();
  if (currentMarkup === markup && panel.firstElementChild) return;
  const focused = document.activeElement;
  const retainFocus = focused.tagName === 'BUTTON' && panel.contains(focused) ? focused.outerHTML : '';
  currentMarkup = markup;
  panel.innerHTML = markup;
  if (retainFocus) [...panel.querySelectorAll('button')].find(b => b.outerHTML === retainFocus)?.focus({ preventScroll: true });
}
function hud(force = false) {
  const day = dayNumber(state);
  setText('season', condition(state).label);
  setText('map-time', `Day ${day} · ${clock(state)}`);
  setText('meal-stock', String(state.sites.hall.stock.meals));
  setText('plank-stock', String(state.sites.depot.stock.planks));
  setText('cash', cash(state.cash));
  const [title, note, site, tab] = topIssue();
  const situation = $('situation');
  const link = site ? ` <button class="link-button" type="button" data-site="${site}">Inspect</button>` :
    tab ? ` <button class="link-button" type="button" data-view="${tab}">Open Saves</button>` : '';
  const content = `<strong>${title}</strong> ${note}${link}`;
  if (situation.dataset.content !== content) {
    situation.dataset.content = content;
    situation.innerHTML = content;
  }
  renderPanel(force);
}
function changeView(next) {
  view = next;
  currentMarkup = '';
  confirmAction = '';
  for (const tab of document.querySelectorAll('nav [data-view]')) {
    if (tab.dataset.view === next) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  }
  hud(true);
  panel.scrollTop = 0;
}
function select(target) {
  selected = target;
  world?.select?.(target);
  if (target) changeView(target.type === 'site' ? 'operations' : 'crew');
  else hud(true);
  drawStill();
}

function save(announce = false) {
  if (blocked) return;
  if (writtenRevision === saveRevision && !announce) return;
  try {
    if (writtenRevision !== saveRevision || announce && !storage.getItem(SAVE_KEY)) writeSave(storage, state);
    writtenRevision = saveRevision;
    if (announce || message) report('Progress saved.');
    const restore = panel.querySelector('[data-action="restore"]');
    if (restore?.disabled && previousSave(storage)) restore.disabled = false;
  } catch {
    report('Progress could not be saved in this browser. Export a backup.', true);
  }
  lastSaveAt = performance.now();
}
function report(text, warning = false) {
  message = text;
  saveWarning = warning;
  const e = $('save-status');
  if (e) {
    e.textContent = text;
    e.classList.toggle('alert-text', warning);
  }
}
function replaceState(next, text) {
  state = next;
  blocked = false;
  saveRevision += 1;
  confirmAction = '';
  setSpeed(0);
  save();
  report(text);
  hud(true);
  drawStill();
}
function handleAction(action, id) {
  if (action === 'close-inspect') { select(null); return; }
  if (action === 'save') { save(true); hud(); return; }
  if (action === 'restore' || action === 'classic') {
    if (action === 'classic' && !canImportClassic()) { report('Classic supplies can be imported only before starting a project or reaching Day 2.', true); return; }
    if (confirmAction !== action) { confirmAction = action; hud(true); return; }
    let restored = null;
    try { restored = action === 'restore' ? previousSave(storage) : importClassic(storage); } catch { /* report below */ }
    if (restored) replaceState(restored, action === 'restore' ? 'Previous checkpoint restored.' : 'Classic starter supplies imported.');
    else report('This save is unavailable.', true);
    return;
  }
  if (action === 'export') {
    const data = exportSave(state);
    const field = $('backup');
    field.value = data;
    field.select();
    const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `frostfall-day-${dayNumber(state)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    report('Backup exported. You can also copy it from the text field.');
    return;
  }
  if (action === 'import') {
    const imported = parseSave($('backup').value.trim());
    if (imported) replaceState(imported, 'Operations backup restored.');
    else report('This text is not a valid operations backup.', true);
    return;
  }
  if (action === 'graphics') {
    setPreference('graphics', lowPower ? 'smooth' : 'battery');
    save();
    location.reload();
    return;
  }
  const apply = { repair: requestRepair, project: queueProject, parts: buyServiceParts, order: acceptOrder }[action];
  if (apply?.(state, id)) {
    saveRevision += 1;
    hud(true);
    drawStill();
  }
}
document.addEventListener('click', event => {
  const target = event.target.closest('button');
  if (!target) return;
  const { action, id, speed: playback, view: next, site, worker } = target.dataset;
  if (playback !== undefined) setSpeed(Number(playback));
  if (next) changeView(next);
  if (site) select({ type: 'site', id: site });
  if (worker) select({ type: 'worker', id: worker });
  if (action) handleAction(action, id);
});
panel.addEventListener('change', event => {
  const { policy, role, shift } = event.target.dataset;
  const value = event.target.value;
  const changed = policy ? setPolicy(state, policy, ['kitchenReserve', 'fuelReserve'].includes(policy) ? Number(value) : value)
    : role ? setRole(state, role, value) : shift ? setShift(state, shift, value) : false;
  if (changed) {
    saveRevision += 1;
    if (speed === 0) save();
  }
});
panel.addEventListener('focusout', () => { if (view !== 'saves') setTimeout(() => renderPanel(), 0); });

function drawStill() {
  if (!world || document.hidden || speed) return;
  world.render(state, 1, 0);
}
const tickMs = () => 1000 / (TICKS_PER_SECOND * speed);
const frameMs = 1000 / (lowPower ? 24 : 36);
function scheduleSimulation(delay = tickMs()) {
  simulationTimer = setTimeout(runSimulation, Math.max(0, delay));
}
function runSimulation() {
  simulationTimer = null;
  if (!speed || document.hidden) return;
  const at = performance.now();
  const interval = tickMs();
  let iterations = 0;
  while (at + 1 >= nextTickAt && iterations < TICKS_PER_SECOND * speed) {
    tick(state);
    saveRevision += 1;
    lastTickAt = nextTickAt;
    nextTickAt += interval;
    iterations += 1;
  }
  if (at >= nextTickAt) nextTickAt = at + interval;
  if (at - lastHudAt >= 800) { hud(); lastHudAt = at; }
  if (at - lastSaveAt >= 15000) save();
  scheduleSimulation(nextTickAt - performance.now());
}
function scheduleRender(delay = 0) {
  renderTimer = setTimeout(() => {
    renderTimer = null;
    renderFrame = requestAnimationFrame(render);
  }, delay);
}
function render(at) {
  renderFrame = null;
  if (!world || !speed || document.hidden) return;
  if (at + .6 >= nextRenderAt) {
    const alpha = Math.max(0, Math.min(1, (at - lastTickAt) / tickMs()));
    world.render(state, alpha, Math.min(.12, Math.max(0, (at - lastRenderAt) / 1000)));
    lastRenderAt = at;
    nextRenderAt += frameMs * (1 + Math.max(0, Math.floor((at - nextRenderAt) / frameMs)));
  }
  scheduleRender(Math.max(0, nextRenderAt - performance.now() - 5));
}
function stop() {
  clearTimeout(simulationTimer);
  clearTimeout(renderTimer);
  if (renderFrame !== null) cancelAnimationFrame(renderFrame);
  simulationTimer = renderTimer = renderFrame = null;
}
function start() {
  if (!speed || document.hidden || simulationTimer !== null) return;
  const now = performance.now();
  lastTickAt = lastRenderAt = nextRenderAt = now;
  nextTickAt = now + tickMs();
  scheduleSimulation();
  if (world) scheduleRender();
}
function setSpeed(value) {
  if (value === speed) return;
  stop();
  speed = value;
  for (const b of document.querySelectorAll('[data-speed]')) b.setAttribute('aria-pressed', pressed(Number(b.dataset.speed) === speed));
  if (!speed) { save(); hud(true); drawStill(); }
  start();
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { stop(); save(); }
  else { start(); drawStill(); }
});
window.addEventListener('pagehide', () => { stop(); save(); });
window.addEventListener('pageshow', () => { start(); drawStill(); });
try {
  world = createWorld(canvas, { onSelect: select, lowPower, locations: LOCATIONS });
  new ResizeObserver(() => {
    world.resize();
    if (!document.hidden) world.render(state, 1, 0);
  }).observe(canvas);
} catch (error) {
  console.warn('Frostfall graphics unavailable', error);
  $('map-error').hidden = false;
}
for (const b of document.querySelectorAll('[data-speed]')) b.setAttribute('aria-pressed', pressed(Number(b.dataset.speed) === speed));
if (blocked) changeView('saves');
else hud();
drawStill();
start();
