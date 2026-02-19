# Untitled

> A fully onchain asynchronous battle royale with fog of war, built with Cairo and Dojo

[![Cairo](https://img.shields.io/badge/Cairo-2.15.0-orange.svg)](https://www.cairo-lang.org/)
[![Dojo](https://img.shields.io/badge/Dojo-1.8.0-red.svg)](https://www.dojoengine.org/)
[![Starknet](https://img.shields.io/badge/Starknet-Testnet-purple.svg)](https://www.starknet.io/)

## Overview

**Untitled** is a multiplayer strategy game where players navigate a hexagonal grid shrouded in fog of war. Every step to an empty tile triggers a random encounter — a gift that strengthens you or a curse that may kill you. Walk into another player's tile and combat is resolved automatically based on XP. You can ambush offline players, and every decision is a gamble between exploration and survival.

All game logic, state, and randomness live fully onchain on Starknet via the Dojo game engine.

### What's Implemented

- **21x21 Hex Grid**: Axial coordinate system with bounds checking
- **Fog of War**: 6-bit neighbor bitmask reveals adjacent occupancy after each move
- **Asynchronous PvP Combat**: XP-based resolution, attack offline players
- **Gift/Curse Encounter System**: 8 distinct outcomes on every empty-tile move (65% gift, 35% curse)
- **Deterministic RNG**: Poseidon hash from game state, fully verifiable onchain
- **Event-Driven Architecture**: 6 event types for frontend reactivity

## Quick Start

### Prerequisites

- [Dojo](https://book.dojoengine.org/installation) 1.8.0+ (includes Scarb, Katana, Torii, Sozo)
- [Node.js](https://nodejs.org/) 18+ and pnpm (for frontend)

### Build & Test

```bash
cd contracts
sozo build       # Compile Cairo contracts
sozo test        # Run all 81 tests
```

### Run Locally

```bash
# Terminal 1: Local Starknet node
katana --disable-fee

# Terminal 2: Deploy contracts
cd contracts
sozo migrate

# Terminal 3: Start indexer
torii --world <WORLD_ADDRESS> --http.cors_origins "*"

# Terminal 4: Frontend
cd client
pnpm install
pnpm run dev
```

## How to Play

1. **Spawn**: Call `spawn()` to create a new game session. You get placed at a random position on the hex grid with 100 HP and 0 XP.
2. **Move**: Call `move(game_id, direction)` with one of 6 directions (East, NorthEast, NorthWest, West, SouthWest, SouthEast).
3. **Encounter or Fight**:
   - **Empty tile**: An encounter triggers automatically. You receive a gift (65% chance) or curse (35% chance) that modifies your HP, max HP, or XP.
   - **Occupied tile**: Combat resolves automatically. The player with higher XP wins. The loser takes 10 damage and the winner gains 30 XP.
4. **Survive**: Curses like Poison (-15 HP) or Hex (-10 HP, -5 max HP, -10 XP) can kill you. Combat losses stack up. Death ends your game session.
5. **Scout**: After each action, you receive a bitmask showing which of your 6 neighboring tiles are occupied — plan your route accordingly.

### Encounter Outcomes

| Type | Outcome | Effect |
|------|---------|--------|
| Gift (65%) | **Heal** (40%) | +20 HP, capped at max |
| | **Fortify** (30%) | +10 max HP, +10 HP |
| | **Empower** (20%) | +25 XP |
| | **Blessing** (10%) | +10 HP, +5 max HP, +15 XP |
| Curse (35%) | **Poison** (40%) | -15 HP (can kill) |
| | **Wither** (30%) | -10 max HP (floor: 10) |
| | **Drain** (20%) | -20 XP (floor: 0) |
| | **Hex** (10%) | -10 HP, -5 max HP, -10 XP (can kill) |

The encounter system has a net-positive expected value, rewarding exploration while keeping risk present.

## Architecture

```
contracts/src/
  models.cairo                # Models + constants + enums
  lib.cairo                   # Module tree
  constants/constants.cairo   # Grid bounds, namespace
  systems/game/
    contracts.cairo           # IGameSystems (spawn, move, get_game_state)
    tests.cairo               # 46 integration tests
  helpers/
    combat.cairo              # XP-based combat resolution
    encounter.cairo           # Gift/curse system (35 unit tests)
    movement.cairo            # Position + tile occupancy updates
    spawn.cairo               # Random spawn position
  utils/
    hex.cairo                 # Axial hex math (neighbors, bounds, occupancy)
    setup.cairo               # Test world deployment helper

client/                       # React + TypeScript + Three.js frontend
```

### Models (Dojo ECS)

| Model | Key | Purpose |
|-------|-----|---------|
| `GameSession` | `game_id` | Maps game to player address, tracks active/inactive |
| `PlayerState` | `game_id` | Position (Vec2), last direction, movement flag |
| `PlayerStats` | `game_id` | HP, max HP, XP |
| `TileOccupant` | `(x, y)` | Which game_id occupies a tile (0 = empty) |

### Events

| Event | Emitted When |
|-------|-------------|
| `Spawned` | New game session created |
| `Moved` | Player moved to an empty tile |
| `CombatResult` | PvP combat resolved |
| `PlayerDied` | Player HP reached 0 (PvP or encounter) |
| `NeighborsRevealed` | Fog of war update after move/spawn |
| `EncounterOccurred` | Gift or curse applied after move |

### Key Design Decisions

**XP-based combat**: No stats to distribute. Your XP (earned from exploration and winning fights) determines combat outcomes. Higher XP wins; ties favor the attacker.

**Deterministic encounters**: Outcomes are derived from `poseidon_hash(game_id, x, y, block_timestamp)`. Same inputs always produce the same result, making the game fully verifiable.

**ECS separation**: Spatial state (`PlayerState`) and combat state (`PlayerStats`) are separate models, following Dojo ECS best practices. `TileOccupant` provides efficient reverse lookups for collision and combat detection.

## Hex Grid

Uses **axial coordinates** `(q, r)` with pointy-top hexagons on a 21x21 grid (range [-10, 10]).

```
       (0,-1)  (1,-1)
         NW      NE
           \    /
            \  /
  (-1,0) W --(0,0)-- E (1,0)
            /  \
           /    \
         SW      SE
       (-1,1)  (0,1)
```

**Direction vectors**: E (+1,0), NE (+1,-1), NW (0,-1), W (-1,0), SW (-1,+1), SE (0,+1)

## Testing

81 tests total, all passing:

- **35 unit tests** in `helpers/encounter.cairo`: Pure function tests for `determine_outcome()` and `apply_encounter()` covering all 8 outcomes, boundary values, death conditions, and stat invariants.
- **46 integration tests** in `systems/game/tests.cairo`: Full world deployment tests covering spawn, movement, combat, encounter integration, player death, tile occupancy, neighbor revelation, and edge cases.

```bash
cd contracts
sozo test    # Runs all 81 tests
```

## Roadmap

### Completed
- [x] Core models (GameSession, PlayerState, PlayerStats, TileOccupant)
- [x] Hex grid movement with bounds checking
- [x] XP-based asynchronous combat system
- [x] Gift/curse encounter system (8 outcomes)
- [x] Fog of war (neighbor occupancy bitmask)
- [x] Deterministic Poseidon-based RNG
- [x] Event-driven architecture (6 event types)
- [x] Comprehensive test suite (81 tests)
- [x] Game Design Document

### Planned
- [ ] Scoring system and leaderboard
- [ ] Stat distribution (STR/DEX/VIT/LUK)
- [ ] Flee mechanic in combat
- [ ] Frontend integration with Three.js hex grid
- [ ] Balance tuning and gas optimization
- [ ] Mainnet deployment

## Documentation

- **[Game Design Document](GAME_DESIGN_DOCUMENT.md)**: Full aspirational design including planned features
- **[CLAUDE.md](CLAUDE.md)**: Technical reference for AI-assisted development
- **[Dojo Documentation](https://book.dojoengine.org/)**: Dojo engine reference
- **[Cairo Documentation](https://book.cairo-lang.org/)**: Cairo language reference

## Contributing

Feedback and suggestions are welcome!

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- **[Dojo Engine](https://www.dojoengine.org/)**: Provable game engine for onchain games
- **[Death Mountain](https://github.com/cartridge-gg/death-mountain)**: Inspiration for encounter system design
- **[Eternum](https://eternum.realms.world/)**: Inspiration for hex grid mechanics
- **[Red Blob Games](https://www.redblobgames.com/grids/hexagons/)**: Hex grid algorithms reference

## Contact

**Developer**: [Femi Oje]
**Twitter**: [@0xjinius](https://x.com/0xjinius)
**GitHub**: [@FemiOje](https://github.com/FemiOje)
**Email**: 0xjinius@gmail.com

**Project Link**: [https://github.com/FemiOje/untitled](https://github.com/FemiOje/untitled)

---

*Built on Starknet with Dojo*
