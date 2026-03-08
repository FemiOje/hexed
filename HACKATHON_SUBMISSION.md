# Hex'd

**A fully onchain asynchronous battle royale with fog of war, built with Cairo and Dojo on Starknet.**

---

## What Is Hex'd?

Imagine dropping onto a hidden battlefield where every step is a coin flip between power and peril — and your enemies don't even need to be online for you to hunt them down.

Hex'd is a multiplayer survival strategy game played on a 21x21 hexagonal grid cloaked in fog of war. You can't see anyone. They can't see you. All you know is whether someone is lurking on a tile next to you — and by then, it might already be too late.

Every move to an empty tile triggers a random encounter: a **gift** that heals or empowers you, or a **curse** that drains your life, saps your strength, or kills you outright. Step onto an occupied tile and combat resolves instantly based on XP — the more experienced fighter wins. The twist? **Your opponents don't need to be playing.** You can ambush someone who logged off hours ago and take everything they've earned.

There are no turns to wait for. No lobbies. No matchmaking. You spawn, you explore, you fight, you survive — or you don't. Every decision is permanent and every outcome is verifiable onchain.

---

## How to Play

1. **Mint your game token** — Each game session is an NFT. Connect your wallet, mint a token, and you're in.
2. **Spawn** — You land on a random hex tile with 100 HP and 0 XP. The fog lifts just enough to show whether your six neighboring tiles are occupied.
3. **Move** — Pick a direction (East, West, NorthEast, NorthWest, SouthEast, SouthWest). Every move has consequences:
   - **Empty tile?** A random encounter fires. You might gain HP, earn XP, or receive a blessing — or you might be poisoned, drained, or hexed. It's a 50/50 split, and the outcome is determined by an onchain Poseidon hash, so there's no way to game it.
   - **Occupied tile?** Combat. The player with higher XP wins. Ties favor the attacker. The loser takes damage and gets knocked back. If your HP hits zero, your run is over.
4. **Survive** — Climb the leaderboard by accumulating XP. Every encounter and every kill builds your score. Death is permanent — but you can always mint a new token and try again.

---

## The Embeddable Game Standard

Hex'd implements the **Embeddable Game Standard (EGS)** — a composable framework from the Starknet ecosystem that turns game sessions into portable, discoverable NFTs.

Here's what that means in plain terms: **your Hex'd game isn't trapped inside the Hex'd website.** Every game session you play is an ERC-721 token on Starknet. That token carries your game state — HP, XP, position, alive or dead — and any platform that supports the EGS standard can read it, display it, and let you interact with it.

Through the Denshokan indexer and platforms like [Fun Factory](https://funfactory.gg), your game tokens show up in your portfolio alongside any other EGS-compatible game. You can browse your active runs, check the stats of your fallen characters, and jump back into a game — all from a single dashboard that aggregates every EGS game you've ever played.

### What this means for you as a player

- **One wallet, many games.** Your Hex'd tokens live in the same portfolio as tokens from any other EGS game. No separate accounts, no siloed profiles.
- **Your game is your NFT.** Each run is an onchain asset with real state behind it. When someone looks at your token, they see your HP, XP, and whether you're still alive.
- **Play from anywhere.** Any frontend that supports EGS can let you make moves, check scores, and resume sessions — the game logic lives onchain, not in any single app.

Under the hood, minting a game calls the `game_token_systems` contract, which issues an ERC-721 token to your wallet. That token ID becomes your game session ID. When you spawn or move, the contract verifies you own the token before executing. When you die, your score is automatically registered if it's a new record. All of it is composable, verifiable, and permanent.

---

## What's Under the Hood

Every line of game logic runs onchain via Cairo smart contracts on Starknet, orchestrated by the Dojo game engine. There is no backend server. There is no hidden state. The randomness is deterministic (Poseidon hashing over game state and block data), so every encounter can be independently verified.

### Key implementation details

- **21x21 Hex Grid** — Axial coordinate system with full bounds checking and six-directional movement
- **Fog of War** — A 6-bit bitmask reveals neighbor occupancy after each action; you see adjacency, not the full board
- **Asynchronous PvP** — Combat resolves against any player on a tile, online or not; no simultaneous presence required
- **6 Encounter Outcomes** — Gifts (Heal, Empower, Blessing) and Curses (Poison, Drain, Hex), each with distinct stat effects
- **Deterministic Onchain RNG** — Poseidon hash of game ID, position, and block timestamp; fully reproducible
- **Event-Driven Architecture** — 7 event types (Spawned, Moved, CombatResult, PlayerDied, NeighborsRevealed, EncounterOccurred, HighestScoreUpdated) drive real-time frontend updates
- **Idle Attack Detection** — Polling mechanism detects if you were attacked while away and surfaces the result when you return
- **3D Frontend** — Playable Three.js hex grid with camera controls, fog rendering, and mobile support
- **Wallet Integration** — Cartridge Controller for frictionless onchain interaction
- **Leaderboard** — Highest XP score tracked onchain with automatic registration on death
- **Game Counter** — Caps concurrent sessions at 350 (~80% of grid capacity) to keep the battlefield dense and dangerous

---

## Why It Matters

Hex'd isn't just a game — it's a proof of concept for what fully onchain, composable gaming looks like on Starknet. Every session is an NFT. Every outcome is verifiable. Every game is discoverable across the ecosystem. The Embeddable Game Standard means Hex'd doesn't live in isolation; it's a building block in a larger, interconnected world of onchain games.

Mint a token. Step into the fog. Try not to get hex'd.
