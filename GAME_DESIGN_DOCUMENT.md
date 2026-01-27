# Untitled - Game Design Document

## Project Overview

### Title
**Untitled** (working title)

### High-Level Concept
A fully onchain, asynchronous multiplayer battle royale game where players explore a fog-of-war hexagonal grid, engage in tactical combat with online and offline players, collect resources through random encounters, and compete for the highest score on a persistent leaderboard.

### Purpose
This is a portfolio/demonstration project showcasing:
- Advanced Cairo programming skills
- Dojo game engine capabilities
- Fully onchain game logic with hidden information
- Asynchronous multiplayer mechanics
- Complex state management and event-driven architecture

### Technical Stack
- **Smart Contracts**: Cairo (Starknet)
- **Game Engine**: Dojo
- **Frontend**: React + TypeScript + Three.js
- **Network**: Starknet (Sepolia)

---

## Core Game Concept

### Elevator Pitch
*"It's like Battleship meets Battle Royale with roguelike elements - navigate a hidden grid, encounter random events, ambush other players (even when they're offline), and compete for the highest score on the global leaderboard."*

### Core Gameplay Loop
```
1. Start New Run → Spawn on random hex with starting stats
2. Move on Grid → Choose direction each turn
3. Resolve Movement:
   ├─ Empty Hex → Random Encounter (gift or danger)
   └─ Occupied Hex → Combat Choice (fight or flee)
4. Survive & Accumulate Score → Kills, loot, exploration
5. Death → Run Ends
6. Register Run → Submit score to leaderboard (optional)
7. Repeat → Start new run with fresh stats
```

### Unique Selling Points
1. **Fog of War**: Players cannot see each other's positions
2. **Asynchronous Combat**: Attack offline players; no simultaneous presence required
3. **Flee Mechanic**: Tactical choice between fighting and escaping
4. **Run-Based Scoring**: Each life is a "run" that can be registered to leaderboard
5. **Fully Onchain**: All game logic verifiable on Starknet

---

## Game Mechanics

### 1. Grid System

#### Hex Grid Structure
- **Grid Size**: 10x10 hexagonal grid (100 total cells)
- **Coordinate System**: Axial coordinates (q, r)
- **Player Capacity**: Maximum 50 players simultaneously (sparse occupancy)
- **Topology**: Bounded grid (edges are impassable)

#### Movement
- **Turns**: Asynchronous - players move at their own pace
- **Movement Cost**: 1 action per move
- **Valid Moves**: 6 adjacent hexes (NE, E, SE, SW, W, NW)
- **Turn Timer**: No strict timer; players can take as long as needed per move
- **Collision**: Moving to an occupied hex triggers combat interaction

#### Fog of War
- **Visibility**: Players can only see:
  - Their own position
  - Hexes they've previously visited (dimmed)
  - Immediate adjacent hexes (outline only, no player info)
- **Hidden Information**:
  - Other players' positions (unless you encounter them)
  - Other players' stats and HP
  - Other players' loot amounts

---

### 2. Player Stats System

#### Core Stats (Loot Survivor 2 Style)
Each player has 4 primary stats that determine combat effectiveness and survival:

| Stat | Full Name | Primary Effect | Secondary Effect |
|------|-----------|----------------|------------------|
| **STR** | Strength | +2 to Attack | Reduces flee chance for enemies |
| **DEX** | Dexterity | +1 to Attack & Defense | Increases flee success chance |
| **VIT** | Vitality | +2 to Defense | Increases max HP (+10 HP per point) |
| **LUK** | Luck | Improves encounters | Slight combat variance bonus |

#### Starting Stats
- **Total Points**: 20 points to distribute
- **Minimum per Stat**: 1
- **Maximum per Stat**: 10
- **Recommended Distributions**:
  - Balanced: STR 5, DEX 5, VIT 5, LUK 5
  - Tank: STR 4, DEX 3, VIT 10, LUK 3
  - Scout: STR 3, DEX 8, VIT 4, LUK 5
  - Berserker: STR 9, DEX 5, VIT 5, LUK 1

#### Derived Stats
- **Max HP**: 100 + (VIT × 10)
- **Starting HP**: Max HP
- **Starting Loot**: 0 gold

#### Stat Modifications During Run
- **Stat Boost Gift**: +1 to random stat (permanent for run)
- **Curse Danger**: -1 to random stat (permanent for run)
- **Death**: All stats reset to starting distribution for new run

---

### 3. Combat System

#### Combat Trigger
Combat occurs when a player moves to a hex occupied by another player (online or offline).

#### Combat Choice Flow
```
You encounter [PlayerName]!
Threat Level: 🟢 LOW / 🟡 MEDIUM / 🔴 HIGH

Your HP: 80 | Their HP: ???

┌──────────┐  ┌──────────┐
│  FIGHT   │  │   FLEE   │
└──────────┘  └──────────┘
```

**Threat Level Indicator** (based on relative stats):
- 🟢 **LOW**: Enemy likely weaker (combined stats < 80% of yours)
- 🟡 **MEDIUM**: Enemy similar strength (80-120% of yours)
- 🔴 **HIGH**: Enemy likely stronger (> 120% of yours)

---

#### Combat Resolution (FIGHT)

**Step 1: Calculate Attack & Defense**
```
Attacker Attack = (ATK_STR × 2) + (ATK_DEX × 1) + RANDOM(1, 20)
Attacker Defense = (ATK_VIT × 2) + (ATK_DEX × 1) + RANDOM(1, 20)

Defender Attack = (DEF_STR × 2) + (DEF_DEX × 1) + RANDOM(1, 20)
Defender Defense = (DEF_VIT × 2) + (DEF_DEX × 1) + RANDOM(1, 20)
```

**Step 2: Calculate Damage**
```
Attacker Damage Dealt = MAX(5, Attacker Attack - Defender Defense)
Defender Damage Dealt = MAX(5, Defender Attack - Attacker Defense)
```

**Step 3: Apply Damage**
```
Defender HP -= Attacker Damage Dealt
Attacker HP -= Defender Damage Dealt
```

**Step 4: Determine Winner**
- If **Defender HP ≤ 0**: Defender dies, Attacker wins
- If **Attacker HP ≤ 0**: Attacker dies, Defender wins
- If **Both HP > 0**: Both survive, combat ends

**Step 5: Loot Transfer**
```
Winner steals: MIN(Loser Loot × 0.30, Loser Loot)
Winner receives kill credit (if loser dies)
```

**Luck Modifier** (optional):
- Each point of LUK adds +1 variance to rolls
- High LUK = more consistent rolls, slightly higher average

---

#### Flee Mechanic

**Flee Probability Formula**
```cairo
base_flee_chance = 50

flee_modifier = (Attacker_DEX × 5)
                + (Attacker_LUK × 3)
                - (Defender_STR × 4)

flee_chance = CLAMP(base_flee_chance + flee_modifier, 10, 90)

// Roll for success
if RANDOM(1, 100) <= flee_chance:
    FLEE SUCCESS
else:
    FLEE FAILURE
```

**Flee Success**:
- Attacker moves to random adjacent hex (not the one they came from)
- No damage taken
- No loot exchanged
- Defender gets notification: "[Attacker] fled from you!"

**Flee Failure**:
- Combat happens normally
- Attacker takes **+20% extra damage** (penalty for failed flee)
- Defender gets notification: "[Attacker] tried to flee but failed!"

**Strategic Implications**:
- High DEX builds can be "scouts" (70-80% flee chance)
- High STR defenders "lock down" enemies (attackers have 20-30% flee chance)
- Fleeing is gambling: safe escape vs. worse combat

---

### 4. Encounter System

When a player moves to an **empty hex**, they trigger a random encounter.

#### Encounter Types

**Distribution**:
- **70% Gift** (beneficial)
- **30% Danger** (harmful)

**Luck Influence**:
```
Adjusted Gift Chance = 70% + (LUK × 1%)
// 5 LUK = 75% gift chance
// 10 LUK = 80% gift chance
```

---

#### Gift Encounters (70% base chance)

| Gift Type | Probability | Effect | Description |
|-----------|-------------|--------|-------------|
| **Small Loot** | 40% | +50 gold | A small pouch of coins |
| **Medium Loot** | 30% | +150 gold | A treasure chest |
| **Large Loot** | 10% | +400 gold | A dragon's hoard |
| **Stat Boost** | 10% | +1 random stat (permanent) | Ancient relic grants power |
| **HP Restore** | 10% | +30 HP (not exceeding max) | Healing fountain |

**Luck Modifier on Gift Quality**:
```
For loot gifts:
Bonus = RANDOM(0, LUK × 10) additional gold

For stat boost:
High LUK (≥7) = choose which stat to boost
Low LUK (<7) = random stat
```

---

#### Danger Encounters (30% base chance)

| Danger Type | Probability | Effect | Description |
|-------------|-------------|--------|-------------|
| **Trap** | 40% | -25 HP | Spike pit or arrow trap |
| **Bandit** | 30% | Lose 30% of carried loot OR -15 HP if broke | Ambushed by NPC thief |
| **Curse** | 15% | -1 random stat (permanent) | Dark magic weakens you |
| **Teleport** | 15% | Random teleport to any hex | Mysterious portal |

**Luck Modifier on Danger Severity**:
```
Damage Reduction = LUK × 2
// 5 LUK = -10 HP from trap instead of -25
// 10 LUK = -5 HP from trap

Curse Resist:
If LUK ≥ 8: 50% chance to resist curse entirely
```

---

#### Mercy Mechanic

To prevent death spirals:
```
If Player HP < 30:
    Gift encounters give +50% better rewards
    Danger encounters deal -30% less damage
```

---

### 5. Death & Run System

#### Death Conditions
- **HP reaches 0** (combat or danger)
- Run immediately ends
- Player removed from grid
- Score calculated

#### Death Screen
```
═══════════════════════════════════
        💀 RUN ENDED 💀
═══════════════════════════════════

Final Score: 8,450

📊 Run Stats:
• Turns Survived: 42
• PvP Kills: 3
• Loot Collected: 2,450
• Tiles Explored: 67
• Gifts Found: 12
• Dangers Survived: 8

🏆 Estimated Rank: #1
(based on current leaderboard)

┌────────────┐  ┌──────────────┐
│  REGISTER  │  │   DISCARD    │
│ (0.001 ETH)│  │    (Free)    │
└────────────┘  └──────────────┘

[VIEW LEADERBOARD]
═══════════════════════════════════
```

#### Registration
- **Cost**: ~0.001 ETH (gas fee)
- **Effect**: Permanently records run to leaderboard
- **Irreversible**: Cannot delete or modify after registration
- **Optional**: Players can discard bad runs

#### Discard
- **Cost**: Free (no transaction)
- **Effect**: Run data deleted, not recorded anywhere
- **Use Case**: Practice runs, bad starts, early deaths

---

### 6. Scoring System

#### Score Calculation Formula
```
Base Score = (Turns Survived × 10)
           + (PvP Kills × 500)
           + (Loot Collected × 1)
           + (Tiles Explored × 5)
           + (Gifts Collected × 20)
           + (Dangers Survived × 30)

Final Score = Base Score
```

**Example Calculation**:
```
Turns: 42 × 10 = 420
Kills: 3 × 500 = 1,500
Loot: 2,450 × 1 = 2,450
Tiles: 67 × 5 = 335
Gifts: 12 × 20 = 240
Dangers: 8 × 30 = 240

Total Score = 5,185
```

#### Score Component Weights
- **PvP Kills**: Highest value (500 pts each) - rewards combat
- **Survival**: Moderate value (10 pts/turn) - rewards longevity
- **Exploration**: Moderate value (5 pts/tile) - rewards map coverage
- **Loot**: Linear scaling (1:1) - rewards accumulation
- **Encounters**: Bonus value (20-30 pts) - rewards engagement

---

### 7. Leaderboard System

#### Structure
- **Global Leaderboard**: All registered runs across all players
- **Season-Based**: Leaderboards reset every 1-2 weeks
- **Persistent**: Historical data preserved across seasons

#### Current Leader Rules
```
Current Leader = Player with MAX(registered_score) in current season

Requirements:
✅ Run must be completed (player died)
✅ Run must be registered (player submitted)
❌ Active/alive runs do NOT count
```

#### Leaderboard Display
```
═══════════════════════════════════════════════════════════
            🏆 SEASON 3 LEADERBOARD 🏆
              Ends in: 3 days 14 hours
═══════════════════════════════════════════════════════════

Rank  Player           Score   Turns  Kills    Date
────────────────────────────────────────────────────────
 👑   Alice.stark      8,450    42     3      Jan 25
 🥈   Bob.stark        7,890    38     2      Jan 24
 🥉   Carol.stark      6,200    31     1      Jan 26
 4    Dave.stark       5,100    25     0      Jan 23
 5    Eve.stark        4,850    28     1      Jan 25
 ...
 47   You              2,100    15     0      Jan 22

[VIEW YOUR RUNS] [PREVIOUS SEASONS]
═══════════════════════════════════════════════════════════
```

#### Season Structure
- **Duration**: 1-2 weeks
- **Reset**: All player positions/HP/stats reset
- **Preservation**: Leaderboard frozen and archived
- **Rewards**: Top 10 players receive cosmetics/titles

#### Player Run History
Each player can view all their registered runs:
```
YOUR REGISTERED RUNS

Season 3:
├─ Run #12 | 8,450 pts | Rank #1  | 42 turns | 3 kills
└─ Run #11 | 2,100 pts | Rank #47 | 15 turns | 0 kills

Season 2:
├─ Run #10 | 5,600 pts | Rank #8  | 28 turns | 1 kill
├─ Run #9  | 3,200 pts | Rank #23 | 19 turns | 0 kills
└─ Run #8  | 1,800 pts | Rank #55 | 12 turns | 0 kills
```

---

## Technical Specifications

### Smart Contract Architecture

#### Contract Structure
```
contracts/
├── src/
│   ├── models/
│   │   ├── player.cairo
│   │   ├── game.cairo
│   │   └── leaderboard.cairo
│   ├── systems/
│   │   ├── movement.cairo
│   │   ├── combat.cairo
│   │   ├── encounter.cairo
│   │   └── scoring.cairo
│   └── lib.cairo
```

---

#### Core Models

**Player Model**
```cairo
#[derive(Model, Copy, Drop, Serde)]
struct Player {
    #[key]
    player_address: ContractAddress,
    #[key]
    run_id: u64,

    // Position
    position_q: i32,
    position_r: i32,

    // Stats
    strength: u8,
    dexterity: u8,
    vitality: u8,
    luck: u8,

    // State
    current_hp: u32,
    max_hp: u32,
    loot: u32,
    is_alive: bool,

    // Run tracking
    turns_survived: u32,
    kills: u32,
    tiles_explored: u32,
    gifts_collected: u32,
    dangers_survived: u32,

    // Registration
    is_registered: bool,
    final_score: u32,
}
```

**Game Model**
```cairo
#[derive(Model, Copy, Drop, Serde)]
struct Game {
    #[key]
    game_id: u32,

    season_id: u32,
    grid_width: u8,
    grid_height: u8,
    active_players: u32,
    start_time: u64,
    end_time: u64,
}
```

**LeaderboardEntry Model**
```cairo
#[derive(Model, Copy, Drop, Serde)]
struct LeaderboardEntry {
    #[key]
    season_id: u32,
    #[key]
    entry_id: u64,

    player_address: ContractAddress,
    score: u32,
    turns_survived: u32,
    kills: u32,
    loot_collected: u32,
    timestamp: u64,
    rank: u32,
}
```

---

#### Core Systems

**Movement System**
```cairo
#[dojo::interface]
trait IMovement {
    fn move_player(ref world: IWorldDispatcher, direction: Direction);
    fn get_adjacent_hexes(position: (i32, i32)) -> Array<(i32, i32)>;
    fn is_valid_position(position: (i32, i32)) -> bool;
}
```

**Combat System**
```cairo
#[dojo::interface]
trait ICombat {
    fn initiate_combat(
        ref world: IWorldDispatcher,
        defender_address: ContractAddress,
        action: CombatAction // FIGHT or FLEE
    ) -> CombatResult;

    fn resolve_combat(
        attacker: Player,
        defender: Player
    ) -> CombatResult;

    fn calculate_flee_chance(
        attacker: Player,
        defender: Player
    ) -> u8;
}

#[derive(Serde, Drop, Copy)]
enum CombatAction {
    Fight,
    Flee,
}

#[derive(Serde, Drop, Copy)]
struct CombatResult {
    attacker_survived: bool,
    defender_survived: bool,
    attacker_damage_taken: u32,
    defender_damage_taken: u32,
    loot_transferred: u32,
    flee_successful: bool,
}
```

**Encounter System**
```cairo
#[dojo::interface]
trait IEncounter {
    fn trigger_encounter(ref world: IWorldDispatcher) -> EncounterResult;
    fn roll_encounter_type(luck: u8) -> EncounterType;
}

#[derive(Serde, Drop, Copy)]
enum EncounterType {
    Gift,
    Danger,
}

#[derive(Serde, Drop, Copy)]
struct EncounterResult {
    encounter_type: EncounterType,
    gold_change: i32,
    hp_change: i32,
    stat_change: Option<(StatType, i8)>,
    message: ByteArray,
}
```

**Scoring System**
```cairo
#[dojo::interface]
trait IScoring {
    fn calculate_score(player: Player) -> u32;
    fn register_run(ref world: IWorldDispatcher, run_id: u64);
    fn get_leaderboard(season_id: u32, limit: u32) -> Array<LeaderboardEntry>;
    fn get_current_leader(season_id: u32) -> ContractAddress;
}
```

---

#### Events

```cairo
#[event]
#[derive(Drop, starknet::Event)]
enum Event {
    PlayerSpawned: PlayerSpawned,
    PlayerMoved: PlayerMoved,
    CombatResolved: CombatResolved,
    EncounterTriggered: EncounterTriggered,
    PlayerDied: PlayerDied,
    RunRegistered: RunRegistered,
    NewLeader: NewLeader,
}

#[derive(Drop, starknet::Event)]
struct PlayerSpawned {
    player: ContractAddress,
    run_id: u64,
    position: (i32, i32),
    stats: (u8, u8, u8, u8), // STR, DEX, VIT, LUK
}

#[derive(Drop, starknet::Event)]
struct PlayerMoved {
    player: ContractAddress,
    from: (i32, i32),
    to: (i32, i32),
    turn: u32,
}

#[derive(Drop, starknet::Event)]
struct CombatResolved {
    attacker: ContractAddress,
    defender: ContractAddress,
    attacker_damage: u32,
    defender_damage: u32,
    loot_stolen: u32,
    attacker_died: bool,
    defender_died: bool,
    flee_attempted: bool,
    flee_successful: bool,
}

#[derive(Drop, starknet::Event)]
struct EncounterTriggered {
    player: ContractAddress,
    position: (i32, i32),
    encounter_type: EncounterType,
    result: ByteArray,
}

#[derive(Drop, starknet::Event)]
struct PlayerDied {
    player: ContractAddress,
    run_id: u64,
    final_score: u32,
    turns_survived: u32,
    kills: u32,
}

#[derive(Drop, starknet::Event)]
struct RunRegistered {
    player: ContractAddress,
    run_id: u64,
    score: u32,
    rank: u32,
    season_id: u32,
}

#[derive(Drop, starknet::Event)]
struct NewLeader {
    player: ContractAddress,
    score: u32,
    season_id: u32,
}
```

---

### Randomness Implementation

**Approach**: Deterministic pseudo-randomness using block hash + player inputs

```cairo
fn get_random(seed: felt252, range: u32) -> u32 {
    let block_hash = starknet::get_block_info().unbox().block_hash;
    let hash = pedersen(pedersen(block_hash, seed), starknet::get_block_timestamp());
    let random_felt: felt252 = hash.into();
    let random_u256: u256 = random_felt.into();
    (random_u256 % range.into()).try_into().unwrap()
}

// Usage
let combat_roll = get_random(
    pedersen(attacker.player_address.into(), defender.player_address.into()),
    20
) + 1; // 1-20
```

**Seed Sources**:
- Block hash (changes each block)
- Player addresses (unique per combat)
- Timestamp (changes over time)
- Turn number (sequential)

---

### Anti-Cheat Measures

1. **Immutable Run Data**: Once registered, runs cannot be modified
2. **Verifiable Combat**: All combat deterministic based on stats + block data
3. **No Run Deletion**: Players cannot cherry-pick which runs appear in history
4. **Gas Cost Registration**: Prevents spam submissions
5. **Timestamped Actions**: All moves and combats timestamped
6. **Public Leaderboard**: All entries verifiable onchain

---

## User Experience

### Player Journey

#### 1. Onboarding (First-Time Player)
```
Welcome to UNTITLED!

A fully onchain battle royale where you:
• Explore a fog-of-war hex grid
• Encounter random events
• Battle other players (even offline!)
• Compete for the highest score

Let's create your first character.

[CONTINUE]
```

#### 2. Character Creation
```
═══════════════════════════════════
       CHARACTER CREATION
═══════════════════════════════════

Distribute 20 points across 4 stats:

STR (Strength)    [━━━━━━━━━━] 5
  Increases attack power

DEX (Dexterity)   [━━━━━━━━━━] 5
  Improves attack, defense & flee

VIT (Vitality)    [━━━━━━━━━━] 5
  Increases defense & max HP

LUK (Luck)        [━━━━━━━━━━] 5
  Better encounters, slight combat bonus

Points Remaining: 0

[TEMPLATES: Balanced | Tank | Scout | Berserker]

[START RUN]
═══════════════════════════════════
```

#### 3. Spawning
```
You spawn in the wilderness...

Position: Unknown
HP: 150/150
Loot: 0 gold

The fog surrounds you.
Choose your path carefully.

[Hex grid appears with 6 movement options]
```

#### 4. Movement Interface
```
        [NW] [NE]
          ╲  ╱
    [W] ── YOU ── [E]
          ╱  ╲
        [SW] [SE]

Turn: 1
HP: 150/150
Loot: 0 gold
Score: 10

Recent Events:
• Spawned in the wilderness

[Choose direction to move]
```

#### 5. Empty Hex (Encounter)
```
You explore the hex...

🎁 GIFT ENCOUNTER!

You found a treasure chest!
+150 gold

HP: 150/150
Loot: 150 gold
Score: 40

[CONTINUE]
```

#### 6. Occupied Hex (Combat Choice)
```
⚔️  PLAYER ENCOUNTERED! ⚔️

You encounter Bob.stark!
Threat Level: 🟡 MEDIUM

Your HP: 150 | Their HP: ???

┌──────────────────┐  ┌──────────────────┐
│      FIGHT       │  │      FLEE        │
│                  │  │   (65% chance)   │
└──────────────────┘  └──────────────────┘

[Choose your action]
```

#### 7. Combat Result (Victory)
```
⚔️  COMBAT! ⚔️

You attack Bob.stark!

Your attack: 45
Their defense: 32
Damage dealt: 13

Their counter-attack: 28
Your defense: 30
Damage dealt: 0

🎉 VICTORY! 🎉

You dealt 13 damage
You took 0 damage
You stole 120 gold

HP: 150/150 → 150/150
Loot: 150 → 270 gold
Kills: 0 → 1

+500 score (PvP Kill)

[CONTINUE]
```

#### 8. Flee Result (Success)
```
💨 FLEE ATTEMPT! 💨

You try to escape from Bob.stark...

Flee chance: 65%
Roll: 42

✅ SUCCESS! ✅

You escaped to safety!
No damage taken.

HP: 150/150
Loot: 270 gold

[CONTINUE]
```

#### 9. Death
```
⚠️  DANGER ENCOUNTER! ⚠️

You trigger a spike trap!
-25 HP

HP: 25/150 → 0/150

💀 YOU DIED! 💀

═══════════════════════════════════
        RUN SUMMARY
═══════════════════════════════════

Final Score: 8,450

📊 Statistics:
• Turns Survived: 42
• PvP Kills: 3
• Loot Collected: 2,450
• Tiles Explored: 67
• Gifts Found: 12
• Dangers Survived: 8

🏆 Estimated Rank: #1

┌────────────┐  ┌──────────────┐
│  REGISTER  │  │   DISCARD    │
│ (~0.001Ξ)  │  │    (Free)    │
└────────────┘  └──────────────┘

[VIEW LEADERBOARD]
═══════════════════════════════════
```

#### 10. Registration Success
```
RUN REGISTERED! 

Score: 8,450
Rank: #1 👑

YOU ARE NOW THE LEADER!

This run is now permanently
recorded on the leaderboard.

┌────────────────────────────┐
│    START NEW RUN           │
└────────────────────────────┘

[VIEW LEADERBOARD] [VIEW STATS]
```

---

### Notification System

#### While Offline
Players receive notifications for events that occurred while they were away:

```
⚠️  WHILE YOU WERE AWAY ⚠️

Your run #42 (Active):
├─ Attacked by Alice.stark
│  └─ Lost 30 HP, 200 gold stolen
├─ Attacked by Bob.stark
│  └─ They fled successfully!
└─ Attacked by Carol.stark
   └─ Lost 45 HP, 350 gold stolen

Current Status:
HP: 75/150
Loot: 900 gold

[CONTINUE RUN] [VIEW DETAILS]
```

---

## Balance & Tuning

### Combat Balance

**Design Goals**:
- High-stat players have advantage but not guaranteed wins
- Luck/randomness prevents perfect prediction
- Fleeing is viable for scouts
- Tanks can lock down enemies

**Validation Scenarios**:

| Attacker Stats | Defender Stats | Expected Outcome |
|----------------|----------------|------------------|
| STR 8, DEX 5, VIT 5, LUK 2 | STR 3, DEX 8, VIT 4, LUK 5 | Attacker likely wins, defender can flee (70%) |
| STR 4, DEX 3, VIT 10, LUK 3 | STR 9, DEX 5, VIT 5, LUK 1 | Long combat, tank survives, berserker wins narrowly |
| STR 5, DEX 5, VIT 5, LUK 5 | STR 5, DEX 5, VIT 5, LUK 5 | 50/50, random variance decides |

**Target Win Rates by Build**:
- Berserker vs Scout: 60% (scout flees 70% of time)
- Tank vs Berserker: 55% (tank survives longer)
- Balanced vs Any: 45-55% (versatile but not dominant)

---

### Encounter Balance

**Gift vs Danger Distribution**:
- Base: 70% gift / 30% danger
- With 5 LUK: 75% gift / 25% danger
- With 10 LUK: 80% gift / 20% danger

**Expected Value per Encounter**:
```
Gift EV (base):
(0.4 × 50) + (0.3 × 150) + (0.1 × 400) + (0.1 × stat) + (0.1 × 30HP)
= 20 + 45 + 40 + [10-20] + [5-10]
= ~120-135 value

Danger EV (base):
(0.4 × -25HP) + (0.3 × -100g) + (0.15 × stat) + (0.15 × 0)
= -40 value (HP) -30 value (gold)
= ~-70 value

Net EV: (0.7 × 120) - (0.3 × 70) = 84 - 21 = +63 value per tile
```

**Conclusion**: Exploration is profitable on average, encouraging movement.

---

### Score Balance

**Target Score Ranges (Good Run)**:
- 10 turns, 0 kills: ~1,500 points (exploration focus)
- 20 turns, 1 kill: ~3,200 points (balanced)
- 30 turns, 2 kills: ~5,800 points (strong run)
- 40+ turns, 3+ kills: 8,000+ points (excellent run)

**Leaderboard Expectations**:
- Top 1%: 8,000+ points
- Top 10%: 5,000+ points
- Top 50%: 2,500+ points
- Average: ~2,000 points

---

## Development Roadmap

### Phase 1: Core Contracts (Week 1-2)
**Goal**: Functional onchain game logic

- [ ] Set up Dojo project structure
- [ ] Implement Player model and spawning
- [ ] Implement hex grid movement system
- [ ] Implement basic combat (no flee yet)
- [ ] Implement encounter system (gifts/dangers)
- [ ] Write unit tests for core systems

**Deliverable**: Testable smart contracts on local Katana node

---

### Phase 2: Advanced Features (Week 3)
**Goal**: Complete game mechanics

- [ ] Implement flee mechanic
- [ ] Implement stat modification (boosts/curses)
- [ ] Implement scoring system
- [ ] Implement leaderboard registration
- [ ] Implement season management
- [ ] Add event emissions for all actions
- [ ] Write integration tests

**Deliverable**: Feature-complete contracts deployed to testnet

---

### Phase 3: Frontend (Week 4-5)
**Goal**: Playable UI

- [ ] Set up React + TypeScript project
- [ ] Implement hex grid renderer (Phaser.js or CSS)
- [ ] Implement wallet connection (Argent/Braavos)
- [ ] Build character creation screen
- [ ] Build movement interface
- [ ] Build combat UI (fight/flee choice)
- [ ] Build encounter notifications
- [ ] Build death screen
- [ ] Build leaderboard display
- [ ] Implement event listener for onchain updates

**Deliverable**: Fully playable web app

---

### Phase 4: Polish & Launch (Week 6)
**Goal**: Production-ready demo

- [ ] Balance tuning (combat, encounters, scoring)
- [ ] Add sound effects
- [ ] Add animations (combat, movement, encounters)
- [ ] Optimize contract gas usage
- [ ] Security audit (basic)
- [ ] Write comprehensive README
- [ ] Record 2-minute demo video
- [ ] Deploy to mainnet (optional)
- [ ] Publish to portfolio/GitHub

**Deliverable**: Portfolio-ready project

---

### Future Enhancements (Post-MVP)

**Gameplay**:
- [ ] Power-ups: Vision (see nearby players for 3 turns), Shield (immune to next attack)
- [ ] Territory control: Claim hexes for passive loot generation
- [ ] Guild system: Team-based scoring
- [ ] Boss encounters: High-risk, high-reward NPCs

**Technical**:
- [ ] Implement VRF for true randomness
- [ ] Optimize with batched moves (submit multiple moves at once)
- [ ] Add replay system (watch past runs)
- [ ] Implement AI opponents for testing/practice

**Social**:
- [ ] Player profiles with stats
- [ ] Achievement system
- [ ] Cosmetic NFTs (skins, titles, borders)
- [ ] Tournament mode with entry fees/prizes

---

## Art & Audio Direction

### Visual Style
**Aesthetic**: Minimalist, high-contrast, sci-fi/tactical

**Color Palette**:
- Background: Dark navy (#0a0e27)
- Grid lines: Cyan (#00d9ff)
- Player (you): Bright green (#00ff88)
- Other players (when visible): Red (#ff0055)
- Gifts: Gold (#ffd700)
- Dangers: Purple (#9d00ff)
- UI elements: White/cyan

**Reference Games**:
- Into the Breach (hex grid)
- FTL: Faster Than Light (UI clarity)
- SUPERHOT (minimalism)

### UI/UX Mockups

**Main Game Screen Layout**:
```
┌─────────────────────────────────────────────────┐
│ HP: 150/150 | Loot: 450g | Score: 2,340 | T:12 │ ← Status Bar
├─────────────────────────────────────────────────┤
│                                                 │
│                                                 │
│            [Hex Grid Renderer]                  │
│                                                 │
│              Your Position: Green Hex           │
│          Surrounding 6 hexes outlined           │
│                                                 │
│                                                 │
├─────────────────────────────────────────────────┤
│ Recent: You found a treasure chest! +150g      │ ← Event Log
├─────────────────────────────────────────────────┤
│ [NW] [NE] [W] [E] [SW] [SE] | [LEADERBOARD]   │ ← Controls
└─────────────────────────────────────────────────┘
```

### Sound Design

**Sound Effects**:
- Movement: Soft "whoosh"
- Gift encounter: Bright "chime"
- Danger encounter: Ominous "rumble"
- Combat attack: Sharp "clash"
- Damage taken: Dull "thud"
- Victory: Triumphant "fanfare"
- Death: Dramatic "crash"
- Flee success: Quick "dash"
- Flee failure: Strained "grunt"

**Ambient**:
- Subtle background drone (tension)
- No music (keeps focus on strategic thinking)

---

## Success Metrics

### Goals

**Primary Goal**: Demonstrate Cairo/Dojo proficiency
- Complex state management
- Multiple interacting systems
- Event-driven architecture
- Efficient data structures

**Secondary Goal**: Show game design skills
- Balanced mechanics
- Clear win conditions
- Engaging player experience
- Replayability

**Tertiary Goal**: Completeness
- Polished UI
- Comprehensive documentation
- Demo video
- Deployed and playable

---

## Appendix

### Glossary

- **Run**: A single playthrough from spawn to death
- **Season**: A 1-2 week period with a fresh leaderboard
- **Hex**: A single cell on the hexagonal grid
- **Fog of War**: Limited visibility mechanic (can't see other players)
- **Encounter**: Random event when moving to empty hex
- **Gift**: Beneficial encounter (loot, HP, stat boost)
- **Danger**: Harmful encounter (trap, bandit, curse, teleport)
- **Flee**: Combat action to attempt escape
- **Registration**: Submitting a completed run to the leaderboard
- **Current Leader**: Player with highest registered score in current season

### FAQs

**Q: Can I see where other players are?**
A: No, except when you directly encounter them on the same hex.

**Q: What happens if I encounter a player who's offline?**
A: Combat happens normally using their current stats. They get notified when they return.

**Q: Can I delete a bad run from the leaderboard?**
A: No, once registered, runs are permanent.

**Q: Can I play multiple runs simultaneously?**
A: No, you can only have one active run at a time.

**Q: What happens to my old runs when a season ends?**
A: They're preserved in historical leaderboards forever.

**Q: How does luck affect gameplay?**
A: Luck improves encounter probabilities, gift quality, danger resistance, and slightly helps in combat.

**Q: Can I change my stats during a run?**
A: Yes, through Stat Boost gifts (positive) or Curses (negative).

**Q: Is there permadeath?**
A: Yes per run, but you can immediately start a new run with fresh stats.

**Q: How long should a run take?**
A: 10-30 minutes for a typical run, depending on playstyle.

**Q: What's the best strategy?**
A: Depends on your build! Tanks should fight, scouts should explore and flee, berserkers should hunt.

---

### Technical References

**Cairo Documentation**: https://book.cairo-lang.org/
**Dojo Documentation**: https://book.dojoengine.org/
**Starknet Documentation**: https://docs.starknet.io/

**Hex Grid Algorithms**: https://www.redblobgames.com/grids/hexagons/

**Game Balance Resources**:
- "Game Balance Concepts" by Ian Schreiber
- "Theory of Fun for Game Design" by Raph Koster

---

### Version History

**v1.0** (Current) - Initial GDD
- Core mechanics defined
- Technical architecture specified
- Development roadmap outlined

---

## Contact & Credits

**Developer**: [FemiOje](https://github.com/FemiOje)

**GitHub**:  [untitled](https://github.com/FemiOje/untitled)

**Demo**: [coming soon]

**Twitter**: [@0xjinius](https://x.com/0xjinius)

**Built With**:
- Cairo programming language
- Dojo game engine
- Starknet L2

---

*Last Updated: January 27, 2026*
