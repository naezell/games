# Frostfall Compact

A small, self-contained snowy camp about gathering, processing, carrying and selling. Three.js r128 is bundled locally; a browser with WebGL is required.

## Run

From the repository root:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000/frostfall-compact/`. Serving over HTTP is required for JavaScript modules. On a phone, use a server reachable on the same network and open its address in the browser.

## Play

Tap a place label to walk there, drag the clearing or use the joystick, or move with WASD or the arrow keys. Gather logs at **Forest** and meat at **Boars**. Bring them to the sawmill and grill inputs. Pick up the finished goods at their outputs and take them to **Market** for automatic sales.

- At either end of a station, choose the recipe for the next job. Quick boards and single steaks sell sooner. Finished lumber and steak trays take longer and pay more per raw item. The map labels show each machine’s status and how much is ready to collect.
- Each station has one permanent equipment slot. Install a second machine for parallel work, a loading rack for four extra raw goods, or a packing bench for four extra finished goods.
- At **Improve**, buy a handcart to carry five extra items. Hire up to two helpers and tell each to supply the sawmill or grill, haul finished goods, clear backed-up outputs first, or split gathering between the two lines.
- At **Market**, accept an optional order for eight boards and eight steaks. Deliver it in any number of trips for 92 coins. While an order is open, the counter holds back the boards and steaks you still need from automatic sales. If you close an order early, goods already delivered sell for their regular price.

The improvement pad also has a 16-item crate. Set down goods, then retrieve them by type. Raw goods can be returned to their renewable source for no coins.

Pause with the pause button. The camp is saved automatically to the browser's local storage under `frostfall-compact-v1`, separate from the original game. Saves from the first Compact release load automatically, including work already underway. A save warning appears if storage is unavailable. Clearing browser storage deletes the save.

## Tests

```sh
node --test frostfall-compact/sim.test.mjs
```

The simulation is deterministic and independent of the renderer. Tests cover both production lines and recipe changes, equipment limits, helper priorities, cart capacity, orders, and save migration. The game caps rendering at 30 FPS and device pixel ratio at 1.25; rendering and simulation stop while paused or hidden.
