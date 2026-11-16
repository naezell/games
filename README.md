# Games

## Frostfall Camp

A snowy camp builder. Hunt frost boars for meat, cook steaks, and sell them to customers. Spend your earnings on workshops, workers, equipment, and land. Gather logs, fish, crops, ore, and other materials to supply your shops.

- **Find your way.** Tap the minimap to search for places, materials, or built workshops. Select a marker, pin a route, or fast travel to an unlocked district.
- **Build and expand.** Open **Menu → Build & Expand** to search available purchases, compare costs, see what they lead to, and pin a build pad. Start with the Sawmill and grow into Ridge Camp, the Frost Mine, Market Town, Aurora Isle, and the Harbor District. Land plots specialize in timber, berries, hunting, crystals, or crops.
- **Choose what to build in each district.** Open **Menu → Districts** for production paths and links to their build pads and delivery routes. In the Harbor, start with fish sales or build the Freight Pier to receive supplies.
- **Make and sell goods.** Craft lanterns, tools, jam, cheese, and more. Fill bulk orders at your own pace at the Order Board.
- **Automate deliveries and sales.** After your first customer, buy the Grill → Steak Counter conveyor from **Build & Expand → Automation**. Hire a Hunter to supply the Grill and a Banker to collect the cash. As you expand, add carts, storage sheds, a freight train, or a cargo balloon.
- **Build useful projects.** In **Menu → Projects**, pin the South Bridge, Mine Loading Depot, Harbor Fishing Dock, or Freight Pier and see which materials to bring. The Ice Castle and Harbor Beacon are longer builds that increase income.
- **Check progress when you want it.** Tap a build pad to see its price and what you still need. See production status as you approach a workshop. Open **Menu → Warehouse** for stock, incoming deliveries, and bottlenecks, **Activity** for recent updates, and **Stats** for income. Pop-ups are reserved for problems that need attention, such as a failed save.

Open [frostfall-camp/index.html](frostfall-camp/index.html) in a browser. The game loads Three.js from a CDN. Drag anywhere to move on a phone, or use WASD or the arrow keys on a computer. Walk near a resource to gather it. Walk onto a marked square to deliver goods, collect cash, or pay for construction.

Battery saver is the default on touch-first devices. Use **Menu → Graphics** to change it. The game pauses when the page is hidden.

Progress saves in your browser. Use **Menu → Backup save** to copy or restore a backup code.

## Frostfall Kitchen & Mill

A compact winter settlement with two linked production chains. Send the crew to harvest, haul, cook, mill, service machinery and build improvements. The kitchen burns logs that the mill can use for planks. Planks pay for construction, repairs and export orders. Meal shortages slow work, and overproduction risks spoilage.

- **Operations** shows site inventories, incoming loads, and the current bottleneck. Select a workshop to inspect equipment and change its shift. Adjust how dispatch divides labor between food and timber, when a cart leaves, and which logs the kitchen holds in reserve.
- **Crew** shows each worker’s current job and specialty. An assignment controls the worker's next task.
- **Projects** spends warehouse planks, cash, and service time on carts, paths, storage, or additional workstations. Timber and food exports can fund the next improvement.
- **Saves** controls graphics and backups. The [Classic Kitchen & Mill source](frostfall-kitchen/index.html) also ships on the same origin at `/classic/`, where existing browser saves still work. An optional import copies some Classic starter cash and materials into a new operations save.

See [build and release instructions](frostfall-kitchen/DEPLOYMENT.md) to play locally with Node.js 20 or later.

Remaining work includes choosing warehouse locations within camp, rerouting around crowded paths, longer operational scenarios after the initial projects, and profiling sustained gameplay on an iPhone.
