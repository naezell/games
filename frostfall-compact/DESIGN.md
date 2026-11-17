# Frostfall Compact — implementation specification

## Identity
A hands-on snowy camp: gather, carry, process, sell, reinvest. The player and workers are visible toy-like 3D characters. Depth comes from improving two short production lines in one familiar clearing.

## Source and preservation
Source: `cc15eee624998358e3bb62cd17221672a6c0dd20:frostfall-camp/index.html` (1,129 lines), compared with repository default head `f566378` (7,081 lines). Retain its automatic nearby gathering, carried goods, primitive-built characters, visible stations, and walk-up building. Its original save records cash, pad progress, and customers served but loses inventories. The original also had a watchtower, which is deliberately omitted. Later history added distant districts, fast travel, numerous products and unrelated activities: `530bf75` introduced Harbor District/cargo balloons; `8d99ee6` added ski slopes, snowball fights and an observatory; `da4f562` added searchable district travel. This version lives separately in `frostfall-compact/`; existing files and save keys remain intact.

## Map and loop
One fixed-camera clearing, approximately 24 × 24 units. Forest edge at upper left; boars upper right; sawmill middle left; grill middle right; shared sales counter lower middle; improvement pad lower left. No scrolling world or minimap. Fit every work station in portrait and landscape with reserved HUD/control space.

Four carried resources only: logs, boards, meat, steaks. Gather nearby automatically, transfer at clearly marked station input/output spots, sell boards and steaks at one counter to visible customers. Start with working basic stations and zero cash; all expansion is optional, so no purchase can block basic income. Logs become boards; meat becomes steaks. Capacity is shared across a visible backpack; station buffers are finite. No spoilage or punishment.

## Decisions and progression
Spend the single cash currency on three levels each of backpack capacity, sawmill speed, grill speed and storage, plus up to two helpers. Each helper can be reassigned among lumber gathering/delivery, meat gathering/delivery, and finished-goods hauling. Helpers carry goods physically; no invisible instant income. Separate station inputs and outputs prevent pickup/drop loops. A full backpack must always have a valid unloading destination. Show full buffers and missing inputs directly at stations. Upgrade descriptions state concrete before/after effects and prices. Purchases require a button, never accidental cash draining by standing on a pad.

Do not add fuel or secondary recipes in this first version. The meaningful choice is how to divide player labor, two helpers, buffer capacity, and investment between two lines. Expansion improves existing stations in place.

Recovery is explicit: a 16-item temporary crate at the improvement pad can free a mixed backpack, and raw goods can be returned at their renewable source if both crate and buffers are full. This is a local relief valve, not an unlimited warehouse. Sources regenerate after depletion; there is no survival timer. Market service sells one carried finished item per 0.6 seconds.

## Interface
Cash, backpack contents/capacity, one contextual instruction, pause, and a nearby-station action panel. Labels use words as well as colors. Touch drag movement plus tap a labeled destination to walk there; WASD/arrows on desktop. Compact improvement panel only at the build pad. No alerts for routine income, no menus unrelated to production.

## Technical boundaries
Static HTML/CSS/ES modules, local pinned Three.js dependency if available. Separate deterministic simulation (`sim.mjs`) from scene/input/HUD (`game.mjs`). Node built-in tests for transfers, capacities, upgrades, worker jobs, and save round trips. New versioned save key with validation; save inventories, partial production, upgrades, worker jobs and positions. Handle storage failure visibly without crashing. Fixed-rate simulation, capped 30 FPS rendering, pixel ratio at most 1.25, no realtime shadows/particles/postprocessing; pause and stop rendering when hidden, explicit pause available. Avoid allocations and DOM writes on every frame.

## Scope exclusions
No districts, land unlocking, travel networks, combat progression, quests, events, achievements, pets, cosmetics, research trees, extra currencies, stats dashboards, long crafting chains, or runtime AI. No deployment, merge, or changes to the existing game.

## Acceptance
Earn first cash manually from both lines; buy an upgrade; hire/reassign helpers; recover full backpack and full buffers; reload with inventory and production retained; operate at phone dimensions with destinations and controls visible. Test resource conservation and nonnegative bounded state. Review browser console and portrait layout. Browser testing cannot certify real-device battery temperature.
