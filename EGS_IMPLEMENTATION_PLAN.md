# Embeddable Game Standard (EGS) Implementation Plan for Hex'd

**Timeline**: 2 days (game jam)
**Goal**: Make Hex'd a fully EGS-compliant embeddable minigame that can be minted, scored, and embedded by any EGS-compatible platform (Budokan tournaments, Eternum quests, Denshokan).

---

## Context

### What is EGS?

The Embeddable Game Standard is an open protocol by Provable Games for composable on-chain games on Starknet. It defines how games expose scoring/completion state, how platforms mint game tokens, and how frontends display game data.

**Docs**: https://docs.provable.games/embeddable-game-standard

### Why integrate?

Once Hex'd implements EGS, it can be:
- Listed on the Denshokan game registry (alongside Loot Survivor, Dark Shuffle, zKube, Nums, Dope Wars)
- Used in Budokan permissionless tournaments with entry fees and prize pools
- Embedded as quests in Eternum's MMO
- Minted as ERC721 NFTs representing individual game sessions

### Hex'd Current State

| Aspect | Value |
|--------|-------|
| Cairo | 2.15.0 |
| Dojo | 1.8.0 |
| Contract | Single `game_systems` in namespace `untitled` |
| game_id type | `u32` (from `world.uuid()`) |
| Score metric | `PlayerStats.xp` |
| Game over condition | `GameSession.is_active == false` (HP reaches 0) |
| Tests | 75 passing |

### Key Design Decisions

1. **Native felt252 token_id**: Migrate the entire codebase from `u32 game_id` to `felt252 token_id`. No bridge model — EGS token IDs are used directly as Dojo model keys. This eliminates the mapping layer and gives direct EGS compatibility.

2. **Modify existing functions**: `spawn()` and `move()` are modified in-place with EGS hooks. No backward-compatible duplicates (`egs_spawn`/`egs_move`). We are deploying fresh.

---

## Architecture Overview

Following the proven **Death Mountain pattern** — separate Dojo system contracts for EGS interfaces, with the core game contract using felt252 token IDs natively.

### Contract Map (After Integration)

```
contracts/src/
  systems/
    game/
      contracts.cairo         # MODIFIED: felt252 token_id, spawn receives token_id, pre/post hooks
      tests.cairo             # MODIFIED: all tests updated for felt252 token_id flow
    game_token/
      contracts.cairo         # NEW: MinigameComponent + IMinigameTokenData
    renderer/
      contracts.cairo         # NEW: IMinigameDetails (game state as NFT metadata)
  models.cairo                # MODIFIED: all game_id: u32 → token_id: felt252
  lib.cairo                   # MODIFIED: register new modules
  helpers/
    combat.cairo              # MODIFIED: u32 → felt252 signatures
    encounter.cairo           # MODIFIED: u32 → felt252 signatures
    movement.cairo            # MODIFIED: u32 → felt252 signatures
  utils/
    hex.cairo                 # MODIFIED: TileOccupant.token_id check
```

### External Contracts (from game-components)

```toml
build-external-contracts = [
    "dojo::world::world_contract::world",
    "game_components_embeddable_game_standard::token::examples::full_token_contract::FullTokenContract",
    "game_components_embeddable_game_standard::token::examples::minigame_registry_contract::MinigameRegistryContract",
]
```

### Data Flow

```
Platform/Player                 MinigameToken              game_token_systems           game_systems
      │                         (ERC721 NFT)             (MinigameComponent)          (Game Logic)
      │                              │                          │                          │
      │── mint(game_addr, ...) ─────▶│                          │                          │
      │◀── token_id (felt252) ───────│                          │                          │
      │                              │                          │                          │
      │── spawn(token_id) ────────────────────────────────────────────────────────────────▶│
      │                              │                  assert_token_ownership             │
      │                              │◀── pre_action ── is_playable? ──────────────────────│
      │                              │                          │            create game    │
      │                              │── post_action ──▶ update_game() ◀── score/game_over │
      │                              │                          │                          │
      │── move(token_id, dir) ───────────────────────────────────────────────────────────▶│
      │                              │                  assert_token_ownership             │
      │                              │◀── pre_action ── is_playable? ──────────────────────│
      │                              │                          │         resolve move      │
      │                              │── post_action ──▶ update_game() ◀── score/game_over │
```

---

## Detailed Implementation

### Step 1: Add Dependencies

**File**: `contracts/Scarb.toml`

```toml
[dependencies]
dojo = "1.8.0"
starknet = "2.15.0"
game_components_embeddable_game_standard = { git = "https://github.com/Provable-Games/game-components", branch = "next" }
game_components_interfaces = { git = "https://github.com/Provable-Games/game-components", branch = "next" }
openzeppelin_introspection = { git = "https://github.com/OpenZeppelin/cairo-contracts.git", tag = "v3.0.0" }

[[target.starknet-contract]]
build-external-contracts = [
    "dojo::world::world_contract::world",
    "game_components_embeddable_game_standard::token::examples::full_token_contract::FullTokenContract",
    "game_components_embeddable_game_standard::token::examples::minigame_registry_contract::MinigameRegistryContract",
]
```

> **Risk**: Cairo 2.15.0 vs 2.15.1 mismatch. Mitigation: bump Hexed to `cairo-version = "2.15.1"` and `starknet = "2.15.1"` if needed. If the "next" branch has incompatible Dojo assumptions, fall back to a specific tagged release or commit.

### Step 2: Migrate Models to felt252 token_id

**File**: `contracts/src/models.cairo`

All `game_id: u32` model keys become `token_id: felt252`. The sentinel value `0` is preserved for "empty" checks.

```cairo
use starknet::ContractAddress;

// ... constants unchanged ...

#[derive(Copy, Drop, Serde, Debug)]
#[dojo::model]
pub struct GameSession {
    #[key]
    pub token_id: felt252,       // was game_id: u32
    pub player: ContractAddress,
    pub is_active: bool,
}

#[derive(Copy, Drop, Serde, Debug)]
#[dojo::model]
pub struct PlayerState {
    #[key]
    pub token_id: felt252,       // was game_id: u32
    pub position: Vec2,
    pub last_direction: Option<Direction>,
    pub can_move: bool,
}

#[derive(Copy, Drop, Serde, Debug)]
#[dojo::model]
pub struct TileOccupant {
    #[key]
    pub x: i32,
    #[key]
    pub y: i32,
    pub token_id: felt252,       // was game_id: u32  (0 = empty)
}

#[derive(Copy, Drop, Serde, Debug)]
#[dojo::model]
pub struct PlayerStats {
    #[key]
    pub token_id: felt252,       // was game_id: u32
    pub hp: u32,
    pub max_hp: u32,
    pub xp: u32,
}

#[derive(Copy, Drop, Serde, Debug)]
#[dojo::model]
pub struct HighestScore {
    #[key]
    pub token_id: felt252,       // was game_id: u32  (always 0 for singleton)
    pub player: ContractAddress,
    pub username: felt252,
    pub xp: u32,
}

#[derive(Copy, Drop, Serde, Debug)]
#[dojo::model]
pub struct GameCounter {
    #[key]
    pub token_id: felt252,       // was game_id: u32  (always 0 for singleton)
    pub active_games: u32,
}

#[derive(Copy, Drop, Serde)]
pub struct GameState {
    pub token_id: felt252,       // was game_id: u32
    pub player: ContractAddress,
    pub position: Vec2,
    pub last_direction: Option<Direction>,
    pub can_move: bool,
    pub is_active: bool,
    pub hp: u32,
    pub max_hp: u32,
    pub xp: u32,
    pub neighbor_occupancy: u8,
}
```

**Singleton pattern**: `HighestScore` and `GameCounter` keep using `0` as their key — `0` as felt252 works identically.

### Step 3: Update Helper Signatures

All helpers change `game_id: u32` → `token_id: felt252` in their function signatures. The logic is unchanged — these are mechanical renames.

**`helpers/combat.cairo`**:
```cairo
pub fn has_active_defender(ref world: WorldStorage, defender_token_id: felt252) -> bool {
    if defender_token_id != 0 {
        let defender_session: GameSession = world.read_model(defender_token_id);
        defender_session.is_active
    } else {
        false
    }
}

pub fn resolve_combat(
    ref world: WorldStorage,
    token_id: felt252,
    defender_token_id: felt252,
    ref state: PlayerState,
    direction: Direction,
) -> CombatOutcome { ... }

pub fn handle_player_death(
    ref world: WorldStorage, token_id: felt252, position: Vec2, killed_by: felt252,
) { ... }
```

**`helpers/movement.cairo`**:
```cairo
pub fn execute_move(
    ref world: WorldStorage,
    token_id: felt252,
    ref state: PlayerState,
    next_position: Vec2,
    direction: Direction,
) { ... }
```

**`helpers/encounter.cairo`**:
```cairo
fn generate_rolls(token_id: felt252, position: Vec2) -> (u8, u8) {
    // token_id is already felt252 — no .into() needed for Poseidon hash
    let mut state = PoseidonTrait::new();
    state = state.update(token_id);
    state = state.update(position.x.into());
    state = state.update(position.y.into());
    state = state.update(timestamp.into());
    ...
}

pub fn resolve_encounter(
    ref world: WorldStorage, token_id: felt252, position: Vec2,
) -> EncounterResult { ... }
```

**`utils/hex.cairo`**: Only change is `tile.game_id` → `tile.token_id` in `get_neighbor_occupancy`.

### Step 4: Create game_token_systems Contract

**File**: `contracts/src/systems/game_token/contracts.cairo` (NEW)

This contract embeds MinigameComponent + SRC5Component and implements IMinigameTokenData. Since models are now keyed by felt252 token_id directly, no bridge lookup is needed.

```cairo
#[dojo::contract]
mod game_token_systems {
    use game_components_embeddable_game_standard::minigame::interface::{
        IMINIGAME_ID, IMinigameTokenData
    };
    use game_components_embeddable_game_standard::minigame::minigame_component::MinigameComponent;
    use openzeppelin_introspection::src5::SRC5Component;
    use hexed::constants::constants::DEFAULT_NS;
    use hexed::models::{GameSession, PlayerStats};
    use dojo::model::ModelStorage;
    use dojo::world::{WorldStorage, WorldStorageTrait};
    use starknet::ContractAddress;

    component!(path: MinigameComponent, storage: minigame, event: MinigameEvent);
    component!(path: SRC5Component, storage: src5, event: SRC5Event);

    #[abi(embed_v0)]
    impl MinigameImpl = MinigameComponent::MinigameImpl<ContractState>;
    impl MinigameInternalImpl = MinigameComponent::InternalImpl<ContractState>;

    #[abi(embed_v0)]
    impl SRC5Impl = SRC5Component::SRC5Impl<ContractState>;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        minigame: MinigameComponent::Storage,
        #[substorage(v0)]
        src5: SRC5Component::Storage,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        MinigameEvent: MinigameComponent::Event,
        #[flat]
        SRC5Event: SRC5Component::Event,
    }

    fn dojo_init(
        ref self: ContractState,
        creator_address: ContractAddress,
        denshokan_address: ContractAddress,
    ) {
        self.src5.register_interface(IMINIGAME_ID);

        self.minigame.initializer(
            creator_address,
            "Hexed",
            "Fully onchain async battle royale with fog of war on a hex grid",
            "FemiOje",
            "FemiOje",
            "Battle Royale",
            "",
            Option::None,   // color
            Option::None,   // client_url
            Option::None,   // renderer_address
            Option::None,   // settings_address
            Option::None,   // objectives_address
            denshokan_address,
        );
    }

    /// IMinigameTokenData — reads directly from models keyed by token_id
    #[abi(embed_v0)]
    impl GameTokenDataImpl of IMinigameTokenData<ContractState> {
        fn score(self: @ContractState, token_id: felt252) -> u64 {
            let world: WorldStorage = self.world(@DEFAULT_NS());
            let stats: PlayerStats = world.read_model(token_id);
            stats.xp.into()
        }

        fn game_over(self: @ContractState, token_id: felt252) -> bool {
            let world: WorldStorage = self.world(@DEFAULT_NS());
            let session: GameSession = world.read_model(token_id);
            !session.is_active
        }

        fn score_batch(self: @ContractState, token_ids: Span<felt252>) -> Array<u64> {
            let world: WorldStorage = self.world(@DEFAULT_NS());
            let mut results = array![];
            for token_id in token_ids {
                let stats: PlayerStats = world.read_model(*token_id);
                results.append(stats.xp.into());
            };
            results
        }

        fn game_over_batch(self: @ContractState, token_ids: Span<felt252>) -> Array<bool> {
            let world: WorldStorage = self.world(@DEFAULT_NS());
            let mut results = array![];
            for token_id in token_ids {
                let session: GameSession = world.read_model(*token_id);
                results.append(!session.is_active);
            };
            results
        }
    }
}
```

### Step 5: Modify game_systems (felt252 + EGS Hooks)

**File**: `contracts/src/systems/game/contracts.cairo` (MODIFIED)

Changes:
1. Interface uses `felt252 token_id` everywhere
2. `spawn(token_id: felt252)` receives token_id from EGS minting (no more `world.uuid()`)
3. `move(token_id: felt252, direction)` uses token_id directly
4. Both wrap logic with `assert_token_ownership` → `pre_action` → logic → `post_action`

```cairo
use hexed::models::{Direction, GameState};

#[starknet::interface]
pub trait IGameSystems<T> {
    fn spawn(ref self: T, token_id: felt252);
    fn move(ref self: T, token_id: felt252, direction: Direction);
    fn get_game_state(self: @T, token_id: felt252) -> GameState;
    fn register_score(ref self: T, player: starknet::ContractAddress, username: felt252, xp: u32);
    fn get_highest_score(self: @T) -> (starknet::ContractAddress, felt252, u32);
}
```

Implementation:

```cairo
#[dojo::contract]
pub mod game_systems {
    use game_components_embeddable_game_standard::minigame::minigame::{
        assert_token_ownership, pre_action, post_action,
    };
    // ... existing imports with game_id renamed to token_id ...

    // Events: all game_id: u32 fields become token_id: felt252
    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct Spawned {
        #[key]
        pub token_id: felt252,
        pub player: ContractAddress,
        pub position: Vec2,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct Moved {
        #[key]
        pub token_id: felt252,
        pub direction: Direction,
        pub position: Vec2,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct CombatResult {
        #[key]
        pub attacker_token_id: felt252,
        pub defender_token_id: felt252,
        // ... rest unchanged ...
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct PlayerDied {
        #[key]
        pub token_id: felt252,
        pub killed_by: felt252,
        pub position: Vec2,
    }

    // ... NeighborsRevealed, EncounterOccurred similarly updated ...

    #[abi(embed_v0)]
    impl GameSystemsImpl of IGameSystems<ContractState> {
        fn spawn(ref self: ContractState, token_id: felt252) {
            let mut world = self.world_default();
            let player = get_caller_address();

            // Resolve token address via Dojo DNS
            let token_address = self.get_token_address();

            // EGS hooks: ownership + playability
            assert_token_ownership(token_address, token_id);
            pre_action(token_address, token_id);

            // Check entry limit
            let mut counter: GameCounter = world.read_model(0);
            assert(counter.active_games < MAX_CONCURRENT_GAMES, 'game limit reached');
            counter.active_games += 1;
            world.write_model(@counter);

            // Create session (token_id is the key — no uuid needed)
            world.write_model(@GameSession { token_id, player, is_active: true });

            // Generate random spawn position
            let position = spawn::generate_spawn_position(player);

            // Initialize player state
            world.write_model(
                @PlayerState { token_id, position, last_direction: Option::None, can_move: true },
            );

            // Initialize player stats
            world.write_model(@PlayerStats { token_id, hp: STARTING_HP, max_hp: MAX_HP, xp: 0 });

            // Mark tile as occupied
            world.write_model(@TileOccupant { x: position.x, y: position.y, token_id });

            // Emit events
            world.emit_event(@Spawned { token_id, player, position });
            let neighbors = get_neighbor_occupancy(ref world, position);
            world.emit_event(@NeighborsRevealed { token_id, position, neighbors });

            // Sync state to token
            post_action(token_address, token_id);
        }

        fn move(ref self: ContractState, token_id: felt252, direction: Direction) {
            let mut world = self.world_default();
            let player = get_caller_address();

            // EGS hooks: ownership + playability
            let token_address = self.get_token_address();
            assert_token_ownership(token_address, token_id);
            pre_action(token_address, token_id);

            // Verify ownership
            let session: GameSession = world.read_model(token_id);
            assert(session.player == player, 'not your game');
            assert(session.is_active, 'game not active');

            // ... existing move logic with token_id instead of game_id ...

            // Sync state to token
            post_action(token_address, token_id);
        }

        fn get_game_state(self: @ContractState, token_id: felt252) -> GameState {
            // ... reads models by token_id directly ...
        }

        // register_score and get_highest_score unchanged (operate on singleton)
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn world_default(self: @ContractState) -> dojo::world::WorldStorage {
            self.world(@DEFAULT_NS())
        }

        /// Resolve token address via game_token_systems → MinigameComponent → token_address
        fn get_token_address(self: @ContractState) -> ContractAddress {
            let world = self.world_default();
            let (game_token_addr, _) = world.dns(@"game_token_systems").unwrap();
            let minigame = IMinigameDispatcher { contract_address: game_token_addr };
            minigame.token_address()
        }
    }
}
```

### Step 6: Create renderer_systems Contract (Day 2)

**File**: `contracts/src/systems/renderer/contracts.cairo` (NEW)

Reads directly from models keyed by token_id — no bridge lookup.

```cairo
#[dojo::contract]
mod renderer_systems {
    use game_components_embeddable_game_standard::minigame::interface::IMinigameDetails;
    use game_components_interfaces::structs::GameDetail;
    use hexed::models::{GameSession, PlayerState, PlayerStats};

    #[abi(embed_v0)]
    impl GameDetailsImpl of IMinigameDetails<ContractState> {
        fn game_details(self: @ContractState, token_id: felt252) -> Span<GameDetail> {
            let world = self.world(@DEFAULT_NS());
            let stats: PlayerStats = world.read_model(token_id);
            let state: PlayerState = world.read_model(token_id);
            let session: GameSession = world.read_model(token_id);

            array![
                GameDetail { name: "HP", value: format!("{}/{}", stats.hp, stats.max_hp) },
                GameDetail { name: "XP", value: format!("{}", stats.xp) },
                GameDetail { name: "Position", value: format!("({}, {})", state.position.x, state.position.y) },
                GameDetail { name: "Status", value: if session.is_active { "Alive" } else { "Dead" } },
            ].span()
        }

        fn token_name(self: @ContractState, token_id: felt252) -> ByteArray {
            "Hex'd Survivor"
        }

        fn token_description(self: @ContractState, token_id: felt252) -> ByteArray {
            "A survivor exploring the fog-of-war hex grid in Hex'd"
        }
    }
}
```

### Step 7: Update Module Tree

**File**: `contracts/src/lib.cairo`

```cairo
pub mod systems {
    pub mod game {
        pub mod contracts;
        #[cfg(test)]
        pub mod tests;
    }
    pub mod game_token {    // NEW
        pub mod contracts;
    }
    pub mod renderer {      // NEW (Day 2)
        pub mod contracts;
    }
}

pub mod helpers {
    pub mod combat;
    pub mod encounter;
    pub mod movement;
    pub mod spawn;
}

pub mod constants {
    pub mod constants;
}

pub mod models;

pub mod utils {
    pub mod hex;
    #[cfg(test)]
    pub mod setup;
}
```

### Step 8: Update Tests

All 75 tests need mechanical updates:
- `game_id: u32` → `token_id: felt252` in variable declarations
- Hardcoded values like `1_u32`, `999_u32` → `1`, `999` (felt252 literals)
- `spawn()` calls become `spawn(token_id)` with a test token_id
- Test setup needs game_token_systems registered in the test world
- Helper test functions (`fresh_stats`, `stats_with`) use `felt252` parameter

Example test update:
```cairo
// Before:
let game_id: u32 = 1;
game_systems.spawn();

// After:
let token_id: felt252 = 1;
game_systems.spawn(token_id);
```

> **Note**: Tests may need to mock the token contract for `assert_token_ownership` and `pre_action`/`post_action` to pass. Alternatively, if the token contract isn't deployed in the test world, we may need a test-only bypass or a mock token contract. This is the main testing complexity.

---

## Migration Summary: game_id → token_id

| File | Occurrences | Change Type |
|------|-------------|-------------|
| `models.cairo` | 9 | Model key type + GameState view struct |
| `systems/game/contracts.cairo` | 42 | Interface, events, spawn/move logic, EGS hooks |
| `systems/game/tests.cairo` | 209 | Mechanical: literal types + spawn signature |
| `helpers/combat.cairo` | 20 | Function signatures + model reads/writes |
| `helpers/encounter.cairo` | 10 | Function signatures, Poseidon hash simplified |
| `helpers/movement.cairo` | 4 | Function signature |
| `utils/hex.cairo` | 2 | `tile.game_id` → `tile.token_id` |
| **Total** | **296** | Mostly mechanical rename |

## File Change Summary

| File | Change | Scope |
|------|--------|-------|
| `Scarb.toml` | Add 3 dependencies + 2 external builds | Small |
| `src/models.cairo` | Rename all `game_id: u32` → `token_id: felt252` | Medium |
| `src/lib.cairo` | Register 2 new module paths | Small |
| `src/systems/game/contracts.cairo` | felt252 migration + EGS hooks on spawn/move | Large |
| `src/systems/game/tests.cairo` | Update 209 occurrences + spawn signature | Large (mechanical) |
| `src/systems/game_token/contracts.cairo` | **NEW**: MinigameComponent + IMinigameTokenData | Medium |
| `src/systems/renderer/contracts.cairo` | **NEW**: IMinigameDetails | Small |
| `src/helpers/combat.cairo` | felt252 signatures | Medium |
| `src/helpers/encounter.cairo` | felt252 signatures | Small |
| `src/helpers/movement.cairo` | felt252 signature | Small |
| `src/utils/hex.cairo` | `tile.token_id` rename | Small |
| `src/utils/setup.cairo` | Register new contracts in test world | Small |

---

## Day-by-Day Schedule

### Day 1: Core Migration + EGS Integration (8 hours)

| Hour | Task | Deliverable |
|------|------|-------------|
| 1-2 | Add dependencies to Scarb.toml, verify `sozo build` compiles with game-components | Green build |
| 2-3 | Migrate `models.cairo`: all `game_id: u32` → `token_id: felt252` | Models compile |
| 3-4 | Update all helpers (combat, encounter, movement, hex): felt252 signatures | Helpers compile |
| 4-6 | Update `game_systems`: felt252 interface, EGS hooks on spawn/move, get_token_address | Contract compiles |
| 6-7 | Create `game_token_systems` with MinigameComponent + IMinigameTokenData | score()/game_over() working |
| 7-8 | Update lib.cairo, begin test migration | Build passes |

**Day 1 Exit Criteria**: `sozo build` passes, game_token_systems implements IMinigameTokenData, core contracts compile.

### Day 2: Tests + Extensions + Deploy (8 hours)

| Hour | Task | Deliverable |
|------|------|-------------|
| 1-3 | Migrate all 75 tests to felt252 + new spawn signature, add mock token | Tests passing |
| 3-4 | Create renderer_systems with IMinigameDetails | NFT metadata working |
| 4-5 | Write EGS integration tests (mint → spawn → move → score → game_over) | EGS flow verified |
| 5-6 | Wire dojo_init calldata, set up external contract builds | Deployment ready |
| 6-7 | Deploy to local Katana, test full flow | Local deployment verified |
| 7-8 | Deploy to Sepolia, verify | Sepolia deployment live |

**Day 2 Exit Criteria**: Full EGS lifecycle works on Sepolia: mint token → spawn → move → score updates → game_over syncs.

---

## Concept Mapping: Hex'd → EGS

| EGS Concept | Hex'd Implementation |
|-------------|---------------------|
| `score()` | `PlayerStats.xp` (u32 cast to u64) |
| `game_over()` | `!GameSession.is_active` |
| Token ID | `felt252` — used directly as Dojo model key (no bridge) |
| `pre_action()` | Validates token is playable (not game_over, within lifecycle) |
| `post_action()` | Calls `update_game()` on token, which reads score/game_over and emits events |
| `assert_token_ownership()` | Verifies caller owns the ERC721 token |
| Game Name | "Hexed" |
| Game Genre | "Battle Royale" |
| Token Name | "Hex'd Survivor" |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Cairo version mismatch (2.15.0 vs 2.15.1) | Medium | Build failure | Bump Hexed to 2.15.1 |
| game-components "next" branch instability | Medium | Build failure | Pin to specific commit hash |
| Dojo 1.8.0 incompatibility with game-components | Low | Build failure | Test early on Day 1 Hour 1-2 |
| Pre/post action gas overhead per move | Low | Higher gas costs | Acceptable for game jam |
| Frontend breaks with new interface | High | Frontend unusable | Update frontend to pass token_id (Day 2 stretch) |
| Test mock complexity for token contract | Medium | Slow test migration | Use simple mock or test-only bypass |
| felt252 migration introduces subtle bugs | Medium | Runtime errors | Run full test suite after each file change |

---

## Stretch Goals (If Time Permits)

| Priority | Feature | Effort |
|----------|---------|--------|
| P1 | Settings system (grid size, starting HP, encounter rates) | 2-3 hours |
| P2 | Objectives system (reach XP thresholds) | 2-3 hours |
| P3 | Frontend updates to use token-based flow | 3-4 hours |
| P4 | IMinigameDetailsSVG (on-chain SVG of hex grid) | 4+ hours |

---

## Success Criteria

**Minimum (Must Have)**:
- [ ] All models migrated to felt252 token_id
- [ ] game_token_systems deployed with MinigameComponent
- [ ] IMinigameTokenData returns correct score and game_over
- [ ] spawn() and move() use EGS pre/post action hooks
- [ ] Compiles with `sozo build`

**Target (Should Have)**:
- [ ] All 75+ tests passing with felt252 token_id
- [ ] renderer_systems with IMinigameDetails
- [ ] EGS integration tests passing
- [ ] FullTokenContract deployed as external build
- [ ] End-to-end flow on Sepolia: mint → spawn → play → score → game_over

**Stretch (Could Have)**:
- [ ] Settings system
- [ ] Objectives system
- [ ] Frontend updated for token-based play
- [ ] Registered on Denshokan game registry

---

## References

- [EGS Documentation](https://docs.provable.games/embeddable-game-standard)
- [EGS Architecture](https://docs.provable.games/embeddable-game-standard/architecture)
- [Building a Game](https://docs.provable.games/embeddable-game-standard/building-a-game)
- [game-components GitHub](https://github.com/Provable-Games/game-components)
- [Death Mountain (reference implementation)](https://github.com/cartridge-gg/death-mountain)
- [EGS Findings Analysis](/workspace/embeddable-game-standard-findings.md)

---

*Plan created 2026-03-05. Updated to use native felt252 token_id and direct spawn/move modification (no backward compatibility). Targeting game-components "next" branch with Cairo 2.15.x.*
