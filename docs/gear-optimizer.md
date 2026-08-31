# Gear optimizer

Takes a complete `/simc` export and finds the best combination of the gear
the character **already owns** — equipped and in bags — separately for
single target and AoE.

The whole point is that nothing here is estimated. Item level, stat weights,
BiS lists and general heuristics never decide anything: a setup is only ever
called better than another because SimulationCraft simulated both under
identical conditions and returned a higher number. When SimulationCraft is
not available, the tool stops with an error rather than guessing.

## Using it

**Web** — `/optimizer`: paste the `/simc` string, pick Single Target or AoE,
press *Find best gear*. The page polls progress and renders the best setup,
the changes from current gear, the top setups and the simulation settings.

**CLI**:

```sh
SIMC_PATH=/path/to/simc npm run optimize -- \
  --file export.simc --mode aoe --json result.json
```

Flags: `--mode single_target|aoe`, `--targets`, `--duration`, `--threads`,
`--screening-iterations`, `--evaluation-iterations`,
`--verification-iterations`, `--max-combinations`, `--verify-top`,
`--json <path>`.

**API** — `POST /api/optimizer` with `{ input, mode, settings? }` starts a
job and returns its id; `GET /api/optimizer/:id` returns progress while it
runs and the structured result when it finishes.

## Requirements

A real SimulationCraft CLI. The engine is located in this order:
`$SIMC_PATH`, then `simc` on `PATH`, then `/usr/local/bin/simc`,
`/usr/bin/simc`, `/opt/simc/simc`. If none of them runs, every entry point
fails with:

```
SimulationCraft engine not found.
No gear recommendation can be calculated reliably.
```

Building the engine from source (no Qt, no networking needed):

```sh
git clone --depth 1 https://github.com/simulationcraft/simc
cmake -S simc -B simc/build -GNinja -DCMAKE_BUILD_TYPE=Release \
  -DBUILD_GUI=OFF -DBUILD_TESTING=OFF -DSC_NO_NETWORKING=ON
ninja -C simc/build simc
```

## How it works

### 1. Parsing (`parse.ts`)

Extracts the character (class, name, level, race, region, server, spec,
role, active talents) and every item. Two rules matter:

- **Item strings are kept verbatim.** The right-hand side of an item line —
  `,id=239050,bonus_id=12843/13440/42,content_tuning=1279` — is reused
  untouched when generating profiles, so gems, enchants, crafted stats,
  crafting quality and content tuning survive exactly as the addon reported
  them. Items are never reconstructed by hand.
- **Only real bag gear enters the pool.** Commented item lines count as
  owned gear only under a `### Gear from Bags` heading. Weekly reward
  choices and other commented sections are ignored.

Saved loadouts (`# Saved Loadout: M+`) are parsed and stored, but they never
replace the active `talents=` line. Talent optimization is deliberately out
of scope; the data model already carries the loadouts for when it isn't.

Sim-control options (`iterations`, `max_time`, `fight_style`, …) found in
the pasted input are stripped, because the optimizer owns encounter settings
— every candidate in one comparison must run under identical conditions.

### 2. Gear pool (`gear-pool.ts`)

One pool per slot group. The equipped item is always a candidate. Rings and
trinkets are enumerated as **unordered pairs** rather than per-slot picks,
so `C(n,2)` combinations are tested and the same physical copy is never
equipped twice; two identical items are only paired when the character owns
two separate copies. Weapons pair each one-handed main hand with every off
hand and with none; a two-handed weapon is never paired with an off hand,
see *Weapon legality* below.

Other illegal combinations — an item a class cannot use, for instance — are
not filtered by guesswork; SimulationCraft decides, see *Invalid
combinations* below.

### 3. Search (`optimizer.ts`)

Gear is never optimized slot by slot in isolation, because tier sets and
item effects only show up in combination.

1. **Baseline.** Sim the current gear.
2. **Screening.** Sim every single-slot change on its own at low
   iterations. This only ever *ranks*; nothing is dropped for having a lower
   item level.
3. **Selection.** Keep the best options per group, judged purely on measured
   DPS. Slots where set bonuses, procs and weapon damage create cross-slot
   interactions — head, shoulder, chest, hands, legs, rings, trinkets,
   weapons — keep more options, and additionally keep anything still
   statistically tied with the group's best, because a single-slot sim
   understates a tier piece that only pays off inside a set. The currently
   equipped configuration is never dropped.
4. **Combinations.** Take the cartesian product of the surviving options,
   explored breadth-first outward from the strongest screening results and
   capped at `maxCombinations`, then sim each complete setup.
5. **Verification.** Re-sim the top setups (and the baseline) at the high
   iteration count. **The winner is decided by this run**, not by screening.

Default iterations are 1,000 / 5,000 / 20,000 for the three phases; targets,
duration, iteration counts, thread count, combination cap and verification
depth are all configurable per request.

### 4. Simulation profiles (`profile.ts`, `engine.ts`)

Each batch is one `simc` invocation: the baseline profile plus one
`profileset."<id>"` per candidate, which is far cheaper than starting a
process per combination. Options were verified against the SimulationCraft
sources rather than assumed — `fight_style`, `max_time`, `desired_targets`,
`optimal_raid`, `iterations`, `threads`, `report_details`, `json2`.

Results are read from SimulationCraft's structured JSON report (`json2`),
never by scraping console output: `sim.players[0].collected_data.dps` for
the baseline and `sim.profilesets.results[]` for the candidates. Item names
and levels for equipped gear also come from that report, i.e. from
SimulationCraft's own item database.

**Single target** is 1 target, Patchwerk, 300s. **AoE** is 5 targets,
sustained, 180s — `desired_targets=5` makes SimulationCraft actually
simulate five enemies, so AoE is a different encounter, not a relabelled
single-target run. Target count and duration are configurable, which is what
2/3/8-target and M+-like profiles will build on.

### 5. Statistical honesty

SimulationCraft reports the standard error of the mean; the tool converts it
to a 95% confidence half-width and shows it everywhere a DPS number appears.
Two setups whose difference falls inside their combined error are reported
as effectively equal — including the winner against the current gear, where
the result says so plainly instead of recommending a pointless gear change.

### 6. Weapon legality

SimulationCraft does **not** validate that a weapon combination is legal.
Asked to equip an off-hand alongside a two-handed weapon it does so and
counts the off-hand's stats, which the game would never allow — measured
at roughly +3% DPS on a real profile, i.e. a recommendation that cannot be
equipped. So the engine cannot be the authority on this one rule.

It does know each weapon's hand type, and exposes it through the
`main_hand.2h` action expression. Before any combination is built, a short
probe replaces the action list with a single auto-attack — once
unconditionally, once gated on `main_hand.2h` — and runs one profileset
per main-hand candidate. A weapon that swings in both runs is two-handed;
one that swings only in the unconditional run is one-handed. The probe
reads a flag; it measures nothing.

Off-hands are then only ever paired with one-handed weapons. Anything the
probe cannot resolve counts as two-handed, which only removes pairings
from the search, so an inconclusive probe can never produce a setup the
game would reject.

### 7. Invalid combinations

SimulationCraft names some invalid profilesets in its error output; those
are dropped and the batch retried. Others — an impossible item combination,
for instance — crash the process outright with no diagnostic. Rather than
inventing rules about what is legal, the runner **bisects the batch** until
the offending candidates are isolated, excludes them, and reports how many
were rejected. The engine remains the authority on what can be equipped.

### 8. Caching

Every result is keyed by a hash of the character profile, gear overrides,
mode, targets, duration, iteration count and SimulationCraft version, so an
identical search reuses previous results instead of re-simming.

## Testing

- `npm test` — parser, gear pool, profile generation, combination search and
  statistics, all without an engine.
- `SIMC_PATH=... npm test` — additionally runs `tests/simc-engine.test.ts`,
  which drives a real SimulationCraft binary end to end: single target, AoE,
  rejection of unsimulatable combinations, and cache reuse. Without
  `SIMC_PATH` those tests are skipped.

## Scope

MVP: `/simc` string → choose ST or AoE → best combination of owned gear. Not
included: Droptimizer, raid loot or vault recommendations, and talent
optimization.
