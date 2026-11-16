import { CAPACITY, createState, validState, VERSION } from './engine.mjs';

export const SAVE_KEY = 'frostfall-kitchen-operations';
const PREVIOUS = SAVE_KEY + '-previous';
const CLASSIC = 'frostfall-kitchen-mill-v1';
const SAVE_LIMIT = 90000;

export function exportSave(state) {
  return JSON.stringify({ game: SAVE_KEY, version: VERSION, state });
}
export function parseSave(raw) {
  if (typeof raw !== 'string' || !raw || raw.length > SAVE_LIMIT) return null;
  try {
    const data = JSON.parse(raw);
    return data?.game === SAVE_KEY && data.version === VERSION && validState(data.state) ? data.state : null;
  } catch {
    return null;
  }
}
export function loadGame(storage) {
  try {
    const raw = storage.getItem(SAVE_KEY);
    const current = parseSave(raw);
    if (current) return { state: current, message: '' };
    const backup = previousSave(storage);
    if (backup) return { state: backup, message: 'Recovered the previous checkpoint.' };
    if (raw) return { state: createState(), message: 'The saved settlement could not be read. Import a backup to recover progress.', blocked: true };
    return { state: createState(), message: '' };
  } catch {
    return { state: createState(), message: 'Browser storage is unavailable. Export a save to keep your progress.', blocked: true };
  }
}
export function writeSave(storage, state) {
  const old = storage.getItem(SAVE_KEY);
  if (old && parseSave(old)) storage.setItem(PREVIOUS, old);
  storage.setItem(SAVE_KEY, exportSave(state));
}
export function previousSave(storage) {
  return parseSave(storage.getItem(PREVIOUS));
}
function readClassic(storage) {
  try {
    const data = JSON.parse(storage.getItem(CLASSIC));
    return data && typeof data.kitchenCamp === 'object' && data.kitchenCamp !== null ? data : null;
  } catch {
    return null;
  }
}
export const hasClassicSave = storage => !!readClassic(storage);
export function importClassic(storage) {
  const data = readClassic(storage);
  if (!data) return null;
  const state = createState();
  const keep = (n, max) => typeof n === 'number' && Number.isFinite(n) ? Math.min(max, Math.max(0, Math.floor(n))) : 0;
  const camp = data.kitchenCamp;
  state.cash = Math.max(state.cash, keep(data.cash, 250));
  const depot = state.sites.depot.stock;
  depot.planks = Math.max(depot.planks, keep(camp.planks, CAPACITY.depot.planks));
  depot.logs = Math.max(depot.logs, keep(camp.logs + camp.fuel, CAPACITY.depot.logs));
  return state;
}
