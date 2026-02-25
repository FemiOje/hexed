# Hexed - Client

React frontend for **Hexed**, a fully onchain asynchronous battle royale on Starknet. Renders a 3D hexagonal grid using Three.js and communicates with on-chain contracts via the Dojo SDK.

## Tech Stack

- [React](https://react.dev/) + TypeScript
- [Three.js](https://threejs.org/) (3D hex grid rendering)
- [Dojo SDK](https://www.dojoengine.org/) (`@dojoengine/sdk`, `@dojoengine/core`)
- [Starknet.js](https://www.starknetjs.com/) + [Cartridge Controller](https://cartridge.gg/)
- [Zustand](https://github.com/pmndrs/zustand) (state management)
- [Vite](https://vitejs.dev/) (build tooling)
- [React Hot Toast](https://react-hot-toast.com/) (notifications)

## Getting Started

```bash
pnpm install        # Install dependencies
pnpm run dev        # Start dev server
pnpm run build      # Production build
```

The client expects a Starknet RPC endpoint. Configure the connection in `dojoConfig.ts`.

## Architecture

```
src/
  pages/              # Route pages (GamePage, DeathPage)
  components/         # React components (HexGrid, Header, DeathPage)
  three/              # Three.js hex grid renderer and utilities
  stores/             # Zustand stores (gameStore, uiStore)
  contexts/           # React contexts (GameDirector, Controller)
  dojo/               # Dojo integration (useSystemCalls, useGameActions)
  api/                # Starknet RPC API calls
  types/              # TypeScript type definitions (Direction, GameEvent, etc.)
  utils/              # Coordinate mapping, helpers
  typescript/         # Auto-generated Dojo TypeScript bindings
  manifests/          # Dojo world manifests
```

### Key Modules

| Module | Purpose |
|--------|---------|
| `stores/gameStore.ts` | Zustand store for all game state (position, HP, XP, neighbors, death) |
| `contexts/GameDirector.tsx` | Orchestrates state refresh from blockchain via RPC |
| `dojo/useGameActions.tsx` | Hook for spawn/move actions with toast notifications |
| `dojo/useSystemCalls.tsx` | Low-level contract call construction and execution |
| `api/starknet.ts` | Direct Starknet RPC calls for reading game state |
| `three/` | Three.js scene, hex grid rendering, camera controls |
| `utils/coordinateMapping.ts` | Converts between blockchain Vec2 and hex grid coordinates |

### State Flow

```
Player Action → useGameActions (construct tx)
             → useSystemCalls (execute via Cartridge Controller)
             → Blockchain (Cairo contracts)
             → GameDirector (poll state via RPC every 4s)
             → gameStore (Zustand)
             → React components re-render
```

## How to Play

### Starting a Game

1. Connect your Starknet wallet (Cartridge Controller)
2. Click **Spawn** to enter the game
3. You start with **100 HP** and **0 XP** at a random position on the 21x21 hex grid

### Moving

- Click any adjacent hex to move in that direction (6 possible directions)
- Each move earns **+10 XP** from exploration
- After moving, a random encounter is triggered on the new tile

### Encounters (50/50 chance)

**Gifts** (beneficial):
| Outcome | Effect |
|---------|--------|
| Heal | +10 HP (capped at 110) |
| Empower | +20 XP |
| Blessing | +5 HP, +10 XP |

**Curses** (harmful):
| Outcome | Effect |
|---------|--------|
| Poison | -15 HP (can kill you) |
| Drain | -10 XP |
| Hex | -10 HP, -10 XP (can kill you) |

### Combat

Moving onto a tile occupied by another player triggers combat. The player with **higher XP wins** (ties favor the attacker).

- **If you win**: You move to their tile, gain +30 XP and +10 HP. They take 10 damage and get pushed to your old tile.
- **If you lose**: You take 10 damage and stay put. The defender takes 5 retaliation damage but gains no XP.
- **If either player's HP reaches 0**: They die and are removed from the game.

### Fog of War

You can only see your own position and which of the 6 neighboring tiles are occupied (shown as colored indicators). You cannot see the stats or position of other players beyond your immediate surroundings.

### Death

When your HP reaches 0 (from combat or a curse), your game ends. Your XP is submitted to the leaderboard if it's the highest score ever recorded. You can start a new game immediately.

### Leaderboard

The game tracks the **highest XP score** ever achieved. If your XP at death beats the current record, you become the new leader.

### Tips

- Watch the neighbor indicators to detect nearby players before moving toward them
- Combat rewards HP (+10), making it a viable survival strategy if you have high XP
- Curses are punishing (50% chance per move), so every move is a calculated risk
- The grid has 441 hexes with up to 350 concurrent players
