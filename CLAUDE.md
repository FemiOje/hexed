# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Fully onchain asynchronous battle royale with fog of war, built with Cairo/Dojo (smart contracts) and React/Three.js (frontend). Players explore a 21x21 hexagonal grid, receive random gifts or curses on each move, fight other players (even offline), and try to survive as long as possible.

## Build & Run Commands

### Smart Contracts (`contracts/`)
```bash
sozo build                # Build contracts
sozo test                 # Run all 81 tests
sozo migrate              # Deploy to local Katana node
```

### Local Starknet Node
```bash
katana --disable-fee      # Run local node (Terminal 1)
# Or use Docker:
docker compose up         # Runs katana + sozo migrate + torii together
```

### Torii Indexer
```bash
torii --world <WORLD_ADDRESS> --http.cors_origins "*"
```

### Frontend (`client/`)
```bash
pnpm install
pnpm run dev              # Vite dev server
pnpm run build            # Production build
```

### Scarb Scripts (from `contracts/`)
```bash
scarb run migrate-dev     # Full build + test + deploy (local)
scarb run migrate         # Full build + test + deploy (Sepolia)
scarb run spawn-dev       # Execute spawn on local
scarb run move-dev        # Execute move on local
```

## Architecture

```
contracts/                    # Cairo smart contracts (Dojo 1.8.0)
  src/
    models.cairo              # All models, constants, enums (PlayerState, PlayerStats, etc.)
    lib.cairo                 # Module tree root
    constants/
      constants.cairo         # Grid bounds (GRID_MIN/MAX = -10/10), DEFAULT_NS
    systems/game/
      contracts.cairo         # IGameSystems interface + game_systems contract (spawn, move, get_game_state)
      tests.cairo             # 81 integration tests
    helpers/
      combat.cairo            # XP-based combat resolution, handle_player_death
      encounter.cairo         # Gift/curse encounter system (35 unit tests inline)
      movement.cairo          # execute_move: position update + tile occupancy swap
      spawn.cairo             # Poseidon-based spawn position generation
    utils/
      hex.cairo               # Axial hex math: get_neighbor, is_within_bounds, get_neighbor_occupancy
      setup.cairo             # Test-only: deploy_world helper for integration tests
  Scarb.toml                  # Cairo 2.15.0, Dojo 1.8.0

client/                       # React + TypeScript frontend
  src/                        # Dojo SDK + Three.js hex grid
  dojoConfig.ts               # Dojo manifest config
  vite.config.ts
```

### Data Flow
Frontend (React) -> Dojo SDK -> Starknet RPC (Katana/Sepolia) -> Cairo Contracts -> Torii Indexer -> Frontend

### Key Technologies
- **Cairo 2.15.0 + Dojo 1.8.0**: Smart contracts and onchain game engine
- **Scarb**: Cairo package manager and build tool
- **Three.js**: 3D hex grid rendering
- **@dojoengine/sdk + @starknet-react/core**: Contract interaction and wallet integration

## Models (ECS)

All models live in `contracts/src/models.cairo`:

| Model | Key | Fields | Purpose |
|-------|-----|--------|---------|
| `GameSession` | `game_id` | `player`, `is_active` | Maps game to player, tracks active state |
| `PlayerState` | `game_id` | `position`, `last_direction`, `can_move` | Spatial/movement state |
| `PlayerStats` | `game_id` | `hp`, `max_hp`, `xp` | Combat and progression stats |
| `TileOccupant` | `(x, y)` | `game_id` | Reverse lookup: who occupies a tile (0 = empty) |

**View struct** (not a model): `GameState` - returned by `get_game_state()`, combines all model data + neighbor_occupancy.

## Systems

Single contract: `game_systems` in namespace `untitled`.

| Function | Description |
|----------|-------------|
| `spawn()` | Creates new game session, generates random position, initializes models, reveals neighbors |
| `move(game_id, direction)` | Validates ownership/bounds, resolves combat OR movement+encounter, emits events |
| `get_game_state(game_id)` | Read-only view returning full game state for a session |

### Events

| Event | Key | Emitted When |
|-------|-----|-------------|
| `Spawned` | `game_id` | Player spawns (includes position) |
| `Moved` | `game_id` | Player moves to empty tile |
| `CombatResult` | `attacker_game_id` | Combat resolves (includes who won, damage, death) |
| `PlayerDied` | `game_id` | Player dies (killed_by=0 for environment, >0 for PvP) |
| `NeighborsRevealed` | `game_id` | Adjacent tile occupancy bitmask revealed |
| `EncounterOccurred` | `game_id` | Gift/curse resolved on empty tile (includes outcome, stats after) |

## Game Mechanics

### Hex Grid
- **21x21 axial coordinate grid**: q and r range [-10, 10]
- **Pointy-top hexagons** with 6 directions: E, NE, NW, W, SW, SE
- Coordinate utilities in `utils/hex.cairo`

### Combat (XP-Based)
- Triggered when moving onto an occupied tile with an active defender
- **Higher XP wins**; equal XP favors the attacker
- Loser takes `COMBAT_DAMAGE` (10 HP); winner gains `COMBAT_XP_REWARD` (30 XP)
- If loser's HP reaches 0: game deactivated, tile cleared, `PlayerDied` emitted
- Attacker moves to defender's tile on win; stays put on loss

### Encounter System (Gift/Curse)
- Triggered on **every move to an empty tile** (after movement)
- **Deterministic RNG**: `poseidon_hash(game_id, position.x, position.y, block_timestamp)`
- Two rolls derived: `encounter_roll` (0-99) and `subtype_roll` (0-99)

**Probability**: 65% Gift / 35% Curse

**Max HP is fixed at 110 and never changes**

| Type | Outcome | Effect | Subtype Range |
|------|---------|--------|---------------|
| Gift | Heal | +20 HP (capped at max_hp) | 0-39 (40%) |
| Gift | Empower | +25 XP | 40-74 (35%) |
| Gift | Blessing | +10 HP, +15 XP | 75-99 (25%) |
| Curse | Poison | -15 HP (can kill) | 0-39 (40%) |
| Curse | Drain | -5 XP (floor: 0) | 40-79 (40%) |
| Curse | Hex | -10 HP, -5 XP (can kill) | 80-99 (20%) |

### Fog of War
- After each move/spawn, a 6-bit `neighbors` bitmask reveals which adjacent tiles are occupied
- Bit 0 = East, Bit 1 = NorthEast, ..., Bit 5 = SouthEast

### Constants (`models.cairo`)
```
STARTING_HP = 100, MAX_HP = 110 (fixed, never changes)
COMBAT_DAMAGE = 10, COMBAT_XP_REWARD = 30, EXPLORE_XP_REWARD = 10
GIFT_THRESHOLD = 65 (65% gift, 35% curse)
HEAL = +20 HP, EMPOWER = +25 XP, BLESSING = +10 HP/+15 XP
POISON = -15 HP, DRAIN = -5 XP, HEX = -10 HP/-5 XP
```

Grid: `GRID_MIN = -10`, `GRID_MAX = 10` (in `constants/constants.cairo`)

## Development Config

- Local RPC: `http://localhost:5050/`
- World namespace: `untitled`
- Dev config: `contracts/dojo_dev.toml`
- Docker setup: `contracts/compose.yaml`

## Testing

81 total tests across two files:
- `helpers/encounter.cairo`: 35 unit tests (pure function tests for all encounter outcomes, edge cases, invariants)
- `systems/game/tests.cairo`: 46 integration tests (spawn, move, combat, encounter integration, death, tile occupancy)

Tests use `utils/setup.cairo` which deploys a test world with all models and events registered.

## Design Document

`GAME_DESIGN_DOCUMENT.md` contains the aspirational game design (1,300+ lines). Not all features described there are implemented yet. Always check the actual source code for current behavior.
