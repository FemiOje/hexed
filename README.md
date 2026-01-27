# Untitled

> A fully onchain asynchronous battle royale with fog of war, built with Cairo and Dojo

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Cairo](https://img.shields.io/badge/Cairo-2.0-orange.svg)](https://www.cairo-lang.org/)
[![Dojo](https://img.shields.io/badge/Dojo-1.0-red.svg)](https://www.dojoengine.org/)
[![Starknet](https://img.shields.io/badge/Starknet-Testnet-purple.svg)](https://www.starknet.io/)

## Overview

**Untitled** is a multiplayer strategy game where players navigate a hexagonal grid shrouded in fog of war, encountering random events and engaging in tactical combat with both online and offline players. The twist? You can ambush players even when they're offline, and every run is a race to claim the top spot on the global leaderboard.

This project demonstrates advanced Cairo programming patterns, efficient onchain game state management, and asynchronous multiplayer mechanics using the Dojo game engine.

### Core Features

- **Fog of War**: Players cannot see each other's positions until direct encounter
- **Asynchronous Combat**: Attack offline players without requiring simultaneous presence
- **Tactical Flee Mechanic**: Choose to fight or flee based on stat-driven probability
- **Run-Based Progression**: Each life is a scored run; register your best to the leaderboard
- **Fully Onchain**: All game logic, state, and randomness verifiable on Starknet
- **Loot Survivor-Style Stats**: STR/DEX/VIT/LUK create diverse build strategies

### Screenshots

```
    [NW] [NE]              ═══════════════════════════════════
      ╲  ╱                        PLAYER ENCOUNTERED
[W] ── 🟢 ── [E]            ═══════════════════════════════════
      ╱  ╲
    [SW] [SE]              You encounter Bob.stark!
                           Threat Level: 🟡 MEDIUM
HP: 150/150
Loot: 450 gold            Your HP: 150 | Their HP: ???
Score: 2,340
                          ┌──────────────┐  ┌──────────────┐
Recent Events:            │    FIGHT     │  │     FLEE     │
• Found treasure chest!   │              │  │  (65% chance) │
  +150 gold               └──────────────┘  └──────────────┘
```

## Quick Start

### Prerequisites

- [Cairo/Scarb](https://book.cairo-lang.org/ch01-01-installation.html) 2.13.1
- [Dojo](https://book.dojoengine.org/installation) 1.8.5+
- [Node.js](https://nodejs.org/) 18+

### Installation

```bash
# Clone the repository
git clone https://github.com/FemiOje/untitled.git
cd untitled

# Build contracts
cd contracts
sozo build

# Run local Katana node
katana --disable-fee

# In a new terminal, migrate contracts
sozo migrate

# Start frontend
cd ../client
npm install
npm run dev
```

## How to Play

### Objective
Survive as long as possible, accumulate score through combat, exploration, and loot collection, then register your run to claim a spot on the global leaderboard.

### Game Flow

1. **Character Creation**: Distribute 20 stat points across STR, DEX, VIT, LUK
2. **Explore the Grid**: Move through a 10x10 hex grid shrouded in fog of war
3. **Random Encounters**:
   - Empty hexes trigger gifts (70%) or dangers (30%)
   - Occupied hexes trigger player combat
4. **Combat Choices**:
   - **Fight**: Auto-resolve based on stats, winner steals 30% loot
   - **Flee**: Stat-based probability (10-90%) to escape without damage
5. **Death**: Run ends, score calculated
6. **Register**: Submit score to leaderboard (costs gas) or discard

### Scoring

```
Score = (Turns × 10) + (Kills × 500) + (Loot × 1) + (Tiles × 5) + (Gifts × 20) + (Dangers × 30)
```

**Example**: 42 turns, 3 kills, 2450 loot, 67 tiles explored = **8,450 points**

### Win Condition

**Current Leader** = Player with the highest *registered, completed* run in the current season (1-2 weeks).

## Technical Highlights

### Architecture

```
untitled/
├── contracts/              # Cairo smart contracts
│   ├── src/
│   │   ├── models/        # Game state models (Player, Game, Leaderboard)
│   │   ├── systems/       # Game logic (Movement, Combat, Encounter, Scoring)
│   │   └── lib.cairo      # Main contract entry point
│   └── Scarb.toml
├── client/                # React + TypeScript frontend
│   ├── src/
│   │   ├── components/    # Hex grid, combat UI, leaderboard
│   │   ├── hooks/         # Dojo integration hooks
│   │   └── utils/         # Game logic helpers
│   └── package.json
└── GAME_DESIGN_DOCUMENT.md
```

### Smart Contract Design

**Key Models**:

```cairo
struct Player {
    player_address: ContractAddress,
    run_id: u64,
    position: (i32, i32),          // Hex coordinates
    stats: (u8, u8, u8, u8),        // STR, DEX, VIT, LUK
    hp: u32,
    loot: u32,
    is_alive: bool,
    is_registered: bool,
}
```

**Core Systems**:

| System | Responsibility |
|--------|----------------|
| `Movement` | Hex grid navigation, collision detection |
| `Combat` | Attack/defense calculation, flee probability |
| `Encounter` | RNG-based gift/danger events |
| `Scoring` | Multi-factor score calculation, leaderboard management |

### Technical Innovations

#### 1. Asynchronous Combat
Players can attack offline opponents by reading their current onchain state:

```cairo
fn initiate_combat(
    ref world: IWorldDispatcher,
    defender_address: ContractAddress,
    action: CombatAction  // FIGHT or FLEE
) -> CombatResult {
    // Defender doesn't need to be online
    let defender = get!(world, defender_address, Player);
    let attacker = get!(world, get_caller_address(), Player);

    // Resolve combat deterministically
    resolve_combat(attacker, defender)
}
```

#### 2. Verifiable Randomness
Uses block hash + player inputs for deterministic pseudo-randomness:

```cairo
fn get_random(seed: felt252, range: u32) -> u32 {
    let block_hash = starknet::get_block_info().unbox().block_hash;
    let hash = pedersen(pedersen(block_hash, seed), get_block_timestamp());
    (hash.into() % range.into()).try_into().unwrap()
}
```

#### 3. Event-Driven Frontend
All game actions emit events for real-time UI updates:

```cairo
#[event]
struct CombatResolved {
    attacker: ContractAddress,
    defender: ContractAddress,
    attacker_damage: u32,
    defender_damage: u32,
    loot_stolen: u32,
    flee_successful: bool,
}
```

#### 4. Gas-Optimized Leaderboard
Top scores stored onchain, full history in events:

```cairo
// O(1) current leader lookup
fn get_current_leader(season_id: u32) -> (ContractAddress, u32)

// O(n) paginated leaderboard
fn get_leaderboard(season_id: u32, limit: u32) -> Array<LeaderboardEntry>
```

#### 5. Axial Coordinate System for Hex Grid

We use **axial coordinates** `(q, r)` for the hexagonal grid, where:

**Axis Orientations** (pointy-top hexagons):
- **q-axis**: Points **East** (horizontal right, 0°)
- **r-axis**: Points **Southeast** (120° from q-axis, down-right diagonal)

```
       r-axis (↘)
          ↗
         /
        /
       /________________→ q-axis (→)
```

**Direction Vectors**:
```cairo
enum Direction {
    East,       // (+1, 0)   - Pure q-axis movement
    SouthEast,  // (0, +1)   - Pure r-axis movement
    SouthWest,  // (-1, +1)  - Diagonal: -q, +r
    West,       // (-1, 0)   - Negative q-axis
    NorthWest,  // (0, -1)   - Negative r-axis
    NorthEast,  // (+1, -1)  - Diagonal: +q, -r
}
```

**Visual Representation**:
```
       (0,-1)  (1,-1)
         NW      NE
           ╲    ╱
            ╲  ╱
  (-1,0) W ─(0,0)─ E (1,0)
            ╱  ╲
           ╱    ╲
         SW      SE
       (-1,1)  (0,1)
```

**Why Axial over Cube Coordinates?**

Cube coordinates `(q, r, s)` have the same mathematical properties but store 3 values with the constraint `q + r + s = 0`. Axial coordinates are simply cube coordinates with the redundant third coordinate removed:

| Aspect | Axial (q, r) | Cube (q, r, s) |
|--------|--------------|----------------|
| **Storage** | 2 integers ✅ | 3 integers ❌ |
| **Gas Cost** | Lower (fewer writes) | Higher |
| **Distance Calc** | Same formula | Same formula |
| **Neighbor Logic** | Same complexity | Same complexity |
| **Mathematical Properties** | Identical | Identical |

For a 100-hex grid with 50 players, axial saves **200 integer storage slots** compared to cube, significantly reducing gas costs for movement operations.

**Example Movement**:
```cairo
fn move_player(pos: (i32, i32), direction: Direction) -> (i32, i32) {
    let (q, r) = pos;
    let (dq, dr) = match direction {
        Direction::East => (1, 0),
        Direction::SouthEast => (0, 1),
        Direction::SouthWest => (-1, 1),
        Direction::West => (-1, 0),
        Direction::NorthWest => (0, -1),
        Direction::NorthEast => (1, -1),
    };
    (q + dq, r + dr)  // Simple addition, no branching
}
```

## Game Mechanics Deep Dive

### Combat Formula

```
Attack = (STR × 2) + (DEX × 1) + RANDOM(1, 20)
Defense = (VIT × 2) + (DEX × 1) + RANDOM(1, 20)

Damage = MAX(5, Attack - Defense)

Winner steals: MIN(Loser Loot × 0.30, Loser Loot)
```

### Flee Probability

```
Base = 50%
Modifier = (Attacker DEX × 5) + (Attacker LUK × 3) - (Defender STR × 4)
Flee Chance = CLAMP(Base + Modifier, 10%, 90%)

Failed flee = Combat with +20% damage penalty
```

### Build Archetypes

| Build | Stats | Strategy |
|-------|-------|----------|
| **Tank** | STR 4, DEX 3, VIT 10, LUK 3 | Absorb damage, lock down enemies (low flee for attackers) |
| **Scout** | STR 3, DEX 8, VIT 4, LUK 5 | High flee chance (70-80%), explore safely |
| **Berserker** | STR 9, DEX 5, VIT 5, LUK 1 | Maximum damage, all-or-nothing combat |
| **Balanced** | STR 5, DEX 5, VIT 5, LUK 5 | Versatile, no weaknesses |

## Development

### Project Structure

```
contracts/src/
├── models/
│   ├── player.cairo        # Player state and stats
│   ├── game.cairo          # Game/season management
│   └── leaderboard.cairo   # Score tracking
├── systems/
│   ├── movement.cairo      # Hex grid navigation
│   ├── combat.cairo        # Combat resolution and flee
│   ├── encounter.cairo     # Random events (gifts/dangers)
│   └── scoring.cairo       # Score calculation and registration
└── lib.cairo
```

### Running Tests

```bash
cd contracts
sozo test

# Run specific test
sozo test test_combat_resolution

# Run with coverage
sozo test --coverage
```

### Building for Production

```bash
# Optimize contracts
sozo build --release

# Deploy to testnet
sozo migrate --rpc-url https://starknet-sepolia.public.blastapi.io

# Deploy to mainnet (when ready)
sozo migrate --rpc-url https://starknet-mainnet.public.blastapi.io
```

## Roadmap

### Phase 1: MVP (Weeks 1-3)
- [ ] Core game models (Player, Game, Leaderboard)
- [ ] Movement system with hex grid
- [ ] Combat system with flee mechanic
- [ ] Encounter system (gifts/dangers)
- [ ] Scoring and leaderboard
- [ ] Comprehensive GDD

### Phase 2: Frontend (Weeks 4-5)
- [ ] React app with Dojo integration
- [ ] Hex grid renderer (Three.js)
- [ ] Combat UI (fight/flee choice)
- [ ] Leaderboard display
- [ ] Event notifications

### Phase 3: Polish (Week 6)
- [ ] Balance tuning
- [ ] Sound effects and animations
- [ ] Gas optimization
- [ ] Security review
- [ ] Demo video
- [ ] Mainnet deployment

### Future Enhancements
- [ ] Power-ups (vision, shields, traps)
- [ ] Territory control mechanics
- [ ] Guild/team scoring
- [ ] Boss encounters
- [ ] VRF for true randomness
- [ ] Replay system
- [ ] Achievement NFTs

## Documentation

- **[Game Design Document](GAME_DESIGN_DOCUMENT.md)**: Comprehensive mechanics, formulas, and specifications
- **[Dojo Documentation](https://book.dojoengine.org/)**: Learn about the Dojo engine
- **[Cairo Documentation](https://book.cairo-lang.org/)**: Cairo language reference

## Contributing

This is primarily a portfolio project, but feedback and suggestions are welcome!

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- **[Dojo Engine](https://www.dojoengine.org/)**: Provable game engine for onchain games
- **[Loot Survivor](https://lootsurvivor.io/)**: Inspiration for stat system
- **[Eternum](https://eternum.realms.world/)**: Inspiration for hex grid mechanics
- **[Red Blob Games](https://www.redblobgames.com/grids/hexagons/)**: Hex grid algorithms

## Contact

**Developer**: [Femi Oje]
**Twitter**: [@0xjinius](https://x.com/0xjinius)
**GitHub**: [@FemiOje](https://github.com/FemiOje)
**Email**: 0xjinius@gmail.com

**Project Link**: [https://github.com/FemiOje/untitled](https://github.com/FemiOje/untitled)

---

*Built on Starknet with Dojo*
