# Hexed - Smart Contracts

Cairo smart contracts for **Hexed**, a fully onchain asynchronous battle royale on Starknet. Built with the [Dojo](https://www.dojoengine.org/) game engine (v1.8.0) and Cairo 2.15.0.

## Architecture

```
contracts/src/
  models.cairo              # All ECS models, constants, enums, view structs
  lib.cairo                 # Module tree root
  constants/
    constants.cairo         # Grid bounds, namespace
  systems/game/
    contracts.cairo         # IGameSystems: spawn, move, get_game_state, register_score, get_highest_score
    tests.cairo             # Integration tests (46 tests)
  helpers/
    combat.cairo            # XP-based combat resolution, retaliation damage, death handling
    encounter.cairo         # Gift/curse encounter system + unit tests (35 tests)
    movement.cairo          # Position update + tile occupancy swap
    spawn.cairo             # Poseidon-based random spawn position
  utils/
    hex.cairo               # Axial hex math: neighbors, bounds checking, occupancy bitmask
    setup.cairo             # Test helper: deploy_world with all models and events
```

## Game Mechanics

### Grid

21x21 hexagonal grid using axial coordinates. `q` and `r` range from -10 to 10 (441 hexes). Pointy-top hexagons with 6 movement directions: East, NorthEast, NorthWest, West, SouthWest, SouthEast. Edges are impassable.

### Combat (XP-Based)

Triggered when moving onto an occupied tile with an active defender.

| Scenario | Attacker | Defender |
|----------|----------|----------|
| **Attacker wins** (higher or equal XP) | +30 XP, +10 HP, moves to defender's tile | -10 HP, pushed to attacker's old tile |
| **Defender wins** (higher XP) | -10 HP, stays put | -5 HP (retaliation), no XP, stays put |
| **Death** (HP reaches 0) | Game deactivated, tile cleared | Game deactivated, tile cleared |

### Encounters (Gift / Curse)

Triggered on every move to an empty tile. Two deterministic random rolls (0-99) derived from a Poseidon hash of `(game_id, position, block_timestamp)`.

**Split: 50% Gift / 50% Curse**

| Type | Outcome | Effect | Subtype Probability |
|------|---------|--------|---------------------|
| Gift | Heal | +10 HP (capped at max) | 30% |
| Gift | Empower | +20 XP | 45% |
| Gift | Blessing | +5 HP, +10 XP | 25% |
| Curse | Poison | -15 HP (can kill) | 40% |
| Curse | Drain | -10 XP (floor: 0) | 25% |
| Curse | Hex | -10 HP, -10 XP (can kill) | 35% |

### Fog of War

After each move or spawn, a 6-bit bitmask reveals which adjacent tiles are occupied. Bit 0 = East, Bit 1 = NorthEast, ..., Bit 5 = SouthEast. Players cannot see beyond their immediate neighbors.

## Models (ECS)

| Model | Key | Fields | Purpose |
|-------|-----|--------|---------|
| `GameSession` | `game_id` | `player`, `is_active` | Maps game to player, tracks active state |
| `PlayerState` | `game_id` | `position`, `last_direction`, `can_move` | Spatial and movement state |
| `PlayerStats` | `game_id` | `hp`, `max_hp`, `xp` | Combat and progression stats |
| `TileOccupant` | `(x, y)` | `game_id` | Reverse lookup: who occupies a tile (0 = empty) |
| `GameCounter` | `game_id` (singleton 0) | `active_games` | Tracks concurrent game count |
| `HighestScore` | `game_id` (singleton 0) | `player`, `username`, `xp` | Leaderboard: highest XP ever |

**View struct** (not stored): `GameState` - returned by `get_game_state()`, combines all model data + `neighbor_occupancy`.

## Events

| Event | Key | Emitted When |
|-------|-----|-------------|
| `Spawned` | `game_id` | Player spawns |
| `Moved` | `game_id` | Player moves to empty tile |
| `CombatResult` | `attacker_game_id` | Combat resolves |
| `PlayerDied` | `game_id` | Player dies (`killed_by` = 0 for environment, >0 for PvP) |
| `NeighborsRevealed` | `game_id` | Adjacent tile occupancy bitmask revealed |
| `EncounterOccurred` | `game_id` | Gift/curse resolved on empty tile |
| `HighestScoreUpdated` | `player` | New highest score registered |

## Constants

```
STARTING_HP = 100          MAX_HP = 110 (fixed)
COMBAT_DAMAGE = 10         COMBAT_RETALIATION_DAMAGE = 5
COMBAT_XP_REWARD = 30      COMBAT_HP_REWARD = 10
EXPLORE_XP_REWARD = 10     GIFT_THRESHOLD = 50

Gift:  HEAL +10 HP, EMPOWER +20 XP, BLESSING +5 HP / +10 XP
Curse: POISON -15 HP, DRAIN -10 XP, HEX -10 HP / -10 XP

GRID_MIN = -10             GRID_MAX = 10
MAX_CONCURRENT_GAMES = 350
```

## Build & Test

```bash
sozo build          # Compile contracts
sozo test           # Run all 81 tests (46 integration + 35 unit)
sozo inspect        # Inspect deployed world
```

## Deploy

### Local (Katana)

```bash
# Terminal 1: Start local Starknet node
katana --dev --dev.no-fee

# Terminal 2: Build and deploy
sozo build && sozo migrate
```

### Docker

```bash
docker compose up   # Runs Katana + sozo migrate + Torii together
```

### Sepolia

```bash
sozo build && sozo migrate --profile sepolia
```

Configuration files: `dojo_dev.toml` (local), `dojo_sepolia.toml` (testnet).
