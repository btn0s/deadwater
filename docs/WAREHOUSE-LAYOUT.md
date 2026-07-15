# Warehouse floor plan

Design references: `docs/reference/warehouse-ref-fema-distribution.jpg`
(FEMA distribution center, public domain) and `warehouse-ref-sklad.jpg`
(small crate warehouse, CC BY-SA 3.0). What they show, and what this level
now follows:

- **Racking runs in long straight rows aligned to the building axes**,
  and rows sit on the column lines so the pillars live inside the rack
  line instead of eating aisle space.
- **Floor stock sits in square grid groups** (shrink-wrapped pallet
  stacks, staged pallets) with narrow gaps — never scattered, never
  rotated more than a couple of degrees.
- **Aisles are the negative space** and they stay clear: one wide
  drive aisle connecting the dock to everything, a cross aisle through
  the middle, and the dock apron kept open for truck work.

## The room

40 × 24 m, 6 m clear. Columns at x = −12/0/12 on z = ±6.8. Fixed
structure: dock bays on the east wall (z = −7, 0, 7) + personnel door to
the yard (z = 10); office inside the SW corner; sewer hallway leaves the
north wall around x = −10; wall shelves on the north wall at x = 2.5;
old rack row against the south wall (x = 1..15, z = 11.35).

## Zones (flow: receive at dock → staging → storage → ship)

```
z=-12 ┌──────────────────────────────────────────────┐
      │ depot corner   receiving corridor  wall shelf │
z=-6.8│    ██ RACK ROW N (x -10.3..-2.1, 2.1..10.3) ██│  ← on column line
      │                                               │ d
      │  BULK BLOCK       cross      STAGING GRID     │ r  DOCK
z=0   │  wrapped cargo    aisle      6 pallets, 2×3   │ i  APRON
      │  3×2 grid         (x≈-2..2)  + jack, markings │ v  (clear)
      │  x -9..-2.6                  x 3..8.6         │ e
z=+6.8│    ██ RACK ROW S (x -10.3..-2.1, 2.1..10.3) ██│  ← on column line
      │ office    aisle                               │
z=+12 └───────── south wall rack row (z=11.35) ───────┘
```

- **Rack rows N/S** — four 4 m rack bays per row, two each side of the
  center column, ends stopping short of the x = ±12 columns. Shelves
  carry square-set crates/boxes/cans, partially loaded.
- **Bulk block** — six shrink-wrapped pallet stacks (cargo-tall/low) in
  a 3×2 grid at x ∈ {−8.4, −5.9, −3.4}, z ∈ {−1.2, 1.4}. Tall stacks
  kill the center sightline.
- **Staging grid** — six loaded pallets in a 3×2 grid at
  x ∈ {3.6, 5.7, 7.8}, z ∈ {−1.6, 1.6}, painted lane markings around
  them, pallet jack parked square at the end. Outbound, nearest the dock.
- **Drive aisle** — x = 11.5..14.5 full length, clear.
- **Cross aisle** — x = −2..2 between bulk and staging, clear.
- **Dock apron** — x = 15..20 clear except wall-side clutter between
  bays (stacked empty pallets, hand truck, boxes — squared to the wall).

Rotation rule: everything is 0° or 90° to the building, ±0.05 rad of
placement slop at most. Junk piles (depot corner, trash) are the only
things allowed to sprawl.
