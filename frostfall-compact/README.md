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
- At **Market**, take a job such as the builder’s pickup, camp supper, or outfitter’s restock. Pack each installment and collect its payment when it is full. Jobs are untimed. The current installment stays visible while you work. Spot sales reserve what you still need.
- After completing a job, open standing accounts for the carpenter or inn. Pack ahead for pickups every two play days. One day is three minutes of active play. Orders and pickups wait for you when you close the game.
- Under a station’s **Stock targets, handling & batches**, keep a base stock of boards or steaks before switching to the selected premium recipe. Select manual handling to stage goods, load the next batch, or fill your cart with a button. At the mill, sort logs to speed up finished lumber. The grill can turn five meat and one shared sawmill offcut into two trays.
- Under **Drop-off bin & permanent rebuild**, spend coins and finished lumber to install a self-feeding bin or rebuild the workshop for quick batches, premium goods, or easier loading. Project lumber can come from the item crate or your carried inventory.
- At **Improve**, buy timber or food cart racks for eight matching goods, or keep the five-slot mixed bed. Choose a helper’s timber or food route, preferred load, and pickup priority. Helpers can pack jobs automatically before selling surplus.
- Build the **Loading bay** at the market to unlock larger, rotating shipments. Counter reserves and spot sales are also available there, including the eight-board, eight-steak quick order.

The improvement pad also has a 16-item crate. Set down goods, then retrieve them by type. Raw goods can be returned to their renewable source for no coins.

## Build

Tap **Build** in the header to see eight permanent structures. Open a plan to mark its plot and reserve the necessary finished goods from automatic sales. Deliver materials from your load or the camp crate in as many visits as needed, then fund construction at the marked plot. The Timber Yard is a first project you can fund by making five boards, selling three for 12 coins, and delivering the two that remain.

The yard and cold store improve gathering and unlock the workshop extensions. Build a storehouse to enlarge the camp crate, then choose more cart capacity, a third helper position, or better spot prices. Existing equipment, shop upgrades, and helpers are available from **Buy equipment & hire helpers** or the improvement pad.

Every structure has two optional upgrade levels at its original plot. Higher levels expand what the building can hold or improve the work it supports. The Dispatch Cabin adds faster walking and a five-item helper pack. Use the gear button to pause building upgrades, individual buildings, or whole systems. The Simple Camp preset leaves the gather, process, and sell loop enabled, and you can change each switch independently.

After hiring a helper, assign **Deliver to pinned build** to collect the required finished goods from workshop outputs, the market reserve, or the camp crate. You still fund construction at the plot. At each workshop, **Recipe choice → Fill orders and pinned build first** can cover shortages automatically. Open the **Camp board** from Settings, Build, or the improvement pad to see shortages across your current jobs. Each addition has its own switch.

The optional supply merchant sells limited stock at the Market. Finished premium goods unlock after two contracts or a Market Exchange. The separate **Featured market goods** switch adds a rotating spot-sale premium for a limited number of items per trading day. Both follow active play and can be switched off independently.

The Market’s optional **Odd jobs** board offers a short untimed order alongside your main contract. At the Sawmill and Grill, buy optional **Workshop attachments** for faster or larger batches. Only one attachment runs at each station, and owned attachments can be swapped for free. Each has its own Settings switch.

Pause with the pause button. The camp is saved automatically to the browser's local storage under `frostfall-compact-v1`, separate from the original game. Older Compact saves load automatically, including work already underway and accepted bulk orders. A save warning appears if storage is unavailable. Clearing browser storage deletes the save.

## Tests

```sh
node --test frostfall-compact/sim.test.mjs
```

The simulation is deterministic and independent of the renderer. Tests cover both production lines and recipe changes, staging, offcut fuel, stock targets, helper routes, cart racks, jobs, shipments, accounts, and save migration. The game caps rendering at 30 FPS and device pixel ratio at 1.25; rendering and simulation stop while paused or hidden.
